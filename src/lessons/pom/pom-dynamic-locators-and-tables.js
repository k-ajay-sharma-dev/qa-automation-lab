export default {
  slug: 'pom-dynamic-locators-and-tables',
  category: 'pom',
  order: 7,
  title: 'Dynamic locators and web table page objects',
  minutes: 9,
  summary: 'Build locators at runtime from a template with String.format, and write table page objects that find rows by content and columns by header text instead of fixed indexes.',
  manualAnalogy: `Your manual steps never say "click the third Add-to-cart button" — they say "add the *Pulse Bike Light* to the cart", and for a table "check the department of *Priya Sharma*". You find the thing by what it shows, not where it happens to sit today. Dynamic locators let your code do the same, so a new product or a re-sorted table does not break the test.`,
  body: `## The problem: one locator per piece of data

\`\`\`java
private final By addBackpack = By.id("add-to-cart-trailblazer-backpack");
private final By addBikeLight = By.id("add-to-cart-pulse-bike-light");
private final By addTee = By.id("add-to-cart-classic-crew-t-shirt");
// ... and one method per product
\`\`\`

Six products means six fields and six methods. A seventh product means another code change. The locators differ only in *one piece of data*. So make that piece a parameter.

## String.format: a locator template

\`String.format\` fills placeholders in a text. \`%s\` means "put a String here".

\`\`\`java
String.format("Hello %s, you have %s items", "Asha", "3");
// -> "Hello Asha, you have 3 items"
\`\`\`

Apply it to locators. On the cart page each Remove button has the id \`remove-<slug>\`:

\`\`\`java
private static final String REMOVE_BUTTON = "remove-%s";   // the template

private By removeButton(String slug) {                      // builds a By on demand
    return By.id(String.format(REMOVE_BUTTON, slug));
}

public CartPage remove(String slug) {
    click(removeButton(slug));
    return this;
}
\`\`\`

- \`static final\` — one constant shared by all objects of the class; written in UPPER_CASE by convention.
- The private helper returns a \`By\`, so it works with every wait in BasePage.
- Tests call \`cart.remove("retro-red-tee")\` — no new code when products are added.

## Templates that use visible text

Ids built from slugs are fine when they exist, but tests usually know the **product name** a user sees, not a slug. XPath can find a container by its text and then step *into* it. The general shape:

\`\`\`
//<container>[.//<label element>[normalize-space()='%s']]//<target inside it>
\`\`\`

For example, the description inside the card whose name link says the product name:

\`\`\`java
private static final String DESC_IN_CARD =
    "//div[@data-testid='inventory-item'][.//a[normalize-space()='%s']]//div[@class='item-desc']";
\`\`\`

Read it right to left: *the description div* inside *the inventory-item div* that contains *a link whose trimmed text is the name*. \`normalize-space()\` ignores stray spaces and line breaks.

Watch the quotes: the Java string is in double quotes, the XPath literal in single quotes. A name containing an apostrophe would need special handling — keep test data simple or use ids where possible.

## Web tables: never trust positions

\`table.html\` shows an employee table (\`#employee-table\`) with columns Name, Department, Salary, Status, Action. A locator like \`//tbody/tr[3]/td[2]\` means "row 3, column 2". It breaks when:

- someone sorts by salary (row 3 is now a different person),
- the search box filters rows, or the page changes,
- a developer adds an "ID" column at the front (column 2 is now Name).

A table page object should answer questions **by content**:

| Question | Approach |
|---|---|
| Which column is "Department"? | Read all header cells (\`thead th\`), find the position whose trimmed text matches |
| Which row is "Priya Sharma"? | Look through body rows (\`tbody tr\`) for the one whose Name cell matches |
| What is her department? | Take that row's cells (\`td\`) and pick the one at the column position |

Two Java details help:

1. \`findElements\` can be called **on an element**, not just the driver. \`row.findElements(By.tagName("td"))\` returns only that row's cells — a search scoped to the row.
2. Java lists start at **index 0**, XPath positions start at **1**. Decide which one your methods return and stay consistent.

When the row is not found, **throw a clear exception** rather than returning \`null\`:

\`\`\`java
throw new NoSuchElementException("No employee row with name: " + name);
\`\`\`

A null would fail later with a confusing \`NullPointerException\` far away from the cause.

## Header text gotcha

The headers here contain a sort-indicator \`<span>\`, so \`getText()\` may return "Name ▲" after sorting. Compare with \`trim()\` and \`startsWith\`, or read only the cell's own text, so sorting does not break your column lookup.

## Search, sort and pages: wait for the real signal

On \`table.html\` searching, sorting and paging all **re-render** the table body: the old \`<tr>\` elements are thrown
away and new ones are created. Two consequences:

1. Reading rows right after the click can return the *old* rows, or throw \`StaleElementReferenceException\` halfway
   through your loop.
2. A fixed \`Thread.sleep\` is either too short on CI or wastes time locally.

Instead, wait for a signal the page gives you:

| Action | "Done" signal on table.html | Wait |
|---|---|---|
| Go to the next page | \`#page-info\` changes to "Page 2 of 3" | \`textToBe(pageInfo, "Page 2 of 3")\` |
| Any re-render | the old rows are detached | \`stalenessOf(oldRow)\` |
| Sort | the header's \`aria-sort\` becomes \`ascending\` / \`descending\` | \`attributeToBe(header, "aria-sort", ...)\` |
| Last page reached | \`#next-page\` is disabled | check \`isEnabled()\` |

\`stalenessOf\` deserves a closer look:

\`\`\`java
WebElement before = driver.findElement(firstRow);   // remember something that WILL be replaced
click(someControlThatReRenders);
wait.until(ExpectedConditions.stalenessOf(before)); // returns as soon as it is gone from the DOM
\`\`\`

It is precise ("the old content is gone") and fast (no fixed delay).

**Pagination and completeness.** With 5 rows per page, "the table is sorted" means *all* 15 employees, not the
five on screen. A table page object can offer a method that walks the pager (read → Next → wait → read … until Next
is disabled). The **test** then converts the values (\`"$85,000"\` → 85000) and compares them with a sorted copy —
deciding what "correctly sorted" means is a business expectation, so it stays in the test.

## Keep the template private

Tests should never build XPath strings. They call \`addToCart("Junior Onesie")\` or \`getCellValue("Emily Carter", "Status")\`. If the markup changes, only the template changes.`,
  keyPoints: [
    'When locators differ only by data, use one `static final String` template plus `String.format`.',
    'Wrap the template in a private method that returns a `By`, so waits still work.',
    'XPath can find a container by its visible text and then the target inside it.',
    'Table page objects locate rows by content and columns by header text, never `tr[3]/td[2]`.',
    'Scope searches with `row.findElements(...)`; throw a clear exception when a row is missing.',
  ],
  mistakes: [
    'Writing one field and one method per product — replace with a template and a parameter.',
    'Quote clashes: double quotes inside an XPath that is itself in a Java double-quoted string. Use single quotes inside XPath.',
    'Mixing 0-based list indexes and 1-based XPath positions — off-by-one cells.',
    'Returning `null` when a row is missing — throw with the name you searched for.',
  ],
  tryIt: `On http://localhost:5180/practice-site/table.html open DevTools and run \`$x("//table[@id='employee-table']//tr[td[normalize-space()='James Wilson']]")\`. Now type "Finance" in the search box and run it again — it still finds James, although his row moved. Then run \`$x("//table[@id='employee-table']/tbody/tr[3]")\` before and after searching and compare who (if anyone) is returned.`,
  problems: ['pom-010', 'pom-009', 'pom-023'],
}
