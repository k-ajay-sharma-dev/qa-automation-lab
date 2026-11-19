export default {
  id: 'sel-006',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Kill the flakiness: replace implicit wait + sleep with explicit waits',
  level: 'INTERMEDIATE',
  tags: ['waits', 'WebDriverWait', 'ExpectedConditions', 'flaky'],
  estMinutes: 20,
  scenario: `The "order status" test fails 1 in 5 runs on Jenkins but never on your laptop. Looking at it, someone set \`implicitlyWait(20s)\` *and* sprinkled \`Thread.sleep(3000)\` everywhere. Jenkins agents are slower, so 3 seconds is sometimes not enough, and locally the suite wastes minutes sleeping. \`waits.html\` reproduces the three behaviours: a result that appears after a delay, a spinner that must disappear, and a "Claim reward" button that becomes enabled later.`,
  description: `Rewrite the test on \`http://localhost:5180/practice-site/waits.html\` using **explicit waits only**:

1. Remove the implicit wait (or set it to \`Duration.ZERO\`) and all \`Thread.sleep\`.
2. Create one \`WebDriverWait\` with a 10-second timeout.
3. Click **Load orders** (\`#load-data-btn\`), then wait until the spinner \`#loading-spinner\` is **invisible** (\`invisibilityOfElementLocated\`).
4. Wait until the result \`#orders-loaded\` is **visible** and assert its text ("Loaded 42 orders").
5. Wait until the **late-enabled** "Claim reward" button \`#claim-reward-btn\` is **clickable** and click it.
6. Wait for the confirmation text "Reward claimed" in \`#claim-result\` with \`textToBePresentInElementLocated\`.

**Rules**: no \`Thread.sleep\`, no implicit wait mixed with explicit waits.`,
  hints: [
    'new WebDriverWait(driver, Duration.ofSeconds(10))',
    'wait.until(ExpectedConditions.visibilityOfElementLocated(RESULT)) returns the WebElement — use it directly.',
    'elementToBeClickable = visible AND enabled. It is exactly what a late-enabled button needs.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class WaitsTest extends BaseTest {

    private static final By LOAD_BUTTON = By.id("load-data-btn");
    private static final By SPINNER = By.id("loading-spinner");
    private static final By RESULT = By.id("orders-loaded");
    private static final By LATE_BUTTON = By.id("claim-reward-btn");
    private static final By CONFIRMATION = By.id("claim-result");

    @Test
    public void dataLoadsAndButtonWorks() throws InterruptedException {
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(20));
        driver.get("http://localhost:5180/practice-site/waits.html");

        driver.findElement(LOAD_BUTTON).click();
        Thread.sleep(3000);
        Assert.assertTrue(driver.findElement(RESULT).getText().contains("Loaded"));

        Thread.sleep(3000);
        driver.findElement(LATE_BUTTON).click();
        Assert.assertTrue(driver.findElement(CONFIRMATION).getText().contains("Reward claimed"));
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class WaitsTest extends BaseTest {

    private static final By LOAD_BUTTON = By.id("load-data-btn");
    private static final By SPINNER = By.id("loading-spinner");
    private static final By RESULT = By.id("orders-loaded");
    private static final By LATE_BUTTON = By.id("claim-reward-btn");
    private static final By CONFIRMATION = By.id("claim-result");

    @Test
    public void dataLoadsAndButtonWorks() {
        driver.manage().timeouts().implicitlyWait(Duration.ZERO);
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/waits.html");

        driver.findElement(LOAD_BUTTON).click();
        wait.until(ExpectedConditions.invisibilityOfElementLocated(SPINNER));

        WebElement result = wait.until(ExpectedConditions.visibilityOfElementLocated(RESULT));
        Assert.assertTrue(result.getText().contains("Loaded"), "Unexpected result: " + result.getText());

        wait.until(ExpectedConditions.elementToBeClickable(LATE_BUTTON)).click();

        boolean confirmed = wait.until(
                ExpectedConditions.textToBePresentInElementLocated(CONFIRMATION, "Reward claimed"));
        Assert.assertTrue(confirmed);
    }
}
`,
  checks: [
    { label: 'Creates a WebDriverWait with a Duration', pattern: 'new\\s+WebDriverWait\\s*\\(\\s*\\w+\\s*,\\s*Duration\\.of', hint: 'new WebDriverWait(driver, Duration.ofSeconds(10))' },
    { label: 'Waits for the spinner to disappear', pattern: 'invisibilityOf(ElementLocated)?\\s*\\(', hint: 'ExpectedConditions.invisibilityOfElementLocated(SPINNER)' },
    { label: 'Waits for visibility of the result', pattern: 'visibilityOf(ElementLocated)?\\s*\\(\\s*RESULT', hint: 'ExpectedConditions.visibilityOfElementLocated(RESULT)' },
    { label: 'Waits until the button is clickable', pattern: 'elementToBeClickable\\s*\\(', hint: 'ExpectedConditions.elementToBeClickable(LATE_BUTTON)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Every sleep becomes an explicit wait' },
    { label: 'No non-zero implicit wait', pattern: 'implicitlyWait\\s*\\(\\s*Duration\\.of', mustNot: true, hint: 'Mixing implicit and explicit waits gives unpredictable timeouts — set it to Duration.ZERO or remove it' },
  ],
  explanation: `**Thread.sleep** waits a fixed time: too short on a slow Jenkins agent (flaky), too long everywhere else (slow). An **explicit wait** polls a condition every 500 ms and continues *as soon as* it is true, failing with a \`TimeoutException\` that names the condition if it never becomes true.

**Implicit wait** is a global setting that only affects \`findElement/findElements\` — it can wait for *presence*, but not for visibility, clickability, text, or disappearance. Worse, the Selenium docs warn that **mixing implicit and explicit waits** causes unpredictable timeouts (e.g. a 10s explicit wait on top of a 20s implicit wait can take 30s+ to fail, and \`invisibilityOf\` checks become slow). Team standard: implicit = 0, explicit waits everywhere.

Pick the condition that matches what the *user* waits for:
- spinner gone → \`invisibilityOfElementLocated\`
- result shown → \`visibilityOfElementLocated\` (presence alone is not enough: the element can exist but be hidden)
- button usable → \`elementToBeClickable\` (visible + enabled)
- text arrived → \`textToBePresentInElementLocated\`

\`until()\` returns the condition's value, so \`wait.until(elementToBeClickable(...)).click()\` is idiomatic.`,
  mistakes: [
    'Replacing sleep(3000) with a 3-second explicit wait — the timeout should be the max acceptable time (10s), not the typical time.',
    'Waiting for presenceOfElementLocated when the element exists from the start but is hidden — returns instantly, then click fails.',
    'Keeping implicitlyWait(20s) "as a safety net" alongside explicit waits.',
    'Creating a new WebDriverWait before every single step instead of reusing one.',
  ],
  interview: [
    { q: 'Implicit vs explicit wait?', a: 'Implicit wait is a global timeout applied to every findElement call and only waits for presence. Explicit wait (WebDriverWait) waits for a specific condition on a specific element, such as visibility or clickability, and is the recommended approach.' },
    { q: 'Why not mix them?', a: 'The two timeouts interact: the explicit condition internally calls findElement, which itself waits for the implicit timeout, so total wait times become unpredictable and negative checks become slow.' },
    { q: 'What does a wait throw when it fails?', a: 'WebDriverWait throws TimeoutException, with the last underlying exception as the cause and a message describing the expected condition.' },
  ],
}
