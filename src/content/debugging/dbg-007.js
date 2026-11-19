export default {
  id: 'dbg-007',
  category: 'debugging',
  kind: 'code',
  title: 'Passes alone, fails in the suite: tests that depend on each other',
  level: 'ADVANCED',
  tags: ['flaky', 'test-independence', 'test-data', 'TestNG', 'order-dependency'],
  estMinutes: 25,
  scenario: `\`CartTest.cartBadgeShowsOneAfterAddingBackpack\` is the most "flaky" test in the ShopEasy suite: green when you run it alone from IntelliJ, red in roughly half of the nightly runs. Someone tried to stabilise it with \`priority\` attributes. The release manager now asks: *"Is this a product bug or a test bug?"* — you need an answer and a fix.`,
  description: `Jenkins console (nightly run):

\`\`\`text
[INFO] Running TestSuite
[ERROR] Tests run: 4, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 21.48 s <<< FAILURE! - in TestSuite
[ERROR] cartBadgeShowsOneAfterAddingBackpack(com.shopeasy.tests.CartTest)  Time elapsed: 1.912 s  <<< FAILURE!
java.lang.AssertionError: Cart badge after adding one item expected [1] but found [2]
	at org.testng.Assert.fail(Assert.java:110)
	at org.testng.Assert.failNotEquals(Assert.java:1577)
	at org.testng.Assert.assertEquals(Assert.java:1155)
	at com.shopeasy.tests.CartTest.cartBadgeShowsOneAfterAddingBackpack(CartTest.java:41)
\`\`\`

**Clues:**
- All 4 tests share **one browser** opened in \`@BeforeClass\` and the same user \`standard_user\`.
- ShopEasy stores the cart in the browser's \`sessionStorage\`, so it survives page navigation.
- When \`addBikeLight\` happens to run first, the cart already has 1 item → badge shows 2.

**Fix the class so every test is independent:**
- Fresh browser per test: \`@BeforeMethod\` creates + logs in, \`@AfterMethod\` quits.
- Start from a known state: clear the cart state (\`sessionStorage.clear()\`) before the test.
- Remove the \`priority\` / \`dependsOnMethods\` ordering hacks — order must not matter.`,
  hints: [
    'If a test passes alone and fails in a suite, suspect shared state: same browser, same user, same data.',
    'Every test should arrange its own preconditions — "Given an empty cart".',
    '@BeforeMethod → new driver, open site, clear sessionStorage, log in; @AfterMethod → driver.quit().',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import com.shopeasy.driver.DriverFactory;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

public class CartTest {

    private static WebDriver driver;
    private static InventoryPage inventory;

    @BeforeClass
    public void setUp() {
        driver = DriverFactory.createDriver();
        driver.get("http://localhost:5180/practice-site/login.html");
        new LoginPage(driver).loginAs("standard_user", "secret_sauce");
        inventory = new InventoryPage(driver);
    }

    @Test(priority = 1)
    public void addBikeLight() {
        inventory.addToCart("Pulse Bike Light");
        Assert.assertEquals(inventory.getCartCount(), 1);
    }

    @Test(priority = 2)
    public void cartBadgeShowsOneAfterAddingBackpack() {
        inventory.addToCart("Trailblazer Backpack");
        Assert.assertEquals(inventory.getCartCount(), 1, "Cart badge after adding one item");
    }

    @AfterClass
    public void tearDown() {
        driver.quit();
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import com.shopeasy.driver.DriverFactory;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class CartTest {

    private static final String BASE_URL = "http://localhost:5180/practice-site/";

    private WebDriver driver;
    private InventoryPage inventory;

    @BeforeMethod
    public void setUp() {
        driver = DriverFactory.createDriver();
        driver.get(BASE_URL + "login.html");
        // known starting state: no cart left over from any other test
        ((JavascriptExecutor) driver).executeScript("window.sessionStorage.clear();");
        driver.manage().deleteAllCookies();
        driver.navigate().refresh();

        new LoginPage(driver).loginAs("standard_user", "secret_sauce");
        inventory = new InventoryPage(driver);
    }

    @Test
    public void addBikeLight() {
        inventory.addToCart("Pulse Bike Light");
        Assert.assertEquals(inventory.getCartCount(), 1, "Cart badge after adding the bike light");
    }

    @Test
    public void cartBadgeShowsOneAfterAddingBackpack() {
        inventory.addToCart("Trailblazer Backpack");
        Assert.assertEquals(inventory.getCartCount(), 1, "Cart badge after adding one item");
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
    { label: 'Fresh setup before every test (@BeforeMethod)', pattern: '@BeforeMethod', hint: 'Use @BeforeMethod instead of @BeforeClass' },
    { label: 'Teardown after every test (@AfterMethod + quit)', pattern: '@AfterMethod[\\s\\S]*quit\\s*\\(', flags: 'ms', hint: '@AfterMethod(alwaysRun = true) → driver.quit()' },
    { label: 'Resets the cart / browser state', pattern: '(sessionStorage\\.clear|deleteAllCookies|resetCart|clearCart)', hint: 'executeScript("window.sessionStorage.clear();") or an API/DB reset' },
    { label: 'No ordering hacks (priority / dependsOnMethods)', pattern: '(priority\\s*=|dependsOnMethods)', mustNot: true, hint: 'If the order matters, the tests are not independent' },
    { label: 'No static driver shared across tests', pattern: 'static\\s+WebDriver\\s+\\w+', mustNot: true, hint: 'A static driver is shared by every test (and every thread)' },
  ],
  explanation: `**Verdict for the release manager: test bug, not product bug.** The product correctly remembered the bike light from the earlier test. The test assumed an empty cart without arranging it.

**How to prove order dependency:**
1. Run the failing test alone → passes.
2. Run the class with a different order (or TestNG \`preserve-order="false"\`) → fails when the "polluting" test runs first.
3. Look for shared state: \`static\` fields, \`@BeforeClass\` browser, same login, same DB records, \`sessionStorage\`/cookies.

**The principle (F.I.R.S.T. — *Independent*):** each test creates its own preconditions and cleans up after itself, so it can run alone, in any order and in parallel. Ordering with \`priority\` or \`dependsOnMethods\` just hides the coupling — and breaks completely the day you enable parallel runs.

**Real-project alternatives for resetting state** (fastest first): call a test-data API (\`DELETE /api/cart\`), reset the DB record, clear browser storage, or use a unique user per test. A fresh browser per test costs a few seconds but buys reliability; teams then claw back time with parallel execution.`,
  mistakes: [
    'Adding priority or dependsOnMethods to force an order instead of removing the dependency.',
    'Rerunning the job until it is green and calling it "flaky".',
    'Using one static driver for the whole class, which also breaks parallel runs.',
    'Changing the assertion to >= 1, which would hide a real duplicate-item bug.',
  ],
  interview: [
    { q: 'A test passes alone but fails when the whole suite runs. What do you suspect?', a: 'Shared state and order dependency — a previous test left data behind, like an item in the cart, a logged-in session, or a modified record. I confirm by changing the execution order, then make the test independent: fresh driver in @BeforeMethod, reset data through an API or by clearing storage, and unique test data where possible.' },
    { q: 'Do you use dependsOnMethods in your framework?', a: 'Very rarely. It makes tests coupled — if the first fails, the rest are skipped, and they cannot run in parallel. We prefer each test to set up its own preconditions, often through APIs, so it is fast and independent.' },
  ],
}
