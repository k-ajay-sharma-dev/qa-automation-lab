export default {
  id: 'fw-029',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'timeOut, invocationCount and threadPoolSize: fail fast and reproduce flakiness',
  level: 'INTERMEDIATE',
  tags: ['testng', 'timeout', 'invocationcount', 'threadpoolsize', 'flaky-tests', 'restassured'],
  estMinutes: 15,
  scenario: `Two problems from last week's ShopEasy runs. First, the QA environment hung and the smoke job sat for
45 minutes before Jenkins killed it — nobody knew which test was stuck. Second, a developer says
*"GET /api/products sometimes returns 500 under load, but I can never reproduce it"*. Someone wrote a \`for\` loop with
\`Thread.sleep\` to hammer the endpoint; it runs sequentially and reports one result for 20 calls.`,
  description: `Rewrite \`ApiStabilityTest\` (API at \`http://localhost:5181\`) using TestNG attributes instead of hand-made loops.

**Rules**
- \`healthIsUp\`: GET \`/api/health\` must return 200 with \`status\` = \`UP\` and **fail if it takes longer than 3 seconds** (\`timeOut\`).
- \`productListIsStable\`: GET \`/api/products\` returns 200, executed **20 times** (\`invocationCount\`) on **5 threads** (\`threadPoolSize\`), each call limited by \`timeOut\`.
- \`slowEndpointIsCaughtByTimeout\`: call \`/api/slow?ms=2000\` with a \`timeOut\` of 1000 and mark it \`enabled = false\` with a reason in \`description\` (it is a demo of a failing timeout, not part of the suite).
- No \`for\` loops and no \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.tests.api;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class ApiStabilityTest {

    @BeforeClass
    public void setUp() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    @Test
    public void healthIsUp() {
        // TODO: fail if this takes more than 3 seconds
        given().when().get("/api/health").then().statusCode(200);
    }

    @Test
    public void productListIsStable() throws InterruptedException {
        // TODO: replace this loop with TestNG attributes
        for (int i = 0; i < 20; i++) {
            given().when().get("/api/products").then().statusCode(200);
            Thread.sleep(500);
        }
    }
}
`,
  solution: `package com.shopeasy.tests.api;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class ApiStabilityTest {

    @BeforeClass
    public void setUp() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    // Fails with ThreadTimeoutException after 3 s instead of blocking the whole job
    @Test(groups = "smoke", timeOut = 3000)
    public void healthIsUp() {
        given()
        .when()
            .get("/api/health")
        .then()
            .statusCode(200)
            .body("status", equalTo("UP"));
    }

    // 20 invocations spread over 5 threads; each invocation gets its own 5 s limit,
    // and invocationTimeOut caps the whole batch at 30 s
    @Test(invocationCount = 20, threadPoolSize = 5, timeOut = 5000, invocationTimeOut = 30000)
    public void productListIsStable() {
        given()
        .when()
            .get("/api/products")
        .then()
            .statusCode(200);
    }

    @Test(enabled = false, timeOut = 1000,
          description = "Demo only: /api/slow?ms=2000 must exceed the 1 s timeOut and fail")
    public void slowEndpointIsCaughtByTimeout() {
        given()
            .queryParam("ms", 2000)
        .when()
            .get("/api/slow")
        .then()
            .statusCode(200);
    }
}
`,
  checks: [
    { label: 'Health check has a timeOut', pattern: '@Test\\s*\\([^)]*timeOut\\s*=\\s*\\d+[^)]*\\)\\s*public\\s+void\\s+healthIsUp', hint: '@Test(timeOut = 3000) public void healthIsUp()' },
    { label: 'Repeated with invocationCount', pattern: 'invocationCount\\s*=\\s*20', hint: '@Test(invocationCount = 20, ...)' },
    { label: 'Runs concurrently with threadPoolSize', pattern: 'threadPoolSize\\s*=\\s*\\d+', hint: 'threadPoolSize = 5 runs the invocations on 5 threads' },
    { label: 'Health body is verified', pattern: 'body\\s*\\(\\s*"status"\\s*,\\s*equalTo\\s*\\(\\s*"UP"\\s*\\)', hint: '.body("status", equalTo("UP"))' },
    { label: 'Demo test disabled with a description', pattern: '@Test\\s*\\([^)]*enabled\\s*=\\s*false[^)]*description\\s*=|@Test\\s*\\([^)]*description\\s*=[^)]*enabled\\s*=\\s*false', hint: '@Test(enabled = false, timeOut = 1000, description = "...")' },
    { label: 'No hand-made loop', pattern: 'for\\s*\\(\\s*int', mustNot: true, hint: 'Let invocationCount do the repetition' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Sleeping only slows the run' },
  ],
  hints: [
    'timeOut is in milliseconds and goes inside @Test(...).',
    'invocationCount repeats a method; threadPoolSize runs those repetitions in parallel.',
    'invocationTimeOut limits the total time of all invocations; timeOut limits each one.',
  ],
  explanation: `**What each attribute does**

| Attribute | Meaning |
|---|---|
| \`timeOut = 3000\` | each invocation fails with \`ThreadTimeoutException\` after 3 s |
| \`invocationCount = 20\` | the method runs 20 times; the report shows 20 results, so "3 of 20 failed" is visible |
| \`threadPoolSize = 5\` | those 20 invocations run on 5 threads — realistic concurrency that a sequential loop never creates |
| \`invocationTimeOut = 30000\` | the whole batch of invocations must finish in 30 s (only meaningful with invocationCount > 1) |
| \`enabled = false\` | the test is not run; \`description\` tells the next reader why |

The hung-environment problem: with \`timeOut\` the stuck test fails in seconds with its own name in the report,
instead of Jenkins killing an anonymous build after 45 minutes. Set the timeOut generously (2–3x the normal time),
otherwise you create new flakiness.

The loop version had three bugs: one pass/fail for 20 calls, no concurrency, and 10 s of sleeping. TestNG gives
you per-call results for free. Note: \`invocationCount\` + \`threadPoolSize\` is a **reproduction** tool, not a load test —
use JMeter/Gatling/k6 for real performance testing.

A RestAssured alternative for the time limit is \`.time(lessThan(3000L))\` — that asserts response time, while
\`timeOut\` protects the suite from a test that never returns at all.`,
  mistakes: [
    'Setting timeOut too tight (e.g. 500 ms) so slow-but-fine CI agents fail randomly.',
    'Leaving invocationCount = 20 on a UI test in the regular regression suite and multiplying run time.',
    'Using threadPoolSize on a test that shares a non-ThreadLocal WebDriver — threads fight over one browser.',
    'Disabling a test with enabled = false and no description, so nobody knows if it can be re-enabled.',
  ],
  interview: [
    { q: 'How do you stop a hung test from blocking your CI pipeline?', a: 'Put timeOut on the test (or on the <test>/<suite> in testng.xml) so TestNG fails that test with a ThreadTimeoutException, plus a pipeline-level timeout as a last safety net. The report then names the stuck test.' },
    { q: 'What is the difference between timeOut and invocationTimeOut?', a: 'timeOut limits each single invocation. invocationTimeOut limits the total time for all invocations when invocationCount is greater than 1.' },
    { q: 'How would you try to reproduce an intermittent API failure?', a: 'Run the same check many times concurrently with invocationCount and threadPoolSize, log request/response for failures, and look for a pattern (only under concurrency, only after N calls). Then hand the developer the exact request and timing.' },
  ],
}
