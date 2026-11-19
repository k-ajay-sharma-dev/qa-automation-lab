export default {
  slug: 'pom-why-page-objects',
  category: 'pom',
  order: 1,
  title: 'Why Page Object Model? The maintenance problem',
  minutes: 6,
  summary: 'Explain why copy-pasted locators make a suite fragile, and describe what a page object is, what belongs in it and what does not.',
  manualAnalogy: `When you write manual test cases you do not repeat "the Login button is the blue one under the password field" in 40 test cases. You keep one screen map or glossary and the test steps say "click Login". If the button moves, you update the glossary once. Page Object Model is that glossary, written in Java: one class per screen that knows *where* things are and *how* to use them, so the tests only say *what* to do.`,
  body: `## The problem: every test knows the HTML

A beginner's Selenium test usually looks like this:

\`\`\`java
@Test
public void sortByPriceLowToHigh() {
    driver.get("http://localhost:5180/practice-site/login.html");
    driver.findElement(By.id("user-name")).sendKeys("standard_user");
    driver.findElement(By.id("password")).sendKeys("secret_sauce");
    driver.findElement(By.id("login-button")).click();
    new Select(driver.findElement(By.id("product-sort"))).selectByValue("lohi");
    // ... checks
}
\`\`\`

It works. Now imagine 40 tests that all begin with those login lines, and 15 that use \`product-sort\`. The day a developer renames an id, every copy breaks at once. Worse, the copies are rarely identical: one test uses \`By.id("password")\`, another \`By.cssSelector("#password")\`, a third an XPath. Find & Replace misses some, and each missed copy is a red test that someone must triage.

The real cost is not typing — it is **risk and review time**. One UI change becomes a 40-file change.

## The idea: separate *where* from *what*

Page Object Model (POM) is a design pattern, not a library. You create **one Java class per page (or per meaningful part of a page)**. That class:

| Owns | Does not own |
|---|---|
| The locators for its page (\`By\` fields) | Test data decisions ("which user to log in with") |
| Methods for the actions a user can do there (\`sortBy\`, \`addToCart\`) | Assertions — pass/fail is the test's job |
| Methods that *read* state (\`getTitle()\`, \`getCartCount()\`) | Creating or quitting the browser |
| Knowledge of which page comes next | Other pages' locators |

The test then reads like a manual test case:

\`\`\`java
@Test
public void sortByPriceLowToHigh() {
    InventoryPage inventory = new LoginPage(driver).open().loginAs("standard_user", "secret_sauce");
    inventory.sortBy("lohi");
    Assert.assertTrue(isAscending(inventory.prices()), "Prices are not low-to-high");
}
\`\`\`

No \`By\`, no \`findElement\` in the test. When \`product-sort\` changes, you fix one line in \`InventoryPage\` and all 15 tests are green again.

## What else POM buys you

1. **Readability.** A reviewer or a business analyst can read \`loginAs(...)\` then \`sortBy(...)\` without knowing Selenium.
2. **Reuse.** \`loginAs\` is written once and used by every test that needs a logged-in user.
3. **One place for waits.** If clicking needs a wait, the page method does it; tests never sprinkle \`Thread.sleep\`.
4. **Encapsulation.** Locators are \`private\`, so a test *cannot* reach around the page object and hard-code a locator again. The compiler enforces the design.

## How big should a page object be?

"One class per page" is a guideline. A 140-locator \`ShopEasyPage\` that covers login, inventory, cart and checkout is just the copy-paste problem moved into one giant file. Split by screen (\`LoginPage\`, \`InventoryPage\`, \`CartPage\`), and pull repeated parts such as the header into **components** (see the *BasePage and components* lesson).

## Common anti-patterns you will be asked to spot

- **Public locators** — a test does \`driver.findElement(inventory.sortDropdown)\`. The page object no longer hides anything.
- **Asserts inside page methods** — the page decides pass/fail, so it cannot be reused for a negative test (see *Assertions stay in the test*).
- **A static shared \`WebDriver\`** in a utility class — breaks parallel runs (see *DriverManager, ThreadLocal and BaseTest*).
- **\`Thread.sleep\` in tests** — waits belong in the page/BasePage, and should be explicit waits.
- **Wrong return type** — a method returns \`CartPage\` but the click actually lands on a product details page. The return type must tell the truth about where the user ends up.`,
  keyPoints: [
    'Duplicated locators turn one UI change into many risky edits; POM keeps each locator in exactly one place.',
    'A page object owns locators, actions and state-reading methods for one page — not assertions, not browser setup.',
    'Locators are private so tests cannot bypass the page object.',
    'Tests written with page objects read like manual test steps.',
    'Split big pages into smaller page objects and components instead of one god class.',
  ],
  mistakes: [
    'Thinking Find & Replace is a fix — copies drift (id vs CSS vs XPath). Centralise the locator instead.',
    'Making locators `public` "just for this one test" — add a method that returns what the test needs.',
    'Putting `Assert` calls in the page object — return values and let the test assert.',
    'Building one giant page class for the whole site — split by screen and extract components.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/inventory.html and list, on paper, what a user can **do** (sort, add to cart, open cart, log out) and what they can **see** (title, cart badge count, prices). That list is the public API of your future \`InventoryPage\`; the ids you used to find them become its private locators.`,
  problems: ['pom-001', 'pom-014'],
}
