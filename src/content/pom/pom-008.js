export default {
  id: 'pom-008',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'CheckoutPage: form methods that read like a test case',
  level: 'BEGINNER',
  tags: ['pom', 'forms', 'checkout', 'fluent'],
  estMinutes: 15,
  scenario: `You are automating the manual test case *TC-CHK-004 "Checkout requires postal code"* and the happy path
*TC-CHK-001*. ShopEasy's \`checkout.html\` has First name, Last name, Postal code, a *Continue* button and an error
banner. The manual steps are exactly what the page object API should look like.`,
  description: `Complete \`CheckoutPage\` (extends \`BasePage\`, which gives you \`type\`, \`click\`, \`getText\`).

**Rules**
- Private locators: \`#first-name\`, \`#last-name\`, \`#postal-code\`, \`#continue\`, \`#checkout-error-message\`.
- Fluent field setters \`enterFirstName\`, \`enterLastName\`, \`enterPostalCode\` each returning \`CheckoutPage\`.
- \`fillShippingInfo(first, last, zip)\` composes the three setters.
- \`continueToOverview()\` clicks Continue and returns \`CheckoutOverviewPage\`; \`continueExpectingError()\` returns \`this\`.
- \`getErrorMessage()\` returns the banner text.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutPage extends BasePage {

    // TODO: locators

    public CheckoutPage(WebDriver driver) {
        super(driver);
    }

    // TODO: enterFirstName / enterLastName / enterPostalCode

    // TODO: fillShippingInfo

    // TODO: continueToOverview / continueExpectingError / getErrorMessage
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutPage extends BasePage {

    private final By firstName      = By.id("first-name");
    private final By lastName       = By.id("last-name");
    private final By postalCode     = By.id("postal-code");
    private final By continueButton = By.id("continue");
    private final By errorBanner    = By.id("checkout-error-message");

    public CheckoutPage(WebDriver driver) {
        super(driver);
    }

    public CheckoutPage enterFirstName(String value) {
        type(firstName, value);
        return this;
    }

    public CheckoutPage enterLastName(String value) {
        type(lastName, value);
        return this;
    }

    public CheckoutPage enterPostalCode(String value) {
        type(postalCode, value);
        return this;
    }

    public CheckoutPage fillShippingInfo(String first, String last, String zip) {
        return enterFirstName(first)
                .enterLastName(last)
                .enterPostalCode(zip);
    }

    public CheckoutOverviewPage continueToOverview() {
        click(continueButton);
        return new CheckoutOverviewPage(driver);
    }

    public CheckoutPage continueExpectingError() {
        click(continueButton);
        return this;
    }

    public String getErrorMessage() {
        return getText(errorBanner);
    }
}

// TC-CHK-004 in the test class:
// String error = cart.checkout()
//         .enterFirstName("Asha").enterLastName("Rao")
//         .continueExpectingError()
//         .getErrorMessage();
// Assert.assertEquals(error, "Error: Postal Code is required");
`,
  checks: [
    { label: 'Private By locators for the form', pattern: 'private\\s+(final\\s+)?By\\s+\\w+\\s*=\\s*By\\.(id|cssSelector)\\s*\\(\\s*"#?postal-code"', hint: 'private final By postalCode = By.id("postal-code");' },
    { label: 'Fluent setters return CheckoutPage', pattern: 'public\\s+CheckoutPage\\s+enterPostalCode\\s*\\(\\s*String\\s+\\w+\\s*\\)[\\s\\S]*?return\\s+this', hint: 'enterPostalCode(...) { type(...); return this; }' },
    { label: 'fillShippingInfo composes the setters', pattern: 'fillShippingInfo\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?enterFirstName[\\s\\S]*?enterPostalCode', hint: 'Reuse the three setters instead of repeating type() calls' },
    { label: 'continueToOverview returns the next page', pattern: 'CheckoutOverviewPage\\s+continueToOverview\\s*\\([\\s\\S]*?return\\s+new\\s+CheckoutOverviewPage', hint: 'return new CheckoutOverviewPage(driver);' },
    { label: 'Negative path returns this', pattern: 'CheckoutPage\\s+continueExpectingError\\s*\\([\\s\\S]*?return\\s+this', hint: 'continueExpectingError stays on the same page' },
    { label: 'getErrorMessage returns text', pattern: 'String\\s+getErrorMessage\\s*\\([\\s\\S]*?return\\s+getText', hint: 'return getText(errorBanner);' },
  ],
  hints: [
    'Each setter is two lines: type(locator, value); return this;',
    'fillShippingInfo can chain: return enterFirstName(f).enterLastName(l).enterPostalCode(z);',
    'Two continue methods: one for success, one for validation errors.',
  ],
  explanation: `Notice how the test for TC-CHK-004 is almost word-for-word the manual test case. That is the goal:
**page object methods = test steps**, so your manual test design skills translate directly.

- Small setters let negative tests leave any field empty (just do not call that setter).
- \`fillShippingInfo\` keeps happy-path tests short.
- Separate success/error continue methods keep the return types honest.

Later (fw-004 / fw-007) you will feed these methods from a DataProvider or JSON test data to cover every validation rule.`,
  mistakes: [
    'One method fillForm(String... values) with positional arguments nobody can read.',
    'Passing empty string to "skip" a field: it still clears and types, which can trigger different validation.',
    'Asserting the error text inside the page.',
  ],
  interview: [
    { q: 'How do you design page methods for a form with many fields?', a: 'Fine-grained fluent setters for flexibility in negative tests, plus one or two composite methods (or a builder/data object like ShippingInfo) for the happy path. Submit methods return the page you expect to land on.' },
    { q: 'How would you avoid a method with 12 parameters?', a: 'Pass a data object (e.g. a Customer or ShippingInfo POJO, often loaded from JSON) to fillForm(customer). It is readable and new fields do not break every call site.' },
  ],
}
