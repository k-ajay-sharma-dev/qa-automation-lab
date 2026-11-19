export default {
  id: 'int-003',
  category: 'interview',
  kind: 'quiz',
  title: 'Waits and dynamic elements — the questions you must not fumble',
  level: 'BEGINNER',
  tags: ['waits', 'dynamic-elements', 'xpath', 'ExpectedConditions', 'FluentWait'],
  estMinutes: 15,
  scenario: `"What waits do you use?" and "How do you handle dynamic elements?" are guaranteed questions. They are also traps: the interviewer often follows up with *"Why not Thread.sleep?"*, *"Can you mix implicit and explicit?"* or *"The id changes every time — now what?"*. Answer with your project practice, not definitions.`,
  description: `Choose the best answer. Pay attention to the phrasing in each \`why\` — it's how you'd say it in the interview.`,
  hints: [
    'Explicit wait = condition-specific, polls, continues as soon as it is true.',
    'Dynamic id like "btn-38271" → anchor on stable attributes or nearby text instead.',
  ],
  questions: [
    {
      q: 'Which wait strategy do most mature frameworks use?',
      options: [
        'A large implicit wait (30 s) and no explicit waits',
        'Implicit wait 0, explicit WebDriverWait with ExpectedConditions wrapped in BasePage helper methods, FluentWait for special polling',
        'Thread.sleep before each action',
        'Implicit wait 10 s plus explicit wait 10 s everywhere',
      ],
      answer: 1,
      why: 'Explicit waits target a specific condition (clickable, visible, invisible) and return as soon as it\'s met. Mixing implicit and explicit waits can produce unpredictable, much longer timeouts (Selenium docs warn against it). Wrapping waits in helpers like click(By) means nobody forgets them.',
    },
    {
      q: 'What exactly does `ExpectedConditions.presenceOfElementLocated(By)` guarantee?',
      options: [
        'The element is visible and clickable',
        'The element exists in the DOM — it may still be hidden, zero-size or covered',
        'The page has fully loaded',
        'The element text is not empty',
      ],
      answer: 1,
      why: 'Presence only means "in the DOM". For typing/reading use visibilityOfElementLocated; for clicking use elementToBeClickable. Using presence before click is a common source of ElementNotInteractableException.',
    },
    {
      q: `Imagine a build where the "Add to cart" button id changed on every page load (on the practice site the inventory ids are stable, but dynamic.html's "Place order" button really does get a new \`submit-order-xxxxx\` id each load):

\`\`\`html
<div class="inventory-item">
  <a class="item-name">Trailblazer Backpack</a>
  <div class="item-price">$29.99</div>
  <button id="add-8f3a91" class="btn-inventory">Add to cart</button>
</div>
\`\`\`

Which locator is the best choice for the backpack's button?`,
      options: [
        'By.id("add-8f3a91")',
        '//div[3]/div[2]/button',
        'By.xpath("//a[@class=\'item-name\' and normalize-space()=\'Trailblazer Backpack\']/ancestor::div[contains(@class,\'inventory-item\')]//button")',
        'By.cssSelector("button")',
      ],
      answer: 2,
      why: 'Anchor on what is stable and meaningful — the product name — and navigate to the button within the same card. In code it becomes a template: String.format(xpath, productName), so one method works for any product. Absolute/index XPaths break on layout changes; a generated id breaks on every load; "button" matches every button. Even better: ask devs for a data-test attribute.',
    },
    {
      q: 'Which is NOT a good technique for dynamic elements?',
      options: [
        'contains() / starts-with() on the stable part of an attribute (e.g. starts-with(@id, \'submit-order-\'))',
        'XPath axes from a stable anchor (following-sibling, ancestor)',
        'Asking developers for stable data-test / data-testid attributes',
        'Recording the locator with a browser plugin and using the generated absolute XPath',
      ],
      answer: 3,
      why: 'Recorder-generated absolute XPaths (/html/body/div[2]/...) break with any layout change. The other three are exactly what you should mention — and asking devs for test ids is a great sign of real team experience.',
    },
    {
      q: 'When would you use FluentWait instead of a plain WebDriverWait?',
      options: [
        'Never — they are unrelated',
        'When you need a custom polling interval or to ignore specific exceptions, e.g. polling a "Report status" every 2 seconds for up to 2 minutes while ignoring StaleElementReferenceException',
        'Only for alerts',
        'FluentWait is the same as Thread.sleep',
      ],
      answer: 1,
      why: 'WebDriverWait extends FluentWait with sensible defaults (500 ms polling, ignores NoSuchElementException). Use FluentWait (or configure WebDriverWait with pollingEvery/ignoring) when you need non-default polling or exceptions to ignore.',
    },
  ],
  explanation: `**How to answer "Which waits do you use?" in one breath:**
> "We set the implicit wait to zero and use explicit waits — WebDriverWait with ExpectedConditions — inside BasePage helpers, so \`click(By)\` waits for elementToBeClickable and \`getText(By)\` waits for visibility. For spinners we wait for invisibility, for lists we wait for the expected count, and FluentWait when we need custom polling. We don't use Thread.sleep in the framework."

**How to answer "How do you handle dynamic elements?":**
> "First I look for stable attributes — data-test, name, aria-label. If the id is generated, I use contains/starts-with on the stable part, or anchor on visible text like the product name and move with XPath axes. I keep these as String templates in the page object so one method works for any product. And where possible we ask developers to add data-test attributes."`,
  mistakes: [
    'Saying "I use Thread.sleep when the element takes time".',
    'Not knowing the difference between presence and visibility.',
    'Relying on indexes or absolute XPath for dynamic lists.',
    'Mixing implicit and explicit waits.',
  ],
  interview: [
    { q: 'What waits do you use in your framework?', a: 'Implicit wait is set to zero and we use explicit WebDriverWait with ExpectedConditions inside BasePage helper methods — elementToBeClickable before clicks, visibilityOfElementLocated before reading text, invisibilityOfElementLocated for spinners. FluentWait for custom polling. No Thread.sleep in the framework code.' },
    { q: 'How do you handle dynamic elements?', a: 'I avoid the changing parts and anchor on stable ones: data-test attributes, names, or the visible text such as the product name, combined with XPath axes or contains/starts-with. In our inventory page we used a parameterised XPath with String.format so addToCart(productName) works for any product.' },
    { q: 'Why not Thread.sleep?', a: 'It always waits the full time, so it slows the suite, and it is still flaky when the app is slower than the sleep. Explicit waits continue as soon as the condition is true and fail with a clear timeout message.' },
  ],
}
