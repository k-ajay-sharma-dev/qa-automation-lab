export default {
  slug: 'cucumber-deep-execution-reporting-parallel',
  category: 'cucumber',
  order: 15,
  title: 'Deep dive: running Cucumber at scale — parallel execution, reporting, reruns and CI',
  minutes: 30,
  summary: 'Choose and tune a parallel execution model (JUnit Platform engine with strategies, feature-level mode and exclusive resources; TestNG data-provider threads; Surefire/Failsafe forks; CI shards by tag), know what must be thread-safe, pick a reporting stack (built-in plugins, Messages vs JSON, masterthought, Allure, Extent, Cucumber Reports), make attachments show up everywhere, rerun failures correctly on each runner, and wire it all into Maven profiles, GitHub Actions and Jenkins against ShopEasy — with dry-run and no-tests gates and a troubleshooting guide.',
  manualAnalogy: `A manual regression cycle at scale is a logistics problem: you split 400 test cases between six testers, make sure two of them never use the same test account, agree on one place where everyone records results with evidence, re-check yesterday's failures first thing in the morning, and give the release manager a single summary. Running Cucumber at scale is the same plan written as configuration: workers instead of testers, tags instead of assignment sheets, report plugins instead of the shared spreadsheet, and a rerun file instead of the "re-check" list.`,
  body: `## Where the earlier lessons stop

The beginner \`cucumber-runner-reports-rerun\` lesson showed the two runner shapes, the \`@DataProvider(parallel = true)\` override, the four basic plugins and the \`@target/rerun.txt\` trick. This lesson is about **operating** a large suite: which parallel model to choose and why, what breaks when you switch it on, which report is the source of truth, how reruns differ per runner (they do — a lot), and how a CI pipeline should select, run, gate and publish. Neighbouring deep dives you should not expect repeated here:

- \`cucumber-deep-architecture-internals\` — runner comparison, configuration precedence, the event bus, \`EventListener\` vs \`ConcurrentEventListener\`, Cucumber Messages, dry-run mechanics and a custom plugin.
- \`cucumber-deep-dependency-injection-hooks\` — per-scenario containers, scenario state, the lazy \`DriverHolder\`, hook order and \`@BeforeAll\`.
- \`cucumber-deep-bdd-practice-at-scale\` — the tag taxonomy (\`@smoke\`, \`@regression\`, capability tags, \`@wip\`, \`@quarantine\`) and publishing living documentation.
- \`selenium-deep-parallel-execution\` — TestNG \`parallel\` levels, Surefire forks, the browser factory, data isolation and thread sizing.
- \`selenium-deep-troubleshooting-flaky-tests\` — the flaky-test investigation workflow and retry policy.

**Version baseline.** Code below is valid for **Cucumber-JVM 7** (7.34.9 is the last 7.x release) with JUnit 5 / TestNG 7. Where 8.x changes the picture it is called out. Facts quoted from the cucumber-jvm changelog: **8.0.0 (2026-09-24)** set the baseline to Java 17, moved the engine to JUnit Platform 6, and **deprecated \`cucumber-junit\` (JUnit 4) and \`cucumber-testng\` for removal** in favour of \`cucumber-junit-platform-engine\`; **8.1.0 (2026-11-15)** added \`--fail-if-no-tests\`. Strict mode has been the default since v6 and the non-strict option was removed in v7; \`@BeforeAll\`/\`@AfterAll\` arrived in 7.0.

## Parallel execution: the four models

### What it is and why it is needed

A ShopEasy-style regression of 400 UI scenarios at ~15 s each is 100 minutes single-threaded. Nobody waits 100 minutes for a merge. Parallelism is the only lever that scales roughly linearly; everything else (API setup, smaller selections) is a constant-factor gain. Cucumber parallelises **scenarios (pickles)** — never steps inside one scenario — and there are four places the parallelism can live:

| Level | Mechanism | Unit of work |
|---|---|---|
| Threads in one JVM (JUnit Platform) | the Cucumber engine's hierarchical executor, configured by \`cucumber.execution.parallel.*\` | scenario (or feature with \`same_thread\` mode) |
| Threads in one JVM (TestNG) | \`AbstractTestNGCucumberTests.scenarios()\` as a parallel DataProvider | scenario |
| Several JVMs on one machine | Maven Surefire/Failsafe \`forkCount\` | test **class** (runner/suite class) |
| Several machines | CI matrix / Jenkins parallel stages, each with a tag expression or shard | whatever each job selects |

### How the JUnit Platform engine runs scenarios in parallel (internals)

The engine builds a **test descriptor tree**: engine → feature → (rule) → scenario / outline → example. JUnit Platform's \`HierarchicalTestExecutor\` walks that tree and, when parallel execution is enabled, submits nodes to a pool (a ForkJoin pool by default). Each node has an **execution mode** — \`CONCURRENT\` or \`SAME_THREAD\` — and a set of **exclusive resources** (locks). A scenario that needs a lock waits until it can acquire it; a node in \`SAME_THREAD\` mode runs its children on its own thread, sequentially.

For each pickle, the worker thread creates a fresh glue context through the ObjectFactory (see \`cucumber-deep-dependency-injection-hooks\`), runs hooks and steps, and publishes events. Formatters that implement plain \`EventListener\` (pretty, html, json, junit…) receive events **in canonical order**, buffered — which is why \`pretty\` output in a parallel run appears as one tidy block at the end rather than interleaved.

### Syntax: the engine properties (verified against the engine README)

All of these go in \`src/test/resources/junit-platform.properties\`, as \`@ConfigurationParameter\` on a suite, or as \`-D\` system properties.

| Property | Values | Meaning |
|---|---|---|
| \`cucumber.execution.parallel.enabled\` | \`true\`/\`false\` (default \`false\`) | opt-in switch |
| \`cucumber.execution.parallel.config.strategy\` | \`dynamic\` (default), \`fixed\`, \`custom\` | how the pool is sized |
| \`cucumber.execution.parallel.config.dynamic.factor\` | positive decimal (default \`1.0\`) | parallelism = available cores × factor |
| \`cucumber.execution.parallel.config.fixed.parallelism\` | positive integer | desired parallelism for \`fixed\` |
| \`cucumber.execution.parallel.config.fixed.max-pool-size\` | positive integer | upper bound of the underlying ForkJoin pool |
| \`cucumber.execution.parallel.config.custom.class\` | class name | your \`ParallelExecutionConfigurationStrategy\` for \`custom\` |
| \`cucumber.execution.execution-mode.feature\` | \`concurrent\` (default), \`same_thread\` | \`same_thread\` = scenarios of one feature run sequentially on the feature's thread (feature-level parallelism) |
| \`cucumber.execution.exclusive-resources.<tag>.read-write\` | comma-separated resource names | scenarios with \`@<tag>\` take a read-write lock on those resources |
| \`cucumber.execution.exclusive-resources.<tag>.read\` | comma-separated resource names | read lock (shared among readers, exclusive against a writer) |
| \`cucumber.execution.parallel.config.executor-service\` | \`FORK_JOIN_POOL\`, \`WORKER_THREAD_POOL\` | **documented in the current (8.x) README only** — choose the pool type; default depends on the JUnit version |

Two README caveats worth repeating in an interview: \`fixed.max-pool-size\` does **not** strictly guarantee that no more scenarios run concurrently (a ForkJoin pool can compensate for blocked threads), and the tag name in \`exclusive-resources\` is written **without** the \`@\`.

### Complete example: \`junit-platform.properties\` for ShopEasy

\`\`\`properties
# src/test/resources/junit-platform.properties  — stable defaults; CI overrides with -D
cucumber.glue=com.shopeasy.glue
cucumber.plugin=pretty, summary, html:target/cucumber/report.html, \\
  message:target/cucumber/messages.ndjson, json:target/cucumber/cucumber.json, \\
  junit:target/cucumber/cucumber-junit.xml, rerun:target/cucumber/rerun.txt, \\
  timeline:target/cucumber/timeline
cucumber.publish.quiet=true
cucumber.ansi-colors.disabled=true
cucumber.filter.tags=not @wip and not @quarantine

# --- parallel ---
cucumber.execution.parallel.enabled=true
cucumber.execution.parallel.config.strategy=fixed
cucumber.execution.parallel.config.fixed.parallelism=4
cucumber.execution.parallel.config.fixed.max-pool-size=4

# Scenarios tagged @serial-checkout share one lock -> they never overlap each other
cucumber.execution.exclusive-resources.serial-checkout.read-write=SHOPEASY_ORDERS
# Scenarios tagged @resets-data (they call POST /api/reset) must run alone
cucumber.execution.exclusive-resources.resets-data.read-write=org.junit.platform.engine.support.hierarchical.ExclusiveResource.GLOBAL_KEY

# JUnit/Surefire reporting: unique, readable test names (needed for Surefire reruns)
cucumber.junit-platform.naming-strategy=long
\`\`\`

\`\`\`java
// src/test/java/com/shopeasy/runners/RunCucumberIT.java
package com.shopeasy.runners;

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
public class RunCucumberIT {
    // intentionally empty: everything overridable lives in junit-platform.properties,
    // so -Dcucumber.filter.tags=... from CI is NOT shadowed by a @ConfigurationParameter
}
\`\`\`

\`\`\`gherkin
@api @resets-data
Feature: Seed data
  Scenario: Reset restores the six seed products
    When the test data is reset through the API
    Then the catalogue lists 6 products
\`\`\`

**Step by step:**

1. Glue and plugins live in the properties file, not on the suite class. The architecture deep dive explains why: a suite \`@ConfigurationParameter\` beats a \`-D\` system property, so putting \`cucumber.filter.tags\` on the class would silently ignore the CI selection.
2. \`fixed\` with 4 matches a 4-vCPU CI agent running local headless Chrome; \`dynamic\` with factor \`1.0\` would give the same on that agent but 16 on a developer's laptop — and 16 Chromes on a laptop is a memory test, not a regression.
3. \`GLOBAL_KEY\` is the JUnit Platform's "lock everything" resource: a scenario holding it read-write runs with nothing else in parallel. Use it for the rare scenario that mutates shared server state (\`POST /api/reset\` in ShopEasy restores seed data and drops all tokens, carts and orders — every running scenario would lose its login).
4. The plugin value is one comma-separated string; the trailing backslash is just a properties-file line continuation.
5. The \`long\` naming strategy makes JUnit/Surefire test names include the feature name, which avoids "duplicate test name" collapsing in XML reports and is what the README recommends with Surefire reruns (more below).

### Feature-level vs scenario-level parallelism

| | Scenario-level (\`concurrent\`, default) | Feature-level (\`execution-mode.feature=same_thread\`) |
|---|---|---|
| How it works | every pickle is an independent task | each feature is a task; its scenarios run in order on one thread |
| Advantages | best load balancing — one 40-scenario feature does not become the long pole | scenarios in a feature may share an expensive fixture (a logged-in browser, a seeded seller) — tolerable for legacy suites |
| Disadvantages | demands full scenario independence | long-pole features; hides order dependencies instead of removing them |
| Performance | near-linear until CPU/RAM/backend saturate | limited by the largest feature |
| When to use | default for any suite designed properly | stepping stone while untangling a legacy suite; features whose scenarios genuinely must not overlap (prefer an exclusive resource) |

**Recommended:** scenario-level everywhere, with **exclusive resources** for the handful of scenarios that touch a shared singleton. \`same_thread\` is a migration aid, not a design.

### TestNG runner: \`@DataProvider(parallel = true)\`

\`AbstractTestNGCucumberTests\` exposes every pickle as a row of the \`scenarios()\` DataProvider; TestNG invokes \`runScenario(PickleWrapper, FeatureWrapper)\` per row. Marking the provider parallel hands the rows to TestNG's **data-provider thread pool**, sized by \`data-provider-thread-count\` (\`testng.xml\`) or the Surefire property \`dataproviderthreadcount\` (default 10) — *not* by \`thread-count\`.

\`\`\`java
package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy.glue",
        plugin = {"summary", "json:target/cucumber/testng.json", "rerun:target/cucumber/rerun.txt"},
        publish = false)
public class ShopEasyTestNgRunner extends AbstractTestNGCucumberTests {

    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
\`\`\`

\`\`\`xml
<!-- Surefire passes TestNG properties through <properties> -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.5.4</version>
  <configuration>
    <includes><include>**/ShopEasyTestNgRunner.java</include></includes>
    <properties>
      <property>
        <name>dataproviderthreadcount</name>
        <value>4</value>
      </property>
    </properties>
  </configuration>
</plugin>
\`\`\`

Tag filters, \`-Dcucumber.filter.tags\` and the rerun feature path (\`features = "@target/cucumber/rerun.txt"\`) work exactly as the beginner lesson showed. There is no built-in feature-level mode and no exclusive-resource mechanism; teams emulate them with separate runner classes and TestNG groups.

### Surefire/Failsafe forks

\`forkCount=2\` with \`reuseForks=true\` starts two JVMs and distributes **test classes** between them. One suite class is one unit, so forks only help when you have several suite/runner classes (\`CartIT\`, \`CheckoutIT\`, \`CatalogueIT\`). Forks give real isolation — static state, system properties, \`@BeforeAll\` all become per-JVM — at the cost of JVM start-up and memory. The \`selenium-deep-parallel-execution\` lesson covers the fork/thread arithmetic; the Cucumber-specific traps are:

- **Report paths collide.** Two forks running two suite classes with the same \`json:target/cucumber/cucumber.json\` overwrite each other. Give each suite its own path (\`@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, …)\` per class) or use Surefire's \`\${surefire.forkNumber}\` placeholder in a system property that the plugin string reads.
- **\`@BeforeAll\` runs once per JVM**, not once per build. A \`POST /api/reset\` in \`@BeforeAll\` runs in every fork — wiping the other fork's state mid-run.

### Splitting by tags across CI jobs

Each CI job runs the same suite with a different \`-Dcucumber.filter.tags\`: \`@cart\`, \`@checkout\`, \`@catalogue or @auth\`… Every job has its own machine, browser, and (in the ShopEasy pipeline below) its **own ShopEasy servers**, so shards cannot interfere at all. The danger is coverage: a scenario without any capability tag runs in no shard. Always add a **catch-all shard** with the negation of all the others: \`not (@cart or @checkout or @catalogue or @auth)\`.

### Comparison and recommendation

| | JUnit Platform engine | TestNG DataProvider | Surefire/Failsafe forks | CI shards by tag |
|---|---|---|---|---|
| How it works | engine-level pool over the descriptor tree | TestNG data-provider thread pool | several JVMs, classes distributed | separate jobs/agents, tag expression per job |
| Advantages | scenario- and feature-level modes, exclusive resources by tag, strategy choice, actively developed | familiar to TestNG shops; integrates with TestNG listeners | process isolation; survives static-state sins | horizontal scaling; per-shard environment isolation; failure of one shard is readable |
| Disadvantages | needs JUnit 5/6 familiarity; config precedence surprises | **deprecated for removal in 8.0**; no locks or feature mode; whole provider is one TestNG "method" in reports | coarse (per class); report-path and \`@BeforeAll\` duplication | uneven shard durations; more CI minutes; reports must be merged |
| Performance | best in-JVM | good | JVM start-up per fork | best wall-clock for very large suites |
| Maintainability | properties file only | runner + testng.xml + Surefire properties | extra suite classes | tag hygiene + catch-all shard |
| Scalability | one machine | one machine | one machine | many machines (combine with in-JVM threads) |
| When to use | default for new suites and for any 8.x upgrade | existing TestNG suites on 7.x | legacy suites with static state; very large heaps | suites > ~30 min even with threads |

**Recommended approach and why:** run on the **JUnit Platform engine** with a fixed parallelism tuned per agent and exclusive resources for the few serial scenarios; when one agent is no longer enough, add **CI shards by capability tag** on top (threads × shards). Keep forks for isolation problems you cannot fix yet. For a TestNG suite on 7.x there is no emergency, but since 8.0 deprecates \`cucumber-testng\` for removal, new framework features should not depend on TestNG listeners — plan the migration before upgrading.

### What must be thread-safe, and ordering assumptions that break

| Thing | Rule | Breaks how |
|---|---|---|
| Step classes, page objects, scenario state | per-scenario DI container, no mutable statics | cart of scenario A asserted in scenario B |
| WebDriver | one per scenario (lazy holder in the container) or per thread via \`ThreadLocal\` | \`NoSuchSessionException\`, actions in the wrong window |
| HTTP clients | immutable specs, per-scenario tokens | token of one user used by another |
| Server-side data | unique per scenario (ShopEasy: \`POST /api/users\` to register a fresh customer) | \`409\`-style "already exists", carts merging |
| Custom plugins | \`ConcurrentEventListener\` handlers must be thread-safe; plain \`EventListener\` is ordered | lost or duplicated rows in custom summaries |
| Reports and files | one path per runner/fork; per-scenario file names (\`downloads/<scenarioId>\`) | empty or truncated JSON, overwritten screenshots |
| Logging | MDC with scenario id, or \`scenario.log\` | unreadable interleaved console |

Ordering assumptions that silently break when parallel is switched on: "scenario 2 continues where scenario 1 left off" (cart contents, a logged-in session), "the feature file order is the execution order", "\`@AfterAll\` cleanup runs before the next feature", "Background ran once for the feature" (it runs per scenario), and "\`@BeforeAll\` runs once per build" (once per JVM — forks and shards multiply it). The beginner \`cuc-039\` quiz drills the independence rules; the fix is always **each scenario creates what it needs**.

### Real-time project scenario (ShopEasy)

The checkout suite on a typical e-commerce project has 120 scenarios. After enabling \`fixed.parallelism=4\`, three scenarios fail intermittently: all of them share the "admin resets data" step. Rather than turning parallelism off, a senior tags those three \`@resets-data\`, maps the tag to \`GLOBAL_KEY\`, and opens a ticket to replace the reset with per-scenario users. The suite drops from 30 to 9 minutes; the three serial scenarios cost 45 seconds of exclusive time.

## Reporting

### Built-in plugins (verified in the 8.x CLI usage text)

| Plugin | Output | Use |
|---|---|---|
| \`pretty\` | Gherkin + results to console (or file) | local runs; noisy in CI with parallel |
| \`progress\` | one character per step | CI consoles |
| \`summary\` | totals, failed scenarios, snippets at the end | CI consoles (pair with progress) |
| \`html:<file>\` | single self-contained HTML (message-based React report) | the human-facing artefact |
| \`message:<file>.ndjson\` | Cucumber Messages, one envelope per line | source of truth for tooling |
| \`json:<file>\` | legacy Cucumber JSON | masterthought, older Extent/Jenkins tools |
| \`junit:<file>\` | JUnit XML | CI test tabs (\`junit\` step, GitHub test reporters) |
| \`testng:<file>\` | TestNG XML | TestNG-centric tooling |
| \`rerun:<file>.txt\` | \`file:line\` list of failed pickles | reruns |
| \`timeline:<dir>\` | HTML timeline of which scenario ran on which thread | **diagnosing parallel balance** |
| \`usage\`, \`unused\` | step-definition usage / unused definitions | step-library hygiene |
| \`teamcity\` | TeamCity service messages | TeamCity |

The \`timeline\` plugin is underused: it draws one lane per thread, so you see immediately that one 4-minute scenario is the long pole, or that \`@resets-data\` serialises everything for 2 minutes.

### JSON vs Messages as the source of truth

| | Legacy JSON | Messages (NDJSON) |
|---|---|---|
| Shape | one array of features with elements/steps; fixed, older format | stream of typed envelopes: source, gherkinDocument, pickle, stepDefinition, testCase, testStepFinished, attachment, testRunFinished… |
| Contains | results, embeddings (base64), tags | everything, including which step definition matched and hooks; consistent across Cucumber implementations |
| Consumers | masterthought, many Jenkins plugins, Extent (via its adapter or JSON) | the HTML formatter itself, Cucumber's JSON/JUnit formatter libraries, custom dashboards |
| Streaming | written at the end | appended as events arrive (a killed run still leaves partial data) |

In recent 7.x and 8.x versions the JSON, JUnit XML and HTML outputs are produced by separate **message-based formatter libraries** (8.1.0 bumped \`cucumber-json-formatter\`, \`junit-xml-formatter\` and \`html-formatter\`, per the changelog). **Recommendation:** archive \`messages.ndjson\` as the canonical record of every CI run and derive everything else from it or alongside it; keep JSON only for tools that require it.

### Third-party reporters

\`\`\`xml
<!-- Allure: adapter is a Cucumber plugin -->
<dependency>
  <groupId>io.qameta.allure</groupId>
  <artifactId>allure-cucumber7-jvm</artifactId>
  <scope>test</scope>   <!-- version from io.qameta.allure:allure-bom -->
</dependency>
\`\`\`

\`\`\`properties
# add to cucumber.plugin
cucumber.plugin=summary, message:target/cucumber/messages.ndjson, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm
# allure.properties on the test classpath
# allure.results.directory=target/allure-results
\`\`\`

\`\`\`properties
# ExtentReports via the community adapter (tech.grasshopper:extentreports-cucumber7-adapter) -- illustrative,
# check the adapter README for the exact version and extent.properties keys
cucumber.plugin=summary, com.aventstack.extentreports.cucumber.adapter.ExtentCucumberAdapter:
\`\`\`

| | masterthought \`cucumber-reporting\` | Allure (\`allure-cucumber7-jvm\`) | Extent (adapter) | Cucumber Reports service |
|---|---|---|---|---|
| How it works | Maven plugin / Jenkins plugin reads **JSON** files after the run, renders a static site | Cucumber plugin writes \`allure-results\`; Allure CLI/Jenkins plugin renders | Cucumber plugin builds an Extent HTML/Spark report during the run | uploads Messages to \`reports.cucumber.io\` (\`cucumber.publish.enabled\` / \`publish = true\`) |
| Advantages | zero code; merges many JSON files (shards, forks); feature/tag/step stats | history and trends, categories (product vs test defects), labels, rich attachments, multi-framework | familiar to TestNG/Selenium teams; customisable dashboards | instant shareable link, no infrastructure |
| Disadvantages | legacy JSON only; no history | extra tooling (CLI/server); results directory hygiene | third-party adapter tied to Cucumber major; config spread over properties files | **data leaves your network**; retention limits for anonymous reports; not for company CI without approval |
| Performance | post-processing only | small overhead per attachment | in-run overhead | upload at end |
| Scalability | good (file merge) | very good (merge results dirs) | single report per JVM — awkward across shards | per run |
| When to use | Jenkins shops, quick dashboards | team-wide quality reporting with trends | an existing Extent standard | open-source projects, demos |

**Recommended approach and why:** built-in \`html\` + \`junit\` + \`message\` as the always-on baseline (no dependencies, readable by CI natively), plus **Allure** if the organisation wants history and defect categories across Selenium, API and Cucumber suites. masterthought is fine for a Jenkins team that wants a dashboard with no code. Avoid running three heavyweight reporters in one build: every one of them receives every attachment.

### Attaching screenshots and logs so every reporter shows them

\`scenario.attach(...)\` and \`scenario.log(...)\` publish \`EmbedEvent\`/\`WriteEvent\` on the event bus; every plugin decides what to do with them. Because attachments travel through the bus, **one** hook feeds html, json (base64 embeddings → masterthought), messages, Allure and Extent alike.

\`\`\`java
package com.shopeasy.glue.hooks;

import com.shopeasy.glue.support.DriverHolder;
import io.cucumber.java.AfterStep;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.JavascriptExecutor;

public class EvidenceHooks {

    private final DriverHolder driverHolder;   // per-scenario, injected

    public EvidenceHooks(DriverHolder driverHolder) {
        this.driverHolder = driverHolder;
    }

    @AfterStep("@ui")
    public void evidenceOnFailure(Scenario scenario) {
        if (!scenario.isFailed() || !driverHolder.isStarted()) {
            return;
        }
        WebDriver driver = driverHolder.get();
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", "failure-" + scenario.getLine());
            scenario.attach(driver.getCurrentUrl(), "text/plain", "url");
            Object cart = ((JavascriptExecutor) driver)
                    .executeScript("return sessionStorage.getItem('shopeasy.cart');");
            scenario.attach(String.valueOf(cart), "application/json", "shopeasy.cart");
            scenario.log("thread=" + Thread.currentThread().getName()
                    + " uri=" + scenario.getUri() + ":" + scenario.getLine());
        } catch (RuntimeException e) {
            scenario.log("evidence capture failed: " + e);   // never hide the original failure
        }
    }
}
\`\`\`

Rules that make attachments appear: attach **inside** the scenario (hook or step) on the scenario's thread — not from a TestNG listener, a \`ConcurrentEventListener\` or a background thread after \`TestCaseFinished\`; use correct media types (\`image/png\`, \`text/plain\`, \`application/json\`); take evidence before the driver is quit (\`@AfterStep\`, or quit in \`dispose()\` — see the DI deep dive); keep attachments small, because JSON embeds them as base64 and a 2 MB screenshot per failure × 200 failures makes a 500 MB JSON file that masterthought cannot open.

### Real-time project scenario (ShopEasy)

The release manager wants "one link per build with screenshots". The pipeline archives \`report.html\` (built-in, self-contained, screenshots embedded) as the link, feeds \`cucumber-junit.xml\` to the CI test tab for per-scenario history, and keeps \`messages.ndjson\` for a nightly job that counts scenarios that passed only on rerun. No extra reporter was needed.

## Rerunning failed scenarios

### How it works internally

The \`rerun\` plugin listens for \`TestCaseFinished\` and records the **URI and line** of every pickle whose status is not OK (failed, undefined, pending, ambiguous), writing \`features/cart/cart.feature:14:27\`-style lines at the end of the run. A second execution feeds that file back as the feature selection. Because the line identifies the pickle (for outlines, the example row's line), the rerun runs exactly the failed examples, not the whole outline.

### Per runner: what actually works

| Runner | First run | Rerun mechanism |
|---|---|---|
| TestNG / JUnit 4 / CLI | \`rerun:target/cucumber/rerun.txt\` | second runner with \`features = "@target/cucumber/rerun.txt"\` (or \`-Dcucumber.features=@target/cucumber/rerun.txt\`), separate execution |
| JUnit Platform engine **≥ 7.28.0** | \`rerun:target/cucumber/rerun.txt\` (file **must** end in \`.txt\`) | a separate suite with \`@SelectFile("target/cucumber/rerun.txt")\`, run in a **separate** test execution (changelog 7.28.0: "Support rerun files") |
| JUnit Platform engine (any 7.x) | — | Maven Surefire/Failsafe \`rerunFailingTestsCount\` with \`cucumber.junit-platform.naming-strategy=long\` (README example: Surefire 3.5.4; use the \`surefire\` strategy only on Surefire ≤ 3.5.2) |
| JUnit Platform engine | — | Launcher API: collect failed \`UniqueId\`s, rerun with \`UniqueIdSelector\` (custom code) |

Older JUnit Platform engine READMEs (before 7.28) stated plainly that rerun files were not supported — a classic source of "the \`@rerun.txt\` trick does nothing on JUnit 5" confusion. Note also that \`cucumber.features=@…\` is not how the engine README documents reruns; use \`@SelectFile\`.

### Complete example A: JUnit Platform with a rerun suite (7.28+)

\`\`\`java
// src/test/java/com/shopeasy/runners/RerunFailedIT.java
package com.shopeasy.runners;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectFile;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

@Suite(failIfNoTests = false)            // nothing failed -> nothing to rerun -> still green
@IncludeEngines("cucumber")
@SelectFile("target/cucumber/rerun.txt")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, html:target/cucumber/rerun-report.html, junit:target/cucumber/rerun-junit.xml, "
              + "json:target/cucumber/rerun.json, rerun:target/cucumber/still-failing.txt")
public class RerunFailedIT { }
\`\`\`

Run it as a second Maven invocation (\`mvn verify -Dit.test=RunCucumberIT\` then \`mvn failsafe:integration-test failsafe:verify -Dit.test=RerunFailedIT\`, or two CI steps). Step by step: the first suite writes \`rerun.txt\`; the rerun suite selects that file; \`failIfNoTests = false\` keeps an empty file from failing the build; the rerun writes **its own** report files and a \`still-failing.txt\` — those are your real failures. Because \`RerunFailedIT\` sets \`cucumber.plugin\` with \`@ConfigurationParameter\`, it overrides the properties-file plugins for that suite only.

### Complete example B: Surefire/Failsafe \`rerunFailingTestsCount\`

\`\`\`xml
<configuration>
  <rerunFailingTestsCount>2</rerunFailingTestsCount>
  <properties>
    <configurationParameters>
      cucumber.junit-platform.naming-strategy=long
    </configurationParameters>
  </properties>
</configuration>
\`\`\`

Surefire reruns failed **tests** (scenarios) in the same JVM, up to 2 extra times, and its XML report marks them \`flakyFailure\`/\`rerunFailure\`. Caveat from the README: Cucumber's own report files are **overwritten** during reruns, so \`report.html\` shows only the last attempt — the Surefire XML is then the place where flakiness is visible.

### Approaches compared

| | Rerun file + second runner/suite | Surefire/Failsafe \`rerunFailingTestsCount\` | CI-level retry (rerun the whole job) |
|---|---|---|---|
| How it works | failed \`file:line\` → second execution | build tool retries failed tests in-process | pipeline retries the stage |
| Advantages | fresh JVM; separate, comparable reports; works on every runner (JUnit Platform 7.28+) | one command; flaky status in Surefire XML | trivial |
| Disadvantages | two executions to orchestrate; reports to merge | Cucumber reports overwritten; same JVM (leaked state persists) | reruns passing scenarios too; hides flakiness completely |
| When to use | default for nightly regression | quick win when reports come from Surefire XML | never as policy |

**Recommended approach and why:** rerun file + separate rerun suite, **at most once**, with the first-run report preserved. That gives a clean "failed first time" list (first report), a "still failing" list (product or real test bugs), and the difference (flaky) as a **signal** that feeds the flaky board.

### Flaky-test policy

A scenario that passes on rerun is flaky, not green. Policy on a typical e-commerce project: the build is green only when the rerun passes; every first-attempt failure is recorded (rerun JSON/ndjson vs first-run diff); a scenario flaky twice in a week gets \`@quarantine\` (excluded from the gating tag expression, still run in a non-blocking nightly job) with a ticket and an owner; quarantine has an expiry date. The investigation workflow (reproduce, classify, evidence, isolate) lives in \`selenium-deep-troubleshooting-flaky-tests\`; the tag governance in \`cucumber-deep-bdd-practice-at-scale\`.

## Build integration: Maven profiles and the pom

### Complete \`pom.xml\` snippet

The suite is end-to-end, so it runs under **Failsafe** (\`*IT\` classes) instead of Surefire: Failsafe runs tests in \`integration-test\` and fails the build only in \`verify\`, which lets report generation bound to \`post-integration-test\` run **even when scenarios fail**. With plain Surefire, a failing \`test\` phase stops the build before any later report plugin executes — the most common reason for "the masterthought report is missing exactly when we need it". Surefire configuration is identical apart from the plugin name if you prefer it (then use \`-Dmaven.test.failure.ignore=true\` and a separate gate).

\`\`\`xml
<properties>
  <maven.compiler.release>17</maven.compiler.release>
  <cucumber.version>7.34.9</cucumber.version>
  <junit.version>5.13.4</junit.version>            <!-- align with your Cucumber version -->
  <surefire.version>3.5.4</surefire.version>
  <cucumber.tags>not @wip and not @quarantine</cucumber.tags>
  <parallelism>4</parallelism>
  <masterthought.version>5.8.4</masterthought.version>  <!-- illustrative: use the current net.masterthought release -->
</properties>

<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-bom</artifactId>
      <version>\${cucumber.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
    <dependency>
      <groupId>org.junit</groupId>
      <artifactId>junit-bom</artifactId>
      <version>\${junit.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency><groupId>io.cucumber</groupId><artifactId>cucumber-java</artifactId><scope>test</scope></dependency>
  <dependency><groupId>io.cucumber</groupId><artifactId>cucumber-junit-platform-engine</artifactId><scope>test</scope></dependency>
  <dependency><groupId>io.cucumber</groupId><artifactId>cucumber-picocontainer</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.junit.platform</groupId><artifactId>junit-platform-suite</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><scope>test</scope></dependency>
</dependencies>

<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-failsafe-plugin</artifactId>
      <version>\${surefire.version}</version>
      <configuration>
        <includes><include>**/RunCucumberIT.java</include></includes>
        <systemPropertyVariables>
          <cucumber.filter.tags>\${cucumber.tags}</cucumber.filter.tags>
          <cucumber.execution.parallel.config.fixed.parallelism>\${parallelism}</cucumber.execution.parallel.config.fixed.parallelism>
          <cucumber.execution.parallel.config.fixed.max-pool-size>\${parallelism}</cucumber.execution.parallel.config.fixed.max-pool-size>
          <shopeasy.baseUrl>\${shopeasy.baseUrl}</shopeasy.baseUrl>
          <shopeasy.apiUrl>\${shopeasy.apiUrl}</shopeasy.apiUrl>
        </systemPropertyVariables>
      </configuration>
      <executions>
        <execution>
          <goals><goal>integration-test</goal><goal>verify</goal></goals>
        </execution>
      </executions>
    </plugin>

    <plugin>
      <groupId>net.masterthought</groupId>
      <artifactId>maven-cucumber-reporting</artifactId>
      <version>\${masterthought.version}</version>
      <executions>
        <execution>
          <id>cucumber-html</id>
          <phase>post-integration-test</phase>     <!-- before failsafe:verify fails the build -->
          <goals><goal>generate</goal></goals>
          <configuration>
            <projectName>ShopEasy</projectName>
            <outputDirectory>\${project.build.directory}/cucumber-dashboard</outputDirectory>
            <inputDirectory>\${project.build.directory}/cucumber</inputDirectory>
            <jsonFiles>
              <param>**/*.json</param>
            </jsonFiles>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>

<profiles>
  <profile>
    <id>smoke</id>
    <properties><cucumber.tags>@smoke and not @wip and not @quarantine</cucumber.tags></properties>
  </profile>
  <profile>
    <id>regression</id>
    <properties><cucumber.tags>@regression and not @wip and not @quarantine</cucumber.tags></properties>
  </profile>
  <profile>
    <id>local</id>
    <activation><activeByDefault>true</activeByDefault></activation>
    <properties>
      <shopeasy.baseUrl>http://localhost:5180/practice-site</shopeasy.baseUrl>
      <shopeasy.apiUrl>http://localhost:5181</shopeasy.apiUrl>
    </properties>
  </profile>
</profiles>
\`\`\`

**Step by step:**

1. Both BOMs keep every \`io.cucumber\` and JUnit artefact on one version — mixing versions shows up as \`NoSuchMethodError\` at discovery.
2. Failsafe passes tags and parallelism as **system properties**, which beat \`junit-platform.properties\` but not suite \`@ConfigurationParameter\`s — the reason the main suite class is empty.
3. Profiles only change Maven properties: \`mvn verify -Psmoke\`, \`mvn verify -Pregression -Dparallelism=6\`, or an ad-hoc \`mvn verify -Dcucumber.tags="@cart and not @wip"\`. Note the Maven knob is \`cucumber.tags\` here, mapped explicitly to the system property \`cucumber.filter.tags\` in the forked JVM. Surefire/Failsafe usually forward Maven user properties (\`-Dcucumber.filter.tags=...\`) to the fork as well, but when a pom both maps and forwards the same key, which value wins is hard to reason about — pick **one** documented knob per build and log the effective expression at run start. Mismatched names here are a very common "my -D tag is ignored" cause.
4. The masterthought plugin runs in \`post-integration-test\`, reads every JSON under \`target/cucumber\` (main run and rerun), and writes a dashboard; \`failsafe:verify\` then fails the build if scenarios failed.

## CI integration against ShopEasy

### GitHub Actions: dry-run gate, sharded regression, rerun, publishing

\`\`\`yaml
# .github/workflows/cucumber.yml
name: cucumber
on:
  pull_request:
  schedule:
    - cron: '0 2 * * *'            # nightly regression
  workflow_dispatch:

concurrency:
  group: cucumber-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  dry-run:                          # fails in ~1 min if any step is undefined or ambiguous
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with: { distribution: temurin, java-version: '17', cache: maven }
      - run: mvn -B verify -Dcucumber.execution.dry-run=true -Dcucumber.tags="not @wip"

  e2e:
    needs: dry-run
    runs-on: ubuntu-latest
    timeout-minutes: 45
    strategy:
      fail-fast: false
      matrix:
        shard:
          - { name: cart,      tags: '@cart' }
          - { name: checkout,  tags: '@checkout' }
          - { name: catalogue, tags: '@catalogue or @auth' }
          - { name: rest,      tags: 'not (@cart or @checkout or @catalogue or @auth)' }   # catch-all
    env:
      SUITE_TAGS: \${{ github.event_name == 'pull_request' && '@smoke and' || '@regression and' }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: lts/*, cache: npm }
      - uses: actions/setup-java@v5
        with: { distribution: temurin, java-version: '17', cache: maven }

      - name: Start ShopEasy (web 5180 + API 5181)
        run: |
          npm ci
          nohup npm run dev > shopeasy-web.log 2>&1 &
          nohup npm run api > shopeasy-api.log 2>&1 &
          for i in $(seq 1 60); do
            curl -sf http://localhost:5181/api/health && curl -sf http://localhost:5180/practice-site/login.html > /dev/null && exit 0
            sleep 1
          done
          echo "ShopEasy did not start"; cat shopeasy-*.log; exit 1

      - name: Run shard
        run: >
          mvn -B verify
          -Dcucumber.tags="\${{ env.SUITE_TAGS }} (\${{ matrix.shard.tags }}) and not @wip and not @quarantine"
          -Dparallelism=4

      - name: Rerun failures once
        if: failure() && hashFiles('target/cucumber/rerun.txt') != ''
        run: mvn -B failsafe:integration-test failsafe:verify -Dit.test=RerunFailedIT

      - uses: actions/upload-artifact@v5
        if: \${{ !cancelled() }}
        with:
          name: cucumber-\${{ matrix.shard.name }}
          path: |
            target/cucumber/
            target/cucumber-dashboard/
            target/failsafe-reports/
            shopeasy-*.log
          retention-days: 14
\`\`\`

Key lines explained:

- **Dry-run first.** \`cucumber.execution.dry-run=true\` matches every step without executing glue, so a renamed step fails the PR in a minute without starting ShopEasy or a browser. It does not need the servers.
- **Starting ShopEasy.** \`npm run dev\` is Vite on port 5180 (configured in \`vite.config.js\`), \`npm run api\` is the zero-dependency API on 5181. The loop waits on \`GET /api/health\` (\`{ status: "UP" }\`) and a real page. Each matrix job has **its own** servers, so a \`POST /api/reset\` in one shard cannot affect another.
- **Tag composition.** \`SUITE_TAGS\` picks smoke for PRs, regression for nightly; each shard ANDs its own expression in parentheses; the catch-all shard negates the union so an untagged scenario is never lost. Note \`\${{ … }}\` is GitHub expression syntax evaluated before the shell sees the line.
- **Rerun only on failure, only once**, and only when the rerun file has content. If the main run failed and the rerun passes, the step succeeds — but the job is still marked failed by the earlier step; a team that wants "green if rerun passes" uses \`continue-on-error: true\` on the main run plus a final gate on \`still-failing.txt\`. Make that choice explicitly.
- \`if: \${{ !cancelled() }}\` uploads evidence also for failed jobs; \`fail-fast: false\` lets the other shards finish.
- **Merging shard reports:** a follow-up job can download all \`cucumber-*\` artefacts and run the masterthought plugin (or \`allure generate\`) over all JSON/results directories together.

### Jenkins: declarative pipeline with parallel shards

\`\`\`groovy
// Jenkinsfile
pipeline {
  agent none
  options { timeout(time: 60, unit: 'MINUTES'); timestamps() }
  parameters {
    choice(name: 'SUITE', choices: ['@smoke', '@regression'], description: 'Suite tag')
  }
  stages {
    stage('Dry run') {
      agent { label 'maven-jdk17' }
      steps { sh 'mvn -B verify -Dcucumber.execution.dry-run=true -Dcucumber.tags="not @wip"' }
    }
    stage('E2E shards') {
      parallel {
        stage('cart')      { agent { label 'maven-jdk17-node' }; steps { runShard('cart', '@cart') } }
        stage('checkout')  { agent { label 'maven-jdk17-node' }; steps { runShard('checkout', '@checkout') } }
        stage('catalogue') { agent { label 'maven-jdk17-node' }; steps { runShard('catalogue', '@catalogue or @auth') } }
        stage('rest')      { agent { label 'maven-jdk17-node' }; steps { runShard('rest', 'not (@cart or @checkout or @catalogue or @auth)') } }
      }
    }
  }
}

def runShard(String name, String shardTags) {
  try {
    sh '''
      npm ci
      nohup npm run dev > shopeasy-web.log 2>&1 &
      nohup npm run api > shopeasy-api.log 2>&1 &
      for i in $(seq 1 60); do curl -sf http://localhost:5181/api/health && break; sleep 1; done
    '''
    def tags = "\${params.SUITE} and (\${shardTags}) and not @wip and not @quarantine"
    def status = sh(returnStatus: true, script: "mvn -B verify -Dcucumber.tags='\${tags}' -Dparallelism=4")
    if (status != 0 && fileExists('target/cucumber/rerun.txt')) {
      sh 'mvn -B failsafe:integration-test failsafe:verify -Dit.test=RerunFailedIT'   // throws if still failing
    } else if (status != 0) {
      error("Shard \${name} failed before producing a rerun file")
    }
  } finally {
    junit allowEmptyResults: true, testResults: 'target/failsafe-reports/*.xml, target/cucumber/*junit.xml'
    publishHTML(target: [reportDir: 'target/cucumber', reportFiles: 'report.html',
                         reportName: "Cucumber \${name}", keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true])
    archiveArtifacts artifacts: 'target/cucumber/**, target/cucumber-dashboard/**, shopeasy-*.log', allowEmptyArchive: true
  }
}
\`\`\`

Notes: Groovy \`\${…}\` interpolation happens only in double-quoted strings — the tag string is built in Groovy, then passed in single quotes to the shell so \`and\`, \`not\` and parentheses are not interpreted by bash. \`publishHTML\` comes from the HTML Publisher plugin (\`allowMissing\` keeps the stage from crashing when the run died before writing the report); the masterthought **Cucumber Reports** Jenkins plugin (\`cucumber fileIncludePattern: '**/*.json', jsonReportDirectory: 'target/cucumber'\`) is the alternative to the Maven plugin; with Allure, the Allure Jenkins plugin reads \`target/allure-results\`. Jenkins' Content Security Policy blocks JavaScript in archived HTML by default — if the Cucumber HTML report renders blank in Jenkins, that is CSP, not an empty report.

### Gates: no-tests, dry-run and quality thresholds

- **Nothing selected must fail.** A typo in a tag expression (\`@regresion\`) selects 0 scenarios and many runners report green. Defences: JUnit Platform \`@Suite\` fails when it discovers no tests (\`failIfNoTests\` defaults to true in recent JUnit Platform versions — which is why the rerun suite sets it to \`false\` deliberately); on the CLI, Cucumber **8.1** added \`--fail-if-no-tests\` (exit status 2 when no scenarios ran, per the changelog); for TestNG runners, a tiny plugin on \`TestRunFinished\` that throws when no \`TestCaseStarted\` was seen, or a CI check on the JUnit XML test count.
- **Dry-run gate** on every PR that touches \`.feature\` files or glue.
- **Undefined/pending fail the run** (strict by default since v6) — use \`@wip\` + tag filters, never a non-strict flag (removed in v7).
- **Flaky budget** — track first-attempt pass rate from the first-run report; fail the nightly if quarantine grows beyond an agreed size.

## Execution time optimisation

| Technique | Gain | Note |
|---|---|---|
| Set up state below the UI | 2–10 s per scenario | typical real app: create user/cart via API then open the page. **ShopEasy's web shop keeps session and cart in \`sessionStorage\` (\`shopeasy.user\`, \`shopeasy.cart\` — an array of product slugs) and does not use the API**, so the equivalent shortcut there is seeding sessionStorage: open \`login.html\`, \`sessionStorage.setItem('shopeasy.user','standard_user')\`, \`sessionStorage.setItem('shopeasy.cart', JSON.stringify(['trailblazer-backpack']))\`, then navigate to \`cart.html\` |
| Tag-based selection | runs only the relevant subset | smoke on PR, regression nightly, capability tags for shards |
| Test impact selection | PR runs only affected capabilities | map source paths to capability tags in CI (below) |
| Lazy browser | API-only scenarios never start Chrome | \`DriverHolder\` from the DI deep dive |
| Right parallelism | measure with \`timeline\` | stop increasing when per-scenario duration rises |
| Push checks down the pyramid | biggest long-term gain | validation rules (postal-code boundaries) belong in API or component tests, one UI scenario proves the wiring |

A simple, honest test-impact rule in CI (illustrative):

\`\`\`bash
CHANGED=$(git diff --name-only origin/main...HEAD)
TAGS="@smoke"
echo "$CHANGED" | grep -q 'cart'     && TAGS="$TAGS or @cart"
echo "$CHANGED" | grep -q 'checkout' && TAGS="$TAGS or @checkout"
mvn -B verify -Dcucumber.tags="($TAGS) and not @wip and not @quarantine"
\`\`\`

It is a heuristic — the nightly full regression is the safety net that catches what the mapping misses.

## Troubleshooting parallel and report problems

| Symptom | Likely cause | How to confirm / fix |
|---|---|---|
| Console logs from scenarios interleave | your loggers print live from many threads (formatters are ordered, your logs are not) | MDC with scenario id + thread in the log pattern; per-scenario detail via \`scenario.log\`; \`progress\` + \`summary\` instead of \`pretty\` in CI |
| \`pretty\` output appears only at the end | expected: ordered \`EventListener\` formatters are buffered in parallel runs | not a bug; use \`timeline\` or a \`ConcurrentEventListener\` for live progress |
| Report file empty or missing | run killed (CI timeout, fork timeout) before \`TestRunFinished\`; build stopped before report plugin; two runners/forks writing the same path; 0 scenarios selected | check the build log tail for timeouts; Failsafe + \`post-integration-test\`; unique paths; log the effective tag expression; \`messages.ndjson\` is written incrementally and survives partially |
| Screenshots missing in Allure/masterthought but present in HTML | attached outside the scenario, wrong media type, or the reporter reads a different file (rerun overwrote JSON) | attach in \`@AfterStep\`/\`@After\`; \`image/png\`; separate rerun report paths |
| Duplicate / collapsed scenario names in the CI test tab | outline examples or same-named scenarios in different features produce identical JUnit names | \`cucumber.junit-platform.naming-strategy=long\`; unique scenario names (the Gherkin parser does not enforce them); example names via \`<placeholder>\` in the outline title |
| Parallel enabled but everything still runs on one thread | property misspelt, set in \`cucumber.properties\` (not read by the engine), or overridden; TestNG: \`thread-count\` set instead of \`dataproviderthreadcount\` | print \`Thread.currentThread().getName()\` in a hook; check the \`timeline\` report |
| Random failures only in parallel | shared statics, shared server data, \`@BeforeAll\` per fork resetting data | see the thread-safety table; reproduce with parallelism 2 and two specific scenarios |
| Rerun suite runs nothing / everything | wrong rerun path; JUnit Platform engine < 7.28 (files unsupported); \`cucumber.features\` set alongside suite selectors | check the version; \`@SelectFile\`; separate execution |

## Best practices for experienced engineers

- One empty suite class; overridable configuration in \`junit-platform.properties\`; selection from CI as system properties mapped through Failsafe.
- Fixed parallelism per agent type, tuned with the \`timeline\` report; exclusive resources instead of disabling parallelism.
- Every runner, fork and rerun writes to **its own** report paths; archive \`messages.ndjson\` always.
- Evidence via \`scenario.attach\` in hooks so every reporter gets it; keep attachments small.
- Rerun at most once, keep the first-run report, publish the flaky list; quarantine with owner and expiry.
- Fail on "0 scenarios"; dry-run gate on PRs; catch-all shard when splitting by tags.
- On 7.x TestNG: stay stable, but build nothing new on \`cucumber-testng\`; the 8.x path is the JUnit Platform engine.

## Equivalent in the other stack

Playwright Test has most of this built in: \`workers\` and \`fullyParallel\` instead of the engine pool, \`test.describe.configure({ mode: 'serial' })\` roughly where \`same_thread\`/exclusive resources are used, \`--shard=i/n\` plus \`merge-reports\` instead of tag shards and masterthought, \`retries\` with a first-class "flaky" status instead of rerun files, and \`--pass-with-no-tests\` being opt-in (no tests fails by default). \`pw-deep-config-environments-ci\` and \`pw-deep-reporting-debugging\` cover them; with \`playwright-bdd\` the Cucumber feature files run on exactly that machinery.

## Interview questions

### Q: How do you run Cucumber-JVM scenarios in parallel, and which model do you choose?

**Short answer (30–60 s):** Cucumber parallelises scenarios, never steps. On the JUnit Platform engine I enable \`cucumber.execution.parallel.enabled\` with a \`fixed\` strategy sized to the agent; on TestNG I make \`scenarios()\` a parallel DataProvider and size it with \`dataproviderthreadcount\`. Beyond one machine I shard by capability tags in CI. I choose the JUnit Platform engine for new work because 8.0 deprecates the TestNG and JUnit 4 runners.

**Detailed answer:** The engine gives me \`dynamic\`/\`fixed\`/\`custom\` strategies, feature-level mode (\`execution-mode.feature=same_thread\`) and exclusive resources by tag, so I can keep three data-resetting scenarios serial without slowing the other 400. TestNG's provider pool has none of that. Forks add process isolation but are per class and duplicate \`@BeforeAll\`. Shards scale horizontally; each shard gets its own ShopEasy servers, and a catch-all shard prevents untagged scenarios from being skipped. I size threads by measurement with the \`timeline\` report, not by core count alone.

### Q: What is the difference between \`dynamic\` and \`fixed\`, and does \`fixed.parallelism=4\` guarantee four browsers at most?

**Short answer (30–60 s):** \`dynamic\` multiplies available cores by \`dynamic.factor\` (default 1.0); \`fixed\` uses \`fixed.parallelism\`. Neither strictly guarantees a maximum — the README says even \`max-pool-size\` does not strictly cap concurrently running scenarios.

**Detailed answer:** The ForkJoin pool can add compensating threads when workers block. If I must cap browsers hard (a Grid with four slots), I set \`fixed\` with \`max-pool-size\` equal to parallelism and still protect the resource itself: the Grid queues sessions, or a semaphore in the \`DriverHolder\`. On 8.x the README documents an \`executor-service\` option (\`WORKER_THREAD_POOL\`) that changes the pool type — I'd evaluate it rather than assume.

### Q: How do you keep a few scenarios from running concurrently without disabling parallelism?

**Short answer (30–60 s):** Exclusive resources mapped from tags: \`cucumber.execution.exclusive-resources.<tag>.read-write=RESOURCE\`. Scenarios with that tag lock the resource; \`GLOBAL_KEY\` makes a scenario run alone.

**Detailed answer:** I name resources after what is shared (\`SHOPEASY_ORDERS\`), use \`.read\` for scenarios that only read it so they still run together, and \`GLOBAL_KEY\` only for global mutations like ShopEasy's \`POST /api/reset\`. Each such tag is technical debt with a ticket — the real fix is per-scenario data. The tag in the property is written without \`@\`. TestNG has no equivalent; there I'd split the scenarios into a separate sequential runner.

### Q: Which report is your source of truth, and which reporters do you add?

**Short answer (30–60 s):** Cucumber Messages (\`message:…ndjson\`) is the complete, cross-language record; I archive it always. Built-in \`html\` for humans, \`junit\` for the CI test tab, and Allure when the organisation wants history and defect categories. JSON only for tools that require it, like masterthought.

**Detailed answer:** Messages include the gherkin source, pickles, matched step definitions, hooks and attachments, and are written incrementally, so a killed run still leaves data. JSON is a legacy, fixed shape; in current versions JSON, JUnit XML and HTML come from message-based formatter libraries anyway. Reporter choice is about the audience: masterthought is zero-code and merges shard JSON; Allure gives trends and multi-framework dashboards; Extent fits an existing Extent standard; the public Cucumber Reports service is off for company CI because data leaves the network.

### Q: How do you rerun failed scenarios on the JUnit Platform engine?

**Short answer (30–60 s):** From 7.28.0 the engine supports rerun files: the \`rerun:target/…/rerun.txt\` plugin in the first run, then a separate suite with \`@SelectFile\` on that file and \`@Suite(failIfNoTests = false)\`. Alternatively Surefire/Failsafe \`rerunFailingTestsCount\` with the \`long\` naming strategy.

**Detailed answer:** Before 7.28 the README explicitly said rerun files were unsupported, which is why "\`@rerun.txt\` does nothing on JUnit 5" is a common complaint. The rerun must be a separate execution, the file must end in \`.txt\`, and it needs its own report paths. Surefire reruns are simpler but overwrite Cucumber's report files, so flakiness is only visible in Surefire XML. On TestNG it's the familiar \`features = "@target/rerun.txt"\` runner.

### Q: What is your policy for scenarios that pass on rerun?

**Short answer (30–60 s):** Flaky, not passing. One rerun is allowed to protect the pipeline, but every first-attempt failure is recorded and reviewed; repeat offenders are quarantined with an owner and an expiry.

**Detailed answer:** I keep the first-run report, diff it with the rerun report to get the flaky list, and trend first-attempt pass rate. Quarantine is a tag excluded from gating runs but still executed nightly so we know when it's fixed. Retries without this bookkeeping turn real intermittent product bugs (race conditions in checkout) into invisible noise. The investigation itself follows the reproduce–classify–evidence–isolate workflow.

### Q: Why might \`-Dcucumber.filter.tags\` be ignored in your Maven build?

**Short answer (30–60 s):** Either the property never reaches the forked test JVM, or something with higher precedence overrides it — typically a \`@ConfigurationParameter\` on the suite class.

**Detailed answer:** Maven's \`-D\` sets a property in the Maven process; the forked test JVM receives it because Surefire/Failsafe forward user properties, but a pom that also maps the same key through \`systemPropertyVariables\` (or a differently named Maven property) makes the effective value unclear — one documented knob is deterministic. On the JUnit Platform, launcher configuration parameters from the suite beat system properties, which beat \`junit-platform.properties\`. So I keep the suite class empty, map a Maven property in Failsafe, and log the effective tag expression at run start. Also: \`-Dcucumber.options\` is pre-7 and does nothing.

### Q: How do you make screenshots show up in HTML, Allure and masterthought alike?

**Short answer (30–60 s):** Attach via \`scenario.attach(bytes, "image/png", name)\` in a hook on the scenario's thread; every reporter is a plugin on the same event bus and receives the \`EmbedEvent\`.

**Detailed answer:** Evidence attached from a TestNG listener or another thread never reaches Cucumber's reporters. I capture in \`@AfterStep\` when failed, before the driver is disposed, guard capture with try/catch so a dead browser doesn't mask the failure, and keep images small because JSON embeds base64. I also attach the URL and \`sessionStorage['shopeasy.cart']\` for ShopEasy — the cart state answers half of all checkout failures.

## Scenario-based questions

### The nightly regression went from 40 to 70 minutes after enabling parallelism "to speed it up"

I'd open the \`timeline\` report first: if lanes show long gaps, a \`GLOBAL_KEY\` exclusive resource or \`same_thread\` mode is serialising work; if every scenario got slower, the agent or ShopEasy backend is saturated (CPU at 100 %, many Chromes swapping). I'd check the effective parallelism (thread names in logs), compare per-scenario durations at parallelism 1, 2, 4, 8, and choose the knee of the curve. Then remove serialisation causes (replace resets with unique data) and, if one agent is maxed out, shard by tag across agents instead of adding threads.

### The release manager says the Jenkins report is "sometimes empty" on failed builds

Empty precisely on failures points to lifecycle: the build stops in Surefire's \`test\` phase before the report plugin, or the CI timeout kills the JVM before \`TestRunFinished\` writes HTML/JSON. I'd move the suite to Failsafe with report generation in \`post-integration-test\`, publish in a \`finally\`/\`post { always }\` block with \`allowMissing\`, give the job timeout headroom above Failsafe's own timeouts, and archive \`messages.ndjson\` which is written incrementally. Also check that the rerun did not overwrite the main report path.

### The team must upgrade to Cucumber 8.x and the suite is a TestNG runner with parallel DataProvider and a TestNG retry analyzer

I'd present a two-step plan: on 7.34.x, introduce the JUnit Platform engine suite next to the TestNG runner, move configuration to \`junit-platform.properties\`, map TestNG listeners' responsibilities to Cucumber plugins/hooks (evidence, summaries), and replace the retry analyzer with the rerun suite. Run both in CI for a week comparing counts and durations. Then switch, delete \`cucumber-testng\`, and upgrade to 8.x (Java 17 baseline, JUnit Platform 6). The risk is low because glue and features do not change — only the runner and build wiring.

## Tricky follow-ups

- **Q: Does \`cucumber.properties\` configure the JUnit Platform engine's parallelism?** No — the engine reads JUnit configuration parameters (\`junit-platform.properties\`, suite parameters, system properties).
- **Q: Does \`thread-count\` in \`testng.xml\` control parallel Cucumber scenarios?** No — the data-provider pool does: \`data-provider-thread-count\` or Surefire's \`dataproviderthreadcount\`.
- **Q: In a parallel run, why does \`pretty\` print everything at the end?** It is an ordered \`EventListener\`; events are buffered and delivered in canonical order.
- **Q: Two Surefire forks, each with \`@BeforeAll\` calling \`POST /api/reset\` — how often does it run?** Once per JVM, so twice, and the second reset can wipe the first fork's state mid-run.
- **Q: Does the rerun file contain outline examples or whole outlines?** Individual pickles by line, so only the failed example rows are rerun.`,
  keyPoints: [
    'Cucumber parallelises scenarios: JUnit Platform engine (strategy dynamic/fixed/custom, feature-level same_thread mode, exclusive resources by tag), TestNG DataProvider threads (dataproviderthreadcount), Surefire/Failsafe forks (per class) and CI shards by tag.',
    'Recommended: JUnit Platform engine with fixed parallelism tuned via the timeline report, exclusive resources for the few serial scenarios, tag shards (with a catch-all) when one agent is not enough; 8.0 deprecates cucumber-testng and cucumber-junit for removal.',
    'Thread safety: per-scenario DI state, one driver per scenario, unique server data, unique report paths per runner/fork; @BeforeAll runs once per JVM, so forks and shards multiply it.',
    'Messages (NDJSON) is the complete, incremental source of truth; html + junit always; JSON only for masterthought-style tools; Allure for history; never publish to the public service from company CI without approval.',
    'scenario.attach in a hook on the scenario thread feeds every reporter through the event bus; keep attachments small (base64 in JSON).',
    'Reruns: TestNG/CLI use features = "@rerun.txt"; JUnit Platform supports rerun files since 7.28.0 via a separate @SelectFile suite with failIfNoTests = false, or Surefire/Failsafe rerunFailingTestsCount with the long naming strategy.',
    'Pass-on-rerun means flaky: rerun once, keep the first-run report, quarantine with owner and expiry.',
    'CI gates: dry-run on PRs, fail on zero selected scenarios (@Suite failIfNoTests, --fail-if-no-tests in 8.1 CLI), Failsafe so reports are generated before the build fails.',
  ],
  mistakes: [
    'Putting cucumber.filter.tags in a @ConfigurationParameter on the suite, then wondering why -D tags from Jenkins are ignored. Fix: keep the suite class empty, put defaults in junit-platform.properties, map a Maven property through Failsafe systemPropertyVariables, and log the effective tag expression.',
    'Using @target/rerun.txt on a JUnit Platform engine older than 7.28 and getting either nothing or the full suite. Fix: upgrade and use a separate suite with @SelectFile("target/.../rerun.txt") and failIfNoTests = false, or use Surefire/Failsafe rerunFailingTestsCount with the long naming strategy.',
    'Main run and rerun (or two forks) writing the same report files, so the dashboard shows only the last attempt. Fix: distinct paths per runner/fork, rerun reports under rerun-*, and merge JSON/Allure results afterwards.',
    'Report plugin bound after Surefire\'s test phase, so the report is missing exactly on failed builds. Fix: run the suite with Failsafe and generate reports in post-integration-test, publish in a finally/post-always block.',
    'Splitting the suite into tag shards without a catch-all, so newly added scenarios without a capability tag never run. Fix: add a shard with not (union of shard tags) and alert when it is non-empty.',
    'Enabling parallelism while a @Before or @BeforeAll hook calls POST /api/reset. Fix: reset once per environment (per CI job with its own ShopEasy servers), give scenarios unique users, and lock any remaining resetting scenario with an exclusive resource on GLOBAL_KEY.',
  ],
  tryIt: `Against ShopEasy (web \`npm run dev\` on http://localhost:5180/practice-site/, API \`npm run api\` on http://localhost:5181): (1) write \`junit-platform.properties\` with \`fixed\` parallelism 2, the \`timeline\`, \`message\`, \`html\`, \`junit\` and \`rerun\` plugins, and the \`long\` naming strategy; (2) tag one API scenario \`@resets-data\` (it calls \`POST /api/reset\`) and map that tag to \`GLOBAL_KEY\`; open the timeline report and confirm it ran alone; (3) add an \`@AfterStep("@ui")\` hook that attaches a screenshot, the URL and \`sessionStorage['shopeasy.cart']\` on failure, break one cart assertion on purpose (expect "Pulse Bike Light" when the cart holds "Trailblazer Backpack") and check the attachment appears in the HTML report and in the JSON; (4) create a rerun suite with \`@SelectFile\` and \`failIfNoTests = false\`, run it twice — once after the broken run, once after fixing — and compare the reports; (5) run \`mvn verify -Dcucumber.tags="@regresion"\` (typo) and make sure your setup fails instead of reporting green.`,
  problems: ['cuc-010', 'cuc-039', 'cuc-040'],
}
