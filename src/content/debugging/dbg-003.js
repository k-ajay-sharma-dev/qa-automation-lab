export default {
  id: 'dbg-003',
  category: 'debugging',
  kind: 'code',
  title: 'StaleElementReferenceException: removing items from a re-rendering cart',
  level: 'INTERMEDIATE',
  tags: ['StaleElementReferenceException', 're-render', 'loops', 'waits'],
  estMinutes: 20,
  scenario: `A cleanup helper \`CartPage.removeAllItems()\` is called in \`@AfterMethod\` so every test starts with an empty cart. It worked until the ShopEasy front-end moved to React: now **every time you remove one item, the whole cart list is re-rendered**. The helper removes the first item and then blows up, which leaves items in the cart and makes the *next* test fail too.`,
  description: `Jenkins console:

\`\`\`text
[ERROR] tearDown(com.shopeasy.tests.CartTest)  Time elapsed: 1.203 s  <<< FAILURE!
org.openqa.selenium.StaleElementReferenceException: stale element reference: stale element not found in the current frame
  (Session info: chrome=126.0.6478.126)
For documentation on this error, please visit: https://www.selenium.dev/documentation/webdriver/troubleshooting/errors#stale-element-reference-exception
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Element: [[ChromeDriver: chrome on linux (a1b2c3...)] -> css selector: .cart-item .cart-remove]
	at org.openqa.selenium.remote.RemoteWebElement.click(RemoteWebElement.java:94)
	at com.shopeasy.pages.CartPage.removeAllItems(CartPage.java:33)
	at com.shopeasy.tests.BaseTest.tearDown(BaseTest.java:48)
\`\`\`

**Diagnose:** the \`List<WebElement>\` was captured *once*. After the first click the DOM nodes were thrown away and rebuilt, so the remaining references point at nodes that no longer exist.

**Fix \`removeAllItems()\`:**
- Re-locate the remove buttons on **every** iteration (don't loop over a list captured before the DOM changed).
- After each click, wait until the number of buttons has dropped (or the clicked element is stale) before continuing.
- **Rules:** no \`Thread.sleep\`, no blind \`try/catch (StaleElementReferenceException)\` that swallows the error.`,
  hints: [
    'A WebElement is a pointer to one specific DOM node. If the framework re-renders, the pointer dies even though an identical-looking node is on screen.',
    'Loop with while (!driver.findElements(REMOVE_BUTTONS).isEmpty()) and find the first button fresh each time.',
    'wait.until(ExpectedConditions.numberOfElementsToBe(REMOVE_BUTTONS, before - 1)) or ExpectedConditions.stalenessOf(button).',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CartPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By REMOVE_BUTTONS = By.cssSelector(".cart-item .cart-remove");

    public CartPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void removeAllItems() {
        List<WebElement> buttons = driver.findElements(REMOVE_BUTTONS);
        for (WebElement button : buttons) {
            button.click(); // line 33 - 2nd iteration throws StaleElementReferenceException
        }
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class CartPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By REMOVE_BUTTONS = By.cssSelector(".cart-item .cart-remove");

    public CartPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void removeAllItems() {
        List<WebElement> buttons = driver.findElements(REMOVE_BUTTONS);
        while (!buttons.isEmpty()) {
            int before = buttons.size();
            buttons.get(0).click();
            // the list is re-rendered after every removal - wait for it, then locate again
            wait.until(ExpectedConditions.numberOfElementsToBe(REMOVE_BUTTONS, before - 1));
            buttons = driver.findElements(REMOVE_BUTTONS);
        }
    }
}
`,
  checks: [
    { label: 'Does not for-each over a list captured before the DOM changes', pattern: 'for\\s*\\(\\s*WebElement\\s+\\w+\\s*:', mustNot: true, hint: 'The captured list goes stale after the first re-render' },
    { label: 'Loops until no remove buttons are left', pattern: 'while\\s*\\(', hint: 'while (!buttons.isEmpty()) { ... }' },
    { label: 'Re-locates the buttons inside the loop', pattern: 'while\\s*\\([\\s\\S]*\\{[\\s\\S]*findElements\\s*\\(\\s*REMOVE_BUTTONS', flags: 'ms', hint: 'Call driver.findElements(REMOVE_BUTTONS) again inside the loop' },
    { label: 'Waits for the re-render to finish', pattern: '(numberOfElementsToBe(LessThan)?|stalenessOf)\\s*\\(', hint: 'numberOfElementsToBe(REMOVE_BUTTONS, before - 1) or stalenessOf(button)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Use a condition, not a pause' },
  ],
  explanation: `**What "stale" really means:** a \`WebElement\` is a handle to *one specific DOM node*. When React/Angular re-renders the list, the old nodes are destroyed and new ones (that look identical) are created. Your handle still points at the destroyed node → \`StaleElementReferenceException\` the next time you touch it.

**Classic triggers in real projects:**
- Looping over a captured \`List<WebElement>\` while each action changes the list (remove, sort, filter, pagination).
- Storing a \`WebElement\` in a page-object field and using it after navigation or an AJAX refresh.
- Reading table rows right after clicking a column header to sort.

**The fix pattern:** *locate → act → wait for the change → locate again*. Waiting for \`numberOfElementsToBe(before - 1)\` (or \`stalenessOf(oldElement)\`) is important: if you re-find immediately you may grab the *old* list that is about to be replaced, and you are back to a flaky test.

This is also why we keep **\`By\` locators** (not \`WebElement\`s) as fields in page objects — a \`By\` is re-evaluated every time.

**Bonus impact:** because this helper ran in \`@AfterMethod\`, its failure left items in the cart and caused the next test to fail with a wrong badge count — one root cause, two red tests. Always fix the first failure in a log first.`,
  mistakes: [
    'Wrapping click() in try/catch StaleElementReferenceException and ignoring it — items stay in the cart.',
    'Re-finding immediately without waiting for the re-render, which is still flaky.',
    'Storing WebElement fields in the page object instead of By locators.',
    'Using a for (int i...) loop with buttons.get(i) — indexes shift after each removal.',
  ],
  interview: [
    { q: 'What causes StaleElementReferenceException and how did you handle it?', a: 'It happens when the DOM node behind a WebElement is removed or replaced, typically after an AJAX refresh or a React re-render. In my project it showed up in a cart cleanup loop. We fixed it by keeping By locators in page objects, re-locating the element after each action, and waiting for the change to complete with numberOfElementsToBe or stalenessOf. We avoid blanket retry-on-stale wrappers because they hide timing issues.' },
    { q: 'Is PageFactory immune to stale elements?', a: 'No. @FindBy fields are lazy proxies that re-find on each call, which helps, but if you cache them with @CacheLookup or hold a list across a re-render you still get stale elements. Understanding when the DOM changes matters more than the pattern.' },
  ],
}
