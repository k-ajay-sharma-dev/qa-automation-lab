export default {
  slug: 'api-for-manual-testers',
  category: 'restassured',
  order: 1,
  title: "APIs for manual testers (you've used Postman — here's what's happening)",
  minutes: 9,
  summary: 'Read any HTTP request and response like a tester: method, URL, headers, JSON body and status code, and know what each part means before you automate it.',
  manualAnalogy: `You have probably opened Postman, picked GET, pasted a URL, pressed **Send** and checked the response pane. Or you opened the browser DevTools Network tab to see why a page showed an error. That is API testing already. Automation only writes down the same request and the same checks in code, so they run on every build without you clicking Send.`,
  body: `## What an API is, in tester words

The ShopEasy web shop you test by hand is the *front end*. When you click **Add to cart**, the page sends a message to a server, and the server answers. That message format is the **API** (Application Programming Interface). The mobile app talks to the same API. If the API is wrong, every client is wrong, so testing it directly finds bugs earlier and faster than clicking through screens.

## The request: four parts

\`\`\`
POST http://localhost:5181/api/auth/login        <- method + URL
Content-Type: application/json                    <- headers
Accept: application/json

{ "username": "standard_user", "password": "secret_sauce" }   <- body
\`\`\`

- **Method** (also called verb) says what you want to do.
- **URL** says which resource: \`/api/products\`, \`/api/products/3\`, \`/api/orders/1001\`. The part after \`?\` is the **query string** (\`?sort=price_asc&page=1\`), usually filters or paging.
- **Headers** are metadata: what format you send (\`Content-Type\`), what you accept (\`Accept\`), who you are (\`Authorization: Bearer <token>\`).
- **Body** is the data, usually JSON. GET and DELETE normally have none.

## The methods (what Postman's dropdown means)

| Method | Meaning | ShopEasy example | Safe to repeat? |
|---|---|---|---|
| GET | read | \`GET /api/products/2\` | yes, changes nothing |
| POST | create / do an action | \`POST /api/orders\` | no, two calls = two orders |
| PUT | replace the whole thing | \`PUT /api/users/1\` | yes (same result each time) |
| PATCH | change some fields | \`PATCH /api/users/1\` | usually |
| DELETE | remove | \`DELETE /api/cart/items/2\` | yes |

"Safe to repeat" is called **idempotent**. It matters for testers: a retry on a flaky network must not create a second order.

## The response: status, headers, body

\`\`\`
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "Product 99 not found" } }
\`\`\`

The **status code** is the first thing to check. Learn them in groups:

| Range | Meaning | Codes you will see on ShopEasy |
|---|---|---|
| 2xx | success | 200 OK, 201 Created (new order), 204 No Content (delete, empty body) |
| 4xx | **the client** did something wrong | 400 bad input, 401 not logged in, 403 logged in but not allowed, 404 not found, 409 conflict (item already in cart), 422 understood but rule broken (out of stock) |
| 5xx | **the server** broke | 500 — always a bug to raise |

Two pairs trip up everyone:
- **401 vs 403**: 401 means "I don't know who you are" (no or bad token, wrong password). 403 means "I know who you are, and you may not" (locked user, someone else's order).
- **400 vs 422**: 400 means the request itself is malformed or missing fields. 422 means it is well-formed but breaks a business rule.

## JSON in 60 seconds

\`\`\`json
{
  "id": 1,
  "name": "Trailblazer Backpack",
  "price": 29.99,
  "inStock": true,
  "tags": ["bags", "outdoor"],
  "address": { "city": "Bengaluru" }
}
\`\`\`

Curly braces are an **object** (key/value pairs), square brackets are an **array** (a list). Values are strings (quoted), numbers, \`true\`/\`false\`, \`null\`, or nested objects/arrays. When you assert, you walk a path through it: \`address.city\`, \`tags[0]\`, \`data.size()\`.

## Your manual test cases already fit

A manual API test case is: *given* this request, *when* I send it, *then* I expect this status, these headers and these body values. That is exactly the shape RestAssured code and Cucumber scenarios use, so your Postman collection is your first automation backlog. Good API test cases cover:

1. Happy path (200/201 with the right data).
2. Validation (missing / wrong fields → 400 with field details).
3. Auth (no token → 401, wrong user → 403).
4. Not found (404 with a readable error body).
5. Business rules (409 / 422).`,
  keyPoints: [
    'A request is method + URL (path and query) + headers + optional JSON body.',
    'A response is status code + headers + body; check the status first, then the body.',
    'GET reads, POST creates, PUT replaces, PATCH changes part, DELETE removes; GET/PUT/DELETE are idempotent.',
    '401 = who are you?, 403 = not allowed; 400 = malformed input, 422 = valid input that breaks a rule.',
    'Your Postman checks (status, values, error messages) map one-to-one onto automated assertions.',
  ],
  mistakes: [
    'Checking only the status code — a 200 with the wrong price is still a bug; assert the body too.',
    'Treating every 4xx as "the API is broken" — a 404 for a missing product is correct behaviour and worth a test.',
    'Forgetting the Content-Type: application/json header on POST, then wondering why the server says the body is invalid.',
    'Testing only through the UI — the UI may hide API bugs that the mobile app will hit.',
  ],
  tryIt: `Run \`npm run api\`, then open http://localhost:5181/api/products/99 and http://localhost:5181/api/products?sort=price_desc&size=2 in a browser (or Postman). Note the status, the \`Content-Type\` header and the JSON shape. Then POST to \`/api/auth/login\` in Postman with \`locked_out_user\` / \`secret_sauce\` and explain to yourself why it is 403 and not 401.`,
  problems: ['api-001', 'api-005', 'api-007', 'api-034', 'api-039'],
}
