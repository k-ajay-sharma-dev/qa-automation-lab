export default {
  id: 'pw-015',
  category: 'playwright',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'login.feature for the Playwright + Cucumber suite',
  level: 'BEGINNER',
  tags: ['gherkin', 'scenario-outline', 'tags', 'bdd'],
  estMinutes: 15,
  scenario: `The business analysts want to keep reading the scenarios, so the new framework is **Cucumber + Playwright (TypeScript)** rather than
pure \`@playwright/test\` for the customer-facing flows. You own the first feature file. Your manual test cases for login in the test
management tool are: TC-01 valid login, TC-02 locked-out user, TC-03 wrong password, TC-04 empty username.`,
  description: `Write \`features/login.feature\`.

**Acceptance**
- A \`Feature:\` with a short user-story description and a \`Background:\` that puts the shopper on the login page.
- TC-01 as a \`Scenario:\` tagged \`@smoke\`: logging in as \`"standard_user"\` with \`"secret_sauce"\` shows the products page.
- TC-02…TC-04 as **one** \`Scenario Outline:\` tagged \`@regression\` with an \`Examples:\` table (\`username | password | error\`), using
  \`<username>\`, \`<password>\`, \`<error>\` placeholders. Errors on ShopEasy:
  \`Sorry, this user has been locked out.\` / \`Username and password do not match any user in this service\` / \`Username is required\`.
- Business language only — no clicks, field ids or button names in the steps.`,
  starterCode: `Feature: Login

  Scenario: TC-01 valid login
    Given I open "http://localhost:5180/practice-site/login.html"
    When I type "standard_user" into "#user-name"
    And I type "secret_sauce" into "#password"
    And I click the "Login" button
    Then I see "Products"

  # TODO: TC-02 locked out, TC-03 wrong password, TC-04 empty username
`,
  solution: `Feature: Login
  As a ShopEasy customer
  I want to log in with my account
  So that I can shop and check out

  Background:
    Given the shopper is on the login page

  @smoke
  Scenario: Registered shopper logs in successfully
    When the shopper logs in as "standard_user" with password "secret_sauce"
    Then the products page is shown

  @regression
  Scenario Outline: Login is refused with a clear message
    When the shopper logs in as "<username>" with password "<password>"
    Then the login error "<error>" is shown

    Examples:
      | username        | password     | error                                                       |
      | locked_out_user | secret_sauce | Sorry, this user has been locked out.                       |
      | standard_user   | wrong_pass   | Username and password do not match any user in this service |
      |                 | secret_sauce | Username is required                                        |
`,
  checks: [
    { label: 'Background puts the shopper on the login page', pattern: '^\\s*Background:\\s*\\n\\s*Given\\s+', hint: 'Background:\n    Given the shopper is on the login page' },
    { label: 'Happy path tagged @smoke', pattern: '@smoke\\s*\\n\\s*Scenario:', hint: '@smoke above the valid-login Scenario' },
    { label: 'Negative cases as a tagged Scenario Outline', pattern: '@regression\\s*\\n\\s*Scenario Outline:', hint: '@regression\n  Scenario Outline: Login is refused …' },
    { label: 'Placeholders used in the steps', pattern: '"<username>"[^\\n]*"<password>"', hint: 'When the shopper logs in as "<username>" with password "<password>"' },
    { label: 'Examples table with header row', pattern: 'Examples:\\s*\\n\\s*\\|\\s*username\\s*\\|\\s*password\\s*\\|\\s*error\\s*\\|', hint: '| username | password | error |' },
    { label: 'Locked-out row present', pattern: '\\|\\s*locked_out_user\\s*\\|', hint: '| locked_out_user | secret_sauce | Sorry, this user has been locked out. |' },
    { label: 'No UI details in steps', pattern: '(#\\w|\\bclick|\\btype\\b|button|https?:)', flags: 'mi', mustNot: true, hint: 'Describe what the shopper does, not which element is clicked.' },
  ],
  hints: [
    'A Background runs before every scenario in the file — perfect for "on the login page".',
    'Scenario Outline + Examples = one scenario per row; <name> placeholders are replaced by the column values.',
    'An empty cell gives an empty string — "<username>" becomes "" for the empty-username case.',
  ],
  explanation: `The feature file is the same whether the glue is Java/Selenium or TypeScript/Playwright — that is the point of BDD: the
**specification** does not know about the tool. The step "the shopper logs in as {string} with password {string}" will be implemented
once in \`login.steps.ts\` and reused by all four cases.

Tags drive execution: \`npx cucumber-js --tags @smoke\` runs only TC-01 on every commit; the \`@regression\` outline runs nightly. Keep the
Examples readable as a table — the BA can add a new negative case by adding a row, without touching code.`,
  mistakes: [
    'Writing one Scenario per negative case with copy-pasted steps instead of a Scenario Outline.',
    'Putting selectors, URLs or "click" in steps — the feature then breaks on every UI change.',
    'Forgetting the quotes around <username> while the step definition expects {string}.',
    'Tagging every scenario @smoke — a smoke pack should be a handful of critical paths.',
  ],
  interview: [
    { q: 'Background vs Before hook?', a: 'Background is visible business context in the feature file (preconditions a reader should see). A Before hook is technical setup in code (open browser, create context) that readers do not care about.' },
    { q: 'When do you use a Scenario Outline?', a: 'When the same behaviour must be checked with several data combinations. If the rows describe different behaviours, separate scenarios read better.' },
    { q: 'How do you run only smoke scenarios with cucumber-js?', a: 'npx cucumber-js --tags "@smoke" or a profile in cucumber.js that sets tags; tag expressions support and / or / not, e.g. "@regression and not @wip".' },
  ],
}
