export default {
  id: 'java-003',
  category: 'java',
  kind: 'code',
  title: 'Loop over product prices to verify a price filter',
  level: 'BEGINNER',
  tags: ['loops', 'if-else', 'lists'],
  estMinutes: 15,
  scenario: `The product team shipped a "Price: $10 – $100" filter on the search page. Manually you would scan 40 product cards and eyeball each price.
In automation you collect all price texts from the page into a list (\`driver.findElements(...)\` + \`getText()\`), then **loop** over them and check each one with an **if**.
Here the list is already collected for you, so you can focus purely on the loop logic.`,
  description: `Complete \`main\` so that it verifies every price is within \`min\`..\`max\` (inclusive).

**Acceptance**
* Loop over \`priceTexts\` (a for-each loop is ideal).
* Convert each text to a \`double\` (remove the \`$\`).
* Use an \`if\` to detect prices **below min or above max** and collect the offending texts in a \`List<String>\` — do not stop at the first failure, a good test reports *all* bad values.
* Also track the highest price seen and print it.
* At the end, if anything was out of range, fail the check by throwing \`new AssertionError(...)\` with a message listing the bad prices (in TestNG you would use \`Assert.fail\` / \`assertTrue\`).`,
  hints: [
    'for (String text : priceTexts) { ... } visits each element once.',
    'if (price < min || price > max) — the || means "either condition is true".',
    'Create List<String> outOfRange = new ArrayList<>(); before the loop and outOfRange.add(text) inside it.',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.util.ArrayList;
import java.util.List;

public class PriceFilterCheck {

    public static void main(String[] args) {
        double min = 10.00;
        double max = 100.00;
        // what driver.findElements(By.cssSelector(".product-card .price")) + getText() gave us
        List<String> priceTexts = List.of("$12.50", "$99.99", "$45.00", "$105.00", "$10.00");

        // TODO: create a list to collect out-of-range prices
        // TODO: loop over priceTexts, parse each price, check it against min/max
        // TODO: track and print the highest price
        // TODO: fail with an AssertionError listing every bad price
    }
}
`,
  solution: `package com.shop.tests;

import java.util.ArrayList;
import java.util.List;

public class PriceFilterCheck {

    public static void main(String[] args) {
        double min = 10.00;
        double max = 100.00;
        List<String> priceTexts = List.of("$12.50", "$99.99", "$45.00", "$105.00", "$10.00");

        List<String> outOfRange = new ArrayList<>();
        double highest = 0;

        for (String text : priceTexts) {
            double price = Double.parseDouble(text.replace("$", "").trim());

            if (price < min || price > max) {
                outOfRange.add(text);
            }
            if (price > highest) {
                highest = price;
            }
        }

        System.out.println("Checked " + priceTexts.size() + " products, highest price = " + highest);

        if (!outOfRange.isEmpty()) {
            throw new AssertionError("Prices outside $" + min + " - $" + max + ": " + outOfRange);
        }
        System.out.println("PASS: all prices within the filter range");
    }
}
`,
  checks: [
    { label: 'Loops over the prices', pattern: '(for\\s*\\(|while\\s*\\(|\\.forEach\\s*\\()', hint: 'for (String text : priceTexts) { ... }' },
    { label: 'Parses each price', pattern: '(Double\\.parseDouble|Double\\.valueOf|new\\s+BigDecimal)\\s*\\(', hint: 'Double.parseDouble(text.replace("$", ""))' },
    { label: 'Uses if with a range comparison', pattern: 'if\\s*\\([^)]*[<>]', hint: 'if (price < min || price > max)' },
    { label: 'Collects all failures in a list', pattern: '\\.add\\s*\\(', hint: 'outOfRange.add(text) instead of stopping at the first failure' },
    { label: 'Fails the check when something is out of range', pattern: '(throw\\s+new\\s+AssertionError|Assert\\.(fail|assertTrue)|assertTrue\\s*\\()', hint: 'throw new AssertionError("..." + outOfRange)' },
  ],
  explanation: `This is the shape of most "verify every item on the page" tests: **collect → loop → check → report**.

* A **for-each loop** (\`for (String text : priceTexts)\`) is the clearest way to visit every element; you only need an index loop when you need the position (e.g. "card #3 is wrong").
* The **if** with \`||\` encodes the business rule. Writing the rule as \`price < min || price > max\` (the *failure* condition) keeps the code close to the bug report you would write.
* **Soft collection**: adding failures to a list and failing once at the end gives a report like \`[$105.00]\` instead of stopping at the first bad card — far more useful when triaging a CI failure.
* \`throw new AssertionError(...)\` is what TestNG/JUnit assertions do internally; a test framework marks the test as failed when it sees it.

Note that \`$10.00\` passes because the range is inclusive — boundary values are where filters usually break, so a good test data set always contains them.`,
  mistakes: [
    'Returning or failing on the first bad price, hiding the other failures.',
    'Using && instead of || — a price can never be below min AND above max, so the check never fails.',
    'Comparing the price texts as Strings ("$105.00".compareTo("$99.99") is alphabetical, not numeric).',
    'Forgetting boundary values in the test data (exactly min and exactly max).',
  ],
  interview: [
    { q: 'When would you use a classic for (int i = 0; ...) loop instead of for-each?', a: 'When you need the index — e.g. to report which card failed, to compare element i with element i+1 for a sorting check, or to iterate two lists in parallel. Otherwise for-each is shorter and avoids off-by-one errors.' },
    { q: 'Why collect failures instead of failing immediately?', a: 'One run then reports every defect on the page, which saves re-runs and gives developers the full picture. TestNG SoftAssert and AssertJ SoftAssertions do the same thing with a framework API.' },
    { q: 'How do you get the list of prices from the page in Selenium?', a: 'driver.findElements(By.cssSelector(".product-card .price")) returns a List<WebElement>; loop over it and call getText() on each element. findElements returns an empty list (no exception) if nothing matches, so also assert the list is not empty.' },
  ],
}
