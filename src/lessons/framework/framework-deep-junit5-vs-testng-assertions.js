export default {
  slug: 'framework-deep-junit5-vs-testng-assertions',
  category: 'framework',
  order: 12,
  title: 'Deep dive: JUnit 5 architecture, extensions and assertions — and how it compares to TestNG',
  minutes: 32,
  summary: 'Explain the JUnit Platform, engines and the Jupiter lifecycle, build a WebDriver extension with parameter injection and correctly timed failure screenshots, use parameterised, repeated and dynamic tests, configure parallel execution with resource locks, choose between JUnit, Hamcrest and AssertJ assertions (including custom domain assertions), and decide and plan between TestNG and JUnit 5 — with a migration mapping and step-by-step plan.',
  manualAnalogy: `A test management tool is one platform that can run manual cases, exploratory charters and imported automated results side by side, with one set of filters and one report. JUnit 5 is built the same way: the Platform is the shared tool, and Jupiter, Cucumber or TestNG are plug-in "engines" for different kinds of tests. Extensions are the team's standard procedures — prepare a browser, capture evidence when something fails, clean up — attached once instead of written into every case.`,
  body: `## Where this fits

\`framework-deep-testng-internals-extensibility\` took TestNG apart. This lesson does the same for JUnit 5 — the Platform, the Jupiter programming model and its extension API — then compares assertion libraries and the two runners, and ends with a migration plan. Beginner material on TestNG assertions is in \`framework-hard-and-soft-assertions\`; Cucumber on the JUnit Platform is covered in \`cucumber-deep-execution-reporting-parallel\`; Surefire/Maven internals in \`framework-deep-maven-build-internals\`; thread-safety basics in \`java-deep-multithreading-synchronization\`.

**Versions.** The handbook baseline is JUnit 5 (Jupiter 5.10+). JUnit **6.0.0** went GA on 30 September 2025: a Java 17 baseline, one version number for Platform, Jupiter and Vintage, the Vintage engine deprecated, the JUnit 4 \`junit-platform-runner\` removed, Surefire/Failsafe below 3.0.0 no longer supported, and \`@CsvSource\`/\`@CsvFileSource\` re-implemented on FastCSV (stricter quote handling). Everything in this lesson works on 5.10+ and 6.x unless marked otherwise.

## Architecture: Platform, Jupiter, Vintage

### What it is

JUnit 5 is not one library but three layers:

\`\`\`
IDE · Maven Surefire/Failsafe · Gradle · ConsoleLauncher
        │   (all of them are just "launcher clients")
        ▼
JUnit Platform  ── Launcher API: discover → filter (tags, class names, engines) → execute → TestExecutionListener events
        │   TestEngine SPI (found with ServiceLoader: META-INF/services/org.junit.platform.engine.TestEngine)
        ├── junit-jupiter-engine      your @Test / @ParameterizedTest / extensions (the "JUnit 5" programming model)
        ├── junit-vintage-engine      JUnit 3/4 tests (deprecated in 6.0)
        ├── cucumber-junit-platform-engine   .feature files
        ├── testng-engine (org.junit.support)   TestNG classes
        └── other engines (Spock, Kotest, ArchUnit, …)
\`\`\`

- **Platform** (\`junit-platform-*\`): a generic launcher that knows nothing about \`@Test\`. It asks every engine on the classpath to **discover** a tree of \`TestDescriptor\`s for the selectors it receives (packages, classes, classpath resources), applies filters (tag expressions, class-name patterns, engine include/exclude), then asks each engine to **execute** its tree, broadcasting events to \`TestExecutionListener\`s (IDE progress, Surefire XML reports, Open Test Reporting).
- **Jupiter** (\`junit-jupiter-api\` + \`junit-jupiter-engine\` + \`junit-jupiter-params\`): the annotations, assertions and the extension model you write tests with; the engine turns classes into descriptors and runs the lifecycle.
- **Vintage**: an engine that runs JUnit 4 tests on the Platform — the bridge for gradual migrations.

### Why the split matters to an SDET

- **Mixed suites in one run.** Jupiter tests, Cucumber features and (via \`testng-engine\`) TestNG classes can run in one \`mvn test\` with one report format, one tag filter and one parallel configuration per engine.
- **The build tool is just a client.** Surefire 3 contains a JUnit Platform provider: if an engine is on the test classpath it discovers through the Platform; \`<groups>\`/\`-Dgroups\` become tag expressions (\`smoke & !slow\`); \`<configurationParameters>\` or \`src/test/resources/junit-platform.properties\` configure the engines.
- **Engines are independent.** \`junit.jupiter.*\` keys configure only Jupiter; \`cucumber.*\` only Cucumber; \`testng.*\` only the TestNG engine.

### Is there a TestNG engine?

Yes: \`org.junit.support:testng-engine\` (maintained under the JUnit team's GitHub, examples use 1.1.0) runs TestNG classes on the JUnit Platform. Facts from its README that decide whether it fits:

- supports TestNG 6.14.3+ on Platform 1.5+;
- **does not support \`testng.xml\` suites** — use Platform selectors/\`@Suite\` instead;
- TestNG groups are exposed as Platform **tags**, but the README recommends the engine's own \`testng.groups\`/\`testng.excludedGroups\` parameters (tag filters do not support wildcards, and \`@BeforeGroups\`/\`@AfterGroups\` may not run on some TestNG versions);
- configuration via \`testng.parallel\`, \`testng.threadCount\`, \`testng.dataProviderThreadCount\`, \`testng.listeners\`, \`testng.preserveOrder\`, \`testng.outputDirectory\`, \`testng.useDefaultListeners\` (default false — no TestNG HTML reports unless enabled);
- discovery runs TestNG in **dry-run mode** and listeners are called during it — listeners must check \`RuntimeBehavior.isDryRun()\`.

That makes it the migration bridge (below), not a reason to keep \`testng.xml\`.

\`\`\`xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.junit</groupId>
      <artifactId>junit-bom</artifactId>
      <version>\${junit.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency>                                   <!-- api + params + engine -->
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>                                   <!-- only during a TestNG → JUnit migration -->
    <groupId>org.junit.support</groupId>
    <artifactId>testng-engine</artifactId>
    <version>\${testng-engine.version}</version>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testng</groupId>
    <artifactId>testng</artifactId>
    <version>\${testng.version}</version>
    <scope>test</scope>
  </dependency>
</dependencies>
\`\`\`

Check the Surefire log for the provider it chose ("Using auto detected provider …") — with TestNG and Platform engines on the classpath, verify it is the JUnit Platform provider; the Maven deep dive covers forcing a provider.

## The Jupiter lifecycle

### Per-method instances by default

Jupiter creates a **new instance of the test class for every test method** (\`Lifecycle.PER_METHOD\`). Consequences:

- \`@BeforeAll\`/\`@AfterAll\` must be **static** — there is no instance yet;
- instance fields are naturally reset per test (no state leaks between tests through fields — unlike TestNG, where one instance serves all methods of a class);
- \`@TestInstance(Lifecycle.PER_CLASS)\` (or \`junit.jupiter.testinstance.lifecycle.default = per_class\`) gives one instance per class: non-static \`@BeforeAll\`, shared fields — and the TestNG-style leak risks back.

### The annotations that matter

| Annotation | Purpose | Notes for seniors |
|---|---|---|
| \`@BeforeAll\` / \`@AfterAll\` | once per class (container) | static unless PER_CLASS |
| \`@BeforeEach\` / \`@AfterEach\` | around each test | superclass methods run first (before) / last (after) — like TestNG |
| \`@Nested\` | inner (non-static) class = a sub-context | outer \`@BeforeEach\` runs before inner \`@BeforeEach\`; great for "given logged in → when cart has items → …" structures |
| \`@DisplayName\` / \`@DisplayNameGeneration\` | readable names in IDE and reports | \`ReplaceUnderscores\` generator for \`cart_shows_badge_after_add\` |
| \`@Tag("smoke")\` | filtering by tag expressions | the replacement for TestNG groups (no \`dependsOnGroups\`) |
| \`@Disabled("JIRA-123")\` | skip with reason | appears as skipped/disabled in reports |
| \`@EnabledIfSystemProperty(named = "env", matches = "qa\\|staging")\` | conditional execution | also \`@EnabledOnOs\`, \`@EnabledOnJre\`, \`@EnabledIfEnvironmentVariable\`, \`@EnabledIf("methodName")\` |
| \`@TestMethodOrder(MethodOrderer.OrderAnnotation.class)\` + \`@Order(n)\` | explicit method order | ordering only — **no skip semantics**; default order is deterministic but intentionally non-obvious |
| \`Assumptions.assumeTrue(...)\` | abort (not fail) when a precondition is not met | result "aborted"/skipped — e.g. a feature flag is off in this environment |

\`\`\`java
@DisplayName("ShopEasy cart")
@Tag("cart")
class CartTest {

    @Nested
    @DisplayName("as a guest")
    class AsGuest {
        @Test
        @DisplayName("checkout asks to log in")
        void checkoutRequiresLogin(WebDriver driver) { /* ... */ }
    }

    @Nested
    @DisplayName("as standard_user with the backpack in the cart")
    class WithBackpack {
        @BeforeEach
        void seedCart(WebDriver driver) { /* login + add trailblazer-backpack via the fast path */ }

        @Test
        @DisplayName("badge shows 1")
        void badgeShowsOne(WebDriver driver) { /* [data-testid='shopping-cart-badge'] */ }

        @Test
        @Tag("smoke")
        @DisplayName("removing it empties the cart")
        void removeEmptiesCart(WebDriver driver) { /* #remove-trailblazer-backpack, #empty-cart-message */ }
    }
}
\`\`\`

The report reads like a specification ("ShopEasy cart › as standard_user with the backpack in the cart › badge shows 1"), and the context hierarchy replaces TestNG's \`dependsOnMethods\` chains: each nested test gets the full set-up it needs, independently.

## The extension model in depth

### What it is and how it works

JUnit 4 had runners and rules; TestNG has listeners plus \`IHookable\`/injection. Jupiter has **one** mechanism: *extensions* — classes implementing small, single-purpose interfaces that the engine calls at defined points. An extension is registered on a class/method or globally; the engine builds an \`ExtensionContext\` tree (engine → class → method) mirroring the test tree, and gives each callback the context of where it is called.

The relative order for one test (from the JUnit User Guide):

\`\`\`
BeforeAllCallback → @BeforeAll
  BeforeEachCallback → @BeforeEach
    BeforeTestExecutionCallback
      @Test method                      ← InvocationInterceptor wraps this call
      TestExecutionExceptionHandler     (only if the test threw)
    AfterTestExecutionCallback          ← the test outcome is known, @AfterEach has NOT run yet
  @AfterEach → AfterEachCallback
@AfterAll → AfterAllCallback
(method context closes: CloseableResources in its Store are closed)
TestWatcher.testSuccessful / testFailed / testAborted / testDisabled
\`\`\`

The last two lines decide where screenshots go: the User Guide states that stored resources are closed **before** \`TestWatcher\` methods are invoked, and \`TestWatcher\` runs after \`@AfterEach\`. If the driver is quit in \`@AfterEach\`/\`AfterEachCallback\` or closed as a store resource, \`testFailed\` has no browser left. **Take the screenshot in \`AfterTestExecutionCallback\`** (it can read \`context.getExecutionException()\`), use \`TestWatcher\` for reporting outcomes.

### The extension points you will use

| Interface | Method(s) | Typical use |
|---|---|---|
| \`BeforeAllCallback\` / \`AfterAllCallback\` | \`beforeAll(ctx)\` / \`afterAll(ctx)\` | per-class resources (API client, test-data namespace) |
| \`BeforeEachCallback\` / \`AfterEachCallback\` | \`beforeEach(ctx)\` / \`afterEach(ctx)\` | start/quit a browser, reset data |
| \`BeforeTestExecutionCallback\` / \`AfterTestExecutionCallback\` | immediately around the test body | timing, **screenshot on failure** |
| \`ParameterResolver\` | \`supportsParameter(pc, ec)\`, \`resolveParameter(pc, ec)\` | inject \`WebDriver\`, \`ShopEasyApi\`, a test user into constructors/methods |
| \`TestWatcher\` | \`testSuccessful/testFailed/testAborted/testDisabled\` | result notifications, metrics, ticket links |
| \`TestExecutionExceptionHandler\` | \`handleTestExecutionException(ctx, throwable)\` — rethrow or swallow | enrich failures (add URL, step), translate exceptions |
| \`LifecycleMethodExecutionExceptionHandler\` | same for \`@BeforeEach\` etc. | evidence when set-up fails |
| \`InvocationInterceptor\` | \`interceptTestMethod(invocation, invocationContext, ctx)\` → \`invocation.proceed()\` | wrap the body (MDC, security context) — TestNG's \`IHookable\` |
| \`ExecutionCondition\` | \`evaluateExecutionCondition(ctx)\` | custom enable/disable (feature flags, "known defect" list) |
| \`TestInstancePostProcessor\` | \`postProcessTestInstance(instance, ctx)\` | field injection into test instances |
| \`TestTemplateInvocationContextProvider\` | provide invocation contexts | custom parameterisation (e.g. "run on each browser") |

### State: \`ExtensionContext.Store\`

Extensions must be **stateless** objects — one instance may serve many tests, in parallel. State goes into the store of the context it belongs to:

\`\`\`java
private static final ExtensionContext.Namespace NS =
        ExtensionContext.Namespace.create(WebDriverExtension.class);

ExtensionContext.Store store = context.getStore(NS);   // method context → per test; class context → per class
store.put("driver", driver);
WebDriver d = store.get("driver", WebDriver.class);
store.remove("driver", WebDriver.class);
\`\`\`

- Stores are hierarchical: a lookup in a method context falls back to parent (class, engine) contexts. \`context.getRoot().getStore(NS)\` is the run-wide store — the place for "once per run" resources (TestNG's \`@BeforeSuite\`).
- Values implementing \`ExtensionContext.Store.CloseableResource\` are closed when their context ends, in reverse order of insertion. (JUnit 6 deprecates \`getOrComputeIfAbsent\` in favour of \`computeIfAbsent\`.)
- **This replaces \`ThreadLocal\`.** State keyed by context is correct under parallel execution by construction, because each test has its own method context — whichever thread runs it.

### Registration

| Way | Scope | When |
|---|---|---|
| \`@ExtendWith(WebDriverExtension.class)\` on a class/method (or a meta-annotation like \`@UiTest\`) | declarative; inherited by subclasses and \`@Nested\` | default; no configuration needed |
| \`@RegisterExtension static WebDriverExtension browser = new WebDriverExtension(config)\` | programmatic, configurable instance; static field = class-level callbacks too | the extension needs constructor arguments |
| Auto-detection: \`META-INF/services/org.junit.jupiter.api.extension.Extension\` + \`junit.jupiter.extensions.autodetection.enabled=true\` | every test in the run | global concerns from a framework JAR (logging, evidence) |

Composed annotations keep tests clean:

\`\`\`java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Tag("ui")
@ExtendWith(WebDriverExtension.class)
public @interface UiTest {}
\`\`\`

### Complete example: \`WebDriverExtension\`

Goal: a test (or \`@BeforeEach\`) declares a \`WebDriver\` parameter and gets a fresh browser; on failure a screenshot is saved before anything is torn down; the browser always quits; it is safe in parallel without \`ThreadLocal\`.

\`\`\`java
package com.shopeasy.framework.junit;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolutionException;
import org.junit.jupiter.api.extension.ParameterResolver;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.shopeasy.framework.config.UiConfig;
import com.shopeasy.framework.driver.DriverFactory;

public class WebDriverExtension
        implements BeforeEachCallback, ParameterResolver, AfterTestExecutionCallback, AfterEachCallback {

    private static final Logger log = LoggerFactory.getLogger(WebDriverExtension.class);
    private static final ExtensionContext.Namespace NS = ExtensionContext.Namespace.create(WebDriverExtension.class);
    private static final String DRIVER = "driver";

    private final UiConfig config;

    public WebDriverExtension() {                       // used by @ExtendWith
        this(UiConfig.load());
    }

    public WebDriverExtension(UiConfig config) {        // used by @RegisterExtension
        this.config = config;
    }

    // 1. one browser per test, stored in the TEST's context
    @Override
    public void beforeEach(ExtensionContext context) {
        WebDriver driver = DriverFactory.create(config, context.getDisplayName());
        context.getStore(NS).put(DRIVER, driver);
    }

    // 2. inject it into @Test / @BeforeEach / @AfterEach method parameters
    @Override
    public boolean supportsParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {
        return parameterContext.getParameter().getType() == WebDriver.class
                && parameterContext.getDeclaringExecutable() instanceof Method;   // not constructors: no browser yet
    }

    @Override
    public Object resolveParameter(ParameterContext parameterContext, ExtensionContext extensionContext) {
        WebDriver driver = extensionContext.getStore(NS).get(DRIVER, WebDriver.class);
        if (driver == null) {
            throw new ParameterResolutionException(
                    "No WebDriver for " + extensionContext.getDisplayName() + " — WebDriver is per test (method-level).");
        }
        return driver;
    }

    // 3. outcome known, @AfterEach not yet run: the page is still the failing page
    @Override
    public void afterTestExecution(ExtensionContext context) {
        Optional<Throwable> failure = context.getExecutionException();
        if (failure.isEmpty()) {
            return;
        }
        WebDriver driver = context.getStore(NS).get(DRIVER, WebDriver.class);
        if (driver == null) {
            return;
        }
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            Path file = Path.of("target", "screenshots", fileName(context) + ".png");
            Files.createDirectories(file.getParent());
            Files.write(file, png);
            context.publishReportEntry("screenshot", file.toString());   // shows in IDE / Platform reports
            log.info("Saved failure screenshot {} (url: {})", file, driver.getCurrentUrl());
        } catch (Exception e) {
            log.warn("Could not capture screenshot for {}: {}", context.getUniqueId(), e.toString());  // never mask the failure
        }
    }

    // 4. always quit, even when the test or @AfterEach failed
    @Override
    public void afterEach(ExtensionContext context) {
        WebDriver driver = context.getStore(NS).remove(DRIVER, WebDriver.class);
        if (driver != null) {
            try {
                driver.quit();
            } catch (Exception e) {
                log.warn("quit() failed for {}: {}", context.getDisplayName(), e.toString());
            }
        }
    }

    private static String fileName(ExtensionContext context) {
        String cls = context.getRequiredTestClass().getSimpleName();
        String method = context.getTestMethod().map(Method::getName).orElse("unknown");
        return (cls + "-" + method + "-" + context.getDisplayName()).replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
\`\`\`

A test using it:

\`\`\`java
@UiTest
class SortingTest {

    @Test
    @DisplayName("Price (high to low) puts the Storm Fleece Jacket first")
    void priceHighToLow(WebDriver driver) {
        InventoryPage inventory = new InventoryPage(driver).open().sortBy("hilo");   // <select id="product-sort">
        assertThat(inventory.productNames()).first().isEqualTo("Storm Fleece Jacket");
    }
}
\`\`\`

Step by step:

1. \`beforeEach\` runs before any user \`@BeforeEach\`, so a user \`@BeforeEach void login(WebDriver driver)\` already gets the browser. The driver is stored in the **method** context's store under the extension's namespace — no static map, no \`ThreadLocal\`, parallel-safe.
2. \`ParameterResolver\` is called for every parameter of every method JUnit invokes; \`supportsParameter\` must be precise (type check, executable kind). Two resolvers claiming the same parameter fail with a \`ParameterResolutionException\` naming both.
3. \`afterTestExecution\` sees the exception (\`getExecutionException()\`) while the browser still shows the failing state; \`publishReportEntry\` attaches the path to the test's report entries.
4. \`afterEach\` removes and quits the driver; failures to quit are logged, not thrown, so they do not replace the real failure.
5. The screenshot is never taken in \`TestWatcher.testFailed\`, because by then \`@AfterEach\` (and this \`afterEach\`) has run.

Variants: an \`ApiClientExtension\` that resolves a logged-in \`ShopEasyApi\` client (token from \`POST /api/auth/login\`, stored in the class context so one login serves the class); a \`TestUserExtension\` that creates a user with \`POST /api/users\` before the test and stores a \`CloseableResource\` that deletes it — clean-up guaranteed by the store.

### \`TestExecutionExceptionHandler\` and \`InvocationInterceptor\`

\`\`\`java
public class PageContextOnFailure implements TestExecutionExceptionHandler {
    @Override
    public void handleTestExecutionException(ExtensionContext context, Throwable throwable) throws Throwable {
        String url = Optional.ofNullable(context.getStore(NS).get("driver", WebDriver.class))
                .map(WebDriver::getCurrentUrl).orElse("(no browser)");
        throwable.addSuppressed(new IllegalStateException("Page at failure: " + url));   // keep type and message
        throw throwable;                                                                   // swallowing = test passes!
    }
}

public class MdcInterceptor implements InvocationInterceptor {
    @Override
    public void interceptTestMethod(Invocation<Void> invocation,
                                    ReflectiveInvocationContext<Method> invocationContext,
                                    ExtensionContext extensionContext) throws Throwable {
        MDC.put("test", extensionContext.getDisplayName());
        try {
            invocation.proceed();          // must be called exactly once (or skip() to not run it)
        } finally {
            MDC.remove("test");
        }
    }
}
\`\`\`

Both have the same danger as TestNG's \`IHookable\`: a handler that does not rethrow, or an interceptor that never proceeds, makes a broken test green.

### Multiple approaches: where to manage the driver in JUnit 5

| | Base class with \`@BeforeEach\`/\`@AfterEach\` | Extension with \`ParameterResolver\` (above) | \`@RegisterExtension\` field exposing \`driver()\` |
|---|---|---|---|
| How it works | inheritance; driver in a field (fresh instance per test) | callbacks + store + injection | instance field extension, test calls \`browser.driver()\` |
| Advantages | familiar; easy to read | composition, no inheritance, parallel-safe, screenshot ordering right | configurable per class (browser, size) |
| Disadvantages | single inheritance; screenshot timing needs \`TestWatcher\` tricks; temptation to grow a God base class | more framework code; parameter lists | the extension instance holds per-test state unless it uses the store |
| Maintainability | degrades as concerns pile up | high: one concern per extension | good |
| Scalability (parallel) | fine with per-method instances | best | fine if state is in the store |
| When to use | small suites | **framework default** | classes needing special browser config |

**Recommended approach and why:** the extension + \`ParameterResolver\`, wrapped in a composed \`@UiTest\` annotation. It separates concerns, gets the screenshot timing right by construction, and avoids \`ThreadLocal\` entirely — the main structural advantage JUnit 5 has over TestNG for Selenium frameworks.

## Parameterised tests

\`@ParameterizedTest\` (in \`junit-jupiter-params\`, part of the \`junit-jupiter\` aggregate) + one or more sources:

| Source | Example | Best for |
|---|---|---|
| \`@ValueSource\` | \`@ValueSource(strings = {"az", "za", "lohi", "hilo"})\` | one simple argument |
| \`@NullSource\` / \`@EmptySource\` / \`@NullAndEmptySource\` | with \`@ValueSource\` | blank-input validation |
| \`@CsvSource\` | inline rows, \`textBlock\`, \`useHeadersInDisplayName\` | small tables |
| \`@CsvFileSource\` | \`resources = "/data/checkout.csv", numLinesToSkip = 1\` | tables maintained outside code |
| \`@MethodSource\` | \`Stream<Arguments>\` from a factory method | typed objects, computed data |
| \`@EnumSource\` | \`@EnumSource(value = SortOption.class, names = {"LOHI", "HILO"})\` | enums, subsets with \`mode\` |
| \`@ArgumentsSource\` | your \`ArgumentsProvider\` | data from an API/DB, reusable sources |

\`\`\`java
@ParameterizedTest(name = "[{index}] {arguments}")
@CsvSource(useHeadersInDisplayName = true, textBlock = """
    first, last, postal, expectedError
    '',    Rao,  560001, 'Error: First Name is required'
    Asha,  '',   560001, 'Error: Last Name is required'
    Asha,  Rao,  '',     'Error: Postal Code is required'
    """)
void checkoutValidation(String first, String last, String postal, String expectedError, WebDriver driver) { /* ... */ }
\`\`\`

The error texts are the ones ShopEasy's \`checkout.html\` shows in \`#checkout-error-message\`. Note the header row: \`useHeadersInDisplayName = true\` turns it into argument names (\`[1] first = , last = Rao, …\`); without that flag the header line would be treated as a data row — a classic "why does my first case fail with first = 'first'?" bug. Also note that a \`WebDriver\` parameter **after** the indexed arguments is resolved by the extension: aggregated/indexed arguments come first, resolver-supplied parameters last.

\`\`\`java
static Stream<Arguments> sortExpectations() {
    return Stream.of(
        Arguments.of(SortOption.AZ,   "Classic Crew T-Shirt"),
        Arguments.of(SortOption.ZA,   "Trailblazer Backpack"),
        Arguments.of(SortOption.LOHI, "Junior Onesie"),
        Arguments.of(SortOption.HILO, "Storm Fleece Jacket"));
}

@ParameterizedTest(name = "{0} shows {1} first")
@MethodSource("sortExpectations")
void firstProductForSort(SortOption option, String expectedFirst, WebDriver driver) { /* ... */ }
\`\`\`

Custom conversion and aggregation:

\`\`\`java
public class MoneyConverter extends TypedArgumentConverter<String, BigDecimal> {
    protected MoneyConverter() { super(String.class, BigDecimal.class); }
    @Override
    protected BigDecimal convert(String source) {                // "$29.99" → 29.99
        return new BigDecimal(source.replace("$", "").trim());
    }
}

public class CustomerAggregator implements ArgumentsAggregator {
    @Override
    public Customer aggregateArguments(ArgumentsAccessor args, ParameterContext context) {
        return new Customer(args.getString(1), args.getString(2), args.getString(3));   // columns 1..3
    }
}

@ParameterizedTest
@CsvSource({"$29.99, Asha, Rao, 560001", "$9.99, Vera, Visual, 94105"})
void orderTotalIncludesTax(@ConvertWith(MoneyConverter.class) BigDecimal price,          // index 0
                           @AggregateWith(CustomerAggregator.class) Customer customer) {  // aggregator after indexed params
    // only one product in the order: total = price × 1.08, rounded to 2 decimals
}
\`\`\`

Parameter order is a rule, not a style choice: **indexed arguments first, then aggregators (\`ArgumentsAccessor\` / \`@AggregateWith\`), then parameters supplied by \`ParameterResolver\`s** (like the \`WebDriver\`). The accessor always sees the whole row, so the aggregator picks its columns by index.

**Naming:** \`name\` supports \`{index}\`, \`{0}\`…, \`{arguments}\`, \`{argumentsWithNames}\`, \`{displayName}\`; set a project default with \`junit.jupiter.params.displayname.default\`. Unlike TestNG, readable per-row names need no \`ITest\` tricks.

**Whole-class parameterisation** (TestNG's \`@Factory\`): JUnit **5.13** added \`@ParameterizedClass\`, which runs a top-level or \`@Nested\` class once per argument set. Before 5.13 the options were a \`@Nested\` class per variant, a \`TestTemplateInvocationContextProvider\`, or a dynamic-test factory.

## \`@RepeatedTest\` and dynamic tests

\`\`\`java
@RepeatedTest(value = 20, name = "{displayName} {currentRepetition}/{totalRepetitions}", failureThreshold = 3)
@DisplayName("Add-to-cart badge is stable")
void badgeIsStable(WebDriver driver) { /* reproduce a suspected flaky interaction */ }
\`\`\`

\`failureThreshold\` stops the remaining repetitions after N failures — useful for flakiness hunts (\`selenium-deep-troubleshooting-flaky-tests\`). Each repetition is a full test: callbacks, \`@BeforeEach\`, new browser.

\`\`\`java
@TestFactory
Stream<DynamicTest> everyCatalogueProductCanBeAdded(WebDriver driver) {
    List<Product> catalogue = api.products().all();                      // GET /api/products, all pages
    InventoryPage inventory = new InventoryPage(driver).open();
    return catalogue.stream().map(p -> DynamicTest.dynamicTest("add " + p.slug(),
            () -> assertThat(inventory.addToCartButton(p.slug()).isEnabled()).isTrue()));
}
\`\`\`

Dynamic tests are generated at runtime — the test count follows the data. The big caveat (User Guide): **no lifecycle per dynamic test** — \`@BeforeEach\`/\`@AfterEach\` and the extension's \`beforeEach\`/\`afterEach\` run once around the factory method. All dynamic tests above share one browser and one page state; a failure in one leaves the page dirty for the next. Use them for cheap, read-only checks; use \`@ParameterizedTest\` when each case needs isolation. (Retro Red Tee has \`stock: 0\` in the API seed — check what the UI shows for it before writing this expectation.)

## Parallel execution

Jupiter parallelism is opt-in and configured in \`src/test/resources/junit-platform.properties\` (or Surefire \`<configurationParameters>\`):

\`\`\`
junit.jupiter.execution.parallel.enabled = true
# methods inside a class: same_thread (default) or concurrent
junit.jupiter.execution.parallel.mode.default = same_thread
# top-level classes
junit.jupiter.execution.parallel.mode.classes.default = concurrent
# dynamic (cores × factor, default) | fixed | custom
junit.jupiter.execution.parallel.config.strategy = fixed
junit.jupiter.execution.parallel.config.fixed.parallelism = 4
\`\`\`

| Combination (\`mode.default\` / \`classes.default\`) | Effect | TestNG analogue |
|---|---|---|
| same_thread / same_thread | sequential | no \`parallel\` |
| same_thread / concurrent | classes in parallel, methods of a class sequential | \`parallel="classes"\` |
| concurrent / same_thread | methods of one class in parallel, classes one after another | — |
| concurrent / concurrent | everything in parallel | \`parallel="methods"\` |

Fine-grained control:

- \`@Execution(ExecutionMode.SAME_THREAD | CONCURRENT)\` on a class/method overrides the default.
- \`@ResourceLock(value = "shopeasy-user:standard_user", mode = READ_WRITE)\` serialises tests that share a resource (the one cart of \`standard_user\`); \`mode = READ\` allows concurrent readers. Built-in names in \`Resources\`: \`SYSTEM_PROPERTIES\`, \`SYSTEM_OUT\`, \`SYSTEM_ERR\`, \`LOCALE\`, \`TIME_ZONE\`. The lock is held from before \`@BeforeEach\` until after \`@AfterEach\`.
- \`@Isolated\` runs a class with nothing else running concurrently — e.g. a test that calls \`POST /api/reset\` (it resets all carts and orders for everyone).
- The \`fixed\` strategy uses a ForkJoinPool; \`fixed.max-pool-size\` and \`fixed.saturate\` bound how many extra threads it may create when tests block — relevant for Selenium, where threads mostly wait on HTTP. For a hard cap on concurrent browsers, the \`custom\` strategy or a Grid with a fixed number of slots is more reliable than counting on \`parallelism\`.

Compared with TestNG: per-test state lives in the extension store rather than \`ThreadLocal\`, and resource locks give declarative mutual exclusion, which TestNG lacks. TestNG's \`thread-count\` is simpler to reason about and \`testng.xml\` can vary it per \`<test>\` block. Sizing and data-isolation advice from \`selenium-deep-parallel-execution\` applies to both.

## Timeouts

\`\`\`java
@Test
@Timeout(value = 30, unit = TimeUnit.SECONDS)                       // threadMode default INFERRED → same thread
void checkoutCompletes(WebDriver driver) { /* ... */ }
\`\`\`

- \`@Timeout\` on a method/class, or a default with \`junit.jupiter.execution.timeout.default = 2 m\` (and per kind: \`…timeout.testable.method.default\`, etc.). \`threadMode\` = \`SAME_THREAD\` (the test runs on its own thread, which is interrupted when time is up — blocking WebDriver HTTP calls may not react promptly), \`SEPARATE_THREAD\`, or \`INFERRED\` (default; follows \`junit.jupiter.execution.timeout.thread.mode.default\`, same thread unless configured).
- \`assertTimeoutPreemptively(Duration, executable)\` runs the executable **on a different thread** and abandons it when time is up. The User Guide warns that code relying on \`ThreadLocal\` storage behaves unexpectedly there. A framework that keeps the driver in a \`ThreadLocal\` gets \`NullPointerException\` inside the lambda — the same trap as TestNG's \`timeOut\`. And the abandoned thread may keep driving the browser while \`@AfterEach\` quits it.
- \`assertTimeout(Duration, executable)\` (non-preemptive) runs on the same thread and only reports that it took too long.

**Recommendation:** for UI tests, rely on WebDriver timeouts, explicit waits and a CI job timeout; use \`@Timeout\` same-thread as a safety net; avoid \`assertTimeoutPreemptively\` with thread-bound state. With the store-based extension above, the driver is passed as a parameter, so a preemptive lambda captures the reference — but the abandoned-thread problem remains.

## Assertions: JUnit vs Hamcrest vs AssertJ

### JUnit Jupiter assertions

\`\`\`java
assertEquals(3, cart.itemCount(), "items in cart");                        // (expected, actual, message)
assertEquals(new BigDecimal("43.18"), order.total(), () -> "total for " + order.id());  // lazy message
assertIterableEquals(List.of("Trailblazer Backpack", "Pulse Bike Light"), cart.names());
assertLinesMatch(List.of("Thank you for your order!", ">> 1 >>"), confirmationLines); // regex + fast-forward
ApiException e = assertThrows(ApiException.class, () -> api.cart().add(999));
assertEquals("PRODUCT_NOT_FOUND", e.code());

assertAll("order summary",                                                 // grouped: all executables run
    () -> assertEquals("$39.98", overview.subtotal()),
    () -> assertEquals("$3.20", overview.tax()),
    () -> assertEquals("$43.18", overview.total()));
\`\`\`

- **Argument order is \`(expected, actual)\`** — TestNG's \`Assert.assertEquals\` is \`(actual, expected)\`. A mechanical import swap during migration produces messages like "expected: <2> but was: <3>" with the values reversed — a debugging trap. Swap arguments or (better) move to AssertJ, where order is unambiguous.
- \`assertAll\` is JUnit's soft-assertion form: every executable runs, failures are reported together as a \`MultipleFailuresError\`; inside one executable the first failure stops that executable. It is block-based, so you cannot accumulate across loops without building a list of executables.

### Hamcrest

\`assertThat(cart.names(), hasItems("Trailblazer Backpack"))\` via \`org.hamcrest.MatcherAssert\`. Composable matchers, and **REST Assured's \`body(...)\` uses Hamcrest matchers**, so API tests already depend on it. Weak points: static-import discovery, generics friction, less helpful IDE completion, and no soft assertions.

### AssertJ

\`\`\`java
assertThat(cart.items())
    .as("cart of standard_user")
    .hasSize(2)
    .extracting(CartItem::name, CartItem::quantity)
    .containsExactlyInAnyOrder(tuple("Trailblazer Backpack", 1), tuple("Pulse Bike Light", 1));

assertThat(order)                                              // compare an API response with an expected object
    .usingRecursiveComparison()
    .ignoringFields("id", "createdAt")
    .isEqualTo(expectedOrder);

SoftAssertions.assertSoftly(softly -> {                       // soft, auto assertAll at the end of the lambda
    softly.assertThat(overview.subtotal()).isEqualTo("$39.98");
    softly.assertThat(overview.tax()).isEqualTo("$3.20");
    softly.assertThat(overview.total()).isEqualTo("$43.18");
});
\`\`\`

Soft assertions variants: \`new SoftAssertions()\` + \`assertAll()\` (same "forgot assertAll" risk as TestNG), \`assertSoftly(...)\` (cannot forget), \`AutoCloseableSoftAssertions\` in try-with-resources, and \`SoftAssertionsExtension\` with an \`@InjectSoftAssertions SoftAssertions softly\` field — JUnit 5 integration that calls \`assertAll\` after each test.

### Custom AssertJ assertions for domain objects

When the same five checks on a cart appear in 40 tests, give them a name:

\`\`\`java
package com.shopeasy.framework.assertions;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.assertj.core.api.AbstractAssert;
import com.shopeasy.api.model.Cart;
import com.shopeasy.api.model.CartItem;

public class CartAssert extends AbstractAssert<CartAssert, Cart> {

    public CartAssert(Cart actual) {
        super(actual, CartAssert.class);
    }

    public static CartAssert assertThat(Cart actual) {
        return new CartAssert(actual);
    }

    public CartAssert hasItemCount(int expected) {
        isNotNull();
        if (actual.itemCount() != expected) {
            failWithMessage("Expected cart of user <%s> to have <%d> items but had <%d>: %s",
                    actual.userId(), expected, actual.itemCount(), actual.items());
        }
        return this;
    }

    public CartAssert containsProduct(String name) {
        isNotNull();
        boolean found = actual.items().stream().map(CartItem::name).anyMatch(name::equals);
        if (!found) {
            failWithMessage("Expected cart to contain <%s> but it contained %s",
                    name, actual.items().stream().map(CartItem::name).toList());
        }
        return this;
    }

    /** subtotal = Σ lineTotal, as returned by GET /api/cart */
    public CartAssert hasConsistentSubtotal() {
        isNotNull();
        BigDecimal sum = actual.items().stream().map(CartItem::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
        if (sum.compareTo(actual.subtotal()) != 0) {
            failWithMessage("Expected subtotal <%s> to equal the sum of line totals <%s>", actual.subtotal(), sum);
        }
        return this;
    }
}
\`\`\`

\`\`\`java
CartAssert.assertThat(api.cart().get())
    .hasItemCount(2)
    .containsProduct("Trailblazer Backpack")
    .hasConsistentSubtotal();
\`\`\`

Messages are domain language, checks are reusable, and the test reads like the acceptance criterion. To use custom assertions softly, extend \`SoftAssertions\` and expose \`public CartAssert assertThat(Cart actual) { return proxy(CartAssert.class, Cart.class, actual); }\`. (AssertJ also has a generator for assertion classes; for a handful of domain objects, hand-written ones are clearer.)

### Comparison

| | JUnit assertions | Hamcrest | AssertJ | TestNG \`Assert\`/\`SoftAssert\` |
|---|---|---|---|---|
| Style | static methods, \`(expected, actual)\` | \`assertThat(actual, matcher)\` | fluent \`assertThat(actual).…\` | static \`(actual, expected)\` / instance soft |
| Discoverability | fair | poor (which static import?) | excellent (IDE completion by type) | fair |
| Failure messages | good | good | very good; collections and recursive diffs | good |
| Soft assertions | \`assertAll\` blocks | none | \`SoftAssertions\`, \`assertSoftly\`, JUnit 5 extension | \`SoftAssert\` (+ hooks) |
| Collections / objects | basic | matchers | \`extracting\`, \`filteredOn\`, \`usingRecursiveComparison\` | basic |
| Custom domain assertions | wrapper methods | custom \`Matcher\` (TypeSafeMatcher) | \`AbstractAssert\` subclasses | subclass \`Assertion\` |
| Runner-independent | JUnit only | yes | yes | TestNG only |

**Recommended approach and why:** **AssertJ** as the single assertion library for UI and service-level checks, in JUnit 5 and in TestNG — fluent, discoverable, best messages, soft assertions without the "forgot assertAll" trap (\`assertSoftly\` or the extension), and runner-independent, so a runner migration does not touch assertions. Keep Hamcrest only where a library expects matchers (REST Assured \`body()\`). Use \`assertThrows\` from the runner (or AssertJ's \`assertThatThrownBy\`).

## TestNG vs JUnit 5: the detailed comparison

| Dimension | TestNG 7 | JUnit 5 (Jupiter on the Platform) |
|---|---|---|
| Instance model | one instance per class; fields shared by its tests | new instance per test by default (\`PER_CLASS\` optional) |
| Lifecycle levels | suite, test (XML block), groups, class, method | all (class), each (method); suite-level via root store/\`LauncherSessionListener\` |
| Suite definition | \`testng.xml\` (blocks, parameters, per-block parallel) | \`@Suite\` classes (junit-platform-suite), tag expressions, build-tool config |
| Parameterisation | \`@DataProvider\` (eager/lazy, parallel rows), \`@Factory\` | \`@ParameterizedTest\` with many sources, converters, aggregators; \`@ParameterizedClass\` (5.13+); dynamic tests |
| Grouping/filtering | groups with include/exclude, regex, \`dependsOnGroups\` | \`@Tag\` with boolean tag expressions |
| Dependencies/order | \`dependsOnMethods/Groups\` (skip semantics), priority | \`@Order\` only; no dependencies by design |
| Parallelism | \`parallel\` = methods/classes/tests/instances, \`thread-count\`, data-provider pool | \`junit-platform.properties\` modes and strategies, \`@Execution\`, \`@ResourceLock\`, \`@Isolated\` |
| Per-test state in parallel | \`ThreadLocal\` (by convention) | \`ExtensionContext.Store\` (by design) |
| Extensibility | listeners (\`ITestListener\`, \`IHookable\`, transformers, interceptors, reporters) | extensions (callbacks, \`ParameterResolver\`, \`InvocationInterceptor\`, conditions), Platform listeners |
| Dependency injection | native injection of \`ITestContext\`, \`Method\`, \`ITestResult\`…; Guice module support | \`ParameterResolver\` for anything (driver, API client, users) |
| Retry | \`IRetryAnalyzer\` built in | none built in — JUnit Pioneer \`@RetryingTest\` or Surefire rerun options |
| Soft assertions | \`SoftAssert\` | \`assertAll\` (or AssertJ for both) |
| Reporting | built-in HTML/XML reporters, \`IReporter\`; Allure/Extent adapters | Platform events → Surefire XML, Open Test Reporting; Allure adapter; IDE |
| Cucumber direction | \`cucumber-testng\` — deprecated in Cucumber-JVM 8 | \`cucumber-junit-platform-engine\` — the recommended runner |
| Ecosystem | strong in Selenium/QA tutorials and legacy suites | default for Spring Boot, Testcontainers, most Java libraries and developer teams |
| IDE support | IntelliJ built-in; Eclipse plug-in | built into IntelliJ, Eclipse, VS Code, NetBeans |
| Java baseline | 7.6+ requires Java 11 | Jupiter 5.x Java 8; JUnit 6 Java 17 |

### Recommendations

**(a) A new Selenium UI framework.** JUnit 5. The extension model (driver injection, screenshot ordering, store instead of \`ThreadLocal\`), parameterised-test variety, \`@Nested\` contexts, tag expressions and the Platform (Cucumber engine, one report pipeline with developers' tests) outweigh \`testng.xml\`. What you give up — per-block parameters for cross-browser runs and built-in retry — is covered by a CI matrix (\`-Dbrowser=firefox\` per job) and a deliberate retry policy. If the team is TestNG-fluent and needs \`testng.xml\`-driven suites tomorrow, TestNG 7 is still a perfectly sound choice; the decision is a team decision, not a "better tool" one.

**(b) An existing TestNG suite.** Keep TestNG unless there is a concrete driver: a Cucumber upgrade to 8 (move Cucumber to the JUnit Platform engine), a monorepo standardising on JUnit with developers, or extension needs. Do the cheap, high-value steps anyway: AssertJ instead of \`Assert\`/\`SoftAssert\`, independent tests, listeners consolidated. Migrate incrementally (plan below), never as a big bang.

**(c) An API test suite (REST Assured).** JUnit 5: \`ParameterResolver\` for an authenticated client, \`@ParameterizedTest\` + \`@CsvSource\` for validation matrices (\`VALIDATION_FAILED\`, \`INVALID_QUANTITY\`, \`ITEM_ALREADY_IN_CART\`…), \`@ResourceLock\` for shared users, and it lives naturally next to the developers' tests. TestNG is fine if the UI suite is TestNG and one runner matters more.

How a senior communicates (a)/(b): *"Both runners can do what we need. For the new framework I recommend JUnit 5 because driver injection and parallel state are safer by design and Cucumber 8 is moving to the JUnit Platform. For the existing suite I recommend staying on TestNG for now and adopting AssertJ, because migration costs about N days and gives us little until we touch Cucumber."*

## Migration TestNG → JUnit 5

### Mapping table

| TestNG | JUnit 5 | Note |
|---|---|---|
| \`@Test\` | \`@Test\` (\`org.junit.jupiter.api\`) | test methods may be package-private |
| \`@BeforeMethod\` / \`@AfterMethod\` | \`@BeforeEach\` / \`@AfterEach\` | |
| \`@BeforeClass\` / \`@AfterClass\` | \`@BeforeAll\` / \`@AfterAll\` | static, or \`@TestInstance(PER_CLASS)\` |
| \`@BeforeSuite\` / \`@AfterSuite\` | root-store resource in an extension, or \`LauncherSessionListener\` | no annotation |
| \`@BeforeTest\` (XML block) | none — separate \`@Suite\` classes or build profiles | |
| \`@BeforeGroups\` | none — extension keyed on tags | |
| \`groups = "smoke"\` | \`@Tag("smoke")\` | \`-Dgroups="smoke & !slow"\` |
| \`enabled = false\` | \`@Disabled("reason")\` | |
| \`@DataProvider\` | \`@ParameterizedTest\` + \`@MethodSource\`/\`@CsvSource\` | \`Object[][]\` → \`Stream<Arguments>\` |
| \`@Factory\` | \`@ParameterizedClass\` (5.13+), \`@Nested\`, dynamic tests | |
| \`dependsOnMethods\` | none — make tests independent (or \`assumeTrue\` on a precondition) | the real migration work |
| \`priority\` | \`@TestMethodOrder(OrderAnnotation.class)\` + \`@Order\` | |
| \`expectedExceptions\` | \`assertThrows\` | |
| \`timeOut\` | \`@Timeout\` | |
| \`invocationCount\` | \`@RepeatedTest\` | \`threadPoolSize\`: no equivalent |
| \`Assert.assertEquals(actual, expected)\` | \`assertEquals(expected, actual)\` | swap — or AssertJ |
| \`SoftAssert\` | \`assertAll\` / AssertJ \`SoftAssertions\` | |
| \`@Parameters\` + \`@Optional\` | configuration/system properties; \`@EnabledIfSystemProperty\` | |
| \`ITestContext\` attributes | \`ExtensionContext.Store\` | |
| \`ITestListener\` | extensions (\`TestWatcher\`, callbacks) or Platform \`TestExecutionListener\` | |
| \`IHookable\` | \`InvocationInterceptor\` | |
| \`IMethodInterceptor\` | custom \`MethodOrderer\` / \`ClassOrderer\`, tag filters | |
| \`IAnnotationTransformer\` | no equivalent — auto-detected extensions + \`ExecutionCondition\` | |
| \`IRetryAnalyzer\` | JUnit Pioneer \`@RetryingTest\`, or the build tool's rerun option | |
| \`IReporter\` | \`TestExecutionListener\`, Open Test Reporting | |
| \`@Listeners\` | \`@ExtendWith\` / composed annotations | |
| \`testng.xml\` | \`@Suite\` classes, Surefire config, \`junit-platform.properties\` | |

### Step-by-step plan

1. **Measure the baseline.** Test count per status, duration, flaky list from the last 10 runs. You will compare against it after each step.
2. **Put everything on the Platform first, change no tests.** Add \`junit-jupiter\` and \`testng-engine\` (TestNG classes run on the Platform), move the \`testng.xml\` settings the engine supports into \`testng.*\` configuration parameters (\`testng.groups\`, \`testng.parallel\`, \`testng.threadCount\`, \`testng.listeners\`), and confirm the count matches the baseline. If the suite relies on \`testng.xml\` features the engine does not support (multiple \`<test>\` blocks with different parameters, \`@BeforeTest\` semantics), keep two Surefire executions (one TestNG provider with the XML, one Platform) during the transition and say so in the plan.
3. **Neutralise assertions.** Replace TestNG \`Assert\`/\`SoftAssert\` with AssertJ in the TestNG tests — runner-independent, and it removes the \`(actual, expected)\` trap before it can bite.
4. **Build the JUnit infrastructure.** \`WebDriverExtension\`, API-client and test-user resolvers, evidence capture, \`@UiTest\`/\`@ApiTest\` composed annotations, \`junit-platform.properties\` for parallelism. Port listener behaviour to extensions; anything suite-level goes to the root store or a \`LauncherSessionListener\`.
5. **Migrate by package, smallest risk first** (API tests, then read-only UI, then checkout flows). Mechanical changes with IDE refactorings/OpenRewrite-style recipes where available; hand-work for \`dependsOnMethods\` chains (make independent), \`@Factory\` (parameterised or nested classes), \`ITestContext\` sharing (store) and \`@BeforeTest\` (suite classes).
6. **Run both engines in CI** after each package: totals must add up; a dropping count means a lost test (a forgotten \`@Test\` import still pointing at \`org.testng\` runs under the wrong engine — grep for \`org.testng\` imports per migrated package).
7. **Remove TestNG** when no \`org.testng\` imports remain: drop \`testng-engine\`, \`testng\` and \`testng.xml\`, update CI commands (\`-Dgroups\` now takes tag expressions) and the README.
8. **Cucumber**: move to \`cucumber-junit-platform-engine\` with a \`@Suite\` runner at the same time as or before step 7 (\`cucumber-deep-execution-reporting-parallel\`).

## Common mistakes and debugging

- **Screenshot in \`TestWatcher.testFailed\` is always empty or throws "session deleted".** \`TestWatcher\` runs after \`@AfterEach\` and after store resources are closed. Capture in \`AfterTestExecutionCallback\` using \`getExecutionException()\`.
- **"No tests found" / 0 tests after adding JUnit 5.** No engine on the test classpath (only \`junit-jupiter-api\`), an old Surefire, or test methods using \`org.junit.Test\` (JUnit 4) without Vintage. Check \`mvn dependency:tree\` for \`junit-jupiter-engine\`, the Surefire version and the imports.
- **\`ParameterResolutionException: No ParameterResolver registered for parameter [WebDriver arg0]\`.** The class lacks \`@ExtendWith\`/\`@UiTest\`, or the parameter is on a constructor/\`@BeforeAll\` the resolver deliberately does not support. Read the message: it names the parameter and the executable.
- **Migrated assertions report swapped values.** TestNG \`(actual, expected)\` copied into JUnit \`(expected, actual)\`. Move to AssertJ or fix argument order with a structural search.
- **Parallel run: tests interfere through \`standard_user\`'s cart.** Shared account. Unique users per test (\`POST /api/users\`) or \`@ResourceLock("user:standard_user")\`; \`@Isolated\` for tests calling \`/api/reset\`.
- **Dynamic tests share dirty state.** No lifecycle per dynamic test — use \`@ParameterizedTest\` when each case needs a fresh browser.

## Best practices for experienced engineers

- One concern per extension, state in the store, composed annotations for test categories; extensions never throw from clean-up and never swallow test failures.
- AssertJ everywhere, custom \`AbstractAssert\` classes for core domain objects (cart, order, product), \`assertSoftly\` for multi-field checks.
- Parallel config in \`junit-platform.properties\` under version control; \`@ResourceLock\`/\`@Isolated\` documented where used; fixed parallelism matched to Grid slots.
- Use \`@Nested\` + \`@DisplayName\` to make reports read as specifications; tags for selection, never for ordering.
- Keep the Platform in mind: one report pipeline for Jupiter, Cucumber and (during migration) TestNG tests.
- Decide runner questions with the team's constraints written down (existing code, Cucumber version, developer ecosystem), not with tool preference.

## Equivalent in Playwright (TypeScript)

Playwright Test already works like Jupiter's extension model: fixtures are typed, injected by parameter name, scoped per test or per worker, with teardown after \`use()\` — \`WebDriverExtension\` is the Java version of the built-in \`page\` fixture. \`test.describe\` ≈ \`@Nested\`, tags/\`--grep\` ≈ \`@Tag\`, \`expect.soft\` ≈ AssertJ soft assertions, \`expect.extend\` ≈ custom AssertJ assertions (\`pw-deep-fixtures-pom-components\`).

## Interview questions

### Q: Explain the JUnit 5 architecture. Why does the Platform/engine split matter?

**Short answer (30–60 s):** JUnit 5 is the Platform (launcher, discovery, filtering, events), test engines (Jupiter for the JUnit 5 programming model, Vintage for JUnit 4, plus third-party engines like Cucumber and TestNG) and the Jupiter API. IDEs and Surefire are launcher clients. It matters because one run can execute different kinds of tests with one filter, one parallel setup and one report pipeline.

**Detailed answer:** Discovery produces a \`TestDescriptor\` tree per engine from selectors; filters (tags, class names, engines) prune it; execution emits events to \`TestExecutionListener\`s that produce IDE output and XML reports. Engines are found via ServiceLoader, configured via \`junit-platform.properties\`/Surefire \`configurationParameters\` under their own prefixes. In practice: Cucumber 8 runs on its Platform engine, a TestNG suite can run on \`testng-engine\` during migration (no \`testng.xml\` support), and JUnit 6 deprecated Vintage — JUnit 4 suites should migrate.

### Q: Design a JUnit 5 extension that provides a WebDriver and takes a screenshot on failure.

**Short answer (30–60 s):** \`BeforeEachCallback\` creates the driver and stores it in the method context's \`Store\`; a \`ParameterResolver\` injects it; \`AfterTestExecutionCallback\` checks \`getExecutionException()\` and captures the screenshot before \`@AfterEach\`; \`AfterEachCallback\` removes and quits it. Registered via a composed \`@UiTest\` annotation.

**Detailed answer:** Explain why not \`TestWatcher\` (runs after teardown and after store resources are closed), why the store instead of \`ThreadLocal\` (state bound to the test's context is parallel-safe regardless of thread), precise \`supportsParameter\`, defensive capture/quit that never mask the test failure, and \`publishReportEntry\` or Allure attachments for evidence. Variants: \`@RegisterExtension\` for configurable browsers, class-level store for per-class browsers.

### Q: How do you run JUnit 5 tests in parallel, and how do you protect shared resources?

**Short answer (30–60 s):** Enable \`junit.jupiter.execution.parallel.enabled\`, choose \`mode.default\` and \`mode.classes.default\` (e.g. classes concurrent, methods same thread), a strategy (\`dynamic\`/\`fixed\`/\`custom\`), override with \`@Execution\`; protect resources with \`@ResourceLock\` (READ/READ_WRITE) and \`@Isolated\`.

**Detailed answer:** Map to TestNG modes, explain ForkJoinPool behaviour (\`max-pool-size\`, \`saturate\`) and why a hard cap on browsers is better enforced by Grid slots or a custom strategy, keep per-test state in the store, and prefer unique test data over locks — locks serialise and slow the suite; they are for genuinely global resources (\`/api/reset\`, system properties).

### Q: JUnit assertions, Hamcrest or AssertJ — what do you choose and why?

**Short answer (30–60 s):** AssertJ: fluent and discoverable, best failure messages, collection/recursive comparison, soft assertions that can't forget \`assertAll\`, custom domain assertions, and it is runner-independent. Hamcrest only where a library needs matchers, like REST Assured's \`body()\`.

**Detailed answer:** Show \`extracting\` + \`containsExactlyInAnyOrder\` with tuples, \`usingRecursiveComparison().ignoringFields("id","createdAt")\` for API responses, \`assertSoftly\` for a checkout summary, a \`CartAssert\` with domain messages. Mention the \`(expected, actual)\` vs TestNG \`(actual, expected)\` trap as an extra reason to standardise on AssertJ before a runner migration.

### Q: TestNG or JUnit 5 for a new Selenium framework?

**Short answer (30–60 s):** Either works; I lean to JUnit 5 for a new framework — extension model with injection and parallel-safe state, parameterised tests, \`@Nested\`, tag expressions, the Platform for Cucumber 8 and alignment with developers. TestNG's strengths are \`testng.xml\` suites with per-block parameters, dependencies, built-in retry and familiarity in QA teams.

**Detailed answer:** Walk the comparison table, then the decision criteria: existing code and skills, Cucumber version, need for XML-driven suites, CI matrix strategy, developer ecosystem. Conclude with a recommendation and its cost, and note that assertions (AssertJ) and page objects are runner-independent, so the choice is reversible at moderate cost if the framework is layered well.

### Q: How would you migrate a 1,500-test TestNG suite to JUnit 5?

**Short answer (30–60 s):** Incrementally: run TestNG on the Platform via \`testng-engine\` (no \`testng.xml\` support — keep a TestNG provider execution if needed), switch assertions to AssertJ, build JUnit extensions replacing listeners, migrate package by package while CI runs both engines and test totals are compared, then remove TestNG.

**Detailed answer:** Highlight the hard parts: \`dependsOnMethods\` chains (make independent), \`@Factory\` (\`@ParameterizedClass\` on 5.13+), \`ITestContext\` sharing (store), \`@BeforeSuite/@BeforeTest\` (root store, \`LauncherSessionListener\`, suite classes), retry (Pioneer or build-tool reruns), and assertion argument order. Measure before/after per status and duration; agree a freeze on new TestNG tests.

### Q: What does \`@TestInstance(PER_CLASS)\` change, and when would you use it?

**Short answer (30–60 s):** One test-class instance for all its methods instead of one per method: \`@BeforeAll\` can be non-static and fields are shared. Useful for expensive per-class set-up that must be an instance (e.g. an injected API client) and for \`@Nested\` classes needing \`@BeforeAll\`.

**Detailed answer:** The cost is TestNG-style shared state: fields leak between tests, and with concurrent method execution they race. I use it for read-only fixtures, never for mutable per-test state, and I keep per-test state in the store or local variables.

## Scenario-based questions

**1. After migrating 200 tests to JUnit 5, the failure screenshots are blank pages or missing.** The screenshot was moved into \`TestWatcher.testFailed\`, which runs after \`@AfterEach\` quit the browser (and after store resources were closed). I would move capture to \`AfterTestExecutionCallback\` with \`getExecutionException()\`, keep \`TestWatcher\` for reporting, and add a framework test that fails on purpose and asserts a screenshot file exists.

**2. Cucumber is being upgraded to 8 and the UI suite is TestNG.** Cucumber 8 deprecates \`cucumber-testng\` and recommends the JUnit Platform engine. I would move the Cucumber runner to \`cucumber-junit-platform-engine\` with a \`@Suite\` class, run the TestNG classes on the Platform via \`testng-engine\` (or a second Surefire execution if we depend on \`testng.xml\`), so one \`mvn verify\` runs both, and then decide separately — with numbers — whether to migrate the TestNG tests at all.

**3. A parallel JUnit 5 run fails randomly in cart tests; sequentially everything passes.** All cart tests use \`standard_user\`, whose cart is shared server-side. Short term \`@ResourceLock("user:standard_user")\` on those classes; proper fix: a \`TestUserExtension\` that registers a unique user per test via \`POST /api/users\` and resolves it as a parameter — isolation without serialisation. Tests that call \`POST /api/reset\` get \`@Isolated\`.

## Tricky follow-ups

- **Q: Does \`@BeforeEach\` run before each dynamic test of a \`@TestFactory\`?** No — once around the factory method.
- **Q: Is \`assertAll\` the same as TestNG \`SoftAssert\`?** Similar purpose, different shape: \`assertAll\` is block-based and reports immediately at the end of the call; \`SoftAssert\` accumulates across the method until \`assertAll()\`.
- **Q: Can JUnit 5 express \`dependsOnMethods\`?** No. \`@Order\` sorts but never skips; use independent tests or an assumption on a precondition.
- **Q: Does the TestNG engine read \`testng.xml\`?** No — configure it with \`testng.*\` Platform parameters and select classes via the Platform.
- **Q: Why can a test with \`assertTimeoutPreemptively\` see a null driver?** The executable runs on another thread; \`ThreadLocal\` values from the test thread are not visible there.`,
  keyPoints: [
    'JUnit 5 = Platform (launcher: discover, filter, execute, events) + engines (Jupiter, Vintage — deprecated in JUnit 6 — Cucumber, testng-engine) + the Jupiter API; IDEs and Surefire are launcher clients.',
    'Jupiter creates a new test instance per method by default; @BeforeAll is static unless @TestInstance(PER_CLASS); @Nested + @DisplayName turn reports into specifications.',
    'Extensions are stateless and keep state in ExtensionContext.Store — per-test state that is parallel-safe without ThreadLocal; register with @ExtendWith (or a composed annotation), @RegisterExtension or auto-detection.',
    'Take failure screenshots in AfterTestExecutionCallback (before @AfterEach); TestWatcher runs after teardown and after store resources are closed.',
    'Parameter order: indexed arguments, then aggregators, then ParameterResolver parameters; dynamic tests have no per-test lifecycle; @ParameterizedClass exists since 5.13.',
    'Parallelism: junit-platform.properties modes for methods and classes, dynamic/fixed/custom strategies, @Execution, @ResourceLock, @Isolated; assertTimeoutPreemptively runs on another thread.',
    'Standardise on AssertJ (fluent, soft assertions, extracting, recursive comparison, custom AbstractAssert classes); JUnit assertEquals is (expected, actual), TestNG is (actual, expected).',
    'New frameworks: JUnit 5 is the safer default; existing TestNG suites: stay unless there is a driver such as Cucumber 8; migrate incrementally on the Platform with testng-engine (no testng.xml support).',
  ],
  mistakes: [
    'Taking the screenshot in TestWatcher.testFailed — the browser was already quit in @AfterEach. Fix: capture in AfterTestExecutionCallback using context.getExecutionException(), keep TestWatcher for reporting.',
    'Keeping a ThreadLocal driver after moving to JUnit 5 and calling it inside assertTimeoutPreemptively or a separate-thread @Timeout — NullPointerException. Fix: store the driver in the extension store and inject it as a parameter; avoid preemptive timeouts in UI tests.',
    'Copying TestNG assertEquals(actual, expected) into JUnit unchanged — failure messages show expected and actual reversed. Fix: migrate assertions to AssertJ first, or swap arguments with a structural search.',
    '"No tests found" after switching: only junit-jupiter-api on the classpath, an old Surefire, or org.junit.Test imports. Fix: use the junit-jupiter aggregate with the junit-bom, Surefire 3, and check imports and the Surefire provider log line.',
    'Using @TestFactory dynamic tests for UI cases that need isolation — @BeforeEach runs once for the factory, so all cases share one browser. Fix: @ParameterizedTest when each case needs a fresh browser.',
    'Parallel tests sharing standard_user\'s server-side cart. Fix: a TestUserExtension creating unique users via POST /api/users; @ResourceLock for genuinely shared resources and @Isolated for tests that call /api/reset.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`, API on \`http://localhost:5181\`): (1) implement \`WebDriverExtension\` and a \`@UiTest\` composed annotation; write a test that sorts by \`hilo\` (\`#product-sort\`) and expects \`Storm Fleece Jacket\` first, then break the expectation and confirm a screenshot appears under \`target/screenshots\` while the browser still showed the inventory page. (2) Move the screenshot into a \`TestWatcher\` and observe why it fails — then move it back. (3) Write \`@ParameterizedTest\` + \`@CsvSource(textBlock, useHeadersInDisplayName = true)\` for the three checkout validation messages and check the display names. (4) Write a \`CartAssert\` for \`GET /api/cart\` (\`hasItemCount\`, \`containsProduct\`, \`hasConsistentSubtotal\`) and use it after adding two products through \`POST /api/cart/items\`. (5) Enable parallel classes in \`junit-platform.properties\`, run the cart tests with a shared \`standard_user\`, watch them interfere, and fix it with \`@ResourceLock\` and then with unique users.`,
  problems: ['fw-027', 'fw-003'],
}
