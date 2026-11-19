export default {
  slug: 'pw-dialogs-frames-tabs-network',
  category: 'playwright',
  order: 6,
  title: 'Beyond clicks: dialogs, frames, new tabs, network mocking and API tests',
  minutes: 10,
  summary: 'Handle browser dialogs as events, work inside iframes with frameLocator, catch new tabs, mock or wait for network calls with page.route and waitForResponse, and send API requests with the request fixture.',
  manualAnalogy: `Some test cases need more than "click and check": accepting a browser pop-up, typing inside an embedded chat widget, following a link that opens a new tab, or checking how the page behaves when the server is down. Manually you would ask a developer to break the server for you. In Playwright you can listen to the browser's events and even decide what the server answers.`,
  body: `## The pattern behind all of these: listen first, then act

Dialogs, new tabs, downloads and network responses are **events**. Playwright gives you a Promise for "the next time this happens". The order is always:

1. start listening (create the Promise or register the handler),
2. do the action that triggers the event,
3. await the Promise / let the handler run.

Swap 1 and 2 and the event may already be gone.

## Dialogs: alert, confirm, prompt

\`\`\`ts
// alerts.html — "Click for JS Confirm" asks "Do you want to empty your cart?"
page.once('dialog', async (dialog) => {
  console.log(dialog.type(), dialog.message());   // 'confirm', 'Do you want to empty your cart?'
  await dialog.dismiss();                          // or accept(), or accept('text') for a prompt
});
await page.getByRole('button', { name: 'Click for JS Confirm' }).click();
await expect(page.getByTestId('result')).toHaveText('You clicked: Cancel');
\`\`\`

- No \`switchTo().alert()\`: the handler runs when the dialog opens.
- If **no** handler is registered, Playwright auto-**dismisses** dialogs. A test can therefore pass "accidentally" with Cancel behaviour — always handle dialogs you expect.
- \`once\` handles one dialog; \`on\` handles all of them for the rest of the test.
- The *Delete saved address* modal on the same page is **HTML**, not a browser dialog: just use \`getByRole('dialog')\` / \`getByRole('button', { name: 'Yes, delete' })\`.

## Frames

\`\`\`ts
// frames.html → support widget iframe → nested live-chat iframe
const chat = page.frameLocator('#support-frame').frameLocator('#chat-frame');
await chat.getByPlaceholder('Type a message').fill('Where is my order?');
await chat.getByRole('button', { name: 'Send' }).click();
\`\`\`

\`frameLocator(selector)\` returns a scope: every locator chained on it searches inside that frame. Nested frames chain. The main page stays usable at the same time — there is no "switch back to default content". (\`page.locator('iframe').contentFrame()\` is the newer equivalent.)

## New tabs and pop-ups

A tab is just another \`Page\` in the same \`BrowserContext\`.

\`\`\`ts
// windows.html — "Open chat pop-up" calls window.open
const popupPromise = page.waitForEvent('popup');
await page.getByRole('button', { name: 'Open chat pop-up' }).click();
const popup = await popupPromise;
await popup.waitForLoadState();
await expect(popup).toHaveURL(/mode=popup/);
\`\`\`

- \`page.waitForEvent('popup')\` — pages opened **by this page** (window.open, target=_blank).
- \`context.waitForEvent('page')\` — **any** new page in the context.
- \`context.pages()\` lists all open pages, e.g. after *Open terms + privacy* opens two tabs at once.
- Close extra pages when done: \`await popup.close()\`.

## Network: mock it with page.route

\`page.route(urlPattern, handler)\` intercepts matching requests **from now on**:

\`\`\`ts
// Fake a slow / failing / empty backend
await page.route('**/api/products', (route) => route.fulfill({ status: 503, json: { message: 'Maintenance' } }));
await page.route('**/*.{png,jpg}', (route) => route.abort());          // block images for speed
await page.route('**/api/cart', async (route) => {
  const response = await route.fetch();                                 // call the real server…
  const json = await response.json();
  json.items = [];                                                      // …and change the answer
  await route.fulfill({ response, json });
});
\`\`\`

- \`fulfill\` answers without the server; \`continue\` lets it through (optionally modified); \`abort\` simulates a network error; \`fetch\` gets the real response so you can patch it.
- Register routes **before** the request happens — before \`goto\` for calls made on page load.
- Use mocking for states that are hard to create (empty lists, 500s, timeouts) — keep some tests unmocked so you still test the real integration.

## Network: wait for it with waitForResponse

When an assertion depends on data loaded by a click, wait for the response — the "listen first" pattern again:

\`\`\`ts
const saved = page.waitForResponse((r) => r.url().includes('/api/profile') && r.request().method() === 'PUT');
await page.getByRole('button', { name: 'Save' }).click();
const response = await saved;
expect(response.status()).toBe(200);
\`\`\`

\`waitForRequest\` works the same for outgoing requests — useful to assert what the UI **sent** (\`request.postDataJSON()\`).

## API testing with the request fixture

\`@playwright/test\` also sends HTTP requests without a browser:

\`\`\`ts
test('health endpoint is up', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status: string };
  expect(body.status).toBe('UP');
});
\`\`\`

The \`request\` fixture uses \`baseURL\` and headers from the config. Typical uses: create test data before a UI test (faster than clicking through forms), clean up after, and quick contract checks in the same report as your UI tests. Type JSON bodies with an interface (see the TypeScript lesson) so a renamed field fails loudly.`,
  keyPoints: [
    'Events (dialog, popup/page, response, download) follow listen first → act → await.',
    'Without a handler Playwright auto-dismisses dialogs; use page.once("dialog", …) before the click.',
    'frameLocator scopes locators into an iframe; nested frames chain; no switching back.',
    'page.route can fulfill, abort, continue or patch requests — register it before the request happens.',
    'The request fixture tests APIs and seeds data without a browser, sharing config with UI tests.',
  ],
  mistakes: [
    'Awaiting waitForEvent/waitForResponse before clicking — it waits forever because the click never happens.',
    'Treating an HTML modal as a browser dialog (or vice versa) — check whether it is in the DOM.',
    'Registering page.route after page.goto — the request already reached the real server.',
    'Mocking everything — then the suite only proves that the mocks work.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/frames.html\` open DevTools and use the frame dropdown at the top of the Console (top / supportFrame / chatFrame). Type \`document.title\` in each. That is exactly the scoping \`frameLocator\` gives you — without changing any global state.`,
  problems: ['pw-011', 'pw-012', 'pw-013', 'pw-037'],
}
