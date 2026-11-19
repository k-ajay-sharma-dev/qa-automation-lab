export default {
  id: 'api-005',
  category: 'restassured',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Turn your Postman checks into a catalogue API feature',
  level: 'BEGINNER',
  tags: ['gherkin', 'feature-file', 'api', 'manual-to-automation'],
  estMinutes: 15,
  scenario: `For two years you tested the catalogue API by hand with a Postman collection. The team now wants those checks
as Cucumber scenarios so the product owner can read them in the living documentation. Your manual test cases were:
TC-1 list all products → 200 and 6 products; TC-2 get product 1 → 200 and name "Trailblazer Backpack";
TC-3 get product 99 → 404 with error code PRODUCT_NOT_FOUND. The first draft someone wrote is one huge scenario with
the full URL in every step.`,
  description: `Rewrite the feature file.

**Rules**
- A \`Feature:\` with a short description, and a \`Background:\` with the common precondition
  (e.g. \`Given the ShopEasy catalogue API is available\`).
- **Three separate scenarios** — one per test case — each with Given/When/Then.
- Status codes are visible in the Then steps (e.g. \`Then the response status is 200\`).
- The not-found scenario also checks the error code \`"PRODUCT_NOT_FOUND"\`.
- No full URLs (\`http://...\`) in the steps — the base URL belongs in configuration.
- Tag the scenarios: \`@smoke\` on the happy paths, \`@negative\` on the 404 case.`,
  starterCode: `Feature: Products

  Scenario: Test products API
    Given I set the URL to "http://localhost:5181/api/products"
    When I send GET
    Then status is 200
    And I set the URL to "http://localhost:5181/api/products/1"
    When I send GET
    Then status is 200
    And I set the URL to "http://localhost:5181/api/products/99"
    When I send GET
    Then status is 404
`,
  solution: `@catalogue
Feature: Product catalogue API
  The mobile app and the web shop read products from the catalogue API.
  These checks protect the product list and the product details screen.

  Background:
    Given the ShopEasy catalogue API is available

  @smoke
  Scenario: All products are listed
    When I request the list of products
    Then the response status is 200
    And the response contains 6 products

  @smoke
  Scenario: Product details are returned for an existing product
    When I request the product with id 1
    Then the response status is 200
    And the product name is "Trailblazer Backpack"

  @negative
  Scenario: A missing product returns a clear not-found error
    When I request the product with id 99
    Then the response status is 404
    And the error code is "PRODUCT_NOT_FOUND"
`,
  checks: [
    { label: 'Has a Background', pattern: '^\\s*Background:', hint: 'Background:\n  Given the ShopEasy catalogue API is available' },
    { label: 'At least three scenarios', pattern: '(Scenario:[\\s\\S]*){3}', hint: 'One scenario per manual test case.' },
    { label: 'Then steps show the status code', pattern: '^\\s*Then .*\\b(200|404)\\b', hint: 'Then the response status is 200' },
    { label: 'Checks the PRODUCT_NOT_FOUND error code', pattern: '"PRODUCT_NOT_FOUND"', hint: 'And the error code is "PRODUCT_NOT_FOUND"' },
    { label: 'No full URLs in steps', pattern: 'https?://', mustNot: true, hint: 'Keep the base URL in config; steps say what, not where.' },
    { label: 'Uses @smoke and @negative tags', pattern: '@smoke[\\s\\S]*@negative|@negative[\\s\\S]*@smoke', hint: 'Tag happy paths @smoke and the 404 case @negative.' },
  ],
  hints: [
    'One manual test case = one scenario. A scenario should fail for exactly one reason.',
    'Steps describe intent ("I request the product with id 99"), the step definition knows the URL.',
    'Tags go on the line above Scenario:.',
  ],
  explanation: `Splitting the giant scenario means a failure tells you *which* behaviour broke, and each scenario can run on its own
(\`--tags @smoke\` in the pipeline). The \`Background\` holds the shared precondition once.

Steps say **what** is checked in business-ish language; the step definitions (Java) hold the HTTP details — base URL
from config, \`GET /api/products/{id}\`, JSON paths. That keeps the feature readable for the product owner and stable
when the URL or host changes.

Checking the **error code** in the negative case is important: a 404 from a mistyped route (\`ROUTE_NOT_FOUND\`) and a
404 for a missing product look the same if you only check the status.`,
  mistakes: [
    'One long scenario with many When/Then pairs — the first failure hides everything after it.',
    'Hard-coding full URLs in steps — every environment change edits every feature file.',
    'Negative scenarios that only check the status code, not the error body.',
    'Forgetting tags, so the pipeline cannot run just the smoke set.',
  ],
  interview: [
    { q: 'Should HTTP details (URLs, JSON) be visible in Gherkin for API tests?', a: 'Mostly no. Business-facing features describe behaviour; HTTP details live in step definitions and clients. Some teams write a technical "API contract" feature for developers, but even then base URLs stay in config.' },
    { q: 'How did you migrate manual API test cases to automation?', a: 'Each Postman request plus its checks became a scenario: preconditions → Background/Given, the request → When, the Postman tests → Then. Shared values (base URL, tokens) moved to config and hooks, and tags mapped to the old suites (smoke, regression).' },
  ],
}
