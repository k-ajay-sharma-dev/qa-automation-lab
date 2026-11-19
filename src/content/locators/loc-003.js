export default {
  id: 'loc-003',
  category: 'locators',
  kind: 'locator',
  title: 'Find ALL product cards with a class selector',
  level: 'BEGINNER',
  tags: ['css', 'class', 'findElements', 'inventory'],
  estMinutes: 5,
  scenario: `The product owner reports: "after the last deployment the catalogue sometimes shows 5 products instead of 6".
You want an automated check that counts the cards on the inventory page. For that you need one locator that matches
**every** product card — and nothing else.`,
  description: `On **inventory.html**, write one locator that matches all **6 product cards** (the whole card, not the name or the button).

**Rules**
- Use the card's CSS class.
- Must match exactly 6 elements.`,
  hints: [
    'Inspect a card: it is a <div class="inventory-item" ...>.',
    'In CSS a class is written with a dot: .inventory-item',
  ],
  page: 'inventory.html',
  strategy: 'css',
  expected: '.inventory-item',
  expectedCount: 6,
  solution: `CSS:    .inventory-item          (or div.inventory-item, or [data-testid='inventory-item'])
XPath:  //div[@class='inventory-item']

Java:
List<WebElement> cards = driver.findElements(By.className("inventory-item"));
Assert.assertEquals(cards.size(), 6, "Number of products on the inventory page");`,
  explanation: `\`findElements\` (plural) returns a \`List<WebElement>\` — empty if nothing matches, **never** an exception. That makes it the
right tool for counting.

\`By.className("inventory-item")\` and \`By.cssSelector(".inventory-item")\` are equivalent. The cards also expose
\`data-testid="inventory-item"\`, which is even safer: test ids exist only for automation, so a designer renaming CSS classes
will not break your test.`,
  mistakes: [
    'Using findElement (singular) — it returns only the first card, so the count is always 1.',
    'Passing two classes to By.className("btn btn-primary") — it accepts one class only.',
    'Locating .item-name instead of the card, then the count still works but later steps (price, button) need re-scoping.',
  ],
  interview: [
    {
      q: 'What does findElements return when nothing matches?',
      a: 'An empty list. findElement throws NoSuchElementException instead. That is why "element is NOT displayed" checks are often written as findElements(...).isEmpty().',
    },
    {
      q: 'Why do many teams ask developers for data-testid attributes?',
      a: 'They are a contract between dev and QA: not used for styling or logic, so redesigns and refactors do not touch them. It removes most locator maintenance.',
    },
  ],
}
