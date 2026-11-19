export default {
  slug: 'api-restassured-basics',
  category: 'restassured',
  order: 2,
  title: 'Your first RestAssured test: given / when / then, path and query params',
  minutes: 10,
  summary: 'Write a TestNG test that sends a GET with RestAssured, uses path and query parameters, and checks status, headers and a body value.',
  manualAnalogy: `In Postman you set the URL, fill the **Params** tab (\`sort = price_asc\`), press Send and look at the status and body. RestAssured is the same three moves written as one Java sentence: *given* this setup, *when* I call this URL, *then* I expect this result.`,
  body: `## Setting up

RestAssured is a Java library. Add it to \`pom.xml\` (next to TestNG):

\`\`\`xml
<dependency>
  <groupId>io.rest-assured</groupId>
  <artifactId>rest-assured</artifactId>
  <version>5.5.0</version>
  <scope>test</scope>
</dependency>
\`\`\`

Then use **static imports** so the code reads like English:

\`\`\`java
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
\`\`\`

\`import static\` brings the *methods* \`given()\`, \`when()\`, \`equalTo()\` … into your class, so you write \`given()\` instead of \`RestAssured.given()\`.

## The given / when / then sentence

\`\`\`java
public class ProductsSmokeTest {

    @BeforeClass
    public void setUp() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    @Test
    public void storm_jacket_is_returned() {
        given()
            .accept(ContentType.JSON)
        .when()
            .get("/api/products/4")
        .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("name", equalTo("Storm Fleece Jacket"));
    }
}
\`\`\`

Line by line:
- \`RestAssured.baseURI\` is set once, so each test only writes the path. Changing environments later means changing one line (later: a config file).
- \`given()\` is the **setup**: headers, params, body, auth. \`.accept(ContentType.JSON)\` adds \`Accept: application/json\`.
- \`.when().get(path)\` **sends** the request. Other verbs: \`.post()\`, \`.put()\`, \`.patch()\`, \`.delete()\`.
- \`.then()\` switches to **verification**. \`.statusCode(200)\` fails the test with a clear message if the status is anything else. \`.body("name", equalTo(...))\` reads the \`name\` field from the JSON and compares it.
- The indentation is only for humans. It is one long chain of method calls ending in \`;\`.

If an assertion fails you get a message like *Expected status code <200> but was <404>* — the same thing you would write in a defect.

## Path parameters: the id in the URL

Hard-coding \`"/api/products/4"\` works, but RestAssured can fill placeholders for you:

\`\`\`java
given()
    .pathParam("userId", 3)
.when()
    .get("/api/users/{userId}")
.then()
    .statusCode(200)
    .body("username", equalTo("visual_user"));
\`\`\`

\`{userId}\` in the path is replaced by the value of \`pathParam("userId", 3)\`. Why bother? The log and report show the *template* and the value separately, values are URL-encoded safely, and the same path string can be reused in a helper. A shorter form passes values in order: \`.get("/api/users/{id}", 3)\`.

## Query parameters: the part after ?

\`\`\`java
given()
    .queryParam("q", "tee")
    .queryParam("size", 5)
.when()
    .get("/api/products")
.then()
    .statusCode(200)
    .body("total", equalTo(1));
\`\`\`

RestAssured builds \`/api/products?q=tee&size=5\` for you, with correct encoding (spaces, \`&\`, accents). Several at once: \`.queryParams(Map.of("q", "tee", "size", 5))\`. Never glue query strings by hand with \`+\` — one missing \`&\` and you test the wrong thing.

| Postman tab | RestAssured |
|---|---|
| URL path variable \`:id\` | \`.pathParam("id", 3)\` + \`{id}\` |
| Params | \`.queryParam("page", 2)\` |
| Headers | \`.header("X-Trace", "abc")\` / \`.accept(...)\` / \`.contentType(...)\` |
| Tests tab: status | \`.statusCode(200)\` |

## Walking through pages

A list endpoint rarely returns everything at once. ShopEasy answers \`{ data, page, size, total, totalPages }\`, and a client keeps asking for the next page until it reaches \`totalPages\`. A test can do the same with an ordinary Java loop, with the page number in a **variable**:

\`\`\`java
List<String> names = new ArrayList<>();
int page = 1;
int lastPage;
do {
    JsonPath json = given()
        .queryParam("sort", "za")
        .queryParam("size", 5)
        .queryParam("page", page)
    .when().get("/api/products")
    .then().statusCode(200)
    .extract().jsonPath();

    names.addAll(json.getList("data.name", String.class));
    lastPage = json.getInt("totalPages");
    page++;
} while (page <= lastPage);
\`\`\`

- \`extract().jsonPath()\` hands you the response so you can read \`totalPages\` and the names (more on this in the *Asserting responses* lesson).
- The loop asks the API how many pages there are, so it keeps working when products are added.
- Afterwards you can compare the pages *together*: is the number of names equal to \`total\`? Did any name appear twice? Paging bugs hide between pages, where a one-page check never looks.

Then test the edges you would test by hand: the last page, one page after the last (ShopEasy answers 200 with an empty \`data\` list), and sizes outside the allowed 1–50 (400 \`INVALID_QUERY\` with the offending field in \`error.details\`).

## Seeing what happened

When a test fails and you don't know why, add logging:

\`\`\`java
given().log().all()          // prints the request
.when().get("/api/products")
.then().log().ifValidationFails().statusCode(200);   // prints the response only on failure
\`\`\`

## Getting the whole response

Sometimes you want the response object to inspect it yourself:

\`\`\`java
Response response = given().when().get("/api/health");
System.out.println(response.getStatusCode() + " " + response.asPrettyString());
\`\`\`

Use this for debugging; for checks, prefer the \`then()\` assertions — they produce better failure messages.`,
  keyPoints: [
    'Static-import RestAssured.* and Matchers.* so tests read given / when / then.',
    'Set RestAssured.baseURI once; tests only contain paths.',
    'Path params fill {placeholders} in the path; query params build the ?key=value part with safe encoding.',
    'then().statusCode(...) and body(path, matcher) are your assertions; failures read like defect reports.',
    'log().all() and log().ifValidationFails() show you exactly what was sent and received.',
    'To test paging, loop over the pages using totalPages from the API and compare the pages together (count, duplicates).',
  ],
  mistakes: [
    'Concatenating URLs and query strings by hand — use pathParam/queryParam instead.',
    'Writing the full URL including host in every test — set baseURI once so environments can change.',
    'Calling .then() without any assertion — the test "passes" even when the server returned 500.',
    'Forgetting the static imports and getting "cannot find symbol: given()".',
  ],
  tryIt: `With \`npm run api\` running, try \`http://localhost:5181/api/products?sort=za&size=2&page=2\` in the browser and write down the names returned. Then sketch the given/when/then chain that would send the same request with three \`queryParam\` calls and assert the \`page\` and \`size\` fields.`,
  problems: ['api-002', 'api-003', 'api-021'],
}
