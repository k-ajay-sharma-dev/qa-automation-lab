export default {
  id: 'cuc-038',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'A vertical DataTable as Map<String,String> for one seller record',
  level: 'INTERMEDIATE',
  tags: ['datatable', 'step-definitions', 'form', 'map'],
  estMinutes: 18,
  scenario: `The BA wrote the seller sign-up scenario with a **two-column, key-value** table because a wide 8-column table did not fit on
the screen in Jira. A teammate reused the checkout step pattern (\`asMaps()\` and \`rows.get(0)\`) and now gets a map whose keys are
"firstName" and "Asha" — every field lookup returns null and the test fills nothing.`,
  description: `Feature step (one record, written vertically):

\`\`\`gherkin
When the visitor registers as a seller with
  | First name | Asha             |
  | Last name  | Rao              |
  | Email      | asha@example.com |
  | Country    | India            |
\`\`\`

Implement it in \`RegistrationSteps\` using \`RegistrationPage\` (\`enterFirstName\`, \`enterLastName\`, \`enterEmail\`,
\`selectCountry\`, \`acceptTerms\`, \`submit\`).

**Rules**
- The parameter is a \`Map<String, String>\` (or a \`DataTable\` converted with \`asMap(...)\`) — **not** \`asMaps()\`.
- Read values by the **row label** (\`data.get("Email")\`).
- Treat Country as optional: only select it when the row is present.
- Accept the seller terms and submit.`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.RegistrationPage;
import com.shopeasy.support.DriverFactory;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.When;

import java.util.List;
import java.util.Map;

public class RegistrationSteps {

    private final RegistrationPage registrationPage = new RegistrationPage(DriverFactory.getDriver());

    @When("the visitor registers as a seller with")
    public void registerAsSeller(DataTable table) {
        // TODO: asMaps() treats the first row ("First name | Asha") as a header row - wrong shape for one record
        List<Map<String, String>> rows = table.asMaps();
        Map<String, String> data = rows.get(0);
        registrationPage.enterFirstName(data.get("firstName"));
        registrationPage.submit();
    }
}
`,
  solution: `package com.shopeasy.steps;

import com.shopeasy.pages.RegistrationPage;
import com.shopeasy.support.DriverFactory;
import io.cucumber.java.en.When;

import java.util.Map;

public class RegistrationSteps {

    private final RegistrationPage registrationPage = new RegistrationPage(DriverFactory.getDriver());

    @When("the visitor registers as a seller with")
    public void registerAsSeller(Map<String, String> seller) {
        registrationPage.enterFirstName(seller.get("First name"));
        registrationPage.enterLastName(seller.get("Last name"));
        registrationPage.enterEmail(seller.get("Email"));

        String country = seller.get("Country");
        if (country != null && !country.isBlank()) {
            registrationPage.selectCountry(country);
        }

        registrationPage.acceptTerms();
        registrationPage.submit();
    }
}
`,
  checks: [
    { label: 'Uses a Map<String,String> (or asMap)', pattern: '\\(\\s*Map<\\s*String\\s*,\\s*String\\s*>\\s+\\w+\\s*\\)|\\.asMap\\s*\\(', hint: 'public void registerAsSeller(Map<String, String> seller)' },
    { label: 'Does not use asMaps() for one record', pattern: '\\.asMaps\\s*\\(', mustNot: true, hint: 'asMaps() expects a header row and returns a list.' },
    { label: 'Reads by row label', pattern: '\\.get\\(\\s*"Email"\\s*\\)', hint: 'seller.get("Email")' },
    { label: 'Handles the optional Country', pattern: 'if\\s*\\([^)]*(country|Country|containsKey)', hint: 'Only select a country when the row is present.' },
    { label: 'Accepts terms and submits', pattern: 'acceptTerms\\s*\\([\\s\\S]*submit\\s*\\(', hint: 'registrationPage.acceptTerms(); registrationPage.submit();' },
  ],
  hints: [
    'A vertical (key | value) table describes ONE object; a horizontal table with a header row describes MANY.',
    'Declare the parameter as Map<String, String> and Cucumber converts the two columns for you.',
    'map.get("Country") returns null when the row is missing — check before using it.',
  ],
  explanation: `Pick the conversion from the **shape** of the table:

| Table shape | Java type |
|---|---|
| header row + many rows | \`List<Map<String,String>>\` / \`asMaps()\` |
| two columns, key → value, one record | \`Map<String,String>\` / \`asMap(String.class, String.class)\` |
| one column | \`List<String>\` |

With \`asMaps()\` the first row ("First name | Asha") becomes the header, so every resulting map has the keys "First name" and "Asha" (e.g. "First name" → "Last name") — \`get("firstName")\` returns null, exactly the bug in the scenario. Declaring \`Map<String, String>\` lets Cucumber do the right conversion and the labels stay readable for the BA.

Optional rows are normal in vertical tables (a BA leaves out what does not matter for that scenario), so guard them instead of passing null into Selenium's \`sendKeys\`.`,
  mistakes: [
    'Using asMaps() on a key-value table — the first data row silently becomes the header.',
    'Reading by camelCase keys ("firstName") when the table says "First name" — the lookup returns null.',
    'Passing a null optional value to sendKeys / selectByVisibleText and getting an IllegalArgumentException.',
  ],
  interview: [
    { q: 'When do you choose a vertical table over a horizontal one?', a: 'Vertical for one record with many fields (forms, a single customer); horizontal with a header row for several records of the same shape (cart lines, users). Readability for the business reader decides.' },
    { q: 'What happens if the key column has a duplicate label?', a: 'asMap throws because a map cannot hold duplicate keys — which is useful: it catches a copy-paste mistake in the feature file early.' },
    { q: 'How would you turn the map into a typed object?', a: 'Register a @DataTableType that takes Map<String,String> and returns a Seller, then declare the step parameter as Seller. The step definition then works with seller.email() instead of string keys.' },
  ],
}
