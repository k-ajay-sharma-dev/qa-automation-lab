export default {
  id: 'int-019',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: a complete Selenium test in 15 minutes — login, two items, badge and total',
  level: 'ADVANCED',
  tags: ['selenium', 'live-coding', 'testng', 'end-to-end', 'waits', 'checkout'],
  estMinutes: 25,
  scenario: `Final round at a fintech-retail client. The interviewer shares the ShopEasy practice site and an empty IntelliJ class: *"You have 15 minutes. Log in as standard_user, add the Trailblazer Backpack and the Pulse Bike Light, check the cart badge says 2, go through checkout and verify the total. Talk me through it."* Nobody expects a perfect framework — they watch whether you write a **runnable, independent test with real waits and real assertions**, and whether you know the math: $29.99 + $9.99 = **$39.98**, plus 8% tax **$3.20** = **$43.18**.`,
  description: `Complete \`CheckoutTotalTest\` (TestNG, Selenium 4, Chrome). Base URL: \`http://localhost:5180/practice-site/\`.

1. **Setup** (\`@BeforeMethod\`): new \`ChromeDriver\`, a \`WebDriverWait\` (10 s), open \`login.html\`.
2. **Login**: \`#user-name\` = \`standard_user\`, \`#password\` = \`secret_sauce\`, click \`#login-button\`; wait for \`#inventory-list\`.
3. **Add two items**: \`#add-to-cart-trailblazer-backpack\` and \`#add-to-cart-pulse-bike-light\`.
4. **Badge**: \`.shopping-cart-badge\` inside \`#shopping-cart-link\` shows \`"2"\`.
5. **Checkout**: click \`#shopping-cart-link\`, then \`#checkout\`; fill \`#first-name\`, \`#last-name\`, \`#postal-code\` (e.g. Asha / Rao / 560001); click \`#continue\`.
6. **Totals**: \`#summary-subtotal\` is \`$39.98\` and \`#summary-total\` is \`$43.18\`.
7. **Teardown** (\`@AfterMethod\`): quit the browser, even when the test failed.

**Rules / Acceptance** (graded leniently — any sensible locator style is fine)
- Explicit waits (\`WebDriverWait\`), no \`Thread.sleep\`.
- Assertions with a message, so a failure explains itself.
- Locators as \`By\` constants at the top (a mini page-object habit you can mention).`,
  hints: [
    'Write the skeleton first — @BeforeMethod, @Test, @AfterMethod — so you always have something runnable.',
    'wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("inventory-list"))) after login; elementToBeClickable before each click.',
    'Assert.assertEquals(driver.findElement(TOTAL).getText(), "$43.18", "Order total for backpack + bike light incl. 8% tax");',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.Test;

public class CheckoutTotalTest {

    private WebDriver driver;

    @Test
    public void cartBadgeAndTotalForTwoProducts() throws InterruptedException {
        driver = new ChromeDriver();
        driver.get("http://localhost:5180/practice-site/login.html");
        // TODO: login, add two products, verify badge, checkout, verify total
        Thread.sleep(3000);
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class CheckoutTotalTest {

    private static final String BASE_URL = "http://localhost:5180/practice-site/";

    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-button");
    private static final By INVENTORY_LIST = By.id("inventory-list");
    private static final By ADD_BACKPACK = By.id("add-to-cart-trailblazer-backpack");
    private static final By ADD_BIKE_LIGHT = By.id("add-to-cart-pulse-bike-light");
    private static final By CART_LINK = By.id("shopping-cart-link");
    private static final By CART_BADGE = By.cssSelector("#shopping-cart-link .shopping-cart-badge");
    private static final By CHECKOUT_BUTTON = By.id("checkout");
    private static final By FIRST_NAME = By.id("first-name");
    private static final By LAST_NAME = By.id("last-name");
    private static final By POSTAL_CODE = By.id("postal-code");
    private static final By CONTINUE_BUTTON = By.id("continue");
    private static final By SUBTOTAL = By.id("summary-subtotal");
    private static final By TOTAL = By.id("summary-total");

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get(BASE_URL + "login.html");
    }

    @Test
    public void cartBadgeAndTotalForTwoProducts() {
        // 1. login
        wait.until(ExpectedConditions.visibilityOfElementLocated(USERNAME)).sendKeys("standard_user");
        driver.findElement(PASSWORD).sendKeys("secret_sauce");
        driver.findElement(LOGIN_BUTTON).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(INVENTORY_LIST));

        // 2. add two products
        wait.until(ExpectedConditions.elementToBeClickable(ADD_BACKPACK)).click();
        wait.until(ExpectedConditions.elementToBeClickable(ADD_BIKE_LIGHT)).click();

        // 3. badge
        String badge = wait.until(ExpectedConditions.visibilityOfElementLocated(CART_BADGE)).getText();
        Assert.assertEquals(badge, "2", "Cart badge after adding two products");

        // 4. checkout step one
        driver.findElement(CART_LINK).click();
        wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT_BUTTON)).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(FIRST_NAME)).sendKeys("Asha");
        driver.findElement(LAST_NAME).sendKeys("Rao");
        driver.findElement(POSTAL_CODE).sendKeys("560001");
        driver.findElement(CONTINUE_BUTTON).click();

        // 5. overview totals: 29.99 + 9.99 = 39.98, tax 8% = 3.20, total 43.18
        String subtotal = wait.until(ExpectedConditions.visibilityOfElementLocated(SUBTOTAL)).getText();
        String total = driver.findElement(TOTAL).getText();
        Assert.assertEquals(subtotal, "$39.98", "Item total for backpack + bike light");
        Assert.assertEquals(total, "$43.18", "Order total including 8% tax");
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
    { label: 'Logs in as standard_user with secret_sauce', pattern: 'standard_user[\\s\\S]*secret_sauce|secret_sauce[\\s\\S]*standard_user', flags: 'ms', hint: 'sendKeys("standard_user") into #user-name and "secret_sauce" into #password' },
    { label: 'Adds both the backpack and the bike light', pattern: '(?=[\\s\\S]*(trailblazer-backpack|Trailblazer Backpack))(?=[\\s\\S]*(pulse-bike-light|Pulse Bike Light))', flags: 's', hint: 'By.id("add-to-cart-trailblazer-backpack") and By.id("add-to-cart-pulse-bike-light")' },
    { label: 'Uses an explicit wait', pattern: 'WebDriverWait', hint: 'wait = new WebDriverWait(driver, Duration.ofSeconds(10));' },
    { label: 'Asserts the cart badge shows 2', pattern: 'shopping-cart-badge[\\s\\S]*"2"', flags: 'ms', hint: 'Assert.assertEquals(badgeText, "2", "...")' },
    { label: 'Asserts the order total $43.18', pattern: '43\\.18', hint: '29.99 + 9.99 = 39.98; 8% tax = 3.20; total = 43.18' },
    { label: 'Quits the browser in an @After method', pattern: '@After\\w*[\\s\\S]*\\.quit\\s*\\(\\s*\\)', flags: 'ms', hint: '@AfterMethod(alwaysRun = true) public void tearDown() { driver.quit(); }' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the element or state you need instead' },
  ],
  explanation: `**How to spend the 15 minutes**
| Minute | What you do and say |
|---|---|
| 0–2 | Repeat the task, confirm the data ("two items, badge 2, total $43.18 — 39.98 plus 8% tax rounded to 3.20"). Ask: "Chrome is fine? Can I keep locators in the class for now?" |
| 2–4 | Skeleton: \`@BeforeMethod\` / \`@Test\` / \`@AfterMethod(alwaysRun = true)\`. Now you always have something that runs. |
| 4–11 | Steps in order, a \`By\` constant per element, an explicit wait wherever the page changes (after login, before clicks, on the overview). |
| 11–13 | Assertions with messages. Run it (or trace it) once. |
| 13–15 | Say what you'd improve: page objects (LoginPage, InventoryPage, CartPage, CheckoutPage), config for the base URL, a DriverFactory, test data from a file, setting the cart via API to make it faster. |

**What reviewers look for**
- **Independence** — the test opens its own browser and logs in itself; it doesn't rely on a previous test's state.
- **Waits at state changes** — page navigation after login, the overview section that becomes visible after \`#continue\`. No \`Thread.sleep\`.
- **Meaningful assertions** — exact expected values with a message; checking the badge *and* the money.
- **Cleanup** — \`alwaysRun = true\` makes TestNG quit the browser even when an assertion fails, so CI agents don't fill up with zombie Chrome processes.

**Stronger money check** (mention as an improvement): parse with \`new BigDecimal(text.replace("$", ""))\` and assert \`total == subtotal + tax\` and \`tax == subtotal × 0.08\` (scale 2, HALF_UP), so the test validates the *rule*, not just one hard-coded number.`,
  mistakes: [
    'Spending ten minutes on a perfect framework and never reaching the assertions — skeleton first, polish last.',
    'Asserting only that the overview is displayed, not the actual badge count and total values.',
    'Quitting the driver at the end of the @Test method — it never runs when an assertion fails.',
    'Reading the badge without scoping or waiting, or using Thread.sleep after each click.',
  ],
  interview: [
    { q: 'How would you refactor this test into your framework?', a: 'Move each page into a page object — LoginPage.loginAs returns InventoryPage, InventoryPage.addToCart(productName), header component for the badge, CartPage and CheckoutPage with getTotal — create the driver in a DriverFactory from config, read the base URL and user from properties, and keep only the business flow and assertions in the test.' },
    { q: 'The badge assertion fails intermittently on CI. What do you check?', a: 'First the evidence: the screenshot and the actual value. Then timing — the badge appears after a JavaScript click handler, so I wait for the text to be "2" with ExpectedConditions.textToBe instead of reading it immediately. Also check that the session is fresh — a leftover cart from a reused browser profile would give 3.' },
    { q: 'How could you make this test faster without losing coverage?', a: 'Keep one end-to-end UI test for the full journey, but for other checkout tests set up the state directly — for example log in and fill the cart through an API or by seeding session storage — and test the total calculation rules at API level, where POST /api/orders returns subtotal, tax and total in milliseconds.' },
  ],
}
