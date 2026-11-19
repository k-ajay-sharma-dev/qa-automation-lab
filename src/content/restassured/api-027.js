export default {
  id: 'api-027',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Custom filters: a Bearer-token filter and logs that never leak the token',
  level: 'INTERMEDIATE',
  tags: ['filters', 'auth', 'logging', 'RequestSpecBuilder', 'security'],
  estMinutes: 30,
  scenario: `The cart suite has 80 tests and every one of them ends its \`given()\` with \`.auth().oauth2(token)\` and
\`.log().all()\`. Two things went wrong last sprint: a new test forgot the auth line and failed with a confusing 401, and
the security team found real staging tokens in the Jenkins console output, which is readable by the whole company.
Your lead asks for a **filter** — RestAssured's hook that runs around every request — that adds the token
automatically, plus logging that only prints failures and masks the \`Authorization\` header.`,
  description: `Write \`CartWithFiltersTest\` (the login helper is given):

1. A class \`BearerTokenFilter implements Filter\` (from \`io.restassured.filter\`) that receives the token in its
   constructor. In \`filter(requestSpec, responseSpec, ctx)\`: **if the request has no \`Authorization\` header yet**
   (\`requestSpec.getHeaders().hasHeaderWithName("Authorization")\`), add \`Authorization: Bearer <token>\`; then
   \`return ctx.next(requestSpec, responseSpec);\`.
2. In \`@BeforeClass\`, build a \`RequestSpecification\` with \`RequestSpecBuilder\`: base URI \`http://localhost:5181\`, base path
   \`/api\`, JSON content type, \`addFilter(new BearerTokenFilter(token))\`, and a config whose \`LogConfig\` **blacklists the
   \`Authorization\` header** and enables logging of request and response **only if validation fails**.
3. **cartIsReachableThroughTheFilter** — \`GET /cart\` with only \`.spec(spec)\` → 200 and \`userId\` 1.
4. **explicitHeaderWins** — \`.spec(spec).header("Authorization", "Bearer not-a-real-token")\` → **401** (the filter must not
   overwrite a header the test set on purpose — that is how negative tests stay possible).

**Rules**
- No \`.auth().oauth2(...)\` and no \`.log().all()\` in the test methods.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartWithFiltersTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void login() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void cartIsReachableThroughTheFilter() {
        given().baseUri(BASE_URI).auth().oauth2(token).log().all()   // token printed in Jenkins!
        .when().get("/api/cart")
        .then().log().all().statusCode(200);
    }

    // TODO: BearerTokenFilter, spec with filter + masked logging, explicitHeaderWins
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.LogConfig;
import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartWithFiltersTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;
    private RequestSpecification spec;

    /** Adds "Authorization: Bearer <token>" unless the test already set its own header. */
    public static class BearerTokenFilter implements Filter {
        private final String token;

        public BearerTokenFilter(String token) {
            this.token = token;
        }

        @Override
        public Response filter(FilterableRequestSpecification requestSpec,
                               FilterableResponseSpecification responseSpec,
                               FilterContext ctx) {
            if (!requestSpec.getHeaders().hasHeaderWithName("Authorization")) {
                requestSpec.header("Authorization", "Bearer " + token);
            }
            return ctx.next(requestSpec, responseSpec);
        }
    }

    @BeforeClass
    public void setUp() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");

        spec = new RequestSpecBuilder()
            .setBaseUri(BASE_URI)
            .setBasePath("/api")
            .setContentType(ContentType.JSON)
            .addFilter(new BearerTokenFilter(token))
            .setConfig(RestAssured.config().logConfig(LogConfig.logConfig()
                .blacklistHeader("Authorization")
                .enableLoggingOfRequestAndResponseIfValidationFails()))
            .build();
    }

    @Test
    public void cartIsReachableThroughTheFilter() {
        given()
            .spec(spec)
        .when()
            .get("/cart")
        .then()
            .statusCode(200)
            .body("userId", equalTo(1));
    }

    @Test
    public void explicitHeaderWins() {
        given()
            .spec(spec)
            .header("Authorization", "Bearer not-a-real-token")
        .when()
            .get("/cart")
        .then()
            .statusCode(401)
            .body("error.code", equalTo("UNAUTHORIZED"));
    }
}
`,
  checks: [
    { label: 'Implements the Filter interface', pattern: 'class\\s+\\w+\\s+implements\\s+Filter\\b', hint: 'public static class BearerTokenFilter implements Filter { ... }' },
    { label: 'Only adds the header when it is missing', pattern: 'hasHeaderWithName\\(\\s*"Authorization"\\s*\\)', hint: 'if (!requestSpec.getHeaders().hasHeaderWithName("Authorization")) { ... }' },
    { label: 'Adds the Bearer header in the filter', pattern: '\\.header\\(\\s*"Authorization"\\s*,\\s*"Bearer "\\s*\\+', hint: 'requestSpec.header("Authorization", "Bearer " + token);' },
    { label: 'Passes the request on with ctx.next', pattern: '\\.next\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)', hint: 'return ctx.next(requestSpec, responseSpec);' },
    { label: 'Registers the filter on the spec', pattern: '(addFilter|\\.filter)\\(\\s*new\\s+BearerTokenFilter\\(', hint: '.addFilter(new BearerTokenFilter(token))' },
    { label: 'Masks the Authorization header in logs', pattern: 'blacklistHeader\\(\\s*"Authorization"\\s*\\)', hint: 'LogConfig.logConfig().blacklistHeader("Authorization")' },
    { label: 'No oauth2() or log().all() in tests', pattern: '(\\.auth\\(\\)\\s*\\.oauth2\\(|\\.log\\(\\)\\s*\\.all\\(\\))', mustNot: true, hint: 'The filter adds the token; logging is configured once in the spec.' },
  ],
  hints: [
    'A filter gets the request before it is sent; ctx.next(...) sends it and returns the Response — so you can act before AND after.',
    'Check for an existing header first, otherwise every negative test with a bad token would be "fixed" by the filter.',
    'LogConfig.logConfig().blacklistHeader("Authorization") prints the header as [ BLACKLISTED ] in every log.',
  ],
  explanation: `A **filter** is middleware around every request that uses the spec: RestAssured calls
\`filter(request, response, ctx)\`, you may change the request, and \`ctx.next(...)\` passes it on (to the next filter,
then the HTTP call) and returns the \`Response\`. Code before \`next\` runs before sending, code after it sees the response.

Typical filters in a framework:

| Filter | Job |
|---|---|
| auth filter (this one) | add or refresh the token |
| correlation-id filter | add \`X-Correlation-Id: <uuid>\` so server logs can be matched to a test |
| \`ErrorLoggingFilter\` / \`ResponseLoggingFilter\` | built-in logging, e.g. only 4xx/5xx responses |
| \`AllureRestAssured\` | attach every request/response to the Allure report |

The **"only if missing"** check is the design detail a reviewer looks for: a filter that always overwrites the header
would make the 401 test impossible, because it would silently replace the deliberately bad token.

\`blacklistHeader("Authorization")\` makes RestAssured print \`Authorization: [ BLACKLISTED ]\` in every request log, and
\`enableLoggingOfRequestAndResponseIfValidationFails()\` keeps the console quiet until something fails — then you get the
full request and response, minus the secret.`,
  mistakes: [
    'Forgetting to return ctx.next(...) — the request is never sent and the test gets a null response.',
    'Overwriting an Authorization header the test set on purpose, so negative auth tests can no longer fail correctly.',
    'Logging everything with log().all() in CI and leaking tokens or personal data into build logs.',
    'Putting test-specific assertions inside a filter — filters should prepare, record or log, not decide pass/fail.',
  ],
  interview: [
    { q: 'What is a filter in RestAssured and what have you used it for?', a: 'A Filter intercepts every request/response of a spec: it can modify the request before sending and inspect the response after ctx.next(). I have used filters for auth tokens, correlation ids, masked logging, Allure attachments and recording traffic for failure evidence.' },
    { q: 'How do you avoid secrets in API test logs?', a: 'Log only on failure (log().ifValidationFails() or LogConfig), blacklist sensitive headers like Authorization and Cookie, avoid logging request bodies that contain passwords, and keep real secrets in CI variables rather than in code or config files.' },
  ],
}
