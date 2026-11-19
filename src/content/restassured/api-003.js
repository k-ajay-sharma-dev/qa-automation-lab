export default {
  id: 'api-003',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Path and query parameters: product details and a sorted page',
  level: 'BEGINNER',
  tags: ['path-params', 'query-params', 'get'],
  estMinutes: 20,
  scenario: `The mobile app shows a product grid sorted by price with 3 items per page, and a details screen for one
product. Last release a backend change broke paging (page 2 returned page 1 again) and nobody noticed for a week. You
are asked to cover both calls. A teammate's draft builds URLs with string concatenation —
\`"/api/products?sort=" + sort + "&page=" + page\` — which already broke once when someone forgot the \`&\`.`,
  description: `Write two TestNG tests against \`http://localhost:5181\`:

1. **productDetails** — \`GET /api/products/{id}\` for id **4**: status 200, \`name\` is \`"Storm Fleece Jacket"\`, \`id\` is 4.
2. **cheapestFirstPage** — \`GET /api/products\` with \`sort=price_asc\`, \`page=1\`, \`size=3\`: status 200,
   \`size\` is 3, \`total\` is 6, \`totalPages\` is 2 and the first product (\`data[0].name\`) is \`"Junior Onesie"\`.

**Rules**
- Use \`pathParam("id", 4)\` with a \`{id}\` placeholder in the path.
- Use \`queryParam(...)\` (or \`queryParams(...)\`) — no \`?\` or \`&\` written by hand.
- No string concatenation in the URL.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class ProductCatalogueTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productDetails() {
        int id = 4;
        given().baseUri(BASE_URI)
        .when().get("/api/products/" + id)
        .then().statusCode(200);
        // TODO: assert name and id
    }

    @Test
    public void cheapestFirstPage() {
        String sort = "price_asc";
        given().baseUri(BASE_URI)
        .when().get("/api/products?sort=" + sort + "&page=1&size=3")
        .then().statusCode(200);
        // TODO: assert paging fields and first product
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class ProductCatalogueTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productDetails() {
        given()
            .baseUri(BASE_URI)
            .pathParam("id", 4)
        .when()
            .get("/api/products/{id}")
        .then()
            .statusCode(200)
            .body("id", equalTo(4))
            .body("name", equalTo("Storm Fleece Jacket"));
    }

    @Test
    public void cheapestFirstPage() {
        given()
            .baseUri(BASE_URI)
            .queryParam("sort", "price_asc")
            .queryParam("page", 1)
            .queryParam("size", 3)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("size", equalTo(3))
            .body("total", equalTo(6))
            .body("totalPages", equalTo(2))
            .body("data[0].name", equalTo("Junior Onesie"));
    }
}
`,
  checks: [
    { label: 'Uses a path parameter', pattern: '\\.pathParams?\\(\\s*"id"', hint: '.pathParam("id", 4) and get("/api/products/{id}")' },
    { label: 'Path has a {id} placeholder', pattern: '"/api/products/\\{id\\}"', hint: 'get("/api/products/{id}")' },
    { label: 'Uses query parameters', pattern: '\\.queryParams?\\(\\s*"sort"', hint: '.queryParam("sort", "price_asc")' },
    { label: 'No hand-built query string', pattern: '"[^"]*\\?[a-z]+=', mustNot: true, hint: 'Let queryParam build ?sort=...&page=...' },
    { label: 'No URL concatenation', pattern: '\\.get\\(\\s*"[^"]*"\\s*\\+', mustNot: true, hint: 'Use pathParam/queryParam instead of +.' },
    { label: 'Checks the first product of the page', pattern: '"data\\[0\\]\\.name"\\s*,\\s*equalTo\\(\\s*"Junior Onesie"', hint: '.body("data[0].name", equalTo("Junior Onesie"))' },
  ],
  hints: [
    'pathParam fills a {placeholder} in the path; queryParam adds ?key=value after it.',
    'RestAssured URL-encodes parameter values for you — spaces and & in a search term just work.',
    'data[0].name = the "name" of the first element of the "data" array.',
  ],
  explanation: `**Path parameters** identify *which* resource (\`/api/products/{id}\`); **query parameters** refine a collection
(sorting, paging, searching). RestAssured builds and encodes both, so a value like \`q=crew t-shirt\` is sent correctly
and the URL template stays readable in the logs.

The paging assertions are deliberate: \`size\`, \`total\` and \`totalPages\` are what the mobile app uses to draw the
"page 1 of 2" control, so they are business rules, not decoration. Asserting \`data[0].name\` proves the sort was applied.

Note: \`equalTo(4)\` works for whole numbers because RestAssured reads JSON integers as \`Integer\`. Decimals are read as
\`Float\` by default — you will meet that gotcha in the next problems.`,
  mistakes: [
    'Concatenating URLs by hand — forgotten "&", double "?" and unencoded spaces are common.',
    'Using queryParam for an id that belongs in the path (or the reverse) — the API answers 404 or ignores it.',
    'Asserting only the status — a sort that is silently ignored still returns 200.',
    'Hard-coding page sizes that depend on catalogue data without resetting data first (POST /api/reset).',
  ],
  interview: [
    { q: 'Path parameter vs query parameter?', a: 'A path parameter is part of the resource identity (/products/4). A query parameter filters, sorts or pages a collection (?sort=price_asc&page=2) and is usually optional.' },
    { q: 'How would you test paging thoroughly?', a: 'Boundary values: first page, last page, a page beyond the end (empty data or 400), size 1 and the maximum size, size 0 or negative (400). Also check total/totalPages stay consistent and that no item appears on two pages.' },
  ],
}
