export default {
  slug: 'restassured-deep-advanced-api-testing',
  category: 'restassured',
  order: 16,
  title: 'Deep dive: advanced API testing — mocking with WireMock, contract testing with Pact, async APIs, GraphQL and performance smoke checks',
  minutes: 34,
  summary: 'Go beyond request–response checks: virtualise dependencies with WireMock 3 (stubs, matchers, templating, delays, faults, scenarios, the request journal, record and playback), prove compatibility with Pact consumer tests and provider verification behind can-i-deploy, test 202-and-poll APIs, webhooks and queues with Awaitility instead of sleeps, call GraphQL from REST Assured without falling for the always-200 trap, keep performance checks honest (timeouts and smoke in the functional suite, Gatling or k6 for load), and test idempotency, pagination invariants and backward compatibility like a senior.',
  manualAnalogy: `When the payment provider's sandbox was down, a good manual tester did not stop testing checkout — they asked a developer for a switch that made "payment" answer approved, declined or "hang for a minute", and tested every branch. When two teams argued whether a field was renamed, they compared the agreed sample responses, not opinions. This lesson turns those habits into code: fake dependencies on demand, written-down agreements both sides verify, and patience that is measured rather than guessed.`,
  body: `## Where the earlier lessons stop

The beginner lessons taught request–response tests against a server that is always there and always answers immediately: \`api-contract-and-data-driven\` introduced JSON Schema and data-driven tests, \`api-parallel-and-isolation\` made tests own their data. The REST Assured deep dives went deeper on one axis each — filters, configuration and HTTP semantics in \`restassured-deep-internals-http\`; GPath, JSON comparison and schema validation in \`restassured-deep-assertions-json-contracts\`; tokens, JWTs and OWASP checks in \`restassured-deep-auth-security-testing\`; clients (\`AuthClient\`, \`ProductsClient\`, \`CartClient\`, \`OrdersClient\`, \`UsersClient\`), \`ApiConfig\`, \`SpecFactory\`, Allure and the TestNG base class in \`restassured-deep-api-framework-architecture\`. Playwright's \`request\` fixture and \`page.route()\` mocking are covered in \`pw-deep-api-testing\`.

This lesson is about what makes real systems hard to test:

* the API you test **depends on other services** you do not control (payment, tax, shipping, identity);
* two teams change their sides independently and need proof they are still **compatible**;
* work happens **later** — 202 Accepted, webhooks, queues, eventual consistency;
* the API is not REST at all — **GraphQL**;
* "is it fast enough" questions that a functional suite answers badly.

Facts about ShopEasy (port 5181) come from \`scripts/api-server.mjs\`. ShopEasy has **no** payment gateway, async jobs, webhooks, GraphQL, idempotency keys or API versions — every example that needs those is labelled **typical real app**. What ShopEasy does have and this lesson uses: \`GET /api/health\` (\`{ status: "UP", service: "shopeasy-api", version: "1.0.0" }\`), \`GET /api/products\` with \`q\`, \`sort\`, \`page\`, \`size\`, \`GET /api/products/{id}\` (404 \`PRODUCT_NOT_FOUND\`), \`GET /api/schema/product\`, \`POST /api/orders\` (201 + \`Location\`), \`POST /api/reset\`, \`GET /api/slow?ms=…\` (0–10000) and an \`X-Request-Id\` header (\`req-00001\`, \`req-00002\`, …) on every response.

## 1. Service virtualisation with WireMock 3

### What it is and why it is needed

Service virtualisation replaces a real HTTP dependency with a programmable fake that speaks the same protocol. Seniors use it for four reasons:

| Reason | Example in a typical e-commerce project |
|---|---|
| The dependency is **unavailable** or costly | the payment provider's sandbox is down every other night, or charges per call |
| You need **error paths** the real service will not produce on demand | gateway returns 500, hangs for 30 s, resets the connection |
| You need **deterministic data** | the tax service must return exactly 8% for the test basket |
| You need to **observe** what your service sent | "did checkout send the idempotency key and the right amount?" |

It does not replace integration tests against the real dependency — it makes everything *except* that thin layer fast and deterministic. The real integration is then checked by a few end-to-end tests and, better, by contract tests (section 2).

### How WireMock works internally

WireMock is an HTTP server (Jetty in WireMock 3) with three in-memory structures:

1. **Stub mappings** — request pattern + response definition. On each request WireMock evaluates the mappings; among the matches the one with the **highest priority** wins, and with equal priority the **most recently added** stub wins. That is why a specific stub added after a catch-all works, and why "my stub is ignored" is usually a newer, broader stub.
2. **The request journal** — every received request is recorded (matched or not). \`verify(...)\`, \`findAll(...)\`, \`findUnmatchedRequests()\` and near-miss reports read it.
3. **Scenario state** — named state machines that let a stub match only in a given state and move the state after responding.

Everything is also exposed over an **admin API** under \`/__admin\` (\`/__admin/mappings\`, \`/__admin/requests\`, \`/__admin/scenarios\`, \`/__admin/reset\`). The Java DSL is a client of the same model: in-process it calls the server object directly; for a standalone or Docker WireMock it sends JSON to the admin API. A response definition can be delayed, templated, or replaced by a **fault** that breaks the TCP connection.

Maven coordinates for WireMock 3 are \`org.wiremock:wiremock\` (test scope), or \`org.wiremock:wiremock-standalone\` when Jetty clashes with your classpath (verified on wiremock.org; 3.13.x was current at the time of writing). WireMock 3 needs Java 11+, so the Java 17 baseline is fine.

### Syntax and important methods

| Purpose | API (static imports from \`com.github.tomakehurst.wiremock.client.WireMock\`) |
|---|---|
| Stub | \`stubFor(post(urlPathEqualTo("/v1/charges")).willReturn(okJson("{...}")))\` |
| URL matching | \`urlEqualTo\` (path + query, exact) · \`urlPathEqualTo\` (path only; add \`withQueryParam\`) · \`urlPathMatching\` / \`urlMatching\` (regex) |
| Header / query | \`withHeader("Idempotency-Key", matching("[0-9a-f-]{36}"))\`, \`withQueryParam("page", equalTo("2"))\` |
| Body | \`withRequestBody(equalToJson(json, ignoreArrayOrder, ignoreExtraElements))\`, \`matchingJsonPath("$.amount", equalTo("82.05"))\`, \`matchingJsonPath("$.items[?(@.quantity > 10)]")\` |
| Response | \`aResponse().withStatus(500).withHeader(...).withBody(...)\`, \`okJson(...)\`, \`serverError()\`, \`notFound()\` |
| Latency | \`withFixedDelay(ms)\`, \`withLogNormalRandomDelay(median, sigma)\`, \`withChunkedDribbleDelay(chunks, totalMs)\`, global \`setGlobalFixedDelay(ms)\` |
| Faults | \`withFault(Fault.CONNECTION_RESET_BY_PEER / EMPTY_RESPONSE / MALFORMED_RESPONSE_CHUNK / RANDOM_DATA_THEN_CLOSE)\` |
| State | \`inScenario("name").whenScenarioStateIs(STARTED).willSetStateTo("next")\`, \`resetAllScenarios()\` |
| Templating | \`withTransformers("response-template")\` per stub, or \`options().globalTemplating(true)\` |
| Verify | \`verify(postRequestedFor(...))\`, \`verify(3, ...)\`, \`verify(exactly(1), ...)\`, \`verify(moreThan(2), ...)\` |
| Journal | \`findAll(postRequestedFor(...))\`, \`getAllServeEvents()\`, \`findUnmatchedRequests()\`, \`findNearMissesForAllUnmatched()\` |

### Complete example: a payment client against a mocked gateway (typical real app)

ShopEasy has no payment step. In a typical real shop, the order service calls a payment gateway after \`POST /api/orders\`. The unit under test is the **payment adapter** inside that service: it must send the amount and an idempotency key, time out quickly, retry 5xx and connection failures (with the **same** key), never retry a 4xx, and map "declined" to a business outcome.

\`\`\`java
package com.shopeasy.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/** Production adapter (typical real app). Retries 5xx and I/O failures with the SAME idempotency key. */
public final class PaymentGatewayClient {

    public enum Outcome { APPROVED, DECLINED }
    public record ChargeResult(Outcome outcome, String reference, String declineReason, int attempts) { }

    public static final class PaymentUnavailableException extends RuntimeException {
        public PaymentUnavailableException(String message, Throwable cause) { super(message, cause); }
    }

    private final HttpClient http;
    private final URI baseUri;
    private final Duration requestTimeout;
    private final int maxAttempts;
    private final ObjectMapper mapper = new ObjectMapper();

    public PaymentGatewayClient(URI baseUri, Duration requestTimeout, int maxAttempts) {
        this.baseUri = baseUri;
        this.requestTimeout = requestTimeout;
        this.maxAttempts = maxAttempts;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    }

    public ChargeResult charge(long orderId, BigDecimal amount, String idempotencyKey) {
        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("/v1/charges"))
                .timeout(requestTimeout)                                   // per-request read timeout
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", idempotencyKey)
                .POST(HttpRequest.BodyPublishers.ofString(json(Map.of(
                        "orderId", orderId, "amount", amount, "currency", "USD"))))
                .build();

        RuntimeException last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                HttpResponse<String> res = http.send(request, HttpResponse.BodyHandlers.ofString());
                int status = res.statusCode();
                if (status == 200) {
                    JsonNode body = mapper.readTree(res.body());
                    return new ChargeResult(Outcome.valueOf(body.get("status").asText()),
                            body.path("reference").asText(null), body.path("reason").asText(null), attempt);
                }
                if (status < 500) {                                         // 4xx: our bug, retrying cannot help
                    throw new IllegalStateException("gateway rejected the request: HTTP " + status + " " + res.body());
                }
                last = new PaymentUnavailableException("gateway HTTP " + status, null);
            } catch (IOException e) {                                       // includes HttpTimeoutException, resets
                last = new PaymentUnavailableException("gateway I/O failure: " + e, e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new PaymentUnavailableException("interrupted", e);
            }
        }
        throw last;
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (IOException e) { throw new IllegalArgumentException(e); }
    }
}
\`\`\`

The tests, with the JUnit 5 extension (\`@WireMockTest\` starts one server per test class on a random port, resets stubs and journal between tests, and points the static DSL at it):

\`\`\`java
package com.shopeasy.payments;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.stubbing.Scenario.STARTED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import com.github.tomakehurst.wiremock.http.Fault;
import com.github.tomakehurst.wiremock.junit5.WireMockRuntimeInfo;
import com.github.tomakehurst.wiremock.junit5.WireMockTest;
import com.github.tomakehurst.wiremock.verification.LoggedRequest;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@WireMockTest
class PaymentGatewayClientTest {

    private static final String CHARGES = "/v1/charges";
    private PaymentGatewayClient client;
    private final String key = UUID.randomUUID().toString();

    @BeforeEach
    void setUp(WireMockRuntimeInfo wm) {
        client = new PaymentGatewayClient(URI.create(wm.getHttpBaseUrl()), Duration.ofMillis(500), 3);
    }

    @Test
    void approvedChargeSendsAmountAndKey() {
        stubFor(post(urlPathEqualTo(CHARGES))
                .withHeader("Idempotency-Key", equalTo(key))
                .withRequestBody(equalToJson("""
                        { "orderId": 1001, "amount": 82.05, "currency": "USD" }"""))
                .willReturn(okJson("""
                        { "status": "APPROVED", "reference": "ch_123" }""")));

        PaymentGatewayClient.ChargeResult result = client.charge(1001, new BigDecimal("82.05"), key);

        assertThat(result.outcome()).isEqualTo(PaymentGatewayClient.Outcome.APPROVED);
        assertThat(result.reference()).isEqualTo("ch_123");
        assertThat(result.attempts()).isEqualTo(1);
        verify(exactly(1), postRequestedFor(urlPathEqualTo(CHARGES)));
    }

    @Test
    void declineIsABusinessOutcomeNotAnError() {
        stubFor(post(urlPathEqualTo(CHARGES))
                .withRequestBody(matchingJsonPath("$.orderId", equalTo("1002")))
                .willReturn(okJson("""
                        { "status": "DECLINED", "reason": "INSUFFICIENT_FUNDS" }""")));

        var result = client.charge(1002, new BigDecimal("15.99"), key);

        assertThat(result.outcome()).isEqualTo(PaymentGatewayClient.Outcome.DECLINED);
        assertThat(result.declineReason()).isEqualTo("INSUFFICIENT_FUNDS");
        verify(1, postRequestedFor(urlPathEqualTo(CHARGES)));      // a decline is never retried
    }

    @Test
    void serverErrorIsRetriedWithTheSameIdempotencyKey() {
        stubFor(post(urlPathEqualTo(CHARGES)).inScenario("flaky gateway")
                .whenScenarioStateIs(STARTED)
                .willReturn(serverError())
                .willSetStateTo("recovered"));
        stubFor(post(urlPathEqualTo(CHARGES)).inScenario("flaky gateway")
                .whenScenarioStateIs("recovered")
                .willReturn(okJson("""
                        { "status": "APPROVED", "reference": "ch_456" }""")));

        var result = client.charge(1003, new BigDecimal("49.99"), key);

        assertThat(result.attempts()).isEqualTo(2);
        assertThat(findAll(postRequestedFor(urlPathEqualTo(CHARGES))))
                .extracting(r -> r.getHeader("Idempotency-Key"))
                .containsExactly(key, key);                             // same key → no double charge
    }

    @Test
    void slowGatewayTimesOutAndGivesUpAfterThreeAttempts() {
        stubFor(post(urlPathEqualTo(CHARGES))
                .willReturn(okJson("{ \\"status\\": \\"APPROVED\\" }").withFixedDelay(2_000)));

        long start = System.nanoTime();
        assertThatThrownBy(() -> client.charge(1004, new BigDecimal("9.99"), key))
                .isInstanceOf(PaymentGatewayClient.PaymentUnavailableException.class)
                .hasMessageContaining("HttpTimeoutException");
        long tookMs = (System.nanoTime() - start) / 1_000_000;

        assertThat(tookMs).isLessThan(2_000 * 3);                      // proves we did NOT wait for the server
        await().atMost(Duration.ofSeconds(3))                          // journal entries of delayed requests
               .untilAsserted(() -> verify(3, postRequestedFor(urlPathEqualTo(CHARGES))));
    }

    @Test
    void connectionResetIsTreatedAsUnavailable() {
        stubFor(post(urlPathEqualTo(CHARGES))
                .willReturn(aResponse().withFault(Fault.CONNECTION_RESET_BY_PEER)));

        assertThatThrownBy(() -> client.charge(1005, new BigDecimal("7.99"), key))
                .isInstanceOf(PaymentGatewayClient.PaymentUnavailableException.class);
    }

    @Test
    void clientErrorIsNeverRetried() {
        stubFor(post(urlPathEqualTo(CHARGES))
                .willReturn(aResponse().withStatus(400).withBody("{\\"error\\":\\"amount must be positive\\"}")));

        assertThatThrownBy(() -> client.charge(1006, new BigDecimal("1.00"), key))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("HTTP 400");
        verify(exactly(1), postRequestedFor(urlPathEqualTo(CHARGES)));
    }
}
\`\`\`

### Step-by-step explanation

1. \`@WireMockTest\` injects \`WireMockRuntimeInfo\`; \`getHttpBaseUrl()\` gives \`http://localhost:<random port>\`, so parallel CI agents never collide on a fixed port.
2. **Approved**: the stub only matches if the header and the JSON body are right. If the client sends the wrong amount, WireMock returns 404 (no match) and the test fails on the outcome — and the **near-miss report** in the log says which part of the request differed. \`equalToJson\` compares semantically (whitespace and key order do not matter).
3. **Declined**: \`matchingJsonPath("$.orderId", equalTo("1002"))\` matches a single field — less brittle than whole-body equality when the body has fields the test does not care about. \`verify(1, …)\` proves a business decline is not retried.
4. **Retry**: a two-state scenario returns 500 first and 200 second. \`findAll\` reads the journal and asserts both attempts carried the same \`Idempotency-Key\` — the property that prevents double charges.
5. **Timeout**: the stub answers after 2 s; the client gives up after 500 ms per attempt. The elapsed-time assertion is an upper bound on **our** behaviour, not a performance SLA. The journal check runs inside Awaitility because the client may finish before every delayed serve event is fully recorded — never fight that with \`Thread.sleep\`.
6. **Fault**: \`CONNECTION_RESET_BY_PEER\` closes the socket with \`SO_LINGER=0\`. WireMock's docs warn that it behaves reliably only on Unix-like systems; on Windows the connection may hang instead — the 500 ms request timeout still makes the test finish, but run fault tests on Linux CI agents. \`EMPTY_RESPONSE\` is a portable alternative.
7. **4xx**: one request, no retry, a different exception type — a 400 is a bug in our request and retrying hides it.

### TestNG lifecycle with \`WireMockServer\`

The rest of the ShopEasy framework uses TestNG (\`restassured-deep-api-framework-architecture\`). Without the JUnit extension you own the lifecycle:

\`\`\`java
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;

import com.github.tomakehurst.wiremock.WireMockServer;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;

public abstract class WireMockTestBase {

    protected WireMockServer gateway;

    @BeforeClass(alwaysRun = true)
    public void startGateway() {
        gateway = new WireMockServer(wireMockConfig().dynamicPort());   // one server per test class
        gateway.start();
    }

    @BeforeMethod(alwaysRun = true)
    public void cleanSlate() {
        gateway.resetAll();                                              // stubs, journal and scenarios
    }

    @AfterClass(alwaysRun = true)
    public void stopGateway() {
        if (gateway != null) gateway.stop();
    }

    protected String gatewayUrl() { return gateway.baseUrl(); }
}
\`\`\`

Use the **instance** methods (\`gateway.stubFor(...)\`, \`gateway.verify(...)\`), not the static DSL — the static DSL talks to one default client (localhost:8080 unless configured), which is wrong as soon as there is more than one server or a random port. With \`parallel="methods"\`, \`resetAll()\` in one thread wipes another thread's stubs: either run WireMock classes with \`parallel="classes"\` (one server per class) or give each test its own URL space (\`/v1/charges\` matched with a per-test \`orderId\`) and drop the per-method reset.

### Response templating, record & playback, standalone

**Templating** makes a stub echo request data — useful when the caller correlates by id:

\`\`\`java
stubFor(post(urlPathEqualTo("/v1/charges"))
        .willReturn(okJson("""
                { "status": "APPROVED",
                  "reference": "{{randomValue type='UUID'}}",
                  "orderId": {{jsonPath request.body '$.orderId'}},
                  "requestId": "{{request.headers.X-Request-Id}}",
                  "processedAt": "{{now}}" }""")
                .withTransformers("response-template")));
\`\`\`

Programmatic (local) WireMock applies templating only to stubs that name the \`response-template\` transformer, unless the server was built with \`options().globalTemplating(true)\`. Keep templates small — a template with business logic is a second implementation of the dependency that nobody tests.

**Record & playback**: \`gateway.startRecording(recordSpec().forTarget("https://sandbox.gateway.example").build())\`, exercise the flow, then \`gateway.stopRecording()\` writes one mapping per distinct request. Use it to bootstrap stubs from a real sandbox, then **edit** them: remove volatile headers, replace exact bodies with \`matchingJsonPath\`, add error cases the recording never saw. Re-record periodically or the stubs drift from reality.

**Standalone / Docker** for shared environments (a deployed test environment where the real service under test is configured to call WireMock instead of the gateway):

\`\`\`bash
docker run -d --name payment-mock -p 8089:8080 \\
  -v "$PWD/wiremock:/home/wiremock" wiremock/wiremock:3.13.2
\`\`\`

Mappings live as JSON in \`wiremock/mappings/*.json\`, bodies in \`wiremock/__files\`; tests can still add per-test stubs over the admin API (\`new WireMock("payment-mock-host", 8089).register(...)\`). On a shared instance, tests must namespace their stubs (match on a unique order id) and must not call \`resetAll()\` — another pipeline is using it.

### Real-time project scenario

In a typical e-commerce project the checkout team had four flaky end-to-end tests because the payment sandbox timed out at night. The senior fix was layered: (1) the adapter tests above, with WireMock, cover every gateway branch in 2 seconds; (2) the order service's component tests run with the service configured to call a WireMock container, so "declined payment leaves the order unpaid" is tested through the service's own API; (3) **one** nightly smoke test talks to the real sandbox and is allowed to be quarantined, because its failures say "the sandbox is down", not "our code is broken"; (4) a contract test (section 2) keeps the stubs honest.

### Multiple approaches: how to fake an HTTP dependency

\`\`\`java
// Mockito: mock the Java client interface, no HTTP at all
PaymentGateway gateway = mock(PaymentGateway.class);
when(gateway.charge(any())).thenThrow(new PaymentUnavailableException("timeout", null));
\`\`\`

\`\`\`typescript
// Playwright: intercept what the BROWSER sends (see pw-deep-api-testing / pw-deep-network-cookies-sessions)
await page.route('**/v1/charges', route => route.fulfill({ status: 500, body: '{}' }));
\`\`\`

\`\`\`bash
# Prism: a mock server generated from an OpenAPI document
prism mock payment-gateway.openapi.yaml
\`\`\`

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability / scalability | When to use |
|---|---|---|---|---|---|---|
| **WireMock** (embedded or Docker) | real HTTP server with stubs, journal, faults | tests real serialisation, headers, timeouts, TCP faults; JSON mappings shareable; huge ecosystem | stubs can drift from the real API; another process in shared envs | ms per call; in-process | good with namespaced stubs and contract tests | default for JVM services and component tests |
| **MockServer** | HTTP server + proxy, expectations, verification | strong proxy/forwarding mode, many client languages | smaller community, project activity slower than WireMock's | similar | similar | when you need its proxy/record features or already use it |
| **Mockito on the client interface** | replaces the Java object, no HTTP | fastest, simplest for business logic | proves nothing about JSON, headers, timeouts or retries on the wire | fastest | brittle if mocks mirror implementation | unit tests of code *using* the adapter |
| **Playwright \`page.route()\`** | intercepts browser network requests | perfect for UI states (empty list, 500 banner) | only browser-originated traffic, not server-to-server | fast | lives with UI tests | UI tests needing backend error states |
| **Prism (OpenAPI mock)** | serves examples/generated data from the spec, can validate requests | zero stub code, always matches the spec | no stateful behaviour or precise faults; data is generic | fast | scales with the spec | early consumer development, spec-first teams |

**Recommended approach and why:** Mockito for the business logic around the adapter, WireMock for the adapter itself and for component tests of the service (because timeouts, retries and serialisation only exist on the wire), Playwright routing only for browser states, Prism when the provider exists only as an OpenAPI document. Whatever fakes you use, pair them with contract tests — a mock is a claim about another team's API, and claims need verification.

## 2. Contract testing

### What it is and why it is needed

Two services that deploy independently break each other in boring ways: a field renamed, an integer becoming a string, an endpoint returning 204 instead of 200. End-to-end environments find this late and flakily. A **contract test** checks the agreement between consumer and provider in isolation, on each side's own pipeline.

Three families:

| Approach | Who writes the contract | What is verified | Typical tools |
|---|---|---|---|
| **Schema as contract** | provider publishes a JSON Schema / OpenAPI | responses conform to the schema | JSON Schema validator, OpenAPI validators |
| **Consumer-driven contracts (CDC)** | each consumer records the interactions *it* uses | the real provider satisfies every consumer's expectations | Pact, Spring Cloud Contract |
| **Bi-directional / provider-driven** | provider publishes OpenAPI (verified by its own tests); consumer publishes a pact or its mocks | a broker cross-checks the consumer's expectations against the provider's spec | PactFlow bi-directional contracts, OpenAPI diff tools |

ShopEasy already offers the first: \`GET /api/schema/product\` returns a draft-04 schema with \`additionalProperties: false\`; how to validate against it is in \`restassured-deep-assertions-json-contracts\`. The limit of schema-as-contract: it says what the provider **may** return, not what each consumer **needs**. A schema-valid response can still break a consumer that relied on \`inStock\` being present for a sold-out product, and a provider cannot know which optional fields are safe to remove.

### How Pact works internally

\`\`\`
CONSUMER PIPELINE                                   PACT BROKER                     PROVIDER PIPELINE
consumer test ──► Pact mock server ──► pact file ──► publish (consumer, version,  ──► verifier fetches pacts for
 (real client       (answers as          JSON in        branch) ──────────────────►    the provider (selectors),
  code)             described, records   target/pacts                                  sets provider STATE, replays
                    mismatches)                                                       each request against the REAL
                                                                                      provider, compares responses
                                                    ◄── verification results ─────── publish result (provider version)
can-i-deploy ──► broker matrix: is consumer v X verified against the provider version in "production"? ──► exit 0/1
\`\`\`

Key mechanics: the consumer test drives the **real client code** against a Pact mock server; if the client sends a request no interaction describes, the test fails. Matchers (\`integerType\`, \`stringType\`) mean "any value of this type" — the provider is checked against the **shape and rules**, not the example values. Provider states (\`given("product 4 exists")\`) are names; the provider maps each name to setup code. Pact files default to \`target/pacts\` (Maven) and can be redirected with the \`pact.rootDir\` system property.

### Complete example: consumer test

The consumer is a typical "checkout" service that reads products from the ShopEasy API (ShopEasy's own web shop does not call the API — this consumer is illustrative; the provider data is real: product 4 is "Storm Fleece Jacket", 49.99, stock 12). Dependency \`au.com.dius.pact.consumer:junit5\` (4.6.x line at the time of writing).

\`\`\`java
package com.shopeasy.checkout.catalogue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

public record ProductView(int id, String name, double price, boolean inStock) { }

public final class CatalogueApiClient {
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);   // tolerant reader
    private final URI baseUri;

    public CatalogueApiClient(String baseUrl) { this.baseUri = URI.create(baseUrl); }

    public Optional<ProductView> product(int id) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("/api/products/" + id))
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(3))
                .GET().build();
        HttpResponse<String> res = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() == 404) return Optional.empty();
        if (res.statusCode() != 200) throw new IllegalStateException("catalogue HTTP " + res.statusCode());
        return Optional.of(mapper.readValue(res.body(), ProductView.class));
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.checkout.catalogue;

import static au.com.dius.pact.consumer.dsl.LambdaDsl.newJsonBody;
import static org.assertj.core.api.Assertions.assertThat;

import au.com.dius.pact.consumer.MockServer;
import au.com.dius.pact.consumer.dsl.PactDslWithProvider;
import au.com.dius.pact.consumer.junit5.PactConsumerTestExt;
import au.com.dius.pact.consumer.junit5.PactTestFor;
import au.com.dius.pact.core.model.V4Pact;
import au.com.dius.pact.core.model.annotations.Pact;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "shopeasy-api")
class CatalogueContractTest {

    @Pact(consumer = "shopeasy-checkout")
    public V4Pact existingProduct(PactDslWithProvider builder) {
        return builder
                .given("product 4 exists")
                .uponReceiving("a request for product 4")
                    .path("/api/products/4")
                    .method("GET")
                    .headers("Accept", "application/json")
                .willRespondWith()
                    .status(200)
                    .matchHeader("Content-Type", "application/json.*", "application/json; charset=utf-8")
                    .body(newJsonBody(p -> {
                        p.integerType("id", 4);
                        p.stringType("name", "Storm Fleece Jacket");
                        p.decimalType("price", 49.99);
                        p.booleanType("inStock", true);
                    }).build())
                .toPact(V4Pact.class);
    }

    @Pact(consumer = "shopeasy-checkout")
    public V4Pact missingProduct(PactDslWithProvider builder) {
        return builder
                .given("product 999 does not exist")
                .uponReceiving("a request for a product that does not exist")
                    .path("/api/products/999")
                    .method("GET")
                    .headers("Accept", "application/json")
                .willRespondWith()
                    .status(404)
                    .body(newJsonBody(b -> b.object("error", e -> {
                        e.stringValue("code", "PRODUCT_NOT_FOUND");
                        e.stringType("message", "Product 999 not found");
                    })).build())
                .toPact(V4Pact.class);
    }

    @Test
    @PactTestFor(pactMethod = "existingProduct")
    void readsAnExistingProduct(MockServer mockServer) throws Exception {
        var product = new CatalogueApiClient(mockServer.getUrl()).product(4);
        assertThat(product).hasValueSatisfying(p -> {
            assertThat(p.name()).isEqualTo("Storm Fleece Jacket");
            assertThat(p.inStock()).isTrue();
        });
    }

    @Test
    @PactTestFor(pactMethod = "missingProduct")
    void treatsAMissingProductAsEmpty(MockServer mockServer) throws Exception {
        assertThat(new CatalogueApiClient(mockServer.getUrl()).product(999)).isEmpty();
    }
}
\`\`\`

Step by step: the extension starts a mock server per test with only the interaction from \`pactMethod\`; the **real** \`CatalogueApiClient\` calls it; the test asserts what the consumer does with the answer; after the class, the interactions are written to \`target/pacts/shopeasy-checkout-shopeasy-api.json\`. Note what is **not** in the pact: \`slug\`, \`category\`, \`stock\`, \`description\`. The consumer does not use them, so the provider stays free to change them — this is the main advantage over "assert the whole response". \`stringValue("code", …)\` pins an exact value because the consumer branches on it; \`stringType("message", …)\` accepts any text.

### Complete example: provider verification

The provider here is the Node ShopEasy API; the Java verifier is language-agnostic because it replays HTTP. (A Node team would normally use pact-js; the mechanics are identical.) Dependency \`au.com.dius.pact.provider:junit5\`.

\`\`\`java
package com.shopeasy.api.contracts;

import static io.restassured.RestAssured.given;

import au.com.dius.pact.provider.junit5.HttpTestTarget;
import au.com.dius.pact.provider.junit5.PactVerificationContext;
import au.com.dius.pact.provider.junit5.PactVerificationInvocationContextProvider;
import au.com.dius.pact.provider.junitsupport.Provider;
import au.com.dius.pact.provider.junitsupport.State;
import au.com.dius.pact.provider.junitsupport.loader.PactBroker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.api.extension.ExtendWith;

@Provider("shopeasy-api")
@PactBroker            // broker URL and credentials from system properties (pactbroker.url, ...) — never hard-coded
class ShopEasyApiPactVerificationTest {

    private static final String BASE = "http://localhost:5181";

    @BeforeEach
    void target(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", 5181));
    }

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyInteraction(PactVerificationContext context) {
        context.verifyInteraction();                      // one generated test per interaction
    }

    @State("product 4 exists")
    void seedCatalogue() {
        given().baseUri(BASE).post("/api/reset").then().statusCode(200);   // local provider only
    }

    @State("product 999 does not exist")
    void noSuchProduct() {
        // the seed has ids 1-6; nothing to do, but the state must exist or verification fails
    }
}
\`\`\`

For a local run without a broker, swap \`@PactBroker\` for \`@PactFolder("pacts")\` and copy the consumer's pact file. In CI the provider build sets \`pact.provider.version\` (the git SHA), \`pact.provider.branch\` and \`pact.verifier.publishResults=true\` **as JVM system properties of the test JVM** (Surefire \`systemPropertyVariables\`), and chooses which pacts to verify with consumer version selectors — typically "the main branch" and "what is deployed in each environment" — via a static method annotated \`@PactBrokerConsumerVersionSelectors\`. \`enablePendingPacts\` lets a consumer publish a new expectation without breaking the provider's build until it is verified once.

The release gate on both sides is one CLI call:

\`\`\`bash
pact-broker can-i-deploy --pacticipant shopeasy-checkout --version "$GIT_SHA" --to-environment production
# after a successful deployment
pact-broker record-deployment --pacticipant shopeasy-checkout --version "$GIT_SHA" --environment production
\`\`\`

Exit code 0 means every integration of that version has been verified against what is in production; 1 blocks the pipeline.

### Who owns what

| Artefact | Owner | Runs in |
|---|---|---|
| Consumer tests + pact file | consumer team | consumer CI, every commit |
| Provider states, verification test | provider team | provider CI, every commit + webhook when a pact changes |
| Broker, selectors, environments | platform/QA enablement | shared |
| \`can-i-deploy\` + \`record-deployment\` | each team's deploy pipeline | before / after deploy |
| Deciding a breaking change | both teams, through the failing verification | conversation, not a ticket ping-pong |

The SDET's job is usually to set up the pattern, the broker and the gates, and to coach consumers to write **minimal** expectations — a pact that asserts every field turns into the brittle end-to-end test it was meant to replace.

### When contract testing is overkill

* One team owns both sides and deploys them together (a monolith with a SPA built in the same pipeline) — a schema check plus an integration test is enough.
* Public APIs with unknown consumers — you cannot collect their pacts; use OpenAPI, versioning and backward-compatibility diffs (section 6).
* A provider you cannot run in CI (third-party SaaS) — CDC needs the provider to verify; use recorded stubs plus a scheduled real smoke.
* Very few, very stable integrations — the broker and process cost more than the occasional break.

**Spring Cloud Contract** is the provider-driven JVM alternative: contracts in Groovy/YAML live with the provider, generate provider tests and publish WireMock stubs that consumers download. Excellent in an all-Spring estate; less natural with polyglot consumers.

### Multiple approaches compared

| | Schema as contract | Pact (CDC) | Bi-directional (OpenAPI + consumer pacts) | Spring Cloud Contract |
|---|---|---|---|---|
| How it works | validate responses against the schema | consumer records, provider replays | broker compares consumer expectations with the provider's spec | provider contracts generate tests + stubs |
| Advantages | cheap, already exists for many APIs | proves what consumers actually use; safe field removal | provider keeps its existing tests; easy for spec-first teams | stubs guaranteed to match provider |
| Disadvantages | no knowledge of consumer needs; schema can be lax | provider states and broker to maintain; learning curve | only as good as the spec's truthfulness | JVM/Spring-centric; consumer needs are guessed |
| Performance | trivial | fast (no environment) | fast | fast |
| Maintainability / scalability | good | good if pacts stay minimal; scales with many consumers | good | good inside Spring estates |
| When to use | every API, baseline | internal microservices with known consumers, independent deploys | provider will not run consumer pacts; OpenAPI is authoritative | Spring-only teams, provider-led design |

**Recommended approach and why:** keep schema validation everywhere as the cheap baseline; add Pact for internal service-to-service integrations that deploy independently, because only CDC tells a provider "removing \`inStock\` breaks checkout" before release; consider bi-directional when the provider team will not host verification. Gate releases with \`can-i-deploy\`, not with a shared end-to-end environment.

## 3. Asynchronous APIs

### What it is and how it works

Many operations do not finish inside the HTTP request: exports, refunds, search indexing, emails. Common shapes:

1. **202 Accepted + status resource**: \`POST /api/exports\` → \`202\`, \`Location: /api/exports/42\`; the client polls until \`status\` is \`DONE\` or \`FAILED\`.
2. **Eventual consistency**: \`POST\` returns 201, but a read model (search, reporting) catches up a few hundred ms later.
3. **Callbacks/webhooks**: the server calls *your* URL when something happens.
4. **Messages**: the API publishes an event to Kafka/RabbitMQ; other services react.

All ShopEasy endpoints are synchronous — an order is readable via \`GET /api/orders/{id}\` immediately after the 201 — so the async examples below are **typical real app** except the readiness wait.

### Waiting: Awaitility vs sleep vs loops

Awaitility (\`org.awaitility:awaitility\`, 4.x) evaluates a condition repeatedly until it holds or a timeout expires. \`untilAsserted\` keeps polling while the lambda throws \`AssertionError\` and rethrows the last one inside a \`ConditionTimeoutException\` when time runs out, so the failure message is still the real assertion. By default the condition is polled on a separate thread (\`pollInSameThread()\` changes that — needed for code relying on \`ThreadLocal\`s, such as a thread-bound token).

| Method | Use |
|---|---|
| \`await("alias")\` | names the wait in failure messages |
| \`atMost(Duration)\` / \`atLeast(Duration)\` | upper bound / "must not happen before" |
| \`pollDelay(Duration)\` / \`pollInterval(Duration)\` | first check delay / interval (also \`FibonacciPollInterval.fibonacci()\`) |
| \`ignoreExceptions()\` / \`ignoreException(Class)\` | keep polling through e.g. \`ConnectException\` |
| \`untilAsserted(() -> …)\` | REST Assured / AssertJ assertions as the condition |
| \`until(callable, predicate)\` | returns the value that satisfied the predicate |
| \`conditionEvaluationListener(...)\` | log each poll (handy in CI) |

**Real ShopEasy use — readiness before the suite** (the API is started by \`npm run api\` and may not be listening yet):

\`\`\`java
import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.equalTo;

import java.time.Duration;
import org.testng.annotations.BeforeSuite;

public class ApiReadiness {

    @BeforeSuite(alwaysRun = true)
    public void waitForShopEasy() {
        await("ShopEasy API on 5181 reports UP")
                .atMost(Duration.ofSeconds(30))
                .pollInterval(Duration.ofMillis(500))
                .ignoreExceptions()                              // ConnectException until the port is open
                .untilAsserted(() -> given().baseUri("http://localhost:5181")
                        .when().get("/api/health")
                        .then().statusCode(200).body("status", equalTo("UP")));
    }
}
\`\`\`

**Typical real app — 202 and polling**:

\`\`\`java
public record ExportJob(String id, String status, String downloadUrl, String error) { }

@Test
public void orderExportCompletes() {
    Response accepted = given().spec(customerSpec)
            .body(Map.of("format", "csv", "from", "2026-01-01"))
            .when().post("/api/exports");
    accepted.then().statusCode(202).header("Location", notNullValue());
    String statusUrl = accepted.header("Location");

    ExportJob job = await("export " + statusUrl + " finishes")
            .atMost(Duration.ofSeconds(60))
            .pollDelay(Duration.ofMillis(200))
            .pollInterval(Duration.ofSeconds(1))
            .until(() -> given().spec(customerSpec).get(statusUrl).then().statusCode(200)
                            .extract().as(ExportJob.class),
                   j -> !"RUNNING".equals(j.status()) && !"QUEUED".equals(j.status()));

    assertThat(job.status()).as("export failed: %s", job.error()).isEqualTo("DONE");
    assertThat(job.downloadUrl()).startsWith("/api/exports/" + job.id());
}
\`\`\`

The predicate stops on **any** terminal state, so a \`FAILED\` job fails in 2 seconds with its error message instead of timing out after 60.

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability | When to use |
|---|---|---|---|---|---|---|
| \`Thread.sleep(5000)\` | fixed wait | trivial | too long when fast, too short under load → slow **and** flaky | worst | magic numbers everywhere | never in a committed test |
| Hand-written loop | \`while\` + sleep + counter | no dependency | timeout, interval, exception handling and messages re-implemented (badly) per test | ok | duplicated, error-prone | only where adding a library is impossible |
| **Awaitility** | polls a condition with timeout/interval/ignored exceptions | returns as soon as true; clear failure messages; aliases; listeners | one more dependency; can hide a missing terminal state if the predicate is wrong | best for polling | declarative, reusable | default for every async check |
| Push-based (webhook receiver, queue consumer) | test receives the event | no polling of the API under test | more infrastructure | best | needs a test receiver | webhooks, events |

**Recommended approach and why:** Awaitility with an explicit, configurable \`atMost\`, a sensible poll interval and a terminal-state predicate; push-based capture for webhooks and events. A sleep is a guess; a poll with a timeout is a measured requirement.

### Webhooks

The trick is to make the system under test call a URL **you** control. In a typical real app, the test environment's webhook URL for "order placed" points at WireMock:

\`\`\`java
gateway.stubFor(post(urlPathEqualTo("/hooks/order-placed")).willReturn(ok()));     // the receiver

int orderId = placeOrderViaApi();                                                  // the trigger

await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
        gateway.verify(postRequestedFor(urlPathEqualTo("/hooks/order-placed"))
                .withHeader("X-Signature", matching("sha256=[0-9a-f]{64}"))
                .withRequestBody(matchingJsonPath("$.orderId", equalTo(String.valueOf(orderId))))));
\`\`\`

Then test the hard parts: the receiver returns 500 → does the sender retry with backoff? Duplicate deliveries → is the event id stable so receivers can de-duplicate? Signature verification with the shared secret. A WireMock scenario (500, 500, 200) drives the retry test.

### Message queues and Kafka (overview)

For event-driven services, the test publishes or consumes messages instead of calling HTTP. Pattern (illustrative): start a real broker with **Testcontainers** (its Kafka module), point the service at it, trigger \`POST /api/orders\`, then poll a test consumer with Awaitility until an \`OrderPlaced\` event with the new order id arrives; assert schema (Avro/JSON Schema with a schema registry), key (order id, for partition ordering) and headers (correlation id). Use a unique consumer group per test run and filter by your own ids — topics are shared, and "the first message on the topic" is someone else's. Pact also supports message pacts for event contracts.

## 4. GraphQL with REST Assured

### How it works

GraphQL (typical real app — ShopEasy has none) is usually a single endpoint, \`POST /graphql\`, with a JSON body \`{ "query": "...", "variables": { ... }, "operationName": "..." }\`. REST Assured needs nothing special: it is just a POST. The differences that matter for testing:

* **Errors usually come back with HTTP 200** and an \`errors\` array (\`message\`, \`path\`, \`extensions.code\`); \`data\` can be partially filled. \`statusCode(200)\` alone proves almost nothing.
* The client chooses the fields, so the "contract" is the schema plus the queries consumers actually send.
* Authorisation often applies per field — one query can be allowed for \`name\` and denied for \`cost\`.

\`\`\`java
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

import java.util.Map;
import org.testng.annotations.Test;

public class ProductGraphqlTest {

    private static final String PRODUCT_QUERY = """
            query Product($id: ID!) {
              product(id: $id) { id name price inStock }
            }""";

    @Test
    public void productByIdHasNoErrors() {
        given().spec(graphqlSpec)                                   // base URI, JSON, auth
                .body(Map.of("query", PRODUCT_QUERY,
                             "variables", Map.of("id", "4"),
                             "operationName", "Product"))
        .when()
                .post("/graphql")
        .then()
                .statusCode(200)
                .body("errors", nullValue())                       // ALWAYS assert this first
                .body("data.product.name", equalTo("Storm Fleece Jacket"))
                .body("data.product.price", equalTo(49.99f));
    }

    @Test
    public void unknownProductIsReportedInErrorsArray() {
        given().spec(graphqlSpec)
                .body(Map.of("query", PRODUCT_QUERY, "variables", Map.of("id", "999")))
        .when()
                .post("/graphql")
        .then()
                .statusCode(200)                                   // yes, 200
                .body("data.product", nullValue())
                .body("errors[0].path", hasItem("product"))
                .body("errors[0].extensions.code", equalTo("NOT_FOUND"));
    }
}
\`\`\`

Explanation: send variables separately instead of concatenating them into the query string — it is how real clients work, it avoids injection-shaped bugs, and the server can cache the parsed query. The \`equalTo(49.99f)\` follows REST Assured's default float mapping for JSON decimals (configure \`DOUBLE\` as in \`restassured-deep-internals-http\` and the framework's \`SpecFactory\`). Put a reusable check in the response spec: "\`errors\` is null" for every positive test — otherwise someone will forget it.

Senior checks specific to GraphQL:

* **Introspection** (\`{ __schema { types { name } } }\`) — useful in test environments to snapshot the schema and diff it between releases; often disabled in production, which is itself a security test.
* **Depth and complexity limits** — a nested query (\`orders { items { product { reviews { author { orders … } } } } }\`) should be rejected with a clear error, not take down the server.
* **N+1** — a list query that triggers one database call per item; detect it with server metrics or by timing \`first: 10\` vs \`first: 100\`, not by functional assertions.
* **Field-level authorisation** and **persisted queries** (only pre-registered query hashes allowed).

Alternatives: generated typed clients (e.g. from the schema) give compile-time safety; Karate and Playwright's \`request.post\` work the same way as above. REST Assured is fine when the suite is already REST Assured.

## 5. Performance smoke checks vs real load tests

### What a functional suite can and cannot say

A REST Assured test measures **one request from one client on a noisy CI agent**: DNS, connection setup, JIT warm-up and the network all count. That supports two honest checks:

1. **Timeouts** — the client must give up when the server hangs. This is a *functional* requirement (no hung pipelines, no hung threads in production).
2. **Gross regression smoke** — "the product list did not get 10× slower", with a generous threshold from config. Not an SLA. The reasons are discussed with Playwright examples in \`pw-deep-api-testing\`; the REST Assured \`time()\` mechanics are in \`restassured-deep-internals-http\`.

### Timeouts with \`/api/slow\`

\`\`\`java
import static io.restassured.RestAssured.given;
import static io.restassured.config.HttpClientConfig.httpClientConfig;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.lessThan;

import io.restassured.RestAssured;
import io.restassured.config.RestAssuredConfig;
import java.net.SocketTimeoutException;
import java.util.concurrent.TimeUnit;
import org.testng.annotations.Test;

public class TimeoutSmokeTest {

    private static final RestAssuredConfig ONE_SECOND = RestAssured.config().httpClient(httpClientConfig()
            .setParam("http.connection.timeout", 1_000)            // Apache HttpClient 4 parameter names
            .setParam("http.socket.timeout", 1_000));

    @Test
    public void hangingEndpointFailsFastInsteadOfBlockingTheBuild() {
        assertThatThrownBy(() -> given().config(ONE_SECOND)
                        .baseUri("http://localhost:5181")
                        .queryParam("ms", 5_000)
                        .when().get("/api/slow"))
                .isInstanceOf(SocketTimeoutException.class);       // "Read timed out" after ~1 s
    }

    @Test
    public void fastPathStaysFarBelowTheCeiling() {
        given().config(ONE_SECOND).baseUri("http://localhost:5181")
                .queryParam("ms", 200)
        .when().get("/api/slow")
        .then().statusCode(200)
                .body("delayedMs", equalTo(200))
                .time(lessThan(Long.getLong("smoke.ceiling.ms", 3_000L)), TimeUnit.MILLISECONDS);
    }
}
\`\`\`

Explanation: the first test is the important one. A \`time(lessThan(...))\` assertion is evaluated **after** the response arrives, so without a socket timeout a hung server blocks the test forever; the client timeout turns a hang into a fast, clear failure. REST Assured rethrows the checked \`SocketTimeoutException\` unchanged, so AssertJ can match its type. The ceiling in the second test comes from a system property so each environment can tune it, and it is many times the normal latency.

### A tiny concurrent smoke

Some bugs only appear with concurrency: shared mutable state, connection-pool exhaustion, non-unique ids. A 20-request burst inside the functional suite catches the crude ones. The executor mechanics are in \`java-deep-executors-completablefuture\`.

\`\`\`java
@Test
public void twentyConcurrentCatalogueReadsAllSucceedWithDistinctRequestIds() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(10);
    try {
        List<Callable<Response>> calls = IntStream.range(0, 20)
                .<Callable<Response>>mapToObj(i -> () -> given().spec(anonymousSpec)
                        .queryParam("sort", "price_asc").queryParam("size", 50)
                        .get("/api/products"))
                .toList();

        List<Response> responses = new ArrayList<>();
        for (Future<Response> f : pool.invokeAll(calls, 30, TimeUnit.SECONDS)) {
            responses.add(f.get());                                // CancellationException if it timed out
        }

        assertThat(responses).extracting(Response::statusCode).containsOnly(200);
        assertThat(responses).extracting(r -> r.jsonPath().getInt("total")).containsOnly(6);
        assertThat(responses).extracting(r -> r.header("X-Request-Id"))
                .doesNotContainNull()
                .doesNotHaveDuplicates();                          // ShopEasy issues req-00001, req-00002, ...
    } finally {
        pool.shutdownNow();
    }
}
\`\`\`

This proves correctness under concurrency, not capacity. It says nothing about p95 latency at 200 requests per second.

### Real load testing: Gatling, JMeter, k6

Load tests answer different questions: throughput at a latency target, behaviour at and beyond capacity, memory leaks over hours. They need a production-like environment, realistic data volumes, a workload model (arrival rate, think time, mix of endpoints), and monitoring on the server side.

Gatling Java DSL (\`io.gatling.javaapi\`), run with the Gatling Maven plugin (\`mvn gatling:test\`):

\`\`\`java
import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;

public class CatalogueBrowseSimulation extends Simulation {

    HttpProtocolBuilder shopEasy = http.baseUrl("http://localhost:5181").acceptHeader("application/json");

    ScenarioBuilder browse = scenario("Browse catalogue")
            .exec(http("list products by price")
                    .get("/api/products").queryParam("sort", "price_asc").queryParam("size", "10")
                    .check(status().is(200), jsonPath("$.total").ofInt().is(6)))
            .pause(1)                                                  // think time
            .exec(http("product details")
                    .get("/api/products/4")
                    .check(status().is(200)));

    {
        setUp(browse.injectOpen(
                    rampUsersPerSec(1).to(20).during(30),            // warm-up
                    constantUsersPerSec(20).during(120)))             // steady arrival rate
            .protocols(shopEasy)
            .assertions(
                    global().responseTime().percentile(95.0).lt(500),
                    global().failedRequests().percent().lt(1.0));
    }
}
\`\`\`

\`injectOpen\` models users **arriving** at a rate (like a web shop), as opposed to \`injectClosed\` (a fixed number of concurrent users). The assertions make the run fail CI when p95 ≥ 500 ms or more than 1% of requests fail. (\`percentile3()\` is the 95th only while \`gatling.conf\` keeps default percentiles; \`percentile(95.0)\` is explicit.) Pointing this at a local single-threaded Node practice server measures your laptop — real numbers need a real environment.

The k6 equivalent for teams that prefer JavaScript:

\`\`\`javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const res = http.get('http://localhost:5181/api/products?sort=price_asc&size=10');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
\`\`\`

Metrics a senior reports: **p50/p95/p99 latency** (averages hide the tail that users feel), **throughput** (requests/s actually served), **error rate**, and server-side saturation (CPU, pool usage, GC) — always together, because latency without throughput is meaningless.

| Tool | Script language | Strengths | Weaknesses | When |
|---|---|---|---|---|
| Gatling | Java/Kotlin/Scala DSL | code in the same language as the framework, efficient engine, good HTML reports, assertions for CI | DSL to learn | JVM teams, load tests as code |
| JMeter | GUI + XML plans | mature, many protocols and plugins, non-coders can build plans | XML diffs badly; GUI-centric; heavier per virtual user | existing JMeter estates, protocol variety |
| k6 | JavaScript | developer-friendly, thresholds built in, easy in CI | JS runtime is not Node (no npm modules as-is) | JS/TS teams, quick API load checks |
| REST Assured + ExecutorService | Java | no new tool | no workload model, coordinated omission, no percentiles | concurrency **smoke** only |

**Where it runs in CI:** functional suites (including timeout and concurrency smoke) on every pull request; a short Gatling/k6 **baseline** (a few minutes, fixed load, thresholds) nightly or before release against a stable performance environment; full load, stress and soak tests on demand or per release, with results compared to the previous baseline rather than to a fixed number. Never run load against a shared functional test environment during the day.

## 6. Other senior topics

### Idempotency keys and retries

Retries are only safe for idempotent operations. GET, PUT and DELETE are idempotent by definition; POST is not — and ShopEasy proves it: two identical \`POST /api/orders\` calls create **two** orders (ids increase from 1001), and a second \`POST /api/cart/items\` for the same product returns 409 \`ITEM_ALREADY_IN_CART\`. A client that retries \`POST /api/orders\` after a timeout can therefore create a duplicate order — a test worth writing against any API you own (\`api-026\` practises the ShopEasy retry behaviours).

Typical real APIs solve it with an \`Idempotency-Key\` header: same key + same body → the original response is replayed; same key + different body → 409/422. Test matrix:

| Case | Expected (typical real app) |
|---|---|
| same key, same body, twice | same status and same order id; only one order exists |
| same key, different body | rejected (409/422), nothing created |
| two keys, same body | two orders (keys, not bodies, define identity) |
| concurrent requests with one key | one creation, the other waits or gets 409 — run with the concurrent pattern above |
| key reused after expiry window | documented behaviour |

And on the client side, the WireMock retry test in section 1 proves the key is reused across retries.

### Pagination, filtering and sorting as invariants

Example-based tests check a few known pages. **Property-style** tests check rules that must hold for *any* valid input — powerful for ShopEasy's \`GET /api/products\` (\`q\` name contains, case-insensitive; \`sort\` \`name_asc|name_desc|price_asc|price_desc\` with aliases \`az|za|lohi|hilo\`; \`page\` 1–1000; \`size\` 1–50; response \`{ data, page, size, total, totalPages }\`; 400 \`INVALID_QUERY\` with \`details[].field\`). Invariants to check across many combinations of \`q\`, \`sort\` and \`size\`:

* every item satisfies the filter (name contains \`q\` ignoring case);
* \`totalPages == ceil(total / size)\`;
* concatenating all pages gives \`total\` items, **no duplicates and no gaps** — and the same set as one big page with \`size=50\`;
* the sort order holds **across** page boundaries, not just within a page (\`price_asc\` breaks ties by id in ShopEasy, so the order is deterministic — check the tie rule exists in any API you test, or pages can overlap);
* an alias returns exactly what its canonical sort returns;
* out-of-range \`size\`/\`page\` values give 400 with the offending \`field\`.

Generate the combinations with a TestNG \`@DataProvider\` or a property-based library such as jqwik (JUnit 5 engine) that also **shrinks** a failing input to the smallest one. Real-world pitfalls these invariants catch: offset pagination over data that changes between requests (items skipped/duplicated — cursor pagination exists for this), non-deterministic sorts, and filters applied after pagination.

### API versioning and backward compatibility

ShopEasy exposes a version only in \`/api/health\` (\`"version": "1.0.0"\`) and has no versioned paths. In typical real APIs versions live in the path (\`/v2/\`), a header or a media type. What to test:

* **Additive changes are non-breaking only if clients are tolerant readers** — the framework's \`SpecFactory\` disables \`FAIL_ON_UNKNOWN_PROPERTIES\` for exactly this reason. Test it: add a field in a stub and run the client.
* **Breaking changes** (removing/renaming fields, changing types, new required request fields, narrower enums, changed status codes) must be caught before release: diff the OpenAPI documents between the released and the new version in CI (tools such as oasdiff or openapi-diff), and keep consumer pacts verifying against the new provider.
* **Old versions keep working** until their documented sunset: run the previous version's regression pack against the new deployment; check \`Deprecation\`/\`Sunset\` headers if the API uses them.

### Testcontainers for real dependencies

Testcontainers starts throwaway Docker containers from test code (\`@Testcontainers\` + \`@Container\` in JUnit 5, or manual \`start()\`/\`stop()\` in TestNG): PostgreSQL, Kafka, Redis, LocalStack, even WireMock (there is a WireMock Testcontainers module). It sits between mocks and shared environments: real behaviour (SQL constraints, transactions, broker semantics), but isolated and disposable per build. Costs: Docker on every agent, 5–30 s start-up (share one container per suite, not per test), and images to keep updated. A typical component-test setup: service under test in-process, Postgres via Testcontainers, payment gateway via WireMock, assertions through the service's REST API with REST Assured.

## Common mistakes and debugging

| Symptom | Likely cause | How to find and fix it |
|---|---|---|
| Client gets 404 from WireMock with a body like "Request was not matched" | stub does not match: path vs path+query, header case, JSON body differs | read the near-miss diff in the log or \`findNearMissesForAllUnmatched()\`; use \`urlPathEqualTo\` + \`withQueryParam\`, \`equalToJson(..., true, true)\` |
| Stub ignored, another response returned | a newer or higher-priority broader stub matches | \`GET /__admin/mappings\`; give specific stubs \`atPriority(1)\`; reset between tests |
| Tests pass alone, fail in parallel | static WireMock DSL / shared server with \`resetAll()\` per method | instance per class, per-test unique matching data, no global reset on shared servers |
| Fault test hangs on a developer laptop | \`CONNECTION_RESET_BY_PEER\` on Windows | client timeout always set; run fault tests on Linux CI; or use \`EMPTY_RESPONSE\` |
| Pact verification: "state not found" | provider has no \`@State\` with that exact name | names are string contracts — keep a shared list; fail on missing states |
| Pact passes, production breaks | consumer test asserted on the mock, not via the real client; or pact too loose (\`stringType\` where an enum value matters) | always drive the real client; use exact values for fields the consumer branches on |
| Awaitility times out with a vague message | \`until(() -> flag)\` boolean condition | \`untilAsserted\` with real assertions, an alias, and a terminal-state predicate |
| GraphQL test green while feature broken | only \`statusCode(200)\` asserted | assert \`errors\` is null in a shared response spec |
| Response-time test flaky in CI | SLA asserted on a shared agent | timeout + generous ceiling from config; percentiles in Gatling/k6 |
| Test hangs forever on a slow endpoint | no client socket timeout | configure connect/read timeouts in \`SpecFactory\`; verify with \`/api/slow\` |

## Best practices for experienced engineers

* **Mock at the boundary you own.** Mock the third party's HTTP API with WireMock; do not mock your own service's internals in an API test.
* **Every mock needs a source of truth** — a contract test, a recording refreshed on schedule, or the provider's OpenAPI. Unverified mocks are fiction.
* **Test the unhappy wire**: timeout, reset, 5xx then success, 429 with \`Retry-After\`, malformed body. These are the branches production hits and nobody tests by hand.
* **Assert on the request journal** for side effects (amount, idempotency key, number of attempts) instead of only on the response.
* **Keep pacts minimal and consumer-shaped**; gate deploys with \`can-i-deploy\`; publish verification results only from CI.
* **No \`Thread.sleep\` in tests.** Awaitility with alias, \`atMost\` from config and a terminal-state predicate.
* **Separate functional timeouts from performance testing**; report p95/p99, throughput and error rate together, from a real environment.
* **Make async and concurrency tests diagnosable**: log correlation ids (\`X-Request-Id\` in ShopEasy), job ids and the last polled state on failure.

## Equivalent in the other stack

Playwright-TypeScript has no built-in WireMock; for **server-to-server** mocking, TS teams run WireMock (Docker) or MockServer too, while \`page.route()\` covers browser traffic only (\`pw-deep-api-testing\`). Pact has a JS implementation (pact-js) with the same broker and \`can-i-deploy\`. Polling is \`expect.poll(() => …, { timeout })\` or \`expect(async () => { … }).toPass()\` instead of Awaitility. GraphQL is \`request.post('/graphql', { data: { query, variables } })\`. Load testing is usually k6.

## Interview questions

### Q: When would you mock a dependency in API tests, and when would you insist on the real one?

**Short answer (30–60 s):** I mock dependencies I don't own when I need speed, determinism or error paths the real one won't produce — timeouts, 500s, declines. I use the real dependency for a thin layer of integration and end-to-end tests, and I keep mocks honest with contract tests. Components my team owns, like our database, I prefer real via Testcontainers rather than mocked.

**Detailed answer:** The decision is about what the test is meant to prove. A test of the payment adapter's retry policy must control the gateway precisely — only a mock can return 500 then 200 on demand. A test that "checkout works with the real provider" must not be mocked, but it is slow and flaky by nature, so there should be few of them and their failures should be triaged as environment issues first. The risk of mocking is drift: the stub says \`status: "APPROVED"\` while the provider moved to \`state: "approved"\`. Mitigations: Pact or bi-directional contracts, stubs generated from the provider (Spring Cloud Contract), or recordings refreshed regularly. For my own infrastructure (Postgres, Kafka) mocks hide real behaviour — constraint violations, transactions, partition ordering — so Testcontainers is the better trade.

### Q: How does WireMock decide which stub answers a request, and how do you debug a mismatch?

**Short answer (30–60 s):** It evaluates all stub mappings; among those that match, the highest priority wins, and for equal priority the most recently added. Every request goes into the request journal. For a mismatch I read the near-miss report, which shows the closest stub and which part — URL, header, body — differed.

**Detailed answer:** Matching combines URL (\`urlEqualTo\` includes the query string, \`urlPathEqualTo\` does not), method, headers, query params, cookies and body patterns (\`equalToJson\`, \`matchingJsonPath\`). Common traps: \`urlEqualTo("/v1/charges")\` failing because the client adds \`?expand=true\`; a broad catch-all stub added later shadowing a specific one; JSON compared as strings with \`equalTo\` instead of \`equalToJson\`. Debugging tools: the 404 body and log near-miss diff, \`findUnmatchedRequests()\`, \`findNearMissesForAllUnmatched()\`, and \`GET /__admin/mappings\` / \`/__admin/requests\` on a standalone instance. Priorities (\`atPriority(1)\`) make intent explicit when a default fallback stub exists.

### Q: Explain consumer-driven contract testing with Pact end to end. What does can-i-deploy actually check?

**Short answer (30–60 s):** The consumer's tests run its real client against a Pact mock server, which records the interactions into a pact file. The pact is published to a broker. The provider's CI fetches the pacts, sets up each provider state and replays the requests against the real provider, then publishes the result. \`can-i-deploy\` asks the broker whether this version has a successful verification with the versions already in the target environment.

**Detailed answer:** Matchers make the provider verify types and rules, not example values, so provider data can differ. Provider states are named preconditions the provider implements (\`@State("product 4 exists")\`). Consumer version selectors decide which pacts the provider verifies — usually the main branch and what is deployed in each environment — and pending pacts stop a new consumer expectation from breaking the provider until it has been verified once. The broker builds a matrix of consumer version × provider version × verification result; \`can-i-deploy --to-environment production\` checks that, for every integration of the version being deployed, the counterpart version recorded in production (via \`record-deployment\`) has a passing verification. That replaces "deploy everything to a shared environment and run end-to-end tests" as the compatibility gate.

### Q: Isn't JSON Schema validation already contract testing? Why add Pact?

**Short answer (30–60 s):** Schema validation is a provider-side contract: it checks the provider returns what it promised. It doesn't know what consumers depend on. Pact captures what each consumer actually uses, so the provider learns before release that removing or changing a field breaks someone — and learns which fields it can safely change.

**Detailed answer:** A schema with optional fields allows the provider to stop sending \`inStock\` and still be valid, while a consumer relies on it. A schema also does not capture status codes per scenario, headers, or semantic values (\`code: PRODUCT_NOT_FOUND\`) that the consumer branches on. Conversely, Pact does not prove the provider honours its full published API for unknown consumers. So I use both: schema validation as the cheap baseline for every response (ShopEasy's \`/api/schema/product\` is a good example), Pact for internal integrations with known consumers and independent deployments, and OpenAPI diffs for public APIs.

### Q: How do you test an endpoint that returns 202 Accepted?

**Short answer (30–60 s):** Assert the 202 and the \`Location\` of the status resource, then poll that resource with Awaitility — an explicit \`atMost\`, a reasonable poll interval, and a predicate that stops on any terminal state, so a FAILED job fails fast with its error. Then assert the final result. Never \`Thread.sleep\`.

**Detailed answer:** I also test the edges: the status resource before the job starts (QUEUED), what a second identical request does (new job or idempotent replay), permissions on another user's job id (403/404, as ShopEasy does for orders), cancellation, and the timeout behaviour. The \`atMost\` comes from configuration because it differs per environment; the failure message includes the last observed state and the job id for triage. If the API offers a webhook on completion, I prefer capturing that with a test receiver (WireMock) over polling. For eventual consistency (write, then read model catches up), the same Awaitility pattern applies, with a narrow assertion on the specific record I created.

### Q: What is different about testing GraphQL compared with REST?

**Short answer (30–60 s):** One endpoint, the client picks the fields, and errors usually come back as HTTP 200 with an \`errors\` array and possibly partial \`data\`. So every test must assert \`errors\` is absent before looking at \`data\`. Beyond that I test variables, field-level authorisation, depth/complexity limits, and introspection being disabled in production.

**Detailed answer:** With REST Assured it is a POST of \`{ query, variables, operationName }\`; I keep queries as constants or \`.graphql\` resource files and pass variables separately. Contract-wise, the schema plus the set of queries clients actually use is the contract — schema diffs between releases catch removed fields and changed nullability. Non-functional risks are specific: deeply nested queries (denial of service), N+1 resolvers (performance, measured with server metrics), and over-fetching sensitive fields. For negative tests I assert \`errors[0].extensions.code\` and \`path\`, because the message text is not stable.

### Q: Should response-time assertions be in a functional API suite?

**Short answer (30–60 s):** Timeouts yes — a client that never gives up blocks pipelines and threads. Response-time SLAs no: one request on a shared CI agent measures noise. I keep at most a generous ceiling from config to catch gross regressions, and measure p95/p99 and throughput with Gatling or k6 in a controlled environment.

**Detailed answer:** \`time(lessThan(...))\` is evaluated after the response arrives, so it cannot protect against hangs; a socket timeout can — ShopEasy's \`/api/slow?ms=5000\` with a 1 s read timeout demonstrates the \`SocketTimeoutException\`. A small concurrent burst with an \`ExecutorService\` is a useful correctness smoke (no 500s, unique \`X-Request-Id\`s), but it has no workload model and suffers from coordinated omission, so it is not a load test. Real load tests define arrival rate, think time and endpoint mix, run against production-like data, and are judged on percentiles, throughput, error rate and server saturation, compared with a baseline.

### Q: How do you test retries and idempotency?

**Short answer (30–60 s):** On the client side, with WireMock: 500 then 200 via a scenario, timeouts via a fixed delay, then I verify the number of attempts in the request journal and that every attempt carried the same idempotency key, and that 4xx is never retried. On the server side I send the same key twice and assert one resource and an identical response, and the same key with a different body is rejected.

**Detailed answer:** I first classify operations: GET/PUT/DELETE are idempotent by definition, POST is not — on ShopEasy two identical \`POST /api/orders\` create two orders, which is exactly why blind retries are dangerous. For APIs with idempotency keys I add concurrency (two parallel requests with one key), expiry of the key, and the behaviour when the first attempt failed mid-way. On the client, I also check backoff (attempt timing with \`withFixedDelay\` and elapsed-time bounds) and that \`Retry-After\` on 429/503 is honoured.

## Scenario-based questions

**1. The checkout suite fails three nights a week because the payment sandbox times out. Product wants "stable tests by Friday".** I would separate what we test from what the sandbox does. Step one: move every gateway branch (approve, decline, 500, timeout, reset, retry with the same key) into adapter tests with WireMock — fast and deterministic. Step two: run the order service's component tests against a WireMock container, so business flows (declined payment leaves the order unpaid) are covered without the sandbox. Step three: keep one or two real-sandbox smoke tests in a separate job whose failure raises an environment alert, not a red build. Step four: add a contract check (or periodic re-recording) so the stubs cannot drift. I'd communicate it as "the sandbox's instability no longer blocks releases, and we still learn within a day if the provider changes".

**2. The provider team renamed \`price\` to \`unitPrice\` in "a minor release"; two consumers broke in production.** Short term: revert or serve both fields. Then I'd propose Pact for the internal consumers: each consumer publishes the fields it uses, the provider verifies on every build, and \`can-i-deploy\` gates the release — the rename would have failed the provider's pipeline with "shopeasy-checkout expects \`price\`". For external consumers, an OpenAPI diff in CI that flags removed or renamed fields as breaking, and a versioning/deprecation policy (add the new field, mark the old one deprecated, remove after the sunset date). I'd also check the consumers are tolerant readers, so additive changes never break them.

**3. A new export endpoint returns 202. A colleague's test does \`Thread.sleep(30000)\` and still fails 1 in 10 runs.** The sleep is both too long (most exports finish in 3 s) and too short (under load some take 40 s). I'd replace it with Awaitility: poll the \`Location\` URL every second, stop on DONE or FAILED, \`atMost\` from configuration (say 90 s in CI), alias with the job id. When it still fails, the message now shows the last state; if jobs stay QUEUED, that is a capacity bug in the job workers, which I'd raise with the team rather than hide with a longer wait.

## Tricky follow-ups

**Q: \`urlEqualTo\` or \`urlPathEqualTo\`?** → \`urlEqualTo\` matches path **and** query string exactly; \`urlPathEqualTo\` matches only the path, with query params matched separately via \`withQueryParam\`. The second is less brittle to parameter order and extra parameters.

**Q: Does a Pact consumer test prove the provider works?** → No. It proves the consumer works against its own expectations. Only provider verification proves the provider satisfies them; a pact that is never verified is just a mock with extra steps.

**Q: Your Awaitility check passes even though the job failed. Why?** → The predicate waited for "not RUNNING" and the assertion after it was missing or checked the wrong field — always assert the terminal state explicitly after the wait.

**Q: A GraphQL query returns HTTP 200 with \`data: null\`. Is the test allowed to pass?** → Only if the test expects an error; then assert \`errors[0].extensions.code\` and \`path\`. A positive test must assert \`errors\` is absent first.

**Q: Why not just run 1,000 parallel REST Assured threads as a load test?** → No workload model or arrival rate, the client becomes the bottleneck, response times suffer from coordinated omission, and there are no percentile reports or server-side metrics. Use Gatling, k6 or JMeter for load; keep the thread burst as a concurrency smoke.
`,
  keyPoints: [
    'WireMock picks the highest-priority matching stub (newest wins on ties), records every request in a journal, and can delay, template, fault and change state — test retries, timeouts and idempotency keys on the wire, then verify attempts and headers from the journal.',
    'Use the JUnit 5 @WireMockTest extension or a per-class WireMockServer with instance methods in TestNG; random ports, no static DSL with multiple servers, no resetAll() on shared or parallel servers.',
    'Mocks drift: pair every stub with a source of truth — Pact verification, provider-generated stubs, or recordings refreshed on a schedule.',
    'Pact: consumer tests drive the real client against a mock and publish minimal pacts; the provider verifies them with named @State setups; can-i-deploy plus record-deployment gate releases. Schema validation stays as the cheap baseline.',
    'Async APIs: assert 202 + Location, then Awaitility with atMost from config, a poll interval and a terminal-state predicate; capture webhooks with a test receiver; never Thread.sleep.',
    'GraphQL errors usually arrive with HTTP 200 — assert that errors is absent before checking data; send variables separately; test depth limits, field auth and introspection exposure.',
    'Functional suites own timeouts (proved with /api/slow) and crude concurrency smoke; load, p95/p99, throughput and error rate belong to Gatling, k6 or JMeter in a controlled environment.',
    'POST is not idempotent (two ShopEasy POST /api/orders create two orders); test idempotency keys, pagination/sort invariants across pages, and backward compatibility with OpenAPI diffs and tolerant readers.',
  ],
  mistakes: [
    'Stubbing with urlEqualTo("/v1/charges") while the client adds a query parameter — WireMock returns 404 "Request was not matched" and the client reports a confusing error. Fix: read the near-miss diff (findNearMissesForAllUnmatched()), use urlPathEqualTo plus withQueryParam, equalToJson for bodies.',
    'Using the static WireMock DSL and resetAll() in a suite that runs parallel="methods" — one thread wipes another thread\'s stubs and tests fail randomly. Fix: one WireMockServer per test class with instance methods, per-test unique matching data (order id), no global reset on shared instances.',
    'Letting stubs become the only truth: the provider renames a field, all mocked tests stay green and production breaks. Fix: Pact provider verification (or bi-directional contracts / re-recorded stubs) and a can-i-deploy gate.',
    'Writing pacts that assert every field with exact values — the provider cannot change anything and the contract becomes a brittle end-to-end test. Fix: only the fields the consumer reads, type matchers by default, exact values only where the consumer branches (error codes, enums).',
    'Waiting for async work with Thread.sleep or until(() -> flag) — slow, flaky, and the failure says only "condition not met". Fix: Awaitility untilAsserted or until(callable, predicate) with an alias, atMost from config and a terminal-state predicate; assert the final state afterwards.',
    'Asserting response-time SLAs (lessThan(300L)) in the functional suite without a socket timeout — flaky on CI, and a hung server still blocks forever. Fix: client connect/read timeouts (prove them with /api/slow?ms=5000), a generous configurable ceiling, percentiles in Gatling or k6.',
  ],
  tryIt: `Start the API with \`npm run api\` (port 5181) and work through these in a scratch Maven project (JUnit 5 or TestNG, REST Assured 5, WireMock 3, Awaitility 4, AssertJ):

1. **Readiness**: write the Awaitility \`@BeforeSuite\` wait on \`GET /api/health\` with \`ignoreExceptions()\`. Run it before starting the API, then start it — the suite should continue within half a second of "UP".
2. **Timeout proof**: with a 1 s socket timeout, call \`/api/slow?ms=5000\` and assert \`SocketTimeoutException\`; then \`/api/slow?ms=200\` and assert \`delayedMs\` 200. Remove the timeout and watch the first test take 5 s — explain to yourself why \`time(lessThan(...))\` could never have saved you.
3. **Duplicate risk**: log in as \`standard_user\`, send the same \`POST /api/orders\` body (with \`items\`) twice and record both ids from the \`Location\` headers. Write down what an \`Idempotency-Key\` contract should change and draft the test matrix.
4. **WireMock**: implement a small client for an imaginary tax service (\`GET /v1/rates?country=IN\`) with a 500 ms timeout and one retry; test 200, 500→200 (scenario), \`withFixedDelay(2000)\` and \`Fault.EMPTY_RESPONSE\`, and verify the attempt count from the journal.
5. **Pact (stretch)**: write a consumer test for \`GET /api/products/2\` (Pulse Bike Light) using only the fields your client reads, then verify the generated pact against the running ShopEasy API with \`@PactFolder\` and a \`@State\` that calls \`POST /api/reset\`. Break it on purpose by expecting a field the API does not return and read the verifier's diff.`,
  problems: ['api-028', 'api-026', 'api-015'],
}
