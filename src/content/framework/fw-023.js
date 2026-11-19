export default {
  id: 'fw-023',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Test data: a builder with Faker, API set-up and guaranteed cleanup',
  level: 'ADVANCED',
  tags: ['test-data', 'builder-pattern', 'faker', 'restassured', 'cleanup', 'test-independence'],
  estMinutes: 30,
  scenario: `The order tests against the ShopEasy API (\`http://localhost:5181\`) are flaky in a way that looks random. Root
cause: \`rejectsBlankPostalCode\` adds the backpack to \`standard_user\`'s cart, gets the expected 400 — and leaves the
backpack there. The next test's \`POST /api/cart/items\` then fails with **409 ITEM_ALREADY_IN_CART**. On top of that every
test copies the same \`"Asha", "Rao", "560001"\` map, so nobody can tell which fields actually matter to each test.`,
  description: `Refactor the test data and the set-up/clean-up.

**Rules**
- A \`ShippingInfoBuilder\` for the record \`ShippingInfo(firstName, lastName, postalCode)\`: a static \`aShippingInfo()\`,
  realistic **random defaults from Faker** (\`net.datafaker.Faker\`), fluent \`withX(...)\` methods returning \`this\`, and \`build()\`.
- \`@BeforeMethod\`: log in through the API (\`POST /api/auth/login\`) and put product 1 in the cart (\`POST /api/cart/items\`).
- \`@AfterMethod(alwaysRun = true)\`: empty the cart with \`DELETE /api/cart\` — even when the test failed.
- The negative test overrides **only** the field it is about: \`aShippingInfo().withPostalCode("").build()\`.
- No hard-coded customer names left in the tests.`,
  starterCode: `package com.shopeasy.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import java.util.Map;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

public class OrderApiTest {

    private String token;

    @BeforeClass
    public void baseUri() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    @Test
    public void placesOrder() {
        token = login();
        given().auth().oauth2(token).contentType(ContentType.JSON).body(Map.of("productId", 1))
                .post("/api/cart/items").then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", "560001"))
                .post("/api/orders")
                .then().statusCode(201);
    }

    @Test
    public void rejectsBlankPostalCode() {
        token = login();
        given().auth().oauth2(token).contentType(ContentType.JSON).body(Map.of("productId", 1))
                .post("/api/cart/items").then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body(Map.of("firstName", "Asha", "lastName", "Rao", "postalCode", ""))
                .post("/api/orders")
                .then().statusCode(400);
    }

    private String login() {
        return given().contentType(ContentType.JSON)
                .body(Map.of("username", "standard_user", "password", Credentials.password()))
                .post("/api/auth/login").then().statusCode(200).extract().path("token");
    }
}
`,
  solution: `package com.shopeasy.api;

import static com.shopeasy.api.ShippingInfoBuilder.aShippingInfo;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import java.util.Map;
import net.datafaker.Faker;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

record ShippingInfo(String firstName, String lastName, String postalCode) { }

final class ShippingInfoBuilder {
    private static final Faker FAKER = new Faker();

    private String firstName = FAKER.name().firstName();
    private String lastName = FAKER.name().lastName();
    private String postalCode = FAKER.number().digits(6);

    private ShippingInfoBuilder() { }

    static ShippingInfoBuilder aShippingInfo() {
        return new ShippingInfoBuilder();
    }

    ShippingInfoBuilder withFirstName(String firstName) {
        this.firstName = firstName;
        return this;
    }

    ShippingInfoBuilder withLastName(String lastName) {
        this.lastName = lastName;
        return this;
    }

    ShippingInfoBuilder withPostalCode(String postalCode) {
        this.postalCode = postalCode;
        return this;
    }

    ShippingInfo build() {
        return new ShippingInfo(firstName, lastName, postalCode);
    }
}

public class OrderApiTest {

    private String token;

    @BeforeClass
    public void baseUri() {
        RestAssured.baseURI = "http://localhost:5181";
    }

    @BeforeMethod
    public void loginAndPutBackpackInCart() {
        token = given().contentType(ContentType.JSON)
                .body(Map.of("username", "standard_user", "password", Credentials.password()))
                .post("/api/auth/login").then().statusCode(200).extract().path("token");

        given().auth().oauth2(token).contentType(ContentType.JSON).body(Map.of("productId", 1))
                .post("/api/cart/items").then().statusCode(201);
    }

    @AfterMethod(alwaysRun = true)
    public void emptyCart() {
        if (token != null) {
            given().auth().oauth2(token).delete("/api/cart").then().statusCode(204);
        }
    }

    @Test
    public void placesOrderForAnyValidCustomer() {
        ShippingInfo customer = aShippingInfo().build();

        given().auth().oauth2(token).contentType(ContentType.JSON).body(customer)
                .post("/api/orders")
                .then().statusCode(201)
                .body("status", equalTo("PLACED"))
                .body("customer.firstName", equalTo(customer.firstName()))
                .body("customer.postalCode", equalTo(customer.postalCode()));
    }

    @Test
    public void rejectsBlankPostalCode() {
        ShippingInfo customer = aShippingInfo().withPostalCode("").build();

        given().auth().oauth2(token).contentType(ContentType.JSON).body(customer)
                .post("/api/orders")
                .then().statusCode(400)
                .body("error.code", equalTo("VALIDATION_FAILED"))
                .body("error.details.field", hasItem("postalCode"));
    }
}
`,
  checks: [
    { label: 'Builder with a static factory method', pattern: 'static\\s+ShippingInfoBuilder\\s+aShippingInfo\\s*\\(\\s*\\)', hint: 'static ShippingInfoBuilder aShippingInfo() { return new ShippingInfoBuilder(); }' },
    { label: 'Fluent with-methods return this', pattern: 'ShippingInfoBuilder\\s+with\\w+\\s*\\([^)]*\\)\\s*\\{[^}]*return\\s+this\\s*;', hint: 'ShippingInfoBuilder withPostalCode(String v) { this.postalCode = v; return this; }' },
    { label: 'Random defaults from Faker', pattern: 'new\\s+Faker\\s*\\([\\s\\S]*?\\w+\\.(name|address|number)\\s*\\(\\s*\\)\\.\\w+\\s*\\(', hint: 'private String firstName = FAKER.name().firstName();' },
    { label: 'Cart prepared through the API in @BeforeMethod', pattern: '@BeforeMethod[\\s\\S]*?post\\s*\\(\\s*"/api/cart/items"\\s*\\)', hint: '@BeforeMethod: login, then POST /api/cart/items with productId 1' },
    { label: 'Cleanup always runs', pattern: '@AfterMethod\\s*\\(\\s*alwaysRun\\s*=\\s*true\\s*\\)[\\s\\S]*?delete\\s*\\(\\s*"/api/cart"\\s*\\)', hint: '@AfterMethod(alwaysRun = true) ... .delete("/api/cart").then().statusCode(204)' },
    { label: 'Negative test overrides only the postal code', pattern: 'aShippingInfo\\s*\\(\\s*\\)\\s*\\.withPostalCode\\s*\\(\\s*""\\s*\\)\\s*\\.build\\s*\\(\\s*\\)', hint: 'aShippingInfo().withPostalCode("").build()' },
    { label: 'No hard-coded customer in the tests', pattern: '"Asha"', mustNot: true, hint: 'Let the builder supply the name' },
  ],
  hints: [
    'The builder holds a default for every field; a test changes only what it is about.',
    'Faker: new Faker().name().firstName(), .name().lastName(), .number().digits(6).',
    'Set-up in @BeforeMethod, clean-up in @AfterMethod(alwaysRun = true) — a failing assertion must not skip the clean-up.',
  ],
  explanation: `Three ideas that fix most "random" failures in a suite:

**1. Builders make intent visible.** \`aShippingInfo().withPostalCode("").build()\` says *"any valid customer, but with
a blank postal code"*. A reader instantly sees the one field the test is about. Adding a new mandatory field later
changes the builder, not 40 tests.

**2. Faker gives realistic, varied data.** Random names and postal codes catch bugs fixed data never will (apostrophes
in names, leading zeros) and avoid collisions when tests create records with unique fields. Two cautions: log the
values (they are in the report through the response), and keep data **valid by default** — a random value that
sometimes breaks a validation rule makes the test flaky. Faker can be seeded (\`new Faker(new Random(42))\`) to
reproduce a failing run.

**3. Set up through the API, clean up always.** The browser or the order endpoint is what's under test; putting the
backpack in the cart is not, so the API does it in milliseconds. And \`@AfterMethod(alwaysRun = true)\` empties the cart
whether the test passed, failed, or threw — exactly the case that caused the 409s. (A config-level alternative:
\`POST /api/reset\` before the suite, but resetting a shared environment mid-run would break colleagues' tests.)

Note on parallel runs: the cart belongs to the **user**, so two parallel tests as \`standard_user\` would still collide.
Give parallel tests their own users (here \`visual_user\` is the second customer) or keep this class sequential, and
store \`token\` in a \`ThreadLocal\` if the class itself runs methods in parallel.

Dependency: \`net.datafaker:datafaker\` (the maintained successor of java-faker), test scope.`,
  mistakes: [
    'Cleaning up at the end of the test body, so a failed assertion skips the clean-up.',
    'Random data that is sometimes invalid, turning a data generator into a flakiness generator.',
    'A builder whose defaults are empty, so every test still has to set every field.',
    'Creating test data through slow UI flows when an API exists.',
  ],
  interview: [
    { q: 'How do you manage test data in automation?', a: 'Static reference data in versioned files, dynamic data created per test through the API using builders with sensible (often Faker-generated) defaults, and guaranteed cleanup in teardown with alwaysRun or by unique data that never collides. Tests never depend on data created by other tests.' },
    { q: 'What is the test data builder pattern?', a: 'A builder object with valid defaults for every field and fluent with-methods to override only what a test cares about, ending in build(). It removes duplication and makes the important field of each test obvious.' },
    { q: 'Why can random test data be a problem?', a: 'It can make failures hard to reproduce and occasionally generate invalid values. Keep generated data valid by default, log or seed it, and use fixed values for boundary cases you want to test deliberately.' },
  ],
}
