export default {
  id: 'sel-036',
  category: 'selenium',
  kind: 'quiz',
  title: 'Implicit + explicit waits together: why the suite got slower and flakier',
  level: 'INTERMEDIATE',
  tags: ['waits', 'implicitlyWait', 'WebDriverWait', 'flaky', 'performance'],
  estMinutes: 10,
  scenario: `The ShopEasy regression suite used to take 18 minutes. After a teammate added \`driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10))\` to \`BaseTest\` "to fix flakiness", the nightly run now takes 41 minutes and some negative tests time out at odd durations. Every page object already uses \`WebDriverWait\` of 15 seconds. You are asked to explain what went wrong in the retro.`,
  description: `Answer the questions about how implicit and explicit waits interact.`,
  hints: [
    'The implicit wait applies to every findElement/findElements call — including the ones ExpectedConditions makes internally.',
    'The Selenium docs say: do not mix implicit and explicit waits.',
  ],
  questions: [
    {
      q: 'Where is an implicit wait applied?',
      options: [
        'Only to the next findElement call after it is set',
        'To every findElement/findElements call for the rest of the session, until it is changed',
        'Only to page loads',
        'Only inside WebDriverWait',
      ],
      answer: 1,
      why: 'Implicit wait is a session-wide driver setting. Every find call polls the DOM up to that timeout. It does not apply to page loads (that is pageLoadTimeout) and it is not scoped to one call.',
    },
    {
      q: `Implicit wait = 10 s. On \`login.html\` after a successful login the error banner never appears. How long does this take?

\`\`\`java
new WebDriverWait(driver, Duration.ofSeconds(15))
    .until(ExpectedConditions.invisibilityOfElementLocated(By.cssSelector("[data-testid=error]")));
\`\`\``,
      options: [
        'Instantly — the element is absent, so it is invisible',
        'Roughly 10 seconds, because the internal findElement waits the full implicit timeout before concluding the element is absent',
        'Exactly 15 seconds',
        'It throws NoSuchElementException',
      ],
      answer: 1,
      why: 'invisibilityOfElementLocated calls findElement internally. With an implicit wait set, that find blocks for 10 s before throwing NoSuchElementException, which the condition then treats as "invisible". Multiply that by every absence check and you get the 41-minute suite.',
    },
    {
      q: 'Implicit wait = 10 s, explicit wait = 15 s, and the element never appears. What timeout do you actually observe for `visibilityOfElementLocated`?',
      options: [
        'Always exactly 15 s',
        'Always exactly 10 s',
        'Unpredictable — somewhere between 15 and ~25 s, because each poll of the explicit wait can block for up to 10 s inside findElement',
        '25 s exactly, the two timeouts are always added',
      ],
      answer: 2,
      why: 'The explicit wait only checks its own timeout between polls. If a poll starts at 14 s and its findElement blocks for 10 s, the wait ends around 24 s. That unpredictable timing is why the Selenium documentation warns against mixing the two.',
    },
    {
      q: 'What is the recommended fix for this framework?',
      options: [
        'Raise both timeouts to 30 s',
        'Keep the implicit wait at 0 (the default) and rely on explicit WebDriverWait in page objects for every dynamic element',
        'Replace explicit waits with Thread.sleep(2000)',
        'Keep implicit wait and remove the explicit waits',
      ],
      answer: 1,
      why: 'Explicit waits wait for a specific condition (visible, clickable, text present, invisible); implicit waits can only wait for "present in the DOM". Using explicit waits only gives predictable timings and fast absence checks.',
    },
    {
      q: 'A legacy step really needs a quick absence check while the implicit wait is still set globally. Which approach is acceptable as a temporary workaround?',
      options: [
        'Catch NoSuchElementException after a 10 s findElement',
        'Temporarily set implicitlyWait(Duration.ZERO), run findElements(...).isEmpty(), and restore the old value in a finally block',
        'Use driver.navigate().refresh() first',
        'Call findElements twice',
      ],
      answer: 1,
      why: 'Setting the implicit wait to zero makes findElements return immediately; restoring it in finally keeps the rest of the legacy suite unchanged. The real fix is still to remove the global implicit wait.',
    },
  ],
  explanation: `**Implicit wait** = a global "keep looking for up to N seconds" on every find call. **Explicit wait** = poll a specific condition until it is true or the timeout expires.

Mixing them causes two problems: (1) absence/invisibility checks always cost the full implicit timeout, and (2) explicit timeouts become unpredictable, because each poll can block inside findElement. The usual project rule is: implicit wait 0, explicit waits in page objects, and \`FluentWait\` for special cases.`,
  interview: [
    { q: 'Can you use implicit and explicit waits together?', a: 'Technically yes, but the Selenium docs advise against it: the timeouts interact unpredictably and absence checks become slow. Pick explicit waits and keep the implicit wait at zero.' },
    { q: 'What is the default implicit wait?', a: 'Zero. findElement throws NoSuchElementException immediately if the element is not in the DOM at that moment.' },
    { q: 'Does implicit wait help with an element that is present but hidden or disabled?', a: 'No. It only waits for the element to exist in the DOM. Visibility, clickability or text require an explicit wait.' },
  ],
}
