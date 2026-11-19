export default {
  slug: 'pom-fluent-navigation',
  category: 'pom',
  order: 3,
  title: 'Fluent page objects: returning the next page',
  minutes: 7,
  summary: 'Make action methods return the page object the user lands on (or `this`), so tests chain naturally and the compiler guides the flow.',
  manualAnalogy: `In a manual end-to-end case every step has an expected landing screen: "Click Checkout → the Your Information page opens". Fluent page objects write that expectation into the code. The method that clicks Checkout *returns* a \`CheckoutPage\`, so the next line of the test can only call things that exist on that page — exactly like a tester who knows which screen they are on.`,
  body: `## Methods can return objects

So far our action methods returned \`void\` (nothing). A Java method can return any type — including another page object. Compare:

\`\`\`java
// void style: the test must know where it is
cartPage.clickCheckout();
CheckoutPage checkout = new CheckoutPage(driver);

// fluent style: the method tells you where you are
CheckoutPage checkout = cartPage.checkout();
\`\`\`

Inside \`CartPage\` the fluent version looks like this:

\`\`\`java
private final By checkoutButton = By.id("checkout");
private final By continueShopping = By.id("continue-shopping");

public CheckoutPage checkout() {
    driver.findElement(checkoutButton).click();
    return new CheckoutPage(driver);          // the user is now on checkout
}

public InventoryPage continueShopping() {
    driver.findElement(continueShopping).click();
    return new InventoryPage(driver);
}
\`\`\`

The return type is a promise: "after this click you are on the checkout page". The same \`driver\` is handed to the new page object, because it is still the same browser.

## Returning \`this\`: staying on the same page

Some actions do not leave the page: typing into a field, choosing a sort order, removing an item. Return \`this\` — the current object — so the test can keep chaining:

\`\`\`java
public InventoryPage sortBy(String value) {
    new Select(driver.findElement(sortDropdown)).selectByValue(value);
    return this;
}
\`\`\`

\`\`\`java
List<Double> prices = inventory.sortBy("lohi").prices();
\`\`\`

## One action, two possible outcomes

What about an action that *sometimes* moves on and sometimes stays? The Finish button on the checkout overview either completes the order or, if something is wrong, keeps you on the same step. A method can only have one return type, so write **two methods**, named after the expectation:

\`\`\`java
public OrderCompletePage finishOrder() {          // happy path
    driver.findElement(finishButton).click();
    return new OrderCompletePage(driver);
}

public CheckoutOverviewPage finishExpectingError() {  // negative path
    driver.findElement(finishButton).click();
    return this;
}
\`\`\`

The test chooses the one that matches what it expects. If a positive test calls \`finishOrder()\` and the order did *not* complete, the next call on \`OrderCompletePage\` (for example reading \`#complete-header\`) will fail or time out — the failure surfaces at the right place.

## Reading a chained test

\`\`\`java
String header = new LoginPage(driver).open()
        .loginAs("standard_user", "secret_sauce")      // -> InventoryPage
        .addToCart("Pulse Bike Light")                 // -> InventoryPage (this)
        .header().openCart()                           // -> CartPage
        .checkout()                                    // -> CheckoutPage
        /* ... shipping info, continue ... */
        .finishOrder()                                 // -> OrderCompletePage
        .getHeader();
\`\`\`

Each line is a manual test step. Your IDE helps too: after \`.checkout()\` it only suggests checkout methods, so you cannot accidentally call a cart method on the checkout page.

## Form pages: fluent setters

Forms benefit most. Each setter types one field and returns \`this\`; a convenience method chains them. Only the *submit* step returns a different page.

\`\`\`java
public RegistrationPage withEmail(String email) {
    type(emailInput, email);   // a wait-then-type helper, see the *BasePage and components* lesson
    return this;
}
\`\`\`

## Rules of thumb

- The return type must be **true**. If the click opens a product details page, do not return \`CartPage\` because it was convenient.
- Create the next page object **inside** the method that navigates, not in the test.
- Do not chain *everything* into one 20-line expression. Store a page in a variable when you need it for several assertions.
- Fluent style is about readability, not cleverness — if a chain becomes hard to read, break it.`,
  keyPoints: [
    'A navigation method returns the page object the user lands on, created with the same driver.',
    'An action that stays on the page returns `this` so calls can be chained.',
    'When one click has two outcomes, write two methods (e.g. `finishOrder()` / `finishExpectingError()`).',
    'Return types must reflect what really happens in the browser.',
    'Fluent setters on forms make tests read like the manual steps.',
  ],
  mistakes: [
    'Returning `void` and then writing `new NextPage(driver)` in every test — the page should do it.',
    'Returning the wrong page type to "make it compile" — the test then calls methods on a page the browser is not on.',
    'Returning `new SamePage(driver)` instead of `this` for same-page actions — it works but loses any state the object held; prefer `this`.',
    'Building one giant chain with assertions buried in the middle — break into variables and assert in the test.',
  ],
  tryIt: `On http://localhost:5180/practice-site/cart.html note the two buttons (\`#continue-shopping\`, \`#checkout\`). For each, write the method signature you would put in \`CartPage\` — just the return type, name and parameters. Then do the same for the overview step on \`checkout.html\` (\`#cancel-overview\`, \`#finish\`).`,
  problems: ['pom-003', 'pom-008', 'pom-013'],
}
