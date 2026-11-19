export default {
  id: 'cuc-007',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'DataTable as List<Map<String,String>> for the checkout form',
  level: 'INTERMEDIATE',
  tags: ['datatable', 'step-definitions', 'checkout'],
  estMinutes: 20,
  scenario: `The checkout page has first name, last name and postal code. The BA wrote the scenario with a table so the
data is visible to everyone. A colleague's step definition has a \`String\` parameter per field and crashes with
"step has 1 argument but the method has 3". You need to read the table properly.`,
  description: `Feature step:

\`\`\`gherkin
When the shopper fills the checkout form with
  | firstName | lastName | postalCode |
  | Asha      | Rao      | 560001     |
\`\`\`

Implement it in \`CheckoutSteps\`.

**Rules**
- The method takes an \`io.cucumber.datatable.DataTable\` **or** a \`List<Map<String, String>>\` parameter.
- Convert with \`asMaps()\` (or let Cucumber convert by declaring \`List<Map<String,String>>\`).
- Read values by **column name** (\`row.get("firstName")\`), not by index.
- Fill the form via \`CheckoutPage\` methods and continue.`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.support.DriverFactory;
import io.cucumber.java.en.When;

public class CheckoutSteps {

    private final CheckoutPage checkoutPage = new CheckoutPage(DriverFactory.getDriver());

    @When("the shopper fills the checkout form with")
    public void fillCheckoutForm(String firstName, String lastName, String postalCode) {
        // TODO: this crashes - a table is ONE argument
        checkoutPage.enterFirstName(firstName);
        checkoutPage.enterLastName(lastName);
        checkoutPage.enterPostalCode(postalCode);
        checkoutPage.clickContinue();
    }
}
`,
  solution: `package com.shopeasy.steps;

import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.support.DriverFactory;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.When;

import java.util.List;
import java.util.Map;

public class CheckoutSteps {

    private final CheckoutPage checkoutPage = new CheckoutPage(DriverFactory.getDriver());

    @When("the shopper fills the checkout form with")
    public void fillCheckoutForm(DataTable table) {
        List<Map<String, String>> rows = table.asMaps(String.class, String.class);
        Map<String, String> customer = rows.get(0);

        checkoutPage.enterFirstName(customer.get("firstName"));
        checkoutPage.enterLastName(customer.get("lastName"));
        checkoutPage.enterPostalCode(customer.get("postalCode"));
        checkoutPage.clickContinue();
    }
}
`,
  checks: [
    { label: 'Takes a DataTable or List<Map> parameter', pattern: '\\(\\s*(DataTable|List<\\s*Map<\\s*String\\s*,\\s*String\\s*>\\s*>)\\s+\\w+\\s*\\)', hint: 'public void fillCheckoutForm(DataTable table)' },
    { label: 'Converts to maps', pattern: '(asMaps\\s*\\(|List<\\s*Map<\\s*String\\s*,\\s*String\\s*>\\s*>\\s+\\w+\\s*\\))', hint: 'table.asMaps(String.class, String.class)' },
    { label: 'Reads by column name', pattern: '\\.get\\(\\s*"firstName"\\s*\\)', hint: 'row.get("firstName")' },
    { label: 'Not three String parameters', pattern: 'fillCheckoutForm\\s*\\(\\s*String', mustNot: true, hint: 'A DataTable is passed as one argument.' },
    { label: 'Uses the CheckoutPage', pattern: 'checkoutPage\\.\\w+\\(', hint: 'Call page-object methods to fill the form.' },
  ],
  hints: [
    'A DataTable is always the LAST argument of the step method.',
    'asMaps() uses the first row as keys: List of rows, each row a Map header → value.',
    'If the table has several customers, loop over the list.',
  ],
  explanation: `A DataTable is passed as a single extra argument after any expression parameters. Common conversions:

- \`asMaps()\` / \`List<Map<String,String>>\` — first row is the header, each following row is a map (most readable).
- \`asMap()\` / \`Map<String,String>\` — two-column key/value table (vertical form layout).
- \`asLists()\` / \`List<List<String>>\` — raw cells, use when there is no header.
- \`asList()\` / \`List<String>\` — single column.

Reading by column name means the BA can reorder columns without breaking automation. Next problem: map the row straight into a \`Customer\` object with \`@DataTableType\`.`,
  mistakes: [
    'Declaring one String per column — Cucumber reports an arity mismatch.',
    'Reading by index (row.get(0)) — breaks when someone reorders columns.',
    'Forgetting the colon/blank: the table must be indented directly under the step, no empty line between.',
    'Modifying the list returned by asMaps() — it is immutable; copy it first.',
  ],
  interview: [
    { q: 'DataTable vs Scenario Outline?', a: 'An Outline repeats the whole scenario per row. A DataTable passes structured data to one step in one run — e.g. a form with several fields or a list of expected cart items.' },
    { q: 'How do you convert a vertical two-column table?', a: 'Use asMap(String.class, String.class) or declare a Map<String,String> parameter: first column becomes the key, second the value.' },
  ],
}
