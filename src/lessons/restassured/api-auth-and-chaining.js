export default {
  slug: 'api-auth-and-chaining',
  category: 'restassured',
  order: 5,
  title: 'Auth tokens and chaining requests',
  minutes: 9,
  summary: 'Log in once, send the Bearer token on protected calls, extract ids from one response and feed them into the next request to test a real flow.',
  manualAnalogy: `Manually, a flow is "log in, add a product, check out, then open the order page using the order number from the confirmation". You copy the order number from one screen and paste it into the next. Chaining in RestAssured is the same: extract a value from response A, use it in request B.`,
  body: `## How token auth works

Protected ShopEasy endpoints (cart, orders, profile updates) need a token:

1. \`POST /api/auth/login\` with username and password.
2. The response contains \`{ "token": "se_1_0001_…", "tokenType": "Bearer", "expiresIn": 3600 }\`.
3. Every protected call sends the header \`Authorization: Bearer <token>\`.

No header, or an unknown token → **401 UNAUTHORIZED** (plus a \`WWW-Authenticate: Bearer\` header). A valid token for the wrong user (someone else's order) → **403 FORBIDDEN**.

## Extracting a value

\`extract()\` ends the assertion part and lets you take something out:

\`\`\`java
String token =
    given()
        .contentType(ContentType.JSON)
        .body(Map.of("username", "visual_user", "password", "secret_sauce"))
    .when()
        .post("/api/auth/login")
    .then()
        .statusCode(200)                 // assert BEFORE you extract
        .extract().path("token");
\`\`\`

- \`.extract().path("token")\` returns the value at that GPath (type is inferred: \`String\`, \`Integer\` …).
- \`.extract().response()\` returns the whole \`Response\` if you need several values.
- Always assert the status first: extracting from a 401 body gives you \`null\` and a confusing failure later.

## Sending the token

\`\`\`java
given()
    .header("Authorization", "Bearer " + token)
.when()
    .get("/api/orders")
.then()
    .statusCode(200);
\`\`\`

RestAssured also has \`.auth().oauth2(token)\`, which writes the same Bearer header. (\`.auth().basic(user, pass)\` and \`.auth().preemptive().basic(...)\` exist for Basic-auth APIs; ShopEasy uses tokens.)

### Don't log in in every test

Logging in per request is slow and floods the auth service. Common patterns:

\`\`\`java
public class AuthClient {
    private static final Map<String, String> CACHE = new ConcurrentHashMap<>();

    public static String tokenFor(String user) {
        return CACHE.computeIfAbsent(user, AuthClient::login);
    }
    private static String login(String user) { /* the POST above */ }
}
\`\`\`

\`computeIfAbsent\` logs in the first time and reuses the token afterwards. In a framework the token goes into a request specification (see the *framework design* lesson) so tests never touch headers at all. Remember tokens expire (\`expiresIn\` seconds) and that \`POST /api/reset\` on the practice API wipes them.

## Chaining: create, then read back

The classic API regression check is "what I created is what I get back":

\`\`\`java
int itemCount =
    given().header("Authorization", "Bearer " + token)
           .contentType(ContentType.JSON)
           .body(Map.of("productId", 5, "quantity", 2))
    .when().post("/api/cart/items")
    .then().statusCode(201)
           .extract().path("itemCount");

given().header("Authorization", "Bearer " + token)
.when().get("/api/cart")
.then().statusCode(200)
       .body("itemCount", equalTo(itemCount))
       .body("items.productId", hasItem(5));
\`\`\`

Step 1 creates state and captures a value, step 2 proves the server really stored it. Orders work the same way, with two extra things worth checking: the **201** status and the \`Location\` header (\`/api/orders/1001\`) that points at the new resource — \`.extract().header("Location")\`.

## Negative auth checks belong in every suite

| Case | Expected |
|---|---|
| no Authorization header | 401, \`error.code\` UNAUTHORIZED |
| \`Bearer not-a-real-token\` | 401 |
| locked user logs in | 403 USER_LOCKED, no token in body |
| user B reads user A's order | 403 FORBIDDEN |

The last one is a real security test: many production incidents are "I changed the id in the URL and saw someone else's data". With two logins (standard_user and visual_user) you can automate it in a few lines.

## Keep tests independent

Each chained test should create its own data (its own cart item, its own order) instead of relying on "order 1001 exists because another test ran first". Tests that depend on order break when run alone, in parallel or in a different sequence. Reset or clean up in \`@BeforeMethod\`/\`@AfterMethod\` (the practice API offers \`POST /api/reset\`; real systems usually need a DELETE or a test-data API).`,
  keyPoints: [
    'Login returns a token; protected calls send Authorization: Bearer <token> (or .auth().oauth2(token)).',
    'Assert the status, then .extract().path(...) / .response() / .header(...) to capture values.',
    'Chaining = use a captured id/value in the next request and prove the server stored it.',
    'Cache tokens per user instead of logging in for every request.',
    '401 = missing/invalid token, 403 = valid token but not allowed — test both, including other users\' data.',
  ],
  mistakes: [
    'Extracting before asserting the status — a failed login yields a null token and a misleading NullPointerException.',
    'Forgetting the "Bearer " prefix (with the space) in the header.',
    'Tests that depend on data created by another test — they fail when run alone or in parallel.',
    'Hard-coding a token copied from Postman — it expires and the suite fails next morning.',
  ],
  tryIt: `With the practice API running, log in as standard_user and as visual_user in Postman. Create an order as standard_user (POST /api/orders with firstName, lastName, postalCode and an items array), copy the id from the response or the Location header, then GET it with each user's token. Explain the two different status codes.`,
  problems: ['api-010', 'api-012', 'api-020'],
}
