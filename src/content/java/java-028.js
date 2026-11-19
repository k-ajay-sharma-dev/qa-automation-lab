export default {
  id: 'java-028',
  category: 'java',
  kind: 'code',
  title: 'Data-driven checkout tests: read a CSV into records and feed a TestNG DataProvider',
  level: 'EXPERT',
  tags: ['file-io', 'csv', 'try-with-resources', 'records', 'dataprovider', 'data-driven'],
  estMinutes: 40,
  scenario: `The checkout form (\`checkout.html\`, step 1) has five validation rules, and the business analyst keeps their cases in a spreadsheet exported as \`src/test/resources/testdata/checkout-data.csv\`:
\`\`\`
firstName,lastName,postalCode,expectedError
Asha,Rao,560001,
,Rao,560001,Error: First Name is required
Asha,,560001,Error: Last Name is required
Asha,Rao,,Error: Postal Code is required
Asha,Rao,12,Error: Postal Code is invalid
\`\`\`
The current reader opens the file with a \`FileReader\` it never closes, treats the header as a test case, and crashes with \`ArrayIndexOutOfBoundsException: Index 3\` on the first row. That row is the happy path, whose \`expectedError\` is empty.
You'll build a robust reader that the whole team can reuse for data-driven tests.`,
  description: `Implement \`CheckoutData\`.

**Acceptance**
* \`record CheckoutRow(String firstName, String lastName, String postalCode, String expectedError)\` with \`boolean expectsSuccess()\` (true when \`expectedError\` is blank).
* \`static List<CheckoutRow> read(Path file)\`:
  * opens the file with **try-with-resources** (\`Files.newBufferedReader(file, StandardCharsets.UTF_8)\`), so it is always closed,
  * reads the **header** first and checks it equals the expected header (otherwise \`IllegalArgumentException\`),
  * skips blank lines,
  * splits each line with **\`split(",", -1)\`** so trailing empty columns are kept,
  * rejects a row that doesn't have exactly 4 columns, with a message that includes the **file name and line number**,
  * wraps \`IOException\` in an \`UncheckedIOException\` with the file name,
  * returns an unmodifiable list.
* \`@DataProvider(name = "checkoutData") public static Object[][] checkoutData()\`: one row per \`CheckoutRow\`, read from \`src/test/resources/testdata/checkout-data.csv\`.`,
  hints: [
    'try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) { String header = reader.readLine(); String line; while ((line = reader.readLine()) != null) { ... } }',
    '"Asha,Rao,560001,".split(",") has length 3, because Java drops trailing empty strings. split(",", -1) keeps them and gives length 4.',
    'Object[][] data = new Object[rows.size()][]; for (int i = 0; i < rows.size(); i++) { data[i] = new Object[] { rows.get(i) }; }',
  ],
  language: 'java',
  starterCode: `package com.shop.data;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.List;

public class CheckoutData {

    public static List<String[]> read(String fileName) throws Exception {
        BufferedReader reader = new BufferedReader(new FileReader(fileName));   // never closed
        List<String[]> rows = new ArrayList<>();
        String line;
        while ((line = reader.readLine()) != null) {      // header becomes a "test case"
            String[] cells = line.split(",");             // trailing empty column is dropped
            System.out.println("Testing " + cells[0] + " expecting " + cells[3]);   // AIOOBE on the happy path
            rows.add(cells);
        }
        return rows;
    }

    // TODO: record CheckoutRow(String firstName, String lastName, String postalCode, String expectedError)
    // TODO: static List<CheckoutRow> read(Path file) with try-with-resources, header check,
    //       split(",", -1), column-count validation with line numbers, UncheckedIOException
    // TODO: @DataProvider(name = "checkoutData") public static Object[][] checkoutData()
}
`,
  solution: `package com.shop.data;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.testng.annotations.DataProvider;

public final class CheckoutData {

    static final String HEADER = "firstName,lastName,postalCode,expectedError";
    static final Path DEFAULT_FILE = Path.of("src", "test", "resources", "testdata", "checkout-data.csv");
    private static final int COLUMNS = 4;

    public record CheckoutRow(String firstName, String lastName, String postalCode, String expectedError) {
        public boolean expectsSuccess() {
            return expectedError.isBlank();
        }
    }

    private CheckoutData() { }

    public static List<CheckoutRow> read(Path file) {
        List<CheckoutRow> rows = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String header = reader.readLine();
            if (header == null || !header.trim().equals(HEADER)) {
                throw new IllegalArgumentException(file + ": expected header '" + HEADER + "' but found '" + header + "'");
            }
            String line;
            int lineNumber = 1;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank()) {
                    continue;                                   // tolerate empty lines at the end
                }
                String[] cells = line.split(",", -1);           // -1 keeps trailing empty columns
                if (cells.length != COLUMNS) {
                    throw new IllegalArgumentException(file.getFileName() + " line " + lineNumber
                            + ": expected " + COLUMNS + " columns but found " + cells.length + " -> " + line);
                }
                rows.add(new CheckoutRow(cells[0].trim(), cells[1].trim(), cells[2].trim(), cells[3].trim()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read test data file " + file.toAbsolutePath(), e);
        }
        return List.copyOf(rows);
    }

    @DataProvider(name = "checkoutData")
    public static Object[][] checkoutData() {
        List<CheckoutRow> rows = read(DEFAULT_FILE);
        Object[][] data = new Object[rows.size()][];
        for (int i = 0; i < rows.size(); i++) {
            data[i] = new Object[] { rows.get(i) };   // one test invocation per CSV row
        }
        return data;
    }
}

// In CheckoutValidationTest (extends BaseTest):
// @Test(dataProvider = "checkoutData", dataProviderClass = CheckoutData.class)
// public void checkoutStepOneValidation(CheckoutData.CheckoutRow row) {
//     driver.findElement(By.id("first-name")).sendKeys(row.firstName());
//     driver.findElement(By.id("last-name")).sendKeys(row.lastName());
//     driver.findElement(By.id("postal-code")).sendKeys(row.postalCode());
//     driver.findElement(By.id("continue")).click();
//     if (row.expectsSuccess()) {
//         Assert.assertTrue(driver.findElement(By.id("checkout-step-two")).isDisplayed());
//     } else {
//         Assert.assertEquals(driver.findElement(By.id("checkout-error-message")).getText(), row.expectedError());
//     }
// }
`,
  checks: [
    { label: 'Models a row as a record', pattern: 'record\\s+CheckoutRow\\s*\\(', hint: 'public record CheckoutRow(String firstName, String lastName, String postalCode, String expectedError) { ... }' },
    { label: 'Opens the file with try-with-resources', pattern: 'try\\s*\\(\\s*(final\\s+)?(BufferedReader|var|Stream\\s*<\\s*String\\s*>)\\s+\\w+\\s*=', hint: 'try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) { ... }' },
    { label: 'Keeps trailing empty columns with split(",", -1)', pattern: '\\.split\\s*\\(\\s*","\\s*,\\s*-1\\s*\\)', hint: 'line.split(",", -1)' },
    { label: 'Validates the column count', pattern: '\\.length\\s*(!=|<|>)\\s*\\w+', hint: 'if (cells.length != COLUMNS) throw new IllegalArgumentException(file + " line " + lineNumber + ...);' },
    { label: 'Wraps IOException in UncheckedIOException', pattern: 'catch\\s*\\(\\s*IOException\\s+\\w+\\s*\\)\\s*\\{\\s*throw\\s+new\\s+UncheckedIOException', hint: 'catch (IOException e) { throw new UncheckedIOException("Cannot read " + file, e); }' },
    { label: 'Exposes a TestNG DataProvider returning Object[][]', pattern: '@DataProvider\\s*\\([^)]*\\)\\s*public\\s+static\\s+Object\\s*\\[\\s*\\]\\s*\\[\\s*\\]', hint: '@DataProvider(name = "checkoutData") public static Object[][] checkoutData()' },
    { label: 'No unclosed FileReader', pattern: 'new\\s+BufferedReader\\s*\\(\\s*new\\s+FileReader', mustNot: true, hint: 'Open the reader inside try ( ... ) so it is always closed.' },
  ],
  explanation: `Data-driven testing means one test method and many data rows. The reader is framework code that every data-driven test depends on, so it has to be **strict and loud**.

**Resource handling.** \`try (BufferedReader reader = ...)\` closes the file when the block ends, even if a row throws. An unclosed reader leaks a file handle per test class, and on Windows it also locks the file. \`Files.newBufferedReader(path, UTF_8)\` makes the encoding explicit, so names like "Müller" read the same on every machine.

**The \`split\` trap.** \`String.split\` drops *trailing* empty strings: \`"Asha,Rao,560001,".split(",")\` has 3 elements, not 4. The happy-path row, the most important one, crashed the old reader. \`split(",", -1)\` keeps every column. (Real CSV with quoted commas, \`"Rao, Jr."\`, needs a library like OpenCSV or Jackson CSV. Say so in an interview.)

**Fail fast with context.** A header check catches a re-exported spreadsheet with renamed or reordered columns. A column-count check with **file name + line number** turns "Index 3 out of bounds" into \`checkout-data.csv line 5: expected 4 columns but found 3\`, which the analyst can fix without a developer.

**Checked → unchecked.** \`IOException\` is checked. Wrapping it in \`UncheckedIOException\` (and keeping the cause) means test methods and data providers don't need \`throws\` clauses, and a missing file still stops the run with the absolute path in the message.

**Records + DataProvider.** Each row becomes an immutable \`CheckoutRow\`. TestNG calls the test once per inner array of \`Object[][]\`, and passing the whole record (instead of four Strings) keeps the test signature stable when a column is added. \`List.copyOf\` makes the result read-only, so one test can't change data another test receives.`,
  mistakes: [
    'Using split(",") and losing the empty last column, so the happy-path row crashes or shifts columns.',
    'Treating the header line as test data, which creates a bogus test case named "firstName".',
    'Opening files with a relative FileReader path that depends on the IDE working directory, and never closing it.',
    'Swallowing IOException in the data provider and returning an empty Object[][], so TestNG runs zero tests and the build stays green.',
  ],
  interview: [
    { q: 'How do you implement data-driven testing in TestNG?', a: 'A @DataProvider method returns Object[][] (or Iterator<Object[]>), where each inner array is the argument list for one invocation, and the test uses @Test(dataProvider = "name", dataProviderClass = ...). The data usually comes from CSV, JSON or Excel through a reader utility that maps rows into objects.' },
    { q: 'What is try-with-resources and why does it matter for test data files?', a: 'A try statement that declares AutoCloseable resources, which Java closes automatically in reverse order, even when an exception is thrown. It prevents leaked file handles and locked files in long suites, without finally blocks.' },
    { q: 'Files.readAllLines vs BufferedReader?', a: 'Files.readAllLines is a one-liner that loads the whole file into memory, which is fine for small test-data files. BufferedReader (or Files.lines in try-with-resources) streams line by line, which suits large files and lets you track line numbers for error messages.' },
    { q: 'CSV vs JSON vs Excel for test data?', a: 'CSV is simple, diff-friendly and editable by business users, but flat. JSON handles nested data like addresses and order items and maps directly to objects with Jackson. Excel (Apache POI) is what non-technical stakeholders like, but it\'s binary and harder to review in pull requests.' },
  ],
}
