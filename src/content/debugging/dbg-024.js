export default {
  id: 'dbg-024',
  category: 'debugging',
  kind: 'code',
  title: 'Fails only on the nightly CI agent: time zone and locale in date and money assertions',
  level: 'ADVANCED',
  tags: ['restassured', 'timezone', 'locale', 'ci', 'Instant', 'BigDecimal', 'flaky'],
  estMinutes: 25,
  scenario: `Your ShopEasy API suite is green all day on your laptop in Bengaluru. Since the company moved the nightly build to the new **Frankfurt build farm**, two order tests fail **every night** — and pass when someone clicks "Rebuild" at 10 a.m. Nobody changed the tests or the API. The infrastructure team says "it's just a Linux box with Java 17". You are asked to find out why the night run is different and fix the tests so they pass anywhere.`,
  description: `Nightly build (started 00:31 Frankfurt time):

\`\`\`text
Running on jenkins-agent-fra-02 in /var/lib/jenkins/workspace/shopeasy-api-nightly
[INFO] --- maven-surefire-plugin:3.2.5:test (default-test) @ shopeasy-api-tests ---
[INFO] Running com.shopeasy.api.tests.OrderApiTest
[ERROR] Tests run: 2, Failures: 2, Errors: 0, Skipped: 0, Time elapsed: 0.84 s <<< FAILURE! - in com.shopeasy.api.tests.OrderApiTest
[ERROR] orderIsDatedToday(com.shopeasy.api.tests.OrderApiTest)  Time elapsed: 0.402 s  <<< FAILURE!
java.lang.AssertionError: order date expected [2026-11-19] but found [2026-11-18]
	at com.shopeasy.api.tests.OrderApiTest.orderIsDatedToday(OrderApiTest.java:38)
[ERROR] receiptShowsTotal(com.shopeasy.api.tests.OrderApiTest)  Time elapsed: 0.311 s  <<< FAILURE!
java.lang.AssertionError: receipt total expected [$43.18] but found [$43,18]
	at com.shopeasy.api.tests.OrderApiTest.receiptShowsTotal(OrderApiTest.java:47)
\`\`\`

\`java -XshowSettings:properties -version\` on that agent:

\`\`\`text
    user.country = DE
    user.language = de
    user.timezone = Europe/Berlin
\`\`\`

The order response (\`POST /api/orders\` for the backpack + bike light) looks like this:

\`\`\`json
{ "id": 1001, "status": "PLACED", "subtotal": 39.98, "tax": 3.2, "total": 43.18,
  "createdAt": "2026-11-18T23:31:07.412Z", ... }
\`\`\`

**Diagnose:**
- \`createdAt\` is in **UTC** (the \`Z\`). At 00:31 in Berlin it is still 23:31 *yesterday* in UTC, but \`LocalDate.now()\` uses the agent's zone → "2026-11-19". In Bengaluru during office hours both dates agree.
- \`String.format("$%.2f", total)\` uses the JVM's **default locale**; German uses a decimal **comma**.

**Fix \`OrderApiTest\`:**
- Parse \`createdAt\` as an \`Instant\` and assert it is within a couple of minutes of "now" — no \`LocalDate.now()\` without a zone.
- Read \`total\` as a \`BigDecimal\` (not \`float\`) and compare with \`compareTo\`.
- Format money with an explicit \`Locale.US\` (\`NumberFormat.getCurrencyInstance(Locale.US)\` or \`String.format(Locale.US, …)\`).`,
  hints: [
    'Fails at night, passes in the morning, on a machine in another country: suspect time zone and locale before the code.',
    'An ISO timestamp ending in Z is UTC. LocalDate.now() is "today" wherever the JVM thinks it is.',
    'Instant.parse(order.path("createdAt")); NumberFormat.getCurrencyInstance(Locale.US).format(total)',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.api.tests;

import static org.testng.Assert.assertEquals;

import com.shopeasy.api.support.AuthClient;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class OrderApiTest {

    private RequestSpecification customer;

    @BeforeMethod
    public void login() {
        customer = AuthClient.authenticatedAs("standard_user", "secret_sauce");
    }

    private Response placeBackpackAndLightOrder() {
        return customer.contentType(ContentType.JSON)
                .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
                        "items", List.of(Map.of("productId", 1), Map.of("productId", 2))))
                .post("/api/orders")
                .then().statusCode(201).extract().response();
    }

    @Test
    public void orderIsDatedToday() {
        String createdAt = placeBackpackAndLightOrder().path("createdAt");
        assertEquals(createdAt.substring(0, 10), LocalDate.now().toString(), "order date");
    }

    @Test
    public void receiptShowsTotal() {
        float total = placeBackpackAndLightOrder().path("total");
        assertEquals(String.format("$%.2f", total), "$43.18", "receipt total");
    }
}
`,
  solution: String.raw`package com.shopeasy.api.tests;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import com.shopeasy.api.support.AuthClient;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class OrderApiTest {

    private static final BigDecimal EXPECTED_TOTAL = new BigDecimal("43.18"); // 39.98 + 8% tax (3.20)

    private RequestSpecification customer;

    @BeforeMethod
    public void login() {
        customer = AuthClient.authenticatedAs("standard_user", "secret_sauce");
    }

    private Response placeBackpackAndLightOrder() {
        return customer.contentType(ContentType.JSON)
                .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
                        "items", List.of(Map.of("productId", 1), Map.of("productId", 2))))
                .post("/api/orders")
                .then().statusCode(201).extract().response();
    }

    @Test
    public void orderIsCreatedNow() {
        Instant before = Instant.now();
        Instant createdAt = Instant.parse(placeBackpackAndLightOrder().path("createdAt")); // UTC, zone-independent
        Duration drift = Duration.between(before, createdAt).abs();
        assertTrue(drift.compareTo(Duration.ofMinutes(2)) < 0,
                "createdAt " + createdAt + " should be close to test start " + before + " (drift " + drift + ")");
    }

    @Test
    public void receiptShowsTotal() {
        BigDecimal total = new BigDecimal(placeBackpackAndLightOrder().jsonPath().getString("total"));
        assertEquals(total.compareTo(EXPECTED_TOTAL), 0, "order total was " + total);

        String receipt = NumberFormat.getCurrencyInstance(Locale.US).format(total);
        assertEquals(receipt, "$43.18", "receipt total");
    }
}
`,
  checks: [
    { label: 'No LocalDate.now() without a zone', pattern: 'LocalDate\\.now\\s*\\(\\s*\\)', mustNot: true, hint: 'It means "today in whatever zone this agent uses"' },
    { label: 'Parses createdAt as an instant / offset date-time', pattern: '(Instant|OffsetDateTime|ZonedDateTime)\\.parse\\s*\\(', hint: 'Instant.parse(order.path("createdAt"))' },
    { label: 'Formats money with an explicit locale', pattern: 'Locale\\.(US|ENGLISH|ROOT)', hint: 'NumberFormat.getCurrencyInstance(Locale.US) or String.format(Locale.US, ...)' },
    { label: 'No String.format that relies on the default locale', pattern: 'String\\.format\\s*\\(\\s*"', mustNot: true, hint: 'Pass the Locale as the first argument' },
    { label: 'Money as BigDecimal, not float', pattern: 'float\\s+\\w+\\s*=', mustNot: true, hint: 'JsonPath returns Float by default for decimals — read it as a String into BigDecimal' },
    { label: 'Compares the total with BigDecimal', pattern: 'BigDecimal[\\s\\S]*compareTo\\s*\\(', flags: 'ms', hint: 'total.compareTo(new BigDecimal("43.18")) == 0' },
  ],
  explanation: `**Two hidden inputs every Java test has:** the JVM's **default time zone** and **default locale**. They come from the operating system (or \`-Duser.timezone\`, \`-Duser.language\`) and silently change the behaviour of \`LocalDate.now()\`, \`String.format\`, \`NumberFormat.getInstance()\`, \`DateTimeFormatter.ofPattern("MMM")\`, \`toUpperCase()\` (Turkish "i"!) and more. Your laptop and the Frankfurt agent simply had different defaults.

