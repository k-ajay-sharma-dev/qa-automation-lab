export default {
  id: 'fw-015',
  category: 'framework',
  kind: 'quiz',
  title: 'Predict the order: inheritance, priority and dependsOnMethods',
  level: 'BEGINNER',
  tags: ['testng', 'annotations', 'lifecycle', 'priority', 'dependsonmethods'],
  estMinutes: 12,
  scenario: `Code review on the ShopEasy repo. A new joiner's \`CartTest\` extends \`BaseTest\`, adds its own \`@BeforeMethod\`,
uses \`priority\` to "make the cart tests run in the right order" and \`dependsOnMethods\` to skip checkout when login
fails. The CI log order surprises everyone. Before you comment on the PR, predict exactly what TestNG will print.`,
  description: `For each snippet, predict what TestNG does. Each method only prints its own name. Assume the class is run on
its own (no \`parallel\`, default \`preserve-order\`).`,
  questions: [
    {
      q: `\`BaseTest\` and \`CartTest\` both have set-up and tear-down methods. What is printed for the single test?

\`\`\`java
public class BaseTest {
    @BeforeMethod public void baseSetUp()    { print("base-before"); }
    @AfterMethod  public void baseTearDown() { print("base-after"); }
}
public class CartTest extends BaseTest {
    @BeforeMethod public void cartSetUp()    { print("cart-before"); }
    @AfterMethod  public void cartTearDown() { print("cart-after"); }
    @Test public void removeBackpack()       { print("test"); }
}
\`\`\``,
      options: [
        'cart-before, base-before, test, cart-after, base-after',
        'base-before, cart-before, test, cart-after, base-after',
        'base-before, cart-before, test, base-after, cart-after',
        'The order is random',
      ],
      answer: 1,
      why: 'TestNG runs @Before methods from the top of the inheritance chain down (parent first: the browser exists before the child logs in) and @After methods in reverse, child first (the child logs out before the parent quits the browser). Like nested brackets.',
    },
    {
      q: `No \`priority\` anywhere. In which order do these run?

\`\`\`java
public class CheckoutTest extends BaseTest {
    @Test public void verifyTotal()   { ... }
    @Test public void addBackpack()   { ... }
    @Test public void login()         { ... }
}
\`\`\``,
      options: [
        'verifyTotal, addBackpack, login (the order in the file)',
        'addBackpack, login, verifyTotal (alphabetical by method name)',
        'login, addBackpack, verifyTotal (TestNG guesses the flow)',
        'Random every run',
      ],
      answer: 1,
      why: 'Without priority or dependencies TestNG sorts methods of a class by name. The order in the source file is NOT used. That is why tests that only pass "in the right order" break the day someone renames a method — each test must set up its own state.',
    },
    {
      q: `What is the run order now?

\`\`\`java
@Test(priority = 1)  public void applyCoupon() { ... }
@Test                public void openCart()    { ... }
@Test(priority = -1) public void emptyCart()   { ... }
\`\`\``,
      options: [
        'applyCoupon, openCart, emptyCart',
        'emptyCart, openCart, applyCoupon',
        'openCart, emptyCart, applyCoupon',
        'Negative priorities are not allowed, so the class fails to load',
      ],
      answer: 1,
      why: 'Lower priority runs first. The default priority is 0, so openCart (0) sits between emptyCart (-1) and applyCoupon (1). Priority only orders tests; it does not skip anything when an earlier test fails.',
    },
    {
      q: `\`login\` fails with an AssertionError. What does the report show for \`addBackpack\`?

\`\`\`java
@Test public void login() { ... }

@Test(dependsOnMethods = "login")
public void addBackpack() { ... }
\`\`\``,
      options: [
        'PASSED — it still runs',
        'FAILED with the same AssertionError',
        'SKIPPED — a method it depends on failed',
        'It is not listed at all',
      ],
      answer: 2,
      why: 'dependsOnMethods means "only run me if those passed". When login fails, addBackpack is SKIPPED. With priority alone it would have run (and probably failed with a confusing NoSuchElementException on the login page).',
    },
    {
      q: `\`@BeforeMethod\` opens Chrome and then throws because the QA server is down. \`@AfterMethod public void quit()\` has **no** \`alwaysRun\`. What happens?`,
      options: [
        'The test fails and quit() closes Chrome',
        'The test is SKIPPED and quit() is also skipped, so Chrome stays open on the CI agent',
        'quit() runs first, then the test',
        'TestNG retries the @BeforeMethod three times',
      ],
      answer: 1,
      why: 'After a configuration failure TestNG skips the test and the following configuration methods — unless they have alwaysRun = true. Leaked browsers pile up on CI agents until they run out of memory. Teardown methods always get alwaysRun = true.',
    },
    {
      q: `Two classes in one \`<test>\`, each with \`@BeforeClass\`, \`@BeforeMethod\` and **2** \`@Test\` methods. \`BaseTest\` (parent of both) has \`@BeforeSuite\`. How many lines does each set-up print in total?`,
      options: [
        'BeforeSuite 2, BeforeClass 2, BeforeMethod 4',
        'BeforeSuite 1, BeforeClass 2, BeforeMethod 4',
        'BeforeSuite 1, BeforeClass 1, BeforeMethod 2',
        'BeforeSuite 4, BeforeClass 2, BeforeMethod 4',
      ],
      answer: 1,
      why: 'Inheriting a @BeforeSuite into two classes does not run it twice: it runs once per suite. @BeforeClass runs once per class (2), @BeforeMethod once per test method (2 × 2 = 4).',
    },
  ],
  hints: [
    'Parent @Before first, parent @After last — like opening and closing brackets.',
    'Without priority, method names decide; priority defaults to 0 and lower runs first.',
    'dependsOnMethods skips; priority only orders.',
  ],
  explanation: `The full picture for \`CartTest extends BaseTest\` with one test:

\`\`\`text
BaseTest  @BeforeSuite          (once per run, even if inherited by many classes)
CartTest  @BeforeClass
BaseTest  @BeforeMethod         parent first ...
CartTest  @BeforeMethod         ... then child
CartTest  @Test
CartTest  @AfterMethod          child first ...
BaseTest  @AfterMethod          ... then parent (alwaysRun = true!)
CartTest  @AfterClass
BaseTest  @AfterSuite
\`\`\`

**Ordering tools and what they really mean**

| Tool | Orders tests? | Skips on failure? | Use it for |
|---|---|---|---|
| nothing | alphabetical | no | the normal case: independent tests |
| \`priority\` | yes, low first | no | rare cases, e.g. a "create" test you want first in the report |
| \`dependsOnMethods\` | yes | yes (SKIPPED) | a real dependency you cannot avoid |

A reviewer's comment on the new joiner's PR: *"If a test needs a logged-in cart, it should log in and add the item
itself (through BaseTest or the API) instead of relying on the test that runs before it."* (fw-019 practises that refactor.)`,
  mistakes: [
    'Assuming TestNG runs methods in the order they are written in the file.',
    'Using priority to build a flow, then getting confusing failures because a failed step does not skip the later ones.',
    'Teardown without alwaysRun = true, leaking browsers when set-up fails.',
    'Thinking an inherited @BeforeSuite runs once per subclass.',
  ],
  interview: [
    { q: 'In what order does TestNG run test methods in a class?', a: 'By default alphabetically by method name. priority changes it (lower first, default 0), and dependsOnMethods forces dependencies to run first and skips the dependent test if a dependency fails.' },
    { q: 'How do inherited @BeforeMethod methods run?', a: 'Before methods run parent first, down the inheritance chain; after methods run in reverse, child first, then parent. That is why BaseTest can create the driver in @BeforeMethod and a subclass can safely log in in its own @BeforeMethod.' },
    { q: 'priority vs dependsOnMethods?', a: 'priority only orders tests and never skips; dependsOnMethods orders and skips the dependent test when the dependency fails. Both create coupling between tests, so prefer independent tests and use them sparingly.' },
  ],
}
