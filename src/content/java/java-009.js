export default {
  id: 'java-009',
  category: 'java',
  kind: 'code',
  title: 'Inheritance and super: pull shared code into a BasePage',
  level: 'INTERMEDIATE',
  tags: ['inheritance', 'super', 'protected', 'page-object'],
  estMinutes: 25,
  scenario: `Your framework now has 14 page classes. Each one declares its own \`WebDriver\`, creates its own \`WebDriverWait\`, and has its own copy of
"wait until clickable, then click". When the team decided to raise the timeout to 15 seconds, it was changed in 9 pages and forgotten in 5 —
those 5 pages became the "flaky" ones. The cure is **inheritance**: a \`BasePage\` that every page \`extends\`.`,
  description: `Refactor the two pages so the shared code lives in one abstract \`BasePage\`.

**Acceptance**
* \`public abstract class BasePage\` with \`protected final WebDriver driver\` and \`protected final WebDriverWait wait\` (create the wait **once**, here).
* A constructor \`BasePage(WebDriver driver)\`.
* \`protected\` helpers: \`click(By)\`, \`type(By, String)\` and \`String getText(By)\` — each waits before acting.
* \`LoginPage\` and \`ProductPage\` \`extends BasePage\`, call \`super(driver)\` in their constructors, and use the inherited helpers.
* Only one \`new WebDriverWait\` in the whole code.`,
  hints: [
    'public abstract class BasePage { protected final WebDriver driver; ... }',
    'public LoginPage(WebDriver driver) { super(driver); } — super(...) must be the first line of the constructor.',
    'protected void click(By locator) { wait.until(ExpectedConditions.elementToBeClickable(locator)).click(); }',
  ],
  language: 'java',
  starterCode: `package com.shop.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

class LoginPage {
    private WebDriver driver;
    private WebDriverWait wait;
    private final By email = By.id("email");
    private final By password = By.id("password");
    private final By submit = By.cssSelector("button[type='submit']");

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void loginAs(String user, String pass) {
        wait.until(ExpectedConditions.visibilityOfElementLocated(email)).sendKeys(user);
        wait.until(ExpectedConditions.visibilityOfElementLocated(password)).sendKeys(pass);
        wait.until(ExpectedConditions.elementToBeClickable(submit)).click();
    }
}

class ProductPage {
    private WebDriver driver;
    private WebDriverWait wait;
    private final By addToCart = By.id("add-to-cart");
    private final By cartBadge = By.cssSelector(".cart-count");

    public ProductPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public String addToCartAndGetCount() {
        wait.until(ExpectedConditions.elementToBeClickable(addToCart)).click();
        return wait.until(ExpectedConditions.visibilityOfElementLocated(cartBadge)).getText();
    }
}

// TODO: create an abstract BasePage and make both pages extend it
`,
  solution: `package com.shop.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String text) {
        var field = wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
        field.clear();
        field.sendKeys(text);
    }

    protected String getText(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator)).getText().trim();
    }
}

class LoginPage extends BasePage {
    private final By email = By.id("email");
    private final By password = By.id("password");
    private final By submit = By.cssSelector("button[type='submit']");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public void loginAs(String user, String pass) {
        type(email, user);
        type(password, pass);
        click(submit);
    }
}

class ProductPage extends BasePage {
    private final By addToCart = By.id("add-to-cart");
    private final By cartBadge = By.cssSelector(".cart-count");

    public ProductPage(WebDriver driver) {
        super(driver);
    }

    public String addToCartAndGetCount() {
        click(addToCart);
        return getText(cartBadge);
    }
}
`,
  checks: [
    { label: 'Defines a BasePage class', pattern: '(abstract\\s+)?class\\s+BasePage\\b', hint: 'public abstract class BasePage { ... }' },
    { label: 'Driver is protected in BasePage', pattern: 'protected\\s+(final\\s+)?WebDriver\\s+\\w+\\s*;', hint: 'protected final WebDriver driver;' },
    { label: 'Pages extend BasePage', pattern: 'class\\s+LoginPage\\s+extends\\s+BasePage[\\s\\S]*class\\s+ProductPage\\s+extends\\s+BasePage|class\\s+ProductPage\\s+extends\\s+BasePage[\\s\\S]*class\\s+LoginPage\\s+extends\\s+BasePage', hint: 'class LoginPage extends BasePage' },
    { label: 'Child constructors call super(driver)', pattern: 'super\\s*\\(\\s*\\w+\\s*\\)\\s*;', hint: 'public LoginPage(WebDriver driver) { super(driver); }' },
    { label: 'Shared protected click helper', pattern: 'protected\\s+void\\s+click\\s*\\(\\s*By\\s+\\w+\\s*\\)', hint: 'protected void click(By locator)' },
    { label: 'WebDriverWait is created only once', pattern: '(new\\s+WebDriverWait[\\s\\S]*){2}', mustNot: true, hint: 'Only BasePage should create the wait.' },
  ],
  explanation: `**Inheritance** ("is-a"): \`LoginPage\` *is a* \`BasePage\`, so it automatically gets its fields and methods.

* \`extends BasePage\` inherits \`driver\`, \`wait\`, \`click\`, \`type\`, \`getText\`.
* \`super(driver)\` calls the parent constructor; Java requires it as the first statement because the parent part of the object must be built first. If \`BasePage\` has no no-arg constructor, forgetting \`super(...)\` is a compile error.
* \`protected\` makes fields/helpers visible to subclasses but not to tests — tests still only see \`loginAs(...)\`.
* \`abstract\` prevents \`new BasePage(driver)\` — it is a template, never a real page.

The same pattern is used for tests: an abstract \`BaseTest\` with \`@BeforeMethod setUp()\` (create driver, open baseUrl) and \`@AfterMethod tearDown()\` (quit), and every test class \`extends BaseTest\`. In Cucumber, that role is played by **Hooks** (\`@Before\`/\`@After\`) instead, because step-definition classes should not inherit from each other.

Now the timeout lives in one line — change it once, all 14 pages follow.`,
  mistakes: [
    'Each child page still creating its own WebDriverWait — inheritance in name only.',
    'Making BasePage helpers public, so tests start calling click(By) directly and bypass the page API.',
    'Putting page-specific locators into BasePage "because it is shared".',
    'Deep hierarchies (BasePage → FormPage → CheckoutFormPage → ...) — prefer composition (components) after one or two levels.',
  ],
  interview: [
    { q: 'What is the use of the super keyword?', a: 'super(...) calls the parent class constructor and must be the first line of a constructor; super.method() calls the parent version of an overridden method. In frameworks, child pages call super(driver) so BasePage can initialize driver and waits.' },
    { q: 'Where have you used inheritance in your framework?', a: 'Page classes extend BasePage to share the driver, explicit waits and common actions; test classes extend BaseTest for driver setup/teardown. Utilities usually use composition or static helpers instead.' },
    { q: 'Why does Java not support multiple inheritance of classes?', a: 'To avoid the diamond problem — ambiguity when two parents define the same method. A class can extend one class but implement many interfaces; default methods with conflicts must be resolved explicitly.' },
  ],
}
