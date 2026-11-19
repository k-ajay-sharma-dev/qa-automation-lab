export default {
  id: 'loc-004',
  category: 'locators',
  kind: 'locator',
  title: 'data-testid: the "Add to cart" button for one product',
  level: 'BEGINNER',
  tags: ['css', 'attribute', 'data-testid', 'inventory'],
  estMinutes: 7,
  scenario: `In the last retro the team agreed: "developers add data-testid to every interactive element, QA uses them".
Your first test with the new convention: add the **Trailblazer Backpack** to the cart. All six "Add to cart" buttons look identical
and share the same classes — but each one has its own \`data-testid\`.`,
  description: `On **inventory.html**, locate the **Add to cart** button of the **Trailblazer Backpack** using its \`data-testid\`.

**Rules**
- Use an attribute selector on \`data-testid\` (CSS \`[attr='value']\` or XPath \`@attr\`).
- Exactly 1 element.`,
  hints: [
    'Inspect the backpack button and look for data-testid="...".',
    'CSS attribute selector: [data-testid="..."]',
    'The value is add-to-cart-trailblazer-backpack',
  ],
  page: 'inventory.html',
  strategy: 'either',
  expected: '[data-testid="add-to-cart-trailblazer-backpack"]',
  expectedCount: 1,
  solution: `CSS:    [data-testid='add-to-cart-trailblazer-backpack']
XPath:  //button[@data-testid='add-to-cart-trailblazer-backpack']

Java:
driver.findElement(By.cssSelector("[data-testid='add-to-cart-trailblazer-backpack']")).click();`,
  explanation: `Attribute selectors \`[name='value']\` work for **any** attribute, which is how you use \`data-*\` attributes — Selenium
has no \`By.testId\`. Many frameworks wrap it in a helper:

\`\`\`java
private By testId(String id) { return By.cssSelector("[data-testid='" + id + "']"); }
\`\`\`

Watch out: after clicking, the button turns into **Remove** and its test id becomes \`remove-trailblazer-backpack\`.
That is realistic — toggled elements often change attributes, so a test that re-uses the old locator will not find it.`,
  mistakes: [
    'Using By.xpath("//button[text()=\'Add to cart\']") — it matches all 6 buttons and findElement clicks the first one (not the backpack once sorting changes).',
    'Forgetting the quotes in CSS when the value contains special characters.',
    'Re-using the add-to-cart locator after the click — the element now has a different test id.',
  ],
  interview: [
    {
      q: 'Is there a By.dataTestId in Selenium?',
      a: 'No. You use By.cssSelector("[data-testid=\'x\']") or an XPath with @data-testid. Most frameworks add a small helper method or a custom By to keep it short.',
    },
    {
      q: 'The button text toggles between "Add to cart" and "Remove". How would you assert the toggle?',
      a: 'Click it, then wait for the remove-<slug> test id (or for the text "Remove") with an explicit wait, and assert the cart badge count. Never assert immediately with a stale reference to the old element.',
    },
  ],
}
