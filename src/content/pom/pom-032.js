export default {
  id: 'pom-032',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Validation in one call: read every field error as a Map',
  level: 'ADVANCED',
  tags: ['pom', 'forms', 'validation', 'collections', 'data-driven'],
  estMinutes: 25,
  scenario: `The seller registration form (\`form.html\`) validates five fields: First name, Last name, Email, Country and
the terms checkbox. Each message appears in a span with id \`<field>-error\` (e.g. \`email-error\`). The current page
object has five getters, and a data-driven test for 8 invalid combinations calls them all — 40 lines of assertions
that still miss *unexpected* extra errors.`,
  description: `Add one method to \`RegistrationPage\` that returns **all visible field errors** as a map.

**Rules**
- \`submitExpectingErrors()\` clicks \`#submit-btn\` and returns \`this\` (the form stays).
- \`Map<String, String> getFieldErrors()\` finds every \`.field-error\` span with \`driver.findElements\`, keeps only those
  with non-empty text, and maps the field name (the id **without** the \`-error\` suffix) to the text.
- Use a \`LinkedHashMap\` (or \`Collectors.toMap\` with one) so the order matches the page.
- No assertions in the page. In the test, one \`assertEquals(expectedMap, page.getFieldErrors())\` replaces five getters.

Real messages: *First name is required*, *Last name is required*, *Email is required*, *Enter a valid email address*,
*Please select a country*, *You must accept the terms*.`,
  starterCode: `package com.shopeasy.pages;

import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class RegistrationPage extends BasePage {
    private final By registerButton = By.id("submit-btn");
    private final By emailError = By.id("email-error");
    private final By countryError = By.id("country-error");
    // ... three more error getters

    public RegistrationPage(WebDriver driver) { super(driver); }

    public String getEmailError()   { return driver.findElement(emailError).getText(); }
    public String getCountryError() { return driver.findElement(countryError).getText(); }

    // TODO: submitExpectingErrors() and Map<String, String> getFieldErrors()
}
`,
  solution: `package com.shopeasy.pages;

import java.util.LinkedHashMap;
import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class RegistrationPage extends BasePage {
    private static final String ERROR_SUFFIX = "-error";
    private final By registerButton = By.id("submit-btn");
    private final By fieldErrors = By.cssSelector("#registration-form .field-error");

    public RegistrationPage(WebDriver driver) { super(driver); }

    public RegistrationPage submitExpectingErrors() {
        click(registerButton);
        return this;
    }

    public Map<String, String> getFieldErrors() {
        Map<String, String> errors = new LinkedHashMap<>();
        for (WebElement span : driver.findElements(fieldErrors)) {
            String text = span.getText().trim();
            if (!text.isEmpty()) {
                String id = span.getAttribute("id");
                errors.put(id.substring(0, id.length() - ERROR_SUFFIX.length()), text);
            }
        }
        return errors;
    }
}

// Data-driven test, one assertion per row:
// RegistrationData data = new RegistrationData("Asha", "Rao", "asha@", "");   // bad email, no country
// Map<String, String> errors = page.fillWith(data).submitExpectingErrors().getFieldErrors();
// assertEquals(errors, Map.of(
//         "email", "Enter a valid email address",
//         "country", "Please select a country",
//         "terms", "You must accept the terms"));
`,
  checks: [
    { label: 'getFieldErrors() returns Map<String, String>', pattern: 'Map\\s*<\\s*String\\s*,\\s*String\\s*>\\s+getFieldErrors\\s*\\(\\s*\\)', hint: 'public Map<String, String> getFieldErrors()' },
    { label: 'Finds all error spans with findElements', pattern: 'findElements\\s*\\(', hint: 'driver.findElements(By.cssSelector(".field-error"))' },
    { label: 'Uses the .field-error class', pattern: 'field-error', hint: 'By.cssSelector("#registration-form .field-error")' },
    { label: 'Skips empty messages', pattern: 'isEmpty\\s*\\(\\s*\\)|isBlank\\s*\\(\\s*\\)', hint: 'if (!text.isEmpty()) errors.put(...)' },
    { label: 'Strips the -error suffix from the id', pattern: 'getAttribute\\s*\\(\\s*"id"\\s*\\)|getDomAttribute\\s*\\(\\s*"id"\\s*\\)', hint: 'String id = span.getAttribute("id"); id.replace("-error", "")' },
    { label: 'Keeps page order with LinkedHashMap', pattern: 'LinkedHashMap', hint: 'new LinkedHashMap<>() keeps insertion order' },
    { label: 'submitExpectingErrors returns this', pattern: 'RegistrationPage\\s+submitExpectingErrors\\s*\\(\\s*\\)[\\s\\S]*?return\\s+this', hint: 'public RegistrationPage submitExpectingErrors() { click(registerButton); return this; }' },
  ],
  hints: [
    'All error spans share class="field-error" and an id like email-error.',
    'Loop over findElements, skip blank text, put(idWithoutSuffix, text).',
    'Compare the whole map in the test: assertEquals(expected, actual) shows every difference at once.',
  ],
  explanation: `Reading **all** errors as data is stronger than five getters:

- One method scales to any number of fields — a new \`phone-error\` span is picked up with zero code changes.
- Asserting the whole map catches **unexpected** errors too. Five separate getters only check the fields you
  remembered to ask about; a regression that adds a bogus "Last name is required" would slip through.
- \`findElements\` (plural) never throws; spans with empty text are skipped, so the map contains only what the user
  sees. Because validation is synchronous here, the click helper is enough; for async validation, wait for at least
  one non-empty error first.
- \`LinkedHashMap\` keeps page order, which makes failure messages read top-to-bottom like the form.

This is the classic data-driven negative pack: each DataProvider row = input data + expected error map.`,
  mistakes: [
    'Writing one getter per error and forgetting to check the fields that should have no error.',
    'Using findElement (singular) in a loop, which throws when a field has no span.',
    'Keeping empty spans in the map, so the expected map must list "" for valid fields.',
    'Using HashMap and getting a random order in failure messages.',
  ],
  interview: [
    { q: 'How do you test form validation efficiently with page objects?', a: 'Expose the validation state as data, such as a map from field to message, and drive the form with data objects from a DataProvider. Each row has input and the full expected error map, so one assertion verifies both expected and unexpected messages.' },
    { q: 'findElement vs findElements: when do you use each?', a: 'findElement returns one element or throws NoSuchElementException; use it when the element must exist. findElements returns a possibly empty list and never throws; use it for collections and for checking absence.' },
  ],
}
