export default {
  id: 'loc-027',
  category: 'locators',
  kind: 'locator',
  title: 'Rewrite a recorded index XPath: the T-shirt price that became $9.99',
  level: 'ADVANCED',
  tags: ['xpath', 'absolute-xpath', 'indexes', 'maintenance', 'inventory'],
  estMinutes: 12,
  scenario: `A price check from the old suite asserts that the **Classic Crew T-Shirt** costs **$15.99**. It was recorded as
\`/html/body/main/div[4]/div[3]/div[2]/div[2]/div[1]\` — "the 3rd product's price". Since release 2.4 it fails with
*expected $15.99 but was $9.99*. Nobody changed any prices: the developers made the product list **sort by name (A to Z) by default**, so the
3rd card is now the Pulse Bike Light. The test is not just broken — it is checking the wrong product.`,
  description: `On **inventory.html**, replace the recorded locator with a **robust XPath** that matches the **price of the Classic Crew T-Shirt**,
whatever position its card has.

**Rules**
- No \`/html\` paths and no position indexes (\`[3]\`, \`div[2]\`…).
- Anchor on the product name, then reach the price **inside the same card**.
- Do not match on the price text: the Retro Red Tee also costs $15.99, and the price is what the test verifies.
- Exactly 1 element.`,
  hints: [
    'Try the recorded path in the Console: $x("/html/body/main/div[4]/div[3]/div[2]/div[2]/div[1]") — it highlights $9.99.',
    'Card: div.inventory-item → a.item-name (name) and div.item-footer → div.item-price.',
    'Container that HAS the name, then down: //div[contains(@class,\'inventory-item\')][.//a[normalize-space()=\'Classic Crew T-Shirt\']]//div[contains(@class,\'item-price\')]',
  ],
  page: 'inventory.html',
  strategy: 'xpath',
  expected: '#item-3-title-link ~ .item-footer > .item-price',
  expectedCount: 1,
  solution: `XPath:  //div[contains(@class,'inventory-item')][.//a[normalize-space()='Classic Crew T-Shirt']]//div[contains(@class,'item-price')]
        //a[normalize-space()='Classic Crew T-Shirt']/following-sibling::div[contains(@class,'item-footer')]/div[contains(@class,'item-price')]

Java (Page Object, parameterised by product name):
private static final String PRICE_OF =
        "//div[contains(@class,'inventory-item')][.//a[normalize-space()='%s']]//div[contains(@class,'item-price')]";

public String priceOf(String product) {
    return driver.findElement(By.xpath(String.format(PRICE_OF, product))).getText();
}

Assert.assertEquals(inventoryPage.priceOf("Classic Crew T-Shirt"), "$15.99");`,
  explanation: `Read the recorded path as a manual test step: "go to the 4th div in main, then the 3rd card, the 2nd div, the 2nd div, the
1st div". Nothing in it says *T-shirt* or *price*. It was correct on the day it was recorded only because the HTML happened to list the T-shirt
third. A default sort, a new product, an A/B test or a "sold out" filter all change positions — and the index locator does not fail, it
**silently checks another product**. That is worse than a crash: a wrong-product price check can pass.

The robust version describes the element by **business data**:

\`\`\`
//div[contains(@class,'inventory-item')]                 every product card
   [.//a[normalize-space()='Classic Crew T-Shirt']]       … the one whose name link says Classic Crew T-Shirt
   //div[contains(@class,'item-price')]                   → its price
\`\`\`

Why not \`//div[.='$15.99']\`? Because the price is the thing under test — a locator built from the expected value can never catch a wrong
value — and two products share it.

Use \`contains(@class,…)\` rather than \`@class='item-price'\`: class lists grow (\`item-price on-sale\`), and an exact class string breaks.`,
  mistakes: [
    'Fixing the test by changing [3] to [1] — it breaks again on the next sort change or new product.',
    'Locating the price by its expected text ($15.99) — the assertion can then never fail, and Retro Red Tee matches too.',
    'Using a bare //div[contains(@class,\'item-price\')] after the name without staying inside the card — it can jump to other cards.',
    'Assuming the DOM order equals the HTML file order — JavaScript re-sorts the cards after load.',
  ],
  interview: [
    {
      q: 'Why are index-based locators dangerous even when they do not fail?',
      a: 'Because when the order changes they usually still find an element — just the wrong one. The test then asserts against another product or row and can pass or fail for the wrong reason. Locators should identify elements by stable meaning (id, test id, label, business key), not position.',
    },
    {
      q: 'When is an index acceptable in a locator?',
      a: 'For structure whose meaning is fixed by design, like "the 3rd column is Salary" (defined by the header), or when the test is explicitly about order ("the first item after sorting by price is the cheapest"). Even then, prefer deriving the index from the header text over hard-coding it.',
    },
    {
      q: 'How would you make this product locator reusable for every product?',
      a: 'Put the XPath template in the Page Object with a %s placeholder for the product name and build it with String.format in a method like priceOf(name) or addToCart(name). Test data then drives the locator.',
    },
  ],
}
