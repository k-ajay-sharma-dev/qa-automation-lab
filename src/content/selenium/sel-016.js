export default {
  id: 'sel-016',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Fix StaleElementReferenceException the right way',
  level: 'ADVANCED',
  tags: ['StaleElementReferenceException', 'waits', 'stalenessOf', 'refreshed'],
  estMinutes: 25,
  scenario: `In your team's production app, the "add all products to cart" test fails 1 in 5 runs on Jenkins with \`StaleElementReferenceException: stale element not found in the current frame\`. That inventory page is a React app: each "Add to cart" click re-renders the product grid, so the \`List<WebElement>\` you collected at the start points to DOM nodes that no longer exist. Someone "fixed" it with a \`catch\` + \`Thread.sleep(1000)\` + retry... and now it fails 1 in 10 and takes longer. (The practice site's \`inventory.html\` only swaps the clicked button from \`add-to-cart-<slug>\` to \`remove-<slug>\`; to *see* a real stale reference, use \`cart.html\` — Remove re-renders the whole \`#cart-list\` — or \`waits.html\`'s "Refresh prices", which replaces \`#price-list\`.)`,
  description: `Rewrite \`addAllProducts()\` on \`http://localhost:5180/practice-site/inventory.html\` so it would also survive a re-rendering grid (the stale reference itself can be reproduced on \`cart.html\` or \`waits.html\`'s \`#price-list\`):

1. Don't keep a list of WebElements across re-renders. Store only the **count**, then on each iteration **re-locate** the i-th button (\`driver.findElements(ADD_BUTTONS).get(i)\`) — or locate by a stable attribute per product.
2. After each click, wait for a condition that proves the re-render finished — e.g. the cart badge shows \`i + 1\` (\`textToBe\`) or \`stalenessOf(oldElement)\`.
3. Write a small helper \`clickWithRetry(By locator)\` that uses \`ExpectedConditions.refreshed(elementToBeClickable(locator))\` — no manual sleep.
4. Assert the badge equals the number of products.

**Rules**: no \`Thread.sleep\`, no catching \`Exception\` broadly, no list of elements reused after a click.`,
  hints: [
    'A WebElement is a pointer to one specific DOM node. When React replaces the node, the pointer is dead — re-find it via its By.',
    'wait.until(ExpectedConditions.textToBe(CART_BADGE, String.valueOf(i + 1)))',
    'ExpectedConditions.refreshed(condition) re-evaluates the inner condition when it hits a stale element.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

public class AddAllProductsTest extends BaseTest {

    private static final By ADD_BUTTONS = By.cssSelector("#inventory-list button[id^='add-to-cart-']");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    @Test
    public void addAllProducts() throws InterruptedException {
        loginAsStandardUser();
        List<WebElement> buttons = driver.findElements(ADD_BUTTONS);
        for (WebElement button : buttons) {
            try {
                button.click();               // stale after the first re-render
            } catch (Exception e) {
                Thread.sleep(1000);
                button.click();               // still the same dead reference
            }
        }
        Assert.assertEquals(driver.findElement(CART_BADGE).getText(), String.valueOf(buttons.size()));
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class AddAllProductsTest extends BaseTest {

    private static final By ADD_BUTTONS = By.cssSelector("#inventory-list button[id^='add-to-cart-']");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    private WebDriverWait wait;

    @Test
    public void addAllProducts() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        loginAsStandardUser();

        int count = driver.findElements(ADD_BUTTONS).size();
        Assert.assertTrue(count > 0, "No products found");

        for (int i = 0; i < count; i++) {
            // re-locate on every iteration: the grid was re-rendered by the previous click
            By ithButton = By.cssSelector("#inventory-list .inventory-item:nth-of-type(" + (i + 1) + ") .btn-inventory");
            clickWithRetry(ithButton);
            wait.until(ExpectedConditions.textToBe(CART_BADGE, String.valueOf(i + 1)));
        }

        Assert.assertEquals(driver.findElement(CART_BADGE).getText(), String.valueOf(count));
    }

    /** Clicks an element that may be re-rendered while we wait for it. */
    private void clickWithRetry(By locator) {
        WebElement element = wait.until(
                ExpectedConditions.refreshed(ExpectedConditions.elementToBeClickable(locator)));
        element.click();
    }
}
`,
  checks: [
    { label: 'Re-locates elements inside the loop', pattern: 'for\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?(findElements?\\s*\\(|By\\.(cssSelector|xpath)\\s*\\()', hint: 'Find the button again on every iteration' },
    { label: 'Does not iterate a cached element list', pattern: 'for\\s*\\(\\s*WebElement\\s+\\w+\\s*:', mustNot: true, hint: 'A for-each over a stored List<WebElement> goes stale after the first re-render' },
    { label: 'Waits for the re-render to complete', pattern: '(textToBe|stalenessOf|textToBePresentInElementLocated)\\s*\\(', hint: 'wait.until(ExpectedConditions.textToBe(CART_BADGE, ...))' },
    { label: 'Uses ExpectedConditions.refreshed', pattern: 'refreshed\\s*\\(', hint: 'ExpectedConditions.refreshed(elementToBeClickable(locator))' },
    { label: 'No broad catch (Exception e)', pattern: 'catch\\s*\\(\\s*Exception\\s', mustNot: true, hint: 'Catching Exception hides real failures' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Sleeping does not revive a dead reference' },
  ],
  explanation: `**What "stale" means**: a \`WebElement\` is a handle to one specific DOM node. If the page removes or replaces that node (React/Angular re-render, AJAX refresh, navigation), the handle is dead forever — sleeping and retrying *the same reference* can never work.

**The cure**: keep \`By\` locators, not elements. Re-find right before acting. Page Object methods that locate on each call (\`driver.findElement(ADD)\`) are naturally stale-safe; fields holding \`WebElement\`s across actions are not.

**Synchronise with the re-render**: after each click, wait for something that only becomes true after the update — the badge text (\`textToBe\`) or \`stalenessOf(oldElement)\` (useful as "wait until the old page is gone"). Then the next \`findElement\` returns a fresh node.

**\`ExpectedConditions.refreshed(...)\`** wraps a condition so that a \`StaleElementReferenceException\` thrown while evaluating it is treated as "not yet" — it is designed for elements that are re-rendered while you wait. A \`FluentWait\` ignoring \`StaleElementReferenceException\` with a lambda that re-finds the element is the equivalent general tool.

Never "fix" it with \`catch (Exception e)\` — you'll also swallow genuine failures.`,
  mistakes: [
    'Catching StaleElementReferenceException and retrying the same element object.',
    'Storing WebElements as Page Object fields and reusing them after navigation or AJAX updates.',
    'Adding Thread.sleep before each click, which only shifts the race.',
    'Using @FindBy proxies and assuming they cannot go stale — a List<WebElement> captured in a local variable still can.',
  ],
  interview: [
    { q: 'What causes StaleElementReferenceException?', a: 'The element you hold a reference to was removed from the DOM or replaced (re-render, page refresh, navigation) after you found it. The reference cannot be revived; you must find the element again.' },
    { q: 'How do you prevent it in a framework?', a: 'Store locators instead of elements, re-find right before interacting, wait for the re-render to finish (stalenessOf the old element or a new state), and use ExpectedConditions.refreshed or FluentWait ignoring the exception for elements that update while waiting.' },
    { q: 'Does PageFactory solve stale elements?', a: 'Partly: @FindBy fields are lazy proxies that re-locate on each method call, but @CacheLookup or a local variable holding the element can still go stale.' },
  ],
}
