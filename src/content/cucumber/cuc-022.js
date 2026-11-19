export default {
  id: 'cuc-022',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'A custom @ParameterType for the sort options',
  level: 'INTERMEDIATE',
  tags: ['parameter-type', 'cucumber-expressions', 'enum', 'sorting'],
  estMinutes: 25,
  scenario: `The sorting feature on \`inventory.html\` has four options. The current step definition takes a \`String\` and runs an
if/else chain to turn "price low to high" into the dropdown value \`lohi\`. Yesterday a BA wrote "price low-to-high", the chain fell through to
the \`else\` branch, the test silently sorted A to Z — and **passed**, because the first product happened to match. The lead wants the
sort option to be a real type that Cucumber converts and validates for you.`,
  description: `Feature file (do not change it):

\`\`\`gherkin
Scenario Outline: Sorting by <sort> shows "<first>" first
  Given the shopper is logged in as "standard_user"
  When the shopper sorts the products by <sort>
  Then the first product shown is "<first>"

  Examples:
    | sort              | first                |
    | name A to Z       | Classic Crew T-Shirt |
    | name Z to A       | Trailblazer Backpack |
    | price low to high | Junior Onesie        |
    | price high to low | Storm Fleece Jacket  |
\`\`\`

The dropdown \`#product-sort\` has the option values \`az\`, \`za\`, \`lohi\`, \`hilo\`.

**Rules**
- A \`SortOption\` enum knows its Gherkin label and its dropdown value.
- A method annotated with \`@ParameterType\` (from \`io.cucumber.java\`) whose regex lists the four labels converts the text into a \`SortOption\`.
- The step expression uses the new type: \`{sortOption}\` — and the step method receives a \`SortOption\`, not a \`String\`.
- No if/else or switch on the label text in the step class.`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.When;

public class SortSteps {

    private final InventoryPage inventoryPage;

    public SortSteps(TestContext context) {
        this.inventoryPage = new InventoryPage(context.getDriver());
    }

    @When("the shopper sorts the products by {}")
    public void sortsBy(String sort) {
        if (sort.equals("name Z to A")) {
            inventoryPage.sortBy("za");
        } else if (sort.equals("price low to high")) {
            inventoryPage.sortBy("lohi");
        } else if (sort.equals("price high to low")) {
            inventoryPage.sortBy("hilo");
        } else {
            inventoryPage.sortBy("az");   // typo in the feature file? silently A to Z...
        }
    }
}
`,
  solution: `// ----- com/shopeasy/model/SortOption.java -----
package com.shopeasy.model;

import java.util.Arrays;

public enum SortOption {
    NAME_A_TO_Z("name A to Z", "az"),
    NAME_Z_TO_A("name Z to A", "za"),
    PRICE_LOW_TO_HIGH("price low to high", "lohi"),
    PRICE_HIGH_TO_LOW("price high to low", "hilo");

    private final String label;
    private final String dropdownValue;

    SortOption(String label, String dropdownValue) {
        this.label = label;
        this.dropdownValue = dropdownValue;
    }

    public String dropdownValue() {
        return dropdownValue;
    }

    public static SortOption fromLabel(String label) {
        return Arrays.stream(values())
                .filter(option -> option.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown sort option: " + label));
    }
}

// ----- com/shopeasy/support/ParameterTypes.java -----
package com.shopeasy.support;

import com.shopeasy.model.SortOption;
import io.cucumber.java.ParameterType;

public class ParameterTypes {

    @ParameterType("name A to Z|name Z to A|price low to high|price high to low")
    public SortOption sortOption(String label) {
        return SortOption.fromLabel(label);
    }
}

// ----- com/shopeasy/steps/SortSteps.java -----
package com.shopeasy.steps;

import com.shopeasy.model.SortOption;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class SortSteps {

    private final InventoryPage inventoryPage;

    public SortSteps(TestContext context) {
        this.inventoryPage = new InventoryPage(context.getDriver());
    }

    @When("the shopper sorts the products by {sortOption}")
    public void sortsBy(SortOption option) {
        inventoryPage.sortBy(option.dropdownValue());
    }

    @Then("the first product shown is {string}")
    public void firstProductIs(String expected) {
        Assert.assertEquals(inventoryPage.getProductNames().get(0), expected, "First product after sorting");
    }
}
`,
  checks: [
    { label: 'Imports io.cucumber.java.ParameterType', pattern: 'import\\s+io\\.cucumber\\.java\\.(ParameterType|\\*)\\s*;', hint: 'import io.cucumber.java.ParameterType;' },
    { label: '@ParameterType lists the labels as regex alternatives', pattern: '@ParameterType\\s*\\(\\s*(value\\s*=\\s*)?"[^"]*\\|[^"]*"', hint: '@ParameterType("name A to Z|name Z to A|price low to high|price high to low")' },
    { label: 'Converter returns a SortOption', pattern: 'public\\s+SortOption\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'public SortOption sortOption(String label)' },
    { label: 'Step expression uses {sortOption}', pattern: '@When\\(\\s*"[^"]*\\{sortOption\\}[^"]*"\\s*\\)', hint: '@When("the shopper sorts the products by {sortOption}")' },
    { label: 'Step method receives a SortOption', pattern: 'public\\s+void\\s+\\w+\\s*\\(\\s*SortOption\\s+\\w+\\s*\\)', hint: 'public void sortsBy(SortOption option)' },
    { label: 'No if/else on label text', pattern: '\\.equals\\s*\\(\\s*"(name|price)', flags: 'mi', mustNot: true, hint: 'The enum + parameter type replace the if/else chain.' },
  ],
  hints: [
    'The parameter type name defaults to the method name: a method called sortOption becomes {sortOption}. Or set name = "sortOption" explicitly.',
    'The regex in @ParameterType decides what text matches. A label that is not in the list (e.g. "price low-to-high") makes the step undefined — a loud failure instead of a silent wrong sort.',
    'Keep the label → value mapping inside the enum; the converter just calls SortOption.fromLabel(label).',
  ],
  explanation: `\`@ParameterType\` registers a new \`{name}\` for Cucumber expressions: a **regex** saying which text matches, and a **method** that turns the
matched text into an object. Cucumber calls it before your step, so the step method works with a typed \`SortOption\`.

What you gain over \`String\` + if/else:
- **Fail fast** — an unknown label does not match the regex, so the step is reported as *undefined* instead of silently sorting A to Z.
- **One mapping** — every step that mentions a sort option (\`sorts by\`, \`the sort dropdown shows\`…) reuses \`{sortOption}\`.
- **Readable steps** — no quotes needed, because the regex defines the boundaries of the value.

Placement: like \`@DataTableType\`, the class must be in a \`glue\` package. Placeholders from an outline (\`<sort>\`) are substituted first,
so parameter types work in Scenario Outlines too. For a plain enum whose constant names appear in the text (\`PRICE_LOW_TO_HIGH\`),
Cucumber can convert with the anonymous \`{}\` — but business-friendly labels need a custom type.`,
  mistakes: [
    'Naming the method differently from the {placeholder} (method sort(), expression {sortOption}) → "Undefined parameter type {sortOption}".',
    'Using a catch-all regex like ".*" — it swallows the rest of the sentence and can make other steps ambiguous.',
    'Putting the ParameterTypes class outside the glue packages, so the type is never registered.',
    'Keeping a default "else" branch that hides typos — the whole point is to fail loudly on unknown input.',
  ],
  interview: [
    { q: 'What is @ParameterType used for?', a: 'To define a custom Cucumber expression parameter like {sortOption} or {product}: a regex for the matching text plus a method that converts it into a domain object. Steps then receive typed objects instead of strings.' },
    { q: 'How is the parameter type name decided?', a: 'By default it is the annotated method name; you can override it with the name attribute. The regex goes in value, and options like useForSnippets and preferForRegexMatch fine-tune snippets and regex matching.' },
    { q: 'Why is a typed parameter better than a String with a switch?', a: 'Unknown values fail as undefined steps instead of falling into a default branch, the mapping lives in one place, and every step reuses the same vocabulary.' },
  ],
}
