export default {
  id: 'int-004',
  category: 'interview',
  kind: 'quiz',
  title: 'Cucumber vs TestNG — and why real projects use both',
  level: 'INTERMEDIATE',
  tags: ['cucumber', 'testng', 'bdd', 'runner', 'tags', 'hooks'],
  estMinutes: 15,
  scenario: `The interviewer looks at your CV: "Selenium, Cucumber, TestNG." Then asks: *"Why both Cucumber and TestNG? Aren't they doing the same thing?"* This question checks if you actually understand what each layer does in your framework.`,
  description: `Answer the questions. Focus on *roles*: Cucumber = BDD layer (Gherkin, glue, hooks, tags); TestNG = test runner/execution engine (assertions, parallel, listeners, XML suites).`,
  hints: [
    'Cucumber scenarios can be executed by a JUnit or a TestNG runner.',
    'AbstractTestNGCucumberTests turns each scenario into a TestNG test.',
  ],
  questions: [
    {
      q: 'What is the main reason teams use Cucumber?',
      options: [
        'It makes Selenium faster',
        'Business-readable Gherkin scenarios that BAs/POs can review — living documentation and shared understanding of acceptance criteria',
        'It replaces the need for page objects',
        'It is required for parallel execution',
      ],
      answer: 1,
      why: 'Cucumber is about collaboration and readability. It does nothing for speed and doesn\'t replace POM — step definitions still call page objects. If nobody outside QA reads the features, Cucumber adds overhead; mention that you know this trade-off.',
    },
    {
      q: `What does this runner do?

\`\`\`java
@CucumberOptions(
    features = "src/test/resources/features",
    glue = {"com.shopeasy.stepdefs", "com.shopeasy.hooks"},
    tags = "@smoke and not @wip",
    plugin = {"pretty", "html:target/cucumber.html", "json:target/cucumber.json"}
)
public class SmokeRunner extends AbstractTestNGCucumberTests {
    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() { return super.scenarios(); }
}
\`\`\``,
      options: [
        'Runs all scenarios sequentially with JUnit',
        'Runs scenarios tagged @smoke but not @wip, via TestNG, in parallel, producing HTML and JSON reports',
        'Runs only the step definitions without features',
        'Generates feature files from Java code',
      ],
      answer: 1,
      why: 'features + glue wire things up, tags filter scenarios, plugin configures reports, and overriding scenarios() with @DataProvider(parallel = true) lets TestNG run scenarios in parallel (thread count via testng.xml data-provider-thread-count or Surefire).',
    },
    {
      q: 'Which is a TestNG feature rather than a Cucumber feature?',
      options: [
        'Scenario Outline with Examples',
        'Background',
        'testng.xml suites, @DataProvider, listeners (ITestListener, IRetryAnalyzer), groups and parallel attributes',
        'Gherkin tags like @regression',
      ],
      answer: 2,
      why: 'Outline, Background and tags are Cucumber/Gherkin. TestNG brings suite XML, data providers, listeners, retry analyzers, priorities, groups and parallel configuration. In a Cucumber+TestNG framework you use both sets.',
    },
    {
      q: 'Cucumber hooks vs TestNG annotations — which pairing is correct?',
      options: [
        '@Before (io.cucumber.java) runs before each scenario, like @BeforeMethod; @After after each scenario — often used for screenshots on failure and driver.quit()',
        'Cucumber @Before runs once per suite',
        'Hooks run only for failed scenarios',
        'Cucumber hooks must be in the runner class',
      ],
      answer: 0,
      why: 'Cucumber hooks run per scenario (and @BeforeStep/@AfterStep per step; @BeforeAll/@AfterAll once). Import from io.cucumber.java, not org.junit — a classic bug. Hooks live in a glue package, not the runner.',
    },
    {
      q: 'When would you choose plain TestNG (no Cucumber)?',
      options: [
        'Never',
        'When the audience is purely technical, e.g. API/component tests or a team where nobody reads Gherkin — the extra layer adds maintenance without collaboration value',
        'When you need assertions',
        'When tests must run on Jenkins',
      ],
      answer: 1,
      why: 'A mature answer shows trade-offs: BDD is valuable when business people collaborate on scenarios. For technical suites, TestNG + POM is simpler and faster to maintain. Both run fine on Jenkins.',
    },
  ],
  explanation: `**One-sentence answer:**
> "Cucumber is our BDD layer — Gherkin features, step definitions, hooks and tags — and TestNG is the execution engine underneath: the runner extends AbstractTestNGCucumberTests, so we get TestNG assertions, parallel execution through the data provider, listeners and suite XML."

**Where each lives in the framework:**
- \`features/*.feature\` → Gherkin (Cucumber)
- \`stepdefs\`, \`hooks\` → Cucumber annotations (\`@Given\`, \`@Before\`)
- \`runners\` → \`@CucumberOptions\` + TestNG \`@DataProvider(parallel = true)\`
- \`testng.xml\` / Surefire → thread count, suites
- Assertions → TestNG \`Assert\` (or AssertJ)`,
  mistakes: [
    'Saying Cucumber and TestNG are alternatives you cannot combine.',
    'Importing org.junit.Before instead of io.cucumber.java.Before in hooks.',
    'Claiming Cucumber makes tests faster.',
    'Not knowing where tags are configured.',
  ],
  interview: [
    { q: 'Why did you use both Cucumber and TestNG?', a: 'Cucumber gives us readable Gherkin scenarios that our BA and product owner review, so features double as living documentation. TestNG is the runner underneath — our runner extends AbstractTestNGCucumberTests, which gives us TestNG assertions, parallel execution via the scenarios data provider, listeners for reporting, and testng.xml for suites.' },
    { q: 'How do you run only smoke tests?', a: 'With Cucumber tags. Scenarios are tagged @smoke or @regression and we pass the tag expression either in @CucumberOptions or at runtime with -Dcucumber.filter.tags="@smoke" from Maven, which is how Jenkins triggers the smoke job after each deployment.' },
    { q: 'What is the difference between Background and a hook?', a: 'Background is visible business context in the feature file, run before each scenario in that feature, for example "Given I am logged in". Hooks are technical setup in code, like starting the browser or taking screenshots, and are invisible to business readers.' },
  ],
}
