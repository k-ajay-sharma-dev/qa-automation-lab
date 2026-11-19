export default {
  id: 'api-043',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Consistency across endpoints: list vs single product vs cart line',
  level: 'ADVANCED',
  tags: ['consistency', 'data-integrity', 'jsonpath', 'cross-endpoint'],
  estMinutes: 30,
  scenario: `A caching bug in production: the product list showed the Storm Fleece Jacket at 49.99 while the product page
and the cart charged a stale price. Every endpoint passed its own tests — nobody compared them with each other. Your
lead asks for one "consistency" test class that proves the same product looks the same wherever the API returns it.`,
  description: `Against \`http://localhost:5181\` (reset in \`@BeforeMethod\`):

1. **listMatchesSingleProduct** — \`GET /api/products?size=50\`, read \`data\` as a \`List<Map<String, Object>>\`.
   Assert \`total\` equals the list size. Then, **for every product** in the list, \`GET /api/products/{id}\` and assert
   the single response (as a Map) **equals** the list entry — every field, not just the price.
2. **cartLineUsesCatalogPrice** — log in as \`standard_user\`, read the price of product **4** from
   \`/api/products/4\`, \`POST /api/cart/items\` \`{ productId: 4, quantity: 2 }\` (201), and assert the cart line's
   \`price\` equals the catalogue price and \`lineTotal\` equals price × 2.

**Rules**
- Compare whole objects (\`assertEquals(map, map)\`), not field-by-field copies of the same three fields.
- Do not hard-code the product list — loop over what the API returned.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;

public class CatalogConsistencyTest {

    private static final String BASE_URI = "http://localhost:5181";

    @BeforeMethod
    public void reset() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
    }

    @Test
    public void listMatchesSingleProduct() {
        // only checks product 1's price — the caching bug was on product 4
        float listPrice = given().baseUri(BASE_URI).when().get("/api/products")
            .then().statusCode(200).extract().path("data[0].price");
        float singlePrice = given().baseUri(BASE_URI).when().get("/api/products/1")
            .then().statusCode(200).extract().path("price");
        assertEquals(singlePrice, listPrice);
    }

    // TODO: cartLineUsesCatalogPrice
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
import static org.testng.Assert.assertFalse;

public class CatalogConsistencyTest {

    private static final String BASE_URI = "http://localhost:5181";

    @BeforeMethod
    public void reset() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
    }

    @Test
    public void listMatchesSingleProduct() {
        JsonPath page = given().baseUri(BASE_URI).queryParam("size", 50)
            .when().get("/api/products")
            .then().statusCode(200)
            .extract().jsonPath();

        List<Map<String, Object>> products = page.getList("data");
        assertFalse(products.isEmpty(), "catalogue should not be empty");
        assertEquals(page.getInt("total"), products.size(), "total must match the number of products returned");

        for (Map<String, Object> fromList : products) {
            Object id = fromList.get("id");
            Map<String, Object> single = given().baseUri(BASE_URI)
                .when().get("/api/products/{id}", id)
                .then().statusCode(200)
                .extract().jsonPath().getMap("$");

            assertEquals(single, fromList, "product " + id + " differs between list and detail");
        }
    }

    @Test
    public void cartLineUsesCatalogPrice() {
        String token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");

        double catalogPrice = given().baseUri(BASE_URI)
            .when().get("/api/products/{id}", 4)
            .then().statusCode(200)
            .extract().jsonPath().getDouble("price");

        JsonPath cart = given().baseUri(BASE_URI).auth().oauth2(token).contentType(ContentType.JSON)
            .body(Map.of("productId", 4, "quantity", 2))
            .when().post("/api/cart/items")
            .then().statusCode(201)
            .extract().jsonPath();

        double linePrice = cart.getDouble("items.find { it.productId == 4 }.price");
        double lineTotal = cart.getDouble("items.find { it.productId == 4 }.lineTotal");

        assertEquals(linePrice, catalogPrice, 0.001, "cart must charge the catalogue price");
        assertEquals(lineTotal, Math.round(catalogPrice * 2 * 100) / 100.0, 0.001, "lineTotal = price x quantity");
    }
}
`,
  checks: [
    { label: 'Reads the list as List<Map>', pattern: 'List<Map<String,\\s*Object>>\\s+\\w+\\s*=[^;]*getList\\(\\s*"data"', hint: 'List<Map<String, Object>> products = page.getList("data");' },
    { label: 'Checks total against the list size', pattern: '"total"[\\s\\S]*size\\(\\)', hint: 'assertEquals(page.getInt("total"), products.size())' },
    { label: 'Loops over every product', pattern: 'for\\s*\\(\\s*(Map<String,\\s*Object>|var)\\s+\\w+\\s*:', hint: 'for (Map<String, Object> fromList : products) { ... }' },
    { label: 'Reads the single product as a Map', pattern: 'getMap\\(\\s*"\\$?"\\s*\\)|\\.as\\(\\s*Map\\.class\\s*\\)', hint: '.extract().jsonPath().getMap("$")' },
    { label: 'Adds product 4 to the cart', pattern: '"productId"\\s*,\\s*4', hint: 'body(Map.of("productId", 4, "quantity", 2))' },
    { label: 'Compares the cart price with the catalogue price', pattern: 'catalogPrice|catalogue?Price', hint: 'Read /api/products/4 price first, then compare it with the cart line price.' },
  ],
  hints: [
    'jsonPath().getList("data") returns List<Map<String, Object>> — one Map per product.',
    'getMap("$") turns the whole single-product response into a Map; Map.equals compares every key and value.',
    'GPath find: items.find { it.productId == 4 }.price',
  ],
  explanation: `Each endpoint can pass its own tests and still disagree with the others — that is exactly how stale caches and
duplicated mapping code show up. Comparing **whole Maps** catches *any* field drift (price, stock, inStock, a renamed
slug) without you having to guess which field will break next.

Looping over the list instead of hard-coding ids means a seventh product added next sprint is covered automatically.
Checking \`total == data.size()\` with \`size=50\` also proves the paging metadata agrees with the data.

The cart test reads the price **from the API first** and then compares, so it stays correct when the catalogue price
changes — it tests the relationship, not a magic number.`,
  mistakes: [
    'Checking one product (data[0]) — the bug was on a different id.',
    'Comparing only price — stock and inStock drift is just as real.',
    'Hard-coding expected prices in the consistency test, so a legit price change breaks it.',
    'Forgetting size=50 and comparing only the first page.',
  ],
  interview: [
    { q: 'What is a cross-endpoint consistency test and when is it worth it?', a: 'A test that reads the same entity through different endpoints (list, detail, cart, order) and asserts they agree. It is worth it where data is duplicated, cached or mapped by different code paths, because each endpoint\'s own tests cannot see the disagreement.' },
    { q: 'Why compare whole objects instead of selected fields?', a: 'It catches drift in any field, including ones added later, with one assertion. You only exclude fields that legitimately differ (like timestamps) explicitly.' },
  ],
}
