export default {
  id: 'pw-013',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Network control: mock with page.route, sync with waitForResponse, test the API with request',
  level: 'ADVANCED',
  tags: ['network', 'page.route', 'waitForResponse', 'api-testing', 'request'],
  estMinutes: 35,
  scenario: `The staging build of ShopEasy has a new **Order history** page (\`orders.html\`) that calls \`GET /api/orders\` and renders one
\`data-testid="order-row"\` per order, an empty state *"You have no orders yet"*, or an error alert *"Could not load your orders. Try again later."*
The staging database always has orders, and nobody can make the backend return a 500 on demand — so the empty and error states were never
tested. With Playwright you can intercept the network and decide what the API answers.`,
  description: `Write \`tests/orders.spec.ts\` (baseURL points to staging).

1. **Empty state** — \`page.route('**/api/orders', …)\` fulfills with status 200 and an empty JSON array **before** \`goto\`; expect the empty-state text.
2. **Server error** — route fulfills with status 500; expect \`getByRole('alert')\` to have the error text.
3. **Real backend** — open the page, start \`page.waitForResponse(...)\` for the GET \`/api/orders\` call, click **Refresh**, await the response,
   check it is OK, and expect the number of order rows to equal the length of the JSON body.
4. **API only** — with the \`request\` fixture (no browser), \`GET /api/orders\`, expect status 200 and that every item has a string \`orderId\`
   and a numeric \`total\`. Type the body with an \`Order\` interface.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('shows an empty state when there are no orders', async ({ page }) => {
  await page.goto('orders.html');
  // TODO: we cannot empty the staging DB... skip?
  test.skip();
});

test('refresh renders the orders', async ({ page }) => {
  await page.goto('orders.html');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(3000);
  expect(await page.getByTestId('order-row').count()).toBeGreaterThan(0);
});
`,
  solution: `import { test, expect } from '@playwright/test';

interface Order {
  orderId: string;
  total: number;
  status: string;
}

test.describe('Order history (UI)', () => {
  test('shows an empty state when there are no orders', async ({ page }) => {
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', json: [] });
    });

    await page.goto('orders.html');
    await expect(page.getByText('You have no orders yet')).toBeVisible();
  });

  test('shows an error banner when the API fails', async ({ page }) => {
    await page.route('**/api/orders', (route) =>
      route.fulfill({ status: 500, json: { error: 'Internal Server Error' } }),
    );

    await page.goto('orders.html');
    await expect(page.getByRole('alert')).toHaveText('Could not load your orders. Try again later.');
  });

  test('refresh renders one row per order from the API', async ({ page }) => {
    await page.goto('orders.html');

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders') && res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    const response = await responsePromise;

    expect(response.ok()).toBeTruthy();
    const orders = (await response.json()) as Order[];
    await expect(page.getByTestId('order-row')).toHaveCount(orders.length);
  });
});

test('API: GET /api/orders returns well-formed orders', async ({ request }) => {
  const response = await request.get('/api/orders');

  expect(response.status()).toBe(200);
  const orders = (await response.json()) as Order[];
  expect(orders.length).toBeGreaterThan(0);
  for (const order of orders) {
    expect(typeof order.orderId).toBe('string');
    expect(typeof order.total).toBe('number');
  }
});
`,
  checks: [
    { label: 'Requests intercepted with page.route', pattern: "page\\.route\\(\\s*['\"`][^'\"`]*api/orders", hint: "await page.route('**/api/orders', route => route.fulfill({ ... }))" },
    { label: 'Mock responses with route.fulfill', pattern: 'route\\.fulfill\\(\\s*\\{[^}]*status\\s*:\\s*500', flags: 'ms', hint: 'route.fulfill({ status: 500, json: { error: "…" } })' },
    { label: 'waitForResponse started before the click', pattern: 'waitForResponse\\([\\s\\S]*\\.click\\([\\s\\S]*await\\s+\\w*[Pp]romise', hint: 'const responsePromise = page.waitForResponse(...); await click; const response = await responsePromise;' },
    { label: 'API test uses the request fixture', pattern: 'async\\s*\\(\\s*\\{\\s*request\\s*\\}\\s*\\)[\\s\\S]*request\\.get\\(', hint: "test('…', async ({ request }) => { const res = await request.get('/api/orders'); })" },
    { label: 'Response body typed with an interface', pattern: 'interface\\s+Order\\b[\\s\\S]*as\\s+Order\\[\\]', hint: 'const orders = (await response.json()) as Order[];' },
    { label: 'No waitForTimeout and no test.skip', pattern: '(waitForTimeout|test\\.skip\\()', mustNot: true, hint: 'Mock the state instead of skipping; wait for the response instead of sleeping.' },
  ],
  hints: [
    'page.route must be registered before the request happens — i.e. before page.goto for calls made on load.',
    'route.fulfill({ json }) sets the body and the JSON content type for you; route.continue() lets the real request through; route.abort() simulates a network failure.',
    'The request fixture shares baseURL and extraHTTPHeaders from the config but launches no browser — perfect for fast API checks.',
  ],
  explanation: `**Mocking** (\`page.route\`) lets a UI test control states the backend cannot easily produce: empty lists, 500 errors, slow responses
(\`await new Promise(r => setTimeout(r, 3000))\` inside the handler *is* acceptable — it simulates the server, it does not wait in the test),
or huge payloads. You can also modify a real response: \`const res = await route.fetch(); const json = await res.json(); … route.fulfill({ response: res, json })\`.

**Synchronising on the network**: \`waitForResponse\` is the explicit wait you still need when the assertion depends on data, not just UI.
Same "promise first" pattern as new tabs: start listening, trigger, then await. Asserting \`toHaveCount(orders.length)\` ties the UI to the real data.

**API testing** with the \`request\` fixture (an \`APIRequestContext\`) is ideal for seeding data or checking contracts without a browser —
the same runner, reports and CI. Keep a balance: mocked UI tests prove the UI handles each state, while a few unmocked tests and the API
tests prove the real integration works.`,
  mistakes: [
    'Registering page.route after page.goto — the request on page load has already gone to the real server.',
    'Mocking every API in every test — you end up testing your mocks; keep some end-to-end tests unmocked.',
    "A glob that doesn't match ('/api/orders' without **) — use '**/api/orders' or a RegExp / predicate.",
    'Awaiting waitForResponse after the click — the response may already have arrived, and the test hangs until timeout.',
  ],
  interview: [
    { q: 'When would you mock network calls in a UI test?', a: 'To reach states that are hard to create in a shared environment (empty data, server errors, timeouts, feature flags), to isolate the UI from unstable third parties, or to speed up tests. Not for the critical end-to-end happy paths.' },
    { q: 'How do you wait for an API call triggered by a click?', a: "Start const p = page.waitForResponse(predicate) before the click, perform the click, then await p. Check status and body as needed." },
    { q: 'Can Playwright do API testing?', a: 'Yes: the request fixture (APIRequestContext) sends HTTP requests with get/post/put/delete, shares config like baseURL and headers, and works with expect. It is commonly used for data setup and contract checks alongside UI tests.' },
  ],
}
