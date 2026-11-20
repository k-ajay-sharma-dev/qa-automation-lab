export default {
  slug: 'pw-deep-api-testing',
  category: 'playwright',
  order: 21,
  title: 'Deep dive: API testing with Playwright APIRequestContext (and how it compares to REST Assured)',
  minutes: 30,
  summary: 'Design a typed, isolated, parallel-safe API test layer on Playwright APIRequestContext — client class, logged-in fixture, schema validation, negative and data-driven tests, API + UI hybrids — and argue clearly when REST Assured is the better tool.',
  manualAnalogy: `When you test an API by hand you keep a Postman collection: an environment with the base URL and a token, a login request whose script stores the token, then requests that add to the cart and place an order, each with a few checks on the status and the body. You also know the dull rules: use your own test account, never "reset" the shared QA database while colleagues are testing, and do not trust a response time measured once on a busy server. This lesson turns that collection into code that runs in parallel inside the same runner as your UI tests.`,
  body: `## Where the earlier lessons stop

The *Log in once and test the API* lesson introduced the three ways to get an APIRequestContext, \`get/post\` with \`params\`/\`data\`, and the idea that each test owns its data. The *Beyond clicks* lesson used the \`request\` fixture for one call. The REST Assured section teaches REST Assured itself. This lesson goes underneath: what the client really is, how its configuration and cookies are scoped, how to build a typed client + fixture a team can live with, how to validate schemas, how to keep API tests isolated under parallelism — and an honest REST Assured comparison you can defend in a design review.

Every endpoint, field and error code below exists in the ShopEasy practice API (\`npm run api\`, \`http://localhost:5181\`). Errors always have the shape \`{ error: { code, message, details? } }\`.

## What APIRequestContext is — and what it is not

APIRequestContext is an **HTTP client that runs in the Playwright driver process (Node), not in the browser**. When your test calls \`request.post(...)\`, the call goes over the same client-server channel as \`page.click\`, and the driver sends the HTTP request itself with Node's networking. Consequences that interviewers probe:

- **No CORS, no browser rules.** It is not \`fetch\` in a page. CORS headers, mixed-content and same-origin rules do not apply. (ShopEasy's API has open CORS anyway; your company's API may not — a test that passes with \`request\` proves nothing about the browser being allowed to call it.)
- **\`page.route\` does not see these requests.** Routing intercepts the browser's network stack; APIRequestContext traffic never enters it — that includes \`page.request\`. To mock, use routing on browser traffic; to observe API calls, use the trace (API calls appear in the trace viewer's network tab when tracing is on).
- **Responses are buffered.** The whole body is held in memory until you call \`dispose()\` on the response or the context, so \`body()\`/\`json()\` can be called later. Thousands of large responses in one long-lived context is a memory leak.
- **It has its own cookie jar** — unless it belongs to a browser context (next section).
- **It is cheap.** No browser process is needed. A test that only uses \`request\` never launches a browser, so an API project with 8 workers runs hundreds of tests in seconds.

### Three ways to get one — the cookie difference

| | \`request\` fixture | \`playwright.request.newContext()\` | \`page.request\` / \`context.request\` |
|---|---|---|---|
| Created by | Playwright Test, per test | you | the browser context |
| Configuration | the project's \`use\` options (\`baseURL\`, \`extraHTTPHeaders\`, \`httpCredentials\`, \`ignoreHTTPSErrors\`, \`proxy\`…) | only what you pass | inherits the browser context options |
| Cookie storage | its own, isolated | its own, isolated (seed it with \`storageState\`) | **shared with the browser context**: sends the browser's cookies, and \`Set-Cookie\` in responses lands in the browser |
| Disposed | automatically after the test | **by you** (\`dispose()\`) | with the context |
| Typical use | API tests, test-data setup | another host or identity, worker-scoped clients, a context with a token in \`extraHTTPHeaders\` | calls that must run "as the logged-in browser" (cookie-session apps) |

The cookie row is the one that matters. With a cookie-session app, \`page.request.post('/api/cart', …)\` adds to the **same** cart the UI shows, because it carries the browser's session cookie. The \`request\` fixture is anonymous until you authenticate it. ShopEasy uses a Bearer token (a header, not a cookie), so none of the three shares auth automatically — you pass the header yourself.

You can move state either way: \`await apiContext.storageState()\` returns \`{ cookies, origins }\` that \`browser.newContext({ storageState })\` accepts, and \`request.newContext({ storageState })\` accepts the file a UI setup project saved. The docs call this state interchangeable between BrowserContext and APIRequestContext.

## Configuration: config, project and context level

\`\`\`ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  use: { trace: 'retain-on-failure' },               // global: applies to every project
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: {                                         // project level: the request fixture reads these
        baseURL: 'http://localhost:5181',
        extraHTTPHeaders: { Accept: 'application/json', 'X-Test-Suite': 'pw-api' },
      },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5180/practice-site/' },
    },
  ],
});
\`\`\`

At context level you pass the same options to \`newContext\`:

\`\`\`ts
const admin = await playwright.request.newContext({
  baseURL: 'https://staging.example.com',
  extraHTTPHeaders: { Authorization: \`Bearer \${process.env.ADMIN_TOKEN}\` },
  httpCredentials: { username: 'qa', password: process.env.BASIC_PW!, send: 'always' },
  ignoreHTTPSErrors: true,         // self-signed staging certificate
  timeout: 10_000,                 // per request; default 30 s, 0 = no timeout
  storageState: 'playwright/.auth/admin.json',
});
\`\`\`

| Option | What it does | Senior note |
|---|---|---|
| \`baseURL\` | resolves relative URLs with standard URL rules | \`'/api/x'\` (leading slash) **drops any path** in baseURL; \`'api/x'\` keeps it if baseURL ends with \`/\` |
| \`extraHTTPHeaders\` | added to every request | the simplest place for a token — but then the context *is* one identity |
| \`httpCredentials\` | HTTP Basic | default \`send: 'unauthorized'\` waits for a 401 challenge first; \`'always'\` sends it pre-emptively; \`origin\` limits it to one host |
| \`ignoreHTTPSErrors\` | accept invalid certificates | only for test environments; never hide a production certificate problem |
| \`timeout\` | per request | separate from the test timeout — a 30 s request in a 30 s test fails as a *test* timeout |
| \`storageState\` | preloads cookies | the same JSON a UI setup project writes |
| \`failOnStatusCode\` | throw on non-2xx/3xx | on \`newContext\` since Playwright 1.51; per request since the start |
| \`maxRedirects\` | redirect limit (default 20, 0 = do not follow) | per request since 1.26, on \`newContext\` since 1.52 |

ShopEasy has no Basic auth, HTTPS or redirects; the rows are there because your real APIs will.

## Requests and responses

All verbs are shorthands for \`fetch(url, { method, … })\`. The body options are mutually exclusive:

| Option | Encoding | Content-Type set for you | ShopEasy example |
|---|---|---|---|
| \`data\` (object) | JSON | \`application/json\` | login, cart, orders, users |
| \`data\` (string/Buffer) | sent as-is | none for strings — set it yourself | a deliberately broken body → \`400 INVALID_JSON\` |
| \`form\` | \`application/x-www-form-urlencoded\` | yes | ShopEasy rejects it: login with \`form\` → \`400 INVALID_JSON\` |
| \`multipart\` | \`multipart/form-data\` (object or \`FormData\`) | yes, with boundary | \`POST /api/users/{id}/avatar\` |
| \`params\` | query string (object, \`URLSearchParams\` or string) | — | \`/api/products?q=tee&sort=price_desc\` |

\`\`\`ts
// multipart: a file part named "file" plus a text part
const res = await api.post(\`/api/users/\${userId}/avatar\`, {
  headers: { Authorization: \`Bearer \${token}\` },
  multipart: {
    file: { name: 'avatar.png', mimeType: 'image/png', buffer: pngBytes },
    altText: 'Profile photo',
  },
});
expect(res.status()).toBe(201);                       // 415 UNSUPPORTED_MEDIA_TYPE for image/gif, 413 over 100 KB
\`\`\`

Per-request options worth knowing: \`failOnStatusCode: true\` (throws with the status in the message — useful in setup helpers where any error is a broken precondition), \`maxRedirects: 0\` (assert the 302 and its \`location\` header yourself), \`timeout\`, and \`maxRetries\` (Playwright 1.46+; retries network errors — the docs say only \`ECONNRESET\` — never HTTP 5xx).

Reading the response:

| Method | Returns | Note |
|---|---|---|
| \`status()\` / \`statusText()\` | number / string | |
| \`ok()\` | boolean | true for 200–299 |
| \`headers()\` | \`Record<string, string>\` | lower-case keys in practice; use \`headersArray()\` for repeated headers like \`set-cookie\` |
| \`json()\` / \`text()\` / \`body()\` | parsed / string / Buffer | \`json()\` throws on an empty 204 body |
| \`url()\` | final URL after redirects | |

**\`expect(response).toBeOK()\`** (Playwright 1.18+) asserts 200–299. Prefer it to \`expect(res.ok()).toBeTruthy()\`: when it fails, the message includes the response, so you see \`409 ITEM_ALREADY_IN_CART\` instead of \`expected true, received false\`. For an exact code (201 vs 200 matters for a create), assert \`status()\` and add a message: \`expect(res.status(), await res.text()).toBe(201)\`.

## A typed ApiClient

Raw \`request.post\` calls in every test spread URLs, headers and casts everywhere. A thin client class gives one place for auth, typing and error reporting (single responsibility; tests depend on intent-named methods, not on HTTP details).

\`\`\`ts
// tests/api/api-client.ts
import { APIRequestContext, APIResponse, expect } from '@playwright/test';

export interface ApiErrorBody { error: { code: string; message: string; details?: { field: string; message: string }[] } }
export interface LoginResponse { token: string; tokenType: 'Bearer'; expiresIn: number; user: { id: number; username: string } }
export interface CartItem { productId: number; name: string; price: number; quantity: number; lineTotal: number }
export interface Cart { userId: number; items: CartItem[]; itemCount: number; subtotal: number }
export interface Customer { firstName: string; lastName: string; postalCode: string }
export interface Order {
  id: number; userId: number; status: 'PLACED'; customer: Customer;
  items: CartItem[]; itemCount: number; subtotal: number; tax: number; total: number; createdAt: string;
}
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiClient {
  constructor(private readonly request: APIRequestContext, private readonly token?: string) {}

  static async login(request: APIRequestContext, username: string, password: string): Promise<ApiClient> {
    const res = await request.post('/api/auth/login', { data: { username, password } });
    await expect(res, 'login precondition').toBeOK();
    const body = (await res.json()) as LoginResponse;
    return new ApiClient(request, body.token);
  }

  /** Escape hatch for negative tests: no status check, you get the raw response. */
  send(method: Method, url: string, data?: unknown): Promise<APIResponse> {
    const headers: Record<string, string> = this.token ? { Authorization: \`Bearer \${this.token}\` } : {};
    return this.request.fetch(url, { method, data, headers });
  }

  private async expectJson<T>(res: APIResponse, status: number): Promise<T> {
    expect(res.status(), \`\${res.url()} → \${await res.text()}\`).toBe(status);
    return (await res.json()) as T;
  }

  async getCart(): Promise<Cart> { return this.expectJson<Cart>(await this.send('GET', '/api/cart'), 200); }
  async addToCart(productId: number, quantity = 1): Promise<Cart> {
    return this.expectJson<Cart>(await this.send('POST', '/api/cart/items', { productId, quantity }), 201);
  }
  async emptyCart(): Promise<void> { expect((await this.send('DELETE', '/api/cart')).status()).toBe(204); }
  async placeOrder(customer: Customer): Promise<Order> {
    return this.expectJson<Order>(await this.send('POST', '/api/orders', customer), 201);
  }
  async getOrder(id: number): Promise<Order> { return this.expectJson<Order>(await this.send('GET', \`/api/orders/\${id}\`), 200); }
  async listOrders(): Promise<Order[]> {
    return (await this.expectJson<{ data: Order[] }>(await this.send('GET', '/api/orders'), 200)).data;
  }
}
\`\`\`

Key decisions:

- **Typed methods assert the happy status; \`send\` does not.** Business methods are for arrange/act in positive flows — a wrong status there is a broken precondition and should fail loudly with the body in the message. Negative tests use \`send\` and assert the error themselves, so the client never hides the thing under test.
- **\`as T\` is a promise to the compiler, not validation.** Pair it with schema checks (below) on the endpoints whose shape matters.
- **Token per request vs token in \`extraHTTPHeaders\`.** Passing the header per call lets one underlying context serve any identity (and the \`request\` fixture stays auto-disposed). A context created with \`extraHTTPHeaders: { Authorization }\` is simpler but is one identity and must be disposed by you. Both are fine; be consistent.

### A fixture that hands each test its own logged-in customer

\`\`\`ts
// tests/api/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { ApiClient } from './api-client';

type Credentials = { id: number; username: string; password: string };
type ApiFixtures = { customer: Credentials; api: ApiClient; anon: ApiClient };

export const test = base.extend<ApiFixtures>({
  anon: async ({ request }, use) => { await use(new ApiClient(request)); },

  customer: async ({ request }, use, testInfo) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const username = \`pw_w\${testInfo.workerIndex}_\${Date.now().toString(36)}_\${suffix}\`;  // [a-z0-9_.-], ≤ 40
    const password = 'pw-test-password';                                                   // test-only, ≥ 8 chars
    const res = await request.post('/api/users', {
      data: { username, password, firstName: 'Api', lastName: 'Tester', email: \`\${username}@shopeasy.test\` },
    });
    expect(res.status(), await res.text()).toBe(201);
    const { id } = (await res.json()) as { id: number };
    await use({ id, username, password });
    // No DELETE /api/users exists: the user is unique and harmless. A restart or POST /api/reset clears it later — never from a test.
  },

  api: async ({ request, customer }, use) => {
    const client = await ApiClient.login(request, customer.username, customer.password);
    await use(client);
    await client.emptyCart();                     // teardown runs even when the test failed
  },
});
export { expect };
\`\`\`

- \`api\` depends on \`customer\`, so asking for \`api\` gives a registered, logged-in, **private** customer. \`anon\` gives an unauthenticated client for 401 tests.
- Cleanup belongs in the fixture after \`use\` — it runs on failure too, unlike the last lines of a test. Orders cannot be deleted through the API; with a per-test user they do not need to be.

### The CRUD journey

\`\`\`ts
// tests/api/order-journey.spec.ts
import { test, expect } from './fixtures';

test('a customer orders from the cart and is charged 8% tax', async ({ api }) => {
  await test.step('the new customer starts with an empty cart', async () => {
    expect((await api.getCart()).items).toEqual([]);
  });

  await test.step('add two backpacks and a bike light', async () => {
    await api.addToCart(1, 2);                          // Trailblazer Backpack 29.99 × 2
    const cart = await api.addToCart(2);                // Pulse Bike Light 9.99
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBeCloseTo(69.97, 2);
  });

  const order = await test.step('place the order from the cart', () =>
    api.placeOrder({ firstName: 'Asha', lastName: 'Rao', postalCode: '560001' }));

  expect(order).toMatchObject({ status: 'PLACED', itemCount: 3, subtotal: 69.97, tax: 5.6, total: 75.57 });
  expect(order.items.map((i) => i.productId)).toEqual([1, 2]);

  await test.step('the cart is emptied and the order is readable', async () => {
    expect((await api.getCart()).itemCount).toBe(0);
    expect((await api.getOrder(order.id)).total).toBe(order.total);
    expect((await api.listOrders()).map((o) => o.id)).toEqual([order.id]);
  });
});
\`\`\`

Step by step: \`test.step\` returns its callback's value, so the order flows out of a step and the HTML report reads like a test case. \`toMatchObject\` checks the business fields and ignores \`id\`/\`createdAt\`. \`listOrders\` can assert **exactly** one order because the customer is brand new — the strongest benefit of per-test users. To check the \`Location\` header of the create, use \`api.send('POST', '/api/orders', …)\` and \`expect(res.headers()['location']).toBe('/api/orders/' + body.id)\`.

## JSON schema validation: three approaches

ShopEasy publishes its product schema at \`GET /api/schema/product\`. Look at it before choosing a validator: its \`$schema\` is **draft-04** (it uses \`id\` and a boolean \`exclusiveMinimum\`), chosen so REST Assured's validator can read it. Ajv v8 no longer supports draft-04 out of the box — you need the \`ajv-draft-04\` package. Plain \`new Ajv()\` refuses it (unknown meta-schema), and the tempting "fix" — deleting \`$schema\` and \`id\` or turning strict mode off — changes what \`exclusiveMinimum\` means.

\`\`\`ts
// a) Ajv with the API's own schema
import Ajv from 'ajv-draft-04';
import { test, expect } from '@playwright/test';

test('every product matches the published schema', async ({ request }) => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(await (await request.get('/api/schema/product')).json());
  const list = await (await request.get('/api/products', { params: { size: 50 } })).json();
  for (const p of list.data) expect(validate(p), ajv.errorsText(validate.errors)).toBe(true);
});
\`\`\`

\`\`\`ts
// b) zod: the schema IS the TypeScript type
import { z } from 'zod';
const Product = z.object({
  id: z.number().int().positive(), slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1),
  price: z.number().positive(), category: z.enum(['bags', 'accessories', 'clothing', 'kids']),
  stock: z.number().int().min(0), inStock: z.boolean(), description: z.string(),
}).strict();
type Product = z.infer<typeof Product>;
const page1 = z.object({ data: z.array(Product), page: z.number(), size: z.number(), total: z.number(), totalPages: z.number() })
  .parse(await res.json());              // throws with a path, e.g. data[3].price, when the shape is wrong
\`\`\`

\`\`\`ts
// c) hand-written checks: only the fields this test relies on
const p = await (await request.get('/api/products/6')).json();
expect(p).toMatchObject({ id: 6, inStock: false, stock: 0 });
expect(typeof p.price).toBe('number');
\`\`\`

| | Ajv + published schema | zod | Hand-written |
|---|---|---|---|
| How it works | validates against the provider's JSON Schema | validates against a TS-first schema you own | \`expect\` on chosen fields |
| Advantages | the provider's contract, language-neutral, same file REST Assured uses | gives you the static type for free (\`z.infer\`), great error paths, no casts | zero dependencies, readable |
| Disadvantages | draft/version quirks; types must be written separately (or generated) | a second copy of the contract that can drift from the API's | misses unexpected fields and type changes |
| Performance | compile once, then very fast | fast | fastest |
| Maintainability / scale | best when the API publishes schemas or OpenAPI | best when the team owns the types | does not scale beyond a few endpoints |
| Use when | a schema/OpenAPI exists | no published schema; TS team wants types and validation in one | a single-field business check |

**Recommendation:** validate against the provider's published schema when one exists (compile once, e.g. in a worker-scoped fixture), use zod where no schema is published, and keep hand-written assertions for business rules (totals, states) — schema validation is never a substitute for them.

## Negative tests with the real error codes

Assert three things: status, \`error.code\` (stable, machine-readable) and, for validation, \`details[].field\`. Never assert the human \`message\` wording.

\`\`\`ts
import { test, expect } from './fixtures';

test('no token → 401 with a WWW-Authenticate challenge', async ({ anon }) => {
  const res = await anon.send('GET', '/api/cart');
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  expect(res.headers()['www-authenticate']).toContain('Bearer');
});

test('adding the same product twice → 409', async ({ api }) => {
  await api.addToCart(3);
  const res = await api.send('POST', '/api/cart/items', { productId: 3 });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe('ITEM_ALREADY_IN_CART');
});

test('order without a first name → 400 with field details', async ({ api }) => {
  await api.addToCart(1);
  const res = await api.send('POST', '/api/orders', { lastName: 'Rao', postalCode: '560001' });
  expect(res.status()).toBe(400);
  const { error } = await res.json();
  expect(error.code).toBe('VALIDATION_FAILED');
  expect(error.details).toContainEqual(expect.objectContaining({ field: 'firstName' }));
});

test('ordering with an empty cart → 422', async ({ api }) => {
  const res = await api.send('POST', '/api/orders', { firstName: 'A', lastName: 'B', postalCode: '560001' });
  expect([res.status(), (await res.json()).error.code]).toEqual([422, 'EMPTY_CART']);
});
\`\`\`

More real cases: \`GET /api/orders/1\` → 404 \`ORDER_NOT_FOUND\` (ids start above 1000); another customer's order → 403 \`FORBIDDEN\`; \`GET /api/products/abc\` → 400 \`INVALID_ID\`; \`POST /api/users\` with an existing username → 409 \`USERNAME_TAKEN\`; a bad email → 422 \`INVALID_EMAIL\`; \`PUT /api/products\` → 405 \`METHOD_NOT_ALLOWED\` with an \`allow\` header; \`data: '{oops'\` with \`content-type: application/json\` → 400 \`INVALID_JSON\`. The 403 test is the valuable one — it is an authorisation (IDOR) check, and it needs **two** isolated customers: request \`api\` plus a second \`ApiClient.login\` for another registered user.

## Data-driven API tests

Generate one test per row so each case has its own name, result and retry:

\`\`\`ts
const invalidCartAdds = [
  { title: 'quantity 0',            body: { productId: 1, quantity: 0 },   status: 422, code: 'INVALID_QUANTITY' },
  { title: 'quantity 11',           body: { productId: 1, quantity: 11 },  status: 422, code: 'INVALID_QUANTITY' },
  { title: 'fractional quantity',   body: { productId: 1, quantity: 2.5 }, status: 422, code: 'INVALID_QUANTITY' },
  { title: 'unknown product',       body: { productId: 999 },              status: 404, code: 'PRODUCT_NOT_FOUND' },
  { title: 'out-of-stock product',  body: { productId: 6 },                status: 422, code: 'OUT_OF_STOCK' },
  { title: 'productId as a string', body: { productId: '1' },              status: 400, code: 'VALIDATION_FAILED' },
] as const;

for (const c of invalidCartAdds) {
  test(\`cart rejects \${c.title} with \${c.status} \${c.code}\`, async ({ api }) => {
    const res = await api.send('POST', '/api/cart/items', c.body);
    expect(res.status(), await res.text()).toBe(c.status);
    expect((await res.json()).error.code).toBe(c.code);
  });
}
\`\`\`

Out-of-stock (product 6, Retro Red Tee) is the interesting row: \`422 OUT_OF_STOCK\` is not in the API's header comment — you only find it by reading the handler or exploring. Boundary rows (0, 1, 10, 11) belong next to equivalence rows; one row per rule, not twenty rows per rule.

## Test isolation under parallelism

| Strategy | How | Pros | Cons |
|---|---|---|---|
| Per-test user (the fixture above) | \`POST /api/users\` per test | total isolation, exact assertions (\`orders === [id]\`) | one extra call per test; users accumulate until reset |
| Per-worker user | worker-scoped fixture keyed by an index | fewer registrations | tests in one worker share a cart: each must clean up |
| Shared seeded user (\`standard_user\`) | log in as the seed user | zero setup | parallel tests corrupt each other's cart — flaky by design |
| Global \`POST /api/reset\` | reset before tests | clean slate | **wipes other workers' tokens, carts and users mid-test** |

**workerIndex vs parallelIndex.** \`testInfo.workerIndex\` is unique per worker *process*; after a test failure the worker is shut down and its replacement gets a **new** workerIndex but the **same** \`parallelIndex\` (a slot from 0 to workers−1). Use \`parallelIndex\` to pick from a pre-provisioned pool (\`perf_user_0..7\`) — at most one process uses a slot at a time. Use \`workerIndex\` (plus a run id) when **registering**: re-registering the same name after a restart would hit \`409 USERNAME_TAKEN\`, because the server kept the first one.

**Reset belongs outside the parallel phase:** restart the API in CI's \`webServer\`, or call \`/api/reset\` in a \`globalSetup\` that runs before any worker starts — never from a \`beforeEach\`.

## API + UI hybrid: arrange through the API, assert in the UI

The pattern: build state with fast API calls, then spend browser time only on what the user sees. ShopEasy has a twist that is worth saying out loud in an interview: the static web shop keeps its state **in the browser** — \`sessionStorage['shopeasy.user']\` (the username) and \`sessionStorage['shopeasy.cart']\` (a JSON array of product slugs) — and makes no API calls. So "arranging through the API" means fetching the real data from the API and seeding the UI's storage with \`addInitScript\`, because \`storageState\` does not include sessionStorage.

\`\`\`ts
// tests/ui/cart-from-api.spec.ts
import { test, expect } from '@playwright/test';

type Product = { slug: string; name: string; price: number; inStock: boolean };

test('cart shows the cheap in-stock products the API reports', async ({ page, request }) => {
  const res = await request.get('http://localhost:5181/api/products', { params: { sort: 'price_asc', size: 50 } });
  await expect(res).toBeOK();
  const picks = ((await res.json()).data as Product[]).filter((p) => p.inStock && p.price < 20);

  await page.addInitScript(({ user, cart }) => {
    if (location.port === '5180' && !sessionStorage.getItem('shopeasy.user')) {   // seed once, not on every navigation
      sessionStorage.setItem('shopeasy.user', user);
      sessionStorage.setItem('shopeasy.cart', JSON.stringify(cart));
    }
  }, { user: 'standard_user', cart: picks.map((p) => p.slug) });

  await page.goto('http://localhost:5180/practice-site/cart.html');
  await expect(page.getByTestId('cart-item')).toHaveCount(picks.length);
  await expect(page.getByTestId('inventory-item-name')).toHaveText(picks.map((p) => p.name));
});
\`\`\`

The init script runs before the page's scripts on **every** navigation and in every frame, hence the origin check and the "only if empty" guard — without it, removing an item and reloading would silently restore the seeded cart. With a server-side cart (most real shops), you would instead call the cart API as the same user and use \`page.request\` or a shared cookie so the UI reads the same session. Absolute URLs are used because the UI project's \`baseURL\` points at the shop, not the API.

## Contract tests vs functional API tests

Functional API tests (everything above) check behaviour of a running provider: rules, codes, totals. **Contract tests** check that a consumer and a provider agree on the shape of the interactions the consumer actually uses. In consumer-driven contract testing (Pact is the common tool, with pact-js for TypeScript), the consumer's tests produce a contract file; the provider's CI replays it against the provider and fails the provider's build before a breaking change ships — without both systems being deployed together. Schema validation is a weaker cousin: it checks "the response looks like the published schema", not "the fields this consumer reads still exist". Playwright has no contract-testing feature; Pact runs alongside it, usually in the services' own pipelines rather than in the QA suite.

## Performance-ish checks — and why they flake

\`\`\`ts
test('the request timeout is enforced', async ({ request }) => {
  await expect(request.get('/api/slow', { params: { ms: 3000 }, timeout: 1000 })).rejects.toThrow(/timeout|timed out/i);
});

test('health answers quickly (a smoke budget, not a benchmark)', async ({ request }) => {
  const started = Date.now();
  await expect(await request.get('/api/health')).toBeOK();
  expect(Date.now() - started).toBeLessThan(2000);      // generous budget, catches "hung", not "slow"
});
\`\`\`

\`/api/slow?ms=…\` (0–10000) makes timeout behaviour testable and deterministic. Response-time **assertions** on a single sample are flaky: the time includes the CI runner's CPU contention (8 workers fighting for 2 cores), DNS and connection set-up, and a single slow GC pause; one sample says nothing about p95. Keep only generous "is it hung?" budgets in functional suites; real performance testing belongs in k6/Gatling/JMeter with many samples, percentiles and a controlled environment.

## Disposing contexts

Contexts you create with \`playwright.request.newContext()\` live until you call \`await ctx.dispose()\`; all their buffered responses stay in memory. Do it in the fixture teardown (after \`use\`) or \`afterAll\`, never only at the end of a test body, which a failed assertion skips. After disposal, any call on the context throws — "context disposed" in a test usually means a worker-scoped client was disposed by a test-scoped teardown, or a response was read after its context ended. A long-running loop can call \`response.dispose()\` per response.

## REST Assured (Java) vs Playwright APIRequestContext

The same test — log in, add a product, assert the cart — in both:

\`\`\`java
// REST Assured 5, Java 17, TestNG
@Test
public void addToCart() {
    String token = given().baseUri("http://localhost:5181").contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
        .when().post("/api/auth/login")
        .then().statusCode(200).extract().path("token");

    given().baseUri("http://localhost:5181").contentType(ContentType.JSON).auth().oauth2(token)
            .body(Map.of("productId", 1, "quantity", 2))
        .when().post("/api/cart/items")
        .then().log().ifValidationFails()
            .statusCode(201)
            .body("items.find { it.productId == 1 }.quantity", equalTo(2))
            .body("subtotal", equalTo(59.98f));
}
\`\`\`

\`\`\`ts
// Playwright Test, TypeScript
test('add to cart', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { username: 'standard_user', password: 'secret_sauce' } });
  await expect(login).toBeOK();
  const { token } = (await login.json()) as LoginResponse;

  const res = await request.post('/api/cart/items', {
    headers: { Authorization: \`Bearer \${token}\` },
    data: { productId: 1, quantity: 2 },
  });
  expect(res.status(), await res.text()).toBe(201);
  const cart = (await res.json()) as Cart;
  expect(cart.items.find((i) => i.productId === 1)?.quantity).toBe(2);
  expect(cart.subtotal).toBeCloseTo(59.98, 2);
});
\`\`\`

Note the details a reviewer would spot: REST Assured's \`equalTo(59.98f)\` — JSON numbers are read as \`Float\` by default, a classic Hamcrest mismatch; in TypeScript the number is a plain \`number\` and \`toBeCloseTo\` handles floating point. Both versions log in as the shared seed user — fine for a side-by-side, wrong for a parallel suite.

| Aspect | REST Assured | Playwright APIRequestContext |
|---|---|---|
| Language / team fit | Java/Kotlin; fits JVM teams with Selenium, TestNG/JUnit, Maven/Gradle | TypeScript/JavaScript (also Python, Java, .NET bindings); fits a Playwright UI team |
| Style | fluent BDD-style \`given/when/then\` DSL; reads like a spec | plain async calls + \`expect\`; less DSL, more ordinary code |
| Navigating the body | GPath/JsonPath expressions (\`items.findAll { it.price > 20 }.name\`) — powerful, but strings checked only at runtime | plain JS objects, \`map/filter/find\`; with interfaces or zod the compiler checks field names |
| Schema validation | \`json-schema-validator\` module (\`matchesJsonSchemaInClasspath\`) built for it — draft-04 | none built in; add Ajv (+ \`ajv-draft-04\` for old schemas) or zod |
| Serialization | POJOs via Jackson/Gson both ways, \`.as(Order.class)\` | JSON objects natively; types are compile-time only unless validated |
| Filters / logging | request/response filters, \`log().ifValidationFails()\`, Allure filter, reusable \`RequestSpecification\` | no filter chain; wrap in your client class; every call is in the trace with headers and bodies |
| Reporting | via TestNG/JUnit + Allure/Extent | built-in HTML report, steps, trace viewer, same report as UI tests |
| Sharing auth with UI tests | separate stack: export cookies from Selenium manually | same runner: \`storageState\` interchangeable, \`page.request\` shares cookies, one fixture system |
| Parallelism | TestNG/JUnit threads; static \`RestAssured.baseURI\`/\`requestSpecification\` are global — keep specs per test | worker processes, no shared mutable globals; fixtures scope state per test or worker |
| Maturity / ecosystem | since around 2010, huge Stack Overflow footprint, Spring/microservice teams know it | newer for API work, smaller API-specific ecosystem, but evolving with each Playwright release |
| Performance | fast; JVM start-up per run | fast; no browser needed for API-only projects |

**Recommendations**

- **(a) Java team with a Selenium UI suite:** REST Assured. Same language, build, runner and reporting; the team can read it; the JVM ecosystem (POJOs, schema module, Allure filters) is mature. Adding Node only for API tests doubles the toolchain for no gain.
- **(b) TypeScript team with Playwright UI tests:** APIRequestContext. One runner, one report, one CI job, shared fixtures and auth, API calls for setup in UI tests. Add zod/Ajv for schemas and a small client class for the DSL-like readability.
- **(c) A dedicated API suite owned by a service team:** follow the service's language. A Spring Boot team keeps REST Assured (or its own integration test stack) in the service repo; contract tests (Pact) between services. Choose Playwright for API-only suites when the QA team is TypeScript-first and wants one framework across UI and API.

### How a senior justifies it to a manager

"I recommend we write the new API tests with Playwright's request client instead of adding a REST Assured project. Our UI suite is already Playwright and TypeScript, so we reuse the same CI job, report, fixtures and login code, and UI tests can create their data through the same client — that is where most of our UI flakiness and run time comes from. The trade-off: we lose REST Assured's built-in schema module and its DSL; we replace those with Ajv against the schemas the backend already publishes and a small typed client, roughly two days of work. If the backend team later wants tests in their own Java repo, REST Assured is the right tool there, and we would share the same schema files."

## Common mistakes and debugging

- **Test passes although the call failed.** \`await request.post(...)\` without a status check returns a 422 happily. Symptom: later steps fail far from the cause. Fix: \`toBeOK()\`/status assertions with \`await res.text()\` as the message, or \`failOnStatusCode\` in setup helpers.
- **\`SyntaxError: Unexpected end of JSON input\` from \`res.json()\`** — you parsed a 204 (\`DELETE /api/cart\`) or an HTML error page. Check \`status()\` and \`headers()['content-type']\` first.
- **401 in only some tests** — token stored in a module-level variable shared across tests, or a parallel test called \`/api/reset\` (tokens are dropped on reset). Find it in the trace: the failing request's \`authorization\` header and the timing of the reset.
- **\`URL\` resolves to the wrong path** — baseURL with a path plus a leading-slash relative URL; print \`res.url()\`.
- **Schema test always green** — validator could not read the draft, or \`validate\` was called on the wrong object (\`list\` instead of \`list.data\`). Prove it with a deliberately invalid object once.

## Best practices for experienced engineers

- One client class, intent-named methods, raw \`send\` for negative tests; no URLs in spec files.
- Fixtures own identity, setup and teardown; tests own assertions.
- Assert status + error code + field, never message text; add the body to assertion messages.
- Per-test or per-worker data; resets only before the parallel phase.
- Validate shape with the provider's schema where it exists; business rules with explicit expectations.
- Keep API tests in their own project (no browser, more workers) and tag smoke vs full.

## Interview questions

### Q: Does the Playwright \`request\` fixture share cookies with \`page\`?
**Short answer (30–60 s):** No. The fixture is an isolated APIRequestContext configured from the project's \`use\` options. \`page.request\` and \`context.request\` share the browser context's cookie storage in both directions.

**Detailed answer:** The fixture is created with \`newContext\` behind the scenes, so it has its own jar. If a cookie-session app needs "the same user as the browser", use \`page.request\`, or move state with \`storageState()\` — it is interchangeable between API and browser contexts. Token-based APIs share nothing automatically; you send the header.

### Q: How would you structure API tests so 8 workers can run them safely?
**Short answer (30–60 s):** Each test gets its own data — a freshly registered customer through a fixture — and no test resets shared state. Cleanup lives in fixture teardown.

**Detailed answer:** A test-scoped \`customer\` fixture registers via \`POST /api/users\` with a unique name (workerIndex + run id + random), \`api\` logs in as it and empties the cart after \`use\`. Exact assertions become possible ("this customer has exactly one order"). Use parallelIndex for slot-based pools of pre-provisioned users; never call \`/api/reset\` from tests because it drops every worker's tokens and carts.

### Q: \`expect(res).toBeOK()\` or \`expect(res.status()).toBe(201)\`?
**Short answer (30–60 s):** \`toBeOK\` for "any success" in setup; exact status for the endpoint under test, because 201 vs 200 is part of the contract.

**Detailed answer:** \`toBeOK\` (2xx) prints the response on failure, which makes it a good precondition check. For a create endpoint the test should pin 201 and the \`location\` header. Either way, include \`await res.text()\` in the message for status checks so the failure shows the error code.

### Q: How do you validate a response schema in Playwright?
**Short answer (30–60 s):** Playwright has no built-in schema assertion; use Ajv with the provider's schema, or zod if you own the types.

**Detailed answer:** Compile once per worker. Check the draft first — ShopEasy's schema is draft-04, which Ajv v8 only supports through \`ajv-draft-04\`. zod gives validation plus the TypeScript type via \`z.infer\`, removing \`as\` casts. Neither replaces business assertions.

### Q: What is the difference between \`data\`, \`form\` and \`multipart\`?
**Short answer (30–60 s):** \`data\` sends an object as JSON (strings/Buffers raw), \`form\` sends URL-encoded fields, \`multipart\` sends multipart/form-data with files; Playwright sets the content type for each.

**Detailed answer:** Sending the wrong one is a realistic negative test: ShopEasy's login with \`form\` returns 400 \`INVALID_JSON\`; a JSON body to the avatar endpoint returns 415 \`UNSUPPORTED_MEDIA_TYPE\`. File parts are \`{ name, mimeType, buffer }\` or a read stream.

### Q: When would you choose REST Assured over Playwright for API tests?
**Short answer (30–60 s):** When the team and the existing stack are Java — Selenium/TestNG suites or API tests living in a Java service repo.

**Detailed answer:** REST Assured brings a mature DSL, GPath, POJO mapping, a schema module and filters; it fits JVM CI and reporting. Playwright wins when the UI suite is Playwright/TS: one runner, report, fixtures and auth, and API setup inside UI tests. The decision is about team fit and integration, not raw capability — both send HTTP well.

### Q: Why are response-time assertions in functional suites flaky?
**Short answer (30–60 s):** One sample on a shared CI runner measures the runner as much as the API.

**Detailed answer:** CPU contention between workers, connection set-up and GC pauses add noise; there is no percentile. Keep generous "hung" budgets and request timeouts (\`/api/slow\` shows the timeout path), and move real performance checks to a load tool with many samples.

### Q: Can \`page.route\` mock a call made with \`request.get\`?
**Short answer (30–60 s):** No — APIRequestContext runs in Node, outside the browser network stack, so routes never see it.

**Detailed answer:** Routing intercepts browser requests only. To control an API dependency of API tests, use a stub server (or WireMock-style tool) or a test environment flag; to observe API calls, look at the trace.

## Scenario-based questions

**1. The API suite passes locally and fails randomly on CI with 401s.** I would look for shared identity first: a token in a module variable reused across workers, a \`beforeAll\` login in a file that is now \`fullyParallel\`, or a reset call. The trace shows which request lost auth and when. ShopEasy drops all tokens on \`/api/reset\`, so a single \`beforeEach(reset)\` in one file explains random 401s in others. Fix: per-test customers through a fixture, reset moved to before the run.

**2. A manager asks why the team should not "just use Postman/Newman" instead.** Postman is good for exploration and for sharing collections with developers. For regression I want typed code reviewed in pull requests, fixtures for isolated data, the same CI report as the UI suite, and API setup inside UI tests — none of which Newman gives cheaply. I would keep the collection as living documentation and generate nothing from it.

**3. The backend renamed \`subtotal\` to \`subTotal\` and the UI broke in production while all API tests were green.** The API tests cast the body \`as Order\` and asserted only \`total\`, so nothing read \`subtotal\` and the cast hid that it was now \`undefined\`. I would add schema validation with \`additionalProperties: false\` (ShopEasy's product schema already has it) or zod \`.strict()\`, and propose a consumer contract (Pact) so the provider's build fails before release.

## Tricky follow-ups

- **Does \`maxRetries\` retry a 503?** No — it retries network errors (the docs say only \`ECONNRESET\`), not HTTP statuses. Retrying a non-idempotent POST would be dangerous anyway.
- **Is \`as Order\` validation?** No, it is erased at compile time; the runtime object can be anything.
- **Why not one \`beforeAll\` login for the whole file?** It couples tests to one identity and breaks under \`fullyParallel\`, where tests of one file run in different workers.
- **The \`request\` fixture in a UI project calls the API on another port — what breaks?** Relative URLs resolve against the UI baseURL; use absolute URLs or a dedicated \`newContext({ baseURL })\` client.
- **Does \`dispose()\` on the \`request\` fixture matter?** Playwright disposes it after each test; you dispose only contexts you created.`,
  keyPoints: [
    'APIRequestContext is a Node-side HTTP client: no CORS, not intercepted by page.route, responses buffered until dispose().',
    'The request fixture and request.newContext() have isolated cookie jars; page.request/context.request share the browser context cookies both ways.',
    'Wrap the context in a typed ApiClient (typed happy-path methods + a raw send for negative tests) and provide it through a fixture that registers and logs in a per-test customer.',
    'Assert status + error.code + details[].field; use toBeOK() for preconditions and exact status codes for the endpoint under test.',
    'Validate shape with the provider schema (ShopEasy is draft-04 → ajv-draft-04) or zod; keep explicit assertions for business rules.',
    'Never reset shared state from parallel tests; use workerIndex for unique registration and parallelIndex for slot-based user pools.',
    'Seed ShopEasy UI state with addInitScript (sessionStorage), because storageState does not include it.',
    'REST Assured fits Java/Selenium teams; APIRequestContext fits Playwright/TypeScript teams — the choice is team fit and integration, not capability.',
  ],
  mistakes: [
    'Not checking the status of setup calls, so a 409/422 surfaces three steps later. Fix: toBeOK() or failOnStatusCode in helpers, and put await res.text() in assertion messages so the error code is visible.',
    'Logging every test in as standard_user and running fullyParallel — carts collide (409 ITEM_ALREADY_IN_CART, wrong itemCount). Fix: a per-test customer fixture via POST /api/users; check the trace to see two tests hitting the same cart.',
    'Calling POST /api/reset in beforeEach. It drops every worker\'s tokens, carts and registered users, causing random 401s elsewhere. Fix: reset once before the run (globalSetup or restart the server in webServer).',
    'Compiling the ShopEasy draft-04 schema with plain Ajv v8 (it throws on the unknown meta-schema), then "fixing" it by deleting $schema/id or switching off strict mode. Fix: use ajv-draft-04, and prove the validator fails on a deliberately broken object once.',
    'Expecting page.route to mock calls made with request/page.request, then debugging "why is my mock ignored". Fix: those calls run in Node; use a stub server or test-environment configuration, and confirm in the trace.',
    'Creating contexts with request.newContext() in tests and disposing them at the end of the test body. Fix: create and dispose in a fixture (after use) so teardown runs on failure too.',
  ],
  tryIt: `Start the API (\`npm run api\`). In a Playwright project with an \`api\` project whose \`baseURL\` is \`http://localhost:5181\`:

1. Build the \`ApiClient\` and the \`customer\`/\`api\` fixtures from this lesson.
2. Write the cart → order journey for a fresh customer with three Classic Crew T-Shirts (product 3) and assert \`subtotal\`, \`tax\` and \`total\` (8% tax, rounded to 2 decimals) and the \`location\` header of \`POST /api/orders\`.
3. Add a data-driven block for \`POST /api/users\` covering \`409 USERNAME_TAKEN\`, \`422 INVALID_EMAIL\` and \`400 VALIDATION_FAILED\` (short password, bad username) — assert the \`details[].field\` for the 400s.
4. Write the IDOR test: customer A places an order, customer B's \`GET /api/orders/{id}\` must return \`403 FORBIDDEN\`.
5. Validate every product from \`GET /api/products?size=50\` against \`GET /api/schema/product\` with \`ajv-draft-04\`, then break one field in a copy and check the test fails.
6. Run with \`--workers=4 --repeat-each=5\`; it must stay green.`,
  problems: ['pw-013', 'pw-027', 'pw-029', 'pw-030'],
}
