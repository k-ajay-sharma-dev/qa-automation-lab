export default {
  id: 'dbg-017',
  category: 'debugging',
  kind: 'code',
  title: '401 Unauthorized: "Bearer null" from the wrong JSON path',
  level: 'BEGINNER',
  tags: ['restassured', '401', 'json-path', 'auth', 'bearer-token'],
  estMinutes: 15,
  scenario: `You copied a login helper from another project's API suite into the ShopEasy API tests (\`http://localhost:5181\`). Every test that needs a logged-in user now fails with **401**, while the login call itself "passes". Your developer friend says the token endpoint works fine in Postman. The tests have never once got past authentication.`,
  description: `Console (RestAssured logs the request because the test uses \`log().ifValidationFails()\`):

\`\`\`text
Request method:	GET
Request URI:	http://localhost:5181/api/cart
Headers:		Authorization=Bearer null
				Accept=*/*
Body:			<none>

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="shopeasy"
Content-Type: application/json; charset=utf-8
X-Request-Id: req-00012

{
    "error": {
        "code": "UNAUTHORIZED",
        "message": "Bearer token is invalid or expired"
    }
}

[ERROR] newUserHasEmptyCart(com.shopeasy.api.tests.CartApiTest)  Time elapsed: 0.317 s  <<< FAILURE!
java.lang.AssertionError: 1 expectation failed.
Expected status code <200> but was <401>.
	at com.shopeasy.api.tests.CartApiTest.newUserHasEmptyCart(CartApiTest.java:41)
\`\`\`

Postman shows the real login response:

\`\`\`json
{
  "token": "se_1_0001_7374616e6461",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": 1, "username": "standard_user" }
}
\`\`\`

**Diagnose:** look at the \`Headers:\` line — the test literally sent \`Bearer null\`. The helper extracts \`access_token\` (the old project's field name). JSON path returns \`null\` for a field that doesn't exist — it does **not** throw — so the bug surfaced one request later as a 401.

**Fix \`AuthClient.tokenFor()\`:**
- Assert the login itself: status **200** and a non-null \`token\`, so a broken login fails *at the login*.
- Extract the right field: \`token\`.
- Send it with \`auth().oauth2(token)\` (or \`header("Authorization", "Bearer " + token)\`).`,
  hints: [
    'Always read the request part of the log first: "Authorization=Bearer null" means the token variable was null.',
    'JsonPath returns null for a missing field instead of failing — so assert what you extract.',
    '.then().statusCode(200).body("token", notNullValue()).extract().path("token")',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.api.support;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import java.util.Map;

public class AuthClient {

    private static final String BASE_URI = "http://localhost:5181";

    public static String tokenFor(String username, String password) {
        return given()
                .baseUri(BASE_URI)
                .contentType(ContentType.JSON)
                .body(Map.of("username", username, "password", password))
            .when()
                .post("/api/auth/login")
            .then()
                .extract()
                .path("access_token");
    }
}

// ===== CartApiTest.java (excerpt) =====
// String token = AuthClient.tokenFor("standard_user", "secret_sauce");
// given().baseUri(BASE_URI).header("Authorization", "Bearer " + token)
//     .log().ifValidationFails()
// .when().get("/api/cart")
// .then().statusCode(200).body("items", empty());
`,
  solution: String.raw`package com.shopeasy.api.support;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import java.util.Map;

public class AuthClient {

    private static final String BASE_URI = "http://localhost:5181";

    public static String tokenFor(String username, String password) {
        return given()
                .baseUri(BASE_URI)
                .contentType(ContentType.JSON)
                .body(Map.of("username", username, "password", password))
                .log().ifValidationFails()
            .when()
                .post("/api/auth/login")
            .then()
                .log().ifValidationFails()
                .statusCode(200)
                .body("tokenType", equalTo("Bearer"))
                .body("token", notNullValue())   // fail HERE if the field is missing
                .extract()
                .path("token");
    }

    /** Request spec for an authenticated user - every test starts from this. */
    public static RequestSpecification authenticatedAs(String username, String password) {
        String token = tokenFor(username, password);
        return given()
                .baseUri(BASE_URI)
                .auth().oauth2(token)              // sends "Authorization: Bearer <token>"
                .log().ifValidationFails();
    }
}
`,
  checks: [
    { label: 'Extracts the "token" field', pattern: '(path|getString)\\s*\\(\\s*"token"\\s*\\)', hint: '.extract().path("token")' },
    { label: 'No longer reads "access_token"', pattern: '"access_token"', mustNot: true, hint: 'The ShopEasy login response has no access_token field' },
    { label: 'Asserts the login returned 200', pattern: 'statusCode\\s*\\(\\s*200\\s*\\)', hint: '.then().statusCode(200) before extracting' },
    { label: 'Fails fast if the token is missing', pattern: '(body\\s*\\(\\s*"token"\\s*,\\s*(notNullValue|not\\s*\\()|assertNotNull\\s*\\(\\s*token)', hint: '.body("token", notNullValue())' },
    { label: 'Sends the token as a Bearer header', pattern: '(oauth2\\s*\\(\\s*\\w+\\s*\\)|"Bearer\\s*"\\s*\\+\\s*\\w+)', hint: '.auth().oauth2(token) or header("Authorization", "Bearer " + token)' },
  ],
  explanation: `**Root cause:** a field-name mismatch. The helper extracted \`access_token\` (common in OAuth servers), but ShopEasy returns \`token\`. RestAssured's JSON path returns \`null\` for a missing key, so \`tokenFor\` quietly returned \`null\`, the next request sent \`Authorization: Bearer null\`, and the server answered 401 \`UNAUTHORIZED\` — "Bearer token is invalid or expired".

**Reading a 401 like a senior:**
1. Look at the **request** in the log, not just the status. \`Bearer null\`, \`Bearer \` (empty) or a missing \`Authorization\` header → the test never had a token.
2. Compare the server's message: ShopEasy says *"Authorization header with a Bearer token is required"* when the header is missing and *"Bearer token is invalid or expired"* when a value was sent but not recognised.
3. If the header looks right, check expiry (\`expiresIn: 3600\`), the environment (token from QA used against staging) and whether the API was reset (\`POST /api/reset\` drops all tokens).

**Why assert on the login call:** the earliest possible failure gives the clearest message. With \`.statusCode(200).body("token", notNullValue())\` the run now fails at login with *"JSON path token doesn't match. Expected: not null"* — one look and you know the field name is wrong.

**401 vs 403:** 401 = "I don't know who you are" (no/invalid token). 403 = "I know you, but you're not allowed" — e.g. \`locked_out_user\` logging in, or \`GET /api/orders/{id}\` for another customer's order.`,
  mistakes: [
    'Extracting a value without asserting the response it came from.',
    'Assuming JSON path throws for a missing field — it returns null.',
    'Hard-coding a token copied from Postman into the test; it expires and breaks after the next reset.',
    'Raising a backend defect for "auth broken" without checking what the test actually sent.',
  ],
  interview: [
    { q: 'Your API tests get 401 but the same call works in Postman. How do you debug it?', a: 'I log the request RestAssured actually sent with log().ifValidationFails() or log().all() and compare the Authorization header with Postman. In one case it was "Bearer null" because we extracted the token from the wrong JSON path. I fixed the path and made the login step assert status 200 and a non-null token so the failure shows up at the right place.' },
    { q: 'What is the difference between 401 and 403?', a: '401 Unauthorized means authentication failed or was missing — the server does not know who you are. 403 Forbidden means you are authenticated but not allowed to do this, like reading another user\'s order. Tests should cover both.' },
    { q: 'How do you manage tokens in an API framework?', a: 'A small auth client logs in once per user per test class or scenario, asserts the response and returns a RequestSpecification with the Bearer token. Credentials come from config or environment variables, never hard-coded tokens, and tests that need a fresh state call the reset or create their own data.' },
  ],
}
