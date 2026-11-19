export default {
  id: 'cuc-033',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Regex vs Cucumber expressions in step definitions',
  level: 'INTERMEDIATE',
  tags: ['step-definitions', 'cucumber-expressions', 'regex', 'glue'],
  estMinutes: 12,
  scenario: `ShopEasy's glue code was started in 2018 with Cucumber 4, so half the step definitions use regular expressions
like \`^the shopper adds "([^"]*)" to the cart$\` and the new ones use \`{string}\`. The team wants one style going forward,
and you need to understand both to migrate safely.`,
  description: 'Answer each question about how Cucumber reads the pattern in a step annotation.',
  questions: [
    {
      q: 'How does Cucumber 7 decide whether `@When("...")` holds a regular expression or a Cucumber expression?',
      options: [
        'A setting in cucumber.properties',
        'If the text starts with ^ or ends with $ (or is a Pattern), it is treated as a regex; otherwise as a Cucumber expression',
        'Regex is used only in @Given steps',
        'It tries both and picks the shorter match',
      ],
      answer: 1,
      why: 'The anchors are the signal. `^...$` → regular expression. Without them the text is a Cucumber expression, so `(.*)` would then be read as optional text, not a capture group.',
    },
    {
      q: 'Which pair matches the same steps and passes the same argument?\n\n```java\n@When("^the shopper adds \\"([^\\"]*)\\" to the cart$")\n```',
      options: [
        '@When("the shopper adds {word} to the cart")',
        '@When("the shopper adds {string} to the cart")',
        '@When("the shopper adds (.*) to the cart")',
        '@When("^the shopper adds {string} to the cart$")',
      ],
      answer: 1,
      why: '{string} matches text in double (or single) quotes and passes it **without** the quotes — exactly what the regex group did. {word} stops at whitespace, (.*) in a Cucumber expression is optional text, and mixing ^...$ with {string} makes it a regex where {string} is literal.',
    },
    {
      q: 'The regex step is `@Then("^the cart badge shows (\\\\d+)$")` with method `badgeShows(int count)`. What do you get with `{int}` instead?',
      options: [
        'Nothing different',
        'The same match, and the conversion to int is built into the {int} parameter type (it also accepts negative numbers)',
        '{int} only works in Scenario Outlines',
        'You must still call Integer.parseInt in the method',
      ],
      answer: 1,
      why: 'Built-in parameter types ({int}, {long}, {double}, {bigdecimal}, {word}, {string}, {}) know both the matching pattern and the conversion. Readability goes up and the same conversion is shared everywhere.',
    },
    {
      q: 'An old regex step is `@Then("the total is (.*)")` (no anchors). After the migration nobody touched it, but now it never receives an argument and the step is "undefined". Why?',
      options: [
        'Regex was removed in Cucumber 7',
        'Without ^ or $ it is parsed as a Cucumber expression, where (.*) means optional literal text ".*", not a capture group',
        'The method name must change',
        'Total is a reserved word',
      ],
      answer: 1,
      why: 'This is the classic migration trap. Either add the anchors to keep it a regex (`^the total is (.*)$`) or rewrite it properly: `the total is {bigdecimal}` or a custom parameter type.',
    },
    {
      q: 'When is a regular expression still the better choice?',
      options: [
        'Never — regex is deprecated',
        'For every step with a number',
        'When you need matching that Cucumber expressions cannot express, e.g. a strict format like an order id `SHOP-\\d{4}` — ideally wrapped in a custom @ParameterType',
        'When the step starts with Given',
      ],
      answer: 2,
      why: 'Regex is fully supported. Use it for unusual formats, but prefer putting that regex into a custom @ParameterType so feature-file steps stay readable as `{orderId}`.',
    },
  ],
  hints: ['^ and $ switch the whole annotation into regex mode.', 'In a Cucumber expression, ( ) means optional text and / means alternatives.'],
  explanation: `Two languages, one annotation:

| | Regular expression | Cucumber expression |
|---|---|---|
| Recognised by | \`^\` … \`$\` anchors | no anchors |
| Capture | \`"([^"]*)"\`, \`(\\d+)\` | \`{string}\`, \`{int}\` |
| \`( )\` means | capture group | optional text |
| Conversion | by method parameter type | built into the parameter type |

New steps should use Cucumber expressions; reach for regex (inside a custom \`@ParameterType\`) only when a format needs it.
When migrating, change one step at a time and run a **dry run** to catch undefined or ambiguous steps immediately.`,
  interview: [
    { q: 'What is the difference between {string} and {word}?', a: '{string} matches quoted text (and drops the quotes), so it can contain spaces. {word} matches a single word without whitespace and no quotes.' },
    { q: 'How would you migrate 200 regex step definitions safely?', a: 'Convert in small batches, keep the feature files unchanged, and run the suite with dryRun after each batch so undefined/ambiguous steps show up instantly without opening a browser.' },
  ],
}
