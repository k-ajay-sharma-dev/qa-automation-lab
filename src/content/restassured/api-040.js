export default {
  id: 'api-040',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Content-Type and charset checks with log().ifValidationFails()',
  level: 'BEGINNER',
  tags: ['headers', 'content-type', 'charset', 'logging'],
  estMinutes: 15,
  scenario: `A customer in Stockholm reported product names with broken characters ("Ã¶") after a proxy change dropped
\`charset=utf-8\` from the responses. Nobody noticed because the tests only checked \`statusCode(200)\`. At the same time
the CI log is 30 MB long because every test calls \`log().all()\` — when something fails, nobody can find it.`,
  description: `Write three tests against \`http://localhost:5181\`:

1. **productIsUtf8Json** — \`GET /api/products/1\` → 200, content type is JSON **and** the \`Content-Type\` header
   contains \`charset=utf-8\`; the \`X-Request-Id\` header is present.
2. **schemaUsesSchemaJsonType** — \`GET /api/schema/product\` → 200 and \`Content-Type\` contains
   \`application/schema+json\`.
3. **emptyCartHasNoBody** — log in as \`standard_user\` / \`secret_sauce\`, \`DELETE /api/cart\` with the token → **204**
   and an empty body.

**Rules**
- Log request and response **only when a test fails**: \`log().ifValidationFails()\`. No \`log().all()\`.
- Use \`containsString\` for header values — don't compare the whole header string exactly.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ContentTypeTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productIsUtf8Json() {
        given().baseUri(BASE_URI).log().all()
        .when()
            .get("/api/products/{id}", 1)
        .then()
            .log().all()
            .statusCode(200);
    }

    // TODO: schemaUsesSchemaJsonType, emptyCartHasNoBody
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ContentTypeTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productIsUtf8Json() {
        given().baseUri(BASE_URI).log().ifValidationFails()
        .when()
            .get("/api/products/{id}", 1)
        .then()
            .log().ifValidationFails()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .header("Content-Type", containsString("charset=utf-8"))
            .header("X-Request-Id", notNullValue());
    }

    @Test
    public void schemaUsesSchemaJsonType() {
        given().baseUri(BASE_URI).log().ifValidationFails()
        .when()
            .get("/api/schema/product")
        .then()
            .log().ifValidationFails()
            .statusCode(200)
            .header("Content-Type", containsString("application/schema+json"));
    }

    @Test
    public void emptyCartHasNoBody() {
        String token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");

        given().baseUri(BASE_URI).auth().oauth2(token).log().ifValidationFails()
        .when()
            .delete("/api/cart")
        .then()
            .log().ifValidationFails()
            .statusCode(204)
            .body(emptyString());
    }
}
`,
  checks: [
    { label: 'Logs only on failure', pattern: 'log\\(\\)\\s*\\.\\s*ifValidationFails\\(', hint: 'Use .log().ifValidationFails() in given() and/or then().' },
    { label: 'No log().all()', pattern: 'log\\(\\)\\s*\\.\\s*all\\(', mustNot: true, hint: 'log().all() floods the CI log for passing tests.' },
    { label: 'Checks the utf-8 charset', pattern: '"Content-Type"\\s*,\\s*containsString\\(\\s*"charset=utf-8"', hint: '.header("Content-Type", containsString("charset=utf-8"))' },
    { label: 'Checks the schema+json type', pattern: 'containsString\\(\\s*"application/schema\\+json"', hint: '.header("Content-Type", containsString("application/schema+json"))' },
    { label: 'Checks X-Request-Id is present', pattern: '"X-Request-Id"\\s*,\\s*notNullValue\\(', hint: '.header("X-Request-Id", notNullValue())' },
    { label: '204 with an empty body', pattern: 'statusCode\\(\\s*204\\s*\\)[\\s\\S]*(emptyString|emptyOrNullString|equalTo\\(\\s*""\\s*\\))', hint: '.statusCode(204).body(emptyString())' },
  ],
  hints: [
    '.contentType(ContentType.JSON) checks the media type; the charset needs a separate header check.',
    'ContentType.JSON does not match application/schema+json — check that header with containsString.',
    'A 204 has no body: .body(emptyString()).',
  ],
  explanation: `\`contentType(ContentType.JSON)\` only proves the **media type** is JSON. The charset is what tells the client how to
decode "Ö" and "€", so it gets its own assertion: \`header("Content-Type", containsString("charset=utf-8"))\`.
\`containsString\` keeps the test stable if the server adds or reorders parameters.

\`/api/schema/product\` deliberately returns \`application/schema+json\` — a reminder that "it's JSON" can have more
than one correct media type, and an exact \`ContentType.JSON\` would be the wrong expectation there.

\`log().ifValidationFails()\` prints the full request and response **only** for the failing test, which is exactly
the evidence you need in CI and nothing else. \`X-Request-Id\` is worth asserting because it is what you paste into a
bug report so a developer can find the server log line.`,
  mistakes: [
    'Only checking statusCode(200) — a missing charset or a text/html error page from a proxy still passes.',
    'Comparing the whole header exactly ("application/json; charset=utf-8") — breaks on harmless spacing or case changes.',
    'log().all() everywhere — huge logs that hide the one failure.',
    'Asserting a JSON field on a 204 response — there is no body.',
  ],
  interview: [
    { q: 'Why check the Content-Type header in an API test?', a: 'Clients choose how to parse the body from it. A wrong media type or missing charset breaks clients even when the data is right, and a text/html error page from a gateway is a common real-world failure that a status-only test misses.' },
    { q: 'log().all() vs log().ifValidationFails()?', a: 'log().all() prints every request and response, which is useful while writing a test but makes CI logs unreadable. ifValidationFails() prints only when an assertion fails, so passing tests stay silent and the failing one has full evidence.' },
  ],
}
