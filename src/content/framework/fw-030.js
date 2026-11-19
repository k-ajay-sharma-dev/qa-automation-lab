export default {
  id: 'fw-030',
  category: 'framework',
  kind: 'quiz',
  title: 'DataProvider sources: inline, Excel, JSON — and the traps in each',
  level: 'INTERMEDIATE',
  tags: ['testng', 'dataprovider', 'data-driven', 'excel', 'apache-poi', 'json'],
  estMinutes: 12,
  scenario: `The ShopEasy business analyst keeps the checkout test data in an Excel sheet: first name, last name and postal
code per country (e.g. Asha Rao, 560001 for India; Lars Lock, 11151 for Sweden). She wants to add rows without asking
a developer. Meanwhile the login DataProvider has 6 inline rows that a teammate wants to "move to Excel too, for
consistency". You have to decide where each data set should live and review the reader code.`,
  description: 'Choose the best answer for each design or debugging question.',
  questions: [
    {
      q: 'The login test has 6 rows (valid user, `locked_out_user`, wrong password, empty username, …) that only change when the login rules change. Where should they live?',
      options: [
        'Inline in a @DataProvider returning Object[][], next to the test',
        'In an Excel file, because all data must be external',
        'In a database table',
        'Hard-coded in six separate @Test methods',
      ],
      answer: 0,
      why: 'Small, stable data owned by the test author is clearest inline: one glance shows the cases, it is reviewed in the same PR, and there is no file I/O to break. Externalise when non-developers maintain the data, the set is large, or several tests share it.',
    },
    {
      q: `The Excel reader returns postal code \`560001.0\` for India and the checkout validation fails. What is the fix?

\`\`\`java
String postal = String.valueOf(row.getCell(2).getNumericCellValue());
\`\`\``,
      options: [
        'Ask the analyst to type the postal codes with a trailing space',
        'Use Apache POI\'s DataFormatter: new DataFormatter().formatCellValue(cell) returns the text as Excel displays it',
        'Use Math.round on every cell',
        'Switch to Thread.sleep before reading the cell',
      ],
      answer: 1,
      why: 'Excel stores numbers as doubles, so numeric cells come back as 560001.0. DataFormatter returns the displayed value ("560001") for any cell type — strings, numbers, dates. Rounding would also destroy leading zeros and decimal prices.',
    },
    {
      q: 'The provider lives in a separate class `CheckoutData` so several test classes can share it. What does the test need?',
      options: [
        '@Test(dataProvider = "checkoutData") is enough; TestNG scans all classes',
        '@Test(dataProvider = "checkoutData", dataProviderClass = CheckoutData.class), and the provider method must be static',
        'The test class must extend CheckoutData',
        'A <dataprovider> tag in testng.xml',
      ],
      answer: 1,
      why: 'TestNG only looks in the test class (and its parents) unless you name dataProviderClass. In that external class the @DataProvider method must be static (or the class needs a no-arg constructor in newer versions — static is the safe, common choice).',
    },
    {
      q: 'The JSON file for search tests has 5,000 rows. Loading everything into an Object[][] makes the run slow to start and uses a lot of memory. What can the provider return instead?',
      options: [
        'A String with all rows joined by commas',
        'Iterator<Object[]>, so TestNG pulls rows lazily one at a time',
        'A List<String> of file names',
        'Nothing; TestNG cannot handle more than 1,000 rows',
      ],
      answer: 1,
      why: 'A @DataProvider can return Object[][] or Iterator<Object[]> (also Stream-backed iterators). With an Iterator, rows are produced as the test consumes them — useful for large files or data generated on the fly.',
    },
    {
      q: '`@DataProvider(name = "checkoutData", parallel = true)` with 40 rows. How many rows run at the same time by default, and how do you change it?',
      options: [
        'All 40; it cannot be changed',
        '10 by default; set data-provider-thread-count in testng.xml (or -dataproviderthreadcount)',
        '1; parallel = true is ignored without a Grid',
        'As many as the parallel="methods" thread-count',
      ],
      answer: 1,
      why: 'Parallel data providers use their own pool, default 10, configured by data-provider-thread-count on <suite>. It is separate from thread-count for parallel methods/classes. Each row still needs its own ThreadLocal driver to be safe.',
    },
  ],
  hints: [
    'Ask "who maintains this data and how often does it change?"',
    'Excel numbers are doubles; there is a POI class that formats cells like Excel shows them.',
    'Providers in another class need an extra attribute and a static method.',
  ],
  explanation: `**Choosing a source**

| Source | Good for | Watch out for |
|---|---|---|
| Inline \`Object[][]\` | small, stable, test-author data (login rules) | turning into 200 unreadable rows |
| JSON + Jackson | structured data, nested objects, version control diffs | schema drift — map to a POJO so typos fail loudly |
| Excel + Apache POI | data owned by BAs / business users | numeric cells (use \`DataFormatter\`), binary diffs in git, locked file when open |
| CSV | big flat tables | commas inside values, encoding |

The reviewer's rule: *the source follows the owner.* If the analyst owns checkout data, Excel (or CSV) she can edit is
right; the login matrix the QA engineer owns stays inline. "Consistency" alone is not a reason to move data.

Readers belong in \`utils/\` (\`ExcelReader\`, \`JsonReader\`), providers in a \`dataproviders/\` class with
\`dataProviderClass\`, files in \`src/test/resources/testdata/\` (loaded from the classpath, never from \`C:\\Users\\...\`).`,
  mistakes: [
    'Reading numeric Excel cells with getNumericCellValue and getting 560001.0 or losing leading zeros.',
    'Absolute file paths to test data that only exist on one laptop.',
    'Forgetting dataProviderClass and getting "Method requires 3 parameters but 0 were supplied".',
    'Moving every small data set to Excel "for consistency", making simple tests harder to read.',
  ],
  interview: [
    { q: 'How do you read test data from Excel in your framework?', a: 'An ExcelReader utility using Apache POI: open the workbook from the classpath, iterate rows of a sheet, format every cell with DataFormatter, and return Object[][] (or an Iterator) to a @DataProvider. The file lives in src/test/resources/testdata.' },
    { q: 'When would you not externalise test data?', a: 'When it is small, stable and owned by the test author, like a login decision table. Inline data is easier to read and review, and has no I/O failure modes.' },
  ],
}
