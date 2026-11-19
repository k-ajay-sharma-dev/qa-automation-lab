export default {
  slug: 'pw-config-debugging-ci',
  category: 'playwright',
  order: 7,
  title: 'playwright.config.ts, debugging tools and CI on GitHub Actions',
  minutes: 10,
  summary: 'Configure baseURL, browsers, retries, parallelism, evidence and reporters in one file, debug with the trace viewer, --debug, UI mode and codegen, and run the suite in GitHub Actions.',
  manualAnalogy: `Before a manual regression cycle you agree the environment, the browsers to cover, how to record evidence and where the report goes. \`playwright.config.ts\` is that test plan in code. And when a defect cannot be reproduced, you ask for screenshots, logs and steps — the trace viewer gives you all three for every automated failure.`,
  body: `## One file instead of four

In the Selenium framework, settings were spread over \`config.properties\`, a \`DriverFactory\`, \`testng.xml\` and report listeners. In Playwright they live in \`playwright.config.ts\`:

\`\`\`ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,                       // per test
  expect: { timeout: 7_000 },            // per web-first assertion
  fullyParallel: true,                   // also parallelise tests inside a file
  workers: process.env.CI ? 4 : undefined,
  reporter: [['dot'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5180/practice-site/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  projects: [
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
});
\`\`\`

Key ideas:

- **\`use\`** holds options every test's fixtures receive: \`baseURL\` (so \`page.goto('cart.html')\` works on any environment), \`testIdAttribute\`, viewport, locale, \`storageState\`, \`extraHTTPHeaders\` for the \`request\` fixture.
- **\`projects\`** multiply the run: each project can override \`use\`. \`devices[...]\` presets set browser engine, viewport, user agent and touch support. Select with \`--project=edge\`. Projects can also have \`dependencies\` (e.g. a \`setup\` project that logs in first).
- **Environment variables** (\`process.env.X\`) switch environments without code changes — the equivalent of \`-Denv=staging\`. Never put passwords in the config; read them from env/CI secrets.
- **\`retries\`** re-run failed tests; a test that passes on retry is marked **flaky** in the report — a signal to investigate, not a fix.
- **Evidence**: \`trace\` (\`'on-first-retry'\`, \`'retain-on-failure'\`, \`'on'\`), \`screenshot\`, \`video\`. Traces are the most useful and cheap when recorded only for failures/retries.
- **Reporters**: \`list\`/\`dot\`/\`line\` for the console, \`html\` for people, \`junit\`/\`json\` for CI dashboards; several at once.
- **\`forbidOnly: !!process.env.CI\`** fails the run if someone committed \`test.only\`.

## The debugging toolbox

| You want to… | Use |
|---|---|
| understand a failure from CI | **Trace viewer**: open the HTML report → failed test → trace, or \`npx playwright show-trace trace.zip\` (also trace.playwright.dev) |
| step through a test with an inspector | \`npx playwright test cart.spec.ts --debug\` (or \`PWDEBUG=1\`), \`await page.pause()\` at a chosen line |
| develop and re-run tests in watch mode | **UI mode**: \`npx playwright test --ui\` — timeline, DOM snapshots per step, locator picker |
| find locators / record a draft | **codegen**: \`npx playwright codegen <url>\` — records actions, suggests getByRole/getByLabel |
| just watch it run | \`--headed\`, \`--project=chromium\`, \`-g "title"\`, \`--repeat-each=20\` to shake out flakiness |

The **trace** is the key skill. For every action it shows the DOM *before* and *after*, the exact element targeted, the console, the network log with request/response bodies, and timings. Typical findings: the click happened while a spinner still covered the button; the API returned 500; the assertion ran against an old list. You can inspect the snapshot with DevTools inside the trace viewer.

## Running in GitHub Actions

\`npm init playwright@latest\` can generate \`.github/workflows/playwright.yml\`. The essential steps:

\`\`\`yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: npm }
- run: npm ci
- run: npx playwright install --with-deps      # browsers + Linux libraries
- run: npx playwright test
  env:
    BASE_URL: \${{ vars.QA_BASE_URL }}
    SHOP_PASS: \${{ secrets.SHOP_PASS }}
- uses: actions/upload-artifact@v4
  if: \${{ !cancelled() }}                      # upload even when tests failed
  with: { name: playwright-report, path: playwright-report/, retention-days: 14 }
\`\`\`

- \`CI=true\` is set automatically, so the config's CI branches (retries, workers, forbidOnly) apply.
- \`npm ci\` installs the npm package; **browsers are separate** — forgetting \`playwright install\` gives *"Executable doesn't exist"*. Alternatively run in the \`mcr.microsoft.com/playwright\` Docker image.
- Upload the report with \`if: always()\` / \`!cancelled()\` — by default steps after a failure are skipped, which would lose exactly the evidence you need.
- Big suite? Split it across machines with a matrix and \`npx playwright test --shard=\${{ matrix.shard }}/4\`, then merge the blob reports.
- For the Cucumber suite the steps are the same, with \`npx cucumber-js --profile ci\` and the \`reports/\` folder as the artifact (see the *Cucumber with Playwright* lesson).`,
  keyPoints: [
    'playwright.config.ts replaces properties files, driver factories, testng.xml and report listeners.',
    'use = options for every test (baseURL, trace, screenshot); projects = browsers/devices; env vars = environments.',
    'Retries reveal flaky tests; traces explain them.',
    'Debug with trace viewer (CI failures), --debug / page.pause (step through), UI mode (daily work), codegen (locators).',
    'CI: npm ci → playwright install --with-deps → test → upload report with if: always()/!cancelled().',
  ],
  mistakes: [
    'High retries to get a green pipeline — flaky tests stay flaky and real bugs hide behind "passed on retry".',
    "trace: 'on' for the whole CI suite — big artifacts; record on retry or on failure.",
    'Missing trailing slash in baseURL or leading slash in goto — the /practice-site/ path disappears.',
    'Committing await page.pause() — the CI run hangs until the test timeout.',
  ],
  tryIt: `Run any spec with \`--ui\`, click a test, and use the timeline to jump to the moment of a click. Then open the "Network" and "Console" tabs for that step — this is exactly what you get from a CI failure's trace.`,
  problems: ['pw-014', 'pw-020', 'pw-035', 'pw-036', 'pw-044'],
}
