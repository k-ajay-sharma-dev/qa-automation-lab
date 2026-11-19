export default {
  id: 'pw-016',
  category: 'playwright',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'cart.feature: Background, data tables and tags',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'data-tables', 'background', 'tags'],
  estMinutes: 20,
  scenario: `Release 3.4 changed how ShopEasy calculates tax (8%) and the BA wrote acceptance criteria as a table: *"Given a cart with these
products, the overview shows this item total, tax and total."* Your job is to turn the criteria into an executable cart feature for the
Cucumber + Playwright suite, readable enough that the BA can sign it off.`,
  description: `Write \`features/cart.feature\` tagged \`@cart\` at feature level.

**Acceptance**
- A \`Background:\` that logs the shopper in as \`"standard_user"\`.
- Scenario 1 (\`@smoke\`): the shopper adds the products listed in a **data table** (header \`| product |\`: *Trailblazer Backpack*,
  *Pulse Bike Light*); then the cart badge shows \`2\`.
- Scenario 2 (\`@regression\`): with the same two products in the cart, the shopper checks out as *Jane Doe*, postcode *10001*; the
  overview shows item total \`$39.98\`, tax \`$3.20\` and total \`$43.18\` — use a **two-column data table** (\`| item total | $39.98 |\` …).
- Scenario 3 (\`@regression\`): removing *Pulse Bike Light* from a cart with both products leaves **1** item.
- Declarative steps only (what, not how). Mark the unfinished promo-code scenario \`@wip\` so it does not run.`,
  starterCode: `Feature: Cart

  Scenario: add products
    Given I log in as "standard_user" with password "secret_sauce"
    When I click "Add to cart" on "Trailblazer Backpack"
    And I click "Add to cart" on "Pulse Bike Light"
    Then the badge shows 2

  Scenario: totals
    Given I log in as "standard_user" with password "secret_sauce"
    When I click "Add to cart" on "Trailblazer Backpack"
    And I click "Add to cart" on "Pulse Bike Light"
    And I click the cart icon
    And I click "Checkout"
    And I type "Jane" in "First Name"
    Then I see "$43.18"

  # TODO promo code BRIGHT25 (not built yet)
`,
  solution: `@cart
Feature: Shopping cart
  As a shopper
  I want my cart and order totals to be correct
  So that I pay the right amount

  Background:
    Given the shopper is logged in as "standard_user"

  @smoke
  Scenario: Added products are counted in the cart badge
    When the shopper adds these products to the cart:
      | product              |
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    Then the cart badge shows 2

  @regression
  Scenario: Checkout overview shows item total, 8% tax and total
    Given the cart contains:
      | product              |
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    When the shopper checks out as "Jane Doe" with postcode "10001"
    Then the order summary shows:
      | item total | $39.98 |
      | tax        | $3.20  |
      | total      | $43.18 |

  @regression
  Scenario: Removing a product updates the cart
    Given the cart contains:
      | product              |
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    When the shopper removes "Pulse Bike Light" from the cart
    Then the cart contains 1 product

  @wip
  Scenario: Promo code BRIGHT25 discounts the bike light
    Given the cart contains:
      | product          |
      | Pulse Bike Light |
    When the shopper applies the promo code "BRIGHT25"
    Then the order summary shows:
      | item total | $7.49 |
`,
  checks: [
    { label: 'Feature-level @cart tag', pattern: '^\\s*@cart\\s*\\n\\s*Feature:', hint: '@cart on the line above Feature:' },
    { label: 'Background logs in', pattern: 'Background:\\s*\\n\\s*Given\\s+[^\\n]*logged in', hint: 'Background:\n    Given the shopper is logged in as "standard_user"' },
    { label: 'Products passed as a one-column data table', pattern: ':\\s*\\n\\s*\\|\\s*product\\s*\\|\\s*\\n\\s*\\|\\s*Trailblazer Backpack\\s*\\|', hint: 'When the shopper adds these products to the cart:\n      | product |\n      | Trailblazer Backpack |' },
    { label: 'Totals as a two-column table', pattern: '\\|\\s*total\\s*\\|\\s*\\$43\\.18\\s*\\|', hint: '| total | $43.18 |' },
    { label: 'Scenarios tagged @smoke / @regression', pattern: '@smoke[\\s\\S]*@regression', hint: 'Tag each scenario' },
    { label: 'Unfinished scenario tagged @wip', pattern: '@wip\\s*\\n\\s*Scenario', hint: '@wip above the promo-code scenario' },
    { label: 'No UI mechanics in steps', pattern: '(\\bclick|\\btype\\b|cart icon|button)', flags: 'mi', mustNot: true, hint: 'Steps describe intent: "adds these products", "checks out as …".' },
  ],
  hints: [
    'A data table goes directly under a step that ends with a colon; each row starts and ends with |.',
    "In TypeScript the step receives a DataTable: dataTable.hashes() for header rows, dataTable.rowsHash() for two-column key/value tables.",
    'Tags on the Feature line are inherited by every scenario in the file.',
  ],
  explanation: `**Data tables** keep test data visible to the business: the BA reads the expected totals as a table, exactly like their
acceptance criteria. In the step definition, \`dataTable.hashes()\` turns \`| product |\` rows into \`[{ product: 'Trailblazer Backpack' }, …]\`
and \`dataTable.rowsHash()\` turns the summary table into \`{ 'item total': '$39.98', tax: '$3.20', total: '$43.18' }\`.

"Given the cart contains:" describes **state**, not clicks — the glue may add products through the UI today and through an API or
sessionStorage tomorrow without changing the feature. The \`@wip\` tag plus \`tags: 'not @wip'\` in the default \`cucumber.js\` profile keeps
unfinished work out of the pipeline while still in version control.

Check the maths before you sign off: $29.99 + $9.99 = $39.98; 8% tax = $3.1984 → $3.20; total $43.18.`,
  mistakes: [
    'Repeating the login steps in every scenario instead of a Background.',
    'Writing the expected totals inside the step text ("Then total is $43.18 and tax is $3.20 and …") — a table is clearer and easier to extend.',
    'Leaving unfinished scenarios untagged so they fail the nightly run.',
    'Using a Background for steps that only some scenarios need.',
  ],
  interview: [
    { q: 'How do you read a Cucumber data table in TypeScript?', a: 'Declare a DataTable parameter: hashes() for a table with a header row (array of objects), rows() for raw rows without header, rowsHash() for two-column key/value tables, raw() for everything.' },
    { q: 'What is the difference between a data table and Examples?', a: 'A data table is an argument to one step, used once. Examples belong to a Scenario Outline and run the whole scenario once per row.' },
    { q: 'How do you keep work-in-progress scenarios out of CI?', a: 'Tag them @wip and exclude with a tag expression (not @wip) in the default profile or CI command.' },
  ],
}
