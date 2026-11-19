export default {
  id: 'api-006',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'POST a JSON body: log in and get a token',
  level: 'BEGINNER',
  tags: ['post', 'json-body', 'login', 'extract'],
  estMinutes: 20,
  scenario: `Almost every ShopEasy endpoint needs a login token, so the login API is the first thing the mobile team
wants covered. A teammate's test sends the credentials as query parameters ("it worked in the browser!") and gets
400 VALIDATION_FAILED back. You need to send a proper JSON body, check the response and pull out the token that
later tests will reuse. While you are there, also cover the locked-out user, which the UI shows as a red banner.`,
  description: `\`POST http://localhost:5181/api/auth/login\` expects a JSON body \`{ "username": "...", "password": "..." }\`.

**Test 1 — standardUserGetsToken**: send the body as a **JSON String** for \`standard_user\` / \`secret_sauce\`.
Assert 200, \`tokenType\` is \`"Bearer"\`, \`user.username\` is \`"standard_user"\` and \`token\` is not empty.
Extract the token with \`.extract().path("token")\` into a \`String\` and assert it is not null.

**Test 2 — lockedUserIsRefused**: build the body as a \`Map<String, Object>\` for \`locked_out_user\` / \`secret_sauce\`.
Assert **403**, \`error.code\` is \`"USER_LOCKED"\` and \`error.message\` contains \`"locked out"\`.

**Rules**
- Set \`contentType(ContentType.JSON)\` and pass the body with \`.body(...)\`.
- No \`queryParam\` / \`formParam\` for credentials.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class LoginApiTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void standardUserGetsToken() {
        given().baseUri(BASE_URI)
            .queryParam("username", "standard_user")
            .queryParam("password", "secret_sauce")
        .when().post("/api/auth/login")
        .then().statusCode(200); // fails with 400 VALIDATION_FAILED
    }

    @Test
    public void lockedUserIsRefused() {
        // TODO: Map body for locked_out_user, expect 403 USER_LOCKED
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class LoginApiTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void standardUserGetsToken() {
        String body = """
            { "username": "standard_user", "password": "secret_sauce" }
            """;

        String token = given()
            .baseUri(BASE_URI)
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(200)
            .body("tokenType", equalTo("Bearer"))
            .body("user.username", equalTo("standard_user"))
            .body("token", not(emptyOrNullString()))
            .extract().path("token");

        Assert.assertNotNull(token, "Login did not return a token");
    }

    @Test
    public void lockedUserIsRefused() {
        Map<String, Object> credentials = new HashMap<>();
        credentials.put("username", "locked_out_user");
        credentials.put("password", "secret_sauce");

        given()
            .baseUri(BASE_URI)
            .contentType(ContentType.JSON)
            .body(credentials)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(403)
            .body("error.code", equalTo("USER_LOCKED"))
            .body("error.message", containsString("locked out"));
    }
}
`,
  checks: [
    { label: 'Sets JSON content type', pattern: '\\.contentType\\(\\s*(ContentType\\.JSON|"application/json")', hint: '.contentType(ContentType.JSON)' },
    { label: 'Uses a Map body', pattern: 'Map<\\s*String\\s*,\\s*(Object|String)\\s*>', hint: 'Map<String, Object> credentials = new HashMap<>();' },
    { label: 'Sends a body with .body(...)', pattern: '\\.body\\(\\s*\\w+\\s*\\)', hint: '.body(credentials)' },
    { label: 'Extracts the token', pattern: '\\.extract\\(\\)\\s*\\.path\\(\\s*"token"\\s*\\)', hint: '.extract().path("token")' },
    { label: 'Asserts 403 USER_LOCKED', pattern: 'statusCode\\(\\s*403\\s*\\)[\\s\\S]*"error\\.code"\\s*,\\s*equalTo\\(\\s*"USER_LOCKED"', hint: '.statusCode(403).body("error.code", equalTo("USER_LOCKED"))' },
    { label: 'No credentials in query/form params', pattern: '(queryParam|formParam)\\(\\s*"(username|password)"', mustNot: true, hint: 'Credentials go in the JSON body.' },
  ],
  hints: [
    'A Java text block ("""...""") is the easiest way to write a JSON string without escaping quotes.',
    'RestAssured turns a Map into JSON automatically (Jackson is on the classpath) once the content type is JSON.',
    'Nested fields use dots: "user.username", "error.code".',
  ],
  explanation: `There are three common ways to send a JSON body, from quickest to most maintainable:

1. **String** — fine for a one-off or for sending deliberately broken JSON in a negative test.
2. **Map** — no escaping, easy to build different variants in a loop or a DataProvider.
3. **POJO** — a Java class serialised by Jackson; the best choice for bigger bodies (next problems).

\`.extract().path("token")\` pulls one value out *after* the assertions pass, ready to be put in an
\`Authorization: Bearer <token>\` header. Asserting the **403 and the error code** for the locked user proves the API
enforces the rule itself — the red banner in the UI is only a reflection of it.`,
  mistakes: [
    'Forgetting contentType(JSON) — the server may not parse the body and answers 400.',
    'Building JSON with string concatenation ("{\\"username\\":\\"" + user + ...) — one missing quote breaks it; use a Map or POJO.',
    'Logging or committing real passwords — test credentials only, ideally from config.',
    'Expecting 401 for a locked user — the credentials are right, the account is not allowed: 403.',
  ],
  interview: [
    { q: 'String vs Map vs POJO body — when would you use each?', a: 'String for malformed-JSON negative tests or tiny bodies; Map for quick variations and data-driven rows; POJO for real payloads used in many tests, because it is typed, refactor-safe and reusable for deserialising responses.' },
    { q: 'How do you reuse a token across tests?', a: 'Extract it once (e.g. in @BeforeClass or an AuthClient that caches per user) and add it to a request specification as an Authorization: Bearer header, rather than logging in inside every test.' },
  ],
}
