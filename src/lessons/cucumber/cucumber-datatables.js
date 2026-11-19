export default {
  slug: 'cucumber-datatables',
  category: 'cucumber',
  order: 5,
  title: 'Cucumber DataTables',
  minutes: 8,
  summary: 'Pass a table of data into a single step and read it as List<Map<String,String>> or convert rows into your own objects with @DataTableType.',
  manualAnalogy: `Some manual steps carry a little table of their own: "Fill the form with: First name Asha, Last name Rao..." or
"Cart should contain these products and prices". A DataTable is that little table attached to one Gherkin step, and
your Java method receives it as data.`,
  body: `## DataTable vs Scenario Outline

They both use pipes \`|\`, so beginners mix them up:

| | Scenario Outline + Examples | DataTable |
|---|---|---|
| Belongs to | the whole scenario | **one step** |
| Effect | runs the scenario once **per row** | the step runs **once**, receiving all rows |
| Use for | same test, different data sets | a form, a list of items, a set of expectations |

## Writing a DataTable

The table goes on the lines directly under the step, indented:

\`\`\`gherkin
Then the cart shows these products
  | name                 | price  |
  | Trailblazer Backpack | $29.99 |
  | Pulse Bike Light     | $9.99  |
\`\`\`

The first row is a **header** - the column names. Every other row is data.

## Reading it as a list of maps

A \`Map<String, String>\` is a Java collection of key/value pairs, like a dictionary: give it the key \`"name"\`, it
gives you back the value. A \`List<Map<String, String>>\` is a list of those - one map per data row, with the header
cells as keys.

\`\`\`java
@Then("the cart shows these products")
public void cartShows(List<Map<String, String>> expectedRows) {
    for (Map<String, String> row : expectedRows) {
        String name  = row.get("name");
        String price = row.get("price");
        Assert.assertEquals(cartPage.priceOf(name), price, "Price of " + name);
    }
}
\`\`\`

- Declaring the parameter as \`List<Map<String, String>>\` tells Cucumber to convert the table for you.
- The \`for (Map<String, String> row : expectedRows)\` loop visits each data row (the header is not a row here).
- \`row.get("price")\` reads by **column name**, not by position. If someone adds or reorders columns, the code still
  works - the same reason you name the columns in a test data sheet.

Alternatively, accept the raw \`io.cucumber.datatable.DataTable\` and convert it yourself:

\`\`\`java
public void cartShows(DataTable table) {
    List<Map<String, String>> rows = table.asMaps();
    ...
}
\`\`\`

\`asMaps()\` does the same header-to-key conversion. Other shapes exist (\`asList()\` for a single column,
\`asLists()\` for rows without headers), but \`List<Map>\` is the one you will use most.

## Converting rows into objects with @DataTableType

Maps are flexible but stringly-typed: every value is a \`String\`, and a typo in \`row.get("prise")\` returns
\`null\` silently. Bigger frameworks convert each row into a small Java class:

\`\`\`java
public record Product(String name, String price) { }
\`\`\`

A **record** (Java 16+) is a compact class that just holds values. Now teach Cucumber how to build one from a row:

\`\`\`java
package com.shopeasy.support;

import io.cucumber.java.DataTableType;
import java.util.Map;

public class TableTransformers {

    @DataTableType
    public Product productEntry(Map<String, String> row) {
        return new Product(row.get("name"), row.get("price"));
    }
}
\`\`\`

- \`@DataTableType\` (from \`io.cucumber.java\`) registers this method as a **converter**.
- It must be \`public\`, take one \`Map<String, String>\` (a row) and return your type.
- The class must be in a package listed in the runner's \`glue\`, or Cucumber never finds it.

Now the step can ask for objects directly - no \`asMaps()\`, no string keys in the step:

\`\`\`java
@Then("the cart shows these products")
public void cartShows(List<Product> expected) {
    for (Product p : expected) {
        Assert.assertEquals(cartPage.priceOf(p.name()), p.price());
    }
}
\`\`\`

The conversion logic lives in one place, every step using that table gets typed objects, and a misspelled column
fails in one spot instead of quietly everywhere.

## Vertical tables

For a single record (one product, one customer) some teams write the table sideways:

\`\`\`gherkin
  | name  | Retro Red Tee |
  | price | $15.99        |
\`\`\`

That reads as a \`Map<String, String>\` (first column = keys). It is handy, but be consistent within a project.`,
  keyPoints: [
    'A DataTable belongs to one step and is passed in once; an Examples table repeats the whole scenario.',
    'The header row becomes the keys of each Map; read values by column name with row.get("column").',
    'Declare List<Map<String, String>> as the parameter, or take DataTable and call asMaps().',
    '@DataTableType converts each row Map into your own class so steps receive List<YourType>.',
    'Transformer classes must be in a glue package to be discovered.',
  ],
  mistakes: [
    'Reading cells by index (row 0, column 2). Fix: read by header name so column order does not matter.',
    'Using a DataTable when you wanted the scenario to repeat per row. Fix: use Scenario Outline + Examples.',
    'Putting the @DataTableType class outside the glue packages. Fix: move it or add its package to glue.',
    'Misspelling a header key so get() returns null. Fix: copy header names exactly, or use @DataTableType to centralise them.',
  ],
  tryIt: `Add two products on http://localhost:5180/practice-site/inventory.html, open the cart and write a DataTable
under "Then the cart shows these products" listing exactly what you see.`,
  problems: ['cuc-007', 'cuc-008', 'cuc-017'],
}
