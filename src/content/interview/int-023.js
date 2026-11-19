export default {
  id: 'int-023',
  category: 'interview',
  kind: 'quiz',
  title: 'API interview questions: status codes, PUT vs PATCH, idempotency, auth and schemas',
  level: 'INTERMEDIATE',
  tags: ['api', 'restassured', 'http', 'status-codes', 'idempotency', 'json-schema'],
  estMinutes: 15,
  scenario: `Your CV says "API testing with RestAssured", so the interviewer opens the ShopEasy API (\`http://localhost:5181/api\`) and asks rapid-fire questions: *"401 or 403?"*, *"PUT or PATCH?"*, *"Which methods are idempotent?"*, *"How do you validate a schema?"*. Testers who used Postman for years often know the behaviour but stumble on the vocabulary — every answer below is tied to a real ShopEasy endpoint so you can say "for example…".`,
  description: `Answer using the ShopEasy API behaviour described in each question. The \`why\` gives you the one-sentence explanation interviewers expect.`,
  hints: [
    '401 = we don\'t know who you are; 403 = we know, and you\'re not allowed.',
    'Idempotent = sending the same request once or ten times leaves the server in the same state.',
  ],
  questions: [
    {
      q: 'Which pair of ShopEasy responses correctly shows the difference between **401** and **403**?',
      options: [
        '401 for a missing product, 403 for a server crash',
        '401 when `GET /api/cart` is called without a valid Bearer token; 403 when standard_user requests `GET /api/orders/{id}` of an order that belongs to visual_user (and when locked_out_user tries to log in)',
        'They are the same, the choice is random',
        '401 for invalid JSON, 403 for a wrong URL',
      ],
      answer: 1,
      why: '**401 Unauthorized** really means *unauthenticated*: no token or an invalid/expired one (ShopEasy also sends a `WWW-Authenticate: Bearer` header). **403 Forbidden** means the server knows who you are but you may not do this. Good negative tests cover both: no token → 401, someone else\'s order → 403.',
    },
    {
      q: 'standard_user (id 1) sends `PUT /api/users/1` with only `{"email": "asha.r@shopeasy.test"}`. ShopEasy answers **400 VALIDATION_FAILED** ("firstName is required for PUT"...). The same body with `PATCH` returns **200**. Why?',
      options: [
        'PATCH is always more permissive by accident',
        'PUT means **full replacement** of the resource, so every field must be sent; PATCH is a **partial update** that changes only the fields you send (ShopEasy even merges address fields)',
        'PUT is only for creating users',
        'PATCH ignores the body',
      ],
      answer: 1,
      why: 'That is the textbook difference, and ShopEasy implements it strictly. Test idea for both: after PATCH, GET the user and verify the email changed **and** the other fields (firstName "Asha", city "Bengaluru") stayed the same. For PUT, verify that missing fields are rejected rather than silently wiped.',
    },
    {
      q: 'Which statement about **idempotency** is correct for ShopEasy?',
      options: [
        'POST is idempotent: calling `POST /api/orders` twice gives the same order',
        'GET, PUT and DELETE are idempotent; POST is not — two `POST /api/orders` calls create two orders (e.g. 1001 and 1002). `DELETE /api/cart/items/2` returns 204 and then 404 the second time, but the server state (item gone) is the same, so it is still idempotent',
        'Nothing in REST is idempotent',
        'Only DELETE is idempotent',
      ],
      answer: 1,
      why: 'Idempotency is about the **effect on the server**, not an identical response code. This matters for retries: a client can safely retry a timed-out PUT or DELETE, but retrying a POST can create a duplicate order — which is why payment APIs use idempotency keys. Great follow-up test: "double-click Place order" should not create two orders.',
    },
    {
      q: 'How do you validate the **structure** of `GET /api/products/1` in RestAssured? (ShopEasy serves the JSON Schema at `GET /api/schema/product`.)',
      options: [
        'Compare the whole response string with a saved file using equals()',
        'Save the schema as `src/test/resources/schemas/product-schema.json` and assert `.body(matchesJsonSchemaInClasspath("schemas/product-schema.json"))` from the json-schema-validator module — it checks required fields, types, enums and extra properties; value checks stay in separate `body()` matchers',
        'Check only that the status is 200',
        'Schema validation is only possible in Postman',
      ],
      answer: 1,
      why: 'A schema catches **contract breaks** — a renamed field, a price returned as a string, a new unexpected property (ShopEasy\'s schema sets additionalProperties: false) — across every product without writing one assertion per field. It does not prove the values are right (that Trailblazer Backpack costs 29.99), so you combine it with targeted `body("name", equalTo(...))` checks.',
    },
    {
      q: 'Which status code fits each ShopEasy situation? `POST /api/cart/items` with `productId: 6` (Retro Red Tee, stock 0), then `POST /api/orders` success.',
      options: [
        '500 and 200',
        '404 and 200',
        '**422 Unprocessable Entity** (OUT_OF_STOCK — the request is well-formed but breaks a business rule) and **201 Created** with a `Location: /api/orders/{id}` header',
        '400 and 204',
      ],
      answer: 2,
      why: 'Know the families: **2xx** success (200 OK, 201 Created, 204 No Content), **4xx** client errors (400 bad request/validation, 401, 403, 404 not found, 405 method not allowed, 409 conflict such as ITEM_ALREADY_IN_CART, 415 wrong media type, 422 business rule), **5xx** server errors. A 5xx in response to bad input is itself a bug worth reporting.',
    },
    {
      q: 'Which authentication approach would you describe for an API test framework?',
      options: [
        'Copy a token from the browser into a constant',
        'Log in once (per test or class) through `POST /api/auth/login`, extract the token and send it via a shared RequestSpecification — `auth().oauth2(token)` for Bearer; Basic auth with `auth().preemptive().basic(user, pwd)`; API keys as a header — with credentials from config or CI secrets',
        'Disable authentication on QA',
        'Use the same admin token for every test, forever',
      ],
      answer: 1,
      why: 'Name the auth types you know (**Basic, Bearer/JWT, OAuth 2.0, API key**) and show the token is obtained dynamically and never committed. Using one all-powerful token everywhere hides permission bugs — you also need tests with a normal user and with no token.',
    },
  ],
  explanation: `**Cheat-sheet you can say in an interview**
| Topic | One-liner with a ShopEasy example |
|---|---|
| 401 vs 403 | no/invalid token → 401; someone else's order → 403 FORBIDDEN |
| PUT vs PATCH | PUT /api/users/1 replaces everything (missing fields → 400); PATCH changes only what you send |
| Idempotent | GET, PUT, DELETE yes; POST no — two POST /api/orders = two orders |
| 201 vs 200 | POST that creates → 201 + Location header; reads and updates → 200; DELETE → 204 |
| 409 vs 422 | 409 conflicts with current state (item already in cart); 422 valid JSON that breaks a rule (out of stock, quantity 11) |
| Schema | \`matchesJsonSchemaInClasspath\` for the contract, \`body()\` matchers for the values |

**Model answer — "How do you test an API?"**
> "Per endpoint I check the positive path with status, headers and body values; the contract with a JSON schema; negative cases — missing fields, wrong types, boundaries like quantity 0 and 11, unknown ids, wrong method; and security — no token, expired token, another user's data. I chain calls for flows like login → add to cart → place order → get order, and I validate the side effects with a follow-up GET."`,
  mistakes: [
    'Saying 401 means "not allowed" — that is 403; 401 is "not authenticated".',
    'Claiming POST is idempotent, or that DELETE is not idempotent because the second call returns 404.',
    'Validating only status codes and never the response body or schema.',
    'Thinking schema validation proves the data is correct — it only proves the shape.',
  ],
  interview: [
    { q: 'What is the difference between PUT and PATCH?', a: 'PUT replaces the whole resource, so the request must contain the complete representation — missing fields are either rejected or cleared. PATCH applies a partial update to only the fields sent. In our API a PUT on the user without firstName returns 400, while a PATCH with just the email returns 200 and keeps everything else.' },
    { q: 'What does idempotent mean, and why does it matter for testing?', a: 'An operation is idempotent when repeating it leaves the server in the same state as doing it once. GET, PUT and DELETE are; POST is not. It matters for retries and double submissions — I test that retrying a POST order or double-clicking Place order does not create duplicate orders.' },
    { q: 'How do you validate a JSON schema in RestAssured?', a: 'With the json-schema-validator dependency: put the schema file under src/test/resources and assert body(matchesJsonSchemaInClasspath("schemas/product-schema.json")). It checks required fields, types and additional properties; I still assert important values separately.' },
  ],
}
