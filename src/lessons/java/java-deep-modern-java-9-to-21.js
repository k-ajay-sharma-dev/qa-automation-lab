export default {
  slug: 'java-deep-modern-java-9-to-21',
  category: 'java',
  order: 16,
  title: 'Deep dive: modern Java (9–21) features that change how test code looks',
  minutes: 30,
  summary: 'Use the Java 9–21 language and library features that matter in an automation framework — var, collection factories, String and Optional additions, text blocks, switch expressions, records, sealed types and pattern matching, HttpClient, Files/Path, virtual threads, sequenced collections and helpful NPEs — know which version introduced each, when it helps and when it hurts, and plan a Java 8 → 17 → 21 migration of a test framework.',
  manualAnalogy: `A manual test case written in 2014 still works, but nobody would write it the same way today: the template has a fixed "expected result" table instead of free text, payload examples are pasted as formatted JSON rather than one long line, and the outcomes are a closed list (Pass, Fail, Blocked) instead of anything the tester feels like typing. Modern Java gives test code the same upgrades — records for the fixed table, text blocks for the pasted JSON, sealed types and pattern switches for the closed list of outcomes.`,
  body: `## Where the earlier lessons stop

The *Records, Optional and CSV test data* lesson showed record syntax, compact-constructor validation and \`Optional.orElseThrow\`. The *Conditions and loops* lesson used a basic \`switch\`, and problem java-018 replaces an if/else ladder with a switch expression. The *Functional programming* deep dive covered \`Stream.toList()\` versus the collectors. This lesson is the **map of everything Java 9–21 changed that shows up in test code**: what each feature is, which version made it standard, what the compiler does with it, and how a senior engineer decides whether to use it.

Baseline here is **Java 17** (LTS). Anything marked *Java 21* needs a Java 21 toolchain (\`<maven.compiler.release>21</maven.compiler.release>\`). Preview features are ignored — only finalised features are listed.

| Version | Feature (JEP where there is one) | Test-code impact |
|---|---|---|
| 9 | Collection factory methods \`List.of\`, \`Set.of\`, \`Map.of\` (JEP 269); \`Stream.takeWhile/dropWhile/ofNullable\`; \`Optional.or/ifPresentOrElse/stream\`; try-with-resources on effectively final variables | concise immutable test data |
| 10 | \`var\` (JEP 286); \`List/Set/Map.copyOf\`; \`Optional.orElseThrow()\`; \`Collectors.toUnmodifiableList\` | less noise, defensive copies |
| 11 (LTS) | \`HttpClient\` standard (JEP 321); \`String.isBlank/strip/lines/repeat\`; \`Files.readString/writeString\`; \`Path.of\`; \`Optional.isEmpty\`; \`Predicate.not\`; \`var\` in lambda parameters (JEP 323) | built-in API calls, simpler file I/O |
| 14 | Switch expressions (JEP 361); helpful NullPointerExceptions (JEP 358) | browser/env selection; faster debugging |
| 15 | Text blocks (JEP 378); \`String.formatted\` | JSON bodies and expected payloads |
| 16 | Records (JEP 395); pattern matching for \`instanceof\` (JEP 394); \`Stream.toList()\` | DTOs, test data |
| 17 (LTS) | Sealed classes (JEP 409) | closed result types |
| 21 (LTS) | Pattern matching for \`switch\` (JEP 441); record patterns (JEP 440); virtual threads (JEP 444); sequenced collections (JEP 431) | exhaustive result handling, cheap concurrency |

## \`var\` — local-variable type inference (Java 10)

### What it is and how it works

\`var\` lets the compiler infer the static type of a **local variable** from its initializer. It is a compile-time feature only: the bytecode and the class file contain the full inferred type, exactly as if you had written it. Nothing becomes dynamic. Technically \`var\` is a *reserved type name*, not a keyword, so an old variable called \`var\` still compiles, but a class called \`var\` does not.

Allowed: local variables with an initializer, enhanced-for variables, classic for-loop indexes, try-with-resources resources, and (Java 11, JEP 323) lambda parameters, e.g. \`(var a, var b) -> ...\`, which you only need when you want to annotate them. **Not** allowed: fields, method parameters, return types, \`var x;\` without an initializer, \`var x = null;\`, array initialisers \`var a = {1, 2};\`, and a lambda with no target type \`var f = () -> 1;\`.

### Before and after

\`\`\`java
// Before
Map<String, List<ProductRow>> rowsByCategory = new HashMap<String, List<ProductRow>>();
for (Map.Entry<String, List<ProductRow>> entry : rowsByCategory.entrySet()) { /* ... */ }
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

// After (Java 10+)
var rowsByCategory = new HashMap<String, List<ProductRow>>();
for (var entry : rowsByCategory.entrySet()) { /* ... */ }
var response = client.send(request, HttpResponse.BodyHandlers.ofString());
\`\`\`

### Where it hurts

\`\`\`java
var items = new ArrayList<>();            // ArrayList<Object> — the diamond has nothing to infer from
var total = cartPage.total();             // BigDecimal? double? String "$51.25"? The reader cannot tell
var driver = new ChromeDriver();          // type is ChromeDriver, not WebDriver: Chrome-only methods leak in
var count = 0;                            // int, so later count += 0.5 does not compile as intended
\`\`\`

The \`ChromeDriver\` case is the important one for frameworks: \`WebDriver driver = new ChromeDriver()\` deliberately programs to the interface (see problem java-010); \`var\` silently widens the variable to the concrete class and lets \`driver.getDevTools()\`-style Chrome-only calls creep into code that should run on Firefox.

**Readability rules a senior applies in review**

1. Use \`var\` when the type is **obvious from the right-hand side**: a constructor, a literal, a factory such as \`List.of(...)\`, a builder's \`build()\`.
2. Do not use it when the right-hand side is a method whose return type the reader must look up — especially for money, IDs and durations.
3. Never use it to declare a variable that should be typed as an interface (\`WebDriver\`, \`List\`).
4. Name variables better when you use \`var\`: \`var expectedTotal\` instead of \`var t\`.

## Collection factory methods (Java 9) and \`copyOf\` (Java 10)

### How they work internally

\`List.of\`, \`Set.of\` and \`Map.of\` return instances of the JDK's internal \`ImmutableCollections\` classes (in OpenJDK's implementation, field-based classes such as \`List12\` for one or two elements and array-backed \`ListN\` for more). They are **unmodifiable** (every mutator throws \`UnsupportedOperationException\`), **null-hostile** (\`List.of("a", null)\` throws \`NullPointerException\`, and so does \`list.contains(null)\`), and value-based (do not synchronise on them or rely on identity).

Two behaviours that bite test code:

- \`Set.of("a", "a")\` and \`Map.of("k", 1, "k", 2)\` throw \`IllegalArgumentException\` for duplicates — at **runtime**, not compile time.
- The iteration order of \`Set.of\` and \`Map.of\` is **unspecified**. In OpenJDK it is deliberately randomised per JVM run (a salt is mixed into the element positions), so a test that asserts on \`setOf.toString()\` or on the first entry of a \`Map.of\` may pass on your machine and fail in CI.

\`Map.of\` has overloads for up to **10** key-value pairs; above that use \`Map.ofEntries(Map.entry(k, v), ...)\`.

\`List.copyOf(collection)\` (Java 10) returns an unmodifiable copy and rejects nulls; if the argument is already an unmodifiable list from \`List.of\`, OpenJDK generally returns the same instance instead of copying (an implementation note, not a guarantee).

### Before and after

\`\`\`java
// Before (Java 8)
List<String> expectedCategories = Collections.unmodifiableList(
        Arrays.asList("accessories", "bags", "clothing", "kids"));
Map<String, String> loginForm = new HashMap<>();
loginForm.put("user-name", "standard_user");
loginForm.put("password", "secret_sauce");

// After (Java 9+)
List<String> expectedCategories = List.of("accessories", "bags", "clothing", "kids");
Map<String, String> loginForm = Map.of("user-name", "standard_user", "password", "secret_sauce");
\`\`\`

| | \`Arrays.asList\` | \`Collections.unmodifiableList\` | \`List.of\` | \`List.copyOf\` |
|---|---|---|---|---|
| Can add/remove | no | no | no | no |
| Can \`set(i, x)\` | **yes** (writes through to the array) | no | no | no |
| Nulls | allowed | allowed | NPE | NPE |
| Independent of source | no (array-backed view) | no (a view: source changes show through) | yes | yes |
| Use for | adapting an array | exposing a field you still mutate internally | literal test data | defensive copies in constructors and records |

**When to use:** \`List.of\`/\`Map.of\` for constant expected data; \`List.copyOf\` in the compact constructor of a record that holds a list (shown below). Avoid them when the data legitimately contains \`null\` (an API field that may be absent) — use \`Arrays.asList\` or an \`ArrayList\` there, or better, model the absence explicitly.

## \`Optional\` additions (Java 9–11)

The basics (\`ofNullable\`, \`map\`, \`orElseThrow\` with a supplier) are in the *Records, Optional* lesson and the *Functional programming* deep dive. The later additions:

| Method | Since | Use in tests |
|---|---|---|
| \`or(Supplier<Optional<T>>)\` | 9 | fall back to a second lookup source: env var, then config file |
| \`ifPresentOrElse(action, emptyAction)\` | 9 | log both branches without \`if (isPresent())\` |
| \`stream()\` | 9 | flatten a list of optionals: \`ids.stream().map(this::find).flatMap(Optional::stream)\` |
| \`orElseThrow()\` (no args) | 10 | the honest name for \`get()\` — throws \`NoSuchElementException\` |
| \`isEmpty()\` | 11 | reads better than \`!isPresent()\` |

\`\`\`java
// Before
String baseUrl = System.getenv("BASE_URL");
if (baseUrl == null) baseUrl = config.getProperty("base.url");
if (baseUrl == null) throw new IllegalStateException("No base URL configured");

// After (Java 9+)
String baseUrl = Optional.ofNullable(System.getenv("BASE_URL"))
        .or(() -> Optional.ofNullable(config.getProperty("base.url")))
        .orElseThrow(() -> new IllegalStateException("No base URL: set BASE_URL or base.url"));
\`\`\`

## \`String\` additions (Java 11 and 15)

| Method | Since | Behaviour | Test use |
|---|---|---|---|
| \`isBlank()\` | 11 | true for empty or whitespace only (Unicode-aware) | "error message is shown" checks |
| \`strip()\`, \`stripLeading()\`, \`stripTrailing()\` | 11 | removes Unicode whitespace (\`Character.isWhitespace\`) | cleaning \`getText()\` |
| \`lines()\` | 11 | \`Stream<String>\` split on \`\\n\`, \`\\r\` or \`\\r\\n\` | multi-line UI text, log files |
| \`repeat(n)\` | 11 | repeated string | boundary data: \`"a".repeat(41)\` for a 40-character limit |
| \`formatted(args...)\` | 15 | instance form of \`String.format\` | message templates, text blocks |

\`strip()\` versus \`trim()\` matters in UI tests: \`trim()\` removes only characters \`<= U+0020\`; it does **not** remove a non-breaking space (U+00A0) that a price formatter or \`&nbsp;\` produces. Note that \`strip()\` does not remove U+00A0 either, because \`Character.isWhitespace\` excludes non-breaking spaces by design — normalise those explicitly with \`replace('\\u00A0', ' ')\` before comparing.

\`\`\`java
// Before
assertTrue(error.getText() != null && error.getText().trim().length() > 0);
String longName = new String(new char[41]).replace("\\0", "a");

// After (Java 11+)
assertFalse(error.getText().isBlank(), "checkout error should be visible");
String longName = "a".repeat(41);
\`\`\`

## Text blocks (Java 15) for request bodies and expected payloads

### What it is and how the compiler processes it

A text block is a multi-line string literal delimited by \`"""\`. The opening delimiter **must be followed by a line break**; the content starts on the next line. At compile time javac performs three steps, in this order:

1. **Normalise line terminators** to \`\\n\` (so a file saved with Windows CRLF produces the same string).
2. **Strip incidental indentation**: it finds the minimum indentation over all non-blank content lines **and the line of the closing delimiter**, and removes that many leading whitespace characters from every line. Trailing whitespace on each line is removed too.
3. **Interpret escape sequences** — after stripping, so an escaped \`\\n\` or \`\\t\` is not affected by step 2.

The result is an ordinary \`String\` constant in the class file; there is no runtime cost.

Two text-block-specific escapes:

| Escape | Meaning | Use |
|---|---|---|
| \`\\\` at the end of a line | no line break here (line continuation) | long single-line values such as a URL or a one-line JSON |
| \`\\s\` | a single space that is **not** stripped | keep meaningful trailing spaces, pad fixed-width expected text |

\`"""\` inside the block must be escaped as \`\\"""\`; single \`"\` need no escaping — the main reason text blocks are so pleasant for JSON.

### Indentation: the closing delimiter decides

\`\`\`java
String a = """
        {"username": "standard_user"}
        """;      // closing delimiter aligned with content -> no leading spaces, ends with \\n

String b = """
        {"username": "standard_user"}
    """;          // closing delimiter 4 columns further left -> every line keeps 4 leading spaces

String c = """
        {"username": "standard_user"}""";   // delimiter on the last line -> no trailing \\n
\`\`\`

Whether the body ends with a newline matters when you compare it with \`assertEquals\` against a response body that has none. Prefer \`c\`'s form, or compare parsed JSON rather than raw strings.

### Complete example: RestAssured login and order tests against the ShopEasy API

\`\`\`java
package com.shopeasy.api;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

public class OrderApiTest {

    private static final String BASE = "http://localhost:5181/api";

    private static final String LOGIN_BODY = """
            {
              "username": "%s",
              "password": "%s"
            }""";

    private static final String ORDER_BODY = """
            {
              "firstName": "Asha",
              "lastName": "Rao",
              "postalCode": "560001",
              "items": [ { "productId": %d, "quantity": %d } ]
            }""";

    private String token() {
        return given().baseUri(BASE).contentType(ContentType.JSON)
                .body(LOGIN_BODY.formatted("standard_user", "secret_sauce"))
            .when().post("/auth/login")
            .then().statusCode(200).body("tokenType", equalTo("Bearer"))
                .extract().path("token");
    }

    @Test
    public void placesOrderForPulseBikeLight() {
        given().baseUri(BASE).contentType(ContentType.JSON)
                .auth().oauth2(token())
                .body(ORDER_BODY.formatted(2, 3))
            .when().post("/orders")
            .then().statusCode(201)
                .header("Location", notNullValue())
                .body("status", equalTo("PLACED"))
                .body("itemCount", equalTo(3));
    }

    @Test
    public void lockedUserGets403() {
        given().baseUri(BASE).contentType(ContentType.JSON)
                .body(LOGIN_BODY.formatted("locked_out_user", "secret_sauce"))
            .when().post("/auth/login")
            .then().statusCode(403).body("error.code", equalTo("USER_LOCKED"));
    }
}
\`\`\`

**Step by step**

- The JSON is readable and diffable in code review; before Java 15 it was \`"{\\"username\\": \\"" + user + "\\", ..."\` — the most common source of broken request bodies in older frameworks.
- \`%s\` / \`%d\` with \`.formatted(...)\` keep the template and the data apart. Text blocks have **no interpolation**: \`\${user}\` would be sent literally.
- \`formatted\` does not escape JSON. A value containing \`"\` or a backslash breaks the body. For data that comes from outside (CSV, random generators), build the body from a record or map and let Jackson serialise it (next section); keep text blocks for fixed payloads and expected responses.
- \`.auth().oauth2(token)\` sends \`Authorization: Bearer <token>\`, which is what \`/api/orders\` requires.

### Expected payloads

\`\`\`java
String expectedHealth = """
        {"status":"UP","service":"shopeasy-api"}""";
// Compare as JSON, not as text: key order and whitespace are not part of the contract.
JsonNode expected = mapper.readTree(expectedHealth);
JsonNode actual = mapper.readTree(response.asString());
assertEquals(actual.get("status"), expected.get("status"));
\`\`\`

Use JSON-aware comparison (Jackson \`JsonNode.equals\`, JSONAssert, or RestAssured's path matchers) rather than \`assertEquals(String, String)\`; a text-block comparison breaks on whitespace and key order that the API never promised.

| Approach for request bodies | Advantages | Disadvantages | When to use |
|---|---|---|---|
| Text block + \`formatted\` | readable, matches the API docs, zero dependencies | no escaping, no type safety | fixed payloads, negative tests with deliberately malformed JSON |
| \`Map.of(...)\` body (RestAssured serialises it) | quick | stringly typed keys, no nesting help | one-off small bodies |
| Record / POJO + Jackson | type-safe, escaping handled, reusable builders | more code | default for data-driven and reused payloads |
| JSON file in \`src/test/resources\` | non-developers can edit | indirection, templating needed | large contract fixtures |

**Recommended:** records for the bodies you send repeatedly, text blocks for fixed fixtures, expected payloads and invalid-JSON negative tests (\`{"username": "standard_user",\` — something a record cannot even produce).

## Switch expressions and \`yield\` (Java 14)

### How it differs from the statement switch

A switch **expression** produces a value. With arrow labels (\`case X ->\`) there is **no fall-through**, several labels can share a case (\`case "chrome", "edge" ->\`), and the compiler checks **exhaustiveness**: for an enum selector every constant must be covered (or a \`default\` given), otherwise it is a compile error. When a case needs several statements, use a block and \`yield\` the value (\`return\` would return from the enclosing method, so it is not allowed there).

\`\`\`java
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

public final class DriverFactory {
    public enum Browser { CHROME, FIREFOX, EDGE }

    public static WebDriver create(Browser browser, boolean headless) {
        return switch (browser) {
            case CHROME -> {
                var options = new ChromeOptions();
                if (headless) options.addArguments("--headless=new");
                yield new ChromeDriver(options);
            }
            case FIREFOX -> {
                var options = new FirefoxOptions();
                if (headless) options.addArguments("-headless");
                yield new FirefoxDriver(options);
            }
            case EDGE -> new EdgeDriver();
            // no default: adding SAFARI to the enum makes this a compile error — the point of exhaustiveness
        };
    }

    public static String baseUrl(String env) {
        return switch (env.strip().toLowerCase()) {
            case "local", "dev" -> "http://localhost:5180/practice-site";
            case "qa" -> "https://qa.shopeasy.test";
            default -> throw new IllegalArgumentException("Unknown env '" + env + "'; expected local, dev or qa");
        };
    }
}
\`\`\`

**Step by step:** \`yield\` returns the driver from the block; leaving out \`default\` on the enum switch turns "someone added a browser and forgot the factory" from a runtime \`null\` into a compile error; \`throw\` is allowed as a case body, so the string switch fails loudly with the valid values in the message. Switching on a \`String\` compiles to a \`hashCode()\` switch followed by \`equals\`, so it is O(1) on average, not a chain of comparisons.

**When to use:** any mapping from a closed set (enum, env name, HTTP status range) to a value. Prefer an enum with fields (problem java-031) when each constant carries several pieces of data; prefer a \`Map\` when the mapping is configuration rather than code.

## Records (Java 16) for test data and API DTOs

The *Records* lesson covered the syntax. What a senior needs on top:

### What the compiler generates

A record \`R(A a, B b)\` is a \`final\` class extending \`java.lang.Record\` with \`private final\` fields, a canonical constructor, accessors \`a()\`/\`b()\`, and \`equals\`/\`hashCode\`/\`toString\` based on all components. In OpenJDK the three object methods are not written out as bytecode; they are linked at runtime through an \`invokedynamic\` call to \`java.lang.runtime.ObjectMethods\` — which is why they stay correct when you add a component.

### Limitations to state in an interview

- Cannot extend another class (it already extends \`Record\`) and cannot be extended (it is final). It **can** implement interfaces — that is how records join sealed hierarchies below.
- No instance fields other than the components; static fields and methods are allowed.
- **Shallow** immutability: a \`List\` component can still be mutated by whoever holds the list — copy it with \`List.copyOf\` in the compact constructor.
- No no-arg constructor and no setters, so frameworks that require JavaBeans (JPA entities, some old reporting libraries) cannot use them.
- Arrays as components compare by reference in \`equals\` — use a \`List\`.
- Adding a component changes the canonical constructor and breaks every \`new\` call: use a static factory or builder for records with many components.

### Complete example: API DTOs with Jackson and validated test data

\`\`\`java
package com.shopeasy.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

public final class Dtos {

    @JsonIgnoreProperties(ignoreUnknown = true)          // tolerate new fields the API adds later
    public record Product(int id, String slug, String name, BigDecimal price,
                          String category, int stock, boolean inStock) { }

    public record OrderLine(int productId, int quantity) {
        public OrderLine {                                // compact constructor: validate, then fields are assigned
            if (productId < 1) throw new IllegalArgumentException("productId must be >= 1, was " + productId);
            if (quantity < 1) throw new IllegalArgumentException("quantity must be >= 1, was " + quantity);
        }
    }

    public record OrderRequest(String firstName, String lastName,
                               @JsonProperty("postalCode") String zip,   // Java name differs from JSON name
                               List<OrderLine> items) {
        public OrderRequest {
            Objects.requireNonNull(firstName, "firstName");
            items = List.copyOf(items);                  // defensive, unmodifiable copy (Java 10+)
        }
        public static OrderRequest of(String first, String last, String zip, OrderLine... lines) {
            return new OrderRequest(first, last, zip, List.of(lines));
        }
    }

    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper();
        var body = mapper.writeValueAsString(OrderRequest.of("Asha", "Rao", "560001", new OrderLine(2, 3)));
        System.out.println(body);
        // {"firstName":"Asha","lastName":"Rao","postalCode":"560001","items":[{"productId":2,"quantity":3}]}

        var json = """
                {"id":2,"slug":"pulse-bike-light","name":"Pulse Bike Light","price":9.99,
                 "category":"accessories","stock":40,"inStock":true,"description":"USB-rechargeable front light"}""";
        Product p = mapper.readValue(json, Product.class);
        System.out.println(p.price());                   // 9.99 as BigDecimal — no double rounding surprises
    }
}
\`\`\`

**Step by step**

- Jackson supports records natively from **2.12**: it serialises through the accessors and deserialises through the canonical constructor. On older Jackson you get "cannot construct instance" errors — check the version first.
- \`@JsonIgnoreProperties(ignoreUnknown = true)\`: by default \`FAIL_ON_UNKNOWN_PROPERTIES\` is on, and the JSON above has a \`description\` the record does not declare. Decide deliberately: ignore unknowns in **consumer-style** tests, fail on unknowns in **contract** tests where a new field is a change you want to notice (or validate the schema at \`/api/schema/product\` instead).
- Validation in the compact constructor also runs during deserialisation, so a response with \`quantity: 0\` fails at parse time with a clear message — sometimes you want that, sometimes (negative tests) you need a looser DTO for the response.
- \`BigDecimal\` for money, as in problem java-025.

| Test-data style | Advantages | Disadvantages | When to use |
|---|---|---|---|
| Record | value equality, readable \`toString\` in reports, immutability, tiny | no inheritance, positional constructor gets unreadable after ~5 components | expected/actual values, DTOs, DataProvider rows |
| Class + Lombok \`@Value\`/\`@Builder\` | builder with named fields and defaults | annotation processor dependency, IDE plugin | wide objects with many optional fields |
| Mutable POJO with setters | works with every framework | shared mutable state across parallel tests | only when a library demands JavaBeans |

**Recommended:** records by default; add a static factory or a small hand-written builder when a record has many optional components. Lombok's \`@Builder\` can also be placed on a record if the team already uses Lombok.

## Pattern matching for \`instanceof\` (Java 16)

\`\`\`java
// Before
if (cause instanceof WebDriverException) {
    WebDriverException wde = (WebDriverException) cause;
    log.warn("Driver failure: {}", wde.getRawMessage());
}

// After (Java 16+)
if (cause instanceof WebDriverException wde && wde.getRawMessage() != null) {
    log.warn("Driver failure: {}", wde.getRawMessage());
}
\`\`\`

The binding \`wde\` is in scope only where the compiler can prove the test succeeded (**flow scoping**): after \`&&\`, inside the \`if\`, or after an early exit — \`if (!(o instanceof String s)) return; s.length();\` compiles. It does not work after \`||\`. The typical framework use is in \`equals\` implementations and in exception-unwrapping code (\`while (t instanceof InvocationTargetException ite) t = ite.getCause();\`).

## Sealed classes and interfaces (Java 17)

### What and why

A sealed type lists which classes may extend or implement it: \`sealed interface ApiResult permits Success, ClientError, ServerError\`. Each permitted subclass must be \`final\`, \`sealed\` or \`non-sealed\`, and must live in the same module (or the same package when you are in the unnamed module, which is the normal case for a test project). Records are implicitly \`final\`, so they fit perfectly. The list is recorded in the class file (the \`PermittedSubclasses\` attribute) and enforced by the JVM when classes are loaded, not only by javac.

The payoff is **exhaustiveness**: because the compiler knows every subtype, a \`switch\` over a sealed type needs no \`default\`, and adding a new subtype breaks the build at every place that must handle it. This is algebraic data types ("A is exactly one of B, C or D") in Java.

### Complete example: an ApiResult with pattern matching for switch and record patterns (Java 21)

\`\`\`java
package com.shopeasy.api;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public sealed interface ApiResult permits ApiResult.Success, ApiResult.ClientError, ApiResult.ServerError {

    record Success(int status, String body) implements ApiResult { }
    record ClientError(int status, String code, String body) implements ApiResult { }
    record ServerError(int status, String body) implements ApiResult { }

    static ApiResult from(HttpResponse<String> r) {
        int s = r.statusCode();
        if (s >= 200 && s < 300) return new Success(s, r.body());
        if (s >= 400 && s < 500) return new ClientError(s, extractCode(r.body()), r.body());
        return new ServerError(s, r.body());
    }

    private static String extractCode(String body) {        // tiny on purpose; use Jackson in real code
        int i = body.indexOf("\\"code\\":\\"");
        return i < 0 ? "UNKNOWN" : body.substring(i + 8, body.indexOf('"', i + 8));
    }

    /** Java 21: pattern matching for switch + record patterns + guards. Exhaustive without default. */
    static String describe(ApiResult result) {
        return switch (result) {
            case Success(int status, String body) when body.isBlank() -> "OK " + status + " with empty body";
            case Success(var status, var body)                          -> "OK " + status;
            case ClientError(var status, var code, var body) when status == 401 -> "Not authenticated (" + code + ")";
            case ClientError(var status, var code, var body)            -> "Client error " + status + " " + code;
            case ServerError(var status, var body)                      -> "Server error " + status + " — retryable?";
        };
    }

    static void main(String[] args) throws IOException, InterruptedException {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        for (var path : new String[] {"/api/products/2", "/api/products/999", "/api/products/abc"}) {
            var request = HttpRequest.newBuilder(URI.create("http://localhost:5181" + path)).GET().build();
            var result = ApiResult.from(client.send(request, HttpResponse.BodyHandlers.ofString()));
            System.out.println(path + " -> " + describe(result));
        }
        // /api/products/2   -> OK 200
        // /api/products/999 -> Client error 404 PRODUCT_NOT_FOUND
        // /api/products/abc -> Client error 400 INVALID_ID
    }
}
\`\`\`

**Step by step**

- Nested records in the interface body are implicitly static and live in the same file, so the \`permits\` clause could even be omitted (the compiler infers it from the same compilation unit); writing it out documents intent.
- \`case Success(int status, String body)\` is a **record pattern** (Java 21, JEP 440): it tests the type and **deconstructs** the components via the accessors in one step. \`var\` infers component types.
- \`when\` adds a **guard**. Cases are checked top to bottom, and the compiler rejects a case that is **dominated** by an earlier one: putting the unguarded \`Success(var status, var body)\` first makes the guarded one unreachable — a compile error.
- No \`default\`: the switch is exhaustive because \`ApiResult\` is sealed. Add \`record Timeout(...) implements ApiResult\` and \`describe\` stops compiling until you handle it. If a class compiled against an older version meets a new subtype at runtime, Java 21 throws \`MatchException\`.
- A pattern switch on a reference type throws \`NullPointerException\` for \`null\` unless you add \`case null ->\` (Java 21); a classic switch always did.
- The unnamed pattern \`_\` (\`case Success(var status, _)\`) for unused components is standard only from Java 22 (JEP 456) — on 21 you name them.

### Real-time automation scenario: modelling test outcomes

The same shape models what a step returned in a hybrid UI + API framework: \`sealed interface StepOutcome permits Passed, Failed, Skipped, Blocked\`, where \`Failed\` carries the cause and a screenshot path, and the reporting listener does an exhaustive switch to map outcomes to Allure statuses. When a teammate adds \`Retried\`, every consumer fails to compile instead of silently mapping it to "unknown".

| Approach to "one of N results" | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| Status code / enum + nullable fields | one class, check the code | simple, familiar | callers forget a branch; fields valid only for some codes | very small helpers |
| Class hierarchy + \`instanceof\` chain | open inheritance | flexible | no exhaustiveness; new subtype silently falls through | public extensible APIs |
| Visitor pattern | double dispatch | exhaustive (new method breaks visitors) | heavy boilerplate | pre-Java 17 code bases |
| Sealed interface + records + pattern switch | closed hierarchy, compiler-checked | exhaustive, concise, each case carries only its data | Java 17 (sealed) / 21 (pattern switch) | result types inside your framework |

**Recommended:** sealed interface + records on Java 21. On Java 17, sealed records still give you a closed set and \`instanceof\` patterns; you gain switch exhaustiveness when you move to 21.

## \`java.net.http.HttpClient\` (Java 11) versus RestAssured

The standard client replaced \`HttpURLConnection\`: an immutable, thread-safe \`HttpClient\` (build one, share it), immutable \`HttpRequest\` objects and \`BodyHandlers\` that decide how the body is read. It speaks HTTP/1.1 and HTTP/2, supports \`sendAsync\` returning a \`CompletableFuture\`, and from Java 21 \`HttpClient\` implements \`AutoCloseable\`.

### Complete example: a broken-link checker for the practice site

\`\`\`java
package com.shopeasy.ui;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public final class LinkChecker {

    public record LinkStatus(String url, int status) {
        public boolean broken() { return status >= 400 || status < 0; }
    }

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public static List<LinkStatus> check(WebDriver driver) {
        List<String> urls = driver.findElements(By.cssSelector("a[href]")).stream()
                .map(a -> a.getAttribute("href"))
                .filter(h -> h != null && h.startsWith("http"))
                .distinct()
                .toList();                                         // Java 16+

        List<CompletableFuture<LinkStatus>> futures = urls.stream()
                .map(url -> CLIENT.sendAsync(
                                HttpRequest.newBuilder(URI.create(url))
                                        .method("HEAD", HttpRequest.BodyPublishers.noBody())
                                        .timeout(Duration.ofSeconds(10))
                                        .build(),
                                HttpResponse.BodyHandlers.discarding())
                        .thenApply(r -> new LinkStatus(url, r.statusCode()))
                        .exceptionally(e -> new LinkStatus(url, -1)))  // connection refused, timeout
                .toList();

        return futures.stream().map(CompletableFuture::join).filter(LinkStatus::broken).toList();
    }
}
\`\`\`

**Step by step:** one shared client (it owns a connection pool and selector thread); \`HEAD\` with \`BodyHandlers.discarding()\` avoids downloading pages; \`sendAsync\` fires all requests concurrently and \`join\` collects them; \`exceptionally\` turns network failures into a status of -1 so one dead host does not abort the report. Some servers answer \`HEAD\` with 405 — fall back to \`GET\` for those URLs.

| | \`HttpClient\` (JDK) | RestAssured |
|---|---|---|
| How it works | plain request/response objects | given/when/then DSL over Apache HttpClient |
| Advantages | no dependency, async built in, HTTP/2, precise control | JSON/XML path assertions, auth helpers, request/response logging, filters, schema validation, Allure integration |
| Disadvantages | no assertion DSL, JSON needs Jackson, verbose | heavier dependency tree, sync only |
| Performance | lighter; async fan-out easy | fine for functional tests |
| Maintainability | more code per test | very readable tests |
| When to use | utilities: broken-link checks, health checks before a suite, polling, test-data setup calls inside UI frameworks | the API test suite itself |

**Recommended:** RestAssured for API **tests** (readability and failure messages matter most there); \`HttpClient\` for **infrastructure** inside the framework where pulling RestAssured into a UI module is unnecessary.

## \`Files.readString\` / \`writeString\` and \`Path.of\` (Java 11)

\`\`\`java
// Before (Java 8)
String json = new String(Files.readAllBytes(Paths.get("src/test/resources/payloads/order.json")), StandardCharsets.UTF_8);

// After (Java 11+)
Path payload = Path.of("src", "test", "resources", "payloads", "order.json");
String json = Files.readString(payload);                         // UTF-8 by default
Files.writeString(Path.of("target", "responses", "order-201.json"), response.asString());
\`\`\`

\`readString\` decodes as UTF-8 and throws \`MalformedInputException\` (an \`IOException\`) on invalid bytes instead of silently inserting replacement characters — a feature when a fixture was saved in Windows-1252. It reads the whole file into memory; for large logs use \`Files.lines(path)\` inside try-with-resources. \`writeString\` fails with \`NoSuchFileException\` if \`target/responses\` does not exist — call \`Files.createDirectories\` first. \`Path.of\` is the same as \`Paths.get\`; prefer \`Path.of\`. Avoid paths relative to the working directory in frameworks run from different modules: resolve from the classpath (\`getResource\`) or a configured root.

## Virtual threads (Java 21)

### What they are

A virtual thread is a \`java.lang.Thread\` that is scheduled by the JDK rather than the OS. Many virtual threads are multiplexed onto a small pool of **carrier** platform threads (a \`ForkJoinPool\` sized to the CPU count by default). When a virtual thread blocks on I/O inside the JDK (socket read, \`Thread.sleep\`, \`BlockingQueue.take\`), it is **unmounted**: its stack is saved to the heap and the carrier picks up another virtual thread. Creating one costs roughly a small heap object instead of an OS thread with a megabyte-scale stack, so you can have hundreds of thousands.

\`\`\`java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {          // Java 21
    List<Future<Integer>> results = productIds.stream()
            .map(id -> executor.submit(() -> fetchStatus("/api/products/" + id)))
            .toList();
    for (var f : results) assertEquals(f.get(), 200);
}   // close() waits for all tasks
\`\`\`

They make **blocking** code scale like async code. They do **not** make code faster: CPU-bound work gets no benefit, and each request still takes as long as the server takes.

### Do they help a test suite? An honest answer

- **UI suites: barely.** A WebDriver call is I/O-bound (an HTTP request to the driver or Grid), so a virtual thread would wait efficiently — but the bottleneck is **browser sessions**, not Java threads. Ten parallel Chrome instances need ten browsers' worth of CPU and memory or ten Grid slots; 10 platform threads cost nothing in comparison. TestNG's \`parallel="methods" thread-count="8"\` is limited by the browsers, and virtual threads cannot create more of them.
- **API fan-out and utilities: yes.** Broken-link checks, polling many endpoints, seeding hundreds of test users before a run, or a small load-smoke step: thousands of concurrent blocking HTTP calls with simple sequential code.
- **Caveats.** On Java 21, a virtual thread blocked inside a \`synchronized\` block is **pinned** to its carrier and does not unmount; libraries that synchronise around I/O reduce the benefit (fixed in Java 24 by JEP 491). \`ThreadLocal\` works, but one per virtual thread multiplied by 100,000 threads is a lot of memory — and never pool virtual threads to reuse a \`ThreadLocal<WebDriver>\`; the per-thread driver pattern belongs on the platform threads TestNG manages. Do not use them to overrun a shared test environment — limit concurrency with a \`Semaphore\`.

## Sequenced collections (Java 21)

JEP 431 added \`SequencedCollection\`, \`SequencedSet\` and \`SequencedMap\` interfaces above the collections that have a defined order (\`List\`, \`Deque\`, \`LinkedHashSet\`, \`TreeSet\`, \`LinkedHashMap\`, \`TreeMap\`).

\`\`\`java
// Before
String cheapest = sortedNames.get(0);
String priciest = sortedNames.get(sortedNames.size() - 1);
String firstKey = linkedMap.keySet().iterator().next();
List<String> desc = new ArrayList<>(sortedNames); Collections.reverse(desc);

// After (Java 21)
String cheapest = sortedNames.getFirst();
String priciest = sortedNames.getLast();
String firstKey = linkedMap.firstEntry().getKey();
List<String> desc = sortedNames.reversed();          // a reversed VIEW, not a copy
\`\`\`

\`getFirst\`/\`getLast\` throw \`NoSuchElementException\` on an empty collection — better than \`IndexOutOfBoundsException: Index -1\`. \`reversed()\` is a view: changes to the original show through, and on an unmodifiable list it is unmodifiable too. Useful for "sorted high to low equals sorted low to high reversed" checks.

## \`Stream.toList()\` (Java 16) and \`takeWhile\`/\`dropWhile\` (Java 9)

\`Stream.toList()\` returns an **unmodifiable** list that allows nulls; \`Collectors.toList()\` makes no guarantees (in practice a mutable \`ArrayList\`). Replacing one with the other in existing code can introduce \`UnsupportedOperationException\` where code later adds to the list. Details are in the *Functional programming* deep dive.

\`takeWhile(pred)\` takes elements **until the first one that fails**, then stops — it is not \`filter\`. On an ordered stream that makes it a short-circuit:

\`\`\`java
// Log lines after "Checkout started" up to the first ERROR
List<String> window = Files.readString(Path.of("target/app.log")).lines()
        .dropWhile(l -> !l.contains("Checkout started"))
        .takeWhile(l -> !l.contains("ERROR"))
        .toList();
\`\`\`

## Helpful NullPointerExceptions (Java 14, JEP 358)

Before Java 14 an NPE in a chained call said only the line number:

\`\`\`
java.lang.NullPointerException
    at com.shopeasy.pages.CartPage.firstItemName(CartPage.java:42)
\`\`\`

With JEP 358 (enabled by default from Java 15; on 14 it needs \`-XX:+ShowCodeDetailsInExceptionMessages\`) the JVM analyses the bytecode at the failing instruction and names the null expression:

\`\`\`
java.lang.NullPointerException: Cannot invoke "String.strip()" because the return value of
    "org.openqa.selenium.WebElement.getAttribute(String)" is null
    at com.shopeasy.pages.CartPage.firstItemName(CartPage.java:42)
\`\`\`

Now you know immediately the attribute is missing, not the element. Local variable names appear only if the class was compiled with debug information (\`-g\`, which Maven and Gradle do by default); otherwise you see \`"<local4>"\`. The message is computed lazily when \`getMessage()\` is called, so there is no cost on the happy path. One trap remains: HotSpot may replace frequently thrown implicit NPEs with a preallocated exception **without a stack trace** after many repetitions (the \`OmitStackTraceInFastThrow\` optimisation) — in long suites add \`-XX:-OmitStackTraceInFastThrow\` to the Surefire \`argLine\` when you see a bare \`java.lang.NullPointerException\` with no trace.

## LTS releases and migrating a test framework

Java ships a feature release every six months; selected releases are **Long-Term Support** (vendors provide years of updates). LTS releases so far: 8, 11, 17, 21 and 25 (September 2025). Non-LTS releases (12–16, 18–20, 22–24) stop receiving updates when the next release ships, so a framework that many teams depend on should target an LTS.

### Migration notes: Java 8 → 17 → 21

1. **Check library minimums first.** Selenium Java dropped Java 8 support: **Selenium 4.14 and later require Java 11** (4.0–4.13 still ran on 8). TestNG 7.6.0 and later require Java 11 (7.5.x is the last line for Java 8). Jackson needs 2.12+ for records. Lombok, Mockito, ByteBuddy and AspectJ (used by Allure) must be recent enough to understand the new class-file version — old versions fail with "Unsupported class file major version 61" (Java 17) or 65 (Java 21).
2. **Java 11 removed the Java EE modules** (JAXB, \`javax.xml.bind\`, JAX-WS). Old SOAP or XML helpers that used \`javax.xml.bind.DatatypeConverter\` for Base64 must move to \`java.util.Base64\` or add the Jakarta dependencies.
3. **Java 17 strongly encapsulates JDK internals.** Libraries using deep reflection into \`java.*\` fail with \`InaccessibleObjectException\`; upgrade them rather than adding \`--add-opens\` permanently.
4. **Build:** set \`<maven.compiler.release>17</maven.compiler.release>\` (\`release\`, not \`source\`/\`target\`, so the compiler also checks API usage against that version), align Surefire/Failsafe versions, and pin the CI JDK image and the Grid node images.
5. **Adopt features gradually.** Compile on 17 first with no code changes, run the suite, then introduce \`var\`, text blocks and records in new code; move to 21 for pattern-matching switches and sequenced collections once every runner (local, CI, Docker) has a 21 JDK.

## Common mistakes and debugging

- **\`UnsupportedOperationException\` from a test-data list.** Stack trace points at \`ImmutableCollections.uoe\`. Someone called \`add\` on \`List.of\` or \`Stream.toList()\` output. Fix: copy into \`new ArrayList<>(...)\` where mutation is intended, or stop mutating shared data.
- **\`NullPointerException\` whose trace starts at \`Objects.requireNonNull\` inside \`ImmutableCollections\`, called from \`List.of\`.** A \`null\` went into \`List.of\` — usually an optional CSV column. Fix: model absence explicitly or use \`Arrays.asList\`.
- **Flaky assertion on \`Set.of\`/\`Map.of\` order.** Passes locally, fails in CI. Fix: assert with \`containsInAnyOrder\`, compare sets, or use a \`LinkedHashMap\`/\`TreeMap\` when order matters.
- **Text-block body rejected with 400 INVALID_JSON.** Usually a value with an unescaped quote inserted by \`formatted\`, or a trailing comma after editing. Log the body (\`log().ifValidationFails()\` in RestAssured) and build dynamic bodies from records.
- **Jackson \`InvalidDefinitionException: Cannot construct instance of ... (no Creators...)\` for a record.** Jackson older than 2.12. Upgrade.
- **\`UnrecognizedPropertyException\` after a back-end release.** The API added a field and the DTO is strict. Decide: ignore unknowns for functional tests, keep strictness only in contract tests.
- **"Unsupported class file major version 65".** A library (often an old Mockito/ByteBuddy, JaCoCo or AspectJ weaver) cannot read Java 21 classes. Upgrade the plugin, not the code.

## Best practices for experienced engineers

- Target an LTS; use the newest LTS all runners support. Use \`release\`, not \`source\`/\`target\`.
- \`var\` only where the type is obvious; never for interface-typed variables like \`WebDriver\`.
- Immutable data by default: \`List.of\`, \`List.copyOf\` in compact constructors, records for every value object.
- Text blocks for fixed payloads and expected responses; records + Jackson for dynamic bodies; compare JSON structurally.
- Model closed result sets as sealed interfaces of records and handle them with exhaustive switches — no \`default\` branch that hides new cases.
- Use \`HttpClient\` for framework utilities, RestAssured for API tests.
- Treat virtual threads as a tool for I/O fan-out, not a speed-up for browser suites.
- Read helpful NPE messages fully; add \`-XX:-OmitStackTraceInFastThrow\` to long CI runs.

## Interview questions

### Q: Is \`var\` dynamic typing? When do you avoid it?

**Short answer (30–60 s):** No. \`var\` is compile-time inference; the variable has a fixed static type, the same one you would have written, and the class file is identical. I avoid it when the initializer does not reveal the type — a method call returning a money value or an ID — and when the variable should be typed as an interface, like \`WebDriver\`, because \`var\` would make it \`ChromeDriver\`.

**Detailed answer:** The inferred type is the type of the initializer expression, including non-denotable types (an anonymous class type or an intersection type), which is the one thing \`var\` can express that you cannot write. Restrictions follow from inference: no initializer, \`null\`, array initializers and target-less lambdas have no type to infer. Diamond plus \`var\` (\`var l = new ArrayList<>()\`) infers \`ArrayList<Object>\` — a classic review catch. My team rule: allowed for constructors, literals, factories and loops; disallowed for public-API-looking code and anything where the type carries meaning (money, durations).

### Q: Compare \`Arrays.asList\`, \`Collections.unmodifiableList\`, \`List.of\` and \`List.copyOf\`.

**Short answer (30–60 s):** \`Arrays.asList\` is a fixed-size view over an array — \`set\` works and writes through, \`add\` throws. \`unmodifiableList\` is a read-only view whose source can still change. \`List.of\` is a truly immutable list that rejects nulls. \`List.copyOf\` makes an immutable copy, and may return the argument itself if it is already immutable.

**Detailed answer:** The view-versus-copy distinction is what matters in a framework: exposing \`unmodifiableList(this.items)\` still lets callers observe later mutations, which in parallel tests means data races. In records I use \`List.copyOf\` in the compact constructor: it is a defensive copy, makes the record deeply immutable for that component, and is free when the caller passed \`List.of\`. Null-hostility of \`List.of\` is a feature for test data but a trap when mapping API fields that may be null. Also remember \`contains(null)\` throws NPE on \`List.of\` lists.

### Q: How do text blocks handle indentation and escapes? Any pitfall for API tests?

**Short answer (30–60 s):** The compiler normalises line endings to \`\\n\`, removes the common leading whitespace computed from the content lines and the closing delimiter's line, strips trailing spaces, and then processes escapes. \`\\\` at a line end joins lines; \`\\s\` is a preserved space. Pitfalls: a trailing newline you did not expect, and \`formatted\` doing no JSON escaping.

**Detailed answer:** Because the closing delimiter takes part in the indentation calculation, moving it left adds indentation to every line — useful for expected output, surprising otherwise. Escapes are interpreted after stripping, so you can keep intentional whitespace with \`\\s\` or \`\\t\`. For APIs, I use text blocks for fixed fixtures and deliberately invalid JSON, compare responses structurally, and serialise dynamic data with Jackson so that names like \`O'Brien\` or values containing quotes cannot corrupt the body.

### Q: What are sealed classes for, and why combine them with records and pattern matching?

**Short answer (30–60 s):** Sealed types close a hierarchy: only the listed subclasses can exist. Combined with records for the variants and a pattern-matching switch (Java 21), the compiler checks that every variant is handled, so adding a variant breaks the build where handling is missing instead of failing at runtime.

**Detailed answer:** It is Java's version of algebraic data types. In a framework I model \`ApiResult\` as \`Success | ClientError | ServerError\` or step outcomes as \`Passed | Failed | Skipped\`. Each record carries only the data valid for that variant, so there is no "status code plus maybe-null error field". Record patterns deconstruct in the case label, guards with \`when\` refine, the compiler reports dominated cases, and there is no \`default\` to hide new cases. Constraints: permitted subclasses must be final, sealed or non-sealed, and in the same package or module. At runtime an unexpected subtype from separately compiled code triggers \`MatchException\`.

### Q: When would you use \`java.net.http.HttpClient\` instead of RestAssured?

**Short answer (30–60 s):** For framework utilities rather than tests: broken-link checks, environment health checks before the suite, polling, quick setup calls from a UI module. RestAssured stays for the API test suite because of its assertion DSL, logging and auth helpers.

**Detailed answer:** \`HttpClient\` is dependency-free, thread-safe and reusable, supports HTTP/2 and async via \`sendAsync\`, which makes concurrent HEAD checks of 200 links trivial. It has no JSON-path assertions, so tests get verbose and failure messages poor. RestAssured gives readable given/when/then, \`log().ifValidationFails()\`, schema validation and reporting filters, at the cost of a larger dependency tree. I share a single \`HttpClient\` instance; creating one per request wastes its connection pool.

### Q: Will virtual threads make our Selenium suite faster?

**Short answer (30–60 s):** Not meaningfully. WebDriver calls are I/O-bound, but the limit is how many browser sessions the machine or Grid can run, not how many Java threads we can afford. Virtual threads help I/O fan-out — API polling, link checks, data seeding — where we want thousands of concurrent blocking calls.

**Detailed answer:** A virtual thread unmounts from its carrier when it blocks in the JDK, so blocking code scales. A TestNG run with eight browsers needs eight threads; platform threads cost nothing at that scale. Risks: pinning inside \`synchronized\` on Java 21 (fixed in 24), memory from per-virtual-thread \`ThreadLocal\`s, and overloading a shared QA environment. I would use them in a utility like a pre-suite data loader, with a \`Semaphore\` to cap concurrency, and keep the browser concurrency model as it is.

### Q: What are helpful NullPointerExceptions and what can still hide the information?

**Short answer (30–60 s):** Since Java 14 (default on from 15) the NPE message names the expression that was null, e.g. "because the return value of getAttribute(String) is null". It is computed lazily from the bytecode. It can be hidden by missing debug info (locals show as \`<local4>\`) and by HotSpot's fast-throw optimisation that drops stack traces for hot NPEs.

**Detailed answer:** In page objects with chained calls it tells you whether the element, the attribute or the parsed value was null without a debugger rerun. For long CI runs I add \`-XX:-OmitStackTraceInFastThrow\`. And I still prefer failing earlier with \`Objects.requireNonNull(value, "price attribute missing on #summary-total")\` at boundaries — a message I wrote beats one the JVM reconstructs.

### Q: How would you migrate a Java 8 Selenium/TestNG framework to Java 17 or 21?

**Short answer (30–60 s):** Inventory dependencies and their minimum Java versions (Selenium 4.14+ needs 11, TestNG 7.6+ needs 11, Jackson 2.12 for records, bytecode tools must support the new class-file version), upgrade them on Java 8 where possible, then switch the compiler \`release\` and CI images, run the full suite, and only then adopt new language features.

**Detailed answer:** Expect removed Java EE modules (JAXB) on 11 and strong encapsulation on 17 (\`InaccessibleObjectException\` from old reflection-heavy libraries). Pin the JDK in CI, Docker and Grid nodes so local and pipeline runs agree. I would go straight to 21 if all runners can have it, since the jump from 17 to 21 is small and pattern-matching switches and sequenced collections are worth it; otherwise 17 now and 21 later. Communicate it as a risk-managed change: a branch with a green full run on both JDKs before merging.

## Scenario-based questions

**1. A teammate's PR converts every DTO to records, and the contract-test job goes red with \`UnrecognizedPropertyException: Unrecognized field "description"\`.** I would first check whether the failing suite is meant to detect API additions. For the functional suite, add \`@JsonIgnoreProperties(ignoreUnknown = true)\` (or configure the shared \`ObjectMapper\`) — new fields are not a defect. For contract tests keep strictness, or better, validate against the published schema (\`/api/schema/product\`) so the rule is explicit. Then confirm the project's Jackson is 2.12+ and that compact-constructor validation is not rejecting responses that negative tests need to inspect.

**2. A test that compares the product categories passes locally and fails one run in five on CI.** The expected value is built with \`Set.of(...)\` and compared via \`toString()\`, or the actual values were collected into a \`Map.of\`. Iteration order of these is unspecified and randomised per JVM in OpenJDK. Fix the assertion to be order-insensitive (\`assertEquals(new HashSet<>(actual), expected)\` or \`containsInAnyOrder\`), and if the order is a requirement (sorted dropdown), compare against an ordered \`List\`.

**3. Management asks whether moving to Java 21 and "using virtual threads" will cut the 90-minute regression run in half.** I would explain that the run is bound by browser sessions — 8 Grid slots — and test design, not Java threading. I would propose measuring: per-test duration distribution, Grid slot utilisation and queue time. Real gains come from more slots, sharding, moving setup from UI to API calls, and removing fixed sleeps. Java 21 is still worth adopting for language features and LTS support, and virtual threads can speed up the pre-suite data-seeding step.

## Tricky follow-ups

- **Q: \`var x = 1; x = 2L;\` — compiles?** No. \`x\` is \`int\`; assigning a \`long\` needs a cast.
- **Q: Does \`List.of(1, 2).contains(null)\` return false?** No, it throws \`NullPointerException\`.
- **Q: Can a record have a mutable field?** Not an extra instance field, but a component can be a mutable type (a \`List\`, an array) — immutability is shallow unless you copy defensively.
- **Q: Can you use \`return\` inside a switch expression block?** No — use \`yield\`; \`return\` would leave the enclosing method and is a compile error there.
- **Q: Does \`Stream.toList()\` reject nulls like \`List.of\`?** No. It allows nulls but is unmodifiable.`,
  keyPoints: [
    'Version map: List.of (9), var and copyOf (10), HttpClient/String/Files additions (11 LTS), switch expressions and helpful NPEs (14), text blocks (15), records and instanceof patterns (16), sealed types (17 LTS), pattern switch, record patterns, virtual threads and sequenced collections (21 LTS).',
    'var is compile-time inference only; use it when the right-hand side shows the type, never for interface-typed variables like WebDriver.',
    'List.of/Set.of/Map.of are immutable, null-hostile and (for sets and maps) unordered with per-run randomised iteration in OpenJDK; copyOf gives defensive copies.',
    'Text blocks strip incidental indentation (the closing delimiter counts), normalise line endings, then process escapes; use them for fixed payloads, records + Jackson for dynamic bodies.',
    'Sealed interface + records + Java 21 pattern switch gives exhaustive, compiler-checked handling of results such as Success / ClientError / ServerError.',
    'HttpClient for framework utilities (health and link checks, polling); RestAssured for API test suites.',
    'Virtual threads help I/O fan-out, not browser-bound UI suites; watch pinning in synchronized on 21 and ThreadLocal memory.',
    'Migrations: check library minimums first (Selenium 4.14+ needs Java 11), use maven.compiler.release, upgrade bytecode tools, adopt features after a green run.',
  ],
  mistakes: [
    'Writing var driver = new ChromeDriver() — the variable becomes ChromeDriver and Chrome-only calls creep in. Fix: declare WebDriver driver explicitly; restrict var to obvious types.',
    'Asserting on the iteration order of Set.of or Map.of, getting a test that fails randomly in CI. Fix: compare sets or use containsInAnyOrder; use an ordered List, LinkedHashMap or TreeMap when order is the requirement.',
    'Building JSON with a text block and formatted() from external test data, then chasing 400 INVALID_JSON when a value contains a quote. Fix: log the request on failure, serialise dynamic bodies from records with Jackson.',
    'Converting DTOs to records on an old Jackson and getting "Cannot construct instance" or UnrecognizedPropertyException. Fix: Jackson 2.12+, and decide ignoreUnknown deliberately (lenient for functional tests, strict or schema-validated for contract tests).',
    'Adding a default branch to a switch over a sealed type "to be safe", which hides new variants. Fix: rely on exhaustiveness so a new record breaks the build where handling is missing.',
    'Upgrading the JDK and seeing "Unsupported class file major version 65". Fix: upgrade bytecode-manipulating dependencies (Mockito/ByteBuddy, AspectJ for Allure, JaCoCo) and pin the JDK in CI and Grid images.',
  ],
  tryIt: `Start the ShopEasy API (\`node scripts/api-server.mjs\`, port 5181) and on Java 21: (1) write the sealed \`ApiResult\` interface with three record variants and a \`from(HttpResponse<String>)\` factory; (2) call \`/api/products/2\`, \`/api/products/999\` and \`/api/products/abc\` with a shared \`HttpClient\` and print an exhaustive pattern-matching \`switch\` description of each (expect 200, 404 PRODUCT_NOT_FOUND, 400 INVALID_ID); (3) add a fourth variant \`Timeout\` and watch the compiler point at the switch; (4) write the login body as a text block, POST it for \`locked_out_user\` with RestAssured and assert 403 \`USER_LOCKED\`; (5) move the closing \`"""\` four columns left and print the body with visible markers (\`body.replace(" ", "·")\`) to see the indentation rule.`,
  problems: ['java-018', 'java-025', 'java-026', 'java-028'],
}
