export default {
  slug: 'loc-xpath-functions-positions',
  category: 'locators',
  order: 9,
  title: 'XPath functions and positions: not(), last(), position() and number()',
  minutes: 9,
  summary: 'Use XPath 1.0 functions to exclude records with not(), understand why position-based locators silently pick the wrong element, and filter elements by a numeric value with number(), substring-after() and translate().',
  manualAnalogy: `Some test rules are about data, not about names: "every order over $100 needs approval", "everyone except inactive users gets the e-mail", "the last row is the newest". As a manual tester you apply those rules by reading values. XPath has a small set of functions that let a locator read and compare values the same way — and a few position features that look handy but are traps.`,
  body: `## not(): exclude a condition

\`not(...)\` turns any condition around:

\`\`\`xpath
//button[not(@disabled)]                                   buttons you can click
//select[@id='product-sort']/option[not(@value='az')]      every sort option except the default
\`\`\`

Where you put it matters. Negate the condition **on the container you are filtering**:

\`\`\`xpath
//ul[@id='order-list']/li[not(span[normalize-space()='Delivered'])]       orders that are NOT delivered ✓
//ul[@id='order-list']/li[span[not(normalize-space()='Delivered')]]       orders that have SOME span that isn't "Delivered" ✗ (all of them)
\`\`\`

The second form looks similar but asks a different question — every row has other spans, so nothing is excluded.

## Positions: [1], last(), position()

XPath can pick by position — counting starts at **1**:

\`\`\`xpath
(//ul[@id='order-list']/li)[1]          the first order
(//ul[@id='order-list']/li)[last()]     the last order
//ul[@id='order-list']/li[position() <= 2]   the first two
\`\`\`

Note the brackets: \`(//li)[1]\` is "the first li in the whole result", while \`//li[1]\` is "every li that is the first child of its parent" —
on a page with several lists that is several elements.

### Why position is a trap for data

Positions describe *where* something is **today**. Lists get sorted, filtered, paged and extended; JavaScript can re-order elements after
load (the inventory page sorts its cards by name, so the third card in the HTML file is **not** the third card on screen). An index
locator does not fail when that happens — it quietly returns a **different** element, and your test checks the wrong product.

Use positions only when position *is* the requirement ("after sorting by price, the first item is the cheapest") or for fixed structure
(table columns). For "the item called X", anchor on the data (see the *XPath axes* lesson).

## Text into numbers: number(), substring-after(), translate()

XPath 1.0 (the version browsers support) can compare numbers, but the page shows **text**:

\`\`\`html
<li class="price-row"><span class="product">Storm Fleece Jacket</span> — <span class="price">$49.99</span></li>
\`\`\`

\`\`\`xpath
//li[contains(@class,'price-row')][number(substring-after(span[contains(@class,'price')], '$')) > 30]
\`\`\`

| Function | Example | Result |
|---|---|---|
| \`substring-after(s, x)\` | \`substring-after('$49.99', '$')\` | \`'49.99'\` |
| \`substring-before(s, x)\` | \`substring-before('ORD-1043', '-')\` | \`'ORD'\` |
| \`translate(s, from, to)\` | \`translate('$1,299.00', '$,', '')\` | \`'1299.00'\` |
| \`number(s)\` | \`number('49.99')\` | \`49.99\` (or **NaN** if not a number) |
| \`string-length(s)\` | \`string-length(@value) > 0\` | non-empty value |
| \`count(path)\` | \`//ul[count(li) > 3]\` | lists with more than 3 items |

The big pitfall: \`number('$49.99')\` is **NaN**, and every comparison with NaN is false — the locator returns nothing and gives no error.
Strip currency signs, thousand separators and spaces first.

Build such expressions inside-out and test each layer in the Console with \`$x()\`. Keep the condition on the **container** (the row or
card), so the value you test and the element you return belong to the same record.

## Locator or Java?

A numeric rule can also be done in Java: find all cards, parse prices with \`BigDecimal\`, filter with a stream. Java is easier to debug
and handles any format; an XPath filter is compact and useful inside waits. Both are fine — pick the one your team can read.`,
  keyPoints: [
    'not() negates a condition — put it on the container you are filtering, not on a child.',
    '(//x)[1] is the first in the whole result; //x[1] is every x that is first among its siblings.',
    'Index locators fail silently: when order changes they return a different element instead of none.',
    'number() turns text into numbers; strip $, commas and spaces first or you get NaN and no matches.',
    'Keep value checks and the returned element inside the same container (row/card).',
  ],
  mistakes: [
    'Writing //li[1] and expecting one element on a page with several lists — use (//li)[1].',
    'Comparing "$15.99" with a number directly — NaN, so nothing matches.',
    'Placing not() on the inner element and excluding nothing.',
    'Fixing a broken index locator by changing the index — it breaks again with the next data change.',
  ],
  tryIt: `On http://localhost:5180/practice-site/waits.html run \`$x("//li[contains(@class,'price-row')][number(substring-after(span[contains(@class,'price')],'$')) > 20]")\`. Then on inventory.html compare \`$x("(//div[contains(@class,'inventory-item')])[1]")\` before and after choosing "Price (high to low)" in the sort menu.`,
  problems: ['loc-027', 'loc-028', 'loc-030'],
}
