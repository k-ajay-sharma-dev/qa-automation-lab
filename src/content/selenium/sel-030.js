export default {
  id: 'sel-030',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Read a paginated table into data and reconcile it with the counter',
  level: 'ADVANCED',
  tags: ['tables', 'pagination', 'data-extraction', 'collections'],
  estMinutes: 30,
  scenario: `Finance found that the HR directory export listed 14 employees while the screen said 15 — someone was being dropped at a page boundary. Before the export is fixed, HR wants a UI-level check that the directory itself is complete and consistent: every page read, no duplicates, totals matching the counter, and the search filter returning only matching rows. Clicking through three pages by hand and ticking names on paper takes 20 minutes per release. \`table.html\` shows 5 employees per page with a \`#next-page\` button and a "Page X of Y" label in \`#page-info\`.`,
  description: `On \`http://localhost:5180/practice-site/table.html\`:

1. Write \`List<Map<String, String>> readAllRows()\`:
   - read the header texts from \`#employee-table thead th\` (skip the empty **Action** column),
   - on each page, turn every \`tbody tr\` into a \`Map\` *header → cell text*,
   - if \`#next-page\` is disabled stop; otherwise remember \`#page-info\`'s text, click Next and **wait until that text changes** before reading again.
2. From the start page: assert the number of rows equals the total in \`#row-count\` ("Showing 1–5 of **15** employees" — parse the number after "of").
3. Assert names are unique (a \`Set\` has the same size as the list).
4. Assert exactly **4** employees are in Engineering and **11** are Active.
5. Type \`QA\` into \`#table-search\`, wait for \`of 3 employees\`, read all rows again and assert every row's Department is \`QA\`.

**Rules**: build the maps from the header texts (no fixed \`td[2]\` positions); wait for the page change instead of sleeping; no absolute XPath.`,
  hints: [
    'String before = driver.findElement(PAGE_INFO).getText(); next.click(); wait.until(d -> !d.findElement(PAGE_INFO).getText().equals(before));',
    'row.findElements(By.tagName("td")) gives the cells in the same order as the headers.',
    'Parse the total with text.substring(text.lastIndexOf("of ") + 3).replaceAll("[^0-9]", "")',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.List;

public class DirectoryCompletenessTest extends BaseTest {

    private static final By ROWS = By.cssSelector("#employee-table tbody tr");

    @Test
    public void directoryIsComplete() {
        driver.get("http://localhost:5180/practice-site/table.html");
        List<String> names = new ArrayList<>();
        for (WebElement row : driver.findElements(ROWS)) {
            names.add(row.findElement(By.xpath("./td[1]")).getText());
        }
        Assert.assertEquals(names.size(), 15); // only page 1 was read: 5
        // TODO: read every page into maps, reconcile with the counter
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DirectoryCompletenessTest extends BaseTest {

    private static final By HEADERS = By.cssSelector("#employee-table thead th");
    private static final By ROWS = By.cssSelector("#employee-table tbody tr");
    private static final By NEXT = By.id("next-page");
    private static final By PAGE_INFO = By.id("page-info");
    private static final By ROW_COUNT = By.id("row-count");
    private static final By SEARCH = By.id("table-search");

    private WebDriverWait wait;

    @Test
    public void directoryIsCompleteAndConsistent() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/table.html");

        int expectedTotal = totalFromCounter();
        List<Map<String, String>> employees = readAllRows();

        Assert.assertEquals(employees.size(), expectedTotal, "Rows read vs counter");

        Set<String> names = new HashSet<>();
        for (Map<String, String> e : employees) {
            names.add(e.get("Name"));
        }
        Assert.assertEquals(names.size(), employees.size(), "Duplicate names across pages: " + employees);

        long engineering = employees.stream().filter(e -> e.get("Department").equals("Engineering")).count();
        long active = employees.stream().filter(e -> e.get("Status").equals("Active")).count();
        Assert.assertEquals(engineering, 4L, "Engineering head count");
        Assert.assertEquals(active, 11L, "Active employees");

        driver.findElement(SEARCH).sendKeys("QA");
        wait.until(ExpectedConditions.textToBePresentInElementLocated(ROW_COUNT, "of 3 employees"));
        List<Map<String, String>> qa = readAllRows();
        Assert.assertEquals(qa.size(), 3);
        for (Map<String, String> e : qa) {
            Assert.assertEquals(e.get("Department"), "QA", "Search returned a non-QA row: " + e);
        }
    }

    private List<Map<String, String>> readAllRows() {
        List<String> headers = new ArrayList<>();
        for (WebElement th : driver.findElements(HEADERS)) {
            headers.add(th.getText().trim());
        }

        List<Map<String, String>> all = new ArrayList<>();
        while (true) {
            for (WebElement row : driver.findElements(ROWS)) {
                List<WebElement> cells = row.findElements(By.tagName("td"));
                Map<String, String> data = new LinkedHashMap<>();
                for (int i = 0; i < cells.size() && i < headers.size(); i++) {
                    if (!headers.get(i).isEmpty() && !headers.get(i).equals("Action")) {
                        data.put(headers.get(i), cells.get(i).getText().trim());
                    }
                }
                all.add(data);
            }

            WebElement next = driver.findElement(NEXT);
            if (!next.isEnabled()) {
                return all;
            }
            String before = driver.findElement(PAGE_INFO).getText();
            next.click();
            wait.until(d -> !d.findElement(PAGE_INFO).getText().equals(before));
        }
    }

    private int totalFromCounter() {
        String text = wait.until(ExpectedConditions.visibilityOfElementLocated(ROW_COUNT)).getText();
        return Integer.parseInt(text.substring(text.lastIndexOf("of ") + 3).replaceAll("[^0-9]", ""));
    }
}
`,
  checks: [
    { label: 'Builds header → cell maps', pattern: 'Map\\s*<\\s*String\\s*,\\s*String\\s*>', hint: 'List<Map<String, String>> rows' },
    { label: 'Reads header texts', pattern: 'thead\\s+th|HEADERS', hint: 'driver.findElements(By.cssSelector("#employee-table thead th"))' },
    { label: 'Stops when Next is disabled', pattern: '!\\s*\\w+(\\.get\\(0\\))?\\.isEnabled\\s*\\(', hint: 'if (!next.isEnabled()) return all;' },
    { label: 'Waits for the page to change after clicking Next', pattern: '(until\\s*\\(\\s*\\(?\\s*\\w+\\s*\\)?\\s*->[\\s\\S]*?PAGE_INFO|stalenessOf|textToBe\\s*\\(\\s*PAGE_INFO)', hint: 'wait.until(d -> !d.findElement(PAGE_INFO).getText().equals(before))' },
    { label: 'Checks for duplicates with a Set', pattern: 'Set\\s*<\\s*String\\s*>', hint: 'Set<String> names = new HashSet<>();' },
    { label: 'Reconciles with the counter', pattern: 'ROW_COUNT|row-count', hint: 'Parse the total from #row-count' },
    { label: 'No hard-coded cell positions or sleeps', pattern: '(td\\[\\d\\]|nth-child\\(\\d\\)|Thread\\.sleep)', mustNot: true, hint: 'Map cells by header; wait instead of sleeping' },
  ],
  explanation: `Turning a paginated table into **data** (\`List<Map<String, String>>\`) separates two jobs: *reading the UI* (one helper) and *checking business rules* (plain Java on collections). The assertions then read like the HR requirement: totals match, no duplicates, 4 engineers, 11 active.

**Keyed by header**: cells are mapped by the \`<th>\` text, so a new "Location" column or a re-ordered table does not break the test — \`e.get("Department")\` still works. The Action column is skipped because it holds a button, not data.

**Page boundary bugs** — the original defect — are exactly what this catches. Reading only \`findElements(ROWS)\` once gives you page 1; clicking Next and reading immediately can give you page 1 *twice* (duplicates!) because the table had not re-rendered yet. The wait on \`#page-info\` changing is the proof that a new page is shown. \`stalenessOf(firstRow)\` is an equally good signal.

**Reconcile with an independent number**: the counter text is the app's own claim. Comparing what you *read* against what the app *says* is a cheap consistency check that has found real paging bugs (off-by-one in the last page, a row lost when the page size changes).

**Search**: after typing, the row counter text is the reliable "filter applied" signal; then the same \`readAllRows()\` works on the filtered result, which here fits on one page.`,
  mistakes: [
    'Clicking Next and reading rows immediately — you read the old page again and count duplicates.',
    'Indexing cells by position (td[3]) — a new column silently shifts every value.',
    'Comparing the count with a hard-coded 15 instead of the counter — the test breaks when HR adds an employee.',
    'Looping on "while Next is displayed" when the app disables (not hides) the button on the last page — endless loop.',
  ],
  interview: [
    { q: 'How do you read a whole paginated table?', a: 'Read headers once, then loop: map each row of the current page to header → value, stop when Next is disabled or missing, otherwise click Next and wait for proof of the page change (page label text or stalenessOf an old row).' },
    { q: 'Why convert the table to a List<Map<String,String>>?', a: 'It decouples locating from asserting. Business checks become ordinary Java (streams, sets, counts), column order changes do not matter, and the same reader works for any table.' },
    { q: 'How would you make this faster on a 50-page table?', a: 'Prefer checking the data through the API or database and keep the UI test to a sample (first/last page, boundaries). If the UI offers a page-size selector, set it to the maximum first.' },
  ],
}
