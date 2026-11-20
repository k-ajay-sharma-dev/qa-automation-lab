export default {
  slug: 'selenium-deep-locators-xpath-dynamic',
  category: 'selenium',
  order: 12,
  title: 'Deep dive: locator strategy, advanced XPath/CSS and dynamic elements',
  minutes: 30,
  summary: 'Know how findElement is evaluated by the driver, write advanced XPath 1.0 (axes, positions, text functions) and CSS (attribute operators, structural pseudo-classes, :has), choose between id, test id, CSS and XPath with a team locator policy, and handle generated ids, re-rendered and re-ordered elements, virtualised lists and dynamic tables — plus relative locators, ByChained/ByAll and fast locator validation.',
  manualAnalogy: `When you write a manual test step you never say "click the third button in the second div" — you say "click Edit in the row for Priya Sharma" or "the red error banner under the form". You anchor on something a user can see and that will still be true next release. A locator strategy is that habit made rigorous: anchor on stable meaning (a test id, a label, a business key), move a short, explicit distance to the target, and make the contract with developers explicit so the anchor does not disappear.`,
  body: `## Where the earlier lessons stop

The *Smart locators* lesson gave five XPath patterns, the leading-dot rule, header-based table columns, pagination loops and a first look at relative locators. *Finding elements and interacting* covered \`By\`, \`findElement(s)\` and attribute vs property. *Alerts, frames, windows and shadow DOM* covered \`getShadowRoot()\`. This deep dive goes underneath and beyond: how the driver evaluates a locator, the full XPath 1.0 and CSS toolset with their traps, a locator policy you can defend in an interview and in a code review, and patterns for elements that change under you. How \`findElement\` travels over the wire is in *Deep dive: Selenium architecture*; exception handling around stale elements (retry design) is in *java-deep-exception-design*.

## How findElement works under the hood

### The five W3C strategies and how By maps onto them

The W3C WebDriver spec defines exactly five **location strategies**. Everything else in \`By\` is translated by the Java bindings before it is sent:

| Java \`By\` | Sent to the driver as | Evaluated by the driver with |
|---|---|---|
| \`By.cssSelector(s)\` | \`css selector\`, \`s\` | \`querySelectorAll\` on the start node |
| \`By.xpath(x)\` | \`xpath\`, \`x\` | \`document.evaluate(x, startNode, null, ORDERED_NODE_SNAPSHOT_TYPE, null)\` |
| \`By.linkText(t)\` | \`link text\`, \`t\` | all \`<a>\` elements whose **rendered text**, trimmed, equals \`t\` |
| \`By.partialLinkText(t)\` | \`partial link text\`, \`t\` | rendered text contains \`t\` |
| \`By.tagName(n)\` | \`tag name\`, \`n\` | \`getElementsByTagName\`-like search |
| \`By.id("user-name")\` | \`css selector\`, \`#user-name\` | CSS (the id is CSS-escaped by the bindings) |
| \`By.name("username")\` | \`css selector\`, \`*[name="username"]\` | CSS |
| \`By.className("item-price")\` | \`css selector\`, \`.item-price\` | CSS |

Consequences an experienced engineer should know:

- \`By.id\` is **not** \`getElementById\`. It is CSS, so it is scoped (from an element it searches only descendants) and it is affected by CSS escaping. An id such as \`order:42\` or \`1st-item\` works with \`By.id\` because the bindings escape it, but **not** when you hand-write \`By.cssSelector("#order:42")\` (the colon starts a pseudo-class → \`invalid selector\`).
- \`By.className\` accepts **one** class. \`By.className("btn btn-primary")\` does not mean "both classes"; use \`By.cssSelector(".btn.btn-primary")\`.
- \`By.linkText\` uses **rendered** text, not \`aria-label\`. On ShopEasy pages the header has a plain "Cart" text link and a cart icon link \`#shopping-cart-link\` with \`aria-label="Cart"\` and an emoji as its text: \`By.linkText("Cart")\` finds the text link (where the page has one), never the icon. Link text also depends on CSS (\`text-transform: uppercase\` changes rendered text) and on visibility.

### What the driver does

1. Resolve the **start node**: the current browsing context's document (or the frame you switched into), the element you called \`findElement\` on, or a shadow root.
2. Evaluate the strategy in the page's JavaScript context (chromedriver does this through CDP; geckodriver inside Firefox).
3. \`findElement\` returns the **first match in document order**; \`findElements\` returns all, in document order.
4. If nothing matched and the session's **implicit wait** is non-zero, the **driver** re-runs the search until the timeout; then \`no such element\`.
5. An XPath that returns something other than elements (\`//a/@href\`, \`count(//li)\`, \`//td/text()\`) → \`invalid selector\`. WebDriver locates elements only; read attributes and text with \`getDomAttribute\`/\`getText\`.

Two driver differences worth knowing: from a **shadow root**, ChromeDriver supports CSS selectors but rejects XPath (and the W3C spec only defines lookup from shadow roots for the same five strategies — in practice use CSS there); and **link text** matching relies on each driver's rendered-text algorithm, which can differ in whitespace handling between ChromeDriver and GeckoDriver.

### Performance — what is real and what is folklore

- Both CSS and XPath are evaluated **natively by the browser engine**. The old advice "XPath is slow" came from legacy Internet Explorer, which had no native XPath and used a JavaScript library. In modern browsers the difference for typical selectors is small and almost always dwarfed by the HTTP round trip of the command itself.
- What actually costs time: searching the **whole document** with broad expressions (\`//*[contains(text(),'x')]\` visits every text node), repeated lookups in loops (each one is a round trip), implicit-wait polling on locators that are *expected* to be absent, and relative locators (extra JavaScript and layout reads).
- So optimise for **scope and round trips**: anchor on an id or test id, search inside a container, and fetch lists in one \`findElements\`. Measure with your own suite if you must make a performance claim — do not quote benchmark numbers from blog posts in an interview.

## Advanced XPath (1.0)

Browsers implement **XPath 1.0** only. There is no \`ends-with()\`, \`matches()\`, \`lower-case()\`, \`string-join()\` or sequences — those are XPath 2.0+ and fail with \`invalid selector\` (or an evaluation error) in every browser.

### Axes

| Axis | Selects | ShopEasy example |
|---|---|---|
| \`child::\` (default) | children | \`//ul[@id='order-list']/li\` |
| \`descendant::\` / \`//\` | all descendants | \`//div[@id='inventory-list']//button\` |
| \`parent::\` / \`..\` | the parent | \`//a[normalize-space()='Junior Onesie']/..\` (the \`item-body\`) |
| \`ancestor::\` | all ancestors (nearest first in predicates) | \`//a[normalize-space()='Junior Onesie']/ancestor::div[@data-testid='inventory-item']\` |
| \`following-sibling::\` | later siblings | \`//span[@class='order-id'][.='ORD-1043']/following-sibling::button\` |
| \`preceding-sibling::\` | earlier siblings | \`//th[@data-sort='salary']/preceding-sibling::th\` |
| \`following::\` / \`preceding::\` | everything after/before in document order (not ancestors) | \`//h2[.='Edit employee']/following::input[1]\` |
| \`self::\` | the node itself | \`//*[self::button or self::a][normalize-space()='Checkout']\` |
| \`ancestor-or-self::\`, \`descendant-or-self::\` | including the node | rarely needed |

\`ancestor::div[@data-testid='inventory-item'][1]\` — in a reverse axis, position \`[1]\` means **nearest** ancestor. That matters when cards are nested inside other \`div\`s.

### Predicates and positions: [1] versus (//x)[1]

This is the most common XPath interview trap.

\`\`\`
//div[@id='inventory-list']//a[@class='item-name'][1]      → 6 matches
(//div[@id='inventory-list']//a[@class='item-name'])[1]    → 1 match
\`\`\`

- In the first, \`[1]\` belongs to the **step** \`a[@class='item-name']\`: "every \`a.item-name\` that is the first such child of its parent". Each product's \`item-body\` contains exactly one, so all six match.
- In the second, the parentheses make one node-set of the whole path, and \`[1]\` picks the first of it **in document order**.
- Predicates are applied left to right: \`//li[span='Shipped'][2]\` = second of the shipped rows **within each parent**; \`//li[2][span='Shipped']\` = the second \`li\`, only if it is shipped. Order changes meaning.
- \`last()\` and \`position()\`: \`(//ul[@id='order-list']/li)[last()]\`, \`//ul[@id='order-list']/li[position() > 1]\`.

On ShopEasy \`inventory.html\`, the products are **sorted A→Z by JavaScript after load**, so \`(//div[@data-testid='inventory-item'])[1]\` is Classic Crew T-Shirt, although its link id is \`item-3-title-link\`. Positional locators encode the sort order — that is exactly why they break.

### Text: text() versus . versus string()

\`\`\`html
<div class="promo-banner" id="promo-banner">
  ⚡ Deal of the day: Pulse Bike Light now only <span class="item-price">$7.49</span>
  with code <code>BRIGHT25</code> at checkout.
</div>
\`\`\`

| Expression | Result | Why |
|---|---|---|
| \`//div[contains(text(),'BRIGHT25')]\` | no match | \`text()\` returns the div's **own** text nodes; in XPath 1.0 \`contains()\` converts a node-set to the string of its **first** node only ("⚡ Deal of the day: ... now only ") |
| \`//div[text()[contains(.,'checkout')]]\` | match | tests **each** direct text node; "with code ... at checkout." is one of them |
| \`//div[contains(.,'BRIGHT25')]\` | matches the banner **and every ancestor div** | \`.\` = string value of the element = all descendant text |
| \`//div[@id='promo-banner'][contains(normalize-space(.),'BRIGHT25')]\` | match, exactly one | anchored + whole text + whitespace normalised |
| \`string(.)\` / \`string()\` | same as \`.\` in a comparison | explicit string value |

Rules of thumb: use \`normalize-space(.)\` (or \`normalize-space()\`, which defaults to the context node) for "the text a user sees in this element"; use \`text()\` only when you deliberately want the element's own text and not its children's; and always anchor text searches so ancestors do not match too.

### Functions you will use

| Function | Use |
|---|---|
| \`contains(a, b)\`, \`starts-with(a, b)\` | partial matches on attributes/text: \`//button[starts-with(@id,'submit-order-')]\` |
| \`normalize-space(s)\` | trim + collapse whitespace |
| \`translate(s, from, to)\` | character mapping — case-insensitive matching |
| \`substring\`, \`string-length\` | emulate \`ends-with\` |
| \`count(nodeset)\` | structure conditions: \`//div[contains(@class,'plan')][count(.//button)=1]\` |
| \`last()\`, \`position()\` | positions |
| \`not(...)\`, \`and\`, \`or\` | logic |
| \`concat(...)\` | build strings, e.g. for quotes or class tokens |

The **union** operator (a vertical bar) merges node-sets in document order: \`//div[@id='login-error'] | //div[@id='checkout-error']\` matches whichever error banner the current page has.

\`\`\`
Case-insensitive text:
//button[translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='save draft']

ends-with emulation (XPath 1.0 has no ends-with):
//button[substring(@id, string-length(@id) - string-length('-order') + 1) = '-order']

Exact class token (contains(@class,'btn') also matches 'btn-primary', 'btn-sm'):
//button[contains(concat(' ', normalize-space(@class), ' '), ' btn-primary ')]

Several conditions (dynamic.html team cards: an Admin who is Active):
//div[contains(@class,'user-card')][span[@class='role']='Admin'][span[@class='status']='Active']
//div[contains(@class,'user-card')][span[@class='role']='Admin' and not(span[@class='status']='Inactive')]
\`\`\`

**Quotes in data.** XPath 1.0 has no escape character inside string literals. Text containing an apostrophe ("Kid's Onesie") must be wrapped in double quotes; text containing both needs \`concat\`. Generate the literal in Java instead of concatenating raw input:

\`\`\`java
public final class XPathLiterals {

    private static final String DQ = String.valueOf('"');

    private XPathLiterals() { }

    /** Returns a valid XPath 1.0 string literal for any text. */
    public static String literal(String text) {
        if (!text.contains("'")) return "'" + text + "'";
        if (!text.contains(DQ)) return DQ + text + DQ;
        String[] parts = text.split("'", -1);
        StringBuilder sb = new StringBuilder("concat(");
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(", ").append(DQ).append("'").append(DQ).append(", ");
            sb.append("'").append(parts[i]).append("'");
        }
        return sb.append(")").toString();
    }
}
\`\`\`

### Complete example: product card by name → price and button

\`\`\`java
import static org.testng.Assert.assertEquals;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class InventoryCardLocatorTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeMethod
    public void open() {
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.get(BASE + "inventory.html");
    }

    /** The card whose title link has exactly this visible text. */
    private By card(String productName) {
        return By.xpath("//div[@id='inventory-list']/div[@data-testid='inventory-item']"
                + "[.//a[contains(@class,'item-name')][normalize-space()="
                + XPathLiterals.literal(productName) + "]]");
    }

    @Test
    public void priceAndAddButtonAreFoundThroughTheProductName() {
        WebElement onesie = wait.until(ExpectedConditions.visibilityOfElementLocated(card("Junior Onesie")));

        String price = onesie.findElement(By.cssSelector(".item-price")).getText();
        assertEquals(price, "$7.99");

        WebElement button = onesie.findElement(By.cssSelector("button[data-slug]"));
        button.click();
        wait.until(ExpectedConditions.textToBePresentInElement(button, "Remove"));

        // the id flipped from add-to-cart-junior-onesie to remove-junior-onesie, the data-slug did not
        assertEquals(button.getDomAttribute("id"), "remove-junior-onesie");
    }

    @AfterMethod(alwaysRun = true)
    public void quit() {
        if (driver != null) driver.quit();
    }
}
\`\`\`

**Step by step**

- \`card(...)\` anchors on the **business key** (the product name), not on position: the list is re-sorted by JavaScript, so \`(//div[@data-testid='inventory-item'])[2]\` would be a different product depending on the sort.
- The outer predicate \`[.//a[...]]\` keeps the **card**, not the link — the "parent that has a child" pattern; the leading \`.\` is mandatory inside a predicate that should look inside the candidate.
- The page-level promo banner also contains a \`.item-price\` ($7.49). Scoping \`findElement\` to the card is what makes \`.item-price\` safe.
- The button is located by \`data-slug\`, which does not change. ShopEasy rewrites the button's **id** and **data-testid** when it toggles between "Add to cart" and "Remove": a locator such as \`#add-to-cart-junior-onesie\` stops matching after the click. The element itself is the same node (it is updated in place), so the stored reference stays valid — the button text is waited for on the reference.
- \`XPathLiterals.literal\` makes the builder safe for names with apostrophes.

## Advanced CSS

### Attribute operators

| Operator | Meaning | ShopEasy example |
|---|---|---|
| \`[a]\` | has attribute | \`button[data-slug]\` |
| \`[a='v']\` | equals | \`[data-testid='checkout']\` |
| \`[a^='v']\` | starts with | \`#order-actions button[id^='submit-order-']\` (generated suffix on \`dynamic.html\`) |
| \`[a$='v']\` | ends with | \`button[id$='-junior-onesie']\` (both add and remove state) |
| \`[a*='v']\` | contains substring | \`[class*='status-']\` |
| \`[a~='v']\` | whitespace-separated **word** equals | \`div[class~='plan--featured']\` (same as \`.plan--featured\`) |
| \`[a='v' i]\` | case-insensitive value (Selectors Level 4) | \`input[placeholder='first name' i]\` |

The dash-match operator \`[lang|='en']\` (a vertical bar before the equals sign) matches \`en\` or anything starting with \`en-\` (\`en-US\`) — designed for language codes, rarely useful elsewhere.

### Combinators and structural pseudo-classes

- Descendant (space), child (\`>\`), adjacent sibling (\`+\`), general sibling (\`~\`): \`#order-list .order-id + .order-status\`, \`#user-cards .role ~ .status\`.
- \`:nth-child(n)\` counts **all** element siblings; \`:nth-of-type(n)\` counts siblings **of the same tag**. In a \`dynamic.html\` team card the children are \`h4\`, \`span.role\`, \`span.status\`, \`div\`:

\`\`\`
.user-card > span:nth-child(2)      → span.role    (2nd child overall, and it is a span)
.user-card > span:nth-of-type(2)    → span.status  (2nd span)
.user-card > span:nth-child(1)      → nothing      (1st child is the h4)
\`\`\`

- \`:not(...)\`: \`#pricing-plans .plan:not(.plan--featured) button\`; Selectors Level 4 allows a list inside (\`:not(.a, .b)\`).
- \`:has(...)\`: the **relational** pseudo-class — "an element that contains...". \`#inventory-list [data-testid='inventory-item']:has(button[id^='remove-'])\` = cards already in the cart; \`.user-card:has(.status)\`. Browser support arrived late: Chrome/Edge 105, Safari 15.4, Firefox 121. On older browser images on your Grid it throws \`invalid selector\` — check the node versions before adopting it.
- \`:is()\`/\`:where()\` group alternatives: \`:is(#login-error, #checkout-error) .error-message\`.

### What CSS cannot do

- **Select by text.** There is no \`:contains()\` in standard CSS (it was a jQuery extension). Text-based locating needs XPath, \`linkText\`, or filtering \`findElements\` results in Java.
- **Go up the tree** — except via \`:has()\`, which selects an ancestor *by* its descendant but still cannot return "the parent of the element I already found".
- **Reverse or "following" axes** beyond siblings, and no \`count()\` or arithmetic positions other than \`:nth-*\` formulas (\`:nth-child(2n+1)\`, \`:nth-last-child(1)\`).

## CSS vs XPath vs id/name/test id — and a team policy

| | \`data-testid\` / dedicated test attribute | \`id\` / \`name\` | CSS (classes, structure) | XPath |
|---|---|---|---|---|
| How it works | CSS attribute selector on an attribute that exists only for tests | CSS by the bindings | native \`querySelectorAll\` | native \`document.evaluate\` |
| Advantages | explicit contract, survives redesigns and i18n, readable | short, usually unique, often already present | concise, scoped, supports attribute operators and \`:has\` | text, any axis, parent/ancestor, conditions, counts |
| Disadvantages | needs developer cooperation; can be forgotten on new components | generated ids in frameworks; \`name\` only on form fields | no text, no parent (without \`:has\`); coupled to styling classes | verbose, easy to write fragile absolute paths; XPath 1.0 only; no shadow DOM in ChromeDriver |
| Performance | fast (attribute selector) | fast | fast | fast in modern browsers; broad text scans are the real cost |
| Maintainability | best | good if ids are hand-written | medium: CSS refactors break it | good when anchored on stable text/attributes, poor when positional |
| Scalability (many teams) | best — searchable, lintable | good | medium | medium |
| When to use | default for everything you interact with | form fields with stable ids | structural relations, attribute patterns | locating **by visible text** or **relative to** a stable anchor; tables |

**Recommended approach and why:** a test-id first policy with explicit fallbacks. Test ids express intent ("this is the checkout button") and are independent of styling, copy changes and translations. Fall back to stable \`id\`/\`name\`, then scoped CSS, then text-anchored XPath — never to generated ids, layout classes or absolute paths. Locating by visible text is legitimate when the text **is** the requirement (a button label, an error message), but then the test also breaks on copy changes, which may be what you want.

### The locator contract with developers

A team locator policy that works in practice on a typical e-commerce project:

1. **Attribute name agreed once** (\`data-testid\` here; ShopEasy uses it on most interactive elements: \`username\`, \`login-button\`, \`continue\`, \`error\`, \`inventory-item\`).
2. **Values are semantic and stable**: \`checkout\`, \`cart-item\`, not \`btn3\`. Lists use one value per row type plus a business key nearby (\`data-testid="inventory-item"\` + the product name, or \`data-emp-id\`).
3. **Uniqueness is per screen, not global**: \`login.html\` and \`checkout.html\` both have \`data-testid="error"\` — fine, because each page object owns its screen. Inside a page, scope (\`#checkout-info-form [data-testid='error']\`).
4. **Definition of done**: new interactive elements get a test id; a lint rule or PR checklist on the front-end enforces it; renaming one is a breaking change announced to QA.
5. **Production builds**: whether to strip test ids (Babel/webpack plugins) is a product decision; if stripped, test against a build that keeps them.

\`\`\`java
import org.openqa.selenium.By;

/** One place that knows how test ids are expressed — swap the attribute name here, nowhere else. */
public final class TestId {

    private static final String ATTRIBUTE = "data-testid";

    private TestId() { }

    public static By of(String id) {
        return By.cssSelector("[" + ATTRIBUTE + "='" + id + "']");
    }

    public static By within(String containerId, String id) {
        return By.cssSelector("[" + ATTRIBUTE + "='" + containerId + "'] [" + ATTRIBUTE + "='" + id + "']");
    }
}

// usage
By checkoutError = TestId.of("error");                         // inside CheckoutInformationPage only
By firstCartItem = TestId.within("cart-list", "cart-item");
\`\`\`

## Dynamic elements

"Dynamic" means different problems with different fixes. Diagnose which one you have before choosing a locator.

### 1. Generated or changing ids

On \`dynamic.html\` each button in \`#order-actions\` gets \`prefix-<random hash>\` on every load (\`btn-8f3a2\`, \`submit-order-c71e9\`), and two buttons share the prefix \`btn\`.

\`\`\`java
// a) stable prefix (CSS)               — works only when the prefix is unique
By placeOrder = By.cssSelector("#order-actions button[id^='submit-order-']");

// b) stable anchor + text (XPath)      — the container has a fixed id, the label is the requirement
By saveForLater = By.xpath("//div[@id='order-actions']/button[normalize-space()='Save for later']");

// c) ask for a test id                 — the real fix; track it as a testability ticket
\`\`\`

\`[id^='btn-']\` would match **two** buttons ("Apply coupon" and "Save for later"); prefix matching is only as good as the uniqueness of the prefix. Ids that change **meaning** with state are a separate case: ShopEasy's inventory button switches between \`add-to-cart-<slug>\` and \`remove-<slug>\`. Either locate by the invariant part (\`[data-slug='junior-onesie']\`, \`button[id$='-junior-onesie']\`) or make the state part of the step ("add" uses the add-id, then assert the remove-id appears).

### 2. Elements re-rendered by JavaScript (stale references)

\`table.html\` rebuilds \`tbody\` with \`innerHTML\` on every sort, filter and page change. Any \`WebElement\` you held for a row or cell is now detached:

\`\`\`java
WebElement firstNameCell = driver.findElement(By.cssSelector("#employee-table tbody tr:first-child td:first-child"));
driver.findElement(By.cssSelector("#employee-table th[data-sort='salary']")).click();   // re-render
firstNameCell.getText();   // StaleElementReferenceException: stale element not found in the current frame
\`\`\`

The fix is design, not retries: **keep \`By\`s, not \`WebElement\`s**, across actions that re-render; wait for the re-render to finish (e.g. \`ExpectedConditions.stalenessOf(oldRow)\` or a changed \`#row-count\`/\`#page-info\` text) and then look up again; have page methods return **data** (strings, records) instead of elements. A bounded retry on \`StaleElementReferenceException\` for read-only helpers is acceptable as a last resort (see *java-deep-exception-design*).

### 3. Lists that re-order

The inventory sorts with \`appendChild\`: nodes **move**, references stay valid, but positions change. \`(//div[@data-testid='inventory-item'])[1]\` is a different product for each sort option. Locate by business key (name, SKU, order id), and when the order **is** the requirement, read all names in one \`findElements\` and assert the list.

### 4. Virtualised and infinite-scroll lists

Libraries such as react-window render only the rows in the viewport (plus a buffer) and reuse DOM nodes while you scroll. Consequences: \`findElements\` returns only what is rendered; an element "not found" may simply be off-screen; a reference can silently point to a **different** data row after a scroll (node recycling), which is worse than staleness. Strategy: scroll the container in steps, search after each step, stop at a known end condition; identify rows by data, never by index; prefer the app's search/filter or an API call to bring the row into view.

\`\`\`java
import java.util.List;
import java.util.Optional;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public final class VirtualListSearch {

    private VirtualListSearch() { }

    /** Scrolls a virtualised container until a row with the given key is rendered, or the end is reached. */
    public static Optional<WebElement> scrollTo(WebDriver driver, By container, By rowWithKey, int maxSteps) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        WebElement box = driver.findElement(container);
        for (int step = 0; step < maxSteps; step++) {
            List<WebElement> hits = box.findElements(rowWithKey);
            if (!hits.isEmpty()) return Optional.of(hits.get(0));
            Boolean atEnd = (Boolean) js.executeScript(
                    "const el = arguments[0];"
                  + "const before = el.scrollTop;"
                  + "el.scrollTop = before + el.clientHeight * 0.8;"
                  + "return el.scrollTop === before;", box);
            if (Boolean.TRUE.equals(atEnd)) break;
            // in real code: wait for the new rows to render (e.g. first visible row text changed)
        }
        return Optional.empty();
    }
}
\`\`\`

### 5. Shadow DOM

Elements inside an open shadow root (\`coupon-widget\` on \`dynamic.html\`) are invisible to document-level CSS and XPath. Get the \`SearchContext\` with \`getShadowRoot()\` and use **CSS** from there; see the *Alerts, frames, windows and shadow DOM* lesson and the interactions deep dive for nested roots and closed roots.

### 6. Dynamic tables: find the row by text, then the cell

\`\`\`java
import static org.testng.Assert.assertEquals;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class EmployeeRowLocatorTest {

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeMethod
    public void open() {
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.get("http://localhost:5180/practice-site/table.html");
    }

    private static By row(String employee) {
        return By.xpath("//table[@id='employee-table']/tbody/tr[td[1][normalize-space()="
                + XPathLiterals.literal(employee) + "]]");
    }

    /** Cell of a row, by the column's stable data-sort key — no hard-coded column number. */
    private static By cell(String employee, String sortKey) {
        return By.xpath("//table[@id='employee-table']/tbody/tr[td[1][normalize-space()="
                + XPathLiterals.literal(employee) + "]]/td[count(//table[@id='employee-table']"
                + "/thead/tr/th[@data-sort='" + sortKey + "']/preceding-sibling::th) + 1]");
    }

    @Test
    public void editOpensThePanelForTheChosenEmployee() {
        wait.until(ExpectedConditions.visibilityOfElementLocated(row("Priya Sharma")));
        assertEquals(driver.findElement(cell("Priya Sharma", "salary")).getText(), "$92,000");

        driver.findElement(row("Priya Sharma"))
              .findElement(By.xpath(".//button[normalize-space()='Edit']"))
              .click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("edit-panel")));
        assertEquals(driver.findElement(By.id("edit-name")).getDomProperty("value"), "Priya Sharma");
    }

    @AfterMethod(alwaysRun = true)
    public void quit() {
        if (driver != null) driver.quit();
    }
}
\`\`\`

**Step by step**

- \`row(...)\` keeps the \`tr\` that has a **first cell** equal to the name: \`td[1][...]\` avoids matching "Priya" in another column, and \`normalize-space()\` ignores formatting whitespace.
- \`cell(...)\` computes the column index **inside XPath**: the number of \`th\`s before the Salary header, plus one. It uses \`@data-sort\` rather than header text, because the header text gains a ▲/▼ indicator when sorted.
- The Edit lookup starts from the row element with \`.//\` so it cannot click another row's Edit.
- The test returns to \`By\`s after every action; no row reference is reused across a re-render.
- Priya is on page 1 of the default view; finding a row on another page combines this with the pagination loop from the *Smart locators* lesson (and problem sel-015/sel-030).

### Checkout error banner

\`checkout.html\` keeps the banner in the DOM with the \`hidden\` attribute and fills \`#checkout-error-message\` on submit. Two good locators and one trap:

\`\`\`java
By banner  = By.cssSelector("#checkout-info-form [data-testid='error'][role='alert']");
By message = By.id("checkout-error-message");

driver.findElement(By.id("continue")).click();
String text = wait.until(ExpectedConditions.visibilityOfElementLocated(message)).getText();
// "Error: First Name is required"
\`\`\`

The trap: checking \`findElements(banner).isEmpty()\` to assert "no error". The banner is **always present**, just hidden — presence is not visibility. Assert \`invisibilityOfElementLocated\` or \`!isDisplayed()\` instead.

### Strategies for dynamic elements compared

| Strategy | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| Test id | contract attribute | most stable, intention-revealing | needs dev change | always the target state |
| Stable prefix/suffix (\`^=\`, \`starts-with\`) | match the invariant part of a generated id | quick, no dev change | breaks if prefix not unique or format changes | generated ids with meaningful prefixes |
| Anchor + text/structure | stable container or label, short relative path | readable, robust to id churn | breaks on copy changes; i18n | buttons by label, rows by business key |
| Re-locate after re-render | keep \`By\`, wait for render, find again | removes stale errors at the root | must know the render signal | SPAs, tables, filters |
| Bounded stale retry | retry the read a few times | cheap safety net | hides design problems if overused | read-only helpers |
| Scroll-and-search | step the container, search each time | only option for virtualised lists | slower, needs end detection | virtualised/infinite lists |
| Relative locator | geometry from a stable anchor | no ids needed | layout-dependent, slower | temporary, until a test id exists |

**Recommended approach and why:** fix the anchor, not the symptom. Prefer test ids; meanwhile anchor on stable containers and business keys, keep \`By\`s instead of elements across re-renders and wait for the render signal. Retries and relative locators are tactical tools with a ticket attached.

## Relative locators internals

\`RelativeLocator.with(By)\` builds a special \`By\`. When you call \`findElement\`, the Java bindings send **one \`executeScript\`** containing a bundled JavaScript atom with the root locator, the anchor element(s) and the filters (\`above\`, \`below\`, \`toLeftOf\`, \`toRightOf\`, \`near\`). In the page, the atom finds the candidates, reads each candidate's and anchor's \`getBoundingClientRect()\`, keeps those satisfying every filter, and sorts them by proximity to the anchor. \`findElement\` returns the closest.

Limitations that follow from "it is geometry":

- **Layout-dependent**: window size, responsive breakpoints, zoom, fonts and sticky elements change the result. Headless at the default small window often flips "to the right of" into "below".
- **Only rendered boxes**: hidden or zero-size elements have empty rects; off-screen elements still have rects but scrolling or virtualisation changes what exists.
- **\`near\`** uses a distance threshold (50 px by default; there is an overload taking a distance).
- **Edge semantics**: "above" means the candidate's box is entirely above the anchor's top edge; overlapping elements may be in no direction.
- **Cost**: one script per lookup plus layout reads — fine occasionally, noticeable in loops.
- Combine filters (\`.below(a).toLeftOf(b)\`) and a meaningful root (\`with(By.tagName("button"))\` is weaker than \`with(By.cssSelector("#user-cards button"))\`).

## ByChained, ByAll and ByIdOrName vs nested findElement vs one XPath

\`org.openqa.selenium.support.pagefactory\` has three composite locators that also work outside PageFactory:

\`\`\`java
import org.openqa.selenium.By;
import org.openqa.selenium.support.pagefactory.ByAll;
import org.openqa.selenium.support.pagefactory.ByChained;
import org.openqa.selenium.support.pagefactory.ByIdOrName;

// ByChained: each locator searches INSIDE the results of the previous one (AND, descending)
By ordersTrack = new ByChained(By.id("order-list"), By.cssSelector("li"), By.cssSelector("button"));

// ByAll: elements matching ANY of the locators (OR) — e.g. during a migration of test ids
By anyError = new ByAll(TestId.of("error"), By.cssSelector(".error-banner"));

// ByIdOrName: id first, then name
By username = new ByIdOrName("user-name");

// Nested findElement: explicit scope, explicit steps
WebElement orderRow = driver.findElement(By.xpath("//ul[@id='order-list']/li[span[.='ORD-1043']]"));
WebElement track = orderRow.findElement(By.cssSelector("button"));

// One XPath: the whole relation evaluated in the browser in one command
By trackOneShot = By.xpath("//ul[@id='order-list']/li[span[@class='order-id']='ORD-1043']//button");
\`\`\`

| | \`ByChained\` | \`ByAll\` | Nested \`findElement\` | One XPath/CSS |
|---|---|---|---|---|
| How it works | client-side: findElements per step, then within each result | client-side: runs every locator, collects the results | one command per level, element references in between | single browser-side evaluation |
| Round trips | many (grows with matches per level) | one per locator | one per level | one |
| Text/conditions | no (only descending) | no | yes, in Java between steps | yes (XPath) |
| Stale risk | low (one call), but results can repeat | low | between levels, if the DOM re-renders | none between steps |
| Readability | declarative, but opaque in failure messages | expresses "either of" | very clear, debuggable step by step | dense if long |
| When to use | rarely — legacy PageFactory | migrations, A/B variants | page components (a row object holding its root) | default for one-off relations |

**Recommended approach and why:** one anchored XPath or CSS for a single lookup (one round trip, atomic), and **component objects with a root element** (nested \`findElement\`) when a piece of UI is reused — a \`ProductCard\` or \`EmployeeRow\` that owns its root \`By\` and searches inside it. \`ByAll\` is a useful, explicit migration tool; \`ByChained\` rarely beats a single selector.

## Validating locators quickly

In Chrome/Edge DevTools **Console** (these are console utilities, not page APIs):

\`\`\`
$x("//table[@id='employee-table']/tbody/tr[td[1][normalize-space()='Priya Sharma']]//button")   // XPath → array
$$("#order-actions button[id^='submit-order-']")                                                 // CSS → array
$("#checkout-error-message")                                                                     // first CSS match
$x("//div[@id='promo-banner'][contains(text(),'BRIGHT25')]").length                             // 0 — the text() trap
\`\`\`

In the **Elements** panel, Ctrl+F accepts plain text, CSS and XPath and shows "1 of N" — the fastest uniqueness check. Firefox has \`$x\` and \`$$\` in its console too. Re-check after **reload** (generated ids), after **sorting/filtering** (re-ordered lists), at the **CI window size**, and in each **state** (empty cart vs items).

A uniqueness guard in the framework catches locators that silently match several elements (where \`findElement\` would just take the first):

\`\`\`java
public static WebElement findUnique(SearchContext context, By by) {
    List<WebElement> found = context.findElements(by);
    if (found.size() != 1) {
        throw new IllegalStateException("Expected exactly 1 element for " + by + " but found " + found.size());
    }
    return found.get(0);
}
\`\`\`

Use it in development and in a locator "smoke" test, not on every call in a hot path (it is the same round trip as \`findElement\`, but it does not benefit from the implicit wait and turns "several" into a failure — which is the point).

## Common mistakes and debugging

- **\`InvalidSelectorException\` from a valid-looking XPath** — it uses XPath 2.0 (\`ends-with\`, \`matches\`, \`lower-case\`), or returns attributes/text (\`//a/@href\`). Test it with \`$x\` in the console; replace with \`substring\`/\`translate\` or read the attribute in Java.
- **Clicked the wrong row** — \`row.findElement(By.xpath("//button"))\` without the dot, or a positional \`[1]\` that binds to the step instead of the whole path. Count matches in DevTools and add \`.\`/parentheses.
- **Text locator works in Chrome but not in Firefox** — whitespace, \`text()\` vs \`.\`, or \`linkText\` with CSS text-transform. Use \`normalize-space(.)\` and avoid \`linkText\` for styled links.
- **\`StaleElementReferenceException\` after sorting or paging** — a cached \`WebElement\` across a re-render. Keep \`By\`s, wait for the render signal, return data from page methods.
- **Assertion passes but the element is "the other one"** — a locator matching several elements (promo banner price vs card price). Scope to the container and add a uniqueness check.
- **\`:has()\` works locally, fails on Grid** — older browser image. Check node browser versions or use XPath.

## Best practices for experienced engineers

- Agree a test-id contract with developers; centralise how test ids are built (\`TestId.of\`).
- Every locator: one stable anchor, a short explicit path, a business key for lists; no absolute paths, generated ids or layout classes.
- Locators are private to page/component objects; tests call intention methods (\`inventory.addToCart("Junior Onesie")\`).
- Keep \`By\`s, not \`WebElement\`s, across actions; return data, not elements.
- XPath for text and relations, CSS for attributes and structure; both scoped.
- Validate in DevTools at CI window size and in every relevant state; add a uniqueness check in a locator smoke test.
- Relative locators, \`ByChained\` and stale retries are tactical — attach a ticket for the real fix.

## Playwright (TypeScript) equivalent

Playwright locators are lazy and re-resolved on every action, so stale references do not exist, and user-facing locators replace most XPath:

\`\`\`typescript
await page.getByTestId('inventory-item')
  .filter({ has: page.getByRole('link', { name: 'Junior Onesie', exact: true }) })
  .getByRole('button', { name: 'Add to cart' })
  .click();

await page.locator('#employee-table tbody tr')
  .filter({ has: page.locator('td').first().getByText('Priya Sharma', { exact: true }) })
  .getByRole('button', { name: 'Edit' })
  .click();
\`\`\`

Playwright also has strictness (a locator matching several elements fails an action), text and role engines, and pierces open shadow DOM with CSS by default — the equivalents of the policies above, built in.

## Interview questions

### Q: How does Selenium evaluate By.id, and why does it matter?

**Short answer (30–60 s):** W3C WebDriver has only five strategies — css selector, link text, partial link text, tag name and xpath. The Java bindings translate \`By.id\`, \`By.name\` and \`By.className\` into CSS selectors (\`#id\`, \`*[name='...']\`, \`.class\`) with escaping, and the driver evaluates them with \`querySelectorAll\` in the current context, returning the first match in document order.

**Detailed answer:** It explains scoping (from an element, \`By.id\` only searches descendants), why hand-written \`#order:42\` fails while \`By.id("order:42")\` works, why \`By.className\` takes a single class, why implicit wait polling happens in the driver, and why XPath returning attributes throws \`InvalidSelectorException\`.

### Q: What is the difference between //a[1] and (//a)[1]?

**Short answer (30–60 s):** In \`//a[1]\` the predicate belongs to the step: every \`a\` that is the first \`a\` child of its parent — can be many. \`(//a)[1]\` takes the whole result set and returns its first node in document order — exactly one.

**Detailed answer:** On ShopEasy's inventory \`//div[@id='inventory-list']//a[@class='item-name'][1]\` matches all six product links because each sits alone in its \`item-body\`. Add that predicates apply left to right (\`[cond][2]\` vs \`[2][cond]\`), that reverse axes count from the nearest node, and that positions encode sort order, which is why positional locators are fragile.

### Q: text() versus . in XPath?

**Short answer (30–60 s):** \`text()\` selects the element's own direct text nodes; \`.\` is the element's string value — all descendant text concatenated. \`contains(text(),'x')\` in XPath 1.0 only checks the first text node, so it misses text after a child element.

**Detailed answer:** Show the promo banner: \`contains(text(),'BRIGHT25')\` fails because the code is inside \`<code>\`; \`contains(.,'BRIGHT25')\` works but also matches every ancestor div unless anchored. Recommend \`normalize-space(.)\` with an anchor, and \`text()[contains(.,'x')]\` when only own text should match.

### Q: When would you choose XPath over CSS?

**Short answer (30–60 s):** XPath when I need text, a parent/ancestor, preceding/following relations, counts or complex conditions; CSS for attributes, classes and structure because it is shorter and works from shadow roots. Both are native and fast; scope and round trips matter more than the language.

**Detailed answer:** Mention XPath 1.0 limits (no \`ends-with\`, case functions — use \`substring\`/\`translate\`), CSS's \`:has()\` narrowing the gap but with browser-version requirements, and the policy order test id → id/name → CSS → anchored XPath → relative locator.

### Q: How do you handle elements with dynamic ids?

**Short answer (30–60 s):** First classify: random suffix, state-dependent id, or re-rendered element. Then anchor on the invariant: a unique prefix (\`^=\`/\`starts-with\`), a stable container plus label, a business key, or a data attribute — and raise a testability ticket for a test id.

**Detailed answer:** Show \`dynamic.html\` (\`submit-order-\` prefix unique, \`btn-\` prefix not), ShopEasy's add/remove id flip handled with \`data-slug\`, and keeping \`By\`s across re-renders. Explain why relative locators are a temporary fix.

### Q: How do relative locators work internally, and what are their limitations?

**Short answer (30–60 s):** One \`executeScript\` with a JavaScript atom: it finds candidates for the root locator, compares their bounding client rects with the anchor's, filters by direction and sorts by distance. So they depend on layout and are slower than a plain selector.

**Detailed answer:** Window size and responsive breakpoints change results; hidden elements have no box; \`near\` has a distance threshold; strict edge semantics; cost in loops. Use with a specific root locator and combined filters, and only until a stable hook exists.

### Q: ByChained vs ByAll vs a single XPath?

**Short answer (30–60 s):** \`ByChained\` is AND/descending, evaluated in Java with several round trips; \`ByAll\` is OR, running each locator; a single XPath/CSS evaluates the relation in one command. I default to a single anchored selector or a component object with a root; \`ByAll\` for migrations.

**Detailed answer:** Compare round trips, stale windows between steps, the inability to express text conditions in \`ByChained\`, and readability of failure messages. Component objects (root + inner lookups) scale best for reused UI.

### Q: How would you introduce a locator policy in a team?

**Short answer (30–60 s):** Agree on a test attribute with developers, define naming and uniqueness rules, make it part of the definition of done, centralise test-id building in the framework, and review locators like code.

**Detailed answer:** Add measurable steps: a lint or PR check on the front-end, a list of untestable components as tickets, a locator smoke test that checks uniqueness on key pages, and a migration plan using \`ByAll\` while old and new hooks coexist. Discuss whether test ids ship to production.

## Scenario-based questions

**1. After a front-end framework upgrade, 300 tests fail with NoSuchElementException.** I would sample failures and group them by locator type. If most are generated ids or layout classes, the root cause is locator strategy: I would agree test ids for the top pages with the front-end lead, introduce \`TestId.of\`, use \`ByAll\` to support old and new hooks during the transition, and fix pages in order of test count. I would not patch 300 locators one by one with longer XPaths.

**2. A table test passes locally and fails on CI with StaleElementReferenceException.** CI is slower, so the re-render after sorting lands between our lookup and our read. I would check whether the page object caches row elements across the sort, change it to return data and re-locate via \`By\`, and add a wait on a render signal (\`#row-count\` or staleness of the old first row). Retrying would only make it pass more often.

**3. The product grid becomes a virtualised list with 5,000 items.** Index-based and "find all" approaches stop working. I would locate items through the app's search box or a filtered URL, keep a scroll-and-search helper for the rare cases where scrolling is the behaviour under test, identify rows by data attributes, and move data-heavy checks (sorting of 5,000 items) to the API layer.

## Tricky follow-ups

- **Q: Does \`findElement(By.id(...))\` from a WebElement search the whole page?** No — it is CSS evaluated with the element as the start node, so only descendants. XPath without a leading dot is the one that escapes to the document.
- **Q: Can a CSS selector select by text?** No; \`:contains\` is jQuery, not CSS. Use XPath or filter in Java.
- **Q: Why does \`$x\` find it but Selenium does not?** Usually a frame or shadow root (the console runs in the selected context), a hidden-vs-present difference in the wait condition, or timing.
- **Q: Is \`contains(@class,'btn')\` safe?** No — it matches \`btn-primary\`, \`btn-sm\`. Use \`concat(' ', normalize-space(@class), ' ')\` with a padded token, or CSS \`.btn\`.
- **Q: Which is faster, CSS or XPath?** In modern browsers both are native and the difference is rarely measurable against the HTTP round trip; scope and the number of commands decide.`,
  keyPoints: [
    'W3C has five locator strategies; By.id, By.name and By.className are translated to CSS by the Java bindings and evaluated by the driver in the current context.',
    'XPath in browsers is 1.0 only: emulate ends-with with substring and case-insensitivity with translate; //x[1] binds to the step, (//x)[1] to the whole result.',
    'text() is the element\'s own text nodes, . is all descendant text — anchor text searches and use normalize-space(.).',
    'CSS gives attribute operators (^= $= *= ~= |=), nth-child vs nth-of-type and :has(), but cannot select by text; check :has() support on Grid browser versions.',
    'Locator policy: data-testid contract first, then stable id/name, scoped CSS, anchored XPath; never generated ids, layout classes or positions.',
    'Dynamic elements: anchor on invariants, keep By instead of WebElement across re-renders, locate list items by business key, scroll-and-search for virtualised lists.',
    'Relative locators are a JavaScript geometry atom — layout-dependent and slower; ByChained/ByAll are client-side compositions with more round trips than one selector.',
    'Validate locators in DevTools ($x, $$, Ctrl+F) after reload, sorting and at CI window size, and guard uniqueness in a locator smoke test.',
  ],
  mistakes: [
    'Using contains(text(),\'...\') for text that sits after a child element (or uses XPath 2.0 functions) and getting no match or InvalidSelectorException. Fix: use contains(normalize-space(.),\'...\') on an anchored element, test it with $x() in the console, emulate ends-with with substring.',
    'Positional locators such as (//div[@data-testid=\'inventory-item\'])[2] on a list that the app sorts. Fix: locate by business key (product name, order id) and assert ordering separately by reading all names in one findElements.',
    'Caching WebElements in page objects across actions that re-render (table sort, filter, pagination), then retrying on StaleElementReferenceException. Fix: keep By locators, wait for a render signal, return data from page methods.',
    'Prefix matching on a non-unique prefix ([id^=\'btn-\'] matches two buttons on dynamic.html), so findElement silently takes the first. Fix: count matches in DevTools, combine prefix with a container and label, and request a test id.',
    'Asserting "no error" with findElements(banner).isEmpty() when the banner is always in the DOM with the hidden attribute. Fix: assert invisibility, not absence.',
    'Rolling out :has() selectors that pass locally but throw invalid selector on older Grid browser images. Fix: check node browser versions or fall back to XPath.',
  ],
  tryIt: `On ShopEasy (\`http://localhost:5180/practice-site/\`): (1) In DevTools on \`inventory.html\` compare \`$x("//div[@id='inventory-list']//a[@class='item-name'][1]").length\` with \`$x("(//div[@id='inventory-list']//a[@class='item-name'])[1]").length\`, then change the sort and see which product the second one returns. (2) Prove the \`text()\` trap on \`#promo-banner\` with \`BRIGHT25\`. (3) Write an \`InventoryPage.priceOf(String name)\` and \`addToCart(String name)\` built on a card-by-name locator with \`XPathLiterals.literal\`; then switch the sort to "Price (high to low)" and prove they still work. (4) On \`table.html\`, write \`EmployeeTable.valueOf(String employee, String sortKey)\` using the \`count(preceding-sibling::th)+1\` technique, sort by Department, and show that the method still returns the right value while a cached cell reference goes stale. (5) On \`dynamic.html\`, reload five times and confirm with \`$$\` that your "Place order" and "Save for later" locators are unique every time.`,
  problems: ['sel-017', 'sel-015', 'sel-030', 'sel-016'],
}
