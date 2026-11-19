export default {
  id: 'api-019',
  category: 'restassured',
  kind: 'quiz',
  title: 'API framework design review',
  level: 'EXPERT',
  tags: ['framework-design', 'architecture', 'specs', 'reporting', 'ci'],
  estMinutes: 15,
  scenario: `You are now the API automation lead for ShopEasy. Three squads (mobile, web, partner integrations) will add tests
to one RestAssured + Cucumber framework, running on every pull request and nightly against staging. Before anyone
writes a test, the architect reviews your framework design with these questions — the same ones you will hear in a
senior SDET interview when they say "walk me through your API framework".`,
  description: `Choose the best design decision for each situation. Compare your answers with the RestAssured blueprint on
the Framework page.`,
  questions: [
    {
      q: 'Where should the base URI, base path, content type, auth header and "log if validation fails" live?',
      options: [
        'Copied into every test so each test is self-contained',
        'In one request specification built by a factory (RequestSpecBuilder) from config, reused by every client',
        'In static RestAssured.baseURI fields changed per test',
        'In the feature files',
      ],
      answer: 1,
      why: 'A **SpecFactory/BaseSpec** builds specs once from config: one change moves the suite to staging. Copies drift, static global fields break parallel runs (one test changes them for all), and feature files should stay business-readable.',
    },
    {
      q: 'Tests are full of `"/api/orders/{id}"` strings and `given()...post()` chains. What layer fixes this?',
      options: [
        'A utility class with one giant static method `call(method, url, body)`',
        'Endpoint constants plus client classes per resource (`orderClient.place(request)`, `orderClient.byId(id)`) returning Response or POJOs',
        'Recording requests with a proxy and replaying them',
        'Nothing — duplication in tests is fine',
      ],
      answer: 1,
      why: '**Clients** are the API equivalent of page objects: tests and step definitions say *what* (create an order), clients know *how* (path, method, spec). A generic `call(...)` helper hides nothing and loses typing; replaying traffic is not a test design.',
    },
    {
      q: 'How should the framework get tokens for three test users across 800 tests?',
      options: [
        'Hard-code tokens in qa.properties',
        'Log in before every request',
        'An AuthClient that logs in through the API and caches one token per user (thread-safe), refreshing on expiry or after a data reset',
        'Disable auth on the test environment',
      ],
      answer: 2,
      why: 'A **caching AuthClient** is fast and realistic. Hard-coded tokens expire and leak, logging in per request is slow and may hit rate limits, and disabling auth means you never test it — the security bug from production would slip through.',
    },
    {
      q: 'Scenarios run in parallel on CI. Which data strategy keeps them independent?',
      options: [
        'All scenarios share standard_user and its single cart',
        'Each scenario creates the data it needs (or uses its own user), extracts generated ids, and never relies on another scenario\'s data or execution order',
        'Run a full database reset between every request',
        'Order scenarios alphabetically so dependencies run first',
      ],
      answer: 1,
      why: '**Independent data** is the precondition for parallelism: create-what-you-need, extract ids, clean up or use isolated users. A shared cart makes scenarios fight; global resets mid-run wipe other threads\' data; ordering dependencies is fragile and breaks with tags.',
    },
    {
      q: 'A nightly run fails with "expected 201 but was 500". What should the framework already have captured so you can raise the defect without re-running?',
      options: [
        'Nothing — re-run locally with debugging',
        'A screenshot',
        'The full request and response (method, URL, headers with masked token, body, status, X-Request-Id) attached to the Cucumber/Allure report for failing scenarios',
        'Only the stack trace',
      ],
      answer: 2,
      why: 'API failures need **request/response evidence**: a RestAssured filter or `log().ifValidationFails()` plus an @After hook attaching the last response to the report. The correlation id lets developers find the server log. Mask secrets before attaching.',
    },
    {
      q: 'Which split of checks between suites is the most sensible?',
      options: [
        'Run every test (contract, negative, e2e) on every commit and nightly the same',
        'Smoke + contract (schema) checks on every PR; full functional, negative and data-driven regression nightly; tag-based selection via Cucumber tags/TestNG groups',
        'Only run API tests before a release',
        'Run only the e2e flow because it covers everything',
      ],
      answer: 1,
      why: 'Fast, high-signal checks (health, smoke, schema) gate PRs within minutes; the broad regression runs nightly. **Tags** (`@smoke`, `@contract`, `@negative`) make the selection explicit. One giant e2e test fails late and points nowhere.',
    },
  ],
  hints: ['Think in layers: config → specs → auth → clients → models → steps/tests → reporting/CI.'],
  explanation: `A maintainable API framework is layered like a UI framework, with clients in place of page objects:

| Layer | Responsibility | ShopEasy example |
|---|---|---|
| Config | environments, users, timeouts | \`qa.properties\`, \`-Denv=staging\` |
| Specs | base URI, headers, logging, number parsing | \`SpecFactory.base()\` |
| Auth | login, token cache | \`AuthClient.tokenFor(user, password)\` |
| Endpoints + clients | paths and calls per resource | \`Endpoints.ORDERS\`, \`orderClient.place(request)\` |
| Models | request/response POJOs, schemas | \`OrderRequest\`, \`product-schema.json\` |
| Tests / steps | behaviour and assertions | \`OrderSteps\` + \`ScenarioContext\` |
| Reporting / CI | evidence, tags, parallelism | Cucumber HTML/JSON, Allure, Jenkins |

Each layer changes for one reason: a new environment touches config, a renamed path touches one client, a new field
touches one POJO — tests rarely change unless behaviour does.`,
  mistakes: [
    'Static global RestAssured settings changed inside tests — parallel runs become non-deterministic.',
    'Assertions hidden inside client classes — clients should return responses; tests decide what is expected.',
    'No request/response evidence in reports — every failure needs a local re-run to diagnose.',
    'Tests that depend on data created by another test.',
  ],
  interview: [
    { q: 'Walk me through your API automation framework.', a: 'Maven project with RestAssured, Cucumber and TestNG. Config per environment, a spec factory for base URI/headers/logging, an AuthClient caching tokens, client classes per resource with endpoint constants, Jackson POJOs and JSON schemas, Cucumber features with a PicoContainer scenario context, hooks for data reset and attaching responses, a TestNG runner with parallel scenarios, tags for smoke/contract/regression, and Jenkins publishing Cucumber/Allure reports.' },
    { q: 'Should client classes assert?', a: 'Generally no — they return the Response (or a POJO for convenience methods that require success). The test decides what is expected; otherwise negative tests have to fight the client\'s built-in "must be 200" checks.' },
  ],
}
