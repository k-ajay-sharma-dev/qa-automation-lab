export default {
  id: 'sel-035',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Checkout button: disabled on an empty cart, enabled after adding an item',
  level: 'INTERMEDIATE',
  tags: ['isEnabled', 'waits', 'elementToBeClickable', 'cart', 'negative-test'],
  estMinutes: 15,
  scenario: `Production incident SHOP-388: customers with an empty cart could click **Checkout** and land on a broken checkout page with a $0.00 total. The fix disables the button in \`cart.html\` while the cart is empty. The bug must never come back, so the test lead wants a regression test covering both states — and the removal path, because that is where the original bug lived.`,
  description: `Log in with \`loginAsStandardUser()\` (from \`BaseTest\`), make sure the cart is empty, then:

1. Open \`cart.html\` and assert the **Checkout** button (\`#checkout\`) is **disabled** (\`isEnabled()\` is false) and the empty message \`#empty-cart-message\` is displayed.
2. Go to \`inventory.html\`, click \`#add-to-cart-trailblazer-backpack\`, then open the cart again.
3. Wait until Checkout is clickable and assert it is **enabled**.
4. Click \`#remove-trailblazer-backpack\` and wait until Checkout is **disabled again**.

**Rules**
- Use \`WebDriverWait\` + \`ExpectedConditions\` for state changes; no \`Thread.sleep\`.
- Assert the disabled state explicitly — do not just "try to click and catch".`,
  hints: [
    'Assert.assertFalse(driver.findElement(CHECKOUT).isEnabled(), "...")',
    'wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT)) — clickable means visible AND enabled.',
    'For the reverse: wait.until(ExpectedConditions.not(ExpectedConditions.elementToBeClickable(CHECKOUT)))',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.annotations.Test;

public class CheckoutButtonStateTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By CHECKOUT = By.id("checkout");
    private static final By EMPTY_MESSAGE = By.id("empty-cart-message");
    private static final By ADD_BACKPACK = By.id("add-to-cart-trailblazer-backpack");
    private static final By REMOVE_BACKPACK = By.id("remove-trailblazer-backpack");

    @Test
    public void checkoutIsOnlyEnabledWithItemsInCart() {
        loginAsStandardUser();
        driver.get(BASE + "cart.html");
        // TODO: assert Checkout is disabled on an empty cart
        // TODO: add the backpack, reopen the cart, assert Checkout is enabled
        // TODO: remove the item and assert Checkout is disabled again
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class CheckoutButtonStateTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By CHECKOUT = By.id("checkout");
    private static final By EMPTY_MESSAGE = By.id("empty-cart-message");
    private static final By ADD_BACKPACK = By.id("add-to-cart-trailblazer-backpack");
    private static final By REMOVE_BACKPACK = By.id("remove-trailblazer-backpack");

    @Test
    public void checkoutIsOnlyEnabledWithItemsInCart() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        loginAsStandardUser();

        // 1. Empty cart: button disabled, message shown
        driver.get(BASE + "cart.html");
        Assert.assertTrue(driver.findElement(EMPTY_MESSAGE).isDisplayed(), "Empty-cart message missing");
        Assert.assertFalse(driver.findElement(CHECKOUT).isEnabled(), "Checkout must be disabled on an empty cart");

        // 2. Add an item
        driver.get(BASE + "inventory.html");
        wait.until(ExpectedConditions.elementToBeClickable(ADD_BACKPACK)).click();
        driver.get(BASE + "cart.html");

        // 3. Button becomes enabled
        wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT));
        Assert.assertTrue(driver.findElement(CHECKOUT).isEnabled(), "Checkout must be enabled with 1 item");

        // 4. Remove it again: button disabled again (the SHOP-388 path)
        driver.findElement(REMOVE_BACKPACK).click();
        wait.until(ExpectedConditions.not(ExpectedConditions.elementToBeClickable(CHECKOUT)));
        Assert.assertFalse(driver.findElement(CHECKOUT).isEnabled(), "Checkout must be disabled after removing the last item");
    }
}
`,
  checks: [
    { label: 'Asserts the disabled state with isEnabled()', pattern: 'assertFalse\\s*\\([^;]*isEnabled\\s*\\(', hint: 'Assert.assertFalse(driver.findElement(CHECKOUT).isEnabled())' },
    { label: 'Asserts the enabled state', pattern: 'assertTrue\\s*\\([^;]*isEnabled\\s*\\(', hint: 'Assert.assertTrue(driver.findElement(CHECKOUT).isEnabled())' },
    { label: 'Waits with an explicit wait', pattern: 'new\\s+WebDriverWait\\s*\\(', hint: 'new WebDriverWait(driver, Duration.ofSeconds(10))' },
    { label: 'Waits for Checkout to become clickable', pattern: 'elementToBeClickable\\s*\\(\\s*CHECKOUT', hint: 'wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT))' },
    { label: 'Removes the item again', pattern: 'REMOVE_BACKPACK\\s*\\)\\s*\\.click\\s*\\(', hint: 'driver.findElement(REMOVE_BACKPACK).click()' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the state, do not sleep' },
  ],
  explanation: `\`isEnabled()\` returns false for form controls with the \`disabled\` attribute — exactly what \`cart.html\` sets with \`checkoutBtn.disabled = items.length === 0\`. Asserting it directly gives a clear failure ("Checkout must be disabled on an empty cart") instead of a vague click error.

\`elementToBeClickable\` waits for **visible and enabled**, so it is the natural wait for "button becomes enabled". There is no built-in "becomes disabled" condition, but wrapping it in \`ExpectedConditions.not(...)\` gives you one. Here the page re-renders synchronously, so the waits are cheap insurance; on a real SPA the enable/disable often follows an API call, and the wait is what keeps the test stable.

Covering add **and** remove matters: the original defect was in the transition back to empty, which a happy-path-only test would never catch.`,
  mistakes: [
    'Clicking the disabled button and expecting an exception — Selenium happily "clicks" a disabled button; nothing happens and the test learns nothing.',
    'Checking getDomAttribute("disabled") equals "false" — a boolean attribute is either present or absent; isEnabled() is the reliable check.',
    'Not starting from an empty cart: leftover sessionStorage from a previous test makes step 1 fail randomly.',
    'Only testing the enabled path and skipping the remove-last-item transition.',
  ],
  interview: [
    { q: 'What exactly does elementToBeClickable check?', a: 'That the element is visible and enabled. It does not check that nothing overlays it, so an overlay can still cause ElementClickInterceptedException.' },
    { q: 'How do you wait for a button to become disabled?', a: 'ExpectedConditions.not(elementToBeClickable(locator)), or a lambda like d -> !d.findElement(locator).isEnabled().' },
    { q: 'isEnabled() returns true on a div styled to look disabled. Why?', a: 'isEnabled only reflects the disabled state of real form controls. For custom components check aria-disabled or a CSS class with getDomAttribute, and raise an accessibility defect if aria-disabled is missing.' },
  ],
}
