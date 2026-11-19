export default {
  id: 'loc-036',
  category: 'locators',
  kind: 'quiz',
  title: '"It works in DevTools!" — why a correct locator still fails in the test',
  level: 'EXPERT',
  tags: ['iframe', 'timing', 'stale-element', 'hidden-elements', 'troubleshooting'],
  estMinutes: 15,
  scenario: `It is the week before release and four ShopEasy tests fail in CI. In every case the author says the same thing: "I pasted the
locator into DevTools and it found the element — Selenium is broken." You are the SDET who triages locator failures. For each case, find the
real reason and the right fix — the locator syntax itself is fine every time.`,
  description: `Each question describes a failing step on the ShopEasy practice site. Pick the root cause and fix.`,
  hints: [
    'DevTools runs your selector in whatever document and at whatever moment you are looking at. The test runs it in the current frame, at the moment of the call.',
    'Think about: which document (frame), when (rendering/timing), which copy (hidden duplicates), and whether the element was replaced (stale).',
  ],
  questions: [
    {
      q: 'On frames.html the step `driver.findElement(By.id("support-name")).sendKeys("Asha")` throws **NoSuchElementException**. In DevTools, `$$("#support-name")` returns 1 element when you inspect the field. Why?',
      options: [
        'The id is dynamic and changes on every load',
        'The field is inside `<iframe id="support-frame">` (frame-content.html). Inspecting it switches the DevTools console into that frame; the driver is still in the top document. Fix: `driver.switchTo().frame("support-frame")`, then find, then `switchTo().defaultContent()`',
        'sendKeys does not work on text inputs in Chrome',
        'The locator needs to be an XPath to search inside frames',
      ],
      answer: 1,
      why: 'Each iframe is a separate document; locators never cross frame boundaries, in CSS or XPath. DevTools quietly changes its console context when you inspect an element inside a frame (see the context dropdown at the top of the Console), which is why it "works there". In Playwright you would use `page.frameLocator(\'#support-frame\').locator(\'#support-name\')`.',
    },
    {
      q: 'On table.html, `driver.findElements(By.cssSelector("#employee-table tbody tr"))` sometimes returns **0** rows in CI, but 5 rows locally and in DevTools. The rows are created by a script (`tbody.innerHTML = \'\'` then `appendChild`). Best fix?',
      options: [
        'Add Thread.sleep(3000) before the call',
        'Increase the implicit wait — findElements always waits until it finds 5',
        'Wait explicitly for the data: `wait.until(ExpectedConditions.numberOfElementsToBeMoreThan(rows, 0))` (or for the "Showing 1–5 of 15 employees" text) before reading rows',
        'Switch to XPath, which waits for JavaScript',
      ],
      answer: 2,
      why: '`findElements` returns immediately with whatever exists — an empty list is a valid answer, so it does not fail and (with an implicit wait) only waits until at least one element appears. On a slower CI agent the script may not have rendered yet. An explicit wait for a condition that proves the data is ready is fast and deterministic. Sleeps are slow and still flaky; locator language has nothing to do with timing.',
    },
    {
      q: 'Still on table.html: the test stores `WebElement firstEdit = driver.findElement(By.cssSelector(".btn-edit"))`, then clicks the **Salary** header to sort, then calls `firstEdit.click()` → **StaleElementReferenceException**. Why?',
      options: [
        'Sorting re-renders the table body (`tbody.innerHTML = \'\'` + new rows), so the stored element was removed from the DOM; the new Edit button is a different element. Re-locate after the action (keep `By` locators in the page object, not stored WebElements)',
        'The click was too fast; add a retry loop of 10 clicks',
        '.btn-edit is not unique, which causes stale errors',
        'The browser cached the old page',
      ],
      answer: 0,
      why: 'A WebElement is a reference to one specific DOM node. When the page replaces nodes (sorting, paging, searching, React re-renders), old references go stale even though an identical-looking button exists. Page objects that store `By` and find on demand avoid it; after a re-render, wait for the new state and look up again. Blind retries hide the real cause.',
    },
    {
      q: 'On checkout.html a test fills step 1 and then reads `driver.findElement(By.cssSelector(".title")).getText()` expecting "Checkout: Overview" — but gets "Checkout: Your Information". DevTools shows `$$(".title")` returns 2 elements. What happened?',
      options: [
        'The overview did not load, so the test found a real bug',
        'All three steps live in the same HTML; step 1 is hidden with the `hidden` class but still in the DOM and comes first, so findElement returns its title. Scope to the step: `#checkout-step-two .title`, and wait for that section to be visible',
        'getText() caches the previous value',
        'CSS cannot select h1 elements; use XPath',
      ],
      answer: 1,
      why: 'Hidden is not absent. findElement returns the first match in document order — visible or not. Scoping to the container (`#checkout-step-two`) makes the locator unique and the test intention explicit. A quick `$$()` count in DevTools before trusting a locator catches this every time.',
    },
    {
      q: 'Your team wants to stop these "works in DevTools" arguments. Which practice helps most?',
      options: [
        'Only allow XPath copied from DevTools',
        'Wrap every findElement in try/catch and return null',
        'Locator checklist in code review: count matches with $$/$x, note the frame, identify what renders the element and wait for it, scope to a container, store By not WebElement. On failure, capture a screenshot + page source of the frame the driver was in',
        'Increase all timeouts to 60 seconds',
      ],
      answer: 2,
      why: 'The four failures had four different causes — frame, timing, staleness, hidden duplicate — and none was the locator syntax. A checklist plus good failure artefacts (screenshot and the page source the driver actually saw) turns "Selenium is broken" into a five-minute diagnosis. Swallowing exceptions and huge timeouts only hide and slow down the problems.',
    },
  ],
  explanation: `When a locator "works in DevTools" but not in the test, ask four questions:

| Question | Symptom | Fix |
|---|---|---|
| **Which document?** | NoSuchElement, element is inside an \`<iframe>\` | \`switchTo().frame(...)\`, then \`defaultContent()\`; Playwright \`frameLocator\` |
| **When?** | 0 elements / NoSuchElement only on slow machines | Explicit wait for a condition proving the content is rendered |
| **Same node?** | StaleElementReferenceException after sort/page/search | Store \`By\`, re-locate after the re-render |
| **Which copy?** | Wrong text or "element not interactable" | Hidden duplicates are still in the DOM — check counts, scope to the visible container |

DevTools is the right place to *design* a locator, but it runs in the document you selected, after the page has fully rendered. A test runs
in the current frame, at one precise moment, with references that may be outdated. Debug with the driver's view: screenshot,
\`driver.getPageSource()\` and the current frame.`,
  mistakes: [
    'Blaming the locator syntax and rewriting CSS into XPath (or the other way round) — it never fixes frame or timing problems.',
    'Adding Thread.sleep to "fix" rendering timing.',
    'Storing WebElements in fields and reusing them after the page re-renders.',
    'Assuming hidden elements are not found by findElement.',
  ],
  interview: [
    {
      q: 'Your locator works in DevTools but Selenium throws NoSuchElementException. How do you troubleshoot?',
      a: 'I check four things: is the element inside an iframe (switch to it), is it rendered later by JavaScript (explicit wait), is the locator unique or does it match a hidden copy first (count with $$), and was the element replaced by a re-render (re-locate). I look at the screenshot and page source captured at failure to see what the driver actually saw.',
    },
    {
      q: 'What causes StaleElementReferenceException and how do you avoid it?',
      a: 'The element reference points to a DOM node that has been removed or replaced — after a sort, page change, or framework re-render. Keep By locators in page objects and look elements up when needed, and wait for the new state after actions that re-render.',
    },
    {
      q: 'Does findElements wait like findElement?',
      a: 'With an implicit wait it waits until at least one element is found or the timeout ends, then returns an empty list without an exception. It never waits for a specific number of elements, so for "5 rows loaded" you need an explicit wait.',
    },
  ],
}
