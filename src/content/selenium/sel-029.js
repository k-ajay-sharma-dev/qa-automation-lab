export default {
  id: 'sel-029',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Shadow DOM: apply a coupon inside a web component with getShadowRoot()',
  level: 'ADVANCED',
  tags: ['shadow-dom', 'getShadowRoot', 'SearchContext', 'web-components', 'selenium4'],
  estMinutes: 25,
  scenario: `The front-end team replaced the coupon box with a reusable \`<coupon-widget>\` web component. Since then the coupon tests fail with \`NoSuchElementException\` — yet \`#coupon-code\` is right there in DevTools. A teammate "fixed" one test with \`executeScript("return arguments[0].shadowRoot.querySelector(...)")\` and another with a 30-second implicit wait (which, of course, did nothing). The input and button live inside an **open shadow root**, and Selenium 4 has a proper API for it. The widget is section 6 of \`dynamic.html\`.`,
  description: `On \`http://localhost:5180/practice-site/dynamic.html\`:

1. Write \`SearchContext couponRoot()\` that finds the host \`coupon-widget\` and returns \`host.getShadowRoot()\`. The component attaches its shadow root from JavaScript, so wrap it in a wait that ignores \`NoSuchShadowRootException\` until the root exists.
2. Inside the root, find \`#coupon-code\` and \`#apply-coupon\` with **CSS selectors** (XPath is not supported inside a shadow root).
3. Type \`save10\` (the widget upper-cases it), click Apply, and wait until \`#coupon-message\` contains \`Coupon applied: 10% off\` (use \`textToBePresentInElement\` with the shadow element — the \`…Located\` variants search the *document* and cannot see into the root).
4. Assert the page-level status \`#dynamic-result\` (outside the shadow root, normal \`driver.findElement\`) is \`Coupon: SAVE10\`.
5. Negative case: replace the code with \`BOGUS\`, Apply, and wait for \`Invalid coupon\`.

**Rules**: no \`executeScript\` to reach the shadow root; no \`By.xpath\` inside it; no \`Thread.sleep\`.`,
  hints: [
    'SearchContext root = driver.findElement(By.cssSelector("coupon-widget")).getShadowRoot();',
    'A SearchContext has findElement/findElements — the same calls as the driver, scoped to the root.',
    'new WebDriverWait(driver, Duration.ofSeconds(5)).ignoring(NoSuchShadowRootException.class).until(d -> d.findElement(HOST).getShadowRoot())',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CouponWidgetTest extends BaseTest {

    @Test
    public void couponIsApplied() {
        driver.get("http://localhost:5180/practice-site/dynamic.html");
        // NoSuchElementException: the input is inside the shadow root
        driver.findElement(By.cssSelector("#coupon-code")).sendKeys("save10");

        // the JS workaround a teammate added
        WebElement host = driver.findElement(By.cssSelector("coupon-widget"));
        WebElement button = (WebElement) ((JavascriptExecutor) driver)
                .executeScript("return arguments[0].shadowRoot.querySelector('#apply-coupon')", host);
        button.click();
        // TODO
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchShadowRootException;
import org.openqa.selenium.SearchContext;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class CouponWidgetTest extends BaseTest {

    private static final By HOST = By.cssSelector("coupon-widget");
    // inside the shadow root: CSS only
    private static final By CODE_INPUT = By.cssSelector("#coupon-code");
    private static final By APPLY = By.cssSelector("#apply-coupon");
    private static final By MESSAGE = By.cssSelector("#coupon-message");
    // in the normal document
    private static final By LAST_ACTION = By.id("dynamic-result");

    private WebDriverWait wait;

    @Test
    public void validAndInvalidCoupons() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.get("http://localhost:5180/practice-site/dynamic.html");

        applyCoupon("save10");
        waitForMessage("Coupon applied: 10% off");
        Assert.assertEquals(driver.findElement(LAST_ACTION).getText(), "Coupon: SAVE10");

        applyCoupon("BOGUS");
        waitForMessage("Invalid coupon");
    }

    private SearchContext couponRoot() {
        return wait.ignoring(NoSuchShadowRootException.class)
                .until(d -> d.findElement(HOST).getShadowRoot());
    }

    private void applyCoupon(String code) {
        SearchContext root = couponRoot();
        WebElement input = root.findElement(CODE_INPUT);
        input.clear();
        input.sendKeys(code);
        root.findElement(APPLY).click();
    }

    private void waitForMessage(String expected) {
        WebElement message = couponRoot().findElement(MESSAGE);
        wait.until(ExpectedConditions.textToBePresentInElement(message, expected));
    }
}
`,
  checks: [
    { label: 'Uses getShadowRoot()', pattern: '\\.getShadowRoot\\s*\\(\\s*\\)', hint: 'driver.findElement(HOST).getShadowRoot()' },
    { label: 'Works with the root as a SearchContext', pattern: 'SearchContext\\s+\\w+', hint: 'SearchContext root = host.getShadowRoot();' },
    { label: 'Ignores NoSuchShadowRootException while waiting', pattern: 'ignoring\\s*\\(\\s*NoSuchShadowRootException', hint: 'wait.ignoring(NoSuchShadowRootException.class).until(...)' },
    { label: 'Waits on the shadow element itself', pattern: 'textToBePresentInElement\\s*\\(\\s*\\w+\\s*,', hint: 'ExpectedConditions.textToBePresentInElement(message, "...")' },
    { label: 'No JavaScript shadowRoot workaround', pattern: '\\.shadowRoot', mustNot: true, hint: 'Selenium 4 getShadowRoot() replaces the executeScript hack' },
    { label: 'No XPath (not supported inside shadow roots)', pattern: 'By\\.xpath', mustNot: true, hint: 'Use By.cssSelector inside the root' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the message text' },
  ],
  explanation: `A **shadow root** is a private mini-document attached to a host element. CSS and \`findElement\` calls from the main document stop at the host — that is why \`driver.findElement(By.cssSelector("#coupon-code"))\` throws even though DevTools shows the input (DevTools displays it under \`#shadow-root (open)\`).

**Selenium 4 way**: \`host.getShadowRoot()\` returns a \`SearchContext\` — the same interface \`WebDriver\` and \`WebElement\` implement — so you call \`findElement\` on it as usual. Two limitations:
- Chromium only supports **CSS selectors** inside a shadow root (XPath raises an \`InvalidArgumentException\`-style error).
- The \`ExpectedConditions\` methods that take a \`By\` (\`…Located\`) search from the *driver*, so they never see shadow content. Use the element-based variants (\`textToBePresentInElement(element, text)\`, \`visibilityOf(element)\`) or a lambda that re-reads from the root.

**Timing**: a web component attaches its shadow root in \`connectedCallback\`, after the element exists. Until then \`getShadowRoot()\` throws \`NoSuchShadowRootException\` — the wait ignores it and retries, and \`couponRoot()\` is re-called each time so a re-rendered component never leaves you with a stale root.

**Nested components**: for a component inside a component, chain: \`outerHost.getShadowRoot().findElement(innerHost).getShadowRoot().findElement(...)\`. **Closed** shadow roots (\`mode: 'closed'\`) cannot be reached by any WebDriver API — that is a testability conversation with the developers.

The old \`executeScript("return arguments[0].shadowRoot…")\` hack still works but returns elements that some drivers treat inconsistently and hides the intent; the API is the reviewer's expectation now.`,
  mistakes: [
    'Searching for shadow content with driver.findElement — it stops at the host and throws NoSuchElementException.',
    'Using By.xpath inside a shadow root — Chromium supports only CSS there.',
    'Waiting with textToBePresentInElementLocated(By…) for a shadow element — it searches the document and times out.',
    'Raising the implicit wait — waiting longer does not change which document you search.',
  ],
  interview: [
    { q: 'How do you handle shadow DOM in Selenium 4?', a: 'Find the host element, call getShadowRoot() to get a SearchContext, then findElement with CSS selectors inside it. For nested components, repeat getShadowRoot() on each host.' },
    { q: 'Why does NoSuchElementException occur for an element you can see in DevTools?', a: 'Typical causes are an iframe, a shadow root, a different window, or timing. For shadow DOM, the main document cannot see into the root; you must search from the shadow root.' },
    { q: 'Can Selenium access a closed shadow root?', a: 'No. Closed shadow roots are deliberately hidden from page scripts and WebDriver. Ask developers for an open root in test builds or test the component through its public behaviour.' },
  ],
}
