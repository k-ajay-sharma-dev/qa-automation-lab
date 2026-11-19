export default {
  id: 'api-009',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'PUT vs PATCH vs DELETE: profile updates and cart removal',
  level: 'INTERMEDIATE',
  tags: ['put', 'patch', 'delete', 'idempotency'],
  estMinutes: 30,
  scenario: `A customer complained that changing her phone number in the app wiped her delivery address. Root cause: the app
used PUT (replace everything) with a half-filled body. The backend now rejects incomplete PUTs and the app moved to
PATCH. You must add regression tests so this never comes back — plus cover "remove from cart", which returns
204 and was once reported as "does nothing" because a tester expected a body.`,
  description: `Data is reset in \`@BeforeClass\` (\`POST /api/reset\`) and a token is available. User 1 is \`standard_user\`
(Asha Rao, email \`asha.rao@shopeasy.test\`, address city \`Bengaluru\`).

1. **patchChangesOnlyThePhone** — \`PATCH /api/users/1\` with \`{ "phone": "+91-80-5550-9999" }\` → 200, \`phone\` is the
   new value, \`email\` and \`address.city\` are **unchanged**.
2. **incompletePutIsRejected** — \`PUT /api/users/1\` with only \`{ "firstName": "Asha" }\` → **400**, \`error.code\` is
   \`"VALIDATION_FAILED"\` and \`error.details.field\` has the item \`"email"\`.
3. **deleteRemovesCartItem** — add product 3 to the cart (\`POST /api/cart/items\`, 201), \`DELETE /api/cart/items/3\` →
   **204**, then \`GET /api/cart\` and assert \`items.productId\` does **not** contain 3.

**Rules**
- Use \`.patch(...)\`, \`.put(...)\` and \`.delete(...)\` — one method each.
- Verify the delete with a follow-up GET, not by reading the 204 body.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class UpdateAndDeleteTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void patchChangesOnlyThePhone() {
        // TODO
    }

    @Test
    public void incompletePutIsRejected() {
        // TODO
    }

    @Test
    public void deleteRemovesCartItem() {
        // TODO
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class UpdateAndDeleteTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void patchChangesOnlyThePhone() {
        given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(Map.of("phone", "+91-80-5550-9999"))
        .when()
            .patch("/api/users/{id}", 1)
        .then()
            .statusCode(200)
            .body("phone", equalTo("+91-80-5550-9999"))
            .body("email", equalTo("asha.rao@shopeasy.test"))
            .body("address.city", equalTo("Bengaluru"));
    }

    @Test
    public void incompletePutIsRejected() {
        given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(Map.of("firstName", "Asha"))
        .when()
            .put("/api/users/{id}", 1)
        .then()
            .statusCode(400)
            .body("error.code", equalTo("VALIDATION_FAILED"))
            .body("error.details.field", hasItem("email"));
    }

    @Test
    public void deleteRemovesCartItem() {
        given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(Map.of("productId", 3))
        .when()
            .post("/api/cart/items")
        .then()
            .statusCode(201);

        given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
        .when()
            .delete("/api/cart/items/{productId}", 3)
        .then()
            .statusCode(204);

        given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
        .when()
            .get("/api/cart")
        .then()
            .statusCode(200)
            .body("items.productId", not(hasItem(3)));
    }
}
`,
  checks: [
    { label: 'Uses PATCH', pattern: '\\.patch\\(', hint: '.when().patch("/api/users/{id}", 1)' },
    { label: 'PATCH keeps other fields (email/address checked)', pattern: '"(email|address\\.city)"\\s*,\\s*equalTo\\(', hint: '.body("email", equalTo("asha.rao@shopeasy.test"))' },
    { label: 'Uses PUT and expects 400', pattern: '\\.put\\([\\s\\S]*?statusCode\\(\\s*400\\s*\\)', hint: '.put("/api/users/{id}", 1).then().statusCode(400)' },
    { label: 'Checks the field error for email', pattern: '"error\\.details\\.field"\\s*,\\s*hasItem\\(\\s*"email"', hint: '.body("error.details.field", hasItem("email"))' },
    { label: 'DELETE returns 204', pattern: '\\.delete\\([\\s\\S]*?statusCode\\(\\s*204\\s*\\)', hint: '.delete("/api/cart/items/{productId}", 3).then().statusCode(204)' },
    { label: 'Verifies the item is gone with not(hasItem(...))', pattern: 'not\\(\\s*hasItem\\(\\s*3\\s*\\)\\s*\\)', hint: '.body("items.productId", not(hasItem(3)))' },
  ],
  hints: [
    'You can pass path params inline: .patch("/api/users/{id}", 1).',
    'error.details is an array, so error.details.field is the list of field names that failed.',
    'A 204 has no body — verify with a GET afterwards.',
  ],
  explanation: `- **PATCH** sends only what changes. The important assertion is what did **not** change (email, address) — that
  is exactly the bug the customer hit.
- **PUT** replaces the resource, so the API must reject an incomplete body. \`error.details.field\` collects the
  \`field\` of every entry in the details array, so \`hasItem("email")\` checks that the right field was reported.
- **DELETE** returns 204 and no body. Verifying the *side effect* with a GET is the API equivalent of refreshing the
  page after clicking "Remove".

\`POST /api/reset\` in \`@BeforeClass\` makes the tests repeatable: the phone number and cart start from known values on
every run — the same reason you restore a test database before a manual regression cycle.`,
  mistakes: [
    'Using PUT with a partial body and calling it an "update" test — it only tests the happy path of the wrong method.',
    'Only asserting the changed field after PATCH — the bug is usually in the fields you did not send.',
    'Expecting a JSON body from DELETE (204) and failing on parsing.',
    'Tests that depend on each other\'s data without a reset — they pass alone and fail in a different order.',
  ],
  interview: [
    { q: 'Is PATCH idempotent?', a: 'Not by definition — it depends on the patch. "Set phone to X" is idempotent; "increment quantity by 1" is not. PUT and DELETE are idempotent by definition.' },
    { q: 'How do you test a DELETE endpoint fully?', a: 'Status 204/200, then GET returns 404 or the item is gone from the collection, a second DELETE returns 404 (or 204 if the API chooses idempotent semantics), and delete without auth or of someone else\'s resource returns 401/403.' },
  ],
}
