export default {
  id: 'pw-005',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'User-facing locators: the locked-out user',
  level: 'BEGINNER',
  tags: ['locators', 'getByRole', 'getByLabel', 'accessibility'],
  estMinutes: 15,
  scenario: `Sprint 22: the front-end team restyled the login form and wrapped the inputs in new \`<div>\`s. Eleven Selenium tests that used
XPaths like \`//form/div[2]/input\` broke overnight. For the Playwright version the team agreed a rule: **locate elements the way a user
(or a screen reader) finds them** — by role, label and visible text — and use \`data-testid\` only when there is nothing user-facing.`,
  description: `Rewrite the negative login test for \`locked_out_user\` on \`login.html\` (baseURL is already set to \`http://localhost:5180/practice-site/\`).

**Acceptance**
- Username and password fields are found with \`getByLabel\` (the page has \`<label for="user-name">Username</label>\` etc.).
- The Login button is found with \`getByRole('button', { name: 'Login' })\`.
- The error banner (it has \`role="alert"\` and \`data-testid="error"\`) is found with \`getByRole('alert')\` or \`getByTestId('error')\` and
  asserted to contain \`Sorry, this user has been locked out.\`
- Then close the banner with its × button (accessible name \`Close error\`) and assert the banner is hidden.
- No XPath, no CSS ids.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('locked out user sees an error', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('//form/div[2]/input').fill('locked_out_user');
  await page.locator('//form/div[3]/input').fill('secret_sauce');
  await page.locator('#login-form > button').click();

  const text = await page.locator('#login-error-message').textContent();
  expect(text).toContain('locked out');
  // TODO: close the error banner and check it is gone
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('locked out user sees an error and can dismiss it', async ({ page }) => {
  await page.goto('login.html');

  await page.getByLabel('Username').fill('locked_out_user');
  await page.getByLabel('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  const error = page.getByRole('alert');
  await expect(error).toContainText('Sorry, this user has been locked out.');

  await page.getByRole('button', { name: 'Close error' }).click();
  await expect(error).toBeHidden();
});
`,
  checks: [
    { label: 'Fields located by label', pattern: "getByLabel\\(\\s*['\"]Username['\"]\\s*\\)[\\s\\S]*getByLabel\\(\\s*['\"]Password['\"]\\s*\\)", hint: "page.getByLabel('Username') / page.getByLabel('Password')" },
    { label: 'Login button located by role and name', pattern: "getByRole\\(\\s*['\"]button['\"]\\s*,\\s*\\{\\s*name\\s*:\\s*['\"]Login['\"]", hint: "page.getByRole('button', { name: 'Login' })" },
    { label: 'Error banner by role or test id', pattern: "getByRole\\(\\s*['\"]alert['\"]|getByTestId\\(\\s*['\"]error['\"]", hint: "page.getByRole('alert')" },
    { label: 'Web-first text assertion on the banner', pattern: 'await\\s+expect\\([^)]*\\)\\.(toContainText|toHaveText)\\(', hint: "await expect(error).toContainText('Sorry, this user has been locked out.');" },
    { label: 'Banner asserted hidden after closing', pattern: '\\.(toBeHidden\\(|not\\.toBeVisible\\()', hint: 'await expect(error).toBeHidden();' },
    { label: 'No XPath or #id selectors', pattern: "locator\\(\\s*['\"](\\/\\/|#)", mustNot: true, hint: 'Replace page.locator(\'//…\') and page.locator(\'#…\') with getByLabel / getByRole.' },
  ],
  hints: [
    'getByLabel finds an input through its <label for="…">, aria-label or aria-labelledby.',
    'getByRole uses the accessibility tree: a <button> has role "button" and its text is its accessible name. The × button has aria-label="Close error".',
    'toBeHidden() waits until the element is hidden or removed.',
  ],
  explanation: `Playwright's recommended locator priority is **getByRole → getByLabel → getByPlaceholder → getByText → getByTestId → CSS/XPath**.
User-facing locators survive layout refactors (new wrapper divs, renamed classes) because they depend on what the user sees, and they
double as a free accessibility check: if \`getByLabel('Username')\` cannot find the input, the label is broken for screen-reader users too.

\`getByRole('button', { name: 'Login' })\` matches the name as a case-insensitive **substring** by default; add \`exact: true\` when
another button contains the same word. The banner has \`role="alert"\`, so \`getByRole('alert')\` is the most semantic choice.

Note the starter's \`expect(text).toContain(...)\`: it reads the text **once** and cannot wait — the web-first \`toContainText\` retries.`,
  mistakes: [
    'Copying the XPath from DevTools — absolute/positional paths break on the next layout change.',
    "getByText('Login') for the button — it also matches the 'Login' nav link; getByRole('button', …) is precise.",
    'Reading textContent() and asserting on the string — no retry, flaky when the banner appears after a short delay.',
    'Reaching for getByTestId first — it is a fallback when there is no good role/label/text.',
  ],
  interview: [
    { q: 'Which locator do you prefer in Playwright and why?', a: 'getByRole with an accessible name, then getByLabel/getByText, then getByTestId. They reflect how users interact, survive DOM refactors and catch accessibility regressions. CSS/XPath only as a last resort.' },
    { q: 'What happens if a locator matches two elements and you click it?', a: 'Playwright locators are strict: an action on a locator that resolves to more than one element throws a strict mode violation listing the matches. You refine it with exact, filter, a parent locator or .first() if order is truly meaningful.' },
    { q: 'How do you configure the attribute used by getByTestId?', a: 'In playwright.config.ts: use: { testIdAttribute: "data-test" }. The default is data-testid, which ShopEasy uses.' },
  ],
}
