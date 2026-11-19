export default {
  id: 'cuc-028',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Living documentation: specify the BRIGHT25 promo code before it is built',
  level: 'ADVANCED',
  tags: ['gherkin', 'rule', 'living-documentation', 'bdd', 'three-amigos', 'scenario-outline'],
  estMinutes: 30,
  scenario: `The inventory page already shows a banner: *"Deal of the day: Pulse Bike Light now only $7.49 with code BRIGHT25 at checkout"* — but
the checkout has no promo code field yet. Story **SHOP-311** is in refinement. In the three-amigos session the PO, a developer and you agreed on
the rules and examples. Your job: write the feature file **before** development starts, so it becomes the acceptance criteria, the automated
test and the documentation in one.`,
  description: `**SHOP-311** — As a shopper I want to apply the deal-of-the-day code so that I pay less for the Pulse Bike Light.

Acceptance criteria agreed in refinement:
1. \`BRIGHT25\` lowers the Pulse Bike Light from $9.99 to **$7.49** (25 % off, rounded down to the cent).
2. Other products keep their price — the code affects only the Pulse Bike Light.
3. Any other code is rejected with **\`Error: Promo code is not valid\`** and the prices do not change.

Tax stays 8 % of the item total. Worked numbers: Bike Light alone with the code → item total $7.49, tax $0.60, total **$8.09**.
Backpack ($29.99) + Bike Light with the code → item total $37.48, tax $3.00, total **$40.48**.

**Rules**
- \`Feature\` with the user story as its description; tags \`@wip\` (not built yet) and the ticket \`@SHOP-311\`.
- One \`Rule:\` per acceptance criterion (at least 2), each with concrete examples — real products and real amounts, never "a discount is applied".
- A \`Scenario Outline\` with several rejected codes (e.g. a typo, a lower-case variant, an old code, an empty code) under the rejection rule.
- Declarative: no clicks, fields or buttons — the UI does not exist yet!`,
  starterCode: `# SHOP-311 promo code BRIGHT25 - draft from the refinement notes
Feature: Promo code

  Scenario: discount works
    Given the user is logged in
    When the user types BRIGHT25 in the promo field and clicks Apply
    Then a discount is applied

  Scenario: wrong code
    When the user types a wrong code
    Then an error is shown
`,
  solution: `@checkout @promo @wip @SHOP-311
Feature: Deal-of-the-day promo code
  As a shopper
  I want to apply the deal-of-the-day code at checkout
  So that I pay less for the Pulse Bike Light

  Background:
    Given the shopper is logged in as "standard_user"

  Rule: BRIGHT25 lowers the Pulse Bike Light to $7.49

    Example: Bike light alone with the code
      Given the shopper has "Pulse Bike Light" in the cart
      When the shopper applies the promo code "BRIGHT25" at checkout
      Then the price of "Pulse Bike Light" is "$7.49"
      And the item total is "$7.49"
      And the tax is "$0.60"
      And the total is "$8.09"

  Rule: The code only changes the price of the Pulse Bike Light

    Example: Backpack keeps its price next to a discounted bike light
      Given the shopper has "Trailblazer Backpack" in the cart
      And the shopper has "Pulse Bike Light" in the cart
      When the shopper applies the promo code "BRIGHT25" at checkout
      Then the price of "Trailblazer Backpack" is "$29.99"
      And the price of "Pulse Bike Light" is "$7.49"
      And the total is "$40.48"

  Rule: Any other code is rejected and prices stay the same

    Scenario Outline: Code "<code>" is rejected (<reason>)
      Given the shopper has "Pulse Bike Light" in the cart
      When the shopper applies the promo code "<code>" at checkout
      Then the promo error "Error: Promo code is not valid" is shown
      And the price of "Pulse Bike Light" is "$9.99"

      Examples:
        | code      | reason                |
        | BRIGHT24  | typo in the number    |
        | bright25  | lower-case variant    |
        | SAVE10    | an old campaign code  |
        |           | empty code            |
`,
  checks: [
    { label: 'Tagged @wip and with the ticket id', pattern: '^(?=[\\s\\S]*@wip\\b)(?=[\\s\\S]*@[A-Z]+-\\d+)', hint: '@wip @SHOP-311 above the Feature' },
    { label: 'User story in the Feature description', pattern: '^\\s*As an? \\w+', flags: 'mi', hint: 'As a shopper / I want ... / So that ...' },
    { label: 'At least two Rules', pattern: '(^\\s*Rule:\\s*\\S+[\\s\\S]*){2}', hint: 'One Rule per acceptance criterion.' },
    { label: 'Concrete discounted price $7.49', pattern: '\\$7\\.49', hint: 'Then the price of "Pulse Bike Light" is "$7.49"' },
    { label: 'A concrete total ($8.09 or $40.48)', pattern: '\\$(8\\.09|40\\.48)', hint: 'Show the total the shopper pays.' },
    { label: 'Rejected codes as an Outline with Examples', pattern: '^\\s*Scenario (Outline|Template):[\\s\\S]*^\\s*Examples:[\\s\\S]*Promo code is not valid|Promo code is not valid[\\s\\S]*^\\s*Examples:', hint: 'Scenario Outline + Examples with BRIGHT24, bright25, SAVE10 …' },
    { label: 'Declarative: no UI words', pattern: '\\b(click|clicks|type|types|field|button)\\b', flags: 'mi', mustNot: true, hint: 'Say "applies the promo code", not "types it in the field and clicks Apply".' },
  ],
  hints: [
    'Structure: Feature (story) > Background (login) > Rule per acceptance criterion > concrete Examples under each Rule.',
    'Use the worked numbers from the description — specification by example means real values, not "a discount".',
    'Rejection rows are equivalence classes: a typo, case, an old code, empty. Keep them in an Examples table under the rejection Rule.',
  ],
  explanation: `This is BDD as it was intended: the feature file is written **before** the code, from the rules and examples the three amigos agreed on.
It now serves three audiences:

- **PO / BA** — reads the Rules as the acceptance criteria and the Examples as their meaning ("25 % off" is ambiguous; "$9.99 → $7.49" is not).
- **Developer** — gets concrete numbers including rounding and tax, and the exact error text.
- **QA** — gets the automated acceptance test; \`@wip\` keeps it out of CI until the story is done, \`@SHOP-311\` links report and ticket.

Notice what the examples settled that the story did not: lower-case codes are **rejected** (a business decision), the rounding goes down to $7.49,
tax is computed after the discount. Questions like these are exactly what example mapping is meant to surface early.

Because the steps are declarative, they will survive whatever UI design the developer chooses for the promo field. When the story is done,
remove \`@wip\` and the scenarios join the regression pack as living documentation.`,
  mistakes: [
    'Vague outcomes ("a discount is applied") — they cannot fail and document nothing.',
    'Describing a UI that does not exist yet ("types in the promo field") — it will be wrong as soon as the design changes.',
    'One Rule with every example in it — the PO can no longer see which criterion each example proves.',
    'Forgetting @wip — the new scenarios turn the CI build red before development has even started.',
  ],
  interview: [
    { q: 'What is living documentation?', a: 'Feature files that describe the system\'s rules with concrete examples and are executed on every build, so the documentation can never silently go out of date. Reports generated from them show what the system does today.' },
    { q: 'What happens in a three-amigos / example-mapping session?', a: 'PO, developer and tester take a story, list its rules, and find concrete examples (and open questions) for each rule. The output maps directly to Feature, Rule and Example in Gherkin.' },
    { q: 'Why write scenarios before the feature is built?', a: 'Concrete examples expose misunderstandings and missing rules (rounding, case-sensitivity, error text) before code exists, which is far cheaper than finding them in testing. The same scenarios then become the acceptance tests.' },
  ],
}
