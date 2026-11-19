export default {
  id: 'api-025',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Typed lists: List<Product> and a generic Page<T> with TypeRef',
  level: 'INTERMEDIATE',
  tags: ['pojo', 'jackson', 'generics', 'typeref', 'deserialization', 'bigdecimal'],
  estMinutes: 30,
  scenario: `Finance wants a weekly stock-value check: "in-stock clothing × price must match the warehouse report". A teammate
wrote it with \`List<Map<String, Object>>\` and casts like \`(Float) product.get("price")\`. It worked until someone switched
the suite's JSON config to BigDecimal (for money accuracy) — then every cast threw \`ClassCastException\`, and the
paged-response helper started returning \`LinkedHashMap\` objects where everyone expected products. You are asked to
model the catalogue properly with Jackson so the types are checked by the compiler.`,
  description: `Against \`GET http://localhost:5181/api/products\` (\`{ data: [product], page, size, total, totalPages }\`):

1. Model a product as a \`Product\` **record** (or class) with \`id\`, \`name\`, \`price\` as **BigDecimal**, \`category\`,
   \`stock\`, \`inStock\`, annotated \`@JsonIgnoreProperties(ignoreUnknown = true)\` (the API also sends \`slug\` and
   \`description\`).
2. Model the paged wrapper as a **generic** \`Page<T>\` with \`data\` (\`List<T>\`), \`page\`, \`size\`, \`total\`, \`totalPages\`.
3. **stockValueOfClothing** — get all products, turn \`data\` into a \`List<Product>\` with
   \`.extract().jsonPath().getList("data", Product.class)\`, then with Java streams:
   - the stock value of **in-stock clothing** (\`price × stock\`) is **1559.28** (compare BigDecimals with \`compareTo\`)
   - the cheapest in-stock product is \`"Junior Onesie"\`
4. **secondPageIsTyped** — \`page=2&size=4\` deserialised in one go with \`.as(new TypeRef<Page<Product>>() {})\`. Assert
   \`page()\` is 2, \`totalPages()\` is 2, the page has 2 products and the first one's \`name()\` is \`"Junior Onesie"\`.

**Rules**
- No \`List<Map<String, Object>>\` and no casts like \`(Float) map.get(...)\`.
- Assert the status before deserialising.`,
  starterCode: `package com.shopeasy.api.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;

public class CatalogueModelTest {

    private static final String BASE_URI = "http://localhost:5181";

    @Test
    public void stockValueOfClothing() {
        List<Map<String, Object>> products = given().baseUri(BASE_URI)
            .when().get("/api/products")
            .then().extract().jsonPath().getList("data");

        double value = 0;
        for (Map<String, Object> p : products) {
            if ("clothing".equals(p.get("category")) && (Boolean) p.get("inStock")) {
                value += (Float) p.get("price") * (Integer) p.get("stock");   // ClassCastException with BigDecimal config
            }
        }
        Assert.assertEquals(value, 1559.28, 0.01);
    }

    // TODO: Product and Page<T> models, secondPageIsTyped with TypeRef
}
`,
  solution: `package com.shopeasy.api.tests;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.restassured.common.mapper.TypeRef;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

import static io.restassured.RestAssured.given;

public class CatalogueModelTest {

    private static final String BASE_URI = "http://localhost:5181";

    // ---- models (in a real project: com.shopeasy.api.models)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Product(int id, String name, BigDecimal price, String category, int stock, boolean inStock) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Page<T>(List<T> data, int page, int size, int total, int totalPages) {}

    @Test
    public void stockValueOfClothing() {
        List<Product> products = given()
            .baseUri(BASE_URI)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .extract().jsonPath().getList("data", Product.class);

        BigDecimal clothingValue = products.stream()
            .filter(p -> p.category().equals("clothing") && p.inStock())
            .map(p -> p.price().multiply(BigDecimal.valueOf(p.stock())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Assert.assertEquals(clothingValue.compareTo(new BigDecimal("1559.28")), 0,
            "In-stock clothing value was " + clothingValue);

        Product cheapest = products.stream()
            .filter(Product::inStock)
            .min(Comparator.comparing(Product::price))
            .orElseThrow();
        Assert.assertEquals(cheapest.name(), "Junior Onesie");
    }

    @Test
    public void secondPageIsTyped() {
        Page<Product> page = given()
            .baseUri(BASE_URI)
            .queryParam("page", 2)
            .queryParam("size", 4)
        .when()
            .get("/api/products")
        .then()
            .statusCode(200)
            .extract().as(new TypeRef<Page<Product>>() {});

        Assert.assertEquals(page.page(), 2);
        Assert.assertEquals(page.totalPages(), 2);
        Assert.assertEquals(page.data().size(), 2, "products on the last page");
        Product first = page.data().get(0);   // a real Product, not a LinkedHashMap
        Assert.assertEquals(first.name(), "Junior Onesie");
    }
}
`,
  checks: [
    { label: 'Has a Product model', pattern: '(record|class)\\s+Product\\b', hint: 'public record Product(int id, String name, BigDecimal price, ...) {}' },
    { label: 'Product ignores unknown fields', pattern: '@JsonIgnoreProperties\\(\\s*ignoreUnknown\\s*=\\s*true\\s*\\)\\s*(public\\s+)?(static\\s+)?(record|class)\\s+Product\\b', hint: '@JsonIgnoreProperties(ignoreUnknown = true) on Product' },
    { label: 'Price is a BigDecimal', pattern: 'BigDecimal\\s+price', hint: 'BigDecimal price — money should not be float' },
    { label: 'Converts data to List<Product>', pattern: 'getList\\(\\s*"data"\\s*,\\s*Product\\.class\\s*\\)', hint: '.extract().jsonPath().getList("data", Product.class)' },
    { label: 'Deserialises the page with TypeRef', pattern: 'new\\s+TypeRef<\\s*Page<\\s*Product\\s*>\\s*>\\s*\\(\\s*\\)\\s*\\{\\s*\\}', hint: '.extract().as(new TypeRef<Page<Product>>() {})' },
    { label: 'Compares money with compareTo', pattern: '\\.compareTo\\(', hint: 'Assert.assertEquals(value.compareTo(new BigDecimal("1559.28")), 0)' },
    { label: 'No maps of objects or casts', pattern: '(List<\\s*Map<\\s*String\\s*,\\s*Object\\s*>\\s*>|\\(\\s*(Float|Double|Integer|Boolean)\\s*\\)\\s*\\w+\\.get\\()', mustNot: true, hint: 'Deserialise into Product instead of reading Map values with casts.' },
  ],
  hints: [
    'getList("data", Product.class) converts each element of the data array into a Product.',
    'Generic types are erased at runtime, so Page.class cannot say "Page of Product" — new TypeRef<Page<Product>>() {} (an anonymous subclass) keeps that information.',
    'BigDecimal: multiply, add, and compareTo(...) == 0 to ignore scale (1559.280 vs 1559.28).',
  ],
  explanation: `**Why the casts broke**: \`getList("data")\` without a type gives \`Map\`s whose number objects depend on the
JSON config (\`Float\` by default, \`BigDecimal\` after the change). Every cast is a hidden assumption. A typed model moves
that decision to Jackson: \`BigDecimal price\` is filled correctly no matter how the JSON number is written.

**Why TypeRef**: Java erases generics at runtime, so \`.as(Page.class)\` only knows "a Page of *something*" and Jackson
fills \`data\` with \`LinkedHashMap\`s — the bug the teammate saw. \`new TypeRef<Page<Product>>() {}\` is an anonymous
subclass whose superclass carries the full type, so Jackson builds real \`Product\` objects. Use it for any generic
response: \`List<Order>\`, \`Map<String, Product>\`, \`Page<User>\`.

**Records** (Java 16+) are ideal for response models: immutable, no getter boilerplate, and Jackson 2.12+ maps JSON
fields to the record components. \`@JsonIgnoreProperties(ignoreUnknown = true)\` keeps the test stable when the API adds
fields — here \`slug\` and \`description\` are already ignored.

Money check: 15.99 × 60 = 959.40 and 49.99 × 12 = 599.88 → **1559.28**. The Retro Red Tee is clothing but out of stock,
so the filter must exclude it.`,
  mistakes: [
    'Using .as(Page.class) for a generic wrapper — the items come back as LinkedHashMap and fail with ClassCastException later.',
    'Modelling price as float or double and comparing totals with assertEquals without a delta.',
    'Comparing BigDecimals with equals — new BigDecimal("1559.280").equals(new BigDecimal("1559.28")) is false; use compareTo.',
    'Forgetting ignoreUnknown — the first new field the API adds breaks every functional test.',
  ],
  interview: [
    { q: 'What is TypeRef in RestAssured and why is it needed?', a: 'TypeRef<T> captures a full generic type (like List<Product> or Page<Order>) through an anonymous subclass, because Java erases generics at runtime. Passing it to as(...) lets Jackson create the right element type instead of maps.' },
    { q: 'getList("data", Product.class) vs as(new TypeRef<Page<Product>>(){}) — when do you use which?', a: 'getList with a path is handy when you only need one array from the body. TypeRef on the whole body is better when you also need the wrapper fields (page, total) and want one typed object to pass around.' },
    { q: 'Why BigDecimal for money in tests?', a: 'Binary floating point cannot represent values like 0.1 exactly, so sums drift (0.1 + 0.2 = 0.30000000000000004). BigDecimal is exact for decimal amounts, which matches how the business and the backend calculate prices and tax.' },
  ],
}
