export default {
  id: 'api-021',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Search and walk every page of the catalogue',
  level: 'BEGINNER',
  tags: ['query-params', 'pagination', 'search', 'loops'],
  estMinutes: 25,
  scenario: `The mobile app's new "load more" catalogue scroll went to beta testers, and two of them sent the same
screenshot: the Pulse Bike Light appeared twice and the Retro Red Tee never appeared. The cause was an off-by-one in
the paging code. The existing API test only checks page 1, so it kept passing. Your lead asks for tests that walk
**every** page the way the app does, plus the search box ("t-SHIRT" typed in capitals must still find the tee) and
the edge cases at both ends of paging.`,
  description: `Against \`GET http://localhost:5181/api/products\` (the API answers \`{ data, page, size, total, totalPages }\`):

1. **searchIsCaseInsensitive** — \`q=t-SHIRT\` → 200, \`total\` 1, \`data[0].id\` 3 and \`data[0].name\`
   \`"Classic Crew T-Shirt"\`.
2. **everyProductAppearsExactlyOnce** — with \`size=4\`, request page 1, read \`totalPages\` from the response, and **loop**
   until you have fetched the last page. Collect every \`data.id\` into a list. Assert \`totalPages\` is 2, the number of
   ids collected equals \`total\`, and there are **no duplicates** (compare with a \`HashSet\`).
3. **pageAfterTheLastIsEmpty** — \`page=3&size=4\` → 200, \`data\` is an empty list, \`total\` is still 6.
4. **sizeZeroIsRejected** — \`size=0\` → **400**, \`error.code\` \`"INVALID_QUERY"\` and \`error.details.field\` has the item \`"size"\`.

**Rules**
- Every parameter is sent with \`queryParam(...)\`; the page number in the loop comes from a **variable**, not a literal.
- Do not hard-code how many pages there are in the loop condition — use \`totalPages\` from the API.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueSearchPagingTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void searchIsCaseInsensitive() {
        // TODO: q=t-SHIRT
    }

    @Test
    public void everyProductAppearsExactlyOnce() {
        // what the old test did: only looks at two hard-coded pages, never compares them
        given().baseUri(BASE_URI).queryParam("page", 1).queryParam("size", 4)
        .when().get("/api/products")
        .then().statusCode(200);

        given().baseUri(BASE_URI).queryParam("page", 2).queryParam("size", 4)
        .when().get("/api/products")
        .then().statusCode(200);
    }

    // TODO: pageAfterTheLastIsEmpty, sizeZeroIsRejected
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.path.json.JsonPath;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueSearchPagingTest {

    private static final String BASE_URI = "http://localhost:5181";
    private static final int PAGE_SIZE = 4;

    @Test
    public void searchIsCaseInsensitive() {
        given()
            .baseUri(BASE_URI)
            .queryParam("q", "t-SHIRT")
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("total", equalTo(1))
            .body("data[0].id", equalTo(3))
            .body("data[0].name", equalTo("Classic Crew T-Shirt"));
    }

    @Test
    public void everyProductAppearsExactlyOnce() {
        List<Integer> seenIds = new ArrayList<>();
        int totalPages = 1;   // updated from the first response
        int total = 0;

        for (int page = 1; page <= totalPages; page++) {
            JsonPath json = given()
                .baseUri(BASE_URI)
                .queryParam("page", page)
                .queryParam("size", PAGE_SIZE)
            .when()
                .get("/api/products")
            .then()
                .statusCode(200)
                .body("page", equalTo(page))
                .extract().jsonPath();

            totalPages = json.getInt("totalPages");
            total = json.getInt("total");
            seenIds.addAll(json.getList("data.id", Integer.class));
        }

        Assert.assertEquals(totalPages, 2, "6 products at 4 per page");
        Assert.assertEquals(seenIds.size(), total, "Products collected across all pages");
        Assert.assertEquals(new HashSet<>(seenIds).size(), seenIds.size(),
            "A product appeared on more than one page: " + seenIds);
    }

    @Test
    public void pageAfterTheLastIsEmpty() {
        given()
            .baseUri(BASE_URI)
            .queryParam("page", 3)
            .queryParam("size", PAGE_SIZE)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("data", empty())
            .body("total", equalTo(6));
    }

    @Test
    public void sizeZeroIsRejected() {
        given()
            .baseUri(BASE_URI)
            .queryParam("size", 0)
        .when()
            .get("/api/products")
        .then()
            .statusCode(400)
            .body("error.code", equalTo("INVALID_QUERY"))
            .body("error.details.field", hasItem("size"));
    }
}
`,
  checks: [
    { label: 'Searches with the q query parameter', pattern: '\\.queryParams?\\(\\s*"q"', hint: '.queryParam("q", "t-SHIRT")' },
    { label: 'Loops over the pages', pattern: '(for|while)\\s*\\(', hint: 'for (int page = 1; page <= totalPages; page++) { ... }' },
    { label: 'Page number comes from a variable', pattern: '\\.queryParam\\(\\s*"page"\\s*,\\s*[a-zA-Z_]\\w*\\s*\\)', hint: '.queryParam("page", page) inside the loop' },
    { label: 'Checks for duplicates across pages', pattern: '(new\\s+HashSet|\\.distinct\\(\\))', hint: 'Assert.assertEquals(new HashSet<>(seenIds).size(), seenIds.size())' },
    { label: 'Page after the last one is empty', pattern: '"data"\\s*,\\s*(empty\\(\\)|hasSize\\(\\s*0\\s*\\))', hint: '.body("data", empty())' },
    { label: 'size=0 reports the size field', pattern: '"error\\.details\\.field"\\s*,\\s*hasItem\\(\\s*"size"', hint: '.body("error.details.field", hasItem("size"))' },
  ],
  hints: [
    'Start with totalPages = 1, then overwrite it from the first response — the loop then runs as many times as the API says.',
    'json.getList("data.id", Integer.class) gives you the ids of one page; addAll them to a list outside the loop.',
    'A HashSet drops duplicates, so if its size is smaller than the list, some id was returned twice.',
  ],
  explanation: `Paging bugs hide **between** pages, so a test must look at the pages together. The loop reads
\`totalPages\` from the API instead of hard-coding "2", which means the test keeps working when the catalogue grows —
and it fails loudly if \`totalPages\` is ever wrong, because \`seenIds.size()\` will no longer equal \`total\`.

The two set-based assertions catch exactly the beta testers' bug: a duplicate makes the \`HashSet\` smaller than the list,
and a missing product makes the list shorter than \`total\`.

The edge cases are classic boundary-value analysis, which you already do by hand:

| Input | Expected |
|---|---|
| last page (2) | the remaining 2 products |
| one after the last (3) | 200 with an empty \`data\` list, \`total\` unchanged |
| \`size=0\` (below the minimum of 1) | 400 \`INVALID_QUERY\` naming the \`size\` field |

\`q=t-SHIRT\` checks that search is case-insensitive — a manual tester's instinct (type it the way users do), now
automated.`,
  mistakes: [
    'Checking each page on its own — duplicates and gaps only show up when you compare pages.',
    'Hard-coding the loop to 2 pages — the test silently stops covering new pages when products are added.',
    'Treating "page after the last" as an error — this API returns 200 with an empty list; know the contract before asserting.',
    'Building "?page=" + page by hand inside the loop instead of queryParam("page", page).',
  ],
  interview: [
    { q: 'How do you test pagination?', a: 'Walk all pages and collect ids: count equals total, no duplicates, nothing missing. Then the boundaries: first and last page, one past the last, size 1 and the maximum size, size 0 or above the max (400), and a sort applied consistently across pages.' },
    { q: 'What is a risk of offset paging that you would mention to developers?', a: 'If data is added or deleted while a client is paging, items shift between pages and can be skipped or repeated. Cursor (keyset) paging avoids that. Tests should run on stable data, for example after a reset.' },
    { q: 'Why read totalPages from the response instead of calculating it in the test?', a: 'The test follows the API the way a client does, so it adapts to data changes, and any inconsistency between totalPages, total and the real number of items becomes a failing assertion instead of a hidden assumption.' },
  ],
}
