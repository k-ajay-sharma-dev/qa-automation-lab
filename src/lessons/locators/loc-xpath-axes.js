export default {
  slug: 'loc-xpath-axes',
  category: 'locators',
  order: 6,
  title: 'XPath axes: sibling, parent and ancestor patterns',
  minutes: 10,
  summary: 'Anchor on text you can identify and move to the element you need with following-sibling, preceding-sibling, parent and ancestor — the pattern behind table rows, product cards and form labels.',
  manualAnalogy: `When you tell a colleague which button to press you say "the **Edit** button in the row where the name is *Chen Wei*" — you anchor on something unique (the name) and then point to its neighbour. Every row has an identical Edit button, so the neighbour alone means nothing. XPath axes are exactly that: start at the unique thing, then walk sideways, up or down to the target.`,
  body: `## Why we need axes

Real pages are full of repeated components: every product card has an "Add to cart" button, every table row has an "Edit" button, every order has a "Track" link. The buttons are identical; only the **data next to them** is different. And the data's position changes — lists get sorted, new records arrive — so "row 3" or "card 5" is a trap.

The reliable recipe:

1. **Anchor** on something unique and meaningful (a name, an order number, a label text).
2. **Move** from the anchor to the target through the tree.

## The axes you need

Written as \`axis::tag\` after a \`/\`:

| Axis | Direction | Example |
|---|---|---|
| \`following-sibling::\` | later siblings (same parent) | \`//td[.='Chen Wei']/following-sibling::td\` |
| \`preceding-sibling::\` | earlier siblings | \`//td[.='QA']/preceding-sibling::td\` |
| \`parent::\` or \`..\` | one level up | \`//td[.='Chen Wei']/..\` (the row) |
| \`ancestor::\` | any level up | \`//a[.='Pulse Bike Light']/ancestor::div[@class='inventory-item']\` |
| \`child::\` (default) / \`descendant::\` (\`//\`) | down | \`…/descendant::button\` |
| \`following::\` / \`preceding::\` | everything after/before in the whole document | rarely what you want |

Axes can be followed by a predicate: \`following-sibling::td[3]\` is the **third** later sibling cell. Note that \`following-sibling::\` is limited to the same parent, while \`following::\` would happily jump into the next row — a classic bug.

## Pattern 1 — sideways (siblings)

\`\`\`html
<tr><td>Chen Wei</td><td>QA</td><td>$74,000</td><td><span class="status-pill">Active</span></td><td><button>Edit</button></td></tr>
\`\`\`

\`\`\`xpath
//td[normalize-space()='Chen Wei']/following-sibling::td[1]
\`\`\`

"Find the cell that says Chen Wei, then take the first cell after it" → the Department cell. Works when the anchor and target share a parent.

## Pattern 2 — up, then down (the most useful one)

When the target is not a direct sibling — it sits in a different branch of the same component — go **up** to the shared container, then **down**:

\`\`\`xpath
//a[normalize-space()='Pulse Bike Light']/ancestor::div[contains(@class,'inventory-item')]//button
\`\`\`

Read it in three steps:
1. \`//a[normalize-space()='Pulse Bike Light']\` — the product name link (anchor).
2. \`/ancestor::div[contains(@class,'inventory-item')]\` — climb to the card that contains it.
3. \`//button\` — inside that card, the button.

Always name *which* ancestor you want with a predicate. A bare \`ancestor::div\` matches **every** div above you, all the way up to the page wrapper.

## Pattern 3 — the container that HAS something (predicate on the parent)

You can also select the container directly by what it contains, then go down:

\`\`\`xpath
//tr[td[normalize-space()='Chen Wei']]//button
\`\`\`

"The \`tr\` that **has** a \`td\` child with text Chen Wei, then its button." No axis keyword needed — a path inside a predicate means "has a child/descendant like this". This form shines when you need **several** conditions on the same row or card (see the *Dynamic and tricky elements* lesson).

## Pattern 4 — label to field

Forms built by plugins often have meaningless ids, but the **label text** the user sees is stable:

\`\`\`html
<div class="form-row">
  <label for="email">Email *</label>
  <input type="email" id="email" name="email">
</div>
\`\`\`

\`\`\`xpath
//label[normalize-space()='Email *']/following-sibling::input
\`\`\`

From the label, step sideways to the input. (If the input were *inside* the label, you would go down instead: \`//label[contains(.,'Outdoor gear')]/input\`.)

## Parameterise it in the Page Object

The anchor value is test data, so pass it in:

\`\`\`java
public String departmentOf(String employee) {
    By cell = By.xpath(String.format(
        "//td[normalize-space()='%s']/following-sibling::td[1]", employee));
    return driver.findElement(cell).getText();
}
\`\`\`

One method now serves every employee — and it keeps working when the table is re-sorted.

## Checklist

- Is the anchor unique on the page? (Check the count.)
- Did I use \`following-sibling\` rather than \`following\`?
- Is my \`ancestor\` qualified with a tag and class?
- No numeric row/card index anywhere?`,
  keyPoints: [
    'Anchor on unique visible data, then move to the target — never pick rows/cards by index.',
    'following-sibling / preceding-sibling stay inside the same parent; following:: does not.',
    'Up-then-down: //anchor/ancestor::container[condition]//target.',
    '//container[child[condition]]//target selects the container by what it contains.',
    'Pass the anchor value as a parameter in Page Object methods.',
  ],
  mistakes: [
    'Using following:: instead of following-sibling:: — it also matches elements in later rows or cards.',
    'Writing ancestor::div with no predicate — it matches every div up to the page root.',
    'Forgetting the :: after the axis name (following-sibling/td) — that is a syntax error.',
    'Anchoring on text that is not unique (e.g. a status like "Active") — the locator matches many rows.',
  ],
  tryIt: `On http://localhost:5180/practice-site/table.html, write an XPath for Sofia Rossi's salary cell using following-sibling. Then sort by Name and by Salary — run it again in \`$x()\` and confirm it still finds her salary.`,
  problems: ['loc-013', 'loc-014', 'loc-015', 'loc-016', 'loc-018', 'loc-029', 'loc-041'],
}
