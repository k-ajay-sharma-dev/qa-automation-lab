export default {
  id: 'pom-030',
  category: 'pom',
  kind: 'quiz',
  title: 'Where do waits belong: in the page or in the test?',
  level: 'INTERMEDIATE',
  tags: ['pom', 'waits', 'flakiness', 'design'],
  estMinutes: 10,
  scenario: `The nightly run has 7 flaky failures. You open the tests and find \`new WebDriverWait(...)\` in 40 different test
methods, each with a different timeout (5s, 10s, 30s), plus two \`Thread.sleep(3000)\`. Your lead asks you to propose
**one rule** for where waiting lives in the framework.`,
  description: 'Answer the design questions a reviewer would ask about waits in a page-object framework.',
  questions: [
    {
      q: 'Where should the wait for `#login-error-message` to become visible live?',
      options: [
        'In each negative login test, before reading the text',
        'Inside `LoginPage.getErrorMessage()` (via a BasePage helper)',
        'In a global `implicitlyWait(30s)` only',
        'In the `@AfterMethod` hook',
      ],
      answer: 1,
      why: 'The page knows its elements and their timing, so it waits before reading. Every test that calls `getErrorMessage()` gets the wait for free. Waits in tests are duplicated and easy to forget.',
    },
    {
      q: 'After `finish()` ShopEasy shows *"Thank you for your order!"*. Where is the best place to wait for that screen?',
      options: [
        'In the `OrderCompletePage` constructor or an `isLoaded()` check',
        'In the test: `Thread.sleep(2000)` then create the page',
        'Nowhere, Selenium waits for page loads automatically',
        'In `CheckoutOverviewPage.finish()` with a 60s sleep',
      ],
      answer: 0,
      why: 'A page that verifies it is really open (loadable page, pom-020) fails fast with a clear message. Selenium only waits for the document load, not for content rendered by JavaScript on the same URL.',
    },
    {
      q: 'Which statement about **timeouts** is best?',
      options: [
        'Every test picks its own timeout',
        'One default in BasePage (e.g. from config), with an explicit longer wait only in the page method that is known to be slow',
        'Always use 60 seconds so nothing ever fails',
        'Mix implicit and explicit waits for double safety',
      ],
      answer: 1,
      why: 'A single configured default keeps behaviour consistent; a slow report export can get its own longer wait inside that one page method. Huge timeouts hide real performance bugs, and mixing implicit and explicit waits causes unpredictable total wait times.',
    },
    {
      q: 'A test needs to check that the cart badge **disappears** after the last item is removed. What should the page expose?',
      options: [
        '`boolean isCartBadgeDisplayed()` that returns immediately',
        'A method that waits for invisibility, e.g. `waitForEmptyCart()` or `isCartBadgeGone()` using `invisibilityOfElementLocated`',
        'Nothing, the test calls `driver.findElements` and checks size',
        '`Thread.sleep(1000)` inside `removeItem()`',
      ],
      answer: 1,
      why: 'Checking "not there" immediately can pass before the UI updates, or fail because the old badge is still fading out. Waiting for invisibility inside the page captures the real condition once, for every test.',
    },
  ],
  hints: [
    'Who knows how slow an element is: the test or the page?',
    'Prefer one rule everywhere over 40 local decisions.',
  ],
  explanation: `**Rule: synchronisation is a page responsibility.** Tests express intent and assertions; pages make sure
the element is ready before touching or reading it.

- BasePage helpers (\`click\`, \`type\`, \`getText\`) wait for clickable/visible, so most page methods never mention waits.
- Page transitions are verified by the next page (\`isLoaded()\` / constructor check).
- Special cases (slow export, disappearing badge) get a dedicated wait inside the page method that owns them.
- No \`Thread.sleep\`, and don't mix implicit with explicit waits.

The result: when a flaky wait needs fixing, you change one method and all tests benefit.`,
  mistakes: [
    'Sprinkling WebDriverWait in test methods with different timeouts.',
    'Relying on implicit waits to handle JavaScript-rendered content and disappearing elements.',
    'Asserting absence immediately without waiting for invisibility.',
  ],
  interview: [
    { q: 'Where do you put waits in a POM framework?', a: 'In the page layer: BasePage helpers wait for visibility or clickability before every interaction, pages verify they are loaded, and special conditions get dedicated wait methods in the owning page. Tests do not contain waits.' },
    { q: 'Why not combine implicit and explicit waits?', a: 'Selenium docs warn that mixing them can lead to unpredictable wait times, because the implicit wait applies inside each poll of the explicit wait. Pick explicit waits and set the implicit wait to zero.' },
  ],
}
