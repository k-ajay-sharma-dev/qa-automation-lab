export default {
  id: 'fw-036',
  category: 'framework',
  kind: 'quiz',
  title: 'Surefire vs Failsafe: unit-speed checks and slow UI tests in one pom',
  level: 'INTERMEDIATE',
  tags: ['maven', 'surefire', 'failsafe', 'lifecycle', 'ci'],
  estMinutes: 10,
  scenario: `The ShopEasy repo now has two kinds of tests: 60 fast tests for framework utilities (ConfigReader, test-data
builders) and 400 Selenium tests. Developers complain that \`mvn test\` takes 25 minutes before they can push. The
architect suggests "move the UI tests to Failsafe". You need to understand what that changes before agreeing.`,
  description: `Answer the questions about the two Maven test plugins.`,
  questions: [
    {
      q: 'By default, which test classes does each plugin pick up?',
      options: [
        'Both run every class in src/test/java',
        'Surefire: `*Test`, `Test*`, `*Tests`, `*TestCase`; Failsafe: `*IT`, `IT*`, `*ITCase`',
        'Surefire runs only TestNG, Failsafe only JUnit',
        'Failsafe runs classes in src/it/java only',
      ],
      answer: 1,
      why: 'Naming conventions split them: `ConfigReaderTest` runs in Surefire, `CheckoutIT` in Failsafe. Includes can be overridden in the plugin configuration or via testng.xml suiteXmlFiles.',
    },
    {
      q: 'In which Maven lifecycle phases do they run?',
      options: [
        'Both in `test`',
        'Surefire in `test`; Failsafe in `integration-test`, and its `verify` goal fails the build afterwards',
        'Failsafe in `compile`',
        'Surefire in `verify`; Failsafe in `test`',
      ],
      answer: 1,
      why: 'So `mvn test` runs only the fast tests, and `mvn verify` runs both. This is how developers get quick feedback while CI runs the full UI suite.',
    },
    {
      q: 'Why does Failsafe split execution (`integration-test`) from the pass/fail decision (`verify`)?',
      options: [
        'To run tests twice',
        'So that `post-integration-test` (e.g. stopping the Docker Selenium Grid or the app server) still runs even when tests fail',
        'Because it is older than Surefire',
        'To skip failed tests automatically',
      ],
      answer: 1,
      why: 'With Surefire a failure stops the build immediately. Failsafe lets tear-down phases run first, then fails in `verify` — no orphaned containers on the CI agent.',
    },
    {
      q: 'A CI job runs `mvn integration-test` (not `verify`). Three UI tests fail. What happens?',
      options: [
        'The build fails',
        'The build is green — failures are only evaluated by the `verify` goal',
        'Maven retries them',
        'The tests are skipped',
      ],
      answer: 1,
      why: 'Classic trap: integration-test only executes and records results. Always run `mvn verify` (or later phases like install) in CI so Failsafe can fail the build.',
    },
  ],
  hints: [
    'Look at the class name suffix: Test vs IT.',
    'Failsafe has two goals: integration-test and verify.',
  ],
  explanation: `\`\`\`xml
<plugin>
  <artifactId>maven-failsafe-plugin</artifactId>
  <version>3.5.4</version>  <!-- suiteXmlFiles is not supported from Failsafe 3.6 -->
  <executions>
    <execution>
      <goals><goal>integration-test</goal><goal>verify</goal></goals>
    </execution>
  </executions>
  <configuration>
    <suiteXmlFiles><suiteXmlFile>testng-ui.xml</suiteXmlFile></suiteXmlFiles>
  </configuration>
</plugin>
\`\`\`

| | Surefire | Failsafe |
|---|---|---|
| Phase | test | integration-test + verify |
| Default classes | *Test | *IT |
| On failure | stops at once | runs post-integration-test, fails in verify |
| Reports | target/surefire-reports | target/failsafe-reports |

Many QA-only repos keep everything in Surefire and select with groups/profiles — that is fine. Failsafe pays off when
the repo also has fast unit-level tests or needs reliable set-up/tear-down around the UI run.`,
  mistakes: [
    'Running mvn integration-test in CI and getting green builds with failing tests.',
    'Renaming UI tests to *IT but forgetting to add the Failsafe plugin, so they never run.',
    'Looking for Failsafe results in target/surefire-reports.',
  ],
  interview: [
    { q: 'What is the difference between Surefire and Failsafe?', a: 'Surefire runs unit-style tests in the test phase and fails immediately. Failsafe runs integration tests in integration-test and fails the build in verify, so post-integration-test clean-up still runs. Default naming: *Test vs *IT.' },
    { q: 'Which command do you run in CI for a Failsafe setup?', a: 'mvn verify (or a later phase). integration-test alone never fails the build on test failures.' },
  ],
}
