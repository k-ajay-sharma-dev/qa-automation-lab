export default {
  id: 'api-004',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Assert the catalogue with Hamcrest matchers and JsonPath',
  level: 'BEGINNER',
  tags: ['hamcrest', 'jsonpath', 'gpath', 'assertions'],
  estMinutes: 25,
  scenario: `The merchandising team is loading the winter catalogue. Their checklist for the catalogue API is exactly what
you used to check by eye in Postman: all 6 products are returned, the two best-sellers are there, no product has a zero
or negative price, the out-of-stock tee is flagged, and "sort by name" really is alphabetical. Your job is to turn that
checklist into one readable test class.`,
  description: `Against \`GET http://localhost:5181/api/products\`:

**Test 1 — catalogueContents** (one request, Hamcrest only):
- \`data.size()\` is **6**
- \`data.name\` has the items \`"Trailblazer Backpack"\` and \`"Pulse Bike Light"\`
- every \`data.price\` is greater than 0
- the names of products where \`inStock == false\` contain \`"Retro Red Tee"\` (GPath \`findAll\`)

**Test 2 — sortedByName**: call with \`sort=name_asc\`, extract the names with
\`.extract().jsonPath().getList("data.name", String.class)\` and assert (TestNG \`Assert\`) that the list equals a sorted copy.

**Rules**
- Use \`hasItems\`, \`everyItem\` and \`greaterThan\` from \`org.hamcrest.Matchers\`.
- Remember RestAssured reads JSON decimals as **Float** — compare prices with \`0f\`, not \`0\` or \`0.0\`.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueContentTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void catalogueContents() {
        String body = given().baseUri(BASE_URI)
            .when().get("/api/products")
            .then().statusCode(200)
            .extract().asString();
        // TODO: this is how we did it in Postman by eye... replace with matchers
        Assert.assertTrue(body.contains("Trailblazer Backpack"));
    }

    @Test
    public void sortedByName() {
        // TODO: call with sort=name_asc, extract the names, compare with a sorted copy
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CatalogueContentTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void catalogueContents() {
        given()
            .baseUri(BASE_URI)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .body("data.size()", equalTo(6))
            .body("data.name", hasItems("Trailblazer Backpack", "Pulse Bike Light"))
            .body("data.price", everyItem(greaterThan(0f)))
            .body("data.findAll { it.inStock == false }.name", hasItem("Retro Red Tee"));
    }

    @Test
    public void sortedByName() {
        List<String> names = given()
            .baseUri(BASE_URI)
            .queryParam("sort", "name_asc")
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .extract().jsonPath().getList("data.name", String.class);

        List<String> expected = new ArrayList<>(names);
        Collections.sort(expected);

        Assert.assertEquals(names.size(), 6, "Product count");
        Assert.assertEquals(names, expected, "Products are not sorted A-Z");
    }
}
`,
  checks: [
    { label: 'Counts items with data.size()', pattern: '"data\\.size\\(\\)"\\s*,\\s*equalTo\\(\\s*6\\s*\\)', hint: '.body("data.size()", equalTo(6))' },
    { label: 'Uses hasItems on the names', pattern: '"data\\.name"\\s*,\\s*hasItems\\(', hint: '.body("data.name", hasItems("Trailblazer Backpack", "Pulse Bike Light"))' },
    { label: 'Uses everyItem(greaterThan(...)) on prices', pattern: 'everyItem\\(\\s*greaterThan\\(', hint: '.body("data.price", everyItem(greaterThan(0f)))' },
    { label: 'Uses a GPath findAll filter', pattern: 'findAll\\s*\\{', hint: '"data.findAll { it.inStock == false }.name"' },
    { label: 'Extracts a list with jsonPath().getList', pattern: 'jsonPath\\(\\)\\s*\\.getList\\(\\s*"data\\.name"', hint: '.extract().jsonPath().getList("data.name", String.class)' },
    { label: 'No raw string contains() checks', pattern: '\\.contains\\(\\s*"', mustNot: true, hint: 'Assert on JSON fields, not on the raw body text.' },
  ],
  hints: [
    'A path on a list applies to every element: "data.name" is the list of all product names.',
    'data.size() is GPath (Groovy) — the number of elements in the data array.',
    'findAll { it.inStock == false } keeps only matching elements; add .name to get their names.',
  ],
  explanation: `RestAssured uses **GPath** (Groovy's JSON path) on the left of \`body(...)\` and **Hamcrest matchers** on the right:

| Path | Means |
|---|---|
| \`data.size()\` | number of products |
| \`data.name\` | list of every product name |
| \`data[0].price\` | price of the first product |
| \`data.findAll { it.inStock == false }.name\` | names of out-of-stock products |

Matchers describe the *expectation* in words: \`hasItems\` (contains at least these), \`everyItem(greaterThan(0f))\`
(rule for all rows). When one fails, the message shows the whole actual list — far better than \`assertTrue(false)\`.

Use \`jsonPath().getList(...)\` when you need the data in Java to do something matchers cannot express easily, like
"equals a sorted copy". The \`0f\` matters: JSON \`29.99\` becomes a \`Float\`, and \`greaterThan(0)\` would compare a Float
with an Integer and throw a ClassCastException.`,
  mistakes: [
    'Comparing decimals with equalTo(29.99) — RestAssured gives a Float, so use 29.99f or configure BigDecimal.',
    'Using hasItem/hasItems when you mean "exactly these" — use contains(...) or containsInAnyOrder(...) for exact lists.',
    'Asserting on body.contains("...") — passes when the text appears anywhere, even in an error message.',
    'Sorting the extracted list in place and comparing it with itself — always sort a copy.',
  ],
  interview: [
    { q: 'hasItems vs contains vs containsInAnyOrder?', a: 'hasItems: the list includes at least these values. contains: exactly these values in this order. containsInAnyOrder: exactly these values, any order. Pick the one that matches the requirement.' },
    { q: 'When do you extract instead of asserting in then()?', a: 'When the check needs Java logic (sorting, sums, comparing two responses) or when the value is needed in the next request. Simple field checks stay in then() because the failure messages are better.' },
  ],
}
