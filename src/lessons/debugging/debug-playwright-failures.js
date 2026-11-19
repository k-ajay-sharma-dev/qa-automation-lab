export default {
  slug: 'debug-playwright-failures',
  category: 'debugging',
  order: 9,
  title: 'Playwright failures: strict mode, missing await, timeouts and the trace viewer',
  minutes: 9,
  summary: 'Read Playwright errors the way the tool intends: fix strict-mode violations by narrowing locators, catch missing awaits, read the call log of a timeout, and use the trace viewer to see the page at the moment it failed.',
  manualAnalogy: `When a manual test fails you remember what the screen looked like — that memory is your best evidence. Playwright gives the automation the same memory: every error comes with a call log of what it tried, and a trace records the page before and after every step. Debugging Playwright is mostly learning to read those two things before touching the code.`,
  body: `## 1. Strict mode violation

\`\`\`text
Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Edit' }) resolved to 5 elements:
    1) <button type="button" data-emp-id="1" class="btn btn-sm btn-edit">Edit</button> aka ...
    2) <button type="button" data-emp-id="2" class="btn btn-sm btn-edit">Edit</button> aka ...
    ...and 3 more
\`\`\`

Actions and single-element assertions require **exactly one** match. Selenium would have silently used the first; Playwright refuses. The fix is never "add \`.first()\`" (that just re-introduces Selenium's silent guess). Narrow the locator the way a person would:

\`\`\`ts
const row = page.getByRole('row').filter({ hasText: 'Priya Sharma' });
await row.getByRole('button', { name: 'Edit' }).click();
\`\`\`

\`filter({ hasText })\` / \`filter({ has: locator })\` plus chaining searches *inside* the parent. The \`aka\` hints in the error are unique alternatives Playwright suggests. The match count is a clue too — an unexpected extra match often means an element you didn't know about (a banner, a hidden mobile menu).

## 2. Missing \`await\`

Every action and every web-first assertion returns a **Promise**. Forget \`await\` and the test continues without waiting:

| Symptom | Likely cause |
|---|---|
| Test passes in well under a second and stays green when the app is broken | An un-awaited \`expect(...)\` never checked anything |
| Values equal to the page's initial state (\`$0.00\`, empty text) | Read before an un-awaited click finished |
| \`Target page, context or browser has been closed\` | An action was still running when the test ended and the page was closed |

Scan for lines starting with \`page.\` or \`expect(\` without \`await\`, and let tooling do it for you: the ESLint rules \`@typescript-eslint/no-floating-promises\` and \`playwright/missing-playwright-await\`. And make every new test fail once on purpose — a test you have never seen fail may not be testing anything.

Also prefer **web-first assertions** (\`await expect(locator).toHaveText(...)\`) over reading a value and comparing it (\`expect(await locator.textContent()).toBe(...)\`): only the first one retries.

## 3. Timeouts: read the call log

A timeout is a symptom. The call log under the error says which **actionability check** never passed:

\`\`\`text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#claim-reward-btn')
    - locator resolved to <button disabled id="claim-reward-btn" ...>Claim reward</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
      - element is not enabled
\`\`\`

| Last call-log line | Look for |
|---|---|
| only \`waiting for …\` (never resolved) | Wrong locator, wrong page or URL, element inside an iframe |
| \`element is not visible\` | Hidden menu, viewport size, still loading |
| \`element is not enabled\` | A missing precondition (empty cart, invalid form) or simply still counting down |
| \`… intercepts pointer events\` | A modal, overlay or banner on top — the log names it |
| \`element is not stable\` | Animation |

If the element is in the right state *eventually* (like waits.html's countdown button), the default auto-wait handles it. If it never gets there, **raising the timeout is pointless** — find out why the state is wrong.

## 4. The trace viewer

Configure \`trace: 'on-first-retry'\` (or \`'retain-on-failure'\`) in \`playwright.config.ts\`, download \`trace.zip\` from the CI artifacts and open it:

\`\`\`text
npx playwright show-trace test-results/checkout-…-chromium/trace.zip
\`\`\`

What to look at, in order:
1. **Actions list** — which step failed and how long each took.
2. **Before / After snapshots** of the failing step and the step before it — a real DOM you can inspect: is the user logged in, is the list empty, is an overlay open?
3. **Console** and **Network** tabs — a JavaScript error or a failing request often explains an empty page.
4. **Source** — the exact test line.

## 5. State that didn't carry over

Reusing a login with \`storageState\` saves **cookies and localStorage** (optionally IndexedDB) — not sessionStorage, and nothing that lives only in memory. If a trace shows "guest" or an empty basket right after a setup step that clearly logged in, check where the app keeps its session before suspecting the app. Also keep test *data* (baskets, orders) inside the test itself rather than in a shared state file.`,
  keyPoints: [
    'Strict mode: narrow with filter/chaining or a test id — never silence it with `.first()`.',
    'Missing `await` produces green tests that check nothing and "context has been closed" errors.',
    'Prefer web-first assertions; `expect(value).toBe()` never retries.',
    'A timeout\'s call log names the failed check: not found, not visible, not enabled, intercepted.',
    'Open the trace: before/after snapshots show the real page state at the failing step.',
  ],
  mistakes: [
    'Adding `.first()`, `force: true` or a longer timeout instead of reading the error.',
    'Trusting a new test that has never been seen failing.',
    'Assuming `storageState` restores everything about a browser session.',
    'Using `page.waitForTimeout()` as a fix for a missing await.',
  ],
  tryIt: `Run \`npx playwright codegen http://localhost:5180/practice-site/table.html\`, hover over an "Edit" button and look at the locator codegen proposes. Then try \`page.getByRole('button', { name: 'Edit' }).click()\` in a spec and read the strict-mode error it produces — count the matches and read the \`aka\` suggestions.`,
  problems: ['dbg-018', 'dbg-021', 'dbg-026'],
}
