export default {
  id: 'dbg-010',
  category: 'debugging',
  kind: 'code',
  title: 'Cucumber says "Undefined step" — but the step definition exists',
  level: 'BEGINNER',
  tags: ['cucumber', 'undefined-step', 'glue', 'cucumber-expressions'],
  estMinutes: 15,
  scenario: `You wrote your first Cucumber scenario for the ShopEasy cart and the matching step definitions. The run fails, but not with an assertion — the report shows the scenario as *undefined*, and nothing happened in the browser. Your teammate shrugs: "but the step methods are right there". The BA wrote the feature file; you are not allowed to change its wording because it was reviewed with the product owner.`,
  description: `The feature file (do **not** change it):

\`\`\`gherkin
Feature: Cart
  Scenario: Add a product to the cart
    Given I am logged in as "standard_user"
    When I add "Trailblazer Backpack" to the cart
    Then the cart badge should show 1
\`\`\`

Console output:

\`\`\`text
Scenario: Add a product to the cart              # features/cart.feature:2
  Given I am logged in as "standard_user"
  When I add "Trailblazer Backpack" to the cart
  Then the cart badge should show 1

Undefined scenarios:
file:///var/lib/jenkins/workspace/shopeasy-bdd/src/test/resources/features/cart.feature:2 # Add a product to the cart

1 Scenarios (1 undefined)
3 Steps (2 skipped, 1 undefined)
0m0.412s

You can implement missing steps with the snippets below:

@Given("I am logged in as {string}")
public void i_am_logged_in_as(String string) {
    // Write code here that turns the phrase above into concrete actions
    throw new io.cucumber.java.PendingException();
}
...
\`\`\`

**Two separate problems — fix both:**
1. The runner's \`glue\` points to \`com.shopeasy.steps\`, but the step classes live in package \`com.shopeasy.stepdefs\` → Cucumber can't see *any* step (that's why even the login step is undefined).
2. Two step texts don't match the feature: \`"I add {string} to cart"\` (missing "the") and \`"the cart badge shows {int}"\` (feature says "should show").`,
  hints: [
    'If EVERY step is undefined, suspect glue/package first. If only some are, suspect text mismatches.',
    'Cucumber expressions must match the step text exactly apart from the {parameters}.',
    'glue = "com.shopeasy.stepdefs"; @When("I add {string} to the cart"); @Then("the cart badge should show {int}")',
  ],
  language: 'java',
  starterCode: String.raw`// ===== src/test/java/com/shopeasy/runners/TestRunner.java =====
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy.steps",
        plugin = {"pretty", "html:target/cucumber-report.html"}
)
public class TestRunner extends AbstractTestNGCucumberTests {
}

// ===== src/test/java/com/shopeasy/stepdefs/CartSteps.java =====
package com.shopeasy.stepdefs;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class CartSteps {

    @Given("I am logged in as {string}")
    public void iAmLoggedInAs(String user) {
        loginPage().loginAs(user, "secret_sauce");
    }

    @When("I add {string} to cart")
    public void iAddToCart(String product) {
        inventoryPage().addToCart(product);
    }

    @Then("the cart badge shows {int}")
    public void theCartBadgeShows(int expected) {
        Assert.assertEquals(inventoryPage().getCartCount(), expected);
    }
}
`,
  solution: String.raw`// ===== src/test/java/com/shopeasy/runners/TestRunner.java =====
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = {"com.shopeasy.stepdefs", "com.shopeasy.hooks"},
        plugin = {"pretty", "html:target/cucumber-report.html"},
        monochrome = true
)
public class TestRunner extends AbstractTestNGCucumberTests {
}

// ===== src/test/java/com/shopeasy/stepdefs/CartSteps.java =====
package com.shopeasy.stepdefs;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class CartSteps {

    @Given("I am logged in as {string}")
    public void iAmLoggedInAs(String user) {
        loginPage().loginAs(user, "secret_sauce");
    }

    @When("I add {string} to the cart")
    public void iAddToTheCart(String product) {
        inventoryPage().addToCart(product);
    }

    @Then("the cart badge should show {int}")
    public void theCartBadgeShouldShow(int expected) {
        Assert.assertEquals(inventoryPage().getCartCount(), expected, "Cart badge count");
    }
}
`,
  checks: [
    { label: 'Glue points at the step-definition package', pattern: 'glue\\s*=\\s*\\{?\\s*"com\\.shopeasy\\.stepdefs"', hint: 'glue = "com.shopeasy.stepdefs"' },
    { label: '"When" step text matches the feature exactly', pattern: '@When\\s*\\(\\s*"I add \\{string\\} to the cart"\\s*\\)', hint: '@When("I add {string} to the cart")' },
    { label: '"Then" step text matches the feature exactly', pattern: '@Then\\s*\\(\\s*"the cart badge should show \\{int\\}"\\s*\\)', hint: '@Then("the cart badge should show {int}")' },
    { label: 'Old mismatched texts are gone', pattern: '"(I add \\{string\\} to cart|the cart badge shows \\{int\\})"', mustNot: true, hint: 'Remove the old step texts' },
  ],
  explanation: `**Read the summary line, not just "FAILED":** \`1 Scenarios (1 undefined)\` and \`3 Steps (2 skipped, 1 undefined)\` mean Cucumber never matched a step to code — it is a wiring problem, not an application failure. Cucumber 7 is strict by default, so the TestNG result shows \`io.cucumber.testng.UndefinedStepException\` (older versions with \`strict = false\` even reported it green — a pipeline testing nothing).

**Triage rule:**
- *All* steps undefined → Cucumber can't find your step classes: wrong \`glue\` package, step classes under \`src/main\` instead of \`src/test\`, or a typo in the package.
- *Some* steps undefined → text mismatch between the feature and the expression (missing word, extra space, plural, quote style), or wrong parameter type (\`{int}\` vs \`{string}\`).

**Pro tip:** copy the snippet Cucumber prints — it's generated from the *exact* step text. Use \`dryRun = true\` in the runner to check all steps are glued without opening a browser; it takes seconds and is a great pre-commit check.

Also note glue can list several packages (\`{"com.shopeasy.stepdefs", "com.shopeasy.hooks"}\`) — forgetting the hooks package is the next classic: steps run but the browser never opens (NPE in the first step).`,
  mistakes: [
    'Editing the feature file to match the code instead of matching the agreed business wording.',
    'Ignoring "undefined" because the pipeline showed no failures.',
    'Forgetting to add the hooks package to glue, so @Before never creates the driver.',
    'Using regex anchors (^...$) mixed with Cucumber expressions and getting confused about which syntax is active.',
  ],
  interview: [
    { q: 'What do you do when Cucumber reports undefined steps?', a: 'I check the summary: if every step is undefined, the glue path or package is wrong; if only some are, the step text does not match the expression. I use the snippet Cucumber prints and run with dryRun = true to quickly validate that every step has a definition without launching the browser.' },
    { q: 'What is the glue option?', a: 'It tells Cucumber which packages to scan for step definitions and hooks. In our runner glue lists the stepdefs and hooks packages; the features option points to the feature files folder.' },
  ],
}
