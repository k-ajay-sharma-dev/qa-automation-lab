export default {
  id: 'dbg-030',
  category: 'debugging',
  kind: 'code',
  title: 'NoSuchSessionException: the base class quits the browser after the first test',
  level: 'INTERMEDIATE',
  tags: ['NoSuchSessionException', 'BaseTest', 'testng', 'lifecycle', 'annotations', 'driver.quit'],
  estMinutes: 15,
  scenario: `Sprint 9: to "save time", someone changed the shared \`BaseTest\` so the browser opens once per class instead of once per test. Now \`CartTest\` has a strange pattern: the **first** test method passes and **every following test** in the class fails in milliseconds. Run any single test alone and it is green. Twenty other test classes extend the same \`BaseTest\`, so the whole nightly is red.`,
  description: `Console output (second test in the class):

\`\`\`text
[INFO] Running com.shopeasy.tests.CartTest
[ERROR] removeItemFromCart(com.shopeasy.tests.CartTest)  Time elapsed: 0.012 s  <<< FAILURE!
org.openqa.selenium.NoSuchSessionException: invalid session id
Build info: version: '4.21.0'
Driver info: org.openqa.selenium.chrome.ChromeDriver
	at org.openqa.selenium.remote.RemoteWebDriver.execute(RemoteWebDriver.java:557)
	at org.openqa.selenium.remote.RemoteWebDriver.get(RemoteWebDriver.java:276)
	at com.shopeasy.tests.CartTest.removeItemFromCart(CartTest.java:41)
[INFO] Tests run: 4, Failures: 3, Errors: 0, Skipped: 0
\`\`\`

\`NoSuchSessionException: invalid session id\` means the test is talking to a browser that was **already quit**. Look at the annotations in \`BaseTest\`: the driver is created **once per class** but quit **after every method**.

**Fix \`BaseTest\`:**
- Create the driver in \`@BeforeMethod\` and quit it in \`@AfterMethod\` (a fresh browser per test, matching pair).
- Make teardown run even when the test or setup failed: \`alwaysRun = true\`.
- Guard against a null driver (setup may have failed) and set the field to \`null\` after quitting.`,
  hints: [
    'Setup and teardown annotations must come in matching pairs: BeforeMethod/AfterMethod or BeforeClass/AfterClass.',
    '@AfterMethod(alwaysRun = true) still runs when the test failed or a dependency was skipped.',
    'if (driver != null) { driver.quit(); driver = null; }',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;

public abstract class BaseTest {

    protected WebDriver driver;
    protected String baseUrl = System.getProperty("baseUrl", "http://localhost:5173/practice-site");

    @BeforeClass
    public void setUp() {
        driver = new ChromeDriver();
        driver.manage().window().maximize();
    }

    @AfterMethod
    public void tearDown() {
        driver.quit();
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseTest {

    protected WebDriver driver;
    protected String baseUrl = System.getProperty("baseUrl", "http://localhost:5173/practice-site");

    @BeforeMethod(alwaysRun = true)
    public void setUp() {
        driver = new ChromeDriver();
        driver.manage().window().maximize();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }
}
`,
  checks: [
    { label: 'Creates the driver in @BeforeMethod', pattern: '@BeforeMethod[^{]*\\{[^}]*new\\s+\\w+Driver', flags: 'ms', hint: 'Open the browser per test so it pairs with @AfterMethod' },
    { label: 'No per-class setup paired with per-method quit', pattern: '@BeforeClass', mustNot: true, hint: '@BeforeClass runs once, @AfterMethod quits after every test' },
    { label: 'Teardown always runs', pattern: '@AfterMethod\\s*\\(\\s*alwaysRun\\s*=\\s*true\\s*\\)', hint: '@AfterMethod(alwaysRun = true)' },
    { label: 'Null-safe quit', pattern: 'if\\s*\\(\\s*driver\\s*!=\\s*null\\s*\\)', hint: 'If setUp failed, driver is null and quit() throws a NullPointerException' },
    { label: 'Clears the reference after quit', pattern: 'driver\\s*=\\s*null', hint: 'A quit driver must never be reused' },
  ],
  explanation: `**NoSuchSessionException ("invalid session id") = you are using a WebDriver whose browser session has ended** — usually because something called \`quit()\` earlier, or the browser crashed.

The pattern "first test passes, the rest fail in milliseconds" is the giveaway: TestNG ran
1. \`@BeforeClass setUp\` → browser opened **once**
2. test 1 → passes
3. \`@AfterMethod tearDown\` → browser **quit**
4. test 2 → \`driver.get(...)\` on a dead session → NoSuchSessionException

**Rule: lifecycle annotations come in pairs.** Choose one:
- \`@BeforeMethod\` / \`@AfterMethod\` — fresh browser per test: slower but fully independent (the usual default).
- \`@BeforeClass\` / \`@AfterClass\` — one browser per class: faster, but tests share cookies, cart and login state.

\`alwaysRun = true\` makes the teardown run even after failures or skips (otherwise browsers leak on the agent), and the null check avoids a NullPointerException that would hide the real setup error. Setting \`driver = null\` makes any accidental reuse fail fast and clearly.

(For **parallel** runs you also need a ThreadLocal driver — see the parallel-run problem in this section.)`,
  mistakes: [
    'Mixing @BeforeClass with @AfterMethod (or @BeforeMethod with @AfterClass).',
    'Calling driver.quit() inside a test method or page object, then continuing to use the driver.',
    'Teardown without alwaysRun = true, leaving dozens of chrome.exe processes on the CI agent.',
    'driver.close() vs driver.quit() confusion: close() closes one window; quitting the last window also ends the session.',
  ],
  interview: [
    { q: 'What causes NoSuchSessionException and how do you debug it?', a: 'It means the WebDriver session is gone — quit was already called, the browser crashed, or in parallel runs another thread quit a shared driver. I check where quit is called, whether setup and teardown annotations are paired, and whether the driver is shared between threads. The pattern of failures, like only the first test passing, usually points straight to the lifecycle.' },
    { q: 'Browser per test or per class — which do you choose?', a: 'Per test by default, because tests stay independent and one failure cannot poison the next. If the suite is slow, I first speed up login with cookies or API setup before sharing a browser per class, because shared state causes order-dependent failures.' },
    { q: 'Why alwaysRun = true on @AfterMethod?', a: 'Without it TestNG may skip the teardown when a configuration method or dependency fails, leaving browsers open and leaking memory on the agent. With alwaysRun the cleanup happens no matter how the test ended.' },
  ],
}
