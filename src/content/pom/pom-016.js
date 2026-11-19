export default {
  id: 'pom-016',
  category: 'pom',
  kind: 'quiz',
  title: 'Map the journey: which page does each method return?',
  level: 'BEGINNER',
  tags: ['pom', 'fluent', 'navigation', 'return-types'],
  estMinutes: 10,
  scenario: `Before writing the checkout page objects, your lead asks you to sketch the **navigation map** of ShopEasy on the
whiteboard: for every action, *where does the user end up?* You know the app by heart from two years of manual
regression — now you have to turn that knowledge into return types.`,
  description: `For each page-object method, choose the return type a senior SDET would give it. Think about what the
**user sees after the click**, using the real ShopEasy behaviour.`,
  questions: [
    {
      q: `On \`cart.html\` the user clicks **← Continue Shopping** (\`#continue-shopping\`). What should \`CartPage.continueShopping()\` return?`,
      options: ['`void`', '`CartPage` (this)', '`InventoryPage`', '`HeaderComponent`'],
      answer: 2,
      why: 'The button navigates to inventory.html, so the method returns a new InventoryPage. `void` would force every test to build the next page itself (and know the navigation), and returning `this` would lie about where the user is.',
    },
    {
      q: `On \`inventory.html\` the user picks *Price (low to high)* in \`#product-sort\`. The list re-orders but the URL does not change. What should \`sortBy(String option)\` return?`,
      options: ['`InventoryPage` — `this`', '`new InventoryPage(driver)`', '`CartPage`', '`List<String>` of names'],
      answer: 0,
      why: 'The user stays on the same page, so return `this`. Creating a new instance works but is misleading noise. Returning the names mixes two jobs; keep `sortBy` as an action and add `getProductNames()` as a separate read method.',
    },
    {
      q: `The **Logout** link (\`#logout-link\`) is in the header on inventory, cart and checkout. Where should \`logout()\` live and what does it return?`,
      options: [
        'In every page, returning `void`',
        'In `BasePage`, returning `BasePage`',
        'In a `HeaderComponent`, returning `LoginPage`',
        'In `LoginPage`, returning `LoginPage`',
      ],
      answer: 2,
      why: 'The link belongs to the header that several pages share, so it lives in a component the pages contain (pom-007). After logout ShopEasy shows login.html, so the method returns LoginPage. LoginPage itself has no logout link.',
    },
    {
      q: `On checkout step 1 the user clicks **Continue** with the Postal Code empty. The banner *"Error: Postal Code is required"* appears. Which pair of methods models this best?`,
      options: [
        'One `continueClick()` returning `Object`',
        '`continueToOverview()` returning `CheckoutOverviewPage` **and** `continueExpectingError()` returning `CheckoutPage` (this)',
        'One `continueToOverview()` that returns `null` when there is an error',
        '`continueToOverview()` that catches the exception and returns the error text',
      ],
      answer: 1,
      why: 'Same button, two outcomes that depend on the data. Two intention-revealing methods keep the types honest: the happy-path test gets an overview page, the negative test stays on the form and reads `getErrorMessage()`. `Object` and `null` push type checks and NullPointerExceptions into the test.',
    },
    {
      q: `On the overview step the user clicks **Finish** (\`#finish\`) and sees *"Thank you for your order!"*. What should \`CheckoutOverviewPage.finish()\` return?`,
      options: ['`OrderCompletePage`', '`InventoryPage`', '`CheckoutOverviewPage`', '`boolean` — true if the order went through'],
      answer: 0,
      why: 'The user lands on the confirmation view, so return the page object for it (it has getHeader() and getOrderNumber()). A boolean would hide *what* the confirmation says; the test should read the header and assert it. On ShopEasy steps 1–3 all live in checkout.html, but they are different screens for the user, so they get different page objects.',
    },
  ],
  hints: [
    'Ask: what does the user see right after the click?',
    'Same page → this. Different page → new NextPage(driver). Two possible outcomes → two methods.',
  ],
  explanation: `The return type of a page method is a **promise about where the user is next**:

| Action | Lands on | Return |
|---|---|---|
| \`LoginPage.loginAs\` | inventory | \`InventoryPage\` |
| \`InventoryPage.sortBy\` | same page | \`this\` |
| \`HeaderComponent.openCart\` | cart | \`CartPage\` |
| \`HeaderComponent.logout\` | login | \`LoginPage\` |
| \`CartPage.checkout\` | checkout step 1 | \`CheckoutPage\` |
| \`CheckoutPage.continueToOverview\` | step 2 | \`CheckoutOverviewPage\` |
| \`CheckoutPage.continueExpectingError\` | same form | \`this\` |
| \`CheckoutOverviewPage.finish\` | step 3 | \`OrderCompletePage\` |

Drawing this table first is a great habit: it is the same flow diagram you would draw for exploratory testing, and
it becomes the skeleton of your page classes. "Page" means **what the user sees**, not "one HTML file" —
ShopEasy's three checkout steps share one URL but deserve three page objects.`,
  mistakes: [
    'Returning void everywhere, so tests must create the next page themselves.',
    'Returning a new instance of the same page instead of this for same-page actions.',
    'One method with a boolean or Object return for an action with two possible outcomes.',
    'Assuming one HTML file must be one page object.',
  ],
  interview: [
    { q: 'How do you decide the return type of a page-object method?', a: 'By what the user sees after the action. If they stay on the same page, return this; if they navigate, return the next page object. If the outcome depends on the data, provide two methods, one per expected outcome.' },
    { q: 'Should a single-page application with one URL have one page object?', a: 'No. Page objects model what the user sees, not URLs. Separate screens or major states (checkout steps, a wizard, a modal) get their own page or component objects even if the URL never changes.' },
  ],
}
