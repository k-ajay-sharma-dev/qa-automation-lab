export default {
  id: 'pom-013',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'EXPERT refactor: turn a 60-line spaghetti test into page objects',
  level: 'EXPERT',
  tags: ['pom', 'refactoring', 'e2e', 'clean-code'],
  estMinutes: 45,
  scenario: `Release 3.2 is in two days. The most important end-to-end test — *login → add two products → checkout →
verify total → finish order* — is a single 60-line method full of locators, \`Thread.sleep\`, and copy-pasted
\`findElement\` calls. It fails twice a week and nobody dares touch it. Your lead assigns it to you: *"Make it
something a new joiner could read in 30 seconds."*`,
  description: `Refactor \`PlaceOrderTest\` using everything from this track.

**Acceptance**
- Page objects: \`LoginPage\`, \`InventoryPage\`, \`CartPage\`, \`CheckoutPage\`, \`CheckoutOverviewPage\`, \`OrderCompletePage\`
  (you may keep them in one file here), each extending \`BasePage\` with private \`By\` locators.
- Navigation methods return the next page object.
- \`PlaceOrderTest extends BaseTest\`; the test method contains **no** \`findElement\`, no \`By\`, no \`Thread.sleep\`.
- Assertions (item count, total, confirmation header) live only in the test.
- Keep behaviour identical: same user, same products, same expected total \`$43.18\`.`,
  starterCode: `package com.shopeasy.tests;

import java.time.Duration;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.Assert;
import org.testng.annotations.Test;

public class PlaceOrderTest {

    @Test
    public void placeOrder() throws InterruptedException {
        WebDriver driver = new ChromeDriver();
        driver.manage().window().maximize();
        driver.get("http://localhost:5180/practice-site/login.html");
        driver.findElement(By.id("user-name")).sendKeys("standard_user");
        driver.findElement(By.id("password")).sendKeys("secret_sauce");
        driver.findElement(By.id("login-button")).click();
        Thread.sleep(3000);
        Assert.assertTrue(driver.getCurrentUrl().contains("inventory"));
        List<WebElement> items = driver.findElements(By.cssSelector(".inventory-item"));
        for (WebElement item : items) {
            String name = item.findElement(By.cssSelector(".item-name")).getText();
            if (name.equals("Trailblazer Backpack")) {
                item.findElement(By.tagName("button")).click();
            }
        }
        for (WebElement item : items) {
            String name = item.findElement(By.cssSelector(".item-name")).getText();
            if (name.equals("Pulse Bike Light")) {
                item.findElement(By.tagName("button")).click();
            }
        }
        Thread.sleep(1000);
        Assert.assertEquals(driver.findElement(By.cssSelector(".shopping-cart-badge")).getText(), "2");
        driver.findElement(By.id("shopping-cart-link")).click();
        Thread.sleep(2000);
        List<WebElement> cartItems = driver.findElements(By.cssSelector(".cart-item"));
        Assert.assertEquals(cartItems.size(), 2);
        driver.findElement(By.id("checkout")).click();
        Thread.sleep(2000);
        driver.findElement(By.id("first-name")).sendKeys("Asha");
        driver.findElement(By.id("last-name")).sendKeys("Rao");
        driver.findElement(By.id("postal-code")).sendKeys("560001");
        driver.findElement(By.id("continue")).click();
        Thread.sleep(2000);
        String total = driver.findElement(By.cssSelector(".summary-total")).getText();
        Assert.assertTrue(total.contains("43.18"));
        driver.findElement(By.id("finish")).click();
        Thread.sleep(2000);
        String header = driver.findElement(By.cssSelector(".complete-header")).getText();
        Assert.assertEquals(header, "Thank you for your order!");
        driver.quit();
    }
}
`,
  solution: `package com.shopeasy.tests;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.testng.Assert;
import org.testng.annotations.Test;

public class PlaceOrderTest extends BaseTest {

    @Test(groups = {"smoke", "regression"}, description = "TC-E2E-001 place an order with two products")
    public void standardUserCanPlaceOrderWithTwoProducts() {
        InventoryPage inventory = new LoginPage(driver()).open()
                .loginAs("standard_user", "secret_sauce");
        Assert.assertTrue(inventory.isLoaded(), "Inventory should load after login");

        inventory.addToCart("Trailblazer Backpack")
                 .addToCart("Pulse Bike Light");
        Assert.assertEquals(inventory.header().getCartCount(), 2, "Cart badge count");

        CartPage cart = inventory.header().openCart();
        Assert.assertEquals(cart.getItemCount(), 2, "Items in cart");

        CheckoutOverviewPage overview = cart.checkout()
                .fillShippingInfo("Asha", "Rao", "560001")
                .continueToOverview();
        Assert.assertEquals(overview.getTotal(), "$43.18", "Order total incl. tax");

        OrderCompletePage complete = overview.finish();
        Assert.assertEquals(complete.getHeader(), "Thank you for your order!");
    }
}

class LoginPage extends BasePage {
    private final By username = By.id("user-name");
    private final By password = By.id("password");
    private final By loginButton = By.id("login-button");
    LoginPage(WebDriver driver) { super(driver); }
    LoginPage open() { driver.get(Config.baseUrl() + "/login.html"); return this; }
    InventoryPage loginAs(String user, String pass) {
        type(username, user);
        type(password, pass);
        click(loginButton);
        return new InventoryPage(driver);
    }
}

class InventoryPage extends BasePage {
    private static final String ADD_BUTTON =
        "//div[contains(@class,'inventory-item')][.//*[normalize-space()='%s']]//button";
    private final By list = By.cssSelector(".inventory-item");
    private final HeaderComponent header;
    InventoryPage(WebDriver driver) { super(driver); header = new HeaderComponent(driver); }
    boolean isLoaded() { return isDisplayed(list); }
    HeaderComponent header() { return header; }
    InventoryPage addToCart(String product) {
        click(By.xpath(String.format(ADD_BUTTON, product)));
        return this;
    }
}

class CartPage extends BasePage {
    private final By items = By.cssSelector(".cart-item");
    private final By checkoutButton = By.id("checkout");
    CartPage(WebDriver driver) { super(driver); }
    int getItemCount() { return driver.findElements(items).size(); }
    CheckoutPage checkout() { click(checkoutButton); return new CheckoutPage(driver); }
}

class CheckoutPage extends BasePage {
    private final By firstName = By.id("first-name");
    private final By lastName = By.id("last-name");
    private final By postalCode = By.id("postal-code");
    private final By continueButton = By.id("continue");
    CheckoutPage(WebDriver driver) { super(driver); }
    CheckoutPage fillShippingInfo(String first, String last, String zip) {
        type(firstName, first);
        type(lastName, last);
        type(postalCode, zip);
        return this;
    }
    CheckoutOverviewPage continueToOverview() { click(continueButton); return new CheckoutOverviewPage(driver); }
}

class CheckoutOverviewPage extends BasePage {
    private final By total = By.id("summary-total");
    private final By finishButton = By.id("finish");
    CheckoutOverviewPage(WebDriver driver) { super(driver); }
    String getTotal() { return getText(total).trim(); }
    OrderCompletePage finish() { click(finishButton); return new OrderCompletePage(driver); }
}

class OrderCompletePage extends BasePage {
    private final By header = By.cssSelector(".complete-header");
    OrderCompletePage(WebDriver driver) { super(driver); }
    String getHeader() { return getText(header); }
}
`,
  checks: [
    { label: 'Test extends BaseTest', pattern: 'class\\s+PlaceOrderTest\\s+extends\\s+BaseTest', hint: 'BaseTest owns driver creation and quitting' },
    { label: 'No findElement / By in the test class', pattern: 'class\\s+PlaceOrderTest(?:(?!\\bclass\\s)[\\s\\S])*(findElements?\\s*\\(|By\\.)', mustNot: true, hint: 'Move every locator and findElement into a page object' },
    { label: 'No Thread.sleep anywhere', pattern: 'Thread\\.sleep', mustNot: true, hint: 'BasePage explicit waits replace sleeps' },
    { label: 'Page objects extend BasePage', pattern: 'class\\s+(CheckoutPage|CartPage)\\s+extends\\s+BasePage', hint: 'class CartPage extends BasePage' },
    { label: 'Navigation returns the next page', pattern: 'CheckoutOverviewPage\\s+continueToOverview\\s*\\([\\s\\S]*?return\\s+new\\s+CheckoutOverviewPage', hint: 'continueToOverview() returns new CheckoutOverviewPage(driver)' },
    { label: 'No assertions inside page classes', pattern: 'class\\s+\\w+Page\\s+extends\\s+BasePage(?:(?!\\bclass\\s)[\\s\\S])*Assert\\.', mustNot: true, hint: 'Pages return values; the test asserts' },
    { label: 'Test checks the total and confirmation', pattern: 'assertEquals\\s*\\([^;]*getTotal\\s*\\(\\s*\\)[\\s\\S]*?assertEquals\\s*\\([^;]*getHeader', hint: 'Assert overview.getTotal() and complete.getHeader()' },
  ],
  hints: [
    'First list the pages the test visits; each becomes a class. Then each block of findElement lines becomes a method.',
    'The two loops that click products become one addToCart(String) with a dynamic locator (pom-010).',
    'Every Thread.sleep disappears because type()/click()/getText() in BasePage wait for the element.',
  ],
  explanation: `How a senior approaches this refactor:

1. **Map the journey**: Login → Inventory → Cart → Checkout → Overview → Complete. One page object each,
   plus the \`HeaderComponent\` for the cart badge/link.
2. **Turn each block into a method** named after intent: \`loginAs\`, \`addToCart\`, \`checkout\`, \`fillShippingInfo\`,
   \`continueToOverview\`, \`finish\`.
3. **Chain via return types** so the test cannot call steps on the wrong page.
4. **Delete every sleep** — waiting is BasePage's job. The test also gets faster (the original slept 12s minimum).
5. **Keep assertions in the test** and give each a message, so a failure says *what* broke.
6. **Lifecycle to BaseTest** — the original never quit the browser if an assertion failed before the last line.

Result: the test is ~20 readable lines and a locator change touches one page. A good refactor also keeps
behaviour identical — run it before and after and compare.`,
  mistakes: [
    'Refactoring and changing test behaviour at the same time, so you cannot tell if a failure is a regression.',
    'Moving the assertions into pages to make the test "shorter".',
    'Replacing Thread.sleep with an implicit wait instead of explicit waits in BasePage.',
    'One huge ShopEasyPage class with every locator.',
  ],
  interview: [
    { q: 'How would you refactor a long, flaky UI test?', a: 'Identify the pages and actions, extract page objects with private locators and intention-revealing methods, replace sleeps with explicit waits in a BasePage, move driver lifecycle to a BaseTest with alwaysRun teardown, and keep assertions with messages in the test. Verify behaviour is unchanged by running it before and after.' },
    { q: 'What was wrong with driver.quit() at the end of the test method?', a: 'If any assertion fails earlier, quit() is never reached and the browser leaks. Cleanup belongs in @AfterMethod(alwaysRun = true) or a finally block.' },
  ],
}
