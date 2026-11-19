export default {
  id: 'cuc-031',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Spot the misused Given, When and Then',
  level: 'BEGINNER',
  tags: ['gherkin', 'given-when-then', 'code-review', 'anti-patterns'],
  estMinutes: 10,
  scenario: `You are reviewing a pull request from a new teammate who added five ShopEasy scenarios. They all pass — but some steps
do actions inside a Then, or check results inside a When. Your lead asks you to leave review comments before the scenarios become
"documentation" that everyone copies.`,
  description: 'For each snippet, pick the best review comment.',
  questions: [
    {
      q: '```gherkin\nWhen the shopper adds "Pulse Bike Light" to the cart\nThen the shopper opens the cart and the item is listed\n```\nWhat is wrong?',
      options: [
        'Nothing — Then can contain any step',
        'The Then hides an action ("opens the cart"); move it into the When/Given and keep Then as a pure check',
        'Then steps must never use quotes',
        'The When should be a Given',
      ],
      answer: 1,
      why: 'Then describes an observable outcome. Opening the cart is an action, so it belongs in a When (or a Given if it is setup). Hidden actions in Then make failures confusing: did the navigation fail or the assertion?',
    },
    {
      q: '```gherkin\nWhen the shopper logs in as "standard_user" and sees the "Products" page\n```\nBest comment?',
      options: [
        'Fine, it saves a line',
        'Split it: the login is the When, "sees the Products page" is a Then',
        'Replace it with a Background',
        'Use a Doc String instead',
      ],
      answer: 1,
      why: 'Assertions inside a When are easy to miss and impossible to reuse. "When the shopper logs in as {string}" + "Then the Products page is shown" keeps each step one job, and the Then step can be reused by other scenarios.',
    },
    {
      q: '```gherkin\nGiven the shopper clicks "Add to cart" on "Trailblazer Backpack"\nAnd the shopper clicks "Add to cart" on "Pulse Bike Light"\nWhen the shopper checks out\n```\nWhat is the best rewrite of the Givens?',
      options: [
        'Change them to When steps — clicks are actions',
        'Given the shopper has "Trailblazer Backpack" and "Pulse Bike Light" in the cart',
        'Remove them; Cucumber knows what is in the cart',
        'Move them to a Then',
      ],
      answer: 1,
      why: 'Given describes a state, not the clicks that produce it. Stating the state ("has X in the cart") keeps the scenario focused on checkout, and the step definition is free to set it up by UI or API.',
    },
    {
      q: 'A Then step definition contains:\n```java\n@Then("the order is confirmed")\npublic void orderConfirmed() {\n    checkoutPage.clickFinish();\n    assertEquals("Thank you for your order!", completePage.header());\n}\n```\nWhat is the problem?',
      options: [
        'assertEquals should be assertTrue',
        'The Then performs the Finish click — the action belongs in a When step ("When the shopper places the order")',
        'Then methods cannot call page objects',
        'Nothing, as long as it passes',
      ],
      answer: 1,
      why: 'The Gherkin word and the code must agree: Then = verify only. A reader of the feature never sees that "Then" clicks Finish, and a second Then reusing this step would place a second order.',
    },
    {
      q: 'Which scenario uses the three keywords correctly?',
      options: [
        'Given the shopper sorts by price / When the list is sorted / Then the shopper is on the Products page',
        'Given the shopper is on the Products page / When the shopper sorts by "Price (low to high)" / Then "Junior Onesie" is the first product',
        'When the shopper is on the Products page / Then the shopper sorts by price / Given "Junior Onesie" is first',
        'Then the shopper is on the Products page / When the shopper sorts / Then the list is sorted',
      ],
      answer: 1,
      why: 'Context (on the Products page) → one action (sort) → a concrete observable result (Junior Onesie at $7.99 is first). The others put actions in Given/Then or swap the order.',
    },
  ],
  hints: ['Given = state, When = the one action, Then = what you can observe.', 'If a Then step definition clicks something, it is lying about what it does.'],
  explanation: `A quick review checklist for every scenario:

- **Given** — past/present state ("has X in the cart", "is logged in"). No assertions, no step-by-step clicks.
- **When** — the single action under test. No checks hidden after "and sees…".
- **Then** — only observation and assertion. If the step definition clicks, types or navigates, it is really a When.

Cucumber itself does not enforce any of this — Given, When and Then are interchangeable to the engine. That is exactly why reviewers must.`,
  interview: [
    { q: 'Does Cucumber treat Given, When and Then differently?', a: 'No. The keyword is ignored when matching step definitions; @Given can match a When line. The keywords exist for humans, so keeping their meaning is a team discipline enforced in review.' },
    { q: 'Why should a Then step never perform an action?', a: 'Because the reader trusts it to only check. Hidden actions cause side effects (double orders), confusing failures and steps that cannot safely be reused.' },
    { q: 'How do you write a Given for a state that takes many UI clicks?', a: 'Describe the state in one business sentence and let the step definition reach it the fastest reliable way — often an API call or seeded data instead of clicking through the UI.' },
  ],
}
