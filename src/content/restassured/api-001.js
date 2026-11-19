export default {
  id: 'api-001',
  category: 'restassured',
  kind: 'quiz',
  title: 'REST & HTTP fundamentals for testers',
  level: 'BEGINNER',
  tags: ['http', 'rest', 'status-codes', 'json'],
  estMinutes: 10,
  scenario: `The ShopEasy mobile app is being rebuilt and talks to the same backend as the web shop. Your lead wants
API regression tests before the release, because "the UI is just a skin — the real rules live in the API". Before
writing any code you sit with the backend developer and go through the order and product endpoints in Postman.
These are the questions she asks you to make sure you speak the same language.`,
  description: `Answer the questions. Start the practice API with \`npm run api\` and try the requests yourself with
Postman, curl or the browser (\`http://localhost:5181/api/products\`) — seeing the real response is the best way to learn.`,
  questions: [
    {
      q: 'The mobile team asks which HTTP method the app should use to **place a new order** (`/api/orders`). Which one is correct for REST?',
      options: ['GET', 'POST', 'PUT', 'DELETE'],
      answer: 1,
      why: '**POST** creates a new resource under a collection; the server picks the new id (ShopEasy returns `201 Created` with `id: 1001` and a `Location` header). GET only reads and must never change data, PUT replaces a resource at a known URL, DELETE removes one.',
    },
    {
      q: 'You request `GET /api/products/99` and there is no product 99. Which status code should a well-behaved API return?',
      options: ['200 OK with an empty body', '400 Bad Request', '404 Not Found', '500 Internal Server Error'],
      answer: 2,
      why: '**404** means "the URL is fine but the thing it names does not exist". 200 with an empty body hides the problem from every client, 400 means the request itself is malformed (e.g. `/api/products/abc`), and 500 means the server crashed — always a bug worth reporting.',
    },
    {
      q: 'Which request **header** tells the server "the body I am sending is JSON"?',
      options: ['Accept: application/json', 'Content-Type: application/json', 'Authorization: Bearer ...', 'Cache-Control: no-cache'],
      answer: 1,
      why: '`Content-Type` describes the body you *send*. `Accept` describes what you want *back*. `Authorization` carries credentials. Forgetting `Content-Type` on a POST is a classic cause of a confusing 400 or 415 response.',
    },
    {
      q: `Look at this response body from \`GET /api/products?size=2\`:

\`\`\`json
{ "data": [ { "id": 1, "name": "Trailblazer Backpack", "price": 29.99 },
            { "id": 2, "name": "Pulse Bike Light", "price": 9.99 } ],
  "page": 1, "size": 2, "total": 6, "totalPages": 3 }
\`\`\`

What is \`data\`?`,
      options: ['A JSON object with two keys', 'A JSON array of two objects', 'A string', 'A number'],
      answer: 1,
      why: 'Square brackets `[ ]` are an **array** (a list); curly braces `{ }` are an **object** (key → value pairs). So `data` is a list of two product objects, while the whole body is an object. This matters as soon as you write paths like `data[0].name` or `data.size()`.',
    },
    {
      q: 'Which statement about **idempotency** is true?',
      options: [
        'POST is idempotent: sending it twice gives the same result',
        'PUT and DELETE are idempotent: repeating the same request leaves the server in the same state',
        'GET is not idempotent because it returns data',
        'Only PATCH is idempotent',
      ],
      answer: 1,
      why: 'Repeating a **PUT** (replace the user with this exact body) or a **DELETE** leaves the same final state, so clients may safely retry them. Repeating a POST to `/api/orders` creates a *second* order — which is exactly why "double-click creates two orders" is a bug you test for. GET is safe *and* idempotent.',
    },
    {
      q: 'Why do API tests usually catch bugs **earlier and more reliably** than the same check through the UI?',
      options: [
        'They do not need any test data',
        'They run against the business rules directly — no browser, no rendering, no locators — so they are fast and rarely flaky',
        'They replace the need for UI tests completely',
        'They can only find performance bugs',
      ],
      answer: 1,
      why: 'An API test hits the same rules (tax, validation, stock) without the UI layer, so it runs in milliseconds and breaks only when behaviour changes. That is why the test pyramid has many API tests and fewer UI tests. You still need *some* UI tests — the API cannot tell you a button is hidden.',
    },
  ],
  hints: ['Methods are verbs (GET reads, POST creates…), status codes are the verdict, headers are metadata, JSON is the payload.'],
  explanation: `Every API test you will write is built from four ideas: the **method** (what you want to do), the **URL**
(which resource), **headers** (metadata such as \`Content-Type\` and \`Authorization\`) and the **body** (JSON). The server
answers with a **status code** (2xx success, 4xx your fault, 5xx server's fault), headers and a body.

A reviewer expects you to assert *all three* parts of a response that matter: the status, the important headers
(e.g. \`Content-Type\`, \`Location\` after a create) and the body fields the business cares about.`,
  mistakes: [
    'Checking only the status code and never the body — a 200 with a wrong total passes.',
    'Mixing up Content-Type (what you send) and Accept (what you want back).',
    'Treating 500 errors as "environment issues" — a 500 for bad input is a real defect; the API should answer 4xx.',
  ],
  interview: [
    { q: 'What is the difference between 401 and 403?', a: '401 Unauthorized means "I do not know who you are" — missing or invalid credentials. 403 Forbidden means "I know who you are, but you are not allowed" — e.g. a locked user, or reading another customer\'s order.' },
    { q: 'What is the difference between PUT and PATCH?', a: 'PUT replaces the whole resource with the body you send (missing fields are an error or get cleared). PATCH changes only the fields you send. ShopEasy returns 400 for a PUT that is missing required fields, while PATCH { "phone": ... } changes just the phone.' },
    { q: 'Is a 200 status enough to pass an API test?', a: 'No. A 200 with the wrong total, a missing field or the wrong content type is still a bug. Assert the status, the key body fields and important headers — and for creates, that the resource can be read back.' },
  ],
}
