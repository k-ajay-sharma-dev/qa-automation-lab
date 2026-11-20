export default {
  slug: 'restassured-deep-assertions-json-contracts',
  category: 'restassured',
  order: 13,
  title: 'Deep dive: advanced response validation — GPath, JsonPath, POJO mapping, JSON comparison and schema contracts',
  minutes: 30,
  summary: 'Validate API responses like a senior — Groovy GPath with closures, parameters and nested collections; REST Assured JsonPath vs Jayway JsonPath; typed deserialisation into records; whole-object comparison with AssertJ, JSONAssert, schemas and golden files; exact money and timestamp checks; draft-aware JSON Schema contracts; a glance at XML; custom Hamcrest matchers and an AssertJ OrderAssert — ending in a complete end-to-end order contract test.',
  manualAnalogy: `When you check an order confirmation by hand you do not compare every character — you check that the lines add up, the tax is right, the order number is new, the date is today, and nothing odd appeared on the page. Senior API assertions are the same judgement written down: precise where it matters (money, ids, required fields), tolerant where the value is generated (ids, timestamps), and one structural check (the schema) that catches anything that looks different from the agreed contract.`,
  body: `## Where the earlier lessons stop

*Asserting responses* (\`api-asserting-responses\`) introduced GPath (\`find\`, \`findAll\`, \`max\`, \`sum\`), the common Hamcrest matchers, the Float gotcha and error-body checks. *Sending data* covered POJOs and \`TypeRef\`, *Contract checks* (\`api-contract-and-data-driven\`) schema basics with \`matchesJsonSchemaInClasspath\`. \`restassured-deep-internals-http\` explained \`JsonConfig\`, object-mapper selection and Jackson configuration. Ajv/zod schema validation on the Playwright side is in \`pw-deep-api-testing\`; records + Jackson basics in \`java-deep-modern-java-9-to-21\`.

This lesson is about **choosing and combining validation techniques**: how far GPath goes, when to switch to typed objects, how to compare whole responses without brittleness, how to get money and time right, what the schema module really validates, and how to package domain checks as reusable matchers and assertions. Consumer-driven contracts (Pact) are in \`restassured-deep-advanced-api-testing\`.

ShopEasy data used below (seed after \`POST /api/reset\`, \`GET /api/products\` returns all six on page 1):

| id | slug | price | category | stock | inStock |
|---|---|---|---|---|---|
| 1 | trailblazer-backpack | 29.99 | bags | 25 | true |
| 2 | pulse-bike-light | 9.99 | accessories | 40 | true |
| 3 | classic-crew-t-shirt | 15.99 | clothing | 60 | true |
| 4 | storm-fleece-jacket | 49.99 | clothing | 12 | true |
| 5 | junior-onesie | 7.99 | kids | 30 | true |
| 6 | retro-red-tee | 15.99 | clothing | 0 | false |

## GPath in depth

### How it works

REST Assured's \`JsonPath\` parses the body into plain Groovy/Java structures (\`Map\`, \`List\`, \`String\`, \`Integer\`, \`Float\`/\`BigDecimal\`, \`Boolean\`) and evaluates your path as a **Groovy expression** against the root. Three consequences:

- Every **Groovy collection method** is available: \`find\`, \`findAll\`, \`collect\`, \`collectMany\`, \`sum\`, \`max\`, \`min\`, \`every\`, \`any\`, \`countBy\`, \`groupBy\`, \`unique\`, \`flatten\`, \`size()\`.
- Property access on a list is an **implicit spread**: \`data.price\` equals \`data*.price\` (explicit spread) — a list of every price.
- Errors appear only at runtime, as Groovy errors: \`data.find { it.id == 99 }.name\` throws an exception mentioning \`Cannot get property 'name' on null object\`. Use safe navigation \`data.find { it.id == 99 }?.name\` when "absent" is a legal outcome you want to assert as \`nullValue()\`.

Number types follow \`JsonConfig\`: \`Float\` by default, \`BigDecimal\` with \`NumberReturnType.BIG_DECIMAL\` — and Groovy arithmetic follows the types. With \`BigDecimal\`, \`29.99 * 25\` is exactly \`749.75\`; with \`Float\`, Groovy widens to \`Double\` and you get \`749.7499942779541\`.

### Closures beyond the basics (ShopEasy catalogue, BIG_DECIMAL config)

| Question | GPath | Result |
|---|---|---|
| total inventory value | \`data.collect { it.price * it.stock }.sum()\` | \`2948.33\` |
| units in stock (closure form of \`sum\`) | \`data.sum { it.stock }\` | \`167\` |
| best-stocked product | \`data.max { it.stock }.name\` | \`"Classic Crew T-Shirt"\` |
| products per category | \`data.countBy { it.category }\` | \`[bags:1, accessories:1, clothing:3, kids:1]\` |
| invariant: \`inStock\` agrees with \`stock\` | \`data.every { it.inStock == (it.stock > 0) }\` | \`true\` |
| any sold-out product? | \`data.any { !it.inStock }\` | \`true\` |
| slugs of sold-out products | \`data.findAll { !it.inStock }*.slug\` | \`["retro-red-tee"]\` |
| how many distinct prices | \`data.price.unique().size()\` | \`5\` |
| cheapest clothing price | \`data.findAll { it.category == 'clothing' }.price.min()\` | \`15.99\` |
| conditional mapping | \`data.findAll { it.stock < 15 }.collect { it.stock == 0 ? 'SOLD_OUT' : 'LOW' }\` | \`["LOW", "SOLD_OUT"]\` |

The **invariant** rows are where GPath shines: one expression states a business rule across the whole list (\`every\`), so a single wrong item fails the test with the rule's name in the report.

### \`it\` vs named parameters, nested collections

\`it\` is the implicit parameter of the **innermost** closure. In nested closures \`it\` shadows the outer one, so name them. \`GET /api/orders\` returns \`{ data: [order] }\` where each order has \`items\`; the expected values below are for the customer of the complete example at the end (one order: backpack × 1, bike light × 2):

\`\`\`java
.then()
    // orders that contain the bike light (product 2) — named parameters, no shadowing
    .body("data.findAll { o -> o.items.any { i -> i.productId == 2 } }.id", hasSize(1))
    // every line of every order: flatten the list of lists
    .body("data.items.flatten().quantity.sum()", equalTo(3))
    // same with collectMany
    .body("data.collectMany { it.items }.productId.unique()", containsInAnyOrder(1, 2))
    // every order's total = subtotal + tax (BigDecimal arithmetic inside the path)
    .body("data.every { it.total == it.subtotal + it.tax }", is(true));
\`\`\`

Careful with the last line: with \`BIG_DECIMAL\`, Groovy's \`==\` on \`BigDecimal\` uses \`compareTo\` (so \`4\` and \`4.00\` are equal), but a value serialised as an integer arrives as \`Integer\` — Groovy still compares numerically. That makes GPath arithmetic invariants surprisingly robust; the Java side is where scale and type bite (see *Numbers*).

### Parameters: \`withArgs\`, \`rootPath\` and \`JsonPath.param\`

Never build paths by string concatenation in many places. Three mechanisms:

\`\`\`java
// 1. withArgs: String.format-style placeholders in body() paths
.then().body("data.find { it.slug == '%s' }.stock", withArgs("storm-fleece-jacket"), equalTo(12));

// 2. rootPath: a common prefix for several checks
.then()
    .rootPath("data.find { it.slug == 'storm-fleece-jacket' }")
        .body("price", comparesEqualTo(new BigDecimal("49.99")))
        .body("category", equalTo("clothing"))
        .body("inStock", is(true))
    .noRootPath()
        .body("total", equalTo(6));

// 3. JsonPath.param: a real Groovy variable, no string formatting
JsonPath json = response.jsonPath();
List<String> premium = json.param("min", new BigDecimal("20"))
        .getList("data.findAll { p -> p.price > min }.name");          // [Trailblazer Backpack, Storm Fleece Jacket]
\`\`\`

\`withArgs\` is text substitution: a value containing \`'\` breaks the expression (and a value from untrusted data could inject Groovy). \`param\` binds a real variable and is the safer choice for data-driven values; \`rootPath\`/\`appendRootPath\`/\`detachRootPath\`/\`noRootPath\` keep long \`then()\` blocks readable. (The older \`root()\`/\`noRoot()\` were deprecated in 4.0 and removed in 7.0.)

### GPath inside \`then()\` vs extract + Java

| | GPath in \`body(path, matcher)\` | \`extract().jsonPath()\` + Java streams |
|---|---|---|
| How it works | Groovy expression + Hamcrest, evaluated during validation | values pulled into Java types, logic in Java |
| Advantages | one fluent block; failure shows path, expected, actual; \`log().ifValidationFails()\` applies | compiler-checked, debuggable with breakpoints, reusable methods |
| Disadvantages | runtime-only errors, stringly-typed, hard to debug complex closures | more code; failures need good messages |
| Performance | fine for typical payloads | same |
| Maintainability | great for 1-line rules; poor for 5-line algorithms | better for algorithms (sort order, cross-response maths) |
| When to use | presence, values, simple invariants | multi-step calculations, comparisons across responses |

**Recommended approach and why:** keep GPath to what fits on one line and reads like a rule; when you find yourself writing nested closures with arithmetic, deserialise and use Java — or move the rule into a custom assertion (below).

## REST Assured JsonPath vs Jayway JsonPath

Two unrelated libraries share the name. REST Assured's \`io.restassured.path.json.JsonPath\` uses **GPath** (Groovy); \`com.jayway.jsonpath.JsonPath\` implements the Goessner \`$\`-syntax used by Spring's \`MockMvc\`/\`WebTestClient\` \`jsonPath(...)\`, WireMock's \`matchesJsonPath\`, and many tools.

| Need | REST Assured GPath | Jayway JsonPath |
|---|---|---|
| a field | \`data[0].name\` | \`$.data[0].name\` |
| all names | \`data.name\` | \`$.data[*].name\` |
| filter | \`data.findAll { it.price > 20 }.name\` | \`$.data[?(@.price > 20)].name\` |
| deep scan (any depth) | no direct equivalent — spell the path | \`$..price\` |
| aggregate | \`data.price.max()\`, \`data.sum { it.stock }\` | \`$.data[*].price.max()\` (function support varies by version) |
| transform | \`collect\`, \`countBy\`, arithmetic | not supported |
| result type | whatever Groovy returns (\`Float\`/\`BigDecimal\` per config) | indefinite paths always return a list |

\`\`\`java
// Jayway: parse once, query many times
DocumentContext doc = com.jayway.jsonpath.JsonPath.parse(response.asString());
List<String> premium = doc.read("$.data[?(@.price > 20)].name");
List<Object> allPrices = doc.read("$..price");          // deep scan: every "price" anywhere
\`\`\`

**When each:** GPath inside REST Assured tests — it is built in and supports transformations. Jayway when the same path must work in another tool (WireMock stubs, Spring tests, a shared contract document), when you need deep scan over unknown nesting, or when developers already speak \`$\`-syntax. Do not mix both in one test class without a reason; reviewers will misread one as the other.

## Deserialising responses into types

\`\`\`java
public record Product(int id, String slug, String name, BigDecimal price,
                      String category, int stock, boolean inStock, String description) { }

public record DataEnvelope<T>(List<T> data) { }                  // GET /api/orders → { data: [...] }

// 1. whole body, one object
Product jacket = given().spec(base).get("/api/products/{id}", 4)
        .then().statusCode(200).extract().as(Product.class);

// 2. generic wrapper: TypeRef keeps the type argument at runtime
DataEnvelope<Order> mine = given().spec(customer).get("/api/orders")
        .then().statusCode(200).extract().as(new TypeRef<DataEnvelope<Order>>() { });

// 3. a list inside a wrapper, without modelling the wrapper
List<CartLine> lines = given().spec(customer).get("/api/cart")
        .then().statusCode(200).extract().jsonPath().getList("items", CartLine.class);

// 4. one nested object
Customer buyer = response.jsonPath().getObject("customer", Customer.class);
\`\`\`

| Approach | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| \`as(Class)\` | object mapper on the whole body | simplest, typed | needs a wrapper type for envelopes | single resources |
| \`as(new TypeRef<...>() {})\` | anonymous subclass captures generic type | full generics (\`Page<T>\`, \`Map<String, List<T>>\`) | slightly noisy syntax | envelopes, maps, lists at the root |
| \`jsonPath().getList(path, T.class)\` | GPath selects, mapper converts each element | no wrapper class; combine with filters (\`"data.findAll { it.inStock }"\`) | elements go through an intermediate \`Map\`, so number handling follows JsonPath config first | one list inside a bigger response |
| \`jsonPath().getObject(path, T.class / TypeRef)\` | same for one object | targeted | as above | nested objects |
| records | canonical constructor as Jackson creator (2.12+) | immutable, \`equals\`, concise | all-or-nothing construction | default for responses |

Always assert the **status before deserialising**: \`as(Order.class)\` on a 400 error body produces a half-empty \`Order\` (all fields default) or a confusing mapping error instead of "expected 201 but was 400".

## Asserting whole objects

Field-by-field checks miss what you did not think of. Whole-object comparison catches it — if it can ignore what legitimately changes (generated ids, timestamps, server-assigned order numbers).

### 1. AssertJ recursive comparison

\`\`\`java
Order expected = new Order(0, userId, "PLACED",
        new Customer("Mira", "Nair", "400001"),
        List.of(new OrderLine(1, "Trailblazer Backpack", new BigDecimal("29.99"), 1, new BigDecimal("29.99")),
                new OrderLine(2, "Pulse Bike Light", new BigDecimal("9.99"), 2, new BigDecimal("19.98"))),
        3, new BigDecimal("49.97"), new BigDecimal("4.00"), new BigDecimal("53.97"), null);

assertThat(actual)
        .usingRecursiveComparison()
        .ignoringFields("id", "createdAt")                               // generated by the server
        .withComparatorForType(BigDecimal::compareTo, BigDecimal.class)  // 4 == 4.00
        .isEqualTo(expected);
\`\`\`

Works on records and POJOs, reports **every** differing field path (\`items[1].lineTotal\`), and \`ignoringCollectionOrderInFields("items")\` handles unordered lists. Without the \`BigDecimal\` comparator, \`4\` vs \`4.00\` fails on scale.

### 2. JSONAssert

\`\`\`java
String expectedJson = Files.readString(Path.of("src/test/resources/expected/order-placed.json"));

JSONAssert.assertEquals(expectedJson, response.asString(),
        new CustomComparator(JSONCompareMode.STRICT,
                new Customization("id", (actualValue, expectedValue) -> true),
                new Customization("userId", (actualValue, expectedValue) -> true),
                new Customization("createdAt", (actualValue, expectedValue) -> true)));
\`\`\`

| \`JSONCompareMode\` | Extra fields in actual | Array order |
|---|---|---|
| \`STRICT\` | fail | must match |
| \`NON_EXTENSIBLE\` | fail | any order |
| \`STRICT_ORDER\` | allowed | must match |
| \`LENIENT\` | allowed | any order |

JSONAssert compares JSON, not Java types: numbers are compared numerically (so \`4\` and \`4.00\` match), key order and whitespace never matter. \`Customization\` takes a path and a \`ValueMatcher\` — "always true" ignores a field; \`RegularExpressionValueMatcher\` checks a format instead of a value.

### 3. Schema validation (\`matchesJsonSchemaInClasspath\`)

Validates **shape**, not values — covered in depth below.

### 4. Golden files / snapshots

\`\`\`java
public final class Snapshot {
    private static final ObjectMapper MAPPER = ApiConfig.MAPPER;           // the framework's shared mapper
    private static final boolean UPDATE = Boolean.getBoolean("updateSnapshots");

    public static void assertMatches(String name, String actualJson, String... volatileFields) throws IOException {
        ObjectNode actual = (ObjectNode) MAPPER.readTree(actualJson);
        actual.remove(List.of(volatileFields));                            // ids, timestamps
        Path file = Path.of("src/test/resources/snapshots", name + ".json");
        String normalised = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(actual);
        if (UPDATE || Files.notExists(file)) {
            Files.createDirectories(file.getParent());
            Files.writeString(file, normalised);                           // review the diff in the PR!
            return;
        }
        JSONAssert.assertEquals(Files.readString(file), normalised, JSONCompareMode.STRICT);
    }
}
\`\`\`

Snapshots shine for large, stable payloads (a 200-field product export) where hand-writing expectations is impractical. The risk: someone runs \`-DupdateSnapshots=true\`, a wrong value becomes the new truth, and the reviewer approves a 400-line JSON diff without reading it. Only top-level volatile fields are removed here; nested ones need a JSON Pointer-based normaliser.

### Comparison and recommendation

| Approach | Catches | Brittleness | Failure readability | Maintenance | When to use |
|---|---|---|---|---|---|
| Field-by-field Hamcrest/GPath | what you listed | low | excellent (path + values) | grows with fields | key business values, negative tests |
| AssertJ recursive comparison | every field of the DTO | medium (ignore lists) | very good (field paths) | DTOs must be maintained | typed domain objects, read-back equals created |
| JSONAssert | every JSON field incl. unknown ones (STRICT) | medium–high | good (JSON paths) | expected JSON files | contract-like checks of exact responses |
| JSON Schema | structure, types, required, extras | low (if permissive) / medium (if strict) | lists violations | schema files | every response type, once |
| Golden file | everything | high | diff | cheap to create, expensive to review | big stable payloads, migrations ("v2 returns the same as v1") |

**Recommended approach and why:** layer them. A schema per response type (structure, once), field-level assertions for the business values a test is about, recursive comparison when a test produces a full domain object (e.g. read-back after create), JSONAssert or golden files only for large stable payloads or migration checks. Never use one giant exact comparison as the only assertion — a timestamp format change then fails 300 tests that are about something else.

## Numbers and precision

ShopEasy computes money in JavaScript (\`Math.round(n * 100) / 100\`) and serialises with \`JSON.stringify\`, so **trailing zeros disappear**: a tax of 4.00 is sent as \`4\`, a subtotal of 0 as \`0\`. Your checks must survive three different Java representations of one amount:

| Where the value comes from | Java type you get | Safe comparison |
|---|---|---|
| GPath, default config | \`Float\` (or \`Integer\` for \`4\`) | \`equalTo(29.99f)\` — fragile for money |
| GPath, \`BIG_DECIMAL\` | \`BigDecimal\` (or \`Integer\` for \`4\`) | a type-tolerant matcher (custom \`money(...)\` below) or \`comparesEqualTo\` when you know it is a decimal |
| DTO field \`BigDecimal\` | \`BigDecimal\` with the JSON's scale (\`4\`, \`53.97\`) | \`compareTo\`, AssertJ \`isEqualByComparingTo("4.00")\` |

Hamcrest options for \`BigDecimal\`: \`comparesEqualTo(new BigDecimal("53.97"))\` (ignores scale, but needs the same type — an \`Integer\` actual fails), \`closeTo(new BigDecimal("53.97"), new BigDecimal("0.001"))\`. Never \`equalTo(new BigDecimal("4.00"))\` — \`BigDecimal.equals\` compares scale. And never compute money expectations with \`double\`.

**Expected values in Java must use the same rule as the product.** Ask for the rounding rule (mode, and whether tax is per line or per order). ShopEasy rounds tax per order, half-up. For 8% a half-cent tie can never occur (8 × cents ≡ 50 mod 100 has no integer solution), so \`setScale(2, RoundingMode.HALF_UP)\` matches the server for every basket — worth knowing, because for other rates JavaScript's binary doubles and \`BigDecimal\` can disagree on ties (\`1.005\` rounds to \`1\` in JS, \`1.01\` in \`BigDecimal\`).

### Dates and timestamps

\`createdAt\` is an ISO-8601 UTC instant (\`...T09:15:02.311Z\`). Assert it as **time**, not text:

- Format: parse it (\`Instant.parse\`) — a parse failure is the format assertion.
- Value: between "just before the request" and "just after the response", with a tolerance for clock skew between test machine and server (seconds locally, more against remote environments).
- Semantics: \`createdAt\` of a read-back equals the original; a later order's \`createdAt\` is not before an earlier one's.
- Never compare against a hard-coded date or "today" in the local timezone — tests fail after 18:30 in India when the UTC date differs.

## Schema validation in depth

### The module and its draft support

\`\`\`xml
<dependency>
  <groupId>io.rest-assured</groupId>
  <artifactId>json-schema-validator</artifactId>
  <version>5.5.0</version>
  <scope>test</scope>
</dependency>
\`\`\`

- In **5.x** the module delegates to \`com.github.java-json-tools:json-schema-validator\` (2.2.14 in 5.5.0), which implements **draft-04** (and draft-03). ShopEasy's \`/api/schema/product\` declares \`"$schema": "http://json-schema.org/draft-04/schema#"\` for that reason, with draft-04 syntax: \`"id"\` (not \`$id\`), \`"exclusiveMinimum": true\` as a boolean modifier of \`minimum\`.
- A schema written for **draft-06/07/2019-09/2020-12** is still validated with draft-04 semantics in 5.x. Keywords draft-04 does not know (\`const\`, \`if/then/else\`, \`$defs\`, \`dependentRequired\`) are **silently ignored** — the test stays green while checking less than you think. Numeric \`exclusiveMinimum\` (draft-06+) is invalid in draft-04.
- **6.1.0** switched the module to the networknt validator for draft-06, -07, 2019-09 and 2020-12, choosing the draft from \`$schema\` (draft-03/04 behave as before; schemas without \`$schema\` stay draft-04). In 2019-09/2020-12, \`format\` is annotation-only (not validated) per those specs. 7.0 uses networknt 3.x for draft-04 too.

API: \`matchesJsonSchemaInClasspath(path)\`, \`matchesJsonSchema(String | File | URL | URI | InputStream | Reader)\`, and per-matcher configuration with \`.using(jsonSchemaFactory)\` or \`.using(settings().with().checkedValidation(false))\`. There is also a static \`JsonSchemaValidator.settings\` — global mutable state again; prefer \`using(...)\` per matcher, or set it once and \`JsonSchemaValidator.reset()\` at the end.

### A strict order schema (draft-04)

\`src/test/resources/schemas/order-schema.json\`, written from the fields \`POST /api/orders\` returns:

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Order",
  "type": "object",
  "required": ["id", "userId", "status", "customer", "items", "itemCount", "subtotal", "tax", "total", "createdAt"],
  "additionalProperties": false,
  "properties": {
    "id":        { "type": "integer", "minimum": 1 },
    "userId":    { "type": "integer", "minimum": 1 },
    "status":    { "type": "string", "enum": ["PLACED"] },
    "customer":  { "$ref": "#/definitions/customer" },
    "items":     { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/line" } },
    "itemCount": { "type": "integer", "minimum": 1 },
    "subtotal":  { "$ref": "#/definitions/money" },
    "tax":       { "$ref": "#/definitions/money" },
    "total":     { "$ref": "#/definitions/money" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "definitions": {
    "money": { "type": "number", "minimum": 0 },
    "customer": {
      "type": "object",
      "required": ["firstName", "lastName", "postalCode"],
      "additionalProperties": false,
      "properties": {
        "firstName":  { "type": "string", "minLength": 1 },
        "lastName":   { "type": "string", "minLength": 1 },
        "postalCode": { "type": "string", "minLength": 3, "maxLength": 10 }
      }
    },
    "line": {
      "type": "object",
      "required": ["productId", "name", "price", "quantity", "lineTotal"],
      "additionalProperties": false,
      "properties": {
        "productId": { "type": "integer", "minimum": 1 },
        "name":      { "type": "string", "minLength": 1 },
        "price":     { "type": "number", "minimum": 0, "exclusiveMinimum": true },
        "quantity":  { "type": "integer", "minimum": 1, "maximum": 10 },
        "lineTotal": { "type": "number", "minimum": 0, "exclusiveMinimum": true }
      }
    }
  }
}
\`\`\`

Design notes:
- \`"money"\` deliberately has no \`multipleOf: 0.01\` — validators implement it with floating point or \`BigDecimal\` differently, and \`53.97\` may "fail" being a multiple of \`0.01\`. Cent precision is asserted in Java.
- \`"status": { "enum": ["PLACED"] }\` is strict: when the backend adds \`SHIPPED\`, this schema fails on orders that are legitimately shipped. For a list endpoint, list all known statuses; decide whether a new value should break the build (contract change) or not.
- \`integer\` vs \`number\`: \`"itemCount": 3.0\` is a different contract from \`3\`; draft-04 treats \`3.0\` as not an integer in most implementations — strictness you usually want.

### Validating lists

\`body(matchesJsonSchema...)\` validates the **document**. For \`GET /api/products\`, write a page schema whose \`data\` uses \`"items": { "$ref": "#/definitions/product" }\` (copy the product definition in, or reference a sibling file by relative URI). Do not try \`body("data", everyItem(matchesJsonSchemaInClasspath(...)))\` — the elements are already parsed maps, not JSON text.

### Strict vs permissive

| Choice | Strict | Permissive |
|---|---|---|
| \`additionalProperties\` | \`false\`: new field fails | \`true\`/absent: new fields allowed |
| \`required\` | every field the client needs | only identity fields |
| \`enum\` | closed list | \`type: string\` + \`minLength\` |
| Catches | renames, leaks of internal fields (\`passwordHash\`), unagreed additions | removals and type changes only |
| Breaks on | every additive change | almost nothing |
| Best for | consumer-owned contract of what **we** rely on; security-sensitive payloads | provider evolving fast; public APIs with tolerant clients |

**Recommended approach and why:** strict \`required\` + types everywhere; \`additionalProperties: false\` on payloads where unexpected data is a risk (user, auth, order — leaking internal fields is a security bug); permissive elsewhere so the provider can add fields without breaking you. Add a **separate** test that fails on unknown fields with a clear name ("contract drift: unreviewed fields") so additions are reviewed, not ignored.

### Where schemas come from

| Source | How | Caveat |
|---|---|---|
| OpenAPI spec (\`components.schemas\`) | extract/convert to JSON Schema | best: the agreed contract; OpenAPI 3.0 schema dialect differs slightly from JSON Schema (\`nullable\`), 3.1 aligns with 2020-12 — mind the module's draft support |
| Generated from a sample response | online generators, IDE plugins | encodes accidents (\`"maxLength": 12\` from one sample) — always review and loosen |
| Generated from DTOs | e.g. a JSON-schema generator over Java classes | describes your model, not the provider's promise |
| Hand-written | from the API doc | precise intent; most effort |

**Do not validate the API against a schema the same API serves at runtime** (\`GET /api/schema/product\`) as your only contract: if the server's code and its published schema drift together, the test is tautological. Validate against a **checked-in** copy reviewed with the team; use the live one only to detect that the published contract changed (api-015 does exactly that as a cheap guard).

### Schema as contract vs consumer-driven contracts

| | JSON Schema in provider tests | Consumer-driven contract (Pact) |
|---|---|---|
| Who defines | provider (or a shared spec) | each consumer, from its real usage |
| What it checks | shape of responses we call | the interactions a consumer relies on, verified against the provider in its pipeline |
| Catches | breaking shape changes in environments we test | breaking changes **before** deployment, per consumer |
| Needs | a running API | broker, provider verification, team buy-in |

A schema check in an end-to-end suite finds the break after it is deployed to a test environment; Pact finds it in the provider's build. Details and setup: \`restassured-deep-advanced-api-testing\`.

## XML responses, briefly

ShopEasy is JSON-only; this is a *typical real app* (a legacy SOAP-ish order service). The same DSL works because the parser is chosen by \`Content-Type\`:

\`\`\`java
given().spec(legacy).get("/orders/1001.xml")
.then()
    .statusCode(200)
    .body("order.@status", equalTo("PLACED"))                          // attribute
    .body("order.items.item.size()", equalTo(2))
    .body("order.items.item.find { it.@productId == '2' }.quantity.toInteger()", equalTo(2))
    .body("**.findAll { it.name() == 'lineTotal' }.size()", equalTo(2))  // depth-first search
    .body(hasXPath("/order/total[text()='53.97']"));

XmlPath xml = response.xmlPath();
BigDecimal total = new BigDecimal(xml.getString("order.total"));
\`\`\`

XML values are text: convert explicitly (\`toInteger()\`, \`new BigDecimal(...)\`). Namespaces need \`XmlConfig.xmlConfig().declareNamespace(prefix, uri)\` for \`hasXPath\`. Schema validation for XML uses \`matchesXsd\`/\`matchesXsdInClasspath\` (Hamcrest matchers in REST Assured's \`io.restassured.matcher.RestAssuredMatchers\`).

## Response-time assertions — a caution

\`time(lessThan(...))\` belongs in a functional suite only as a coarse smoke ceiling; it measures the client-side round trip and flakes on busy agents. The reasons and better alternatives are in \`api-framework-design\` and the flakiness section of \`pw-deep-api-testing\` — they apply unchanged to REST Assured.

## Custom matchers and custom assertions

### A Hamcrest matcher for money

Solves the "\`Integer 4\` vs \`BigDecimal 4.00\` vs \`Float 4.0\`" problem once, inside \`then()\`:

\`\`\`java
package com.shopeasy.api.matchers;

import org.hamcrest.Description;
import org.hamcrest.Matcher;
import org.hamcrest.TypeSafeDiagnosingMatcher;

import java.math.BigDecimal;

public final class MoneyMatcher extends TypeSafeDiagnosingMatcher<Number> {

    private final BigDecimal expected;

    private MoneyMatcher(BigDecimal expected) {
        this.expected = expected;
    }

    /** Matches Integer, Float, Double or BigDecimal by numeric value, ignoring scale: money("4.00") matches 4. */
    public static Matcher<Number> money(String expected) {
        return new MoneyMatcher(new BigDecimal(expected));
    }

    @Override
    protected boolean matchesSafely(Number actual, Description mismatch) {
        BigDecimal value = new BigDecimal(actual.toString());   // toString of a Float from JSON keeps its digits
        if (value.compareTo(expected) != 0) {
            mismatch.appendText("was ").appendValue(value.toPlainString())
                    .appendText(" (").appendText(actual.getClass().getSimpleName()).appendText(")");
            return false;
        }
        return true;
    }

    @Override
    public void describeTo(Description description) {
        description.appendText("a money amount of ").appendValue(expected.toPlainString());
    }
}
\`\`\`

Usage: \`.body("tax", money("4.00"))\`, \`.body("items.find { it.productId == 2 }.lineTotal", money("19.98"))\`, and it composes: \`.body("items.lineTotal", everyItem(not(money("0"))))\`. Failure message: *Expected: a money amount of "4.00" but: was "4.01" (BigDecimal)*.

### A Hamcrest matcher for recent ISO instants

\`\`\`java
public final class RecentInstantMatcher extends TypeSafeDiagnosingMatcher<String> {

    private final Duration tolerance;

    private RecentInstantMatcher(Duration tolerance) { this.tolerance = tolerance; }

    public static Matcher<String> isoInstantWithin(Duration tolerance) {
        return new RecentInstantMatcher(tolerance);
    }

    @Override
    protected boolean matchesSafely(String text, Description mismatch) {
        Instant value;
        try {
            value = Instant.parse(text);                                    // format check
        } catch (DateTimeParseException e) {
            mismatch.appendText("was not an ISO-8601 instant: ").appendValue(text);
            return false;
        }
        Duration distance = Duration.between(value, Instant.now()).abs();
        if (distance.compareTo(tolerance) > 0) {
            mismatch.appendText("was ").appendValue(text).appendText(", ").appendValue(distance).appendText(" from now");
            return false;
        }
        return true;
    }

    @Override
    public void describeTo(Description description) {
        description.appendText("an ISO-8601 instant within ").appendValue(tolerance).appendText(" of now");
    }
}
\`\`\`

\`TypeSafeDiagnosingMatcher\` (rather than \`BaseMatcher\`) gives null/type safety and lets the mismatch text explain **why** — that text ends up in the report.

### An AssertJ assertion for the domain: \`OrderAssert\`

When the same multi-field rule appears in many tests ("an order's money adds up"), give it a name:

\`\`\`java
package com.shopeasy.api.assertions;

import com.shopeasy.api.models.Order;
import com.shopeasy.api.models.OrderLine;
import org.assertj.core.api.AbstractAssert;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

public final class OrderAssert extends AbstractAssert<OrderAssert, Order> {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.08");

    private OrderAssert(Order actual) {
        super(actual, OrderAssert.class);
    }

    public static OrderAssert assertThatOrder(Order actual) {
        return new OrderAssert(actual);
    }

    public OrderAssert isPlaced() {
        isNotNull();
        if (!"PLACED".equals(actual.status())) {
            failWithMessage("Expected order %d to be PLACED but was %s", actual.id(), actual.status());
        }
        return this;
    }

    public OrderAssert belongsTo(int userId) {
        isNotNull();
        if (actual.userId() != userId) {
            failWithMessage("Expected order %d to belong to user %d but was user %d", actual.id(), userId, actual.userId());
        }
        return this;
    }

    public OrderAssert hasLine(int productId, int quantity) {
        isNotNull();
        boolean found = actual.items().stream()
                .anyMatch(l -> l.productId() == productId && l.quantity() == quantity);
        if (!found) {
            failWithMessage("Expected order %d to contain product %d x %d but lines were %s",
                    actual.id(), productId, quantity, actual.items());
        }
        return this;
    }

    /** lineTotal = price x quantity; subtotal = sum of lines; tax = 8% half-up; total = subtotal + tax; itemCount. */
    public OrderAssert hasConsistentTotals() {
        isNotNull();
        BigDecimal subtotal = BigDecimal.ZERO;
        int units = 0;
        for (OrderLine line : actual.items()) {
            BigDecimal expectedLine = line.price().multiply(BigDecimal.valueOf(line.quantity()))
                    .setScale(2, RoundingMode.HALF_UP);
            if (line.lineTotal().compareTo(expectedLine) != 0) {
                failWithMessage("Line for product %d: expected lineTotal %s (%s x %d) but was %s",
                        line.productId(), expectedLine, line.price(), line.quantity(), line.lineTotal());
            }
            subtotal = subtotal.add(line.lineTotal());
            units += line.quantity();
        }
        BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax);
        checkMoney("subtotal", subtotal, actual.subtotal());
        checkMoney("tax", tax, actual.tax());
        checkMoney("total", total, actual.total());
        if (actual.itemCount() != units) {
            failWithMessage("Expected itemCount %d (sum of quantities) but was %d", units, actual.itemCount());
        }
        return this;
    }

    public OrderAssert hasTotals(String subtotal, String tax, String total) {
        isNotNull();
        checkMoney("subtotal", new BigDecimal(subtotal), actual.subtotal());
        checkMoney("tax", new BigDecimal(tax), actual.tax());
        checkMoney("total", new BigDecimal(total), actual.total());
        return this;
    }

    public OrderAssert wasCreatedBetween(Instant from, Instant to) {
        isNotNull();
        if (actual.createdAt() == null || actual.createdAt().isBefore(from) || actual.createdAt().isAfter(to)) {
            failWithMessage("Expected createdAt between %s and %s but was %s", from, to, actual.createdAt());
        }
        return this;
    }

    private void checkMoney(String field, BigDecimal expected, BigDecimal actualValue) {
        if (actualValue == null || actualValue.compareTo(expected) != 0) {
            failWithMessage("Expected %s %s but was %s (order %d)", field, expected.toPlainString(), actualValue, actual.id());
        }
    }
}
\`\`\`

| | Inline assertions | Custom Hamcrest matcher | Custom AssertJ assertion |
|---|---|---|---|
| How it works | assertions written in each test | \`Matcher<T>\` used in \`body(...)\` / \`assertThat\` | \`AbstractAssert\` subclass with domain methods |
| Advantages | nothing to learn | composes with \`everyItem\`, \`allOf\`; works inside \`then()\` on GPath values | fluent domain language, chaining, rich messages, IDE completion |
| Disadvantages | duplication, inconsistent messages | one value at a time; verbose to write | works on deserialised objects only |
| When to use | one-off checks | value-level rules (money, formats, ids) | object-level rules (order consistency, user privacy) |

**Recommended approach and why:** matchers for value rules that appear inside \`then()\`, AssertJ assertions for domain objects. Both live in the framework module, have unit tests of their own (yes — a matcher that never fails is worse than none), and produce messages a developer can act on without opening the test.

## Complete example: \`POST /api/orders\` end to end

Every test owns its customer (\`POST /api/users\` with a unique username), so it is parallel-safe without \`/api/reset\`.

\`\`\`java
package com.shopeasy.api.models;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record Customer(String firstName, String lastName, String postalCode) { }

public record OrderLine(int productId, String name, BigDecimal price, int quantity, BigDecimal lineTotal) { }

public record Order(int id, int userId, String status, Customer customer, List<OrderLine> items,
                    int itemCount, BigDecimal subtotal, BigDecimal tax, BigDecimal total, Instant createdAt) { }

public record OrderRequest(String firstName, String lastName, String postalCode) { }   // no items: order the cart
\`\`\`

(One public type per file in real code; shown together for brevity.)

\`\`\`java
package com.shopeasy.api.tests;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.shopeasy.api.models.Customer;
import com.shopeasy.api.models.Order;
import com.shopeasy.api.models.OrderRequest;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.JsonConfig;
import io.restassured.config.ObjectMapperConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.http.ContentType;
import io.restassured.path.json.config.JsonPathConfig;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static com.shopeasy.api.assertions.OrderAssert.assertThatOrder;
import static com.shopeasy.api.matchers.MoneyMatcher.money;
import static com.shopeasy.api.matchers.RecentInstantMatcher.isoInstantWithin;
import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

public class OrderCheckoutContractTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)      // drift is the schema's job
            .build();

    private static final RequestSpecification BASE = new RequestSpecBuilder()
            .setBaseUri("http://localhost:5181")
            .setContentType(ContentType.JSON)
            .setAccept(ContentType.JSON)
            .setConfig(RestAssuredConfig.config()
                    .jsonConfig(JsonConfig.jsonConfig()
                            .numberReturnType(JsonPathConfig.NumberReturnType.BIG_DECIMAL))
                    .objectMapperConfig(ObjectMapperConfig.objectMapperConfig()
                            .jackson2ObjectMapperFactory((type, charset) -> MAPPER)))
            .build();

    @Test
    public void orderPlacedFromTheCartIsPricedPersistedAndClearsTheCart() {
        // 1. Arrange: a brand-new customer owned by this test
        String username = "qa_" + UUID.randomUUID().toString().substring(0, 8);
        String password = "Checkout-2026";
        Response registered = given().spec(BASE)
                .body(Map.of("username", username, "password", password,
                        "firstName", "Mira", "lastName", "Nair", "email", username + "@shopeasy.test"))
            .when().post("/api/users")
            .then().statusCode(201)
                .body("username", equalTo(username))
                .body("roles", contains("CUSTOMER"))
                .extract().response();
        int userId = registered.path("id");
        assertThat(registered.header("Location")).isEqualTo("/api/users/" + userId);

        String token = given().spec(BASE)
                .body(Map.of("username", username, "password", password))
            .when().post("/api/auth/login")
            .then().statusCode(200)
                .body("user.id", equalTo(userId))
                .extract().path("token");
        RequestSpecification customer = new RequestSpecBuilder()
                .addRequestSpecification(BASE)
                .addHeader("Authorization", "Bearer " + token)
                .build();

        // 2. Fill the cart: backpack x1 (29.99), bike light x2 (9.99)
        given().spec(customer).body(Map.of("productId", 1, "quantity", 1))
            .when().post("/api/cart/items")
            .then().statusCode(201);
        given().spec(customer).body(Map.of("productId", 2, "quantity", 2))
            .when().post("/api/cart/items")
            .then().statusCode(201)
                .body("itemCount", equalTo(3))
                .body("items.find { it.productId == 2 }.lineTotal", money("19.98"))
                .body("subtotal", money("49.97"));

        // 3. Act: order the cart
        Instant before = Instant.now().minusSeconds(5);                       // clock-skew tolerance
        Response placed = given().spec(customer)
                .body(new OrderRequest("Mira", "Nair", "400001"))
            .when().post("/api/orders")
            .then().statusCode(201)
                .contentType(ContentType.JSON)
                .body(matchesJsonSchemaInClasspath("schemas/order-schema.json"))   // shape
                .body("status", equalTo("PLACED"))                                 // key values in then()
                .body("tax", money("4.00"))                                        // JSON says 4
                .body("createdAt", isoInstantWithin(Duration.ofMinutes(1)))
                .extract().response();
        Instant after = Instant.now().plusSeconds(5);

        // 4. Assert: typed domain checks
        Order order = placed.as(Order.class);
        assertThat(placed.header("Location")).isEqualTo("/api/orders/" + order.id());
        assertThatOrder(order)
                .isPlaced()
                .belongsTo(userId)
                .hasLine(1, 1)
                .hasLine(2, 2)
                .hasConsistentTotals()                                    // rule: lines, subtotal, 8% tax, total
                .hasTotals("49.97", "4.00", "53.97")                       // example: the concrete numbers
                .wasCreatedBetween(before, after);
        assertThat(order.customer()).isEqualTo(new Customer("Mira", "Nair", "400001"));

        // 5. Persisted: read back through the Location header and compare the whole object
        Order readBack = given().spec(customer)
            .when().get(placed.header("Location"))
            .then().statusCode(200)
                .extract().as(Order.class);
        assertThat(readBack)
                .usingRecursiveComparison()
                .withComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .isEqualTo(order);

        // 6. Side effects: listed in my orders, cart emptied
        given().spec(customer)
            .when().get("/api/orders")
            .then().statusCode(200)
                .body("data", hasSize(1))
                .body("data.id", contains(order.id()));
        given().spec(customer)
            .when().get("/api/cart")
            .then().statusCode(200)
                .body("itemCount", equalTo(0))
                .body("items", empty())
                .body("subtotal", money("0"));
    }
}
\`\`\`

**Step by step**

1. **Own data.** A UUID-based username satisfies ShopEasy's rule (3–40 of \`[a-z0-9_.-]\`); the test never touches \`standard_user\`'s cart, so it runs in parallel and without a reset. The \`Location\` of the new user is checked once — contract, not decoration.
2. **Per-test spec** built from the immutable \`BASE\` (see \`restassured-deep-internals-http\`); \`BIG_DECIMAL\` for GPath, a Jackson mapper with \`JavaTimeModule\` for \`Instant\`.
3. **Intermediate assertions** on the cart catch a pricing bug where it happens (cart), not two steps later (order).
4. **\`then()\` holds the cheap, readable checks**: status, content type, schema, status value, a money value and the timestamp format/recency. \`money("4.00")\` passes although the JSON says \`4\`.
5. **\`OrderAssert\` holds the business rule** (\`hasConsistentTotals\`) and the concrete example (\`hasTotals\`). The rule alone would pass if the server dropped a line; the example alone would not explain *which* calculation is wrong. Together they do both.
6. **Read-back via \`Location\`** proves persistence and that \`Location\` is correct; recursive comparison with the \`BigDecimal\` comparator compares every field, including \`createdAt\`.
7. **Side effects**: the order list has exactly this order, and ordering the cart emptied it (\`subtotal\` is \`0\` in JSON, matched by \`money("0")\`).

**Real project scenario:** on a typical e-commerce project, a release changed the tax rounding from per-order to per-line. Field checks on one basket still passed (no rounding difference for that basket); \`hasConsistentTotals\` failed on a three-line basket with "expected tax 2.40 but was 2.41" and named the order — a one-line defect report.

## Common mistakes and debugging

| Symptom | Cause | Fix |
|---|---|---|
| \`Cannot get property 'x' on null object\` from a GPath | \`find\` matched nothing | check the filter; \`?.\` if absence is legal; assert \`hasItem\` on the key list first for a clearer message |
| \`Expected: <4.00> but: was <4>\` | \`BigDecimal.equals\` scale / \`Integer\` vs \`BigDecimal\` | \`money(...)\`, \`comparesEqualTo\` on known decimals, DTO + \`compareTo\` |
| schema test green after adding \`const\` / \`if\` | draft-07 keywords ignored by the draft-04 engine in 5.x | write draft-04, or upgrade to 6.1+ and declare \`$schema\` |
| \`ClassCastException ... LinkedHashMap cannot be cast to Product\` | generic type erased (\`as(List.class)\`, raw \`getList\`) | \`TypeRef\` or \`getList(path, Product.class)\` |
| recursive comparison fails on \`createdAt\` only in CI | different precision/timezone in expected object | ignore generated fields, assert them separately with a tolerance |
| JSONAssert STRICT fails after a harmless backend release | new field added | \`LENIENT\`/\`STRICT_ORDER\` for functional checks; strict only where additions must be reviewed |
| \`matchesJsonSchemaInClasspath\` cannot find the file | path includes \`src/test/resources\` or the file is not on the test classpath | path relative to the classpath root: \`schemas/order-schema.json\` |

## Equivalent in Playwright (TypeScript)

Playwright has no GPath: you get \`await res.json()\` and use TypeScript (\`data.filter(p => p.price > 20).map(p => p.name)\`), \`expect(obj).toMatchObject(partial)\` as a built-in lenient comparison, \`toEqual\` with \`expect.any(String)\` for generated fields, and Ajv or zod for schemas (draft-07/2020-12 out of the box). Money needs the same care — JavaScript numbers are doubles. Details in \`pw-deep-api-testing\`.

## Best practices for experienced engineers

- Layer validation: schema for shape, field assertions for the values the test is about, domain assertions for rules, whole-object comparison for read-back/migration.
- Keep GPath to one-line rules; name nested closure parameters; prefer \`param\` over \`withArgs\` for data-driven values.
- Deserialise into records with \`BigDecimal\` money and \`Instant\` timestamps; assert status before deserialising.
- Compare money with \`compareTo\` semantics everywhere (\`money(...)\`, \`comparesEqualTo\`, \`isEqualByComparingTo\`, a \`BigDecimal\` comparator in recursive comparison).
- Compute expectations with the product's rounding rule — and know it.
- Write schemas in the draft your module version supports; review generated schemas; validate against checked-in copies; be deliberate about \`additionalProperties\` and enums.
- Ignore only truly generated fields — and assert those separately (format, range, uniqueness).
- Package recurring rules as matchers and \`OrderAssert\`-style assertions with unit tests and actionable messages.

## Interview questions

### Q: How does REST Assured evaluate a path like data.findAll { it.price > 20 }.name?

**Short answer (30–60 s):** It parses the JSON into maps and lists and evaluates the path as a Groovy GPath expression: \`findAll\` filters with the closure, and \`.name\` on the resulting list is an implicit spread that collects every name. Number types depend on \`JsonConfig\`.

**Detailed answer:** Because it is Groovy, every collection method works (\`collect\`, \`every\`, \`countBy\`, \`collectMany\`), errors surface at runtime (\`Cannot get property on null object\`), and arithmetic follows Groovy promotion (\`Float\` × int → \`Double\`, \`BigDecimal\` stays exact). Name parameters in nested closures to avoid \`it\` shadowing; use \`withArgs\`, \`rootPath\` or \`JsonPath.param\` instead of concatenating paths.

### Q: REST Assured JsonPath vs Jayway JsonPath — what's the difference and when do you use each?

**Short answer (30–60 s):** Different libraries and syntaxes: REST Assured uses Groovy GPath (\`data.findAll { ... }\`), Jayway uses \`$\`-syntax (\`$.data[?(@.price > 20)]\`, deep scan \`$..price\`). GPath inside REST Assured tests; Jayway when paths must be shared with WireMock, Spring tests or other tools, or when I need deep scan.

**Detailed answer:** GPath can transform and aggregate (\`collect\`, \`sum\`, \`countBy\`); Jayway has filters and a few functions, and indefinite paths always return lists. Mixing both in one class confuses reviewers.

### Q: How do you compare a whole response while ignoring generated fields?

**Short answer (30–60 s):** Deserialise and use AssertJ \`usingRecursiveComparison().ignoringFields("id", "createdAt")\` with a \`BigDecimal\` comparator, or JSONAssert with a \`CustomComparator\` and \`Customization\`s that ignore those paths. Then assert the ignored fields separately — format, range, uniqueness.

**Detailed answer:** Choose the mode deliberately: recursive comparison checks what the DTO models (unknown fields invisible), JSONAssert STRICT also catches unknown fields, LENIENT allows extras. Golden files for big stable payloads, with a reviewed update mode. Never make one exact comparison the only assertion.

### Q: How do you assert money correctly with REST Assured?

**Short answer (30–60 s):** Never with floats or \`BigDecimal.equals\`. Use \`BIG_DECIMAL\` number return type or DTOs with \`BigDecimal\` fields, compare by value (\`compareTo\`, \`comparesEqualTo\`, \`isEqualByComparingTo\`), and compute expectations with the product's rounding rule.

**Detailed answer:** Mention ShopEasy's \`4\` for 4.00: GPath gives an \`Integer\` even with \`BIG_DECIMAL\`, so a type-tolerant matcher (\`money("4.00")\`) or a DTO is needed. Discuss per-line vs per-order rounding, HALF_UP vs HALF_EVEN, and why JS doubles and \`BigDecimal\` can disagree on ties.

### Q: Which JSON Schema drafts does REST Assured's json-schema-validator support?

**Short answer (30–60 s):** In 5.x it uses the java-json-tools validator: draft-04 (and draft-03). Newer-draft schemas are validated with draft-04 semantics, so newer keywords are silently ignored. From 6.1.0 the module uses networknt and supports draft-06, -07, 2019-09 and 2020-12, chosen from \`$schema\`.

**Detailed answer:** That is why ShopEasy publishes a draft-04 schema with boolean \`exclusiveMinimum\`. Practical rules: declare \`$schema\`, write in the draft the engine supports, add a negative unit test for each schema (a document that must fail) to prove the keywords are enforced, and know that \`format\` is annotation-only in 2019-09/2020-12.

### Q: Strict or permissive schemas?

**Short answer (30–60 s):** Strict on required fields and types everywhere; \`additionalProperties: false\` where unexpected data is a risk (user, auth, order payloads) or where we own the contract; permissive where the provider must evolve freely. Additive changes should be reviewed, not silently accepted or randomly breaking.

**Detailed answer:** Discuss enums (closed lists break on new values), \`integer\` vs \`number\`, \`multipleOf\` precision problems, a separate drift test, and the difference between a schema check in our suite (after deployment) and Pact in the provider's build.

### Q: When would you write a custom Hamcrest matcher vs a custom AssertJ assertion?

**Short answer (30–60 s):** A Hamcrest matcher for value rules used inside \`then()\` on GPath values — money, ISO instants, id formats. An AssertJ assertion for domain-object rules over several fields — \`OrderAssert.hasConsistentTotals()\`.

**Detailed answer:** Use \`TypeSafeDiagnosingMatcher\` for good mismatch text; \`AbstractAssert\` with \`isNotNull()\` and \`failWithMessage\` for fluent domain checks. Both belong in the framework module with their own unit tests.

### Q: How do you validate an XML response in REST Assured?

**Short answer (30–60 s):** The same DSL: GPath over XML (\`order.items.item.size()\`, attributes with \`@\`, depth-first \`**\`), \`hasXPath\` for XPath, \`XmlPath\` for extraction, \`matchesXsdInClasspath\` for schema validation.

**Detailed answer:** Values are text — convert explicitly; declare namespaces in \`XmlConfig\` for XPath; content type decides the parser.

## Scenario-based questions

**1. A developer changed \`price\` from a number to a string ("29.99") and "only one test failed — a sorting test". Why didn't the others catch it, and what do you change?** Most tests asserted with \`containsString\` or extracted via \`getString\`, which tolerate strings. I would add the product schema check to every product-returning endpoint (list, single, cart line), and type money as \`BigDecimal\` in DTOs so deserialisation fails loudly. I would also ask why the change was not caught by contract tests on the provider side and propose Pact for the web shop consumer.

**2. After upgrading the framework to REST Assured 6.1, three schema tests start failing although the API did not change.** The schemas declared \`draft-07\` but were validated with draft-04 semantics before; now \`const\`, \`if/then\` or numeric \`exclusiveMinimum\` are enforced for real. I would read each violation: either the schema was wrong all along (fix the schema) or the API violated a rule we never actually checked (raise a defect). It is a good upgrade outcome — and a lesson to add a "must fail" document per schema.

**3. Your team wants to replace all field assertions with golden-file snapshots "to save time".** I would show the trade-off: snapshots catch everything but fail on every harmless change and invite rubber-stamped updates. I would keep snapshots for large stable payloads (export files, migration parity v1 vs v2), require volatile-field normalisation, block \`-DupdateSnapshots\` in CI, and keep explicit assertions for the business values each test is about.

## Tricky follow-ups

- **Q: \`data.price\` vs \`data*.price\`?** Same result for lists of maps; the explicit spread \`*.\` is useful when a plain property access would hit a method of the list itself.
- **Q: Does \`everyItem(matchesJsonSchemaInClasspath(...))\` validate each list element?** No — elements are parsed maps; validate the document with a page schema that references an item definition.
- **Q: \`comparesEqualTo(new BigDecimal("4.00"))\` against ShopEasy's \`tax\` with BIG_DECIMAL config?** Fails with a \`ClassCastException\`/mismatch when the JSON is \`4\` — that value is an \`Integer\`. Use a type-tolerant money matcher or a DTO.
- **Q: Why not validate responses against the schema the API itself serves?** If code and published schema drift together, the check proves nothing; validate against the reviewed, checked-in contract.
- **Q: Is a schema check a contract test?** It is a contract *check* on the consumer side after deployment; consumer-driven contract testing (Pact) verifies the provider against consumer expectations in the provider's own pipeline.`,
  keyPoints: [
    'GPath is Groovy evaluated at runtime over parsed maps/lists: any collection method works (collect, every, countBy, collectMany, sum), property access on lists is an implicit spread, numbers follow JsonConfig, and absent matches throw unless you use ?.',
    'Name closure parameters in nested closures; use withArgs, rootPath/noRootPath or JsonPath.param instead of string-built paths — param is the safest for data-driven values.',
    'REST Assured JsonPath (GPath) and Jayway JsonPath ($-syntax, deep scan $..) are different libraries; use Jayway only when paths are shared with other tools or need deep scan.',
    'Deserialise into records with BigDecimal money and Instant timestamps (as, TypeRef, getList(path, T.class)); assert the status first.',
    'Compare whole objects with AssertJ recursive comparison (ignore generated fields, BigDecimal comparator) or JSONAssert modes; layer with schemas and field checks; golden files only for big stable payloads.',
    'Money: never floats or BigDecimal.equals; ShopEasy sends 4 for 4.00, so GPath gives Integer even with BIG_DECIMAL — use a type-tolerant matcher or DTOs, and the product\'s rounding rule for expectations.',
    'REST Assured 5.x json-schema-validator uses java-json-tools (draft-04/03); newer keywords are silently ignored until 6.1.0 (networknt, draft from $schema). Be deliberate about additionalProperties, enums and multipleOf; validate against checked-in schemas.',
    'Package recurring rules as Hamcrest matchers (money, ISO instants) and AssertJ assertions (OrderAssert) with actionable messages and their own unit tests.',
  ],
  mistakes: [
    'Writing a draft-07 schema (const, if/then, $defs) and trusting a green REST Assured 5.x validation — the draft-04 engine ignores unknown keywords. Fix: write draft-04 (as ShopEasy does) or upgrade to 6.1+ with $schema declared, and keep one must-fail document per schema to prove the rules are enforced.',
    'Asserting money with equalTo(new BigDecimal("4.00")) or floats — fails on scale or type when the JSON says 4. Fix: a money(...) matcher comparing by value, comparesEqualTo for known decimals, BigDecimal DTO fields with compareTo/isEqualByComparingTo.',
    'One giant STRICT JSONAssert or snapshot as the only assertion — every harmless additive change or timestamp tweak fails hundreds of tests. Fix: layer schema + targeted field checks + domain assertions; strict comparison only where unreviewed additions must fail.',
    'Nested GPath closures using it in both levels (data.findAll { it.items.any { it.productId == 2 } }) and getting wrong results or Groovy errors. Fix: named parameters (o -> ..., i -> ...), or deserialise and use Java streams for multi-step logic.',
    'Ignoring id and createdAt in a whole-object comparison and never checking them anywhere. Fix: assert generated fields separately — Location matches id, createdAt is an ISO instant within a tolerance, ids differ between two creates.',
    'Validating against the schema the API serves at runtime and calling it a contract test. Fix: validate against a reviewed checked-in schema (or the agreed OpenAPI), use the live schema only to detect that the published contract changed, and use Pact for provider-side protection.',
  ],
  tryIt: `Against ShopEasy (\`npm run api\`): (1) on \`GET /api/products\` with \`BIG_DECIMAL\` config, write GPath for the total inventory value (expect 2948.33), products per category, and the invariant \`inStock == (stock > 0)\`; repeat the inventory value with the default Float config and explain the difference; (2) save \`/api/schema/product\` as a page schema for \`GET /api/products\` (\`data\` items via \`#/definitions/product\`) and validate the first page; then add \`"const"\` to a property, confirm 5.x ignores it, and write a must-fail document; (3) implement \`MoneyMatcher\` and use it on \`POST /api/orders\` where the tax is a round amount (backpack x1 + bike light x2 gives tax 4); (4) write \`order-schema.json\` from the fields \`POST /api/orders\` actually returns and run the complete \`OrderCheckoutContractTest\`; (5) break one thing at a time — remove \`ignoringFields\`, compare with \`equalTo(new BigDecimal("4.00"))\`, switch JSONAssert to \`STRICT\` and add a field to the expected file — and read each failure message.`,
  problems: ['api-015', 'api-023', 'api-025', 'api-035', 'api-043'],
}
