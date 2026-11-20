export default {
  slug: 'pw-deep-config-environments-ci',
  category: 'playwright',
  order: 19,
  title: 'Deep dive: playwright.config.ts, environments, global setup and CI/CD',
  minutes: 30,
  summary: 'Design an enterprise playwright.config.ts, explain how options resolve between config, projects and test.use, run one suite against several environments with a validated env module and safe secrets, choose between globalSetup and setup projects, and wire sharded runs into GitHub Actions, Jenkins and Docker with sensible quality gates.',
  manualAnalogy: `Before a release you agree a test strategy: which environment (QA or staging), which browsers and devices, who owns the test accounts, what runs on every build and what runs overnight, and where the evidence goes. A senior automation framework writes that strategy down as code: the config is the strategy, environment variables are the environment sheet, and the CI pipeline is the run schedule and sign-off gate.`,
  body: `## Where this lesson starts

The *playwright.config.ts, debugging tools and CI* lesson showed a working config and a basic GitHub Actions file, and the *Scaling the suite* lesson introduced sharding. In a senior interview you are expected to go further. You should explain **why** each option is set the way it is, **which value wins** when the same option is set in three places, how **one codebase** runs safely against QA, staging and production, and how the pipeline turns test results into a **merge decision**.

All examples target ShopEasy: the web shop on \`http://localhost:5180/practice-site/\` (started with \`npm run dev\`) and the API on \`http://localhost:5181/api\` (started with \`npm run api\`).

## How the config is loaded (the mechanism)

- \`npx playwright test\` starts the **runner process**. It loads \`playwright.config.ts\` with its own TypeScript transpiler, so you do not need \`ts-node\` or a build step. The config is plain code: imports, \`process.env\` and helper functions all work.
- The runner **collects** tests by loading every spec file, applies \`grep\`, \`--project\`, \`--shard\` and other filters, and builds the run plan. Then it starts **worker processes**. Each worker loads the config **again**, and then loads the test files it was given.
- Consequence 1: code at the top level of the config (dotenv, env validation) runs in the runner **and in every worker**. Keep it fast, deterministic and free of side effects. Never create test data there.
- Consequence 2: a variable you set on \`process.env\` inside \`globalSetup\` is visible to tests, because workers start later and inherit the environment. A variable set inside a test is not visible to other workers.
- \`defineConfig\` only adds types. It merges nothing and validates nothing at runtime beyond what the runner checks itself.

## A complete, annotated enterprise config

\`\`\`ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';             // typed + validated, see below

const isCI = !!process.env.CI;                   // GitHub Actions, GitLab and most CI systems set CI=true

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',                     // traces, screenshots, videos, attachments (wiped at start)
  fullyParallel: true,                           // tests (not only files) are the scheduling unit
  forbidOnly: isCI,                              // a committed test.only fails the CI run
  retries: isCI ? 1 : 0,                         // a safety net in CI only; locally you want the real failure
  workers: isCI ? '50%' : undefined,             // number or % of CPU cores; undefined = half the cores
  maxFailures: isCI ? 25 : 0,                    // stop a run that is clearly broken (environment down)
  timeout: 45_000,                               // per test, including beforeEach/afterEach and fixtures
  globalTimeout: isCI ? 45 * 60_000 : 0,         // whole run; protects CI minutes
  expect: {
    timeout: 7_000,                              // per web-first assertion
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  reporter: isCI
    ? [['dot'], ['junit', { outputFile: 'results/junit.xml' }], ['html', { open: 'never' }], ['blob']]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: env.BASE_URL,                       // keep the trailing slash: .../practice-site/
    testIdAttribute: 'data-testid',              // the default; change it if your app uses data-test or data-qa
    actionTimeout: 10_000,                       // click/fill; default 0 = limited only by the test timeout
    navigationTimeout: 20_000,                   // goto/waitForURL; default 0
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  webServer: env.TEST_ENV === 'local'
    ? [
        { command: 'npm run dev', url: 'http://localhost:5180/practice-site/login.html',
          reuseExistingServer: !isCI, timeout: 120_000 },
        { command: 'npm run api', url: 'http://localhost:5181/api/health',
          reuseExistingServer: !isCI },
      ]
    : undefined,                                 // remote environments are already running
  projects: [
    { name: 'setup', testMatch: /global\\.setup\\.ts/, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /global\\.teardown\\.ts/ },

    { name: 'smoke', grep: /@smoke\b/, testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },

    { name: 'chromium', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'firefox',  testDir: './tests/e2e', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    { name: 'webkit',   testDir: './tests/e2e', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },

    { name: 'mobile-chrome', testDir: './tests/e2e', testMatch: /.*\\.mobile\\.spec\\.ts/,
      use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    { name: 'mobile-safari', testDir: './tests/e2e', testMatch: /.*\\.mobile\\.spec\\.ts/,
      use: { ...devices['iPhone 14'] }, dependencies: ['setup'] },

    { name: 'api', testDir: './tests/api', use: { baseURL: env.API_URL } },
  ],
});
\`\`\`

Step by step, focusing on the decisions:

1. **\`fullyParallel\` + \`workers\`.** With \`fullyParallel\`, a 200-test file can be spread over all workers, and shards balance per test instead of per file. The price: \`beforeAll\` runs once in **every worker** that executes a test from that file, so it must be cheap and idempotent. The Playwright CI docs recommend \`workers: 1\` on CI for stability and reproducibility. That is a good default for a small suite on a 2-core runner. For a large suite with isolated test data, scale out instead: more workers on a bigger runner, plus sharding.
2. **\`retries\` only on CI**, combined with \`trace: 'on-first-retry'\`. The first attempt runs without tracing overhead, and a retried test always brings a trace. The *Test organisation* deep dive covers flaky triage and \`failOnFlakyTests\`.
3. **\`maxFailures\` and \`globalTimeout\`** are what keep a broken environment from burning 40 minutes of CI time and 900 identical failures.
4. **Timeouts are layered.** The test \`timeout\` bounds everything. \`actionTimeout\` and \`navigationTimeout\` make a stuck click fail after 10 s with a precise message, instead of an unhelpful "Test timeout of 45000ms exceeded" at the end. \`expect.timeout\` is separate and applies to web-first assertions only.
5. **Reporters.** On CI, use a quiet console reporter (\`dot\`), \`junit\` for the CI system's test tab, \`html\` with \`open: 'never'\` (otherwise the process can wait to serve the report), and \`blob\` so sharded runs can be merged. The next deep dive covers reporters in detail.
6. **\`webServer\` with \`reuseExistingServer: !isCI\`.** Locally, if you already have \`npm run dev\` running, Playwright reuses it. On CI, it always starts a fresh server and fails if the port is already taken, so a stale server from an earlier step can never be tested by mistake. Playwright polls \`url\` until it answers with 2xx, 3xx, 400, 401, 402 or 403 ("the server is up"), or until \`timeout\` (default 60 s) runs out. An array (Playwright 1.24+) starts the shop and the API together. The servers are stopped when the run ends.
7. **Projects.** Each project is a full copy of the run with its own \`use\`, \`testDir\`/\`testMatch\`, \`grep\`, \`retries\`, \`timeout\` and \`dependencies\`. \`devices[...]\` presets set the viewport, user agent, \`deviceScaleFactor\`, \`isMobile\`, \`hasTouch\` and the **browser engine**. \`iPhone 14\` runs on WebKit and \`Pixel 7\` on Chromium. This is emulation, not a real device. Firefox does not support \`isMobile\`, which is why there is no "mobile Firefox" preset.

### Syntax reference: options people get wrong

| Option | Level | Note |
|---|---|---|
| \`timeout\`, \`retries\`, \`testDir\`, \`testMatch\`, \`grep\` | top level or project | the project value overrides the top-level value |
| \`use.*\` | top level, project, \`test.use\` | merged per key (see precedence) |
| \`expect.timeout\` | top level or project | separate from \`actionTimeout\` |
| \`workers\`, \`fullyParallel\`, \`reporter\`, \`webServer\`, \`globalSetup\` | top level | \`fullyParallel\` can also be set per project |
| \`dependencies\`, \`teardown\` | project | teardown since Playwright 1.34, dependencies since 1.31 |
| \`trace\` / \`video\` | \`use\` | \`off\`, \`on\`, \`on-first-retry\`, \`on-all-retries\`, \`retain-on-failure\`, \`retain-on-first-failure\`, \`retain-on-failure-and-retries\` |
| \`screenshot\` | \`use\` | \`off\`, \`on\`, \`only-on-failure\`, \`on-first-failure\` |

## Config resolution: which value wins

For fixture options (everything under \`use\`), the most specific value wins. From lowest to highest priority:

1. Playwright's built-in defaults.
2. Top-level \`use\` in the config.
3. The project's \`use\`.
4. \`test.use({...})\` at the top of a spec file.
5. \`test.use({...})\` inside a \`test.describe\` (nested describes override outer ones).

CLI flags are applied on top of the config: \`--workers\`, \`--retries\`, \`--timeout\`, \`--headed\` (sets \`headless: false\`), \`--trace\`, \`--project\`, \`--grep\`.

\`\`\`ts
// tests/e2e/checkout-de.spec.ts
import { test, expect } from '@playwright/test';

test.use({ locale: 'de-DE' });                 // wins over the project's en-GB for this file

test.describe('guest checkout', () => {
  test.use({ storageState: { cookies: [], origins: [] } });   // wins over a project storageState
  test('shows the cart icon', async ({ page }) => {
    await page.goto('checkout.html');           // relative to use.baseURL
    await expect(page.getByTestId('shopping-cart-link')).toBeVisible();
  });
});
\`\`\`

Things interviewers probe:

- **The merge is per option, not deep.** If the project sets \`extraHTTPHeaders: { 'x-tenant': 'uk' }\` and a file sets \`extraHTTPHeaders: { 'x-debug': '1' }\`, the file's object **replaces** the project's object. Spread the shared headers in yourself.
- **\`test.use\` cannot be called inside a test.** It configures fixtures before they are created. To change a value at runtime, create a new context (\`browser.newContext({...})\`) or use an option fixture.
- **Options that change the worker, such as \`browserName\`, \`headless\` or \`channel\`, set in \`test.use\` force a new worker** for those tests, because the browser is worker-scoped. Prefer projects for browser choice.
- **Non-\`use\` settings** follow their own chain: \`test.setTimeout()\` / \`test.slow()\` > \`test.describe.configure({ timeout, retries })\` > project > top level.

## Projects as a design tool

| Use projects for | Example |
|---|---|
| Browser and device matrix | \`chromium\`, \`firefox\`, \`webkit\`, \`mobile-safari\` |
| Test tiers | \`smoke\` with \`grep: /@smoke\\b/\`, \`visual\` with \`grep: /@visual/\` |
| Dependencies | \`setup\` → UI projects, \`cleanup\` as the setup's \`teardown\` |
| Different test types | \`api\` with its own \`testDir\` and \`baseURL\`, no browser started |
| Personas (option fixtures) | \`customer\`, \`seller\` projects with \`use: { persona: 'seller' }\` |

**How dependencies work.** The runner runs every test in the dependency project first. If any of them fails, the dependent projects are **not run** and are reported as skipped. A \`teardown\` project runs after **all** projects that depend on its setup project have finished. Filters such as \`--grep\` and \`--shard\` select the primary tests, and their dependencies still run. \`--no-deps\` skips dependencies and teardowns, which is useful when you are iterating locally and the setup state already exists.

ShopEasy detail: the web shop keeps the logged-in user and the cart in **sessionStorage**, which \`storageState\` does not save (see the *Auth state and API testing* lesson). So for ShopEasy, the setup project checks that the API is healthy and seeds data. Log in per test through a fixture or an init script rather than with a saved storage state.

## Environment management

### Loading variables: dotenv or Node's built-in support

\`\`\`ts
// config/load-env.ts — option A: the dotenv package (works on every Node version)
import dotenv from 'dotenv';
import path from 'path';

const testEnv = process.env.TEST_ENV ?? 'local';
dotenv.config({ path: path.resolve(__dirname, '..', \`.env.\${testEnv}\`) });
// variables that are already set (from CI) are NOT overwritten by default — CI wins over the file
\`\`\`

\`\`\`ts
// config/load-env.ts — option B: Node's built-in loader, no dependency
import fs from 'fs';
import path from 'path';

const file = path.resolve(__dirname, '..', \`.env.\${process.env.TEST_ENV ?? 'local'}\`);
if (fs.existsSync(file)) process.loadEnvFile(file);   // throws if the file is missing, so check first
\`\`\`

Version facts: \`node --env-file=.env\` arrived in **Node 20.6**, and \`process.loadEnvFile()\` in **Node 21.7** (backported to **20.12**). The \`--env-file\` flag applies to a \`node\` command. You start the runner with \`npx playwright test\`, so calling \`process.loadEnvFile()\` inside the config is the practical built-in route. Like dotenv, it does not overwrite variables that are already set. Recent \`dotenv\` versions print an "injecting env" line on every load. Pass \`quiet: true\` if the noise bothers you, which matters because the config is loaded once per worker. If your \`package.json\` has \`"type": "module"\`, \`__dirname\` does not exist. Use \`path.dirname(fileURLToPath(import.meta.url))\` instead.

### A typed, validated env module (fail fast)

\`\`\`ts
// config/env.ts
import './load-env';
import { z } from 'zod';

const EnvSchema = z.object({
  TEST_ENV: z.enum(['local', 'qa', 'staging', 'prod']).default('local'),
  BASE_URL: z.string().url().refine((u) => u.endsWith('/'), 'BASE_URL must end with /'),
  API_URL: z.string().url(),
  SHOP_USER: z.string().min(1),
  SHOP_PASS: z.string().min(1),
  ALLOW_DATA_RESET: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => \`  \${i.path.join('.')}: \${i.message}\`).join('\\n');
  throw new Error(\`Invalid test environment configuration:\\n\${problems}\`);   // fails before any test runs
}
if (parsed.data.TEST_ENV === 'prod' && parsed.data.ALLOW_DATA_RESET) {
  throw new Error('ALLOW_DATA_RESET must never be true against prod');
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
\`\`\`

\`\`\`bash
# .env.local  — committed? NO. Commit .env.example with the keys and safe placeholders instead.
TEST_ENV=local
BASE_URL=http://localhost:5180/practice-site/
API_URL=http://localhost:5181
SHOP_USER=standard_user
SHOP_PASS=change-me
ALLOW_DATA_RESET=true
\`\`\`

Why a module instead of \`process.env.X\` everywhere:

- **Fail fast.** A missing \`SHOP_PASS\` breaks the run in 200 ms with a list of every bad variable. Without it, you get 300 login failures and a confusing report.
- **Types.** \`env.ALLOW_DATA_RESET\` is a \`boolean\`, and \`env.TEST_ENV\` is a union type. Code can only branch on valid environment names.
- **One place** for safety rules, such as "never reset data on prod".
- \`z.string().url()\` works in zod 3 and zod 4. Zod 4 also offers \`z.url()\` and marks the method form as deprecated. Without zod, a 15-line guard does the same job:

\`\`\`ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing required env var \${name} (see .env.example)\`);
  return value;
}
export const env = { BASE_URL: required('BASE_URL'), SHOP_PASS: required('SHOP_PASS') } as const;
\`\`\`

### Per-environment configuration: three approaches

\`\`\`bash
# A — one config, environment chosen by a variable
TEST_ENV=staging npx playwright test --project=smoke

# B — one config file per environment
npx playwright test --config=playwright.staging.config.ts

# C — one project per environment inside one config
npx playwright test --project=staging-chromium
\`\`\`

\`\`\`ts
// B done properly: the environment file extends the base, never copies it
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig(base, {               // later configs override earlier ones; check the merged
                                                  // result with npx playwright test --list before relying on it
  use: { baseURL: 'https://staging.shopeasy.example/' },
  retries: 2,
});
\`\`\`

| | A: env var + one config | B: config per env | C: projects per env |
|---|---|---|---|
| How it works | \`TEST_ENV\` selects \`.env.<env>\`; the config reads \`env\` | \`--config\` selects a file that extends a base | each env is a project with its own \`baseURL\` |
| Advantages | one source of truth, same command everywhere, CI only sets variables | room for structural differences (prod: read-only, no webServer) | everything is visible in one file |
| Disadvantages | env-specific structure needs \`if\`s | drift if files are copied instead of extended | projects multiply (3 envs × 5 browsers = 15); easy to run prod by accident with a bare \`npx playwright test\` |
| Performance | same | same | same, but a careless run executes every env |
| Maintainability | high | medium | low once the matrix grows |
| Scalability | adding an env = adding a file of variables | adding an env = adding a config file | combinatorial |
| When to use | default for almost every team | a structurally different run such as prod smoke | tiny suites, or comparing two envs in one run |

**Recommended approach.** I'd recommend A as the backbone: one config, a typed env module, \`TEST_ENV\` set by the pipeline, secrets from the CI secret store. The trade-off is a few environment conditionals in the config, such as \`webServer\` only for \`local\`. For production I'd add a single extending config (B) that hard-wires the safety: \`grep: /@prod-safe/\`, a read-only account, \`retries: 0\` and no \`webServer\`. Then nobody can run destructive tests against prod by forgetting a flag. I keep projects for browsers and tiers, not environments.

### Secrets

- CI stores secrets (GitHub \`secrets.*\`, Jenkins Credentials, Vault or a cloud secret manager) and injects them as environment variables. Plain values such as URLs go in non-secret variables (\`vars.*\`).
- \`.env*\` goes in \`.gitignore\`, except a committed \`.env.example\` with keys and placeholders. Add a secret scanner (for example gitleaks or GitHub push protection) as a safety net.
- **Do not log secrets.** Be careful with \`console.log(env)\`, \`DEBUG=pw:api\` (it prints URLs and headers), and traces: a trace records \`fill()\` values and request headers, so a trace of a login step contains the password. Use dedicated, low-privilege test accounts per environment, rotate them, and keep artifact retention short.
- GitHub masks secrets in logs, but **not** inside uploaded artifacts such as reports and traces.

## Global setup and teardown: two mechanisms

\`\`\`ts
// tests/global.setup.ts — a setup PROJECT (recommended)
import { test as setup, expect } from '@playwright/test';
import { env } from '../config/env';

setup('API is up and the seed data is fresh', async ({ request }) => {
  const health = await request.get(\`\${env.API_URL}/api/health\`);
  await expect(health).toBeOK();
  expect(await health.json()).toMatchObject({ status: 'UP' });

  if (env.ALLOW_DATA_RESET) {                      // local only — /api/reset wipes every user's carts and orders
    const reset = await request.post(\`\${env.API_URL}/api/reset\`);
    await expect(reset).toBeOK();
  }
});
\`\`\`

\`\`\`ts
// tests/global.teardown.ts — runs after every project that depends on 'setup'
import { test as teardown } from '@playwright/test';
teardown('report data clean-up', async ({ request }) => {
  // delete test-owned data created under a run id, e.g. users named e2e_<runId>_*
});
\`\`\`

\`\`\`ts
// global-setup.ts — the older globalSetup FUNCTION
import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;     // fixtures and use options are not applied here
  process.env.RUN_ID = \`e2e_\${Date.now()}\`;       // visible to all tests (workers start later)
  // any browser you need here you must launch, trace and close yourself
}
// playwright.config.ts: globalSetup: './global-setup.ts', globalTeardown: './global-teardown.ts'
\`\`\`

| | Setup / teardown projects | \`globalSetup\` / \`globalTeardown\` |
|---|---|---|
| How it works | normal tests in a project that others list in \`dependencies\` | one function run by the runner before any worker starts |
| Fixtures (\`page\`, \`request\`, custom) | yes | no, build everything by hand |
| Config \`use\` (baseURL, headless, testIdAttribute) | applied | ignored; you read \`config\` yourself |
| Trace, screenshots | automatic per your \`use\` settings | only if you code \`context.tracing.start/stop\` |
| HTML report | appears as tests with steps and errors | invisible; a failure is a stack trace in the console |
| Retries, timeouts | the normal test rules | none |
| Selective | only for projects that declare the dependency; \`--no-deps\` skips it | always runs |
| Passing data | files (e.g. storage state), API state | also \`process.env\`, files |
| When to use | almost always: login, seeding, health checks | one-off process-level work: starting a non-HTTP service, computing a run id |

**Recommendation:** use setup projects. They are visible, traced and use fixtures, and a failure explains itself in the report. Keep \`globalSetup\` for process-level work that does not need a browser or fixtures.

## Workers, sharding and merging results

- **Workers** are processes on one machine (\`--workers=4\` or \`workers: '50%'\`). Each worker has its own browser, so the limits are CPU and memory, and also **test data**: four workers logging in as \`standard_user\` against the API share one server-side cart.
- **Sharding** splits the run plan across machines: \`npx playwright test --shard=1/4\`. Every shard computes the same ordered list and takes its slice, so all shards must run the same code, the same filters and the same Playwright version. With \`fullyParallel: true\`, the split is per test and well balanced. Without it, the split is per file, and one big file can make one shard the long pole.
- **Blob reporter + \`merge-reports\`** (both since Playwright 1.37): each shard writes \`blob-report/*.zip\` containing results, attachments and traces. A final job downloads them all and runs \`npx playwright merge-reports --reporter html ./all-blob-reports\`. The result is **one** HTML report, with correct flaky and retry information across shards. You can merge into any reporter (\`--reporter junit\`) or several at once with \`--config merge.config.ts\`.

## CI/CD: GitHub Actions (PR smoke, nightly sharded regression, merge)

\`\`\`yaml
# .github/workflows/e2e.yml
name: e2e
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 1 * * *'                  # nightly regression, 01:00 UTC
  workflow_dispatch:
    inputs:
      test_env:
        description: 'qa or staging'
        default: qa
        required: true

concurrency:                              # a new push cancels the outdated PR run
  group: e2e-\${{ github.ref }}
  cancel-in-progress: true

env:
  TEST_ENV: \${{ inputs.test_env || 'qa' }}
  BASE_URL: \${{ vars.QA_BASE_URL }}
  API_URL: \${{ vars.QA_API_URL }}
  SHOP_USER: \${{ vars.SHOP_USER }}
  SHOP_PASS: \${{ secrets.SHOP_PASS }}

jobs:
  smoke:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: npm                       # caches the npm download cache, keyed on package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium   # only the browser this job needs
      - run: npx playwright test --project=smoke
      - uses: actions/upload-artifact@v5
        if: \${{ !cancelled() }}
        with:
          name: smoke-report
          path: playwright-report
          retention-days: 7

  regression:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false                     # let every shard finish so the report is complete
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --project=chromium --project=firefox --project=webkit --shard=\${{ matrix.shardIndex }}/\${{ matrix.shardTotal }}
      - uses: actions/upload-artifact@v5
        if: \${{ !cancelled() }}
        with:
          name: blob-report-\${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1

  merge-reports:
    if: \${{ !cancelled() && github.event_name != 'pull_request' }}
    needs: [regression]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - uses: actions/download-artifact@v5
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v5
        with:
          name: html-report--attempt-\${{ github.run_attempt }}
          path: playwright-report
          retention-days: 14
\`\`\`

Explanation of the important lines:

- \`npx playwright install --with-deps\` downloads the browser builds that match the installed \`@playwright/test\` version, plus the Linux system libraries (it uses \`apt\`, so it needs root or sudo). \`npm ci\` alone gives *"Executable doesn't exist"*.
- **Caching.** \`setup-node\`'s \`cache: npm\` caches npm downloads. The Playwright CI docs advise **against** caching browser binaries: restoring the cache takes about as long as downloading them, and OS dependencies cannot be cached anyway. If you cache anyway, key the cache on the Playwright version.
- \`if: \${{ !cancelled() }}\` uploads evidence even when tests failed. A plain step would be skipped after a failure.
- \`fail-fast: false\` stops GitHub from cancelling shards 2 to 4 when shard 1 fails, which would leave you with a partial report.
- The \`github\` reporter adds failure annotations to the PR. The Playwright docs advise against it in matrix builds because the annotations multiply. Hence \`dot\` in the config, and the merged HTML report as the evidence.
- The action versions shown (\`checkout@v6\`, \`setup-node@v6\`, \`upload/download-artifact@v5\`) are the ones in the current Playwright sharding docs. Pin whatever your organisation approves.
- **Alternative:** run the job inside the official image instead of installing browsers: \`container: { image: mcr.microsoft.com/playwright:v1.64.1-noble, options: --user 1001 }\`, and skip the install step.

## CI/CD: Jenkins declarative pipeline

\`\`\`groovy
// Jenkinsfile
pipeline {
  agent {
    docker {
      image 'mcr.microsoft.com/playwright:v1.64.1-noble'   // same version as @playwright/test in package-lock.json
      args  '--ipc=host --init'
    }
  }
  parameters {
    choice(name: 'TEST_ENV', choices: ['qa', 'staging'], description: 'Target environment')
    choice(name: 'SUITE', choices: ['smoke', 'regression'], description: 'Which tier')
  }
  options {
    timeout(time: 60, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }
  environment {
    CI        = 'true'
    TEST_ENV  = "\${params.TEST_ENV}"
    BASE_URL  = 'https://qa.shopeasy.example/practice-site/'
    API_URL   = 'https://qa-api.shopeasy.example'
    SHOP_USER = 'standard_user'
    SHOP_PASS = credentials('shopeasy-qa-shop-pass')     // Jenkins Credentials, masked in the console
    HOME      = "\${env.WORKSPACE}"                       // npm cache writable for the container user
  }
  stages {
    stage('Install') {
      steps { sh 'npm ci' }
    }
    stage('Smoke') {
      when { expression { params.SUITE == 'smoke' } }
      steps { sh 'npx playwright test --project=smoke' }
    }
    stage('Regression') {
      when { expression { params.SUITE == 'regression' } }
      steps { sh 'npx playwright test --project=chromium --project=firefox --project=webkit' }
    }
  }
  post {
    always {
      junit testResults: 'results/junit.xml', allowEmptyResults: true
      publishHTML(target: [
        reportDir: 'playwright-report', reportFiles: 'index.html', reportName: 'Playwright Report',
        keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true
      ])
      archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
    }
  }
}
\`\`\`

- The Docker agent **already contains the browsers and OS dependencies**, so there is no \`playwright install\`. It does **not** contain \`@playwright/test\`, which comes from \`npm ci\`. If the image tag and the package version differ, Playwright cannot find its browser executables.
- \`publishHTML\` needs the HTML Publisher plugin. A common surprise: Jenkins' default Content-Security-Policy blocks the report's JavaScript, so the report shows a blank page. Either relax the CSP for that site (an admin decision) or open the report from the archived artifact, which is what I'd try first.
- \`junit\` gives Jenkins test trends and per-test history. A test that was retried and then passed appears as passed there. The HTML report is where *flaky* is visible.
- For shards in Jenkins, use \`parallel\` stages (or a \`matrix\`), each running \`--shard=N/4\` and stashing \`blob-report\`, plus a final stage that unstashes them and runs \`merge-reports\`.

## Docker locally

\`\`\`bash
# Reproduce "fails only on CI (Linux)" from a Windows or macOS laptop
docker run --rm -it --ipc=host --init \\
  -v "$PWD":/work -w /work \\
  -e TEST_ENV=qa -e BASE_URL -e API_URL -e SHOP_USER -e SHOP_PASS \\
  mcr.microsoft.com/playwright:v1.64.1-noble \\
  /bin/bash -c "npm ci && npx playwright test --project=chromium"
\`\`\`

- **Match the tag to your \`@playwright/test\` version** (\`v1.64.1\` is an example — read the version from your lockfile). Tags exist per Ubuntu base: \`-noble\` (24.04) and \`-jammy\` (22.04).
- \`--ipc=host\` is recommended for Chromium. Without it, Chromium can run out of shared memory and crash. \`--init\` avoids zombie processes with PID 1.
- The image runs as \`root\` by default, which disables the Chromium sandbox. That is acceptable for testing your own trusted app. For untrusted sites, use \`--user pwuser\` with the seccomp profile from the Playwright repo.
- Mounting a Windows \`node_modules\` into a Linux container breaks native binaries. Run \`npm ci\` **inside** the container, as above, or use a named volume for \`node_modules\`.
- Screenshot baselines differ between OSes because of fonts and anti-aliasing. Generate and compare \`toHaveScreenshot\` baselines inside the same image that CI uses.
- \`localhost\` inside the container is the container itself. To reach a dev server on the host, use \`host.docker.internal\` (Docker Desktop) or start the app inside the container.

## Quality gates

| Trigger | What runs | Blocks? | Target time |
|---|---|---|---|
| Pull request | lint + type-check (\`tsc --noEmit\`), \`@smoke\` on Chromium, API tests | yes, as **required status checks** in branch protection | under 10 min |
| Merge to main | regression on Chromium, sharded | blocks deploy to staging | under 25 min |
| Nightly | full regression on all browsers + mobile + visual, sharded, merged report | creates a ticket or alerts the channel; reviewed at stand-up | under 60 min |
| Post-deploy (staging/prod) | \`@prod-safe\` read-only smoke via the prod config | can trigger rollback | under 5 min |

Senior points: make the **job name** stable (required checks match by name), fail on \`test.only\` via \`forbidOnly\`, track the flaky rate, and decide with the team what "red nightly" means. Typically someone owns triage before 10:00, and a test that stays red for more than two days is fixed, quarantined with an owner, or deleted.

## Common mistakes and how they show up

- **\`Error: Timed out waiting 60000ms from config.webServer.\`** The \`url\` never answered with an accepted status (2xx, 3xx, 400–403). Check that the URL matches the dev server (for ShopEasy, the health URL is \`/api/health\` on 5181), add \`stdout: 'pipe'\` to see the server output, and raise \`timeout\` for cold builds.
- **\`http://localhost:5180 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true\`.** On CI, an earlier step left a server running. Remove that step, or let Playwright own the server.
- **\`page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL\`.** \`baseURL\` is undefined because an env var is missing. The validated env module turns this into one clear error before the run starts.
- **The \`/practice-site/\` path disappears.** \`baseURL\` lacks its trailing slash, or \`goto('/cart.html')\` uses a leading slash. URL resolution follows \`new URL(path, baseURL)\`.
- **Dependent projects are all "skipped".** The setup project failed. Open its result in the HTML report: it has a trace, which is the reason to use setup projects in the first place.
- **Shards report different test counts or duplicates.** The shards ran different commits, different \`--grep\` values, or a test list built from random data. Every shard must compute the identical plan.

## Best practices for experienced engineers

- Treat the config as production code. It should be reviewed, typed, and small. Move device lists and reporter choices into named constants if they grow.
- One command for every environment (\`TEST_ENV=x npx playwright test --project=y\`), and the same command locally, in CI and in Docker.
- Keep the setup project fast and idempotent. Never make tests depend on each other through files written mid-run.
- Pin Playwright exactly (\`"@playwright/test": "1.64.1"\`, no caret) and upgrade it with a PR that bumps the Docker tag in the same change.
- Time-box everything: \`timeout-minutes\` on jobs, \`globalTimeout\`, \`maxFailures\`.
- Evidence, not noise: traces on retry, screenshots on failure, short retention, and one merged report link posted to the PR or channel.

## Selenium (Java) equivalent, briefly

| Playwright | Selenium + TestNG + Maven |
|---|---|
| \`TEST_ENV\` + env module | Maven profiles (\`-Pqa\`) or \`-Denv=qa\`, \`config-qa.properties\` read by a \`ConfigReader\` |
| projects (browsers, tiers) | several \`testng.xml\` suites, \`<parameter name="browser">\`, \`<groups>\` |
| \`workers\`, \`fullyParallel\` | \`parallel="methods" thread-count="4"\` plus a \`ThreadLocal<WebDriver>\` you manage |
| \`--shard\` + merge | split suites across Grid nodes or CI jobs; merge reports yourself |
| browsers in a Docker image | Selenium Grid (\`selenium/hub\` + node images) and \`RemoteWebDriver\` |
| \`webServer\` | Maven plugins or a separate CI step |

\`\`\`xml
<!-- pom.xml: one profile per environment, the suite chosen by a property -->
<profile>
  <id>qa</id>
  <properties><env>qa</env><suiteXml>testng-smoke.xml</suiteXml></properties>
</profile>
<!-- surefire: <suiteXmlFiles><suiteXmlFile>\${suiteXml}</suiteXmlFile></suiteXmlFiles>
     <systemPropertyVariables><env>\${env}</env><gridUrl>\${gridUrl}</gridUrl></systemPropertyVariables> -->
\`\`\`

\`mvn test -Pqa -DgridUrl=http://grid:4444\` plays the same role as \`TEST_ENV=qa npx playwright test --project=smoke\`. The difference is that in Selenium you build the parallelism, isolation and report merging yourself.

## Interview questions

### Q: Walk me through the important options in your playwright.config.ts.
**Short answer (30–60 s):** \`testDir\`, and \`fullyParallel\` with \`workers\` for scheduling. \`forbidOnly\` and retries on CI only. Layered timeouts: test, action, navigation and expect. \`use\` for baseURL from a validated env module, plus trace on first retry and screenshots on failure. Several reporters, including blob for shards. \`webServer\` for local runs, and projects for browsers, tiers and a setup dependency.

**Detailed answer:** Explain each choice as a trade-off. \`fullyParallel\` balances shards but makes \`beforeAll\` run in every worker. CI retries plus \`on-first-retry\` give a trace without slowing the first attempt. \`actionTimeout\` gives a precise failure instead of a test timeout. \`reuseExistingServer: !process.env.CI\` reuses a server locally and guarantees a fresh one on CI. Mention that the config is loaded by the runner and by every worker, so top-level code must be side-effect free.

### Q: An option is set at the top level, in the project and in \`test.use\`. Which one wins?
**Short answer (30–60 s):** The most specific: describe-level \`test.use\`, then file-level \`test.use\`, then the project's \`use\`, then the top-level \`use\`, then the defaults. CLI flags such as \`--headed\` or \`--retries\` are applied on top.

**Detailed answer:** The merge is per option, so an object-valued option such as \`extraHTTPHeaders\` is replaced, not deep-merged. \`test.use\` runs before fixtures exist, so it cannot be called inside a test. Worker-level options such as \`browserName\` or \`headless\` in \`test.use\` force a separate worker, which is why browser choice belongs in projects. Non-\`use\` settings follow their own chain: \`test.setTimeout\` beats \`describe.configure\`, which beats project, which beats top level.

### Q: How do you run the same suite against QA, staging and production?
**Short answer (30–60 s):** One config and a typed env module chosen by \`TEST_ENV\`. URLs come from CI variables and credentials from CI secrets. The module validates and fails fast. For prod, a small config extends the base and allows only \`@prod-safe\`, read-only tests.

**Detailed answer:** Compare the three approaches (env var, config per env, projects per env) using the table. Explain dotenv vs \`process.loadEnvFile\` (Node 20.12+/21.7+), and that neither overwrites variables CI already set. Cover the zod schema with a refinement such as the trailing slash, and the safety rule that blocks data resets on prod. \`webServer\` applies only to \`local\`.

### Q: \`globalSetup\` or a setup project?
**Short answer (30–60 s):** A setup project in almost every case. It is a normal test, so it gets fixtures, config options, traces, retries and a place in the HTML report, and only the projects that depend on it trigger it. \`globalSetup\` is a bare function: no fixtures, no trace unless you code it, and invisible in the report.

**Detailed answer:** Explain \`dependencies\` (a failure skips dependents), \`teardown\` (since 1.34, runs after all dependents), \`--no-deps\` for local iteration, and that filters such as \`--grep\` and \`--shard\` still run dependencies. Keep \`globalSetup\` for process-level work such as computing a run id into \`process.env\`. Add the ShopEasy nuance: its session is in sessionStorage, so the setup project seeds and checks data instead of saving a login.

### Q: How does sharding work, and how do you get one report?
**Short answer (30–60 s):** \`--shard=i/n\` makes each machine compute the same ordered test list and run its slice. Each shard writes a blob report, and a final job downloads all blobs and runs \`merge-reports\` to produce one HTML (or JUnit) report.

**Detailed answer:** Balance needs \`fullyParallel\` (per-test split). All shards must share the commit, filters and version. \`fail-fast: false\` and \`!cancelled()\` uploads keep the report complete. The blob reporter and \`merge-reports\` exist since 1.37. Sharding does not isolate data: shards against one environment still share accounts, so test-owned data is still required.

### Q: Explain \`webServer\`, and what \`reuseExistingServer\` really does.
**Short answer (30–60 s):** Playwright starts the command, polls \`url\` (or \`port\`) until it responds (2xx, 3xx or 400–403), runs the tests, and stops the process at the end. With \`reuseExistingServer: true\`, if the URL already responds, it skips starting the server.

**Detailed answer:** Use \`!process.env.CI\`, so developers reuse a running server and CI always tests a fresh build. Use an array for app + API (since 1.24), and \`timeout\`, \`env\`, \`cwd\` and \`stdout: 'pipe'\` for diagnostics. Skip it for remote environments. It is not a deployment tool: on staging, test what the pipeline deployed.

### Q: Why should the Docker image tag match your Playwright version?
**Short answer (30–60 s):** The image ships browser builds for one Playwright release, and the npm package looks for exactly those builds. If they differ, you get "Executable doesn't exist" or subtle behaviour differences.

**Detailed answer:** Pin both, and bump them in the same PR. The image contains browsers and OS libraries but not \`@playwright/test\`, which you install with \`npm ci\` inside the container. Add \`--ipc=host\` for Chromium memory and \`--init\` for PID 1. Running as root disables the Chromium sandbox: fine for your own app, not for crawling untrusted sites.

### Q: What quality gates would you put around an e2e suite?
**Short answer (30–60 s):** Type-check and smoke tests on every PR as required checks, regression on merge or before deploy, the full cross-browser suite nightly, and a read-only smoke after each deploy. Flaky tests are tracked and owned.

**Detailed answer:** Size each tier by time budget, keep required-check names stable, and use \`forbidOnly\` and \`maxFailures\`. Use \`failOnFlakyTests\` once the flaky rate is low. Agree a policy for red nightlies, and report trends rather than single runs.

## Scenario-based questions

**1. The suite passes locally but every CI run fails with "Executable doesn't exist at /ms-playwright/chromium-…".** A version mismatch. The job uses \`mcr.microsoft.com/playwright:v1.6x\` while the lockfile resolved a different \`@playwright/test\` version, or a caret range upgraded it. Fix: pin the exact version, bump the image tag in the same PR, or drop the image and use \`npx playwright install --with-deps\`. Then add a CI check that compares the two versions.

**2. Staging runs started deleting other teams' test data.** Someone pointed the local config at staging, and the setup project called \`/api/reset\`. Act now: disable the reset. Long term: the env module refuses \`ALLOW_DATA_RESET\` outside \`local\`, the reset sits behind that flag, tests own their data (unique users created through \`POST /api/users\`) and clean only what they created, and prod runs through the read-only extending config.

**3. The nightly takes 70 minutes and the team wants it under 20.** Measure first: per-shard duration from the merged report, and the slowest tests. Then turn on \`fullyParallel\` so shards balance, increase shards, move UI set-up to API calls, and split visual and mobile into their own projects and jobs. Trace only on retry. Check for long \`webServer\` start-up and unneeded browser installs (install only what the job runs). Report the before and after numbers.

## Tricky follow-ups

- **Does \`retries: 1\` in the config apply to the setup project?** Yes. Setup is a normal project and inherits the top-level retries unless it sets its own.
- **If \`globalSetup\` sets \`process.env.RUN_ID\`, can tests read it?** Yes. Workers start after global setup and inherit the environment. A value set inside one test is not shared with other workers.
- **Does \`--grep @smoke\` skip the setup project?** No. Dependencies of the selected tests still run, and \`--no-deps\` is the switch that skips them.
- **Is \`devices['iPhone 14']\` a real iPhone?** No. It is WebKit with an iPhone viewport, user agent, scale factor and touch. It catches layout and touch-path issues, not iOS Safari-specific bugs.
- **Why not cache the browsers in GitHub Actions?** The Playwright docs say restoring takes about as long as downloading, and OS dependencies cannot be cached, so the gain is small and the cache adds a staleness risk.`,
  keyPoints: [
    'The config is loaded by the runner and again by every worker: keep top-level code (dotenv, env validation) fast and free of side effects.',
    'use options resolve most-specific-wins: describe test.use > file test.use > project use > top-level use > defaults; the merge is per option (objects are replaced), and CLI flags apply on top.',
    'Projects model browsers/devices, tiers (grep) and dependencies; setup projects (and teardown, 1.34+) beat globalSetup because they get fixtures, traces, retries and report visibility.',
    'One config + a typed, validated env module chosen by TEST_ENV; secrets from the CI store, never a committed .env (commit .env.example); a separate extending config only for structurally different runs such as read-only prod smoke.',
    'dotenv works everywhere; Node\'s built-in process.loadEnvFile() needs Node 20.12+/21.7+; neither overwrites variables CI already set.',
    'Retries on CI only with trace on-first-retry; actionTimeout/navigationTimeout give precise failures; maxFailures and globalTimeout protect CI time.',
    'Sharding: same plan on every machine, fullyParallel for balance, blob reporter + merge-reports (1.37+) for one report, fail-fast false and !cancelled() uploads.',
    'CI: npx playwright install --with-deps (or the official Docker image pinned to the same version, --ipc=host --init); gates = smoke on PR as required checks, regression on merge, full matrix nightly, read-only smoke after deploy.',
  ],
  mistakes: [
    'Reading process.env.X ad hoc in page objects and the config — a missing variable surfaces as "Cannot navigate to invalid URL" in 300 tests. Fix: one validated env module that throws a list of every missing or invalid variable before the run starts.',
    'Using globalSetup for login and seeding, then debugging its failures from a bare stack trace. Fix: move it to a setup project — the failure appears in the HTML report with a trace, and dependents are cleanly skipped.',
    'Running /api/reset (or other destructive set-up) from a config that can be pointed at a shared environment. Fix: guard it behind an env flag that the env module forbids outside local, and make tests own and clean their own data.',
    'Mismatched Docker image tag and @playwright/test version (often via a ^ range) — "Executable doesn\'t exist". Fix: pin the exact package version and bump the tag in the same PR; check the two match in CI.',
    'Sharded runs that upload only on success or cancel sibling shards — the merged report is missing exactly the failed shard. Fix: fail-fast: false on the matrix and if: !cancelled() on every upload and on the merge job.',
    'Copy-pasting playwright.staging.config.ts from the base config, which drifts within weeks. Fix: one config driven by TEST_ENV, or an environment config that imports the base and overrides only what differs via defineConfig(base, {...}).',
  ],
  tryIt: `Build an environment-aware ShopEasy setup:
1. Create \`config/env.ts\` with a zod schema (or a small guard) for \`TEST_ENV\`, \`BASE_URL\` (must end with \`/\`), \`API_URL\`, \`SHOP_USER\`, \`SHOP_PASS\` and \`ALLOW_DATA_RESET\`, loaded from \`.env.local\`. Commit only \`.env.example\`. Delete \`SHOP_PASS\` from your \`.env.local\` and confirm the run fails in under a second with a readable message.
2. Write \`playwright.config.ts\` with a two-server \`webServer\` array (\`npm run dev\` on \`http://localhost:5180/practice-site/login.html\` and \`npm run api\` on \`http://localhost:5181/api/health\`), \`reuseExistingServer: !process.env.CI\`, and the projects \`setup\` (health check + \`POST /api/reset\` only when allowed), \`smoke\`, \`chromium\`, \`mobile-safari\` and \`api\`.
3. Add a \`test.use({ locale: 'de-DE' })\` file and assert with \`page.evaluate(() => navigator.language)\` that it overrides the project's \`en-GB\`.
4. Run \`npx playwright test --project=chromium --shard=1/2 --reporter=blob\` and \`--shard=2/2\` into two folders, then merge both with \`npx playwright merge-reports --reporter html <dir>\` and open the single report.
5. Write the GitHub Actions file from this lesson for your repo and check every upload step has \`if: \${{ !cancelled() }}\`.`,
  problems: ['pw-014', 'pw-035', 'pw-031', 'pw-020', 'pw-043'],
}
