export default {
  id: 'api-016',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Data-driven API tests: the order validation matrix with a DataProvider',
  level: 'ADVANCED',
  tags: ['dataprovider', 'data-driven', 'testng', 'negative-testing'],
  estMinutes: 35,
  scenario: `The BA attached a validation matrix to the checkout story: blank first name, blank last name, blank postal code,
postal code with symbols, and a valid row — each with the expected status and the field that must be reported. A
teammate implemented it as five copy-pasted test methods; when the error format changed she had to fix all five,
and missed one. The lead asks for one test method fed by a TestNG DataProvider, so the matrix reads like the BA's table.`,
  description: `Write \`OrderValidationMatrixTest\` (token prepared in \`@BeforeClass\`):

- A \`@DataProvider(name = "orderValidation")\` returning \`Object[][]\` rows:
  \`{ caseName, firstName, lastName, postalCode, expectedStatus, expectedField }\`

  | case | firstName | lastName | postalCode | status | field |
  |---|---|---|---|---|---|
  | blank first name | "" | Rao | 560001 | 400 | firstName |
  | blank last name | Asha | "" | 560001 | 400 | lastName |
  | blank postal code | Asha | Rao | "" | 400 | postalCode |
  | symbols in postal code | Asha | Rao | "#$%" | 400 | postalCode |
  | valid order | Asha | Rao | 560001 | 201 | null |

- One \`@Test(dataProvider = "orderValidation")\` method that posts the order (always with
  \`items: [{ productId: 2, quantity: 1 }]\`) and asserts \`statusCode(expectedStatus)\`; when \`expectedField\` is not null
  it also asserts \`error.code\` is \`"VALIDATION_FAILED"\` and \`error.details.field\` has the item \`expectedField\`.

**Rules**
- Exactly **one** @Test method for the matrix.
- The case name is the first column, so the report says which row failed.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderValidationMatrixTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void login() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void blankFirstName() {
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("firstName", "", "lastName", "Rao", "postalCode", "560001",
                "items", List.of(Map.of("productId", 2, "quantity", 1))))
        .when().post("/api/orders")
        .then().statusCode(400);
    }

    @Test
    public void blankLastName() {
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("firstName", "Asha", "lastName", "", "postalCode", "560001",
                "items", List.of(Map.of("productId", 2, "quantity", 1))))
        .when().post("/api/orders")
        .then().statusCode(400);
    }

    // ...and three more copies. TODO: one data-driven test
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderValidationMatrixTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void login() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @DataProvider(name = "orderValidation")
    public Object[][] orderValidation() {
        return new Object[][] {
            // case name                 firstName  lastName  postalCode  status  field
            { "blank first name",        "",        "Rao",    "560001",   400,    "firstName" },
            { "blank last name",         "Asha",    "",       "560001",   400,    "lastName" },
            { "blank postal code",       "Asha",    "Rao",    "",         400,    "postalCode" },
            { "symbols in postal code",  "Asha",    "Rao",    "#$%",      400,    "postalCode" },
            { "valid order",             "Asha",    "Rao",    "560001",   201,    null },
        };
    }

    @Test(dataProvider = "orderValidation")
    public void orderValidationRules(String caseName, String firstName, String lastName, String postalCode,
                                     int expectedStatus, String expectedField) {
        Map<String, Object> order = Map.of(
            "firstName", firstName,
            "lastName", lastName,
            "postalCode", postalCode,
            "items", List.of(Map.of("productId", 2, "quantity", 1)));

        ValidatableResponse response = given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .contentType(ContentType.JSON)
            .body(order)
        .when()
            .post("/api/orders")
        .then()
            .statusCode(expectedStatus);

        if (expectedField != null) {
            response
                .body("error.code", equalTo("VALIDATION_FAILED"))
                .body("error.details.field", hasItem(expectedField));
        }
    }
}
`,
  checks: [
    { label: 'Declares a named DataProvider', pattern: '@DataProvider\\(\\s*name\\s*=\\s*"orderValidation"', hint: '@DataProvider(name = "orderValidation")' },
    { label: 'Returns Object[][] rows', pattern: 'public\\s+Object\\[\\]\\[\\]\\s+\\w+\\s*\\(', hint: 'public Object[][] orderValidation() { return new Object[][] { ... }; }' },
    { label: 'Test is wired to the provider', pattern: '@Test\\(\\s*dataProvider\\s*=\\s*"orderValidation"', hint: '@Test(dataProvider = "orderValidation")' },
    { label: 'Status comes from the row', pattern: 'statusCode\\(\\s*expectedStatus\\s*\\)', hint: '.statusCode(expectedStatus)' },
    { label: 'Field error from the row', pattern: 'hasItem\\(\\s*expectedField\\s*\\)', hint: '.body("error.details.field", hasItem(expectedField))' },
    { label: 'Exactly one @Test method', pattern: '@Test[\\s\\S]*@Test', mustNot: true, hint: 'All rows go through one test method.' },
  ],
  hints: [
    'Each row\'s values become the method parameters in order — six columns, six parameters.',
    'int columns in Object[][] are auto-boxed; declare the parameter as int.',
    'Keep the reference to then() in a ValidatableResponse to add assertions conditionally.',
  ],
  explanation: `The DataProvider *is* the BA's decision table: one row per case, inputs and expected results side by side. TestNG
runs the method once per row and reports each row separately, e.g.
\`orderValidationRules("symbols in postal code", ...)\` failed — no guessing which copy broke.

Design points a reviewer checks:
- **Expected results live in the row** (status and field), so the valid case shares the same method.
- **One fault per row** — everything else in the row is valid, so the test proves *that* validation.
- The **case name column** makes the report readable for the BA.
- The \`if (expectedField != null)\` branch is tiny; if positive and negative paths diverged a lot, use two providers.

Next steps in a real project: load the rows from JSON with Jackson so the BA can add cases without touching Java, and
use \`@DataProvider(parallel = true)\` once each row uses independent data.`,
  mistakes: [
    'Parameter count/type mismatch with the row — TestNG fails with "data provider mismatch".',
    'Using Map.of with a null value — it throws NullPointerException; build a HashMap if a field must be absent.',
    'Huge if/else trees inside a data-driven test — split into separate providers.',
    'Rows that depend on each other (row 2 needs the order from row 1) — rows must be independent.',
  ],
  interview: [
    { q: 'How do you make a DataProvider row readable in reports?', a: 'Put a case-name String first (TestNG prints the parameters), or implement ITest / use a custom name in the listener so the report shows "blank last name" instead of positional values.' },
    { q: 'Where do you keep large API test data sets?', a: 'In JSON or CSV files under src/test/resources/testdata, loaded with Jackson into POJOs or maps, so non-coders can add rows and Git diffs stay readable. The DataProvider just maps them to Object[][].' },
  ],
}
