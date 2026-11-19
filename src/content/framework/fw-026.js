export default {
  id: 'fw-026',
  category: 'framework',
  kind: 'quiz',
  title: 'EXPERT: review a flaky-suite strategy before it hides real bugs',
  level: 'EXPERT',
  tags: ['flaky-tests', 'framework-design', 'retry', 'quarantine', 'ci', 'strategy'],
  estMinutes: 25,
  scenario: `ShopEasy's nightly regression has 420 UI tests running with \`parallel="methods"\`, \`thread-count="8"\`. Over the
last month 9–14% of tests fail each night, but a different set every time, and the team has stopped reading the
report. The engineering manager proposes: *"Set retries to 3, and if it is still red, mark the build unstable instead of
failed."* You are the senior QA in the room and you are asked to propose a strategy instead.`,
  description: `Answer as the person who owns the suite's reliability. Several options are partly right; pick the **best** one.`,
  questions: [
    {
      q: 'What is the strongest first response to the "retries = 3" proposal?',
      options: [
        'Agree — green builds restore trust',
        'Measure first: collect each failure with its exception type, test, thread, timestamp and retry outcome for a week, and classify causes before choosing fixes; keep at most 1 visible retry meanwhile',
        'Delete the failing tests',
        'Switch the whole suite to Playwright',
      ],
      answer: 1,
      why: 'Flakiness has a handful of distinct causes, each with a different fix. Retries only change the colour of the build. A week of classified data (listener output, retry attributes in the report) tells you which cause dominates. One visible retry is an acceptable bridge, three silent ones are not.',
    },
    {
      q: 'The data shows failures cluster on tests that touch the cart, and only when run in parallel. Most likely root cause?',
      options: [
        'The browser is too slow',
        'Shared test data: parallel tests log in as the same user and change the same server-side cart, so they interfere',
        'TestNG has a bug with thread-count 8',
        'The network is unstable',
      ],
      answer: 1,
      why: 'A per-user resource (cart, profile, orders) shared by parallel tests is the classic "different set fails every night" pattern. Fix with data isolation: a dedicated user per thread or per test, unique data from builders, set-up and clean-up through the API (fw-023), and no reliance on other tests (fw-019).',
    },
    {
      q: '`addToCart` intermittently throws `StaleElementReferenceException` right after sorting the product list. Best fix?',
      options: [
        'Add a retry analyzer that only retries StaleElementReferenceException',
        'Thread.sleep(2000) after sorting',
        'Synchronise on the state change in the page object (wait until the old list is stale / the new order is present), then locate fresh elements',
        'Catch the exception in the test and ignore it',
      ],
      answer: 2,
      why: 'The test is reading the DOM while it is being re-rendered. The page object should wait for the re-render to finish and re-find elements. Retrying hides a synchronisation defect in your framework; sleeps make the suite slower and still flaky.',
    },
    {
      q: 'One checkout test fails about 1 night in 20 with a wrong total ($43.18 expected, $42.18 shown), and passes on retry. What should the retry policy do with it?',
      options: [
        'Retry it — it passes the second time, so it is flaky',
        'Never treat an intermittent wrong business result as test flakiness: report it as a potential product defect (race condition in price calculation), with the evidence, even if a retry passes',
        'Lower the assertion precision',
        'Move it to the wip group',
      ],
      answer: 1,
      why: 'This is exactly how retries hide real bugs. Timeouts and stale elements can be infrastructure or test problems; a wrong total is the application returning a wrong answer. Customers hit intermittent bugs too. Some teams restrict automatic retry to specific exception types for this reason.',
    },
    {
      q: 'While root causes are being fixed, how should known-flaky tests be handled?',
      options: [
        'Leave them in the main run so everyone sees them',
        'Quarantine: tag them `@Test(groups = "quarantine")` with a ticket link, exclude the group from the gating run, run it in a separate non-blocking job, and set an expiry (fix or delete within N sprints)',
        'Comment them out',
        'Set enabled = false and forget them',
      ],
      answer: 1,
      why: 'Quarantine keeps the gating signal trustworthy without losing coverage visibility: the tests still run and report in their own job, every quarantined test has an owner and a ticket, and an expiry date stops the quarantine from becoming a graveyard.',
    },
    {
      q: 'Which metric best tells the manager the strategy is working?',
      options: [
        'Number of tests in the suite',
        'Percentage of green builds after retries',
        'Flaky rate per test (failures that pass on rerun without code change), the share of nightly failures that turned out to be real defects, and time-to-triage — tracked over weeks',
        'Lines of framework code',
      ],
      answer: 2,
      why: '"Green after retries" can be gamed by retrying more. A falling flaky rate, a rising share of failures that are real bugs, and fast triage mean the report is trusted again — which was the actual problem.',
    },
  ],
  hints: [
    'Classify before you fix: test data, synchronisation, environment, real product bug.',
    'A wrong business value is never "just flaky".',
  ],
  explanation: `A strategy you could present in that meeting:

1. **Visibility first (week 1).** Listener logs exception type, thread and timing; the report marks retried tests
   (fw-009, fw-024). Max **one** automatic retry, never silent.
2. **Classify every failure** into buckets — they need different owners and fixes:

| Bucket | Typical signs | Fix |
|---|---|---|
| Test data collisions | fails only in parallel, shared user/cart | per-thread users, builders, API set-up and clean-up (fw-023), independent tests (fw-019) |
| Synchronisation | Stale/NoSuchElement/Timeout right after an action | explicit waits on the right state inside page objects |
| Environment | 5xx, slow pages, whole run degraded at once | health-check before the run, talk to infra, run off-peak |
| Infrastructure | browser crash, session not created | containers with \`shm_size\`, thread-count ≤ grid capacity (fw-025) |
| **Real product bug** | wrong data/values intermittently | defect ticket with evidence — never retried away |

3. **Quarantine** with owner, ticket and expiry; the gating run excludes the \`quarantine\` group, a separate job still runs it.
4. **Prevent**: review checklist (no sleeps, no shared static state, no order dependencies, clean-up with \`alwaysRun\`),
   and run new tests several times in parallel (\`invocationCount\` locally) before merging.
5. **Measure** flaky rate per test and "real defects found by nightly" — trust is the goal, not green.

What to say about "mark the build unstable": acceptable as a *temporary* signal level for the quarantine job, not for the
gating run — a red that nobody acts on is the same as no test at all.`,
  mistakes: [
    'Raising the retry count to turn the build green.',
    'Treating every intermittent failure as test flakiness, including wrong business values.',
    'Quarantining tests without an owner, ticket or expiry date.',
    'Fixing symptoms (sleeps, catches) instead of synchronisation and data isolation.',
  ],
  interview: [
    { q: 'Your nightly suite is 10% flaky. What do you do?', a: 'Make failures visible and classify them over a week (data collisions, synchronisation, environment, infrastructure, real bugs), fix the biggest bucket first, quarantine known-flaky tests with owners and expiry, allow at most one visible retry, and track flaky rate and real defects found over time.' },
    { q: 'When does a retry hide a real bug?', a: 'When the failure is the application giving a wrong result intermittently — a race condition, caching or concurrency defect. Customers hit those too. Retries should be limited, visible and ideally restricted to infrastructure-type exceptions, and wrong business values should always be investigated.' },
    { q: 'How do you prevent new flaky tests?', a: 'Code review rules (explicit waits, no shared state, independent tests, cleanup in alwaysRun teardown, unique data), running new tests repeatedly and in parallel before merging, and monitoring each test’s flaky rate after it lands.' },
  ],
}
