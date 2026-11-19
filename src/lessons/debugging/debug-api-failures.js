export default {
  slug: 'debug-api-failures',
  category: 'debugging',
  order: 8,
  title: 'API test failures: status codes, tokens, JSON paths and POJOs',
  minutes: 9,
  summary: 'Debug a red RestAssured test from its request/response log: tell 401 from 403 from 415, find a null token or a wrong JSON path, and fix deserialisation and null-vs-empty surprises.',
  manualAnalogy: `When you test an API by hand in Postman you look at three things before judging: what you sent (URL, headers, body), the status code, and the response body. A failing RestAssured test deserves exactly the same look — the difference is that you must ask the test to show you the request, because by default it only tells you the status it didn't like.`,
  body: `## Step 1: make the test show you the conversation

\`\`\`java
given()
    .log().ifValidationFails()        // print the request only when something fails
    .baseUri("http://localhost:5181")
.when()
    .get("/api/orders")
.then()
    .log().ifValidationFails()        // and the response
    .statusCode(200);
\`\`\`

\`log().ifValidationFails()\` costs nothing on green runs and turns *"Expected status code <200> but was <401>"* into a full picture: method, URI, **headers**, body, and the server's error JSON. ShopEasy's errors always look like \`{"error": {"code": "...", "message": "...", "details": [...]}}\` — the \`code\` is usually the diagnosis.

## Step 2: read the status code family

| Status | Means | First thing to check |
|---|---|---|
| 400 | Request is malformed / fails validation | \`details\` array: which field, what rule |
| 401 | Not authenticated | The **request's** \`Authorization\` header: missing, \`Bearer null\`, expired, from another environment |
| 403 | Authenticated, not allowed | Which user the token belongs to (another customer's order, a locked user) |
| 404 | Resource or route doesn't exist | Path, id, base URI, data was reset/deleted |
| 405 | Wrong HTTP method for that route | GET vs POST in the client code |
| 409 | Conflicts with current state | Left-over data from an earlier test |
| 415 | Server can't read that body type | The \`Content-Type\` the request actually sent |
| 422 | Understood but breaks a business rule | Quantity, stock, e-mail format |
| 5xx | Server crashed | A product bug or an environment problem — never a test fix |

A 401 with \`Authorization=Bearer null\` in the log is a **test bug**: the code that should have produced a token produced \`null\`.

## Step 3: JSON path returns null — it does not throw

RestAssured's \`path(...)\` and \`jsonPath().get(...)\` are forgiving:

\`\`\`java
Response r = given().baseUri(BASE).get("/api/users/3");
String city = r.path("address.city");      // "San Francisco"
String town = r.path("address.town");      // null - no such field, no error!
String first = r.path("roles[5]");         // null - index out of range, no error!
\`\`\`

So a typo or a renamed field surfaces *later*, as a \`NullPointerException\` or a 401 on the next call. Defend at the source: assert what you extract (\`.body("token", notNullValue())\`), and assert on **collections** (\`hasSize\`, \`hasItem\`, \`not(empty())\`) before you index into them. An empty list (\`[]\`) is a perfectly valid 200 response — "no results" is data, not an error.

## Step 4: deserialisation errors

Mapping a response to a class (\`.as(User.class)\`) uses Jackson. Typical messages:

\`\`\`text
UnrecognizedPropertyException: Unrecognized field "roles" (class com.shopeasy.api.model.User),
not marked as ignorable (6 known properties: "id", "username", ...])
MismatchedInputException: Cannot deserialize value of type 'int' from String "abc"
InvalidDefinitionException: Cannot construct instance of 'User' (no Creators, like default constructor, exist)
\`\`\`

- *Unrecognized field* — the JSON has a field your class doesn't. Add it if you need it; mark response classes \`@JsonIgnoreProperties(ignoreUnknown = true)\` so additive API changes don't break unrelated tests; guard the contract with a separate JSON-schema test.
- *Mismatched input* — wrong Java type (\`int\` vs string, object vs array).
- *No Creators* — the class needs a no-argument constructor (or a record / \`@JsonCreator\`).

Money: RestAssured's JsonPath returns \`Float\` for decimals by default. Read money as a String into \`BigDecimal\`.

## Step 5: content type problems (415 and friends)

\`\`\`text
HTTP/1.1 415 Unsupported Media Type
{"error":{"code":"UNSUPPORTED_MEDIA_TYPE","message":"Avatar upload must be multipart/form-data, got \\"application/json\\""}}
\`\`\`

The server tells you what it got. Usual causes: a shared request specification that forces \`ContentType.JSON\` onto every request, including file uploads; or a body sent as a plain String with no content type at all.

## Step 6: environment-flavoured API failures

\`ConnectException: Connection refused\` (API not running / wrong port), a 404 \`ROUTE_NOT_FOUND\` on every call (wrong base path or version), and timestamps or money that only fail on one agent (time zone and locale — see the *Environment failures* lesson). These are not product verdicts.`,
  keyPoints: [
    'Always log the request and response on failure: `log().ifValidationFails()` on both sides.',
    'Read the status family first: 401 = who are you, 403 = not allowed, 409 = state conflict, 415 = body type.',
    'JSON path returns null for missing fields and out-of-range indexes — assert what you extract.',
    'Assert on collections before indexing; an empty list is a valid answer.',
    'UnrecognizedPropertyException = JSON has a field the POJO lacks; tolerate unknowns and test the contract separately.',
  ],
  mistakes: [
    'Looking only at the status code and never at the request headers that were sent.',
    'Extracting values without asserting the response they came from.',
    'Raising a backend defect for an additive change that broke a too-strict POJO.',
    'Using float/double for prices read from JSON.',
  ],
  tryIt: `Start the API (\`npm run api\`) and call \`GET http://localhost:5181/api/cart\` three ways in Postman or curl: with no Authorization header, with \`Bearer null\`, and with a token from \`POST /api/auth/login\`. Compare the two 401 messages — that difference is how you'll recognise a "null token" bug in a log.`,
  problems: ['dbg-017', 'dbg-023', 'dbg-024', 'dbg-032', 'dbg-038'],
}
