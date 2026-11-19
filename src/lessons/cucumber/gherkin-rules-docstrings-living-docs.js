export default {
  slug: 'gherkin-rules-docstrings-living-docs',
  category: 'cucumber',
  order: 10,
  title: 'Rule, Doc Strings and living documentation',
  minutes: 9,
  summary: 'Group examples under the business rules they prove, pass multi-line text such as JSON bodies with Doc Strings, and write feature files that serve as specification before the code exists.',
  manualAnalogy: `In a good test plan you list the business rules of a feature and, under each rule, the test cases that prove it. For an
API test you paste the exact request body into the test case. And in refinement you ask "can you give me an example?" until
everyone agrees. Rule, Doc Strings and example mapping are those habits, written in Gherkin.`,
  body: `## Rule: business rule → examples

A flat list of scenarios tells a reader *what was tested*. It does not tell them *what the rules are*. Gherkin 6 added
the \`Rule\` keyword (fully supported in Cucumber 7) to add one level between Feature and Scenario:

\`\`\`gherkin
Feature: Cart badge

  Background:
    Given the shopper is logged in as "standard_user"

  Rule: The badge counts distinct products in the cart

    Example: One product shows 1
      When the shopper adds "Retro Red Tee" to the cart
      Then the cart badge shows 1

    Example: Two different products show 2
      Given the shopper has "Retro Red Tee" in the cart
      When the shopper adds "Junior Onesie" to the cart
      Then the cart badge shows 2

  Rule: An empty cart shows no badge

    Example: Removing the last product hides the badge
      ...
\`\`\`

Line by line:

- \`Rule:\` - a heading that states one business rule in plain words. Cucumber does not match it against code; it is
  for readers and reports.
- \`Example:\` - an exact synonym of \`Scenario:\`. Under a rule, "Example" reads naturally: *this is an example of the rule*.
- The Feature-level \`Background\` runs before every example in every rule. A Rule may also have **its own**
  Background, which runs after the Feature's one and only for that rule's examples.
- Tags may be placed on a Rule; its examples inherit them.

Name a rule the way a product owner would say it ("An empty cart shows no badge"), never "Rule 1" or "Negative
cases" - those are test categories, not rules.

## Doc Strings: multi-line text for one step

Some data does not fit on a step line: a JSON request body, the text of an e-mail, a long message. A **Doc String**
puts it under the step between triple double-quotes:

\`\`\`gherkin
When the client sends a login request
  """json
  { "username": "locked_out_user", "password": "secret_sauce" }
  """
Then the response status is 403
\`\`\`

- The text between the \`"""\` lines is passed to the step **as is**; Cucumber removes the common indentation.
- \`json\` after the opening quotes is an optional *content type* - a hint for readers and tools.
- In Java the Doc String arrives as the **last** method parameter, exactly like a DataTable, and the expression has
  no placeholder for it:

\`\`\`java
@When("the client sends a login request")
public void sendsLoginRequest(String body) {   // or io.cucumber.docstring.DocString
    ...
}
\`\`\`

Use a DataTable when the data is a flat list of fields; use a Doc String when it is free text or nested (JSON with an
array inside). Keep Doc Strings short - if every scenario repeats a 40-line payload, nobody reads them.

## Living documentation

Feature files that are executed on every build cannot silently go out of date - if the system changes, the scenario
fails. That is why they are called **living documentation**. To get there, the file has to be written for humans first:

1. **Before the code** - in a three-amigos session (PO, developer, tester) take the story and do *example mapping*:
   list the **rules**, find concrete **examples** for each rule, and note open **questions**.
2. **Concrete values** - "a discount is applied" documents nothing and can never fail. "$20.00 becomes $15.00" can.
   Examples expose decisions nobody made yet (rounding, upper/lower case, which error text).
3. **Map it to Gherkin** - story → Feature description, rule → \`Rule:\`, example → \`Example:\` or an outline row.
4. **Declarative steps** - the UI usually does not exist yet, so describe intent, not fields and buttons.
5. **Tag the status** - \`@wip\` while the story is in development (excluded from CI) and the ticket id (\`@SHOP-123\`)
   for traceability. Remove \`@wip\` when the story is done.

The HTML report of such a suite reads like the specification of the product - with a green or red mark next to
every rule.`,
  keyPoints: [
    'Rule groups examples under one business rule; Example is a synonym of Scenario.',
    'Feature Background runs before every example; a Rule Background runs after it, only for that rule.',
    'A Doc String ("""...""") passes multi-line text to one step as the last method parameter - no placeholder needed.',
    'Living documentation = concrete examples, written before the code, executed on every build.',
    'Use @wip and a ticket tag while a specified feature is still being built.',
  ],
  mistakes: [
    'Naming rules "Rule 1" or "Negative tests". Fix: state the business rule in a sentence a product owner would say.',
    'Adding {string} to the expression for a Doc String. Fix: the Doc String is an extra last parameter, not a placeholder.',
    'Vague outcomes like "a discount is applied". Fix: write the concrete amounts the business agreed on.',
    'Describing a UI that does not exist yet. Fix: declarative steps that survive any design.',
  ],
  tryIt: `Take a feature you know well (for example the login page at http://localhost:5180/practice-site/login.html). On paper,
write its rules as one-line sentences, then one concrete example under each rule. How many rules did you find that are
not written down anywhere?`,
  problems: ['cuc-019', 'cuc-020', 'cuc-023', 'cuc-028'],
}
