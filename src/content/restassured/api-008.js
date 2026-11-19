export default {
  id: 'api-008',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'POJOs with Jackson: send an OrderRequest, read back an Order',
  level: 'INTERMEDIATE',
  tags: ['pojo', 'jackson', 'serialization', 'deserialization', 'post'],
  estMinutes: 30,
  scenario: `The order payload for the mobile checkout has grown to customer fields plus a list of items, and the team's
tests build it with nested Maps — \`Map<String, Object>\` inside \`List<Map<...>>\` — copied into 14 test classes. When
the backend renamed one field, 14 files needed edits and two were missed. The lead asks you to model the request and
the response as Java classes (POJOs) so the compiler finds every usage next time.`,
  description: `Place an order with \`POST /api/orders\` (token already handled in \`@BeforeClass\`) for
**1 × Storm Fleece Jacket (id 4)** and **3 × Pulse Bike Light (id 2)**, customer Asha Rao, postal code 560001.

1. Create POJOs \`OrderItem\` (productId, quantity) and \`OrderRequest\` (firstName, lastName, postalCode, items) with a
   no-arg constructor and getters/setters (or an all-args constructor). Send an \`OrderRequest\` object with \`.body(request)\`.
2. Create an \`Order\` POJO for the response (id, status, subtotal, tax, total, items) annotated with
   \`@JsonIgnoreProperties(ignoreUnknown = true)\`, and convert the response with \`.as(Order.class)\`.
3. Assert with TestNG: status \`"PLACED"\`, 2 items, subtotal **79.96**, tax **6.40**, total **86.36** (use a delta for doubles).

**Rules**
- No \`Map\` in the request any more.
- Assert 201 before deserialising.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.*;

import static io.restassured.RestAssured.given;

public class PlaceOrderPojoTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeClass
    public void login() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");
    }

    @Test
    public void placeOrderForJacketAndLights() {
        Map<String, Object> jacket = new HashMap<>();
        jacket.put("productId", 4);
        jacket.put("quantity", 1);
        Map<String, Object> lights = new HashMap<>();
        lights.put("productId", 2);
        lights.put("quantity", 3);
        Map<String, Object> body = new HashMap<>();
        body.put("firstName", "Asha");
        body.put("lastName", "Rao");
        body.put("postalCode", "560001");
        body.put("items", List.of(jacket, lights));

        given().baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(body)
        .when().post("/api/orders")
        .then().statusCode(201);
        // TODO: POJOs for request and response, assert the money fields
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.restassured.http.ContentType;
import org.testng.Assert;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;

public class PlaceOrderPojoTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    // ---- request POJOs (in a real project: src/test/java/.../models)
    // also reused for the response lines, which carry extra fields (name, price, lineTotal)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OrderItem {
        private int productId;
        private int quantity;

        public OrderItem() {}
        public OrderItem(int productId, int quantity) {
            this.productId = productId;
            this.quantity = quantity;
        }
        public int getProductId() { return productId; }
        public int getQuantity() { return quantity; }
    }

    public static class OrderRequest {
        private String firstName;
        private String lastName;
        private String postalCode;
        private List<OrderItem> items;

        public OrderRequest() {}
        public OrderRequest(String firstName, String lastName, String postalCode, List<OrderItem> items) {
            this.firstName = firstName;
            this.lastName = lastName;
            this.postalCode = postalCode;
            this.items = items;
        }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getPostalCode() { return postalCode; }
        public List<OrderItem> getItems() { return items; }
    }

    // ---- response POJO: only the fields this test needs, ignore the rest
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Order {
        private int id;
        private String status;
        private double subtotal;
        private double tax;
        private double total;
        private List<OrderItem> items;

        public int getId() { return id; }
        public String getStatus() { return status; }
        public double getSubtotal() { return subtotal; }
        public double getTax() { return tax; }
        public double getTotal() { return total; }
        public List<OrderItem> getItems() { return items; }
    }

    @BeforeClass
    public void login() {
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");
    }

    @Test
    public void placeOrderForJacketAndLights() {
        OrderRequest request = new OrderRequest("Asha", "Rao", "560001",
            List.of(new OrderItem(4, 1), new OrderItem(2, 3)));

        Order order = given()
            .baseUri(BASE_URI)
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(request)
        .when()
            .post("/api/orders")
        .then()
            .statusCode(201)
            .extract().as(Order.class);

        Assert.assertTrue(order.getId() > 0, "Order id");
        Assert.assertEquals(order.getStatus(), "PLACED");
        Assert.assertEquals(order.getItems().size(), 2, "Number of order lines");
        Assert.assertEquals(order.getSubtotal(), 79.96, 0.001, "Subtotal");
        Assert.assertEquals(order.getTax(), 6.40, 0.001, "Tax (8%)");
        Assert.assertEquals(order.getTotal(), 86.36, 0.001, "Total");
    }
}
`,
  checks: [
    { label: 'Has an OrderRequest POJO', pattern: 'class\\s+OrderRequest\\b', hint: 'public static class OrderRequest { private String firstName; ... }' },
    { label: 'Has an OrderItem POJO', pattern: 'class\\s+OrderItem\\b', hint: 'public static class OrderItem { private int productId; private int quantity; }' },
    { label: 'Response POJO ignores unknown fields', pattern: '@JsonIgnoreProperties\\(\\s*ignoreUnknown\\s*=\\s*true\\s*\\)', hint: '@JsonIgnoreProperties(ignoreUnknown = true)' },
    { label: 'Deserialises with .as(Order.class)', pattern: '\\.as\\(\\s*Order\\.class\\s*\\)', hint: '.then().statusCode(201).extract().as(Order.class)' },
    { label: 'No Map-based request body', pattern: 'new\\s+HashMap<', mustNot: true, hint: 'Build an OrderRequest object instead of nested maps.' },
    { label: 'Asserts the total', pattern: 'getTotal\\(\\)\\s*,\\s*86\\.36', hint: 'Assert.assertEquals(order.getTotal(), 86.36, 0.001)' },
  ],
  hints: [
    'Jackson maps JSON keys to Java fields by getter name: getFirstName() ↔ "firstName".',
    'Jackson needs a no-arg constructor to build the object when reading a response.',
    'ignoreUnknown = true lets the response contain fields (createdAt, customer…) your POJO does not declare.',
  ],
  explanation: `RestAssured hands POJOs to **Jackson**: \`.body(request)\` *serialises* the object to JSON using its getters, and
\`.as(Order.class)\` *deserialises* the response into an object using the no-arg constructor and setters/fields.

Why reviewers like it:
- A renamed field is a compile error in one class, not a silent typo in 14 Maps.
- The same \`OrderRequest\` builds variations for negative tests (\`new OrderRequest("", "Rao", ...)\`).
- \`@JsonIgnoreProperties(ignoreUnknown = true)\` makes tests robust when the backend *adds* fields — adding fields is
  not a breaking change, so it should not break your tests (a schema test covers the contract — see api-015).

Money: 49.99 + 3 × 9.99 = 79.96, tax 8 % = 6.3968 → 6.40, total 86.36. Doubles need a delta; in production code
\`BigDecimal\` is the safer type for money.`,
  mistakes: [
    'No no-arg constructor on the response POJO — Jackson throws "cannot construct instance".',
    'Private fields without getters — Jackson cannot see them and sends {}.',
    'Deserialising before checking the status — a 400 error body becomes an Order full of nulls and a confusing NPE.',
    'Comparing doubles without a delta (assertEquals(86.36, total)) — floating-point rounding makes it flaky.',
  ],
  interview: [
    { q: 'What is serialization and deserialization in API testing?', a: 'Serialization turns a Java object into JSON for the request body; deserialization turns the JSON response into a Java object. RestAssured delegates both to Jackson (or Gson) when it is on the classpath.' },
    { q: 'Why ignore unknown properties?', a: 'So that additive, backward-compatible API changes do not break functional tests. Contract changes are caught deliberately by schema validation or contract tests, not accidentally by every POJO.' },
    { q: 'Would you use Lombok or records for POJOs?', a: 'Often yes in real projects: Lombok @Data/@Builder or Java records remove boilerplate. Jackson supports records since 2.12. The principle is the same — a typed model of the payload.' },
  ],
}
