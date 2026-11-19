export default {
  id: 'api-014',
  category: 'restassured',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Order API feature with a DataTable for the basket',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'datatable', 'orders', 'api-bdd'],
  estMinutes: 20,
  scenario: `The product owner wants the order API rules in the living documentation before the mobile release: "if I order
two backpacks and a bike light, I pay 69.97 plus 8 % tax". The first draft pasted a JSON body into a doc string and
had one step per product. The PO cannot read the JSON, and adding a product means adding a new step definition.`,
  description: `Write \`orders.feature\`.

**Rules**
- \`Background:\` the customer is logged in (\`Given I am logged in as "standard_user"\`).
- One scenario that places an order with a **DataTable** of products and quantities:

  | product | quantity |
  | Trailblazer Backpack | 2 |
  | Pulse Bike Light | 1 |

  and the customer details (Asha Rao, 560001) in the When step or a second table.
- Then steps check the status **201**, and the **subtotal 69.97, tax 5.60 and total 75.57**
  (a two-column key/value table is a good fit).
- A final step checks the order can be read back (e.g. \`And the order can be retrieved with status "PLACED"\`).
- No JSON, no URLs and no tokens in the feature file — the step definitions handle those.`,
  starterCode: `Feature: Orders

  Scenario: place order
    Given I have a token "se_1_0001_7374616e6461"
    When I POST to "/api/orders" with body
      """
      { "firstName": "Asha", "lastName": "Rao", "postalCode": "560001",
        "items": [ { "productId": 1, "quantity": 2 }, { "productId": 2, "quantity": 1 } ] }
      """
    Then the status code should be 201
    And the JSON path "total" should be 75.57
`,
  solution: `@orders
Feature: Place an order through the order API
  Customers order the products in their basket. The API prices the order
  and adds 8% sales tax on the subtotal.

  Background:
    Given I am logged in as "standard_user"

  @smoke
  Scenario: Order totals include 8% tax
    When I place an order for "Asha" "Rao" with postal code "560001" and these products:
      | product              | quantity |
      | Trailblazer Backpack | 2        |
      | Pulse Bike Light     | 1        |
    Then the order is created with status 201
    And the order totals are:
      | subtotal | 69.97 |
      | tax      | 5.60  |
      | total    | 75.57 |
    And the order can be retrieved with status "PLACED"
`,
  checks: [
    { label: 'Background logs the customer in', pattern: 'Background:\\s*\\n\\s*Given .*logged in', hint: 'Background:\n  Given I am logged in as "standard_user"' },
    { label: 'Product DataTable with a header row', pattern: '\\|\\s*product\\s*\\|\\s*quantity\\s*\\|', hint: '| product | quantity |' },
    { label: 'Both products in the table', pattern: '\\|\\s*Trailblazer Backpack\\s*\\|\\s*2\\s*\\|[\\s\\S]*\\|\\s*Pulse Bike Light\\s*\\|\\s*1\\s*\\|', hint: '| Trailblazer Backpack | 2 |\n| Pulse Bike Light | 1 |' },
    { label: 'Checks status 201', pattern: '^\\s*Then .*201', hint: 'Then the order is created with status 201' },
    { label: 'Checks the totals 69.97 / 5.60 / 75.57', pattern: '69\\.97[\\s\\S]*5\\.60[\\s\\S]*75\\.57', hint: 'And the order totals are:\n  | subtotal | 69.97 |\n  | tax | 5.60 |\n  | total | 75.57 |' },
    { label: 'No JSON, URLs or tokens', pattern: '(\\{\\s*"|/api/|https?://|"se_)', mustNot: true, hint: 'Move JSON, paths and tokens into step definitions.' },
  ],
  hints: [
    'A DataTable goes directly under its step, indented, header row first.',
    'A two-column table without a header (key | value) maps nicely to Map<String, String> in Java.',
    'Write the numbers the PO would check on a receipt.',
  ],
  explanation: `The DataTable turns the basket into something the product owner can read and edit: adding a third product is a
new row, not a new step definition. In Java the step receives a \`DataTable\` (or \`List<Map<String, String>>\`), turns
product **names** into ids (via the catalogue API or a lookup) and builds the \`OrderRequest\` POJO.

The vertical **key/value** table for totals reads like a receipt and maps to \`Map<String, String>\` — compare as
\`BigDecimal\` in the step to avoid rounding noise. 2 × 29.99 + 9.99 = 69.97, 8 % = 5.5976 → 5.60, total 75.57.

Keeping JSON, URLs and tokens out of Gherkin means the feature survives API refactors (renamed paths, new auth) and
stays documentation, while the step definitions and client classes absorb the technical change.`,
  mistakes: [
    'Pasting JSON request bodies into doc strings — unreadable for the business and brittle.',
    'One step per product ("And I add 2 backpacks") — the step library explodes.',
    'Using product ids in the table — "1" means nothing to the PO; resolve names to ids in code.',
    'Putting tokens in feature files — they expire and leak.',
  ],
  interview: [
    { q: 'When would you use a DataTable vs a Scenario Outline in API features?', a: 'A DataTable gives one request structured data (a basket, an address). A Scenario Outline runs the whole scenario once per Examples row — ideal for validation rules like "missing <field> gives a <code> error".' },
    { q: 'Should API features be declarative?', a: 'For business-facing documentation, yes — describe behaviour and data, not HTTP mechanics. Technical details belong in step definitions and client classes so they can change without rewriting scenarios.' },
  ],
}
