export default {
  id: 'java-011',
  category: 'java',
  kind: 'code',
  title: 'List<WebElement> to List<Double>: verify "sort by price" really sorts',
  level: 'INTERMEDIATE',
  tags: ['collections', 'list', 'sorting', 'findElements'],
  estMinutes: 25,
  scenario: `Bug SHOP-812: "Sort by price: Low to High puts $1,050 before $99". It slipped through because the old test only checked that the first card was
the cheapest. You have been asked to write the proper check that every QA automation engineer writes at some point: read **all** prices,
make a sorted copy, and compare the two lists.`,
  description: `Implement the two methods in \`SearchResultsPage\`.

**Acceptance**
* \`List<Double> getDisplayedPrices()\`
  * gets all price elements with \`driver.findElements(...)\` into a \`List<WebElement>\`,
  * loops over them, parses each \`getText()\` (e.g. \`"$1,050.00"\`) into a \`Double\`, and adds it to a new \`ArrayList\`,
  * returns the list in **page order**.
* \`boolean arePricesSortedAscending()\`
  * fails fast if the page shows no prices (an empty list is "sorted" but is a bug),
  * creates a **copy** of the list (\`new ArrayList<>(actual)\`), sorts the copy (\`Collections.sort\` or \`.sort(...)\`),
  * returns whether the copy \`equals\` the original.`,
  hints: [
    'List<WebElement> priceElements = driver.findElements(priceLocator);',
    'Sorting the original list and comparing it with itself is always true — sort a copy.',
    'Two Lists are equal when they have the same elements in the same order: expected.equals(actual).',
  ],
  language: 'java',
  starterCode: `package com.shop.pages;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class SearchResultsPage {

    private final WebDriver driver;
    private final By priceLocator = By.cssSelector(".product-card .price");

    public SearchResultsPage(WebDriver driver) {
        this.driver = driver;
    }

    public List<Double> getDisplayedPrices() {
        // Old check: only looked at the first card
        String first = driver.findElement(priceLocator).getText();
        // TODO: read ALL prices into a List<Double> in page order
        return null;
    }

    public boolean arePricesSortedAscending() {
        // TODO: copy, sort the copy, compare with the original
        return true;
    }
}
`,
  solution: `package com.shop.pages;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class SearchResultsPage {

    private final WebDriver driver;
    private final By priceLocator = By.cssSelector(".product-card .price");

    public SearchResultsPage(WebDriver driver) {
        this.driver = driver;
    }

    public List<Double> getDisplayedPrices() {
        List<WebElement> priceElements = driver.findElements(priceLocator);
        List<Double> prices = new ArrayList<>();
        for (WebElement element : priceElements) {
            String text = element.getText().replace("$", "").replace(",", "").trim();
            prices.add(Double.parseDouble(text));
        }
        return prices;
    }

    public boolean arePricesSortedAscending() {
        List<Double> actual = getDisplayedPrices();
        if (actual.isEmpty()) {
            throw new IllegalStateException("No prices displayed - cannot verify sorting");
        }
        List<Double> expected = new ArrayList<>(actual);   // copy, keep page order intact
        Collections.sort(expected);
        return expected.equals(actual);
    }
}

// In the test:
// Assert.assertTrue(results.arePricesSortedAscending(), "Prices not sorted: " + results.getDisplayedPrices());
`,
  checks: [
    { label: 'Collects all elements with findElements', pattern: 'List\\s*<\\s*WebElement\\s*>\\s+\\w+\\s*=\\s*driver\\.findElements\\s*\\(', hint: 'List<WebElement> priceElements = driver.findElements(priceLocator);' },
    { label: 'Builds a new list of numbers', pattern: 'List\\s*<\\s*Double\\s*>\\s+\\w+\\s*=\\s*new\\s+ArrayList\\s*<', hint: 'List<Double> prices = new ArrayList<>();' },
    { label: 'Loops over the WebElements and reads getText()', pattern: '(for\\s*\\(\\s*WebElement\\s+\\w+\\s*:|\\.get\\s*\\(\\s*i\\s*\\))[\\s\\S]*getText\\s*\\(', hint: 'for (WebElement element : priceElements) { ... element.getText() ... }' },
    { label: 'Sorts a copy, not the original', pattern: 'new\\s+ArrayList\\s*<\\s*\\w*\\s*>\\s*\\(\\s*\\w+\\s*\\)', hint: 'List<Double> expected = new ArrayList<>(actual);' },
    { label: 'Sorts the copy', pattern: '(Collections\\.sort\\s*\\(|\\.sort\\s*\\()', hint: 'Collections.sort(expected);' },
    { label: 'Compares sorted copy with page order', pattern: '\\w+\\.equals\\s*\\(\\s*\\w+\\s*\\)', hint: 'return expected.equals(actual);' },
    { label: 'Guards against an empty result list', pattern: '\\.isEmpty\\s*\\(\\s*\\)|\\.size\\s*\\(\\s*\\)\\s*(==|>|<)', hint: 'if (actual.isEmpty()) throw ...' },
  ],
  explanation: `The **sorted-copy** technique is the standard way to verify sorting in UI automation:

1. \`findElements\` returns \`List<WebElement>\` — possibly empty, never an exception.
2. Convert to the *business* type (\`List<Double>\`). Comparing Strings would sort alphabetically: \`"$1,050.00"\` < \`"$99.00"\` — that's literally the bug in SHOP-812.
3. \`new ArrayList<>(actual)\` makes an independent copy; \`Collections.sort\` sorts it in natural (ascending) order. For descending use \`expected.sort(Collections.reverseOrder())\`.
4. \`List.equals\` checks same size, same elements, same order.

Key collection facts used here: \`List\` keeps insertion order and allows duplicates (two products can cost the same); \`ArrayList\` is the default implementation; collections hold objects, so \`double\` is auto-boxed into \`Double\`.

The empty-list guard matters: if the locator breaks, an empty list is trivially "sorted" and the test would pass while testing nothing.`,
  mistakes: [
    'Sorting the original list and comparing it with itself — always true.',
    'Comparing price Strings, which sorts "$1,050" before "$99".',
    'Not guarding the empty list — a broken locator makes the test pass.',
    'Using findElement (singular) and checking only the first card.',
  ],
  interview: [
    { q: 'How do you verify that a list of products is sorted in Selenium?', a: 'Read all values with findElements into a list in page order, convert them to the right type, create a copy, sort the copy (Collections.sort or stream().sorted()), and assert the copy equals the original. Also assert the list is not empty.' },
    { q: 'Difference between findElement and findElements?', a: 'findElement returns the first matching WebElement and throws NoSuchElementException if none; findElements returns a List<WebElement> that is empty when nothing matches. findElements is also the safe way to check absence of an element.' },
    { q: 'ArrayList vs LinkedList?', a: 'ArrayList is backed by an array: fast random access by index, the default choice. LinkedList has cheap inserts/removes at the ends but slow index access. In test code ArrayList is almost always the right one.' },
  ],
}
