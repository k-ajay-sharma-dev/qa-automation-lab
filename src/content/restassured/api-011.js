export default {
  id: 'api-011',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Request/response specifications, logging and a response-time SLA',
  level: 'INTERMEDIATE',
  tags: ['RequestSpecBuilder', 'ResponseSpecBuilder', 'logging', 'response-time'],
  estMinutes: 30,
  scenario: `The API suite has grown to 60 tests and every single one starts with \`.baseUri("http://localhost:5181")\`,
\`.contentType(JSON)\` and ends with \`.statusCode(200).contentType(JSON)\`. Moving the suite to the staging server meant
editing 60 files. On top of that, when a test fails in Jenkins the log shows only "expected 200 but was 500" — no
request, no response. And the product owner has a new non-functional requirement: catalogue calls must answer in
under 1.5 seconds.`,
  description: `Refactor \`CatalogueSpecTest\`:

1. In \`@BeforeClass\`, build a **request specification** with \`RequestSpecBuilder\`: base URI \`http://localhost:5181\`,
   base path \`/api\`, JSON content type and accept header.
2. Build a **response specification** with \`ResponseSpecBuilder\`: status 200, JSON content type, and response time
   below **1500 ms** (\`expectResponseTime(lessThan(1500L), TimeUnit.MILLISECONDS)\`).
3. Turn on logging of request and response **only when a validation fails**
   (\`RestAssured.enableLoggingOfRequestAndResponseIfValidationFails()\` or \`.log().ifValidationFails()\`).
4. Use the specs in the tests with \`.spec(requestSpec)\` and \`.then().spec(okJson)\`.
5. Add **slowEndpointIsMeasured**: \`GET /slow?ms=1200\` and assert \`.time(greaterThanOrEqualTo(1200L))\` — proof that
   your timing assertion really measures.

**Rules**
- No \`.baseUri(...)\` inside the test methods.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueSpecTest {

    @Test
    public void listProducts() {
        given().baseUri("http://localhost:5181").contentType(ContentType.JSON)
        .when().get("/api/products")
        .then().statusCode(200).contentType(ContentType.JSON)
            .body("total", equalTo(6));
    }

    @Test
    public void productDetails() {
        given().baseUri("http://localhost:5181").contentType(ContentType.JSON)
        .when().get("/api/products/2")
        .then().statusCode(200).contentType(ContentType.JSON)
            .body("name", equalTo("Pulse Bike Light"));
    }

    // TODO: specs in @BeforeClass, logging on failure, response-time SLA, slow endpoint test
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.concurrent.TimeUnit;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueSpecTest {

    private RequestSpecification requestSpec;
    private ResponseSpecification okJson;

    @BeforeClass
    public void buildSpecs() {
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();

        requestSpec = new RequestSpecBuilder()
            .setBaseUri("http://localhost:5181")
            .setBasePath("/api")
            .setContentType(ContentType.JSON)
            .setAccept(ContentType.JSON)
            .build();

        okJson = new ResponseSpecBuilder()
            .expectStatusCode(200)
            .expectContentType(ContentType.JSON)
            .expectResponseTime(lessThan(1500L), TimeUnit.MILLISECONDS)
            .build();
    }

    @Test
    public void listProducts() {
        given()
            .spec(requestSpec)
        .when()
            .get("/products")
        .then()
            .spec(okJson)
            .body("total", equalTo(6));
    }

    @Test
    public void productDetails() {
        given()
            .spec(requestSpec)
        .when()
            .get("/products/{id}", 2)
        .then()
            .spec(okJson)
            .body("name", equalTo("Pulse Bike Light"));
    }

    @Test
    public void slowEndpointIsMeasured() {
        given()
            .spec(requestSpec)
            .queryParam("ms", 1200)
        .when()
            .get("/slow")
        .then()
            .statusCode(200)
            .time(greaterThanOrEqualTo(1200L), TimeUnit.MILLISECONDS)
            .body("delayedMs", equalTo(1200));
    }
}
`,
  checks: [
    { label: 'Builds a RequestSpecBuilder', pattern: 'new\\s+RequestSpecBuilder\\(\\)', hint: 'requestSpec = new RequestSpecBuilder().setBaseUri(...).build();' },
    { label: 'Builds a ResponseSpecBuilder', pattern: 'new\\s+ResponseSpecBuilder\\(\\)', hint: 'okJson = new ResponseSpecBuilder().expectStatusCode(200)...build();' },
    { label: 'Response-time SLA under 1500 ms', pattern: '(expectResponseTime|\\.time)\\(\\s*lessThan\\(\\s*1500L?\\s*\\)', hint: '.expectResponseTime(lessThan(1500L), TimeUnit.MILLISECONDS)' },
    { label: 'Logs only when validation fails', pattern: '(enableLoggingOfRequestAndResponseIfValidationFails|log\\(\\)\\s*\\.ifValidationFails)', hint: 'RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();' },
    { label: 'Uses the specs in tests', pattern: '\\.spec\\(\\s*requestSpec\\s*\\)[\\s\\S]*\\.then\\(\\)\\s*\\.spec\\(', hint: 'given().spec(requestSpec) ... .then().spec(okJson)' },
    { label: 'No baseUri in the tests', pattern: '\\.baseUri\\(', mustNot: true, hint: 'The base URI lives in the request spec (setBaseUri).' },
    { label: 'Measures the slow endpoint', pattern: '\\.time\\(\\s*greaterThanOrEqualTo\\(', hint: '.time(greaterThanOrEqualTo(1200L), TimeUnit.MILLISECONDS)' },
  ],
  hints: [
    'Specs are built once (e.g. in @BeforeClass) and plugged in with .spec(...).',
    'Response time values are long — use 1500L, not 1500.',
    'In a framework, the base URI comes from a config file, not a literal.',
  ],
  explanation: `**Specifications** are reusable chunks of given() and then():

- \`RequestSpecBuilder\` → base URI, base path, headers, content type, auth, filters. Change the environment in one place.
- \`ResponseSpecBuilder\` → the checks every "happy" response shares: 200, JSON, response time.

**Logging if validation fails** prints the full request and response only for failing tests — Jenkins logs stay small,
but a failure shows exactly what was sent and received. \`.log().all()\` on every call drowns the useful lines.

**Response time**: \`expectResponseTime\` / \`.time(...)\` measure the round trip as seen by the test machine. Treat them as
a smoke-level SLA guard (catching a 10× regression), not as a load test. Keep the threshold generous enough not to be
flaky on a busy CI agent. For **timeouts** (stop waiting after N seconds) configure the HTTP client via
\`RestAssuredConfig\` — a hanging call should fail the test, not the whole pipeline.`,
  mistakes: [
    'Turning on .log().all() everywhere — huge logs where the failing request is hard to find.',
    'Setting response-time thresholds so tight (e.g. 200 ms) that they fail randomly on CI.',
    'Putting assertions specific to one test into the shared response spec.',
    'Using RestAssured.baseURI static fields and changing them inside tests — breaks parallel runs.',
  ],
  interview: [
    { q: 'What goes into your base request specification?', a: 'Base URI and path from config, content type/accept, common headers (correlation id, API version), auth if most calls need it, logging/reporting filters and number-parsing config. Tests add only what is specific to them.' },
    { q: 'Is RestAssured response time a performance test?', a: 'No. It measures one request from the test machine, so it is a functional guard against big regressions. Load and latency percentiles belong in JMeter, Gatling or k6.' },
  ],
}
