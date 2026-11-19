export default {
  id: 'sel-003',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Automate the login regression: valid login and wrong password',
  level: 'BEGINNER',
  tags: ['webdriver', 'testng', 'assertions', 'sendKeys'],
  estMinutes: 20,
  scenario: `Sprint 3: the manual login regression (12 cases) takes you 40 minutes before every release. Your lead wants the two most important cases automated first: a valid user lands on the inventory page, and an invalid password shows the red error banner. The browser sometimes autofills the username from a previous run, so the test must clear fields before typing.`,
  description: `Write a TestNG class against \`http://localhost:5180/practice-site/login.html\` (user \`standard_user\` / \`secret_sauce\`).

**Test 1 – validLoginOpensInventory**
- clear + type username and password, click Login
- assert the URL contains \`inventory.html\`

**Test 2 – wrongPasswordShowsError**
- type \`standard_user\` / \`wrong_pass\`, click Login
- read the error banner text with \`getText()\` and assert it mentions the password/credentials
- read the password field's \`type\` attribute with \`getAttribute\` / \`getDomAttribute\` and assert it is \`password\` (the field must stay masked)

**Rules**
- \`@BeforeMethod\` creates the driver and opens the page; \`@AfterMethod\` quits it.
- Use TestNG \`Assert\` with a helpful message — not \`System.out.println\`.
- Locators are \`By\` constants matching the page: \`#user-name\`, \`#password\`, \`#login-button\` and the error text \`#login-error-message\`.`,
  hints: [
    'Call element.clear() before sendKeys() so autofilled text does not get appended.',
    'getText() returns visible text; getAttribute("type") / getDomAttribute("type") returns the attribute value.',
    'Assert.assertTrue(driver.getCurrentUrl().contains("inventory.html"), "message")',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class LoginTest {

    private static final String URL = "http://localhost:5180/practice-site/login.html";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    private WebDriver driver;

    @BeforeMethod
    public void setUp() {
        // TODO: create driver and open URL
    }

    @Test
    public void validLoginOpensInventory() {
        // TODO
    }

    @Test
    public void wrongPasswordShowsError() {
        // TODO
    }

    @AfterMethod
    public void tearDown() {
        // TODO
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;

public class LoginTest {

    private static final String URL = "http://localhost:5180/practice-site/login.html";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get(URL);
    }

    private void login(String user, String pass) {
        WebElement username = driver.findElement(USERNAME);
        username.clear();
        username.sendKeys(user);
        WebElement password = driver.findElement(PASSWORD);
        password.clear();
        password.sendKeys(pass);
        driver.findElement(LOGIN_BUTTON).click();
    }

    @Test
    public void validLoginOpensInventory() {
        login("standard_user", "secret_sauce");
        wait.until(ExpectedConditions.urlContains("inventory.html"));
        Assert.assertTrue(driver.getCurrentUrl().contains("inventory.html"),
                "Expected to land on inventory page but was " + driver.getCurrentUrl());
    }

    @Test
    public void wrongPasswordShowsError() {
        login("standard_user", "wrong_pass");

        String error = wait.until(ExpectedConditions.visibilityOfElementLocated(ERROR)).getText();
        Assert.assertTrue(error.toLowerCase().matches(".*(password|credentials).*"),
                "Unexpected error text: " + error);

        String type = driver.findElement(PASSWORD).getDomAttribute("type");
        Assert.assertEquals(type, "password", "Password field must stay masked");
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}
`,
  checks: [
    { label: 'Clears the field before typing', pattern: '\\.clear\\s*\\(\\s*\\)', hint: 'element.clear() then element.sendKeys(...)' },
    { label: 'Types with sendKeys', pattern: '\\.sendKeys\\s*\\(', hint: 'Use sendKeys to type' },
    { label: 'Reads visible text with getText()', pattern: '\\.getText\\s*\\(\\s*\\)', hint: 'Read the error banner text' },
    { label: 'Reads an attribute', pattern: '\\.(getAttribute|getDomAttribute|getDomProperty)\\s*\\(\\s*"type"', hint: 'getDomAttribute("type") on the password field' },
    { label: 'Uses TestNG assertions', pattern: 'Assert\\.assert(True|Equals)\\s*\\(', hint: 'Assert.assertEquals(actual, expected, message)' },
    { label: 'Quits the driver in @AfterMethod', pattern: '@AfterMethod[\\s\\S]*?\\.quit\\s*\\(', hint: 'driver.quit() in tearDown' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the URL or banner with WebDriverWait' },
  ],
  explanation: `The test follows the **Arrange / Act / Assert** shape every reviewer expects: setup opens a clean browser, a small \`login()\` helper does the typing, and each test asserts one outcome.

- \`clear()\` before \`sendKeys()\` — \`sendKeys\` *appends*; autofill or a previous value would give \`standard_userstandard_user\`.
- \`getText()\` returns **rendered, visible** text (trimmed, CSS-hidden text excluded). For an \`<input>\`, \`getText()\` is empty — read its value with \`getDomProperty("value")\`.
- \`getDomAttribute("type")\` (Selenium 4) reads the HTML attribute exactly as written; \`getAttribute\` is the older "best guess" method that checks the property first and then the attribute. Both work here.
- The waits on \`urlContains\` and the error banner make the assertions robust if the login is processed asynchronously.
- \`@AfterMethod(alwaysRun = true)\` guarantees cleanup even if setup partially failed.

Assertion messages matter: on Jenkins, \`expected [true] but found [false]\` is useless; \`Unexpected error text: Error: Username and password do not match...\` tells you the bug instantly.`,
  mistakes: [
    'Using getText() on an input to read what was typed — it returns "" (use getDomProperty("value")).',
    'Asserting the full error string exactly, so a punctuation change by the dev breaks the test.',
    'Opening one browser for the whole class so test 2 starts already logged in.',
    'Printing results with System.out instead of asserting — the test always passes.',
  ],
  interview: [
    { q: 'getText() vs getAttribute("value")?', a: 'getText() returns the visible inner text of an element; for input fields it is empty. The typed value of an input lives in the value property, read with getDomProperty("value") or getAttribute("value").' },
    { q: 'Difference between getAttribute and getDomAttribute in Selenium 4?', a: 'getDomAttribute returns the attribute as declared in HTML; getDomProperty returns the live JavaScript property; getAttribute is the legacy method that returns the property if present, else the attribute. Selenium 4 recommends the explicit ones.' },
    { q: 'Why one browser per test?', a: 'Isolation: no shared cookies, session or state leaking between tests, so tests can run in any order and in parallel. The cost is a few seconds of startup per test.' },
  ],
}
