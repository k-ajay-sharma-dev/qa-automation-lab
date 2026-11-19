export default {
  id: 'loc-014',
  category: 'locators',
  kind: 'locator',
  title: 'ancestor / parent: the price of the Storm Fleece Jacket',
  level: 'ADVANCED',
  tags: ['xpath', 'axes', 'ancestor', 'parent', 'inventory'],
  estMinutes: 12,
  scenario: `A pricing defect: "Storm Fleece Jacket shows $49.99 on the listing but $54.99 in the cart". To automate the regression you need
the price **shown on the jacket's card**. The card itself has no unique attribute — only the product name tells you which card it is,
and the price is in a different branch of the card than the name.`,
  description: `On **inventory.html**, match the **price element of the Storm Fleece Jacket card**.

**Rules**
- Anchor on the product name text.
- Go **up** to the card (ancestor/parent), then **down** to the price.
- No card indexes — the user can re-sort the list.
- Exactly 1 element.`,
  hints: [
    'Structure: div.inventory-item > div.item-body > (a.item-name, …, div.item-footer > div.item-price)',
    'Up: //a[text()="Storm Fleece Jacket"]/ancestor::div[@data-testid="inventory-item"]',
    'Then down: …//div[@class="item-price"]',
  ],
  page: 'inventory.html',
  strategy: 'xpath',
  expected: '#inventory-list > .inventory-item:nth-of-type(5) .item-price',
  expectedCount: 1,
  solution: `XPath:  //a[text()='Storm Fleece Jacket']/ancestor::div[@data-testid='inventory-item']//div[@class='item-price']
        //a[text()='Storm Fleece Jacket']/parent::div//div[@class='item-price']        (parent = div.item-body)
        //div[@data-testid='inventory-item'][.//a[text()='Storm Fleece Jacket']]//div[@class='item-price']

Java:
String price = driver.findElement(By.xpath(
        "//a[text()='Storm Fleece Jacket']/ancestor::div[@data-testid='inventory-item']//div[@class='item-price']"))
        .getText();
Assert.assertEquals(price, "$49.99");`,
  explanation: `"Go up to a common container, then down to the target" is the most useful XPath pattern in real projects (product cards,
table rows, list items, form groups).

- \`parent::div\` goes up exactly one level — fragile if a wrapper div is added.
- \`ancestor::div[@data-testid='inventory-item']\` goes up **until** it finds the card — robust to extra wrappers.
- The predicate form \`card[.//name]\` says "the card that contains this name" — no axis needed, and it reads like a sentence.

Note the promo banner also has an \`.item-price\` — scoping to the jacket's card avoids it automatically.`,
  mistakes: [
    'Using ancestor::div without a predicate — that returns every div up to <body>, and //div[@class="item-price"] below them matches all 7 prices.',
    'Using a card index (inventory-item[5]) — breaks when the user sorts by price.',
    'Using .. repeatedly (../../..) — unreadable and breaks with every markup change.',
  ],
  interview: [
    {
      q: 'Can CSS select a parent element?',
      a: 'Traditionally no — CSS only goes down and forward. The modern :has() pseudo-class (e.g. .inventory-item:has(a.item-name)) now works in recent browsers, but it cannot match text, so for "card containing this product name" XPath is still the usual choice.',
    },
    {
      q: 'How would you model a product card in a Page Object?',
      a: 'As a small component object: a method getCard(name) returns the card WebElement (via the ancestor XPath), and the component exposes price(), addToCart(), etc. using locators relative to the card (".//div[@class=\'item-price\']").',
    },
  ],
}
