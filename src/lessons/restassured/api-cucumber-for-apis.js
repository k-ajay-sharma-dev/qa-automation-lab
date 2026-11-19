export default {
  slug: 'api-cucumber-for-apis',
  category: 'restassured',
  order: 8,
  title: 'Cucumber for APIs: declarative features, DataTables and a shared ScenarioContext',
  minutes: 10,
  summary: 'Write API feature files a product owner can read, pass request data with DataTables, and share the last Response between step classes with a PicoContainer-injected ScenarioContext.',
  manualAnalogy: `Your manual API test cases are written in business words: "a logged-in customer orders two backpacks, the total includes 8% tax". Nobody writes "POST /api/orders with this JSON" in a test plan the BA signs off. Cucumber for APIs keeps that business language in the feature file and moves the HTTP details into step definitions.`,
  body: `## Declarative, not imperative

An **imperative** API scenario leaks HTTP into Gherkin:

\`\`\`gherkin
Given I set header "Content-Type" to "application/json"
When I send POST to "/api/cart/items" with body "{\\"productId\\": 5}"
Then the response status should be 201
\`\`\`

It is unreadable for the business, and every URL change breaks the feature. A **declarative** scenario says *what*, not *how*:

\`\`\`gherkin
Feature: Shopping cart API
  The mobile app adds products to the customer's cart through the cart API.

  Background:
    Given the customer "standard_user" is logged in

  Scenario: Adding an in-stock product
    When the customer adds 2 of "Junior Onesie" to the cart
    Then the cart contains 2 items
    And the cart subtotal is 15.98

  Scenario Outline: Products that cannot be added
    When the customer adds 1 of "<product>" to the cart
    Then the request is rejected with status <status> and code "<code>"

    Examples:
      | product        | status | code              |
      | Retro Red Tee  | 422    | OUT_OF_STOCK      |
      | Unknown Widget | 404    | PRODUCT_NOT_FOUND |
\`\`\`

It is fine for a **Then** step to mention a status code — testers and developers both speak that language — but keep methods, URLs and raw JSON out of the steps. A Scenario Outline is the Gherkin version of a DataProvider: perfect for error matrices.

Three habits make outlines readable in the report:
- Put placeholders in the **title** too (\`Scenario Outline: Adding "<product>" is rejected with <code>\`), so every row gets its own name.
- Choose rows like a boundary-value table: the valid edges, the invalid neighbours (0 and 11 for a 1–10 quantity), a different letter case, an empty result.
- Split valid and invalid data into **separate outlines** (or separate \`Examples:\` blocks, each with its own tag such as \`@negative\`) instead of an if/else in the step definition.

## DataTables for request data

When a step needs several fields (an order, a profile), pass a table:

\`\`\`gherkin
When the customer updates the delivery address to
  | street | 7 Lake View |
  | city   | Mysuru      |
\`\`\`

\`\`\`java
@When("the customer updates the delivery address to")
public void updateAddress(Map<String, String> address) {
    ctx.setResponse(users.patch(ctx.userId(), Map.of("address", address)));
}
\`\`\`

- A two-column table converts to \`Map<String, String>\` (key → value).
- A table with a header row converts to \`List<Map<String, String>>\` — one map per row — ideal for several order lines (\`product | quantity\`).
- Read by column name, then convert values (\`Integer.parseInt(row.get("quantity"))\`).

## Sharing state between steps: ScenarioContext

The *When* step sends the request; the *Then* step, possibly in another step class, must assert on the **same** response. Static fields would leak between scenarios and break parallel runs. Instead, use dependency injection with **PicoContainer**:

\`\`\`xml
<dependency>
  <groupId>io.cucumber</groupId>
  <artifactId>cucumber-picocontainer</artifactId>
  <version>7.20.1</version>
  <scope>test</scope>
</dependency>
\`\`\`

\`\`\`java
public class ScenarioContext {
    private Response response;
    private String token;
    private final Map<String, Object> saved = new HashMap<>();

    public Response response()            { return response; }
    public void setResponse(Response r)   { this.response = r; }
    public String token()                 { return token; }
    public void setToken(String t)        { this.token = t; }
    public void save(String key, Object v){ saved.put(key, v); }
    public <T> T get(String key)          { return (T) saved.get(key); }
}
\`\`\`

\`\`\`java
public class CartSteps {
    private final ScenarioContext ctx;
    public CartSteps(ScenarioContext ctx) { this.ctx = ctx; }   // injected
    ...
}
public class CommonSteps {
    private final ScenarioContext ctx;
    public CommonSteps(ScenarioContext ctx) { this.ctx = ctx; } // SAME instance in one scenario

    @Then("the request is rejected with status {int} and code {string}")
    public void rejected(int status, String code) {
        ctx.response().then().statusCode(status).body("error.code", equalTo(code));
    }
}
\`\`\`

How it works: for every scenario PicoContainer creates **one** \`ScenarioContext\` and passes it to the constructor of every step class that asks for it. Next scenario, fresh instance — no leftovers. No annotations needed; just the dependency and a constructor parameter.

## Typical step layout

| Step type | Does | Stores in context |
|---|---|---|
| Given (setup) | log in, create test data via API | token, ids |
| When (action) | call one client method | the \`Response\` |
| Then (check) | assert on \`ctx.response()\` | nothing |

Keep **When** steps free of assertions (except maybe nothing at all) so the same action can be reused for positive and negative scenarios; let **Then** steps decide what "correct" means.

## Hooks and runner

\`@Before\` can reset data or set up the base spec; \`@After\` can attach the last response to the report:

\`\`\`java
@After
public void attach(Scenario scenario) {
    if (scenario.isFailed() && ctx.response() != null)
        scenario.attach(ctx.response().asPrettyString(), "application/json", "last response");
}
\`\`\`

The runner is the same \`@CucumberOptions\` + \`AbstractTestNGCucumberTests\` class you know from the UI framework, with glue pointing at the API steps and hooks packages.`,
  keyPoints: [
    'Declarative steps describe business behaviour; URLs, methods and JSON live in step definitions/clients.',
    'Scenario Outline + Examples is the Gherkin way to run an error matrix.',
    'Two-column DataTable → Map<String,String>; headed table → List<Map<String,String>>.',
    'PicoContainer injects one ScenarioContext per scenario into every step class that declares it in its constructor.',
    'When steps store the Response in the context; Then steps assert on it.',
  ],
  mistakes: [
    'Raw JSON and endpoint paths inside Gherkin steps — unreadable and brittle.',
    'Sharing the Response through a static field — leaks between scenarios and breaks parallel runs.',
    'Forgetting cucumber-picocontainer in the pom — Cucumber cannot construct step classes with constructor parameters.',
    'Asserting inside When steps, so the same step cannot be reused for negative scenarios.',
  ],
  tryIt: `Take three Postman requests you would run for the practice API's /api/users/{id} (read, PATCH city, PATCH with a bad email) and write them as declarative Gherkin scenarios. Underline every word that is HTTP detail — none should be left except, at most, a status code in a Then step.`,
  problems: ['api-005', 'api-014', 'api-017', 'api-018', 'api-024'],
}
