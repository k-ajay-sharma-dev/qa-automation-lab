export default {
  id: 'pom-005',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'BasePage: one home for waits, click and type',
  level: 'INTERMEDIATE',
  tags: ['pom', 'basepage', 'waits', 'inheritance'],
  estMinutes: 20,
  scenario: `ShopEasy now has six page objects and every one of them repeats
\`new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.elementToBeClickable(...))\`.
Half of them forgot the wait and fail randomly on the slower QA environment. Your lead: *"Put the plumbing in one
abstract BasePage and make every page extend it."*`,
  description: `Write an \`abstract class BasePage\` and make \`LoginPage\` extend it.

**Rules**
- \`protected final WebDriver driver\` and \`protected final WebDriverWait wait\` (10 seconds, \`Duration\`), both set in the constructor.
- Protected helpers: \`click(By)\` waits for clickable, \`type(By, String)\` waits for visible, clears and types,
  \`getText(By)\` waits for visible and returns text, \`isDisplayed(By)\` returns false instead of throwing.
- \`LoginPage extends BasePage\`, calls \`super(driver)\` and uses only the helpers (no raw \`driver.findElement\`).
- No \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public abstract class BasePage {
    // TODO: driver + wait fields, constructor, helpers
}

class LoginPage {
    private final WebDriver driver;
    private final By usernameInput = By.id("user-name");
    private final By passwordInput = By.id("password");
    private final By loginButton = By.id("login-button");

    LoginPage(WebDriver driver) { this.driver = driver; }

    public InventoryPage loginAs(String user, String pass) {
        driver.findElement(usernameInput).sendKeys(user);
        driver.findElement(passwordInput).sendKeys(pass);
        try { Thread.sleep(2000); } catch (InterruptedException e) { }
        driver.findElement(loginButton).click();
        return new InventoryPage(driver);
    }
}
`,
  solution: `package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    protected WebElement waitVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String text) {
        WebElement el = waitVisible(locator);
        el.clear();
        el.sendKeys(text);
    }

    protected String getText(By locator) {
        return waitVisible(locator).getText();
    }

    protected boolean isDisplayed(By locator) {
        try {
            return waitVisible(locator).isDisplayed();
        } catch (TimeoutException e) {
            return false;
        }
    }
}

class LoginPage extends BasePage {
    private final By usernameInput = By.id("user-name");
    private final By passwordInput = By.id("password");
    private final By loginButton = By.id("login-button");
    private final By errorBanner = By.id("login-error-message");

    LoginPage(WebDriver driver) {
        super(driver);
    }

    public InventoryPage loginAs(String user, String pass) {
        type(usernameInput, user);
        type(passwordInput, pass);
        click(loginButton);
        return new InventoryPage(driver);
    }

    public String getErrorMessage() {
        return getText(errorBanner);
    }
}
`,
  checks: [
    { label: 'BasePage is abstract', pattern: 'public\\s+abstract\\s+class\\s+BasePage', hint: 'Nobody should instantiate BasePage directly' },
    { label: 'Protected driver and WebDriverWait', pattern: 'protected\\s+(final\\s+)?WebDriverWait\\s+\\w+', hint: 'protected final WebDriverWait wait;' },
    { label: 'click() waits for clickable', pattern: 'void\\s+click\\s*\\(\\s*By[\\s\\S]*?elementToBeClickable', hint: 'wait.until(ExpectedConditions.elementToBeClickable(locator)).click();' },
    { label: 'type() clears and types after a wait', pattern: 'void\\s+type\\s*\\(\\s*By[\\s\\S]*?(visibilityOf|waitVisible|wait\\.until)[\\s\\S]*?clear\\s*\\(\\s*\\)[\\s\\S]*?sendKeys', flags: 'm', hint: 'wait visible, clear(), sendKeys()' },
    { label: 'LoginPage extends BasePage and calls super', pattern: 'class\\s+LoginPage\\s+extends\\s+BasePage[\\s\\S]*?super\\s*\\(\\s*driver\\s*\\)', hint: 'class LoginPage extends BasePage { LoginPage(WebDriver d) { super(d); } }' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'The explicit waits in BasePage replace sleeps' },
    { label: 'LoginPage uses helpers, not raw findElement', pattern: 'class\\s+LoginPage[\\s\\S]*driver\\.findElement\\s*\\(', mustNot: true, hint: 'Use type()/click()/getText() from BasePage' },
  ],
  hints: [
    'Create the WebDriverWait once in the BasePage constructor.',
    'isDisplayed: wrap the wait in try/catch(TimeoutException) and return false.',
    'In LoginPage replace driver.findElement(x).sendKeys(y) with type(x, y).',
  ],
  explanation: `BasePage is where **cross-cutting interaction rules** live: every click waits for clickability, every type
waits for visibility and clears first. Fix a synchronisation bug once and all pages benefit.

Design notes a reviewer will look for:
- \`abstract\` — BasePage is not a page.
- \`protected\` helpers — subclasses use them, tests do not (tests call business methods).
- \`isDisplayed\` returns \`false\` on timeout; great for negative checks, but remember it costs the full timeout when
  the element is absent. For "should NOT be visible" checks prefer \`invisibilityOfElementLocated\` or a short wait.
- Keep BasePage small. If it grows to 60 helpers (scrolls, JS clicks, uploads, iframes…) split into utility
  classes (\`WaitUtils\`, \`JsUtils\`) — "God BasePage" is a common anti-pattern.`,
  mistakes: [
    'Making helpers public so tests start calling click(By) directly and locators leak into tests.',
    'Creating a new WebDriverWait inside every helper call with a different timeout each time.',
    'Mixing implicit waits with explicit waits, which can multiply wait times unpredictably.',
    'Letting BasePage grow into a 1000-line dumping ground.',
  ],
  interview: [
    { q: 'What goes into a BasePage?', a: 'Shared state (driver, wait) and low-level interaction helpers with built-in synchronisation: click, type, getText, isDisplayed, maybe waitForPageLoad. Business actions stay in concrete pages.' },
    { q: 'Why not use implicit waits instead?', a: 'Implicit waits only cover element presence, apply globally, and mixing them with explicit waits causes unpredictable timeouts. Explicit waits can wait for specific conditions like clickable or text present.' },
    { q: 'Inheritance or composition for page helpers?', a: 'A thin BasePage via inheritance is common and fine. As helpers grow, composition (injecting a WaitUtils or ElementActions object) keeps classes focused and avoids deep hierarchies.' },
  ],
}
