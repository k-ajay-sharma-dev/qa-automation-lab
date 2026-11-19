export default {
  slug: 'selenium-waits',
  category: 'selenium',
  order: 5,
  title: 'Explicit and fluent waits (and why not Thread.sleep)',
  minutes: 10,
  summary: 'Synchronise tests with the application using WebDriverWait, the right ExpectedCondition and FluentWait with a custom condition — no sleeps, no mixed waits.',
  manualAnalogy: `When you test by hand you naturally wait: you click "Load", watch the spinner, and only when the data appears do you check it. You don't count to five — you wait *for something*. Automation must do the same, because a script is much faster than a person and will happily click a button that hasn't appeared yet.`,
  body: `## The problem: the script is faster than the page

\`driver.get()\` waits for the page load event, but after that JavaScript keeps working: data arrives, spinners come and go, buttons get enabled. If the script looks too early you get \`NoSuchElementException\`, \`ElementClickInterceptedException\` or a wrong value — a "flaky" test that passes on your laptop and fails on Jenkins.

## Three kinds of waiting

| Wait | How it works | Verdict |
|---|---|---|
| \`Thread.sleep(3000)\` | Always pauses 3 s, then hopes | Too slow when the page is fast, too short when it is slow. Avoid. |
| Implicit wait | Every \`findElement\` retries for up to N seconds | Only knows "element exists". Slows down "is it absent?" checks. |
| **Explicit wait** | Polls a specific condition, returns as soon as it is true | The professional default. |

> Do **not** mix implicit and explicit waits. Each poll of the explicit wait can sit on the implicit timeout, so a "10-second" wait can take 30+ seconds. Keep the implicit wait at zero and use explicit waits everywhere.

## WebDriverWait, line by line

\`\`\`java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

driver.findElement(By.id("show-message-btn")).click();             // waits.html
WebElement msg = wait.until(
        ExpectedConditions.visibilityOfElementLocated(By.id("delayed-message")));
Assert.assertTrue(msg.getText().contains("WAIT4IT"));
\`\`\`

- \`new WebDriverWait(driver, Duration.ofSeconds(10))\` — the **maximum** time. It checks every 500 ms and returns the moment the condition is true; if the message shows after 2 s, the wait lasts ~2 s.
- \`until(...)\` returns something useful — here the visible \`WebElement\` — so you don't need to find it again.
- On timeout it throws \`TimeoutException\` with a readable message: *"waiting for visibility of element located by By.id: delayed-message (tried for 10 second(s)…)"*.

## Pick the condition that matches what the user waits for

| Situation | Condition |
|---|---|
| Element added to the page later (may be hidden) | \`presenceOfElementLocated\` |
| Element must be on screen | \`visibilityOfElementLocated\` |
| Spinner / overlay must disappear | \`invisibilityOfElementLocated\` |
| Button starts disabled, gets enabled later | \`elementToBeClickable\` (= visible **and** enabled) |
| Text changes over time | \`textToBePresentInElementLocated\`, \`textToBe\` |
| Count of items grows | \`numberOfElementsToBe\`, \`numberOfElementsToBeMoreThan\` |
| Browser pop-up, new tab, iframe | \`alertIsPresent\`, \`numberOfWindowsToBe\`, \`frameToBeAvailableAndSwitchToIt\` |

**Presence vs visibility:** presence = it exists in the HTML (it may be \`display:none\`); visibility = exists *and* is displayed with a size. Clicking or reading text needs visibility.

A typical "load then read" flow is two waits: first for the spinner to go away, then for the result to be visible. Waiting only for the result is often fine; waiting only for the spinner is not (the result might render a moment later).

### The "false before, true after" test

Before you write a wait, ask: *is this condition already true before the event?* If yes, the wait returns instantly and the test is flaky. "Claim reward" is **visible** from the first second (it is only disabled), so \`visibilityOf\` proves nothing — \`elementToBeClickable\` does. The order status is visible the whole time — wait for the **new text** instead.

### Counts, attributes and things that go away

\`\`\`java
By rows = By.cssSelector("#employee-table tbody tr");                          // table.html
driver.findElement(By.id("table-search")).sendKeys("Sales");
wait.until(ExpectedConditions.numberOfElementsToBe(rows, 2));                   // exact count
By nameHeader = By.cssSelector("th[data-sort='name']");
driver.findElement(nameHeader).click();                                          // sort by name
wait.until(ExpectedConditions.attributeToBe(nameHeader, "aria-sort", "ascending"));
wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("loading-spinner")));
\`\`\`

- \`numberOfElementsToBe\` waits for an exact count; \`numberOfElementsToBeMoreThan\` for "the list grew".
- \`attributeToBe\` / \`attributeContains\` wait for a value or a CSS class (\`class\` contains \`hidden\`, \`aria-expanded\` is \`true\`).
- \`invisibilityOfElementLocated\` is true when the element is hidden **or missing** — great for spinners, but it also passes *before* a spinner has appeared.
- \`stalenessOf(oldElement)\` is true once an element you hold has been removed — proof that a list was rebuilt.

## FluentWait: full control

\`WebDriverWait\` is actually a pre-configured \`FluentWait\`. Use \`FluentWait\` directly when you need a different polling interval, specific exceptions to ignore, or a condition that no \`ExpectedConditions\` method covers.

\`\`\`java
Wait<WebDriver> fluent = new FluentWait<>(driver)
        .withTimeout(Duration.ofSeconds(30))
        .pollingEvery(Duration.ofSeconds(1))
        .ignoring(NoSuchElementException.class)
        .withMessage("Review feed never reached 10 reviews");

Integer count = fluent.until(d -> {
    int n = d.findElements(By.cssSelector("#review-feed .feed-item")).size();
    return n >= 10 ? n : null;     // null/false = keep polling
});
\`\`\`

- The \`d -> { ... }\` part is a **lambda**: a small function Selenium calls on every poll, passing in the driver.
- Return \`null\` or \`false\` to say "not yet"; return anything else to stop and hand that value back to the test.
- \`ignoring(...)\` / \`ignoreAll(List.of(...))\` swallow exceptions *during* polling — for example \`StaleElementReferenceException\` when the element is being redrawn.
- Re-find elements **inside** the lambda. A \`WebElement\` captured outside goes stale when the page redraws it; a fresh \`findElement\` on every poll never does.

## Reuse one wait

Create the \`WebDriverWait\` once (in the page object or base test) and reuse it; creating a new one per line adds noise, not reliability.`,
  keyPoints: [
    'Explicit waits poll a condition and return as soon as it is true — fast and reliable.',
    'Choose the condition that matches the user\'s wait: visible, invisible, clickable, text, count, attribute.',
    'A good condition is false before the event and true only after it.',
    '`until()` returns the element/value — use it directly.',
    'Never mix implicit and explicit waits; set implicit to zero.',
    'FluentWait = custom timeout, polling, ignored exceptions and a lambda condition; re-find elements inside the lambda.',
  ],
  mistakes: [
    'Adding `Thread.sleep` "just to be safe" — it makes the suite slow and still flaky.',
    'Waiting for presence when you need to click — the element may exist but be hidden. Use visibility or clickable.',
    'Keeping an implicit wait of 10–20 s alongside explicit waits — timeouts multiply and absence checks crawl.',
    'Catching a `WebElement` outside a FluentWait lambda and reusing it — it goes stale on re-render.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/waits.html\` reload and watch section 1: a banner is *added* about 4 s after load. Decide which condition you would use for it, and which you would use for section 2's hidden message. Why are they different?`,
  problems: ['sel-006', 'sel-007', 'sel-008', 'sel-026', 'sel-027', 'sel-035', 'sel-036', 'sel-041', 'sel-042'],
}
