export default {
  id: 'pw-030',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'API tests with APIRequestContext: a fresh customer per test, cart to order',
  level: 'ADVANCED',
  tags: ['api-testing', 'APIRequestContext', 'fixtures', 'test-isolation', 'typescript'],
  estMinutes: 40,
  scenario: `The backend team asked QA to cover the ShopEasy cart and order API (\`http://localhost:5181\`) in the same Playwright repo as the UI
tests. The first draft logs in as \`standard_user\` and calls \`POST /api/reset\` in \`beforeEach\`. With 4 workers it fails randomly: one
test resets the database while another is placing an order, and all tests share standard_user's cart. In review the lead wrote: *"Give
every test its own customer and its own authenticated request context — as a fixture."*`,
  description: `Write \`tests/api/orders.api.spec.ts\`.

**Fixture**
- \`test.extend<{ api: APIRequestContext }>\` with an \`api\` fixture that uses the built-in \`playwright\` fixture:
  1. an anonymous context (\`playwright.request.newContext({ baseURL })\`) **registers a new customer** with \`POST /api/users\` (unique
     username, e.g. from \`Date.now()\` and \`test.info().workerIndex\`; password ≥ 8 chars) and logs in with \`POST /api/auth/login\`;
  2. a second context is created with \`extraHTTPHeaders: { Authorization: 'Bearer ' + token }\` and handed to the test with \`use\`;
  3. both contexts are **disposed**.

**Tests** (type every JSON body with an interface: \`Cart\`, \`Order\`, \`ApiError\`)
- **Cart to order**: add product 1 (qty 1) and product 2 (qty 2) → 201 each; the cart has \`itemCount\` 3 and \`subtotal\` 49.97.
  \`POST /api/orders\` with Jane / Doe / 10001 → 201, a \`location\` header \`/api/orders/<id>\`, \`tax\` 4 and \`total\` 53.97; afterwards
  \`GET /api/cart\` has no items.
- **Business errors**: adding product 1 twice → **409** \`ITEM_ALREADY_IN_CART\`; adding product 6 (stock 0) → **422** \`OUT_OF_STOCK\`.
- **No token**: the plain \`request\` fixture calling \`GET /api/cart\` → **401** \`UNAUTHORIZED\`.
- Never call \`/api/reset\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

const API = 'http://localhost:5181';
let token = '';

test.beforeEach(async ({ request }) => {
  await request.post(API + '/api/reset');
  const login = await request.post(API + '/api/auth/login', {
    data: { username: 'standard_user', password: 'secret_sauce' },
  });
  token = (await login.json()).token;
});

test('cart to order', async ({ request }) => {
  const res = await request.post(API + '/api/cart/items', {
    headers: { Authorization: 'Bearer ' + token },
    data: { productId: 1 },
  });
  const cart: any = await res.json();
  expect(cart.itemCount).toBe(1);
  // TODO: order, negative cases
});
`,
  solution: `import { test as base, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:5181';

interface LoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: { id: number; username: string };
}
interface CartLine {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}
interface Cart {
  userId: number;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
}
interface Order {
  id: number;
  status: string;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}
interface ApiError {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ playwright }, use, testInfo) => {
    const anonymous = await playwright.request.newContext({ baseURL: API_URL });
    const username = 'pw_' + Date.now() + '_' + testInfo.workerIndex;
    const password = 'Passw0rd-' + testInfo.workerIndex;

    const created = await anonymous.post('/api/users', {
      data: { username, password, firstName: 'Pat', lastName: 'Wright', email: username + '@shopeasy.test' },
    });
    expect(created.status()).toBe(201);

    const login = await anonymous.post('/api/auth/login', { data: { username, password } });
    expect(login.ok()).toBeTruthy();
    const { token } = (await login.json()) as LoginResponse;
    await anonymous.dispose();

    const api = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' + token },
    });
    await use(api);
    await api.dispose();
  },
});

test.describe('ShopEasy API: cart and orders', () => {
  test('ordering the cart charges 8% tax and empties the cart', async ({ api }) => {
    expect((await api.post('/api/cart/items', { data: { productId: 1 } })).status()).toBe(201);
    const added = await api.post('/api/cart/items', { data: { productId: 2, quantity: 2 } });
    expect(added.status()).toBe(201);
    const cart = (await added.json()) as Cart;
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBe(49.97);

    const placed = await api.post('/api/orders', {
      data: { firstName: 'Jane', lastName: 'Doe', postalCode: '10001' },
    });
    expect(placed.status()).toBe(201);
    const order = (await placed.json()) as Order;
    expect(placed.headers()['location']).toBe('/api/orders/' + order.id);
    expect(order).toMatchObject({ status: 'PLACED', itemCount: 3, subtotal: 49.97, tax: 4, total: 53.97 });

    const after = (await (await api.get('/api/cart')).json()) as Cart;
    expect(after.items).toHaveLength(0);
  });

  test('business rules return 409 and 422 with error codes', async ({ api }) => {
    await api.post('/api/cart/items', { data: { productId: 1 } });

    const duplicate = await api.post('/api/cart/items', { data: { productId: 1 } });
    expect(duplicate.status()).toBe(409);
    expect(((await duplicate.json()) as ApiError).error.code).toBe('ITEM_ALREADY_IN_CART');

    const outOfStock = await api.post('/api/cart/items', { data: { productId: 6 } });
    expect(outOfStock.status()).toBe(422);
    expect(((await outOfStock.json()) as ApiError).error.code).toBe('OUT_OF_STOCK');
  });

  test('the cart needs a bearer token', async ({ request }) => {
    const response = await request.get(API_URL + '/api/cart');
    expect(response.status()).toBe(401);
    expect(((await response.json()) as ApiError).error.code).toBe('UNAUTHORIZED');
  });
});
`,
  checks: [
    { label: 'Fixture typed as APIRequestContext', pattern: 'extend<\\s*\\{\\s*api\\s*:\\s*APIRequestContext\\s*\\}\\s*>', hint: 'const test = base.extend<{ api: APIRequestContext }>({ … })' },
    { label: 'New customer registered per test', pattern: "\\.post\\(\\s*['\"][^'\"]*/api/users['\"]", hint: "await anonymous.post('/api/users', { data: { username, password, … } })" },
    { label: 'Authenticated context with a Bearer header', pattern: 'newContext\\(\\s*\\{[\\s\\S]*extraHTTPHeaders\\s*:\\s*\\{\\s*Authorization\\s*:', hint: "playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: 'Bearer ' + token } })" },
    { label: 'Contexts disposed', pattern: '\\.dispose\\(\\)[\\s\\S]*\\.dispose\\(\\)', hint: 'await anonymous.dispose(); … await use(api); await api.dispose();' },
    { label: 'Error statuses asserted', pattern: 'toBe\\(\\s*409\\s*\\)[\\s\\S]*toBe\\(\\s*422\\s*\\)', hint: 'expect(duplicate.status()).toBe(409); … toBe(422)' },
    { label: 'Bodies typed with interfaces (no any)', pattern: 'as\\s+(Order|Cart|ApiError)\\b', hint: 'const order = (await placed.json()) as Order;' },
    { label: 'No shared reset or any', pattern: '(api/reset|:\\s*any\\b)', mustNot: true, hint: 'Isolate by data (a new customer), not by resetting a shared server.' },
  ],
  hints: [
    'The built-in playwright fixture gives you playwright.request.newContext(...) — your own APIRequestContext with its own baseURL and headers.',
    'A fixture function also receives testInfo as its third argument: testInfo.workerIndex helps make data unique across parallel workers.',
    'response.headers() returns lower-case header names: headers()["location"].',
  ],
  explanation: `**Isolation by data, not by reset.** A shared server is shared by every worker. \`POST /api/reset\` in one test wipes the carts and
orders of the tests running next to it — the classic "passes alone, fails in parallel" bug. Registering a new customer per test costs two
fast requests and makes every test independent: its own cart, its own orders, no ordering assumptions.

**An authenticated context as a fixture.** \`playwright.request.newContext({ baseURL, extraHTTPHeaders })\` is the API equivalent of a browser
context: every call made with it carries the Bearer token, so the tests read like the business flow. The fixture owns setup and teardown
(\`dispose()\` releases connections and stored responses), and its type parameter gives \`api\` full autocomplete.

**Typed bodies.** \`(await res.json()) as Order\` documents the contract — but note it is a compile-time cast, not validation. For contract
tests add a schema check (the API serves one at \`/api/schema/product\`), or assert the important fields explicitly as done here with
\`toMatchObject\`.

The numbers: 29.99 + 2 × 9.99 = 49.97; 8% = 3.9976 → 4.00; total 53.97. \`toBe\` on money is fine here because the API rounds to two
decimals; for computed floats use \`toBeCloseTo(value, 2)\`.`,
  mistakes: [
    'Resetting a shared backend in beforeEach — it breaks parallel runs and other teams using the environment.',
    'Sharing one account (and its cart) between parallel tests.',
    'Passing the Authorization header by hand on every call instead of an authenticated context.',
    'Treating a TypeScript cast as validation — the cast never fails at runtime.',
  ],
  interview: [
    { q: 'How do you keep API tests independent when they run in parallel?', a: 'Each test creates and owns its data — a unique user, cart or order — instead of relying on shared seed data or resetting the server. Unique values come from timestamps, UUIDs or workerIndex.' },
    { q: 'request fixture vs playwright.request.newContext?', a: 'The request fixture is a ready APIRequestContext using the config (baseURL, extraHTTPHeaders) and is disposed automatically. newContext lets you create additional contexts with different base URLs or auth — e.g. one per user role — which you must dispose yourself.' },
    { q: 'How do you validate a JSON response contract in Playwright?', a: 'Type the body with interfaces for readability, assert key fields with toMatchObject/toEqual, and validate the full shape with a JSON Schema validator (e.g. Ajv) against the published schema.' },
  ],
}
