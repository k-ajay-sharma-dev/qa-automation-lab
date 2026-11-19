export default {
  id: 'sel-041',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Wait for the redirect: urlContains and titleIs after login',
  level: 'INTERMEDIATE',
  tags: ['waits', 'urlContains', 'titleIs', 'login', 'navigation'],
  estMinutes: 15,
  scenario: `The login smoke test asserts \`driver.getCurrentUrl().contains("inventory.html")\` straight after clicking **Login**. On the fast laptops it passes; on the shared Jenkins agent it fails about one run in ten with \`expected true but found false\` — the screenshot shows the Products page loaded fine. The click returns before the JavaScript redirect has happened, so the URL is read too early.`,
  description: `Rewrite the post-login checks so they wait for the redirect instead of reading the URL once.

1. Open \`login.html\`, log in with \`standard_user\` / \`secret_sauce\` (\`#user-name\`, \`#password\`, \`#login-button\`).
2. Wait until the URL contains \`inventory.html\`.
3. Wait until the page title is exactly \`ShopEasy — Products\`.
4. Assert \`#logged-in-user\` shows \`standard_user\`.
5. Negative path in a second test: log in with a wrong password and assert the URL **still** contains \`login.html\` and the error banner \`#login-error\` is visible.

**Rules**
- Use \`ExpectedConditions.urlContains\` (or \`urlToBe\` / \`urlMatches\`) and \`titleIs\`; no one-shot \`getCurrentUrl()\` check right after the click.
- No \`Thread.sleep\`.`,
  hints: [
    'wait.until(ExpectedConditions.urlContains("inventory.html")) returns true once the redirect is done, or throws TimeoutException.',
    'wait.until(ExpectedConditions.titleIs("ShopEasy — Products"))',
    'For the negative test, first wait for the error banner — once it is visible, the page has finished reacting, so reading the URL is safe.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class LoginRedirectTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By ERROR_BANNER = By.id("login-error");
    private static final By LOGGED_IN_USER = By.id("logged-in-user");

    private void login(String user, String pass) {
        driver.get(BASE + "login.html");
        driver.findElement(USERNAME).sendKeys(user);
        driver.findElement(PASSWORD).sendKeys(pass);
        driver.findElement(LOGIN).click();
    }

    @Test
    public void validLoginRedirectsToProducts() {
        login("standard_user", "secret_sauce");
        // FLAKY: the redirect may not have happened yet
        Assert.assertTrue(driver.getCurrentUrl().contains("inventory.html"));
        // TODO: title and logged-in user
    }

    @Test
    public void wrongPasswordStaysOnLogin() {
        // TODO
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

public class LoginRedirectTest extends BaseTest {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By ERROR_BANNER = By.id("login-error");
    private static final By LOGGED_IN_USER = By.id("logged-in-user");

    private WebDriverWait waitFor() {
        return new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    private void login(String user, String pass) {
        driver.get(BASE + "login.html");
        driver.findElement(USERNAME).sendKeys(user);
        driver.findElement(PASSWORD).sendKeys(pass);
        driver.findElement(LOGIN).click();
    }

    @Test
    public void validLoginRedirectsToProducts() {
        login("standard_user", "secret_sauce");

        waitFor().until(ExpectedConditions.urlContains("inventory.html"));
        waitFor().until(ExpectedConditions.titleIs("ShopEasy — Products"));
        waitFor().until(ExpectedConditions.textToBe(LOGGED_IN_USER, "standard_user"));

        Assert.assertEquals(driver.findElement(LOGGED_IN_USER).getText(), "standard_user");
    }

    @Test
    public void wrongPasswordStaysOnLogin() {
        login("standard_user", "wrong_password");

        // The banner appearing proves the page has finished handling the submit
        waitFor().until(ExpectedConditions.visibilityOfElementLocated(ERROR_BANNER));
        Assert.assertTrue(driver.getCurrentUrl().contains("login.html"),
                "Should stay on login.html but was " + driver.getCurrentUrl());
    }
}
`,
  checks: [
    { label: 'Waits for the URL to change', pattern: 'ExpectedConditions\\.(urlContains|urlToBe|urlMatches)\\s*\\(', hint: 'wait.until(ExpectedConditions.urlContains("inventory.html"))' },
    { label: 'Waits for the Products title', pattern: 'ExpectedConditions\\.(titleIs|titleContains)\\s*\\(', hint: 'wait.until(ExpectedConditions.titleIs("ShopEasy — Products"))' },
    { label: 'Checks the logged-in user', pattern: 'standard_user"\\s*\\)\\s*;[\\s\\S]*LOGGED_IN_USER|LOGGED_IN_USER[\\s\\S]*"standard_user"\\s*\\)', hint: 'Assert #logged-in-user shows standard_user' },
    { label: 'Negative test waits for the error banner', pattern: 'visibilityOfElementLocated\\s*\\(\\s*ERROR_BANNER', hint: 'wait.until(ExpectedConditions.visibilityOfElementLocated(ERROR_BANNER))' },
    { label: 'Negative test asserts it stayed on login.html', pattern: 'getCurrentUrl\\s*\\(\\s*\\)[^;]*login\\.html', hint: 'Assert.assertTrue(driver.getCurrentUrl().contains("login.html"))' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the URL, not for a fixed time' },
  ],
  explanation: `\`click()\` returns as soon as the browser has dispatched the click. The login page then runs JavaScript that validates the form and sets \`window.location.href = 'inventory.html'\`; the new page loads after that. Reading \`getCurrentUrl()\` immediately races against this — exactly the one-in-ten failure on a slow agent.

\`urlContains\` polls the URL until it matches, so the test waits only as long as needed. \`titleIs\` adds a second, stronger signal that the *new* document is loaded (the URL can change before the page has rendered), and waiting for \`#logged-in-user\` ties the check to what the user actually sees.

For the negative test there is no "wait for the URL not to change". Instead wait for the **positive evidence** that the page reacted — the error banner — and then assert the URL is unchanged.`,
  mistakes: [
    'Asserting getCurrentUrl() right after click() — it races with the JavaScript redirect.',
    'Using urlToBe with a hard-coded full URL including host and port, which breaks when the suite runs against another environment; urlContains or urlMatches is more portable.',
    'Waiting only for the URL and then reading page elements; the URL can change before the new DOM is ready.',
    'Writing the negative test as "wait 3 seconds and check the URL did not change" — slow, and still a guess.',
  ],
  interview: [
    { q: 'Does click() wait for the next page to load?', a: 'Only partially. If the click triggers a classic navigation, WebDriver waits for the page-load strategy. A JavaScript redirect or SPA route change happens after click() returns, so you need an explicit wait on URL, title or an element of the new page.' },
    { q: 'How do you assert that something does NOT happen, like no redirect?', a: 'Wait for positive evidence that the app finished reacting (an error banner, a spinner disappearing), then assert the unchanged state. Avoid fixed sleeps.' },
    { q: 'urlContains vs urlMatches?', a: 'urlContains is a plain substring check. urlMatches takes a regex — useful when the URL has dynamic parts such as an order id, e.g. urlMatches("/orders/[0-9]+$").' },
  ],
}
