export default {
  slug: 'cucumber-deep-dependency-injection-hooks',
  category: 'cucumber',
  order: 14,
  title: 'Deep dive: dependency injection, scenario state and hooks in Cucumber-JVM',
  minutes: 30,
  summary: 'Understand how Cucumber-JVM creates glue objects through the ObjectFactory, why static state leaks, how PicoContainer, Spring and Guice scope objects per scenario, how to select the factory, how to design typed scenario state (TestUser, CartState, ApiSession, a lazy DriverHolder) instead of a Map, and how hooks (order, tags, step hooks, BeforeAll/AfterAll, the Scenario object) and DI lifecycle combine into setup and cleanup that is parallel-safe — with full ShopEasy wiring and a guide to DI error messages.',
  manualAnalogy: `When a team of manual testers shares one test environment, each tester keeps a personal notebook for the session: which account they created, what is in their cart, which browser window is theirs. A shared whiteboard instead of notebooks means testers overwrite each other's notes. Dependency injection gives every scenario its own fresh notebook, and hooks are the routine at the start and end of each session — open the browser if the test needs one, create the account, collect evidence, tidy up.`,
  body: `## Where the earlier lessons stop

\`picocontainer-shared-state\` introduced constructor injection of one \`TestContext\`; \`cucumber-hooks\` covered \`@Before\`/\`@After\`, the \`Scenario\` object, screenshots and the \`@After\` ordering trap. This lesson explains **what Cucumber does internally** when it creates glue objects, how to choose and configure a DI container, how to design scenario state for a large suite, and how hooks and DI lifecycle divide setup and cleanup between them. Neighbouring lessons:

- \`cucumber-deep-architecture-internals\` — the full runtime (pickles, glue discovery, event bus, config precedence). Here we zoom into object creation only.
- \`cucumber-deep-steps-parameter-types-datatables\` — the step layer and tasks that receive this state.
- \`cucumber-deep-execution-reporting-parallel\` (later) — parallel runners, reports and CI.
- \`pom-deep-creational-patterns\` — DI vs singletons in general; \`selenium-deep-parallel-execution\` and \`java-deep-multithreading-synchronization\` — \`ThreadLocal\` driver management.

## How Cucumber creates step-class instances

### The ObjectFactory contract

Every glue class (step definitions, hooks, parameter and table types) is instantiated by an **ObjectFactory** (\`io.cucumber.core.backend.ObjectFactory\`). Its contract is small:

| Method | Called when | Meaning |
|---|---|---|
| \`addClass(Class<?>)\` | while glue is loaded | "this class may be needed" — register it |
| \`start()\` | before each scenario | open a new scenario scope |
| \`getInstance(Class<T>)\` | when a hook or step of that class runs | return *the* instance for this scenario (create lazily) |
| \`stop()\` | after the scenario's \`@After\` hooks | close the scope; drop all instances |

\`\`\`
glue loading   addClass(AuthSteps) addClass(CartSteps) addClass(Hooks) addClass(ParameterTypes) …
scenario 1     start() ─ getInstance(Hooks) → @Before ─ getInstance(AuthSteps) → step ─ … ─ @After ─ stop()
scenario 2     start() ─ new instances … ─ stop()
\`\`\`

Consequences a senior should be able to state:

1. **One instance per glue class per scenario.** \`CartSteps\` used by five steps in a scenario is one object; the next scenario gets a new one. Instance fields are therefore scenario state — and they are thrown away.
2. Without a DI module, Cucumber uses its **default object factory**: it requires a single accessible zero-argument constructor and fails with "… does not have an single accessible zero-argument constructor" (suggesting a DI module) otherwise. Instances are still per scenario, but classes cannot share anything except through statics.
3. The factory is chosen through Java's \`ServiceLoader\`: exactly one non-default ObjectFactory on the classpath is picked automatically; two (say \`cucumber-picocontainer\` and \`cucumber-spring\`) cause "More than one Cucumber ObjectFactory was found on the classpath" unless you configure one explicitly.
4. In parallel execution each worker thread works with its **own** object factory, so containers are never shared across concurrently running scenarios.

### Why static state leaks

\`\`\`java
public class CartSteps {
    static List<Product> addedProducts = new ArrayList<>();   // lives as long as the class loader
    static WebDriver driver;                                  // one for the whole JVM
}
\`\`\`

- **Between scenarios**: nothing resets \`addedProducts\`; scenario 2 asserts against scenario 1's products — passing in suite order, failing when run alone or rerun (\`cucumber-runner-reports-rerun\`).
- **Between threads**: with parallel scenarios two threads mutate one \`ArrayList\` (not thread-safe) and one \`driver\` — the second \`@Before\` overwrites the first scenario's browser; failures look random.
- **Fixes that do not fix**: clearing statics in \`@Before\` (still shared across threads), \`synchronized\` (serialises the suite), \`ThreadLocal\` without \`remove()\` (leaks into the next scenario on the same pool thread). The real fix is per-scenario objects created by the container.

## PicoContainer internals

### What Cucumber's PicoFactory does

\`cucumber-picocontainer\` builds a container with **caching** (one instance per component per container) and **lifecycle** support. All glue classes are registered as components; when a step runs, Pico resolves the step class's constructor, creates its dependencies recursively, caches them, and injects them. At the end of the scenario the container is stopped and disposed; for the next scenario the cached instances are flushed and new ones created. So:

- **Constructor injection only**, no annotations. Pico chooses the greediest constructor it can satisfy; keep exactly one public constructor per class to avoid surprises.
- Any **concrete class** with a resolvable public constructor is injectable — it does not need to be glue. \`CartState\`, \`DriverHolder\` and \`ShopEasyApi\` are created on demand.
- **Sharing**: two step classes asking for \`CartState\` receive the *same* instance within a scenario (caching) — that is the whole mechanism of "shared state".
- **Lifecycle**: classes implementing \`org.picocontainer.Disposable\` get \`dispose()\` when the scenario ends — after all \`@After\` hooks, as the cucumber-picocontainer documentation states. PicoContainer's lifecycle also understands \`org.picocontainer.Startable\` (\`start()\`/\`stop()\`), but \`Disposable\` plus lazy creation is the documented, predictable pattern for resources.
- **Interfaces**: Pico cannot instantiate an interface. Options: inject the concrete class; inject a small factory class that returns the interface; or, in recent cucumber-picocontainer versions, a provider class annotated \`@CucumberPicoProvider\` (implementing PicoContainer's \`Provider\` with a \`provide()\` method returning the dependency).

\`\`\`java
// Factory approach — works with every version and keeps the choice testable
public class PaymentGatewayFactory {
    private final TestConfig config;
    public PaymentGatewayFactory(TestConfig config) { this.config = config; }

    public PaymentGateway create() {                     // interface chosen by configuration
        return config.useStub() ? new StubPaymentGateway() : new SandboxPaymentGateway(config.sandboxUrl());
    }
}

// Provider approach — recent cucumber-picocontainer
@CucumberPicoProvider
public class PaymentGatewayProvider implements org.picocontainer.injectors.Provider {
    public PaymentGateway provide() {
        TestConfig config = new TestConfig();
        return config.useStub() ? new StubPaymentGateway() : new SandboxPaymentGateway(config.sandboxUrl());
    }
}
\`\`\`

The payment gateway is a "typical real app" illustration — ShopEasy has no payment step.

## Cucumber Spring

\`cucumber-spring\` uses the Spring TestContext framework:

\`\`\`java
@CucumberContextConfiguration
@ContextConfiguration(classes = TestConfig.class)          // or @SpringBootTest(classes = …)
public class CucumberSpringConfiguration { }

@Configuration
@ComponentScan("com.shopeasy.bdd.support")
public class TestConfig {
    @Bean public ShopEasyApi shopEasyApi(@Value("\${api.base-url:http://localhost:5181}") String url) {
        return new ShopEasyApi(url);                            // singleton: stateless, shared by all scenarios
    }
}

@Component
@ScenarioScope                                              // a new instance per scenario
public class CartState { … }
\`\`\`

How it works:

- **Exactly one** class on the glue path carries \`@CucumberContextConfiguration\` plus a Spring test configuration annotation. Cucumber starts **one application context for the run** (cached by Spring's test framework), not one per scenario — expensive beans (HTTP clients, DB pools, Spring Boot app slices) start once.
- Step and hook classes are glue beans in the **\`cucumber-glue\` scope**: created before each scenario, disposed after it. Do **not** annotate them with \`@Component\` — Cucumber registers them itself, and component scanning would create duplicate definitions (cucumber-spring warns about this).
- Your own state beans need \`@ScenarioScope\` to be per scenario; a plain \`@Component\` is a **singleton** for the whole run — the most common Spring-Cucumber leak.
- \`@ScenarioScope\` beans are proxies bound to the thread executing the scenario. If they must be read from another thread (an Awaitility poll), the docs suggest \`@ScenarioScope(proxyMode = ScopedProxyMode.NO)\` when they are only accessed through step definitions.
- \`@DirtiesContext\` on the configuration class recreates the context — slow, and undefined behaviour with parallel execution.

**When Spring is worth it:** the test project already uses Spring (or Spring Boot) — e.g. it reuses the application's API clients, repositories or configuration properties, needs profiles, or tests a Spring Boot service in-process (\`@SpringBootTest\`). For a UI/API black-box suite, Spring adds start-up time, annotations and a learning curve for little gain.

## Guice, briefly

\`cucumber-guice\` creates an injector from an \`InjectorSource\` (configured with the \`guice.injector-source\` property) whose modules include \`CucumberModules.createScenarioModule()\`; classes annotated \`@ScenarioScoped\` live for one scenario. It suits teams already on Guice; explicit modules make bindings of interfaces easy, at the price of more setup than Pico.

## Selecting the ObjectFactory

\`\`\`properties
# src/test/resources/cucumber.properties (or junit-platform.properties for the JUnit Platform engine)
cucumber.object-factory=io.cucumber.picocontainer.PicoFactory
\`\`\`

The same can be set with \`@CucumberOptions(objectFactory = PicoFactory.class)\` for the TestNG/JUnit 4 runners or \`-Dcucumber.object-factory=…\`. You need this only when more than one factory is on the classpath (often transitively — a shared "test-commons" jar dragging in \`cucumber-spring\`). If the configured class is not on the classpath the run fails with "Could not find object factory …". Check \`mvn dependency:tree -Dincludes=io.cucumber\` first; all Cucumber modules must share one version (use \`cucumber-bom\`).

## Comparing the options

| | PicoContainer | Spring | Guice | Hand-rolled ThreadLocal context | Static map (anti-pattern) |
|---|---|---|---|---|---|
| How it works | constructor injection, container per scenario, zero config | application context per run, glue + \`@ScenarioScope\` beans per scenario | injector + \`@ScenarioScoped\` | \`ThreadLocal<Context>\` set in \`@Before\`, removed in \`@After\` | \`static Map<String,Object>\` |
| Advantages | trivial setup, fast, no annotations, per-scenario by default | reuse application beans, profiles, properties; expensive singletons shared | explicit bindings, interfaces easy | no library; usable from non-DI code (listeners, utilities) | none beyond "it works on my machine" |
| Disadvantages | interfaces need factory/provider; no configuration support | slower start, easy singleton leaks, proxy/thread rules | modules and injector source to maintain | manual lifecycle; forgotten \`remove()\` leaks between scenarios on pooled threads; hidden global access | leaks between scenarios and threads, untyped, order-dependent |
| Performance | best | context start once per run (seconds) | good | good | — |
| Maintainability | high | high in Spring shops | medium | low–medium | very low |
| Parallel safety | yes (per scenario) | yes, if state is \`@ScenarioScope\` | yes, if \`@ScenarioScoped\` | yes if disciplined | no |
| When to use | **default for black-box UI/API suites** | project already Spring-based or in-process Spring Boot tests | project already on Guice | bridging to code Cucumber cannot inject | never |

**Recommended approach and why:** **PicoContainer** for typical Selenium/REST Assured suites — per-scenario isolation by default, no configuration, and the fewest ways to leak state. Choose **Spring** when you would otherwise duplicate the application's Spring configuration or need \`@SpringBootTest\`. Use a \`ThreadLocal\` only as a thin bridge for code outside Cucumber's reach (a TestNG listener, a static logging appender), fed from the DI-managed object in \`@Before\` and cleared in \`@After\`.

## Designing scenario state

### One big Map vs typed, focused objects

\`\`\`java
// Approach A — a "bag" context
public class ScenarioContext {
    private final Map<String, Object> data = new HashMap<>();
    public void put(String key, Object value) { data.put(key, value); }
    @SuppressWarnings("unchecked")
    public <T> T get(String key) { return (T) data.get(key); }
}
// usage: context.put("token", token);  String t = context.get("tokn");   // typo → null, found at runtime
\`\`\`

\`\`\`java
// Approach B — several small typed objects, each injected only where needed
public class TestUser {                       // who the scenario acts as
    private String username;
    private String password;
    private Integer apiUserId;                // set only when the user was created through the API
    public void set(String username, String password) { this.username = username; this.password = password; }
    public String username() { return requireSet(username, "username"); }
    public String password() { return requireSet(password, "password"); }
    public void apiUserId(int id) { this.apiUserId = id; }
    public int apiUserId() { return requireSet(apiUserId, "apiUserId"); }
    private static <T> T requireSet(T value, String name) {
        if (value == null) throw new IllegalStateException(name + " not set — is the scenario missing a Given that creates the user?");
        return value;
    }
}

public class CartState {                      // what the scenario put into the cart
    private final List<Product> products = new ArrayList<>();
    public void added(Product p) { products.add(p); }
    public List<Product> products() { return List.copyOf(products); }
    public Money subtotal() { return products.stream().map(Product::price).reduce(Money.ZERO, Money::plus); }
}

public class ApiSession {                     // REST state for this scenario
    private String token;
    public void token(String token) { this.token = token; }
    public RequestSpecification authorised(RequestSpecification spec) {
        if (token == null) throw new IllegalStateException("No API token — log in first");
        return spec.header("Authorization", "Bearer " + token);
    }
}
\`\`\`

| | A: \`Map<String,Object>\` context | B: typed focused objects |
|---|---|---|
| How it works | string keys, casts | fields with intention-revealing methods |
| Advantages | no new class for new data; quick | compile-time safety, IDE navigation, clear ownership, fail-fast messages ("not set — is a Given missing?") |
| Disadvantages | typos and wrong casts at runtime; hidden coupling — anyone can read anything; keys become a global vocabulary | more classes; needs a design decision for new data |
| Maintainability | degrades with size | stays high |
| Scalability | poor beyond a few keys | good — each step class injects 1–3 objects |
| When to use | spikes; truly ad-hoc values (generated ids) — wrap behind typed accessors | **default** |

**Recommended approach and why:** typed focused objects (\`TestUser\`, \`CartState\`, \`ApiSession\`, \`UiSession\`/\`DriverHolder\`). A step class's constructor then documents what it reads and writes, which is the best dependency documentation you get for free. Avoid a "World" God object that aggregates everything — it reintroduces the Map's coupling with nicer syntax.

## Managing WebDriver with DI

### A lazy DriverHolder

\`\`\`java
package com.shopeasy.bdd.context;

import org.openqa.selenium.WebDriver;
import org.picocontainer.Disposable;

public class DriverHolder implements Disposable {
    private final DriverFactory factory;      // decides local/Grid, options (selenium-deep-framework-design)
    private WebDriver driver;

    public DriverHolder(DriverFactory factory) { this.factory = factory; }

    public WebDriver get() {
        if (driver == null) {
            driver = factory.create();        // created on first use only
        }
        return driver;
    }

    public boolean isStarted() { return driver != null; }

    @Override
    public void dispose() {                   // PicoContainer: runs after all @After hooks
        if (driver != null) {
            try { driver.quit(); }
            catch (RuntimeException e) { System.err.println("quit failed: " + e.getMessage()); }
            finally { driver = null; }
        }
    }
}
\`\`\`

Page objects are created from the holder (\`new CartPage(holder.get())\`) inside tasks, or injected as components that take \`DriverHolder\` in their constructor and call \`get()\` lazily per action. Because the holder is per scenario, **no \`ThreadLocal\` is needed** for Cucumber code: two parallel scenarios have two holders in two containers. You still need the thread-local bridge from \`selenium-deep-parallel-execution\` only for code outside the container.

### API-only scenarios without a browser

With lazy creation, an \`@api\` scenario never touches \`DriverHolder.get()\`, so no browser starts — no 2–3 seconds per scenario and no Grid slot consumed. Two complementary safeguards:

- a tagged hook \`@Before("@ui")\` that calls \`holder.get()\` eagerly, so UI scenarios fail fast in setup (a Grid outage is reported as a hook failure, not as a failure in step 4);
- a guard in UI tasks that throws a clear error if a scenario without \`@ui\` reaches the browser: "scenario is not tagged @ui — add the tag or use the API task".

## Hooks in depth

### Order and tags

| Annotation (\`io.cucumber.java\`) | Scope | Ordering | Notes |
|---|---|---|---|
| \`@Before(value, order)\` | each scenario | **lower order runs first**; default 10000 | value = tag expression |
| \`@After(value, order)\` | each scenario | **higher order runs first**; default 10000 | runs even if the scenario failed |
| \`@BeforeStep\` / \`@AfterStep\` | each step | same rules | optional \`Scenario\` parameter; \`@AfterStep\` sees \`isFailed()\` right after the failing step |
| \`@BeforeAll\` / \`@AfterAll\` | once per run | \`order\` as above | **static**, no parameters; added in Cucumber-JVM 7.0.0 |

Symmetry is the reason for the reverse order: a \`@Before(order = 10)\` that opens the browser and a \`@Before(order = 20)\` that logs in should be undone as \`@After(order = 20)\` (log out/clean data) before \`@After(order = 10)\` (quit). Use the same numbers on both sides and the mirror image falls out.

Tagged hooks take full tag expressions: \`@Before("@ui and not @api")\`, \`@After("@creates-user or @creates-order")\`. Keep tags meaning *what the scenario needs* (\`@ui\`, \`@api\`, \`@logged-in\`), not which hook to run — the tag taxonomy itself is in \`cucumber-deep-bdd-practice-at-scale\`.

### BeforeAll/AfterAll and DI

\`@BeforeAll\`/\`@AfterAll\` methods are static and run outside any scenario, so they **cannot receive injected objects** and must not touch scenario state. Good uses: check the API is up (\`GET /api/health\` → \`{ status: "UP" }\`), start a WireMock server, reset seed data once (ShopEasy's \`POST /api/reset\`) before anything runs. When running on the JUnit Platform through Maven, the Cucumber docs require Surefire/Failsafe 3.0.0-M5 or later for these hooks to behave.

### The Scenario object

\`getName()\`, \`getSourceTagNames()\`, \`isFailed()\`, \`getStatus()\`, \`getId()\`, \`getUri()\`, \`getLine()\`, \`attach(byte[] | String, mediaType, name)\` and \`log(String)\`. \`log\` adds plain text to the report for that scenario; \`attach\` adds evidence (PNG, JSON, HTML). Use \`getUri()\` + \`getLine()\` in log messages — they identify the scenario unambiguously even when names repeat in outlines.

### Hooks vs DI lifecycle for setup and teardown

| | Hooks (\`@Before\`/\`@After\`) | DI lifecycle (lazy creation + \`Disposable\` / \`@ScenarioScope\` destruction) |
|---|---|---|
| How it works | explicit methods, ordered, tag-filtered | object created when first needed, disposed when the container stops |
| Advantages | visible in reports, tag control, access to \`Scenario\` (status, attach) | resource exists only if used; cleanup tied to creation; cannot forget to register |
| Disadvantages | runs for every matching scenario even if the resource is unused; ordering between classes must be managed | no \`Scenario\` access; not visible in reports; container-specific (\`Disposable\` is Pico) |
| When to use | evidence collection, tag-driven setup (seed a user for \`@api\`), anything the report should show | quitting browsers, closing clients, deleting temp files |

**Recommended approach and why:** evidence and business setup in hooks (visible, tag-driven, have \`Scenario\`); resource release in the owner's lifecycle (\`dispose()\`) so it runs **after** every \`@After\` hook — the screenshot hook can never find the browser already gone, regardless of hook \`order\`. If you must stay container-neutral, quit in an \`@After(order = 0)\` (lowest, therefore last) with try/finally.

## Parallel safety with DI

Per-scenario containers make step classes and their state thread-confined automatically, as long as you follow three rules:

1. **No statics with mutable state** in glue, tasks or pages (constants are fine). The only shared objects are immutable configuration and thread-safe clients (REST Assured specifications built per request, an \`ObjectMapper\`, an \`HttpClient\`).
2. **Unique external data per scenario** — a user, an order, an email address. Shared server-side data is the remaining source of parallel flakiness once the JVM side is clean.
3. **Run-wide side effects only in \`@BeforeAll\`/\`@AfterAll\`** — never reset the shared backend inside a scenario hook (\`POST /api/reset\` in \`@Before\` would wipe a neighbour's cart mid-scenario).

Thread-pool and runner configuration are the subject of \`cucumber-deep-execution-reporting-parallel\`; the ThreadLocal mechanics themselves are in \`java-deep-multithreading-synchronization\`.

## Full working example: ShopEasy wiring

### What exists in ShopEasy

- UI (\`http://localhost:5180/practice-site/\`): login accepts only \`standard_user\` and \`locked_out_user\` with \`secret_sauce\`; the session and cart live in \`sessionStorage\` (\`shopeasy.user\`, \`shopeasy.cart\`).
- API (\`http://localhost:5181\`): \`POST /api/users\` registers a customer — body \`{ username, password, firstName, lastName, email, phone?, address? }\`, username 3–40 of \`a-z 0-9 _ . -\`, password ≥ 8 characters; 201 with the user (and \`Location\`), 400 \`VALIDATION_FAILED\`, 409 \`USERNAME_TAKEN\`, 422 \`INVALID_EMAIL\`. \`POST /api/auth/login\` returns \`{ token, tokenType: "Bearer", expiresIn, user: { id, username } }\`. There is **no endpoint to delete a user**; \`POST /api/reset\` restores seed data for everyone.
- Registered API users exist only in the API service — the UI does not know them. So \`@ui\` scenarios use \`standard_user\`, \`@api\` scenarios seed their own user.

### Configuration and clients

\`\`\`java
package com.shopeasy.bdd.support;

public class TestConfig {                                   // immutable; one per scenario is cheap
    public String uiBaseUrl()  { return System.getProperty("ui.base-url",  "http://localhost:5180/practice-site/"); }
    public String apiBaseUrl() { return System.getProperty("api.base-url", "http://localhost:5181"); }
}
\`\`\`

\`\`\`java
package com.shopeasy.bdd.api;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class ShopEasyApi {
    private final RequestSpecification base;

    public ShopEasyApi(TestConfig config) {
        this.base = new RequestSpecBuilder()
                .setBaseUri(config.apiBaseUrl())
                .setContentType(ContentType.JSON)
                .build();
    }

    public Response registerUser(Map<String, Object> body) {
        return given(base).body(body).post("/api/users");
    }

    public Response login(String username, String password) {
        return given(base).body(Map.of("username", username, "password", password)).post("/api/auth/login");
    }

    public RequestSpecification spec() { return given(base); }
}
\`\`\`

### Hooks

\`\`\`java
package com.shopeasy.bdd.hooks;

import com.shopeasy.bdd.api.ShopEasyApi;
import com.shopeasy.bdd.context.ApiSession;
import com.shopeasy.bdd.context.DriverHolder;
import com.shopeasy.bdd.context.TestUser;
import io.cucumber.java.After;
import io.cucumber.java.AfterStep;
import io.cucumber.java.Before;
import io.cucumber.java.BeforeAll;
import io.cucumber.java.Scenario;
import io.restassured.RestAssured;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;

import java.util.Map;
import java.util.UUID;

public class Hooks {

    private final DriverHolder driver;
    private final ShopEasyApi api;
    private final TestUser user;
    private final ApiSession session;

    public Hooks(DriverHolder driver, ShopEasyApi api, TestUser user, ApiSession session) {
        this.driver = driver;
        this.api = api;
        this.user = user;
        this.session = session;
    }

    @BeforeAll
    public static void backendIsUp() {                          // static: no injection here
        String base = System.getProperty("api.base-url", "http://localhost:5181");
        RestAssured.get(base + "/api/health").then().statusCode(200);
        RestAssured.post(base + "/api/reset").then().statusCode(200);   // once, before any scenario
    }

    @Before(value = "@ui", order = 10)
    public void startBrowser(Scenario scenario) {
        driver.get();                                            // eager for @ui: fail fast in setup
        scenario.log("Browser started for " + scenario.getUri() + ":" + scenario.getLine());
    }

    @Before(value = "@ui", order = 20)
    public void uiUser() {
        user.set("standard_user", "secret_sauce");               // the only UI login that exists
    }

    @Before(value = "@api and not @ui", order = 20)
    public void seedApiUser(Scenario scenario) {
        String username = "bdd_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String password = "Sup3rSecret!";
        int id = api.registerUser(Map.of(
                        "username", username,
                        "password", password,
                        "firstName", "Asha",
                        "lastName", "Rao",
                        "email", username + "@shopeasy.test"))
                .then().statusCode(201)
                .extract().path("id");
        user.set(username, password);
        user.apiUserId(id);
        String token = api.login(username, password)
                .then().statusCode(200)
                .extract().path("token");
        session.token(token);
        scenario.log("Seeded API user " + username + " (id " + id + ")");   // never log the password or token
    }

    @AfterStep("@ui")
    public void screenshotOnFailedStep(Scenario scenario) {
        if (scenario.isFailed() && driver.isStarted()) {
            try {
                byte[] png = ((TakesScreenshot) driver.get()).getScreenshotAs(OutputType.BYTES);
                scenario.attach(png, "image/png", "failed step");
            } catch (RuntimeException e) {
                scenario.log("Screenshot failed: " + e.getMessage());   // evidence must not mask the real failure
            }
        }
    }

    @After(value = "@ui", order = 20)
    public void currentUrl(Scenario scenario) {
        if (scenario.isFailed() && driver.isStarted()) {
            try { scenario.attach(driver.get().getCurrentUrl(), "text/plain", "URL at end"); }
            catch (RuntimeException e) { scenario.log("URL unavailable: " + e.getMessage()); }
        }
    }
    // No quit here: DriverHolder.dispose() runs after all @After hooks.
}
\`\`\`

### Steps sharing state

\`\`\`java
public class OrderApiSteps {
    private final ShopEasyApi api;
    private final ApiSession session;
    private final CartState cart;
    private Response lastResponse;                              // instance field = scenario state of this class

    public OrderApiSteps(ShopEasyApi api, ApiSession session, CartState cart) {
        this.api = api; this.session = session; this.cart = cart;
    }

    @Given("the customer has {product} in the API cart")
    public void inApiCart(Product product) {
        session.authorised(api.spec())
               .body(Map.of("productId", productId(product), "quantity", 1))
               .post("/api/cart/items")
               .then().statusCode(201);
        cart.added(product);
    }

    @When("the customer places the order for delivery to postal code {string}")
    public void placesOrder(String postalCode) {
        lastResponse = session.authorised(api.spec())
                .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", postalCode))
                .post("/api/orders");                            // no items → the current cart is ordered
    }

    @Then("the order total includes 8% tax")
    public void totalIncludesTax() {
        Money subtotal = cart.subtotal();
        Money tax = subtotal.percent(8);
        lastResponse.then().statusCode(201);
        assertThat(new BigDecimal(lastResponse.path("total").toString()))
                .isEqualByComparingTo(subtotal.plus(tax).amount());
    }

    private static int productId(Product p) { return p.ordinal() + 1; }   // ShopEasy ids 1–6 follow the catalogue order
}
\`\`\`

\`\`\`gherkin
@api
Scenario: An order placed from the cart is taxed at 8%
  Given the customer has "Trailblazer Backpack" in the API cart
  And the customer has "Pulse Bike Light" in the API cart
  When the customer places the order for delivery to postal code "560001"
  Then the order total includes 8% tax
\`\`\`

Step by step:

1. Cucumber's PicoFactory \`start()\`s a container for the scenario. \`@BeforeAll\` already ran once (health check, reset).
2. Tag \`@api\` (not \`@ui\`) selects \`seedApiUser\`; Pico creates \`Hooks\`, and for its constructor \`DriverHolder\` (no browser yet — lazy), \`ShopEasyApi\` (needs \`TestConfig\`, created too), \`TestUser\`, \`ApiSession\`. The hook registers a unique user, logs in and stores the token.
3. The first step needs \`OrderApiSteps\`; Pico injects the **same** \`ShopEasyApi\`, \`ApiSession\` and a new \`CartState\` (cached for the rest of the scenario). \`POST /api/cart/items\` with \`productId\` 1 then 2.
4. \`POST /api/orders\` without items orders the cart: subtotal 39.98, tax 3.20, total 43.18 — asserted against the \`CartState\` model, not against hard-coded numbers.
5. After hooks for \`@ui\` do not match. Pico \`stop()\`/\`dispose()\`: \`DriverHolder.dispose()\` finds no driver and does nothing. The seeded user stays in the API service (no delete endpoint) — harmless because names are unique; the next run's \`@BeforeAll\` reset removes it.
6. A parallel \`@ui\` scenario on another thread has its own container: its own \`DriverHolder\` with a real browser, its own \`TestUser\` set to \`standard_user\`.

### Real-time project scenario

In a typical e-commerce project the suite grows to UI, API and hybrid scenarios (seed via API, verify in the UI). The typed state objects make hybrid steps straightforward: a Given writes \`CartState\` through the API, a Then reads \`CartState\` and checks the UI. When the team turns on parallel execution, nothing in the glue changes — the only fixes are in test data (unique users) and in the run-wide reset moving to \`@BeforeAll\`.

## Debugging DI errors

| Symptom / message | Cause | How to find and fix |
|---|---|---|
| "… does not have an single accessible zero-argument constructor" | no DI module on the classpath, but a glue class has a constructor with parameters | add \`cucumber-picocontainer\` (same version as \`cucumber-java\`, via \`cucumber-bom\`) |
| PicoContainer \`UnsatisfiableDependenciesException\` naming a class and its unsatisfied dependency | a constructor parameter is an interface, abstract class, or a class without a usable public constructor (or a \`String\`/primitive) | inject a concrete class, a factory, or a \`@CucumberPicoProvider\`; move configuration values into a \`TestConfig\` object |
| PicoContainer \`CyclicDependencyException\` | A needs B and B needs A (often \`CheckoutTasks\` ↔ \`CartTasks\`) | extract the shared part into a third class; cycles usually mean two classes own one responsibility |
| "More than one Cucumber ObjectFactory was found on the classpath" | two DI modules, often transitive | \`mvn dependency:tree -Dincludes=io.cucumber\`; exclude one, or set \`cucumber.object-factory\` |
| "Could not find object factory …" | the configured class is not on the classpath (wrong module or typo) | add the module or fix the class name |
| Spring: state from scenario 1 visible in scenario 2 | state bean is a singleton (\`@Component\` without \`@ScenarioScope\`) | add \`@ScenarioScope\`; review every \`@Component\` in the test code |
| Spring: errors about the context configuration / duplicate glue beans | none or several \`@CucumberContextConfiguration\` classes on the glue path, or \`@Component\` on step classes | keep exactly one configuration class; remove \`@Component\` from glue |
| Steps see \`null\` driver / empty state | a step class was created with \`new\` (steps calling steps) or a static field shadows the injected one | search for \`new .*Steps(\`; inject tasks instead |
| Hooks never run | JUnit/TestNG \`@Before\` imported instead of \`io.cucumber.java.Before\`, or hook package not in glue | fix imports and the \`glue\` setting |

A useful habit: log the identity of shared objects once (\`scenario.log("CartState@" + System.identityHashCode(cart))\`) from two step classes — the same number proves sharing, different numbers prove a second container or a manual \`new\`.

## Best practices for experienced engineers

- PicoContainer by default; Spring only when the project is Spring-based. One DI module on the classpath, versions from \`cucumber-bom\`.
- Small typed state objects with fail-fast accessors; no God "World", no \`Map<String,Object>\` except behind typed methods.
- Lazy, per-scenario \`DriverHolder\`; \`@Before("@ui")\` creates it eagerly for fast failure; API scenarios never start a browser.
- Evidence in \`@AfterStep\`/\`@After\` guarded by try/catch; resource release in \`dispose()\` (or the last \`@After\`, order 0) with try/finally.
- Run-wide work in static \`@BeforeAll\`/\`@AfterAll\` only; unique external data per scenario.
- Constructors do no I/O — Pico may create a class just to run one hook; expensive work belongs in lazy getters or hooks.
- Never log passwords or tokens via \`scenario.log\`; reports are shared artefacts.

## Equivalent in the other stack

Playwright Test **fixtures** are a built-in DI container: \`test.extend<{ cart: CartState; api: ShopEasyApi }>({ … })\` declares per-test objects created lazily when a test (or another fixture) requests them, with teardown code after \`await use(value)\`; \`{ scope: 'worker' }\` gives per-worker objects. The built-in \`page\` fixture is exactly the lazy \`DriverHolder\` — an API-only test that does not request \`page\` never opens a browser. With \`playwright-bdd\`, step functions receive fixtures as parameters, so the same design applies without PicoContainer.

## Interview questions

### Q: How does Cucumber-JVM create step definition objects?

**Short answer (30–60 s):** Through an ObjectFactory: one instance per glue class per scenario, created lazily when a step or hook of that class runs, discarded when the scenario ends. Without a DI module it needs a no-arg constructor; with PicoContainer, Spring or Guice it injects constructor dependencies.

**Detailed answer:** Glue classes are registered with \`addClass\` at glue load; \`start()\` opens a scenario scope, \`getInstance\` creates and caches instances, \`stop()\` drops them after \`@After\` hooks. The factory is chosen via \`ServiceLoader\` or \`cucumber.object-factory\`. In parallel runs each worker thread has its own factory, so scenario objects are thread-confined. This is why instance fields are scenario state and statics are global state.

### Q: Why is static state dangerous in Cucumber, and what do you use instead?

**Short answer (30–60 s):** Statics outlive scenarios and are shared by threads, so data leaks between scenarios and parallel scenarios overwrite each other. Use per-scenario objects from the DI container.

**Detailed answer:** A \`static WebDriver\` is overwritten by the second parallel \`@Before\`; a static list keeps scenario 1's products for scenario 2, so results depend on order and break on rerun or when run alone. Clearing in \`@Before\` doesn't fix threads; \`synchronized\` serialises; \`ThreadLocal\` without \`remove()\` leaks across pooled threads. PicoContainer's per-scenario container gives isolation for free; a ThreadLocal is only a bridge for code outside DI.

### Q: PicoContainer or Spring for a Cucumber suite?

**Short answer (30–60 s):** PicoContainer for black-box UI/API suites — zero configuration, per-scenario by default. Spring when the test project already uses Spring or needs \`@SpringBootTest\` and application beans.

**Detailed answer:** Spring starts one application context per run (shared expensive beans, profiles, properties), with glue in the \`cucumber-glue\` scope and state in \`@ScenarioScope\` beans; risks are singleton leaks from plain \`@Component\`s, thread-bound scoped proxies, \`@DirtiesContext\` slowness and undefined parallel behaviour. Pico's limits are interfaces (factory or \`@CucumberPicoProvider\`) and no configuration support — solved with a small \`TestConfig\` class. I'd pick by the project's existing stack, not by preference.

### Q: How do you share state between step classes, and how do you design that state?

**Short answer (30–60 s):** Inject the same per-scenario objects into each step class's constructor. I use several small typed objects — \`TestUser\`, \`CartState\`, \`ApiSession\`, \`DriverHolder\` — rather than one \`Map<String,Object>\`.

**Detailed answer:** Typed objects give compile-time safety, discoverability and fail-fast messages; each step class's constructor documents its dependencies. A Map gives runtime typos and invisible coupling; a single God "World" object reintroduces the coupling. Ad-hoc values go behind typed accessors. Instance fields in a step class are fine for state used only inside that class (the last response).

### Q: Explain hook ordering and tagged hooks.

**Short answer (30–60 s):** \`@Before\` runs lower \`order\` first, \`@After\` runs higher \`order\` first, default 10000 — so setup and teardown mirror each other. Hooks take tag expressions like \`@Before("@ui and not @api")\`.

**Detailed answer:** Mirroring means a browser opened at order 10 and a login at order 20 are undone as logout (20) then quit (10). \`@AfterStep\` sees a failure immediately — best place for screenshots. \`@BeforeAll\`/\`@AfterAll\` (Cucumber 7.0.0+) are static, parameterless, and cannot use injected objects. With Pico, \`Disposable.dispose()\` runs after all \`@After\` hooks, which makes it ideal for quitting the driver.

### Q: How do you avoid starting a browser for API-only scenarios?

**Short answer (30–60 s):** A lazy \`DriverHolder\` that creates the driver on first \`get()\`, an eager \`@Before("@ui")\` for UI scenarios, and cleanup that only quits when started.

**Detailed answer:** Because DI creates the holder per scenario, it is thread-confined and needs no ThreadLocal. API scenarios never call \`get()\`, saving browser start-up and Grid slots. A guard in UI tasks gives a clear error when an untagged scenario reaches the browser. Hooks that collect evidence check \`isStarted()\` so an API failure does not try to screenshot a browser that does not exist.

### Q: Hooks or DI lifecycle for setup and teardown?

**Short answer (30–60 s):** Hooks for tag-driven setup and evidence (they are visible and get the \`Scenario\`); DI lifecycle — lazy creation and dispose — for resources, so cleanup runs exactly when the resource exists and after all \`@After\` hooks.

**Detailed answer:** Hooks run whenever tags match, even if the scenario never uses the resource, and ordering across hook classes is a convention you must maintain. Lazy creation plus \`Disposable\` couples cleanup to creation. The trade-off: dispose is container-specific and invisible in reports, so business setup (seeding a user) stays in hooks where the report shows it.

## Scenario-based questions

### After enabling parallel execution, cart assertions fail randomly

I would look for shared mutable state first: \`grep -rn "static" src/test/java\` filtered to non-final fields; typical culprits are a static \`ScenarioContext\` map or a static driver in a base class. Then check Spring \`@Component\` state beans without \`@ScenarioScope\`. Next, external data: several scenarios using \`standard_user\` against the API share one server-side cart — fix with seeded unique users for \`@api\`. Finally, confirm no scenario hook calls \`POST /api/reset\`. I'd verify by logging \`System.identityHashCode\` of \`CartState\` with the thread name in two parallel scenarios.

### The team wants to move from PicoContainer to Spring "because it's more enterprise"

I would ask what problem Spring solves here: do we reuse application beans, need profiles or \`@SpringBootTest\`? If not, the costs are start-up time, singleton leak risk and annotations everywhere. If yes, plan the migration: one \`@CucumberContextConfiguration\`, state classes become \`@ScenarioScope\` beans, glue classes lose any \`@Component\`, \`Disposable\` logic moves to \`@After\` hooks or bean destruction callbacks, and remove \`cucumber-picocontainer\` so only one ObjectFactory remains. Run the suite in parallel before and after and compare duration.

### Screenshots in the report are blank or missing for failed UI scenarios

The browser is probably quit before the screenshot hook runs: an \`@After\` that quits has a higher \`order\` than the screenshot hook (higher runs first for \`@After\`). Fix by taking the screenshot in \`@AfterStep\` when \`isFailed()\`, and moving \`quit()\` to \`DriverHolder.dispose()\` (after all hooks) or to \`@After(order = 0)\`. Also check the screenshot code catches its own exceptions, so a dead browser does not hide the original failure.

## Tricky follow-ups

- **Q: Is a step class instance shared between two scenarios running one after another on the same thread?** No — the container is stopped and its cached instances flushed; the next scenario gets new instances.
- **Q: Can a \`@BeforeAll\` method use an injected \`ShopEasyApi\`?** No. It is static and runs outside any scenario; create what it needs locally or use a static, immutable configuration.
- **Q: Are \`@ParameterType\` classes also created by the ObjectFactory?** Yes — they are glue classes, instantiated per scenario like step classes, so they can receive injected objects (keep transformers pure anyway).
- **Q: Does \`Disposable.dispose()\` run before or after \`@After\` hooks?** After all \`@After\` hooks, when the scenario's container is stopped.
- **Q: Why might a Spring \`@ScenarioScope\` bean fail inside an Awaitility block?** The scoped proxy is bound to the scenario's thread; Awaitility may poll on another thread. Use \`proxyMode = ScopedProxyMode.NO\` when the bean is only used through step definitions, or avoid reading it on the polling thread.`,
  keyPoints: [
    'The ObjectFactory creates one instance per glue class per scenario (start → getInstance lazily → stop after @After hooks); in parallel runs each worker thread has its own factory.',
    'Static mutable state leaks between scenarios and threads; per-scenario DI objects are the fix, ThreadLocal only a bridge for code outside the container.',
    'PicoContainer: constructor injection, caching per scenario, Disposable runs after all @After hooks, interfaces via a factory or @CucumberPicoProvider. Spring: one context per run, glue in cucumber-glue scope, state beans need @ScenarioScope.',
    'Exactly one ObjectFactory on the classpath, or select it with cucumber.object-factory; versions aligned via cucumber-bom.',
    'Model scenario state as small typed objects (TestUser, CartState, ApiSession, DriverHolder) with fail-fast accessors instead of a Map or a God World object.',
    '@Before runs lower order first, @After higher order first (default 10000); tagged hooks use tag expressions; @BeforeAll/@AfterAll (7.0.0+) are static and cannot use injection.',
    'Evidence and tag-driven setup in hooks; resource release in the DI lifecycle; a lazy DriverHolder keeps API-only scenarios browser-free.',
  ],
  mistakes: [
    'Spring state bean declared with @Component only — a singleton for the whole run, so cart data leaks between scenarios. Fix: @ScenarioScope on every state bean; review all @Component classes in test code.',
    'Quitting the driver in an @After with a higher order than the screenshot hook — evidence is taken from a dead browser. Fix: screenshot in @AfterStep on failure; quit in DriverHolder.dispose() or @After(order = 0) with try/finally.',
    'Resetting shared backend data (POST /api/reset) in a @Before hook — parallel neighbours lose their carts. Fix: reset once in static @BeforeAll and give each scenario unique data (a seeded user).',
    '"More than one Cucumber ObjectFactory was found on the classpath" after adding a shared test library. Fix: mvn dependency:tree -Dincludes=io.cucumber, exclude the transitive DI module or set cucumber.object-factory.',
    'UnsatisfiableDependenciesException because a step constructor asks for an interface or a String URL. Fix: inject a concrete class, a factory, a @CucumberPicoProvider, or a TestConfig object that exposes the values.',
    'ThreadLocal context set in @Before but never removed — the next scenario on the same pool thread sees stale data. Fix: prefer DI-scoped objects; if a bridge is required, call remove() in a finally block of the last @After.',
  ],
  tryIt: `Against ShopEasy (UI \`http://localhost:5180/practice-site/\`, API \`http://localhost:5181\`): (1) create \`TestUser\`, \`CartState\`, \`ApiSession\` and a lazy \`DriverHolder implements Disposable\`; (2) write \`Hooks\` with a static \`@BeforeAll\` health check (\`GET /api/health\`), \`@Before("@ui")\` that starts the browser, and \`@Before("@api and not @ui")\` that registers a unique user with \`POST /api/users\` and stores the token from \`POST /api/auth/login\`; (3) run one \`@api\` scenario (add Junior Onesie and Storm Fleece Jacket to the API cart, place the order, expect total $62.62 = 57.98 + 4.64) and confirm in the log that no browser started; (4) log \`System.identityHashCode\` of \`CartState\` from two step classes to prove sharing, then run two scenarios in parallel and show different hash codes; (5) add \`cucumber-spring\` to the POM temporarily, read the "More than one Cucumber ObjectFactory" error, and fix it with \`cucumber.object-factory\`.`,
  problems: ['cuc-012', 'cuc-024', 'cuc-039'],
}
