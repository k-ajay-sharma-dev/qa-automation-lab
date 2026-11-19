export default {
  id: 'api-032',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'EXPERT: parallel-safe API tests — every test owns its customer',
  level: 'EXPERT',
  tags: ['parallel', 'test-isolation', 'threadlocal', 'test-data', 'testng'],
  estMinutes: 50,
  scenario: `The API regression takes 25 minutes, so the team switched TestNG to \`parallel="methods" thread-count="4"\`. It now
takes 7 minutes — and 15% of runs fail at random. The investigation found three causes: every test uses
\`standard_user\`, so parallel cart tests see each other's items; \`@BeforeMethod\` calls \`POST /api/reset\`, which wipes the
carts **and tokens** of tests running on other threads; and the token lives in a \`static\` field that the threads
overwrite. The release manager wants the parallel run kept *and* trustworthy. The API now has a registration endpoint
(\`POST /api/users\`) so tests can create their own customers.`,
  description: `Rewrite \`CartParallelTest\` so it is safe under \`parallel="methods"\`:

\`\`\`xml
<suite name="api-regression" parallel="methods" thread-count="4"> ... </suite>
\`\`\`

\`POST /api/users\` body \`{ username, password, firstName, lastName, email }\` → 201 (username: 3–40 of \`a-z 0-9 _ . -\`,
password ≥ 8 characters; a duplicate username → 409). A registered user logs in with **their own** password.

1. A shared, read-only \`RequestSpecification\` built with \`RequestSpecBuilder\` (base URI \`http://localhost:5181\`, base path
   \`/api\`, JSON) — **no** \`RestAssured.baseURI = ...\` assignments.
2. \`@BeforeSuite\` may reset the data **once** (no test is running yet). No reset anywhere else.
3. \`@BeforeMethod\`: register a **unique** customer (e.g. \`"it_" + UUID\`), log in as them and keep the token in a
   \`ThreadLocal<String>\`. \`@AfterMethod\`: \`remove()\` it.
4. Tests, each using only its own customer's token:
   - **addingTwoBackpacks** — add product 1 × 2 → 201, \`itemCount\` 2, \`subtotal\` 59.98.
   - **duplicateAddConflicts** — add product 2, add it again → 409 \`ITEM_ALREADY_IN_CART\`.
   - **orderEmptiesOnlyMyCart** — add product 5 × 2, order the cart (\`firstName/lastName/postalCode\`) → 201 with \`total\`
     17.26, then the cart has \`itemCount\` 0.

**Rules**
- No \`standard_user\`, no \`static String token\`, no per-test reset.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartParallelTest {

    private static String token;   // shared by all threads...

    @BeforeClass
    public void config() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    @BeforeMethod
    public void setUp() {
        given().when().post("/api/reset").then().statusCode(200);   // wipes other threads' carts and tokens
        token = given().contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void addingTwoBackpacks() {
        given().auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("productId", 1, "quantity", 2))
        .when().post("/api/cart/items")
        .then().statusCode(201).body("itemCount", equalTo(2));
    }

    // TODO: duplicateAddConflicts, orderEmptiesOnlyMyCart — and make the class parallel-safe
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.Test;

import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class CartParallelTest {

    /** Built once, never modified: safe to share between threads. */
    private static final RequestSpecification BASE = new RequestSpecBuilder()
        .setBaseUri("http://localhost:5181")
        .setBasePath("/api")
        .setContentType(ContentType.JSON)
        .build();

    private static final String PASSWORD = "Parallel-Pass-1";

    /** One token per test thread. */
    private final ThreadLocal<String> token = new ThreadLocal<>();

    @BeforeSuite
    public void resetOnceBeforeAnythingRuns() {
        given().spec(BASE).when().post("/reset").then().statusCode(200);
    }

    @BeforeMethod
    public void registerFreshCustomer() {
        String username = "it_" + UUID.randomUUID().toString().substring(0, 8);

        given().spec(BASE)
            .body(Map.of(
                "username", username,
                "password", PASSWORD,
                "firstName", "Parallel",
                "lastName", "Tester",
                "email", username + "@shopeasy.test"))
        .when()
            .post("/users")
        .then()
            .statusCode(201);

        String newToken = given().spec(BASE)
            .body(Map.of("username", username, "password", PASSWORD))
        .when()
            .post("/auth/login")
        .then()
            .statusCode(200)
            .extract().path("token");
        token.set(newToken);
    }

    @AfterMethod(alwaysRun = true)
    public void forgetToken() {
        token.remove();
    }

    private RequestSpecification asMyCustomer() {
        return given().spec(BASE).auth().oauth2(token.get());
    }

    @Test
    public void addingTwoBackpacks() {
        asMyCustomer()
            .body(Map.of("productId", 1, "quantity", 2))
        .when()
            .post("/cart/items")
        .then()
            .statusCode(201)
            .body("itemCount", equalTo(2))
            .body("subtotal", equalTo(59.98f));
    }

    @Test
    public void duplicateAddConflicts() {
        asMyCustomer().body(Map.of("productId", 2)).when().post("/cart/items").then().statusCode(201);

        asMyCustomer()
            .body(Map.of("productId", 2))
        .when()
            .post("/cart/items")
        .then()
            .statusCode(409)
            .body("error.code", equalTo("ITEM_ALREADY_IN_CART"));
    }

    @Test
    public void orderEmptiesOnlyMyCart() {
        asMyCustomer().body(Map.of("productId", 5, "quantity", 2)).when().post("/cart/items").then().statusCode(201);

        asMyCustomer()
            .body(Map.of("firstName", "Parallel", "lastName", "Tester", "postalCode", "560001"))
        .when()
            .post("/orders")
        .then()
            .statusCode(201)
            .body("total", equalTo(17.26f));

        asMyCustomer()
        .when()
            .get("/cart")
        .then()
            .statusCode(200)
            .body("itemCount", equalTo(0));
    }
}
`,
  checks: [
    { label: 'Token kept in a ThreadLocal', pattern: 'ThreadLocal<\\s*String\\s*>', hint: 'private final ThreadLocal<String> token = new ThreadLocal<>();' },
    { label: 'Registers a customer through the API', pattern: '\\.post\\(\\s*"(/api)?/users"\\s*\\)', hint: 'given().spec(BASE).body(registration).when().post("/users")' },
    { label: 'Usernames are unique per test', pattern: '(UUID\\.randomUUID\\(\\)|nanoTime\\(\\)|currentTimeMillis\\(\\)|AtomicInteger)', hint: '"it_" + UUID.randomUUID().toString().substring(0, 8)' },
    { label: 'Clears the ThreadLocal after each test', pattern: '\\.remove\\(\\)', hint: '@AfterMethod(alwaysRun = true) public void forgetToken() { token.remove(); }' },
    { label: 'Shared spec built with RequestSpecBuilder', pattern: 'new\\s+RequestSpecBuilder\\(\\)', hint: 'private static final RequestSpecification BASE = new RequestSpecBuilder()...build();' },
    { label: 'No per-test reset', pattern: '@BeforeMethod[^{]*\\{[^}]*"(/api)?/reset"', mustNot: true, hint: 'A reset during the run wipes other threads\' carts and tokens; reset once in @BeforeSuite.' },
    { label: 'No shared user, static token or global baseURI', pattern: '("standard_user"|static\\s+String\\s+token|RestAssured\\.baseURI\\s*=)', mustNot: true, hint: 'Each test registers its own customer; config lives in the spec.' },
  ],
  hints: [
    'Three kinds of shared state break parallel runs: shared data (one user/cart), shared actions (reset) and shared variables (static fields).',
    'ThreadLocal gives every thread its own copy of a variable: token.set(...) in @BeforeMethod, token.get() in the test, token.remove() afterwards.',
    'A unique username per test (UUID) means two threads can never collide on the same cart.',
  ],
  explanation: `Parallel tests fail for the same reason two manual testers sharing one test account get confused: they change
each other's data. The fix is **isolation** at three levels:

| Shared thing | Problem in parallel | Fix |
|---|---|---|
| data — one \`standard_user\` cart | threads add to and order each other's cart | a fresh customer per test via \`POST /api/users\` |
| actions — \`POST /api/reset\` per test | wipes carts and tokens of tests mid-flight | reset once in \`@BeforeSuite\`, then never |
| variables — \`static String token\` | last writer wins, tests use another thread's token | \`ThreadLocal<String>\`, or locals |
| config — \`RestAssured.baseURI = ...\` | global, mutable | an immutable \`RequestSpecification\` built once |

**ThreadLocal**: with \`parallel="methods"\` TestNG runs \`@BeforeMethod\`, the test and \`@AfterMethod\` on the same thread,
so a value set in \`@BeforeMethod\` is visible to *that* test only. \`remove()\` in \`@AfterMethod(alwaysRun = true)\` matters
because threads are pooled and reused — a stale token would leak into the next test on that thread.

The unique customer also makes every test **order-independent and re-runnable** on a shared environment, without a
reset at all. That is how real suites work against staging, where you can't wipe the database: create what you need,
use generated ids and names, and leave other people's data alone. (Registered users here disappear on the next reset;
on a real system you would add a clean-up call or a periodic purge of \`it_*\` accounts.)`,
  mistakes: [
    'Resetting or truncating data before each test in a parallel run — other threads lose their data mid-test.',
    'Static fields for per-test state (token, response, ids) — threads overwrite each other.',
    'Forgetting ThreadLocal.remove() — pooled threads carry stale values into the next test.',
    'Unique data based on a counter in a static int without synchronisation — two threads can get the same "unique" name; use UUID or AtomicInteger.',
  ],
  interview: [
    { q: 'How do you make API tests safe to run in parallel?', a: 'Each test owns its data (creates its own user, cart, order with unique values), no global resets during the run, no static mutable state (ThreadLocal or locals instead), immutable shared specs, and no dependencies between tests. Then increase thread count and watch for remaining shared resources such as rate limits.' },
    { q: 'What is ThreadLocal and when have you used it in test automation?', a: 'ThreadLocal gives each thread its own value of a variable. In UI frameworks it holds the WebDriver per thread; in API tests the token or scenario data per thread when tests run in parallel. Always remove() after the test because thread pools reuse threads.' },
    { q: 'How do you handle test data on a shared environment where you cannot reset the database?', a: 'Create data through APIs with unique, recognisable names (prefix plus UUID), never rely on existing records except stable reference data, clean up what you created in teardown, and have a periodic job that purges leftover test records by prefix.' },
  ],
}
