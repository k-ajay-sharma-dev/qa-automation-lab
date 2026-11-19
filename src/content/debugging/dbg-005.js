export default {
  id: 'dbg-005',
  category: 'debugging',
  kind: 'code',
  title: 'NoSuchWindowException: the test closed the tab it was standing on',
  level: 'INTERMEDIATE',
  tags: ['windows', 'tabs', 'getWindowHandles', 'NoSuchWindowException'],
  estMinutes: 20,
  scenario: `On your current project's checkout page (a client web shop — the ShopEasy practice checkout has no terms link or *Place order* button), the **"Terms & Conditions"** link opens in a new tab. *(To practise the same flow on the practice site, use windows.html: \`#new-tab-link\` opens the "Size guide" tab with heading \`#new-window-heading\`.)* The story requires us to verify the terms heading and then complete the order. The test reads the heading fine, but the very next step — clicking *Place order* — crashes. Your manual-testing instinct says "the user is back on the checkout tab", but the driver doesn't think so.`,
  description: `Jenkins console:

\`\`\`text
[ERROR] acceptTermsAndPlaceOrder(com.shopeasy.tests.CheckoutTest)  Time elapsed: 3.877 s  <<< ERROR!
org.openqa.selenium.NoSuchWindowException: no such window: target window already closed
from unknown error: web view not found
  (Session info: chrome=126.0.6478.126)
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Command: [5be3f9d1..., findElement {using=id, value=place-order}]
	at org.openqa.selenium.remote.RemoteWebDriver.findElement(RemoteWebDriver.java:353)
	at com.shopeasy.pages.CheckoutPage.placeOrder(CheckoutPage.java:52)
	at com.shopeasy.tests.CheckoutTest.acceptTermsAndPlaceOrder(CheckoutTest.java:61)
\`\`\`

**Diagnose:** \`readTermsHeading()\` loops over all handles and switches to *each* one — so it ends on whichever handle came last — then calls \`driver.close()\`, which closes the **current** tab. The driver is now "standing" on a closed window. Closing a tab never moves the driver back automatically.

**Fix \`readTermsHeading()\`:**
- Remember the original handle with \`getWindowHandle()\`.
- Wait until there are 2 windows, then switch to the handle that is **not** the original.
- Read the heading, close the terms tab, and **switch back** to the original handle.`,
  hints: [
    'driver.close() closes the current window; driver.quit() ends the whole session. Neither switches you anywhere.',
    'String original = driver.getWindowHandle(); then compare each handle in getWindowHandles() with it.',
    'wait.until(ExpectedConditions.numberOfWindowsToBe(2)); ... driver.switchTo().window(original);',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By TERMS_LINK = By.linkText("Terms & Conditions");
    private final By TERMS_HEADING = By.cssSelector("h1.terms-title");
    private final By PLACE_ORDER = By.id("place-order");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public String readTermsHeading() {
        driver.findElement(TERMS_LINK).click();
        for (String handle : driver.getWindowHandles()) {
            driver.switchTo().window(handle);
        }
        String heading = driver.findElement(TERMS_HEADING).getText();
        driver.close();
        return heading;
    }

    public void placeOrder() {
        wait.until(ExpectedConditions.elementToBeClickable(PLACE_ORDER)).click();
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By TERMS_LINK = By.linkText("Terms & Conditions");
    private final By TERMS_HEADING = By.cssSelector("h1.terms-title");
    private final By PLACE_ORDER = By.id("place-order");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public String readTermsHeading() {
        String original = driver.getWindowHandle();
        driver.findElement(TERMS_LINK).click();
        wait.until(ExpectedConditions.numberOfWindowsToBe(2));

        for (String handle : driver.getWindowHandles()) {
            if (!handle.equals(original)) {
                driver.switchTo().window(handle);
                break;
            }
        }
        try {
            return wait.until(ExpectedConditions.visibilityOfElementLocated(TERMS_HEADING)).getText();
        } finally {
            driver.close();                       // closes ONLY the terms tab
            driver.switchTo().window(original);   // move the driver back to checkout
        }
    }

    public void placeOrder() {
        wait.until(ExpectedConditions.elementToBeClickable(PLACE_ORDER)).click();
    }
}
`,
  checks: [
    { label: 'Saves the original window handle', pattern: 'getWindowHandle\\s*\\(\\s*\\)', hint: 'String original = driver.getWindowHandle();' },
    { label: 'Waits for the new tab to open', pattern: 'numberOfWindowsToBe\\s*\\(', hint: 'wait.until(ExpectedConditions.numberOfWindowsToBe(2))' },
    { label: 'Picks the handle that is not the original', pattern: '(!\\s*\\w+\\.equals\\s*\\(|\\.equals\\s*\\([^)]*\\)\\s*==\\s*false|!=)', hint: 'if (!handle.equals(original)) ...' },
    { label: 'Switches back to the original window after closing', pattern: 'close\\s*\\(\\s*\\)[\\s\\S]*switchTo\\(\\)\\s*\\.window\\s*\\(', flags: 'ms', hint: 'driver.close(); driver.switchTo().window(original);' },
  ],
  explanation: `**Mental model:** WebDriver has exactly one "current" window. Clicking a \`target=_blank\` link opens a tab *visually*, but the driver stays where it was. \`close()\` destroys the current window and leaves the driver pointing at nothing — every following command throws \`NoSuchWindowException\`.

**Why the starter was buggy in two ways:**
1. The \`for\` loop switched to every handle and stopped on the last — that *happened* to be the new tab, but that relies on set order and breaks with a third window (e.g., a chat pop-up).
2. After \`close()\` it never switched back.

**The robust pattern:**
\`\`\`java
String original = driver.getWindowHandle();
// click → wait for 2 windows → switch to the one != original
// ... work ...
driver.close();
driver.switchTo().window(original);
\`\`\`
\`numberOfWindowsToBe(2)\` matters on Jenkins: right after the click the new handle may not exist yet. Selenium 4 also offers \`driver.switchTo().newWindow(WindowType.TAB)\` when *you* want to open a tab.`,
  mistakes: [
    'Assuming the driver follows the new tab automatically.',
    'Using new ArrayList<>(handles).get(1) without waiting — the second handle may not exist yet.',
    'Calling driver.quit() instead of close(), which kills the whole session.',
    'Forgetting to switch back after closing the child window.',
  ],
  interview: [
    { q: 'How do you handle multiple windows or tabs?', a: 'I store the parent handle with getWindowHandle(), perform the click, wait for numberOfWindowsToBe(2), then loop through getWindowHandles() and switch to the one that does not equal the parent. After validating, I close the child with close() and switch back to the parent. In my project that was the Terms page that opened in a new tab during checkout.' },
    { q: 'Difference between close() and quit()?', a: 'close() closes only the current window and keeps the session alive; quit() closes all windows and ends the driver session. We use quit() in teardown and close() only for child windows.' },
  ],
}
