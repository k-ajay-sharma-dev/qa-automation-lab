export default {
  id: 'api-026',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Retries and repeats: 409 on a double add, 404 on a second delete, idempotent empty-cart',
  level: 'INTERMEDIATE',
  tags: ['idempotency', 'delete', 'conflict', 'retries', 'cart'],
  estMinutes: 30,
  scenario: `The mobile app retries a request automatically when 4G drops. Two production tickets came from that: a retried
"Add to cart" got a 409 and the app showed "Something went wrong" (the item *was* in the cart), and a retried "Remove"
got a 404 that the app treated as a crash. The team agreed how the cart API behaves on repeats, and the app now handles
it — but only if the API keeps its word. Your tests must lock that contract in: a duplicate add is refused **without
changing the cart**, a repeated item delete answers 404, and emptying the cart is safe to repeat.`,
  description: `\`@BeforeMethod\` resets the data and logs in \`standard_user\` (given). Write:

1. **doubleAddIsAConflict** — \`POST /api/cart/items\` \`{ productId: 2, quantity: 1 }\` → 201. The same product again with
   \`quantity: 3\` → **409**, \`error.code\` \`"ITEM_ALREADY_IN_CART"\`. Then \`GET /api/cart\`: \`itemCount\` is still **1** and
   the Pulse Bike Light line still has \`quantity\` **1** (GPath \`items.find { it.productId == 2 }.quantity\`).
2. **secondDeleteIs404** — add product 3, \`DELETE /api/cart/items/3\` → **204** with an empty body, the same DELETE again →
   **404** with \`error.code\` \`"ITEM_NOT_IN_CART"\`.
3. **emptyingTheCartIsIdempotent** — add product 1, then \`DELETE /api/cart\` **twice** (a loop or two calls) → 204 both times,
   and \`GET /api/cart\` shows \`itemCount\` 0.

**Rules**
- After the refused add, prove the cart did **not** change — the status alone is not enough.
- No \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartRepeatTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void doubleAddIsAConflict() {
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("productId", 2, "quantity", 1))
        .when().post("/api/cart/items")
        .then().statusCode(201);
        // TODO: add again, expect the conflict, prove the cart is unchanged
    }

    // TODO: secondDeleteIs404, emptyingTheCartIsIdempotent
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartRepeatTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    private RequestSpecification asCustomer() {
        return given().baseUri(BASE_URI).auth().oauth2(token);
    }

    private void addToCart(int productId, int quantity) {
        asCustomer().contentType(ContentType.JSON)
            .body(Map.of("productId", productId, "quantity", quantity))
        .when().post("/api/cart/items")
        .then().statusCode(201);
    }

    @Test
    public void doubleAddIsAConflict() {
        addToCart(2, 1);

        asCustomer().contentType(ContentType.JSON)
            .body(Map.of("productId", 2, "quantity", 3))
        .when()
            .post("/api/cart/items")
        .then()
            .statusCode(409)
            .body("error.code", equalTo("ITEM_ALREADY_IN_CART"));

        asCustomer()
        .when()
            .get("/api/cart")
        .then()
            .statusCode(200)
            .body("itemCount", equalTo(1))
            .body("items.find { it.productId == 2 }.quantity", equalTo(1));
    }

    @Test
    public void secondDeleteIs404() {
        addToCart(3, 1);

        asCustomer()
        .when()
            .delete("/api/cart/items/{productId}", 3)
        .then()
            .statusCode(204)
            .body(emptyString());

        asCustomer()
        .when()
            .delete("/api/cart/items/{productId}", 3)
        .then()
            .statusCode(404)
            .body("error.code", equalTo("ITEM_NOT_IN_CART"));
    }

    @Test
    public void emptyingTheCartIsIdempotent() {
        addToCart(1, 1);

        for (int attempt = 1; attempt <= 2; attempt++) {
            asCustomer()
            .when()
                .delete("/api/cart")
            .then()
                .statusCode(204);
        }

        asCustomer()
        .when()
            .get("/api/cart")
        .then()
            .statusCode(200)
            .body("itemCount", equalTo(0));
    }
}
`,
  checks: [
    { label: 'Duplicate add is a 409 ITEM_ALREADY_IN_CART', pattern: 'statusCode\\(\\s*409\\s*\\)[\\s\\S]*?"ITEM_ALREADY_IN_CART"', hint: '.statusCode(409).body("error.code", equalTo("ITEM_ALREADY_IN_CART"))' },
    { label: 'Proves the quantity did not change', pattern: '"items(\\.find\\s*\\{[^}]*\\}|\\[0\\])\\.quantity"\\s*,\\s*equalTo\\(\\s*1\\s*\\)', hint: '.body("items.find { it.productId == 2 }.quantity", equalTo(1))' },
    { label: 'First delete is 204', pattern: '\\.delete\\([\\s\\S]*?statusCode\\(\\s*204\\s*\\)', hint: '.delete("/api/cart/items/{productId}", 3).then().statusCode(204)' },
    { label: 'Second delete is 404 ITEM_NOT_IN_CART', pattern: 'statusCode\\(\\s*404\\s*\\)[\\s\\S]*?"ITEM_NOT_IN_CART"', hint: '.statusCode(404).body("error.code", equalTo("ITEM_NOT_IN_CART"))' },
    { label: 'Empties the cart more than once', pattern: '(for\\s*\\(|while\\s*\\(|IntStream|\\.delete\\(\\s*"/api/cart"\\s*\\)[\\s\\S]*\\.delete\\(\\s*"/api/cart"\\s*\\))', hint: 'for (int attempt = 1; attempt <= 2; attempt++) { ... .delete("/api/cart") ... }' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'The API is synchronous; a 2xx means it is done.' },
  ],
  hints: [
    'A tiny helper like asCustomer() returning given().baseUri(...).auth().oauth2(token) removes most of the repetition.',
    'items.find { it.productId == 2 }.quantity reads the quantity of exactly that line, whatever its position.',
    '.body(emptyString()) without a path checks the whole body — a 204 must have none.',
  ],
  explanation: `**Idempotent** means "doing it again leaves the server in the same state" — not "returns the same status".
That is why the three rules look different and are all fine:

| Repeat | First call | Second call | Server state after the repeat |
|---|---|---|---|
| add the same product | 201 | **409** ITEM_ALREADY_IN_CART | unchanged (quantity still 1) |
| delete the same item | 204 | **404** ITEM_NOT_IN_CART | unchanged (item gone) |
| empty the cart | 204 | **204** | unchanged (cart empty) |

The most important assertion is the one after the 409: a refused request must not half-apply. If the second add had
silently changed the quantity to 3 *and* returned 409, the status check would pass and the customer would be charged
for three lights. Reading the cart back is the API version of refreshing the page after a click.

\`items.find { it.productId == 2 }\` selects the line by its business key instead of \`items[0]\`, so the test does not
depend on line order.`,
  mistakes: [
    'Asserting only the 409 — a server that rejects AND applies the change passes that test.',
    'Expecting a repeated DELETE to return 204 because "DELETE is idempotent" — idempotency is about state; this API documents 404.',
    'Reading the quantity with items[0] — breaks as soon as the cart has two lines in a different order.',
    'Sleeping between the calls "to let the server catch up" — a synchronous API is done when it answers.',
  ],
  interview: [
    { q: 'What does idempotent mean, and which HTTP methods are idempotent?', a: 'Repeating the request leaves the server in the same state as doing it once. GET, PUT and DELETE are idempotent by definition (and GET is also safe); POST is not. The response status may differ on the repeat (a second DELETE can be 404) — the state must not.' },
    { q: 'How would you test that a client retry cannot create duplicate orders?', a: 'Send the same POST twice (ideally with the same idempotency key header if the API supports one) and assert that only one order exists afterwards, e.g. via GET /orders. Without such a key, document the risk: POST is not idempotent, so a blind retry creates a second order.' },
  ],
}
