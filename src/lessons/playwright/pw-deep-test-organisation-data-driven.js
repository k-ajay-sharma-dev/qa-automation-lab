export default {
  slug: 'pw-deep-test-organisation-data-driven',
  category: 'playwright',
  order: 18,
  title: 'Deep dive: organising tests — steps, annotations, tags, data-driven tests and flaky-test strategy',
  minutes: 30,
  summary: 'Structure a Playwright suite the way a senior would: understand how workers schedule tests and what serial mode costs, make reports readable with test.step, manage known issues with annotations, select runs with tags, generate data-driven tests safely, and run a flaky-test process instead of hiding problems behind retries.',
  manualAnalogy: `A manual test plan is organised too: test sets per feature, a smoke checklist for every build and a full regression before release, test cases with numbered steps, one case run with several data rows, and a "known issues" list so nobody re-raises the same bug. When a case fails once and passes on a re-run, a good tester does not shrug — they write down the conditions and investigate. This lesson is the automated version of all of that.`,
  body: `## Where this lesson starts

The *Scaling the suite* lesson gave the one-table version of annotations and tags and the basics of workers; the *Config, debugging and CI* lesson set \`retries\` and \`trace\` in \`playwright.config.ts\`. Here we go underneath: how the runner actually distributes tests, the exact semantics of each annotation, how tags and \`grep\` interact with projects, the safe ways to generate tests from data, and what a team process for flaky tests looks like.

## How the runner schedules tests

1. **Collection.** The main process loads every spec file and records the tests (titles, annotations, tags, locations). **Each worker loads the same files again** to execute them — so file-level code runs many times, and the set of tests must be identical every time it is loaded.
2. **Grouping.** Tests are grouped into units a worker runs in order. By default a **file** is one group: its tests run sequentially in one worker, in declaration order. With \`fullyParallel: true\` (or \`describe.configure({ mode: 'parallel' })\`) each test becomes its own unit. Groups never mix projects, and tests that need different worker-scoped options (browser, \`headless\`, worker fixtures with different option values) need different workers.
3. **Dispatch.** Up to \`workers\` processes run at once. A free worker takes the next group; a worker is **reused** for following groups while their worker-scoped configuration matches, so \`browser\` and worker fixtures survive across files.
4. **Failure.** When a test fails, the worker process is discarded with its browser and a new one continues with the next test. With retries, the new worker starts by retrying the failed test. Every new worker runs \`beforeAll\` hooks again.

Consequences seniors point out: order between files is **not** a contract; with \`fullyParallel\` even tests in one file may run on different workers, so file-level \`let\` state and \`beforeAll\` side effects are per worker, not per file; and \`maxFailures\` stops the run early in CI when something is fundamentally broken.

## test.describe and describe.configure

\`\`\`ts
import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test.describe.configure({ mode: 'parallel', retries: 1, timeout: 45_000 });

  test.describe('step one: customer information', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('checkout.html');
    });

    test('rejects an empty first name', async ({ page }) => {
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('alert')).toHaveText('Error: First Name is required');
    });
  });
});
\`\`\`

| \`mode\` | Behaviour | Retries | Use when |
|---|---|---|---|
| \`'default'\` | Tests run in order in one worker (unless \`fullyParallel\` is on for the project) | Each test retried on its own | Normal files |
| \`'parallel'\` | Tests of the group can run in different workers at the same time | Each test on its own | A file with many independent tests and \`fullyParallel\` off globally |
| \`'serial'\` | In order, in one worker, as a unit | **The whole group** is retried from the start; after a failure the remaining tests are **skipped** | Steps that truly cannot be separated |

\`retries\` and \`timeout\` per describe were added in Playwright 1.28. \`describe.configure\` applies to its enclosing scope — call it at the top of the file or at the top of a \`describe\`. Nested describes add to the report title ("Checkout › step one: customer information › rejects an empty first name"), which is what \`--grep\` matches against.

### Is serial mode ever justified?

\`\`\`ts
test.describe.configure({ mode: 'serial' });   // DISCOURAGED unless you can justify it
test('create order', async () => { /* … */ });
test('order appears in history', async () => { /* depends on the test above */ });
\`\`\`

Cost of serial mode: one failure **skips** every later test (you lose information), the group cannot be spread over workers, a retry repeats every step, and \`--grep\` on a single test of the group no longer works on its own. It is justified only when the steps share state that is genuinely expensive or impossible to recreate — for example a third-party payment sandbox that allows one transaction per minute. Usually the better design is **one test with \`test.step\`s**, or creating the precondition through the API (\`POST /api/orders\`) so the "history" test stands alone.

## test.step: structure inside a test

\`\`\`ts
import { test, expect } from '@playwright/test';

test('standard user buys the backpack', async ({ page }) => {
  await test.step('log in as standard_user', async () => {
    await page.goto('login.html');
    await page.getByLabel('Username').fill('standard_user');
    await page.getByLabel('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByTestId('title')).toHaveText('Products');
  });

  await test.step('add the backpack to the cart', async () => {
    await page.getByTestId('add-to-cart-trailblazer-backpack').click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  const orderNumber = await test.step('check out', async () => {
    await page.getByTestId('shopping-cart-link').click();   // the nav also has a "Cart" link
    await page.getByTestId('checkout').click();
    await test.step('enter customer information', async () => {
      await page.getByLabel('First Name').fill('Jane');
      await page.getByLabel('Last Name').fill('Doe');
      await page.getByLabel('Zip/Postal Code').fill('560001');
      await page.getByRole('button', { name: 'Continue' }).click();
    });
    await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');
    return page.locator('#order-number').innerText();
  }, { timeout: 20_000 });

  expect(orderNumber).toMatch(/^SE-\\d{6}$/);
});
\`\`\`

- **Nesting**: steps can contain steps; the HTML report, UI mode and the trace viewer show them as a tree, with every Playwright action and assertion inside its step. A failing test opens at the failing step — this is how a product owner reads a report (problem pw-038).
- **Return values**: \`test.step\` returns whatever its callback returns (\`orderNumber\` here), so steps do not force \`let\` variables.
- **\`timeout\`** (Playwright 1.50+): a step-level budget; exceeding it throws a \`TimeoutError\` for that step. The default is no step timeout (only the test timeout).
- **\`box: true\`** (Playwright 1.39+): errors inside the step are reported **at the step call site** instead of deep inside a helper. Use it for steps wrapped in page-object methods, so the failure points at the test line that called \`checkout.enterCustomer()\`, not at the \`fill\` inside it.
- **\`test.step.skip\`** (Playwright 1.50+) declares a step that is not run; recent versions also let you skip from inside a step via the step-info argument.
- The 8% tax: 29.99 + 2.40 = 32.39 — asserting the computed total catches more bugs than asserting that "a total exists".

### Steps in page objects

Wrapping page-object methods in steps gives business-level reports for free:

\`\`\`ts
import { test, type Page } from '@playwright/test';

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async enterCustomer(first: string, last: string, postcode: string): Promise<void> {
    await test.step(\`enter customer \${first} \${last}, \${postcode}\`, async () => {
      await this.page.getByLabel('First Name').fill(first);
      await this.page.getByLabel('Last Name').fill(last);
      await this.page.getByLabel('Zip/Postal Code').fill(postcode);
      await this.page.getByRole('button', { name: 'Continue' }).click();
    }, { box: true });
  }
}
\`\`\`

Trade-off: a dependency from page objects on \`@playwright/test\`'s \`test\` — acceptable in a Playwright-only framework, worth avoiding if the page objects are shared with a Cucumber runner that reports steps itself.

## Annotations in depth

| Annotation | Declared form | Runtime / conditional form | Runs? | Reported as |
|---|---|---|---|---|
| \`skip\` | \`test.skip('title', body)\` | \`test.skip(condition, 'reason')\` inside a test or describe | no (runtime: aborted at the call) | skipped |
| \`fixme\` | \`test.fixme('title', body)\` | \`test.fixme(condition, 'reason')\` | no | skipped, marked "fixme" |
| \`fail\` | \`test.fail('title', body)\` | \`test.fail(condition, 'reason')\` | **yes**, must fail | passes if it fails; **fails if it passes** |
| \`slow\` | — | \`test.slow()\`, \`test.slow(condition, 'reason')\` | yes, timeout ×3 | normal |
| \`only\` | \`test.only\`, \`test.describe.only\`, \`test.fail.only\` (1.49+) | — | only focused tests run | — |

Details that interviewers probe:

- **Runtime skip is not free.** \`test.skip(condition)\` inside the body runs fixtures and everything before the call, then aborts. Put it first, or at describe level with the callback form so it is evaluated per test with fixtures:

\`\`\`ts
test.describe('drag-and-drop sorting', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'HTML5 drag events differ in WebKit; tracked in SHOP-412');
  // …tests…
});
\`\`\`

- **\`fail\` vs \`fixme\`.** \`fixme\` = the *test* is broken, do not run it. \`fail\` = the *product* has a known bug; the test keeps running and turns red the day the bug is fixed, so the annotation cannot outlive the bug unnoticed. Prefer \`fail\` for product bugs.
- **\`slow\`** triples the timeout; it cannot be used in \`beforeAll\`/\`afterAll\` (use \`test.setTimeout()\` there).
- **\`only\`** is for local debugging. \`forbidOnly: !!process.env.CI\` in the config makes CI exit with an error if any \`.only\` was committed — the "CI ran one test and went green" incident of problem pw-043.

### Custom annotations and issue links (Playwright 1.42+ details object)

\`\`\`ts
test('locked_out_user sees the locked-out message', {
  tag: ['@smoke', '@login'],
  annotation: [
    { type: 'issue', description: 'https://tracker.example.test/SHOP-128' },
    { type: 'requirement', description: 'LOGIN-04: locked users cannot sign in' },
  ],
}, async ({ page }) => {
  await page.goto('login.html');
  await page.getByLabel('Username').fill('locked_out_user');
  await page.getByLabel('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toHaveText('Error: Sorry, this user has been locked out.');
});
\`\`\`

Annotations are shown in the HTML report under the test and are available to custom reporters (\`test.annotations\`), which is how teams push requirement coverage into a test-management tool. The \`fail\`/\`skip\`/\`fixme\` calls also accept a details object in their declared form, so a known-bug test can carry its issue link: \`test.fail('…', { annotation: { type: 'issue', description: '…' } }, async …)\`.

Runtime annotations go through \`testInfo\`: \`testInfo.annotations.push({ type: 'data', description: 'user=' + username })\`.

## Tags and grep

\`\`\`ts
test('sort by price high to low', { tag: '@regression' }, async ({ page }) => { /* … */ });
test.describe('checkout validation', { tag: ['@regression', '@checkout'] }, () => { /* … */ });
test('login works @smoke', async ({ page }) => { /* older style: tag in the title */ });
\`\`\`

| | \`{ tag }\` in the details object (1.42+) | Tag in the title |
|---|---|---|
| Report | Shown as tag chips, filterable in the HTML report | Part of the title string |
| Title stability | Title stays clean; tags change without renaming the test | Adding a tag renames the test (history, links break) |
| Validation | Must start with \`@\` | Free text |
| grep | Matched | Matched |
| Use | Default in current Playwright | Legacy suites, older versions |

Selecting:

\`\`\`bash
npx playwright test --grep @smoke                        # tag
npx playwright test --grep "@smoke|@critical"            # OR
npx playwright test --grep "(?=.*@checkout)(?=.*@smoke)" # AND (regex look-aheads)
npx playwright test --grep-invert @quarantine            # exclude
\`\`\`

The same filters can live in config per project (\`grep\`, \`grepInvert\` on \`TestProject\`), which keeps pipelines declarative:

\`\`\`ts
// playwright.config.ts (excerpt)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:5180/practice-site/', trace: 'on-first-retry' },
  projects: [
    { name: 'smoke', grep: /@smoke/, grepInvert: /@quarantine/, use: { ...devices['Desktop Chrome'] } },
    { name: 'regression', grepInvert: /@quarantine/, use: { ...devices['Desktop Chrome'] } },
    { name: 'nightly-webkit', grepInvert: /@quarantine/, use: { ...devices['Desktop Safari'] } },
    { name: 'quarantine', grep: /@quarantine/, retries: 0 },
  ],
});
\`\`\`

A tag strategy a senior would propose:

| Tag | Meaning | Where it runs | Budget |
|---|---|---|---|
| \`@smoke\` | Critical paths: login, add to cart, checkout | Every PR, before deploy | < 5 min |
| \`@regression\` | Everything functional | Merge to main | < 20 min with sharding |
| \`@nightly\` / project | Cross-browser, slow, visual | Nightly | hours are fine |
| \`@quarantine\` | Known flaky, owned, time-boxed | Separate non-blocking job | — |
| \`@team-checkout\` etc. | Ownership | Routing failures to the right team | — |

Keep the vocabulary small and documented; ticket ids belong in annotations, not tags. Recent versions (1.57+) also have a config-level \`tag\` that is prepended to every test in the report — useful to label which CI environment a merged report came from.

## Data-driven and parameterized tests

Playwright has no \`test.each\`; you generate tests with plain TypeScript at collection time. Two rules follow from "each worker reloads the file":

- **Titles must be unique** within a file (duplicates are reported as an error) and should describe the data.
- **Titles and the set of tests must be deterministic.** Random data (\`faker\`, \`Date.now()\`) in a title or in the loop condition can make the worker see different tests from the main process, and the run fails with a "test not found in the worker process" style error. Generate random data *inside* the test or a fixture.

### Approach 1: a typed array in the spec

\`\`\`ts
// tests/inventory-sort.spec.ts
import { test, expect } from '@playwright/test';

type SortCase = { option: 'az' | 'za' | 'lohi' | 'hilo'; label: string; firstThree: string[] };

const cases: SortCase[] = [
  { option: 'az', label: 'Name (A to Z)', firstThree: ['Classic Crew T-Shirt', 'Junior Onesie', 'Pulse Bike Light'] },
  { option: 'za', label: 'Name (Z to A)', firstThree: ['Trailblazer Backpack', 'Storm Fleece Jacket', 'Retro Red Tee'] },
  { option: 'lohi', label: 'Price (low to high)', firstThree: ['Junior Onesie', 'Pulse Bike Light', 'Classic Crew T-Shirt'] },
  { option: 'hilo', label: 'Price (high to low)', firstThree: ['Storm Fleece Jacket', 'Trailblazer Backpack', 'Classic Crew T-Shirt'] },
];

test.describe('product sort', { tag: '@regression' }, () => {
  for (const c of cases) {
    test(\`sort "\${c.label}" (\${c.option}) orders the cards\`, async ({ page }) => {
      await page.goto('inventory.html');
      await page.getByTestId('product-sort').selectOption(c.option);
      await expect(page.getByTestId('product-sort')).toHaveValue(c.option);
      const names = page.getByTestId('inventory-item').getByRole('link');
      await expect(names).toHaveCount(6);
      await expect(names.first()).toHaveText(c.firstThree[0]);
      expect((await names.allInnerTexts()).slice(0, 3)).toEqual(c.firstThree);
    });
  }
});
\`\`\`

- The \`for…of\` loop runs at collection time and declares four tests; each title contains the data, so the report and \`--grep "lohi"\` work.
- Price ties (*Classic Crew T-Shirt* and *Retro Red Tee* are both $15.99) are ordered by name in ShopEasy — the data encodes that rule; a good data set always includes such boundary cases.
- \`toHaveCount(6)\` waits before \`allInnerTexts()\`, which does not wait. Declaring the loop variable with \`const\` in \`for…of\` gives each test its own binding.

### Approach 2: data from JSON or CSV, typed with interfaces

\`\`\`json
// data/checkout-validation.json
[
  { "id": "CV-01", "first": "",     "last": "Doe", "postcode": "560001", "error": "Error: First Name is required" },
  { "id": "CV-02", "first": "Jane", "last": "",    "postcode": "560001", "error": "Error: Last Name is required" },
  { "id": "CV-03", "first": "Jane", "last": "Doe", "postcode": "",       "error": "Error: Postal Code is required" },
  { "id": "CV-04", "first": "Jane", "last": "Doe", "postcode": "1!",     "error": "Error: Postal Code is invalid" }
]
\`\`\`

\`\`\`ts
// tests/checkout-validation.spec.ts
import { test, expect } from '@playwright/test';
import rows from '../data/checkout-validation.json';

interface ValidationCase { id: string; first: string; last: string; postcode: string; error: string }
const cases: ValidationCase[] = rows;     // compile-time check that the file matches the interface

for (const c of cases) {
  test(\`\${c.id}: checkout step one shows "\${c.error}"\`, { tag: '@checkout' }, async ({ page }) => {
    await page.goto('checkout.html');
    await page.getByLabel('First Name').fill(c.first);
    await page.getByLabel('Last Name').fill(c.last);
    await page.getByLabel('Zip/Postal Code').fill(c.postcode);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toHaveText(c.error);
    await expect(page.getByTestId('checkout-step-one')).toBeVisible();   // still on step one
  });
}
\`\`\`

For CSV the docs pattern uses a parser at collection time:

\`\`\`ts
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

interface LoginRow { username: string; password: string; expected: string }
const rows: LoginRow[] = parse(fs.readFileSync(path.join(__dirname, '../data/logins.csv')), {
  columns: true,
  skip_empty_lines: true,
});
\`\`\`

- An \`id\` column gives stable, unique titles even when two rows share an error message, and lets business people refer to "CV-03".
- Cast through an interface so a renamed column is a compile error, not a silent \`undefined\`. JSON imports need \`resolveJsonModule\` in \`tsconfig.json\` for type-checking. In an ESM project replace \`__dirname\` with a path derived from \`import.meta.url\`.
- Keep file reading **synchronous** and local; collection cannot \`await\` at the top level of a describe, and remote data at collection time makes test lists non-deterministic.

### Approach 3: describe per data set (user personas)

\`\`\`ts
const users = [
  { username: 'standard_user', canShop: true },
  { username: 'locked_out_user', canShop: false },
] as const;

for (const user of users) {
  test.describe(\`as \${user.username}\`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('login.html');
      await page.getByLabel('Username').fill(user.username);
      await page.getByLabel('Password').fill('secret_sauce');
      await page.getByRole('button', { name: 'Login' }).click();
    });

    test('lands on the expected page', async ({ page }) => {
      if (user.canShop) await expect(page.getByTestId('title')).toHaveText('Products');
      else await expect(page.getByRole('alert')).toHaveText('Error: Sorry, this user has been locked out.');
    });
  });
}
\`\`\`

Good when several tests share one data set; watch for \`if\` branches in tests — two branches is fine, more means the personas deserve separate tests.

### Approach 4: parameterized projects with option fixtures

\`\`\`ts
// fixtures/customer.ts
import { test as base } from '@playwright/test';
export type CustomerOptions = { postcode: string };
export const test = base.extend<CustomerOptions>({ postcode: ['560001', { option: true }] });

// playwright.config.ts (excerpt)
import { defineConfig } from '@playwright/test';
import type { CustomerOptions } from './fixtures/customer';
export default defineConfig<CustomerOptions>({
  projects: [
    { name: 'checkout-IN', grep: /@checkout/, use: { postcode: '560001' } },
    { name: 'checkout-UK', grep: /@checkout/, use: { postcode: 'SW1A 1AA' } },
  ],
});
\`\`\`

Every \`@checkout\` test runs once per project with a different \`postcode\` fixture value, and the report groups results by project. This is the right tool when **the whole suite** (or a tagged slice of it) must run per environment, locale, user role or API version.

### Comparison

| | Loop over array | JSON/CSV file | describe per data set | Parameterized projects |
|---|---|---|---|---|
| How it works | \`for\` declares tests | Same, data loaded synchronously | \`for\` declares groups | Option fixture value per project |
| Advantages | Simple, type-safe, data next to test | Non-developers can edit data; large sets | Shared hooks per data set | Whole suite reused; report split by project |
| Disadvantages | Data clutters the spec | Schema drift; needs typing and ids | Branching inside tests | Coarse; multiplies run time for every test in the project |
| Performance | One test per row, parallelisable | Same | Same | N × suite |
| Maintainability | Good for < ~15 rows | Good with ids + interface | Good for few personas | Good, config-driven |
| When to use | Small equivalence classes (sort options) | Validation matrices, business-owned data | Personas / roles | Environments, locales, roles across many tests |

**Recommended:** keep the data close to the test and typed (approach 1) until the data set grows or is owned by someone else, then move it to JSON with an \`id\` per row (approach 2). Use projects only for cross-cutting dimensions. Do not loop inside one test over many rows — the first failing row hides the others; if you must, use \`expect.soft\` and a \`test.step\` per row.

## Retries vs fixing flaky tests

### How retries work

- \`retries: 2\` (config, project, CLI \`--retries\`, or per describe) allows up to two re-runs of a failing test.
- A failure **discards the worker**; a new worker (fresh browser, \`beforeAll\` re-run, worker fixtures re-created) starts with the retry. In serial mode the whole group is retried from the start.
- \`testInfo.retry\` is 0 on the first run, 1 on the first retry, … — available in tests, hooks and fixtures. Typical uses: clear server-side caches before a retry, or turn on extra logging.
- Outcomes: **passed** (first try), **flaky** (failed, then passed on a retry), **failed** (failed every time). The HTML report shows flaky tests separately; \`trace: 'on-first-retry'\` records a trace exactly for the run you need to investigate.
- \`failOnFlakyTests\` (Playwright 1.52+) makes the run exit with an error if any test was flaky — retries then give you diagnostics without letting flakiness pass silently.

### Why retries hide real bugs

A test that is flaky because of a **product** race (the cart badge updates before the server confirms, a double-submit creates two orders, an API sometimes returns 500 under load) turns green on retry — and the customer hits the bug. Retries also double CI time for failing tests and, worst of all, teach the team that red means "re-run". Flaky tests are a signal, not noise.

### A triage process

1. **Detect.** CI reports flaky tests (the HTML/JSON report status, or a custom reporter that writes flaky tests to a dashboard). Track a flaky rate per test over time.
2. **Reproduce.** \`npx playwright test tests/cart.spec.ts --repeat-each=30 --retries=0 --workers=4\`; increase workers to create contention; compare with \`--workers=1\` to detect order or data coupling.
3. **Read the evidence.** The first-retry trace: actions, DOM snapshots, network, console. Compare the failing attempt with the passing one.
4. **Classify the root cause:**

| Category | Typical evidence | Fix |
|---|---|---|
| Timing / synchronisation | Assertion on a non-retrying value (\`allInnerTexts\`, \`isVisible\`), \`waitForTimeout\`, action on an element that re-renders | Web-first assertions, wait for the response that changes the state |
| Test data collisions | Fails only with several workers; "already in cart", wrong counts | Unique data per test/worker, API set-up, test-scoped resets |
| Order dependence | Passes in the full run, fails alone (or the reverse); fails after a retry in a new worker | Remove shared state, no \`beforeAll\` page, no serial unless justified |
| Environment | Fails on CI only; timeouts; fonts; slow third parties | Same Docker image, mock third parties, resources |
| Test code bugs | Missing \`await\` (lost promise), wrong locator scope | Lint \`no-floating-promises\`, strict locators |
| Product race | Real intermittent behaviour visible in the trace | Bug ticket; \`test.fail\` with an issue annotation until fixed |

5. **Quarantine if not fixable today.** Add \`@quarantine\` (excluded from blocking projects, run in a non-blocking job with \`retries: 0\`), an issue annotation, an owner and a deadline. Quarantine without an owner is deletion with extra steps.
6. **Fix and verify** with \`--repeat-each\` before removing the tag.

**What I would recommend to a team:** "Retries: 0 locally, 1 on CI as a safety net — never more than 2. Traces on first retry. Every flaky result is visible in the report and tracked; a test that is flaky twice in a week goes to quarantine with an owner and a one-sprint deadline. New tests must pass \`--repeat-each=20\` before merge. Once the flaky rate is low, switch on \`failOnFlakyTests\` for the main branch. The trade-off is some short-term friction for developers; the payoff is that a red build means something again."

## testInfo: runtime information and outputs

\`\`\`ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('order confirmation details are attached', async ({ page, request }, testInfo) => {
  testInfo.annotations.push({ type: 'project', description: testInfo.project.name });
  if (testInfo.retry > 0) testInfo.annotations.push({ type: 'retry', description: 'attempt ' + (testInfo.retry + 1) });

  const res = await request.get('http://localhost:5181/api/products?sort=lohi&size=3');
  const body = await res.json();
  await testInfo.attach('cheapest-products.json', {
    body: JSON.stringify(body, null, 2),
    contentType: 'application/json',
  });

  const file = testInfo.outputPath('first-product.txt');      // unique per test and retry
  await fs.writeFile(file, body.data[0].name);
  await testInfo.attach('first-product', { path: file });

  expect(body.data[0].name).toBe('Junior Onesie');
});
\`\`\`

| Member | Use |
|---|---|
| \`attach(name, { body \\| path, contentType })\` | Evidence in the report (payloads, screenshots, logs) |
| \`outputPath(...parts)\` | A file path inside this test's own output folder — safe in parallel and across retries |
| \`annotations\` | Add runtime annotations (data used, environment) |
| \`retry\`, \`project\`, \`title\`, \`titlePath\` | Branch on attempt, label artifacts |
| \`status\`, \`expectedStatus\` | In \`afterEach\`/fixture teardown: did it fail unexpectedly? |
| \`setTimeout()\`, \`skip()\`, \`fail()\`, \`slow()\` | Runtime versions of the annotations |

\`test.info()\` returns the same object from helper code that has no \`testInfo\` parameter (it throws when called outside a running test).

## Common mistakes and debugging

- **Duplicate titles from a loop** (\`test('sort works', …)\` inside \`for\`) — the runner reports duplicate test titles. Put the data in the title.
- **"Test not found in the worker process"-style failures** after adding random data to titles — the worker generated different titles. Move randomness inside the test.
- **\`test.skip(cond)\` deep in a long test** — the expensive set-up already ran. Move the condition to the top or to the describe level callback form.
- **Grep matches too much** — \`--grep @smoke\` also matches \`@smoke-extended\`. Use a regex with a boundary in config (\`/@smoke\\b/\`) or distinct names.
- **Serial group skips half the suite** — the report shows many "skipped" after one failure. Turn the group into one test with steps or separate tests with API set-up.
- **A flaky test "fixed" by raising timeouts** — the trace shows the element appeared quickly but the assertion read a stale value. Fix the synchronisation, not the timeout.

## Best practices for experienced engineers

- Organise by feature (\`tests/checkout/\`, \`tests/catalogue/\`), describe by behaviour, steps by business action.
- Tags in the details object, a small documented tag vocabulary, filters declared in projects.
- \`forbidOnly\` on CI; \`test.fail\` with an issue link for product bugs; \`fixme\` only for broken tests, with a ticket.
- Data-driven tests with unique, deterministic, data-bearing titles and typed data.
- Retries as a safety net with visibility, never as the fix.

## Selenium (Java) contrast

\`\`\`java
@DataProvider(name = "sortOptions")
public Object[][] sortOptions() {
    return new Object[][] { {"az", "Classic Crew T-Shirt"}, {"hilo", "Storm Fleece Jacket"} };
}

@Test(dataProvider = "sortOptions", groups = {"regression"}, retryAnalyzer = RetryOnce.class)
public void sortOrdersCards(String option, String first) { /* … */ }
\`\`\`

| TestNG | Playwright Test |
|---|---|
| \`@DataProvider\` | \`for\` loop generating tests / projects with option fixtures |
| \`groups\` + \`testng.xml\` include/exclude | \`tag\` + \`--grep\` / \`grepInvert\` / project \`grep\` |
| \`IRetryAnalyzer\` | \`retries\` (built in, with flaky status) |
| \`dependsOnMethods\`, \`priority\` | Serial mode (discouraged) — prefer independent tests |
| \`enabled = false\`, \`SkipException\` | \`test.skip\`, \`test.fixme\` |
| \`parallel="methods"\` | \`fullyParallel: true\` |
| Allure \`@Step\` | \`test.step\` |

## Interview questions

### Q: How does Playwright decide which worker runs which test?
**Short answer (30–60 s):** It groups tests — by default one file is one group run in order in a worker; with \`fullyParallel\` each test is its own unit — and free workers take the next group. Workers are reused while worker-scoped config matches; a failure replaces the worker.

**Detailed answer:** Mention that files are loaded once for collection and again in each worker, so collection code must be deterministic; that projects and worker-scoped options split groups; that \`beforeAll\` runs once per worker and again after each restart; and that order between files is not guaranteed. Then the design implication: tests must not depend on order or on state from other tests.

### Q: When is \`mode: 'serial'\` acceptable?
**Short answer (30–60 s):** Rarely — when steps share state that is expensive or impossible to recreate. Its cost is that one failure skips the rest, the whole group is retried, and it cannot be parallelised.

**Detailed answer:** Offer alternatives: one test with \`test.step\`s (readable report, one retry unit, no skipped tests), or API set-up so each test creates its precondition. Give a legitimate example (a rate-limited external sandbox). Both \`test.describe.serial\` and \`describe.configure({ mode: 'serial' })\` exist; the docs discourage serial mode in general and recommend isolated tests.

### Q: \`test.fail\` vs \`test.fixme\` vs \`test.skip\`?
**Short answer (30–60 s):** \`skip\`: not applicable in this condition. \`fixme\`: the test is broken, do not run it. \`fail\`: the product has a known bug — run it, expect it to fail, and alert when it starts passing.

**Detailed answer:** Explain the conditional and callback forms, that runtime skip aborts after set-up already ran, that \`fail\` is self-cleaning because it turns red when the bug is fixed, and that all of them accept a details object with an issue annotation in their declared form (1.42+). For conditions on fixtures, use \`test.skip(({ browserName }) => …, 'reason')\` at describe level.

### Q: How would you design a tagging strategy?
**Short answer (30–60 s):** A small vocabulary: \`@smoke\` for critical paths on every PR, \`@regression\` on merge, nightly projects for cross-browser and slow tests, \`@quarantine\` for owned flaky tests, plus ownership tags. Tags in the details object, filters in project config.

**Detailed answer:** Discuss AND/OR with regex, \`grepInvert\` for quarantine, why tags in the details object keep titles stable, why ticket ids belong in annotations, and the runtime budget per tag. Show the project block with \`grep\`/\`grepInvert\`.

### Q: How do you write data-driven tests in Playwright?
**Short answer (30–60 s):** Generate tests with a loop over typed data at collection time — inline, or loaded synchronously from JSON/CSV — with the data in each title. For whole-suite dimensions, use projects with option fixtures.

**Detailed answer:** Cover unique and deterministic titles (workers reload files), typing JSON with interfaces, an id column, describe-per-persona, and the comparison table. Warn against looping inside one test.

### Q: Your suite has \`retries: 3\` and is green. Is that good?
**Short answer (30–60 s):** Not necessarily — check how many tests are flaky. Retries can hide product races and test bugs, and they slow CI. I'd lower retries to 1, record traces on first retry, track flaky tests and fix or quarantine them.

**Detailed answer:** Explain the mechanics (new worker, \`testInfo.retry\`, flaky status), the triage steps, root-cause categories, \`--repeat-each\` to reproduce and verify, and \`failOnFlakyTests\` (1.52+) once the rate is low.

### Q: What can you do with \`testInfo\`?
**Short answer (30–60 s):** Attach evidence, get a per-test output path, add runtime annotations, read the retry number, project and status, and change the timeout or skip at runtime.

**Detailed answer:** Show \`attach\` with \`body\` vs \`path\`, \`outputPath\` being unique per test and retry (safe in parallel), checking \`status !== expectedStatus\` in teardown, and \`test.info()\` for helpers.

## Scenario-based questions

**1. The team wants every PR to run the full 900-test suite "to be safe"; PRs wait 45 minutes.** I'd propose a tiered pipeline: \`@smoke\` (~40 tests, under 5 minutes) blocking every PR, the regression project sharded on merge to main, and cross-browser plus visual nightly. I'd back it with data: which tests found bugs in the last quarter, and how long each tier takes. The risk — a regression slipping past a PR — is mitigated by running regression before deploy.

**2. A checkout test is flaky only on CI, about 1 in 15 runs.** Reproduce with \`--repeat-each=30 --workers=4\` locally; if it never fails, suspect environment or data. Open the first-retry trace from CI: if the total is wrong, two tests probably share a cart through one account (data collision); if a click lands before the overview renders, it is synchronisation. Fix accordingly, verify with \`--repeat-each\`, and add the root-cause category to the flaky log so patterns become visible.

**3. Business analysts want to maintain checkout validation cases in a spreadsheet.** Export to CSV/JSON in the repo (versioned, reviewed), load it synchronously with a typed interface and an \`id\` column, and generate one test per row. I would not read the sheet live at collection time — it makes the test list non-deterministic and the run dependent on an external service.

## Tricky follow-ups

- **Does \`fullyParallel\` change hook behaviour?** Yes: \`beforeAll\` then runs in every worker that executes a test from that file, not once per file.
- **Does \`--grep\` match tags from the details object?** Yes, tags are matched together with the title.
- **Can \`test.step\` return a value?** Yes, it resolves to whatever the callback returns.
- **What status does a test get if it fails once and passes on retry?** "flaky" — the run passes unless \`failOnFlakyTests\` is set.
- **Why can't I use \`faker\` to build test titles?** Each worker reloads the file; random titles differ between processes and the runner cannot match the tests.`,
  keyPoints: [
    "Files are loaded for collection and again in every worker; by default a file runs in order in one worker, fullyParallel makes each test its own unit, and a failure replaces the worker.",
    "describe.configure sets mode (default / parallel / serial), retries and timeout per group; serial mode skips the rest after a failure and retries the whole group — prefer one test with steps or API set-up.",
    "test.step nests, returns values, supports box (1.39+) and timeout (1.50+) and turns the report and trace into a readable business flow.",
    "skip = not applicable, fixme = broken test, fail = known product bug that alerts when fixed, slow = 3x timeout; forbidOnly on CI; issue links via the details-object annotation (1.42+).",
    "Tags in the details object, a small documented vocabulary, AND/OR via regex, and grep / grepInvert declared per project.",
    "Data-driven tests: loops at collection time with unique, deterministic, data-bearing titles; typed JSON/CSV with ids for larger sets; option-fixture projects for whole-suite dimensions.",
    "Retries create a new worker and report 'flaky'; use them as a visible safety net with trace on first retry, a triage process and quarantine with an owner — and failOnFlakyTests (1.52+) once stable.",
    "testInfo: attach, outputPath, runtime annotations, retry, project and status for diagnostics.",
  ],
  mistakes: [
    "Generating tests in a loop with the same title or with random data in the title — duplicate-title errors, or workers that cannot find the test. Fix: deterministic titles that contain the row id or data; generate random values inside the test.",
    "Using serial mode to chain 'create order' and 'see order in history' — one failure skips the rest and a retry replays everything. Fix: one test with test.step, or create the order through POST /api/orders in the second test.",
    "Marking product bugs with fixme or skip, so they are forgotten after the fix. Fix: test.fail with an issue annotation; the test turns red when the bug is fixed and you remove the annotation.",
    "Calling test.skip(condition) halfway through a test, after expensive set-up. Fix: put it first, or use the describe-level callback form test.skip(({ browserName }) => …, 'reason').",
    "Raising retries until CI is green. Fix: retries at most 1–2 on CI, trace on first retry, a flaky dashboard, reproduce with --repeat-each and --workers, classify the root cause and quarantine with an owner.",
    "Loose grep patterns (--grep @smoke matching @smoke-extended). Fix: distinct tag names or a regex with a word boundary in the project config.",
  ],
  tryIt: `Against \`http://localhost:5180/practice-site/\`:
1. Create \`data/checkout-validation.json\` with at least five rows (include an invalid postcode such as \`1!\` and a valid one with a space, e.g. \`SW1A 1AA\`, that must reach step two) and generate one test per row with an \`id\` in the title, typed through an interface.
2. Generate four sort tests for \`az\`, \`za\`, \`lohi\` and \`hilo\` that assert the full order of all six product names (watch the $15.99 tie).
3. Write one end-to-end purchase test with nested \`test.step\`s that returns the order number from the last step and asserts it matches \`SE-\` plus six digits. Open the HTML report and check how the steps appear.
4. Tag the purchase test \`@smoke\`, the rest \`@regression\`, add a \`smoke\` and a \`regression\` project with \`grep\`, and run \`npx playwright test --project=smoke\`.
5. Run the validation tests with \`--repeat-each=10 --workers=4 --retries=0\` and confirm none is flaky.`,
  problems: ['pw-038', 'pw-043', 'pw-031', 'pw-033', 'pw-021', 'pw-044'],
}
