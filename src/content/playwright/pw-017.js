export default {
  id: 'pw-017',
  category: 'playwright',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'From codegen recording to declarative Gherkin: seller registration',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'declarative', 'rule', 'codegen', 'scenario-outline'],
  estMinutes: 20,
  scenario: `A junior tester discovered \`npx playwright codegen\`, recorded the seller registration on \`form.html\`, and pasted every recorded
action into a feature file as a step. The scenario is 14 steps long, mentions \`#firstName\`, and the product owner said in refinement:
*"I can't tell what this test proves."* You are pairing with them to rewrite it so that each scenario states **one business rule**.`,
  description: `Rewrite \`features/seller-registration.feature\` declaratively.

**Acceptance**
- \`Feature:\` with a one-line purpose and a \`Background:\` *Given the seller is on the registration page*.
- A \`Rule:\` for **"A complete application is accepted"** with a \`@smoke\` scenario: the seller submits a valid application **with a trade
  licence** → the application is confirmed and shows the licence file name \`licence.pdf\`.
- A \`Rule:\` for **"Mandatory fields are validated"** with a \`@regression\` \`Scenario Outline:\` — the seller submits an application without
  \`<field>\` → sees \`<message>\`. Rows: first name / \`First name is required\`, last name / \`Last name is required\`, email / \`Email is required\`,
  country / \`Please select a country\`, terms / \`You must accept the terms\`.
- A scenario for an invalid email \`jane@\` → \`Enter a valid email address\`.
- No selectors, no "click", "fill", "type" or "select" in steps, maximum 4 steps per scenario.`,
  starterCode: `Feature: form

  Scenario: register
    Given I go to "http://localhost:5180/practice-site/form.html"
    When I click "#firstName"
    And I fill "#firstName" with "Jane"
    And I click "#lastName"
    And I fill "#lastName" with "Doe"
    And I fill "#email" with "jane.doe@example.com"
    And I select "IN" in "#country"
    And I set input files "licence.pdf" on "#upload-file"
    And I check "#terms"
    And I click "Register"
    Then I see "Thanks! Your seller application was submitted."
`,
  solution: `Feature: Seller registration
  Shoppers can apply to become ShopEasy sellers online.

  Background:
    Given the seller is on the registration page

  Rule: A complete application is accepted

    @smoke
    Scenario: Seller applies with a trade licence
      When the seller submits a valid application with the trade licence "licence.pdf"
      Then the application is confirmed
      And the confirmation lists the licence file "licence.pdf"

  Rule: Mandatory fields are validated

    @regression
    Scenario Outline: Application without <field> is rejected
      When the seller submits an application without <field>
      Then the seller sees the message "<message>"

      Examples:
        | field      | message                   |
        | first name | First name is required    |
        | last name  | Last name is required     |
        | email      | Email is required         |
        | country    | Please select a country   |
        | terms      | You must accept the terms |

    @regression
    Scenario: Application with an invalid email is rejected
      When the seller submits an application with the email "jane@"
      Then the seller sees the message "Enter a valid email address"
`,
  checks: [
    { label: 'Background for the starting page', pattern: 'Background:\\s*\\n\\s*Given\\s+', hint: 'Background:\n    Given the seller is on the registration page' },
    { label: 'At least two Rule: blocks', pattern: 'Rule:[\\s\\S]*Rule:', hint: 'Rule: A complete application is accepted … Rule: Mandatory fields are validated' },
    { label: 'Outline over the mandatory fields', pattern: 'Scenario Outline:[\\s\\S]*<field>[\\s\\S]*Examples:\\s*\\n\\s*\\|\\s*field\\s*\\|\\s*message\\s*\\|', hint: 'Scenario Outline … without <field> … Examples: | field | message |' },
    { label: 'Terms row present', pattern: '\\|\\s*terms\\s*\\|\\s*You must accept the terms\\s*\\|', hint: '| terms | You must accept the terms |' },
    { label: 'Invalid email scenario', pattern: 'Enter a valid email address', hint: 'Then the seller sees the message "Enter a valid email address"' },
    { label: 'Smoke tag on the happy path', pattern: '@smoke\\s*\\n\\s*Scenario:', hint: '@smoke above the valid application scenario' },
    { label: 'No selectors or UI verbs', pattern: '(#\\w|\\bclick|\\bfill\\b|\\btype\\b|\\bselect\\s+"|\\bcheck\\s+"|https?:)', flags: 'mi', mustNot: true, hint: 'Steps describe the business action: "submits a valid application".' },
  ],
  hints: [
    'Ask "what does the business care about?" — that the application is accepted, not that #firstName was clicked.',
    'Rule: (Gherkin 6+) groups scenarios that illustrate the same business rule.',
    'The glue for "submits an application without <field>" fills a valid application and leaves that one field out.',
  ],
  explanation: `Codegen is a great tool for **discovering locators** (it suggests getByRole/getByLabel) — its output belongs in page objects,
not in feature files. Imperative, recorded steps hide the intent, break on every UI change and are unreadable for the business.

The declarative version reads as a specification: two rules, each illustrated by examples. The Scenario Outline turns five manual
negative cases into one scenario with five rows. All the "how" (fill this field, tick terms, set the file) moves into one step definition
and the \`SellerRegistrationPage\` object, where Playwright's \`setInputFiles\`, \`selectOption\` and \`check()\` live.

A useful review rule: **at most 3–5 steps per scenario**; if you need more, you are describing UI mechanics.`,
  mistakes: [
    'Pasting codegen output into Gherkin — features become scripts.',
    'One giant scenario checking all validations at once — when it fails you do not know which rule broke.',
    'Hiding the expected message in the step definition ("Then an error is shown") — the outline should show the exact message.',
    'Using Rule: without understanding it needs Gherkin 6+ (Cucumber-JS 7+ supports it).',
  ],
  interview: [
    { q: 'Declarative vs imperative Gherkin?', a: 'Imperative steps describe UI interactions (click, type); declarative steps describe behaviour and intent (submits a valid application). Declarative scenarios are shorter, readable by the business and robust to UI changes because the mechanics live in step definitions and page objects.' },
    { q: 'What is the Rule keyword?', a: 'A Gherkin 6 keyword that groups scenarios illustrating one business rule inside a feature, making the feature read like a set of acceptance criteria with examples. It can have its own Background.' },
    { q: 'What is codegen good for in a BDD project?', a: 'Exploring the page and generating robust locators and action snippets for page objects quickly — not for writing feature files.' },
  ],
}
