export default {
  slug: 'pom-deep-components-and-reusable-methods',
  category: 'pom',
  order: 12,
  title: 'Deep dive: component-based POM at scale and designing reusable methods',
  minutes: 30,
  summary: 'Build a component library instead of ever-growing pages — a Component base with fixed, lazy and nested roots, ProductCard, a generic DataTable, a typed ListComponent<T>, header, cart line, dropdown, modal and toast — compose them into pages, and design methods that stay reusable: granularity, naming, parameters, return types, idempotent helpers, where waits live, what belongs in a component vs a utility vs a flow, plus a duplication audit, a data-testid contract with the design system, browser-free unit tests and the Playwright equivalent.',
  manualAnalogy: `A good manual test plan does not describe the date picker again in every test case; it says "pick 12 March in the date picker" and trusts that everyone knows how the date picker works. The UI team thinks the same way: they build a date picker, a product card and a data table once and drop them into many screens. Component-based POM mirrors that: you describe each widget once, and every screen that uses it gets the same reliable behaviour.`,
  body: `## Where the earlier lessons stop

The *BasePage and components* lesson (lesson 5) introduced components with a root element, the header component and dialogs; the *Dynamic locators and web tables* lesson (lesson 7) built table lookups by header text and paging with \`stalenessOf\`. \`java-deep-oop-and-solid\` explained composition vs inheritance (\`BasePage\` vs \`HeaderComponent\`), and \`selenium-deep-framework-design\` covered the action layer and locator management. The previous deep dive, \`pom-deep-variants-pagefactory-loadable\`, compared POM styles and recommended By locators plus components.

This lesson builds that recommendation **at scale**: a component library with a real base class, generic components, typed lists, and the design rules for methods that remain reusable across hundreds of tests.

## Why pages are the wrong unit for modern UIs

Page objects map to **what the user sees at a URL**. Modern front ends are built from **components** — a design system ships a Button, Card, DataTable, Modal, Toast, Combobox, and screens are compositions of them. When test code is organised only by page:

| Symptom | Cause |
|---|---|
| The cart badge locator lives in 9 page classes | the header is on every page; each page re-declares it |
| \`InventoryPage\` has 70 methods, \`SearchResultsPage\` 60, half of them identical | product cards appear on both screens |
| A design-system release breaks 40 page classes in the same way | the same widget's markup is encoded 40 times |
| Two "same" methods behave differently (\`addToCart\` waits on one page, not on the other) | copies drifted |
| New pages take days | nothing is reusable below page level |

The cost model is simple: **every repeated widget encoded N times costs N fixes per markup change**. Components reduce it to one. Pages remain — but as thin compositions: identity check, page-specific elements, and accessors for their components.

\`\`\`
InventoryPage                         CartPage
 ├─ HeaderComponent      (shared) ─┐   ├─ HeaderComponent
 ├─ Dropdown (sort)                │   ├─ ListComponent<CartLine>
 └─ ListComponent<ProductCard>     │   └─ buttons: continue / checkout
        └─ ProductCard × 6         │
                                   └─ one class, one place to fix
\`\`\`

## Component anatomy: root, scope, lifetime

A component is defined by three decisions:

1. **Root** — the element that contains everything the component owns.
2. **Scope** — all lookups happen *inside* the root, so a card's \`.item-price\` can never read the promo banner's price.
3. **Lifetime** — how the root reference is obtained: once, or again on every use.

### The root is a \`SearchContext\`

\`WebDriver\`, \`WebElement\` and \`ShadowRoot\` (from \`getShadowRoot()\`) all implement \`SearchContext\` — the interface with \`findElement\`/\`findElements\`. A component that searches through a \`SearchContext\` works the same on a page, inside another component, or inside a shadow root (ShopEasy's \`dynamic.html\` has a \`coupon-widget\` with a shadow root). Note the CSS-only restriction for shadow roots in Chromium: XPath does not work from a \`ShadowRoot\` context.

### Root strategies and staleness

| Strategy | How the root is obtained | Stale risk | Cost | Use for |
|---|---|---|---|---|
| **Fixed \`WebElement\`** | passed in once (an item from \`findElements\`) | high if the container re-renders | none per call | list items read immediately after fetching |
| **Lazy \`By\` from the page** | \`driver.findElement(rootBy)\` on every access | none (re-found each time) | one extra lookup per call | singletons: header, modal, table, a card *by name* |
| **Lazy \`By\` inside a parent** | \`parent.root().findElement(rootBy)\` on every access | none | one lookup per nesting level per call | nested components: pagination inside a table widget |
| **PageFactory proxy root** | proxy re-finds | none for the root | hidden lookups, reflection | legacy PageFactory suites (previous deep dive) |
| **Playwright \`Locator\`** | lazy by design, re-resolved on every action | none | built in | Playwright — see below |

ShopEasy shows why the choice must be **per component, informed by how the app renders** — open DevTools and watch which nodes are replaced:

- \`inventory.html\` **sorting** re-appends the *same* card nodes in a new order — fixed card roots survive.
- **Add to cart** on a card changes the button's \`id\`, \`data-testid\` and text *in place* — still the same node.
- \`cart.html\` **Remove** calls \`render()\`, which empties \`#cart-list\` and rebuilds every line — all fixed \`CartLine\` roots go stale.
- \`table.html\` **search, sort and paging** rebuild \`tbody\` — fixed row roots go stale.
- The **cart badge** is created when the count becomes 1 and removed at 0 — never cache it.

A senior does not guess; they check the rendering behaviour once per widget and pick the strategy (and, when in doubt, the lazy one).

## The component library core

### \`Component\`: the base class

\`\`\`java
package com.shopeasy.framework.components;

import java.time.Duration;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.FluentWait;

public abstract class Component {
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration POLLING = Duration.ofMillis(200);

    protected final WebDriver driver;
    private final Supplier<WebElement> rootSupplier;
    private final String description;

    /** Lazy root: re-found on the page on every access. */
    protected Component(WebDriver driver, By rootLocator, String description) {
        this(driver, () -> driver.findElement(rootLocator), description);
    }

    /** Fixed root: an element already found, e.g. one item of a list. */
    protected Component(WebDriver driver, WebElement root, String description) {
        this(driver, () -> root, description);
    }

    /** Nested lazy root: re-found inside the parent's (also lazy) root on every access. */
    protected Component(Component parent, By rootLocator, String description) {
        this(parent.driver, () -> parent.root().findElement(rootLocator),
                parent.description + " > " + description);
    }

    private Component(WebDriver driver, Supplier<WebElement> rootSupplier, String description) {
        this.driver = driver;
        this.rootSupplier = rootSupplier;
        this.description = description;
    }

    protected WebElement root() {
        try {
            return rootSupplier.get();
        } catch (NoSuchElementException e) {
            throw new NoSuchElementException(description + " is not on the page", e);
        }
    }

    protected WebElement find(By inside) {
        return root().findElement(inside);
    }

    protected List<WebElement> findAll(By inside) {
        return root().findElements(inside);
    }

    protected boolean has(By inside) {
        return !findAll(inside).isEmpty();
    }

    /**
     * Polls a condition against a freshly obtained root. Missing or stale elements mean "not yet".
     * Returns when the condition gives a non-null value that is not Boolean.FALSE.
     */
    protected <T> T waitUntil(String expectation, Function<WebElement, T> condition) {
        return waitUntil(expectation, condition, DEFAULT_TIMEOUT);
    }

    protected <T> T waitUntil(String expectation, Function<WebElement, T> condition, Duration timeout) {
        return new FluentWait<>(this)
                .withTimeout(timeout)
                .pollingEvery(POLLING)
                .ignoring(NoSuchElementException.class)
                .ignoring(StaleElementReferenceException.class)
                .withMessage(() -> description + ": waiting for " + expectation)
                .until(component -> condition.apply(component.root()));
    }

    public boolean isDisplayed() {
        try {
            return root().isDisplayed();
        } catch (NoSuchElementException | StaleElementReferenceException e) {
            return false;
        }
    }

    protected static boolean isStale(WebElement element) {
        try {
            element.isEnabled();                 // any cheap call on the old reference
            return false;
        } catch (StaleElementReferenceException e) {
            return true;
        }
    }

    /** Static text only: loggers, debuggers and failure messages call toString. */
    @Override
    public String toString() {
        return description;
    }
}
\`\`\`

Step by step:

1. **One private constructor, three public strategies.** The \`Supplier<WebElement>\` is the whole lifetime decision; subclasses pick fixed, lazy or nested without knowing how it is implemented.
2. **\`root()\` translates failures into the component's language** — "product card 'Pulse Bike Light' is not on the page" instead of an XPath dump. The original exception stays as the cause.
3. **Lookups are always relative to the root** (\`find\`, \`findAll\`, \`has\`). Subclasses never touch \`driver.findElement\` for their own parts; \`driver\` is there to create the pages a component navigates to.
4. **\`waitUntil\` lives in the component**, takes a human-readable expectation and re-obtains the root on every poll. For lazy roots that makes the wait immune to re-renders. In a full framework this delegates to the shared \`Waiter\` from \`selenium-deep-synchronization\` (same timeouts, same logging); \`FluentWait<Component>\` here keeps the example self-contained.
5. **\`toString\` is static.** The description is fixed at construction — never \`getText()\` in \`toString\`, it would hit the browser whenever a log line or a debugger formats the object.

### \`ProductCard\`

\`\`\`java
package com.shopeasy.framework.components;

import java.math.BigDecimal;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class ProductCard extends Component {
    static final By ROOTS = By.cssSelector("[data-testid='inventory-item']");
    private static final String ROOT_BY_NAME =
            "//div[@data-testid='inventory-item'][.//a[normalize-space()='%s']]";

    private static final By NAME = By.cssSelector(".item-name");
    private static final By PRICE = By.cssSelector(".item-price");
    private static final By CART_BUTTON = By.cssSelector("button.btn-inventory");
    private static final String ADD_BUTTON = "[data-testid='add-to-cart-%s']";
    private static final String REMOVE_BUTTON = "[data-testid='remove-%s']";

    /** Fixed root: used by ListComponent for "all cards right now". */
    public ProductCard(WebDriver driver, WebElement root) {
        super(driver, root, "product card");
    }

    /** Lazy root by business key: survives any re-render. */
    private ProductCard(WebDriver driver, String productName) {
        super(driver, By.xpath(String.format(ROOT_BY_NAME, productName)),
                "product card '" + productName + "'");
    }

    public static ProductCard named(WebDriver driver, String productName) {
        return new ProductCard(driver, productName);
    }

    public String name() {
        return find(NAME).getText().trim();
    }

    public BigDecimal price() {
        return Prices.parse(find(PRICE).getText());
    }

    public String slug() {
        return find(CART_BUTTON).getDomAttribute("data-slug");
    }

    public boolean isInCart() {
        return has(By.cssSelector(String.format(REMOVE_BUTTON, slug())));
    }

    /** Strict: the button toggles, so a second click would REMOVE the product. */
    public ProductCard addToCart() {
        String slug = slug();
        if (isInCart()) {
            throw new IllegalStateException(this + " is already in the cart");
        }
        find(By.cssSelector(String.format(ADD_BUTTON, slug))).click();
        waitUntil("the button to switch to Remove",
                root -> !root.findElements(By.cssSelector(String.format(REMOVE_BUTTON, slug))).isEmpty());
        return this;
    }

    /** Idempotent: safe in setup code that does not know the current state. */
    public ProductCard ensureInCart() {
        return isInCart() ? this : addToCart();
    }

    public ProductCard removeFromCart() {
        String slug = slug();
        find(By.cssSelector(String.format(REMOVE_BUTTON, slug))).click();
        waitUntil("the button to switch back to Add to cart",
                root -> !root.findElements(By.cssSelector(String.format(ADD_BUTTON, slug))).isEmpty());
        return this;
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.components;

import java.math.BigDecimal;

/** Pure text → value conversion; no WebDriver, unit-testable. */
public final class Prices {
    private Prices() {}

    public static BigDecimal parse(String text) {
        return new BigDecimal(text.replace("$", "").replace(",", "").trim());
    }
}
\`\`\`

Step by step:

1. **Two ways in**: \`new ProductCard(driver, root)\` for list items (fast, fixed root — fine on ShopEasy's inventory, whose cards are never replaced) and \`ProductCard.named(driver, name)\` with a lazy root found by the business key — the right default for "do something with *this* product".
2. **Test ids with the slug** (\`add-to-cart-<slug>\` / \`remove-<slug>\`) are the contract the app offers; the slug is read from the card (\`data-slug\`), so tests speak in product **names**, not slugs.
3. **State is read from the contract, not from the label**: \`isInCart()\` checks for the \`remove-<slug>\` test id instead of comparing the text "Remove" — a copy change or translation would not break it.
4. **The wait is inside the action.** After the click, \`addToCart()\` waits for the observable result on *this* card. Callers never need to know that the button re-labels itself.
5. **Strict vs idempotent** are two methods on purpose: tests that *test* adding use the strict one (a second add is a bug in the test); setup code uses \`ensureInCart()\`.

### \`ListComponent<T>\`: typed lists from a factory function

\`\`\`java
package com.shopeasy.framework.components;

import java.time.Duration;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.FluentWait;

public final class ListComponent<T extends Component> {
    private final Supplier<List<WebElement>> roots;
    private final Function<WebElement, T> factory;
    private final String description;

    public ListComponent(WebDriver driver, By itemLocator, Function<WebElement, T> factory, String description) {
        this(() -> driver.findElements(itemLocator), factory, description);
    }

    /** Items inside a parent component, e.g. lines inside a cart widget. */
    public static <T extends Component> ListComponent<T> inside(Component parent, By itemLocator,
                                                               Function<WebElement, T> factory, String description) {
        return new ListComponent<>(() -> parent.findAll(itemLocator), factory, parent + " > " + description);
    }

    private ListComponent(Supplier<List<WebElement>> roots, Function<WebElement, T> factory, String description) {
        this.roots = roots;
        this.factory = factory;
        this.description = description;
    }

    /** A fresh snapshot on every call — never keep the result across actions that re-render. */
    public List<T> items() {
        return roots.get().stream().map(factory).toList();
    }

    public int size() {
        return roots.get().size();
    }

    public boolean isEmpty() {
        return size() == 0;
    }

    public T first(Predicate<? super T> matcher, String what) {
        List<T> snapshot = items();
        return snapshot.stream()
                .filter(matcher)
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException(
                        description + ": no item " + what + " among " + snapshot.size() + " items"));
    }

    public <R> List<R> read(Function<? super T, ? extends R> reader) {
        return items().stream().<R>map(reader).toList();
    }

    public ListComponent<T> waitForSize(int expected, Duration timeout) {
        new FluentWait<>(roots)
                .withTimeout(timeout)
                .pollingEvery(Duration.ofMillis(200))
                .withMessage(() -> description + ": waiting for " + expected + " items")
                .until(r -> r.get().size() == expected);
        return this;
    }

    @Override
    public String toString() {
        return description;
    }
}
\`\`\`

Step by step:

1. **\`Function<WebElement, T>\` is the whole extension mechanism.** \`root -> new ProductCard(driver, root)\` and \`root -> new CartLine(driver, root)\` reuse one list class — no reflection, no annotations, compile-time types. Generic bound \`T extends Component\` keeps it to things with a root.
2. **\`items()\` is a fresh snapshot** each call. The class deliberately has no cache: a list that remembers items is a \`@CacheLookup\` in disguise.
3. **\`first(matcher, what)\`** turns "not found" into a domain message with the item count — "inventory product cards: no item named 'Trail Runner' among 6 items" tells you at once whether the list was empty or the name wrong.
4. **\`read(...)\`** expresses the most common use — read one property from every item (\`products.read(ProductCard::price)\`) — and returns plain values a test can assert on.
5. **\`inside(parent, …)\`** scopes the item search to a component (\`findAll\` is \`protected\`, which includes access from the same package — \`ListComponent\` lives next to \`Component\`), so two lists on one page can never mix items.
6. \`ProductCard::name\` is a method reference to a \`Function<ProductCard, String>\`, which fits \`Function<? super T, ? extends R>\` — the wildcards let callers pass readers declared on a supertype.

### \`DataTable\`: generic, header-driven, page-aware

\`\`\`java
package com.shopeasy.framework.components;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class DataTable extends Component {
    private static final By HEADER_CELLS = By.cssSelector("thead th");
    private static final By BODY_ROWS = By.cssSelector("tbody tr");
    private static final By CELLS = By.tagName("td");

    private final By nextPage;            // on table.html the pager sits outside the <table>

    public DataTable(WebDriver driver, By tableLocator, By nextPageLocator, String description) {
        super(driver, tableLocator, description);
        this.nextPage = nextPageLocator;
    }

    public List<String> columns() {
        return findAll(HEADER_CELLS).stream()
                .map(th -> TableModel.headerName(th.getText()))
                .toList();
    }

    public int columnIndex(String header) {
        int index = columns().indexOf(header);
        if (index < 0) {
            throw new NoSuchElementException(this + ": no column '" + header + "' in " + columns());
        }
        return index;
    }

    /** Rows of the current page as header → text. Retries the whole read if the body re-renders mid-way. */
    public List<Map<String, String>> rows() {
        return waitUntil("a consistent read of the rows", root -> {
            List<String> headers = root.findElements(HEADER_CELLS).stream()
                    .map(th -> TableModel.headerName(th.getText()))
                    .toList();
            List<List<String>> cells = root.findElements(BODY_ROWS).stream()
                    .map(tr -> tr.findElements(CELLS).stream().map(td -> td.getText().trim()).toList())
                    .toList();
            return TableModel.toRecords(headers, cells);
        });
    }

    public Optional<Map<String, String>> rowWhere(String column, String value) {
        return rows().stream().filter(r -> value.equals(r.get(column))).findFirst();
    }

    /** Clicks a control inside the row whose column has the value; for page objects, not tests. */
    public void clickInRow(String column, String value, By control) {
        int col = columnIndex(column);
        WebElement row = findAll(BODY_ROWS).stream()
                .filter(tr -> {
                    List<WebElement> tds = tr.findElements(CELLS);
                    return tds.size() > col && value.equals(tds.get(col).getText().trim());
                })
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException(this + ": no row with " + column + " = " + value));
        row.findElement(control).click();
    }

    /** Reads every page from the current one onwards. */
    public List<Map<String, String>> rowsOnAllPages() {
        List<Map<String, String>> all = new ArrayList<>(rows());
        while (driver.findElement(nextPage).isEnabled()) {
            WebElement firstRowBefore = find(BODY_ROWS);
            driver.findElement(nextPage).click();
            waitUntil("the previous page's rows to be replaced", root -> isStale(firstRowBefore));
            all.addAll(rows());
        }
        return List.copyOf(all);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.components;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Pure table logic: header cleaning and row → record mapping. No WebDriver. */
public final class TableModel {
    private TableModel() {}

    /** "Salary ▲" → "Salary": the sort indicator span is part of the header text. */
    public static String headerName(String raw) {
        return raw.replace("▲", "").replace("▼", "").trim();
    }

    public static List<Map<String, String>> toRecords(List<String> headers, List<List<String>> rows) {
        List<Map<String, String>> records = new ArrayList<>();
        for (List<String> row : rows) {
            if (row.size() == 1) {
                continue;                                    // colspan placeholder: "No employees match…"
            }
            if (row.size() != headers.size()) {
                throw new IllegalStateException("Row has " + row.size() + " cells but table has "
                        + headers.size() + " columns: " + row);
            }
            Map<String, String> record = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                record.put(headers.get(i), row.get(i));
            }
            records.add(Collections.unmodifiableMap(record));
        }
        return List.copyOf(records);
    }
}
\`\`\`

Step by step:

1. **Header name → index** is computed from the live header, with the sort indicator (\`▲\`/\`▼\` inside \`.sort-indicator\`) stripped — the exact trap from lesson 7, solved once for every table.
2. **Rows become \`Map<String, String>\` records** keyed by header. Tests read \`row.get("Status")\`; column order changes break nothing.
3. **\`rows()\` reads inside \`waitUntil\`**: if \`tbody\` is rebuilt halfway through (a search keystroke on \`table.html\`), the stale exception is ignored and the *whole* read is retried — never half old, half new.
4. **The placeholder row** ("No employees match your search.", one cell with \`colspan\`) is skipped, but any other cell-count mismatch fails loudly: silently skipping malformed rows would hide real bugs.
5. **Paging** waits for the old first row to go stale — the precise "page replaced" signal. \`rowsOnAllPages()\` reads from the current page onwards; going to page 1 first is the page object's job (it knows the page buttons).
6. **Performance**: this reads every cell with one \`getText\` command — 5 rows × 5 columns ≈ 30 commands per page. For large tables a single \`executeScript\` that returns \`[[...cells...]]\` is 10–100× faster but bypasses visibility semantics (hidden text is returned). Start with WebDriver calls; switch per table when profiling says so.
7. **\`clickInRow\` takes a \`By\`** because \`DataTable\` is generic and its callers are page objects (\`EmployeeTablePage.edit("Priya Sharma")\` passes \`By.cssSelector(".btn-edit")\`). Tests never see a locator.

### The rest of the ShopEasy library (sketches)

**HeaderComponent** — lazy root, test ids only. The header has *two* ways to the cart: the plain "Cart" text link in the practice-pages nav and the cart icon (\`#shopping-cart-link\`, \`data-testid="shopping-cart-link"\`, \`aria-label="Cart"\`). \`By.linkText("Cart")\` matches the nav link, not the icon — always go through the test id.

\`\`\`java
public class HeaderComponent extends Component {
    private static final By ROOT = By.cssSelector("header.site-header");
    private static final By CART_LINK = By.cssSelector("[data-testid='shopping-cart-link']");
    private static final By BADGE = By.cssSelector("[data-testid='shopping-cart-badge']");
    private static final By LOGOUT = By.cssSelector("[data-testid='logout-link']");
    private static final By USER = By.cssSelector("[data-testid='logged-in-user']");

    public HeaderComponent(WebDriver driver) { super(driver, ROOT, "site header"); }

    public int cartCount() {                                 // badge is removed at 0 — absence means 0
        List<WebElement> badge = findAll(BADGE);
        return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim());
    }

    public HeaderComponent waitForCartCount(int expected) {
        waitUntil("cart badge to show " + expected, root -> cartCount() == expected);
        return this;
    }

    public String loggedInUser() { return find(USER).getText().trim(); }

    public CartPage openCart() { find(CART_LINK).click(); return new CartPage(driver); }

    public LoginPage logout() { find(LOGOUT).click(); return new LoginPage(driver); }
}
\`\`\`

**CartLine** — fixed root \`[data-testid='cart-item']\` with \`[data-testid='inventory-item-name']\`, \`[data-testid='inventory-item-price']\`, \`[data-testid='item-quantity']\` and \`button.cart-remove\`. Because Remove re-renders the whole \`#cart-list\`, \`remove()\` returns **\`void\`** (or the \`CartPage\`), never \`this\`: every other \`CartLine\` the caller holds is stale now, and the return type should not suggest otherwise. The page waits for the list to shrink (\`waitForSize(n - 1, …)\`).

**Dropdown** — one interface, two implementations, because the design system may change the widget without changing the test's intent:

\`\`\`java
public interface Dropdown {
    void choose(String visibleText);
    String selected();
    List<String> options();
}

/** Native <select>, e.g. #product-sort on inventory.html. */
public final class NativeDropdown extends Component implements Dropdown {
    public NativeDropdown(WebDriver driver, By select, String description) { super(driver, select, description); }
    public void choose(String visibleText) { new Select(root()).selectByVisibleText(visibleText); }
    public String selected() { return new Select(root()).getFirstSelectedOption().getText().trim(); }
    public List<String> options() {
        return new Select(root()).getOptions().stream().map(o -> o.getText().trim()).toList();
    }
}
\`\`\`

A custom combobox (not on ShopEasy; typical in design systems) implements the same interface with ARIA roles: click the \`[role='combobox']\` trigger, wait for the \`[role='listbox']\` (often rendered in a portal at the end of \`body\`, i.e. **outside** the component's root — find it via \`aria-controls\`, not inside the root), click the \`[role='option']\` with the text, wait for the listbox to close. Pages expose \`Dropdown\`, so swapping native for custom is one line in one page.

**Modal** — \`#confirm-modal\` on \`alerts.html\`: lazy root \`By.id("confirm-modal")\`, \`title()\` from \`#modal-title\`, \`confirm()\`/\`cancel()\` click \`#modal-confirm\`/\`#modal-cancel\` and then \`waitUntil("dialog to close", root -> !root.isDisplayed())\` before returning the page underneath — the overlay must be gone before the next click.

**Toast** — ShopEasy has none; in a design system it is usually \`role="status"\` with a test id such as \`toast\`, appears for a few seconds and disappears. The pitfalls are timing: read it **inside** the wait (\`waitUntil("a toast", root -> root.isDisplayed() ? root.getText() : null)\` — \`null\` means "keep polling", the text ends the wait) so it cannot vanish between "visible" and "getText", and offer \`waitUntilGone()\` because toasts often cover buttons in the bottom-right corner.

### Composition into a page, and a test

\`\`\`java
package com.shopeasy.pages;

import java.time.Duration;
import com.shopeasy.framework.components.HeaderComponent;
import com.shopeasy.framework.components.ListComponent;
import com.shopeasy.framework.components.ProductCard;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class InventoryPage {
    private static final By INVENTORY_LIST = By.id("inventory-list");
    private static final By CARD_ROOTS = By.cssSelector("[data-testid='inventory-item']");

    private final WebDriver driver;
    private final HeaderComponent header;
    private final ListComponent<ProductCard> products;

    public InventoryPage(WebDriver driver) {
        this.driver = driver;
        try {
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.and(
                    ExpectedConditions.urlContains("inventory.html"),
                    ExpectedConditions.visibilityOfElementLocated(INVENTORY_LIST)));
        } catch (TimeoutException e) {
            throw new IllegalStateException("Expected the inventory page but was on " + driver.getCurrentUrl(), e);
        }
        this.header = new HeaderComponent(driver);
        this.products = new ListComponent<>(driver, CARD_ROOTS,
                root -> new ProductCard(driver, root), "inventory product cards");
    }

    public HeaderComponent header() { return header; }

    public ListComponent<ProductCard> products() { return products; }

    public ProductCard product(String name) { return ProductCard.named(driver, name); }

    @Override
    public String toString() { return "InventoryPage"; }
}
\`\`\`

\`\`\`java
package com.shopeasy.tests;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import com.shopeasy.framework.components.ProductCard;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import org.testng.annotations.Test;

public class CartBadgeTest extends BaseTest {          // BaseTest/DriverManager as in lesson 8

    @Test
    public void addingTheTwoCheapestProductsShowsBadgeTwo() {
        InventoryPage inventory = new LoginPage(driver()).open()
                .loginAs("standard_user", "secret_sauce");

        List<String> cheapestTwo = inventory.products().items().stream()
                .sorted(Comparator.comparing(ProductCard::price))
                .limit(2)
                .map(ProductCard::name)
                .toList();

        cheapestTwo.forEach(name -> inventory.product(name).addToCart());

        assertEquals(inventory.header().waitForCartCount(2).cartCount(), 2, "cart badge");
        assertTrue(cheapestTwo.stream().allMatch(n -> inventory.product(n).isInCart()),
                "both cheapest products should show Remove: " + cheapestTwo);
        assertEquals(inventory.product("Junior Onesie").price(), new BigDecimal("7.99"));
    }
}
\`\`\`

Step by step:

1. **The page is thin**: identity check, two components, one factory method for a card by name. No product-specific methods, no badge parsing.
2. **The test reads like the acceptance criterion**: find the two cheapest, add them, badge shows 2, both cards show the removed state. With ShopEasy's data that is *Junior Onesie* ($7.99) and *Pulse Bike Light* ($9.99).
3. **Snapshot for reading, lazy-by-name for acting**: \`products().items()\` is used for an immediate read; actions go through \`product(name)\`, so a re-render between reading and clicking cannot break them.
4. **Assertions stay in the test**; components return values and wait for their own results (\`waitForCartCount\` returns the header, so the read happens after the wait).
5. \`LoginPage.open().loginAs(...)\` is the fluent login from lesson 3; in a real suite this test would arrange login via session seeding and start on \`inventory.html\` (lesson 10).

## Designing reusable methods

Components give reuse *of structure*. Whether methods stay reusable depends on a handful of design rules.

### Granularity: atomic vs business-level

| Level | Example | Lives in | Reused by |
|---|---|---|---|
| Atomic interaction | \`ProductCard.addToCart()\`, \`Dropdown.choose(text)\` | component | pages, flows, tests |
| Page-level business action | \`CheckoutPage.fillShipping(Address)\`, \`LoginPage.loginAs(...)\` | page | flows, tests |
| Flow / task | \`Purchase.of(products).by(customer)\`: login → add → cart → checkout → finish | task/flow layer | many tests, Cucumber steps |

Rules: a method does **one user-meaningful thing** at its level; a component method never navigates across pages *unless the user would* (header \`openCart()\` is fine); a flow never touches locators. If a method has an "and" in its natural description ("add to cart and open cart"), it is either two methods or a flow.

### Naming in user language

Name by **intent**, not mechanism: \`addToCart("Pulse Bike Light")\`, not \`clickAddButton(2)\`; \`cartCount()\`, not \`getBadgeSpanText()\`. Names must survive a redesign: if the button becomes a swipe gesture, \`addToCart\` is still true. Use the product's vocabulary (what the BA writes in acceptance criteria) consistently — one word per concept (\`cart\`, never \`basket\` in one class and \`cart\` in another).

### Parameter objects vs long parameter lists

\`fillShipping(String first, String last, String zip, String phone, boolean gift)\` invites swapped arguments and \`null\` soup. Use a record with a valid default and \`with\` methods (lesson 3 introduced \`Applicant\`): \`fillShipping(Address.valid().withZip(""))\` documents the negative case in the call. Two to three *different-meaning* parameters are fine; three or more of the same type is the threshold for a parameter object.

### Return types

| Return | When | ShopEasy example |
|---|---|---|
| next page | the action navigates | \`header().openCart()\` → \`CartPage\` |
| \`this\` | same screen, same component still valid | \`ProductCard.addToCart()\` |
| \`void\` / parent page | the action invalidates this component | \`CartLine.remove()\` |
| value object | reading several related values | \`OrderSummary\` from the overview |
| plain value | one fact | \`cartCount()\` → \`int\` |
| result type | several legitimate outcomes | \`LoginResult\` (previous deep dive) |

The rule from lesson 3 holds at component level too: **the return type must tell the truth** about what is still valid.

### Idempotent helpers

Setup code often does not know the current state. \`ensureLoggedIn(user)\`, \`ensureCartEmpty()\`, \`ensureInCart(product)\` check first and act only if needed, so they can be called at the start of any test, after a retry, or twice. Two rules:

- Keep them **out of the code under test**: the test that verifies "Add to cart" calls the strict \`addToCart()\`; \`ensureInCart()\` is for tests whose subject is something else.
- Prefer **fast paths** when available: \`ensureCartEmpty()\` on ShopEasy can clear \`sessionStorage['shopeasy.cart']\` on the app origin instead of clicking Remove N times — the cart UI is not what that test is about.

### Avoid boolean flags

\`addToCart(name, true)\` — true what? Flags hide two behaviours behind one name and make call sites unreadable. Replace with two methods (\`addToCart\` / \`ensureInCart\`), an enum (\`sortBy(SortOption.PRICE_LOW_TO_HIGH)\`) or a parameter object. A flag that switches waiting on or off (\`click(locator, false)\`) is the worst kind: it encodes timing knowledge at the call site.

### Where waits live

Inside the method that causes or consumes the change, via the shared waiter: \`addToCart()\` waits for its own button state; \`rows()\` retries a consistent read; \`HeaderComponent.waitForCartCount\` exists because the badge update is the observable result other components cause. Tests do not contain waits; timeouts come from configuration, not literals. The full wait toolbox (custom conditions, count stability, text change) is in \`selenium-deep-synchronization\`.

### Component, utility or flow? A decision table

| The code… | Home | Example |
|---|---|---|
| touches elements of one widget that appears on several screens | **component** | \`ProductCard\`, \`HeaderComponent\`, \`DataTable\` |
| touches elements of exactly one screen | **page** | \`CheckoutPage.fillShipping\` |
| needs no browser at all (parsing, formatting, data building) | **utility / model** | \`Prices.parse\`, \`TableModel.toRecords\`, \`Address.valid()\` |
| works on any element regardless of widget (scroll into view, JS click fallback, highlight) | **action layer** | \`UiActions\` (see \`selenium-deep-framework-design\`) |
| spans several pages to reach a business goal | **flow / task** | \`Purchase\`, \`ensureLoggedIn\` |
| arranges state without the UI | **API/data layer** | \`CartApi.add(...)\`, session seeding |
| decides pass/fail | **test** | assertions |

## The duplication audit: from 300 tests to a component library

A suite that grew page-by-page hides its components. Find them with evidence, not opinion:

1. **Locator frequency.** Count literal locators across the test code; repeated ones are component candidates:

   \`\`\`
   rg -o --no-filename 'By\\.(id|cssSelector|xpath|className)\\("[^"]+"\\)' src/test | sort | uniq -c | sort -rn | head -40
   \`\`\`

   \`[data-testid='shopping-cart-badge']\` in 9 classes is a header component waiting to be extracted.
2. **Method-shape similarity.** Grep for the same method names in many page classes (\`getCartCount\`, \`logout\`, \`getProductPrice\`). Same name + same locators = copy.
3. **Flow repetition.** Mine the step log the action layer writes (\`selenium-deep-framework-design\`) across a full run and count repeated step sequences (3- to 6-step n-grams). "login → add → open cart → checkout" in 120 tests is a flow, not 120 lines of copy.
4. **UI inventory.** Ask the front-end team for their component list (Storybook or the design-system package). Map each UI component to "already modelled / duplicated in N classes / not modelled". This also gives you their naming — use it.
5. **Prioritise** by (duplicate count × change frequency); extract one component per PR, behaviour-preserving, with the tests that use it re-run; delete the copies in the same PR so drift cannot restart.

Report the outcome as numbers ("cart badge locator: 9 places → 1; InventoryPage: 74 → 18 methods"), which is what makes the refactoring fundable.

## Versioning components with the design system

Components are the place where test code meets the design system — treat the boundary as a **contract**:

- **\`data-testid\` is a public API.** Agree a naming scheme with developers — \`<component>-<part>\` and \`<action>-<key>\` like ShopEasy's \`shopping-cart-link\`, \`shopping-cart-badge\`, \`add-to-cart-<slug>\`. Put test ids into the design-system components themselves, so every screen using \`<ProductCard>\` gets them for free.
- **Change with deprecation.** Renaming a test id is a breaking change: the design-system changelog announces it, both ids exist for one release, the component class switches, the old id is removed. A lint rule or a contract test in the front-end repo can fail the build when a documented test id disappears.
- **Major redesigns: one component class per major version behind one interface** (\`Dropdown\` with \`NativeDropdown\` and \`ComboboxDropdown\`), selected by configuration or feature flag during the rollout; delete the old one when the flag is gone. Never \`if (newDesign)\` inside every method.
- **Test components where they are built.** If the design system has Storybook, a small suite of component tests against isolated stories catches a broken \`ProductCard\` contract before any page test runs.

## Unit-testing component logic without a browser

Everything in a component that is not "find, click, read" — header cleaning, row mapping, price parsing, deciding an outcome from texts — should be **pure functions** the component calls. That is why \`TableModel\` and \`Prices\` have no \`WebDriver\`:

\`\`\`java
public class TableModelTest {
    @Test
    public void stripsSortIndicatorFromHeaders() {
        assertEquals(TableModel.headerName("Salary ▼"), "Salary");
    }

    @Test
    public void skipsThePlaceholderRowButRejectsMalformedRows() {
        List<String> headers = List.of("Name", "Status");
        assertEquals(TableModel.toRecords(headers, List.of(List.of("No employees match your search."))), List.of());
        assertThrows(IllegalStateException.class,
                () -> TableModel.toRecords(headers, List.of(List.of("Chen Wei", "Active", "extra"))));
    }
}
\`\`\`

These run in milliseconds on every build and pin down the edge cases that UI runs only find by accident. Problem **pom-037** asks you to apply the same idea to a page object's money parsing — work through it there.

## Alternatives and recommendation

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability | Scalability | When to use |
|---|---|---|---|---|---|---|---|
| Page-only POM | every element in its page class | simple, few classes | duplication grows with screens; drift | neutral | degrades with size | poor | small apps, < ~10 screens |
| Components with fixed roots | root \`WebElement\` passed in | fast, simple | stale after re-render; callers must re-fetch | best | good if lifetimes are understood | good | list items read immediately |
| Components with lazy \`By\` roots | root re-found per call (this lesson) | immune to re-renders, business-key lookup | one extra lookup per call | slightly slower | high | high | default for singletons and "by name" items |
| PageFactory-decorated components | custom \`FieldDecorator\` (previous deep dive) | no change to legacy fields | reflection, hidden lookups | hidden extra lookups | medium | medium | extending a legacy PageFactory suite |
| Screenplay targets + tasks | UI targets hold locators; tasks/interactions act | flow reuse, multi-actor | indirection, learning curve | neutral | high for big teams | highest | many teams, many shared flows — see lesson 10 and \`pom-deep-screenplay-pattern\` |

**Recommended approach and why:** a **component library with lazy roots by default** (fixed roots only for immediate reads of list snapshots), **thin pages** that compose components, **pure helpers** for parsing, and a **flow/task layer** once flows repeat. It matches how the UI is built, puts each fix in one place, survives re-renders without retry hacks, and keeps every type checked by the compiler. The cost — more small classes — is cheaper than one 70-method page class.

## Common mistakes and when NOT to componentise

- **Componentising everything on day one.** A widget used on one screen is page code. Extract on the second real use (or when the design system says it *is* a component).
- **Generic "everything" components**: \`Widget.click(String partName)\` with a map of locators recreates a stringly-typed locator file. Components should expose business methods, not a mini WebDriver.
- **Components that assert** (\`ProductCard.verifyPrice(...)\`) — assertions stay in tests; components return values.
- **Deep inheritance between components** (\`SaleProductCard extends ProductCard extends Card extends Component\`). Prefer composition and small interfaces; one level below \`Component\` is usually enough.
- **Holding list items across actions** (\`List<CartLine> lines = cart.lines(); lines.get(0).remove(); lines.get(1).name()\`) — stale. Re-query after every action that re-renders.
- **Reaching outside the root** for portal-rendered parts without saying so — document and locate them through ARIA relations (\`aria-controls\`), not page-wide CSS.

## Best practices for experienced engineers

- One component = one UI concept = one class, named like the design system names it.
- Pick the root strategy per component from observed rendering behaviour; default to lazy.
- All lookups inside the root; all failures phrased in the component's language; \`toString\` static.
- Every action waits for its own observable result; tests contain no waits.
- Expose values and value objects, not \`WebElement\`s; locators never leave the component.
- Strict methods for the behaviour under test, idempotent \`ensure…\` helpers for setup — and fast paths for setup when the UI is not the subject.
- Keep pure logic in browser-free classes with unit tests.
- Agree the \`data-testid\` contract with the design-system team and version it.

## Playwright (TypeScript) equivalent

In Playwright a component is a class around a root \`Locator\`. Locators are lazy and re-resolved on every action, so the whole "fixed vs lazy root" question disappears, and auto-waiting replaces most of \`waitUntil\`:

\`\`\`ts
import { type Locator, type Page, expect } from '@playwright/test';

export class ProductCard {
  constructor(private readonly root: Locator) {}

  static named(page: Page, name: string): ProductCard {
    return new ProductCard(page.getByTestId('inventory-item').filter({ hasText: name }));
  }

  async addToCart(): Promise<void> {
    const slug = await this.root.locator('button.btn-inventory').getAttribute('data-slug');
    await this.root.getByTestId('add-to-cart-' + slug).click();
    await expect(this.root.getByTestId('remove-' + slug)).toBeVisible();
  }

  price(): Locator {
    return this.root.locator('.item-price');
  }
}
\`\`\`

\`locator.all()\` gives a snapshot list (the equivalent of \`ListComponent.items()\`), and \`filter({ hasText })\` replaces the XPath-by-name root. The full TypeScript component object model, fixtures that construct pages, and where utilities live are in \`pw-deep-fixtures-pom-components\`.

## Interview questions

### Q: Why move from page-based to component-based POM?

**Short answer (30–60 s):** Modern UIs are built from reusable components, and a page-only model encodes each widget once per page. That multiplies the cost of every markup change and lets copies drift. Components put each widget's locators and behaviour in one class; pages become thin compositions.

**Detailed answer:** Show the cost model (N copies → N fixes), the symptoms (same locator in 9 classes, 70-method pages, inconsistent waits), and the target structure: \`InventoryPage\` = identity check + \`HeaderComponent\` + \`ListComponent<ProductCard>\`. Mention the boundary: single-use widgets stay page code; extraction happens on the second real use or when the design system defines the component.

### Q: How do you scope a component, and how do you avoid stale roots?

**Short answer (30–60 s):** The component holds a root and searches only inside it; the root is a \`SearchContext\`. For staleness I choose the root strategy per component: lazy roots re-found by a \`By\` on every call for singletons and business-key lookups, fixed roots only for immediate reads of a list snapshot.

**Detailed answer:** Implement the root as a \`Supplier<WebElement>\` in the base class: fixed (\`() -> element\`), lazy (\`() -> driver.findElement(by)\`), nested (\`() -> parent.root().findElement(by)\`). Observe the app's rendering: ShopEasy re-appends inventory cards (fixed roots survive) but rebuilds cart lines and table rows (they do not). Waits re-obtain the root on every poll and ignore staleness, and reads that must be consistent (a whole table page) retry as a unit.

### Q: Design a generic table component.

**Short answer (30–60 s):** Root on the table; columns from header text (cleaned of sort indicators) to an index; rows as header → value maps; lookups by cell value; paging that waits for the old rows to go stale; pure mapping logic extracted for unit tests.

**Detailed answer:** Read headers and cells inside one retrying wait so a re-render cannot produce half-old data; skip placeholder rows but fail on other cell-count mismatches; expose \`rowWhere(column, value)\` and \`clickInRow(column, value, control)\` for page objects; mention performance (cell-by-cell \`getText\` vs one \`executeScript\` returning a matrix) and when to switch.

### Q: How do you make a list of components type-safe without reflection?

**Short answer (30–60 s):** A \`ListComponent<T extends Component>\` that takes the item locator and a factory \`Function<WebElement, T>\`, e.g. \`root -> new ProductCard(driver, root)\`. It returns fresh snapshots and offers \`first(predicate, description)\` and \`read(mapper)\`.

**Detailed answer:** Contrast with PageFactory's \`List<WebElement>\` (untyped, proxy re-finds on every list call) and a custom \`FieldDecorator\` (reflection). The factory function is compile-time checked, trivially testable, and works for nested lists via \`inside(parent, …)\`. No caching — callers re-query after re-rendering actions.

### Q: What makes a page or component method reusable?

**Short answer (30–60 s):** It does one user-meaningful thing at its level, is named in user language, takes a parameter object instead of long same-typed lists, returns a truthful type, waits for its own result, has no boolean flags, and leaves assertions to tests.

**Detailed answer:** Give the granularity levels (atomic in components, business actions in pages, flows in a task layer), strict vs idempotent pairs (\`addToCart\` / \`ensureInCart\`), return-type rules (\`this\` only if the component is still valid — \`CartLine.remove()\` returns \`void\`), and the decision table for component vs page vs utility vs action layer vs flow vs API.

### Q: How would you find and extract components in a 300-test legacy suite?

**Short answer (30–60 s):** With evidence: count repeated locators and method names, mine step logs for repeated flows, map against the design system's component list, then extract one component per PR by duplicate count × change frequency, deleting the copies in the same PR.

**Detailed answer:** Keep each extraction behaviour-preserving with affected tests re-run; report before/after numbers; align names with the design system; add a review rule ("no header locators outside \`HeaderComponent\`") so duplication does not return.

### Q: How do you keep components in sync with a design system?

**Short answer (30–60 s):** Treat \`data-testid\` as a versioned contract built into the design-system components, change it with a deprecation window, and for redesigns implement a new component class behind the same interface selected by configuration.

**Detailed answer:** Naming scheme agreed with developers, lint/contract tests in the front-end repo, Storybook-level component tests, and deletion of the old implementation when the feature flag goes — no \`if (newDesign)\` scattered across methods.

## Scenario-based questions

**1. A product redesign replaces the native sort \`<select>\` with a custom combobox on 6 screens. 80 tests fail.**
Reason: the tests' intent ("sort by price") did not change; the widget did. If pages exposed a \`Dropdown\` interface, add a \`ComboboxDropdown\` implementation and switch the 6 pages (one line each) — or switch by configuration while the redesign is behind a flag. If they used \`Select\` directly, this is the moment to introduce the interface: fix the six pages through it, then delete the direct \`Select\` usages.

**2. Cart tests fail intermittently with \`StaleElementReferenceException\` in \`CartLine.name()\` after removing an item.**
Reason: \`cart.html\` rebuilds every line on Remove; the test holds a list of lines from before the removal. Act: make \`CartLine.remove()\` return \`void\`/\`CartPage\` (not \`this\`), have \`CartPage.remove(name)\` wait for the list to shrink, and re-query \`lines()\` after every removal. Do not add stale-retry loops to \`name()\`: the object is legitimately dead.

**3. A teammate proposes one \`GenericWidget\` class with \`click(String part)\` and \`text(String part)\` backed by a JSON map of locators, "so we never write component classes again".**
Reason: it trades compile-time safety for strings, moves locators out of reviewable code, and gives tests a mini WebDriver instead of business methods. Waits and state rules (strict vs idempotent, return types) cannot be expressed. Counter-proposal: small typed components with a shared base, plus a generator or template for new ones if writing them is the real pain.

## Tricky follow-ups

- **Q: Can a component's root be a \`ShadowRoot\`?** Yes — \`ShadowRoot\` is a \`SearchContext\`, but use CSS selectors inside it; XPath is not supported from a shadow-root context in Chromium.
- **Q: Should \`ListComponent\` cache items for speed?** No — a cached list is \`@CacheLookup\` in disguise; take a snapshot, use it immediately, re-query after actions.
- **Q: Why does \`addToCart()\` throw if the product is already in the cart?** ShopEasy's button toggles; a silent second click would remove it. The strict method exposes the test bug; \`ensureInCart()\` is the idempotent alternative.
- **Q: Where do you locate a dropdown's options when they render in a portal at the end of \`body\`?** Outside the root, via the trigger's \`aria-controls\`/\`aria-owns\` id — documented in the component, never by a page-wide guess.
- **Q: Is \`toString\` calling \`name()\` a good idea for nicer logs?** No — it hits the browser whenever anything formats the object and can throw; build the description from static data at construction.`,
  keyPoints: [
    'Pages are the wrong unit for UIs built from a design system: each repeated widget encoded per page multiplies fixes and drifts. Model widgets as components and keep pages as thin compositions.',
    'A component = root + scope + lifetime. Implement the root as a Supplier<WebElement> (fixed, lazy By, nested lazy) and choose per component from observed rendering — ShopEasy re-appends inventory cards but rebuilds cart lines and table rows.',
    'Component base: all lookups inside the root, failures phrased in the component language, waits that re-obtain the root and ignore staleness, static toString.',
    'ListComponent<T extends Component> with a Function<WebElement, T> factory gives typed lists without reflection; always fresh snapshots, never cached.',
    'A generic DataTable maps header names (cleaned of sort indicators) to records, reads a page as one retrying unit, skips placeholder rows, and pages by waiting for old rows to go stale; pure mapping lives in a browser-free TableModel.',
    'Reusable methods: one user-meaningful action per level, user-language names, parameter objects, truthful return types, strict + idempotent pairs, no boolean flags, waits inside the method that causes the change.',
    'Find components with evidence (locator frequency, method-name copies, step-log n-grams, the design system inventory) and extract one per PR, deleting copies in the same PR.',
    'Treat data-testid as a versioned contract with the design system; redesigns get a new implementation behind the same interface, selected by configuration.',
  ],
  mistakes: [
    'Holding a list of components across an action that re-renders (cart Remove, table search) and then reading them — StaleElementReferenceException. Fix: re-query after every re-rendering action; return void or the page from actions that invalidate the component.',
    'Adding retry-on-stale loops inside every component method — hides real bugs and slows failures. Fix: pick the right root strategy (lazy By for singletons and by-name items) and retry only whole consistent reads, such as one table page.',
    'One idempotent "addToCart" used everywhere — a test of the add button can no longer detect that a second click removes the product. Fix: strict addToCart for the behaviour under test, ensureInCart for setup.',
    'Componentising single-use widgets and building deep component inheritance hierarchies — more classes, no reuse. Fix: extract on the second real use or when the design system defines the component; compose instead of inheriting.',
    'Locating the cart through By.linkText("Cart") — matches the practice-pages nav link, not the cart icon. Fix: use the data-testid contract, [data-testid=\'shopping-cart-link\'], inside HeaderComponent.',
    'Putting parsing and mapping logic inside browser-bound methods, so every fix needs a UI run. Fix: extract pure functions (Prices, TableModel) and unit test them in milliseconds.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`):

1. Implement \`Component\`, \`ProductCard\`, \`ListComponent<T>\` and \`HeaderComponent\` as in the lesson, compose them into \`InventoryPage\`, and write the "two cheapest products → badge 2" test.
2. On \`cart.html\` add \`CartLine\` and \`CartPage.lines()\` via \`ListComponent.inside(...)\`. Write a test that adds three products, removes the middle one, and reads the remaining names — first holding the old list (observe the stale exception), then re-querying.
3. Point \`DataTable\` at \`#employee-table\` on \`table.html\` with \`#next-page\`; type "QA" into \`#table-search\` and read \`rows()\`; then clear the search and read \`rowsOnAllPages()\`, checking that you get 15 records. Add unit tests for \`TableModel\` covering the "No employees match your search." row.
4. Run the locator-frequency command from the duplication audit on your own test sources and list the top three component candidates.`,
  problems: ['pom-028', 'pom-030', 'pom-031', 'pom-033', 'pom-037'],
}
