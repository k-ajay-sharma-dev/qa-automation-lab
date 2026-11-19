export default {
  id: 'pom-034',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'InventoryPage.sortBy(SortOption): an enum instead of magic strings',
  level: 'BEGINNER',
  tags: ['pom', 'enum', 'select', 'sorting', 'inventory'],
  estMinutes: 15,
  scenario: `Four sort tests on the ShopEasy Products page call \`inventory.sort("lohi")\`, \`inventory.sort("Price (low to high)")\`
and one even passes \`"lowhigh"\` (a typo that fails at runtime with *"Cannot locate option"*). The \`#product-sort\`
dropdown has exactly four options, so the compiler should be the one stopping typos, not the nightly run.`,
  description: `Make sorting type-safe.

**Rules**
- Create \`enum SortOption\` with \`NAME_A_TO_Z\`, \`NAME_Z_TO_A\`, \`PRICE_LOW_TO_HIGH\`, \`PRICE_HIGH_TO_LOW\`, each holding
  the option **value** from the page (\`az\`, \`za\`, \`lohi\`, \`hilo\`).
- \`sortBy(SortOption option)\` selects it in \`#product-sort\` using Selenium's \`Select\` and returns \`this\`.
- \`getProductNames()\` returns the \`.item-name\` texts as a \`List<String>\` (for the test to assert the order).
- Locators private, no assertions in the page.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import java.util.List;

public class InventoryPage extends BasePage {
    private final By sortDropdown = By.id("product-sort");
    private final By itemNames = By.cssSelector(".item-name");

    public InventoryPage(WebDriver driver) { super(driver); }

    public void sort(String option) {          // "lohi"? "Price (low to high)"? who knows
        driver.findElement(sortDropdown).sendKeys(option);
    }

    // TODO: enum SortOption, sortBy(SortOption), getProductNames()
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import java.util.List;

public class InventoryPage extends BasePage {
    private final By sortDropdown = By.id("product-sort");
    private final By itemNames = By.cssSelector(".item-name");

    public enum SortOption {
        NAME_A_TO_Z("az"),
        NAME_Z_TO_A("za"),
        PRICE_LOW_TO_HIGH("lohi"),
        PRICE_HIGH_TO_LOW("hilo");

        private final String value;
        SortOption(String value) { this.value = value; }
        public String value() { return value; }
    }

    public InventoryPage(WebDriver driver) { super(driver); }

    public InventoryPage sortBy(SortOption option) {
        new Select(waitVisible(sortDropdown)).selectByValue(option.value());
        return this;
    }

    public List<String> getProductNames() {
        return driver.findElements(itemNames).stream()
                .map(WebElement::getText)
                .toList();
    }
}

// Test:
// List<String> names = inventory.sortBy(SortOption.NAME_Z_TO_A).getProductNames();
// List<String> expected = new ArrayList<>(names); expected.sort(Comparator.reverseOrder());
// assertEquals(names, expected);
`,
  checks: [
    { label: 'enum SortOption with the four options', pattern: 'enum\\s+SortOption[\\s\\S]*NAME_A_TO_Z[\\s\\S]*PRICE_HIGH_TO_LOW|enum\\s+SortOption[\\s\\S]*PRICE_HIGH_TO_LOW[\\s\\S]*NAME_A_TO_Z', hint: 'enum SortOption { NAME_A_TO_Z("az"), ..., PRICE_HIGH_TO_LOW("hilo") }' },
    { label: 'Enum stores the real option values', pattern: '"lohi"[\\s\\S]*"hilo"|"hilo"[\\s\\S]*"lohi"', hint: 'Use the <option value> from the page: az, za, lohi, hilo' },
    { label: 'sortBy takes the enum and returns InventoryPage', pattern: 'public\\s+InventoryPage\\s+sortBy\\s*\\(\\s*SortOption\\s+\\w+\\s*\\)[\\s\\S]*?return\\s+this', hint: 'public InventoryPage sortBy(SortOption option) { ...; return this; }' },
    { label: 'Uses Selenium Select', pattern: 'new\\s+Select\\s*\\(', hint: 'new Select(element).selectByValue(option.value())' },
    { label: 'getProductNames returns List<String>', pattern: 'public\\s+List<String>\\s+getProductNames\\s*\\(', hint: 'public List<String> getProductNames()' },
    { label: 'No sendKeys on the dropdown', pattern: 'sortDropdown\\)\\s*\\.sendKeys', mustNot: true, hint: 'sendKeys on a <select> is unreliable; use Select' },
  ],
  hints: [
    'An enum constant can carry a value: PRICE_LOW_TO_HIGH("lohi") with a private field and constructor.',
    'Select works on the <select> WebElement: new Select(el).selectByValue("lohi").',
    'Return this: sorting keeps you on the same page, and the test can chain getProductNames().',
  ],
  explanation: `The enum turns a runtime failure into a compile error: \`SortOption.PRICE_LOW_TO_HGH\` doesn't build, while
\`"lowhigh"\` only fails at 2 a.m.

- **Values, not labels**: \`selectByValue("lohi")\` survives a label change like "Price (low to high)" → "Cheapest first".
  If the values ever change, only the enum is updated.
- **Select** is Selenium's API for \`<select>\`; \`sendKeys\` relies on keyboard type-ahead and is flaky.
- **Returns this**: sorting doesn't navigate, so the test chains \`sortBy(...).getProductNames()\` and asserts the order.`,
  mistakes: [
    'Passing raw strings so typos only fail at runtime.',
    'Selecting by visible text so a copy change breaks every sort test.',
    'Asserting the sorted order inside sortBy() instead of in the test.',
    'Returning void, forcing the test to keep a separate reference.',
  ],
  interview: [
    { q: 'Why use an enum for dropdown options in a page object?', a: 'The set of options is fixed and known, so an enum gives compile-time safety, IDE auto-complete and one place to map names to the page values. Tests read like requirements: sortBy(PRICE_LOW_TO_HIGH).' },
    { q: 'selectByValue, selectByVisibleText or selectByIndex?', a: 'Prefer value: it is stable and not translated. Visible text breaks on copy or language changes, and index breaks when an option is added. Use visible text only when the text itself is what you are testing.' },
    { q: 'How would you verify the price sort is correct?', a: 'Read the prices as BigDecimal, copy the list, sort the copy with the expected comparator and assert the two lists are equal. This checks the whole order rather than just the first item.' },
  ],
}
