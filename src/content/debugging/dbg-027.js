export default {
  id: 'dbg-027',
  category: 'debugging',
  kind: 'quiz',
  title: '40 red tests, one root cause: finding the first real failure in a parallel CI log',
  level: 'EXPERT',
  tags: ['ci', 'log-analysis', 'parallel', 'cascading-failures', 'test-data', 'restassured', 'triage'],
  estMinutes: 25,
  scenario: `The ShopEasy nightly runs UI and API scenarios with Cucumber + TestNG on **4 parallel threads** against the shared QA API (\`qa-api.shopeasy.local:5181\`, a long-running instance that is reset with \`POST /api/reset\` at the start of each run). This morning: **Tests run: 118, Failures: 37, Errors: 3**. The release manager wants a verdict by 10:00, and two developers are already "fixing" the cart endpoint because most failures mention the cart. You have the console log. Below are the parts that matter — plus the noise that's always there.`,
  description: `The console (trimmed; timestamps added by Jenkins, threads interleaved):

\`\`\`text
02:00:41 [INFO] --- maven-surefire-plugin:3.2.5:test (default-test) @ shopeasy-tests ---
02:00:42 SLF4J(W): No SLF4J providers were found.
02:00:42 SLF4J(W): Defaulting to no-operation (NOP) logger implementation
02:00:43 [main] INFO  c.s.hooks.GlobalHooks - API base URI = http://qa-api.shopeasy.local:5181
02:00:43 [main] WARN  c.s.hooks.GlobalHooks - Test-data reset returned HTTP 405 {"error":{"code":"METHOD_NOT_ALLOWED","message":"GET is not supported on /api/reset"}} - continuing
02:00:45 [TestNG-PoolService-1] WARNING: Unable to find CDP implementation matching 126
02:00:45 [TestNG-PoolService-1] WARNING: Unable to find version of CDP to use for 126.0.6478.126. You may need to include a dependency on a specific version of the CDP using something similar to org.seleniumhq.selenium:selenium-devtools-v86:4.21.0 where the version ("v86") matches the version of the chromium-based browser you're using
02:00:51 [TestNG-PoolService-2] ERROR c.s.api.CartClient - POST /api/cart/items -> 409 {"error":{"code":"ITEM_ALREADY_IN_CART","message":"Trailblazer Backpack is already in the cart"}}
02:00:51 [TestNG-PoolService-2] Scenario "Add the backpack via API" FAILED: expected status <201> but was <409>
02:00:53 [TestNG-PoolService-3] Scenario "Cart subtotal for backpack and light" FAILED: JSON path subtotal doesn't match. Expected: <39.98F> Actual: <89.97F>
02:00:58 [TestNG-PoolService-2] Scenario "Order from cart" FAILED: JSON path itemCount doesn't match. Expected: <2> Actual: <5>
02:01:02 [TestNG-PoolService-4] Scenario "Order history shows one order" FAILED: JSON path data.size() doesn't match. Expected: <1> Actual: <14>
   ... 33 more failures with 409 ITEM_ALREADY_IN_CART, wrong subtotal/itemCount, wrong order counts, or a user profile still holding values from yesterday's PATCH tests ...
02:07:12 [TestNG-PoolService-4] ERROR c.s.hooks.Hooks - Scenario "Guest sees the size guide" FAILED:
org.openqa.selenium.TimeoutException: timeout: Timed out receiving message from renderer: 298.844
  (Session info: chrome=126.0.6478.126)
02:12:14 [TestNG-PoolService-4] org.openqa.selenium.NoSuchSessionException: invalid session id
02:12:15 [TestNG-PoolService-4] org.openqa.selenium.NoSuchSessionException: invalid session id

[INFO] Results:
[ERROR] Failures:
[ERROR]   AccountApiRunner>AbstractTestNGCucumberTests.runScenario:35 » Assertion expected [Asha] but found [Ashaa]
[ERROR]   CartApiRunner>AbstractTestNGCucumberTests.runScenario:35 » Assertion expected status <201> ...
...
[ERROR] Tests run: 118, Failures: 37, Errors: 3, Skipped: 0
\`\`\`

Answer the questions the way you would brief the release manager.`,
  hints: [
    'Order by TIME, not by the order Surefire lists results in. Look at WARN lines before the first ERROR too.',
    'Ask of every failure: "would this still fail if the data had been reset?"',
    'Separate noise (known harmless warnings) from signal, and look for a second, independent root cause.',
  ],
  questions: [
    {
      q: 'Where should your investigation start?',
      options: [
        'The first entry under "[ERROR] Failures:" in the Results section — AccountApiRunner',
        'The 02:00:43 WARN from GlobalHooks: the test-data reset returned 405 and the run continued anyway',
        'The CDP warnings at 02:00:45, because they are the first lines from a test thread',
        'The renderer timeout at 02:07:12, because it is the only real Selenium exception',
      ],
      answer: 1,
      why: 'The Results section is grouped by runner class (alphabetical), not by time, so its first line says nothing about cause. Reading chronologically, the first anomaly is the reset failing at 02:00:43 — before any scenario ran. It is logged as WARN, not ERROR, which is exactly why people miss it: a root cause doesn\'t have to look like a failure.',
    },
    {
      q: 'Which lines can you safely treat as noise for this incident?',
      options: [
        'The 405 reset warning',
        'The SLF4J "No providers / NOP logger" lines and the "Unable to find CDP implementation" warnings',
        'The 409 ITEM_ALREADY_IN_CART errors',
        'All WARN lines',
      ],
      answer: 1,
      why: 'SLF4J NOP means a logging library has no backend configured — logs from that library are dropped, nothing breaks. The CDP warning only matters if a test uses DevTools features (network interception, console capture through CDP); plain WebDriver commands work. Both appear in every green run too — check a previous successful build to confirm what "normal noise" looks like. "All WARN lines" is exactly the trap: the root cause here is a WARN.',
    },
    {
      q: 'Why do 37 API scenarios show 409 ITEM_ALREADY_IN_CART, subtotal 89.97 instead of 39.98, itemCount 5 and 14 orders in history?',
      options: [
        'The cart endpoint has a regression that double-counts items — raise a P1 defect',
        'Parallel threads interfere with each other because they share standard_user',
        'The shared QA API was not reset: carts and orders from previous runs are still there, so every precondition "empty cart / no orders" is false. The reset helper sent GET to an endpoint that only accepts POST',
        'The API is slow under load, so responses arrive out of order',
      ],
      answer: 2,
      why: 'Every one of those values is consistent with leftover data: the backpack is already in the cart (409), the subtotal and itemCount include earlier items, and order history has 14 orders from earlier runs. The API is behaving correctly for the data it holds. Shared users across threads can cause similar symptoms, but here the 405 at 02:00:43 explains all of them with one cause — fix it and rerun before suspecting anything else. A product defect would need a reproduction on clean data.',
    },
    {
      q: 'Are the 3 errors on TestNG-PoolService-4 (renderer timeout, then two NoSuchSessionException) explained by the missing reset?',
      options: [
        'Yes — all 40 red tests have the same root cause',
        'No — they are an independent problem: Chrome stopped responding (renderer timeout ≈ 300 s, typical of an overloaded agent or a hung page), and the two NoSuchSessionException are consequences on the same thread. Triage the first one separately',
        'No — they are three separate product bugs on the size-guide page',
        'They are noise and can be ignored',
      ],
      answer: 1,
      why: 'A UI scenario on the size-guide page doesn\'t touch the cart API, so it can\'t be explained by the reset. "Timed out receiving message from renderer" means the browser process stopped answering — check agent CPU/memory at 02:07, the screenshot and whether it reproduces. The NoSuchSessionException lines are the classic cascade: later scenarios on that thread used a session that had died. Count them as one environment issue, not three bugs — and don\'t ignore them.',
    },
    {
      q: 'Which change prevents this kind of 40-failure cascade in future runs?',
      options: [
        'Add retryAnalyzer so every failed scenario reruns twice',
        'Make the reset a hard precondition: send POST /api/reset, assert 200 {"status":"RESET"} in the @BeforeAll/@BeforeSuite hook, and abort the run with a clear message if it fails — plus a health-check/smoke stage before the suite',
        'Lower the log level so WARN lines are not printed',
        'Run the suite sequentially',
      ],
      answer: 1,
      why: 'The real defect is in the framework: a failed precondition was logged and ignored ("continuing"). Failing fast turns 40 confusing failures into 1 obvious one in seconds. Retries would rerun against the same dirty data (and turn 37 failures into 111). Hiding WARN lines removes your only clue. Going sequential doesn\'t reset data. Even better long-term: each scenario creates its own user via POST /api/users so tests don\'t depend on a global reset at all.',
    },
    {
      q: 'What do you tell the release manager at 10:00?',
      options: [
        '"40 failures — the release is blocked."',
        '"Automation is flaky this week; ignore it."',
        '"The run is invalid for the API area: the test-data reset failed (framework bug, fixed in PR #412), so 37 API failures were caused by leftover data. I reran the API scenarios after a manual reset: all green. Separately, 3 UI errors came from one Chrome hang on agent-4 — rerun passed; I\'m watching the agent. No product defects found; the run is green after fixes."',
        '"The cart team broke the API; they are fixing it."',
      ],
      answer: 2,
      why: 'A good triage summary groups failures by root cause, says what evidence supports it, what was done (fix + rerun), and what the product verdict is. It also stops the two developers from "fixing" a cart endpoint that isn\'t broken. Counting failures without causes ("40 failures") is how automation loses the team\'s trust.',
    },
  ],
  explanation: `**A method for long, parallel, cascading logs:**
1. **Sort by time.** Parallel threads interleave, and Surefire's *Results* section is grouped by class. Use Jenkins timestamps (Timestamper plugin) or log prefixes with time and thread.
2. **Find the first anomaly — including WARN.** Setup hooks, resets, logins and health checks run before any scenario; a failure there poisons everything after it.
3. **Know your noise.** Keep a list of known harmless lines (SLF4J NOP, CDP version warnings, deprecation notices). Diff against the last green build: anything new is a suspect.
4. **Group failures by signature** — exception type + message pattern (409 ITEM_ALREADY_IN_CART, wrong counts, renderer timeout). 40 failures usually collapse into 2–3 groups.
5. **For each group ask: does the root cause explain it?** If not, it's a second, independent problem (here: the Chrome hang on thread 4).
6. **Within a thread, the first failure causes the next.** Dead sessions, left-over windows and un-cleaned data cascade to later tests on the same thread.
7. **Fix the framework so it fails fast** — a precondition that fails must stop the run loudly.

| Group | Count | Root cause | Verdict |
|---|---|---|---|
| 409 / wrong subtotal / itemCount / order count / stale profile name | 37 | Reset sent GET → 405, ignored | Framework bug → fix, rerun |
| Renderer timeout + 2 × NoSuchSession | 3 | Chrome hang on agent-4 | Environment → rerun, monitor |
| SLF4J / CDP warnings | — | Known noise | Ignore |`,
  mistakes: [
    'Starting from the first line of the Surefire Results section instead of the timeline.',
    'Skipping WARN lines because "only ERRORs matter".',
    'Assuming 40 failures means 40 problems — or that it must be one problem.',
    'Letting setup code log a failure and continue instead of failing the run.',
  ],
  interview: [
    { q: 'How do you analyse a CI run with dozens of failures?', a: 'I sort the log by time, find the first anomaly including warnings from setup hooks, separate known noise by comparing with the last green build, and group failures by exception and message. Usually one setup problem explains most of them. I check whether any group is not explained by it, then fix the framework to fail fast and rerun. In one case 37 of 40 failures came from a data reset that returned 405 and was only logged as a warning.' },
    { q: 'What are cascading failures in test automation?', a: 'Failures that are consequences of an earlier failure rather than separate problems — a dead browser session reused by the next tests, data not cleaned up, a skipped login. Fixing the first failure removes them all, so triage always starts with the earliest one.' },
    { q: 'How do you make a suite resilient to this?', a: 'Hard preconditions with assertions and fail-fast behaviour in global hooks, a smoke/health stage before the full run, independent test data per scenario, fresh browser per scenario with cleanup in alwaysRun teardowns, and logs that include timestamps and thread names.' },
  ],
}
