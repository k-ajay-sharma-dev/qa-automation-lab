export default {
  id: 'cuc-025',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Review the glue: steps calling steps, hidden dependencies and @ignore',
  level: 'INTERMEDIATE',
  tags: ['anti-patterns', 'review', 'tags', 'independence', 'command-line'],
  estMinutes: 12,
  scenario: `You are reviewing a pull request that adds 20 cart scenarios. The feature files look fine, but the Java side and the run
behaviour raise questions: a step that calls other steps, a scenario that only fails when run alone, and a "skipped" scenario that still runs
in CI. Use your tester's instinct for root causes.`,
  description: 'Choose the best answer for each review finding.',
  questions: [
    {
      q: 'This step reuses other steps:\n\n```java\n@Given("the shopper has {string} in the cart")\npublic void hasInCart(String product) {\n    new LoginSteps().loggedInAs("standard_user");\n    new CartSteps().addsToCart(product);\n}\n```\n\nWhat is the main problem?',
      options: [
        'Nothing — reuse is good',
        'Step classes are created with `new`, bypassing PicoContainer: they get no shared TestContext (a different or null driver), and steps become coupled to each other. Share the logic through page objects or an injected helper instead',
        'Given steps may not call methods',
        'It must be declared static to be called from another class',
      ],
      answer: 1,
      why: '"Steps calling steps" is a classic anti-pattern. Step definitions are glue for Gherkin, not an API. Put reusable behaviour into page objects or a small injected service (e.g. `ShopActions` with `loginAs` and `addToCart`) that any step class can use. Creating step classes with `new` also breaks dependency injection.',
    },
    {
      q: 'Which step is a **conjunctive** step that should be split?',
      options: [
        'Given the shopper is logged in as "standard_user"',
        'When the shopper logs in and adds "Pulse Bike Light" to the cart and checks out',
        'Then the cart badge shows 2',
        'And the order confirmation "Thank you for your order!" is shown',
      ],
      answer: 1,
      why: 'A step that does several things joined by "and" cannot be reused on its own and hides which part failed. Login is context (Given), adding is setup or the action, and checkout is another behaviour. One idea per step.',
    },
    {
      q: 'You want to run only the scenario on line 23 of `cart.feature` from the command line (Cucumber 7, Maven). Which works?',
      options: [
        'mvn test -Dcucumber.features="src/test/resources/features/cart.feature:23"',
        'mvn test -Dtest=cart.feature:23',
        'mvn test -Dcucumber.filter.line=23',
        'mvn test -Dcucumber.options="cart.feature --line 23"',
      ],
      answer: 0,
      why: '`cucumber.features` accepts a path with `:line` (several lines: `:23:41`). It overrides the runner\'s features. `-Dtest` selects a JUnit/TestNG class, not a feature; `cucumber.options` was removed in Cucumber 7. Alternatives: a temporary `@debug` tag with `cucumber.filter.tags`, or `cucumber.filter.name` with a regex on the scenario name.',
    },
    {
      q: 'Scenario "Removing the last product shows the empty cart message" passes in the full run but fails when run alone with the command above. Most likely cause?',
      options: [
        'Running a single scenario is not supported',
        'It depends on state left behind by an earlier scenario (for example a product added by the previous scenario), so on its own its Given is incomplete',
        'The line number was wrong, so another scenario ran',
        'PicoContainer only works for full runs',
      ],
      answer: 1,
      why: 'Passing only in sequence is the signature of a **hidden dependency**. The scenario must arrange its own state (`Given the shopper has "Trailblazer Backpack" in the cart`). Running scenarios alone, in random order or in parallel is the quickest way to expose these.',
    },
    {
      q: 'A broken scenario was tagged `@ignore`, but CI still runs it and the build is red. Why?',
      options: [
        'Tags only work on Features',
        'Cucumber JVM gives @ignore no special meaning — it is just a tag. The run must exclude it, e.g. tags "@regression and not @ignore"',
        '@ignore only works with JUnit 4',
        'The tag must be written @Ignore with a capital I',
      ],
      answer: 1,
      why: 'No tag is magic in Cucumber JVM. Exclusion happens only through the tag expression in the runner, `cucumber.filter.tags` or properties. Better still: tag it with the defect id (`@bug-SHOP-208`) so the skip is visible and traceable, and remove the tag when fixed.',
    },
  ],
  hints: ['Step definitions are glue, not a library — share code through page objects or injected helpers.', 'A scenario that fails alone has a missing Given.'],
  explanation: `Review checklist for the Java side of a Cucumber suite:

- **No steps calling steps** — move shared behaviour into page objects or an injected helper; step classes stay independent.
- **One idea per step** — no "and" chains in step text.
- **Independence** — every scenario must pass when run alone: \`-Dcucumber.features="path/file.feature:LINE"\`.
- **Explicit skips** — \`@ignore\`, \`@wip\` or \`@bug-…\` mean nothing unless the tag expression excludes them (\`not @ignore\`).`,
  interview: [
    { q: 'Why should step definitions not call other step definitions?', a: 'It couples step classes, bypasses dependency injection, and turns glue code into a hidden API. Reusable actions belong in page objects or helper services injected into the step classes.' },
    { q: 'How do you run a single scenario?', a: 'Pass its location: -Dcucumber.features="src/test/resources/features/cart.feature:23", or use a temporary tag with cucumber.filter.tags, or cucumber.filter.name with a regex on the scenario name. IDE plugins do the same behind a gutter icon.' },
    { q: 'How do you skip a scenario in Cucumber JVM?', a: 'Tag it and exclude the tag in the run (not @ignore / not @wip). There is no built-in ignore tag, so the exclusion must be part of every runner or CI command.' },
  ],
}
