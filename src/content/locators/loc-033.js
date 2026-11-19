export default {
  id: 'loc-033',
  category: 'locators',
  kind: 'locator',
  title: 'Ends-with ($=): all three overview amounts in one locator',
  level: 'ADVANCED',
  tags: ['attribute-operators', 'ends-with', 'child-combinator', 'checkout'],
  estMinutes: 10,
  scenario: `Finance reported a rounding bug in tax, so you are adding a data-driven check that reads **Item total, Tax and Total** on the
checkout overview and verifies the maths for 20 cart combinations. You want one locator that returns the three amounts as a list —
and it must not pick up the "Shipping to" span that sits in the same summary box.`,
  description: `On **checkout.html** (step 2 overview), write ONE locator that matches exactly the three amount spans:
\`#summary-subtotal\`, \`#summary-tax\` and \`#summary-total\`.

**Rules**
- Must not match \`#summary-ship-to\` (also a span, also an id starting with "summary-").
- Must not match the label rows themselves.
- Not a comma-separated list of three ids — find the pattern.
- Exactly 3 elements.`,
  hints: [
    'Try [id^="summary-"] — 4 matches: the ship-to span sneaks in. Starts-with is not enough here.',
    'Look at the parents: data-testid="subtotal-label", "tax-label", "total-label". The ship-to span\'s parent has no data-testid.',
    'Combine the ends-with operator on the parent with the child combinator: [data-testid$="-label"] > span.',
  ],
  page: 'checkout.html',
  strategy: 'either',
  expected: '#summary-subtotal, #summary-tax, #summary-total',
  expectedCount: 3,
  solution: `CSS:    .summary-info [data-testid$='-label'] > span
XPath:  //div[@class='summary-info']/div[substring(@data-testid, string-length(@data-testid) - 5) = '-label']/span
        (XPath 1.0 has no ends-with(); contains(@data-testid, '-label') also works on this page)

Java:
private final By overviewAmounts = By.cssSelector(".summary-info [data-testid$='-label'] > span");

List<BigDecimal> amounts = driver.findElements(overviewAmounts).stream()
        .map(e -> new BigDecimal(e.getText().replace("$", "")))
        .toList();
// document order: get(0) = item total, get(1) = tax, get(2) = total
assertEquals(amounts.get(0).add(amounts.get(1)), amounts.get(2));`,
  explanation: `The four spans in \`.summary-info\` all have ids starting with \`summary-\`, so \`^=\` cannot separate the amounts from the
ship-to text. The **parents** carry the useful pattern: \`subtotal-label\`, \`tax-label\`, \`total-label\` all **end with** \`-label\`, while the
ship-to row has no test id at all. \`[data-testid$='-label'] > span\` picks the direct child spans of those rows.

\`findElements\` returns elements in **document order**, so the list is always [item total, tax, total] — safe to index for the maths
check. If order matters a lot, three named ids in the page object are the most readable option; the pattern locator shines when you want
"all amounts" (e.g. assert none of them shows \`$NaN\`).

XPath 1.0 (what browsers implement) has \`starts-with()\` but **no** \`ends-with()\` — you emulate it with \`substring()\` + \`string-length()\`,
or settle for \`contains()\`. This is one of the few places where CSS is the more expressive language.`,
  mistakes: [
    'Using [id^="summary-"] — also matches #summary-ship-to (4 elements).',
    'Writing ends-with(@data-testid, "-label") in XPath — browsers support XPath 1.0, where that function does not exist.',
    'Forgetting the > span and matching the label divs (with "Total:" text) instead of the amounts.',
  ],
  interview: [
    {
      q: 'What do ^=, $= and *= mean in CSS attribute selectors?',
      a: 'Starts with, ends with and contains. [id^="remove-"] matches every id starting with remove-, [data-testid$="-label"] those ending with -label, and [placeholder*="Name"] any placeholder containing Name.',
    },
    {
      q: 'Does findElements guarantee an order?',
      a: 'Yes — elements come back in document order (the order they appear in the HTML). That is reliable for a stable layout, but if the order is meaningful to the test, locate each element by its own id so a layout change cannot silently swap them.',
    },
  ],
}
