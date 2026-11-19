export default {
  id: 'cuc-010',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Running by tags: tag expressions in practice',
  level: 'INTERMEDIATE',
  tags: ['tags', 'tag-expressions', 'ci', 'maven'],
  estMinutes: 10,
  scenario: `The DevOps engineer asks you which command to put in the Jenkins "smoke" stage and the nightly job.
You also notice the nightly job keeps running \`@wip\` scenarios and turning the build red. Time to get tag expressions right.`,
  description: 'Answer the questions about tag expressions and how to pass them to Cucumber.',
  questions: [
    {
      q: 'Which Maven command runs only scenarios tagged `@smoke` (Cucumber 7)?',
      options: [
        'mvn test -Dtags=smoke',
        'mvn test -Dcucumber.filter.tags="@smoke"',
        'mvn test -Dcucumber.options="--tags smoke"',
        'mvn test -Dgroups=@smoke',
      ],
      answer: 1,
      why: 'In Cucumber 7 the property is `cucumber.filter.tags`. `cucumber.options` was removed in Cucumber 7; `-Dgroups` is a TestNG/Surefire group filter, not Cucumber tags; tags need the `@`.',
    },
    {
      q: 'The nightly job should run all regression scenarios except unfinished ones. Which expression?',
      options: ['"@regression, ~@wip"', '"@regression and not @wip"', '"@regression or not @wip"', '"@regression -@wip"'],
      answer: 1,
      why: 'Tag expressions use `and`, `or`, `not` and parentheses. The comma/tilde syntax is from Cucumber 1.x and no longer works. `or not @wip` would also run every untagged scenario.',
    },
    {
      q: 'A scenario is tagged `@cart` and its feature is tagged `@regression`. Does `"@regression and @cart"` select it?',
      options: [
        'No — only the scenario\'s own tags count',
        'Yes — scenarios inherit Feature (and Rule) tags',
        'Only if @regression is also on the Scenario',
        'Only with the JUnit runner',
      ],
      answer: 1,
      why: 'Tags are inherited from Feature → Rule → Scenario/Outline → Examples. So the scenario effectively has both tags.',
    },
    {
      q: 'The runner has `@CucumberOptions(tags = "@regression")` but Jenkins passes `-Dcucumber.filter.tags="@smoke"`. What runs?',
      options: [
        'Both sets combined with OR',
        'Only scenarios with both tags',
        '@smoke — system properties override @CucumberOptions',
        '@regression — the annotation wins',
      ],
      answer: 2,
      why: 'Precedence (highest first): system properties / environment variables → cucumber.properties / junit-platform.properties → @CucumberOptions. That is why you keep a sensible default in the annotation and override per CI job.',
    },
    {
      q: 'How do you run "smoke tests for either cart or checkout"?',
      options: [
        '"@smoke and @cart or @checkout"',
        '"@smoke and (@cart or @checkout)"',
        '"@smoke, @cart, @checkout"',
        '"(@smoke and @cart) and @checkout"',
      ],
      answer: 1,
      why: 'Use parentheses: `and` binds tighter than `or`, so without them option A means `(@smoke and @cart) or @checkout` — every checkout scenario, smoke or not.',
    },
  ],
  hints: ['Cucumber 7 property: cucumber.filter.tags', 'Operators: and, or, not, ( )'],
  explanation: `Tag expressions are boolean: \`and\`, \`or\`, \`not\`, parentheses. Pass them with \`-Dcucumber.filter.tags="…"\` (overrides everything),
\`cucumber.filter.tags=\` in \`cucumber.properties\`, or \`tags =\` in \`@CucumberOptions\`. Typical CI setup:

- PR build: \`@smoke and not @wip\`
- Nightly: \`@regression and not (@wip or @manual)\``,
  interview: [
    { q: 'How would you set up smoke vs regression in CI with Cucumber?', a: 'Tag scenarios, keep a default tag expression in the runner, and override per job with -Dcucumber.filter.tags. Smoke on every PR, full regression nightly, both excluding @wip.' },
    { q: 'How do you skip a known-broken scenario without deleting it?', a: 'Tag it (@wip or @bug-1234) and exclude it with "not @wip" in the run, ideally with a ticket so it is not forgotten.' },
  ],
}
