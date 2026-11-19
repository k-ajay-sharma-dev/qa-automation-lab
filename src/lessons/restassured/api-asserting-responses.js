export default {
  slug: 'api-asserting-responses',
  category: 'restassured',
  order: 3,
  title: 'Asserting responses: Hamcrest matchers, JsonPath and error bodies',
  minutes: 9,
  summary: 'Check lists, nested fields, numbers and error bodies with Hamcrest matchers and GPath expressions, and pull values out with jsonPath() when you need Java logic.',
  manualAnalogy: `When you check a response by eye you scan the list ("six products, all have a price, the cheapest is the onesie") and read the error text ("it says Product 99 not found, good"). Hamcrest matchers are those observations written as precise rules, and JsonPath is how you point at the exact field you are looking at.`,
  body: `## Pointing at a field: GPath paths

RestAssured reads JSON with **GPath**, a dotted path language. Given the \`/api/users/1\` response:

\`\`\`json
{ "id": 1, "username": "standard_user", "roles": ["CUSTOMER"],
  "address": { "street": "12 MG Road", "city": "Bengaluru", "postalCode": "560001" } }
\`\`\`

| Path | Value |
|---|---|
| \`username\` | \`"standard_user"\` |
| \`address.city\` | \`"Bengaluru"\` |
| \`roles[0]\` | \`"CUSTOMER"\` |
| \`roles.size()\` | \`1\` |

For a list such as \`{ "data": [ {...}, {...} ] }\`:

| Path | Meaning |
|---|---|
| \`data.size()\` | how many items |
| \`data[0].name\` | first item's name |
| \`data.name\` | **every** item's name, as a list |
| \`data.find { it.id == 5 }.name\` | name of the item whose id is 5 |
| \`data.findAll { it.price > 20 }.name\` | names of items over 20 |
| \`data.price.max()\` | highest price |

\`it\` means "the current item" while GPath loops over the array.

## Hamcrest matchers: the rule part

\`\`\`java
.then()
    .statusCode(200)
    .body("address.city", equalTo("Bengaluru"))
    .body("roles", hasItem("CUSTOMER"))
    .body("email", containsString("@shopeasy.test"))
    .body("phone", not(emptyOrNullString()));
\`\`\`

The matchers you will use 90% of the time:

| Matcher | Use |
|---|---|
| \`equalTo(x)\` | exact value |
| \`hasItem(x)\` / \`hasItems(x, y)\` | list contains these (order irrelevant) |
| \`contains(x, y)\` | list is exactly these, in this order |
| \`hasSize(n)\` | list length |
| \`everyItem(matcher)\` | every element passes, e.g. \`everyItem(greaterThan(0f))\` |
| \`greaterThan\`, \`lessThanOrEqualTo\` | numbers |
| \`containsString\`, \`startsWith\`, \`matchesPattern\` | text |
| \`notNullValue()\`, \`nullValue()\`, \`not(...)\` | presence / negation |
| \`hasKey("details")\` | object has a field |
| \`allOf(...)\`, \`anyOf(...)\` | combine |

Several \`.body(...)\` calls in one \`then()\` are all checked, and the first failure is reported with the path, the expected and the actual value.

## The Float gotcha

RestAssured turns JSON decimals into Java \`Float\` by default. This fails even though the JSON says \`9.99\`:

\`\`\`java
.body("price", equalTo(9.99))     // Expected <9.99> (Double) but was <9.99F> (Float)
\`\`\`

Fix one of two ways:

\`\`\`java
.body("price", equalTo(9.99f))    // compare with a float literal
// or once, globally: parse decimals as BigDecimal
RestAssured.config = RestAssured.config().jsonConfig(
    JsonConfig.jsonConfig().numberReturnType(JsonPathConfig.NumberReturnType.BIG_DECIMAL));
\`\`\`

For money, BigDecimal is the professional choice: \`equalTo(new BigDecimal("9.99"))\`, no rounding surprises. Integers (ids, counts) are plain \`Integer\`, so \`equalTo(3)\` just works.

## Taking values out: jsonPath()

Matchers cover most checks. When you need Java logic (sorting, sums, comparing two responses), extract:

\`\`\`java
Response res = given().queryParam("sort", "price_desc").when().get("/api/products");
JsonPath json = res.jsonPath();

List<String> names  = json.getList("data.name");
List<Float>  prices = json.getList("data.price", Float.class);
int total           = json.getInt("total");
String firstSlug    = json.getString("data[0].slug");
\`\`\`

Then assert with TestNG, for example that a descending sort really is descending:

\`\`\`java
List<Float> sorted = new ArrayList<>(prices);
sorted.sort(Comparator.reverseOrder());
Assert.assertEquals(prices, sorted, "Prices are not in descending order");
\`\`\`

## Asserting error bodies

Every ShopEasy error has the same shape, so a negative test checks status **and** body:

\`\`\`java
given().pathParam("id", 77)
.when().get("/api/users/{id}")
.then()
    .statusCode(404)
    .body("error.code", equalTo("USER_NOT_FOUND"))
    .body("error.message", containsString("77"));
\`\`\`

Validation errors carry a \`details\` list of \`{ field, message }\`. Check *which* field failed:

\`\`\`java
.body("error.details.field", hasItem("username"))
\`\`\`

Assert the stable **code**, and use \`containsString\` on the human message — wording changes more often than codes.

## Headers too

\`\`\`java
.header("Content-Type", containsString("application/json"))
.header("X-Request-Id", notNullValue())
\`\`\`

A 401 from ShopEasy also sends \`WWW-Authenticate: Bearer ...\` — that is part of the contract, so it is worth one assertion.`,
  keyPoints: [
    'GPath walks JSON: a.b, list[0], list.size(), list.field (all values), find/findAll { it... }.',
    'Hamcrest gives readable rules: equalTo, hasItems, hasSize, everyItem, containsString, notNullValue.',
    'JSON decimals arrive as Float by default — use 9.99f or configure BigDecimal for money.',
    'jsonPath().getList / getInt / getString extract values when you need Java logic like sorting checks.',
    'Negative tests assert the error code and the field in details, not only the status.',
  ],
  mistakes: [
    'equalTo(29.99) on a price — fails with Double vs Float; use 29.99f or BigDecimal config.',
    'Using contains(...) when order does not matter — use hasItems(...) instead.',
    'Asserting the full error message text exactly — it changes; assert error.code and containsString.',
    'Extracting everything into Java and using if/else instead of a one-line matcher.',
  ],
  tryIt: `Open http://localhost:5181/api/products?sort=price_asc and write the GPath for: the number of products, the cheapest product's name, all prices, and the name of the product whose stock is 0. Then call http://localhost:5181/api/products?size=0 and write the path to the field name inside error.details.`,
  problems: ['api-004', 'api-007', 'api-013'],
}
