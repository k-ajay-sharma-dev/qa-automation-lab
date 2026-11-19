export default {
  slug: 'cucumber-tags',
  category: 'cucumber',
  order: 6,
  title: 'Tags and running a subset of scenarios',
  minutes: 6,
  summary: 'Label scenarios with @tags and select smoke, regression or feature-area runs with tag expressions from the runner, Maven or CI.',
  manualAnalogy: `In a test management tool you mark test cases as Smoke, Regression, P1, or by module, and then build a test run
from a filter like "Smoke AND Checkout". Cucumber tags are those labels, and tag expressions are the filter.`,
  body: `## Adding tags

A tag is a word starting with \`@\`, written on the line **above** \`Feature\`, \`Scenario\`, \`Scenario Outline\` or
\`Examples\`:

\`\`\`gherkin
@cart
Feature: Shopping cart

  @smoke @regression
  Scenario: Added product appears in the cart
    ...

  @regression
  Scenario: Removing the last product empties the cart
    ...

  @regression @wip
  Scenario: Cart keeps products after logout and login
    ...
\`\`\`

- Several tags can sit on one line, separated by spaces. No spaces *inside* a tag (\`@smoke test\` is two tags).
- **Inheritance**: a tag on the \`Feature\` is inherited by every scenario in it. All three scenarios above are
  \`@cart\`. A tag on an \`Examples:\` block applies only to that block's rows.
- Tags are case-sensitive: \`@Smoke\` and \`@smoke\` are different. Agree on lower-case as a team.

## Common tag conventions

| Tag | Meaning |
|---|---|
| \`@smoke\` | small, critical happy paths - run on every deployment |
| \`@regression\` | the full pack - nightly |
| \`@wip\` | work in progress - excluded from CI |
| \`@cart\`, \`@checkout\` | feature area - run when that module changes |
| \`@bug-1234\` | linked to a defect or story id |

Tags can also drive **hooks**: \`@Before("@cart")\` runs only for cart scenarios (see the *Hooks* lesson).

## Tag expressions

To choose which scenarios run, you write a boolean **tag expression** using \`and\`, \`or\`, \`not\` and brackets:

| Expression | Selects |
|---|---|
| \`@smoke\` | scenarios tagged @smoke (directly or inherited) |
| \`@regression and not @wip\` | regression minus unfinished work |
| \`@cart or @checkout\` | anything in either area |
| \`@smoke and (@cart or @checkout)\` | smoke tests of either area - brackets matter |
| \`not @slow\` | everything except slow scenarios |

Inherited tags count. A scenario tagged \`@smoke\` inside a \`@cart\` feature *has both tags*, so
\`@smoke and @cart\` selects it.

Without brackets, \`and\` binds tighter than \`or\` (like multiplication before addition), so
\`@smoke and @cart or @checkout\` means "(smoke cart) or (any checkout)". When in doubt, add brackets.

## Where the expression goes

**1. In the runner** - the default for that runner class:

\`\`\`java
@CucumberOptions(features = "src/test/resources/features",
                 glue = "com.shopeasy",
                 tags = "@regression and not @wip")
\`\`\`

**2. On the command line** - overrides the runner, without changing code. In Cucumber 7 the property is
\`cucumber.filter.tags\`:

\`\`\`text
mvn test -Dcucumber.filter.tags="@cart and not @wip"
\`\`\`

The quotes are needed because the expression contains spaces. A value passed this way (or as an environment
variable \`CUCUMBER_FILTER_TAGS\`) **wins over** the \`tags\` in \`@CucumberOptions\`. That is how one runner class
serves a smoke job, a nightly regression job and an ad-hoc "just checkout" run in Jenkins: each job passes its own
expression.

Older blog posts show \`-Dcucumber.options="--tags @smoke"\`. That form was removed in Cucumber 7 - use
\`cucumber.filter.tags\`.

## Running one scenario, and "ignored" scenarios

To re-run a single scenario while debugging, point Cucumber at its file and line instead of using tags:

\`\`\`text
mvn test -Dcucumber.features="src/test/resources/features/login.feature:18"
\`\`\`

The number is the line of the \`Scenario:\` (or of an Examples row). \`cucumber.filter.name\` (a regex on the scenario
name) is another option. A scenario that passes in the full run but fails alone is depending on another scenario.

Cucumber JVM has **no built-in ignore tag**. Tagging a scenario \`@ignore\` does nothing until a tag expression excludes
it - for example \`@regression and not (@wip or @ignore)\`. Prefer a traceable tag such as \`@bug-SHOP-208\` so everyone
can see *why* it is skipped.

## Quick verification

Combine tags with \`dryRun = true\` (or \`-Dcucumber.execution.dry-run=true\`) to see *which* scenarios an expression
selects without opening a browser. Do this before wiring a new expression into CI.`,
  keyPoints: [
    'Tags go on the line above Feature/Scenario/Outline/Examples, start with @, and contain no spaces.',
    'Feature tags are inherited by every scenario; Examples tags apply to that block only.',
    'Tag expressions use and / or / not and brackets; and binds tighter than or.',
    'Cucumber 7: mvn test -Dcucumber.filter.tags="..." overrides tags in @CucumberOptions.',
    '@wip plus "not @wip" keeps unfinished scenarios out of CI.',
    'Run one scenario with -Dcucumber.features="path/file.feature:LINE"; @ignore has no built-in meaning.',
  ],
  mistakes: [
    'Putting a tag on the same line as the Scenario keyword or after it. Fix: tags go on the line above.',
    'Using the removed -Dcucumber.options="--tags ..." syntax. Fix: -Dcucumber.filter.tags="...".',
    'Writing "@smoke and @cart or @checkout" and expecting smoke-only. Fix: add brackets.',
    'Mixing @Smoke and @smoke. Fix: agree on one case for all tags.',
  ],
  tryIt: `For a feature tagged @cart with scenarios tagged @smoke, @regression and @regression @wip, write down which
scenarios each expression selects: "@cart", "@smoke or @wip", "@regression and not @wip".`,
  problems: ['cuc-009', 'cuc-010', 'cuc-025'],
}
