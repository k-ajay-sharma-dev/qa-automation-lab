export default {
  id: 'cuc-015',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Undefined, ambiguous and pending steps',
  level: 'INTERMEDIATE',
  tags: ['debugging', 'undefined-step', 'ambiguous-step', 'glue'],
  estMinutes: 12,
  scenario: `Monday morning: the build is red with three different Cucumber errors — "Undefined step", "AmbiguousStepDefinitionsException"
and a scenario marked "pending". Your manual-testing instinct (read the error, find the root cause) is exactly what is needed. Diagnose each one.`,
  description: 'Choose the most likely cause / fix for each error.',
  questions: [
    {
      q: 'Cucumber reports:\n\n```\nThe step \'the shopper logs in as "standard_user"\' is undefined.\nYou can implement this step using the snippet(s) below:\n@Given("the shopper logs in as {string}")\n```\n\nBut `LoginSteps` **does** contain exactly that method. The hooks are in `com.shopeasy.hooks`, steps in `com.shopeasy.steps`, and the runner has `glue = "com.shopeasy.hooks"`. Root cause?',
      options: [
        'The feature file needs to import LoginSteps',
        'The steps package is not in glue, so Cucumber never scanned LoginSteps',
        'Step methods must be static',
        '{string} cannot be used in a Given',
      ],
      answer: 1,
      why: 'Cucumber only scans packages listed in glue (and their sub-packages). Use `glue = {"com.shopeasy.steps", "com.shopeasy.hooks"}` or the parent `"com.shopeasy"`. Feature files never import code, and step methods are instance methods.',
    },
    {
      q: 'Two definitions exist:\n\n```java\n@When("the shopper adds {string} to the cart")\n@When("the shopper adds {} to the cart")\n```\n\nWhat happens for `When the shopper adds "Pulse Bike Light" to the cart`?',
      options: [
        'The first one declared wins',
        'The more specific {string} wins automatically',
        'AmbiguousStepDefinitionsException — both match, Cucumber refuses to guess',
        'Both run, one after another',
      ],
      answer: 2,
      why: 'If more than one expression matches a step, Cucumber fails the step as ambiguous and lists both locations. Delete or reword one. This is common when two people write similar steps in different classes — search the glue before adding a new step.',
    },
    {
      q: 'A step definition body is `throw new io.cucumber.java.PendingException();`. How is the scenario reported?',
      options: [
        'Passed',
        'Pending (by default the run fails; it is reported as not yet implemented)',
        'Skipped and never mentioned',
        'Ambiguous',
      ],
      answer: 1,
      why: 'Pending marks work in progress. In Cucumber 7 non-passing statuses (undefined, pending) fail the run by default (strict mode). Tag such scenarios @wip and exclude them in CI.',
    },
    {
      q: 'The feature says `Then the cart badge shows 2 items` and the code has `@Then("the cart badge shows {int} item")`. Smallest correct fix?',
      options: [
        'Use a regex: "^the cart badge shows (.*)$"',
        'Use optional text: "the cart badge shows {int} item(s)"',
        'Duplicate the method with "items"',
        'Change all feature files to say "item"',
      ],
      answer: 1,
      why: 'Cucumber expressions support optional text with parentheses — `item(s)` matches "item" and "items". Alternatives use a slash: `{int} product/products`. Duplicating the method would create ambiguity later; a catch-all regex is too loose.',
    },
    {
      q: 'What is the fastest way to find all undefined steps after the BA edits 10 feature files — without opening a browser?',
      options: [
        'Run the whole suite and read the logs',
        'Set dryRun = true (or -Dcucumber.execution.dry-run=true) and run',
        'Delete the glue and re-generate it',
        'Set monochrome = false',
      ],
      answer: 1,
      why: 'Dry run parses features and matches every step against the glue without executing hooks or step bodies, so undefined/ambiguous steps show up in seconds with ready-to-paste snippets.',
    },
  ],
  hints: ['Undefined = no match in the scanned glue. Ambiguous = more than one match.', 'Optional text: (s); alternatives: a/b'],
  explanation: `Three statuses you will meet daily:

- **Undefined** — no step definition matches. Usual causes: package not in \`glue\`, typo or extra word in the step text, quotes in the wrong place.
  Cucumber prints a snippet you can paste.
- **Ambiguous** — two or more expressions match. Reword or delete one; keep a shared vocabulary of steps.
- **Pending** — a definition exists but throws \`PendingException\` (generated snippets do this).

\`dryRun\` is your friend for catching the first two in CI before any browser starts.`,
  interview: [
    { q: 'What causes "undefined step" when the step definition exists?', a: 'Most often its package is not in glue, or the text differs slightly (extra word, plural, quotes). The runner may also be pointing at a different features/glue set than you think.' },
    { q: 'How do you prevent ambiguous steps in a large team?', a: 'Organise steps by domain (LoginSteps, CartSteps), search before adding a new step, review feature files for a shared vocabulary, and run dryRun in CI to fail fast.' },
  ],
}
