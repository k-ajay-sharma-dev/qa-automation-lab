export default {
  id: 'fw-002',
  category: 'framework',
  kind: 'quiz',
  title: 'TestNG annotations: what runs when?',
  level: 'BEGINNER',
  tags: ['testng', 'annotations', 'lifecycle'],
  estMinutes: 10,
  scenario: `A teammate put the "clear test database" call in \`@BeforeClass\` and the "login" in \`@BeforeSuite\`, and now the
second test class starts on a logged-out browser. Before anyone moves things around, you need to know exactly
in which order TestNG calls its configuration methods.`,
  description: `Answer the questions about the TestNG lifecycle. Assume a \`testng.xml\` with one \`<suite>\`, one \`<test>\`
and two classes, each with two \`@Test\` methods.`,
  questions: [
    {
      q: 'What is the correct order of the **before** annotations, outermost first?',
      options: [
        '@BeforeClass → @BeforeSuite → @BeforeTest → @BeforeMethod',
        '@BeforeSuite → @BeforeTest → @BeforeClass → @BeforeMethod',
        '@BeforeTest → @BeforeSuite → @BeforeMethod → @BeforeClass',
        '@BeforeMethod → @BeforeClass → @BeforeTest → @BeforeSuite',
      ],
      answer: 1,
      why: 'Suite → Test (the `<test>` tag in testng.xml, not a test method!) → Class → Method. The After annotations run in the reverse order: AfterMethod → AfterClass → AfterTest → AfterSuite.',
    },
    {
      q: 'With 2 classes × 2 test methods, how many times does `@BeforeMethod` run and how many times `@BeforeClass`?',
      options: ['1 and 1', '4 and 2', '2 and 4', '4 and 1'],
      answer: 1,
      why: '@BeforeMethod runs before every @Test method (4). @BeforeClass runs once per class (2). @BeforeSuite and @BeforeTest run once here.',
    },
    {
      q: '`@BeforeTest` is a common source of confusion. What does it run before?',
      options: [
        'Each @Test method',
        'Each `<test>` tag in testng.xml (a group of classes)',
        'Only tests in the "test" group',
        'The first test method of each class',
      ],
      answer: 1,
      why: 'The name is misleading. The `<test>` element in testng.xml is a set of classes, and @BeforeTest runs once before it. Use @BeforeMethod for "before each test method".',
    },
    {
      q: 'Where should you start a fresh browser if you run with `parallel="methods"`?',
      options: ['@BeforeSuite', '@BeforeTest', '@BeforeClass', '@BeforeMethod'],
      answer: 3,
      why: 'Each method may run on a different thread, so each needs its own driver created in @BeforeMethod (stored in a ThreadLocal) and quit in @AfterMethod(alwaysRun = true).',
    },
    {
      q: 'A `@BeforeMethod` throws an exception. What happens to the related test method?',
      options: [
        'It runs anyway',
        'It is reported as FAILED',
        'It is SKIPPED (configuration failure), and later config methods may be skipped too unless alwaysRun = true',
        'TestNG stops the whole JVM',
      ],
      answer: 2,
      why: 'Configuration failures cause dependent tests to be skipped. That is why teardown methods use alwaysRun = true, and why a sudden wave of "skipped" tests in a report usually points to a broken setup method.',
    },
    {
      q: 'Which is the best place for loading config.properties and starting an ExtentReports instance once per run?',
      options: ['@BeforeMethod', '@BeforeClass', '@BeforeSuite (or a listener onStart)', 'Inside each @Test'],
      answer: 2,
      why: 'Expensive, run-wide setup belongs at suite level. Per-test resources (browser, test data) belong at method level.',
    },
  ],
  hints: ['Suite > Test (xml tag) > Class > Method.', 'Skipped is different from failed.'],
  explanation: `\`\`\`text
@BeforeSuite
  @BeforeTest            (per <test> tag in testng.xml)
    @BeforeClass         (per class)
      @BeforeMethod      (per @Test method)
        @Test
      @AfterMethod
    @AfterClass
  @AfterTest
@AfterSuite
\`\`\`
Rule of thumb: run-wide setup (config, reports) at suite level; anything that must be isolated (browser, logged-in
session, test data) at method level. Always mark teardown \`alwaysRun = true\`.`,
  mistakes: [
    'Thinking @BeforeTest means "before each test method".',
    'Creating the browser in @BeforeClass while running parallel methods.',
    'Ignoring skipped tests in reports; they usually hide a setup failure.',
  ],
  interview: [
    { q: 'List the TestNG annotations in execution order.', a: 'BeforeSuite, BeforeTest, BeforeClass, BeforeMethod, Test, AfterMethod, AfterClass, AfterTest, AfterSuite. BeforeGroups/AfterGroups run around the first/last method of a group.' },
    { q: 'Why are tests SKIPPED instead of FAILED sometimes?', a: 'A configuration method (e.g. @BeforeMethod) failed, a dependsOnMethods dependency failed, or a SkipException was thrown. TestNG skips the affected tests instead of running them in a broken state.' },
  ],
}
