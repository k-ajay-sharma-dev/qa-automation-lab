export default {
  slug: 'locators',
  title: 'Locators: CSS vs XPath',
  sections: [
    {
      heading: 'Priority order (what to reach for first)',
      body: `1. **\`By.id\`** — unique, fast, readable. Skip it if the id is generated (\`btn-8f3a2\`, \`ember123\`, \`mat-input-7\`).
2. **\`By.name\`** — great for form fields (tied to the backend payload). Not always unique (radio groups).
3. **Test attribute** — \`By.cssSelector("[data-testid='login-button']")\`. A contract with developers; survives redesigns.
4. **Short CSS** on stable attributes/classes, scoped to a container — \`#inventory-list .item-price\`.
5. **XPath** — when you need **text** or need to move **up/sideways** (parent, ancestor, siblings).
6. **Never**: absolute XPath (\`/html/body/div[2]/...\`), long index chains, "Copy full XPath" pasted into code.

Rule of thumb: a locator should describe **what the element is**, not **where it happens to be**.`,
    },
    {
      heading: 'Selenium By strategies',
      body: `\`\`\`java
driver.findElement(By.id("user-name"));
driver.findElement(By.name("rememberMe"));
driver.findElement(By.className("inventory-item"));      // ONE class only, no spaces
driver.findElement(By.tagName("button"));
driver.findElement(By.linkText("Checkout"));               // exact <a> text
driver.findElement(By.partialLinkText("Check"));           // substring of <a> text
driver.findElement(By.cssSelector("[data-testid='login-button']"));
driver.findElement(By.xpath("//button[text()='Save']"));

List<WebElement> cards = driver.findElements(By.className("inventory-item")); // empty list if none
\`\`\`
\`findElement\` → first match or \`NoSuchElementException\`. \`findElements\` → \`List\`, never throws (use \`.isEmpty()\` for "not present").`,
    },
    {
      heading: 'CSS vs XPath — side by side',
      body: `| Goal | CSS | XPath |
|---|---|---|
| By id | \`#user-name\` | \`//*[@id='user-name']\` |
| By class | \`.inventory-item\` | \`//*[contains(@class,'inventory-item')]\` |
| Several classes | \`.btn.btn-primary\` | \`//*[contains(@class,'btn') and contains(@class,'btn-primary')]\` |
| Tag + attribute | \`input[name='email']\` | \`//input[@name='email']\` |
| Two attributes (AND) | \`input[type='radio'][name='gender']\` | \`//input[@type='radio' and @name='gender']\` |
| Starts with | \`[id^='submit-order-']\` | \`//*[starts-with(@id,'submit-order-')]\` |
| Ends with | \`[id$='-phone']\` | *(none in XPath 1.0)* |
| Contains | \`[name*='Phone']\` | \`//*[contains(@name,'Phone')]\` |
| Descendant (any depth) | \`#list .price\` | \`//*[@id='list']//*[@class='price']\` |
| Direct child | \`ul > li\` | \`//ul/li\` |
| Next sibling | \`label + input\` | \`//label/following-sibling::input[1]\` |
| Any later sibling | \`h3 ~ button\` | \`//h3/following-sibling::button\` |
| n-th of type | \`tr td:nth-of-type(3)\` | \`//tr/td[3]\` |
| First / last | \`li:first-child\`, \`li:last-child\` | \`//li[1]\`, \`//li[last()]\` |
| Exact text | ❌ not possible | \`//button[text()='Save']\` |
| Text contains | ❌ not possible | \`//a[contains(text(),'Backpack')]\` |
| Trimmed text | ❌ | \`//button[normalize-space()='Save']\` |
| Parent | ❌ (only \`:has()\`, no text) | \`//td[text()='X']/parent::tr\` or \`/..\` |
| Ancestor | ❌ | \`//a[text()='X']/ancestor::div[@data-testid='card']\` |
| Previous sibling | ❌ | \`//input/preceding-sibling::label\` |
| NOT | \`input:not([type='hidden'])\` | \`//input[not(@type='hidden')]\` |
| OR | \`#a, #b\` | \`//*[@id='a' or @id='b']\` |

Test both in DevTools Console: \`$$("css")\` and \`$x("xpath")\`. In the Elements panel, Ctrl+F accepts either.`,
    },
    {
      heading: 'XPath axes',
      body: `| Axis | Means | Example |
|---|---|---|
| \`child::\` (default, \`/\`) | direct children | \`//ul/li\` |
| \`descendant::\` (\`//\`) | any depth below | \`//form//input\` |
| \`parent::\` (\`..\`) | one level up | \`//td[text()='Priya Sharma']/parent::tr\` |
| \`ancestor::\` | any level up | \`//a[text()='Storm Fleece Jacket']/ancestor::div[@data-testid='inventory-item']\` |
| \`following-sibling::\` | later siblings, same parent | \`//span[text()='ORD-1043']/following-sibling::button\` |
| \`preceding-sibling::\` | earlier siblings | \`//button/preceding-sibling::span[@class='order-id']\` |
| \`following::\` | everything after in the document | \`//label[text()='Email']/following::input[1]\` |
| \`preceding::\` | everything before | \`//input[@id='x']/preceding::label[1]\` |
| \`self::\` | the node itself | \`//*[self::h1 or self::h2]\` |

**Predicates stack as AND:** \`//div[contains(@class,'user-card')][span[text()='Admin']][span[text()='Active']]//button[text()='Delete']\`

**Indexes:** \`//tr/td[3]\` = 3rd cell of *every* row; \`(//tr/td)[3]\` = 3rd cell in the whole document.`,
    },
    {
      heading: 'The "row / card" pattern (most useful XPath in real projects)',
      body: `Find the container by something you know, then act inside it:

\`\`\`java
// Edit button in the table row where Name = Priya Sharma
By editPriya = By.xpath("//tr[td[normalize-space()='Priya Sharma']]//button[text()='Edit']");

// Price on the product card named X (Page Object method)
private static final String PRICE_OF = "//div[@data-testid='inventory-item'][.//a[text()='%s']]//div[@class='item-price']";
public String priceOf(String product) {
    return driver.findElement(By.xpath(String.format(PRICE_OF, product))).getText();
}

// Or scope with element chaining
WebElement card = driver.findElement(By.xpath("//a[text()='Storm Fleece Jacket']/ancestor::div[@data-testid='inventory-item']"));
card.findElement(By.cssSelector(".item-price"));      // CSS inside a WebElement is scoped automatically
card.findElement(By.xpath(".//button"));               // XPath MUST start with "." to stay inside the card
\`\`\``,
    },
    {
      heading: 'Dynamic / tricky elements',
      body: `- **Generated ids** (\`submit-order-c41d9\`): use the stable part — \`[id^='submit-order-']\`, \`starts-with(@id,'submit-order-')\`.
- **Multiple classes**: \`@class='plan--featured'\` fails on \`class="plan plan--featured"\` → CSS \`.plan--featured\` or \`contains(@class,'plan--featured')\`.
- **Identical buttons**: anchor on neighbour text with axes, not on indexes.
- **Text with whitespace / inner tags**: \`normalize-space()\` or \`.\` instead of \`text()\`.
- **Quotes in text** (\`O'Neil\`): wrap in double quotes in XPath — \`"//td[text()=\\"O'Neil\\"]"\` in Java.
- **iframes**: locators cannot see inside until \`driver.switchTo().frame("supportFrame")\`; come back with \`defaultContent()\`.
- **Shadow DOM**: XPath does not work inside; use \`host.getShadowRoot().findElement(By.cssSelector("#coupon-code"))\`.
- **Case-insensitive text** (XPath 1.0): \`translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')\`.`,
    },
    {
      heading: 'Selenium 4 relative locators',
      body: `\`\`\`java
import static org.openqa.selenium.support.locators.RelativeLocator.with;

WebElement password = driver.findElement(By.id("password"));

WebElement username = driver.findElement(with(By.tagName("input")).above(password));
WebElement loginBtn = driver.findElement(with(By.tagName("button")).below(password));
WebElement label    = driver.findElement(with(By.tagName("label")).toLeftOf(By.id("email")));
WebElement field    = driver.findElement(with(By.tagName("input")).toRightOf(label));
WebElement nearBy   = driver.findElement(with(By.tagName("input")).near(By.id("lbl-dob"), 50)); // within 50px

// chainable
driver.findElement(with(By.tagName("button")).below(password).toRightOf(By.id("remember")));
\`\`\`
They use **rendered positions** (getBoundingClientRect), so they depend on layout, viewport size and responsive design.
Use them for visually-grouped UIs without a DOM relationship; prefer DOM-based locators when one exists.`,
    },
    {
      heading: 'Page Object conventions',
      body: `\`\`\`java
public class LoginPage {
    private final WebDriver driver;
    private final By username = By.id("user-name");
    private final By password = By.id("password");
    private final By loginButton = By.cssSelector("[data-testid='login-button']");
    private final By error = By.cssSelector("[data-testid='error']");
    // ...
}
\`\`\`
- Locators are **private** fields of the page class — one place to fix when the UI changes.
- Store \`By\` objects (lazy) rather than \`WebElement\`s (can go stale).
- Parameterised locators → methods with \`String.format\`, never copy-paste per value.`,
    },
  ],
}
