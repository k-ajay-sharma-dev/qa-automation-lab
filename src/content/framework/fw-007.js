export default {
  id: 'fw-007',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'External test data: JSON (Jackson) into a DataProvider',
  level: 'INTERMEDIATE',
  tags: ['test-data', 'json', 'jackson', 'excel', 'apache-poi', 'dataprovider'],
  estMinutes: 25,
  scenario: `The business analysts maintain the checkout test data (customer names, postal codes, expected validation
messages) and want to add rows **without touching Java**. They keep asking for Excel; your lead prefers JSON in git
because it diffs nicely in PRs. You will build the JSON reader now (and see the Excel version in the explanation).`,
  description: `Load \`src/test/resources/testdata/checkout-customers.json\` into POJOs and feed a DataProvider.

\`\`\`json
[
  { "firstName": "Asha", "lastName": "Rao",  "postalCode": "560001", "expectedError": null },
  { "firstName": "",     "lastName": "Rao",  "postalCode": "560001", "expectedError": "Error: First Name is required" },
  { "firstName": "Asha", "lastName": "",     "postalCode": "560001", "expectedError": "Error: Last Name is required" }
]
\`\`\`

**Rules**
- A \`Customer\` POJO (fields + getters, default constructor) — Jackson maps JSON keys to fields.
- \`TestDataReader.readList(String resource, Class<T>)\` (or a Customer-specific method) using \`ObjectMapper\`
  and \`TypeReference\` / \`constructCollectionType\`, reading from the **classpath**.
- \`@DataProvider\` returns \`Object[][]\` (or \`Iterator<Object[]>\`) with one \`Customer\` per row.
- The test takes a \`Customer\` parameter.`,
  starterCode: `package com.shopeasy.data;

import java.util.List;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

public class CheckoutValidationTest extends BaseTest {

    @DataProvider(name = "customers")
    public Object[][] customers() {
        // TODO: read testdata/checkout-customers.json instead of hard-coding
        return new Object[][] {
            { "Asha", "Rao", "560001", null },
        };
    }

    @Test(dataProvider = "customers")
    public void checkoutValidation(String first, String last, String zip, String expectedError) {
        // ...
    }
}
`,
  solution: `package com.shopeasy.data;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.testng.Assert;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

class Customer {
    private String firstName;
    private String lastName;
    private String postalCode;
    private String expectedError;

    public Customer() { }

    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getPostalCode() { return postalCode; }
    public String getExpectedError() { return expectedError; }

    @Override
    public String toString() { return firstName + " " + lastName + " / " + postalCode; }
}

final class TestDataReader {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private TestDataReader() { }

    static <T> List<T> readList(String resource, Class<T> type) {
        try (InputStream in = TestDataReader.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) throw new IllegalStateException("Test data not found: " + resource);
            return MAPPER.readValue(in,
                    MAPPER.getTypeFactory().constructCollectionType(List.class, type));
        } catch (IOException e) {
            throw new IllegalStateException("Cannot parse " + resource, e);
        }
    }
}

public class CheckoutValidationTest extends BaseTest {

    @DataProvider(name = "customers")
    public Object[][] customers() {
        List<Customer> list = TestDataReader.readList("testdata/checkout-customers.json", Customer.class);
        return list.stream().map(c -> new Object[] { c }).toArray(Object[][]::new);
    }

    @Test(dataProvider = "customers")
    public void checkoutValidation(Customer customer) {
        CheckoutPage checkout = loginAsStandardUser()
                .addToCart("Trailblazer Backpack")
                .header().openCart()
                .checkout()
                .fillShippingInfo(customer.getFirstName(), customer.getLastName(), customer.getPostalCode());

        if (customer.getExpectedError() == null) {
            Assert.assertTrue(checkout.continueToOverview().isLoaded(), "Overview for " + customer);
        } else {
            Assert.assertEquals(checkout.continueExpectingError().getErrorMessage(),
                    customer.getExpectedError(), "Validation for " + customer);
        }
    }
}
`,
  checks: [
    { label: 'Customer POJO', pattern: 'class\\s+Customer\\b[\\s\\S]*?private\\s+String\\s+\\w+', hint: 'class Customer { private String firstName; ... getters }' },
    { label: 'Uses Jackson ObjectMapper', pattern: 'new\\s+ObjectMapper\\s*\\(', hint: 'new ObjectMapper()' },
    { label: 'Reads a typed list', pattern: '(TypeReference\\s*<\\s*List|constructCollectionType\\s*\\(\\s*List\\.class)', hint: 'mapper.getTypeFactory().constructCollectionType(List.class, Customer.class)' },
    { label: 'Loads JSON from the classpath', pattern: 'getResourceAsStream\\s*\\(', hint: 'getClassLoader().getResourceAsStream("testdata/...json")' },
    { label: 'Provider built from the file, not hard-coded', pattern: '\\{\\s*"Asha"', mustNot: true, hint: 'Remove the inline rows' },
    { label: 'Test receives a Customer', pattern: 'void\\s+\\w+\\s*\\(\\s*Customer\\s+\\w+\\s*\\)', hint: 'checkoutValidation(Customer customer)' },
  ],
  hints: [
    'Jackson needs a no-arg constructor; private fields with public getters (or setters) are enough for it to map the JSON keys.',
    'mapper.readValue(in, mapper.getTypeFactory().constructCollectionType(List.class, Customer.class))',
    'list.stream().map(c -> new Object[]{ c }).toArray(Object[][]::new)',
  ],
  explanation: `Passing a **POJO per row** instead of 4 loose strings keeps the test signature stable as columns grow, and
\`toString()\` makes each row readable in the report.

Dependency: \`com.fasterxml.jackson.core:jackson-databind\` (test scope). Jackson maps JSON keys to properties it discovers
through getters/setters (a private field with a public getter is filled directly); use \`@JsonProperty\` when a JSON
key does not match the Java name. \`FAIL_ON_UNKNOWN_PROPERTIES=false\` lets BAs add a "notes" column without breaking runs.

**Excel with Apache POI** (\`org.apache.poi:poi-ooxml\`) — what the BAs asked for:
\`\`\`java
try (InputStream in = cl.getResourceAsStream("testdata/customers.xlsx");
     Workbook wb = new XSSFWorkbook(in)) {
    Sheet sheet = wb.getSheet("checkout");
    DataFormatter fmt = new DataFormatter();          // reads 560001 as "560001", not 560001.0
    List<Object[]> rows = new ArrayList<>();
    for (int r = 1; r <= sheet.getLastRowNum(); r++) {  // row 0 = header
        Row row = sheet.getRow(r);
        rows.add(new Object[] { fmt.formatCellValue(row.getCell(0)), fmt.formatCellValue(row.getCell(1)),
                                fmt.formatCellValue(row.getCell(2)), fmt.formatCellValue(row.getCell(3)) });
    }
    return rows.toArray(new Object[0][]);
}
\`\`\`
Trade-offs: Excel is friendly for business users but binary (no PR diffs, merge conflicts are painful) and numeric
cells need \`DataFormatter\`. JSON/CSV in git is reviewable and versioned with the tests. Many teams accept Excel
from BAs and convert to JSON in the repo.`,
  mistakes: [
    'Reading Excel numeric cells with getStringCellValue (IllegalStateException) or getting 560001.0.',
    'Reading test data with absolute file paths from a developer laptop.',
    'Huge shared data files where one bad row breaks every test.',
    'Keeping expected results outside the data, so the test still hard-codes them.',
  ],
  interview: [
    { q: 'How do you manage test data in your framework?', a: 'Static reference data lives in versioned JSON/CSV files under src/test/resources, loaded into POJOs and fed through DataProviders or Cucumber tables. Dynamic data (new users, orders) is created via API or DB in setup and cleaned up after. Secrets come from the CI vault.' },
    { q: 'How do you read Excel in Java?', a: 'With Apache POI: open an XSSFWorkbook, get the sheet, iterate rows, and use DataFormatter to read cells as displayed strings. Close the workbook with try-with-resources.' },
  ],
}
