export default {
  slug: 'selenium-find-and-interact',
  category: 'selenium',
  order: 2,
  title: 'Finding elements and interacting with them',
  minutes: 8,
  summary: 'Locate elements with By, type, click, read text and attributes, and turn what you see into TestNG assertions with helpful messages.',
  manualAnalogy: `When you test a login screen by hand you look for the username box, clear whatever autofill put there, type, press Login, then *read* the result and compare it with the expected result in your test case. Automation is the same four moves — find, act, read, compare — written down precisely enough that a machine never "looks at the wrong box".`,
  body: `## Step 1 — describe *where* the element is: \`By\`

A locator is an address for an element. Selenium's \`By\` class offers several kinds:

\`\`\`java
By.id("user-name")                         // fastest, best when ids are stable
By.cssSelector("#login-form .error-close") // CSS: ids (#), classes (.), nesting
By.name("rememberMe")
By.xpath("//button[normalize-space()='Login']") // when only text identifies it
\`\`\`

Prefer **id → CSS → XPath**. You can test any CSS selector in Chrome DevTools: press Ctrl+F in the Elements tab and paste it — the count on the right should say \`1 of 1\`.

Store locators as constants at the top of the class so a change in the page means one edit:

\`\`\`java
private static final By USERNAME = By.id("user-name");
private static final By REMEMBER = By.name("rememberMe");
\`\`\`

## Step 2 — find it

\`\`\`java
WebElement user = driver.findElement(USERNAME);          // exactly one, or exception
List<WebElement> rows = driver.findElements(By.cssSelector(".inventory-item"));
\`\`\`

A \`WebElement\` is a *pointer* to one node on the page. \`findElement\` throws \`NoSuchElementException\` when nothing matches; \`findElements\` gives an empty list.

## Step 3 — act on it

| Method | What a human would do |
|---|---|
| \`clear()\` | Select all text in a field and delete it |
| \`sendKeys("text")\` | Type |
| \`click()\` | Click |
| \`submit()\` | Press Enter inside a form (prefer clicking the real button) |

\`\`\`java
WebElement user = driver.findElement(USERNAME);
user.clear();
user.sendKeys("locked_out_user");
\`\`\`

Why \`clear()\` first? The ShopEasy login page remembers the last user when "Remember me" was ticked. \`sendKeys\` **appends**, so without \`clear()\` you would type \`standard_userlocked_out_user\`.

## Step 4 — read what the page shows

\`\`\`java
String banner = driver.findElement(By.id("login-error-message")).getText();
String placeholder = driver.findElement(USERNAME).getAttribute("placeholder");
String typeAttr = driver.findElement(USERNAME).getDomAttribute("type");
boolean shown = driver.findElement(By.id("login-error")).isDisplayed();
\`\`\`

- \`getText()\` returns the **visible** text — what a user reads. Hidden elements return \`""\`.
- \`getAttribute("x")\` / \`getDomAttribute("x")\` return an HTML attribute, e.g. \`type\`, \`placeholder\`, \`href\`, \`value\`. \`getDomAttribute\` (Selenium 4) reads exactly what is written in the HTML; \`getAttribute\` may fall back to the live JavaScript property.
- \`isDisplayed()\`, \`isEnabled()\`, \`isSelected()\` answer yes/no questions.

## Step 5 — compare with TestNG \`Assert\`

\`System.out.println\` does not fail a test. An assertion does:

\`\`\`java
import org.testng.Assert;

Assert.assertEquals(actualTitle, "ShopEasy — Login", "Login page title");
Assert.assertTrue(banner.contains("locked out"),
        "Expected locked-out message but banner said: " + banner);
\`\`\`

The last argument is the **message** that appears in the Jenkins report. Write it for the person reading a red build at 7 a.m.: include the actual value.

## Putting it into a TestNG class

\`\`\`java
public class LoginErrorTest {
    private WebDriver driver;

    @BeforeMethod
    public void openLogin() {
        driver = new ChromeDriver();
        driver.get("http://localhost:5180/practice-site/login.html");
    }

    @Test
    public void lockedUserSeesLockedMessage() {
        // find → act → read → assert
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        if (driver != null) driver.quit();
    }
}
\`\`\`

- \`@BeforeMethod\` runs before **each** \`@Test\`, so every test starts on a fresh browser — no leftovers from the previous test.
- \`@AfterMethod(alwaysRun = true)\` runs even if the test failed.

## Visible text vs attribute — a quick rule

If a user can *read* it on screen → \`getText()\`. If it is a property of the element (masked field, link target, current value of an input) → an attribute. Input boxes are the classic trap: what you typed into an \`<input>\` is **not** its text; read it with \`getDomProperty("value")\` or \`getAttribute("value")\`.`,
  keyPoints: [
    'Locator preference: id, then CSS, then XPath. Keep locators as `By` constants.',
    '`clear()` before `sendKeys()` — sendKeys appends to existing text.',
    '`getText()` = visible text; attributes (`type`, `value`, `href`) need `getAttribute`/`getDomAttribute`.',
    'Fail with `Assert`, not `println`, and put the actual value in the assertion message.',
    '`@BeforeMethod` / `@AfterMethod(alwaysRun = true)` give every test its own fresh browser.',
  ],
  mistakes: [
    'Reading an input\'s typed value with `getText()` — it returns an empty string. Use the `value` attribute/property.',
    'Asserting with `assertTrue(a.equals(b))` — on failure you only see "expected true but found false". Use `assertEquals(actual, expected, message)`.',
    'Copying a long absolute XPath from DevTools (`/html/body/div[2]/...`). It breaks when anything moves; write a short id or CSS locator.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/login.html\` click Login with both fields empty. In DevTools find the banner text element and note its id, then write the one-line \`getText()\` + \`assertEquals\` that would check "Username is required".`,
  problems: ['sel-002', 'sel-003'],
}
