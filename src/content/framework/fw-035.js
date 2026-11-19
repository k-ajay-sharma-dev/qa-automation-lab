export default {
  id: 'fw-035',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'ITestContext: log in once per <test> and share the token',
  level: 'INTERMEDIATE',
  tags: ['testng', 'itestcontext', 'api-setup', 'test-data', 'parallel'],
  estMinutes: 20,
  scenario: `The ShopEasy cart and order tests each call \`POST /api/auth/login\` in their own \`@BeforeMethod\`: 180 logins per
run, and the auth service rate-limits the QA environment. A colleague "fixed" it with a \`public static String token\`
— then parallel runs with two users started placing orders for the wrong customer. You want one login per \`<test>\`
block in testng.xml, shared safely through TestNG's \`ITestContext\`.`,
  description: `Complete \`BaseApiTest\` and a test that uses it.

**Rules**
- In \`@BeforeTest\` accept an \`ITestContext\` parameter, log in via \`POST /api/auth/login\` (user from the \`username\` parameter, default \`standard_user\`) and store the token with \`context.setAttribute("token", ...)\`.
- No \`static\` token field.
- The test method takes \`ITestContext\` and reads the token with \`getAttribute("token")\`, then calls \`GET /api/cart\` with a Bearer header and asserts status 200.
- The password comes from an environment variable, not from code.`,
  starterCode: `package com.shopeasy.api;

import io.restassured.RestAssured;
import org.testng.annotations.*;

public class BaseApiTest {

    public static String token; // TODO: shared across ALL threads and <test> blocks

    @BeforeMethod
    public void login() {
        // TODO: logs in before every single test
        token = RestAssured.given().baseUri("http://localhost:5181")
                .contentType("application/json")
                .body("{\\"username\\":\\"standard_user\\",\\"password\\":\\"secret_sauce\\"}")
                .post("/api/auth/login").path("token");
    }
}

class CartApiTest extends BaseApiTest {
    @Test
    public void emptyCartIsReturned() {
        // TODO: read the token and call GET /api/cart
    }
}
`,
  solution: `package com.shopeasy.api;

import static io.restassured.RestAssured.given;

import java.util.Map;
import org.testng.ITestContext;
import org.testng.annotations.BeforeTest;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

public class BaseApiTest {

    protected static final String BASE_URI = System.getProperty("apiUrl", "http://localhost:5181");

    @BeforeTest
    @Parameters("username")
    public void loginOncePerTestBlock(@Optional("standard_user") String username, ITestContext context) {
        String password = System.getenv("SHOPEASY_PASSWORD");
        String token = given().baseUri(BASE_URI)
                .contentType("application/json")
                .body(Map.of("username", username, "password", password))
                .when().post("/api/auth/login")
                .then().statusCode(200)
                .extract().path("token");
        context.setAttribute("token", token);
    }

    protected String token(ITestContext context) {
        return (String) context.getAttribute("token");
    }
}

class CartApiTest extends BaseApiTest {

    @Test
    public void cartIsReturnedForLoggedInUser(ITestContext context) {
        given().baseUri(BASE_URI)
                .header("Authorization", "Bearer " + token(context))
                .when().get("/api/cart")
                .then().statusCode(200);
    }
}
`,
  checks: [
    { label: 'Logs in once per <test> with @BeforeTest', pattern: '@BeforeTest', hint: 'Use @BeforeTest instead of @BeforeMethod' },
    { label: 'Stores the token in ITestContext', pattern: '\\.setAttribute\\s*\\(\\s*"token"', hint: 'context.setAttribute("token", token)' },
    { label: 'Reads the token from ITestContext', pattern: '\\.getAttribute\\s*\\(\\s*"token"\\s*\\)', hint: '(String) context.getAttribute("token")' },
    { label: 'No static token field', pattern: 'static\\s+String\\s+token\\b', mustNot: true, hint: 'A static field is shared by every thread and every <test> block' },
    { label: 'Password from an environment variable', pattern: 'System\\.getenv\\s*\\(', hint: 'System.getenv("SHOPEASY_PASSWORD")' },
    { label: 'Calls GET /api/cart with a Bearer token', pattern: '"Bearer\\s*"[\\s\\S]*?get\\s*\\(\\s*"/api/cart"', hint: '.header("Authorization", "Bearer " + token).get("/api/cart")' },
  ],
  hints: [
    'TestNG injects ITestContext into @BeforeTest and @Test methods when you add it as a parameter.',
    'One ITestContext exists per <test> block in testng.xml, so two blocks with different users get different tokens.',
    'Combine @Parameters("username") with @Optional("standard_user") so the class still runs from the IDE.',
  ],
  explanation: `\`ITestContext\` represents one \`<test>\` block of the suite. Attributes you set in \`@BeforeTest\` are visible to
every test method in that block, and a second \`<test>\` block (say, \`visual_user\` on Firefox) gets its own context
— exactly the isolation the static field broke.

Good uses: an auth token, a base URL, a created test-data id that a whole block needs. Bad use: passing results from
one test to the next ("test 1 creates the order, test 2 reads its id") — that creates hidden dependencies; each test
should still create the data it verifies.

Scope reminder: \`ITestContext\` is per \`<test>\`; \`context.getSuite().setAttribute(...)\` is per suite. Within a
\`<test>\` running \`parallel="methods"\`, the token is read-only shared data, which is safe.`,
  mistakes: [
    'Using a static field and getting cross-user data in parallel runs.',
    'Logging in before every test and hitting rate limits or slowing the suite.',
    'Using ITestContext to chain tests (test B depends on the order id test A created).',
    'Hard-coding the password next to the login call.',
  ],
  interview: [
    { q: 'What is ITestContext in TestNG?', a: 'An object TestNG creates per <test> block holding its configuration and results. You can inject it into configuration and test methods and use setAttribute/getAttribute to share data within that block.' },
    { q: 'Why not share the token in a static variable?', a: 'Static fields are shared across all threads and <test> blocks. In parallel runs with different users one block overwrites another\'s token, causing wrong-user data and random failures. ITestContext (or ThreadLocal for per-thread data) scopes it correctly.' },
    { q: 'ITestContext vs ThreadLocal — when which?', a: 'ITestContext for data shared by a whole <test> block (read-mostly, like a token or config). ThreadLocal for per-thread mutable objects such as the WebDriver in parallel UI runs.' },
  ],
}
