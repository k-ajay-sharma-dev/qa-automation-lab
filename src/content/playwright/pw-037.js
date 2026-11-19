export default {
  id: 'pw-037',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Mock the catalogue API: an empty shop, a 500 and a dropped connection',
  level: 'ADVANCED',
  tags: ['page.route', 'mocking', 'route.fulfill', 'route.abort', 'error-states'],
  estMinutes: 25,
  scenario: `Story SHOP-702 is on the feature branch: \`inventory.html\` will stop using its built-in product list and load
\`GET /api/products?sort=name_asc&size=50\` from the ShopEasy API instead. The developer added two new states — an empty message
(\`data-testid="empty-products"\`, text *"No products found"*) and an error alert (\`role="alert"\`, text *"Products could not be loaded. Please try again."*).
The shared staging API always has six products and never fails, so the tester's draft just skips these cases.`,
  description: `Write \`tests/catalogue-states.spec.ts\` with three tests in a \`test.describe('Catalogue states')\`.

1. **Empty catalogue** — fulfill the products call with status 200 and the API's real page shape but no items:
   \`{ data: [], page: 1, size: 50, total: 0, totalPages: 0 }\`. Expect the empty message and **0** \`inventory-item\` cards.
2. **Server error** — fulfill with status 500 and the API's real error body
   \`{ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }\`. Expect the alert text and 0 cards.
3. **Network failure** — \`route.abort()\` the call; expect the same alert.

**Rules**
- Register the route **before** \`page.goto\`.
- The real request has a query string — your URL pattern must still match it (a glob with a trailing \`*\`, a RegExp or a predicate).
- No \`test.skip\` and no \`waitForTimeout\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('empty catalogue', async ({ page }) => {
  await page.goto('inventory.html');
  // staging always returns 6 products, cannot test this
  test.skip();
});

test('API error', async ({ page }) => {
  await page.goto('inventory.html');
  test.skip();
});
`,
  solution: `import { test, expect } from '@playwright/test';

const PRODUCTS_API = '**/api/products?*';

test.describe('Catalogue states', () => {
  test('shows an empty message when the API returns no products', async ({ page }) => {
    await page.route(PRODUCTS_API, (route) =>
      route.fulfill({
        status: 200,
        json: { data: [], page: 1, size: 50, total: 0, totalPages: 0 },
      }),
    );

    await page.goto('inventory.html');

    await expect(page.getByTestId('empty-products')).toHaveText('No products found');
    await expect(page.getByTestId('inventory-item')).toHaveCount(0);
  });

  test('shows an error alert when the API answers 500', async ({ page }) => {
    await page.route(PRODUCTS_API, (route) =>
      route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
      }),
    );

    await page.goto('inventory.html');

    await expect(page.getByRole('alert')).toHaveText('Products could not be loaded. Please try again.');
    await expect(page.getByTestId('inventory-item')).toHaveCount(0);
  });

  test('shows an error alert when the connection drops', async ({ page }) => {
    await page.route(PRODUCTS_API, (route) => route.abort('failed'));

    await page.goto('inventory.html');

    await expect(page.getByRole('alert')).toHaveText('Products could not be loaded. Please try again.');
  });
});
`,
  checks: [
    { label: 'Route pattern matches the URL with its query string', pattern: "(['\"`][^'\"`\\n]*api/products[^'\"`\\n]*\\*['\"`]|page\\.route\\(\\s*/[^\\n]*products|page\\.route\\(\\s*\\(?\\s*url)", hint: "Use '**/api/products?*' (or '**/api/products**', a RegExp, or a url => predicate)." },
    { label: 'Route registered before page.goto', pattern: 'page\\.route\\([\\s\\S]*?page\\.goto\\(', hint: 'Requests made on load are already gone if you route after goto.' },
    { label: 'Empty page uses the real response shape', pattern: 'data\\s*:\\s*\\[\\s*\\][\\s\\S]*?total\\s*:\\s*0', hint: '{ data: [], page: 1, size: 50, total: 0, totalPages: 0 }' },
    { label: 'Server error mocked with status 500 and INTERNAL_ERROR', pattern: "status\\s*:\\s*500[\\s\\S]*?INTERNAL_ERROR", hint: "route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: '…' } } })" },
    { label: 'Network failure simulated with route.abort', pattern: 'route\\.abort\\(', hint: "route => route.abort('failed')" },
    { label: 'No cards asserted with toHaveCount(0)', pattern: 'toHaveCount\\(\\s*0\\s*\\)', hint: "await expect(page.getByTestId('inventory-item')).toHaveCount(0);" },
    { label: 'No test.skip or waitForTimeout', pattern: '(test\\.skip\\(|waitForTimeout)', mustNot: true, hint: 'Create the state with a mock instead of skipping the test.' },
  ],
  hints: [
    "A glob like '**/api/products' must match the whole URL, so '/api/products?sort=name_asc&size=50' is NOT matched — add '?*' or '**' at the end.",
    'route.fulfill({ status, json }) sets the body and the content type for you; route.abort() makes the request fail like a lost connection.',
    'Copy the shapes from the real API (scripts/api-server.mjs) so the front end parses the mock exactly like production data.',
  ],
  explanation: `Mocking turns "cannot reproduce on staging" into a two-line setup. Three details make these tests trustworthy:

- **Timing** — \`page.route\` must be active before the request is sent, so it goes before \`goto\` for calls made on page load.
- **Matching** — globs match the whole URL including the query string. \`'**/api/products'\` silently misses \`/api/products?sort=…\`
  and the test hits the real API (and fails in a confusing way, or worse, passes for the wrong reason). A trailing \`?*\` / \`**\`,
  a RegExp, or a \`(url) => url.pathname === '/api/products'\` predicate avoids that.
- **Realistic payloads** — use the API's real contract (\`data/total\` page object, \`{ error: { code, message } }\`). A mock with an
  invented shape tests a situation production can never produce.

Asserting \`toHaveCount(0)\` as well as the message proves the page did not render stale or default products behind the message.`,
  mistakes: [
    "Using '**/api/products' for a URL with a query string — the route never fires.",
    'Routing after page.goto — the load-time request already reached the real server.',
    'Inventing a payload shape that differs from the real API contract.',
    'Only checking the message and not that the list is empty.',
  ],
  interview: [
    { q: 'What is the difference between route.fulfill, route.continue and route.abort?', a: 'fulfill answers the request with your own status, headers and body; continue sends it to the real server (optionally with changed URL, headers or body); abort fails it like a network error. route.fetch() lets you call the server and modify the real response before fulfilling.' },
    { q: 'Should every UI test mock the API?', a: 'No. Mock to reach states that are hard to create (empty, errors, timeouts) or to isolate from unstable third parties. Keep the main journeys unmocked and cover the API contract with API tests, otherwise you only test your mocks.' },
    { q: 'How do you make sure a mock is actually used?', a: 'Assert something only the mock can produce (an empty list, a specific error), or count calls inside the handler and expect it to be 1. A pattern that does not match fails silently otherwise.' },
  ],
}
