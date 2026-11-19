export default {
  id: 'sel-004',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Sort products by price with the Select class',
  level: 'BEGINNER',
  tags: ['select', 'dropdown', 'findElements'],
  estMinutes: 15,
  scenario: `Bug SHOP-212 was reopened twice: "Price (low to high)" sometimes shows a \$49.99 item before a \$7.99 one. The dev fixed it again and asked QA to add an automated check so it never silently regresses. The sort control on \`inventory.html\` is a native \`<select>\` element.`,
  description: `Log in (or open \`http://localhost:5180/practice-site/inventory.html\` directly if the page allows it), then:

1. Wrap the sort dropdown in Selenium's \`Select\` class.
2. Print all option texts with \`getOptions()\`.
3. Choose **Price (low to high)** with \`selectByVisibleText\` (or \`selectByValue\` if you know the value, e.g. \`lohi\`).
4. Assert \`getFirstSelectedOption().getText()\` is the option you picked.
5. Collect every product price (\`findElements\`), parse them to \`double\`, and assert the list is sorted ascending.

**Rules**
- Use \`Select\` — do not click \`<option>\` elements manually.
- Compare against a sorted *copy* of the list, not the same list.
- Locators on the page: the dropdown is \`#product-sort\`; prices are \`#inventory-list .item-price\` (scope to the list — the promo banner above it also has an \`.item-price\`).`,
  hints: [
    'new Select(driver.findElement(SORT_DROPDOWN))',
    'Strip the currency sign: Double.parseDouble(text.replace("$", "").trim())',
    'List<Double> expected = new ArrayList<>(actual); Collections.sort(expected); Assert.assertEquals(actual, expected);',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.testng.annotations.Test;

import java.util.List;

public class SortByPriceTest extends BaseTest {

    private static final By SORT_DROPDOWN = By.id("product-sort");
    private static final By PRICES = By.cssSelector("#inventory-list .item-price");

    @Test
    public void lowToHighSortsAscending() {
        loginAsStandardUser();
        WebElement dropdown = driver.findElement(SORT_DROPDOWN);
        // TODO: pick "Price (low to high)"
        // TODO: read all prices and assert ascending order
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class SortByPriceTest extends BaseTest {

    private static final By SORT_DROPDOWN = By.id("product-sort");
    private static final By PRICES = By.cssSelector("#inventory-list .item-price");

    @Test
    public void lowToHighSortsAscending() {
        loginAsStandardUser();

        Select sort = new Select(driver.findElement(SORT_DROPDOWN));
        sort.getOptions().forEach(o -> System.out.println("Option: " + o.getText()));

        sort.selectByVisibleText("Price (low to high)");
        Assert.assertEquals(sort.getFirstSelectedOption().getText(), "Price (low to high)");

        List<Double> actual = driver.findElements(PRICES).stream()
                .map(WebElement::getText)
                .map(t -> Double.parseDouble(t.replace("$", "").trim()))
                .collect(Collectors.toList());

        Assert.assertFalse(actual.isEmpty(), "No prices found - check the PRICES locator");

        List<Double> expected = new ArrayList<>(actual);
        Collections.sort(expected);
        Assert.assertEquals(actual, expected, "Prices are not sorted low to high");
    }
}
`,
  checks: [
    { label: 'Wraps the dropdown in Select', pattern: 'new\\s+Select\\s*\\(', hint: 'Select sort = new Select(driver.findElement(SORT_DROPDOWN));' },
    { label: 'Selects an option via the Select API', pattern: '\\.selectBy(VisibleText|Value|Index)\\s*\\(', hint: 'sort.selectByVisibleText("Price (low to high)")' },
    { label: 'Verifies the selected option', pattern: 'getFirstSelectedOption\\s*\\(', hint: 'sort.getFirstSelectedOption().getText()' },
    { label: 'Collects all prices with findElements', pattern: 'findElements\\s*\\(\\s*PRICES', hint: 'driver.findElements(PRICES)' },
    { label: 'Compares against a sorted copy', pattern: '(Collections\\.sort|\\.sorted\\s*\\(|\\.sort\\s*\\()', hint: 'Sort a copy and compare' },
    { label: 'Asserts with TestNG', pattern: 'Assert\\.assert', hint: 'Assert.assertEquals(actual, expected)' },
  ],
  explanation: `\`Select\` only works on native \`<select>\` elements (it throws \`UnexpectedTagNameException\` otherwise). It gives you three ways to choose — \`selectByVisibleText\` (most readable, ties the test to UI copy), \`selectByValue\` (stable when copy changes or is translated), \`selectByIndex\` (fragile, avoid) — plus \`getOptions()\`, \`getFirstSelectedOption()\`, \`isMultiple()\` and \`deselect*\` for multi-selects.

The sort check is the classic pattern: read → parse → copy → sort the copy → \`assertEquals\`. TestNG compares lists element by element and prints both lists on failure, which is exactly the evidence you attach to SHOP-212.

The \`assertFalse(actual.isEmpty())\` guard is a reviewer favourite: without it, a broken locator yields two empty lists that are "equal" and the test passes while testing nothing.

If the product grid re-renders after sorting asynchronously, add an explicit wait before reading prices (e.g. wait until the first price changes) — you will learn that in the waits problems.`,
  mistakes: [
    'Sorting the original list and comparing it with itself — always equal.',
    'Comparing prices as strings: "10.00" < "9.99" alphabetically.',
    'Using Select on a custom div-based dropdown (React/Material) — you must click it like normal elements.',
    'No empty-list guard, so a wrong locator makes the test pass.',
  ],
  interview: [
    { q: 'How do you handle a dropdown that is not a <select>?', a: 'Treat it as normal elements: click the trigger, wait for the option list to be visible, then click the option by text (e.g. XPath with normalize-space()). The Select class only supports native select tags.' },
    { q: 'selectByVisibleText vs selectByValue?', a: 'Visible text is readable but breaks with copy changes or localisation; value is tied to the HTML value attribute, which is usually more stable. Index is the most fragile.' },
    { q: 'How do you verify a multi-select?', a: 'Check isMultiple(), select several options, then read getAllSelectedOptions() and compare the texts; deselectAll() resets it.' },
  ],
}
