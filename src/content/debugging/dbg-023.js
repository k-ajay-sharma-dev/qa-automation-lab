export default {
  id: 'dbg-023',
  category: 'debugging',
  kind: 'code',
  title: 'UnrecognizedPropertyException and a null from data[0]: the API changed under the POJO',
  level: 'INTERMEDIATE',
  tags: ['restassured', 'jackson', 'deserialization', 'pojo', 'json-path', 'null-vs-empty'],
  estMinutes: 20,
  scenario: `The backend team shipped ShopEasy API 1.0.0: products now include a computed \`inStock\` flag, and the old product "Bike Lamp" was renamed to **Pulse Bike Light**. The next morning two of your RestAssured tests are red. The developers say "we only *added* a field and renamed a product — that can't break anything." Your job: explain both failures and make the tests robust for the right reasons.`,
  description: `Failure 1 — deserialising \`GET /api/products/1\` into the \`Product\` POJO:

\`\`\`text
[ERROR] backpackDetails(com.shopeasy.api.tests.ProductApiTest)  Time elapsed: 0.389 s  <<< ERROR!
com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException: Unrecognized field "inStock" (class com.shopeasy.api.model.Product), not marked as ignorable (7 known properties: "id", "slug", "name", "price", "category", "stock", "description"])
 at [Source: (String)"{
  "id": 1,
  "slug": "trailblazer-backpack",
  "name": "Trailblazer Backpack",
  "price": 29.99,
  "category": "bags",
  "stock": 25,
  "inStock": true,
  "description": "Water-resistant 22L daypack with a padded laptop sleeve."
}"; line: 8, column: 15] (through reference chain: com.shopeasy.api.model.Product["inStock"])
	at com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException.from(UnrecognizedPropertyException.java:61)
	at com.fasterxml.jackson.databind.DeserializationContext.handleUnknownProperty(DeserializationContext.java:1153)
	at io.restassured.internal.mapping.Jackson2Mapper.deserialize(Jackson2Mapper.groovy:57)
	at io.restassured.internal.RestAssuredResponseOptionsGroovyImpl.as(RestAssuredResponseOptionsGroovyImpl.groovy:229)
	at com.shopeasy.api.tests.ProductApiTest.backpackDetails(ProductApiTest.java:27)
\`\`\`

Failure 2 — \`GET /api/products?q=lamp\`:

\`\`\`text
[ERROR] searchFindsTheBikeLight(com.shopeasy.api.tests.ProductApiTest)  Time elapsed: 0.122 s  <<< ERROR!
java.lang.NullPointerException: Cannot invoke "String.contains(java.lang.CharSequence)" because "firstName" is null
	at com.shopeasy.api.tests.ProductApiTest.searchFindsTheBikeLight(ProductApiTest.java:41)
\`\`\`

The response was \`200\` with \`{ "data": [], "page": 1, "size": 10, "total": 0, "totalPages": 0 }\`. \`data[0].name\` on an empty list is **null**, not an error.

**Fix:**
1. \`Product\` POJO: add the \`inStock\` field (you want to assert it) **and** annotate the class with \`@JsonIgnoreProperties(ignoreUnknown = true)\` so the next *added* field doesn't break every test that reads products. (The contract itself is checked separately by the JSON-schema test.)
2. The search test: search for \`light\`, and assert on the **list** — not empty / \`hasItem("Pulse Bike Light")\` — instead of reading \`data[0].name\` blindly.`,
  hints: [
    '"not marked as ignorable (7 known properties…)" — Jackson found a JSON field your class doesn\'t have.',
    'JSON path on an index that doesn\'t exist returns null; an empty list is a valid 200 response.',
    '@JsonIgnoreProperties(ignoreUnknown = true) on the class; .body("data.name", hasItem("Pulse Bike Light"))',
  ],
  language: 'java',
  starterCode: String.raw`// ===== src/test/java/com/shopeasy/api/model/Product.java =====
package com.shopeasy.api.model;

import java.math.BigDecimal;

public class Product {
    private int id;
    private String slug;
    private String name;
    private BigDecimal price;
    private String category;
    private int stock;
    private String description;

    // getters and setters for all 7 fields ...
    public String getName() { return name; }
    public BigDecimal getPrice() { return price; }
    public int getStock() { return stock; }
}

// ===== src/test/java/com/shopeasy/api/tests/ProductApiTest.java =====
package com.shopeasy.api.tests;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import com.shopeasy.api.model.Product;
import org.testng.annotations.Test;

public class ProductApiTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void backpackDetails() {
        Product p = given().baseUri(BASE_URI).pathParam("id", 1)
                .when().get("/api/products/{id}")
                .then().statusCode(200)
                .extract().as(Product.class);
        assertEquals(p.getName(), "Trailblazer Backpack");
    }

    @Test
    public void searchFindsTheBikeLight() {
        String firstName = given().baseUri(BASE_URI).queryParam("q", "lamp")
                .when().get("/api/products")
                .then().statusCode(200)
                .extract().path("data[0].name");
        assertTrue(firstName.contains("Bike"));
    }
}
`,
  solution: String.raw`// ===== src/test/java/com/shopeasy/api/model/Product.java =====
package com.shopeasy.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)   // tolerate new fields; the schema test guards the contract
public class Product {
    private int id;
    private String slug;
    private String name;
    private BigDecimal price;
    private String category;
    private int stock;
    private boolean inStock;
    private String description;

    // getters and setters for all fields ...
    public String getName() { return name; }
    public BigDecimal getPrice() { return price; }
    public int getStock() { return stock; }
    public boolean isInStock() { return inStock; }
    public void setInStock(boolean inStock) { this.inStock = inStock; }
}

// ===== src/test/java/com/shopeasy/api/tests/ProductApiTest.java =====
package com.shopeasy.api.tests;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import com.shopeasy.api.model.Product;
import org.testng.annotations.Test;

public class ProductApiTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void backpackDetails() {
        Product p = given().baseUri(BASE_URI).pathParam("id", 1)
                .when().get("/api/products/{id}")
                .then().statusCode(200)
                .extract().as(Product.class);
        assertEquals(p.getName(), "Trailblazer Backpack");
        assertTrue(p.isInStock(), "stock is 25, so inStock must be true");
    }

    @Test
    public void searchFindsTheBikeLight() {
        given().baseUri(BASE_URI).queryParam("q", "light")
        .when().get("/api/products")
        .then()
            .statusCode(200)
            .body("total", equalTo(1))
            .body("data", hasSize(1))                          // a clear message if the list is empty
            .body("data.name", hasItem("Pulse Bike Light"));
    }
}
`,
  checks: [
    { label: 'POJO ignores unknown properties', pattern: '@JsonIgnoreProperties\\s*\\(\\s*ignoreUnknown\\s*=\\s*true\\s*\\)', hint: '@JsonIgnoreProperties(ignoreUnknown = true) on the Product class' },
    { label: 'POJO maps the new inStock field', pattern: '(boolean|Boolean)\\s+inStock\\s*;', hint: 'private boolean inStock;' },
    { label: 'No blind data[0] read', pattern: '"data\\[0\\]\\.\\w+"', mustNot: true, hint: 'An index on an empty list returns null' },
    { label: 'Asserts on the list itself', pattern: '(hasItem\\s*\\(|hasSize\\s*\\(|not\\s*\\(\\s*empty\\s*\\(|everyItem\\s*\\()', hint: '.body("data.name", hasItem("Pulse Bike Light"))' },
    { label: 'Searches with a term that exists', pattern: 'queryParam\\s*\\(\\s*"q"\\s*,\\s*"(light|Light|bike|Bike|pulse|Pulse)', hint: 'q=light finds "Pulse Bike Light"' },
  ],
  explanation: `**Failure 1 — strict deserialisation.** Jackson, by default, throws \`UnrecognizedPropertyException\` when the JSON has a field the class doesn't declare. "We only added a field" is *non-breaking* for most clients, but your POJO was stricter than any real client. The message tells you everything: the unknown field (\`inStock\`), the class, the list of fields it does know, and the exact line/column in the JSON.

**Which fix?**
| Option | Effect |
|---|---|
| Add \`inStock\` to the POJO | You can assert the new behaviour (stock 25 → \`true\`, Retro Red Tee stock 0 → \`false\`) |
| \`@JsonIgnoreProperties(ignoreUnknown = true)\` | Future additive changes don't break 40 unrelated tests |
| Global \`FAIL_ON_UNKNOWN_PROPERTIES = false\` | Same, but for every class, invisibly — easy to forget it's on |

Do the first two. "Did the contract change?" is a separate question, answered by **one** JSON-schema test (\`/api/schema/product\` has \`additionalProperties: false\`) — a single, clearly named failure instead of an avalanche.

**Failure 2 — null vs empty.** \`data\` was an empty list (the rename meant "lamp" matches nothing). JSON path \`data[0].name\` on an empty list returns \`null\`; Java then throws a \`NullPointerException\` one line later, far from the cause. Asserting on the collection (\`hasSize(1)\`, \`hasItem(...)\`) fails *at the response* with *"Expected: a collection with size <1> Actual: []"* — which tells you immediately that the search found nothing.

| JSON path | On \`{"data": []}\` |
|---|---|
| \`data\` | \`[]\` (empty list) |
| \`data.name\` | \`[]\` (empty list) |
| \`data[0].name\` | \`null\` |
| \`missingField\` | \`null\` |`,
  mistakes: [
    'Turning off FAIL_ON_UNKNOWN_PROPERTIES globally and never testing the contract anywhere.',
    'Raising a defect against the backend for adding a field.',
    'Reading list[0] from a response without first asserting the list is not empty.',
    'Catching the NullPointerException and failing with "search broken" — you lose the real reason.',
  ],
  interview: [
    { q: 'What is UnrecognizedPropertyException and how do you handle it?', a: 'Jackson throws it when the JSON contains a field the target class does not declare. For response POJOs in tests I add the fields we assert on and use @JsonIgnoreProperties(ignoreUnknown = true) so additive changes do not break unrelated tests, and I keep a JSON-schema test that fails deliberately when the contract changes.' },
    { q: 'Your JSON path returns null. What can that mean?', a: 'Either the field does not exist (wrong path or renamed field) or you indexed into an empty or shorter list. JSON path does not throw for either. I assert on the collection first — size, hasItem — or use the response body matchers, so the failure message shows the actual JSON.' },
  ],
}
