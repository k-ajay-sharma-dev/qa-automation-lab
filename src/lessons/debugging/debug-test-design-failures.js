export default {
  slug: 'debug-test-design-failures',
  category: 'debugging',
  order: 5,
  title: 'Test design failures: order dependency, shared data, static drivers and wrong comparisons',
  minutes: 9,
  summary: 'Find and fix failures caused by how the tests are written rather than by the app: tests that depend on each other, share a browser or user, share a static driver across threads, or compare values of the wrong type.',
  manualAnalogy: `Two manual testers using the same test account at the same time will "find bugs" that are really each other's actions — one empties the cart while the other is checking it. A good manual test case also lists its own preconditions instead of relying on whatever the previous case left behind. Automated tests need the same discipline, and when they lack it they fail in confusing, intermittent ways.`,
  body: `## The signature: "passes alone, fails in the suite"

If a test is green when you run it by itself and red (sometimes) in the full run or in parallel, the app is rarely the problem. Something is **shared** between tests: a browser, a logged-in session, cart contents, a user account, a static variable, or the execution order.

## 1. Order dependency and leftover state

\`\`\`text
java.lang.AssertionError: Items in overview expected [2] but found [3]
	at com.shopeasy.tests.OverviewTest.overviewListsTwoItems(OverviewTest.java:33)
\`\`\`

Questions to ask:

- Is the browser created once per **class** (\`@BeforeClass\`) and reused by all tests?
- Does the app keep state across pages (cookies, \`localStorage\`, \`sessionStorage\`, server-side cart)? ShopEasy, for example, keeps its cart in the browser's storage.
- Does the result change with the run order? TestNG runs methods in its own order unless you say otherwise; adding tests or running in parallel changes it.

Prove it: run the failing test alone (passes), then together with the test that runs before it (fails). That pair is your evidence.

Fix — **every test arranges its own preconditions** ("Given an empty cart"):

- Fresh browser per test (\`@BeforeMethod\` / \`@AfterMethod(alwaysRun = true)\`), or at minimum reset state at the start of each test (clear storage/cookies, reload).
- Create the data the test needs inside the test or a setup step.
- Avoid \`dependsOnMethods\` / \`priority\` chains that make test B rely on test A's leftovers.

## 2. Shared test data

Four parallel threads all logging in as the same user and editing the same cart will overwrite each other on any app that stores state **on the server**. Fixes: a user per thread or per test, unique data (timestamps / UUIDs in names), or API calls in setup that create fresh records. Classify these as **test bugs** — the app is doing exactly what it was told.

## 3. Static WebDriver in parallel runs

\`\`\`text
[TestNG-PoolService-1] ... Finished scenario -> driver.quit()
org.openqa.selenium.NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?
\`\`\`

Clues: only fails with \`parallel=\` in \`testng.xml\` (or parallel Cucumber); errors mention a **quit** session; actions happen in the "wrong" browser; thread names in the log interleave.

Cause: a \`static WebDriver driver\` field is **one variable for the whole JVM**. Each thread's setup overwrites it, and the first thread to finish quits the browser everyone else is using.

How to confirm: search the framework for \`static WebDriver\`. Run the suite with \`thread-count="1"\` — if it goes green, shared state is confirmed.

Fix: give each thread its own driver with \`ThreadLocal<WebDriver>\` (see the *Browser options, Grid and parallel runs* lesson), quit **and** \`remove()\` in teardown, and make page objects/steps get the driver from that holder — not from a static field.

## 4. Comparing the wrong things

\`\`\`text
java.lang.AssertionError: expected [5] but found [5.0]
java.lang.AssertionError: expected [Qty: 2] but found [2]
\`\`\`

When expected and actual *look* equal, the test is comparing different **types or formats**. Remember:

- Everything \`getText()\` returns is a **String**, including \`$9.99\` and \`3\`. Parse it before comparing with a number. TestNG's \`assertEquals(Object, Object)\` will happily compare a String with a Double — and they are never equal.
- Clean text deliberately: strip currency symbols, thousands separators, labels like "Total:", whitespace.
- **Money** must not be calculated with \`double\`. Binary floating point can't represent most decimals exactly: \`0.1 + 0.2\` is \`0.30000000000000004\`. Use \`BigDecimal\` built from a **String** (\`new BigDecimal("0.10")\`), add/multiply with its methods, and compare with \`compareTo\` (because \`2.0\` and \`2.00\` are different to \`equals\`).

\`\`\`java
BigDecimal tax = new BigDecimal("0.08");
BigDecimal subtotal = new BigDecimal("15.99");
BigDecimal expected = subtotal.multiply(tax).setScale(2, RoundingMode.HALF_UP);
\`\`\`

These failures are **test bugs**, even though they surface as assertion "failures" — fix the comparison, don't raise a defect.

## A design checklist for every new test

| Question | Good answer |
|---|---|
| Can it run alone, first, last, or in parallel? | Yes — it sets up its own state |
| Who else uses its user / data? | Nobody, or nothing it changes |
| Where does the driver come from? | A per-thread holder, created and quit per test |
| Are compared values the same type and format? | Parsed and normalised before \`assertEquals\` |`,
  keyPoints: [
    '"Passes alone, fails in the suite" = shared state or order dependency.',
    'Every test must create its own preconditions; reset browser state between tests.',
    'Parallel + same user/data = tests overwriting each other — a test bug, not a product bug.',
    '`static WebDriver` + parallel = `NoSuchSessionException`; use ThreadLocal, quit and remove.',
    '`getText()` is always a String; parse it, and use `BigDecimal` (compareTo) for money.',
  ],
  mistakes: [
    'Fixing an order-dependent test by forcing the order with `priority` or `dependsOnMethods`.',
    'Turning parallel off "for now" instead of removing the static driver.',
    'Comparing `"$12.50"` with `12.5` and raising a pricing defect.',
    'Creating `new BigDecimal(29.99)` from a double — it carries the double\'s error. Use the String constructor.',
  ],
  tryIt: `In jshell (or any Java main), print \`0.1 + 0.2\`, then \`new BigDecimal("0.1").add(new BigDecimal("0.2"))\`, then \`new BigDecimal(0.1)\`. The three results explain why money assertions use String-built BigDecimals.`,
  problems: ['dbg-007', 'dbg-009', 'dbg-012', 'dbg-030'],
}
