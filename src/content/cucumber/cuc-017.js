export default {
  id: 'cuc-017',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'End-to-end: checkout feature, step definitions and page objects',
  level: 'EXPERT',
  tags: ['end-to-end', 'page-object', 'picocontainer', 'datatable', 'scenario-outline', 'checkout'],
  estMinutes: 60,
  scenario: `Release 2.0 of ShopEasy ships a new checkout. The test lead gives you the full story: "Automate checkout end to end — happy path
and validation errors — the way we would show it to a new joiner as our reference implementation." This is the capstone: Gherkin, glue,
dependency injection and page objects working together against the practice site.`,
  description: `Deliver all files in one editor, separated by \`// ===== path =====\` banners.

**1. \`checkout.feature\`**
- \`@checkout @regression\` Feature with a \`Background\` (logged in as \`standard_user\`, \`"Trailblazer Backpack"\` in the cart).
- \`@smoke\` happy-path \`Scenario\` that fills customer details with a **DataTable** and verifies the confirmation.
- \`Scenario Outline\` for validation errors with \`Examples\` (missing first name / last name / postal code).

**2. Page objects** — \`CheckoutPage\` with private \`By\` locators, explicit waits, intent-revealing methods; no assertions inside.

**3. \`CheckoutSteps\`** — constructor-injected \`TestContext\`, Cucumber expressions (\`{string}\`), \`List<Map<String,String>>\` or a \`@DataTableType\`,
assertions only in Then steps.

**Acceptance**
- No \`Thread.sleep\`, no \`findElement\` in step classes, no \`static WebDriver\`.`,
  starterCode: `// ===== src/test/resources/features/checkout.feature =====
Feature: Checkout

  Scenario: checkout works
    # TODO

// ===== src/test/java/com/shopeasy/pages/CheckoutPage.java =====
package com.shopeasy.pages;

public class CheckoutPage {
    // TODO: locators, waits, actions
}

// ===== src/test/java/com/shopeasy/steps/CheckoutSteps.java =====
package com.shopeasy.steps;

public class CheckoutSteps {
    // TODO: steps for the feature above
}
`,
  solution: `// ===== src/test/resources/features/checkout.feature =====
@checkout @regression
Feature: Checkout
  A logged-in shopper pays for the products in the cart.
  Customer details are mandatory before the order can be reviewed.

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper has "Trailblazer Backpack" in the cart

  @smoke
  Scenario: Shopper completes an order with valid details
    When the shopper checks out with
      | firstName | lastName | postalCode |
      | Asha      | Rao      | 560001     |
    And the shopper confirms the order
    Then the order confirmation "Thank you for your order!" is shown
    And the cart badge is not shown

  Scenario Outline: Checkout is blocked when <field> is missing
    When the shopper checks out with
      | firstName   | lastName   | postalCode   |
      | <firstName> | <lastName> | <postalCode> |
    Then the checkout error "<error>" is shown

    Examples:
      | field       | firstName | lastName | postalCode | error                          |
      | first name  |           | Rao      | 560001     | Error: First Name is required  |
      | last name   | Asha      |          | 560001     | Error: Last Name is required   |
      | postal code | Asha      | Rao      |            | Error: Postal Code is required |

// ===== src/test/java/com/shopeasy/support/TestContext.java =====
package com.shopeasy.support;

import org.openqa.selenium.WebDriver;

public class TestContext {
    private WebDriver driver;

    public WebDriver getDriver() {
        if (driver == null) {
            driver = DriverFactory.create(ConfigReader.get("browser", "chrome"));
        }
        return driver;
    }

    public void quitDriver() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }
}

// ===== src/test/java/com/shopeasy/pages/BasePage.java =====
package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    protected WebElement visible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String text) {
        WebElement field = visible(locator);
        field.clear();
        if (text != null && !text.isEmpty()) {
            field.sendKeys(text);
        }
    }
}

// ===== src/test/java/com/shopeasy/pages/CheckoutPage.java =====
package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutPage extends BasePage {

    private final By firstName = By.id("first-name");
    private final By lastName = By.id("last-name");
    private final By postalCode = By.id("postal-code");
    private final By continueButton = By.id("continue");
    private final By finishButton = By.id("finish");
    private final By errorMessage = By.id("checkout-error-message");
    private final By confirmationHeader = By.cssSelector("h2.complete-header");

    public CheckoutPage(WebDriver driver) {
        super(driver);
    }

    public CheckoutPage enterCustomerDetails(String first, String last, String postal) {
        type(firstName, first);
        type(lastName, last);
        type(postalCode, postal);
        click(continueButton);
        return this;
    }

    public void finishOrder() {
        click(finishButton);
    }

    public String getErrorMessage() {
        return visible(errorMessage).getText().trim();
    }

    public String getConfirmationText() {
        return visible(confirmationHeader).getText().trim();
    }
}

// ===== src/test/java/com/shopeasy/steps/CheckoutSteps.java =====
package com.shopeasy.steps;

import com.shopeasy.pages.CartPage;
import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

import java.util.List;
import java.util.Map;

public class CheckoutSteps {

    private final InventoryPage inventoryPage;
    private final CartPage cartPage;
    private final CheckoutPage checkoutPage;

    public CheckoutSteps(TestContext context) {
        this.inventoryPage = new InventoryPage(context.getDriver());
        this.cartPage = new CartPage(context.getDriver());
        this.checkoutPage = new CheckoutPage(context.getDriver());
    }

    @When("the shopper checks out with")
    public void theShopperChecksOutWith(List<Map<String, String>> rows) {
        Map<String, String> customer = rows.get(0);
        inventoryPage.openCart();
        cartPage.proceedToCheckout();
        checkoutPage.enterCustomerDetails(
                customer.get("firstName"),
                customer.get("lastName"),
                customer.get("postalCode"));
    }

    @When("the shopper confirms the order")
    public void theShopperConfirmsTheOrder() {
        checkoutPage.finishOrder();
    }

    @Then("the order confirmation {string} is shown")
    public void theOrderConfirmationIsShown(String expected) {
        Assert.assertEquals(checkoutPage.getConfirmationText(), expected);
    }

    @Then("the checkout error {string} is shown")
    public void theCheckoutErrorIsShown(String expected) {
        Assert.assertEquals(checkoutPage.getErrorMessage(), expected);
    }

    @Then("the cart badge is not shown")
    public void theCartBadgeIsNotShown() {
        Assert.assertFalse(inventoryPage.isCartBadgeDisplayed(), "Cart badge should be gone after ordering");
    }
}

// (LoginSteps / CartSteps implement the Background steps the same way; Hooks quits context.getDriver() in @After.)
`,
  checks: [
    { label: 'Feature has a Background', pattern: '^\\s*Background:', hint: 'Shared login + cart setup goes in Background.' },
    { label: 'Scenario Outline with Examples', pattern: '^\\s*Scenario Outline:[\\s\\S]*^\\s*Examples:', hint: 'Validation errors as a Scenario Outline + Examples.' },
    { label: 'Tagged @smoke and @regression', pattern: '(@smoke[\\s\\S]*@regression|@regression[\\s\\S]*@smoke)', hint: 'Add @regression to the Feature and @smoke to the happy path.' },
    { label: 'Page object has private By locators and explicit waits', pattern: '^(?=[\\s\\S]*private\\s+(final\\s+)?By\\s+\\w+\\s*=)(?=[\\s\\S]*WebDriverWait)', hint: 'private final By firstName = By.id("first-name"); + WebDriverWait' },
    { label: 'Steps receive TestContext by constructor', pattern: 'public\\s+CheckoutSteps\\s*\\(\\s*TestContext\\s+\\w+\\s*\\)', hint: 'public CheckoutSteps(TestContext context)' },
    { label: 'Steps use {string} and a DataTable', pattern: '^(?=[\\s\\S]*\\{string\\})(?=[\\s\\S]*(List<\\s*(Map<\\s*String\\s*,\\s*String\\s*>|\\w+)\\s*>|DataTable)\\s+\\w+\\s*\\))', hint: 'Cucumber expressions for messages, List<Map<String,String>> for the form.' },
    { label: 'No Thread.sleep / static driver / findElement in steps', pattern: 'Thread\\.sleep|static\\s+WebDriver|class\\s+CheckoutSteps[\\s\\S]*findElement', mustNot: true, hint: 'Waits live in BasePage; driver comes from TestContext.' },
  ],
  hints: [
    'Start with the feature file — it is the spec. Then let dryRun generate the step snippets.',
    'Empty cells in Examples become empty strings inside the DataTable: the page object should skip sendKeys for empty values.',
    'Put waiting and typing helpers in a BasePage so CheckoutPage reads like the business flow.',
  ],
  explanation: `This is the full layered architecture:

\`\`\`
checkout.feature  ──(text match)──▶  CheckoutSteps  ──(method calls)──▶  CheckoutPage ─▶ BasePage ─▶ WebDriver
                                         ▲ constructor injection
                                     TestContext (one per scenario, owned by PicoContainer, closed in @After)
\`\`\`

What a reviewer checks:
- **Feature**: business language, Background for shared context, Outline for data-only variations, DataTable for structured input, tags for pipelines.
- **Steps**: thin, parameterised (\`{string}\`), no locators, assertions only in Then, state via DI.
- **Pages**: private locators, explicit waits in one base class, methods named after user intent, no assertions (pages report, tests judge).
- **Placeholders inside a DataTable** work in an Outline — \`<firstName>\` cells are substituted before the table reaches Java.

From here, the remaining production concerns are config (base URL/browser from properties), parallel execution, and reporting — all covered in earlier problems.`,
  mistakes: [
    'Asserting inside the page object (Assert in CheckoutPage) — pages become untestable for negative scenarios.',
    'One giant step "When the shopper completes checkout" that hides the data — validation scenarios then need different steps.',
    'Sending null to sendKeys for empty Examples cells — IllegalArgumentException; skip empty values.',
    'Re-logging in through the UI in every step class instead of a single Background step.',
  ],
  interview: [
    { q: 'Walk me through your Cucumber framework architecture.', a: 'Feature files in resources describe behaviour; step definitions in a steps package map steps to page-object calls; page objects encapsulate locators and waits; a TestContext injected by PicoContainer holds the driver per scenario; hooks manage lifecycle and screenshots; a TestNG runner configures glue, tags, plugins and parallelism.' },
    { q: 'Why keep assertions out of page objects?', a: 'Page objects model the UI and are reused by positive and negative scenarios. If they assert, a negative test cannot reuse them. Pages return state; steps decide pass/fail.' },
    { q: 'How would you speed up the Background in a 500-scenario suite?', a: 'Keep the step text, but implement login/cart setup via API or session-cookie injection instead of UI clicks, and run scenarios in parallel with per-scenario drivers.' },
  ],
}
