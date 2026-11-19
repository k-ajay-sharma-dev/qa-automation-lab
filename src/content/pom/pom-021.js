export default {
  id: 'pom-021',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'CheckoutData: a test-data record for the checkout form',
  level: 'INTERMEDIATE',
  tags: ['pom', 'test-data', 'record', 'builder', 'checkout'],
  estMinutes: 20,
  scenario: `The checkout validation pack has grown to 14 cases (*first name missing*, *last name missing*, *postal code
missing*, *postal code "12"* too short, *postal code with symbols*…). Every test repeats
\`.enterFirstName("Asha").enterLastName("Rao").enterPostalCode("560001")\` and changes one value, so reviewers cannot
see **which field** each case is about. You want "a valid customer, except the postal code is \`12\`" in one readable line.`,
  description: `Create a \`CheckoutData\` **record** and teach \`CheckoutPage\` to fill the form from it.

**Rules**
- \`public record CheckoutData(String firstName, String lastName, String postalCode)\`.
- A static factory \`valid()\` returning a known-good customer (Asha / Rao / 560001).
- "Wither" methods \`withFirstName\`, \`withLastName\`, \`withPostalCode\` that return a **new** \`CheckoutData\` with one value changed.
- \`CheckoutPage.fillWith(CheckoutData data)\` types each field, but **skips a field whose value is \`null\`**
  (so a test can model "field left empty"), and returns \`this\`.
- \`CheckoutOverviewPage.getShipTo()\` returns the text of \`#summary-ship-to\` (the overview shows "Asha Rao, 560001").`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutPage extends BasePage {
    private final By firstName  = By.id("first-name");
    private final By lastName   = By.id("last-name");
    private final By postalCode = By.id("postal-code");
    private final By continueButton = By.id("continue");

    public CheckoutPage(WebDriver driver) { super(driver); }

    public CheckoutPage fillShippingInfo(String first, String last, String zip) {
        type(firstName, first);
        type(lastName, last);
        type(postalCode, zip);
        return this;
    }

    // TODO: fillWith(CheckoutData data)
}

// TODO: record CheckoutData with valid() and with... methods

// Test today:
// checkout.fillShippingInfo("Asha", "Rao", "12").continueExpectingError();
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutPage extends BasePage {
    private final By firstName  = By.id("first-name");
    private final By lastName   = By.id("last-name");
    private final By postalCode = By.id("postal-code");
    private final By continueButton = By.id("continue");
    private final By errorBanner = By.id("checkout-error-message");

    public CheckoutPage(WebDriver driver) { super(driver); }

    public CheckoutPage fillWith(CheckoutData data) {
        typeIfPresent(firstName, data.firstName());
        typeIfPresent(lastName, data.lastName());
        typeIfPresent(postalCode, data.postalCode());
        return this;
    }

    private void typeIfPresent(By field, String value) {
        if (value != null) {
            type(field, value);
        }
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

record CheckoutData(String firstName, String lastName, String postalCode) {

    public static CheckoutData valid() {
        return new CheckoutData("Asha", "Rao", "560001");
    }

    public CheckoutData withFirstName(String value) {
        return new CheckoutData(value, lastName, postalCode);
    }

    public CheckoutData withLastName(String value) {
        return new CheckoutData(firstName, value, postalCode);
    }

    public CheckoutData withPostalCode(String value) {
        return new CheckoutData(firstName, lastName, value);
    }
}

class CheckoutOverviewPage extends BasePage {
    private final By shipTo = By.id("summary-ship-to");

    CheckoutOverviewPage(WebDriver driver) { super(driver); }

    public String getShipTo() {
        return getText(shipTo);
    }
}

// Tests now say exactly which field each case is about:
// checkout.fillWith(CheckoutData.valid().withPostalCode("12")).continueExpectingError();
//   -> "Error: Postal Code is invalid"
// checkout.fillWith(CheckoutData.valid().withLastName(null)).continueExpectingError();
//   -> "Error: Last Name is required"
// String shipTo = checkout.fillWith(CheckoutData.valid()).continueToOverview().getShipTo();
// Assert.assertEquals(shipTo, "Asha Rao, 560001");
`,
  checks: [
    { label: 'CheckoutData is a record with three fields', pattern: 'record\\s+CheckoutData\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'public record CheckoutData(String firstName, String lastName, String postalCode)' },
    { label: 'Static factory valid()', pattern: 'static\\s+CheckoutData\\s+valid\\s*\\(\\s*\\)', hint: 'public static CheckoutData valid() { return new CheckoutData("Asha", "Rao", "560001"); }' },
    { label: 'Wither returns a new copy', pattern: 'CheckoutData\\s+withPostalCode\\s*\\(\\s*String\\s+\\w+\\s*\\)\\s*\\{[\\s\\S]*?return\\s+new\\s+CheckoutData\\s*\\(', hint: 'Records are immutable: return new CheckoutData(firstName, lastName, value);' },
    { label: 'fillWith(CheckoutData) returns CheckoutPage', pattern: 'public\\s+CheckoutPage\\s+fillWith\\s*\\(\\s*CheckoutData\\s+\\w+\\s*\\)', hint: 'public CheckoutPage fillWith(CheckoutData data)' },
    { label: 'Uses the record accessors', pattern: '\\w+\\.postalCode\\s*\\(\\s*\\)', hint: 'Record accessors have no "get": data.postalCode()' },
    { label: 'Null values are skipped', pattern: '!=\\s*null|==\\s*null|Objects\\.(nonNull|isNull)|Optional\\.ofNullable', hint: 'if (value != null) type(field, value);' },
    { label: 'getShipTo() reads the overview', pattern: 'String\\s+getShipTo\\s*\\(\\s*\\)[\\s\\S]*?summary-ship-to|summary-ship-to[\\s\\S]*?String\\s+getShipTo\\s*\\(', hint: 'private final By shipTo = By.id("summary-ship-to");' },
  ],
  hints: [
    'A record gives you the constructor, accessors (data.firstName()), equals and toString for free.',
    'withPostalCode(v) is one line: return new CheckoutData(firstName, lastName, v);',
    'In fillWith, a tiny private typeIfPresent(By, String) keeps the null check in one place.',
  ],
  explanation: `When a form has more than two or three fields, pass **one data object** instead of many strings.

- **\`record\`** (Java 16+) is perfect for test data: immutable, \`equals\`/\`toString\` for free (great in failure
  messages), and accessors without \`get\`: \`data.postalCode()\`.
- **\`valid()\` + withers** is a lightweight *test data builder*: start from a known-good customer and change exactly
  the field the case is about. The test name and the data now tell the same story:
  \`valid().withPostalCode("12")\` → *Postal Code is invalid*.
- **\`null\` = "leave empty"**: skipping the field models the manual step "do not fill Last Name". (Typing \`""\` is a
  different action — it clears and types nothing — and some forms validate those differently.)
- The page stays dumb: it does not know which data is valid. Expected messages live in the test, often next to the
  data in a DataProvider row.

When a record grows past ~6 fields or needs defaults per environment, switch to a classic Builder class
(\`CheckoutData.builder().firstName("Asha")...build()\`), or load the base customer from JSON.`,
  mistakes: [
    'Adding setters to the data object, so one test changes the "valid" customer for every other test.',
    'Calling record accessors with get (data.getPostalCode()) — records generate postalCode().',
    'Using "" to mean "skip this field" and accidentally testing a different validation path.',
    'Putting the expected error message inside the data object\'s factory, mixing data with expectations.',
  ],
  interview: [
    { q: 'How do you pass test data into page objects for large forms?', a: 'With a data object (POJO or Java record) such as CheckoutData, often built from a known-good default plus small variations or loaded from JSON. The page method fillWith(data) maps fields to inputs, so adding a field does not change every call site.' },
    { q: 'What is the Test Data Builder pattern?', a: 'A builder that starts with sensible valid defaults and lets each test override only the values it cares about. It makes the intent of each test obvious and keeps tests independent of unrelated fields.' },
    { q: 'Why make test data immutable?', a: 'Shared mutable data leaks between tests, especially in parallel runs: one test changes the postal code and another fails. Immutable records with withX() copies cannot be changed behind your back.' },
  ],
}
