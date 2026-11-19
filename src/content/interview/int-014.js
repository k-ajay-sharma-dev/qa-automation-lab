export default {
  id: 'int-014',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: verify products are sorted by price (low to high)',
  level: 'INTERMEDIATE',
  tags: ['java', 'live-coding', 'selenium', 'sorting', 'Select', 'collections'],
  estMinutes: 20,
  scenario: `This is the most common **Selenium** live-coding question in QA interviews: *"Select 'Price (low to high)' from the sort dropdown and verify the products are sorted."* The trap: candidates sort the price **strings**, which passes or fails for the wrong reasons — "$15.99" comes before "$9.99" alphabetically.`,
  description: `Fix \`SortTest.productsAreSortedByPriceLowToHigh()\` on the ShopEasy inventory page:

1. Select **"Price (low to high)"** in the \`#product-sort\` dropdown using Selenium's \`Select\` class.
2. Read all \`#inventory-list .item-price\` texts (scope to the list — the promo banner above it has a decoy \`.item-price\`).
3. Convert each \`"$29.99"\` into a number (\`BigDecimal\` or \`double\`).
4. Make a **copy**, sort the copy, and assert the original equals the sorted copy.

**Rules / Acceptance**
- Do not sort the strings — parse to numbers first.
- Sort a *copy* (\`new ArrayList<>(actual)\`), otherwise you compare a list with itself.
- Wait for the list to be visible after sorting; no \`Thread.sleep\`.
- Include the actual list in the assertion message.`,
  hints: [
    'new Select(driver.findElement(SORT_DROPDOWN)).selectByVisibleText("Price (low to high)");',
    'new BigDecimal(text.replace("$", "").replace(",", "").trim())',
    'List<BigDecimal> expected = new ArrayList<>(actual); Collections.sort(expected); Assert.assertEquals(actual, expected, ...);',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SortTest extends BaseTest {

    private final By SORT_DROPDOWN = By.id("product-sort");
    private final By PRICES = By.cssSelector("#inventory-list .item-price");

    @Test
    public void productsAreSortedByPriceLowToHigh() throws InterruptedException {
        driver.findElement(SORT_DROPDOWN).sendKeys("Price (low to high)");
        Thread.sleep(2000);

        List<String> actual = new ArrayList<>();
        for (WebElement price : driver.findElements(PRICES)) {
            actual.add(price.getText()); // "$29.99"
        }
        List<String> expected = actual;
        Collections.sort(expected);
        Assert.assertEquals(actual, expected);
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SortTest extends BaseTest {

    private final By SORT_DROPDOWN = By.id("product-sort");
    private final By PRICES = By.cssSelector("#inventory-list .item-price");

    @Test
    public void productsAreSortedByPriceLowToHigh() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        new Select(driver.findElement(SORT_DROPDOWN)).selectByVisibleText("Price (low to high)");
        List<WebElement> priceElements = wait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(PRICES));

        List<BigDecimal> actual = new ArrayList<>();
        for (WebElement price : priceElements) {
            actual.add(new BigDecimal(price.getText().replace("$", "").replace(",", "").trim()));
        }

        List<BigDecimal> expected = new ArrayList<>(actual); // a COPY
        Collections.sort(expected);

        Assert.assertFalse(actual.isEmpty(), "No prices found on the inventory page");
        Assert.assertEquals(actual, expected, "Prices are not sorted low to high: " + actual);
    }
}
`,
  checks: [
    { label: 'Uses the Select class for the dropdown', pattern: 'new\\s+Select\\s*\\([\\s\\S]*selectBy(VisibleText|Value|Index)\\s*\\(', flags: 'ms', hint: 'new Select(element).selectByVisibleText("Price (low to high)")' },
    { label: 'Parses prices into numbers', pattern: '(new\\s+BigDecimal\\s*\\(|Double\\.parseDouble\\s*\\(|BigDecimal::new|Double::parseDouble)', hint: 'Sorting strings puts "$15.99" before "$9.99"' },
    { label: 'Sorts a COPY of the list', pattern: 'new\\s+ArrayList\\s*<\\s*\\w*\\s*>\\s*\\(\\s*actual\\s*\\)', hint: 'List<BigDecimal> expected = new ArrayList<>(actual);' },
    { label: 'Sorts the copy', pattern: '(Collections\\.sort\\s*\\(|\\.sort\\s*\\(|\\.sorted\\s*\\()', hint: 'Collections.sort(expected);' },
    { label: 'Asserts actual equals the sorted copy with a message', pattern: 'assertEquals\\s*\\(\\s*actual\\s*,\\s*expected\\s*,', hint: 'Assert.assertEquals(actual, expected, "…" + actual)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the prices to be visible instead' },
  ],
  explanation: `**The three bugs in the starter (say them out loud in the interview):**
1. \`List<String> expected = actual;\` — that's the **same list object**, not a copy. Sorting \`expected\` also sorts \`actual\`, so the assertion compares a list with itself and **always passes**. A test that can't fail is worse than no test.
2. Sorting **strings**: \`"$15.99" < "$9.99"\` alphabetically because \`'1' < '9'\`. Parse to \`BigDecimal\` first.
3. \`Thread.sleep(2000)\` + \`sendKeys\` on a \`<select>\` — use the \`Select\` class and an explicit wait.

**Descending order:** \`expected.sort(Collections.reverseOrder())\` or \`Comparator.reverseOrder()\`.
**Sorting by name A→Z:** compare with \`String.CASE_INSENSITIVE_ORDER\` if the UI sorts case-insensitively — ask the BA what the rule is (your manual-testing instinct!).

**Stream version** (bonus):
\`\`\`java
List<BigDecimal> actual = priceElements.stream()
        .map(e -> new BigDecimal(e.getText().replaceAll("[^0-9.]", "")))
        .toList();
Assert.assertEquals(actual, actual.stream().sorted().toList());
\`\`\``,
  mistakes: [
    'Assigning expected = actual (same reference) — the test can never fail.',
    'Sorting price strings instead of numbers.',
    'Using sendKeys on a <select> instead of the Select class.',
    'Not checking the list is non-empty — an empty list is always "sorted".',
  ],
  interview: [
    { q: 'How do you verify that a list on the page is sorted?', a: 'I read the elements into a List, convert them to the right type — numbers for prices, dates for dates — then make a copy, sort the copy with Collections.sort or a Comparator, and assert the original equals the sorted copy. I also assert the list is not empty, because an empty list is trivially sorted.' },
    { q: 'How do you handle a dropdown in Selenium?', a: 'For a native <select> I use the Select class with selectByVisibleText, selectByValue or selectByIndex, and getFirstSelectedOption to verify. For custom dropdowns built from divs I click to open and click the option by its text with an explicit wait.' },
    { q: 'Why did your sorted check pass even though the UI was wrong?', a: 'Because expected = actual copies the reference, not the list, so sorting one sorted both. Using new ArrayList<>(actual) creates an independent copy.' },
  ],
}
