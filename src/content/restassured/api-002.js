export default {
  id: 'api-002',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Your first RestAssured test: the health check',
  level: 'BEGINNER',
  tags: ['given-when-then', 'get', 'smoke'],
  estMinutes: 15,
  scenario: `Every morning the nightly UI suite fails for 40 minutes before anyone notices the backend was simply down.
Your lead asks for the smallest possible API smoke test that runs first in the pipeline: call the health endpoint and
fail fast with a clear message if the service is not up. A colleague wrote a version with plain Java HTTP code and
manual string checks — it is hard to read and never checks the content type.`,
  description: `Write a TestNG test with RestAssured for \`GET http://localhost:5181/api/health\`, which returns:

\`\`\`json
{ "status": "UP", "service": "shopeasy-api", "version": "1.0.0" }
\`\`\`

**Rules**
- Use the BDD style: \`given()\` … \`.when().get(...)\` … \`.then()\`.
- Set the base URI with \`baseUri(...)\` (or \`RestAssured.baseURI\`) — do not glue the host into every path.
- Assert the status code is **200** and the content type is **JSON**.
- Assert \`status\` equals \`"UP"\` and \`service\` equals \`"shopeasy-api"\` using \`body(...)\` with Hamcrest \`equalTo\`.
- No \`HttpURLConnection\` / manual string parsing.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import java.net.HttpURLConnection;
import java.net.URL;

public class HealthCheckTest {

    @Test
    public void serviceIsUp() throws Exception {
        // TODO: replace this with RestAssured given/when/then
        HttpURLConnection con = (HttpURLConnection) new URL("http://localhost:5181/api/health").openConnection();
        int code = con.getResponseCode();
        String body = new String(con.getInputStream().readAllBytes());
        if (code != 200 || !body.contains("UP")) {
            throw new AssertionError("Service is down: " + code);
        }
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class HealthCheckTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void serviceIsUp() {
        given()
            .baseUri(BASE_URI)
            .accept(ContentType.JSON)
        .when()
            .get("/api/health")
        .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("status", equalTo("UP"))
            .body("service", equalTo("shopeasy-api"));
    }
}
`,
  checks: [
    { label: 'Uses given() … when() … then()', pattern: 'given\\(\\)[\\s\\S]*\\.when\\(\\)[\\s\\S]*\\.then\\(\\)', hint: 'given().baseUri(...).when().get("/api/health").then()...' },
    { label: 'Sets a base URI', pattern: '(baseUri\\s*\\(|RestAssured\\.baseURI\\s*=)', hint: '.baseUri("http://localhost:5181")' },
    { label: 'Asserts status 200', pattern: '\\.statusCode\\(\\s*200\\s*\\)', hint: '.then().statusCode(200)' },
    { label: 'Asserts JSON content type', pattern: '\\.contentType\\(\\s*(ContentType\\.JSON|"application/json)', hint: '.contentType(ContentType.JSON)' },
    { label: 'Asserts status is UP with a matcher', pattern: '\\.body\\(\\s*"status"\\s*,\\s*equalTo\\(\\s*"UP"\\s*\\)', hint: '.body("status", equalTo("UP"))' },
    { label: 'No HttpURLConnection', pattern: 'HttpURLConnection', mustNot: true, hint: 'RestAssured does the HTTP for you.' },
  ],
  hints: [
    'Static imports keep it readable: import static io.restassured.RestAssured.given; and org.hamcrest.Matchers.equalTo.',
    'given() = setup (base URI, headers), when() = the call, then() = the assertions.',
    'body("status", equalTo("UP")) reads the JSON field "status" and compares it.',
  ],
  explanation: `RestAssured reads like a test case: **Given** a base URI and headers, **When** I GET \`/api/health\`, **Then** the
status is 200, the response is JSON and \`status\` is \`UP\`.

- \`baseUri\` keeps the host in one place — later you will move it to a config file and a request specification.
- \`.contentType(ContentType.JSON)\` matters: a proxy error page often comes back as HTML with status 200.
- \`body("status", equalTo("UP"))\` uses a JSON path on the left and a **Hamcrest matcher** on the right. If it fails,
  RestAssured prints the expected and actual value, which is far clearer than "Service is down: 200".

A reviewer also likes that the test has no \`throws Exception\` and no manual parsing — every line is an assertion.`,
  mistakes: [
    'Writing the full URL in get(...) in every test — the host changes per environment; use baseUri or a spec.',
    'Asserting body.contains("UP") on the raw string — "STATUS_UPDATE" would also pass.',
    'Forgetting the static imports and writing RestAssured.given() / Matchers.equalTo() everywhere (works, but noisy).',
    'Calling then() without any assertion — the test passes even when the API returns 500.',
  ],
  interview: [
    { q: 'What do given(), when() and then() each contain?', a: 'given() holds the request setup: base URI, headers, auth, params and body. when() holds the HTTP call (get/post/put/patch/delete). then() holds assertions on status, headers and body, or extract() to pull values out.' },
    { q: 'Why have a health-check test at all?', a: 'It fails fast with a clear cause when the environment is down, so the team does not waste time triaging hundreds of downstream failures. In CI it usually runs first and gates the rest of the suite.' },
  ],
}
