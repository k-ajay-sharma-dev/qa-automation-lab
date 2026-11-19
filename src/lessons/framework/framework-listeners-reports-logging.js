export default {
  slug: 'framework-listeners-reports-logging',
  category: 'framework',
  order: 7,
  title: 'Listeners, screenshots, retries, reports and logging',
  minutes: 10,
  summary: 'Use TestNG listeners to capture screenshots on failure, retry flaky tests responsibly, build an HTML report with ExtentReports, and replace println with Log4j2 logging.',
  manualAnalogy: `A good manual defect has evidence: a screenshot, the steps you took, the environment, and whether it reproduces on a second try. Listeners, reports and logs are how automation collects the same evidence — automatically, for every test, without anyone adding code to the tests themselves.`,
  body: `## Listeners: code that reacts to test events

A **listener** is a class TestNG calls when something happens: a test starts, passes, fails, is skipped; the run starts or finishes. You implement an **interface** — a list of methods TestNG promises to call — and only fill in the ones you need (they have empty defaults).

\`\`\`java
public class TestListener implements ITestListener {

    @Override
    public void onTestStart(ITestResult result) {
        log.info("START {}", result.getMethod().getMethodName());
    }

    @Override
    public void onTestFailure(ITestResult result) {
        // take and save a screenshot, never throw from here
    }
}
\`\`\`

\`ITestResult\` describes the test: \`getMethod().getMethodName()\`, \`getTestClass().getName()\`, \`getThrowable()\` (the exception that failed it), \`getParameters()\` (DataProvider row).

Register a listener once for the whole suite in testng.xml \`<listeners>\` (or with \`@Listeners\` on a class). Tests never call it.

## Screenshot on failure

The recipe for \`onTestFailure\`:

1. Get the current thread's driver from \`DriverManager.getDriver()\` — not a static field — so parallel tests screenshot their own browser.
2. Cast it: \`((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE)\` (or \`BYTES\`, or \`BASE64\` for embedding in a report).
3. Build a unique file name — class, method and a timestamp — so parallel failures do not overwrite each other.
4. \`Files.createDirectories(...)\` then \`Files.copy\` / \`Files.write\` into \`target/screenshots/\`.
5. Wrap it all in \`try/catch\` and log problems. A listener that throws can hide the real failure or break the run.

Ordering matters: the listener must run **before** \`@AfterMethod\` quits the browser. TestNG calls \`onTestFailure\` before the after-method, so this works; just do not quit the driver inside the test.

## Retrying flaky tests — a band-aid

\`IRetryAnalyzer\` has one method, \`retry(ITestResult)\`. TestNG calls it after a failure; return \`true\` to run the test again, \`false\` to accept the failure. Keep a counter and a maximum (from config, default 1). Returning \`true\` unconditionally retries **forever**.

To avoid annotating hundreds of tests with \`retryAnalyzer = ...\`, an \`IAnnotationTransformer\` listener can set the analyzer on every \`@Test\` as TestNG reads them.

Use retries with care: log every retry, keep the count low, and treat a retried-then-passed test as a defect in the test (missing wait, shared data) to fix, not a success to forget.

## Reports with ExtentReports

TestNG's default report is basic. ExtentReports builds a readable HTML page, driven by a listener:

| Event | Do |
|---|---|
| \`onStart(ITestContext)\` | create one \`ExtentReports\`, attach an \`ExtentSparkReporter("target/extent/...html")\`, add system info (env, browser) |
| \`onTestStart\` | create an \`ExtentTest\` for this method |
| \`onTestSuccess\` / \`onTestFailure\` / \`onTestSkipped\` | mark it \`pass\` / \`fail(throwable)\` + screenshot / \`skip\` |
| \`onFinish\` | \`flush()\` — writes the file; without it the report is empty |

The \`ExtentTest\` for "the current test" must be per thread: store it in a \`ThreadLocal<ExtentTest>\` (same idea as the driver). A single static field makes parallel tests log into each other's entries.

## Allure: steps, labels, attachments

**Allure** is the common alternative. Instead of you writing report code in a listener, the \`allure-testng\` adapter records results into \`target/allure-results\`, and \`allure serve\` (or a CI plugin) builds the site. You enrich it with annotations:

\`\`\`java
@Step("Sort products by {option}")                 // on a page object method
public InventoryPage sortBy(String option) { ... }

@Feature("Inventory") @Severity(SeverityLevel.NORMAL)   // on the test
\`\`\`

- **\`@Step\`** on page methods makes every test read like business steps, with \`{parameter}\` values filled in.
- **Labels** (\`@Epic\`, \`@Feature\`, \`@Story\`, \`@Severity\`) group results for people who do not read Java.
- **\`@Attachment\`** on a method that returns \`byte[]\` (an image) or \`String\` (text) attaches the return value to the current test — call it from \`onTestFailure\` for a screenshot.
- Copying the previous report's \`history\` folder into the new results gives trend graphs.

Gotcha: \`@Step\` and \`@Attachment\` only work when the AspectJ weaver is added as a \`-javaagent\` in Surefire's \`<argLine>\`; without it they are silently ignored.

## Retries and flaky tests: the bigger picture

A retry tells you *that* a test is unstable, not *why*. Typical causes: shared test data in parallel runs, missing waits after the page re-renders, an unstable environment, browser crashes — and sometimes a **real intermittent product bug** (a wrong total once in twenty runs is the application's fault, not the test's). Log every retry, classify failures, quarantine known-flaky tests in their own group with an owner and a ticket, and fix the cause.

## Logging with Log4j2

\`System.out.println\` has no levels, no timestamps, no thread names and cannot be switched off. A logger can:

\`\`\`java
private static final Logger log = LogManager.getLogger(CartPage.class);

log.debug("Clicking {}", locator);                    // low-level detail
log.info("Removing '{}' from cart", productName);     // business step
log.error("Could not open cart", e);                  // failure + stack trace
\`\`\`

- **Levels**: \`trace < debug < info < warn < error\`. \`log4j2.xml\` in \`src/test/resources\` chooses the minimum level and where output goes (console, file). Run at \`info\` in CI, \`debug\` when investigating.
- **\`{}\` placeholders** instead of \`"a" + b\`: the text is only built if that level is enabled, and the code reads cleaner.
- **Exception as the last argument** prints the full stack trace.
- **Never log secrets.** For a password field, log \`"******"\` or the length, not the value. Logs end up in CI artifacts that many people can read.

Logs are best placed in BasePage helpers (every click/type logs once) and in listeners (start/pass/fail), so tests stay clean.`,
  keyPoints: [
    'Listeners implement TestNG interfaces (`ITestListener`, `IRetryAnalyzer`, `IAnnotationTransformer`) and are registered once in testng.xml.',
    'Screenshot on failure: thread-safe driver, unique file name, created folder, never throw from the listener.',
    'Retry with a counter and low maximum; a retry hides a flaky test, it does not fix it.',
    'ExtentReports: one report per run, one ExtentTest per method in a ThreadLocal, `flush()` at the end.',
    'Log4j2 with levels and `{}` placeholders replaces println; mask passwords.',
  ],
  mistakes: [
    'A `retry()` that always returns true — infinite reruns. Count attempts.',
    'Forgetting `flush()` — the report file is missing or empty.',
    'One static `ExtentTest` or driver field in a listener — parallel results get mixed.',
    'Logging `"Typing " + password` — secrets leak into CI logs. Mask them.',
  ],
  tryIt: `Make a deliberately failing test (assert that the cart badge on http://localhost:5180/practice-site/inventory.html shows 5 when the cart is empty). Before writing any listener, write down what evidence you would want in the defect: screenshot, URL, method name, browser, time. Each item maps to one line in \`onTestFailure\` or the report's system info.`,
  problems: ['fw-008', 'fw-009', 'fw-010', 'fw-011', 'fw-024', 'fw-026'],
}
