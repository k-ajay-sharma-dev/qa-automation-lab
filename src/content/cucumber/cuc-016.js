export default {
  id: 'cuc-016',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Code review: fix the Gherkin anti-patterns',
  level: 'ADVANCED',
  tags: ['anti-patterns', 'review', 'independence', 'declarative'],
  estMinutes: 25,
  scenario: `You are now the reviewer. A pull request adds \`order.feature\`. It "works" when run top to bottom on one machine, but
fails in parallel and when run with \`--tags @smoke\`. As a manual QA you know the rule: **every test case must be independent and test one thing**.
Rewrite the file.`,
  description: `Problems in the PR:
1. Scenario 2 relies on the cart filled by scenario 1 (scenario dependency).
2. UI clicks, selectors and waits in the steps (imperative).
3. Scenario 1 tests login, cart, checkout and logout in one go — 14 steps, several When/Then pairs.
4. A meaningless scenario name.

**Rules**
- Each scenario sets up its own state in \`Given\` steps (use a \`Background\` for shared login).
- No selectors, "click", "wait" or "sleep" in steps.
- No scenario longer than **6** steps; exactly one \`When\` per scenario.
- Meaningful scenario names (no "test", "TC1", "scenario 2").`,
  starterCode: `Feature: Orders

  Scenario: test 1
    Given I open the login page
    When I type "standard_user" in "#user-name"
    And I type "secret_sauce" in "#password"
    And I click "#login-button"
    Then I see "Products"
    When I click "#add-to-cart-trailblazer-backpack"
    And I click "#shopping-cart-link"
    Then I see "Trailblazer Backpack"
    When I click "#checkout"
    And I fill the checkout form
    And I click "#continue"
    And I wait 3 seconds
    And I click "#finish"
    Then I see "Thank you for your order!"

  Scenario: scenario 2
    # uses the cart from test 1
    When I click "#shopping-cart-link"
    And I click "#remove-trailblazer-backpack"
    Then I see "Your cart is empty"
`,
  solution: `Feature: Orders
  Shoppers buy the products in their cart and can still change the cart before paying.

  Background:
    Given the shopper is logged in as "standard_user"

  Scenario: Shopper places an order for a product in the cart
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper checks out with valid customer details
    Then the order confirmation "Thank you for your order!" is shown
    And the cart is empty

  Scenario: Shopper removes the only product from the cart
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper removes "Trailblazer Backpack" from the cart
    Then the cart is empty
`,
  checks: [
    { label: 'No selectors in steps', pattern: '"[#.][\\w-]+"', mustNot: true, hint: 'Move selectors to page objects.' },
    { label: 'No click / wait / sleep / type', pattern: '\\b(click|wait|sleep|type)\\b', flags: 'mi', mustNot: true, hint: 'Describe behaviour; waits belong in page objects.' },
    { label: 'No meaningless scenario names', pattern: '^\\s*Scenario:\\s*(test|tc|scenario)\\s*\\d*\\s*$', flags: 'mi', mustNot: true, hint: 'Name the rule being tested.' },
    { label: 'Only one When per scenario', pattern: '^\\s*When\\b(?:(?!^\\s*Scenario)[\\s\\S])*?^\\s*When\\b', mustNot: true, hint: 'Split multi-behaviour scenarios.' },
    { label: 'Second scenario sets up its own cart', pattern: 'Scenario:[^\\n]*remove[^\\n]*\\n\\s*Given', flags: 'mi', hint: 'Start the removal scenario with "Given the shopper has … in the cart".' },
    { label: 'Scenarios are short (max 6 steps)', pattern: 'Scenario:[^\\n]*\\n(\\s*(Given|When|Then|And|But)\\b[^\\n]*\\n){7,}', mustNot: true, hint: 'Keep to 3–6 steps.' },
  ],
  hints: [
    'If a scenario only passes after another one, it has a hidden Given — write it down.',
    'Login is shared context → Background. The order flow and the removal are two separate behaviours.',
    'The checkout form details can hide behind one declarative step: "checks out with valid customer details".',
  ],
  explanation: `The classic Cucumber anti-patterns, and why they hurt:

- **Scenario dependency** — order isn't guaranteed (parallel, tag filters, rerun of a single failure). Each scenario must build its own state, ideally fast
  (API/data seeding behind a declarative Given).
- **UI script in Gherkin** — brittle and unreadable; selectors and waits are page-object concerns.
- **Long multi-behaviour scenarios** — one failure hides every later check, and the name can't describe it. Rule of thumb: 3–6 steps, one When.
- **Meaningless names** — the report says "test 1 failed"; nobody knows which business rule broke.
- Others to flag in review: conjunctive steps ("When I log in and add a product"), assertions in Given/When, technical words (database, API, JSON) for business readers,
  and copying the manual test case's **every** click instead of its intent.`,
  mistakes: [
    'Fixing the dependency by forcing execution order instead of making the scenario self-contained.',
    'Replacing "wait 3 seconds" with "wait until …" — still a technical step; the page object should wait.',
    'Turning the long scenario into a long Scenario Outline instead of splitting behaviours.',
  ],
  interview: [
    { q: 'Name some Cucumber anti-patterns you look for in review.', a: 'Imperative UI steps, scenarios depending on each other, multiple When/Then blocks, long scenarios, vague titles, conjunctive steps, and assertions hidden in Given or When.' },
    { q: 'How do you make scenarios independent when setup through the UI is slow?', a: 'Keep the Given declarative but implement it with an API call, database seed or cookie injection, and keep UI interaction for the behaviour under test (the When).' },
  ],
}
