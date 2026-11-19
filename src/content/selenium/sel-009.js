export default {
  id: 'sel-009',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Handle JS alerts, confirms, prompts and an HTML modal',
  level: 'BEGINNER',
  tags: ['alerts', 'switchTo', 'modal'],
  estMinutes: 15,
  scenario: `"Empty cart" shows a browser \`confirm()\` dialog and the "Apply coupon" flow uses a \`prompt()\`. Your current test dies with \`UnhandledAlertException\` the moment a dialog pops up, and when you tried \`findElement\` on the dialog's OK button nothing was found. Meanwhile the newer "Delete saved address" dialog is a styled HTML modal. \`alerts.html\` has all four.`,
  description: `On \`http://localhost:5180/practice-site/alerts.html\`:

1. **Alert** — click \`#js-alert-btn\`, wait for \`alertIsPresent()\`, assert the text ("I am a JS Alert"), \`accept()\`.
2. **Confirm** — click \`#js-confirm-btn\`, \`dismiss()\` it (Cancel), assert the result text in \`#result\` says it was cancelled ("You clicked: Cancel").
3. **Prompt** — click \`#js-prompt-btn\`, \`sendKeys("SAVE10")\`, \`accept()\`, assert \`#result\` contains \`SAVE10\` ("You entered: SAVE10").
4. **HTML modal** — open it with \`#open-modal-btn\`, and close it with a normal \`findElement(...).click()\` on the × button \`#modal-close\` (it is DOM, not a browser dialog), then wait for the overlay \`#confirm-modal\` to be invisible.

**Rules**: use \`driver.switchTo().alert()\` (or the \`Alert\` returned by the wait), no \`Thread.sleep\`.`,
  hints: [
    'Alert alert = wait.until(ExpectedConditions.alertIsPresent());',
    'alert.getText(), alert.accept(), alert.dismiss(), alert.sendKeys("...")',
    'If you can inspect it in DevTools, it is an HTML modal — not an Alert.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class AlertsTest extends BaseTest {

    private static final By ALERT_BTN = By.id("js-alert-btn");
    private static final By CONFIRM_BTN = By.id("js-confirm-btn");
    private static final By PROMPT_BTN = By.id("js-prompt-btn");
    private static final By RESULT = By.id("result");
    private static final By OPEN_MODAL = By.id("open-modal-btn");
    private static final By MODAL = By.id("confirm-modal");
    private static final By MODAL_CLOSE = By.id("modal-close");

    @Test
    public void handlesAllDialogs() {
        driver.get("http://localhost:5180/practice-site/alerts.html");
        driver.findElement(ALERT_BTN).click();
        driver.findElement(By.xpath("//button[text()='OK']")).click(); // NoSuchElement / UnhandledAlert
        // TODO
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.Alert;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class AlertsTest extends BaseTest {

    private static final By ALERT_BTN = By.id("js-alert-btn");
    private static final By CONFIRM_BTN = By.id("js-confirm-btn");
    private static final By PROMPT_BTN = By.id("js-prompt-btn");
    private static final By RESULT = By.id("result");
    private static final By OPEN_MODAL = By.id("open-modal-btn");
    private static final By MODAL = By.id("confirm-modal");
    private static final By MODAL_CLOSE = By.id("modal-close");

    @Test
    public void handlesAllDialogs() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.get("http://localhost:5180/practice-site/alerts.html");

        // 1. simple alert
        driver.findElement(ALERT_BTN).click();
        Alert alert = wait.until(ExpectedConditions.alertIsPresent());
        Assert.assertFalse(alert.getText().isBlank(), "Alert should have a message");
        alert.accept();

        // 2. confirm -> Cancel
        driver.findElement(CONFIRM_BTN).click();
        wait.until(ExpectedConditions.alertIsPresent());
        driver.switchTo().alert().dismiss();
        Assert.assertTrue(driver.findElement(RESULT).getText().toLowerCase().contains("cancel"),
                "Expected cancel result but was: " + driver.findElement(RESULT).getText());

        // 3. prompt -> type + OK
        driver.findElement(PROMPT_BTN).click();
        Alert prompt = wait.until(ExpectedConditions.alertIsPresent());
        prompt.sendKeys("SAVE10");
        prompt.accept();
        wait.until(ExpectedConditions.textToBePresentInElementLocated(RESULT, "SAVE10"));

        // 4. HTML modal: plain DOM
        driver.findElement(OPEN_MODAL).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(MODAL));
        driver.findElement(MODAL_CLOSE).click();
        Assert.assertTrue(wait.until(ExpectedConditions.invisibilityOfElementLocated(MODAL)));
    }
}
`,
  checks: [
    { label: 'Waits for the alert', pattern: 'alertIsPresent\\s*\\(', hint: 'wait.until(ExpectedConditions.alertIsPresent())' },
    { label: 'Accepts an alert', pattern: '\\.accept\\s*\\(\\s*\\)', hint: 'alert.accept()' },
    { label: 'Dismisses the confirm', pattern: '\\.dismiss\\s*\\(\\s*\\)', hint: 'alert.dismiss() clicks Cancel' },
    { label: 'Types into the prompt', pattern: '\\w+\\.sendKeys\\s*\\(\\s*"SAVE10"', hint: 'prompt.sendKeys("SAVE10")' },
    { label: 'Waits for the HTML modal to close', pattern: 'invisibilityOf(ElementLocated)?\\s*\\(\\s*MODAL', hint: 'invisibilityOfElementLocated(MODAL)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'alertIsPresent() is the wait you need' },
  ],
  explanation: `JavaScript \`alert/confirm/prompt\` dialogs are **browser-native**, not part of the DOM — that's why \`findElement\` cannot see their buttons, and any other command while one is open throws \`UnhandledAlertException\`. You reach them with \`driver.switchTo().alert()\`:

| method | effect |
|---|---|
| \`getText()\` | dialog message |
| \`accept()\` | OK |
| \`dismiss()\` | Cancel (on a plain alert, same as OK) |
| \`sendKeys(text)\` | types into a prompt |

\`ExpectedConditions.alertIsPresent()\` both waits and switches, returning the \`Alert\`. Without it, \`switchTo().alert()\` can throw \`NoAlertPresentException\` if the dialog opens a few ms later.

An **HTML modal** (a \`div\` styled as a dialog) is normal DOM: locate, click, and wait for it to become invisible. The quick test: if you can right-click → Inspect it, it's HTML.

Note: Chrome's default \`unhandledPromptBehavior\` is "dismiss and notify", which is why the test crashes — set it in \`ChromeOptions\` only if you deliberately want auto-handling.`,
  mistakes: [
    'Trying to locate the OK button of a JS alert with XPath.',
    'Calling switchTo().alert() immediately after click without waiting — NoAlertPresentException on slow runs.',
    'Calling switchTo().alert() on an HTML modal — NoAlertPresentException.',
    'Forgetting to accept/dismiss, so the next step throws UnhandledAlertException.',
  ],
  interview: [
    { q: 'How do you handle a JavaScript alert in Selenium?', a: 'Wait with ExpectedConditions.alertIsPresent() (or driver.switchTo().alert()), read getText(), then accept(), dismiss() or sendKeys() for prompts.' },
    { q: 'How do you handle a basic-auth popup?', a: 'It is not a JS alert. Pass credentials in the URL (https://user:pass@host) or, in Selenium 4 with Chromium, register credentials with HasAuthentication / driver.register(UsernameAndPassword.of(...)).' },
    { q: 'What is UnhandledAlertException?', a: 'Thrown when you send a command while an alert is open; the driver handles the alert per unhandledPromptBehavior and reports it so the test does not silently continue.' },
  ],
}
