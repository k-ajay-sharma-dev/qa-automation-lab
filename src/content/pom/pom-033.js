export default {
  id: 'pom-033',
  category: 'pom',
  kind: 'quiz',
  title: 'Page object, component or helper? Sorting code into the right drawer',
  level: 'BEGINNER',
  tags: ['pom', 'components', 'utilities', 'design'],
  estMinutes: 10,
  scenario: `Your framework has grown to 25 classes and the new joiner asks: "Where do I put this?" Last week someone
added \`parsePrice("$29.99")\` to \`LoginPage\` because "it was open", and the header's cart link is defined in five
different page classes. Your lead wants a simple rule: **page object, component, or helper/util?**`,
  description: 'For each piece of code, choose the right home in a Selenium + POM framework.',
  questions: [
    {
      q: 'The header with `#shopping-cart-link` and `#logout-link` appears on inventory, cart and checkout pages. Where does it belong?',
      options: [
        'Copy the two locators into every page class that shows the header',
        'A `HeaderComponent` that each page exposes (e.g. `inventoryPage.header().openCart()`)',
        'A static `HeaderUtils` class with `public static By CART`',
        'In `BaseTest`, so every test can click it',
      ],
      answer: 1,
      why: 'A repeated UI area with its own elements and behaviour is a **component**: one class, reused by composition. Copies drift apart, static `By` constants leak locators into tests, and BaseTest is for setup, not UI.',
    },
    {
      q: 'A method that turns the text `"$29.99"` into `new BigDecimal("29.99")`. Where does it go?',
      options: [
        'In `InventoryPage`, because prices are shown there',
        'A small helper such as `Money.parse(String)` that has no WebDriver at all',
        'In the test method, each time a price is compared',
        'In `BasePage`, so every page inherits it',
      ],
      answer: 1,
      why: 'Parsing text is **pure logic**: no browser, no locators. It belongs in a helper/util that inventory, cart and checkout pages can all call, and that can be unit tested in milliseconds. BasePage is for shared *browser* behaviour, not for every function in the project.',
    },
    {
      q: '`checkout.html` step two shows `#summary-subtotal`, `#summary-tax`, `#summary-total` and a **Finish** button. What is it?',
      options: [
        'A page object (`CheckoutOverviewPage`): it is a distinct step of the user journey with its own actions',
        'A helper, because it only has three numbers',
        'A component of `LoginPage`',
        'Nothing: tests can read the three spans directly',
      ],
      answer: 0,
      why: 'A screen (or step) the user navigates to, with actions that move them on (`finish()`, `cancel()`), is a **page object**, even if it shares a URL with step one.',
    },
    {
      q: 'Which of these belongs in a **utility** class, not in a page or component?',
      options: [
        '`addToCart(String productName)`',
        '`TestDataFactory.randomPostalCode()`',
        '`openCart()`',
        '`getErrorMessage()`',
      ],
      answer: 1,
      why: 'Generating test data has nothing to do with a specific screen. The other three interact with elements on a page and belong in the page or component that owns those elements.',
    },
  ],
  hints: [
    'Does it touch the browser? If not, it is probably a helper.',
    'Does it repeat on several pages? Then it is a component, not a page.',
  ],
  explanation: `A simple sorting rule that scales:

- **Page object**: a screen or step the user navigates to. Owns its locators and actions, returns the next page.
- **Component**: a UI area that repeats (header, product card, modal, table). Has a root element, used *inside* pages
  by composition.
- **Helper / util**: pure logic with no WebDriver (parse money, build test data, format dates). Static or plain
  methods, unit-testable without a browser.
- **BaseTest / BasePage**: shared setup and shared browser helpers only, not a dumping ground.

If you can't decide, ask "does it need a driver, and is it tied to one screen?"`,
  mistakes: [
    'Putting parsing or data-generation logic in whichever page class happens to be open.',
    'Duplicating header locators across every page instead of one component.',
    'Turning BasePage into a 900-line god class of unrelated helpers.',
  ],
  interview: [
    { q: 'What is the difference between a page object and a page component?', a: 'A page object models a whole screen or journey step and returns the next page on navigation. A component models a reusable part of the UI (header, card, modal) scoped to a root element and is composed into many pages.' },
    { q: 'Why keep helpers free of WebDriver?', a: 'Pure functions are fast to unit test, reusable from any layer (UI, API, data setup) and cannot become flaky. Mixing them into page classes hides them and drags a browser into tests that don\'t need one.' },
  ],
}
