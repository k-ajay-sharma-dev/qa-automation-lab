export default {
  id: 'loc-041',
  category: 'locators',
  kind: 'locator',
  title: 'Re-rendered list: the price next to "Pulse Bike Light"',
  level: 'ADVANCED',
  tags: ['xpath', 'following-sibling', 'stale-element', 'waits', 'dynamic-list'],
  estMinutes: 10,
  scenario: `Defect SE-402: "Pulse Bike Light price shows the wrong amount after Refresh prices." On waits.html the price list is thrown away
and rebuilt by JavaScript on every refresh, and the prices change each time. The old test used \`#price-list li:nth-of-type(2) .price\` —
which silently checked the *wrong product* when the list order changed in a feature branch, and threw StaleElementReferenceException when a
WebElement was reused after the refresh.`,
  description: `On **waits.html** (section 6, "Re-rendered list"), write a locator that matches **only the price \`<span>\` of Pulse Bike Light**.

**Rules**
- Anchor on the product name text, not on the row position.
- The price must be found *relative to* the product name in the same row.
- It must match exactly 1 element.`,
  hints: [
    'Each row is <li class="price-row"><span class="product">NAME</span> — <span class="price">$x.xx</span></li>.',
    'Find the product span by text, then step sideways to its sibling with following-sibling::.',
    '//span[@class=\'product\' and text()=\'Pulse Bike Light\']/following-sibling::span[@class=\'price\']',
  ],
  page: 'waits.html',
  strategy: 'either',
  expected: '#price-list li:nth-of-type(2) .price',
  expectedCount: 1,
  solution: `XPath:  //ul[@id='price-list']//span[@class='product' and normalize-space()='Pulse Bike Light']/following-sibling::span[@class='price']
 (also fine: //li[span[@class='product']='Pulse Bike Light']/span[@class='price'])

Java — keep the By, never the WebElement, across a re-render:
By bikeLightPrice = By.xpath("//ul[@id='price-list']//span[@class='product' and normalize-space()='Pulse Bike Light']"
        + "/following-sibling::span[@class='price']");
WebElement oldPrice = driver.findElement(bikeLightPrice);
driver.findElement(By.id("refresh-prices-btn")).click();
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
wait.until(ExpectedConditions.stalenessOf(oldPrice));          // old list is gone
String price = wait.until(ExpectedConditions.visibilityOfElementLocated(bikeLightPrice)).getText();
Assert.assertTrue(price.matches("\\\\$\\\\d+\\\\.\\\\d{2}"), "Unexpected price format: " + price);`,
  explanation: `Two problems, two fixes:

1. **Which element?** Anchor on business data the test cares about (the product name) and walk to the value with
   \`following-sibling::\`. Row order no longer matters. CSS cannot do this — it has no "contains text" — so XPath is the right tool.
2. **When?** The list is replaced, not updated, so any \`WebElement\` captured before the click points at a detached node →
   \`StaleElementReferenceException\`. Store the **\`By\`** (or Page Factory proxy) and look the element up again after the refresh. Waiting for
   \`stalenessOf(oldElement)\` first proves the re-render actually happened, so you do not read the old price by accident.

A good locator survives *layout* changes; a good test also survives *time* (re-renders).`,
  mistakes: [
    'Row index (li[2]) — checks a different product as soon as the list order changes.',
    'Caching the WebElement in a field and reusing it after "Refresh prices" → StaleElementReferenceException.',
    'Reading the price straight after the click without waiting — you read the spinner or the old list.',
    'Catching StaleElementReferenceException in a retry loop instead of re-locating by a stored By.',
  ],
  interview: [
    {
      q: 'Explain StaleElementReferenceException and how you prevent it.',
      a: 'A WebElement is a reference to one specific DOM node. When the page re-renders and replaces that node, the reference is stale even if an identical-looking element exists. Prevent it by storing locators (By) and finding elements fresh after actions that re-render, waiting for stalenessOf the old one or for the new state.',
    },
    {
      q: 'How would you write this in Playwright?',
      a: 'page.locator(\'#price-list li\').filter({ hasText: \'Pulse Bike Light\' }).locator(\'.price\'). Playwright locators are lazy and re-resolved on every action, so stale elements do not exist there — a big reason teams like it for SPAs.',
    },
    {
      q: 'Why not just use //span[contains(text(),\'$\')][2]?',
      a: 'It is still position-based and depends on how many prices appear before it. The test intent is "the price of Pulse Bike Light", so the locator should contain that name.',
    },
  ],
}
