export default {
  id: 'cuc-030',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Given/When/Then for removing items from the cart',
  level: 'BEGINNER',
  tags: ['gherkin', 'given-when-then', 'cart', 'remove'],
  estMinutes: 12,
  scenario: `Defect SHOP-231: after removing the only item from the cart, the cart badge still showed "1" until the page was refreshed.
The fix is in, and the product owner wants the remove flow covered in the regression feature files. Your manual test case already exists —
you just need to turn it into clean Given/When/Then.`,
  description: `Your manual test case for \`cart.html\`:

1. Log in as \`standard_user\`, add **Trailblazer Backpack** and **Pulse Bike Light**, open the cart.
2. Click **Remove** on Pulse Bike Light → only Trailblazer Backpack is listed, badge shows **1**.
3. (second case) With only Pulse Bike Light in the cart, remove it → the message *"Your cart is empty"* is shown and the badge disappears.

Write \`cart-remove.feature\`.

**Rules**
- Two scenarios: *remove one of two items* and *remove the last item*.
- Setup (login, cart contents) is **Given**; the single user action (remove) is **When**; the outcome is **Then**.
- Exactly **one When** per scenario.
- Use the real product names in quotes; describe behaviour, not clicks or locators.
- Assert both the list and the cart badge.`,
  starterCode: `Feature: Remove items from the cart

  Scenario: Remove
    Given I open login.html
    When I type standard_user and secret_sauce and click login
    And I click add-to-cart-pulse-bike-light
    And I click the cart icon
    When I click remove-pulse-bike-light
    Then it works
`,
  solution: `@cart @regression
Feature: Remove items from the cart
  Shoppers can change their mind before checkout (SHOP-231).

  Background:
    Given the shopper is logged in as "standard_user"

  Scenario: Removing one of two items keeps the other in the cart
    Given the shopper has "Trailblazer Backpack" and "Pulse Bike Light" in the cart
    And the shopper is on the cart page
    When the shopper removes "Pulse Bike Light" from the cart
    Then the cart lists only "Trailblazer Backpack"
    And the cart badge shows 1

  Scenario: Removing the last item empties the cart
    Given the shopper has "Pulse Bike Light" in the cart
    And the shopper is on the cart page
    When the shopper removes "Pulse Bike Light" from the cart
    Then the cart shows the message "Your cart is empty"
    And the cart badge is not shown
`,
  checks: [
    { label: 'Two scenarios', pattern: '(^\\s*Scenario:[\\s\\S]*){2}', hint: 'One scenario for "one of two", one for "the last item".' },
    { label: 'Remove action in a When step', pattern: '^\\s*When\\b[^\\n]*remov', flags: 'mi', hint: 'When the shopper removes "Pulse Bike Light" from the cart' },
    { label: 'Product names in quotes', pattern: '"(Pulse Bike Light|Trailblazer Backpack)"', hint: 'Use the real product names, e.g. "Pulse Bike Light".' },
    { label: 'Checks the empty cart message', pattern: 'Your cart is empty', flags: 'mi', hint: 'Then the cart shows the message "Your cart is empty"' },
    { label: 'Checks the cart badge', pattern: '^\\s*(Then|And)\\b[^\\n]*badge', flags: 'mi', hint: 'And the cart badge shows 1 / is not shown' },
    { label: 'No clicks or ids in steps', pattern: '\\bclick|remove-pulse|\\.html', flags: 'mi', mustNot: true, hint: 'Describe what the shopper does, not which button id they click.' },
    { label: 'Only one When per scenario', pattern: '^\\s*When\\b[^\\n]*\\n(\\s*(And|But|When)\\b[^\\n]*\\n)*\\s*When\\b', mustNot: true, hint: 'A second "When" in the same scenario means it tests two behaviours.' },
  ],
  hints: [
    'Everything that must already be true before the remove (login, items in cart, on the cart page) is a Given.',
    'The remove itself is the one When; "only X is listed" and "badge shows 1" are Thens.',
    'Login is shared by both scenarios — a short Background is fine.',
  ],
  explanation: `Given/When/Then maps one-to-one onto a good manual test case: **preconditions → action → expected result**.

- **Given** puts the world in a known state. How it gets there (UI clicks, API, session) is a step-definition detail.
- **When** is the one behaviour under test — here, removing a product. One When per scenario keeps the failure meaningful.
- **Then** checks observable outcomes. The defect was about the badge, so the badge gets its own Then; a regression test should pin the bug.

The starter mixes UI mechanics ("click", ".html", element ids) into the steps and ends with "it works" — nobody can tell what was checked.`,
  mistakes: [
    'Putting the add-to-cart clicks into When steps — they are setup, not the behaviour under test.',
    'A vague Then ("it works", "the cart is correct") that asserts nothing specific.',
    'Checking only the list and forgetting the badge — the very bug that was reported.',
    'Using element ids such as remove-pulse-bike-light in the Gherkin; when the id changes the business spec changes for no reason.',
  ],
  interview: [
    { q: 'Why only one When per scenario?', a: 'A scenario should test one behaviour. Two Whens mean two actions, so a failure no longer tells you which behaviour broke — split it into two scenarios.' },
    { q: 'How would the Given "the shopper has X in the cart" be implemented fast?', a: 'Not necessarily through the UI: the step definition could seed the cart via an API or session storage, then open the cart page. The Gherkin stays the same either way.' },
  ],
}
