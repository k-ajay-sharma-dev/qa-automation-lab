export default {
  slug: 'pom-scaling-screenplay-and-shared-state',
  category: 'pom',
  order: 10,
  title: 'Scaling page objects: task layers, Screenplay and shared state',
  minutes: 8,
  summary: 'Recognise when a large POM suite needs more structure, explain the Screenplay pattern, and keep state safe in parallel and Cucumber runs.',
  manualAnalogy: `A small manual regression pack can be a list of screens and steps. When it grows to hundreds of cases owned by several teams, you start writing reusable "procedures" ("Place a standard order", "Create a customer") that cases refer to, and you make sure two testers never share one test account at the same time. Large automation suites need the same two things: reusable business-level tasks, and no shared state between tests running side by side.`,
  body: `## Where POM starts to hurt

Page objects solve *locator duplication*. At a few hundred tests, different pains appear:

- **Duplicated journeys**: "log in, add two items, check out" is re-implemented in 60 tests and 12 step classes.
- **God pages**: \`InventoryPage\` has 80 methods because every squad adds "just one more".
- **Hidden shared state**: a \`static\` field somewhere makes parallel runs flaky.
- **Slow setup**: every test builds its preconditions through the UI.

None of these mean "POM is wrong". Each has a targeted fix.

## Fix 1: a thin task (flow) layer

Keep the page objects, and add classes for **business tasks** that span several pages:

\`\`\`java
public class OrderFlow {
    private final WebDriver driver;
    public OrderFlow(WebDriver driver) { this.driver = driver; }

    public CheckoutOverviewPage reachOverview(List<String> products, CheckoutData customer) {
        InventoryPage inventory = new LoginPage(driver).open().loginAs("standard_user", "secret_sauce");
        products.forEach(inventory::addToCart);
        return inventory.header().openCart().checkout().fillWith(customer).continueToOverview();
    }
}
\`\`\`

Tests about *tax* or *totals* call one line and then focus on what they verify. Pages stay small; the flow is
written once.

## Fix 2 (bigger step): the Screenplay pattern

Screenplay re-organises the code around **who** does **what**:

| Concept | Meaning | Example |
|---|---|---|
| Actor | a user with abilities | \`Asha\`, who can *browse the web* and *call the API* |
| Task | a business goal made of steps | \`AddToCart.item("Pulse Bike Light")\` |
| Interaction | one low-level action | \`Click.on(CART_LINK)\`, \`Enter.theValue(...)\` |
| Question | something the actor checks | \`TheCartBadge.count()\` |

\`\`\`java
asha.attemptsTo(Login.asStandardUser(), AddToCart.item("Pulse Bike Light"));
asha.should(seeThat(TheCartBadge.count(), equalTo(1)));
\`\`\`

Locators still exist, usually as constants in small "UI target" classes. Benefits: tiny single-purpose classes,
excellent reuse of tasks, readable BDD-style tests (Serenity BDD is the best-known implementation). Costs: more
classes, more concepts, a learning curve for the team. A sensible path is to pilot it on one new feature and compare
before converting anything.

## Fix 3: no shared mutable state

\`ThreadLocal<WebDriver>\` (see the *DriverManager, ThreadLocal and BaseTest* lesson) protects the **driver only**.
Every other \`static\` field that changes — "last order number", a cached product list, a "current page" holder — is
shared by every parallel test.

In Cucumber, step definitions live in several classes. Share data between them with **dependency injection**:
add \`cucumber-picocontainer\`, create a plain \`ScenarioContext\` class, and ask for it in each step class
constructor. Cucumber creates one context per scenario and injects the same instance into all step classes of that
scenario — isolated from other scenarios, even in parallel.

\`\`\`java
public class CartSteps {
    private final ScenarioContext ctx;
    public CartSteps(ScenarioContext ctx) { this.ctx = ctx; }   // injected by PicoContainer
}
\`\`\`

## Fix 4: arrange through the API, assert through the UI

If a test is about the overview's tax line, it does not need to prove login and add-to-cart again. Create
preconditions through the fastest reliable channel (the ShopEasy API on port 5181, seeded data, a session value)
and use page objects only for the behaviour under test. Keep a few full UI journeys as smoke tests.`,
  keyPoints: [
    'POM fixes locator duplication; at scale, duplicated journeys and god pages need other tools.',
    'A thin task/flow layer over page objects gives reuse of multi-page journeys without a rewrite.',
    'Screenplay models actors, tasks, interactions and questions; it suits large, multi-team, BDD-heavy suites.',
    'ThreadLocal protects only the driver — ban static mutable state everywhere else.',
    'Cucumber step classes share state through DI (PicoContainer), never static holders.',
  ],
  mistakes: [
    'Rewriting a working suite into a new pattern without measuring a concrete problem first.',
    'Passing pages between Cucumber step classes through static fields — breaks parallel scenarios; use an injected context.',
    'Building every precondition through the UI and then blaming the pattern for slow tests.',
  ],
  tryIt: `Pick any three tests you have written in this track. Write down the business task each one performs before its real check ("get to the cart with one item", "reach the overview step"). If two tests share a task, sketch the one-method flow class that would replace both setups.`,
  problems: ['pom-026', 'pom-014'],
}
