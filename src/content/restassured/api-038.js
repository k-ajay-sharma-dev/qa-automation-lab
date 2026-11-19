export default {
  id: 'api-038',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Cucumber: When stores the response, Then asserts it — reusable error-contract steps',
  level: 'ADVANCED',
  tags: ['cucumber', 'step-definitions', 'scenario-context', 'error-contract', 'picocontainer'],
  estMinutes: 35,
  scenario: `The profile team writes many small API scenarios: "invalid email is refused", "phone can be changed", "someone
else's profile is forbidden". Today every \`When\` step calls the API **and** checks the status inside the same method,
so a scenario that expects 422 needs its own copy of the step, and the \`Then\` lines in the feature file are empty
promises — they never assert anything. You will split the steps: \`When\` only calls and stores, \`Then\` only reads and
asserts, so a handful of generic \`Then\` steps serve every scenario.`,
  description: `Make these scenarios run (\`cucumber-picocontainer\` is on the classpath; login steps already exist and
put the token and user id into the context):

\`\`\`gherkin
Scenario: An invalid email is refused
  Given I am logged in as "standard_user"
  When I update my profile with:
    | email | asha.rao-at-shopeasy |
  Then the response status is 422
  And the error code is "INVALID_EMAIL"
  And the error details mention the field "email"

Scenario: The phone number can be changed
  Given I am logged in as "standard_user"
  When I update my profile with:
    | phone | +91-80-5550-9999 |
  Then the response status is 200
  And the response field "phone" is "+91-80-5550-9999"
\`\`\`

**Rules**
- \`ApiContext\` holds \`token\`, \`userId\` and \`lastResponse\` as normal (non-static) fields with getters/setters.
- \`ProfileSteps\` gets the \`ApiContext\` through its **constructor**.
- The \`When\` step sends \`PATCH /api/users/{id}\` with the table as a JSON body and **stores** the \`Response\` — no
  \`.then()\` / status check in the When step.
- The \`Then\` steps make **no HTTP calls**; they read \`getLastResponse()\` and assert. Error code comes from
  \`error.code\`, the fields from \`error.details.field\`.
- Put the response body in the assertion message so a failing report shows what came back.`,
  starterCode: `// ---- ApiContext.java ---------------------------------------------------
package com.shopeasy.api.context;

public class ApiContext {
    // TODO: token, userId, lastResponse
}

// ---- ProfileSteps.java -------------------------------------------------
package com.shopeasy.api.steps;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class ProfileSteps {
    public static Response response;
    public static String token;

    @When("I update my profile with:")
    public void iUpdateMyProfileWith(Map<String, String> fields) {
        response = given().baseUri("http://localhost:5181")
            .header("Authorization", "Bearer " + token)
            .contentType(ContentType.JSON)
            .body(fields)
            .when().patch("/api/users/1")
            .then().statusCode(200)
            .extract().response();
    }

    @Then("the response status is {int}")
    public void theResponseStatusIs(int status) {
        // TODO
    }

    @Then("the error code is {string}")
    public void theErrorCodeIs(String code) {
        // TODO
    }

    @Then("the error details mention the field {string}")
    public void theErrorDetailsMentionTheField(String field) {
        // TODO
    }

    @Then("the response field {string} is {string}")
    public void theResponseFieldIs(String path, String expected) {
        // TODO
    }
}
`,
  solution: `// ---- ApiContext.java ---------------------------------------------------
package com.shopeasy.api.context;

import io.restassured.response.Response;

public class ApiContext {
    private String token;
    private int userId;
    private Response lastResponse;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public Response getLastResponse() {
        if (lastResponse == null) {
            throw new IllegalStateException("No API call has been made in this scenario yet");
        }
        return lastResponse;
    }
    public void setLastResponse(Response lastResponse) { this.lastResponse = lastResponse; }
}

// ---- ProfileSteps.java -------------------------------------------------
package com.shopeasy.api.steps;

import com.shopeasy.api.context.ApiContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;

public class ProfileSteps {
    private final ApiContext ctx;

    public ProfileSteps(ApiContext ctx) {
        this.ctx = ctx;
    }

    @When("I update my profile with:")
    public void iUpdateMyProfileWith(Map<String, String> fields) {
        Response response = given()
                .baseUri("http://localhost:5181")
                .header("Authorization", "Bearer " + ctx.getToken())
                .contentType(ContentType.JSON)
                .body(fields)
            .when()
                .patch("/api/users/{id}", ctx.getUserId());
        ctx.setLastResponse(response);
    }

    @Then("the response status is {int}")
    public void theResponseStatusIs(int status) {
        Response response = ctx.getLastResponse();
        Assert.assertEquals(response.statusCode(), status, "Body was: " + response.asString());
    }

    @Then("the error code is {string}")
    public void theErrorCodeIs(String code) {
        Response response = ctx.getLastResponse();
        Assert.assertEquals(response.jsonPath().getString("error.code"), code, "Body was: " + response.asString());
    }

    @Then("the error details mention the field {string}")
    public void theErrorDetailsMentionTheField(String field) {
        Response response = ctx.getLastResponse();
        List<String> fields = response.jsonPath().getList("error.details.field", String.class);
        Assert.assertTrue(fields.contains(field), "Expected details for '" + field + "' but got " + fields);
    }

    @Then("the response field {string} is {string}")
    public void theResponseFieldIs(String path, String expected) {
        Response response = ctx.getLastResponse();
        Assert.assertEquals(response.jsonPath().getString(path), expected, "Body was: " + response.asString());
    }
}
`,
  checks: [
    { label: 'Context is injected through the constructor', pattern: 'public\\s+ProfileSteps\\s*\\(\\s*ApiContext\\s+\\w+\\s*\\)', hint: 'public ProfileSteps(ApiContext ctx) { this.ctx = ctx; }' },
    { label: 'When step stores the response in the context', pattern: '(setLastResponse\\s*\\(|\\.lastResponse\\s*=)', hint: 'ctx.setLastResponse(response);' },
    { label: 'Then steps read the stored response', pattern: 'getLastResponse\\(\\)', hint: 'Response response = ctx.getLastResponse();' },
    { label: 'Reads the error code from error.code', pattern: '"error\\.code"', hint: 'response.jsonPath().getString("error.code")' },
    { label: 'No static Response or token', pattern: 'static\\s+(Response|String\\s+token)', mustNot: true, hint: 'Static state leaks between scenarios — keep it in the per-scenario ApiContext.' },
    { label: 'When step does not assert the status', pattern: '\\.patch\\([^;]*\\.then\\(\\)', mustNot: true, hint: 'Send and store in When; the expected status belongs in a Then step.' },
  ],
  hints: [
    'PicoContainer creates one ApiContext per scenario and passes the same instance to every step class that asks for it in its constructor.',
    'Without .then(), patch(...) simply returns the Response — whatever status it has.',
    'response.jsonPath().getList("error.details.field", String.class) gives ["email"] for the invalid email.',
  ],
  explanation: `Splitting **action** (When) from **verification** (Then) is what makes API step definitions reusable:

- The \`When\` step has no opinion about the outcome, so the same step drives a 200 scenario and a 422 scenario.
- Four generic \`Then\` steps — status, error code, detail field, response field — cover most profile, cart and order
  scenarios, because every ShopEasy error has the same \`{ error: { code, message, details } }\` shape.
- The \`Response\` travels through the per-scenario \`ApiContext\`, never through \`static\` fields, so parallel scenarios
  cannot read each other's responses.

The guard in \`getLastResponse()\` turns a forgotten When step into a clear message instead of a NullPointerException, and
the body in every assertion message means the Cucumber report shows *what* the API returned, not just "expected 422".`,
  mistakes: [
    'Asserting the status inside the When step — the step can no longer be reused for negative scenarios.',
    'Then steps that call the API again — you assert a different response than the one the When step produced.',
    'Static Response/token fields — fine in a single thread, random failures in parallel runs.',
    'Hard-coding /api/users/1 instead of the logged-in user id from the context.',
  ],
  interview: [
    { q: 'Why should a When step not contain assertions?', a: 'When describes the action and Then the expected outcome. If the action asserts a status, the step only works for one outcome and the feature file lies about where the check happens. Keeping them apart lets one When step serve positive and negative scenarios.' },
    { q: 'How do Cucumber step classes share state, and what is its lifetime?', a: 'Through dependency injection, e.g. PicoContainer: any class requested in a step class constructor is created once per scenario and shared by all step classes in that scenario, then thrown away. That isolates scenarios, also in parallel runs.' },
    { q: 'What makes a good generic Then step for APIs?', a: 'It reads the stored response, checks one thing (status, a JSON path value, an error code), and includes the response body in the failure message. Parameters come from the feature file, so it needs no knowledge of the endpoint that was called.' },
  ],
}
