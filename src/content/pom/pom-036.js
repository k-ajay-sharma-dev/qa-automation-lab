export default {
  id: 'pom-036',
  category: 'pom',
  kind: 'quiz',
  title: 'Designing a page object for slow, dynamic content (waits.html)',
  level: 'INTERMEDIATE',
  tags: ['pom', 'waits', 'dynamic-content', 'method-design'],
  estMinutes: 12,
  scenario: `The ShopEasy "Waits" page (\`waits.html\`) mimics the slow parts of the real app: a spinner while orders load,
a coupon that appears after 2 seconds, a **Claim reward** button that is disabled for 5 seconds, and an order status that
changes text. Three teammates wrote three different \`WaitsPage\` classes. You are reviewing which method designs to keep.`,
  description: 'Pick the method design you would approve in code review for each dynamic element.',
  questions: [
    {
      q: 'Clicking `#load-data-btn` shows `#loading-spinner` for ~3s, then `#data-result` contains *"Loaded 42 orders"*. Best page method?',
      options: [
        '`loadOrders()` clicks, then `Thread.sleep(3000)`',
        '`loadOrders()` clicks, waits for `#loading-spinner` to become invisible (or `#orders-loaded` visible), then returns `this`; `getOrdersResult()` reads the text',
        '`loadOrders()` only clicks; every test writes its own WebDriverWait',
        '`loadOrders()` returns `true` if the text equals "Loaded 42 orders"',
      ],
      answer: 1,
      why: 'The page owns the timing: the action waits until the action is really finished, so every caller gets a stable state. Sleeping is slow and still flaky; waits in tests are duplicated; returning a comparison hides the assertion inside the page.',
    },
    {
      q: '`#claim-reward-btn` starts `disabled` and becomes enabled after 5s. What should `claimReward()` do before clicking?',
      options: [
        'Wait for `elementToBeClickable(#claim-reward-btn)`',
        'Wait for `visibilityOfElementLocated`, because the button is visible',
        'Check `isEnabled()` once and throw if false',
        'Click with JavaScript so the disabled state is ignored',
      ],
      answer: 0,
      why: 'The button is visible the whole time, so a visibility wait passes too early and the click does nothing. `elementToBeClickable` checks visible **and** enabled. A JavaScript click bypasses the very behaviour a real user would hit.',
    },
    {
      q: 'After `#place-order-btn`, `#order-status` changes from *"Not started"* through intermediate states to a final status. How should the page expose it?',
      options: [
        '`getOrderStatus()` that reads the text immediately',
        '`waitForOrderStatus(String expected)` using `textToBePresentInElementLocated`, plus a plain `getOrderStatus()`',
        'A loop with `Thread.sleep(500)` inside the test',
        'Make the test call `driver.navigate().refresh()` until it changes',
      ],
      answer: 1,
      why: 'Reading immediately returns whatever intermediate value is on screen. A dedicated wait-for-text method captures the condition once; the test then asserts with `getOrderStatus()`. The wait is a synchronisation, not an assertion: if it times out, the failure message says which status never came.',
    },
    {
      q: 'The banner `#auto-banner` is injected into `#auto-appear-container` about 4s after load with no user action. Where should that wait live?',
      options: [
        'In `getFlashSaleText()`: wait for `#auto-banner` to be visible, then return its text',
        'In the WaitsPage constructor, so every test waits 4s even if it never uses the banner',
        'In `@BeforeMethod`',
        'Nowhere; implicit wait handles it',
      ],
      answer: 0,
      why: 'Wait lazily, in the method that needs the element. Waiting in the constructor slows every test on the page for one feature. An implicit wait would work for `findElement` but is global and hides intent; explicit, local waits are clearer.',
    },
  ],
  hints: [
    'Visible is not the same as clickable.',
    'An action method should leave the page in a stable state before returning.',
  ],
  explanation: `Good page methods on dynamic pages follow three rules:

1. **Actions finish their own work**: \`loadOrders()\` waits for the spinner to go away before returning.
2. **Wait for the right condition**: clickable for disabled buttons, text-present for changing labels,
   invisibility for spinners, visibility for injected elements.
3. **Wait where it's needed**: lazily in the method that uses the element, not in constructors or hooks.

Assertions stay in the test; the page only guarantees the screen is ready to read.`,
  mistakes: [
    'Using visibility waits on buttons that are visible but disabled.',
    'Reading changing text immediately and getting an intermediate value.',
    'Putting feature-specific waits in the constructor so every test pays for them.',
  ],
  interview: [
    { q: 'How do you handle a loading spinner in a page object?', a: 'The action that triggers loading waits for the spinner to become invisible (or the result to be visible) before returning. Tests never see the spinner; they get a page that is ready.' },
    { q: 'What is the difference between visibilityOf and elementToBeClickable?', a: 'Visibility only checks the element is displayed with a size. Clickable additionally requires it to be enabled. For disabled-then-enabled buttons only the clickable condition reflects when a user can really click.' },
  ],
}
