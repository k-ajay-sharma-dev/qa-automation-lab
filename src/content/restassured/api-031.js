export default {
  id: 'api-031',
  category: 'restassured',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Profile API rules with Rule: blocks and a refusal Examples table',
  level: 'ADVANCED',
  tags: ['gherkin', 'rule-keyword', 'scenario-outline', 'put-vs-patch', 'security'],
  estMinutes: 30,
  scenario: `The profile API (\`/api/users/{id}\`) is about to be used by the partner portal, and the BA wants its business rules in
the living documentation before the partner team starts. The current feature file is 14 scenarios in one flat list,
written as HTTP calls ("When I send PATCH to /api/users/1 with body ..."), and nobody can tell which scenario proves
which rule. Since Cucumber 7 supports Gherkin's \`Rule:\` keyword, the lead asks you to group the examples under the
rules they illustrate.`,
  description: `The rules of the ShopEasy profile API (user 1 is \`standard_user\`, Asha Rao, city Bengaluru):

| Rule | Behaviour |
|---|---|
| A partial update changes only what is sent | change only the phone → email and address stay as they were |
| A full replacement needs the complete profile | replacing the profile with only a first name → refused, the missing fields are named |
| Protected or invalid values are refused | email \`asha.rao\` or \`asha@\` → \`INVALID_EMAIL\`; username or roles → \`READ_ONLY_FIELD\` |
| Customers can only change their own profile | changing visual_user's profile → refused as forbidden; not logged in → asked to log in |

**Rules for the feature**
- A feature-level \`Background:\` with the logged-in customer.
- At least **three** \`Rule:\` blocks, each with its own scenario(s).
- The refusals are a \`Scenario Outline:\` with an \`Examples:\` table that has a **reason** column (the error code), covering
  \`INVALID_EMAIL\` and \`READ_ONLY_FIELD\`.
- The partial-update scenario checks that the other details are **unchanged** / **still** the same.
- A scenario about **another customer's** profile.
- Declarative: no HTTP verbs (GET/PUT/PATCH…), no \`/api/\` paths, headers or JSON.`,
  starterCode: `Feature: Users API

  Scenario: patch phone
    Given I have a token for "standard_user"
    When I send PATCH to "/api/users/1" with body '{"phone":"+91-80-5550-9999"}'
    Then the status is 200

  Scenario: put only first name
    Given I have a token for "standard_user"
    When I send PUT to "/api/users/1" with body '{"firstName":"Asha"}'
    Then the status is 400

  Scenario: bad email
    Given I have a token for "standard_user"
    When I send PATCH to "/api/users/1" with body '{"email":"asha.rao"}'
    Then the status is 422

  Scenario: other user
    Given I have a token for "standard_user"
    When I send PATCH to "/api/users/3" with body '{"phone":"1"}'
    Then the status is 403
`,
  solution: `@profile
Feature: Customer profile
  Customers keep their contact details and delivery address up to date.
  The partner portal uses the same rules.

  Background:
    Given I am logged in as "standard_user"

  Rule: A partial update changes only the details that are sent

    Scenario: Changing the phone number keeps the rest of the profile
      When I change my phone number to "+91-80-5550-9999"
      Then my phone number is "+91-80-5550-9999"
      And my email is still "asha.rao@shopeasy.test"
      And my delivery city is still "Bengaluru"

  Rule: Replacing the profile requires every detail

    Scenario: A replacement with only a first name is refused
      When I replace my whole profile with only the first name "Asha"
      Then the change is refused because details are missing
      And the missing details include "email" and "address"
      And my profile is unchanged

  Rule: Protected and invalid values are refused

    @negative
    Scenario Outline: Setting the <detail> to "<value>" is refused
      When I change my <detail> to "<value>"
      Then the change is refused with reason "<reason>"
      And my profile is unchanged

      Examples:
        | detail   | value     | reason          |
        | email    | asha.rao  | INVALID_EMAIL   |
        | email    | asha@     | INVALID_EMAIL   |
        | username | hacker    | READ_ONLY_FIELD |
        | roles    | ADMIN     | READ_ONLY_FIELD |

  Rule: Customers can only change their own profile

    @security
    Scenario: Changing another customer's profile is forbidden
      When I try to change the phone number of customer "visual_user"
      Then the change is refused as forbidden
      And the profile of "visual_user" is unchanged

    @security
    Scenario: A visitor who is not logged in cannot change a profile
      Given I am not logged in
      When I try to change the phone number of customer "standard_user"
      Then I am asked to log in first
`,
  checks: [
    { label: 'Feature-level Background with a logged-in customer', pattern: 'Background:\\s*\\n\\s*Given .*logged in', hint: 'Background:\n  Given I am logged in as "standard_user"' },
    { label: 'At least three Rule: blocks', pattern: '(^\\s*Rule:[\\s\\S]*){3}', hint: 'Rule: A partial update changes only the details that are sent' },
    { label: 'Refusals as a Scenario Outline with a reason column', pattern: 'Scenario Outline:[\\s\\S]*Examples:\\s*\\n\\s*\\|.*\\breason\\b.*\\|', hint: 'Examples:\n  | detail | value | reason |' },
    { label: 'Covers INVALID_EMAIL and READ_ONLY_FIELD', pattern: '(INVALID_EMAIL[\\s\\S]*READ_ONLY_FIELD|READ_ONLY_FIELD[\\s\\S]*INVALID_EMAIL)', hint: 'One row per protected or invalid value.' },
    { label: 'Partial update checks that other details did not change', pattern: '^\\s*(Then|And) .*\\b(unchanged|still)\\b', hint: 'And my email is still "asha.rao@shopeasy.test"' },
    { label: "Has a scenario about another customer's profile", pattern: '(another|other) customer', hint: "Scenario: Changing another customer's profile is forbidden" },
    { label: 'No HTTP verbs, paths, headers or JSON', pattern: '(\\b(GET|POST|PUT|PATCH|DELETE)\\b|/api/|[Hh]eader|\\{")', mustNot: true, hint: 'Say "change" and "replace", not PATCH and PUT.' },
  ],
  hints: [
    'Rule: sits between Feature and Scenario; each Rule groups the examples that illustrate one business rule.',
    'PUT vs PATCH in business words: "replace my whole profile" vs "change my phone number".',
    'The interesting assertion in a partial update is what did NOT change.',
  ],
  explanation: `\`Rule:\` (Gherkin 6+, supported by Cucumber 7) adds a level between Feature and Scenario: the **rule** is the
business statement, the scenarios below it are the **examples** that prove it. This is Example Mapping written down —
the BA reads the rules, a failing scenario shows which rule is broken, and gaps are obvious (a rule without examples).

What a reviewer checks:
- **PUT vs PATCH without saying PUT or PATCH**: "replace my whole profile" and "change my phone number" carry the
  meaning; the step definitions pick the HTTP method.
- **Unchanged checks**: the partial update asserts the email and city are still the same, and every refusal asserts
  "my profile is unchanged" — a refused request must not half-apply.
- **One Scenario Outline per kind of refusal**, with the stable error code in the reason column, never the message.
- **Security as a rule of its own**: someone else's profile (403) and not logged in (401) are business rules too.

A Rule may also have its own \`Background:\`, which runs after the feature's Background for the scenarios in that rule —
useful when only one rule needs extra setup.`,
  mistakes: [
    'Writing PUT/PATCH in the steps — the feature then documents HTTP instead of the business rule.',
    'Asserting only the changed field after a partial update — the original incident was a wiped address.',
    'Rules with titles that are not rules ("Rule: Email tests") — state the behaviour ("Invalid emails are refused").',
    'Putting every refusal into its own copy-pasted scenario instead of one outline with a reason column.',
  ],
  interview: [
    { q: 'What does the Rule keyword add to Gherkin?', a: 'It groups scenarios under the business rule they illustrate, between Feature and Scenario, optionally with its own Background. Reports and readers can see rule by rule which examples pass, which matches the Example Mapping workshop format.' },
    { q: 'How do you describe PUT vs PATCH in a declarative feature?', a: 'By the business intent: "replace the whole profile" (requires every detail) vs "change only the phone number" (everything else stays). The step definitions map those intents to PUT and PATCH, and the Then steps prove what changed and what did not.' },
  ],
}
