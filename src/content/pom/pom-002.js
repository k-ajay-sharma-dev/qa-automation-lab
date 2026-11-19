export default {
  id: 'pom-002',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Your first page object: LoginPage',
  level: 'BEGINNER',
  tags: ['pom', 'page-object', 'locators', 'encapsulation'],
  estMinutes: 15,
  scenario: `After the retro, your lead creates a ticket: *"QA-212: Introduce LoginPage page object for ShopEasy"*.
The ShopEasy login screen (\`login.html\`) has a username field, a password field, a login button and an error
banner that appears for bad credentials. You will build the class every other test will depend on, so it has to be clean.`,
  description: `Complete \`LoginPage\` in package \`com.shopeasy.pages\`.

**Rules**
- Hold the \`WebDriver\` in a \`private final\` field, set through the constructor.
- Locators are \`private final By\` fields (ids: \`user-name\`, \`password\`, \`login-button\`; error banner text: \`#login-error-message\`).
- Public methods: \`open()\`, \`enterUsername(String)\`, \`enterPassword(String)\`, \`clickLogin()\`, \`login(String, String)\` and \`getErrorMessage()\` returning the banner text.
- No assertions, no \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage {

    // TODO: driver field

    // TODO: locators as private By fields

    // TODO: constructor that receives the WebDriver

    public void login(String username, String password) {
        // TODO
    }

    public String getErrorMessage() {
        // TODO
        return null;
    }
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage {

    private static final String URL = "http://localhost:5180/practice-site/login.html";

    private final WebDriver driver;

    private final By usernameInput = By.id("user-name");
    private final By passwordInput = By.id("password");
    private final By loginButton   = By.id("login-button");
    private final By errorBanner   = By.id("login-error-message");

    public LoginPage(WebDriver driver) {
        this.driver = driver;
    }

    public LoginPage open() {
        driver.get(URL);
        return this;
    }

    public LoginPage enterUsername(String username) {
        driver.findElement(usernameInput).clear();
        driver.findElement(usernameInput).sendKeys(username);
        return this;
    }

    public LoginPage enterPassword(String password) {
        driver.findElement(passwordInput).clear();
        driver.findElement(passwordInput).sendKeys(password);
        return this;
    }

    public void clickLogin() {
        driver.findElement(loginButton).click();
    }

    public void login(String username, String password) {
        enterUsername(username);
        enterPassword(password);
        clickLogin();
    }

    public String getErrorMessage() {
        return driver.findElement(errorBanner).getText();
    }
}
`,
  checks: [
    { label: 'WebDriver kept in a private field', pattern: 'private\\s+(final\\s+)?WebDriver\\s+\\w+', hint: 'Declare private final WebDriver driver;' },
    { label: 'Constructor receives the WebDriver', pattern: 'public\\s+LoginPage\\s*\\(\\s*WebDriver\\s+\\w+\\s*\\)', hint: 'public LoginPage(WebDriver driver) { this.driver = driver; }' },
    { label: 'Locators are private By fields', pattern: 'private\\s+(static\\s+)?(final\\s+)?By\\s+\\w+\\s*=\\s*By\\.', hint: 'private final By usernameInput = By.id("user-name");' },
    { label: 'No public locators', pattern: 'public\\s+(static\\s+)?(final\\s+)?By\\s+\\w+', mustNot: true, hint: 'Tests should call methods, not grab locators' },
    { label: 'login() types and clicks', pattern: 'void\\s+login\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?(sendKeys|enterUsername)[\\s\\S]*?(click|clickLogin)', hint: 'login() should enter username, password and click the button' },
    { label: 'getErrorMessage returns getText()', pattern: 'getErrorMessage[\\s\\S]*?getText\\s*\\(', hint: 'return driver.findElement(errorBanner).getText();' },
    { label: 'No assertions or sleeps in the page', pattern: '(Assert\\.|assert(Equals|True|That)\\s*\\(|Thread\\.sleep)', mustNot: true, hint: 'Pages report state; tests assert' },
  ],
  hints: [
    'Start with the fields: one WebDriver, four By locators, all private.',
    'login() should reuse enterUsername/enterPassword/clickLogin instead of duplicating findElement calls.',
    'getErrorMessage() just returns driver.findElement(errorBanner).getText().',
  ],
  explanation: `This is the canonical page object shape:

1. **State** – a \`private final WebDriver\` injected through the constructor. The page never creates a driver;
   whoever owns the browser (BaseTest / DriverManager) passes it in.
2. **Locators** – \`private final By\` fields at the top, so a UI change means editing one line.
   A \`By\` is just a *description* of how to find an element; nothing is searched until \`findElement\` runs, so
   declaring them as fields is safe even before the page is loaded.
3. **Behaviour** – small methods (\`enterUsername\`) composed into a business method (\`login\`).
   Tests mostly call \`login()\`; the small ones exist for edge cases like "only the password is filled".

A reviewer checks: are locators private, is there any \`Assert\` in the page, and do method names describe user intent rather than HTML (\`clickLogin\`, not \`clickButton3\`).`,
  mistakes: [
    'Storing WebElement fields found in the constructor; they go stale after a page refresh. Store By and find on use.',
    'Making the driver static so "any page can reach it"; this breaks parallel runs.',
    'Naming methods after HTML (clickSubmitBtn2) instead of user intent.',
    'Putting assertEquals inside getErrorMessage().',
  ],
  interview: [
    { q: 'Why store By locators instead of WebElement fields?', a: 'A By is a lazy description; the element is located fresh on each call, so it survives page reloads and re-renders. A WebElement found once can throw StaleElementReferenceException after the DOM changes.' },
    { q: 'Why does the page receive the WebDriver in its constructor?', a: 'Dependency injection: the test infrastructure owns the browser lifecycle and can hand each thread its own driver. Pages stay simple and testable, and never start or quit browsers themselves.' },
  ],
}
