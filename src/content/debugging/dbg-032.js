export default {
  id: 'dbg-032',
  category: 'debugging',
  kind: 'code',
  title: 'Expected: <29.99> Actual: <29.99F> — RestAssured reads JSON numbers as Float',
  level: 'ADVANCED',
  tags: ['restassured', 'json-path', 'Float', 'BigDecimal', 'hamcrest', 'number-types'],
  estMinutes: 20,
  scenario: `You are adding API checks for the ShopEasy product catalogue (\`GET http://localhost:5181/api/products/1\`). The response clearly says \`"price": 29.99\`, and the failure message says expected 29.99, actual 29.99 — **the same number** on both sides. A second test that extracts the price crashes with a \`ClassCastException\`. Your manager wants to know whether the price API is broken before the pricing release.`,
  description: `Response from \`GET /api/products/1\`:

\`\`\`json
{ "id": 1, "slug": "trailblazer-backpack", "name": "Trailblazer Backpack", "price": 29.99,
  "category": "bags", "stock": 25, "inStock": true, "description": "Water-resistant 22L daypack with a padded laptop sleeve." }
\`\`\`

Console output:

\`\`\`text
[ERROR] backpackPriceIsCorrect(com.shopeasy.api.ProductApiTest)  <<< FAILURE!
java.lang.AssertionError: 1 expectation failed.
JSON path price doesn't match.
Expected: <29.99>
  Actual: <29.99F>

[ERROR] backpackPriceExtracted(com.shopeasy.api.ProductApiTest)  <<< ERROR!
java.lang.ClassCastException: class java.lang.Float cannot be cast to class java.lang.Double
	at com.shopeasy.api.ProductApiTest.backpackPriceExtracted(ProductApiTest.java:38)
\`\`\`

By default RestAssured's JsonPath returns decimals as **Float** (and whole numbers as **Integer**). The Java literal \`29.99\` is a **Double**, and \`Float(29.99).equals(Double(29.99))\` is false — the \`F\` in \`<29.99F>\` is Hamcrest telling you the type.

**Fix the tests (it is a test bug, not an API bug):**
- Configure JsonPath to return numbers as \`BigDecimal\` (\`JsonConfig\` + \`NumberReturnType.BIG_DECIMAL\`) — exact and safe for money.
- Assert the price with \`new BigDecimal("29.99")\` (or \`closeTo\` / \`comparesEqualTo\`).
- Extract the price as \`BigDecimal\` — no \`(Double)\` cast.
- Keep \`id\` checked with an int: \`equalTo(1)\`.`,
  hints: [
    'The F in <29.99F> is the clue: the actual value is a java.lang.Float.',
    'RestAssured.config().jsonConfig(JsonConfig.jsonConfig().numberReturnType(NumberReturnType.BIG_DECIMAL))',
    'Then: body("price", comparesEqualTo(new BigDecimal("29.99"))) and .path("price") returns a BigDecimal.',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import org.testng.Assert;
import org.testng.annotations.Test;

public class ProductApiTest {

    private static final String BASE = "http://localhost:5181";

    @Test
    public void backpackPriceIsCorrect() {
        given().baseUri(BASE)
        .when().get("/api/products/1")
        .then().statusCode(200)
            .body("id", equalTo(1))
            .body("price", equalTo(29.99));          // Expected: <29.99> Actual: <29.99F>
    }

    @Test
    public void backpackPriceExtracted() {
        Double price = (Double) given().baseUri(BASE)
            .when().get("/api/products/1")
            .then().statusCode(200)
            .extract().path("price");              // ClassCastException: Float -> Double
        Assert.assertEquals(price, 29.99);
    }
}
`,
  solution: String.raw`package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.comparesEqualTo;
import static org.hamcrest.Matchers.equalTo;

import io.restassured.config.JsonConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.path.json.config.JsonPathConfig.NumberReturnType;
import java.math.BigDecimal;
import org.testng.Assert;
import org.testng.annotations.Test;

public class ProductApiTest {

    private static final String BASE = "http://localhost:5181";
    private static final BigDecimal BACKPACK_PRICE = new BigDecimal("29.99");

    /** Decimals come back as BigDecimal instead of Float - exact, safe for money. */
    private static final RestAssuredConfig MONEY_CONFIG = RestAssuredConfig.config()
            .jsonConfig(JsonConfig.jsonConfig().numberReturnType(NumberReturnType.BIG_DECIMAL));

    @Test
    public void backpackPriceIsCorrect() {
        given().baseUri(BASE).config(MONEY_CONFIG)
        .when().get("/api/products/1")
        .then().statusCode(200)
            .body("id", equalTo(1))
            .body("price", comparesEqualTo(BACKPACK_PRICE));
    }

    @Test
    public void backpackPriceExtracted() {
        BigDecimal price = given().baseUri(BASE).config(MONEY_CONFIG)
            .when().get("/api/products/1")
            .then().statusCode(200)
            .extract().path("price");
        Assert.assertEquals(price.compareTo(BACKPACK_PRICE), 0,
                "Backpack price expected " + BACKPACK_PRICE + " but was " + price);
    }
}
`,
  checks: [
    { label: 'Configures JsonPath number return type', pattern: 'NumberReturnType\\.(BIG_DECIMAL|DOUBLE)', hint: 'JsonConfig.jsonConfig().numberReturnType(NumberReturnType.BIG_DECIMAL)' },
    { label: 'Applies the config to the request', pattern: '(\\.config\\s*\\(|RestAssured\\.config\\s*=)', hint: 'given().config(MONEY_CONFIG) or set RestAssured.config globally' },
    { label: 'Does not compare the price with a double literal', pattern: 'equalTo\\s*\\(\\s*29\\.99\\s*\\)', mustNot: true, hint: 'A Double literal never equals a Float or BigDecimal' },
    { label: 'No cast to Double', pattern: '\\(\\s*Double\\s*\\)', mustNot: true, hint: 'The extracted value is not a Double - extract it as BigDecimal' },
    { label: 'Uses BigDecimal for the expected price', pattern: 'new\\s+BigDecimal\\s*\\(\\s*"29\\.99"\\s*\\)', hint: 'new BigDecimal("29.99") - from a String, never from a double' },
  ],
  explanation: `**When "expected X but was X" fails, the difference is the TYPE.** Hamcrest prints types subtly: \`<29.99F>\` is a Float, \`<1L>\` a Long, \`"1"\` (with quotes) a String.

**Why RestAssured gives you a Float:** JsonPath (Groovy under the hood) maps JSON decimals to \`Float\` and whole numbers to \`Integer\` by default. Java's \`29.99\` is a \`Double\`. \`equalTo\` uses \`equals()\`, and \`Float.equals(Double)\` is always false — even when the digits look the same. The extract case fails the same way: the object *is* a Float, so casting it to Double throws.

**Your options:**
1. \`equalTo(29.99f)\` — passes, but Float is imprecise and wrong for money.
2. \`NumberReturnType.DOUBLE\` + \`closeTo(29.99, 0.001)\` — OK for measurements.
3. **\`NumberReturnType.BIG_DECIMAL\` + \`comparesEqualTo(new BigDecimal("29.99"))\`** — exact; best for prices, totals and tax. \`comparesEqualTo\` ignores scale, so \`29.99\` equals \`29.990\`.

Set the config once (in a \`RequestSpecification\` or \`RestAssured.config\` in your base class) so every API test benefits. Note \`id\` still works with \`equalTo(1)\` because whole numbers stay Integer.

**Triage verdict for your manager:** the API is fine; the test compared two different number types.`,
  mistakes: [
    'Reporting an API defect because "29.99 != 29.99" without reading the F suffix.',
    'Fixing it with equalTo(29.99f) and using Float for money.',
    'Asserting id with equalTo(1L) — a Long never equals the Integer JsonPath returns.',
    'Building BigDecimal from a double (new BigDecimal(29.99)) which gives 29.989999999999998436805981327779591083526611328125.',
  ],
  interview: [
    { q: 'Your RestAssured assertion says Expected <29.99> Actual <29.99F>. What is going on?', a: 'The values have different types: JsonPath returned a Float and my literal is a Double, and equalTo uses equals, so they never match. I configure JsonPath to return BigDecimal for decimals and compare with comparesEqualTo(new BigDecimal("29.99")), which is exact and correct for money.' },
    { q: 'How do you handle numeric precision in API tests?', a: 'For money I always use BigDecimal end to end — JsonConfig BIG_DECIMAL on the RestAssured side and expected values built from Strings. For measurements where small differences are fine I use closeTo with a tolerance. I never compare floating-point values with exact equality.' },
  ],
}
