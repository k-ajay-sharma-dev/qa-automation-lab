export default {
  slug: 'selenium-exceptions',
  category: 'selenium',
  order: 8,
  title: 'Selenium exceptions: what each one means and the right fix',
  minutes: 8,
  summary: 'Recognise the common Selenium exceptions from their name and message, know which question each one answers, and fix stale elements properly instead of retrying blindly.',
  manualAnalogy: `When a manual test fails you don't just write "it didn't work" — you note *what* you saw: the button was missing, the button was greyed out, a pop-up covered it, the page reloaded under you. Selenium exceptions are those same observations, already classified for you. Read the name first and you know which kind of problem you have.`,
  body: `## Three questions that sort almost every exception

1. **Was the element never found?** → wrong locator, wrong context (iframe/window), or too early.
2. **Was it found but unusable?** → hidden, covered, disabled, off-screen, duplicate match.
3. **Was it found and then lost?** → the page re-rendered it (stale).

## The cheat sheet

| Exception | Plain meaning | Usual fix |
|---|---|---|
| \`NoSuchElementException\` | Nothing matched in the current context | Check locator in DevTools; check iframe/window; add an explicit wait |
| \`TimeoutException\` | A wait's condition never became true | Read the condition in the message and look at the screenshot — the app may be showing an error |
| \`ElementClickInterceptedException\` | Found it, but another element would get the click | Wait for overlay to disappear / scroll to centre (message names the blocker) |
| \`ElementNotInteractableException\` | Found it, but it is hidden or has no size | Is the locator matching a hidden duplicate (e.g. mobile menu)? Wrong window size? |
| \`StaleElementReferenceException\` | The element you held was removed from the page | Re-locate it after the DOM update; don't keep old references |
| \`NoAlertPresentException\` | You switched to an alert that isn't there (yet) | \`wait.until(alertIsPresent())\` |
| \`UnhandledAlertException\` | An alert is open and blocks other commands | Accept/dismiss it first |
| \`NoSuchFrameException\` / \`NoSuchWindowException\` | Wrong frame / the window is gone | Switch correctly; after \`close()\` switch back |
| \`NoSuchSessionException\` | The driver was already quit | Lifecycle bug — often a shared driver in parallel runs |
| \`SessionNotCreatedException\` | Browser couldn't start | Environment: driver/browser versions, sandbox flags |

The **message** after the name is often specific enough to fix the bug without debugging: "Other element would receive the click: \`<div class="loading-overlay">\`" literally names the culprit.

## StaleElementReferenceException, properly

A \`WebElement\` is not "the Add-to-cart button". It is a pointer to **one specific node** in the page at the moment you found it. Frameworks like React often throw away a piece of the page and build an identical-looking new one. Your pointer now points at a node that no longer exists → stale.

You can see this on \`waits.html\`: find the rows in \`#price-list-container\`, click **Refresh prices**, then call \`getText()\` on a row you found earlier.

\`\`\`java
List<WebElement> rows = driver.findElements(By.cssSelector("#price-list-container .price-row"));
driver.findElement(By.id("refresh-prices-btn")).click();
rows.get(0).getText();     // StaleElementReferenceException
\`\`\`

### Fixes, from best to last resort

**1. Keep the \`By\`, not the \`WebElement\`.** Re-find just before using it. In loops, remember only the *count* (or a stable key such as a product name) and re-locate on each iteration.

**2. Wait for proof that the update finished**, then re-find:

\`\`\`java
WebElement oldRow = driver.findElement(By.cssSelector("#price-list-container .price-row"));
driver.findElement(By.id("refresh-prices-btn")).click();
wait.until(ExpectedConditions.stalenessOf(oldRow));     // old node is gone = re-render happened
\`\`\`

Other "proof" conditions: a counter/badge reaching the expected value (\`textToBe\`), the number of rows changing (\`numberOfElementsToBe\`).

**3. Let the wait re-evaluate for you.** \`ExpectedConditions.refreshed(innerCondition)\` wraps a condition so that if it hits a stale element it simply tries again on the next poll. FluentWait with \`ignoring(StaleElementReferenceException.class)\` and a lambda that re-finds the element does the same.

**What not to do:** \`catch (Exception e) { Thread.sleep(500); retry; }\`. Catching *every* exception hides real failures (wrong locator, app error), and the sleep is a guess.

## Reading an exception in a log

\`\`\`text
org.openqa.selenium.ElementNotInteractableException: element not interactable
  (Session info: chrome=126.0.6478.126)
    at org.openqa.selenium.remote.RemoteWebElement.sendKeys(...)
    at com.shopeasy.pages.SearchBar.search(SearchBar.java:22)
\`\`\`

- Line 1: the exception **name** and **message** → which of the three questions.
- \`Session info\` → browser and version (useful for "only fails on CI").
- The first \`at com.shopeasy...\` line → the line in *your* code to open.

The *Reading stack traces and CI logs* lesson in the Debugging section goes deeper.`,
  keyPoints: [
    'Sort exceptions by three questions: never found, found but unusable, found then lost.',
    'The message after the exception name often names the exact cause (e.g. the overlay).',
    'A WebElement points at one DOM node; re-renders make it stale. Keep `By`s, re-find late.',
    'Fix stale elements with re-locating plus a proof-of-update wait (`stalenessOf`, `textToBe`, `refreshed`).',
    '`NoSuchSessionException` and `SessionNotCreatedException` are lifecycle/environment problems, not locator problems.',
  ],
  mistakes: [
    'Wrapping everything in `catch (Exception e)` with a retry — real failures become invisible.',
    'Storing a `List<WebElement>` and looping over it while each click re-renders the list.',
    'Changing the locator when the real problem is the iframe, the window, or timing.',
    'Treating `TimeoutException` as "increase the timeout" without looking at the screenshot — the app may be showing an error.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/waits.html\` open DevTools, select a row in section 6, then click **Refresh prices**. Watch the Elements panel: the selected node disappears and a new one is created. That is a stale element, made visible.`,
  problems: ['sel-016', 'sel-018', 'sel-013'],
}
