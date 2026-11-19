export default {
  slug: 'framework-testng-annotations',
  category: 'framework',
  order: 2,
  title: 'TestNG annotations and the test lifecycle',
  minutes: 10,
  summary: 'Know exactly when each @Before/@After annotation runs, how many times, and which one to use for browsers, config and reports.',
  manualAnalogy: `A manual regression cycle has layers of preparation: once per release you set up the environment, once per test suite you prepare data, before each test case you reset to the home page, after each one you log out. TestNG annotations are those layers. You label a method with the layer it belongs to and TestNG calls it at the right moment.`,
  body: `## Annotations are labels

An annotation is a word starting with \`@\` placed above a method. TestNG scans your classes, reads the labels and decides when to call each method. You never call them yourself.

\`\`\`java
public class CartTest {
    @BeforeMethod
    public void openBrowser() { ... }

    @Test
    public void emptyCartShowsMessage() { ... }

    @AfterMethod(alwaysRun = true)
    public void closeBrowser() { ... }
}
\`\`\`

## The hierarchy: suite → test → class → method

Start with how \`testng.xml\` is shaped (the *testng.xml* lesson goes deeper):

\`\`\`xml
<suite name="ShopEasy">            <!-- the whole run -->
  <test name="Chrome smoke">       <!-- a group of classes, NOT a @Test method -->
    <classes>
      <class name="com.shopeasy.tests.LoginTest"/>
      <class name="com.shopeasy.tests.CartTest"/>
    </classes>
  </test>
</suite>
\`\`\`

Each level has a before and an after:

| Annotation | Runs | Typical use |
|---|---|---|
| \`@BeforeSuite\` / \`@AfterSuite\` | once for the entire run | load config, create the report, flush the report |
| \`@BeforeTest\` / \`@AfterTest\` | once per \`<test>\` tag in testng.xml | settings for that block (e.g. a browser parameter) |
| \`@BeforeClass\` / \`@AfterClass\` | once per test class | expensive set-up shared by that class's tests |
| \`@BeforeMethod\` / \`@AfterMethod\` | before/after **every** \`@Test\` method | fresh browser, log in, screenshots, quit |

Order, outermost first: **Suite → Test → Class → Method → @Test → Method → Class → Test → Suite** (the "after" half mirrors the "before" half).

## The \`@BeforeTest\` confusion

The name sounds like "before each test method". It is not. It runs before each **\`<test>\` tag** in testng.xml. With one \`<test>\` tag it runs once, no matter how many \`@Test\` methods there are. "Before each test method" is \`@BeforeMethod\`.

## Counting runs

Suppose one \`<test>\` contains \`LoginTest\` (3 test methods) and \`CartTest\` (2 test methods):

- \`@BeforeSuite\`: 1 time
- \`@BeforeTest\`: 1 time
- \`@BeforeClass\`: once per test class that has (or inherits) it
- \`@BeforeMethod\`: once per test method of its class — if it lives in a shared \`BaseTest\` that both classes extend, 5 times in total

Being able to do this arithmetic is a common interview question.

## Where should the browser start?

| Choice | Effect |
|---|---|
| \`@BeforeSuite\` | One browser for everything — tests leak state into each other; impossible in parallel |
| \`@BeforeClass\` | One browser per class — methods of the class share it; breaks with \`parallel="methods"\` |
| \`@BeforeMethod\` | A fresh browser per test — independent tests, parallel-safe with a ThreadLocal driver |

Most frameworks choose \`@BeforeMethod\` + \`@AfterMethod(alwaysRun = true)\`. It is slower than sharing, but independence is worth far more than a few seconds.

## When set-up fails

If a \`@BeforeMethod\` throws an exception, TestNG does **not** run the related test — it marks it **SKIPPED** (a configuration failure), not FAILED. Watch for long lists of skips in a report: the root cause is usually one broken set-up method, not many broken tests.

\`alwaysRun = true\` on an \`@After...\` method means "run even if earlier set-up or the test failed", so clean-up still happens.

## Useful @Test attributes

\`\`\`java
@Test(groups = {"smoke"}, priority = 1, description = "Valid user sees inventory")
@Test(dependsOnMethods = "login")          // skip if login failed
@Test(enabled = false)                     // temporarily switched off
@Test(expectedExceptions = IllegalArgumentException.class)
\`\`\`

\`priority\` and \`dependsOnMethods\` create order between tests — use them sparingly. Independent tests that can run in any order are easier to parallelise and debug.

## Inheritance

Annotated methods in a parent class (like \`BaseTest\`) run for every subclass. That is how one \`@BeforeMethod\` in \`BaseTest\` gives every test class a browser.

When both parent and child have a \`@BeforeMethod\`, TestNG runs the **parent's first**, then the child's; the \`@After...\` methods run the other way round, child first. Think of nested brackets: the parent opens the browser before the child logs in, and the child logs out before the parent quits the browser. An inherited \`@BeforeSuite\` still runs only once per run, however many classes inherit it.

## Which test runs first?

Not the one at the top of the file. Without \`priority\` or dependencies, TestNG sorts the \`@Test\` methods of a class **by name**:

\`\`\`java
@Test public void sortZa()       { ... }   // runs 3rd
@Test public void filterByName() { ... }   // runs 1st
@Test public void sortAz()       { ... }   // runs 2nd
\`\`\`

- \`priority\` reorders: lower first, default \`0\`, negatives allowed. It never skips anything.
- \`dependsOnMethods\` reorders **and** skips the dependent test when the dependency fails.

## Why tests should not need an order

If test B only passes because test A ran first (A logged in, A added the product, A stored a page in a \`static\` field), you get:

| Problem | What you see |
|---|---|
| one bug, many red tests | A fails → B and C fail or are skipped |
| no reruns | you cannot run B alone to debug it |
| no parallel runs | with \`parallel="methods"\` B starts before A finishes |

The fix is **independence**: every test creates its own preconditions — in \`@BeforeMethod\`, through a helper, or with a fast shortcut below the UI such as an API call or writing the cart into the browser's storage — and keeps its state in local variables. Use the UI only for the behaviour the test is about. (The *Test data and independence* lesson goes deeper.)`,
  keyPoints: [
    'Order: Suite → Test → Class → Method, and the after-methods mirror it.',
    '`@BeforeTest` runs per `<test>` tag in testng.xml, not per `@Test` method.',
    '`@BeforeMethod` runs before every test method — the usual place for a fresh browser.',
    'A failing `@Before...` method makes the related tests SKIPPED, not FAILED.',
    'Suite-level hooks suit once-per-run work: loading config, creating and flushing reports.',
    'Parent @Before methods run before the child\'s; without priority, test methods run in name order — so write tests that need no order.',
  ],
  mistakes: [
    'Using `@BeforeTest` thinking it runs before each test method — use `@BeforeMethod`.',
    'Starting the browser in `@BeforeSuite` or `@BeforeClass` and then running in parallel — tests share a browser.',
    'Ignoring a sea of SKIPPED tests — look for the one failing configuration method.',
    'Chaining many tests with `dependsOnMethods` — one failure skips the rest; keep tests independent.',
  ],
  tryIt: `Write a tiny class with one method for each of the eight before/after annotations plus two \`@Test\` methods, each printing its own name. Run it and compare the printed order with the table above. Add a second class extending the same parent and predict the new counts before running.`,
  problems: ['fw-002', 'fw-015', 'fw-019', 'fw-027', 'fw-029'],
}
