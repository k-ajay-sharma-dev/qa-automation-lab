export default {
  id: 'pom-009',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Page object for a web table: getRowByName',
  level: 'ADVANCED',
  tags: ['pom', 'tables', 'xpath', 'dynamic-data'],
  estMinutes: 25,
  scenario: `ShopEasy's admin \`table.html\` lists employees in \`#employee-table\` (columns: Name, Department, Salary, Status, Action).
The manual regression suite has 12 checks like *"employee Priya Sharma shows Department = Engineering and Status = Active"*.
Users can sort by any column header, so a test that reads "row 3" is wrong as soon as someone clicks a header.`,
  description: `Build \`EmployeeTablePage\` so tests can work with rows **by content**, not by index.

**Rules**
- Private locators for the table rows (\`#employee-table tbody tr\`) and header cells (\`#employee-table thead th\`).
- \`getColumnIndex(String header)\` finds the column position from the header text (so column re-ordering does not break tests).
- \`getRowByName(String name)\` returns the row \`WebElement\` whose *Name* cell matches; throw a clear exception if not found.
- \`getCellValue(String name, String column)\` returns the text of that cell.
- No hard-coded \`tr[3]\` / \`td[4]\` indexes.`,
  starterCode: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class EmployeeTablePage extends BasePage {

    public EmployeeTablePage(WebDriver driver) { super(driver); }

    public String getDepartmentOfThirdEmployee() {
        return driver.findElement(By.xpath("//table[@id='employee-table']/tbody/tr[3]/td[2]")).getText();
    }

    // TODO: getColumnIndex(String header)
    // TODO: getRowByName(String name)
    // TODO: getCellValue(String name, String column)
}
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import java.util.NoSuchElementException;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class EmployeeTablePage extends BasePage {

    private final By rows        = By.cssSelector("#employee-table tbody tr");
    private final By headerCells = By.cssSelector("#employee-table thead th");
    private final By cells       = By.tagName("td");

    public EmployeeTablePage(WebDriver driver) { super(driver); }

    public int getColumnIndex(String header) {
        List<WebElement> headers = driver.findElements(headerCells);
        for (int i = 0; i < headers.size(); i++) {
            // strip the sort arrow (▲/▼) shown after a header is clicked
            if (headers.get(i).getText().replaceAll("[▲▼]", "").trim().equalsIgnoreCase(header)) {
                return i;
            }
        }
        throw new IllegalArgumentException("No column with header: " + header);
    }

    public WebElement getRowByName(String name) {
        wait.until(ExpectedConditions.visibilityOfElementLocated(rows));
        int nameCol = getColumnIndex("Name");
        return driver.findElements(rows).stream()
                .filter(row -> row.findElements(cells).get(nameCol).getText().trim().equals(name))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("No row for employee: " + name));
    }

    public String getCellValue(String name, String column) {
        WebElement row = getRowByName(name);
        return row.findElements(cells).get(getColumnIndex(column)).getText().trim();
    }

    public int getRowCount() {
        return driver.findElements(rows).size();
    }
}

// In the test:
// Assert.assertEquals(table.getCellValue("Priya Sharma", "Department"), "Engineering");
`,
  checks: [
    { label: 'getRowByName returns a WebElement', pattern: 'WebElement\\s+getRowByName\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'public WebElement getRowByName(String name)' },
    { label: 'Column index found from header text', pattern: 'int\\s+getColumnIndex\\s*\\(\\s*String[\\s\\S]*?getText', hint: 'Loop over header cells and compare their text' },
    { label: 'Searches inside the row (row.findElement/s)', pattern: '\\w+\\.findElements?\\s*\\(\\s*(cells|By\\.)', hint: 'row.findElements(By.tagName("td")) scopes the search to that row' },
    { label: 'Clear error when the row is missing', pattern: '(orElseThrow|throw\\s+new\\s+\\w*(Exception|Error))', hint: 'Throw a NoSuchElementException with the name in the message' },
    { label: 'getCellValue(name, column) exists', pattern: 'String\\s+getCellValue\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'Combine getRowByName and getColumnIndex' },
    { label: 'No hard-coded row index', pattern: 'tr\\[\\d+\\]', mustNot: true, hint: 'Find rows by content, not by position' },
  ],
  hints: [
    'Read the header row once and find the position of "Name".',
    'Stream the rows and filter where cell[nameCol] text equals the name.',
    'An XPath alternative: //table[@id=\'employee-table\']//tr[td[normalize-space()=\'%s\']]',
  ],
  explanation: `Tables are where index-based automation dies. The robust recipe:

1. **Find the column by header text** → the test survives column re-ordering.
2. **Find the row by a unique key** (name, order id, email) → survives sorting and new rows.
3. **Search inside the row** (\`row.findElements(...)\`) → never accidentally read another row's cell.
4. **Fail loudly** with the key in the message: "No row for employee: Priya Sharma" beats an IndexOutOfBounds.

The one-line XPath alternative is also fine and faster on big tables:
\`//table[@id='employee-table']//tr[td[normalize-space()='Priya Sharma']]\` — combine it with \`String.format\` (pom-010).

Note: \`table.html\` shows 5 rows per page (\`#pagination\`), so a row on page 2 is not in the DOM until you click
\`#next-page\` (or narrow the list with \`#table-search\`).

Returning a \`WebElement\` row is pragmatic; a more advanced design returns an \`EmployeeRow\` component with
\`getDepartment()\`, \`getStatus()\`, \`clickEdit()\` — the component pattern from pom-007 applied to rows.`,
  mistakes: [
    'Using tr[3]/td[4] which breaks on sorting, paging or new columns.',
    'Calling driver.findElements(td) instead of row.findElements(td), which searches the whole page.',
    'Returning null when the row is missing, causing a NullPointerException far away from the cause.',
    'Not trimming cell text (trailing spaces/newlines break equals).',
  ],
  interview: [
    { q: 'How do you automate a dynamic web table?', a: 'Locate the column index from the header text, find the row by a unique value (via XPath with a text predicate or by filtering rows), then read cells inside that row using a scoped findElement. Avoid fixed row/column indexes.' },
    { q: 'What is the difference between driver.findElement and element.findElement?', a: 'driver.findElement searches the whole document; element.findElement searches only descendants of that element. Note that an XPath starting with // inside element.findElement still searches the whole document; use .// for relative XPath.' },
  ],
}
