export default {
  slug: 'cucumber-runner-reports-rerun',
  category: 'cucumber',
  order: 9,
  title: 'The runner: @CucumberOptions, parallel runs, reports and rerun',
  minutes: 10,
  summary: 'Configure a TestNG Cucumber runner that finds features and glue, runs scenarios in parallel, writes reports and re-runs only failures.',
  manualAnalogy: `Before a manual test cycle you decide which test cases are in scope, who runs them, how many testers work in
parallel, and where results are recorded. The runner class is that test-run plan for Cucumber: scope, workers and
reporting, in one place.`,
  body: `## What a runner is

Feature files and step definitions do nothing on their own. Something must start Cucumber and tell it where things
are. With TestNG, that is a small class extending \`AbstractTestNGCucumberTests\` (from \`io.cucumber.testng\`, in the
\`cucumber-testng\` dependency). Maven Surefire finds it like any TestNG test, so \`mvn test\` runs your features.

\`\`\`java
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
    features   = "src/test/resources/features/cart",
    glue       = {"com.shopeasy.steps", "com.shopeasy.hooks", "com.shopeasy.support"},
    tags       = "@cart and not @wip",
    plugin     = {"pretty", "html:target/reports/cart.html"},
    monochrome = true
)
public class CartRunner extends AbstractTestNGCucumberTests { }
\`\`\`

## The options, one by one

- \`features\` - folder (or single file) with \`.feature\` files. A folder includes all sub-folders.
- \`glue\` - **packages** (dots, not slashes) containing step definitions, hooks and \`@DataTableType\` classes.
  Forget one and you get undefined steps or hooks that never run. A common parent (\`"com.shopeasy"\`) also works.
- \`tags\` - the default tag expression (see the *Tags* lesson). The command line can override it.
- \`plugin\` - output formats. \`pretty\` prints readable Gherkin to the console; \`html:path\` writes a single-page
  HTML report; \`json:path\` writes JSON that other tools (Jenkins Cucumber Reports, ExtentReports) turn into
  dashboards; \`rerun:path\` writes the list of failed scenarios.
- \`monochrome = true\` - removes colour codes so console logs in Jenkins are readable.
- \`dryRun = true\` - checks every step has a definition without running anything.
- \`publish = false\` - do not upload results to the public reports.cucumber.io service (wise in company CI).

## Running scenarios in parallel

\`AbstractTestNGCucumberTests\` hands scenarios to TestNG through a method called \`scenarios()\`, which is a TestNG
**DataProvider** (a method that supplies rows of test input). By default a DataProvider is sequential. You switch on
parallelism by overriding that method in your runner and marking it \`@DataProvider(parallel = true)\` - the body
simply returns what the parent class returns. Look up the override signature in the cucumber-testng docs; it is three
lines.

Thread count is controlled by TestNG: the \`data-provider-thread-count\` attribute in \`testng.xml\`, or the Surefire
property \`dataproviderthreadcount\` (default 10). Parallel runs are only safe if nothing is shared between
scenarios: no \`static\` driver, no shared test data (see the *Sharing state with PicoContainer* lesson).

## Re-running only the failures

Nightly regression: 300 scenarios, 6 fail - some real bugs, some environment hiccups. Re-running all 300 to check
wastes an hour. The **rerun plugin** helps:

\`\`\`java
plugin = {"pretty", "json:target/reports/regression.json", "rerun:target/rerun/failed.txt"}
\`\`\`

After the run, \`failed.txt\` contains lines like:

\`\`\`text
src/test/resources/features/cart/cart.feature:14:27
\`\`\`

That is *file:line* - the scenarios that failed (line 14 and line 27). A second runner can execute exactly those by
giving \`features\` a value that **starts with \`@\`** followed by that file's path. The \`@\` means "read the list of
scenarios from this file" rather than "this is a features folder".

Rules of thumb for a rerun setup:

- Both runners use the **same glue**.
- Give each runner its **own report file**, otherwise the rerun overwrites the main report.
- The failure runner should run **after** the main one (separate Maven execution, separate Jenkins stage, or a
  TestNG suite order).
- A test that passes on rerun is not "fine" - it is **flaky**. Record it and fix the root cause.

## Reports in CI

Keep reports under \`target/\` (Maven cleans it each build) and archive them in Jenkins. The HTML report shows each
scenario with steps, timings and any \`scenario.attach\` screenshots from your hooks.

## The JUnit 5 Platform alternative

Cucumber 7's recommended runner is the **JUnit Platform engine** (\`cucumber-junit-platform-engine\` plus
\`junit-platform-suite\`). Instead of \`@CucumberOptions\`, a near-empty class says *which engine* and *which
resources*, and every option is a configuration parameter:

\`\`\`java
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/cart")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.shopeasy")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@smoke")
public class CartSmokeTest { }
\`\`\`

- \`@SelectClasspathResource\` points at a folder under \`src/test/resources\`.
- The constants (\`GLUE_PROPERTY_NAME\` = \`cucumber.glue\`, \`PLUGIN_PROPERTY_NAME\` = \`cucumber.plugin\`,
  \`FILTER_TAGS_PROPERTY_NAME\` = \`cucumber.filter.tags\`) come from \`io.cucumber.junit.platform.engine.Constants\`.
- The plugin value is one comma-separated string.

Parallel execution is switched on in \`src/test/resources/junit-platform.properties\` with the keys
\`cucumber.execution.parallel.enabled\` and \`cucumber.execution.parallel.config.strategy\` (\`dynamic\` scales with CPU
cores, \`fixed\` uses a number you choose). The same rule applies as with TestNG: nothing may be shared between
scenarios. Do not mix the old JUnit 4 \`@RunWith(Cucumber.class)\` runner with the platform engine in one project.

## Several runners

It is normal to have a few runners: \`SmokeRunner\`, \`RegressionRunner\`, \`FailedRerunRunner\`. They differ mostly in
\`tags\`, \`features\` and report paths. Avoid copying the same runner ten times - one runner with tags passed from
the command line often covers most needs.`,
  keyPoints: [
    'A TestNG runner extends AbstractTestNGCucumberTests and is configured with @CucumberOptions.',
    'glue lists packages (steps, hooks, transformers); features points to folders or files.',
    'plugin adds outputs: pretty, html:, json:, rerun:; monochrome cleans console output.',
    'Parallel scenarios: override scenarios() with @DataProvider(parallel = true); thread count comes from TestNG.',
    'rerun: writes failed file:line entries; features = "@path" runs only those - give it its own report.',
    'JUnit Platform: @Suite + @IncludeEngines("cucumber") + @ConfigurationParameter; parallelism in junit-platform.properties.',
  ],
  mistakes: [
    'Writing glue as a folder path (src/test/java/...). Fix: use package names with dots.',
    'Listing only the steps package in glue, so hooks never run. Fix: include the hooks (and support) packages too.',
    'Turning on parallel with a static WebDriver. Fix: one driver per scenario via an injected context or ThreadLocal.',
    'Both runners writing the same report file. Fix: separate report paths per runner.',
  ],
  tryIt: `Look at a features folder structure and write down the features, glue and tags values you would need for a
runner that only runs checkout smoke tests.`,
  problems: ['cuc-013', 'cuc-014', 'cuc-026', 'cuc-040'],
}
