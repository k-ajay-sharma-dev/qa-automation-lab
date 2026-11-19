export default {
  slug: 'debug-reading-stack-traces',
  category: 'debugging',
  order: 1,
  title: 'Reading a stack trace and a Jenkins / Surefire console log',
  minutes: 9,
  summary: 'Read a failed build like a senior SDET: find the exception and message, the first line in your own code, the deepest "Caused by", and what the Tests run / Failures / Errors / Skipped numbers really mean.',
  manualAnalogy: `A defect report you trust has a title, the actual result, the exact step where it went wrong and the evidence. A stack trace is the automation version of that report — it just looks scary because it is written by the JVM, not by a person. Once you know where each part sits, you can read one in under a minute.`,
  body: `## Anatomy of one failure

\`\`\`text
[ERROR] applyCouponReducesTotal(com.shopeasy.tests.CouponTest)  Time elapsed: 12.4 s  <<< ERROR!
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of element located by By.id: coupon-message (tried for 10 second(s) with 500 milliseconds interval)
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
	at org.openqa.selenium.support.ui.WebDriverWait.timeoutException(WebDriverWait.java:84)
	at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)
	at com.shopeasy.pages.CouponWidget.readMessage(CouponWidget.java:38)
	at com.shopeasy.tests.CouponTest.applyCouponReducesTotal(CouponTest.java:27)
	at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(...)
	at org.testng.internal.invokers.MethodInvocationHelper.invokeMethod(...)
\`\`\`

Read it in this order:

1. **The header line** — which test (\`applyCouponReducesTotal\` in \`CouponTest\`) and how long it took. 12.4 s for a 10 s wait is normal; 31 s for a 10 s wait is a clue (see the *Timing failures* lesson).
2. **The exception name** — \`TimeoutException\`: a wait gave up. Not "element missing", not "assert failed".
3. **The message** — *what* it waited for: visibility of \`#coupon-message\`, 10 seconds.
4. **The \`at\` lines (the call stack)** — a list of method calls, **most recent first**. Skip the \`org.openqa...\`, \`java.base...\` and \`org.testng...\` lines: that is library plumbing. The **first line in your own package** (\`com.shopeasy...\`) is where *your* code was when it broke: \`CouponWidget.java:38\`. The line under it shows who called that method (\`CouponTest.java:27\`).

That gives you a precise bug report: *"CouponTest line 27 → CouponWidget.readMessage line 38 waited 10 s for #coupon-message to be visible and it never was."* Next step: open the failure screenshot and see what the page showed instead.

## "Caused by:" — follow the chain to the bottom

Java exceptions can wrap other exceptions. Frameworks catch a low-level error and re-throw a higher-level one, adding \`Caused by:\` sections:

\`\`\`text
java.lang.RuntimeException: Could not create page objects
	at com.shopeasy.hooks.Hooks.setUp(Hooks.java:22)
Caused by: java.lang.IllegalStateException: Base URL not configured
	at com.shopeasy.config.Settings.baseUrl(Settings.java:15)
Caused by: java.lang.NullPointerException: Cannot invoke "String.trim()" because "raw" is null
	at com.shopeasy.config.Settings.read(Settings.java:31)
\`\`\`

The top line is just the *last* layer that complained. The **deepest \`Caused by:\`** is usually where things really started: here a setting was \`null\` — perhaps the environment variable or properties file was not provided on this agent. Fixing the top symptom ("page objects") would get you nowhere.

## Failures vs Errors vs Skipped (Surefire summary)

Maven Surefire prints a summary per class and for the whole run:

\`\`\`text
[ERROR] Tests run: 60, Failures: 4, Errors: 1, Skipped: 12
\`\`\`

| Number | Means | Typical cause |
|---|---|---|
| **Failures** | An assertion said "wrong value" (\`AssertionError\`) | The app showed something unexpected — or the expectation is outdated |
| **Errors** | An unexpected exception (Selenium, NullPointer, I/O…) | Locators, timing, environment, code bugs |
| **Skipped** | The test **never ran** | A \`@BeforeMethod\`/\`@BeforeClass\` failed, a dependency failed, or it was disabled |

Skipped tests are not "passed" and not "bugs found". In TestNG, when a configuration method (\`@BeforeClass\`, \`@BeforeMethod\`) fails, every test that depends on it is skipped. So a large Skipped count usually points to **one** setup failure — scroll up and find a line like:

\`\`\`text
[ERROR] loginAsAdmin(com.shopeasy.tests.AdminTest)  <<< FAILURE!   ← a @BeforeClass method
\`\`\`

Fix that one, and the skipped tests come back.

## A quick note on assertion messages

An assertion failure reads \`expected [X] but found [Y]\`. Compare the two **types** and **formats**, not only values: \`expected [10] but found [10.0]\`, or a currency symbol on one side, means the test compares the wrong things — a test bug, not a product bug.

## Where else to look in a Jenkins build

- **Console Output** — the raw log you've just learned to read. Use the browser's Ctrl+F for \`<<< FAILURE\`, \`<<< ERROR\` and \`Caused by\`.
- **Test Result** page (JUnit/TestNG plugin) — the same failures grouped by class, with history ("failing for 3 builds").
- **Archived artifacts** — screenshots, HTML/Cucumber reports, logs.
- **Changes** — which commits went into this build. A failure that started right after a change to \`CheckoutPage.java\` is a strong hint.

## Long, parallel logs: find the first failure in time

When tests run on several threads, their lines are **interleaved**, and the Surefire *Results* list at the end is grouped by class — not by time. With 40 red tests, don't start at the top of that list. Instead:

- Read **chronologically** (Jenkins' Timestamper plugin, or a log pattern with time and thread name).
- Look at what happened **before** the first failure — setup hooks, data resets, logins. A root cause is sometimes only a \`WARN\` line ("reset returned 405 — continuing").
- Know your **noise**: lines like \`SLF4J(W): No SLF4J providers were found\` or Selenium's CDP-version warning appear in green builds too. Compare with the last green build.
- **Group** failures by exception + message. Forty failures usually collapse into two or three groups; then check whether each group is explained by the earliest problem.

## The 60-second routine

1. Summary numbers → is this one failure, many, or a setup failure causing skips?
2. For each failure: exception name → message → first line in your package → deepest \`Caused by\`.
3. Open the screenshot / report for that test.
4. Only now open the code.`,
  keyPoints: [
    'Read: test name → exception name → message → first `at` line in your own package.',
    'The call stack is most-recent-first; skip library frames (`org.openqa`, `java.base`, `org.testng`).',
    'The deepest `Caused by:` is usually the root cause; the top line is just the last wrapper.',
    'Failures = assertions, Errors = unexpected exceptions, Skipped = never ran (often a failed @Before method).',
    'Always pair the log with the screenshot before touching code.',
  ],
  mistakes: [
    'Reading only the first line and "fixing" the wrapper instead of the root `Caused by`.',
    'Reporting "46 failures = 46 bugs" when most were skipped because one setup method failed.',
    'Opening the Selenium source file named in the top `at` line — it is library code; look for your package.',
  ],
  tryIt: `Take any red build log you have (or the excerpts in this section's problems). Highlight, in three colours: the exception name, the first line in a \`com.\` package of your project, and the last \`Caused by\`. Practise until it takes under a minute.`,
  problems: ['dbg-015', 'dbg-001', 'dbg-012', 'dbg-027', 'dbg-029', 'dbg-036'],
}
