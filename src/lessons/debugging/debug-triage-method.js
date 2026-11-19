export default {
  slug: 'debug-triage-method',
  category: 'debugging',
  order: 2,
  title: 'Failure triage: product bug, test bug or environment?',
  minutes: 8,
  summary: 'Classify a red test with evidence instead of guesses, using a repeatable five-step method, and report the result in language a release manager can act on.',
  manualAnalogy: `You already do triage every day: before raising a defect you reproduce it, check it isn't your test data, and make sure the QA server isn't down. Automation failures need exactly the same judgement — the only new part is that the evidence comes from logs and screenshots instead of your own eyes.`,
  body: `## The four possible verdicts

| Verdict | Meaning | Action |
|---|---|---|
| **Product bug** | The application behaves wrongly | Raise a defect with evidence |
| **Test bug** | The script is wrong or outdated (locator, timing, wrong expectation, shared data) | Fix the test — not a defect |
| **Environment issue** | Infrastructure, config, data, versions, network | Fix/escalate the environment, rerun |
| **Can't tell yet** | Not enough evidence | Collect more, don't guess |

"Flaky" is not a verdict. It is a symptom ("sometimes red") whose cause is almost always one of the first three — usually a test bug (timing, shared state).

## The five-step method

**1. Look at the shape of the failure first.**

- *Everything* red, failing within seconds, same error → environment (browser can't start, site down, login service broken). Don't read 300 stack traces; read one.
- A *cluster* in one area (all checkout tests) → a recent change in that area, product or test.
- *One* test, consistently → read it in detail.
- *One* test, sometimes → timing or test independence.

**2. Read the evidence for one failure** — exception, message, your code line, deepest \`Caused by\` (see the *Reading a stack trace* lesson), plus the screenshot.

**3. Reproduce by hand.** Do exactly what the test does on the same environment and data.

- You see the same wrong behaviour → most likely **product bug**.
- It works by hand → most likely **test bug** (or timing).
- You can't even get to the page → **environment**.

**4. Check what changed.** New build of the app? New commits to the tests? Browser auto-updated? Different agent / Docker image? Failures that start on a specific date almost always line up with a change.

**5. Classify, act, and write it down** in one sentence with evidence.

## Signals cheat sheet

| Evidence | Leans towards |
|---|---|
| \`ERR_CONNECTION_REFUSED\`, DNS errors, 502/503, certificate errors | Environment |
| \`SessionNotCreatedException\`, driver/browser version text | Environment |
| Test data missing (user deleted, product not seeded) | Environment / test data |
| Screenshot shows an application error page or wrong calculation, reproducible by hand | Product |
| API returned 500 in the network log (HAR) for valid input | Product |
| Locator no longer matches after a UI redesign, works by hand | Test |
| Passes alone, fails in suite / in parallel | Test (shared state) |
| \`expected [X] but found [Y]\` where only the *format/type* differs | Test |
| Screenshot shows a spinner or half-loaded page | Test (timing) — unless the app is genuinely too slow |

## Worked example (not from the exercises)

> \`WishlistTest.addToWishlist\` fails: \`TimeoutException ... visibility of .wishlist-count\`. Screenshot: the product page shows "Wishlist is temporarily unavailable". The other 80 tests are green. By hand on QA: the same message. The wishlist service's health page returns 503.

Is it a product bug or environment? The message is the app *correctly* reporting that a dependency is down — so the root problem is the **environment** (the wishlist service on QA). Action: tell the environment owner, rerun after it's up. If the service is up and the message still appears, it becomes a product bug.

Notice how the verdict came from **evidence** (screenshot + manual check + health page), not from the exception name.

## When the answer is "can't tell yet"

Say so. Then gather what is missing: rerun that single test with screenshots, add a log line, check the network tab, ask the developer whether the feature changed. A wrong confident verdict costs more than a short delay: a false product bug wastes developer time; a false "test bug" lets a real defect ship.

## Reporting to the release call

Managers don't need stack traces. They need three numbers and a sentence:

> "Nightly: 312 tests. 290 passed. 18 skipped because the test-data seeding job failed before the run (environment, rerun green). 4 failures: 1 product defect (SHOP-1423, coupon applied twice when the page is refreshed), 3 test fixes in progress (locators after the header redesign). No other release risk."

Count skipped tests separately and never present "failed + skipped" as "bugs found".

## Many failures: triage groups, not tests

When a run has dozens of red tests, give a verdict per **root cause**, not per test. Group failures by their signature (same exception and message pattern), find the earliest event that explains each group, and check whether anything is left over — a second, independent cause hides easily behind a big cascade. "37 failures from one failed data reset (framework, fixed and rerun green) + 3 from a browser hang on one agent (environment)" is a verdict a release manager can act on; "40 failures" is not.

## Preventing the noisy ones

- Start the pipeline with a **one-test smoke stage** (open the browser, open the login page). If it fails, stop the run with a clear message instead of 300 identical failures.
- Keep test data creation inside the tests (or a seeding step), not on hand-made accounts.
- Retrying failed tests automatically hides flakiness — use it only with reporting, never as the fix.`,
  keyPoints: [
    'Verdicts: product bug, test bug, environment, or "can\'t tell yet" — flaky is a symptom, not a verdict.',
    'Look at the shape first: all-red-fast = environment; one test sometimes = timing or shared state.',
    'Reproduce by hand: same wrong behaviour = product; works by hand = test.',
    'Check what changed: app build, test commits, browser version, agent image.',
    'Report counts and one-line verdicts with evidence; never call skipped tests bugs.',
  ],
  mistakes: [
    'Raising a defect from the exception name alone, without reproducing by hand.',
    'Increasing timeouts for a failure whose screenshot shows an application error.',
    'Marking a whole red run as "flaky, rerun" without classifying — real defects slip through.',
    'Adding blanket automatic retries so the dashboard looks green.',
  ],
  tryIt: `Pick the last three red tests you saw (any project). For each, write one sentence: verdict + the single piece of evidence that decided it. If you can't name the evidence, the honest verdict is "can't tell yet".`,
  problems: ['dbg-014', 'dbg-013', 'dbg-015', 'dbg-027'],
}
