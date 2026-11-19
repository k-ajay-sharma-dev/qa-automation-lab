export default {
  id: 'api-036',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Extracting values: extract().path(), a nested Map and the whole response as a Map',
  level: 'INTERMEDIATE',
  tags: ['extract', 'jsonpath', 'map', 'typeref'],
  estMinutes: 20,
  scenario: `The CRM team asks for a "profile snapshot" check: before a migration they want to save Asha's customer
profile from \`GET /api/users/1\` and compare it field by field afterwards. The first draft takes the response as a String
and cuts values out with \`indexOf\` and \`substring\` — it broke the moment the API started pretty-printing JSON. You will
replace it with RestAssured's extraction methods.`,
  description: `Against \`GET http://localhost:5181/api/users/{id}\` with id **1** (no login needed). Seed data:
firstName \`Asha\`, address city \`Bengaluru\`, country \`IN\`, roles \`["CUSTOMER"]\`.

**Test 1 — singleValues:** use \`.extract().path(...)\` to read \`"address.city"\` into a \`String\` and \`"id"\` into an
\`int\`; assert \`Bengaluru\` and \`1\`.

**Test 2 — nestedMap:** extract the address with \`.extract().jsonPath().getMap("address")\` and assert it has
\`country = IN\` and \`postalCode = 560001\`.

**Test 3 — wholeResponseAsMap:** extract the full body as \`Map<String, Object>\` (\`.extract().as(new TypeRef<...>() {})\`
or \`as(Map.class)\`), then assert \`firstName\` is \`Asha\` and that the map has the keys \`email\` and \`roles\`.

**Rules**
- Check \`statusCode(200)\` before every extract.
- No \`asString()\` + \`indexOf\`/\`substring\` parsing.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;

public class ProfileSnapshotTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void singleValues() {
        String body = given().baseUri(BASE_URI)
            .when().get("/api/users/1")
            .asString();
        int start = body.indexOf("\\"city\\": \\"") + 9;
        String city = body.substring(start, body.indexOf("\\"", start));
        Assert.assertEquals(city, "Bengaluru");
    }

    @Test
    public void nestedMap() {
        // TODO: address as a Map
    }

    @Test
    public void wholeResponseAsMap() {
        // TODO: full body as Map<String, Object>
    }
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.common.mapper.TypeRef;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class ProfileSnapshotTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void singleValues() {
        String city = given().baseUri(BASE_URI)
            .when().get("/api/users/{id}", 1)
            .then().statusCode(200)
            .extract().path("address.city");

        int id = given().baseUri(BASE_URI)
            .when().get("/api/users/{id}", 1)
            .then().statusCode(200)
            .extract().path("id");

        Assert.assertEquals(city, "Bengaluru");
        Assert.assertEquals(id, 1);
    }

    @Test
    public void nestedMap() {
        Map<String, Object> address = given().baseUri(BASE_URI)
            .when().get("/api/users/{id}", 1)
            .then().statusCode(200)
            .extract().jsonPath().getMap("address");

        Assert.assertEquals(address.get("country"), "IN");
        Assert.assertEquals(address.get("postalCode"), "560001");
    }

    @Test
    public void wholeResponseAsMap() {
        Map<String, Object> user = given().baseUri(BASE_URI)
            .when().get("/api/users/{id}", 1)
            .then().statusCode(200)
            .extract().as(new TypeRef<Map<String, Object>>() {});

        Assert.assertEquals(user.get("firstName"), "Asha");
        Assert.assertTrue(user.containsKey("email"), "email missing: " + user.keySet());
        Assert.assertTrue(user.containsKey("roles"), "roles missing: " + user.keySet());
    }
}
`,
  checks: [
    { label: 'Uses extract().path(...)', pattern: 'extract\\(\\)\\s*\\.path\\(\\s*"address\\.city"', hint: '.extract().path("address.city")' },
    { label: 'Extracts the address with jsonPath().getMap', pattern: 'jsonPath\\(\\)\\s*\\.getMap\\(\\s*"address"', hint: '.extract().jsonPath().getMap("address")' },
    { label: 'Extracts the whole body as a Map', pattern: '\\.as\\(\\s*(new\\s+TypeRef\\s*<\\s*Map|Map\\.class)', hint: '.extract().as(new TypeRef<Map<String, Object>>() {})' },
    { label: 'Checks the status before extracting', pattern: 'statusCode\\(\\s*200\\s*\\)\\s*\\.extract\\(\\)', hint: '.then().statusCode(200).extract()...' },
    { label: 'No hand-made string parsing', pattern: '(indexOf|substring)\\(', mustNot: true, hint: 'Let RestAssured parse the JSON for you.' },
  ],
  hints: [
    'extract().path(...) is generic: the variable type on the left decides what you get (String, int, List...).',
    'jsonPath().getMap("address") turns one JSON object into a Map<String, Object>.',
    'TypeRef keeps the generic type: new TypeRef<Map<String, Object>>() {} — note the {} at the end.',
  ],
  explanation: `Three levels of extraction, from smallest to biggest:

| Need | Use | Result |
|---|---|---|
| one value | \`extract().path("address.city")\` | \`String\`, \`int\`, \`List\`... (inferred from the variable) |
| one object | \`extract().jsonPath().getMap("address")\` | \`Map<String, Object>\` |
| whole body | \`extract().as(new TypeRef<Map<String, Object>>() {})\` | \`Map<String, Object>\` |
| whole body, typed | \`extract().as(User.class)\` | your POJO |

A Map is ideal for a **snapshot** you will compare later, or for responses whose fields you do not want to model yet.
For stable contracts a POJO is clearer. Checking \`statusCode(200)\` before \`extract()\` makes a 404 fail with a clear
message instead of a \`null\` city. String parsing breaks on whitespace, key order and escaping — JSON parsing does not.`,
  mistakes: [
    'Extracting without checking the status first — an error body silently gives null values.',
    'Assigning extract().path("id") to a String — the JSON number is an Integer, so you get a ClassCastException.',
    'Using as(Map.class) and then fighting raw-type warnings; TypeRef keeps the generics.',
    'Comparing nested numbers as Double — JSON decimals in a Map are Float by default.',
  ],
  interview: [
    { q: 'extract().path() vs extract().jsonPath() vs extract().response()?', a: 'path() reads one value directly. jsonPath() gives a JsonPath object for several typed reads (getString, getList, getMap). response() returns the whole Response so you can read status, headers and body later — useful when one call feeds several checks.' },
    { q: 'When would you deserialise to a Map instead of a POJO?', a: 'For quick snapshots, generic checks (e.g. "no field is null"), or responses that change often. POJOs are better when the contract is stable and many tests use it, because the compiler catches field-name mistakes.' },
  ],
}
