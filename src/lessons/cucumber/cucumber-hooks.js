export default {
  slug: 'cucumber-hooks',
  category: 'cucumber',
  order: 7,
  title: 'Hooks: setup, teardown and screenshots on failure',
  minutes: 9,
  summary: 'Use Cucumber @Before/@After hooks to open and close the browser for every scenario and attach evidence when a scenario fails.',
  manualAnalogy: `Before each manual test you open a fresh browser and clear the session; after it you close everything and, if
the test failed, you attach a screenshot to the defect. Hooks are those "before every test / after every test"
chores, written once so no scenario has to repeat them.`,
  body: `## What a hook is

A **hook** is a method Cucumber runs automatically around every scenario (or every step). Hooks are not called from
Gherkin - you never write "Given the browser is opened". They live in a class in a **glue** package, for example
\`com.shopeasy.hooks.Hooks\`.

| Annotation (from \`io.cucumber.java\`) | Runs |
|---|---|
| \`@Before\` | before each scenario (and before the Background) |
| \`@After\` | after each scenario - **even if it failed** |
| \`@BeforeStep\` / \`@AfterStep\` | around every single step |
| \`@BeforeAll\` / \`@AfterAll\` | once for the whole run (must be \`static\`) |

Import them from \`io.cucumber.java\` - **not** \`org.junit\` or \`org.testng\`. A JUnit/TestNG \`@Before\`/\`@BeforeMethod\`
in a step or hook class is silently ignored by Cucumber, and the driver is never created.

## The Scenario object

An \`@After\` (or \`@AfterStep\`) method may declare an \`io.cucumber.java.Scenario\` parameter. Cucumber passes in
information about the scenario that just ran:

- \`scenario.getName()\` - the scenario title (useful for file names).
- \`scenario.isFailed()\` - \`true\` if any step failed.
- \`scenario.getSourceTagNames()\` - its tags.
- \`scenario.attach(data, mediaType, name)\` - adds a file or text to **the report** for this scenario.

\`attach\` is how evidence ends up inside the HTML report, right under the failed step, instead of in a folder nobody
opens. For example, attaching the current URL as text:

\`\`\`java
@AfterStep
public void logUrl(Scenario scenario) {
    scenario.attach(driver.getCurrentUrl(), "text/plain", "URL after step");
}
\`\`\`

## Taking a screenshot

Selenium can photograph the browser through the \`TakesScreenshot\` interface. A \`ChromeDriver\` implements it, so
you **cast** the driver (tell Java "treat this object as a TakesScreenshot"):

\`\`\`java
byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
\`\`\`

- \`OutputType.BYTES\` returns the image as a byte array in memory - ideal for \`attach\`, which wants bytes plus a
  media type such as \`"image/png"\`.
- \`OutputType.FILE\` writes a temporary file instead; use it only if you really need a file on disk.

## Cleanup must always happen

What if taking the screenshot itself throws an exception (the browser crashed, for example)? If \`driver.quit()\` is
the next line, it never runs and a zombie browser stays open on the CI machine. Java's **try/finally** guarantees
cleanup:

\`\`\`java
try {
    // risky work - e.g. collect evidence
} finally {
    // always runs, even if the try block threw
}
\`\`\`

Put the evidence collection in \`try\` and the quit in \`finally\`.

## Ordering hooks

When you have several hooks of the same kind, \`order\` decides who goes first:

\`\`\`java
@After(order = 10) public void a() { ... }
@After(order = 0)  public void b() { ... }
\`\`\`

- \`@Before\`: **lower** order runs **first**.
- \`@After\`: **higher** order runs **first** (they unwind in reverse, like taking off layers).

So if you split "capture evidence" and "quit the browser" into two \`@After\` methods, give the evidence hook the
higher number - you cannot screenshot a browser that has already quit.

## Tagged hooks

A hook can be limited with a tag expression: \`@Before("@cart")\` runs only for scenarios tagged \`@cart\` - handy for
seeding a cart or clearing \`localStorage\` before cart tests only (see the *Tags* lesson).

## Tagged hooks for fast setup

Tagged hooks are a clean way to give some scenarios a head start without touching the others. ShopEasy keeps its cart
in the browser's \`sessionStorage\` (key \`shopeasy.cart\`, see \`shop.js\`). A hook can empty it for scenarios that must
start with an empty cart:

\`\`\`java
@Before(value = "@empty-cart", order = 20)
public void emptyCart() {
    ((JavascriptExecutor) context.getDriver())
        .executeScript("sessionStorage.removeItem('shopeasy.cart');");
}
\`\`\`

- \`value\` is a tag expression; \`order\` places it after the browser-starting hook (lower runs first).
- \`JavascriptExecutor\` runs a line of JavaScript inside the page. Storage belongs to the site's origin, so a shop
  page must already be open.
- Only scenarios tagged \`@empty-cart\` pay for this; scenarios that test the cart UI itself stay untouched.

## The @After ordering trap and @AfterStep

Because \`@After\` hooks run from the **highest** order down, a cleanup hook with a high number (say it navigates to
the login page) runs *before* a screenshot hook with order 0 - and every failure screenshot shows the login page.
Two fixes: give evidence collection the higher order, or collect evidence in an \`@AfterStep\` hook. \`@AfterStep\`
runs straight after each step, while the browser still shows the page where the failure happened; check
\`scenario.isFailed()\` there so you only attach images for the failing step.

## Where does the driver go?

The hook creates the browser, but the step classes need to use it. Storing it in a \`static\` field "works" until you
run in parallel. The clean way is a shared, per-scenario context object injected into both hooks and steps - see the
*Sharing state with PicoContainer* lesson.`,
  keyPoints: [
    'Hooks come from io.cucumber.java and run automatically - never call them from Gherkin.',
    '@After runs even when the scenario failed; declare a Scenario parameter to inspect it.',
    'scenario.isFailed() + TakesScreenshot (OutputType.BYTES) + scenario.attach(..., "image/png", name) puts evidence in the report.',
    'Use try/finally so driver.quit() always runs.',
    '@Before: lower order first; @After: higher order first.',
    'Tagged hooks (@Before(value = "@tag", order = n)) give only matching scenarios extra setup.',
    '@AfterStep with scenario.isFailed() captures evidence at the exact failing step.',
  ],
  mistakes: [
    'Importing org.junit.Before or TestNG\'s @BeforeMethod in the hooks class. Fix: io.cucumber.java.Before / After.',
    'Hooks class outside the glue packages, so the browser never starts. Fix: add the hooks package to glue.',
    'Quitting the driver before taking the screenshot. Fix: screenshot first, quit in finally, or order the hooks correctly.',
    'Taking a screenshot after every passing scenario. Fix: check scenario.isFailed() to keep reports small.',
  ],
  tryIt: `Write (on paper) the order in which these run for one scenario with two steps: @Before, Background step,
@BeforeStep, @AfterStep, @After. Where would a screenshot of the failing step best be taken?`,
  problems: ['cuc-011', 'cuc-024', 'cuc-034', 'cuc-039'],
}
