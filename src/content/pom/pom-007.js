export default {
  id: 'pom-007',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Components: a reusable HeaderComponent',
  level: 'INTERMEDIATE',
  tags: ['pom', 'components', 'composition', 'fragments'],
  estMinutes: 20,
  scenario: `The ShopEasy header (cart link with badge, *Logout* link) appears on inventory, cart and checkout.
Right now \`InventoryPage\`, \`CartPage\` and \`CheckoutPage\` each have their own copy of \`cartBadge\`, \`openCart()\` and
\`logout()\`. The header was just redesigned and you fixed it in two pages but forgot the third — a classic.`,
  description: `Extract a \`HeaderComponent\` and **compose** it into pages.

**Rules**
- \`HeaderComponent\` has its own private locators (\`.shopping-cart-badge\`, \`#shopping-cart-link\`, \`#logout-link\`) and receives the \`WebDriver\`.
- Methods: \`getCartCount()\` returns 0 when the badge is not shown, \`openCart()\` returns \`CartPage\`, \`logout()\` returns \`LoginPage\`.
- \`InventoryPage\` and \`CartPage\` expose the component via \`header()\` instead of duplicating the methods.
- The test reads: \`inventory.addToCart("Trailblazer Backpack").header().getCartCount()\`.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class InventoryPage extends BasePage {
    private final By cartBadge = By.cssSelector(".shopping-cart-badge");
    private final By cartLink = By.id("shopping-cart-link");

    public InventoryPage(WebDriver driver) { super(driver); }

    public int getCartCount() {
        return Integer.parseInt(getText(cartBadge));
    }

    public CartPage openCart() {
        click(cartLink);
        return new CartPage(driver);
    }
    // ... same 2 methods copy-pasted in CartPage and CheckoutPage
}

// TODO: class HeaderComponent
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class HeaderComponent extends BasePage {
    private final By cartBadge  = By.cssSelector(".shopping-cart-badge");
    private final By cartLink   = By.id("shopping-cart-link");
    private final By logoutLink = By.id("logout-link");

    public HeaderComponent(WebDriver driver) {
        super(driver);
    }

    public int getCartCount() {
        List<WebElement> badge = driver.findElements(cartBadge);
        return badge.isEmpty() ? 0 : Integer.parseInt(badge.get(0).getText().trim());
    }

    public CartPage openCart() {
        click(cartLink);
        return new CartPage(driver);
    }

    public LoginPage logout() {
        click(logoutLink);
        return new LoginPage(driver);
    }
}

class InventoryPage extends BasePage {
    private final HeaderComponent header;

    InventoryPage(WebDriver driver) {
        super(driver);
        this.header = new HeaderComponent(driver);
    }

    public HeaderComponent header() {
        return header;
    }

    public InventoryPage addToCart(String productName) {
        click(By.xpath(String.format(
            "//div[@class='inventory-item'][.//*[text()='%s']]//button", productName)));
        return this;
    }
}

class CartPage extends BasePage {
    private final HeaderComponent header;

    CartPage(WebDriver driver) {
        super(driver);
        this.header = new HeaderComponent(driver);
    }

    public HeaderComponent header() {
        return header;
    }
}
`,
  checks: [
    { label: 'HeaderComponent class exists with WebDriver constructor', pattern: 'class\\s+HeaderComponent[\\s\\S]*?HeaderComponent\\s*\\(\\s*WebDriver\\s+\\w+\\s*\\)', hint: 'public HeaderComponent(WebDriver driver)' },
    { label: 'getCartCount handles the missing badge', pattern: 'getCartCount[\\s\\S]*?(findElements[\\s\\S]*?isEmpty|isEmpty|size\\s*\\(\\s*\\)\\s*==\\s*0|catch\\s*\\(\\s*NoSuchElementException)', hint: 'Use findElements(...).isEmpty() and return 0' },
    { label: 'logout() returns LoginPage', pattern: 'public\\s+LoginPage\\s+logout\\s*\\(', hint: 'Logging out lands on the login page' },
    { label: 'Pages compose the header', pattern: 'HeaderComponent\\s+header\\s*\\(\\s*\\)', hint: 'public HeaderComponent header() { return header; }' },
    { label: 'Pages create the component with the same driver', pattern: 'new\\s+HeaderComponent\\s*\\(\\s*driver\\s*\\)', hint: 'this.header = new HeaderComponent(driver);' },
    { label: 'InventoryPage no longer duplicates getCartCount', pattern: 'class\\s+InventoryPage[^{]*\\{(?:(?!class\\s)[\\s\\S])*getCartCount', mustNot: true, hint: 'Move getCartCount into the component' },
  ],
  hints: [
    'A component is just a page object for part of a page.',
    'findElements returns an empty list when the badge is absent; no exception.',
    'Give each page a private final HeaderComponent and a header() accessor.',
  ],
  explanation: `Not every page object has to be a full page. **Components** (aka fragments) model UI parts that repeat:
header, footer, side menu, date picker, product card, modal dialog. Pages **have a** component (composition)
instead of each page re-implementing it, so the header redesign is now a one-class change.

Why composition rather than putting header methods in BasePage? Not every page has a header (the login page does
not), and BasePage should hold plumbing, not UI. \`header()\` also makes tests self-documenting:
\`cart.header().logout()\` tells the reader *where* the action happens.

Advanced variant: scope a component to a **root element** (e.g. one product card) and search inside it with
\`root.findElement(...)\` — useful for lists of identical widgets.`,
  mistakes: [
    'Putting header methods in BasePage, so LoginPage suddenly "has" a cart icon.',
    'Using findElement + catch for the optional badge and waiting the full timeout each time.',
    'Creating the component lazily with a different driver instance.',
  ],
  interview: [
    { q: 'How do you handle elements shared across many pages?', a: 'Model them as component objects (header, footer, modals) and compose them into the pages that contain them. Pages expose them through an accessor like header(). This avoids duplication without abusing inheritance.' },
    { q: 'How would you model a list of product cards?', a: 'A ProductCard component built around a root WebElement, with methods like getName(), getPrice(), addToCart() that search within the root. The page returns List<ProductCard> or finds one by name.' },
  ],
}
