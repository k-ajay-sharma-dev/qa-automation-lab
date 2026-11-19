export default {
  id: 'fw-004',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Data-driven login with @DataProvider',
  level: 'INTERMEDIATE',
  tags: ['testng', 'dataprovider', 'data-driven', 'negative-testing'],
  estMinutes: 20,
  scenario: `Your manual login test suite has a decision table with 6 rows: valid user, locked-out user, wrong password,
empty username, empty password, username with trailing space. Someone automated it as six almost identical
\`@Test\` methods — 120 lines, and a new rule ("usernames are case-sensitive: Standard_User is rejected") means a seventh copy.`,
  description: `Replace the six copies with **one** data-driven test.

**Rules**
- A \`@DataProvider(name = "loginData")\` returning \`Object[][]\` with columns: username, password, expected error (\`null\` or empty when login should succeed).
- One \`@Test(dataProvider = "loginData")\` method with matching parameters.
- Branch on the expected outcome: success → inventory page loaded; failure → error message equals expected.
- Give the provider at least 5 rows taken from the decision table.`,
  starterCode: `package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

public class LoginTest extends BaseTest {

    @Test
    public void validLogin() {
        InventoryPage inv = new LoginPage(driver()).open().loginAs("standard_user", "secret_sauce");
        Assert.assertTrue(inv.isLoaded());
    }

    @Test
    public void lockedOutUser() {
        String err = new LoginPage(driver()).open()
                .loginExpectingError("locked_out_user", "secret_sauce").getErrorMessage();
        Assert.assertEquals(err, "Error: Sorry, this user has been locked out.");
    }

    @Test
    public void wrongPassword() {
        String err = new LoginPage(driver()).open()
                .loginExpectingError("standard_user", "nope").getErrorMessage();
        Assert.assertEquals(err, "Error: Username and password do not match any user in this service");
    }
    // ... 3 more copies
}
`,
  solution: `package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

public class LoginTest extends BaseTest {

    @DataProvider(name = "loginData")
    public Object[][] loginData() {
        return new Object[][] {
            // username,          password,        expected error (null = success)
            { "standard_user",    "secret_sauce",  null },
            { "standard_user ",   "secret_sauce",  null },
            { "locked_out_user",  "secret_sauce",  "Error: Sorry, this user has been locked out." },
            { "standard_user",    "wrong_pass",    "Error: Username and password do not match any user in this service" },
            { "",                 "secret_sauce",  "Error: Username is required" },
            { "standard_user",    "",              "Error: Password is required" },
        };
    }

    @Test(dataProvider = "loginData", groups = {"regression"})
    public void login(String username, String password, String expectedError) {
        LoginPage loginPage = new LoginPage(driver()).open();

        if (expectedError == null) {
            InventoryPage inventory = loginPage.loginAs(username, password);
            Assert.assertTrue(inventory.isLoaded(), "Expected successful login for " + username);
        } else {
            String actual = loginPage.loginExpectingError(username, password).getErrorMessage();
            Assert.assertEquals(actual, expectedError, "Error for user '" + username + "'");
        }
    }
}
`,
  checks: [
    { label: '@DataProvider with a name', pattern: '@DataProvider\\s*\\(\\s*name\\s*=\\s*"\\w+"', hint: '@DataProvider(name = "loginData")' },
    { label: 'Provider returns Object[][]', pattern: 'Object\\s*\\[\\s*\\]\\s*\\[\\s*\\]\\s+\\w+\\s*\\(', hint: 'public Object[][] loginData()' },
    { label: 'Test uses the provider', pattern: '@Test\\s*\\([^)]*dataProvider\\s*=\\s*"\\w+"', hint: '@Test(dataProvider = "loginData")' },
    { label: 'Test method takes the row parameters', pattern: 'void\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'login(String username, String password, String expectedError)' },
    { label: 'At least 5 data rows', pattern: '(\\{\\s*"[^"]*"\\s*,[^}]*\\}[\\s,]*){5,}', hint: 'Cover the decision table: valid, locked, wrong password, empty user, empty password' },
    { label: 'Only one @Test method left', pattern: '@Test[\\s\\S]*@Test', mustNot: true, hint: 'Delete the copy-pasted test methods' },
  ],
  hints: [
    'Each inner array is one row of your decision table.',
    'The @Test method parameters must match the column types and order.',
    'Use null as "no error expected" and branch with if/else.',
  ],
  explanation: `\`@DataProvider\` is TestNG's built-in data-driven mechanism: each row becomes a separate test invocation
in the report (\`login(standard_user, secret_sauce, null)\`), so a failing row is easy to spot.

Design notes:
- **Your test design is the value** here: the rows are your equivalence classes / decision-table rules. Adding
  the case-sensitivity rule (\`"Standard_User"\`) is now a one-line change.
- Keep the branching shallow. If success and failure paths diverge a lot, use **two providers and two tests**
  (\`validLogins\`, \`invalidLogins\`) — many reviewers prefer that over if/else in tests.
- \`@DataProvider(parallel = true)\` runs rows in parallel (needs the ThreadLocal driver from pom-011).
- For larger data sets load rows from JSON/Excel (fw-007) and return them from the provider.`,
  mistakes: [
    'Parameter count/type mismatch between the Object[][] row and the test method (TestNG throws a parameter error).',
    'Putting complex logic in the test to handle every row; split positive and negative providers instead.',
    'Hard-coding real production credentials in the provider.',
  ],
  interview: [
    { q: 'How do you do data-driven testing in TestNG?', a: 'Use @DataProvider returning Object[][] (or Iterator<Object[]>) and link it with @Test(dataProvider = "name"). Each row runs as a separate invocation. Data can be inline or loaded from JSON, CSV or Excel inside the provider.' },
    { q: 'DataProvider vs @Parameters?', a: '@Parameters injects single values from testng.xml (e.g. browser, env) once per test. @DataProvider supplies many rows of data and runs the test once per row.' },
  ],
}
