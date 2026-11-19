export default {
  slug: 'selenium-smart-locators',
  category: 'selenium',
  order: 4,
  title: 'Smart locators: XPath by text, searching inside a row, web tables and relative locators',
  minutes: 9,
  summary: 'Locate elements that have no stable id — by visible text, relative to a neighbour, or inside a specific table row — and read web tables without hard-coded positions.',
  manualAnalogy: `When you tell a colleague "click the Track button next to order ORD-1043", you are not giving them an id — you are anchoring on something stable they can read, then pointing relative to it. Good locators do the same: anchor on visible, meaningful text or structure, then move to the element you need.`,
  body: `## Why ids are not always enough

Real apps have generated ids (\`btn-8f3a2\` changes on every load — see \`dynamic.html\`), identical buttons repeated in every row, and tables where the data moves between pages. Hard-coding \`td[4]\` or \`/html/body/div[3]/...\` breaks the first time a developer adds a column.

## XPath in five patterns

| Need | XPath |
|---|---|
| Element by exact visible text | \`//button[normalize-space()='Save draft']\` |
| Text contains | \`//p[contains(normalize-space(),'coupon')]\` |
| Parent that *has* a certain child | \`//li[span[normalize-space()='ORD-1043']]\` |
| Element inside that parent | \`//li[span[normalize-space()='ORD-1043']]//button\` |
| Search **inside** an element you already found | \`.//button\` (note the dot) |

\`normalize-space()\` trims and collapses whitespace so stray spaces or line breaks in the HTML do not break your match.

## Searching inside an element: the leading dot

A \`WebElement\` has its own \`findElement\`. That lets you find a container first, then look *only inside it*:

\`\`\`java
WebElement order = driver.findElement(
        By.xpath("//ul[@id='order-list']/li[span[normalize-space()='ORD-1043']]"));
order.findElement(By.xpath(".//button[normalize-space()='Track']")).click();
\`\`\`

The \`.\` in \`.//button\` means "starting from this element". Without the dot, \`//button\` searches the **whole page again** and returns the first Track button on the page — the classic "it clicked the wrong row" bug. CSS selectors called on an element are always relative, so \`order.findElement(By.cssSelector("button"))\` is also safe.

The same idea applies to price lists: scope your CSS to the container you mean (\`#inventory-list .item-price\`) when the same class also appears in a banner elsewhere.

## Web tables

A table is rows (\`<tr>\`) of cells (\`<td>\`) under headers (\`<th>\`). Three habits make table tests robust:

**1. Find a column by its header text, not by number.**

\`\`\`java
List<WebElement> headers = driver.findElements(By.cssSelector("#employee-table thead th"));
int deptIndex = -1;
for (int i = 0; i < headers.size(); i++) {
    if (headers.get(i).getText().trim().startsWith("Department")) {
        deptIndex = i + 1;               // CSS nth-child and XPath are 1-based
        break;
    }
}
\`\`\`

**2. Read a whole column with \`nth-child\`.**

\`\`\`java
By deptCells = By.cssSelector("#employee-table tbody tr td:nth-child(" + deptIndex + ")");
List<String> departments = driver.findElements(deptCells).stream()
        .map(WebElement::getText).toList();
\`\`\`

**3. Find a row by a cell's text, then work inside the row** with the leading-dot rule above.

### Pagination

When the table shows 5 rows per page, "find row X" becomes a loop: look on the current page with \`findElements\` (an empty list means "not here", no exception), and if not found, click **Next ›** (\`#next-page\`) and look again. Stop when the Next button is disabled (\`!isEnabled()\`) and fail with a clear message naming what you searched for. After clicking Next, wait for the table to change (for example the page info text in \`#page-info\`) before reading — otherwise you may read the old page.

### Reading the whole table into data

When the check is about the *data* ("15 employees, no duplicates, 2 in Finance"), read every page into a list of maps keyed by header text, then assert with ordinary Java:

\`\`\`java
Map<String, String> row = new LinkedHashMap<>();
List<WebElement> cells = tr.findElements(By.tagName("td"));
for (int i = 0; i < headers.size(); i++) {
    row.put(headers.get(i), cells.get(i).getText().trim());   // "Department" -> "Finance"
}
\`\`\`

Keying by header means a new column does not break anything. Collect the maps page by page (waiting for the page to change after each **Next ›**), then compare the total with the app's own counter in \`#row-count\` and use a \`Set\` of names to catch rows that appear twice at a page boundary.

## Selenium 4 relative locators

Sometimes the best description is spatial: "the button to the right of *Save draft*". Selenium 4 adds \`RelativeLocator.with\`:

\`\`\`java
import static org.openqa.selenium.support.locators.RelativeLocator.with;

WebElement saveDraft = driver.findElement(By.xpath("//div[@id='editor-toolbar']/button[normalize-space()='Save draft']"));
WebElement next = driver.findElement(with(By.tagName("button")).toRightOf(saveDraft));
\`\`\`

Available directions: \`above\`, \`below\`, \`toLeftOf\`, \`toRightOf\`, \`near\`. They can be **chained** (\`.toRightOf(a).toLeftOf(b)\`) to narrow the match, and \`findElement\` returns the closest match.

How it works: Selenium asks the browser for each element's on-screen rectangle and compares positions. That has consequences:

- It depends on **layout**. A different window size (headless 800x600!) or a responsive wrap can change what is "to the right of".
- It is slower than a plain CSS lookup.

So treat relative locators as a sensible *temporary* choice when the app gives you nothing stable — and ask developers for \`data-testid\` attributes as the long-term fix.

## Choosing, in order

1. Stable \`id\` or \`data-testid\`.
2. Short CSS using stable classes/attributes, scoped to a container.
3. XPath by visible text / parent-with-child.
4. Relative locator anchored on stable text.
5. Never: absolute XPath, generated ids, row numbers.`,
  keyPoints: [
    '`normalize-space()` makes text matches robust to whitespace.',
    'Find the container first, then search inside it; in XPath start with `.//`.',
    'Get a column index from the header text, then read cells with `td:nth-child(n)` (1-based).',
    'Paginated search = look with `findElements`, click Next, wait for the page to change, stop when Next is disabled.',
    'Relative locators (`with(...).toRightOf(...)`) depend on layout — useful, but a temporary fix.',
  ],
  mistakes: [
    'Writing `row.findElement(By.xpath("//button"))` — without the dot it searches the whole page and hits the first row.',
    'Hard-coding `td[4]` — breaks when a column is added. Look up the header.',
    'Mixing 0-based Java indexes with 1-based `nth-child`/XPath positions — add 1.',
    'Using a relative locator and then running headless at a small window size where the layout wraps.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/dynamic.html\` paste \`//ul[@id='order-list']/li[span[normalize-space()='ORD-1042']]//button\` into DevTools' Ctrl+F. Confirm it says 1 of 1, then remove the \`li[...]\` filter and see how many it matches.`,
  problems: ['sel-015', 'sel-017', 'sel-004', 'sel-030'],
}
