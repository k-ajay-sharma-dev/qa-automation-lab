export default {
  slug: 'pom-anatomy-of-a-page-object',
  category: 'pom',
  order: 2,
  title: 'Anatomy of a page class',
  minutes: 8,
  summary: 'Write a page object from scratch: a private driver field, private By locators, a constructor, small action methods and methods that read text back.',
  manualAnalogy: `A good manual test case has a "screen elements" section (what is on the page and how to recognise it) and a "steps" section (what you do with them). A page class has the same two halves: private fields that describe the elements, and public methods that perform the steps. The test calls the steps; it never needs to read the element descriptions.`,
  body: `## The skeleton

We will build a page object for the registration form at \`form.html\`. Every page class you write will have these four parts.

\`\`\`java
package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class RegistrationPage {

    private final WebDriver driver;                          // 1

    private final By firstNameInput = By.id("firstName");   // 2
    private final By lastNameInput  = By.id("lastName");
    private final By emailInput     = By.id("email");
    private final By submitButton   = By.id("submit-btn");
    private final By resultMessage  = By.id("result-message");

    public RegistrationPage(WebDriver driver) {              // 3
        this.driver = driver;
    }

    public RegistrationPage open() {                         // 4
        driver.get("http://localhost:5180/practice-site/form.html");
        return this;
    }

    public void enterFirstName(String name) {
        driver.findElement(firstNameInput).sendKeys(name);
    }

    public void submit() {
        driver.findElement(submitButton).click();
    }

    public String getResultMessage() {
        return driver.findElement(resultMessage).getText();
    }
}
\`\`\`

## Line by line

1. **The driver field.** The page needs a browser to work with, but it does not *create* one. It receives it. \`private\` means only this class can use it; \`final\` means it is set once (in the constructor) and can never be swapped by accident.
2. **Locators as \`By\` fields.** A \`By\` is just a *description* of how to find an element — creating it does not touch the browser. That is why it is safe to declare them as fields. They are \`private\` so a test cannot write \`driver.findElement(page.submitButton)\` and bypass your methods, and \`final\` because a locator never changes while the test runs.
3. **The constructor.** A constructor is the special method with the same name as the class and no return type. It runs when someone writes \`new RegistrationPage(driver)\`. Here it simply stores the driver it was given. \`this.driver\` means "the field", \`driver\` alone means "the parameter".
4. **Methods.** Each public method is one thing a user can do or see. \`open()\` returns \`this\` (the same page object) so the caller can chain: \`new RegistrationPage(driver).open().enterFirstName("Asha")\`.

## Small methods, then convenience methods

Write one method per field or button first. Then add a **convenience method** that combines them for the common path:

\`\`\`java
public void register(String first, String last, String email) {
    enterFirstName(first);
    driver.findElement(lastNameInput).sendKeys(last);
    driver.findElement(emailInput).sendKeys(email);
    submit();
}
\`\`\`

Why keep both? Positive tests want the one-liner \`register(...)\`. Negative tests want to fill *some* fields and leave others empty, so they need the small methods.

## Methods that read, not judge

\`getResultMessage()\` returns a \`String\`. It does **not** decide whether that text is right. The test does:

\`\`\`java
page.register("Asha", "Rao", "asha@example.com");
Assert.assertTrue(page.getResultMessage().contains("submitted"), "No success banner");
\`\`\`

Use clear, honest names: \`getXxx()\` / \`isXxx()\` for reading, a verb (\`submit\`, \`enter\`, \`select\`) for acting.

## What must never appear in a page class

| Do not put | Why | Put it in |
|---|---|---|
| \`new ChromeDriver()\` | The page would own the browser lifecycle | DriverManager / BaseTest |
| \`Assert.assertEquals(...)\` | The page could not be used for negative tests | The test |
| \`Thread.sleep(2000)\` | Slow and still flaky | An explicit wait (see *BasePage and components*) |
| Test data like \`"standard_user"\` | Data belongs to the test or a data file | Test / DataProvider |

## Naming and package

- Class name = screen name + \`Page\`: \`LoginPage\`, \`CartPage\`, \`CheckoutPage\`.
- Package \`com.shopeasy.pages\` (under \`src/test/java\`).
- Locator field names describe the element's role, not its id: \`submitButton\`, not \`submitBtnId\`.`,
  keyPoints: [
    'A page class = private final driver + private final By locators + constructor + public methods.',
    'The page receives the WebDriver through its constructor; it never creates one.',
    'A `By` is only a description; `findElement` is what actually touches the browser.',
    'Offer small single-field methods plus a convenience method for the happy path.',
    'Reading methods return values (String, int, boolean); the test decides pass/fail.',
  ],
  mistakes: [
    'Storing a `WebElement` field found in the constructor — it goes stale after the page re-renders. Store `By` and find on use.',
    'Forgetting `this.driver = driver;` in the constructor — the field stays null and every method throws NullPointerException.',
    'Returning `void` from a getter-style method and printing the text instead — return it so the test can assert.',
    'Hard-coding a user name inside the page — pass it in as a parameter.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/login.html, right-click the error banner area after a failed login and Inspect it. Write down the id you would use for an \`errorMessage\` locator and the name of the method that would return its text. Then do the same for the "Demo credentials" box.`,
  problems: ['pom-002', 'pom-001', 'pom-008'],
}
