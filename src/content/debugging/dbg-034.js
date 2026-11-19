export default {
  id: 'dbg-034',
  category: 'debugging',
  kind: 'code',
  title: 'NoAlertPresentException: the session-expiry alert arrives 3 seconds late',
  level: 'BEGINNER',
  tags: ['NoAlertPresentException', 'alerts', 'waits', 'alertIsPresent'],
  estMinutes: 12,
  scenario: `The ShopEasy team added a warning pop-up: *"Your session will expire in 5 minutes"*. On the practice page \`alerts.html\` it is triggered by the **Alert after 3 seconds** button (\`#delayed-alert-btn\`), which calls \`alert()\` inside a \`setTimeout\` of 3000 ms. Your new test fails on every run, locally and on Jenkins, and the junior who wrote it says "but I can see the alert on the screen when I watch it".`,
  description: `Console output:

\`\`\`text
[ERROR] sessionExpiryWarningIsShown(com.shopeasy.tests.AlertTest)  Time elapsed: 1.204 s  <<< ERROR!
org.openqa.selenium.NoAlertPresentException: no such alert
  (Session info: chrome=126.0.6478.126)
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Command: [5d1e..., getAlertText {}]
	at org.openqa.selenium.remote.RemoteWebDriver$RemoteTargetLocator.alert(RemoteWebDriver.java:1063)
	at com.shopeasy.pages.AlertsPage.readExpiryWarning(AlertsPage.java:24)
	at com.shopeasy.tests.AlertTest.sessionExpiryWarningIsShown(AlertTest.java:19)
\`\`\`

**Diagnose:** \`switchTo().alert()\` is called a few milliseconds after the click, but the alert only opens 3 seconds later. The alert is *real*, it is just not there yet. "I can see it" happens because the browser stays open after the failure.

**Fix \`AlertsPage.readExpiryWarning()\`:**
- Wait explicitly (up to 10 s) with \`ExpectedConditions.alertIsPresent()\` — it returns the \`Alert\`.
- Read its text, then **accept** it, and return the text.
- After accepting, wait until \`#result\` shows \`Delayed alert accepted\`.
- **Rules:** no \`Thread.sleep\`.`,
  hints: [
    'NoAlertPresentException is the alert version of NoSuchElementException: right command, wrong moment.',
    'ExpectedConditions.alertIsPresent() switches to the alert for you and returns it.',
    'Alert alert = wait.until(ExpectedConditions.alertIsPresent()); String text = alert.getText(); alert.accept();',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class AlertsPage {

    private final WebDriver driver;

    private final By DELAYED_ALERT_BTN = By.id("delayed-alert-btn");
    private final By RESULT = By.id("result");

    public AlertsPage(WebDriver driver) {
        this.driver = driver;
    }

    public String readExpiryWarning() {
        driver.findElement(DELAYED_ALERT_BTN).click();
        // line 24 - NoAlertPresentException: no such alert
        String text = driver.switchTo().alert().getText();
        driver.switchTo().alert().accept();
        return text;
    }

    public String getResult() {
        return driver.findElement(RESULT).getText();
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.Alert;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class AlertsPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By DELAYED_ALERT_BTN = By.id("delayed-alert-btn");
    private final By RESULT = By.id("result");

    public AlertsPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public String readExpiryWarning() {
        driver.findElement(DELAYED_ALERT_BTN).click();
        // the alert is opened by a setTimeout(3000) - wait for it instead of assuming it is there
        Alert alert = wait.until(ExpectedConditions.alertIsPresent());
        String text = alert.getText();
        alert.accept();
        wait.until(ExpectedConditions.textToBe(RESULT, "Delayed alert accepted"));
        return text;
    }

    public String getResult() {
        return driver.findElement(RESULT).getText();
    }
}
`,
  checks: [
    { label: 'Creates a WebDriverWait with a Duration', pattern: 'new\\s+WebDriverWait\\s*\\([^)]*Duration\\.of', hint: 'new WebDriverWait(driver, Duration.ofSeconds(10))' },
    { label: 'Waits for the alert with alertIsPresent()', pattern: 'ExpectedConditions\\.alertIsPresent\\s*\\(\\s*\\)', hint: 'wait.until(ExpectedConditions.alertIsPresent())' },
    { label: 'Accepts the alert', pattern: '\\.accept\\s*\\(\\s*\\)', hint: 'alert.accept() closes it with OK' },
    { label: 'Waits for the result text after accepting', pattern: 'ExpectedConditions\\.(textToBe|textToBePresentInElementLocated)\\s*\\(\\s*RESULT', hint: 'wait.until(ExpectedConditions.textToBe(RESULT, "Delayed alert accepted"))' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'A 3-second sleep works until the timer changes to 4 seconds' },
  ],
  explanation: `**Root cause:** \`driver.switchTo().alert()\` does not wait. If no JavaScript alert is open at that instant, the driver throws \`NoAlertPresentException\`. The button only *schedules* the alert (\`setTimeout(..., 3000)\`), so the test looked too early.

**The fix:** \`ExpectedConditions.alertIsPresent()\` polls until an alert is open, switches to it and returns the \`Alert\` object. You keep one reference (\`alert\`) instead of calling \`switchTo().alert()\` twice. After \`accept()\` the page continues its script, so the result text is also asynchronous — wait for it with \`textToBe\`.

**Reviewer checklist:** wait created once, alert text read *before* accept (afterwards the alert is gone), no hard sleep, and the assertion on the alert text lives in the test, not in the page object.`,
  mistakes: [
    'Adding Thread.sleep(3000) — it matches today\'s timer exactly and breaks on a slow CI agent.',
    'Calling getText() after accept() — the alert is already closed, so you get NoAlertPresentException again.',
    'Trying to locate the alert with findElement — native JS alerts are not part of the DOM.',
    'Raising the implicit wait: implicit waits apply to findElement only, never to alerts.',
  ],
  interview: [
    { q: 'How do you handle an alert that appears after a delay?', a: 'I wait for it with WebDriverWait and ExpectedConditions.alertIsPresent(), which returns the Alert once it is open. Then I read the text, accept or dismiss it, and wait for whatever the page does next. switchTo().alert() on its own does not wait.' },
    { q: 'Does the implicit wait help with alerts?', a: 'No. The implicit wait only affects findElement and findElements. Alerts, windows and frames need explicit waits such as alertIsPresent, numberOfWindowsToBe or frameToBeAvailableAndSwitchToIt.' },
    { q: 'What is the difference between a JS alert and an HTML modal?', a: 'A JS alert is a native browser dialog created by alert(), confirm() or prompt(); it is not in the DOM and you handle it through switchTo().alert(). An HTML modal is just divs on the page, so you locate its buttons with normal locators.' },
  ],
}
