export default {
  id: 'api-012',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Extract and chain: place an order, then read it back',
  level: 'INTERMEDIATE',
  tags: ['extract', 'chaining', 'orders', 'location-header'],
  estMinutes: 30,
  scenario: `The mobile "Order confirmation" screen loads the order with \`GET /api/orders/{id}\` right after checkout. In the
last release the create call returned a total that the read call disagreed with (a rounding bug in one of them). A
teammate's test hard-codes order id 1001 — it passes on a fresh server and fails on any shared environment. You need
a test that chains the real flow: cart → order → read the same order.`,
  description: `Token and reset are done in \`@BeforeMethod\`. Write **orderCanBeReadBack**:

1. \`POST /api/cart/items\` with \`{ "productId": 5, "quantity": 2 }\` (2 × Junior Onesie, 7.99) → 201.
2. \`POST /api/orders\` with \`{ "firstName": "Asha", "lastName": "Rao", "postalCode": "560001" }\` (no items → the cart is
   ordered) → 201. Keep the \`Response\` (\`.extract().response()\`), read the **id** (\`response.path("id")\` or
   \`jsonPath().getInt("id")\`) and assert the \`Location\` header equals \`"/api/orders/" + id\`.
3. \`GET /api/orders/{id}\` with the **extracted** id → 200, same \`id\`, \`status\` \`"PLACED"\`, \`total\` **17.26** and the
   total equal to the total from step 2.
4. \`GET /api/cart\` → \`itemCount\` is 0 (ordering empties the cart).

**Rules**
- Never hard-code the order id.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderChainTest {

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
    public void orderCanBeReadBack() {
        // TODO: add to cart, place order, extract id, GET the order, check the cart is empty
        given().baseUri(BASE_URI).auth().oauth2(token)
        .when().get("/api/orders/1001")
        .then().statusCode(200);
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderChainTest {

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
    public void orderCanBeReadBack() {
        // 1. cart
        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("productId", 5, "quantity", 2))
        .when().post("/api/cart/items")
        .then().statusCode(201);

        // 2. order from the cart
        Response created = given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .contentType(ContentType.JSON)
            .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001"))
        .when()
            .post("/api/orders")
        .then()
            .statusCode(201)
            .extract().response();

        int orderId = created.path("id");
        float createdTotal = created.path("total");
        Assert.assertEquals(created.header("Location"), "/api/orders/" + orderId, "Location header");

        // 3. read it back with the extracted id
        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .pathParam("id", orderId)
        .when()
            .get("/api/orders/{id}")
        .then()
            .statusCode(200)
            .body("id", equalTo(orderId))
            .body("status", equalTo("PLACED"))
            .body("total", equalTo(17.26f))
            .body("total", equalTo(createdTotal));

        // 4. the cart was emptied
        given().baseUri(BASE_URI).auth().oauth2(token)
        .when().get("/api/cart")
        .then().statusCode(200).body("itemCount", equalTo(0));
    }
}
`,
  checks: [
    { label: 'Keeps the create Response', pattern: '\\.extract\\(\\)\\s*\\.response\\(\\)', hint: 'Response created = ... .then().statusCode(201).extract().response();' },
    { label: 'Reads the id from the response', pattern: '(\\.path\\(\\s*"id"\\s*\\)|getInt\\(\\s*"id"\\s*\\))', hint: 'int orderId = created.path("id");' },
    { label: 'Checks the Location header', pattern: '"Location"', hint: 'Assert.assertEquals(created.header("Location"), "/api/orders/" + orderId)' },
    { label: 'GETs the order with the extracted id', pattern: '(pathParam\\(\\s*"id"\\s*,\\s*orderId|get\\(\\s*"/api/orders/\\{id\\}"\\s*,\\s*orderId)', hint: '.pathParam("id", orderId) ... .get("/api/orders/{id}")' },
    { label: 'No hard-coded order id', pattern: '1001', mustNot: true, hint: 'Ids differ per environment — use the extracted one.' },
    { label: 'Checks the cart is empty afterwards', pattern: '"itemCount"\\s*,\\s*equalTo\\(\\s*0\\s*\\)', hint: '.body("itemCount", equalTo(0))' },
  ],
  hints: [
    'extract().response() gives you the whole Response: path(...), header(...), jsonPath(), asString().',
    'response.path("id") is generic — assign it to an int and Java infers the type.',
    '2 × 7.99 = 15.98, tax 1.28, total 17.26.',
  ],
  explanation: `**Chaining** is how real API flows are tested: the output of one call (an id, a token, a URL) is the input of the
next. \`.extract().response()\` keeps everything; \`.path("id")\` pulls one value with the same GPath syntax you use in
\`body(...)\`.

The test checks the flow end to end the way the confirmation screen uses it: the **Location** header points at the new
order, the read model agrees with the create response (\`total\` equal), and the side effect happened (cart emptied).

Never hard-code generated ids: on a shared environment order 1001 belongs to someone else (and here you would even
get a 403). Extracting keeps the test independent of data and execution order.`,
  mistakes: [
    'Hard-coding ids from a previous run — tests pass locally and fail everywhere else.',
    'Extracting before asserting the status — a 400 response gives a null id and a confusing NullPointerException.',
    'Comparing the totals as Strings or as double vs Float.',
    'Asserting only the create response and never reading the resource back.',
  ],
  interview: [
    { q: 'How do you pass data between API calls?', a: 'Extract it from the response (extract().path, jsonPath(), as(Pojo)) and use it as a path/query param, body field or header in the next call. In Cucumber, store it in a scenario-scoped context object.' },
    { q: 'Why check the Location header?', a: 'For a 201 it is part of the contract: clients follow it to the new resource. A wrong or missing Location breaks clients even when the body is correct.' },
  ],
}
