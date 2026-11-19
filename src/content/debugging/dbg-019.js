export default {
  id: 'dbg-019',
  category: 'debugging',
  kind: 'code',
  title: 'UndefinedDataTableTypeException: Cucumber can\'t turn the table into objects',
  level: 'BEGINNER',
  tags: ['cucumber', 'datatable', 'DataTableType', 'conversion'],
  estMinutes: 15,
  scenario: `The BA added a data table to the ShopEasy checkout feature so the business can see the prices being tested. You changed the step method to take a nice \`List<CartLine>\` instead of raw strings — and now the scenario fails before the browser does anything. The step text matches, the glue is right, the step is not "undefined". So what is Cucumber complaining about?`,
  description: `The feature (do **not** change it):

\`\`\`gherkin
Scenario: Item total for two products
  Given I am logged in as "standard_user"
  When I add these products to the cart:
    | product              | price  |
    | Trailblazer Backpack | $29.99 |
    | Pulse Bike Light     | $9.99  |
  Then the item total on the overview should be "$39.98"
\`\`\`

Console:

\`\`\`text
io.cucumber.core.exception.CucumberException: Could not convert arguments for step [I add these products to the cart:] defined at 'com.shopeasy.stepdefs.CartSteps.iAddTheseProducts(java.util.List<com.shopeasy.model.CartLine>)'.
The details are in the stacktrace below.
	at io.cucumber.core.runner.PickleStepDefinitionMatch.couldNotConvertArguments(PickleStepDefinitionMatch.java:112)
	at io.cucumber.core.runner.PickleStepDefinitionMatch.runStep(PickleStepDefinitionMatch.java:56)
	at ✽.I add these products to the cart:(file:///var/lib/jenkins/workspace/shopeasy-bdd/src/test/resources/features/checkout.feature:5)
Caused by: io.cucumber.datatable.UndefinedDataTableTypeException: Can't convert DataTable to List<com.shopeasy.model.CartLine>.
Please review these problems:

 - There was no table entry or table row transformer registered for com.shopeasy.model.CartLine.
   Please consider registering a table entry or row transformer.

 - There was no default table entry transformer registered to transform com.shopeasy.model.CartLine.
   Please consider registering a default table entry transformer.

Note: Usually solving one is enough
\`\`\`

**Diagnose:** the step matched (otherwise it would be *undefined*). Cucumber then had to convert the table argument into \`List<CartLine>\` and has no idea how to build a \`CartLine\` from a row.

**Fix:** register a **table entry transformer** with \`@DataTableType\` in a glue class:
- Method takes one row as \`Map<String, String>\` (header → cell) and returns a \`CartLine\`.
- Read the \`product\` and \`price\` columns; turn \`"$29.99"\` into a \`BigDecimal\`.
- Keep the step signature \`List<CartLine>\`.`,
  hints: [
    '"Could not convert arguments" = the step matched; only the parameter conversion failed. Read the Caused by.',
    'A table "entry" is one data row as a Map keyed by the header row: {product=Trailblazer Backpack, price=$29.99}.',
    '@DataTableType public CartLine cartLine(Map<String, String> row) { return new CartLine(row.get("product"), ...); }',
  ],
  language: 'java',
  starterCode: String.raw`// ===== src/test/java/com/shopeasy/model/CartLine.java =====
package com.shopeasy.model;

import java.math.BigDecimal;

public record CartLine(String product, BigDecimal price) {
}

// ===== src/test/java/com/shopeasy/stepdefs/CartSteps.java =====
package com.shopeasy.stepdefs;

import com.shopeasy.model.CartLine;
import io.cucumber.java.en.When;
import java.util.List;

public class CartSteps {

    @When("I add these products to the cart:")
    public void iAddTheseProducts(List<CartLine> lines) {
        for (CartLine line : lines) {
            inventoryPage().addToCart(line.product());
            expectedTotal().add(line.price());
        }
    }
}
`,
  solution: String.raw`// ===== src/test/java/com/shopeasy/model/CartLine.java =====
package com.shopeasy.model;

import java.math.BigDecimal;

public record CartLine(String product, BigDecimal price) {
}

// ===== src/test/java/com/shopeasy/stepdefs/DataTableTypes.java =====
package com.shopeasy.stepdefs;

import com.shopeasy.model.CartLine;
import io.cucumber.java.DataTableType;
import java.math.BigDecimal;
import java.util.Map;

public class DataTableTypes {

    /** One table row {product=..., price=$29.99} -> CartLine. Lives in the glue package. */
    @DataTableType
    public CartLine cartLine(Map<String, String> row) {
        String price = row.get("price").replaceAll("[^0-9.]", "");
        return new CartLine(row.get("product").trim(), new BigDecimal(price));
    }
}

// ===== src/test/java/com/shopeasy/stepdefs/CartSteps.java =====
package com.shopeasy.stepdefs;

import com.shopeasy.model.CartLine;
import io.cucumber.java.en.When;
import java.util.List;

public class CartSteps {

    @When("I add these products to the cart:")
    public void iAddTheseProducts(List<CartLine> lines) {
        for (CartLine line : lines) {
            inventoryPage().addToCart(line.product());
            expectedTotal().add(line.price());
        }
    }
}
`,
  checks: [
    { label: 'Registers a @DataTableType transformer', pattern: '@DataTableType', hint: 'Annotate a method with @DataTableType (io.cucumber.java.DataTableType)' },
    { label: 'Transformer takes one row as Map<String, String>', pattern: '@DataTableType[\\s\\S]*?\\(\\s*Map\\s*<\\s*String\\s*,\\s*String\\s*>\\s*\\w+\\s*\\)', flags: 'ms', hint: 'public CartLine cartLine(Map<String, String> row)' },
    { label: 'Reads the product and price columns by header name', pattern: 'get\\s*\\(\\s*"(product|price)"\\s*\\)[\\s\\S]*get\\s*\\(\\s*"(product|price)"\\s*\\)', flags: 'ms', hint: 'row.get("product"), row.get("price")' },
    { label: 'Converts the price to BigDecimal', pattern: 'new\\s+BigDecimal\\s*\\(', hint: 'Strip the $ and use new BigDecimal(...)' },
    { label: 'Step still receives List<CartLine>', pattern: '@When\\s*\\(\\s*"I add these products to the cart:"\\s*\\)\\s*public\\s+void\\s+\\w+\\s*\\(\\s*List\\s*<\\s*CartLine\\s*>', hint: 'Keep the typed parameter — the transformer makes it work' },
  ],
  explanation: `**Two different Cucumber failures that beginners mix up:**
| Message | Meaning |
|---|---|
| *Undefined step* + snippet | No step definition matched the text |
| *Could not convert arguments for step …* | A definition **matched**, but a parameter couldn't be converted |

Here the \`Caused by: UndefinedDataTableTypeException\` says it plainly: Cucumber knows how to give you a \`DataTable\`, \`List<String>\`, \`List<Map<String, String>>\` or \`List<List<String>>\` out of the box, but **not** your own \`CartLine\` class.

**How the fix works:** \`@DataTableType\` registers a *table entry transformer*. For \`List<CartLine>\`, Cucumber uses the first table row as the header, turns each following row into a \`Map\` (\`{product=Trailblazer Backpack, price=$29.99}\`), calls your method once per row and hands the step a ready-made \`List<CartLine>\`. The method must live in a class inside the **glue** packages, just like hooks.

**Why keep the typed list instead of \`List<Map<String, String>>\`?** The step body reads like the business table (\`line.product()\`, \`line.price()\`), the price parsing lives in one place, and the next table with products reuses the same transformer.

**Related errors you'll meet:**
- A typo in a header (\`| Product |\` vs \`row.get("product")\`) → \`row.get\` returns \`null\` → \`NullPointerException\` in your transformer. Header names are case-sensitive.
- \`NumberFormatException: Character $ is neither a decimal digit…\` → you forgot to strip the currency symbol before \`new BigDecimal\`.
- \`DuplicateTypeException\` → two \`@DataTableType\` methods for the same class in the glue.`,
  mistakes: [
    'Editing the feature file to remove the table because "Cucumber can\'t read it".',
    'Changing the step to take a raw DataTable and parsing cells by index (row.get(1)) everywhere.',
    'Putting the @DataTableType method in a package that is not in the runner\'s glue.',
    'Parsing "$29.99" with Double.parseDouble — it throws, and double is wrong for money anyway.',
  ],
  interview: [
    { q: 'How do you convert a Cucumber DataTable into objects?', a: 'Either take List<Map<String, String>> and map it yourself, or register a @DataTableType method that turns one row Map into a domain object so the step can take List<CartLine> directly. I prefer the transformer because the conversion lives in one place and steps stay readable.' },
    { q: 'What does "Could not convert arguments for step" mean?', a: 'The step text matched a definition, but Cucumber could not convert one of the arguments — usually a DataTable to a custom type without a registered transformer, or a parameter type mismatch. The Caused by section says which type and what to register.' },
  ],
}
