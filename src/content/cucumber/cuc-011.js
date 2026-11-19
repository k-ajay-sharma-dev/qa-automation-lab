export default {
  id: 'cuc-011',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Hooks: start the browser and screenshot on failure',
  level: 'INTERMEDIATE',
  tags: ['hooks', 'screenshot', 'scenario-attach'],
  estMinutes: 20,
  scenario: `Nightly regression failed with "expected 2 but was 1" and nobody can tell what the page looked like. Also, browsers
stay open after failures and the CI agent runs out of memory. You need \`@Before\`/\`@After\` hooks that open and close the browser for each scenario,
and attach a screenshot to the report when a scenario fails.`,
  description: `Complete \`Hooks.java\`.

**Rules**
- \`@Before\` (from \`io.cucumber.java\`, **not** JUnit/TestNG) creates the driver.
- \`@After\` takes a \`Scenario\` parameter; if \`scenario.isFailed()\`, take a screenshot with \`TakesScreenshot\` as \`OutputType.BYTES\` and
  \`scenario.attach(bytes, "image/png", name)\`.
- The driver must be quit in \`@After\` **even when the screenshot fails** (use try/finally).
- Bonus: use \`order\` so the screenshot hook runs before quit.`,
  starterCode: `package com.shopeasy.hooks;

import com.shopeasy.support.DriverFactory;
import org.junit.Before;
import org.junit.After;

public class Hooks {

    @Before
    public void setUp() {
        DriverFactory.initDriver();
    }

    @After
    public void tearDown() {
        // TODO: screenshot only on failure, attach to the report
        DriverFactory.quitDriver();
    }
}
`,
  solution: `package com.shopeasy.hooks;

import com.shopeasy.support.DriverFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

public class Hooks {

    @Before(order = 0)
    public void startBrowser(Scenario scenario) {
        DriverFactory.initDriver();
        DriverFactory.getDriver().manage().deleteAllCookies();
    }

    @After(order = 1)
    public void tearDown(Scenario scenario) {
        WebDriver driver = DriverFactory.getDriver();
        try {
            if (scenario.isFailed() && driver != null) {
                byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
                scenario.attach(png, "image/png", scenario.getName());
            }
        } finally {
            DriverFactory.quitDriver();
        }
    }
}
`,
  checks: [
    { label: 'Uses Cucumber hook annotations', pattern: 'import\\s+io\\.cucumber\\.java\\.(After|Before|\\*)\\s*;', hint: 'import io.cucumber.java.After; / io.cucumber.java.Before;' },
    { label: 'Not JUnit/TestNG hooks', pattern: 'import\\s+org\\.(junit|testng)\\.[\\w.]*(Before|After)', mustNot: true, hint: 'JUnit/TestNG @Before is ignored by Cucumber.' },
    { label: '@After receives Scenario', pattern: '@After[^\\n]*\\s+public\\s+void\\s+\\w+\\s*\\(\\s*Scenario\\s+\\w+\\s*\\)', hint: 'public void tearDown(Scenario scenario)' },
    { label: 'Checks scenario.isFailed()', pattern: '\\.isFailed\\s*\\(\\s*\\)', hint: 'if (scenario.isFailed()) { ... }' },
    { label: 'Screenshot as bytes', pattern: 'getScreenshotAs\\s*\\(\\s*OutputType\\.BYTES\\s*\\)', hint: '((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES)' },
    { label: 'Attaches with image/png', pattern: '\\.attach\\s*\\([^)]*"image/png"', hint: 'scenario.attach(bytes, "image/png", scenario.getName())' },
    { label: 'Quits in finally', pattern: 'finally\\s*\\{[^}]*quit', hint: 'Wrap the screenshot in try { } finally { quit }' },
  ],
  hints: [
    'Import io.cucumber.java.Before and io.cucumber.java.After — the JUnit ones compile but never run.',
    'scenario.attach(byte[] data, String mediaType, String name) puts the image into html/json reports.',
    '@After hooks with a HIGHER order run FIRST (they run in reverse order).',
  ],
  explanation: `Hook execution per scenario: \`@BeforeAll\` (once) → \`@Before\` (ascending \`order\`) → Background → steps (with \`@BeforeStep\`/\`@AfterStep\` around each)
→ \`@After\` (**descending** \`order\`) → \`@AfterAll\` (once).

\`@After\` always runs — also when a step failed — which makes it the right place for screenshots and cleanup. \`OutputType.BYTES\` avoids temp files;
\`scenario.attach\` embeds the image into the html/json report (and Allure / ExtentReports adapters pick it up too).
The \`finally\` guarantees the browser closes even if taking the screenshot throws (e.g. the browser already crashed). Hooks can be conditional:
\`@Before("@admin")\` runs only for scenarios with that tag.`,
  mistakes: [
    'Importing org.junit.Before — it compiles, but Cucumber never calls it, so the driver is null.',
    'Taking a screenshot after driver.quit() — NoSuchSessionException.',
    'Screenshot on every scenario — reports become huge; attach only on failure.',
    'Saving screenshots to a fixed file name — parallel runs overwrite each other.',
  ],
  interview: [
    { q: 'In which order do Cucumber hooks run?', a: 'BeforeAll once, then per scenario: @Before in ascending order, Background and steps (BeforeStep/AfterStep around each), @After in descending order, finally AfterAll once.' },
    { q: 'How do you attach a screenshot to a Cucumber report?', a: 'In an @After hook with a Scenario parameter: if scenario.isFailed(), take TakesScreenshot.getScreenshotAs(OutputType.BYTES) and call scenario.attach(bytes, "image/png", name).' },
    { q: 'What is a tagged hook?', a: 'A hook with a tag expression, e.g. @Before("@db"), that runs only for matching scenarios — useful for expensive setup like seeding test data.' },
  ],
}
