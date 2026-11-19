export default {
  id: 'api-037',
  category: 'restassured',
  kind: 'quiz',
  title: 'Path vs query vs form params vs JSON body: sending data the way the API expects',
  level: 'ADVANCED',
  tags: ['path-params', 'query-params', 'form-params', 'request-body', 'content-type'],
  estMinutes: 15,
  scenario: `A new teammate migrated a Postman collection to RestAssured overnight. In the morning half the tests are red:
the login test gets \`400 INVALID_JSON\`, one product test dies with an \`IllegalArgumentException\` before any request is
sent, and a search test returns all 6 products instead of one. All three bugs come from putting data in the wrong
**kind** of parameter. You are pairing with them to fix it.`,
  description: `ShopEasy API on \`http://localhost:5181\`. Relevant contracts:

- \`GET /api/products/{id}\` — the id is part of the path
- \`GET /api/products\` — filters and paging in the query string: \`q\`, \`sort\`, \`page\`, \`size\`
- \`POST /api/auth/login\` — a **JSON** body \`{ "username", "password" }\`
- \`POST /api/users/{id}/avatar\` — \`multipart/form-data\` with a part named \`file\`

Pick the answer that describes what RestAssured really sends.`,
  questions: [
    {
      q: `Which request does this send?

\`\`\`java
given().baseUri("http://localhost:5181")
    .queryParam("q", "bike")
    .queryParam("sort", "price_desc")
.when().get("/api/products");
\`\`\``,
      options: [
        '`GET /api/products/bike/price_desc`',
        '`GET /api/products?q=bike&sort=price_desc` — one result, the Pulse Bike Light',
        '`GET /api/products` with a JSON body `{ "q": "bike", "sort": "price_desc" }`',
        '`POST /api/products` with form fields q and sort',
      ],
      answer: 1,
      why: `\`queryParam\` appends \`name=value\` pairs after \`?\` (URL-encoded). Query parameters **filter, sort or page** a collection; they never change which resource the path points to. GET requests should not carry a body.`,
    },
    {
      q: `This test throws before any request reaches the server. Why?

\`\`\`java
given().baseUri("http://localhost:5181")
    .pathParam("productId", 3)
.when().get("/api/products/{id}");
\`\`\``,
      options: [
        'The server returns 404 because productId is not a field',
        'RestAssured cannot fill the {id} placeholder: the path param name must match the template — use pathParam("id", 3) or get("/api/products/{id}", 3)',
        'pathParam only works with POST',
        'Path params must be strings, not ints',
      ],
      answer: 1,
      why: `Path parameters are **template variables**: the name in \`pathParam(name, value)\` must match \`{name}\` in the path. Here \`{id}\` has no value and \`productId\` is unused, so RestAssured throws an \`IllegalArgumentException\` while building the URL. The unnamed form \`get("/api/products/{id}", 3)\` fills placeholders in order.`,
    },
    {
      q: `The migrated login test returns **400 INVALID_JSON**. What went wrong?

\`\`\`java
given().baseUri("http://localhost:5181")
    .formParam("username", "standard_user")
    .formParam("password", "secret_sauce")
.when().post("/api/auth/login");
\`\`\``,
      options: [
        'The password is wrong',
        'formParam sends an `application/x-www-form-urlencoded` body (`username=standard_user&password=secret_sauce`); ShopEasy expects JSON, so it cannot parse it',
        'formParam turns the values into query parameters',
        'Login needs a Bearer token first',
      ],
      answer: 1,
      why: `Form params are the **HTML-form encoding** (\`key=value&key=value\`) in the body. Postman's "x-www-form-urlencoded" tab maps to it — but this API's contract is a JSON body. Fix: \`.contentType(ContentType.JSON).body(Map.of("username", "standard_user", "password", "secret_sauce"))\` or a POJO. Always send what the contract says, not what the old collection did.`,
    },
    {
      q: 'What does `param("q", "tee")` do in RestAssured?',
      options: [
        'Always a query parameter',
        'Always a form parameter',
        'It guesses: a query parameter on GET, a form parameter on POST (unless a body/content type says otherwise) — which is why explicit queryParam/formParam are preferred',
        'A header named q',
      ],
      answer: 2,
      why: `\`param()\` is the "smart" variant: it becomes a query param for GET and a form param for POST. That ambiguity is exactly how a search can silently lose its filter when someone changes the method — use \`queryParam\`, \`formParam\` or \`pathParam\` so the intent is visible in code review.`,
    },
    {
      q: 'For the avatar upload (`POST /api/users/1/avatar`), how do you send the image and the optional alt text?',
      options: [
        '`.formParam("file", bytes).formParam("altText", "Asha")`',
        '`.multiPart("file", new File("asha.png"), "image/png").multiPart("altText", "Asha")` — RestAssured sets `multipart/form-data` with a boundary',
        '`.queryParam("file", "asha.png")`',
        '`.body(new File("asha.png"))` with Content-Type image/png',
      ],
      answer: 1,
      why: `Files go in **multipart/form-data**, where each part has its own name and content type. \`formParam\` cannot carry binary data properly, and a raw image body is not multipart, so ShopEasy answers **415 UNSUPPORTED_MEDIA_TYPE**. Text fields of the same form are just additional parts.`,
    },
    {
      q: 'Your API design checklist says "identify the resource in the path, refine the result in the query". Which request follows it?',
      options: [
        '`GET /api/products?id=3`',
        '`GET /api/products/3` and `GET /api/products?sort=price_asc&page=2`',
        '`GET /api/products/sort/price_asc/page/2`',
        '`POST /api/products/search` with `{ "id": 3 }` for every lookup',
      ],
      answer: 1,
      why: `A **path param** names one resource (\`/products/3\`) — a missing one is a 404. **Query params** filter, sort and page a collection — invalid values give **400 INVALID_QUERY** with details, and leaving them out gives the defaults. Mixing them up leads to wrong status expectations in your tests.`,
    },
  ],
  hints: [
    'Path param: which resource. Query param: which slice of a collection.',
    'formParam = application/x-www-form-urlencoded body; body(...) with ContentType.JSON = JSON body.',
    'multiPart is the only one that handles files.',
  ],
  explanation: `| RestAssured | Ends up in | Typical use on ShopEasy |
|---|---|---|
| \`pathParam("id", 3)\` / \`get("/x/{id}", 3)\` | the URL path | \`/api/products/3\`, \`/api/users/1\` |
| \`queryParam("q", "bike")\` | \`?q=bike\` | search, sort, page, size |
| \`formParam("k", "v")\` | urlencoded body | HTML-form style APIs (not ShopEasy) |
| \`contentType(JSON).body(obj)\` | JSON body | login, cart, orders, profile |
| \`multiPart("file", file, "image/png")\` | multipart body | avatar upload |

The question to ask is always "what does the **contract** say?" — the Content-Type the server expects decides the
method, not the habit from the old Postman collection. When a request fails before reaching the server, suspect the
path template; when the server answers 400/415, compare the body encoding with the contract.`,
  mistakes: [
    'Using formParam for a JSON API because Postman had an x-www-form-urlencoded tab.',
    'Mismatched names between pathParam("productId", ...) and the {id} template.',
    'Relying on param() and changing GET to POST later — the filter becomes a form field.',
    'Building query strings by hand ("?q=" + text) — special characters are not encoded.',
  ],
  interview: [
    { q: 'What is the difference between path and query parameters?', a: 'Path parameters identify a specific resource and are part of the URL template (/products/3); a wrong one usually means 404. Query parameters are optional modifiers on a collection (filter, sort, paging); invalid values usually mean 400 and missing ones fall back to defaults.' },
    { q: 'How does RestAssured decide the Content-Type of the request?', a: 'You set it with contentType(...); with formParam it defaults to application/x-www-form-urlencoded, with multiPart to multipart/form-data, and body(pojo) needs a JSON content type so the object is serialised with Jackson or Gson.' },
    { q: 'How would you send a JSON body without writing a POJO?', a: 'Pass a Map<String, Object> to body() with contentType(ContentType.JSON); RestAssured serialises it. For anything reused across tests a POJO or builder is cleaner.' },
  ],
}
