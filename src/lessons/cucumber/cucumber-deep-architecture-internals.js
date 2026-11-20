export default {
  slug: 'cucumber-deep-architecture-internals',
  category: 'cucumber',
  order: 11,
  title: 'Deep dive: how Cucumber-JVM works — Gherkin parsing, pickles, glue, step matching and the event bus',
  minutes: 30,
  summary: 'Follow a .feature file through Cucumber-JVM like a framework owner — Gherkin parser and AST, pickles (outline rows, Background and Rule steps, inherited tags), glue discovery and the Java backend with its ObjectFactory, how a step is matched (Cucumber expression vs regex, undefined, ambiguous, duplicate), the per-scenario lifecycle, result statuses and what fails the build, the event bus with a custom slow-step plugin, Cucumber Messages, the module landscape, choosing a runner (including the Cucumber 8 deprecations), configuration precedence, dry-run and reading a Cucumber stack trace.',
  manualAnalogy: `When a manual test lead receives a test plan, they do not "run the document": they split it into individual executable test cases, assign each one to a tester who knows how to perform every step, watch progress on a board and collect the results into a report. Cucumber does exactly that with a feature file — it compiles it into executable cases (pickles), finds the "tester" for every step (a step definition in the glue), executes each case in a fresh context, and broadcasts every start and finish to whoever is listening (reports, plugins). Knowing those stages is what lets you explain an undefined step, a hook that never runs or a report that is empty.`,
  body: `## Where the earlier lessons stop

The beginner lessons taught how to *use* Cucumber: writing Gherkin (\`gherkin-from-manual-test-case\`, \`declarative-gherkin-and-anti-patterns\`, \`background-and-scenario-outline\`, \`gherkin-rules-docstrings-living-docs\`), step definitions and Cucumber expressions (\`step-definitions-and-cucumber-expressions\`), DataTables, tags, hooks, PicoContainer and the runner with reports and rerun (\`cucumber-runner-reports-rerun\`). The debugging lesson \`debug-cucumber-glue-errors\` lists symptoms of undefined and ambiguous steps.

This lesson explains **what happens inside Cucumber-JVM** between \`mvn test\` and the HTML report, so you can reason about failures instead of pattern-matching them. Three later deep dives go deeper on neighbouring topics and are not repeated here: \`cucumber-deep-steps-parameter-types-datatables\` (designing step libraries, custom parameter types, DataTable transformers), \`cucumber-deep-dependency-injection-hooks\` (PicoContainer vs Spring vs Guice, hook design) and \`cucumber-deep-execution-reporting-parallel\` (parallel execution, reporting stacks, rerun strategies in CI). Parallelism with Selenium is in \`selenium-deep-parallel-execution\`; Screenplay with Cucumber is in \`pom-deep-screenplay-pattern\`.

Baseline: **Cucumber-JVM 7.x**, Java 17. Where Cucumber 8 (released September 2026) changes something relevant, it is called out.

## The pipeline at a glance

\`\`\`
 .feature files ─┐
                 │ 1. Gherkin parser            (per file, language from "# language:" or default en)
                 ▼
          GherkinDocument (AST)                 Feature → Background / Rule / Scenario / Examples, with ids
                 │ 2. Pickle compiler
                 ▼
             Pickles                            one executable scenario each: name, steps, tags, uri, ast ids
                 │ 3. Filters                   tags, names, lines (features/rerun), order
                 ▼
 glue packages ─► 4. Backend loads glue         step definitions, hooks, parameter types, transformers
                 │ 5. Matching                  each pickle step → exactly one step definition (or undefined/ambiguous)
                 ▼
            TestCases                           [hooks] + [matched steps] + [step hooks]
                 │ 6. Execution                 ObjectFactory.start() → steps → ObjectFactory.stop()
                 ▼
 Event bus  ───► 7. Plugins                     pretty, html, json, junit, rerun, message, your own plugin
\`\`\`

Every stage has a typical failure: a parser error (stage 1), a scenario that is "not found" because of the filter (3), a hook class outside the glue (4), undefined/ambiguous steps (5), shared state across scenarios (6), an empty or broken report (7). When something goes wrong, the first senior move is to name the stage.

## From .feature file to pickles

### Parsing: the GherkinDocument

The Gherkin parser (the \`io.cucumber:gherkin\` library, shared across Cucumber implementations) tokenises each \`.feature\` file line by line and builds an **abstract syntax tree** called a \`GherkinDocument\`: a \`Feature\` with tags, description and children — \`Background\`, \`Scenario\` (Scenario Outline is a Scenario with \`Examples\`) and \`Rule\` (which can contain its own Background and scenarios). Every node gets an **id** and keeps its **location** (line, column).

The parser is strict about structure and loose about content: it does not care what the step text says, only that keywords, indentation-independent structure, tables and Doc Strings are well formed. A parse error ("expected: #EOF, #TableRow, #DocStringSeparator…, got 'Scenario Outlin: …'") stops that file before anything runs — so a typo in a keyword fails loudly, but a typo in a step text only shows up at matching.

### Compiling: pickles

The AST is not executable — a Scenario Outline is a template and a Background is not a test. The **pickle compiler** turns each executable unit into a flat **pickle**:

- **one pickle per Scenario**, and **one pickle per Examples row** of a Scenario Outline; placeholders (\`<sort>\`) are substituted in step text, DataTable cells, Doc Strings *and the scenario name*;
- **Background steps are prepended** — the Feature's Background first, then the Rule's Background, then the scenario's own steps; a Background is copied into every pickle, it is not "run once";
- **tags are inherited** — Feature tags + Rule tags + Scenario tags + Examples tags all end up on the pickle;
- the pickle keeps the **uri** and the ids of the AST nodes it came from (\`astNodeIds\`), which is how reports and the rerun file point back to the exact line — for an outline row, that is the line of the Examples row.

A ShopEasy example:

\`\`\`gherkin
@catalogue
Feature: Sorting the catalogue

  Background:
    Given the shopper is logged in as "standard_user"

  @smoke
  Scenario: Default order is alphabetical
    Then the first product shown is "Classic Crew T-Shirt"

  Scenario Outline: Sorting by <option> puts "<first>" first
    When the shopper sorts products by "<option>"
    Then the first product shown is "<first>"

    Examples:
      | option              | first               |
      | Price (low to high) | Junior Onesie       |
      | Price (high to low) | Storm Fleece Jacket |
\`\`\`

The compiler produces **three** pickles:

| Pickle name | Steps (after compilation) | Tags | Source line |
|---|---|---|---|
| Default order is alphabetical | Given …logged in as "standard_user" · Then …first product shown is "Classic Crew T-Shirt" | @catalogue @smoke | Scenario line |
| Sorting by Price (low to high) puts "Junior Onesie" first | Given … · When …sorts products by "Price (low to high)" · Then … "Junior Onesie" | @catalogue | first Examples row |
| Sorting by Price (high to low) puts "Storm Fleece Jacket" first | Given … · When … "Price (high to low)" · Then … "Storm Fleece Jacket" | @catalogue | second Examples row |

(\`inventory.html\` sorts by "Name (A to Z)" on load, so "Classic Crew T-Shirt" is first by default; Junior Onesie at $7.99 is the cheapest product and Storm Fleece Jacket at $49.99 the most expensive.)

Consequences seniors use every day:

- **Tag filters, name filters and line filters operate on pickles**, not on the AST. \`@smoke\` selects one pickle above; \`features/catalogue/sorting.feature:17\` (the first Examples row; line 16 is the header) runs exactly one outline row.
- **Report counts are pickle counts.** "Why does the report say 312 scenarios when we wrote 90?" — outlines.
- A Background step that fails fails **every** pickle of that feature, and appears in every one of them in the report.
- Recent versions of Gherkin also classify pickle steps as *context*, *action* or *outcome* (from Given/When/Then, with And/But inheriting the previous keyword). Matching itself still ignores the keyword — see below.

## Glue discovery and the Java backend

### What "glue" is and how it is found

Glue is everything Cucumber needs to execute pickles: **step definitions**, **hooks** (\`@Before\`, \`@After\`, \`@BeforeStep\`, \`@AfterStep\`, \`@BeforeAll\`, \`@AfterAll\`), **parameter types** (\`@ParameterType\`), **DataTable/DocString types** and **default transformers**. The **Java backend** (\`cucumber-java\`) finds glue by **scanning the classpath** for classes in the configured glue packages and reflecting over their methods for Cucumber annotations. Each annotated method becomes a registered definition in the glue registry.

That explains the beginner rule "steps must be in glue packages": there is no magic link from a feature file to a class. If \`com.shopeasy.hooks\` is not under a glue package, its \`@Before\` is never registered and the driver is never created — and nothing fails until a step uses a null driver.

| Glue configuration | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| Specific packages (\`com.shopeasy.steps\`, \`com.shopeasy.hooks\`, \`com.shopeasy.support\`) | scans only those packages | fast scan, explicit | easy to forget a new package | small suites with stable package layout |
| One common parent (\`com.shopeasy.glue\`) | scans the package and sub-packages | new sub-packages are picked up automatically | must keep non-glue classes (page objects) out of it, or they are scanned too | recommended default |
| Nothing set | TestNG/JUnit 4 runner: the runner class's package; JUnit Platform engine: scans broadly | zero config | slow scans, surprising glue from other modules | never on a real project |
| Individual classes (\`cucumber.glue.classes\`, Cucumber 8.0+) | registers listed classes, no scanning | precise, fast | verbose; 8.x only | big monorepos where scanning is costly |

**Recommended approach and why:** one dedicated parent package for glue only (\`com.shopeasy.glue.steps\`, \`.hooks\`, \`.types\`), with page objects and API clients in a different package tree. Scanning stays cheap, new step classes are picked up automatically, and a page object can never accidentally become glue. Cucumber 8.0 also prints a hint when glue is not efficiently configured.

### Registration-time errors

Some problems are detected when glue loads, before any scenario runs:

- **Duplicate step definition** — two methods with the *same expression text* (for example \`@Given("the cart is empty")\` and \`@Then("the cart is empty")\`). Because the keyword is not part of the match, these are duplicates; Cucumber refuses to start (\`DuplicateStepDefinitionException\`).
- **Duplicate parameter type name** — two \`@ParameterType\` methods named \`product\`. Cucumber 8.0 reports the source location of both definitions.
- **Invalid expression** — an unbalanced \`(\` or an unknown \`{type}\` in an annotation (\`UndefinedParameterTypeException\`).

### The ObjectFactory: a new instance of each step class per scenario

Step definitions are **instance methods**, so Cucumber needs objects to call them on. The backend delegates that to an **ObjectFactory** (\`io.cucumber.core.backend.ObjectFactory\`): \`addClass\` is called for every glue class at load time, then for each scenario Cucumber calls \`start()\`, asks \`getInstance(StepClass.class)\` lazily whenever a step or hook of that class is about to run, and calls \`stop()\` at the end of the scenario.

- Without a DI module, the default factory in \`cucumber-java\` creates instances with the **public no-argument constructor**, one per class per scenario. A constructor with parameters fails with an error that tells you to add a DI module.
- With \`cucumber-picocontainer\`, \`cucumber-spring\` or \`cucumber-guice\` the factory injects constructor parameters (a \`TestContext\`, page objects) and still scopes everything to one scenario. Only **one** ObjectFactory may be on the classpath; with several, select one with \`cucumber.object-factory\`.
- **Instance fields are reset for every scenario** because the instance is new. **Static fields are not** — they live as long as the class loader, which is why a static \`WebDriver\` or a static "current user" leaks between scenarios and breaks in parallel.

Choosing and wiring a DI container is the subject of \`cucumber-deep-dependency-injection-hooks\`; what matters here is the mechanism: **scenario = one ObjectFactory start/stop cycle**.

## Step matching

### The algorithm

For each pickle step, Cucumber:

1. takes the **step text without the keyword** (\`the shopper sorts products by "Price (low to high)"\`);
2. tries **every** registered step definition's expression against the **whole** text;
3. counts the matches:
   - **0** → the step is **undefined**; Cucumber generates **snippets** (published as a \`SnippetsSuggestedEvent\`) and the runner reports an undefined-step failure;
   - **1** → arguments are extracted and converted through the **parameter type registry**, and the method is bound to this step;
   - **more than 1** → **ambiguous** (\`AmbiguousStepDefinitionsException\`), listing every matching definition — Cucumber never picks "the best" one.

The keyword is ignored: \`@Given("the cart is empty")\` matches \`Then the cart is empty\`. Use the right annotation for readability and snippets, but never rely on it to disambiguate.

### Cucumber expression or regular expression?

In Java, the decision is made from the annotation string itself: if it **starts with \`^\` or ends with \`$\`** (or is wrapped in \`/…/\`), it is treated as a **regular expression**; otherwise it is a **Cucumber expression**. In current versions of the cucumber-expressions library, both kinds are matched against the **entire** step text, so an expression cannot match "half a step"; anchors in regexes are still the convention and are what tells Cucumber that the string is a regex.

| | Cucumber expression | Regular expression |
|---|---|---|
| Example | \`the shopper sorts products by {string}\` | \`^the shopper sorts products by "([^"]*)"$\` |
| Parameters | named types from the registry: \`{int}\`, \`{string}\`, \`{word}\`, \`{bigdecimal}\`, \`{}\`, custom \`{product}\` | capture groups; converted by parameter type whose regexp matches the group, else by method parameter type |
| Optional / alternative text | \`item(s)\`, \`a/an\` | \`items?\`, \`an?\` |
| Readability | close to the Gherkin | noisy |
| Typical bug | \`{}\` swallowing too much, creating ambiguity | unescaped \`.\` or \`(\`, greedy \`.*\` |
| Use when | always by default | a pattern the expression syntax cannot express |

Designing parameter types and step libraries belongs to \`cucumber-deep-steps-parameter-types-datatables\`; the internal point here is that parameter types are a **registry**: built-in types plus every \`@ParameterType\` in the glue, each with a regexp and a transformer. A Cucumber expression is compiled into a regex built from the registered types' regexps; a match is then converted group by group.

### Why ambiguity happens

Ambiguity is almost always a **second, more general definition**:

\`\`\`java
// InventorySteps.java
@When("the shopper sorts products by {string}")
public void sortsBy(String option) { ... }

// LegacySteps.java (from an older feature area)
@When("the shopper sorts products by {}")
public void sortBy(String anything) { ... }
\`\`\`

\`{}\` (anonymous) matches anything, including \`"Price (low to high)"\` with its quotes, so both match. Other classic sources: an optional part that makes two expressions overlap (\`the cart contains {int} item(s)\` vs \`the cart contains {int} items\`), a regex with \`.*\`, and two modules both put on the glue path with a shared steps library. Fix by deleting the general one or making the expressions disjoint, never by renaming one Gherkin line to dodge it.

The message has this shape (abbreviated):

\`\`\`text
io.cucumber.core.runner.AmbiguousStepDefinitionsException: "the shopper sorts products by "Price (low to high)"" matches more than one step definition:
  "the shopper sorts products by {string}" in com.shopeasy.glue.steps.InventorySteps.sortsBy(java.lang.String)
  "the shopper sorts products by {}" in com.shopeasy.glue.steps.LegacySteps.sortBy(java.lang.String)
\`\`\`

### Undefined steps and snippets

For an undefined step, Cucumber generates a snippet in the configured style (\`cucumber.snippet-type\`: \`underscore\` or \`camelcase\`), guessing parameters from the text (quoted text becomes \`{string}\`, numbers \`{int}\`/\`{double}\`). Snippets are a *starting point*: rename the method, use a domain parameter type, and check whether an existing step already expresses the same behaviour with different words — that is how step explosion starts.

## Execution lifecycle of one scenario

Once every pickle step is matched, Cucumber builds a **TestCase**: an ordered list of **test steps**, where hooks are test steps too (\`HookTestStep\`) next to the pickle steps (\`PickleStepTestStep\`). Executing it follows a fixed timeline:

| # | What runs | Order rule | If it fails |
|---|---|---|---|
| 0 | \`@BeforeAll\` (static, once per run, before the first scenario; Cucumber 7.0+) | ascending \`order\` | the run fails; no scenarios execute |
| 1 | \`ObjectFactory.start()\` — new scenario scope | — | — |
| 2 | \`@Before\` hooks (tag-filtered by the hook's tag expression) | ascending \`order\` (default 10000) | remaining Before hooks and all steps are **skipped**; After hooks still run |
| 3 | Background steps (Feature, then Rule) — just the first pickle steps | source order | following steps are **skipped** |
| 4 | for each step: \`@BeforeStep\` → step → \`@AfterStep\` | BeforeStep ascending, AfterStep descending | after a failure, later steps (and their step hooks) are skipped |
| 5 | \`@After\` hooks | **descending** \`order\` | each After hook still runs; failures are added to the result |
| 6 | \`ObjectFactory.stop()\` — scenario objects discarded | — | — |
| 7 | \`@AfterAll\` (static, once, after the last scenario) | descending \`order\` | the run fails |

Two details interviewers like: Background steps are **not** special at run time — they are ordinary steps of every pickle, so \`@BeforeStep\` runs around them too; and \`@After\` runs even when a \`@Before\` hook failed, so teardown must cope with half-initialised state (a null driver).

## Result statuses and what fails the build

| Status | Meaning | Fails the run? |
|---|---|---|
| \`PASSED\` | step/hook completed | no |
| \`SKIPPED\` | not executed because something before it did not pass (or dry-run); also when a step throws an assumption-style skip | no |
| \`PENDING\` | step threw \`PendingException\` (the snippet default) | **yes** |
| \`UNDEFINED\` | no step definition matched | **yes** |
| \`AMBIGUOUS\` | several step definitions matched | **yes** |
| \`FAILED\` | an exception or assertion error | **yes** |
| \`UNUSED\` | a step definition never used (reported by the \`unused\` plugin) | no |

In the plugin API, \`Status.isOk()\` returns true only for \`PASSED\` and \`SKIPPED\`. Strictness is no longer configurable: Cucumber has run in strict mode by default since v6, and v7.0 removed the non-strict option (and the \`cucumber.execution.strict\` property). Old answers like "use \`strict = false\` so pending steps do not break the build" are out of date — use \`@wip\` and a tag filter instead.

## The event bus and plugins

### How reporting really works

Cucumber's runtime **publishes events** to an internal bus; every formatter (\`pretty\`, \`html\`, \`json\`, \`junit\`, \`rerun\`, \`message\`…) is just a **plugin** subscribed to those events. Nothing in the runtime knows about HTML. The main events (\`io.cucumber.plugin.event\`), in order:

| Event | When | Typical use |
|---|---|---|
| \`TestRunStarted\` | once, at start | open files, start timers |
| \`TestSourceRead\` / \`TestSourceParsed\` | per feature file | keep the source for pretty printing / AST access |
| \`StepDefinedEvent\` | per registered step definition | usage and unused-step reports |
| \`TestCaseStarted\` | per pickle, before its first hook | scenario timers, MDC context |
| \`TestStepStarted\` / \`TestStepFinished\` | per hook or step | timing, step logs, slow-step detection |
| \`EmbedEvent\` / \`WriteEvent\` | \`scenario.attach\` / \`scenario.log\` | attachments in reports |
| \`SnippetsSuggestedEvent\` | per undefined step | printing snippets |
| \`TestCaseFinished\` | per pickle | pass/fail lists, rerun file |
| \`TestRunFinished\` | once, at the end | write the report, summaries |

Every event carries an \`Instant\`; \`TestStepFinished\` carries the \`TestCase\`, the \`TestStep\` and a \`Result\` with \`Status\`, \`Duration\` and the error.

### EventListener vs ConcurrentEventListener

| | \`EventListener\` | \`ConcurrentEventListener\` |
|---|---|---|
| Delivery | in **canonical order**; in a parallel run, events are buffered and delivered in order (effectively at the end of the run) | **as they happen**, on the thread that produced them — possibly many threads at once |
| Thread-safety | single-threaded delivery | your handler must be thread-safe |
| Good for | formatters that need a tidy, ordered document (pretty-like output) | live progress, timing, streaming to a dashboard, anything that should not wait for the end |

Both have one method, \`setEventPublisher(EventPublisher)\`, in which you call \`registerHandlerFor(EventClass.class, handler)\`.

### A custom plugin: slow-step reporter (complete code)

Goal on a ShopEasy suite: list every step or hook that took longer than a threshold, with its scenario and feature line, so the team can see that "Given the shopper is logged in" through the UI costs 3 s in 400 scenarios. (A different example — collecting failed scenarios for a summary — is in \`pom-deep-structural-behavioural-patterns\`.)

\`\`\`java
package com.shopeasy.glue.plugins;

import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.HookTestStep;
import io.cucumber.plugin.event.PickleStepTestStep;
import io.cucumber.plugin.event.TestCase;
import io.cucumber.plugin.event.TestRunFinished;
import io.cucumber.plugin.event.TestStep;
import io.cucumber.plugin.event.TestStepFinished;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Lists steps and hooks slower than a threshold.
 * Register with: com.shopeasy.glue.plugins.SlowStepReporter:target/reports/slow-steps.txt
 * Threshold: -Dslowstep.threshold.ms=2000 (default 2000 ms)
 */
public final class SlowStepReporter implements ConcurrentEventListener {

    private static final long DEFAULT_THRESHOLD_MS = 2000;

    private final Path output;
    private final Duration threshold;
    private final Queue<SlowStep> slowSteps = new ConcurrentLinkedQueue<>();

    /** Cucumber passes the text after the colon in the plugin string. */
    public SlowStepReporter(String outputPath) {
        this.output = Path.of(outputPath);
        this.threshold = Duration.ofMillis(Long.getLong("slowstep.threshold.ms", DEFAULT_THRESHOLD_MS));
    }

    @Override
    public void setEventPublisher(EventPublisher publisher) {
        publisher.registerHandlerFor(TestStepFinished.class, this::onStepFinished);
        publisher.registerHandlerFor(TestRunFinished.class, event -> writeReport());
    }

    private void onStepFinished(TestStepFinished event) {
        Duration took = event.getResult().getDuration();
        if (took.compareTo(threshold) < 0) {
            return;
        }
        TestCase testCase = event.getTestCase();
        slowSteps.add(new SlowStep(
                took,
                describe(event.getTestStep()),
                testCase.getName(),
                testCase.getUri() + ":" + testCase.getLocation().getLine(),
                event.getResult().getStatus().name()));
    }

    private static String describe(TestStep step) {
        if (step instanceof PickleStepTestStep pickleStep) {
            return pickleStep.getStep().getKeyword() + pickleStep.getStep().getText();
        }
        if (step instanceof HookTestStep hook) {
            return "hook " + hook.getHookType() + " " + hook.getCodeLocation();
        }
        return step.getCodeLocation();
    }

    private void writeReport() {
        List<SlowStep> sorted = new ArrayList<>(slowSteps);
        sorted.sort(Comparator.comparing(SlowStep::duration).reversed());

        List<String> lines = new ArrayList<>();
        lines.add("Steps and hooks slower than " + threshold.toMillis() + " ms: " + sorted.size());
        for (SlowStep s : sorted) {
            lines.add(String.format("%6d ms  %-7s %s%n           in \\"%s\\" (%s)",
                    s.duration().toMillis(), s.status(), s.step(), s.scenario(), s.location()));
        }
        try {
            Path parent = output.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.write(output, lines, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write slow-step report to " + output, e);
        }
    }

    private record SlowStep(Duration duration, String step, String scenario, String location, String status) { }
}
\`\`\`

Step by step:

1. **\`implements ConcurrentEventListener\`** — we want events as they happen and we do not care about order, so it works with parallel scenarios without buffering.
2. **Constructor \`(String outputPath)\`** — Cucumber instantiates plugins by reflection. For a plugin string \`Class:argument\`, the plugin factory looks for a public constructor taking one of \`String\`, \`File\`, \`URI\`, \`URL\` or \`OutputStream\` (and a deprecated \`Appendable\`); without an argument it uses a no-arg constructor (or an \`OutputStream\` constructor bound to standard output — only one plugin may own stdout).
3. **\`setEventPublisher\`** — the only hook into the runtime: register a handler per event type. Handlers must be fast; they run on the scenario thread.
4. **\`ConcurrentLinkedQueue\`** — handlers are called from several threads in a parallel run; a plain \`ArrayList\` would lose entries or throw.
5. **\`describe\`** — a test step is either a pickle step or a hook; hooks report their code location, which is exactly what you need to find a slow \`@Before\`.
6. **\`TestRunFinished\`** — write once at the end; sorting there keeps the hot path cheap.
7. **Exceptions** — let I/O problems surface. Cucumber 8.0 changed the core to stop swallowing exceptions thrown by plugins, so a broken plugin is visible rather than silently producing nothing.

Registering it (any of these, depending on the runner):

\`\`\`java
// TestNG / JUnit 4 runner
@CucumberOptions(plugin = {"pretty", "html:target/reports/cucumber.html",
        "com.shopeasy.glue.plugins.SlowStepReporter:target/reports/slow-steps.txt"})
\`\`\`

\`\`\`properties
# junit-platform.properties (JUnit Platform) or cucumber.properties (core runners)
cucumber.plugin=pretty, html:target/reports/cucumber.html, com.shopeasy.glue.plugins.SlowStepReporter:target/reports/slow-steps.txt
\`\`\`

Typical output on ShopEasy after a nightly run:

\`\`\`text
Steps and hooks slower than 2000 ms: 3
  3412 ms  PASSED  Given the shopper is logged in as "standard_user"
           in "Sorting by Price (high to low) puts "Storm Fleece Jacket" first" (file:///…/catalogue/sorting.feature:18)
  2210 ms  PASSED  hook BEFORE com.shopeasy.glue.hooks.DriverHooks.startBrowser()
           in "Postal code is required" (file:///…/checkout/checkout_validation.feature:12)
\`\`\`

The action is a design change, not a plugin change: log in by seeding \`sessionStorage\` (\`shopeasy.user\`) for scenarios that are not *about* login (see the *Hooks* lesson's fast-setup idea).

### Three ways to get the same insight

\`\`\`java
// Approach 2 — an @AfterStep hook (needs its own timing: hooks have no step duration)
private long stepStart;   // instance field: the hook class is per scenario

@BeforeStep public void startTimer() { stepStart = System.nanoTime(); }
@AfterStep  public void logSlow(Scenario scenario) {
    long ms = (System.nanoTime() - stepStart) / 1_000_000;
    if (ms > 2000) scenario.log("slow step: " + ms + " ms");
}
\`\`\`

\`\`\`bash
# Approach 3 — post-process the message stream after the run (plugin "message:target/cucumber.ndjson")
# every line is one JSON envelope; testStepFinished envelopes carry testStepResult.duration
jq -c 'select(.testStepFinished) | .testStepFinished.testStepResult.duration' target/cucumber.ndjson | head
\`\`\`

| | Custom plugin (event bus) | \`@BeforeStep\`/\`@AfterStep\` hook | Post-process ndjson messages |
|---|---|---|---|
| How it works | subscribes to runtime events | glue code inside every scenario | reads the message file after the run |
| Advantages | sees hooks *and* steps, real durations, no glue changes, reusable jar | trivial to write, can attach to the scenario report | zero runtime cost, any language, can compare runs |
| Disadvantages | needs registration and thread-safety | cannot see other hooks' timing, its own time is in the measurement, step text not available | only after the run; must understand the message schema |
| Performance | negligible | small per-step overhead | none at run time |
| Maintainability | one class, plugin API is stable | spreads timing logic into glue | script outside the framework |
| Scalability | works with parallel runs (concurrent listener) | works, but logs are per scenario | best for trend analysis across many runs |
| When to use | framework-level cross-cutting reporting | quick, scenario-local evidence | dashboards and historical analysis |

**Recommended approach and why:** a **plugin** for anything framework-wide (timing, custom summaries, pushing results to a dashboard) because it observes the run without touching glue and works with parallel execution; ndjson post-processing for trend analysis across builds; hooks only for evidence that belongs inside one scenario (screenshots, URL).

## Cucumber Messages

Since Cucumber 6/7 every Cucumber implementation (JVM, JS, Ruby…) can describe a run as a stream of **Cucumber Messages**: protocol-buffer-defined objects serialised as **newline-delimited JSON** (one "envelope" per line). Enable with the \`message:target/cucumber.ndjson\` plugin. A run produces envelopes such as \`meta\` (tool versions, CI info), \`source\`, \`gherkinDocument\`, \`pickle\`, \`stepDefinition\`, \`hook\`, \`parameterType\`, \`testRunStarted\`, \`testCase\`, \`testCaseStarted\`, \`testStepStarted\`, \`testStepFinished\`, \`attachment\`, \`testCaseFinished\`, \`testRunFinished\`.

Why it matters for a framework owner:

- The **HTML formatter is built on messages** (it renders the same React report for every Cucumber flavour), and recent versions of the JSON, JUnit XML and TestNG XML formatters are separate message-based libraries, as Cucumber 8.x dependency updates show. Message-based output is the common contract.
- Messages contain **everything**: the original Gherkin, pickles, the step definition that matched each step and its source location, attachments. A custom dashboard can be built from the ndjson file alone, in any language.
- The **legacy \`json\` format** (the one consumed by many Jenkins and Extent integrations) is a fixed, older shape; prefer messages for new tooling.
- Cucumber 8.0 started emitting messages for \`@BeforeAll\`/\`@AfterAll\` hooks too, so global setup time becomes visible in reports.

## Module landscape

| Module (\`io.cucumber:…\`) | Role |
|---|---|
| \`cucumber-core\` | runtime, CLI (\`io.cucumber.core.cli.Main\`), filters, event bus, plugin factory, built-in formatters |
| \`cucumber-java\` (or \`cucumber-java8\` lambdas, now discouraged) | Java backend: annotations, glue scanning, default ObjectFactory |
| \`gherkin\` | parser and pickle compiler (pulled in by core) |
| \`cucumber-expressions\`, \`tag-expressions\` | expression matching and tag filters (pulled in by core) |
| \`messages\` + formatter libraries | message model, html/json/junit-xml formatters |
| \`cucumber-junit-platform-engine\` | runs Cucumber as a JUnit Platform test engine (with \`junit-platform-suite\` for \`@Suite\` classes) |
| \`cucumber-junit\` | JUnit 4 runner \`@RunWith(Cucumber.class)\` |
| \`cucumber-testng\` | TestNG runner \`AbstractTestNGCucumberTests\` |
| \`cucumber-picocontainer\` / \`cucumber-spring\` / \`cucumber-guice\` / \`cucumber-jakarta-cdi\` | ObjectFactory implementations (DI) — choose one |

Keep all \`io.cucumber\` artefacts on the **same version** (import the \`cucumber-bom\` in \`dependencyManagement\`); mixing a 7.x \`cucumber-java\` with another \`cucumber-core\` version produces \`NoSuchMethodError\`s at glue loading.

## Choosing a runner

| | JUnit 4 (\`cucumber-junit\`) | JUnit Platform (\`cucumber-junit-platform-engine\`) | TestNG (\`cucumber-testng\`) | CLI (\`Main\`) |
|---|---|---|---|---|
| How it works | JUnit 4 runner class with \`@CucumberOptions\` | Cucumber is a JUnit Platform *engine*; \`@Suite\` + \`@IncludeEngines("cucumber")\` + configuration parameters | runner class extends \`AbstractTestNGCucumberTests\`; scenarios come from a DataProvider | \`java io.cucumber.core.cli.Main --glue … features\` |
| Status | works in 7.x; **deprecated for removal in 8.0** | **the recommended runner**; actively developed | works in 7.x; **deprecated for removal in 8.0** | supported |
| Parallel | via Surefire forks/JUnit 4 parallel (coarse) | built in (\`cucumber.execution.parallel.*\`), scenario level, exclusive resources by tag | data-provider thread pool | \`--threads\` |
| IDE / build integration | everywhere | IntelliJ, Maven Surefire 3, Gradle | IntelliJ, Surefire, testng.xml | IDE plugins use it |
| Fits when | legacy suites | new projects; mixed JUnit 5 + Cucumber modules | teams whose whole stack is TestNG (listeners, suites, retry) | local tooling, debugging |

**Recommended approach and why:** for a **new** Cucumber 7 project, the **JUnit Platform engine** — it is where Cucumber's development goes, it has the richest parallel model, and since Cucumber 8.0 both the JUnit 4 and the TestNG runners are deprecated for removal. For an **existing TestNG suite** on 7.x there is no emergency: keep it, but plan the migration before upgrading to 8.x and avoid building new framework features on TestNG-only APIs (TestNG listeners) that the JUnit Platform world cannot reuse. The beginner \`cucumber-runner-reports-rerun\` lesson shows both runner shapes.

## Configuration sources and precedence

### Core runners (TestNG, JUnit 4, CLI)

Cucumber builds its runtime options from several sources; **later wins**:

1. \`cucumber.properties\` on the classpath (lowest)
2. \`@CucumberOptions\` on the runner class
3. environment variables (\`CUCUMBER_FILTER_TAGS\` — each property also accepts an upper-case/underscore form)
4. system properties (\`-Dcucumber.filter.tags=…\`) (highest)

For the CLI, command-line arguments override all of them. That order is what makes "one runner class, many Jenkins jobs" work: the runner holds defaults, the job passes \`-Dcucumber.filter.tags\`.

### JUnit Platform engine

The engine reads only **JUnit configuration parameters**: \`@ConfigurationParameter\` on the \`@Suite\` class, \`junit-platform.properties\`, and JVM system properties. JUnit Platform documents the precedence: parameters supplied to the launcher request (which is how \`@Suite\` passes its \`@ConfigurationParameter\`s) win over system properties, which win over \`junit-platform.properties\`. Two practical consequences:

- If \`cucumber.filter.tags\` is fixed in a \`@ConfigurationParameter\`, a \`-Dcucumber.filter.tags\` on the command line will **not** override it. Keep overridable values in \`junit-platform.properties\` and pass overrides as system properties.
- \`cucumber.properties\` is read by the CLI (which IDE plugins use), **not** by the JUnit Platform engine; teams that want one file load it explicitly (\`@ConfigurationParametersResource\` on the suite) — verify against your engine version.
- Setting \`cucumber.features\` makes the engine **ignore JUnit discovery selectors** (\`@SelectClasspathResource\`), which can run features twice when combined with suite selectors. Use it for "run this file:line" from the command line, not in the suite class.

### Properties worth knowing

| Property | Purpose |
|---|---|
| \`cucumber.glue\` | glue packages (comma-separated) |
| \`cucumber.features\` | feature paths, \`file.feature:LINE\`, or \`@target/rerun.txt\` |
| \`cucumber.filter.tags\` | tag expression |
| \`cucumber.filter.name\` | regex on the scenario (pickle) name |
| \`cucumber.plugin\` | comma-separated plugin strings |
| \`cucumber.object-factory\` | ObjectFactory class when several DI modules are present |
| \`cucumber.execution.dry-run\` | match steps without executing |
| \`cucumber.snippet-type\` | \`underscore\` or \`camelcase\` |
| \`cucumber.execution.order\` | \`lexical\`, \`reverse\`, \`random\` (with an optional seed) — core runners: CLI only |
| \`cucumber.publish.enabled\` / \`cucumber.publish.quiet\` | publish to the Cucumber Reports service / silence its banner |
| \`cucumber.ansi-colors.disabled\` | plain console output (what \`monochrome\` does in \`@CucumberOptions\`) |
| \`cucumber.execution.parallel.*\` | JUnit Platform parallelism (see \`cucumber-deep-execution-reporting-parallel\`) |

The removed form \`-Dcucumber.options="--tags @smoke"\` (pre-7) still appears in old wikis; it does nothing useful on 7.x.

**Recommended approach and why:** put stable defaults (glue, plugins, publish quiet) in **one** properties file, keep runner classes almost empty, and pass *selection* (tags, features) from the build/CI as system properties. Log the effective tag expression at run start (a tiny plugin on \`TestRunStarted\`, or the build log) so a "0 scenarios ran" job is diagnosed in seconds. On 8.1+, \`--fail-if-no-tests\` exists for the CLI to fail a run that selected nothing — check whether your runner exposes an equivalent before relying on it.

## Dry-run: matching without executing

\`cucumber.execution.dry-run=true\` (or \`dryRun = true\`) runs stages 1–5 and reports every step as matched (\`SKIPPED\`), **undefined** or **ambiguous** without calling step or hook methods — so no browser starts. A dry-run of a 600-scenario ShopEasy suite takes seconds.

Senior uses:

- a **fast CI gate** on feature-file PRs: a BA or tester changes wording in a \`.feature\` file; the dry-run job fails in under a minute if a step no longer matches, long before the nightly run;
- a **filter preview**: combine with a tag expression and the \`pretty\` or \`summary\` plugin to see exactly which scenarios a new CI job would select;
- **step usage**: the \`usage\` plugin (and \`unused\` in recent versions) shows which step definitions are used, how often and which are dead — input for cleaning a step library.

Limits: dry-run proves *matching*, not *conversion at run time* of every argument, and never executes hooks — a hook outside the glue is not detected.

## Debugging Cucumber

### Breakpoints

- Put breakpoints in **step definitions and hooks**, not in feature files (some IDE plugins allow feature-line breakpoints, but they map to the step method anyway).
- To debug one scenario: run its \`file.feature:LINE\` from the IDE gutter, or \`-Dcucumber.features=src/test/resources/features/checkout/checkout_validation.feature:21\`, or \`-Dcucumber.filter.name="Postal code is required"\`.
- Disable parallelism and retries while debugging; run headed.
- To debug matching itself (why is this ambiguous?), set a breakpoint on the exception constructor or simply read the message: it lists every matching definition with its class and method.

### Reading a Cucumber stack trace

\`\`\`text
org.opentest4j.AssertionFailedError: first product ==> expected: <Junior Onesie> but was: <Classic Crew T-Shirt>
    at org.junit.jupiter.api.AssertionFailureBuilder.build(AssertionFailureBuilder.java:151)
    at org.junit.jupiter.api.Assertions.assertEquals(Assertions.java:1145)
    at com.shopeasy.glue.steps.InventorySteps.firstProductIs(InventorySteps.java:41)
    at ✽.the first product shown is "Junior Onesie"(file:///…/features/catalogue/sorting.feature:13)
\`\`\`

Read it bottom-up for *where*, top-down for *what*:

1. The **\`✽.\` frame** is synthetic — Cucumber adds it to point at the **Gherkin step and line**. For an outline, the step text shows substituted values.
2. The frame above it is your **step definition** (class, method, line) — the first place to look.
3. Frames above that are your page objects and libraries; frames *below* the \`✽\` line (runner, reflection, JUnit/TestNG internals) are noise and usually trimmed.
4. The first line is the actual failure — an assertion (behaviour mismatch) or a Selenium exception (synchronisation, locator).

If the failing frame is a **hook** (\`DriverHooks.startBrowser\`), every step will show as skipped: the problem is environment or setup, not the scenario.

## Equivalent in the Playwright/TypeScript world

\`cucumber-js\` has the same architecture — Gherkin parser, pickles, support code (its "glue"), a per-scenario \`World\` instead of an ObjectFactory, the same Cucumber Messages and formatters (see \`pw-cucumber-with-playwright\`). The other route is \`playwright-bdd\`, which *generates* Playwright Test files from feature files so you keep Playwright fixtures, projects and the trace viewer; its step matching uses the same Cucumber expressions.

## Interview questions

### Q: What is a pickle, and why does Cucumber need it?
**Short answer (30–60 s):** A pickle is the compiled, executable form of one scenario: Background steps prepended, outline placeholders substituted, tags inherited, with a link back to the source lines. Cucumber filters, matches and runs pickles, not the raw AST.

**Detailed answer:** The parser builds a \`GherkinDocument\`; the pickle compiler produces one pickle per Scenario and per Examples row, copying Feature and Rule Background steps in front and merging Feature/Rule/Scenario/Examples tags. That is why a Background failure fails every scenario, why the report counts outline rows as scenarios, and why \`file.feature:LINE\` can target a single Examples row. Each pickle step is matched to a step definition, wrapped with hooks into a \`TestCase\`, and executed.

### Q: Walk me through how Cucumber matches a step to a step definition.
**Short answer (30–60 s):** It strips the keyword, tries every registered expression against the whole text, and requires exactly one match: zero is undefined (snippets suggested), more than one is ambiguous. One match: arguments are converted through the parameter type registry and the method is invoked on a per-scenario instance.

**Detailed answer:** In Java, an annotation string starting with \`^\` or ending with \`$\` is a regex, otherwise a Cucumber expression, compiled to a regex from the registered parameter types. The keyword is not part of the match, so \`@Given\` and \`@Then\` with the same text are duplicates and Cucumber refuses to start. Ambiguity usually comes from a general expression (\`{}\` or \`.*\`) overlapping a specific one; I fix it by removing or narrowing the general one, never by rewording Gherkin around it.

### Q: How are step definition classes instantiated, and what does that mean for state?
**Short answer (30–60 s):** Through an ObjectFactory, one instance per class per scenario, created lazily. Instance fields are therefore scenario-scoped; static fields leak across scenarios and threads.

**Detailed answer:** The default factory needs a public no-arg constructor. DI modules (PicoContainer, Spring, Guice) replace it, injecting shared per-scenario objects such as a \`TestContext\`; only one may be active (\`cucumber.object-factory\` selects). The factory's \`start()\`/\`stop()\` bracket each scenario, which is the natural place for per-scenario resources. Anything static — a driver, a "current order id" — breaks isolation and parallel runs.

### Q: In what order do hooks and steps run, and what happens on failure?
**Short answer (30–60 s):** \`@BeforeAll\` once; per scenario: \`@Before\` ascending order, Background then scenario steps each wrapped in \`@BeforeStep\`/\`@AfterStep\`, then \`@After\` descending; \`@AfterAll\` once at the end. After a failure the remaining steps are skipped, but \`@After\` hooks always run.

**Detailed answer:** Hooks are test steps in the TestCase, so they appear in reports and plugins see their durations. A failing \`@Before\` skips all steps but still runs \`@After\`, so teardown must handle a null driver. Default order is 10000; evidence capture must have a *higher* \`@After\` order than the hook that quits the browser.

### Q: Which result statuses fail the build in Cucumber 7?
**Short answer (30–60 s):** Failed, undefined, pending and ambiguous. Passed and skipped do not. Strict mode has been the default since v6 and the non-strict option was removed in v7.

**Detailed answer:** \`Status.isOk()\` is true only for PASSED and SKIPPED. If unfinished scenarios must stay in the repository, tag them \`@wip\` and exclude them with the tag expression instead of looking for a non-strict switch. Unused step definitions do not fail the run but can be reported with the \`unused\`/\`usage\` plugins.

### Q: How do reporting plugins work in Cucumber-JVM? Have you written one?
**Short answer (30–60 s):** The runtime publishes events — run started, test case started, step finished, test case finished, run finished — on an event bus; formatters are plugins that subscribe. I write a \`ConcurrentEventListener\` that registers handlers in \`setEventPublisher\` and register it in \`cucumber.plugin\` as \`fully.qualified.Class:argument\`.

**Detailed answer:** \`EventListener\` receives events in canonical order (buffered in parallel runs); \`ConcurrentEventListener\` receives them live from many threads, so state must be thread-safe. The plugin argument is passed to a constructor taking String, File, URI, URL or OutputStream. My example is a slow-step reporter collecting \`TestStepFinished\` durations over a threshold, including hooks, and writing a sorted list at \`TestRunFinished\` — it showed that UI login in a Background dominated suite time, which justified seeding the session for non-login scenarios.

### Q: JUnit 4, JUnit Platform or TestNG runner — which do you choose?
**Short answer (30–60 s):** JUnit Platform for anything new: it is the recommended runner, has the best parallel model, and Cucumber 8.0 deprecated both the JUnit 4 and TestNG runners for removal. An existing TestNG suite on 7.x can stay, with a migration planned before moving to 8.

**Detailed answer:** The platform engine is configured by configuration parameters (\`junit-platform.properties\`, \`@ConfigurationParameter\`, system properties) and supports scenario-level parallelism and exclusive resources by tag. Gotchas: \`@ConfigurationParameter\` values beat \`-D\`, and \`cucumber.features\` disables discovery selectors. TestNG runner users rely on the data-provider pool for parallelism and on TestNG listeners — I keep new framework features runner-neutral (Cucumber plugins, hooks) to make the migration cheap.

### Q: How does Cucumber resolve configuration from different sources?
**Short answer (30–60 s):** For the core runners: \`cucumber.properties\` < \`@CucumberOptions\` < environment variables < system properties. On the JUnit Platform it is JUnit's own configuration parameters, where suite-level parameters beat system properties and \`junit-platform.properties\` is lowest.

**Detailed answer:** That precedence is why a single runner with defaults can serve many CI jobs passing \`-Dcucumber.filter.tags\`. I keep defaults in one file, selection in CI, and print the effective tag expression at start. The old \`cucumber.options\` property is gone since 7.

## Scenario-based questions

**1. After a refactor that moved hooks into \`com.shopeasy.support.hooks\`, every scenario fails with a \`NullPointerException\` in the first step.** Name the stage: execution, but the cause is glue loading — the new package is outside \`cucumber.glue\` (\`com.shopeasy.glue\`), so \`@Before\` is never registered and the driver is null. I would confirm by checking the report for the absence of the hook step (hooks are visible test steps), fix the glue configuration (or move the class), and add a smoke check: a dry-run cannot catch this, so the fix is a guard in the step layer that fails fast with "driver not initialised — is the hooks package on the glue path?".

**2. The nightly report shows 40 scenarios as "undefined" after a BA edited feature files, yet nobody touched Java.** The wording changed (for example "the shopper sorts the products by" vs "sorts products by"). I would run a dry-run locally to list every undefined step, decide per case whether the new wording is better (then update the expression, possibly with optional text) or a drift (then revert), and add the dry-run job to the PR pipeline for \`.feature\` changes so it never reaches the nightly run again. I would also agree with the BA that step vocabulary changes go through a short glossary (see \`cucumber-deep-bdd-practice-at-scale\`).

**3. The team wants a Slack message per failed scenario during the run, not at the end.** A \`ConcurrentEventListener\` handling \`TestCaseFinished\` with status FAILED, posting asynchronously through a bounded executor so a slow webhook never blocks scenario threads, with the webhook URL from an environment variable and a rate limit. Registered via \`cucumber.plugin\` only in the CI profile. Not a hook: hooks run inside every scenario, would mix notification failures into test results and duplicate code across runners.

## Tricky follow-ups

- **Q: Can \`@Given("the cart is empty")\` and \`@Then("the cart is empty")\` coexist?** No — keywords are not part of matching; the second is a duplicate and Cucumber fails at glue loading.
- **Q: Does a Background run once per feature?** No — its steps are copied into every pickle and run before each scenario (and each outline row).
- **Q: Is an unanchored regex in a step annotation matched as a prefix?** In current versions the whole step text must match; but without \`^\`/\`$\` (or \`/…/\`) the string is not even treated as a regex — it becomes a Cucumber expression, where \`(\` means optional text.
- **Q: Will \`-Dcucumber.filter.tags\` override a tag set with \`@ConfigurationParameter\` on a JUnit Platform suite?** Not by default — suite parameters take precedence over system properties. Put the default in \`junit-platform.properties\` instead.
- **Q: Why does a plugin's \`ArrayList\` occasionally lose entries?** It is a \`ConcurrentEventListener\` receiving events from several scenario threads; use concurrent collections or switch to \`EventListener\` if ordered, end-of-run delivery is enough.`,
  keyPoints: [
    'Pipeline: Gherkin parser → GherkinDocument AST → pickles → filters → glue loading → step matching → TestCases → execution → events to plugins; name the stage before debugging.',
    'One pickle per Scenario and per Examples row; Feature and Rule Background steps are prepended, tags inherited, placeholders substituted — filters, line selection and report counts all work on pickles.',
    'Glue is found by classpath scanning of glue packages; step definitions, hooks and parameter types outside them do not exist for Cucumber. Duplicate expressions fail at glue loading.',
    'The ObjectFactory creates one instance per step class per scenario (lazily); instance fields are scenario-scoped, static fields leak.',
    'Matching ignores the keyword and needs exactly one full-text match: 0 = undefined (snippets), >1 = ambiguous. ^ or $ makes the annotation a regex, otherwise it is a Cucumber expression.',
    'Failed, undefined, pending and ambiguous fail the run (strict since v6, non-strict removed in v7); @After runs even after a failed @Before.',
    'Reports are plugins on an event bus; a ConcurrentEventListener receives events live from many threads. Cucumber Messages (ndjson) are the common output contract.',
    'Prefer the JUnit Platform engine (Cucumber 8.0 deprecated the JUnit 4 and TestNG runners); core precedence is cucumber.properties < @CucumberOptions < env vars < system properties.',
  ],
  mistakes: [
    'Hooks or parameter types in a package outside the glue, so the driver is null or {product} is "undefined parameter type". Fix: keep one dedicated glue parent package and confirm in the report that hook steps appear for each scenario.',
    'Writing a second, more general step definition ({} or .*) "to cover variations", making dozens of steps ambiguous. Fix: read the ambiguity message (it lists every match), delete or narrow the general definition, use optional text or a parameter type instead.',
    'Keeping a static WebDriver or "current order" in a step class because "instances are recreated anyway". Fix: per-scenario objects injected by the DI container; static only for immutable configuration.',
    'Plugin with an ArrayList or SimpleDateFormat field registered as ConcurrentEventListener, losing data in parallel runs. Fix: concurrent collections and immutable formatters, or EventListener for ordered end-of-run output; test the plugin with parallel execution on.',
    'Setting cucumber.filter.tags in @ConfigurationParameter and wondering why the Jenkins -D override is ignored. Fix: defaults in junit-platform.properties, overrides as system properties; log the effective tag expression at run start.',
    'Trying to switch off strict mode so pending steps stop failing the build. Fix: the option is gone since 7.0 — tag unfinished scenarios @wip and exclude them in the tag expression.',
  ],
  tryIt: `On a ShopEasy Cucumber project (http://localhost:5180/practice-site/): (1) write a feature with a Background (login as \`standard_user\`), one tagged scenario and a two-row Scenario Outline for the sort options "Price (low to high)" and "Price (high to low)"; predict how many pickles you get and which tags each carries, then confirm with the \`pretty\` plugin and with \`-Dcucumber.features=<file>:<examples-row-line>\`; (2) add a second step definition with \`{}\` for the sort step and read the ambiguity message, then remove it; (3) run a dry-run and note the statuses; (4) add the \`SlowStepReporter\` plugin with \`-Dslowstep.threshold.ms=500\`, run with parallel execution on, and find the slowest hook; (5) add \`message:target/cucumber.ndjson\` and count the \`pickle\` and \`testCaseFinished\` envelopes — they should match your prediction.`,
  problems: ['cuc-015', 'cuc-025', 'cuc-033', 'cuc-040'],
}
