export default {
  slug: 'framework-data-driven-testing',
  category: 'framework',
  order: 4,
  title: 'Data-driven testing: @DataProvider, JSON and Excel',
  minutes: 10,
  summary: 'Run one test method against many rows of data with a TestNG DataProvider, and load those rows from JSON (Jackson) or Excel (Apache POI) files.',
  manualAnalogy: `You already write decision tables: one test case, many rows of inputs and expected results. You would never write six separate test cases that differ only in the user name. Data-driven testing is the same idea in code — one test method, a table of data, and TestNG runs the method once per row, reporting each row separately.`,
  body: `## The copy-paste smell

\`\`\`java
@Test public void sortAz()   { checkSort("az",   "Classic Crew T-Shirt"); }
@Test public void sortZa()   { checkSort("za",   "Trailblazer Backpack"); }
@Test public void sortLohi() { checkSort("lohi", "Junior Onesie"); }
\`\`\`

Same steps, different data. Add a fourth option and you add a fourth method.

## @DataProvider: a table in code

\`\`\`java
@DataProvider(name = "sortOptions")
public Object[][] sortOptions() {
    return new Object[][] {
        // value   expected first product
        { "az",   "Classic Crew T-Shirt" },
        { "za",   "Trailblazer Backpack" },
        { "lohi", "Junior Onesie" },
    };
}

@Test(dataProvider = "sortOptions")
public void firstProductAfterSort(String value, String expectedFirst) {
    List<String> names = loginAsStandardUser().sortBy(value).productNames();
    Assert.assertEquals(names.get(0), expectedFirst, "First product for sort " + value);
}
\`\`\`

- \`Object[][]\` is a **two-dimensional array**: an array of rows, each row an array of values. \`Object\` means "any type", so a row can mix Strings, numbers and objects.
- \`@DataProvider(name = ...)\` labels the method; \`@Test(dataProvider = ...)\` connects the test to it by that name.
- Each row's values become the test method's parameters **in order**. Three values in a row ⇒ three parameters, matching types.
- The report shows one result per row, e.g. \`firstProductAfterSort("za", ...)\` passed, \`("lohi", ...)\` failed.

## Positive and negative rows together

A decision table usually mixes outcomes. Add a column for the expected result and branch on it:

\`\`\`java
{ "standard_user", "secret_sauce", null },                       // null = should succeed
{ "locked_out_user", "secret_sauce", "Error: ... locked out." }, // expected error
\`\`\`

The test checks \`if (expectedError == null)\` → assert the next page loaded, otherwise → assert the error text. Keep the branching tiny; if the two paths differ a lot, use two providers and two tests.

## Moving data out of Java: JSON

When testers or BAs maintain the data, keep it in a file under \`src/test/resources/testdata/\`:

\`\`\`json
[
  { "name": "Trailblazer Backpack", "price": "$29.99" },
  { "name": "Pulse Bike Light",     "price": "$9.99"  }
]
\`\`\`

Create a **POJO** ("plain old Java object") whose fields match the JSON keys:

\`\`\`java
public class Product {
    private String name;
    private String price;
    public Product() {}                       // Jackson needs an empty constructor
    public String getName()  { return name; }
    public String getPrice() { return price; }
}
\`\`\`

Then **Jackson** (\`com.fasterxml.jackson.core:jackson-databind\`) converts the file into objects:

\`\`\`java
ObjectMapper mapper = new ObjectMapper();
try (InputStream in = getClass().getClassLoader().getResourceAsStream("testdata/products.json")) {
    List<Product> products = mapper.readValue(in, new TypeReference<List<Product>>() {});
}
\`\`\`

- \`getResourceAsStream\` reads from the **classpath**, so the same path works in the IDE, \`mvn test\` and Jenkins — unlike \`C:\\\\Users\\\\...\` paths.
- \`TypeReference<List<Product>>\` tells Jackson "a list of Product", because Java forgets generic types at runtime.

Finally turn the list into provider rows — one object per row:

\`\`\`java
return products.stream().map(p -> new Object[] { p }).toArray(Object[][]::new);
\`\`\`

and the test takes a single \`Product product\` parameter. Adding a field later (say \`description\`) changes the POJO and the JSON, not the test signature.

## Excel with Apache POI

Some teams keep data in \`.xlsx\`. Apache POI (\`org.apache.poi:poi-ooxml\`) reads it: open a \`XSSFWorkbook\`, take a \`Sheet\`, loop over \`Row\`s from 1 (row 0 is the header) and read each \`Cell\`. Use \`DataFormatter\` to get cell values as text — numeric cells otherwise come back as \`29.99\` doubles or \`560001.0\`. Excel is friendly for non-coders but binary (hard to review in Git); JSON or CSV diff cleanly.

## Bigger data sets

\`@DataProvider(parallel = true)\` runs rows in parallel (thread count set by \`data-provider-thread-count\` in testng.xml). Returning \`Iterator<Object[]>\` instead of \`Object[][]\` lets you stream very large files row by row.`,
  keyPoints: [
    'A `@DataProvider` returns `Object[][]`: rows of values that become the test parameters in order.',
    'Connect them with `@Test(dataProvider = "name")`; each row is reported separately.',
    'An expected-result column lets one test cover positive and negative rows.',
    'Load JSON with Jackson into POJOs (empty constructor + getters), reading from the classpath.',
    'Excel works through Apache POI; use DataFormatter to read cells as text.',
  ],
  mistakes: [
    'Parameter count or types not matching the row — TestNG fails with a "data provider mismatch" error.',
    'Reading files with absolute paths like `C:\\\\data\\\\x.json` — fails on CI; use `getResourceAsStream`.',
    'POJO without an empty constructor or with field names that differ from the JSON keys — Jackson throws.',
    'Putting complex if/else trees in a data-driven test — split into separate providers and tests.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/inventory.html, try each sort option and note the first product shown. Write those observations as a decision table with two columns — that table is your DataProvider, ready to paste into \`Object[][]\`.`,
  problems: ['fw-004', 'fw-007', 'fw-030', 'fw-031'],
}
