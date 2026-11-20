export default {
  slug: 'pw-deep-browser-interactions',
  category: 'playwright',
  order: 15,
  title: 'Deep dive: frames, tabs, dialogs, dropdowns, mouse, keyboard, uploads, downloads and media',
  minutes: 30,
  summary: 'Explain how Playwright models frames, pages, dialogs, file choosers and downloads underneath the API, choose between the competing ways of driving each one (frameLocator vs Frame, popup vs context page events, setInputFiles vs filechooser, screenshot vs video vs trace), and defend those choices against the Selenium switchTo() model.',
  manualAnalogy: `When you test a checkout by hand you constantly cross boundaries without thinking: the card form lives in the payment provider's iframe, "Sign in with Google" opens a pop-up, "Empty cart?" is a browser confirm, the licence upload opens the OS file picker, and "Export orders" drops a CSV into Downloads that you open in Excel to check the totals. Each of those boundaries is a separate object or event in the browser, and automation is flaky exactly where a tester forgets which side of the boundary they are on.`,
  body: `## Where the earlier lessons stop

The *Locators and actions* lesson showed \`hover\`, \`dragTo\`, \`selectOption\` and \`setInputFiles\` as one-liners; the *Beyond clicks* lesson introduced dialogs, \`frameLocator\` and pop-ups with the "listen first, then act" rule. This lesson goes underneath: what object Playwright gives you for each boundary, what it does when you **don't** handle an event, which of the competing APIs to pick, and where the traps are when the suite runs headless in CI on three browsers.

One mental model covers the whole lesson:

| Boundary | Playwright object | Lives in | Selenium (Java) model |
|---|---|---|---|
| iframe | \`Frame\` (live) / \`FrameLocator\` (lazy) | a \`Page\` (frame tree) | \`driver.switchTo().frame(...)\` changes global focus |
| tab / window / pop-up | \`Page\` | a \`BrowserContext\` | window handle + \`switchTo().window(handle)\` |
| alert / confirm / prompt / beforeunload | \`Dialog\` (event payload) | a \`Page\` (and context) | \`switchTo().alert()\` |
| OS file picker | \`FileChooser\` (event payload) | a \`Page\` | \`sendKeys(path)\` on the input |
| download | \`Download\` (event payload) | a \`Page\`, file stored per context | browser prefs + polling the download folder |

There is no global "current window" or "current frame" in Playwright. Every object is addressed explicitly, which is why parallel tests and multi-tab flows do not trip over each other.

## Frames

### How it works internally

Every \`Page\` owns a **frame tree**: \`page.mainFrame()\` plus one \`Frame\` per \`<iframe>\`, each with \`childFrames()\` and \`parentFrame()\`. A \`Frame\` is a live handle to one browsing context. When the iframe navigates, the same \`Frame\` object follows it; when the iframe element is removed, the frame **detaches** and further calls throw *"Frame was detached"*.

A \`FrameLocator\` is different: like a \`Locator\` it is a lazy selector chain. \`page.frameLocator('#support-frame').getByLabel('Your name')\` serialises to something like \`#support-frame >> internal:control=enter-frame >> internal:label="Your name"i\`. It is resolved on every action, inherits auto-waiting (it waits for the iframe to exist and load its content) and is strict (two matching iframes is a strict mode violation). \`locator.contentFrame()\` (Playwright 1.43+) turns a \`Locator\` that points at an \`<iframe>\` into a \`FrameLocator\`, and \`frameLocator.owner()\` (1.43+) goes back to the \`<iframe>\` element as a \`Locator\` — useful for asserting the iframe's own attributes or visibility.

**Cross-origin frames.** Chromium runs cross-site iframes out of process (site isolation); Firefox and WebKit have their own models. Playwright attaches to those targets itself, so the same \`frameLocator\` code works for a same-origin widget and a cross-origin payment iframe — no CORS-style "you can't touch that" error as you would get from \`iframe.contentDocument\` in page JavaScript. What you cannot do is \`page.evaluate\` in the parent and reach into a cross-origin child; evaluate in the \`Frame\` instead (\`frame.evaluate\`).

### Syntax

| API | Returns | Lazy? | Use it for |
|---|---|---|---|
| \`page.frameLocator(selector)\` | \`FrameLocator\` | yes | interacting with elements inside a frame (default choice) |
| \`page.locator('iframe[title="Contact support"]').contentFrame()\` | \`FrameLocator\` | yes | when you already have a locator for the iframe (e.g. \`getByTitle\`) |
| \`frameLocator.owner()\` | \`Locator\` for the iframe element | yes | asserting on the \`<iframe>\` itself |
| \`page.frame('supportFrame')\` / \`page.frame({ url: /frame-content/ })\` | \`Frame \\| null\` | **no** — a snapshot lookup | frame-level operations: \`frame.url()\`, \`frame.evaluate\`, \`frame.waitForURL\`, listening to \`framenavigated\` |
| \`page.frames()\`, \`frame.childFrames()\` | \`Frame[]\` | no | debugging, iterating unknown ad/analytics frames |

Note the ShopEasy trap: \`frames.html\` has \`<iframe id="support-frame" name="supportFrame">\`. \`page.frame('support-frame')\` returns **null** because \`page.frame(string)\` matches the frame **name**, not the id. \`frameLocator('#support-frame')\` takes a CSS selector, so the id works there.

### Complete example: nested frames and a message back to the parent

\`\`\`ts
// tests/support-widget.spec.ts
import { test, expect, type FrameLocator } from '@playwright/test';

test.describe('Support widget (frames.html)', () => {
  let support: FrameLocator;

  test.beforeEach(async ({ page }) => {
    await page.goto('/practice-site/frames.html');
    support = page.getByTitle('Contact support').contentFrame();   // 1
  });

  test('ticket created in the iframe is reported to the parent page', async ({ page }) => {
    await support.getByLabel('Your name').fill('Asha Rao');          // 2
    await support.getByLabel('Topic').selectOption({ label: 'Refund' });
    await support.getByRole('button', { name: 'Send' }).click();

    await expect(support.getByTestId('support-result'))
      .toHaveText(/^Thanks Asha Rao, ticket T-\\d{4} created$/);     // 3
    await expect(page.getByTestId('frame-message'))
      .toHaveText(/^Ticket T-\\d{4} created$/);                       // 4
  });

  test('live chat in the nested iframe', async ({ page }) => {
    const chat = support.frameLocator('#chat-frame');                // 5
    await chat.getByPlaceholder('Type a message').fill('Where is ORD-1043?');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.locator('.chat-line').last()).toHaveText('You: Where is ORD-1043?');

    const chatFrame = page.frame({ url: /nested-frame\\.html/ });     // 6
    expect(chatFrame?.parentFrame()?.name()).toBe('supportFrame');
  });
});
\`\`\`

1. \`getByTitle\` uses the iframe's accessible \`title\` (good for accessibility too); \`contentFrame()\` enters it. Created once, re-resolved on every action.
2. Note there is a *Send* button in **both** the support form and the nested chat frame. Because the scope is the frame, there is no strict-mode clash.
3–4. The iframe posts a message to the parent; the parent and the frame are asserted in the same test with no switching back. This is the cross-boundary assertion that is painful in Selenium (switch in, read, switch to default content, read).
5. Nested frames are just chained.
6. \`page.frame()\` returns a snapshot — fine here because the page is loaded; for frame-tree checks right after \`goto\`, prefer a web-first assertion on content first.

### Approaches compared

| | \`frameLocator\` / \`contentFrame()\` | \`page.frame()\` → \`Frame\` | Selenium \`switchTo().frame()\` |
|---|---|---|---|
| How it works | lazy selector chain re-resolved each action | live handle looked up once | changes the driver's global focus |
| Waiting | auto-waits for iframe + element | none at lookup (may return null) | \`frameToBeAvailableAndSwitchToIt\` |
| Survives iframe reload | yes | yes (same frame navigates); no if the iframe element is replaced | stale, must switch again |
| Parallel/multi-frame in one test | trivial | trivial | must switch back and forth; easy to forget \`defaultContent()\` |
| Maintainability | best — fits page objects | OK for frame-level APIs | error-prone global state |
| When to use | **all element interaction** | \`url()\`, \`evaluate\`, navigation events | Selenium suites |

**Recommendation:** expose a \`FrameLocator\` from the page object (\`readonly support = this.page.getByTitle('Contact support').contentFrame()\`) and treat it like any other container. Reach for \`Frame\` only for frame-level operations.

\`\`\`java
// Selenium 4 (Java) equivalent of the first test
driver.switchTo().frame("supportFrame");                        // by name/id, index or WebElement
driver.findElement(By.id("support-name")).sendKeys("Asha Rao");
driver.findElement(By.id("support-submit")).click();
String inFrame = driver.findElement(By.id("support-result")).getText();
driver.switchTo().defaultContent();                             // forget this and the next line fails
String parent = driver.findElement(By.id("frame-message")).getText();
\`\`\`

## Tabs and pop-ups

### How it works internally

A new tab is a new \`Page\` in the **same** \`BrowserContext\` (same cookies and storage). Two events announce it:

- \`page.on('popup')\` fires on the **opener** for pages it opened (\`window.open\`, \`target=_blank\`). The popup is delivered once it has started its initial navigation, so \`popup.url()\` is already the target URL; call \`await popup.waitForLoadState()\` before reading its DOM if you do not use web-first assertions.
- \`context.on('page')\` fires for **every** new page in the context, whoever opened it — including one opened by another popup, or by \`context.newPage()\`.

Two consequences seniors are asked about: \`page.route()\` does **not** intercept the first request of a popup (the route belongs to the opener page) — use \`context.route()\` when you need to mock what the popup loads. And \`page.waitForEvent(...)\` throws if the page closes first, which is exactly what an OAuth popup does at the end.

| API | Scope | Typical use |
|---|---|---|
| \`page.waitForEvent('popup')\` | pages opened by this page | "Open size guide in new tab", chat pop-up |
| \`context.waitForEvent('page', predicate?)\` | any new page | page opened indirectly, several pages at once |
| \`context.pages()\` | snapshot of open pages | assertions on tab count, cleanup |
| \`popup.opener()\` | the opener \`Page \\| null\` | checking \`rel="noopener"\` behaviour |
| \`page.bringToFront()\` | focus | apps that react to \`visibilitychange\` / focus |
| \`popup.waitForEvent('close')\` | popup lifecycle | OAuth-style popups that close themselves |

### Complete example: picking the right tab and closing it

\`\`\`ts
// tests/windows.spec.ts
import { test, expect } from '@playwright/test';

test('terms and privacy open in two tabs; each is identified by URL, not order', async ({ page, context }) => {
  await page.goto('/practice-site/windows.html');

  const termsPromise = context.waitForEvent('page', (p) => p.url().includes('page=terms'));     // 1
  const privacyPromise = context.waitForEvent('page', (p) => p.url().includes('page=privacy'));
  await page.getByRole('button', { name: 'Open terms + privacy' }).click();
  const [terms, privacy] = await Promise.all([termsPromise, privacyPromise]);                    // 2

  await expect(terms).toHaveTitle('ShopEasy — Terms of Service');
  await expect(privacy.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  expect(context.pages()).toHaveLength(3);

  await privacy.close();                                                                         // 3
  await terms.close();
  await expect(page.getByRole('heading', { name: 'Windows & tabs' })).toBeVisible();             // 4
});

test('chat pop-up', async ({ page }) => {
  await page.goto('/practice-site/windows.html');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open chat pop-up' }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL(/mode=popup/);
  await expect(popup.locator('#new-window-text')).toHaveText('Agent Maya will be with you shortly.');
  await expect(page.locator('#popup-status')).toHaveText('Pop-up opened');

  const closed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Close this window' }).click();                       // window.close()
  await closed;
});
\`\`\`

1. Two predicate-based waits, both registered **before** the click. Order of \`window.open\` calls is not a contract; URLs are.
2. \`Promise.all\` on the two promises (not on the click) — the click was already awaited.
3. Closing is optional (the context closes after the test) but keeps \`context.pages()\` assertions honest in long tests.
4. "Returning" to the original tab is just using the \`page\` variable again.

### OAuth-style pop-ups

A "Sign in with Google" button opens the identity provider in a popup; after consent the popup redirects back, posts a message or sets a cookie, and **closes itself**. Senior guidance:

- Do not automate a real third-party login page in regression: it changes without notice, has bot protection, and is not your system under test. Use a test IdP, a stubbed provider in a test environment, or skip the UI and inject the session (see the *network, cookies and sessions* deep dive).
- If you must drive it (e.g. against your own SSO in staging): create \`page.waitForEvent('popup')\` before the click, complete the form in the popup, then await \`popup.waitForEvent('close')\` and assert the opener's logged-in state. Never call \`popup.waitForLoadState()\` after it may have closed.

\`\`\`java
// Selenium (Java): handles are opaque strings; you loop and switch
String original = driver.getWindowHandle();
driver.findElement(By.id("open-two-btn")).click();
new WebDriverWait(driver, Duration.ofSeconds(5)).until(numberOfWindowsToBe(3));
for (String h : driver.getWindowHandles()) {
  driver.switchTo().window(h);
  if (driver.getTitle().contains("Terms")) break;
}
// ... assertions ...
driver.close();
driver.switchTo().window(original);   // otherwise NoSuchWindowException on the next call
\`\`\`

## Dialogs

### How it works internally

\`alert\`, \`confirm\`, \`prompt\` and \`beforeunload\` are modal: the page's JavaScript is blocked until the dialog is closed. Playwright receives a protocol event when the dialog opens and emits \`dialog\` on the page (and, since 1.34, on the context). Then:

- **No listener** on the page or context → Playwright **auto-dismisses** the dialog. \`alert\` just closes, \`confirm\` returns \`false\`, \`prompt\` returns \`null\`. The test continues — which is how a test of *"Empty cart → OK"* can pass while actually exercising Cancel.
- **A listener exists** → it **must** call \`accept()\` or \`dismiss()\`. A listener that only logs leaves the page frozen and the triggering \`click()\` hangs until timeout.

| Dialog API | Notes |
|---|---|
| \`dialog.type()\` | \`'alert' \\| 'confirm' \\| 'prompt' \\| 'beforeunload'\` |
| \`dialog.message()\`, \`dialog.defaultValue()\` | message text; prompt's default |
| \`dialog.accept(promptText?)\` | the text is only used for prompts |
| \`dialog.dismiss()\` | Cancel |
| \`page.once('dialog', h)\` vs \`page.on('dialog', h)\` | one dialog vs every dialog until \`page.off\` |
| \`page.waitForEvent('dialog')\` | returns the \`Dialog\`; you still accept/dismiss it |
| \`page.close({ runBeforeUnload: true })\` | runs \`beforeunload\`; does **not** wait for the page to close; handle the resulting dialog |

### Complete example: confirm, prompt and a delayed alert

\`\`\`ts
// tests/alerts.spec.ts
import { test, expect, type Dialog } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/practice-site/alerts.html'); });

test('confirm: OK empties the cart', async ({ page }) => {
  let seen: { type: string; message: string } | undefined;
  page.once('dialog', async (dialog) => {
    seen = { type: dialog.type(), message: dialog.message() };   // 1 record, do not assert here
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Click for JS Confirm' }).click();
  expect(seen).toEqual({ type: 'confirm', message: 'Do you want to empty your cart?' });
  await expect(page.getByTestId('result')).toHaveText('You clicked: Ok');
});

test('prompt: accept with a coupon code', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept('SAVE10'));       // 2
  await page.getByRole('button', { name: 'Click for JS Prompt' }).click();
  await expect(page.getByTestId('result')).toHaveText('You entered: SAVE10');
});

test('delayed alert: wait for the event, not for 3 seconds', async ({ page }) => {
  const dialogPromise = page.waitForEvent('dialog');              // 3
  await page.getByRole('button', { name: 'Alert after 3 seconds' }).click();
  const dialog: Dialog = await dialogPromise;
  expect(dialog.message()).toBe('Your session will expire in 5 minutes');
  await dialog.accept();
  await expect(page.getByTestId('result')).toHaveText('Delayed alert accepted');
});
\`\`\`

1. An \`expect\` that throws inside an event handler does not fail the step you are looking at; it surfaces as an unhandled error, sometimes after the dialog has frozen the page. Record in the handler, assert in the test body.
2. The handler can return the promise; \`accept\` with text only matters for \`prompt\`.
3. \`waitForEvent('dialog')\` reads naturally for one-off dialogs and gives you the \`Dialog\` as a value. The click resolves immediately here because the alert opens 3 s later — no \`waitForTimeout\`.

**\`once\` vs \`on\`.** \`once\` is right for "this click opens one dialog". \`on\` is right for a fixture-level policy. A strong senior pattern is a fixture that **fails the test on unexpected dialogs** instead of silently dismissing them:

\`\`\`ts
// fixtures.ts — any dialog a test did not plan for is a bug report, not noise
// (simplified: it defers to any other dialog listener the test registered, e.g. page.once or waitForEvent)
import { test as base } from '@playwright/test';

export const test = base.extend<{ failOnUnexpectedDialog: void }>({
  failOnUnexpectedDialog: [async ({ page }, use) => {
    const unexpected: string[] = [];
    page.on('dialog', async (d) => {
      if (page.listenerCount('dialog') === 1) {           // only this policy listener is attached
        unexpected.push(\`\${d.type()}: \${d.message()}\`);
        await d.dismiss();
      }
    });
    await use();
    if (unexpected.length) throw new Error(\`Unexpected dialogs: \${unexpected.join(' | ')}\`);
  }, { auto: true }],
});
\`\`\`

**HTML modals are not dialogs.** The *Delete saved address* modal on \`alerts.html\` is a \`div[role=dialog]\` in the DOM: \`page.getByRole('dialog', { name: 'Delete address?' })\` and normal clicks. No event fires.

**\`beforeunload\`.** An "unsaved changes" guard on checkout is a \`beforeunload\` dialog. To test it, close with \`page.close({ runBeforeUnload: true })\` and handle the \`dialog\` with \`type() === 'beforeunload'\`; accepting lets the page close, dismissing keeps it open. Without \`runBeforeUnload\`, \`page.close()\` skips the handler entirely, so your guard is never exercised.

## Dropdowns

### Native \`<select>\`: selectOption

\`selectOption\` runs actionability checks, **waits until all requested options exist** (so options loaded by Ajax are handled), selects them, fires \`input\` and \`change\`, and returns the array of selected values. A plain string matches an option's **value or label**; an object \`{ value }\`, \`{ label }\` or \`{ index }\` is precise. On a \`multiple\` select all matching options are selected; otherwise only the first match.

\`\`\`ts
// form.html
const country = page.getByLabel('Country *');
await country.selectOption('GB');                         // value
await country.selectOption({ label: 'Germany' });         // label — reads like the test case
await country.selectOption({ index: 1 });                 // India — position, fragile
await expect(country).toHaveValue('IN');

const channels = page.getByLabel(/Sales channels/);
const selected = await channels.selectOption(['web', { label: 'Marketplaces' }]);
expect(selected).toEqual(['web', 'marketplace']);
await expect(channels).toHaveValues(['web', 'marketplace']);   // multi-select assertion
await channels.selectOption([]);                                  // deselect all
await expect(channels).toHaveValues([]);
\`\`\`

\`toHaveValue\` checks the select's current value; \`toHaveValues\` (Playwright 1.23+) checks the full set of selected options of a multi-select. To assert the visible text, use \`expect(country.locator('option:checked')).toHaveText('Germany')\`.

### Custom dropdowns

Design systems render dropdowns as a button plus a list of \`div\`s. \`selectOption\` throws on them (*"Element is not a <select> element"*). Drive them like a user, using ARIA roles when the component implements them:

\`\`\`ts
// realistic example: a delivery-slot picker on a ShopEasy checkout built with a component library
await page.getByRole('combobox', { name: 'Delivery slot' }).click();
await page.getByRole('option', { name: 'Tomorrow, 9–12' }).click();
await expect(page.getByRole('combobox', { name: 'Delivery slot' })).toHaveText(/Tomorrow, 9–12/);
\`\`\`

Many components render the listbox in a portal at the end of \`<body>\`, so do **not** scope the option locator inside the combobox. Typeahead comboboxes need \`pressSequentially\` (below) and an assertion that the option list updated before clicking.

| | \`selectOption\` (native) | click + \`getByRole('option')\` (custom) |
|---|---|---|
| How | sets selection via the DOM, fires events | real clicks on rendered items |
| Speed | one call | 2+ actions, waits for animation |
| Robustness | very high | depends on component's ARIA quality |
| Finds bugs in | value/label mapping | keyboard/ARIA/portal issues users hit |
| Assert with | \`toHaveValue\` / \`toHaveValues\` | text or \`aria-selected\` / hidden input value |

**Recommendation:** wrap custom dropdowns in a small component object (\`DeliverySlotPicker.choose(label)\`) so the click sequence lives in one place; push for proper \`combobox\`/\`option\` roles — if \`getByRole('option')\` cannot find items, screen-reader users cannot either.

## Mouse and keyboard

### hover and drag: locator methods vs raw mouse

\`locator.hover()\` runs actionability checks (visible, stable, receives events), scrolls into view and moves the virtual mouse to the element's centre. On \`dynamic.html\` the account submenu exists only under the pointer:

\`\`\`ts
await page.getByRole('button', { name: /My account/ }).hover();
await page.getByRole('menuitem', { name: 'Orders' }).click();       // moving to the item keeps :hover inside .hover-menu
await expect(page.getByTestId('dynamic-result')).toHaveText('Menu: Orders');
\`\`\`

\`locator.dragTo(target)\` moves to the source, presses, moves to the target and releases. Playwright also produces HTML5 \`dragstart/dragover/drop\` events when the page uses native drag and drop. Recent versions (1.57+) accept \`steps\` to send intermediate \`mousemove\` events, for libraries that ignore a single jump.

\`\`\`ts
const source = page.getByLabel('Draggable product');
const target = page.locator('#droppable');

// A. high level — default choice
await source.dragTo(target);

// B. manual — for sliders, canvases, "drag at least 10px before it counts" libraries
const from = await source.boundingBox();
const to = await target.boundingBox();
if (!from || !to) throw new Error('drag source or target not rendered');
await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
await page.mouse.down();
await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
await page.mouse.up();

await expect(target).toHaveText('Dropped! Backpack added to wishlist');
\`\`\`

| | \`dragTo\` | \`mouse.down/move/up\` |
|---|---|---|
| Actionability + scrolling | yes | no — you compute coordinates |
| Viewport/zoom sensitive | no | yes (\`boundingBox\` is viewport-relative) |
| Control over path | \`steps\`, \`sourcePosition\`, \`targetPosition\` | full |
| Use when | almost always | sliders, canvas, drawing, custom thresholds |

### Keyboard and typing

| Method | What it does | Use for |
|---|---|---|
| \`locator.fill(text)\` | focuses, replaces the value, fires one \`input\` event | almost all text entry |
| \`locator.pressSequentially(text, { delay })\` | real \`keydown/keypress/keyup\` per character | typeahead, input masks, per-key handlers |
| \`locator.type()\` | deprecated since Playwright 1.38 — use one of the two above | legacy code only |
| \`locator.press('Enter')\` / \`page.keyboard.press('ControlOrMeta+A')\` | one key or chord | submitting, shortcuts, selecting all |
| \`page.keyboard.down/up/insertText\` | low-level | holding Shift while clicking, IME-like input |

\`fill\` is not "fast typing"; it sets the value. A masked phone field that reformats on \`keydown\` can end up with an unformatted value after \`fill\` and a correct one after \`pressSequentially\`. The opposite trap: \`pressSequentially\` does not clear the field. \`ControlOrMeta\` maps to Ctrl on Windows/Linux and Cmd on macOS, so shortcut tests run on every developer machine.

**Clipboard caveats.** Copy/paste tests need clipboard permissions, which are browser-specific: in Chromium \`context.grantPermissions(['clipboard-read', 'clipboard-write'])\` makes \`navigator.clipboard.readText()\` work in \`page.evaluate\`; Firefox and WebKit handle these permissions differently, and headless runs should not be assumed to share the host clipboard. In practice: test **your app's** behaviour (the "Copy coupon" button shows "Copied", the pasted value lands in the field via \`keyboard.press('ControlOrMeta+V')\`) in Chromium, and keep clipboard tests out of the cross-browser matrix or tag them.

## File upload

### setInputFiles vs the filechooser event

\`setInputFiles\` does not open the OS dialog at all: Playwright sets the \`FileList\` on the \`<input type="file">\` through the protocol and fires \`input\`/\`change\`. It works on hidden inputs too (no visibility check) and also accepts a \`<label>\` whose control is the input.

\`\`\`ts
// form.html — "Upload trade licence (PDF or image)"
import path from 'node:path';

const licence = page.getByLabel('Upload trade licence (PDF or image)');

await licence.setInputFiles(path.join(__dirname, 'fixtures', 'trade-licence.pdf'));   // path on disk
await licence.setInputFiles({                                                         // generated in memory
  name: 'trade-licence.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\\n% test licence\\n'),
});
await licence.setInputFiles([]);                                                      // clear
expect(await licence.evaluate((el: HTMLInputElement) => el.files?.length)).toBe(0);
\`\`\`

Arrays upload several files (input must have \`multiple\`); a single directory path works for \`webkitdirectory\` inputs (Playwright 1.45+). Note that \`accept=".pdf,.png,..."\` is **not** enforced by \`setInputFiles\` — the browser only filters the OS dialog. Server-side validation of the file type must be tested separately (the ShopEasy API's avatar endpoint returns 415 for a wrong type).

Use the **\`filechooser\`** event when there is no stable input to locate: the uploader creates an \`<input type="file">\` on the fly and calls \`.click()\` on it.

\`\`\`ts
const chooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Upload photos' }).click();
const chooser = await chooserPromise;
expect(chooser.isMultiple()).toBe(true);
await chooser.setFiles(['fixtures/front.png', 'fixtures/back.png']);
\`\`\`

| | \`locator.setInputFiles\` | \`filechooser\` event |
|---|---|---|
| Needs a locatable input | yes | no |
| Exercises the real button | no | yes (the click that opens the chooser) |
| Speed / simplicity | best | one extra event |
| Use when | input exists in the DOM (most forms) | dynamic inputs, drag-zones that open a chooser |

## File download

### How it works internally

\`acceptDownloads\` defaults to \`true\`. When a response is an attachment (\`Content-Disposition: attachment\`, or an \`<a download>\`), the browser hands it to Playwright, which stores it under a temporary artifacts folder and emits \`download\` on the page (and on the context in recent versions). The \`Download\` object:

| Method | Behaviour |
|---|---|
| \`download.suggestedFilename()\` | from \`Content-Disposition\` or the \`download\` attribute (sync) |
| \`await download.path()\` | waits for completion, returns the temp path; throws for failed downloads and when connected to a **remote** browser |
| \`await download.saveAs(file)\` | copies the file; safe to call while in progress; works remotely |
| \`await download.failure()\` | \`null\` or an error string |
| \`await download.createReadStream()\` | stream without touching disk paths |

Downloaded files are **deleted when the context closes**, so save what you want to keep or attach.

### Complete example: verifying an exported CSV

The practice site has no download, so this is a clearly-labelled realistic feature: an *Export orders CSV* button on a ShopEasy admin orders page.

\`\`\`ts
// tests/admin/export-orders.spec.ts — realistic example, not on the practice site
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Export orders CSV contains the filtered orders with correct totals', async ({ page }, testInfo) => {
  await page.goto('/admin/orders?status=SHIPPED');

  const downloadPromise = page.waitForEvent('download');                            // 1
  await page.getByRole('button', { name: 'Export orders CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^orders-shipped-\\d{4}-\\d{2}-\\d{2}\\.csv$/);
  expect(await download.failure()).toBeNull();

  const file = testInfo.outputPath(download.suggestedFilename());                     // 2
  await download.saveAs(file);
  await testInfo.attach('export', { path: file, contentType: 'text/csv' });          // 3

  const [header, ...rows] = (await readFile(file, 'utf-8')).trim().split(/\\r?\\n/);   // 4
  expect(header).toBe('orderId,customer,status,itemCount,total');
  const parsed = rows.map((r) => r.split(','));
  expect(parsed.every((cols) => cols[2] === 'SHIPPED')).toBe(true);
  await expect(page.getByRole('row')).toHaveCount(rows.length + 1);                  // 5 UI rows + header row
});
\`\`\`

1. Listen first; a download can start before \`click()\` returns.
2. \`testInfo.outputPath\` gives a per-test folder under \`test-results\`, safe with parallel workers and cleaned between runs.
3. Attaching makes the file visible in the HTML report — invaluable when a CI-only failure is a CSV encoding issue.
4. For real CSVs with quoted commas use a parser (\`csv-parse\`); \`split(',')\` is fine for a known simple format.
5. Cross-check the file against the UI (or better, the API) instead of a hard-coded count.

**PDFs.** Check \`%PDF-\` magic bytes and size, then extract text with a library such as \`pdf-parse\` to assert invoice number and total. If the server sends \`Content-Disposition: inline\`, the browser may display the PDF instead of downloading it; fetching the file with \`page.request.get(url)\` (shares the context's cookies) and asserting the body is often the more reliable test.

**Downloads in CI.** Use \`saveAs\` + \`outputPath\` instead of \`path()\` if you might run against a remote browser (\`connect\`, grid providers). Do not write to a shared \`downloads/\` folder — parallel workers overwrite each other's files.

| Approach | Pros | Cons | Use when |
|---|---|---|---|
| UI click + \`download\` event | tests the button, filename, headers as users see them | slower, browser-dependent filename edge cases | one end-to-end check per export |
| \`page.request.get(exportUrl)\` | fast, no browser download plumbing, full header access | skips the button wiring | content variations (filters, locales, large data) |

## Evidence: screenshots, video and traces

\`\`\`ts
await page.screenshot({ path: 'cart.png', fullPage: true, animations: 'disabled' });
await page.locator('#employee-table').screenshot({ path: 'employees.png' });     // table.html
await page.screenshot({
  path: 'masked.png',
  mask: [page.locator('#row-count')],      // dynamic text covered with a box
  maskColor: '#334155',                    // Playwright 1.35+
  style: '.page-info { visibility: hidden; }',   // Playwright 1.41+
});
\`\`\`

\`animations: 'disabled'\` finishes finite CSS animations and transitions and cancels infinite ones; \`caret\` defaults to \`'hide'\`; \`fullPage\` scrolls the whole document. For config-level evidence: \`screenshot: 'only-on-failure'\`, \`video: 'retain-on-failure'\` (also \`'on-first-retry'\` and more modes in recent versions), \`trace: 'on-first-retry'\` or \`'retain-on-failure'\`. A video is only finalised when its page/context closes. \`'retain-on-failure'\` still **records every test** and deletes passing videos, so you pay the encoding CPU on every run.

| Evidence | Captures | Cost | Best for |
|---|---|---|---|
| Screenshot | one frame | tiny | visual state at failure, visual regression (\`toHaveScreenshot\`) |
| Video | continuous pixels | high CPU during run + disk | timing/animation bugs, showing a PO "what happened" |
| Trace | actions, DOM snapshots before/after each action, network, console, source | moderate; with \`on-first-retry\` only paid on retries | root-causing flaky and CI-only failures |

**Recommendation:** \`trace: 'on-first-retry'\` (or \`'retain-on-failure'\` without retries) plus \`screenshot: 'only-on-failure'\` as the default; turn video on for a specific project or investigation. A trace answers "why" — which element, which response, which console error — while a video only shows "what".

## Shadow DOM

ShopEasy's \`<coupon-widget>\` on \`dynamic.html\` attaches an **open** shadow root containing \`#coupon-code\` and \`#apply-coupon\`. Playwright's CSS engine and all \`getBy*\` locators pierce open shadow roots, so no special syntax is needed:

\`\`\`ts
await page.getByLabel('Coupon code').fill('save10');                 // aria-label inside the shadow root
await page.locator('#apply-coupon').click();                         // CSS pierces too
await expect(page.locator('coupon-widget #coupon-message')).toHaveText('Coupon applied: 10% off');
await expect(page.locator('//input[@id="coupon-code"]')).toHaveCount(0);   // XPath does NOT pierce
\`\`\`

- **XPath** does not enter shadow roots — another reason to avoid it.
- **Closed** shadow roots (\`attachShadow({ mode: 'closed' })\`) are not supported by Playwright locators. Ask for an open root or test ids in test builds, or test through the component's public API/visible effects.
- Shadow DOM also scopes ids: two widgets can both contain \`#coupon-code\`; scope with the host (\`page.locator('coupon-widget').first().locator('#coupon-code')\`) if there are several.

\`\`\`java
// Selenium 4 (Java)
SearchContext root = driver.findElement(By.cssSelector("coupon-widget")).getShadowRoot();
root.findElement(By.cssSelector("#coupon-code")).sendKeys("save10");   // CSS only inside a shadow root, no XPath
root.findElement(By.cssSelector("#apply-coupon")).click();
\`\`\`

## Common mistakes and how they show up

- **\`page.frame('support-frame')\` is null** → *"Cannot read properties of null"*. It matches the frame name (\`supportFrame\`), not the id; use \`frameLocator('#support-frame')\`.
- **Awaiting \`waitForEvent\` before the click** → the test hangs until timeout; the trace shows the click never ran. Create the promise, act, then await.
- **Dialog listener that does not accept/dismiss** → the click times out; the trace's call log for the click stalls with the page frozen.
- **\`Promise.all([page.waitForEvent('popup'), click])\` copied without understanding** → fine, but if the click is itself awaited earlier the popup may already be gone; keep one consistent pattern in the team.
- **\`fill\` on a masked input** → the value is right in the trace's DOM snapshot but the app's model is not updated; switch to \`pressSequentially\` for that field only.
- **Reading \`download.path()\` against a remote browser** → *"Path is not available when connecting remotely"*; use \`saveAs\`.

## Best practices for experienced engineers

- Expose frames, custom dropdowns and uploaders as **component objects** so the boundary handling lives in one class.
- Identify tabs by URL/title predicate, never by \`context.pages()[1]\`.
- Make dialogs explicit: \`once\` per expected dialog, and an auto fixture that fails on unexpected ones.
- Generate upload fixtures in memory (\`buffer\`) for edge cases (0 bytes, 101 KB, wrong MIME) instead of committing binary files.
- Assert downloaded **content**, attach the file to the report, and keep content-variation tests at the API level.
- Choose evidence deliberately: traces on retry by default; video on demand.

## Interview questions

### Q: What is the difference between \`frameLocator\` and \`page.frame()\`?
**Short answer (30–60 s):** \`frameLocator\` (or \`locator.contentFrame()\`) is a lazy, auto-waiting, strict scope for locating elements inside an iframe; it is re-resolved on every action. \`page.frame()\` looks up a live \`Frame\` object once by name or URL and can return null. I use \`frameLocator\` for interaction and \`Frame\` for frame-level APIs like \`url()\` or \`evaluate\`.

**Detailed answer:** A \`FrameLocator\` is just part of a selector chain (\`… >> internal:control=enter-frame >> …\`), so it shares the locator lifecycle: it waits for the iframe and its content, survives the iframe reloading, and fails loudly if two iframes match. A \`Frame\` is a handle in the page's frame tree; it follows navigations of that iframe but detaches if the iframe element is removed, and \`page.frame()\` does not wait. Neither changes global state, unlike Selenium's \`switchTo().frame()\`, so parent and child can be asserted in the same test. Trap: \`page.frame(string)\` matches the \`name\` attribute, not the id.

### Q: How does Playwright handle cross-origin iframes?
**Short answer (30–60 s):** Transparently. Playwright attaches to out-of-process frames itself, so \`frameLocator\` works the same for same-origin and cross-origin iframes such as a payment provider's card form.

**Detailed answer:** In Chromium, site isolation runs cross-site iframes in a separate renderer; Playwright connects to that target and routes commands there. The restriction you still have is in page JavaScript: \`page.evaluate\` in the parent cannot read a cross-origin child's DOM, so evaluate in the child \`Frame\` instead. For third-party iframes I limit tests to the integration contract — the field renders, a test card gets accepted in the provider's sandbox — and do not test the provider's UI in depth.

### Q: What happens if a test does not handle a dialog?
**Short answer (30–60 s):** With no \`dialog\` listener on the page or context, Playwright auto-dismisses it: confirm returns false, prompt returns null. If a listener exists it must accept or dismiss, otherwise the page stays blocked and the action times out.

**Detailed answer:** Auto-dismiss keeps suites from hanging but can hide bugs — a "confirm → OK" test can pass while exercising Cancel, and an unexpected \`alert\` from a JavaScript error goes unnoticed. I use \`page.once\` per expected dialog, record \`type()\`/\`message()\` in the handler and assert in the test body, and add an auto fixture that collects unexpected dialogs and fails the test. For \`beforeunload\`, \`page.close({ runBeforeUnload: true })\` is required, and it does not wait for the page to close because the dialog may keep it open.

### Q: \`page.waitForEvent('popup')\` or \`context.waitForEvent('page')\`?
**Short answer (30–60 s):** \`popup\` for pages opened by this page; context \`page\` for any page in the context, e.g. opened by another popup or several at once. Both must be created before the click.

**Detailed answer:** Popups belong to the opener, so \`page.on('popup')\` is precise and readable. When a flow opens tabs indirectly, or two at once (ShopEasy's *Open terms + privacy*), I use context-level waits with a predicate on URL so the test does not depend on the order of \`window.open\` calls. Two related facts: \`page.route\` does not intercept a popup's first request — use \`context.route\` — and \`waitForEvent\` on a page throws if that page closes, which matters for OAuth popups that close themselves.

\`\`\`ts
const termsPromise = context.waitForEvent('page', (p) => p.url().includes('page=terms'));
\`\`\`

### Q: \`fill\`, \`pressSequentially\` or \`type\`?
**Short answer (30–60 s):** \`fill\` by default — it sets the value and fires one input event. \`pressSequentially\` when the page reacts to individual key events (typeahead, masks). \`type\` is deprecated since 1.38.

**Detailed answer:** \`fill\` is deterministic and fast, but it bypasses \`keydown/keyup\` handlers, so masked inputs or "search as you type" debounces may not behave as with a user. \`pressSequentially\` sends real key events (optionally with \`delay\`) and does not clear the field first — combine with \`fill('')\` or \`ControlOrMeta+A\`. For shortcuts use \`press('ControlOrMeta+S')\` so the test is portable across macOS and Windows.

### Q: How do you test a file download in CI?
**Short answer (30–60 s):** Create \`page.waitForEvent('download')\` before the click, then \`saveAs\` into \`testInfo.outputPath(...)\`, attach it to the report, and parse and assert the content.

**Detailed answer:** Files live in a temp folder and are deleted when the context closes; \`path()\` waits for completion but throws when connected to a remote browser, so \`saveAs\` is portable. Per-test output paths avoid parallel workers overwriting files. I assert filename, \`failure()\` is null, and the content against the UI or API. Content variations (filters, locales, large exports) I test through \`page.request\` against the export endpoint — faster and not dependent on browser download plumbing — and keep one UI test for the button.

### Q: \`setInputFiles\` or the \`filechooser\` event?
**Short answer (30–60 s):** \`setInputFiles\` whenever the \`<input type=file>\` exists — no OS dialog, works on hidden inputs. \`filechooser\` when the input is created dynamically by a button.

**Detailed answer:** \`setInputFiles\` sets the FileList via the protocol and fires \`change\`; it accepts paths, in-memory \`{ name, mimeType, buffer }\` objects, arrays, \`[]\` to clear, and a directory for \`webkitdirectory\` inputs (1.45+). It does not enforce \`accept\`, so file-type validation must be tested on the server. The \`filechooser\` event exercises the real button and tells you \`isMultiple()\`.

### Q: Screenshot, video or trace — what do you collect on failure?
**Short answer (30–60 s):** Trace on first retry (or retain on failure) plus a failure screenshot by default; video only when needed, because \`retain-on-failure\` still records every test.

**Detailed answer:** A trace has DOM snapshots before/after each action, network, console and source lines, so it explains *why*; video only shows pixels. Video encoding costs CPU on every test even when the file is deleted afterwards. Screenshots are cheap and readable in the report; for visual checks use \`toHaveScreenshot\` with \`animations: 'disabled'\` and masks for dynamic regions.

## Scenario-based questions

**1. A checkout test passes locally but in CI the order is never placed; no error.** I would open the trace and look at the dialog events: CI's data may trigger a "Your cart changed — continue?" confirm that locally never appears. Without a listener it is auto-dismissed, the app treats it as Cancel, and the test's final assertion happens to be weak. Fix: an auto fixture that fails on unexpected dialogs, a stronger final assertion (order id visible), and an explicit \`once\` handler where the confirm is expected.

**2. The payment iframe intermittently says "element not found".** Check whether the provider replaces the iframe element on retry (a new iframe → any stored \`Frame\` detaches). Moving from \`page.frame()\` to \`page.getByTitle('Secure card payment').contentFrame()\` makes every action re-resolve the iframe. If two iframes briefly coexist during the swap, strict mode will say so — scope by title or \`name\` rather than \`.first()\`.

**3. The team wants video for every test "for evidence".** I would quantify: run the suite with \`video: 'off'\` and \`'retain-on-failure'\` and compare duration and CPU on CI runners. Then propose traces on first retry as the default (they contain more diagnostic data), video only on a nightly project or on demand, and screenshots on failure for quick triage in the report.

## Tricky follow-ups

- **Does \`page.route\` mock the requests of a popup?** Not its first request — the popup is a new page. Use \`context.route\`.
- **Is \`toHaveValue\` enough for a multi-select?** No — it reads only the select's \`value\` (the first selected option). Use \`toHaveValues([...])\`.
- **Can \`setInputFiles\` upload to an input with \`accept=".pdf"\` a PNG?** Yes. \`accept\` only filters the OS dialog; test server-side validation separately.
- **Why does \`hover()\` then \`click()\` on the submenu sometimes fail?** If the pointer path leaves the \`:hover\` container (a gap between button and menu), the menu closes; the trace shows the menu item becoming hidden. Click the item directly (it moves the mouse there) or fix the gap — a real usability bug.
- **Do CSS locators pierce closed shadow roots?** No; open roots only. XPath pierces neither.`,
  keyPoints: [
    'No global focus: frames, pages, dialogs, file choosers and downloads are explicit objects or events — address them directly, never "switch".',
    'frameLocator / locator.contentFrame() (1.43+) are lazy, auto-waiting and strict; page.frame() is a one-off lookup by frame name or URL for frame-level APIs.',
    'popup = pages opened by this page; context "page" = any new page; pick tabs by URL/title predicate; page.route misses a popup\'s first request.',
    'Without a dialog listener Playwright auto-dismisses; with one you must accept/dismiss. Record in the handler, assert in the test, and fail on unexpected dialogs.',
    'selectOption matches value or label, waits for options, returns selected values; assert with toHaveValue / toHaveValues; custom dropdowns are click + getByRole("option").',
    'dragTo by default, raw mouse for sliders/canvas; fill by default, pressSequentially for key-driven inputs; type() is deprecated (1.38).',
    'setInputFiles sets files without an OS dialog (paths, buffers, [], directories); filechooser for dynamic inputs; downloads: listen first, saveAs to outputPath, assert content.',
    'Evidence: trace on retry + failure screenshot by default, video on demand; open shadow roots are pierced by CSS and getBy*, not by XPath, closed roots not at all.',
  ],
  mistakes: [
    'Using page.frame("support-frame") with the iframe id and getting null. Fix: page.frame() matches the name attribute (supportFrame) or URL; for interaction use frameLocator("#support-frame") or getByTitle("Contact support").contentFrame().',
    'Asserting with expect inside a dialog handler, or forgetting accept/dismiss in it. Symptom: click times out with the page frozen, or an unrelated unhandled error. Fix: record type/message in the handler, always accept or dismiss, assert in the test body.',
    'Selecting the new tab with context.pages()[1]. Fix: create context.waitForEvent("page", p => p.url().includes(...)) or page.waitForEvent("popup") before the click; order of window.open calls is not a contract.',
    'Using selectOption on a custom div dropdown (error: "Element is not a <select> element") or clicking option text scoped inside the combobox when the list is rendered in a portal. Fix: click the combobox, then page-level getByRole("option", { name }).',
    'Reading download.path() in a remote-browser CI setup, or saving every download to a shared folder. Fix: download.saveAs(testInfo.outputPath(name)), attach it to the report, assert its content.',
    'Turning on video: "retain-on-failure" for the whole suite to "debug flakiness". Fix: traces on first retry carry DOM, network and console; measure the CPU cost of video before enabling it broadly.',
  ],
  tryIt: `Write \`tests/boundaries.spec.ts\` against \`http://localhost:5180/practice-site/\` with five tests: (1) on \`frames.html\`, submit the support form inside the iframe using \`getByTitle('Contact support').contentFrame()\` and assert **both** \`support-result\` in the frame and \`frame-message\` on the parent with a RegExp for the ticket number; then show that \`page.frame('support-frame')\` is null and \`page.frame('supportFrame')\` is not; (2) on \`windows.html\`, open *Open terms + privacy*, pick each tab with a URL predicate, assert titles and \`context.pages()\` length, close both; (3) on \`alerts.html\`, prove the auto-dismiss: click *Click for JS Confirm* with no handler and assert "You clicked: Cancel", then with \`page.once\` → accept and assert "Ok"; (4) on \`form.html\`, select two sales channels mixing a value and a \`{ label }\`, assert with \`toHaveValues\`, upload an in-memory PDF buffer, submit a valid form and assert "Licence file: …" in \`#result-details\`; (5) on \`dynamic.html\`, apply coupon "save10" in the shadow DOM widget with \`getByLabel\`, then drag the backpack with the manual \`page.mouse\` approach and explain why you would still use \`dragTo\` in the real suite.`,
  problems: ['pw-011', 'pw-012', 'pw-023', 'pw-025', 'pw-042', 'pw-044'],
}
