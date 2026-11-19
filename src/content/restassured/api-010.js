export default {
  id: 'api-010',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Authentication: login → token → Bearer header on the cart API',
  level: 'INTERMEDIATE',
  tags: ['auth', 'bearer-token', 'security', 'cart'],
  estMinutes: 25,
  scenario: `A penetration-test finding said "cart endpoints accept requests without a token in one environment". It was a
config slip, fixed in a day, but the security lead now wants automated proof on every build that the cart API is
protected, and that a real customer token works. The existing test copies a token from Postman into the code — it
expires and fails every morning.`,
  description: `Write \`CartAuthTest\`:

- A helper \`private String loginAs(String username, String password)\` that calls \`POST /api/auth/login\` and returns the token.
- **cartRequiresToken** — \`GET /api/cart\` with **no** Authorization header → 401, \`error.code\` \`"UNAUTHORIZED"\` and the
  \`WWW-Authenticate\` header contains \`"Bearer"\`.
- **invalidTokenIsRejected** — \`GET /api/cart\` with \`Bearer not-a-real-token\` → 401.
- **customerCanAddToCart** — token for \`standard_user\`, \`POST /api/cart/items\` with \`{ "productId": 1, "quantity": 2 }\`
  → 201, \`itemCount\` 2 and \`subtotal\` 59.98 (Float!).

**Rules**
- Send the token as a Bearer token: \`.auth().oauth2(token)\` **or** \`.header("Authorization", "Bearer " + token)\`.
- Never hard-code a token — always get it from the login API.
- Reset the data (\`POST /api/reset\`) in \`@BeforeMethod\` so the cart starts empty.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartAuthTest {

    private static final String BASE_URI = "http://localhost:5181";
    // copied from Postman on Monday...
    private static final String TOKEN = "se_1_0001_7374616e6461";

    @Test
    public void customerCanAddToCart() {
        given().baseUri(BASE_URI)
            .header("Authorization", TOKEN)
            .contentType(ContentType.JSON)
            .body(Map.of("productId", 1, "quantity", 2))
        .when().post("/api/cart/items")
        .then().statusCode(201);
    }

    // TODO: loginAs helper, cartRequiresToken, invalidTokenIsRejected, @BeforeMethod reset
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartAuthTest {

    private static final String BASE_URI = "http://localhost:5181";

    @BeforeMethod
    public void resetData() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
    }

    private String loginAs(String username, String password) {
        return given()
            .baseUri(BASE_URI)
            .contentType(ContentType.JSON)
            .body(Map.of("username", username, "password", password))
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(200)
            .extract().path("token");
    }

    @Test
    public void cartRequiresToken() {
        given()
            .baseUri(BASE_URI)
        .when()
            .get("/api/cart")
        .then()
            .statusCode(401)
            .header("WWW-Authenticate", containsString("Bearer"))
            .body("error.code", equalTo("UNAUTHORIZED"));
    }

    @Test
    public void invalidTokenIsRejected() {
        given()
            .baseUri(BASE_URI)
            .auth().oauth2("not-a-real-token")
        .when()
            .get("/api/cart")
        .then()
            .statusCode(401)
            .body("error.code", equalTo("UNAUTHORIZED"));
    }

    @Test
    public void customerCanAddToCart() {
        String token = loginAs("standard_user", "secret_sauce");

        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .contentType(ContentType.JSON)
            .body(Map.of("productId", 1, "quantity", 2))
        .when()
            .post("/api/cart/items")
        .then()
            .statusCode(201)
            .body("itemCount", equalTo(2))
            .body("subtotal", equalTo(59.98f));
    }
}
`,
  checks: [
    { label: 'Has a loginAs helper that calls the login API', pattern: 'String\\s+loginAs\\s*\\([\\s\\S]*?"/api/auth/login"', hint: 'private String loginAs(String username, String password) { ... post("/api/auth/login") ... }' },
    { label: 'Sends a Bearer token', pattern: '(\\.auth\\(\\)\\s*\\.oauth2\\(|"Authorization"\\s*,\\s*"Bearer "\\s*\\+)', hint: '.auth().oauth2(token)' },
    { label: 'No hard-coded token', pattern: '"se_\\d', mustNot: true, hint: 'Tokens expire — get one from loginAs(...).' },
    { label: 'Asserts 401 without a token', pattern: 'statusCode\\(\\s*401\\s*\\)', hint: '.get("/api/cart").then().statusCode(401)' },
    { label: 'Checks the WWW-Authenticate header', pattern: '\\.header\\(\\s*"WWW-Authenticate"\\s*,', hint: '.header("WWW-Authenticate", containsString("Bearer"))' },
    { label: 'Resets data before each test', pattern: '@BeforeMethod[\\s\\S]*?"/api/reset"', hint: '@BeforeMethod public void resetData() { ... post("/api/reset") ... }' },
  ],
  hints: [
    '.auth().oauth2(token) adds the header "Authorization: Bearer <token>" for you.',
    'In then(), .header("Name", matcher) asserts a response header.',
    'subtotal is a decimal → compare with 59.98f.',
  ],
  explanation: `Token-based auth is a two-step flow: **log in → receive a token → send it on every protected call** as
\`Authorization: Bearer <token>\`. \`.auth().oauth2(token)\` is RestAssured's shortcut for exactly that header; writing the
header yourself is equally fine.

The negative tests matter more than the happy path for the security lead: *no token* and *garbage token* must both be
401, and a well-behaved API also sends \`WWW-Authenticate: Bearer ...\` to tell the client what kind of auth it expects.

Getting the token from the login API at run time (instead of pasting one) makes the test independent of expiry and of
which environment it runs in. In a framework this helper becomes an \`AuthClient\` that caches one token per user.`,
  mistakes: [
    'Sending just the token without the "Bearer " prefix — the API answers 401 and it looks like a backend bug.',
    'Hard-coding tokens copied from Postman — they expire and leak into Git history.',
    'Only testing the happy path — the security value is in the 401/403 cases.',
    'Logging in inside every request instead of once per test/user — slow and can hit rate limits.',
  ],
  interview: [
    { q: 'What auth types does RestAssured support?', a: 'Basic and preemptive basic (auth().preemptive().basic(u, p)), digest, form, OAuth 1 and OAuth 2 bearer tokens (auth().oauth2(token)), plus any custom header such as an API key.' },
    { q: 'How do you handle token expiry in a long suite?', a: 'Cache the token with its expiry time in an AuthClient and refresh it when it is close to expiring (or on the first 401), instead of hard-coding or logging in for every request.' },
  ],
}
