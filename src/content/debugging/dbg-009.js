export default {
  id: 'dbg-009',
  category: 'debugging',
  kind: 'code',
  title: 'Parallel run chaos: a static WebDriver shared by every thread',
  level: 'EXPERT',
  tags: ['parallel', 'ThreadLocal', 'static', 'NoSuchSessionException', 'cucumber', 'testng'],
  estMinutes: 30,
  scenario: `To cut the ShopEasy regression from 40 to 10 minutes, the team switched the Cucumber TestNG runner to \`@DataProvider(parallel = true)\` with 4 threads. The first parallel run was a disaster: random \`NullPointerException\`s, \`NoSuchSessionException\`, and one screenshot shows the username field containing **"standard_userstandard_user"**. Sequentially everything is green. Your lead: *"Parallel is a must for this release — find out why."*`,
  description: `Jenkins console (4 threads):

\`\`\`text
[TestNG-PoolService-2] INFO  c.s.hooks.Hooks - Starting scenario: Add backpack to cart
[TestNG-PoolService-3] INFO  c.s.hooks.Hooks - Starting scenario: Login with locked user
[TestNG-PoolService-3] INFO  c.s.hooks.Hooks - Finished scenario: Login with locked user -> driver.quit()

org.openqa.selenium.NoSuchSessionException: Session ID is null. Using WebDriver after calling quit()?
Build info: version: '4.21.0', revision: '79ed462ef4'
Driver info: driver.version: RemoteWebDriver
	at org.openqa.selenium.remote.HttpCommandExecutor.execute(HttpCommandExecutor.java:155)
	at org.openqa.selenium.remote.service.DriverCommandExecutor.invokeExecute(DriverCommandExecutor.java:167)
	at org.openqa.selenium.remote.RemoteWebDriver.execute(RemoteWebDriver.java:543)
	at org.openqa.selenium.remote.RemoteWebDriver.findElement(RemoteWebDriver.java:353)
	at com.shopeasy.pages.InventoryPage.addToCart(InventoryPage.java:31)
	at com.shopeasy.stepdefs.CartSteps.i_add_to_the_cart(CartSteps.java:22)
	at ✽.I add "Trailblazer Backpack" to the cart(file:///var/lib/jenkins/workspace/shopeasy-regression/src/test/resources/features/cart.feature:9)

java.lang.NullPointerException: Cannot invoke "org.openqa.selenium.WebDriver.findElement(org.openqa.selenium.By)" because "com.shopeasy.driver.DriverManager.driver" is null
	at com.shopeasy.pages.LoginPage.enterUsername(LoginPage.java:24)
	at com.shopeasy.stepdefs.LoginSteps.i_log_in_as(LoginSteps.java:19)
\`\`\`

**Diagnose:** \`DriverManager.driver\` is a single \`static\` field. Thread 3 quits *its* browser, which is the same object thread 2 is using. Thread 1 overwrites the field with a new browser while thread 4 is typing → text lands in someone else's window.

**Rewrite \`DriverManager\`:**
- Store the driver in a \`ThreadLocal<WebDriver>\` so each thread gets its own browser.
- \`getDriver()\` returns \`DRIVER.get()\`; \`initDriver()\` creates and \`DRIVER.set(...)\`s it.
- \`quitDriver()\` quits and calls \`DRIVER.remove()\` (prevents leaks when TestNG reuses pool threads).
- No public \`static WebDriver driver\` field anymore.`,
  hints: [
    '"Using WebDriver after calling quit()" in a parallel run = another thread quit the shared driver.',
    'private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();',
    'In quitDriver(): if (DRIVER.get() != null) { DRIVER.get().quit(); DRIVER.remove(); }',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.driver;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

public class DriverManager {

    public static WebDriver driver;

    public static void initDriver() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new", "--window-size=1920,1080");
        driver = new ChromeDriver(options);
    }

    public static WebDriver getDriver() {
        return driver;
    }

    public static void quitDriver() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }
}
`,
  solution: String.raw`package com.shopeasy.driver;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

public final class DriverManager {

    // one browser per thread - scenarios running in parallel never share a driver
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverManager() {
    }

