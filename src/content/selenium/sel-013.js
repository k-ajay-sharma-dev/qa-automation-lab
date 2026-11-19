export default {
  id: 'sel-013',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'JavascriptExecutor: scroll into view and survive a sticky header',
  level: 'INTERMEDIATE',
  tags: ['javascript', 'scroll', 'ElementClickInterceptedException'],
  estMinutes: 20,
  scenario: `On the long inventory page, "Add to cart" for the last product fails on Jenkins with \`ElementClickInterceptedException: Other element would receive the click: <header class="site-header">\`. Locally your big monitor shows the whole page, so it passes. You need to scroll the button into view (centered, clear of the sticky header) and — only as a documented last resort — fall back to a JavaScript click.`,
  description: `On \`http://localhost:5180/practice-site/inventory.html\` (after login):

1. Cast the driver to \`JavascriptExecutor\`.
2. Scroll the **last** product's "Add to cart" button (\`#inventory-list .btn-inventory\`) into the centre of the viewport with \`arguments[0].scrollIntoView({block: 'center'})\`.
3. Wait until it is clickable and click it **normally**.
4. Wrap the click in a helper \`safeClick(By)\` that catches \`ElementClickInterceptedException\` and only then uses \`arguments[0].click()\` (log a warning when it does).
5. Read the cart badge (\`.shopping-cart-badge\`) count with \`executeScript("return ...")\` or \`getText()\` and assert it is \`1\`.

**Rules**: JS click is a fallback, not the default; pass elements via \`arguments[0]\`, don't build JS strings with ids.`,
  hints: [
    'JavascriptExecutor js = (JavascriptExecutor) driver;',
    'js.executeScript("arguments[0].scrollIntoView({block: \'center\'});", element);',
    'executeScript returns a value when the script uses return — cast it (Long, String, Boolean...).',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

public class AddLastProductTest extends BaseTest {

    private static final By ADD_BUTTONS = By.cssSelector("#inventory-list .btn-inventory");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    @Test
    public void addLastProduct() {
        loginAsStandardUser();
        List<WebElement> buttons = driver.findElements(ADD_BUTTONS);
        buttons.get(buttons.size() - 1).click(); // intercepted by the sticky header on Jenkins
        Assert.assertEquals(driver.findElement(CART_BADGE).getText(), "1");
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class AddLastProductTest extends BaseTest {

    private static final By ADD_BUTTONS = By.cssSelector("#inventory-list .btn-inventory");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    @Test
    public void addLastProduct() {
        loginAsStandardUser();
        List<WebElement> buttons = driver.findElements(ADD_BUTTONS);
        Assert.assertFalse(buttons.isEmpty(), "No add-to-cart buttons found");

        safeClick(buttons.get(buttons.size() - 1));

        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        wait.until(ExpectedConditions.textToBePresentInElementLocated(CART_BADGE, "1"));
        Object badge = ((JavascriptExecutor) driver)
                .executeScript("return document.querySelector('.shopping-cart-badge').textContent.trim();");
        Assert.assertEquals(badge, "1");
    }

    private void safeClick(WebElement element) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("arguments[0].scrollIntoView({block: 'center'});", element);
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        try {
            wait.until(ExpectedConditions.elementToBeClickable(element)).click();
        } catch (ElementClickInterceptedException e) {
            System.out.println("WARN: native click intercepted, falling back to JS click: " + e.getMessage());
            js.executeScript("arguments[0].click();", element);
        }
    }
}
`,
  checks: [
    { label: 'Casts the driver to JavascriptExecutor', pattern: '\\(\\s*JavascriptExecutor\\s*\\)\\s*driver', hint: 'JavascriptExecutor js = (JavascriptExecutor) driver;' },
    { label: 'Scrolls the element into view', pattern: 'executeScript\\s*\\(\\s*"[^"]*scrollIntoView', hint: 'js.executeScript("arguments[0].scrollIntoView({block: \'center\'});", el)' },
    { label: 'Passes the element as arguments[0]', pattern: 'arguments\\[0\\]', hint: 'Pass WebElements as script arguments' },
    { label: 'Catches ElementClickInterceptedException', pattern: 'catch\\s*\\(\\s*ElementClickInterceptedException', hint: 'Fall back to JS click only when the native click is intercepted' },
    { label: 'JS click fallback', pattern: 'arguments\\[0\\]\\.click\\s*\\(\\s*\\)', hint: 'js.executeScript("arguments[0].click();", el)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for clickability after scrolling' },
  ],
  explanation: `\`JavascriptExecutor.executeScript(script, args...)\` runs JavaScript in the page. Arguments are available as \`arguments[0..n]\` — WebElements are passed as real DOM nodes, so you never need to build selector strings. Use \`return\` to get values back (numbers come back as \`Long\`/\`Double\`, elements as \`WebElement\`, arrays as \`List\`).

Typical legitimate uses:
- \`scrollIntoView({block: 'center'})\` — centred, so sticky headers/footers don't cover the element
- \`window.scrollTo(0, document.body.scrollHeight)\` for infinite scroll
- reading things WebDriver can't easily give (\`document.readyState\`, \`localStorage\`, computed styles)

**Why JS click is a last resort**: it bypasses the browser's hit-testing. If a real overlay blocks the button, a user can't click it — but the JS click still passes, hiding a real bug. Reviewers accept it only with a comment and logging, ideally only for known third-party overlays. The best fix for *this* failure is scrolling to centre (so the sticky header no longer overlaps) and setting a consistent window size.`,
  mistakes: [
    'Using JS click everywhere "because it never fails" — it also never catches overlay bugs.',
    'scrollIntoView(true) aligning to the top, right under a sticky header — click still intercepted.',
    'Building scripts with string concatenation: "document.getElementById(\'" + id + "\').click()".',
    'Expecting executeScript to return an int — numbers come back as Long.',
  ],
  interview: [
    { q: 'When do you use JavascriptExecutor?', a: 'For scrolling, reading page state (readyState, storage), setting values on tricky widgets, or as a documented fallback click. Not as the default interaction because it skips real user-level checks.' },
    { q: 'What causes ElementClickInterceptedException?', a: 'Another element (overlay, sticky header, cookie banner, spinner) is on top of the target at the click point. Fix by waiting for the overlay to disappear, scrolling the element to the centre, or closing the banner.' },
    { q: 'How do you scroll in Selenium 4 without JS?', a: 'new Actions(driver).scrollToElement(el).perform() or scrollByAmount(x, y), using the W3C wheel actions.' },
  ],
}
