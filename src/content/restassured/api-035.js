export default {
  id: 'api-035',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Hamcrest on a paged, price-sorted product list (hasSize, everyItem, contains)',
  level: 'INTERMEDIATE',
  tags: ['hamcrest', 'pagination', 'sorting', 'assertions'],
  estMinutes: 25,
  scenario: `The mobile app shows the catalogue 4 products per screen, cheapest first. A bug report says "page 2 sometimes
repeats a product from page 1 and the last page has empty cards". The current test only does
\`assertTrue(body.contains("Junior Onesie"))\`, which passed while the bug was live. You will rewrite it with Hamcrest
matchers that pin down the page size, the order, the paging fields and the shape of every item.`,
  description: `Call \`GET http://localhost:5181/api/products?sort=price_asc&size=4\` with \`queryParam\`s.

**Test 1 — firstPageCheapestFirst** (\`page=1\`):
- \`data\` \`hasSize(4)\`; \`page\` is 1, \`total\` is 6, \`totalPages\` is 2
- \`data.name\` is **exactly, in order** \`"Junior Onesie", "Pulse Bike Light", "Classic Crew T-Shirt", "Retro Red Tee"\` (\`contains\`)
- every \`data.price\` is \`lessThanOrEqualTo(15.99f)\`
- every item in \`data\` \`hasKey("inStock")\` and \`hasKey("price")\` (\`everyItem(allOf(...))\`)

**Test 2 — lastPageHasTheRest** (\`page=2\`):
- \`data\` \`hasSize(2)\`
- \`data.id\` \`containsInAnyOrder(1, 4)\` — no product from page 1 repeated
- every \`data.price\` is \`greaterThan(20f)\`

**Rules:** Hamcrest only (no \`assertTrue\`, no string \`contains\`), prices as Float (\`15.99f\`).`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CataloguePagingTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void firstPageCheapestFirst() {
        String body = given().baseUri(BASE_URI)
            .when().get("/api/products?sort=price_asc&size=4&page=1")
            .then().statusCode(200)
            .extract().asString();
        Assert.assertTrue(body.contains("Junior Onesie"));
    }

    @Test
    public void lastPageHasTheRest() {
        // TODO: page=2 — two products, no repeats, both above 20
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CataloguePagingTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void firstPageCheapestFirst() {
        given()
            .baseUri(BASE_URI)
            .queryParam("sort", "price_asc")
            .queryParam("size", 4)
            .queryParam("page", 1)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("data", hasSize(4))
            .body("page", equalTo(1))
            .body("total", equalTo(6))
            .body("totalPages", equalTo(2))
            .body("data.name", contains("Junior Onesie", "Pulse Bike Light", "Classic Crew T-Shirt", "Retro Red Tee"))
            .body("data.price", everyItem(lessThanOrEqualTo(15.99f)))
            .body("data", everyItem(allOf(hasKey("inStock"), hasKey("price"))));
    }

    @Test
    public void lastPageHasTheRest() {
        given()
            .baseUri(BASE_URI)
            .queryParam("sort", "price_asc")
            .queryParam("size", 4)
            .queryParam("page", 2)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("data", hasSize(2))
            .body("data.id", containsInAnyOrder(1, 4))
            .body("data.price", everyItem(greaterThan(20f)));
    }
}
`,
  checks: [
    { label: 'Sends paging/sorting with queryParam', pattern: 'queryParam\\(\\s*"(size|page|sort)"', hint: '.queryParam("size", 4) instead of building the URL by hand' },
    { label: 'Checks the page size with hasSize', pattern: 'hasSize\\(\\s*4\\s*\\)', hint: '.body("data", hasSize(4))' },
    { label: 'Checks exact order with contains(...)', pattern: '"data\\.name"\\s*,\\s*contains\\(', hint: 'contains("Junior Onesie", ...) = exactly these, in this order' },
    { label: 'Uses everyItem with a comparison matcher', pattern: 'everyItem\\(\\s*(lessThanOrEqualTo|lessThan|greaterThan)\\(', hint: '.body("data.price", everyItem(lessThanOrEqualTo(15.99f)))' },
    { label: 'Checks item shape with everyItem(... hasKey ...)', pattern: 'everyItem\\(\\s*(allOf\\(\\s*)?hasKey\\(', hint: '.body("data", everyItem(allOf(hasKey("inStock"), hasKey("price"))))' },
    { label: 'Last page: no repeats via containsInAnyOrder', pattern: 'containsInAnyOrder\\(', hint: '.body("data.id", containsInAnyOrder(1, 4))' },
    { label: 'No assertTrue / raw string contains', pattern: '(assertTrue|\\.contains\\(\\s*")', mustNot: true, hint: 'Let Hamcrest describe the expectation instead.' },
  ],
  hints: [
    '"data" is the list of maps; "data.price" is the list of all prices on this page.',
    'hasSize is for the list itself, contains/containsInAnyOrder are for its exact elements.',
    'Classic Crew T-Shirt and Retro Red Tee both cost 15.99 — ties are ordered by id, so 3 comes before 6.',
  ],
  explanation: `Each matcher pins one part of the bug report:

| Matcher | Catches |
|---|---|
| \`hasSize(4)\` / \`hasSize(2)\` | short or overfull pages, "empty cards" |
| \`contains(...)\` | wrong sort order (order matters) |
| \`containsInAnyOrder(1, 4)\` | a product from page 1 repeated on page 2 |
| \`everyItem(lessThanOrEqualTo(15.99f))\` | an expensive item leaking onto the "cheapest" page |
| \`everyItem(allOf(hasKey(...)))\` | items with missing fields (the empty cards) |

\`hasItems\` would have passed with the bug, because it only checks that *some* values are present. When a matcher fails
RestAssured prints the expected description and the actual list, so the bug report writes itself.`,
  mistakes: [
    'Using hasItems where the rule is "exactly these" — extra or repeated items slip through.',
    'Comparing prices with 15.99 (Double) instead of 15.99f — the matcher never matches a Float.',
    'Writing the query string into the path — queryParam encodes values and keeps the URL readable.',
    'Assuming ties in a sort are stable — check how the API breaks ties (here: by id).',
  ],
  interview: [
    { q: 'How do you test pagination of an API?', a: 'Check the page size with hasSize, the paging metadata (page, total, totalPages), that the last page has the remainder, and that pages do not overlap — for example by collecting ids from every page and asserting there are no duplicates and the count equals total.' },
    { q: 'Why does everyItem(greaterThan(0)) throw on a list of prices?', a: 'JSON decimals arrive as Float, and greaterThan(0) compares with an Integer, which leads to a ClassCastException. Use 0f or configure RestAssured to return BigDecimal and compare with BigDecimal values.' },
  ],
}
