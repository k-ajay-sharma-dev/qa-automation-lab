export default {
  id: 'cuc-001',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Turn your manual test case into your first Scenario',
  level: 'BEGINNER',
  tags: ['gherkin', 'feature', 'manual-to-bdd'],
  estMinutes: 15,
  scenario: `Sprint 3 on the ShopEasy team: the product owner wants the regression pack to become "living documentation".
Your manual test case **TC-LOGIN-01** lives in a spreadsheet. The SDET lead asks you to move it into a \`.feature\` file so
business people can read it and automation can execute it. You already wrote the hard part — the steps and expected results.`,
  description: `Here is the manual test case:

| # | Step | Test data | Expected result |
|---|------|-----------|-----------------|
| Pre | User is on \`login.html\` | — | Login form is shown |
| 1 | Enter username | standard_user | — |
| 2 | Enter password | secret_sauce | — |
| 3 | Click **Login** | — | Inventory page (\`inventory.html\`) opens |
| 4 | Check page title | — | Title shows **Products** |

Write \`login.feature\` with one \`Feature\` and one \`Scenario\`.

**Rules**
- \`Feature:\` line with a short business title, plus a 1–3 line description (the "As a… I want… so that…" format is fine).
- Precondition → \`Given\`, actions → \`When\` (+ \`And\`), expected results → \`Then\` (+ \`And\`).
- Put the test data (\`standard_user\`, \`secret_sauce\`) inside quotes so a step definition can capture it later.
- One \`Then\` per expected result — do not merge them into one giant step.`,
  starterCode: `# TC-LOGIN-01 converted to Gherkin
# Pre: user is on the login page
# 1. enter standard_user  2. enter secret_sauce  3. click Login
# Expected: inventory page opens, title is Products

Feature:

  Scenario:
    # TODO: Given ...
    # TODO: When ...
    # TODO: Then ...
`,
  solution: `Feature: Login to ShopEasy
  As a registered shopper
  I want to log in with my username and password
  So that I can browse and buy products

  Scenario: Standard user logs in with valid credentials
    Given the shopper is on the login page
    When the shopper enters username "standard_user" and password "secret_sauce"
    And the shopper submits the login form
    Then the inventory page is displayed
    And the page title is "Products"
`,
  checks: [
    { label: 'Has a Feature with a title', pattern: '^\\s*Feature:\\s*\\S+', hint: 'Start with "Feature: Login to ShopEasy".' },
    { label: 'Has a named Scenario', pattern: '^\\s*Scenario:\\s*\\S+', hint: 'Give the scenario a name that says what is being proven.' },
    { label: 'Precondition is a Given step', pattern: '^\\s*Given\\s+\\S+', hint: 'The pre-condition (on the login page) becomes Given.' },
    { label: 'Action is a When step', pattern: '^\\s*When\\s+\\S+', hint: 'Entering credentials / clicking Login is the When.' },
    { label: 'Expected result is a Then step', pattern: '^\\s*Then\\s+\\S+', hint: 'Each expected result becomes Then / And.' },
    { label: 'Test data is quoted', pattern: '"standard_user"', hint: 'Write "standard_user" in double quotes so {string} can capture it.' },
  ],
  hints: [
    'Column "Pre" maps to Given, "Step" maps to When/And, "Expected result" maps to Then/And.',
    'Write steps in the third person from the user\'s point of view: "the shopper enters…".',
    'Given the shopper is on the login page / When … enters username "standard_user" and password "secret_sauce" / Then the inventory page is displayed.',
  ],
  explanation: `Your manual test case already *is* a scenario — Gherkin just gives it a strict shape:

- **Given** = state before the test (preconditions). No user action.
- **When** = the one behaviour you are testing (the action).
- **Then** = observable outcome (your expected result column).
- **And / But** continue whichever keyword came before.

Quoting test data (\`"standard_user"\`) matters: later a step definition with \`{string}\` captures it, so the same step works for
every user. A reviewer checks that the scenario name states the *rule* being proven, that each Then is something a user can
observe, and that the file reads naturally to a product owner.`,
  mistakes: [
    'Copying step numbers ("Step 1: …") into Gherkin — the keywords already give the order.',
    'Putting the expected result inside a When ("When I click login and see products").',
    'Hard-coding data in the step text without quotes, so every user needs a new step definition.',
    'Leaving the Scenario name empty or generic ("Test 1") — it shows up in every report.',
  ],
  interview: [
    { q: 'How do you convert a manual test case into Gherkin?', a: 'Preconditions become Given, the actions under test become When (with And for extra actions), expected results become Then. Test data goes in quotes or tables so steps are reusable. I also rename the test to a behaviour-focused scenario title.' },
    { q: 'Who is the audience of a feature file?', a: 'Product owners, BAs, developers and testers. It must be readable without knowing Selenium — it is executable documentation of business rules, not a test script.' },
  ],
}
