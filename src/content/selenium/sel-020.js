export default {
  id: 'sel-020',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'ThreadLocal WebDriver for safe parallel execution',
  level: 'EXPERT',
  tags: ['parallel', 'ThreadLocal', 'testng', 'framework'],
  estMinutes: 35,
  scenario: `You switched TestNG to \`parallel="methods" thread-count="4"\` to cut the 70-minute run. Result: tests type into each other's browsers, random \`NoSuchSessionException: invalid session id\`, and one Chrome left open after every run. The cause is a single \`public static WebDriver driver\` shared by all threads. Your lead wants a \`DriverManager\` that gives each thread its own browser, and Cucumber step classes / Page Objects must keep calling \`DriverManager.getDriver()\` unchanged.`,
  description: `Implement \`DriverManager\` and update \`BaseTest\`:

1. \`private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();\`
2. \`initDriver()\` creates a driver (use \`DriverFactory\` from the Grid problem or \`new ChromeDriver()\`) and \`set()\`s it for the current thread.
3. \`getDriver()\` returns \`DRIVER.get()\` and throws \`IllegalStateException\` if it is null (helps catch "called outside a test").
4. \`quitDriver()\` quits **and** calls \`DRIVER.remove()\` — thread pools reuse threads, so a stale value would leak.
5. \`BaseTest\`: \`@BeforeMethod\` → \`initDriver()\`, \`@AfterMethod(alwaysRun = true)\` → \`quitDriver()\`.
6. Show the \`testng.xml\` parallel setting in a comment.

**Rules**: no static \`WebDriver\` field outside the ThreadLocal; pages get the driver via \`DriverManager.getDriver()\` or constructor injection.`,
  hints: [
    'ThreadLocal gives every thread its own independent copy of the variable.',
    'DRIVER.remove() after quit(), otherwise the reused pool thread still points at a dead session.',
    'ThreadLocal.withInitial(...) is tempting, but explicit init/quit makes the lifecycle visible in hooks.',
  ],
  starterCode: `package com.shopeasy.framework;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public class BaseTest {

    public static WebDriver driver; // shared by every thread!

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver();   // thread B overwrites thread A's driver
    }

    @AfterMethod
    public void tearDown() {
        driver.quit();                 // may quit another thread's browser
    }
}
`,
  solution: `package com.shopeasy.framework;

import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

/*
 * testng.xml:
 * <suite name="Regression" parallel="methods" thread-count="4">
 *   <test name="ui"><packages><package name="com.shopeasy.tests"/></packages></test>
 * </suite>
 */
final class DriverManager {

    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverManager() { }

    static void initDriver() {
        if (DRIVER.get() == null) {
            DRIVER.set(DriverFactory.create(Thread.currentThread().getName()));
        }
    }

    static WebDriver getDriver() {
        WebDriver driver = DRIVER.get();
        if (driver == null) {
            throw new IllegalStateException(
                    "No WebDriver for thread " + Thread.currentThread().getName() + " - was initDriver() called?");
        }
        return driver;
    }

    static void quitDriver() {
        WebDriver driver = DRIVER.get();
        try {
            if (driver != null) {
                driver.quit();
            }
        } finally {
            DRIVER.remove();
        }
    }
}

public abstract class BaseTest {

    @BeforeMethod(alwaysRun = true)
    public void setUp() {
        DriverManager.initDriver();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        DriverManager.quitDriver();
    }

    protected WebDriver driver() {
        return DriverManager.getDriver();
    }
}
`,
  checks: [
    { label: 'Declares a ThreadLocal<WebDriver>', pattern: 'ThreadLocal\\s*<\\s*(WebDriver|RemoteWebDriver)\\s*>', hint: 'private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();' },
    { label: 'Sets the driver for the current thread', pattern: '\\.set\\s*\\(', hint: 'DRIVER.set(new ChromeDriver())' },
    { label: 'Reads it with get()', pattern: 'DRIVER\\.get\\s*\\(\\s*\\)|\\w+\\.get\\s*\\(\\s*\\)\\s*;', hint: 'return DRIVER.get();' },
    { label: 'Removes the value after quitting', pattern: '\\.remove\\s*\\(\\s*\\)', hint: 'DRIVER.remove() so pooled threads do not keep a dead driver' },
    { label: 'Quits in an alwaysRun teardown', pattern: '@AfterMethod\\s*\\(\\s*alwaysRun\\s*=\\s*true\\s*\\)', hint: '@AfterMethod(alwaysRun = true)' },
    { label: 'No shared static WebDriver field', pattern: 'static\\s+WebDriver\\s+\\w+\\s*[;=]', mustNot: true, hint: 'A static WebDriver is shared by every thread' },
  ],
  explanation: `With \`parallel="methods"\`, TestNG runs test methods on several threads at once. A \`static WebDriver\` is **one** variable for all of them: thread B's \`setUp\` overwrites thread A's driver, A types into B's browser, and whichever finishes first \`quit()\`s a session the other is still using → \`NoSuchSessionException\`. The leaked browser is the one whose reference was overwritten.

\`ThreadLocal<WebDriver>\` stores one value **per thread**: \`set()\` and \`get()\` only see the current thread's copy. So each test method gets its own browser while the rest of the framework still calls a static-looking \`DriverManager.getDriver()\` — Page Objects and Cucumber steps don't change.

Details reviewers check:
- **\`remove()\` after \`quit()\`** — TestNG/Cucumber use thread pools; without \`remove()\` the next test on that thread sees a dead driver (and you leak memory).
- **\`alwaysRun = true\`** so the browser is quit even if setup or a dependency failed.
- **Fail fast** in \`getDriver()\` with a clear message instead of a NullPointerException deep inside a page.
- Everything else must be thread-safe too: no static Page Objects, no static test data mutated by tests, unique test users per thread if the app locks sessions.

For Cucumber, the same \`DriverManager\` is called from \`@Before\`/\`@After\` hooks, and with \`cucumber.execution.parallel.enabled=true\` (JUnit 5) or TestNG's \`@DataProvider(parallel = true)\` on the scenarios provider. Alternatively, PicoContainer dependency injection can share a per-scenario driver object without statics at all.`,
  mistakes: [
    'Keeping a static WebDriver "for convenience" alongside the ThreadLocal.',
    'Forgetting DRIVER.remove(), so a reused thread hands the next test a quit driver.',
    'Creating Page Objects in a static field once per class — they hold the first thread\'s driver.',
    'Turning on parallel runs with shared test accounts, so tests log each other out (not a Selenium problem, but it looks like one).',
  ],
  interview: [
    { q: 'How do you run Selenium tests in parallel safely?', a: 'Give each thread its own WebDriver via ThreadLocal (or DI per scenario), configure TestNG parallel/thread-count or Cucumber parallel execution, quit and remove the driver in teardown, and keep test data and Page Objects free of shared mutable state. Use a Grid to scale beyond one machine.' },
    { q: 'What is ThreadLocal?', a: 'A Java class that gives each thread its own independently initialised copy of a variable; get/set only affect the current thread. remove() clears the current thread\'s value.' },
    { q: 'parallel="methods" vs "classes" vs "tests" in TestNG?', a: 'methods runs each test method in its own thread; classes runs all methods of a class on the same thread, classes in parallel; tests runs each <test> tag in parallel. Choose based on how isolated your tests are.' },
  ],
}
