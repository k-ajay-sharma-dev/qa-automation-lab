export default {
  slug: 'restassured-deep-internals-http',
  category: 'restassured',
  order: 12,
  title: 'Deep dive: how REST Assured works — request lifecycle, specifications, filters, config and HTTP semantics',
  minutes: 30,
  summary: 'Know what happens between given() and the socket — the DSL, the filter chain and Apache HttpClient underneath — so you can merge specifications safely, tune RestAssuredConfig (timeouts, object mapping, BigDecimal numbers, charsets, redirects, SSL, logging, connections), control URL encoding and serialisation, reason about HTTP methods, status codes, caching and CORS like a senior, write a production-grade traffic filter, and debug any failure from the log.',
  manualAnalogy: `When you test an API by hand in Postman you know the hidden machinery: the environment fills in the host, the collection adds the auth header, the pre-request script runs, the console shows the raw request, and the proxy settings decide where the traffic goes. REST Assured has the same machinery — specifications, filters, config and a real HTTP client — and when a test fails for a "mysterious" reason, it is almost always because one of those hidden layers did something you did not expect.`,
  body: `## Where the earlier lessons stop

The beginner lessons taught the DSL (*Your first RestAssured test*), matchers and the Float gotcha (*Asserting responses*), bodies and \`TypeRef\` (*Sending data*), specifications, a first filter, logging and timeouts (*From tests to a framework*, \`api-framework-design\`) and \`ThreadLocal\` isolation (*Running API tests in parallel*, \`api-parallel-and-isolation\`). The Playwright side is in \`pw-deep-api-testing\` (APIRequestContext vs REST Assured, Ajv/zod schemas), records + Jackson in \`java-deep-modern-java-9-to-21\`.

This lesson goes **under** the DSL: what REST Assured is made of, what happens to a request between \`given()\` and the socket, the precise rules for merging specifications, every config class you will touch in a real framework, and the HTTP semantics a senior is expected to reason about. Advanced response validation is the next lesson (\`restassured-deep-assertions-json-contracts\`); auth and security testing (\`restassured-deep-auth-security-testing\`), framework architecture (\`restassured-deep-api-framework-architecture\`) and Pact/WireMock/async/GraphQL (\`restassured-deep-advanced-api-testing\`) have their own deep dives.

Baseline: **REST Assured 5.x** (5.5.x), Java 17. Where newer major versions changed something important, it is called out — the library moved fast in 2025–2026.

## Architecture: what sits under given()

\`\`\`
your test                given().spec(base).body(order).when().post("/orders").then().statusCode(201)
   │
DSL layer                RequestSpecification / ResponseSpecification implementations
   │                     (in 5.x much of this is Groovy code; json-path/xml-path evaluate GPath with Groovy)
filter chain             your filters (ordered) → logging filters → auth filter → terminal "send" filter
   │
HTTP transport           Apache HttpClient 4.5.x (5.x line) — a new client per request by default
   │
socket / TLS             DNS, TCP connect, TLS handshake, proxy
   ▼
response                 RestAssuredResponse → ResponseSpecification validation (status, headers, body matchers)
                         body parsed lazily by JsonPath/XmlPath (GPath) or an ObjectMapper (as(...))
\`\`\`

Four facts that explain a lot of behaviour:

1. **It is a Java DSL over Groovy.** In 5.x the request/response specification implementations are largely Groovy classes, and the body paths you write (\`data.findAll { it.price > 20 }\`) are **Groovy GPath expressions evaluated at runtime**. That is why a typo in a path fails only when it runs, and why stack traces contain \`org.codehaus.groovy\` frames. (6.2.0 rewrote the core \`rest-assured\` module in pure Java; GPath in \`json-path\`/\`xml-path\` is still Groovy.)
2. **The transport is Apache HttpClient 4.5.x** in the 5.x line (4.5.13; 6.2.0 moved to 4.5.14). This is why timeouts are configured with HttpClient 4 parameter names, why wire logging uses the \`org.apache.http.wire\` logger, and why proxies and TLS are HttpClient settings. 7.0 (RC as of November 2026) drops HttpClient 4 and sends with the JDK's \`java.net.http.HttpClient\` by default, with an optional Apache HttpClient 5 module.
3. **Everything is a filter.** Logging (\`log().all()\` adds a \`RequestLoggingFilter\`/\`ResponseLoggingFilter\`), authentication (\`auth().preemptive()...\` installs an \`AuthFilter\`), session and cookie handling, and finally the actual send are links in one chain. Your custom filters are just more links.
4. **The default \`HttpClientConfig\` creates a new HttpClient per request and ignores cookies** (\`CookiePolicy.IGNORE_COOKIES\`). So nothing is shared between requests unless you ask for it (\`reuseHttpClientInstance()\`, \`SessionFilter\`, \`CookieFilter\`) — good for isolation, slightly slower.

| Version line | Java | Transport | Default JSON mapper preference | json-schema-validator engine |
|---|---|---|---|---|
| 5.x (5.5.0 Jul 2024 … 5.5.7 Jan 2026) | 8+ | Apache HttpClient 4.5.x | Jackson 2 → Jackson 1 → Gson → Johnzon → Yasson | java-json-tools 2.2.14 (draft-04/03) |
| 6.0 (Dec 2025) – 6.3 | 17+, Groovy 5 | Apache HttpClient 4.5.x | adds Jackson 3 support | 6.1.0: networknt, draft-06/07/2019-09/2020-12 chosen from \`$schema\` |
| 7.0 (RC1 Nov 2026) | 17+ | JDK HttpClient (Apache 5 optional) | prefers Jackson 3 when present; Jackson 1 removed | networknt 3.x |

## The request lifecycle, step by step

\`\`\`java
Order order = given()                                   // 1
        .spec(Specs.authed(token))                      // 2
        .body(new OrderRequest("Asha", "Rao", "560001"))// 3
    .when()
        .post("/orders")                                // 4–8
    .then()
        .statusCode(201)                                // 9
        .extract().as(Order.class);                     // 10
\`\`\`

1. **\`given()\`** creates a fresh \`RequestSpecification\` **seeded from the static defaults**: \`RestAssured.baseURI\`, \`port\`, \`basePath\`, \`RestAssured.config\`, \`RestAssured.filters(...)\`, and \`RestAssured.requestSpecification\` if set.
2. **\`spec(...)\`** merges another specification into it (rules in the next section).
3. **\`body(object)\`** stores the object; it is **not serialised yet**.
4. **\`post("/orders")\`** freezes the specification: base URI + base path + path, path parameters substituted and URL-encoded, query parameters appended.
5. The body is **serialised** with an object mapper chosen from the content type (Jackson 2 first in 5.x) and encoded with a charset from \`EncoderConfig\`.
6. The **filter chain** runs. Each filter gets the mutable \`FilterableRequestSpecification\` and calls \`ctx.next(...)\` to pass control on.
7. The **terminal filter** builds the HttpClient request (with the \`HttpClientConfig\` parameters, proxy, TLS from \`SSLConfig\`, redirects from \`RedirectConfig\`) and executes it. Connection refused or timeouts surface here as exceptions — **before** any assertion.
8. The response travels back **through the same filters in reverse** (code after \`ctx.next\`), so a filter can read, log, or replace it.
9. **\`then()\`** validates. Status and header expectations are cheap; body matchers trigger parsing: the response content type picks the parser (JSON/XML/HTML), JsonPath builds a Groovy object tree, each GPath expression is evaluated, numbers are typed according to \`JsonConfig\`.
10. **\`extract().as(Order.class)\`** deserialises with the object mapper — a different code path from GPath, with different number handling (the POJO's field type wins).

Seeing the order makes several "mysteries" obvious: a filter cannot see the JSON of a POJO body if it runs before serialisation; a timeout is never a matcher failure; GPath and \`as(...)\` can disagree about the type of the same number.

## Filters in depth

### The contract

\`\`\`java
public interface Filter {
    Response filter(FilterableRequestSpecification requestSpec,
                    FilterableResponseSpecification responseSpec,
                    FilterContext ctx);
}
\`\`\`

- **Before** \`ctx.next(requestSpec, responseSpec)\`: mutate the request — \`header(...)\`, \`replaceHeader\`, \`removeHeader\`, \`queryParam\`, \`removeQueryParam\`, \`path(...)\`, \`body(...)\`, cookies.
- **\`ctx.next(...)\`** invokes the rest of the chain and eventually the network; it returns the \`Response\`.
- **After**: inspect, log, record, or return a **different** response (e.g. \`new ResponseBuilder().clone(response).setBody(...).build()\` to fix a broken content type from a legacy service). Not calling \`ctx.next\` short-circuits the request — useful for a stub, dangerous by accident.
- The request is queryable through \`QueryableRequestSpecification\`: \`getMethod()\`, \`getURI()\`, \`getBaseUri()\`, \`getBasePath()\`, \`getUserDefinedPath()\`, \`getHeaders()\`, \`getBody()\`, \`getQueryParams()\`, \`getConfig()\`, \`getDefinedFilters()\`, \`getProxySpecification()\`.

### Ordering

\`OrderedFilter extends Filter\` adds \`int getOrder()\`. **Lower value = higher priority = runs earlier** (closer to the test, further from the network). Constants: \`HIGHEST_PRECEDENCE\` (\`Integer.MIN_VALUE\`), \`DEFAULT_PRECEDENCE\` (1000), \`LOWEST_PRECEDENCE\` (\`Integer.MAX_VALUE\`). Equal values sort arbitrarily — never rely on registration order between two filters with the same order.

Why it matters: a request-logging filter logs the request **as it is at its position in the chain**. If a token filter that runs later adds \`Authorization\`, the log does not show it — and you will chase a "missing header" that was actually sent. Conversely, a correlation-id filter must run before logging if you want the id in the log.

\`AuthFilter\` is a marker interface: filters implementing it are removed when a test writes \`given().auth().none()\` — the clean way to let one negative test opt out of a token filter.

### Complete example: correlation id + timing + masked logging

The beginner lesson showed a 10-line \`CorrelationIdFilter\`. A framework-grade version has to: never override a header the test set on purpose, measure time including failures, log a compact line for every call and full (masked) detail only when something went wrong, and link our id with the server's id. ShopEasy generates its own \`X-Request-Id\` (\`req-00001\`, …) on every response and does **not** echo client ids, so we log both.

\`\`\`java
package com.shopeasy.api.filters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.restassured.filter.FilterContext;
import io.restassured.filter.OrderedFilter;
import io.restassured.http.Header;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** One log line per call; masked request/response detail for 4xx/5xx, slow calls and transport errors. */
public final class TrafficFilter implements OrderedFilter {

    public static final String CORRELATION_HEADER = "X-Correlation-Id";
    private static final Logger LOG = LoggerFactory.getLogger(TrafficFilter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> SECRET_HEADERS = Set.of("authorization", "proxy-authorization", "cookie", "set-cookie");
    private static final Set<String> SECRET_FIELDS = Set.of("password", "token", "accesstoken", "refreshtoken");

    private final long slowThresholdMs;

    public TrafficFilter(long slowThresholdMs) {
        this.slowThresholdMs = slowThresholdMs;
    }

    @Override
    public int getOrder() {
        return HIGHEST_PRECEDENCE + 100;   // early: the correlation id exists before any logging filter runs
    }

    @Override
    public Response filter(FilterableRequestSpecification req,
                           FilterableResponseSpecification resSpec,
                           FilterContext ctx) {
        if (!req.getHeaders().hasHeaderWithName(CORRELATION_HEADER)) {     // a test may set its own on purpose
            req.header(CORRELATION_HEADER, "qa-" + UUID.randomUUID());
        }
        String correlationId = req.getHeaders().getValue(CORRELATION_HEADER);
        long start = System.nanoTime();

        Response response;
        try {
            response = ctx.next(req, resSpec);                            // the rest of the chain + the network
        } catch (RuntimeException transportFailure) {                     // connection refused, read timeout, TLS
            LOG.error("{} {} corr={} FAILED after {} ms: {}", req.getMethod(), req.getURI(),
                    correlationId, elapsedMs(start), transportFailure.toString());
            LOG.error("request headers: {}", maskedHeaders(req.getHeaders().asList()));
            throw transportFailure;                                       // never swallow: the test must fail
        }

        long ms = elapsedMs(start);
        LOG.info("{} {} -> {} in {} ms corr={} server={}", req.getMethod(), req.getURI(),
                response.statusCode(), ms, correlationId, response.getHeader("X-Request-Id"));

        if (response.statusCode() >= 400 || ms > slowThresholdMs) {
            LOG.warn("request headers: {}", maskedHeaders(req.getHeaders().asList()));
            LOG.warn("request body: {}", maskJson(bodyAsText(req.getBody())));
            LOG.warn("response headers: {}", maskedHeaders(response.getHeaders().asList()));
            LOG.warn("response body: {}", maskJson(response.asString()));
        }
        return response;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private static String maskedHeaders(List<Header> headers) {
        return headers.stream()
                .map(h -> h.getName() + ": "
                        + (SECRET_HEADERS.contains(h.getName().toLowerCase(Locale.ROOT)) ? "***" : h.getValue()))
                .collect(Collectors.joining(" | "));
    }

    private static String bodyAsText(Object body) {
        if (body == null) return "";
        if (body instanceof byte[] bytes) return new String(bytes, StandardCharsets.UTF_8);
        return body.toString();
    }

    static String maskJson(String text) {
        if (text == null || text.isBlank()) return "<empty>";
        try {
            JsonNode tree = MAPPER.readTree(text);
            mask(tree);
            return tree.toString();
        } catch (JsonProcessingException notJson) {
            return "<non-JSON body, " + text.length() + " chars>";      // never dump unknown content verbatim
        }
    }

    private static void mask(JsonNode node) {
        if (node.isObject()) {
            ObjectNode object = (ObjectNode) node;
            List<String> names = new ArrayList<>();
            object.fieldNames().forEachRemaining(names::add);
            for (String name : names) {
                if (SECRET_FIELDS.contains(name.toLowerCase(Locale.ROOT))) {
                    object.put(name, "***");
                } else {
                    mask(object.get(name));
                }
            }
        } else if (node.isArray()) {
            node.forEach(TrafficFilter::mask);
        }
    }
}
\`\`\`

Register it once in the base specification:

\`\`\`java
RequestSpecification base = new RequestSpecBuilder()
        .setBaseUri("http://localhost:5181")
        .setBasePath("/api")
        .setContentType(ContentType.JSON)
        .setAccept(ContentType.JSON)
        .addFilter(new TrafficFilter(2_000))
        .build();
\`\`\`

**Step by step**

- **\`OrderedFilter\` with a very low order** puts the correlation id on the request before logging or token filters see it.
- **\`hasHeaderWithName\` guard** — a test that wants to check "the server accepts my correlation id" or send a malformed one can still do so. The same rule applies to token filters (practised in api-027).
- **\`try/catch\` around \`ctx.next\`** — transport failures never reach \`then()\`; without this the log shows nothing about the call that hung. The exception is rethrown unchanged.
- **One INFO line per call** is cheap and searchable: method, URI, status, time, our id, the server's id. A developer can grep server logs for \`req-00042\`.
- **Full detail only for 4xx/5xx or slow calls** — a 200-test suite does not produce 30 MB of logs, but the failing call is fully described. (For expected negative tests, the 4xx detail is noise; teams often log 4xx at DEBUG and 5xx at WARN.)
- **Masking by structure, not regex** — the login body \`{ "username": "standard_user", "password": "secret_sauce" }\` and the login response's \`token\` become \`"***"\`; a non-JSON body is summarised instead of dumped.
- **\`getBody()\` handling** — depending on how the body was given (String, byte[], POJO), the stored value differs; converting defensively keeps the filter from throwing. A filter must never be the reason a test fails.

**Real project scenario (ShopEasy):** on a typical e-commerce project, a nightly run shows "\`POST /api/orders\` → 500" once a week. With this filter the failure log already has the masked request body, the response body, and \`server=req-01873\`; the backend developer finds the stack trace in seconds, instead of the tester re-running the suite with \`log().all()\` for a day.

### Filters vs other places for cross-cutting code

| Approach | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| Filter on the base spec | runs around every request built from the spec | one place, sees request + response, works for every client | must be careful not to assert or swallow | correlation ids, tokens, masked logging, report attachment (\`AllureRestAssured\`) |
| \`RestAssured.filters(...)\` (static) | global list applied to every \`given()\` | zero wiring | global mutable state, leaks across tests and threads | small single-threaded suites only |
| Wrapper method in a client class | each client method adds headers/logging | explicit | easy to forget in a new client, duplicates code | behaviour that belongs to one resource |
| TestNG/JUnit listener | after the test, attaches evidence | knows test name and result | cannot see individual requests unless a filter recorded them | combine with a recording filter |

**Recommended approach and why:** filters registered on an immutable base specification, plus a test listener that attaches what a recording filter captured. The filter sees every request; the listener knows which test failed.

## Specifications: how they merge, and the static-state trap

### Where settings can come from

| Source | Scope | Example |
|---|---|---|
| Static fields on \`RestAssured\` | JVM-wide, every \`given()\` | \`RestAssured.baseURI\`, \`port\`, \`basePath\`, \`config\`, \`requestSpecification\`, \`responseSpecification\`, \`filters(...)\`, \`proxy\` |
| \`RequestSpecBuilder\` → \`spec(...)\` | wherever the spec is used | base, authed, admin specs |
| Inline DSL calls | one request | \`.header(...)\`, \`.queryParam(...)\`, \`.config(...)\` |

### Merge rules (from \`RequestSpecBuilder.addRequestSpecification\`, same for \`given().spec(...)\`)

| Overwritten (last one wins) | Merged (both kept) |
|---|---|
| port, authentication scheme, content type, request body | parameters (query/form/path), cookies, headers, filters |

Two refinements:
- Headers merge **by default**, except \`Content-Type\` and \`Accept\`, which \`HeaderConfig\` overwrites by default. A spec that adds \`X-Tenant: eu\` and an inline \`.header("X-Tenant", "us")\` produce **two** \`X-Tenant\` headers — many servers take the first. Use \`HeaderConfig.headerConfig().overwriteHeadersWithName("X-Tenant")\` or \`replaceHeader\` in a filter.
- Filters merge, so applying the same spec twice (or a spec built on a base that already has the filter) registers the filter **twice**: double logging, two correlation ids. Build specs in a tree (base → authed), never by applying both.

### The static-state trap

\`RestAssured.baseURI\`, \`RestAssured.config\`, \`RestAssured.requestSpecification\` and \`RestAssured.filters(...)\` are plain static fields. In a parallel run:

\`\`\`java
@BeforeMethod
public void login() {
    String token = AuthClient.tokenFor("standard_user", "secret_sauce");
    RestAssured.requestSpecification = new RequestSpecBuilder()          // DON'T: thread B overwrites thread A's token
            .addHeader("Authorization", "Bearer " + token).build();
}
\`\`\`

Thread A's test runs with thread B's token: a cart test sees another customer's cart, or a 403 \`FORBIDDEN\` on \`GET /api/orders/{id}\` that "only happens in CI". A static \`RestAssured.config\` change in one test (say, \`followRedirects(false)\`) silently applies to every test that runs after it, in any thread.

\`\`\`java
public final class Specs {
    private static final RequestSpecification BASE = new RequestSpecBuilder()
            .setBaseUri(Env.apiBaseUri())
            .setBasePath("/api")
            .setContentType(ContentType.JSON)
            .setAccept(ContentType.JSON)
            .setConfig(ApiConfig.DEFAULT)                    // immutable RestAssuredConfig, built once
            .addFilter(new TrafficFilter(2_000))
            .build();

    private Specs() { }

    public static RequestSpecification base() {
        return BASE;                                         // never mutated after class init
    }

    public static RequestSpecification authed(String token) {
        return new RequestSpecBuilder()
                .addRequestSpecification(BASE)
                .addHeader("Authorization", "Bearer " + token)
                .build();                                    // a new object per test: nothing shared
    }
}
\`\`\`

| | Global (\`RestAssured.*\` statics) | Per-test spec passed into clients |
|---|---|---|
| How it works | every \`given()\` copies the statics | each test builds/receives its own spec |
| Advantages | zero wiring, short tests | thread-safe, explicit, two environments in one run possible |
| Disadvantages | races in parallel, order-dependent tests, hidden coupling | a few more lines; clients need a constructor parameter |
| Performance | same | same (specs are cheap objects) |
| Maintainability | "who changed the config?" debugging | changes are local and visible |
| Scalability | breaks with parallel methods | scales to any thread count |
| When to use | a 20-test single-threaded smoke suite | everything else |

**Recommended approach and why:** immutable static **constants** (base spec, \`RestAssuredConfig\`) are fine — constants are not state. Anything per test (token, user, tenant) goes into a spec built per test and passed into clients. If you must touch statics (legacy suite), set them once in \`@BeforeSuite\` and call \`RestAssured.reset()\` in \`@AfterSuite\`. See \`api-parallel-and-isolation\` for the \`ThreadLocal\` side.

## RestAssuredConfig in depth

\`RestAssuredConfig\` is an **immutable** aggregate of sub-configs. Every \`with\`-style call returns a new object, so a config built once in a constant is thread-safe. Apply it via \`RequestSpecBuilder.setConfig(...)\`, \`given().config(...)\` or (globally) \`RestAssured.config = ...\`.

| Method on RestAssuredConfig | Config class | Typical use |
|---|---|---|
| \`httpClient(...)\` | \`HttpClientConfig\` | timeouts, client reuse, custom client factory |
| \`connectionConfig(...)\` | \`ConnectionConfig\` | close idle connections after each response |
| \`objectMapperConfig(...)\` | \`ObjectMapperConfig\` | Jackson vs Gson, custom \`ObjectMapper\` |
| \`jsonConfig(...)\` | \`JsonConfig\` | number types for GPath (\`BIG_DECIMAL\`) |
| \`encoderConfig(...)\` / \`decoderConfig(...)\` | \`EncoderConfig\` / \`DecoderConfig\` | request charset, content-type encoders / response decoding |
| \`redirect(...)\` | \`RedirectConfig\` | follow or not, max redirects |
| \`sslConfig(...)\` | \`SSLConfig\` | trust store, key store (mTLS), relaxed validation |
| \`logConfig(...)\` | \`LogConfig\` | blacklisted headers, log-if-validation-fails, pretty printing, stream |
| \`headerConfig(...)\` | \`HeaderConfig\` | which headers overwrite vs merge |
| \`sessionConfig\`, \`paramConfig\`, \`failureConfig\`, \`matcherConfig\`, \`multiPartConfig\`, \`csrfConfig\`, \`oauthConfig\`, \`xmlConfig\` | … | less common; know they exist |

### Complete example: one framework config

\`\`\`java
package com.shopeasy.api.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.restassured.config.ConnectionConfig;
import io.restassured.config.EncoderConfig;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.JsonConfig;
import io.restassured.config.LogConfig;
import io.restassured.config.ObjectMapperConfig;
import io.restassured.config.RedirectConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.filter.log.LogDetail;
import io.restassured.path.json.config.JsonPathConfig;

public final class ApiConfig {

    /** Shared Jackson mapper: thread-safe once configured, so one instance for the whole run. */
    public static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())                                   // Instant, LocalDate, OffsetDateTime
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)           // ISO-8601 strings, not epoch numbers
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)        // functional DTOs tolerate new fields
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)         // Map/Object targets get BigDecimal
            .build();

    public static final RestAssuredConfig DEFAULT = RestAssuredConfig.config()
            .httpClient(HttpClientConfig.httpClientConfig()
                    .setParam("http.connection.timeout", Env.connectTimeoutMs())   // TCP connect (HttpClient 4)
                    .setParam("http.socket.timeout", Env.readTimeoutMs()))         // max silence while reading
            .connectionConfig(ConnectionConfig.connectionConfig()
                    .closeIdleConnectionsAfterEachResponse())
            .objectMapperConfig(ObjectMapperConfig.objectMapperConfig()
                    .jackson2ObjectMapperFactory((type, charset) -> MAPPER))
            .jsonConfig(JsonConfig.jsonConfig()
                    .numberReturnType(JsonPathConfig.NumberReturnType.BIG_DECIMAL))
            .encoderConfig(EncoderConfig.encoderConfig()
                    .defaultContentCharset("UTF-8"))
            .redirect(RedirectConfig.redirectConfig()
                    .followRedirects(false))                                   // assert 3xx explicitly
            .logConfig(LogConfig.logConfig()
                    .blacklistHeader("Authorization", "Cookie", "Set-Cookie")
                    .enableLoggingOfRequestAndResponseIfValidationFails(LogDetail.ALL));

    private ApiConfig() { }
}
\`\`\`

The pieces, one by one:

### HttpClientConfig: timeouts and client reuse

- In 5.x, parameters are **Apache HttpClient 4 parameter names** set with \`setParam\`: \`"http.connection.timeout"\` (\`CoreConnectionPNames.CONNECTION_TIMEOUT\`, time to establish TCP) and \`"http.socket.timeout"\` (\`SO_TIMEOUT\`, maximum time **between packets** while waiting/reading — not a total request deadline). Values are milliseconds (\`int\`).
- **Default: no timeout.** A hung endpoint hangs the test until CI kills the job. ShopEasy's \`GET /api/slow?ms=5000\` with a 3000 ms socket timeout throws \`java.net.SocketTimeoutException: Read timed out\` — from \`when()\`, not from a matcher.
- The default config **does not reuse** the HttpClient instance; \`reuseHttpClientInstance()\` keeps one client (and its connection pool) — only safe if you understand that cookies and connections are then shared.
- Defaults applied by REST Assured: cookie policy \`IGNORE_COOKIES\` and lenient cookie date patterns.
- **Version note:** 6.3.0 added \`connectTimeout(Duration)\`, \`readTimeout(Duration)\` and \`connectionRequestTimeout(Duration)\` and deprecated the parameter methods; 7.0 rejects HttpClient 4 parameters it no longer reads with an \`IllegalArgumentException\` (the two timeout names are still mapped). Hide timeout configuration in one class so a major upgrade touches one file.

### ObjectMapperConfig: Jackson vs Gson

When serialising a body with a JSON content type, 5.x picks the first mapper on the classpath in this order: **Jackson 2 → Jackson 1 → Gson → Johnzon → Yasson (JSON-B)**; with no content type at all, JAXB/Jakarta EE are also candidates. The same order is used to deserialise JSON responses. Two consequences:

- A transitive dependency that drags in Jackson 1 or Gson does not change the mapper while Jackson 2 is present — but removing Jackson 2 (or, from 7.0, adding Jackson 3) silently changes how dates, nulls and unknown fields behave. Pin the choice: \`ObjectMapperConfig.objectMapperConfig().defaultObjectMapperType(ObjectMapperType.JACKSON_2)\`.
- REST Assured's default Jackson 2 mapper is \`new ObjectMapper().findAndRegisterModules()\`: \`jackson-datatype-jsr310\` on the classpath is picked up automatically, but \`FAIL_ON_UNKNOWN_PROPERTIES\` stays **on** and dates are written as timestamps. Supplying your own factory (\`jackson2ObjectMapperFactory((type, charset) -> MAPPER)\`) makes the behaviour explicit.

| | Jackson 2 | Gson |
|---|---|---|
| How it works | annotations (\`@JsonProperty\`, \`@JsonIgnoreProperties\`, \`@JsonInclude\`), modules | reflection on fields, \`@SerializedName\`, \`GsonBuilder\` |
| Advantages | default in REST Assured and Spring, records (2.12+), java.time via module, rich features | small, simple, no annotations needed |
| Disadvantages | many knobs; unknown fields fail by default | records only from 2.10; java.time needs adapters; serialises nulls only if asked |
| Performance | fast, streaming | fast for small payloads |
| Maintainability | annotations live on DTOs; one shared mapper config | adapters scattered |
| When to use | default for test frameworks, especially if devs use Jackson | when the product's own client library is Gson-based and you share DTOs |

**Recommended approach and why:** Jackson 2 with one explicitly configured \`ObjectMapper\` shared by REST Assured and your own code (test-data builders, snapshot files). One mapper means the JSON you write to a golden file is byte-for-byte how the test serialises requests.

### JsonConfig: number types for GPath

GPath numbers default to \`FLOAT_AND_DOUBLE\`: \`9.99\` becomes \`Float\`, which is why \`equalTo(9.99)\` fails (*Asserting responses*). Other values: \`DOUBLE\`, \`BIG_DECIMAL\`, \`BIG_INTEGER\` (integers). With \`BIG_DECIMAL\`, decimals become \`BigDecimal\` — but **integers stay \`Integer\`**. ShopEasy computes money in JavaScript and serialises \`4\` for a tax of 4.00, so \`body("tax", equalTo(new BigDecimal("4.00")))\` fails on type *and* scale. The next lesson handles money assertions properly; the short version: deserialise to \`BigDecimal\` fields and compare with \`compareTo\`.

\`JsonConfig\` affects GPath only; \`as(Order.class)\` uses the field types of \`Order\`.

### EncoderConfig: request charsets

Verified defaults in 5.x: default content charset **ISO-8859-1**, query parameter charset UTF-8, and **\`application/json\` alone is mapped to UTF-8**. The charset is appended to \`Content-Type\` when you did not specify one (\`appendDefaultContentCharsetToContentTypeIfUndefined\`, default \`true\`). The lookup is an exact match on the content type, so:

- \`ContentType.JSON\` → \`application/json; charset=UTF-8\` — fine.
- \`application/merge-patch+json\`, \`application/vnd.shopeasy.v2+json\` or \`text/plain\` → \`charset=ISO-8859-1\`. A customer name like "Zoë" or "Łukasz" turns into mojibake on the server. Fix: \`defaultContentCharset("UTF-8")\` or \`defaultCharsetForContentType("UTF-8", "application/merge-patch+json")\`.
- Some strict servers reject \`; charset=...\` on JSON (RFC 8259 says JSON has no charset parameter): \`appendDefaultContentCharsetToContentTypeIfUndefined(false)\`.
- \`encodeContentTypeAs("application/vnd.shopeasy.v2+json", ContentType.JSON)\` makes a custom type use the JSON serializer.

### RedirectConfig

Defaults: \`followRedirects\` **true**, \`maxRedirects\` 100, circular redirects not allowed, relative redirects accepted. When redirects are followed, your assertions see the **final** response: a broken \`301\` to a login page that returns 200 HTML passes \`statusCode(200)\`. In API suites, turn following off and assert the hop explicitly (*typical real app* — ShopEasy has no redirects):

\`\`\`java
given().spec(Specs.base())
       .config(ApiConfig.DEFAULT.redirect(RedirectConfig.redirectConfig().followRedirects(false)))
.when().get("/v1/products/1")                      // deprecated version path
.then().statusCode(308)                             // permanent, keeps method and body
       .header("Location", endsWith("/v2/products/1"));
\`\`\`

### SSLConfig and relaxedHTTPSValidation

\`relaxedHTTPSValidation()\` — per the javadoc, "trust all hosts regardless if the SSL certificate is invalid". It turns off the very check that catches an expired certificate, a wrong hostname or a man-in-the-middle proxy.

| Environment | Do |
|---|---|
| local, self-signed dev certificate | \`relaxedHTTPSValidation()\` acceptable, ideally only via a \`-Dinsecure=true\` switch |
| shared QA/staging with company CA | \`SSLConfig.sslConfig().trustStore("certs/company-ca.jks", password)\` — validate properly |
| prod-like / pre-prod, smoke after deploy | full validation; a certificate problem **is** a release blocker you want to catch |
| mutual TLS | \`keyStore(...)\` for the client certificate + trust store |

\`allowAllHostnames()\` similarly disables hostname verification. Both are tempting "fixes" for \`SSLHandshakeException: PKIX path building failed\`; the real fix is the trust store.

### LogConfig

- \`blacklistHeader("Authorization", ...)\` — the value is printed as \`HIDDEN\`; matching is case-insensitive since 5.3.2. \`blacklistDefaultSensitiveHeaders()\` adds \`Authorization\`, \`Proxy-Authorization\`, \`Cookie\`. Nothing is blacklisted by default.
- \`enableLoggingOfRequestAndResponseIfValidationFails(LogDetail.ALL)\` — the config form of \`RestAssured.enableLoggingOfRequestAndResponseIfValidationFails()\`; logs only when a \`then()\` expectation fails.
- Blacklisting covers **headers**, not bodies: the login request body with \`"password"\` is still printed. That is the gap the \`TrafficFilter\` closes.
- \`enablePrettyPrinting(false)\` and \`defaultStream(printStream)\` (route logs into your logger or report instead of \`System.out\`).

### ConnectionConfig

\`closeIdleConnectionsAfterEachResponse()\` (or \`...After(idleTime, unit)\`) closes idle pooled connections; the javadoc recommends it for many consecutive requests with small bodies. Symptom it fixes: sporadic \`NoHttpResponseException\` / "connection reset" on a long suite against a server or load balancer that closes keep-alive connections earlier than the client expects.

## URL encoding and path parameters

REST Assured URL-encodes path parameters, query parameters and form parameters **by default**. The rules that bite:

- **Do not pre-encode.** \`queryParam("q", "crew%20t-shirt")\` is encoded again: the server receives \`%2520\` and searches for the literal text \`%20\`. Pass raw values; let the library encode.
- **When the value is already encoded** (a \`next\` link from a paged response, a signed URL), turn encoding off for that request: \`given().urlEncodingEnabled(false)\` (or \`RequestSpecBuilder.setUrlEncodingEnabled(false)\`), then you own every special character.
- **Use \`pathParam\`/positional arguments, never string concatenation**: \`get("/products/{id}", id)\` encodes; \`get("/products/" + id)\` with \`id = "1 OR 1=1"\` produces a URL nobody intended.
- Characters worth a negative test: space, \`+\`, \`&\`, \`#\`, \`/\`, \`%\`, Unicode. \`GET /api/products?q=T-Shirt\` and \`?q=t-shirt\` must return the same (ShopEasy lower-cases \`q\`); \`/api/products/abc\` gives \`400 INVALID_ID\`, \`/api/products/999\` gives \`404 PRODUCT_NOT_FOUND\` — a different class of error, so a different test.
- \`LogConfig.urlEncodeRequestUri(false)\` shows the *unencoded* URI in logs — handy when reading logs, misleading when debugging encoding; know which one you are looking at.

## Serialisation and deserialisation in depth

| Body / target type | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| \`Map<String, Object>\` | Jackson writes keys as-is | flexible; easy to omit or break a field for negative tests | no compile-time safety; typos survive | negative tests, quick probes |
| POJO class (getters/setters or fields) | Jackson bean introspection | builders, defaults, inheritance | boilerplate | large mutable payloads with builders |
| \`record\` (Jackson 2.12+) | canonical constructor as creator | immutable, concise, \`equals\` for free | every component required in \`new\`; no partial objects | default for responses and fixed requests |
| \`String\` / text block | sent verbatim | exact bytes, invalid JSON possible | brittle, escaping | malformed-JSON negative tests (\`400 INVALID_JSON\`) |

Detail that matters at senior level:

- **Names:** \`@JsonProperty("postal_code")\` when the API uses snake_case for one field; a global \`PropertyNamingStrategies.SNAKE_CASE\` on the mapper when it is consistent.
- **Unknown fields:** ShopEasy products carry \`slug\` and \`description\`; a \`Product\` record without them fails with \`UnrecognizedPropertyException: Unrecognized field "slug" ... not marked as ignorable\` under the default REST Assured mapper. Choose deliberately: tolerant DTOs (\`@JsonIgnoreProperties(ignoreUnknown = true)\` or the global feature) for functional tests, and a **schema** with \`additionalProperties: false\` to catch contract drift (next lesson). Strict DTOs make every additive backend change break 50 tests.
- **Nulls in requests:** Jackson writes \`null\` components by default. A partial-update record \`UserPatch(String firstName, String lastName, String email, String phone)\` with only \`phone\` set sends \`"firstName": null, ...\` — ShopEasy's \`PATCH /api/users/1\` answers **400 \`VALIDATION_FAILED\`** ("firstName must be a string"). Fix: \`@JsonInclude(JsonInclude.Include.NON_NULL)\` on PATCH DTOs (or a \`Map\`). For a typical real app, \`null\` in a JSON Merge Patch means "delete this field" — even worse.
- **Absent vs null in responses:** a record cannot tell "field missing" from "field null"; if that difference is part of the contract, assert it with GPath (\`hasKey\`) or a schema.
- **Dates:** ShopEasy's \`createdAt\` is an ISO-8601 UTC string (\`2026-11-20T09:15:02.311Z\`). Map it to \`Instant\` (or \`OffsetDateTime\`) with \`JavaTimeModule\`; never to \`LocalDateTime\` (drops the zone) or \`Date\`. Serialise dates as strings (\`WRITE_DATES_AS_TIMESTAMPS\` off).
- **Numbers:** a \`BigDecimal\` field reads \`29.99\` exactly from the JSON text; a \`double\` field does not. For \`Map\` targets, \`USE_BIG_DECIMAL_FOR_FLOATS\` gives \`BigDecimal\` instead of \`Double\`.
- **Wrapper responses:** \`GET /api/products\` returns \`{ data, page, size, total, totalPages }\`; \`as(new TypeRef<List<Product>>() {})\` on it fails with \`MismatchedInputException: Cannot deserialize value of type ArrayList from Object value\`. Deserialise the wrapper, or \`extract().jsonPath().getList("data", Product.class)\`.

## HTTP semantics at senior depth

### Methods

| Method | Safe | Idempotent | ShopEasy example | Testing consequence |
|---|---|---|---|---|
| GET | yes | yes | \`/api/products\`, \`/api/cart\` | repeatable; no side effects to clean up |
| HEAD / OPTIONS | yes | yes | \`OPTIONS\` (CORS preflight) → 204 | metadata only |
| POST | no | no | \`/api/orders\` creates order 1001, then 1002 | retries create duplicates — a client retry policy on POST needs an idempotency key (*typical real app*) |
| PUT | no | yes | \`/api/users/1\` full replace | same request twice → same state |
| PATCH | no | not guaranteed | \`/api/users/1\` partial merge | idempotent here (set phone), not for "increment" semantics |
| DELETE | no | yes (state) | \`/api/cart/items/2\` → 204, again → 404 \`ITEM_NOT_IN_CART\` | the **state** is the same; the status may differ — both are correct |

Idempotency is about server state, not identical responses — the beginner lesson's ShopEasy example (\`api-sending-data\`) shows it; the senior point is the consequence for **retries**: a framework that retries on timeout must only retry idempotent methods, or it double-orders.

### Status codes that matter

| Code | Meaning | ShopEasy / typical | What to assert |
|---|---|---|---|
| 200 | OK with body | \`GET /api/products/1\` | body |
| 201 | created | \`POST /api/orders\`, \`POST /api/users\`, \`POST /api/cart/items\` | \`Location\` (\`/api/orders/{id}\`), body = created resource |
| 202 | accepted, processing later | *typical real app*: report export, payment capture | status URL in \`Location\`; poll it (\`restassured-deep-advanced-api-testing\` covers Awaitility) |
| 204 | success, no body | \`DELETE /api/cart\`, \`DELETE /api/cart/items/{id}\` | empty body, **no** JSON parsing |
| 301/302/303/307/308 | redirects | *typical*: 301/308 permanent, 302/307 temporary; 307/308 keep method + body, 303 switches to GET | with following off: status + \`Location\` |
| 304 | not modified | *typical* with \`If-None-Match\` | empty body |
| 400 | malformed / failed validation | \`INVALID_JSON\`, \`VALIDATION_FAILED\` with \`details\`, \`INVALID_QUERY\`, \`INVALID_ID\` | \`error.code\` + field |
| 401 | not authenticated | \`UNAUTHORIZED\` + \`WWW-Authenticate: Bearer realm="shopeasy"\`; \`INVALID_CREDENTIALS\` | header too |
| 403 | authenticated, not allowed | \`USER_LOCKED\`, \`FORBIDDEN\` (another user's order) | code, no data leak in body |
| 404 | no such resource / route | \`PRODUCT_NOT_FOUND\`, \`ROUTE_NOT_FOUND\` | which 404 it is |
| 405 | method not supported here | \`PUT /api/orders\` → \`Allow: GET, POST\` | \`Allow\` header |
| 409 | conflicts with current state | \`ITEM_ALREADY_IN_CART\`, \`USERNAME_TAKEN\` | state unchanged afterwards |
| 412 | precondition failed | *typical*: stale \`If-Match\` | resource not modified |
| 413 / 415 | too large / wrong media type | avatar upload: \`PAYLOAD_TOO_LARGE\`, \`UNSUPPORTED_MEDIA_TYPE\` | code |
| 422 | well-formed but violates a business rule | \`INVALID_QUANTITY\`, \`OUT_OF_STOCK\`, \`EMPTY_CART\`, \`INVALID_EMAIL\`, \`READ_ONLY_FIELD\` | code + field |
| 429 | rate limited | *typical*: \`Retry-After: 30\` | client waits; tests must not hammer |
| 500 | bug | \`INTERNAL_ERROR\` | never "expected" in a test |
| 503 | unavailable / overloaded | *typical*: during deploy, with \`Retry-After\` | health checks gate the suite |

ShopEasy is honest about the 400/422 split: syntax and required-field problems are 400, valid JSON breaking a business rule is 422. Teams disagree on that split; the senior move is to assert whatever the **API contract** says and raise inconsistencies between endpoints as bugs.

### Headers: Content-Type vs Accept, caching, optimistic locking

- **\`Content-Type\`** describes the body **you send** (and the server's body in the response); **\`Accept\`** says what you want back. Wrong \`Content-Type\` should give 415, unsatisfiable \`Accept\` 406. ShopEasy ignores both on its JSON endpoints (it parses any body as JSON and always answers JSON) — only the avatar upload enforces 415. Finding that is a legitimate observation to report, not something to "test around".
- **Caching** (*typical real app* — ShopEasy sends no caching headers): \`Cache-Control: no-store\` on personal data (\`/api/cart\`, \`/api/orders\`) is a security check; \`ETag\` + \`If-None-Match\` gives 304 for unchanged resources:

\`\`\`java
String etag = given().spec(spec).get("/products/{id}", 1)
        .then().statusCode(200).header("ETag", notNullValue())
        .extract().header("ETag");

given().spec(spec).header("If-None-Match", etag)
.when().get("/products/{id}", 1)
.then().statusCode(304).body(emptyString());
\`\`\`

- **Optimistic locking** (*typical*): read the \`ETag\`, send it back in \`If-Match\` on \`PUT\`; a second writer with the old ETag gets **412 Precondition Failed** and the resource is unchanged — the API-level test for "two admins edit the same product". Without it, the last write silently wins (lost update).

\`\`\`java
String v1 = given().spec(admin).get("/products/{id}", 4).then().extract().header("ETag");
given().spec(admin).header("If-Match", v1).body(priceChange("47.99")).put("/products/{id}", 4)
       .then().statusCode(200);
given().spec(otherAdmin).header("If-Match", v1).body(priceChange("45.99")).put("/products/{id}", 4)
       .then().statusCode(412);                                    // stale version rejected
\`\`\`

### CORS for testers

CORS is enforced **by browsers**, not servers. Before a cross-origin \`DELETE\` or a request with \`Authorization\`, the browser sends a **preflight** \`OPTIONS\` with \`Origin\`, \`Access-Control-Request-Method\` and \`Access-Control-Request-Headers\`; only if the response allows them does it send the real request, and it only exposes response headers listed in \`Access-Control-Expose-Headers\` to JavaScript.

REST Assured (like Postman and curl) is not a browser: it never sends a preflight and ignores CORS headers — which is why "it works in Postman but the web shop can't load products". To test CORS you simulate the browser:

\`\`\`java
given().baseUri("http://localhost:5181")
       .header("Origin", "http://localhost:5180")
       .header("Access-Control-Request-Method", "DELETE")
       .header("Access-Control-Request-Headers", "Authorization")
.when().options("/api/cart")
.then().statusCode(204)
       .header("Access-Control-Allow-Origin", "*")
       .header("Access-Control-Allow-Methods", containsString("DELETE"))
       .header("Access-Control-Allow-Headers", containsString("Authorization"));
\`\`\`

ShopEasy answers every \`OPTIONS\` with 204 and open CORS (\`*\`), and exposes \`Location\` and \`X-Request-Id\`. Note: \`Access-Control-Allow-Origin: *\` is not allowed together with credentials (cookies) — in a typical real app with cookie sessions, the server must echo a specific allowed origin, and a test with a **disallowed** \`Origin\` should not get it echoed back.

## Debugging REST Assured failures

### Logging strategies

| Strategy | How | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| \`log().all()\` on request and response | adds logging filters | see everything | huge CI logs, leaks secrets | one test, locally |
| \`log().ifValidationFails()\` / LogConfig equivalent | logs only on a failed expectation | clean logs, detail where needed | nothing for transport errors; no log when the test fails **after** \`then()\` (in Java asserts) | CI default |
| \`log().ifError()\` | response logging for status ≥ 400 | spots server errors | logs expected negative cases too | suites with few negative tests |
| Custom filter (\`TrafficFilter\`) | one line per call + masked detail on failure | correlation ids, timing, masking bodies, transport errors | code to own | framework default |
| Wire logging (\`org.apache.http.wire\`) | HttpClient 4 logs raw bytes | the truth on the wire: encoding, chunking, exact headers | very verbose, contains secrets | encoding/charset/proxy bugs only |
| Debugging proxy (mitmproxy, Charles, Fiddler, ZAP) | \`given().proxy("localhost", 8888)\` or \`RestAssured.proxy\` | inspect and replay with a UI | TLS needs the proxy's CA trusted | comparing with Postman/browser traffic |

**Recommended approach and why:** the custom filter plus \`ifValidationFails\` in CI; \`log().all()\` and wire logs only while reproducing locally. Wire logging for HttpClient 4 goes through Commons Logging — bridge it to SLF4J (\`jcl-over-slf4j\`) and enable it temporarily:

\`\`\`xml
<!-- logback-test.xml: only while debugging an encoding or proxy issue -->
<logger name="org.apache.http.wire" level="DEBUG"/>
<logger name="org.apache.http.headers" level="DEBUG"/>
\`\`\`

### Common errors and what they mean

| Symptom | Cause | How to find / fix |
|---|---|---|
| \`HttpHostConnectException ... Connection refused\` | nothing listening (API not started, wrong port/host) | \`curl http://localhost:5181/api/health\`; check \`baseUri\`/\`port\`; health-check in \`@BeforeSuite\` with a clear message |
| \`SocketTimeoutException: Read timed out\` | server silent longer than \`http.socket.timeout\` | correct behaviour if the endpoint hung; otherwise raise the timeout for that call only |
| \`ConnectTimeoutException\` | TCP connect too slow — firewall, VPN, wrong host | network, not the API |
| \`IllegalStateException: Expected response body to be verified as JSON, HTML or XML but ...\` (wording varies) | response has no or an unknown \`Content-Type\` and you used a body matcher | log the response; fix the server, or \`defaultParser(Parser.JSON)\` / \`RestAssured.registerParser("text/plain", Parser.JSON)\` as a documented workaround |
| \`Cannot deserialize value of type ... from Object value\` | target type does not match JSON shape (list vs wrapper) | deserialise the wrapper or use \`jsonPath().getList("data", T.class)\` |
| \`UnrecognizedPropertyException: Unrecognized field\` | strict mapper, new field in the response | tolerant DTOs + schema for drift |
| \`InvalidDefinitionException: Cannot construct instance of ...\` | POJO without default constructor or creator | add one, or use a record (Jackson 2.12+) |
| \`Cannot serialize object because no JSON serializer found in classpath\` | no Jackson/Gson dependency | add \`jackson-databind\` (test scope) |
| \`Expected <9.99> but was <9.99F>\` | GPath Float vs Java double | \`9.99f\` or \`BIG_DECIMAL\` + \`BigDecimal\` |
| 415 / garbled characters on the server | content type or charset wrong (ISO-8859-1 on a \`+json\` type) | wire log; \`EncoderConfig\` |
| 401 although "the token is set" | header added by a filter after logging, overwritten, or duplicated | log at the end of the chain; check \`getHeaders()\` in a filter; \`HeaderConfig\` |

## Equivalent in Playwright (TypeScript)

Playwright's \`APIRequestContext\` covers the same ground with a different model: config in \`playwright.config.ts\` (\`use.baseURL\`, \`extraHTTPHeaders\`, \`timeout\`, \`ignoreHTTPSErrors\` — the counterpart of \`relaxedHTTPSValidation\`), no filter chain (wrap the client or use fixtures for cross-cutting logic), and \`maxRedirects\` per request. Comparison and a decision table are in \`pw-deep-api-testing\`.

## Best practices for experienced engineers

- Build **one immutable \`RestAssuredConfig\`** and **one base spec** as constants; derive per-test specs; never mutate \`RestAssured.*\` statics inside tests.
- Always configure **connect and read timeouts**; keep them in one class so the 6.3/7.0 API changes touch one file.
- **Pin the object mapper** and share one Jackson \`ObjectMapper\` between REST Assured and the rest of the framework.
- Use **\`BigDecimal\`** for money in DTOs and GPath; know that integers stay \`Integer\`.
- Set **UTF-8 explicitly** for every JSON-ish content type; test a non-ASCII name once.
- **Do not follow redirects** in API tests; assert the 3xx and \`Location\`.
- Never ship \`relaxedHTTPSValidation\` into prod-like runs; use trust stores.
- One **traffic filter** for correlation ids, timing and masked logging; \`blacklistHeader\` alone does not mask bodies.
- Filters prepare and record; **assertions stay in tests**; filters never swallow exceptions.
- Keep DTOs tolerant and catch drift with schemas; use \`@JsonInclude(NON_NULL)\` for PATCH.
- Treat HTTP semantics as contract: \`Location\` on 201, \`Allow\` on 405, \`WWW-Authenticate\` on 401, \`Retry-After\` on 429/503, no body on 204.

## Interview questions

### Q: What happens internally when you call given().when().get() in REST Assured?

**Short answer (30–60 s):** \`given()\` creates a request specification seeded from the static defaults; specs and inline calls merge into it; on \`get()\` the URL is built and encoded, the body serialised, and the request passes through a chain of filters — logging, auth, my own — to a terminal filter that executes it with Apache HttpClient 4.5 in 5.x. The response comes back through the filters; \`then()\` validates status, headers and body via GPath.

**Detailed answer:** Stress the consequences: transport errors (connection refused, timeouts) throw from \`when()\`, never from matchers; filters see the request at their position in the chain (order matters for logging); GPath is Groovy evaluated at runtime with \`JsonConfig\` number types, while \`as(Class)\` uses Jackson and the DTO field types; the default \`HttpClientConfig\` creates a new client per request and ignores cookies. Mention the version picture: 6.x requires Java 17, 7.0 switches the transport to the JDK HttpClient.

### Q: How do specifications merge, and what overrides what?

**Short answer (30–60 s):** When a spec is merged, port, auth scheme, content type and body are overwritten by the later spec; parameters, cookies, headers and filters are merged. Inline calls after \`spec()\` follow the same idea. Headers merge except \`Content-Type\` and \`Accept\`, which overwrite by default.

**Detailed answer:** The traps: a header set in a spec and again inline is sent twice (configure \`HeaderConfig.overwriteHeadersWithName\`), and a filter in a base spec merged twice runs twice. Design specs as a tree — base → authed → admin — with each level built from the previous via \`addRequestSpecification\`. Static \`RestAssured.requestSpecification\` is the root of every \`given()\`, so anything there applies globally.

### Q: Why is RestAssured.requestSpecification dangerous in a parallel suite, and what do you do instead?

**Short answer (30–60 s):** It is a plain static field. If tests set per-test data (a token) there, threads overwrite each other: one test runs with another test's customer. I keep only immutable constants global and pass a per-test spec into clients.

**Detailed answer:** Show the \`Specs.base()\` constant and \`Specs.authed(token)\` factory. Explain that a \`RestAssuredConfig\` is immutable, so a config constant is safe, but **assigning** \`RestAssured.config\` mid-run is a global side effect. For legacy suites: set statics once in \`@BeforeSuite\`, \`RestAssured.reset()\` in \`@AfterSuite\`, and a \`ThreadLocal<RequestSpecification>\` for the token while migrating.

### Q: How do you configure timeouts in REST Assured, and what does each one mean?

**Short answer (30–60 s):** In 5.x via \`HttpClientConfig.setParam\` with HttpClient 4 names: \`http.connection.timeout\` for the TCP connect, \`http.socket.timeout\` for the maximum silence while waiting for or reading data. Without them a hung endpoint hangs the build.

**Detailed answer:** The socket timeout is not a total deadline — a server that trickles a byte every few seconds never times out; a total budget needs a wrapper (\`CompletableFuture.orTimeout\`) or the CI job timeout as the last line. Response-time assertions (\`time(lessThan(...))\`) are a different thing: they run after the response arrives. 6.3.0 added \`connectTimeout(Duration)\`/\`readTimeout(Duration)\`; keep the setting in one place.

### Q: Explain the Float gotcha and how JsonConfig solves — or doesn't fully solve — it.

**Short answer (30–60 s):** GPath parses decimals as \`Float\` by default, so \`equalTo(9.99)\` (a \`Double\`) fails. \`JsonConfig.numberReturnType(BIG_DECIMAL)\` makes decimals \`BigDecimal\`. But integers stay \`Integer\`: a JS backend that serialises 4.00 as \`4\` gives you an \`Integer\`.

**Detailed answer:** For money, prefer deserialising into DTOs with \`BigDecimal\` fields (Jackson reads the exact text) and comparing with \`compareTo\` or AssertJ \`isEqualByComparingTo\`. \`BigDecimal.equals\` compares scale (\`4.00\` ≠ \`4\`), so \`equalTo(new BigDecimal("4.00"))\` fails even with the right type. Details in \`restassured-deep-assertions-json-contracts\`.

### Q: Walk me through writing a custom filter. What must it never do?

**Short answer (30–60 s):** Implement \`Filter\` (or \`OrderedFilter\` for ordering), modify the request before \`ctx.next\`, inspect the response after, and return it. It must never assert, never swallow exceptions, never override headers the test set deliberately, and never log secrets.

**Detailed answer:** Walk through the \`TrafficFilter\`: correlation id with a presence guard, timing around \`ctx.next\` including the failure path, one INFO line, masked detail on 4xx/5xx/slow, \`HIGHEST_PRECEDENCE + 100\` so it runs before logging. Mention \`AuthFilter\` and \`auth().none()\` for opting out of token filters, and \`ResponseBuilder.clone\` when a filter must patch a response from a legacy service.

### Q: When would you use relaxedHTTPSValidation?

**Short answer (30–60 s):** Only locally against a self-signed development certificate, behind an explicit switch. In shared and prod-like environments I configure a trust store with the company CA, because certificate problems are real defects.

**Detailed answer:** \`relaxedHTTPSValidation\` trusts every certificate and hides expired certificates, wrong hostnames and interception. The right fixes: \`SSLConfig.trustStore\` for an internal CA, \`keyStore\` for mTLS; when a debugging proxy is used, trust the proxy's CA on the local machine only.

### Q: A test sends a POJO and the server stores "Zo?" instead of "Zoë". How do you debug it?

**Short answer (30–60 s):** Check the request's \`Content-Type\` charset in the log or wire log. REST Assured 5 defaults to ISO-8859-1 for every content type except exactly \`application/json\`, so a vendor type like \`application/vnd.shopeasy.v2+json\` is sent as Latin-1.

**Detailed answer:** Confirm with wire logging or a proxy; fix with \`EncoderConfig.defaultContentCharset("UTF-8")\` or \`defaultCharsetForContentType\`; add a regression test with a non-ASCII name that reads the value back. If the server rejects \`charset\` parameters, disable appending it.

### Q: How do you test CORS with REST Assured if it is not a browser?

**Short answer (30–60 s):** Simulate the browser's preflight: \`OPTIONS\` with \`Origin\`, \`Access-Control-Request-Method\` and \`-Headers\`, then assert the \`Access-Control-Allow-*\` headers; and on the real request assert \`Access-Control-Allow-Origin\` and \`Expose-Headers\`.

**Detailed answer:** Explain why Postman/REST Assured succeed when the browser fails, the credential rule (\`*\` cannot be used with cookies), negative tests with a disallowed origin, and that a final confirmation belongs in one browser-level test (Playwright) because only a browser enforces CORS.

## Scenario-based questions

**1. After switching CI to \`parallel="methods"\` with 8 threads, about 2% of cart tests fail with someone else's items or 403 on orders.** I would grep for assignments to \`RestAssured.\` statics and static fields holding tokens or responses. The usual culprit is \`RestAssured.requestSpecification\` or a static token set in \`@BeforeMethod\`. Fix: immutable base spec constant, per-test \`Specs.authed(token)\`, each test registering its own customer (\`POST /api/users\` with a unique username). Prove it by running the class with 8 threads 20 times in a loop before declaring it fixed.

**2. The nightly run sat for 45 minutes on one test and was killed; no test report was produced.** No timeouts were configured, so a hung endpoint blocked the thread forever. I add connect/read timeouts in the shared \`RestAssuredConfig\` (reproduce with \`GET /api/slow?ms=10000\` and a 3 s read timeout — the test now fails in 3 s with \`SocketTimeoutException\`), add the \`TrafficFilter\` so the hung call is logged with its correlation id, and keep a CI job timeout as the outer guard. I report to the backend team which endpoint hung, with the timestamp.

**3. A developer says "your tests are wrong, Postman works" for a 401 on \`GET /api/cart\`.** I compare the actual requests, not opinions: enable \`log().all()\` locally or route both through the same debugging proxy. Typical findings: the token filter runs after the logging filter (so the log looked fine), the spec and an inline call send two \`Authorization\` headers, or the test used \`auth().oauth2\` plus a filter. I fix the filter order / \`HeaderConfig\`, and add a test that asserts the 401's \`WWW-Authenticate\` header for the genuine no-token case.

## Tricky follow-ups

- **Q: Does \`log().all()\` show exactly what was sent?** Not necessarily — it logs the request at the logging filter's position; filters later in the chain can still change it. Wire logs or a proxy show the bytes.
- **Q: Does REST Assured keep cookies between requests by default?** No — cookie policy \`IGNORE_COOKIES\` and a new client per request. Use \`SessionFilter\`/\`CookieFilter\` or pass cookies explicitly.
- **Q: Is DELETE idempotent if the second call returns 404?** Yes — idempotency is about the resulting state, not the status code.
- **Q: Why might \`statusCode(200)\` pass on a broken endpoint that redirects to a login page?** Redirects are followed by default (\`maxRedirects\` 100); you are asserting the login page. Disable following in API suites.
- **Q: \`body("tax", equalTo(new BigDecimal("4.00")))\` with \`BIG_DECIMAL\` config fails on ShopEasy — why?** The JSON is \`4\` (an integer → \`Integer\`), and \`BigDecimal.equals\` also compares scale. Deserialise to \`BigDecimal\` and use \`compareTo\`.`,
  keyPoints: [
    'REST Assured 5.x is a Java DSL over Groovy (GPath is Groovy at runtime) on Apache HttpClient 4.5.x; every request passes a filter chain ending in a terminal send filter. 6.x needs Java 17; 7.0 moves to the JDK HttpClient and prefers Jackson 3.',
    'Lifecycle: given() seeds from statics → specs merge → URL built and encoded → body serialised → filters (before ctx.next) → HTTP → filters (after) → then() validates; transport errors throw from when(), never from matchers.',
    'Merge rules: port, auth, content type and body are overwritten; params, cookies, headers and filters merge (headers except Content-Type/Accept). Keep only immutable constants global; per-test data goes into per-test specs.',
    'RestAssuredConfig is immutable: configure timeouts (http.connection.timeout / http.socket.timeout in 5.x), pin and share one Jackson ObjectMapper, BIG_DECIMAL numbers (integers stay Integer), UTF-8 for every JSON-ish type (default is ISO-8859-1 except application/json), no redirect following, trust stores instead of relaxedHTTPSValidation, blacklisted headers and log-if-validation-fails.',
    'Let REST Assured encode path/query params (never pre-encode, never concatenate); disable encoding only for already-encoded URLs.',
    'Tolerant DTOs (ignore unknown fields) + schemas for drift; @JsonInclude(NON_NULL) for PATCH bodies; Instant with JavaTimeModule for ISO dates; BigDecimal fields for money.',
    'HTTP semantics are contract: Location on 201, Allow on 405, WWW-Authenticate on 401, Retry-After on 429/503, empty 204; idempotency is about state, which decides what a client may retry. CORS is browser-enforced — test it by simulating the preflight.',
    'A custom OrderedFilter for correlation ids, timing and masked logging (bodies too) plus ifValidationFails gives complete evidence without 30 MB logs; wire logs and a debugging proxy are for encoding/proxy problems only.',
  ],
  mistakes: [
    'Setting a per-test token in RestAssured.requestSpecification or changing RestAssured.config inside a test — threads overwrite each other and later tests inherit the change. Fix: immutable base spec and config constants, per-test Specs.authed(token); grep for "RestAssured\\." assignments when parallel runs flake.',
    'No timeouts — a hung endpoint blocks CI for an hour with no report. Fix: http.connection.timeout and http.socket.timeout in one shared RestAssuredConfig (Duration-based methods from 6.3.0), reproduce with GET /api/slow, log transport failures in a filter.',
    'Trusting log().all() as "what was sent" when a token or correlation filter runs after the logging filter. Fix: OrderedFilter with an explicit order, inspect getHeaders() inside the chain, or use wire logging / a proxy to see the bytes.',
    'Sending application/merge-patch+json or a vendor +json type and getting garbled non-ASCII data, because the default charset is ISO-8859-1 for everything except application/json. Fix: EncoderConfig.defaultContentCharset("UTF-8") and a regression test with a non-ASCII name.',
    'Sending PATCH bodies from records with null components — Jackson writes "field": null and ShopEasy answers 400 VALIDATION_FAILED. Fix: @JsonInclude(NON_NULL) on patch DTOs or a Map for partial updates; log the serialised body to confirm.',
    'Using relaxedHTTPSValidation or allowAllHostnames to "fix" PKIX errors on staging — certificate defects then reach production unnoticed. Fix: configure a trust store with the internal CA; keep relaxed validation behind a local-only switch.',
  ],
  tryIt: `Against the ShopEasy API (\`npm run api\`, http://localhost:5181): (1) build \`ApiConfig.DEFAULT\` with a 3000 ms read timeout and call \`GET /api/slow?ms=5000\` — confirm the \`SocketTimeoutException\` comes from \`when()\`; (2) implement \`TrafficFilter\`, log in with \`POST /api/auth/login\` and check that the password in the request and the token in the response are masked, then provoke \`PUT /api/orders\` (405) and read the masked detail block and the server's \`X-Request-Id\`; (3) send \`PATCH /api/users/1\` with a record that has only \`phone\` set — observe 400 \`VALIDATION_FAILED\`, then add \`@JsonInclude(NON_NULL)\` and get 200; (4) send \`OPTIONS /api/cart\` with \`Origin\` and \`Access-Control-Request-Method: DELETE\` and assert the CORS headers; (5) call \`GET /api/products/{id}\` with the values \`"1/2"\` and \`"1 2"\` as a path parameter, with URL encoding on and off, and explain from the log (or the client-side exception) what reached the server — \`INVALID_ID\`, \`ROUTE_NOT_FOUND\`, or nothing at all because the unencoded URL was rejected before sending.`,
  problems: ['api-007', 'api-022', 'api-027', 'api-028', 'api-040'],
}
