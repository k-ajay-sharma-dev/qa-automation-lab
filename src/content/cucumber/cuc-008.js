export default {
  id: 'cuc-008',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Map table rows to objects with @DataTableType',
  level: 'INTERMEDIATE',
  tags: ['datatable', 'datatabletype', 'type-registry'],
  estMinutes: 20,
  scenario: `Five different checkout steps now do \`row.get("firstName")\`, \`row.get("lastName")\`… and someone typed
\`"firstname"\` in one of them, which silently returned \`null\` and typed nothing. The lead wants one place that turns a table row into a
\`Customer\` object, so step methods can simply declare \`List<Customer>\`.`,
  description: `1. Write a \`@DataTableType\` method that converts \`Map<String, String>\` → \`Customer\`.
2. Change the step to take \`List<Customer> customers\` directly.

\`\`\`gherkin
When the shopper checks out as
  | firstName | lastName | postalCode |
  | Asha      | Rao      | 560001     |
\`\`\`

**Rules**
- The transformer lives in a class inside the glue package (e.g. \`com.shopeasy.support.DataTableTypes\`).
- Annotated with \`io.cucumber.java.DataTableType\`, public, takes \`Map<String, String>\`, returns \`Customer\`.
- Step method parameter is \`List<Customer>\` — no \`asMaps()\` in the step.`,
  starterCode: `// ----- com/shopeasy/model/Customer.java -----
package com.shopeasy.model;

public record Customer(String firstName, String lastName, String postalCode) { }

// ----- com/shopeasy/support/DataTableTypes.java -----
package com.shopeasy.support;

import com.shopeasy.model.Customer;
import java.util.Map;

public class DataTableTypes {
    // TODO: convert one table row (Map) into a Customer
}

// ----- com/shopeasy/steps/CheckoutSteps.java -----
package com.shopeasy.steps;

public class CheckoutSteps {

    @When("the shopper checks out as")
    public void checkoutAs(DataTable table) {
        Map<String, String> row = table.asMaps().get(0);
        checkoutPage.fillCustomer(new Customer(row.get("firstName"), row.get("lastname"), row.get("postalCode")));
    }
}
`,
  solution: `// ----- com/shopeasy/model/Customer.java -----
package com.shopeasy.model;

public record Customer(String firstName, String lastName, String postalCode) { }

// ----- com/shopeasy/support/DataTableTypes.java -----
package com.shopeasy.support;

import com.shopeasy.model.Customer;
import io.cucumber.java.DataTableType;
import java.util.Map;

public class DataTableTypes {

    @DataTableType
    public Customer customerEntry(Map<String, String> row) {
        return new Customer(
                row.get("firstName"),
                row.get("lastName"),
                row.get("postalCode"));
    }
}

// ----- com/shopeasy/steps/CheckoutSteps.java -----
package com.shopeasy.steps;

import com.shopeasy.model.Customer;
import com.shopeasy.pages.CheckoutPage;
import io.cucumber.java.en.When;
import java.util.List;

public class CheckoutSteps {

    private final CheckoutPage checkoutPage;

    public CheckoutSteps(CheckoutPage checkoutPage) {
        this.checkoutPage = checkoutPage;
    }

    @When("the shopper checks out as")
    public void checkoutAs(List<Customer> customers) {
        checkoutPage.fillCustomer(customers.get(0));
        checkoutPage.clickContinue();
    }
}
`,
  checks: [
    { label: 'Has @DataTableType', pattern: '@DataTableType', hint: 'Annotate the converter with @DataTableType.' },
    { label: 'Imports io.cucumber.java.DataTableType', pattern: 'import\\s+io\\.cucumber\\.java\\.(DataTableType|\\*)\\s*;', hint: 'import io.cucumber.java.DataTableType;' },
    { label: 'Converter takes Map<String,String> and returns Customer', pattern: 'public\\s+Customer\\s+\\w+\\s*\\(\\s*Map<\\s*String\\s*,\\s*String\\s*>\\s+\\w+\\s*\\)', hint: 'public Customer customerEntry(Map<String, String> row)' },
    { label: 'Step takes List<Customer>', pattern: '\\(\\s*List<\\s*Customer\\s*>\\s+\\w+\\s*\\)', hint: 'public void checkoutAs(List<Customer> customers)' },
    { label: 'No manual asMaps in the step', pattern: 'asMaps\\s*\\(', mustNot: true, hint: 'Cucumber converts the table for you now.' },
  ],
  hints: [
    'The class with @DataTableType must be in a package listed in glue, otherwise Cucumber never registers it.',
    'Signature: public Customer anyName(Map<String, String> entry).',
    'Once registered, Cucumber can convert to Customer, List<Customer>, and even a single-row table to Customer.',
  ],
  explanation: `\`@DataTableType\` registers a converter in Cucumber's type registry. Cucumber picks it by **return type**:
any step parameter of \`Customer\` or \`List<Customer>\` is now built from the table automatically.

Benefits: the column-name strings live in **one** place, step methods read like business code, and a typo is fixed once.
Variants: a \`Map<String,String>\` parameter = one row per object (entry), \`List<String>\` = a row without header, \`String\` = a single cell.
For many models, Jackson's \`@DefaultDataTableEntryTransformer\` can map any table to any POJO by field names.`,
  mistakes: [
    'Putting the converter class outside the glue packages — "No DataTableType registered for Customer".',
    'Making the converter private or static in old Cucumber versions — keep it a public instance method.',
    'Still calling asMaps() in the step and ignoring the converter.',
  ],
  interview: [
    { q: 'What does @DataTableType do?', a: 'It registers a function that converts a table row (Map), a row list or a cell into a domain object. Cucumber uses it whenever a step parameter is that type or a List of it.' },
    { q: 'How would you avoid writing one @DataTableType per POJO?', a: 'Register a @DefaultDataTableEntryTransformer that uses Jackson ObjectMapper.convertValue(entry, type), so any POJO with matching field names is converted.' },
  ],
}
