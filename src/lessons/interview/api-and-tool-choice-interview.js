export default {
  slug: 'api-and-tool-choice-interview',
  category: 'interview',
  order: 7,
  title: 'API and tool-choice questions: HTTP, RestAssured, Selenium vs Playwright',
  minutes: 10,
  summary: 'Answer HTTP and RestAssured questions with correct vocabulary, write a small authenticated API test under pressure, and compare Selenium and Playwright without bias.',
  manualAnalogy: `If you have tested APIs in Postman you already know what a 404 looks like and that a token goes in a header.
Interviews ask you to name what you have seen - "that was a 403, not a 401", "PATCH, because we only sent one
field" - and to choose tools the way you would choose a test approach: by risk and context, not by fashion.`,
  body: `## HTTP vocabulary you must get exactly right

| Question | Answer to give |
|---|---|
| 401 vs 403 | **401** = not authenticated (no or invalid token). **403** = authenticated but not allowed (someone else's resource, a locked account). |
| 200 / 201 / 204 | 200 OK with a body; **201 Created** for a POST that creates something (often with a \`Location\` header); 204 No Content, typical for DELETE. |
| 400 / 409 / 422 | 400 malformed or failed validation; 409 conflicts with current state (already exists); 422 well-formed but breaks a business rule. |
| PUT vs PATCH | PUT **replaces** the whole resource - send every field. PATCH **partially updates** - send only what changes. |
| Idempotent | Repeating the request leaves the server in the same state: GET, PUT, DELETE yes; **POST no** (two POSTs = two records). |

On the ShopEasy practice API (\`http://localhost:5181/api\`) you can see all of these: \`GET /api/cart\` without a
token returns 401; a PATCH on your own user with just a phone number returns 200, while a PUT with the same body
returns 400 because the other fields are missing.

## The shape of a RestAssured test

\`\`\`java
given()                                   // request: auth, headers, params, body
    .auth().oauth2(token)
    .queryParam("sort", "price_desc")
.when()                                   // action: method + path
    .get("/products")
.then()                                   // checks: status, headers, body
    .statusCode(200)
    .body("data[0].name", equalTo("Storm Fleece Jacket"));
\`\`\`

- \`given\` / \`when\` / \`then\` mirror Gherkin, which makes the test read like a specification.
- \`body("data[0].name", ...)\` uses a **GPath** expression to point into the JSON - a dot for fields, \`[0]\` for
  the first array element.
- \`RestAssured.baseURI\` and \`basePath\` are set once (or in a \`RequestSpecification\`), so tests only contain
  the path.

**Tokens are never copied into the code.** A setup method logs in, then pulls the token out of the response with
\`.extract().path("token")\` and keeps it in a field. Copied tokens expire; dynamic ones work after every restart.

**Schema vs values.** A JSON Schema check (\`matchesJsonSchemaInClasspath(...)\`, from the json-schema-validator
module) proves the **shape** - required fields, types, no unexpected properties. It does not prove the price is
right, so keep a few \`body()\` value checks as well.

A small gotcha worth mentioning: RestAssured reads JSON decimals such as \`9.99\` as \`Float\` by default, so compare
with \`equalTo(9.99f)\` or configure BigDecimal for money.

## Selenium vs Playwright without picking a side

**How they talk to the browser.** Selenium turns each command into a **W3C WebDriver** HTTP request to a browser
driver (chromedriver, geckodriver, safaridriver). Playwright keeps one **WebSocket** connection open to the browser
- Chrome DevTools Protocol for Chromium, its own protocol for its patched Firefox and WebKit builds. Selenium is
adding the standard bidirectional **WebDriver BiDi** protocol to get similar event streaming.

**How they wait.** Playwright auto-waits before actions (element attached, visible, stable, enabled) and its
\`expect(...)\` assertions retry. Selenium gives you building blocks - \`WebDriverWait\` and \`ExpectedConditions\` -
that a good framework wraps in BasePage helpers (see the *Waits, flaky tests and Selenium's limits* lesson).

**How they isolate tests.** Playwright creates cheap **browser contexts** (incognito-like sessions) per test and can
reuse a saved login with \`storageState\`. Selenium isolates with a new driver session per test and \`ThreadLocal\`
for parallel runs.

**How to answer "which would you choose?"** Context first:

- Existing Java framework, Java team, Selenium Grid, real Safari or a vendor cloud -> Selenium; improve what exists.
- New TypeScript team, modern single-page app, wants traces, network mocking and a built-in runner -> Playwright.
- Either way, the same principles: page objects, explicit expectations, independent data, API setup, a thin UI layer.

Never call either tool "dead" or "slow" - the interviewer's company may use it.`,
  keyPoints: [
    '401 = not authenticated, 403 = not allowed; POST creates -> 201; DELETE -> 204.',
    'PUT replaces, PATCH partially updates; GET/PUT/DELETE are idempotent, POST is not.',
    'RestAssured: given (request) / when (method + path) / then (status + body); extract the token, never hard-code it.',
    'Schema validation checks the shape; body matchers check the values - use both.',
    'Selenium = W3C WebDriver over HTTP + explicit waits; Playwright = WebSocket (CDP/own protocol) + auto-waiting + contexts. Choose by context.',
  ],
  mistakes: [
    'Saying 401 means "forbidden". Fix: 401 is unauthenticated, 403 is forbidden.',
    'Hard-coding a token copied from Postman. Fix: log in in a setup method and extract the token.',
    'Expecting 200 from every successful POST. Fix: creation returns 201.',
    'Declaring one tool "better" in general. Fix: compare protocol, waiting, isolation and team context.',
  ],
  tryIt: `Start the API (npm run api) and, in Postman or curl, call GET http://localhost:5181/api/cart once without a token
and once with "Authorization: Bearer abc". Note both status codes and the WWW-Authenticate header - then explain the
difference to 403 in one sentence.`,
  problems: ['int-020', 'int-023', 'int-024'],
}
