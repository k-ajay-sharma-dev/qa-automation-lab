export default {
  id: 'dbg-011',
  category: 'debugging',
  kind: 'code',
  title: 'AmbiguousStepDefinitionsException: two teams wrote the same step',
  level: 'INTERMEDIATE',
  tags: ['cucumber', 'ambiguous-step', 'step-reuse', 'refactoring'],
  estMinutes: 20,
  scenario: `Two QA engineers worked in parallel: one automated the ShopEasy **login** feature, the other the **seller registration form** (form.html) feature. Both PRs were merged on Friday. On Monday, **every** login scenario and every form scenario fails before the browser even does anything. Nobody touched the other's files — so who broke it?`,
  description: `Console output:

\`\`\`text
io.cucumber.core.runner.AmbiguousStepDefinitionsException: "I enter "standard_user" in the username field" matches more than one step definition:
  "I enter {string} in the username field" in com.shopeasy.stepdefs.LoginSteps.iEnterUsername(java.lang.String)
  "^I enter \\"([^\\"]*)\\" in the (.*) field$" in com.shopeasy.stepdefs.FormSteps.iEnterInField(java.lang.String,java.lang.String)
	at io.cucumber.core.runner.CachingGlue.stepDefinitionMatch(CachingGlue.java:381)
	at io.cucumber.core.runner.PickleStepDefinitionMatch...
	at ✽.I enter "standard_user" in the username field(file:///.../features/login.feature:7)

12 Scenarios (12 failed)
\`\`\`

Feature files use steps like:
\`\`\`gherkin
When I enter "standard_user" in the username field
When I enter "secret_sauce" in the password field
When I enter "Jane" in the firstName field
When I enter "jane@mail.com" in the email field
\`\`\`

**Fix:** keep **exactly one** step definition for "I enter … in the … field":
- Replace both with a single generic step in \`CommonSteps\` using a Cucumber expression: \`I enter {string} in the {word} field\`.
- Map the field name to a locator (a \`Map<String, By>\` or a \`switch\`), and fail clearly for an unknown field.
- Delete the old \`LoginSteps.iEnterUsername\` and \`FormSteps.iEnterInField\` definitions.`,
  hints: [
    'Cucumber needs every step text to match exactly ONE definition across all glue packages.',
    'The greedy regex (.*) in FormSteps also matches "username" — that is what created the clash.',
    '@When("I enter {string} in the {word} field") + Map<String, By> FIELDS = Map.of("username", By.id("user-name"), ...)',
  ],
  language: 'java',
  starterCode: String.raw`// ===== LoginSteps.java =====
package com.shopeasy.stepdefs;

import io.cucumber.java.en.When;

public class LoginSteps {

    @When("I enter {string} in the username field")
    public void iEnterUsername(String username) {
        loginPage().enterUsername(username);
    }
}

// ===== FormSteps.java =====
package com.shopeasy.stepdefs;

import io.cucumber.java.en.When;
import org.openqa.selenium.By;

public class FormSteps {

    @When("^I enter \"([^\"]*)\" in the (.*) field$")
    public void iEnterInField(String value, String field) {
        driver().findElement(By.id(field)).sendKeys(value);
    }
}
`,
  solution: String.raw`// ===== CommonSteps.java =====
package com.shopeasy.stepdefs;

import io.cucumber.java.en.When;
import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class CommonSteps {

    private static final Map<String, By> FIELDS = Map.of(
            "username", By.id("user-name"),
            "password", By.id("password"),
            "firstName", By.id("firstName"),
            "lastName", By.id("lastName"),
            "email", By.id("email")
    );

    @When("I enter {string} in the {word} field")
    public void iEnterInTheField(String value, String field) {
        By locator = FIELDS.get(field);
        if (locator == null) {
            throw new IllegalArgumentException("Unknown field '" + field + "'. Known fields: " + FIELDS.keySet());
        }
        WebElement input = waitFor().until(ExpectedConditions.visibilityOfElementLocated(locator));
        input.clear();
        input.sendKeys(value);
    }
}

// ===== LoginSteps.java / FormSteps.java =====
// The duplicate "I enter ..." definitions were deleted from both classes.
`,
  checks: [
    { label: 'Exactly one "I enter … field" step definition', pattern: '@When\\s*\\(\\s*"\\^?I enter[\\s\\S]*@When\\s*\\(\\s*"\\^?I enter', flags: 'ms', mustNot: true, hint: 'Delete the duplicate — keep one generic step' },
    { label: 'Uses a Cucumber expression with parameters', pattern: '@When\\s*\\(\\s*"I enter \\{string\\} in the \\{(word|string)\\} field"', hint: '@When("I enter {string} in the {word} field")' },
    { label: 'No greedy regex step', pattern: '"\\^I enter', mustNot: true, hint: 'Remove the ^...(.*)...$ regex definition' },
    { label: 'Maps field names to locators', pattern: '(Map\\s*<\\s*String\\s*,\\s*By\\s*>|switch\\s*\\(\\s*\\w+\\s*\\))', hint: 'Map<String, By> FIELDS = Map.of(...)' },
  ],
  explanation: `**Who broke it?** Neither file on its own — the *combination*. Cucumber loads every step definition from every glue package into one pool. The form engineer's regex \`^I enter "([^"]*)" in the (.*) field$\` is so generic that \`(.*)\` also matches "username", so the login step now has two matches and Cucumber refuses to guess → \`AmbiguousStepDefinitionsException\` for every scenario using it.

**How to fix it properly:**
- One step, one definition, in a shared \`CommonSteps\` class — reusable steps are the whole point of BDD.
- Use Cucumber expressions (\`{string}\`, \`{word}\`, \`{int}\`) instead of greedy regex.
- Translate business names to locators in one place and fail with a helpful message for unknown fields.

**Team process lesson** (good interview material): run \`dryRun = true\` in the PR pipeline — it catches undefined *and* ambiguous steps in seconds before merge. Agree on a step library (a "step glossary") so people search before writing new steps.`,
  mistakes: [
    'Renaming one step to "I type ... " and editing every feature file instead of consolidating.',
    'Using (.*) in regex steps — it matches far more than intended.',
    'Using By.id(field) directly from the feature text, which couples Gherkin to HTML ids.',
    'Splitting steps per page with nearly identical wording, creating future clashes.',
  ],
  interview: [
    { q: 'What is an ambiguous step in Cucumber and how do you prevent it?', a: 'It is when one Gherkin step matches more than one step definition, so Cucumber cannot decide and fails the scenario. In my project it happened when a generic regex step clashed with a specific login step. We consolidated into a single reusable step using Cucumber expressions, keep shared steps in a CommonSteps class, and run a dryRun in the PR build to catch undefined or ambiguous steps early.' },
    { q: 'Cucumber expressions vs regular expressions?', a: 'Cucumber expressions like {string} and {int} are simpler to read and convert types automatically; regular expressions are more powerful but easy to make too greedy. We default to Cucumber expressions and only use regex for special cases like optional words.' },
  ],
}
