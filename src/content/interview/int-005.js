export default {
  id: 'int-005',
  category: 'interview',
  kind: 'quiz',
  title: '"How do you handle flaky tests?" — answering like someone who has fixed them',
  level: 'ADVANCED',
  tags: ['flaky', 'stability', 'retry', 'root-cause', 'test-design'],
  estMinutes: 15,
  scenario: `Every senior interviewer asks about flaky tests, because every real suite has them. The weak answer is "we rerun failed tests". The strong answer shows a **process**: detect → find the root cause category → fix → prevent — with retries only as a temporary, tracked measure.`,
  description: `Answer the questions; then memorise the categories in the explanation — they double as your real-time stories.`,
  hints: [
    'Flaky = same code, same build, different result. Something is non-deterministic: timing, data, order, environment.',
    'Retries hide signals; quarantine and fix is the mature approach.',
  ],
  questions: [
    {
      q: 'What is the definition of a flaky test?',
      options: [
        'A test that always fails',
        'A test that passes and fails on the same code and environment without any change',
        'A test that takes longer than 1 minute',
        'A test marked @wip',
      ],
      answer: 1,
      why: 'Flaky means non-deterministic. A test that always fails is broken (or found a bug) — not flaky. This distinction matters: deterministic failures are easier and must never be "retried away".',
    },
    {
      q: 'Which list covers the most common root causes of flakiness in Selenium suites?',
      options: [
        'Java version, Maven version, IntelliJ version',
        'Synchronization (missing/wrong waits, animations, spinners), shared/order-dependent test data, environment instability (slow/unstable QA env, third-party services), brittle locators, and parallel-run conflicts (static driver)',
        'Too many comments in the code',
        'Using Cucumber',
      ],
      answer: 1,
      why: 'These five buckets explain the vast majority of flaky tests. Naming them with an example each ("we had a spinner overlay causing ElementClickIntercepted") is what convinces an interviewer.',
    },
    {
      q: 'Your team wants to add a TestNG IRetryAnalyzer that retries every failed test 3 times. What is the best response?',
      options: [
        'Great idea — it will make the pipeline green',
        'Use retry at most once and only as a temporary safety net, log/report every retried test, and track them as tech debt to fix the root cause; never retry tests with assertion failures on business values',
        'Retries are impossible in TestNG',
        'Retry 10 times to be safe',
      ],
      answer: 1,
      why: 'Blanket retries hide real intermittent product bugs (race conditions!) and make the suite slower. A retried pass must be visible in the report. Mature teams quarantine known-flaky tests (separate tag, non-blocking job) and fix them within a sprint.',
    },
    {
      q: 'A test fails 1 in 10 runs on Jenkins only. Which first step gives the most information?',
      options: [
        'Add Thread.sleep(5000) before every step',
        'Delete the test',
        'Collect evidence from the failing runs: failure screenshot/video, the exception and line, browser console/network logs, timing — then compare failing vs passing runs',
        'Run it 100 times locally and give up if it passes',
      ],
      answer: 2,
      why: 'Evidence first. Screenshots on failure, logs and run history usually point directly to the category (overlay, stale element, data, environment). Running it in a loop locally (e.g. invocationCount = 50 or a loop in IntelliJ, plus headless and parallel to mimic CI) is a good second step to reproduce.',
    },
    {
      q: 'Which measure best PREVENTS flaky tests from entering the suite?',
      options: [
        'Code review checklist + running new tests several times (e.g. 5–10 repetitions, in parallel/headless) before merging',
        'Writing tests only on Fridays',
        'Using only XPath locators',
        'Disabling screenshots to make tests faster',
      ],
      answer: 0,
      why: 'A "burn-in" run of new tests in CI-like conditions catches most flakiness before it hurts trust in the suite. A review checklist (no sleeps, explicit waits, independent data, stable locators) addresses the root causes.',
    },
  ],
  explanation: `**Model answer structure — Detect → Categorise → Fix → Prevent:**

> "First, we **detect** flaky tests from run history — tests that fail intermittently on the same build. We tag them @quarantine so they don't block the pipeline, and create a ticket.
>
> Then we **find the root cause** from screenshots and logs. In my project most were **synchronization** issues — a loading overlay causing ElementClickInterceptedException, which we fixed by waiting for the overlay's invisibility; some were **test data** collisions in parallel runs, fixed with unique users per thread; and a few were **environment** issues with a slow third-party payment sandbox, which we stubbed for UI tests.
>
> We **prevent** new ones with a review checklist — no Thread.sleep, explicit waits, independent data, stable locators — and by running new tests several times in CI before merging. We do have a retry analyzer set to one retry, but retried tests are highlighted in the report and treated as debt, not as passes."

That one answer contains three real-time stories. Swap in your own.`,
  mistakes: [
    'Answering only "we rerun the failed tests".',
    'Calling every failure "flaky" without investigation.',
    'Adding sleeps to "stabilise" tests.',
    'Retrying assertion failures on business data, which can hide real defects.',
  ],
  interview: [
    { q: 'How do you handle flaky tests?', a: 'I treat flakiness as a bug in the test or environment. We identify flaky tests from run history, quarantine them with a tag so they do not block releases, and fix the root cause — usually synchronization, shared test data, brittle locators or environment instability. For example, an overlay spinner caused intermittent click interception, so we added an invisibility wait in BasePage. We allow at most one retry, report it visibly, and run new tests several times in CI before merging.' },
    { q: 'Do you use retry logic?', a: 'Yes, but carefully: an IRetryAnalyzer with a single retry, applied through a listener, and the report shows which tests passed on retry. Those are tracked and fixed; we do not use retries to hide failures.' },
    { q: 'How do you measure flakiness?', a: 'By tracking pass/fail history per test across runs — for example from the Jenkins test result trend or report history — and calculating how often a test fails without a code change. Tests above a threshold go to quarantine.' },
  ],
}
