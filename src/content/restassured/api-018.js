export default {
  id: 'api-018',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Cucumber step definitions with a shared ScenarioContext (PicoContainer)',
  level: 'ADVANCED',
  tags: ['cucumber', 'picocontainer', 'dependency-injection', 'step-definitions', 'datatable'],
  estMinutes: 40,
  scenario: `The order feature from api-014 is approved; now it needs step definitions. The steps live in two classes —
\`AuthSteps\` (login) and \`OrderSteps\` (orders) — and both need the token and the last \`Response\`. A teammate shared them
through \`public static\` fields. It worked until the suite ran in parallel: scenario A asserted scenario B's response
and the nightly report showed random failures nobody could reproduce.`,
  description: `Implement these steps (three classes shown in one editor; \`cucumber-picocontainer\` is on the classpath):

\`\`\`gherkin
Given I am logged in as "standard_user"
When I place an order for "Asha" "Rao" with postal code "560001" and these products:
  | product              | quantity |
  | Trailblazer Backpack | 2        |
  | Pulse Bike Light     | 1        |
Then the order is created with status 201
And the order totals are:
  | subtotal | 69.97 |
  | tax      | 5.60  |
  | total    | 75.57 |
\`\`\`

**Rules**
- A \`ScenarioContext\` class holds the \`token\` and the last \`Response\` (plain fields + getters/setters, **not static**).
- \`AuthSteps\` and \`OrderSteps\` receive it through their **constructor** — PicoContainer creates one per scenario.
- The products step takes a \`DataTable\` (or \`List<Map<String, String>>\`), resolves each product **name** to its id
  from \`GET /api/products\` (GPath \`data.find { it.name == '...' }.id\`) and posts the order.
- The totals step takes a \`Map<String, String>\` and compares as \`BigDecimal\` with \`compareTo\` (so 5.6 equals 5.60).
- No \`static\` Response or token anywhere.`,
  starterCode: `// ---- ScenarioContext.java ---------------------------------------------
package com.shopeasy.api.context;

public class ScenarioContext {
    // TODO
}

// ---- AuthSteps.java ----------------------------------------------------
package com.shopeasy.api.steps;

import io.cucumber.java.en.Given;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class AuthSteps {
    public static String token;          // shared with OrderSteps
    public static Response lastResponse; // shared with OrderSteps

    @Given("I am logged in as {string}")
    public void iAmLoggedInAs(String username) {
        token = given().baseUri("http://localhost:5181").contentType(ContentType.JSON)
            .body(Map.of("username", username, "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");
    }
}

// ---- OrderSteps.java ---------------------------------------------------
package com.shopeasy.api.steps;

public class OrderSteps {
    // TODO: place order from DataTable, status step, totals step
}
`,
  solution: `// ---- ScenarioContext.java ---------------------------------------------
package com.shopeasy.api.context;

import io.restassured.response.Response;

/** One instance per scenario, created and injected by PicoContainer. */
public class ScenarioContext {
    private String token;
    private Response response;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Response getResponse() { return response; }
    public void setResponse(Response response) { this.response = response; }
}

// ---- AuthSteps.java ----------------------------------------------------
package com.shopeasy.api.steps;

import com.shopeasy.api.context.ScenarioContext;
import io.cucumber.java.en.Given;
import io.restassured.http.ContentType;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class AuthSteps {
    private static final String BASE_URI = "http://localhost:5181";
    private final ScenarioContext context;

    public AuthSteps(ScenarioContext context) {
        this.context = context;
    }

    @Given("I am logged in as {string}")
    public void iAmLoggedInAs(String username) {
        String token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", username, "password", "secret_sauce"))
            .when().post("/api/auth/login")
            .then().statusCode(200).extract().path("token");
        context.setToken(token);
    }
}

// ---- OrderSteps.java ---------------------------------------------------
package com.shopeasy.api.steps;

import com.shopeasy.api.context.ScenarioContext;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import org.testng.Assert;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;

public class OrderSteps {
    private static final String BASE_URI = "http://localhost:5181";
    private final ScenarioContext context;

    public OrderSteps(ScenarioContext context) {
        this.context = context;
    }

    @When("I place an order for {string} {string} with postal code {string} and these products:")
    public void iPlaceAnOrder(String firstName, String lastName, String postalCode, DataTable table) {
        JsonPath catalogue = given().baseUri(BASE_URI).queryParam("size", 50)
            .when().get("/api/products")
            .then().statusCode(200).extract().jsonPath();

        List<Map<String, Object>> items = table.asMaps(String.class, String.class).stream()
            .map(row -> Map.<String, Object>of(
                "productId", catalogue.getInt("data.find { it.name == '" + row.get("product") + "' }.id"),
                "quantity", Integer.parseInt(row.get("quantity"))))
            .toList();

        Response response = given()
            .baseUri(BASE_URI)
            .auth().oauth2(context.getToken())
            .contentType(ContentType.JSON)
            .body(Map.of("firstName", firstName, "lastName", lastName, "postalCode", postalCode, "items", items))
        .when()
            .post("/api/orders");

        context.setResponse(response);
    }

    @Then("the order is created with status {int}")
    public void theOrderIsCreatedWithStatus(int status) {
        context.getResponse().then().statusCode(status);
    }

    @Then("the order totals are:")
    public void theOrderTotalsAre(Map<String, String> expectedTotals) {
        JsonPath body = context.getResponse().jsonPath();
        expectedTotals.forEach((field, expected) -> {
            BigDecimal actual = new BigDecimal(body.getString(field));
            Assert.assertEquals(actual.compareTo(new BigDecimal(expected)), 0,
                field + ": expected " + expected + " but was " + actual);
        });
    }
}
`,
  checks: [
    { label: 'ScenarioContext holds a Response', pattern: 'class\\s+ScenarioContext\\s*\\{[\\s\\S]*private\\s+Response\\s+\\w+', hint: 'public class ScenarioContext { private Response response; ... }' },
    { label: 'Steps get the context via the constructor', pattern: 'public\\s+(Auth|Order)Steps\\s*\\(\\s*ScenarioContext\\s+\\w+\\s*\\)', hint: 'public OrderSteps(ScenarioContext context) { this.context = context; }' },
    { label: 'No static Response or token', pattern: 'static\\s+(Response|String\\s+token)\\b', mustNot: true, hint: 'Static state leaks between parallel scenarios.' },
    { label: 'Products step takes a DataTable', pattern: '(DataTable\\s+\\w+|List<\\s*Map<\\s*String\\s*,\\s*String\\s*>\\s*>\\s+\\w+)\\s*\\)', hint: 'public void iPlaceAnOrder(String firstName, ..., DataTable table)' },
    { label: 'Resolves names to ids with GPath find', pattern: 'data\\.find\\s*\\{', hint: 'catalogue.getInt("data.find { it.name == \'...\' }.id")' },
    { label: 'Stores the response in the context', pattern: 'context\\.setResponse\\(', hint: 'context.setResponse(response);' },
    { label: 'Compares totals as BigDecimal', pattern: 'BigDecimal[\\s\\S]*compareTo\\(', hint: 'new BigDecimal(actual).compareTo(new BigDecimal(expected)) == 0' },
  ],
  hints: [
    'With cucumber-picocontainer, any class with a constructor parameter gets it injected — no annotations needed.',
    'A two-column table without a header maps straight to Map<String, String>.',
    'Store the Response, assert later: the When step acts, the Then steps check.',
  ],
  explanation: `**Dependency injection with PicoContainer**: for every scenario Cucumber creates a fresh \`ScenarioContext\` and
passes the *same* instance to every step class that asks for it in its constructor. State is shared **within** a
scenario and isolated **between** scenarios — exactly what static fields cannot do in parallel runs.

Step design:
- The **When** step acts and stores the \`Response\` in the context; **Then** steps only assert. That keeps steps
  reusable ("the order is created with status {int}" works after any order call).
- Product **names** from the table are resolved to ids through the catalogue API, so the feature stays readable and
  the test does not break when ids change.
- \`BigDecimal.compareTo\` ignores scale, so \`5.6\` (what JSON returns) equals \`5.60\` (what the PO wrote).

In the full framework (see the RestAssured blueprint) the HTTP calls move into \`AuthClient\`/\`OrderClient\` classes
and the base URI comes from config — the steps then shrink to a few lines each.`,
  mistakes: [
    'Static fields for shared state — works alone, random failures in parallel.',
    'Asserting inside the When step — the Then steps become meaningless and failures point at the wrong line.',
    'Comparing money as Strings ("5.6" vs "5.60") or doubles without tolerance.',
    'Forgetting the cucumber-picocontainer dependency — Cucumber fails with "class has no no-arg constructor".',
  ],
  interview: [
    { q: 'How do you share data between step definition classes?', a: 'Through a scenario-scoped context object injected by a DI container — PicoContainer (simplest), Spring or Guice. Cucumber creates new step and context instances per scenario, so state never leaks.' },
    { q: 'Why not use static variables?', a: 'Static fields are shared by all scenarios and threads. With parallel execution, one scenario overwrites another\'s response or token; even sequentially, leftovers from a previous scenario can hide failures.' },
  ],
}
