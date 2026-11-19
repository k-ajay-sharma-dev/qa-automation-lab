export default {
  slug: 'pw-playwright-vs-selenium',
  category: 'playwright',
  order: 2,
  title: 'Playwright vs Selenium, and your first test',
  minutes: 9,
  summary: 'Explain how Playwright differs from Selenium (architecture, waiting, isolation, tooling), set up a project and write and run a first test with page, goto and expect.',
  manualAnalogy: `Think of Selenium as a talented tester you have to direct every second: "wait for the page… now is the button there? … now click". Playwright is the tester who already waits for the button to be ready before clicking, starts every test in a clean private browser window, and records a video of what happened. You still decide *what* to test — but far less effort goes into *babysitting*.`,
  body: `## Same goal, different design

Both tools drive real browsers. The differences are in *how*:

| | Selenium 4 (Java) | Playwright (TypeScript) |
|---|---|---|
| Protocol | W3C WebDriver: an HTTP command per action to a driver (chromedriver…) | One persistent connection to browser builds Playwright ships (Chromium, Firefox, WebKit) |
| Waiting | You add \`WebDriverWait\` + \`ExpectedConditions\` | **Auto-waiting** before actions; **web-first assertions** retry |
| Isolation | New browser per test (slow) or shared browser (leaky) | New **BrowserContext** per test — an incognito-like profile created in milliseconds |
| Test runner | Separate: TestNG/JUnit, + reports, + WebDriverManager | Built in: \`@playwright/test\` with parallelism, retries, HTML report, trace viewer, codegen, UI mode |
| Events | Polling for alerts/windows | Listen to events: \`dialog\`, \`page\` (new tab), \`request\`/\`response\` |
| Languages | Java, C#, Python, Ruby, JS | TS/JS (full runner), plus Java, Python, .NET bindings |

Where Selenium still wins: it is a **W3C standard**, supported by every device cloud and by Appium for native mobile, and many companies have years of Java utilities. A sensible migration is a **pilot**: port the smoke pack, run both suites side by side for a couple of sprints, compare duration and flake rate.

## Browser → context → page

\`\`\`
Browser (one Chromium process)
 ├── BrowserContext A  (own cookies, localStorage, sessionStorage)
 │     ├── Page (tab)
 │     └── Page (popup)
 └── BrowserContext B  (another test, completely separate)
\`\`\`

ShopEasy keeps the cart in \`sessionStorage\`, so a new context always starts with an empty cart and nobody logged in. That is why Playwright tests are independent without any cleanup code.

## Setting up a project

\`\`\`bash
npm init playwright@latest        # choose TypeScript, tests folder, GitHub Actions workflow
npx playwright install            # downloads the browser builds
\`\`\`

You get \`playwright.config.ts\`, a \`tests/\` folder and an example spec. Node.js (LTS) is the only prerequisite — no JDK, no Maven, no driver binaries.

## Anatomy of a test

Here is a test for the **cart** page (a different flow than you will build in the exercises):

\`\`\`ts
import { test, expect } from '@playwright/test';

test('empty cart shows a friendly message', async ({ page }) => {
  await page.goto('http://localhost:5180/practice-site/cart.html');

  await expect(page.getByTestId('title')).toHaveText('Your Cart');
  await expect(page.getByTestId('empty-cart-message')).toBeVisible();
  await expect(page).toHaveTitle(/Cart/);
});
\`\`\`

Line by line:

- \`import { test, expect } from '@playwright/test'\` — the runner's \`test\` function and its assertion library.
- \`test('name', async ({ page }) => { ... })\` — registers a test. The \`{ page }\` part asks the runner for the **page fixture**: a new tab in a new context, closed automatically afterwards. No \`@BeforeMethod\`, no \`driver.quit()\`.
- \`await page.goto(url)\` — navigates and waits for the \`load\` event.
- \`await expect(locator).toHaveText('Your Cart')\` — a **web-first assertion**. It re-checks the element's text until it matches or 5 seconds pass. In Selenium this would be an explicit wait *plus* an \`assertEquals\`.
- \`await expect(page).toHaveTitle(/Cart/)\` / \`toHaveURL(/cart\\.html/)\` — page-level assertions; a regular expression \`/…/\` matches part of the value.

Every line that talks to the browser starts with \`await\` (see the *TypeScript for testers* lesson).

## Running it

\`\`\`bash
npx playwright test                         # all tests, headless, all projects
npx playwright test tests/cart.spec.ts      # one file
npx playwright test -g "empty cart"         # by title
npx playwright test --headed --project=chromium
npx playwright show-report                  # open the HTML report
\`\`\`

Hard-coding \`http://localhost:5180/practice-site/\` in each test does not scale. Set it once as \`baseURL\` in \`playwright.config.ts\` and write \`page.goto('cart.html')\` — the *Config, debugging and CI* lesson shows how. (Keep the trailing slash in \`baseURL\` and no leading slash in \`goto\`, or the \`/practice-site/\` part is lost.)

## What you stop writing

Coming from Selenium, you will delete a lot: \`WebDriverWait\`, \`Thread.sleep\`, \`DriverFactory\`, \`ThreadLocal<WebDriver>\`, \`switchTo()\`, screenshot listeners, retry analyzers. What remains is the part that matters to a tester: the steps and the expected results.`,
  keyPoints: [
    'Playwright talks to its own browser builds over one connection; Selenium uses W3C WebDriver via drivers.',
    'Auto-waiting actions + retrying web-first assertions replace most explicit waits.',
    'Each test gets a fresh BrowserContext (clean cookies/storage) through the page fixture.',
    'A test is test(name, async ({ page }) => { … }) with awaited actions and await expect(…) assertions.',
    'Selenium remains the standard for device clouds/Appium; migrate with a measured pilot.',
  ],
  mistakes: [
    'Translating Selenium code line by line, keeping waits and sleeps — Playwright already waits.',
    'expect(page.url()).toContain(...) — reads once, no retry. Use await expect(page).toHaveURL(...).',
    'Forgetting npx playwright install (locally or in CI) — "Executable doesn\'t exist".',
    'Launching a browser manually in each test instead of using the page fixture.',
  ],
  tryIt: `With Node installed, run \`npm init playwright@latest\` in an empty folder, then \`npx playwright codegen http://localhost:5180/practice-site/cart.html\`. Click around and watch Playwright write \`getByRole\`/\`getByTestId\` code for you — then compare it with the test above.`,
  problems: ['pw-003', 'pw-004', 'pw-034'],
}
