export default {
  id: 'cuc-019',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Group login scenarios by business rule with Rule',
  level: 'BEGINNER',
  tags: ['gherkin', 'rule', 'living-documentation', 'login'],
  estMinutes: 15,
  scenario: `In the sprint review the product owner scrolled through \`login.feature\` and asked: "So what are the actual *rules* for logging in?"
Nobody could answer without reading every scenario. The file is a flat list of six scenarios in random order. Gherkin 6 added the
\`Rule\` keyword for exactly this: each business rule becomes a heading, and the scenarios under it are its examples.`,
  description: `Reorganise \`login.feature\` with \`Rule:\` blocks. The login page (\`login.html\`) behaves like this:

- empty username → \`Error: Username is required\`; empty password → \`Error: Password is required\`
- wrong combination → \`Error: Username and password do not match any user in this service\`
- \`locked_out_user\` with the right password → \`Error: Sorry, this user has been locked out.\`
- \`standard_user\` / \`secret_sauce\` → inventory page

**Rules**
- At least **two** \`Rule:\` blocks, each named after a business rule (a sentence a product owner would say, not "Rule 1").
- The first \`Rule\` comes before any scenario; every scenario sits under the rule it proves.
- Keep all the existing examples (you may use the keyword \`Example:\`, a synonym of \`Scenario:\`).
- The shared "on the login page" precondition appears only once (a \`Background\` at Feature level applies to every rule).`,
  starterCode: `Feature: Login

  Scenario: Locked out user
    Given the shopper is on the login page
    When the shopper logs in with "locked_out_user" and "secret_sauce"
    Then the login error "Error: Sorry, this user has been locked out." is shown

  Scenario: No username
    Given the shopper is on the login page
    When the shopper logs in with "" and "secret_sauce"
    Then the login error "Error: Username is required" is shown

  Scenario: Happy path
    Given the shopper is on the login page
    When the shopper logs in with "standard_user" and "secret_sauce"
    Then the inventory page is displayed

  Scenario: No password
    Given the shopper is on the login page
    When the shopper logs in with "standard_user" and ""
    Then the login error "Error: Password is required" is shown

  Scenario: Wrong password
    Given the shopper is on the login page
    When the shopper logs in with "standard_user" and "wrong_pass"
    Then the login error "Error: Username and password do not match any user in this service" is shown

  Scenario: Unknown user
    Given the shopper is on the login page
    When the shopper logs in with "guest_user" and "secret_sauce"
    Then the login error "Error: Username and password do not match any user in this service" is shown
`,
  solution: `@login
Feature: Login
  Only registered, active shoppers can enter ShopEasy.

  Background:
    Given the shopper is on the login page

  Rule: Username and password are both required

    Example: Username is missing
      When the shopper logs in with "" and "secret_sauce"
      Then the login error "Error: Username is required" is shown

    Example: Password is missing
      When the shopper logs in with "standard_user" and ""
      Then the login error "Error: Password is required" is shown

  Rule: Only a known username with its password opens the shop

    Example: Standard user logs in with the right password
      When the shopper logs in with "standard_user" and "secret_sauce"
      Then the inventory page is displayed

    Example: Wrong password is rejected
      When the shopper logs in with "standard_user" and "wrong_pass"
      Then the login error "Error: Username and password do not match any user in this service" is shown

    Example: Unknown username is rejected
      When the shopper logs in with "guest_user" and "secret_sauce"
      Then the login error "Error: Username and password do not match any user in this service" is shown

  Rule: A locked-out user cannot log in, even with the right password

    Example: locked_out_user is turned away
      When the shopper logs in with "locked_out_user" and "secret_sauce"
      Then the login error "Error: Sorry, this user has been locked out." is shown
`,
  checks: [
    { label: 'At least two Rule blocks', pattern: '(^\\s*Rule:\\s*\\S+[\\s\\S]*){2}', hint: 'Add "Rule: Username and password are both required" etc.' },
    { label: 'First Rule comes before any scenario', pattern: 'Feature:(?:(?!^\\s*(Scenario|Example)\\b)[\\s\\S])*^\\s*Rule:', hint: 'Every scenario must sit under a Rule heading.' },
    { label: 'Rules have meaningful names', pattern: '^\\s*Rule:\\s*(rule\\s*)?\\d*\\s*$', flags: 'mi', mustNot: true, hint: 'Name the business rule, e.g. "A locked-out user cannot log in".' },
    { label: 'All six examples kept', pattern: '(^\\s*(Scenario|Example):[\\s\\S]*){6}', hint: 'Do not lose any of the six scenarios.' },
    { label: 'Locked-out message still checked', pattern: 'Error: Sorry, this user has been locked out\\.', hint: 'Keep the locked_out_user example.' },
    { label: 'Login page precondition only once', pattern: '(on the login page[\\s\\S]*){2}', mustNot: true, hint: 'Move "Given the shopper is on the login page" into a Background.' },
  ],
  hints: [
    'Read the scenarios and ask "which rule does this prove?" — you will find three groups: required fields, valid credentials, locked-out users.',
    'Indent: Feature > Background / Rule > Example > steps. A Feature-level Background runs before every example in every rule.',
    '"Example:" is an exact synonym of "Scenario:" and reads naturally under a Rule.',
  ],
  explanation: `\`Rule\` (Gherkin 6, Cucumber 7 supports it fully) adds one level between Feature and Scenario: **business rule → concrete examples**.
That is the shape of "example mapping" in three-amigos sessions, and it lets a product owner read the rules as headings and only dive into the
examples when needed.

Details worth knowing:
- A Feature-level \`Background\` runs before every scenario in every Rule. A Rule may also have **its own** Background, which runs after the Feature's one,
  only for that Rule's scenarios.
- Tags can be put on a Rule and are inherited by its scenarios.
- The Rule title is documentation only — Cucumber does not match it against step definitions.

A flat list of scenarios answers "what did we test?". Rules answer "what are the rules of the system?" — that is living documentation.`,
  mistakes: [
    'Naming rules "Rule 1", "Negative cases" — a rule is a business statement, not a test category.',
    'Leaving some scenarios above the first Rule — they then belong to no rule and confuse readers.',
    'Putting steps directly under Rule: (outside a scenario) — Rule holds only an optional Background and scenarios.',
    'Creating one Rule per scenario — a rule usually has two or more examples (the happy one and the edge cases).',
  ],
  interview: [
    { q: 'What is the Rule keyword in Gherkin?', a: 'A grouping level introduced in Gherkin 6: a Rule states one business rule and contains the scenarios (examples) that illustrate it. It can have its own Background and tags.' },
    { q: 'How does Rule relate to example mapping?', a: 'Example mapping produces a story, its rules and concrete examples for each rule. Feature, Rule and Example in Gherkin map one to one onto that, so the session output becomes the feature file almost directly.' },
  ],
}
