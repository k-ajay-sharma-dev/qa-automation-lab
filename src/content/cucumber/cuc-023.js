export default {
  id: 'cuc-023',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Doc String: send the JSON order body from the feature file',
  level: 'INTERMEDIATE',
  tags: ['doc-string', 'api', 'restassured', 'picocontainer'],
  estMinutes: 25,
  scenario: `The API team wants BDD scenarios for \`POST /api/orders\` on the ShopEasy API (\`http://localhost:5181/api\`). A colleague built the
request JSON by string concatenation **inside the step definition**, so the BA cannot see what is actually sent, and every new order variant
needs a new Java method. The agreement in refinement: the request body lives in the feature file as a Doc String.`,
  description: `Feature file:

\`\`\`gherkin
@api
Feature: Place an order through the API

  Background:
    Given the API client is logged in as "standard_user"

  Scenario: Two backpacks are ordered with tax added
    When the client places an order with body
      """json
      {
        "firstName": "Asha",
        "lastName": "Rao",
        "postalCode": "560001",
        "items": [ { "productId": 1, "quantity": 2 } ]
      }
      """
    Then the response status is 201
    And the order total is 64.78
\`\`\`

(2 × 29.99 = 59.98, tax 8 % = 4.80, total 64.78.)

Implement the When step in \`OrderApiSteps\`.

**Rules**
- The Doc String arrives as the **last (here: only) method parameter** — a \`String\` (or \`io.cucumber.docstring.DocString\`). The expression has no placeholder for it.
- Send it with RestAssured: JSON content type, \`Authorization: Bearer <token>\` from the shared \`ApiContext\`, \`POST /orders\`.
- Store the response in the \`ApiContext\` so the Then steps (in another class) can check it.
- No JSON field names hard-coded in Java — the feature file owns the body.`,
  starterCode: `package com.shopeasy.api.steps;

import com.shopeasy.api.support.ApiContext;
import io.cucumber.java.en.When;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;

public class OrderApiSteps {

    private final ApiContext context;

    public OrderApiSteps(ApiContext context) {
        this.context = context;
    }

    @When("the client places an order with body")
    public void placeOrder() {
        String body = "{\\"firstName\\":\\"Asha\\",\\"lastName\\":\\"Rao\\",\\"postalCode\\":\\"560001\\","
                + "\\"items\\":[{\\"productId\\":1,\\"quantity\\":2}]}";
        Response response = given()
                .baseUri("http://localhost:5181/api")
                .body(body)
                .post("/orders");
        // TODO: the Doc String from the feature file is ignored, no token, response is lost
    }
}
`,
  solution: `// ----- com/shopeasy/api/support/ApiContext.java -----
package com.shopeasy.api.support;

import io.restassured.response.Response;

/** One per scenario (PicoContainer): token and last response shared by all API step classes. */
public class ApiContext {
    public static final String BASE_URI = "http://localhost:5181/api";

    private String token;
    private Response lastResponse;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public Response getLastResponse() { return lastResponse; }
    public void setLastResponse(Response response) { this.lastResponse = response; }
}

// ----- com/shopeasy/api/steps/OrderApiSteps.java -----
package com.shopeasy.api.steps;

import com.shopeasy.api.support.ApiContext;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;

public class OrderApiSteps {

    private final ApiContext context;

    public OrderApiSteps(ApiContext context) {
        this.context = context;
    }

    @When("the client places an order with body")
    public void placeOrder(String body) {
        Response response = given()
                .baseUri(ApiContext.BASE_URI)
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + context.getToken())
                .body(body)
            .when()
                .post("/orders");
        context.setLastResponse(response);
    }
}

// ----- com/shopeasy/api/steps/ResponseSteps.java -----
package com.shopeasy.api.steps;

import com.shopeasy.api.support.ApiContext;
import io.cucumber.java.en.Then;
import org.testng.Assert;

import java.math.BigDecimal;

public class ResponseSteps {

    private final ApiContext context;

    public ResponseSteps(ApiContext context) {
        this.context = context;
    }

    @Then("the response status is {int}")
    public void responseStatusIs(int expected) {
        Assert.assertEquals(context.getLastResponse().statusCode(), expected,
                "Status, body was: " + context.getLastResponse().asString());
    }

    @Then("the order total is {bigdecimal}")
    public void orderTotalIs(BigDecimal expected) {
        BigDecimal actual = new BigDecimal(context.getLastResponse().jsonPath().getString("total"));
        Assert.assertEquals(actual.compareTo(expected), 0, "Order total " + actual);
    }
}
`,
  checks: [
    { label: 'Doc String received as the method parameter', pattern: '@When\\(\\s*"[^"{]*"\\s*\\)\\s*public\\s+void\\s+\\w+\\s*\\(\\s*(String|DocString)\\s+\\w+\\s*\\)', hint: '@When("the client places an order with body") public void placeOrder(String body)' },
    { label: 'Sends the body variable', pattern: '\\.body\\s*\\(\\s*\\w+(\\.getContent\\(\\))?\\s*\\)', hint: '.body(body)' },
    { label: 'JSON content type', pattern: 'ContentType\\.JSON|"application/json"', hint: '.contentType(ContentType.JSON)' },
    { label: 'Bearer token from the context', pattern: '("Bearer\\s*"\\s*\\+|oauth2\\s*\\()\\s*context\\.\\w+', hint: '.header("Authorization", "Bearer " + context.getToken())' },
    { label: 'Response stored in the context', pattern: 'context\\.set\\w*\\s*\\(\\s*\\w+\\s*\\)', hint: 'context.setLastResponse(response);' },
    { label: 'No JSON hard-coded in Java', pattern: 'firstName', mustNot: true, hint: 'The feature file owns the body — delete the string concatenation.' },
  ],
  hints: [
    'A Doc String, like a DataTable, is always passed as the last argument — after any {string}/{int} parameters.',
    'Declare String (just the text) or io.cucumber.docstring.DocString (text plus the content type "json" from the opening quotes).',
    'The login step (another class) puts the token into ApiContext; read it with context.getToken().',
  ],
  explanation: `A Doc String hands **multi-line text** to one step. Cucumber strips the common indentation and passes the content as the final
argument. The optional content type after the quotes (\`"""json\`) is informational for readers and tools; with a \`DocString\`
parameter you can read it via \`getContentType()\`.

Why this matters on an API project:
- The BA and developers see the **exact** request in the scenario and the HTML report.
- A new variant (missing postal code, 3 items, quantity 0) is a new scenario, not a new Java method — one generic step serves all.
- The step definition stays a thin transport layer: send, store the response, done. Assertions live in Then steps.

Sharing the response via an injected \`ApiContext\` (PicoContainer) lets \`ResponseSteps\` check status and body for every API feature.
Keep Doc Strings short and meaningful: if the same 40-line body appears in many scenarios, move the template to a file and describe only the
difference in Gherkin ("with quantity 0").`,
  mistakes: [
    'Adding {string} to the expression for the Doc String — the step becomes undefined; Doc Strings need no placeholder.',
    'Forgetting the blank-free indentation: the closing """ must line up with the opening one.',
    'Keeping a static Response field to share it between step classes — breaks in parallel runs.',
    'Pasting huge payloads into every scenario — readers stop reading; keep only what matters to the example.',
  ],
  interview: [
    { q: 'How do you pass a JSON body to a Cucumber step?', a: 'With a Doc String under the step, between triple quotes, optionally tagged with json. The step definition receives it as a final String or DocString parameter and sends it as the request body.' },
    { q: 'How do API step classes share the token and the last response?', a: 'Through a scenario-scoped context object injected by PicoContainer: the login step stores the token, the request step stores the Response, and the Then steps read it.' },
  ],
}
