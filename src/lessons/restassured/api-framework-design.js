export default {
  slug: 'api-framework-design',
  category: 'restassured',
  order: 6,
  title: 'From tests to a framework: specifications, logging, response time and layers',
  minutes: 10,
  summary: 'Remove repetition with RequestSpecBuilder / ResponseSpecBuilder, log smartly, assert response-time SLAs, and organise an API framework into config, specs, clients, POJOs and tests.',
  manualAnalogy: `In Postman you stop retyping the host and token once you discover **environments** and **collection-level auth**. A request specification is exactly that: the shared setup every request inherits. The framework layers are like a well-organised test plan — environment details in one place, test steps in another, test data in a third.`,
  body: `## The repetition problem

After a week, every test starts with the same five lines: base URI, content type, accept, token, logging. Change the host or the auth scheme and you edit 80 files.

## RequestSpecBuilder: shared setup

\`\`\`java
RequestSpecification base = new RequestSpecBuilder()
    .setBaseUri(Config.get("api.baseUri"))     // http://localhost:5181
    .setBasePath("/api")
    .setContentType(ContentType.JSON)
    .setAccept(ContentType.JSON)
    .addFilter(new RequestLoggingFilter(LogDetail.METHOD))
    .build();

given().spec(base)
.when().get("/products/2")
.then().statusCode(200);
\`\`\`

- \`setBasePath("/api")\` means tests write \`/products/2\`, not \`/api/products/2\`.
- \`given().spec(base)\` applies everything; you can still add more after it (\`.queryParam(...)\`).
- Build an authenticated spec on top: \`new RequestSpecBuilder().addRequestSpecification(base).addHeader("Authorization", "Bearer " + token).build()\`.

## ResponseSpecBuilder: shared expectations

\`\`\`java
ResponseSpecification okJson = new ResponseSpecBuilder()
    .expectStatusCode(200)
    .expectContentType(ContentType.JSON)
    .expectHeader("X-Request-Id", notNullValue())
    .build();

given().spec(base).when().get("/health").then().spec(okJson).body("status", equalTo("UP"));
\`\`\`

Make one for errors too (\`expectBody("error.code", notNullValue())\`) so every negative test checks the error contract for free.

## Logging without drowning

| Call | When |
|---|---|
| \`log().all()\` | debugging a single test locally |
| \`log().ifValidationFails()\` | default for CI — clean logs, full details on failure |
| \`log().ifError()\` | log any 4xx/5xx response |
| \`RestAssured.enableLoggingOfRequestAndResponseIfValidationFails()\` | switch it on globally |

Never log real passwords or production tokens into CI output; use \`LogConfig.logConfig().blacklistHeader("Authorization")\` to mask the header.

## Filters: code that runs around every request

The \`RequestLoggingFilter\` above is one example of a **filter**. You can write your own by implementing \`io.restassured.filter.Filter\`:

\`\`\`java
public class CorrelationIdFilter implements Filter {
    @Override
    public Response filter(FilterableRequestSpecification req,
                           FilterableResponseSpecification res,
                           FilterContext ctx) {
        req.header("X-Correlation-Id", "test-" + UUID.randomUUID());   // before sending
        Response response = ctx.next(req, res);                          // send it
        if (response.statusCode() >= 500) {                              // after: look at the answer
            System.out.println("Server error for " + req.getURI());
        }
        return response;
    }
}
\`\`\`

- Everything **before** \`ctx.next(...)\` changes the request; everything **after** it sees the response. Always return the response.
- Register it once: \`new RequestSpecBuilder().addFilter(new CorrelationIdFilter())\` — every test using the spec gets it for free.
- Common uses: adding or refreshing a token, correlation ids, masked logging, recording traffic for the report (\`AllureRestAssured\` is a ready-made filter).
- A filter that adds a header should leave alone a header the test set on purpose (check \`req.getHeaders().hasHeaderWithName(...)\` first) — otherwise negative tests with a bad token become impossible.
- Filters prepare and record; they should not decide pass or fail. Assertions stay in the tests.

## Response-time assertions

Non-functional checks fit naturally:

\`\`\`java
given().spec(base)
.when().get("/products")
.then().time(lessThan(800L), TimeUnit.MILLISECONDS);
\`\`\`

\`time(...)\` measures the full round trip as seen by the client. Use a generous SLA (the build machine is slower than prod) and keep it in config. This is a **smoke** for performance regressions, not a load test — use JMeter, Gatling or k6 for that.

Separate from asserting the time is protecting the suite from a hung server. Set client timeouts so a test fails fast instead of waiting forever:

\`\`\`java
RestAssured.config = RestAssured.config().httpClient(HttpClientConfig.httpClientConfig()
    .setParam("http.connection.timeout", 5000)
    .setParam("http.socket.timeout", 5000));
\`\`\`

The practice API has \`GET /api/slow?ms=1500\` so you can see both: a time assertion that fails, and a socket timeout that throws.

Why timing checks go flaky, and what to do about it:
- \`time()\` includes everything the client sees — connection setup, a busy CI agent, the network — not just server work.
- The **first** call of a run is slower (connections, caches, JIT). Warm up with an unmeasured call, e.g. the health check that runs first anyway.
- A time assertion only runs *after* the response arrives; it cannot stop a hang. That is the timeout's job.
- Retrying failed timing checks hides real slowdowns. If you want trends, record \`response.timeIn(TimeUnit.MILLISECONDS)\` into the report and keep the assertion a coarse ceiling.

## The layers of an API framework

\`\`\`
src/test/java/com/shopeasy/api/
├── config/     Config.java          ← reads qa.properties / -Denv / -D overrides
├── specs/      Specs.java           ← base, auth and error specifications
├── auth/       AuthClient.java      ← login + token cache
├── clients/    ProductsClient, CartClient, OrdersClient  ← one class per resource
├── models/     OrderRequest, Order, Product, ApiError    ← POJOs
├── tests/      (TestNG) or steps/ (Cucumber)              ← the WHAT
src/test/resources/
├── config/qa.properties
├── schemas/product.schema.json
└── features/*.feature
\`\`\`

A **client** (also called service or endpoint class) hides HTTP details behind business methods:

\`\`\`java
public class CartClient {
    private final RequestSpecification spec;
    public CartClient(String token) { this.spec = Specs.authed(token); }

    public Response add(int productId, int qty) {
        return given().spec(spec).body(new CartItemRequest(productId, qty)).post("/cart/items");
    }
    public Response get() { return given().spec(spec).get("/cart"); }
}
\`\`\`

Return the \`Response\` (not just a POJO) so tests can assert status codes for negative cases. Tests then read like the business flow: \`cart.add(5, 2)\` → assert 201. This is the API equivalent of the Page Object Model.

## Reporting and other framework concerns

- **Reporting**: Allure (\`AllureRestAssured\` filter attaches every request/response to the report) or Extent / Cucumber HTML.
- **Config per environment**: \`-Denv=staging\`, secrets from CI variables, never committed.
- **Test data**: create what you need via the API, clean up afterwards, unique values (timestamps/UUIDs) for parallel runs.
- **Parallel**: RestAssured's static \`RestAssured.baseURI\` etc. are global — prefer specs passed into clients, and keep per-test state (token, response) out of static fields.`,
  keyPoints: [
    'RequestSpecBuilder holds shared setup (base URI/path, content type, auth, filters); apply with given().spec(...).',
    'ResponseSpecBuilder holds shared expectations; apply with then().spec(...).',
    'Use log().ifValidationFails() in CI and mask Authorization headers.',
    'then().time(lessThan(ms), MILLISECONDS) is a performance smoke; client timeouts stop hung tests.',
    'Layers: config → specs → auth → clients (one per resource) → POJOs → tests/steps, plus reporting.',
    'A custom Filter (implements Filter, ends with ctx.next) adds cross-cutting behaviour like tokens or correlation ids to every request.',
  ],
  mistakes: [
    'Copy-pasting base URI and headers into every test instead of a spec.',
    'Mutating static RestAssured settings inside tests — breaks parallel runs.',
    'Clients that assert internally and return only POJOs — negative tests can no longer check 4xx responses.',
    'Tight response-time limits copied from production SLAs, making CI flaky on slower agents.',
  ],
  tryIt: `Open http://localhost:5181/api/slow?ms=1200 in the browser and watch it wait. Then write down which parts of the request specification you would put in a "base" spec and which only in an "authed" spec for the cart and orders endpoints.`,
  problems: ['api-011', 'api-019', 'api-020', 'api-027', 'api-028'],
}
