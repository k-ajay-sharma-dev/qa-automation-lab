export default {
  id: 'loc-013',
  category: 'locators',
  kind: 'locator',
  title: 'following-sibling: "Track" for order ORD-1043',
  level: 'ADVANCED',
  tags: ['xpath', 'axes', 'following-sibling', 'dynamic'],
  estMinutes: 12,
  scenario: `Customer support escalated: "the Track button opens the wrong order for some customers". Your test must click **Track** for one
specific order number. Every row has an identical Track button — same text, same classes, no ids. The only thing that identifies
the right button is the **order number written next to it**.`,
  description: `On **dynamic.html** (section 4, "Recent orders"), match the **Track button in the row for ORD-1043**.

**Rules**
- Anchor on the order number text, then move sideways to the button.
- No list indexes (\`li[3]\`) — the list is sorted by date and changes every day.
- Exactly 1 element.`,
  hints: [
    'Each <li> contains <span class="order-id">, <span class="order-status"> and a <button>.',
    'Start from the span: //span[text()="ORD-1043"]',
    'Then step to the next sibling button: /following-sibling::button',
  ],
  page: 'dynamic.html',
  strategy: 'xpath',
  expected: '#order-list li:nth-of-type(3) button',
  expectedCount: 1,
  solution: `XPath:  //span[text()='ORD-1043']/following-sibling::button
        //li[span[@class='order-id' and text()='ORD-1043']]/button        (predicate on the row — also fine)

Java (parameterised — this is how it lives in a Page Object):
public void trackOrder(String orderId) {
    By trackBtn = By.xpath("//span[text()='" + orderId + "']/following-sibling::button");
    driver.findElement(trackBtn).click();
}
// trackOrder("ORD-1043");
driver.findElement(By.xpath("//span[text()='ORD-1043']/following-sibling::button")).click();`,
  explanation: `XPath **axes** let you move from an element you can identify to the element you need:

- \`following-sibling::\` — siblings after the current node (same parent)
- \`preceding-sibling::\` — siblings before it
- \`parent::\` / \`..\` — one level up
- \`ancestor::\` — any level up

CSS can only go **down** and **forward** (\`~\` general sibling, \`+\` adjacent sibling) — and it cannot match on text, so the "anchor on
text, move to neighbour" pattern is XPath territory.

The second form puts the condition in a predicate on the \`<li>\`: "the li **that has** a span with this text". Both are good; predicates
read well when several conditions are needed (see the multi-condition problem later).`,
  mistakes: [
    'Using //li[3]/button — passes today, clicks the wrong order tomorrow.',
    'Writing following-sibling without ::, or using following:: which also matches buttons in LATER rows.',
    'Hard-coding the order id inside the Page Object instead of passing it as a parameter.',
  ],
  interview: [
    {
      q: 'What is the difference between following-sibling:: and following::?',
      a: 'following-sibling:: only looks at later siblings under the same parent. following:: looks at everything after the node in document order (excluding descendants), so it can jump into other rows — usually too broad; if used, add [1].',
    },
    {
      q: 'How do you build a locator for "the button next to <some dynamic value>" in a Page Object?',
      a: 'Use a method that takes the value and formats an XPath (String.format("//span[text()=\'%s\']/following-sibling::button", id)). Keep the template as a private constant so it stays in one place.',
    },
  ],
}
