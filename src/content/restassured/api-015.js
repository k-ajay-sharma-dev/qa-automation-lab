export default {
  id: 'api-015',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Contract check: validate products against a JSON Schema',
  level: 'ADVANCED',
  tags: ['json-schema', 'contract-testing', 'schema-validation'],
  estMinutes: 30,
  scenario: `Two sprints ago a backend developer changed \`price\` from a number to a string ("29.99") to "fix rounding". Every
functional test still passed — they only looked at names — but the iOS app crashed on launch for 20 minutes in
production. The post-mortem action: "add contract checks for the catalogue". The backend publishes the product schema
at \`GET /api/schema/product\`; you saved it as \`src/test/resources/schemas/product-schema.json\`.`,
  description: `The schema (draft-04, which RestAssured's validator supports) requires \`id, slug, name, price, category, stock,
inStock, description\` with the right types, \`price > 0\`, a category enum and \`additionalProperties: false\`.

Write \`ProductContractTest\`:

1. **productMatchesSchema** — \`GET /api/products/{id}\` for every id from **1 to 6** (a \`@DataProvider\` or a loop) →
   200 and \`body(matchesJsonSchemaInClasspath("schemas/product-schema.json"))\`.
2. **schemaFileIsUpToDate** — fetch \`GET /api/schema/product\` and assert its \`required\` list contains
   \`"price"\` and \`"inStock"\` and \`properties.price.type\` is \`"number"\` — a cheap guard that the published contract
   still says what your copy says.

**Rules**
- Static import \`io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath\`.
- The classpath path starts at \`schemas/...\` — not \`src/test/resources/...\`.
- Check the status **before** the schema.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ProductContractTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void productMatchesSchema() {
        given().baseUri(BASE_URI)
        .when().get("/api/products/1")
        .then().statusCode(200)
            .body("name", notNullValue()); // the only "contract" check we had
        // TODO: validate ids 1..6 against src/test/resources/schemas/product-schema.json
    }

    // TODO: schemaFileIsUpToDate
}
`,
  solution: `package com.shopeasy.api.tests;

import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

import java.util.stream.IntStream;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.*;

public class ProductContractTest {

    private static final String BASE_URI = "http://localhost:5181";
    private static final String PRODUCT_SCHEMA = "schemas/product-schema.json";

    @DataProvider(name = "productIds")
    public Object[][] productIds() {
        return IntStream.rangeClosed(1, 6)
            .mapToObj(id -> new Object[] { id })
            .toArray(Object[][]::new);
    }

    @Test(dataProvider = "productIds")
    public void productMatchesSchema(int id) {
        given()
            .baseUri(BASE_URI)
            .pathParam("id", id)
        .when()
            .get("/api/products/{id}")
        .then()
            .statusCode(200)
            .body(matchesJsonSchemaInClasspath(PRODUCT_SCHEMA));
    }

    @Test
    public void schemaFileIsUpToDate() {
        given()
            .baseUri(BASE_URI)
        .when()
            .get("/api/schema/product")
        .then()
            .statusCode(200)
            .body("required", hasItems("price", "inStock"))
            .body("properties.price.type", equalTo("number"));
    }
}
`,
  checks: [
    { label: 'Imports the schema matcher', pattern: 'import\\s+static\\s+io\\.restassured\\.module\\.jsv\\.JsonSchemaValidator\\.(matchesJsonSchemaInClasspath|\\*)\\s*;', hint: 'import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;' },
    { label: 'Validates the body against the schema', pattern: '\\.body\\(\\s*matchesJsonSchemaInClasspath\\(', hint: '.body(matchesJsonSchemaInClasspath("schemas/product-schema.json"))' },
    { label: 'Classpath path, not a file path', pattern: 'src/test/resources', mustNot: true, hint: 'The classpath root already is src/test/resources.' },
    { label: 'Covers ids 1–6 (DataProvider or loop)', pattern: '(@DataProvider|for\\s*\\(|IntStream\\.rangeClosed\\(\\s*1\\s*,\\s*6)', hint: 'A @DataProvider returning ids 1..6' },
    { label: 'Checks the published schema', pattern: '"/api/schema/product"', hint: 'get("/api/schema/product") and assert required/properties.' },
    { label: 'Status asserted before the schema', pattern: 'statusCode\\(\\s*200\\s*\\)\\s*\\.body\\(\\s*matchesJsonSchemaInClasspath', hint: '.statusCode(200).body(matchesJsonSchemaInClasspath(...))' },
  ],
  hints: [
    'Dependency: io.rest-assured:json-schema-validator (same version as rest-assured).',
    'matchesJsonSchemaInClasspath is a Hamcrest matcher for the WHOLE body — use body(matcher) without a path.',
    'Product 6 is out of stock — a good check that stock: 0 / inStock: false is still valid.',
  ],
  explanation: `A **JSON Schema** describes the *shape* of a response: required fields, types, enums, ranges and whether extra
fields are allowed. \`matchesJsonSchemaInClasspath\` validates the whole body and lists every violation, e.g.
\`instance type (string) does not match any allowed primitive type (allowed: ["number"])\` — precisely the
\`price: "29.99"\` incident.

Running it for **every product** matters: the out-of-stock product (\`stock: 0\`, \`inStock: false\`) is a different
equivalence class from the others. Checking the status first gives a clear failure when the call itself breaks,
instead of a confusing "schema mismatch" on an error body.

The second test protects against your schema copy going stale. In mature teams this becomes **consumer-driven
contract testing** (e.g. Pact), where the mobile app's expectations are verified on every backend build.`,
  mistakes: [
    'Writing "src/test/resources/schemas/x.json" — the classpath path is "schemas/x.json".',
    'Using a draft-07 schema with RestAssured\'s validator, which understands draft-04 — keywords like numeric exclusiveMinimum are rejected.',
    'Treating schema checks as a replacement for value checks — a valid shape can still carry a wrong price.',
    'Validating only one sample product — other equivalence classes (out of stock) may break the contract.',
  ],
  interview: [
    { q: 'What is the difference between schema validation and functional assertions?', a: 'Schema validation checks structure and types — fields exist, are numbers, follow enums. Functional assertions check business values — the total is 75.57. A contract break can pass functional tests and vice versa, so you need both.' },
    { q: 'additionalProperties false or true?', a: 'false is strict: any new field fails, good for catching accidental data leaks (e.g. a password hash). true tolerates additive changes. Many teams use strict schemas in contract tests and lenient POJOs in functional tests.' },
  ],
}
