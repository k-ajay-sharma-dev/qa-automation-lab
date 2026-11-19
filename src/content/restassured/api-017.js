export default {
  id: 'api-017',
  category: 'restassured',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'From imperative HTTP steps to declarative API scenarios',
  level: 'ADVANCED',
  tags: ['gherkin', 'declarative', 'scenario-outline', 'negative-testing'],
  estMinutes: 25,
  scenario: `An audit of the API feature files found 40 scenarios written like Postman scripts: "When I send a POST request to
/api/cart/items with header Authorization …". When the cart path moved to \`/api/v2/basket\`, every scenario had to be
edited, and the product owner stopped reading the reports because "it's all HTTP". You are asked to rewrite the
basket-rules feature as the template for the rest: declarative, with one Scenario Outline for the rejection rules.`,
  description: `Rewrite the feature. The business rules behind it (ShopEasy cart API):

| Situation | Error code |
|---|---|
| quantity 0 | INVALID_QUANTITY |
| quantity 11 (max is 10) | INVALID_QUANTITY |
| product out of stock (Retro Red Tee) | OUT_OF_STOCK |
| product already in the basket | ITEM_ALREADY_IN_CART |

**Rules**
- \`Background:\` a logged-in customer with an empty basket.
- One happy-path \`Scenario:\` (add 2 Trailblazer Backpacks → basket shows 2 items, subtotal 59.98).
- One \`Scenario Outline:\` for the rejections, with \`<placeholders>\` and an \`Examples:\` table that includes the
  **reason** column (the error code). The "already in basket" row needs the product to be in the basket first — handle
  it with a column (e.g. \`<already in basket>\` yes/no) or keep it as a separate scenario.
- A scenario for a customer who is **not logged in**.
- No HTTP verbs (GET/POST/…), no paths, headers or JSON in the steps.`,
  starterCode: `Feature: Cart API

  Scenario: add item
    Given I set header "Authorization" to "Bearer abc123"
    When I send a POST request to "/api/cart/items" with body '{"productId":1,"quantity":2}'
    Then the response status code is 201
    And the JSON path "subtotal" is 59.98

  Scenario: quantity zero
    Given I set header "Authorization" to "Bearer abc123"
    When I send a POST request to "/api/cart/items" with body '{"productId":2,"quantity":0}'
    Then the response status code is 422

  Scenario: out of stock
    Given I set header "Authorization" to "Bearer abc123"
    When I send a POST request to "/api/cart/items" with body '{"productId":6,"quantity":1}'
    Then the response status code is 422

  Scenario: no token
    When I send a POST request to "/api/cart/items" with body '{"productId":1,"quantity":1}'
    Then the response status code is 401
`,
  solution: `@cart
Feature: Basket rules
  Customers add products to their basket before checking out.
  A basket holds each product once, 1 to 10 units, and only products in stock.

  Background:
    Given I am logged in as "standard_user"
    And my basket is empty

  @smoke
  Scenario: Add a product to the basket
    When I add 2 "Trailblazer Backpack" to my basket
    Then my basket contains 2 items
    And the basket subtotal is 59.98

  @negative
  Scenario Outline: Basket refuses <situation>
    Given "<product>" <already> in my basket
    When I add <quantity> "<product>" to my basket
    Then the item is refused with reason "<reason>"
    And my basket is unchanged

    Examples:
      | situation              | product              | already    | quantity | reason               |
      | a zero quantity        | Pulse Bike Light     | is not     | 0        | INVALID_QUANTITY     |
      | more than 10 units     | Pulse Bike Light     | is not     | 11       | INVALID_QUANTITY     |
      | an out-of-stock item   | Retro Red Tee        | is not     | 1        | OUT_OF_STOCK         |
      | a duplicate product    | Trailblazer Backpack | is already | 1        | ITEM_ALREADY_IN_CART |

  @negative @security
  Scenario: A visitor who is not logged in cannot use a basket
    Given I am not logged in
    When I add 1 "Trailblazer Backpack" to my basket
    Then I am asked to log in first
`,
  checks: [
    { label: 'Background with a logged-in customer', pattern: 'Background:[\\s\\S]*?Given .*logged in', hint: 'Background:\n  Given I am logged in as "standard_user"' },
    { label: 'Uses a Scenario Outline', pattern: '^\\s*Scenario Outline:', hint: 'Scenario Outline: Basket refuses <situation>' },
    { label: 'Examples table with a reason column', pattern: 'Examples:\\s*\\n\\s*\\|.*\\breason\\b.*\\|', hint: 'Examples:\n  | product | quantity | reason |' },
    { label: 'Steps use <placeholders>', pattern: '^\\s*(When|Then|And|Given) .*<\\w[\\w ]*>', hint: 'When I add <quantity> "<product>" to my basket' },
    { label: 'Covers the business error codes', pattern: 'INVALID_QUANTITY[\\s\\S]*OUT_OF_STOCK[\\s\\S]*ITEM_ALREADY_IN_CART', hint: 'One Examples row per rule.' },
    { label: 'Has a not-logged-in scenario', pattern: 'not logged in', hint: 'Given I am not logged in' },
    { label: 'No HTTP verbs, paths, headers or JSON', pattern: '(\\b(GET|POST|PUT|PATCH|DELETE)\\b|/api/|[Hh]eader|\\{")', mustNot: true, hint: 'Describe behaviour; step definitions know the HTTP details.' },
  ],
  hints: [
    'Ask "what would the PO say?" — "I add 2 backpacks to my basket", not "I POST to /api/cart/items".',
    'A Scenario Outline repeats the scenario once per Examples row, replacing each <placeholder>.',
    'The step definition maps a product name to its id and the "reason" to error.code.',
  ],
  explanation: `**Imperative** steps describe *how* (verbs, paths, headers, JSON). **Declarative** steps describe *what* the
system should do. The HTTP knowledge moves to step definitions and client classes, so a path change
(\`/api/cart/items\` → \`/api/v2/basket\`) is a one-line change in a client, and the feature stays readable documentation.

The **Scenario Outline** turns the business rule table into executable examples: one row per rule, the error code as
the "reason" column. A reviewer checks that:
- each row breaks exactly one rule,
- the expected reason is a stable code, not a message,
- "my basket is unchanged" asserts the side effect didn't happen (a refused add must not half-add).

Status codes can still be asserted — inside the "item is refused" step definition (422/409), where they belong.`,
  mistakes: [
    'Keeping HTTP details in steps "for flexibility" — you end up with a second, worse Postman.',
    'One generic step "the response status code is {int}" everywhere — the scenario no longer says what the rule is.',
    'Scenario Outlines with dozens of columns — split by rule or move data to a DataTable.',
    'Forgetting to assert that a refused action changed nothing.',
  ],
  interview: [
    { q: 'Imperative vs declarative Gherkin — which do you use for API tests?', a: 'Declarative for business-facing behaviour: it survives refactors and stakeholders read it. Some teams keep a small technical contract suite with HTTP-level steps for developers, but it is not the living documentation.' },
    { q: 'Where do status codes go in declarative API scenarios?', a: 'Into step definitions: "the item is refused with reason X" asserts the 4xx status and error.code together. The feature states the business outcome, the code verifies the protocol detail.' },
  ],
}
