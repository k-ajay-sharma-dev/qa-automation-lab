export default {
  id: 'pw-011',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Dialogs, iframes and new tabs without switchTo()',
  level: 'INTERMEDIATE',
  tags: ['dialogs', 'frameLocator', 'new-tab', 'events'],
  estMinutes: 30,
  scenario: `The Selenium suite had a 200-line \`WindowUtils\` class full of \`switchTo().alert()\`, \`switchTo().frame()\`, window-handle loops and
\`switchTo().defaultContent()\`. Half of the flaky tests lived there. In Playwright none of that exists — dialogs are **events**, frames are
**scoped locators**, and new tabs are **Page objects**. Port the three ShopEasy checks.`,
  description: `Write three tests.

1. **alerts.html** — click *Click for JS Prompt*, check the dialog is a \`prompt\` with message \`Enter your coupon code\`, accept it with
   \`BRIGHT25\`, then the result (\`data-testid="result"\`) reads \`You entered: BRIGHT25\`.
2. **frames.html** — the support widget is inside \`<iframe id="support-frame">\`. Fill *Your name* with \`Asha\`, click *Send*, and expect the
   frame's \`data-testid="support-result"\` to contain \`Thanks Asha, ticket T-\`; the **parent** page's \`data-testid="frame-message"\` then contains \`created\`.
3. **windows.html** — the link *Open size guide in new tab* opens a new tab. Catch it with \`context.waitForEvent('page')\` started **before** the
   click, and assert the heading **Size guide** is visible in the new tab.

**Rules**: register the dialog handler **before** the click; use \`frameLocator\`; no \`waitForTimeout\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('prompt accepts a coupon code', async ({ page }) => {
  await page.goto('alerts.html');
  await page.getByRole('button', { name: 'Click for JS Prompt' }).click();
  // TODO: how do I "switch to" the alert?
  await expect(page.getByTestId('result')).toHaveText('You entered: BRIGHT25');
});

test('support form inside the iframe', async ({ page }) => {
  await page.goto('frames.html');
  await page.getByLabel('Your name').fill('Asha'); // fails: the field is inside an iframe
  await page.getByRole('button', { name: 'Send' }).click();
});

test('size guide opens in a new tab', async ({ page }) => {
  await page.goto('windows.html');
  await page.getByRole('link', { name: 'Open size guide in new tab' }).click();
  await page.waitForTimeout(2000);
  // TODO: find the new tab
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('prompt accepts a coupon code', async ({ page }) => {
  await page.goto('alerts.html');

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.message()).toBe('Enter your coupon code');
    await dialog.accept('BRIGHT25');
  });
  await page.getByRole('button', { name: 'Click for JS Prompt' }).click();

  await expect(page.getByTestId('result')).toHaveText('You entered: BRIGHT25');
});

test('support form inside the iframe', async ({ page }) => {
  await page.goto('frames.html');

  const support = page.frameLocator('#support-frame');
  await support.getByLabel('Your name').fill('Asha');
  await support.getByRole('button', { name: 'Send' }).click();

  await expect(support.getByTestId('support-result')).toContainText('Thanks Asha, ticket T-');
  await expect(page.getByTestId('frame-message')).toContainText('created');
});

test('size guide opens in a new tab', async ({ page, context }) => {
  await page.goto('windows.html');

  const newTabPromise = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Open size guide in new tab' }).click();
  const sizeGuide = await newTabPromise;

  await sizeGuide.waitForLoadState();
  await expect(sizeGuide.getByRole('heading', { name: 'Size guide' })).toBeVisible();
  await sizeGuide.close();
});
`,
  checks: [
    { label: 'Dialog handled through an event listener', pattern: "page\\.(once|on)\\(\\s*['\"]dialog['\"]", hint: "page.once('dialog', async (dialog) => { ... })" },
    { label: 'Prompt accepted with a value', pattern: "dialog\\.accept\\(\\s*['\"]BRIGHT25['\"]\\s*\\)", hint: "await dialog.accept('BRIGHT25');" },
    { label: 'Iframe scoped with frameLocator', pattern: 'frameLocator\\(', hint: "const support = page.frameLocator('#support-frame');" },
    { label: 'New tab caught with waitForEvent("page")', pattern: "waitForEvent\\(\\s*['\"]page['\"]\\s*\\)", hint: "const newTabPromise = context.waitForEvent('page');" },
    { label: 'Listener set up before the click (promise awaited after)', pattern: "waitForEvent\\(\\s*['\"]page['\"]\\s*\\)[\\s\\S]*\\.click\\([\\s\\S]*await\\s+\\w+Promise", hint: 'Start waiting, then click, then await the promise.' },
    { label: 'No waitForTimeout', pattern: 'waitForTimeout', mustNot: true, hint: 'Events and web-first assertions replace pauses.' },
  ],
  hints: [
    'If no dialog listener exists, Playwright auto-dismisses dialogs — so the prompt is cancelled before you can "switch" to it.',
    'frameLocator(selector) returns a locator-like object; everything you chain on it searches inside that iframe.',
    'Promise first, action second, await third — otherwise the new tab may open before you start listening.',
  ],
  explanation: `**Dialogs** (\`alert\`, \`confirm\`, \`prompt\`, \`beforeunload\`) are emitted as a \`dialog\` event. Register the handler **before** the
action that triggers it; \`once\` removes it after the first dialog so it cannot interfere with later ones. Without any handler Playwright
dismisses dialogs automatically — so \`confirm()\` returns false silently.

**Frames**: \`page.frameLocator('#support-frame')\` scopes all following locators to that iframe — no switching in and back out. Nested
frames chain: \`page.frameLocator('#support-frame').frameLocator('#chat-frame')\`. (Newer versions also offer \`locator('#support-frame').contentFrame()\`.)

**New tabs / popups**: a tab is just another \`Page\` in the same \`BrowserContext\`. \`context.waitForEvent('page')\` (or \`page.waitForEvent('popup')\`
for \`window.open\` from this page) returns a Promise that resolves with the new Page. Start waiting **before** clicking, then await —
the "promise first" pattern you will also use for \`waitForResponse\` and downloads.`,
  mistakes: [
    'Registering page.on("dialog") after the click — the dialog has already been auto-dismissed.',
    'Using page.on instead of page.once for a single dialog — the handler keeps accepting every later dialog in the test too.',
    'Writing await context.waitForEvent("page") before the click — it waits forever because the click never happens.',
    'Searching iframe content with page.getBy… — the main page cannot see inside the frame.',
  ],
  interview: [
    { q: 'How do you handle a JavaScript confirm in Playwright?', a: "page.once('dialog', d => d.accept()) or d.dismiss() before the click that triggers it, then assert the page's reaction. Playwright dismisses dialogs by default if no listener is registered." },
    { q: 'How do you work with iframes?', a: 'Use page.frameLocator(selector) and chain locators on it; nested frames chain frameLocator calls. No switchTo/defaultContent — the main page locators keep working at the same time.' },
    { q: 'How do you handle a new tab?', a: "Start const p = context.waitForEvent('page') (or page.waitForEvent('popup')), click the trigger, then const newPage = await p. Interact with newPage like any page and close it when done." },
  ],
}
