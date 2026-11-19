export default {
  slug: 'api-sending-data',
  category: 'restassured',
  order: 4,
  title: 'Sending data: POST, PUT, PATCH, DELETE with String, Map and POJO bodies',
  minutes: 10,
  summary: 'Send JSON bodies three ways (String, Map, POJO with Jackson), know when to use PUT vs PATCH vs DELETE, and turn a response back into a Java object with .as().',
  manualAnalogy: `In Postman you pick POST, switch the Body tab to **raw → JSON**, type the JSON and press Send. You also know from manual testing that "edit profile" and "replace profile" behave differently. In RestAssured the body goes into \`given().body(...)\`, and the verb you call decides whether you create, replace, change or remove.`,
  body: `## Three ways to build a JSON body

Every request with a body needs \`contentType(ContentType.JSON)\` so the server knows how to read it.

### 1. A String — quick, but brittle

\`\`\`java
String body = """
    { "productId": 2, "quantity": 1 }
    """;
given().contentType(ContentType.JSON).body(body)
.when().post("/api/cart/items");
\`\`\`

The \`"""\` **text block** (Java 15+) lets you paste JSON without escaping quotes. Fine for a first test or a deliberately broken payload (\`"{ bad json"\` to test the 400 INVALID_JSON path). Bad for real tests: no compiler help, a typo in a key is only found at runtime, and values are hard to vary.

### 2. A Map — flexible

\`\`\`java
Map<String, Object> item = new HashMap<>();
item.put("productId", 2);
item.put("quantity", 3);

given().contentType(ContentType.JSON).body(item)
.when().post("/api/cart/items");
\`\`\`

RestAssured hands the Map to **Jackson** (\`jackson-databind\` must be on the classpath), which writes \`{"productId":2,"quantity":3}\`. Maps are great for data-driven tests where you remove or blank one field per row. Nested objects are Maps inside Maps: \`Map.of("address", Map.of("city", "Mysuru"))\`.

### 3. A POJO — the professional default

A **POJO** (plain old Java object) is a small class whose fields mirror the JSON:

\`\`\`java
public class CartItemRequest {
    private int productId;
    private int quantity;

    public CartItemRequest() {}                          // Jackson needs this
    public CartItemRequest(int productId, int quantity) {
        this.productId = productId;
        this.quantity = quantity;
    }
    public int getProductId() { return productId; }      // Jackson reads getters
    public int getQuantity()  { return quantity; }
}

given().contentType(ContentType.JSON).body(new CartItemRequest(2, 3))
.when().post("/api/cart/items");
\`\`\`

The compiler now catches typos, IDEs autocomplete fields, and the class documents the contract. Turning an object into JSON is **serialisation**.

## Reading a response into a POJO

The reverse — JSON into an object — is **deserialisation**:

\`\`\`java
User user = given().pathParam("id", 3)
    .when().get("/api/users/{id}")
    .then().statusCode(200)
    .extract().as(User.class);

Assert.assertEquals(user.getAddress().getCity(), "San Francisco");
\`\`\`

\`User\` has fields \`id, username, firstName, ..., address\`, where \`address\` is another POJO \`Address\`. Jackson matches JSON keys to field/setter names. Two annotations save you trouble:

\`\`\`java
@JsonIgnoreProperties(ignoreUnknown = true)   // a new field from the API won't break old tests
public class User { ... }

@JsonInclude(JsonInclude.Include.NON_NULL)    // don't send "phone": null in requests
public class UserPatch { ... }
\`\`\`

For a list response use \`jsonPath().getList("data", Product.class)\`. Java 17 **records** (\`public record Address(String street, String city, String postalCode, String country) {}\`) also work with modern Jackson and remove the getter boilerplate.

### Generic types: TypeRef

Many APIs wrap lists in the same envelope — ShopEasy's \`{ data, page, size, total, totalPages }\` for products, \`{ data }\` for orders. It is tempting to write one generic class for it:

\`\`\`java
public record Listing<T>(List<T> data) {}
\`\`\`

But \`.as(Listing.class)\` cannot know *what* \`T\` is: Java erases generic types at runtime, so Jackson fills \`data\` with \`LinkedHashMap\`s and you get a \`ClassCastException\` later. **TypeRef** keeps the full type:

\`\`\`java
Listing<Order> orders = given().auth().oauth2(token)
    .when().get("/api/orders")
    .then().statusCode(200)
    .extract().as(new TypeRef<Listing<Order>>() {});      // io.restassured.common.mapper.TypeRef
\`\`\`

The \`{}\` creates a tiny anonymous subclass, and *that* class remembers \`Listing<Order>\`. The same works for \`new TypeRef<List<Order>>() {}\` when an endpoint returns a bare array. For money fields prefer \`BigDecimal\` in the model, and compare with \`compareTo(...) == 0\` (not \`equals\`, which also compares the number of decimals).

## PUT vs PATCH vs DELETE

| Verb | ShopEasy | What you send | Test idea |
|---|---|---|---|
| PUT \`/api/users/{id}\` | replace the profile | **every** field incl. full address | omit a field → 400 VALIDATION_FAILED |
| PATCH \`/api/users/{id}\` | change some fields | only the changed ones | other fields stay as they were |
| DELETE \`/api/cart/items/{productId}\` | remove one item | no body | 204, then a second DELETE → 404 |
| DELETE \`/api/cart\` | empty the cart | no body | 204, then GET cart → itemCount 0 |

A PATCH test always has two halves — the change happened **and** nothing else changed:

\`\`\`java
given().contentType(ContentType.JSON)
    .header("Authorization", "Bearer " + token)          // see the auth lesson
    .body(Map.of("address", Map.of("city", "Mysuru")))
.when().patch("/api/users/{id}", 1)
.then().statusCode(200)
    .body("address.city", equalTo("Mysuru"))
    .body("address.street", equalTo("12 MG Road"));      // untouched
\`\`\`

## 204 No Content

A successful DELETE on ShopEasy returns **204** with an empty body. Assert the status and that the body is empty (\`.body(emptyString())\`); there is nothing else to read. Then prove the effect with a follow-up GET.

## Repeating a request: what idempotent really means

Mobile apps retry when the network drops, so "what happens if the same request arrives twice?" is a real test question. **Idempotent** means the *server state* is the same after one call or many — the *status* may differ:

| Repeat on ShopEasy | 2nd status | State after |
|---|---|---|
| \`PATCH /api/users/1 { "phone": ... }\` with the same body | 200 | same profile |
| \`DELETE /api/cart/items/{id}\` | 404 ITEM_NOT_IN_CART | item still gone |
| \`DELETE /api/cart\` | 204 | cart still empty |
| \`POST /api/cart/items\` with the same product | 409 ITEM_ALREADY_IN_CART | cart unchanged |
| \`POST /api/orders\` | 201 again | **two orders** — POST is not idempotent |

The key assertion after a refused repeat (409, 422) is that **nothing changed**: read the resource back and check the old values, because a server that answers 409 *and* applies the change passes a status-only test.

## Getting status codes right for POST

Creating something returns **201 Created**, not 200, plus a \`Location\` header pointing at the new resource. Asserting 201 catches a real class of bugs where a backend "succeeds" but never stored anything.`,
  keyPoints: [
    'Always set contentType(ContentType.JSON) when you send a body.',
    'String bodies (text blocks) are quick; Maps are flexible for data-driven tests; POJOs are the maintainable default.',
    'Jackson serialises POJOs/Maps to JSON and deserialises responses with extract().as(Type.class).',
    '@JsonIgnoreProperties(ignoreUnknown = true) keeps tests stable when the API adds fields.',
    'PUT replaces everything, PATCH changes only what you send, DELETE usually returns 204 — verify the effect with a GET.',
    'Generic wrappers (Page<T>, List<T>) need new TypeRef<...>() {} — .as(Page.class) gives you maps, not objects.',
    'Idempotent = same server state after a repeat; after a refused repeat, prove nothing changed.',
  ],
  mistakes: [
    'POJO without a no-args constructor or getters — Jackson cannot build or read it.',
    'Using PATCH semantics in a PUT test (sending one field) and being surprised by a 400.',
    'Forgetting jackson-databind in the pom — RestAssured cannot serialise the Map/POJO.',
    'Checking only the PATCH response and not that untouched fields kept their values.',
  ],
  tryIt: `In Postman, log in as standard_user, then PATCH http://localhost:5181/api/users/1 with \`{ "phone": "+91-0000" }\` and the Bearer token. Then PUT the same body. Compare the two responses and note which error code and \`details\` the PUT returns. Finish with POST /api/reset.`,
  problems: ['api-006', 'api-008', 'api-009', 'api-025', 'api-026', 'api-037'],
}
