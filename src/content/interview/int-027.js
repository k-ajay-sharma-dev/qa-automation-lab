export default {
  id: 'int-027',
  category: 'interview',
  kind: 'quiz',
  title: 'Design a test automation strategy for ShopEasy: layers, suites and CI gates',
  level: 'EXPERT',
  tags: ['test-strategy', 'test-pyramid', 'ci-cd', 'quality-gates', 'smoke', 'regression', 'test-data'],
  estMinutes: 25,
  scenario: `Lead / senior SDET rounds end with a whiteboard question: *"Here is our product — a web shop and its REST API. Design the automation strategy. What do you test at which level, what runs when, and what blocks a release?"* For ShopEasy you know the pieces: the web shop (\`login.html\`, \`inventory.html\` with client-side sorting, \`cart.html\`, a three-step \`checkout.html\` with its own client-side validation and 8% tax) and the API on port 5181 (auth with Bearer tokens, products, cart, orders, users, \`POST /api/reset\`). Every question below is one decision in that design.`,
  description: `Choose the best design decision for each question. Afterwards, practise drawing the whole strategy in five minutes: **layers → suites → pipeline gates → data → metrics**.`,
  hints: [
    'Push every check to the lowest level that can catch the bug — but notice when the UI has its own logic.',
    'A gate must be fast and trustworthy; anything flaky or slow must not block merges.',
  ],
  questions: [
    {
      q: 'On ShopEasy, sorting appears twice: the inventory page sorts the six cards **in browser JavaScript** (`#product-sort`, values az/za/lohi/hilo), and the API sorts with `GET /api/products?sort=price_asc`. How do you cover sorting?',
      options: [
        'Only API tests — the UI just displays API data',
        'Only UI tests — users see the UI',
        'API tests for the API sort rules (all four sort keys, aliases, invalid values → 400 INVALID_QUERY, paging) AND a small number of UI tests for the inventory dropdown, because the web page has its own separate sorting code that the API tests never execute',
        'Neither — sorting is low risk',
      ],
      answer: 2,
      why: 'The pyramid says "push down", but only to a level that **executes the code under risk**. ShopEasy\'s page sorts in client-side JavaScript, so API tests cannot catch a bug there. Spotting two independent implementations of one rule is exactly the analysis a lead is hired for.',
    },
    {
      q: 'Checkout validation also exists twice: client-side in `checkout.html` (First Name / Last Name / Postal Code required, postal code 3–10 characters) and server-side in `POST /api/orders` (400 VALIDATION_FAILED with details). Which split is best?',
      options: [
        'Ten UI tests for every validation combination and no API tests',
        'The full data-driven matrix at API level (missing fields, boundaries 2/3/10/11 characters, invalid characters) — fast and precise — plus a short UI Scenario Outline proving each error banner message appears ("Error: Postal Code is required", "Error: Postal Code is invalid")',
        'Only manual testing',
        'Only one API test with all fields empty',
      ],
      answer: 1,
      why: 'Both implementations need coverage, but at different depth: the **rule matrix** belongs where it is cheapest (API, milliseconds per case), the **UI layer** proves the messages are shown and the form blocks progress. Also worth saying: the server-side check is the security boundary — client-side validation can be bypassed.',
    },
    {
      q: 'Which suite and **CI gate** design fits ShopEasy best?',
      options: [
        'Run all UI tests on every commit and block merges on any failure',
        'On every pull request: unit + API contract/regression tests (minutes, blocking). After every deploy to QA: a ~10-minute smoke of critical journeys — API health, login, add to cart, checkout complete — UI + API, blocking promotion. Nightly: full UI + API regression, cross-browser, results triaged next morning and blocking the release, not individual merges. Quarantined flaky tests run in a separate non-blocking job',
        'Run everything once before the release',
        'No gates — testers decide manually',
      ],
      answer: 1,
      why: 'Gates must be **fast enough to wait for and reliable enough to trust**. Fast, deterministic tests block merges; the smoke protects each environment; the slow full regression protects the release. Flaky tests in a blocking gate teach the team to ignore red builds — quarantine them with an owner.',
    },
    {
      q: 'The ShopEasy API has `POST /api/reset`, which restores the seed data for **everyone**. Your suite runs in parallel on a QA environment shared with three other teams. What is the right test-data strategy?',
      options: [
        'Call POST /api/reset before every test',
        'Never call reset in the shared environment; each test creates what it needs — a unique user via POST /api/users (e.g. "qa_" + UUID) that logs in with its own token, its own cart and orders — and cleans up through the API (DELETE /api/cart). Reset is only used in isolated, per-pipeline environments (e.g. a container started for the build)',
        'All tests share standard_user to keep things simple',
        'Use production data',
      ],
      answer: 1,
      why: 'Reset is a sledgehammer: it wipes other teams\' (and your own parallel threads\') data mid-run — a perfect generator of "flaky" failures. **Data owned per test** makes parallel runs safe. An ephemeral environment per pipeline, where reset is fine, is the ideal end state to propose.',
    },
    {
      q: 'Which statement about the **UI end-to-end layer** for ShopEasy is the strongest?',
      options: [
        'Every manual test case becomes one Selenium test',
        'Keep a small set of user journeys — e.g. login → add two items → checkout → order confirmation with an SE- order number; locked-out user sees the error; sort dropdown; empty cart blocks checkout — use API calls or session setup for preconditions, stable data-testid locators, and treat each UI test as expensive to own',
        'UI tests should verify tax calculations for all products',
        'UI tests are unnecessary when API tests exist',
      ],
      answer: 1,
      why: 'The UI layer proves **integration and real user paths**, not every rule. Setting preconditions via API keeps journeys short and stable; data-testid attributes (ShopEasy has them on most elements) decouple tests from styling. Saying "each UI test has an ownership cost" is the senior mindset.',
    },
    {
      q: 'Six months after rollout, how do you prove the strategy works and steer it?',
      options: [
        'Count the automated tests every month',
        'Track feedback time per gate (PR < 10 min, smoke < 15 min), flaky rate per suite with a target (e.g. < 2%), defects caught per layer vs escaped to production, critical-journey coverage, and maintenance effort — and review them each quarter to move tests between layers or delete low-value ones',
        'Ask developers if they like the tests',
        'Measure only code coverage of the API',
      ],
      answer: 1,
      why: 'A strategy is a **feedback loop**, not a document. Escaped defects show gaps; flaky rate shows trust; feedback time shows whether gates help or hurt delivery; maintenance effort shows cost. Deleting tests that never find anything and cost time is a mature, rarely heard answer.',
    },
  ],
  explanation: `**Whiteboard answer — ShopEasy automation strategy (5 minutes)**

| Layer | What | Examples |
|---|---|---|
| Unit (devs) | pure logic | tax rounding, price formatting, validators |
| API (RestAssured) | business rules, contract, security | auth 200/401/403, products sort/paging/400, cart 201/409/422, orders totals and validation, PUT vs PATCH, JSON schema |
| UI (Selenium/Playwright) | critical journeys and UI-only logic | login + lockout, add items + badge, checkout to SE- order number, client-side sort, checkout error banners |
| Manual / exploratory | judgement | usability, new features, visual checks, risky edge cases |

**Suites and gates**
- **PR**: unit + API (blocking, < 10 min).
- **Deploy to QA**: smoke UI + API, ~10 min (blocks promotion).
- **Nightly**: full regression, cross-browser, parallel (blocks the release; triaged every morning).
- **Quarantine**: known-flaky tests, non-blocking, each with an owner and a ticket.

**Data**: tests create their own users/carts/orders via API with unique names; reset only in ephemeral environments; secrets from CI credentials.

**Reporting & metrics**: feedback time, flaky rate, escaped defects, critical-journey coverage, maintenance effort — reviewed quarterly.

> Closing line for the interview: "The goal isn't the most tests, it's the fastest trustworthy answer to 'can we release?'."`,
  mistakes: [
    'Designing a UI-heavy strategy where every rule is tested through the browser.',
    'Assuming API tests cover UI logic that is implemented separately in client-side code.',
    'Putting slow or flaky suites into blocking merge gates.',
    'Using shared accounts or global resets in a shared, parallel environment.',
  ],
  interview: [
    { q: 'How would you design a test automation strategy for a new product?', a: 'Start from the risks and the architecture: which logic lives where. Then decide layers — unit for pure logic, API for business rules, contract and security, a thin UI layer for critical journeys and UI-only logic, manual exploratory for judgement. Define suites and CI gates by speed and reliability (PR, post-deploy smoke, nightly regression), a test-data approach where tests own their data, reporting, and metrics like feedback time, flaky rate and escaped defects that we review regularly.' },
    { q: 'What makes a good quality gate?', a: 'It is fast enough that people wait for it, deterministic enough that a red result is trusted, and focused on the risks that should really stop a change. Flaky or slow checks belong in non-blocking or scheduled jobs until they are fixed.' },
    { q: 'How do you handle test data in a shared environment?', a: 'Each test creates and owns its data through APIs with unique identifiers, cleans up after itself where possible, and never relies on global resets or shared accounts. For full isolation we push for ephemeral environments per pipeline, where seeding and resetting are safe.' },
  ],
}
