export default {
  id: 'fw-027',
  category: 'framework',
  kind: 'quiz',
  title: 'TestNG or JUnit 5? Choosing the runner for a new framework',
  level: 'BEGINNER',
  tags: ['testng', 'junit5', 'framework-design', 'annotations', 'decision-making'],
  estMinutes: 10,
  scenario: `Kick-off for the ShopEasy UI framework. A developer says *"Everyone uses JUnit 5 now, why TestNG?"*, the
other QA wants TestNG "because all the tutorials use it". Your lead asks you to bring facts, not opinions, to the
next stand-up — and to warn the team about the traps when switching between the two.`,
  description: `Answer each question. Think about what the **team** needs (groups, parallel runs, suite files, data-driven tests,
existing code), not about which tool is "better".`,
  questions: [
    {
      q: 'The release manager wants to run "smoke on Chrome and Firefox in parallel, with a different `browser` parameter per block" from **one versioned suite file**. Which runner supports that out of the box?',
      options: [
        'TestNG — testng.xml has <test> blocks, <parameter>, groups and parallel attributes',
        'JUnit 5 — junit-platform.properties lists the test classes per browser',
        'Neither — this always needs a CI matrix',
        'Both equally; there is no difference',
      ],
      answer: 0,
      why: 'testng.xml is a first-class suite file: <test> blocks, <parameter> values, include/exclude groups and parallel="tests". JUnit 5 can run in parallel (junit-platform.properties) and filter by @Tag, but it has no equivalent "suite file with per-block parameters"; you would use Maven profiles or a CI matrix instead.',
    },
    {
      q: 'Map the TestNG idea to JUnit 5. Which pair is **wrong**?',
      options: [
        '@BeforeMethod → @BeforeEach',
        'groups = "smoke" → @Tag("smoke")',
        '@DataProvider → @ParameterizedTest with @MethodSource / @CsvSource',
        '@BeforeClass (instance method) → @BeforeAll (instance method, no change needed)',
      ],
      answer: 3,
      why: 'In JUnit 5 @BeforeAll must be **static** by default, because JUnit creates a new test-class instance per test method. You either make it static or add @TestInstance(Lifecycle.PER_CLASS). The other three mappings are correct.',
    },
    {
      q: `A tester moves this check from a TestNG class to a JUnit 5 class unchanged (imports switched). The cart shows 2 items. What does the failure message say if it ever fails?

\`\`\`java
// TestNG:  Assert.assertEquals(actual, expected)
assertEquals(cartPage.getItemCount(), 3);
\`\`\``,
      options: [
        'expected: <3> but was: <2>',
        'expected: <2> but was: <3>',
        'It does not compile in JUnit 5',
        'JUnit 5 detects the order automatically',
      ],
      answer: 1,
      why: 'TestNG is assertEquals(actual, expected); JUnit 5 is assertEquals(expected, actual). The code compiles, the pass/fail result is the same, but the message is reversed and misleads whoever reads the report at 2 a.m. When switching runners, fix the argument order (or use AssertJ: assertThat(actual).isEqualTo(expected)).',
    },
    {
      q: 'The team also wants Cucumber feature files. Does choosing JUnit 5 instead of TestNG block that?',
      options: [
        'Yes, Cucumber only runs on TestNG',
        'Yes, Cucumber only runs on JUnit 4',
        'No — Cucumber has cucumber-testng and cucumber-junit-platform-engine; pick the one that matches the runner',
        'No, but you must run both runners in every build',
      ],
      answer: 2,
      why: 'Cucumber plugs into either runner: AbstractTestNGCucumberTests for TestNG, or the JUnit Platform engine (@Suite + @IncludeEngines("cucumber")) for JUnit 5. The runner choice does not decide whether you can use BDD.',
    },
    {
      q: 'The company already has 400 TestNG UI tests, a RetryAnalyzer, an ITestListener for screenshots and Jenkins jobs reading TestNG results. A new joiner proposes migrating everything to JUnit 5 "because it is newer". Best response?',
      options: [
        'Agree — newer is always better, start the migration this sprint',
        'Keep TestNG for this suite; the migration costs weeks and adds no test coverage. Revisit only if a concrete need appears (e.g. the dev team\'s unit tests and shared tooling standardise on JUnit 5)',
        'Run half the tests on each runner to compare',
        'Rewrite the suite in Playwright instead',
      ],
      answer: 1,
      why: 'Both runners are mature. The deciding factors are team skills, existing code (listeners, retry, reports) and CI integration. A rewrite that finds zero new bugs is hard to justify; a reasoned "not now, here is when we would" shows senior judgement.',
    },
  ],
  hints: [
    'TestNG\'s strength is testng.xml: groups, parameters and parallel config in one file.',
    'JUnit 5 creates a new instance per test method, which explains the static @BeforeAll.',
    'Check the argument order of assertEquals in both libraries.',
  ],
  explanation: `**Quick comparison for a UI/API automation framework**

| Need | TestNG 7 | JUnit 5 |
|---|---|---|
| Suite file with groups/parameters | testng.xml | no equivalent (Maven profiles, @Suite classes) |
| Groups / tags | \`groups = "smoke"\` | \`@Tag("smoke")\` |
| Data-driven | \`@DataProvider\` | \`@ParameterizedTest\` + \`@MethodSource\`/\`@CsvSource\` |
| Set-up per test / per class | \`@BeforeMethod\` / \`@BeforeClass\` | \`@BeforeEach\` / static \`@BeforeAll\` |
| Dependencies between tests | \`dependsOnMethods\` | none (by design) |
| Extensions / hooks | listeners (\`ITestListener\`, \`IRetryAnalyzer\`) | \`Extension\` API (\`TestWatcher\`, \`ParameterResolver\`) |
| assertEquals order | (actual, expected) | (expected, actual) |

Neither is "the right one". TestNG is very common in Selenium/QA frameworks because of testng.xml; JUnit 5 is the
default for developers' unit tests and Spring projects. Pick one per suite, write the reason in the README, and stick
with it.`,
  mistakes: [
    'Choosing a runner because a tutorial used it instead of what the team and CI need.',
    'Copying assertEquals calls between TestNG and JUnit without swapping actual/expected.',
    'Making @BeforeAll an instance method in JUnit 5 and getting "must be static" errors.',
    'Proposing a big-bang migration of a working suite with no business benefit.',
  ],
  interview: [
    { q: 'Why did you choose TestNG (or JUnit 5) for your framework?', a: 'Give a reason tied to the project: TestNG for testng.xml suites with groups, parameters and parallel runs, plus listeners and retry; JUnit 5 if the dev team already standardised on it and we wanted one runner and shared extensions. Mention that Cucumber works with both.' },
    { q: 'What is the JUnit 5 equivalent of a TestNG DataProvider?', a: '@ParameterizedTest with a source: @CsvSource for small inline data, @MethodSource for a static method returning a Stream of Arguments, or @CsvFileSource for a CSV file.' },
    { q: 'What is one trap when moving tests between TestNG and JUnit?', a: 'The assertEquals argument order is reversed: TestNG is (actual, expected), JUnit is (expected, actual). The test still passes or fails correctly but the failure message is misleading.' },
  ],
}
