export default {
  slug: 'framework-maven-and-project-structure',
  category: 'framework',
  order: 1,
  title: 'Maven, pom.xml and the framework folder structure',
  minutes: 9,
  summary: 'Read and write a pom.xml (properties, dependencies, scopes, Surefire) and lay out a test framework so every file has an obvious home.',
  manualAnalogy: `Before a manual test cycle you prepare the environment: which browser versions, which tools, which test data folder, where evidence goes. Maven is that preparation written down. \`pom.xml\` lists every tool (library) and version the project needs, and a standard folder layout means any new team member knows where the test cases, data and reports live — like a well-organised shared drive.`,
  body: `## What Maven does for you

Without Maven you would download Selenium's JAR files by hand, copy them into a folder, add them to the IDE and repeat on every machine and on Jenkins. Maven reads one file, \`pom.xml\` (Project Object Model — unrelated to Page Object Model), and:

1. **Downloads dependencies** (libraries) and the libraries *they* need, into a local cache (\`~/.m2\`).
2. **Compiles** your code with the Java version you specify.
3. **Runs tests** through a plugin called **Surefire**.

## Reading a pom.xml

\`\`\`xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>          <!-- 1 -->
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>                              <!-- 2 -->
    <maven.compiler.release>17</maven.compiler.release>
    <jackson.version>2.17.2</jackson.version>
  </properties>

  <dependencies>
    <dependency>                            <!-- 3 -->
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>\${jackson.version}</version>
      <scope>test</scope>                   <!-- 4 -->
    </dependency>
  </dependencies>
</project>
\`\`\`

1. **Coordinates** — \`groupId\` (your organisation, reversed domain), \`artifactId\` (project name), \`version\`. \`SNAPSHOT\` means "work in progress".
2. **Properties** — named values you reuse. \`maven.compiler.release\` sets the Java version. Library versions kept here can be upgraded in one place.
3. **A dependency** is identified by the same three coordinates. \`\${jackson.version}\` inserts the property value. You find coordinates on Maven Central (search.maven.org).
4. **Scope \`test\`** — the library is only on the classpath for code under \`src/test\`. Test-only tools (TestNG, Selenium in a test-only project, Cucumber) normally use it.

A typical UI framework needs: \`selenium-java\`, \`testng\`, \`cucumber-java\`, \`cucumber-testng\` (lets TestNG run Cucumber), often \`cucumber-picocontainer\` (dependency injection for step classes), plus extras like Jackson, Log4j2 and ExtentReports. Cucumber modules must all share **the same version** — a property makes that automatic.

## Surefire: who actually runs the tests

\`\`\`xml
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-surefire-plugin</artifactId>
      <version>3.5.2</version>
      <configuration>
        <!-- tell Surefire which TestNG suite file(s) to run -->
      </configuration>
    </plugin>
  </plugins>
</build>
\`\`\`

\`mvn test\` hands control to Surefire. By default it runs classes named \`*Test\`; pointing it at a TestNG suite file via \`<suiteXmlFiles>\` lets \`testng.xml\` decide what runs (see the *testng.xml* lesson). Surefire also writes result XML into \`target/surefire-reports\`, which CI tools read.

## The standard folder layout

Maven expects this structure — follow it and nothing needs configuring:

\`\`\`
shopeasy-ui-tests/
├── pom.xml
├── testng.xml
├── Jenkinsfile
└── src/test/
    ├── java/com/shopeasy/
    │   ├── pages/        ← page objects & components
    │   ├── steps/        ← Cucumber step definitions (thin)
    │   ├── hooks/        ← @Before/@After
    │   ├── runners/      ← @CucumberOptions runner
    │   ├── driver/       ← DriverFactory (ThreadLocal)
    │   ├── config/       ← ConfigReader
    │   ├── data/         ← POJOs + test-data readers
    │   ├── listeners/    ← TestNG listeners, retry
    │   └── tests/        ← plain TestNG tests (if any)
    └── resources/
        ├── features/     ← .feature files
        ├── config/       ← qa.properties, uat.properties
        ├── testdata/     ← JSON / Excel
        └── log4j2.xml
\`\`\`

The guiding principle: **separate things that change for different reasons.** Locators change when the UI changes (pages). Business wording changes when requirements change (features). URLs change per environment (config). Data changes per test run (testdata). Keeping them apart means one kind of change touches one folder.

\`src/test/java\` holds Java code; \`src/test/resources\` holds non-code files that end up on the **classpath** — the set of places Java searches when you load a file by name (see the *Configuration* lesson).

## What not to commit

\`target/\` (build output, reports, screenshots), IDE folders such as \`.idea/\` and \`*.iml\`, local logs and any file with real passwords belong in \`.gitignore\`. \`pom.xml\`, \`testng.xml\`, features, config templates and test data do get committed.`,
  keyPoints: [
    '`pom.xml` declares coordinates, properties, dependencies and plugins; Maven downloads and builds from it.',
    'Keep versions in `<properties>`; all Cucumber modules must use the same version.',
    'Test-only libraries use `<scope>test</scope>`.',
    'Surefire runs the tests; `<suiteXmlFiles>` points it at testng.xml.',
    'Follow the Maven layout and split packages by reason-to-change: pages, steps, config, data, driver, listeners.',
  ],
  mistakes: [
    'Mixing Cucumber versions (e.g. cucumber-java 7.20 with cucumber-testng 7.14) — runtime errors; use one property.',
    'Putting `.feature` or `.properties` files under `src/test/java` — they belong in `src/test/resources`.',
    'Committing `target/` — it is regenerated on every build; add it to `.gitignore`.',
    'Writing locators inside step definitions — they belong in page objects.',
  ],
  tryIt: `Open the app's Framework Blueprint page and read its \`pom.xml\`. For each dependency write one sentence: what would break if you removed it? Then compare its folder tree with the one above and note what extra packages a bigger project adds.`,
  problems: ['fw-001', 'fw-014'],
}
