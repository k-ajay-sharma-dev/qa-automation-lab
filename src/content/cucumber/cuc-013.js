export default {
  id: 'cuc-013',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'TestNG runner with @CucumberOptions and parallel scenarios',
  level: 'INTERMEDIATE',
  tags: ['runner', 'cucumberoptions', 'testng', 'parallel'],
  estMinutes: 20,
  scenario: `\`mvn test\` reports "Tests run: 0". Your feature files are in \`src/test/resources/features\`, step definitions in
\`com.shopeasy.steps\`, hooks in \`com.shopeasy.hooks\` — but there is no runner that tells Surefire how to start Cucumber. The team also
wants the 40 regression scenarios to run 4 at a time.`,
  description: `Write \`TestRunner\` for TestNG.

**Rules**
- Extend \`AbstractTestNGCucumberTests\` (\`io.cucumber.testng\`).
- \`@CucumberOptions\` with \`features\`, \`glue\` (**both** steps and hooks packages), \`plugin\` (pretty + html report) and a default \`tags\`.
- Override \`scenarios()\` with \`@DataProvider(parallel = true)\` to run scenarios in parallel.
- \`monochrome = true\` for readable console output.`,
  starterCode: `package com.shopeasy.runners;

import io.cucumber.testng.CucumberOptions;

// TODO: make this a TestNG Cucumber runner
public class TestRunner {
}
`,
  solution: `package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = {"com.shopeasy.steps", "com.shopeasy.hooks"},
        tags = "@regression and not @wip",
        plugin = {
                "pretty",
                "html:target/cucumber-reports/cucumber.html",
                "json:target/cucumber-reports/cucumber.json"
        },
        monochrome = true
)
public class TestRunner extends AbstractTestNGCucumberTests {

    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
`,
  checks: [
    { label: 'Extends AbstractTestNGCucumberTests', pattern: 'extends\\s+AbstractTestNGCucumberTests', hint: 'public class TestRunner extends AbstractTestNGCucumberTests' },
    { label: 'features path set', pattern: 'features\\s*=\\s*\\{?\\s*"[^"]+"', hint: 'features = "src/test/resources/features"' },
    { label: 'glue includes steps and hooks', pattern: 'glue\\s*=\\s*\\{[^}]*"[\\w.]*steps"[^}]*"[\\w.]*hooks"|glue\\s*=\\s*\\{[^}]*"[\\w.]*hooks"[^}]*"[\\w.]*steps"|glue\\s*=\\s*"com\\.shopeasy"', hint: 'glue = {"com.shopeasy.steps", "com.shopeasy.hooks"}' },
    { label: 'html report plugin', pattern: '"html:[^"]+"', hint: 'plugin = {"pretty", "html:target/cucumber-reports/cucumber.html"}' },
    { label: 'Parallel DataProvider', pattern: '@DataProvider\\s*\\(\\s*parallel\\s*=\\s*true\\s*\\)', hint: '@DataProvider(parallel = true) on scenarios()' },
    { label: 'Overrides scenarios()', pattern: 'public\\s+Object\\[\\]\\[\\]\\s+scenarios\\s*\\(\\s*\\)[\\s\\S]*super\\.scenarios\\(\\)', hint: 'return super.scenarios();' },
  ],
  hints: [
    'glue is a list of packages to scan; if hooks live in another package, they are silently ignored unless listed.',
    'features can be a folder, a file, or file:line (e.g. "src/test/resources/features/login.feature:12").',
    'Thread count for the parallel DataProvider: <suite data-provider-thread-count="4"> in testng.xml or -Ddataproviderthreadcount=4.',
  ],
  explanation: `The runner is the bridge between the test framework (TestNG here) and Cucumber. \`AbstractTestNGCucumberTests\` exposes every
scenario (each Outline row too) as a TestNG data-provider row. Marking the provider \`parallel = true\` makes TestNG run rows on a thread pool
(default 10 threads, tuned with \`dataproviderthreadcount\`). That only works if your driver is per-thread/per-scenario — see the PicoContainer problem.

**JUnit 5 alternative**: Cucumber 7 recommends the JUnit Platform engine — a \`@Suite @IncludeEngines("cucumber") @SelectClasspathResource("features")\` class
plus \`junit-platform.properties\` (\`cucumber.glue\`, \`cucumber.plugin\`, \`cucumber.execution.parallel.enabled=true\`).

Tip: the \`tags\` here is only a **default** — CI overrides it with \`-Dcucumber.filter.tags\`.`,
  mistakes: [
    'glue only lists the steps package — hooks never run and the driver is null.',
    'Runner class name not matching Surefire includes (**/*Test*.java, **/*Tests.java, **/*TestCase.java) → 0 tests run. TestRunner matches; "CukeRunner" does not.',
    'Turning on parallel with a static WebDriver — scenarios hijack each other\'s browser.',
    'Using the removed "cucumber.api.CucumberOptions" import from Cucumber 4.',
  ],
  interview: [
    { q: 'What does @CucumberOptions configure?', a: 'Where the features are, which packages to scan for glue (steps, hooks, types), report plugins, a default tag expression, dryRun, monochrome and snippet style.' },
    { q: 'How do you run Cucumber scenarios in parallel with TestNG?', a: 'Extend AbstractTestNGCucumberTests, override scenarios() with @DataProvider(parallel = true), set dataproviderthreadcount, and make the driver thread/scenario-scoped (ThreadLocal or DI).' },
    { q: 'What is dryRun = true for?', a: 'It checks every step has a matching definition without executing anything — fast feedback for undefined steps after editing feature files.' },
  ],
}
