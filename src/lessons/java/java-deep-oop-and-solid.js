export default {
  slug: 'java-deep-oop-and-solid',
  category: 'java',
  order: 12,
  title: 'Deep dive: OOP for framework design — polymorphism, abstraction, composition and SOLID',
  minutes: 30,
  summary: 'Explain how Java really resolves overloads and dispatches overridden calls, choose between abstract classes, interfaces and composition for page objects and test bases, implement equals/hashCode/toString correctly, and defend a framework design with concrete SOLID before/after examples.',
  manualAnalogy: `A good test lead does not write one giant test plan that knows about every browser, every page and every data set; they split it into reusable checklists ("header checks", "cart checks") that each team can combine, and they agree on contracts ("any page you hand me must be able to say whether it is loaded"). When a new browser or a mobile layout arrives, they add one checklist instead of rewriting all of them. OOP and SOLID are the same discipline applied to the automation code.`,
  body: `## Where the earlier lessons stop

*Classes and encapsulation* (lesson 4), *Static vs instance* (lesson 5) and *Inheritance, interfaces and enums* (lesson 6) showed the syntax: \`private\` fields, constructors, \`extends\`, \`super\`, \`abstract\`, \`@Override\`, interfaces like \`WebDriver\`. This lesson is about the **mechanism and the design decisions**: what the compiler decides versus what the JVM decides at run time, why "extends BasePage" stops scaling, how to write \`equals\`/\`hashCode\` that survive a \`HashSet\`, and how to argue a framework design with SOLID in an interview — with before/after code for each principle.

Baseline is **Java 17**; features newer than Java 8 are marked with their version.

## Encapsulation at senior depth: invariants, immutability, defensive copies

Encapsulation is not "fields are private and have getters". It is **protecting an invariant**: a rule about the object's state that must hold after every public method returns. A class with a public setter for every field has private fields and *no* encapsulation.

Invariants in automation code are everywhere: a \`CartExpectation\` whose total equals the sum of its lines; a \`TestUser\` that never has a null username; a \`RetryPolicy\` whose attempts are at least 1. Three tools enforce them:

1. **Validate in the constructor** (and in every mutator, if there are any) — fail fast with a message.
2. **Make the object immutable** — \`final\` class, \`private final\` fields, no setters. An immutable object only has to be validated once, is automatically thread-safe (important for parallel TestNG runs that share test data), and can be safely used as a \`HashMap\` key.
3. **Defensive copies** — a \`final List<String>\` field is a final *reference*; the list behind it is still mutable. Copy on the way in and do not leak the internal list on the way out.

\`\`\`java
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

public final class CartExpectation {
    private final String user;
    private final List<String> productNames;   // final reference, but the list must be protected too
    private final BigDecimal total;

    public CartExpectation(String user, List<String> productNames, BigDecimal total) {
        this.user = Objects.requireNonNull(user, "user");
        if (productNames.isEmpty()) throw new IllegalArgumentException("cart expectation needs at least one product");
        this.productNames = List.copyOf(productNames);     // defensive copy, unmodifiable (Java 10+)
        if (total.signum() < 0) throw new IllegalArgumentException("total must not be negative: " + total);
        this.total = total;
    }

    public String user() { return user; }
    public List<String> productNames() { return productNames; }   // already unmodifiable: safe to return
    public BigDecimal total() { return total; }

    public CartExpectation withProduct(String name, BigDecimal price) {   // "wither": returns a new object
        List<String> names = new java.util.ArrayList<>(productNames);
        names.add(name);
        return new CartExpectation(user, names, total.add(price));
    }
}
\`\`\`

Step by step:

- \`final class\` — nobody can subclass it and add a mutable field or override an accessor to break the invariant.
- \`Objects.requireNonNull(user, "user")\` — the NPE happens in the constructor with a name, not 40 lines later in an assertion.
- \`List.copyOf(...)\` (Java 10+) — copies the caller's list **and** makes it unmodifiable; it also rejects null elements. If the caller later does \`names.add("Retro Red Tee")\`, our object does not change. \`Collections.unmodifiableList(list)\` is *not* the same: it is a read-only **view** — changes to the original list still show through.
- \`withProduct\` — mutation becomes "create a modified copy". This is how \`String\`, \`BigDecimal\`, \`LocalDate\` and records work.

| Approach | Protects against caller mutation? | Protects against mutation through getter? | Cost |
|---|---|---|---|
| \`this.list = list\` | no | no | none |
| \`Collections.unmodifiableList(list)\` | **no** (view of caller's list) | yes | O(1) wrapper |
| \`new ArrayList<>(list)\` + return \`unmodifiableList\` | yes | yes | O(n) copy |
| \`List.copyOf(list)\` (Java 10+) | yes | yes | O(n) copy; returns the same instance if already an immutable list |

For test data, the modern answer is usually a **record** (Java 16+, covered in lesson 11) with a compact constructor that validates and copies:

\`\`\`java
public record TestUser(String username, String password, List<String> roles) {
    public TestUser {
        Objects.requireNonNull(username, "username");
        roles = List.copyOf(roles);   // compact constructor: reassign the parameter before the implicit field assignment
    }
}
\`\`\`

A record gives you private final fields, accessors, \`equals\`, \`hashCode\` and \`toString\` — but **shallowly**: without \`List.copyOf\` the \`roles\` list would still be mutable.

## Inheritance: what is inherited, constructor chaining and the fragile base class

What a subclass inherits: all **members** (fields, methods, nested classes) that are accessible — \`public\`, \`protected\`, and package-private if in the same package. It does **not** inherit constructors, and \`private\` members exist in the object's memory but are not accessible by name. \`static\` methods are inherited in the sense that \`Child.staticMethod()\` compiles, but they are **hidden**, not overridden (see below).

**Constructor chaining.** Every constructor starts with either \`this(...)\` or \`super(...)\`; if you write neither, the compiler inserts \`super()\`. So \`new LoginPage(driver)\` runs \`Object()\` → \`BasePage(driver)\` → \`LoginPage(driver)\`, top-down. Field initialisers of each class run right after its \`super(...)\` call returns.

That ordering creates the classic trap — **calling an overridable method from a constructor**:

\`\`\`java
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

abstract class BasePage {
    protected final WebDriver driver;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        waitUntilLoaded();                       // DANGER: dynamic dispatch to the subclass
    }

    protected abstract By readyMarker();

    private void waitUntilLoaded() {
        driver.findElement(readyMarker());       // calls LoginPage.readyMarker() ...
    }
}

class LoginPage extends BasePage {
    private final By loginButton = By.id("login-button");   // ... before this initialiser has run

    LoginPage(WebDriver driver) { super(driver); }

    @Override protected By readyMarker() { return loginButton; }   // returns null here
}
\`\`\`

\`super(driver)\` runs while \`loginButton\` is still \`null\` (subclass initialisers have not executed yet), so \`findElement(null)\` fails with an \`IllegalArgumentException\`/\`NullPointerException\` whose stack trace points into \`BasePage\` — confusing, because the field "is obviously set". **Fix:** never call overridable methods from a constructor. Make loading an explicit step (\`new LoginPage(driver).waitUntilLoaded()\`, or a static factory \`LoginPage.open(driver)\`), or make \`readyMarker()\` return a constant that does not depend on instance state.

**Fragile base class problem.** A subclass depends on the *implementation* of its parent, not just its contract. Change the parent and children break even though they did not change. The textbook example is a counting set:

\`\`\`java
import java.util.Collection;
import java.util.HashSet;

class CountingSet<E> extends HashSet<E> {
    int added = 0;
    @Override public boolean add(E e) { added++; return super.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) { added += c.size(); return super.addAll(c); }
}
// new CountingSet<String>().addAll(List.of("a","b","c")) -> added == 6, because
// HashSet.addAll (inherited from AbstractCollection) calls add() for each element.
\`\`\`

In a test framework the same thing happens with a \`BasePage\` whose \`click()\` someone changes to also scroll and wait: every subclass that overrode \`click()\` and called \`super.click()\` now double-waits, and subclasses that relied on the old behaviour break silently. Mitigations: design for inheritance explicitly (document self-use, make hooks \`protected\` and everything else \`final\`/\`private\`), or **prohibit** it (\`final\` classes) and prefer composition.

## Polymorphism: who decides, and when

Two completely different mechanisms share the word.

### Compile time: overload resolution

The **compiler** picks *which method signature* to call, using the **static (declared) types** of the arguments. The JLS does it in three phases, stopping at the first phase that finds any applicable method:

1. Exact/widening matches only — no boxing, no varargs.
2. Allow boxing/unboxing.
3. Allow varargs.

Within a phase, the **most specific** method wins; if none is more specific, it is an ambiguity compile error.

\`\`\`java
public class Overloads {
    static String log(Object o)  { return "Object"; }
    static String log(String s)  { return "String"; }
    static String log(long n)    { return "long"; }
    static String log(Integer n) { return "Integer"; }
    static String log(int... n)  { return "varargs"; }

    public static void main(String[] args) {
        Object o = "Pulse Bike Light";
        System.out.println(log(o));                 // Object  — static type wins, not the runtime String
        System.out.println(log(5));                 // long    — phase 1 widening beats phase 2 boxing
        System.out.println(log(Integer.valueOf(5))); // Integer — exact match in phase 1
        System.out.println(log());                  // varargs — only phase 3 can match zero arguments
        // System.out.println(log(null));           // does NOT compile: "reference to log is ambiguous"
    }
}
\`\`\`

The commented line is the interview twist. \`null\` fits \`Object\`, \`String\`, \`Integer\` and \`int[]\` (in phases 1 and 2 a varargs method is also tried as a fixed-arity method taking an array), and none of \`String\`, \`Integer\`, \`int[]\` is a subtype of the others, so there is no single most specific method. With only \`log(Object)\` and \`log(String)\`, \`log(null)\` compiles and picks \`String\`.

### Run time: dynamic dispatch

For an instance method call, the compiler fixes the *signature*; the **JVM** chooses the *implementation* from the **runtime class** of the receiver object. The bytecode instruction is \`invokevirtual\` (class methods) or \`invokeinterface\` (interface methods). HotSpot implements this with a per-class **virtual method table (vtable)**: each overridable method has a slot index, a subclass copies the parent's table and replaces the slots it overrides, and a call is "load the receiver's class, jump through slot N". Interface calls use an **itable** search, which is a little more work. In practice the JIT removes most of the cost: with **class hierarchy analysis** and **inline caches**, a call site that only ever sees \`ChromeDriver\` is devirtualised and inlined, with a deoptimisation guard if another class shows up.

What is **not** dynamically dispatched:

| Member | Bound by | Consequence |
|---|---|---|
| \`static\` method | compiler, declared type | a "re-declared" static method in the child **hides** the parent's; \`Parent p = new Child(); p.staticM()\` calls Parent's |
| \`private\` method | declaring class | not visible to the subclass, so it cannot be overridden; a same-named child method is unrelated |
| \`final\` method | (dispatched, but cannot be overridden) | compile error if a child tries |
| constructor | \`invokespecial\` | never polymorphic |
| **field** | compiler, declared type | fields are **hidden**, never overridden |

\`\`\`java
class Page          { String name = "Page";  static String kind() { return "page"; }  String title() { return "Page"; } }
class InventoryPage extends Page {
    String name = "Inventory";                                   // hides Page.name
    static String kind() { return "inventory"; }                 // hides Page.kind()
    @Override String title() { return "Products"; }              // overrides
}

Page p = new InventoryPage();
System.out.println(p.name);     // Page       (field: declared type)
System.out.println(p.kind());   // page       (static: declared type; IDE warns "static via instance")
System.out.println(p.title());  // Products   (virtual: runtime type)
\`\`\`

### Covariant return types

An override may **narrow** the return type (Java 5+). This is what makes fluent page objects type-safe:

\`\`\`java
abstract class BasePage {
    abstract BasePage open();
}
class InventoryPage extends BasePage {
    @Override InventoryPage open() { /* driver.get(...) */ return this; }   // covariant: InventoryPage, not BasePage
    InventoryPage sortBy(String value) { return this; }
}
// new InventoryPage().open().sortBy("lohi");   compiles without a cast
\`\`\`

Rules for a legal override: same name and parameter types (after erasure), return type the same or a subtype (references only — not \`int\` → \`short\`), access not more restrictive, and **checked exceptions** not broader than the parent's. \`@Override\` makes the compiler verify all of this.

## Abstraction: abstract class vs interface since Java 8

Since Java 8 an interface can have \`default\` and \`static\` methods; since Java 9 also \`private\` methods (helpers shared by defaults). Interfaces still cannot have **instance state** (fields are implicitly \`public static final\`) or constructors.

\`\`\`java
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public interface HasHeader {
    WebDriver driver();                                         // abstract: the implementer supplies the driver

    default String loggedInUser() {                             // Java 8+: shared behaviour, no state
        return text(By.id("logged-in-user"));
    }
    default void logout() {
        driver().findElement(By.id("logout-link")).click();
    }
    private String text(By by) {                                // Java 9+: private helper for defaults
        return driver().findElement(by).getText().trim();
    }
    static By cartLink() { return By.id("shopping-cart-link"); } // static: called as HasHeader.cartLink(), NOT inherited
}
\`\`\`

### The diamond rule

Multiple inheritance of **behaviour** is now possible, so Java defines how conflicts resolve:

1. **Class wins.** A method from a superclass (concrete or abstract) beats any interface default.
2. **More specific interface wins.** If \`B extends A\` and both provide \`hello()\`, B's version is chosen.
3. Otherwise the class **must override** and can pick explicitly with \`X.super.m()\`.

\`\`\`java
interface Searchable { default String describe() { return "searchable"; } }
interface Sortable   { default String describe() { return "sortable"; } }

class EmployeeTablePage implements Searchable, Sortable {
    @Override public String describe() {                      // compile error without this override
        return Searchable.super.describe() + "+" + Sortable.super.describe();
    }
}
\`\`\`

There is no diamond problem for **state** because interfaces have none — that was the reason C++-style multiple inheritance was avoided.

| | Abstract class | Interface (Java 17) |
|---|---|---|
| Instance fields / state | yes | no (only \`public static final\` constants) |
| Constructors | yes (run via \`super(...)\`) | no |
| Method kinds | any: abstract, concrete, final, static, private, protected | abstract, \`default\`, \`static\`, \`private\` (Java 9+); all non-private are public |
| Multiple inheritance | one superclass only | a class implements many |
| Access modifiers on members | all four | public (or private for helpers) |
| Can be a lambda target | no | yes, if exactly one abstract method |
| Evolving the API | adding a concrete method is safe | adding a \`default\` method is safe; adding an abstract one breaks implementers |
| Models | "is-a" with shared state and a template | a capability / role / contract |
| Can restrict implementers | \`sealed\` (Java 17) | \`sealed\` (Java 17) |
| Typical automation use | \`BaseTest\` holding the driver lifecycle (if you must) | \`DriverFactory\`, \`Searchable\`, \`HasHeader\`, \`Waiter\`, \`ReportListener\` |

**Recommended:** interfaces for contracts and capabilities, abstract classes only when several implementations genuinely share **state** plus a fixed algorithm (Template Method). An abstract class with no fields is usually an interface waiting to happen.

## Composition vs inheritance for page objects and test bases

The common first framework puts everything into a \`BasePage\` (waits, header, footer, cookie banner, screenshots, JS helpers) and every page \`extends\` it. Then the cart page needs the header but not the sort dropdown, the login page has no header at all, and the mobile layout has a hamburger menu instead. The base class grows to 1,500 lines and every page inherits methods that make no sense for it (\`loginPage.logout()\`).

### Approach A — inheritance

\`\`\`java
import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    // header behaviour baked into every page, even pages without a header
    public String loggedInUser() { return driver.findElement(By.id("logged-in-user")).getText(); }
    public void openCart()       { driver.findElement(By.id("shopping-cart-link")).click(); }
    public void logout()         { driver.findElement(By.id("logout-link")).click(); }

    protected void click(By by) { wait.until(ExpectedConditions.elementToBeClickable(by)).click(); }
}

public class InventoryPage extends BasePage {
    private final By sort = By.id("product-sort");
    public InventoryPage(WebDriver driver) { super(driver); }
    public void sortBy(String value) { new org.openqa.selenium.support.ui.Select(driver.findElement(sort)).selectByValue(value); }
}
\`\`\`

### Approach B — composition (has-a components)

\`\`\`java
import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class Actions {                         // one reusable "how to interact" helper
    private final WebDriver driver;
    private final WebDriverWait wait;
    public Actions(WebDriver driver, Duration timeout) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, timeout);
    }
    public void click(By by) { wait.until(ExpectedConditions.elementToBeClickable(by)).click(); }
    public String text(By by) { return wait.until(ExpectedConditions.visibilityOfElementLocated(by)).getText().trim(); }
    public void selectValue(By by, String value) { new Select(driver.findElement(by)).selectByValue(value); }
}

public final class HeaderComponent {                 // only pages that HAVE a header own one
    private final Actions actions;
    public HeaderComponent(Actions actions) { this.actions = actions; }
    public String loggedInUser() { return actions.text(By.id("logged-in-user")); }
    public void openCart()       { actions.click(By.id("shopping-cart-link")); }
    public void logout()         { actions.click(By.id("logout-link")); }
}

public final class InventoryPage {
    private final Actions actions;
    private final HeaderComponent header;
    private static final By SORT = By.id("product-sort");

    public InventoryPage(Actions actions) {
        this.actions = actions;
        this.header = new HeaderComponent(actions);
    }
    public HeaderComponent header() { return header; }            // test reads: inventory.header().openCart()
    public InventoryPage sortBy(String value) { actions.selectValue(SORT, value); return this; }
}
\`\`\`

Step by step:

- \`Actions\` holds the wait strategy **once**; swapping to a fluent wait or adding logging changes one class.
- \`HeaderComponent\` is reused by \`InventoryPage\`, \`CartPage\` and \`CheckoutPage\`; \`LoginPage\` simply does not have one, so \`loginPage.logout()\` is not even expressible.
- Components can be **substituted**: a \`MobileHeaderComponent\` behind a \`Header\` interface for a responsive layout, chosen at construction time.
- Each class is small and unit-testable with a mocked \`Actions\`.

| | Inheritance (\`extends BasePage\`) | Composition (has-a components) |
|---|---|---|
| How it works | subclass inherits all helpers and header methods | page holds references to \`Actions\`, \`HeaderComponent\`, … |
| Advantages | least code at first; familiar to most teams; \`PageFactory\` tutorials assume it | each page exposes only what it has; components reused across pages; easy to swap implementations |
| Disadvantages | god-class base; fragile base class; single inheritance means you cannot also extend \`MobileBasePage\` | a little more wiring; one more dot in tests (\`header().openCart()\`) |
| Performance | identical — object creation is negligible next to WebDriver calls | identical |
| Maintainability | degrades as the base grows | stays flat; changes are local |
| Scalability (pages, layouts, teams) | poor beyond ~20 pages or 2 layouts | good — new layout = new component implementation |
| When to use | small suites, a thin base with only the driver and wait | default for a framework that several people will extend |

**Recommended approach and why:** composition for page *content* (header, footer, tables, modals, the sort dropdown) and a deliberately **thin** base, if any, for infrastructure. "Favour composition over inheritance" is not dogma here: inheritance couples every page to every other page's needs, composition couples each page only to the components it really contains. In an interview I would say: *"I keep BasePage to the driver and the wait helper — about 30 lines — and model everything visible on screen as components. That kept our page classes under 100 lines and made the mobile layout a matter of injecting a different header component."*

The same applies to **test bases**: a \`BaseTest\` with \`@BeforeMethod\`/\`@AfterMethod\` driver lifecycle is reasonable (TestNG discovers annotations through inheritance), but login helpers, API clients and DB utilities belong in injected collaborators, not in a 10-level hierarchy \`BaseTest → UiBaseTest → LoggedInBaseTest → CheckoutBaseTest\`.

## equals, hashCode and toString in depth

\`Object\` gives every class \`equals\` (identity), \`hashCode\` (identity-based, typically derived from internal state of the JVM, not the address in modern HotSpot), \`toString\` (\`ClassName@hexHash\`), \`getClass\`, \`clone\`, \`finalize\` (deprecated since Java 9), and the monitor methods \`wait\`/\`notify\`/\`notifyAll\`.

### The contract

- **equals** must be reflexive, symmetric, transitive, consistent, and \`x.equals(null)\` is \`false\`.
- **hashCode**: equal objects **must** have equal hash codes; unequal objects *should* differ (for performance).
- Break the hashCode rule and \`HashSet.contains\`/\`HashMap.get\` look in the wrong bucket: your "duplicate product" check passes duplicates through. Mutate a field used in \`hashCode\` while the object is inside a \`HashSet\` and it becomes unreachable through \`contains\`/\`remove\` — still in the set, never found.

### Symmetry with inheritance: getClass() vs instanceof

\`\`\`java
import java.math.BigDecimal;
import java.util.Objects;

public class Product {
    private final String name;
    private final BigDecimal price;
    public Product(String name, BigDecimal price) { this.name = name; this.price = price; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;     // strict: same runtime class
        Product other = (Product) o;
        return name.equals(other.name) && price.compareTo(other.price) == 0;   // 7.49 equals 7.490
    }
    @Override public int hashCode() {
        return Objects.hash(name, price.stripTrailingZeros());          // consistent with compareTo-based equals
    }
    @Override public String toString() {
        return "Product[name=" + name + ", price=" + price + "]";
    }
}
\`\`\`

If \`Product.equals\` used \`o instanceof Product\` and a subclass \`DiscountedProduct\` added a \`discountCode\` field and overrode \`equals\` with \`instanceof DiscountedProduct\`, then \`product.equals(discounted)\` is \`true\` but \`discounted.equals(product)\` is \`false\` — **symmetry broken**, and a \`HashSet\`/\`List.contains\` result depends on which object is on the left.

| | \`getClass() != o.getClass()\` | \`instanceof\` (with \`final\` class or \`final equals\`) |
|---|---|---|
| Subclass equal to parent? | never | yes |
| Symmetry with subclasses adding state | safe | broken unless subclasses do not override |
| Works with proxies/mocks (Hibernate, Mockito subclasses) | no — the proxy class differs | yes |
| Liskov substitution | violates it (a subclass is never equal) | honours it |
| When to use | value classes that may be subclassed | \`final\` value classes; interfaces with a defined equality (like \`List\`) |

**Recommended:** make value classes \`final\` (or records) and use \`instanceof\` — Java 16+ pattern matching makes it short: \`if (!(o instanceof Product p)) return false;\`. Note the \`BigDecimal\` trap in the example: \`BigDecimal.equals\` compares scale, so \`new BigDecimal("7.49").equals(new BigDecimal("7.490"))\` is \`false\`; compare with \`compareTo\` and normalise in \`hashCode\`.

### Records

A record's generated \`equals\` compares **all components** (reference components with \`Objects.equals\`, so arrays compare by identity — a trap for \`byte[]\` screenshot payloads), and its \`hashCode\` combines them. Records are implicitly \`final\`, so the inheritance symmetry problem cannot arise. You can still override \`equals\` (e.g. for \`BigDecimal\` scale) but then you must override \`hashCode\` consistently.

### toString for failure messages

TestNG/AssertJ print \`toString()\` on failure. \`expected [Product@1b6d3586] but found [Product@4554617c]\` tells nobody anything. A good \`toString\` names the class and the fields that define identity, skips secrets (never print the password of a \`TestUser\`), and keeps large payloads out (print the size of a response body, not 2 MB of JSON). Records get a sensible one for free — and *will* print a password component, so override it for credentials.

## Immutability for test data

Shared mutable test data is the most common cause of "passes alone, fails in parallel": thread A adds an item to the shared \`DEFAULT_CART\` list while thread B asserts on it. Immutable data removes that class of bug entirely.

| Technique | Version | What it protects | Gotcha |
|---|---|---|---|
| \`final\` field | all | the reference | object behind it can still change |
| \`List.of\`, \`Set.of\`, \`Map.of\` | Java 9+ | structure; null elements rejected | \`Set.of\`/\`Map.of\` throw on duplicate elements/keys; iteration order unspecified |
| \`List.copyOf\` / \`Map.copyOf\` | Java 10+ | snapshot + unmodifiable | elements themselves may be mutable |
| \`Collections.unmodifiableList\` | all | read-only **view** | source changes show through |
| \`stream().toList()\` | Java 16+ | unmodifiable result | \`Collectors.toList()\` gives no such guarantee |
| record | Java 16+ | final fields + value semantics | shallow; copy collections in the compact constructor |

## SOLID with automation examples

### S — Single Responsibility: page object vs assertions vs data

*Before:* the page object logs in, reads test data from a file and asserts.

\`\`\`java
public class LoginPage {
    public void loginAndVerify() throws Exception {
        java.util.Properties p = new java.util.Properties();
        p.load(new java.io.FileInputStream("users.properties"));                 // data loading
        driver.findElement(By.id("user-name")).sendKeys(p.getProperty("user"));  // UI interaction
        driver.findElement(By.id("password")).sendKeys(p.getProperty("pass"));
        driver.findElement(By.id("login-button")).click();
        org.testng.Assert.assertEquals(driver.getTitle(), "ShopEasy");            // verification
    }
    private org.openqa.selenium.WebDriver driver;
}
\`\`\`

*After:* three reasons to change, three classes.

\`\`\`java
public record TestUser(String username, String password) {}                 // data

public interface UserRepository { TestUser byRole(String role); }           // where data comes from

public final class LoginPage {                                              // UI only: no assertions
    private final Actions actions;
    public LoginPage(Actions actions) { this.actions = actions; }
    public void loginAs(TestUser user) {
        actions.type(By.id("user-name"), user.username());
        actions.type(By.id("password"), user.password());
        actions.click(By.id("login-button"));
    }
    public String errorMessage() { return actions.text(By.cssSelector("[data-testid='error']")); }
}

// the test decides what "correct" means
// loginPage.loginAs(users.byRole("locked"));
// assertThat(loginPage.errorMessage()).contains("locked out");
\`\`\`

(\`Actions.type\` is the obvious sibling of \`click\` in the composition example.) Page objects returning state and tests asserting keeps one page object usable for positive and negative tests.

### O — Open/Closed: adding a browser via a factory map

*Before:* every new browser edits the same switch (and its tests).

\`\`\`java
public static WebDriver create(String name) {
    switch (name) {
        case "chrome":  return new ChromeDriver();
        case "firefox": return new FirefoxDriver();
        default: throw new IllegalArgumentException(name);
    }
}
\`\`\`

*After:* the factory is closed for modification, open for extension through registration.

\`\`\`java
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;

public final class DriverFactory {
    private static final Map<String, Supplier<WebDriver>> CREATORS = new ConcurrentHashMap<>(Map.of(
        "chrome",          ChromeDriver::new,
        "chrome-headless", () -> new ChromeDriver(new ChromeOptions().addArguments("--headless=new")),
        "firefox",         FirefoxDriver::new,
        "edge",            EdgeDriver::new
    ));

    private DriverFactory() {}

    public static void register(String name, Supplier<WebDriver> creator) {   // extension point (e.g. a RemoteWebDriver grid)
        CREATORS.put(name, creator);
    }

    public static WebDriver create(String name) {
        Supplier<WebDriver> creator = CREATORS.get(name);
        if (creator == null) throw new IllegalArgumentException("Unknown browser '" + name + "', known: " + CREATORS.keySet());
        return creator.get();
    }
}
\`\`\`

Lookup is O(1); the error message lists valid keys; a grid module can \`register("grid-chrome", ...)\` without touching this file. An enum with a \`Supplier\` field (see the Browser-enum practice problem) is the compile-time-checked variant: closed set of browsers, type-safe, but adding one edits the enum.

### L — Liskov Substitution: a MobileLoginPage that breaks substitution

*Before:*

\`\`\`java
public class LoginPage {
    public InventoryPage loginAs(TestUser u) { /* type, click */ return new InventoryPage(actions); }
    public void rememberMe(boolean on) { actions.setChecked(By.id("remember-me"), on); }
    protected Actions actions;
}

public class MobileLoginPage extends LoginPage {
    @Override public void rememberMe(boolean on) {
        throw new UnsupportedOperationException("no remember-me on mobile");   // strengthens a precondition
    }
}
// any test written against LoginPage now blows up when handed a MobileLoginPage
\`\`\`

LSP says code written against the parent must work with any subclass: subclasses may not **strengthen preconditions**, **weaken postconditions** or throw new kinds of failure. \`UnsupportedOperationException\` in an override is the textbook smell.

*After:* model the optional capability separately.

\`\`\`java
public interface LoginScreen { InventoryPage loginAs(TestUser user); }
public interface SupportsRememberMe { void rememberMe(boolean on); }

public final class DesktopLoginPage implements LoginScreen, SupportsRememberMe { /* ... */ }
public final class MobileLoginPage  implements LoginScreen { /* ... */ }

// tests that need remember-me ask for that capability explicitly:
// if (login instanceof SupportsRememberMe r) r.rememberMe(true);   // Java 16+ pattern
// or better: the remember-me test is only parameterised with layouts that support it.
\`\`\`

### I — Interface Segregation: small capability interfaces

*Before:* a fat \`Page\` interface forces every page to implement \`search\`, \`sortBy\`, \`paginate\`, most of them throwing or doing nothing.

*After:*

\`\`\`java
import java.util.List;

public interface Searchable { void search(String query); }
public interface Sortable<O extends Enum<O>> { void sortBy(O option); List<String> visibleOrder(); }

public enum ProductSort { AZ, ZA, LOHI, HILO }

public final class EmployeeTablePage implements Searchable {          // table.html has #table-search
    public void search(String q) { /* type into #table-search */ }
}
public final class InventoryPage implements Sortable<ProductSort> {   // inventory.html has #product-sort
    public void sortBy(ProductSort o) { /* select value o.name().toLowerCase() */ }
    public List<String> visibleOrder() { return List.of(); }
}

// one generic check works for every sortable page:
// static <O extends Enum<O>> void assertSortChanges(Sortable<O> page, O option) { ... }
\`\`\`

Clients depend only on the capability they use, so generic helpers ("verify that search narrows the results") work across pages without a type check.

### D — Dependency Inversion: tests depend on a DriverProvider

*Before:* every test hard-wires the concrete driver and a static field.

\`\`\`java
public class CheckoutTest {
    static WebDriver driver = new ChromeDriver();          // high-level policy depends on low-level detail
}
\`\`\`

*After:* high-level code (tests, pages) depends on an abstraction; the composition root decides the implementation.

\`\`\`java
import org.openqa.selenium.WebDriver;

public interface DriverProvider {
    WebDriver get();       // the driver for the current test thread
    void quit();
}

public final class ThreadLocalDriverProvider implements DriverProvider {
    private final ThreadLocal<WebDriver> current = new ThreadLocal<>();
    private final String browser;
    public ThreadLocalDriverProvider(String browser) { this.browser = browser; }

    @Override public WebDriver get() {
        WebDriver d = current.get();
        if (d == null) { d = DriverFactory.create(browser); current.set(d); }
        return d;
    }
    @Override public void quit() {
        WebDriver d = current.get();
        if (d != null) { try { d.quit(); } finally { current.remove(); } }   // remove(): no leak on pooled threads
    }
}
\`\`\`

Tests receive a \`DriverProvider\` (constructor injection, a TestNG \`ITestContext\` attribute, or a DI container such as Guice/PicoContainer with Cucumber). In unit tests of framework code you pass a fake provider; on the grid you pass a remote one. "Inversion" means the **interface is owned by the high-level module** (the framework core defines \`DriverProvider\`), and the low-level module (Selenium wiring) implements it.

## Nested, inner, local and anonymous classes (briefly)

| Kind | Declared | Has outer instance? | Typical use |
|---|---|---|---|
| static nested | \`static class Builder\` inside a class | no | builders, private helper types, \`Map.Entry\`-like types |
| inner (non-static) | \`class Row\` inside a class | **yes** — hidden reference to the outer object | a \`Row\` that reads its table page's driver |
| local | inside a method | captures effectively-final locals | rare |
| anonymous | \`new ExpectedCondition<>() { ... }\` | yes, if created in an instance context | one-off implementations; mostly replaced by lambdas |

The senior points: an inner class instance **keeps its outer object alive** (a memory-leak source if a listener outlives its page), so default to \`static\` nested; and an anonymous class's \`this\` is the anonymous object, while a lambda's \`this\` is the enclosing instance.

## Common mistakes and debugging

- **\`NullPointerException\` from \`BasePage\` constructor** with a field that is clearly initialised in the subclass — overridable method called from a superclass constructor. Read the stack: \`BasePage.<init>\` → \`LoginPage.readyMarker\`. Move the call out of the constructor.
- **Method "not overriding"** — a typo or different parameter type (\`equals(Product p)\` instead of \`equals(Object o)\` is an *overload*, so \`HashSet\` never calls it). Always put \`@Override\`; the compiler then says "method does not override or implement a method from a supertype".
- **\`HashSet\` keeps duplicates / \`contains\` returns false** — \`equals\` overridden without \`hashCode\`, or a field in the hash mutated after insertion. Debug by printing \`a.equals(b)\` and both \`hashCode()\`s.
- **\`ClassCastException: class MobileLoginPage cannot be cast to class DesktopLoginPage\`** in shared steps — LSP was "fixed" with casts. Fix the abstraction instead.
- **"class EmployeeTablePage inherits unrelated defaults for describe() from types Searchable and Sortable"** — the diamond rule; override and choose with \`X.super.describe()\`.

## Best practices for experienced engineers

- Make classes \`final\` unless designed for extension; make value objects immutable; prefer records for data.
- Keep \`BasePage\` thin; model visible regions as components; inject collaborators via constructors.
- Interfaces for capabilities (\`Searchable\`, \`HasHeader\`), owned by the framework core; implementations at the edges.
- Override \`equals\`, \`hashCode\` and \`toString\` together (or use records); never put secrets in \`toString\`.
- No overridable calls in constructors; no \`UnsupportedOperationException\` overrides; no static mutable state for drivers.
- Review rule: "if I add a browser, a layout or a page, how many existing files change?" — the answer should be one or zero.

## Interview questions

### Q: What is the difference between overloading and overriding at the JVM level?
**Short answer (30–60 s):** Overloading is resolved by the compiler from the declared types of the arguments — the chosen signature is written into the bytecode. Overriding is resolved at run time from the receiver's actual class via virtual dispatch (\`invokevirtual\`/\`invokeinterface\`, vtables/itables in HotSpot).

**Detailed answer:** Explain the three overload phases (no boxing → boxing → varargs) and "most specific", the \`log(5)\` → \`long\` example and why \`log(null)\` becomes ambiguous once \`String\`, \`Integer\` and \`int...\` overloads coexist. For overriding: slot index in the vtable, JIT devirtualisation through class hierarchy analysis and inline caches, so polymorphism is nearly free in hot code. Then list what is not dispatched: static (hidden), private, constructors, fields. A combined trick: \`void m(Object o)\` in Parent and \`void m(String s)\` in Child — \`Parent p = new Child(); p.m("x")\` calls Parent's \`m(Object)\` because Child's \`m(String)\` is an overload, invisible through the \`Parent\` type.

### Q: Abstract class or interface — how do you decide in a framework?
**Short answer (30–60 s):** Interface for a contract or capability, because a class can implement many and it keeps implementations swappable. Abstract class only when implementations share state and a fixed algorithm, like a Template Method lifecycle.

**Detailed answer:** Use the comparison table. Since Java 8 defaults let interfaces carry behaviour, so the remaining differences are state, constructors, non-public members and single inheritance. Mention the diamond rule and \`X.super.m()\`, \`sealed\` (Java 17) to restrict implementers, and that adding an abstract method to a published interface breaks every implementer while a default does not.

### Q: Composition or inheritance for page objects?
**Short answer (30–60 s):** Composition for page content — header, tables, modals as components — and at most a thin base for infrastructure. Inheritance couples every page to the base's needs and leads to god classes and fragile-base-class breakage.

**Detailed answer:** Show both designs, the comparison table, and the recommendation. Concrete argument: the login page has no header, so \`extends BasePage\` with header methods exposes nonsense APIs; a responsive layout is a different \`Header\` implementation injected at construction. Admit the trade-off: one more level of navigation in tests and slightly more wiring.

### Q: Explain the equals/hashCode contract and what breaks when you violate it.
**Short answer (30–60 s):** Equal objects must have equal hash codes. If you override \`equals\` without \`hashCode\`, hash-based collections look in the wrong bucket, so \`contains\` returns false and duplicates get in.

**Detailed answer:** Equivalence relation properties; \`getClass\` vs \`instanceof\` and the symmetry example with a subclass that adds state; mutable keys disappearing; \`BigDecimal\` scale; records generate component-wise equality and are final; arrays inside records compare by reference.

### Q: Give an LSP violation you would catch in a test framework.
**Short answer (30–60 s):** A subclass that throws \`UnsupportedOperationException\` or adds a precondition — e.g. a \`MobileLoginPage extends LoginPage\` whose \`rememberMe\` throws. Code written for \`LoginPage\` breaks when handed the subclass.

**Detailed answer:** Formalise: no stronger preconditions, no weaker postconditions, invariants preserved, no new exception types. Fix by splitting capabilities (ISP) — \`LoginScreen\` and \`SupportsRememberMe\` — and selecting tests by capability. Mention that \`getClass()\`-based \`equals\` also technically violates LSP.

### Q: How do you apply the Open/Closed principle to driver creation?
**Short answer (30–60 s):** Replace the switch with a registry of \`Supplier<WebDriver>\` keyed by name; new browsers are registered, not coded into the factory.

**Detailed answer:** Show the map, \`register\`, the error listing known keys. Compare with an enum holding a supplier (type-safe, closed set). Note that OCP is about the most frequent change axis — for browsers it is "add one"; do not abstract axes that never change.

### Q: Why should a test depend on a DriverProvider interface rather than a static driver?
**Short answer (30–60 s):** Dependency inversion: tests and pages depend on an abstraction, so the same code runs locally, on a grid or with a fake in unit tests, and per-thread drivers make parallel runs safe.

**Detailed answer:** Static drivers are shared across TestNG threads — races and wrong-window clicks. A \`ThreadLocal\`-backed provider with \`remove()\` in \`quit()\`; injection via constructor or a DI container; the framework core owns the interface. Trade-off: more indirection — worth it once there is more than one execution environment.

### Q: Can you override a static or private method? What about fields?
**Short answer (30–60 s):** No. Static methods are hidden — the declared type decides. Private methods are not visible to subclasses, so a same-named method is unrelated. Fields are hidden too and resolved by the declared type.

**Detailed answer:** Show the \`Page\`/\`InventoryPage\` snippet printing "Page", "page", "Products". Add that \`@Override\` on a static method is a compile error, which is a good way to prove it.

## Scenario-based questions

**1. A framework's \`BasePage\` is 1,800 lines and every change breaks unrelated pages.** I would not rewrite it in one go. First, measure: which methods are used by which pages (IDE call hierarchy). Extract cohesive groups into components (\`HeaderComponent\`, \`CookieBanner\`, \`TableComponent\`) that pages own, delegating from \`BasePage\` temporarily so tests keep compiling; mark the delegating methods \`@Deprecated\` pointing at the component. Move pages one by one, then delete the delegates. The base ends with the driver and the wait helper. Each step is a small, reviewable PR with the suite green.

**2. Parallel TestNG runs show a test adding products to another test's cart expectation.** The expected-cart object is a shared \`static final List\` that tests mutate. \`final\` only fixed the reference. I would make the test data immutable (records with \`List.copyOf\`, \`with...\` methods returning copies) and build expectations per test. Then add a unit test that the data class rejects mutation (\`UnsupportedOperationException\` on \`productNames().add\`).

**3. Mobile layout support is requested for 40 existing tests.** Rather than \`MobileXPage extends XPage\` overrides that throw for missing features (an LSP trap), introduce capability interfaces and layout-specific components selected by a factory from a \`layout\` system property. Tests that need a capability the layout lacks are excluded by group, not by try/catch.

## Tricky follow-ups

- **Does a subclass inherit private fields?** They are part of the object's memory, but not accessible by name in the subclass; access goes through inherited methods.
- **Can an interface have a constructor or instance field?** No. Fields are implicitly \`public static final\`.
- **Is a static interface method inherited by the implementing class?** No — call it as \`HasHeader.cartLink()\`, not via the implementer.
- **What does \`equals(Product p)\` do in a HashSet?** Nothing — it is an overload; the set calls \`equals(Object)\`, still the identity version.
- **Two classes are equal by \`equals\` but have different \`hashCode\` — what does \`HashSet.size()\` report after adding both?** Usually 2, because they land in different buckets and \`equals\` is never even called.`,
  keyPoints: [
    'Encapsulation protects invariants: validate in constructors, prefer immutable final classes/records, and copy collections defensively (List.copyOf, Java 10+) — unmodifiableList is only a view.',
    'Overloads are chosen by the compiler from declared types (no boxing → boxing → varargs, most specific wins); overrides are chosen at run time by virtual dispatch on the receiver\'s class.',
    'Static methods and fields are hidden, private methods and constructors are not polymorphic; overrides may use covariant return types and need @Override.',
    'Interfaces (default/static since 8, private since 9) are for capabilities; abstract classes for shared state plus a fixed algorithm; diamond conflicts: class wins, then the more specific interface, otherwise override and use X.super.m().',
    'Prefer composition (HeaderComponent, Actions) over a fat BasePage; keep any base class thin; never call overridable methods from constructors.',
    'equals/hashCode must agree; getClass() keeps symmetry with subclasses that add state, instanceof is right for final classes and records; toString makes failures readable — without secrets.',
    'SOLID in a framework: SRP (page vs data vs assertions), OCP (driver registry), LSP (no UnsupportedOperationException overrides), ISP (Searchable, Sortable), DIP (DriverProvider interface with ThreadLocal implementation).',
  ],
  mistakes: [
    'Calling an abstract/overridable method (e.g. waitUntilLoaded using readyMarker()) from the BasePage constructor, getting a null locator. Fix: read the stack (BasePage.<init> → subclass method), move the call into an explicit load step or static factory.',
    'Writing equals(Product other) instead of equals(Object o), so HashSet duplicate checks silently use identity. Fix: always annotate @Override; let the IDE or a record generate equals and hashCode together.',
    'Protecting test data with final fields and Collections.unmodifiableList of the caller\'s list, then seeing data change in parallel runs. Fix: List.copyOf / records with copying compact constructors, and per-test instances.',
    'Growing BasePage into a god class with header, table and modal methods for every page. Fix: extract components owned by the pages that have them; delegate temporarily and deprecate, then remove.',
    'Subclass overrides that throw UnsupportedOperationException (MobileLoginPage). Fix: split the contract into capability interfaces and select tests by capability instead of casting or catching.',
    'Static WebDriver fields shared across TestNG threads. Fix: a DriverProvider abstraction backed by ThreadLocal, with remove() in teardown.',
  ],
  tryIt: `Refactor a small ShopEasy framework in three steps. (1) Build \`Actions\`, \`HeaderComponent\` (\`#logged-in-user\`, \`#shopping-cart-link\`, \`#logout-link\`), \`InventoryPage\` (implements \`Sortable<ProductSort>\` over \`#product-sort\` with values \`az/za/lohi/hilo\`) and \`EmployeeTablePage\` (implements \`Searchable\` over \`#table-search\` on table.html) — no \`BasePage\`. (2) Write a \`Product\` value class (name + \`BigDecimal\` price) with \`equals\`/\`hashCode\`/\`toString\`, then a JUnit/TestNG test proving that \`new Product("Pulse Bike Light", new BigDecimal("7.49"))\` and the same with \`"7.490"\` are equal and collapse to one element in a \`HashSet\`; convert it to a record and explain what changes. (3) Replace a \`switch\`-based driver factory with the registry from the OCP section behind a \`DriverProvider\`, and add a unit test that uses a fake provider returning a mocked \`WebDriver\`. Finally, write two sentences you would say in a design review defending composition over inheritance.`,
  problems: ['java-006', 'java-009', 'java-010', 'java-024', 'java-033', 'java-039'],
}
