export default {
  id: 'cuc-014',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Reports and re-running only the failed scenarios',
  level: 'ADVANCED',
  tags: ['reports', 'plugins', 'rerun', 'ci'],
  estMinutes: 25,
  scenario: `The test manager wants a report link in every Jenkins build, the dashboard team needs JSON to feed their trend chart,
and the nightly run of 300 scenarios has 3–4 flaky failures that the team re-checks by hand every morning. Set up report plugins and a
second runner that re-runs only what failed.`,
  description: `Configure two TestNG runners.

**Rules**
- \`RegressionRunner\`: plugins \`pretty\`, \`html:\`, \`json:\` and \`rerun:target/failed_scenarios.txt\`; \`features\` points to the feature folder.
- \`FailedRerunRunner\`: \`features = "@target/failed_scenarios.txt"\` (the \`@\` means "read file:line list from this file"),
  with its own html report so the two runs do not overwrite each other.
- Both use the same glue.
- (Optional) \`publish = false\` to avoid uploading to reports.cucumber.io from CI.`,
  starterCode: `package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy",
        plugin = {"pretty"}
)
public class RegressionRunner extends AbstractTestNGCucumberTests {
}

// TODO: FailedRerunRunner
`,
  solution: `// ----- RegressionRunner.java -----
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy",
        tags = "@regression and not @wip",
        plugin = {
                "pretty",
                "html:target/cucumber-reports/regression.html",
                "json:target/cucumber-reports/regression.json",
                "rerun:target/failed_scenarios.txt"
        },
        publish = false
)
public class RegressionRunner extends AbstractTestNGCucumberTests {
}

// ----- FailedRerunRunner.java -----
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
        features = "@target/failed_scenarios.txt",
        glue = "com.shopeasy",
        plugin = {
                "pretty",
                "html:target/cucumber-reports/rerun.html",
                "json:target/cucumber-reports/rerun.json"
        },
        publish = false
)
public class FailedRerunRunner extends AbstractTestNGCucumberTests {
}
`,
  checks: [
    { label: 'html report plugin', pattern: '"html:[^"]+\\.html"', hint: '"html:target/cucumber-reports/regression.html"' },
    { label: 'json report plugin', pattern: '"json:[^"]+\\.json"', hint: '"json:target/cucumber-reports/regression.json"' },
    { label: 'rerun plugin writes failures', pattern: '"rerun:[^"]+"', hint: '"rerun:target/failed_scenarios.txt"' },
    { label: 'Second runner reads the rerun file', pattern: 'features\\s*=\\s*"@[^"]+"', hint: 'features = "@target/failed_scenarios.txt"' },
    { label: 'Two runner classes', pattern: '(extends\\s+AbstractTestNGCucumberTests[\\s\\S]*){2}', hint: 'Add class FailedRerunRunner extends AbstractTestNGCucumberTests' },
  ],
  hints: [
    'The rerun plugin writes lines like features/checkout.feature:14 for every failed scenario.',
    'Prefixing the features value with @ tells Cucumber to read that list.',
    'Give each runner its own report files, otherwise the rerun report overwrites the full one.',
  ],
  explanation: `Built-in plugins (format \`name:path\`):

| Plugin | Output | Used for |
|---|---|---|
| \`pretty\` | console | reading CI logs |
| \`html:…html\` | single-file report with screenshots | humans |
| \`json:…json\` | machine-readable results | dashboards, \`maven-cucumber-reporting\` ("Cucumber Reports" Jenkins plugin) |
| \`junit:…xml\` | JUnit XML | CI test-result widgets |
| \`rerun:…txt\` | file:line of failures | re-running failed scenarios |
| \`message:…ndjson\` | Cucumber messages | modern tooling |

Third-party: Allure (\`io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm\`) and ExtentReports adapters are added the same way via \`plugin\`.

Rerunning is a **diagnostic tool**, not a cure: a scenario that passes only on rerun is still flaky — log it and fix the root cause (waits, data, order dependency).
Configure Surefire to run the rerun runner after the main one (two executions, or two \`<test>\` blocks in testng.xml).`,
  mistakes: [
    'Two runners writing the same report path — the rerun hides the original failures.',
    'Hiding flakiness permanently behind automatic reruns.',
    'Forgetting that the rerun file is empty/missing when nothing failed — make the CI step conditional.',
  ],
  interview: [
    { q: 'Which report plugins have you used with Cucumber?', a: 'pretty for console, html and json built-ins, junit XML for CI, and Allure or Extent adapters for rich dashboards with screenshots attached via scenario.attach.' },
    { q: 'How do you re-run only failed Cucumber scenarios?', a: 'Add the rerun:target/failed.txt plugin to the main runner, then a second runner with features = "@target/failed.txt" executes just those file:line entries.' },
  ],
}
