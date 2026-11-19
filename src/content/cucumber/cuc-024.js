export default {
  id: 'cuc-024',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Hook order, a tagged fast-login hook and per-step screenshots',
  level: 'ADVANCED',
  tags: ['hooks', 'hook-order', 'tagged-hooks', 'afterstep', 'scenario-attach'],
  estMinutes: 30,
  scenario: `Three complaints landed on the framework in one week:
1. Every failure screenshot in the report shows the **login page**, never the page that failed.
2. The 120 cart and checkout scenarios each log in through the UI in a \`@Before\` hook — 8 minutes of the nightly run is typing \`standard_user\`.
3. The login feature itself breaks, because that same hook logs the shopper in before the login scenarios even start.

You open \`Hooks.java\` and see why.`,
  description: `The ShopEasy web shop keeps the logged-in user in \`sessionStorage\` under the key \`shopeasy.user\` (see \`shop.js\`), so a scenario
can be "logged in" by setting that key on the shop's origin — no typing needed.

Rework \`Hooks\`:

**Rules**
- \`@Before(order = 0)\` starts the browser (via the injected \`TestContext\`). No UI login in an untagged hook.
- A **tagged** hook \`@Before(value = "@logged-in", order = 10)\` logs in fast: open \`login.html\`, run
  \`sessionStorage.setItem('shopeasy.user', 'standard_user')\` with \`JavascriptExecutor\`, then open \`inventory.html\`.
- Capture evidence where it happens: an \`@AfterStep\` hook with a \`Scenario\` parameter attaches a PNG when \`scenario.isFailed()\`.
- \`@After\` only cleans up (quit the browser). Understand why the old screenshot showed the login page.`,
  starterCode: `package com.shopeasy.hooks;

import com.shopeasy.pages.LoginPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

public class Hooks {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private final TestContext context;

    public Hooks(TestContext context) {
        this.context = context;
    }

    @Before
    public void setUp() {
        WebDriver driver = context.getDriver();
        driver.get(BASE + "login.html");
        new LoginPage(driver).loginAs("standard_user", "secret_sauce");   // every scenario, even login.feature
    }

    @After(order = 0)
    public void screenshotOnFailure(Scenario scenario) {
        if (scenario.isFailed()) {
            byte[] png = ((TakesScreenshot) context.getDriver()).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", scenario.getName());
        }
    }

    @After(order = 10)
    public void logout() {
        context.getDriver().get(BASE + "login.html");   // "clean up" the session
    }

    @After(order = 5)
    public void quit() {
        context.quitDriver();
    }
}
`,
  solution: `package com.shopeasy.hooks;

import com.shopeasy.support.TestContext;
import io.cucumber.java.After;
import io.cucumber.java.AfterStep;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

public class Hooks {

    private static final String BASE = "http://localhost:5180/practice-site/";
    private final TestContext context;

    public Hooks(TestContext context) {
        this.context = context;
    }

    /** Runs first for every scenario: a fresh browser, nobody logged in. */
    @Before(order = 0)
    public void startBrowser() {
        context.getDriver().manage().deleteAllCookies();
    }

    /** Only for scenarios tagged @logged-in: skip the login form, set the session directly. */
    @Before(value = "@logged-in", order = 10)
    public void loginThroughSession() {
        WebDriver driver = context.getDriver();
        driver.get(BASE + "login.html");    // sessionStorage belongs to the shop's origin
        ((JavascriptExecutor) driver).executeScript(
                "sessionStorage.setItem('shopeasy.user', arguments[0]);", "standard_user");
        driver.get(BASE + "inventory.html");
    }

    /** Evidence at the moment of failure, before anything navigates away. */
    @AfterStep
    public void screenshotFailedStep(Scenario scenario) {
        if (scenario.isFailed()) {
            WebDriver driver = context.getDriver();
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", "Failed step - " + scenario.getName());
            scenario.attach(driver.getCurrentUrl(), "text/plain", "URL at failure");
        }
    }

    @After(order = 0)
    public void quitBrowser() {
        context.quitDriver();
    }
}
`,
  checks: [
    { label: 'Browser hook has an explicit order', pattern: '@Before\\s*\\(\\s*order\\s*=\\s*\\d+\\s*\\)', hint: '@Before(order = 0) public void startBrowser()' },
    { label: 'Tagged @logged-in hook', pattern: '@Before\\s*\\(\\s*(value\\s*=\\s*)?"@logged-in"', hint: '@Before(value = "@logged-in", order = 10)' },
    { label: 'Fast login through sessionStorage', pattern: 'executeScript\\s*\\([^;]*sessionStorage\\.setItem', hint: '((JavascriptExecutor) driver).executeScript("sessionStorage.setItem(\'shopeasy.user\', arguments[0]);", "standard_user")' },
    { label: '@AfterStep receives the Scenario', pattern: '@AfterStep[^\\n]*\\s+public\\s+void\\s+\\w+\\s*\\(\\s*Scenario\\s+\\w+\\s*\\)', hint: '@AfterStep public void screenshotFailedStep(Scenario scenario)' },
    { label: 'Attaches a PNG on failure', pattern: 'isFailed\\s*\\(\\s*\\)[\\s\\S]*\\.attach\\s*\\([^)]*"image/png"', hint: 'if (scenario.isFailed()) scenario.attach(png, "image/png", name)' },
    { label: 'No UI login in hooks', pattern: 'loginAs\\s*\\(', mustNot: true, hint: 'Untagged UI login breaks login.feature and costs minutes — use the tagged session hook.' },
  ],
  hints: [
    '@After hooks run in DESCENDING order: order = 10 (navigate to login) ran before order = 0 (screenshot). That is complaint #1.',
    'sessionStorage is per origin: load any shop page first, then set the key, then open inventory.html.',
    '@AfterStep runs right after each step, while the browser still shows the failing page.',
  ],
  explanation: `**Why the screenshot showed the login page:** \`@Before\` hooks run in ascending \`order\`, \`@After\` hooks in **descending** order.
The "logout" hook (\`order = 10\`) navigated to \`login.html\` before the screenshot hook (\`order = 0\`) ran. Moving evidence to \`@AfterStep\`
captures the page at the exact moment of failure, independent of any cleanup hook.

**Tagged hooks** (\`@Before("@logged-in")\` or \`value = "…"\`) accept any tag expression, e.g. \`"@logged-in and not @guest"\`. Scenarios opt in to setup
with a tag, so login scenarios start logged out and cart scenarios skip the form.

**Fast state setup** — setting \`shopeasy.user\` in \`sessionStorage\` reproduces what the app does after a successful login. It is legitimate
because login is **context** for cart scenarios, not the behaviour under test; the login feature still covers the real form. Real projects do the
same with an API call or a session cookie.

Full order for one scenario: \`@Before(order 0)\` → \`@Before("@logged-in", order 10)\` → Background → each step followed by \`@AfterStep\` → \`@After\` (high to low).`,
  mistakes: [
    'Assuming @After order works like @Before — higher numbers run FIRST in @After.',
    'Setting sessionStorage before opening any shop page — it is stored for the about:blank/data: origin, not the shop.',
    'An untagged "log in everyone" hook — it silently changes the starting state of scenarios that test login itself.',
    'Screenshot in @AfterStep without the isFailed() check — hundreds of images per run.',
  ],
  interview: [
    { q: 'In which order do @After hooks run?', a: 'Descending by order: a higher order value runs first, so they unwind in reverse of @Before. Cleanup that navigates away must run after evidence collection, or evidence moves to @AfterStep.' },
    { q: 'What is a tagged hook and when do you use one?', a: 'A hook with a tag expression, e.g. @Before("@logged-in"), that runs only for matching scenarios. I use it for setup only some scenarios need, like a fast login, seeding data or clearing storage.' },
    { q: 'How do you speed up login-heavy suites?', a: 'Keep UI login only in the login feature; for other scenarios set the session directly — an API call, a session cookie or, for this shop, sessionStorage — in a tagged hook or a declarative Given.' },
  ],
}
