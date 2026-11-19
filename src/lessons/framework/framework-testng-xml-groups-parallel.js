export default {
  slug: 'framework-testng-xml-groups-parallel',
  category: 'framework',
  order: 5,
  title: 'testng.xml: suites, groups, parameters and parallel runs',
  minutes: 8,
  summary: 'Write a testng.xml that selects tests by group, passes parameters such as the browser, registers listeners and runs tests in parallel safely.',
  manualAnalogy: `A manual test plan says which cases are in this cycle: "smoke only today", "full regression before release", "skip the cases marked blocked". testng.xml is that test plan for automation. The tests stay the same; the XML decides which ones run, with which settings, and how many at once.`,
  body: `## Tagging tests with groups

First, label tests in Java:

\`\`\`java
@Test(groups = {"smoke", "regression"})
public void validUserSeesProducts() { ... }

@Test(groups = {"regression"})
public void sortHighToLow() { ... }

@Test(groups = {"regression", "wip"})
public void editEmployeeSalary() { ... }   // still being written
\`\`\`

A test can belong to several groups. Groups are free text — agree on a small vocabulary as a team (\`smoke\`, \`regression\`, \`wip\`, \`checkout\`…).

## Anatomy of testng.xml

\`\`\`xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy Regression" parallel="classes" thread-count="3">   <!-- 1 -->

  <listeners>                                                              <!-- 2 -->
    <listener class-name="com.shopeasy.listeners.ExtentReportListener"/>
  </listeners>

  <parameter name="browser" value="firefox"/>                              <!-- 3 -->

  <test name="Regression on Firefox">                                      <!-- 4 -->
    <groups>
      <run>
        <include name="regression"/>
        <exclude name="wip"/>
      </run>
    </groups>
    <packages>
      <package name="com.shopeasy.tests"/>                                 <!-- 5 -->
    </packages>
  </test>
</suite>
\`\`\`

1. **\`<suite>\`** is the whole run. \`parallel\` and \`thread-count\` control concurrency (below).
2. **\`<listeners>\`** registers classes that react to test events — screenshots, reports, retries (see the *Listeners, reports and logging* lesson).
3. **\`<parameter>\`** passes a value to any method annotated with \`@Parameters("browser")\`. Parameters can sit on the suite or on a single \`<test>\` (the inner one wins).
4. **\`<test>\`** is a block of classes with shared settings. You could add a second \`<test>\` with \`browser=chrome\` to run the same tests in both browsers.
5. **\`<packages>\`** includes every class in a package; \`<classes><class name="..."/></classes>\` lists them one by one instead.

## Include and exclude

- \`<include>\`: only tests in these groups run.
- \`<exclude>\`: tests in these groups never run — **exclude wins** when a test is in both.
- Configuration methods (\`@BeforeMethod\` etc.) belong to groups too. If your \`BaseTest\` set-up is skipped when filtering by group, add \`alwaysRun = true\` to it so it runs whatever group is selected.

## Reading parameters in Java

\`\`\`java
@BeforeMethod
@Parameters("browser")
public void setUp(@Optional("chrome") String browser) {
    DriverManager.initDriver(browser);
}
\`\`\`

\`@Optional\` gives a default so the class still runs when started from the IDE without the XML.

## Parallel modes

| \`parallel=\` | What runs at the same time | Needs |
|---|---|---|
| \`methods\` | individual \`@Test\` methods, even from the same class | a browser per method (\`@BeforeMethod\` + ThreadLocal) |
| \`classes\` | whole classes; methods inside one class run in sequence | each class independent |
| \`tests\` | each \`<test>\` block (e.g. Chrome block and Firefox block) | blocks independent |
| \`instances\` | separate instances of the same class | rarely used |

\`thread-count\` is the maximum number of threads. More is not always faster — each thread opens a real browser. On a laptop 3–4 is typical; on CI it depends on CPU and memory.

Data providers have their own setting: \`data-provider-thread-count\` on the suite, used by \`@DataProvider(parallel = true)\`. The reference framework uses this to run Cucumber scenarios in parallel.

## Cross-browser: one \`<test>\` block per browser

A \`<parameter>\` placed **inside** a \`<test>\` applies only to that block and overrides a suite-level one with the same name. That gives a cross-browser plan without copying any test class:

\`\`\`xml
<suite name="Checkout on two browsers" parallel="tests" thread-count="2">
  <test name="Checkout - Edge">
    <parameter name="browser" value="edge"/>
    <classes><class name="com.shopeasy.tests.CheckoutTest"/></classes>
  </test>
  <test name="Checkout - Chrome">
    <parameter name="browser" value="chrome"/>
    <classes><class name="com.shopeasy.tests.CheckoutTest"/></classes>
  </test>
</suite>
\`\`\`

\`parallel="tests"\` runs the two blocks side by side, and the report keeps them apart under their \`<test>\` names. The set-up method reads the value with \`@Parameters\` (plus \`@Optional\` for IDE runs) and hands it to the driver factory — the test classes never mention a browser. On CI a pipeline matrix that passes \`-Dbrowser\` is the alternative (see the *Command line and CI* lesson).

## Parallel safety checklist

Parallel runs expose shared state. Before turning it on:

- Driver stored in a \`ThreadLocal\`, created in \`@BeforeMethod\`, quit and removed in \`@AfterMethod(alwaysRun = true)\`.
- No \`static\` fields holding pages, test data or report objects shared between tests.
- Tests do not depend on each other's data (two tests editing the same employee row will collide).
- Reports/loggers that keep per-test objects use a \`ThreadLocal\` too.

## Several suite files

Teams often keep \`smoke.xml\` and \`regression.xml\`. Choose one at run time: \`mvn test -Dsurefire.suiteXmlFiles=smoke.xml\`, or run groups directly with \`mvn test -Dgroups=smoke\` (see the *Command line and CI* lesson).`,
  keyPoints: [
    'Label tests with `@Test(groups = ...)`; testng.xml includes and excludes groups — exclude wins.',
    '`<parameter>` values reach methods annotated with `@Parameters`; `@Optional` supplies a default.',
    '`<listeners>` registers reporting/screenshot/retry classes for the whole suite.',
    '`parallel` = methods / classes / tests, capped by `thread-count`.',
    'Parallel only works when the driver and other per-test state are ThreadLocal or local.',
  ],
  mistakes: [
    'Filtering by group and seeing every test fail with a null driver — the `@BeforeMethod` was filtered out; add `alwaysRun = true`.',
    'Turning on `parallel="methods"` with a driver created in `@BeforeClass` or held in a static field.',
    'Setting `thread-count` to 20 on a laptop — browsers starve each other and tests time out.',
    'Typos in class or package names — TestNG may silently run zero tests; check the run count.',
  ],
  tryIt: `Take three tests you know and decide for each: which groups would you give it? Then write, on paper, the \`<run>\` block that runs "everything in checkout except work in progress". Compare with the anatomy above.`,
  problems: ['fw-005', 'fw-002', 'fw-017'],
}
