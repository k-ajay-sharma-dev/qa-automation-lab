export default {
  slug: 'pom-basepage-and-components',
  category: 'pom',
  order: 5,
  title: 'BasePage and components: reuse without copy-paste',
  minutes: 9,
  summary: 'Move shared waits and helpers into an abstract BasePage that every page extends, and model repeated page parts (header, pagination) as components that pages contain.',
  manualAnalogy: `Every manual test case in your suite shares some rules: "wait for the spinner before clicking", "clear the field before typing". You do not rewrite them in each case; they live in the test plan's general section. BasePage is that general section. And when the same header with the cart icon appears on five screens, you describe it once and say "use the header" — that is a component.`,
  body: `## Part 1 — BasePage: inheritance

Once you have three page classes you notice they all repeat:

\`\`\`java
new WebDriverWait(driver, Duration.ofSeconds(10))
    .until(ExpectedConditions.elementToBeClickable(someButton)).click();
\`\`\`

Put that once in a parent class.

\`\`\`java
public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected WebElement visible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }
    // type(...), getText(...), isDisplayed(...) follow the same idea
}
\`\`\`

New words, one at a time:

- **\`abstract class\`** — a class you cannot create directly (\`new BasePage(driver)\` will not compile). It exists only to be *extended*. There is no "base page" on the site, so that is exactly right.
- **\`protected\`** — visible to this class and its subclasses, hidden from tests. Tests should call \`loginAs(...)\`, never \`click(By)\`.
- **\`WebDriverWait\`** — an explicit wait: it polls the condition (default every 500 ms) until it is true or the timeout passes. \`Duration.ofSeconds(10)\` is the timeout.

A page uses it with \`extends\` and \`super\`:

\`\`\`java
public class CartPage extends BasePage {
    private final By checkoutButton = By.id("checkout");

    public CartPage(WebDriver driver) {
        super(driver);                 // run BasePage's constructor first
    }

    public CheckoutPage checkout() {
        click(checkoutButton);         // inherited helper — waits, then clicks
        return new CheckoutPage(driver);
    }
}
\`\`\`

\`super(driver)\` passes the driver up so BasePage can set its fields. After that, \`driver\`, \`wait\` and every helper are available as if \`CartPage\` had written them.

### Helpers worth having

| Helper | What it should do |
|---|---|
| \`click(By)\` | wait until clickable, click |
| \`type(By, String)\` | wait until visible, **clear**, then sendKeys |
| \`getText(By)\` | wait until visible, return trimmed text |
| \`isDisplayed(By)\` | return \`false\` (never throw) when the element is absent |

The last one matters for checks like "the cart badge is not shown". \`findElement\` throws when nothing matches, but \`findElements(...)\` returns an empty list — so "absent" can be answered without a try/catch.

## Part 2 — Components: composition

Some parts of the UI are not pages: the header with \`#shopping-cart-link\` and \`#logout-link\` appears on inventory, cart and checkout. Copying its methods into three pages is the copy-paste problem again. Inheritance does not fit either — a cart page *is not a* header.

Instead a page **has a** component. A component is a small class, built like a page object:

\`\`\`java
public class PaginationComponent extends BasePage {   // on table.html
    private final By next = By.id("next-page");
    private final By prev = By.id("prev-page");
    private final By info = By.id("page-info");

    public PaginationComponent(WebDriver driver) { super(driver); }

    public PaginationComponent nextPage() { click(next); return this; }
    public String pageInfo() { return getText(info); }
}
\`\`\`

The page exposes it through a method rather than duplicating its methods:

\`\`\`java
public class EmployeeTablePage extends BasePage {
    public EmployeeTablePage(WebDriver driver) { super(driver); }

    public PaginationComponent pagination() {
        return new PaginationComponent(driver);
    }
}
\`\`\`

The test reads: \`tablePage.pagination().nextPage().pageInfo()\`. If pagination changes, one class changes.

Component methods can also return pages — a header's "open cart" returns a \`CartPage\`, its "log out" returns a \`LoginPage\`, following the *Fluent page objects* lesson.

## Inheritance vs composition — when to use which

| Question | Answer → |
|---|---|
| "Every page needs this behaviour" (waits, click, type) | **BasePage** (inheritance, *is a*) |
| "Some pages show this widget" (header, pagination, product card) | **Component** (composition, *has a*) |

A deep chain like \`CheckoutPage extends CartPage extends InventoryPage\` is a smell: checkout would inherit cart methods it does not have. Keep inheritance one level deep — \`XxxPage extends BasePage\` — and compose the rest.`,
  keyPoints: [
    'BasePage is an abstract parent holding the driver, one WebDriverWait and protected helpers.',
    'Pages `extend BasePage` and call `super(driver)` in their constructor.',
    'Helpers wait before acting, so pages never need `Thread.sleep`.',
    '`isDisplayed` should return false for absent elements; use `findElements` to avoid exceptions.',
    'Repeated UI parts become components the page *has*, exposed through a method like `header()`.',
  ],
  mistakes: [
    'Making helpers `public` — tests start calling `click(By)` directly. Keep them `protected`.',
    'Forgetting `super(driver)` — the code will not compile because BasePage has no empty constructor; add the call as the first line.',
    'Copy-pasting header methods into every page "for convenience" — expose a component instead.',
    'Chaining pages through inheritance (Checkout extends Cart) — keep one level and compose.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/inventory.html and cart.html side by side. List every element both pages share (look at the header). Those shared ids are the private locators of your future component; the rest stay in each page.`,
  problems: ['pom-005', 'pom-007', 'pom-013'],
}
