export default {
  id: 'pom-019',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'ProductCard component: a list of objects instead of a list of strings',
  level: 'INTERMEDIATE',
  tags: ['pom', 'components', 'root-element', 'collections'],
  estMinutes: 25,
  scenario: `Product owner request for the pricing release: *"every card shows a price, no price is $0.00, and after Add to
cart the button on **that** card says Remove"*. \`InventoryPage\` already has \`getProductNames()\` and
\`getPrices()\` returning two separate lists, and a test zips them by index — which silently pairs the wrong name and
price the day a card renders without a price. You want one object per card.`,
  description: `Build a \`ProductCard\` component scoped to a **root element**, and let \`InventoryPage\` return cards.

**Rules**
- \`ProductCard\` holds a \`private final WebElement root\` (passed in the constructor) and searches **inside it**:
  \`.item-name\`, \`.item-price\`, \`button\`.
- Methods: \`getName()\`, \`getPrice()\` returning a \`BigDecimal\` (strip the \`$\`), \`addToCart()\`, \`isInCart()\`
  (true when the button text is *Remove*).
- \`InventoryPage.getProducts()\` returns \`List<ProductCard>\`, one per \`.inventory-item\`.
- \`InventoryPage.product(String name)\` returns the matching card or throws an exception with the name in the message.`,
  starterCode: `package com.shopeasy.pages;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class InventoryPage extends BasePage {
    private final By names = By.cssSelector(".inventory-item .item-name");
    private final By prices = By.cssSelector(".inventory-item .item-price");

    public InventoryPage(WebDriver driver) { super(driver); }

    public List<String> getProductNames() {
        return driver.findElements(names).stream().map(WebElement::getText).collect(Collectors.toList());
    }

    public List<String> getPrices() {
        return driver.findElements(prices).stream().map(WebElement::getText).collect(Collectors.toList());
    }

    // TODO: getProducts() and product(String name)
}

class ProductCard {
    // TODO: root element, getName, getPrice, addToCart, isInCart
}
`,
  solution: `package com.shopeasy.pages;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class InventoryPage extends BasePage {
    private final By cards = By.cssSelector("#inventory-list .inventory-item");

    public InventoryPage(WebDriver driver) { super(driver); }

    public List<ProductCard> getProducts() {
        waitVisible(cards);
        return driver.findElements(cards).stream()
                .map(ProductCard::new)
                .collect(Collectors.toList());
    }

    public ProductCard product(String name) {
        return getProducts().stream()
                .filter(card -> card.getName().equals(name))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("No product card named: " + name));
    }
}

class ProductCard {
    private final WebElement root;
    private final By name   = By.cssSelector(".item-name");
    private final By price  = By.cssSelector(".item-price");
    private final By button = By.cssSelector("button");

    ProductCard(WebElement root) {
        this.root = root;
    }

    public String getName() {
        return root.findElement(name).getText().trim();
    }

    public BigDecimal getPrice() {
        return new BigDecimal(root.findElement(price).getText().replace("$", "").trim());
    }

    public ProductCard addToCart() {
        root.findElement(button).click();
        return this;
    }

    public boolean isInCart() {
        return root.findElement(button).getText().trim().equals("Remove");
    }
}

// Test:
// for (ProductCard card : inventory.getProducts()) {
//     Assert.assertTrue(card.getPrice().compareTo(BigDecimal.ZERO) > 0, card.getName() + " has no price");
// }
// ProductCard light = inventory.product("Pulse Bike Light").addToCart();
// Assert.assertTrue(light.isInCart(), "Button on the Pulse Bike Light card should say Remove");
`,
  checks: [
    { label: 'ProductCard keeps a private root WebElement', pattern: 'private\\s+(final\\s+)?WebElement\\s+\\w+\\s*;', hint: 'private final WebElement root;' },
    { label: 'Constructor receives the root', pattern: 'ProductCard\\s*\\(\\s*WebElement\\s+\\w+\\s*\\)', hint: 'ProductCard(WebElement root) { this.root = root; }' },
    { label: 'Lookups are scoped to the root', pattern: 'root\\.findElement\\s*\\(', hint: 'root.findElement(By.cssSelector(".item-price")) only searches inside this card' },
    { label: 'getPrice returns a BigDecimal', pattern: 'BigDecimal\\s+getPrice\\s*\\(\\s*\\)[\\s\\S]*?new\\s+BigDecimal\\s*\\(|BigDecimal\\s+getPrice\\s*\\(\\s*\\)[\\s\\S]*?BigDecimal\\.valueOf', hint: 'new BigDecimal(text.replace("$", "").trim())' },
    { label: 'getProducts returns List<ProductCard>', pattern: 'List<ProductCard>\\s+getProducts\\s*\\(\\s*\\)[\\s\\S]*?findElements', hint: 'driver.findElements(cards).stream().map(ProductCard::new)...' },
    { label: 'product(name) fails clearly when missing', pattern: 'ProductCard\\s+product\\s*\\(\\s*String\\s+\\w+\\s*\\)[\\s\\S]*?(orElseThrow|throw\\s+new)', hint: '.findFirst().orElseThrow(() -> new NoSuchElementException("No product card named: " + name))' },
  ],
  hints: [
    'A card is a page object whose "driver" is a WebElement: every lookup is root.findElement(...).',
    'getProducts(): driver.findElements(cards).stream().map(ProductCard::new).collect(...)',
    'Money is BigDecimal, never double: new BigDecimal("9.99") is exact; 0.1 + 0.2 in double is not 0.3.',
  ],
  explanation: `Parallel lists (\`names.get(i)\`, \`prices.get(i)\`) are a silent-bug factory: if one card renders without a
price, every pair after it is wrong and the test may still pass. A **component per item** keeps the data together.

- **Root-scoped search**: \`root.findElement(price)\` cannot read another card's price (or the promo banner's
  \`.item-price\`). Note: with XPath, start the expression with \`.//\` inside a root; \`//\` would search the whole page again.
- **Typed values**: \`getPrice()\` returns \`BigDecimal\`, so tests compare numbers, not strings like \`"$9.99"\`.
- **State per item**: \`isInCart()\` answers for *this* card — exactly the PO's acceptance criterion.
- **Lookup by business key**: \`product("Pulse Bike Light")\` reads like the test case and fails with a message that
  names the missing product.

Staleness: a \`ProductCard\` holds a real \`WebElement\`. If the list re-renders (ShopEasy re-orders cards on sort by
moving the same nodes, but many React apps rebuild them), old cards throw \`StaleElementReferenceException\`. Rule:
get cards **after** the action that changes the list, and do not keep them across navigation.`,
  mistakes: [
    'Using driver.findElement inside the component, which searches the whole page instead of the card.',
    'Starting an XPath with // inside root.findElement — it still searches the whole document; use .//',
    'Parsing prices into double and comparing with ==.',
    'Caching List<ProductCard> in a field and reusing it after sorting or navigation (stale elements).',
  ],
  interview: [
    { q: 'How do you model a list of repeating widgets in POM?', a: 'A component class built around a root WebElement, one instance per widget. The page returns List<Component> and offers a finder by a business key. All component lookups use root.findElement so they stay inside the widget.' },
    { q: 'Why BigDecimal for prices?', a: 'double cannot represent most decimal fractions exactly, so sums like 29.99 + 9.99 can come out as 39.980000000000004. BigDecimal built from the string keeps exact cents and compareTo gives reliable comparisons.' },
    { q: 'What causes StaleElementReferenceException with component objects?', a: 'The component\'s root WebElement was removed or replaced in the DOM (re-render, navigation, refresh). Re-fetch the components after the change, or re-locate the root by its key inside each method.' },
  ],
}
