export default {
  id: 'pw-014',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'playwright.config.ts for a real team: browsers, baseURL, retries, traces, reporters',
  level: 'ADVANCED',
  tags: ['config', 'projects', 'retries', 'trace', 'reporters', 'parallel'],
  estMinutes: 25,
  scenario: `The migration is going well, but the config is still the generated default: tests point at \`localhost\` in every file, a failure in CI
leaves no evidence, and the run uses one browser. Before the suite goes into the release pipeline, the tech lead lists what the config must do —
the same things the Selenium framework spread over \`testng.xml\`, \`config.properties\`, a \`DriverFactory\` and an \`ExtentReports\` listener.`,
  description: `Write \`playwright.config.ts\` with \`defineConfig\`.

**Acceptance**
- \`testDir: './tests'\`, \`fullyParallel: true\`, \`forbidOnly\` when \`process.env.CI\` is set.
- \`retries\`: 2 on CI, 0 locally. \`workers\`: 2 on CI, default locally.
- \`reporter\`: \`list\` in the console **and** an \`html\` report that does not auto-open (\`open: 'never'\`), plus \`junit\` for the CI dashboard.
- \`use\`: \`baseURL\` from \`process.env.BASE_URL\` falling back to \`http://localhost:5180/practice-site/\`; \`trace: 'on-first-retry'\`;
  \`screenshot: 'only-on-failure'\`; \`video: 'retain-on-failure'\`.
- \`projects\` for **chromium**, **firefox** and **webkit** using \`devices[...]\` presets, plus one mobile project (\`Pixel 7\`).`,
  starterCode: `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  // TODO: retries, workers, reporters, baseURL, trace/screenshot, browsers
  use: {
    headless: true,
  },
});
`,
  solution: `import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/',
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
`,
  checks: [
    { label: 'Retries depend on CI', pattern: 'retries\\s*:\\s*[^,\\n]*(CI|isCI)[^,\\n]*\\?\\s*\\d+\\s*:\\s*0', hint: 'retries: process.env.CI ? 2 : 0' },
    { label: 'baseURL from env with fallback', pattern: "baseURL\\s*:\\s*process\\.env\\.\\w+\\s*(\\?\\?|\\|\\|)\\s*['\"]http", hint: "baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/'" },
    { label: 'Trace on first retry', pattern: "trace\\s*:\\s*['\"](on-first-retry|retain-on-failure)['\"]", hint: "trace: 'on-first-retry'" },
    { label: 'Screenshot only on failure', pattern: "screenshot\\s*:\\s*['\"]only-on-failure['\"]", hint: "screenshot: 'only-on-failure'" },
    { label: 'HTML reporter that does not open', pattern: "\\[\\s*['\"]html['\"]\\s*,\\s*\\{[^}]*open\\s*:\\s*['\"]never['\"]", hint: "['html', { open: 'never' }]" },
    { label: 'Projects for three browser engines', pattern: "devices\\[\\s*['\"]Desktop Chrome['\"]\\s*\\][\\s\\S]*devices\\[\\s*['\"]Desktop Firefox['\"]\\s*\\][\\s\\S]*devices\\[\\s*['\"]Desktop Safari['\"]\\s*\\]", hint: "{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }" },
    { label: 'Parallel and forbidOnly configured', pattern: 'fullyParallel\\s*:\\s*true[\\s\\S]*forbidOnly|forbidOnly[\\s\\S]*fullyParallel\\s*:\\s*true', hint: 'fullyParallel: true, forbidOnly: !!process.env.CI' },
  ],
  hints: [
    'process.env.CI is set automatically by GitHub Actions, GitLab, Jenkins (with the right plugin) and most CI systems.',
    "Spread a device preset: use: { ...devices['Desktop Firefox'] } — it sets browserName, viewport, user agent.",
    "trace: 'on-first-retry' records a trace only when a test is retried — cheap locally, full evidence in CI.",
  ],
  explanation: `One config file replaces four Selenium-era pieces:

| Selenium framework | playwright.config.ts |
|---|---|
| \`config.properties\` + \`ConfigReader\` | \`use.baseURL\` from \`process.env\` |
| \`DriverFactory\` (browser switch) | \`projects\` with \`devices\` presets |
| \`testng.xml\` parallel / thread-count | \`fullyParallel\`, \`workers\` |
| \`IRetryAnalyzer\`, Extent listener, screenshot-on-failure listener | \`retries\`, \`reporter\`, \`screenshot\`, \`trace\`, \`video\` |

Retries are a **diagnosis tool**, not a cure: a test that passes on retry is reported as *flaky* in the HTML report, and with
\`trace: 'on-first-retry'\` you get a full trace of the failed attempt. \`forbidOnly\` stops a forgotten \`test.only\` from silently
skipping the rest of the suite in CI.

Run one project with \`npx playwright test --project=firefox\`; override anything per project (e.g. a \`setup\` project with \`dependencies\`).`,
  mistakes: [
    'Setting retries: 3 everywhere to make the pipeline green — flaky tests hide real race conditions.',
    "trace: 'on' in CI for every test — huge artifacts and slower runs; use on-first-retry or retain-on-failure.",
    "A baseURL without a trailing slash ('…/practice-site') — relative goto('login.html') then resolves to /login.html.",
    'Putting secrets (passwords, tokens) directly in the config — read them from environment variables.',
  ],
  interview: [
    { q: 'How do you run the same tests on several browsers?', a: "Define projects in playwright.config.ts, each with use: { ...devices['Desktop Firefox'] } etc. Every test runs once per project; --project selects one." },
    { q: 'What is the difference between workers and fullyParallel?', a: 'workers is the number of parallel OS processes. By default files run in parallel but tests inside a file run in order; fullyParallel: true also parallelises tests within a file.' },
    { q: 'How do you get evidence for a failure that only happens in CI?', a: "trace: 'on-first-retry' (or retain-on-failure), screenshot and video on failure, the HTML report uploaded as a CI artifact, then open the trace with npx playwright show-trace." },
  ],
}
