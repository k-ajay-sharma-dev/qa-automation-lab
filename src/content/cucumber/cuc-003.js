export default {
  id: 'cuc-003',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Rewrite an imperative scenario declaratively',
  level: 'BEGINNER',
  tags: ['gherkin', 'declarative', 'refactoring'],
  estMinutes: 15,
  scenario: `A teammate recorded the "add to cart" check click by click. Last sprint the login button id changed and the
feature file had to be edited in 14 places. The lead asks you to rewrite it declaratively so UI details never leak into Gherkin again.`,
  description: `Rewrite the scenario below so it describes **behaviour**, not UI mechanics.

**Rules**
- No CSS ids, XPaths, "click", "type", "field" or "button" words in the steps.
- Login collapses into a single \`Given\` (it is context, not what we are testing).
- Keep the data that matters to the business: the product name and the expected badge count.
- Exactly one \`When\` (the behaviour) and at least one \`Then\`.`,
  starterCode: `Feature: Shopping cart

  Scenario: add item
    Given I open "http://localhost:5180/practice-site/login.html"
    When I type "standard_user" into the "#user-name" field
    And I type "secret_sauce" into the "#password" field
    And I click the "#login-button" button
    And I click the button "#add-to-cart-trailblazer-backpack"
    Then the element ".shopping-cart-badge" has text "1"
`,
  solution: `Feature: Shopping cart
  Shoppers collect products in a cart before checking out.

  Scenario: Adding a product updates the cart badge
    Given the shopper is logged in as "standard_user"
    When the shopper adds "Trailblazer Backpack" to the cart
    Then the cart badge shows 1
`,
  checks: [
    { label: 'No CSS ids / selectors in steps', pattern: '"[#.][\\w-]+"|//\\w', mustNot: true, hint: 'Selectors belong in page objects, not in Gherkin.' },
    { label: 'No click/type UI verbs', pattern: '\\b(click|clicks|type|types|field|button)\\b', flags: 'mi', mustNot: true, hint: 'Say what the shopper achieves, e.g. "adds … to the cart".' },
    { label: 'No URL in Gherkin', pattern: 'https?://', mustNot: true, hint: 'The base URL is configuration, not behaviour.' },
    { label: 'Login is a single Given', pattern: '^\\s*Given\\s+.*log(ged|s)?\\s*in', flags: 'mi', hint: 'Given the shopper is logged in as "standard_user"' },
    { label: 'Exactly one When', pattern: '^\\s*When[\\s\\S]*^\\s*When', mustNot: true, hint: 'One behaviour per scenario.' },
    { label: 'Has a Then with the expected count', pattern: '^\\s*Then\\s+.*\\d', hint: 'Then the cart badge shows 1' },
  ],
  hints: [
    'Ask "what would the product owner say?" — "a logged-in shopper adds the backpack and sees 1 in the cart".',
    'Login is not the behaviour under test here, so it becomes Given context.',
  ],
  explanation: `The declarative version has **three** steps instead of seven and contains zero UI details. When the login button id
changes, only \`LoginPage\` changes — the feature file and the step definitions stay the same. Notice the scenario title
now states the rule ("Adding a product updates the cart badge"). Reviewers reject feature files with selectors, URLs and click/type verbs because
they turn Gherkin into a slower, harder-to-read Selenium script.`,
  mistakes: [
    'Hiding selectors behind friendlier names but still clicking field by field ("When I click the login button").',
    'Keeping login as When — it makes it look like login is what is being tested.',
    'Removing the important data too: the expected count still belongs in the Then.',
  ],
  interview: [
    { q: 'Where should UI details like locators live in a Cucumber framework?', a: 'In page objects. Step definitions call page-object methods; feature files only describe behaviour. That gives one place to fix when the UI changes.' },
    { q: 'What is the cost of imperative Gherkin?', a: 'Brittle and long feature files, duplicated steps, nobody from the business reads them, and every UI change ripples into many scenarios.' },
  ],
}
