export default {
  id: 'loc-006',
  category: 'locators',
  kind: 'locator',
  title: 'Scope it! Product prices but not the promo banner',
  level: 'INTERMEDIATE',
  tags: ['css', 'descendant', 'scoping', 'inventory'],
  estMinutes: 8,
  scenario: `Your "prices are sorted low to high" test started failing after marketing added a **Deal of the day** banner to the inventory page.
Debugging shows your locator \`.item-price\` now returns **7** prices — the banner reuses the same CSS class for its discounted price,
so the first "price" in your list is $7.49 from the banner. Duplicate class names are everywhere in real apps.`,
  description: `On **inventory.html**, match the **6 product prices** inside the product list — but **not** the price inside the promo banner.

**Rules**
- Scope your selector to the product list container (look at its id).
- Exactly 6 elements.`,
  hints: [
    'Try .item-price in the Locator Lab first and see that it matches 7.',
    'The cards live inside <div id="inventory-list">.',
    'Descendant combinator: #inventory-list .item-price',
  ],
  page: 'inventory.html',
  strategy: 'either',
  expected: '#inventory-list .item-price',
  expectedCount: 6,
  solution: `CSS:    #inventory-list .item-price
XPath:  //div[@id='inventory-list']//div[@class='item-price']

Java:
List<Double> prices = driver.findElements(By.cssSelector("#inventory-list .item-price"))
        .stream()
        .map(e -> Double.parseDouble(e.getText().replace("$", "")))
        .toList();`,
  explanation: `A space in CSS (\`A B\`) is the **descendant combinator**: B anywhere inside A. XPath's equivalent is \`//\` between steps.
Starting from a stable container (\`#inventory-list\`) is called **scoping** and is one of the most useful habits in locator writing:
a class may be reused anywhere on the page, but "price inside the product list" has one meaning.

In Page Objects you can scope with element chaining too: \`driver.findElement(By.id("inventory-list")).findElements(By.className("item-price"))\`.`,
  mistakes: [
    'Fixing it with an index: (//div[@class="item-price"])[position()>1] — breaks again when the banner moves or disappears.',
    'Using > (child) instead of a space — the price is several levels below the list, so #inventory-list > .item-price matches nothing.',
    'In XPath, using /div instead of //div between steps — single slash means direct child only.',
  ],
  interview: [
    {
      q: 'Your locator suddenly returns more elements than before. How do you debug it?',
      a: 'Run it in DevTools ($$("css") or $x("xpath") in the Console) to see every match, find the unexpected ones, then scope the locator to a stable parent container or use a more specific attribute instead of adding indexes.',
    },
    {
      q: 'What is element chaining (findElement on a WebElement)?',
      a: 'Calling findElement/findElements on a WebElement searches only inside that element. It is a clean way to scope, e.g. get a card first, then card.findElement(By.className("item-price")). Note an XPath used there must start with "." (.//div) to stay relative.',
    },
  ],
}
