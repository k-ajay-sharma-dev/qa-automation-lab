export default {
  id: 'dbg-026',
  category: 'debugging',
  kind: 'code',
  title: 'Playwright "Test timeout of 30000ms exceeded": reading the call log and the trace',
  level: 'ADVANCED',
  tags: ['playwright', 'typescript', 'timeout', 'trace-viewer', 'storageState', 'sessionStorage'],
  estMinutes: 25,
  scenario: `To speed up the ShopEasy Playwright suite, a teammate added a **setup project** that logs in once, adds the backpack to the cart and saves the browser state with \`storageState()\`; every checkout spec reuses that file. Since then the checkout spec times out on every run. Their attempted fix — \`click({ timeout: 60000 })\` — only made the run slower. You download the **trace** from the CI artifacts and open it with \`npx playwright show-trace\`.`,
  description: `CI output:

\`\`\`text
  ✘  [chromium] › checkout.spec.ts:5:5 › logged-in user checks out the backpack (30.0s)

    Test timeout of 30000ms exceeded.

    Error: locator.click: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByTestId('checkout')
        - locator resolved to <button disabled type="button" id="checkout" data-testid="checkout" class="btn btn-primary">Checkout</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not enabled
        - retrying click action
        - waiting 20ms
        ...
       7 |   await page.goto('cart.html');
    >  8 |   await page.getByTestId('checkout').click({ timeout: 60000 });
\`\`\`

What the **trace viewer** shows:
- Action \`page.goto cart.html\` → the *After* DOM snapshot shows **"Your cart is empty."**, the header says **Hi, guest**.
- The saved state file \`.auth/standard_user.json\` contains only: \`{ "cookies": [], "origins": [] }\`.

**Diagnose:** the call log says the button was *found* but **not enabled** — on cart.html the Checkout button is disabled when the cart is empty. Why empty, and why "guest"? ShopEasy keeps both the logged-in user (\`shopeasy.user\`) and the cart (\`shopeasy.cart\`) in **sessionStorage**, and Playwright's \`storageState()\` saves cookies and localStorage — **not sessionStorage**. The setup "worked", but nothing it did was carried over.

**Fix \`checkout.spec.ts\` (the setup file is deleted):**
- Restore the login per test: either \`page.addInitScript(...)\` that sets \`sessionStorage['shopeasy.user']\` if missing, or a real UI login in \`test.beforeEach\`.
- The test arranges **its own cart** (adds the backpack) instead of relying on a shared file.
- Assert the precondition before acting: user is \`standard_user\` and Checkout \`toBeEnabled()\`.
- **Rules:** no \`storageState\`, no \`force: true\`, no \`waitForTimeout\`, no raised timeouts.`,
  hints: [
    'Read the call log bottom-up: "locator resolved to <button disabled …>" + "element is not enabled" = right element, wrong state.',
    'Open the trace snapshot before the failing action: what does the page look like? Who is logged in?',
    "test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem('shopeasy.user')) sessionStorage.setItem('shopeasy.user', 'standard_user'); }); });",
  ],
  language: 'typescript',
  starterCode: String.raw`// ===== tests/auth.setup.ts =====
import { test as setup, expect } from '@playwright/test';

setup('log in as standard_user', async ({ page }) => {
  await page.goto('login.html');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.context().storageState({ path: '.auth/standard_user.json' });
});

// ===== tests/checkout.spec.ts =====
import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/standard_user.json' });

test('logged-in user checks out the backpack', async ({ page }) => {
  await page.goto('cart.html');
  await page.getByTestId('checkout').click({ timeout: 60000 });
  await expect(page.getByTestId('title')).toHaveText('Checkout: Your Information');
});
`,
  solution: String.raw`// ===== tests/checkout.spec.ts =====
// (auth.setup.ts was deleted: storageState() cannot carry ShopEasy's sessionStorage session)
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // runs before the page's own scripts on every navigation in this page
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('shopeasy.user')) {
      window.sessionStorage.setItem('shopeasy.user', 'standard_user');
    }
  });
});

test('logged-in user checks out the backpack', async ({ page }) => {
  await page.goto('inventory.html');
  await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user');

  // the test arranges its own cart - no hidden dependency on another project
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await expect(page.getByTestId('cart-item')).toHaveCount(1);

  const checkout = page.getByTestId('checkout');
  await expect(checkout).toBeEnabled();
  await checkout.click();
  await expect(page.getByTestId('title')).toHaveText('Checkout: Your Information');
});
`,
  checks: [
    { label: 'Restores the login without storageState (init script or UI login in beforeEach)', pattern: "(addInitScript\\s*\\(|beforeEach\\s*\\([\\s\\S]*?(getByTestId\\s*\\(\\s*['\"]username|getByLabel\\s*\\(\\s*['\"]Username))", flags: 'ms', hint: 'page.addInitScript(() => sessionStorage.setItem(...)) in test.beforeEach' },
    { label: 'No storageState any more', pattern: 'storageState', mustNot: true, hint: 'It saves cookies + localStorage only — ShopEasy uses sessionStorage' },
    { label: 'Asserts who is logged in', pattern: "await\\s+expect\\s*\\([^;]*logged-in-user[^;]*\\)\\s*\\.toHaveText\\s*\\(\\s*['\"]standard_user", hint: "await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user')" },
    { label: 'Asserts Checkout is enabled before clicking', pattern: "await\\s+expect\\s*\\([^;]*\\)\\s*\\.toBeEnabled\\s*\\(", hint: 'await expect(checkout).toBeEnabled()' },
    { label: 'Adds the backpack inside the test', pattern: "test\\s*\\(\\s*['\"]logged-in user[\\s\\S]*add-to-cart-trailblazer-backpack", flags: 'ms', hint: 'The test arranges its own cart' },
    { label: 'No band-aids (force, hard waits, longer timeouts)', pattern: '(force\\s*:\\s*true|waitForTimeout\\s*\\(|timeout\\s*:\\s*\\d{5,})', mustNot: true, hint: 'The button was disabled for a reason — waiting longer never enables it' },
  ],
  explanation: `**How to read a Playwright timeout.** A timeout is never the root cause; the **call log** tells you which actionability check kept failing:
| Call-log line | Meaning | Typical cause |
|---|---|---|
| \`waiting for getByTestId('x')\` (nothing resolved) | No element matches | Wrong locator, wrong page, element in an iframe |
| \`element is not visible\` | Found but hidden | Collapsed menu, wrong viewport, still loading |
| \`element is not enabled\` | Found but \`disabled\` | A precondition is missing (empty cart, invalid form) |
| \`element is not stable\` | Still animating | Usually resolves itself; long animation |
| \`<div class="modal-overlay" id="confirm-modal">…</div> intercepts pointer events\` | Something covers it | Modal/overlay/cookie banner still open |

Here: *found, but not enabled.* That is a **state** problem, so raising the timeout to 60 s was pointless — the button would stay disabled forever.

**The trace viewer** answers "what state?": the DOM snapshot after \`goto\` shows an empty cart and *Hi, guest*. The setup project clearly logged in and added the backpack (its own assertion passed), so the state was lost **between** projects. The saved JSON proves it: \`"cookies": []\` and \`"origins": []\` — nothing to restore.

**Root cause:** \`storageState()\` persists cookies and localStorage (and optionally IndexedDB), **not sessionStorage**. That's fine for apps with cookie/token sessions, useless for ShopEasy, which keeps \`shopeasy.user\` and \`shopeasy.cart\` in sessionStorage. The Playwright docs suggest exactly this workaround: put the values back with \`addInitScript\`, which runs before the page's scripts on every navigation. The \`if (!getItem)\` guard matters — without it a logout inside the test would be undone by the next navigation.

**Design lesson:** a test should arrange its own **data** (the cart) even if login is shared. Pre-filled carts in a shared state file create invisible coupling — the same order-dependency problem as a shared static driver, just in a new tool.`,
  mistakes: [
    'Raising the action or test timeout when the call log says "element is not enabled".',
    'click({ force: true }) on a disabled button — it skips the checks and tests nothing real.',
    'Assuming storageState saves "everything about the browser" — it does not save sessionStorage.',
    'Putting test data (the cart) into a shared state file used by many specs.',
  ],
  interview: [
    { q: 'A Playwright test times out on a click. How do you debug it?', a: 'I read the call log under the error: whether the locator resolved at all, and which actionability check failed — visible, enabled, stable, or receives events. Then I open the trace for that run and look at the DOM snapshot and console/network around the action. In one case the button was disabled because the cart was empty: storageState had not saved the sessionStorage cart, so the fix was restoring the session with addInitScript, not a longer timeout.' },
    { q: 'What does storageState save, and how do you reuse a login in Playwright?', a: 'It saves cookies and localStorage per origin, optionally IndexedDB. A setup project logs in once and writes the file; tests load it with use.storageState. If the app keeps its session in sessionStorage, that does not work, and you restore it with page.addInitScript or log in per test.' },
    { q: 'What is the trace viewer and when do you use it?', a: 'It replays a recorded test: every action with before/after DOM snapshots, the call log, console messages, network requests and source. We record traces on first retry in CI and open them with npx playwright show-trace to see exactly what the page looked like when a step failed.' },
  ],
}
