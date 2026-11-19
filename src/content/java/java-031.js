export default {
  id: 'java-031',
  category: 'java',
  kind: 'code',
  title: 'An enum with fields: SortOption holds "lohi" and "Price (low to high)"',
  level: 'INTERMEDIATE',
  tags: ['enums', 'constructors', 'page-object', 'select', 'cucumber'],
  estMinutes: 20,
  scenario: `The ShopEasy inventory page sort dropdown \`#product-sort\` has four options: \`az\` Name (A to Z), \`za\` Name (Z to A), \`lohi\` Price (low to high), \`hilo\` Price (high to low).
Tests call \`inventoryPage.sortBy("lohi")\` with raw strings. Last sprint someone wrote \`sortBy("low-high")\` and the test died with \`NoSuchElementException: Cannot locate option with value: low-high\`. The Cucumber steps also use the visible label, so the mapping from label to value is copied in two places.
You will model the dropdown as an **enum with fields**.`,
  description: `Create \`enum SortOption\` and use it in \`InventoryPage\`.

**Acceptance**
* Four constants: \`NAME_A_Z\`, \`NAME_Z_A\`, \`PRICE_LOW_HIGH\`, \`PRICE_HIGH_LOW\`, each created with its option **value** and visible **label**, e.g. \`PRICE_LOW_HIGH("lohi", "Price (low to high)")\`.
* \`private final String\` fields, a constructor \`SortOption(String value, String label)\`, and getters \`value()\` and \`label()\`.
* \`static SortOption fromLabel(String label)\`: loop over \`values()\`, match ignoring case and surrounding spaces, otherwise throw \`IllegalArgumentException\` naming the bad label.
* \`InventoryPage.sortBy(SortOption option)\` selects with \`selectByValue(option.value())\`.`,
  hints: [
    'Enum constants can take constructor arguments: PRICE_LOW_HIGH("lohi", "Price (low to high)"), then end the list with a semicolon.',
    'An enum constructor is implicitly private. Store the arguments in private final fields.',
    'for (SortOption option : values()) { if (option.label.equalsIgnoreCase(label.trim())) return option; }',
  ],
  language: 'java',
  starterCode: `package com.shop.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.Select;

public class InventoryPage {

    private final WebDriver driver;
    private final By sortDropdown = By.id("product-sort");

    public InventoryPage(WebDriver driver) {
        this.driver = driver;
    }

    // Any String compiles: sortBy("low-high") only fails at runtime.
    public void sortBy(String value) {
        new Select(driver.findElement(sortDropdown)).selectByValue(value);
    }
}

// TODO: enum SortOption with value + label fields, a constructor, getters and fromLabel(String)
`,
  solution: `package com.shop.pages;

import java.util.Arrays;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.Select;

enum SortOption {
    NAME_A_Z("az", "Name (A to Z)"),
    NAME_Z_A("za", "Name (Z to A)"),
    PRICE_LOW_HIGH("lohi", "Price (low to high)"),
    PRICE_HIGH_LOW("hilo", "Price (high to low)");

    private final String value;   // <option value="lohi">
    private final String label;   // the text the user sees

    SortOption(String value, String label) {
        this.value = value;
        this.label = label;
    }

    public String value() { return value; }
    public String label() { return label; }

    /** For Cucumber steps that use the visible text: When I sort products by "Price (low to high)" */
    public static SortOption fromLabel(String label) {
        for (SortOption option : values()) {
            if (option.label.equalsIgnoreCase(label.trim())) {
                return option;
            }
        }
        throw new IllegalArgumentException("Unknown sort option: '" + label
                + "'. Known: " + Arrays.toString(values()));
    }
}

public class InventoryPage {

    private final WebDriver driver;
    private final By sortDropdown = By.id("product-sort");

    public InventoryPage(WebDriver driver) {
        this.driver = driver;
    }

    /** Only the four real options compile: sortBy(SortOption.PRICE_LOW_HIGH) */
    public void sortBy(SortOption option) {
        new Select(driver.findElement(sortDropdown)).selectByValue(option.value());
    }
}

// Step definition:
// @When("I sort products by {string}")
// public void sortProducts(String label) { inventoryPage.sortBy(SortOption.fromLabel(label)); }
`,
  checks: [
    { label: 'Declares enum SortOption', pattern: 'enum\\s+SortOption\\b', hint: 'enum SortOption { ... }' },
    { label: 'Constants carry their value and label', pattern: 'PRICE_LOW_HIGH\\s*\\(\\s*"lohi"\\s*,\\s*"Price \\(low to high\\)"\\s*\\)', hint: 'PRICE_LOW_HIGH("lohi", "Price (low to high)")' },
    { label: 'Stores data in private final fields', pattern: 'private\\s+final\\s+String\\s+\\w+\\s*;', hint: 'private final String value;' },
    { label: 'Has an enum constructor with two Strings', pattern: 'SortOption\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'SortOption(String value, String label) { ... }' },
    { label: 'fromLabel loops over values()', pattern: 'values\\s*\\(\\s*\\)', hint: 'for (SortOption option : values())' },
    { label: 'Fails clearly for an unknown label', pattern: 'throw\\s+new\\s+IllegalArgumentException', hint: 'throw new IllegalArgumentException("Unknown sort option: " + label)' },
    { label: 'sortBy takes the enum and selects by its value', pattern: 'sortBy\\s*\\(\\s*SortOption\\s+\\w+\\s*\\)[\\s\\S]*selectByValue\\s*\\(\\s*\\w+\\.value\\s*\\(\\s*\\)\\s*\\)', hint: 'public void sortBy(SortOption option) { ... selectByValue(option.value()); }' },
  ],
  explanation: `An **enum** is a fixed set of named objects. Because each constant is a real object, it can carry **fields**, set through a constructor:

\`\`\`java
PRICE_LOW_HIGH("lohi", "Price (low to high)")
\`\`\`

* \`sortBy(SortOption option)\` means only the four real options compile. The \`"low-high"\` typo becomes impossible, and the IDE auto-completes the choices.
* The value-to-label mapping lives in **one** place. Page objects use \`value()\`, Cucumber steps use \`fromLabel(...)\`, and reports can print \`label()\`.
* Enum constructors are always private: no one can create a fifth option at runtime.
* \`values()\` is generated by the compiler and returns all constants in declaration order, which is perfect for lookups and for a DataProvider that runs one test per sort option.
* Failing with the list of known labels turns a confusing Selenium error into a one-line fix.

java-010 used a plain \`Browser\` enum. This is the next step: enums that hold data.`,
  mistakes: [
    'Forgetting the semicolon after the last constant when the enum has fields, which is a compile error.',
    'Using valueOf("Price (low to high)"). valueOf matches the constant NAME (PRICE_LOW_HIGH), not your label field.',
    'Making the fields public and non-final, so a test can change PRICE_LOW_HIGH.value for every other test.',
  ],
  interview: [
    { q: 'Why use an enum instead of String constants?', a: 'Type safety: a method that takes SortOption accepts only the defined options, the compiler catches typos, and each constant can carry related data and behaviour. String constants still let any random String through.' },
    { q: 'What is the difference between valueOf() and a custom fromLabel()?', a: 'valueOf(String) is generated by Java and matches the exact constant name, throwing IllegalArgumentException otherwise. A custom lookup lets you match on your own field, like the visible label or the option value.' },
    { q: 'Can an enum implement an interface or have abstract methods?', a: 'Yes. An enum can implement interfaces and even declare an abstract method that each constant overrides, e.g. each SortOption returning its own Comparator for verifying the sort.' },
  ],
}
