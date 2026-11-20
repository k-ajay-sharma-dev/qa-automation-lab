export default {
  slug: 'pw-deep-reporting-debugging',
  category: 'playwright',
  order: 20,
  title: 'Deep dive: reporters, Allure, traces and debugging failing tests',
  minutes: 30,
  summary: 'Choose and combine reporters for people and machines, attach the evidence that explains a failure, integrate Allure with labels and history, write a custom summary reporter, read a trace like a crime scene, and debug a CI-only ShopEasy failure systematically.',
  manualAnalogy: `A good manual defect report has steps, expected vs actual, screenshots, the console and network log, and the environment, so the developer never has to ask "can you reproduce it?". Reporters, attachments and traces are how an automated suite writes that defect report on its own, every time, and the debugging workflow is the same triage you already do: reproduce, isolate, gather evidence, classify.`,
  body: `## Where this lesson starts

The *playwright.config.ts, debugging tools and CI* lesson listed the toolbox: trace viewer, \`--debug\`, UI mode and codegen. This deep dive covers what senior interviews probe:

- which reporter serves **which audience**
- what exactly ends up in the HTML report and in a trace, and what each costs
- how to attach **diagnostics that answer the next question** before anyone asks it
- when Allure is worth its overhead
- how to write a reporter of your own
- a **repeatable workflow** for the failure that only happens on CI

Config, CI files and sharding are covered in the previous deep dive.

## Built-in reporters

| Reporter | Output | For whom | Notes |
|---|---|---|---|
| \`list\` | one line per test, with steps if \`printSteps\` | a developer at the terminal | the default locally |
| \`line\` | a single updating line, failures printed inline | big local runs | less scroll noise |
| \`dot\` | one character per test | CI logs | the default on CI |
| \`html\` | \`playwright-report/\` folder | humans investigating | \`open: 'always' \\| 'never' \\| 'on-failure'\` (default \`on-failure\`), \`outputFolder\`, \`title\`, \`noSnippets\`, \`attachmentsBaseURL\` |
| \`json\` | one JSON document | dashboards, scripts | \`outputFile\` or \`PLAYWRIGHT_JSON_OUTPUT_FILE\`, otherwise stdout |
| \`junit\` | JUnit XML | Jenkins, Azure DevOps, GitLab test tabs | \`outputFile\`, \`includeProjectInTestName\` |
| \`blob\` | \`blob-report/*.zip\` containing everything | merging shards (1.37+) | merged later with \`merge-reports\` |
| \`github\` | GitHub Actions annotations | PR authors | the Playwright docs advise against it in matrix builds |

\`\`\`ts
// playwright.config.ts (excerpt)
reporter: process.env.CI
  ? [
      ['dot'],                                              // short CI log
      ['junit', { outputFile: 'results/junit.xml' }],       // CI test tab and trends
      ['html', { open: 'never', title: 'ShopEasy e2e' }],   // never try to open or serve a report on an agent
      ['allure-playwright', { resultsDir: 'allure-results' }],
      ['./reporters/slack-summary.ts', { runUrl: process.env.RUN_URL }],
    ]
  : [['list'], ['html', { open: 'on-failure' }]],
\`\`\`

**How it works.** Reporters live in the **runner process**, not in the workers. Workers send events to the runner (test begin, step begin and end, stdout, attachments, test end), and the runner fans every event out to **all** configured reporters. That is why several reporters cost almost nothing extra, why a reporter never sees a \`page\` object, and why a slow \`onEnd\` delays the process exit. Set \`open: 'never'\` explicitly on CI. With \`on-failure\`, a failing run starts a local server for the report and waits for Ctrl+C. On an agent, which is often not detected as CI (custom Jenkins or Docker set-ups without \`CI=true\`), that means a hung job until the job timeout. \`--reporter=line\` on the CLI replaces the configured list for that run.

## Inside the HTML report

- **Index:** counters and filters for passed, failed, flaky and skipped, plus project, tag and search filters. Use it to answer "what failed, and in which browsers?" before you open a single test.
- **Test page:** one tab per **attempt** (\`Run\`, \`Retry #1\`, …). A **flaky** test has a failed first attempt and a passed retry, and both are kept.
- **Errors:** the assertion message, expected vs received, and a code snippet with the failing line marked.
- **Steps:** a tree of \`test.step\`, hooks, fixtures and each Playwright call, with durations. Well-named steps turn the report into a readable business flow (the *Test organisation* deep dive covers \`test.step\` and \`box\`).
- **Attachments:** screenshots, video, the trace, and anything you attach yourself. Images display inline, and JSON or text can be opened in the browser.
- **Trace link:** opens the trace viewer embedded in the report. That needs the report to be served over HTTP: use \`npx playwright show-report [folder]\`. Double-clicking \`index.html\` from disk works for browsing, but **traces do not load from \`file://\`**.

## Attachments: evidence that answers the next question

\`\`\`ts
// tests/fixtures/diagnostics.ts
import { test as base, expect } from '@playwright/test';

type Diagnostics = { diagnostics: void };

export const test = base.extend<Diagnostics>({
  diagnostics: [async ({ page }, use, testInfo) => {
    const consoleLines: string[] = [];
    const networkProblems: string[] = [];

    page.on('console', (msg) => consoleLines.push(\`[\${msg.type()}] \${msg.text()}\`));
    page.on('pageerror', (err) => consoleLines.push(\`[pageerror] \${err.message}\`));
    page.on('requestfailed', (req) =>
      networkProblems.push(\`FAILED \${req.method()} \${req.url()} \${req.failure()?.errorText ?? ''}\`));
    page.on('response', (res) => {
      if (res.status() >= 400) networkProblems.push(\`\${res.status()} \${res.request().method()} \${res.url()}\`);
    });

    await use();                                            // the test runs here

    if (testInfo.status !== testInfo.expectedStatus) {      // failed, or timed out, or unexpectedly passed
      await testInfo.attach('browser-console.txt', { body: consoleLines.join('\\n') || '(empty)', contentType: 'text/plain' });
      await testInfo.attach('network-problems.txt', { body: networkProblems.join('\\n') || '(none)', contentType: 'text/plain' });
      await testInfo.attach('final-page.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
  }, { auto: true }],                                      // runs for every test that uses this test object
});
export { expect };
\`\`\`

\`\`\`ts
// attaching an API response from inside a test
import { test, expect } from './fixtures/diagnostics';

test('order summary shows 8% tax', async ({ page, request }, testInfo) => {
  const products = await request.get('http://localhost:5181/api/products?sort=price_asc');
  await testInfo.attach('products-response.json', {
    body: JSON.stringify(await products.json(), null, 2),
    contentType: 'application/json',
  });
  // … UI steps …
});
\`\`\`

The important lines:

- \`testInfo.attach(name, { body | path, contentType })\`. With \`body\` you pass a string or Buffer. With \`path\` you pass a file, which the runner **copies** into the report, so it is safe to write it under \`testInfo.outputPath('x.json')\` (unique per test and retry, so parallel tests never overwrite each other).
- Comparing \`testInfo.status\` with \`expectedStatus\` handles \`test.fail()\` correctly. A test that is *expected* to fail and does fail is not a problem, so it gets no noise attached.
- Listeners are registered **before** \`use()\`, so they capture everything from the first navigation onward.
- \`auto: true\` plus a dependency on \`page\` means even API-only tests that import this \`test\` would start a browser page. Keep a separate \`test\` object for API specs, or make the fixture opt-in.
- Built-in equivalents: \`screenshot: 'only-on-failure'\`, \`video: 'retain-on-failure'\` and \`trace\`. Custom attachments add what those miss: a readable console log in the report itself, and the API data behind the page.
- Never attach secrets. A response body from \`/api/auth/login\` contains a bearer token, so redact it before you attach it.

## Allure with Playwright

### Setup

\`\`\`bash
npm i -D allure-playwright allure          # adapter + Allure Report 3 CLI (Node, no Java)
# Allure 2 instead: the Java-based CLI (e.g. the allure-commandline npm wrapper, needs a JRE)
npx playwright test                        # writes ./allure-results/*.json and attachments
npx allure generate ./allure-results       # builds ./allure-report
npx allure open                            # serves the generated report
npx allure serve ./allure-results          # or: generate into a temp dir and open in one step
\`\`\`

\`\`\`ts
// reporter entry, playwright.config.ts
['allure-playwright', {
  resultsDir: 'allure-results',
  environmentInfo: { TEST_ENV: process.env.TEST_ENV ?? 'local', node_version: process.version },
}],
\`\`\`

### Labels, steps and attachments

\`\`\`ts
// tests/e2e/checkout-summary.spec.ts
import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

test('overview shows item total, 8% tax and total', { tag: ['@smoke'] }, async ({ page }) => {
  await allure.epic('Checkout');
  await allure.feature('Order overview');
  await allure.story('Tax calculation');
  await allure.severity(allure.Severity.CRITICAL);
  await allure.owner('checkout-squad');

  await test.step('log in as standard_user', async () => {          // test.step shows up in Allure as a step
    await page.goto('login.html');
    await page.getByTestId('username').fill('standard_user');
    await page.getByTestId('password').fill(process.env.SHOP_PASS ?? 'secret_sauce');
    await page.getByTestId('login-button').click();
  });

  await allure.step('add backpack and bike light', async () => {     // allure.step works too
    await page.getByTestId('add-to-cart-trailblazer-backpack').click();
    await page.getByTestId('add-to-cart-pulse-bike-light').click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');
  });

  await test.step('enter details and continue', async () => {
    await page.getByTestId('shopping-cart-link').click();             // not getByRole('link', { name: 'Cart' }) — see below
    await page.getByTestId('checkout').click();
    await page.getByTestId('firstName').fill('Asha');
    await page.getByTestId('lastName').fill('Rao');
    await page.getByTestId('postalCode').fill('560001');
    await page.getByTestId('continue').click();
  });

  await expect(page.locator('#summary-subtotal')).toHaveText('$39.98');
  await expect(page.locator('#summary-tax')).toHaveText('$3.20');
  await expect(page.locator('#summary-total')).toHaveText('$43.18');
  await allure.attachment('summary.txt', await page.getByTestId('total-label').innerText(), 'text/plain');
});
\`\`\`

- The adapter is a reporter, so it receives the same events as the HTML reporter. \`test.step\`, \`testInfo.attach\`, screenshots, videos and traces appear in Allure **without** extra code. Playwright tags such as \`@smoke\` become Allure tags.
- The \`allure-js-commons\` calls add **metadata** that Playwright has no concept of. \`epic / feature / story\` drive the "Behaviors" tree, \`severity\` and \`owner\` drive filtering and accountability. They are async, so \`await\` them.
- Putting labels in every test is noisy. Wrap them in a fixture or helper (\`labelCheckout('Tax calculation')\`), or derive them from the folder structure. That is the Single Responsibility Principle applied to reporting: tests describe behaviour, and one helper decides how it is labelled.

### History and trends in CI

Allure computes trends (pass-rate chart, "new failed", retries and flaky markers over time) from **history that you must carry between runs**. CI agents are ephemeral, so nothing is kept by default.

- **Allure 3:** set \`historyPath\` (for example \`./history.jsonl\`) in the Allure config file. Each \`generate\` appends one line per run. Persist that file between runs: a cache or artifact restored at the start of the job, or a branch that publishes the report (for example GitHub Pages).
- **Allure 2:** copy \`allure-report/history/\` from the **previous** report into \`allure-results/history/\` before \`allure generate\`. It keeps up to 20 entries.
- Results are **appended** if \`allure-results\` already exists. Clean it at the start of a CI job so you do not mix runs. With shards, upload each shard's \`allure-results\` and combine the folders before \`generate\`.

### HTML vs Allure vs a custom dashboard

| | Playwright HTML | Allure | Custom dashboard (custom reporter → DB → Grafana or similar) |
|---|---|---|---|
| How it works | built-in reporter, static folder | adapter writes results; a CLI builds a static site | your reporter posts JSON per run or test to a store |
| Advantages | zero set-up, embedded traces, accurate retries/flaky, perfect fidelity with Playwright | behaviour hierarchy, severity and owner, history and trends, multi-framework (Java + TS suites in one style) | cross-suite and cross-team metrics, flaky rate over months, SLAs, alerts |
| Disadvantages | no history, no business labels | extra dependency and CLI, history plumbing, labels can drift | you build and run it; schema and retention are yours |
| Performance | fast | results writing is cheap; \`generate\` takes seconds to minutes for large runs | network calls in \`onEnd\` (batch them) |
| Maintainability | none needed | medium (adapter and CLI upgrades) | high effort |
| Scalability | one run at a time; merge shards via blob | good with history; big runs make big sites | best for organisation-level views |
| When to use | always, as the engineer's debugging report | stakeholders want trends and a business view, or the org standardised on Allure | many suites, many teams, long-term quality metrics |

**Recommended approach.** I'd recommend keeping the HTML report as the **source of truth for debugging** in every pipeline, because it is the only one with an embedded trace viewer and exact Playwright semantics. I'd add Allure only when there is a real audience for trends and a business-level view, and when someone owns the history plumbing. I'd build a custom dashboard only at organisation scale, fed by a small custom reporter or by the JSON or JUnit output. The trade-off is one more artifact to maintain, against answering the "is quality improving?" question with data.

## Writing a custom reporter: a summary to Slack or Teams

\`\`\`ts
// reporters/slack-summary.ts
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

type Options = { runUrl?: string; webhookUrl?: string };

export default class SlackSummaryReporter implements Reporter {
  private suite!: Suite;
  constructor(private readonly options: Options = {}) {}

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;                                    // the full tree: projects > files > describes > tests
  }

  async onEnd(result: FullResult) {
    const tests = this.suite.allTests();
    const by = (o: ReturnType<TestCase['outcome']>) => tests.filter((t) => t.outcome() === o);
    const failed = by('unexpected');
    const flaky = by('flaky');

    const lines = [
      \`*ShopEasy e2e* — \${result.status.toUpperCase()} in \${Math.round(result.duration / 1000)} s\`,
      \`passed \${by('expected').length} · failed \${failed.length} · flaky \${flaky.length} · skipped \${by('skipped').length}\`,
      ...failed.slice(0, 10).map((t) => \`• ❌ \${t.titlePath().slice(1).join(' › ')}\`),
      ...flaky.slice(0, 5).map((t) => \`• ⚠️ \${t.titlePath().slice(1).join(' › ')}\`),
      this.options.runUrl ? \`Report: \${this.options.runUrl}\` : '',
    ].filter(Boolean);

    const webhook = this.options.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;   // a CI secret, never in the repo
    if (!webhook) { console.log(lines.join('\\n')); return; }
    try {
      const res = await fetch(webhook, {                   // global fetch: Node 18+
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lines.join('\\n') }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) console.warn(\`Slack webhook answered \${res.status}\`);
    } catch (e) {
      console.warn(\`Could not post the summary: \${(e as Error).message}\`);   // reporting must never fail the run
    }
  }

  printsToStdio() { return false; }                         // let dot/list own the terminal
}
\`\`\`

- **Lifecycle:** \`onBegin(config, suite)\` → \`onTestBegin\` / \`onStepBegin\` / \`onStepEnd\` / \`onTestEnd\` (**once per attempt**, so retries produce several calls) → \`onEnd(result)\` → \`onExit()\`. \`onError\` reports errors outside tests, such as a syntax error in a spec.
- **Count with \`test.outcome()\` at the end**, not by incrementing counters in \`onTestEnd\`. A retried test would otherwise count as one failure plus one pass. \`outcome()\` returns \`expected\`, \`unexpected\`, \`flaky\` or \`skipped\`, and a \`test.fail()\` that failed counts as \`expected\`.
- \`onEnd\` may return \`{ status }\` to override the run's status, and therefore the exit code. That is powerful and dangerous, so keep a notifier read-only.
- Register it with \`['./reporters/slack-summary.ts', { runUrl }]\`. For **sharded** runs, put it only in the merge step (\`npx playwright merge-reports --config merge.config.ts ./all-blob-reports\`), or you get one message per shard.
- **Teams:** the same reporter can post to a Teams Workflows/incoming webhook. Only the payload shape differs (Teams expects its own card or message JSON), so put the formatter behind a small interface (\`Notifier\`) and keep \`onEnd\` channel-agnostic (open/closed: add a channel without touching the reporter).

## The trace viewer, in depth

**What a trace records**, per action:

- the API call with its locator and timing
- three DOM snapshots: **Before**, **Action** (at the moment of input, with the click point marked) and **After**
- the **actionability log**, for example "waiting for element to be visible, enabled and stable" and "\`<div class="overlay">\` intercepts pointer events"
- a screenshot filmstrip
- the console
- the **network** log with headers and bodies, including calls made through the \`request\` fixture
- the source line
- errors, attachments and metadata (browser, viewport, duration)

The snapshots are real DOM, so in the viewer you can open DevTools on them, pick a locator, and try another selector against the failing moment.

| \`trace\` mode | Records | Cost | Gotcha |
|---|---|---|---|
| \`off\` | nothing | none | no evidence |
| \`on\` | every test, kept | highest CPU, disk and upload; the docs call it performance-heavy | fine for a single debug run, wasteful on CI |
| \`on-first-retry\` | only the first retry | zero on first attempts | needs \`retries ≥ 1\`; you see the **retry**, which for a flaky test is the passing attempt |
| \`on-all-retries\` | every retry | grows with retry count | useful while hunting a flake |
| \`retain-on-failure\` | every test, deleted if it passed | recording overhead on every test, storage only for failures | you get the **failing** attempt itself, even without retries |
| \`retain-on-first-failure\` (1.43+) | first attempt, kept if it failed | as above | retries are not traced |
| \`retain-on-failure-and-retries\` (recent versions) | failures and all retries | most complete failure evidence | largest artifacts among the failure modes |

**Recommendation.** \`on-first-retry\` with \`retries: 1\` is the documented CI default and the cheapest. When a team fights CI-only flakes, I'd switch to \`retain-on-failure\`, which captures the attempt that actually failed, and accept the recording overhead. The object form can cut the size further: \`trace: { mode: 'retain-on-failure', screenshots: true, snapshots: true, sources: true }\`. Switch \`screenshots\` off for long tests.

**Opening a trace:**
- \`npx playwright show-trace test-results/<test>/trace.zip\`
- from the HTML report via \`show-report\`
- at **trace.playwright.dev**, which loads the file entirely in your browser and sends nothing to a server

Even so, a trace contains typed values and headers, including passwords and tokens, so follow your organisation's data rules and keep artifact retention short.

## Debugging tools: when to reach for which

| Tool | Command | Best for | Notes |
|---|---|---|---|
| UI mode | \`npx playwright test --ui\` | daily authoring and local failures | watch mode, timeline with snapshots, pick locator, filter by project/tag, network and console per step |
| \`--debug\` | \`npx playwright test checkout.spec.ts:42 --debug\` | stepping through one test | headed, Inspector, timeouts disabled (0) |
| \`PWDEBUG=1\` | \`PWDEBUG=1 npx playwright test\` | same as \`--debug\` via the environment | useful inside npm scripts |
| \`PWDEBUG=console\` | \`PWDEBUG=console npx playwright test\` | poking at locators in DevTools | \`playwright.$()\`, \`playwright.locator()\`, \`playwright.inspect()\`, \`playwright.selector($0)\` |
| \`page.pause()\` | in code, run headed or with \`--debug\` | stopping at an exact moment | never commit it: CI hangs until the test timeout |
| Inspector | opens with \`--debug\` / \`pause()\` | step over actions, see actionability logs, edit and pick locators | |
| codegen | \`npx playwright codegen http://localhost:5180/practice-site/login.html\` | discovering locators and drafting flows | review every locator (strictness, generated ids) |
| VS Code extension | Testing panel | breakpoints in TS, *Show Browser*, *Pick Locator*, run a single project | the fastest loop for many engineers |
| API logs | \`DEBUG=pw:api npx playwright test\` | seeing every call and wait in the console | very verbose, and may print URLs and headers |
| headed + slowMo | \`--headed\`, \`use: { launchOptions: { slowMo: 250 } }\` | watching a race | slowMo changes timing, so it can **hide** the race you are hunting |
| Re-run helpers | \`--last-failed\` (1.44+), \`--repeat-each=20\`, \`--retries=0\`, \`-x\` | reproducing and verifying | \`-x\` stops at the first failure |

On Windows PowerShell, set variables as \`$env:PWDEBUG=1; npx playwright test\`. The bash \`VAR=1 cmd\` form does not work there.

## A systematic workflow for "fails only on CI"

1. **Read the report first, not the code.** Which tests failed, in which projects and shards, on which attempt, and flaky or failed? Did they all fail at the same time? Many failures at one timestamp point to the environment. One test failing in all browsers points to logic or data. One browser only points to an engine difference.
2. **Open the trace of the failing attempt.** Read the error, then the action log (what was Playwright waiting for?), the **Before/After snapshots** (what did the page look like?), the network panel (status codes and response bodies) and the console (JS errors).
3. **Classify the cause:**
   - timing (the action happened before the app was ready, or an animation was running)
   - **data** (shared accounts or state, leftovers, seeds that differ per environment)
   - **environment** (URL, feature flag, OS fonts, viewport, locale or timezone, CPU starvation from too many workers)
   - a test bug
   - a real product bug
4. **Reproduce under CI conditions:**
   - the same Docker image tag
   - the same \`TEST_ENV\`
   - the same project and the same \`--workers\` value (parallelism is the biggest CI-vs-local difference)
   - then \`--repeat-each=20 --retries=0\`
5. **Compare evidence:** CI screenshot vs local screenshot (viewport, fonts, banners), a \`toHaveScreenshot\` diff, and the JSON from the API.
6. **Add diagnostics if the trace is not enough:** attach API responses, the console and network logs (the fixture above), and name steps after business actions, so the next failure explains itself.
7. **Fix the root cause, then prove it.** Run \`--repeat-each\` under CI-like conditions and watch the flaky rate in the following nightly runs. Do not just raise timeouts or retries.

### Worked example 1: the order total that is only wrong on CI

The API smoke test passes locally and fails about one CI run in three:

\`\`\`ts
// tests/api/order-total.spec.ts (the original, flaky version)
import { test, expect } from '@playwright/test';

test('order total includes 8% tax @smoke', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { username: 'standard_user', password: process.env.SHOP_PASS } });
  const { token } = await login.json();
  const headers = { Authorization: \`Bearer \${token}\` };

  await request.delete('/api/cart', { headers });                                    // "clean" the cart
  await request.post('/api/cart/items', { headers, data: { productId: 1 } });       // Trailblazer Backpack 29.99
  await request.post('/api/cart/items', { headers, data: { productId: 2 } });       // Pulse Bike Light 9.99
  const order = await (await request.post('/api/orders', {
    headers, data: { firstName: 'Asha', lastName: 'Rao', postalCode: '560001' },
  })).json();

  expect(order.total).toBe(43.18);
});
\`\`\`

\`\`\`
Error: expect(received).toBe(expected) // Object.is equality

Expected: 43.18
Received: 97.17
\`\`\`

Applying the workflow:

- **Report:** it fails only on CI, only when the run has 4 workers, and the retry usually passes, so the report marks it *flaky*.
- **Trace:** the \`request\` calls are in the trace. The \`POST /api/orders\` response body shows three items, including a *Storm Fleece Jacket* at 49.99. The arithmetic checks out: 39.98 + 49.99 = 89.97, plus 8% tax of 7.20, gives 97.17.
- **Classification: data.** The server keeps **one cart per user**, and another spec (\`cart-api.spec.ts\`) logs in as \`standard_user\` on a different worker and adds the jacket between our \`DELETE\` and our \`POST /api/orders\`. Locally the file ran alone. Browser contexts isolate cookies, not server state.
- **Reproduce:** \`npx playwright test tests/api --workers=4 --repeat-each=10 --retries=0\` fails within a minute.
- **Fix:** each test owns its customer. A fixture registers a unique user (\`POST /api/users\` with a username built from \`testInfo.workerIndex\`, \`Date.now()\` and a random suffix) and logs in as that user. Alternatively, order explicit \`items\` in the \`POST /api/orders\` body so the shared cart is not involved. Verify with the same \`--repeat-each\` command, then watch the next nightly runs.
- **Diagnostics for next time:** attach the order response JSON when the assertion fails. The difference is then visible in the report without opening the trace.

### Worked example 2: the strict-mode violation after a header change

After rebasing on \`main\`, every checkout test fails on CI:

\`\`\`
Error: locator.click: Error: strict mode violation: getByRole('link', { name: 'Cart' }) resolved to 2 elements:
    1) <a href="cart.html">Cart</a> aka getByRole('navigation', { name: 'Practice pages' }).getByRole('link', { name: 'Cart' })
    2) <a href="cart.html" id="shopping-cart-link" aria-label="Cart" …>🛒</a> aka getByTestId('shopping-cart-link')
\`\`\`

- **What happened:** the header now contains a plain nav link with the text *Cart* and the cart **icon** link, whose \`aria-label="Cart"\` gives it the same accessible name. \`{ exact: true }\` does not help, because both names are exactly "Cart".
- **How the trace shows it:** the action log stops at "resolved to 2 elements", and the Before snapshot shows both links highlighted.
- **Fix:** \`page.getByTestId('shopping-cart-link')\` for the icon (the badge lives inside it), or scope it with \`page.getByRole('navigation', { name: 'Practice pages' }).getByRole('link', { name: 'Cart' })\` when you mean the nav link. Do not reach for \`.first()\`: it silently picks whichever element comes first in the DOM, and breaks again when the layout changes. The error message itself suggests both "aka" locators, so read it before you change code.
- **Prevention:** a page object owns the cart locator, so the fix is one line. Keep a tiny \`@smoke\` test that clicks the icon and asserts \`cart.html\`, so the problem shows up on the PR instead of across the nightly run.

## Flaky vs failed in reports

| Outcome | Meaning | HTML report | Exit code |
|---|---|---|---|
| \`expected\` | passed (or a \`test.fail()\` that failed) | Passed | 0 |
| \`unexpected\` | failed on every attempt | Failed | 1 |
| \`flaky\` | failed, then passed on a retry | Flaky, with every attempt kept | 0, unless \`failOnFlakyTests\` (1.52+) |
| \`skipped\` | \`skip\` / \`fixme\` or a failed dependency | Skipped | 0 |

JUnit consumers (Jenkins, for example) usually show a flaky test as *passed*, so the flaky rate is invisible there. Read it from the HTML report, from Allure's retries view, or from a custom reporter that records \`outcome() === 'flaky'\`. A flaky test is a defect in the test, the environment or the product, and it needs an owner (the *Test organisation* deep dive covers triage and quarantine).

## Best practices for experienced engineers

- Pick reporters per audience: a quiet console, JUnit for the CI system, HTML for engineers, Allure or a dashboard for trends. Keep \`open: 'never'\` on CI.
- Make the report self-explanatory: business-named steps, failure-only attachments, the API data behind the UI, and redacted secrets.
- Trace mode is a cost decision. Revisit it when you fight flakes, and keep retention short.
- A reporter must never break the run. Use time-boxed network calls, catch errors, and send one message per run (in the merge step for shards).
- Debug from evidence before code: report, then trace, then classification, then reproduction under CI conditions.
- Do not "fix" CI-only failures with \`waitForTimeout\`, higher timeouts or extra retries. Find the race or the shared data.

## Selenium (Java) contrast, briefly

- **Reports:** ExtentReports or Allure-TestNG (\`@Epic\`, \`@Feature\`, \`@Story\`, \`@Severity\`, \`@Step\`, \`@Attachment\`), wired through a TestNG \`ITestListener\`. HTML and JUnit-style results come from Surefire.
- **Screenshots on failure:** you implement them yourself: \`onTestFailure(ITestResult r)\` → \`((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES)\` → attach, using a \`ThreadLocal<WebDriver>\` so parallel tests attach the right browser.
- **No trace equivalent:** console and network need extra work (Selenium 4 DevTools/BiDi listeners or a proxy), and there are no DOM snapshots per step. That is the biggest debugging gap teams notice after migrating.

\`\`\`java
public class FailureListener implements ITestListener {
  @Override public void onTestFailure(ITestResult result) {
    WebDriver driver = DriverManager.get();                       // ThreadLocal-backed
    byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
    Allure.addAttachment("failure-" + result.getName(), "image/png", new ByteArrayInputStream(png), "png");
  }
}
\`\`\`

## Interview questions

### Q: Which reporters would you configure for local runs and for CI, and why?
**Short answer (30–60 s):** Locally: \`list\` and \`html\` with \`open: 'on-failure'\`. On CI: \`dot\` for a short log, \`junit\` for the CI test tab, \`html\` with \`open: 'never'\` as the debugging artifact, and \`blob\` when sharding. I add Allure or a custom reporter only when there is an audience for trends or notifications.

**Detailed answer:** Reporters run in the runner process and receive events from workers, so several at once are cheap. Explain why \`open: 'never'\` matters on agents, that the \`github\` reporter is discouraged in matrix builds, and that the CLI \`--reporter\` replaces the configured list for a run. For shards, merge the blobs into one report and run notifiers only in the merge step.

### Q: What does a Playwright trace contain, and which trace mode do you use on CI?
**Short answer (30–60 s):** Every action with its locator, timing and actionability log, Before/Action/After DOM snapshots, screenshots, console, network with bodies, the source line and errors. On CI I use \`on-first-retry\` with one retry by default, and \`retain-on-failure\` while chasing CI-only flakes.

**Detailed answer:** Compare costs: \`on\` records everything (performance-heavy). \`retain-on-failure\` records every test but keeps only failures, and captures the failing attempt itself. \`on-first-retry\` costs nothing on first attempts but shows the retry, which may be the passing run. Mention \`retain-on-first-failure\` (1.43+) and the object form for trimming size. Traces contain secrets, and trace.playwright.dev processes the file locally.

### Q: How do you attach useful diagnostics to a failing test?
**Short answer (30–60 s):** \`testInfo.attach\` with \`body\` or \`path\` and a content type. I use an auto fixture that collects console messages, page errors and failed or 4xx/5xx responses, and attaches them only when \`status !== expectedStatus\`, plus API responses relevant to the assertion.

**Detailed answer:** Register listeners before \`use()\`, use \`testInfo.outputPath\` for files (unique per test and retry), and redact tokens. Avoid an auto fixture that forces a \`page\` on API-only tests. Built-in screenshot, video and trace cover the visual side. Custom attachments put the data in the report itself.

### Q: Allure or the Playwright HTML report?
**Short answer (30–60 s):** Both have a place. HTML is the engineer's debugging tool, with embedded traces and exact retry and flaky semantics. Allure adds business labels (epic, feature, story, severity, owner) and history and trends for stakeholders, at the cost of a dependency, a CLI and history plumbing.

**Detailed answer:** Explain the \`allure-playwright\` adapter as a reporter (steps and attachments flow through automatically), labels via \`allure-js-commons\`, \`generate\` / \`open\` / \`serve\`, and history: Allure 3 \`historyPath\` vs copying \`history/\` in Allure 2. Persist history between CI runs. Recommend HTML always, plus Allure when there is a real audience and an owner.

### Q: How would you write a reporter that posts a run summary to Slack?
**Short answer (30–60 s):** Implement \`Reporter\` from \`@playwright/test/reporter\`. Keep the suite from \`onBegin\`, then in \`onEnd\` count \`test.outcome()\` values (expected, unexpected, flaky, skipped), build a message with failing titles and the report link, and POST it to a webhook URL from a CI secret, with a timeout and a try/catch.

**Detailed answer:** \`onTestEnd\` fires once per attempt, so counting there double-counts retries. \`printsToStdio() { return false }\` leaves the terminal alone. \`onEnd\` can override the exit status, so a notifier should not. For shards, run it only during \`merge-reports\` via a merge config. Keep formatting behind a \`Notifier\` interface so Teams or email can be added without touching the reporter.

### Q: A test fails only on CI. Walk me through your process.
**Short answer (30–60 s):** Report first (which tests, browsers, attempts, flaky or failed, at the same time?), then the trace of the failing attempt (error, action log, snapshots, network, console). Classify as timing, data, environment, test bug or product bug, then reproduce with the CI image, env and worker count plus \`--repeat-each\`. Fix the root cause and verify the same way.

**Detailed answer:** Walk through the ShopEasy order-total example: a shared server-side cart for \`standard_user\` across workers, visible in the order response in the trace, reproduced with \`--workers=4 --repeat-each=10\`, and fixed with a per-test user fixture. Mention adding diagnostics so the next failure explains itself, and why raising timeouts or retries is not a fix.

### Q: When do you use UI mode, \`--debug\` and the trace viewer?
**Short answer (30–60 s):** UI mode for daily authoring and local failures (watch, timeline, pick locator). \`--debug\` or \`page.pause()\` to step through a specific test in the Inspector. The trace viewer for failures I cannot watch live, which means every CI failure.

**Detailed answer:** Add \`PWDEBUG=console\` for DevTools helpers, \`DEBUG=pw:api\` for call logs, codegen for locator discovery (review the output), the VS Code extension for breakpoints, and slowMo with a warning that it changes timing. \`--last-failed\` (1.44+) speeds up the fix-and-re-run loop.

## Scenario-based questions

**1. Managers want a weekly quality report, and engineers complain the HTML report is "only for us".** Keep HTML as the debugging artifact. Add Allure with epic/feature/severity labels (set by a helper, not by hand in every test) and persisted history, published from the nightly job. If several teams and suites need one view, add a small custom reporter that sends per-run outcome counts and flaky tests to the organisation's dashboard. Agree first on what is measured (pass rate, flaky rate, mean time to fix), so the report drives decisions instead of decoration.

**2. CI artifacts are 3 GB per nightly run and uploads take 10 minutes.** Check the settings: probably \`trace: 'on'\` and \`video: 'on'\`. Move to \`on-first-retry\` (or \`retain-on-failure\` while hunting flakes), \`video: 'retain-on-failure'\` or \`off\`, and \`screenshot: 'only-on-failure'\`. Use the trace object form without screenshots for long tests, set \`retention-days\` to 7–14, and upload blobs with a 1-day retention (only the merged report is kept). Measure the before and after sizes and confirm a failure still has a trace.

**3. A teammate's checkout test is flaky in WebKit only.** Filter the merged report to WebKit and compare the traces of failing and passing attempts. Look for actionability log differences (an element that is "not stable" during a transition), timing differences in network calls, and differences in the Before snapshots. Reproduce with \`--project=webkit --repeat-each=30 --retries=0\` in the CI image. A typical cause is asserting on text that changes during a CSS transition, or a focus or keyboard difference. Fix it with a web-first assertion on the final state, not a timeout, and record the root cause.

## Tricky follow-ups

- **Does a reporter run in the worker?** No. It runs in the runner process and gets serialized events, so it cannot touch \`page\`. Anything page-related must be attached from a fixture.
- **Why can't I see the trace when I double-click \`index.html\`?** The embedded trace viewer needs the report served over HTTP. Use \`npx playwright show-report\`.
- **With \`trace: 'on-first-retry'\` and \`retries: 0\`, what do you get?** No traces at all. Nothing is ever retried.
- **Is a flaky test a passing test?** For the exit code, yes, unless \`failOnFlakyTests\` is set. For quality, no: it is an unexplained failure that needs an owner.
- **Does \`slowMo\` help with flaky tests?** It can hide them, because it changes the timing that causes the race. Use traces and \`--repeat-each\` instead.`,
  keyPoints: [
    'Reporters run in the runner process and receive events from workers; combine dot + junit + html (open: never) on CI, list + html locally, blob for shards; the github reporter is discouraged in matrix builds.',
    'The HTML report keeps every attempt (Run, Retry #1), steps, errors with snippets, attachments and an embedded trace viewer — serve it with show-report, traces do not load from file://.',
    'testInfo.attach(name, { body | path, contentType }) plus an auto fixture that attaches console, page errors and failed/4xx-5xx responses only when status !== expectedStatus; redact secrets.',
    'Allure via allure-playwright: steps and attachments flow automatically, labels (epic/feature/story/severity/owner) via allure-js-commons, history must be persisted between CI runs (Allure 3 historyPath, Allure 2 copy history/).',
    'Custom reporter: keep the suite from onBegin, count test.outcome() in onEnd (onTestEnd fires per attempt), never fail the run from a notifier, run it once in the merge step for shards.',
    'A trace has Before/Action/After DOM snapshots, actionability log, network with bodies, console and source; on-first-retry is cheapest, retain-on-failure captures the failing attempt itself, on is performance-heavy.',
    'Tools: UI mode for authoring, --debug/PWDEBUG/page.pause with the Inspector for stepping, trace viewer for CI, codegen for locators, DEBUG=pw:api for call logs, --last-failed and --repeat-each for re-runs.',
    'CI-only failures: report → trace of the failing attempt → classify (timing, data, environment, test, product) → reproduce with the CI image, env and worker count + --repeat-each → fix the root cause and verify.',
  ],
  mistakes: [
    "Leaving the html reporter on its default open: 'on-failure' in a pipeline — a failing run can start serving the report and the job hangs until its timeout. Fix: ['html', { open: 'never' }] on CI and upload playwright-report as an artifact.",
    'Counting results in a custom reporter inside onTestEnd — retried tests are counted as a failure and a pass, and Slack shows wrong numbers. Fix: compute test.outcome() for suite.allTests() in onEnd, and run the reporter only in the merge step for shards.',
    "Using trace: 'on-first-retry' while chasing a CI-only flake and finding only traces of the passing retry. Fix: switch temporarily to retain-on-failure (or retain-on-failure-and-retries) so the failing attempt itself is recorded.",
    'Fixing a strict-mode violation (the duplicate "Cart" link) with .first() — it passes until the header order changes. Fix: read the "aka" suggestions in the error and use getByTestId(\'shopping-cart-link\') or scope to the navigation; keep the locator in the page object.',
    'Raising timeouts or retries for a test that fails only on CI with 4 workers. Fix: reproduce with --workers=4 --repeat-each=10 --retries=0 in the CI image; the ShopEasy order-total failure is a shared server-side cart, fixed with a per-test user.',
    'Attaching raw login responses or keeping traces for months — tokens and passwords end up in artifacts that many people can download. Fix: redact before attaching, short retention, low-privilege test accounts.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\` and the API on \`http://localhost:5181\`):
1. Add the \`diagnostics\` auto fixture from this lesson, then make a checkout test fail on purpose (expect \`#summary-total\` to be \`$43.17\` after adding the backpack and bike light). Open \`npx playwright show-report\` and check that the console, network and screenshot attachments are there.
2. Run the same failing test with \`--trace=retain-on-failure\` and with \`--trace=on-first-retry --retries=1\`, and compare what each trace shows and the sizes of the \`trace.zip\` files.
3. Write the API order-total test using \`standard_user\` and a second spec that adds product 4 to the same user's cart. Reproduce the collision with \`--workers=4 --repeat-each=10 --retries=0\`, then fix it with a fixture that registers a unique user via \`POST /api/users\`.
4. Click the cart with \`page.getByRole('link', { name: 'Cart' })\`, read the strict-mode error and its "aka" suggestions, and fix it with \`getByTestId('shopping-cart-link')\`.
5. Add \`allure-playwright\` with epic/feature/severity labels on the checkout test, run \`npx allure generate ./allure-results\` and \`npx allure open\`. Then write \`reporters/slack-summary.ts\` that prints the summary to the console when no \`SLACK_WEBHOOK_URL\` is set.`,
  problems: ['pw-020', 'pw-044', 'pw-036', 'pw-038', 'pw-040'],
}
