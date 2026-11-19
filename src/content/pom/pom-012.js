export default {
  id: 'pom-012',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'BaseTest: browser setup and teardown with TestNG',
  level: 'INTERMEDIATE',
  tags: ['basetest', 'testng', 'setup', 'teardown'],
  estMinutes: 20,
  scenario: `Every ShopEasy test class starts with the same 15 lines: create ChromeDriver, maximise, open the URL, and an
\`@AfterClass\` that sometimes is missing — so the CI agent ends the night with 37 orphan Chrome processes and runs
out of memory. You will centralise the lifecycle in one \`BaseTest\` that uses the \`DriverManager\` from pom-011.`,
  description: `Write \`BaseTest\` and convert \`LoginTest\` to use it.

**Rules**
- \`@BeforeMethod\` with \`@Parameters("browser")\` + \`@Optional("chrome")\` calls \`DriverManager.initDriver(browser)\`.
- \`@AfterMethod(alwaysRun = true)\` calls \`DriverManager.quitDriver()\` so the browser closes even after a failure.
- A \`protected WebDriver driver()\` accessor (or \`getDriver()\`) for subclasses.
- A convenience \`protected InventoryPage loginAsStandardUser()\`.
- \`LoginTest extends BaseTest\` and contains no driver creation code.`,
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.Assert;
import org.testng.annotations.*;

public class LoginTest {
    WebDriver driver;

    @BeforeClass
    public void setUp() {
        driver = new ChromeDriver();
        driver.manage().window().maximize();
    }

    @Test
    public void validLogin() {
        InventoryPage inventory = new LoginPage(driver).open().loginAs("standard_user", "secret_sauce");
        Assert.assertTrue(inventory.isLoaded());
    }
}

// TODO: abstract class BaseTest
`,
  solution: `package com.shopeasy.tests;

import com.shopeasy.core.DriverManager;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

public abstract class BaseTest {

    @BeforeMethod(alwaysRun = true)
    @Parameters("browser")
    public void setUp(@Optional("chrome") String browser) {
        DriverManager.initDriver(browser);
        driver().manage().window().maximize();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        DriverManager.quitDriver();
    }

    protected WebDriver driver() {
        return DriverManager.getDriver();
    }

    protected InventoryPage loginAsStandardUser() {
        return new LoginPage(driver()).open().loginAs("standard_user", "secret_sauce");
    }
}

class LoginTest extends BaseTest {

    @Test(groups = {"smoke"})
    public void validLoginShowsInventory() {
        InventoryPage inventory = loginAsStandardUser();
        Assert.assertTrue(inventory.isLoaded(), "Inventory page should load after valid login");
    }

    @Test
    public void lockedOutUserSeesError() {
        String error = new LoginPage(driver()).open()
                .loginExpectingError("locked_out_user", "secret_sauce")
                .getErrorMessage();
        Assert.assertTrue(error.contains("locked out"), "Unexpected error: " + error);
    }
}
`,
  checks: [
    { label: 'BaseTest class exists', pattern: 'class\\s+BaseTest', hint: 'public abstract class BaseTest' },
    { label: '@BeforeMethod initialises the driver', pattern: '@BeforeMethod[\\s\\S]*?DriverManager\\.initDriver\\s*\\(', hint: 'DriverManager.initDriver(browser) in @BeforeMethod' },
    { label: 'Browser comes from a TestNG parameter', pattern: '@Parameters\\s*\\(\\s*(\\{\\s*)?"browser"', hint: '@Parameters("browser") with @Optional("chrome")' },
    { label: '@AfterMethod(alwaysRun = true) quits', pattern: '@AfterMethod\\s*\\(\\s*alwaysRun\\s*=\\s*true\\s*\\)[\\s\\S]*?quitDriver', hint: 'alwaysRun makes teardown run even after failures/skips' },
    { label: 'LoginTest extends BaseTest', pattern: 'class\\s+LoginTest\\s+extends\\s+BaseTest', hint: 'class LoginTest extends BaseTest' },
    { label: 'No driver creation in test classes', pattern: 'new\\s+ChromeDriver\\s*\\(', mustNot: true, hint: 'Only DriverManager creates browsers' },
  ],
  hints: [
    'Use @BeforeMethod / @AfterMethod so every test gets a fresh browser (needed for parallel="methods").',
    '@Optional("chrome") gives a default when testng.xml does not pass "browser".',
    'alwaysRun = true on @AfterMethod is what kills the orphan browsers.',
  ],
  explanation: `\`BaseTest\` owns the **browser lifecycle**; test classes own only test logic.

- **\`@BeforeMethod\` / \`@AfterMethod\`** → one fresh browser per test: isolated, parallel-safe, no state leaking
  between tests (cookies, cart contents). \`@BeforeClass\` is faster but tests share a session.
- **\`alwaysRun = true\`** → teardown runs even when the test failed or a config method failed. Without it you get
  orphan browsers on CI — the exact incident in the scenario.
- **\`@Parameters("browser")\` + \`@Optional\`** → testng.xml can run the same class on chrome and firefox (fw-005).
- Helpers like \`loginAsStandardUser()\` remove setup noise. Keep them few and obvious.

A screenshot-on-failure hook could go in \`@AfterMethod(ITestResult result)\`, but a TestNG listener (fw-008) is cleaner.`,
  mistakes: [
    'Using @BeforeClass with parallel="methods": threads share one driver.',
    'Missing alwaysRun = true, leaving browsers open after failures.',
    'Putting test data and assertions in BaseTest.',
    'Deep inheritance chains (BaseTest > WebBaseTest > ShopBaseTest > CheckoutBaseTest).',
  ],
  interview: [
    { q: 'Why @BeforeMethod instead of @BeforeClass for the driver?', a: 'A browser per test method isolates state and is required for method-level parallelism. @BeforeClass is faster but shares cookies and session between tests in the class and cannot be used safely with parallel methods.' },
    { q: 'What does alwaysRun = true do on @AfterMethod?', a: 'It makes TestNG run the method even if the test failed or a dependency/config method failed or was skipped, guaranteeing cleanup such as quitting the browser.' },
  ],
}
