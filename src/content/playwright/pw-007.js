export default {
  id: 'pw-007',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Delete every waitForTimeout: web-first assertions on waits.html',
  level: 'INTERMEDIATE',
  tags: ['auto-waiting', 'web-first-assertions', 'flaky-tests'],
  estMinutes: 25,
  scenario: `The first migrated spec, \`tests/waits.spec.ts\`, was ported straight from Selenium: every \`Thread.sleep(5000)\` became
\`page.waitForTimeout(5000)\`. The file takes 15 seconds, still fails about once a week in CI ("expected 'Completed', received 'Processing'"),
and the tech lead has blocked the PR: *"No waitForTimeout in this repo. Use auto-waiting and web-first assertions."*`,
  description: `Rewrite the three tests on \`waits.html\` so they are fast and reliable.

1. **Order status** — click *Place order*; the status (\`data-testid="order-status"\`) goes Pending → Processing → **Completed** (≈4 s).
2. **Spinner** — click *Load orders*; a spinner (\`role="status"\`, name \`Loading\`) shows for ≈3 s, then \`Loaded 42 orders\` appears.
3. **Enabled later** — *Claim reward* is disabled for 5 s; click it and expect \`Reward claimed: 500 points\` in \`#claim-result\`.

**Rules**
- No \`waitForTimeout\`, no \`expect(await …)\` (that reads a value once and never retries).
- Use \`await expect(locator).toHaveText / toBeHidden / toBeVisible\`; raise the timeout **for that assertion only** where the app is slow.
- Let \`click()\` auto-wait for the button to become enabled.`,
  starterCode: `import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('waits.html');
});

test('order reaches Completed', async ({ page }) => {
  await page.click('#place-order-btn');
  await page.waitForTimeout(5000);
  const status = await page.locator('#order-status').textContent();
  expect(status).toBe('Completed');
});

test('orders load after the spinner', async ({ page }) => {
  await page.click('#load-data-btn');
  await page.waitForTimeout(4000);
  expect(await page.isVisible('#orders-loaded')).toBe(true);
});

test('reward can be claimed once enabled', async ({ page }) => {
  await page.waitForTimeout(6000);
  await page.click('#claim-reward-btn');
  expect(await page.locator('#claim-result').textContent()).toBe('Reward claimed: 500 points');
});
`,
  solution: `import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('waits.html');
});

test('order reaches Completed', async ({ page }) => {
  await page.getByRole('button', { name: 'Place order' }).click();

  // the app needs ~4 s; give this one assertion more than the 5 s default
  await expect(page.getByTestId('order-status')).toHaveText('Completed', { timeout: 10_000 });
});

test('orders load after the spinner', async ({ page }) => {
  await page.getByRole('button', { name: 'Load orders' }).click();

  await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText('Loaded 42 orders')).toBeVisible();
});

test('reward can be claimed once enabled', async ({ page }) => {
  const claim = page.getByRole('button', { name: 'Claim reward' });
  await expect(claim).toBeEnabled({ timeout: 10_000 });
  await claim.click();

  await expect(page.locator('#claim-result')).toHaveText('Reward claimed: 500 points');
});
`,
  checks: [
    { label: 'No waitForTimeout', pattern: 'waitForTimeout', mustNot: true, hint: 'Replace every fixed pause with a web-first assertion.' },
    { label: 'No one-shot expect(await …)', pattern: 'expect\\(\\s*await\\b', mustNot: true, hint: 'expect(await x.textContent()) checks once; use await expect(locator).toHaveText(...)' },
    { label: 'Status asserted with toHaveText Completed', pattern: "await\\s+expect\\([^;]*\\)\\.toHaveText\\(\\s*['\"]Completed['\"]", hint: "await expect(page.getByTestId('order-status')).toHaveText('Completed', { timeout: 10_000 });" },
    { label: 'Per-assertion timeout for slow steps', pattern: 'timeout\\s*:\\s*\\d', hint: 'Pass { timeout: 10_000 } to the slow assertion instead of raising the global timeout.' },
    { label: 'Spinner hidden / result visible', pattern: '\\.(toBeHidden|toBeVisible)\\(', hint: "await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden();" },
    { label: 'No deprecated page.click / page.isVisible shortcuts', pattern: 'page\\.(click|isVisible)\\(', mustNot: true, hint: 'Use locator actions: page.getByRole(...).click()' },
  ],
  hints: [
    'The default expect timeout is 5 s; the order needs ≈4 s, so give that single assertion { timeout: 10_000 }.',
    'click() already waits for the element to be visible, stable and enabled — up to the test timeout.',
    'isVisible() and textContent() return the value right now. Web-first matchers (toBeVisible, toHaveText) keep retrying.',
  ],
  explanation: `There are two kinds of waiting in Playwright and you need both:

- **Auto-waiting actions** — before \`click()\`, \`fill()\` etc. Playwright checks the element is attached, visible, stable, enabled and not
  covered, retrying until it is. That is why *Claim reward* can just be clicked (the explicit \`toBeEnabled\` makes the intent obvious in the report).
- **Web-first assertions** — \`await expect(locator).toHaveText('Completed')\` polls until the text matches. The intermediate *Processing* value
  does not fail the test; only a timeout does.

\`waitForTimeout(5000)\` is wrong in both directions: it wastes 5 s when the app is fast and still fails when CI is slower. The rewritten
file runs in ~12 s of *app* time instead of 15 s of fixed sleeps and, more importantly, does not flake.

Raise timeouts **locally** (\`{ timeout: 10_000 }\`) for known-slow steps; bumping the global \`expect.timeout\` hides real performance regressions.`,
  mistakes: [
    'expect(await locator.isVisible()).toBe(true) — isVisible does not wait at all; it returns false immediately if the element is not there yet.',
    'Raising the global timeout to 60 s to "fix" one slow assertion.',
    "Waiting for the spinner to appear first — if it is already gone you wait for nothing; assert it is hidden and the result visible.",
    'Using page.waitForSelector everywhere — it works, but web-first assertions are clearer and produce better error messages.',
  ],
  interview: [
    { q: 'What checks does Playwright perform before a click?', a: 'Attached to the DOM, visible, stable (not animating), enabled, and receives events (not covered by another element). It retries these until they pass or the timeout expires.' },
    { q: 'When would you still need an explicit wait in Playwright?', a: 'For things that are not elements: waitForResponse/waitForRequest for network, waitForEvent for popups/downloads, waitForURL, waitForLoadState, or expect.poll / toPass for custom conditions. Never a fixed timeout.' },
    { q: 'Difference between test timeout and expect timeout?', a: 'The test timeout (30 s default) bounds the whole test including hooks; the expect timeout (5 s default) bounds each web-first assertion. Actions have no own timeout by default and are bounded by the test timeout unless actionTimeout is set.' },
  ],
}
