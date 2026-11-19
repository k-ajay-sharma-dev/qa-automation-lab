export default {
  id: 'api-033',
  category: 'restassured',
  kind: 'quiz',
  title: 'given / when / then: what belongs in each part',
  level: 'BEGINNER',
  tags: ['given-when-then', 'restassured-basics', 'bdd-syntax', 'logging'],
  estMinutes: 10,
  scenario: `Your first RestAssured pull request comes back with three review comments: "the header belongs in given()",
"why is the status check before the call?" and "log the request, not the response, here". You have written Gherkin
Given/When/Then for years, so the words look familiar, but in RestAssured they are Java methods with a fixed job each.
Before you fix the PR, make sure you know which part holds what.`,
  description: `Answer the questions about RestAssured's \`given() / when() / then()\` chain against the ShopEasy API on
\`http://localhost:5181\`.

**Remember:** \`given()\` builds the request, \`when()\` sends it, \`then()\` checks the response.`,
  questions: [
    {
      q: `You need to call \`GET /api/cart\` as standard_user. Where do \`baseUri\`, the \`Authorization\` header and \`accept(ContentType.JSON)\` go?`,
      options: [
        'In when(), because they are part of sending the request',
        'In given(), because they describe the request before it is sent',
        'In then(), so they are checked against the response',
        'Anywhere — RestAssured re-orders the chain itself',
      ],
      answer: 1,
      why: `\`given()\` returns a **RequestSpecification**: everything that shapes the request (base URI, headers, auth, query/path params, body, content type, request logging) is set there. \`when()\` only fires the HTTP method, and \`then()\` returns a **ValidatableResponse** that has no methods to add request headers.`,
    },
    {
      q: `What does the \`when()\` part of this chain actually hold?

\`\`\`java
given().baseUri("http://localhost:5181")
.when().get("/api/products/{id}", 3)
.then().statusCode(200);
\`\`\``,
      options: [
        'The HTTP method and the path (here GET /api/products/3) — this is where the request is sent',
        'The expected status code',
        'The test data for product 3',
        'Nothing, it is only a comment for the reader',
      ],
      answer: 0,
      why: `The method call after \`when()\` — \`get\`, \`post\`, \`put\`, \`patch\`, \`delete\` — is the **action**: it sends the request and returns the **Response**. \`when()\` itself is syntactic sugar that returns the same spec, which is why \`given().get(...)\` also works. Expectations belong in \`then()\`.`,
    },
    {
      q: `In this test the status check fails with 401. What happens to the \`extract()\` line?

\`\`\`java
int orderId = given().spec(authSpec).body(order)
    .when().post("/api/orders")
    .then().statusCode(201)
    .extract().path("id");
\`\`\``,
      options: [
        'It still runs and returns null',
        'It still runs and returns 0',
        'It never runs: statusCode(201) throws an AssertionError and the test fails right there',
        'RestAssured retries the request until it gets 201',
      ],
      answer: 2,
      why: `\`then()\` assertions run in order and throw as soon as one fails, so the test stops at \`statusCode(201)\` with a message like "Expected status code <201> but was <401>". That is exactly what you want: the failure points at the real problem (no/expired token) instead of a NullPointerException three lines later.`,
    },
    {
      q: 'A reviewer asks you to "log the request only when debugging, and the response only when a check fails". Which chain does that?',
      options: [
        '`given().log().ifValidationFails() ... then().log().all()`',
        '`given().log().all() ... then().log().ifValidationFails()`',
        '`when().log().all() ... then().log().all()`',
        '`then().log().all()` alone logs both',
      ],
      answer: 1,
      why: `\`log()\` on the **given** side logs the request (\`all()\`, \`headers()\`, \`body()\`...); \`log()\` on the **then** side logs the response. \`then().log().ifValidationFails()\` keeps CI output clean and only prints the response when an assertion breaks. (\`given().log().ifValidationFails()\` exists too, but it is the request side.)`,
    },
    {
      q: 'Which statement about given/when/then in RestAssured is true?',
      options: [
        'It is Gherkin, so it needs a .feature file and Cucumber to run',
        'You must always call all three, or the request is not sent',
        'It is a fluent Java API borrowed from BDD wording; when() is optional sugar and the request is sent by the HTTP method call',
        'then() sends the request again to verify it',
      ],
      answer: 2,
      why: `RestAssured only **borrows the words** from BDD to make tests read like a specification; it is plain Java and runs in TestNG/JUnit with no feature files. Leaving out \`when()\` (\`given().get(...)\`) changes nothing, and \`then()\` validates the response you already received — it never resends.`,
    },
  ],
  hints: [
    'given = the request you are about to send (headers, params, body, auth).',
    'when = the HTTP method call that sends it.',
    'then = assertions and extraction on the response that came back.',
  ],
  explanation: `| Part | Returns | Holds |
|---|---|---|
| \`given()\` | RequestSpecification | baseUri, headers, auth, params, body, contentType, request logging, \`spec(...)\` |
| \`when()\` + \`get/post/...\` | Response | the method and path — the request is sent here |
| \`then()\` | ValidatableResponse | statusCode, header and body matchers, response logging, \`extract()\` |

Read it like a test case: **precondition / action / expected result** — the same structure you have always written in
manual test cases. A reviewer looks for nothing request-related after \`then()\` and nothing assertion-related before it.`,
  mistakes: [
    'Thinking given/when/then needs Cucumber — it is a plain Java fluent API.',
    'Extracting a value before checking the status, then debugging a NullPointerException instead of a clear 401.',
    'Logging everything on every run with then().log().all(), so CI logs become unreadable.',
  ],
  interview: [
    { q: 'What does each part of given/when/then return in RestAssured?', a: 'given() returns a RequestSpecification, the HTTP call after when() returns a Response, and then() returns a ValidatableResponse. That is why request settings cannot be added after then() and assertions cannot be made before the call.' },
    { q: 'Is when() required?', a: 'No. It returns the same specification and only exists for readability, so given().get("/api/health") works. Teams keep it because the test reads like precondition, action, expected result.' },
  ],
}