    public static void initDriver() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new", "--window-size=1920,1080");
        DRIVER.set(new ChromeDriver(options));
    }

    public static WebDriver getDriver() {
        WebDriver driver = DRIVER.get();
        if (driver == null) {
            throw new IllegalStateException("Driver not initialised for thread " + Thread.currentThread().getName());
        }
        return driver;
    }

    public static void quitDriver() {
        WebDriver driver = DRIVER.get();
        if (driver != null) {
            driver.quit();
            DRIVER.remove(); // pool threads are reused - do not leak the old session
        }
    }
}
`,
  checks: [
    { label: 'Uses ThreadLocal<WebDriver>', pattern: 'ThreadLocal\\s*<\\s*WebDriver\\s*>', hint: 'private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();' },
    { label: 'Sets the driver for the current thread', pattern: '\\.set\\s*\\(\\s*new\\s+\\w*Driver|\\.set\\s*\\(\\s*\\w+\\s*\\)', hint: 'DRIVER.set(new ChromeDriver(options));' },
    { label: 'Reads the driver of the current thread', pattern: '\\w+\\.get\\s*\\(\\s*\\)', hint: 'return DRIVER.get();' },
    { label: 'Removes the ThreadLocal value after quit', pattern: '\\.remove\\s*\\(\\s*\\)', hint: 'DRIVER.remove() after quit()' },
    { label: 'No shared static WebDriver field', pattern: 'static\\s+WebDriver\\s+\\w+\\s*[;=]', mustNot: true, hint: 'A plain static field is shared by all threads' },
  ],
  explanation: `**Root cause:** \`static\` means *one value for the whole JVM*. With 4 threads there are 4 scenarios but only one \`driver\` slot. Whichever thread wrote last "wins"; when one scenario finishes and calls \`quit()\`, every other thread is now pointing at a dead session (\`NoSuchSessionException\`) or at \`null\` (\`NullPointerException\`). Typing "standard_user" twice into the same field is the visible proof that two threads drove one browser.

**Why \`ThreadLocal\`:** it gives each thread its own copy of the variable. Hooks run on the same thread as their scenario, so \`@Before → initDriver()\`, steps → \`getDriver()\`, \`@After → quitDriver()\` all see the *same* browser — and never another thread's.

**Why \`remove()\` matters:** TestNG/Cucumber reuse pool threads. Without \`remove()\`, a later scenario on that thread could get a reference to a quit driver, and the map entry leaks memory in long runs.

**Checklist for parallel-safe frameworks:**
- No static mutable state (drivers, page objects, "current user", test data holders) — use ThreadLocal or Cucumber's PicoContainer dependency injection.
- Independent test data per scenario (unique emails/orders).
- Thread-safe reporting (ExtentReports with ThreadLocal tests).
- Configure threads in one place: \`@DataProvider(parallel = true)\` + \`dataproviderthreadcount\` in testng.xml or the Surefire config.`,
  mistakes: [
    'Making getDriver() synchronized — it serialises the threads but they still share one browser.',
    'Keeping static page objects that captured the old driver in their constructor.',
    'Forgetting DRIVER.remove(), causing leaks and occasional "session deleted" errors.',
    'Turning on parallel before making test data unique per scenario.',
  ],
  interview: [
    { q: 'How do you run tests in parallel and why do you need ThreadLocal?', a: 'We run Cucumber through TestNG with @DataProvider(parallel = true) on the scenarios method and set the thread count in testng.xml. Because each thread needs its own browser, our DriverManager holds the driver in a ThreadLocal<WebDriver>: the Before hook sets it, steps and pages get it, and the After hook quits and removes it. Before that change, a static driver caused NoSuchSessionException and text typed into the wrong browser.' },
    { q: 'What problems did you face when enabling parallel execution?', a: 'Shared static state and shared test data. The static driver was the first issue; the second was two scenarios using the same user and cart, so we generated unique users or reset data via API per scenario. We also made reporting thread-safe.' },
    { q: 'Alternatives to ThreadLocal in Cucumber?', a: 'Cucumber’s dependency injection with PicoContainer: a TestContext object holding the driver is created per scenario and injected into step-definition constructors. Under the hood it also gives each scenario its own instance.' },
  ],
}
