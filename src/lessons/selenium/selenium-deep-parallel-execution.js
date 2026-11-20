export default {
  slug: 'selenium-deep-parallel-execution',
  category: 'selenium',
  order: 17,
  title: 'Deep dive: parallel execution with Selenium — TestNG, Surefire, Cucumber and isolation',
  minutes: 30,
  summary: 'Design a Selenium suite that runs safely and measurably faster in parallel — threads in one JVM (TestNG modes, data-provider pools), forked JVMs (Surefire forkCount/reuseForks) and machines (Grid, CI shards), what must be per-thread versus shared, a pluggable browser factory, thread-safe reporting and logging, test-data isolation, Cucumber parallel runs, sizing the thread count and diagnosing failures that only appear in parallel.',
  manualAnalogy: `When four manual testers share one regression cycle, you split the work so nobody tests in someone else's browser, nobody uses the same test account to change the same cart, and every bug report says who found it. If two testers both "reset the test environment" before their case, they destroy each other's work. Parallel automation is the same coordination problem, only with threads instead of people — and threads never complain, they just produce random failures.`,
  body: `## Where the earlier lessons stop

The *Browser options, screenshots, Grid and parallel runs* lesson showed \`parallel="methods"\` and why a static driver breaks. The *Multithreading and synchronization* deep dive (\`java-deep-multithreading-synchronization\`) covered the JVM side: how \`ThreadLocal\` works internally, a \`ThreadLocal\` \`DriverManager\`, the TestNG modes mapped to threads, an \`AccountPool\` on a \`BlockingQueue\`, and a general procedure for debugging races. This lesson does **not** repeat those. It answers the questions a senior SDET owns when a 70-minute Selenium suite must finish in 15:

- At which **level** do we parallelise — threads, JVM forks, machines — and how do the levels multiply?
- What exactly must be per-thread, per-test or shared in a **Selenium** framework (driver, pages, waits, data, reports, logs)?
- How do we create browsers from configuration so the same test runs locally, headless on CI and on Grid?
- How do we keep **test data** from colliding, and which TestNG features silently break under parallel runs?
- How many threads, and how do we prove the speed-up?

Grid topology, Docker and Kubernetes scaling are in \`selenium-deep-grid-infrastructure\`; the evidence-collecting listener and the flaky-test workflow are in \`selenium-deep-troubleshooting-flaky-tests\`. Cucumber and the full TestNG/Maven setup get their own sections later in the handbook — here they appear only as far as parallelism needs them.

## Three levels of parallelism

\`\`\`
Level 3  machines      CI shard 1 ─────────────── CI shard 2 ──────────────  (or one Grid serving both)
                          │                           │
Level 2  JVM forks     Surefire fork 1   fork 2     fork 1   fork 2           forkCount=2
                          │                │
Level 1  threads       TestNG pool: T1 T2 T3 T4     (thread-count=4)
                          │
                       one WebDriver session per running test
\`\`\`

Browsers in flight = **shards × forks × threads** (plus data-provider threads, see below). Every level multiplies; this is how a team ends up with 64 Chrome sessions on a Grid that has 16 slots.

### Level 1 — threads inside one JVM (TestNG)

| Setting | Where | Meaning |
|---|---|---|
| \`parallel="methods"\` | \`<suite>\` or \`<test>\` | every \`@Test\` method is a separate task on the pool; methods of one class run concurrently **on the same instance** |
| \`parallel="classes"\` | same | one class per thread; its methods run sequentially on that thread |
| \`parallel="instances"\` | same | each instance (typically from a \`@Factory\`) on its own thread — e.g. one instance per browser |
| \`parallel="tests"\` | \`<suite>\` | each \`<test>\` block on its own thread — e.g. one \`<test>\` per browser in a cross-browser suite |
| \`thread-count\` | suite/test | pool size (TestNG default 5) |
| \`data-provider-thread-count\` | \`<suite>\` | size of the **separate** pool used by \`@DataProvider(parallel = true)\` (default 10) |
| \`@Test(threadPoolSize = n, invocationCount = m)\` | annotation | run one method m times on its own n-thread pool — a race-provoking tool, not a speed tool |

Internals that matter for Selenium (the full mode-by-mode table is in \`java-deep-multithreading-synchronization\`):

- TestNG builds a graph of methods (respecting \`dependsOnMethods\`, groups and \`preserve-order\`), then hands **free** nodes to a fixed thread pool. \`@BeforeMethod\`/\`@AfterMethod\` run on the **same thread** as their test method — that is the only reason a \`ThreadLocal\` driver created in \`@BeforeMethod\` is visible in the test.
- \`@BeforeClass\` in \`parallel="methods"\` runs on whichever thread happens to execute it; the test methods may run on others. Never create the driver there in methods mode.
- A parallel data provider uses its **own** pool. \`parallel="methods" thread-count="4"\` plus a 12-row \`@DataProvider(parallel = true)\` can briefly mean far more than four browsers. Set \`data-provider-thread-count\` explicitly whenever you use parallel providers.

### Level 2 — multiple JVMs (Maven Surefire forks)

Surefire can start several **forked JVMs** and distribute test classes between them:

| Parameter | Meaning |
|---|---|
| \`forkCount\` | number of JVMs running at the same time; \`2\` = two JVMs, \`1C\` = one per CPU core, \`0.5C\` = half the cores |
| \`reuseForks\` | \`true\` (default): a fork runs many classes; \`false\`: a **new JVM per test class** — maximal isolation, high startup cost |
| \`\${surefire.forkNumber}\` | placeholder (1..forkCount) usable in \`systemPropertyVariables\`/\`argLine\` — give each fork its own download dir, log file, user prefix, port |
| \`parallel\`, \`threadCount\` / TestNG \`properties\` | thread-level parallelism **inside** each fork |

\`\`\`xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <forkCount>2</forkCount>
    <reuseForks>true</reuseForks>
    <argLine>-Xmx512m -XX:-OmitStackTraceInFastThrow</argLine>
    <systemPropertyVariables>
      <fork.id>\${surefire.forkNumber}</fork.id>
      <download.dir>\${project.build.directory}/downloads-\${surefire.forkNumber}</download.dir>
    </systemPropertyVariables>
    <properties>
      <property><name>parallel</name><value>methods</value></property>
      <property><name>threadcount</name><value>4</value></property>
      <property><name>dataproviderthreadcount</name><value>4</value></property>
    </properties>
  </configuration>
</plugin>
\`\`\`

- Two forks × four threads = **eight** browsers.
- Forks give what threads cannot: **separate static state** (a legacy \`static WebDriver\` or a non-thread-safe singleton report works per fork), separate heap (one fork's \`OutOfMemoryError\` does not kill the others), and a crash boundary.
- Costs: JVM start, class loading and Spring/DI context per fork; separate report files that must be **merged** (Surefire XML is per class so CI merges it naturally; ExtentReports writes one HTML per JVM unless you merge; Allure merges result folders automatically).
- Distribution: forks split work by **test class** that Surefire scans (\`<includes>\`). When the run is driven by \`suiteXmlFiles\`, TestNG owns the plan inside the JVM, and forking does not split a single \`testng.xml\` for you. Decide which owns parallelism — TestNG threads from \`testng.xml\`, or Surefire forks over scanned classes — and check \`target/surefire-reports\` to confirm which fork ran what instead of assuming.

### Level 3 — multiple machines

- **Selenium Grid**: browsers move off the runner; the JVM only sends HTTP. Threads become cheap and the limit becomes Grid **slots** (see \`selenium-deep-grid-infrastructure\`).
- **CI shards**: the pipeline starts N identical jobs, each running a slice (by TestNG group, package, a list of classes, or a hash of the class name modulo N). Combine with Grid or run local headless browsers per agent. Reports from shards must be merged as a pipeline step.

### Comparison

| | Threads (TestNG) | Forks (Surefire) | Machines (shards / Grid) |
|---|---|---|---|
| Isolation | shared heap and **static state**; correctness relies on confinement | separate JVM: statics, heap, crash boundary | separate everything (shards) or browser-only (Grid) |
| Memory on runner | one JVM + N browsers | K JVMs (each 200–500 MB heap) + browsers | spread over agents/nodes |
| Speed-up | best per resource; no startup cost | JVM/DI startup per fork; good for CPU-heavy suites | near-linear until shared backends saturate |
| Debugging | interleaved logs; needs thread/test names | per-fork logs, simpler | per-job logs; needs report merging |
| Shared static state | **breaks** unless thread-confined | tolerated (one copy per fork) | tolerated |
| Typical use | default for Selenium suites | legacy frameworks with static state; very large suites | > 1 agent of capacity, nightly regressions |

**Recommended approach and why:** make the framework **thread-safe** and use TestNG threads as the primary lever — it gives the best speed per CPU and RAM and forces the clean design (no static mutable state) that every other level benefits from. Add Grid when the runner's CPU/RAM is the bottleneck, and CI shards when one agent's wall clock is still too long. Use Surefire forks as a **migration crutch** for a framework with static state, or to isolate a known memory-hungry area — not as a substitute for fixing shared state.

## What must be per-thread, per-test, or shared

| Object | Scope | Why |
|---|---|---|
| \`WebDriver\` | per test (held per thread) | a session is single-threaded: the W3C protocol processes one command per session at a time, and two tests in one browser corrupt each other's state |
| page objects | per test, created in the test | they hold the driver and sometimes element caches; static or shared pages leak a dead driver |
| \`Waiter\` / \`WebDriverWait\` | per driver | constructed with a driver; build it next to the driver (see \`selenium-deep-synchronization\`) |
| logged-in user, cart, order ids | per test (local variables or a per-test context) | instance fields of a test class are shared in \`parallel="methods"\` |
| test data that is modified | unique per test | see *test data isolation* below |
| config (\`Config\` record, URLs, timeouts) | shared, immutable | read once, never mutated |
| \`HttpClient\` / RestAssured spec for API setup | shared, thread-safe | \`java.net.http.HttpClient\` is thread-safe and expensive to create |
| reporter (ExtentReports instance, Allure lifecycle) | shared, with per-thread **test node** | many threads append concurrently |
| logger | shared (SLF4J loggers are thread-safe), with per-thread **MDC** | to tell interleaved lines apart |

### The driver: Selenium-facing API only

\`ThreadLocal\` internals and the reasoning behind \`remove()\` are in \`java-deep-multithreading-synchronization\`. What a Selenium framework adds on top is **where the browser comes from** and a strict lifecycle:

\`\`\`java
// in BaseTest
@BeforeMethod(alwaysRun = true)
public void startBrowser(Method method) {
    DriverManager.start(BrowserFactory.fromConfig(config), method.getName());
}

@AfterMethod(alwaysRun = true)
public void stopBrowser() {
    DriverManager.stop();      // quit() guarded, remove() in finally
}
\`\`\`

Pages get the driver explicitly: \`new InventoryPage(DriverManager.driver())\`. No page or helper reaches for a static field.

### Alternative: no ThreadLocal at all

With \`parallel="classes"\` (or \`instances\`) every method of a class runs on one thread, so an **instance field** \`private WebDriver driver\` is already confined: one class instance per thread, one driver per class instance. You can create the driver in \`@BeforeMethod\` into the field and skip \`ThreadLocal\`. The catch: the day someone switches to \`parallel="methods"\` the field is shared again, and static helpers (listeners, reporters) still need a way to find "the current driver" — which brings \`ThreadLocal\` back. Most teams therefore keep the \`ThreadLocal\` manager and use injection into pages.

## The browser factory

The browser must come from **configuration**: \`-Dbrowser=firefox -Dheadless=true -Dgrid.url=http://grid:4444\`, with defaults in a properties file per environment. The options themselves (flags per browser, W3C capabilities) are built by the \`BrowserOptionsFactory\` in \`selenium-deep-architecture\`; the factory here decides **which** browser and **where** (local or remote).

### Approach 1 — switch expression

\`\`\`java
public static WebDriver create(Config c) {
    MutableCapabilities caps = BrowserOptionsFactory.forBrowser(c.browser(), c.headless());
    if (c.gridUrl().isPresent()) {
        return new RemoteWebDriver(c.gridUrl().get(), caps);
    }
    return switch (c.browser()) {
        case "chrome"  -> new ChromeDriver((ChromeOptions) caps);
        case "firefox" -> new FirefoxDriver((FirefoxOptions) caps);
        case "edge"    -> new EdgeDriver((EdgeOptions) caps);
        default -> throw new IllegalArgumentException("Unsupported browser '" + c.browser()
                + "'. Supported: chrome, firefox, edge");
    };
}
\`\`\`

### Approach 2 — Map of suppliers

\`\`\`java
private static final Map<String, Function<Boolean, WebDriver>> LOCAL = Map.of(
        "chrome",  headless -> new ChromeDriver((ChromeOptions) BrowserOptionsFactory.forBrowser("chrome", headless)),
        "firefox", headless -> new FirefoxDriver((FirefoxOptions) BrowserOptionsFactory.forBrowser("firefox", headless)),
        "edge",    headless -> new EdgeDriver((EdgeOptions) BrowserOptionsFactory.forBrowser("edge", headless)));

public static WebDriver createLocal(String browser, boolean headless) {
    Function<Boolean, WebDriver> creator = LOCAL.get(browser.toLowerCase(Locale.ROOT));
    if (creator == null) {
        throw new IllegalArgumentException("Unsupported browser '" + browser + "'. Supported: " + LOCAL.keySet());
    }
    return creator.apply(headless);
}
\`\`\`

The map stores **recipes** (functions), never \`WebDriver\` instances — a map of drivers would share one browser across threads. When there is no parameter, \`Map<String, Supplier<WebDriver>>\` is the same idea.

### Approach 3 — enum with an abstract method

\`\`\`java
public enum Browser {
    CHROME {
        @Override public WebDriver local(boolean headless) {
            return new ChromeDriver((ChromeOptions) options(headless));
        }
    },
    FIREFOX {
        @Override public WebDriver local(boolean headless) {
            return new FirefoxDriver((FirefoxOptions) options(headless));
        }
    },
    EDGE {
        @Override public WebDriver local(boolean headless) {
            return new EdgeDriver((EdgeOptions) options(headless));
        }
    };

    public abstract WebDriver local(boolean headless);

    public MutableCapabilities options(boolean headless) {
        return BrowserOptionsFactory.forBrowser(name().toLowerCase(Locale.ROOT), headless);
    }

    public static Browser from(String value) {
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unsupported browser '" + value + "'. Supported: "
                    + Arrays.toString(values()), e);
        }
    }
}
\`\`\`

### Approach 4 — ServiceLoader (plug-ins)

\`\`\`java
public interface DriverProvider {
    String name();                                // "chrome", "cloud-safari", ...
    WebDriver create(Config config);
}

// META-INF/services/com.shopeasy.framework.driver.DriverProvider lists implementations, one per line
public static WebDriver create(Config config) {
    return ServiceLoader.load(DriverProvider.class).stream()
            .map(ServiceLoader.Provider::get)
            .filter(p -> p.name().equalsIgnoreCase(config.browser()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("No DriverProvider for '" + config.browser() + "'"))
            .create(config);
}
\`\`\`

| | switch | Map of functions | enum + abstract method | ServiceLoader |
|---|---|---|---|---|
| How it works | branch per string | lookup table of recipes | one constant per browser, behaviour on the constant | providers discovered on the classpath |
| Advantages | obvious, compiler-checked exhaustiveness on enums | data-driven, error lists supported keys | type-safe, \`Browser.values()\` for cross-browser data providers, behaviour + metadata together | add browsers without touching the core (separate jar per cloud vendor) |
| Disadvantages | grows with every browser; mixed concerns if local + remote branches pile up | casts; lambdas are harder to debug | all browsers compiled into the core | indirection, classpath surprises, harder for juniors |
| Performance | identical (driver start dominates by orders of magnitude) | identical | identical | discovery cost once |
| Maintainability | good for 2–3 browsers | good | best for a closed set | good for open sets |
| Scalability | low | medium | medium | high |
| When to use | small frameworks | config-driven sets | most company frameworks | shared platform framework used by many teams |

**Recommended approach and why:** an **enum** for the closed set of browsers (type-safe, testable, reusable as TestNG data) plus **one** local-versus-remote decision in the factory: if \`grid.url\` is set, build \`RemoteWebDriver\` from the same options; otherwise call \`browser.local(headless)\`. Reach for \`ServiceLoader\` only when other teams must add providers (a cloud vendor, a mobile driver) without a release of the core. Whatever the shape, the factory must fail with the **list of supported values** — "Unsupported browser 'chorme'" saves a CI round trip.

## Thread-safe reporting and logging

### Logs: MDC with thread and test name

SLF4J's **MDC** (Mapped Diagnostic Context) is a per-thread map the logging backend can print in every line. Set it at the start of each test and clear it at the end:

\`\`\`java
MDC.put("test", getClass().getSimpleName() + "." + method.getName());
MDC.put("browser", config.browser());
// ... test runs ...
MDC.clear();     // in @AfterMethod(alwaysRun = true) — pool threads are reused
\`\`\`

\`\`\`xml
<!-- logback-test.xml -->
<pattern>%d{HH:mm:ss.SSS} [%thread] [%X{test}] [%X{session}] %-5level %logger{20} - %msg%n</pattern>
\`\`\`

With that pattern, filtering a 40 MB parallel log down to one test is a grep for its name. Logback's \`SiftingAppender\` with an MDC discriminator can write one **file per test**, which CI can attach to the failed test. Also log the **WebDriver session id** (\`((RemoteWebDriver) driver).getSessionId()\` — \`ChromeDriver\`, \`FirefoxDriver\` and \`EdgeDriver\` extend \`RemoteWebDriver\`; keep the original reference if the driver is wrapped by a decorator) into the MDC: on Grid it links your log line to the node log and the session video.

### Reports: one shared report, one node per test

- **ExtentReports**: one \`ExtentReports\` instance for the run (created in \`onStart\`, \`flush()\`ed once in \`onFinish\`), and the per-test \`ExtentTest\` node in a \`ThreadLocal\` set in \`onTestStart\`. Steps logged from page objects then go to the right node. Without the \`ThreadLocal\`, a static "current test" field makes thread A's screenshot appear under thread B's test.
- **Allure**: the Allure lifecycle already tracks the current test per thread, so \`Allure.step(...)\` and \`Allure.addAttachment(...)\` from the test thread land on the right test. Steps logged from a thread you started yourself (an executor polling an API) may not attach to the test — collect the result and attach it from the test thread.
- **Listeners** are called concurrently from all test threads: counters need \`AtomicInteger\`/\`LongAdder\`, collections must be concurrent. The evidence-collecting listener itself (screenshot, DOM, console logs on failure) is in \`selenium-deep-troubleshooting-flaky-tests\`; what matters here is that it must read the driver of **the failing thread** — call \`DriverManager.driver()\` inside \`onTestFailure\`, which runs on the test's thread before \`@AfterMethod\` quits it.

## Test data isolation

Browsers are isolated by construction: every new ChromeDriver/GeckoDriver session gets a fresh temporary profile, so cookies, \`localStorage\` and \`sessionStorage\` are not shared between parallel tests. On ShopEasy's practice site the cart lives in the browser's \`sessionStorage\` (\`shopeasy.cart\`) and the UI accepts only \`standard_user\`, so eight browsers logged in as \`standard_user\` do **not** collide.

A real e-commerce application keeps the cart, addresses and orders **on the server, per user** — and so does the ShopEasy API (\`GET /api/cart\` returns the cart of the authenticated user). Two parallel tests with the same user then add to and empty **the same cart**. That is where data isolation strategies come in:

| Strategy | How | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| Unique user per test via API | \`POST /api/users\` with a unique username, then log in | no collisions by construction; cheap with an API | needs a registration API/admin endpoint; users accumulate unless cleaned | anything that mutates user-owned data (cart, address, orders) |
| Account pool | pre-created accounts borrowed exclusively (\`AccountPool\` in \`java-deep-multithreading-synchronization\`) | works without a registration API | pool size caps \`thread-count\`; leaked accounts block tests | locked-down environments (SSO users, licences) |
| Data builders with unique suffixes | \`order-note-\` + run id + thread/test counter | readable, traceable in the DB | still needs a unique **owner** for server-side state | names, notes, coupon codes, products in back-office tests |
| Read-only shared fixtures | seeded catalogue, reference data, never mutated by tests | fastest, no setup | discipline: one mutating test breaks all | product listing, search, sorting, details |
| Cleanup | delete what the test created in \`@AfterMethod(alwaysRun = true)\`, or a nightly purge by prefix | keeps environments small | cleanup can fail; never rely on it for correctness | always, as hygiene — not as isolation |
| Environment reset | \`POST /api/reset\` | perfect starting state | **global**: wipes every other thread's carts and tokens | once in \`@BeforeSuite\`, never per test |

### Unique users through the ShopEasy API

\`POST /api/users\` (no auth) registers a customer: \`username\` 3–40 characters of \`[a-z0-9_.-]\`, \`password\` at least 8 characters, \`firstName\`, \`lastName\`, \`email\` required, \`phone\`/\`address\` optional. It returns \`201\` with the user and a \`Location\` header, \`409 USERNAME_TAKEN\` on a duplicate, \`422 INVALID_EMAIL\`, \`400 VALIDATION_FAILED\`. Registered users log in to the API with their own password via \`POST /api/auth/login\`.

\`\`\`java
package com.shopeasy.framework.data;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

public final class TestUsers {

    public record Credentials(String username, String password) { }

    private static final HttpClient HTTP = HttpClient.newHttpClient();     // thread-safe, shared
    private static final String RUN_ID = UUID.randomUUID().toString().substring(0, 6);
    private static final AtomicInteger SEQ = new AtomicInteger();

    private TestUsers() { }

    /** Creates a brand-new customer for the calling test; safe to call from any thread. */
    public static Credentials createCustomer(String apiBase) {
        String username = "qa_" + RUN_ID + "_" + SEQ.incrementAndGet();      // e.g. qa_3f9c1a_17
        String password = "Pw-" + UUID.randomUUID();
        String json = """
                {"username":"%s","password":"%s","firstName":"Par","lastName":"Allel","email":"%s@shopeasy.test"}
                """.formatted(username, password, username);
        HttpRequest request = HttpRequest.newBuilder(URI.create(apiBase + "/api/users"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        try {
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 201) {
                throw new IllegalStateException("POST /api/users for " + username + " returned "
                        + response.statusCode() + ": " + response.body());
            }
            return new Credentials(username, password);
        } catch (IOException e) {
            throw new IllegalStateException("ShopEasy API not reachable at " + apiBase, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while creating test user", e);
        }
    }
}
\`\`\`

- **\`RUN_ID\` + \`AtomicInteger\`**: unique across threads (atomic increment) and across forks, shards and re-runs (random run id). A timestamp alone collides when two threads ask in the same millisecond; \`username + Thread.currentThread().getId()\` collides across forks and between two tests on the same pool thread.
- The username respects the server's rule (lowercase, digits, \`_\`); a builder that adds upper-case letters would get \`400 VALIDATION_FAILED\` — the error body is included in the exception so the report shows why.
- The prefix \`qa_\` makes a nightly purge by prefix possible. The ShopEasy API has no delete-user endpoint, and \`POST /api/reset\` removes registered users — which is exactly why it belongs in \`@BeforeSuite\` only.

## Ordering and dependency anti-patterns

| Anti-pattern | What happens in parallel | Fix |
|---|---|---|
| \`dependsOnMethods = "login"\` to reuse the login test's browser | dependent methods are scheduled after the dependency, but run on **another thread** with another (or no) driver; a failure skips the chain | every test sets up its own state (login via a helper or by seeding storage/cookies); keep \`dependsOnMethods\` for genuine "do not bother" relations |
| \`priority = 1, 2, 3\` to build a flow (add → cart → checkout) | priority orders **scheduling**, not completion: with 4 threads, 1–4 start together | one test per business flow, or steps inside one test |
| \`static\` fields for "the order id from the previous test" | read before written, or overwritten by another thread | return values through local variables; per-test context |
| instance fields in a test class under \`parallel="methods"\` | methods run concurrently on the **same** instance | local variables, or \`parallel="classes"\` for that class |
| shared files (\`target/downloads/report.csv\`, \`testdata.xlsx\` written by tests) | two threads overwrite or read half-written files | per-test directories (\`downloads/<test>-<uuid>\`), \`Files.createTempDirectory\`; read-only data files |
| global resets (\`POST /api/reset\`, truncating tables, clearing a shared mailbox) | wipes other threads' state mid-test | reset once per suite; isolate by owner |
| \`preserve-order\`/\`group-by-instances\` assumptions | parallel runs ignore expectations of sequence | treat tests as independent units |

The rule behind all of them: **a test must be runnable alone, in any order, on any thread.** Run a random single test from the IDE: if it fails, it has a hidden dependency.

## Cucumber-JVM in parallel (brief)

Cucumber runs **scenarios** in parallel (not steps). Two runners:

\`\`\`java
// TestNG runner: scenarios() is a TestNG data provider; make it parallel
@CucumberOptions(features = "src/test/resources/features", glue = "com.shopeasy.steps",
        plugin = {"pretty", "json:target/cucumber.json"})
public class ParallelRunner extends AbstractTestNGCucumberTests {
    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
\`\`\`

Thread count comes from \`data-provider-thread-count\` in \`testng.xml\` or the Surefire property \`dataproviderthreadcount\` — **not** from \`thread-count\`.

\`\`\`properties
# JUnit Platform runner: src/test/resources/junit-platform.properties
cucumber.execution.parallel.enabled=true
cucumber.execution.parallel.config.strategy=fixed
cucumber.execution.parallel.config.fixed.parallelism=4
cucumber.execution.parallel.config.fixed.max-pool-size=4
\`\`\`

What changes for Selenium: the driver is started in a Cucumber \`@Before\` hook and quit in \`@After\` (both run on the scenario's thread); step definition classes are instantiated **per scenario** by the DI container (PicoContainer, Spring with scenario scope), so a per-scenario \`TestContext\` holding the driver and pages is naturally confined — static fields in step classes are not. The Cucumber section of the handbook covers hooks, DI and reporting in depth.

## Sizing: how many threads?

**Resources per browser** (rough, measure your own app): a headless Chrome running a modern SPA uses roughly 300–700 MB RAM and up to a full core during page loads and heavy JavaScript; headed browsers and video recording add more. The test JVM itself is light. The practical limits:

1. **Runner CPU/RAM** for local browsers: start at \`thread-count\` ≈ number of cores and adjust by measurement; if RAM is the limit, \`(free RAM − JVM heap) / per-browser RAM\`.
2. **Grid slots**: threads × forks × shards ≤ available slots, otherwise new sessions queue and eventually fail with \`SessionNotCreatedException\` after the Grid's request timeout.
3. **Backend limits**: API rate limits (\`429\`), login throttling, a test environment with two app pods, a shared database. Parallel UI tests are a **load test** for the environment — the bottleneck often moves there.
4. **Third-party sandboxes** (payment, email) with per-account concurrency limits.

**Measure the speed-up** instead of guessing:

| threads | wall time | speed-up | failures |
|---|---|---|---|
| 1 | 64 min | 1.0× | 0 |
| 2 | 33 min | 1.9× | 0 |
| 4 | 18 min | 3.6× | 0 |
| 8 | 11 min | 5.8× | 1 |
| 12 | 10 min | 6.4× | 6 |

*(Illustrative shape, not a benchmark.)* Speed-up flattens because of the **serial part** (suite setup, the longest single test, report generation — Amdahl's law: with 10% serial work the ceiling is 10×) and because resources saturate. The first thread count at which failures rise is a red flag, not a capacity number: either a race in the framework or an environment limit — both need fixing before going higher. Also sort tests by duration: one 9-minute test sets the floor of the whole run; split it, or schedule long tests first (TestNG \`priority\` used **only** for scheduling order, with no correctness implication).

## Diagnosing parallel-only failures

The general procedure (thread names, thread dumps, widening the race window) is in \`java-deep-multithreading-synchronization\`, and the flaky-test workflow in \`selenium-deep-troubleshooting-flaky-tests\`. Selenium-specific signals:

| Symptom | Likely cause |
|---|---|
| \`NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?\` | another thread quit "your" driver (static field), or the \`ThreadLocal\` was not removed and a later test got a quit driver |
| typing appears in the wrong browser, screenshots show another test's page | shared driver or a page object cached statically |
| \`NullPointerException\` / "No driver for thread TestNG-PoolService-3" | driver created in \`@BeforeClass\`/\`@BeforeSuite\` on another thread, or used from an executor thread |
| cart badge shows 3 when the test added 1 | server-side state shared by user, or an instance field shared across methods |
| failures only above N threads, with timeouts | resource saturation (CPU, Grid queue, backend) — check durations, not only assertions |
| \`SessionNotCreatedException\` bursts at suite start | more parallel session requests than Grid slots, or the runner cannot start that many browsers at once |

**Reproduce on purpose:**

1. Run the failing class with \`thread-count="1"\`. Passes alone, fails in parallel → shared state, not a product bug.
2. Hammer one test: \`@Test(invocationCount = 20, threadPoolSize = 8)\` — eight concurrent copies of the same test expose every shared field it touches.
3. Put \`[%thread] [%X{test}] [%X{session}]\` in the log pattern, take the failed test's thread, and look for **another test's name** on the same thread or the same session id in two tests.
4. Name Grid sessions with the test (\`se:name\` capability) so the Grid UI and videos map back to tests.

## Complete example: a ShopEasy suite that runs in parallel safely

### testng.xml

\`\`\`xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy-UI" parallel="methods" thread-count="4" data-provider-thread-count="3">
  <listeners>
    <listener class-name="com.shopeasy.framework.listeners.ParallelSafeLogListener"/>
  </listeners>
  <test name="cart">
    <classes>
      <class name="com.shopeasy.tests.CartBadgeParallelTest"/>
    </classes>
  </test>
</suite>
\`\`\`

### Config, DriverFactory and DriverManager

\`\`\`java
package com.shopeasy.framework.driver;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.Optional;

public record Config(String browser, boolean headless, Optional<URL> gridUrl, String baseUrl) {

    public static Config fromSystemProperties() {
        String grid = System.getProperty("grid.url", "").trim();
        return new Config(
                System.getProperty("browser", "chrome"),
                Boolean.parseBoolean(System.getProperty("headless", "true")),
                grid.isEmpty() ? Optional.empty() : Optional.of(toUrl(grid)),
                System.getProperty("base.url", "http://localhost:5180/practice-site/"));
    }

    private static URL toUrl(String value) {
        try {
            return URI.create(value).toURL();
        } catch (MalformedURLException | IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid -Dgrid.url: " + value, e);
        }
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.driver;

import org.openqa.selenium.MutableCapabilities;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

public final class DriverFactory {

    private DriverFactory() { }

    public static WebDriver create(Config config, String testName) {
        Browser browser = Browser.from(config.browser());          // the enum shown above
        if (config.gridUrl().isPresent()) {
            MutableCapabilities caps = browser.options(config.headless());
            caps.setCapability("se:name", testName);              // visible in the Grid UI
            return new RemoteWebDriver(config.gridUrl().get(), caps);
        }
        return browser.local(config.headless());
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.driver;

import java.util.Objects;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

public final class DriverManager {

    private static final Logger LOG = LoggerFactory.getLogger(DriverManager.class);
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverManager() { }

    public static void start(Config config, String testName) {
        if (DRIVER.get() != null) {
            throw new IllegalStateException("Driver already running on " + Thread.currentThread().getName()
                    + " - previous test did not stop it");
        }
        WebDriver driver = DriverFactory.create(config, testName);
        DRIVER.set(driver);
        if (driver instanceof RemoteWebDriver remote) {               // ChromeDriver, FirefoxDriver... extend it
            MDC.put("session", String.valueOf(remote.getSessionId()));
        }
        LOG.info("Started {} (headless={}, grid={})", config.browser(), config.headless(), config.gridUrl().isPresent());
    }

    public static WebDriver driver() {
        return Objects.requireNonNull(DRIVER.get(),
                () -> "No driver on thread " + Thread.currentThread().getName()
                        + " - start() runs in @BeforeMethod; do not use the driver from @BeforeClass or other threads");
    }

    public static void stop() {
        WebDriver driver = DRIVER.get();
        try {
            if (driver != null) driver.quit();
        } catch (WebDriverException e) {
            LOG.warn("quit() failed - session probably already gone", e);
        } finally {
            DRIVER.remove();
            MDC.remove("session");
        }
    }
}
\`\`\`

### BaseTest

\`\`\`java
package com.shopeasy.tests;

import com.shopeasy.framework.driver.Config;
import com.shopeasy.framework.driver.DriverManager;
import java.lang.reflect.Method;
import org.openqa.selenium.WebDriver;
import org.slf4j.MDC;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseTest {

    protected static final Config CONFIG = Config.fromSystemProperties();   // immutable: safe to share

    @BeforeMethod(alwaysRun = true)
    public void startBrowser(Method method) {
        String testName = getClass().getSimpleName() + "." + method.getName();
        MDC.put("test", testName);
        DriverManager.start(CONFIG, testName);
    }

    @AfterMethod(alwaysRun = true)
    public void stopBrowser() {
        try {
            DriverManager.stop();
        } finally {
            MDC.clear();
        }
    }

    protected WebDriver driver() {
        return DriverManager.driver();
    }
}
\`\`\`

### The test class

\`\`\`java
package com.shopeasy.tests;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

public class CartBadgeParallelTest extends BaseTest {

    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By CART_LINK = By.cssSelector("[data-testid='shopping-cart-link']");
    private static final By BADGE = By.cssSelector("#shopping-cart-link [data-testid='shopping-cart-badge']");

    @DataProvider(name = "products", parallel = true)
    public Object[][] products() {
        return new Object[][] {
                {"trailblazer-backpack"}, {"pulse-bike-light"}, {"storm-fleece-jacket"}
        };
    }

    @Test(dataProvider = "products")
    public void addingOneProductShowsBadgeOne(String slug) {
        WebDriver driver = driver();                                   // this thread's browser
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        loginAsStandardUser(driver, wait);

        driver.findElement(By.id("add-to-cart-" + slug)).click();

        wait.until(ExpectedConditions.textToBe(BADGE, "1"));
        Assert.assertEquals(driver.findElement(CART_LINK).getDomAttribute("aria-label"), "Cart");
    }

    @Test
    public void twoProductsShowBadgeTwo() {
        WebDriver driver = driver();
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        loginAsStandardUser(driver, wait);

        driver.findElement(By.id("add-to-cart-classic-crew-t-shirt")).click();
        wait.until(ExpectedConditions.textToBe(BADGE, "1"));
        driver.findElement(By.id("add-to-cart-junior-onesie")).click();

        wait.until(ExpectedConditions.textToBe(BADGE, "2"));
    }

    private void loginAsStandardUser(WebDriver driver, WebDriverWait wait) {
        driver.get(CONFIG.baseUrl() + "login.html");
        driver.findElement(USERNAME).sendKeys("standard_user");
        driver.findElement(PASSWORD).sendKeys("secret_sauce");
        driver.findElement(LOGIN).click();
        wait.until(ExpectedConditions.urlContains("inventory.html"));
    }
}
\`\`\`

### Step by step

- **\`parallel="methods" thread-count="4" data-provider-thread-count="3"\`** — a pool of four for method tasks plus a separate pool of three for the data rows. In this small class that means the three data rows plus the other method at once; in a large suite the two pools **add up** (up to 4 + 3 browsers), so size both numbers deliberately instead of relying on the defaults.
- **\`Config\` record** — immutable, created once, shared by all threads without locks. \`-Dbrowser\`, \`-Dheadless\`, \`-Dgrid.url\`, \`-Dbase.url\` switch the run without code changes.
- **\`DriverFactory.create\`** — one local-versus-remote decision; on Grid the session carries the test name. Tests never call \`new ChromeDriver()\`.
- **\`DriverManager.start\`** — refuses a second start on the same thread (a missing teardown becomes a clear error), and stores the session id in the MDC so every log line of that test carries it.
- **\`BaseTest\`** — \`@BeforeMethod\`/\`@AfterMethod(alwaysRun = true)\` run on the test's own thread; \`Method\` injection gives the test name for MDC and Grid. \`MDC.clear()\` in \`finally\` stops the next test on this pool thread from inheriting the name.
- **The test class** — no instance fields except constants: \`driver\` and \`wait\` are **local variables**, so concurrent methods on the same instance cannot see each other's state. The \`WebDriverWait\` is built from the thread's driver.
- **Why \`standard_user\` is safe here**: each session has its own fresh profile, and ShopEasy keeps the cart in \`sessionStorage\` — the badge is per browser. If the cart were server-side (as in the ShopEasy API), each test would register its own user with \`TestUsers.createCustomer\` and log in with it.
- **Badge locator** — scoped to \`#shopping-cart-link\` (the icon link, \`aria-label="Cart"\`), not the plain "Cart" text link in the navigation; \`textToBe\` waits for the badge that \`updateBadge()\` creates after the click.

### Playwright (TypeScript) equivalent

Playwright Test parallelises with **worker processes** (\`workers\` in \`playwright.config.ts\`, \`fullyParallel: true\` for per-test parallelism within a file) — level 2 in this lesson's terms, by default. Each test gets a fresh \`BrowserContext\` from the \`page\` fixture, so the "ThreadLocal driver" problem does not exist; sharding is built in (\`npx playwright test --shard=1/4\`). Data isolation is identical: per-test users through the API in a fixture.

\`\`\`ts
// playwright.config.ts
export default defineConfig({ fullyParallel: true, workers: process.env.CI ? 4 : undefined });
\`\`\`

## Common mistakes and debugging

- **A \`static\` page object or \`static WebDriverWait\`** in a base class → screenshots from the wrong browser, \`NoSuchSessionException\`. Search the codebase for \`static .*(WebDriver|Page|Wait)\` in review.
- **Parallel data provider without \`data-provider-thread-count\`** → more browsers than planned, Grid queueing, timeouts only in that class. Set it explicitly.
- **\`@BeforeClass\` that logs in** with \`parallel="methods"\` → "No driver on thread …". Move per-test setup to \`@BeforeMethod\`, or switch the class to \`parallel="classes"\`.
- **Forks + a single HTML report** → the last fork overwrites the report. Write per-fork output (\`\${surefire.forkNumber}\`) or use a format that merges (Surefire XML, Allure results).
- **Thread count tuned on a developer laptop** (16 cores) copied to a 4-vCPU CI agent → timeouts everywhere. Make thread count a property (\`-Dthreads\`, Surefire \`threadcount\`) and size per environment.

## Best practices for experienced engineers

- Design for **thread confinement** first; reach for forks only as a migration step.
- Every test owns its browser and its mutable data; shared things are immutable or explicitly thread-safe.
- Make all parallelism knobs **configuration** (threads, data-provider threads, forks, Grid URL), and print them at suite start.
- Log thread, test name and session id on every line; name Grid sessions after tests.
- Treat the first thread count that raises the failure rate as a bug to investigate, not as the capacity.
- Track suite duration and per-test duration over time; split long tests and run them first.
- Never retry your way out of parallel failures — an \`IRetryAnalyzer\` hides races (see \`java-deep-exception-design\`).

## Interview questions

### Q: What are the levels of parallelism for a Java Selenium suite, and which do you use first?
**Short answer (30–60 s):** Threads in one JVM (TestNG \`parallel\` + \`thread-count\`), multiple JVMs (Surefire \`forkCount\`), and multiple machines (Grid, CI shards). They multiply. I start with threads, because they are the most efficient and force a thread-safe design, add Grid when the runner is saturated and shards when one job is still too long.

**Detailed answer:** Threads share the heap and static state, so they need confinement (ThreadLocal driver, per-test pages and data). Forks isolate statics and heap at the cost of JVM startup and separate reports; useful for legacy frameworks with static drivers. Machines remove the runner bottleneck; the limit becomes Grid slots and the backend. The total browsers in flight are shards × forks × (threads + data-provider threads), and I size that against Grid slots and environment limits.

### Q: What is the difference between \`parallel="methods"\` and \`parallel="classes"\` for a Selenium framework?
**Short answer (30–60 s):** With \`methods\` every test method can run concurrently, including methods of the same class on the same instance, so instance fields are shared. With \`classes\` each class runs on one thread, methods sequentially, so instance fields are confined but you get less parallelism if classes are uneven.

**Detailed answer:** \`methods\` gives the best load balancing but requires that test classes have no mutable instance state and that \`@BeforeClass\` does not create per-test resources (it runs on a different thread than the methods). \`classes\` is safer for legacy code with instance fields and allows an instance-field driver, but one 30-test class becomes the critical path. \`tests\` is natural for cross-browser suites (one \`<test>\` per browser), \`instances\` for \`@Factory\`-created instances.

### Q: How does \`@DataProvider(parallel = true)\` interact with \`thread-count\`?
**Short answer (30–60 s):** It runs rows on a separate pool sized by \`data-provider-thread-count\` (default 10), not \`thread-count\`. So the number of browsers can exceed the thread count you configured.

**Detailed answer:** In practice I set both explicitly, and in Surefire pass \`threadcount\` and \`dataproviderthreadcount\` properties. Cucumber's TestNG runner relies on this: overriding \`scenarios()\` with \`@DataProvider(parallel = true)\` runs scenarios on the data-provider pool, so \`data-provider-thread-count\` controls Cucumber parallelism.

### Q: How do Surefire forks combine with TestNG threads?
**Short answer (30–60 s):** Each fork is a JVM that runs its share of test classes, with its own TestNG thread pool inside — two forks with four threads each give eight concurrent browsers.

**Detailed answer:** \`forkCount\` sets concurrent JVMs (\`1C\` = per core), \`reuseForks=false\` creates a JVM per class. Forks isolate static state and memory and give a crash boundary, but cost startup and produce per-JVM reports. \`\${surefire.forkNumber}\` lets each fork get its own download folder, logs and data prefix. Forks distribute scanned test classes; a \`testng.xml\` passed with \`suiteXmlFiles\` is planned by TestNG inside the JVM, so I decide which tool owns parallelism and check the reports to verify the distribution.

### Q: How do you design the browser factory?
**Short answer (30–60 s):** Browser, headless and Grid URL come from configuration; the factory maps the browser name to a creation recipe (I prefer an enum), builds options once, and makes a single local-versus-remote decision. Tests never instantiate drivers.

**Detailed answer:** Options construction is a separate builder (flags differ per browser). The enum gives type safety and \`Browser.values()\` for cross-browser data; a \`Map<String, Supplier<WebDriver>>\` is fine for config-driven sets — but it must store recipes, never driver instances; \`ServiceLoader\` suits a platform framework with pluggable vendors. Unsupported values fail with the list of supported ones. On Grid the factory adds \`se:name\` with the test name.

### Q: How do you isolate test data in parallel UI tests?
**Short answer (30–60 s):** Read-only shared fixtures for reference data; anything a test mutates is owned by that test — typically a unique user created through the API, with unique-suffix builders for other data and cleanup as hygiene.

**Detailed answer:** Browser state is already isolated per session (fresh profile), but server-side state is per user. For ShopEasy's API I would \`POST /api/users\` with a run-id plus atomic-counter username, so it is unique across threads, forks and shards. If registration is impossible (SSO), an exclusive account pool sized to the thread count. Global resets such as \`POST /api/reset\` run once per suite; per test they destroy other threads' data.

### Q: How do you choose the thread count?
**Short answer (30–60 s):** From measurements: run with 1, 2, 4, 8… threads, record wall time and failure rate, and stop where the speed-up flattens or failures rise — within CPU/RAM per browser, Grid slots and backend limits.

**Detailed answer:** Local browsers: start near the number of cores and check RAM per browser. Grid: total concurrent sessions ≤ slots. Backend: rate limits and environment capacity often cap first. Amdahl's law bounds the gain by the serial part and the longest test. Rising failures at higher counts mean a race or saturation and must be investigated, not tolerated.

### Q: Why is \`dependsOnMethods\` a problem in parallel suites?
**Short answer (30–60 s):** It couples tests through shared state: the dependent test usually expects the browser or data the first test left behind, but in parallel it runs on another thread with its own browser, and a failure skips the whole chain.

**Detailed answer:** TestNG honours the ordering, but nothing guarantees the same thread or driver. The fix is independent tests with their own setup (API login, storage seeding). \`priority\` has the same misconception: it orders scheduling, not completion.

## Scenario-based questions

**1. The nightly suite went from 70 to 20 minutes after enabling \`parallel="methods" thread-count="6"\`, but 3–5 random tests now fail with "Session ID is null".** I would not raise retries. First I grep for \`static\` fields of type \`WebDriver\`, page objects or waits, and check teardown for \`remove()\`. I would add \`[%thread] [%X{test}] [%X{session}]\` to the log pattern, take a failing test's session id, and check whether another test used the same session. To confirm, run the suspect class with \`invocationCount = 20, threadPoolSize = 8\`. The fix is confinement (ThreadLocal driver, per-test pages), then verify with a few full runs at the target thread count.

**2. Checkout tests fail in parallel with wrong totals; alone they pass.** All tests log in as the same account and the cart is server-side. I would introduce per-test users through the registration API (or an account pool if registration is impossible), check for any per-test environment reset, and explain to the team that parallel safety for data is designed per owner of state, not per test class.

**3. Management asks to go from 8 to 32 threads on the same Grid "to finish in 5 minutes".** I would show measurements: speed-up curve at 4, 8, 16, the longest single test (the floor), Grid slot count and backend saturation. Then propose what actually moves the needle: splitting the two longest tests, API-based setup instead of UI login, sharding across two agents, and adding Grid capacity — with the expected new duration.

## Tricky follow-ups

- **Q: Is \`WebDriver\` thread-safe?** No. One session handles one command at a time, and the client objects are not designed for concurrent use. One driver per thread, never shared.
- **Q: Can two threads share one browser with two windows?** Technically one session can have many windows, but the session has a single "current window", so commands from two threads would switch each other's context. No.
- **Q: Does \`thread-count\` in \`testng.xml\` limit data-provider threads?** No, \`data-provider-thread-count\` does.
- **Q: Why might \`parallel="methods"\` be slower than \`classes\`?** If setup is expensive per test (UI login, big data seeding) and you previously shared it per class, methods mode multiplies setup — move setup to fast paths (API, storage seeding) rather than sharing browsers.
- **Q: Does \`reuseForks=false\` fix ThreadLocal leaks?** It hides them between classes (new JVM each time) but not between methods inside one class. Fix the teardown.`,
  keyPoints: [
    'Parallelism has three multiplying levels: TestNG threads, Surefire forks (forkCount/reuseForks) and machines (Grid, CI shards); browsers in flight = shards × forks × (threads + data-provider threads).',
    'Prefer a thread-safe framework with TestNG threads; use forks to isolate legacy static state, Grid and shards when the runner or one job is the bottleneck.',
    'Per test: WebDriver (held in a ThreadLocal, created in @BeforeMethod, quit + remove in @AfterMethod(alwaysRun = true)), page objects, waits, mutable data. Shared: immutable config, thread-safe HTTP clients, reporters with per-thread test nodes.',
    'A browser factory driven by -Dbrowser/-Dheadless/-Dgrid.url — enum with an abstract method for a closed set, Map of suppliers for config-driven sets (recipes, never instances), ServiceLoader for plug-ins — with one local-versus-remote decision.',
    'Browser state is isolated per session; server-side state is per user, so mutating tests need unique users (POST /api/users with run id + atomic counter), account pools or unique-suffix data — and global resets only once per suite.',
    'dependsOnMethods, priority-as-flow, static fields, test-class instance fields under parallel="methods" and shared files break under parallel runs.',
    'Size threads by measurement (speed-up curve, failure rate) within CPU/RAM per browser, Grid slots and backend limits; log thread, test name (MDC) and session id to diagnose parallel-only failures.',
  ],
  mistakes: [
    'Using @DataProvider(parallel = true) without setting data-provider-thread-count — the separate pool (default 10) overloads the Grid. Fix: set it explicitly in testng.xml or the Surefire dataproviderthreadcount property and count browsers in flight.',
    'Creating the driver or logging in inside @BeforeClass with parallel="methods" — methods on other threads get "No driver on thread …". Fix: per-test setup in @BeforeMethod, or parallel="classes" for that class.',
    'All parallel tests using one account against a server-side cart, then "fixing" wrong totals with retries. Fix: unique users per test through the API (or an exclusive account pool); diagnose by running the class single-threaded.',
    'Calling an environment reset (POST /api/reset, table truncation) in @BeforeMethod — every test wipes the others. Fix: reset once in @BeforeSuite and isolate data by owner.',
    'Raising thread-count until the suite is fast and ignoring the rising failure rate. Fix: measure speed-up and failures at several counts; treat rising failures as a race or saturation to investigate.',
    'Forking Surefire JVMs while writing one ExtentReports HTML file — forks overwrite each other. Fix: per-fork output with \${surefire.forkNumber} and a merge step, or a format that merges (Allure results, Surefire XML).',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`, API on \`http://localhost:5181\`): (1) build the \`Config\`/\`Browser\` enum/\`DriverFactory\`/\`DriverManager\` from this lesson and a \`BaseTest\` that puts the test name and session id into the MDC; (2) write a test class with four independent tests (each logs in, adds a different product via \`#add-to-cart-<slug>\`, waits for \`#shopping-cart-link [data-testid='shopping-cart-badge']\` to read \`1\`, and one sorts with \`#product-sort\` = \`hilo\` first); (3) run with \`thread-count\` 1, 2 and 4 and record wall time; (4) deliberately break it — make the driver a \`static\` field — run with \`@Test(invocationCount = 12, threadPoolSize = 4)\` and read the log to find two tests on one session; (5) restore it and add a test that calls \`TestUsers.createCustomer\` and logs in to the API with \`POST /api/auth/login\`, proving that 8 parallel invocations get 8 distinct usernames.`,
  problems: ['sel-019', 'sel-025', 'sel-042'],
}
