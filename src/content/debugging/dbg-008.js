export default {
  id: 'dbg-008',
  category: 'debugging',
  kind: 'code',
  title: 'The 40-minute suite: implicit and explicit waits mixed together',
  level: 'INTERMEDIATE',
  tags: ['implicit-wait', 'explicit-wait', 'performance', 'negative-checks'],
  estMinutes: 20,
  scenario: `The ShopEasy regression suite used to take 12 minutes; now it takes **40**. The pipeline times out before the release sign-off. Looking at the timings, every test that checks that an error **does not** appear takes ~20 seconds, and some explicit waits that should time out after 10 s take 30 s. A previous engineer set a 20-second implicit wait "to make things stable".`,
  description: `Jenkins console extract:

\`\`\`text
[INFO] Tests run: 48, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2,418.77 s - in TestSuite
...
[ERROR] missingPostalCodeShowsError(com.shopeasy.tests.CheckoutTest)  Time elapsed: 31.204 s  <<< ERROR!
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of element located by By.cssSelector: #checkout-error-message (tried for 10 second(s) with 500 milliseconds interval)
	at org.openqa.selenium.support.ui.WebDriverWait.timeoutException(WebDriverWait.java:84)
	at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)
	at com.shopeasy.pages.CheckoutPage.getErrorMessage(CheckoutPage.java:47)
\`\`\`

Notice: "tried for **10** second(s)" but the test took **31** seconds. That's the signature of mixing waits — each poll inside the explicit wait also sits on the implicit wait.

**Fix it in \`DriverFactory\` and \`CheckoutPage\`:**
- Set the implicit wait to **zero** (or remove it) — use explicit waits only.
- \`isErrorBannerDisplayed()\` must check *absence* quickly: use a short explicit \`invisibilityOfElementLocated\` wait instead of \`findElements(...).size()\` under a 20 s implicit wait.
- Keep a \`WebDriverWait\` for the positive check \`getErrorMessage()\`.`,
  hints: [
    'Selenium docs: "Do not mix implicit and explicit waits. Doing so can cause unpredictable wait times."',
    'findElements returns an empty list only after the implicit wait has fully expired — 20 s for every "not present" check.',
    'driver.manage().timeouts().implicitlyWait(Duration.ZERO); and wait.until(ExpectedConditions.invisibilityOfElementLocated(ERROR_BANNER));',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

// --- DriverFactory.java (excerpt) ---
// driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(20));

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By ERROR_BANNER = By.cssSelector("#checkout-error");
    private final By ERROR_MESSAGE = By.cssSelector("#checkout-error-message");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(20));
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public boolean isErrorBannerDisplayed() {
        // takes 20 seconds every time the banner is NOT there
        return driver.findElements(ERROR_BANNER).size() > 0;
    }

    public String getErrorMessage() {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(ERROR_MESSAGE)).getText();
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

// --- DriverFactory.java (excerpt) ---
// driver.manage().timeouts().implicitlyWait(Duration.ZERO);  // explicit waits only

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;
    private final WebDriverWait shortWait;

    private final By ERROR_BANNER = By.cssSelector("#checkout-error");
    private final By ERROR_MESSAGE = By.cssSelector("#checkout-error-message");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        driver.manage().timeouts().implicitlyWait(Duration.ZERO);
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        this.shortWait = new WebDriverWait(driver, Duration.ofSeconds(2));
    }

    public boolean isErrorBannerDisplayed() {
        try {
            // returns true quickly once the banner is gone / never appeared
            return !shortWait.until(ExpectedConditions.invisibilityOfElementLocated(ERROR_BANNER));
        } catch (TimeoutException stillVisible) {
            return true;
        }
    }

    public String getErrorMessage() {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(ERROR_MESSAGE)).getText();
    }
}
`,
  checks: [
    { label: 'No non-zero implicit wait', pattern: 'implicitlyWait\\s*\\(\\s*Duration\\.of(Seconds|Millis)\\s*\\(\\s*[1-9]', mustNot: true, hint: 'implicitlyWait(Duration.ZERO) or remove it' },
    { label: 'Uses explicit WebDriverWait', pattern: 'new\\s+WebDriverWait\\s*\\(', hint: 'Explicit waits only' },
    { label: 'Absence check uses invisibilityOfElementLocated', pattern: 'invisibilityOfElementLocated\\s*\\(\\s*ERROR_BANNER', hint: 'shortWait.until(ExpectedConditions.invisibilityOfElementLocated(ERROR_BANNER))' },
    { label: 'Absence check no longer relies on findElements().size()', pattern: 'findElements\\s*\\(\\s*ERROR_BANNER\\s*\\)\\s*\\.size', mustNot: true, hint: 'Under an implicit wait, an empty findElements is always slow' },
  ],
  explanation: `**Why mixing waits is slow and unpredictable:** an explicit wait polls by calling \`findElement\` repeatedly. With an implicit wait of 20 s, *each* of those internal calls can itself block for up to 20 s before returning "not found". A 10 s explicit wait can therefore take 20, 30 or more seconds — exactly the "tried for 10 seconds / elapsed 31 s" mismatch in the log.

**Negative checks are the biggest victims:** \`findElements(...)\` returns an empty list only after the implicit wait expires. Every "error banner should NOT be shown" check cost 20 s. Multiply by dozens of checks → +28 minutes.

**The industry-standard rule:** set the implicit wait to 0 and use explicit waits with the right condition:
| Need | Condition |
|---|---|
| element to click | \`elementToBeClickable\` |
| text to read | \`visibilityOfElementLocated\` |
| spinner/banner to go away | \`invisibilityOfElementLocated\` |
| list re-rendered | \`numberOfElementsToBe\` / \`stalenessOf\` |

Use a *short* wait for absence checks — you just need to give a late banner a chance to appear/disappear, not 20 s.`,
  mistakes: [
    'Raising the pipeline timeout instead of finding why the suite is slow.',
    'Keeping a 20 s implicit wait "for safety" alongside explicit waits.',
    'Using findElements().isEmpty() for negative checks under a global implicit wait.',
    'Using a long explicit wait for an absence check.',
  ],
  interview: [
    { q: 'Implicit vs explicit wait — which do you use and why?', a: 'In my framework we keep the implicit wait at zero and use explicit WebDriverWait with ExpectedConditions in page objects, wrapped in small helper methods. Implicit waits apply globally only to element lookup, and mixing them with explicit waits causes unpredictable timeouts — we actually had a suite go from 12 to 40 minutes because of that, mostly on negative checks.' },
    { q: 'How do you verify that an element is NOT displayed?', a: 'With a short explicit wait for invisibilityOfElementLocated, which returns true as soon as the element is absent or hidden. I avoid findElements().size() under an implicit wait because it always waits the full implicit timeout before returning empty.' },
    { q: 'What is FluentWait?', a: 'It is the parent of WebDriverWait where you configure the timeout, polling interval and which exceptions to ignore. We use it when we need custom polling, for example checking a status every 2 seconds for up to a minute while a report is generated.' },
  ],
}
