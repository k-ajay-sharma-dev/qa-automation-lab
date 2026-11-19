export default {
  id: 'api-020',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'EXPERT: end-to-end order journey through the API framework',
  level: 'EXPERT',
  tags: ['end-to-end', 'framework', 'clients', 'security', 'soft-assert'],
  estMinutes: 50,
  scenario: `Release 4.2 of the mobile app goes live on Friday. The release manager wants one API journey test as the go/no-go
gate on staging: a customer fills a basket, an out-of-stock item is refused, the order is priced correctly and can be
read back, the basket is emptied — and **another customer cannot see the order** (the security incident from last
quarter). The current "e2e test" is 120 lines of copy-pasted \`given()\` chains with hard-coded paths, order id 1001 and a
\`Thread.sleep\`. It must be rebuilt on top of the framework's clients.`,
  description: `Use the framework classes from the RestAssured blueprint (package \`com.shopeasy.api\`):

| Class | Methods |
|---|---|
| \`AuthClient\` | \`static String tokenFor(String username, String password)\`, \`static void clearCache()\` |
| \`CartClient(String token)\` | \`Response add(int productId, int quantity)\`, \`Response get()\` |
| \`OrderClient(String token)\` | \`Response place(OrderRequest request)\`, \`Response byId(Object id)\` |
| \`SpecFactory\` | \`static RequestSpecification base()\` — numbers are read as **Double** |
| \`Endpoints\` | \`RESET = "/reset"\`, … |
| \`OrderRequest(firstName, lastName, postalCode)\` | no items → the cart is ordered |
| \`Order\` | \`getId()\`, \`getStatus()\`, \`getItems()\`, \`getSubtotal()\`, \`getTax()\`, \`getTotal()\` |

Write \`OrderJourneyTest\`:

1. \`@BeforeMethod\`: reset the data (\`POST\` \`Endpoints.RESET\` with \`SpecFactory.base()\`) **and** clear the token cache.
2. As \`standard_user\`: add Trailblazer Backpack (1) × 1 and Storm Fleece Jacket (4) × 1 → 201 each. Adding Retro Red Tee
   (6) → **422 OUT_OF_STOCK**, and the cart still has \`itemCount\` 2.
3. Place the order from the cart → 201; deserialise to \`Order\`. With a **SoftAssert** check status \`PLACED\`, 2 items,
   subtotal 79.98, tax 6.40, total 86.38 — then \`assertAll()\`.
4. \`byId(order.getId())\` → 200 with the same total; the cart now has \`itemCount\` 0.
5. As \`visual_user\`: \`byId(order.getId())\` → **403** with \`error.code\` \`"FORBIDDEN"\`.

**Rules**
- No hard-coded paths (\`"/api/..."\`), no hard-coded order id, no \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderJourneyTest {

    @Test
    public void journey() throws InterruptedException {
        String token = given().baseUri("http://localhost:5181").contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().extract().path("token");

        given().baseUri("http://localhost:5181").auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("productId", 1, "quantity", 1))
            .when().post("/api/cart/items").then().statusCode(201);
        // ... 100 more lines like this ...
        given().baseUri("http://localhost:5181").auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001"))
            .when().post("/api/orders").then().statusCode(201);

        Thread.sleep(2000); // wait for the order to be saved

        given().baseUri("http://localhost:5181").auth().oauth2(token)
            .when().get("/api/orders/1001").then().statusCode(200);
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import com.shopeasy.api.clients.AuthClient;
import com.shopeasy.api.clients.CartClient;
import com.shopeasy.api.clients.OrderClient;
import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.models.Order;
import com.shopeasy.api.models.OrderRequest;
import com.shopeasy.api.specs.SpecFactory;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.testng.asserts.SoftAssert;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class OrderJourneyTest {

    private static final String PASSWORD = "secret_sauce";
    private static final int BACKPACK = 1;
    private static final int FLEECE_JACKET = 4;
    private static final int RETRO_RED_TEE = 6; // out of stock in the seed data

    @BeforeMethod
    public void freshData() {
        given().spec(SpecFactory.base()).when().post(Endpoints.RESET).then().statusCode(200);
        AuthClient.clearCache(); // reset invalidates every token on the server
    }

    @Test(description = "Release gate: basket -> order -> read back -> privacy")
    public void customerOrderJourney() {
        String asha = AuthClient.tokenFor("standard_user", PASSWORD);
        CartClient cart = new CartClient(asha);
        OrderClient orders = new OrderClient(asha);

        // 1. basket, including a refused out-of-stock item
        cart.add(BACKPACK, 1).then().statusCode(201);
        cart.add(FLEECE_JACKET, 1).then().statusCode(201);
        cart.add(RETRO_RED_TEE, 1).then()
            .statusCode(422)
            .body("error.code", equalTo("OUT_OF_STOCK"));
        cart.get().then().statusCode(200).body("itemCount", equalTo(2));

        // 2. order from the cart, priced correctly
        Order order = orders.place(new OrderRequest("Asha", "Rao", "560001"))
            .then().statusCode(201)
            .extract().as(Order.class);

        SoftAssert soft = new SoftAssert();
        soft.assertEquals(order.getStatus(), "PLACED", "status");
        soft.assertEquals(order.getItems().size(), 2, "order lines");
        soft.assertEquals(order.getSubtotal(), 79.98, 0.001, "subtotal");
        soft.assertEquals(order.getTax(), 6.40, 0.001, "tax 8%");
        soft.assertEquals(order.getTotal(), 86.38, 0.001, "total");
        soft.assertAll();

        // 3. read back + side effect on the cart
        orders.byId(order.getId()).then()
            .statusCode(200)
            .body("id", equalTo(order.getId()))
            .body("total", equalTo(order.getTotal()));
        cart.get().then().statusCode(200).body("itemCount", equalTo(0));

        // 4. privacy: another customer must not see Asha's order
        String vera = AuthClient.tokenFor("visual_user", PASSWORD);
        new OrderClient(vera).byId(order.getId()).then()
            .statusCode(403)
            .body("error.code", equalTo("FORBIDDEN"));
    }
}
`,
  checks: [
    { label: 'Resets data and clears the token cache', pattern: 'Endpoints\\.RESET[\\s\\S]*AuthClient\\.clearCache\\(\\)|AuthClient\\.clearCache\\(\\)[\\s\\S]*Endpoints\\.RESET', hint: '@BeforeMethod: post(Endpoints.RESET) then AuthClient.clearCache()' },
    { label: 'Uses the client classes', pattern: 'new\\s+CartClient\\([\\s\\S]*new\\s+OrderClient\\(', hint: 'CartClient cart = new CartClient(token); OrderClient orders = new OrderClient(token);' },
    { label: 'Out-of-stock item refused with OUT_OF_STOCK', pattern: 'statusCode\\(\\s*422\\s*\\)[\\s\\S]*"OUT_OF_STOCK"', hint: '.statusCode(422).body("error.code", equalTo("OUT_OF_STOCK"))' },
    { label: 'Deserialises the Order', pattern: '\\.as\\(\\s*Order\\.class\\s*\\)', hint: '.then().statusCode(201).extract().as(Order.class)' },
    { label: 'SoftAssert with assertAll()', pattern: 'new\\s+SoftAssert\\(\\)[\\s\\S]*\\.assertAll\\(\\)', hint: 'SoftAssert soft = new SoftAssert(); ... soft.assertAll();' },
    { label: 'Other customer gets 403 FORBIDDEN', pattern: 'statusCode\\(\\s*403\\s*\\)[\\s\\S]*"FORBIDDEN"', hint: 'new OrderClient(otherToken).byId(order.getId()).then().statusCode(403)' },
    { label: 'No hard-coded paths, order ids or sleeps', pattern: '("/api/|1001|Thread\\.sleep)', mustNot: true, hint: 'Use Endpoints/clients, the extracted id and no sleeps.' },
  ],
  hints: [
    'Clients return the raw Response — call .then() on it to assert, or .as(Order.class) to deserialise.',
    'POST /api/reset drops all tokens, so a cached token from a previous test would get 401.',
    'SoftAssert collects the money checks so one wrong value does not hide the others.',
  ],
  explanation: `This is the shape of a good release-gate journey:

- **Arrange through the API, deterministically**: reset + fresh tokens, so the test runs the same on every
  environment and in any order. Clearing the token cache after a reset is the kind of detail that separates a flaky
  suite from a trusted one.
- **Clients and constants** keep the test at the level of the business story; paths and specs live in one place.
- **Negative checks inside the journey** (out-of-stock refusal, other customer gets 403) cover the risks the release
  manager actually cares about — including the previous security incident.
- **SoftAssert** for the pricing block reports subtotal, tax and total together; hard assertions are kept for
  preconditions (status codes) where continuing makes no sense.
- **No sleeps**: the API is synchronous — the 201 means the order exists. If an API were asynchronous you would poll
  with a timeout (Awaitility), never sleep a fixed time.

Money: 29.99 + 49.99 = 79.98, tax 6.3984 → 6.40, total 86.38. The spec reads numbers as Double, so
\`equalTo(order.getTotal())\` compares like with like.`,
  mistakes: [
    'Reusing cached tokens after POST /api/reset — every call returns 401.',
    'Soft-asserting status codes — the test continues with a null order and fails with an NPE far away.',
    'Forgetting soft.assertAll() — soft failures are silently ignored and the test passes.',
    'One journey test as the only API coverage — keep focused tests for each rule; the journey is a gate, not a suite.',
  ],
  interview: [
    { q: 'How do you design an end-to-end API test without making it flaky?', a: 'Own the data (reset or create per test, extract generated ids), use framework clients and config, no sleeps (poll with a timeout for async work), assert preconditions hard and grouped values softly, and attach request/response evidence on failure.' },
    { q: 'Hard vs soft assertions — when do you use each?', a: 'Hard assertions for preconditions where continuing is pointless (status 201 before deserialising). Soft assertions for a group of independent checks on the same result (subtotal, tax, total) so one run reports every mismatch.' },
    { q: 'How would you test that users cannot read each other\'s data?', a: 'Create the resource as user A, then request it as user B (and anonymously) and expect 403/404 and no data leakage in the body — for every endpoint that takes an id (orders, carts, profiles). This is the classic IDOR / broken object-level authorization check.' },
  ],
}
