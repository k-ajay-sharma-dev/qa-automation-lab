export default {
  id: 'api-030',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Cucumber hooks for API suites: tagged reset, login order and failure evidence',
  level: 'ADVANCED',
  tags: ['cucumber', 'hooks', 'tags', 'evidence', 'filters', 'reporting'],
  estMinutes: 40,
  scenario: `The nightly Cucumber API run has two recurring problems. First, failures in the HTML report say only
"expected 201 but was 409" — no request, no response — so every failure means a local re-run. Second, 30 feature files
start with a copy-pasted "Given the test data is reset" step, and the scenarios where someone forgot it fail because a
previous scenario left items in the cart. When a developer moved the reset step *after* the login step, every scenario
got 401: the reset wipes all tokens. Your lead asks you to move this plumbing into **hooks**, driven by tags.`,
  description: `Three classes in one editor (\`cucumber-picocontainer\` is on the classpath; \`Specs.base()\` returns the base
request spec with base path \`/api\`):

1. \`RecordingFilter implements Filter\` — remembers the **last request** as text: method, URI, an Authorization line that
   is **masked** (\`Authorization: Bearer ***\` when the header is present) and the body. Then \`ctx.next(...)\`.
2. \`ScenarioContext\` — holds \`token\`, the last \`Response\` and **one \`RecordingFilter\` per scenario** (not static).
3. \`ApiHooks\` — receives \`ScenarioContext\` through its constructor and has:
   - \`@Before(value = "@fresh-data", order = 0)\` → \`POST /reset\`, 200.
   - \`@Before(value = "@logged-in", order = 1)\` → log in \`standard_user\` and store the token. The order numbers make the
     reset run **before** the login, because a reset invalidates tokens.
   - \`@After\` → if \`scenario.isFailed()\` and there is a response, \`scenario.attach(...)\` the recorded request and the
     response (status line + pretty body) as \`text/plain\`.

**Rules**
- No \`static\` token, Response or filter.
- Never attach the real token.`,
  starterCode: `// ---- ScenarioContext.java ---------------------------------------------
package com.shopeasy.api.context;

import io.restassured.response.Response;

public class ScenarioContext {
    private String token;
    private Response response;
    // getters/setters ...
}

// ---- ResetSteps.java (copy-pasted into every feature as the first Given) ----
package com.shopeasy.api.steps;

import com.shopeasy.api.specs.Specs;
import io.cucumber.java.en.Given;

import static io.restassured.RestAssured.given;

public class ResetSteps {
    @Given("the test data is reset")
    public void theTestDataIsReset() {
        given().spec(Specs.base()).when().post("/reset").then().statusCode(200);
    }
}

// ---- ApiHooks.java -----------------------------------------------------
package com.shopeasy.api.hooks;

public class ApiHooks {
    // TODO: tagged reset, tagged login (in the right order), evidence on failure
}
`,
  solution: `// ---- RecordingFilter.java ---------------------------------------------
package com.shopeasy.api.filters;

import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;

/** Remembers the last request as text for the report, with the token masked. */
public class RecordingFilter implements Filter {
    private String lastRequest = "(no request sent)";

    @Override
    public Response filter(FilterableRequestSpecification req,
                           FilterableResponseSpecification res,
                           FilterContext ctx) {
        String auth = req.getHeaders().hasHeaderWithName("Authorization")
            ? "Authorization: Bearer ***"
            : "(no Authorization header)";
        Object body = req.getBody();
        lastRequest = req.getMethod() + " " + req.getURI() + "\\n" + auth + "\\n\\n" + (body == null ? "" : body);
        return ctx.next(req, res);
    }

    public String lastRequest() { return lastRequest; }
}

// ---- ScenarioContext.java ---------------------------------------------
package com.shopeasy.api.context;

import com.shopeasy.api.filters.RecordingFilter;
import io.restassured.response.Response;

/** One instance per scenario (PicoContainer). Steps add context.recorder() to every request. */
public class ScenarioContext {
    private final RecordingFilter recorder = new RecordingFilter();
    private String token;
    private Response response;

    public RecordingFilter recorder() { return recorder; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public Response getResponse() { return response; }
    public void setResponse(Response response) { this.response = response; }
}

// ---- ApiHooks.java -----------------------------------------------------
package com.shopeasy.api.hooks;

import com.shopeasy.api.context.ScenarioContext;
import com.shopeasy.api.specs.Specs;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.restassured.response.Response;

import java.util.Map;

import static io.restassured.RestAssured.given;

public class ApiHooks {
    private final ScenarioContext context;

    public ApiHooks(ScenarioContext context) {
        this.context = context;
    }

    @Before(value = "@fresh-data", order = 0)
    public void resetData() {
        given().spec(Specs.base()).when().post("/reset").then().statusCode(200);
    }

    @Before(value = "@logged-in", order = 1)   // after the reset: a reset invalidates every token
    public void logIn() {
        String token = given().spec(Specs.base())
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
        .when()
            .post("/auth/login")
        .then()
            .statusCode(200)
            .extract().path("token");
        context.setToken(token);
    }

    @After
    public void attachEvidence(Scenario scenario) {
        Response response = context.getResponse();
        if (!scenario.isFailed() || response == null) {
            return;
        }
        scenario.attach(context.recorder().lastRequest(), "text/plain", "last request");
        scenario.attach(response.getStatusLine() + "\\n\\n" + response.asPrettyString(), "text/plain", "last response");
    }
}
`,
  checks: [
    { label: 'Recording filter implements Filter and calls next', pattern: 'implements\\s+Filter\\b[\\s\\S]*\\.next\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)', hint: 'public class RecordingFilter implements Filter { ... return ctx.next(req, res); }' },
    { label: 'Masks the token in the recorded request', pattern: 'Bearer \\*\\*\\*', hint: '"Authorization: Bearer ***"' },
    { label: 'Reset hook is tagged @fresh-data with order 0', pattern: '@Before\\((?=[^)]*"@fresh-data")(?=[^)]*order\\s*=\\s*0\\b)', hint: '@Before(value = "@fresh-data", order = 0)' },
    { label: 'Login hook is tagged @logged-in and runs after the reset', pattern: '@Before\\((?=[^)]*"@logged-in")(?=[^)]*order\\s*=\\s*[1-9])', hint: '@Before(value = "@logged-in", order = 1)' },
    { label: 'Hooks get the context through the constructor', pattern: 'public\\s+ApiHooks\\s*\\(\\s*ScenarioContext\\s+\\w+\\s*\\)', hint: 'public ApiHooks(ScenarioContext context) { this.context = context; }' },
    { label: 'Attaches evidence only for failed scenarios', pattern: 'isFailed\\(\\)[\\s\\S]*scenario\\.attach\\(', hint: 'if (scenario.isFailed()) scenario.attach(..., "text/plain", "last response");' },
    { label: 'No static shared state', pattern: 'static\\s+(Response|RecordingFilter|String\\s+token)\\b', mustNot: true, hint: 'Keep token, response and recorder in the per-scenario context.' },
  ],
  hints: [
    '@Before hooks run in ascending order (0 before 1); @After hooks run in descending order.',
    'A tag expression on a hook ("@fresh-data") makes it run only for scenarios or features with that tag.',
    'scenario.attach(text, "text/plain", "name") adds an attachment to the Cucumber report for that scenario.',
  ],
  explanation: `**Hooks** run around every scenario without appearing in the feature file, which is exactly where plumbing
belongs:

| Hook | Runs | Use |
|---|---|---|
| \`@Before(value = "@fresh-data", order = 0)\` | before scenarios tagged \`@fresh-data\`, first | reset data |
| \`@Before(value = "@logged-in", order = 1)\` | after the reset | log in, store token |
| \`@After\` | after every scenario (descending order) | evidence, clean-up |

**Order is a correctness issue here**, not style: the practice API's reset drops all tokens, so login must come after it.
\`@Before\` hooks with a lower order run first; \`@After\` hooks with a *higher* order run first, so evidence hooks usually
get a high order to run before clean-up hooks.

**Evidence**: the \`RecordingFilter\` sits on every request (steps call \`given().spec(Specs.base()).filter(context.recorder())\`)
and keeps the last request as text, with the token masked before it is stored. On failure the \`@After\` hook attaches
the request and the response, so the report answers "what was sent, what came back" without a re-run. Passing
scenarios attach nothing, so reports stay small.

The recorder lives in the **scenario context**, created fresh for every scenario by PicoContainer — a static recorder
would mix requests from parallel scenarios.`,
  mistakes: [
    'A reset hook that runs after the login hook — every scenario then fails with 401 because the token was wiped.',
    'Attaching evidence for every scenario — huge reports that nobody reads; attach on failure only.',
    'Writing the real token into the report — reports are shared widely; mask it before storing.',
    'Untagged @Before hooks that reset data for every scenario, including read-only ones that do not need it — slow suites.',
  ],
  interview: [
    { q: 'What are Cucumber hooks and which ones have you used?', a: '@Before and @After run around each scenario, @BeforeStep/@AfterStep around each step, and @BeforeAll/@AfterAll once per run. I use tagged @Before hooks for data setup and login, and @After hooks to attach the last request/response (or a screenshot for UI) when a scenario fails.' },
    { q: 'How do you control the order of hooks?', a: 'With the order attribute: @Before hooks run from low to high, @After hooks from high to low. Tag expressions on hooks control which scenarios they apply to, e.g. @Before("@fresh-data and not @read-only").' },
    { q: 'Hook or Background step — how do you decide?', a: 'If the business reader should see it ("Given I am logged in as a customer") it belongs in Background. Technical plumbing that is not part of the behaviour — data resets, evidence, cleanup — belongs in hooks, driven by tags.' },
  ],
}
