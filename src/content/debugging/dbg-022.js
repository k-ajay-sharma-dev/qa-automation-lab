export default {
  id: 'dbg-022',
  category: 'debugging',
  kind: 'quiz',
  title: 'BUILD SUCCESS, Tests run: 0 — runner puzzles in Maven, TestNG and Cucumber',
  level: 'INTERMEDIATE',
  tags: ['maven', 'surefire', 'testng', 'cucumber', 'skipped', 'tags', 'runner'],
  estMinutes: 20,
  scenario: `Your team's pipeline has been suspiciously calm this sprint. Going through the last ten ShopEasy builds you find runs that are green with **0 tests**, scenarios that ran with the literal text \`<Product>\`, and a nightly report with 7 skipped tests nobody looked at. None of these is a product bug — they are all about **how the tests were found and started**. The QA lead asks you to explain each one at the retro.`,
  description: 'Each question is a real build excerpt. Pick the root cause or the right fix.',
  hints: [
    '"Tests run: 0" + BUILD SUCCESS means the runner found nothing to run — check names, annotations and filters before the app.',
    'Skipped is never "fine": something upstream failed or a filter excluded the test.',
  ],
  questions: [
    {
      q: `A new class was added and the build is green — but its tests never ran:

\`\`\`text
[INFO] Running com.shopeasy.api.tests.OrderApiTest
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.214 s - in com.shopeasy.api.tests.OrderApiTest
[INFO] BUILD SUCCESS
\`\`\`

\`\`\`java
import org.junit.jupiter.api.Test;   // pom.xml has testng 7.10 and Surefire runs testng.xml

public class OrderApiTest {
    @Test
    public void orderTotalIncludesTax() { ... }
}
\`\`\``,
      options: [
        'The ShopEasy API was down, so the tests were skipped',
        'The method is annotated with JUnit 5\'s @Test; the TestNG provider only recognises org.testng.annotations.Test, so it finds 0 test methods',
        'Test methods must be static',
        'Surefire only runs classes whose names start with "Test"',
      ],
      answer: 1,
      why: 'IDEs auto-import the first @Test they find. TestNG ignores JUnit annotations, so the class loads and contributes zero tests — a silent green. Fix the import to org.testng.annotations.Test. An API outage would produce errors (ConnectException), not 0 tests. Surefire\'s default includes are Test*.java, *Test.java, *Tests.java and *TestCase.java, and test methods are never static.',
    },
    {
      q: `\`mvn test\` (no testng.xml configured in Surefire) runs \`LoginTest\` and \`CartTests\`, but never \`CheckoutChecks.java\`, which sits in the same package with correct TestNG annotations. Why?`,
      options: [
        'TestNG runs classes alphabetically and stops after two',
        'CheckoutChecks has a compilation error',
        'Without a suite file, Surefire selects classes by name pattern (Test*, *Test, *Tests, *TestCase); "CheckoutChecks" matches none of them',
        'Classes must extend BaseTest to be discovered',
      ],
      answer: 2,
      why: 'Surefire\'s default <includes> are **/Test*.java, **/*Test.java, **/*Tests.java and **/*TestCase.java. Rename the class to CheckoutTest (the team convention) or configure <includes>/<suiteXmlFiles>. A compilation error would fail the build, not skip a class.',
    },
    {
      q: `The smoke job runs Cucumber with a tag filter and reports nothing:

\`\`\`text
$ mvn test -Dcucumber.filter.tags="@smoke and @checkout"

0 Scenarios
0 Steps
0m0.003s
\`\`\`

In the features, login scenarios are tagged \`@smoke\` and checkout scenarios are tagged \`@checkout\`. What happened?`,
      options: [
        'The glue path is wrong',
        '"and" selects only scenarios that carry BOTH tags; none do. The intent "smoke tests plus checkout tests" is "@smoke or @checkout"',
        'Tags must be written without the @ sign on the command line',
        'Cucumber cannot be filtered from Maven',
      ],
      answer: 1,
      why: 'Tag expressions are boolean: "@smoke and @checkout" = intersection, "@smoke or @checkout" = union, "not @wip" = exclusion. A wrong glue path would show undefined steps, not 0 scenarios. A pipeline should fail when 0 scenarios run — a silent "0 Scenarios" green build is how smoke coverage disappears unnoticed.',
    },
    {
      q: `A Scenario Outline fails with:

\`\`\`text
When I add "<Product>" to the cart
java.lang.IllegalArgumentException: No product card found for '<Product>'
	at com.shopeasy.pages.InventoryPage.addToCart(InventoryPage.java:44)
\`\`\`

\`\`\`gherkin
Scenario Outline: Add <product> to the cart
  When I add "<Product>" to the cart
  Examples:
    | product              |
    | Trailblazer Backpack |
\`\`\``,
      options: [
        'The product is out of stock',
        'The step definition needs {word} instead of {string}',
        'Placeholders are case-sensitive: "<Product>" doesn\'t match the Examples header "product", so Cucumber leaves the text unreplaced and passes it literally',
        'Scenario Outlines can\'t be used with data in quotes',
      ],
      answer: 2,
      why: 'Cucumber substitutes <name> only when it exactly matches an Examples column header. An unmatched placeholder stays as literal text, the {string} step still matches, and your page object receives "<Product>". The title "Add <product> …" was substituted correctly — which is the clue. Fix the step to "<product>".',
    },
    {
      q: `After a refactor, every scenario fails before the first step:

\`\`\`text
io.cucumber.java.InvalidMethodException: You're not allowed to extend classes that define Step Definitions or hooks. class com.shopeasy.stepdefs.CartSteps extends class com.shopeasy.stepdefs.BaseSteps
\`\`\`

\`BaseSteps\` holds the WebDriver and an \`@Before\` hook. What is the right fix?`,
      options: [
        'Make BaseSteps abstract',
        'Move the hook into its own Hooks class and share the driver/page objects through dependency injection (e.g. a TestContext injected by PicoContainer) instead of inheritance',
        'Copy the @Before hook into every step class',
        'Remove BaseSteps from the glue path',
      ],
      answer: 1,
      why: 'Cucumber creates step classes itself and forbids inheriting from a class that has step definitions or hooks (it would register them twice). Composition is the Cucumber way: one Hooks class, a shared TestContext (driver, page objects) injected into every step class constructor by cucumber-picocontainer. Copying hooks would run them once per class — several browsers per scenario.',
    },
    {
      q: `Nightly TestNG report:

\`\`\`text
Tests run: 9, Failures: 1, Errors: 0, Skipped: 7
...
[WARNING] placeOrder(com.shopeasy.tests.CheckoutFlowTest) skipped
org.testng.SkipException: Method placeOrder depends on not successfully finished methods
\`\`\`

All 7 skipped tests declare \`dependsOnMethods = "loginAsStandardUser"\`, and that one test failed. What do you do?`,
      options: [
        'Add alwaysRun = true to the 7 dependent tests so they run anyway',
        'Report 8 product defects',
        'Fix the root cause in loginAsStandardUser first; then remove the dependency chain so each test logs in for itself (e.g. in @BeforeMethod or via an API), making the tests independent',
        'Increase the retry count to 3',
      ],
      answer: 2,
      why: 'TestNG skips dependents when the method they depend on fails — 1 real failure, 7 consequences. Fix that one first. Long-term, dependsOnMethods chains make tests order-dependent and un-parallelisable; independent tests with their own setup are easier to triage. alwaysRun on the dependents would run them against a broken precondition and produce 7 misleading failures.',
    },
  ],
  explanation: `**"Green" only means "nothing failed" — not "something was tested".** All six puzzles are runner/discovery problems:

| Symptom | Usual cause |
|---|---|
| \`Tests run: 0\` for a class | Wrong \`@Test\` import (JUnit vs TestNG), or methods not public |
| Class never mentioned in the log | Class name doesn't match Surefire includes, or not listed in \`testng.xml\` |
| \`0 Scenarios\` | Tag expression excludes everything, or wrong \`features\` path |
| Literal \`<placeholder>\` in a step | Examples header doesn't match the placeholder (case-sensitive) |
| \`InvalidMethodException … extend\` | Inheritance between step/hook classes — use DI instead |
| Many Skipped | A config method or a \`dependsOnMethods\` target failed — find the one |

**Guard rails worth adding to the pipeline:** fail the build when the test count drops to 0 or far below the previous build (Jenkins test-trend, or a small script reading the Surefire XML); run Cucumber with \`--dry-run\` in PR builds; and treat Skipped as a number to explain in every triage summary.`,
  mistakes: [
    'Celebrating a green build without looking at the test count.',
    'Letting the IDE auto-import org.junit.jupiter.api.Test in a TestNG project.',
    'Using "and" in a tag expression when you mean "or".',
    'Treating skipped tests as passed in the release report.',
  ],
  interview: [
    { q: 'Your build passes but you suspect tests are not running. What do you check?', a: 'The test count in the Surefire summary and the per-class "Tests run" lines, then the @Test import (JUnit vs TestNG), the class naming against Surefire includes or testng.xml, and for Cucumber the tag expression and features path. We also fail the pipeline if the number of executed tests drops to zero.' },
    { q: 'Why are some TestNG tests skipped?', a: 'Because a configuration method like @BeforeMethod or @BeforeClass failed, a method they depend on through dependsOnMethods failed, or the test threw SkipException. Skips are consequences, so I look for the first failure upstream and fix that.' },
    { q: 'How do you share the WebDriver between Cucumber step classes?', a: 'Not through inheritance — Cucumber forbids extending classes with steps or hooks. We use cucumber-picocontainer: a TestContext class holds the driver and page objects, and every step class and the Hooks class receive it in their constructor, one instance per scenario.' },
  ],
}
