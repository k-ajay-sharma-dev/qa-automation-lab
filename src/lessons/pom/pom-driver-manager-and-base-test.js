export default {
  slug: 'pom-driver-manager-and-base-test',
  category: 'pom',
  order: 8,
  title: 'DriverManager, ThreadLocal and BaseTest — then refactor a script',
  minutes: 10,
  summary: 'Create browsers in one place with a ThreadLocal DriverManager, open and close them per test in a BaseTest, and turn a long script into page objects step by step.',
  manualAnalogy: `When four testers run regression in parallel, each one gets their own machine and browser — nobody types into someone else's session. And every test session starts the same way (fresh browser, logged-out state) and ends the same way (close everything), however the test went. DriverManager is the "one machine per tester" rule; BaseTest is the standard set-up and clean-up checklist.`,
  body: `## Why a shared static driver breaks

\`\`\`java
public class TestUtils {
    public static WebDriver driver = new ChromeDriver();   // one browser for everyone
}
\`\`\`

\`static\` means one variable shared by the whole program. That is fine for one test at a time. Run tests in parallel (see the *testng.xml* lesson in the Framework track) and thread A logs in while thread B clicks Logout **in the same browser**. You get random failures that never reproduce locally.

## ThreadLocal: one value per thread

A *thread* is one line of execution; TestNG's parallel mode runs several at once. \`ThreadLocal<T>\` is a box that holds a **separate value for each thread**:

\`\`\`java
private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

DRIVER.set(new ChromeDriver());   // stores a driver for the *current* thread
WebDriver d = DRIVER.get();       // gets *this* thread's driver (null if none)
DRIVER.remove();                  // clears this thread's slot
\`\`\`

The field is \`static\` (one box), but each thread sees only its own content. Thread A's \`get()\` never returns thread B's browser.

## A DriverManager in outline

The class has three jobs — create, give, destroy:

| Method | Responsibility |
|---|---|
| \`initDriver(String browser)\` | Pick Chrome/Firefox/Edge with a \`switch\`, apply options (e.g. headless from \`System.getProperty("headless")\`), then \`set\` it |
| \`getDriver()\` | Return the current thread's driver |
| \`quitDriver()\` | \`quit()\` the browser **and** \`remove()\` the slot |

Why both? \`quit()\` closes the browser; \`remove()\` empties the ThreadLocal. Thread pools re-use threads, so a slot that is never removed keeps a dead driver for the next test — a memory leak and a confusing "session deleted" error.

Give it a **private constructor** (\`private DriverManager() {}\`) so nobody writes \`new DriverManager()\`; everything is accessed statically. The app's Framework Blueprint page shows a full \`DriverFactory\` built this way.

## BaseTest: set-up and tear-down once

TestNG runs methods marked with annotations around each test (the *TestNG annotations* lesson covers all of them). A parent test class holds them:

\`\`\`java
public abstract class BaseTest {

    @BeforeMethod
    public void setUp() {
        DriverManager.initDriver("chrome");
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        DriverManager.quitDriver();
    }

    protected WebDriver driver() {
        return DriverManager.getDriver();
    }
}
\`\`\`

- \`@BeforeMethod\` / \`@AfterMethod\` run before and after **every** \`@Test\` — a fresh browser per test, so tests do not depend on each other.
- \`alwaysRun = true\` makes tear-down run even if set-up or the test failed. Without it, a failure can leave browsers open on the CI machine.
- To choose the browser from \`testng.xml\`, add \`@Parameters("browser")\` to the set-up method and a \`String browser\` parameter; \`@Optional("chrome")\` supplies a default when the XML has no such parameter (for example when you run one class from the IDE).

A test class then contains only tests:

\`\`\`java
public class SortTest extends BaseTest {
    @Test
    public void sortZtoA() {
        List<String> names = new LoginPage(driver()).open()
                .loginAs("standard_user", "secret_sauce")
                .sortBy("za").productNames();
        // assertions ...
    }
}
\`\`\`

Shared shortcuts such as "log in as the standard user" can become \`protected\` helper methods in BaseTest.

## Refactoring a long script: a safe order

You will meet 60-line tests full of \`findElement\` and \`Thread.sleep\`. Do not rewrite everything at once:

1. **Run it and note the expected values** (items, totals, messages). Behaviour must stay identical.
2. **Walk the script and mark page boundaries** — every place the URL or screen changes. Each section becomes a page class.
3. **Move locators** into private \`By\` fields of the right page; **move actions** into methods.
4. **Make navigation methods return the next page** (*Fluent page objects* lesson).
5. **Replace every \`Thread.sleep\`** with BasePage helpers that wait.
6. **Move browser creation** into BaseTest/DriverManager.
7. **Keep assertions in the test** and add messages.
8. **Run again** and compare with step 1.

Done right, the test method has no \`By\`, no \`findElement\`, no sleeps — just the business flow and its checks.`,
  keyPoints: [
    'A `public static WebDriver` is shared by all threads and breaks parallel runs.',
    '`ThreadLocal<WebDriver>` gives each thread its own driver via set/get/remove.',
    'Always `quit()` and then `remove()` when a test ends.',
    'BaseTest opens a browser in `@BeforeMethod` and closes it in `@AfterMethod(alwaysRun = true)`.',
    'Refactor in small steps, keeping behaviour and expected values identical.',
  ],
  mistakes: [
    'Calling `quit()` but not `remove()` — the next test on that thread gets a dead session.',
    'Creating the driver in `@BeforeClass` while running `parallel="methods"` — methods of one class share one browser. Use `@BeforeMethod`.',
    'Leaving out `alwaysRun = true` on tear-down — failed tests leave browsers running.',
    'Rewriting a whole script in one go — refactor page by page and re-run after each step.',
  ],
  tryIt: `Take the longest script you have written so far and, with a pen, draw a box around each group of lines that works on one screen (login, inventory, cart, checkout step one, overview, complete). Count the boxes — that is how many page classes you need. Circle every \`Thread.sleep\`; each one becomes a wait in BasePage.`,
  problems: ['pom-011', 'pom-012', 'pom-013'],
}
