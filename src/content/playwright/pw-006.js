export default {
  id: 'pw-006',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Chain and filter locators: add one product from a list of cards',
  level: 'INTERMEDIATE',
  tags: ['locators', 'filter', 'describe', 'beforeEach', 'cart'],
  estMinutes: 25,
  scenario: `Bug SHOP-418: "Clicking *Add to cart* on Pulse Bike Light adds the Backpack instead." The bug is fixed, and you are asked to add
regression tests. All six product cards on \`inventory.html\` have an identical **Add to cart** button, so
\`getByRole('button', { name: 'Add to cart' })\` alone matches six elements and Playwright refuses to click it (strict mode).`,
  description: `Write \`tests/cart-badge.spec.ts\`.

**Acceptance**
- Group the tests in \`test.describe('Cart badge', …)\` with a \`test.beforeEach\` that logs in as \`standard_user\` and waits for the
  \`inventory.html\` URL.
- Find the right card by **chaining + filtering**: \`page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' })\`, then the
  Add-to-cart button **inside** that card.
- Test 1: after adding, the card's button reads **Remove** and the badge (\`data-testid="shopping-cart-badge"\`) has text \`1\`.
- Test 2: add then remove the same product → the badge is hidden.
- No \`.nth()\` / \`.first()\` to pick the product, no CSS/XPath.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('adding Pulse Bike Light shows 1 in the badge', async ({ page }) => {
  await page.goto('login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  // Strict mode violation: 6 buttons match!
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});

// TODO: a second test that adds then removes the product (copy-pasting the login again?)
`,
  solution: `import { test, expect } from '@playwright/test';

test.describe('Cart badge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('login.html');
    await page.getByLabel('Username').fill('standard_user');
    await page.getByLabel('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/inventory\\.html/);
  });

  test('adding Pulse Bike Light shows 1 in the badge', async ({ page }) => {
    const card = page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' });

    await card.getByRole('button', { name: 'Add to cart' }).click();

    await expect(card.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  test('removing the product again hides the badge', async ({ page }) => {
    const card = page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' });

    await card.getByRole('button', { name: 'Add to cart' }).click();
    await card.getByRole('button', { name: 'Remove' }).click();

    await expect(page.getByTestId('shopping-cart-badge')).toBeHidden();
  });
});
`,
  checks: [
    { label: 'Tests grouped in test.describe', pattern: "test\\.describe\\(\\s*['\"`]", hint: "test.describe('Cart badge', () => { ... })" },
    { label: 'Login in test.beforeEach', pattern: 'test\\.beforeEach\\(\\s*async\\s*\\(\\s*\\{\\s*page\\s*\\}\\s*\\)', hint: 'test.beforeEach(async ({ page }) => { ...login... })' },
    { label: 'Card found with filter({ hasText })', pattern: "filter\\(\\s*\\{\\s*hasText\\s*:\\s*['\"/]", hint: "page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' })" },
    { label: 'Button searched inside the card (chained)', pattern: "\\w+\\.getByRole\\(\\s*['\"]button['\"]\\s*,\\s*\\{\\s*name\\s*:\\s*['\"]Add to cart", hint: "card.getByRole('button', { name: 'Add to cart' })" },
    { label: 'Badge hidden after removing', pattern: '\\.(toBeHidden\\(\\)|not\\.toBeVisible\\(\\)|toHaveCount\\(\\s*0\\s*\\))', hint: "await expect(page.getByTestId('shopping-cart-badge')).toBeHidden();" },
    { label: 'No positional picking', pattern: '\\.(nth\\(|first\\(\\)|last\\(\\))', mustNot: true, hint: 'Filter by the product name instead of its position — sorting would break position.' },
  ],
  hints: [
    'A locator can be called on another locator: card.getByRole(...) only searches inside the card.',
    "filter({ hasText: 'Pulse Bike Light' }) keeps only the cards whose text contains the product name.",
    'test.beforeEach runs before every test in the describe block and gets the same fixtures (page) as the test.',
  ],
  explanation: `**Chaining** narrows the search scope: \`card.getByRole('button', …)\` looks only inside \`card\`. **filter** keeps the
elements of a list that match a condition: \`{ hasText }\` (string = substring, or a RegExp), \`{ has: locator }\` (contains a child),
or \`hasNot\` / \`hasNotText\`. Together they replace the Selenium XPath
\`//div[@data-testid='inventory-item'][.//a[text()='Pulse Bike Light']]//button\` with something readable.

Picking with \`.nth(1)\` would pass today and break the day the default sort changes. Filtering by business data (the product
name) expresses the intent of the test.

\`test.beforeEach\` removes duplicated login code; since every test gets a **fresh context**, the cart (stored in \`sessionStorage\`)
starts empty in each test, so the tests are independent and can run in parallel.`,
  mistakes: [
    'Using .first() to silence a strict mode violation — you may click the wrong product and the test still passes.',
    "filter({ hasText: 'Light' }) — too vague; it could match a future 'Light Jacket'. Use the full name or a RegExp with anchors.",
    'Asserting the badge right after login in beforeEach without awaiting the navigation — use await expect(page).toHaveURL(...).',
    'Sharing a card locator between tests via a top-level variable created from a page — each test has its own page.',
  ],
  interview: [
    { q: 'What is strict mode in Playwright locators?', a: 'Actions and single-element assertions require the locator to resolve to exactly one element; otherwise Playwright throws a strict mode violation. It prevents silently acting on the wrong element.' },
    { q: 'filter({ hasText }) vs getByText?', a: 'getByText finds the element whose own text matches. filter({ hasText }) keeps container elements (cards, rows) whose text contains the value, so you can then search inside them.' },
    { q: 'How do you scope hooks to some tests only?', a: 'Put the tests and the hook inside test.describe; beforeEach/afterEach apply to that block only. Top-level hooks apply to the whole file.' },
  ],
}
