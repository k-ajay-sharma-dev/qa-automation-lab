export default {
  slug: 'pom-deep-creational-patterns',
  category: 'pom',
  order: 14,
  title: 'Deep dive: creational design patterns in test automation — Singleton, Factory, Builder, Object Mother',
  minutes: 30,
  summary: 'Decide how objects in a test framework get created — when a Singleton is legitimate (immutable config, a shared HTTP client) and why a Singleton WebDriver is not, Simple Factory vs Factory Method vs Abstract Factory with page and driver examples, fluent Test Data Builders with defaults, unique values and validation, Lombok vs hand-written vs records with withers, RestAssured RequestSpecBuilder, Object Mother vs builders vs file fixtures vs Faker, Prototype, and dependency injection as the thing that replaces most hand-made creational code.',
  manualAnalogy: `A manual tester never creates test data from scratch for every case: there is a "standard customer" you copy and change one field on, a checklist for setting up a fresh test account, and a rule that two testers never share one account on the same day. Creational patterns are those habits written in code — one place that knows how to build a valid customer, an order or a browser, so each test says only what is special about it. Get them wrong and you have the code version of a shared spreadsheet of test accounts that everyone edits at once.`,
  body: `## Where the earlier lessons stop

The beginner lessons used creation without naming it: *Fluent page objects* (lesson 3) returned the next page from a navigation method, *DriverManager, ThreadLocal and BaseTest* (lesson 8) kept one driver per thread, and *Scaling page objects* (lesson 10) introduced a flow class and PicoContainer for Cucumber state. The deep dives already cover several building blocks — this lesson points to them instead of repeating them:

- thread-safe singleton implementations (\`synchronized\`, double-checked locking, holder idiom, enum) and the \`ThreadLocal\` driver internals: \`java-deep-multithreading-synchronization\`
- browser factory variants (switch, \`Map<String, Supplier>\`, enum, \`ServiceLoader\`) and the \`DriverManager\`/\`BaseTest\` lifecycle: \`selenium-deep-parallel-execution\`
- immutability, records, \`List.copyOf\` and the Open/Closed factory map: \`java-deep-oop-and-solid\`
- driver lifecycle ownership and the action layer: \`selenium-deep-framework-design\`

Here the question is **design**: which creational pattern solves which framework problem, what it costs, what the simpler alternative is, and — just as important — when *not* to use it. Test code is read far more often than it is extended; a pattern that saves nothing today is pure cost.

\`\`\`
Who creates what in a typical ShopEasy framework

configuration ──► FrameworkConfig (one immutable instance)            Singleton (legitimately)
HTTP          ──► HttpClient / RequestSpecification (shared, immutable) Singleton / Builder
browser       ──► DriverFactory per target (local, Grid)                Factory Method
pages         ──► Pages / platform UI family                            Simple / Abstract Factory
test data     ──► UserBuilder, OrderBuilder + a few mother methods      Builder + Object Mother
wiring        ──► DI container per scenario (Cucumber)                  replaces most of the above
\`\`\`

## A cost model for patterns in test code

Before any pattern, ask three questions:

1. **Is there a second variant or a second consumer today?** A factory with one product, a strategy with one implementation, a builder for a two-field object — all are indirection with no payoff.
2. **Will a new joiner find the code from the test?** Every layer between "the test" and "the browser" is a place to look when a test fails at 2 a.m.
3. **Does it make parallel runs safer or riskier?** Creational code decides what is shared. Sharing mutable things is how suites become flaky.

Patterns that pass these questions — builders for rich test data, an immutable config singleton, a driver factory — earn their keep in almost every framework. Patterns that fail them become the "framework within a framework" that the next lesson lists as an anti-pattern.

## Singleton

### What it is and the problem it solves

A Singleton guarantees **one instance per JVM** (strictly: per class loader) and a global access point. In a framework it answers "load the configuration once" or "reuse one connection pool". The thread-safe implementations — eager \`static final\`, \`synchronized\` accessor, double-checked locking with \`volatile\`, the holder idiom and the enum singleton — are compared in \`java-deep-multithreading-synchronization\`. The short version: for framework code, use an **eager \`static final\` field** or the **holder idiom** (lazy, thread-safe through class initialisation, no locks); an enum when serialisation or reflection-safety matters, which it almost never does in tests.

### Why a Singleton WebDriver breaks parallel runs

\`\`\`java
public final class Browser {                       // the classic mistake
    private static WebDriver driver;
    public static WebDriver get() {
        if (driver == null) driver = new ChromeDriver();   // also a check-then-act race
        return driver;
    }
}
\`\`\`

\`\`\`
TestNG parallel="methods", thread-count="3"

thread-1  loginTest       ──► Browser.get() ──┐
thread-2  cartTest        ──► Browser.get() ──┼──► ONE ChromeDriver (one session, one window)
thread-3  checkoutTest    ──► Browser.get() ──┘
          → typing into each other's fields, one test's quit() kills the others' session
\`\`\`

Three separate problems hide in that class:

- **Shared state**: a browser session is the most mutable object in the suite — URL, cookies, \`sessionStorage\` (ShopEasy keeps \`shopeasy.user\` and \`shopeasy.cart\` there), focused frame, open alerts. One instance for all threads means every test sees every other test's state.
- **Lifecycle**: who quits it? If each test quits, the next test gets a dead session (\`NoSuchSessionException\`); if nobody quits, state leaks between tests even sequentially.
- **The lazy check is itself racy**: two threads can both see \`null\` and start two browsers, one of which is leaked.

Making the accessor \`synchronized\` fixes only the third. The driver is not a "one per JVM" object — it is **one per test** (or per thread at most), which is exactly what \`ThreadLocal\` or dependency injection express.

### Legitimate singletons in a framework

A singleton is fine when the object is **immutable** (or thread-safe by design) and **expensive or meaningless to create twice**.

\`\`\`java
package com.shopeasy.framework.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Properties;

/** Effective configuration: loaded once, never changed. */
public record FrameworkConfig(String env, String uiBaseUrl, String apiBaseUrl, String browser, boolean headless) {

    /** Global access point — lazy and thread-safe through class initialisation (holder idiom). */
    public static FrameworkConfig get() {
        return Holder.INSTANCE;
    }

    private static final class Holder {
        private static final FrameworkConfig INSTANCE = load();
    }

    static FrameworkConfig load() {
        String env = System.getProperty("env", "local");
        Properties file = new Properties();
        try (InputStream in = FrameworkConfig.class.getResourceAsStream("/config/" + env + ".properties")) {
            if (in != null) file.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read config for env " + env, e);
        }
        return new FrameworkConfig(env,
                pick(file, "ui.base.url", "http://localhost:5180/practice-site/"),
                pick(file, "api.base.url", "http://localhost:5181"),
                pick(file, "browser", "chrome"),
                Boolean.parseBoolean(pick(file, "headless", "true")));
    }

    private static String pick(Properties file, String key, String fallback) {
        return System.getProperty(key, file.getProperty(key, fallback));   // -D beats file beats default
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.api;

import java.net.http.HttpClient;
import java.time.Duration;

/** One HttpClient for the whole run: immutable, thread-safe, owns the connection pool. */
public final class Http {
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    private Http() { }

    public static HttpClient client() {
        return CLIENT;
    }
}
\`\`\`

Step by step:

- \`Holder.INSTANCE\` is initialised the first time \`get()\` touches \`Holder\`. The JVM guarantees class initialisation happens once and is visible to all threads — no \`volatile\`, no locks.
- \`FrameworkConfig\` is a **record**: final fields, no setters. A singleton that nobody can mutate cannot leak state between tests. A mutable "config singleton" with \`setBaseUrl()\` used by one test to point at a mock server is a shared-state bug waiting for \`parallel="methods"\`.
- The record's constructor stays **public**. The *access point* is a singleton, the *type* is not: a unit test of the URL builder can create \`new FrameworkConfig("unit", ...)\` without touching system properties. This is the testability problem of classic singletons solved by not hiding the constructor.
- \`HttpClient\` (\`java.net.http\`) is documented as immutable once built and usable from multiple threads; creating one per request wastes connection pools and threads. The same reasoning applies to a Jackson \`ObjectMapper\` that is configured once and then only used.

**RestAssured trap:** \`RestAssured.baseURI\`, \`RestAssured.requestSpecification\` and friends are **mutable static globals** — a Singleton by another name. Setting them in one test class while another runs in parallel changes the other's requests. Prefer an immutable \`RequestSpecification\` passed to \`given().spec(...)\` (Builder section below).

### Real-time scenario (ShopEasy)

A suite runs UI tests against \`http://localhost:5180/practice-site/\` and seeds data through the API on port 5181. The config singleton is read in \`@BeforeSuite\` to log the effective values; the shared \`HttpClient\` (or a shared \`RequestSpecification\`) is used by every thread to create users with \`POST /api/users\`. The driver, the logged-in token and the created user are **per test** — never singletons.

### Singleton vs dependency injection vs ThreadLocal

\`\`\`java
// 1. Singleton — global access, one instance per JVM
FrameworkConfig config = FrameworkConfig.get();

// 2. ThreadLocal holder — global access, one instance per thread (lesson 8, selenium-deep-parallel-execution)
WebDriver driver = DriverManager.getDriver();

// 3. Dependency injection — no global access; the object is handed in
public class CartSteps {
    private final BrowserSession browser;          // created by the container, one per scenario
    public CartSteps(BrowserSession browser) { this.browser = browser; }
}
\`\`\`

| | Singleton (static) | ThreadLocal holder | DI container (PicoContainer / Guice / Spring) |
|---|---|---|---|
| How it works | one instance in a static field | one instance per thread in a \`ThreadLocal\` map | container builds an object graph per scope (scenario, test) and injects it |
| Advantages | trivial; perfect for immutable, expensive objects | parallel-safe driver with minimal change to static-style code | no globals; scope explicit; dependencies visible in constructors; easy to substitute in unit tests |
| Disadvantages | hidden global coupling; wrong for anything mutable or per-test | hidden global; must \`remove()\`; breaks if work moves to another thread (async, \`parallelStream\`); pooled threads keep stale values | a library and its rules (constructor injection, scopes); "magic" for newcomers |
| Performance | best | negligible | negligible (object creation per scenario) |
| Maintainability | good while immutable | medium — lifecycle discipline required | high once understood |
| Scalability | fine for read-only | good for TestNG threads | best — also handles state beyond the driver (user, token, order) |
| When to use | config, shared \`HttpClient\`, \`ObjectMapper\`, read-only reference data | TestNG suites with a static-style \`DriverManager\` | Cucumber (PicoContainer is the default choice), larger TestNG suites |

**Recommended approach and why:** Singletons only for **immutable** infrastructure. For the driver and anything per-test, prefer **passing objects explicitly** (constructor injection) — with a DI container in Cucumber, where step classes cannot share fields otherwise. A \`ThreadLocal\` \`DriverManager\` is a pragmatic bridge for TestNG suites already written in static style; keep it to the driver and always \`remove()\` in teardown.

### When NOT to use a Singleton

- For **anything with per-test state**: driver, current user, token, "last order number", page objects, \`WebDriverWait\`, report nodes.
- As a convenient way to **avoid passing parameters** — that is the Service Locator anti-pattern (next lesson): every class can reach everything, so dependencies are invisible.
- For **test data caches** that tests mutate (a shared "default cart" list). A read-only cache is fine; see the caching proxy in the next lesson.
- When you need to **substitute** the object in a unit test and the singleton hides its constructor.

## The Factory family

Three related patterns, often confused in interviews:

| | Simple Factory | Factory Method | Abstract Factory |
|---|---|---|---|
| Shape | one class with a creation method (often a \`switch\` or explicit methods) | a superclass defines the creation algorithm; **subclasses** decide which concrete object is created | an interface that creates a **family of related objects**; one implementation per family |
| GoF pattern? | no (an idiom) | yes | yes |
| Varies | which product, by parameter | which product, by subclass | which *family*, by implementation |
| Framework example | \`Pages\` creating page objects | \`DriverFactory\` with \`ChromeDriverFactory\`, \`RemoteDriverFactory\` | \`ShopUi\` producing desktop or mobile-web \`LoginPage\` + \`CartPage\` |

### Simple Factory: a \`Pages\` creator for page objects

Not Selenium's \`PageFactory\` (that one *initialises \`@FindBy\` fields* — see lesson 6 and \`pom-deep-variants-pagefactory-loadable\`). This one *creates* page objects, so tests and flows do not repeat \`new XxxPage(driver, ...)\` with the same dependencies everywhere.

\`\`\`java
package com.shopeasy.framework.pages;

import java.lang.reflect.InvocationTargetException;
import java.util.Objects;
import org.openqa.selenium.WebDriver;

/** Creates page objects with the same collaborators. One instance per test (it holds the test's driver). */
public final class Pages {
    private final WebDriver driver;

    public Pages(WebDriver driver) {
        this.driver = Objects.requireNonNull(driver, "driver");
    }

    // Variant A — explicit methods: discoverable, refactor-safe, compile-time checked
    public LoginPage login()       { return new LoginPage(driver); }
    public InventoryPage inventory() { return new InventoryPage(driver); }
    public CartPage cart()         { return new CartPage(driver); }

    // Variant B — generic reflective creation: no method per page, but errors move to runtime
    public <T> T on(Class<T> pageType) {
        try {
            return pageType.getDeclaredConstructor(WebDriver.class).newInstance(driver);
        } catch (NoSuchMethodException e) {
            throw new IllegalArgumentException(pageType.getSimpleName() + " needs a (WebDriver) constructor", e);
        } catch (InvocationTargetException e) {
            throw new IllegalStateException("Could not open " + pageType.getSimpleName() + ": "
                    + e.getCause().getMessage(), e.getCause());   // e.g. a loadable-page check failed
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Cannot create " + pageType.getSimpleName(), e);
        }
    }
}
\`\`\`

Step by step:

- The factory **holds the per-test collaborators** (here only the driver; in a real framework also the action layer and waiter from \`selenium-deep-framework-design\`). When a new collaborator is added, one class changes instead of every \`new LoginPage(...)\` call.
- Variant A is boring and that is its strength: \`pages.cart()\` is found by the IDE, renamed safely, and fails at compile time.
- Variant B saves a method per page but turns a missing constructor into a runtime error, and \`InvocationTargetException\` must be unwrapped or the real failure (a loadable page's "not on cart.html" check) is hidden behind reflection noise.
- \`Pages\` is **not** a singleton and **not** static — it holds a test's driver, so it lives exactly as long as the test.

**When NOT to use it:** with fluent page objects (lesson 3), most pages are created by the previous page (\`login.loginAs(...)\` returns \`InventoryPage\`); a factory is only needed for **entry points** (the first page of a test, deep links). If your suite has five page classes and one constructor argument, \`new LoginPage(driver)\` is clearer than any factory. A reflective factory in a framework where every page has a different constructor is worse than no factory.

### Factory Method: the structure behind a \`DriverFactory\`

The *selection* of a browser (switch, map, enum, \`ServiceLoader\`) is compared in \`selenium-deep-parallel-execution\`. The Factory Method pattern is about the *structure*: a fixed creation algorithm in a superclass, with the "which concrete object" step deferred to subclasses.

\`\`\`java
package com.shopeasy.framework.driver;

import java.net.URL;
import org.openqa.selenium.Capabilities;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import com.shopeasy.framework.config.FrameworkConfig;

public abstract class DriverFactory<O extends Capabilities> {

    /** The algorithm is fixed (final); only the steps vary. */
    public final WebDriver create(FrameworkConfig config) {
        O options = baseOptions();
        if (config.headless()) {
            applyHeadless(options);
        }
        WebDriver driver = newDriver(options);           // ← the factory method
        driver.manage().window().setSize(new Dimension(1366, 768));
        return driver;
    }

    protected abstract O baseOptions();
    protected abstract void applyHeadless(O options);
    protected abstract WebDriver newDriver(O options);
}

final class ChromeDriverFactory extends DriverFactory<ChromeOptions> {
    @Override protected ChromeOptions baseOptions()               { return new ChromeOptions(); }
    @Override protected void applyHeadless(ChromeOptions options) { options.addArguments("--headless=new"); }
    @Override protected WebDriver newDriver(ChromeOptions options) { return new ChromeDriver(options); }
}

final class FirefoxDriverFactory extends DriverFactory<FirefoxOptions> {
    @Override protected FirefoxOptions baseOptions()               { return new FirefoxOptions(); }
    @Override protected void applyHeadless(FirefoxOptions options) { options.addArguments("-headless"); }
    @Override protected WebDriver newDriver(FirefoxOptions options) { return new FirefoxDriver(options); }
}

final class RemoteChromeDriverFactory extends DriverFactory<ChromeOptions> {
    private final URL gridUrl;
    RemoteChromeDriverFactory(URL gridUrl) { this.gridUrl = gridUrl; }

    @Override protected ChromeOptions baseOptions()               { return new ChromeOptions(); }
    @Override protected void applyHeadless(ChromeOptions options) { options.addArguments("--headless=new"); }
    @Override protected WebDriver newDriver(ChromeOptions options) { return new RemoteWebDriver(gridUrl, options); }
}
\`\`\`

Step by step:

- \`create\` is \`final\`: every driver gets the same headless handling and window size. This is Factory Method combined with Template Method (next lesson) — the usual real-world shape.
- The generic parameter \`O\` keeps each subclass type-safe: \`ChromeDriverFactory\` cannot accidentally receive \`FirefoxOptions\`.
- Local vs Grid is a different subclass, not an \`if\` inside every browser branch.
- Choosing *which* factory to use is a separate concern — a \`Map<String, Supplier<DriverFactory<?>>>\` keyed by \`config.browser()\` is enough (\`selenium-deep-parallel-execution\`).

**When NOT to use it:** if you support one browser locally and one on Grid, a single static method with a \`switch\` on two cases is shorter and easier to read than three classes and a generic type parameter. The class hierarchy pays off when there are several targets that share steps (Chrome/Firefox/Edge × local/Grid/cloud) — and even then, many teams prefer a flat \`Map<String, Supplier<WebDriver>>\` plus one shared \`configure(driver)\` method over inheritance.

### Abstract Factory: platform-specific page families

Problem: the same business tests ("locked-out user sees an error", "removing an item empties the cart") must run on a **desktop layout** and a **mobile-web layout** whose markup differs. Page objects for one layout must never be mixed with the other's.

ShopEasy's practice site has a single layout, so the mobile family below is **illustrative**: imagine the mobile layout collapses the header nav, so the plain "Cart" text link is not visible and the cart is reached only through the cart icon (\`#shopping-cart-link\`, \`data-testid="shopping-cart-link"\`).

\`\`\`java
package com.shopeasy.framework.pages.platform;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

// ── Products: what tests depend on ─────────────────────────────────────────────
public interface LoginPage {
    void open();
    void loginAs(String username, String password);
    String errorMessage();
}

public interface CartPage {
    void open();
    List<String> itemNames();
    void remove(String productSlug);
}

// ── The abstract factory ───────────────────────────────────────────────────────
public interface ShopUi {
    LoginPage loginPage();
    CartPage cartPage();

    static ShopUi forPlatform(String platform, WebDriver driver, String baseUrl) {
        return switch (platform) {
            case "desktop"    -> new DesktopShopUi(driver, baseUrl);
            case "mobile-web" -> new MobileWebShopUi(driver, baseUrl);
            default -> throw new IllegalArgumentException("Unknown platform '" + platform + "'");
        };
    }
}

// ── Desktop family ─────────────────────────────────────────────────────────────
final class DesktopShopUi implements ShopUi {
    private final WebDriver driver;
    private final String baseUrl;
    DesktopShopUi(WebDriver driver, String baseUrl) { this.driver = driver; this.baseUrl = baseUrl; }

    @Override public LoginPage loginPage() { return new SharedLoginPage(driver, baseUrl); }
    @Override public CartPage cartPage()   { return new DesktopCartPage(driver, baseUrl); }
}

final class DesktopCartPage implements CartPage {
    private static final By NAV_CART_LINK = By.cssSelector("nav a[href='cart.html']");  // plain "Cart" text link
    private static final By ITEM_NAMES = By.cssSelector("[data-testid='cart-item'] [data-testid='inventory-item-name']");
    private final WebDriver driver;
    private final String baseUrl;
    DesktopCartPage(WebDriver driver, String baseUrl) { this.driver = driver; this.baseUrl = baseUrl; }

    @Override public void open() {
        driver.get(baseUrl + "inventory.html");
        driver.findElement(NAV_CART_LINK).click();
    }
    @Override public List<String> itemNames() {
        return driver.findElements(ITEM_NAMES).stream().map(WebElement::getText).toList();
    }
    @Override public void remove(String productSlug) {
        driver.findElement(By.id("remove-" + productSlug)).click();
    }
}

// ── Mobile-web family (illustrative layout) ────────────────────────────────────
final class MobileWebShopUi implements ShopUi {
    private final WebDriver driver;
    private final String baseUrl;
    MobileWebShopUi(WebDriver driver, String baseUrl) { this.driver = driver; this.baseUrl = baseUrl; }

    @Override public LoginPage loginPage() { return new SharedLoginPage(driver, baseUrl); }   // same markup: reuse
    @Override public CartPage cartPage()   { return new MobileCartPage(driver, baseUrl); }
}

final class MobileCartPage implements CartPage {
    private static final By CART_ICON = By.cssSelector("[data-testid='shopping-cart-link']");
    private static final By ITEM_NAMES = By.cssSelector("[data-testid='cart-item'] [data-testid='inventory-item-name']");
    private final WebDriver driver;
    private final String baseUrl;
    MobileCartPage(WebDriver driver, String baseUrl) { this.driver = driver; this.baseUrl = baseUrl; }

    @Override public void open() {
        driver.get(baseUrl + "inventory.html");
        driver.findElement(CART_ICON).click();            // nav is collapsed on mobile
    }
    @Override public List<String> itemNames() {
        return driver.findElements(ITEM_NAMES).stream().map(WebElement::getText).toList();
    }
    @Override public void remove(String productSlug) {
        driver.findElement(By.cssSelector("[data-testid='remove-" + productSlug + "']")).click();
    }
}

// ── Shared product: identical markup on both platforms ─────────────────────────
final class SharedLoginPage implements LoginPage {
    private final WebDriver driver;
    private final String baseUrl;
    SharedLoginPage(WebDriver driver, String baseUrl) { this.driver = driver; this.baseUrl = baseUrl; }

    @Override public void open() { driver.get(baseUrl + "login.html"); }
    @Override public void loginAs(String username, String password) {
        driver.findElement(By.id("user-name")).sendKeys(username);
        driver.findElement(By.id("password")).sendKeys(password);
        driver.findElement(By.id("login-button")).click();
    }
    @Override public String errorMessage() {
        return driver.findElement(By.id("login-error-message")).getText();
    }
}
\`\`\`

(In a real project each top-level type is in its own file; they are shown together for reading. Waits are left out to keep the pattern visible — they belong in the action layer.)

A test is written once against the interfaces:

\`\`\`java
@Test
public void lockedOutUserSeesError() {
    ShopUi ui = ShopUi.forPlatform(System.getProperty("platform", "desktop"), driver, baseUrl);
    LoginPage login = ui.loginPage();
    login.open();
    login.loginAs("locked_out_user", "secret_sauce");
    assertThat(login.errorMessage()).isEqualTo("Error: Sorry, this user has been locked out.");
}
\`\`\`

Step by step:

- The test depends only on \`ShopUi\`, \`LoginPage\` and \`CartPage\` — the **products** — never on \`DesktopCartPage\`.
- One configuration value picks the **whole family**. You cannot accidentally use the desktop cart with the mobile login, because a test never constructs pages itself.
- A family may **share** a product (\`SharedLoginPage\`). Abstract Factory does not require every product to differ; it guarantees consistency of the set.
- Adding a product (a \`CheckoutPage\`) means touching the interface and **every** family — the pattern's known cost.

### Real-time scenario (ShopEasy)

The same 40 cart and checkout tests run nightly on a desktop window (1366×768) and on Chrome mobile emulation. Only the cart entry point and two components differ. The team starts with an Abstract Factory, measures, and finds 90% of page code identical — they collapse to **one** page per screen with a small injected \`HeaderNavigation\` strategy (desktop: nav link; mobile: icon). That is the typical outcome: Abstract Factory is right when *many* products differ per platform (native-like mobile web, a separate \`m.\` site, a white-label brand with different markup); when differences are local, a strategy or component injected into one page object is less code.

### Factory comparison

| | Simple Factory (\`Pages\`) | Factory Method (\`DriverFactory\`) | Abstract Factory (\`ShopUi\`) | No factory (\`new\`) |
|---|---|---|---|---|
| How it works | one class creates by method/parameter | subclass overrides the creation step of a fixed algorithm | one interface creates a consistent family; one implementation per platform | caller constructs directly |
| Advantages | one place for constructor dependencies; entry points discoverable | shared steps written once; type-safe per product | families never mixed; tests platform-agnostic | zero indirection, obvious |
| Disadvantages | can grow into a God factory; reflective variant fails at runtime | class per variant; inheritance coupling | every new product touches every family; many classes | dependencies repeated at call sites |
| Performance | negligible | negligible | negligible | best (irrelevant) |
| Maintainability | high if explicit | medium | medium–low if families are mostly identical | high for small suites |
| Scalability | good | good for many targets | good when platforms really differ | poor with many collaborators |
| When to use | page entry points with several collaborators | drivers with shared configuration steps | multi-platform UIs with many differing pages | small suites, fluent navigation |

**Recommended approach and why:** start with \`new\` plus fluent navigation; add a **Simple Factory** for entry points when constructors gain collaborators; use **Factory Method** for drivers if several targets share steps (otherwise a supplier map). Reach for **Abstract Factory** only after you have listed which pages differ per platform — if it is two of twenty, inject a strategy instead.

## Builder: test data that says only what matters

### The problem

\`POST /api/users\` takes \`username\` (3–40 characters of \`a-z 0-9 _ . -\`), \`password\` (at least 8), \`firstName\`, \`lastName\`, \`email\`, optional \`phone\` and \`address\`; a second registration with the same username returns \`409 USERNAME_TAKEN\`. A test about "invalid email returns 422 \`INVALID_EMAIL\`" should not spell out seven fields — the reader cannot see which one matters. And a hard-coded username makes the test pass once and then fail with 409 until the API is reset.

A **Test Data Builder** gives every field a valid default, generates unique values, lets the test override only what matters, and produces an **immutable** object.

### Structure

\`\`\`
test ──► UserBuilder.aUser()            defaults: valid, unique username/email
             .withEmail("not-an-email") override only what the test is about
             .build()                   validate business rules → immutable NewUser (record)
                    │
                    └─► buildUnvalidated()  for negative tests that need invalid data
\`\`\`

### Complete example: \`UserBuilder\` and \`OrderBuilder\`

\`\`\`java
package com.shopeasy.framework.data;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)          // absent optional fields are omitted, not sent as null
public record Address(String street, String city, String postalCode, String country) { }
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Request body for POST /api/users. Immutable; serialised by Jackson. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NewUser(String username, String password, String firstName, String lastName,
                      String email, String phone, Address address) {

    @Override
    public String toString() {                      // never print the password into reports
        return "NewUser[username=" + username + ", email=" + email + "]";
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

public final class UserBuilder {
    private static final AtomicLong SEQUENCE = new AtomicLong();
    private static final String RUN_ID = Long.toString(System.currentTimeMillis(), 36);   // lower-case, 8 chars

    private String username = "qa_" + RUN_ID + "_" + SEQUENCE.incrementAndGet();         // unique per JVM run
    private String password = "Passw0rd-123";
    private String firstName = "Asha";
    private String lastName = "Rao";
    private String email;                                         // derived from username unless set
    private String phone = "+91-80-5550-0199";
    private Address address = new Address("12 MG Road", "Bengaluru", "560001", "IN");

    private UserBuilder() { }

    public static UserBuilder aUser() {
        return new UserBuilder();
    }

    public UserBuilder withUsername(String username)   { this.username = username; return this; }
    public UserBuilder withPassword(String password)   { this.password = password; return this; }
    public UserBuilder withName(String first, String last) { this.firstName = first; this.lastName = last; return this; }
    public UserBuilder withEmail(String email)         { this.email = email; return this; }
    public UserBuilder withoutPhone()                  { this.phone = null; return this; }
    public UserBuilder withoutAddress()                { this.address = null; return this; }
    public UserBuilder livingIn(String city, String postalCode, String country) {
        this.address = new Address("1 Test Street", city, postalCode, country);
        return this;
    }

    /** Valid data only — fails fast if a test produced something the API would reject. */
    public NewUser build() {
        NewUser user = buildUnvalidated();
        List<String> problems = new ArrayList<>();
        if (user.username() == null || !user.username().matches("[a-z0-9_.-]{3,40}"))
            problems.add("username must be 3-40 of [a-z0-9_.-] but was '" + user.username() + "'");
        if (user.password() == null || user.password().length() < 8)
            problems.add("password must be at least 8 characters");
        if (user.email() == null || !user.email().contains("@"))
            problems.add("email looks invalid: " + user.email());
        if (!problems.isEmpty())
            throw new IllegalStateException("UserBuilder produced invalid data " + problems
                    + " - use buildUnvalidated() for negative tests");
        return user;
    }

    /** Whatever the test asked for, including invalid data for negative tests. */
    public NewUser buildUnvalidated() {
        String mail = email != null ? email : username + "@shopeasy.test";
        return new NewUser(username, password, firstName, lastName, mail, phone, address);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import java.math.BigDecimal;

/** Reference data mirrored from the ShopEasy seed (ids and prices of GET /api/products). */
public enum Product {
    TRAILBLAZER_BACKPACK(1, "trailblazer-backpack", "29.99"),
    PULSE_BIKE_LIGHT(2, "pulse-bike-light", "9.99"),
    CLASSIC_CREW_T_SHIRT(3, "classic-crew-t-shirt", "15.99"),
    STORM_FLEECE_JACKET(4, "storm-fleece-jacket", "49.99"),
    JUNIOR_ONESIE(5, "junior-onesie", "7.99"),
    RETRO_RED_TEE(6, "retro-red-tee", "15.99");

    public final int id;
    public final String slug;
    public final BigDecimal price;

    Product(int id, String slug, String price) {
        this.id = id;
        this.slug = slug;
        this.price = new BigDecimal(price);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public record OrderLine(int productId, int quantity) { }

/** Request body for POST /api/orders. items == null means "order the current cart". */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderRequest(String firstName, String lastName, String postalCode, List<OrderLine> items) {
    public OrderRequest {
        items = items == null ? null : List.copyOf(items);   // defensive, unmodifiable copy
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import java.util.ArrayList;
import java.util.List;

public final class OrderBuilder {
    private String firstName = "Asha";
    private String lastName = "Rao";
    private String postalCode = "560001";
    private List<OrderLine> items = new ArrayList<>();
    private boolean fromCart;

    private OrderBuilder() { }

    public static OrderBuilder anOrder() { return new OrderBuilder(); }

    public OrderBuilder shippingTo(String first, String last, String postalCode) {
        this.firstName = first; this.lastName = last; this.postalCode = postalCode;
        return this;
    }
    public OrderBuilder with(Product product)               { return with(product, 1); }
    public OrderBuilder with(Product product, int quantity) { items.add(new OrderLine(product.id, quantity)); return this; }
    public OrderBuilder fromCurrentCart()                   { this.fromCart = true; return this; }

    public OrderRequest build() {
        if (fromCart && !items.isEmpty())
            throw new IllegalStateException("Either fromCurrentCart() or explicit items, not both");
        if (!fromCart && items.isEmpty())
            throw new IllegalStateException("Order has no items - add with(...) or use fromCurrentCart()");
        for (OrderLine line : items)
            if (line.quantity() < 1 || line.quantity() > 10)
                throw new IllegalStateException("quantity must be 1..10 but was " + line.quantity()
                        + " - use buildUnvalidated() for negative tests");
        return buildUnvalidated();
    }

    public OrderRequest buildUnvalidated() {
        return new OrderRequest(firstName, lastName, postalCode, fromCart ? null : items);
    }
}
\`\`\`

The **expected** totals are computed by a separate oracle, not by the builder — a builder that also computes expectations ends up sharing the bug it should catch:

\`\`\`java
package com.shopeasy.framework.data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

public record ExpectedTotals(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {
    private static final BigDecimal TAX_RATE = new BigDecimal("0.08");

    public static ExpectedTotals of(Map<Product, Integer> quantities) {
        BigDecimal subtotal = quantities.entrySet().stream()
                .map(e -> e.getKey().price.multiply(BigDecimal.valueOf(e.getValue())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        return new ExpectedTotals(subtotal, tax, subtotal.add(tax));
    }
}
\`\`\`

Using them:

\`\`\`java
NewUser invalidEmail = UserBuilder.aUser().withEmail("not-an-email").buildUnvalidated();
// POST /api/users → expect 422 INVALID_EMAIL

OrderRequest order = OrderBuilder.anOrder()
        .with(Product.TRAILBLAZER_BACKPACK)
        .with(Product.PULSE_BIKE_LIGHT)
        .build();
ExpectedTotals expected = ExpectedTotals.of(Map.of(Product.TRAILBLAZER_BACKPACK, 1, Product.PULSE_BIKE_LIGHT, 1));
// 29.99 + 9.99 = 39.98 · tax 8% = 3.1984 → 3.20 · total 43.18
\`\`\`

Step by step:

- **Defaults are valid and boring.** Asha Rao in Bengaluru (\`560001\`) mirrors the seeded \`standard_user\` profile, so a reader recognises it; nothing in the defaults is "interesting".
- **Unique values** come from a run id plus an \`AtomicLong\`: thread-safe, readable in logs (\`qa_m3k9x2a1_17\`), within the 40-character limit and the \`[a-z0-9_.-]\` alphabet. A random UUID also works but is longer and harder to trace.
- **\`build()\` vs \`buildUnvalidated()\`** — the most important design decision in a test-data builder. Validation in \`build()\` catches a test author's mistake early ("you built a 7-character password and expect 201"), but negative tests *need* invalid data. Two explicit methods keep both honest; a builder that silently "fixes" invalid input would hide what the test sends.
- **\`@JsonInclude(NON_NULL)\`** makes \`withoutPhone()\` mean "field absent". Sending \`"phone": null\` and omitting \`phone\` are different requests; a negative test for "missing first name" must decide which one it means.
- **Records** make the result immutable; the compact constructor copies the list, so mutating the builder after \`build()\` cannot change an order already sent.
- \`toString\` is overridden so the password never lands in a report — a record's generated \`toString\` prints every component.
- **\`ExpectedTotals\`** uses \`BigDecimal\` with \`HALF_UP\` to two places — the same rounding the app applies to the 8% tax line. It is an independent oracle; the test compares API and UI totals against it.

### Real-time scenario (ShopEasy)

A checkout test for the overview page needs a logged-in user with two items in the cart. The test creates a fresh user with \`UserBuilder.aUser().build()\` through \`POST /api/users\` (unique username, so parallel threads never collide), logs in through the UI or a session shortcut, adds the backpack and the bike light, and asserts the overview shows \`$39.98\`, \`$3.20\` and \`$43.18\` from \`ExpectedTotals\`. The validation pack for registration uses \`buildUnvalidated()\` with one field changed per case — each test's single \`with...\` call names the field under test.

### Builders with validation: where should rules live?

| Rule type | Where | Example |
|---|---|---|
| Structural invariants (non-null collections, defensive copies) | record compact constructor | \`items = List.copyOf(items)\` |
| Business rules the API enforces | builder \`build()\` — bypassable with \`buildUnvalidated()\` | username pattern, password length, quantity 1–10 |
| Combinations that make no sense to the builder itself | \`build()\`, never bypassable | "fromCurrentCart **and** explicit items" |
| Expected outcomes | a separate oracle | \`ExpectedTotals\` |

Never validate business rules in the **record constructor** — you could not represent invalid requests at all, and negative tests would need raw JSON strings.

### Lombok \`@Builder\` vs hand-written vs records with withers

\`\`\`java
// A — Lombok on a record (generates NewUserBuilder, builder(), toBuilder())
@lombok.Builder(toBuilder = true)
public record NewUser(String username, String password, String firstName, String lastName,
                      String email, String phone, Address address) {

    /** Defaults live in a factory that pre-fills the generated builder. */
    public static NewUserBuilder aUser() {
        String name = "qa_" + java.util.UUID.randomUUID().toString().substring(0, 8);
        return builder().username(name).password("Passw0rd-123").firstName("Asha").lastName("Rao")
                .email(name + "@shopeasy.test");
    }
}
// NewUser.aUser().email("not-an-email").build();
// existing.toBuilder().phone(null).build();
\`\`\`

\`\`\`java
// B — record with hand-written withers (no builder class at all)
public record CustomerRef(String firstName, String lastName, String postalCode) {
    public static CustomerRef asha() { return new CustomerRef("Asha", "Rao", "560001"); }
    public CustomerRef withPostalCode(String postalCode) { return new CustomerRef(firstName, lastName, postalCode); }
}
// CustomerRef.asha().withPostalCode("12")
\`\`\`

Notes on A: Lombok's \`@Builder.Default\` is designed for fields with initialisers, which record components cannot have, so defaults go into a static factory that returns a pre-filled builder. Lombok also offers \`@With\` for withers and \`@Singular\` for collection components. It is annotation processing — the generated code is invisible in the source, needs the IDE plugin, and the build must be configured for it.

| | Lombok \`@Builder\` | Hand-written builder | Record + withers |
|---|---|---|---|
| How it works | annotation processor generates the builder at compile time | explicit class with defaults, \`with...\` methods and \`build()\` | static factory for the default + one \`withX\` per field returning a new record |
| Advantages | no boilerplate; \`toBuilder()\` for copies | defaults, unique values, domain verbs (\`livingIn\`, \`fromCurrentCart\`), validation, \`buildUnvalidated()\` | no extra class; immutable at every step; trivial to read |
| Disadvantages | defaults and validation need extra code anyway; generated names only (\`email(...)\`), no domain verbs; tooling dependency | boilerplate to maintain when fields change | a wither per field; awkward beyond ~5 fields or with nested objects |
| Performance | same | same | a new object per wither (irrelevant) |
| Maintainability | high for DTOs | high if kept small and focused | high for small value objects |
| Scalability | good for many DTOs | good for the 5–10 central domain objects | poor for wide objects |
| When to use | large API DTO sets, teams already on Lombok | central test data (user, order, customer) with rules and uniqueness | small value objects (checkout form data, address) |

**Recommended approach and why:** hand-written builders for the **few central domain objects** whose defaults, uniqueness and validation carry testing knowledge; records with withers for small value objects; Lombok (or generated DTOs from an OpenAPI spec) for the long tail of request/response classes where a generated builder is enough.

### A real-world Builder you already use: RestAssured \`RequestSpecBuilder\`

\`\`\`java
package com.shopeasy.framework.api;

import static io.restassured.RestAssured.given;

import com.shopeasy.framework.config.FrameworkConfig;
import com.shopeasy.framework.data.NewUser;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;
import java.util.Map;

public final class ShopApi {
    private final RequestSpecification anonymous;
    private static final ResponseSpecification JSON_RESPONSE =
            new ResponseSpecBuilder().expectContentType(ContentType.JSON).build();

    public ShopApi(FrameworkConfig config) {
        this.anonymous = new RequestSpecBuilder()
                .setBaseUri(config.apiBaseUrl())
                .setBasePath("/api")
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .build();
    }

    public String loginToken(String username, String password) {
        return given().spec(anonymous)
                .body(Map.of("username", username, "password", password))
                .when().post("/auth/login")
                .then().spec(JSON_RESPONSE).statusCode(200)
                .extract().path("token");
    }

    public RequestSpecification authenticated(String token) {
        return new RequestSpecBuilder()
                .addRequestSpecification(anonymous)               // start from the shared base
                .addHeader("Authorization", "Bearer " + token)
                .build();
    }

    public int register(NewUser user) {
        return given().spec(anonymous).body(user)
                .when().post("/users")
                .then().spec(JSON_RESPONSE).statusCode(201)
                .extract().path("id");
    }
}
\`\`\`

\`RequestSpecBuilder\` shows the textbook Builder properties: step-by-step configuration, a \`build()\` that returns a specification, and composition of a base spec with per-test additions (\`addRequestSpecification\`). Building immutable specs per test — instead of setting \`RestAssured.baseURI\` and global filters — is what keeps API setup safe in parallel runs.

### When NOT to use a builder

- For objects with **two or three fields** and no defaults that matter: \`new OrderLine(1, 2)\` is clearer than \`OrderLineBuilder.aLine().withProductId(1).withQuantity(2).build()\`.
- When the builder **re-implements the application's rules** (tax, discounts, eligibility). That is a second implementation of the product, and it will drift. Builders produce *inputs*; oracles compute *expectations* from explicit, simple formulas.
- When every test overrides **every** field — the defaults are wrong, or the data belongs in a data provider table.
- One builder per **DTO version** of a large API — generate DTOs instead of hand-writing builders for 80 classes.

## Object Mother, Test Data Builder, file fixtures, Faker

### The four approaches

\`\`\`java
// 1. Object Mother — named, ready-made objects
public final class Users {
    private Users() { }
    public static NewUser customerInBengaluru() { return UserBuilder.aUser().build(); }
    public static NewUser customerWithoutAddress() { return UserBuilder.aUser().withoutAddress().build(); }
    public static NewUser customerInSweden() { return UserBuilder.aUser().livingIn("Stockholm", "11151", "SE").build(); }
}

// 2. Test Data Builder — defaults + overrides (above)
NewUser u = UserBuilder.aUser().withEmail("asha+promo@shopeasy.test").build();

// 3. Fixtures from files — data/users/customer-in-sweden.json read with Jackson
NewUser fromFile = new com.fasterxml.jackson.databind.ObjectMapper()
        .readValue(Users.class.getResourceAsStream("/data/users/customer-in-sweden.json"), NewUser.class);

// 4. Data factory with Faker (Datafaker, net.datafaker) — realistic random values
net.datafaker.Faker faker = new net.datafaker.Faker(new java.util.Random(42));
NewUser random = UserBuilder.aUser()
        .withName(faker.name().firstName(), faker.name().lastName())
        .build();
\`\`\`

(Reading the file throws \`IOException\`; the snippet shows the idea, not the exception handling.)

| | Object Mother | Test Data Builder | Fixtures from files (JSON/YAML/CSV) | Faker data factory |
|---|---|---|---|---|
| How it works | static methods returning named, complete objects | defaults + fluent overrides + \`build()\` | data deserialised from resources | random realistic values, optionally seeded |
| Advantages | names express intent (\`customerInSweden\`); one-line arrange | each test shows exactly what differs; uniqueness and validation built in | non-coders can read/edit; large payloads; shared with other tools | finds input-handling bugs (unicode names, long strings); realistic demos |
| Disadvantages | method explosion (\`customerInSwedenWithoutPhoneAndLocked\`); hidden details; changes ripple to many tests | boilerplate per builder | no compile-time checks; duplication across files; uniqueness needs templating; hard to see what matters | non-reproducible failures unless seeded; can generate invalid data (a postcode the API rejects); obscures the test's intent |
| Performance | fast | fast | file I/O (negligible unless huge) | fast |
| Maintainability | degrades as variants multiply | high | low–medium | medium |
| Scalability | poor beyond ~10 variants | good | good for big, stable payloads | good for volume data |
| When to use | a handful of named personas | default for test data in code | contract payloads, big reference documents, cross-tool data | volume, exploratory and robustness data, never as the only data |

**Recommended approach and why:** **builders as the base, with a few named Mother methods on top** (\`Users.customerInSweden()\` implemented *with* the builder). Mothers give readable names for the 3–5 personas the team talks about; builders give per-test precision without an explosion of methods. Use file fixtures for large, stable documents (a full order history response for a contract test), and Faker for fields where variety finds bugs (names, street lines) — **seeded and logged**, so a failure can be reproduced. In parallel runs a single seeded \`Faker\` shared across threads no longer yields reproducible values per test (threads interleave); seed per test (for example from the test name) when reproducibility matters.

### Common mistakes with test data creation

- **Hard-coded unique fields** (\`username = "asha_test"\`) — passes once, then \`409 USERNAME_TAKEN\` until \`POST /api/reset\`, and that endpoint wipes **everyone's** data, which is not parallel-safe.
- **Mothers that return shared instances** (\`static final NewUser STANDARD = ...\`) of mutable classes — one test changes it, another fails. Return new objects, or make them immutable records.
- **Unseeded Faker** in assertions: the failure log says "expected Zoë O'Brien" and the next run cannot reproduce the apostrophe bug.
- **Builders that mirror production logic** (computing the discounted total the same way the app does).

## Prototype: clone a base object

Prototype creates new objects by **copying an existing one** and changing what differs. In older Java code that meant \`Cloneable\` and \`clone()\`; in test code it shows up as "copy the standard order and change the postal code".

\`\`\`java
OrderRequest base = OrderBuilder.anOrder().with(Product.STORM_FLEECE_JACKET).build();
OrderRequest invalidZip = new OrderRequest(base.firstName(), base.lastName(), "12", base.items());  // copy + change
\`\`\`

Why it is usually replaced: \`clone()\` is shallow (two orders sharing one mutable items list), \`Cloneable\` is a broken interface (no \`clone()\` method on it), and copy constructors must be updated for every new field. **Records with withers**, Lombok's \`toBuilder()\` or simply calling the builder again express the same idea safely. Prototype still makes sense when an object is **expensive to obtain** and immutable — for example, a large product catalogue response fetched once and copied into per-test variations.

## Dependency injection: the pattern that replaces patterns

Most hand-made creational code in a framework — singletons for "the" driver, factories that pass the same three collaborators to every page, holders for "the current user" — exists to answer one question: *how does this class get the objects it needs?* A DI container answers it generically: classes declare dependencies in their **constructors**, and the container creates and wires them in a defined **scope**.

\`\`\`java
package com.shopeasy.steps;

import com.shopeasy.framework.config.FrameworkConfig;
import io.cucumber.java.After;
import io.cucumber.java.en.Given;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

/** One instance per scenario, created by PicoContainer on first use. No static, no ThreadLocal. */
public class BrowserSession {
    private WebDriver driver;

    public WebDriver driver() {
        if (driver == null) {
            driver = new ChromeDriver();       // in a real framework: the DriverFactory chosen by config
        }
        return driver;
    }

    public void close() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }
}

class LoginSteps {
    private final BrowserSession browser;      // same instance as in Hooks, for this scenario only

    public LoginSteps(BrowserSession browser) {
        this.browser = browser;
    }

    @Given("{string} is logged in")
    public void isLoggedIn(String username) {
        browser.driver().get(FrameworkConfig.get().uiBaseUrl() + "login.html");
        // ... LoginPage(browser.driver()).loginAs(username, "secret_sauce")
    }
}

class Hooks {
    private final BrowserSession browser;
    public Hooks(BrowserSession browser) { this.browser = browser; }

    @After
    public void closeBrowser() { browser.close(); }
}
\`\`\`

(Step classes must be \`public\` for Cucumber; they are shown in one block for reading.)

What changed compared with the singleton and \`ThreadLocal\` versions:

- \`BrowserSession\` is an ordinary class. **PicoContainer** (\`cucumber-picocontainer\`) creates one per scenario and injects the same instance into every step class and hook of that scenario; parallel scenarios get separate object graphs, so no \`ThreadLocal\` is needed.
- Dependencies are visible in constructors — a step class that needs the API client says so.
- Unit tests of a step or helper can pass a fake \`BrowserSession\`.

Alternatives: **Guice** (\`cucumber-guice\`, scenario scope via \`@ScenarioScoped\`) and **Spring** (\`cucumber-spring\`, \`@CucumberContextConfiguration\` and \`@ScenarioScope\`) when the team needs modules, interfaces bound to implementations or already uses Spring. TestNG can also create test classes through Guice (\`@Guice(modules = ...)\`). The Cucumber section of this handbook covers the wiring, scopes and lifecycle in depth; the point here is the design consequence: **with a DI container, most singletons and factories in a framework disappear**, and the remaining creational code is builders for data.

**When NOT to add a container:** a TestNG suite of 150 tests with a working \`ThreadLocal\` driver and constructor-passed pages gains little from Guice; the container is one more thing to learn and debug. Adopt DI where the framework forces you to share objects between classes you do not instantiate (Cucumber step classes) or where manual wiring has become a maze.

## Playwright (TypeScript) equivalent

Playwright's **fixtures** are a built-in DI container with scopes (\`test\` or \`worker\`): the \`page\` fixture is the per-test driver, so there is no driver singleton or \`ThreadLocal\` to write. Factories and builders stay plain TypeScript.

\`\`\`ts
type Fixtures = { pages: Pages; newUser: NewUser };

export const test = base.extend<Fixtures>({
  pages: async ({ page }, use) => { await use(new Pages(page)); },          // Simple Factory as a fixture
  newUser: async ({ request }, use) => {
    const user = aUser().build();                                           // same Builder idea
    const res = await request.post('http://localhost:5181/api/users', { data: user });
    expect(res.status()).toBe(201);
    await use(user);
  },
});
\`\`\`

Details of fixture design are in \`pw-deep-fixtures-pom-components\`.

## Best practices for experienced engineers

- **Share only immutable things.** Config records, \`HttpClient\`, specs. Everything per-test is created per test and passed in.
- **Prefer constructors to global access.** If a class needs the driver, take it as a constructor argument. Global accessors (singletons, \`ThreadLocal\` getters) belong at the edge — base test, hooks — not inside pages.
- **One builder per central domain object**, with valid boring defaults, unique identifiers and an explicit \`buildUnvalidated()\` for negative tests.
- **Name personas, not permutations**: a few Mother methods implemented with builders.
- **Separate inputs from expectations**: builders create requests; small oracles compute expected values with explicit formulas.
- **Seed and log randomness.**
- **Make data unique, not global-reset dependent**: never rely on \`POST /api/reset\` in parallel or shared environments.
- **Delete patterns that stopped paying**: a factory with one product, an Abstract Factory with identical families, a builder for a two-field record.

## Interview questions

### Q: Is Singleton an anti-pattern in test automation?
**Short answer (30–60 s):** Not by itself — it is right for immutable, expensive infrastructure like configuration or a shared HTTP client. It is wrong for anything with per-test state, above all the WebDriver, because it is global mutable state that breaks parallel runs and hides dependencies.

**Detailed answer:** The two problems of classic singletons are shared mutable state and hidden coupling. Immutability removes the first; keeping the type's constructor public (and the singleton only an access point) keeps unit tests possible. For the driver I use per-test creation with constructor injection, a \`ThreadLocal\` holder in TestNG suites written in static style, or a DI container in Cucumber. I also watch for "accidental singletons" such as RestAssured's static configuration fields — they behave exactly like a mutable singleton in parallel runs.

### Q: Explain Simple Factory, Factory Method and Abstract Factory with framework examples.
**Short answer (30–60 s):** Simple Factory is a class that creates objects by parameter — a \`Pages\` class creating page objects. Factory Method defers the creation step of a fixed algorithm to subclasses — \`DriverFactory.create\` configures every driver the same way while \`ChromeDriverFactory\` decides \`newDriver\`. Abstract Factory creates consistent families — a \`ShopUi\` that produces desktop or mobile-web \`LoginPage\` and \`CartPage\` together.

**Detailed answer:** The difference is what varies: a parameter, a subclass, or a family. Abstract Factory's cost is that a new product touches every family, so I use it only when many pages differ per platform; when differences are local I inject a strategy or component into one page object. For drivers, the selection mechanism (switch, supplier map, enum, \`ServiceLoader\`) is a separate decision from the factory structure.

### Q: How do you design test data builders?
**Short answer (30–60 s):** Valid, boring defaults for every field; unique values for fields with uniqueness constraints; fluent overrides so each test states only what matters; an immutable result such as a record; validation in \`build()\` plus an explicit \`buildUnvalidated()\` for negative tests.

**Detailed answer:** For ShopEasy's \`POST /api/users\`, the username default is \`qa_<runId>_<sequence>\` from an \`AtomicLong\` — parallel-safe and traceable. \`@JsonInclude(NON_NULL)\` makes "field absent" explicit and different from "field null". Records give immutability; compact constructors hold only structural invariants, never business rules, so invalid requests can still be represented. Expected values are computed by a separate oracle (\`ExpectedTotals\` with \`BigDecimal\` and \`HALF_UP\` for the 8% tax), not by the builder. I override \`toString\` so passwords never reach reports.

### Q: Object Mother or Test Data Builder?
**Short answer (30–60 s):** Both, layered: builders as the base, a handful of named Mother methods for the personas the team talks about, implemented with the builder.

**Detailed answer:** A pure Mother explodes into permutation names and hides what each test depends on; changing one Mother method silently changes many tests. A pure builder is precise but repetitive for common personas. Files suit large stable payloads; Faker suits variety, but must be seeded and logged, and seeding per test is needed for reproducibility under parallel execution.

### Q: Lombok \`@Builder\`, hand-written builder or records with withers?
**Short answer (30–60 s):** Hand-written for the few central objects whose defaults, uniqueness and validation carry testing knowledge; records with withers for small value objects; Lombok or generated DTOs for the long tail.

**Detailed answer:** Lombok removes boilerplate but gives generated method names only, and defaults on records still need a factory that pre-fills the builder because \`@Builder.Default\` targets field initialisers. It also adds annotation processing and IDE-plugin dependence. Withers become unwieldy beyond about five fields or with nested objects. The hand-written builder is where domain verbs live (\`livingIn\`, \`fromCurrentCart\`) and where \`buildUnvalidated()\` documents negative testing intent.

### Q: How does dependency injection change creational design in a framework?
**Short answer (30–60 s):** It replaces most singletons, holders and factories: classes declare dependencies in constructors and the container creates them per scope. In Cucumber, PicoContainer gives each scenario its own object graph, so a driver session object needs no static or \`ThreadLocal\`.

**Detailed answer:** Scope is the key concept — per scenario for the browser session, user and token; per run for immutable config. Guice or Spring add modules and interface bindings when needed. Without Cucumber, plain constructor passing often suffices; I would not add a container to a small TestNG suite that already works.

### Q: Where would you use Prototype in test code?
**Short answer (30–60 s):** Rarely as \`clone()\`; the idea survives as "copy a base object and change one field", which records with withers, \`toBuilder()\` or a builder express more safely.

**Detailed answer:** \`Cloneable\` is shallow and awkward; copies share mutable collections. The remaining legitimate case is an expensive, immutable object fetched once (a full catalogue response) from which tests derive variations.

## Scenario-based questions

**1. A suite of 900 TestNG tests uses \`Browser.getInstance()\` everywhere and the team wants \`parallel="methods"\`.** I would not start by converting everything to DI. Step one: make the accessor return a per-thread driver (\`ThreadLocal\` behind the same static method), add \`remove()\` in \`@AfterMethod(alwaysRun = true)\`, and grep for every other static mutable field (current user, last order id, cached pages). Step two: run with two threads, fix the shared-state failures, increase threads. Step three, over time: pass the driver into pages via constructors so the global accessor is used only in the base test. I would report progress as "tests that pass in parallel" and suite time, not as "patterns adopted".

**2. Registration tests fail randomly with \`409 USERNAME_TAKEN\` on the shared staging environment.** The data is not unique per run and per thread — probably a hard-coded username or a timestamp with second precision. Fix in the builder: run id + atomic sequence (or UUID) in the default username, never in individual tests. Do not "fix" it with \`POST /api/reset\`: it wipes everyone's data. Then add a lint-style review rule: no literal usernames in tests except the seeded \`standard_user\` and \`locked_out_user\`.

**3. A teammate proposes an Abstract Factory for "desktop vs mobile" with 30 page interfaces and 60 implementations.** I would ask for a diff: how many pages actually differ? If it is the header and the cart entry point, one page object per screen with an injected \`HeaderNavigation\` strategy is a fraction of the code. If the mobile site is a different application (separate markup across most screens), the Abstract Factory is justified — and then I would insist the test layer depends only on interfaces and that the platform is chosen once, from config.

## Tricky follow-ups

- **Q: Is a \`static final\` immutable config object thread-safe without \`volatile\`?** Yes — static initialisation is guaranteed by the JVM to complete before any thread uses the class, and the values are final and immutable.
- **Q: Does making \`getInstance()\` \`synchronized\` make a Singleton WebDriver safe for parallel tests?** No — it only stops two drivers being created; all threads still share one browser session.
- **Q: Should a builder validate in the record constructor?** Only structural invariants. Business rules there make invalid requests unrepresentable, and negative tests need them.
- **Q: Is Selenium's \`PageFactory\` a Factory pattern?** Not really — it does not choose or create page objects; it initialises annotated fields with lazy proxies (lesson 6; internals in \`pom-deep-variants-pagefactory-loadable\`). A class that creates page objects is better called \`Pages\` to avoid confusion.
- **Q: Two threads share one seeded \`Faker\` — are values reproducible?** Not per test: the sequence is consumed in whatever order threads call it. Seed per test if you need reproducibility.`,
  keyPoints: [
    'Use Singletons only for immutable or thread-safe infrastructure (config record, HttpClient, specs); a Singleton WebDriver is global mutable state that breaks parallel runs and hides lifecycle.',
    'Keep the singleton an access point, not a hidden constructor — tests can still build their own instances. Watch for accidental singletons such as RestAssured static configuration.',
    'Simple Factory varies by parameter (Pages entry points), Factory Method by subclass (DriverFactory with a fixed create algorithm), Abstract Factory by family (desktop vs mobile-web LoginPage + CartPage).',
    'Abstract Factory pays off only when many products differ per platform; for local differences inject a strategy or component into one page object.',
    'Test Data Builders: valid boring defaults, unique values from a run id and an AtomicLong, fluent overrides, immutable records, validation in build() and an explicit buildUnvalidated() for negative tests.',
    'Builders produce inputs; separate oracles compute expectations (ExpectedTotals with BigDecimal and HALF_UP for the 8% tax) so test data never re-implements product logic.',
    'Default data strategy: builders with a few named Object Mother methods on top; files for large stable payloads; Faker only seeded and logged.',
    'Dependency injection (PicoContainer per Cucumber scenario, Guice, Spring) replaces most singletons and factories; adopt it where the framework creates the classes that need to share objects.',
  ],
  mistakes: [
    'A static or singleton WebDriver "because it is easier to reach from pages" — parallel tests type into one browser and one quit() kills all sessions. Fix: per-test drivers passed into pages via constructors; a ThreadLocal holder or a DI container at the edges only.',
    'A mutable configuration singleton that tests change at runtime (setBaseUrl for one test) — other threads silently use the new value. Fix: an immutable config record; per-test variations are new objects passed explicitly.',
    'Builders that validate business rules in the record constructor, making negative tests impossible without raw JSON. Fix: structural invariants in the constructor, business rules in build(), and buildUnvalidated() for negative cases.',
    'Hard-coded usernames and emails in tests, then POST /api/reset to "fix" 409 USERNAME_TAKEN — which wipes other runs\' data. Fix: unique defaults in the builder (run id + AtomicLong or UUID).',
    'An Object Mother with 40 permutation methods (customerInSwedenWithoutPhoneLocked) that hides what each test depends on. Fix: a builder as the base and only a few named personas built with it.',
    'An Abstract Factory with 30 interfaces whose desktop and mobile implementations are 90% identical. Fix: one page per screen with an injected strategy or component for the parts that differ; keep Abstract Factory for genuinely different families.',
  ],
  tryIt: `Against the ShopEasy API (\`http://localhost:5181\`) and site (\`http://localhost:5180/practice-site/\`): (1) write \`FrameworkConfig\` as an immutable record with a holder-idiom \`get()\`, and a \`ShopApi\` that builds its \`RequestSpecification\` with \`RequestSpecBuilder\` — no \`RestAssured.baseURI\`; (2) write \`UserBuilder\` with unique usernames and \`build()\`/\`buildUnvalidated()\`, then three API tests: valid registration (201), invalid email (422 \`INVALID_EMAIL\`) and a 7-character password (400 \`VALIDATION_FAILED\`) — run them twice in a row without \`POST /api/reset\` and with TestNG \`parallel="methods"\` to prove uniqueness; (3) write \`OrderBuilder\` and \`ExpectedTotals\`, place an order for the Storm Fleece Jacket and the Junior Onesie with \`POST /api/orders\`, and check subtotal, 8% tax and total against the oracle; (4) add a \`Users\` mother with two personas built on the builder; (5) sketch (no need to run) the \`ShopUi\` Abstract Factory for desktop vs mobile-web and write down which pages actually differ — then decide whether a strategy would be enough.`,
  problems: ['pom-021', 'pom-027', 'pom-011'],
}
