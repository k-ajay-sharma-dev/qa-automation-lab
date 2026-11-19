export default {
  id: 'cuc-020',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Background, Rule and Doc Strings: which tool when?',
  level: 'BEGINNER',
  tags: ['gherkin', 'background', 'rule', 'doc-string'],
  estMinutes: 10,
  scenario: `Your team is writing feature files for the new checkout and the API. In one review session three questions came up:
"Should this go in the Background?", "How do we put a whole JSON body in a step?" and "What exactly runs before a scenario inside a Rule?".
Settle them before the next refinement meeting.`,
  description: 'Answer the questions about Gherkin structure: Background, Rule, Doc Strings and comments.',
  questions: [
    {
      q: 'The cart feature has a Background with 5 Givens: logged in, backpack in cart, bike light in cart, on the cart page, discount code applied. Only 2 of the 7 scenarios need the discount. What is the best fix?',
      options: [
        'Leave it — Background is the place for every precondition',
        'Keep only what **every** scenario needs in the Background; move the discount (and other partial setup) into the scenarios that need it',
        'Add "And the discount is removed" to the 5 scenarios that do not need it',
        'Delete the Background and copy all 5 lines into every scenario',
      ],
      answer: 1,
      why: 'A Background is for context shared by **all** scenarios. Setup that only some scenarios need hides important information from the reader and forces other scenarios to "undo" it. Undo steps are a red flag. Copying 5 lines everywhere is the duplication Background was meant to remove.',
    },
    {
      q: 'A scenario inside `Rule: Locked-out users cannot log in` runs. The Feature has a Background and the Rule has its own Background. What runs before the scenario\'s own steps?',
      options: [
        'Only the Rule Background',
        'Only the Feature Background',
        '@Before hooks, then the Feature Background, then the Rule Background',
        'The Rule Background, then the Feature Background',
      ],
      answer: 2,
      why: 'Hooks come first, then backgrounds from the outside in: Feature Background, then the Rule\'s Background, then the scenario steps. Scenarios in other Rules only get the Feature Background.',
    },
    {
      q: 'An API step needs a 10-line JSON request body. How do you put it into Gherkin?',
      options: [
        'One very long quoted string on the step line',
        'A Doc String: the lines between `"""` and `"""` directly under the step',
        'A DataTable with one column per JSON field, always',
        'You cannot — JSON must stay in Java',
      ],
      answer: 1,
      why: 'A Doc String (`"""` … `"""`, or three backticks) passes multi-line text to the step. You may add a content type after the opening quotes (`"""json`) for readers and tools. A DataTable works for flat key/value data, but nested JSON (an items array) reads much better as a Doc String.',
    },
    {
      q: 'How does the step definition receive a Doc String?',
      options: [
        'With a {string} in the expression',
        'As an extra last method parameter of type String (or DocString) — the expression has no placeholder for it',
        'Through a static field set by a hook',
        'As a List<String> of lines',
      ],
      answer: 1,
      why: 'Like a DataTable, a Doc String is passed as the **last** argument after any expression parameters: `@When("the client places an order with body") public void place(String body)`. Adding `{string}` would make the step undefined.',
    },
    {
      q: 'What is the difference between a `#` comment and the free text under `Feature:`?',
      options: [
        'None, both are ignored by everyone',
        'The free-text description belongs to the feature and appears in reports; `#` comments are for maintainers and are dropped',
        '`#` lines are executed as steps',
        'The description must be a user story or Cucumber fails',
      ],
      answer: 1,
      why: 'The description (any text under Feature/Rule/Scenario before the first step) is part of the document — it shows up in the HTML report and living documentation. `#` comments are not part of the output. The user story format is a convention, not a requirement.',
    },
  ],
  hints: ['Background = context for ALL scenarios in the file (or Rule).', 'Doc String = multi-line text for one step, received as the last parameter.'],
  explanation: `Quick decision table:

| Need | Tool |
|---|---|
| Context every scenario in the file shares | \`Background\` (short!) |
| Group examples under the business rule they prove | \`Rule\` (optional own Background) |
| Same steps, different data | \`Scenario Outline\` + \`Examples\` |
| Structured rows for one step | DataTable |
| Multi-line text (JSON body, e-mail text, long message) for one step | Doc String \`"""\` |
| A note for maintainers only | \`#\` comment |

Execution order before a scenario: \`@Before\` hooks → Feature Background → Rule Background → scenario steps.`,
  interview: [
    { q: 'When does a Background hurt more than it helps?', a: 'When it is long, contains steps only some scenarios need, or contains actions (When) — readers must remember hidden context, and scenarios start "undoing" setup. Keep it to two or three lines of context shared by every scenario.' },
    { q: 'What is a Doc String and when do you use it?', a: 'Multi-line text attached to a step between triple quotes, passed to the step definition as a final String or DocString parameter. I use it for JSON/XML request bodies, expected e-mail text or long messages.' },
  ],
}
