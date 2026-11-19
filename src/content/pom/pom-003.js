export default {
  id: 'pom-003',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Fluent navigation: login() returns InventoryPage',
  level: 'BEGINNER',
  tags: ['pom', 'fluent', 'navigation'],
  estMinutes: 15,
  scenario: `Your LoginPage works, but tests now look like this:
\`loginPage.login(...); InventoryPage inventory = new InventoryPage(driver);\` — every test has to *know* that a
successful login lands on the inventory page. When product adds a "What's new" interstitial, that knowledge breaks
in 25 places. Your lead suggests the page objects should model navigation themselves.`,
  description: `Change \`LoginPage\` so navigation is part of the API, and complete \`InventoryPage\`.

**Rules**
- \`loginAs(String user, String pass)\` performs a successful login and **returns a new \`InventoryPage\`**.
- \`loginExpectingError(String user, String pass)\` returns \`this\` (still on the login page) for negative tests.
- \`InventoryPage\` has a constructor taking \`WebDriver\`, a private \`By\` for the product names (\`.inventory-item .item-name\`)
  and \`getProductNames()\` returning \`List<String>\`.
- The test at the bottom should chain: \`new LoginPage(driver).open().loginAs(...).getProductNames()\`.`,
  starterCode: `package com.shopeasy.pages;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage {
    private final WebDriver driver;
    private final By usernameInput = By.id("user-name");
    private final By passwordInput = By.id("password");
    private final By loginButton = By.id("login-button");

    public LoginPage(WebDriver driver) { this.driver = driver; }

    public LoginPage open() {
        driver.get("http://localhost:5180/practice-site/login.html");
        return this;
    }

    public void login(String user, String pass) {
        driver.findElement(usernameInput).sendKeys(user);
        driver.findElement(passwordInput).sendKeys(pass);
        driver.findElement(loginButton).click();
        // TODO: return the next page instead of void
    }
}

class InventoryPage {
    // TODO: driver, locator, constructor, getProductNames()
}

// In the test:
// LoginPage loginPage = new LoginPage(driver);
// loginPage.open();
// loginPage.login("standard_user", "secret_sauce");
// InventoryPage inventory = new InventoryPage(driver);   // test knows navigation :(
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class LoginPage {
    private final WebDriver driver;
    private final By usernameInput = By.id("user-name");
    private final By passwordInput = By.id("password");
    private final By loginButton = By.id("login-button");

    public LoginPage(WebDriver driver) { this.driver = driver; }

    public LoginPage open() {
        driver.get("http://localhost:5180/practice-site/login.html");
        return this;
    }

    private void submit(String user, String pass) {
        driver.findElement(usernameInput).sendKeys(user);
        driver.findElement(passwordInput).sendKeys(pass);
        driver.findElement(loginButton).click();
    }

    public InventoryPage loginAs(String user, String pass) {
        submit(user, pass);
        return new InventoryPage(driver);
    }

    public LoginPage loginExpectingError(String user, String pass) {
        submit(user, pass);
        return this;
    }
}

class InventoryPage {
    private final WebDriver driver;
    private final By productNames = By.cssSelector(".inventory-item .item-name");

    InventoryPage(WebDriver driver) { this.driver = driver; }

    public List<String> getProductNames() {
        return driver.findElements(productNames).stream()
                .map(WebElement::getText)
                .collect(Collectors.toList());
    }
}

// In the test:
// List<String> names = new LoginPage(driver).open()
//         .loginAs("standard_user", "secret_sauce")
//         .getProductNames();
// Assert.assertTrue(names.contains("Trailblazer Backpack"));
`,
  checks: [
    { label: 'loginAs returns InventoryPage', pattern: 'public\\s+InventoryPage\\s+loginAs\\s*\\(', hint: 'public InventoryPage loginAs(String user, String pass)' },
    { label: 'Creates and returns the next page', pattern: 'return\\s+new\\s+InventoryPage\\s*\\(\\s*driver\\s*\\)', hint: 'return new InventoryPage(driver);' },
    { label: 'Negative path stays on LoginPage', pattern: 'public\\s+LoginPage\\s+loginExpectingError\\s*\\([\\s\\S]*?return\\s+this\\s*;', hint: 'loginExpectingError should return this' },
    { label: 'InventoryPage constructor takes WebDriver', pattern: 'InventoryPage\\s*\\(\\s*WebDriver\\s+\\w+\\s*\\)\\s*\\{', hint: 'InventoryPage(WebDriver driver) { this.driver = driver; }' },
    { label: 'getProductNames returns List<String>', pattern: 'List<String>\\s+getProductNames\\s*\\(\\s*\\)[\\s\\S]*?findElements', hint: 'Use driver.findElements(...) and map getText' },
  ],
  hints: [
    'Change the return type of the method from void to InventoryPage.',
    'Extract the typing/clicking into a private submit() so both login methods reuse it.',
    'findElements(...).stream().map(WebElement::getText).collect(Collectors.toList())',
  ],
  explanation: `Returning the next page object turns your page classes into a **map of the application**. The test reads like
a user journey and the compiler stops you from calling inventory methods while you are still on the login page.

Two methods for the same form is intentional: the outcome of clicking *Login* depends on the data.
\`loginAs\` models the happy path (lands on inventory), \`loginExpectingError\` models the negative path (stays on
login, so you can call \`getErrorMessage()\`). If product adds an interstitial, only \`loginAs\` changes.

Note \`findElements\` (plural) returns an empty list instead of throwing, which is exactly what you want for collections.`,
  mistakes: [
    'Returning a new page from a method that may not navigate (e.g. returning InventoryPage even when login fails).',
    'Every method returning a new instance of the same page instead of this.',
    'Tests constructing page objects themselves everywhere, duplicating navigation knowledge.',
  ],
  interview: [
    { q: 'What is a fluent page object?', a: 'Methods return a page object (this, or the next page) so calls can be chained and navigation is encoded in types. It makes tests readable and lets the compiler catch calls on the wrong page.' },
    { q: 'How do you model an action that can lead to two different pages?', a: 'Provide two intention-revealing methods, e.g. loginAs() returning InventoryPage and loginExpectingError() returning LoginPage. The test chooses based on the data it uses.' },
  ],
}
