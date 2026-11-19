export default {
  id: 'pom-010',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Dynamic locators with String.format',
  level: 'INTERMEDIATE',
  tags: ['pom', 'dynamic-locators', 'xpath', 'string-format'],
  estMinutes: 15,
  scenario: `ShopEasy's inventory has 6 products and each card has its own *Add to cart* button. The current
\`InventoryPage\` has six methods: \`addBackpackToCart()\`, \`addBikeLightToCart()\`, \`addCrewTShirtToCart()\`…
Marketing is adding 4 more products for the holiday sale. Nobody wants to write \`addHolidaySweaterToCart()\`.`,
  description: `Replace the per-product methods with **locator templates**.

**Rules**
- A \`private static final String\` template, e.g. an XPath with \`%s\` for the product name.
- A private helper \`By productButton(String name)\` that builds the \`By\` with \`String.format\`.
- Public \`addToCart(String productName)\` returning \`InventoryPage\` (fluent), and \`getPrice(String productName)\` returning the price text.
- Delete the hard-coded per-product methods.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class InventoryPage extends BasePage {

    private final By backpackAdd  = By.id("add-to-cart-trailblazer-backpack");
    private final By bikeLightAdd = By.id("add-to-cart-pulse-bike-light");

    public InventoryPage(WebDriver driver) { super(driver); }

    public InventoryPage addBackpackToCart() {
        click(backpackAdd);
        return this;
    }

    public InventoryPage addBikeLightToCart() {
        click(bikeLightAdd);
        return this;
    }
    // ... 4 more like this, 4 more coming
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class InventoryPage extends BasePage {

    private static final String PRODUCT_CARD =
            "//div[contains(@class,'inventory-item')][.//a[contains(@class,'item-name') and normalize-space()='%s']]";

    public InventoryPage(WebDriver driver) { super(driver); }

    private By productCard(String name) {
        return By.xpath(String.format(PRODUCT_CARD, name));
    }

    private By productButton(String name) {
        return By.xpath(String.format(PRODUCT_CARD + "//button", name));
    }

    private By productPrice(String name) {
        return By.xpath(String.format(PRODUCT_CARD + "//*[contains(@class,'item-price')]", name));
    }

    public InventoryPage addToCart(String productName) {
        click(productButton(productName));
        return this;
    }

    public String getPrice(String productName) {
        return getText(productPrice(productName));
    }

    public boolean isProductListed(String productName) {
        return !driver.findElements(productCard(productName)).isEmpty();
    }
}

// Test: inventory.addToCart("Trailblazer Backpack").addToCart("Storm Fleece Jacket");
`,
  checks: [
    { label: 'Locator template constant with %s', pattern: 'private\\s+static\\s+final\\s+String\\s+\\w+\\s*=[\\s\\S]*?%s', hint: 'private static final String PRODUCT_CARD = "...%s...";' },
    { label: 'Builds the By with String.format', pattern: 'By\\.(xpath|cssSelector|id)\\s*\\(\\s*String\\.format\\s*\\(', hint: 'return By.xpath(String.format(TEMPLATE, name));' },
    { label: 'Helper method returning By', pattern: 'private\\s+By\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'private By productButton(String name) { ... }' },
    { label: 'Generic addToCart(String)', pattern: 'public\\s+InventoryPage\\s+addToCart\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'public InventoryPage addToCart(String productName)' },
    { label: 'Per-product methods removed', pattern: 'add(Backpack|BikeLight)ToCart', mustNot: true, hint: 'Delete addBackpackToCart / addBikeLightToCart' },
    { label: 'getPrice(String) exists', pattern: 'String\\s+getPrice\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'Reuse the same template for the price element' },
  ],
  hints: [
    'Anchor the template on the visible product name, then go to the button inside that card.',
    'private By productButton(String name) { return By.xpath(String.format(TEMPLATE, name)); }',
    'An id-based template also works: "add-to-cart-%s" with a slug like trailblazer-backpack.',
  ],
  explanation: `A **locator template** + a small factory method gives you one locator for N similar elements.
Anchoring on the *visible text* (the product name) also makes tests read like the manual case:
\`addToCart("Storm Fleece Jacket")\`.

Tips:
- Keep the template \`private static final\` and the factory \`private\`: tests still never see locators.
- Use \`normalize-space()='%s'\` for exact matches; \`contains\` can match "Backpack" and "Backpack Pro".
- Watch out for apostrophes in data (\`Women's Tee\`) — they break a single-quoted XPath literal. Either use
  double quotes in the XPath or an id/data-test attribute template.
- This is exactly what PageFactory **cannot** do, because annotation values must be constants (pom-006).`,
  mistakes: [
    'Building the locator by string concatenation in many places instead of one template.',
    'Using contains() where an exact match is needed, so the wrong product gets clicked.',
    'Making the template public so tests start formatting locators themselves.',
  ],
  interview: [
    { q: 'How do you handle elements whose locator depends on test data?', a: 'Keep a parameterised locator template (XPath or CSS with %s) in the page object and a private method that returns By via String.format. Public methods take the business value, e.g. addToCart(productName).' },
    { q: 'Can you use @FindBy for dynamic locators?', a: 'No. Annotation attributes must be compile-time constants, so dynamic values cannot be injected. You fall back to By + String.format.' },
  ],
}
