export default {
  slug: 'restassured-deep-api-framework-architecture',
  category: 'restassured',
  order: 15,
  title: 'Deep dive: designing an API test framework with REST Assured — clients, models, data, config and reporting',
  minutes: 32,
  summary: 'Design a REST Assured framework a team can grow for years — a layered architecture with one client per resource, an immutable ApiConfig, a SpecFactory without global state, record models, the typed-plus-raw client method pattern, test data builders and an honest cleanup strategy, Allure and correlation-id filters, a parallel-safe TestNG base class, reuse from UI tests and Cucumber, library and code-generation trade-offs, and the anti-patterns reviewers reject.',
  manualAnalogy: `A good manual test team keeps a shared "how we test the shop" folder: the environment list, the logins, how to create a fresh customer, a template for bug reports with request ids. Nobody re-invents those for every test case. An API framework is that folder turned into code: the knowledge of how to talk to ShopEasy lives once, in the right place, and every test only describes the business story it checks.`,
  body: `## Where the earlier lessons stop

*From tests to a framework* (\`api-framework-design\`) introduced \`RequestSpecBuilder\`, \`ResponseSpecBuilder\`, logging, filters and the idea of layers; \`api-contract-and-data-driven\` added POJOs and data providers; \`api-parallel-and-isolation\` made each test own its customer with \`ThreadLocal\`. This lesson is the **architecture**: which classes exist, what each one is allowed to know, full working code for the core pieces, and the decisions a senior has to defend in a design review.

Related deep dives — not repeated here: filter mechanics, config classes and spec merging in \`restassured-deep-internals-http\`; GPath, POJO mapping and schema validation in \`restassured-deep-assertions-json-contracts\`; the \`TokenProvider\`, JWTs and security tests in \`restassured-deep-auth-security-testing\`; \`RequestSpecBuilder\` as a Builder and test data builders in general in \`pom-deep-creational-patterns\`; the multi-module Maven layout with an \`api-client\` module in \`framework-deep-maven-build-internals\`; thread-safety foundations in \`java-deep-multithreading-synchronization\`. Pact, WireMock, Awaitility and GraphQL come in \`restassured-deep-advanced-api-testing\`.

All endpoints, fields and error codes below are taken from \`scripts/api-server.mjs\` (ShopEasy API, port 5181, base path \`/api\`).

## 1. Layered architecture

### What it is and why it is needed

A suite of 40 tests can live with \`given().baseUri(...).auth().oauth2(...)\` repeated everywhere. A suite of 1,500 tests that six people change every week cannot: a renamed path breaks 200 files, a new header needs 200 edits, and nobody can tell a business rule from plumbing. Layers put each kind of knowledge in exactly one place.

\`\`\`
tests (TestNG classes, Cucumber steps, UI-test setup)      business stories + assertions
   │
service / client layer                                     AuthClient · ProductsClient · CartClient · OrdersClient · UsersClient
   │                                                       (what the API offers, in domain language)
request/response specs + filters                           SpecFactory · CorrelationIdFilter · AllureRestAssured · LogConfig
   │
models                                                     records: Cart, Order, User, ApiError, requests
   │
test data builders                                         UserBuilder, OrderRequests (unique, valid defaults)
   │
config                                                     ApiConfig (immutable: env, base URI, timeouts, flags)
\`\`\`

| Layer | Knows | Must not know | Changes when |
|---|---|---|---|
| Tests | business rules, expected outcomes | paths, headers, JSON shapes, tokens | a requirement changes |
| Clients | endpoints, verbs, status of success, model types | assertions about business rules, environments | the API changes |
| Specs/filters | base URI, content type, auth header mechanics, logging, reporting | which test is running | cross-cutting concerns change |
| Models | field names and types | HTTP | the contract changes |
| Builders | valid defaults, uniqueness | HTTP, assertions | validation rules change |
| Config | where and how to connect | anything else | environments change |

The dependency direction is strictly downwards; nothing below the tests imports TestNG, AssertJ or Hamcrest.

### Package layout

\`\`\`
src/test/java/com/shopeasy/api/        (or src/main/java in an api-client module — see framework-deep-maven-build-internals)
├── config/        ApiConfig
├── http/          SpecFactory, CorrelationIdFilter, Endpoints, ApiCallException, Expect
├── clients/       AuthClient, ProductsClient, CartClient, OrdersClient, UsersClient, ShopEasyApi, CustomerSession
├── models/        Cart, CartItem, AddItem, Order, OrderRequest, Customer, User, NewUser, Address, LoginResponse, ApiError
├── data/          UserBuilder
└── tests/         BaseApiTest, OrderJourneyTest, CartRulesTest, OrderPrivacyTest
\`\`\`

Putting \`config\`…\`data\` in a separate Maven module (\`shopeasy-api-client\`) lets UI and Cucumber projects depend on the same clients — section 9.

## 2. Configuration: an immutable \`ApiConfig\`

\`\`\`java
package com.shopeasy.api.config;

import java.net.URI;
import java.time.Duration;
import java.util.Objects;

/** Immutable, thread-safe. Precedence: -D system property > environment variable > default. */
public record ApiConfig(String envName, URI baseUri, String basePath,
                        Duration connectTimeout, Duration readTimeout, boolean resetAllowed) {

    public ApiConfig {
        Objects.requireNonNull(envName, "envName");
        Objects.requireNonNull(baseUri, "baseUri");
        if (!basePath.startsWith("/")) throw new IllegalArgumentException("basePath must start with /: " + basePath);
        if (resetAllowed && !"local".equals(envName)) {
            throw new IllegalStateException("POST /api/reset wipes shared data; it is only allowed on env 'local'");
        }
    }

    public static ApiConfig fromEnvironment() {
        String env = setting("api.env", "API_ENV", "local");
        return new ApiConfig(
                env,
                URI.create(setting("api.baseUri", "API_BASE_URI", "http://localhost:5181")),
                setting("api.basePath", "API_BASE_PATH", "/api"),
                Duration.ofMillis(Long.parseLong(setting("api.connectTimeoutMs", "API_CONNECT_TIMEOUT_MS", "5000"))),
                Duration.ofMillis(Long.parseLong(setting("api.readTimeoutMs", "API_READ_TIMEOUT_MS", "15000"))),
                Boolean.parseBoolean(setting("api.resetAllowed", "API_RESET_ALLOWED", String.valueOf("local".equals(env)))));
    }

    private static String setting(String property, String envVar, String fallback) {
        String fromProperty = System.getProperty(property);
        if (fromProperty != null && !fromProperty.isBlank()) return fromProperty.trim();
        String fromEnv = System.getenv(envVar);
        if (fromEnv != null && !fromEnv.isBlank()) return fromEnv.trim();
        return fallback;
    }
}
\`\`\`

**Step by step.** A record gives immutability, \`equals\` and a readable \`toString\` for free — safe to share across threads and safe to print, because it contains **no secrets**. The compact constructor validates once, at start-up, so a typo fails the run in the first second instead of producing 300 confusing 404s. The \`resetAllowed\` guard encodes a rule that otherwise lives in someone's head: \`POST /api/reset\` drops every user, token, cart and order — on a shared environment it would destroy other people's runs. Precedence \`-D\` > env var > default suits both developers (\`mvn test -Dapi.baseUri=...\`) and CI (variables injected by the pipeline). Credentials are deliberately **not** in this record — see section 7.

## 3. \`SpecFactory\`: per-user specs, no global state

\`RequestSpecification\` is **mutable** — every \`given().spec(spec).header(...)\` call merges into a new request, but sharing one builder-built spec and mutating it (\`spec.header(...)\`) from parallel tests is a race. The factory builds a fresh spec on demand from immutable inputs; nothing is assigned to \`RestAssured.baseURI\`, \`RestAssured.requestSpecification\` or \`RestAssured.filters(...)\`.

\`\`\`java
package com.shopeasy.api.http;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.shopeasy.api.config.ApiConfig;
import io.qameta.allure.restassured.AllureRestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.JsonConfig;
import io.restassured.config.LogConfig;
import io.restassured.config.ObjectMapperConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.http.ContentType;
import io.restassured.path.json.config.JsonPathConfig;
import io.restassured.specification.RequestSpecification;

public final class SpecFactory {

    private final ApiConfig config;
    private final RestAssuredConfig restAssuredConfig;

    public SpecFactory(ApiConfig config) {
        this.config = config;
        ObjectMapper mapper = new ObjectMapper()
                .findAndRegisterModules()                                   // java.time via jackson-datatype-jsr310
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
        this.restAssuredConfig = RestAssuredConfig.config()
                .objectMapperConfig(ObjectMapperConfig.objectMapperConfig()
                        .jackson2ObjectMapperFactory((type, charset) -> mapper))
                .jsonConfig(JsonConfig.jsonConfig()
                        .numberReturnType(JsonPathConfig.NumberReturnType.DOUBLE))  // body("total", equalTo(82.05))
                .logConfig(LogConfig.logConfig()
                        .blacklistHeader("Authorization", "Cookie", "Set-Cookie")
                        .enableLoggingOfRequestAndResponseIfValidationFails())
                .httpClient(HttpClientConfig.httpClientConfig()                     // Apache HttpClient 4 parameter names
                        .setParam("http.connection.timeout", (int) config.connectTimeout().toMillis())
                        .setParam("http.socket.timeout", (int) config.readTimeout().toMillis()));
    }

    /** No credentials. Products, registration, health. */
    public RequestSpecification anonymous() {
        return base(true).build();
    }

    /** For one customer. Each call returns a new spec — never shared mutable state. */
    public RequestSpecification forToken(String token) {
        return base(true).addHeader("Authorization", "Bearer " + token).build();
    }

    /** For the login call only: not attached to reports, because its body holds the password and the token. */
    public RequestSpecification unreported() {
        return base(false).build();
    }

    private RequestSpecBuilder base(boolean report) {
        RequestSpecBuilder b = new RequestSpecBuilder()
                .setBaseUri(config.baseUri().toString())
                .setBasePath(config.basePath())
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .setConfig(restAssuredConfig)
                .addFilter(new CorrelationIdFilter());
        if (report) b.addFilter(new AllureRestAssured());
        return b;
    }
}
\`\`\`

**Step by step.** One \`ObjectMapper\`, configured once and shared (it is thread-safe after configuration). \`FAIL_ON_UNKNOWN_PROPERTIES=false\` keeps functional tests stable when the API **adds** a field; detecting unexpected fields is the job of schema/contract tests (\`restassured-deep-assertions-json-contracts\`). \`NumberReturnType.DOUBLE\` makes JsonPath return \`Double\` instead of the default \`Float\`, so \`equalTo(82.05)\` works. Timeouts are mandatory — the default is effectively "wait forever", and one hung connection then hangs a CI agent. The timeout parameter names are the classic Apache HttpClient 4 keys used with REST Assured's \`HttpClientConfig\`; the internals lesson covers alternatives. The \`unreported()\` spec exists because no report redaction setting masks a JSON password field.

Filters run in the order they are added (unless they implement \`OrderedFilter\`), so the correlation id is set before Allure records the request.

## 4. Models: records

\`\`\`java
package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

public record AddItem(int productId, int quantity) { }

public record CartItem(int productId, String name, double price, int quantity, double lineTotal) { }

public record Cart(int userId, List<CartItem> items, int itemCount, double subtotal) { }

public record Customer(String firstName, String lastName, String postalCode) { }

@JsonInclude(JsonInclude.Include.NON_NULL)          // items == null must be OMITTED, not sent as null
public record OrderRequest(String firstName, String lastName, String postalCode, List<AddItem> items) {
    public static OrderRequest fromCart(String firstName, String lastName, String postalCode) {
        return new OrderRequest(firstName, lastName, postalCode, null);
    }
    public static OrderRequest withItems(Customer c, List<AddItem> items) {
        return new OrderRequest(c.firstName(), c.lastName(), c.postalCode(), List.copyOf(items));
    }
}

public record Order(int id, int userId, String status, Customer customer, List<CartItem> items,
                    int itemCount, double subtotal, double tax, double total, Instant createdAt) { }

public record OrderList(List<Order> data) { }

public record Address(String street, String city, String postalCode, String country) { }

public record User(int id, String username, String firstName, String lastName, String email,
                   String phone, List<String> roles, Address address) { }

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NewUser(String username, String password, String firstName, String lastName,
                      String email, String phone, Address address) {
    @Override public String toString() {                                    // never print the password
        return "NewUser[" + username + ", " + email + ", password=****]";
    }
}

public record LoginResponse(String token, String tokenType, long expiresIn, UserRef user) {
    public record UserRef(int id, String username) { }
    @Override public String toString() { return "LoginResponse[user=" + user + ", token=****]"; }
}

public record ApiError(Body error) {
    public record Body(String code, String message, List<Detail> details) { }
    public record Detail(String field, String message) { }
    public String code() { return error.code(); }
}
\`\`\`

(Shown together for brevity — each public type lives in its own file.)

**Why the \`NON_NULL\` matters on ShopEasy:** \`POST /api/orders\` orders the current cart when \`items\` is **absent**. Jackson writes \`"items": null\` by default, and the server then answers 400 \`VALIDATION_FAILED\` ("items must be an array") — a real bug you would hit on the first run. Records deserialize with Jackson 2.12+; \`Instant\` needs \`jackson-datatype-jsr310\` (picked up by \`findAndRegisterModules()\`). Money as \`double\` is fine here because ShopEasy rounds to 2 decimals and we compare exact decimal literals; for a real payments API, prefer \`BigDecimal\` (\`DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS\`).

Records vs Lombok POJOs: records are immutable, need no plugin and compare by value — \`assertThat(readBack).isEqualTo(placed)\` compares every field of an order. POJOs remain useful for partial-update bodies with many optional fields (or use a \`Map\` for \`PATCH\`).

## 5. Clients: one per resource, typed and raw

### The two-method pattern

Every client operation comes in two flavours:

* **\`xxx(...)\` — typed, for arranging and happy paths.** Sends the request, checks the status that means "success" for this operation, returns a model. If the status is wrong, it throws an \`ApiCallException\` with the request id and the body — a **precondition** failure, not a business assertion.
* **\`xxxRaw(...)\` — returns the \`Response\`, for negative tests.** No checks at all; the test asserts status, error code, headers.

\`\`\`java
package com.shopeasy.api.http;

import io.restassured.response.Response;

public final class Expect {
    private Expect() { }

    public static <T> T status(Response response, int expected, Class<T> type) {
        status(response, expected);
        return response.as(type);
    }

    public static void status(Response response, int expected) {
        if (response.statusCode() != expected) throw new ApiCallException(expected, response);
    }
}

public class ApiCallException extends RuntimeException {
    public ApiCallException(int expected, Response r) {
        super("Expected HTTP " + expected + " but got " + r.statusCode()
              + " [X-Request-Id " + r.header("X-Request-Id") + "] body: " + abbreviate(r.asString(), 2000));
    }
    private static String abbreviate(String s, int max) { return s.length() <= max ? s : s.substring(0, max) + "…"; }
}

public final class Endpoints {
    private Endpoints() { }
    public static final String LOGIN = "/auth/login", RESET = "/reset";
    public static final String PRODUCTS = "/products", PRODUCT = "/products/{id}";
    public static final String CART = "/cart", CART_ITEMS = "/cart/items", CART_ITEM = "/cart/items/{productId}";
    public static final String ORDERS = "/orders", ORDER = "/orders/{id}";
    public static final String USERS = "/users", USER = "/users/{id}";
}
\`\`\`

### \`CartClient\` and \`OrdersClient\`

\`\`\`java
package com.shopeasy.api.clients;

import com.shopeasy.api.http.Endpoints;
import com.shopeasy.api.http.Expect;
import com.shopeasy.api.models.*;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;

import static io.restassured.RestAssured.given;

public final class CartClient {
    private final RequestSpecification spec;     // already carries this customer's token

    public CartClient(RequestSpecification spec) { this.spec = spec; }

    public Response addRaw(Object body)          { return given().spec(spec).body(body).when().post(Endpoints.CART_ITEMS); }
    public Cart add(int productId, int quantity) { return Expect.status(addRaw(new AddItem(productId, quantity)), 201, Cart.class); }

    public Response getRaw()                     { return given().spec(spec).when().get(Endpoints.CART); }
    public Cart get()                            { return Expect.status(getRaw(), 200, Cart.class); }

    public Response removeRaw(int productId)     { return given().spec(spec).when().delete(Endpoints.CART_ITEM, productId); }
    public void remove(int productId)            { Expect.status(removeRaw(productId), 204); }

    public Response clearRaw()                   { return given().spec(spec).when().delete(Endpoints.CART); }
    public void clear()                          { Expect.status(clearRaw(), 204); }
}

public final class OrdersClient {
    private final RequestSpecification spec;

    public OrdersClient(RequestSpecification spec) { this.spec = spec; }

    public Response placeRaw(Object body)        { return given().spec(spec).body(body).when().post(Endpoints.ORDERS); }
    public Order place(OrderRequest request)     { return Expect.status(placeRaw(request), 201, Order.class); }

    public Response byIdRaw(int id)              { return given().spec(spec).when().get(Endpoints.ORDER, id); }
    public Order byId(int id)                    { return Expect.status(byIdRaw(id), 200, Order.class); }

    public Response mineRaw()                    { return given().spec(spec).when().get(Endpoints.ORDERS); }
    public java.util.List<Order> mine()          { return Expect.status(mineRaw(), 200, OrderList.class).data(); }
}
\`\`\`

The raw methods take \`Object body\` on purpose: a negative test must be able to send what the typed model cannot express — \`Map.of("productId", "abc")\`, a missing field, a broken JSON string.

### \`AuthClient\`, \`UsersClient\`, \`ProductsClient\` and the session facade

\`\`\`java
public final class AuthClient {
    private final RequestSpecification unreported;          // login is never attached to reports
    private final java.util.concurrent.ConcurrentHashMap<String, String> tokens = new java.util.concurrent.ConcurrentHashMap<>();

    public AuthClient(RequestSpecification unreported) { this.unreported = unreported; }

    public Response loginRaw(Object body) { return given().spec(unreported).body(body).when().post(Endpoints.LOGIN); }

    public LoginResponse login(String username, String password) {
        return Expect.status(loginRaw(java.util.Map.of("username", username, "password", password)), 200, LoginResponse.class);
    }

    /** One login per user per run. Expiry-aware refresh: see TokenProvider in restassured-deep-auth-security-testing. */
    public String tokenFor(String username, String password) {
        return tokens.computeIfAbsent(username, u -> login(u, password).token());
    }

    public void forgetAllTokens() { tokens.clear(); }        // after POST /api/reset every token is dead
}

public final class UsersClient {
    private final RequestSpecification spec;
    public UsersClient(RequestSpecification spec) { this.spec = spec; }

    public Response registerRaw(Object body)  { return given().spec(spec).body(body).when().post(Endpoints.USERS); }
    public User register(NewUser user)        { return Expect.status(registerRaw(user), 201, User.class); }
    public Response byIdRaw(int id)           { return given().spec(spec).when().get(Endpoints.USER, id); }
    public Response patchRaw(int id, Object body) { return given().spec(spec).body(body).when().patch(Endpoints.USER, id); }
    public User patch(int id, java.util.Map<String, ?> changes) { return Expect.status(patchRaw(id, changes), 200, User.class); }
}

public final class ProductsClient {
    private final RequestSpecification spec;
    public ProductsClient(RequestSpecification spec) { this.spec = spec; }
    public Response searchRaw(java.util.Map<String, ?> query) { return given().spec(spec).queryParams(query).when().get(Endpoints.PRODUCTS); }
    public Response byIdRaw(int id)           { return given().spec(spec).when().get(Endpoints.PRODUCT, id); }
}

/** Everything one logged-in customer can do. Immutable; one per test. */
public record CustomerSession(User user, CartClient cart, OrdersClient orders, UsersClient profile) { }

/** Entry point. Holds no per-test state, so one instance can be shared by all threads. */
public final class ShopEasyApi {
    private final ApiConfig config;
    private final SpecFactory specs;
    private final AuthClient auth;

    public ShopEasyApi(ApiConfig config) {
        this.config = config;
        this.specs = new SpecFactory(config);
        this.auth = new AuthClient(specs.unreported());
    }

    public ProductsClient products() { return new ProductsClient(specs.anonymous()); }
    public UsersClient users()       { return new UsersClient(specs.anonymous()); }
    public AuthClient auth()         { return auth; }

    /** Registers a brand-new customer and returns their logged-in session. */
    public CustomerSession newCustomer(NewUser data) {
        User user = users().register(data);
        String token = auth.tokenFor(data.username(), data.password());
        RequestSpecification spec = specs.forToken(token);
        return new CustomerSession(user, new CartClient(spec), new OrdersClient(spec), new UsersClient(spec));
    }

    public void resetAll() {
        if (!config.resetAllowed()) throw new IllegalStateException("reset is disabled on env " + config.envName());
        Expect.status(given().spec(specs.anonymous()).when().post(Endpoints.RESET), 200);
        auth.forgetAllTokens();
    }
}
\`\`\`

(Imports omitted for the smaller classes; they mirror \`CartClient\`.)

### Multiple approaches: what a client method returns

| Approach | How it works | Advantages | Disadvantages | Maintainability | When to use |
|---|---|---|---|---|---|
| \`Response\` only | client sends, test does everything | maximal flexibility, trivial clients | arrange code full of \`.then().statusCode(201).extract().as(...)\`; status checks forgotten | low at scale | tiny suites |
| Typed only | \`Cart add(...)\` throws on wrong status | clean happy-path tests | negative tests impossible or need a second client | medium | read-only consumers (e.g. UI setup) |
| \`ValidatableResponse\` | client returns \`...then()\` | fluent assertions right away | the client decides that you assert; extracting models is clumsy; tempts \`statusCode\` inside clients | medium | small teams fond of the DSL |
| **Typed + raw (two methods)** | \`add(...)\` → \`Cart\`, \`addRaw(...)\` → \`Response\` | arrange is one line, negatives keep full control, status-of-success lives in one place | twice the methods (each a one-liner) | **high** | **default** |
| Typed result wrapper | \`ApiResult<Cart>\` with \`status()\`, \`body()\`, \`error()\` | one method per operation, typed errors | more framework code, custom assertion API to learn | high | large frameworks with many consumers |

**Recommended: typed + raw.** It keeps tests at business level ("given a cart with two backpacks") and still lets negative tests send anything and assert everything. The typed method's status check is a *precondition* — it raises \`ApiCallException\`, not an assertion error — so a broken arrange step reads as "setup failed: expected 201, got 422 OUT_OF_STOCK [req-00042]" rather than a misleading business failure.

## 6. Test data: \`UserBuilder\`, uniqueness and cleanup

\`\`\`java
package com.shopeasy.api.data;

import com.shopeasy.api.models.Address;
import com.shopeasy.api.models.NewUser;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

public final class UserBuilder {

    private static final String RUN_ID = UUID.randomUUID().toString().substring(0, 6);   // one per JVM run
    private static final AtomicInteger SEQUENCE = new AtomicInteger();

    private String username = uniqueUsername("it");
    private String password = "Pw-" + UUID.randomUUID();                // >= 8 chars, unique per user
    private String firstName = "Test";
    private String lastName = "Customer";
    private String email = username + "@example.test";
    private String phone = "+91-80-5550-0199";
    private Address address = new Address("1 Test Street", "Bengaluru", "560001", "IN");

    public static UserBuilder aCustomer() { return new UserBuilder(); }

    /** ShopEasy rule: 3-40 chars of a-z 0-9 _ . - */
    public static String uniqueUsername(String prefix) {
        return (prefix + "_" + RUN_ID + "_" + SEQUENCE.incrementAndGet()).toLowerCase();
    }

    public UserBuilder named(String first, String last) { this.firstName = first; this.lastName = last; return this; }
    public UserBuilder withUsername(String username)    { this.username = username; this.email = username + "@example.test"; return this; }
    public UserBuilder withEmail(String email)          { this.email = email; return this; }
    public UserBuilder withPassword(String password)    { this.password = password; return this; }
    public UserBuilder withoutAddress()                 { this.address = null; return this; }

    public NewUser build() {
        return new NewUser(username, password, firstName, lastName, email, phone, address);
    }
}
\`\`\`

**Step by step.** Every builder starts **valid** (passes ShopEasy's registration rules: username pattern, password ≥ 8, required names, valid email) so a test states only what matters: \`aCustomer().withEmail("asha@")\` for the 422 \`INVALID_EMAIL\` test. \`RUN_ID\` + an \`AtomicInteger\` make usernames unique across parallel threads **and** across CI runs against the same environment; a fixed prefix (\`it_\`) marks test data for later clean-up. Builder patterns in general (Lombok, withers, Object Mother) are compared in \`pom-deep-creational-patterns\`.

### Data strategy

| Strategy | ShopEasy | Use when |
|---|---|---|
| **Create per test through the API** | \`POST /api/users\` → a new customer with an empty cart and no orders | default: isolation for free, parallel-safe |
| Seeded read-only reference data | products 1–6 (6 is out of stock), seed users | catalogue reads, never mutated |
| Reset to seed | \`POST /api/reset\` | local only, **once** before the suite |
| Shared pre-created accounts | \`standard_user\`, \`visual_user\` | read-only checks, demos — not for tests that mutate carts/orders in parallel |

### Clean-up — and the "no delete-user endpoint" reality

ShopEasy has \`DELETE /api/cart\`, \`DELETE /api/cart/items/{productId}\` and \`DELETE /api/users/{id}/avatar\`, but **no endpoint to delete a user or an order**. Registered users disappear only on \`POST /api/reset\` or restart. How to cope, honestly:

1. **Design so leftovers don't matter.** Every test creates its own customer; nothing queries "all users" or "all orders" globally. Leftover data then causes no flakiness, only growth.
2. **Clean what you can, best effort.** Empty the cart or delete an avatar in \`@AfterMethod(alwaysRun = true)\` when a test leaves state that a *later step of the same test class* might see — but never let a clean-up failure fail the test; log it.
3. **Local: reset once** before the suite (\`ApiConfig.resetAllowed\`), never between tests (it would kill parallel tests' tokens).
4. **Shared environments: lifecycle at environment level** — a nightly rebuild/re-seed, or a janitor job that removes \`it_\`-prefixed users through a DB script or an internal admin API. Ask developers for that endpoint as a testability requirement rather than writing SQL into the test framework.
5. **Never** clean up with \`/api/reset\` on a shared environment — the \`ApiConfig\` guard makes that impossible by construction.

## 7. Environments and secrets

| Environment | Base URI source | Reset | Data | Credentials |
|---|---|---|---|---|
| local | default \`http://localhost:5181\` | once per run | created per test | seed password \`secret_sauce\` is a public fixture — fine in code |
| CI ephemeral (container per pipeline) | \`API_BASE_URI\` from the pipeline | once per run | created per test | generated |
| shared staging | \`API_BASE_URI\` | **never** | created per test, \`it_\` prefix, janitor | CI secret store / vault, injected as env vars |
| production | — | never | **read-only smoke only**, dedicated monitored account | vault, rotated, least privilege |

Secrets rules: never in \`ApiConfig\`, \`.properties\` files in Git or test code; read them from env vars/secret managers at the point of use; mask them (\`toString\` overrides, \`LogConfig.blacklistHeader\`, unreported login). Users the suite creates get random passwords that live only in memory for the run — nothing to leak or rotate.

## 8. Cross-cutting filters: Allure and correlation ids

### Allure

\`\`\`xml
<dependency>
  <groupId>io.qameta.allure</groupId>
  <artifactId>allure-rest-assured</artifactId>
  <version>\${allure.version}</version>
  <scope>test</scope>
</dependency>
\`\`\`

\`io.qameta.allure.restassured.AllureRestAssured\` is a REST Assured filter that attaches each request and response to the current Allure step. Version detail worth knowing (from the current Allure docs): in **Allure Java 2.x** it creates separate "Request" and "Response" attachments rendered by FreeMarker templates (\`setRequestTemplate\`/\`setResponseTemplate\`, \`setRequestAttachmentName\`/\`setResponseAttachmentName\`); **Allure Java 3.x** produces a single "HTTP exchange" attachment, always redacts \`Authorization\`, \`Proxy-Authorization\`, \`Cookie\` and \`Set-Cookie\`, honours REST Assured's header blacklist, and adds \`configureHttpExchange(...)\` with \`redactHeader\`/\`redactQueryParameter\`/\`redactFormParameter\` and a body-size cap. Whatever your version: **open one attachment and check** that no token or password is visible — and keep the login call out of reports (\`SpecFactory.unreported()\`), because JSON body fields are not redacted.

### Correlation id

\`\`\`java
package com.shopeasy.api.http;

import io.qameta.allure.Allure;
import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;

import java.util.UUID;

public final class CorrelationIdFilter implements Filter {
    public static final String HEADER = "X-Correlation-Id";

    @Override
    public Response filter(FilterableRequestSpecification req, FilterableResponseSpecification res, FilterContext ctx) {
        if (!req.getHeaders().hasHeaderWithName(HEADER)) {
            req.header(HEADER, UUID.randomUUID().toString());
        }
        String correlationId = req.getHeaders().getValue(HEADER);
        Response response = ctx.next(req, res);
        Allure.step(req.getMethod() + " " + req.getURI() + " -> " + response.statusCode()
                + " [correlation " + correlationId + ", server " + response.header("X-Request-Id") + "]");
        return response;
    }
}
\`\`\`

**ShopEasy honesty:** the server ignores incoming \`X-Correlation-Id\`; it generates its own \`X-Request-Id\` (\`req-00001\`, \`req-00002\`…) and logs it with every request. So the filter records **both**: the client-side id (useful when a gateway or service mesh propagates it in a typical real app) and the server's id, which is what you search for in the ShopEasy console. \`ApiCallException\` also prints \`X-Request-Id\`, so a failed arrange step points straight at the server log line.

## 9. TestNG base class and three tests

\`\`\`java
package com.shopeasy.api.tests;

import com.shopeasy.api.clients.CustomerSession;
import com.shopeasy.api.clients.ShopEasyApi;
import com.shopeasy.api.config.ApiConfig;
import com.shopeasy.api.data.UserBuilder;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.BeforeSuite;

public abstract class BaseApiTest {

    /** Stateless and immutable after start-up: safe to share between threads. */
    protected static ShopEasyApi api;

    private static final ThreadLocal<CustomerSession> CUSTOMER = new ThreadLocal<>();

    @BeforeSuite(alwaysRun = true)
    public void startApi() {
        ApiConfig config = ApiConfig.fromEnvironment();
        api = new ShopEasyApi(config);
        if (config.resetAllowed()) api.resetAll();      // local only, once, before any test runs
    }

    @BeforeMethod(alwaysRun = true)
    public void newCustomerForThisTest() {
        CUSTOMER.set(api.newCustomer(UserBuilder.aCustomer().build()));
    }

    @AfterMethod(alwaysRun = true)
    public void releaseCustomer() {
        CUSTOMER.remove();                                // pooled threads must not keep the previous test's session
    }

    protected CustomerSession me() { return CUSTOMER.get(); }

    protected CustomerSession anotherCustomer() { return api.newCustomer(UserBuilder.aCustomer().build()); }
}
\`\`\`

Why \`ThreadLocal\` and not a field: with \`parallel="methods"\` TestNG runs methods of the **same instance** on different threads, so an instance field would be overwritten mid-test. The \`static api\` is acceptable because it holds no per-test state (see \`api-parallel-and-isolation\` and \`java-deep-multithreading-synchronization\`).

\`\`\`java
package com.shopeasy.api.tests;

import com.shopeasy.api.models.*;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;

public class OrderJourneyTest extends BaseApiTest {

    private static final int BACKPACK = 1, BIKE_LIGHT = 2, CREW_TEE = 3, RETRO_RED_TEE = 6;  // 6: stock 0 in the seed

    @Test(description = "Happy path: order the cart, read it back, cart is emptied")
    public void customerOrdersTheCartAndCanReadItBack() {
        me().cart().add(BACKPACK, 2);                       // 2 x 29.99
        me().cart().add(CREW_TEE, 1);                       // 1 x 15.99

        Order placed = me().orders().place(OrderRequest.fromCart("Mia", "Tester", "560001"));

        assertThat(placed.status()).isEqualTo("PLACED");
        assertThat(placed.userId()).isEqualTo(me().user().id());
        assertThat(placed.itemCount()).isEqualTo(3);
        assertThat(placed.subtotal()).isEqualTo(75.97);
        assertThat(placed.tax()).isEqualTo(6.08);             // 8% of 75.97 = 6.0776 -> 6.08
        assertThat(placed.total()).isEqualTo(82.05);
        assertThat(me().orders().byId(placed.id())).isEqualTo(placed);   // record equality: every field
        assertThat(me().cart().get().itemCount()).isZero();
    }

    @Test(description = "Cart rules: duplicate add 409, quantity and stock 422, nothing changes")
    public void cartRefusesDuplicatesInvalidQuantitiesAndSoldOutItems() {
        me().cart().add(BIKE_LIGHT, 1);

        me().cart().addRaw(new AddItem(BIKE_LIGHT, 1)).then()
            .statusCode(409).body("error.code", equalTo("ITEM_ALREADY_IN_CART"));
        me().cart().addRaw(new AddItem(BACKPACK, 11)).then()
            .statusCode(422).body("error.code", equalTo("INVALID_QUANTITY"))
            .body("error.details[0].field", equalTo("quantity"));
        me().cart().addRaw(new AddItem(RETRO_RED_TEE, 1)).then()
            .statusCode(422).body("error.code", equalTo("OUT_OF_STOCK"));
        me().cart().addRaw(Map.of("productId", "two")).then()
            .statusCode(400).body("error.code", equalTo("VALIDATION_FAILED"));

        Cart cart = me().cart().get();
        assertThat(cart.items()).extracting(CartItem::productId).containsExactly(BIKE_LIGHT);
        assertThat(cart.itemCount()).isEqualTo(1);
    }

    @Test(description = "Ordering an empty cart is refused")
    public void emptyCartCannotBeOrdered() {
        me().orders().placeRaw(OrderRequest.fromCart("Mia", "Tester", "560001")).then()
            .statusCode(422).body("error.code", equalTo("EMPTY_CART"));
    }

    @Test(description = "Authorisation: another customer cannot read my order")
    public void anotherCustomerGets403ForMyOrder() {
        Order mine = me().orders().place(OrderRequest.withItems(
                new Customer("Mia", "Tester", "560001"), List.of(new AddItem(BIKE_LIGHT, 1))));

        anotherCustomer().orders().byIdRaw(mine.id()).then()
            .statusCode(403)
            .body("error.code", equalTo("FORBIDDEN"))
            .body("$", not(hasKey("items")));
    }
}
\`\`\`

**Step by step.** The happy path reads as the business story; there is no path, header or token in the test. \`assertThat(readBack).isEqualTo(placed)\` uses record equality — one line that compares id, customer, every line, totals and \`createdAt\`. The negative test uses the **raw** methods and asserts status, \`error.code\` and a detail field; it ends by checking that **nothing changed** — the half of negative testing most suites forget. The 403 test needs no seeded users and no reset because both customers are created on the fly — it works in parallel and on a shared environment. Security-test depth (the full permission matrix, mass assignment, OWASP) lives in \`restassured-deep-auth-security-testing\`.

## 10. Parallel safety checklist

* Specs are built per customer; nothing writes \`RestAssured.*\` statics; filters hold no per-test fields.
* Per-test state in \`ThreadLocal\` with \`remove()\` in \`@AfterMethod(alwaysRun = true)\` — or passed as parameters.
* Token cache is concurrent and invalidated after any reset; reset only before the suite.
* Unique data from \`UserBuilder\`; no test reads "all orders" or depends on ids like \`1001\`.
* Reporting attaches to the current thread's test (Allure handles this) — no static "current test" variables.

## 11. Reporting and logging

| Channel | What goes there | Masking |
|---|---|---|
| Console (CI log) | only failing requests/responses (\`enableLoggingOfRequestAndResponseIfValidationFails\`) | header blacklist; login unlogged |
| Allure | every request/response as attachments, correlation step, test description | Allure redaction + blacklist; login unreported |
| Exceptions | \`ApiCallException\`: expected vs actual status, \`X-Request-Id\`, truncated body | bodies of ShopEasy responses contain no secrets; truncate anyway |
| Server logs | found via \`X-Request-Id\` | — |

Senior detail: \`log().ifValidationFails()\` only fires for **REST Assured** validations (\`then().statusCode(...)\`); a failing AssertJ assertion on an extracted model logs nothing. That is exactly why the Allure attachment of every exchange matters for model-based tests.

## 12. Reusing the clients: UI tests and Cucumber

### API-assisted UI tests

The idea: arrange through the API (fast, reliable), act and assert in the UI. **On ShopEasy this has a limit you must state:** the web shop at \`/practice-site/\` keeps its user and cart in \`sessionStorage\` (\`shopeasy.user\`, \`shopeasy.cart\`) and does **not** call the API on port 5181 — so an order created through the API will not appear in the UI. In a **typical real app** where the UI and API share a backend, the pattern is:

\`\`\`java
// Typical real app — illustrative. Selenium: create data via API, inject the session, open the page.
CustomerSession customer = api.newCustomer(UserBuilder.aCustomer().build());
customer.cart().add(BACKPACK, 2);

driver.get(baseUrl + "/");                                                // cookies can only be set on the app's domain
driver.manage().addCookie(new Cookie("session", sessionTokenFor(customer)));
driver.get(baseUrl + "/cart");
assertThat(cartPage.itemCount()).isEqualTo(2);
\`\`\`

This is why the client layer should live in its own module without TestNG/AssertJ dependencies: the UI project uses the typed methods for setup. Playwright's equivalent (\`request\` fixture, \`storageState\`) is in \`pw-deep-api-testing\`.

### Cucumber steps

\`\`\`java
public class CartSteps {
    private final ScenarioWorld world;                    // PicoContainer injects one per scenario

    public CartSteps(ScenarioWorld world) { this.world = world; }

    @Given("a new customer with {int} backpack(s) in the cart")
    public void aCustomerWithBackpacks(int quantity) {
        world.customer = world.api.newCustomer(UserBuilder.aCustomer().build());
        world.customer.cart().add(1, quantity);
    }

    @When("they add the backpack again")
    public void addAgain() {
        world.lastResponse = world.customer.cart().addRaw(new AddItem(1, 1));
    }
}
\`\`\`

Steps become one-liners over the same clients; the \`When\` step stores the raw response for a generic \`Then the request is refused with {string}\` step. Wiring of \`ScenarioWorld\` and hooks: \`cucumber-deep-dependency-injection-hooks\`.

## 13. Design choices compared: HTTP libraries for API tests

| Option | How it works | Advantages | Disadvantages | Team fit |
|---|---|---|---|---|
| **REST Assured** | fluent given/when/then DSL over Apache HttpClient, Hamcrest/GPath built in | test-oriented DSL, logging, filters, schema module, huge community, easy for QA | DSL tempts tests to skip a client layer; Groovy-based internals; blocking only | **Java QA/SDET teams writing functional API tests — default** |
| Retrofit | interface + annotations → typed HTTP client (OkHttp) | type-safe interfaces, compile-time endpoint list | assertions/logging DIY; error bodies need converters; less test-oriented | teams that already use it in Android/backend code |
| OpenFeign | declarative interfaces (often via Spring Cloud) | same as Retrofit; reuses production clients | ties tests to production client code and its bugs; decoders for errors | Spring shops where devs write the tests too |
| \`java.net.http.HttpClient\` | JDK 11+ client, sync/async, HTTP/2 | zero dependencies, modern, async | no DSL, no JSON, no assertions — you build everything | tiny utilities, perf smoke, library authors |
| Karate | Gherkin-like DSL, JS engine, own assertions, parallel runner | very fast to write, built-in mocks and perf (Gatling) | its own language, weaker IDE refactoring, harder to share Java code | teams wanting low-code API tests without Java skills |
| Playwright \`APIRequestContext\` | API client inside Playwright Test (TS) | same runner, fixtures and report as UI tests; cookie sharing with browser | TypeScript ecosystem; fewer API-specific features | TS/Playwright teams — see \`pw-deep-api-testing\` |

**Recommended:** stay with the stack your test engineers already master. For a Java organisation, REST Assured **plus a client layer** gives the best balance — its DSL inside clients, business language in tests. Choose Playwright's request context when UI tests are in TypeScript and API checks mostly support them; Karate when speed of authoring by non-Java testers matters more than code reuse.

## 14. Generated clients from OpenAPI

\`openapi-generator\` (Maven plugin \`openapi-generator-maven-plugin\`) can generate Java models and clients from the API's OpenAPI document; the \`java\` generator offers several HTTP libraries, including a REST Assured-based one.

| | Generated client | Hand-written client |
|---|---|---|
| Effort | near zero per endpoint | a few lines per operation |
| Drift detection | regenerate → compile errors show contract changes | only tests reveal changes |
| Negative testing | hard: generated methods accept only valid types | \`xxxRaw(Object body)\` sends anything |
| Readability | generic names (\`OrdersApi.createOrder(CreateOrderRequest)\`), verbose | domain names chosen by the team |
| Spec quality dependency | high — wrong spec, wrong client | none |
| Typical fit | models + happy-path setup for large, well-specified APIs | the test-facing layer |

**Recommendation:** generate **models** (and optionally a client used only for arranging data) when the spec is the source of truth and kept accurate; keep a thin hand-written client layer with raw methods for tests, because negative and security tests must send what the spec forbids. Pin the spec version the suite was generated from and regenerate in CI to surface drift. ShopEasy publishes no OpenAPI document (only a JSON Schema for products at \`/api/schema/product\`), so here everything is hand-written.

## 15. Anti-patterns reviewers reject

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| Business assertions inside clients (\`assertEquals(total, ...)\` in \`OrdersClient\`) | clients can't be reused for negative tests or UI setup; failures point at the wrong layer | clients check only the status of success (precondition) or nothing (raw) |
| \`static RequestSpecification spec\` mutated by tests, or \`RestAssured.baseURI = ...\` in \`@BeforeClass\` | races in parallel runs, order-dependent failures | \`SpecFactory\` building per-customer specs from an immutable config |
| A 3,000-line \`ApiUtils\` with \`post(String url, String json)\` | no domain language, everything is a string, every change touches one file | one client per resource + models |
| Hard-coded URLs, tokens, order ids (\`/api/orders/1001\`) | breaks per environment and after every reset | \`ApiConfig\`, token from login, ids extracted from responses |
| Tests depending on each other's data (\`testB\` reads the order \`testA\` placed; \`priority\`/\`dependsOnMethods\` chains) | one failure cascades; can't run in parallel or alone | each test creates its own data through the API |
| \`log().all()\` everywhere | huge CI logs, leaked tokens | log on failure, Allure attachments, blacklist |
| Retrying every request on any failure | hides real defects and makes timing flaky | timeouts + a single, explicit retry only where an operation is known to be idempotent |
| Raw \`Map\` bodies in happy-path tests | typos in field names fail at runtime | records for valid requests; \`Map\`/strings only in negative tests |

## Common mistakes and debugging

* **"400 items must be an array" on every cart order.** \`OrderRequest\` serialized \`"items": null\`. Check the request in the Allure attachment; fix with \`@JsonInclude(NON_NULL)\`.
* **\`equalTo(82.05)\` fails with "Expected <82.05> but was <82.05F>".** JsonPath returns \`Float\` by default; configure \`NumberReturnType.DOUBLE\` once in the spec, or assert on the deserialized record.
* **\`UnrecognizedPropertyException\` after a backend release.** The API added a field and the mapper fails on unknown properties. Disable that feature for functional tests; cover the contract with schema tests.
* **Intermittent 401s in parallel runs.** Someone resets the environment mid-run or tokens are cached across environments. Search the run for \`/reset\` and compare \`X-Request-Id\` timestamps; enforce \`resetAllowed\` and invalidate tokens after reset.
* **A setup failure shows up as an NPE three lines later.** A client returned \`null\` or an unchecked \`Response\`. Typed methods must throw \`ApiCallException\` with status, request id and body.
* **Allure shows no requests for a failing test.** The filter is missing on that spec (often a hand-built \`given()\` bypassing the factory). Grep tests for \`given()\` without \`.spec(\` and route them through clients.

## Best practices for experienced engineers

* Tests speak business language; clients speak HTTP; config speaks environments — and imports only point downwards.
* Typed + raw methods per operation; typed methods enforce the success status with a precondition exception, raw methods enforce nothing.
* Immutable config and specs built per customer; zero writes to \`RestAssured\` statics.
* Every test creates its own data with valid-by-default builders and unique, prefixed identifiers; plan clean-up at environment level when the API has no delete.
* Reports and logs are evidence: every exchange attached, correlation/request ids visible, secrets never present (verify by reading an attachment).
* Put the client layer in its own module so UI tests, Cucumber steps and tools reuse it.
* Write a one-page "how to add an endpoint" guide and enforce the layering in code review (or with ArchUnit rules for imports).

## Interview questions

### Q: Walk me through the architecture of your API test framework.

**Short answer (30–60 s):** Tests on top, written in business language. Below them one client per resource — Auth, Products, Cart, Orders, Users — with typed methods for setup and raw methods for negative tests. Clients use specs from a \`SpecFactory\` built from an immutable \`ApiConfig\`, with filters for correlation ids, Allure and masked logging. Records model requests and responses; builders create unique valid test data.

**Detailed answer:** Each layer has one reason to change: requirements change tests, API changes change clients and models, environment changes change config. On ShopEasy a test reads "customer adds two backpacks and a tee, orders the cart, total 82.05, cart empty" with no paths or tokens. Parallel safety comes from per-customer specs and \`ThreadLocal\` sessions, not from synchronisation. The client module is reused by UI setup and Cucumber steps.

### Q: Should a client method return \`Response\`, \`ValidatableResponse\` or a model?

**Short answer (30–60 s):** Both a model and a \`Response\`: a typed method for arranging and happy paths that checks the success status and returns a record, and a raw method returning \`Response\` for negative tests.

**Detailed answer:** \`Response\` only pushes boilerplate into every test; typed only makes negative tests impossible; returning \`ValidatableResponse\` couples clients to assertions. The two-method pattern keeps arrange code to one line, lets negative tests send invalid bodies (\`Object body\`) and assert everything, and makes setup failures explicit (\`ApiCallException\` with \`X-Request-Id\`). For very large frameworks a typed \`ApiResult<T>\` wrapper is a valid alternative.

### Q: Why is \`RestAssured.baseURI = ...\` in a \`@BeforeClass\` a problem?

**Short answer (30–60 s):** It is global mutable static state: all threads and classes share it, so parallel classes for different environments or base paths overwrite each other, and the order of execution changes the result.

**Detailed answer:** The same applies to \`RestAssured.requestSpecification\`, \`RestAssured.filters\` and \`RestAssured.authentication\`. Build specs per customer from an immutable config instead; a shared spec is fine only if nobody mutates it. Show a race: one class sets base path \`/api\`, another \`/admin\`, and tests fail with 404 only under \`parallel="classes"\`.

### Q: How do you manage test data when the API has no delete endpoint?

**Short answer (30–60 s):** Make leftover data harmless: each test creates its own uniquely named user and never queries global lists. Clean up what the API allows, reset only on local/ephemeral environments, and handle the rest at environment level — nightly re-seed or a janitor for the test prefix.

**Detailed answer:** ShopEasy has no \`DELETE /api/users\` or order deletion; \`POST /api/reset\` wipes everything and is guarded so it only runs locally once. Unique usernames combine a run id and an atomic counter. I'd raise "test data lifecycle" as a testability requirement — an internal admin endpoint or a TTL — instead of putting SQL into the framework.

### Q: How do you make API failures easy to debug in CI?

**Short answer (30–60 s):** Every exchange attached to the report, request/correlation ids in every failure message, logging only on failure with secrets masked, and setup failures that say what was expected and what came back.

**Detailed answer:** \`AllureRestAssured\` attaches requests and responses; a correlation filter adds a step with the client correlation id and the server \`X-Request-Id\`, which is what the ShopEasy server logs. \`log().ifValidationFails()\` doesn't cover AssertJ assertions on models — the attachments do. Verify redaction by opening an attachment; keep the login out of reports.

### Q: REST Assured, Retrofit, Karate or Playwright for a new API suite?

**Short answer (30–60 s):** Match the team and the existing stack: REST Assured with a client layer for Java teams; Playwright request context if UI tests are already Playwright/TypeScript; Karate for fast low-code authoring; Retrofit/Feign when developers want to reuse production-style typed clients.

**Detailed answer:** Evaluate negative-testing freedom, logging/reporting, parallel support, IDE refactoring, hiring and the cost of a second language. REST Assured's test DSL, filters and schema module are strong for QA-owned suites; its weakness — tests calling the DSL directly — is solved by the client layer.

### Q: Would you generate the client from OpenAPI?

**Short answer (30–60 s):** Models and a setup client, yes, when the spec is accurate; the test-facing client stays hand-written with raw methods, because negative and security tests must send what the spec forbids.

**Detailed answer:** Generation turns contract drift into compile errors and removes boilerplate, but generated names are generic and the client blocks invalid input by design. Pin the spec version, regenerate in CI, and wrap generated APIs in domain clients where readability matters.

## Scenario-based questions

**1. You inherit 600 REST Assured tests with a static spec, an \`ApiUtils\` class and \`dependsOnMethods\` chains; the team wants parallel runs.** I'd first measure (runtime, flaky rate), then introduce \`ApiConfig\`, \`SpecFactory\` and two clients for the busiest resources (cart, orders) next to the old code, migrate the tests that fail most in parallel, break dependency chains by letting each test create its data, and make \`ApiUtils\` methods delegate to clients until they are unused. Parallel runs start with the migrated packages only. Progress is shown with numbers: tests migrated, runtime, flaky rate.

**2. The UI team wants to use your API clients for test setup, but your clients depend on TestNG and Hamcrest.** Move \`config\`, \`http\`, \`clients\`, \`models\` and \`data\` into an \`api-client\` Maven module with only REST Assured, Jackson and Allure dependencies; typed methods throw \`ApiCallException\` instead of assertion errors, so they work under any runner. State the ShopEasy limitation (the practice web shop does not use the API) and demonstrate the pattern on a real app's shared backend.

**3. Staging runs start failing with 409 \`USERNAME_TAKEN\` after a few weeks.** Usernames were derived from the test name, so reruns collide with users created by earlier runs that were never deleted (there is no delete endpoint). Fix uniqueness (run id + counter), then plan the data lifecycle: a janitor for the \`it_\` prefix or periodic re-seeding of staging — and ask for a delete/admin endpoint as a testability requirement.

## Tricky follow-ups

* **Q: Is a static field always wrong in a parallel framework?** No — static **immutable or stateless** objects (\`ShopEasyApi\`, \`ObjectMapper\` after configuration) are fine; static **per-test** state is the problem.
* **Q: Why does \`AuthClient\` use a different spec from the other clients?** Its request body contains the password and its response the token; no redaction option masks JSON body fields, so it is kept out of reports.
* **Q: Can a typed client method call \`then().statusCode(201)\`?** It works, but it turns a setup problem into an assertion failure that looks like a test failure, and ties the client to the REST Assured validation flow. A precondition exception with request id and body is clearer.
* **Q: Records compare by value — any trap when comparing a placed order with a read-back?** Field types must round-trip exactly: \`createdAt\` as \`Instant\` and money as values with the same precision; if the API reformatted timestamps, compare those fields separately.
* **Q: Where does the "8% tax" knowledge belong?** In the test (as an expected value or a small oracle), never in the client — clients describe how to call the API, not what it should calculate.`,
  keyPoints: [
    'Layers with one reason to change each: tests (business), clients per resource (HTTP), specs/filters (cross-cutting), models (contract), builders (valid unique data), config (environments); imports only point downwards.',
    'ApiConfig is an immutable record read from -D > env var > default, validated at start-up, without secrets, and it guards POST /api/reset to local only.',
    'SpecFactory builds a fresh spec per customer from immutable inputs — no RestAssured.* static assignments; one configured ObjectMapper, DOUBLE numbers, timeouts, masked logging.',
    'Clients expose a typed method (checks the success status, throws ApiCallException with X-Request-Id) and a raw method returning Response for negative tests.',
    'Every test creates its own customer with a valid-by-default UserBuilder and unique run-scoped usernames; ShopEasy has no delete-user endpoint, so leftovers must be harmless and clean-up is environment-level.',
    'Reporting: AllureRestAssured on every exchange (verify redaction for your Allure version), a correlation-id filter that also records the server X-Request-Id, and the login call kept unreported.',
    'Put the client layer in its own module so UI setup and Cucumber steps reuse it; choose REST Assured/Retrofit/Feign/HttpClient/Karate/Playwright by team fit, and generate models from OpenAPI only when the spec is accurate.',
  ],
  mistakes: [
    'OrderRequest serialised with "items": null, so ShopEasy answers 400 VALIDATION_FAILED "items must be an array" instead of ordering the cart. Fix: @JsonInclude(NON_NULL) on request records; inspect the attached request body.',
    'A shared static RequestSpecification (or RestAssured.baseURI) mutated in @BeforeClass — tests pass alone and fail under parallel="classes". Fix: SpecFactory builds per-customer specs from an immutable ApiConfig; grep for "RestAssured." assignments.',
    'Business assertions inside clients, making them unusable for negative tests and UI setup. Fix: clients check only the success status (precondition exception) or nothing (raw); assertions live in tests.',
    'Usernames derived from test names collide on shared environments (409 USERNAME_TAKEN) because users are never deleted. Fix: run id + atomic counter, a test prefix, and an environment-level janitor or re-seed.',
    'Calling POST /api/reset between tests to "clean up" — parallel tests lose their tokens and fail with 401. Fix: reset once before the suite on local only (ApiConfig guard) and invalidate the token cache.',
    'Trusting log().ifValidationFails() for model-based tests — AssertJ failures log nothing. Fix: attach every exchange with AllureRestAssured and put X-Request-Id into exception messages.',
  ],
  tryIt: `Start the API (\`npm run api\`, http://localhost:5181) and build the framework skeleton:
1. \`ApiConfig\` (record, \`-D\` > env > default, reset guard) and \`SpecFactory\` with \`anonymous()\`, \`forToken()\`, \`unreported()\`, DOUBLE numbers, timeouts and \`LogConfig\` blacklisting.
2. Records for \`Cart\`, \`CartItem\`, \`AddItem\`, \`OrderRequest\` (with \`@JsonInclude(NON_NULL)\` — remove it once and watch the 400), \`Order\`, \`NewUser\`, \`User\`.
3. \`CartClient\` and \`OrdersClient\` with typed + raw methods, \`AuthClient\` with a token cache, \`UsersClient.register\`, and a \`ShopEasyApi.newCustomer(...)\` facade; \`UserBuilder\` with run-scoped unique usernames.
4. \`BaseApiTest\` with a \`ThreadLocal<CustomerSession>\` and the three tests from the lesson (happy order 82.05, cart rules 409/422/400, another customer 403); run them with \`parallel="methods" thread-count="4"\` three times in a row without restarting the API.
5. Add \`CorrelationIdFilter\` and \`AllureRestAssured\`, run \`allure serve\`, open an attachment and confirm the \`Authorization\` header is redacted and the login exchange is absent; find one test's \`X-Request-Id\` in the API console output.`,
  problems: ['api-011', 'api-019', 'api-039', 'api-044'],
}
