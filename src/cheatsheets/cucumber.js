export default {
  slug: 'cucumber',
  title: 'Cucumber BDD (Java, Cucumber 7)',
  sections: [
    {
      heading: 'Manual test case → Gherkin',
      body: `| Manual test case column | Gherkin |
|---|---|
| Title / objective | \`Scenario:\` name stating the rule |
| Preconditions | \`Given\` (+ \`And\`) — state, no actions |
| Steps (the action under test) | \`When\` (+ \`And\`) — ideally one behaviour |
| Expected results | \`Then\` (+ \`And\` / \`But\`) — observable outcomes |
| Test data rows | \`Scenario Outline\` + \`Examples\`, or a DataTable |
| Common preconditions of a suite | \`Background\` |
| Priority / suite (smoke, regression) | tags \`@smoke\` \`@regression\` |`,
    },
    {
      heading: 'Gherkin keywords',
      body: `\`\`\`gherkin
@checkout @regression
Feature: Checkout
  Free-text description (As a… I want… so that…)

  Background:
    Given the shopper is logged in as "standard_user"

  Rule: Customer details are mandatory        # optional grouping (Gherkin 6+)

    @smoke
    Scenario: Shopper completes an order
      Given the shopper has "Trailblazer Backpack" in the cart
      When the shopper checks out with
        | firstName | lastName | postalCode |
        | Asha      | Rao      | 560001     |
      Then the order confirmation is shown
      But no error is shown

    Scenario Outline: Login rejected for <case>
      When the shopper logs in with "<username>" and "<password>"
      Then the login error "<error>" is shown

      Examples:
        | case       | username        | password     | error                                        |
        | locked out | locked_out_user | secret_sauce | Error: Sorry, this user has been locked out. |
\`\`\`
- \`Scenario Template\` = \`Scenario Outline\`, \`Example\` = \`Scenario\`, \`Scenarios\` = \`Examples\`.
- Doc string: \`"""\` … \`"""\` under a step (multi-line text, e.g. JSON).
- \`#\` starts a comment line. Keywords are ignored when matching steps — only the text counts.`,
    },
    {
      heading: 'Writing good scenarios',
      body: `- **Declarative**, not imperative: \`When the shopper logs in as a standard user\`, not "type into #user-name, click #login-button".
- One behaviour per scenario: one \`When\`, 3–6 steps.
- Scenarios are **independent** — never rely on another scenario's data or order.
- No selectors, URLs, waits or "click" in Gherkin; those live in page objects.
- Title states the rule: "Locked-out user cannot log in", not "TC_05".
- Background short and business-relevant; technical setup goes in hooks.`,
    },
    {
      heading: 'Cucumber expressions',
      body: `| Expression | Matches | Java type |
|---|---|---|
| \`{string}\` | \`"text"\` or \`'text'\` (quotes removed) | String |
| \`{int}\` | \`42\`, \`-3\` | int / Integer |
| \`{long}\` \`{float}\` \`{double}\` \`{bigdecimal}\` | numbers | as named |
| \`{word}\` | a single word without spaces | String |
| \`{}\` | anything | String (or the parameter type) |
| \`item(s)\` | optional text: item / items | — |
| \`product/products\` | alternative text | — |

\`\`\`java
@When("the shopper logs in with {string} and {string}")
public void login(String user, String pass) { loginPage.loginAs(user, pass); }

@Then("the cart badge shows {int} item(s)")
public void badge(int expected) { assertEquals(inventoryPage.getCartBadgeCount(), expected); }
\`\`\`
Regex still works: \`@Given("^the cart has (\\\\d+) items?$")\`.
Custom type: \`@ParameterType("standard|locked_out") public UserType user(String s) {…}\` → use \`{user}\`.`,
    },
    {
      heading: 'DataTable conversions',
      body: `A DataTable is always the **last** parameter of the step method.

| Table shape | Method parameter / call |
|---|---|
| Header + rows | \`List<Map<String,String>>\` / \`table.asMaps()\` |
| 2 columns key/value | \`Map<String,String>\` / \`table.asMap()\` |
| No header, many columns | \`List<List<String>>\` / \`table.asLists()\` |
| Single column | \`List<String>\` / \`table.asList()\` |
| Rows → objects | \`List<Customer>\` + \`@DataTableType\` |

\`\`\`java
@DataTableType
public Customer customer(Map<String, String> row) {
    return new Customer(row.get("firstName"), row.get("lastName"), row.get("postalCode"));
}

@When("the shopper checks out as")
public void checkout(List<Customer> customers) { checkoutPage.fillCustomer(customers.get(0)); }
\`\`\`
Generic: \`@DefaultDataTableEntryTransformer\` + Jackson \`objectMapper.convertValue(entry, type)\`.`,
    },
    {
      heading: 'Hooks and execution order',
      body: `\`\`\`
@BeforeAll (static, once)
  for each scenario:
    @Before           (order ascending: 0, 1, 2…)
    Background steps
    steps             (@BeforeStep / @AfterStep around each)
    @After            (order DESCENDING: higher runs first; always runs, even on failure)
@AfterAll (static, once)
\`\`\`
\`\`\`java
import io.cucumber.java.After;     // NOT org.junit / org.testng
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

@After
public void tearDown(Scenario scenario) {
    try {
        if (scenario.isFailed()) {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", scenario.getName());
        }
    } finally {
        context.quitDriver();
    }
}
\`\`\`
Tagged hook: \`@Before("@admin and not @api")\`.`,
    },
    {
      heading: 'Tags and tag expressions',
      body: `- Tags are inherited: Feature → Rule → Scenario / Outline → Examples.
- Operators: \`and\`, \`or\`, \`not\`, parentheses. (\`~@wip\` and commas are Cucumber 1.x — removed.)

| Goal | Expression |
|---|---|
| Smoke only | \`@smoke\` |
| Nightly | \`@regression and not @wip\` |
| Cart or checkout smoke | \`@smoke and (@cart or @checkout)\` |

\`\`\`bash
mvn test -Dcucumber.filter.tags="@smoke and not @wip"
\`\`\`
Precedence: \`-D\` system property / env var  >  \`cucumber.properties\` / \`junit-platform.properties\`  >  \`@CucumberOptions\`.`,
    },
    {
      heading: 'Runner (TestNG) and options',
      body: `\`\`\`java
@CucumberOptions(
    features  = "src/test/resources/features",
    glue      = {"com.shopeasy.steps", "com.shopeasy.hooks"},
    tags      = "@regression and not @wip",
    plugin    = {"pretty",
                 "html:target/cucumber-reports/cucumber.html",
                 "json:target/cucumber-reports/cucumber.json",
                 "rerun:target/failed_scenarios.txt"},
    monochrome = true,
    dryRun     = false,
    publish    = false
)
public class TestRunner extends AbstractTestNGCucumberTests {
    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() { return super.scenarios(); }
}
\`\`\`
- Thread count: \`-Ddataproviderthreadcount=4\` or \`data-provider-thread-count\` in testng.xml.
- Rerun failures: second runner with \`features = "@target/failed_scenarios.txt"\`.
- \`dryRun = true\` → finds undefined / ambiguous steps without starting a browser.
- JUnit 5: \`@Suite @IncludeEngines("cucumber") @SelectClasspathResource("features")\` + \`junit-platform.properties\`.`,
    },
    {
      heading: 'Sharing state: PicoContainer',
      body: `\`\`\`xml
<dependency>
  <groupId>io.cucumber</groupId>
  <artifactId>cucumber-picocontainer</artifactId>
  <version>7.18.0</version>
  <scope>test</scope>
</dependency>
\`\`\`
\`\`\`java
public class CartSteps {
    private final TestContext context;
    public CartSteps(TestContext context) { this.context = context; }   // injected, one per scenario
}
\`\`\`
- Never \`new TestContext()\` and never \`static\` driver/data.
- Hooks can inject the same \`TestContext\` to quit the right browser.
- Only one DI module (pico **or** spring **or** guice) on the classpath.`,
    },
    {
      heading: 'Common errors',
      body: `| Message | Usual cause | Fix |
|---|---|---|
| Undefined step | package missing from \`glue\`, text typo, plural, quotes | add package / fix text / \`item(s)\` |
| AmbiguousStepDefinitionsException | two expressions match the same step | reword or delete one |
| Pending | snippet still throws \`PendingException\` | implement, or tag \`@wip\` |
| Step has N arguments but method has M | DataTable/DocString not declared, or extra params | DataTable is ONE last parameter |
| No default constructor | constructor injection without picocontainer | add \`cucumber-picocontainer\` |
| Tests run: 0 | runner name not matched by Surefire / wrong \`features\` path | name it \`*Test\` / \`*Runner\` + include |`,
    },
    {
      heading: 'Project layout',
      body: `\`\`\`
src/test/java/com/shopeasy/
  runners/     TestRunner.java, FailedRerunRunner.java
  steps/       LoginSteps.java, CartSteps.java, CheckoutSteps.java
  hooks/       Hooks.java
  pages/       BasePage.java, LoginPage.java, InventoryPage.java, CartPage.java, CheckoutPage.java
  support/     TestContext.java, DriverFactory.java, ConfigReader.java, DataTableTypes.java
  model/       Customer.java
src/test/resources/
  features/    login.feature, cart.feature, checkout.feature
  cucumber.properties     (cucumber.publish.quiet=true, defaults)
  config.properties       (baseUrl=http://localhost:5180/practice-site/, browser=chrome)
testng.xml
pom.xml       (cucumber-java, cucumber-testng, cucumber-picocontainer, selenium-java, testng)
\`\`\``,
    },
  ],
}
