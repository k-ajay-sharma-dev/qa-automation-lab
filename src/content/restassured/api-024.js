export default {
  id: 'api-024',
  category: 'restassured',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Data-driven catalogue search with a Scenario Outline',
  level: 'BEGINNER',
  tags: ['gherkin', 'scenario-outline', 'examples', 'search', 'boundary-values'],
  estMinutes: 15,
  scenario: `The product owner wrote the acceptance criteria for catalogue search as a table in the story: search term,
how many products should be found, and "matching ignores upper/lower case". She also added "page size must be between
1 and 50". The first automated version is four nearly identical scenarios with the URL and query string in every step.
When she added a fifth search term she had to ask a developer to copy a scenario. You are asked to turn it into one
data-driven feature she can extend herself.`,
  description: `Rewrite \`catalogue-search.feature\`. The search behaviour (ShopEasy API, name contains the term, case-insensitive):

| Term | Products found |
|---|---|
| backpack | 1 |
| T-SHIRT | 1 |
| re | 2 (Classic Crew T-Shirt, Retro Red Tee) |
| umbrella | 0 |

**Rules**
- One \`Scenario Outline:\` for search with \`<term>\` and \`<count>\` placeholders and an \`Examples:\` table with a header row
  \`| term | count |\` and **all four** rows above (including the upper-case term and the zero-result term).
- A Then/And step that checks every product found has the term in its name.
- A second \`Scenario Outline:\` tagged \`@negative\` for page sizes outside 1–50, with the boundary values **0** and **51**
  (and anything else you like), expecting the request to be refused because of the size.
- No URLs, \`/api/\` paths or query strings (\`?q=\`) in the steps.`,
  starterCode: `Feature: Search

  Scenario: search backpack
    When I send GET "/api/products?q=backpack"
    Then the status is 200
    And the JSON path "total" is 1

  Scenario: search tshirt
    When I send GET "/api/products?q=T-SHIRT"
    Then the status is 200
    And the JSON path "total" is 1

  Scenario: search re
    When I send GET "/api/products?q=re"
    Then the status is 200
    And the JSON path "total" is 2

  Scenario: page size 0
    When I send GET "/api/products?size=0"
    Then the status is 400
`,
  solution: `@catalogue @search
Feature: Catalogue search
  Customers search the catalogue by product name.
  Matching ignores upper and lower case, and a page holds 1 to 50 products.

  Scenario Outline: Searching for "<term>" finds <count> product(s)
    When I search the catalogue for "<term>"
    Then <count> products are found
    And every product found has "<term>" in its name

    Examples:
      | term     | count |
      | backpack | 1     |
      | T-SHIRT  | 1     |
      | re       | 2     |
      | umbrella | 0     |

  @negative
  Scenario Outline: A page size of <size> is refused
    When I ask for a catalogue page with <size> products
    Then the request is refused because the "size" is invalid

    Examples:
      | size |
      | 0    |
      | 51   |
      | -1   |
`,
  checks: [
    { label: 'Uses a Scenario Outline', pattern: '^\\s*Scenario Outline:', hint: 'Scenario Outline: Searching for "<term>" finds <count> product(s)' },
    { label: 'Examples header has term and count', pattern: 'Examples:\\s*\\n\\s*\\|\\s*term\\s*\\|\\s*count\\s*\\|', hint: 'Examples:\n  | term | count |' },
    { label: 'Steps use the <term> and <count> placeholders', pattern: '^\\s*(When|Then|And) .*<term>[\\s\\S]*^\\s*(Then|And) .*<count>', hint: 'When I search the catalogue for "<term>"\nThen <count> products are found' },
    { label: 'Has a zero-result row and an upper-case term', pattern: '(\\|\\s*umbrella\\s*\\|\\s*0\\s*\\|[\\s\\S]*\\|\\s*T-SHIRT\\s*\\||\\|\\s*T-SHIRT\\s*\\|[\\s\\S]*\\|\\s*umbrella\\s*\\|\\s*0\\s*\\|)', hint: '| T-SHIRT | 1 |\n| umbrella | 0 |' },
    { label: 'Negative outline covers the size boundaries 0 and 51', pattern: '@negative[\\s\\S]*Scenario Outline:[\\s\\S]*\\|\\s*0\\s*\\|[\\s\\S]*\\|\\s*51\\s*\\|', hint: '@negative\nScenario Outline: A page size of <size> is refused ... | 0 | ... | 51 |' },
    { label: 'No URLs, paths or query strings', pattern: '(https?://|/api/|\\?\\w+=)', mustNot: true, hint: 'The step definition builds the request; the feature says what is searched.' },
  ],
  hints: [
    'A Scenario Outline runs once per Examples row, replacing <term> and <count> with that row\'s values.',
    'Placeholders can also appear in the scenario title, so each run gets a readable name in the report.',
    'Boundary values for "1 to 50": the invalid neighbours are 0 and 51.',
  ],
  explanation: `The Scenario Outline turns the product owner's table into executable examples: adding a search term is one new
row, no new Java. Putting \`<term>\` and \`<count>\` in the scenario title gives every run its own name in the report
(*Searching for "re" finds 2 product(s)*), so a failure points at the exact row.

Reviewers look for:
- **The interesting rows**: the upper-case term proves case-insensitivity, the zero-result term proves an empty search
  is a valid 200 answer and not an error, and "re" proves partial matching in the middle of a word.
- **A business check, not just a count**: "every product found has the term in its name" catches a search that returns
  the right number of *wrong* products.
- **Boundary values** in a separate negative outline: 0 and 51 are the invalid neighbours of 1 and 50 — the same
  technique you use for any input field.

The step definition for "I search the catalogue for {string}" does the \`queryParam("q", term)\`, stores the response in
the scenario context and the Then steps assert on it — the feature never sees HTTP.`,
  mistakes: [
    'Copying a scenario per search term — the feature grows with the data and drifts apart.',
    'Only testing terms that exactly match a whole name — partial and case-different terms are where search bugs live.',
    'Treating zero results as an error case — a search that finds nothing should still be a successful 200.',
    'Mixing valid and invalid data in one Examples table with if/else in the step definitions — split into two outlines.',
  ],
  interview: [
    { q: 'Scenario Outline vs a DataTable — what is the difference?', a: 'A Scenario Outline runs the whole scenario once per Examples row (separate results per row). A DataTable passes structured data to one step within one run, for example the lines of an order. Use an Outline for "same rule, many inputs".' },
    { q: 'Can a Scenario Outline have several Examples tables?', a: 'Yes, and each can carry its own tags and name, e.g. "Examples: valid terms" and "@negative Examples: invalid sizes". That lets you run or skip groups of rows with tag expressions while keeping one scenario template.' },
  ],
}
