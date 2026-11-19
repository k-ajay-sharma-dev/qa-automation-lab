export default {
  id: 'cuc-036',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Seller registration: validation messages as a Scenario Outline',
  level: 'BEGINNER',
  tags: ['gherkin', 'scenario-outline', 'validation', 'form'],
  estMinutes: 15,
  scenario: `ShopEasy is launching seller sign-up (\`form.html\`). In the last release a missing "Email is required" message
slipped to production because nobody re-tested every required field. Your manual test sheet has one row per invalid input —
the team wants it as a feature file that a BA can read and extend without touching Java.`,
  description: `Validation rules on the **Become a ShopEasy seller** form (button **Register**):

| Input left wrong | Message shown under the field |
|---|---|
| First name empty | First name is required |
| Last name empty | Last name is required |
| Email empty | Email is required |
| Email \`asha.example.com\` | Enter a valid email address |
| No country selected | Please select a country |
| Seller terms not accepted | You must accept the terms |

When everything is valid the page shows *"Thanks! Your seller application was submitted."*

Write \`seller-registration.feature\`.

**Rules**
- One **Scenario Outline** with an **Examples** table covering at least 4 of the rows above (field + message columns).
- Use \`<placeholders>\` in the steps — no copy-pasted scenarios per field.
- A separate happy-path **Scenario** checks the success banner.
- Describe business behaviour: no element ids (\`firstName-error\`, \`submit-btn\`) and no "click".`,
  starterCode: `Feature: Registration

  Scenario: First name
    Given I open form.html
    When I leave firstName empty and click submit-btn
    Then firstName-error shows "First name is required"

  Scenario: Last name
    Given I open form.html
    When I leave lastName empty and click submit-btn
    Then lastName-error shows "Last name is required"
`,
  solution: `@registration @regression
Feature: Seller registration form validation
  A seller can only apply when the required details are complete and valid.

  Background:
    Given a visitor is on the seller registration page

  Scenario Outline: A missing or invalid "<field>" blocks the application
    Given the visitor has filled in a valid application
    When the visitor submits the application with <field> set to "<value>"
    Then the message "<message>" is shown for <field>
    And the application is not submitted

    Examples:
      | field      | value            | message                     |
      | first name |                  | First name is required      |
      | last name  |                  | Last name is required       |
      | email      |                  | Email is required           |
      | email      | asha.example.com | Enter a valid email address |
      | country    |                  | Please select a country     |

  Scenario: Accepting the terms is mandatory
    Given the visitor has filled in a valid application
    When the visitor submits the application without accepting the seller terms
    Then the message "You must accept the terms" is shown for the seller terms

  Scenario: A complete application is submitted
    Given the visitor has filled in a valid application
    When the visitor submits the application
    Then the confirmation "Thanks! Your seller application was submitted." is shown
`,
  checks: [
    { label: 'Uses a Scenario Outline', pattern: '^\\s*Scenario (Outline|Template):', hint: 'Scenario Outline: A missing "<field>" blocks the application' },
    { label: 'Has an Examples table with a message column', pattern: '^\\s*Examples:[\\s\\S]*\\|\\s*\\w+\\s*\\|[^\\n]*message', flags: 'mi', hint: '| field | value | message |' },
    { label: 'Uses placeholders in steps', pattern: '<\\w+>', hint: 'Then the message "<message>" is shown for <field>' },
    { label: 'Covers real messages', pattern: '(Email is required|Enter a valid email address)[\\s\\S]*(First name is required|Please select a country)|(First name is required|Please select a country)[\\s\\S]*(Email is required|Enter a valid email address)', hint: 'Copy the exact messages from the table.' },
    { label: 'Happy path checks the success banner', pattern: 'Thanks! Your seller application was submitted', hint: 'Add a Scenario for a complete application.' },
    { label: 'No element ids or clicks', pattern: '\\bclick|-error\\b|submit-btn|\\.html', flags: 'mi', mustNot: true, hint: 'Describe the behaviour, not the DOM.' },
  ],
  hints: [
    'Every row of your manual sheet becomes one row of the Examples table.',
    'Start from a valid application and break exactly one field per row — that is how you isolate the rule.',
    'Keep the happy path as its own Scenario so the outline stays about failures.',
  ],
  explanation: `A validation matrix is the textbook case for **Scenario Outline**: the steps are identical and only the data changes.

- "Given the visitor has filled in a valid application" + "with <field> set to <value>" breaks **one** field at a time, so each row proves exactly one rule (the classic equivalence-partition approach you already use manually).
- The exact messages live in the Examples table, so a BA can add "Mobile number is invalid" later by adding a row, not Java.
- The terms checkbox is a different kind of input, so a separate scenario reads better than forcing "accepted / not accepted" into the value column.
- The happy path proves the rules do not block a correct application — without it, a form that rejects *everything* would pass.`,
  mistakes: [
    'One copy-pasted Scenario per field — six places to change when the wording changes.',
    'Leaving several fields empty in one row: the test passes even if only one message appears.',
    'Writing element ids such as firstName-error in the Gherkin instead of the user-visible message.',
    'Forgetting the happy path, so a form that always fails still looks green.',
  ],
  interview: [
    { q: 'How do you pass an empty value from an Examples table?', a: 'Leave the cell empty; the placeholder is replaced by an empty string, and {string} matches "" in the step. Some teams prefer an explicit marker like <blank> mapped in the step definition, which is easier to read.' },
    { q: 'When would you NOT use a Scenario Outline for validation?', a: 'When rows need different steps or different outcomes (e.g. one redirects, one shows an error). Forcing them into one outline creates conditional logic in step definitions; separate scenarios are clearer.' },
  ],
}
