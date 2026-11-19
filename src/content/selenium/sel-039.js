export default {
  id: 'sel-039',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Clear and retype a prefilled field: the "Remember me" username trap',
  level: 'BEGINNER',
  tags: ['sendKeys', 'clear', 'getDomProperty', 'login', 'test-data'],
  estMinutes: 12,
  scenario: `Since the "Remember me" checkbox shipped on \`login.html\`, the nightly run fails the locked-out-user test about half the time. The log shows the username field contained \`standard_userlocked_out_user\`: an earlier test ticked "Remember me", the page prefilled the username from localStorage, and \`sendKeys\` **appended** to it instead of replacing it. Your lead asks you to make the step reliable no matter what the field already contains.`,
  description: `Write \`typeInto(By locator, String text)\` and use it in the test:

1. Open \`login.html\`. Pre-condition (simulates the earlier test): type \`standard_user\` into \`#user-name\` so it is **not** empty.
2. Use \`typeInto\` to put \`locked_out_user\` into \`#user-name\` and \`secret_sauce\` into \`#password\`.
3. Before clicking \`#login-button\`, assert the field's current value is exactly \`locked_out_user\` (read it with \`getDomProperty("value")\`, not \`getText()\`).
4. Click Login and assert \`#login-error-message\` contains \`locked out\`.

**Rules**
- \`typeInto\` must empty the field first (\`clear()\`, or select-all + delete as a fallback), then type.
- Verify the value after typing — never assume \`sendKeys\` replaced the text.
- No \`Thread.sleep\`.`,
  hints: [
    'sendKeys always types at the caret, it never replaces existing text.',
    'element.clear(); element.sendKeys(text); then compare element.getDomProperty("value") with text.',
    'getText() returns "" for an <input> — the typed text lives in the value property.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class PrefilledUsernameTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    private void typeInto(By locator, String text) {
        WebElement field = driver.findElement(locator);
        field.sendKeys(text); // TODO: this appends to whatever is already there
    }

    @Test
    public void lockedOutUserSeesError() {
        driver.get(BASE + "login.html");
        driver.findElement(USERNAME).sendKeys("standard_user"); // leftover value

        typeInto(USERNAME, "locked_out_user");
        typeInto(PASSWORD, "secret_sauce");
        // TODO: assert the username value is exactly locked_out_user
        driver.findElement(LOGIN).click();
        // TODO: assert the locked-out error
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class PrefilledUsernameTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    /** Replaces whatever the field contains with text, and proves it worked. */
    private void typeInto(By locator, String text) {
        WebElement field = driver.findElement(locator);
        field.clear();
        if (!field.getDomProperty("value").isEmpty()) {
            // Fallback for widgets that ignore clear(): select all and delete
            field.sendKeys(Keys.chord(Keys.CONTROL, "a"), Keys.DELETE);
        }
        field.sendKeys(text);
        Assert.assertEquals(field.getDomProperty("value"), text, "Field " + locator + " has the wrong value");
    }

    @Test
    public void lockedOutUserSeesError() {
        driver.get(BASE + "login.html");
        driver.findElement(USERNAME).sendKeys("standard_user"); // leftover value

        typeInto(USERNAME, "locked_out_user");
        typeInto(PASSWORD, "secret_sauce");
        Assert.assertEquals(driver.findElement(USERNAME).getDomProperty("value"), "locked_out_user");

        driver.findElement(LOGIN).click();
        WebElement error = new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.visibilityOfElementLocated(ERROR));
        Assert.assertTrue(error.getText().contains("locked out"), "Unexpected error: " + error.getText());
    }
}
`,
  checks: [
    { label: 'Clears the field before typing', pattern: '\\.clear\\s*\\(\\s*\\)', hint: 'field.clear(); before field.sendKeys(text);' },
    { label: 'Reads the typed value from the value property', pattern: 'get(DomProperty|Attribute)\\s*\\(\\s*"value"\\s*\\)', hint: 'field.getDomProperty("value")' },
    { label: 'Asserts the exact value', pattern: 'assertEquals\\s*\\([^;]*"value"', hint: 'Assert.assertEquals(field.getDomProperty("value"), text)' },
    { label: 'Asserts the locked-out message', pattern: 'locked out', hint: 'Assert that the error text contains "locked out"' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the error banner instead' },
  ],
  explanation: `\`sendKeys\` behaves like a user typing: it inserts characters at the caret and never removes what is there. Any prefilled value (browser autofill, "Remember me", a value restored after validation) silently corrupts your test data. \`clear()\` empties the field first; the select-all + Delete fallback covers rich widgets that ignore \`clear()\`.

The second half of the fix is **verifying the value**. An input's text lives in its \`value\` property, so \`getText()\` returns an empty string — use \`getDomProperty("value")\`. Putting that assertion inside \`typeInto\` means a bad value fails at the step that caused it, with a clear message, instead of three steps later at a confusing login error.`,
  mistakes: [
    'Calling sendKeys on a field that might already contain text — it appends, it does not replace.',
    'Checking the typed value with getText() — it always returns "" for <input> elements.',
    'Fixing it by deleting localStorage in this one test only; the next prefilled field will break again. Make the helper robust.',
    'Using Keys.CONTROL + "a" on macOS Grid nodes, where select-all is Keys.COMMAND — prefer clear() first and keep the chord as a fallback.',
  ],
  interview: [
    { q: 'clear() did not empty a React input — the old value came back on blur. Why, and what do you do?', a: 'clear() sets the value directly and may not fire the input events the framework listens to, so React restores its state. Select-all + Delete (or Backspace) goes through real key events, so the framework sees the change.' },
    { q: 'Why assert the field value inside the typing helper?', a: 'It fails fast at the real cause with a precise message. Without it, a wrong value surfaces later as an unrelated-looking failure, which costs triage time.' },
    { q: 'How would you prevent the "Remember me" state leaking between tests in the first place?', a: 'Give every test a fresh browser session, or clear localStorage/sessionStorage and cookies in @BeforeMethod. Robust helpers are still needed, because real users also arrive with prefilled fields.' },
  ],
}
