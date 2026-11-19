export default {
  slug: 'restassured',
  title: 'RestAssured & API testing',
  sections: [
    {
      heading: 'HTTP methods',
      body: `| Method | Meaning | Body? | Idempotent | ShopEasy example |
|---|---|---|---|---|
| GET | read | no | yes | \`GET /api/products/1\` |
| POST | create / action | yes | **no** (two calls = two orders) | \`POST /api/orders\` |
| PUT | replace the whole resource | yes | yes | \`PUT /api/users/1\` (all fields required) |
| PATCH | change some fields | yes | usually | \`PATCH /api/users/1\` \`{ "phone": "..." }\` |
| DELETE | remove | rarely | yes | \`DELETE /api/cart/items/2\` → 204 |
| OPTIONS | what is allowed (CORS preflight) | no | yes | browser sends it before cross-origin calls |

A request = **method + URL (path + query) + headers + body**. A response = **status code + headers + body**.`,
    },
    {
      heading: 'Status codes',
      body: `| Code | Name | When | Test it by |
|---|---|---|---|
| 200 | OK | read / update succeeded | GET a product |
| 201 | Created | POST created something (often + \`Location\` header) | place an order |
| 204 | No Content | success, **empty body** — don't parse it | DELETE a cart item |
| 400 | Bad Request | malformed / missing fields | order without \`firstName\` |
| 401 | Unauthorized | **who are you?** no / bad token | GET /api/cart without a token |
| 403 | Forbidden | **I know you, but no** | locked_out_user login, someone else's order |
| 404 | Not Found | resource or route missing | GET /api/products/99 |
| 405 | Method Not Allowed | wrong verb on a real path | DELETE /api/products/1 |
| 409 | Conflict | clashes with current state | add the same product to the cart twice |
| 422 | Unprocessable Entity | well-formed but breaks a business rule | quantity 0, out-of-stock item, empty cart |
| 500 | Server Error | bug on the server — always a defect | |

2xx success · 3xx redirect · 4xx **client** mistake (your request) · 5xx **server** mistake (their bug).`,
    },
    {
      heading: 'Headers & content types',
      body: `| Header | Direction | Example |
|---|---|---|
| \`Content-Type\` | what I am **sending** | \`application/json\` |
| \`Accept\` | what I want **back** | \`application/json\` |
| \`Authorization\` | who I am | \`Bearer se_1_0001_...\` |
| \`Location\` | where the new thing lives (201) | \`/api/orders/1001\` |
| \`WWW-Authenticate\` | how to authenticate (401) | \`Bearer realm="shopeasy"\` |
| \`X-Request-Id\` | trace id for the server logs | \`req-00042\` |

\`\`\`java
given().contentType(ContentType.JSON).accept(ContentType.JSON)
       .header("X-Client", "mobile").headers(Map.of("A", "1"));
then().header("Location", containsString("/api/orders/"))
      .contentType(ContentType.JSON);
String loc = response.getHeader("Location");
\`\`\``,
    },
    {
      heading: 'given / when / then',
      body: `\`\`\`java
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

given()                                         // ── the request
    .baseUri("http://localhost:5181").basePath("/api")
    .pathParam("id", 3)                         // fills {id}
    .queryParam("sort", "price_asc")            // ?sort=price_asc
    .queryParams(Map.of("page", 1, "size", 2))
    .header("Authorization", "Bearer " + token)
    .contentType(ContentType.JSON)
    .body(requestObjectOrMapOrString)
.when()                                         // ── the action
    .get("/products/{id}")                      // post / put / patch / delete
.then()                                         // ── the checks
    .statusCode(200)
    .body("name", equalTo("Classic Crew T-Shirt"));

// extract values to use in the next request
int orderId = given()...post("/orders").then().statusCode(201).extract().path("id");
Response res = given()...get("/cart").then().extract().response();
String raw  = res.asString();    res.asPrettyString();   res.statusCode();   res.time();
\`\`\`
Path params: \`.get("/orders/{id}", 1001)\` also works (positional). Static imports make it read like English.`,
    },
    {
      heading: 'Hamcrest matchers',
      body: `| Matcher | Example |
|---|---|
| \`equalTo\` | \`body("status", equalTo("PLACED"))\` |
| \`not\`, \`nullValue\`, \`notNullValue\` | \`body("token", notNullValue())\` |
| \`hasSize\` | \`body("data", hasSize(6))\` |
| \`hasItem\` / \`hasItems\` | \`body("data.name", hasItems("Junior Onesie", "Retro Red Tee"))\` |
| \`everyItem\` | \`body("data.price", everyItem(greaterThan(0f)))\` |
| \`containsString\`, \`startsWith\` | \`body("error.message", containsString("not found"))\` |
| \`greaterThan\`, \`lessThan\`, \`closeTo\` | \`body("total", closeTo(64.78, 0.001))\` (with Double config) |
| \`hasKey\`, \`hasEntry\` | \`body("address", hasKey("postalCode"))\` |
| \`contains\` (exact order) / \`containsInAnyOrder\` | \`body("data.id", contains(4, 1, 3, 6, 2, 5))\` |
| \`isOneOf\`, \`anyOf\`, \`allOf\` | \`statusCode(anyOf(is(200), is(201)))\` |
| \`empty\`, \`emptyString\` | \`body("items", empty())\` |

Several \`body(...)\` calls can be chained; RestAssured reports **every** failing one.`,
    },
    {
      heading: 'JsonPath / GPath',
      body: `\`\`\`text
data                      the whole array
data.size()               number of elements
data[0].name              first element's name      data[-1].name = last
data.name                 list of all names
data.findAll { it.price > 20 }.name        names of products over 20
data.find { it.id == 3 }.price             price of product 3
data.collect { it.price }.sum()            sum of prices
data.price.max()   data.price.min()
error.details.field       list of field names in a 400
address.city              nested object (GET /api/users/1)
\`\`\`
\`\`\`java
JsonPath jp = response.jsonPath();
List<String> names  = jp.getList("data.name");
List<Product> items = jp.getList("data", Product.class);
double total = jp.getDouble("total");
int count    = jp.getInt("data.size()");
Map<String, Object> addr = jp.getMap("address");
\`\`\`
**Float gotcha:** by default JSON decimals come back as \`Float\`, so \`body("price", equalTo(29.99))\` fails (29.99 is a double). Use \`equalTo(29.99f)\`, \`jp.getDouble(...)\`, or configure \`JsonConfig.jsonConfig().numberReturnType(NumberReturnType.DOUBLE)\` (or \`BIG_DECIMAL\` for money).`,
    },
    {
      heading: 'POJOs with Jackson',
      body: `\`\`\`java
@JsonIgnoreProperties(ignoreUnknown = true)      // new server fields don't break tests
public class Product {
    private int id; private String name; private double price;
    public Product() {}                          // required by Jackson
    public int getId() { return id; } /* getters... */
}

// serialise: object -> JSON request body (needs jackson-databind on the classpath)
given().contentType(ContentType.JSON).body(new OrderRequest("Asha", "Rao", "560001").addItem(1, 2))

// deserialise: JSON -> object
Product p        = response.as(Product.class);
Order order      = response.then().statusCode(201).extract().as(Order.class);
List<Product> ps = response.jsonPath().getList("data", Product.class);
List<Product> all = response.as(new TypeRef<List<Product>>() {});  // when the body IS an array
\`\`\`
\`@JsonInclude(Include.NON_NULL)\` leaves null fields out of the request · \`@JsonProperty("first_name")\` maps different names.
Body alternatives: a JSON \`String\` (quick, typo-prone) · \`Map.of(...)\` (no class needed) · POJO (typed, reusable).`,
    },
    {
      heading: 'Specs & logging',
      body: `\`\`\`java
RequestSpecification base = new RequestSpecBuilder()
    .setBaseUri("http://localhost:5181").setBasePath("/api")
    .setContentType(ContentType.JSON)
    .addFilter(new AllureRestAssured())            // optional reporting filter
    .build();

ResponseSpecification okJson = new ResponseSpecBuilder()
    .expectStatusCode(200)
    .expectContentType(ContentType.JSON)
    .expectResponseTime(lessThan(2000L))
    .build();

given().spec(base).when().get("/products").then().spec(okJson);
\`\`\`
| Logging | Prints |
|---|---|
| \`given().log().all()\` | full request |
| \`then().log().body()\` / \`.log().status()\` | response parts |
| \`then().log().ifValidationFails()\` | response only when an assertion fails |
| \`RestAssured.enableLoggingOfRequestAndResponseIfValidationFails()\` | global: quiet when green, everything when red |

Avoid \`log().all()\` on every request in CI — it buries the failure and may leak tokens.`,
    },
    {
      heading: 'Authentication',
      body: `\`\`\`java
// 1. log in, 2. extract the token, 3. send it on every protected call
String token = given().contentType(ContentType.JSON)
    .body(Map.of("username", "standard_user", "password", "secret_sauce"))
    .post("/api/auth/login")
    .then().statusCode(200).extract().path("token");

given().header("Authorization", "Bearer " + token).get("/api/cart");   // explicit
given().auth().oauth2(token).get("/api/cart");                         // same header, built for you
given().auth().preemptive().basic("user", "pass")                     // Basic auth, sent up front
\`\`\`
- Cache the token per user (one login per run, not per test) — but clear it when the server resets.
- Never hard-code real secrets: read them from config / environment variables.
- Test the negatives too: no header → 401, bad token → 401, locked user → 403, someone else's resource → 403.`,
    },
    {
      heading: 'JSON schema validation',
      body: `\`\`\`xml
<dependency>
  <groupId>io.rest-assured</groupId>
  <artifactId>json-schema-validator</artifactId>
  <version>5.5.0</version>
</dependency>
\`\`\`
\`\`\`java
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;

given().get("/api/products/1")
    .then().body(matchesJsonSchemaInClasspath("schemas/product-schema.json"));
\`\`\`
- File goes in \`src/test/resources/schemas/\` (classpath root = \`src/test/resources\`).
- Download the practice schema: \`GET http://localhost:5181/api/schema/product\`.
- Schema = **contract** (fields, types, required, enums, \`additionalProperties: false\`). Value checks still need \`body(...)\` assertions.
- Validate one item: write the schema for one product, or a list schema with \`"items": { "$ref": ... }\`.`,
    },
    {
      heading: 'Response time & timeouts',
      body: `\`\`\`java
given().get("/api/products").then().time(lessThan(800L));                    // ms by default
given().get("/api/products").then().time(lessThan(1L), TimeUnit.SECONDS);
long ms = response.timeIn(TimeUnit.MILLISECONDS);

// fail fast instead of hanging forever (Apache HttpClient settings)
RestAssuredConfig cfg = RestAssuredConfig.config().httpClient(HttpClientConfig.httpClientConfig()
    .setParam("http.connection.timeout", 2000)
    .setParam("http.socket.timeout", 3000));
given().config(cfg).get("/api/slow?ms=5000");   // -> SocketTimeoutException
\`\`\`
Use thresholds as **smoke** guards (SLA breach), not as a performance test — one call on a laptop is noisy. Real load testing = JMeter / Gatling / k6.`,
    },
    {
      heading: 'Cucumber for APIs',
      body: `\`\`\`gherkin
Scenario: Place an order
  Given I am logged in as "standard_user"
  When I place an order for "Asha" "Rao" with postal code "560001" containing
    | productId | quantity |
    | 1         | 2        |
  Then the response status should be 201
  And the order totals should be subtotal 59.98, tax 4.80 and total 64.78
\`\`\`
\`\`\`java
public class ScenarioContext {            // one per scenario, created by PicoContainer
    private Response response; private String token; private Integer lastOrderId;
    // getters / setters
}

public class OrderSteps {
    private final ScenarioContext ctx;
    public OrderSteps(ScenarioContext ctx) { this.ctx = ctx; }   // constructor injection

    @When("I place an order for {string} {string} with postal code {string} containing")
    public void place(String first, String last, String zip, DataTable table) {
        OrderRequest req = new OrderRequest(first, last, zip);
        table.asMaps().forEach(r -> req.addItem(Integer.parseInt(r.get("productId")), Integer.parseInt(r.get("quantity"))));
        ctx.setResponse(new OrderClient(ctx.getToken()).place(req));
    }
}
\`\`\`
- \`When\` steps **send** and store the Response; \`Then\` steps **assert** on \`ctx.getResponse()\`.
- Generic steps (status code, error code) live once in a \`CommonSteps\` class.
- \`@Before\`: reset test data (\`POST /api/reset\`). \`@After\`: attach the last response body when the scenario fails.
- Dependency: \`io.cucumber:cucumber-picocontainer\`. No static fields for state — they leak between scenarios.`,
    },
    {
      heading: 'ShopEasy practice API (npm run api)',
      body: `Base URI **http://localhost:5181**, base path **/api**. Users \`standard_user\` (id 1), \`locked_out_user\` (id 2), \`visual_user\` (id 3) — password \`secret_sauce\`. Tax 8%. Order ids start at 1001 after a reset. Errors: \`{ "error": { "code", "message", "details"? } }\`.

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| GET | /api/health | – | 200 \`{ status: "UP" }\` | |
| POST | /api/reset | – | 200 (seed data back, tokens dropped) | |
| POST | /api/auth/login | – | 200 \`{ token, tokenType, expiresIn, user }\` | 400 VALIDATION_FAILED · 401 INVALID_CREDENTIALS · 403 USER_LOCKED |
| GET | /api/products?q=&sort=&page=&size= | – | 200 \`{ data, page, size, total, totalPages }\` | 400 INVALID_QUERY |
| GET | /api/products/{id} | – | 200 product | 400 INVALID_ID · 404 PRODUCT_NOT_FOUND |
| GET | /api/schema/product | – | 200 JSON Schema | |
| GET | /api/cart | Bearer | 200 \`{ userId, items, itemCount, subtotal }\` | 401 UNAUTHORIZED |
| POST | /api/cart/items \`{ productId, quantity }\` | Bearer | 201 cart | 404 · 409 ITEM_ALREADY_IN_CART · 422 INVALID_QUANTITY / OUT_OF_STOCK |
| DELETE | /api/cart/items/{productId} | Bearer | 204 | 404 ITEM_NOT_IN_CART |
| DELETE | /api/cart | Bearer | 204 | |
| POST | /api/orders \`{ firstName, lastName, postalCode, items? }\` | Bearer | 201 order + Location | 400 VALIDATION_FAILED (details) · 404 · 422 EMPTY_CART |
| GET | /api/orders | Bearer | 200 \`{ data: [order] }\` | |
| GET | /api/orders/{id} | Bearer | 200 order | 403 FORBIDDEN · 404 ORDER_NOT_FOUND |
| GET | /api/users/{id} | – | 200 user with nested \`address\` | 404 USER_NOT_FOUND |
| PUT | /api/users/{id} | Bearer (own) | 200 user | 400 · 403 · 422 INVALID_EMAIL |
| PATCH | /api/users/{id} | Bearer (own) | 200 user | 403 · 422 INVALID_EMAIL / READ_ONLY_FIELD |
| GET | /api/slow?ms=2000 | – | 200 \`{ delayedMs }\` after the delay | 400 (ms 0–10000) |

Sort values: \`name_asc name_desc price_asc price_desc\` (aliases \`az za lohi hilo\`). Unknown route → 404 ROUTE_NOT_FOUND, wrong verb → 405, broken JSON → 400 INVALID_JSON. Product 6 (Retro Red Tee) has stock 0.`,
    },
  ],
}
