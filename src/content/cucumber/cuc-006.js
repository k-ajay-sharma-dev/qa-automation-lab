export default {
  id: 'cuc-006',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Step definitions with {string} and {int}',
  level: 'BEGINNER',
  tags: ['step-definitions', 'cucumber-expressions', 'page-object'],
  estMinutes: 20,
  scenario: `The login and cart scenarios are written, but when you run them Cucumber prints "Undefined step" with snippet
suggestions. Your job: write the glue code. The \`LoginPage\` and \`InventoryPage\` page objects already exist (the POM track built them).`,
  description: `Implement \`LoginSteps\` for these steps:

\`\`\`gherkin
Given the shopper is on the login page
When the shopper logs in with "standard_user" and "secret_sauce"
And the shopper adds 2 products to the cart
Then the cart badge shows 2
\`\`\`

**Rules**
- Annotations from \`io.cucumber.java.en.*\` (\`@Given\`, \`@When\`, \`@Then\`).
- Use **Cucumber expressions**: \`{string}\` for quoted text, \`{int}\` for numbers — no hard-coded user names in the annotation.
- Step methods call page objects; **no** \`driver.findElement\` inside step definitions.
- Assert in the Then step (TestNG \`Assert\` or AssertJ).`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import com.shopeasy.support.DriverFactory;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginSteps {

    private final WebDriver driver = DriverFactory.getDriver();
    private final LoginPage loginPage = new LoginPage(driver);
    private final InventoryPage inventoryPage = new InventoryPage(driver);

    // TODO: Given the shopper is on the login page

    // TODO: When the shopper logs in with "standard_user" and "secret_sauce"
    public void login() {
        driver.findElement(By.id("user-name")).sendKeys("standard_user");
        driver.findElement(By.id("password")).sendKeys("secret_sauce");
        driver.findElement(By.id("login-button")).click();
    }

    // TODO: And the shopper adds 2 products to the cart

    // TODO: Then the cart badge shows 2
}
`,
  solution: `package com.shopeasy.steps;

import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import com.shopeasy.support.DriverFactory;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;

public class LoginSteps {

    private final WebDriver driver = DriverFactory.getDriver();
    private final LoginPage loginPage = new LoginPage(driver);
    private final InventoryPage inventoryPage = new InventoryPage(driver);

    @Given("the shopper is on the login page")
    public void theShopperIsOnTheLoginPage() {
        loginPage.open();
    }

    @When("the shopper logs in with {string} and {string}")
    public void theShopperLogsInWith(String username, String password) {
        loginPage.loginAs(username, password);
    }

    @When("the shopper adds {int} products to the cart")
    public void theShopperAddsProducts(int count) {
        inventoryPage.addFirstProductsToCart(count);
    }

    @Then("the cart badge shows {int}")
    public void theCartBadgeShows(int expected) {
        Assert.assertEquals(inventoryPage.getCartBadgeCount(), expected,
                "Cart badge count after adding products");
    }
}
`,
  checks: [
    { label: 'Imports Cucumber annotations', pattern: 'import\\s+io\\.cucumber\\.java\\.en\\.(\\*|Given|When|Then)', hint: 'import io.cucumber.java.en.Given; (When, Then)' },
    { label: 'Login step uses {string} twice', pattern: '@(When|Given|And)\\(\\s*"[^"]*\\{string\\}[^"]*\\{string\\}[^"]*"\\s*\\)', hint: '@When("the shopper logs in with {string} and {string}")' },
    { label: 'Count uses {int}', pattern: '\\{int\\}', hint: '"the shopper adds {int} products to the cart"' },
    { label: 'Method parameters receive the values', pattern: '\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'public void login(String username, String password)' },
    { label: 'No findElement in step definitions', pattern: 'findElement', mustNot: true, hint: 'Call loginPage.loginAs(...) — locators belong in page objects.' },
    { label: 'Then step asserts', pattern: '(Assert\\.assert\\w+|assertThat|assertEquals)\\s*\\(', hint: 'Assert.assertEquals(actual, expected)' },
  ],
  hints: [
    'Run once with the steps undefined: Cucumber prints ready-made snippets with {string} and {int} you can paste.',
    'The method parameter order matches the order of {string} placeholders in the expression.',
    'A Then step without an assertion always passes — that is a false positive.',
  ],
  explanation: `Cucumber expressions are the modern, readable alternative to regex: \`{string}\` matches text in double (or single) quotes and passes it
**without** the quotes; \`{int}\` matches a whole number and converts it to \`int\`. Others: \`{float}\`, \`{double}\`, \`{word}\`, \`{}\` (anything).

Step definitions are the thin glue layer: translate the business sentence into page-object calls. If you see \`findElement\` or
\`By.id\` in a step class, the abstraction is leaking — the next UI change will hit both layers. The Then is the only place with assertions.

*Note:* creating the driver in a field works for a first run; in cuc-012 you will replace this with PicoContainer injection.`,
  mistakes: [
    'Hard-coding data in the annotation: @When("the shopper logs in with \\"standard_user\\"") — needs a new method per user.',
    'Including the quotes in the expression: "logs in with \\"{string}\\"" — {string} already consumes the quotes.',
    'Using {int} for a value like 9.99 — use {double} or {bigdecimal}.',
    'Forgetting the assertion in the Then step.',
  ],
  interview: [
    { q: 'Cucumber expressions vs regular expressions?', a: 'Cucumber expressions are simpler ({string}, {int}, optional text with (s), alternatives with /) and convert types automatically. Regex is still supported when you need exact patterns, using ^...$ anchors.' },
    { q: 'How does Cucumber find step definitions?', a: 'It scans the packages listed in glue for methods annotated with @Given/@When/@Then etc. and matches the step text against each expression. Exactly one must match.' },
    { q: 'What belongs in a step definition?', a: 'Translating parameters and calling page objects or API clients, plus assertions in Then steps. No locators, no waits, no business logic.' },
  ],
}
