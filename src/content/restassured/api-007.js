export default {
  id: 'api-007',
  category: 'restassured',
  kind: 'quiz',
  title: 'Status codes, headers and error bodies — reading responses like a tester',
  level: 'BEGINNER',
  tags: ['status-codes', 'headers', 'error-handling', 'triage'],
  estMinutes: 12,
  scenario: `It is the first week of API regression for the order service. Your tests are producing failures and the
developers ask you to triage before raising bugs: "is it the test, the data or the API?" Each question below is a
real response you got from the ShopEasy practice API. Decide what it means and what you would do.`,
  description: `Answer the questions. Reproduce any of them with the practice API (\`npm run api\`) if you are unsure.`,
  questions: [
    {
      q: 'You call `GET /api/cart` without an `Authorization` header and get `401` with `{ "error": { "code": "UNAUTHORIZED" } }`. You log in as `locked_out_user` and get `403 USER_LOCKED`. What is the difference?',
      options: [
        'There is none — both mean "wrong password"',
        '401: the API does not know who you are (no/invalid credentials). 403: it knows who you are but refuses',
        '401 is a server error, 403 is a client error',
        '403 means the endpoint does not exist',
      ],
      answer: 1,
      why: '**401 Unauthorized** = authentication missing or invalid → fix the token. **403 Forbidden** = authenticated but not allowed (locked account, someone else\'s order). Reporting a 403 as "login broken" sends the developer the wrong way.',
    },
    {
      q: 'Adding the Trailblazer Backpack to the cart a second time returns `409 ITEM_ALREADY_IN_CART`; adding quantity `0` returns `422 INVALID_QUANTITY`. Which description fits?',
      options: [
        '409 = conflict with the current state of the resource; 422 = the request is well-formed but its values break a business rule',
        'Both are server bugs',
        '409 = timeout, 422 = not found',
        '409 and 422 are only used for authentication',
      ],
      answer: 0,
      why: '**409 Conflict**: the request is fine on its own but clashes with what is already there (item already in cart). **422 Unprocessable Entity**: syntactically valid JSON whose values are not acceptable. **400** is for malformed or missing input (e.g. no `productId`).',
    },
    {
      q: '`DELETE /api/cart/items/2` returns `204 No Content` and an empty body. Your test does `.body("items.size()", equalTo(0))` and fails. Why?',
      options: [
        'The delete failed',
        '204 means success *with no body* — there is nothing to parse. Assert the status, then `GET /api/cart` to verify the item is gone',
        'You need to add Accept: application/json to get the body',
        '204 is a redirect',
      ],
      answer: 1,
      why: '**204** is success without a body. Verify a delete by reading the resource afterwards: GET the cart and assert the product is not in `items.productId`. Checking the side effect is better testing anyway.',
    },
    {
      q: `This assertion fails on a correct response \`{ "price": 29.99 }\`:

\`\`\`java
.body("price", equalTo(29.99));
\`\`\`
Why?`,
      options: [
        'The API rounds prices',
        'RestAssured reads JSON decimals as Float by default, and Float 29.99f is not equal to Double 29.99',
        'equalTo cannot compare numbers',
        'You must use jsonPath() for numbers',
      ],
      answer: 1,
      why: 'By default JSON decimals become **Float**. Compare with `equalTo(29.99f)`, or configure `JsonConfig.jsonConfig().numberReturnType(NumberReturnType.BIG_DECIMAL)` (or DOUBLE) in your spec and compare with that type. Money is safest as `BigDecimal`.',
    },
    {
      q: 'After `POST /api/orders` you get `201 Created`. Which response header tells you where the new order lives?',
      options: ['Content-Type', 'Location', 'X-Request-Id', 'Allow'],
      answer: 1,
      why: '`Location: /api/orders/1001` points at the created resource. `Content-Type` describes the body, `X-Request-Id` is a correlation id you should paste into bug reports so developers can find the server log, and `Allow` lists methods after a 405.',
    },
    {
      q: 'A negative test sends `{ "firstName": "", "lastName": "Rao", "postalCode": "560001" }` to `POST /api/orders`. The API answers `500 Internal Server Error`. What do you do?',
      options: [
        'Change the test to expect 500',
        'Retry until it passes',
        'Raise a defect: invalid input must produce a 4xx (here 400 with a field error for firstName), never a 500',
        'Ignore it — negative tests are optional',
      ],
      answer: 2,
      why: 'A **5xx for bad input** means the server did not validate and crashed somewhere deeper. The expected contract is `400 VALIDATION_FAILED` with `details[].field == "firstName"`. Never adjust a test to accept a 500.',
    },
  ],
  hints: ['2xx success, 4xx the client (you) did something the API refuses, 5xx the server failed.'],
  explanation: `Reading a response like a tester means looking at **status + error code + message + headers** together:

| Status | ShopEasy example | Meaning |
|---|---|---|
| 200 / 201 / 204 | GET product / POST order / DELETE item | success (201 = created, 204 = no body) |
| 400 | missing \`firstName\` | malformed or missing input |
| 401 | no token | who are you? |
| 403 | locked user, someone else's order | I know you, but no |
| 404 | product 99 | does not exist |
| 409 | item already in cart | clashes with current state |
| 422 | quantity 0, out of stock | valid JSON, invalid business values |
| 5xx | — | always a defect to report |

The error body's \`code\` is what tests should assert — messages may be reworded, codes are the contract.`,
  mistakes: [
    'Asserting only the message text, which product owners reword — assert the error code.',
    'Expecting a body on 204 responses.',
    'Comparing decimals with doubles while RestAssured returns Floats.',
    'Accepting a 500 as the "expected" result of a negative test.',
  ],
  interview: [
    { q: 'What do you put in an API defect report?', a: 'Method and URL, request headers (token masked) and body, the actual status, headers and body, the expected contract, the environment, the time and the request/correlation id (X-Request-Id) so developers can find the server log.' },
    { q: 'Which status codes would you expect from a create endpoint?', a: '201 with the resource and a Location header on success; 400 for missing/malformed fields, 401/403 for auth, 404 if a referenced id does not exist, 409 for duplicates and 422 for business-rule violations.' },
  ],
}
