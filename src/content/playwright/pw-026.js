export default {
  id: 'pw-026',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'When toHaveText is not enough: expect.poll, toPass and expect.soft',
  level: 'INTERMEDIATE',
  tags: ['expect.poll', 'toPass', 'expect.soft', 'web-first-assertions', 'api'],
  estMinutes: 30,
  scenario: `Three checks in the suite still contain \`waitForTimeout\`, and each author had a "reason": (1) the cart is stored in
\`sessionStorage\`, which is not an element, so "web-first assertions don't work"; (2) the nightly job starts the ShopEasy API on port 5181 and
the first test sometimes runs before it is up; (3) the checkout overview test stops at the first wrong number, so a pricing bug needs three CI
runs to see all three wrong totals. Playwright has a tool for each.`,
  description: `Write \`tests/beyond-locators.spec.ts\`.

1. **expect.poll** — on \`inventory.html\` add *Trailblazer Backpack* and *Pulse Bike Light*, then poll
   \`page.evaluate(...)\` that reads \`sessionStorage.getItem('shopeasy.cart')\` until the parsed array **equals**
   \`['trailblazer-backpack', 'pulse-bike-light']\`.
2. **toPass** — with the \`request\` fixture, retry a block that calls \`GET http://localhost:5181/api/health\` and expects status **200** and
   body \`status\` **'UP'**, with \`intervals\` of 1 s and 2 s and a 30 s timeout.
3. **expect.soft** — with those two products in the cart, go through checkout as Jane Doe / 10001 and check the overview with **soft**
   assertions: item total \`$39.98\`, tax \`$3.20\`, total \`$43.18\` (\`data-testid\` \`subtotal-label\`, \`tax-label\`, \`total-label\`).

**Rules**: no \`waitForTimeout\`, no \`expect(await …)\`, no hand-written \`while\` retry loops.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('cart is saved in sessionStorage', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => sessionStorage.getItem('shopeasy.cart'))).toContain('backpack');
});

test('API is up', async ({ request }) => {
  let up = false;
  while (!up) {
    try {
      up = (await request.get('http://localhost:5181/api/health')).ok();
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
});

test('overview totals', async ({ page }) => {
  // ...add products and check out...
  await expect(page.getByTestId('subtotal-label')).toContainText('$39.98');
  await expect(page.getByTestId('tax-label')).toContainText('$3.20');   // never runs if the line above fails
  await expect(page.getByTestId('total-label')).toContainText('$43.18');
});
`,
  solution: `import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:5181';

async function addToCart(page: Page, ...names: string[]): Promise<void> {
  for (const name of names) {
    await page
      .getByTestId('inventory-item')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Add to cart' })
      .click();
  }
}

test('cart contents are saved in sessionStorage', async ({ page }) => {
  await page.goto('inventory.html');
  await addToCart(page, 'Trailblazer Backpack', 'Pulse Bike Light');

  await expect
    .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('shopeasy.cart') ?? '[]')), {
      message: 'cart slugs in sessionStorage',
    })
    .toEqual(['trailblazer-backpack', 'pulse-bike-light']);
});

test('ShopEasy API is up before the suite runs', async ({ request }) => {
  await expect(async () => {
    const response = await request.get(API_URL + '/api/health');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('UP');
  }).toPass({ intervals: [1_000, 2_000], timeout: 30_000 });
});

test('checkout overview shows every total', async ({ page }) => {
  await page.goto('inventory.html');
  await addToCart(page, 'Trailblazer Backpack', 'Pulse Bike Light');
  await page.getByTestId('shopping-cart-link').click(); // nav link "Cart" and the icon share the name
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByLabel('First Name').fill('Jane');
  await page.getByLabel('Last Name').fill('Doe');
  await page.getByLabel('Zip/Postal Code').fill('10001');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect.soft(page.getByTestId('subtotal-label')).toContainText('$39.98');
  await expect.soft(page.getByTestId('tax-label')).toContainText('$3.20');
  await expect.soft(page.getByTestId('total-label')).toContainText('$43.18');
});
`,
  checks: [
    { label: 'Custom value retried with expect.poll', pattern: 'expect\\s*\\.poll\\(', hint: 'await expect.poll(() => page.evaluate(() => …)).toEqual([...])' },
    { label: 'Storage read inside page.evaluate', pattern: 'evaluate\\([\\s\\S]*sessionStorage\\.getItem', hint: "page.evaluate(() => JSON.parse(sessionStorage.getItem('shopeasy.cart') ?? '[]'))" },
    { label: 'Block retried with toPass and intervals', pattern: '\\.toPass\\(\\s*\\{[^}]*intervals\\s*:', hint: '}).toPass({ intervals: [1_000, 2_000], timeout: 30_000 });' },
    { label: 'Three soft assertions on the overview', pattern: 'expect\\.soft\\([\\s\\S]*expect\\.soft\\([\\s\\S]*expect\\.soft\\(', hint: "await expect.soft(page.getByTestId('tax-label')).toContainText('$3.20');" },
    { label: 'Products chosen by name, not position', pattern: '\\.(first|nth)\\(', mustNot: true, hint: "filter({ hasText: name }) instead of .first()" },
    { label: 'No fixed waits, one-shot expects or while loops', pattern: '(waitForTimeout|expect\\(\\s*await\\b|while\\s*\\()', mustNot: true, hint: 'expect.poll and toPass do the retrying for you.' },
  ],
  hints: [
    'expect.poll(fn) calls fn again and again until the matcher passes — fn can return anything: a storage value, an API field, a file size.',
    'expect(async () => { …several expects… }).toPass() re-runs the whole block until no expect inside throws.',
    'expect.soft records the failure and lets the test continue; the test is still reported as failed at the end, with every soft failure listed.',
  ],
  explanation: `Web-first assertions cover **locators and pages**. For everything else there are three tools:

| Need | Tool |
|---|---|
| Retry until one computed value matches | \`await expect.poll(() => value).toBe(…)\` |
| Retry a block of steps + assertions until it all passes | \`await expect(async () => { … }).toPass()\` |
| Check many things and report all failures | \`expect.soft(…)\` |

**expect.poll** re-runs the function (default intervals 100, 250, 500, 1000 ms; expect timeout) — perfect for \`sessionStorage\`,
\`localStorage\`, a value from an API, or a download that is still being written. The \`message\` option names the check in the report.

**toPass** re-runs the whole callback. Note its default timeout is **0** (retry forever until the test timeout) — always pass \`timeout\`.
Use it for a health check, or an eventually-consistent API ("the order shows up in GET /api/orders within a few seconds"). Do not use it
to hide a flaky UI step: if clicking twice "fixes" it, find out why.

**expect.soft** is for checks of one screen that are independent of each other — all three totals are visible at once, so you want all
three results in one run. Do not use soft assertions for preconditions: if login failed, continuing is pointless.`,
  mistakes: [
    'Polling with expect(await page.evaluate(...)) — it reads once; the value must be produced inside the poll function.',
    'Calling toPass() without a timeout — it can retry until the whole test times out.',
    'Making every assertion soft — the test continues after a broken precondition and produces a cascade of meaningless failures.',
    'Writing while/try/catch retry loops by hand — no timeout, no good error message, easy to make infinite.',
  ],
  interview: [
    { q: 'What is the difference between expect.poll and toPass?', a: 'expect.poll retries a function that returns a value and applies one matcher to it. toPass retries a whole async block, including several actions and assertions, until it runs without throwing.' },
    { q: 'When are soft assertions appropriate?', a: 'When several independent facts on the same screen should all be reported in one run, e.g. the fields of a summary. Not for preconditions or steps the rest of the test depends on.' },
    { q: 'How would you wait for a backend to be ready before tests run?', a: 'Use webServer in playwright.config.ts with a url to wait for, or a global setup / first test that retries the health endpoint with expect(...).toPass({ intervals, timeout }) or expect.poll on the status.' },
  ],
}
