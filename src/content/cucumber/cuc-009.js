export default {
  id: 'cuc-009',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Tag scenarios for smoke and regression runs',
  level: 'BEGINNER',
  tags: ['tags', 'smoke', 'regression'],
  estMinutes: 10,
  scenario: `The CI pipeline must run a 5-minute **smoke** pack on every merge and the full **regression** pack nightly.
Right now there are no tags, so every run executes everything. You know from manual testing which cases are smoke — now mark them in Gherkin.`,
  description: `Add tags to \`checkout.feature\`.

**Rules**
- \`@checkout\` on the **Feature** (inherited by every scenario).
- \`@regression\` on every scenario (or once on the Feature).
- \`@smoke\` only on the happy-path scenario.
- \`@wip\` on the scenario that is still being built so CI can exclude it with \`not @wip\`.
- Tags go on the line **above** the keyword, start with \`@\`, no spaces inside a tag.`,
  starterCode: `Feature: Checkout

  Scenario: Shopper completes checkout with valid details
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper checks out with valid customer details
    Then the order confirmation is shown

  Scenario: Postal code is mandatory
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper checks out without a postal code
    Then the checkout error "Error: Postal Code is required" is shown

  Scenario: Discount code is applied
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper applies discount code "SAVE10"
    Then the total is reduced by 10 percent
`,
  solution: `@checkout @regression
Feature: Checkout

  @smoke
  Scenario: Shopper completes checkout with valid details
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper checks out with valid customer details
    Then the order confirmation is shown

  Scenario: Postal code is mandatory
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper checks out without a postal code
    Then the checkout error "Error: Postal Code is required" is shown

  @wip
  Scenario: Discount code is applied
    Given the shopper has "Trailblazer Backpack" in the cart
    When the shopper applies discount code "SAVE10"
    Then the total is reduced by 10 percent
`,
  checks: [
    { label: '@checkout on the Feature', pattern: '@checkout[^\\n]*\\n\\s*Feature:', hint: 'Put @checkout on the line above "Feature:".' },
    { label: 'Has @regression', pattern: '@regression\\b', hint: 'Tag the feature (or each scenario) with @regression.' },
    { label: '@smoke on the happy path', pattern: '@smoke[^\\n]*\\n\\s*Scenario:\\s*Shopper completes checkout', hint: '@smoke above the "completes checkout" scenario.' },
    { label: '@smoke used only once', pattern: '(@smoke[\\s\\S]*){2,}', mustNot: true, hint: 'Smoke = only the critical path.' },
    { label: '@wip on the unfinished scenario', pattern: '@wip[^\\n]*\\n\\s*Scenario:\\s*Discount', hint: '@wip above "Discount code is applied".' },
  ],
  hints: [
    'Tags on Feature are inherited by all its scenarios (and Examples inherit from their Outline).',
    'Several tags can share a line: @checkout @regression',
  ],
  explanation: `Tags are labels that the runner filters on with **tag expressions**:

- \`@smoke\` → only smoke
- \`@regression and not @wip\` → nightly run without unfinished work
- \`@checkout or @cart\` → one area

Run from Maven: \`mvn test -Dcucumber.filter.tags="@smoke"\`. Tags also feed hooks (\`@Before("@db")\`) and appear in reports, so they double
as your test-management metadata (you can even tag Jira ids, e.g. \`@SHOP-142\`). Keep the vocabulary small and documented — 50 ad-hoc tags help nobody.`,
  mistakes: [
    'Tagging everything @smoke — the smoke pack becomes as slow as regression.',
    'Writing tags below the Scenario line or with spaces ("@ smoke").',
    'Forgetting that Feature-level tags are inherited, then duplicating them on every scenario.',
  ],
  interview: [
    { q: 'How do you run only smoke tests in Cucumber?', a: 'Use a tag expression: mvn test -Dcucumber.filter.tags="@smoke", or tags = "@smoke" in @CucumberOptions / cucumber.properties. The command-line property overrides the annotation.' },
    { q: 'What else are tags used for besides filtering?', a: 'Conditional hooks (@Before("@api")), linking scenarios to tickets, marking known bugs or wip, and grouping results in reports.' },
  ],
}
