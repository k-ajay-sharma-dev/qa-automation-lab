export default {
  id: 'sel-021',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Back, forward, refresh: verify navigation and redirects',
  level: 'BEGINNER',
  tags: ['navigation', 'getCurrentUrl', 'getTitle', 'refresh'],
  estMinutes: 15,
  scenario: `Support ticket CS-311: "After I press the browser Back button on the cart page my cart badge disappears." Manually you checked three things every release: the login redirect lands on the products page, Back/Forward between Products and Cart shows the right page, and a page refresh does not lose the cart. Your lead wants those 10 manual minutes turned into one automated test. ShopEasy keeps the cart in the browser session, so it should survive both Back and Refresh.`,
  description: `Using the \`BaseTest\` from earlier problems (it gives you \`driver\` and \`loginAsStandardUser()\`):

1. Log in. Wait until the URL contains \`inventory.html\` and assert the title is \`ShopEasy — Products\` (the login form *redirects* with JavaScript, so wait, don't assert straight away).
2. Add the backpack (\`#add-to-cart-trailblazer-backpack\`) and assert the cart badge \`.shopping-cart-badge\` shows \`1\`.
3. \`driver.navigate().refresh()\` and assert the badge still shows \`1\`.
4. Click the cart icon \`#shopping-cart-link\`, wait for \`cart.html\` and assert the title \`ShopEasy — Your Cart\`.
5. \`driver.navigate().back()\` → you are on the products page again (URL + title) and the badge is still \`1\`.
6. \`driver.navigate().forward()\` → back on the cart, with one \`[data-testid='cart-item']\` row.

**Rules**
- Use \`driver.navigate()\` for back / forward / refresh.
- After every navigation, *wait* for the URL (\`ExpectedConditions.urlContains\`) before asserting.
- No \`Thread.sleep\`.`,
  hints: [
    'driver.navigate().back(), .forward() and .refresh() behave like the browser buttons.',
    'wait.until(ExpectedConditions.urlContains("cart.html")) returns once the address bar has changed.',
    'After back() or refresh() the page is rebuilt — find the badge again, do not reuse an old WebElement.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class NavigationTest extends BaseTest {

    private static final By ADD_BACKPACK = By.id("add-to-cart-trailblazer-backpack");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");
    private static final By CART_LINK = By.id("shopping-cart-link");
    private static final By CART_ITEMS = By.cssSelector("[data-testid='cart-item']");

    @Test
    public void cartSurvivesBackForwardAndRefresh() {
        loginAsStandardUser();
        Assert.assertEquals(driver.getTitle(), "ShopEasy — Products"); // may still be the login page!

        driver.findElement(ADD_BACKPACK).click();
        driver.get(driver.getCurrentUrl()); // "refresh"
        // TODO: cart link, back, forward — with waits and assertions
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

public class NavigationTest extends BaseTest {

    private static final By ADD_BACKPACK = By.id("add-to-cart-trailblazer-backpack");
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");
    private static final By CART_LINK = By.id("shopping-cart-link");
    private static final By CART_ITEMS = By.cssSelector("[data-testid='cart-item']");

    private WebDriverWait wait;

    @Test
    public void cartSurvivesBackForwardAndRefresh() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        loginAsStandardUser();
        assertOnPage("inventory.html", "ShopEasy — Products");

        driver.findElement(ADD_BACKPACK).click();
        assertBadge("1");

        driver.navigate().refresh();
        assertOnPage("inventory.html", "ShopEasy — Products");
        assertBadge("1");

        driver.findElement(CART_LINK).click();
        assertOnPage("cart.html", "ShopEasy — Your Cart");

        driver.navigate().back();
        assertOnPage("inventory.html", "ShopEasy — Products");
        assertBadge("1");

        driver.navigate().forward();
        assertOnPage("cart.html", "ShopEasy — Your Cart");
        Assert.assertEquals(driver.findElements(CART_ITEMS).size(), 1, "Cart should hold the backpack");
    }

    private void assertOnPage(String urlPart, String expectedTitle) {
        wait.until(ExpectedConditions.urlContains(urlPart));
        Assert.assertEquals(driver.getTitle(), expectedTitle,
                "Wrong page after navigation, URL was " + driver.getCurrentUrl());
    }

    private void assertBadge(String expected) {
        String badge = wait.until(ExpectedConditions.visibilityOfElementLocated(CART_BADGE)).getText();
        Assert.assertEquals(badge, expected, "Cart badge on " + driver.getCurrentUrl());
    }
}
`,
  checks: [
    { label: 'Refreshes with navigate().refresh()', pattern: '\\.navigate\\s*\\(\\s*\\)\\s*\\.refresh\\s*\\(', hint: 'driver.navigate().refresh();' },
    { label: 'Goes back with navigate().back()', pattern: '\\.navigate\\s*\\(\\s*\\)\\s*\\.back\\s*\\(', hint: 'driver.navigate().back();' },
    { label: 'Goes forward with navigate().forward()', pattern: '\\.navigate\\s*\\(\\s*\\)\\s*\\.forward\\s*\\(', hint: 'driver.navigate().forward();' },
    { label: 'Waits for the URL before asserting', pattern: '(urlContains|urlToBe|urlMatches|titleIs|titleContains)\\s*\\(', hint: 'wait.until(ExpectedConditions.urlContains("cart.html"))' },
    { label: 'Asserts the page title', pattern: 'getTitle\\s*\\(\\s*\\)', hint: 'Assert.assertEquals(driver.getTitle(), "ShopEasy — Your Cart")' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the URL instead' },
  ],
  explanation: `\`driver.navigate()\` gives you the browser's own buttons: \`back()\`, \`forward()\`, \`refresh()\` and \`to(url)\` (the same as \`get(url)\`). Calling \`get(getCurrentUrl())\` is *not* a refresh: it is a new navigation, which can behave differently with forms and history.

**Redirects need a wait.** ShopEasy's login form sets \`window.location.href\` from JavaScript after the click. \`click()\` returns as soon as the click is delivered, so reading \`getTitle()\` straight after it may still give you the login page. \`urlContains("inventory.html")\` waits for the address bar to change; after that the title check is safe.

**Why the cart survives**: ShopEasy keeps the cart in \`sessionStorage\` (key \`shopeasy.cart\`). Session storage lives as long as the tab, so Back, Forward and Refresh keep it, while a *new* browser session starts empty. That is exactly what ticket CS-311 needs to prove.

**Re-find after navigation**: every navigation builds a new document. A \`WebElement\` you found before \`back()\` or \`refresh()\` is stale afterwards, which is why the helper finds the badge again each time.

A small helper like \`assertOnPage(urlPart, title)\` keeps the test readable: one line per manual step.`,
  mistakes: [
    'Asserting getTitle() immediately after clicking Login — the JavaScript redirect has not happened yet.',
    'Using driver.get(currentUrl) as a "refresh" — it is a new navigation, not the browser refresh.',
    'Keeping the badge WebElement from before refresh() and reading it again — StaleElementReferenceException.',
    'Asserting the full URL with assertEquals — ports and hosts differ between laptop and CI; check the meaningful part.',
  ],
  interview: [
    { q: 'What is the difference between driver.get() and driver.navigate().to()?', a: 'They do the same thing: load a URL and wait for the page load. navigate() additionally offers back(), forward() and refresh(), which use the browser history.' },
    { q: 'Why can getTitle() return the old page title right after a click?', a: 'click() returns once the click is delivered. If the page then navigates (form submit, JavaScript redirect), the new page is not loaded yet. Wait for urlContains/titleIs before asserting.' },
    { q: 'Does sessionStorage survive a refresh? A new browser?', a: 'It survives refresh, back and forward in the same tab, but not a new tab or a new browser session. localStorage survives across tabs and restarts of the same profile; a fresh WebDriver session uses a fresh profile, so both start empty.' },
  ],
}
