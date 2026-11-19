export default {
  id: 'pw-020',
  category: 'playwright',
  kind: 'quiz',
  title: 'Debugging and CI: the test that only fails on GitHub Actions',
  level: 'EXPERT',
  tags: ['debugging', 'trace-viewer', 'codegen', 'ui-mode', 'ci', 'github-actions', 'cucumber-js'],
  estMinutes: 15,
  scenario: `Monday stand-up: "\`checkout.spec.ts\` passed on my machine 20 times, but fails about 1 in 5 on GitHub Actions — and the BDD nightly
run executed the @wip scenarios again." You are the person the team asks. Each question is a real decision in the investigation.`,
  description: 'Choose the most effective next step for each situation.',
  questions: [
    {
      q: 'The spec fails intermittently only in CI. The config has `retries: 2` and `trace: \'on-first-retry\'`. What is your FIRST move?',
      options: [
        'Add page.waitForTimeout(3000) before the failing line and push',
        'Download the playwright-report artifact, open the failed attempt, and inspect its trace (npx playwright show-trace trace.zip or trace.playwright.dev): actions, DOM snapshots before/after, network and console',
        'Increase the global timeout to 120 s',
        'Mark the test test.skip until someone has time',
      ],
      answer: 1,
      why: 'The trace of the failed attempt shows exactly what the page looked like at each action, which requests were pending and what the console said — evidence instead of guessing. Sleeps, bigger timeouts and skips hide the race condition.',
    },
    {
      q: 'You want to step through the test line by line in a headed browser with the Playwright Inspector, pausing before each action. Which command?',
      options: [
        'npx playwright test checkout.spec.ts --debug',
        'npx playwright show-report',
        'npx playwright install --with-deps',
        'npx playwright test --reporter=dot',
      ],
      answer: 0,
      why: '--debug runs headed with the Inspector, timeouts disabled, pausing before every action (PWDEBUG=1 does the same; await page.pause() pauses at a chosen line). show-report opens the HTML report; install downloads browsers.',
    },
    {
      q: 'A manual tester on the team wants to explore the page and get robust locators for a new page object quickly. What do you suggest?',
      options: [
        'Copy XPaths from Chrome DevTools',
        "npx playwright codegen http://localhost:5180/practice-site/checkout.html — it records actions and suggests user-facing locators (getByRole, getByLabel); use 'Pick locator' to test one",
        'Write the locators by guessing and run the suite',
        'Use page.content() and search the HTML string',
      ],
      answer: 1,
      why: 'Codegen and the Pick locator tool (also in UI mode and the VS Code extension) generate the locators Playwright itself recommends. Its output goes into page objects, not directly into the test as a long script.',
    },
    {
      q: 'Which feature gives you a watch mode with a timeline, DOM snapshots per step, and re-run of single tests while you edit?',
      options: ['Codegen', 'UI mode: npx playwright test --ui', 'The list reporter', 'test.describe.serial'],
      answer: 1,
      why: 'UI mode is the day-to-day development tool: pick tests, watch files, time-travel through each step with trace-like snapshots, and use the locator picker.',
    },
    {
      q: 'In the GitHub Actions workflow, tests fail with "Executable doesn\'t exist at …/chromium". Which step is missing?',
      options: [
        'npm run build',
        'npx playwright install --with-deps (after npm ci) — downloads the browser builds and the OS libraries they need',
        'apt-get install google-chrome',
        'npm install selenium-webdriver',
      ],
      answer: 1,
      why: 'npm ci installs the @playwright/test package but not the browsers. playwright install --with-deps fetches the matching Chromium/Firefox/WebKit builds plus system dependencies on the Linux runner. (Alternative: run inside the official mcr.microsoft.com/playwright Docker image.)',
    },
    {
      q: 'The nightly Cucumber job ran @wip scenarios and the report vanished when tests failed. Which combination fixes both?',
      options: [
        'Delete the @wip scenarios and add continue-on-error: true to the whole job',
        "Run npx cucumber-js --profile ci where the ci profile in cucumber.js sets tags: 'not @wip', and upload the reports folder with actions/upload-artifact using if: always() (or !cancelled())",
        'Run with --dry-run so nothing fails',
        'Set retries: 5 in playwright.config.ts',
      ],
      answer: 1,
      why: 'Profiles in cucumber.js keep CI options (tags, formatters, parallel, retry) in version control. By default a step runs only if previous steps succeeded, so the artifact upload needs if: always() to publish evidence of a failed run. playwright.config.ts has no effect on cucumber-js.',
    },
  ],
  hints: ['Evidence first (trace, report), then reproduce (--debug, UI mode), then fix the cause — never a sleep.'],
  explanation: `The Playwright debugging toolbox, in the order you use it:

| Situation | Tool |
|---|---|
| Failed in CI | HTML report artifact → **trace viewer** (\`show-trace\`, or trace.playwright.dev) |
| Reproduce locally, step by step | \`--debug\` / \`PWDEBUG=1\` / \`await page.pause()\` |
| Daily development | **UI mode** \`--ui\`, VS Code extension |
| Find locators / record a draft | **codegen**, Pick locator |
| Headed run to watch | \`--headed\`, \`--project=chromium\`, \`-g "title"\` |

CI essentials: \`npm ci\`, \`npx playwright install --with-deps\`, run with \`CI=true\` (retries, forbidOnly, workers from the config),
and always upload \`playwright-report/\` (and the Cucumber \`reports/\`) as artifacts. Large suites shard across machines with \`--shard=1/4\`.`,
  mistakes: [
    'Fixing a CI-only failure with a sleep — the race condition is still there, just rarer.',
    'Uploading artifacts without if: always() — exactly the failed runs lose their report.',
    'Forgetting playwright install in CI — the npm package does not contain browsers.',
    'Leaving await page.pause() or test.only in committed code — forbidOnly catches only, a pause hangs CI until timeout.',
  ],
  interview: [
    { q: 'What is in a Playwright trace?', a: 'For each action: DOM snapshots before/after, the action target, timing, console logs, network requests and responses, and screenshots/filmstrip. You open it with npx playwright show-trace or in the HTML report.' },
    { q: 'How do you run Playwright in GitHub Actions?', a: 'Checkout, setup-node, npm ci, npx playwright install --with-deps, npx playwright test, then actions/upload-artifact for playwright-report with if: always(). Optionally use a matrix with --shard to split the suite across jobs.' },
    { q: 'How do you approach a flaky test?', a: 'Reproduce with --repeat-each or in CI, collect a trace of a failure, find what the test assumed too early (data, animation, network), and replace the assumption with a web-first assertion or a wait for the real event. Quarantine with a tag/annotation only with a ticket.' },
  ],
}
