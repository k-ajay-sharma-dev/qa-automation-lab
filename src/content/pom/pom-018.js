export default {
  id: 'pom-018',
  category: 'pom',
  kind: 'locator',
  title: 'Find the root of a component: the Pulse Bike Light card',
  level: 'BEGINNER',
  tags: ['pom', 'components', 'xpath', 'product-card'],
  estMinutes: 10,
  scenario: `You are about to build a \`ProductCard\` component: one object per product card on the inventory page, with
\`getName()\`, \`getPrice()\` and \`addToCart()\`. Every component like this starts from a **root element** — the
container that holds everything for one card. Your first job is to locate the root of the *Pulse Bike Light* card.
Careful: the promo banner above the list also mentions *Pulse Bike Light*.`,
  description: `On **inventory.html**, match the **card container** (\`div.inventory-item\`) of the *Pulse Bike Light* product.

**Rules**
- Anchor on the product name shown on the card, then select the card around it.
- Do not match the promo banner, the name link, or the button: the whole card \`div\`.
- No position/index locators — the list can be re-sorted.
- Exactly 1 element.`,
  hints: [
    'Structure: div.inventory-item > div.item-body > a.item-name ("Pulse Bike Light") ... button',
    'XPath predicate form: //div[contains(@class,"inventory-item")][.//a[normalize-space()="Pulse Bike Light"]]',
    'Alternative: start at the name and climb: //a[normalize-space()="Pulse Bike Light"]/ancestor::div[@data-testid="inventory-item"]',
  ],
  page: 'inventory.html',
  strategy: 'either',
  expected: '#inventory-list > .inventory-item:nth-of-type(3)',
  expectedCount: 1,
  solution: `XPath:  //div[@data-testid='inventory-item'][.//a[normalize-space()='Pulse Bike Light']]
        //a[normalize-space()='Pulse Bike Light']/ancestor::div[@data-testid='inventory-item']
CSS (modern browsers): .inventory-item:has(button[data-slug='pulse-bike-light'])

Java (the root of a ProductCard component):
private static final String CARD =
        "//div[@data-testid='inventory-item'][.//a[normalize-space()='%s']]";

WebElement root = driver.findElement(By.xpath(String.format(CARD, "Pulse Bike Light")));
ProductCard card = new ProductCard(root);
// inside ProductCard: root.findElement(By.cssSelector(".item-price")).getText()  ->  "$9.99"`,
  explanation: `A component scoped to a **root element** searches only inside that root: \`root.findElement(By.cssSelector(".item-price"))\`
can only ever return *this* card's price. That is what makes a \`ProductCard\` (pom-019) safe — but only if the root
itself is right.

Two good ways to express "the card that contains this name":
- **Predicate**: \`//div[@data-testid='inventory-item'][.//a[normalize-space()='Pulse Bike Light']]\` — reads like a sentence.
- **Climb**: start at the name and go up with \`ancestor::div[...]\` until you hit the card.

The trap: \`//*[contains(text(),'Pulse Bike Light')]/ancestor::div[1]\` also finds the text in the promo banner,
and \`ancestor::div[1]\` from the name is \`div.item-body\`, not the card. Anchoring on \`a\` (the name link) and
naming the container you want (\`@data-testid='inventory-item'\`) avoids both.`,
  mistakes: [
    'Matching the text anywhere (//*[contains(.,"Pulse Bike Light")]) which also hits the promo banner and every ancestor div.',
    'Stopping at the first parent (div.item-body) instead of the card container.',
    'Using inventory-item[3] — the default sort is A to Z and the user can switch to price order.',
  ],
  interview: [
    { q: 'What is a root element in a component object?', a: 'The container WebElement for one instance of a repeated widget (a card, a row). The component stores it and does every lookup with root.findElement, so all methods act on that one instance.' },
    { q: 'Why anchor on visible text for the root?', a: 'Tests speak the business language ("the Pulse Bike Light card") and the text survives re-sorting. It is only safe when the text is unique inside the right element, so you combine it with the element type and the container\'s attribute.' },
  ],
}
