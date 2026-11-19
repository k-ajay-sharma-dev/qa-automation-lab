export default {
  id: 'loc-007',
  category: 'locators',
  kind: 'locator',
  title: 'Starts-with (^=): every "Add to cart" button',
  level: 'INTERMEDIATE',
  tags: ['css', 'attribute-operators', 'starts-with', 'inventory'],
  estMinutes: 8,
  scenario: `Regression ticket SHOP-512: "Add all products to the cart → badge shows 6". The buttons' test ids follow a pattern —
\`add-to-cart-<product-slug>\` — and the product list changes every season. You do not want six hard-coded locators that need
updating whenever merchandising adds a product. You want **one** locator that matches every button following the pattern.`,
  description: `On **inventory.html**, match all **6 "Add to cart" buttons** with one locator based on the **beginning** of their \`data-testid\`.

**Rules**
- Use the CSS "starts with" operator \`^=\` (or XPath \`starts-with()\`).
- Do not rely on the button text.
- Exactly 6 elements.`,
  hints: [
    'Every test id begins with add-to-cart-',
    'CSS: [attribute^="prefix"]',
    'XPath: //button[starts-with(@data-testid, "add-to-cart-")]',
  ],
  page: 'inventory.html',
  strategy: 'either',
  expected: '[data-testid^="add-to-cart-"]',
  expectedCount: 6,
  solution: `CSS:    [data-testid^='add-to-cart-']
XPath:  //button[starts-with(@data-testid,'add-to-cart-')]

Java:
List<WebElement> addButtons = driver.findElements(By.cssSelector("[data-testid^='add-to-cart-']"));
addButtons.forEach(WebElement::click);
Assert.assertEquals(driver.findElement(By.className("shopping-cart-badge")).getText(), "6");`,
  explanation: `CSS has three substring operators for attributes:

| Operator | Meaning | Example |
|---|---|---|
| \`^=\` | starts with | \`[id^='add-to-cart-']\` |
| \`$=\` | ends with | \`[id$='-backpack']\` |
| \`*=\` | contains | \`[id*='cart']\` |

XPath 1.0 (what browsers support) has \`starts-with()\` and \`contains()\` but **no** \`ends-with()\` — one of the few things CSS can
do that browser XPath cannot.

Bonus thought: after a click the button's test id changes to \`remove-...\`, so this locator naturally shrinks to 0 once all items
are added — handy for an assertion.`,
  mistakes: [
    'Using *= "cart" — it also matches the shopping-cart-link in the header.',
    'Iterating over the list and clicking while the DOM changes; here it works, but if clicking re-renders the list you get StaleElementReferenceException.',
    'Trying ends-with() in XPath — not available in XPath 1.0 used by browsers.',
  ],
  interview: [
    {
      q: 'Which CSS attribute operators do you know?',
      a: '[a=v] equals, [a^=v] starts with, [a$=v] ends with, [a*=v] contains substring, [a~=v] contains a whole space-separated word (useful for classes), [a|=v] equals or starts with v- (language codes).',
    },
    {
      q: 'Why is ends-with not usable in Selenium XPath?',
      a: 'Browsers implement XPath 1.0 and ends-with() was introduced in XPath 2.0. The workaround is substring(@id, string-length(@id) - n + 1) = "suffix" — or simply use CSS $=.',
    },
  ],
}
