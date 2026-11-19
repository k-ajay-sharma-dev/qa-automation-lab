export default {
  id: 'pw-035',
  category: 'playwright',
  kind: 'quiz',
  title: 'Reading playwright.config.ts: what each option really changes',
  level: 'INTERMEDIATE',
  tags: ['config', 'baseURL', 'retries', 'projects', 'webServer', 'use'],
  estMinutes: 12,
  scenario: `You inherit the ShopEasy Playwright repo from a contractor. CI is green, but nobody on the team can explain the config file, and
a new tester just asked why \`page.goto('inventory.html')\` works without a host. Before the team changes anything, walk through the config
and make sure you can predict what each option does.`,
  description: "Answer each question about this config:\n\n```ts\nimport { defineConfig, devices } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests',\n  retries: process.env.CI ? 2 : 0,\n  use: {\n    baseURL: 'http://localhost:5173/practice-site/',\n    trace: 'on-first-retry',\n  },\n  projects: [\n    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },\n    { name: 'mobile', use: { ...devices['Pixel 7'] } },\n  ],\n  webServer: {\n    command: 'npm run dev',\n    url: 'http://localhost:5173',\n    reuseExistingServer: !process.env.CI,\n  },\n});\n```",
  questions: [
    {
      q: "With this config, where does `await page.goto('inventory.html')` go?",
      options: [
        'It fails: goto needs an absolute URL',
        'http://localhost:5173/practice-site/inventory.html — relative URLs are resolved against use.baseURL',
        'http://localhost:5173/inventory.html — the path in baseURL is ignored',
        'file://inventory.html',
      ],
      answer: 1,
      why: "goto, request.get and toHaveURL resolve relative URLs against baseURL with normal URL rules. Because baseURL ends with a slash and the path has none, the result keeps /practice-site/. (A leading slash — '/inventory.html' — would drop the /practice-site/ part.)",
    },
    {
      q: 'A test fails once on CI and passes on the first retry. What does the report show, and what do you get to debug it?',
      options: [
        'Passed — and no trace is kept',
        'Flaky — and a trace for the retry, because trace is on-first-retry',
        'Failed — retries are only for local runs',
        'Skipped',
      ],
      answer: 1,
      why: "retries: 2 on CI lets the test run again; a test that fails then passes is reported as flaky, not hidden. 'on-first-retry' records a trace only when the first retry runs, so you can see what happened without the cost of tracing every passing test.",
    },
    {
      q: 'How many times does each test run on a normal (no failures) CI run?',
      options: [
        'Once',
        'Twice — once per project (chromium and mobile)',
        'Three times — retries: 2',
        'It depends on the number of workers',
      ],
      answer: 1,
      why: 'Every project runs the whole testDir (unless testMatch/grep narrow it). Retries only happen after a failure. Workers change how many tests run at the same time, not how many times each runs. Use --project=chromium to run one project.',
    },
    {
      q: 'What does the webServer block do?',
      options: [
        'Deploys the app to a server',
        'Starts npm run dev before the tests, waits until the url responds, and stops it afterwards; locally it reuses a dev server that is already running',
        'Makes Playwright proxy every request through localhost:5173',
        'Nothing on CI because reuseExistingServer is false',
      ],
      answer: 1,
      why: 'Playwright launches the command, polls the url until it answers, and kills the process at the end. reuseExistingServer: !CI means: on your laptop, use the server you already started; on CI, always start a fresh one (and fail if the port is taken).',
    },
    {
      q: "One test needs to run as a guest with a different locale. Where do you override `use` options for just that file?",
      options: [
        'Edit playwright.config.ts and remember to change it back',
        "test.use({ locale: 'de-DE', storageState: { cookies: [], origins: [] } }) at the top of the spec file or inside a describe",
        'Pass --locale on the command line',
        'It is not possible; use options are global',
      ],
      answer: 1,
      why: 'Options merge from config → project → test.use in a file or describe block. test.use is the scoped override; a global edit affects every test.',
    },
  ],
  hints: ['Think about the order of precedence: top-level config → project use → test.use in the file.'],
  explanation: `Key ideas a reviewer expects you to know:

- **use** holds options for every test (baseURL, trace, screenshot, viewport, storageState…). Projects and \`test.use\` override it.
- **baseURL** makes tests environment-independent: switch staging/QA with an env var in one place.
- **retries** with traces on the first retry turns random failures into *flaky* reports you can investigate, instead of hiding them.
- **projects** multiply the run: one per browser/device/setup. They can also depend on each other (a setup project that logs in).
- **webServer** gives a one-command run locally and on CI.`,
  mistakes: [
    "Writing goto('/inventory.html') with a leading slash when baseURL has a path — it resolves to the host root.",
    'Setting retries high to make CI green and never looking at the flaky list.',
    'Expecting projects to split the tests between browsers — each project runs all of them.',
  ],
  interview: [
    { q: 'How do you run the same suite against QA and staging?', a: "Read baseURL from an environment variable in playwright.config.ts (baseURL: process.env.BASE_URL ?? 'http://localhost:5173/') and use relative URLs in tests. CI sets BASE_URL per environment." },
    { q: 'What is the difference between retries and a flaky test fix?', a: 'Retries only re-run and label the test flaky; they buy time and give traces. The fix is finding the cause — a missing web-first assertion, shared data or a race — and the flaky label shows you where to look.' },
  ],
}
