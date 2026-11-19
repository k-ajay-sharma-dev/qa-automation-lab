export default {
  id: 'pom-023',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'EmployeeTable: search, sort and read every page',
  level: 'ADVANCED',
  tags: ['pom', 'tables', 'pagination', 'sorting', 'stale-element'],
  estMinutes: 30,
  scenario: `Defect *BO-77*: "Sorting by Salary only sorts the current page". It was fixed, and now the back-office team wants
regression tests for \`table.html\`: *search "QA" shows only QA staff*, *sorting by Salary orders all 15 employees,
not just the 5 on screen*. The table shows 5 rows per page (\`#prev-page\`, \`#next-page\`, \`#page-info\` "Page 1 of 3"),
and sorting or searching re-renders \`tbody\` — the old \`<tr>\` elements are thrown away.`,
  description: `Write \`EmployeeTablePage\` with search, sort and **all-pages** reading.

**Rules**
- Private locators: \`#table-search\`, \`#employee-table tbody tr\`, \`#next-page\`, \`#page-info\`, and a sortable header
  by its \`data-sort\` key (\`#employee-table th[data-sort='salary']\`) built with \`String.format\`.
- \`search(String text)\` types into the search box and returns \`this\`.
- \`sortBy(String key)\` clicks the header **and waits until the header's \`aria-sort\` is \`ascending\` or \`descending\`**; returns \`this\`.
- \`getColumnOnAllPages(int columnIndex)\` returns \`List<String>\` with that column for **every page**: read the current
  page, and while \`#next-page\` is enabled click it and **wait for the old first row to go stale** before reading again.
- No \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.pages;

import java.util.ArrayList;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class EmployeeTablePage extends BasePage {
    private final By rows = By.cssSelector("#employee-table tbody tr");

    public EmployeeTablePage(WebDriver driver) { super(driver); }

    public void sortBySalary() throws InterruptedException {
        driver.findElement(By.xpath("//th[3]")).click();
        Thread.sleep(1000);
    }

    public List<String> getSalaries() {
        List<String> out = new ArrayList<>();
        for (WebElement row : driver.findElements(rows)) {
            out.add(row.findElements(By.tagName("td")).get(2).getText());
        }
        return out;   // only page 1!
    }
}
`,
  solution: `package com.shopeasy.pages;

import java.util.ArrayList;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class EmployeeTablePage extends BasePage {
    private static final String SORT_HEADER = "#employee-table th[data-sort='%s']";

    private final By searchBox  = By.id("table-search");
    private final By rows       = By.cssSelector("#employee-table tbody tr");
    private final By nextButton = By.id("next-page");
    private final By pageInfo   = By.id("page-info");

    public EmployeeTablePage(WebDriver driver) { super(driver); }

    private By header(String key) {
        return By.cssSelector(String.format(SORT_HEADER, key));
    }

    public EmployeeTablePage search(String text) {
        WebElement firstRow = driver.findElement(rows);
        type(searchBox, text);
        wait.until(ExpectedConditions.stalenessOf(firstRow));
        return this;
    }

    public EmployeeTablePage sortBy(String key) {
        click(header(key));
        wait.until(ExpectedConditions.or(
                ExpectedConditions.attributeToBe(header(key), "aria-sort", "ascending"),
                ExpectedConditions.attributeToBe(header(key), "aria-sort", "descending")));
        return this;
    }

    public String getPageInfo() {
        return getText(pageInfo);
    }

    public List<String> getColumnOnAllPages(int columnIndex) {
        List<String> values = new ArrayList<>(readColumn(columnIndex));
        while (driver.findElement(nextButton).isEnabled()) {
            WebElement oldFirstRow = driver.findElement(rows);
            click(nextButton);
            wait.until(ExpectedConditions.stalenessOf(oldFirstRow));
            values.addAll(readColumn(columnIndex));
        }
        return values;
    }

    private List<String> readColumn(int columnIndex) {
        List<String> out = new ArrayList<>();
        for (WebElement row : driver.findElements(rows)) {
            List<WebElement> cells = row.findElements(By.tagName("td"));
            if (cells.size() > columnIndex) {
                out.add(cells.get(columnIndex).getText().trim());
            }
        }
        return out;
    }
}

// Test for BO-77 (the test, not the page, knows what "sorted" means):
// List<Integer> salaries = table.sortBy("salary").getColumnOnAllPages(2).stream()
//         .map(s -> Integer.parseInt(s.replaceAll("[$,]", "")))
//         .collect(Collectors.toList());
// List<Integer> expected = new ArrayList<>(salaries);
// Collections.sort(expected);
// Assert.assertEquals(salaries.size(), 15, "All employees across pages");
// Assert.assertEquals(salaries, expected, "Salaries ascending across all pages");
`,
  checks: [
    { label: 'Header locator built from the data-sort key', pattern: 'String\\.format\\s*\\([\\s\\S]{0,80}?\\)|data-sort=[\'"]?%s', hint: 'String.format("#employee-table th[data-sort=\'%s\']", key)' },
    { label: 'search(String) returns this', pattern: 'public\\s+EmployeeTablePage\\s+search\\s*\\(\\s*String\\s+\\w+\\s*\\)[\\s\\S]*?return\\s+this', hint: 'public EmployeeTablePage search(String text) { ...; return this; }' },
    { label: 'sortBy waits on aria-sort', pattern: 'sortBy\\s*\\([\\s\\S]*?(attributeToBe|attributeContains|domAttributeToBe)\\s*\\([^;]*aria-sort', hint: 'wait.until(ExpectedConditions.attributeToBe(header(key), "aria-sort", "ascending"))' },
    { label: 'Loops while Next is enabled', pattern: 'while\\s*\\([^;{]*?isEnabled\\s*\\(\\s*\\)', hint: 'while (driver.findElement(nextButton).isEnabled()) { ... }' },
    { label: 'Waits for the old rows to go stale', pattern: 'stalenessOf\\s*\\(', hint: 'Keep the old first row, click Next, then wait.until(ExpectedConditions.stalenessOf(oldFirstRow))' },
    { label: 'No hard-coded header index', pattern: 'th\\[\\d+\\]', mustNot: true, hint: 'Use the data-sort attribute, not th[3]' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for aria-sort / staleness instead' },
  ],
  hints: [
    'The sort header tells you when it is done: aria-sort changes from "none" to "ascending"/"descending".',
    'Re-rendering replaces <tr> elements. Grab the old first row before the click; when it is stale, the new page is in.',
    'Pager loop: read page → while (next enabled) { remember first row; click next; wait stale; read page }',
  ],
  explanation: `A table with search, sort and paging is three moving parts, and each needs a **real "done" signal**:

| Action | How you know it finished |
|---|---|
| sort | the header's \`aria-sort\` becomes \`ascending\`/\`descending\` |
| next page / search | the old rows are removed → \`stalenessOf(oldRow)\` |
| last page | \`#next-page\` is disabled |

\`stalenessOf\` is the key technique: you hold a reference to an element you *know* will be replaced, and wait until
the DOM throws it away. That is precise, fast, and needs no guessing like \`Thread.sleep(1000)\`.

Why read **all pages**? Defect BO-77 was exactly "sorted only the current page". Checking page 1 alone would pass
while the bug is back. Your manual instinct (*"did you check page 2?"*) belongs in the automation too.

Design notes:
- The page returns raw strings; the **test** decides what "sorted ascending" means (parse \`$85,000\` → 85000, compare
  with a sorted copy). Sorting rules are business expectations, not page logic.
- \`readColumn\` skips the \`No employees match your search\` row (it has a single \`td\`).
- For huge tables, prefer an API/DB check for completeness and keep the UI test to one page plus pager behaviour.`,
  mistakes: [
    'Clicking th[3] — breaks when columns are re-ordered; use data-sort or header text.',
    'Reading rows immediately after clicking Next, getting the old page (or a StaleElementReferenceException mid-loop).',
    'Checking that page 1 is sorted and concluding the whole table is sorted.',
    'Comparing "$9,000" and "$85,000" as strings — "$9,000" sorts after "$85,000" alphabetically.',
  ],
  interview: [
    { q: 'How do you wait for a table to refresh after sorting or paging?', a: 'Use a signal the UI gives: an attribute like aria-sort, a page indicator changing, or hold a reference to an old row and wait for stalenessOf it. Never a fixed sleep.' },
    { q: 'How would you verify sorting across a paginated table?', a: 'Collect the column from every page by clicking Next until it is disabled (waiting for each re-render), convert the values to the right type, and compare the list with a sorted copy. Also check the row count matches the total.' },
    { q: 'What does stalenessOf do?', a: 'It waits until the given WebElement is no longer attached to the DOM. It is ideal for "the old content has been replaced" after an action that re-renders part of the page.' },
  ],
}