**The date bug, step by step:**
| | Bengaluru, 10:00 IST | Frankfurt, 00:31 CET |
|---|---|---|
| \`createdAt\` (UTC) | 2026-11-19T04:30Z | 2026-11-18T23:31Z |
| \`LocalDate.now()\` | 2026-11-19 | 2026-11-19 |
| Result | pass | **fail** |

Comparing *dates* across zones always has a window where they disagree. Compare **instants** instead: "created within 2 minutes of when the test started". (Even \`LocalDate.now(ZoneOffset.UTC)\` would still fail for a test that starts at 23:59:59 UTC.) Allow some tolerance — the API server's clock and the agent's clock are never perfectly in sync.

**The money bug:** \`String.format("$%.2f", 43.18f)\` → \`"$43,18"\` under \`de_DE\`. Always pass a locale when formatting for comparison. Also, RestAssured's JsonPath returns \`Float\` for decimal numbers by default, so read money as a String into \`BigDecimal\` (or configure \`JsonPathConfig.NumberReturnType.BIG_DECIMAL\`). Note the JSON has \`"tax": 3.2\` — numbers don't carry formatting, only the UI does.

**Belt and braces for CI:** pinning \`-Duser.timezone=UTC -Duser.language=en -Duser.country=US\` in the Surefire \`argLine\` makes runs reproducible, but the test must not *depend* on it. A good habit: run the suite once with \`-Duser.timezone=Pacific/Kiritimati -Duser.language=de\` to shake out hidden assumptions.`,
  mistakes: [
    'Moving the nightly job to 10 a.m. so the dates "line up".',
    'Replacing "," with "." in the formatted string.',
    'Using LocalDate.now(ZoneOffset.UTC) and believing the midnight problem is gone.',
    'Comparing timestamps for exact equality between the client and the server clock.',
  ],
  interview: [
    { q: 'A test passes locally but fails on the CI server at night. What could it be?', a: 'Besides timing and data, I check the agent\'s time zone and locale. In one case our nightly agent ran in Europe/Berlin with a German locale: LocalDate.now() disagreed with the API\'s UTC createdAt after midnight, and String.format produced "43,18". We fixed the tests to compare Instants with a tolerance and format with Locale.US, and pinned the JVM defaults in Surefire for reproducibility.' },
    { q: 'How do you assert a timestamp returned by an API?', a: 'Parse it with Instant.parse or OffsetDateTime.parse, keep everything in UTC, and assert it lies within a reasonable window around the time of the request rather than an exact value or a local date. Also check the format with a schema or regex if the contract requires ISO-8601.' },
    { q: 'Why not use float or double for prices in tests?', a: 'Binary floating point cannot represent most decimal amounts exactly, so sums drift and formatting can round unexpectedly. BigDecimal created from the String value is exact, and compareTo ignores scale differences like 3.2 vs 3.20.' },
  ],
}
