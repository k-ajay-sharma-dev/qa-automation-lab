export default {
  id: 'dbg-016',
  category: 'debugging',
  kind: 'code',
  title: 'StaleElementReferenceException after sorting and searching the employee table',
  level: 'BEGINNER',
  tags: ['StaleElementReferenceException', 'web-table', 'sorting', 'search', 'waits'],
  estMinutes: 15,
  scenario: `The back-office team wants two checks on the ShopEasy **Employee directory** (table.html): "clicking the *Salary* header sorts the lowest salary first" and "searching for *QA* shows only the QA team". Your new \`EmployeeTableTest\` fails on both, every single run, with the same exception. A colleague suggests catching the exception and retrying three times. You want to understand it first.`,
  description: `Jenkins console:

\`\`\`text
[ERROR] lowestSalaryFirst(com.shopeasy.tests.EmployeeTableTest)  Time elapsed: 1.874 s  <<< ERROR!
org.openqa.selenium.StaleElementReferenceException: stale element reference: stale element not found in the current frame
  (Session info: chrome=126.0.6478.126)
For documentation on this error, please visit: https://www.selenium.dev/documentation/webdriver/troubleshooting/errors#stale-element-reference-exception
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Element: [[ChromeDriver: chrome on linux (7d3e9a...)] -> css selector: #employee-table tbody tr td:first-child]
	at org.openqa.selenium.remote.RemoteWebElement.execute(RemoteWebElement.java:223)
	at org.openqa.selenium.remote.RemoteWebElement.getText(RemoteWebElement.java:126)
	at com.shopeasy.pages.EmployeeTablePage.namesSortedBySalary(EmployeeTablePage.java:38)
	at com.shopeasy.tests.EmployeeTableTest.lowestSalaryFirst(EmployeeTableTest.java:21)
\`\`\`

\`searchFindsQaTeam\` fails the same way at \`EmployeeTablePage.namesMatching\`.

**Diagnose:** the table's script rebuilds the whole \`<tbody>\` (\`tbody.innerHTML = ''\` and new rows) on every sort click and on every key typed into \`#table-search\`. The test grabbed the name cells **before** the click/typing and read them **after** — those \`WebElement\`s point at rows that were thrown away.

**Fix \`EmployeeTablePage\`:**
- Act first (click the header / type the query), then **find the cells again**.
- Wait for proof that the table re-rendered before reading: \`attributeToBe(SALARY_HEADER, "aria-sort", "ascending")\` for the sort, and/or \`stalenessOf(oldFirstRow)\`.
- **Rules:** no \`Thread.sleep\`, no \`catch (StaleElementReferenceException ...)\` retry loop.`,
  hints: [
    'The Element: line in the trace names the locator — the cells were found with it BEFORE the click.',
    'A WebElement is a pointer to one DOM node. tbody.innerHTML = \'\' destroys every row node, so every old pointer dies.',
    'Keep a reference to the old first row, act, wait.until(ExpectedConditions.stalenessOf(oldRow)), then driver.findElements(NAME_CELLS).',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

public class EmployeeTablePage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By NAME_CELLS = By.cssSelector("#employee-table tbody tr td:first-child");
    private final By FIRST_ROW = By.cssSelector("#employee-table tbody tr");
    private final By SALARY_HEADER = By.cssSelector("#employee-table th[data-sort='salary']");
    private final By SEARCH_BOX = By.id("table-search");

    public EmployeeTablePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public List<String> namesSortedBySalary() {
        List<WebElement> cells = driver.findElements(NAME_CELLS);
        driver.findElement(SALARY_HEADER).click();
        List<String> names = new ArrayList<>();
        for (WebElement cell : cells) {
            names.add(cell.getText()); // line 38 - StaleElementReferenceException
        }
        return names;
    }

    public List<String> namesMatching(String query) {
        List<WebElement> cells = driver.findElements(NAME_CELLS);
        driver.findElement(SEARCH_BOX).sendKeys(query);
        List<String> names = new ArrayList<>();
        for (WebElement cell : cells) {
            names.add(cell.getText());
        }
        return names;
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class EmployeeTablePage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By NAME_CELLS = By.cssSelector("#employee-table tbody tr td:first-child");
    private final By FIRST_ROW = By.cssSelector("#employee-table tbody tr");
    private final By SALARY_HEADER = By.cssSelector("#employee-table th[data-sort='salary']");
    private final By SEARCH_BOX = By.id("table-search");

    public EmployeeTablePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public List<String> namesSortedBySalary() {
        WebElement oldFirstRow = driver.findElement(FIRST_ROW);
        driver.findElement(SALARY_HEADER).click();
        // proof the sort finished: header state changed AND the old rows were thrown away
        wait.until(ExpectedConditions.attributeToBe(SALARY_HEADER, "aria-sort", "ascending"));
        wait.until(ExpectedConditions.stalenessOf(oldFirstRow));
        return readNames();
    }

    public List<String> namesMatching(String query) {
        WebElement oldFirstRow = driver.findElement(FIRST_ROW);
        driver.findElement(SEARCH_BOX).sendKeys(query);
        wait.until(ExpectedConditions.stalenessOf(oldFirstRow));
        return readNames();
    }

    // always locate the cells fresh - never reuse elements found before the table changed
    private List<String> readNames() {
        return driver.findElements(NAME_CELLS).stream()
                .map(WebElement::getText)
                .collect(Collectors.toList());
    }
}
`,
  checks: [
    { label: 'Does not read a list captured before the click/typing', pattern: 'List<WebElement>\\s+(\\w+)\\s*=\\s*driver\\.findElements\\(\\s*NAME_CELLS\\s*\\);[^}]*?(click|sendKeys)\\([^}]*?for\\s*\\(\\s*WebElement\\s+\\w+\\s*:\\s*\\1', flags: 'ms', mustNot: true, hint: 'Find the cells AFTER the table has re-rendered' },
    { label: 'Re-locates the name cells after acting', pattern: '(click|sendKeys)\\([^;]*\\);[\\s\\S]*findElements\\s*\\(\\s*NAME_CELLS', flags: 'ms', hint: 'driver.findElements(NAME_CELLS) after the click / sendKeys' },
    { label: 'Waits for proof the table re-rendered', pattern: '(stalenessOf|attributeToBe)\\s*\\(', hint: 'wait.until(ExpectedConditions.stalenessOf(oldFirstRow))' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for a condition, not for time' },
    { label: 'No catch-and-retry on stale elements', pattern: 'catch\\s*\\(\\s*StaleElementReferenceException', mustNot: true, hint: 'A retry loop hides the real problem: elements found too early' },
  ],
  explanation: `**Root cause:** the table on table.html is rendered by JavaScript. Every sort click and every keystroke in the search box runs \`render()\`, which empties \`<tbody>\` and builds brand-new \`<tr>\` nodes. The rows *look* identical, but they are new objects. The \`List<WebElement>\` captured before the click is a list of pointers to the deleted rows → \`StaleElementReferenceException\` on the first \`getText()\`.

**How the trace told you:** the \`Element:\` line shows the locator the stale element was originally found with (\`#employee-table tbody tr td:first-child\`). Combine that with the first frame in your code (\`namesSortedBySalary\`, line 38) and you can see the find happened *before* the click.

**The fix pattern for any re-rendering list or table:**
1. Keep a reference to one old node (the first row).
2. Act (click the header, type the query).
3. Wait for proof: the old node went stale (\`stalenessOf\`) and/or the UI shows the new state (\`aria-sort="ascending"\`, row counter text).
4. Find the elements **fresh** and read them.

With the fix, sorting by salary gives *Fatima Khan* ($57,000) first, and searching "QA" leaves Chen Wei, Rahul Verma and Noah Garcia.

**Why not retry on stale?** A retry loop sometimes reads the new rows and sometimes reads half-old data, and it hides the design mistake. Waiting for a clear condition is deterministic.`,
  mistakes: [
    'Catching StaleElementReferenceException and retrying three times — slow and still racy.',
    'Storing the rows in a page-object field once and reusing them in every method.',
    'Reading the cells immediately after the click without any proof that the re-render finished.',
    'Changing the locator because "it worked before the click" — the locator was always right.',
  ],
  interview: [
    { q: 'You sort a web table and get StaleElementReferenceException. Why?', a: 'Because sorting re-renders the table: the old row nodes are removed and new ones created, so WebElements found before the sort point at nodes that no longer exist. I keep By locators, perform the sort, wait for a condition that proves it finished — the header aria-sort attribute or stalenessOf an old row — and then locate the cells again.' },
    { q: 'How do you verify that a column is sorted correctly?', a: 'I read the column values after the sort into a List, convert them to the right type (numbers for salary, dates for dates), make a copy, sort the copy in Java with the expected comparator, and assert both lists are equal. Comparing as strings would sort "$100,000" before "$57,000".' },
    { q: 'What is the difference between stalenessOf and invisibilityOf?', a: 'stalenessOf waits until a specific element is detached from the DOM — useful to prove a re-render happened. invisibilityOf waits until an element is hidden or gone, which suits spinners and overlays. For a re-rendered table, staleness of an old row is the stronger proof.' },
  ],
}
