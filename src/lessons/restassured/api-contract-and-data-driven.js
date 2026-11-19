export default {
  slug: 'api-contract-and-data-driven',
  category: 'restassured',
  order: 7,
  title: 'Contract checks, negative tests and data-driven API tests',
  minutes: 9,
  summary: 'Validate a whole response against a JSON Schema, design negative tests systematically, and run one API test over many rows with a TestNG DataProvider.',
  manualAnalogy: `When the backend team renames a field, the mobile app crashes even though "the API still returns 200". A JSON Schema check is the automated version of you comparing the response with the API spec document field by field. And your boundary-value / equivalence-class tables for a form are exactly what a DataProvider runs.`,
  body: `## Why schema validation

Field-by-field assertions check *values* you care about today. A **JSON Schema** checks the *shape* of the whole response: which fields must exist, their types, allowed values, and that no surprise fields appear. It catches contract breaks — \`price\` turned into a string, \`inStock\` disappeared — that value checks miss.

The practice API publishes its product schema at \`GET /api/schema/product\`. Excerpt:

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "required": ["id", "slug", "name", "price", "category", "stock", "inStock", "description"],
  "additionalProperties": false,
  "properties": {
    "id":       { "type": "integer", "minimum": 1 },
    "price":    { "type": "number", "minimum": 0, "exclusiveMinimum": true },
    "category": { "type": "string", "enum": ["bags", "accessories", "clothing", "kids"] }
  }
}
\`\`\`

- \`required\` — these keys must be present.
- \`type\` — string, number, integer, boolean, object, array, null.
- \`enum\`, \`minimum\`, \`pattern\` — value rules.
- \`additionalProperties: false\` — any extra key fails (strict; some teams prefer \`true\` so additive changes don't break tests).
- The schema is written in **draft-04**, the JSON Schema version RestAssured's validator module supports. Newer drafts write \`"exclusiveMinimum": 0\` as a number; draft-04 uses \`"minimum": 0, "exclusiveMinimum": true\`.

## Validating in RestAssured

Add the module:

\`\`\`xml
<dependency>
  <groupId>io.rest-assured</groupId>
  <artifactId>json-schema-validator</artifactId>
  <version>5.5.0</version>
  <scope>test</scope>
</dependency>
\`\`\`

Save the schema as \`src/test/resources/schemas/user.schema.json\` (a schema you write for \`/api/users/{id}\`, say) and:

\`\`\`java
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;

given().pathParam("id", 3)
.when().get("/api/users/{id}")
.then().statusCode(200)
       .body(matchesJsonSchemaInClasspath("schemas/user.schema.json"));
\`\`\`

- The path is relative to the **classpath** root, which for tests is \`src/test/resources\`. Do not write \`src/test/resources/...\` in the string.
- For a list response, validate one item with a schema whose root is the item, or write a list schema using \`"type": "array", "items": { "$ref": ... }\`.
- When it fails, the message lists every violation (\`instance type (string) does not match any allowed primitive type (allowed: ["number"])\`) — paste that into the defect.

Schema checks complement, not replace, value checks: a valid shape can still hold the wrong price.

## Designing negative tests

Use the same techniques you use manually, applied to the request:

| Technique | Order API example | Expected |
|---|---|---|
| missing required field | no \`lastName\` | 400 VALIDATION_FAILED, details field lastName |
| empty / blank | \`firstName: "  "\` | 400 |
| invalid format | \`postalCode: "!"\` | 400 |
| boundary | \`quantity: 0\`, \`11\` | 422 INVALID_QUANTITY |
| unknown reference | \`productId: 999\` | 404 PRODUCT_NOT_FOUND |
| business rule | ordering an empty cart | 422 EMPTY_CART |
| auth | no token | 401 |
| malformed body | \`{ bad json\` | 400 INVALID_JSON |

Each negative test asserts **status + error.code + the offending field**. A 400 for the wrong reason is still a bug.

## Data-driven with a TestNG DataProvider

Rows of a table become test runs (see the *Data-driven testing* lesson in the Framework section for the TestNG basics):

\`\`\`java
@DataProvider(name = "badCartItems")
public Object[][] badCartItems() {
    return new Object[][] {
        // productId, quantity, status, errorCode
        { 999, 1,  404, "PRODUCT_NOT_FOUND" },
        { 2,   0,  422, "INVALID_QUANTITY"  },
        { 2,   11, 422, "INVALID_QUANTITY"  },
        { 6,   1,  422, "OUT_OF_STOCK"      },
    };
}

@Test(dataProvider = "badCartItems")
public void rejects_bad_cart_items(int productId, int qty, int status, String code) {
    given().spec(authed)
        .body(Map.of("productId", productId, "quantity", qty))
    .when().post("/cart/items")
    .then().statusCode(status)
        .body("error.code", equalTo(code));
}
\`\`\`

Tips:
- Put the **expected result in the row** — one test method covers many cases and the report shows each row.
- For "remove one field" cases, build a valid \`Map\` and remove/blank the field per row; Maps are easier than POJOs here.
- Name the case in the row (a first \`String\` column like \`"zero quantity"\`) so failures are readable.
- Move big tables to JSON under \`src/test/resources/testdata\` and load them with Jackson.
- \`@DataProvider(parallel = true)\` is safe only if each row uses its own data (own user/cart).`,
  keyPoints: [
    'A JSON Schema validates the whole response shape: required fields, types, enums, extra fields.',
    'matchesJsonSchemaInClasspath("schemas/x.json") reads from src/test/resources; needs the json-schema-validator module.',
    'Schema checks find contract breaks; value checks find wrong data — use both.',
    'Negative tests apply classic techniques (missing, blank, format, boundary, reference, rule, auth) and assert status + code + field.',
    'A DataProvider row should carry its expected status and error code.',
  ],
  mistakes: [
    'Writing "src/test/resources/schemas/..." in matchesJsonSchemaInClasspath — the classpath path starts at schemas/.',
    'Validating a list response against a single-object schema.',
    'Negative tests that only assert 400 — they pass when the server rejects for the wrong reason.',
    'DataProvider rows that share one cart or user in parallel runs and interfere with each other.',
  ],
  tryIt: `Download the schema at http://localhost:5181/api/schema/product, then compare it with http://localhost:5181/api/products/6. Change one value in your head (price as "15.99" string, missing inStock, an extra "colour" key) and say which schema rule would fail each time.`,
  problems: ['api-013', 'api-015', 'api-016', 'api-042'],
}
