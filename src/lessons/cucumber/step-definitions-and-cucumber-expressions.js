export default {
  slug: 'step-definitions-and-cucumber-expressions',
  category: 'cucumber',
  order: 4,
  title: 'Step definitions and Cucumber expressions',
  minutes: 9,
  summary: 'Connect Gherkin lines to Java methods with @Given/@When/@Then and {string}/{int} parameters, and fix undefined, ambiguous and pending steps.',
  manualAnalogy: `When you read a test step like "Remove Pulse Bike Light from the cart", your brain knows which buttons to press.
A step definition is that knowledge written down in Java: "whenever you see a step that looks like *this*, do
*that*". The quoted data in the step is handed to the method, like test data handed to a tester.`,
  body: `## What a step definition is

A **step definition** is a Java method with an annotation whose text matches a Gherkin step. Cucumber reads a step,
searches all step definitions in the **glue** packages (the packages listed in the runner), and calls the one that
matches.

\`\`\`java
package com.shopeasy.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;
import org.testng.Assert;

public class CartSteps {

    private final CartPage cartPage;   // a page object (see the Page Object Model lessons)

    public CartSteps(TestContext context) {
        this.cartPage = new CartPage(context.getDriver());
    }

    @When("the shopper removes {string} from the cart")
    public void removesFromCart(String productName) {
        cartPage.remove(productName);
    }

    @Then("the cart contains {int} item(s)")
    public void cartContains(int expected) {
        Assert.assertEquals(cartPage.itemCount(), expected, "Items in cart");
    }
}
\`\`\`

Line by line:

- \`import io.cucumber.java.en.When\` - the annotations come from Cucumber's \`io.cucumber.java.en\` package. Do not
  import JUnit or TestNG annotations by mistake.
- \`@When("the shopper removes {string} from the cart")\` - the text is a **Cucumber expression**. It matches
  \`When the shopper removes "Pulse Bike Light" from the cart\`.
- \`{string}\` matches text **in double quotes** and passes it, *without* the quotes, as a \`String\` parameter.
- \`{int}\` matches a whole number and passes it as an \`int\`. The parameters arrive in the same order as they
  appear in the step.
- \`item(s)\` - brackets mark **optional text**, so the step matches both "1 item" and "3 items".
- The constructor receiving \`TestContext\` is explained in the *Sharing state with PicoContainer* lesson.

## The most useful parameter types

| Expression | Matches | Java type |
|---|---|---|
| \`{string}\` | \`"any text"\` or \`'any text'\` | String |
| \`{int}\` | \`42\`, \`-1\` | int / Integer |
| \`{double}\` | \`29.99\` | double |
| \`{word}\` | one word without spaces | String |
| \`{}\` | anything (anonymous) | String or converted type |

Other expression features: \`a/an\` matches either word (alternative text), and \`(s)\` is optional text.

## Thin steps, fat page objects

A step method should read like the Gherkin line: one or two calls into page objects, and an assertion **only in Then
steps**. No \`driver.findElement\`, no locators, no waits in the step class. Page objects do the browser work; step
definitions translate language into calls. If you ever need to change a locator, you change it in one page class.

## Let Cucumber write the skeleton

Run a feature that has no step definitions yet (or use \`dryRun = true\` in the runner - it checks every step has a
match **without opening a browser**). Cucumber prints ready-to-paste snippets:

\`\`\`text
The step 'the shopper removes "Junior Onesie" from the cart' is undefined.
You can implement this step using the snippet(s) below:
@When("the shopper removes {string} from the cart")
public void the_shopper_removes_from_the_cart(String string) {
    throw new io.cucumber.java.PendingException();
}
\`\`\`

Copy it, rename the method and parameter to something meaningful, and replace the body.

## The three classic errors

**Undefined step** - Cucumber found no matching method. Causes, from most to least common:

1. The class is in a package that is **not in \`glue\`**. Glue lists *packages*; every package with steps or hooks
   must be included (a parent package covers its sub-packages).
2. The text differs slightly: a missing word, singular vs plural, different quotes, a trailing space.
3. Wrong import (a JUnit/TestNG annotation instead of Cucumber's).

**Ambiguous step** - **two or more** methods match the same line, for example one written with \`{string}\` and
another with the anonymous \`{}\`. Cucumber refuses to guess and fails the scenario. Fix: delete the duplicate or make
the expressions more specific.

**Pending step** - the method exists but throws \`PendingException\` (the snippet's default body). The scenario is
reported as pending/not finished rather than passed, and the remaining steps are skipped.

## Debugging checklist

1. Copy the exact step text from the error and compare it character by character with the annotation.
2. Check the step class's package is listed in \`glue\`.
3. Check the imports at the top of the step class.
4. Run with \`dryRun = true\` to list every undefined step across all feature files in seconds.`,
  keyPoints: [
    'Annotations come from io.cucumber.java.en; the text is a Cucumber expression matched against the step.',
    '{string} captures quoted text (quotes removed), {int} a whole number; parameters arrive in order.',
    '(s) makes text optional and a/b offers alternatives, so one definition can match small wording variations.',
    'Step methods stay thin: call page objects, assert only in Then, no findElement.',
    'Undefined = no match (often glue/package or wording); ambiguous = more than one match; pending = PendingException.',
    'dryRun = true finds undefined steps without starting a browser.',
  ],
  mistakes: [
    'Hard-coding data in the annotation ("logs in as standard_user"). Fix: use {string} and a method parameter.',
    'Forgetting to add the steps package to glue. Fix: list every package that holds steps or hooks.',
    'Writing the same step twice in different classes. Fix: one definition per step text; search before adding.',
    'Calling driver.findElement inside steps. Fix: move element work into a page object method.',
  ],
  tryIt: `Write (on paper) the annotation for: Then the order confirmation says "Thank you for your order!" - which
parameter type do you need, and what value will the method receive?`,
  problems: ['cuc-006', 'cuc-015', 'cuc-017'],
}
