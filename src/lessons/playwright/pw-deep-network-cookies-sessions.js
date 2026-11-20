export default {
  slug: 'pw-deep-network-cookies-sessions',
  category: 'playwright',
  order: 16,
  title: 'Deep dive: network interception, cookies, sessions and authentication strategies',
  minutes: 30,
  summary: 'Explain how Playwright routing works underneath (handler order, fulfill/continue/fallback/abort, route.fetch, URL matching, HAR replay), observe and assert traffic without races, and design an authentication strategy — UI login, setup project, API login and injection, per-worker accounts, multiple roles — that is fast, isolated and safe, knowing exactly what storageState does and does not save.',
  manualAnalogy: `When you test by hand you open DevTools → Network to see which call failed, use a proxy like Charles or Fiddler to return a 500 or slow the connection, and keep a logged-in browser profile so you do not type the password before every test case. You also know that "clear cookies" logs you out on one site but not on another, because each app keeps its session somewhere different. Playwright gives you all of these as code: a proxy inside the browser, a network log you can assert on, and saved browser state.`,
  body: `## Where the earlier lessons stop

The *Beyond clicks* lesson showed \`page.route\` with \`fulfill\`/\`abort\`/\`fetch\` and \`waitForResponse\`; the *Log in once* lesson showed a setup project, \`storageState\` and the ShopEasy sessionStorage catch. This lesson explains the mechanism behind both and compares the strategies you will be asked to choose between in a design review.

**A ShopEasy fact to keep in mind:** the practice site at \`localhost:5180\` is static — its pages load \`site.css\` and \`shop.js\` but make **no API calls**; the catalogue is in \`shop.js\`, the logged-in user is \`sessionStorage['shopeasy.user']\`, the cart is \`sessionStorage['shopeasy.cart']\`, and "Remember me" writes \`localStorage['shopeasy.rememberedUser']\`. The REST API on \`localhost:5181\` is separate (\`POST /api/auth/login\` returns \`{ token, tokenType: 'Bearer', expiresIn: 3600, user }\`, CORS is open). Examples that mock an SPA's API calls are labelled as such; the runnable ones make the browser call the real API with \`page.evaluate(fetch…)\`, which goes through the same interception pipeline as any app request.

## How routing works

### The mechanism

\`page.route(url, handler)\` / \`context.route(url, handler)\` turn on request interception for the page or context. From then on, every request the browser makes that matches the pattern is **paused** in the browser's network stack and sent to your Node handler as a \`Route\` + \`Request\`. Nothing happens until the handler decides — a handler that forgets to call one of the four methods leaves the request hanging until the page's timeout.

| Decision | What it does | Other handlers? |
|---|---|---|
| \`route.fulfill({ status, json, body, path, headers, contentType, response })\` | answers from Node; the server never sees it | stop |
| \`route.continue({ url, method, headers, postData })\` | sends to the network now (optionally modified) | **stop** — no other matching handler runs |
| \`route.fallback({ … same overrides })\` (1.23+) | passes to the **next** matching handler (or the network if none) | continue the chain |
| \`route.abort(errorCode?)\` | fails like a network error: \`'failed'\` (default), \`'timedout'\`, \`'connectionrefused'\`, \`'internetdisconnected'\`, \`'blockedbyclient'\`… | stop |
| \`route.fetch({ url, headers, timeout, maxRedirects })\` (1.29+) | performs the request from Node and returns an \`APIResponse\`; you then \`fulfill({ response, json })\` | — |

**Interception order.** When several routes match, the **most recently registered** handler runs first; page routes run before context routes. \`fallback()\` hands the request to the next older one. That gives a clean layering model:

\`\`\`ts
// fixture (registered first) — default: block analytics, let everything else through
await context.route('**/*', (route) =>
  route.request().url().includes('analytics') ? route.abort('blockedbyclient') : route.fallback());

// test (registered later, runs first) — override one endpoint, pass the rest down the chain
await page.route('**/api/cart*', (route) =>
  route.request().method() === 'GET' ? route.fulfill({ json: { items: [], itemCount: 0, subtotal: 0 } }) : route.fallback());
\`\`\`

If the test used \`continue()\` instead of \`fallback()\`, the analytics blocking in the fixture would be bypassed for those requests — a classic "why are my fixture routes ignored?" bug.

**Side effects you must know.** Enabling routing **disables the HTTP cache** for that page/context (tests can be slower and see more requests than users do). Routing does **not** intercept requests handled by a **Service Worker**; set \`serviceWorkers: 'block'\` in \`use\` when you mock a PWA (release notes for 1.57 add routing of service-worker requests through context routes in Chromium — do not rely on it cross-browser). \`page.route\` does not see the first request of a popup — use \`context.route\`. \`route.continue\` cannot override the \`Cookie\` header; use \`context.addCookies\`.

### URL matching

| Pattern | Example | Matches | Watch out |
|---|---|---|---|
| glob string | \`'**/api/products*'\` | whole URL; \`*\` = no slash, \`**\` = anything, \`{a,b}\` alternatives | \`'**/api/products'\` does **not** match \`…/api/products?sort=…\`; in recent versions (1.52+) \`?\` and \`[]\` are no longer glob syntax — use a RegExp |
| RegExp | \`/\\/api\\/products(\\?.*)?$/\` | tested against the full URL | escape \`/\` and \`.\`; anchors matter |
| predicate | \`(url) => url.pathname === '/api/products' && url.searchParams.get('q') === 'tee'\` | a \`URL\` object | most precise, most readable for query logic |

Options: \`{ times: 1 }\` (1.15+) uses a handler once — ideal for "first call fails, retry succeeds". Remove routes with \`page.unroute(url, handler?)\` or \`page.unrouteAll({ behavior: 'wait' | 'ignoreErrors' | 'default' })\` (1.41+); \`'wait'\` lets in-flight handlers finish so they do not throw after the test moved on.

## Use cases with full code

The runnable harness below uses the real API on 5181 from a ShopEasy page:

\`\`\`ts
// tests/network/route-patterns.spec.ts
import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5181';
const CORS = { 'Access-Control-Allow-Origin': '*' };          // 1

async function loadProducts(page: Page, query = '') {
  return page.evaluate(async (url) => {                          // 2
    try {
      const res = await fetch(url);
      return { status: res.status, body: await res.json() };
    } catch (e) {
      return { status: 0, body: String(e) };
    }
  }, \`\${API}/api/products\${query}\`);
}

test.beforeEach(async ({ page }) => { await page.goto('/practice-site/inventory.html'); });

test('error state: the API returns 500 once, the retry succeeds', async ({ page }) => {
  await page.route('**/api/products*', (route) => route.fulfill({
    status: 500, headers: CORS,
    json: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
  }), { times: 1 });                                               // 3

  expect((await loadProducts(page)).status).toBe(500);
  expect((await loadProducts(page)).status).toBe(200);            // route used up → real server
});

test('empty state', async ({ page }) => {
  await page.route((url) => url.pathname === '/api/products', (route) =>
    route.fulfill({ headers: CORS, json: { data: [], page: 1, size: 10, total: 0, totalPages: 0 } }));
  const { body } = await loadProducts(page, '?q=anything');
  expect(body.total).toBe(0);
});

test('modify one field of the real response', async ({ page }) => {
  await page.route('**/api/products*', async (route) => {
    const response = await route.fetch();                          // 4 real call from Node
    const json = await response.json();
    json.data[0].price = 0.01;                                     // e.g. test a "price drop" badge
    await route.fulfill({ response, json });                       // 5 keeps real status + headers
  });
  const { body } = await loadProducts(page, '?sort=price_asc');
  expect(body.data[0].price).toBe(0.01);
  expect(body.data).toHaveLength(Math.min(10, body.total));        // rest is real data
});

test('slow network: delay a response without hard waits in the test', async ({ page }) => {
  await page.route('**/api/products*', async (route) => {
    await new Promise((r) => setTimeout(r, 2_000));                // 6 latency inside the handler
    await route.continue();
  });
  const started = Date.now();
  await loadProducts(page);
  expect(Date.now() - started).toBeGreaterThanOrEqual(2_000);
});

test('network failure', async ({ page }) => {
  await page.route('**/api/products*', (route) => route.abort('internetdisconnected'));
  expect((await loadProducts(page)).status).toBe(0);              // fetch rejected → TypeError
});
\`\`\`

1. **CORS gotcha:** the page (5180) calls another origin (5181). A response you fabricate with \`fulfill\` must carry \`Access-Control-Allow-Origin\` itself, or the browser rejects it and the test reports a mysterious "Failed to fetch". With \`route.fetch\` + \`fulfill({ response })\` the real headers are reused.
2. \`page.evaluate(fetch…)\` is a test harness; in a real SPA the click or page load makes the call.
3. \`times: 1\` — the next matching request goes past this handler.
4–5. \`route.fetch\` is the best of both worlds: real data, one field changed. Its timeout defaults to 30 s.
6. The delay lives in the handler, so the **app** experiences latency while the test uses normal web-first assertions (spinner visible → spinner hidden). For bandwidth throttling, Chromium-only CDP \`Network.emulateNetworkConditions\` via \`context.newCDPSession(page)\`; for "offline", \`context.setOffline(true)\` works in all browsers.

### Blocking third-party scripts and images for speed

\`\`\`ts
// fixtures.ts — opt-in speed fixture; keep it off for visual tests
import { test as base } from '@playwright/test';

const BLOCKED_HOSTS = ['www.googletagmanager.com', 'www.google-analytics.com', 'connect.facebook.net', 'cdn.hotjar.com'];

export const test = base.extend<{ blockThirdParty: void }>({
  blockThirdParty: [async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const req = route.request();
      const host = new URL(req.url()).hostname;
      if (BLOCKED_HOSTS.includes(host)) return route.abort('blockedbyclient');
      if (req.resourceType() === 'image' || req.resourceType() === 'font') return route.abort();
      return route.fallback();                                    // let test-level routes and the network decide
    });
    await use();
  }, { auto: false }],
});
\`\`\`

Trade-offs: real gains on ad-heavy pages, but every request now crosses into Node (overhead on asset-heavy pages), the HTTP cache is off, and you are testing a page users never see. Block **third parties** you do not own; do not block your own images in visual or layout tests. Prefer filtering on \`resourceType()\`/host over broad globs.

## HAR record and replay vs hand-written mocks

\`routeFromHAR\` (1.23+) serves responses from a HAR file recorded against a real backend.

\`\`\`ts
// record (run once, or when the API changes): requests go to the network and are written to the HAR
await page.routeFromHAR('hars/catalogue.har', {
  url: '**/api/products*',          // only these requests are recorded/served
  update: true,
  updateContent: 'embed',           // 1.32+: 'embed' bodies in the HAR or 'attach' as separate files
  updateMode: 'minimal',            // 1.32+: 'minimal' (default) keeps what replay needs; 'full' keeps everything
});
// … drive the page …  the HAR is written when the context closes

// replay (normal runs)
await page.routeFromHAR('hars/catalogue.har', { url: '**/api/products*', notFound: 'fallback' });
\`\`\`

Replay matches **URL and method strictly**, and **POST bodies strictly**; headers only break ties between several matching entries. \`notFound: 'abort'\` (default) fails unknown requests — strict and safe; \`'fallback'\` lets them reach the next handler/network. A recording can also come from the CLI: \`npx playwright open --save-har=catalogue.har --save-har-glob="**/api/**" http://localhost:5180/practice-site/\`. Whole-context capture without replay is the \`recordHar\` context option.

| | Hand-written \`fulfill\` mock | HAR replay | Real backend |
|---|---|---|---|
| How | code builds the response | recorded real responses replayed by URL+method(+body) | no interception |
| Advantages | explicit, reviewable, edge cases (500, empty, huge) | realistic payloads with no typing; fast; deterministic | tests real integration and data |
| Disadvantages | drifts from the real contract; verbose for big payloads | opaque diffs, strict matching breaks on changed query params/timestamps in bodies; can contain secrets | slow, flaky, shared data, hard edge cases |
| Performance | fastest | fast | slowest |
| Maintainability | good for a few endpoints | re-record when API changes; review HAR diffs is hard | no mock maintenance |
| Scalability | poor for many endpoints | good for many read-only endpoints | limited by environment |
| When to use | error/empty/edge states, one field changes | stable read-mostly pages, demo/offline mode, front-end component suites | critical journeys, contract and smoke tests |

**Recommendation:** hand-written mocks for **states** (error, empty, slow, permission denied), \`route.fetch\` + patch for "real data with one tweak", HAR for wide read-only pages when the front-end team needs a fast deterministic suite, and a **non-mocked** tier for the critical journeys. Mocked tests prove the UI handles a contract; only real calls (or consumer-driven contract tests) prove the contract still holds.

## Observing traffic

| Tool | Shape | Use for |
|---|---|---|
| \`page.waitForResponse(urlOrPredicate)\` / \`waitForRequest\` | one Promise, created before the action | sync a step on one call; assert status or payload |
| \`page.on('request' \\| 'response' \\| 'requestfailed' \\| 'requestfinished')\` | listener for every event | collecting all calls: "no 5xx during the test", counting calls, logging |
| \`response.request().postDataJSON()\` | parsed JSON body | asserting what the UI **sent** |

\`\`\`ts
// realistic SPA example: the checkout page posts the order to the ShopEasy API
const orderRequest = page.waitForRequest((r) => r.url().endsWith('/api/orders') && r.method() === 'POST');
const orderResponse = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
await page.getByRole('button', { name: 'Finish' }).click();

const sent = (await orderRequest).postDataJSON() as { firstName: string; lastName: string; postalCode: string };
expect(sent).toEqual({ firstName: 'Asha', lastName: 'Rao', postalCode: '560001' });
const res = await orderResponse;
expect(res.status()).toBe(201);
expect(res.headers()['location']).toMatch(/^\\/api\\/orders\\/\\d+$/);   // header names are lower-case
\`\`\`

\`\`\`ts
// fixture: fail any test during which the app received a 5xx — catches errors the UI swallows
import { test as base, expect, type Response } from '@playwright/test';

export const test = base.extend<{ noServerErrors: void }>({
  noServerErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    const onResponse = (r: Response) => { if (r.status() >= 500) errors.push(\`\${r.status()} \${r.request().method()} \${r.url()}\`); };
    page.on('response', onResponse);
    await use();
    page.off('response', onResponse);
    expect(errors, 'server errors during the test').toEqual([]);
  }, { auto: true }],
});
\`\`\`

Choose \`waitForResponse\` for synchronisation (one call, deterministic), listeners for **policies** across a whole test. Never \`waitForResponse\` *after* the action, and do not use a listener + \`waitForTimeout\` as synchronisation. Predicates beat glob strings here because they can check method and query.

## Mocking vs hitting the real backend

Think test pyramid: most business rules are cheaper to test at the API level (the ShopEasy API's 422 \`INVALID_QUANTITY\`, 409 \`ITEM_ALREADY_IN_CART\`); UI tests with mocks verify that the UI renders each contract state; a thin layer of real end-to-end journeys proves the pieces fit. The main risk of mocks is **contract drift**: the backend renames \`total\` to \`totalCount\`, every mocked UI test stays green and production breaks. Mitigations: build mock bodies from shared TypeScript types or JSON Schema (ShopEasy exposes \`GET /api/schema/product\`), re-record HARs on a schedule, run consumer-driven contract tests (e.g. Pact) or at least an API test that validates the real response against the same schema the mocks use, and keep the unmocked smoke tier.

## Cookies

\`\`\`ts
const cookies = await context.cookies();                          // all cookies in the context
const shopCookies = await context.cookies('http://localhost:5180'); // only those sent to this URL

await context.addCookies([{
  name: 'session', value: 'se_1_0001_…',
  domain: 'localhost', path: '/',                                 // either url, or domain + path
  httpOnly: true, secure: false, sameSite: 'Lax',
  expires: Math.floor(Date.now() / 1000) + 3600,                  // Unix time in SECONDS; omit or -1 = session cookie
}]);

await context.clearCookies();                                     // everything
await context.clearCookies({ name: 'session' });                  // 1.43+: filter by name, domain, path (string | RegExp)
await context.clearCookies({ domain: /\\.google\\.com$/ });
\`\`\`

| Attribute | Why it matters in tests |
|---|---|
| \`domain\` / \`path\` | cookie is only sent to matching hosts/paths; a cookie for \`api.shop.test\` is not sent to \`www.shop.test\` unless set for \`.shop.test\` |
| \`httpOnly\` | invisible to \`document.cookie\` — \`page.evaluate\` cannot read the session; use \`context.cookies()\` |
| \`secure\` | only sent over HTTPS; a \`secure\` cookie added for an \`http://localhost\` test is not sent in every browser — keep test envs consistent |
| \`sameSite\` | \`Strict\`/\`Lax\`/\`None\`; cross-site iframes and SSO redirects lose \`Lax\`/\`Strict\` cookies; \`None\` requires \`secure\` |
| \`expires\` | seconds, not ms (a common bug: \`Date.now()\` sets a date 50,000 years ahead) |

Cookies are **per context**, never shared between tests — that is the isolation guarantee. \`clearCookies\` is the right way to test "session expired → redirect to login" for cookie-based apps; it does nothing for ShopEasy's practice site, whose session is in sessionStorage.

## localStorage and sessionStorage

\`\`\`ts
// read / write after the page is on the origin
const user = await page.evaluate(() => sessionStorage.getItem('shopeasy.user'));
await page.evaluate(() => localStorage.setItem('shopeasy.rememberedUser', 'standard_user'));

// recent Playwright (1.61+): a typed async API for the current origin
const remembered = await page.localStorage.getItem('shopeasy.rememberedUser');
const all = await page.sessionStorage.items();                    // [{ name, value }]

// seed BEFORE the app's scripts run, on every navigation and every new page of the context
await context.addInitScript(() => {
  if (location.origin === 'http://localhost:5180') {
    sessionStorage.setItem('shopeasy.user', 'standard_user');
    sessionStorage.setItem('shopeasy.cart', JSON.stringify(['trailblazer-backpack']));
  }
});
\`\`\`

Storage is **per origin**, so reading it needs a page already on that origin (a \`goto\` first). Writing after load is too late for apps that read storage once on start-up; then either reload after writing or use \`addInitScript\`, which runs before page scripts. Guard init scripts by origin — they also run in third-party iframes.

## storageState internals

\`context.storageState()\` serialises **cookies** (all of them, including httpOnly) and, per origin, **localStorage** into \`{ cookies: [...], origins: [{ origin, localStorage: [{ name, value }] }] }\`. Optional flags add IndexedDB (\`indexedDB: true\`, 1.51+) and, in recent versions, other stores. **sessionStorage is never saved**: it belongs to one tab's session. Loading happens when a context is created with \`storageState\` (or, in Playwright 1.59+, \`context.setStorageState()\` replaces the state of an existing context). \`request.storageState()\` works on an \`APIRequestContext\` too, so an API login can produce the same file.

**ShopEasy's catch, concretely:** after a UI login, \`storageState\` contains no cookies and only \`shopeasy.rememberedUser\` (if "Remember me" was ticked). A test that loads this file opens \`inventory.html\` as **guest**. You either save sessionStorage yourself in the setup project and restore it with \`addInitScript\`, or — simpler — inject \`shopeasy.user\` directly, because the practice site trusts it (a real app would need a real token).

## Authentication strategies

### 1. UI login per test

\`\`\`ts
test.beforeEach(async ({ page }) => {
  await page.goto('/practice-site/login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill(process.env.SHOP_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/inventory\\.html/);
});
\`\`\`

### 2. Setup project + storageState (with the sessionStorage step)

\`\`\`ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

setup('log in as customer', async ({ page }) => {
  await page.goto('/practice-site/login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill(process.env.SHOP_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#logged-in-user')).toHaveText('standard_user');

  await mkdir('playwright/.auth', { recursive: true });
  await page.context().storageState({ path: 'playwright/.auth/customer.json' });   // cookies + localStorage
  const session = await page.evaluate(() => JSON.stringify(sessionStorage));        // the part storageState skips
  await writeFile('playwright/.auth/customer.session.json', session, 'utf-8');
});
\`\`\`

\`\`\`ts
// fixtures/auth.ts — restore sessionStorage on top of storageState
import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const test = base.extend({
  context: async ({ context }, use) => {
    const session = JSON.parse(readFileSync('playwright/.auth/customer.session.json', 'utf-8')) as Record<string, string>;
    await context.addInitScript((data) => {
      if (location.origin !== 'http://localhost:5180') return;
      for (const [k, v] of Object.entries(data)) if (sessionStorage.getItem(k) === null) sessionStorage.setItem(k, v);
    }, session);
    await use(context);
  },
});
\`\`\`

The \`getItem === null\` guard matters: without it, every navigation would reset the cart to the saved snapshot. Config: a \`setup\` project with \`testMatch: /.*\\.setup\\.ts/\` and \`dependencies: ['setup']\`, \`use: { storageState: 'playwright/.auth/customer.json' }\` in the test project (see the *Log in once* lesson).

### 3. API login, then inject the cookie or token

\`\`\`ts
// fixtures/api-auth.ts — log in over HTTP (milliseconds), inject the session into the browser
import { test as base, request, expect } from '@playwright/test';

type Session = { token: string; username: string };

export const test = base.extend<{ session: Session }>({
  session: async ({}, use) => {
    const api = await request.newContext({ baseURL: 'http://localhost:5181' });
    const res = await api.post('/api/auth/login', { data: { username: 'standard_user', password: process.env.SHOP_PASSWORD } });
    expect(res.status()).toBe(200);
    const { token, user } = (await res.json()) as { token: string; user: { username: string } };
    await api.dispose();
    await use({ token, username: user.username });
  },
  context: async ({ context, session }, use) => {
    await context.addInitScript((s) => {
      if (location.origin !== 'http://localhost:5180') return;
      sessionStorage.setItem('shopeasy.user', s.username);       // what the practice site reads
      localStorage.setItem('shopeasy.token', s.token);           // realistic SPA: token in storage
    }, session);
    // realistic cookie-session app instead:
    // await context.addCookies([{ name: 'SESSION', value: session.token, url: 'http://localhost:5180', httpOnly: true }]);
    // tempting but broad — sends the token to EVERY host:
    // await context.setExtraHTTPHeaders({ Authorization: \`Bearer \${session.token}\` });
    await use(context);
  },
});
\`\`\`

\`setExtraHTTPHeaders\` sends the header to **every** host, including third parties — prefer a \`context.route\` that adds it only for your API origin (\`route.fallback({ headers: { ...route.request().headers(), authorization: … } })\`), or let the app attach the token itself from storage.

### 4. One account per worker

Shared accounts break under parallelism: two workers editing one customer's cart or address book. Give each worker its own account, created once per worker:

\`\`\`ts
// fixtures/worker-account.ts
import { test as base, request } from '@playwright/test';

type Account = { username: string; password: string; token: string };

export const test = base.extend<{}, { account: Account }>({
  account: [async ({}, use, workerInfo) => {
    const api = await request.newContext({ baseURL: 'http://localhost:5181' });
    const username = \`pw_w\${workerInfo.parallelIndex}_\${Date.now()}\`;      // unique per worker and per run
    const password = 'Str0ngPass!';
    await api.post('/api/users', { data: { username, password, firstName: 'Worker', lastName: String(workerInfo.parallelIndex), email: \`\${username}@shopeasy.test\` } });
    const login = await api.post('/api/auth/login', { data: { username, password } });
    const { token } = (await login.json()) as { token: string };
    await use({ username, password, token });
    await api.dispose();
  }, { scope: 'worker' }],
});
\`\`\`

\`workerIndex\` is unique per worker **process** and grows when a worker is restarted after a failure; \`parallelIndex\` is the slot \`0 … workers-1\` and is reused. The official pattern uses \`parallelIndex\` to pick from a **pre-provisioned pool** of accounts (\`user-0 … user-N\`); with an API that can register users (ShopEasy's \`POST /api/users\`), creating a fresh user per worker is even safer.

### 5. Multiple roles

\`\`\`ts
// playwright.config.ts (excerpt) — the setup project writes one file per role
projects: [
  { name: 'setup', testMatch: /.*\\.setup\\.ts/ },
  { name: 'customer', dependencies: ['setup'], testIgnore: /admin/, use: { storageState: 'playwright/.auth/customer.json' } },
  { name: 'admin', dependencies: ['setup'], testMatch: /admin\\/.*\\.spec\\.ts/, use: { storageState: 'playwright/.auth/admin.json' } },
],
\`\`\`

\`\`\`ts
// one test, two roles at once (realistic example: an admin refunds a customer's order)
test('admin refund appears in the customer order history', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
  const customer = await browser.newContext({ storageState: 'playwright/.auth/customer.json' });
  try {
    const adminPage = await admin.newPage();
    const customerPage = await customer.newPage();
    // … admin refunds ORD-1043, customer sees "Refunded" …
  } finally {
    await admin.close();
    await customer.close();
  }
});
\`\`\`

### Strategies compared

| Strategy | How it works | Advantages | Disadvantages | Speed | Scales to parallel? | When to use |
|---|---|---|---|---|---|---|
| UI login per test | type credentials in \`beforeEach\` | simplest; tests the real flow | 2–3 s per test; login flakiness pollutes every test | slow | yes (if accounts not shared) | the login tests themselves; tiny suites |
| Setup project + storageState | log in once, save file, load into every context | fast; failures visible as a setup test with a trace | misses sessionStorage/in-memory sessions; one shared account by default | fast | needs per-worker files if tests mutate the account | most UI suites |
| API login + inject | HTTP login, put token/cookie into context | fastest; no UI dependency; fresh token per test or worker | must know the app's session mechanism; bypasses login UI | fastest | yes | apps with an auth API; ShopEasy-style storage sessions |
| Account per worker | worker fixture creates/selects an account | no cross-test interference on shared data | provisioning; cleanup; env must allow user creation | fast | **best** | tests that mutate user data (cart, addresses, orders) |
| Multiple roles | one storage file per role, projects or contexts | clear role separation; multi-actor tests | more setup; keep role files fresh | fast | yes | RBAC, admin/customer workflows |

**Recommendation for ShopEasy:** keep 3–5 UI tests for the login page; everything else starts authenticated through an **API login per worker** (fresh account via \`POST /api/users\`) with the session injected by \`addInitScript\`; role-specific projects when admin features exist. The trade-off is that the login UI is covered only by its own tests — acceptable because it is tested explicitly.

### Token expiry and refreshing state

ShopEasy tokens declare \`expiresIn: 3600\`. A setup project runs at the start of every \`npx playwright test\` run, so expiry only bites in runs longer than the token lifetime, in UI mode/watch sessions that reuse the file, or when someone skips the setup dependency. Options: store the expiry next to the state and re-login when close to it; use worker-scoped API login (each worker gets a fresh token); or, for long soak runs, a fixture that refreshes on 401:

\`\`\`ts
import { statSync } from 'node:fs';
const STATE = 'playwright/.auth/customer.json';
const isFresh = (file: string, maxAgeMs: number) => {
  try { return Date.now() - statSync(file).mtimeMs < maxAgeMs; } catch { return false; }
};
// in auth.setup.ts: if (isFresh(STATE, 50 * 60_000)) return;   // skip re-login locally when < 50 min old
\`\`\`

Symptom of an expired state: tests start failing with a redirect to the login page or 401s in the trace's network tab, all at roughly the same time in a long run.

### Security

- Add \`playwright/.auth/\` (and any \`*.har\`) to \`.gitignore\`; a storage file is a live session.
- Credentials from environment variables / CI secrets, never in the spec or config.
- Traces and HARs contain request headers and cookies — including \`Authorization\`. Be careful publishing CI artifacts from public repos; prefer test-only accounts with minimal rights and short-lived tokens.
- Never point these tests at production accounts.

## Selenium (Java) equivalents

\`\`\`java
// Cookies — you must be on the domain before addCookie works
driver.get("http://localhost:5180/practice-site/index.html");
driver.manage().addCookie(new Cookie.Builder("SESSION", token).path("/").isHttpOnly(true).build());
driver.manage().deleteCookieNamed("SESSION");

// Storage — via JavaScript
((JavascriptExecutor) driver).executeScript("sessionStorage.setItem('shopeasy.user', arguments[0])", "standard_user");

// Network mocking — Selenium 4 NetworkInterceptor (Chromium-based browsers, uses DevTools)
NetworkInterceptor interceptor = new NetworkInterceptor(driver,
    Route.matching(req -> req.getUri().contains("/api/products"))
         .to(() -> req -> new HttpResponse()
             .setStatus(500)
             .addHeader("Content-Type", "application/json")
             .setContent(Contents.utf8String("{\\"error\\":{\\"code\\":\\"INTERNAL_ERROR\\"}}"))));
\`\`\`

Differences to state in an interview: Selenium needs a page on the domain before adding cookies (Playwright adds them to the context before any navigation); there is no built-in storageState, so teams serialise cookies themselves; network interception relies on CDP (Chromium only) or the newer WebDriver BiDi network module, whose support varies by browser and binding version, while Playwright's routing works the same in Chromium, Firefox and WebKit.

## Common mistakes and debugging

- **Route never fires** — glob does not match the query string, or the request is served by a Service Worker or the cache. Debug: log \`page.on('request', r => console.log(r.url()))\`, switch to a predicate, set \`serviceWorkers: 'block'\`.
- **Mocked cross-origin response "Failed to fetch"** — missing \`Access-Control-Allow-Origin\` in \`fulfill\` headers.
- **Fixture routes ignored** — a later handler used \`continue()\` instead of \`fallback()\`.
- **Test hangs, then times out** — a handler path that never calls fulfill/continue/fallback/abort (e.g. an exception before \`fulfill\`). The trace shows the request pending.
- **"Logged in" storage state but the app shows guest** — the session is in sessionStorage or memory; inspect \`storageState()\` JSON and DevTools → Application.
- **Cookie added but not sent** — wrong domain/path, \`secure\` on http, or \`expires\` in milliseconds.

## Best practices for experienced engineers

- Layer routes: context-level policy in fixtures with \`fallback()\`, test-level overrides on top.
- Prefer predicates for API matching; type mock bodies with the same interfaces as API tests.
- Mock states, not journeys; keep an unmocked smoke tier and a contract check.
- Authenticate through the API, per worker, and inject the session the way the app stores it.
- Treat auth files, HARs and traces as secrets.

## Interview questions

### Q: What is the difference between \`route.continue()\` and \`route.fallback()\`?
**Short answer (30–60 s):** \`continue\` sends the request to the network immediately and skips other matching handlers; \`fallback\` passes it to the next matching handler, and only to the network if none is left. Handlers run newest first.

**Detailed answer:** Routing is a chain: last registered runs first, page routes before context routes. \`fallback\` (1.23+) lets you build layers — a fixture that blocks trackers and a test that overrides one endpoint — and can modify URL, headers or post data on the way down (matching still uses the original URL). \`continue\` is terminal, so using it in an override silently bypasses fixture policies. \`fulfill\` and \`abort\` are terminal too.

### Q: How would you test the UI with a slightly modified real API response?
**Short answer (30–60 s):** \`route.fetch()\` to get the real response, change the JSON, then \`route.fulfill({ response, json })\`.

**Detailed answer:** This keeps real status, headers (including CORS) and the rest of the data, so the test is close to reality while forcing one edge — a 0.01 price, a very long product name, an out-of-stock flag. It still depends on the backend being up, so it is not for offline suites. \`route.fetch\` runs from Node, has its own timeout (30 s default) and can change URL/headers.

\`\`\`ts
await page.route('**/api/products*', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  json.data[0].name = 'X'.repeat(200);
  await route.fulfill({ response, json });
});
\`\`\`

### Q: When would you use HAR replay instead of hand-written mocks?
**Short answer (30–60 s):** HAR for many realistic read-only responses I don't want to hand-write; hand-written mocks for explicit states like errors and empty lists.

**Detailed answer:** \`routeFromHAR\` with \`update: true\` records real traffic (written on context close; \`updateContent\`, \`updateMode\` since 1.32), then replays by strict URL + method (+ POST body) matching. It is fast and realistic but opaque in code review, brittle when queries contain timestamps, and may contain tokens. Mocks are explicit and good for edge cases but drift from the contract. Both need a real-backend tier and a contract check against schema.

### Q: What does storageState save, and what doesn't it?
**Short answer (30–60 s):** Cookies (including httpOnly) and localStorage per origin; IndexedDB optionally (1.51+). Not sessionStorage, not in-memory state.

**Detailed answer:** The JSON has \`cookies\` and \`origins[].localStorage\`. sessionStorage is tab-scoped, so ShopEasy — which keeps \`shopeasy.user\` and the cart there — loads as guest from a saved state. I inspect where the app keeps its session first, then either save sessionStorage separately and restore it with \`addInitScript\` (guarded by origin and by "not already set"), or inject the session via API login. Since 1.59 \`context.setStorageState()\` can replace state in an existing context.

### Q: How do you authenticate tests that run in parallel and mutate user data?
**Short answer (30–60 s):** One account per worker: a worker-scoped fixture that creates or selects an account by \`parallelIndex\`, logs in through the API, and gives each test that session.

**Detailed answer:** A single shared account means two workers edit one cart. \`parallelIndex\` (0…workers-1, reused after restarts) indexes a pre-provisioned pool; \`workerIndex\` is unique per process and grows after crashes, so it is wrong for pools but fine as part of a unique name. With a registration API (ShopEasy \`POST /api/users\`) I create a fresh user per worker per run, which also removes cleanup ordering issues. Tests stay \`fullyParallel\`-safe.

### Q: \`waitForResponse\` or \`page.on('response')\`?
**Short answer (30–60 s):** \`waitForResponse\` to synchronise on one specific call (created before the action); a listener for policies across a test, like failing on any 5xx.

**Detailed answer:** The Promise form is race-free if created first and gives you the \`Response\` to assert status, headers and \`request().postDataJSON()\`. Listeners see everything but you must remove them and must not use them with sleeps for synchronisation. An auto fixture that collects 5xx responses and asserts an empty list catches errors the UI swallows silently.

### Q: How do cookies differ between Playwright and Selenium?
**Short answer (30–60 s):** Playwright manages cookies on the context, before or without navigation, with filters for clearing; Selenium manages them on the current domain and you must navigate there first.

**Detailed answer:** \`context.addCookies\` takes \`url\` or \`domain\`+\`path\`, \`expires\` in seconds, \`httpOnly\`, \`secure\`, \`sameSite\`; \`clearCookies({ name, domain, path })\` filters since 1.43. Contexts isolate cookies per test automatically. In Selenium, \`driver.manage().addCookie\` applies to the current document's domain, and isolation requires a new driver session or explicit cleanup.

## Scenario-based questions

**1. After moving to a setup project, half the suite shows "guest" in the header.** I would open \`playwright/.auth/customer.json\`: no session cookie, only \`shopeasy.rememberedUser\`. The app keeps the user in sessionStorage, which storageState does not save. Fix options: save and restore sessionStorage (init script guarded by origin), or switch to API login + injection per worker. I'd add a setup assertion that fails fast if the loaded state does not produce a logged-in header.

**2. A team mocks every API call; production broke when \`total\` was renamed and the suite stayed green.** I would explain contract drift and propose: mock bodies typed from shared types or validated against \`/api/schema/product\`, an API test that validates real responses with the same schema, a nightly unmocked smoke tier for login → cart → checkout, and HAR re-recording on a schedule if they rely on HARs.

**3. CI runs got 40% faster after blocking images, but visual tests now fail.** The block fixture was auto for every test. Make it opt-in (or project-scoped), block only third-party hosts by default, and never in the visual project. Measure: blocking routes adds per-request IPC and disables the cache, so on some pages it is slower.

## Tricky follow-ups

- **Does \`page.route\` intercept requests from \`page.request\` / the \`request\` fixture?** No — those are made from Node, not the browser. Routing only sees browser traffic.
- **Can \`route.continue({ headers })\` set a Cookie header?** No; Cookie is a forbidden override and is ignored. Use \`context.addCookies\`.
- **Why might the glob \`'**/api/products'\` never fire?** The URL has a query string; use \`**/api/products*\`, a RegExp or a predicate.
- **Is \`expires: Date.now() + 3600_000\` correct?** No — Playwright expects Unix seconds.
- **Does \`clearCookies()\` log a ShopEasy practice user out?** No; the session is in sessionStorage. Clear that, or open a new context.`,
  keyPoints: [
    'Routing pauses matching browser requests until the handler fulfills, continues, falls back or aborts; newest handler first, page before context; continue is terminal, fallback chains.',
    'Match URLs with globs that include the query (**/api/products*), RegExps or URL predicates; times, unroute and unrouteAll({ behavior }) control lifetime; routing disables the HTTP cache and misses Service Worker traffic.',
    'route.fetch + fulfill({ response, json }) patches a real response; fabricated cross-origin responses need CORS headers.',
    'Hand-written mocks for states, HAR replay (strict URL+method+body matching) for wide read-only data, a real-backend tier and contract checks against drift.',
    'waitForResponse/waitForRequest created before the action for synchronisation; page.on listeners for test-wide policies; postDataJSON to assert what the UI sent.',
    'Cookies live on the context: addCookies needs url or domain+path and expires in seconds; clearCookies accepts name/domain/path filters (1.43+).',
    'storageState = cookies + localStorage (+ IndexedDB optionally); never sessionStorage — ShopEasy needs addInitScript or API-login injection.',
    'Prefer API login per worker (parallelIndex pool or fresh user), one storage file per role, and treat auth files, HARs and traces as secrets.',
  ],
  mistakes: [
    'Writing page.route("**/api/products", …) for a URL with a query string — the handler never runs and the real server answers. Fix: log page.on("request") URLs, then use "**/api/products*", a RegExp or a URL predicate.',
    'Using route.continue() in a test-level override, silently bypassing fixture-level routes (tracker blocking, auth header). Fix: use route.fallback() for anything that is not a deliberate final decision.',
    'Fulfilling a cross-origin API call without Access-Control-Allow-Origin, so the app shows a generic network error. Fix: add CORS headers to fabricated responses, or use route.fetch + fulfill({ response }).',
    'Assuming storageState captured the login. Fix: open the JSON and DevTools → Application; for sessionStorage sessions (ShopEasy) restore with a guarded addInitScript or inject via API login, and assert the logged-in header in setup.',
    'Sharing one account across parallel workers or picking pool accounts by workerIndex. Fix: worker-scoped fixture with parallelIndex for pools, or create a unique user per worker via POST /api/users.',
    'Committing playwright/.auth or HAR files, or uploading traces with live tokens from a public CI. Fix: .gitignore them, use short-lived test-only accounts, and keep secrets in CI variables.',
  ],
  tryIt: `Start the API (\`npm run api\`) and write \`tests/network-and-auth.spec.ts\`: (1) on \`http://localhost:5180/practice-site/inventory.html\`, use \`page.evaluate(fetch…)\` against \`http://localhost:5181/api/products\` and register two handlers — a context-level one that logs and calls \`fallback()\`, and a page-level one that fulfills a 503 with \`times: 1\` — then prove the order (page first) and that the second call reaches the real API; switch the page handler to \`continue()\` and observe the context handler no longer runs; (2) patch the cheapest product's price with \`route.fetch\` and check that CORS still works, then fabricate the same response with \`fulfill\` and no CORS header and explain the failure; (3) log in on \`login.html\` with *Remember me*, print \`context.storageState()\` and \`page.sessionStorage.items()\` (or \`page.evaluate(() => JSON.stringify(sessionStorage))\`) and explain why a context created from that state opens \`inventory.html\` as guest; (4) build a worker fixture that registers a unique customer via \`POST /api/users\`, logs in via \`POST /api/auth/login\`, injects \`shopeasy.user\` with \`addInitScript\`, and assert \`#logged-in-user\` shows that username.`,
  problems: ['pw-013', 'pw-029', 'pw-030', 'pw-037'],
}
