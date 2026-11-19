// A complete reference API test framework (Java 17 + RestAssured 5 + Cucumber 7 + TestNG + Jackson)
// for the ShopEasy practice API (scripts/api-server.mjs, `npm run api`, http://localhost:5181/api).
// Same shape as every blueprint in this folder (see FrameworkPage).

const FILES = [
  {
    path: 'pom.xml',
    why: 'Maven downloads RestAssured, the JSON schema validator, Jackson, Cucumber and TestNG. Surefire runs testng.xml, which runs the Cucumber runner.',
    lang: 'xml',
    code: `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-api-tests</artifactId>
  <version>1.0.0</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <rest-assured.version>5.5.0</rest-assured.version>
    <cucumber.version>7.20.1</cucumber.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>io.rest-assured</groupId>
      <artifactId>rest-assured</artifactId>
      <version>\${rest-assured.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.rest-assured</groupId>
      <artifactId>json-schema-validator</artifactId>
      <version>\${rest-assured.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>2.18.2</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-java</artifactId>
      <version>\${cucumber.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-testng</artifactId>
      <version>\${cucumber.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-picocontainer</artifactId>
      <version>\${cucumber.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>7.10.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>testng.xml</suiteXmlFile>
          </suiteXmlFiles>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>`,
  },
  {
    path: 'testng.xml',
    why: 'The suite Maven runs. API scenarios are fast and independent, but the practice API keeps one shared in-memory store, so they run one at a time here.',
    lang: 'xml',
    code: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy API">
  <test name="Cucumber API scenarios">
    <classes>
      <class name="com.shopeasy.api.runners.TestRunner"/>
    </classes>
  </test>
</suite>`,
  },
  {
    path: 'src/test/resources/config/qa.properties',
    why: 'Where the API lives and who logs in. Switch environments with -Denv=staging; any key can be overridden with -Dkey=value in CI.',
    lang: 'properties',
    code: `baseUri=http://localhost:5181
basePath=/api
username=standard_user
password=secret_sauce
# every response must arrive faster than this (milliseconds)
responseTimeMs=2000`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/config/ConfigReader.java',
    why: 'Loads config/<env>.properties once from the classpath. A -D system property always wins, so Jenkins can point the suite anywhere.',
    lang: 'java',
    code: `package com.shopeasy.api.config;

import java.io.InputStream;
import java.util.Properties;

public final class ConfigReader {
    private static final Properties PROPS = new Properties();

    static {
        String file = "config/" + System.getProperty("env", "qa") + ".properties";
        try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream(file)) {
            if (in == null) throw new IllegalStateException("Missing " + file);
            PROPS.load(in);
        } catch (Exception e) {
            throw new IllegalStateException("Could not load " + file, e);
        }
    }

    private ConfigReader() {}

    public static String get(String key) {
        return System.getProperty(key, PROPS.getProperty(key));
    }

    public static long getLong(String key) {
        return Long.parseLong(get(key));
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/specs/SpecFactory.java',
    why: 'The "base spec": base URI, JSON content type, logging only when something fails, and numbers read as Double (RestAssured defaults to Float, so 29.99 would not equal 29.99). The response spec adds the global response-time rule.',
    lang: 'java',
    code: `package com.shopeasy.api.specs;

import com.shopeasy.api.config.ConfigReader;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.config.JsonConfig;
import io.restassured.config.LogConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.http.ContentType;
import io.restassured.path.json.config.JsonPathConfig;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;

import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.lessThan;

public final class SpecFactory {

    private SpecFactory() {}

    /** Every request starts from this: where, what format, and log on failure. */
    public static RequestSpecification base() {
        return new RequestSpecBuilder()
            .setBaseUri(ConfigReader.get("baseUri"))
            .setBasePath(ConfigReader.get("basePath"))
            .setContentType(ContentType.JSON)
            .setAccept(ContentType.JSON)
            .setConfig(RestAssuredConfig.config()
                .jsonConfig(JsonConfig.jsonConfig().numberReturnType(JsonPathConfig.NumberReturnType.DOUBLE))
                // quiet when green, full request + response in the log when an assertion fails
                .logConfig(LogConfig.logConfig().enableLoggingOfRequestAndResponseIfValidationFails()))
            .build();
    }

    /** Same as base() plus the Bearer token of a logged-in user. */
    public static RequestSpecification authenticated(String token) {
        return new RequestSpecBuilder()
            .addRequestSpecification(base())
            .addHeader("Authorization", "Bearer " + token)
            .build();
    }

    /** Rules every successful JSON response must follow. */
    public static ResponseSpecification ok(int status) {
        return new ResponseSpecBuilder()
            .expectStatusCode(status)
            .expectContentType(ContentType.JSON)
            .expectResponseTime(lessThan(ConfigReader.getLong("responseTimeMs")), TimeUnit.MILLISECONDS)
            .build();
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/endpoints/Endpoints.java',
    why: 'Every path in one place. When the backend renames /orders to /v2/orders you change one line, not forty tests.',
    lang: 'java',
    code: `package com.shopeasy.api.endpoints;

public final class Endpoints {
    private Endpoints() {}

    public static final String LOGIN = "/auth/login";
    public static final String RESET = "/reset";
    public static final String HEALTH = "/health";
    public static final String PRODUCTS = "/products";
    public static final String PRODUCT_BY_ID = "/products/{id}";
    public static final String CART = "/cart";
    public static final String CART_ITEMS = "/cart/items";
    public static final String CART_ITEM = "/cart/items/{productId}";
    public static final String ORDERS = "/orders";
    public static final String ORDER_BY_ID = "/orders/{id}";
    public static final String USER_BY_ID = "/users/{id}";
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/clients/AuthClient.java',
    why: 'Logs in once per user and caches the token, so a 40-scenario run does not hit /auth/login 40 times. Tests never build the Authorization header by hand.',
    lang: 'java',
    code: `package com.shopeasy.api.clients;

import com.shopeasy.api.config.ConfigReader;
import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.specs.SpecFactory;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static io.restassured.RestAssured.given;

public final class AuthClient {
    private static final Map<String, String> TOKENS = new ConcurrentHashMap<>();

    private AuthClient() {}

    /** Raw login call — use it in negative tests (401 / 403). */
    public static Response login(String username, String password) {
        return given()
                .spec(SpecFactory.base())
                .body(Map.of("username", username, "password", password))
            .when()
                .post(Endpoints.LOGIN);
    }

    /** Token for a user, logging in only the first time. */
    public static String tokenFor(String username, String password) {
        return TOKENS.computeIfAbsent(username, u ->
            login(u, password)
                .then().statusCode(200)
                .extract().path("token"));
    }

    public static String defaultToken() {
        return tokenFor(ConfigReader.get("username"), ConfigReader.get("password"));
    }

    public static RequestSpecification asDefaultUser() {
        return SpecFactory.authenticated(defaultToken());
    }

    /** The practice API forgets tokens on POST /api/reset, so the cache must be cleared too. */
    public static void clearCache() {
        TOKENS.clear();
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/clients/ProductClient.java',
    why: 'An "endpoint class": one method per API operation, returning the raw Response so the caller decides what to assert (happy path or error).',
    lang: 'java',
    code: `package com.shopeasy.api.clients;

import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.specs.SpecFactory;
import io.restassured.response.Response;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class ProductClient {

    public Response list(Map<String, ?> query) {
        return given()
                .spec(SpecFactory.base())
                .queryParams(query)
            .when()
                .get(Endpoints.PRODUCTS);
    }

    public Response byId(Object id) {
        return given()
                .spec(SpecFactory.base())
                .pathParam("id", id)
            .when()
                .get(Endpoints.PRODUCT_BY_ID);
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/clients/CartClient.java',
    why: 'Cart calls need a token, so the client takes one in its constructor. Steps can build a cart for the standard user or for anyone else.',
    lang: 'java',
    code: `package com.shopeasy.api.clients;

import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.specs.SpecFactory;
import io.restassured.response.Response;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class CartClient {
    private final String token;

    public CartClient(String token) {
        this.token = token;
    }

    public Response get() {
        return given().spec(SpecFactory.authenticated(token)).when().get(Endpoints.CART);
    }

    public Response add(int productId, int quantity) {
        return given()
                .spec(SpecFactory.authenticated(token))
                .body(Map.of("productId", productId, "quantity", quantity))
            .when()
                .post(Endpoints.CART_ITEMS);
    }

    public Response remove(int productId) {
        return given()
                .spec(SpecFactory.authenticated(token))
                .pathParam("productId", productId)
            .when()
                .delete(Endpoints.CART_ITEM);
    }

    public Response clear() {
        return given().spec(SpecFactory.authenticated(token)).when().delete(Endpoints.CART);
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/clients/OrderClient.java',
    why: 'Sends an OrderRequest POJO — Jackson turns it into JSON — and fetches orders by id for the "create then read back" chain.',
    lang: 'java',
    code: `package com.shopeasy.api.clients;

import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.models.OrderRequest;
import com.shopeasy.api.specs.SpecFactory;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;

public class OrderClient {
    private final String token;

    public OrderClient(String token) {
        this.token = token;
    }

    public Response place(OrderRequest request) {
        return given()
                .spec(SpecFactory.authenticated(token))
                .body(request)
            .when()
                .post(Endpoints.ORDERS);
    }

    public Response byId(Object id) {
        return given()
                .spec(SpecFactory.authenticated(token))
                .pathParam("id", id)
            .when()
                .get(Endpoints.ORDER_BY_ID);
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/Product.java',
    why: 'A POJO matching one product in the JSON. ignoreUnknown = true means a new field added by the backend does not break every test.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Product {
    private int id;
    private String slug;
    private String name;
    private double price;
    private String category;
    private int stock;
    private boolean inStock;
    private String description;

    public Product() {} // Jackson needs it

    public int getId() { return id; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public double getPrice() { return price; }
    public String getCategory() { return category; }
    public int getStock() { return stock; }
    public boolean isInStock() { return inStock; }
    public String getDescription() { return description; }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/ProductPage.java',
    why: 'The paged list wrapper { data, page, size, total, totalPages }. response.as(ProductPage.class) gives typed access to the whole page.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductPage {
    private List<Product> data;
    private int page;
    private int size;
    private int total;
    private int totalPages;

    public ProductPage() {}

    public List<Product> getData() { return data; }
    public int getPage() { return page; }
    public int getSize() { return size; }
    public int getTotal() { return total; }
    public int getTotalPages() { return totalPages; }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/OrderItem.java',
    why: 'Used in both directions: sent as { productId, quantity } in a request, and read back with name, price and lineTotal. NON_NULL keeps the request body clean.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderItem {
    private Integer productId;
    private Integer quantity;
    private String name;
    private Double price;
    private Double lineTotal;

    public OrderItem() {}

    public OrderItem(int productId, int quantity) {
        this.productId = productId;
        this.quantity = quantity;
    }

    public Integer getProductId() { return productId; }
    public Integer getQuantity() { return quantity; }
    public String getName() { return name; }
    public Double getPrice() { return price; }
    public Double getLineTotal() { return lineTotal; }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/OrderRequest.java',
    why: 'The POST /api/orders body. A small builder keeps step definitions readable and makes "leave lastName empty" negative tests one line.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderRequest {
    private String firstName;
    private String lastName;
    private String postalCode;
    private List<OrderItem> items;

    public OrderRequest() {}

    public OrderRequest(String firstName, String lastName, String postalCode) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.postalCode = postalCode;
    }

    public OrderRequest addItem(int productId, int quantity) {
        if (items == null) items = new ArrayList<>();
        items.add(new OrderItem(productId, quantity));
        return this;
    }

    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getPostalCode() { return postalCode; }
    public List<OrderItem> getItems() { return items; }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/Order.java',
    why: 'The order the API returns (201 on create, 200 on GET). Money is double here because the spec reads JSON numbers as Double.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Order {
    private int id;
    private int userId;
    private String status;
    private Customer customer;
    private List<OrderItem> items;
    private int itemCount;
    private double subtotal;
    private double tax;
    private double total;
    private String createdAt;

    public Order() {}

    public int getId() { return id; }
    public int getUserId() { return userId; }
    public String getStatus() { return status; }
    public Customer getCustomer() { return customer; }
    public List<OrderItem> getItems() { return items; }
    public int getItemCount() { return itemCount; }
    public double getSubtotal() { return subtotal; }
    public double getTax() { return tax; }
    public double getTotal() { return total; }
    public String getCreatedAt() { return createdAt; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Customer {
        private String firstName;
        private String lastName;
        private String postalCode;

        public Customer() {}

        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getPostalCode() { return postalCode; }
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/models/ApiError.java',
    why: 'Every error from the API has the shape { error: { code, message, details? } }. One POJO lets negative tests assert the code and the field errors precisely.',
    lang: 'java',
    code: `package com.shopeasy.api.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ApiError {
    private Body error;

    public ApiError() {}

    public Body getError() { return error; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private String code;
        private String message;
        private List<FieldError> details;

        public Body() {}

        public String getCode() { return code; }
        public String getMessage() { return message; }
        public List<FieldError> getDetails() { return details; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FieldError {
        private String field;
        private String message;

        public FieldError() {}

        public String getField() { return field; }
        public String getMessage() { return message; }
    }
}`,
  },
  {
    path: 'src/test/resources/schemas/product-schema.json',
    why: 'The contract for one product (same as GET /api/schema/product). matchesJsonSchemaInClasspath("schemas/product-schema.json") fails if a field disappears, changes type or an unexpected one appears.',
    lang: 'json',
    code: `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "id": "http://localhost:5181/api/schema/product",
  "title": "Product",
  "type": "object",
  "required": ["id", "slug", "name", "price", "category", "stock", "inStock", "description"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "name": { "type": "string", "minLength": 1 },
    "price": { "type": "number", "minimum": 0, "exclusiveMinimum": true },
    "category": { "type": "string", "enum": ["bags", "accessories", "clothing", "kids"] },
    "stock": { "type": "integer", "minimum": 0 },
    "inStock": { "type": "boolean" },
    "description": { "type": "string" }
  }
}`,
  },
  {
    path: 'src/test/resources/features/products.feature',
    why: 'Catalogue checks written in business language: search, sort, a single product, a missing product and the schema contract.',
    lang: 'gherkin',
    code: `@api @products
Feature: Product catalogue API
  As the mobile app
  I want to read the ShopEasy catalogue
  So that shoppers can browse products

  @smoke
  Scenario: The catalogue lists every product
    When I request the product list
    Then the response status should be 200
    And the product list should contain 6 products

  Scenario: Sorting by price, highest first
    When I request the product list sorted by "price_desc"
    Then the response status should be 200
    And the first product should be "Storm Fleece Jacket"

  Scenario: One product matches the contract
    When I request product 1
    Then the response status should be 200
    And the product name should be "Trailblazer Backpack"
    And the product should match the product schema

  @negative
  Scenario: A product that does not exist
    When I request product 99
    Then the response status should be 404
    And the error code should be "PRODUCT_NOT_FOUND"`,
  },
  {
    path: 'src/test/resources/features/orders.feature',
    why: 'The order journey. The DataTable carries the order lines; the Scenario Outline is your validation decision table — one row per missing field.',
    lang: 'gherkin',
    code: `@api @orders
Feature: Order API
  As a logged-in shopper
  I want to place orders through the API
  So that the mobile app can check out

  Background:
    Given I am logged in as "standard_user"

  @smoke
  Scenario: Place an order and read it back
    When I place an order for "Asha" "Rao" with postal code "560001" containing
      | productId | quantity |
      | 1         | 2        |
    Then the response status should be 201
    And the order totals should be subtotal 59.98, tax 4.80 and total 64.78
    When I fetch the order I just placed
    Then the response status should be 200
    And the order status should be "PLACED"

  @negative
  Scenario Outline: Order is rejected when <field> is missing
    When I place an order for "<firstName>" "<lastName>" with postal code "<postalCode>" containing
      | productId | quantity |
      | 2         | 1        |
    Then the response status should be 400
    And the error code should be "VALIDATION_FAILED"
    And the error details should mention the field "<field>"

    Examples:
      | firstName | lastName | postalCode | field      |
      |           | Rao      | 560001     | firstName  |
      | Asha      |          | 560001     | lastName   |
      | Asha      | Rao      |            | postalCode |

  @negative
  Scenario: Orders need a logged-in user
    Given I am not logged in
    When I place an order for "Asha" "Rao" with postal code "560001" containing
      | productId | quantity |
      | 1         | 1        |
    Then the response status should be 401
    And the error code should be "UNAUTHORIZED"`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/context/ScenarioContext.java',
    why: 'PicoContainer creates one ScenarioContext per scenario and injects it into every step class. It carries the last Response, the token and the id of the order just created between steps.',
    lang: 'java',
    code: `package com.shopeasy.api.context;

import io.restassured.response.Response;

public class ScenarioContext {
    private Response response;
    private String token;
    private Integer lastOrderId;

    public Response getResponse() {
        if (response == null) throw new IllegalStateException("No request has been sent in this scenario yet");
        return response;
    }

    public void setResponse(Response response) { this.response = response; }

    public boolean hasResponse() { return response != null; }

    public String getToken() { return token; }

    public void setToken(String token) { this.token = token; }

    public Integer getLastOrderId() { return lastOrderId; }

    public void setLastOrderId(Integer lastOrderId) { this.lastOrderId = lastOrderId; }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/steps/CommonSteps.java',
    why: 'Status-code and error-body checks used by every feature live once, here. Note: steps only assert on ctx.getResponse() — they never send requests of their own.',
    lang: 'java',
    code: `package com.shopeasy.api.steps;

import com.shopeasy.api.clients.AuthClient;
import com.shopeasy.api.context.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

public class CommonSteps {
    private final ScenarioContext ctx;

    public CommonSteps(ScenarioContext ctx) {
        this.ctx = ctx;
    }

    @Given("I am logged in as {string}")
    public void iAmLoggedInAs(String username) {
        ctx.setToken(AuthClient.tokenFor(username, "secret_sauce"));
    }

    @Given("I am not logged in")
    public void iAmNotLoggedIn() {
        ctx.setToken("no-token");
    }

    @Then("the response status should be {int}")
    public void theResponseStatusShouldBe(int status) {
        ctx.getResponse().then().statusCode(status);
    }

    @Then("the error code should be {string}")
    public void theErrorCodeShouldBe(String code) {
        ctx.getResponse().then().body("error.code", equalTo(code));
    }

    @Then("the error details should mention the field {string}")
    public void theErrorDetailsShouldMention(String field) {
        ctx.getResponse().then().body("error.details.field", hasItem(field));
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/steps/ProductSteps.java',
    why: 'Thin steps: call the ProductClient, store the Response in the context, assert with Hamcrest and JsonPath. Schema validation is one matcher.',
    lang: 'java',
    code: `package com.shopeasy.api.steps;

import com.shopeasy.api.clients.ProductClient;
import com.shopeasy.api.context.ScenarioContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.Map;

import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;

public class ProductSteps {
    private final ScenarioContext ctx;
    private final ProductClient products = new ProductClient();

    public ProductSteps(ScenarioContext ctx) {
        this.ctx = ctx;
    }

    @When("I request the product list")
    public void iRequestTheProductList() {
        ctx.setResponse(products.list(Map.of()));
    }

    @When("I request the product list sorted by {string}")
    public void iRequestSorted(String sort) {
        ctx.setResponse(products.list(Map.of("sort", sort)));
    }

    @When("I request product {int}")
    public void iRequestProduct(int id) {
        ctx.setResponse(products.byId(id));
    }

    @Then("the product list should contain {int} products")
    public void listShouldContain(int count) {
        ctx.getResponse().then()
            .body("data.size()", equalTo(count))
            .body("total", equalTo(count));
    }

    @Then("the first product should be {string}")
    public void firstProductShouldBe(String name) {
        ctx.getResponse().then().body("data[0].name", equalTo(name));
    }

    @Then("the product name should be {string}")
    public void productNameShouldBe(String name) {
        ctx.getResponse().then().body("name", equalTo(name));
    }

    @Then("the product should match the product schema")
    public void productShouldMatchSchema() {
        ctx.getResponse().then().body(matchesJsonSchemaInClasspath("schemas/product-schema.json"));
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/steps/OrderSteps.java',
    why: 'Builds the OrderRequest from the DataTable, stores the new order id (extract → context) and reads the order back — request chaining across steps.',
    lang: 'java',
    code: `package com.shopeasy.api.steps;

import com.shopeasy.api.clients.OrderClient;
import com.shopeasy.api.context.ScenarioContext;
import com.shopeasy.api.models.Order;
import com.shopeasy.api.models.OrderRequest;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

import java.util.Map;

import static org.hamcrest.Matchers.equalTo;

public class OrderSteps {
    private final ScenarioContext ctx;

    public OrderSteps(ScenarioContext ctx) {
        this.ctx = ctx;
    }

    private OrderClient orders() {
        return new OrderClient(ctx.getToken());
    }

    @When("I place an order for {string} {string} with postal code {string} containing")
    public void iPlaceAnOrder(String firstName, String lastName, String postalCode, DataTable table) {
        OrderRequest request = new OrderRequest(firstName, lastName, postalCode);
        for (Map<String, String> row : table.asMaps()) {
            request.addItem(Integer.parseInt(row.get("productId")), Integer.parseInt(row.get("quantity")));
        }
        ctx.setResponse(orders().place(request));
        if (ctx.getResponse().statusCode() == 201) {
            ctx.setLastOrderId(ctx.getResponse().path("id"));
        }
    }

    @When("I fetch the order I just placed")
    public void iFetchTheOrder() {
        Assert.assertNotNull(ctx.getLastOrderId(), "No order was created earlier in this scenario");
        ctx.setResponse(orders().byId(ctx.getLastOrderId()));
    }

    @Then("the order totals should be subtotal {double}, tax {double} and total {double}")
    public void theOrderTotalsShouldBe(double subtotal, double tax, double total) {
        Order order = ctx.getResponse().as(Order.class);
        Assert.assertEquals(order.getSubtotal(), subtotal, 0.001, "subtotal");
        Assert.assertEquals(order.getTax(), tax, 0.001, "tax (8%)");
        Assert.assertEquals(order.getTotal(), total, 0.001, "total");
    }

    @Then("the order status should be {string}")
    public void theOrderStatusShouldBe(String status) {
        ctx.getResponse().then()
            .body("status", equalTo(status))
            .body("id", equalTo(ctx.getLastOrderId()));
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/hooks/Hooks.java',
    why: 'Every scenario starts from known data (POST /api/reset, then clear cached tokens). On failure the last response body is attached to the Cucumber report — the API equivalent of a screenshot.',
    lang: 'java',
    code: `package com.shopeasy.api.hooks;

import com.shopeasy.api.clients.AuthClient;
import com.shopeasy.api.context.ScenarioContext;
import com.shopeasy.api.endpoints.Endpoints;
import com.shopeasy.api.specs.SpecFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

import static io.restassured.RestAssured.given;

public class Hooks {
    private final ScenarioContext ctx;

    public Hooks(ScenarioContext ctx) {
        this.ctx = ctx;
    }

    @Before(order = 0)
    public void resetData() {
        given().spec(SpecFactory.base()).when().post(Endpoints.RESET).then().statusCode(200);
        AuthClient.clearCache();
    }

    @After
    public void attachResponseOnFailure(Scenario scenario) {
        if (scenario.isFailed() && ctx.hasResponse()) {
            String report = "HTTP " + ctx.getResponse().statusCode() + System.lineSeparator()
                + ctx.getResponse().asPrettyString();
            scenario.attach(report, "text/plain", "Last API response");
        }
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/api/runners/TestRunner.java',
    why: 'Connects features, glue packages, reports and the default tag filter. Run a subset with -Dcucumber.filter.tags="@smoke".',
    lang: 'java',
    code: `package com.shopeasy.api.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
    features = "src/test/resources/features",
    glue = {"com.shopeasy.api.steps", "com.shopeasy.api.hooks"},
    plugin = {"pretty", "html:target/cucumber-report.html", "json:target/cucumber.json"},
    tags = "not @wip"
)
public class TestRunner extends AbstractTestNGCucumberTests {
}`,
  },
]

const TREE = `shopeasy-api-tests/
├── pom.xml                         ← RestAssured, schema validator, Jackson, Cucumber, TestNG
├── testng.xml                      ← suite Maven runs
└── src/test/
    ├── java/com/shopeasy/api/
    │   ├── config/ConfigReader.java      ← properties + -D overrides
    │   ├── specs/SpecFactory.java        ← RequestSpecBuilder / ResponseSpecBuilder
    │   ├── endpoints/Endpoints.java      ← every path in one place
    │   ├── clients/                      ← one class per API area
    │   │   ├── AuthClient.java           ← login + cached Bearer token
    │   │   ├── ProductClient.java
    │   │   ├── CartClient.java
    │   │   └── OrderClient.java
    │   ├── models/                       ← Jackson POJOs
    │   │   ├── Product.java  ProductPage.java
    │   │   ├── OrderRequest.java  OrderItem.java  Order.java
    │   │   └── ApiError.java
    │   ├── context/ScenarioContext.java  ← Response, token, order id (PicoContainer)
    │   ├── steps/                        ← CommonSteps, ProductSteps, OrderSteps
    │   ├── hooks/Hooks.java              ← reset data, attach response on failure
    │   └── runners/TestRunner.java       ← @CucumberOptions
    └── resources/
        ├── config/qa.properties
        ├── schemas/product-schema.json
        └── features/
            ├── products.feature
            └── orders.feature`

export default {
  id: 'restassured-cucumber',
  order: 3,
  label: 'RestAssured + Cucumber (API)',
  stack: 'Java 17 · RestAssured 5 · Cucumber 7 · TestNG · Jackson · Maven',
  intro:
    'A complete API test framework for the ShopEasy practice API (npm run api → http://localhost:5181/api): a base spec, token handling, endpoint clients, Jackson POJOs, JSON schema contracts and Cucumber features sharing state through a PicoContainer ScenarioContext — the layout to describe when an interviewer asks "how is your API framework built?".',
  tree: TREE,
  files: FILES,
  commands: [
    ['Start the practice API (in the app folder)', 'npm run api'],
    ['Run everything', 'mvn clean test'],
    ['Only smoke scenarios', 'mvn clean test -Dcucumber.filter.tags="@smoke"'],
    ['Only negative order tests', 'mvn clean test -Dcucumber.filter.tags="@orders and @negative"'],
    ['Against staging', 'mvn clean test -Denv=staging'],
    ['Override the base URI', 'mvn clean test -DbaseUri=http://localhost:5181'],
  ],
}
