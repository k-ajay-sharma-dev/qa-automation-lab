export default {
  slug: 'debug-cucumber-glue-errors',
  category: 'debugging',
  order: 6,
  title: 'Cucumber glue errors: undefined and ambiguous steps',
  minutes: 7,
  summary: 'Fix the two classic Cucumber wiring failures — "Undefined step" and AmbiguousStepDefinitionsException — by checking the glue path and how step text matches Cucumber expressions.',
  manualAnalogy: `A Gherkin step is like a line in a manual test case, and a step definition is the tester who knows how to perform it. "Undefined" means Cucumber couldn't find anyone who knows that line. "Ambiguous" means two people both put their hands up and Cucumber refuses to choose. Neither is a product problem — it is about how sentences are matched to code.`,
  body: `## How Cucumber matches a step

1. The **runner** (\`@CucumberOptions\`) says where the \`.feature\` files are (\`features\`) and which Java **packages** to scan for step definitions (\`glue\`).
2. For each step line, Cucumber ignores the keyword (\`Given/When/Then/And\`) and compares the remaining text with every \`@Given/@When/@Then\` expression it found in the glue packages.
3. Exactly **one** match → run it. **Zero** → *undefined*. **Two or more** → *ambiguous*.

## Undefined steps

\`\`\`text
1 Scenarios (1 undefined)
4 Steps (3 skipped, 1 undefined)

You can implement missing steps with the snippets below:
@When("I remove {string} from the cart")
public void i_remove_from_the_cart(String string) { ... }
\`\`\`

The snippet is Cucumber telling you the exact expression it *expected* to find. First question:

### Are *all* steps undefined, or only some?

| Pattern | Most likely cause |
|---|---|
| **Every** step undefined (even ones you know exist) | Glue problem — Cucumber isn't scanning the package where the step classes live |
| **Some** steps undefined | Text mismatch between the feature line and the annotation |

### Checking the glue

\`\`\`java
@CucumberOptions(
        features = "src/test/resources/features",
        glue = {"com.shopeasy.steps", "com.shopeasy.hooks"},
        plugin = {"pretty", "html:target/cucumber.html"})
\`\`\`

- \`glue\` is a **package name**, not a folder path: dots, no \`src/test/java\`.
- Compare it character by character with the \`package\` line at the top of a step class. \`steps\` vs \`stepdefs\` vs \`stepDefinitions\` is the most common miss.
- Hooks (\`@Before\`/\`@After\`) live in glue too. If hooks never run, the hooks package is probably missing from \`glue\`.
- Sub-packages are scanned automatically.

### Checking the text

Cucumber expressions must match the step **exactly**, apart from parameters:

| Feature line | Annotation | Matches? |
|---|---|---|
| \`When I remove "Junior Onesie" from the cart\` | \`@When("I remove {string} from the cart")\` | Yes |
| same | \`@When("I remove {string} from cart")\` | No — missing "the" |
| \`Then the total should be 49.99\` | \`@Then("the total should be {double}")\` | Yes |
| \`Then the badge shows 2\` | \`@Then("the badge should show {int}")\` | No — different wording |

Parameter types: \`{string}\` = text in double quotes (passed without the quotes), \`{int}\`, \`{double}\`, \`{word}\` = one word without spaces or quotes. Trailing punctuation and capital letters count.

Quick fix habit: copy the snippet Cucumber printed and compare it with your annotation side by side. Decide which side is "right" — usually the feature file is the agreed business language, so change the code.

## Ambiguous steps

\`\`\`text
io.cucumber.core.runner.AmbiguousStepDefinitionsException: "I open the "Cart" page" matches more than one step definition:
  "I open the {string} page" in com.shopeasy.steps.NavigationSteps.openPage(String)
  "^I open the (.*)$" in com.shopeasy.steps.LegacySteps.open(String)
\`\`\`

The message lists **every** definition that matched, with class and method — so you know exactly where to look. The usual culprit is a **greedy regular expression** like \`(.*)\`, which matches anything, written by another team or in an old class.

Fixes, best first:

1. **Keep one definition** for one meaning. Delete or merge the duplicate.
2. **Make the generic step specific**: replace \`(.*)\` with a precise Cucumber expression (\`{word}\`, \`{string}\`) so it no longer swallows other sentences.
3. If one step must handle many similar lines (many field names), make it **one** parameterised step that looks up what to do — for example a \`Map<String, By>\` from field name to locator — instead of many near-identical steps.

Never "fix" ambiguity by renaming the feature line into odd wording just to dodge the regex — the feature file is documentation for humans.

## Related errors you'll meet in the same place

- **\`CucumberException: Failed to instantiate class ...Steps\`** — the step class's constructor (or something injected into it, e.g. a shared context with PicoContainer) threw. Scroll to the deepest \`Caused by:\` — it's often configuration, not Cucumber.
- **\`DuplicateStepDefinitionException\`** — two annotations with the *identical* expression. Delete one.
- **Pending steps** (\`PendingException\`) — the generated snippet was pasted but never implemented.`,
  keyPoints: [
    'One step line must match exactly one definition in the glue packages.',
    'All steps undefined = glue package wrong; some undefined = text mismatch.',
    '`glue` is a Java package name (dots), and must include hooks packages too.',
    'Cucumber expressions match literally except `{string}`, `{int}`, `{double}`, `{word}`.',
    'Ambiguous = two definitions match; replace greedy regex `(.*)` and keep one definition per meaning.',
  ],
  mistakes: [
    'Writing a folder path (`src/test/java/com/shopeasy/steps`) in `glue`.',
    'Changing the feature file\'s business wording to fit the code.',
    'Keeping a catch-all regex step like `^I (.*)$` "for convenience" — it causes ambiguity everywhere.',
  ],
  tryIt: `Take any feature step you have, and write the annotation for it twice: once correct, once with a one-word difference. Ask yourself which part of the console output (snippet vs undefined count) would reveal the mismatch.`,
  problems: ['dbg-010', 'dbg-011'],
}
