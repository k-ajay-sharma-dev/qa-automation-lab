export default {
  id: 'java-039',
  category: 'java',
  kind: 'code',
  title: 'Interface default methods: share the ShopEasy header across pages',
  level: 'ADVANCED',
  tags: ['interfaces', 'default-methods', 'page-object', 'composition', 'oop'],
  estMinutes: 25,
  scenario: `Every ShopEasy page after login has the same header: the cart link \`#shopping-cart-link\`, the badge \`.shopping-cart-badge\` (removed when the cart is empty) and \`#logout-link\`.
Right now \`cartCount()\` is copy-pasted into \`InventoryPage\` and \`CartPage\`, and the two copies already differ: one crashes on an empty cart.
You can't move it into \`BasePage\` because the login page has no header, and you can't add a second parent class because Java allows only one \`extends\`. An interface with **default methods** solves both.`,
  description: `Create \`HasHeader\` and use it in the two pages.

**Acceptance**
* \`public interface HasHeader\` with one **abstract** method \`WebDriver driver();\`.
* \`default int cartCount()\`: uses \`findElements(By.cssSelector(".shopping-cart-badge"))\` and returns 0 when the list is empty, otherwise the parsed badge text.
* \`default CartPage openCart()\`: clicks \`#shopping-cart-link\` and returns \`new CartPage(driver())\`.
* \`default void logout()\`: clicks \`#logout-link\`.
* \`InventoryPage\` and \`CartPage\` both \`extends BasePage implements HasHeader\`, implement \`driver()\` and **delete** their own \`cartCount()\`.`,
  hints: [
    'An interface can\'t hold the driver field, so ask for it: WebDriver driver(); The page already has one and just returns it.',
    'default int cartCount() { List<WebElement> badge = driver().findElements(By.cssSelector(".shopping-cart-badge")); return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim()); }',
    'public class CartPage extends BasePage implements HasHeader { @Override public WebDriver driver() { return driver; } }',
  ],
  language: 'java',
  starterCode: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.*;

public class InventoryPage extends BasePage {
    public InventoryPage(WebDriver driver) { super(driver); }

    public int cartCount() {
        List<WebElement> badge = driver.findElements(By.cssSelector(".shopping-cart-badge"));
        return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim());
    }
}

public class CartPage extends BasePage {
    public CartPage(WebDriver driver) { super(driver); }

    // copy #2, crashes when the cart is empty
    public int cartCount() {
        return Integer.parseInt(driver.findElement(By.className("shopping-cart-badge")).getText());
    }
}

// TODO: public interface HasHeader { ... } with driver(), cartCount(), openCart(), logout()
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.*;

public interface HasHeader {

    WebDriver driver();   // abstract: each page supplies its driver

    default int cartCount() {
        List<WebElement> badge = driver().findElements(By.cssSelector(".shopping-cart-badge"));
        return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim());
    }

    default CartPage openCart() {
        driver().findElement(By.id("shopping-cart-link")).click();
        return new CartPage(driver());
    }

    default void logout() {
        driver().findElement(By.id("logout-link")).click();
    }
}

public class InventoryPage extends BasePage implements HasHeader {
    public InventoryPage(WebDriver driver) { super(driver); }

    @Override
    public WebDriver driver() { return driver; }
}

public class CartPage extends BasePage implements HasHeader {
    public CartPage(WebDriver driver) { super(driver); }

    @Override
    public WebDriver driver() { return driver; }
}

// Test:
// InventoryPage inventory = new InventoryPage(driver);
// inventory.addToCart("trailblazer-backpack");
// Assert.assertEquals(inventory.cartCount(), 1);
// CartPage cart = inventory.openCart();
// Assert.assertEquals(cart.cartCount(), 1);
`,
  checks: [
    { label: 'Declares the HasHeader interface', pattern: 'interface\\s+HasHeader', hint: 'public interface HasHeader { ... }' },
    { label: 'Has an abstract driver() method', pattern: 'WebDriver\\s+driver\\s*\\(\\s*\\)\\s*;', hint: 'WebDriver driver();' },
    { label: 'cartCount is a default method', pattern: 'default\\s+int\\s+cartCount\\s*\\(', hint: 'default int cartCount() { ... }' },
    { label: 'Handles the missing badge with findElements', pattern: 'driver\\s*\\(\\s*\\)\\s*\\.findElements\\s*\\(', hint: 'driver().findElements(By.cssSelector(".shopping-cart-badge")) returns an empty list instead of throwing.' },
    { label: 'openCart is a default method', pattern: 'default\\s+\\w+\\s+openCart\\s*\\(', hint: 'default CartPage openCart() { ... }' },
    { label: 'Pages implement HasHeader', pattern: 'implements\\s+HasHeader', hint: 'public class CartPage extends BasePage implements HasHeader' },
  ],
  explanation: `A **default method** is an interface method with a body (Java 8+). Every class that implements the interface gets it for free, and can still override it.

Why it fits here:
* **One extends, many implements.** \`CartPage\` already extends \`BasePage\`. It can implement any number of interfaces, so "has a header" becomes a capability you add only to pages that have one, and the login page doesn't.
* **No fields in interfaces.** Interfaces can't hold instance state, so the interface declares \`WebDriver driver();\` and each page supplies its own driver. That small abstract method is the usual trick.
* **One copy of the logic.** The empty-cart handling (\`findElements\` returns an empty list, \`findElement\` throws \`NoSuchElementException\`) now lives in one place, and the buggy copy is gone.

Watch out: if a class implements two interfaces with the **same** default method, it does not compile until the class overrides it (and may call \`A.super.method()\`). Keep default methods small and stateless; if they need fields, you want a class (composition: a \`Header\` component object) instead.`,
  mistakes: [
    'Trying to declare a WebDriver field in the interface; interface fields are public static final constants.',
    'Moving header methods into BasePage, so LoginPage suddenly has a logout() that cannot work.',
    'Forgetting to make driver() public in the class; interface methods are public, and the override can\'t reduce visibility.',
    'Using findElement for an element that is removed from the DOM in a normal state (empty cart badge).',
  ],
  interview: [
    { q: 'Why were default methods added to Java?', a: 'To let interfaces gain new methods without breaking every class that already implements them. Java 8 used them to add forEach and stream to Collection. In frameworks they share small behaviour across classes that cannot share a parent class.' },
    { q: 'What happens if a class implements two interfaces with the same default method?', a: 'It is a compile error (the diamond problem) until the class overrides the method. Inside the override it can pick one with InterfaceName.super.method().' },
    { q: 'Interface with default methods or abstract class?', a: 'An abstract class can have fields, constructors and state, but a class can extend only one. An interface has no instance state but a class can implement many. Use an abstract class for the shared base (BasePage with driver and wait) and interfaces for optional capabilities (HasHeader).' },
  ],
}
