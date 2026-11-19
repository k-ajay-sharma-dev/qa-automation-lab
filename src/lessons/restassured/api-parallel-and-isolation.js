export default {
  slug: 'api-parallel-and-isolation',
  category: 'restassured',
  order: 11,
  title: 'Running API tests in parallel: isolation, own data and ThreadLocal',
  minutes: 8,
  summary: 'Find the shared state that makes parallel API runs flaky, and remove it with per-test data, a single up-front reset, immutable specs and ThreadLocal for per-test values.',
  manualAnalogy: `Picture four manual testers sharing one test account during a regression day. One adds items to the cart while another checks out; a third "resets the environment" in the middle of everyone's work. Each of them reports bugs that are not bugs. Parallel automated tests have exactly this problem — and the fix is the same: everyone gets their own account and nobody wipes shared data mid-run.`,
  body: `## Why parallel runs go flaky

TestNG can run test methods on several threads at once:

\`\`\`xml
<suite name="api-regression" parallel="methods" thread-count="4">
  <test name="cart"> <classes> <class name="com.shopeasy.api.tests.CartTest"/> </classes> </test>
</suite>
\`\`\`

Tests that passed one by one now fail at random. Look for **shared state** in four places:

| Shared | Example | What goes wrong |
|---|---|---|
| test data | every test logs in as the same customer | tests see and change each other's cart |
| actions | \`POST /api/reset\` in \`@BeforeMethod\` | wipes carts, tokens and users of tests still running |
| variables | \`private static String token\` | the last thread to write wins |
| global config | \`RestAssured.baseURI = ...\` inside tests | one test's change affects all threads |

## Fix 1: each test owns its data

Create what the test needs through the API, with values nobody else will use:

\`\`\`java
String email = "it_" + UUID.randomUUID().toString().substring(0, 8) + "@shopeasy.test";
\`\`\`

The practice API offers \`POST /api/users\` (username, password, firstName, lastName, email → 201), so each test can register its **own customer** with its own cart and orders. A UUID-based name cannot collide between threads; a plain \`static int counter++\` can, unless it is an \`AtomicInteger\`.

## Fix 2: reset once, before anything runs

If the environment needs a clean start, do it in \`@BeforeSuite\` — at that moment no test is running yet. A reset during the run is a grenade thrown into other threads' work. On shared environments (staging) you usually can't reset at all, which is one more reason to create your own data.

## Fix 3: no static per-test state — use ThreadLocal

A field that holds one test's value (token, response, created id) must not be \`static\`. When a value must travel from \`@BeforeMethod\` to the test, keep it in a **ThreadLocal**: every thread sees its own copy.

\`\`\`java
private final ThreadLocal<Integer> orderId = new ThreadLocal<>();

@Test
public void placeOrder() { orderId.set(/* id extracted from the 201 response */); }

@AfterMethod(alwaysRun = true)
public void cleanUp() { orderId.remove(); }
\`\`\`

With \`parallel="methods"\`, TestNG runs \`@BeforeMethod\`, the test and \`@AfterMethod\` on the same thread, so \`set\` and \`get\` meet. Call \`remove()\` afterwards: threads come from a pool and are reused, and a leftover value would leak into the next test. (Cucumber users get the same isolation from PicoContainer's per-scenario \`ScenarioContext\`.)

## Fix 4: immutable shared configuration

Build one \`RequestSpecification\` with \`RequestSpecBuilder\` at start-up and only *read* it (\`given().spec(BASE)\`). \`given().spec(...)\` copies the spec into a new request, so threads never change the shared one. Never assign \`RestAssured.baseURI\`, \`RestAssured.config\` and friends inside tests.

## A quick isolation checklist

- Does the test pass when run **alone**, **twice in a row**, and in **reverse order**?
- Does it create its own user/cart/order, or does it rely on seed data that others modify?
- Is there any \`static\` field that is written during a test?
- Is anything deleted or reset that other tests might be using?

Read-only reference data (the product catalogue) can safely be shared — only data that tests *change* needs to be owned.`,
  keyPoints: [
    'Parallel flakiness comes from shared state: shared data, shared actions (resets), static variables, global config.',
    'Each test creates its own data with unique values (UUID), e.g. its own customer via POST /api/users.',
    'Reset at most once in @BeforeSuite; never during the run.',
    'Per-test values live in locals or ThreadLocal (set → get → remove), never in static fields.',
    'Shared specs are built once and only read; never mutate RestAssured static settings in tests.',
  ],
  mistakes: [
    'Turning on parallel="methods" without checking for static fields and shared users first.',
    'Calling POST /api/reset in @BeforeMethod, which wipes the data of tests running on other threads.',
    'Forgetting ThreadLocal.remove(), so a pooled thread carries a stale token into the next test.',
    'Generating "unique" names from the current second — two threads in the same second collide.',
  ],
  tryIt: `With \`npm run api\` running, register two customers in Postman with POST http://localhost:5181/api/users (username, password of 8+ characters, firstName, lastName, email). Log in as each, add a different product to each cart, and confirm with GET /api/cart that the carts are independent. Then call POST /api/reset and try both tokens again — note what happens and why a reset in the middle of a parallel run is dangerous.`,
  problems: ['api-032', 'api-044'],
}
