export default {
  id: 'cuc-027',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'When Background hurts: trim an overgrown Background',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'background', 'refactoring', 'independence'],
  estMinutes: 20,
  scenario: `Someone took "remove duplication with Background" very seriously. \`cart-and-checkout.feature\` now has a six-line Background that
logs in, fills the cart, opens the cart page, **starts checkout and fills the form**. The scenarios are one-liners that nobody understands
without scrolling up, and the two cart scenarios have to *undo* the checkout first. A BA asked: "Where is the action in these tests?"`,
  description: `Refactor the feature so every scenario is understandable on its own.

**Rules**
- The \`Background\` keeps only context that **every** scenario needs (the login) — at most 2 steps, and no \`When\`/\`Then\`.
- Each scenario arranges its own cart in \`Given\` steps and has its own \`When\` (its behaviour).
- No scenario may "undo" Background steps (no "goes back to the cart page").
- Keep all the checks: item total \`$39.98\`, tax \`$3.20\`, total \`$43.18\`, removing a product, and the empty-cart message.

Real values from the shop: Trailblazer Backpack $29.99 + Pulse Bike Light $9.99 = $39.98; tax 8 % = $3.20; total $43.18.`,
  starterCode: `Feature: Cart and checkout

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper has "Trailblazer Backpack" in the cart
    And the shopper has "Pulse Bike Light" in the cart
    And the shopper is on the cart page
    When the shopper proceeds to checkout
    And the shopper enters customer details "Asha" "Rao" "560001"

  Scenario: Item total
    Then the item total is "$39.98"

  Scenario: Tax
    Then the tax is "$3.20"
    And the total is "$43.18"

  Scenario: Remove product
    Given the shopper goes back to the cart page
    When the shopper removes "Pulse Bike Light" from the cart
    Then the cart contains only "Trailblazer Backpack"

  Scenario: Empty cart
    Given the shopper goes back to the cart page
    And the shopper removes "Pulse Bike Light" from the cart
    When the shopper removes "Trailblazer Backpack" from the cart
    Then the message "Your cart is empty. Add something from the products page." is shown
`,
  solution: `Feature: Cart and checkout
  Shoppers review their cart and see the full price, including 8% tax, before ordering.

  Background:
    Given the shopper is logged in as "standard_user"

  Scenario: Checkout overview adds 8% tax to the item total
    Given the shopper has "Trailblazer Backpack" in the cart
    And the shopper has "Pulse Bike Light" in the cart
    When the shopper checks out as "Asha" "Rao" with postal code "560001"
    Then the item total is "$39.98"
    And the tax is "$3.20"
    And the total is "$43.18"

  Scenario: Removing one product keeps the other in the cart
    Given the shopper has "Trailblazer Backpack" in the cart
    And the shopper has "Pulse Bike Light" in the cart
    When the shopper removes "Pulse Bike Light" from the cart
    Then the cart contains only "Trailblazer Backpack"

  Scenario: Removing the last product shows the empty-cart message
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper removes "Trailblazer Backpack" from the cart
    Then the message "Your cart is empty. Add something from the products page." is shown
`,
  checks: [
    { label: 'Background has no When/Then', pattern: 'Background:(?:(?!Scenario)[\\s\\S])*^\\s*(When|Then)\\b', mustNot: true, hint: 'An action in the Background is a hidden part of every test.' },
    { label: 'Background is short (max 2 steps)', pattern: 'Background:\\s*\\n(\\s*(Given|And|But)\\b[^\\n]*\\n){3,}', mustNot: true, hint: 'Keep only the login in the Background.' },
    { label: 'Background still logs in', pattern: 'Background:\\s*\\n\\s*Given[^\\n]*logged in', hint: 'Given the shopper is logged in as "standard_user"' },
    { label: 'Scenarios arrange their own cart', pattern: 'Scenario:[^\\n]*\\n\\s*Given[^\\n]*in the cart', hint: 'Start scenarios with: Given the shopper has "…" in the cart' },
    { label: 'Every scenario has a When before its Then', pattern: 'Scenario:[^\\n]*\\n(?:(?!^\\s*(When|Scenario)\\b)[\\s\\S])*?^\\s*Then\\b', mustNot: true, hint: 'Each scenario needs its own behaviour (When).' },
    { label: 'No "undo" steps', pattern: 'goes back to', mustNot: true, hint: 'If a scenario has to undo the Background, that setup does not belong there.' },
    { label: 'Totals still checked', pattern: '^(?=[\\s\\S]*\\$39\\.98)(?=[\\s\\S]*\\$3\\.20)(?=[\\s\\S]*\\$43\\.18)', hint: 'Keep item total $39.98, tax $3.20 and total $43.18.' },
  ],
  hints: [
    'Ask of every Background line: "does EVERY scenario need this?" Only the login survives.',
    'Checkout is the behaviour of the totals scenario — it becomes that scenario\'s When.',
    'Item total, tax and total are one behaviour (the overview prices); they can share one scenario with And-Thens.',
  ],
  explanation: `A Background is a trade-off: less duplication, but the reader has to **remember** hidden steps while reading every scenario. It
stops paying off when:

- it contains **actions** (When) — the behaviour under test is no longer visible in the scenario;
- it holds setup that only **some** scenarios need — the others start "undoing" it, which is unreadable and slow;
- it is **long** — readers skip it, and the scenarios become one-line mysteries.

Rule of thumb: 1–3 lines of context that every scenario shares. Repeating a short, meaningful Given in two scenarios is fine — Gherkin
optimises for readability, not for zero duplication (DAMP, not DRY). If scenarios need very different setup, split them into separate
features or \`Rule\` blocks with their own Background.`,
  mistakes: [
    'Treating Background like a @Before hook for everything — hooks are for technical setup, Background for short shared business context.',
    'Keeping scenarios with only a Then step — they no longer describe a behaviour.',
    'Removing the important cart contents from the scenarios — the reader must see which products give $39.98.',
    'Splitting the tax checks into separate scenarios that each repeat the whole checkout — group checks of the same behaviour.',
  ],
  interview: [
    { q: 'What are the risks of a long Background?', a: 'Readers lose context, scenarios become unreadable on their own, every scenario pays for setup it may not need, and some scenarios have to undo it. Keep it short and only for context shared by all scenarios.' },
    { q: 'DRY or DAMP for feature files?', a: 'DAMP — descriptive and meaningful phrases. Some repetition of short Givens is acceptable if each scenario reads as a complete example; DRY belongs in the step definitions and page objects.' },
  ],
}
