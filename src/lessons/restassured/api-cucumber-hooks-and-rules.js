export default {
  slug: 'api-cucumber-hooks-and-rules',
  category: 'restassured',
  order: 10,
  title: 'Cucumber hooks, tags and Rule blocks for API suites',
  minutes: 9,
  summary: 'Move technical setup and failure evidence out of feature files into tagged, ordered hooks, and group API scenarios under the business rules they prove with the Rule keyword.',
  manualAnalogy: `In a manual test cycle, some things happen around every test without being written in each test case: the environment is refreshed before the run, you log in with the right account, and when a test fails you save the request and response for the defect. Business rules, on the other hand, are written at the top of your test plan with the cases that prove them listed underneath. Hooks are the first idea in Cucumber; \`Rule:\` is the second.`,
  body: `## Hooks: code that runs around scenarios

A hook is a method in a glue class (any class in the glue package) that Cucumber runs **around** scenarios. It never appears in the feature file.

| Annotation | Runs |
|---|---|
| \`@Before\` / \`@After\` | before / after **each scenario** |
| \`@BeforeStep\` / \`@AfterStep\` | around each step |
| \`@BeforeAll\` / \`@AfterAll\` | once per run (static methods) |

Hooks get the same \`ScenarioContext\` as your steps through the constructor (PicoContainer — see the *Cucumber for APIs* lesson), and an \`@After\` hook can take a \`Scenario\` parameter to see the result.

## Tags decide where a hook applies

\`\`\`java
@Before("@new-customer")
public void registerCustomer() {
    String username = "it_" + UUID.randomUUID().toString().substring(0, 8);
    // POST /api/users ... then log in and store the token in the context
}
\`\`\`

Only scenarios (or features) tagged \`@new-customer\` get this hook. Tag expressions work too: \`@Before("@api and not @read-only")\`. This replaces copy-pasted "Given the test data is prepared" steps that someone eventually forgets.

## Order matters

When several \`@Before\` hooks apply, the \`order\` attribute decides: **lower runs first**. \`@After\` hooks run the other way round: **higher runs first**.

\`\`\`java
@Before(value = "@clean-orders", order = 0)   // 1st: prepare data
public void cleanOrders() { ... }

@Before(value = "@new-customer", order = 5)   // 2nd: create the user that uses it
public void registerCustomer() { ... }
\`\`\`

On ShopEasy the order is not cosmetic: \`POST /api/reset\` deletes every token and registered user, so anything that resets data must run before anything that logs in. Get it wrong and every scenario fails with 401.

## Evidence on failure

A failed API scenario should explain itself in the report. In an \`@After\` hook:

\`\`\`java
@After(order = 100)                 // high order: runs before clean-up hooks
public void attachEvidence(Scenario scenario) {
    if (scenario.isFailed() && context.getResponse() != null) {
        scenario.attach(context.getResponse().asPrettyString(), "application/json", "last response");
    }
}
\`\`\`

\`scenario.attach(data, mediaType, name)\` adds an attachment to the Cucumber HTML/JSON report (and Allure). To also show the *request*, record it with a filter (see the *framework design* lesson) that stores method, URI and body in the context — and replace the token with \`***\` before storing it, because reports are shared widely.

## Rule: grouping scenarios by business rule

Gherkin's \`Rule:\` keyword (supported since Cucumber 6) sits between \`Feature:\` and the scenarios:

\`\`\`gherkin
Feature: Customer registration

  Rule: Usernames are unique

    Scenario: Registering a username that already exists is refused
      Given a customer "maya_k" is already registered
      When someone registers the username "maya_k"
      Then the registration is refused with reason "USERNAME_TAKEN"

  Rule: Passwords have at least 8 characters

    Scenario Outline: A password of <length> characters is <result>
      When I register with a password of <length> characters
      Then the registration is <result>

      Examples:
        | length | result   |
        | 7      | refused  |
        | 8      | accepted |
\`\`\`

- The **rule** is the business statement; the scenarios are the **examples** that prove it. This is the shape of an Example Mapping session written down.
- A failing scenario now says which rule is broken, and a rule with no scenarios is an obvious gap.
- A \`Rule:\` can have its own \`Background:\`, which runs after the feature's Background for that rule's scenarios only.
- The steps stay declarative: "register", "replace my profile", "change my phone number" — the step definitions choose POST, PUT or PATCH.

## Hook or Background?

If a business reader should see it ("Given I am logged in as a customer"), it belongs in a \`Background:\`. Plumbing that is not part of the behaviour — data resets, test users, evidence, clean-up — belongs in tagged hooks.`,
  keyPoints: [
    '@Before/@After hooks run around every scenario; a tag expression limits them to tagged scenarios.',
    '@Before hooks run from low to high order, @After hooks from high to low — order resets before logins.',
    'Attach the last request and response in an @After hook only when scenario.isFailed(), with tokens masked.',
    'Rule: groups scenarios under the business rule they illustrate and may have its own Background.',
    'Business-visible preconditions go in Background; technical plumbing goes in hooks.',
  ],
  mistakes: [
    'A reset hook that runs after the login hook — the token is wiped and every scenario gets 401.',
    'Untagged data-reset hooks that slow down every scenario, including read-only ones.',
    'Attaching evidence for passing scenarios or printing real tokens into the report.',
    'Rule titles that are labels ("Rule: email tests") instead of rules ("Rule: invalid emails are refused").',
  ],
  tryIt: `Take the scenarios of an existing API feature in this section (for example the basket rules) and write down, for each one, the business rule it proves. Group them under \`Rule:\` headings on paper. Then list every step that is really plumbing (resets, test users) and decide which tag and hook order would replace it.`,
  problems: ['api-030', 'api-031'],
}
