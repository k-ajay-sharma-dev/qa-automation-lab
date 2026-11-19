export default {
  slug: 'pw-auth-state-and-api-testing',
  category: 'playwright',
  order: 9,
  title: 'Log in once and test the API: storageState, setup projects and APIRequestContext',
  minutes: 10,
  summary: 'Reuse a logged-in state across tests with a setup project, and use Playwright request contexts to call the ShopEasy API for test data, oracles and API tests.',
  manualAnalogy: `Before a regression day you do not log in from scratch for every test case — you log in once and keep the browser session. And when a test needs a customer with an order, you ask a developer to create one in the database rather than click through ten screens. Playwright gives you both: a saved login state, and an HTTP client that talks to the API directly.`,
  body: `## Why logging in once matters

A UI login takes 2–3 seconds. With 200 tests that is ten minutes of typing \`standard_user\` per run — and every one of those logins is a
chance to fail for a reason that has nothing to do with the test. Keep a few tests for the login page itself; everything else should
**start** logged in.

## storageState and setup projects

\`storageState\` is a JSON snapshot of a context's **cookies and localStorage** (per origin):

\`\`\`ts
await page.context().storageState({ path: 'playwright/.auth/admin.json' });   // save
\`\`\`

\`\`\`ts
// playwright.config.ts — load it into every new context of a project
projects: [
  { name: 'setup', testMatch: /.*\\.setup\\.ts/ },
  { name: 'admin', use: { storageState: 'playwright/.auth/admin.json' }, dependencies: ['setup'] },
],
\`\`\`

- The **setup project** is an ordinary test file that logs in and saves the file. Because it is a test, a failed login has a trace and
  appears in the report — unlike the older \`globalSetup\` script.
- \`dependencies: ['setup']\` means "run setup first, once per run, and only start these tests if it passed".
- A test that must start **logged out** overrides it: \`test.use({ storageState: { cookies: [], origins: [] } })\`.
- Add \`playwright/.auth\` to \`.gitignore\` — the file contains a live session.

**Know where your app keeps its session.** \`storageState\` does **not** include \`sessionStorage\` (it belongs to one tab). ShopEasy stores
the logged-in user in \`sessionStorage\` and only the "Remember me" username in \`localStorage\`. For such apps, save
\`JSON.stringify(sessionStorage)\` yourself and put it back with \`context.addInitScript(...)\`, which runs before the page's own scripts on
every navigation. Open DevTools → Application → Storage on the logged-in shop and look before you design the setup.

## APIRequestContext: an HTTP client inside Playwright

\`@playwright/test\` can send HTTP requests without a browser. You get one in three ways:

| How | Use it for |
|---|---|
| the \`request\` fixture | quick calls using the config's \`baseURL\` / headers; disposed for you |
| \`playwright.request.newContext({ baseURL, extraHTTPHeaders })\` | your own client, e.g. for another host (the API on 5181) or with a token |
| \`page.request\` | calls that share the browser context's cookies |

\`\`\`ts
const api = await playwright.request.newContext({ baseURL: 'http://localhost:5181' });
const res = await api.get('/api/products', { params: { q: 'tee', sort: 'price_desc' } });
expect(res.status()).toBe(200);
const body = (await res.json()) as { data: { name: string; price: number }[]; total: number };
await api.dispose();
\`\`\`

- \`get/post/put/patch/delete(url, { params, data, headers, multipart })\` — \`data\` is sent as JSON, \`params\` are URL-encoded for you.
- \`res.status()\`, \`res.ok()\`, \`res.headers()\` (lower-case names), \`await res.json()\`.
- Type the body with an interface — but remember a cast is not validation; assert the fields that matter.

## Three jobs for API calls in a UI suite

1. **Test data setup** — create the customer, cart or order through the API, then test only the screen you care about.
2. **Oracle** — fetch the expected values from the system of record and compare the UI with them, instead of hard-coding a list.
3. **API tests** — contract and business-rule checks (status codes, error codes, totals) in the same runner, report and CI job.

## Isolation: each test owns its data

A shared backend is shared by all parallel workers. Never reset it from a test, and do not let parallel tests share one account's cart.
Create what the test needs with a **unique** identifier (\`Date.now()\`, \`testInfo.workerIndex\`, a UUID) — the ShopEasy API lets you
register a new customer with \`POST /api/users\` for exactly this reason. Wrap that in a fixture, and tests simply ask for an \`api\`
already logged in as their own customer.

## Known bugs as executable notes

When the oracle reveals a real bug that will not be fixed this sprint, keep the test and mark it \`test.fail(true, 'TICKET-123: …')\`:
it runs, is expected to fail, and turns the build red the day it starts passing — your reminder to remove the annotation.`,
  keyPoints: [
    'Log in once in a setup project; load the saved storageState in dependent projects.',
    'storageState = cookies + localStorage; sessionStorage must be saved and restored yourself (addInitScript).',
    'request fixture for simple calls; playwright.request.newContext for another host or an authenticated client — dispose it.',
    'Use the API for data setup, as an oracle for UI checks, and for API tests in the same suite.',
    'Parallel tests must own their data: unique customers, no shared resets.',
  ],
  mistakes: [
    'Assuming storageState covers every kind of session — check where the app stores it first.',
    'Calling a reset endpoint from tests that run in parallel.',
    'Hard-coding expected data that the API could provide.',
    'Forgetting dispose() on contexts you created with newContext.',
  ],
  tryIt: `Start the API (\`npm run api\`) and open \`http://localhost:5181/api/products?sort=price_asc&size=50\` in the browser. Then open \`http://localhost:5180/practice-site/inventory.html\`, sort by *Price (low to high)* and compare the order. Which fields could a test use as the oracle, and which product's API data hints at a bug in the shop?`,
  problems: ['pw-027', 'pw-029', 'pw-030'],
}
