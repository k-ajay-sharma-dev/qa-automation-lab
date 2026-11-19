export default {
  id: 'pom-029',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'LoginPage with three outcomes: success, bad credentials, locked out',
  level: 'INTERMEDIATE',
  tags: ['pom', 'login', 'negative-testing', 'enum', 'return-types'],
  estMinutes: 20,
  scenario: `The login suite has three tests: \`standard_user\` gets in, a wrong password shows *"Error: Username and
password do not match any user in this service"*, and \`locked_out_user\` shows *"Error: Sorry, this user has been
locked out."*. All three call the same \`loginAs()\` that returns \`InventoryPage\` — so the negative tests hold an
InventoryPage while the browser is still on the login page, and they compare long strings that marketing just
reworded once already.`,
  description: `Model the three outcomes honestly.

**Rules**
- \`loginAs(user, pass)\` → returns \`InventoryPage\` (happy path).
- \`loginExpectingError(user, pass)\` → returns \`LoginPage\` (\`this\`): the user stays on the login page.
- An \`enum LoginError { INVALID_CREDENTIALS, LOCKED_OUT }\`.
- \`getError()\` reads \`#login-error-message\` and returns the matching \`LoginError\` (\`"locked out"\` → \`LOCKED_OUT\`,
  otherwise \`INVALID_CREDENTIALS\`). Keep \`getErrorMessage()\` for the raw text too.
- \`dismissError()\` clicks the close button \`[data-testid='error-close']\` and returns \`this\`.
- Locators are private; no assertions in the page.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage extends BasePage {
    private final By username = By.id("user-name");
    private final By password = By.id("password");
    private final By loginButton = By.id("login-button");

    public LoginPage(WebDriver driver) { super(driver); }

    public InventoryPage loginAs(String user, String pass) {
        type(username, user);
        type(password, pass);
        click(loginButton);
        return new InventoryPage(driver);   // also used by the negative tests :(
    }

    // TODO: loginExpectingError, getError, getErrorMessage, dismissError
}

// TODO: enum LoginError
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage extends BasePage {
    private final By username = By.id("user-name");
    private final By password = By.id("password");
    private final By loginButton = By.id("login-button");
    private final By errorMessage = By.id("login-error-message");
    private final By errorClose = By.cssSelector("[data-testid='error-close']");

    public LoginPage(WebDriver driver) { super(driver); }

    public InventoryPage loginAs(String user, String pass) {
        submitCredentials(user, pass);
        return new InventoryPage(driver);
    }

    public LoginPage loginExpectingError(String user, String pass) {
        submitCredentials(user, pass);
        return this;
    }

    private void submitCredentials(String user, String pass) {
        type(username, user);
        type(password, pass);
        click(loginButton);
    }

    public String getErrorMessage() {
        return getText(errorMessage);
    }

    public LoginError getError() {
        String text = getErrorMessage().toLowerCase();
        return text.contains("locked out") ? LoginError.LOCKED_OUT : LoginError.INVALID_CREDENTIALS;
    }

    public LoginPage dismissError() {
        click(errorClose);
        return this;
    }
}

enum LoginError { INVALID_CREDENTIALS, LOCKED_OUT }

// Tests:
// InventoryPage inv = login.loginAs("standard_user", "secret_sauce");
// assertEquals(login.loginExpectingError("standard_user", "wrong").getError(), LoginError.INVALID_CREDENTIALS);
// assertEquals(login.loginExpectingError("locked_out_user", "secret_sauce").getError(), LoginError.LOCKED_OUT);
`,
  checks: [
    { label: 'loginAs returns InventoryPage', pattern: 'public\\s+InventoryPage\\s+loginAs\\s*\\(', hint: 'public InventoryPage loginAs(String user, String pass)' },
    { label: 'loginExpectingError returns LoginPage', pattern: 'public\\s+LoginPage\\s+loginExpectingError\\s*\\([\\s\\S]*?return\\s+this', hint: 'public LoginPage loginExpectingError(...) { ...; return this; }' },
    { label: 'LoginError enum with both outcomes', pattern: 'enum\\s+LoginError\\s*\\{[^}]*INVALID_CREDENTIALS[^}]*LOCKED_OUT|enum\\s+LoginError\\s*\\{[^}]*LOCKED_OUT[^}]*INVALID_CREDENTIALS', hint: 'enum LoginError { INVALID_CREDENTIALS, LOCKED_OUT }' },
    { label: 'getError() returns LoginError', pattern: 'public\\s+LoginError\\s+getError\\s*\\(\\s*\\)', hint: 'public LoginError getError() { ... }' },
    { label: 'Reads #login-error-message', pattern: 'login-error-message', hint: 'private final By errorMessage = By.id("login-error-message");' },
    { label: 'dismissError uses the close button', pattern: 'error-close', hint: 'By.cssSelector("[data-testid=\'error-close\']")' },
  ],
  hints: [
    'Same button, different outcomes: two public methods that share a private submitCredentials().',
    'getError() maps the text to an enum: contains("locked out") → LOCKED_OUT.',
    'The close button is <button data-testid="error-close"> inside the banner.',
  ],
  explanation: `The return type is a promise about where the user is. A negative test that holds an \`InventoryPage\`
is lying — the first call on it fails with a confusing timeout instead of a clear assertion.

- **Two methods, one private helper**: \`loginAs\` and \`loginExpectingError\` share \`submitCredentials\`, so the
  typing logic is not duplicated.
- **Enum instead of raw strings**: tests assert \`LoginError.LOCKED_OUT\`, which survives a copy change such as
  "Sorry, this user has been locked out" → "This account is locked". Only \`getError()\` needs updating.
  Keep \`getErrorMessage()\` for the one test that verifies the exact copy.
- **dismissError()** returns \`this\`: the close button hides the banner but the user stays on the page.`,
  mistakes: [
    'Returning InventoryPage from every login call, including negative ones.',
    'Returning null or Object from one generic login method.',
    'Hard-coding the full error sentence in ten tests instead of one mapping.',
    'Copy-pasting the type/type/click lines into both public methods.',
  ],
  interview: [
    { q: 'How do you model an action with several outcomes in POM?', a: 'One intention-revealing method per expected outcome, each returning the page the user lands on, sharing a private helper for the actual interaction. The test chooses the method that matches its expectation, so the types stay honest.' },
    { q: 'Why map error messages to an enum?', a: 'Tests then assert on the meaning (LOCKED_OUT) rather than the exact copy, so wording changes break one mapping method instead of many tests. A dedicated test can still check the exact text when copy is a requirement.' },
    { q: 'Where would you put the locked-out user in your test data?', a: 'In a users fixture or config (users.json or an enum of test users with username and password), never hard-coded in the page object. The page only receives values.' },
  ],
}
