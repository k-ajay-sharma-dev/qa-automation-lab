export default {
  slug: 'picocontainer-shared-state',
  category: 'cucumber',
  order: 8,
  title: 'Sharing state between step classes with PicoContainer',
  minutes: 9,
  summary: 'Share the WebDriver and scenario data across step classes safely with a TestContext injected through constructors.',
  manualAnalogy: `During a manual test you jot down values as you go - "order number SE-123456", "logged in as standard_user" -
and use them in later steps. In automation different Java classes run different steps, so they need a shared
notebook. The notebook must be fresh for every test, and each tester (thread) needs their own.`,
  body: `## The problem

Real projects split steps by area: \`LoginSteps\`, \`InventorySteps\`, \`CheckoutSteps\`. A scenario often uses
several of them. Two things must be shared:

1. **The browser** (\`WebDriver\`) - all classes must drive the *same* window.
2. **Data** - e.g. the login step remembers the user name, and a later step on another page checks it is displayed.

The beginner fixes both cause trouble:

- \`static WebDriver driver\` - one variable for the whole JVM. Fine with one thread; with parallel scenarios, two
  scenarios overwrite each other's browser and fail randomly.
- \`new TestContext()\` in each step class - every class gets its *own* object, so nothing is actually shared.

## Dependency injection in one paragraph

**Dependency injection** means a class does not create the objects it needs; it *declares* them in its
constructor, and a framework creates and hands them over. Cucumber supports this through small add-on libraries.
The simplest is **PicoContainer**: add the \`cucumber-picocontainer\` Maven dependency (same version as your other
Cucumber jars) and you are done - no annotations, no configuration.

For **each scenario**, PicoContainer:

1. sees that a step class needs a \`TestContext\` in its constructor,
2. creates **one** \`TestContext\` for that scenario,
3. passes that **same** instance to every step and hook class that asks for it,
4. throws it all away when the scenario ends.

So the context is shared *within* a scenario and fresh *between* scenarios - exactly the notebook you want. Parallel
scenarios each get their own.

## The context class

\`\`\`java
package com.shopeasy.support;

public class TestContext {
    private WebDriver driver;
    private String loggedInUser;          // typed field for data steps share

    public WebDriver getDriver()               { return driver; }
    public void setDriver(WebDriver driver)    { this.driver = driver; }
    public String getLoggedInUser()            { return loggedInUser; }
    public void setLoggedInUser(String user)   { this.loggedInUser = user; }
}
\`\`\`

- A plain class with **no static fields**. PicoContainer needs a public no-argument constructor here (Java provides
  one automatically when you write none).
- Typed fields (\`loggedInUser\`) are clearer than a \`Map<String, Object>\` "bag", but a map is also common for
  ad-hoc values.

## Injecting it

\`\`\`java
public class LoginSteps {
    private final TestContext context;

    public LoginSteps(TestContext context) {    // PicoContainer calls this
        this.context = context;
    }

    @Given("the shopper is logged in as {string}")
    public void loggedInAs(String user) {
        new LoginPage(context.getDriver()).loginAs(user, "secret_sauce");
        context.setLoggedInUser(user);          // write to the notebook
    }
}

public class InventorySteps {
    private final TestContext context;

    public InventorySteps(TestContext context) { this.context = context; }

    @Then("the header greets the logged-in shopper")
    public void headerGreets() {
        String shown = new InventoryPage(context.getDriver()).loggedInUserText();  // #logged-in-user
        Assert.assertTrue(shown.contains(context.getLoggedInUser()));             // read from the notebook
    }
}
\`\`\`

- \`private final TestContext context\` - the step class keeps the reference it was given.
- Page objects are built from \`context.getDriver()\`, so every page uses the scenario's browser.
- One step **writes** to the context, a step in **another class** reads it. That is the whole trick.

## Hooks use it too

The \`Hooks\` class also takes \`TestContext\` in its constructor. \`@Before\` creates the driver and calls
\`context.setDriver(...)\`; \`@After\` quits \`context.getDriver()\`. Because it is the same instance, the steps see
the driver the hook created (see the *Hooks* lesson).

## Several small world objects

One big \`TestContext\` with twenty fields becomes a junk drawer. Larger suites split scenario state into small, typed
"world" objects and inject only what each class needs - PicoContainer happily passes several:

\`\`\`java
public class ProfileSteps {
    public ProfileSteps(TestContext context, UserState user) { ... }
}
\`\`\`

Typical examples: \`UserState\` (who is logged in), an \`ApiContext\` (auth token and last HTTP response for API
steps), a cart or order state. Each one is created once per scenario and shared by every class that asks for it.

## Going further

- Large projects inject several objects (a \`TestContext\` plus a \`PageObjectManager\` that creates pages lazily).
  PicoContainer can inject any class with a suitable constructor, even chains of them.
- Some teams keep the driver in a \`ThreadLocal\` driver factory instead. That also works in parallel; the context
  approach simply makes the dependency visible in each constructor.
- Spring or Guice can replace PicoContainer, but they need more setup. Choose PicoContainer unless your company
  already uses Spring.`,
  keyPoints: [
    'Step classes receive a shared TestContext through their constructor - never new it and never make it static.',
    'cucumber-picocontainer creates one context per scenario and hands the same instance to every step and hook class.',
    'Fresh per scenario and separate per parallel thread, so no state leaks between tests.',
    'Page objects are created from context.getDriver(); data is written by one step and read by another.',
    'Hooks inject the same context to create and quit the driver.',
  ],
  mistakes: [
    'static WebDriver in a base class. Fix: keep the driver in the injected context (or a ThreadLocal factory).',
    'Calling new TestContext() inside a step class. Fix: take it as a constructor parameter so PicoContainer shares it.',
    'Missing or mismatched cucumber-picocontainer version. Fix: add it with the same version as cucumber-java.',
    'Expecting data to survive into the next scenario. Fix: each scenario sets up its own data; the context is reset on purpose.',
  ],
  tryIt: `Log in on http://localhost:5180/practice-site/login.html and look at the #logged-in-user text on the inventory
page. Which step would store the value, and which step in which class would read it?`,
  problems: ['cuc-012', 'cuc-017', 'cuc-023', 'cuc-029'],
}
