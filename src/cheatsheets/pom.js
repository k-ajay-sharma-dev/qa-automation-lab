export default {
  slug: 'pom',
  title: 'Page Object Model',
  sections: [
    {
      heading: 'The rules in one list',
      body: `- One class per **page** or reusable **component** (header, modal, product card).
- Locators are \`private final By\` fields — tests never see them.
- WebDriver comes in through the **constructor**; pages never create or quit browsers.
- Public methods describe **user intent**: \`loginAs()\`, \`addToCart(name)\`, \`getErrorMessage()\`.
- Navigation methods **return the next page**; same-page actions return \`this\`.
- **No assertions** in pages — pages report state, tests judge it.
- **No \`Thread.sleep\`** — waits live in \`BasePage\` helpers.`,
    },
    {
      heading: 'Page object template',
      body: `\`\`\`java
public class LoginPage extends BasePage {
    private final By username    = By.id("user-name");
    private final By password    = By.id("password");
    private final By loginButton = By.id("login-button");
    private final By error       = By.id("login-error-message");

    public LoginPage(WebDriver driver) { super(driver); }

    public LoginPage open() { driver.get(ConfigReader.baseUrl() + "/login.html"); return this; }

    public InventoryPage loginAs(String user, String pass) {
        type(username, user); type(password, pass); click(loginButton);
        return new InventoryPage(driver);
    }

    public LoginPage loginExpectingError(String user, String pass) {
        type(username, user); type(password, pass); click(loginButton);
        return this;
    }

    public String getErrorMessage() { return getText(error); }
}
\`\`\``,
    },
    {
      heading: 'BasePage helpers',
      body: `\`\`\`java
public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }
    protected void click(By l)            { wait.until(ExpectedConditions.elementToBeClickable(l)).click(); }
    protected void type(By l, String t)   { WebElement e = wait.until(ExpectedConditions.visibilityOfElementLocated(l)); e.clear(); e.sendKeys(t); }
    protected String getText(By l)        { return wait.until(ExpectedConditions.visibilityOfElementLocated(l)).getText(); }
    protected boolean isDisplayed(By l)   { try { return getText(l) != null; } catch (TimeoutException e) { return false; } }
}
\`\`\`
Keep it small; split into \`WaitUtils\` / \`JsUtils\` when it grows.`,
    },
    {
      heading: 'Fluent test',
      body: `\`\`\`java
CheckoutOverviewPage overview = new LoginPage(driver()).open()
        .loginAs("standard_user", "secret_sauce")
        .addToCart("Trailblazer Backpack")
        .header().openCart()
        .checkout()
        .fillShippingInfo("Asha", "Rao", "560001")
        .continueToOverview();
Assert.assertEquals(overview.getTotal(), "$32.39", "Order total");
\`\`\``,
    },
    {
      heading: 'Components (composition)',
      body: `\`\`\`java
public class InventoryPage extends BasePage {
    private final HeaderComponent header;
    public InventoryPage(WebDriver d) { super(d); header = new HeaderComponent(d); }
    public HeaderComponent header() { return header; }
}
// test: inventory.header().getCartCount();  cart.header().logout();
\`\`\`
Use for header, footer, menus, modals, date pickers, product cards. Do **not** put them in BasePage.`,
    },
    {
      heading: 'Dynamic locators',
      body: `\`\`\`java
private static final String ADD_BUTTON =
    "//div[contains(@class,'inventory-item')][.//*[normalize-space()='%s']]//button";

private By addButton(String product) { return By.xpath(String.format(ADD_BUTTON, product)); }

public InventoryPage addToCart(String product) { click(addButton(product)); return this; }
\`\`\`
Not possible with \`@FindBy\` (annotation values must be constants).`,
    },
    {
      heading: 'Web table by content',
      body: `\`\`\`java
int col = getColumnIndex("Department");                   // from header text
WebElement row = driver.findElements(rows).stream()
    .filter(r -> r.findElements(By.tagName("td")).get(nameCol).getText().trim().equals(name))
    .findFirst().orElseThrow(() -> new NoSuchElementException("No row for " + name));
String department = row.findElements(By.tagName("td")).get(col).getText();
\`\`\`
XPath alternative: \`//table[@id='employee-table']//tr[td[normalize-space()='%s']]\`. Never \`tr[3]/td[4]\`.`,
    },
    {
      heading: 'PageFactory vs By',
      body: `| | \`By\` fields | \`@FindBy\` + \`initElements\` |
|---|---|---|
| Lookup | explicit, on use | proxy, on use |
| Works with \`*Located(By)\` conditions | yes | no |
| Dynamic locators | yes | no |
| Forgot init | n/a | NullPointerException |
| \`@CacheLookup\` | n/a | stale elements on re-render |

\`\`\`java
@FindBy(id = "user-name") private WebElement username;
public LoginPage(WebDriver d) { PageFactory.initElements(d, this); }
\`\`\``,
    },
    {
      heading: 'DriverManager + BaseTest',
      body: `\`\`\`java
public final class DriverManager {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
    public static void initDriver(String browser) { DRIVER.set(DriverFactory.create(browser)); }
    public static WebDriver getDriver() { return DRIVER.get(); }
    public static void quitDriver() { if (DRIVER.get() != null) { DRIVER.get().quit(); DRIVER.remove(); } }
}

public abstract class BaseTest {
    @BeforeMethod(alwaysRun = true) @Parameters("browser")
    public void setUp(@Optional("chrome") String browser) { DriverManager.initDriver(browser); }

    @AfterMethod(alwaysRun = true)
    public void tearDown() { DriverManager.quitDriver(); }

    protected WebDriver driver() { return DriverManager.getDriver(); }
}
\`\`\``,
    },
    {
      heading: 'Anti-patterns to flag in review',
      body: `- Public locators / \`driver.findElement\` in tests
- \`Assert\` inside page methods
- \`public static WebDriver driver\`
- Wrong return types (method returns a page you do not land on)
- God page class with every locator in the app
- \`Thread.sleep\` anywhere
- Assertions that would still pass if the feature were broken`,
    },
  ],
}
