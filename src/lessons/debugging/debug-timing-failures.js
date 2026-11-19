export default {
  slug: 'debug-timing-failures',
  category: 'debugging',
  order: 3,
  title: 'Timing failures: NoSuchElement, click intercepted, stale elements and slow suites',
  minutes: 9,
  summary: 'Recognise the four timing signatures in a log — too early, covered, re-rendered, and mixed waits — and fix each with the right wait instead of sleeps and retries.',
  manualAnalogy: `When you test by hand you never click while the spinner is still spinning — you naturally wait. A script doesn't. It acts the instant the previous line finishes, and on a fast laptop that usually works, while on a busy CI agent it doesn't. Most "it passes locally, fails on Jenkins" tickets are timing, and each kind leaves a recognisable fingerprint in the log.`,
  body: `## The debugging question

For every timing failure ask: **what was the user waiting for at this moment?** The fix is to wait for *that* — never for a fixed number of seconds. (The *Explicit and fluent waits* lesson in the Selenium section covers the API.)

## Signature 1 — "too early": \`NoSuchElementException\`

\`\`\`text
org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element:
{"method":"css selector","selector":"#summary-total"}
	at com.shopeasy.pages.OverviewPage.total(OverviewPage.java:19)
\`\`\`

Check, in this order:

1. **Is the locator right?** Paste it into DevTools (Ctrl+F in Elements) on the same page. 0 matches → locator bug, not timing.
2. **Is it in an iframe or another window?** → context bug (see the *Context failures* lesson). A wait won't help.
3. **Does it appear a moment later?** (loaded by JavaScript, after a click, after navigation) → timing. Wait for the condition that matches the user's view: \`visibilityOfElementLocated\`, or \`elementToBeClickable\` when you are going to click it.

Clue in the header: a very short \`Time elapsed\` (2–3 s) with no wait in the trace means the code never waited at all.

## Signature 2 — "covered": \`ElementClickInterceptedException\`

\`\`\`text
element click intercepted: Element <button id="continue" ...> is not clickable at point (640, 512).
Other element would receive the click: <div class="cookie-banner">...</div>
\`\`\`

The element **was** found. Something else was on top of it at that pixel. The message tells you *who*:

| Blocker in the message | Fix |
|---|---|
| Spinner / loading overlay | Wait for it to become **invisible**, then wait until the target is clickable |
| Sticky header / footer | Scroll the target to the centre, then click |
| Cookie banner / modal | Close it as a deliberate test step (or set the consent cookie in setup) |

A JavaScript click "fixes" all three by ignoring the blocker — which also hides real usability bugs. Use it only as a logged last resort.

## Signature 3 — "re-rendered": \`StaleElementReferenceException\`

\`\`\`text
org.openqa.selenium.StaleElementReferenceException: stale element reference: stale element not found
Element: [[ChromeDriver: chrome on linux (...)] -> css selector: .price-row]
\`\`\`

The element was found, then the page **replaced** it (React/Angular re-render, list refresh, AJAX update). The \`Element:\` line shows the locator it was originally found with — that's the one to re-find. Typical cause in code: a \`List<WebElement>\` captured once, then a loop that clicks and changes the list.

Fix pattern:

- Keep the \`By\`, re-locate inside the loop (or loop "while elements still exist" and always take the first one).
- After each action that re-renders, wait for **proof** it finished: the count changed (\`numberOfElementsToBe\`), the old node is gone (\`stalenessOf\`), a counter shows the new value (\`textToBe\`).

Don't wrap it in \`catch (Exception e) { sleep; retry }\`.

### Tables that sort, filter and page

Data tables are the most common stale trap. On many sites (including the ShopEasy waits.html price list) a sort click, each letter typed into a search box, or a pager click **rebuilds the rows from scratch**. A test that does *find rows → click "sort" → read rows* reads rows that no longer exist. Turn the order around: *act → wait for proof (the header's \`aria-sort\` changed, an old row is stale, the "Showing … of …" counter changed) → find the rows → read them*. Keep a helper that always finds the cells fresh rather than a field holding them.

## Signature 4 — "the wait took longer than its timeout": mixed waits

\`\`\`text
[ERROR] guestCannotCheckout(...)  Time elapsed: 42.7 s  <<< ERROR!
TimeoutException: ... (tried for 10 second(s) with 500 milliseconds interval)
\`\`\`

A 10-second wait inside a 42-second test, and a suite that takes 40 minutes instead of 8. Search the framework for \`implicitlyWait\`. An **implicit wait** makes every \`findElement\` retry for N seconds; when an explicit wait polls, each poll can sit on that implicit wait, so timeouts stretch unpredictably. It also makes every "is it absent?" check (\`findElements(...).isEmpty()\`) wait the full implicit time before returning an empty list.

Fix: set the implicit wait to \`Duration.ZERO\` (or remove it) and use explicit waits only. For **absence** checks use \`invisibilityOfElementLocated\` or a zero-implicit \`findElements\`, which return immediately once the element is gone.

## Telling timing from a real bug

Timing failures **pass sometimes** and the screenshot shows a page that is *not finished yet* (spinner, empty list, half-drawn table). A product bug fails the same way every time and the screenshot shows a *finished* but wrong page. If the screenshot shows an error message, no wait will fix it.

## Never "fix" timing with

- \`Thread.sleep\` — slow when the page is fast, still flaky when it is slow.
- Raising every timeout to 60 s — failures take longer to report and real hangs are hidden.
- Automatic retries — the test goes green, the race condition stays.`,
  keyPoints: [
    'Ask "what was the user waiting for?" and wait for exactly that condition.',
    'NoSuchElement: verify locator and context first; only then it is timing.',
    'Click intercepted: the message names the blocker — wait for it to go, or scroll to centre.',
    'Stale: re-locate from the `By` and wait for proof the re-render finished.',
    'Test time much longer than the wait timeout = implicit and explicit waits mixed; set implicit to zero.',
  ],
  mistakes: [
    'Adding `Thread.sleep(5000)` and calling it fixed.',
    'Using a JS click to get past an overlay — the test passes while real users are blocked.',
    'Changing a correct locator because of a timing problem.',
    'Keeping an implicit wait "as a safety net" alongside explicit waits.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/waits.html\` open DevTools → Performance, record, click "Load orders" and stop. Find the moment the spinner disappears and the result appears — that gap is exactly what an unsynchronised script falls into.`,
  problems: ['dbg-001', 'dbg-002', 'dbg-003', 'dbg-008', 'dbg-016', 'dbg-028'],
}
