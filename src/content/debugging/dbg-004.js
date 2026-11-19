export default {
  id: 'dbg-004',
  category: 'debugging',
  kind: 'code',
  title: 'NoSuchElementException that no wait can fix: the card field is in an iframe',
  level: 'BEGINNER',
  tags: ['iframe', 'switchTo', 'NoSuchElementException', 'checkout'],
  estMinutes: 15,
  scenario: `On your current project — a client web shop that, unlike the ShopEasy practice site, takes real card payments — the team integrated a third-party payment widget on the checkout page. *(The practice site has no payment iframe; to practise the same switching, use frames.html: \`#support-frame\` and the nested \`#chat-frame\`.)* Your new test \`CheckoutTest.payWithCard\` fails with \`NoSuchElementException\` for \`#card-number\`. You already added a 15-second explicit wait and it now fails with a \`TimeoutException\` instead. In DevTools the locator \`#card-number\` clearly highlights the field. What is going on?`,
  description: `Jenkins console (after the wait was added):

\`\`\`text
[ERROR] payWithCard(com.shopeasy.tests.CheckoutTest)  Time elapsed: 16.542 s  <<< ERROR!
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of element located by By.id: card-number (tried for 15 second(s) with 500 milliseconds interval)
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
	at org.openqa.selenium.support.ui.WebDriverWait.timeoutException(WebDriverWait.java:84)
	at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)
	at com.shopeasy.pages.CheckoutPage.enterCard(CheckoutPage.java:30)
	at com.shopeasy.tests.CheckoutTest.payWithCard(CheckoutTest.java:44)
Caused by: org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#card\\-number"}
\`\`\`

In DevTools, the Elements panel shows \`#card-number\` nested under \`<iframe id="payment-frame" ...>\` → \`#document\`.

**Fix \`CheckoutPage.enterCard()\`:**
- Wait for the iframe and switch into it (\`frameToBeAvailableAndSwitchToIt\`).
- Fill card number, expiry and CVV.
- **Switch back** to the main page before clicking *Place order* (which is outside the iframe).`,
  hints: [
    'If a locator works in DevTools but WebDriver never finds it, check whether it is inside an <iframe>.',
    'WebDriver only searches the current browsing context — the main document by default.',
    'wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(PAYMENT_FRAME)) ... driver.switchTo().defaultContent();',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By PAYMENT_FRAME = By.id("payment-frame");
    private final By CARD_NUMBER = By.id("card-number");
    private final By CARD_EXPIRY = By.id("card-expiry");
    private final By CARD_CVV = By.id("card-cvv");
    private final By PLACE_ORDER = By.id("place-order");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    public void enterCard(String number, String expiry, String cvv) {
        wait.until(ExpectedConditions.visibilityOfElementLocated(CARD_NUMBER)).sendKeys(number);
        driver.findElement(CARD_EXPIRY).sendKeys(expiry);
        driver.findElement(CARD_CVV).sendKeys(cvv);
    }

    public void placeOrder() {
        wait.until(ExpectedConditions.elementToBeClickable(PLACE_ORDER)).click();
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CheckoutPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By PAYMENT_FRAME = By.id("payment-frame");
    private final By CARD_NUMBER = By.id("card-number");
    private final By CARD_EXPIRY = By.id("card-expiry");
    private final By CARD_CVV = By.id("card-cvv");
    private final By PLACE_ORDER = By.id("place-order");

    public CheckoutPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    public void enterCard(String number, String expiry, String cvv) {
        // the payment widget lives in its own document - switch into it first
        wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(PAYMENT_FRAME));
        try {
            wait.until(ExpectedConditions.visibilityOfElementLocated(CARD_NUMBER)).sendKeys(number);
            driver.findElement(CARD_EXPIRY).sendKeys(expiry);
            driver.findElement(CARD_CVV).sendKeys(cvv);
        } finally {
            // always come back to the main page, even if a field fails
            driver.switchTo().defaultContent();
        }
    }

    public void placeOrder() {
        wait.until(ExpectedConditions.elementToBeClickable(PLACE_ORDER)).click();
    }
}
`,
  checks: [
    { label: 'Switches into the payment iframe', pattern: '(frameToBeAvailableAndSwitchToIt|switchTo\\(\\)\\s*\\.frame)\\s*\\(', hint: 'wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(PAYMENT_FRAME))' },
    { label: 'Switches back to the main document', pattern: 'switchTo\\(\\)\\s*\\.(defaultContent|parentFrame)\\s*\\(', hint: 'driver.switchTo().defaultContent() before touching Place order' },
    { label: 'Switch-back happens before placeOrder logic (inside enterCard)', pattern: 'enterCard[\\s\\S]*(defaultContent|parentFrame)[\\s\\S]*placeOrder', flags: 'ms', hint: 'Leave the frame at the end of enterCard()' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Waiting longer will never find an element in another document' },
  ],
  explanation: `**Root cause:** an \`<iframe>\` is a separate HTML document embedded in the page. WebDriver searches only the *current* browsing context, which is the top-level document unless you switch. That is why the locator works in DevTools (which lets you inspect any frame) but WebDriver times out no matter how long it waits — the trace even shows the \`Caused by: NoSuchElementException\` under the \`TimeoutException\`.

**Tell-tale signs it's a frame problem:**
- The locator is correct in DevTools but never found, even with a long wait.
- DevTools shows the element under \`#document\` inside an \`<iframe>\`.
- It's a third-party widget: payments, chat, captcha, embedded video, rich-text editors.

**The fix:** \`frameToBeAvailableAndSwitchToIt\` waits for the frame to load *and* switches in one step (better than \`switchTo().frame()\` straight away, which can fail while the frame is still loading). The \`finally { defaultContent() }\` guarantees we come back to the main page; otherwise the next step (\`placeOrder\`) fails with a fresh, confusing \`NoSuchElementException\`.

\`parentFrame()\` goes up one level (nested frames); \`defaultContent()\` goes all the way to the top.`,
  mistakes: [
    'Increasing the wait timeout — the element is in another document, not late.',
    'Switching into the frame and forgetting to switch back, so the next step fails.',
    'Switching by index (frame(0)) — breaks as soon as another iframe (e.g. a chat widget) is added.',
  ],
  interview: [
    { q: 'How do you handle iframes in Selenium?', a: 'I switch into the frame with driver.switchTo().frame(...) by id/name or WebElement, or better with ExpectedConditions.frameToBeAvailableAndSwitchToIt so it also waits for the frame to load. After working inside it I switch back with defaultContent(), or parentFrame() for nested frames. In my project the payment widget was in an iframe, and we wrapped the interaction in try/finally so we always returned to the main document.' },
    { q: 'How do you know an element is inside an iframe?', a: 'The locator works in DevTools but WebDriver cannot find it even with waits, and in the Elements panel the node sits under an iframe’s #document. You can also run document.querySelectorAll("iframe") in the console to see what frames exist.' },
  ],
}
