export default {
  id: 'pw-038',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Reports a PO can read: test.describe, beforeEach and test.step',
  level: 'ADVANCED',
  tags: ['test.step', 'describe', 'beforeEach', 'html-report', 'readability'],
  estMinutes: 25,
  scenario: `The release manager opens the Playwright HTML report every morning. When the checkout test fails, the report shows one long list
of 25 raw actions and an error at \`locator.click\` — nobody but the author can tell *which part of the journey* broke. The team agreed:
every E2E test must read like the manual test case it replaces, with named steps, shared setup in hooks and a describe block per feature.`,
  description: `Refactor \`tests/checkout.spec.ts\` for ShopEasy.

**Acceptance**
- Group the tests in \`test.describe('Checkout', …)\`.
- Move the login (\`standard_user\` / \`secret_sauce\` on \`login.html\`) into \`test.beforeEach\`, itself wrapped in a \`test.step('Log in as standard_user', …)\`.
- Split the test body into at least **three** named \`test.step\`s: add the backpack, fill shipping details, finish the order.
- The *add to cart* step **returns** the product name (\`const product = await test.step(...)\`) and a later step asserts it on the overview.
- Put repeated form-filling in a helper \`fillShipping(page, …)\` whose step is reported as one box — \`test.step(..., { box: true })\` — so a failure points at the caller.
- End with a web-first assertion that \`complete-header\` shows *Thank you for your order!*.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('checkout', async ({ page }) => {
  await page.goto('login.html');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Asha');
  await page.getByTestId('lastName').fill('Rao');
  await page.getByTestId('postalCode').fill('560001');
  await page.getByTestId('continue').click();
  await page.getByTestId('finish').click();
  await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');
});
`,
  solution: `import { test, expect, type Page } from '@playwright/test';

async function fillShipping(page: Page, first: string, last: string, zip: string): Promise<void> {
  await test.step(\`Fill shipping details for \${first} \${last}\`, async () => {
    await page.getByTestId('firstName').fill(first);
    await page.getByTestId('lastName').fill(last);
    await page.getByTestId('postalCode').fill(zip);
    await page.getByTestId('continue').click();
  }, { box: true });
}

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await test.step('Log in as standard_user', async () => {
      await page.goto('login.html');
      await page.getByTestId('username').fill('standard_user');
      await page.getByTestId('password').fill('secret_sauce');
      await page.getByTestId('login-button').click();
      await expect(page.getByTestId('title')).toHaveText('Products');
    });
  });

  test('a logged-in customer can buy one product', async ({ page }) => {
    const product = await test.step('Add the backpack to the cart', async () => {
      await page.getByTestId('add-to-cart-trailblazer-backpack').click();
      await page.getByTestId('shopping-cart-link').click();
      await page.getByTestId('checkout').click();
      return 'Trailblazer Backpack';
    });

    await test.step('Enter shipping details', async () => {
      await fillShipping(page, 'Asha', 'Rao', '560001');
    });

    await test.step('Review and finish the order', async () => {
      await expect(page.getByTestId('overview-list')).toContainText(product);
      await page.getByTestId('finish').click();
      await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');
    });
  });
});
`,
  checks: [
    { label: 'Tests grouped in test.describe', pattern: "test\\.describe\\(\\s*['\"`]Checkout", hint: "test.describe('Checkout', () => { ... });" },
    { label: 'Login moved to test.beforeEach with its own step', pattern: 'test\\.beforeEach\\([\\s\\S]*?test\\.step\\(\\s*[\'"`]Log in', hint: "test.beforeEach(async ({ page }) => { await test.step('Log in as standard_user', async () => { ... }); });" },
    { label: 'At least three test.step calls in the test body', pattern: '(test\\.step\\([\\s\\S]*){4}', hint: 'One step in beforeEach plus at least three in the test (the helper step counts too).' },
    { label: 'A step returns a value that is used later', pattern: 'const\\s+\\w+\\s*=\\s*await\\s+test\\.step\\(', hint: "const product = await test.step('Add …', async () => { …; return 'Trailblazer Backpack'; });" },
    { label: 'Helper step reported as a box', pattern: 'box\\s*:\\s*true', hint: "await test.step('Fill shipping…', async () => { … }, { box: true });" },
    { label: 'Order completion asserted', pattern: "toHaveText\\(\\s*['\"`]Thank you for your order!", hint: "await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');" },
  ],
  hints: [
    'test.step(title, async () => { ... }) appears as a collapsible, named node in the HTML report, the trace viewer and UI mode.',
    'test.step returns whatever its callback returns, so steps can hand data to later steps without outer let variables.',
    'With { box: true } a failure inside the helper is reported at the line that called the step, which is the line the reader cares about.',
  ],
  explanation: `\`test.describe\` gives the report a feature heading, \`beforeEach\` removes the duplicated login, and \`test.step\` turns 15 raw
actions into four business-level steps: *Log in → Add the backpack → Enter shipping details → Review and finish*. When something breaks, the
report and the trace show **which step** failed, which is exactly what a manual test case with numbered steps used to give you.

Two advanced touches: a step can **return** a value (no mutable \`let\` shared across steps), and \`{ box: true }\` makes a helper behave like
a built-in action — the error points at the test line that called \`fillShipping\`, not deep inside the helper. Steps can also be nested,
and page-object methods often wrap themselves in a step so every test using them reports nicely for free.`,
  mistakes: [
    'Wrapping every single click in its own step — the report becomes as noisy as before.',
    'Forgetting to await test.step — the step runs in the background and the test ends early.',
    'Sharing state between steps through outer let variables instead of returning a value.',
    'Putting login in beforeAll with a shared page — it breaks test isolation; beforeEach with the page fixture is correct.',
  ],
  interview: [
    { q: 'How do you make Playwright reports readable for non-technical stakeholders?', a: 'Group by feature with test.describe, name tests after behaviour, and split each test into business-level test.step blocks. The HTML report and trace show the steps, and page-object methods can wrap themselves in steps so reports stay consistent.' },
    { q: 'What is the difference between beforeEach and a fixture for login?', a: 'beforeEach runs for every test in its scope; a fixture is created only for tests that request it, can be shared across files with test.extend and has built-in teardown. For a whole suite a fixture or storageState is usually better; beforeEach is fine within one file.' },
  ],
}
