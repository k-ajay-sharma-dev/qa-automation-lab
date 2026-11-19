export default {
  id: 'loc-029',
  category: 'locators',
  kind: 'locator',
  title: 'preceding-sibling: order numbers of every Shipped order',
  level: 'ADVANCED',
  tags: ['xpath', 'axes', 'preceding-sibling', 'and', 'dynamic'],
  estMinutes: 10,
  scenario: `The courier integration sends a "Shipped" webhook and the Recent orders widget updates. Your test must read the **order numbers**
of all orders that are currently **Shipped** and compare them with what the courier API returned. In each row the order number comes
**before** the status — so you have to anchor on the status and look **backwards**, something CSS cannot do.`,
  description: `On **dynamic.html** (section 4, "Recent orders"), match the **order-number spans** of every order whose status is **Shipped**.

**Rules**
- XPath. Anchor on the status text "Shipped", then move to the order id with \`preceding-sibling::\`.
- Do not hard-code order numbers and do not use row indexes.
- Exactly 2 elements (ORD-1042 and ORD-1044).`,
  hints: [
    'Row: <li><span class="order-id">ORD-1042</span><span class="order-status">Shipped</span><button>Track</button></li>',
    'Find the status span with two conditions (class and text) using and, then step back: /preceding-sibling::span',
    '//ul[@id=\'order-list\']//span[contains(@class,\'order-status\') and normalize-space()=\'Shipped\']/preceding-sibling::span[contains(@class,\'order-id\')]',
  ],
  page: 'dynamic.html',
  strategy: 'xpath',
  expected: '#order-list li:nth-of-type(2) .order-id, #order-list li:nth-of-type(4) .order-id',
  expectedCount: 2,
  solution: `XPath:  //ul[@id='order-list']//span[contains(@class,'order-status') and normalize-space()='Shipped']/preceding-sibling::span[contains(@class,'order-id')]

Alternative (container that HAS the status, then down):
        //ul[@id='order-list']/li[span[normalize-space()='Shipped']]/span[contains(@class,'order-id')]

Java:
List<String> shipped = driver.findElements(By.xpath(
        "//ul[@id='order-list']//span[contains(@class,'order-status') and normalize-space()='Shipped']"
        + "/preceding-sibling::span[contains(@class,'order-id')]"))
    .stream().map(WebElement::getText).toList();
Assert.assertEquals(shipped, List.of("ORD-1042", "ORD-1044"));`,
  explanation: `\`preceding-sibling::\` walks **backwards** among elements that share the same parent. From each "Shipped" status span it reaches
the order-id span in the same \`<li>\` — and only there, because siblings never leave their parent.

Compare with \`preceding::\`, which means "everything earlier in the whole document": from the second Shipped row it would also return
ORD-1041, ORD-1042 and ORD-1043 from the rows above — four elements and a confusing duplicate. It is the mirror image of the
\`following::\` vs \`following-sibling::\` trap.

The \`and\` in the anchor makes it precise: a span with the status **class** *and* the text "Shipped". Without the class condition, any
span that ever says "Shipped" (a filter chip, a tooltip) would become an anchor.

The alternative form — "the \`li\` that has a Shipped span, then its order-id" — returns the same elements and is often easier to read. Know
both: interviewers love asking for preceding-sibling specifically.`,
  mistakes: [
    'Using preceding:: instead of preceding-sibling:: — it collects order ids from earlier rows too.',
    'Expecting CSS to do this — CSS combinators only go forward (+, ~) and down.',
    'Matching @class=\'order-id\' exactly — any extra class (or a highlight tool) breaks it; contains(@class,…) is safer.',
  ],
  interview: [
    {
      q: 'Name the XPath axes you use most and what each does.',
      a: 'parent (or ..) goes one level up, ancestor goes any number of levels up, following-sibling and preceding-sibling move sideways within the same parent, descendant (//) goes down, following and preceding cover the rest of the document before/after the node.',
    },
    {
      q: 'Can CSS select an element that comes before another one?',
      a: 'Not with classic combinators: +, ~, > and space only go forward or down. Modern browsers support :has() (e.g. li:has(.order-status) .order-id), but for anything text-based or backwards XPath is still the standard tool in Selenium.',
    },
  ],
}
