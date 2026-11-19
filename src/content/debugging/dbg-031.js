export default {
  id: 'dbg-031',
  category: 'debugging',
  kind: 'quiz',
  title: '"Step undefined" with the glue set correctly: spaces, quotes and capital letters',
  level: 'INTERMEDIATE',
  tags: ['cucumber', 'undefined-step', 'cucumber-expressions', 'gherkin', 'snippets'],
  estMinutes: 12,
  scenario: `The business analyst rewrote the ShopEasy cart feature files in Confluence and pasted them into the repo. The glue path is fine — 90% of the steps still run — but five scenarios now end as **UNDEFINED** and the report shows them yellow, not red. The step definitions "look identical" to the feature text. Your job: spot the invisible difference in each one.`,
  description: `Each question shows a feature line and the step definition that was supposed to match it. Glue is correct in every case — the problem is in the text itself.`,
  hints: [
    'Cucumber matches the WHOLE step text, character by character (the keyword Given/When/Then/And is not part of it).',
    'Read the snippet Cucumber prints: it is generated from the exact feature text, so compare it with your annotation.',
  ],
  questions: [
    {
      q: `The run prints this. Why is the step undefined?

\`\`\`text
Scenario: Add the backpack to the cart        # cart.feature:7
  Given the user is logged in as "standard_user"
  When the user adds "Trailblazer Backpack" to the  cart
      Undefined step. You can implement it using the snippet(s) below:

@When("the user adds {string} to the  cart")
public void the_user_adds_to_the_cart(String string) {
    throw new io.cucumber.java.PendingException();
}
\`\`\`

Existing definition: \`@When("the user adds {string} to the cart")\``,
      options: [
        'The glue path is missing the steps package',
        'The feature has two spaces between "the" and "cart"; Cucumber matches spaces literally',
        '{string} cannot be used in a @When step',
        'The product name contains a space, so {word} should be used',
      ],
      answer: 1,
      why: 'Look at the generated snippet: "to the  cart" has a double space, copied from the BA\'s Confluence text. Cucumber expressions match spaces exactly, so one extra space is enough to make a step undefined. Fix the feature file (do not add a second definition with two spaces). Glue cannot be the issue — the logged-in step in the same scenario matched. {string} handles names with spaces.',
    },
    {
      q: `Feature: \`Given The user is logged in as "standard_user"\`
Definition: \`@Given("the user is logged in as {string}")\`

What happens?`,
      options: [
        'It matches — Cucumber ignores case',
        'Undefined — Cucumber expressions are case-sensitive, "The" is not "the"',
        'Ambiguous — two definitions match',
        'It matches only when run with --strict',
      ],
      answer: 1,
      why: 'Matching is case-sensitive. A capital T after the keyword is a common result of editors auto-capitalising the first word of a line. Agree on a team convention (lowercase after the keyword) and fix the feature line.',
    },
    {
      q: `Feature (pasted from Confluence): \`When the user adds “Pulse Bike Light” to the cart\`
Definition: \`@When("the user adds {string} to the cart")\`

Why is this undefined?`,
      options: [
        'Bike Light is two words',
        'Confluence/Word "smart quotes" (curly quotes) are not the straight " or \' that {string} recognises',
        'The step must use Then for assertions',
        'Cucumber does not support product names in steps',
      ],
      answer: 1,
      why: '{string} matches text inside straight double quotes "..." or single quotes \'...\'. Rich-text editors replace them with curly “ ” quotes, which look the same in a review but are different characters. Search the feature files for “ and ” and replace them. Turning off smart quotes when writing Gherkin in Confluence prevents it.',
    },
    {
      q: `Feature: \`Then the cart badge shows 2\`
Definition: \`@Then("the cart badge shows {string}")\``,
      options: [
        'It matches; Cucumber converts 2 to "2"',
        'Undefined: {string} needs quotes in the feature; use {int} for a bare number (and an int parameter)',
        'Undefined because Then steps cannot have parameters',
        'Pending exception at runtime',
      ],
      answer: 1,
      why: '{string} only matches quoted text. A bare number is matched by {int}, which also converts it to an Integer for you: @Then("the cart badge shows {int}") public void badgeShows(int count). Choosing the right parameter type keeps conversions out of your step code.',
    },
    {
      q: `Feature: \`When the user removes "Pulse Bike Light" from the cart\`
Definition: \`@Given("the user removes {string} from the cart")\`

A teammate says it is undefined because of the @Given vs When mismatch. Are they right?`,
      options: [
        'Yes — the annotation must match the keyword in the feature',
        'No — the keyword is not part of the match; @Given, @When and @Then are interchangeable for matching, so this step runs',
        'Yes, but only in Cucumber 7',
        'No — but it will be reported as ambiguous',
      ],
      answer: 1,
      why: 'Cucumber matches only the text after the keyword. Using @Given for a When step still works (it is just poor readability). So when hunting an undefined step, do not waste time on the keyword — compare the text: spaces, quotes, capitals, punctuation, singular/plural.',
    },
  ],
  explanation: `When the glue is correct but a step is still **undefined**, the step text and the expression differ by something you cannot easily see:
- **Whitespace** — double spaces or tabs inside the sentence.
- **Case** — "The" vs "the".
- **Quotes** — curly “smart quotes” from Word/Confluence vs straight \`"\`.
- **Parameter type** — \`{string}\` needs quotes; numbers need \`{int}\`/\`{double}\`.
- **Punctuation and plurals** — a trailing full stop, "item" vs "items" (use optional text \`item(s)\`).

**Best tool: the snippet.** Cucumber prints a snippet generated from the *exact* feature text. Put it next to your annotation and compare character by character — the difference jumps out. In IntelliJ, the Cucumber plugin also underlines undefined steps as you type.

Also run with \`strict\` behaviour (default in Cucumber 7) so undefined steps **fail** the build instead of hiding as yellow.`,
  mistakes: [
    'Adding a second step definition that matches the typo instead of fixing the feature file.',
    'Changing the glue path when only one or two steps are undefined.',
    'Blaming the Given/When/Then keyword — it is not part of the match.',
    'Pasting Gherkin from Word or Confluence without checking quotes and spaces.',
  ],
  interview: [
    { q: 'A step shows as undefined but the definition exists. How do you investigate?', a: 'If all steps are undefined I check the glue path and runner first. If only some are, I compare the snippet Cucumber prints with my annotation character by character — usually it is an extra space, a capital letter, curly quotes or the wrong parameter type like {string} for an unquoted number.' },
    { q: 'What happens to undefined steps in the build?', a: 'In Cucumber 7 strict mode is the default, so undefined or pending steps fail the run. In older setups they were reported as yellow and the build could stay green, which hides missing automation — so we always keep strict on in CI.' },
  ],
}
