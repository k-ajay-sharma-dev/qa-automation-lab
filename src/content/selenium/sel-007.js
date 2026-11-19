export default {
  id: 'sel-007',
  category: 'selenium',
  kind: 'quiz',
  title: 'Waits trade-offs: which wait for which situation?',
  level: 'INTERMEDIATE',
  tags: ['waits', 'flaky', 'ExpectedConditions'],
  estMinutes: 10,
  scenario: `The team's flaky-test retro has a sticky note: "We don't agree on waits." Half the framework uses implicit waits, the other half explicit, and one helper still has \`Thread.sleep(5000)\`. Your lead wants you to present the team standard next sprint — first make sure you can defend every choice.`,
  description: `Pick the best answer for each situation. Think about speed, reliability and what the error message tells you on failure.`,
  hints: ['Explicit waits poll a condition and return early.', 'Pick the condition that matches what the user is waiting for.'],
  questions: [
    {
      q: 'In your company\'s web shop (the practice site has no toast), a toast "Item added to cart" appears for 3 seconds and then fades out. You need to assert it appeared. Which is best?',
      options: [
        'Thread.sleep(1000) then findElement',
        'wait.until(ExpectedConditions.visibilityOfElementLocated(TOAST)) then assert getText()',
        'implicitlyWait(10s) then findElement',
        'wait.until(ExpectedConditions.invisibilityOfElementLocated(TOAST))',
      ],
      answer: 1,
      why: 'Visibility wait returns the moment the toast is shown, giving you the element to assert on. A sleep could miss a short-lived toast or waste time; implicit wait only checks presence (the toast element may exist hidden); invisibility checks the wrong thing.',
    },
    {
      q: 'In your company\'s app (not the ShopEasy practice site), the checkout page shows a full-screen overlay while the order is processing. Clicking "Continue" sometimes fails with `ElementClickInterceptedException`. Best fix?',
      options: [
        'Catch the exception and click again in a loop with Thread.sleep(500)',
        'Wait for invisibilityOfElementLocated(OVERLAY), then elementToBeClickable(CONTINUE) and click',
        'Use JavascriptExecutor to click straight through the overlay',
        'Increase implicit wait to 30 seconds',
      ],
      answer: 1,
      why: 'The overlay is a real user-facing state: a user also has to wait for it. Waiting for it to disappear keeps the test realistic. A JS click "passes" even when a real user could not click — it can hide real bugs. Implicit wait does nothing for an element that is already present.',
    },
    {
      q: `What is the maximum time this can take to fail if the element never appears?

\`\`\`java
driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
new WebDriverWait(driver, Duration.ofSeconds(15))
    .until(ExpectedConditions.visibilityOfElementLocated(By.id("report")));
\`\`\``,
      options: ['10 seconds', '15 seconds', 'Exactly 25 seconds', 'Unpredictable — often longer than 15s, because each poll\'s findElement can itself block up to 10s'],
      answer: 3,
      why: 'Each poll of the explicit wait calls findElement, which blocks for up to the implicit timeout. The explicit wait only checks its own deadline between polls, so the total is ~15s plus up to one extra implicit wait — "unpredictable" per the Selenium docs. That is why you do not mix them.',
    },
    {
      q: 'A nightly report export can take 1–90 seconds. You need to check every 5 seconds and ignore `NoSuchElementException` while the download link is not there yet. Which tool fits best?',
      options: [
        'WebDriverWait with default settings',
        'FluentWait with withTimeout(Duration.ofSeconds(120)), pollingEvery(Duration.ofSeconds(5)), ignoring(NoSuchElementException.class)',
        'A for-loop with Thread.sleep(5000)',
        'pageLoadTimeout(120s)',
      ],
      answer: 1,
      why: 'FluentWait lets you tune timeout, polling interval, ignored exceptions and the timeout message. (WebDriverWait is actually a FluentWait subclass, so you could also call pollingEvery on it.) A sleep loop reinvents this badly; pageLoadTimeout only covers navigation.',
    },
    {
      q: 'Which statement about `presenceOfElementLocated` vs `visibilityOfElementLocated` is correct?',
      options: [
        'They are identical',
        'Presence = in the DOM (can be hidden); visibility = in the DOM AND displayed with non-zero size',
        'Visibility = in the DOM; presence = displayed',
        'Presence also waits for the element to be enabled',
      ],
      answer: 1,
      why: 'Presence only checks the DOM. Many apps render elements hidden and reveal them later, so presence returns too early. For anything you will click or read, prefer visibility or clickability.',
    },
  ],
  explanation: `Team standard most mature frameworks land on:

1. **Implicit wait = 0.** Never mix with explicit waits.
2. **Explicit waits** (\`WebDriverWait\` + \`ExpectedConditions\`) for every dynamic step, choosing the condition that matches the user's experience: visible, clickable, invisible, text present, URL contains, number of elements, frame available, alert present.
3. **FluentWait** (or \`WebDriverWait.pollingEvery/ignoring\`) for unusual cases: long polling, custom ignored exceptions, custom lambda conditions.
4. **Thread.sleep: never** in test code — at most in a throw-away debugging session.

The timeout is the *maximum acceptable* time, not the expected time — a good wait costs nothing when the app is fast.`,
  interview: [
    { q: 'Why is Thread.sleep bad?', a: 'It always waits the full time, slowing the suite, and it is still flaky because the app may need longer on a slow environment. Explicit waits return as soon as the condition is true and fail with a clear message.' },
    { q: 'What is the relation between WebDriverWait and FluentWait?', a: 'WebDriverWait extends FluentWait<WebDriver>; it is a FluentWait preconfigured with the driver, a 500ms polling interval and NotFoundException ignored. Both support withTimeout, pollingEvery, ignoring and withMessage.' },
    { q: 'How do you wait for something ExpectedConditions does not offer?', a: 'Pass a lambda: wait.until(d -> d.findElements(ROWS).size() > 5). The lambda returns a truthy value (non-null / true) when done.' },
  ],
}
