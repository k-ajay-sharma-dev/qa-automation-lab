export default {
  id: 'pom-031',
  category: 'pom',
  kind: 'quiz',
  title: 'Refactoring plan: three tests, the same locators copied everywhere',
  level: 'ADVANCED',
  tags: ['pom', 'refactoring', 'duplication', 'code-review'],
  estMinutes: 12,
  scenario: `You inherit \`CartTests\` with three tests: *add one item*, *add two items*, *remove an item*. Each one repeats
\`By.id("user-name")\`, \`By.id("password")\`, \`By.id("login-button")\`, an XPath for *Add to cart*, and
\`By.className("shopping_cart_badge")\`. Yesterday the badge class was renamed to \`shopping-cart-badge\` and all three
tests broke. You must
refactor safely **while the suite keeps running in CI**.`,
  description: 'Choose the steps a careful senior SDET would take.',
  questions: [
    {
      q: 'What is the safest **first** step?',
      options: [
        'Rewrite all three tests from scratch into page objects in one big PR',
        'Make sure the three tests pass (fix the badge locator), then refactor in small steps keeping them green',
        'Delete the tests and write new ones later',
        'Switch to PageFactory first',
      ],
      answer: 1,
      why: 'Refactoring means changing structure without changing behaviour. A green baseline proves you did not break anything; small steps make a failure easy to locate. A big-bang rewrite mixes behaviour changes with structure changes.',
    },
    {
      q: 'Which duplication should you extract **first** for the biggest win?',
      options: [
        'The login steps (3 locators x 3 tests) into `LoginPage.loginAs()`',
        'The `@Test` annotations',
        'The assertion messages',
        'The import statements',
      ],
      answer: 0,
      why: 'Login is repeated in every test and is a prerequisite for everything else, so extracting it removes the most lines and risk at once. Then inventory (addToCart) and the header (cart badge).',
    },
    {
      q: 'The *Add to cart* XPath contains the product name (`//div[.="Pulse Bike Light"]/..//button`). How should it live in `InventoryPage`?',
      options: [
        'Three separate `By` fields, one per product used in the tests',
        'A dynamic locator built from a parameter: `addToCart(String productName)`',
        'Keep it in the tests because it varies',
        'A public static String constant tests concatenate',
      ],
      answer: 1,
      why: 'One parameterised locator (pom-010) covers any product. Separate fields grow with the catalogue; keeping it in tests keeps the duplication; public string constants leak locators.',
    },
    {
      q: 'The cart badge appears on every page. After the refactor, where should `getCartCount()` live?',
      options: [
        'Copied into InventoryPage, CartPage and CheckoutPage',
        'In a `HeaderComponent` that each page exposes (e.g. `page.header().getCartCount()`)',
        'In the test class as a private helper',
        'In BaseTest',
      ],
      answer: 1,
      why: 'Shared UI is modelled as a component (pom-007). The renamed class is now fixed in exactly one place, which is the whole point of this refactor.',
    },
    {
      q: 'How do you know the refactor is finished?',
      options: [
        'The test files are shorter',
        'Tests still pass, contain no `By`/`driver.findElement`, and each locator exists in exactly one class',
        'PageFactory is used everywhere',
        'There is one page object per test',
      ],
      answer: 1,
      why: 'A measurable definition of done: same behaviour, no locators in tests, a single source for each locator. Shorter files are a side effect, not the goal.',
    },
  ],
  hints: [
    'Refactoring needs a green baseline first.',
    'Extract the most repeated thing first; shared UI becomes a component.',
  ],
  explanation: `A safe refactor to page objects follows the same steps every time:

1. **Green baseline**: fix the broken locator so all tests pass.
2. **Extract the most duplicated flow** (login) into a page, run the tests.
3. **Parameterise** varying locators (\`addToCart(name)\`) instead of copying them.
4. **Components** for shared UI (header badge, menu).
5. **Definition of done**: tests pass, no \`By\` in tests, each locator lives in one class.

Each step is a small commit that CI verifies — just like you would retest after every fix in manual testing.`,
  mistakes: [
    'Big-bang rewrite that changes behaviour and structure at the same time.',
    'Creating one field per product instead of a parameterised locator.',
    'Copying shared header methods into every page.',
  ],
  interview: [
    { q: 'How would you introduce POM into an existing suite without stopping delivery?', a: 'Incrementally: start from a green baseline, extract the most duplicated flows first (login, navigation), migrate tests as you touch them, and agree a rule that new tests must use page objects. Each step is a small PR verified by CI.' },
    { q: 'How do you measure that a POM refactor succeeded?', a: 'Tests behave the same, locators appear only in page or component classes, and a UI change now needs one edit. Over time you see fewer locator-related failures and faster fixes.' },
  ],
}
