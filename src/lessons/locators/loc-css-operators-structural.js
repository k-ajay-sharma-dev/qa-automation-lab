export default {
  slug: 'loc-css-operators-structural',
  category: 'locators',
  order: 4,
  title: 'CSS attribute operators and position selectors',
  minutes: 8,
  summary: 'Match on part of an attribute with ^=, $=, *= and ~=, and pick elements by position with :nth-of-type / :nth-child — including whole table columns.',
  manualAnalogy: `Test data often follows patterns: order numbers all start with "ORD-", every phone field ends in "Phone", the salary is always the third column. You spot those patterns instantly by eye. Attribute operators and position selectors let a locator use the same patterns — one rule that matches a whole family of elements.`,
  body: `## Partial attribute matching

\`[attr='value']\` needs an exact match. When values follow a pattern, use an operator:

| Operator | Means | Example | Matches |
|---|---|---|---|
| \`^=\` | **starts with** | \`[id^='remove-']\` | every cart "Remove" button (\`remove-pulse-bike-light\`, …) |
| \`$=\` | **ends with** | \`[id$='-error']\` | \`firstName-error\`, \`email-error\`, … on form.html |
| \`*=\` | **contains** | \`[placeholder*='Name']\` | "First Name", "Last Name" on checkout |
| \`~=\` | contains this **whole word** in a space-separated list | \`[class~='btn-sm']\` | elements with class \`btn-sm\` |
| \`\\|=\` | equals, or starts with value + \`-\` | \`[lang\\|='en']\` | \`en\`, \`en-GB\` (rare in tests) |

\`\`\`java
List<WebElement> fieldErrors = driver.findElements(By.cssSelector("#registration-form [id$='-error']"));
\`\`\`

### Pattern ids are a gift — and a warning

Front-end code that builds ids from data (\`remove-\` + product slug) gives you a stable **prefix** you can use to match the whole family, and a full id you can use for one member. Two things to watch:

1. **Case-sensitive.** \`[name*='phone']\` does not match \`name="homePhone"\`. Inspect the real value and copy its exact case. (CSS allows \`[name*='phone' i]\` for case-insensitive matching, but being exact is clearer.)
2. **Too-short patterns over-match.** \`[id^='btn']\` might also catch \`btn-close\`, \`btnHelp\`… Include the separator (\`'remove-'\` not \`'remove'\`) and scope to a container when you can. Check the count in DevTools.

## Position: :nth-child vs :nth-of-type

\`\`\`html
<nav class="site-nav">
  <a href="index.html">Home</a>        <!-- 1st a -->
  <a href="login.html">Login</a>       <!-- 2nd a -->
  <a href="inventory.html">Inventory</a>
</nav>
\`\`\`

| Selector | Meaning |
|---|---|
| \`:first-child\`, \`:last-child\` | first / last child of its parent |
| \`:nth-child(2)\` | the 2nd child of its parent, **whatever its tag** — and it must also match the rest of the selector |
| \`:nth-of-type(2)\` | the 2nd element **of this tag** among its siblings |
| \`:nth-child(odd)\`, \`:nth-child(2n)\` | patterns (zebra rows) |

\`.site-nav a:nth-of-type(3)\` → the Inventory link. Counting starts at **1** in CSS (unlike Java lists, which start at 0).

The difference matters when siblings have mixed tags. In \`<div><h3>…</h3><p>A</p><p>B</p></div>\`, \`p:nth-child(1)\` matches nothing (child 1 is the h3), while \`p:nth-of-type(1)\` is "A".

## Table columns

HTML tables are rows (\`<tr>\`) of cells (\`<td>\`, or \`<th>\` in the header). Every row has its cells in the same order, so "column N" = "the Nth cell of every row":

\`\`\`css
#employee-table tbody td:nth-of-type(4)    /* the Status cell of every body row */
\`\`\`

- \`tbody\` skips the header row (\`thead\` holds \`<th>\` cells, which a \`td\` selector would not match anyway — but scoping makes the intent obvious).
- Use \`findElements\` and you get the whole column as a list — perfect for "is this column sorted?" or "every status is valid" checks.

## When NOT to use position

Position is fine for **structure that never changes meaning** — "the 3rd column is Salary" is defined by the table header. It is fragile for **data order**: "the 3rd row" or "the 5th product" changes whenever the data, sorting or a new item changes. For "the row for employee X" anchor on the data itself (see the *XPath axes* lesson).`,
  keyPoints: [
    '^= starts with, $= ends with, *= contains, ~= whole word in a list.',
    'Attribute values are case-sensitive; include separators like "remove-" to avoid over-matching.',
    ':nth-of-type counts elements of the same tag; :nth-child counts all children. Both start at 1.',
    'td:nth-of-type(N) inside tbody selects a whole table column.',
    'Use position for fixed structure (columns), never for data order (rows, cards).',
  ],
  mistakes: [
    'Using *=\'phone\' when the attribute says Phone — matching is case-sensitive.',
    'Using :nth-child when siblings have different tags — the count includes them; try :nth-of-type.',
    'Counting from 0 — CSS positions start at 1.',
    'Picking "row 3" by position for a specific record — it breaks when the data is sorted or changes.',
  ],
  tryIt: `On http://localhost:5180/practice-site/table.html run \`$$('#employee-table tbody td:nth-of-type(2)')\` (Department). Now click the Department header to sort and run it again — the column locator still works, but the values moved rows. Then try \`$$("[id$='-page']")\`.`,
  problems: ['loc-007', 'loc-008', 'loc-009', 'loc-012', 'loc-033'],
}
