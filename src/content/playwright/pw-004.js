export default {
  id: 'pw-004',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Your first Playwright test: log in and land on Products',
  level: 'BEGINNER',
  tags: ['playwright-test', 'expect', 'smoke'],
  estMinutes: 15,
  scenario: `Pilot week of the migration. The manager wants to see **one** green Playwright test on the ShopEasy login flow by Friday —
the same smoke check the Selenium suite does first (\`LoginTest.validLogin\`). Playwright is installed (\`npm init playwright@latest\`)
and \`tests/login.spec.ts\` exists, but it is empty.`,
  description: `Write the test in \`tests/login.spec.ts\`.

**Steps**: open \`http://localhost:5180/practice-site/login.html\`, type \`standard_user\` / \`secret_sauce\` into \`#user-name\` / \`#password\`,
click \`#login-button\`.

**Acceptance**
- Import \`test\` and \`expect\` from \`@playwright/test\`.
- One \`test('…', async ({ page }) => { … })\` with a meaningful name.
- Assert with **web-first** assertions: the URL matches \`/inventory\\.html/\` (\`toHaveURL\`) and the heading with \`data-testid="title"\` has the text \`Products\`.
- Every action and assertion is awaited. No \`waitForTimeout\`.
- (IDs are fine for this first test — the next problem replaces them with user-facing locators.)`,
  starterCode: `// tests/login.spec.ts
// TODO: import test and expect

// TODO: one test that logs in as standard_user and checks the Products page
`,
  solution: `// tests/login.spec.ts
import { test, expect } from '@playwright/test';

test('standard user can log in and sees the Products page', async ({ page }) => {
  await page.goto('http://localhost:5180/practice-site/login.html');

  await page.locator('#user-name').fill('standard_user');
  await page.locator('#password').fill('secret_sauce');
  await page.locator('#login-button').click();

  await expect(page).toHaveURL(/inventory\\.html/);
  await expect(page.getByTestId('title')).toHaveText('Products');
});
`,
  checks: [
    { label: 'Imports test and expect from @playwright/test', pattern: "import\\s*\\{[^}]*\\btest\\b[^}]*\\bexpect\\b[^}]*\\}\\s*from\\s*['\"]@playwright/test['\"]|import\\s*\\{[^}]*\\bexpect\\b[^}]*\\btest\\b[^}]*\\}\\s*from\\s*['\"]@playwright/test['\"]", hint: "import { test, expect } from '@playwright/test';" },
    { label: 'Test uses the page fixture', pattern: "test\\(\\s*['\"`][^'\"`]+['\"`]\\s*,\\s*async\\s*\\(\\s*\\{\\s*page\\s*\\}\\s*\\)\\s*=>", hint: "test('name', async ({ page }) => { ... })" },
    { label: 'Navigates with await page.goto', pattern: 'await\\s+page\\.goto\\(', hint: "await page.goto('http://localhost:5180/practice-site/login.html');" },
    { label: 'Clicks the login button', pattern: 'await\\s+page\\.[^;]*login-button[^;]*\\.click\\(', hint: "await page.locator('#login-button').click();" },
    { label: 'Asserts the URL with toHaveURL', pattern: 'await\\s+expect\\(\\s*page\\s*\\)\\.toHaveURL\\(', hint: 'await expect(page).toHaveURL(/inventory\\.html/);' },
    { label: 'Asserts the Products heading', pattern: "toHaveText\\(\\s*['\"]Products['\"]", hint: "await expect(page.getByTestId('title')).toHaveText('Products');" },
    { label: 'No waitForTimeout', pattern: 'waitForTimeout', mustNot: true, hint: 'Web-first assertions wait for you.' },
  ],
  hints: [
    'The test body receives fixtures as an object: async ({ page }) => { … } — page is a fresh tab in a fresh browser context.',
    'expect(page).toHaveURL(...) and expect(locator).toHaveText(...) retry until they pass or time out (5 s by default).',
    'Run it with: npx playwright test tests/login.spec.ts --headed',
  ],
  explanation: `\`@playwright/test\` is both the library and the **test runner** (think TestNG + WebDriver in one). \`test()\` registers a test;
the \`{ page }\` argument is a **fixture**: the runner creates a new browser context and page before the test and disposes of them after —
no \`@BeforeMethod\`/\`driver.quit()\` needed.

\`await expect(page).toHaveURL(/inventory\\.html/)\` is a **web-first assertion**: it keeps re-checking the URL until it matches or the
expect timeout passes. That replaces Selenium's \`wait.until(urlContains(...))\` + \`assertTrue(...)\`.

Next steps a reviewer would suggest: move the URL into \`baseURL\` in \`playwright.config.ts\` (so \`page.goto('login.html')\` works on any
environment) and switch to user-facing locators.`,
  mistakes: [
    'Forgetting async on the test function — then await is a syntax error.',
    'Writing expect(page.url()).toContain("inventory") — page.url() is read once, immediately, and does not retry; use toHaveURL.',
    'Writing expect(locator).toHaveText(...) without await — the assertion never runs and the test passes falsely.',
    'Hard-coding http://localhost in every test instead of baseURL in the config.',
  ],
  interview: [
    { q: 'What is the page fixture?', a: 'A built-in fixture of @playwright/test: a Page in a new BrowserContext created for each test and closed afterwards. Requesting it in the test signature is enough; the runner handles setup and teardown.' },
    { q: 'What is a web-first assertion?', a: 'An async expect matcher on a locator or page (toHaveText, toBeVisible, toHaveURL…) that retries until the condition holds or the timeout expires, so it naturally waits for the app.' },
    { q: 'How do you run a single test?', a: 'npx playwright test path/to/file.spec.ts, add :line to pick a test by line, -g "title" to grep by name, or test.only while developing (forbidOnly blocks it in CI).' },
  ],
}
