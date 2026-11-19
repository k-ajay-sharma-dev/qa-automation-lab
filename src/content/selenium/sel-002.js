export default {
  id: 'sel-002',
  category: 'selenium',
  kind: 'quiz',
  title: 'findElement vs findElements, close vs quit',
  level: 'BEGINNER',
  tags: ['webdriver', 'findElements', 'session'],
  estMinutes: 8,
  scenario: `In code review your lead leaves two comments on your first pull request: "Why does this negative test crash instead of failing?" (you used \`findElement\` to prove the error banner is *not* shown) and "Why are there still Chrome windows open on the build agent?" (you used \`close()\`). Before you fix the code, make sure you really understand how these four methods behave.`,
  description: `Answer the questions. Each one is something that comes up in the first month of every automation job — and in most interviews.`,
  hints: ['findElement throws when nothing matches; findElements never throws for "no match".', 'quit() ends the whole session; close() closes one window.'],
  questions: [
    {
      q: `On \`inventory.html\` with an empty cart, no element matches \`.shopping-cart-badge\` (the badge is only rendered once something is in the cart). What happens here (no implicit wait configured)?

\`\`\`java
WebElement badge = driver.findElement(By.cssSelector(".shopping-cart-badge"));
\`\`\``,
      options: [
        'It returns null',
        'It throws NoSuchElementException',
        'It returns an empty WebElement whose isDisplayed() is false',
        'It throws StaleElementReferenceException',
      ],
      answer: 1,
      why: '`findElement` must return exactly one element, so when nothing matches it throws `NoSuchElementException`. Selenium never returns null from findElement. Stale is a different problem: the element *was* found but later detached from the DOM.',
    },
    {
      q: `Same page, same missing badge:

\`\`\`java
List<WebElement> badges = driver.findElements(By.cssSelector(".shopping-cart-badge"));
\`\`\`

What is \`badges\`?`,
      options: ['null', 'An empty list', 'It throws NoSuchElementException', 'A list with one null entry'],
      answer: 1,
      why: '`findElements` returns an empty `List` when nothing matches. That makes it the right tool for "assert element is absent": `assertTrue(driver.findElements(By...).isEmpty())`.',
    },
    {
      q: 'An implicit wait of 10 seconds is set. A negative test checks that the error banner is absent using `findElements(...).isEmpty()`. What is the side effect?',
      options: [
        'None — findElements ignores the implicit wait',
        'The check takes ~10 seconds, because findElements polls for the full implicit wait before returning an empty list',
        'It throws TimeoutException after 10 seconds',
        'It returns immediately but may return a stale list',
      ],
      answer: 1,
      why: 'Implicit wait applies to both find methods. For findElements, Selenium keeps polling until at least one element appears **or** the implicit timeout expires — so every "is absent" check costs the full timeout. That is one reason teams set implicit wait to 0 and use explicit waits (e.g. `invisibilityOfElementLocated`).',
    },
    {
      q: '`windows.html` opened a second tab. Your test calls `driver.close()` while focused on that new tab, then `driver.getTitle()`. What happens?',
      options: [
        'Returns the title of the original tab',
        'Throws NoSuchWindowException — the driver is still pointed at the closed tab until you switchTo() another handle',
        'Ends the whole session',
        'Reopens the closed tab',
      ],
      answer: 1,
      why: '`close()` closes only the current window and does **not** move focus. You must `driver.switchTo().window(originalHandle)` before using the driver again. If it was the last window, the session ends as well.',
    },
    {
      q: 'Which statement about `driver.quit()` is correct?',
      options: [
        'It is the same as close() when only one tab is open, so either is fine in teardown',
        'It closes every window, ends the WebDriver session and stops the driver process; the driver object cannot be reused afterwards',
        'It only closes the browser; chromedriver keeps running for the next test',
        'It should be called after every step to free memory',
      ],
      answer: 1,
      why: '`quit()` is the teardown method: all windows closed, session deleted, chromedriver process ended. Any call afterwards throws `NoSuchSessionException`. `close()` on the last window ends the session too, but may leave the driver service running — always use `quit()` in `@AfterMethod`/hooks.',
    },
  ],
  explanation: `**findElement** → exactly one \`WebElement\` or \`NoSuchElementException\`. Use it when the element *must* be there.

**findElements** → \`List<WebElement>\`, possibly empty, never throws for "no match". Use it for counting (\`size()\`), iterating (product cards, table rows) and asserting absence.

Both respect the implicit wait — so absence checks become slow if implicit wait is non-zero.

**close()** → closes the current window only, focus is not moved. **quit()** → closes all windows and ends the session; this belongs in teardown.`,
  interview: [
    { q: 'How do you verify an element is NOT present?', a: 'Use driver.findElements(locator).isEmpty(), ideally with implicit wait at 0, or an explicit wait with ExpectedConditions.invisibilityOfElementLocated, which also passes when the element is absent.' },
    { q: 'Difference between close() and quit()?', a: 'close() closes the window in focus and leaves the session alive if other windows exist. quit() closes all windows, ends the session and stops the driver process; it is what you call in teardown.' },
    { q: 'Can findElement return null?', a: 'No. It either returns a WebElement or throws NoSuchElementException.' },
  ],
}
