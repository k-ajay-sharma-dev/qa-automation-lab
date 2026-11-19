export default {
  id: 'sel-022',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Keyboard input: Enter, Tab and Ctrl+A in a search box',
  level: 'BEGINNER',
  tags: ['keyboard', 'Keys', 'sendKeys', 'search'],
  estMinutes: 15,
  scenario: `Accessibility audit finding A11Y-19: "Power users cannot log in with the keyboard only" was fixed, and the HR team reported that the employee search does not reset when the text is deleted. Both are keyboard behaviours, which your current tests never exercise because they only call \`click()\`. You need one test that logs in by pressing **Enter**, moves between fields with **Tab**, and drives the live search on \`table.html\` with real key presses.`,
  description: `**Part 1 – login.html**
1. Type \`standard_user\` into \`#user-name\`, press \`Keys.TAB\` and assert the focused element (\`driver.switchTo().activeElement()\`) is the password field \`#password\`.
2. Type \`secret_sauce\` **followed by** \`Keys.ENTER\` (no click on the Login button) and wait for \`inventory.html\`.

**Part 2 – table.html** (\`#table-search\`, the counter is \`#row-count\`)
3. Type \`QA\` and wait until \`#row-count\` contains \`of 3 employees\`.
4. Select everything in the box with \`Keys.chord(Keys.CONTROL, "a")\` and type \`Engineering\` over it; wait for \`of 4 employees\`.
5. Select all again and press \`Keys.BACK_SPACE\`; wait for \`of 15 employees\` (the filter has been reset).

**Rules**
- Use \`org.openqa.selenium.Keys\` — no Login-button click in part 1.
- Do not use \`clear()\` in part 2 (see the explanation for why).
- No \`Thread.sleep\`.`,
  hints: [
    'sendKeys accepts several arguments: field.sendKeys("secret_sauce", Keys.ENTER);',
    'driver.switchTo().activeElement() returns the element that currently has keyboard focus.',
    'Keys.chord(Keys.CONTROL, "a") presses Ctrl+A as one shortcut (on macOS use Keys.COMMAND).',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class KeyboardTest extends BaseTest {

    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");
    private static final By SEARCH = By.id("table-search");
    private static final By ROW_COUNT = By.id("row-count");

    @Test
    public void keyboardOnlyLoginAndSearch() {
        driver.get("http://localhost:5180/practice-site/login.html");
        driver.findElement(USERNAME).sendKeys("standard_user");
        driver.findElement(PASSWORD).sendKeys("secret_sauce");
        driver.findElement(LOGIN_BUTTON).click(); // not keyboard-only

        driver.get("http://localhost:5180/practice-site/table.html");
        WebElement search = driver.findElement(SEARCH);
        search.sendKeys("QA");
        search.clear(); // the table does not reset
        // TODO
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

public class KeyboardTest extends BaseTest {

    private static final By USERNAME = By.id("user-name");
    private static final By SEARCH = By.id("table-search");
    private static final By ROW_COUNT = By.id("row-count");

    @Test
    public void keyboardOnlyLoginAndSearch() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        // Part 1: log in with the keyboard only
        driver.get("http://localhost:5180/practice-site/login.html");
        WebElement username = driver.findElement(USERNAME);
        username.sendKeys("standard_user", Keys.TAB);

        WebElement focused = driver.switchTo().activeElement();
        Assert.assertEquals(focused.getDomAttribute("id"), "password", "Tab should move focus to the password");
        focused.sendKeys("secret_sauce", Keys.ENTER);
        wait.until(ExpectedConditions.urlContains("inventory.html"));

        // Part 2: drive the live search with key presses
        driver.get("http://localhost:5180/practice-site/table.html");
        WebElement search = driver.findElement(SEARCH);

        search.sendKeys("QA");
        wait.until(ExpectedConditions.textToBePresentInElementLocated(ROW_COUNT, "of 3 employees"));

        search.sendKeys(Keys.chord(Keys.CONTROL, "a"), "Engineering");
        wait.until(ExpectedConditions.textToBePresentInElementLocated(ROW_COUNT, "of 4 employees"));

        search.sendKeys(Keys.chord(Keys.CONTROL, "a"), Keys.BACK_SPACE);
        wait.until(ExpectedConditions.textToBePresentInElementLocated(ROW_COUNT, "of 15 employees"));
        Assert.assertEquals(search.getDomProperty("value"), "", "Search box should be empty");
    }
}
`,
  checks: [
    { label: 'Imports / uses the Keys enum', pattern: 'Keys\\.(ENTER|RETURN|TAB)', hint: 'import org.openqa.selenium.Keys;' },
    { label: 'Submits with Enter', pattern: 'sendKeys\\s*\\([^;]*Keys\\.(ENTER|RETURN)', hint: 'password.sendKeys("secret_sauce", Keys.ENTER);' },
    { label: 'Checks focus after Tab with activeElement()', pattern: 'switchTo\\s*\\(\\s*\\)\\s*\\.activeElement\\s*\\(', hint: 'driver.switchTo().activeElement()' },
    { label: 'Selects all with a Ctrl+A chord', pattern: 'Keys\\.chord\\s*\\(\\s*Keys\\.(CONTROL|COMMAND)', hint: 'Keys.chord(Keys.CONTROL, "a")' },
    { label: 'Waits for the row counter to update', pattern: 'textToBePresentInElement(Located)?\\s*\\(\\s*ROW_COUNT', hint: 'wait.until(ExpectedConditions.textToBePresentInElementLocated(ROW_COUNT, "of 3 employees"))' },
    { label: 'Does not click the Login button', pattern: 'LOGIN_BUTTON\\s*\\)\\s*\\.click', mustNot: true, hint: 'Press Enter in the password field instead' },
    { label: 'Does not use clear() on the search box', pattern: '\\.clear\\s*\\(\\s*\\)', mustNot: true, hint: 'Ctrl+A then Backspace fires real key events' },
  ],
  explanation: `\`sendKeys\` types characters *and* special keys from the \`Keys\` enum, and it takes several arguments in one call: \`sendKeys("secret_sauce", Keys.ENTER)\` types the password and presses Enter, which submits the form exactly like a keyboard user would.

**Focus**: after \`Keys.TAB\` you can ask the browser which element has focus with \`driver.switchTo().activeElement()\`. Comparing its id is how you test tab order — a common accessibility check.

**Chords**: \`Keys.chord(Keys.CONTROL, "a")\` holds Ctrl, presses A, and releases Ctrl. Typing new text right after it replaces the selection. On macOS the shortcut is Cmd+A, so a cross-platform framework picks \`Keys.COMMAND\` when \`System.getProperty("os.name")\` contains "Mac".

**Why not \`clear()\` here?** \`table.html\` filters on the \`input\` event, which fires on every key press. \`clear()\` empties the value programmatically and may not fire the events that the page listens to (depending on the browser and driver, you often get only a \`change\` event). The value is empty, but the table still shows the old filter — exactly HR's bug report, caused by the test instead of the app. Ctrl+A + Backspace behaves like a real user.

**Wait for the result, not the typing**: the counter text (\`Showing 1–3 of 3 employees\`) is the proof that the filter ran, so the test waits on it with \`textToBePresentInElementLocated\`.`,
  mistakes: [
    'Using clear() on a search box that reacts to key events — the value changes but the page does not react.',
    'Hard-coding Keys.CONTROL in a suite that also runs on macOS agents, where select-all is Cmd+A.',
    'Concatenating "secret_sauce" + Keys.ENTER and expecting it to work in every case — pass Keys as a separate argument for readability.',
    'Asserting the row count immediately after typing, before the filter has re-rendered the table.',
  ],
  interview: [
    { q: 'How do you press Enter or Tab in Selenium?', a: 'Pass a value of the Keys enum to sendKeys, e.g. element.sendKeys(Keys.ENTER). For combinations use Keys.chord(Keys.CONTROL, "a") or the Actions API with keyDown/keyUp.' },
    { q: 'When would you use Actions instead of sendKeys for keys?', a: 'When the key press is not aimed at one element (a page-level shortcut), or when a modifier must be held while clicking or dragging: new Actions(driver).keyDown(Keys.SHIFT).click(el).keyUp(Keys.SHIFT).perform().' },
    { q: 'How do you check which element has focus?', a: 'driver.switchTo().activeElement() returns the focused element; compare its id or accessible name. This is how keyboard navigation and tab order are tested.' },
  ],
}
