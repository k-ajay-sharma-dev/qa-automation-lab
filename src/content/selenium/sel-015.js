export default {
  id: 'sel-015',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Web tables: find a row by text, read a column, verify sorting across pages',
  level: 'ADVANCED',
  tags: ['tables', 'xpath', 'pagination', 'sorting'],
  estMinutes: 30,
  scenario: `HR-admin bug HRA-77: "Clicking the Salary header doesn't sort numerically" and "Edit opens the wrong employee when the table is sorted". The manual check takes 15 minutes per release because the table is paginated. Automate it on \`table.html\`: find an employee's row by name (wherever it is), click *that row's* Edit button, and verify Salary sorts numerically.`,
  description: `On \`http://localhost:5180/practice-site/table.html\`:

1. Write \`int columnIndex(String header)\` that reads the \`<th>\` texts and returns the 1-based index of a header (don't hard-code \`td[4]\`).
2. Write \`WebElement findRowByName(String name)\` that searches the current page and clicks **Next ›** (\`#next-page\`, disabled on the last page) until the row is found (fail clearly if not found on any page).
3. Click the **Edit** button *inside that row* (search within the row element: \`row.findElement(...)\`) for **Hannah Muller** (page 2); assert \`#edit-name\` in the edit panel shows her name.
4. Click the **Salary** header, then read the Salary column on the current page, parse to numbers, assert ascending order.

**Rules**: no absolute XPath, no hard-coded row numbers; search inside a row with a *relative* locator (\`.//\`), no \`Thread.sleep\`. The table is \`#employee-table\` (15 employees, 5 per page).`,
  hints: [
    'XPath for a row containing a cell with exact text: //table[@id=\'employee-table\']/tbody/tr[td[normalize-space()=\'Hannah Muller\']]',
    'Inside a row, start XPath with a dot: row.findElement(By.xpath(".//button[normalize-space()=\'Edit\']"))',
    'Column cells: By.cssSelector("#employee-table tbody tr td:nth-child(" + idx + ")")',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

public class EmployeeTableTest extends BaseTest {

    private static final By HEADERS = By.cssSelector("#employee-table thead th");
    private static final By NEXT = By.id("next-page");

    @Test
    public void editAndSort() {
        driver.get("http://localhost:5180/practice-site/table.html");
        // brittle: row 3, column 5 only works for today's data on page 1
        driver.findElement(By.xpath("/html/body/main/section/table/tbody/tr[3]/td[5]/button")).click();
        // TODO: columnIndex, findRowByName, salary sort check
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
import java.util.List;
import java.util.stream.Collectors;

public class EmployeeTableTest extends BaseTest {

    private static final By HEADERS = By.cssSelector("#employee-table thead th");
    private static final By ROWS = By.cssSelector("#employee-table tbody tr");
    private static final By NEXT = By.id("next-page");
    private static final By EDIT_NAME = By.id("edit-name");
    private static final By CANCEL_EDIT = By.id("cancel-edit");

    private WebDriverWait wait;

    @Test
    public void editAndSort() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/table.html");

        WebElement row = findRowByName("Hannah Muller");
        row.findElement(By.xpath(".//button[normalize-space()='Edit']")).click();
        WebElement editName = wait.until(ExpectedConditions.visibilityOfElementLocated(EDIT_NAME));
        Assert.assertEquals(editName.getDomProperty("value"), "Hannah Muller");
        driver.findElement(CANCEL_EDIT).click();

        int salaryCol = columnIndex("Salary");
        driver.findElements(HEADERS).get(salaryCol - 1).click();

        By salaryCells = By.cssSelector("#employee-table tbody tr td:nth-child(" + salaryCol + ")");
        List<Double> salaries = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(salaryCells))
                .stream()
                .map(td -> Double.parseDouble(td.getText().replaceAll("[^0-9.]", "")))
                .collect(Collectors.toList());

        List<Double> sorted = new ArrayList<>(salaries);
        sorted.sort(null);
        Assert.assertEquals(salaries, sorted, "Salary column is not sorted numerically");
    }

    private int columnIndex(String header) {
        List<WebElement> headers = driver.findElements(HEADERS);
        for (int i = 0; i < headers.size(); i++) {
            if (headers.get(i).getText().trim().equalsIgnoreCase(header)) {
                return i + 1; // nth-child / XPath indexes are 1-based
            }
        }
        throw new IllegalArgumentException("No column '" + header + "'");
    }

    private WebElement findRowByName(String name) {
        By rowLocator = By.xpath("//table[@id='employee-table']/tbody/tr[td[normalize-space()='" + name + "']]");
        while (true) {
            List<WebElement> matches = driver.findElements(rowLocator);
            if (!matches.isEmpty()) {
                return matches.get(0);
            }
            List<WebElement> next = driver.findElements(NEXT);
            if (next.isEmpty() || !next.get(0).isEnabled()) {
                throw new AssertionError("Employee '" + name + "' not found on any page");
            }
            WebElement firstRow = driver.findElement(ROWS);
            next.get(0).click();
            wait.until(ExpectedConditions.stalenessOf(firstRow)); // page re-rendered
        }
    }
}
`,
  checks: [
    { label: 'Locates a row by its cell text', pattern: 'tr\\s*\\[\\s*td\\s*\\[\\s*(normalize-space\\(\\)|text\\(\\)|\\.)\\s*=|tr\\[.*contains\\(', hint: '//tbody/tr[td[normalize-space()=\'Name\']]' },
    { label: 'Searches inside the row with a relative XPath', pattern: '\\w+\\.findElement\\s*\\(\\s*By\\.xpath\\s*\\(\\s*"\\.//', hint: 'row.findElement(By.xpath(".//button..."))' },
    { label: 'Finds the column index from the headers', pattern: 'int\\s+columnIndex\\s*\\(', hint: 'Read th texts to compute the index' },
    { label: 'Handles pagination', pattern: 'NEXT[\\s\\S]*\\.click\\s*\\(', hint: 'Click Next until the row is found' },
    { label: 'Checks numeric sort against a sorted copy', pattern: '(Double|Integer|Long|BigDecimal)\\.(parseDouble|parseInt|parseLong|valueOf)|new\\s+BigDecimal', hint: 'Parse salaries to numbers before sorting' },
    { label: 'No absolute XPath', pattern: '"/html', mustNot: true, hint: 'Absolute XPaths break on any layout change' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for staleness of the old rows after paging' },
  ],
  explanation: `Tables are where brittle locators hurt most. The robust toolkit:

- **Row by content**: \`//tbody/tr[td[normalize-space()='Hannah Muller']]\` — "the \`tr\` that has a \`td\` with this text". \`normalize-space()\` trims and collapses whitespace.
- **Scope inside the row**: \`row.findElement(By.xpath(".//button..."))\`. The leading **dot** is essential: \`//button\` (no dot) searches the *whole document* even when called on an element, so you'd click the first Edit button on the page — exactly bug HRA-77's symptom in your test.
- **Column by header**: compute the index from \`<th>\` texts, then use \`td:nth-child(n)\` / \`td[n]\` (both 1-based). Adding a column no longer breaks the test.
- **Pagination**: loop with \`findElements(NEXT)\` (no exception when missing), stop when the button is gone/disabled, and after clicking wait for **\`stalenessOf\`** an old row — proof the table re-rendered, otherwise you'd read page 1 again.
- **Sort check**: parse to numbers (\`"\$85,000"\` → 85000) — string order puts 100000 before 95000.

A data-driven variant would read the whole table into \`List<Map<String,String>>\` keyed by header, which makes assertions read like the requirements.`,
  mistakes: [
    'Using //button inside row.findElement — the XPath escapes the row and hits the first button in the document.',
    'Hard-coding td[3] for Salary; a new column before it (e.g. "Location") breaks every test.',
    'Comparing salaries as strings.',
    'Clicking Next and immediately reading rows — still the old page.',
  ],
  interview: [
    { q: 'How do you click a button in a specific table row?', a: 'Locate the row by unique cell text (XPath tr[td[normalize-space()=...]]), then search inside it with a relative locator: row.findElement(By.xpath(".//button[...]")) or a CSS selector.' },
    { q: 'How do you handle a paginated table?', a: 'Loop: search the current page with findElements; if not found and Next is enabled, click Next and wait for the old rows to go stale; stop with a clear failure on the last page.' },
    { q: 'Why does .// matter?', a: 'XPath starting with // is absolute to the document root even when called from an element; .// makes it relative to the current element.' },
  ],
}
