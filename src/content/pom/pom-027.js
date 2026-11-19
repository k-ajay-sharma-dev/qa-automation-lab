export default {
  id: 'pom-027',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'RegistrationPage: fill the seller form from a RegistrationData object',
  level: 'BEGINNER',
  tags: ['pom', 'forms', 'test-data', 'record', 'registration'],
  estMinutes: 20,
  scenario: `ShopEasy launched a **seller registration** form (\`form.html\`). Your first automated test types First name,
Last name and Email, picks a Country and ticks the terms — 9 raw \`driver.findElement\` lines inside the test. The
product owner already lists six more registration cases for next sprint, and nobody wants to copy those 9 lines six times.`,
  description: `Write a \`RegistrationPage\` page object and a \`RegistrationData\` record so a test fills the whole form in
one line.

**Rules**
- \`public record RegistrationData(String firstName, String lastName, String email, String country)\`
  with a static \`valid()\` factory (Asha / Rao / asha.rao@example.com / \`IN\`).
- \`RegistrationPage extends BasePage\` with **private** \`By\` fields: \`firstName\`, \`lastName\`, \`email\`,
  \`country\`, \`terms\`, \`submit-btn\`, and the success message \`#result-message\`.
- \`fillWith(RegistrationData data)\` types the three text fields, selects the country **by value** with
  Selenium's \`Select\` class, and returns \`this\`.
- \`acceptTerms()\` ticks \`#terms\` only if it is not already selected; returns \`this\`.
- \`submit()\` clicks Register; \`getSuccessMessage()\` returns the banner text. No assertions in the page.`,
  starterCode: `package com.shopeasy.pages;

import org.testng.annotations.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class RegistrationTest extends BaseTest {

    @Test
    public void sellerCanRegister() {
        driver.get(BASE_URL + "/form.html");
        driver.findElement(By.id("firstName")).sendKeys("Asha");
        driver.findElement(By.id("lastName")).sendKeys("Rao");
        driver.findElement(By.id("email")).sendKeys("asha.rao@example.com");
        driver.findElement(By.id("country")).sendKeys("India");
        driver.findElement(By.id("terms")).click();
        driver.findElement(By.id("submit-btn")).click();
        // assert the banner...
    }
}

// TODO: record RegistrationData + class RegistrationPage extends BasePage
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

public class RegistrationPage extends BasePage {
    private final By firstName = By.id("firstName");
    private final By lastName  = By.id("lastName");
    private final By email     = By.id("email");
    private final By country   = By.id("country");
    private final By terms     = By.id("terms");
    private final By registerButton = By.id("submit-btn");
    private final By successMessage = By.id("result-message");

    public RegistrationPage(WebDriver driver) { super(driver); }

    public RegistrationPage fillWith(RegistrationData data) {
        type(firstName, data.firstName());
        type(lastName, data.lastName());
        type(email, data.email());
        new Select(waitVisible(country)).selectByValue(data.country());
        return this;
    }

    public RegistrationPage acceptTerms() {
        WebElement box = waitVisible(terms);
        if (!box.isSelected()) {
            box.click();
        }
        return this;
    }

    public RegistrationPage submit() {
        click(registerButton);
        return this;
    }

    public String getSuccessMessage() {
        return getText(successMessage);
    }
}

record RegistrationData(String firstName, String lastName, String email, String country) {
    public static RegistrationData valid() {
        return new RegistrationData("Asha", "Rao", "asha.rao@example.com", "IN");
    }
}

// The test now reads like the manual test case:
// String msg = new RegistrationPage(driver)
//         .fillWith(RegistrationData.valid())
//         .acceptTerms()
//         .submit()
//         .getSuccessMessage();
// Assert.assertEquals(msg, "Thanks! Your seller application was submitted.");
`,
  checks: [
    { label: 'RegistrationData is a record', pattern: 'record\\s+RegistrationData\\s*\\(', hint: 'record RegistrationData(String firstName, String lastName, String email, String country)' },
    { label: 'Static valid() factory', pattern: 'static\\s+RegistrationData\\s+valid\\s*\\(\\s*\\)', hint: 'public static RegistrationData valid() { return new RegistrationData(...); }' },
    { label: 'Locators are private By fields', pattern: 'private\\s+(final\\s+)?By\\s+\\w+\\s*=\\s*By\\.id\\(\\s*"firstName"', hint: 'private final By firstName = By.id("firstName");' },
    { label: 'fillWith(RegistrationData) returns RegistrationPage', pattern: 'public\\s+RegistrationPage\\s+fillWith\\s*\\(\\s*RegistrationData\\s+\\w+\\s*\\)', hint: 'public RegistrationPage fillWith(RegistrationData data)' },
    { label: 'Country picked with Select', pattern: 'new\\s+Select\\s*\\([\\s\\S]*?\\)\\s*\\.\\s*selectBy(Value|VisibleText)', hint: 'new Select(waitVisible(country)).selectByValue(data.country());' },
    { label: 'Terms ticked only when not selected', pattern: 'isSelected\\s*\\(\\s*\\)', hint: 'if (!box.isSelected()) box.click();' },
    { label: 'No raw driver.findElement in the page', pattern: 'driver\\.findElement', mustNot: true, hint: 'Use the BasePage helpers (type, click, waitVisible).' },
  ],
  hints: [
    'Start with the record: four Strings and one static valid() method.',
    'A <select> is not typed into: new Select(element).selectByValue("IN").',
    'Check box.isSelected() before clicking, otherwise a pre-ticked box gets un-ticked.',
  ],
  explanation: `The page object hides **how** the form is filled; the record says **what** is filled.

- \`private By\` fields keep \`firstName\`, \`email\`, \`submit-btn\`… in exactly one place. When the dev renames an id,
  you fix one line, not six tests.
- \`Select.selectByValue("IN")\` is the reliable way to drive a \`<select>\`. \`sendKeys("India")\` happens to work in
  some browsers but depends on keyboard type-ahead.
- \`acceptTerms()\` is **idempotent**: calling it twice still leaves the box ticked. A plain \`click()\` toggles, so
  a reset or a pre-filled form would silently un-tick it.
- Methods return \`this\` because the user stays on \`form.html\` (the result panel appears on the same page), which
  gives the fluent chain in the test. The assertion on the banner text stays in the test.`,
  mistakes: [
    'Using sendKeys on a <select> instead of the Select class.',
    'Clicking a checkbox blindly, which toggles it off if it was already ticked.',
    'Passing four separate Strings so every call site breaks when a field is added.',
    'Asserting the success message inside submit() instead of returning it to the test.',
  ],
  interview: [
    { q: 'How do you handle dropdowns in a page object?', a: 'Wrap the <select> in Selenium\'s Select class and expose a business method such as selectCountry(code) or include it in fillWith(data). Prefer selectByValue for stable codes and selectByVisibleText when the label is what the requirement talks about.' },
    { q: 'Why pass a data object instead of separate parameters?', a: 'It keeps the method signature stable as the form grows, makes the test data reusable across tests and DataProviders, and gives a readable toString in failure reports.' },
  ],
}
