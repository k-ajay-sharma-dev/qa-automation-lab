export default {
  id: 'api-041',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Verify the order maths: line totals, 8% tax and the total',
  level: 'INTERMEDIATE',
  tags: ['business-rules', 'calculations', 'jsonpath', 'orders'],
  estMinutes: 25,
  scenario: `Finance found three orders last month where \`total\` was one cent off \`subtotal + tax\`. The existing order test
only checks \`status = "PLACED"\`. Before the next release the product owner wants proof — through the API — that every
line total, the 8% tax (rounded to 2 decimals) and the grand total are calculated correctly.`,
  description: `Log in as \`standard_user\` and \`POST /api/orders\` with \`firstName "Asha"\`, \`lastName "Rao"\`, \`postalCode "560001"\` and
items **product 1 × 2** (Trailblazer Backpack, 29.99) and **product 2 × 1** (Pulse Bike Light, 9.99).

Expected: subtotal **69.97**, tax **5.60**, total **75.57**.

**Rules**
- Status **201**, then \`extract().jsonPath()\` and read numbers with \`getDouble\` / \`getList\`.
- For every line, assert \`lineTotal == price × quantity\` (rounded to 2 decimals).
- Assert subtotal = sum of the line totals, tax = round2(subtotal × 0.08), total = subtotal + tax.
- Compare doubles **with a delta** (\`0.001\`), never with plain \`==\`.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;

public class OrderTotalsTest {

    private static final String BASE_URI = "http://localhost:5181";
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void orderTotalsAreCalculatedCorrectly() {
        Map<String, Object> body = Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
            "items", List.of(Map.of("productId", 1, "quantity", 2), Map.of("productId", 2, "quantity", 1)));

        given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON).body(body)
        .when().post("/api/orders")
        .then().statusCode(201);
        // TODO: extract the JsonPath and check line totals, subtotal, tax (8%) and total
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;

public class OrderTotalsTest {

    private static final String BASE_URI = "http://localhost:5181";
    private static final double TAX_RATE = 0.08;
    private static final double DELTA = 0.001;
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    private static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }

    @Test
    public void orderTotalsAreCalculatedCorrectly() {
        Map<String, Object> body = Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001",
            "items", List.of(Map.of("productId", 1, "quantity", 2), Map.of("productId", 2, "quantity", 1)));

        JsonPath order = given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON).body(body)
            .when().post("/api/orders")
            .then().statusCode(201)
            .extract().jsonPath();

        int lines = order.getList("items").size();
        double sumOfLines = 0;
        for (int i = 0; i < lines; i++) {
            double price = order.getDouble("items[" + i + "].price");
            int quantity = order.getInt("items[" + i + "].quantity");
            double lineTotal = order.getDouble("items[" + i + "].lineTotal");
            assertEquals(lineTotal, round2(price * quantity), DELTA, "lineTotal of line " + i);
            sumOfLines += lineTotal;
        }

        double subtotal = order.getDouble("subtotal");
        double tax = order.getDouble("tax");
        double total = order.getDouble("total");

        assertEquals(subtotal, round2(sumOfLines), DELTA, "subtotal = sum of line totals");
        assertEquals(tax, round2(subtotal * TAX_RATE), DELTA, "tax = 8% of subtotal");
        assertEquals(total, round2(subtotal + tax), DELTA, "total = subtotal + tax");

        // the agreed example from the PO, as an extra safety net
        assertEquals(subtotal, 69.97, DELTA);
        assertEquals(tax, 5.60, DELTA);
        assertEquals(total, 75.57, DELTA);
    }
}
`,
  checks: [
    { label: 'Extracts a JsonPath', pattern: 'extract\\(\\)\\s*\\.\\s*jsonPath\\(\\)', hint: '.then().statusCode(201).extract().jsonPath()' },
    { label: 'Reads numbers as doubles', pattern: 'getDouble\\(\\s*"(subtotal|tax|total)"', hint: 'order.getDouble("subtotal")' },
    { label: 'Checks each lineTotal', pattern: 'lineTotal', hint: 'Loop over items and compare lineTotal with price * quantity.' },
    { label: 'Uses the 8% tax rate', pattern: '0\\.08', hint: 'tax = round2(subtotal * 0.08)' },
    { label: 'Compares doubles with a delta', pattern: 'assertEquals\\([^;]*,\\s*(DELTA|0\\.00?1)[^;]*\\)\\s*;', hint: 'assertEquals(actual, expected, 0.001)' },
    { label: 'Checks the expected total 75.57', pattern: '75\\.57', hint: 'Also assert the PO example: total 75.57.' },
  ],
  hints: [
    'order.getList("items").size() gives the number of lines; items[0].price reads one field.',
    'round2(x) = Math.round(x * 100) / 100.0 — the same rounding the shop uses.',
    'TestNG: assertEquals(actual, expected, delta, message).',
  ],
  explanation: `The test checks the **rule**, not just one number: every line, then subtotal, tax and total are each derived from
the values the API itself returned. If a developer changes rounding (e.g. rounds the total but not the tax), exactly
one assertion fails and its message tells you which step broke.

The fixed example (69.97 / 5.60 / 75.57) is kept as well: if the API and your formula were *both* wrong in the same
way, the hard-coded figures from the PO still catch it.

Money as \`double\` needs a delta — \`0.1 + 0.2\` is not \`0.3\` in binary floating point. RestAssured's \`body("tax",
equalTo(5.6))\` also trips people up because JSON numbers are read as \`Float\` by default; extracting with
\`getDouble\` and asserting with a delta avoids both problems.`,
  mistakes: [
    'Comparing money with == or equalTo(5.6) and getting random Float/Double failures.',
    'Only asserting total — a wrong tax hidden by a wrong subtotal can cancel out.',
    'Rounding differently from the business rule (truncating instead of rounding half-up).',
    'Recomputing everything from a hard-coded price list instead of the prices the API returned.',
  ],
  interview: [
    { q: 'How do you test calculations through an API?', a: 'Pick baskets from equivalence classes and edge cases (rounding up, rounding down, quantity 10), recompute each derived value from the response with the documented rule, and keep one or two hand-calculated examples from the business as an oracle.' },
    { q: 'Why not use double for money in production code?', a: 'Binary floating point cannot represent most decimal fractions exactly, so sums drift. Production code uses BigDecimal or integer cents; in tests we either do the same or compare with a small delta.' },
  ],
}
