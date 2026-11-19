export default {
  id: 'api-042',
  category: 'restassured',
  kind: 'quiz',
  title: 'Boundary values on the API: cart quantity 1–10 and page size 1–50',
  level: 'INTERMEDIATE',
  tags: ['boundary-value-analysis', 'negative-testing', 'validation', 'query-params'],
  estMinutes: 12,
  scenario: `You have run boundary value analysis on the checkout screen for years: "quantity 1–10, test 0, 1, 10, 11". The UI
dropdown only offers 1–10, so those tests never hit an invalid value. At the API layer nothing stops a client sending
0, 11, 2.5 or "3" — and last release a partner integration sent \`size=100\` and got a 500. Time to design the API
boundary tests.`,
  description: `ShopEasy rules: \`POST /api/cart/items\` accepts \`quantity\` as an **integer 1–10** (default 1).
\`GET /api/products\` accepts \`page\` 1–1000 and \`size\` 1–50 (defaults 1 and 10). There are 6 products.`,
  questions: [
    {
      q: 'Which set of `quantity` values is the minimal, complete boundary set for `POST /api/cart/items`?',
      options: [
        '1, 5, 10',
        '0, 1, 10, 11 — plus "omitted" (default 1)',
        '-1000, 1000',
        'Only 11, because the UI already covers the valid ones',
      ],
      answer: 1,
      why: `Two-value BVA: the last invalid and first valid value on each edge — **0 / 1** and **10 / 11**. "Omitted" is its own partition because the API has a default. Mid-range 5 adds little; huge numbers are a separate robustness idea, not the boundary.`,
    },
    {
      q: '`POST /api/cart/items` with `{ "productId": 1, "quantity": 11 }`. What should the test assert?',
      options: [
        '400 VALIDATION_FAILED',
        '422 INVALID_QUANTITY with `error.details[0].field = "quantity"`',
        '201 and quantity silently capped at 10',
        '500',
      ],
      answer: 1,
      why: `The JSON is well-formed and productId is valid; it breaks a **business rule**, so ShopEasy answers **422 INVALID_QUANTITY** and names the field. Silently capping would be a bug worth reporting — the client would think 11 were ordered.`,
    },
    {
      q: 'A partner sends `"quantity": "3"` (a string) or `2.5`. What does ShopEasy do, and why test it?',
      options: [
        'Accepts both and converts them — no need to test',
        'Refuses both with 422 INVALID_QUANTITY because quantity must be an **integer**; type tests catch lenient parsing bugs',
        'Returns 415 Unsupported Media Type',
        'Rounds 2.5 to 3',
      ],
      answer: 1,
      why: `The server checks \`Number.isInteger\`, so a string or a decimal is refused with 422. These **type** cases are impossible from the UI dropdown but trivial from an API client, which is why they belong in the API suite.`,
    },
    {
      q: 'Which `GET /api/products` request returns **400 INVALID_QUERY** with a detail for `size`?',
      options: [
        '`?size=50`',
        '`?size=1`',
        '`?size=51`',
        '`?size=` (empty)',
      ],
      answer: 2,
      why: `50 and 1 are the valid edges (200). **51** is just outside → 400 INVALID_QUERY with \`error.details[0].field = "size"\`. An empty value falls back to the default 10 — a good extra case, but it is not an error.`,
    },
    {
      q: '`GET /api/products?page=2&size=10` with 6 products. What is the correct expectation?',
      options: [
        '404 — there is no page 2',
        '400 INVALID_QUERY',
        '200 with `data` empty, `total = 6`, `totalPages = 1`',
        '200 with the first 6 products again',
      ],
      answer: 2,
      why: `page=2 is inside the allowed range (1–1000), so the request is valid — there is simply nothing on it: **200** with an empty \`data\` list. Returning page 1 again would make a client loop forever while paging. This "valid but beyond the data" case is a classic API boundary.`,
    },
    {
      q: 'You add Retro Red Tee (product 6, stock 0) with quantity 1. Which partition is this?',
      options: [
        'A valid quantity boundary — expect 201',
        'A different rule: valid quantity but **OUT_OF_STOCK** → 422',
        '404 PRODUCT_NOT_FOUND',
        '409 ITEM_ALREADY_IN_CART',
      ],
      answer: 1,
      why: `Boundaries exist on **every** rule, not just the input range: stock 0 vs stock ≥ 1 is a boundary too. ShopEasy refuses with **422 OUT_OF_STOCK**. Keep one valid input per test so you know which rule fired.`,
    },
  ],
  hints: [
    'Two-value BVA: test the last invalid and first valid value on each edge.',
    '422 = valid JSON that breaks a business rule; 400 = malformed or missing input / bad query.',
    'An empty page beyond the data is valid — not an error.',
  ],
  explanation: `A compact boundary table for the two rules:

| Input | Values | Expected |
|---|---|---|
| cart \`quantity\` | omitted, 1, 10 | 201 |
| cart \`quantity\` | 0, 11, 2.5, "3" | 422 INVALID_QUANTITY (field quantity) |
| products \`size\` | 1, 50, empty | 200 |
| products \`size\` | 0, 51, abc | 400 INVALID_QUERY (field size) |
| products \`page\` | 2 (beyond data) | 200, empty data |

In RestAssured this is a perfect \`@DataProvider\` matrix: one row per value with its expected status and error code.
Your manual BVA skills transfer directly — the API just lets you send the values the UI never could.`,
  mistakes: [
    'Copying UI test values to the API and never sending 0, 11 or a wrong type.',
    'Asserting only "4xx" — 400 vs 422 is part of the contract.',
    'Expecting 404 for an empty page beyond the data.',
    'Changing two inputs in one boundary test, so the failing rule is unclear.',
  ],
  interview: [
    { q: 'How do you apply boundary value analysis to an API?', a: 'Find every rule with a range or limit in the spec (quantities, page sizes, string lengths, file sizes), test just inside and just outside each edge, add the default/omitted case and wrong types, and assert both the status and the error code for each.' },
    { q: 'Why test wrong data types at the API level?', a: 'The UI usually restricts input types, but any client can send a string or decimal to the API. Lenient parsing (e.g. "3" accepted, 2.5 rounded) leads to wrong orders and security issues, so the API must refuse it explicitly.' },
  ],
}
