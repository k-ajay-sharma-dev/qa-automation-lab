export default {
  id: 'int-020',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: RestAssured — log in, add to cart, validate the response',
  level: 'INTERMEDIATE',
  tags: ['restassured', 'api', 'live-coding', 'auth', 'bearer-token', 'hamcrest'],
  estMinutes: 20,
  scenario: `More and more QA automation interviews include an **API live-coding task**, because API tests are where most of a modern suite lives. The interviewer starts the ShopEasy API (\`http://localhost:5181/api\`) and says: *"Write a RestAssured test: log in as standard_user, add two Pulse Bike Lights to the cart and validate the response."* A candidate's existing draft passes on their laptop today and fails tomorrow — it has a **token copied from Postman** pasted into the code.`,
  description: `Fix and complete \`CartApiTest\`:

1. \`@BeforeClass\`: \`RestAssured.baseURI = "http://localhost:5181"\` and \`basePath = "/api"\`.
2. \`@BeforeMethod\`: \`POST /reset\` (fresh seed data), then \`POST /auth/login\` with \`{"username":"standard_user","password":"secret_sauce"}\` → expect **200** and **extract the token** from the response.
3. \`@Test\`: \`POST /cart/items\` with body \`{"productId": 2, "quantity": 2}\` and the token as a **Bearer** token → expect **201** and validate:
   - \`itemCount\` is \`2\`
   - \`items[0].name\` is \`"Pulse Bike Light"\`
   - \`subtotal\` is \`19.98\`
4. Bonus test: adding product 2 again → **409** with \`error.code\` \`"ITEM_ALREADY_IN_CART"\`.

**Rules / Acceptance**
- No hard-coded token — tokens expire and are reset with the server.
- Use the given / when / then style with Hamcrest matchers in \`body(...)\`.
- Send JSON (\`ContentType.JSON\`); a \`Map\` or a POJO body is fine.`,
  hints: [
    'token = given().contentType(ContentType.JSON).body(Map.of("username", "standard_user", "password", "secret_sauce")).when().post("/auth/login").then().statusCode(200).extract().path("token");',
    'given().auth().oauth2(token) sends the header Authorization: Bearer <token>.',
    'RestAssured reads decimal JSON numbers as Float by default: equalTo(19.98f).',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import org.testng.annotations.Test;

public class CartApiTest {

    @Test
    public void addToCart() {
        given()
            .header("Authorization", "Bearer se_1_0001_7374616e6461")
            .contentType("application/json")
            .body("{\"productId\": 2, \"quantity\": 2}")
        .when()
            .post("http://localhost:5181/api/cart/items")
        .then()
            .statusCode(200);
    }
}
`,
  solution: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import java.util.Map;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class CartApiTest {

    private String token;

    @BeforeClass
    public void configure() {
        RestAssured.baseURI = "http://localhost:5181";
        RestAssured.basePath = "/api";
    }

    @BeforeMethod
    public void freshDataAndLogin() {
        given().when().post("/reset").then().statusCode(200);

        token = given()
                .contentType(ContentType.JSON)
                .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when()
                .post("/auth/login")
            .then()
                .statusCode(200)
                .body("tokenType", equalTo("Bearer"))
                .extract().path("token");
    }

    @Test
    public void addingTwoBikeLightsUpdatesTheCart() {
        given()
            .auth().oauth2(token)
            .contentType(ContentType.JSON)
            .body(Map.of("productId", 2, "quantity", 2))
        .when()
            .post("/cart/items")
        .then()
            .statusCode(201)
            .body("itemCount", equalTo(2))
            .body("items[0].name", equalTo("Pulse Bike Light"))
            .body("items[0].quantity", equalTo(2))
            .body("subtotal", equalTo(19.98f));
    }

    @Test
    public void addingTheSameProductTwiceIsAConflict() {
        Map<String, Object> bikeLight = Map.of("productId", 2, "quantity", 1);
        given().auth().oauth2(token).contentType(ContentType.JSON).body(bikeLight)
            .when().post("/cart/items")
            .then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON).body(bikeLight)
            .when().post("/cart/items")
            .then()
            .statusCode(409)
            .body("error.code", equalTo("ITEM_ALREADY_IN_CART"));
    }
}
`,
  checks: [
    { label: 'Configures the base URI once', pattern: '(baseURI\\s*=|setBaseUri\\s*\\(|baseUri\\s*\\()', hint: 'RestAssured.baseURI = "http://localhost:5181"; RestAssured.basePath = "/api";' },
    { label: 'Logs in through POST /auth/login', pattern: 'post\\s*\\(\\s*"[^"]*auth/login"', hint: '.when().post("/auth/login")' },
    { label: 'Extracts the token from the login response', pattern: '(extract\\s*\\(\\s*\\)[\\s\\S]*?path\\s*\\(\\s*"token"\\s*\\)|getString\\s*\\(\\s*"token"\\s*\\))', flags: 'ms', hint: '.then().statusCode(200).extract().path("token")' },
    { label: 'Sends the token as a Bearer token', pattern: '(oauth2\\s*\\(\\s*\\w+\\s*\\)|"Bearer\\s*"\\s*\\+\\s*\\w+)', hint: 'given().auth().oauth2(token) or header("Authorization", "Bearer " + token)' },
    { label: 'Expects 201 Created for the new cart item', pattern: 'statusCode\\s*\\(\\s*201\\s*\\)', hint: 'POST that creates something returns 201, not 200' },
    { label: 'Validates body fields with Hamcrest', pattern: 'body\\s*\\(\\s*"[^"]*(itemCount|items|subtotal)[^"]*"\\s*,\\s*(equalTo|is|hasItem|hasSize)\\s*\\(', hint: '.body("itemCount", equalTo(2))' },
    { label: 'No hard-coded token', pattern: '"(Bearer\\s+)?se_\\d+_', mustNot: true, hint: 'Tokens expire and the server reset drops them — log in in the setup' },
  ],
  explanation: `**What the interviewer listens for**
- **Token flow, not a copied token.** Logging in inside \`@BeforeMethod\` makes the test self-contained: it works after a server restart, on another environment, in CI. \`extract().path("token")\` pulls one value out of the JSON; \`extract().response()\` gives you the whole response if you need several values.
- **Correct status codes.** \`POST /api/cart/items\` *creates* a cart line → **201 Created**. The duplicate add is a **409 Conflict** — the request is valid, but conflicts with the current state.
- **Fresh state.** \`POST /api/reset\` restores the seed data so the cart is empty at the start; otherwise the second run fails with 409. In a shared QA environment you'd instead create your own user (\`POST /api/users\`) or delete the cart (\`DELETE /api/cart\`) — resetting the whole server would break your colleagues' runs.
- **Assertions on the body, not just the status.** \`itemCount\`, the product name and \`subtotal\` prove the business logic: 2 × 9.99 = 19.98.

**The Float gotcha:** RestAssured's JsonPath turns \`19.98\` into a \`Float\` by default, so \`equalTo(19.98)\` (a Double) fails with a confusing "Expected 19.98 but was 19.98". Use \`equalTo(19.98f)\`, or configure \`JsonConfig.jsonConfig().numberReturnType(NumberReturnType.BIG_DECIMAL)\` and compare with \`new BigDecimal("19.98")\` — the professional choice for money.

**Next refactoring step to mention:** a \`RequestSpecification\` built once with \`RequestSpecBuilder\` (base URI, content type, auth, logging on failure) and an \`AuthClient.loginAs(user)\` helper reused by every test class.`,
  mistakes: [
    'Pasting a token from Postman into the test — it works once and fails after the next deployment or reset.',
    'Expecting 200 for every successful call — creation endpoints return 201, deletes often 204.',
    'Asserting only the status code and never the body.',
    'Comparing JSON decimals with a double literal and getting a Float vs Double mismatch.',
  ],
  interview: [
    { q: 'How do you handle authentication in your API tests?', a: 'A login helper calls the auth endpoint once per test or per class with credentials from config or CI secrets, extracts the token and adds it through a RequestSpecification — auth().oauth2(token) for Bearer, auth().preemptive().basic() for Basic, or a header for API keys. Tokens are never hard-coded, and we also test the negative cases: missing token gives 401, someone else\'s resource gives 403.' },
    { q: 'How do you pass a value from one API call to the next?', a: 'Extract it with extract().path("id") or extract().jsonPath().getString(...), store it in a variable or a scenario context, and use it in the next request — for example the order id from the Location header or body of POST /api/orders used in GET /api/orders/{id}.' },
    { q: 'given / when / then in RestAssured — what goes where?', a: 'given holds the request setup: headers, auth, content type, query/path parameters and body. when holds the HTTP method and path. then holds the validations: status code, headers, body matchers, response time, and extract if you need values.' },
  ],
}
