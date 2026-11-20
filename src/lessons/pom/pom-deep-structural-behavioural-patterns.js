export default {
  slug: 'pom-deep-structural-behavioural-patterns',
  category: 'pom',
  order: 15,
  title: 'Deep dive: structural and behavioural patterns in test frameworks — Facade, Decorator, Strategy, Template Method and more',
  minutes: 30,
  summary: 'Apply structural and behavioural patterns to a Selenium framework the way a senior does — each with the framework problem it solves, its structure, working code, the simpler alternative and when not to use it: Facade flows, Adapters over drivers, API clients and reporting libraries, hand-written vs proxy Decorators, lazy and caching Proxies, Composite pages, login/wait/environment Strategies, Template Method test bases, Observer listeners, Command with an undo stack, Chain of Responsibility for failure classification and State for the checkout wizard — plus a selection table, test-code anti-patterns with refactoring recipes, and how to talk about patterns in an interview.',
  manualAnalogy: `An experienced manual tester already uses these ideas without the names: "place a standard order" is one instruction that hides ten screens (Facade); the same test case is run with "log in normally" or "use the pre-logged-in test link" depending on what is being tested (Strategy); every test case follows the same template — preconditions, steps, expected result, clean-up — with only the middle changing (Template Method); and you undo your setup in reverse order at the end of the day (Command with an undo list). The skill a senior adds is knowing when the extra structure is worth it — and when a plain checklist is enough.`,
  body: `## Where the earlier lessons stop

*Scaling page objects* (lesson 10) introduced a thin flow class (\`OrderFlow.reachOverview\`) and Screenplay; *BasePage and components* (lesson 5) contrasted inheritance with composition. The deep dives cover pieces this lesson builds on — read them for depth, not repeated here:

- composition vs inheritance for page objects, SOLID with framework examples: \`java-deep-oop-and-solid\`
- the action layer, \`WebDriverListener\` + \`EventFiringDecorator\`, God \`BasePage\`: \`selenium-deep-framework-design\`
- PageFactory proxy internals, \`LoadableComponent\`, fluent pages and sealed outcome types: \`pom-deep-variants-pagefactory-loadable\`
- page components in depth: the components deep dive (\`pom-deep-components-and-reusable-methods\`); Playwright components and fixtures: \`pw-deep-fixtures-pom-components\`
- creational patterns (Singleton, factories, builders, DI): \`pom-deep-creational-patterns\`
- the evidence-collecting TestNG listener: \`selenium-deep-troubleshooting-flaky-tests\`; exception classification and retries: \`java-deep-exception-design\`

For each pattern below: the **framework problem**, the **structure**, **code**, the **simpler alternative**, and **when not to use it**. The rule that runs through the whole lesson: *a pattern is justified by a second variant or a second consumer that exists today, not one you imagine.*

## Facade: a flow layer over many page objects

### The problem

Forty tests need "a standard user has bought the backpack and the bike light" before checking something else: the confirmation number format, the order history API, the empty cart afterwards. Each repeats six page objects in sequence. When the cart gains a "confirm age" dialog, forty tests change.

### Structure

\`\`\`
test ──► CheckoutFlow.purchase(user, products, customer)          one call, business vocabulary
              │
              ├─► LoginPage ──► InventoryPage ──► CartPage
              └─► CheckoutPage ──► CheckoutOverviewPage ──► CheckoutCompletePage
              ◄── OrderConfirmation(orderNumber, summary)            a value, not a page
\`\`\`

A Facade gives a **simplified interface to a subsystem**; the subsystem (page objects) stays fully usable for tests that need the detail.

### Complete example

\`\`\`java
package com.shopeasy.framework.flows;

import com.shopeasy.framework.data.CustomerRef;
import com.shopeasy.framework.data.Product;
import com.shopeasy.framework.pages.CartPage;
import com.shopeasy.framework.pages.CheckoutCompletePage;
import com.shopeasy.framework.pages.CheckoutOverviewPage;
import com.shopeasy.framework.pages.InventoryPage;
import com.shopeasy.framework.pages.LoginPage;
import com.shopeasy.framework.pages.OrderSummary;
import java.util.List;
import java.util.Objects;
import org.openqa.selenium.WebDriver;

/** Business-level journeys over the page objects. No assertions, no locators. */
public final class CheckoutFlow {

    public record TestUser(String username, String password) {
        public static final TestUser STANDARD = new TestUser("standard_user", "secret_sauce");
        @Override public String toString() { return "TestUser[" + username + "]"; }   // never log passwords
    }

    public record OrderConfirmation(String orderNumber, OrderSummary summary) { }

    private final WebDriver driver;

    public CheckoutFlow(WebDriver driver) {
        this.driver = Objects.requireNonNull(driver);
    }

    /** Stop point 1: items in the cart, cart page open. */
    public CartPage fillCart(TestUser user, List<Product> products) {
        if (products.isEmpty()) throw new IllegalArgumentException("fillCart needs at least one product");
        InventoryPage inventory = new LoginPage(driver).open().loginAs(user.username(), user.password());
        products.forEach(p -> inventory.addToCart(p.slug));
        return inventory.header().openCart();
    }

    /** Stop point 2: overview shown — for tests about totals and tax. */
    public CheckoutOverviewPage reachOverview(TestUser user, List<Product> products, CustomerRef customer) {
        return fillCart(user, products).checkout().fillWith(customer).continueToOverview();
    }

    /** The full purchase — for tests about what happens after an order. */
    public OrderConfirmation purchase(TestUser user, List<Product> products, CustomerRef customer) {
        CheckoutOverviewPage overview = reachOverview(user, products, customer);
        OrderSummary summary = overview.summary();          // read before the section is replaced
        CheckoutCompletePage complete = overview.finish();
        return new OrderConfirmation(complete.orderNumber(), summary);
    }
}
\`\`\`

(The page objects are the ones from the earlier lessons: fluent navigation, \`header()\` component, \`OrderSummary\` record with \`BigDecimal\` subtotal, tax and total. \`CustomerRef\` and \`Product\` come from \`pom-deep-creational-patterns\`.)

Step by step:

- **Stop points** (\`fillCart\`, \`reachOverview\`, \`purchase\`) are the design decision that matters. Lesson 10 had one method; real suites need the journey to stop where the test starts being interesting. Each stop point reuses the previous one, so the journey exists once.
- \`purchase\` returns a **value** (\`OrderConfirmation\`), not a page: tests about the order do not need the completion page; tests that do can call \`reachOverview(...).finish()\` themselves.
- The overview summary is read **before** \`finish()\` — on ShopEasy the overview and the confirmation are sections of the same \`checkout.html\`, and finishing hides the overview. A facade is where such sequencing knowledge lives once.
- **No assertions.** A guard that fails fast with a clear message ("products must not be empty") is fine; checking the total is the test's job.
- The facade depends on pages; pages never depend on the facade.

### Real-time scenario (ShopEasy)

\`\`\`java
@Test
public void orderNumberHasShopEasyFormat() {
    OrderConfirmation confirmation = new CheckoutFlow(driver()).purchase(
            TestUser.STANDARD, List.of(Product.TRAILBLAZER_BACKPACK, Product.PULSE_BIKE_LIGHT), CustomerRef.asha());

    assertThat(confirmation.orderNumber()).matches("SE-\\\\d{6}");
    assertThat(confirmation.summary().total()).isEqualByComparingTo("43.18");   // 39.98 + 3.20 tax
}
\`\`\`

### Alternatives

| | Facade flow class | Static helper methods (\`TestSteps.buy(...)\`) | Screenplay tasks | API arrange + UI assert |
|---|---|---|---|---|
| How it works | instance with collaborators, methods per business journey and stop point | static methods taking the driver | one class per task, composed by an actor | preconditions through \`POST /api/...\` or storage seeding; UI only for the behaviour under test |
| Advantages | simple, discoverable, testable, no new concepts | even simpler | small composable units; excellent reuse at scale | fastest and least flaky setup |
| Disadvantages | can grow into a God flow | static coupling; hard to vary collaborators | many classes and concepts; learning curve | needs an API/backdoor; the UI path is not covered by these tests |
| Performance | UI-bound | UI-bound | UI-bound | best |
| Maintainability | high while per-domain | medium | high in large teams | high |
| Scalability | good up to a few hundred tests per domain | poor | best for multi-team suites | best |
| When to use | default once a journey repeats in 3+ tests | throwaway or tiny suites | large BDD suites, several squads | whenever the journey is not what the test is about |

**Recommended approach and why:** a facade per business domain (\`CheckoutFlow\`, \`AccountFlow\`) with explicit stop points, **plus** API arrangement where the UI path is not under test. Keep a few full-UI journeys as smoke tests. Move to Screenplay when several teams contribute and flows start duplicating each other's steps.

### When NOT to use it

- When a journey appears in **one or two tests** — inline page calls are clearer.
- When the facade starts accepting **flags** (\`purchase(user, products, true, false, null)\`) to serve every test — split stop points or let tests compose pages.
- When it **hides the behaviour under test**: a checkout test must not call \`purchase\`; it must drive the step it is about.

## Adapter: one interface over different drivers, clients and libraries

### The problem

Tests need to arrange a cart. For a pure API test it should go through \`POST /api/cart/items\`; for a UI test the UI must see it — and ShopEasy's UI cart lives in the browser's \`sessionStorage\` (\`shopeasy.cart\`, a JSON array of product slugs), which is **separate** from the API cart. Two incompatible interfaces (a \`JavascriptExecutor\`, a REST client) must look the same to the test arrangement code.

An Adapter **converts one interface into another that clients expect**. The difference from Facade: a facade *simplifies* many classes; an adapter *translates* one interface into another.

### Complete example

\`\`\`java
package com.shopeasy.framework.arrange;

import com.shopeasy.framework.data.Product;
import java.util.List;

/** The interface the arrange code expects. */
public interface CartGateway {
    void add(Product product);
    List<Product> contents();
    void clear();
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.arrange;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopeasy.framework.data.Product;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

/** Adapts the browser's sessionStorage cart to CartGateway. The driver must be on the ShopEasy origin. */
public final class BrowserStorageCartGateway implements CartGateway {
    private static final String KEY = "shopeasy.cart";
    private static final ObjectMapper JSON = new ObjectMapper();
    private final WebDriver driver;

    public BrowserStorageCartGateway(WebDriver driver) {
        this.driver = driver;
    }

    @Override public void add(Product product) {
        List<String> slugs = new ArrayList<>(readSlugs());
        if (!slugs.contains(product.slug)) slugs.add(product.slug);      // the app keeps one of each
        writeSlugs(slugs);
    }

    @Override public List<Product> contents() {
        return readSlugs().stream()
                .map(slug -> Arrays.stream(Product.values()).filter(p -> p.slug.equals(slug)).findFirst()
                        .orElseThrow(() -> new IllegalStateException("Unknown slug in cart: " + slug)))
                .toList();
    }

    @Override public void clear() {
        js().executeScript("window.sessionStorage.removeItem(arguments[0]);", KEY);
    }

    private List<String> readSlugs() {
        Object raw = js().executeScript("return window.sessionStorage.getItem(arguments[0]);", KEY);
        if (raw == null) return List.of();
        try {
            return JSON.readValue(raw.toString(), new TypeReference<List<String>>() { });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cart in sessionStorage is not a JSON array: " + raw, e);
        }
    }

    private void writeSlugs(List<String> slugs) {
        try {
            js().executeScript("window.sessionStorage.setItem(arguments[0], arguments[1]);",
                    KEY, JSON.writeValueAsString(slugs));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private JavascriptExecutor js() {
        return (JavascriptExecutor) driver;
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.arrange;

import static io.restassured.RestAssured.given;

import com.shopeasy.framework.data.Product;
import io.restassured.specification.RequestSpecification;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Adapts the ShopEasy cart API to CartGateway. The spec carries base URI and Bearer token. */
public final class ApiCartGateway implements CartGateway {
    private final RequestSpecification authenticated;

    public ApiCartGateway(RequestSpecification authenticated) {
        this.authenticated = authenticated;
    }

    @Override public void add(Product product) {
        given().spec(authenticated).body(Map.of("productId", product.id))
                .when().post("/cart/items")
                .then().statusCode(201);
    }

    @Override public List<Product> contents() {
        List<Integer> ids = given().spec(authenticated)
                .when().get("/cart")
                .then().statusCode(200)
                .extract().jsonPath().getList("items.productId", Integer.class);
        return ids.stream()
                .map(id -> Arrays.stream(Product.values()).filter(p -> p.id == id).findFirst().orElseThrow())
                .toList();
    }

    @Override public void clear() {
        given().spec(authenticated).when().delete("/cart").then().statusCode(204);
    }
}
\`\`\`

Step by step:

- Each adapter **translates**: \`add(Product)\` becomes a JavaScript storage write or a \`POST\` with \`{ "productId": 1 }\`. The arrange code never sees \`executeScript\` or status codes.
- The storage adapter respects the app's semantics (one of each slug) — an adapter that writes duplicates would create a state the real UI cannot produce, and tests would pass on an impossible cart.
- \`sessionStorage\` belongs to the **current origin**: the driver must already be on \`localhost:5180\`, and the header badge only updates on the next page load (the app reads storage when a page initialises). Adapters should document such contracts.
- **Honest limitation:** these two adapters do not touch the same cart. The interface lets the *arrange code* be written once, but which adapter a test gets depends on whether the test is a UI or an API test. On an application where the UI reads the server-side cart, the API adapter would serve both.

### Adapting a third-party reporting library

\`\`\`java
package com.shopeasy.framework.reporting;

import io.qameta.allure.Allure;
import java.io.ByteArrayInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** What the framework needs from "a report". */
public interface StepReporter {
    void step(String name);
    void attachPng(String name, byte[] png);
}

/** Adapter for Allure. */
final class AllureStepReporter implements StepReporter {
    @Override public void step(String name) { Allure.step(name); }
    @Override public void attachPng(String name, byte[] png) {
        Allure.addAttachment(name, "image/png", new ByteArrayInputStream(png), "png");
    }
}

/** Adapter for plain logs — used in unit tests of the framework and in local runs. */
final class LogStepReporter implements StepReporter {
    private static final Logger LOG = LoggerFactory.getLogger(LogStepReporter.class);
    @Override public void step(String name) { LOG.info("STEP {}", name); }
    @Override public void attachPng(String name, byte[] png) { LOG.info("attachment {} ({} bytes)", name, png.length); }
}
\`\`\`

Framework code calls \`reporter.step("Add Trailblazer Backpack to cart")\`; switching from Allure to Extent (\`ExtentTest.info(...)\`) or running without any report library touches one class.

**Alternatives and recommendation:** calling the library directly is fine when the library *is* the team's long-term choice and is used in a handful of places. The adapter pays off when (a) the library is used from many framework classes, (b) you need to run framework unit tests without it, or (c) a migration is likely. Do not wrap **Selenium** itself in an adapter "in case we move to Playwright" — the APIs differ in waiting, locators and lifecycle, so the adapter either leaks or becomes a lowest-common-denominator framework nobody can debug.

### When NOT to use it

- To wrap an API you control and could simply change.
- As a speculative "vendor independence" layer around the core tool of the framework.
- When the two sides do not share semantics — an interface that pretends they do (the two carts above) misleads; name and document the difference.

## Decorator: adding behaviour by wrapping

### The problem

You want logging, timing or highlighting around driver calls without touching every page. Inheritance (\`class LoggingChromeDriver extends ChromeDriver\`) fixes the browser at compile time and multiplies classes (logging × timing × Chrome × Firefox). A Decorator **implements the same interface as the object it wraps**, forwards calls, and adds behaviour; decorators can be stacked.

\`selenium-deep-framework-design\` covers the production answer — \`WebDriverListener\` with Selenium 4's \`EventFiringDecorator\` — and its pitfalls (casts, synchronous listeners, suppressed exceptions). Here the focus is the pattern itself and the hand-written vs proxy choice.

### Hand-written decorator

\`\`\`java
package com.shopeasy.framework.driver;

import java.util.List;
import java.util.Set;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.WrapsDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class LoggingWebDriver implements WebDriver, WrapsDriver {
    private static final Logger LOG = LoggerFactory.getLogger(LoggingWebDriver.class);
    private final WebDriver delegate;

    public LoggingWebDriver(WebDriver delegate) { this.delegate = delegate; }

    @Override public void get(String url) {
        LOG.info("open {}", url);
        delegate.get(url);
    }
    @Override public WebElement findElement(By by) {
        LOG.debug("find {}", by);
        return delegate.findElement(by);            // NOTE: the element is NOT decorated
    }
    @Override public List<WebElement> findElements(By by) {
        LOG.debug("find all {}", by);
        return delegate.findElements(by);
    }
    @Override public String getCurrentUrl()          { return delegate.getCurrentUrl(); }
    @Override public String getTitle()               { return delegate.getTitle(); }
    @Override public String getPageSource()          { return delegate.getPageSource(); }
    @Override public void close()                    { LOG.info("close window"); delegate.close(); }
    @Override public void quit()                     { LOG.info("quit session"); delegate.quit(); }
    @Override public Set<String> getWindowHandles()  { return delegate.getWindowHandles(); }
    @Override public String getWindowHandle()        { return delegate.getWindowHandle(); }
    @Override public TargetLocator switchTo()        { return delegate.switchTo(); }
    @Override public Navigation navigate()           { return delegate.navigate(); }
    @Override public Options manage()                { return delegate.manage(); }
    @Override public WebDriver getWrappedDriver()    { return delegate; }
}
\`\`\`

What this example teaches by its gaps:

- **Elements escape the decorator.** \`findElement\` returns the raw element, so \`click()\` is not logged. Decorating elements means a \`LoggingWebElement\` implementing ~18 \`WebElement\` methods — and \`switchTo()\`, \`navigate()\`, \`manage()\` return undecorated objects too.
- **Interfaces are lost.** The decorator implements \`WebDriver\` only, so \`(JavascriptExecutor) driver\` and \`(TakesScreenshot) driver\` throw \`ClassCastException\`. Implementing them means more forwarding methods.
- **\`WrapsDriver\`** lets code that needs the real driver unwrap it — a convention Selenium's own decorators follow.

### Dynamic proxy decorator

\`\`\`java
package com.shopeasy.framework.driver;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class TimingProxy {
    private static final Logger LOG = LoggerFactory.getLogger(TimingProxy.class);
    private TimingProxy() { }

    public static WebDriver wrap(WebDriver target) {
        Set<Class<?>> interfaces = new LinkedHashSet<>();
        for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
            interfaces.addAll(Arrays.asList(c.getInterfaces()));    // WebDriver, JavascriptExecutor, TakesScreenshot, ...
        }
        return (WebDriver) Proxy.newProxyInstance(target.getClass().getClassLoader(),
                interfaces.toArray(Class<?>[]::new),
                (proxy, method, args) -> {
                    long start = System.nanoTime();
                    try {
                        return method.invoke(target, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();                              // rethrow the real Selenium exception
                    } finally {
                        long ms = (System.nanoTime() - start) / 1_000_000;
                        if (ms > 2_000) LOG.warn("slow command {} took {} ms", method.getName(), ms);
                    }
                });
    }
}
\`\`\`

The proxy keeps **all** interfaces of the concrete driver (casts to \`JavascriptExecutor\` work; casts to \`ChromeDriver\` still do not), and one handler covers every method. Returned elements are still raw unless the handler wraps return values — which is exactly what \`EventFiringDecorator\` does for elements, navigation, alerts, windows and frames.

### Comparison

| | Hand-written decorator | JDK dynamic proxy | \`EventFiringDecorator\` + \`WebDriverListener\` | \`WebDriverDecorator\` subclass |
|---|---|---|---|---|
| How it works | class implements the interface and forwards each method | runtime proxy, one \`InvocationHandler\` for all methods | Selenium's proxy fires listener events around every call, decorating returned objects | Selenium's decorator base class you extend to change behaviour |
| Advantages | explicit, debuggable, can change behaviour per method | little code; keeps all interfaces | covers driver, elements, navigation, alerts; maintained by Selenium | can alter calls (not only observe) with Selenium doing the wrapping |
| Disadvantages | forwarding boilerplate; loses interfaces; returned objects escape | reflection, stack traces through the proxy; returned objects escape | observe-only; listener exceptions suppressed by default; proxy breaks concrete casts | more complex API; marked \`@Beta\` like the listener API |
| Performance | negligible | small reflective overhead | small per call | small per call |
| Maintainability | low (every Selenium interface change) | medium | high | medium |
| When to use | wrapping a **small** interface you own (\`StepReporter\`, \`CartGateway\`) | quick cross-cutting concern in framework code | logging, timing, highlighting of every command | rare: behaviour changes at the driver level |

**Recommended approach and why:** for \`WebDriver\`, use \`EventFiringDecorator\` for observation and the action layer for behaviour (\`selenium-deep-framework-design\`). Hand-written decorators shine on **your own small interfaces** — e.g. a \`RetryingCartGateway\` that decorates \`ApiCartGateway\` with a retry on \`503\`, or a \`TimedStepReporter\`.

### When NOT to use it

- Stacking five decorators around the driver "for flexibility" — every call goes through five layers and nobody knows which one swallowed the exception.
- Decorating to **change** waits or retries invisibly — failures become timing-dependent and unexplainable. Behaviour belongs in explicit code.

## Proxy: controlling access — lazy elements and cached data

Proxy has the same shape as Decorator (same interface, wraps a subject) but a different **intent**: control *access* — lazily, remotely, with caching or protection — rather than add behaviour.

**PageFactory is a proxy factory.** \`PageFactory.initElements\` hands each \`@FindBy\` field to a \`FieldDecorator\` (\`DefaultFieldDecorator\`), which creates a \`java.lang.reflect.Proxy\` whose handler (\`LocatingElementHandler\`) finds the element **on every method call** via an \`ElementLocator\`. That is a *virtual proxy*: the real element is obtained only when used. \`@CacheLookup\` turns it into a caching proxy — and caches a reference that goes stale after a re-render. Internals and the \`AjaxElementLocatorFactory\` polling variant are in \`pom-deep-variants-pagefactory-loadable\`.

### A caching proxy for test data

\`\`\`java
package com.shopeasy.framework.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ProductView(int id, String slug, String name, BigDecimal price, boolean inStock) { }
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import java.util.List;

public interface ProductCatalog {
    List<ProductView> all();
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import static io.restassured.RestAssured.given;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.restassured.specification.RequestSpecification;
import java.util.List;

/** Real subject: GET /api/products (page size max 50 — enough for the seed). */
public final class ApiProductCatalog implements ProductCatalog {
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Page(List<ProductView> data, int total) { }

    private final RequestSpecification spec;
    public ApiProductCatalog(RequestSpecification spec) { this.spec = spec; }

    @Override public List<ProductView> all() {
        Page page = given().spec(spec).queryParam("size", 50)
                .when().get("/products")
                .then().statusCode(200)
                .extract().as(Page.class);
        if (page.total() > page.data().size())
            throw new IllegalStateException("Catalogue has " + page.total() + " products; paging not implemented");
        return page.data();
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.data;

import java.util.List;

/** Proxy: same interface, fetches once per run, returns an immutable snapshot. */
public final class CachingProductCatalog implements ProductCatalog {
    private final ProductCatalog real;
    private volatile List<ProductView> cache;

    public CachingProductCatalog(ProductCatalog real) { this.real = real; }

    @Override public List<ProductView> all() {
        List<ProductView> local = cache;
        if (local == null) {
            synchronized (this) {
                local = cache;
                if (local == null) {
                    local = List.copyOf(real.all());
                    cache = local;
                }
            }
        }
        return local;
    }
}
\`\`\`

Step by step: callers depend on \`ProductCatalog\` and cannot tell whether they got the proxy; the proxy uses double-checked locking with \`volatile\` (why it is correct: \`java-deep-multithreading-synchronization\`) and returns an unmodifiable copy so no test can mutate the shared snapshot. A data-driven test that iterates "every in-stock product" (\`retro-red-tee\` has stock 0 in the seed, so \`inStock\` is false) reads the catalogue once per run instead of once per test.

### When NOT to use it

- **Data the run mutates** — carts, orders, users, stock if orders reduce it. A cached "current cart" is shared state with extra steps.
- Per-test data — caching it across tests creates order dependence.
- When the call is cheap — a 20 ms local API call per test class does not need a proxy, a lock and a cache-invalidation story.

## Composite: pages made of components

Composite treats **a part and a whole uniformly**: a page is a tree of components (header, product cards, cart items, dialogs), and an operation on the whole — "wait until ready", "describe yourself for a failure message" — is applied recursively to the parts. Component design (root elements, scoping, collections of cards) is covered in the components deep dive (\`pom-deep-components-and-reusable-methods\`) and \`pw-deep-fixtures-pom-components\`; the pattern-level idea fits in a few lines:

\`\`\`java
package com.shopeasy.framework.ui;

import java.util.List;

public interface UiPart {
    String name();
    void awaitReady();                       // leaf: waits for its root; composite: waits for all children
}

public abstract class CompositePage implements UiPart {
    private final List<UiPart> parts;

    protected CompositePage(UiPart... parts) { this.parts = List.of(parts); }

    @Override public void awaitReady() {
        for (UiPart part : parts) {
            part.awaitReady();               // e.g. HeaderComponent waits for [data-testid='shopping-cart-link']
        }
    }
}
\`\`\`

\`CartPage\` composed of \`HeaderComponent\` and a list of \`CartItemComponent\` (each rooted at \`[data-testid='cart-item']\`) is the everyday case. **When NOT to use the formal pattern:** most suites need composition (*has-a* fields) but not a uniform \`UiPart\` interface with recursive operations. Introduce the common interface only when you actually run an operation over the whole tree.

## Strategy: interchangeable algorithms chosen at run time

### Login strategies

Most UI tests need a logged-in user but are not *about* login. A Strategy defines a family of interchangeable algorithms behind one interface and lets configuration or the test choose.

\`\`\`java
package com.shopeasy.framework.login;

import com.shopeasy.framework.flows.CheckoutFlow.TestUser;
import org.openqa.selenium.WebDriver;

@FunctionalInterface
public interface LoginStrategy {
    /** On return, the browser shows inventory.html as the given user. */
    void logIn(WebDriver driver, TestUser user);
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.login;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class LoginStrategies {
    private LoginStrategies() { }

    /** Through the real form — the only option for tests ABOUT login. */
    public static LoginStrategy ui(String baseUrl) {
        return (driver, user) -> {
            driver.get(baseUrl + "login.html");
            driver.findElement(By.id("user-name")).sendKeys(user.username());
            driver.findElement(By.id("password")).sendKeys(user.password());
            driver.findElement(By.id("login-button")).click();
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.urlContains("inventory.html"));
        };
    }

    /** Seed the session the way the app stores it — skips the form entirely. */
    public static LoginStrategy sessionSeed(String baseUrl) {
        return (driver, user) -> {
            driver.get(baseUrl + "login.html");                          // be on the origin first
            ((JavascriptExecutor) driver).executeScript(
                    "window.sessionStorage.setItem('shopeasy.user', arguments[0]);", user.username());
            driver.get(baseUrl + "inventory.html");
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(
                    ExpectedConditions.textToBe(By.id("logged-in-user"), user.username()));
        };
    }
}
\`\`\`

A third strategy, **API token injection**, is common in SPAs: call \`POST /api/auth/login\` (\`{ "username", "password" }\` → \`{ "token", "tokenType": "Bearer", ... }\`), then put the token where the front end reads it (a cookie or a storage key) and open the app. ShopEasy's practice UI does **not** read the API token — its session is the \`shopeasy.user\` storage value — so on ShopEasy the token is used for API-side arrangement (the API cart, orders), not to log the browser in. On an application that does read it, the strategy looks like \`sessionSeed\` with the token as the value.

**Selecting a strategy from configuration:**

\`\`\`java
import java.util.Map;
import java.util.function.Function;

Map<String, Function<String, LoginStrategy>> byName = Map.of(
        "ui", LoginStrategies::ui,
        "session", LoginStrategies::sessionSeed);

LoginStrategy login = byName.getOrDefault(System.getProperty("login.mode", "session"), LoginStrategies::ui)
        .apply(config.uiBaseUrl());
\`\`\`

Step by step:

- The interface is **functional**, so strategies are lambdas — no class per strategy until one needs state or tests of its own.
- Each strategy promises the same **post-condition** ("inventory.html as this user") and verifies it: \`urlContains\` for the UI path, the header's \`#logged-in-user\` text for the seeded path. A strategy without a post-condition check is how "logged in" silently becomes "on the login page with an error".
- **Seeding bypasses the credential check.** On ShopEasy, seeding \`locked_out_user\` would "log in" a user the real form rejects. Seeded login is for tests that are *not about* authentication; login tests always use \`ui\`, chosen in the test, never by global config.

### Wait strategies — you already have one

\`WebDriverWait.until(Function<? super WebDriver, V>)\` takes a **strategy**: \`ExpectedConditions.visibilityOfElementLocated(...)\`, a lambda, or your own condition object. A framework-level \`WaitStrategy\` interface with \`ShortWait\`/\`LongWait\` classes adds nothing over passing a condition and a named \`Duration\` from config. Custom conditions are covered in \`selenium-deep-synchronization\`.

### Environment-specific behaviour

\`\`\`java
public interface DataCleanup {
    void afterSuite();
}
// local:   POST /api/reset — restores the seed, drops tokens, carts and orders (fine on a private local server)
// shared:  per-test undo stack (see Command) — reset would wipe other runs' data
\`\`\`

Chosen once from \`-Denv\`, so no test contains \`if (env.equals("local"))\`.

### Comparison

| | Strategy interface + config map | \`if/else\` or \`switch\` in the caller | Inheritance (\`UiLoginTest\` vs \`ApiLoginTest\` base classes) |
|---|---|---|---|
| How it works | algorithms behind one interface, chosen by name | branching at each call site | subclass overrides a login method |
| Advantages | open for new variants; testable; one selection point | obvious with 2 cases at 1 site | no extra types |
| Disadvantages | indirection; config can choose a wrong strategy for a test | duplicated branching across sites | one axis only; combinations explode |
| Performance | same | same | same |
| Maintainability | high | low beyond two sites | low |
| When to use | 2+ variants used at several sites, selected by config | one site, two cases, unlikely to grow | almost never for this |

**Recommended approach and why:** a functional strategy interface with lambdas, selected in one place, with the post-condition checked inside each strategy. Let tests **override** the global choice when the test is about the mechanism (login tests force \`ui\`).

### When NOT to use it

- One implementation "in case we need another" — wait for the second.
- When a \`Duration\` parameter or an \`ExpectedCondition\` already expresses the variation.
- When strategies do not share a real post-condition — then they are different operations and deserve different names.

## Template Method: fixed lifecycle, overridable steps

### The problem

Every UI test needs the same lifecycle — create a driver, maybe log in, run, collect evidence on failure, quit — with small per-suite variations. Template Method fixes the **algorithm** in a base class (\`final\` methods) and exposes **hooks** subclasses may override.

\`\`\`java
package com.shopeasy.framework.base;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseUiTest {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();   // safe with parallel="methods"

    @BeforeMethod(alwaysRun = true)
    public final void startSession() {                    // the template: subclasses cannot reorder it
        WebDriver driver = createDriver();
        DRIVER.set(driver);
        afterSessionStarted(driver);                       // hook
    }

    @AfterMethod(alwaysRun = true)
    public final void endSession(ITestResult result) {
        WebDriver driver = DRIVER.get();
        try {
            if (driver != null && !result.isSuccess()) onFailure(driver, result);   // hook: evidence first
        } finally {
            DRIVER.remove();
            if (driver != null) driver.quit();
        }
    }

    protected WebDriver driver() { return DRIVER.get(); }

    /** Step with a default; the factory from pom-deep-creational-patterns in a real framework. */
    protected WebDriver createDriver() { return new ChromeDriver(); }

    /** Hooks: empty by default, override only when needed. */
    protected void afterSessionStarted(WebDriver driver) { }
    protected void onFailure(WebDriver driver, ITestResult result) { }
}
\`\`\`

TestNG runs configuration methods inherited from superclasses: \`@Before...\` methods in inheritance order (base first) and \`@After...\` methods in reverse. Making them \`final\` stops a subclass from accidentally overriding the lifecycle (which would silently drop the quit).

### An abstract \`CheckoutTestTemplate\`

\`\`\`java
package com.shopeasy.tests.checkout;

import static org.assertj.core.api.Assertions.assertThat;

import com.shopeasy.framework.base.BaseUiTest;
import com.shopeasy.framework.data.CustomerRef;
import com.shopeasy.framework.data.ExpectedTotals;
import com.shopeasy.framework.data.Product;
import com.shopeasy.framework.flows.CheckoutFlow;
import com.shopeasy.framework.flows.CheckoutFlow.TestUser;
import com.shopeasy.framework.pages.OrderSummary;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.testng.annotations.Test;

public abstract class CheckoutTestTemplate extends BaseUiTest {

    protected abstract List<Product> products();              // the varying step
    protected CustomerRef customer() { return CustomerRef.asha(); }   // hook with a default

    @Test
    public void overviewTotalsMatchTheOracle() {
        OrderSummary summary = new CheckoutFlow(driver())
                .reachOverview(TestUser.STANDARD, products(), customer())
                .summary();
        ExpectedTotals expected = ExpectedTotals.of(
                products().stream().collect(Collectors.toMap(Function.identity(), p -> 1)));

        assertThat(summary.subtotal()).isEqualByComparingTo(expected.subtotal());
        assertThat(summary.tax()).isEqualByComparingTo(expected.tax());
        assertThat(summary.total()).isEqualByComparingTo(expected.total());
    }
}

class TwoItemCheckoutTest extends CheckoutTestTemplate {          // 39.98 · 3.20 · 43.18
    @Override protected List<Product> products() { return List.of(Product.TRAILBLAZER_BACKPACK, Product.PULSE_BIKE_LIGHT); }
}

class JacketCheckoutTest extends CheckoutTestTemplate {           // 49.99 · 4.00 · 53.99
    @Override protected List<Product> products() { return List.of(Product.STORM_FLEECE_JACKET); }
}
\`\`\`

(Test classes are \`public\` in their own files in a real project.) \`isEqualByComparingTo\` matters: \`BigDecimal.equals\` compares scale, so \`3.2\` and \`3.20\` are not \`equals\`.

### Why composition and data often beat the template

The same coverage with a data provider — no hierarchy at all:

\`\`\`java
@DataProvider(name = "baskets")
public Object[][] baskets() {
    return new Object[][] {
        { List.of(Product.TRAILBLAZER_BACKPACK, Product.PULSE_BIKE_LIGHT) },
        { List.of(Product.STORM_FLEECE_JACKET) },
    };
}

@Test(dataProvider = "baskets")
public void overviewTotalsMatchTheOracle(List<Product> basket) { /* same body, basket instead of products() */ }
\`\`\`

| | Template Method (abstract test) | Data provider | Composition (helpers/flows injected, hooks as listeners) |
|---|---|---|---|
| How it works | base class fixes steps; subclasses fill in | one test method, rows of data | test calls collaborators; cross-cutting work in listeners |
| Advantages | enforces lifecycle; varies *steps*, not only data | one class; variants visible in one table | no inheritance coupling; mix and match |
| Disadvantages | reading a test means reading 2–5 classes; one axis of variation; fragile base class | only data varies | lifecycle not enforced by the compiler |
| Maintainability | degrades quickly with depth | high | high |
| When to use | **one** level of lifecycle base (\`BaseUiTest\`); a test template where *steps* differ | variants that differ only in data | everything else |

**Recommended approach and why:** one shallow \`BaseUiTest\` with \`final\` lifecycle methods and empty hooks; data providers for data variations; flows and components by composition. Abstract test templates only when the **steps** differ between variants and a data row cannot express it — and never more than one level above \`BaseUiTest\`.

### When NOT to use it

- Hierarchies like \`BaseTest → BaseUiTest → BaseLoggedInTest → BaseCheckoutTest → BaseGuestCheckoutTest\`: each level adds hidden setup; a failing test requires reading five files. Replace with composition (anti-pattern recipe below).
- Hooks that every subclass must override — then it is not a hook, it is an abstract step, or the base class is doing too much.

## Observer: listeners and event publishing

### Built-in observers

TestNG and Cucumber are event sources; your reporting code observes them.

\`\`\`java
package com.shopeasy.framework.listeners;

import org.testng.ITestListener;
import org.testng.ITestResult;

public class FailureSummaryListener implements ITestListener {
    @Override
    public void onTestFailure(ITestResult result) {
        System.err.printf("FAILED %s.%s: %s%n", result.getTestClass().getName(),
                result.getMethod().getMethodName(), result.getThrowable());
    }
}
\`\`\`

Registered with \`@Listeners\`, in \`testng.xml\` (\`<listeners>\`), or via \`META-INF/services/org.testng.ITestNGListener\` for every suite. The full evidence listener is in \`selenium-deep-troubleshooting-flaky-tests\`.

\`\`\`java
package com.shopeasy.framework.listeners;

import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.Status;
import io.cucumber.plugin.event.TestCaseFinished;
import io.cucumber.plugin.event.TestRunFinished;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Cucumber plugin: registered with the cucumber.plugin property. */
public class FailedScenariosPlugin implements ConcurrentEventListener {
    private final Queue<String> failed = new ConcurrentLinkedQueue<>();

    @Override
    public void setEventPublisher(EventPublisher publisher) {
        publisher.registerHandlerFor(TestCaseFinished.class, this::onFinished);
        publisher.registerHandlerFor(TestRunFinished.class, e -> System.out.println("Failed scenarios: " + failed));
    }

    private void onFinished(TestCaseFinished event) {
        if (event.getResult().getStatus() == Status.FAILED) {
            failed.add(event.getTestCase().getName() + " (" + event.getTestCase().getUri() + ")");
        }
    }
}
\`\`\`

A \`ConcurrentEventListener\` receives events as they happen — with parallel scenarios, from several threads — so its state is a concurrent collection.

### Your own event publishing

\`\`\`java
package com.shopeasy.framework.events;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public final class FrameworkEvents {
    public record StepFinished(String testName, String step, long millis, boolean passed) { }

    private final List<Consumer<StepFinished>> subscribers = new CopyOnWriteArrayList<>();

    public void subscribe(Consumer<StepFinished> subscriber) { subscribers.add(subscriber); }

    public void publish(StepFinished event) {
        for (Consumer<StepFinished> s : subscribers) {
            try {
                s.accept(event);
            } catch (RuntimeException e) {                 // one broken reporter must not fail the test
                System.err.println("Subscriber failed: " + e);
            }
        }
    }
}
\`\`\`

The action layer publishes \`StepFinished\`; an Allure adapter, a timing collector and a "slow step" warner subscribe without the action layer knowing them. \`CopyOnWriteArrayList\` makes iteration safe while subscribers are added (rare writes, frequent reads).

**When NOT to use it:** with **one** consumer, call it directly — an event bus is indirection that hides who reacts to what. Do not let subscribers **change** test flow (retry, skip); observers observe. Do not rely on listener **ordering** unless the framework documents it. Keep handlers fast: they run on the test thread.

## Command: actions as objects — composite actions, Screenplay, undo

### Where you already meet it

- **Selenium \`Actions\`**: \`new Actions(driver).clickAndHold(source).moveToElement(target).release().build()\` returns an \`org.openqa.selenium.interactions.Action\` — a command object you can store and later \`perform()\`. The builder records steps; the command executes them.
- **Screenplay interactions** are commands: an object with a "perform as this actor" method, composed into tasks and logged by name. (In Serenity BDD this is the \`Performable\`/\`Interaction\` family; the plain-Java idea: \`interface Interaction { void performAs(Actor actor); }\`.)

### Undoable test-data setup with a cleanup stack

On shared environments, \`POST /api/reset\` is not an option. Each setup action is a command that knows how to **undo** itself; undos run in **reverse order** after the test.

\`\`\`java
package com.shopeasy.framework.arrange;

import java.util.ArrayDeque;
import java.util.Deque;

/** Collects undo commands; run LIFO in @AfterMethod(alwaysRun = true). */
public final class Cleanup implements AutoCloseable {
    public interface Undo { void run() throws Exception; }
    private record Entry(String description, Undo undo) { }

    private final Deque<Entry> stack = new ArrayDeque<>();

    public void register(String description, Undo undo) {
        stack.push(new Entry(description, undo));
    }

    @Override
    public void close() {
        IllegalStateException failure = null;
        while (!stack.isEmpty()) {
            Entry e = stack.pop();                         // last created, first removed
            try {
                e.undo().run();
            } catch (Exception ex) {                       // keep going: one failed undo must not leak the rest
                if (failure == null) failure = new IllegalStateException("Cleanup incomplete");
                failure.addSuppressed(new IllegalStateException("undo failed: " + e.description(), ex));
            }
        }
        if (failure != null) throw failure;
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.arrange;

import static io.restassured.RestAssured.given;

import com.shopeasy.framework.data.Product;
import io.restassured.specification.RequestSpecification;
import java.util.Map;

/** A setup command with its own undo. */
public final class AddToApiCart {
    private AddToApiCart() { }

    public static void execute(RequestSpecification auth, Product product, Cleanup cleanup) {
        given().spec(auth).body(Map.of("productId", product.id))
                .when().post("/cart/items").then().statusCode(201);
        cleanup.register("remove " + product.slug + " from API cart", () -> {
            int status = given().spec(auth).when().delete("/cart/items/" + product.id).then().extract().statusCode();
            if (status != 204 && status != 404) {          // 404 ITEM_NOT_IN_CART: the test removed it — fine
                throw new IllegalStateException("DELETE /cart/items/" + product.id + " returned " + status);
            }
        });
    }
}
\`\`\`

Step by step:

- **LIFO** matters when resources depend on each other: an order that references cart items, an avatar on a user.
- **Undo is idempotent**: a test about "remove from cart" already deleted the item; \`404 ITEM_NOT_IN_CART\` is success for cleanup.
- **Keep going on failure** and report all failures as suppressed exceptions — stopping at the first leaves the rest behind.
- Register the undo **after** the setup succeeded, so cleanup never deletes something that was never created.
- Not everything is undoable: ShopEasy has no endpoint to delete a user. The answer there is **unique data** (builders from \`pom-deep-creational-patterns\`), not a fake undo. Avatars are undoable (\`DELETE /api/users/{id}/avatar\`).

**When NOT to use it:** per-test environments (a container per run, the local API with \`POST /api/reset\` in a sequential suite) do not need an undo stack. Command objects for every click (\`new ClickCommand(locator).execute()\`) are ceremony — reserve the pattern for things you store, compose, log, replay or undo.

## Chain of Responsibility: classifying failures

### The problem

A nightly run has 37 failures. Triage is faster if each failure is labelled: infrastructure, locator, synchronisation, assertion. Several rules, each able to claim a failure or pass it on — a Chain of Responsibility.

\`\`\`java
package com.shopeasy.framework.triage;

import org.openqa.selenium.InvalidSelectorException;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.NoSuchSessionException;
import org.openqa.selenium.SessionNotCreatedException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;

public enum FailureCategory { INFRASTRUCTURE, LOCATOR, SYNCHRONISATION, ASSERTION, UNKNOWN }

/** Classic GoF shape: each handler either handles or passes to the next. */
abstract class Classifier {
    private Classifier next;

    Classifier then(Classifier next) {
        this.next = next;
        return next;
    }

    final FailureCategory classify(Throwable t) {
        FailureCategory mine = tryClassify(t);
        if (mine != null) return mine;
        return next == null ? FailureCategory.UNKNOWN : next.classify(t);
    }

    protected abstract FailureCategory tryClassify(Throwable t);
}

final class InfrastructureClassifier extends Classifier {
    @Override protected FailureCategory tryClassify(Throwable t) {
        return t instanceof SessionNotCreatedException || t instanceof NoSuchSessionException
                ? FailureCategory.INFRASTRUCTURE : null;
    }
}

final class LocatorClassifier extends Classifier {
    @Override protected FailureCategory tryClassify(Throwable t) {
        return t instanceof InvalidSelectorException || t instanceof NoSuchElementException
                ? FailureCategory.LOCATOR : null;
    }
}

final class SynchronisationClassifier extends Classifier {
    @Override protected FailureCategory tryClassify(Throwable t) {
        return t instanceof StaleElementReferenceException || t instanceof TimeoutException
                ? FailureCategory.SYNCHRONISATION : null;
    }
}

final class AssertionClassifier extends Classifier {
    @Override protected FailureCategory tryClassify(Throwable t) {
        return t instanceof AssertionError ? FailureCategory.ASSERTION : null;
    }
}
\`\`\`

\`\`\`java
Classifier chain = new InfrastructureClassifier();
chain.then(new LocatorClassifier()).then(new SynchronisationClassifier()).then(new AssertionClassifier());
FailureCategory category = chain.classify(result.getThrowable());   // in a TestNG listener
\`\`\`

**Order is the design.** Many Selenium exceptions share the \`WebDriverException\` base (\`InvalidSelectorException\` extends it directly in Selenium 4), so a broad \`instanceof WebDriverException\` rule placed early would swallow everything after it. And a \`WebDriverWait\` timeout usually carries the last ignored exception — often a \`NoSuchElementException\` — as its **cause**. Is "timed out waiting for \`#finish\`" a sync problem or a broken locator? The chain answers by its order and by whether it inspects causes; write that decision down and evidence (screenshot, page source) settles individual cases.

### The simpler alternative: an ordered rule list

\`\`\`java
import java.util.List;
import java.util.function.Predicate;

record Rule(Predicate<Throwable> matches, FailureCategory category) { }

static final List<Rule> RULES = List.of(
        new Rule(t -> t instanceof SessionNotCreatedException || t instanceof NoSuchSessionException, FailureCategory.INFRASTRUCTURE),
        new Rule(t -> t instanceof InvalidSelectorException, FailureCategory.LOCATOR),
        new Rule(t -> t instanceof TimeoutException || t instanceof StaleElementReferenceException, FailureCategory.SYNCHRONISATION),
        new Rule(t -> t instanceof NoSuchElementException, FailureCategory.LOCATOR),
        new Rule(t -> t instanceof AssertionError, FailureCategory.ASSERTION));

static FailureCategory classify(Throwable failure) {
    for (Throwable t = failure; t != null; t = t.getCause()) {           // outermost first, then causes
        for (Rule rule : RULES) {
            if (rule.matches().test(t)) return rule.category();
        }
    }
    return FailureCategory.UNKNOWN;
}
\`\`\`

| | Linked handlers (GoF) | Ordered rule list |
|---|---|---|
| How it works | each handler holds \`next\` and delegates | loop over predicates; first match wins |
| Advantages | handlers can do work and *still* pass on; rich per-handler logic | order visible in one place; trivial to test as a table |
| Disadvantages | order hidden in wiring code; more classes | handlers cannot partially handle |
| When to use | handlers with real logic or side effects (servlet filters, RestAssured filters) | classification, routing, mapping — most test-framework cases |

**Recommended approach and why:** the ordered list — the chain's order *is* the business rule, and a list shows it. Note the subtle difference with **evidence collectors** (screenshot, page source, browser console, \`sessionStorage\` dump): those must **all** run, each in its own try/catch — that is a pipeline over a list, not a chain where one handler stops the others. RestAssured's \`Filter\` (\`filter(requestSpec, responseSpec, ctx)\` calling \`ctx.next(...)\`) is a real Chain of Responsibility you may already use for logging and auth.

**When NOT to use it:** three \`instanceof\` checks in one method are fine. Do not build a plug-in chain for a classification nobody acts on — the value is in triage dashboards and routing (infra failures to the platform team), not in the pattern.

## State: modelling the multi-step checkout wizard

### The problem

ShopEasy's checkout is **one URL** (\`checkout.html\`) with three sections: *Your Information* (\`#checkout-step-one\`), *Overview* (\`#checkout-step-two\`) and *Complete* (\`#checkout-complete\`); the inactive sections get the \`hidden\` class. Which actions are valid depends on the current section: \`#finish\` only on the overview, \`#continue\` only on step one; \`#cancel\` returns to \`cart.html\`, \`#cancel-overview\` to \`inventory.html\`. Validation errors (\`Error: First Name is required\`, \`Error: Postal Code is invalid\` for anything outside \`[A-Za-z0-9 -]{3,10}\`) keep you on step one.

The State pattern: an object whose behaviour depends on its state, with each state as its own class exposing only valid transitions.

### Compile-time state: one page object per section

Fluent page objects already are the State pattern, encoded in **types**: \`InformationStep.continueWith(...)\` returns \`OverviewStep\`, so \`finish()\` cannot be called on step one — the compiler is the state checker. The twist on ShopEasy is the **identity check**: the URL is the same for all three, so each step verifies its **section** is visible.

\`\`\`java
package com.shopeasy.framework.pages.checkout;

import com.shopeasy.framework.data.CustomerRef;
import java.math.BigDecimal;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class InformationStep {
    private static final By SECTION = By.id("checkout-step-one");
    private final WebDriver driver;
    private final WebDriverWait wait;

    public InformationStep(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
        wait.until(ExpectedConditions.visibilityOfElementLocated(SECTION));     // state identity
    }

    public OverviewStep continueWith(CustomerRef customer) {
        fill(customer);
        driver.findElement(By.id("continue")).click();
        return new OverviewStep(driver, wait);                                   // transition
    }

    public InformationStep continueExpectingError(CustomerRef customer) {
        fill(customer);
        driver.findElement(By.id("continue")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("checkout-error")));
        return this;                                                             // self-transition
    }

    public String errorMessage() {
        return driver.findElement(By.id("checkout-error-message")).getText();
    }

    private void fill(CustomerRef c) {
        type(By.id("first-name"), c.firstName());
        type(By.id("last-name"), c.lastName());
        type(By.id("postal-code"), c.postalCode());
    }

    private void type(By field, String value) {
        driver.findElement(field).clear();
        driver.findElement(field).sendKeys(value);
    }
}

final class OverviewStep {
    private static final By SECTION = By.id("checkout-step-two");
    private final WebDriver driver;
    private final WebDriverWait wait;

    OverviewStep(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        this.wait = wait;
        wait.until(ExpectedConditions.visibilityOfElementLocated(SECTION));
    }

    public BigDecimal total() {
        return new BigDecimal(driver.findElement(By.id("summary-total")).getText().replace("$", ""));
    }

    public CompleteStep finish() {
        driver.findElement(By.id("finish")).click();
        return new CompleteStep(driver, wait);
    }
}

final class CompleteStep {
    private static final By SECTION = By.id("checkout-complete");
    private final WebDriver driver;

    CompleteStep(WebDriver driver, WebDriverWait wait) {
        this.driver = driver;
        wait.until(ExpectedConditions.visibilityOfElementLocated(SECTION));
    }

    public String orderNumber() {
        return driver.findElement(By.id("order-number")).getText();              // e.g. SE-482913
    }
}
\`\`\`

(Public classes in separate files in a real project; prices above \`$999\` would need a comma-aware parser.) For actions with several outcomes — the sealed \`LoginResult\` type — see \`pom-deep-variants-pagefactory-loadable\`.

### Run-time state: a model for model-based testing

When you want a test to **explore** the wizard (random walks: continue, cancel, back, error, retry), a run-time state machine describes the valid transitions, and a driver adapter executes them:

\`\`\`java
package com.shopeasy.framework.model;

import java.util.EnumSet;
import java.util.Set;

public enum CheckoutState {
    INFORMATION, OVERVIEW, COMPLETE, CART, INVENTORY;

    public Set<CheckoutState> next() {
        return switch (this) {
            case INFORMATION -> EnumSet.of(INFORMATION, OVERVIEW, CART);  // error stays · continue · cancel
            case OVERVIEW    -> EnumSet.of(COMPLETE, INVENTORY);          // finish · cancel-overview
            case COMPLETE    -> EnumSet.of(INVENTORY);                    // back-to-products
            case CART, INVENTORY -> EnumSet.noneOf(CheckoutState.class);  // outside the wizard: walk ends
        };
    }
}
\`\`\`

A model-based test picks a random valid transition, performs it through the step objects, asserts the UI is in the expected state (section visible, or URL for cart/inventory), and repeats — with a logged seed so a failing walk can be replayed.

| | Fluent step objects (compile-time state) | Run-time state machine | One \`CheckoutPage\` with all methods |
|---|---|---|---|
| How it works | each state is a class; transitions return the next class | enum/graph of states and transitions + executor | all buttons on one class; the test must know the state |
| Advantages | invalid sequences do not compile; identity checked per section | explores sequences nobody scripted; finds transition bugs | fewest classes |
| Disadvantages | more classes; a branch the test cannot predict needs a result type | infrastructure; needs good oracles per state | \`finish()\` callable on step one — fails at run time with a confusing timeout |
| When to use | default for multi-step flows | critical wizards with many paths (checkout, onboarding) | tiny one-step forms |

**Recommended approach and why:** fluent step objects for scripted tests; a run-time model only for a critical flow where unscripted sequences have produced bugs. **When NOT to use State:** a two-field form that submits once has one state — a single page object is enough.

## Pattern selection table

| Problem in the framework | Pattern | Simpler alternative to try first |
|---|---|---|
| Same multi-page journey in many tests | Facade (flow with stop points) | API arrangement; inline page calls if < 3 tests |
| Two backends/libraries must look the same to framework code | Adapter | call the library directly if used in a few places |
| Logging/timing/highlighting around driver calls | Decorator (\`EventFiringDecorator\`) | the action layer already logs business steps |
| Lazy elements, cached reference data | Proxy | \`By\` locators found on use; fetch once in \`@BeforeSuite\` into an immutable list |
| Page with repeated regions and a whole-tree operation | Composite | plain composition (component fields) |
| Interchangeable login/setup/cleanup mechanisms chosen by config | Strategy (functional interface + map) | a parameter or an \`ExpectedCondition\` |
| Fixed lifecycle with small variations | Template Method (one shallow base) | data providers; listeners for cross-cutting work |
| Reports and metrics reacting to test events | Observer (framework listeners) | call the one consumer directly |
| Setup that must be undone, composite actions | Command (undo stack, \`Actions\`) | per-run environments; unique data |
| Ordered classification of failures | Chain of Responsibility | an ordered rule list |
| Multi-step wizard with state-dependent actions | State (fluent step objects) | a single page object for one-step forms |

## Anti-patterns specific to test code — and refactoring recipes

| Anti-pattern | Symptom | Refactoring recipe |
|---|---|---|
| **God page** | \`InventoryPage\` with 80 methods from three squads | extract components (\`HeaderComponent\`, \`ProductCard\`); move journeys into flows; delete unused methods (coverage of page methods by tests tells you which) |
| **God BaseTest** | 1,500 lines: driver, API clients, DB, reports, data, waits | keep lifecycle in \`BaseUiTest\` (\`final\` template + hooks); move each capability into a collaborator injected or created per test; move reporting into listeners |
| **Inheritance chains 5 deep** | \`BaseGuestCheckoutTest extends BaseCheckoutTest extends BaseLoggedInTest...\` | flatten to one base; turn each level's setup into a composable call (\`login.logIn(driver, user)\`, \`cart.add(...)\`) or a TestNG listener; move variations to data providers |
| **Singleton driver** | \`Browser.getInstance()\` everywhere, flaky in parallel | per-thread or per-scenario driver (\`ThreadLocal\` or DI), passed into pages via constructors (\`pom-deep-creational-patterns\`) |
| **Service Locator** | \`Framework.get(CartApi.class)\` called from inside pages and steps | constructor injection; the locator, if any, only at the composition root (base test, hooks) |
| **Framework within a framework** | keyword engine (\`perform("CLICK", "loginBtn")\`), custom DSLs over Java, wrappers around TestNG | delete layers that add no behaviour; keep Selenium and TestNG concepts visible; measure "time for a new joiner to debug a failure" |
| **Premature generalisation** | \`AbstractGenericPage<T extends AbstractGenericPage<T>>\`, Abstract Factory with identical families, Strategy with one implementation | inline the abstraction; reintroduce it when the second real variant arrives (rule of three) |
| **Assertions in flows/facades** | \`purchase()\` asserts the total | return values; assert in tests |

The safe order for any of these refactors: characterise behaviour with the existing tests green, introduce the new structure **next to** the old one, migrate the most-used call sites first, delete the old path, and keep each step a small reviewed PR.

## Talking about patterns in an interview

Interviewers at senior level are not checking that you can recite GoF definitions; they check that you **choose** patterns for reasons and know their costs.

| Textbook phrasing | Senior phrasing |
|---|---|
| "I used the Singleton pattern for the driver." | "Configuration is a singleton because it is immutable. The driver is per test — a singleton driver is shared mutable state and breaks parallel runs — so it is created in the base test and passed into pages." |
| "We implemented the Factory pattern." | "Driver creation is one factory selected by config; adding Edge was one entry. I avoided an Abstract Factory for mobile because only two pages differed — those take a navigation strategy instead." |
| "Our framework uses Facade, Strategy, Builder, Decorator…" | "Three things carry the framework: builders for unique, valid data; a flow layer with stop points so tests start where they are interesting; and login strategies so only login tests pay for the form." |
| "Template Method is when an abstract class defines steps." | "There is exactly one base test, with \`final\` lifecycle methods and empty hooks. Variants are data providers; I removed a four-level hierarchy because nobody could find where a test logged in." |
| "Observer pattern is used in listeners." | "Evidence capture is a TestNG listener, so it reacts to *test* failure — not a WebDriver listener, which also fires on errors that waits are expected to swallow." |

Structure for any "which pattern would you use" answer: **problem → simplest thing that works → what forces the pattern → the cost you accept → how you would know it was wrong**. Mentioning a pattern you *removed*, and why, signals more seniority than listing patterns you added.

## Playwright (TypeScript) equivalent

The patterns translate, but Playwright removes some of the need: fixtures are the Template Method + DI (\`page\` per test, setup and teardown around \`use\`), the trace viewer and \`test.step\` cover most Decorator/Observer logging, and auto-waiting locators are lazy proxies by design. Flows (Facade), strategies and builders stay ordinary TypeScript:

\`\`\`ts
type LoginStrategy = (page: Page, user: TestUser) => Promise<void>;

const sessionSeed: LoginStrategy = async (page, user) => {
  await page.goto('http://localhost:5180/practice-site/login.html');
  await page.evaluate((u) => sessionStorage.setItem('shopeasy.user', u), user.username);
  await page.goto('http://localhost:5180/practice-site/inventory.html');
  await expect(page.getByTestId('logged-in-user')).toHaveText(user.username);
};
\`\`\`

For cross-test login reuse Playwright offers \`storageState\` — but note it saves cookies and \`localStorage\`, not \`sessionStorage\`, which is where ShopEasy keeps its session; a seeding strategy like the one above is needed instead. Component and fixture design: \`pw-deep-fixtures-pom-components\`.

## Best practices for experienced engineers

- **Name the problem before the pattern.** If you cannot state the second variant or consumer that exists today, do not add the abstraction.
- **Prefer functions to class hierarchies** for strategies, commands and rules — Java lambdas and records make most behavioural patterns a few lines.
- **Make post-conditions explicit** in strategies and flows (where the browser is when the method returns), and verify them inside.
- **Keep one shallow base class**; everything else by composition.
- **Observers observe** — no retries, waits or flow changes in listeners.
- **Undo in reverse, idempotently, and keep going** on cleanup failures; prefer unique data where undo is impossible.
- **Write down rule order** for chains and classifiers; it is a business decision.
- **Remove patterns** that stopped paying — and say so in reviews.

## Interview questions

### Q: What is the difference between a Facade and a Page Object?
**Short answer (30–60 s):** A page object models one screen and its behaviour; a facade (flow) simplifies a journey across several page objects, in business terms, returning values or the page where the test should continue.

**Detailed answer:** The facade's key design choice is its stop points — \`fillCart\`, \`reachOverview\`, \`purchase\` — so each test starts at the step it is about. It contains no assertions and no locators, and pages never depend on it. I use it once a journey repeats in three or more tests, combine it with API arrangement, and never use it in tests of the steps it hides. At larger scale, Screenplay tasks are the next step.

### Q: Decorator vs Proxy vs Adapter — they all wrap something. How do you tell them apart?
**Short answer (30–60 s):** By intent. Adapter changes the interface; Decorator keeps the interface and adds behaviour; Proxy keeps the interface and controls access — lazily, with caching, remotely or with protection.

**Detailed answer:** \`EventFiringDecorator\` decorates (adds listener events). PageFactory's \`LocatingElementHandler\` proxies are virtual proxies (find on use), and \`@CacheLookup\` makes them caching proxies. An Allure \`StepReporter\` implementation is an adapter. Structurally Decorator and Proxy are identical; the conversation should be about intent and consequences — e.g. a decorator that loses \`JavascriptExecutor\` breaks casts, a caching proxy over mutable data creates shared state.

### Q: How would you implement multiple login mechanisms in a framework?
**Short answer (30–60 s):** A functional \`LoginStrategy\` with UI, session-seeding and (where the app supports it) API-token implementations, selected by configuration in one place, each verifying the same post-condition. Tests about login force the UI strategy.

**Detailed answer:** Seeding bypasses the credential check — on ShopEasy seeding \`shopeasy.user\` would "log in" \`locked_out_user\` — so it is only for tests not about authentication. The token strategy depends on where the front end reads the token (cookie or storage); on ShopEasy the UI does not read the API token, so the token serves API arrangement. Each strategy checks the post-condition (inventory page, header shows the user) so a silent login failure surfaces at the right line.

### Q: Template Method in a test framework — good or bad?
**Short answer (30–60 s):** Good for one shallow base class with a \`final\` lifecycle and empty hooks; bad as a deep hierarchy where each level adds hidden setup.

**Detailed answer:** TestNG runs inherited \`@Before\` methods base-first and \`@After\` in reverse, so a template base is natural. \`final\` lifecycle methods prevent accidental overrides that drop teardown. Variations that are only data belong in data providers; cross-cutting work in listeners; capabilities in collaborators. An abstract test template is justified only when the steps themselves vary.

### Q: How do you clean up test data on a shared environment?
**Short answer (30–60 s):** Unique data by default, plus a per-test undo stack: each setup command registers its undo; undos run LIFO in \`@AfterMethod(alwaysRun = true)\`, are idempotent, continue after failures and report them as suppressed exceptions.

**Detailed answer:** Global resets (\`POST /api/reset\` on ShopEasy) wipe other runs' data and are only acceptable on private environments. Where no delete exists (ShopEasy users), uniqueness is the strategy. Registering the undo only after the setup succeeded avoids deleting things never created; treating "already gone" (404) as success makes cleanup robust against tests that delete their own data.

### Q: Where does Observer appear in your framework, and what are the pitfalls?
**Short answer (30–60 s):** TestNG listeners, Cucumber plugins (\`ConcurrentEventListener\`) and an internal step-event publisher feeding reports and timing. Pitfalls: listeners that change flow, slow handlers on the test thread, reliance on ordering, and non-thread-safe state in parallel runs.

**Detailed answer:** Evidence capture belongs to a test-level listener that knows the test failed. A Cucumber concurrent listener can be called from multiple threads, so it collects into concurrent structures. An internal bus isolates subscriber failures so one broken reporter cannot fail a test. With one subscriber, I call it directly.

### Q: How do you model a multi-step wizard?
**Short answer (30–60 s):** One step object per state with transitions returning the next step; each verifies its identity on construction. On ShopEasy the three checkout steps share a URL, so identity is the visible section.

**Detailed answer:** That is the State pattern in types — invalid sequences do not compile. Branching outcomes use result types. For critical wizards a run-time state model drives randomised walks with a logged seed, which finds transition bugs scripted tests miss.

### Q: Which design patterns do you avoid in test code?
**Short answer (30–60 s):** Singleton for anything per-test, Service Locator, deep Template Method hierarchies, Abstract Factories with identical families, and any "framework within a framework" that hides Selenium and TestNG.

**Detailed answer:** Each hides dependencies or behaviour and slows debugging. The test I apply: can a new joiner go from a failing test to the line that failed in under five minutes? If an abstraction makes that harder without removing real duplication, it goes.

## Scenario-based questions

**1. A framework has \`BaseTest → BaseUiTest → BaseLoggedInTest → BaseCartTest → BaseCheckoutTest\`; a checkout test fails in setup and nobody knows where.** I would map what each level does (usually: driver, login, add items, open checkout), then flatten in steps: keep \`BaseUiTest\` with a \`final\` lifecycle; replace "logged in" with a \`LoginStrategy\` call, "cart" with \`CartGateway\`/flow calls and "checkout" with \`CheckoutFlow.reachOverview\` — all called explicitly in the test's arrange section or a small \`@BeforeMethod\` in the test class. Migrate one test class at a time, deleting a base level when nothing extends it. Result: the test shows its preconditions in three lines, and the failing step has a name.

**2. A colleague proposes a \`WebDriverAdapter\` interface "so we can switch to Playwright later".** I would ask what it would cost to keep it honest: Playwright's auto-waiting locators, contexts and tracing do not map onto \`WebDriver\` semantics, so the adapter either exposes the lowest common denominator or leaks one tool through the other. A real migration would rewrite page internals anyway; what survives is the **page object API and the flows**. I would invest in clean page APIs and test data builders — portable assets — rather than a speculative adapter.

**3. Nightly runs show 60 failures and the team spends a morning triaging.** I would add an ordered failure classifier (infrastructure, locator, synchronisation, assertion) in the TestNG listener, attach the category to the report and route infrastructure failures to the platform channel. The rule order — and how causes like \`TimeoutException\` wrapping \`NoSuchElementException\` are treated — is agreed with the team and unit-tested as a table. Success measure: triage time and the share of \`UNKNOWN\`.

## Tricky follow-ups

- **Q: Is \`ExpectedCondition\` an example of a pattern?** Yes — Strategy: \`WebDriverWait.until\` takes the condition algorithm as an object (or lambda).
- **Q: Is PageFactory a Factory or a Proxy?** It is an initialiser that installs **proxies**; the "factory" in the name refers to creating those proxies, not to choosing page objects.
- **Q: Should a facade return the next page or a value?** Whichever lets the *next line of the test* be about the behaviour under test: a value for post-order checks, a page at stop points where the test continues in the UI.
- **Q: Can a Chain of Responsibility run every handler?** Then it is a pipeline, not a chain. Evidence collectors are a pipeline; classifiers are a chain.
- **Q: Why make template lifecycle methods \`final\` in TestNG?** An overriding subclass method replaces the annotated base method, so the base teardown (quit, \`ThreadLocal.remove()\`) silently stops running.`,
  keyPoints: [
    'Justify a pattern by a second variant or consumer that exists today; otherwise it is indirection that slows debugging.',
    'Facade: a flow per business domain with explicit stop points (fillCart, reachOverview, purchase), returning values or the page where the test continues — no assertions, no locators.',
    'Adapter translates interfaces (sessionStorage cart vs cart API, Allure vs logs); Decorator adds behaviour with the same interface; Proxy controls access (PageFactory lazy elements, caching reference data).',
    'Strategy: a functional interface selected in one place (login via UI, session seeding or token), each verifying the same post-condition; tests about the mechanism force the real path.',
    'Template Method: one shallow BaseUiTest with final lifecycle methods and empty hooks; data providers and composition instead of deep hierarchies.',
    'Observer for listeners and report events (observe only, thread-safe, fast); Command for composite actions and an idempotent LIFO undo stack for test data.',
    'Chain of Responsibility for ordered failure classification — usually as an ordered rule list; State as fluent step objects that check their identity (same-URL checkout sections).',
    'Senior interview answers name the problem, the simplest alternative, the cost accepted and patterns removed — not a list of GoF names.',
  ],
  mistakes: [
    'A facade that asserts totals or accepts boolean flags to serve every test. Fix: return values or pages at explicit stop points; assertions stay in tests; add a new stop point instead of a flag.',
    'A hand-written WebDriver decorator that loses JavascriptExecutor/TakesScreenshot and leaves elements undecorated, so casts fail and clicks are not logged. Fix: EventFiringDecorator for observation, the action layer for behaviour; hand-written decorators only for small interfaces you own.',
    'Session-seeding login configured globally, so login tests and locked_out_user cases silently skip the credential check. Fix: tests about authentication force the UI strategy; seeding only for tests that are not about login, with a post-condition check.',
    'A five-level test inheritance chain where setup is spread across levels. Fix: one BaseUiTest with final lifecycle and hooks; explicit arrange calls via strategies and flows; variations as data providers.',
    'Cleanup that stops at the first failed undo, or fails because the test already deleted the item. Fix: LIFO undo stack that continues, treats 404 as done, and reports failures as suppressed exceptions; unique data where no delete endpoint exists.',
    'A caching proxy over data the run mutates (cart, orders, stock). Fix: cache only immutable reference data as an unmodifiable snapshot; per-test data is never cached.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`, API \`http://localhost:5181\`): (1) write \`CheckoutFlow\` with three stop points and use \`reachOverview\` in a test that checks subtotal, 8% tax and total for the Storm Fleece Jacket plus the Junior Onesie against an oracle; (2) implement \`LoginStrategy\` as \`ui\` and \`sessionSeed\` lambdas, select by \`-Dlogin.mode\`, and prove with a test that seeding \`locked_out_user\` "logs in" while the UI strategy shows \`Error: Sorry, this user has been locked out.\` — then make the login test force \`ui\`; (3) model the checkout as \`InformationStep\` → \`OverviewStep\` → \`CompleteStep\` with section-visibility identity checks and cover \`Error: Postal Code is invalid\` for postal code \`12\`; (4) write the \`Cleanup\` undo stack and \`AddToApiCart\` with an idempotent undo, then run a test that removes the item itself and confirm cleanup still passes; (5) add an ordered failure classifier to a TestNG listener and break a locator (\`#finnish\`) to see which category it reports and why.`,
  problems: ['pom-026', 'pom-014', 'pom-033'],
}
