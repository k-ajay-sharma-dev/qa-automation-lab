export default {
  slug: 'framework-deep-maven-build-internals',
  category: 'framework',
  order: 13,
  title: 'Deep dive: Maven for test frameworks — lifecycle, dependency resolution, multi-module builds, Surefire and Failsafe',
  minutes: 30,
  summary: 'Own the build of a test framework like a senior — the lifecycle/phase/goal model, the effective POM and inheritance, dependency mediation, scopes, BOMs and the Enforcer, diagnosing NoSuchMethodError conflicts, resource filtering and profiles, a multi-module framework with a parent POM, Surefire vs Failsafe in depth (including the 3.6 unified JUnit Platform provider and what it means for testng.xml), wrapper, settings.xml, CI caching, Maven vs Gradle and a troubleshooting table.',
  manualAnalogy: `Before a release you never test "whatever happens to be installed": you check the build number, the browser versions, the environment and the data, and you write them in the test report so anyone can repeat the run. A Maven build is that discipline for the automation itself — exactly which library versions end up on the classpath, which tests run in which order of steps, and which settings reach the tests. When it is vague, you get the automation equivalent of "works on my machine": a suite that is green locally and red on Jenkins for reasons nobody can explain.`,
  body: `## Where the earlier lessons stop

The *Maven, pom.xml and the framework folder structure* lesson (\`framework-maven-and-project-structure\`) covered what Maven does, reading a pom, Surefire basics, simple profiles, \`dependency:tree\` and the folder layout; \`framework-command-line-and-ci\` covered the daily commands. Some build topics already have deep coverage elsewhere — this lesson points to them instead of repeating:

- Failsafe for a Cucumber suite, report generation in \`post-integration-test\`, Cucumber/JUnit BOMs and rerun files: \`cucumber-deep-execution-reporting-parallel\`.
- Fork and thread arithmetic (\`forkCount\`, \`reuseForks\`, \`\${surefire.forkNumber}\`) with TestNG threads: \`selenium-deep-parallel-execution\`.
- TestNG internals and listeners: \`framework-deep-testng-internals-extensibility\`; JUnit 5 vs TestNG and assertion libraries: \`framework-deep-junit5-vs-testng-assertions\`.
- Jenkins, GitHub Actions and Docker pipelines get their own section later; here we stay with **Maven itself**: how it decides what to run, what ends up on the classpath, and how to structure and debug the build of a test framework.

Baselines: Maven 3.9.x (3.9.16 at the time of writing; Maven 4 is still a release candidate), Java 17, Surefire/Failsafe 3.5.x and 3.6.x — the difference between those two lines matters for TestNG and is covered in detail below.

## 1. The build lifecycle model

### What it is and why it matters

Maven does not run "scripts". It walks a **lifecycle** — an ordered list of **phases** — and at each phase executes the **plugin goals** bound to it. Every surprise of the form "why did my report not get generated?" or "why did \`mvn test\` not run my UI tests?" is a question about this model.

### How it works internally

There are three built-in lifecycles:

| Lifecycle | Phases (in order) | Used for |
|---|---|---|
| \`clean\` | pre-clean → clean → post-clean | delete \`target/\` |
| \`default\` | validate → initialize → generate-sources → process-sources → generate-resources → process-resources → compile → process-classes → generate-test-sources → process-test-sources → generate-test-resources → process-test-resources → test-compile → process-test-classes → **test** → prepare-package → package → **pre-integration-test → integration-test → post-integration-test → verify** → install → deploy | build, test, publish |
| \`site\` | pre-site → site → post-site → site-deploy | project site/reports (rare in test repos) |

Three rules explain almost everything:

1. **Invoking a phase runs every earlier phase of the same lifecycle.** \`mvn verify\` runs validate … test … package … integration-test … post-integration-test … verify.
2. **Phases do nothing on their own.** Work is done by plugin goals bound to phases — some bound automatically by the **packaging** (\`jar\`, \`pom\`, \`war\`), others by an \`<execution>\` in your pom.
3. **Invoking a goal directly (\`plugin:goal\`) runs only that goal**, with no preceding phases. \`mvn surefire:test\` does not compile — it runs whatever classes are already in \`target/test-classes\`, stale or not.

Default bindings for \`jar\` packaging (the one almost every test module uses):

| Phase | Goal bound by default |
|---|---|
| process-resources | \`resources:resources\` |
| compile | \`compiler:compile\` |
| process-test-resources | \`resources:testResources\` |
| test-compile | \`compiler:testCompile\` |
| test | \`surefire:test\` |
| package | \`jar:jar\` |
| install | \`install:install\` |
| deploy | \`deploy:deploy\` |

Failsafe is **not** bound by default: its \`integration-test\` and \`verify\` goals only run if you declare the plugin with an execution. That is why renaming a class to \`CheckoutIT\` without adding Failsafe makes it silently disappear.

### Phases that matter to test projects

| Phase | What a test framework typically binds there |
|---|---|
| \`validate\` | Enforcer rules (Java/Maven version, dependency convergence) — fail before compiling anything |
| \`initialize\` | JaCoCo \`prepare-agent\` (sets the \`argLine\` property), build-number/timestamp properties |
| \`process-test-resources\` | copy and **filter** \`src/test/resources\` (config per environment) |
| \`test-compile\` | compile \`src/test/java\` |
| \`test\` | Surefire: fast checks (framework unit tests, contract tests) |
| \`package\` | build the framework jar (shared modules), test-jar |
| \`pre-integration-test\` | start things: Docker Grid, WireMock, seed data (e.g. ShopEasy \`POST /api/reset\`) |
| \`integration-test\` | Failsafe: UI and API suites — **records** failures, does not fail the build |
| \`post-integration-test\` | stop containers, generate HTML reports, upload evidence |
| \`verify\` | \`failsafe:verify\` fails the build if tests failed; coverage/quality gates |
| \`install\` / \`deploy\` | publish the shared framework jar to the local / internal repository |

### Practical example: what actually runs

\`\`\`text
mvn clean verify                   # clean lifecycle up to clean, then default lifecycle up to verify
mvn test                           # only up to test: Failsafe never runs
mvn surefire:test                  # just the goal: no compile, no resources, stale classes possible
mvn clean dependency:tree verify   # order on the command line is honoured: clean, goal, then phases up to verify
mvn integration-test               # anti-pattern: post-integration-test is skipped, verify never fails the build
\`\`\`

Step by step:

1. \`clean verify\` is the CI default: reproducible (no stale classes, screenshots or reports) and the only phase that both runs Failsafe and lets it fail the build.
2. \`mvn test\` is the developer's fast loop when UI suites are on Failsafe.
3. Running a goal directly is useful for re-running from already compiled classes (\`mvn failsafe:integration-test failsafe:verify -Dit.test=CheckoutIT\` after a full build), but it is a trap after code changes.
4. The Maven docs explicitly warn against \`mvn integration-test\` from the command line: teardown bound to \`post-integration-test\` does not run, so a Docker Grid or app server can be left running and reports are not generated. Maven 4 changes this (invoking \`integration-test\` also runs \`post-integration-test\`), but write CI for Maven 3.

To see what a phase will execute, run \`mvn help:describe -Dcmd=verify\` — it prints each phase and the goals bound to it for the current project.

## 2. The effective POM and inheritance

### How it works internally

The pom you see is not the model Maven executes. Maven builds an **effective POM** by merging, in order: the built-in **Super POM** (default directories, the central repository, default plugin versions for some plugins), every **parent** POM up the chain, your pom, active **profiles**, then interpolates \`\${...}\` properties. \`mvn help:effective-pom\` prints the result (add \`-Doutput=target/effective-pom.xml\` to save it). It is the single most useful command for "why is this setting not applied?"

Related diagnostics:

| Command | Answers |
|---|---|
| \`mvn help:effective-pom\` | which plugin versions/config/dependency versions actually apply |
| \`mvn help:active-profiles\` | which profiles are on, and why (per module) |
| \`mvn help:effective-settings\` | merged \`settings.xml\` (mirrors, servers — passwords masked) |
| \`mvn help:evaluate -Dexpression=project.version -q -DforceStdout\` | the value of one expression — handy in CI scripts |
| \`mvn -X ...\` | full debug log, including the resolved configuration of each mojo |

### Management sections vs real sections

| Section | Effect | Typical place |
|---|---|---|
| \`<dependencyManagement>\` | declares **versions (and scope/exclusions)** for artifacts; adds nothing to the classpath. Also overrides versions chosen for **transitive** dependencies | parent POM, BOM imports |
| \`<dependencies>\` | puts artifacts on the classpath (inherited by every child) | modules; parent only for truly universal ones |
| \`<pluginManagement>\` | declares plugin versions and configuration; does not add a plugin to the build | parent POM |
| \`<plugins>\` | adds the plugin to the build (inherited by every child) | modules, or parent for plugins every module needs (Enforcer) |

Two internals that catch experienced people:

- **Plugins bound by the packaging are already "in" the build.** Configuring \`maven-surefire-plugin\` in the parent's \`<pluginManagement>\` applies to every \`jar\` child even if the child does not mention Surefire — because \`jar\` packaging binds \`surefire:test\`. Failsafe is not bound by default, so each module that runs integration tests must declare it in \`<plugins>\` (version and config come from management).
- **Dependencies declared in a parent's \`<dependencies>\` land in every child** — including the \`pom\`-packaged aggregator and the \`api-tests\` module that never needed Selenium. Put versions in \`<dependencyManagement>\`, declare usage in each module.

Configuration merging: child configuration elements are merged into the parent's by element name. Lists such as \`<includes>\` are **replaced**, not appended, unless you use \`combine.children="append"\`; \`combine.self="override"\` throws the parent's element away. When a child "loses" a system property the parent set, check the effective POM — a child's \`<systemPropertyVariables>\` merges by property name, but a child's \`<includes>\` replaces the parent's list.

### Best practices

- Pin **every** plugin version in the parent's \`<pluginManagement>\`, including the ones the Super POM provides; unpinned plugins make builds differ between Maven versions and print "\`'build.plugins.plugin.version' for … is missing\`" warnings.
- Keep \`<dependencies>\` out of the parent except for things every module needs (e.g. a logging API).
- Commit nothing that only works because of your \`~/.m2/settings.xml\`; CI must build from the repository alone plus a CI settings file.

## 3. Dependency resolution internals

### Repositories and the local repository

When Maven needs \`org.seleniumhq.selenium:selenium-java:4.33.0\`, it looks in the **local repository** (\`~/.m2/repository\`, path = groupId with dots as folders / artifactId / version), then in remote repositories in order: those declared in the pom and settings, with **mirrors** in \`settings.xml\` redirecting them (in companies, everything goes through Nexus/Artifactory). Downloaded files are cached; a failed lookup is cached too (\`*.lastUpdated\` files), which is why \`-U\` exists.

**SNAPSHOT** versions (\`1.4.0-SNAPSHOT\`) are mutable: Maven re-checks them according to the repository's update policy (daily by default) or always with \`-U\`. Release versions are immutable — a released \`1.4.0\` in your local repo is never re-downloaded.

### Transitive dependencies and mediation

Each dependency's own pom declares its dependencies, so the classpath is a **graph**. When the graph contains two versions of one artifact, Maven keeps exactly one, using **dependency mediation**:

1. **Nearest definition wins** — the version with the shortest path from your project.
2. **Tie-break: first declaration wins** — at equal depth, the one whose path comes first in your \`<dependencies>\` order.
3. **\`<dependencyManagement>\` overrides mediation** for transitive dependencies — a managed version is used even if mediation would pick another. (It does not affect plugins' own dependencies.)

Note what is missing: **"newest wins" is not a rule.** That is the root of most conflicts.

\`\`\`text
shopeasy-ui-tests
├── io.rest-assured:rest-assured            (declared first)
│   └── ... → com.fasterxml.jackson.core:jackson-databind  (depth 3)
├── com.acme:fancy-reporter:2.1.0
│   └── com.fasterxml.jackson.core:jackson-databind:2.9.10  (depth 2)  ← nearest: WINS
└── com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.19.0
    └── com.fasterxml.jackson.core:jackson-databind:2.19.0  (depth 2)  ← equal depth, declared later: loses
\`\`\`

(Illustrative tree: \`fancy-reporter\` stands for any third-party reporting library that drags an old Jackson.) Result: \`jackson-datatype-jsr310\` 2.19 runs against \`jackson-databind\` 2.9. It compiled fine — the compiler saw whatever was on the compile classpath — but at runtime a method the module calls does not exist in the old databind: **\`java.lang.NoSuchMethodError\`** (or \`NoClassDefFoundError\`, \`AbstractMethodError\`, "IncompatibleClassChangeError"). These are *linkage* errors: the JVM found the class, but not the shape the caller was compiled against.

### Scopes and how they propagate

| Scope | Compile classpath | Test classpath | Runtime | Transitive? | Typical use in test frameworks |
|---|---|---|---|---|---|
| \`compile\` (default) | ✔ | ✔ | ✔ | yes | \`framework-core\` libraries that consuming modules need (Selenium in the shared framework jar) |
| \`provided\` | ✔ | ✔ | ✘ | no | rare in test repos (servlet API, Lombok) |
| \`runtime\` | ✘ | ✔ | ✔ | yes (as runtime) | JDBC drivers, SLF4J/Log4j bindings |
| \`test\` | ✘ (main) | ✔ | ✘ | no | TestNG, JUnit, AssertJ in test modules |
| \`system\` | ✔ | ✔ | ✘ | — | a jar from a local path — not recommended; use an internal repository |
| \`import\` | — | — | — | — | only on \`<type>pom</type>\` inside \`<dependencyManagement>\`: imports a BOM |

How a transitive dependency's scope combines with yours (rows = your direct dependency's scope, columns = scope declared inside it; "–" = dropped):

| | compile | provided | runtime | test |
|---|---|---|---|---|
| **compile** | compile | – | runtime | – |
| **provided** | provided | – | provided | – |
| **runtime** | runtime | – | runtime | – |
| **test** | test | – | test | – |

Consequences for test frameworks:

- **\`test\` and \`provided\` dependencies are not transitive.** If \`framework-core\` declares Selenium with \`<scope>test</scope>\`, a consuming \`ui-tests\` module gets **no** Selenium — and \`framework-core\`'s own \`src/main/java\` cannot even compile against it. Shared framework code lives in \`src/main/java\` with \`compile\` scope; the consuming test module declares the framework jar with \`test\` scope.
- Everything a \`test\`-scoped dependency brings in is also \`test\` — fine for test modules.

### Exclusions and optional

\`\`\`xml
<dependency>
  <groupId>com.acme</groupId>
  <artifactId>fancy-reporter</artifactId>
  <version>2.1.0</version>
  <exclusions>
    <exclusion>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>*</artifactId>          <!-- wildcard: every artifact of that group -->
    </exclusion>
  </exclusions>
</dependency>
\`\`\`

- An **exclusion** cuts a branch of the graph for that one path. Use it when a library drags something you never want (an old Selenium 3, a second logging binding, \`commons-logging\`).
- **\`<optional>true</optional>\`** is the library author's tool: "I can use this, but my consumers do not get it automatically". If your shared \`framework-core\` supports both Allure and Extent, marking each reporter optional stops every consumer from inheriting both.

### BOMs with import scope

A **BOM** (Bill of Materials) is a pom whose \`<dependencyManagement>\` lists a consistent set of versions. Importing it gives you aligned versions without declaring each one:

\`\`\`xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-bom</artifactId>
      <version>\${selenium.version}</version>
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
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>\${jackson.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
\`\`\`

- Coordinates as published on Maven Central: \`org.seleniumhq.selenium:selenium-bom\`, \`org.junit:junit-bom\`, \`com.fasterxml.jackson:jackson-bom\` (note: group \`com.fasterxml.jackson\`, not \`.core\`). Jackson 3 moves to a new group (\`tools.jackson:jackson-bom\`) with new packages — not a drop-in upgrade.
- After importing, declare dependencies **without** \`<version>\`.
- **Order matters.** If two imported BOMs manage the same artifact, the first import wins. Jackson is managed by several BOMs in large projects (Spring Boot's, for example); put the BOM whose versions you want to win **first**, or manage that artifact explicitly above the imports — an explicit entry in your own \`<dependencyManagement>\` beats imported ones.
- An imported BOM is resolved when the model is built; it cannot use properties set by profiles activated later in other modules, and you must not import a BOM that is a module of the same reactor.

### Version ranges and SNAPSHOTs

\`[4.20,5.0)\` lets Maven pick any matching version available **today** — the build changes without a commit, differs between machines with different local repos, and resolution needs network metadata lookups. Never use ranges in a test framework; the Enforcer rule \`banDynamicVersions\` can block them. SNAPSHOT dependencies on another team's library have the same problem; consume releases, or pin to a timestamped snapshot during a short-lived integration.

## 4. Diagnosing conflicts: a worked example

### The symptom

A typical e-commerce project, ShopEasy-style: an engineer adds a reporting library; the API suite now fails before any test with

\`\`\`text
java.lang.NoSuchMethodError: 'com.fasterxml.jackson.databind.… com.fasterxml.jackson.databind.…(…)'
    at com.fasterxml.jackson.datatype.jsr310.JavaTimeModule.setupModule(JavaTimeModule.java:…)
\`\`\`

(The exact method varies; the shape — caller in one Jackson artifact, missing method in another — is the tell-tale.)

### Diagnosis, step by step

\`\`\`text
mvn -pl api-tests dependency:tree -Dincludes=com.fasterxml.jackson.core -Dverbose
\`\`\`

\`\`\`text
[INFO] com.shopeasy:api-tests:jar:1.0.0-SNAPSHOT
[INFO] +- com.acme:fancy-reporter:jar:2.1.0:test
[INFO] |  \\- com.fasterxml.jackson.core:jackson-databind:jar:2.9.10:test
[INFO] \\- com.fasterxml.jackson.datatype:jackson-datatype-jsr310:jar:2.19.0:test
[INFO]    \\- (com.fasterxml.jackson.core:jackson-databind:jar:2.19.0:test - omitted for conflict with 2.9.10)
\`\`\`

1. \`-Dverbose\` shows the **losing** versions with "omitted for conflict with …" — the plain tree only shows winners, which hides the problem.
2. \`-Dincludes=groupId[:artifactId]\` filters the noise; use it on one module with \`-pl\`.
3. Confirm at runtime when in doubt: print \`ObjectMapper.class.getProtectionDomain().getCodeSource().getLocation()\` or run the JVM with \`-verbose:class\` to see which jar a class came from.

### Fix options

| Option | How | Advantages | Disadvantages | When |
|---|---|---|---|---|
| Import the BOM | \`jackson-bom\` in \`<dependencyManagement>\` | aligns **all** Jackson modules; managed versions override mediation | the library you excluded from might genuinely need the old API | default for families of artifacts (Jackson, Selenium, JUnit, Cucumber) |
| Pin one artifact | explicit \`<dependencyManagement>\` entry | precise | another module of the family can still drift | single artifacts (Guava, commons-io) |
| Exclusion | \`<exclusions>\` on the dragging dependency | removes an unwanted branch entirely | one exclusion per path; new paths re-introduce it | unwanted libraries (Selenium 3 inside an old reporter, a second logging binding) |
| Direct declaration | declare \`jackson-databind\` yourself | nearest wins | fixes only that one artifact, easy to forget to upgrade | quick experiment, not the final fix |
| Replace the library | drop or upgrade \`fancy-reporter\` | removes the root cause | not always possible | when the library is unmaintained |

**Recommended approach and why:** import the BOM (or manage the version) **and** make the build fail when the problem reappears — fixing the tree once without a guard means the next dependency added re-opens the incident. That guard is the Enforcer.

### Enforcer rules that guard a test framework

\`\`\`xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>3.7.0</version>
  <executions>
    <execution>
      <id>enforce-build-hygiene</id>
      <goals><goal>enforce</goal></goals>          <!-- bound to validate by default -->
      <configuration>
        <rules>
          <requireMavenVersion><version>[3.9.6,)</version></requireMavenVersion>
          <requireJavaVersion><version>[17,)</version></requireJavaVersion>
          <dependencyConvergence/>
          <banDuplicatePomDependencyVersions/>
          <requirePluginVersions/>
          <banDynamicVersions/>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
\`\`\`

| Rule | Fails the build when | Note |
|---|---|---|
| \`requireMavenVersion\` | Maven is older than the range | the wrapper makes this rarely fire, but protects IDE-embedded Maven |
| \`requireJavaVersion\` | the JDK running Maven is outside the range | turns a cryptic "release version 17 not supported" into a clear message |
| \`dependencyConvergence\` | any artifact appears in the graph with **different versions** | strict; the first run lists many conflicts — fix with BOMs/management, add \`<excludes>\` sparingly |
| \`requireUpperBoundDeps\` | the resolved version is **lower** than some path asked for | gentler alternative: catches exactly the "old Jackson won" case |
| \`banDuplicatePomDependencyVersions\` | the same dependency is declared twice in one pom | Maven 3 only warns |
| \`requirePluginVersions\` | a plugin has no pinned version | reproducibility |
| \`banDynamicVersions\` | version ranges, \`LATEST\`/\`RELEASE\`, (optionally) SNAPSHOTs | reproducibility |

Run the Enforcer in the parent's \`<plugins>\` so every module inherits it, and bind it to \`validate\` (its default) so a bad graph fails in seconds, not after a 20-minute UI run.

### dependency:analyze

\`mvn dependency:analyze\` compares bytecode with declarations and reports **used undeclared** dependencies (you use classes that only arrive transitively — fragile: a library upgrade can remove them) and **unused declared** ones. In test frameworks treat it as advice: things used only by reflection or configuration — TestNG listeners named in \`testng.xml\`, SLF4J bindings, WebDriver/engine artifacts discovered via \`ServiceLoader\` — show up as "unused" although removing them breaks the run.

## 5. Properties, resource filtering and profiles

### Property sources

| Syntax | Source |
|---|---|
| \`\${project.version}\`, \`\${project.build.directory}\` | the POM model |
| \`\${selenium.version}\` | \`<properties>\` (pom, parent, active profiles) or \`-Dselenium.version=…\` (user properties win) |
| \`\${env.CI}\` | environment variable |
| \`\${user.home}\`, \`\${java.version}\` | JVM system properties of the **Maven** JVM |
| \`\${settings.localRepository}\` | \`settings.xml\` |

Remember the boundary from the beginner lesson: these are **Maven** properties. Tests run in a forked JVM and see only what Surefire/Failsafe pass on (\`systemPropertyVariables\`, \`argLine\`) — plus, in practice, user properties given with \`-D\` on the command line, which the plugins forward. Explicit mapping is clearer and survives refactoring.

### Resource filtering per environment

\`\`\`xml
<build>
  <testResources>
    <testResource>
      <directory>src/test/resources</directory>
      <filtering>true</filtering>
      <includes><include>config.properties</include></includes>
    </testResource>
    <testResource>
      <directory>src/test/resources</directory>
      <filtering>false</filtering>
      <excludes><exclude>config.properties</exclude></excludes>
    </testResource>
  </testResources>
</build>
\`\`\`

\`\`\`properties
# src/test/resources/config.properties
baseUrl=\${baseUrl}
apiUrl=\${apiUrl}
browser=\${browser}
build.version=\${project.version}
\`\`\`

1. Two \`<testResource>\` entries: filter **only** the text file you mean to. Filtering everything corrupts binary test data (images for ShopEasy's avatar upload test, \`.xlsx\` data files) and mangles any file that contains \`\${...}\` for other reasons (a JSON schema, a Log4j2 pattern).
2. \`process-test-resources\` writes the filtered copy to \`target/test-classes/config.properties\`; that copy is what the tests read from the classpath.
3. Set \`<project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>\` — otherwise the resources plugin warns "Using platform encoding … to copy filtered resources, i.e. build is platform dependent!" and non-ASCII test data differs between Windows and Linux agents.

**Filtering vs runtime system properties** — two approaches:

| | Filter values into \`config.properties\` at build time | Pass \`-DbaseUrl=…\` → \`systemPropertyVariables\` → \`System.getProperty\` at runtime |
|---|---|---|
| How | resources plugin substitutes during the build | the forked JVM receives properties; \`ConfigReader\` layers them over defaults |
| Advantages | file shows the effective values; works from the IDE after one build | no rebuild per environment; one artefact runs anywhere; secrets never written to disk |
| Disadvantages | environment baked into \`target/\` — run from the IDE after a \`-Puat\` build and you hit UAT; secrets end up in files | IDE run configurations need the properties (or defaults) |
| When | build metadata (\`project.version\`, git commit) and non-secret defaults | environment, browser, credentials |

**Recommended approach and why:** runtime properties for anything environment-specific (see \`framework-config-and-environments\`), filtering only for build metadata. A shared framework jar especially must not have an environment baked in.

### Profiles: activation in depth

\`\`\`xml
<profiles>
  <profile>
    <id>ci</id>
    <activation>
      <property><name>env.CI</name></property>            <!-- environment variable CI is set -->
    </activation>
    <properties><headless>true</headless></properties>
  </profile>
  <profile>
    <id>uat</id>
    <activation>
      <property><name>env</name><value>uat</value></property>   <!-- -Denv=uat -->
    </activation>
    <properties>
      <baseUrl>https://uat.shopeasy.example/practice-site</baseUrl>   <!-- typical real app -->
      <apiUrl>https://api.uat.shopeasy.example</apiUrl>
    </properties>
  </profile>
  <profile>
    <id>windows-agent</id>
    <activation><os><family>windows</family></os></activation>
  </profile>
  <profile>
    <id>jdk21</id>
    <activation><jdk>[21,)</jdk></activation>
  </profile>
  <profile>
    <id>local-overrides</id>
    <activation><file><exists>\${basedir}/local.properties</exists></file></activation>
  </profile>
</profiles>
\`\`\`

| Activation | Example | Pitfall |
|---|---|---|
| explicit | \`-Puat,smoke\` | — |
| deactivate | \`-P !local\` or \`-P -local\` | \`!\` must be quoted in bash (\`-P '!local'\`) |
| \`activeByDefault\` | \`<activeByDefault>true</activeByDefault>\` | silently **off** as soon as any other profile in that pom is activated |
| property | \`<property><name>env</name><value>uat</value></property>\`; \`!env\` = "not set" | only **user/system** properties (\`-D\`), not \`<properties>\` from the pom |
| environment | \`<name>env.CI</name>\` | differs between your laptop and the agent — by design, but surprising |
| JDK / OS | \`<jdk>[21,)</jdk>\`, \`<os><family>…</family></os>\` | builds behave differently per machine |
| file | \`<file><exists>…</exists></file>\` | interpolation in the path is limited (\`\${basedir}\`, system properties) |

### Why profile-heavy builds get confusing

Ten profiles that can combine give hundreds of effective POMs; activation by environment, OS and files means the effective build differs per machine; profiles in a parent apply per module; and profiles cannot be "inherited" as names — \`-Puat\` activates every profile with id \`uat\` in every module. Keep profiles for **build shape** (which suite, which plugins, CI vs local), keep **environment data** in config files selected by one property, and print \`mvn help:active-profiles\` at the start of CI logs.

## 6. Multi-module test framework

### Why split at all

A single test repo works until a second consumer appears: the mobile team wants the driver factory, the API team wants the REST client, and the UI suite wants both. Modules give **enforced boundaries** (the API suite literally cannot import Selenium), independent test commands, and a shared parent for versions and plugins.

\`\`\`text
shopeasy-automation/                 (packaging pom, the reactor root)
├── pom.xml                          parent: versions, BOMs, pluginManagement, Enforcer
├── .mvn/
│   ├── maven.config                 -B, --no-transfer-progress …
│   ├── jvm.config
│   └── wrapper/maven-wrapper.properties
├── mvnw, mvnw.cmd
├── framework-core/                  src/main/java: DriverFactory, ConfigReader, waits, logging, retry
├── pages/                           src/main/java: page objects + components (depends on core)
├── api-client/                      src/main/java: REST Assured client, DTOs, auth (no Selenium, no dependency on core)
├── ui-tests/                        src/test/java: *IT UI suites (depends on pages, api-client for setup)
└── api-tests/                       src/test/java: *IT API suites (depends on api-client only)
\`\`\`

### The parent POM

\`\`\`xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy.automation</groupId>
  <artifactId>shopeasy-automation-parent</artifactId>
  <version>1.4.0-SNAPSHOT</version>
  <packaging>pom</packaging>

  <modules>
    <module>framework-core</module>
    <module>pages</module>
    <module>api-client</module>
    <module>ui-tests</module>
    <module>api-tests</module>
  </modules>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>

    <!-- versions: illustrative, upgrade deliberately and together -->
    <selenium.version>4.33.0</selenium.version>
    <testng.version>7.10.2</testng.version>
    <rest-assured.version>5.5.0</rest-assured.version>
    <jackson.version>2.19.0</jackson.version>
    <surefire.version>3.5.5</surefire.version>      <!-- 3.5.x: keeps testng.xml support, see section 7 -->

    <!-- runtime defaults, overridable with -D -->
    <baseUrl>http://localhost:5180/practice-site</baseUrl>
    <apiUrl>http://localhost:5181</apiUrl>
    <browser>chrome</browser>
    <headless>false</headless>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.seleniumhq.selenium</groupId>
        <artifactId>selenium-bom</artifactId>
        <version>\${selenium.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>com.fasterxml.jackson</groupId>
        <artifactId>jackson-bom</artifactId>
        <version>\${jackson.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>org.testng</groupId>
        <artifactId>testng</artifactId>
        <version>\${testng.version}</version>
      </dependency>
      <dependency>
        <groupId>io.rest-assured</groupId>
        <artifactId>rest-assured</artifactId>
        <version>\${rest-assured.version}</version>
      </dependency>
      <!-- our own modules: one version for the whole reactor -->
      <dependency>
        <groupId>com.shopeasy.automation</groupId>
        <artifactId>framework-core</artifactId>
        <version>\${project.version}</version>
      </dependency>
      <dependency>
        <groupId>com.shopeasy.automation</groupId>
        <artifactId>pages</artifactId>
        <version>\${project.version}</version>
      </dependency>
      <dependency>
        <groupId>com.shopeasy.automation</groupId>
        <artifactId>api-client</artifactId>
        <version>\${project.version}</version>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <build>
    <pluginManagement>
      <plugins>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-compiler-plugin</artifactId>
          <version>3.13.0</version>
        </plugin>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-resources-plugin</artifactId>
          <version>3.3.1</version>
        </plugin>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-surefire-plugin</artifactId>
          <version>\${surefire.version}</version>
        </plugin>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-failsafe-plugin</artifactId>
          <version>\${surefire.version}</version>
          <configuration>
            <systemPropertyVariables>
              <baseUrl>\${baseUrl}</baseUrl>
              <apiUrl>\${apiUrl}</apiUrl>
              <browser>\${browser}</browser>
              <headless>\${headless}</headless>
            </systemPropertyVariables>
          </configuration>
          <executions>
            <execution>
              <goals>
                <goal>integration-test</goal>
                <goal>verify</goal>
              </goals>
            </execution>
          </executions>
        </plugin>
      </plugins>
    </pluginManagement>

    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-enforcer-plugin</artifactId>
        <version>3.7.0</version>
        <executions>
          <execution>
            <id>enforce</id>
            <goals><goal>enforce</goal></goals>
            <configuration>
              <rules>
                <requireMavenVersion><version>[3.9.6,)</version></requireMavenVersion>
                <requireJavaVersion><version>[17,)</version></requireJavaVersion>
                <dependencyConvergence/>
                <banDuplicatePomDependencyVersions/>
              </rules>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
\`\`\`

### Module POMs

\`\`\`xml
<!-- framework-core/pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.shopeasy.automation</groupId>
    <artifactId>shopeasy-automation-parent</artifactId>
    <version>1.4.0-SNAPSHOT</version>
  </parent>
  <artifactId>framework-core</artifactId>

  <dependencies>
    <!-- compile scope: consumers need these; framework code lives in src/main/java -->
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>            <!-- listeners, retry analyzer live here -->
    </dependency>
  </dependencies>
</project>
\`\`\`

\`api-client\` deliberately does **not** depend on \`framework-core\`, because that would put Selenium on the API suite's classpath. When the API client also needs shared configuration, split the core further — \`framework-config\` (no Selenium) used by both, \`framework-ui\` (driver, waits) used only by \`pages\`. Here \`api-client\` depends only on what it needs:

\`\`\`xml
<!-- api-client/pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.shopeasy.automation</groupId>
    <artifactId>shopeasy-automation-parent</artifactId>
    <version>1.4.0-SNAPSHOT</version>
  </parent>
  <artifactId>api-client</artifactId>

  <dependencies>
    <dependency>
      <groupId>io.rest-assured</groupId>
      <artifactId>rest-assured</artifactId>
    </dependency>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
    </dependency>
  </dependencies>
</project>
\`\`\`

\`\`\`xml
<!-- pages/pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.shopeasy.automation</groupId>
    <artifactId>shopeasy-automation-parent</artifactId>
    <version>1.4.0-SNAPSHOT</version>
  </parent>
  <artifactId>pages</artifactId>

  <dependencies>
    <dependency>
      <groupId>com.shopeasy.automation</groupId>
      <artifactId>framework-core</artifactId>
    </dependency>
  </dependencies>
</project>
\`\`\`

\`\`\`xml
<!-- ui-tests/pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.shopeasy.automation</groupId>
    <artifactId>shopeasy-automation-parent</artifactId>
    <version>1.4.0-SNAPSHOT</version>
  </parent>
  <artifactId>ui-tests</artifactId>

  <dependencies>
    <dependency>
      <groupId>com.shopeasy.automation</groupId>
      <artifactId>pages</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>com.shopeasy.automation</groupId>
      <artifactId>api-client</artifactId>        <!-- fast setup: login/cart via API -->
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-failsafe-plugin</artifactId>   <!-- version, config, executions from pluginManagement -->
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>\${suite}</suiteXmlFile>
          </suiteXmlFiles>
        </configuration>
      </plugin>
    </plugins>
  </build>

  <properties>
    <suite>src/test/resources/suites/ui-regression.xml</suite>
  </properties>
</project>
\`\`\`

\`\`\`xml
<!-- api-tests/pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.shopeasy.automation</groupId>
    <artifactId>shopeasy-automation-parent</artifactId>
    <version>1.4.0-SNAPSHOT</version>
  </parent>
  <artifactId>api-tests</artifactId>

  <dependencies>
    <dependency>
      <groupId>com.shopeasy.automation</groupId>
      <artifactId>api-client</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-failsafe-plugin</artifactId>
        <configuration>
          <groups>\${groups}</groups>               <!-- e.g. smoke, cart, orders -->
        </configuration>
      </plugin>
    </plugins>
  </build>

  <properties>
    <groups>api</groups>
  </properties>
</project>
\`\`\`

Step by step:

1. The parent has \`packaging pom\` and \`<modules>\`: it is both the **parent** (inheritance) and the **aggregator** (what the reactor builds). They are different concepts that usually live in one file.
2. Our own modules are managed with \`\${project.version}\` so the reactor always uses one consistent version.
3. Failsafe is fully configured once in \`pluginManagement\`, then **switched on** per test module by listing it in \`<plugins>\` without a version.
4. \`framework-core\`, \`pages\` and \`api-client\` keep code in \`src/main/java\` (compile scope, transitive); test modules consume them with \`test\` scope.
5. The Enforcer in the parent \`<plugins>\` runs in every module at \`validate\`.

### Reactor order, -pl and -am

The **reactor** collects the modules, sorts them by inter-module dependencies (not by \`<modules>\` order) and builds them in that order: \`framework-core → pages, api-client → ui-tests, api-tests\`. The first lines of the build log print this "Reactor Build Order".

| Flag | Meaning | ShopEasy example |
|---|---|---|
| \`-pl ui-tests\` | build only these modules (comma-separated, or \`:artifactId\`) | \`mvn -pl ui-tests verify\` |
| \`-am\` (also-make) | plus the modules they depend on | \`mvn -pl ui-tests -am verify\` — rebuilds core and pages first |
| \`-amd\` (also-make-dependents) | plus modules that depend on them | \`mvn -pl framework-core -amd verify\` — "what breaks if I change core?" |
| \`-rf :ui-tests\` | resume from a module after a failure | skip the already green modules |
| \`-T 1C\` | build independent modules in parallel, one thread per core | \`pages\` and \`api-client\` in parallel |

The classic bug: \`mvn -pl ui-tests verify\` **without \`-am\`** resolves \`pages-1.4.0-SNAPSHOT.jar\` from \`~/.m2\` — whatever someone last \`install\`ed, possibly days old. The test run uses yesterday's locators and nobody understands why the fix "did not work". Use \`-am\` or always build from the root. If the upstream modules' own unit tests slow you down, add \`-DskipTests\` for a local run only — but on Surefire/Failsafe 3.5.x that also skips the Failsafe suite you wanted to run (see section 7).

### Publishing a shared framework jar vs a monorepo

| | Monorepo (framework + suites in one reactor) | Framework published to an internal repository (Nexus/Artifactory), suites in other repos |
|---|---|---|
| How it works | modules reference each other at \`\${project.version}\`; one build | framework released as \`1.4.0\`, consumers declare that version |
| Advantages | atomic changes (fix a page object and its tests in one PR); no release ceremony; refactoring tools see all usages | independent release cadence; many teams can consume; consumers upgrade when ready |
| Disadvantages | everyone builds everything; CI must be selective (\`-pl … -am\`); ownership blurs | every framework fix needs a release; version skew across teams; breaking changes need semantic versioning and changelogs |
| Performance | incremental CI needs work (changed-module detection) | consumer builds are small and fast |
| Maintainability | high for one team | high only with disciplined versioning and deprecation |
| Scalability | a few teams | many teams / products |
| When | one product, one QA team, framework evolving fast | several products or teams, framework stable |

**Recommended approach and why:** start as a **multi-module monorepo** — the framework changes weekly in the first year, and atomic PRs beat release ceremony. Extract and publish \`framework-core\` (and \`api-client\`) to the internal repository when a second team consumes it; release with semantic versions, never let consumers depend on \`-SNAPSHOT\` of it, and keep \`pages\` with the product they describe.

## 7. Surefire vs Failsafe in depth

### How they differ

Both are built from the same code base and share almost every parameter; the differences are bindings, defaults and the pass/fail decision:

| | Surefire | Failsafe |
|---|---|---|
| Goals and phases | \`surefire:test\` in \`test\` (bound by jar packaging) | \`failsafe:integration-test\` in \`integration-test\`, \`failsafe:verify\` in \`verify\` (you must declare the executions) |
| Default includes | \`**/Test*.java\`, \`**/*Test.java\`, \`**/*Tests.java\`, \`**/*TestCase.java\` | \`**/IT*.java\`, \`**/*IT.java\`, \`**/*ITCase.java\` |
| Test failures | fail the build at once, in \`test\` | recorded in \`failsafe-summary.xml\`; build fails later in \`verify\` |
| Reports | \`target/surefire-reports\` | \`target/failsafe-reports\` (+ \`failsafe-summary.xml\`) |
| Select one test | \`-Dtest=CartTest#removeItem\` | \`-Dit.test=CheckoutIT\` |
| Skip | \`-DskipTests\` | \`-DskipITs\` (and \`-DskipTests\` up to Failsafe 3.5.x) |

### Why Failsafe's split matters

Because \`integration-test\` only **records** failures, the phases after it still run: \`post-integration-test\` stops the Docker Grid, collects browser logs, and generates HTML reports, and only then does \`verify\` fail the build. With Surefire, a red \`test\` phase aborts the build — later report plugins never execute, which is exactly when you need the report. \`cucumber-deep-execution-reporting-parallel\` shows the full Cucumber version of this pattern; it applies equally to TestNG suites.

The trap the other way round: running \`mvn integration-test\` in CI gives a **green build with failing tests**, because nobody ran \`failsafe:verify\`.

### Important parameters

| Parameter (user property) | What it does | Notes |
|---|---|---|
| \`includes\` / \`excludes\` | file patterns of test classes | a list: a child's \`<includes>\` replaces the parent's |
| \`test\` / \`it.test\` | run classes/methods by pattern; overrides includes | \`-Dtest='Cart*Test,!*Slow*'\`; \`-Dsurefire.failIfNoSpecifiedTests=false\` in multi-module runs |
| \`suiteXmlFiles\` (\`surefire.suiteXmlFiles\`) | run TestNG suite files | **3.5.x and older only** — see below |
| \`groups\` / \`excludedGroups\` | TestNG groups or JUnit 5 tags | \`-Dgroups=smoke -DexcludedGroups=quarantine\` |
| \`systemPropertyVariables\` | system properties in the forked JVM | the clean bridge for \`baseUrl\`, \`apiUrl\`, \`browser\` |
| \`environmentVariables\` | env vars of the forked JVM | e.g. a proxy for the API client |
| \`argLine\` | JVM options of the fork (heap, agents, \`--add-opens\`) | see \`@{argLine}\` below; \`MAVEN_OPTS\` does **not** reach the fork |
| \`forkCount\` / \`reuseForks\` | number of JVMs (default 1) / reuse them (default true) | multiplying with TestNG threads: \`selenium-deep-parallel-execution\` |
| \`rerunFailingTestsCount\` (\`surefire.rerunFailingTestsCount\` / \`failsafe.rerunFailingTestsCount\`) | re-run failed tests up to N times; passes are reported as **flakes** | provider caveat below; \`failOnFlakeCount\` fails the build above a flake budget |
| \`testFailureIgnore\` (\`maven.test.failure.ignore\`) | keep going and keep the build green on failures | the docs mark it "NOT RECOMMENDED"; Failsafe rarely needs it |
| \`skipTests\` / \`maven.test.skip\` | skip running / skip compiling **and** running | \`maven.test.skip\` also skips test-jar compilation — modules depending on a \`test-jar\` then fail |
| \`skipAfterFailureCount\` (\`surefire.skipAfterFailureCount\`) | stop after N failures | fast fail for smoke runs; not exact with forks/parallel |
| \`failIfNoTests\` | fail when nothing ran | default false — turn it on for suites that must not be empty |
| \`reportsDirectory\` | report folder | defaults above |

### The 3.6 unified JUnit Platform provider (important for TestNG)

Up to 3.5.x, Surefire picked a **provider** per framework (\`surefire-testng\`, \`surefire-junit4\`, \`surefire-junit-platform\` …). Starting with **Surefire/Failsafe 3.6.0**, all frameworks run through **one JUnit Platform provider**; TestNG tests execute via the TestNG JUnit Platform engine (minimum TestNG 6.14.3). Consequences, per the official "What's New in 3.6.x" page:

- **\`suiteXmlFiles\` is not supported any more** — the JUnit Platform cannot run TestNG suite XML files. 3.6.0 ignores it; **3.6.1 fails the build** if it is set. The documented alternatives: \`groups\`, \`includes\`/\`excludes\`, a JUnit Platform \`@Suite\` class — or stay on 3.5.x.
- TestNG \`parallel\` (\`methods\`, \`classes\`, \`tests\`, \`instances\`) with \`threadCount\`, groups, listeners and reporters are still mapped through the plugin configuration.
- Several JUnit 4.7-era parallel parameters are deprecated and ignored; \`runOrder=hourly\` was removed.
- Failsafe no longer binds \`skipTests\` to the \`-DskipTests\` property: \`-DskipTests\` now skips only Surefire; use \`-DskipITs\` for Failsafe, or \`-Dmaven.test.skip\` for both.

Decision for a TestNG framework that relies on \`testng.xml\` (listeners, parameters, \`<test>\` blocks per browser):

| | Stay on 3.5.x (e.g. 3.5.5) with \`suiteXmlFiles\` | Move to 3.6.x with groups/includes |
|---|---|---|
| How | pin \`surefire.version\` in the parent | suites become group/include selections in profiles; per-browser \`<test>\` blocks become CI matrix values |
| Advantages | zero migration; \`testng.xml\` keeps parameters and listener wiring | current plugin line; one reporting model for JUnit and TestNG; \`rerunFailingTestsCount\` documented for TestNG |
| Disadvantages | you are on an older line; legacy providers "may not be maintained" in future | \`<parameter>\` values and per-\`<test>\` config must move to system properties; listeners via \`@Listeners\` or service loading |
| When | now, for large existing suites | new frameworks, or when you plan a dedicated migration |

**Recommended approach and why:** pin 3.5.x **explicitly** (an unpinned plugin is how a team discovers 3.6 on a Monday) and plan the migration to group-based selection, which is also what CI matrices want. New frameworks: design selection around groups/tags from day one. The beginner lessons in this section show \`suiteXmlFiles\` with Surefire 3.5.x — that remains valid on that line.

### rerunFailingTestsCount: the provider caveat

On 3.5.x the parameter description says it is supported by the JUnit 4 and JUnit 5 (Platform) providers only — with the \`surefire-testng\` provider it does nothing, so TestNG teams use a classified \`IRetryAnalyzer\` or a second pass over \`testng-failed.xml\` (see \`selenium-deep-troubleshooting-flaky-tests\`). The 3.6 "Re-run Failing Tests" page lists TestNG as supported, since everything now runs on the JUnit Platform. Either way: a test that passes on rerun is reported as a **flake** (\`flakyFailure\` elements in the XML), the build is green, and \`failOnFlakeCount\` is the guard that stops reruns from hiding a deteriorating suite.

### argLine and late replacement with JaCoCo

\`\`\`xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.12</version>                          <!-- illustrative -->
  <executions>
    <execution><goals><goal>prepare-agent</goal></goals></execution>   <!-- sets the argLine property -->
  </executions>
</plugin>
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <argLine>@{argLine} -Xmx1g -Dfile.encoding=UTF-8</argLine>
  </configuration>
</plugin>
\`\`\`

- \`\${argLine}\` would be interpolated **when the model is built** — before JaCoCo's \`prepare-agent\` sets it — so the agent is lost (or the literal \`\${argLine}\` breaks the fork when no one defines it).
- \`@{argLine}\` is replaced **when the Surefire goal executes**, picking up the value another plugin set earlier in the build; if the property does not exist it becomes an empty string, so the same pom works with and without JaCoCo.
- In test-only repos coverage of the *framework* is rarely the point, but agents (JaCoCo for the app under test via remote agents, a Java agent for AspectJ-based reporting such as Allure's TestNG integration) use exactly this mechanism.

### ShopEasy scenario: one module, fast and slow tests

The \`ui-tests\` module contains \`ConfigReaderTest\` and \`PriceFormatterTest\` (milliseconds, no browser) and \`CartIT\`, \`CheckoutIT\` (Selenium against \`http://localhost:5180/practice-site\`). \`mvn test\` gives developers feedback in seconds; \`mvn verify\` runs both; Failsafe's \`post-integration-test\` generates the report even when \`CheckoutIT\` fails on the 8% tax line.

\`\`\`text
mvn -pl ui-tests -am test                                   # framework unit checks only
mvn -pl ui-tests -am verify -Dbrowser=firefox -Dheadless=true
mvn -pl ui-tests -am verify -Dit.test=CheckoutIT -Dsurefire.failIfNoSpecifiedTests=false
mvn -pl api-tests -am verify -Dgroups=smoke -DapiUrl=http://localhost:5181
\`\`\`

\`-Dit.test\` and \`-Dtest\` apply to **every** module in the reactor; upstream modules without a matching test would fail with "No tests matching pattern … were executed" — hence the \`failIfNoSpecifiedTests=false\` flag (Surefire's and Failsafe's are separate: \`surefire.failIfNoSpecifiedTests\` / \`failsafe.failIfNoSpecifiedTests\` — older Failsafe versions used \`it.failIfNoSpecifiedTests\`, now deprecated).

### Multiple approaches: where UI tests run

| | Everything in Surefire, selected by groups/profiles | Surefire for fast checks, Failsafe for UI/API suites | Separate Maven modules per suite (both on Failsafe) |
|---|---|---|---|
| How | \`mvn test -Psmoke\` | \`mvn test\` vs \`mvn verify\` | \`-pl ui-tests\` / \`-pl api-tests\` |
| Advantages | simplest pom; everyone knows \`mvn test\` | reports/teardown before failing; natural fast/slow split | independent dependencies (API suite has no Selenium), independent CI jobs |
| Disadvantages | report plugins after \`test\` skipped on failure; need \`testFailureIgnore\` hacks | two naming conventions; \`mvn integration-test\` trap | more poms; reactor flags to learn |
| Performance | same | fast loop much faster | best CI parallelism (jobs per module) |
| Maintainability | degrades with size | good | best for several suites |
| When | a small single-suite repo | any repo with setup/teardown or framework unit tests | multi-suite frameworks |

**Recommended approach and why:** Failsafe for anything that talks to a browser or a deployed service, Surefire for framework unit tests, and modules once you have more than one suite type.

## 8. Reproducible Maven: wrapper, .mvn and settings.xml

### Maven Wrapper and .mvn

\`mvn wrapper:wrapper\` (optionally \`-Dmaven=3.9.16\`) adds \`mvnw\`, \`mvnw.cmd\` and \`.mvn/wrapper/maven-wrapper.properties\` with a \`distributionUrl\`. Every developer and agent runs \`./mvnw verify\` and gets the same Maven, downloaded on first use. The default type is \`only-script\` (no jar committed); add \`distributionSha256Sum\` to verify the download. In corporate networks, point \`distributionUrl\` at the internal repository's proxy of Maven Central.

\`\`\`text
# .mvn/maven.config   (Maven 3.9+: one argument per line; '#' comments since 3.9.3)
--batch-mode
--no-transfer-progress
--fail-at-end
-Dstyle.color=never
\`\`\`

\`\`\`text
# .mvn/jvm.config     (JVM of Maven itself, not of the tests; no comments in Maven 3)
-Xmx1g -Djava.awt.headless=true
\`\`\`

- \`maven.config\` holds command-line options every build should have; it lives in the **reactor root**.
- \`jvm.config\` configures the **Maven** JVM (compiler, dependency resolution). The test JVM is configured by \`argLine\`. With both \`MAVEN_OPTS\` and \`jvm.config\` setting an option, Maven 3 uses \`MAVEN_OPTS\`.
- \`MAVEN_ARGS\` (3.9+) prepends arguments from the environment — handy on CI agents.
- Be careful putting \`--fail-at-end\` or \`-T\` in \`maven.config\` for developers: it changes failure behaviour of every local command.

### settings.xml: mirrors, proxies, credentials

\`\`\`xml
<!-- ci-settings.xml, committed; contains NO secrets -->
<settings>
  <mirrors>
    <mirror>
      <id>company-nexus</id>
      <mirrorOf>*</mirrorOf>
      <url>https://nexus.example.com/repository/maven-public/</url>
    </mirror>
  </mirrors>
  <servers>
    <server>
      <id>company-nexus</id>                       <!-- matches the mirror / distributionManagement id -->
      <username>\${env.NEXUS_USER}</username>
      <password>\${env.NEXUS_TOKEN}</password>
    </server>
  </servers>
  <proxies>
    <proxy>
      <id>corp-proxy</id>
      <active>true</active>
      <protocol>https</protocol>
      <host>proxy.example.com</host>
      <port>8080</port>
      <nonProxyHosts>localhost|127.0.0.1|*.example.com</nonProxyHosts>
    </proxy>
  </proxies>
</settings>
\`\`\`

Run CI with \`./mvnw -s ci-settings.xml verify\`. Rules: credentials come from **environment variables** injected by the CI secret store (\`\${env.X}\` is interpolated in \`settings.xml\`); never commit a \`settings.xml\` with passwords and never put credentials in the pom; the Maven proxy setting does **not** configure the browser or REST Assured — the tests need their own proxy configuration; keep \`localhost\` in \`nonProxyHosts\` or the ShopEasy calls to port 5181 go through the corporate proxy.

### Offline, caching and CI flags

| Flag / practice | Why |
|---|---|
| \`-B\` / \`--batch-mode\` | no interactive prompts, no ANSI colours in logs |
| \`--no-transfer-progress\` (\`-ntp\`) | removes thousands of "Downloading…" lines |
| \`-T 1C\` | parallel **module** builds; independent of test-level parallelism — two UI modules in parallel double the browsers |
| \`-o\` | offline: resolve only from \`~/.m2\` |
| \`-U\` | re-check SNAPSHOTs and cached failed lookups |
| \`--fail-at-end\` | build every module, report all failures at the end |
| cache \`~/.m2/repository\` keyed on a hash of all \`pom.xml\` files | saves minutes per build |
| exclude \`~/.m2/repository/com/shopeasy\` from the cache | never restore stale SNAPSHOTs of your own modules |

\`dependency:go-offline\` pre-fetches most artefacts, but not everything (plugins' dynamically resolved providers, for example) — test an offline build before relying on it.

## 9. Maven vs Gradle for test frameworks

| | Maven | Gradle |
|---|---|---|
| Model | declarative XML, fixed lifecycle | programmable build (Kotlin/Groovy DSL), task graph |
| Learning curve for QA teams | low; every Java SDET has seen a pom | higher; build scripts are code with their own pitfalls |
| Test execution | Surefire/Failsafe, well-known conventions | \`test\` task + JVM Test Suites plugin; TestNG via \`useTestNG()\` |
| Incremental builds / caching | limited (module level; build cache via extensions) | strong: up-to-date checks, build cache, configuration cache |
| Dependency conflicts | nearest-wins + management | **highest version wins** by default, plus rich constraints |
| IDE / CI support | universal | universal |
| Reproducibility | wrapper + pinned plugins | wrapper + version catalogs + lock files |
| Typical fit | test-only repos, teams with mixed experience | large monorepos where the app is already on Gradle |

**Recommended approach and why:** use what the **product** uses. A test framework living next to a Gradle app should be Gradle — one toolchain, shared version catalog. A standalone test repository is usually better on Maven: the build is configuration, not code, and every new joiner can read it. Note the conflict-resolution difference: Gradle's "newest wins" hides the classic Maven Jackson incident but can also silently upgrade a library past what another dependency supports.

**Equivalent in the Playwright-TypeScript stack:** \`package.json\` + \`package-lock.json\` (\`npm ci\` for reproducible installs) play the role of the pom + resolved tree; npm installs nested copies instead of mediating, so "two versions" is allowed and conflicts appear as duplicated singletons; \`overrides\` is the closest thing to \`<dependencyManagement>\`; npm workspaces correspond to Maven modules. See \`pw-deep-config-environments-ci\`.

## 10. Troubleshooting table

| Symptom | Likely cause | How to confirm | Fix |
|---|---|---|---|
| "Tests run: 0" / class never runs | name does not match default includes (\`CheckoutChecks\`); UI class named \`*Test\` with Failsafe expecting \`*IT\`; groups filter everything | \`-X\` shows the includes; check \`target/test-classes\` | rename or configure \`includes\`; \`failIfNoTests=true\` to make it loud |
| "No tests matching pattern … were executed!" | \`-Dtest\` in a multi-module build; typo | the message names the module | \`-Dsurefire.failIfNoSpecifiedTests=false\`, or \`-pl\` |
| JUnit 5 tests not found | only \`junit-jupiter-api\` without engine; JUnit 4 and 5 mixed without vintage engine | \`dependency:tree -Dincludes=org.junit*\` | use the \`junit-jupiter\` aggregate + \`junit-bom\` |
| Build fails: \`suiteXmlFiles\` not supported | Surefire/Failsafe upgraded to 3.6.1+ | effective POM shows the version | pin 3.5.x or migrate to groups/includes |
| "release version 17 not supported" / "invalid target release" | Maven runs on an older JDK | \`mvn -v\` shows the JDK | set \`JAVA_HOME\`; \`requireJavaVersion\` |
| \`UnsupportedClassVersionError … class file version 61.0\` | a jar compiled for Java 17 run on an older JVM (e.g. the forked JVM uses a different \`jvm\`) | stack trace names the class | align JDKs; Surefire \`jvm\` parameter / toolchains |
| "'build.plugins.plugin.version' for … is missing" | unpinned plugin | warning at the start of the build | pin in \`pluginManagement\`; \`requirePluginVersions\` |
| \`NoSuchMethodError\` / \`NoClassDefFoundError\` at runtime | two versions of one library, the old one won | \`dependency:tree -Dverbose -Dincludes=…\` | BOM/management/exclusion + \`dependencyConvergence\` |
| Fix "does not work" in a multi-module run | stale SNAPSHOT of an upstream module from \`~/.m2\` | log shows module not in reactor | \`-am\`, build from root |
| \`config.properties\` not found | file under \`src/test/java\`, wrong path, or shadowed by a same-named file in a dependency jar (first on classpath wins) | inspect \`target/test-classes\`; \`getResource()\` URL | move to \`src/test/resources\`; unique names per module (\`ui-tests.properties\`) |
| Filtered value still \`\${baseUrl}\` | property undefined, or filtering not enabled for that file | read the copy in \`target/test-classes\` | define a default in \`<properties>\` |
| Garbled €/ä in test data, Windows only | platform encoding for resources or the forked JVM (Java 17 default is platform encoding) | warning "Using platform encoding …" | \`project.build.sourceEncoding=UTF-8\`, \`-Dfile.encoding=UTF-8\` in \`argLine\` |
| Green CI, failing tests | \`mvn integration-test\`; \`testFailureIgnore\`; \`-DskipITs\` left in a job | \`failsafe-summary.xml\` | run \`verify\`; remove the flags |
| Heap settings ignored by tests | set in \`MAVEN_OPTS\`/\`jvm.config\` | \`ps\` shows fork arguments | Surefire/Failsafe \`argLine\` |

## Best practices for experienced engineers

- Pin Maven (wrapper), Java (\`requireJavaVersion\`, \`maven.compiler.release\`) and **every plugin**; upgrade plugins deliberately and read their "what's new" — 3.6 is the proof.
- Versions in one place: BOMs for families, \`<dependencyManagement>\` for the rest, our modules at \`\${project.version}\`.
- Guard the graph with \`dependencyConvergence\` or \`requireUpperBoundDeps\` in \`validate\`.
- Failsafe + \`mvn verify\` for anything with setup/teardown or reports; never \`mvn integration-test\` in CI.
- Pass \`baseUrl\`, \`apiUrl\`, \`browser\` as explicit \`systemPropertyVariables\`; filter only build metadata.
- Profiles for build shape, config files for environment data; print active profiles in CI.
- \`-pl … -am\` or full reactor builds — never test against stale upstream SNAPSHOTs.
- Secrets only through environment variables into \`settings.xml\`/system properties; nothing secret in git.

## Interview questions

### Q: What is the difference between a lifecycle, a phase and a goal?

**Short answer (30–60 s):** A lifecycle is an ordered list of phases (clean, default, site). A phase is a step in it, like \`test\` or \`verify\`; invoking it runs all earlier phases. A goal is a unit of plugin work, like \`surefire:test\`; goals do the actual work and are bound to phases by the packaging or by executions in the pom. Invoking a goal directly runs only that goal.

**Detailed answer:** \`mvn verify\` walks validate → … → test → package → pre-integration-test → integration-test → post-integration-test → verify, executing every goal bound on the way. For \`jar\` packaging, Surefire's \`test\` goal is bound to \`test\` automatically; Failsafe's goals are not bound until you declare an execution. Direct goal invocation (\`mvn surefire:test\`) skips compilation and resource processing, so it runs whatever is in \`target/\` — fine for re-running, wrong after a code change. \`mvn help:describe -Dcmd=verify\` lists the bindings for the current project.

### Q: Maven picked an old Jackson version and tests fail with NoSuchMethodError. Explain why and how you fix it permanently.

**Short answer (30–60 s):** Maven's mediation is nearest-wins, then first declaration — not newest-wins. A library two levels away brought an old \`jackson-databind\` which beat the newer one at the same or greater depth. I confirm with \`dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core\`, import \`jackson-bom\` in \`<dependencyManagement>\` (which overrides mediation for transitives), and add the Enforcer's \`dependencyConvergence\` so it cannot come back.

**Detailed answer:** \`NoSuchMethodError\` is a linkage error: the caller was compiled against a newer API than the class that was loaded. \`-Dverbose\` shows "omitted for conflict with …" for losing versions. Options are BOM import, explicit management, exclusion on the dragging dependency, or replacing the library; I prefer the BOM because Jackson is a family of artefacts that must move together. Then a guard: \`dependencyConvergence\` (strict) or \`requireUpperBoundDeps\` (fails only when a lower version wins). Finally I check whether the library that wanted the old version still works — the excluded version may have been needed.

### Q: dependencyManagement vs dependencies, pluginManagement vs plugins?

**Short answer (30–60 s):** Management sections declare versions and configuration but add nothing; the real sections add the dependency or plugin. Parents put versions in management and children declare usage without versions.

**Detailed answer:** \`<dependencyManagement>\` also forces versions of transitive dependencies — that is its conflict-resolution power — and is where BOMs are imported with \`<scope>import</scope>\`. A dependency in a parent's \`<dependencies>\` lands in every module, which is how an API suite ends up with Selenium. For plugins, a subtlety: plugins bound by the packaging (compiler, surefire, resources, jar) pick up \`pluginManagement\` configuration automatically; Failsafe, Enforcer or JaCoCo must be listed in a module's \`<plugins>\` to run. I verify the result with \`help:effective-pom\`.

### Q: Why use Failsafe for UI tests? What changes in CI?

**Short answer (30–60 s):** Failsafe runs tests in \`integration-test\` and fails the build only in \`verify\`, so \`post-integration-test\` — stopping a Grid, generating reports — still runs when tests fail. Default class names are \`*IT\`. CI must run \`mvn verify\`, never \`mvn integration-test\`, or the build is green with failing tests.

**Detailed answer:** It also gives a natural fast/slow split: \`mvn test\` runs framework unit tests in seconds, \`mvn verify\` runs everything. Reports go to \`target/failsafe-reports\` (CI's JUnit publisher must read both folders), selection is \`-Dit.test\`, skipping is \`-DskipITs\` — and from Failsafe 3.6 \`-DskipTests\` no longer skips Failsafe at all. Teams that keep everything in Surefire end up with \`testFailureIgnore\` plus a separate gate to get reports, which reinvents Failsafe badly.

### Q: What changed in Surefire 3.6 and how does it affect a TestNG framework?

**Short answer (30–60 s):** 3.6 removed the per-framework providers; everything runs through one JUnit Platform provider, TestNG via its JUnit Platform engine. TestNG suite XML files cannot run on the Platform, so \`suiteXmlFiles\` is ignored in 3.6.0 and fails the build from 3.6.1. You either pin 3.5.x or move selection to groups/includes or a \`@Suite\` class.

**Detailed answer:** Groups, listeners, reporters and \`parallel\`/\`threadCount\` are still mapped. What \`testng.xml\` did beyond selection — \`<parameter>\` values, a \`<test>\` per browser — must move to system properties and CI matrices. I pin 3.5.5 explicitly for existing suites so an upgrade is a decision, and schedule a migration; new frameworks are built on groups from the start. Side effects worth knowing: minimum TestNG 6.14.3, \`runOrder=hourly\` removed, Failsafe's \`-DskipTests\` binding removed.

### Q: How would you structure a multi-module test framework, and when would you publish the framework as a separate artifact?

**Short answer (30–60 s):** Parent POM with BOMs, plugin management and Enforcer; \`framework-core\`, \`pages\` and \`api-client\` as library modules with code in \`src/main/java\`; \`ui-tests\` and \`api-tests\` as test modules on Failsafe. Monorepo first; publish \`framework-core\` and \`api-client\` to Nexus with semantic versions once a second team consumes them.

**Detailed answer:** Module boundaries enforce architecture — \`api-client\` has no Selenium, \`api-tests\` cannot import a page object. The reactor sorts modules by dependency, \`-pl ui-tests -am\` builds what a suite needs, \`-amd\` tells me what a core change affects. Monorepo wins on atomic PRs; a published jar wins on independent cadence but costs releases, changelogs and version skew. Never consume another team's framework as a SNAPSHOT.

### Q: What is @{argLine} and why does it exist?

**Short answer (30–60 s):** Late property replacement in Surefire/Failsafe's \`argLine\`. \`\${argLine}\` is resolved when the pom model is built; \`@{argLine}\` when the test goal runs, so it sees the value JaCoCo's \`prepare-agent\` set earlier in the build. If the property is missing it becomes empty.

**Detailed answer:** Without it you either lose the coverage agent (your \`argLine\` overwrote it) or break the build when JaCoCo is not active (literal \`\${argLine}\` passed to the JVM). Combined form: \`<argLine>@{argLine} -Xmx1g -Dfile.encoding=UTF-8</argLine>\`. And \`MAVEN_OPTS\` never reaches the forked test JVM — a frequent "my heap setting is ignored" cause.

### Q: skipTests vs maven.test.skip vs testFailureIgnore?

**Short answer (30–60 s):** \`skipTests\` compiles tests but does not run them; \`maven.test.skip\` skips compiling and running; \`maven.test.failure.ignore\` runs them and keeps the build green on failure. None belongs in a default test pipeline.

**Detailed answer:** \`maven.test.skip\` breaks modules that depend on a \`test-jar\`, because it was never compiled. From Failsafe 3.6, \`-DskipTests\` no longer affects Failsafe — use \`-DskipITs\`. \`testFailureIgnore\` is sometimes combined with a CI step that marks the build unstable from the XML reports; that must be a deliberate, documented choice, not a way to get green.

## Scenario-based questions

### Scenario 1: "Green locally, red on Jenkins with NoSuchMethodError"

Reasoning: same code, different classpath — local and CI resolve differently. Causes: a stale SNAPSHOT of our framework in a developer's \`~/.m2\`, a version range, a CI cache restoring an old artefact, or a module built without \`-am\`. Actions: compare \`mvn -v\` and \`dependency:tree -Dverbose\` from both machines (save the tree as a CI artefact), check the reactor order in the Jenkins log, clear the cached \`com/shopeasy\` folder from the CI cache key, then fix the root cause with a BOM/management entry and add \`dependencyConvergence\`. I communicate it as: "the build was non-deterministic; it is now deterministic and guarded".

### Scenario 2: the plugin upgrade that broke every suite

A Renovate/Dependabot PR bumps Surefire and Failsafe to 3.6.1; the build now fails because \`suiteXmlFiles\` is set. Reasoning: this is a documented breaking change, not a bug. Actions: decline the bump (pin 3.5.x with a comment linking the "What's New in 3.6.x" page), create a migration ticket: map each \`testng.xml\` to a group selection or \`@Suite\` class, move \`<parameter>\` values to system properties, move per-browser \`<test>\` blocks to the CI matrix; run old and new selection side by side and compare test counts before switching.

### Scenario 3: developers wait 25 minutes for mvn test

Reasoning: fast and slow tests share one phase. Actions: rename Selenium/API classes to \`*IT\`, add Failsafe with \`integration-test\`/\`verify\` executions in the parent, keep framework unit tests on Surefire; CI runs \`./mvnw -B -ntp verify\`; developers run \`mvn test\` (seconds) or \`-pl ui-tests -am verify -Dit.test=CartIT\` for one suite. Measure the before/after and verify the total test count did not drop — a rename that misses a class silently removes coverage.

## Tricky follow-ups

- **Q: Does \`<dependencyManagement>\` affect plugin dependencies?** No. Plugin classpaths are resolved separately; override a plugin's dependency inside \`<plugin><dependencies>\`.
- **Q: Two BOMs manage Jackson with different versions — which wins?** The first imported; an explicit entry in your own \`<dependencyManagement>\` beats both.
- **Q: Is a \`test\`-scoped dependency of \`framework-core\` visible to \`ui-tests\`?** No — \`test\` and \`provided\` are not transitive. Shared framework code and its libraries belong in \`src/main/java\` with \`compile\` scope.
- **Q: Does \`activeByDefault\` combine with \`-Puat\`?** No — any explicitly activated profile in the same pom turns all \`activeByDefault\` profiles off. Keep defaults in top-level \`<properties>\`.
- **Q: Does \`-T 4\` make tests run in parallel?** It builds independent **modules** in parallel. Test parallelism is TestNG/JUnit threads and Surefire forks — and \`-T\` multiplies with them.`,
  keyPoints: [
    'Phases run everything before them; goals do the work and are bound by packaging or executions; a directly invoked goal skips all phases. CI runs `mvn clean verify`, never `mvn integration-test`.',
    'help:effective-pom is the truth. Management sections (dependencyManagement, pluginManagement) only declare versions and configuration; dependencyManagement also overrides transitive versions.',
    'Mediation is nearest-wins, then first declaration — not newest-wins. NoSuchMethodError means two versions, confirmed with dependency:tree -Dverbose, fixed with a BOM or management and guarded by Enforcer dependencyConvergence / requireUpperBoundDeps.',
    'test and provided scopes are not transitive: shared framework code goes in src/main/java with compile scope; test modules consume it with test scope.',
    'Failsafe (*IT, integration-test + verify) lets teardown and reports run before the build fails; Surefire (*Test) fails immediately.',
    'Surefire/Failsafe 3.6 run everything on one JUnit Platform provider: suiteXmlFiles is ignored (3.6.0) or fails the build (3.6.1+), and -DskipTests no longer skips Failsafe. Pin 3.5.x for testng.xml suites or move to groups/includes.',
    'Multi-module: parent with BOMs, pluginManagement and Enforcer; -pl with -am to avoid stale SNAPSHOTs; monorepo first, publish the framework jar when a second team consumes it.',
    'Reproducibility: Maven Wrapper, pinned plugins, .mvn/maven.config, settings.xml with mirrors and credentials from env, CI cache of ~/.m2 without your own SNAPSHOTs.',
  ],
  mistakes: [
    'Running `mvn -pl ui-tests verify` without `-am` and testing against a days-old `pages-1.4.0-SNAPSHOT.jar` from `~/.m2`. Fix: always `-am` (or build from the root); the log line "Reactor Build Order" shows which modules were actually built.',
    'Letting Dependabot bump Surefire/Failsafe to 3.6.1 in a TestNG framework that uses `suiteXmlFiles` — every suite fails at start-up. Fix: pin 3.5.x explicitly in pluginManagement with a comment, then migrate selection to groups/includes or a `@Suite` class and compare test counts before switching.',
    'Fixing a Jackson/Selenium conflict once with an exclusion and no guard — the next dependency re-introduces it. Fix: BOM or dependencyManagement, plus Enforcer `dependencyConvergence` (or `requireUpperBoundDeps`) bound to validate; confirm with `dependency:tree -Dverbose -Dincludes=…`.',
    'Writing `<argLine>-Xmx2g</argLine>` in a project with JaCoCo (agent silently dropped) or `<argLine>\${argLine} -Xmx2g</argLine>` without it (fork fails). Fix: `@{argLine} -Xmx2g`, which is late-replaced and empty when undefined; put test-JVM options in argLine, not MAVEN_OPTS.',
    'Enabling `<filtering>true</filtering>` on all of src/test/resources — avatar PNGs, Excel data and JSON schemas with `${...}` get corrupted. Fix: two testResource entries, filter only config.properties, and prefer runtime system properties for environment values.',
    'Declaring Selenium in the parent `<dependencies>` "to save typing" — the API suite and the aggregator inherit it, and dependency:analyze reports noise. Fix: versions in dependencyManagement/BOM, usage declared per module; check help:effective-pom for each module.',
  ],
  tryIt: `Build a two-module experiment against ShopEasy (about 30 minutes):

1. Create \`shopeasy-lab/\` with a parent pom (packaging \`pom\`), a module \`api-client\` (REST Assured + Jackson, a small \`HealthClient\` calling \`GET http://localhost:5181/api/health\`) and a module \`api-tests\` with \`HealthIT\` asserting \`status\` is \`UP\` and a plain \`ConfigTest\` that checks \`System.getProperty("apiUrl")\` is set.
2. Configure Failsafe in the parent's pluginManagement with \`systemPropertyVariables\` for \`apiUrl\`, \`baseUrl\` and \`browser\`, and enable it only in \`api-tests\`. Run \`mvn test\` and \`mvn verify\` from the root and note which classes ran in each.
3. Stop the API server and run \`mvn integration-test\` vs \`mvn verify\`: compare the build result and \`target/failsafe-reports/failsafe-summary.xml\`.
4. Add an old \`jackson-databind\` (e.g. a 2.9.x version) directly to \`api-client\` and run \`mvn -pl api-tests -am dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core\`. Add the Enforcer with \`dependencyConvergence\` and read its report; then import \`jackson-bom\` and remove the override.
5. Run \`mvn help:effective-pom -pl api-tests\` and find where Failsafe's version and configuration came from.`,
  problems: ['fw-020', 'fw-036', 'fw-014'],
}
