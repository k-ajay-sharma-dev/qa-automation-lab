export default {
  id: 'sel-042',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Cart badge count: 1, 2, 3, back to 1 — and gone at zero',
  level: 'INTERMEDIATE',
  tags: ['waits', 'textToBe', 'findElements', 'cart', 'negative-test'],
  estMinutes: 15,
  scenario: `Bug SHOP-412 from UAT: after removing the last item, the cart icon still showed a "1" badge until the page was refreshed. The developer fixed \`updateBadge()\` in \`shop.js\`, which now **removes** the badge element entirely when the cart is empty. Your test lead wants a regression test that follows the badge through adds and removes on \`inventory.html\`, including the "no badge at all" state.`,
  description: `Log in with \`loginAsStandardUser()\` (from \`BaseTest\`, cart starts empty) and open \`inventory.html\`.

1. Assert there is **no** badge: \`[data-testid=shopping-cart-badge]\` inside \`#shopping-cart-link\` matches zero elements.
2. Click \`#add-to-cart-trailblazer-backpack\`, \`#add-to-cart-pulse-bike-light\` and \`#add-to-cart-retro-red-tee\`, waiting after each click for the badge to show \`1\`, \`2\`, \`3\`.
3. Click \`#remove-pulse-bike-light\` and \`#remove-retro-red-tee\` (the add buttons turn into remove buttons) and wait for \`2\`, then \`1\`.
4. Click \`#remove-trailblazer-backpack\` and wait until the badge **no longer exists**.

**Rules**
- Write a helper \`expectBadge(int count)\` that uses \`ExpectedConditions.textToBe\`.
- Check absence with \`findElements(...).isEmpty()\` or \`invisibilityOfElementLocated\` — never by catching \`NoSuchElementException\`.
- No \`Thread.sleep\`.`,
  hints: [
    'private static final By BADGE = By.cssSelector("#shopping-cart-link [data-testid=shopping-cart-badge]");',
    'wait.until(ExpectedConditions.textToBe(BADGE, String.valueOf(count)))',
    'For zero: wait.until(ExpectedConditions.invisibilityOfElementLocated(BADGE)), then assertTrue(driver.findElements(BADGE).isEmpty()).',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CartBadgeTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By BADGE = By.cssSelector("#shopping-cart-link [data-testid=shopping-cart-badge]");

    private void expectBadge(int count) {
        // TODO: wait until the badge text equals count
    }

    @Test
    public void badgeFollowsAddsAndRemoves() {
        loginAsStandardUser();
        driver.get(BASE + "inventory.html");

        driver.findElement(By.id("add-to-cart-trailblazer-backpack")).click();
        Assert.assertEquals(driver.findElement(BADGE).getText(), "1"); // may run before the update
        // TODO: add two more, remove two, remove the last one, check the badge is gone
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

public class CartBadgeTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By BADGE = By.cssSelector("#shopping-cart-link [data-testid=shopping-cart-badge]");

    private WebDriverWait waitFor() {
        return new WebDriverWait(driver, Duration.ofSeconds(5));
    }

    private void click(String id) {
        waitFor().until(ExpectedConditions.elementToBeClickable(By.id(id))).click();
    }

    private void expectBadge(int count) {
        waitFor().until(ExpectedConditions.textToBe(BADGE, String.valueOf(count)));
    }

    private void expectNoBadge() {
        waitFor().until(ExpectedConditions.invisibilityOfElementLocated(BADGE));
        Assert.assertTrue(driver.findElements(BADGE).isEmpty(), "Badge must be removed when the cart is empty");
    }

    @Test
    public void badgeFollowsAddsAndRemoves() {
        loginAsStandardUser();
        driver.get(BASE + "inventory.html");
        expectNoBadge();

        click("add-to-cart-trailblazer-backpack");
        expectBadge(1);
        click("add-to-cart-pulse-bike-light");
        expectBadge(2);
        click("add-to-cart-retro-red-tee");
        expectBadge(3);

        click("remove-pulse-bike-light");
        expectBadge(2);
        click("remove-retro-red-tee");
        expectBadge(1);

        click("remove-trailblazer-backpack"); // SHOP-412: last item
        expectNoBadge();
    }
}
`,
  checks: [
    { label: 'Waits for the badge text with textToBe', pattern: 'textToBe\\s*\\(\\s*BADGE', hint: 'wait.until(ExpectedConditions.textToBe(BADGE, String.valueOf(count)))' },
    { label: 'Removes items with the remove-<slug> buttons', pattern: 'remove-(pulse-bike-light|retro-red-tee|trailblazer-backpack)', hint: 'click("remove-pulse-bike-light")' },
    { label: 'Checks the badge is gone after the last remove', pattern: '(findElements\\s*\\(\\s*BADGE\\s*\\)\\s*\\.isEmpty\\s*\\(|invisibilityOfElementLocated\\s*\\(\\s*BADGE)', hint: 'Assert.assertTrue(driver.findElements(BADGE).isEmpty())' },
    { label: 'Does not catch NoSuchElementException', pattern: 'catch\\s*\\(\\s*(org\\.openqa\\.selenium\\.)?NoSuchElementException', mustNot: true, hint: 'Use findElements(...).isEmpty() for absence' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the badge text instead' },
  ],
  explanation: `The badge is re-rendered by JavaScript after each click, so reading it once right after \`click()\` races the update. \`textToBe(BADGE, "2")\` polls until the text is exactly "2" — and also catches an "off by one" bug, because a stale "1" or a premature "3" makes it time out with a clear message.

Zero is a different state: \`shop.js\` **removes** the badge element rather than showing "0". So \`textToBe(BADGE, "0")\` would wait forever. \`invisibilityOfElementLocated\` returns true when the element is hidden *or* absent, and \`findElements(BADGE).isEmpty()\` then states the requirement precisely: no badge in the DOM.

Note the slug-based ids: on \`inventory.html\` the same button toggles between \`add-to-cart-<slug>\` and \`remove-<slug>\`, so the test reads like the user journey.`,
  mistakes: [
    'Asserting the badge text directly after click() — passes locally, fails on a slow CI agent.',
    'Expecting the badge to show "0" for an empty cart; the product decision is to remove it.',
    'Checking absence with try { findElement } catch (NoSuchElementException) — slow with an implicit wait and hides real errors.',
    'Only testing adds; the SHOP-412 defect was on the remove-last-item path.',
  ],
  interview: [
    { q: 'textToBe vs textToBePresentInElementLocated?', a: 'textToBe requires the exact text; textToBePresentInElementLocated only requires that the text contains the substring. For a counter, "1" is contained in "10" and "21", so exact matching avoids false passes.' },
    { q: 'Why is findElements().isEmpty() better than catching NoSuchElementException for absence?', a: 'It returns an empty list instead of throwing, so the intent is explicit and no exception is used for control flow. With an implicit wait it still waits, which is another reason to keep the implicit wait at zero.' },
    { q: 'What else would you check on the badge beyond the number?', a: 'That it survives navigation (inventory → cart → inventory), that it matches the number of rows on cart.html, and that it resets after logout — state bugs hide in transitions.' },
  ],
}
