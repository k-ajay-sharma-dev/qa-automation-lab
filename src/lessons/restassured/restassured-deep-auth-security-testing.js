export default {
  slug: 'restassured-deep-auth-security-testing',
  category: 'restassured',
  order: 14,
  title: 'Deep dive: authentication, authorisation and security testing for APIs',
  minutes: 32,
  summary: 'Test API security like a senior SDET — every auth scheme REST Assured supports and when to use it, JWTs from a tester\'s point of view (decode, assert claims, tampered and none-alg tokens), OAuth 2.0 flows in a test framework, a thread-safe expiry-aware TokenProvider, authorisation matrices (BOLA/IDOR, vertical escalation, mass assignment), a data-driven negative auth suite, the OWASP API Security Top 10 (2023) mapped to automatable checks, injection and resource-limit probes, sensitive-data and TLS checks — with honest findings from the ShopEasy API.',
  manualAnalogy: `As a manual tester you already log in as one customer, copy the URL of their order and open it in a second browser logged in as another customer — and you raise a P1 if it opens. You try a blank password, an expired session, a pasted-in admin URL. API security testing is the same instinct made systematic: every endpoint, every role, every malformed credential, on every build — and an honest line between what your suite can prove and what a security specialist must assess.`,
  body: `## Where the earlier lessons stop

The *Auth tokens and chaining requests* lesson (\`api-auth-and-chaining\`) showed the ShopEasy login → token → \`Authorization: Bearer\` flow, why you don't log in inside every test, and that every suite needs a 401 check. *From tests to a framework* (\`api-framework-design\`) introduced filters and log masking, and \`api-parallel-and-isolation\` made every test own its customer. This lesson goes from "the token works" to **"the API cannot be abused"**:

* which authentication schemes exist and how REST Assured drives each one;
* JWTs and OAuth 2.0 from the tester's side — what to decode, what to assert, what not to automate;
* a production-grade \`TokenProvider\` (caching, expiry, concurrency, no leaked secrets);
* **authorisation** testing — the part most suites skip and most breaches exploit;
* the OWASP API Security Top 10 (2023) turned into tests, plus injection, resource limits, data exposure and TLS.

Filters, config classes and spec merging internals are in \`restassured-deep-internals-http\`; JSON/schema assertions in \`restassured-deep-assertions-json-contracts\`; how the token provider fits into a full framework in \`restassured-deep-api-framework-architecture\`.

> **Scope and ethics.** Everything here is for systems you are **authorised** to test: your own product in your own test environments, with the security team aware of what you run. Injection payloads, token tampering and load probes against systems you don't own — or against production without written approval — can be illegal and can take a shared environment down. A senior engineer agrees the scope (hosts, accounts, rate) before the first probe and keeps destructive probes out of shared CI environments.

### What the ShopEasy API actually does (read from \`scripts/api-server.mjs\`)

Everything below that says "ShopEasy" was checked against the server source. The facts you need:

| Area | Behaviour |
|---|---|
| Login | \`POST /api/auth/login\` \`{ username, password }\` → 200 \`{ token, tokenType: "Bearer", expiresIn: 3600, user: { id, username } }\`; 400 \`VALIDATION_FAILED\`, 401 \`INVALID_CREDENTIALS\` (same message for unknown user and wrong password), 403 \`USER_LOCKED\` (only after a correct password) |
| Token | **Opaque**, not a JWT: \`se_<userId>_<4-digit global sequence>_<hex of the username, 12 chars>\`. Stored in memory; **never expires** — only \`POST /api/reset\` or a restart drops it. A new login does not revoke older tokens |
| 401 | \`error.code\` \`UNAUTHORIZED\`, header \`WWW-Authenticate: Bearer realm="shopeasy"\`; message differs: header missing vs "invalid or expired" |
| Scheme parsing | \`^Bearer\\s+(\\S+)$\`, case-insensitive: \`bearer abc\` is accepted, \`Basic …\`, a bare token or \`Bearer a b\` are 401 |
| Ownership | \`GET /api/orders/{id}\` of another customer → **403 \`FORBIDDEN\`**; \`PUT/PATCH /api/users/{id}\` and avatar upload/delete for another user → 403 |
| Read-only fields | \`PUT/PATCH /api/users/{id}\` changing \`id\`, \`username\` or \`roles\` → 422 \`READ_ONLY_FIELD\` |
| Users | \`GET /api/users/{id}\` needs **no auth** and returns email, phone and address |
| Limits | avatar file > 100 KB → 413 \`PAYLOAD_TOO_LARGE\`; whole multipart request > 2 MB → 413; \`size\` 1–50 on products; \`/api/slow?ms\` capped at 10000. JSON bodies have **no size limit**; there is **no rate limiting** |
| Errors | always \`{ error: { code, message, details? } }\`; unexpected errors → 500 \`INTERNAL_ERROR\` with a generic message (no stack trace) |
| Seed users | \`standard_user\` (id 1), \`locked_out_user\` (id 2), \`visual_user\` (id 3), all \`secret_sauce\`; \`POST /api/users\` registers more |

Several rows are **security findings** — we will write the tests that catch them rather than pretend they are fine.

## 1. Authentication schemes and how REST Assured supports them

### How it works internally

Every scheme ends up as one of three things on the wire: an **\`Authorization\` header**, a **cookie**, or (badly) a **query parameter** — plus mutual TLS at the transport layer. REST Assured's \`auth()\` DSL is a convenience over those. Two details matter in interviews:

* **Preemptive vs challenged.** \`auth().basic(u, p)\` is *challenged*: REST Assured sends the request **without** credentials, and only if the server answers 401 with \`WWW-Authenticate: Basic …\` does the underlying HTTP client retry with credentials. That doubles the calls and fails against APIs that answer 401 without a Basic challenge (or answer 403/404 to anonymous calls). \`auth().preemptive().basic(u, p)\` sends the header on the first request — what you want for almost every REST API.
* **\`auth().oauth2(token)\`** simply adds \`Authorization: Bearer <token>\` — it does not run any OAuth flow. It is equivalent to \`.header("Authorization", "Bearer " + token)\`. OAuth **1** (\`auth().oauth(consumerKey, consumerSecret, accessToken, secretToken)\`) really signs each request and needs the ScribeJava dependency on the classpath.

### Syntax and the scheme table

| Scheme | REST Assured | On the wire | Notes for testers |
|---|---|---|---|
| Basic, preemptive | \`auth().preemptive().basic("u", "p")\` | \`Authorization: Basic base64(u:p)\` on request 1 | Default choice for Basic. Only over TLS — base64 is encoding, not encryption |
| Basic, challenged | \`auth().basic("u", "p")\` | anonymous call → 401 + challenge → retry | Use only to test the challenge itself |
| Digest | \`auth().digest("u", "p")\` | challenge/response with nonce | Legacy; rare in REST |
| Bearer / OAuth 2 token | \`auth().oauth2(token)\` or \`.header("Authorization", "Bearer " + token)\` | \`Authorization: Bearer …\` | Same bytes; the header form is clearer in negative tests |
| API key in header | \`.header("X-API-Key", key)\` | custom header | Fine; rotate and scope keys |
| API key in query | \`.queryParam("api_key", key)\` | \`?api_key=…\` | **Avoid** — see below |
| Cookie session | \`.cookie("SESSION", id)\`, \`.sessionId(id)\`, \`SessionFilter\`, \`CookieFilter\` | \`Cookie: …\` | Browser-style apps; watch CSRF |
| Form login (+ CSRF) | \`auth().form("u", "p", FormAuthConfig…)\`, \`given().csrf("/login")\` (5.2.0+) | form POST, then cookie | For server-rendered apps; see below |
| OAuth 1.0a | \`auth().oauth(ck, cs, at, ts)\` + ScribeJava | signed header | Legacy partner APIs only |
| Mutual TLS | \`keyStore(...)\` / \`trustStore(...)\` or \`SSLConfig\` | client certificate in the TLS handshake | Service-to-service; test env needs its own certs |

**Why API keys in the query string are bad:** URLs are written to access logs, proxy logs, browser history, analytics tools and \`Referer\` headers; the key leaks to places nobody audits. Headers are not logged by default. A test that asserts "the API **rejects** \`?api_key=\` and only accepts the header" is a cheap, valuable regression check.

### Cookies, sessions and CSRF

\`\`\`java
// 1. Session id you already have (e.g. from a login response):
given().sessionId(sessionId)            // cookie name from SessionConfig, default JSESSIONID
       .get("/account");

// 2. SessionFilter: captures the session id from a response and re-sends it on later requests
SessionFilter session = new SessionFilter();             // io.restassured.filter.session
given().filter(session).formParam("username", "u").formParam("password", "p").post("/login");
given().filter(session).get("/account");                 // same session

// 3. CookieFilter: keeps every cookie like a browser cookie jar
CookieFilter cookies = new CookieFilter();               // io.restassured.filter.cookie
\`\`\`

**CSRF.** Cookie-authenticated, server-rendered apps protect state-changing requests with a CSRF token (hidden form field or header). Since REST Assured 5.2.0 there is a \`csrf(..)\` DSL: \`given().csrf("/users").formParam(...).post("/users")\` first GETs \`/users\`, finds the token in the HTML (a field named \`_csrf\` is auto-detected) and sends it; 5.3.0 improved sending it as a header, and \`CsrfConfig\` (\`csrfHeaderName(..)\`, \`sendCsrfTokenAsHeader()\`/\`sendCsrfTokenAsFormParam()\`) configures it. Form authentication can be combined with it. Treat this as *illustrative* and check the \`CsrfConfig\` javadoc of your version — the 6.x/7.x changelogs still contain CSRF fixes. **ShopEasy is pure Bearer** (no cookies), so CSRF does not apply to it: a token in a header cannot be sent cross-site by a browser automatically, which is exactly why header tokens are not CSRF-prone.

The security test worth having for a cookie app: a state-changing POST **without** the CSRF token (but with a valid session cookie) must be refused (typically 403).

### Recommended approach

For REST APIs: **Bearer tokens via the header, added in one place** (a spec or a filter backed by a \`TokenProvider\`), \`preemptive()\` for Basic, never query-string keys, and \`SessionFilter\`/\`csrf()\` only for cookie-based server-rendered apps. Avoid \`RestAssured.authentication = ...\`: it is global static state that leaks between parallel tests (see \`api-parallel-and-isolation\`).

## 2. JWT for testers

ShopEasy's token is opaque, so this section uses a **typical real app** that issues JWTs (Auth0, Keycloak, Cognito, Spring Authorization Server…).

### Structure

A signed JWT (JWS compact form) is \`base64url(header).base64url(payload).base64url(signature)\`:

* **header** — \`{"alg":"RS256","typ":"JWT","kid":"2024-05"}\`: algorithm and which key signed it;
* **payload (claims)** — \`iss\` (issuer), \`sub\` (subject/user id), \`aud\` (intended API), \`exp\`/\`iat\`/\`nbf\` (epoch **seconds**), \`scope\`/\`roles\`, custom claims;
* **signature** — over \`header.payload\` with the issuer's key. Anyone can **read** a JWT; only the key holder can **produce** a valid one. Never put secrets in claims.

### Decoding claims in a test — no library needed

\`\`\`java
package com.shopeasy.api.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/** Reads (does NOT verify) a JWS compact token. For assertions in tests only. */
public record JwtView(Map<String, Object> header, Map<String, Object> claims, String signature) {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    public static JwtView parse(String token) {
        String[] parts = token.split("[.]", -1);          // -1 keeps an empty signature part
        if (parts.length != 3) {
            throw new IllegalArgumentException("Expected header.payload.signature, got " + parts.length + " part(s)");
        }
        return new JwtView(json(parts[0]), json(parts[1]), parts[2]);
    }

    private static Map<String, Object> json(String base64Url) {
        byte[] bytes = Base64.getUrlDecoder().decode(base64Url);   // URL alphabet, padding optional
        try {
            return MAPPER.readValue(new String(bytes, StandardCharsets.UTF_8), MAP);
        } catch (Exception e) {
            throw new IllegalArgumentException("Token part is not JSON", e);
        }
    }

    public String alg()          { return (String) header.get("alg"); }
    public String issuer()       { return (String) claims.get("iss"); }
    public Instant expiresAt()   { return Instant.ofEpochSecond(((Number) claims.get("exp")).longValue()); }
    public Instant issuedAt()    { return Instant.ofEpochSecond(((Number) claims.get("iat")).longValue()); }

    @SuppressWarnings("unchecked")
    public List<String> audience() {                    // "aud" may be a string OR an array
        Object aud = claims.get("aud");
        return aud instanceof List<?> l ? (List<String>) l : List.of((String) aud);
    }

    /** Re-encode with changed parts — for negative tests. */
    public static String encode(Map<String, Object> header, Map<String, Object> claims, String signature) {
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        try {
            return enc.encodeToString(MAPPER.writeValueAsBytes(header)) + "."
                 + enc.encodeToString(MAPPER.writeValueAsBytes(claims)) + "." + signature;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
\`\`\`

**Step by step:** \`split("[.]", -1)\` keeps a trailing empty segment (a \`none\`-alg token ends with a dot). JWTs use the **URL-safe** Base64 alphabet (\`-\` and \`_\`) *without* padding — \`Base64.getDecoder()\` throws on them, \`getUrlDecoder()\` accepts missing padding. \`aud\` can legally be a string or an array, the classic source of a \`ClassCastException\` in naive helpers. Timestamps are seconds, not millis.

Optional libraries: \`com.auth0:java-jwt\` or Nimbus JOSE + JWT can decode **and verify** signatures against the issuer's JWKS. Use one when the test itself must prove signature validity; the dependency-free reader above is enough to assert claims.

### What to assert

\`\`\`java
@Test
void issuedTokenHasTheRightClaims() {
    String token = auth.login("qa_buyer_7", PASSWORD).token();     // typical real app
    JwtView jwt = JwtView.parse(token);

    assertThat(jwt.alg()).isIn("RS256", "ES256");                  // asymmetric, never "none" or HS256-with-shared-secret
    assertThat(jwt.issuer()).isEqualTo(config.expectedIssuer());
    assertThat(jwt.audience()).contains("orders-api");
    Duration lifetime = Duration.between(jwt.issuedAt(), jwt.expiresAt());
    assertThat(lifetime).isLessThanOrEqualTo(Duration.ofMinutes(15));  // the agreed policy
    assertThat(jwt.claims()).doesNotContainKeys("password", "email", "phone"); // no PII in a readable token
    assertThat((List<?>) jwt.claims().get("roles")).containsExactly("CUSTOMER");
}
\`\`\`

### Negative tokens the API must reject

| Token | How to build it | Expected |
|---|---|---|
| expired | ask the IdP for a short-TTL token in test env, or a test signing key + \`exp\` in the past | 401 |
| tampered payload | parse, change \`roles\` to \`["ADMIN"]\`, re-encode, keep the old signature | 401 |
| \`alg: none\` | header \`{"alg":"none"}\`, empty signature: \`encode(header, claims, "")\` | 401 |
| wrong audience | token issued for another API | 401 (or 403) |
| wrong issuer | token from another realm/tenant | 401 |
| signed with a different key | test key pair not in the JWKS | 401 |

\`\`\`java
@Test
void tamperedRoleIsRejected() {
    JwtView real = JwtView.parse(auth.login("qa_buyer_7", PASSWORD).token());
    Map<String, Object> claims = new HashMap<>(real.claims());
    claims.put("roles", List.of("ADMIN"));
    String forged = JwtView.encode(real.header(), claims, real.signature());

    given().spec(anonymous).header("Authorization", "Bearer " + forged)
    .when().get("/admin/orders")
    .then().statusCode(401);
}
\`\`\`

These tests protect against real library bugs and misconfiguration (accepting \`none\`, skipping \`aud\` checks, confusing HS256/RS256 keys). They are cheap and should run on every build of an auth-sensitive service.

## 3. OAuth 2.0 flows and how to test them

ShopEasy has its own username/password login; this section is a **typical real app** illustration.

| Flow | Who uses it | How a test gets a token |
|---|---|---|
| Client credentials | service-to-service, no user | one POST to the token endpoint — fully automatable |
| Authorization code + PKCE | browsers, mobile, SPAs (users) | needs a user login UI — don't drive it for every test |
| Refresh token | long sessions | POST \`grant_type=refresh_token\` |
| Resource owner password (ROPC) | legacy; removed in OAuth 2.1 drafts | sometimes enabled only in test realms |
| Device code | TVs, CLIs | rarely in API suites |

### Client credentials

\`\`\`java
public String clientCredentialsToken(String scope) {
    return given()
            .baseUri(config.tokenUrl())
            .auth().preemptive().basic(config.clientId(), config.clientSecret())  // client_secret_basic
            .formParam("grant_type", "client_credentials")                      // sets x-www-form-urlencoded
            .formParam("scope", scope)
        .when()
            .post()
        .then()
            .statusCode(200)
            .extract().path("access_token");
}
\`\`\`

### Authorization code + PKCE — why not automate the login UI each time

The user logs in at the IdP's page, the app receives a \`code\`, and exchanges it (with the PKCE \`code_verifier\` whose hash it sent earlier) for tokens. Driving that page in every API test makes the suite slow, couples it to the IdP's HTML, trips MFA/CAPTCHA/bot protection, and fails for reasons unrelated to the API under test. Options, best first:

1. **A test realm/tenant** with dedicated test users and a grant that does not need a browser (ROPC or a token-exchange endpoint enabled *only* there), owned by the platform team.
2. **Log in through the UI once per suite** (Selenium/Playwright), capture the **refresh token**, then mint access tokens via \`grant_type=refresh_token\` — one UI login per user per run.
3. **Client credentials with impersonation/token exchange** where the IdP supports it.
4. A **test-only signing key** trusted by the API in non-prod, so tests mint their own JWTs — fastest, but the API must never trust it in production; guard it with config and a test.

Keep **one** end-to-end test of the real authorization-code flow (in the UI suite) so the integration itself is covered.

### Refresh tokens

Test: refresh returns a new access token; the old refresh token is **rejected** after rotation (if the IdP rotates); a revoked/logged-out session cannot refresh; refresh with another client's credentials fails.

## 4. Token management in a framework

### Requirements

* one login **per user per run** (not per test) — login endpoints are slow and often rate-limited;
* **thread-safe** under \`parallel="methods"\`, and no stampede: 8 threads needing the same user cause one login;
* **expiry-aware**: refresh shortly before \`expiresIn\`, with clock skew;
* invalidation after \`POST /api/reset\` or a 401;
* the token **never** appears in logs or reports.

**Per user or per user and thread?** If the server allows several concurrent tokens per user (ShopEasy does — each login adds a token and keeps older ones), cache **per user**. If a new login revokes the previous session (common in banking-style apps), two threads sharing a user will log each other out — key the cache by user **and** thread, or better, give every test its own user (\`api-parallel-and-isolation\`).

### Full code

\`\`\`java
package com.shopeasy.api.auth;

import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static io.restassured.RestAssured.given;

public final class TokenProvider {

    public record Credentials(String username, String password) {
        @Override public String toString() { return "Credentials[" + username + ", ****]"; } // never print the password
    }

    private record CachedToken(String value, Instant expiresAt) {
        boolean usableAt(Instant now, Duration skew) { return now.plus(skew).isBefore(expiresAt); }
        @Override public String toString() { return "CachedToken[****, expiresAt=" + expiresAt + "]"; }
    }

    private final RequestSpecification anonymous;      // base URI + /api + JSON, no auth
    private final Clock clock;
    private final Duration skew;
    private final ConcurrentHashMap<String, CachedToken> cache = new ConcurrentHashMap<>();

    public TokenProvider(RequestSpecification anonymous, Clock clock, Duration skew) {
        this.anonymous = anonymous;
        this.clock = clock;
        this.skew = skew;
    }

    /** Cached, refreshed shortly before expiry; one login per user even under parallel load. */
    public String tokenFor(Credentials c) {
        return cache.compute(c.username(), (user, current) ->
                current != null && current.usableAt(clock.instant(), skew) ? current : login(c)
        ).value();
    }

    /** After a 401 or POST /api/reset. */
    public void invalidate(String username) { cache.remove(username); }
    public void invalidateAll()             { cache.clear(); }

    private CachedToken login(Credentials c) {
        Map<String, Object> body = given()
                .spec(anonymous)
                .contentType(ContentType.JSON)
                .body(Map.of("username", c.username(), "password", c.password()))
            .when()
                .post("/auth/login")
            .then()
                .statusCode(200)
                .extract().as(Map.class);
        String token = (String) body.get("token");
        long expiresIn = ((Number) body.get("expiresIn")).longValue();   // ShopEasy: 3600 (advertised)
        return new CachedToken(token, clock.instant().plusSeconds(expiresIn));
    }
}
\`\`\`

**Step by step.** \`ConcurrentHashMap.compute\` runs the remapping function atomically **per key**: the first thread for \`standard_user\` logs in while the others for the same key wait, so there is no login stampede. The trade-off: the lock covers the key's hash bin, so a slow login can briefly block an unrelated key in the same bin — acceptable for a handful of users; with hundreds of users, use a per-key lock or \`computeIfAbsent\` + a \`CompletableFuture\` value. \`Clock\` is injected so an expiry test can use \`Clock.offset(...)\` instead of waiting an hour. The \`skew\` (e.g. 60 s) avoids sending a token that expires in flight. Both records override \`toString\` so a debugger, a logger or a failed assertion never prints a secret.

**ShopEasy honesty:** the server advertises \`expiresIn: 3600\` but never checks expiry; tokens die only on \`POST /api/reset\` or restart. So the provider's expiry logic is exercised by unit tests with a fake \`Clock\`, and the framework must call \`invalidateAll()\` after every reset — the classic "everything is 401 after reset" bug.

### Refresh once on 401 — carefully

\`\`\`java
public final class ProvidedBearerFilter implements io.restassured.filter.Filter {
    private final TokenProvider tokens;
    private final TokenProvider.Credentials user;

    public ProvidedBearerFilter(TokenProvider tokens, TokenProvider.Credentials user) {
        this.tokens = tokens;
        this.user = user;
    }

    @Override
    public Response filter(FilterableRequestSpecification req, FilterableResponseSpecification res, FilterContext ctx) {
        if (req.getHeaders().hasHeaderWithName("Authorization")) {
            return ctx.next(req, res);                       // a negative test chose its own header: hands off
        }
        req.header("Authorization", "Bearer " + tokens.tokenFor(user));
        Response response = ctx.next(req, res);
        if (response.statusCode() == 401) {                  // token went stale (reset, restart, rotation)
            tokens.invalidate(user.username());
            req.removeHeader("Authorization");
            req.header("Authorization", "Bearer " + tokens.tokenFor(user));
            response = ctx.next(req, res);                   // exactly one retry
        }
        return response;
    }
}
\`\`\`

Only retry when the **filter** supplied the token, and only once; otherwise a genuine authentication regression would be hidden. Count the retries (a metric or a log line) — a rising number means the environment is being reset under your feet. Whether \`ctx.next\` can be called twice in your REST Assured version is worth a quick check; if not, retry at the client layer instead.

### Never log tokens

\`\`\`java
RestAssuredConfig cfg = RestAssuredConfig.config().logConfig(LogConfig.logConfig()
        .blacklistHeader("Authorization", "Cookie", "Set-Cookie", "X-API-Key")   // printed as [ BLACKLISTED ]
        .enableLoggingOfRequestAndResponseIfValidationFails());
\`\`\`

Header blacklisting arrived in REST Assured 4.2.0 and became case-insensitive in 5.3.2. It does **not** mask bodies: the login request body contains the password and the login response contains the token. Do not log the login call at all, or log it through a masking filter that replaces JSON fields such as \`password\`, \`token\`, \`access_token\`, \`refresh_token\`, \`client_secret\`. Check your report attachments too — the Allure integration is covered in \`restassured-deep-api-framework-architecture\`.

## 5. Authorisation testing

Authentication answers "who are you?"; authorisation answers "may **you** do **this** to **that object**?". Most API breaches are authorisation bugs: the endpoint checks that *a* valid token is present, not that the token's owner owns the object.

### The permission matrix

Write the matrix down first; it becomes the data provider.

| Endpoint | Anonymous | Owner | Other customer | Admin (typical real app) |
|---|---|---|---|---|
| \`GET /api/products\` | 200 | 200 | 200 | 200 |
| \`GET /api/cart\` | 401 | 200 (own cart) | — (scoped by token) | — |
| \`GET /api/orders/{id}\` | 401 | 200 | **403 \`FORBIDDEN\`** | 200 |
| \`PATCH /api/users/{id}\` | 401 | 200 | **403** | 200 / 403 per policy |
| \`POST /api/users/{id}/avatar\` | 401 | 201 | **403** | — |
| \`GET /api/users/{id}\` | **200 today** | 200 | **200 today** | 200 |
| \`POST /api/reset\` | **200 today** | 200 | 200 | test env only |

The bold "today" cells are findings (below).

### Horizontal escalation: BOLA / IDOR

Same role, someone else's object. On ShopEasy: Asha (standard_user) places an order; Vera (visual_user) asks for it by id.

\`\`\`java
@Test
void customerCannotReadAnotherCustomersOrder() {
    String asha = tokens.tokenFor(new Credentials("standard_user", "secret_sauce"));
    String vera = tokens.tokenFor(new Credentials("visual_user", "secret_sauce"));

    int orderId = given().spec(api).auth().oauth2(asha)
            .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
                         "items", List.of(Map.of("productId", 2, "quantity", 1))))
        .when().post("/orders")
        .then().statusCode(201).extract().path("id");

    given().spec(api).auth().oauth2(vera)
    .when().get("/orders/{id}", orderId)
    .then()
        .statusCode(403)
        .body("error.code", equalTo("FORBIDDEN"))
        .body("$", not(hasKey("items")))                // no order data leaks in the error body
        .body(not(containsString("560001")));            // nor the owner's postal code
}
\`\`\`

Do it for **every** endpoint that takes an id, including nested and less obvious ones (avatars, invoices, exports, attachments), and through every verb (\`GET\`, \`PUT\`, \`PATCH\`, \`DELETE\`).

**403 or 404?** ShopEasy answers 403 for another customer's order and 404 for a missing one — and order ids are sequential (1001, 1002…). So an attacker can **enumerate which orders exist**. Many teams prefer 404 for "exists but not yours" to avoid that oracle; others prefer 403 for clearer client errors. Neither is "the" answer — the test pins whichever the team decided, and you raise the enumeration risk in the review.

### Vertical escalation

A lower role calling a higher role's function: a customer calling \`DELETE /api/admin/products/1\` or \`POST /api/refunds\`. ShopEasy has only the \`CUSTOMER\` role, so the matrix row is illustrative — except for one real function-level issue: **\`POST /api/reset\` is unauthenticated** and wipes every user's data. In a practice server that is the point; in a real product a test-support endpoint like this must be absent from production builds or locked to an internal role. The automatable test: on every **non-local** environment, \`POST /api/reset\` returns 401/403/404, never 200.

### Mass assignment (OWASP API3: object *property* level)

The client sends properties it should not control and the server binds them blindly. What ShopEasy does — checked in the source and worth asserting:

| Probe | ShopEasy behaviour | Verdict |
|---|---|---|
| \`POST /api/users\` with \`"roles": ["ADMIN"]\`, \`"id": 1\`, \`"locked": true\` | 201; extra fields **silently ignored**; \`roles\` is \`["CUSTOMER"]\`, new id | Safe (ignore-list). Assert it |
| \`PATCH /api/users/{own}\` with \`"roles": ["ADMIN"]\` or a new \`username\` | **422 \`READ_ONLY_FIELD\`** with details | Safe and explicit — best behaviour |
| \`PATCH /api/users/{own}\` with \`"password"\` or \`"locked"\` | 200; field ignored | Safe, but silent |
| \`POST /api/orders\` with \`items[].price: 0.01\`, \`total: 1\`, \`userId: 3\`, \`status: "SHIPPED"\` | 201; price from the catalogue, totals recomputed, \`userId\` from the token, status \`PLACED\` | Safe — server computes money and ownership |
| \`POST /api/cart/items\` with \`price\` | ignored | Safe |

\`\`\`java
@Test
void registrationCannotGrantItselfARole() {
    String username = "mass_" + UUID.randomUUID().toString().substring(0, 8);
    given().spec(api)
        .body(Map.of("username", username, "password", "Passw0rd!", "firstName", "Mia", "lastName", "Test",
                     "email", username + "@example.test", "roles", List.of("ADMIN"), "id", 1))
    .when().post("/users")
    .then()
        .statusCode(201)
        .body("roles", contains("CUSTOMER"))
        .body("id", not(equalTo(1)))
        .body("$", not(hasKey("password")));
}

@Test
void orderPriceComesFromTheCatalogueNotTheClient() {
    given().spec(api).auth().oauth2(token)
        .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
                     "total", 0.01,
                     "items", List.of(Map.of("productId", 4, "quantity", 1, "price", 0.01))))
    .when().post("/orders")
    .then()
        .statusCode(201)
        .body("items[0].price", equalTo(49.99f))       // default JsonPath number type: Float
        .body("total", equalTo(53.99f));               // 49.99 + 8% (4.00)
}
\`\`\`

Recommendation for review comments: an explicit refusal (ShopEasy's \`READ_ONLY_FIELD\`) beats silent ignoring, and both beat binding. The test asserts the decided behaviour; a test that only checks status 201 proves nothing here.

### Negative authentication suite — data-driven

One data provider, every malformed credential, the full error contract asserted each time:

\`\`\`java
public class AuthenticationNegativeTest extends BaseApiTest {

    @DataProvider(parallel = true)
    public Object[][] badCredentials() {
        String valid = tokens.tokenFor(STANDARD_USER);
        String basic = Base64.getEncoder().encodeToString("standard_user:secret_sauce".getBytes(StandardCharsets.UTF_8));
        return new Object[][] {
            // description                        Authorization header value (null = absent)
            { "missing header",                   null },
            { "empty header",                     "" },
            { "scheme only",                      "Bearer" },
            { "scheme and space only",            "Bearer " },
            { "token without scheme",             valid },
            { "wrong scheme (Basic)",             "Basic " + basic },
            { "garbage token",                    "Bearer not-a-real-token" },
            { "token with trailing junk",         "Bearer " + valid + " extra" },
            { "truncated token",                  "Bearer " + valid.substring(0, valid.length() - 1) },
            { "forged token for another user",    "Bearer " + valid.replaceFirst("^se_1_", "se_3_") },
        };
    }

    @Test(dataProvider = "badCredentials")
    public void cartRejectsBadCredentials(String description, String authorization) {
        RequestSpecification req = given().spec(api);
        if (authorization != null) req.header("Authorization", authorization);

        req.when().get("/cart")
           .then()
           .statusCode(401)
           .header("WWW-Authenticate", containsString("Bearer"))
           .body("error.code", equalTo("UNAUTHORIZED"))
           .body("error.message", notNullValue())
           .body("$", not(hasKey("items")));
    }

    @Test
    public void schemeIsCaseInsensitive() {           // RFC 9110: auth scheme names are case-insensitive
        given().spec(api).header("Authorization", "bearer " + tokens.tokenFor(STANDARD_USER))
        .when().get("/cart").then().statusCode(200);
    }
}
\`\`\`

**Step by step.** \`null\` means "no header" — different from an empty header, and servers treat them differently (ShopEasy even returns different messages). The "forged" row rewrites the user id inside ShopEasy's predictable token; it must fail because the server looks the whole token up. The suite keeps "wrong **user**" separate: that is not a 401 case but a 403 case (the BOLA test above). The case-insensitivity test documents a deliberate behaviour so nobody "fixes" it into a regression.

Expired tokens: ShopEasy tokens never expire, so that row is missing; in a typical real app add \`{ "expired token", "Bearer " + expiredTokenFromTestIdp }\`. Also add a login negative table: wrong password, unknown user (**same** 401 \`INVALID_CREDENTIALS\` message — assert equality, it prevents user enumeration), missing fields (400 \`VALIDATION_FAILED\` with \`details[].field\`), locked user with the right password (403 \`USER_LOCKED\`).

### Token quality — a real ShopEasy finding

\`\`\`java
@Test(groups = "security-findings")
void tokensAreNotPredictable() {
    String t1 = auth.login("standard_user", "secret_sauce").token();
    String t2 = auth.login("standard_user", "secret_sauce").token();
    assertThat(t1).hasSizeGreaterThanOrEqualTo(32);
    assertThat(t1).doesNotContain("standard_user", HexFormat.of().formatHex("standard".getBytes(StandardCharsets.UTF_8)));
    assertThat(commonPrefixLength(t1, t2)).isLessThan(8);   // consecutive tokens share little
}
\`\`\`

Against ShopEasy this **fails**: tokens look like \`se_1_0001_7374616e6461\` — user id, a global counter and the username in hex. An attacker who knows a username can guess live tokens. That is OWASP API2 (Broken Authentication). Don't "fix" the test to match; keep it in a \`security-findings\` group linked to a ticket, excluded from the release gate until the decision is made. That is how a senior makes a risk visible without blocking every build.

## 6. OWASP API Security Top 10 (2023) mapped to tests

The 2023 edition (verified on the OWASP API Security project site):

| ID | Risk | Tests a QA engineer can automate | ShopEasy | Needs a specialist / tool |
|---|---|---|---|---|
| API1:2023 | Broken Object Level Authorization | owner/other/anonymous matrix on every id endpoint; sequential-id probes | orders/avatars/profile updates → 403 ✔; **\`GET /api/users/{id}\` anonymous → full profile ✘** | exhaustive discovery of id-bearing endpoints |
| API2:2023 | Broken Authentication | negative token suite, login enumeration, lockout, token entropy, expiry, revocation | consistent \`INVALID_CREDENTIALS\` ✔; **predictable, non-expiring tokens ✘** | crypto review, IdP config |
| API3:2023 | Broken Object Property Level Authorization | mass assignment probes; response must not contain fields the caller may not see | \`READ_ONLY_FIELD\` ✔, prices server-side ✔; **profile PII to anyone ✘** | — |
| API4:2023 | Unrestricted Resource Consumption | page-size caps, payload size limits (413), timeouts, 429 on bursts (light!) | \`size\` ≤ 50 ✔, avatar 413 ✔; **no JSON body limit, no rate limit ✘** | load/DoS testing (perf team, k6/Gatling) |
| API5:2023 | Broken Function Level Authorization | role matrix on admin/internal functions; HTTP verb tampering | only CUSTOMER role; **\`POST /api/reset\` unauthenticated** (fine locally, never in prod) | — |
| API6:2023 | Unrestricted Access to Sensitive Business Flows | business-rule abuse: quantity limits, coupon reuse, bulk checkout | quantity 1–10 → 422 ✔ | bot-protection design |
| API7:2023 | Server Side Request Forgery | for any field taking a URL: internal addresses (\`http://169.254.169.254/\`, \`localhost\`) refused | no URL inputs | deep SSRF testing |
| API8:2023 | Security Misconfiguration | headers (HSTS, \`Cache-Control: no-store\` on private data), CORS policy, verbose errors, TLS, \`405\` for unsupported verbs | generic 500 ✔, 405 + \`Allow\` ✔; \`Access-Control-Allow-Origin: *\` (acceptable without cookies, flag it for cookie apps) | config scanners, DAST |
| API9:2023 | Improper Inventory Management | compare deployed routes with the OpenAPI spec; old versions (\`/v1\`) still alive; test endpoints absent in prod | test-support \`/api/reset\`, \`/api/slow\` | API discovery tools |
| API10:2023 | Unsafe Consumption of APIs | contract/stub tests where your API consumes third parties (malformed or hostile upstream data) | — | architecture review |

**What to automate vs what to hand over.** Automate deterministic, **business-aware** checks that a scanner cannot know: "Vera must not see Asha's order", "price comes from the catalogue", "the 401 contract". Leave broad crawling, fuzzing, and exploit verification to security specialists and DAST tools — **OWASP ZAP** (open source, scriptable, has an API scan mode driven by an OpenAPI file and runs well in CI as a nightly job) or **Burp Suite** (manual/professional testing). A common setup: functional security tests in every PR, a ZAP baseline/API scan nightly against a disposable environment, a pen-test before major releases.

### The sensitive-data finding, written properly

\`\`\`java
@Test(groups = "security-findings", description = "SEC-142: profiles must not be readable anonymously")
void anonymousCannotReadAProfile() {
    given().spec(api)
    .when().get("/users/{id}", 1)
    .then()
        .statusCode(anyOf(is(401), is(404)))
        .body(not(containsString("asha.rao@shopeasy.test")));
}
\`\`\`

This fails today (200 with email, phone and address). Writing the test as **the requirement** — not as "200 with email" — is the senior move: the suite turns green the day the fix ships, and nobody can accidentally enshrine the leak.

## 7. Input validation and injection probes

The goal is not to exploit anything; it is to prove the API **validates types, lengths and formats** and **fails safely** (4xx with the error contract, never 500, never a stack trace or SQL fragment).

\`\`\`java
@DataProvider
public Object[][] hostileSearchTerms() {
    return new Object[][] {
        { "' OR '1'='1" }, { "1; DROP TABLE products --" }, { "{\\"$gt\\": \\"\\"}" },
        { "<script>alert(1)</script>" }, { "../../etc/passwd" }, { "%00" }, { "a".repeat(5000) },
    };
}

@Test(dataProvider = "hostileSearchTerms")
public void searchTreatsInputAsData(String q) {
    given().spec(api).queryParam("q", q)
    .when().get("/products")
    .then()
        .statusCode(200)                                        // ShopEasy: a plain "name contains" filter
        .body("total", equalTo(0))
        .body(not(containsStringIgnoringCase("syntax error")))
        .body(not(containsStringIgnoringCase("exception")));
}
\`\`\`

ShopEasy behaviour per probe type:

| Probe | Where | ShopEasy | What to assert in a real app |
|---|---|---|---|
| SQL/NoSQL syntax in a search term | \`?q=\` | 200, 0 results (in-memory filter) | 200 or 400 — never 500, never DB error text |
| type confusion: object instead of string | \`"firstName": {"$ne": null}\` on \`POST /api/users\` | 400 \`VALIDATION_FAILED\` (must be a string) ✔ | 400 with field details |
| string instead of integer | \`"productId": "1 OR 1=1"\` on \`POST /api/cart/items\` | 400 \`VALIDATION_FAILED\` ✔ | same |
| path injection | \`GET /api/products/1;DROP\` | 400 \`INVALID_ID\` ✔ | 400/404 |
| stored script | \`"firstName": "<script>…"\` on registration | 201, stored as-is | API may store it; consumers must encode on output — add a UI test that renders it as text |
| oversized file | avatar > 100 KB | 413 \`PAYLOAD_TOO_LARGE\` ✔ | 413 |
| oversized JSON | 5 MB \`firstName\` | accepted (no limit) ✘ | 413 or 400; field length limits |
| broken JSON | \`{"firstName":\` | 400 \`INVALID_JSON\` ✔ | 400, no parser stack trace |

Note the escaped quotes in the NoSQL payload: in Java source they are \`\\"\`; in REST Assured, \`queryParam\` URL-encodes the value for you — do not pre-encode or you will test \`%2527\`.

Keep oversized-payload tests **modest** (a few MB) and in an isolated environment; their job is to show a limit exists, not to load-test.

### Rate limiting (illustrative — ShopEasy has none)

\`\`\`java
@Test(groups = "isolated-env-only")
void loginIsRateLimited() {               // typical real app: 10 attempts per minute per account/IP
    Response last = null;
    for (int i = 0; i < 15 && (last == null || last.statusCode() != 429); i++) {
        last = given().spec(api).body(Map.of("username", "rl_probe_user", "password", "wrong-" + i))
                .post("/auth/login");
    }
    assertThat(last.statusCode()).isEqualTo(429);
    assertThat(last.header("Retry-After")).isNotBlank();
}
\`\`\`

Run it against a dedicated account and environment — it can lock accounts or trip WAF rules for your whole team. Against ShopEasy it would fail (no limiting), which is itself the finding for API2/API4.

## 8. Sensitive data exposure

Assert what must **not** be in responses — the opposite of normal functional assertions:

\`\`\`java
private static final List<String> FORBIDDEN_KEYS = List.of("password", "passwordHash", "secret", "ssn", "cardNumber", "cvv");

static void assertNoSecrets(Response r) {
    String body = r.asString();
    FORBIDDEN_KEYS.forEach(k -> assertThat(body).as("response leaks " + k).doesNotContainIgnoringCase("\\"" + k + "\\""));
}
\`\`\`

Use it on registration (\`POST /api/users\` → ShopEasy returns no \`password\` ✔), login (only the token, no password ✔), profile, order and error responses. Also check: error bodies don't echo credentials; \`Cache-Control: no-store\` on responses with personal data (ShopEasy sends none — informational); \`Location\` headers and URLs don't carry tokens; logs and reports from your own suite don't contain them (section 4).

## 9. TLS checks — the basics

ShopEasy runs on plain \`http://localhost\`, so this is for real environments:

* \`http://\` requests are redirected to HTTPS or refused; responses carry \`Strict-Transport-Security\`;
* the certificate validates against the normal trust store — **don't** use \`relaxedHTTPSValidation()\` in tests whose job includes checking TLS; for an internal CA, configure a trust store (\`trustStore(...)\`/\`SSLConfig\`) instead of turning validation off;
* old protocols (TLS 1.0/1.1) are refused — a plain Java \`SSLSocket\` with \`setEnabledProtocols(new String[] { "TLSv1.1" })\` must fail the handshake;
* mTLS endpoints reject calls without a client certificate.

Cipher suites, certificate chains and protocol details are better checked with dedicated tools (\`testssl.sh\`, \`sslyze\`) or the platform team's scanning — one line in the pipeline, not hand-written Java.

## Multiple approaches: where security tests live

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability | When to use |
|---|---|---|---|---|---|---|
| Inside functional tests | each feature test adds a 401/403 line | close to the feature | uneven coverage, easy to forget | free | scattered | small suites |
| Dedicated security test classes (matrix + data providers) | permission matrix as data, one test per rule type | complete, reviewable, reusable | needs the matrix kept current | fast | high | **default for product teams** |
| Generated from OpenAPI | iterate every operation: no token → 401, other user's id → 403 | catches new endpoints automatically | needs good specs and id fixtures | fast | high once built | many endpoints |
| DAST (ZAP) in CI | scanner crawls/attacks from the spec | finds generic issues you didn't think of | noisy, no business context, slow | minutes–hours | tool config | nightly / pre-release |
| Manual pen-test | specialists | depth, chained exploits | expensive, point-in-time | — | — | major releases, compliance |

**Recommended:** dedicated security test classes driven by an explicit permission matrix (run on every PR), plus an OpenAPI-driven "every operation needs auth" sweep once the spec is trustworthy, plus a nightly ZAP API scan — and a pen-test cadence owned by the security team. They complement, they don't replace each other.

## Equivalent in Playwright (TypeScript)

The same tests are short with \`APIRequestContext\` — one \`request.newContext({ extraHTTPHeaders: { Authorization: 'Bearer ' + token } })\` per user, then \`expect(res.status()).toBe(403)\`. Context separation per user makes horizontal-escalation tests natural; see \`pw-deep-api-testing\`. The design (matrix, negative table, findings group) is identical.

## Common mistakes and debugging

* **"Everything is 401 after a test passed locally."** Another test (or a Cucumber hook) called \`POST /api/reset\`, which drops all tokens; your cache still hands out dead ones. Find it by logging token-cache misses and \`X-Request-Id\` of the 401; fix with \`invalidateAll()\` after resets and per-test users.
* **Challenged Basic "doesn't send credentials".** Wireshark/logging shows one request with no \`Authorization\` and a 401 — the server didn't send a \`Basic\` challenge. Use \`preemptive()\`.
* **Negative test passes for the wrong reason.** A filter replaced the deliberately bad header with a valid token (expected 401, got 200), or the 401 came from a missing \`Content-Type\` rather than the token. Always assert \`error.code\` and the \`WWW-Authenticate\` header, not only the status.
* **JWT decode throws \`IllegalArgumentException: Illegal base64 character 2d\`.** \`2d\` is \`-\`: you used \`Base64.getDecoder()\` instead of \`getUrlDecoder()\`.
* **Tokens in CI logs.** Searching the Jenkins console for \`Bearer \` or \`se_\` finds them. Blacklist headers, don't log the login call, override \`toString\`, check report attachments.
* **BOLA test uses the same user twice** (both tokens from \`standard_user\`) and passes with 200 → you tested nothing. Assert that the two user ids differ as a precondition.

## Best practices for experienced engineers

* Keep a **written permission matrix** per resource and generate tests from it; review it with the developers when endpoints change.
* Test **objects you don't own** on every id-bearing endpoint and every verb; use fresh users per test so the "other" user really is other.
* Assert the **full error contract** in negative tests: status, \`error.code\`, challenge header, and *absence* of data.
* Write security findings as **requirements** in a \`security-findings\` group with ticket ids, not as tests that bless current behaviour.
* One token per user per run, thread-safe, expiry-aware, invalidated on reset; never in logs, reports or exception messages.
* Keep destructive or load-like probes (rate limits, large payloads) out of shared environments; agree scope with the security team.
* Know the boundary: QA owns business-aware authorisation and validation tests; specialists own exploitation, crypto and infrastructure.

## Interview questions

### Q: What is the difference between \`auth().basic()\` and \`auth().preemptive().basic()\`?

**Short answer (30–60 s):** \`basic()\` is challenged: the first request goes without credentials and the client only resends them after a 401 with a Basic challenge. \`preemptive().basic()\` sends the header immediately. For REST APIs I use preemptive — one call instead of two, and it works with servers that don't send a Basic challenge.

**Detailed answer:** Challenged auth is how browsers handle Basic: they wait for \`WWW-Authenticate: Basic realm=…\`. Many APIs answer anonymous calls with 401 and a Bearer challenge, 403 or even 404, so challenged mode never sends credentials and the test fails confusingly. Preemptive also makes the request visible in a single log entry. Use challenged mode only when the challenge itself is under test. In both cases Basic must only travel over TLS.

### Q: How do you test authorisation, not just authentication?

**Short answer (30–60 s):** With a permission matrix: for every endpoint and verb, which role or relationship (anonymous, owner, other user, admin) gets which status. Then data-driven tests create the object as one user and call it as the others — the BOLA/IDOR case is the most important.

**Detailed answer:** Example from ShopEasy: Asha places an order, Vera requests \`GET /api/orders/{id}\` → 403 \`FORBIDDEN\`, and the error body contains none of Asha's data. Repeat for profile updates and avatars (403), and add vertical cases (customer on admin functions) and property-level cases (mass assignment: \`roles\` → 422 \`READ_ONLY_FIELD\`, client-sent \`price\` ignored). Each test uses distinct, fresh users and asserts the precondition that they differ. Discuss 403 vs 404: ShopEasy's 403 plus sequential order ids lets an attacker learn which orders exist.

### Q: You get a JWT from the login API. What do you check in your tests?

**Short answer (30–60 s):** Decode header and payload (Base64URL), assert the algorithm (asymmetric, never \`none\`), issuer, audience, a sensible lifetime from \`iat\`/\`exp\`, roles/scopes, and no personal data in claims. Then negative tests: expired, tampered, \`alg: none\`, wrong audience, wrong issuer → 401.

**Detailed answer:** Reading claims doesn't need a library — split on dots, \`Base64.getUrlDecoder()\`, parse JSON; watch out for \`aud\` being string or array and \`exp\` in seconds. Verifying signatures in the test needs a library and the JWKS, which is useful when the test must prove the issuer. The tampering tests are the valuable part: they protect against libraries or configs that accept unsigned tokens, skip audience checks or mix HMAC/RSA keys.

### Q: How do you handle OAuth 2.0 authorization code + PKCE in automated API tests?

**Short answer (30–60 s):** I don't drive the IdP login page per test. I use a test realm with a non-interactive grant, or log in via UI once per suite and use the refresh token, or a test-only signing key trusted only in non-prod. One UI test keeps the real flow covered.

**Detailed answer:** Driving the login page couples API tests to IdP HTML, MFA and bot protection and multiplies runtime. Machine flows use client credentials directly. Whatever shortcut is used must be impossible in production — e.g. a test that asserts the prod API rejects tokens from the test key. Token handling is centralised in a \`TokenProvider\` with caching and expiry so nobody adds ad-hoc login code.

### Q: Design a token cache for a parallel API suite.

**Short answer (30–60 s):** A \`ConcurrentHashMap\` keyed by user, \`compute\` to fetch-or-reuse atomically per key, expiry from \`expiresIn\` minus skew, an injected \`Clock\`, invalidation on reset and on 401, and no token in \`toString\` or logs.

**Detailed answer:** \`compute\` prevents a stampede — eight threads asking for the same user trigger one login. Per-user is right if the server allows concurrent sessions; if a login revokes the previous session, key by user and thread or give each test its own user. A filter can add the token and retry exactly once on 401 after invalidating, but only when the filter set the header, so negative tests stay negative. Expiry logic is unit-tested with \`Clock.offset\`.

### Q: Map the OWASP API Top 10 to your test suite.

**Short answer (30–60 s):** API1 BOLA and API5 function-level → permission-matrix tests; API2 → negative token suite, enumeration, expiry; API3 → mass assignment and "field not in response" checks; API4 → size, page and rate limits; API8 → headers, CORS, error verbosity; API9 → routes vs OpenAPI, no test endpoints in prod. SSRF and unsafe consumption need targeted tests where URL inputs or upstream calls exist; broad scanning is ZAP/Burp territory.

**Detailed answer:** The QA value is business context: a scanner cannot know that Vera may not see Asha's order or that the client must not set a price. I would show concrete findings: in ShopEasy, profiles are readable anonymously (API1/API3), tokens are predictable and never expire (API2), JSON bodies are unbounded and nothing is rate-limited (API4), and \`/api/reset\` is an unauthenticated test endpoint (API5/API9 — fine locally, a release blocker if deployed).

### Q: How do you stop tokens and passwords leaking from your test suite?

**Short answer (30–60 s):** Log only on failure, blacklist \`Authorization\`/\`Cookie\`/\`Set-Cookie\` in \`LogConfig\`, don't log the login body or response, mask JSON fields in a custom filter, override \`toString\` of credential objects, check report attachments, and keep secrets in CI secret stores.

**Detailed answer:** Header blacklisting (4.2.0+, case-insensitive since 5.3.2) prints \`[ BLACKLISTED ]\`, but bodies are not masked, so the login exchange needs special handling. Reports are another channel: verify what your Allure version redacts. A CI step that greps artefacts for token patterns makes the rule enforceable.

## Scenario-based questions

**1. A developer says "the order endpoint checks the token, so security is covered."** I'd ask which user the token belongs to and whether the order is theirs — the gap is ownership. I'd add the BOLA test (create as Asha, read as Vera → 403), extend it to every id endpoint and verb from the OpenAPI spec, and present the permission matrix in the review so the rule is explicit. If the API returns 403 with sequential ids, I'd also raise the enumeration trade-off and let the team decide 403 vs 404.

**2. Your new security tests show that \`GET /api/users/{id}\` returns email and phone without a token, two days before release.** I'd write the test as the requirement (401/404, no email in body), mark it in a \`security-findings\` group with a ticket, and escalate with evidence: request, response, data classification (PII), and blast radius (sequential ids → every customer). The release decision belongs to the product owner and security; my job is to make the risk concrete and the fix verifiable, not to silently change the test to pass.

**3. After enabling parallel execution, 5% of tests fail with 401 at random.** Likely causes: a test or hook calling \`/api/reset\` (drops all tokens) while others run, a cache keyed incorrectly (sharing tokens across environments), or a server that revokes the previous session on login while threads share a user. I'd log cache hits/misses and the user per request, correlate the 401s with resets by timestamp and \`X-Request-Id\`, then move to per-test users and reset only once before the suite.

## Tricky follow-ups

* **Q: Is \`auth().oauth2(token)\` "doing OAuth"?** No — it only adds \`Authorization: Bearer <token>\`. Getting the token (the OAuth flow) is your code.
* **Q: Why is a CSRF token not needed for ShopEasy?** It authenticates with a header the browser never attaches automatically; CSRF exploits automatically-sent cookies.
* **Q: Can you trust claims you decoded in the test?** Only for assertions about what the server issued — decoding does not verify the signature. The API must verify; your negative tests prove it does.
* **Q: 401 or 403 for a valid token on someone else's order?** 403 (authenticated, not allowed) or 404 (hide existence) — never 401, which means "authenticate again".
* **Q: Your BOLA test passes — what else could be wrong?** Both tokens belonged to the same user, or the 403 came from a different rule (e.g. validation) — assert distinct user ids and the exact \`error.code\`.`,
  keyPoints: [
    'Prefer auth().preemptive().basic() over challenged basic; auth().oauth2(token) only adds a Bearer header; API keys belong in headers, never in query strings; csrf() (5.2.0+) and SessionFilter are for cookie-based server-rendered apps.',
    'Decode JWTs with Base64URL to assert alg, iss, aud, exp/iat and roles; prove the API rejects expired, tampered, none-alg, wrong-audience and wrong-issuer tokens.',
    'Don\'t automate the IdP login UI per test: client credentials for machines, a test realm, one UI login + refresh token, or a non-prod signing key — with one real end-to-end flow kept.',
    'A TokenProvider caches one token per user (ConcurrentHashMap.compute), refreshes before expiry with an injected Clock, invalidates after reset/401, and never exposes tokens in toString, logs or reports.',
    'Authorisation needs a permission matrix: BOLA/IDOR (ShopEasy: another customer\'s order → 403 FORBIDDEN), vertical escalation, and mass assignment (READ_ONLY_FIELD, server-side prices).',
    'Negative auth suites are data-driven and assert the full contract: 401, UNAUTHORIZED, WWW-Authenticate: Bearer, and no data in the body.',
    'Map OWASP API Top 10 (2023) to business-aware automated tests; leave broad scanning and exploitation to ZAP/Burp and specialists; write findings as requirements in a tracked group.',
    'Test only systems you are authorised to test; keep payload and rate probes modest and out of shared environments.',
  ],
  mistakes: [
    'Using challenged auth().basic() against an API that answers 401 with a Bearer challenge — credentials are never sent. Fix: auth().preemptive().basic(); check the request log shows Authorization on the first call.',
    'A token filter that always overwrites Authorization, so a "bad token → 401" test gets a valid token and 200. Fix: only add the header when absent and assert error.code plus WWW-Authenticate, not just the status.',
    'Reusing cached tokens after POST /api/reset — every call returns 401 UNAUTHORIZED. Fix: invalidateAll() after any reset, reset only once before the suite, and log token-cache misses.',
    'BOLA tests where both tokens belong to the same user (or the "other" user is an admin), so 200 looks correct. Fix: fresh distinct users per test and assert their ids differ before the security assertion.',
    'Rewriting a failing security test to match current behaviour (e.g. "GET /api/users/1 anonymous → 200"). Fix: keep the requirement, tag it security-findings with a ticket, exclude from the gate by decision, not by edit.',
    'Decoding JWTs with Base64.getDecoder() (IllegalArgumentException on - or _) or treating aud as always a string. Fix: getUrlDecoder() and handle string-or-array aud; exp/iat are epoch seconds.',
  ],
  tryIt: `Start the API (\`npm run api\`, http://localhost:5181) and build a \`security\` test package:
1. A \`TokenProvider\` as in the lesson with an injected \`Clock\`; unit-test the expiry logic with \`Clock.offset\`, and call \`invalidateAll()\` after \`POST /api/reset\`.
2. A data-driven \`AuthenticationNegativeTest\` on \`GET /api/cart\` (missing, empty, "Bearer", Basic, garbage, trailing junk, truncated, forged \`se_3_\` prefix) asserting 401, \`UNAUTHORIZED\` and \`WWW-Authenticate\`.
3. BOLA: register two fresh users via \`POST /api/users\`, place an order as the first, request it as the second → 403 \`FORBIDDEN\`, and assert the body contains none of the order's data. Repeat for \`PATCH /api/users/{id}\` and the avatar upload.
4. Mass assignment: register with \`roles: ["ADMIN"]\` (expect \`["CUSTOMER"]\`), \`PATCH\` your own \`roles\` (expect 422 \`READ_ONLY_FIELD\`), order with a client-side \`price\` (expect catalogue prices and an 8% tax).
5. Write the two ShopEasy findings as requirement tests in a \`security-findings\` group — anonymous \`GET /api/users/1\` and predictable tokens — run them, read the failures, and write a short risk note mapping each to OWASP API Top 10 (2023).`,
  problems: ['api-013', 'api-022', 'api-029', 'api-031'],
}
