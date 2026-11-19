export default {
  id: 'sel-027',
  category: 'selenium',
  kind: 'quiz',
  title: 'Pick the right ExpectedCondition for six real situations',
  level: 'INTERMEDIATE',
  tags: ['waits', 'ExpectedConditions', 'flaky'],
  estMinutes: 12,
  scenario: `You are reviewing a colleague's pull request that adds 30 new waits. Every one of them compiles, and most "work" on a fast laptop — but a wait on the wrong condition either returns too early (flaky) or never returns (timeout). Your lead asks you to check the six that touch \`waits.html\` and \`table.html\` before merging.`,
  description: `For each situation pick the condition that waits for **exactly** what the user waits for. All locators are real ShopEasy ids.`,
  hints: [
    'Ask: what is true *before* the event, and what becomes true *only after* it? Wait for the second thing.',
    'A condition that is already true before the click returns instantly — that is the classic flaky wait.',
  ],
  questions: [
    {
      q: '`waits.html`: "Claim reward" (`#claim-reward-btn`) is on screen from the start but **disabled** for 5 seconds. You want to click it as soon as it works. Which wait?',
      options: [
        'visibilityOfElementLocated(By.id("claim-reward-btn"))',
        'presenceOfElementLocated(By.id("claim-reward-btn"))',
        'elementToBeClickable(By.id("claim-reward-btn"))',
        'textToBePresentInElementLocated(By.id("claim-reward-btn"), "Claim reward")',
      ],
      answer: 2,
      why: 'The button is present, visible and has its text from the very first millisecond, so the other three return immediately and the click lands on a disabled button (silently ignored). `elementToBeClickable` = visible **and** enabled — the only one that changes after 5 seconds.',
    },
    {
      q: '`waits.html`: after "Place order", `#order-status` goes "Pending" → "Processing" → "Completed". Your assertion needs the final state. Which wait?',
      options: [
        'visibilityOfElementLocated(By.id("order-status"))',
        'textToBe(By.id("order-status"), "Completed")',
        'textToBePresentInElementLocated(By.id("order-status"), "Pending")',
        'stalenessOf(driver.findElement(By.id("order-status")))',
      ],
      answer: 1,
      why: 'The status element is visible all the time ("Not started"), so visibility returns at once. Waiting for "Pending" stops at the first step. The element is updated in place, not replaced, so it never goes stale and that wait would time out. `textToBe` waits for the exact final text.',
    },
    {
      q: '`waits.html`: you click "Load more" once and must assert **exactly** 10 reviews (`#review-feed .feed-item`). Which wait?',
      options: [
        'visibilityOfAllElementsLocatedBy(By.cssSelector("#review-feed .feed-item"))',
        'presenceOfAllElementsLocatedBy(By.cssSelector("#review-feed .feed-item"))',
        'numberOfElementsToBe(By.cssSelector("#review-feed .feed-item"), 10)',
        'invisibilityOfElementLocated(By.id("load-more-btn"))',
      ],
      answer: 2,
      why: 'The first 5 reviews are already visible, so both "all elements" waits return instantly with 5 items. The button only disappears after the *third* batch, so that wait would time out after one click. `numberOfElementsToBe(…, 10)` waits for the new batch.',
    },
    {
      q: `\`waits.html\`: "Refresh prices" throws away \`#price-list\` and builds a new one ~1 second later. You already hold the old first row:

\`\`\`java
WebElement oldRow = driver.findElement(By.cssSelector("#price-list .price-row"));
driver.findElement(By.id("refresh-prices-btn")).click();
\`\`\`

What proves the list was rebuilt before you read the new prices?`,
      options: [
        'wait.until(ExpectedConditions.stalenessOf(oldRow))',
        'wait.until(ExpectedConditions.visibilityOf(oldRow))',
        'wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("#price-list .price-row")))',
        'wait.until(ExpectedConditions.elementToBeClickable(By.id("refresh-prices-btn")))',
      ],
      answer: 0,
      why: '`stalenessOf(oldRow)` becomes true only when the old node is detached — the first half of the re-render. Then wait for the new rows (e.g. `visibilityOfAllElementsLocatedBy`) and read them. The other options are already true *before* the refresh happens, so they return instantly and you read old prices.',
    },
    {
      q: '`table.html`: you type `Finance` into `#table-search`. Two employees match. The counter `#row-count` reads "Showing 1–5 of 15 employees" before the filter. Which wait shows the filter has run?',
      options: [
        'visibilityOfElementLocated(By.id("employee-table"))',
        'textToBePresentInElementLocated(By.id("row-count"), "of 2 employees")',
        'elementToBeClickable(By.id("table-search"))',
        'presenceOfElementLocated(By.cssSelector("#employee-table tbody tr"))',
      ],
      answer: 1,
      why: 'The table, the search box and rows are all there before and after filtering, so those waits prove nothing. The counter text changes **only** when the filter has re-rendered the table — a perfect "proof of update" signal.',
    },
    {
      q: '`windows.html`: "Open terms + privacy" (`#open-two-btn`) opens **two** new tabs at once (`new-window.html?page=terms` and `?page=privacy`). The driver stays on the original tab. Before looping over `getWindowHandles()`, which wait is right?',
      options: [
        'numberOfWindowsToBe(2)',
        'numberOfWindowsToBe(3)',
        'urlContains("privacy")',
        'titleContains("Size Guide")',
      ],
      answer: 1,
      why: 'Original tab + 2 new tabs = 3 windows. `numberOfWindowsToBe(2)` can return after the first tab opens, so your loop misses the second one. `urlContains` and `titleContains` look at the **current** window, which is still the original tab — the driver never switches by itself — so both would time out.',
    },
  ],
  explanation: `A good wait is **false before** the event and **true only after** it. Run that test on every condition you write:

| Situation | False before, true after |
|---|---|
| Disabled → enabled button | \`elementToBeClickable\` |
| Text changes in place | \`textToBe\` / \`textToBePresentInElementLocated\` with the *new* text |
| List grows | \`numberOfElementsToBe\` / \`numberOfElementsToBeMoreThan\` |
| Element replaced (re-render) | \`stalenessOf(oldElement)\`, then wait for the new one |
| Filter / search applied | a counter or summary text that only changes after the update |
| New tabs opened | \`numberOfWindowsToBe(original + new)\` — then switch |
| Spinner / overlay leaves | \`invisibilityOfElementLocated\` (also true when the element is missing!) |

If a condition is already true before you click, the wait returns instantly and the test is flaky. If it can never become true (waiting for staleness on an element that is updated in place), the test times out.`,
  interview: [
    { q: 'How do you pick a wait condition?', a: 'Find something that is false before the event and becomes true only after it — a new count, new text, an enabled state, an old element going stale. Waiting for something that is already true makes the wait return instantly.' },
    { q: 'What is the difference between textToBe and textToBePresentInElementLocated?', a: 'textToBe waits for the element text to equal the value exactly; textToBePresentInElementLocated waits for the text to contain it. Use the exact one for final states, contains for long messages.' },
    { q: 'Why can invisibilityOfElementLocated return immediately by mistake?', a: 'Because it is true when the element is not present at all. If you check it before the spinner even appears, it passes at once. Wait for the spinner to show first, or wait for the result instead.' },
  ],
}
