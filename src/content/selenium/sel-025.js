export default {
  id: 'sel-025',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Skip the UI setup: seed the cart through sessionStorage and manage cookies',
  level: 'INTERMEDIATE',
  tags: ['cookies', 'sessionStorage', 'localStorage', 'test-data', 'JavascriptExecutor'],
  estMinutes: 25,
  scenario: `The 40 checkout tests each log in and click "Add to cart" two or three times before they reach the page they actually test — 25 seconds of setup per test, and any flake on the inventory page fails all 40. ShopEasy keeps its state in the browser: the logged-in user in \`sessionStorage\` key \`shopeasy.user\`, the cart in \`shopeasy.cart\` (a JSON array of product slugs), and the "Remember me" user in \`localStorage\` key \`shopeasy.rememberedUser\`. Your company's real app uses a session *cookie* instead, so the team also wants a reusable cookie helper.`,
  description: `Write \`CartStateTest\`:

**Part 1 – seed the cart without clicking**
1. Open \`http://localhost:5180/practice-site/inventory.html\` first (storage and cookies belong to an origin — you must be on it).
2. With \`JavascriptExecutor\`, set \`sessionStorage\` \`shopeasy.user\` = \`standard_user\` and \`shopeasy.cart\` = the JSON array of \`trailblazer-backpack\` and \`pulse-bike-light\` (pass a Java \`List\` as \`arguments[…]\` and \`JSON.stringify\` it in the script).
3. \`driver.navigate().refresh()\` so the page reads the new state; assert the badge \`.shopping-cart-badge\` is \`2\` and \`#logged-in-user\` is \`standard_user\`.
4. Open \`cart.html\` and assert two \`[data-testid='cart-item']\` rows.

**Part 2 – cookies**
5. \`addCookie\` a cookie \`shopeasy_banner\` = \`variant-b\`, read it back with \`getCookieNamed\` and assert the value; \`deleteCookieNamed\` it and assert \`getCookieNamed\` now returns \`null\`.

**Part 3 – localStorage**
6. Set \`localStorage\` \`shopeasy.rememberedUser\` = \`locked_out_user\`, open \`login.html\` and assert \`#user-name\` is pre-filled with it (\`getDomProperty("value")\`).

**Rules**: no clicks on "Add to cart"; pass values as script arguments (no string-glued JSON); no \`Thread.sleep\`.`,
  hints: [
    'js.executeScript("sessionStorage.setItem(\'shopeasy.cart\', JSON.stringify(arguments[0]));", List.of("trailblazer-backpack", "pulse-bike-light"));',
    'driver.manage().addCookie(new Cookie("shopeasy_banner", "variant-b"));',
    'Pages read storage when they load — refresh (or navigate) after writing it.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CartStateTest extends BaseTest {

    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    @Test
    public void cartIsSeeded() {
        loginAsStandardUser();
        driver.findElement(By.id("add-to-cart-trailblazer-backpack")).click(); // slow UI setup
        driver.findElement(By.id("add-to-cart-pulse-bike-light")).click();
        Assert.assertEquals(driver.findElement(CART_BADGE).getText(), "2");
        // TODO: seed via sessionStorage instead, then cookies and localStorage
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class CartStateTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By CART_BADGE = By.cssSelector(".shopping-cart-badge");
    private static final By LOGGED_IN_USER = By.id("logged-in-user");
    private static final By CART_ITEMS = By.cssSelector("[data-testid='cart-item']");
    private static final By USERNAME = By.id("user-name");

    @Test
    public void cartIsSeededThroughStorage() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        JavascriptExecutor js = (JavascriptExecutor) driver;

        // Part 1: be on the origin first, then write the state the app would have written
        driver.get(BASE + "inventory.html");
        js.executeScript(
                "sessionStorage.setItem('shopeasy.user', arguments[0]);"
                        + "sessionStorage.setItem('shopeasy.cart', JSON.stringify(arguments[1]));",
                "standard_user", List.of("trailblazer-backpack", "pulse-bike-light"));
        driver.navigate().refresh();

        Assert.assertEquals(wait.until(ExpectedConditions.visibilityOfElementLocated(CART_BADGE)).getText(), "2");
        Assert.assertEquals(driver.findElement(LOGGED_IN_USER).getText(), "standard_user");

        driver.get(BASE + "cart.html");
        Assert.assertEquals(driver.findElements(CART_ITEMS).size(), 2, "Seeded cart should show 2 rows");

        // Part 2: cookies (same API your real app's session cookie needs)
        driver.manage().addCookie(new Cookie("shopeasy_banner", "variant-b"));
        Cookie banner = driver.manage().getCookieNamed("shopeasy_banner");
        Assert.assertNotNull(banner, "Cookie was not stored");
        Assert.assertEquals(banner.getValue(), "variant-b");
        driver.manage().deleteCookieNamed("shopeasy_banner");
        Assert.assertNull(driver.manage().getCookieNamed("shopeasy_banner"), "Cookie should be deleted");

        // Part 3: localStorage drives the "Remember me" prefill
        js.executeScript("localStorage.setItem('shopeasy.rememberedUser', arguments[0]);", "locked_out_user");
        driver.get(BASE + "login.html");
        Assert.assertEquals(driver.findElement(USERNAME).getDomProperty("value"), "locked_out_user",
                "Login should pre-fill the remembered user");
    }
}
`,
  checks: [
    { label: 'Writes sessionStorage through JavascriptExecutor', pattern: 'executeScript\\s*\\([\\s\\S]*?sessionStorage\\.setItem', hint: 'js.executeScript("sessionStorage.setItem(...)", ...)' },
    { label: 'Passes values as script arguments', pattern: 'arguments\\[\\d\\]', hint: 'Use arguments[0], arguments[1] instead of building JSON strings' },
    { label: 'Reloads so the page reads the new state', pattern: '\\.navigate\\s*\\(\\s*\\)\\s*\\.refresh\\s*\\(|\\.get\\s*\\(', hint: 'driver.navigate().refresh();' },
    { label: 'Adds a cookie', pattern: '\\.addCookie\\s*\\(\\s*new\\s+Cookie\\s*\\(', hint: 'driver.manage().addCookie(new Cookie("name", "value"))' },
    { label: 'Reads a cookie back', pattern: '\\.getCookieNamed\\s*\\(', hint: 'driver.manage().getCookieNamed("shopeasy_banner")' },
    { label: 'Deletes a cookie', pattern: '\\.(deleteCookieNamed|deleteCookie|deleteAllCookies)\\s*\\(', hint: 'driver.manage().deleteCookieNamed("shopeasy_banner")' },
    { label: 'No Add-to-cart clicks for setup', pattern: 'add-to-cart-[a-z-]+"\\s*\\)\\s*\\)\\s*\\.click', mustNot: true, hint: 'Seed the cart through sessionStorage instead' },
  ],
  explanation: `**State lives in the browser, so you can put it there directly.** Login and cart are *preconditions* for a checkout test, not what it tests. Writing them into storage takes milliseconds and removes 40 chances to flake on the inventory page. Keep at least one real UI test of "add to cart" — seeding state is for everything *after* it.

**Order matters**: cookies and web storage belong to an *origin* (\`http://localhost:5180\`). On a blank \`data:,\` page there is no origin — \`addCookie\` throws \`InvalidCookieDomainException\` and \`sessionStorage\` belongs to the wrong document. So: open any page of the site, write the state, then refresh/navigate so the app reads it on load.

**Arguments, not string building**: \`executeScript(script, args...)\` converts a Java \`List\` into a JavaScript array, so \`JSON.stringify(arguments[1])\` produces exactly \`["trailblazer-backpack","pulse-bike-light"]\` — no escaped quotes to get wrong.

**Cookies**: \`driver.manage()\` offers \`addCookie\`, \`getCookieNamed\`, \`getCookies\`, \`deleteCookieNamed\`, \`deleteAllCookies\`. In a real app the trick is: log in once through the API, take the session cookie from the response, \`addCookie\` it into the browser and open the page — already logged in. \`deleteAllCookies()\` is also how you "log out" between steps without restarting the browser.

**sessionStorage vs localStorage**: session storage is per tab and gone when the tab closes; local storage survives tabs and restarts of the same profile. Selenium has no storage API on plain \`WebDriver\`, so JavaScript is the portable way.`,
  mistakes: [
    'Calling addCookie before opening any page of the site — InvalidCookieDomainException.',
    'Writing storage and asserting immediately, without a refresh — the page already read the old state on load.',
    'Building JSON by string concatenation with escaped quotes instead of passing a List argument.',
    'Replacing every UI path with storage seeding — keep one real end-to-end test of the flow you skip.',
  ],
  interview: [
    { q: 'How do you avoid logging in through the UI in every test?', a: 'Authenticate once via the API (or a fast UI login), capture the session cookie or token, then inject it with driver.manage().addCookie or into web storage with JavascriptExecutor before opening the page under test.' },
    { q: 'Why do you get InvalidCookieDomainException?', a: 'The browser is not on a page of the cookie\'s domain (often still on the blank start page). Navigate to any page of the site first, then add the cookie.' },
    { q: 'Is sessionStorage shared with a tab opened by switchTo().newWindow()?', a: 'No. Session storage is per browsing context (tab); a new tab starts with its own empty session storage. localStorage and cookies are shared across tabs of the same origin.' },
  ],
}
