export default {
  id: 'dbg-021',
  category: 'debugging',
  kind: 'code',
  title: 'Missing await: a green Playwright test that checked nothing',
  level: 'INTERMEDIATE',
  tags: ['playwright', 'typescript', 'await', 'async', 'false-positive', 'web-first-assertions'],
  estMinutes: 20,
  scenario: `A developer broke the ShopEasy cart badge on purpose in a test branch (it now always shows **1**) to see whether the new Playwright suite notices. It doesn't: \`cart badge counts two products\` stays **green** in 0.9 s. In the same spec, \`checkout overview shows the item total\` fails roughly every other run with an odd value, and once the run ended with *"Target page, context or browser has been closed"*. Your QA lead asks: "Can we trust this suite at all?"`,
  description: `Two outputs from the same spec:

\`\`\`text
  ✓  1 [chromium] › cart.spec.ts:3:5 › cart badge counts two products (912ms)
  ✘  2 [chromium] › cart.spec.ts:10:5 › checkout overview shows the item total (1.6s)

  2) [chromium] › cart.spec.ts:10:5 › checkout overview shows the item total

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: "$29.99"
    Received: "$0.00"

      19 |   const subtotal = await page.locator('#summary-subtotal').textContent();
    > 20 |   expect(subtotal).toBe('$29.99');
\`\`\`

and on another run:

\`\`\`text
    Error: locator.click: Target page, context or browser has been closed
\`\`\`

**Diagnose:** every Playwright action and web-first assertion returns a **Promise**. Without \`await\`, the line only *starts* the work and the test moves on immediately:
- Test 1 starts two clicks and an \`expect\`, never waits for any of them, and finishes — **green, having checked nothing**. If a click is still pending when Playwright closes the page after the test, you get *"Target page, context or browser has been closed"*.
- Test 2 starts the *Continue* click without waiting, then reads \`#summary-subtotal\` while it still holds its initial \`$0.00\`. \`textContent()\` + \`toBe\` is a one-time snapshot that never retries.

**Fix the spec:**
- \`await\` every action and every \`expect(locator)\` assertion.
- Replace the \`textContent()\` + \`toBe\` snapshot with a retrying **web-first assertion**: \`await expect(page.locator('#summary-subtotal')).toHaveText('$29.99')\`.
- No \`waitForTimeout\`.`,
  hints: [
    'A test that passes in under a second while the app is broken usually never awaited its assertion.',
    'Any line that starts with page.… or expect(… and has no await in front is suspicious.',
    "await expect(page.locator('#summary-subtotal')).toHaveText('$29.99'); — it retries until the overview is rendered.",
  ],
  language: 'typescript',
  starterCode: String.raw`import { test, expect } from '@playwright/test';

test('cart badge counts two products', async ({ page }) => {
  await page.goto('inventory.html');
  page.getByTestId('add-to-cart-trailblazer-backpack').click();
  page.getByTestId('add-to-cart-pulse-bike-light').click();
  expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');
});

test('checkout overview shows the item total', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Asha');
  await page.getByTestId('lastName').fill('Rao');
  await page.getByTestId('postalCode').fill('560001');
  page.getByTestId('continue').click();
  const subtotal = await page.locator('#summary-subtotal').textContent();
  expect(subtotal).toBe('$29.99');
});
`,
  solution: String.raw`import { test, expect } from '@playwright/test';

test('cart badge counts two products', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.getByTestId('add-to-cart-pulse-bike-light').click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');
});

test('checkout overview shows the item total', async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Asha');
  await page.getByTestId('lastName').fill('Rao');
  await page.getByTestId('postalCode').fill('560001');
  await page.getByTestId('continue').click();
  // web-first assertion: retries until step 2 is rendered (or times out with a clear diff)
  await expect(page.locator('#summary-subtotal')).toHaveText('$29.99');
  await expect(page.locator('#summary-total')).toHaveText('$32.39');
});
`,
  checks: [
    { label: 'No un-awaited page actions', pattern: '^\\s*page\\.', mustNot: true, hint: 'Put await in front of every page.… action' },
    { label: 'No un-awaited expect', pattern: '^\\s*expect\\s*\\(', mustNot: true, hint: 'await expect(locator).toHaveText(...)' },
    { label: 'Badge assertion is awaited and expects 2', pattern: "await\\s+expect\\s*\\([^;]*shopping-cart-badge[^;]*\\)\\s*\\.toHaveText\\s*\\(\\s*['\"]2['\"]", hint: "await expect(page.getByTestId('shopping-cart-badge')).toHaveText('2')" },
    { label: 'Subtotal checked with a retrying web-first assertion', pattern: "await\\s+expect\\s*\\([^;]*summary-subtotal[^;]*\\)\\s*\\.(toHaveText|toContainText)\\s*\\(", hint: "await expect(page.locator('#summary-subtotal')).toHaveText('$29.99')" },
    { label: 'No one-shot textContent + toBe snapshot', pattern: 'expect\\s*\\(\\s*\\w+\\s*\\)\\s*\\.toBe\\s*\\(', mustNot: true, hint: 'toBe on a string never retries' },
    { label: 'No hard waits', pattern: 'waitForTimeout\\s*\\(', mustNot: true, hint: 'Web-first assertions already wait' },
  ],
  explanation: `**Why a missing \`await\` is so dangerous:** in TypeScript, \`page.getByTestId('x').click()\` returns a Promise immediately. Without \`await\`, nothing stops the test function from reaching its end. Playwright then marks the test **passed** (no error was thrown *in time*) and tears down the page — any work still in flight dies with *"Target page, context or browser has been closed"*, sometimes reported on a later line or not at all. A test that cannot fail is worse than no test: it gives false confidence.

**The tell-tale signs:**
- A UI test that finishes in well under a second while doing several clicks.
- The test stays green when you break the app on purpose (the developer's experiment was a great idea — do it for new suites).
- Values that look like the page's *initial* state (\`$0.00\`) — you read before the action finished.
- *"Target page, context or browser has been closed"* with no obvious reason.

**Two different assertions:**
| | Example | Retries? |
|---|---|---|
| Web-first (locator) | \`await expect(locator).toHaveText('$29.99')\` | Yes, until the timeout (5 s by default) |
| Generic (value) | \`expect(text).toBe('$29.99')\` | No — checks the value you already read |

Prefer web-first assertions for anything on the page. Use generic ones for values you computed yourself.

**Make the mistake impossible:** enable the ESLint rules \`@typescript-eslint/no-floating-promises\` and \`playwright/missing-playwright-await\` (eslint-plugin-playwright) and run lint in the PR pipeline. They flag exactly these lines before they reach the suite.

With the fix, the overview shows Item total \`$29.99\`, Tax \`$2.40\` and Total \`$32.39\`.`,
  mistakes: [
    'Adding page.waitForTimeout(2000) after the click instead of awaiting it.',
    'Reading textContent() and asserting with toBe — a snapshot that never retries.',
    'Trusting a green run without ever seeing the test fail for the right reason.',
    'Marking the "context has been closed" error as flaky infrastructure.',
  ],
  interview: [
    { q: 'What happens if you forget await in a Playwright test?', a: 'The action or assertion starts but the test does not wait for it, so the test can finish and pass before anything is checked, and pending actions later fail with "Target page, context or browser has been closed". We prevent it with the no-floating-promises and missing-playwright-await ESLint rules in CI.' },
    { q: 'What is a web-first assertion?', a: 'An assertion on a locator, like await expect(locator).toHaveText(), that re-queries the page and retries until the condition is met or the timeout expires. It replaces explicit waits. A generic expect(value).toBe() checks a value once and does not retry.' },
    { q: 'How do you know a new automated test is trustworthy?', a: 'I make it fail on purpose — change the expected value or break the app in a test environment — and check that it fails with a clear message. A test I have never seen fail might not be testing anything.' },
  ],
}
