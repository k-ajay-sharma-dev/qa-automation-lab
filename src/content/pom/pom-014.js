export default {
  id: 'pom-014',
  category: 'pom',
  kind: 'quiz',
  title: 'Code review: spot the POM anti-patterns',
  level: 'ADVANCED',
  tags: ['pom', 'code-review', 'anti-patterns'],
  estMinutes: 15,
  scenario: `You are now a reviewer on the ShopEasy automation repo. A new joiner opened PR #87 "Add product sorting tests".
The tests pass locally, but your job in review is to protect the framework for the next two years.
Read each snippet from the PR and pick the most important review comment.`,
  description: `Each question shows a piece of the PR. Choose the comment a senior SDET would leave.`,
  questions: [
    {
      q: `\`\`\`java
public class InventoryPage extends BasePage {
    public By sortDropdown = By.id("product-sort");
    public By productNames = By.cssSelector(".inventory-item .item-name");
    ...
}
// in the test
driver.findElement(inventoryPage.sortDropdown).click();
\`\`\``,
      options: [
        'Rename sortDropdown to SORT_DROPDOWN',
        'Locators are public and the test uses them directly; make them private and add sortBy(String) to the page',
        'Use @FindBy instead',
        'Looks fine',
      ],
      answer: 1,
      why: 'Public locators let tests bypass the page API, which recreates the 40-places-to-fix problem. Expose behaviour (sortBy("Price (low to high)")) instead. Naming and PageFactory are secondary.',
    },
    {
      q: `\`\`\`java
public void sortBy(String option) {
    new Select(driver.findElement(sortDropdown)).selectByVisibleText(option);
    Assert.assertEquals(getFirstProductName(), "Junior Onesie");
}
\`\`\``,
      options: [
        'Use selectByValue instead',
        'The page asserts a business outcome; sortBy should only sort and the test should assert the order',
        'Add Thread.sleep(500) after selecting',
        'Wrap it in try/catch',
      ],
      answer: 1,
      why: 'An assertion inside sortBy means you can no longer sort by any other option, and the expected value is hidden from the reader of the test. Pages report, tests judge.',
    },
    {
      q: `\`\`\`java
public class TestUtils {
    public static WebDriver driver = new ChromeDriver();
}
\`\`\``,
      options: [
        'Make it final',
        'Static shared driver breaks parallel runs and starts a browser at class-load time; use DriverManager with ThreadLocal and BaseTest lifecycle',
        'Use FirefoxDriver for speed',
        'Add a comment explaining it',
      ],
      answer: 1,
      why: 'A static driver is shared across threads and is created as soon as the class loads, outside the test lifecycle. That is pom-011 / pom-012 territory.',
    },
    {
      q: `\`\`\`java
public InventoryPage sortBy(String option) { ... return new InventoryPage(driver); }
public CartPage clickProduct(String name) { ... return new CartPage(driver); }
\`\`\`
Clicking a product opens the **product details** page, not the cart.`,
      options: [
        'Fine, the test can ignore the return value',
        'Wrong return type: clickProduct should return ProductDetailsPage; also sortBy staying on the page should return this',
        'All methods should return void',
        'Return Object so it fits any page',
      ],
      answer: 1,
      why: 'Return types are documentation the compiler enforces. Returning the wrong page lets a test call cart methods on the details page and fail with confusing NoSuchElement errors. Same-page actions return this.',
    },
    {
      q: `\`\`\`java
public class ShopEasyPage extends BasePage {
    // 140 locators and 95 methods for login, inventory, cart, checkout, admin table...
}
\`\`\``,
      options: [
        'Good: one place for everything',
        'God object: split into one page object per page plus components (Header, ProductCard)',
        'Move it to BasePage',
        'Convert to static methods',
      ],
      answer: 1,
      why: 'A single huge class defeats the point of POM: merge conflicts, no navigation modelling, and nobody can find anything. One class per page/component keeps responsibilities small.',
    },
    {
      q: `\`\`\`java
@Test
public void sortByPrice() throws Exception {
    inventory.sortBy("Price (low to high)");
    Thread.sleep(2000);
    List<String> prices = inventory.getPrices();
    Assert.assertTrue(prices.size() > 0);
}
\`\`\``,
      options: [
        'Only the sleep is a problem',
        'Two issues: the hard sleep (wait in the page instead), and the assertion does not verify sorting at all; compare against a sorted copy',
        'Use assertFalse instead',
        'Nothing; it passes',
      ],
      answer: 1,
      why: 'Your manual QA instinct matters here: a test that passes when the feature is broken is worse than no test. Assert that prices equal a sorted copy of themselves. And synchronisation belongs in the page (wait for the list to re-render), not a sleep in the test.',
    },
  ],
  hints: ['Look for: public locators, assertions in pages, static drivers, wrong return types, god classes, weak asserts.'],
  explanation: `The POM review checklist you can paste into your team's PR template:

- [ ] Locators are \`private\` and live only in page/component classes.
- [ ] No \`Assert\` in page objects; tests assert with messages.
- [ ] Methods named by user intent; navigation returns the correct next page, same-page actions return \`this\`.
- [ ] No \`Thread.sleep\`; waits are in BasePage helpers.
- [ ] No static/shared WebDriver; lifecycle in BaseTest via DriverManager.
- [ ] One class per page/component; no god classes.
- [ ] Assertions actually prove the requirement (would the test fail if the feature broke?).`,
  mistakes: [
    'Approving a PR because "the tests are green".',
    'Commenting only on naming/style and missing structural problems.',
    'Not checking whether the assertion would fail when the feature is broken.',
  ],
  interview: [
    { q: 'What do you look for when reviewing automation code?', a: 'Encapsulation (private locators, no assertions in pages), synchronisation (explicit waits, no sleeps), thread safety (no static driver), correct navigation modelling, clear naming, meaningful assertions with messages, and that the test would actually fail if the feature broke.' },
    { q: 'Name three common POM anti-patterns.', a: 'Public locators used directly in tests, assertions inside page objects, and god page classes covering the whole app. Static shared WebDriver and Thread.sleep are close runners-up.' },
  ],
}
