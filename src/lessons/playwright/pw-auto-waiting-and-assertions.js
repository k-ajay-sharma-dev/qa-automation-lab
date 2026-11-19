export default {
  slug: 'pw-auto-waiting-and-assertions',
  category: 'playwright',
  order: 4,
  title: 'Auto-waiting and web-first assertions (goodbye sleeps)',
  minutes: 9,
  summary: 'Understand actionability checks and retrying assertions, choose the right matcher and timeout, and replace every fixed wait with a condition.',
  manualAnalogy: `As a manual tester you never set a stopwatch for "5 seconds, then check". You click *Load more*, watch the spinner, and check the list as soon as it has updated. Playwright works the same way: actions wait until the element is ready, and assertions keep looking until the expected result shows up — or until it is clearly not going to.`,
  body: `## Two built-in kinds of waiting

**1. Auto-waiting actions.** Before \`click()\`, \`fill()\`, \`check()\` and friends, Playwright performs **actionability checks** and retries them until they pass:

| Check | Meaning |
|---|---|
| Attached | the element is in the DOM |
| Visible | non-empty size, not \`visibility:hidden\` / \`display:none\` |
| Stable | not moving (animations finished) |
| Enabled | not \`disabled\` |
| Receives events | not covered by an overlay, spinner or cookie banner |
| Editable | (for \`fill\`) not read-only |

If they never pass, the action fails with a log of what it was waiting for — e.g. *"element is not enabled - waiting…"* — which is a far better clue than Selenium's \`ElementClickInterceptedException\`.

**2. Web-first assertions.** Matchers on a locator or page are async and **retry** until they pass or the expect timeout (5 s default) runs out:

\`\`\`ts
await page.getByRole('button', { name: 'Show message' }).click();   // waits.html, section 2
await expect(page.getByText('Your coupon code is')).toBeVisible();
await expect(page.locator('#delayed-message')).toContainText('WAIT4IT');
\`\`\`

The message appears after ~2 s; the assertion simply keeps checking. No wait object, no condition class.

## The trap: one-shot values

\`\`\`ts
// BAD: reads once, right now — no retry
expect(await page.locator('#delayed-message').isVisible()).toBe(true);
expect(await page.locator('#review-feed .feed-item').count()).toBe(10);

// GOOD: retries until true
await expect(page.locator('#delayed-message')).toBeVisible();
await expect(page.locator('#review-feed .feed-item')).toHaveCount(10);
\`\`\`

\`isVisible()\`, \`textContent()\`, \`count()\`, \`inputValue()\` return the value **at that instant**. Wrapping them in \`expect(...)\` gives a plain (non-retrying) assertion. Rule of thumb: if you see \`expect(await\` on UI state, it is probably a flaky test. Keep plain \`expect(value)\` for values that are already final: a response status, a computed number, a string you built.

## The matchers you will use most

| Matcher | Checks |
|---|---|
| \`toBeVisible()\` / \`toBeHidden()\` | displayed or not (hidden also passes when the element does not exist) |
| \`toHaveText(t)\` / \`toContainText(t)\` | whole text / substring (string or RegExp; arrays for lists) |
| \`toHaveCount(n)\` | number of matched elements |
| \`toBeEnabled()\` / \`toBeDisabled()\` / \`toBeChecked()\` | state |
| \`toHaveValue(v)\` | input value |
| \`toHaveAttribute(name, v)\` / \`toHaveClass(c)\` | attributes |
| \`toHaveURL(u)\` / \`toHaveTitle(t)\` | page-level |

Negate with \`.not\`: \`await expect(locator).not.toBeVisible()\`. Soft assertions that do not stop the test: \`await expect.soft(locator).toHaveText(...)\`.

## Timeouts: change them locally

The section "Load more" on \`waits.html\` takes ~2 s per batch; another page might need 8 s. Give the slow assertion more time **on that line**:

\`\`\`ts
await page.getByRole('button', { name: 'Load more' }).click();
await expect(page.locator('#review-feed .feed-item')).toHaveCount(10, { timeout: 10_000 });
\`\`\`

| Timeout | Default | Where |
|---|---|---|
| Test (incl. hooks/fixtures) | 30 s | \`timeout\` in config, \`test.setTimeout()\` |
| Each \`expect\` | 5 s | \`expect: { timeout }\` in config, or \`{ timeout }\` per call |
| Each action | none (bounded by test) | \`use: { actionTimeout }\` |
| Navigation | none (bounded by test) | \`use: { navigationTimeout }\` |

Raising the global timeout to "fix" one slow screen hides real performance problems everywhere else.

## When you still need an explicit wait

Auto-waiting covers elements. For other things there are dedicated waits — all condition-based:

- \`page.waitForURL('**/checkout.html')\` — navigation that is not followed by an assertion
- \`page.waitForResponse(...)\` / \`waitForRequest\` — the network (see the *Dialogs, frames, tabs and network* lesson)
- \`page.waitForEvent('download' | 'popup' | ...)\`
- \`expect.poll(async () => fetchSomething()).toBe(...)\` and \`expect(async () => {...}).toPass()\` — retry any custom check

What you will **not** find in a good Playwright suite: \`page.waitForTimeout(…)\`. It exists for debugging; in a test it is a guess that is too long when the app is fast and too short when CI is slow.

## Reading a waiting failure

When an assertion times out, the error shows the expected value, the last received value and a call log:
\`Expected: "Completed"  Received: "Processing"  … 9 × locator resolved to <strong id="order-status">…\`
Received *Processing* tells you the app was still working — the wait was too short for this step, not that the locator was wrong.`,
  keyPoints: [
    'Actions auto-wait for attached, visible, stable, enabled and receives-events.',
    'await expect(locator).toX() retries; expect(await locator.value()) does not.',
    'Pick matchers that describe the user-visible outcome: toBeVisible, toHaveText, toHaveCount, toBeEnabled.',
    'Increase timeouts per assertion, not globally.',
    'Use waitForResponse / waitForURL / waitForEvent / expect.poll for non-element waits — never waitForTimeout.',
  ],
  mistakes: [
    'expect(await locator.isVisible()).toBe(true) — isVisible never waits; use await expect(locator).toBeVisible().',
    'Forgetting await before expect(locator)… — the assertion is never evaluated and the test passes.',
    'Adding waitForTimeout "for stability" — it hides the real condition and slows every run.',
    'Waiting for a spinner to appear before waiting for it to disappear — if it was quick you wait for nothing.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/waits.html\`, open DevTools → Console, click *Refresh prices* and watch the list being replaced by a spinner and re-rendered. Which matcher would you use to wait for the new list, and why would a Selenium WebElement captured before the click go stale while a Playwright locator does not?`,
  problems: ['pw-007', 'pw-008'],
}
