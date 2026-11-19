export default {
  id: 'dbg-038',
  category: 'debugging',
  kind: 'code',
  title: 'ClassCastException: ArrayList cannot be cast to String — JsonPath returned a list',
  level: 'ADVANCED',
  tags: ['restassured', 'json-path', 'ClassCastException', 'GPath', 'lists', 'hamcrest'],
  estMinutes: 20,
  scenario: `The ShopEasy search API (\`GET http://localhost:5181/api/products?q=backpack\`) gets a new regression test. The author tried the path \`data.name\` in a JSON viewer, saw *"Trailblazer Backpack"*, and wrote the test as if it were one value. Jenkins shows a ClassCastException and an assertion that prints the same name on both sides — one with square brackets. The API team asks: "is search broken?"`,
  description: `Response (shortened):

\`\`\`json
{ "data": [ { "id": 1, "slug": "trailblazer-backpack", "name": "Trailblazer Backpack", "price": 29.99,
              "category": "bags", "stock": 25, "inStock": true } ],
  "page": 1, "size": 10, "total": 1, "totalPages": 1 }
\`\`\`

Console output:

\`\`\`text
[ERROR] searchFindsBackpack(com.shopeasy.api.SearchApiTest)  <<< FAILURE!
java.lang.AssertionError: 1 expectation failed.
JSON path data.name doesn't match.
Expected: Trailblazer Backpack
  Actual: [Trailblazer Backpack]

[ERROR] backpackStockFromSearch(com.shopeasy.api.SearchApiTest)  <<< ERROR!
java.lang.ClassCastException: class java.util.ArrayList cannot be cast to class java.lang.String
	at com.shopeasy.api.SearchApiTest.backpackStockFromSearch(SearchApiTest.java:41)
\`\`\`

**Diagnose:** \`data\` is an **array**. In GPath, \`data.name\` means "the name of *every* item in data", so it always returns a \`List\` — even with one result. The square brackets in \`[Trailblazer Backpack]\` are the list.

**Fix the tests (test bug, not API bug):**
- Assert \`total\` is 1 and that the list of names **contains** the backpack (\`hasItem\`).
- Extract one name with an index: \`data[0].name\`.
- Extract all names as \`List<String>\` with \`jsonPath().getList("data.name", String.class)\`.
- Read the backpack's stock by **finding it by slug** (\`data.find { it.slug == 'trailblazer-backpack' }.stock\`), not by position.`,
  hints: [
    'Square brackets in the "Actual" value, or ArrayList in the exception, mean the path returned a list.',
    'data[0].name picks the first element; data.name collects from all elements.',
    'GPath can filter: data.find { it.slug == \'trailblazer-backpack\' }.stock',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SearchApiTest {

    private static final String BASE = "http://localhost:5181/api";

    @Test
    public void searchFindsBackpack() {
        given().baseUri(BASE).queryParam("q", "backpack")
        .when().get("/products")
        .then().statusCode(200)
            .body("data.name", equalTo("Trailblazer Backpack"));   // Actual: [Trailblazer Backpack]
    }

    @Test
    public void backpackStockFromSearch() {
        Response res = given().baseUri(BASE).queryParam("q", "backpack")
            .when().get("/products")
            .then().statusCode(200).extract().response();

        String name = res.path("data.name");                       // line 41 - ClassCastException
        int stock = res.path("data.stock");
        Assert.assertEquals(name, "Trailblazer Backpack");
        Assert.assertEquals(stock, 25);
    }
}
`,
  solution: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

import io.restassured.response.Response;
import java.util.List;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SearchApiTest {

    private static final String BASE = "http://localhost:5181/api";

    @Test
    public void searchFindsBackpack() {
        given().baseUri(BASE).queryParam("q", "backpack")
        .when().get("/products")
        .then().statusCode(200)
            .body("total", equalTo(1))
            .body("data.name", hasItem("Trailblazer Backpack"))   // data.name is a List
            .body("data[0].name", equalTo("Trailblazer Backpack"));
    }

    @Test
    public void backpackStockFromSearch() {
        Response res = given().baseUri(BASE).queryParam("q", "backpack")
            .when().get("/products")
            .then().statusCode(200).extract().response();

        // one value: index into the array
        String firstName = res.path("data[0].name");

        // all values: ask for a typed list
        List<String> names = res.jsonPath().getList("data.name", String.class);

        // the item we care about, found by a stable key instead of its position
        int stock = res.path("data.find { it.slug == 'trailblazer-backpack' }.stock");

        Assert.assertEquals(firstName, "Trailblazer Backpack");
        Assert.assertTrue(names.contains("Trailblazer Backpack"), "names were " + names);
        Assert.assertEquals(stock, 25);
    }
}
`,
  checks: [
    { label: 'Uses an index for a single value (data[0])', pattern: 'data\\[\\s*0\\s*\\]\\.\\w+', hint: 'res.path("data[0].name")' },
    { label: 'Extracts all names as a typed List', pattern: 'getList\\s*\\(\\s*"data\\.name"', hint: 'res.jsonPath().getList("data.name", String.class)' },
    { label: 'Asserts list membership with hasItem / hasItems', pattern: '\\b(hasItem|hasItems)\\s*\\(', hint: '.body("data.name", hasItem("Trailblazer Backpack"))' },
    { label: 'Finds the backpack by slug with GPath find', pattern: 'data\\.find\\s*\\{\\s*it\\.slug\\s*==', hint: 'data.find { it.slug == \'trailblazer-backpack\' }.stock' },
    { label: 'No single value read straight from a list path', pattern: '(String|int|Integer)\\s+\\w+\\s*=\\s*\\w+\\.path\\s*\\(\\s*"data\\.\\w+"\\s*\\)', mustNot: true, hint: '"data.name" / "data.stock" return a List — use an index, getList or find' },
  ],
  explanation: `**Root cause:** in RestAssured's GPath, a path through an array **collects** values: \`data.name\` → \`List<String>\`, \`data.stock\` → \`List<Integer>\`. It does not matter that the list has one element. \`res.path(...)\` is generic (\`<T> T path(...)\`), so Java compiles \`String name = res.path("data.name")\` happily and only fails at runtime with a ClassCastException. The Hamcrest message shows the same thing more gently: \`[Trailblazer Backpack]\` — brackets mean List.

**Pick the right tool:**
- One element by position: \`data[0].name\` (fine when the API guarantees order or one result).
- All values: \`jsonPath().getList("data.name", String.class)\` and Hamcrest \`hasItem\` / \`hasSize\` / \`everyItem\`.
- One element by a business key: \`data.find { it.slug == 'trailblazer-backpack' }\` — robust when search results get re-ordered. Use \`findAll\` for many.

**Reviewer checklist:** assert \`total\` too (search returning 6 items is a real bug), never rely on position when a key exists, and keep the generic \`path()\` return type in mind.`,
  mistakes: [
    'Reading "data.name" into a String because the JSON viewer showed one value.',
    'Casting with (String) or toString() — the second gives "[Trailblazer Backpack]" and the assertion still fails.',
    'Always using data[0] even when the order of search results is not guaranteed.',
    'Reporting a search bug to the API team without checking the type in the message.',
  ],
  interview: [
    { q: 'What does data.name return when data is a JSON array?', a: 'A List with the name of every element, because GPath collects through arrays. To get one value I index with data[0].name or filter with data.find { ... }.name; to get all of them I use jsonPath().getList("data.name", String.class).' },
    { q: 'Why does the code compile but fail at runtime?', a: 'Response.path and JsonPath.get are generic methods, so the compiler infers whatever type you assign to. The actual object is an ArrayList, and the implicit cast fails when the line runs. That is why I prefer typed helpers like getList, getString or extracting into a POJO.' },
    { q: 'How do you select an item from an array by a field value?', a: 'With GPath closures: find returns the first match, findAll returns all matches, for example data.find { it.slug == \'trailblazer-backpack\' }.price or data.findAll { it.price < 20 }.name.' },
  ],
}
