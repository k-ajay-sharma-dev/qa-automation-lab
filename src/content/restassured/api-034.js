export default {
  id: 'api-034',
  category: 'restassured',
  kind: 'quiz',
  title: 'Which method, which status? Mapping the ShopEasy endpoints',
  level: 'BEGINNER',
  tags: ['http-methods', 'status-codes', 'rest', 'api-contract'],
  estMinutes: 12,
  scenario: `Sprint planning: the PO wants an "API coverage matrix" — one row per ShopEasy endpoint with the HTTP method and
every status code the tests must cover. You have the endpoint list from the developer's README, but the juniors keep
writing \`POST\` where it should be \`PATCH\` and expecting \`200\` where the API returns \`201\` or \`204\`. Quiz yourself
before you fill in the matrix.`,
  description: `All questions are about the ShopEasy API on \`http://localhost:5181\` (users: standard_user id 1,
visual_user id 3, password secret_sauce). Think about both the **method** and the **exact status code** the API returns.`,
  questions: [
    {
      q: 'Asha (user 1) wants to change **only her phone number**. Which request is the right one?',
      options: [
        '`POST /api/users/1` with `{ "phone": "..." }`',
        '`PUT /api/users/1` with `{ "phone": "..." }`',
        '`PATCH /api/users/1` with `{ "phone": "..." }` → 200 and the updated user',
        '`GET /api/users/1?phone=...`',
      ],
      answer: 2,
      why: `PATCH is a **partial** update: only the fields you send change. PUT is a **full replace** — on ShopEasy a PUT with only \`phone\` returns **400 VALIDATION_FAILED** because firstName, lastName, email and address are required. POST on \`/api/users/1\` is not supported (405), and GET must never change data.`,
    },
    {
      q: 'You place an order with `POST /api/orders` and a valid body. What does a correct response look like?',
      options: [
        '200 with the order in the body',
        '201 Created with the order in the body and a `Location: /api/orders/{id}` header',
        '204 No Content',
        '202 Accepted with no body',
      ],
      answer: 1,
      why: `Creating a resource returns **201 Created**, and ShopEasy also sends a **Location** header pointing at the new order. A test that only checks "2xx" would miss a regression to 200; the matrix should list 201 and the Location header explicitly.`,
    },
    {
      q: 'What does `DELETE /api/cart/items/2` return when the Pulse Bike Light is in the cart?',
      options: [
        '200 with the updated cart',
        '204 No Content — and no body to assert on',
        '202 Accepted',
        '410 Gone',
      ],
      answer: 1,
      why: `A successful DELETE on ShopEasy returns **204 No Content**. There is no JSON body, so \`.body("items", ...)\` on that response would fail — verify the result with a follow-up \`GET /api/cart\`. Deleting it a second time gives **404 ITEM_NOT_IN_CART**.`,
    },
    {
      q: 'A security tester tries `DELETE /api/products/1`. What should your test expect?',
      options: [
        '404 PRODUCT_NOT_FOUND',
        '401 UNAUTHORIZED',
        '405 METHOD_NOT_ALLOWED with an `Allow: GET` header',
        '204, the product is gone',
      ],
      answer: 2,
      why: `The path exists but the method is not supported on it: **405 Method Not Allowed**, and the \`Allow\` header lists what *is* allowed (\`GET\`). 404 would mean the resource does not exist; 401 would mean the method is allowed but you are not logged in.`,
    },
    {
      q: 'Which pair is correct for the cart and orders endpoints?',
      options: [
        '`GET /api/cart` without a token → 403; `GET /api/orders/{id}` of visual_user\'s order as standard_user → 401',
        '`GET /api/cart` without a token → 401 (with a `WWW-Authenticate` header); someone else\'s order → 403 FORBIDDEN',
        'Both return 404 so attackers learn nothing',
        'Both return 400 VALIDATION_FAILED',
      ],
      answer: 1,
      why: `**401** = "I don't know who you are" (no or invalid token). **403** = "I know who you are, but this is not yours" — ShopEasy returns 403 FORBIDDEN for another customer's order. Keep both rows in the matrix: they are different bugs when they break.`,
    },
    {
      q: '`POST /api/cart/items` with `{ "productId": 1 }` succeeds once. You send the exact same request again. What comes back?',
      options: [
        '201 again, quantity becomes 2',
        '200, nothing changes',
        '409 Conflict — ITEM_ALREADY_IN_CART',
        '422 INVALID_QUANTITY',
      ],
      answer: 2,
      why: `POST is **not idempotent**: repeating it can have a different effect. ShopEasy refuses a second add of the same product with **409 ITEM_ALREADY_IN_CART**. 422 is for a quantity outside 1–10, which is a different row in the matrix.`,
    },
  ],
  hints: [
    'Create = 201 (+ Location), delete = 204, read/update = 200.',
    'PUT replaces the whole resource, PATCH changes only what you send.',
    '401 = not logged in, 403 = logged in but not allowed, 405 = wrong method on a real path.',
  ],
  explanation: `A coverage matrix for ShopEasy looks like this (happy path first, then the error codes):

| Endpoint | Method | Success | Errors to cover |
|---|---|---|---|
| /api/auth/login | POST | 200 | 400, 401, 403 |
| /api/products/{id} | GET | 200 | 400, 404 |
| /api/cart/items | POST | 201 | 400, 401, 404, 409, 422 |
| /api/cart/items/{productId} | DELETE | 204 | 401, 404 |
| /api/orders | POST | 201 + Location | 400, 401, 404, 422 |
| /api/orders/{id} | GET | 200 | 401, 403, 404 |
| /api/users/{id} | PUT / PATCH | 200 | 400, 401, 403, 422 |
| any wrong method | — | — | 405 + Allow |

Assert the **exact** code, never "is 2xx" — a change from 201 to 200 is a contract break for the clients.`,
  mistakes: [
    'Asserting 200 for every success — creates are 201 and deletes are 204.',
    'Using PUT for a one-field change and being surprised by a 400.',
    'Mixing up 401 and 403 in negative tests.',
    'Asserting on the body of a 204 response.',
  ],
  interview: [
    { q: 'What is the difference between PUT and PATCH?', a: 'PUT replaces the whole resource, so every required field must be sent; PATCH applies a partial change and leaves the other fields as they are. PUT is idempotent by definition; PATCH may or may not be, depending on the API.' },
    { q: 'Which HTTP methods are idempotent and why does it matter for testing?', a: 'GET, PUT and DELETE are idempotent (repeating them leaves the same server state); POST is not. It matters for retries: a framework can safely retry an idempotent call, but retrying a POST may create a duplicate order or, as on ShopEasy, return 409.' },
    { q: 'When do you expect 405 instead of 404?', a: '405 when the path exists but the method is not supported (the Allow header lists the valid ones). 404 when there is no such resource or route at all.' },
  ],
}
