export default {
  id: 'pw-034',
  category: 'playwright',
  kind: 'quiz',
  title: 'From WebDriverWait to auto-waiting: translating a Java tester\'s habits',
  level: 'BEGINNER',
  tags: ['auto-waiting', 'selenium', 'migration', 'web-first-assertions', 'timeouts'],
  estMinutes: 10,
  scenario: `Your team is porting the ShopEasy Selenium/Java suite to Playwright + TypeScript. The Java tests are full of
\`WebDriverWait\`, \`ExpectedConditions\` and a few \`Thread.sleep\` calls. Before anyone translates them line by line, check that you know
which Selenium waiting habits still make sense in Playwright and which ones simply disappear.`,
  description: 'Choose the best Playwright translation or explanation for each Selenium habit.',
  questions: [
    {
      q: "Java:\n\n```java\nnew WebDriverWait(driver, Duration.ofSeconds(10))\n    .until(ExpectedConditions.elementToBeClickable(By.id(\"login-button\")))\n    .click();\n```\n\nWhat is the idiomatic Playwright version?",
      options: [
        "await page.waitForSelector('#login-button', { state: 'visible' }); await page.click('#login-button');",
        "await page.getByRole('button', { name: 'Login' }).click();",
        "await page.waitForTimeout(10000); await page.getByRole('button', { name: 'Login' }).click();",
        "Wrap the click in a try/catch and retry it 10 times",
      ],
      answer: 1,
      why: 'click() already waits for the element to be attached, visible, stable, enabled and not covered, up to the action timeout. The explicit wait is redundant, a fixed sleep is always wrong, and a hand-made retry loop re-invents what Playwright does.',
    },
    {
      q: "Java:\n\n```java\nwait.until(ExpectedConditions.textToBe(By.cssSelector(\".shopping-cart-badge\"), \"2\"));\n```\n\nWhich Playwright line keeps the *waiting* behaviour?",
      options: [
        "expect(await page.locator('.shopping-cart-badge').innerText()).toBe('2');",
        "await expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');",
        "expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');  // no await",
        "await page.getByTestId('shopping-cart-badge').textContent() === '2';",
      ],
      answer: 1,
      why: 'Web-first assertions (await expect(locator).toHaveText) retry until the condition holds — the replacement for ExpectedConditions. Option A reads once. Option C forgets await, so the test can end before the assertion finishes. Option D compares and throws the result away.',
    },
    {
      q: 'In Selenium the team set `driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10))`. What is the closest Playwright concept?',
      options: [
        'There is no timeout at all in Playwright — it waits forever',
        'The expect timeout (default 5 s) for assertions and the action/test timeouts for actions — configured in playwright.config.ts, not per driver',
        'page.setDefaultTimeout(0) to disable waiting',
        'You must call waitForLoadState before every action',
      ],
      answer: 1,
      why: 'Playwright waits per action and per assertion, bounded by actionTimeout / the test timeout (30 s default) and expect.timeout (5 s default). They are set once in the config (use.actionTimeout, expect.timeout). Setting 0 means "no limit", not "no wait".',
    },
    {
      q: "A Java test had `Thread.sleep(3000)` after clicking *Load more* on waits.html because 5 more reviews appear after ~2 s. What should the Playwright test do?",
      options: [
        'await page.waitForTimeout(3000) — same thing, but async',
        "Assert the new state: await expect(page.locator('#review-feed .feed-item')).toHaveCount(10)",
        'Increase the global timeout to 60 s',
        'Use page.waitForLoadState("networkidle") after every click',
      ],
      answer: 1,
      why: 'Wait for the outcome you care about (the count grows), not for time. waitForTimeout is a sleep with a different name. networkidle is discouraged and does not cover client-side timers. A bigger global timeout only makes failures slower.',
    },
    {
      q: 'Which Selenium problem mostly disappears in Playwright because locators are lazy?',
      options: [
        'NoSuchWindowException',
        'StaleElementReferenceException — a Locator is re-resolved every time it is used, so a re-rendered element is simply found again',
        'Certificate errors',
        'Slow test start-up',
      ],
      answer: 1,
      why: 'A WebElement is a handle to one DOM node; if the node is replaced it goes stale. A Playwright Locator is a recipe that is resolved at each action or assertion, so re-renders are handled automatically.',
    },
  ],
  hints: ['For each Selenium line ask: does Playwright already do this waiting for me, and what final state should I assert instead?'],
  explanation: `Translation table for waiting:

| Selenium (Java) | Playwright (TypeScript) |
|---|---|
| \`WebDriverWait\` + \`elementToBeClickable\` | nothing — actions auto-wait |
| \`ExpectedConditions.textToBe / visibilityOf\` | \`await expect(locator).toHaveText / toBeVisible\` |
| implicit wait | \`use.actionTimeout\`, \`expect.timeout\` in the config |
| \`Thread.sleep\` | assert the expected state instead |
| re-find after \`StaleElementReferenceException\` | not needed — locators are lazy |

Do not port line by line: delete the waits, keep the intent as a web-first assertion.`,
  mistakes: [
    'Translating every WebDriverWait into waitForSelector — it is almost always redundant before an action.',
    'Writing expect(await locator.textContent()) — it looks like an assertion but never retries.',
    'Forgetting await before expect(locator)… — the assertion promise is dropped and errors are lost.',
  ],
  interview: [
    { q: 'What does Playwright check before it clicks?', a: 'That the element is attached, visible, stable (not animating), enabled and receives events (not covered by another element). It re-checks until the action timeout ends.' },
    { q: 'Are there still explicit waits in Playwright?', a: 'Rarely: waitForResponse / waitForEvent when the test needs data or an event (a download, a popup), and expect.poll for non-UI values. UI state is handled by auto-waiting and web-first assertions.' },
  ],
}
