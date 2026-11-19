export default {
  id: 'pom-026',
  category: 'pom',
  kind: 'quiz',
  title: 'Architecture review: when POM stops scaling (Screenplay, parallel runs, shared state)',
  level: 'EXPERT',
  tags: ['pom', 'screenplay', 'architecture', 'parallel', 'cucumber'],
  estMinutes: 20,
  scenario: `Two years on, the ShopEasy suite has 1,400 tests, 85 page objects, a Cucumber layer for the BA-written
scenarios, and three squads contributing. An architect proposes "moving to Screenplay"; another engineer wants a
\`static\` \`CurrentPage\` holder so Cucumber steps can share pages. You are the QA lead in the architecture review and
must separate real problems from fashion.`,
  description: `Each question is a decision from the review. Pick the answer you would defend in front of the
architects — and in a senior SDET interview.`,
  questions: [
    {
      q: 'In one sentence, what is the main structural difference between POM and the Screenplay pattern?',
      options: [
        'Screenplay does not use locators',
        'POM organises code around **pages** (where things are); Screenplay organises it around **actors** performing **tasks** made of **interactions**, asking **questions** — user goals first, pages become just locator holders',
        'Screenplay is POM with Cucumber',
        'Screenplay is only for API testing',
      ],
      answer: 1,
      why: 'Screenplay (Serenity BDD and others) models *who* does *what*: `actor.attemptsTo(AddToCart.item("Pulse Bike Light"), Checkout.with(customer))` and `actor.asksFor(TheCartCount.value())`. Locators still exist, usually in small "UI target" classes. It splits behaviour into small composable classes instead of growing page classes.',
    },
    {
      q: 'Which symptom is the **strongest** signal that Screenplay (or a task layer on top of POM) would help?',
      options: [
        'Tests are slow',
        'The same multi-page business flows ("log in, add 2 items, check out") are re-implemented in many tests and step classes, and page objects have grown to 80+ methods mixing several user goals',
        'Locators break often after UI releases',
        'The team uses TestNG',
      ],
      answer: 1,
      why: 'Screenplay\'s value is composing reusable *tasks* across pages and keeping classes small (single responsibility). Locator churn is solved by POM itself; speed is a waits/infra/parallelism question. Many teams get 80% of the benefit by adding a thin task/flow layer (e.g. `PurchaseFlow.buy(items, customer)`) over existing page objects.',
    },
    {
      q: `A proposal for sharing pages between Cucumber step classes:

\`\`\`java
public class CurrentPage {
    public static BasePage page;
}
// InventorySteps: CurrentPage.page = loginPage.loginAs(...);
// CartSteps:      ((CartPage) CurrentPage.page).checkout();
\`\`\`
The suite runs scenarios in parallel. What is your verdict?`,
      options: [
        'Fine, static fields are fast',
        'Reject: static state is shared by every parallel scenario, and the casts move type errors to runtime. Share state through Cucumber dependency injection (e.g. PicoContainer) with a per-scenario context object that holds the driver and the current pages',
        'Make the field `volatile`',
        'Use `synchronized` on every step',
      ],
      answer: 1,
      why: 'Cucumber creates new step-class instances per scenario; DI (cucumber-picocontainer, Spring, Guice) injects a shared per-scenario `ScenarioContext`/`World` into all step classes, so state is isolated per scenario and thread. volatile/synchronized would serialise or still share one slot across scenarios.',
    },
    {
      q: 'Parallel runs: pages receive the driver via constructor and the driver comes from a `ThreadLocal` DriverManager (pom-011). Which page-object design choice still breaks under parallelism?',
      options: [
        'Private By fields',
        'Returning new page objects from navigation methods',
        'A `static` field inside a page object, e.g. `private static List<String> lastAddedItems` used to "remember" what was added',
        'Using WebDriverWait created in the BasePage constructor',
      ],
      answer: 2,
      why: 'ThreadLocal fixes only the driver. Any other static mutable state (caches, "last order number", counters) is shared by every thread and causes cross-test pollution. By fields are immutable, page instances are per test, and a per-instance WebDriverWait is safe.',
    },
    {
      q: 'The checkout UI test spends 40 seconds per run creating a user and filling the cart through the UI before it checks the one thing it is about: tax on the overview step. What do you recommend?',
      options: [
        'Keep it; end-to-end through the UI is the only real test',
        'Set up preconditions through the fastest reliable channel (API call, seeded session/cookie, test data service), then use page objects only for the behaviour under test; keep one or two full UI journeys as smoke',
        'Add more parallel threads',
        'Delete the test',
      ],
      answer: 1,
      why: 'This is the test-pyramid argument applied to POM. Page objects are for verifying UI behaviour; arranging state through the UI multiplies runtime and flakiness. ShopEasy\'s cart lives in sessionStorage and the API at port 5181 exists, so a precondition helper can seed it, and a couple of full journeys still prove the path end to end.',
    },
    {
      q: 'Final decision: what do you propose for the 1,400-test suite?',
      options: [
        'Big-bang rewrite to Screenplay this quarter',
        'Keep POM; split god pages into components, add a small task/flow layer for repeated journeys, ban static mutable state, move Cucumber state to DI, and pilot Screenplay on one new feature to measure the benefit before deciding further',
        'Freeze the framework and only add tests',
        'Move everything to Playwright first',
      ],
      answer: 1,
      why: 'Senior answers are incremental and evidence-driven: fix the concrete pains (god pages, duplicated flows, shared state) with known techniques, and pilot the new pattern where it can be measured. Rewrites and tool switches without evidence burn months and break trust in the suite.',
    },
  ],
  hints: [
    'POM answers "where is it on the page"; Screenplay answers "what is the user trying to do".',
    'ThreadLocal protects the driver only; every other static field is still shared.',
  ],
  explanation: `**POM vs Screenplay in one table**

| | Page Object Model | Screenplay |
|---|---|---|
| Unit of design | a page / component | actor → task → interaction, question |
| Reuse | page methods | small composable task classes |
| Risk at scale | god pages, duplicated multi-page flows | many tiny classes, steeper learning curve |
| Good fit | most UI suites, teams new to automation | large suites with many cross-page user goals, BDD-heavy teams |

You do not have to choose all-or-nothing: a **flow/task layer** over page objects
(\`new PurchaseFlow(driver).buy(List.of("Pulse Bike Light"), CheckoutData.valid())\`) gives most of Screenplay's
readability while keeping the pages your team knows.

Scaling rules that matter more than the pattern name:
- **No static mutable state** anywhere in pages or steps; driver per thread, everything else per test/scenario.
- **Cucumber shares state through DI** (PicoContainer \`World\`/\`ScenarioContext\`), never statics.
- **Arrange through APIs, assert through the UI** — page objects for the behaviour under test only.
- **Change incrementally** and measure: pilot, compare flakiness and authoring time, then decide.`,
  mistakes: [
    'Adopting Screenplay because it is fashionable, without a concrete problem it solves.',
    'Using static holders to pass pages between Cucumber step classes.',
    'Believing ThreadLocal<WebDriver> alone makes the framework thread-safe.',
    'Building every precondition through the UI and blaming POM for slow, flaky suites.',
  ],
  interview: [
    { q: 'What is the Screenplay pattern and how does it differ from POM?', a: 'Screenplay models actors who have abilities (browse the web, call an API), perform tasks composed of interactions, and ask questions about the system. POM models pages and their operations. Screenplay favours small composable classes and user goals; POM is simpler and page-centred. Both still keep locators out of tests.' },
    { q: 'How do you share state between Cucumber step definition classes?', a: 'With dependency injection: cucumber-picocontainer (or Spring/Guice) creates a per-scenario context object and injects it into every step class constructor. It holds the driver accessor, current page objects and scenario data. Never static fields, which break parallel scenarios.' },
    { q: 'Your UI suite is slow. What do you look at first?', a: 'How preconditions are created (move setup to APIs or seeded data), sleeps and inefficient waits, test independence for parallel runs, and whether some checks belong at the API or unit level. Pattern changes like Screenplay rarely fix speed on their own.' },
    { q: 'When would you not recommend Screenplay?', a: 'For small or mid-size suites, or teams new to automation, where POM with components and a BasePage is easier to learn and already solves maintenance. The extra abstraction pays off mainly with many cross-page business flows and several teams contributing.' },
  ],
}
