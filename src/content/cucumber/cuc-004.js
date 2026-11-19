export default {
  id: 'cuc-004',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Remove duplication with Background',
  level: 'BEGINNER',
  tags: ['gherkin', 'background'],
  estMinutes: 10,
  scenario: `The cart feature now has three scenarios and each one starts with the same two Given lines. When login
changed to require a shop selection, someone forgot to update one of them and it failed in the nightly run. Time for a \`Background\`.`,
  description: `Refactor the feature so the repeated preconditions live in a single \`Background\`.

**Rules**
- Exactly one \`Background:\` placed **before** the first scenario.
- The shared Givens appear only once in the file.
- Keep all three scenarios and their own steps.
- Background must contain only context (Given/And) — no When/Then.`,
  starterCode: `Feature: Shopping cart

  Scenario: Adding a product updates the badge
    Given the shopper is logged in as "standard_user"
    And the cart is empty
    When the shopper adds "Trailblazer Backpack" to the cart
    Then the cart badge shows 1

  Scenario: Removing the only product hides the badge
    Given the shopper is logged in as "standard_user"
    And the cart is empty
    And the shopper has added "Trailblazer Backpack" to the cart
    When the shopper removes "Trailblazer Backpack" from the cart
    Then the cart badge is not shown

  Scenario: Cart keeps products after navigating away
    Given the shopper is logged in as "standard_user"
    And the cart is empty
    And the shopper has added "Pulse Bike Light" to the cart
    When the shopper opens the cart page
    Then the cart contains "Pulse Bike Light"
`,
  solution: `Feature: Shopping cart

  Background:
    Given the shopper is logged in as "standard_user"
    And the cart is empty

  Scenario: Adding a product updates the badge
    When the shopper adds "Trailblazer Backpack" to the cart
    Then the cart badge shows 1

  Scenario: Removing the only product hides the badge
    Given the shopper has added "Trailblazer Backpack" to the cart
    When the shopper removes "Trailblazer Backpack" from the cart
    Then the cart badge is not shown

  Scenario: Cart keeps products after navigating away
    Given the shopper has added "Pulse Bike Light" to the cart
    When the shopper opens the cart page
    Then the cart contains "Pulse Bike Light"
`,
  checks: [
    { label: 'Has a Background', pattern: '^\\s*Background:', hint: 'Add "Background:" under the Feature line.' },
    { label: 'Background comes before the first Scenario', pattern: 'Background:[\\s\\S]*Scenario:', hint: 'Background must be above the scenarios.' },
    { label: 'Login Given appears only once', pattern: '(logged in as[\\s\\S]*){2,}', mustNot: true, hint: 'Remove the login line from every scenario.' },
    { label: 'Background has no When/Then', pattern: 'Background:(?:(?!Scenario)[\\s\\S])*^\\s*(When|Then)\\b', mustNot: true, hint: 'Background is context only.' },
    { label: 'Still three scenarios', pattern: '(^\\s*Scenario:[\\s\\S]*){3}', hint: 'Do not delete scenarios.' },
  ],
  hints: [
    'Background runs before *every* scenario in the file, after any @Before hooks.',
    'A scenario that now starts with "And" should start with "Given" instead.',
  ],
  explanation: `\`Background\` is executed before each scenario in the feature (after \`@Before\` hooks). It keeps shared context in one place,
so a change to the login precondition is a one-line edit. Keep backgrounds **short** (2–4 lines) and business-relevant —
the reader must remember them while reading every scenario. Technical setup (opening the browser, clearing cookies) belongs in hooks, not in Background.`,
  mistakes: [
    'Putting When/Then steps in Background — it becomes a hidden part of every test.',
    'Huge Backgrounds that readers scroll past and forget.',
    'Using Background for technical setup like "Given the browser is open" — use a @Before hook.',
  ],
  interview: [
    { q: 'Background vs @Before hook — when do you use which?', a: 'Background is business context visible to readers (a logged-in shopper, an empty cart). Hooks are technical plumbing invisible in Gherkin (start driver, clear data, take screenshots).' },
    { q: 'Can a feature file have two Backgrounds?', a: 'One per Feature, and one per Rule block (Gherkin 6+). If scenarios need different context, split them into separate features or Rules.' },
  ],
}
