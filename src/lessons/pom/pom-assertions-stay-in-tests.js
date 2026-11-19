export default {
  slug: 'pom-assertions-stay-in-tests',
  category: 'pom',
  order: 4,
  title: 'Assertions stay in the test',
  minutes: 6,
  summary: 'Keep page objects as neutral reporters of state and put every pass/fail decision, with a helpful message, in the test method.',
  manualAnalogy: `In a manual test case the *steps* column says what to do and the *expected result* column says what should happen. The person who follows the steps is not the one who decides what "correct" means — the test case is. A page object is the person following steps and reporting what they see; the test method holds the expected-result column.`,
  body: `## The tempting shortcut

It feels efficient to write a "verify" method in the page object:

\`\`\`java
// InventoryPage — anti-pattern
public void verifySortedLowToHigh() {
    List<Double> p = prices();
    Assert.assertTrue(p.get(0) <= p.get(1));
}
\`\`\`

Three problems appear quickly:

1. **No negative tests.** You want a test that proves sorting Z→A is *not* low-to-high. The page method can only ever say "pass if sorted". You end up writing \`verifyNotSorted…\` too.
2. **The page now depends on TestNG.** \`import org.testng.Assert\` in a page class ties every page to one test library. Switching a Cucumber step to AssertJ or JUnit means touching pages.
3. **Hidden expectations.** Reading the test, you cannot see what is checked — the expected values are buried in another file.

## The rule

> Page objects **return** state. Tests **assert** on it.

\`\`\`java
// InventoryPage — good
public List<Double> prices() { ... }          // returns numbers
public int cartCount() { ... }                 // returns a number
public boolean isLoaded() { ... }              // returns true/false
\`\`\`

\`\`\`java
// InventoryTest
@Test
public void sortLowToHighOrdersPrices() {
    List<Double> prices = inventory.sortBy("lohi").prices();
    List<Double> expected = new ArrayList<>(prices);
    Collections.sort(expected);
    Assert.assertEquals(prices, expected, "Prices not sorted low to high: " + prices);
}
\`\`\`

The expected result is visible right where the test is defined, and the same \`prices()\` method serves the high-to-low test unchanged.

## Choose return types that make good assertions

| You want to check | Page method returns | Test asserts |
|---|---|---|
| A banner's text | \`String getErrorMessage()\` | \`assertEquals(msg, "Error: ...")\` |
| How many items | \`int getItemCount()\` | \`assertEquals(count, 2)\` |
| Which items | \`List<String> getItemNames()\` | \`assertTrue(names.contains("Retro Red Tee"))\` |
| Whether something is shown | \`boolean isDisplayed...()\` | \`assertTrue(...)\` / \`assertFalse(...)\` |

Collecting a list of texts is a common need. A *stream* turns a list of elements into a list of strings:

\`\`\`java
return driver.findElements(itemNames).stream()   // List<WebElement>
        .map(WebElement::getText)                 // each element -> its text
        .toList();                                // List<String>
\`\`\`

## Write messages for the person reading the failure

Every TestNG assert takes an optional last argument: a message shown when it fails.

\`\`\`java
Assert.assertEquals(cart.getItemCount(), 2, "Cart should hold the 2 items added on inventory");
\`\`\`

Without it, the report says \`expected [2] but found [1]\` and the reader has to open the code. With it, the failure explains itself — just like a good defect title.

Note the argument order in TestNG: **actual first, expected second**. Swapping them makes failure messages misleading.

## What about "is the page loaded?"

A page *may* wait until it is ready (that is synchronisation, not verification). It returns \`isLoaded()\` and lets the test assert it. A wait that times out throws an exception, which fails the test anyway — that is fine and not an assertion.

## Where Cucumber fits

In a Cucumber framework the same rule applies: the \`@Then\` step definition makes the assertion, the page object only reports. Step definitions are the "tests" layer.`,
  keyPoints: [
    'Page objects report state (String, int, List, boolean); tests decide pass/fail.',
    'Asserts in pages block negative tests and tie pages to one test library.',
    'Pick return types that make the assertion obvious.',
    'Always add a failure message; TestNG order is actual, expected, message.',
    'In Cucumber, assertions live in `@Then` steps, not in page objects.',
  ],
  mistakes: [
    'Importing `org.testng.Assert` in a page class — remove it and return the value instead.',
    'Swapping actual and expected in `assertEquals` — the report then reads backwards.',
    'Asserting with no message — failures become puzzles in the CI report.',
    'Printing values with `System.out.println` instead of returning them.',
  ],
  tryIt: `Add two products on http://localhost:5180/practice-site/inventory.html, open the cart and inspect a row. Which selector would collect all product names (\`.cart-item .item-name\`)? Write the assertion line you would use to check one name is present — with a message.`,
  problems: ['pom-004', 'pom-014', 'pom-013'],
}
