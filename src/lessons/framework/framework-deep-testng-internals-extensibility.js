export default {
  slug: 'framework-deep-testng-internals-extensibility',
  category: 'framework',
  order: 11,
  title: 'Deep dive: TestNG internals — execution model, ordering, factories, data providers and the listener API',
  minutes: 32,
  summary: 'Understand how TestNG turns testng.xml into method invocations, predict ordering and skip cascades, use @Factory and @DataProvider in depth, choose between @Parameters, system properties and config, and extend TestNG with interceptors, annotation transformers, alter-suite listeners, reporters, IHookable and a screenshot-capturing SoftAssert — plus timeouts, version breaks and debugging skipped tests.',
  manualAnalogy: `Before a regression cycle a test lead builds a plan: which test sets run, in what order, which cases are blocked when a prerequisite fails, who runs what in parallel, and what goes into the end-of-cycle report. TestNG does exactly that for code — it builds a plan from testng.xml and annotations, then executes it. Knowing how the plan is built is what lets you change it centrally ("smoke cases first", "retry infrastructure failures", "8 testers today instead of 4") instead of editing every test case.`,
  body: `## Where the earlier lessons stop

The beginner lessons covered the annotations and their order (\`framework-testng-annotations\`), \`testng.xml\`, groups and parallel attributes (\`framework-testng-xml-groups-parallel\`), \`@DataProvider\` with JSON and Excel (\`framework-data-driven-testing\`), hard vs soft assertions (\`framework-hard-and-soft-assertions\`) and a screenshot listener, a retry band-aid and reporting (\`framework-listeners-reports-logging\`). Several deep dives already go further on neighbouring topics, and this lesson does not repeat them:

| Topic | Where it lives |
|---|---|
| Parallel modes, \`data-provider-thread-count\`, Surefire forks, ThreadLocal driver | \`selenium-deep-parallel-execution\` |
| Evidence-collecting failure listener, flaky-test policy | \`selenium-deep-troubleshooting-flaky-tests\` |
| Retry policy (what to retry, backoff), failure listener walking the cause chain | \`java-deep-exception-design\` |
| \`WebDriverListener\`, action layer, driver lifecycle | \`selenium-deep-framework-design\` |
| Cucumber runners on the JUnit Platform / TestNG | \`cucumber-deep-execution-reporting-parallel\` |
| Maven/Surefire internals | \`framework-deep-maven-build-internals\` |

This lesson is about **TestNG itself**: how it turns a suite into method invocations, the exact ordering and skip rules, factories and data providers in depth, and the listener/extension API you use to bend it — the material behind "how would you make TestNG do X without touching 400 test classes?".

## How TestNG builds and runs a suite

### The pipeline

\`\`\`
input            testng.xml · Surefire <suiteXmlFiles> or -Dtest/-Dgroups · -testclass · programmatic XmlSuite
   │
model            XmlSuite ─┬─ XmlTest ("<test>") ─┬─ XmlClass / XmlPackage ─ XmlInclude (methods)
                           │                      └─ parameters, groups (include/exclude), parallel, thread-count
   │   IAlterSuiteListener.alter(List<XmlSuite>)            ◄── last chance to change the XML model
   │
discovery        annotation finder reads @Test/@Before…/@DataProvider/@Factory
   │   IAnnotationTransformer.transform(...)               ◄── rewrite annotations before they are used
   │   @Factory methods/constructors create test instances
   │
selection        group include/exclude + method selectors → ITestNGMethod list (test + configuration methods)
   │
graph            dependsOnMethods / dependsOnGroups → dependency graph; "free" methods have no dependencies
   │   IMethodInterceptor.intercept(free methods, ITestContext)   ◄── reorder / filter free methods
   │
execution        per <test>: TestRunner → workers (sequential or thread pool by parallel mode)
   │   per invocation: data provider rows → configuration methods → IHookable → test method
   │                   IInvokedMethodListener before/after, IRetryAnalyzer on failure
   │
results          ITestResult (SUCCESS / FAILURE / SKIP / SUCCESS_PERCENTAGE_FAILURE) into ITestContext
   │   ITestListener / IConfigurationListener / ISuiteListener callbacks along the way
   │
reports          IReporter.generateReport(xmlSuites, suites, outputDir) after all suites
\`\`\`

| Model object | Represents | Typical use in a framework |
|---|---|---|
| \`XmlSuite\` | one \`<suite>\` | change parallel mode / thread count, add listeners programmatically |
| \`XmlTest\` | one \`<test>\` block | per-block parameters (browser), included groups |
| \`XmlClass\` / \`XmlInclude\` | a class, optionally with selected methods | build a "rerun only these methods" suite |
| \`ISuite\` | the running suite | suite-wide attributes, \`getResults()\` for reporters |
| \`ITestContext\` | the running \`<test>\` | passed/failed/skipped results, attributes, included groups |
| \`ITestNGMethod\` | one test or configuration method (with its instance) | groups, priority, description, real class, retry analyzer |
| \`ITestResult\` | one invocation of a method | status, throwable, parameters, timing, attributes |

Two consequences seniors use daily:

- **Everything is decided before the first test runs.** Groups, dependencies, invocation counts and the interceptor order are computed up front. A test cannot decide at runtime to "add" another test; a listener that wants to change what runs must act in \`alter\`, \`transform\` or \`intercept\`.
- **Each \`<test>\` is its own unit.** Ordering, \`@BeforeTest\`, \`ITestContext\` and the interceptor are per \`<test>\` block. Two \`<test>\` blocks with the same class create two independent runs of it.

### Running a suite programmatically

The XML is only one way to build the model. A launcher that builds the suite in code is useful for "rerun the failed methods from the last build" tools or for testing your own listeners:

\`\`\`java
package com.shopeasy.framework.launcher;

import java.util.List;
import org.testng.TestNG;
import org.testng.xml.XmlClass;
import org.testng.xml.XmlSuite;
import org.testng.xml.XmlTest;

public final class SmokeLauncher {

    public static void main(String[] args) {
        XmlSuite suite = new XmlSuite();
        suite.setName("ShopEasy smoke");
        suite.setParallel(XmlSuite.ParallelMode.METHODS);
        suite.setThreadCount(4);
        suite.addListener("com.shopeasy.framework.testng.CompactSummaryReporter");

        XmlTest chrome = new XmlTest(suite);              // registers itself in the suite
        chrome.setName("Chrome smoke");
        chrome.addParameter("browser", "chrome");
        chrome.addIncludedGroup("smoke");
        chrome.setXmlClasses(List.of(
                new XmlClass("com.shopeasy.tests.LoginTest"),
                new XmlClass("com.shopeasy.tests.CheckoutTest")));

        TestNG testng = new TestNG();
        testng.setXmlSuites(List.of(suite));
        testng.run();
        System.exit(testng.getStatus());                  // non-zero when something failed or was skipped by failure
    }
}
\`\`\`

The XML file, Surefire and the IDE all end up producing exactly this object graph; that is why \`IAlterSuiteListener\` (below) can change any of it.

## Ordering in depth

### The rules, in the order TestNG applies them

1. **Selection first.** Only methods that survive group include/exclude (exclude wins over include), \`enabled = false\` and XML \`<methods>\` filters are considered. Groups declared on the **class** (\`@Test(groups = "cart")\` on the type) are added to every public method of the class.
2. **Dependencies build a graph.** \`dependsOnMethods\` and \`dependsOnGroups\` make edges. Methods with no dependencies are "free"; the rest run after everything they depend on has finished.
3. **Priority orders free methods.** Lower runs first, default \`0\`, negatives allowed. Priority never skips anything, and it does **not** override a dependency.
4. **Ties are broken by name.** Within the same priority TestNG sorts by method name (not source order — the JVM's reflection order is unspecified, so TestNG makes it deterministic).
5. **\`preserve-order\` (default \`true\`) keeps classes in the order of \`testng.xml\`.** It controls class order inside a \`<test>\`; with \`preserve-order="false"\` classes and methods may interleave.
6. **The \`IMethodInterceptor\` gets the final say over free methods** — it receives only methods that "can be run in any order"; methods with dependencies or dependents are not passed to it.
7. **Parallel modes trump all of it.** With \`parallel="methods"\` "order" means "start order" at best. Dependencies are still honoured; priority only influences the start order.

How priority interacts with dependencies and multiple classes in one \`<test>\` has changed between 7.x releases (it is one of the most-reported areas in the TestNG issue tracker). The senior position: **use priority only inside one class, never rely on cross-class order, and treat dependencies as a skip rule, not a sequencing tool.**

### Hard and soft dependencies

| Attribute | Behaviour when the dependency fails or is skipped |
|---|---|
| \`dependsOnMethods = "login"\` | **hard**: dependent is marked SKIP (reason: depends on a failed method) |
| \`dependsOnGroups = "auth"\` | hard, on every method in the group — one failure in the group skips all dependents |
| \`alwaysRun = true\` on a \`@Test\` with dependencies | **soft**: still ordered after the dependency, but runs even if it failed |
| \`ignoreMissingDependencies = true\` | do not fail when the dependency is not part of this run (e.g. excluded by groups) |

Without \`ignoreMissingDependencies\`, running \`-Dgroups=checkout\` when a checkout method \`dependsOnMethods\` a method in another, excluded group fails with a "depends on nonexistent method" style error — a classic reason a group-filtered CI job breaks while the full run is green.

### Worked example: predict the run

A deliberately bad class (it is an exercise, not a pattern). \`login\` uses \`locked_out_user\`, so it fails with ShopEasy's "Error: Sorry, this user has been locked out."

\`\`\`java
package com.shopeasy.tests.ordering;

import org.testng.Assert;
import org.testng.annotations.Test;

public class CheckoutFlowOrderTest {

    @Test(priority = -1)
    public void sortByPriceHighToLow() { System.out.println("sortByPriceHighToLow"); }

    @Test
    public void viewProducts() { System.out.println("viewProducts"); }

    @Test
    public void login() {
        System.out.println("login");
        Assert.fail("Error: Sorry, this user has been locked out.");   // locked_out_user
    }

    @Test(dependsOnMethods = "login")
    public void addBackpack() { System.out.println("addBackpack"); }

    @Test(dependsOnMethods = "addBackpack")
    public void checkout() { System.out.println("checkout"); }

    @Test(dependsOnMethods = "checkout", alwaysRun = true)
    public void resetCart() { System.out.println("resetCart"); }
}
\`\`\`

Output on a current TestNG 7 (sequential, default \`preserve-order\`):

\`\`\`
sortByPriceHighToLow      PASS   free, priority -1 → first
login                     FAIL   free, priority 0, "login" < "viewProducts"
viewProducts              PASS   free, priority 0
addBackpack               SKIP   hard dependency on login
checkout                  SKIP   hard dependency on addBackpack (skips cascade)
resetCart                 PASS   soft dependency (alwaysRun) — ordered after checkout, runs anyway
Tests run: 6, Failures: 1, Skips: 2
\`\`\`

Step by step:

1. Free methods (\`sortByPriceHighToLow\`, \`viewProducts\`, \`login\`) are sorted by priority, then by name.
2. Dependent methods run in graph order after the free ones they need. \`addBackpack\`'s dependency failed → SKIP; \`checkout\` depends on a *skipped* method → SKIP too.
3. \`resetCart\` is soft: it still waits for \`checkout\` to be "done" (skipped counts as done) and then runs.
4. The report shows **1 failure, 2 skips**. In a 400-test suite, "2 skips" hides two untested features; the triage rule is: *every skip has exactly one root cause — find it, it is usually a failure or a configuration failure upstream.*

The fix for real suites is in \`framework-test-data-and-independence\`: each test creates its own precondition (API login, cart seeded through \`sessionStorage\` key \`shopeasy.cart\`), so there are no dependencies to cascade.

## Configuration methods in depth

### Levels, scope and inheritance

| Annotation | Scope | Runs on which thread / instance |
|---|---|---|
| \`@BeforeSuite\` / \`@AfterSuite\` | once per \`<suite>\` | the first instance that declares/inherits it |
| \`@BeforeTest\` / \`@AfterTest\` | once per \`<test>\` block | as above, per \`<test>\` |
| \`@BeforeGroups\` / \`@AfterGroups\` | before the first / after the last method of the listed groups (per \`<test>\`) | the instance whose class declares it |
| \`@BeforeClass\` / \`@AfterClass\` | once per **test instance** of a class | that instance — so once per \`@Factory\` instance |
| \`@BeforeMethod\` / \`@AfterMethod\` | around every invocation (each data-provider row, each \`invocationCount\`) | the thread that runs the test (unless \`timeOut\` — see below) |

Inheritance rules the annotations lesson started:

- Parent \`@Before*\` run before the child's, \`@After*\` the other way round.
- **Overriding is Java overriding.** If \`CartTest\` declares \`public void setUp()\` with \`@BeforeMethod\` and \`BaseTest\` has a \`@BeforeMethod public void setUp()\`, only the child's method runs — the parent's browser start silently disappears. Give base-class configuration methods distinctive names (\`startBrowser\`, \`quitBrowser\`) or make them \`final\`.
- Several \`@BeforeMethod\` methods in the **same** class have no guaranteed order. Use one method that calls helpers in order, or \`dependsOnMethods\` on configuration methods (allowed, but rarely worth it).

### Groups and configuration methods: the \`alwaysRun\` trap

When a run includes groups (\`<include name="smoke"/>\` or \`-Dgroups=smoke\`), configuration methods that do not belong to the included groups are **not run** unless they have \`alwaysRun = true\` — the TestNG docs: such a method "will be run regardless of what groups it belongs to". Symptom: the full regression is green, the smoke job fails with \`NullPointerException\` on the driver because \`BaseTest.startBrowser\` never ran.

\`\`\`java
public abstract class BaseTest {
    @BeforeMethod(alwaysRun = true)                 // runs for every group selection
    public void startBrowser() { DriverManager.start(UiConfig.load()); }

    @AfterMethod(alwaysRun = true)                  // also runs after failures
    public void quitBrowser() { DriverManager.quit(); }
}
\`\`\`

Make \`alwaysRun = true\` the default for every configuration method in base classes; it costs nothing.

\`onlyForGroups\` on \`@BeforeMethod\`/\`@AfterMethod\` does the opposite: it limits a configuration method to tests of certain groups — e.g. a seeded cart only for \`cart\` tests:

\`\`\`java
@BeforeMethod(alwaysRun = true, onlyForGroups = "cart")
public void seedCart() {
    // only for methods in group "cart": write shopeasy.cart into sessionStorage via the action layer
}
\`\`\`

### \`@BeforeGroups\`

\`\`\`java
public class CheckoutTests extends BaseTest {

    @BeforeGroups(groups = "checkout", alwaysRun = true)
    public void createCheckoutCustomer() {
        // runs once before the FIRST method of group "checkout" in this <test>
    }

    @Test(groups = "checkout")
    public void taxIsEightPercentOfSubtotal() { /* ... */ }
}
\`\`\`

Traps: the method runs once per \`<test>\` (not per class); with \`parallel="methods"\` other group members may already be running on other threads while it executes on one; and if the declaring class is not part of the run, it never fires. For shared set-up prefer an explicit, idempotent fixture (a lazily initialised, thread-safe holder) over \`@BeforeGroups\`.

### Configuration failures and the skip cascade

| Failing method | What gets skipped |
|---|---|
| \`@BeforeSuite\` | every test and configuration method of the suite |
| \`@BeforeTest\` | everything in that \`<test>\` block |
| \`@BeforeClass\` | all tests of that **instance** |
| \`@BeforeMethod\` | that test — and with the default \`configfailurepolicy="skip"\`, the **following** invocations of that class too |

\`configfailurepolicy="continue"\` (suite attribute) makes TestNG retry the configuration method for the next test instead of skipping everything after the first failure. Use it in UI suites where \`@BeforeMethod\` starts a browser: one Grid hiccup should not skip 40 tests.

**Injection into configuration methods** (TestNG's native dependency injection): \`@BeforeMethod\` can take \`Method\` (the test about to run), \`Object[]\` (its parameters), \`ITestResult\`, \`ITestContext\` and \`XmlTest\`; \`@AfterMethod\` typically takes \`ITestResult\` to see the status. That is how a base class names the browser session after the test (\`se:name\` on Grid) without a listener.

## \`@Factory\` and instance-level parallelism

### What it is

A data provider multiplies **one method**; a factory multiplies **the whole class**: every returned object is a test instance with its own fields, its own \`@BeforeClass\`/\`@AfterClass\` and all its \`@Test\` methods. Use it when a set of tests shares expensive per-variant set-up (a logged-in session per account, a configured catalogue per locale, a sort order per class).

### Constructor factory vs method factory

\`\`\`java
package com.shopeasy.tests.sorting;

import java.util.Comparator;
import java.util.List;
import org.testng.ITest;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Factory;
import org.testng.annotations.Test;
import static org.testng.Assert.assertEquals;

public class SortOrderTest implements ITest {

    private final String option;                       // value of <select id="product-sort">
    private final Comparator<ProductCard> expected;

    @Factory(dataProvider = "sortOptions")             // approach 1: constructor factory
    public SortOrderTest(String option, Comparator<ProductCard> expected) {
        this.option = option;
        this.expected = expected;
    }

    @DataProvider
    public static Object[][] sortOptions() {           // static: no instance exists yet
        return new Object[][] {
            {"az",   Comparator.comparing(ProductCard::name)},
            {"za",   Comparator.comparing(ProductCard::name).reversed()},
            {"lohi", Comparator.comparing(ProductCard::price)},
            {"hilo", Comparator.comparing(ProductCard::price).reversed()},
        };
    }

    @Override
    public String getTestName() { return "sort=" + option; }   // shows up instead of the class name

    @Test
    public void productsFollowSortOrder() {
        List<ProductCard> shown = new InventoryPage(DriverManager.get()).open().sortBy(option).cards();
        assertEquals(shown, shown.stream().sorted(expected).toList(), "Order for sort option " + option);
    }

    @Test
    public void sortSelectionSurvivesRefresh() { /* ... */ }
}
\`\`\`

\`ProductCard\` is a small record (\`name\`, \`price\`) read from \`.inventory-item .item-name\` / \`.item-price\`; \`InventoryPage\` and \`DriverManager\` are the usual framework classes (\`selenium-deep-parallel-execution\`).

The alternative is a factory **method**, which gives full control over construction — useful when instances need collaborators built from configuration:

\`\`\`java
public class SortOrderFactory {
    @Factory
    public Object[] create() {                         // approach 2: method factory
        UiConfig config = UiConfig.load();
        return config.sortOptions().stream()           // e.g. from config: "az,za,lohi,hilo"
                .map(o -> new SortOrderTest(o, SortExpectations.forOption(o)))
                .toArray();
    }
}
\`\`\`

| | Constructor + \`dataProvider\` | Factory method |
|---|---|---|
| How it works | each data row → one constructor call | you return \`Object[]\` of instances |
| Advantages | compact; rows can be filtered with \`indices\` | any construction logic, different classes in one factory, builders, DI |
| Disadvantages | data provider must be static (or in \`dataProviderClass\`) | one more class; the factory class itself must be in the suite |
| Maintainability | best for "same class, different data" | best when creation needs configuration or collaborators |
| When to use | variants known as data | variants computed from config/environment |

**Recommended approach and why:** the constructor factory with a static data provider for plain data variants — it keeps data and test together and supports \`indices\` to run one variant while debugging (\`@Factory(dataProvider = "sortOptions", indices = {3})\`); a method factory when instances need configuration-driven construction.

### Lifecycle and parallelism

- \`@BeforeClass\` runs **once per instance**: four instances → four logins/browser starts if the browser is per class.
- \`parallel="instances"\` runs different instances on different threads while methods of **one** instance stay on the same thread — exactly the model for "one browser per instance".
- \`group-by-instances="true"\` on \`<test>\` (sequential runs) makes TestNG finish all methods of one instance before starting the next; without it methods may interleave across instances (\`az.method1\`, \`za.method1\`, \`az.method2\`…), which breaks per-instance browser state.

\`\`\`xml
<suite name="Sorting" parallel="instances" thread-count="4">
  <test name="Sort orders">
    <classes><class name="com.shopeasy.tests.sorting.SortOrderTest"/></classes>
  </test>
</suite>
\`\`\`

## \`@DataProvider\` in depth

### Return types: eager vs lazy

| Return type | Evaluation | Use for |
|---|---|---|
| \`Object[][]\` | all rows built before the first invocation | small, static tables |
| \`Iterator<Object[]>\` | rows pulled one at a time between invocations | large files, generated data, rows that are expensive or must be fresh |

\`\`\`java
@DataProvider(name = "checkoutCustomers")
public static Iterator<Object[]> checkoutCustomers() throws IOException {
    Stream<String> lines = Files.lines(Path.of("src/test/resources/data/checkout-customers.csv"));
    return lines.skip(1)                                         // header: first,last,postal,expectedError
                .map(line -> line.split(",", -1))
                .map(c -> new Object[] {new CustomerRow(c[0], c[1], c[2], c[3])})
                .iterator();
}
\`\`\`

Lazy matters in two ways: memory (a 50,000-row file) and **freshness** — a row that creates a user through \`POST /api/users\` should be created just before its test, not 20 minutes earlier when the token has expired (ShopEasy tokens: \`expiresIn: 3600\`). The trade-off: with an iterator, TestNG cannot know the row count in advance, and a file handle stays open until the iterator is exhausted.

### Options that matter

| Option | Meaning |
|---|---|
| \`name\` | referenced by \`@Test(dataProvider = "...")\`; default is the method name |
| \`parallel = true\` | rows run concurrently on the data-provider pool (size: \`data-provider-thread-count\`, default 10 — see \`selenium-deep-parallel-execution\`) |
| \`indices = {0, 2}\` | run only those rows — the debugging switch |
| \`dataProviderClass\` (on \`@Test\`) | provider lives in another class; it must then be \`static\` (or the class must have a no-arg constructor) |
| \`retryUsing\` (recent 7.x) | an \`IRetryDataProvider\` to retry a data provider that failed (e.g. a flaky data API) |
| \`-propagateDataProviderFailureAsTestFailure\` (command-line / suite option) | report an exception in the provider as test **failures** instead of skips |

That last point deserves emphasis: by default a data provider that throws produces **skipped** tests, so a broken JSON file or a 500 from the data API turns your data-driven checkout tests into a quiet column of SKIPs.

### Injecting \`Method\` and \`ITestContext\`

A provider can accept \`Method\` (the test that asks), \`ITestContext\` (the current \`<test>\`) and \`ConstructorOrMethod\`. One provider can then serve several tests or adapt to the run:

\`\`\`java
public final class LoginData {

    @DataProvider(name = "logins")
    public static Object[][] logins(Method test, ITestContext context) {
        boolean smokeRun = Arrays.asList(context.getIncludedGroups()).contains("smoke");
        if (test.getName().startsWith("rejects")) {
            return new Object[][] {
                {"locked_out_user", "secret_sauce", "Error: Sorry, this user has been locked out."},
                {"standard_user",   "wrong",        "Error: Username and password do not match any user in this service"},
                {"",                "secret_sauce", "Error: Username is required"},
            };
        }
        return smokeRun
                ? new Object[][] {{"standard_user", "secret_sauce", ""}}
                : new Object[][] {{"standard_user", "secret_sauce", ""} /* + more valid variants */};
    }
}

public class LoginTest extends BaseTest {
    @Test(dataProvider = "logins", dataProviderClass = LoginData.class, groups = {"smoke", "auth"})
    public void rejectsInvalidCredentials(String user, String password, String expectedError) { /* ... */ }
}
\`\`\`

Keep this kind of branching small. A provider with ten \`if\`s is a second test suite hidden in a helper; split providers instead.

### Readable names for rows and instances

Reports show \`rejectsInvalidCredentials\` three times with parameters in brackets — fine in the IDE, useless in a trend dashboard. Options:

| Approach | How | Notes |
|---|---|---|
| \`ITest.getTestName()\` on the class | return a per-instance name (factory instances) | ideal for \`@Factory\`; for data-provider rows on one instance you need a per-thread name set in \`@BeforeMethod(Object[] args)\` |
| Wrap rows in a record with \`toString()\` | \`new Object[] {new CustomerRow(...)}\` | most reporters print parameters with \`toString()\`; no threading issues |
| \`ITestResult.setTestName(...)\` in a listener's \`onTestStart\` | central naming rule | reporters differ in which name they display — check yours (Allure, Extent, Surefire XML) |

**Recommended:** one parameter object per row with a meaningful \`toString()\` (\`CustomerRow[locked_out_user → locked out]\`) plus \`ITest\` for factory instances. It is reporter-agnostic and thread-safe.

## Parameters vs system properties vs configuration

| Mechanism | Scope / source | Good for | Weak at |
|---|---|---|---|
| \`@Parameters\` + \`<parameter>\` (with \`@Optional\` default) | per \`<suite>\`/\`<test>\` in XML | values that **differ per \`<test>\` block** in one run: browser per block in a cross-browser suite | anything run outside that XML (IDE single test, \`-Dtest=\`), secrets |
| System properties \`-Dkey=value\` | whole JVM | one-off overrides from CI (\`-Denv=qa -Dheadless=false\`) | per-block differences; Surefire forks need them passed through |
| Config files + env vars (the layered \`UiConfig\` in \`selenium-deep-framework-design\`) | the framework | the default source of truth; secrets from env | per-block variation |

\`\`\`java
@BeforeMethod(alwaysRun = true)
@Parameters("browser")
public void startBrowser(@Optional("chrome") String browser) {   // block value > default
    DriverManager.start(UiConfig.load().withBrowser(browser));
}
\`\`\`

Rule of thumb: **\`@Parameters\` only for what genuinely varies between \`<test>\` blocks; everything else from configuration.** A parameter without \`@Optional\` and without a value fails with *"Parameter 'browser' is required by BeforeMethod on method startBrowser … but has not been marked @Optional or defined"* — the most common reason "it runs from testng.xml but not from the IDE".

## The listener and extension API

### What each interface is for

| Interface | Called | Typical framework use |
|---|---|---|
| \`IExecutionListener\` | once at the start / end of the whole TestNG run | start/stop a mock server, print effective config, timing of the whole run |
| \`IAlterSuiteListener\` | once, with \`List<XmlSuite>\`, before suites run | thread count/parallel mode from properties, inject listeners, clone \`<test>\` per browser |
| \`IAnnotationTransformer\` | for each annotation while classes are read | global retry analyzer, disable tests by a ticket list, set \`timeOut\` per group, change data provider \`parallel\` |
| \`ISuiteListener\` | \`onStart/onFinish(ISuite)\` | suite-level resources, report start/flush |
| \`ITestListener\` | \`onStart/onFinish(ITestContext)\` per \`<test>\` and per-result \`onTestStart/Success/Failure/Skipped\` | logging, report nodes, evidence (see \`selenium-deep-troubleshooting-flaky-tests\`) |
| \`IClassListener\` | before/after each test class instance | per-class resources |
| \`IInvokedMethodListener\` | before/after **every** invocation, test and configuration | MDC context, timing, sees configuration methods too |
| \`IConfigurationListener\` | \`beforeConfiguration\`, \`onConfigurationSuccess/Failure/Skip\` | **report configuration failures** — the root cause of most skip cascades |
| \`IMethodInterceptor\` | per \`<test>\`, with the free methods | reorder (smoke first, slow last), filter by a custom annotation |
| \`IHookable\` | **instead of** invoking the test method; you call \`callBack.runTestMethod(result)\` | wrap the test body (MDC, security context, \`InheritableThreadLocal\` hand-off), or skip it conditionally |
| \`IConfigurable\` | same, for configuration methods (\`callBack.runConfigurationMethod(result)\`) | wrap \`@Before/@After\` bodies |
| \`IDataProviderListener\` | before/after a data provider runs, \`onDataProviderFailure\` | time data providers, turn provider failures into visible errors |
| \`IDataProviderInterceptor\` | after the provider, with its rows | filter/transform rows centrally |
| \`IRetryAnalyzer\` | after a failure: \`boolean retry(ITestResult)\` | the retry policy (\`java-deep-exception-design\`) |
| \`IReporter\` | once, after all suites: \`generateReport(xmlSuites, suites, outputDirectory)\` | custom summaries, JSON for dashboards |

In TestNG 7 the older "2/3" variants were folded into these interfaces as default methods: \`IAnnotationTransformer2\`/\`IAnnotationTransformer3\` are deprecated since 7.0 and \`IAnnotationTransformer\` now has default \`transform\` overloads for \`ITestAnnotation\`, \`IConfigurationAnnotation\`, \`IDataProviderAnnotation\`, \`IFactoryAnnotation\` and \`IListenersAnnotation\`. Old code implementing the "2" interfaces is one of the upgrade breaks.

### Registration — and what each way cannot do

| Way | Scope | Notes |
|---|---|---|
| \`@Listeners({A.class})\` on a test class | **the whole suite**, not just that class | cannot register an \`IAnnotationTransformer\` (the docs: it is ignored); too late for anything that must act before classes are read, so do not use it for \`IAlterSuiteListener\` either |
| \`<listeners><listener class-name="..."/></listeners>\` in testng.xml | that suite | explicit and reviewable; the usual place for transformers and alter-suite listeners |
| \`-listener a.B,c.D\` / Surefire \`<properties><property><name>listener</name>…\` | that run | CI-only listeners |
| ServiceLoader: \`META-INF/services/org.testng.ITestNGListener\` | every run with the JAR on the classpath | best for a shared framework JAR: consumers get the listeners without configuration |
| \`testng.addListener(...)\` / \`XmlSuite.addListener(...)\` | programmatic | launchers and tests of listeners |

The \`@Listeners\`-applies-globally surprise matters: two classes each declaring \`@Listeners(ScreenshotListener.class)\` do **not** give you two scoped listeners; TestNG registers it for the suite (deduplicated by class), and every test, including API tests without a browser, triggers it. Make listeners defensive (\`DriverManager.hasDriver()\`) or register them in one place.

### Execution order of callbacks

Approximately, for a sequential run:

\`\`\`
IExecutionListener.onExecutionStart
IAlterSuiteListener.alter(suites)                    (annotation transformers run as classes are parsed)
ISuiteListener.onStart(suite)
  ITestListener.onStart(context)                     per <test>
    IMethodInterceptor.intercept(...)
    IClassListener.onBeforeClass
      IInvokedMethodListener.beforeInvocation        ┐ for each configuration method:
      IConfigurable.run → @Before…                   │ IConfigurationListener.beforeConfiguration /
      IInvokedMethodListener.afterInvocation         ┘ onConfigurationSuccess|Failure|Skip
      ITestListener.onTestStart
      IInvokedMethodListener.beforeInvocation
      IHookable.run → @Test body
      IInvokedMethodListener.afterInvocation
      IRetryAnalyzer.retry (on failure)
      ITestListener.onTestSuccess|Failure|Skipped
    IClassListener.onAfterClass
  ITestListener.onFinish(context)
ISuiteListener.onFinish(suite)
IReporter.generateReport(...)
IExecutionListener.onExecutionFinish
\`\`\`

Do not build logic on the relative order of \`onTestStart\` and \`beforeInvocation\`, or of two listeners of the same type — the latter is registration order by default, and recent 7.x versions add a listener comparator (\`ListenerComparator\`, \`-listenercomparator\`) precisely because people needed a guaranteed order. If listener A needs listener B's result, merge them or pass data via \`ITestResult.setAttribute\`.

### Full example 1 — \`IMethodInterceptor\`: \`@Smoke\` tests first

Goal: in a long regression \`<test>\`, run the smoke-critical tests first so that a broken build fails fast — without renaming methods or adding priorities everywhere.

\`\`\`java
package com.shopeasy.framework.testng;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Marks a test (or a whole class) as smoke-critical. Read at runtime by SmokeFirstInterceptor. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface Smoke {}
\`\`\`

\`\`\`java
package com.shopeasy.framework.testng;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.testng.IMethodInstance;
import org.testng.IMethodInterceptor;
import org.testng.ITestContext;
import org.testng.ITestNGMethod;

public class SmokeFirstInterceptor implements IMethodInterceptor {

    @Override
    public List<IMethodInstance> intercept(List<IMethodInstance> methods, ITestContext context) {
        List<IMethodInstance> smoke = new ArrayList<>();
        List<IMethodInstance> rest = new ArrayList<>();
        for (IMethodInstance instance : methods) {
            (isSmoke(instance.getMethod()) ? smoke : rest).add(instance);
        }
        List<IMethodInstance> ordered = new ArrayList<>(smoke);   // stable: keeps TestNG's order inside each bucket
        ordered.addAll(rest);
        return ordered;
    }

    private static boolean isSmoke(ITestNGMethod method) {
        Method javaMethod = method.getConstructorOrMethod().getMethod();
        return javaMethod.isAnnotationPresent(Smoke.class)
                || method.getRealClass().isAnnotationPresent(Smoke.class);   // real class, not the base class
    }
}
\`\`\`

Step by step:

1. TestNG passes only **free** methods (no dependencies/dependents) for the current \`<test>\`; dependent chains are untouched.
2. Two buckets, then concatenation: a stable partition keeps TestNG's priority/name order within each bucket, so the change is predictable.
3. \`getRealClass()\` returns the concrete test class even when the method is inherited from a base class — \`getDeclaringClass()\` would look at \`BaseTest\`.
4. Returning a shorter list **filters** tests (a "quarantine" interceptor could drop \`@Quarantined\` methods and log them) — powerful and dangerous: removed tests vanish from reports. If you filter, log each removed method and count them in the summary.
5. With \`parallel="methods"\` the list is the start order for the pool; smoke tests start first but finish whenever they finish.

Equivalent without code: a separate \`<test name="smoke">\` block with \`<include name="smoke"/>\` before the regression block. That duplicates selection logic in XML but is visible to everyone; the interceptor is better when "smoke" is a property of the test, not of the run.

### Full example 2 — \`IAnnotationTransformer\`: a global retry analyzer

Retry *policy* (only infrastructure failures, max once, never assertion failures, report retries) is designed in \`java-deep-exception-design\`; here is only how to attach it to every test without editing 400 annotations.

\`\`\`java
package com.shopeasy.framework.testng;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import org.testng.IAnnotationTransformer;
import org.testng.IRetryAnalyzer;
import org.testng.annotations.ITestAnnotation;

public class GlobalRetryTransformer implements IAnnotationTransformer {

    @Override
    public void transform(ITestAnnotation annotation, Class testClass,
                          Constructor testConstructor, Method testMethod) {
        if (testMethod != null && testMethod.isAnnotationPresent(NoRetry.class)) {
            return;                                                    // explicit opt-out, e.g. payment tests
        }
        Class<? extends IRetryAnalyzer> current = annotation.getRetryAnalyzerClass();
        // TestNG 7's default is an internal no-op analyzer; compare by name to avoid importing an internal class.
        boolean hasOwnAnalyzer = current != null && !"DisabledRetryAnalyzer".equals(current.getSimpleName());
        if (!hasOwnAnalyzer) {
            annotation.setRetryAnalyzer(InfrastructureRetryAnalyzer.class);
        }
    }
}
\`\`\`

\`\`\`xml
<suite name="ShopEasy regression">
  <listeners>
    <!-- transformers MUST be registered here, on the command line or via ServiceLoader — never with @Listeners -->
    <listener class-name="com.shopeasy.framework.testng.GlobalRetryTransformer"/>
  </listeners>
  ...
</suite>
\`\`\`

Notes: \`transform\` is called for annotations on classes and constructors too (then \`testMethod\` is \`null\`), so guard it. The same hook is used to set \`timeOut\` for a group, to disable tests listed in a "known defects" file (\`annotation.setEnabled(false)\` — log it loudly), or to set \`parallel\` on data providers through the \`IDataProviderAnnotation\` overload. Retried attempts appear as **SKIP** results with \`ITestResult.wasRetried()\` = \`true\`; reporters must filter them or the skip count lies.

### Full example 3 — \`IReporter\`: a compact summary for CI

\`\`\`java
package com.shopeasy.framework.testng;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.testng.IReporter;
import org.testng.ISuite;
import org.testng.ISuiteResult;
import org.testng.ITestContext;
import org.testng.ITestResult;
import org.testng.xml.XmlSuite;

public class CompactSummaryReporter implements IReporter {

    @Override
    public void generateReport(List<XmlSuite> xmlSuites, List<ISuite> suites, String outputDirectory) {
        StringBuilder out = new StringBuilder("# Test summary\\n\\n| Suite / test | Passed | Failed | Skipped | Retried |\\n|---|---|---|---|---|\\n");
        StringBuilder failures = new StringBuilder("\\n## Failures\\n\\n");

        for (ISuite suite : suites) {
            for (ISuiteResult suiteResult : suite.getResults().values()) {
                ITestContext ctx = suiteResult.getTestContext();
                Set<ITestResult> skipped = ctx.getSkippedTests().getAllResults();
                long retried = skipped.stream().filter(ITestResult::wasRetried).count();
                out.append("| ").append(suite.getName()).append(" / ").append(ctx.getName())
                   .append(" | ").append(ctx.getPassedTests().size())
                   .append(" | ").append(ctx.getFailedTests().size())
                   .append(" | ").append(skipped.size() - retried)          // real skips only
                   .append(" | ").append(retried).append(" |\\n");

                ctx.getFailedTests().getAllResults().stream()
                   .sorted(Comparator.comparing(r -> r.getMethod().getQualifiedName()))
                   .forEach(r -> failures.append("- \`").append(r.getMethod().getQualifiedName()).append("\` — ")
                                         .append(firstLine(r.getThrowable())).append('\\n'));
                ctx.getFailedConfigurations().getAllResults()
                   .forEach(r -> failures.append("- CONFIG \`").append(r.getMethod().getQualifiedName()).append("\` — ")
                                         .append(firstLine(r.getThrowable())).append('\\n'));
            }
        }
        try {
            Path file = Path.of(outputDirectory, "compact-summary.md");
            Files.createDirectories(file.getParent());
            Files.writeString(file, out.append(failures));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write compact summary", e);
        }
    }

    private static String firstLine(Throwable t) {
        if (t == null) return "(no exception)";
        String msg = String.valueOf(t.getMessage());
        int nl = msg.indexOf('\\n');
        return t.getClass().getSimpleName() + ": " + (nl < 0 ? msg : msg.substring(0, nl));
    }
}
\`\`\`

Step by step: the reporter runs **once after all suites**, so it sees final results (unlike \`ITestListener\`, which sees each result as it happens). It reads every \`<test>\`'s \`ITestContext\`, separates genuine skips from retried attempts, lists failed **configuration** methods explicitly (they explain the skips) and writes a Markdown file a CI job can post into the build summary. \`outputDirectory\` is TestNG's output folder (Surefire sets it under \`target/surefire-reports\`).

### Full example 4 — \`IAlterSuiteListener\`: thread count from a system property

\`\`\`java
package com.shopeasy.framework.testng;

import java.util.List;
import org.testng.IAlterSuiteListener;
import org.testng.xml.XmlSuite;
import org.testng.xml.XmlTest;

public class ThreadCountFromPropertyListener implements IAlterSuiteListener {

    @Override
    public void alter(List<XmlSuite> suites) {
        String value = System.getProperty("threads");
        if (value == null || value.isBlank()) {
            return;                                                   // keep testng.xml as written
        }
        int threads = Integer.parseInt(value.trim());
        if (threads < 1 || threads > 32) {
            throw new IllegalArgumentException("-Dthreads must be 1..32 but was " + value);
        }
        for (XmlSuite suite : suites) {
            suite.setThreadCount(threads);
            if (threads == 1) {
                suite.setParallel(XmlSuite.ParallelMode.NONE);         // -Dthreads=1: debug run
            }
            for (XmlTest test : suite.getTests()) {
                test.setThreadCount(threads);                         // <test> overrides the suite value
            }
            System.out.printf("[alter] suite '%s': thread-count=%d, parallel=%s%n",
                    suite.getName(), threads, suite.getParallel());
        }
    }
}
\`\`\`

Register it in \`testng.xml\` \`<listeners>\` or ServiceLoader. Why not just \`-Dthreadcount\`? Surefire has its own \`threadCount\` and \`parallel\` parameters, but they apply only when Surefire generates the suite or overrides it; with your own \`testng.xml\` the XML wins. The listener makes one XML file usable for a 1-thread debug run, an 8-thread PR run and a Grid run, logs the effective value, and rejects nonsense.

ServiceLoader registration for a shared framework JAR (one fully qualified class name per line):

\`\`\`
# src/main/resources/META-INF/services/org.testng.ITestNGListener
com.shopeasy.framework.testng.ThreadCountFromPropertyListener
com.shopeasy.framework.testng.GlobalRetryTransformer
com.shopeasy.framework.testng.CompactSummaryReporter
\`\`\`

### \`IHookable\`: wrap the test body

\`\`\`java
public abstract class BaseTest implements IHookable {
    @Override
    public void run(IHookCallBack callBack, ITestResult result) {
        MDC.put("test", result.getMethod().getQualifiedName());
        try {
            callBack.runTestMethod(result);       // forget this call and the test body never runs — and PASSES
        } finally {
            MDC.remove("test");
        }
    }
}
\`\`\`

\`IHookable\` is the only hook that runs **around** the method on its invocation thread; listeners only observe before/after. The flip side: an \`IHookable\` that does not call \`runTestMethod\` silently turns tests green. Cover it with a framework unit test.

### Comparison: where to put cross-cutting behaviour

| Need | Best hook | Why not the others |
|---|---|---|
| Change what runs / thread counts | \`IAlterSuiteListener\` | interceptor is too late for parallel settings |
| Change annotations globally | \`IAnnotationTransformer\` | editing 400 files; base class cannot change \`@Test\` attributes |
| Reorder/filter free methods | \`IMethodInterceptor\` | priority on every method is noise |
| Observe results, evidence | \`ITestListener\` (+ \`IConfigurationListener\`) | \`IReporter\` is too late for screenshots |
| Wrap execution (context, timing around body) | \`IHookable\` / \`IConfigurable\` | listeners cannot wrap |
| Final aggregated output | \`IReporter\` | per-result listeners do not see final retry state |

## Sharing state: \`ITestContext\` and \`ISuite\` attributes

Both implement \`IAttributes\` (\`setAttribute\`, \`getAttribute\`, \`removeAttribute\`, \`getAttributeNames\`). \`ITestContext\` attributes are per \`<test>\` block; \`ISuite\` attributes (\`context.getSuite()\`) are suite-wide.

\`\`\`java
@BeforeTest(alwaysRun = true)
public void loadCatalogue(ITestContext context) {
    List<Product> products = catalogueApi.listAll();             // GET /api/products, all pages
    context.setAttribute("catalogue", List.copyOf(products));   // immutable snapshot
}

@Test
public void everyCatalogueProductHasAnAddToCartButton(ITestContext context) {
    @SuppressWarnings("unchecked")
    List<Product> catalogue = (List<Product>) context.getAttribute("catalogue");
    // ... check [data-testid='add-to-cart-<slug>'] for each product
}
\`\`\`

Why it is risky in parallel:

- Attributes are a shared map, **not** per thread. Writing per-test values (\`"currentUser"\`, \`"orderId"\`) from parallel tests is a race: test A reads B's order. Only write in a configuration method that runs before the parallel part; afterwards **read only**, and store immutable values.
- Untyped \`Object\` + string keys: a typo returns \`null\` at runtime. Wrap access in a small typed helper (\`SuiteState.catalogue(context)\`).
- It couples tests to the run structure: a test that needs an attribute set in \`@BeforeTest\` breaks when run alone from the IDE unless the base class provides it. Prefer a lazily initialised, thread-safe holder for expensive shared data and keep \`ITestContext\` for run metadata.

## SoftAssert internals and a screenshot-capturing SoftAssert

### How it works

\`org.testng.asserts.Assertion\` is the instance-based assertion class; every \`assertX\` builds an \`IAssert\` command object and passes it to \`doAssert\`. The base implementation calls hooks around the check: \`onBeforeAssert\`, then \`executeAssert\`, then \`onAssertSuccess\` or \`onAssertFailure(IAssert, AssertionError)\` (and rethrows), then \`onAfterAssert\`. \`SoftAssert\` overrides \`doAssert\` to **catch** the \`AssertionError\`, still call \`onAssertFailure\`, and store it in an internal map; \`assertAll()\` (or \`assertAll(String message)\`) throws one \`AssertionError\` listing all stored failures.

That design gives you three extension points without reimplementing anything: subclass \`Assertion\` for hard assertions with logging, subclass \`SoftAssert\` for soft ones, override the hooks.

### Custom SoftAssert: screenshot on each failure

\`\`\`java
package com.shopeasy.framework.assertions;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.Reporter;
import org.testng.asserts.IAssert;
import org.testng.asserts.SoftAssert;

public class ScreenshotSoftAssert extends SoftAssert {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("HHmmss-SSS");
    private final WebDriver driver;
    private int failureCount;

    public ScreenshotSoftAssert(WebDriver driver) {
        this.driver = driver;
    }

    @Override
    public void onAssertFailure(IAssert<?> assertCommand, AssertionError ex) {
        failureCount++;
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            Path file = Path.of("target", "screenshots",
                    "soft-" + failureCount + "-" + LocalDateTime.now().format(TS) + ".png");
            Files.createDirectories(file.getParent());
            Files.write(file, png);
            Reporter.log("Soft assertion failed: " + assertCommand.getMessage() + " → " + file, true);
        } catch (Exception e) {                      // evidence must never change the test outcome
            Reporter.log("Could not capture screenshot for soft failure: " + e, true);
        }
    }
}
\`\`\`

Usage on the checkout overview (\`#summary-subtotal\`, \`#summary-tax\`, \`#summary-total\`, tax 8%):

\`\`\`java
ScreenshotSoftAssert softly = new ScreenshotSoftAssert(DriverManager.get());   // one per test, never a field
softly.assertEquals(overview.subtotal(), "$39.98", "Item total");
softly.assertEquals(overview.tax(), "$3.20", "Tax (8%)");
softly.assertEquals(overview.total(), "$43.18", "Total");
softly.assertAll("Checkout overview for backpack + bike light");
\`\`\`

Why a screenshot **per failure**: by the time \`assertAll()\` runs (and the failure listener takes its screenshot), the page may have changed; the soft failure's evidence is the page state at the moment of the check. In real frameworks, attach to Allure/Extent instead of only writing a file, and name the file after the test (from \`Reporter.getCurrentTestResult()\`).

The same hooks give a **logging hard assertion**: \`public class LoggingAssert extends Assertion { @Override public void onAssertSuccess(IAssert<?> a) { log.info("✔ {}", a.getMessage()); } }\` — every passed check appears in the step log, which turns a failure investigation into reading a narrative.

## Timeouts, invocations and expected exceptions

| Attribute | Meaning | Pitfall |
|---|---|---|
| \`timeOut = 5000\` | fail a single invocation that runs longer than 5 s | TestNG runs a method with \`timeOut\` on a **separate worker thread** — a \`ThreadLocal\` driver set in \`@BeforeMethod\` is \`null\` inside the test (long-standing, reported in TestNG's issue tracker) |
| \`invocationTimeOut = 60000\` | total time for **all** \`invocationCount\` runs | only meaningful with \`invocationCount > 1\` |
| \`time-out\` on \`<suite>\`/\`<test>\` | default timeout for methods in that scope | same thread caveat |
| \`invocationCount = 20, threadPoolSize = 5\` | run 20 times on 5 threads | \`@BeforeMethod\` runs per invocation; shared fields race |
| \`successPercentage = 90\` | with \`invocationCount\`, pass if ≥ 90 % succeed | result status \`SUCCESS_PERCENTAGE_FAILURE\`; hides real failures if used for flaky UI tests |
| \`expectedExceptions\` + \`expectedExceptionsMessageRegExp\` | the method passes only if it throws this | passes if **any** line throws it, even the set-up line |
| \`Assert.assertThrows\` / \`Assert.expectThrows\` | assertion around one lambda; \`expectThrows\` returns the exception | — |

The \`timeOut\` + \`ThreadLocal\` trap explains a classic report: "the test passes without \`timeOut\` and throws \`NullPointerException\` on \`DriverManager.get()\` with it". Options: avoid \`timeOut\` on UI tests (use explicit waits and the driver's own timeouts; let CI kill a hung job with a job-level timeout), use \`InheritableThreadLocal\` (works when the worker thread is created fresh, fragile with pools), or apply \`timeOut\` only to API tests that do not use thread-bound state.

\`expectedExceptions\` vs \`assertThrows\`:

\`\`\`java
@Test(expectedExceptions = ApiException.class)                // weak: which call threw it?
public void unknownProductIsRejectedOld() {
    Cart cart = cartApi.create();                              // if THIS throws ApiException, the test passes
    cart.add(999);
}

@Test
public void unknownProductIsRejected() {
    Cart cart = cartApi.create();
    ApiException e = Assert.expectThrows(ApiException.class, () -> cart.add(999));
    Assert.assertEquals(e.status(), 404);
    Assert.assertEquals(e.code(), "PRODUCT_NOT_FOUND");       // ShopEasy error code
}
\`\`\`

**Recommended:** \`assertThrows\`/\`expectThrows\` — the expectation is attached to the exact call and you can assert on the exception's details.

## TestNG versions and upgrade breaks

- **Java baseline:** TestNG 7.6.0 and later require JDK 11+ (the TestNG docs: up to 7.5 run on JDK 8). A Java 8 project that bumps TestNG gets \`UnsupportedClassVersionError\` — pin \`7.5.x\` or upgrade the JDK (Java 17 is the handbook baseline).
- **Deprecated "2/3" interfaces:** \`IAnnotationTransformer2/3\` deprecated in 7.0 in favour of default methods on \`IAnnotationTransformer\`; other "…2" listener interfaces followed the same pattern — compile against the new version and fix every deprecation warning before upgrading further.
- **Retry reporting:** retried attempts are reported as SKIP with \`wasRetried()\`; dashboards that count skips jump after an upgrade or after enabling retry.
- **Ordering changes:** priority/dependency/preserve-order interplay has been adjusted in several 7.x releases. Suites that relied on implicit order break; the fix is independence, not pinning the version.
- **Data provider and injection strictness:** mismatched argument counts/types fail with \`MethodMatcherException\` ("Data provider mismatch") rather than odd runtime errors.
- **Surefire alignment:** old Surefire versions combined with new TestNG can mis-detect the provider. Upgrade Surefire with TestNG (details in \`framework-deep-maven-build-internals\`).

Upgrade routine: read the TestNG changelog for every minor in between, upgrade on a branch, run the full suite twice and compare **counts per status** (not just "green"), especially skips and total test count — a silently dropped listener or data provider shows up only there.

## Debugging: why is this test skipped or not running?

| Symptom | Likely cause | How to find it |
|---|---|---|
| Many SKIPs, few failures | configuration failure cascade (\`@BeforeClass\`, \`@BeforeMethod\`) | report the failed configuration (an \`IConfigurationListener\`, or \`ctx.getFailedConfigurations()\`); the first one is the root cause |
| Dependents SKIPPED | hard dependency failed | the skip's throwable/message names the dependency |
| Data-driven test SKIPPED with no failure | the data provider threw | stack trace in the skip result; enable "propagate data provider failure as test failure" |
| Group run: \`NullPointerException\` on the driver | base \`@BeforeMethod\` not in the included group | add \`alwaysRun = true\` |
| Test count lower than expected | interceptor/transformer filtered tests; \`enabled = false\`; a class not public / no public no-arg constructor | log in interceptors, count per status, \`-verbose 2\` / \`<suite verbose="2">\` |
| \`Cannot inject @Test annotated Method [login] with [class java.lang.String]\` | the method has parameters but no \`dataProvider\`/\`@Parameters\` supplies them (or a type TestNG cannot inject natively) | add the provider, or \`@Parameters\` + \`@Optional\` |
| \`MethodMatcherException: Data provider mismatch\` | row length or types do not match the method signature | the message lists the method's parameters and the row's arguments — compare them |
| \`Parameter 'x' is required by … but has not been marked @Optional or defined\` | \`@Parameters\` without an XML value (IDE run) | \`@Optional\` default or move the value to config |
| Tests pass in the IDE, fail in CI with \`timeOut\` | separate thread + \`ThreadLocal\` | remove \`timeOut\` or avoid thread-bound state |

## Common mistakes and debugging

- **\`@Listeners(GlobalRetryTransformer.class)\` — nothing happens.** Transformers registered with \`@Listeners\` are ignored. Register in \`testng.xml\`, \`-listener\`, or ServiceLoader, and log a line from the transformer's constructor to prove it is active.
- **Overriding a base \`@BeforeMethod\` by accident.** Same method name in child and parent → only the child's runs. Distinct names, or \`final\` base methods.
- **Interceptor that loses tests.** Returning a filtered list without logging removes tests from every report. Log removed methods and assert expected totals in CI.
- **\`ITestContext\` attributes written by parallel tests.** Races between tests. Write once before the parallel phase, read-only afterwards, immutable values.
- **\`timeOut\` on UI tests with a ThreadLocal driver** → \`NullPointerException\` in the test body. Remove it or switch to job-level timeouts.

## Best practices for experienced engineers

- Keep tests **independent**; use \`dependsOn*\` only as a skip guard in rare end-to-end chains, never for sequencing.
- Every base-class configuration method: \`alwaysRun = true\`, distinctive name, small and idempotent; set \`configfailurepolicy="continue"\` for browser suites.
- Put cross-cutting behaviour into **one** framework package of listeners registered in **one** place (ServiceLoader in the framework JAR or a shared \`<listeners>\` block). Every listener is defensive: it never throws, never changes the outcome by accident, and logs that it is active.
- Prefer \`Iterator<Object[]>\` for large or freshness-sensitive data, parameter objects with \`toString()\` for readable reports, \`indices\` for debugging.
- Track **skips** and **retries** as first-class metrics; a growing skip count is a failing suite in disguise.
- Write unit tests for your listeners with a programmatic \`TestNG\` run on tiny fixture classes — framework code deserves tests too.

## Equivalent in the other stacks

- **JUnit 5** has no suite XML, no dependencies and no priorities by design; its extension model (\`ParameterResolver\`, callbacks, \`InvocationInterceptor\`) replaces listeners, \`IHookable\` and injection — see \`framework-deep-junit5-vs-testng-assertions\`.
- **Playwright Test (TypeScript)**: projects ≈ \`<test>\` blocks, \`test.describe.configure({ mode: 'serial' })\` ≈ dependencies (a failure skips the rest), fixtures ≈ configuration methods plus injection, custom reporters ≈ \`IReporter\`/\`ITestListener\` (\`pw-deep-fixtures-pom-components\`, \`pw-deep-reporting-debugging\`).

## Interview questions

### Q: Walk me through how TestNG executes a suite.

**Short answer (30–60 s):** TestNG builds an \`XmlSuite\`/\`XmlTest\` model from testng.xml, Surefire or code; \`IAlterSuiteListener\` can change it. It reads annotations (transformers can rewrite them), creates instances (factories), selects methods by groups, builds the dependency graph, lets an \`IMethodInterceptor\` reorder free methods, then runs each \`<test>\` sequentially or on a pool: configuration methods, data provider rows, test invocation, retry, listeners. Reporters run at the end.

**Detailed answer:** I would mention that everything is computed before execution, which is why "dynamic" changes must go into \`alter\`, \`transform\` or \`intercept\`; that \`<test>\` is the unit of ordering, \`@BeforeTest\` and \`ITestContext\`; and that results are \`ITestResult\` objects with SUCCESS/FAILURE/SKIP (+ success-percentage failure), skips usually meaning an upstream configuration or dependency failure. I would show which hook I use for which need (the "where to put cross-cutting behaviour" table).

### Q: How does TestNG decide the order of test methods?

**Short answer (30–60 s):** Selection by groups first, then the dependency graph; free methods are ordered by priority (lower first, default 0) and then by method name; \`preserve-order\` keeps classes in XML order; an interceptor can reorder free methods; parallel modes make order a start order only.

**Detailed answer:** Add the skip semantics: hard dependencies skip dependents (cascading), \`alwaysRun\` on a test makes it a soft dependency, \`ignoreMissingDependencies\` stops group-filtered runs breaking. Then the senior position: ordering features are for rare guards; tests must be independent so they can run alone, in any order and in parallel. Cross-class priority behaviour has changed between versions — never rely on it.

### Q: \`@Factory\` vs \`@DataProvider\` — when do you use which?

**Short answer (30–60 s):** A data provider multiplies one method with rows; a factory multiplies the whole class — each instance has its own fields, \`@BeforeClass\` and all tests. Use a factory when several tests share per-variant set-up (session per account, catalogue per locale); a data provider for many inputs to one behaviour.

**Detailed answer:** Factories can be constructors with a static \`dataProvider\` (supports \`indices\`) or methods returning \`Object[]\` of instances. Combine with \`parallel="instances"\` so each instance stays on one thread (one browser per instance) and \`group-by-instances\` for sequential runs. Implement \`ITest\` to name instances in reports. Cost: \`@BeforeClass\` per instance, and data providers for factories must be static.

### Q: How would you apply a retry analyzer to every test without editing them?

**Short answer (30–60 s):** An \`IAnnotationTransformer\` that calls \`annotation.setRetryAnalyzer(...)\` for every \`@Test\` without its own analyzer, registered in testng.xml, \`-listener\` or ServiceLoader — not with \`@Listeners\`, which ignores transformers.

**Detailed answer:** Add an opt-out annotation for tests that must never retry (payments, order placement — retries could duplicate orders), keep the policy narrow (infrastructure exceptions only, max one retry, as designed in \`java-deep-exception-design\`), and make retries visible: retried attempts are SKIP results with \`wasRetried()\`; a reporter shows retry counts per test so flakiness is tracked rather than hidden.

### Q: What is the difference between \`ITestListener\`, \`IInvokedMethodListener\`, \`IHookable\` and \`IReporter\`?

**Short answer (30–60 s):** \`ITestListener\` observes test results (start/success/failure/skip) and \`<test>\` start/finish; \`IInvokedMethodListener\` observes every invocation including configuration methods; \`IHookable\` replaces the invocation — you must call \`runTestMethod\` — so it can wrap the body; \`IReporter\` runs once at the end with all results.

**Detailed answer:** Pick by need: evidence on failure → \`ITestListener\` (plus \`IConfigurationListener\` for set-up failures); timing or MDC for configuration methods too → \`IInvokedMethodListener\`; context that must surround the body on the same thread → \`IHookable\`/\`IConfigurable\`; aggregated output → \`IReporter\`. Mention the risks: an \`IHookable\` that forgets \`runTestMethod\` makes tests pass, listeners that throw can break runs, and \`@Listeners\` registers suite-wide.

### Q: Why are 120 tests skipped when only one thing is broken?

**Short answer (30–60 s):** A configuration failure cascades: a failed \`@BeforeSuite\`/\`@BeforeTest\`/\`@BeforeClass\` skips everything under it, and with the default \`configfailurepolicy="skip"\` a failed \`@BeforeMethod\` also skips the following tests of that class. Or a failed dependency skips its chain, or a data provider threw.

**Detailed answer:** I look at failed configurations first (\`IConfigurationListener\`, \`getFailedConfigurations()\` in a reporter), fix the root cause, and harden: \`configfailurepolicy="continue"\` for browser suites, \`alwaysRun\` on base configuration, data-provider failures propagated as failures, dashboards that show configuration failures separately.

### Q: How do you share data between tests in TestNG, and what are the risks?

**Short answer (30–60 s):** \`ITestContext\` (per \`<test>\`) or \`ISuite\` (suite-wide) attributes, set in a configuration method and read in tests via injected \`ITestContext\`. Risks: shared mutable map in parallel runs, untyped keys, coupling to the run structure.

**Detailed answer:** Write once before the parallel phase, store immutable values, wrap access in a typed helper, never store per-test state there. For expensive shared resources a thread-safe lazy holder is usually better; per-test data should be created per test (\`framework-test-data-and-independence\`).

### Q: How does SoftAssert work internally, and how would you add screenshots to soft failures?

**Short answer (30–60 s):** \`Assertion.doAssert\` wraps each \`IAssert\` command with hooks; \`SoftAssert\` overrides \`doAssert\` to catch \`AssertionError\`, call \`onAssertFailure\` and store the error; \`assertAll\` throws them together. Subclass \`SoftAssert\` and override \`onAssertFailure(IAssert<?>, AssertionError)\` to capture a screenshot at the moment of each failure.

**Detailed answer:** Screenshots at \`assertAll\` time show the final page, not the state when the check failed. The capture must never throw (catch and log), the soft assert must be created per test, and \`assertAll\` must be called — a static-analysis rule or a base-class \`@AfterMethod\` guard can enforce it.

## Scenario-based questions

**1. The nightly regression shows 3 failures and 140 skips after a TestNG upgrade.** I would first compare per-status counts and the total test count with the previous build, then list failed configuration methods. Typical causes after an upgrade: a base-class configuration method now not run for a group selection (needs \`alwaysRun\`), a listener implementing a removed "2" interface no longer registered, retried attempts now counted as skips, or a data provider failing on stricter argument matching. I would fix root causes, add a reporter that separates configuration failures and retries, and add a CI check that fails when the total test count drops unexpectedly.

**2. The team wants "smoke tests first, then the rest" in one CI job, and a \`-Dthreads\` switch for local debugging.** I would add a \`@Smoke\` annotation with a \`SmokeFirstInterceptor\` and an \`IAlterSuiteListener\` reading \`-Dthreads\`, register both via ServiceLoader in the framework JAR, and log the effective order and thread count at start. I would explain the trade-off to the team: the interceptor only affects start order in parallel runs; if they need "stop if smoke fails", that is a separate CI stage, not an ordering trick.

**3. A colleague proposes \`timeOut = 30000\` on every UI test "so hung tests don't block CI".** I would point out that \`timeOut\` runs the method on another thread, so the ThreadLocal driver is invisible and tests start failing with \`NullPointerException\`; and that a hung browser is better handled by WebDriver timeouts (page load, script) and a CI job timeout. For API tests without thread-bound state a \`timeOut\` (or an \`IAnnotationTransformer\` applying one to the \`api\` group) is fine.

## Tricky follow-ups

- **Q: Does \`priority\` skip anything?** No. Only dependencies (and configuration failures) cause skips.
- **Q: Can an \`IMethodInterceptor\` reorder a method that has \`dependsOnMethods\`?** No — only free methods are passed to it.
- **Q: How many times does \`@BeforeClass\` run for a class created by a factory with 4 rows?** Four — once per instance.
- **Q: Is \`@Listeners\` on one class scoped to that class?** No, the listener is registered for the whole suite.
- **Q: What status does a retried attempt get?** SKIP, with \`wasRetried()\` = \`true\`; only the last attempt carries the final status.`,
  keyPoints: [
    'TestNG builds the whole plan first: XmlSuite/XmlTest model → IAlterSuiteListener → annotations (+ IAnnotationTransformer) → factories → group selection → dependency graph → IMethodInterceptor → execution → listeners → IReporter.',
    'Ordering: dependencies first, then priority (lower first, default 0), then method name; preserve-order keeps XML class order; parallel mode turns order into start order. Never rely on cross-class priority.',
    'Hard dependencies and configuration failures turn into SKIP cascades; alwaysRun on a @Test makes a soft dependency, alwaysRun on configuration methods makes them run for every group selection.',
    '@Factory multiplies a class (own fields and @BeforeClass per instance, parallel="instances", ITest names); @DataProvider multiplies a method (Iterator for lazy rows, indices to debug, parallel rows, injected Method/ITestContext).',
    'Register IAnnotationTransformer and IAlterSuiteListener in testng.xml, -listener or META-INF/services/org.testng.ITestNGListener — @Listeners ignores transformers and registers listeners suite-wide.',
    'IHookable/IConfigurable wrap execution and must call the callback; listeners observe; IReporter sees final results including retried attempts (SKIP with wasRetried()).',
    'SoftAssert routes every check through doAssert and the onAssertFailure hook — subclass it to capture evidence at the moment of each soft failure.',
    'timeOut runs the method on another thread (ThreadLocal driver is null); TestNG 7.6+ needs Java 11; count results per status after every upgrade.',
  ],
  mistakes: [
    'Registering an IAnnotationTransformer with @Listeners and wondering why the global retry never applies. Fix: register it in testng.xml <listeners>, with -listener or via ServiceLoader, and log from its constructor to prove it is active.',
    'Smoke job fails with NullPointerException on the driver while the full run is green — the base @BeforeMethod is not in the included group. Fix: alwaysRun = true on every base-class configuration method.',
    'Treating 140 SKIPs as noise. Fix: list failed configuration methods first (IConfigurationListener or getFailedConfigurations() in a reporter); one @BeforeClass failure or a throwing data provider explains most skips; consider configfailurepolicy="continue" for browser suites.',
    'Adding timeOut to UI tests and getting NullPointerException from DriverManager.get(). Fix: timeOut executes on a separate thread, so ThreadLocal state is invisible; use WebDriver timeouts, explicit waits and a CI job timeout instead.',
    'An IHookable or IMethodInterceptor that silently changes results — forgetting callBack.runTestMethod makes tests pass, returning a filtered list removes tests from reports. Fix: unit-test framework hooks with a programmatic TestNG run and log every filtered method.',
    'Child class declares @BeforeMethod setUp() with the same name as the base class method, so the parent\'s browser start never runs. Fix: distinctive or final configuration method names in base classes.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`, API on \`http://localhost:5181\`): (1) write \`CheckoutFlowOrderTest\` from the lesson, predict the order and statuses on paper, run it and compare; then add \`ignoreMissingDependencies\` experiments by running only one group. (2) Build \`SortOrderTest\` as a constructor \`@Factory\` over \`az\`, \`za\`, \`lohi\`, \`hilo\` with \`ITest\` names; run it with \`parallel="instances"\` and then with \`indices = {3}\` to debug only \`hilo\`. (3) Add \`SmokeFirstInterceptor\`, \`GlobalRetryTransformer\`, \`CompactSummaryReporter\` and \`ThreadCountFromPropertyListener\`, register them once via \`META-INF/services/org.testng.ITestNGListener\`, and run \`mvn test -Dthreads=1\` and \`-Dthreads=4\` — check the \`[alter]\` log line and \`compact-summary.md\`. (4) Put a deliberate wrong expectation into a \`ScreenshotSoftAssert\` check on the checkout overview (\`#summary-total\`) and confirm one screenshot per soft failure. (5) Add \`timeOut = 10000\` to a UI test that uses a ThreadLocal driver and explain the failure you get.`,
  problems: ['fw-015', 'fw-029', 'fw-031', 'fw-035'],
}
