export default {
  id: 'pw-024',
  category: 'playwright',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'checkout.feature: the order journey and its validation rules',
  level: 'BEGINNER',
  tags: ['gherkin', 'scenario-outline', 'background', 'checkout'],
  estMinutes: 15,
  scenario: `Checkout is the most valuable flow in ShopEasy and the only one still tested by hand before every release (test cases CO-01 to CO-06).
The product owner wants it in the Cucumber + Playwright suite with scenarios she can read in the sprint review. A first draft exists,
copied from the manual test steps — it clicks buttons and types into fields, and the six cases are six near-identical scenarios.`,
  description: `Write \`features/checkout.feature\`.

**Acceptance**
- Feature tagged \`@checkout\`, a short purpose line, and a \`Background:\` in which the shopper is logged in as \`"standard_user"\` **and** has
  \`"Trailblazer Backpack"\` in the cart.
- \`@smoke\` scenario (CO-01): the shopper checks out as Jane Doe with postcode 10001 and confirms → the order is confirmed with an order
  number starting with \`"SE-"\` and the cart is empty.
- \`@regression\` **Scenario Outline** (CO-02…CO-05) with \`Examples:\` columns \`first name | last name | postcode | error\`:
  missing first name → \`First Name is required\`; missing last name → \`Last Name is required\`; missing postcode → \`Postal Code is required\`;
  postcode \`1\` → \`Postal Code is invalid\`.
- \`@regression\` scenario (CO-06): cancelling on the overview takes the shopper back to the products page and the cart still holds **1** product.
- Declarative steps only: no clicks, buttons, fields, selectors or URLs.`,
  starterCode: `Feature: Checkout

  Scenario: CO-01 order
    Given I open "http://localhost:5180/practice-site/login.html"
    And I log in as "standard_user"
    And I click "Add to cart" on "Trailblazer Backpack"
    When I click the cart icon
    And I click the "Checkout" button
    And I type "Jane" into "#first-name"
    And I type "Doe" into "#last-name"
    And I type "10001" into "#postal-code"
    And I click the "Continue" button
    And I click the "Finish" button
    Then I see "Thank you for your order!"

  Scenario: CO-02 first name missing
    Given I open "http://localhost:5180/practice-site/login.html"
    # ...the same 9 steps again with an empty first name

  # TODO CO-03 .. CO-06
`,
  solution: `@checkout
Feature: Checkout
  Shoppers turn their cart into an order in three short steps.

  Background:
    Given the shopper is logged in as "standard_user"
    And the cart contains "Trailblazer Backpack"

  @smoke
  Scenario: Shopper places an order
    When the shopper checks out as "Jane" "Doe" with postcode "10001"
    And confirms the order
    Then the order is confirmed with an order number starting with "SE-"
    And the cart is empty

  @regression
  Scenario Outline: Checkout information is validated
    When the shopper checks out as "<first name>" "<last name>" with postcode "<postcode>"
    Then the checkout error "<error>" is shown

    Examples:
      | first name | last name | postcode | error                   |
      |            | Doe       | 10001    | First Name is required  |
      | Jane       |           | 10001    | Last Name is required   |
      | Jane       | Doe       |          | Postal Code is required |
      | Jane       | Doe       | 1        | Postal Code is invalid  |

  @regression
  Scenario: Cancelling on the overview keeps the cart
    When the shopper checks out as "Jane" "Doe" with postcode "10001"
    And cancels on the order overview
    Then the products page is shown
    And the cart contains 1 product
`,
  checks: [
    { label: 'Feature tagged @checkout', pattern: '^\\s*@checkout\\s*\\n\\s*Feature:', hint: '@checkout on the line above Feature:' },
    { label: 'Background with login and cart', pattern: 'Background:\\s*\\n\\s*Given\\s+[^\\n]*logged in[^\\n]*\\n\\s*And\\s+[^\\n]*cart', hint: 'Background:\n    Given the shopper is logged in as "standard_user"\n    And the cart contains "Trailblazer Backpack"' },
    { label: 'Happy path tagged @smoke with the order number', pattern: '@smoke\\s*\\n\\s*Scenario:[\\s\\S]*"SE-"', hint: 'Then the order is confirmed with an order number starting with "SE-"' },
    { label: 'Validation as a Scenario Outline with an error column', pattern: 'Scenario Outline:[\\s\\S]*"<error>"[\\s\\S]*Examples:\\s*\\n\\s*\\|[^\\n]*postcode[^\\n]*\\|\\s*error\\s*\\|', hint: 'Examples:\n      | first name | last name | postcode | error |' },
    { label: 'Invalid postcode row', pattern: '\\|\\s*1\\s*\\|\\s*Postal Code is invalid\\s*\\|', hint: '| Jane | Doe | 1 | Postal Code is invalid |' },
    { label: 'Cancel scenario keeps the cart', pattern: 'Scenario:[^\\n]*[Cc]ancel[\\s\\S]*cart contains 1', hint: 'Then the products page is shown\n    And the cart contains 1 product' },
    { label: 'No UI mechanics in steps', pattern: '(#\\w|\\bclick|\\btype\\b|button|https?:|\\bfield\\b)', flags: 'mi', mustNot: true, hint: 'Say what the shopper does ("checks out as …"), not which control is used.' },
  ],
  hints: [
    'Everything every scenario needs (logged in, product in cart) belongs in the Background.',
    'One step "checks out as "<first name>" "<last name>" with postcode "<postcode>"" serves both the happy path and the outline.',
    'An empty Examples cell becomes an empty string — that is how you express "missing first name".',
  ],
  explanation: `Six manual test cases became **three scenarios**: one happy path, one outline with four rows, one alternative flow. The outline
works because CO-02…CO-05 are the *same behaviour* (submit information → see an error) with different data; CO-06 is a different
behaviour, so it gets its own scenario.

The order number is random (\`SE-\` plus six digits), so the feature states the *rule* ("starts with SE-") and the step definition checks it
with a pattern — never with a fixed number.

Notice how the step definitions will be reused: "checks out as {string} {string} with postcode {string}" drives the form in all three
scenarios. That is the payoff of declarative steps — fewer step definitions, and the page objects absorb UI changes.`,
  mistakes: [
    'One scenario per validation message with copy-pasted steps — use a Scenario Outline.',
    'Putting the whole journey (login, add, cart, checkout) into every scenario instead of a Background.',
    'Asserting a concrete random order number — state the format instead.',
    'Mixing behaviours in one outline (errors and the successful order) — rows of an outline should share the same Then.',
  ],
  interview: [
    { q: 'How do you decide between a Scenario Outline and separate scenarios?', a: 'If the steps are identical and only data and expected results differ, use an outline. If the flow or the kind of outcome differs, write separate scenarios so each name states one behaviour.' },
    { q: 'How do you test a value that is random, like an order number?', a: 'Assert its format or rule (e.g. matches /^SE-\\d{6}$/) and, if needed, store it on the World to use in later steps, for example to look the order up.' },
    { q: 'What should go into a Background?', a: 'Only preconditions that every scenario in the file needs and that a business reader should see. Technical setup like launching the browser goes into hooks.' },
  ],
}
