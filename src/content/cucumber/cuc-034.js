export default {
  id: 'cuc-034',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'A bullet-proof @After: close the driver even when the step or the browser fails',
  level: 'ADVANCED',
  tags: ['hooks', 'after-hook', 'teardown', 'threadlocal', 'parallel'],
  estMinutes: 20,
  scenario: `The ShopEasy suite now runs 4 scenarios in parallel on CI. After a bad night the agent had 37 orphaned chrome.exe
processes, and the report showed \`NullPointerException in Hooks.tearDown\` instead of the real failure. Investigation: when
\`@Before\` failed the driver was null; when Chrome had crashed, \`quit()\` threw and the next scenario on that thread got the
dead driver from the ThreadLocal. You need a teardown that survives all of that.`,
  description: `Rewrite \`Hooks.java\` (the \`DriverManager\` holds one driver per thread).

**Rules**
- Import \`@After\` / \`Scenario\` from \`io.cucumber.java\`.
- On failure attach a PNG screenshot — but only if a driver exists, and a failing screenshot must **not** stop the cleanup.
- \`quit()\` is called only when the driver is not null, and a \`WebDriverException\` from \`quit()\` is caught and logged, not rethrown.
- In a \`finally\`, always clear the thread's slot with \`ThreadLocal.remove()\` (via \`DriverManager.unload()\`).
- No \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.hooks;

import io.cucumber.java.After;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

class DriverManager {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
    static WebDriver get() { return DRIVER.get(); }
    static void set(WebDriver driver) { DRIVER.set(driver); }
    static void unload() {
        // TODO
    }
}

public class Hooks {

    @After
    public void tearDown(Scenario scenario) {
        WebDriver driver = DriverManager.get();
        if (scenario.isFailed()) {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", scenario.getName());
        }
        driver.quit();
    }
}
`,
  solution: `package com.shopeasy.hooks;

import io.cucumber.java.After;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;

class DriverManager {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
    static WebDriver get() { return DRIVER.get(); }
    static void set(WebDriver driver) { DRIVER.set(driver); }
    static void unload() { DRIVER.remove(); }
}

public class Hooks {

    @After
    public void tearDown(Scenario scenario) {
        WebDriver driver = DriverManager.get();
        try {
            if (scenario.isFailed() && driver != null) {
                attachScreenshot(driver, scenario);
            }
        } finally {
            try {
                if (driver != null) {
                    driver.quit();
                }
            } catch (WebDriverException e) {
                System.err.println("Could not quit driver for '" + scenario.getName() + "': " + e.getMessage());
            } finally {
                DriverManager.unload();
            }
        }
    }

    private void attachScreenshot(WebDriver driver, Scenario scenario) {
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", scenario.getName());
        } catch (WebDriverException e) {
            scenario.log("Screenshot failed: " + e.getMessage());
        }
    }
}
`,
  checks: [
    { label: 'Cucumber @After with Scenario', pattern: '@After[^\\n]*\\s+public\\s+void\\s+\\w+\\s*\\(\\s*Scenario\\s+\\w+\\s*\\)', hint: 'public void tearDown(Scenario scenario) with io.cucumber.java.After' },
    { label: 'Null-checks the driver', pattern: 'driver\\s*!=\\s*null|null\\s*!=\\s*driver|Objects\\.nonNull\\s*\\(\\s*driver', hint: 'if (driver != null) { driver.quit(); }' },
    { label: 'Catches WebDriverException', pattern: 'catch\\s*\\(\\s*(final\\s+)?(WebDriverException|RuntimeException|Exception)\\s+\\w+\\s*\\)', hint: 'try { driver.quit(); } catch (WebDriverException e) { log it }' },
    { label: 'Clears the ThreadLocal with remove()', pattern: '\\.remove\\s*\\(\\s*\\)', hint: 'static void unload() { DRIVER.remove(); }' },
    { label: 'Cleanup in a finally block', pattern: 'finally\\s*\\{[\\s\\S]*?(quit|unload)\\s*\\(', hint: 'Put quit()/unload() in finally so a failed screenshot cannot skip them.' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Waiting does not make teardown safer.' },
  ],
  hints: [
    'If @Before failed, DriverManager.get() returns null — every use of driver needs a guard.',
    'Nest try/finally: screenshot in the outer try, quit + unload in the finally.',
    'ThreadLocal.set(null) leaves the entry; remove() really clears it for the next scenario on that pooled thread.',
  ],
  explanation: `\`@After\` is the only code guaranteed to run after a failed scenario, so it must never be the thing that fails.

1. **Null guard** — if \`@Before\` threw, there is no driver. The old code turned a clear "could not start Chrome" into a misleading NPE.
2. **Screenshot is best effort** — when the browser crashed, \`getScreenshotAs\` throws. Catch it and \`scenario.log\` the reason.
3. **quit() can throw too** — a dead session throws \`WebDriverException\`. Log it; an exception from teardown would mask the real step failure in the report.
4. **\`ThreadLocal.remove()\` in finally** — parallel runners reuse threads. Without it the next scenario on that thread can pick up the dead driver (or leak memory).

The nested \`finally\` means: whatever happens with the screenshot or quit, the thread's slot is cleaned.`,
  mistakes: [
    'Calling driver.quit() without a null check — an NPE in teardown hides the original failure.',
    'Letting an exception from the screenshot skip driver.quit(), leaving orphan browsers on the agent.',
    'Using DRIVER.set(null) instead of DRIVER.remove() — the entry stays in the thread map.',
    'Rethrowing from @After: the report shows the teardown error instead of the failing step.',
  ],
  interview: [
    { q: 'Why use ThreadLocal for WebDriver in parallel Cucumber runs?', a: 'Each scenario runs on a worker thread; ThreadLocal gives each thread its own driver so scenarios do not drive each other\'s browser. You must remove() it at the end because threads are pooled and reused.' },
    { q: 'What happens if an @After hook throws?', a: 'The scenario is marked failed with that hook error, and if the scenario already failed the teardown error can be what people see first. Remaining cleanup in that hook is skipped, so teardown should catch and log instead.' },
    { q: 'Where else would you guard against orphaned browsers?', a: 'An @AfterAll or a JVM shutdown hook that quits any remaining drivers, plus a CI step that kills leftover browser processes as a safety net.' },
  ],
}
