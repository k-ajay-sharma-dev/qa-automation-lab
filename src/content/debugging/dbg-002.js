export default {
  id: 'dbg-002',
  category: 'debugging',
  kind: 'code',
  title: 'ElementClickInterceptedException: the loading spinner ate the click',
  level: 'BEGINNER',
  tags: ['ElementClickInterceptedException', 'overlay', 'spinner', 'waits'],
  estMinutes: 15,
  scenario: `On your current project — a client web shop whose cart page is built like ShopEasy's (same \`#checkout\` button) but with a real backend — the developers added a full-screen **loading overlay** (\`.loading-overlay\`) that appears while the cart is recalculated after you change a quantity. *(The ShopEasy practice site has no overlay or quantity input; to practise the same wait, use waits.html: click \`#load-data-btn\` and wait for \`#loading-spinner\` to disappear.)* Since then \`CheckoutTest.proceedToCheckout\` fails about 1 run in 3. A teammate already "fixed" it by adding \`Thread.sleep(2000)\` — it still fails on Jenkins. It's assigned to you now.`,
  description: `Jenkins console:

\`\`\`text
[ERROR] proceedToCheckout(com.shopeasy.tests.CheckoutTest)  Time elapsed: 6.104 s  <<< ERROR!
org.openqa.selenium.ElementClickInterceptedException: element click intercepted: Element <button id="checkout" class="btn btn-primary">...</button> is not clickable at point (612, 488). Other element would receive the click: <div class="loading-overlay">...</div>
  (Session info: chrome=126.0.6478.126)
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Command: [d41f0c2a..., clickElement {id=f.8A1C2E6B.d.4F1E-17}]
	at org.openqa.selenium.remote.RemoteWebElement.click(RemoteWebElement.java:94)
	at com.shopeasy.pages.CartPage.proceedToCheckout(CartPage.java:41)
	at com.shopeasy.tests.CheckoutTest.proceedToCheckout(CheckoutTest.java:35)
\`\`\`

The key phrase is **"Other element would receive the click"** — Selenium found the button, but something is on top of it.

**Fix \`CartPage.proceedToCheckout()\`:**
- Remove the \`Thread.sleep\`.
- Wait until the overlay is **invisible**, then wait until the checkout button is **clickable**, then click.
- **Rules:** do not "fix" it with a JavaScript click — a real user cannot click through the overlay either, so a JS click would hide a real problem.`,
  hints: [
    '"Other element would receive the click: <div class="loading-overlay">" tells you exactly who is in the way.',
    'ExpectedConditions.invisibilityOfElementLocated(...) waits for the overlay to go away.',
    'Then wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT_BUTTON)).click();',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CartPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By QUANTITY_INPUT = By.cssSelector(".cart-item input.qty");
    private final By LOADING_OVERLAY = By.cssSelector(".loading-overlay");
    private final By CHECKOUT_BUTTON = By.id("checkout");

    public CartPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void changeQuantity(String qty) {
        driver.findElement(QUANTITY_INPUT).clear();
        driver.findElement(QUANTITY_INPUT).sendKeys(qty);
    }

    public void proceedToCheckout() throws InterruptedException {
        Thread.sleep(2000); // "fix" from last sprint - still flaky on Jenkins
        driver.findElement(CHECKOUT_BUTTON).click(); // line 41
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CartPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By QUANTITY_INPUT = By.cssSelector(".cart-item input.qty");
    private final By LOADING_OVERLAY = By.cssSelector(".loading-overlay");
    private final By CHECKOUT_BUTTON = By.id("checkout");

    public CartPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void changeQuantity(String qty) {
        driver.findElement(QUANTITY_INPUT).clear();
        driver.findElement(QUANTITY_INPUT).sendKeys(qty);
    }

    public void proceedToCheckout() {
        // the cart recalculates behind a full-screen overlay - wait for it to disappear first
        wait.until(ExpectedConditions.invisibilityOfElementLocated(LOADING_OVERLAY));
        wait.until(ExpectedConditions.elementToBeClickable(CHECKOUT_BUTTON)).click();
    }
}
`,
  checks: [
    { label: 'Waits for the overlay to become invisible', pattern: 'invisibilityOf(ElementLocated)?\\s*\\(', hint: 'wait.until(ExpectedConditions.invisibilityOfElementLocated(LOADING_OVERLAY))' },
    { label: 'Waits for the button to be clickable', pattern: 'elementToBeClickable\\s*\\(\\s*CHECKOUT_BUTTON', hint: 'elementToBeClickable(CHECKOUT_BUTTON)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Remove the sleep — it is the "fix" that never worked' },
    { label: 'No JavaScript click workaround', pattern: 'executeScript\\s*\\([^;]*click', mustNot: true, hint: 'A JS click bypasses what a real user experiences' },
  ],
  explanation: `**Root cause:** the overlay sits on top of the page (higher z-index) while the cart recalculates. Chrome performs a real click at the button's centre point; the topmost element at that point is the overlay, so ChromeDriver refuses and throws \`ElementClickInterceptedException\`. The duration of the overlay depends on the backend, which is why a fixed 2-second sleep fails on a busy Jenkins agent.

**The fix is two waits in the right order:** first for the *blocker* to disappear (\`invisibilityOfElementLocated\`), then for the *target* to be clickable. \`elementToBeClickable\` alone is not enough — it checks visible + enabled, but not "nothing on top of it".

**Why not a JS click?** \`executeScript("arguments[0].click()")\` would pass, but it clicks *through* the overlay. If one day the overlay never goes away (a real bug!), your test still passes. Use JS clicks only for documented cases like hidden native inputs, and leave a comment why.

Other common "interceptors": cookie banners, sticky headers/footers covering an element near the edge (scroll it into view), toast messages, and modal backdrops that fade out.`,
  mistakes: [
    'Increasing the sleep to 5 seconds — slower suite, still flaky.',
    'Switching every click in the framework to a JavaScript click.',
    'Only waiting for elementToBeClickable — it does not know about an overlay on top.',
    'Catching the exception and clicking again without any wait.',
  ],
  interview: [
    { q: 'What does ElementClickInterceptedException mean and how do you fix it?', a: 'It means the element was found but another element is on top of it at the click point — usually a spinner, modal backdrop, cookie banner or sticky header. The message names the element that would receive the click. In my project we wait for that blocker to become invisible and then wait for the target to be clickable; for sticky headers we scroll the element into the centre of the view.' },
    { q: 'When is a JavaScript click acceptable?', a: 'Rarely — for example a native file input or checkbox that is visually hidden behind a styled label. It skips real user behaviour, so it can hide genuine UI bugs. We keep it in one helper method with a comment so it is not used as a default.' },
  ],
}
