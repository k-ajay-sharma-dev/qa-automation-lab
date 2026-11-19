export default {
  id: 'api-013',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Negative tests: assert the error contract (400, 401, 404)',
  level: 'INTERMEDIATE',
  tags: ['negative-testing', 'error-handling', 'validation', 'contract'],
  estMinutes: 30,
  scenario: `The mobile developers show field errors under each checkout input using \`error.details[].field\` from the API.
After a backend refactor, validation errors came back as one long message with no details — every field went red at
once and support tickets piled up. The existing negative tests only did \`statusCode(not(200))\`, so they kept passing.
The team agreed an error contract: \`{ "error": { "code", "message", "details"? } }\`. Your tests must enforce it.`,
  description: `Token and reset are prepared in \`@BeforeMethod\`. Write four tests:

1. **blankFirstNameIsReported** — \`POST /api/orders\` with \`firstName: ""\`, \`lastName: "Rao"\`, \`postalCode: "560001"\`,
   \`items: [{ productId: 1, quantity: 1 }]\` → **400**, \`error.code\` \`"VALIDATION_FAILED"\`, \`error.details\` has
   **exactly 1** entry and \`error.details[0].field\` is \`"firstName"\`.
2. **ordersRequireAuth** — same valid-looking body without a token → **401**, \`error.code\` \`"UNAUTHORIZED"\`.
3. **missingProductIs404** — \`GET /api/products/99\` → **404**, \`error.code\` \`"PRODUCT_NOT_FOUND"\`, \`error.message\`
   contains \`"99"\`.
4. **malformedJsonIs400** — send the raw string \`{ "firstName": \` (broken JSON) with a token → **400**, \`error.code\`
   \`"INVALID_JSON"\`.

**Rules**
- Assert the **exact** status code and the **error code** in every test — no \`not(200)\`.
- Every test also checks \`error.message\` is present (\`notNullValue()\`).`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderErrorContractTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void blankFirstNameIsReported() {
        Map<String, Object> body = Map.of("firstName", "", "lastName", "Rao", "postalCode", "560001",
            "items", List.of(Map.of("productId", 1, "quantity", 1)));
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON).body(body)
        .when().post("/api/orders")
        .then().statusCode(not(200)); // "it failed, so the test passed"
    }

    // TODO: ordersRequireAuth, missingProductIs404, malformedJsonIs400
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderErrorContractTest {

    private static final String BASE_URI = "http://localhost:5181";
    private static final Map<String, Object> VALID_ITEMS_BODY = Map.of(
        "firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
        "items", List.of(Map.of("productId", 1, "quantity", 1)));
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void blankFirstNameIsReported() {
        Map<String, Object> body = Map.of("firstName", "", "lastName", "Rao", "postalCode", "560001",
            "items", List.of(Map.of("productId", 1, "quantity", 1)));

        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON).body(body)
        .when()
            .post("/api/orders")
        .then()
            .statusCode(400)
            .body("error.code", equalTo("VALIDATION_FAILED"))
            .body("error.message", notNullValue())
            .body("error.details", hasSize(1))
            .body("error.details[0].field", equalTo("firstName"));
    }

    @Test
    public void ordersRequireAuth() {
        given().baseUri(BASE_URI).contentType(ContentType.JSON).body(VALID_ITEMS_BODY)
        .when()
            .post("/api/orders")
        .then()
            .statusCode(401)
            .body("error.code", equalTo("UNAUTHORIZED"))
            .body("error.message", notNullValue());
    }

    @Test
    public void missingProductIs404() {
        given().baseUri(BASE_URI)
        .when()
            .get("/api/products/{id}", 99)
        .then()
            .statusCode(404)
            .body("error.code", equalTo("PRODUCT_NOT_FOUND"))
            .body("error.message", notNullValue())
            .body("error.message", containsString("99"));
    }

    @Test
    public void malformedJsonIs400() {
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body("{ \\"firstName\\": ")
        .when()
            .post("/api/orders")
        .then()
            .statusCode(400)
            .body("error.code", equalTo("INVALID_JSON"))
            .body("error.message", notNullValue());
    }
}
`,
  checks: [
    { label: 'Exact 400 for validation', pattern: 'statusCode\\(\\s*400\\s*\\)[\\s\\S]*"VALIDATION_FAILED"', hint: '.statusCode(400).body("error.code", equalTo("VALIDATION_FAILED"))' },
    { label: 'Checks the field error details', pattern: '"error\\.details\\[0\\]\\.field"\\s*,\\s*equalTo\\(\\s*"firstName"', hint: '.body("error.details[0].field", equalTo("firstName"))' },
    { label: 'Checks the number of details', pattern: '("error\\.details"\\s*,\\s*hasSize\\(\\s*1|"error\\.details\\.size\\(\\)"\\s*,\\s*equalTo\\(\\s*1)', hint: '.body("error.details", hasSize(1))' },
    { label: '401 for missing token', pattern: 'statusCode\\(\\s*401\\s*\\)', hint: 'Post without auth → .statusCode(401)' },
    { label: '404 with PRODUCT_NOT_FOUND', pattern: 'statusCode\\(\\s*404\\s*\\)[\\s\\S]*"PRODUCT_NOT_FOUND"', hint: '.statusCode(404).body("error.code", equalTo("PRODUCT_NOT_FOUND"))' },
    { label: 'Malformed JSON → INVALID_JSON', pattern: '"INVALID_JSON"', hint: 'Send a broken string body and expect error.code INVALID_JSON.' },
    { label: 'No vague not(200) assertions', pattern: 'statusCode\\(\\s*not\\(', mustNot: true, hint: 'Assert the exact status code.' },
  ],
  hints: [
    'error.details is a list: hasSize(1) checks how many, error.details[0].field reads the first one.',
    'For broken JSON you must send a String body — a Map can never be malformed.',
    'Inside a Java string, escape quotes: "{ \\"firstName\\": "',
  ],
  explanation: `A good negative test proves **the API refuses for the right reason and tells the client why**:

| Check | Why |
|---|---|
| exact status (400 / 401 / 404) | clients branch on it; \`not(200)\` would accept a 500 crash |
| \`error.code\` | stable machine-readable reason — the contract |
| \`error.details[].field\` | the mobile app highlights exactly that input |
| \`hasSize(1)\` | only the broken field is reported, not every field |
| \`error.message\` present | humans and logs need it, but wording may change, so don't assert it exactly |

Note the deliberate *one fault per test* design: only \`firstName\` is invalid, everything else is valid — the
equivalence-partitioning habit you already have from manual testing. The 401 test sends a *valid* body so the only
reason to refuse is the missing token.`,
  mistakes: [
    'statusCode(not(200)) or greaterThanOrEqualTo(400) — a 500 server crash passes the test.',
    'Several invalid fields in one request — you cannot tell which validation actually works.',
    'Asserting the full human-readable message text exactly — it gets reworded and the test breaks for nothing.',
    'Testing malformed JSON with a Map — RestAssured always produces valid JSON from a Map.',
  ],
  interview: [
    { q: 'Which negative tests do you write for a POST endpoint?', a: 'Missing and blank required fields (one at a time), wrong types, boundary values, malformed JSON, wrong content type, missing/invalid auth, forbidden access, unknown referenced ids, duplicates (409) and business-rule violations (422). Each asserts status, error code and the reported field.' },
    { q: 'What is an error contract?', a: 'An agreed, consistent shape and set of codes for errors across all endpoints, so clients can handle them generically. Tests enforce it like any other part of the API contract, often with a JSON schema for the error body.' },
  ],
}
