export default {
  id: 'pom-015',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'CartPage: remove items, empty state and two ways out',
  level: 'BEGINNER',
  tags: ['pom', 'page-object', 'cart', 'fluent'],
  estMinutes: 15,
  scenario: `Ticket *QA-231: automate the cart regression pack*. The manual cases are short: *"remove the backpack, the
cart shows only the bike light"*, *"remove the last item, the message 'Your cart is empty' appears and Checkout is
disabled"*, *"Continue Shopping goes back to the products page"*. There is no \`CartPage\` yet, so every draft test is
full of \`driver.findElement(By.id("remove-trailblazer-backpack"))\`.`,
  description: `Write \`CartPage\` for ShopEasy's \`cart.html\` (it extends \`BasePage\`, which gives you \`click\`, \`getText\`, \`isDisplayed\`).

**Rules**
- Private \`By\` locators: cart rows \`.cart-item\`, item names \`.cart-item .item-name\`, \`#empty-cart-message\`,
  \`#continue-shopping\`, \`#checkout\`.
- \`getItemNames()\` returns \`List<String>\`.
- \`removeItem(String productName)\` clicks the *Remove* button **inside that product's row** and returns \`this\`
  (build the locator from the product name, not a hard-coded id).
- \`isEmptyMessageShown()\` and \`isCheckoutEnabled()\` return booleans.
- \`continueShopping()\` returns \`InventoryPage\`; \`checkout()\` returns \`CheckoutPage\`.
- No assertions in the page.`,
  starterCode: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CartPage extends BasePage {

    public CartPage(WebDriver driver) {
        super(driver);
    }

    // TODO: private locators

    public void removeBackpack() {
        driver.findElement(By.id("remove-trailblazer-backpack")).click();
    }

    // TODO: getItemNames, removeItem(String), isEmptyMessageShown, isCheckoutEnabled
    // TODO: continueShopping() -> InventoryPage, checkout() -> CheckoutPage
}
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class CartPage extends BasePage {

    private static final String REMOVE_IN_ROW =
            "//li[contains(@class,'cart-item')][.//*[contains(@class,'item-name') and normalize-space()='%s']]//button";

    private final By cartRows         = By.cssSelector(".cart-item");
    private final By itemNames        = By.cssSelector(".cart-item .item-name");
    private final By emptyMessage     = By.id("empty-cart-message");
    private final By continueShopping = By.id("continue-shopping");
    private final By checkoutButton   = By.id("checkout");

    public CartPage(WebDriver driver) {
        super(driver);
    }

    public List<String> getItemNames() {
        return driver.findElements(itemNames).stream()
                .map(WebElement::getText)
                .map(String::trim)
                .collect(Collectors.toList());
    }

    public int getItemCount() {
        return driver.findElements(cartRows).size();
    }

    public CartPage removeItem(String productName) {
        click(By.xpath(String.format(REMOVE_IN_ROW, productName)));
        return this;
    }

    public boolean isEmptyMessageShown() {
        return isDisplayed(emptyMessage);
    }

    public boolean isCheckoutEnabled() {
        return driver.findElement(checkoutButton).isEnabled();
    }

    public InventoryPage continueShopping() {
        click(continueShopping);
        return new InventoryPage(driver);
    }

    public CheckoutPage checkout() {
        click(checkoutButton);
        return new CheckoutPage(driver);
    }
}

// In CartTest:
// CartPage cart = loginAsStandardUser()
//         .addToCart("Trailblazer Backpack").addToCart("Pulse Bike Light")
//         .header().openCart()
//         .removeItem("Trailblazer Backpack");
// Assert.assertEquals(cart.getItemNames(), List.of("Pulse Bike Light"), "Items left in cart");
`,
  checks: [
    { label: 'Locators are private By fields', pattern: 'private\\s+(static\\s+)?(final\\s+)?By\\s+\\w+\\s*=\\s*By\\.', hint: 'private final By checkoutButton = By.id("checkout");' },
    { label: 'getItemNames returns List<String>', pattern: 'public\\s+List<String>\\s+getItemNames\\s*\\(\\s*\\)[\\s\\S]*?findElements', hint: 'driver.findElements(itemNames) then map getText' },
    { label: 'removeItem(String) is generic and returns this', pattern: 'public\\s+CartPage\\s+removeItem\\s*\\(\\s*String\\s+\\w+\\s*\\)[\\s\\S]*?return\\s+this', hint: 'public CartPage removeItem(String productName) { ...; return this; }' },
    { label: 'Locator built from the product name', pattern: 'String\\.format\\s*\\(|\\+\\s*\\w+\\s*\\+', hint: 'By.xpath(String.format(TEMPLATE, productName))' },
    { label: 'No hard-coded per-product remove ids', pattern: '"remove-trailblazer-backpack"', mustNot: true, hint: 'One removeItem(String) for every product' },
    { label: 'Navigation returns the next pages', pattern: 'InventoryPage\\s+continueShopping\\s*\\([\\s\\S]*?CheckoutPage\\s+checkout\\s*\\(|CheckoutPage\\s+checkout\\s*\\([\\s\\S]*?InventoryPage\\s+continueShopping\\s*\\(', hint: 'continueShopping() returns InventoryPage, checkout() returns CheckoutPage' },
    { label: 'Empty state reported as a boolean', pattern: 'boolean\\s+isEmptyMessageShown\\s*\\(', hint: 'public boolean isEmptyMessageShown() { return isDisplayed(emptyMessage); }' },
  ],
  hints: [
    'Each manual step becomes one method: remove, read names, check empty message, leave the page.',
    'The Remove button sits inside the same <li class="cart-item"> as the product name: anchor on the name, then go down to the button.',
    'isCheckoutEnabled() can simply return driver.findElement(checkoutButton).isEnabled().',
  ],
  explanation: `This is a full page object for one screen, built only from things you have already seen:

- **Private locators** at the top, so the next redesign of the cart touches one file.
- **One generic \`removeItem(String)\`** instead of \`removeBackpack()\`, \`removeBikeLight()\`… The XPath template
  finds the row that *contains* the product name and clicks the button inside that row. (The id
  \`remove-<slug>\` would also work, but then the test has to know slugs; tests speak in visible names.)
- **Booleans for state** (\`isEmptyMessageShown\`, \`isCheckoutEnabled\`): the page reports, the test decides
  whether \`true\` is good or bad. The same method serves "cart is empty" and "cart is not empty" tests.
- **Return types model navigation**: \`removeItem\` stays on the cart (\`this\`), \`continueShopping\` and \`checkout\`
  return the page you land on.

A reviewer would also accept \`getItemCount()\` as an extra — small read methods are cheap and make assertions clear.`,
  mistakes: [
    'Writing one remove method per product, which grows every time marketing adds a product.',
    'Using driver.findElement(By.xpath("//button[text()=\'Remove\']")) which clicks the first Remove button, not the one for your product.',
    'Returning void from removeItem, so the test cannot chain the next step.',
    'Asserting "Your cart is empty" inside the page instead of returning a boolean or the text.',
  ],
  interview: [
    { q: 'How do you click a button that belongs to a specific row or card?', a: 'Anchor on something unique and visible in that row (the product name), go to the row container, then down to the button: //li[.//*[text()=\'X\']]//button. Or find the row element first and call row.findElement(...) so the search is scoped to it.' },
    { q: 'Should isCheckoutEnabled() be a page method or should the test call findElement?', a: 'A page method. The test should not know the button id. The page returns a boolean and the test asserts true or false with a message, depending on the scenario.' },
    { q: 'Why does removeItem return this?', a: 'Removing an item keeps you on the cart page. Returning this allows chaining (removeItem(a).removeItem(b).getItemNames()) and tells the reader, through the type, where the user is after the action.' },
  ],
}
