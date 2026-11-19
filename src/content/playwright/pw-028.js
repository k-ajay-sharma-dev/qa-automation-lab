export default {
  id: 'pw-028',
  category: 'playwright',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'employee-directory.feature: search, sort and paging rules',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'rule', 'scenario-outline', 'data-tables', 'tables'],
  estMinutes: 20,
  scenario: `HR is replacing a spreadsheet with the employee directory on \`table.html\` (15 employees, 5 per page, search box, sortable columns).
The HR lead wrote the acceptance criteria in an email: *"Search must work on name, department and status. Sorting by salary must start
with the lowest paid. We must always see where we are in the list."* You are turning the email into a feature for the Cucumber +
Playwright suite. The first draft has a scenario called "test table" with 22 steps.`,
  description: `Write \`features/employee-directory.feature\`.

**Acceptance**
- Feature tagged \`@directory\`; \`Background:\` *Given HR is viewing the employee directory*.
- \`Rule: Search matches name, department and status\`
  - A \`Scenario Outline\` with \`Examples:\` columns \`term | count\`: \`QA\` → 3, \`Finance\` → 2, \`On Leave\` → 2, \`Chen\` → 1.
  - A scenario for a term with no match (\`Zorro\`) → the message \`No employees match your search.\`
- \`Rule: Sorting by salary starts with the lowest paid\` — one scenario whose \`Then\` has a **data table** \`| name | salary |\` with the first
  three rows: Fatima Khan \`$57,000\`, Sofia Rossi \`$58,000\`, Daniel Kim \`$60,000\`.
- \`Rule: The position in the list is always visible\` — first page shows \`Page 1 of 3\`; after moving to the next page the summary reads
  \`Showing 6–10 of 15 employees\`.
- Business language only: no clicks, buttons, inputs, selectors or URLs.`,
  starterCode: `Feature: test table

  Scenario: test table
    Given I open "http://localhost:5180/practice-site/table.html"
    When I type "QA" into "#table-search"
    Then I see 3 rows
    When I clear "#table-search"
    And I type "Finance" into "#table-search"
    Then I see 2 rows
    When I clear "#table-search"
    And I click the "Salary" header
    Then row 1 contains "Fatima Khan"
    And I click the "Next" button
    Then I see "Showing 6–10 of 15 employees"
`,
  solution: `@directory
Feature: Employee directory
  HR finds colleagues quickly instead of scrolling a spreadsheet.

  Background:
    Given HR is viewing the employee directory

  Rule: Search matches name, department and status

    Scenario Outline: Searching for "<term>"
      When HR searches for "<term>"
      Then <count> employees are listed

      Examples:
        | term     | count |
        | QA       | 3     |
        | Finance  | 2     |
        | On Leave | 2     |
        | Chen     | 1     |

    Scenario: A search without matches says so
      When HR searches for "Zorro"
      Then the directory says "No employees match your search."

  Rule: Sorting by salary starts with the lowest paid

    Scenario: Lowest salaries come first
      When HR sorts the directory by salary
      Then the first employees listed are:
        | name        | salary  |
        | Fatima Khan | $57,000 |
        | Sofia Rossi | $58,000 |
        | Daniel Kim  | $60,000 |

  Rule: The position in the list is always visible

    Scenario: Paging through the directory
      Then the directory shows "Page 1 of 3"
      When HR moves to the next page
      Then the directory shows "Showing 6–10 of 15 employees"
`,
  checks: [
    { label: 'Feature tag and Background', pattern: '@directory\\s*\\n\\s*Feature:[\\s\\S]*Background:\\s*\\n\\s*Given\\s+', hint: '@directory above Feature:, then Background: Given HR is viewing the employee directory' },
    { label: 'Three Rule: blocks', pattern: 'Rule:[\\s\\S]*Rule:[\\s\\S]*Rule:', hint: 'One Rule: per sentence of the HR email' },
    { label: 'Search outline with term and count', pattern: 'Scenario Outline:[\\s\\S]*"<term>"[\\s\\S]*Examples:\\s*\\n\\s*\\|\\s*term\\s*\\|\\s*count\\s*\\|', hint: 'Examples:\n        | term | count |' },
    { label: 'On Leave row (a status search)', pattern: '\\|\\s*On Leave\\s*\\|\\s*2\\s*\\|', hint: '| On Leave | 2 |' },
    { label: 'No-match scenario with the message', pattern: 'No employees match your search\\.', hint: 'Then the directory says "No employees match your search."' },
    { label: 'Sort result as a name/salary data table', pattern: ':\\s*\\n\\s*\\|\\s*name\\s*\\|\\s*salary\\s*\\|\\s*\\n\\s*\\|\\s*Fatima Khan\\s*\\|\\s*\\$57,000\\s*\\|', hint: 'Then the first employees listed are:\n        | name | salary |\n        | Fatima Khan | $57,000 |' },
    { label: 'No UI mechanics in steps', pattern: '(#\\w|\\bclick|\\btype\\b|button|\\binput\\b|header|https?:|\\brow \\d)', flags: 'mi', mustNot: true, hint: 'Write "HR searches for …", "HR sorts the directory by salary".' },
  ],
  hints: [
    'Each sentence of the HR email is a business rule — Rule: groups the examples that illustrate it.',
    'A count in an outline can be unquoted (<count>) and match {int} in the step definition.',
    "For the sorted list, a data table under the Then step keeps the expectation readable; the glue compares it with dataTable.hashes().",
  ],
  explanation: `The 22-step draft tested three rules in one scenario: when it failed, nobody knew which rule was broken, and the steps described
the page instead of the requirement. The rewrite maps the HR email one-to-one onto \`Rule:\` blocks — the HR lead can check that every
sentence has examples.

The search outline covers the three searchable fields (\`Chen\` → name, \`QA\`/\`Finance\` → department, \`On Leave\` → status) plus the
empty case, which a manual tester would never forget but a happy-path script often does.

Check the data before you hand it over: QA = Chen Wei, Rahul Verma, Noah Garcia; Finance = James Wilson, Hannah Muller; On Leave = Liam
Johnson, Ava Thompson. The lowest salaries are $57,000, $58,000, $60,000. 15 employees at 5 per page = 3 pages.

In the step definitions, "the first employees listed are:" reads the first rows with Playwright and compares them with
\`dataTable.hashes()\`; "HR sorts the directory by salary" clicks the column header inside a page object — the feature never needs to know.`,
  mistakes: [
    'One long scenario that checks search, sort and paging together.',
    'Steps that name the UI ("click the Salary header", "type into #table-search").',
    'Only testing searches that find something — the empty result is a separate behaviour with its own message.',
    'Expected data that was never checked against the real list (counts are easy to get wrong).',
  ],
  interview: [
    { q: 'When do you use Rule: in a feature file?', a: 'When a feature contains several business rules: each Rule groups the scenarios that illustrate it, so the feature reads like acceptance criteria with examples. Each Rule can also have its own Background.' },
    { q: 'How would you implement "the first employees listed are:" in TypeScript?', a: 'Take dataTable.hashes(), read the first N rows of the table through a page object, and compare row by row with web-first assertions (e.g. expect(rows.nth(i).getByRole("cell").first()).toHaveText(expected.name)).' },
    { q: 'How do you choose examples for a search feature?', a: 'Cover each searchable field, a multi-word value, case sensitivity if relevant, a term with no results, and boundary cases like an empty search — each row should exist for a reason.' },
  ],
}
