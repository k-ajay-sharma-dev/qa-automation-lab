export default {
  id: 'cuc-040',
  category: 'cucumber',
  kind: 'quiz',
  title: '@CucumberOptions vs cucumber.properties: plugin, monochrome, dryRun and friends',
  level: 'ADVANCED',
  tags: ['runner', 'cucumber-options', 'configuration', 'dry-run', 'reports'],
  estMinutes: 12,
  scenario: `The ShopEasy CI job takes 25 minutes, and every time a BA adds a feature file the first run fails with "undefined step"
somewhere in the middle. The console log is full of escape codes like \`[32m\`. You are asked to tidy the runner configuration
and give the team a fast way to check new Gherkin.`,
  description: 'Choose the right configuration for each need.',
  questions: [
    {
      q: 'A BA adds `registration.feature`. You want to know in seconds whether every step has a matching step definition — without opening a browser. Which option?',
      options: [
        '`monochrome = true`',
        '`dryRun = true` (or `cucumber.execution.dry-run=true`)',
        '`strict = false`',
        '`publish = true`',
      ],
      answer: 1,
      why: 'Dry run parses features and matches steps to glue but does not execute step bodies, so undefined and ambiguous steps are reported almost instantly. Remember to switch it off — a dry run "passes" without testing anything.',
    },
    {
      q: 'The CI log shows `[32m` / `[31m` characters everywhere. Which option fixes it?',
      options: ['`dryRun = true`', '`monochrome = true` (or `cucumber.ansi-colors.disabled=true`)', '`plugin = "pretty"` removed', '`snippets = CAMELCASE`'],
      answer: 1,
      why: 'Those are ANSI colour codes. monochrome (JUnit 4 / TestNG runners) or cucumber.ansi-colors.disabled (properties / JUnit Platform) prints plain text that CI log viewers can read.',
    },
    {
      q: 'Which `plugin` value produces a file the Jenkins/Allure-style report tools and a rerun job can consume?',
      options: [
        '`plugin = {"pretty"}` only',
        '`plugin = {"pretty", "html:target/cucumber.html", "json:target/cucumber.json", "rerun:target/rerun.txt"}`',
        '`plugin = "target"`',
        '`glue = "target/cucumber.json"`',
      ],
      answer: 1,
      why: 'pretty → readable console, html → shareable report, json → input for report tools, rerun → list of failed scenario locations for a second run. Plugins are formatters; glue is the package of step definitions.',
    },
    {
      q: 'The team uses the JUnit 5 Platform Suite runner. Where do `glue` and `plugin` settings go?',
      options: [
        'In `@CucumberOptions` on the suite class — it is still read',
        'In `junit-platform.properties` (`cucumber.glue=…`, `cucumber.plugin=…`) or `@ConfigurationParameter` on the suite',
        'In `pom.xml` only',
        'They cannot be configured with JUnit 5',
      ],
      answer: 1,
      why: '@CucumberOptions belongs to the JUnit 4 and TestNG runners. On the JUnit Platform engine the same settings are configuration parameters: a properties file or @ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.shopeasy.steps").',
    },
    {
      q: 'A developer runs `mvn test -Dcucumber.filter.tags="@smoke"` but the runner has `tags = "@regression"` in `@CucumberOptions`. What runs?',
      options: [
        'Only @regression — annotations always win',
        'Both, combined with OR',
        '@smoke — system properties / environment override the runner annotation',
        'Nothing; the conflict is an error',
      ],
      answer: 2,
      why: 'Cucumber resolves options with precedence: system properties / environment variables > cucumber.properties > @CucumberOptions. That is what lets CI pick a tag set without editing code.',
    },
  ],
  hints: ['dryRun checks wiring, not behaviour.', 'Command-line properties override what is written in the runner.'],
  explanation: `A pragmatic runner setup:

\`\`\`java
@CucumberOptions(
    features = "src/test/resources/features",
    glue = {"com.shopeasy.steps", "com.shopeasy.hooks"},
    plugin = {"pretty", "html:target/cucumber.html", "json:target/cucumber.json", "rerun:target/rerun.txt"},
    monochrome = true,
    tags = "not @wip")
public class TestRunner extends AbstractTestNGCucumberTests { }
\`\`\`

- **dryRun** — a pre-merge check that new Gherkin is wired; never leave it on in CI.
- **monochrome** — readable CI logs.
- **plugin** — one entry per output you need.
- **Precedence** — \`-Dcucumber.*\` > \`cucumber.properties\` / \`junit-platform.properties\` > annotation, so CI can override tags without a code change.`,
  mistakes: [
    'Committing dryRun = true — CI goes green while no step is executed.',
    'Putting @CucumberOptions on a JUnit 5 @Suite class and wondering why it is ignored.',
    'Confusing glue (step-definition packages) with plugin (report formatters).',
  ],
  interview: [
    { q: 'Why might a dry run pass while the real run fails?', a: 'Dry run only matches step text to methods; it never executes them. Wrong locators, assertions or parameter conversions inside the methods are only found by a real run.' },
    { q: 'What does the rerun plugin write and how is it used?', a: 'It writes file:line locations of failed scenarios (e.g. features/cart.feature:12). A second runner with features = "@target/rerun.txt" runs only those, which helps separate flaky failures from real ones.' },
  ],
}
