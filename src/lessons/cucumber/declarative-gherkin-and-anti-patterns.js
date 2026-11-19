export default {
  slug: 'declarative-gherkin-and-anti-patterns',
  category: 'cucumber',
  order: 2,
  title: 'Declarative Gherkin and the anti-patterns reviewers reject',
  minutes: 8,
  summary: 'Write scenarios that describe business behaviour instead of clicks, and spot the classic Gherkin anti-patterns in a code review.',
  manualAnalogy: `A good manual test case says "Log in as a standard user", not "Click the Username box, type s-t-a-n-d...". You
trust the tester to know *how*. Declarative Gherkin works the same way: the feature file says *what* the user achieves;
the step definitions and page objects hold the *how*.`,
  body: `## Imperative vs declarative

An **imperative** scenario lists UI mechanics:

\`\`\`gherkin
Scenario: Sort
  Given I open "login.html"
  When I type "standard_user" into "#user-name"
  And I type "secret_sauce" into "#password"
  And I click "#login-button"
  And I select "lohi" in "#product-sort"
  And I wait 2 seconds
  Then the first ".item-price" is "$7.99"
\`\`\`

A **declarative** scenario describes behaviour in the language of the business:

\`\`\`gherkin
Scenario: Cheapest product is listed first when sorting by price
  Given the shopper is logged in as "standard_user"
  When the shopper sorts products by "Price (low to high)"
  Then the first product shown is "Junior Onesie"
\`\`\`

Why the second is better:

- **Readable** - the product owner understands it without knowing CSS.
- **Stable** - if a developer renames \`#product-sort\`, only one Java locator changes; the feature file stays
  the same. Imperative scenarios break in dozens of places.
- **Reusable** - "the shopper is logged in as ..." is one step used by hundreds of scenarios.

A quick self-check: if your step contains a selector (\`#\`, \`.\`, XPath), or the words *click, type, field, button,
wait, sleep*, it is probably imperative. Translate it into what the user wants to *achieve*.

## Login is context, not behaviour

When a scenario is about sorting, logging in is just the starting state. Collapse it into **one Given**. Only a
scenario whose purpose is testing login should spell out login behaviour.

## Exactly one When

A scenario should test **one behaviour**, so it normally has **one \`When\`**. If you find
\`When... Then... When... Then...\`, you have glued two test cases together. Split them. As a manual tester you
already know this rule: one test case, one objective.

## The anti-patterns you will see in code reviews

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| **Scenario dependency** - scenario 2 expects the cart filled by scenario 1 | Scenarios can run in any order, alone, or in parallel. Run scenario 2 alone and it fails. | Each scenario builds its own state in \`Given\` steps (or a \`Background\`). |
| **UI mechanics in steps** | Brittle and unreadable, as above. | Declarative steps; selectors live in page objects. |
| **Waits/sleeps in Gherkin** ("And I wait 5 seconds") | Timing is a technical detail, and fixed sleeps cause slow, flaky tests. | Explicit waits inside page objects. |
| **Mega-scenario** - 15 steps testing login, cart, checkout and logout | When it fails you cannot tell which behaviour broke; it is slow to run and to read. | One behaviour per scenario; aim for roughly 3-6 steps. |
| **Meaningless names** ("TC1", "test 2", "scenario") | Reports become useless; nobody knows what failed. | Name the behaviour and the outcome. |
| **Asserting in Given/When** | Hides the real expectation. | Checks only in \`Then\`. |

## Independence: the most important rule

Think of how a manual regression run works when testers share an environment: if TC-12 depends on data created in
TC-11, you cannot run TC-12 on its own. Automation makes this worse, because Cucumber may run scenarios in a
different order, in parallel, or rerun only the failed ones. A scenario must **arrange its own world** - log in, put
the right product in the cart - every time.

## Anti-patterns in the step code

The Java side has its own classics:

- **Steps calling steps** - a \`@Given\` that does \`new LoginSteps().loggedInAs(...)\`. Creating step classes with
  \`new\` bypasses dependency injection (no shared driver) and ties step classes together. Put reusable actions in
  page objects or a small helper class that is injected into every step class that needs it.
- **Conjunctive steps** - "When the shopper logs in and adds a product and checks out". One idea per step, so steps
  can be reused and a failure points at one thing.
- **Hidden skips** - a tag like \`@ignore\` means nothing to Cucumber JVM by itself. A scenario is only skipped if the
  tag expression excludes it (\`not @ignore\`).

## Reviewing a scenario, step by step

1. Read only the scenario name. Do you know what is being tested? If not, rename it.
2. Count the \`When\` lines. More than one? Split.
3. Scan for selectors, clicks, waits. Replace with intent.
4. Ask "can this scenario run alone, first, on a fresh browser?" If not, add the missing \`Given\`.
5. Count steps. Long? Move shared setup to a \`Background\` (see the *Background and Scenario Outline* lesson) or
   collapse it into one higher-level Given.`,
  keyPoints: [
    'Feature files say WHAT the user achieves; page objects hold HOW (selectors, clicks, waits).',
    'Selectors, "click", "type", "wait" or "sleep" in a step are red flags for imperative style.',
    'One behaviour per scenario, so normally exactly one When.',
    'Every scenario must be able to run alone, in any order, and in parallel.',
    'Name scenarios after the behaviour and outcome, never "TC1" or "test".',
    'Steps never call other steps; shared actions live in page objects or injected helpers.',
  ],
  mistakes: [
    'Copying every click from the manual steps into Gherkin. Fix: group clicks into one business-level step.',
    'Relying on state left by the previous scenario. Fix: set up the cart/login in this scenario\'s own Given or a Background.',
    'Writing "And I wait 3 seconds". Fix: remove it; put an explicit wait in the page object method.',
    'Testing the whole journey in one scenario. Fix: one scenario per behaviour, with shared setup in Given steps.',
  ],
  tryIt: `Take any 10-step manual test case you wrote recently. Underline the single action that is really being tested;
everything before it becomes one or two Givens, everything after it becomes Thens. How many steps are left?`,
  problems: ['cuc-002', 'cuc-003', 'cuc-016', 'cuc-025', 'cuc-031', 'cuc-037', 'cuc-041'],
}
