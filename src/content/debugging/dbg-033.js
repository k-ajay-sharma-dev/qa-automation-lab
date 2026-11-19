export default {
  id: 'dbg-033',
  category: 'debugging',
  kind: 'quiz',
  title: 'Playwright "intercepts pointer events" and "outside of the viewport": reading the actionability log',
  level: 'EXPERT',
  tags: ['playwright', 'typescript', 'actionability', 'force', 'overlay', 'viewport', 'call-log'],
  estMinutes: 15,
  scenario: `Your team migrated the ShopEasy alerts and navigation tests from Selenium to Playwright. Three tests now time out after 30 seconds. A developer already opened a PR that adds \`{ force: true }\` to every \`click()\` "because Playwright is too strict". You are the reviewer. Before approving, you read the call logs the way Playwright intended: as a step-by-step record of *why* it refused to click.`,
  description: `Playwright checks **actionability** before every click: attached, visible, stable (not animating), enabled, and **receives events** (nothing on top at the click point). The call log tells you which check kept failing. Use it to diagnose each case.`,
  hints: [
    'The last repeated line before "retrying click action" is the reason.',
    'force: true skips the checks — it does not remove the element that is in the way.',
  ],
  questions: [
    {
      q: `\`alerts.spec.ts\` — the test first checks the "Delete saved address" modal, then clicks the JS Alert button:

\`\`\`text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#js-alert-btn')
    - locator resolved to <button type="button" id="js-alert-btn" class="btn btn-primary" onclick="jsAlert()">Click for JS Alert</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div id="confirm-modal" class="modal-overlay">…</div> intercepts pointer events
  - retrying click action
  ... (repeated 58 times)
\`\`\`

What is the root cause?`,
      options: [
        'The JS Alert button is disabled',
        'The modal overlay #confirm-modal is still open from the earlier step and covers the page',
        'Playwright cannot click buttons with an onclick attribute',
        'The locator is not strict enough',
      ],
      answer: 1,
      why: 'The button passed visible/enabled/stable, but the hit-target check failed: the topmost element at the click point is the modal overlay. The earlier step opened the "Delete address?" dialog and never closed it (Cancel/Close/Yes). The fix belongs in the test flow: close the modal (e.g. click #modal-cancel) and `await expect(page.locator(\'#confirm-modal\')).toBeHidden()` before moving on — or split the two checks into independent tests.',
    },
    {
      q: `The PR "fixes" the test above with \`await page.locator('#js-alert-btn').click({ force: true })\`. What actually happens?`,
      options: [
        'The overlay is removed automatically and the alert opens',
        'Actionability checks are skipped and the mouse click lands on whatever is on top — the overlay — so on this page it closes the modal instead of opening the JS alert; the test then fails later or checks the wrong thing',
        'Nothing; force is ignored for buttons',
        'Playwright throws immediately with "force is not allowed"',
      ],
      answer: 1,
      why: 'force: true only disables the checks; Playwright still performs a real mouse click at the element\'s coordinates, and the browser delivers it to the topmost element. On alerts.html a click on the overlay background closes the dialog ("Dialog closed"), so the JS alert never appears. Worse than a timeout: a misleading failure, or a false pass if the assertion is weak. Reject the PR — force is for rare cases like a custom checkbox whose real input is visually hidden.',
    },
    {
      q: `On the mobile project (\`viewport: 375x812\`) a navigation test fails:

\`\`\`text
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - element is outside of the viewport
  - retrying click action
\`\`\`

Which explanation fits best?`,
      options: [
        'Playwright does not scroll automatically; add page.mouse.wheel(0, 500) before the click',
        'The element is positioned where scrolling cannot reach it — typically an off-canvas mobile menu (pushed off-screen with a transform) that must be opened first, or an element clipped by an overflow:hidden container',
        'The device has no mouse, so clicks are impossible on mobile',
        'The test needs a longer timeout',
      ],
      answer: 1,
      why: 'Playwright already scrolled ("done scrolling"); the element is still outside the visible area, so scrolling cannot reach it. On small viewports that usually means the user must first open the hamburger/off-canvas menu, or the layout clips the element. Follow the user journey for that viewport (open the menu), or report a responsive layout bug if a user also cannot reach it. Longer timeouts just make it fail slower.',
    },
    {
      q: `Which change is the **best** general fix when an overlay (spinner, modal, toast) intercepts pointer events?`,
      options: [
        'Add await page.waitForTimeout(3000) before every click',
        'Use { force: true } on every click',
        'Make the test wait for the real condition — e.g. await expect(page.locator(\'#confirm-modal\')).toBeHidden() — or perform the user step that closes the overlay',
        'Use page.evaluate(() => document.getElementById(\'js-alert-btn\').click())',
      ],
      answer: 2,
      why: 'Web-first assertions wait for a condition and retry, so they are fast when the app is fast and patient when it is slow. Fixed sleeps are slow and still flaky; force and a DOM click via evaluate both bypass what a real user experiences — the evaluate version even triggers the handler while the modal is visibly blocking the page, hiding a possible bug.',
    },
    {
      q: `In the old Selenium version of this test, what was the equivalent of Playwright's "intercepts pointer events" message?`,
      options: [
        'StaleElementReferenceException',
        'ElementClickInterceptedException: element click intercepted: Element <button id="js-alert-btn"> is not clickable at point (x, y). Other element would receive the click: <div id="confirm-modal" class="modal-overlay">',
        'NoSuchElementException',
        'InvalidSelectorException',
      ],
      answer: 1,
      why: 'Same root cause, different wording: Selenium tells you "Other element would receive the click" and fails immediately, while Playwright retries until the timeout and records each attempt in the call log. In both tools the message names the blocking element — read it, then fix the flow or wait for that element to disappear.',
    },
  ],
  explanation: `**Playwright's call log is a diagnosis, not noise.** Before a click it checks, in order: the element is attached, **visible**, **stable** (not animating), **enabled**, and **receives events** (it is the topmost element at the click point). It retries until the test timeout and logs every attempt. The repeated line just before "retrying click action" is your root cause:

| Log line | Meaning | Typical fix |
|---|---|---|
| \`<…> intercepts pointer events\` | Something covers the element (modal, spinner, cookie bar, sticky header) | Close/wait for the overlay: \`expect(overlay).toBeHidden()\` |
| \`element is outside of the viewport\` | Scrolling cannot reach it (off-canvas menu, clipped container) | Do the user step that reveals it; check the responsive layout |
| \`element is not visible\` | Hidden or zero-size | Perform the step that shows it |
| \`element is not stable\` | Still animating | Usually resolves itself; check for endless animations |
| \`element is not enabled\` | Disabled button | Fill the required fields first |

**\`{ force: true }\` is not a fix.** It skips the checks but still clicks at the coordinates, so the covering element gets the click. It turns a clear timeout into a confusing failure — or a false pass. Accept it only with a comment explaining a genuine case (e.g. a styled checkbox whose real input is transparent).

As a reviewer, the question is always: *"Could a real user click this right now?"* If not, the test is missing a step — or you have found a bug.`,
  mistakes: [
    'Adding force: true to silence actionability errors.',
    'Increasing the timeout when the log shows the same blocker on every retry.',
    'Leaving a modal or dialog open at the end of a step so the next step is blocked.',
    'Clicking via page.evaluate / element.click() in the DOM, which bypasses visibility and overlays.',
  ],
  interview: [
    { q: 'What are Playwright\'s actionability checks?', a: 'Before a click Playwright waits until the element is attached, visible, stable, enabled and actually receives pointer events at the click point. It retries until the timeout and writes each attempt to the call log, so when a click fails I read the last repeated line to see which check failed — for example which element intercepts pointer events.' },
    { q: 'When would you use force: true?', a: 'Very rarely — for example a custom-styled checkbox or file input where the real element is intentionally transparent and the user clicks the label. I add a comment explaining why. I never use it to get past an overlay, because the click lands on the overlay anyway and the test stops reflecting real user behaviour.' },
    { q: 'How does this compare to Selenium?', a: 'Selenium throws ElementClickInterceptedException immediately and names the other element that would receive the click, so you add an explicit wait yourself. Playwright has auto-waiting built in and retries, so the same problem shows up as a timeout with a detailed call log.' },
  ],
}
