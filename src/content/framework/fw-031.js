export default {
  id: 'fw-031',
  category: 'framework',
  kind: 'quiz',
  title: '@Factory: run a whole test class once per user',
  level: 'ADVANCED',
  tags: ['testng', 'factory', 'dataprovider', 'data-driven', 'lifecycle'],
  estMinutes: 15,
  scenario: `ShopEasy has three customer accounts that behave differently: \`standard_user\` (India), \`visual_user\` (US) and a
newly registered user. Product wants the **entire** \`CheckoutTest\` class — 6 tests sharing a logged-in session set up in
\`@BeforeClass\` — to run for each account. Adding a DataProvider to all 6 methods would log in 18 times and mix the
users in the report. A senior suggests TestNG's \`@Factory\`.`,
  description: 'Answer the questions about how @Factory works and how it differs from @DataProvider.',
  questions: [
    {
      q: 'What does a method annotated with `@Factory` return?',
      options: [
        'Object[][] of parameters for one test method',
        'Object[] of test-class instances; TestNG runs the @Test methods of every instance',
        'A list of testng.xml files',
        'A WebDriver per thread',
      ],
      answer: 1,
      why: 'A factory creates test objects. Each returned instance is a full test class with its own fields (e.g. its own username) and TestNG runs all its tests. A DataProvider, by contrast, feeds rows into one method.',
    },
    {
      q: `Which version is a correct factory driven by a DataProvider?

\`\`\`java
public class CheckoutTest {
    private final String username;

    @Factory(dataProvider = "users")
    public CheckoutTest(String username) { this.username = username; }

    @DataProvider
    public static Object[][] users() {
        return new Object[][] { {"standard_user"}, {"visual_user"} };
    }
}
\`\`\``,
      options: [
        'Correct: @Factory on the constructor with a static DataProvider creates one instance per row',
        'Wrong: @Factory can only be on a static method',
        'Wrong: the DataProvider must return Object[], not Object[][]',
        'Wrong: constructors cannot have parameters in TestNG',
      ],
      answer: 0,
      why: '@Factory can annotate a constructor with dataProvider = "...". The provider must be static because it runs before any instance exists. Each row becomes a constructor call, so you get one CheckoutTest per user.',
    },
    {
      q: 'The factory creates 3 instances of `CheckoutTest`, which has one `@BeforeClass` login and 6 `@Test` methods. How many times does `@BeforeClass` run?',
      options: ['1', '3 — once per instance', '6', '18'],
      answer: 1,
      why: 'Class-level configuration runs per test instance, so each user logs in once and reuses the session for its 6 tests: 3 logins in total instead of 18 with a per-method DataProvider.',
    },
    {
      q: 'In the log, tests of the three users are interleaved (user A test 1, user B test 1, user A test 2…), and one user\'s logout disturbs another. Which testng.xml setting keeps each instance\'s tests together?',
      options: [
        'preserve-order="false"',
        'group-by-instances="true" on <suite> or <test>',
        'parallel="none"',
        'thread-count="1"',
      ],
      answer: 1,
      why: 'group-by-instances="true" makes TestNG run all methods of one instance before moving to the next — needed when an instance holds a session. (You can also run instances in parallel with parallel="instances", each with its own ThreadLocal driver.)',
    },
    {
      q: 'The report shows `CheckoutTest.placeOrder` three times and nobody can tell which user failed. Best fix?',
      options: [
        'Add System.out.println(username) in each test',
        'Implement org.testng.ITest and return a name including the username from getTestName() (or include it in the assertion messages and report labels)',
        'Create three copies of the class',
        'Remove @Factory and use priority',
      ],
      answer: 1,
      why: 'ITest lets each instance supply its own test name, so reports show "placeOrder [visual_user]". Assertion messages with the username help too. Copies of the class are what @Factory was supposed to avoid.',
    },
  ],
  hints: [
    'DataProvider = rows for one method. Factory = instances of a whole class.',
    'The DataProvider used by a constructor factory runs before any instance exists.',
    'Look for a testng.xml attribute with "instances" in its name.',
  ],
  explanation: `**@DataProvider vs @Factory**

| | @DataProvider | @Factory |
|---|---|---|
| Repeats | one @Test method | every @Test in the class |
| Returns | \`Object[][]\` / \`Iterator<Object[]>\` of parameters | \`Object[]\` of test instances |
| @BeforeClass | once (for all rows) | once per instance |
| Good for | many input rows for one behaviour | the same flow for several users, locales, roles or environments |

Typical shape: \`@Factory(dataProvider = "users")\` on the constructor, fields set from the parameters, \`@BeforeClass\`
logs in with \`this.username\`, \`group-by-instances="true"\` in testng.xml, and \`ITest#getTestName\` for readable reports.

A reviewer still asks: *does every test really need to run for every user?* If only the tax calculation differs per
country, a DataProvider on that one test is cheaper than tripling the class.`,
  mistakes: [
    'Making the factory\'s DataProvider an instance method — it must be static.',
    'Storing the username in a static field, so every instance sees the last user.',
    'Forgetting group-by-instances and getting interleaved sessions.',
    'Using @Factory when only one test actually varies by data.',
  ],
  interview: [
    { q: 'What is the difference between @Factory and @DataProvider?', a: 'A DataProvider supplies parameter rows to a single test method. A Factory creates multiple instances of a test class, so all tests in the class run per instance, with class-level set-up per instance.' },
    { q: 'Give a real use case for @Factory.', a: 'Running a whole checkout class for each customer role or country: each instance logs in once in @BeforeClass as its user and runs all checkout tests, with group-by-instances keeping each user\'s tests together.' },
  ],
}
