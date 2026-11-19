export default {
  id: 'cuc-005',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Scenario Outline: valid, invalid and locked-out logins',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'scenario-outline', 'examples', 'data-driven'],
  estMinutes: 15,
  scenario: `Your manual login suite has six near-identical test cases that differ only by username, password and expected
message (valid user, wrong password, empty username, locked_out_user…). Copy-pasting six scenarios is how drift starts.
Turn them into one data-driven \`Scenario Outline\`.`,
  description: `Replace the duplicated scenarios with **one** \`Scenario Outline\` and an \`Examples\` table.

Cover at least these rows:

| username | password | outcome |
|---|---|---|
| standard_user | secret_sauce | inventory page |
| standard_user | wrong_pass | "Error: Username and password do not match any user in this service" |
| locked_out_user | secret_sauce | "Error: Sorry, this user has been locked out." |
| *(empty)* | secret_sauce | "Error: Username is required" |

**Rules**
- Use placeholders \`<username>\`, \`<password>\` and one placeholder for the expected result.
- Placeholders inside quotes in the steps, e.g. \`"<username>"\`.
- Give the outline a title containing a placeholder so each row is readable in reports.
- (Bonus) Split into two outlines or two \`Examples:\` blocks: successful vs rejected logins.`,
  starterCode: `Feature: Login

  Scenario: Locked out user cannot log in
    Given the shopper is on the login page
    When the shopper logs in with "locked_out_user" and "secret_sauce"
    Then the login error "Error: Sorry, this user has been locked out." is shown

  Scenario: Wrong password
    Given the shopper is on the login page
    When the shopper logs in with "standard_user" and "wrong_pass"
    Then the login error "Error: Username and password do not match any user in this service" is shown

  # TODO: replace all of this with a Scenario Outline + Examples
`,
  solution: `Feature: Login
  Only active users with the right password can enter the shop.

  Scenario: Standard user logs in successfully
    Given the shopper is on the login page
    When the shopper logs in with "standard_user" and "secret_sauce"
    Then the inventory page is displayed

  Scenario Outline: Login is rejected for <case>
    Given the shopper is on the login page
    When the shopper logs in with "<username>" and "<password>"
    Then the login error "<error>" is shown
    And the shopper stays on the login page

    Examples:
      | case            | username        | password     | error                                                                |
      | wrong password  | standard_user   | wrong_pass   | Error: Username and password do not match any user in this service |
      | locked out user | locked_out_user | secret_sauce | Error: Sorry, this user has been locked out.                         |
      | empty username  |                 | secret_sauce | Error: Username is required                                          |
      | empty password  | standard_user   |              | Error: Password is required                                          |
`,
  checks: [
    { label: 'Uses Scenario Outline', pattern: '^\\s*Scenario (Outline|Template):', hint: 'Change "Scenario:" to "Scenario Outline:".' },
    { label: 'Has an Examples table', pattern: '^\\s*Examples:\\s*\\n\\s*\\|', hint: 'Examples: followed by a | header | row |' },
    { label: 'Uses <username> placeholder', pattern: '<username>', hint: 'Write "<username>" in the When step.' },
    { label: 'Uses <password> placeholder', pattern: '<password>', hint: 'Write "<password>" in the When step.' },
    { label: 'Covers locked_out_user', pattern: '\\|\\s*locked_out_user\\s*\\|', hint: 'Add a row for locked_out_user.' },
    { label: 'At least 3 data rows', pattern: 'Examples:\\s*\\n(\\s*\\|.*\\|\\s*\\n){4,}', hint: 'Header + at least 3 rows.' },
  ],
  hints: [
    'The header row of Examples names the placeholders: | username | password | error |',
    'An empty cell is a valid value — it becomes an empty string.',
    'Mixing success and failure in one outline needs an "outcome" column with branching; splitting is cleaner.',
  ],
  explanation: `A \`Scenario Outline\` is a template: Cucumber runs it once per \`Examples\` row and substitutes \`<placeholder>\` with the cell.
It is the Gherkin version of your manual "test data table" — the classic equivalence-partition / boundary set becomes rows.

Splitting success from failure keeps each outline about **one rule**. Forcing both into one outline means a step like
"Then the result is <outcome>" with an if/else in Java — that hides logic in code and makes reports harder to read.
A placeholder in the title (\`<case>\`) makes each row's name meaningful in the HTML report.`,
  mistakes: [
    'Forgetting the quotes around "<username>", so the step definition with {string} does not match.',
    'Header names that do not match the placeholders (typo → the literal text "<usrname>" is sent).',
    'One outline with an "expected" column that sometimes is a page and sometimes an error message — branching in step code.',
    'Using Examples for 200 rows of data — that is a data-driven unit test, not a business example.',
  ],
  interview: [
    { q: 'Scenario vs Scenario Outline?', a: 'A Scenario runs once with fixed data. A Scenario Outline is a template run once per Examples row, with <placeholders> replaced by cell values — ideal when only data changes.' },
    { q: 'Can you tag individual Examples blocks?', a: 'Yes. You can have several Examples blocks under one outline, each with its own tags (e.g. @smoke on the critical rows) and an optional name.' },
    { q: 'How do you pick the rows?', a: 'Same as manual test design: equivalence classes and boundaries that represent distinct business rules — not every possible combination.' },
  ],
}
