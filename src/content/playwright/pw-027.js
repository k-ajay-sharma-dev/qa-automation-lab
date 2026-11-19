export default {
  id: 'pw-027',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'API vs UI: does the shop show the catalogue the API serves?',
  level: 'INTERMEDIATE',
  tags: ['request', 'api-testing', 'data-driven', 'test.fail', 'typescript'],
  estMinutes: 30,
  scenario: `Incident SHOP-611: marketing changed a price in the product service, but the web shop kept showing the old one for two days — the
front end had its own copy of the catalogue. The fix is planned, and until then QA wants a **consistency check**: the ShopEasy API
(\`http://localhost:5181\`) is the source of truth, and the products page must show the same names, prices and order. The draft test
compares the page with a hard-coded list, so it would have stayed green during the incident.`,
  description: `Write \`tests/catalogue-consistency.spec.ts\`. The \`request\` fixture and \`page\` can be used in the same test.

**Test 1 — same catalogue, same order**
- Type the API data: an interface \`Product\` (\`id\`, \`slug\`, \`name\`, \`price\`, \`inStock\` …) and \`ProductPage\` (\`data: Product[]\`, \`total\` …).
- \`GET /api/products\` with \`params: { sort: 'price_asc', size: 50 }\` on the API URL (\`process.env.API_URL\` or \`http://localhost:5181\`);
  expect an OK response.
- On \`inventory.html\` choose *Sort by* → \`lohi\`. Expect the number of cards to equal \`total\`, the card names (\`.item-name\`) to have
  **exactly** the API names in order, and the prices (\`.item-price\`) to be the API prices formatted as \`$29.99\`.
- No product names or prices hard-coded in the test.

**Test 2 — known bug as an executable note**
- The API reports *Retro Red Tee* (id 6) with \`inStock: false\`, but the shop still lets you add it (bug **SHOP-612**). Write the test
  as it *should* behave — its *Add to cart* button is disabled — and mark it with \`test.fail(...)\` and the bug id, so the suite stays
  green today and turns red the day the bug is fixed (reminding you to remove the annotation).`,
  starterCode: `import { test, expect } from '@playwright/test';

test('products page shows the catalogue', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByLabel('Sort by').selectOption('lohi');

  const names = await page.locator('.item-name').allTextContents();
  expect(names).toEqual([
    'Junior Onesie',
    'Pulse Bike Light',
    'Classic Crew T-Shirt',
    'Retro Red Tee',
    'Trailblazer Backpack',
    'Storm Fleece Jacket',
  ]);
});
`,
  solution: `import { test, expect } from '@playwright/test';

interface Product {
  id: number;
  slug: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  inStock: boolean;
  description: string;
}

interface ProductPage {
  data: Product[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

const API_URL = process.env.API_URL ?? 'http://localhost:5181';
const money = (n: number): string => '$' + n.toFixed(2);

test('products page shows the API catalogue in price order', async ({ page, request }) => {
  const response = await request.get(API_URL + '/api/products', { params: { sort: 'price_asc', size: 50 } });
  expect(response.ok()).toBeTruthy();
  const catalogue = (await response.json()) as ProductPage;

  await page.goto('inventory.html');
  await page.getByLabel('Sort by').selectOption('lohi');

  const cards = page.getByTestId('inventory-item');
  await expect(cards).toHaveCount(catalogue.total);
  await expect(cards.locator('.item-name')).toHaveText(catalogue.data.map((p) => p.name));
  await expect(cards.locator('.item-price')).toHaveText(catalogue.data.map((p) => money(p.price)));
});

test('out-of-stock products cannot be added to the cart', async ({ page, request }) => {
  test.fail(true, 'SHOP-612: the shop ignores inStock from the API');

  const response = await request.get(API_URL + '/api/products/6');
  expect(response.ok()).toBeTruthy();
  const product = (await response.json()) as Product;
  expect(product.inStock).toBe(false);

  await page.goto('inventory.html');
  const card = page.getByTestId('inventory-item').filter({ hasText: product.name });
  await expect(card.getByRole('button', { name: 'Add to cart' })).toBeDisabled({ timeout: 2_000 });
});
`,
  checks: [
    { label: 'request and page used together', pattern: 'async\\s*\\(\\s*\\{\\s*(page\\s*,\\s*request|request\\s*,\\s*page)\\s*\\}\\s*\\)', hint: "test('…', async ({ page, request }) => { … })" },
    { label: 'Products endpoint called with query params', pattern: "request\\.get\\([^;]*api/products[^;]*params\\s*:", hint: "request.get(API_URL + '/api/products', { params: { sort: 'price_asc', size: 50 } })" },
    { label: 'Response typed with an interface', pattern: 'interface\\s+Product\\b[\\s\\S]*as\\s+(ProductPage|Product)\\b', hint: 'const catalogue = (await response.json()) as ProductPage;' },
    { label: 'Card count compared with the API total', pattern: 'toHaveCount\\(\\s*\\w+\\.total\\s*\\)', hint: 'await expect(cards).toHaveCount(catalogue.total);' },
    { label: 'Expected texts built from API data', pattern: 'toHaveText\\(\\s*\\w+(\\.\\w+)*\\.map\\(', hint: 'await expect(cards.locator(\'.item-name\')).toHaveText(catalogue.data.map((p) => p.name));' },
    { label: 'Known bug marked with test.fail', pattern: "test\\.fail\\(\\s*(true\\s*,\\s*)?['\"][^'\"]*SHOP-612", hint: "test.fail(true, 'SHOP-612: the shop ignores inStock from the API');" },
    { label: 'No hard-coded catalogue', pattern: "['\"](Junior Onesie|Storm Fleece Jacket|Classic Crew T-Shirt)['\"]", mustNot: true, hint: 'The API is the oracle — build the expected list from the response.' },
  ],
  hints: [
    "A test can ask for several fixtures: async ({ page, request }) => … — request needs no browser and shares the test's lifetime.",
    "toHaveText accepts an array: it then expects exactly that many elements, with those texts, in that order — and it retries.",
    "test.fail() inside a test means: this test is expected to fail. If it passes, Playwright reports it as a failure so you notice the fix.",
  ],
  explanation: `The draft used a hard-coded list as its **oracle** — the same mistake as the front end. Using the API response as the expected
result makes the test check the real requirement: *the shop shows what the product service says*.

\`toHaveText(array)\` is the list version of a web-first assertion: same count, same texts, same order, retried until the sort has re-rendered
the cards. Formatting the expected price (\`'$' + price.toFixed(2)\`) in the test documents the display rule too.

The API URL is absolute because \`baseURL\` points to the web shop; in a bigger project you would create a second \`APIRequestContext\`
with its own \`baseURL\` (see the API problem) or a separate config project.

**test.fail** turns a known bug into an executable note. Unlike \`test.skip\`, the test still runs: while the bug exists it "fails as
expected" (green); when someone fixes SHOP-612 it passes unexpectedly and the run goes red, so the annotation gets removed and the test
becomes a normal regression check. Always put the ticket id in the description.`,
  mistakes: [
    'Hard-coding the expected data that should come from the system of record.',
    'Comparing allTextContents() with toEqual — it reads once, before the sort may have re-rendered the list.',
    'Skipping a test for a known bug — nobody notices when the bug is fixed (or when the test breaks for a different reason).',
    'Forgetting params encoding and building query strings by hand — params handles encoding.',
  ],
  interview: [
    { q: 'How do you use API calls inside a UI test?', a: 'Request the request fixture (or create an APIRequestContext) next to page. Use it to fetch the expected data, create test data before the UI steps, or clean up afterwards — faster and more reliable than doing it through the UI.' },
    { q: 'test.skip vs test.fixme vs test.fail?', a: 'skip does not run the test (e.g. not applicable on this browser). fixme also does not run it and marks it as needing work. fail runs it and expects it to fail — useful for known bugs because you are alerted when it starts passing.' },
    { q: 'What is a test oracle?', a: 'The source of the expected result. Good oracles are independent of the code under test — a spec, an API, a calculation — not a copy of the same data the UI uses.' },
  ],
}
