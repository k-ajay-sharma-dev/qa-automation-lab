export default {
  id: 'api-022',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Response headers: correlation id, CORS and the 405 Allow header',
  level: 'BEGINNER',
  tags: ['headers', 'cors', 'status-codes', 'triage'],
  estMinutes: 20,
  scenario: `Three header problems reached the team this quarter. Developers asked testers to paste the \`X-Request-Id\` into every
API bug report, but one release stopped sending it and nobody noticed for two weeks. A proxy change on staging dropped
the CORS header and the web shop could not load products in the browser, while Postman still "worked". And a partner
who called \`DELETE\` on a product got a 405 without the \`Allow\` header telling them which methods exist. All three are
part of the API contract, so your lead wants them asserted.`,
  description: `Write \`ResponseHeadersTest\` against \`http://localhost:5181\`:

1. **productResponseHasStandardHeaders** — \`GET /api/products/1\` → 200, and assert in \`then()\`:
   - \`Content-Type\` contains \`"charset=utf-8"\`
   - \`X-Request-Id\` matches the pattern \`req-\\d{5}\` (use Hamcrest \`matchesPattern\`)
   - \`Access-Control-Allow-Origin\` equals \`"*"\`
2. **requestIdIsUniquePerCall** — call \`GET /api/health\` twice, extract the \`X-Request-Id\` of each response
   (\`.extract().header("X-Request-Id")\`) and assert with TestNG that they are **not equal**.
3. **wrongMethodSaysWhatIsAllowed** — \`DELETE /api/products/1\` → **405**, header \`Allow\` equals \`"GET"\` and
   \`error.code\` is \`"METHOD_NOT_ALLOWED"\`.

**Rules**
- Assert headers with \`.header(name, matcher)\` in \`then()\` — no \`asString().contains(...)\` on the raw response.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ResponseHeadersTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productResponseHasStandardHeaders() {
        Response response = given().baseUri(BASE_URI).when().get("/api/products/1");
        // "I looked at the headers in Postman once, they were fine"
        Assert.assertTrue(response.getHeaders().toString().contains("X-Request-Id"));
    }

    // TODO: requestIdIsUniquePerCall, wrongMethodSaysWhatIsAllowed
}
`,
  solution: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ResponseHeadersTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productResponseHasStandardHeaders() {
        given()
            .baseUri(BASE_URI)
        .when()
            .get("/api/products/1")
        .then()
            .statusCode(200)
            .header("Content-Type", containsString("charset=utf-8"))
            .header("X-Request-Id", matchesPattern("req-\\\\d{5}"))
            .header("Access-Control-Allow-Origin", equalTo("*"));
    }

    @Test
    public void requestIdIsUniquePerCall() {
        String first = given().baseUri(BASE_URI)
            .when().get("/api/health")
            .then().statusCode(200)
            .extract().header("X-Request-Id");

        String second = given().baseUri(BASE_URI)
            .when().get("/api/health")
            .then().statusCode(200)
            .extract().header("X-Request-Id");

        Assert.assertNotNull(first, "X-Request-Id missing");
        Assert.assertNotEquals(second, first, "Two calls got the same correlation id");
    }

    @Test
    public void wrongMethodSaysWhatIsAllowed() {
        given()
            .baseUri(BASE_URI)
        .when()
            .delete("/api/products/{id}", 1)
        .then()
            .statusCode(405)
            .header("Allow", equalTo("GET"))
            .body("error.code", equalTo("METHOD_NOT_ALLOWED"));
    }
}
`,
  checks: [
    { label: 'Checks the charset in Content-Type', pattern: '\\.header\\(\\s*"Content-Type"\\s*,\\s*containsString\\(\\s*"charset=utf-8"', hint: '.header("Content-Type", containsString("charset=utf-8"))' },
    { label: 'X-Request-Id matches a pattern', pattern: '\\.header\\(\\s*"X-Request-Id"\\s*,\\s*matchesPattern\\(', hint: '.header("X-Request-Id", matchesPattern("req-\\\\d{5}"))' },
    { label: 'Checks the CORS header', pattern: '\\.header\\(\\s*"Access-Control-Allow-Origin"\\s*,', hint: '.header("Access-Control-Allow-Origin", equalTo("*"))' },
    { label: 'Extracts the request id', pattern: '(extract\\(\\)\\s*\\.header|\\.getHeader|\\.header)\\(\\s*"X-Request-Id"\\s*\\)', hint: 'String first = ... .extract().header("X-Request-Id");' },
    { label: 'Asserts the two ids differ', pattern: 'assertNotEquals\\(', hint: 'Assert.assertNotEquals(second, first)' },
    { label: '405 with an Allow header', pattern: 'statusCode\\(\\s*405\\s*\\)[\\s\\S]*\\.header\\(\\s*"Allow"\\s*,', hint: '.statusCode(405).header("Allow", equalTo("GET"))' },
  ],
  hints: [
    'In then(), .header("Name", matcher) works like .body(path, matcher) but for a response header. Header names are case-insensitive.',
    'Inside a Java string a regex backslash is doubled: "req-\\\\d{5}".',
    '.extract().header("X-Request-Id") returns the header value as a String.',
  ],
  explanation: `Headers are part of the contract even though nobody sees them on screen:

| Header | Why a tester cares |
|---|---|
| \`Content-Type: application/json; charset=utf-8\` | clients parse the body by it; a missing charset breaks names like "Café" |
| \`X-Request-Id\` | the correlation id that links your failing request to the server log — paste it into every defect |
| \`Access-Control-Allow-Origin\` | without it the **browser** blocks the web shop's calls (CORS), while Postman and RestAssured still work |
| \`Allow\` on a 405 | tells the client which methods the URL supports |

\`.header(name, matcher)\` gives the same clear failure messages as \`.body(...)\`. \`matchesPattern\` checks the **format**
of a value that changes every call — you can't use \`equalTo\` for a generated id, but you can insist it looks right.

The uniqueness test proves the id really identifies one request. If every response carried the same id, it would be
useless for triage, and \`notNullValue()\` alone would never notice.`,
  mistakes: [
    'Checking headers by searching response.getHeaders().toString() — a header named "X-Request-Id-Old" would pass.',
    'Asserting a generated value (request id, date) with equalTo — use a pattern or a relation (unique, not empty).',
    'Concluding "CORS works" because Postman or RestAssured succeed — CORS is enforced only by browsers; assert the header.',
    'Forgetting to double the backslash in a Java regex string ("req-\\d" does not compile).',
  ],
  interview: [
    { q: 'Which response headers do you assert in API tests?', a: 'Content-Type (and charset), Location after a 201, WWW-Authenticate on a 401, Allow on a 405, the correlation id, caching headers where relevant, and CORS headers for APIs that browsers call. Plus security headers if the team has a standard for them.' },
    { q: 'Why can an API pass all RestAssured tests but fail in the browser?', a: 'CORS. Browsers block cross-origin responses that lack Access-Control-Allow-Origin (and answer preflight OPTIONS requests); non-browser clients ignore it. So assert the CORS headers explicitly if a web front end calls the API.' },
  ],
}
