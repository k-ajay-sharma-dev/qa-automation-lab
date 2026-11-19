export default {
  id: 'cuc-026',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Migrate to the JUnit 5 Platform Suite runner and run scenarios in parallel',
  level: 'ADVANCED',
  tags: ['runner', 'junit-platform', 'parallel', 'reports', 'rerun'],
  estMinutes: 30,
  scenario: `The company template moved to JUnit 5, and the old \`@RunWith(Cucumber.class)\` runner (JUnit 4, \`cucumber-junit\`) is deprecated
in Cucumber 7. While you are at it, the 180 regression scenarios take 36 minutes in a single thread and the release manager wants the run under
10 minutes on the 4-core CI agent. The driver is already per scenario (PicoContainer \`TestContext\`), so parallel execution is safe.`,
  description: `Replace the JUnit 4 runner with the **JUnit Platform** setup. Deliver both files in the editor, separated by the banner comments.

**\`RunCucumberTest.java\`** (\`src/test/java/com/shopeasy/runners\`)
- \`@Suite\`, \`@IncludeEngines("cucumber")\`, \`@SelectClasspathResource("features")\` (features live in \`src/test/resources/features\`).
- \`@ConfigurationParameter\` for the glue (\`com.shopeasy\`), the plugins (pretty, html, json **and** \`rerun:target/rerun.txt\`) and a default tag
  filter \`@regression and not @wip\`. Use the constants from \`io.cucumber.junit.platform.engine.Constants\` or the literal keys.

**\`junit-platform.properties\`** (\`src/test/resources\`)
- Enable parallel execution with a **fixed** strategy and parallelism **4**.
- Turn off the publish banner (\`cucumber.publish.quiet=true\`).

No \`@RunWith\` and no \`io.cucumber.junit.Cucumber\` anywhere.`,
  starterCode: `// ===== src/test/java/com/shopeasy/runners/RunCucumberTest.java =====
package com.shopeasy.runners;

import io.cucumber.junit.Cucumber;
import io.cucumber.junit.CucumberOptions;
import org.junit.runner.RunWith;

@RunWith(Cucumber.class)
@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy",
        plugin = {"pretty", "html:target/cucumber.html"},
        tags = "@regression and not @wip"
)
public class RunCucumberTest {
}

// ===== src/test/resources/junit-platform.properties =====
// TODO
`,
  solution: `// ===== src/test/java/com/shopeasy/runners/RunCucumberTest.java =====
package com.shopeasy.runners;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.shopeasy")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "pretty, html:target/cucumber-reports/cucumber.html, "
              + "json:target/cucumber-reports/cucumber.json, rerun:target/rerun.txt")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@regression and not @wip")
public class RunCucumberTest {
}

// ===== src/test/resources/junit-platform.properties =====
cucumber.execution.parallel.enabled=true
cucumber.execution.parallel.config.strategy=fixed
cucumber.execution.parallel.config.fixed.parallelism=4
cucumber.execution.parallel.config.fixed.max-pool-size=4
cucumber.publish.quiet=true

// ===== pom.xml (test dependencies, versions managed by the BOMs) =====
// io.cucumber:cucumber-java, io.cucumber:cucumber-junit-platform-engine, io.cucumber:cucumber-picocontainer
// org.junit.platform:junit-platform-suite   (+ maven-surefire-plugin 3.x)
`,
  checks: [
    { label: 'JUnit Platform @Suite class', pattern: '^\\s*@Suite\\b', hint: '@Suite on RunCucumberTest' },
    { label: 'Includes the cucumber engine', pattern: '@IncludeEngines\\s*\\(\\s*"cucumber"\\s*\\)', hint: '@IncludeEngines("cucumber")' },
    { label: 'Selects the features resource folder', pattern: '@SelectClasspathResource\\s*\\(\\s*"[^"]+"\\s*\\)', hint: '@SelectClasspathResource("features")' },
    { label: 'Glue configured', pattern: '@ConfigurationParameter\\s*\\(\\s*key\\s*=\\s*(GLUE_PROPERTY_NAME|"cucumber\\.glue")', hint: '@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.shopeasy")' },
    { label: 'Rerun plugin among the plugins', pattern: 'rerun:[\\w/.-]+', hint: 'value = "pretty, html:..., json:..., rerun:target/rerun.txt"' },
    { label: 'Parallel enabled with fixed parallelism', pattern: '^(?=[\\s\\S]*cucumber\\.execution\\.parallel\\.enabled\\s*=\\s*true)(?=[\\s\\S]*cucumber\\.execution\\.parallel\\.config\\.fixed\\.parallelism\\s*=\\s*\\d+)', hint: 'cucumber.execution.parallel.enabled=true and ...config.fixed.parallelism=4' },
    { label: 'No JUnit 4 runner', pattern: '@RunWith|io\\.cucumber\\.junit\\.Cucumber\\b', mustNot: true, hint: 'Remove @RunWith(Cucumber.class) and the cucumber-junit imports.' },
  ],
  hints: [
    'The suite class has no body: annotations tell the JUnit Platform to run the "cucumber" engine on the features folder on the classpath.',
    'Parallel settings belong in src/test/resources/junit-platform.properties; the strategy "fixed" needs a parallelism value.',
    'The plugin value is ONE comma-separated string: "pretty, html:target/x.html, json:target/x.json, rerun:target/rerun.txt".',
  ],
  explanation: `With Cucumber 7 the recommended runner is the **JUnit Platform engine** (\`cucumber-junit-platform-engine\`). The \`@Suite\` class only tells
the platform *which engine* and *which resources*; every Cucumber option is a configuration parameter:

| Old \`@CucumberOptions\` | JUnit Platform key |
|---|---|
| glue | \`cucumber.glue\` (\`GLUE_PROPERTY_NAME\`) |
| plugin | \`cucumber.plugin\` (\`PLUGIN_PROPERTY_NAME\`) |
| tags | \`cucumber.filter.tags\` (\`FILTER_TAGS_PROPERTY_NAME\`) |
| dryRun | \`cucumber.execution.dry-run\` |

Parallelism is switched on in \`junit-platform.properties\`; with \`fixed\` strategy and parallelism 4, four scenarios run at once
(\`max-pool-size\` caps the thread pool on newer JUnit versions). Scenarios run in parallel, so every piece of state must be scenario-scoped —
exactly what the PicoContainer \`TestContext\` gives you. For the few scenarios that must not overlap (e.g. they change the same user), tag them and declare an exclusive resource:
\`cucumber.execution.exclusive-resources.<tag>.read-write=<resource-name>\`.

Rerun with this runner: the \`rerun:target/rerun.txt\` plugin writes failed \`file:line\` entries, and a second CI step runs them with
\`mvn test -Dcucumber.features=@target/rerun.txt\`. As always, a pass on rerun means *flaky*, not *fixed*.

Expected result here: 36 minutes / 4 ≈ 9–10 minutes, as long as the scenarios are independent.`,
  mistakes: [
    'Mixing cucumber-junit (JUnit 4) and cucumber-junit-platform-engine — scenarios run twice or not at all.',
    'Putting the parallel settings only as @ConfigurationParameter and wondering why nothing runs in parallel — keep them in junit-platform.properties.',
    'Enabling parallel execution with a static WebDriver or shared test user data — random, unreproducible failures.',
    'Writing the plugin parameter as several strings — it is one comma-separated value.',
  ],
  interview: [
    { q: 'How do you run Cucumber 7 with JUnit 5?', a: 'Use the cucumber-junit-platform-engine with a @Suite class annotated @IncludeEngines("cucumber") and @SelectClasspathResource("features"); configure glue, plugins and tags with @ConfigurationParameter or junit-platform.properties.' },
    { q: 'How do you enable parallel scenario execution on the JUnit Platform?', a: 'Set cucumber.execution.parallel.enabled=true in junit-platform.properties and choose a strategy, e.g. fixed with a parallelism of 4. Then make sure drivers and data are per scenario.' },
    { q: 'TestNG or JUnit Platform for Cucumber — which do you choose?', a: 'Both work. JUnit Platform is the Cucumber team\'s recommended default and integrates with modern IDEs and Surefire; TestNG suits teams already standardised on testng.xml and data-provider parallelism.' },
  ],
}
