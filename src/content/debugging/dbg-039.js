export default {
  id: 'dbg-039',
  category: 'debugging',
  kind: 'quiz',
  title: 'Green on my laptop, "invalid URL" in CI: Playwright baseURL, .env files and URL resolution',
  level: 'EXPERT',
  tags: ['playwright', 'typescript', 'baseURL', 'ci', 'environment', 'webServer', 'dotenv'],
  estMinutes: 18,
  scenario: `You moved the ShopEasy Playwright suite into the GitHub Actions pipeline. All 48 tests pass on every developer laptop. In CI, every single test fails within a second, before any locator is used. A teammate suggests raising the timeouts. You suspect the configuration, because the failures are instant and identical.`,
  description: `The relevant config:

\`\`\`ts
// playwright.config.ts
import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
  },
});
\`\`\`

\`\`\`ts
// tests/login.spec.ts
test('standard user can log in', async ({ page }) => {
  await page.goto('login.html');
  ...
});
\`\`\`

Each developer has a git-ignored \`.env\` file with \`BASE_URL=http://localhost:5180/practice-site/\` and runs \`npm run dev\` before testing. Answer the questions in order — each fix reveals the next problem.`,
  hints: [
    'An instant, identical failure across every test is almost always configuration, not timing.',
    'process.env.BASE_URL is undefined when the variable is not set; a relative path then has nothing to resolve against.',
    'URLs resolve like folders: a base without a trailing slash drops its last segment.',
  ],
  questions: [
    {
      q: `CI log:

\`\`\`text
  1) [chromium] › tests/login.spec.ts:3:5 › standard user can log in
    Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
    Call log:
      - navigating to "login.html", waiting until "load"
\`\`\`

What is the root cause?`,
      options: [
        'The CI runner is too slow; increase navigationTimeout',
        '.env is git-ignored, so in CI process.env.BASE_URL is undefined, baseURL is not set, and "login.html" is not a complete URL',
        'Chromium is not installed in CI',
        'login.html was deleted from the repository',
      ],
      answer: 1,
      why: 'The call log shows Playwright navigating to the bare string "login.html" — nothing was prepended. That only happens when baseURL is undefined. Locally dotenv loads the .env file; in CI that file does not exist. A missing browser gives "Executable doesn\'t exist", and a missing page would give a 404, not an invalid URL.',
    },
    {
      q: `A teammate adds \`BASE_URL: http://localhost:5180/practice-site\` (copied without the trailing slash) as an environment variable in the CI job. Now the error is:

\`\`\`text
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5180/login.html
\`\`\`

Look at the URL carefully. Which statements are true? (pick the best answer)`,
      options: [
        'Only the server is missing; the URL is correct',
        'Two problems: nothing is listening on port 5180 in CI, AND the URL lost "/practice-site" because a base without a trailing slash treats "practice-site" as a file name and replaces it',
        'Port 5180 is blocked by the firewall; use 80',
        'BASE_URL must be written in lower case',
      ],
      answer: 1,
      why: 'ERR_CONNECTION_REFUSED means no server is running in the CI container (locally you always had "npm run dev" open). And the resolved URL is http://localhost:5180/login.html — "/practice-site" is gone. Playwright resolves goto paths like a browser resolves links: without a trailing slash the last segment of the base is dropped (and a leading "/" in the path would go back to the host root). Locally the .env value ended with "/", so it worked there. Always read the final URL in the error.',
    },
    {
      q: `Which combination resolves to \`http://localhost:5180/practice-site/login.html\`?`,
      options: [
        'baseURL: "http://localhost:5180/practice-site" + goto("login.html")',
        'baseURL: "http://localhost:5180/practice-site/" + goto("/login.html")',
        'baseURL: "http://localhost:5180/practice-site/" + goto("login.html")',
        'baseURL: "http://localhost:5180/practice-site" + goto("/login.html")',
      ],
      answer: 2,
      why: 'Playwright uses standard URL resolution (like new URL(path, baseURL)). The base needs a trailing slash so "practice-site" is treated as a folder, and the path must be relative (no leading slash). Option A drops "practice-site" (it is treated as a file name); B and D start from the host root.',
    },
    {
      q: `What is the most robust final configuration?`,
      options: [
        'Hard-code "http://localhost:5180/practice-site/" in every goto() call',
        '`baseURL: process.env.BASE_URL ?? \'http://localhost:5180/practice-site/\'` plus a `webServer: { command: \'npm run dev\', url: \'http://localhost:5180/practice-site/index.html\', reuseExistingServer: !process.env.CI }` block',
        'Commit the .env file so CI gets it',
        'Add `await page.waitForTimeout(5000)` before each goto',
      ],
      answer: 1,
      why: 'A safe default with an env override works on laptops, in CI and against staging. webServer makes Playwright start the app and wait until the URL answers before tests run; reuseExistingServer lets developers keep their own dev server, while CI always starts a fresh one. Hard-coding breaks other environments, committing .env leaks local settings (and often secrets), and sleeps fix nothing here.',
    },
    {
      q: `Which quick check would have shown the problem in CI before any test ran?`,
      options: [
        'Running the tests with --headed',
        'Printing the resolved config, e.g. a globalSetup that fails fast with a clear message if config.projects[0].use.baseURL is undefined',
        'Taking a screenshot after each test',
        'Using --repeat-each=10',
      ],
      answer: 1,
      why: 'Fail fast on configuration: a globalSetup (or a check at the top of playwright.config.ts) that throws "BASE_URL is not set" turns 48 confusing failures into one clear message. --headed is impossible in a headless CI container, and screenshots/repeats only multiply the same error.',
    },
  ],
  explanation: `**"Works locally, fails in CI instantly" = check what the environment provides.** Local machines have things CI does not: a git-ignored \`.env\`, a dev server already running, cached browsers, a logged-in session.

**Playwright baseURL rules:**
- \`baseURL\` is used by \`page.goto\`, \`page.waitForURL\`, \`expect(page).toHaveURL\` and the \`request\` fixture.
- Resolution follows the URL standard: base **with** trailing slash + path **without** leading slash.
- If \`baseURL\` is undefined, relative paths fail with "Cannot navigate to invalid URL".

**Robust setup:** env override with a sensible default, a \`webServer\` block (with \`reuseExistingServer: !process.env.CI\`), and a fail-fast check for required variables. Read the **final URL** in every navigation error — it usually tells you exactly what went wrong.`,
  mistakes: [
    'Raising timeouts for a failure that happens in under a second.',
    'Committing the .env file to make CI green.',
    'Writing goto("/login.html") with a leading slash when the app lives under a sub-path.',
    'Forgetting that CI has no dev server running unless webServer (or a pipeline step) starts it.',
  ],
  interview: [
    { q: 'A Playwright suite passes locally but every test fails instantly in CI. What do you check first?', a: 'I read the first failure and the URL or command in it, because instant identical failures point to configuration. Typical causes are missing environment variables such as BASE_URL, no running application in the CI container, missing browsers, or different file paths. I compare what my laptop provides with what the pipeline provides.' },
    { q: 'How does baseURL combine with page.goto?', a: 'Playwright resolves the path against baseURL using standard URL rules. With a base ending in a slash and a relative path, the path is appended; a leading slash goes back to the host root, and a base without a trailing slash loses its last segment.' },
    { q: 'What does the webServer option do?', a: 'It starts the application with the given command before the tests and waits until the URL or port responds, then shuts it down afterwards. With reuseExistingServer set to !process.env.CI, developers can reuse their running dev server while CI always starts a clean one.' },
  ],
}
