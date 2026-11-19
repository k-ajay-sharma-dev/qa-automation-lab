export default {
  slug: 'gherkin-from-manual-test-case',
  category: 'cucumber',
  order: 1,
  title: 'From manual test case to Gherkin scenario',
  minutes: 7,
  summary: 'Turn a spreadsheet test case (precondition, steps, data, expected results) into a readable Feature and Scenario.',
  manualAnalogy: `You already write test cases with a precondition, numbered steps, test data and expected results. Gherkin is the
same thing in a fixed, plain-English format: the precondition becomes \`Given\`, the steps become \`When\`, the expected
results become \`Then\`. The difference is that a tool (Cucumber) can read this file and run it.`,
  body: `## What BDD and Gherkin are

**BDD** (Behaviour-Driven Development) is a way of working where the product owner, developer and tester agree on
examples of behaviour *before* or while the feature is built. Those examples are written in **Gherkin**, a simple
language with a handful of keywords. The file has the extension \`.feature\` and lives in
\`src/test/resources/features\` in a Maven project.

Cucumber is the tool that reads \`.feature\` files and, for every line, runs a matching Java method (a *step
definition* - see the *Step definitions and Cucumber expressions* lesson). So one file serves two readers: business
people read it as documentation, Cucumber executes it as a test.

## Your test case, mapped

Take a manual test case for the cart page:

| # | Step | Data | Expected |
|---|------|------|----------|
| Pre | Logged in, on inventory page | standard_user | Products shown |
| 1 | Add a product to the cart | Pulse Bike Light | Badge shows 1 |
| 2 | Open the cart | - | Product is listed |

In Gherkin:

\`\`\`gherkin
Feature: Shopping cart
  As a shopper
  I want to collect products in a cart
  So that I can buy them together

  Scenario: Added product appears in the cart
    Given the shopper is logged in as "standard_user"
    When the shopper adds "Pulse Bike Light" to the cart
    Then the cart badge shows 1
    And the cart lists "Pulse Bike Light"
\`\`\`

Line by line:

- \`Feature:\` - the title of the whole file, like the name of your test suite. The indented lines under it are free
  text (a description); Cucumber ignores them, humans read them. "As a... I want... so that..." is a common style.
- \`Scenario:\` - one test case. Its name should say what behaviour is checked, like a good test case title.
- \`Given\` - the **precondition / starting state**. Not something we are testing, just setting the stage.
- \`When\` - the **action** the user takes. This is the behaviour under test.
- \`Then\` - an **expected result**. This is where the check (assertion) happens.
- \`And\` / \`But\` - continue the previous keyword so the text reads naturally. \`And\` after a \`Then\` is still a
  check; \`But\` is used for a contrasting check ("But the error message is not shown").

## The keyword is for humans

Here is a surprise for most beginners: Cucumber does **not** treat \`Given\`, \`When\`, \`Then\`, \`And\` and \`But\`
differently when it looks for the Java method. It matches the *text after the keyword*. The keywords exist so a
reader can see at a glance which line is setup, which is action and which is verification. That is exactly why using
the right keyword matters: a \`Then\` that clicks a button, or a \`Given\` that checks a result, confuses every reader
even though it still runs.

## Quote your test data

Notice \`"standard_user"\` and \`"Pulse Bike Light"\` are in double quotes, and the number \`1\` is bare. This is not
decoration. Quoted text and plain numbers are easy for a step definition to *capture* as parameters, so the same Java
method can work for any user or any product. Rule of thumb: anything that came from your "Test data" column goes in
quotes (or is a number).

## One expected result per Then

In the spreadsheet you may have written "Badge shows 1 and product listed" in one cell. In Gherkin, split them:
one \`Then\`, then \`And\` for each further expected result. When the scenario fails, the report shows exactly
*which* expectation broke, just like ticking individual expected results in a test run.

## Indentation and comments

Indentation is only for readability (two spaces is the convention). A line starting with \`#\` is a comment. Keep
one Feature per file and name the file after it, for example \`cart.feature\`.`,
  keyPoints: [
    'Precondition = Given, action = When, expected result = Then; And/But continue the previous keyword.',
    'Cucumber matches the step text, not the keyword - keywords exist for the reader.',
    'Put test data in double quotes (and numbers bare) so step definitions can capture it.',
    'One expected result per Then/And line, so failures point at a single expectation.',
    'One Feature per .feature file, stored under src/test/resources/features.',
  ],
  mistakes: [
    'Writing the whole test case in one giant Then line. Fix: one expectation per line using And.',
    'Hard-coding data without quotes ("logs in as standard_user"). Fix: logs in as "standard_user" so it can become a parameter.',
    'Putting a check in a Given or an action in a Then. Fix: re-read each line and ask "setup, action or verification?".',
    'Leaving the Scenario name vague ("Test 1"). Fix: name the behaviour, e.g. "Added product appears in the cart".',
  ],
  tryIt: `Open http://localhost:5180/practice-site/login.html, log in as standard_user / secret_sauce and remove a product
from the cart by hand. Then write that check as a Scenario on paper: one Given, one When, two Thens.`,
  problems: ['cuc-001', 'cuc-002', 'cuc-017'],
}
