export default {
  id: 'java-006',
  category: 'java',
  kind: 'code',
  title: 'Encapsulation: why page locators are private',
  level: 'BEGINNER',
  tags: ['access-modifiers', 'encapsulation', 'page-object'],
  estMinutes: 20,
  scenario: `The login page was redesigned: the username field id changed from \`username\` to \`email\`. A grep showed 37 tests reaching directly into
\`loginPage.usernameField\` and calling \`driver.findElement(...)\` themselves — so 37 files had to change. Because the locators were \`public\`,
every test was coupled to the HTML. The fix is **encapsulation**: hide the locators and expose *behaviour* instead.`,
  description: `Refactor \`LoginPage\` so tests can no longer touch its locators or driver.

**Acceptance**
* All \`By\` locators are \`private\` (ideally \`private final\`).
* The \`WebDriver\` field is \`private\` and set through a constructor \`LoginPage(WebDriver driver)\`.
* Add a public action method \`loginAs(String username, String password)\` that types both values and clicks the button.
* Add a public query method \`String getErrorMessage()\` that returns the error banner text.
* No \`public By\` left anywhere.`,
  hints: [
    'private final By usernameField = By.id("username");',
    'Tests should read like loginPage.loginAs("asha", "wrong") — no By in the test.',
    'getErrorMessage() { return driver.findElement(errorBanner).getText(); }',
  ],
  language: 'java',
  starterCode: `package com.shop.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage {

    public WebDriver driver;

    public By usernameField = By.id("username");
    public By passwordField = By.id("password");
    public By loginButton = By.cssSelector("button[type='submit']");
    public By errorBanner = By.cssSelector(".alert-error");

    // Tests currently do this themselves:
    // driver.findElement(loginPage.usernameField).sendKeys("asha");
    // TODO: make the locators and driver private, add a constructor,
    //       loginAs(String username, String password) and getErrorMessage()
}
`,
  solution: `package com.shop.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage {

    private final WebDriver driver;

    private final By usernameField = By.id("username");
    private final By passwordField = By.id("password");
    private final By loginButton = By.cssSelector("button[type='submit']");
    private final By errorBanner = By.cssSelector(".alert-error");

    public LoginPage(WebDriver driver) {
        this.driver = driver;
    }

    public void loginAs(String username, String password) {
        driver.findElement(usernameField).clear();
        driver.findElement(usernameField).sendKeys(username);
        driver.findElement(passwordField).clear();
        driver.findElement(passwordField).sendKeys(password);
        driver.findElement(loginButton).click();
    }

    public String getErrorMessage() {
        return driver.findElement(errorBanner).getText().trim();
    }
}
`,
  checks: [
    { label: 'No public locators', pattern: 'public\\s+(static\\s+)?(final\\s+)?By\\s+\\w+', mustNot: true, hint: 'Change public By ... to private final By ...' },
    { label: 'Locators are private', pattern: 'private\\s+(static\\s+)?(final\\s+)?By\\s+\\w+\\s*=', hint: 'private final By usernameField = By.id("username");' },
    { label: 'WebDriver field is private', pattern: 'private\\s+(final\\s+)?WebDriver\\s+\\w+\\s*;', hint: 'private final WebDriver driver;' },
    { label: 'Constructor receives the WebDriver', pattern: 'public\\s+LoginPage\\s*\\(\\s*WebDriver\\s+\\w+\\s*\\)', hint: 'public LoginPage(WebDriver driver) { this.driver = driver; }' },
    { label: 'Public loginAs(username, password) action', pattern: 'public\\s+\\w+\\s+loginAs\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'public void loginAs(String username, String password)' },
    { label: 'Public getErrorMessage() returning String', pattern: 'public\\s+String\\s+getErrorMessage\\s*\\(\\s*\\)', hint: 'public String getErrorMessage() { return ...getText(); }' },
  ],
  explanation: `**Encapsulation** = keep the data (locators, driver) private and expose only meaningful operations. Java's access modifiers enforce it:

| Modifier | Visible to |
|---|---|
| \`private\` | only this class |
| *(default)* | same package |
| \`protected\` | same package + subclasses (e.g. a \`BasePage\` driver) |
| \`public\` | everyone |

Why it matters in automation:
* When the id changes from \`username\` to \`email\`, you change **one line** in \`LoginPage\`; the 37 tests call \`loginAs(...)\` and never notice.
* Tests read as business steps (\`loginAs\`, \`getErrorMessage\`) instead of Selenium plumbing — that is also exactly what Cucumber step definitions want to call.
* The page decides *how* to interact (clear before typing, trim the error text) — every test benefits.

\`final\` adds that the locator/driver reference can't be reassigned after construction.`,
  mistakes: [
    'Making locators private but adding public getters for them (getUsernameField()) — the coupling is back.',
    'Returning WebElement from page methods so tests call .click() themselves; return data (String, boolean) or the next page instead.',
    'Putting assertions inside the page object — pages expose state, tests decide pass/fail.',
    'Making the driver public static so "any class can use it" — breaks parallel runs.',
  ],
  interview: [
    { q: 'What is encapsulation and where do you use it in your framework?', a: 'Bundling data with the methods that use it and hiding the data behind access modifiers. In POM, locators and the driver are private inside page classes, and tests use public methods like loginAs(). A UI change is then fixed in one place.' },
    { q: 'Explain the four access modifiers in Java.', a: 'private: only inside the class. Default (no keyword): within the same package. protected: same package plus subclasses, typical for BasePage fields used by child pages. public: accessible from anywhere — for page actions and queries.' },
    { q: 'Should page objects contain assertions?', a: 'Generally no. Page objects model the page and return state; tests or step definitions assert. This keeps pages reusable for both positive and negative tests. A light exception is a self-check that the right page loaded.' },
  ],
}
