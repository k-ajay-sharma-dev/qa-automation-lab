export default {
  slug: 'framework-deep-enterprise-java-selenium',
  category: 'framework',
  order: 17,
  title: `Deep dive: Enterprise Framework A — Java, Selenium, POM, Cucumber, TestNG and Maven, built end to end`,
  minutes: 45,
  summary: `Build a complete enterprise UI framework for ShopEasy file by file — pom, typed settings, scenario-scoped drivers, pages and components, test data, features, steps, hooks, logging, Allure, parallel runner, rerun policy, Jenkins and Grid — and defend every decision with its alternatives.`,
  manualAnalogy: `A well-run manual test team has more than test cases: an agreed vocabulary, a fresh account and clean browser per case, an evidence folder for each failure, a rule for when a failed case may be repeated, and a checklist for new colleagues. This framework is that team handbook turned into code. Each layer answers one question the team lead would otherwise answer by hand.`,
  body: `## What you will have at the end

A complete Maven project, \`tests-java/\`, that drives the ShopEasy practice site. Every file is on this page; copy them in order and \`mvn test\` compiles. How it relates to the **Selenium + Cucumber (Java)** project on the Framework Blueprint page: that one is the interview-size skeleton (string properties, a static \`ThreadLocal\` driver, one log); this one keeps the stack and replaces those parts with typed settings, container-scoped sessions, seeded state, per-scenario evidence, a rerun policy and a compiler-enforced layer boundary.

Theory lives in finished deep dives and is not repeated: action wrappers and listeners (\`selenium-deep-framework-design\`), waits (\`selenium-deep-synchronization\`), thread sizing (\`selenium-deep-parallel-execution\`), Grid (\`selenium-deep-grid-infrastructure\`), page-object design (the five \`pom-deep-*\` lessons), PicoContainer and hooks (\`cucumber-deep-dependency-injection-hooks\`), parallel models and reporters (\`cucumber-deep-execution-reporting-parallel\`), TestNG, Maven, Jenkins and Docker internals (\`framework-deep-*\`). Here the question is: **which decision in which file, and why.**

**Honest limits of ShopEasy.** The web shop is static pages plus \`shop.js\`; it never calls the API on port 5181 and accepts only \`standard_user\` and \`locked_out_user\`. So this is a UI-only framework, and preconditions are set through the browser's \`sessionStorage\`. In a *typical real app* the same "given" steps would call an API or seed a database (\`restassured-deep-api-framework-architecture\`, \`restassured-deep-database-testing-jdbc\`). ShopEasy also has no product-details page: product links do nothing. The product details live on the inventory card, so that is what we model.

## 1. Requirements and architecture decisions

**Requirements** (agree on these before writing code): readable scenarios for the product owner; Chrome, Firefox and Edge; local, Grid and CI from the same build; parallel by default; a failure must be diagnosable from the report alone; no secret in git; a new engineer adds a scenario on day one; reruns must never hide a regression.

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Scenario layer | plain TestNG, Cucumber, Serenity | Cucumber-JVM 7 | required by the brief: business-readable scenarios. If nobody but testers reads them, plain TestNG is cheaper |
| Runner | \`cucumber-testng\`, JUnit Platform engine | \`cucumber-testng\` 7.34.9 | the team's standard. Know the risk: Cucumber 8 deprecates this module, see section 14 |
| Module boundary | all in \`src/test\`, main + test, multi-module | \`src/main\` = framework, \`src/test\` = scenarios | the compiler forbids page objects from importing Cucumber, TestNG or assertions; one module is enough for one product |
| Driver ownership | static \`ThreadLocal\`, scenario-scoped object | PicoContainer-scoped \`BrowserSession\` | see section 4 |
| Page access | static pages, \`new\` in steps, injection | pages are injected, one per scenario | no static state, no "page manager" class |
| Configuration | \`Properties\` map, Owner library, typed record | immutable \`Settings\` record | a typo fails at start-up with the full list of problems |
| Login in preconditions | UI login, API token, storage seeding | storage seeding | ShopEasy's session *is* a \`sessionStorage\` key; the form is tested once, in \`login.feature\` |
| Test data | Excel, JSON, code | records + JSON for reference data + builder for input | typed, diffable, reviewed |
| Evidence | listener, hooks | Cucumber hooks + \`scenario.attach\` | one mechanism feeds the HTML, message and Allure reports |
| Retry | \`IRetryAnalyzer\`, rerun file | one sequential rerun with a budget | section 10 |
| Steps in Allure | \`@Step\` + AspectJ, Gherkin steps | Gherkin steps only | no Java agent to configure; the Gherkin step *is* the step |

\`\`\`text
 features (.feature)                what the business agreed
     │  Cucumber expressions
 bdd: steps · hooks · context       src/test  - the only code that asserts
     │  constructor injection
 ui: pages · components · Waits     src/main  - how the screen works
     │
 driver: BrowserSession · Factory   src/main  - one browser per scenario
     │
 config · data                      src/main  - immutable, shared by all threads
\`\`\`

Dependencies point down only. \`data\` and \`config\` know nothing above them; \`DriverFactory\` is package-private, so a step *cannot* create a browser.

## 2. Folder structure and build

\`\`\`text
tests-java/
├── pom.xml   Jenkinsfile   compose.grid.yml   .gitignore
├── ci/run-suite.sh
└── src/
    ├── main/java/com/shopeasy/e2e/
    │   ├── config/   BrowserName  Secret  Settings  SettingsLoader
    │   ├── data/     Product  Catalogue  Prices  OrderTotals  Customer
    │   ├── driver/   DriverFactory  BrowserSession  SessionSeeder
    │   └── ui/       Waits  BasePage  Header  ProductCard  SortOrder
    │                 LoginPage  InventoryPage  CartPage  CheckoutPage
    └── test/
        ├── java/com/shopeasy/e2e/
        │   ├── bdd/      ScenarioContext  ParameterTypes  Hooks  *Steps
        │   └── runners/  RunCucumberTest  RerunFailedTest
        └── resources/    config/*.properties  data/products.json  features/*.feature
                          suites/*.xml  log4j2.xml  allure.properties
\`\`\`

**\`pom.xml\`**

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-e2e</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>

    <selenium.version>4.54.0</selenium.version>
    <cucumber.version>7.34.9</cucumber.version>
    <testng.version>7.12.0</testng.version>
    <allure.version>2.35.6</allure.version>
    <jackson.version>2.19.0</jackson.version>
    <slf4j.version>2.0.17</slf4j.version>
    <log4j.version>2.25.5</log4j.version>
    <assertj.version>3.27.7</assertj.version>
    <surefire.version>3.5.4</surefire.version>   <!-- 3.6+ drops suiteXmlFiles -->

    <suite>regression</suite>   <!-- src/test/resources/suites/<suite>.xml -->
    <threads>4</threads>        <!-- parallel scenarios = parallel browsers -->
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
        <groupId>org.apache.logging.log4j</groupId>
        <artifactId>log4j-bom</artifactId>
        <version>\${log4j.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>io.qameta.allure</groupId>
        <artifactId>allure-bom</artifactId>
        <version>\${allure.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <!-- framework code (src/main): no test library may appear here -->
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>\${selenium.version}</version>
    </dependency>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>\${jackson.version}</version>
    </dependency>
    <dependency>
      <groupId>org.slf4j</groupId>
      <artifactId>slf4j-api</artifactId>
      <version>\${slf4j.version}</version>
    </dependency>
    <dependency>
      <groupId>org.apache.logging.log4j</groupId>
      <artifactId>log4j-core</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.apache.logging.log4j</groupId>
      <artifactId>log4j-slf4j2-impl</artifactId>
      <scope>runtime</scope>
    </dependency>

    <!-- tests (src/test) -->
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-java</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-testng</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-picocontainer</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>\${testng.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <version>\${assertj.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.qameta.allure</groupId>
      <artifactId>allure-cucumber7-jvm</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-enforcer-plugin</artifactId>
        <version>3.5.0</version>
        <executions>
          <execution>
            <id>toolchain</id>
            <goals><goal>enforce</goal></goals>
            <configuration>
              <rules>
                <requireMavenVersion><version>[3.8,)</version></requireMavenVersion>
                <requireJavaVersion><version>[17,)</version></requireJavaVersion>
                <banDuplicatePomDependencyVersions/>
              </rules>
            </configuration>
          </execution>
        </executions>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.14.0</version>
        <configuration>
          <compilerArgs><arg>-Xlint:all,-processing</arg></compilerArgs>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>\${surefire.version}</version>
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>src/test/resources/suites/\${suite}.xml</suiteXmlFile>
          </suiteXmlFiles>
          <!-- each suite keeps its own XML: the rerun must not overwrite the first run -->
          <reportsDirectory>\${project.build.directory}/surefire-reports/\${suite}</reportsDirectory>
          <properties>
            <property>
              <name>dataproviderthreadcount</name>
              <value>\${threads}</value>
            </property>
          </properties>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
\`\`\`

**Step by step**

- **BOM imports** (Cucumber, Log4j, Allure) keep the many artifacts of one family on one version. Versions live in \`<properties>\` so an upgrade is a one-line diff. (\`4.54.0\`, \`7.34.9\`, \`7.12.0\` and \`2.35.6\` were on Maven Central when this was written; take the newest you have tested, not the newest there is.)
- **No scope on Selenium, Jackson and SLF4J; \`test\` on everything else.** That is the layer boundary: \`import org.testng...\` in a page object does not compile. Log4j is \`runtime\`: code compiles against SLF4J only.
- **Surefire 3.5.4 is pinned.** 3.6.0 ignores \`suiteXmlFiles\` and 3.6.1 fails the build if it is set (\`framework-deep-maven-build-internals\`). An unpinned plugin is how you find out on a Monday.
- **\`dataproviderthreadcount\`**, not \`threadCount\`: Cucumber scenarios are rows of a TestNG DataProvider, and rows have their own pool.
- **\`reportsDirectory\` per suite**: TestNG suites report as \`TEST-TestSuite.xml\`; without separate folders the rerun would overwrite the first run's results.
- \`-Dsuite=…\`, \`-Dthreads=…\`, \`-Dbrowser=…\`: user properties given on the command line become system properties in Surefire's forked JVM without further configuration.
- No \`allure-testng\`: with both adapters every scenario appears twice in the report.

**\`src/test/resources/suites/regression.xml\`**

\`\`\`xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy regression">
  <test name="Cucumber scenarios">
    <classes>
      <class name="com.shopeasy.e2e.runners.RunCucumberTest"/>
    </classes>
  </test>
</suite>
\`\`\`

**\`src/test/resources/suites/rerun.xml\`**

\`\`\`xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy rerun of failures">
  <test name="Failed scenarios, one at a time">
    <classes>
      <class name="com.shopeasy.e2e.runners.RerunFailedTest"/>
    </classes>
  </test>
</suite>
\`\`\`

The suite file stays tiny: no thread counts (Maven owns them), no groups (tags do selection), no listeners (hooks do evidence).

## 3. Configuration: typed, layered, fail-fast

**\`src/test/resources/config/common.properties\`**

\`\`\`properties
# defaults for every environment; an environment file overrides a key only if it differs
browser=chrome
headless=true
timeout.seconds=10
user=standard_user
\`\`\`

**\`src/test/resources/config/local.properties\`**

\`\`\`properties
base.url=http://localhost:5180/practice-site/
headless=false
# public demo password, printed on the login page; real environments use SHOP_PASS
pass=secret_sauce
\`\`\`

**\`src/test/resources/config/ci.properties\`**

\`\`\`properties
base.url=http://localhost:5180/practice-site/
timeout.seconds=15
# no password here: SHOP_PASS comes from the CI credential store
\`\`\`

**\`src/test/resources/config/docker.properties\`**

\`\`\`properties
# base.url is opened by the browser INSIDE the Docker network, grid.url by the JVM on the host
base.url=http://web/practice-site/
grid.url=http://localhost:4444
timeout.seconds=15
pass=secret_sauce
\`\`\`

**\`src/main/java/com/shopeasy/e2e/config/BrowserName.java\`**

\`\`\`java
package com.shopeasy.e2e.config;

import java.util.Arrays;
import java.util.Locale;

public enum BrowserName {
    CHROME, FIREFOX, EDGE;

    public static BrowserName parse(String text) {
        try {
            return valueOf(text.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("expected one of " + Arrays.toString(values()), e);
        }
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/config/Secret.java\`**

\`\`\`java
package com.shopeasy.e2e.config;

/** A value that cannot leak through logs, records or assertion messages by accident. */
public record Secret(String value) {
    @Override
    public String toString() {
        return "********";
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/config/Settings.java\`**

\`\`\`java
package com.shopeasy.e2e.config;

import java.net.URI;
import java.time.Duration;
import java.util.Optional;

/** Everything the framework may know about its environment: typed, validated, immutable. */
public record Settings(String env, URI baseUrl, BrowserName browser, boolean headless,
                       Optional<URI> gridUrl, Duration timeout, String user, Secret password) {

    public static Settings current() {
        return Holder.INSTANCE;
    }

    public String url(String page) {
        return baseUrl.resolve(page).toString();
    }

    /** Lazy and thread-safe: the JVM initialises the class once, on first use. */
    private static final class Holder {
        private static final Settings INSTANCE =
                new SettingsLoader(System::getProperty, System::getenv).load();
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/config/SettingsLoader.java\`**

\`\`\`java
package com.shopeasy.e2e.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Properties;
import java.util.function.Function;

/** -Dkey  >  SHOP_KEY  >  config/<env>.properties  >  config/common.properties */
public final class SettingsLoader {

    private final Function<String, String> systemProperty;
    private final Function<String, String> environment;
    private final List<String> problems = new ArrayList<>();
    private final Properties files = new Properties();

    /** The two sources are parameters, so the loader can be unit-tested without touching the JVM. */
    public SettingsLoader(Function<String, String> systemProperty, Function<String, String> environment) {
        this.systemProperty = systemProperty;
        this.environment = environment;
    }

    public Settings load() {
        String env = override("env").orElse("local");
        readInto(files, "config/common.properties");
        readInto(files, "config/" + env + ".properties");

        URI baseUrl = required("base.url", SettingsLoader::folderUrl);
        BrowserName browser = required("browser", BrowserName::parse);
        Boolean headless = required("headless", SettingsLoader::strictBoolean);
        Duration timeout = required("timeout.seconds", text -> Duration.ofSeconds(Long.parseLong(text)));
        String user = required("user", text -> text);
        Optional<URI> gridUrl = value("grid.url").map(URI::create);
        Optional<Secret> password = secret("pass");
        if (password.isEmpty()) {
            problems.add("pass: set the environment variable SHOP_PASS (or SHOP_PASS_FILE)");
        }

        if (!problems.isEmpty()) {
            throw new IllegalStateException("Invalid configuration for env '" + env + "':\\n  - "
                    + String.join("\\n  - ", problems));
        }
        return new Settings(env, baseUrl, browser, headless, gridUrl, timeout, user, password.get());
    }

    private <T> T required(String key, Function<String, T> parser) {
        Optional<String> text = value(key);
        if (text.isEmpty()) {
            problems.add(key + ": not set (-D" + key + ", " + envName(key) + " or a properties file)");
            return null;
        }
        try {
            return parser.apply(text.get());
        } catch (RuntimeException e) {
            problems.add(key + ": '" + text.get() + "' is invalid - " + e.getMessage());
            return null;
        }
    }

    private Optional<String> value(String key) {
        return override(key).or(() -> notBlank(files.getProperty(key)));
    }

    private Optional<String> override(String key) {
        return notBlank(systemProperty.apply(key)).or(() -> notBlank(environment.apply(envName(key))));
    }

    /** Secrets are never read from -D: command lines show up in process lists and CI logs. */
    private Optional<Secret> secret(String key) {
        return notBlank(environment.apply(envName(key)))
                .or(() -> notBlank(environment.apply(envName(key) + "_FILE")).map(SettingsLoader::readFile))
                .or(() -> notBlank(files.getProperty(key)))
                .map(Secret::new);
    }

    private static String envName(String key) {
        return "SHOP_" + key.toUpperCase(Locale.ROOT).replace('.', '_');
    }

    private static Optional<String> notBlank(String text) {
        return Optional.ofNullable(text).map(String::trim).filter(t -> !t.isEmpty());
    }

    private static URI folderUrl(String text) {
        if (!text.endsWith("/")) {
            throw new IllegalArgumentException("must end with '/' so that page names resolve below it");
        }
        return URI.create(text);
    }

    private static boolean strictBoolean(String text) {
        return switch (text.toLowerCase(Locale.ROOT)) {
            case "true" -> true;
            case "false" -> false;
            default -> throw new IllegalArgumentException("expected true or false");
        };
    }

    private static String readFile(String path) {
        try {
            return Files.readString(Path.of(path)).trim();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read the secret file " + path, e);
        }
    }

    private static void readInto(Properties target, String resource) {
        try (InputStream in = SettingsLoader.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing " + resource + " - check -Denv / SHOP_ENV");
            }
            target.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + resource, e);
        }
    }
}
\`\`\`

**Why it looks like this**

- **All problems at once.** \`required\` collects; \`load\` throws once with a list. Fixing one key per CI run is a bad afternoon.
- **\`SHOP_\` prefix.** Plain \`BROWSER\` or \`USER\` are already set by shells, desktops and IDE terminals; an unprefixed lookup silently reads somebody else's variable.
- **Secrets skip \`-D\`**: command lines appear in process lists and CI logs. \`SHOP_PASS_FILE\` reads Docker/Kubernetes secret files. The \`Secret\` type masks itself, so logging the whole \`Settings\` record is safe.
- **\`strictBoolean\`**: \`Boolean.parseBoolean("yes")\` is \`false\`; here it is an error.
- **A static holder is fine for this**, although we avoid static state elsewhere: the object is immutable and identical for every thread. What must not be static is *scenario* state.
- The two \`Function\` parameters make the loader unit-testable: pass \`Map::get\` of two maps.

Alternatives: the Owner or Typesafe Config libraries (less code, one more dependency), Spring \`@ConfigurationProperties\` (right if the suite already runs on Spring), or a nested YAML file. A \`Properties\` map with \`get("timout")\` is the one to reject in review.

## 4. Driver lifecycle

**\`src/main/java/com/shopeasy/e2e/driver/DriverFactory.java\`**

\`\`\`java
package com.shopeasy.e2e.driver;

import com.shopeasy.e2e.config.Settings;
import java.net.MalformedURLException;
import java.net.URI;
import org.openqa.selenium.MutableCapabilities;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.chromium.ChromiumOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.remote.LocalFileDetector;
import org.openqa.selenium.remote.RemoteWebDriver;

/** The only class that knows browser classes, options and the Grid. */
final class DriverFactory {

    private DriverFactory() {
    }

    static WebDriver create(Settings settings, String sessionName) {
        return settings.gridUrl()
                .map(grid -> remote(grid, settings, sessionName))
                .orElseGet(() -> local(settings));
    }

    private static WebDriver local(Settings settings) {
        return switch (settings.browser()) {
            case CHROME -> new ChromeDriver(chrome(settings));
            case EDGE -> new EdgeDriver(edge(settings));
            case FIREFOX -> new FirefoxDriver(firefox(settings));
        };
    }

    private static WebDriver remote(URI grid, Settings settings, String sessionName) {
        MutableCapabilities options = switch (settings.browser()) {
            case CHROME -> chrome(settings);
            case EDGE -> edge(settings);
            case FIREFOX -> firefox(settings);
        };
        options.setCapability("se:name", sessionName);
        try {
            RemoteWebDriver driver = new RemoteWebDriver(grid.toURL(), options);
            driver.setFileDetector(new LocalFileDetector());
            return driver;
        } catch (MalformedURLException e) {
            throw new IllegalStateException("grid.url is not a URL: " + grid, e);
        }
    }

    private static ChromeOptions chrome(Settings settings) {
        return chromium(new ChromeOptions(), settings);
    }

    private static EdgeOptions edge(Settings settings) {
        return chromium(new EdgeOptions(), settings);
    }

    private static <T extends ChromiumOptions<?>> T chromium(T options, Settings settings) {
        options.addArguments("--window-size=1366,900");
        if (settings.headless()) {
            options.addArguments("--headless=new");
        }
        return options;
    }

    private static FirefoxOptions firefox(Settings settings) {
        FirefoxOptions options = new FirefoxOptions();
        options.addArguments("--width=1366", "--height=900");
        if (settings.headless()) {
            options.addArguments("-headless");
        }
        return options;
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/driver/BrowserSession.java\`**

\`\`\`java
package com.shopeasy.e2e.driver;

import com.shopeasy.e2e.config.Settings;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** One per scenario (PicoContainer creates it). Starts the browser on first use. */
public final class BrowserSession {

    private static final Logger LOG = LoggerFactory.getLogger(BrowserSession.class);

    private final Settings settings = Settings.current();
    private String name = "unnamed";
    private WebDriver driver;

    public Settings settings() {
        return settings;
    }

    public void rename(String sessionName) {
        this.name = sessionName;
    }

    public WebDriver driver() {
        if (driver == null) {
            LOG.info("starting {} for '{}'", settings.browser(), name);
            driver = DriverFactory.create(settings, name);
        }
        return driver;
    }

    public boolean isStarted() {
        return driver != null;
    }

    public void close() {
        if (driver == null) {
            return;
        }
        try {
            driver.quit();
        } finally {
            driver = null;
        }
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/driver/SessionSeeder.java\`**

\`\`\`java
package com.shopeasy.e2e.driver;

import com.shopeasy.e2e.data.Product;
import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.JavascriptExecutor;

/** Writes the two sessionStorage keys ShopEasy itself writes. The only class that knows them. */
public final class SessionSeeder {

    private static final String SCRIPT = """
            sessionStorage.setItem('shopeasy.user', arguments[0]);
            sessionStorage.setItem('shopeasy.cart', arguments[1]);
            """;

    private final BrowserSession session;

    public SessionSeeder(BrowserSession session) {
        this.session = session;
    }

    public void signIn(String user, List<Product> cart) {
        // storage belongs to an origin: be on the site before writing to it
        session.driver().get(session.settings().url("login.html"));
        String slugs = cart.stream()
                .map(product -> "\\"" + product.slug() + "\\"")
                .collect(Collectors.joining(",", "[", "]"));
        ((JavascriptExecutor) session.driver()).executeScript(SCRIPT, user, slugs);
    }
}
\`\`\`

### ThreadLocal or scenario scope

| | Static \`ThreadLocal<WebDriver>\` | Scenario-scoped \`BrowserSession\` (PicoContainer) |
|---|---|---|
| How it works | one slot per thread, filled and cleared by hooks | a new object graph per scenario, injected by constructor |
| Who may reach it | any class, any time | only classes that declare it |
| Leak risk | pool threads are reused: a missed \`remove()\` gives the next scenario a dead driver | the object dies with the scenario |
| Two browsers in one scenario | a second static slot or a map | inject two sessions, or a small wrapper class |
| Async code (\`CompletableFuture\`) | another thread sees an empty slot | same reference works |
| Unit-testing pages | set a global first | pass a mock |
| When to use | plain TestNG without a container; legacy suites | any Cucumber suite |

**Recommended: scenario scope.** \`ThreadLocal\` is correct when the framework gives you no container, which is why the parallel deep dive uses it with plain TestNG. With Cucumber you already have a container per scenario; adding a thread-bound global next to it creates two sources of truth.

Other decisions: the browser starts **lazily**, so a scenario that fails before needing a browser costs nothing; \`close()\` is idempotent and clears the reference even if \`quit()\` throws; the **generic \`chromium\` helper** shares flags between Chrome and Edge without a cast; \`LocalFileDetector\` is set only for remote sessions, where uploads need it; there are **no implicit waits** anywhere.

**\`SessionSeeder\`** writes exactly what \`shop.js\` writes: the plain user name under \`shopeasy.user\` and a JSON array of slugs under \`shopeasy.cart\`. Trade-off: it couples tests to a storage format. Containing the two keys in one class, plus one scenario that signs in through the real form, makes the coupling cheap. Typical real app: call the login API, then \`driver.manage().addCookie(...)\` on the app's origin.

## 5. UI layer: waits, base page, components, pages

**\`src/main/java/com/shopeasy/e2e/ui/Waits.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.driver.BrowserSession;
import java.util.function.Function;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class Waits {

    private final BrowserSession session;

    public Waits(BrowserSession session) {
        this.session = session;
    }

    public WebElement visible(By locator) {
        return until(locator + " to be visible", ExpectedConditions.visibilityOfElementLocated(locator));
    }

    public WebElement clickable(By locator) {
        return until(locator + " to be visible and enabled", ExpectedConditions.elementToBeClickable(locator));
    }

    public void gone(By locator) {
        until(locator + " to disappear", ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    public void documentComplete() {
        until("the document to finish loading", driver -> "complete".equals(
                ((JavascriptExecutor) driver).executeScript("return document.readyState")));
    }

    public <T> T until(String expectation, Function<WebDriver, T> condition) {
        return new WebDriverWait(session.driver(), session.settings().timeout())
                .ignoring(StaleElementReferenceException.class)
                .withMessage(() -> "Waited for " + expectation + " on " + session.driver().getCurrentUrl())
                .until(condition);
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/BasePage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.driver.BrowserSession;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public abstract class BasePage {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private final BrowserSession session;
    private final String path;
    protected final Waits waits;

    protected BasePage(BrowserSession session, String path) {
        this.session = session;
        this.path = path;
        this.waits = new Waits(session);
    }

    /** The element that proves this page is the one on screen. */
    protected abstract By ready();

    public final void open() {
        log.info("open {}", path);
        session.driver().get(session.settings().url(path));
        waitUntilLoaded();
    }

    /** Element first, then readyState: after a click the OLD document is still "complete" for a moment. */
    public final void waitUntilLoaded() {
        waits.visible(ready());
        waits.documentComplete();
    }

    protected final void click(By locator) {
        log.info("click {}", locator);
        waits.clickable(locator).click();
    }

    protected final void type(By locator, String text) {
        log.info("type '{}' into {}", text, locator);
        fill(locator, text);
    }

    protected final void typeSecret(By locator, String secret) {
        log.info("type ******** into {}", locator);
        fill(locator, secret);
    }

    protected final String text(By locator) {
        return waits.visible(locator).getText();
    }

    protected final List<WebElement> all(By locator) {
        return session.driver().findElements(locator);
    }

    private void fill(By locator, String text) {
        WebElement field = waits.visible(locator);
        field.clear();
        field.sendKeys(text);
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/Header.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.driver.BrowserSession;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** On every shop page. A component that steps ask for directly, not a superclass of pages. */
public final class Header {

    // the icon, not the plain "Cart" text link in the navigation
    private static final By CART_ICON = By.id("shopping-cart-link");
    private static final By BADGE = By.cssSelector("#shopping-cart-link .shopping-cart-badge");
    private static final By USER = By.cssSelector("[data-testid='logged-in-user']");
    private static final By LOGOUT = By.id("logout-link");

    private final BrowserSession session;
    private final Waits waits;

    public Header(BrowserSession session) {
        this.session = session;
        this.waits = new Waits(session);
    }

    /** The badge element does not exist while the cart is empty. */
    public int cartCount() {
        List<WebElement> badges = session.driver().findElements(BADGE);
        return badges.isEmpty() ? 0 : Integer.parseInt(badges.get(0).getText());
    }

    /** Only the inventory page shows the greeting. */
    public String userName() {
        return waits.visible(USER).getText();
    }

    public void openCart() {
        waits.clickable(CART_ICON).click();
        waits.until("the cart page", ExpectedConditions.urlContains("cart.html"));
    }

    public void logout() {
        waits.clickable(LOGOUT).click();
        waits.until("the login page", ExpectedConditions.urlContains("login.html"));
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/ProductCard.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.data.Prices;
import com.shopeasy.e2e.data.Product;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

/** One card of the inventory grid, found by its stable data-slug. */
public final class ProductCard {

    private final Waits waits;
    private final String slug;

    ProductCard(Waits waits, String slug) {
        this.waits = waits;
        this.slug = slug;
    }

    public Product details() {
        WebElement card = waits.visible(root());
        return new Product(slug,
                card.findElement(By.cssSelector(".item-name")).getText(),
                Prices.parse(card.findElement(By.cssSelector(".item-price")).getText()),
                card.findElement(By.cssSelector(".item-desc")).getText());
    }

    /** ShopEasy renames the button id after the click; waiting for the new id proves the cart changed. */
    public void addToCart() {
        waits.clickable(By.id("add-to-cart-" + slug)).click();
        waits.visible(By.id("remove-" + slug));
    }

    public void removeFromCart() {
        waits.clickable(By.id("remove-" + slug)).click();
        waits.visible(By.id("add-to-cart-" + slug));
    }

    private By root() {
        return By.xpath("//div[@data-testid='inventory-item'][.//button[@data-slug='" + slug + "']]");
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/LoginPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.config.Secret;
import com.shopeasy.e2e.driver.BrowserSession;
import org.openqa.selenium.By;

public final class LoginPage extends BasePage {

    private static final By USERNAME = By.id("user-name");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.id("login-button");
    private static final By ERROR = By.id("login-error-message");

    public LoginPage(BrowserSession session) {
        super(session, "login.html");
    }

    @Override
    protected By ready() {
        return LOGIN;
    }

    public void submit(String user, Secret password) {
        type(USERNAME, user);
        typeSecret(PASSWORD, password.value());
        click(LOGIN);
    }

    public String error() {
        return text(ERROR);
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/SortOrder.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import java.util.Arrays;

/** Business wording and the option value of #product-sort, in one place. */
public enum SortOrder {
    NAME_ASC("name A to Z", "az"),
    NAME_DESC("name Z to A", "za"),
    PRICE_ASC("price low to high", "lohi"),
    PRICE_DESC("price high to low", "hilo");

    private final String label;
    private final String value;

    SortOrder(String label, String value) {
        this.label = label;
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static SortOrder fromLabel(String label) {
        return Arrays.stream(values())
                .filter(order -> order.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown sort order: " + label));
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/InventoryPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.driver.BrowserSession;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

public final class InventoryPage extends BasePage {

    private static final By LIST = By.id("inventory-list");
    private static final By NAMES = By.cssSelector("#inventory-list .item-name");
    private static final By SORT = By.id("product-sort");

    public InventoryPage(BrowserSession session) {
        super(session, "inventory.html");
    }

    @Override
    protected By ready() {
        return LIST;
    }

    public ProductCard card(Product product) {
        return new ProductCard(waits, product.slug());
    }

    public void sortBy(SortOrder order) {
        new Select(waits.visible(SORT)).selectByValue(order.value());
    }

    public List<String> productNames() {
        return all(NAMES).stream().map(WebElement::getText).toList();
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/CartPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.driver.BrowserSession;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

public final class CartPage extends BasePage {

    private static final By NAMES = By.cssSelector("#cart-list [data-testid='inventory-item-name']");
    private static final By EMPTY = By.id("empty-cart-message");
    private static final By CHECKOUT = By.id("checkout");

    public CartPage(BrowserSession session) {
        super(session, "cart.html");
    }

    /** Not #cart-list: an empty list has no height, so Selenium never calls it visible. */
    @Override
    protected By ready() {
        return CHECKOUT;
    }

    public List<String> productNames() {
        return all(NAMES).stream().map(WebElement::getText).toList();
    }

    public void remove(Product product) {
        By button = By.id("remove-" + product.slug());
        click(button);
        waits.gone(button);
    }

    public String emptyMessage() {
        return text(EMPTY);
    }

    public boolean canCheckOut() {
        return waits.visible(CHECKOUT).isEnabled();
    }

    public void checkout() {
        click(CHECKOUT);
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/CheckoutPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

import com.shopeasy.e2e.data.Customer;
import com.shopeasy.e2e.data.OrderTotals;
import com.shopeasy.e2e.data.Prices;
import com.shopeasy.e2e.driver.BrowserSession;
import org.openqa.selenium.By;

/** One URL, three steps: the page object follows the steps, not the URL. */
public final class CheckoutPage extends BasePage {

    private static final By STEP_ONE = By.id("checkout-step-one");
    private static final By STEP_TWO = By.id("checkout-step-two");
    private static final By FIRST_NAME = By.id("first-name");
    private static final By LAST_NAME = By.id("last-name");
    private static final By POSTAL_CODE = By.id("postal-code");
    private static final By CONTINUE = By.id("continue");
    private static final By ERROR = By.id("checkout-error-message");
    private static final By SHIP_TO = By.id("summary-ship-to");
    private static final By SUBTOTAL = By.id("summary-subtotal");
    private static final By TAX = By.id("summary-tax");
    private static final By TOTAL = By.id("summary-total");
    private static final By FINISH = By.id("finish");
    private static final By CONFIRMATION = By.cssSelector("[data-testid='complete-header']");
    private static final By ORDER_NUMBER = By.id("order-number");

    public CheckoutPage(BrowserSession session) {
        super(session, "checkout.html");
    }

    @Override
    protected By ready() {
        return STEP_ONE;
    }

    public void submit(Customer customer) {
        type(FIRST_NAME, customer.firstName());
        type(LAST_NAME, customer.lastName());
        type(POSTAL_CODE, customer.postalCode());
        click(CONTINUE);
    }

    public String error() {
        return text(ERROR);
    }

    public OrderTotals totals() {
        waits.visible(STEP_TWO);
        return new OrderTotals(Prices.parse(text(SUBTOTAL)), Prices.parse(text(TAX)), Prices.parse(text(TOTAL)));
    }

    public String shipTo() {
        return text(SHIP_TO);
    }

    public void finish() {
        click(FINISH);
    }

    public String confirmation() {
        return text(CONFIRMATION);
    }

    public String orderNumber() {
        return text(ORDER_NUMBER);
    }
}
\`\`\`

**Step by step**

- **\`Waits\` holds a session, not a driver.** PicoContainer builds all pages before the first step; asking for the driver in a constructor would start the browser too early and defeat laziness.
- **\`withMessage\` is a supplier**, so the URL is read at the moment of failure: "Waited for By.id: checkout to be visible and enabled on …/cart.html".
- **\`BasePage\` is final where it matters** and has nine small methods. It owns navigation, readiness and logged actions; no table, alert or date-picker helpers. Those become components.
- **\`waitUntilLoaded\` checks the element first, then \`readyState\`.** \`shop.js\` runs at the end of the body; a test that types between parsing and script execution works on a page with no listeners. Checking \`readyState\` first would accept the *old* page after a click.
- **\`CartPage.ready()\` is the Checkout button, not \`#cart-list\`**: an empty \`<ul>\` has zero height, and Selenium reports zero-size elements as not displayed. That is the kind of comment worth writing.
- **\`Header\` is a component that steps inject**, not a superclass. \`getCartCount\` on \`LoginPage\` would be a lie: that page has no cart icon.
- **\`ProductCard\` anchors on \`data-slug\`**, because the button's \`id\` and \`data-testid\` change from \`add-to-cart-…\` to \`remove-…\`. Waiting for the new id is the synchronisation *and* proof of the state change.
- **Page methods do not return the next page.** In Cucumber the next step is another method, usually in another class, so a returned page object is thrown away. Fluent navigation (see the \`pom-deep-*\` lessons) pays off in plain TestNG tests.
- Pages return data (\`Product\`, \`OrderTotals\`, \`String\`) and never assert.

**Alternatives:** Screenplay (tasks and abilities; worth it with several actor types), Selenide (waits and screenshots built in: deletes \`Waits\` and half of \`BasePage\`), \`@FindBy\`/PageFactory (no benefit over \`By\` constants, staleness surprises).

## 6. Test data

**\`src/test/resources/data/products.json\`**

\`\`\`json
[
  { "slug": "trailblazer-backpack", "name": "Trailblazer Backpack", "price": 29.99,
    "description": "Water-resistant 22L daypack with a padded laptop sleeve." },
  { "slug": "pulse-bike-light", "name": "Pulse Bike Light", "price": 9.99,
    "description": "USB-rechargeable front light with three flash modes." },
  { "slug": "classic-crew-t-shirt", "name": "Classic Crew T-Shirt", "price": 15.99,
    "description": "Soft cotton crew-neck tee that survives 100 washes." },
  { "slug": "storm-fleece-jacket", "name": "Storm Fleece Jacket", "price": 49.99,
    "description": "Mid-weight fleece with a wind-blocking chest panel." },
  { "slug": "junior-onesie", "name": "Junior Onesie", "price": 7.99,
    "description": "Organic cotton onesie with easy snap buttons." },
  { "slug": "retro-red-tee", "name": "Retro Red Tee", "price": 15.99,
    "description": "Vintage-wash red tee with a 70s ShopEasy logo." }
]
\`\`\`

**\`src/main/java/com/shopeasy/e2e/data/Product.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

import java.math.BigDecimal;

public record Product(String slug, String name, BigDecimal price, String description) {
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/data/Catalogue.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

/** The expected catalogue. Read once, never modified: safe to share between threads. */
public final class Catalogue {

    private static final List<Product> PRODUCTS = load("data/products.json");

    private Catalogue() {
    }

    public static Product byName(String name) {
        return PRODUCTS.stream()
                .filter(product -> product.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("'" + name + "' is not in data/products.json; known: "
                        + PRODUCTS.stream().map(Product::name).toList()));
    }

    private static List<Product> load(String resource) {
        try (InputStream in = Catalogue.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing " + resource);
            }
            return List.copyOf(new ObjectMapper().readValue(in, new TypeReference<List<Product>>() { }));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + resource, e);
        }
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/data/Prices.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

import java.math.BigDecimal;

public final class Prices {

    private Prices() {
    }

    /** "$29.99" to 29.99. BigDecimal, because 0.1 + 0.2 is not 0.3 in a double. */
    public static BigDecimal parse(String text) {
        return new BigDecimal(text.trim().replace("$", "").replace(",", ""));
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/data/OrderTotals.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public record OrderTotals(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.08");

    public static OrderTotals expectedFor(List<Product> products) {
        BigDecimal subtotal = products.stream().map(Product::price).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        return new OrderTotals(subtotal, tax, subtotal.add(tax));
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/data/Customer.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

public record Customer(String firstName, String lastName, String postalCode) {

    /** Valid by default; a scenario changes only what it is about. */
    public static Builder valid() {
        return new Builder();
    }

    public static final class Builder {
        private String firstName = "Asha";
        private String lastName = "Rao";
        private String postalCode = "560001";

        private Builder() {
        }

        public Builder firstName(String value) {
            this.firstName = value;
            return this;
        }

        public Builder lastName(String value) {
            this.lastName = value;
            return this;
        }

        public Builder postalCode(String value) {
            this.postalCode = value;
            return this;
        }

        public Customer build() {
            return new Customer(firstName, lastName, postalCode);
        }
    }
}
\`\`\`

Three kinds of data, three tools. **Reference data** (the catalogue) is JSON loaded once into immutable records. **Input data** (a customer) is a builder that is valid by default, so a scenario states only what it is about. **Expected results** are literals in the feature where the business agreed on numbers (\`$43.18\`), and a small oracle (\`OrderTotals.expectedFor\`) where combinations matter. Records give value equality, so \`isEqualTo\` on a whole card prints a field-level difference. \`BigDecimal\` equality includes scale (\`3.2\` is not \`3.20\`); \`setScale(2)\` in the oracle and two-decimal parsing keep both sides aligned. Keep at least one literal example: an oracle that copies the application's formula copies its bug.

## 7. Features

**\`src/test/resources/features/login.feature\`**

\`\`\`gherkin
@login
Feature: Sign in

  Background:
    Given the sign-in page is open

  @smoke
  Scenario: A customer signs in
    When I sign in as the standard customer
    Then the products page greets the standard customer

  @regression
  Scenario: A locked customer is refused
    When I sign in as "locked_out_user" with the valid password
    Then I see the sign-in error "Error: Sorry, this user has been locked out."

  @regression
  Scenario Outline: Wrong or missing credentials are refused
    When I sign in as "<user>" with password "<password>"
    Then I see the sign-in error "<message>"

    Examples:
      | user          | password | message                                                              |
      |               | any      | Error: Username is required                                          |
      | standard_user |          | Error: Password is required                                          |
      | standard_user | wrong    | Error: Username and password do not match any user in this service   |
\`\`\`

**\`src/test/resources/features/catalogue.feature\`**

\`\`\`gherkin
@catalogue @regression
Feature: Product catalogue

  Background:
    Given I am signed in

  Scenario: Products are sorted by price
    When I sort the products by price low to high
    Then the products are listed in this order:
      | Junior Onesie        |
      | Pulse Bike Light     |
      | Classic Crew T-Shirt |
      | Retro Red Tee        |
      | Trailblazer Backpack |
      | Storm Fleece Jacket  |

  Scenario Outline: A product card shows the product details
    Then the card of "<product>" shows the catalogue details

    Examples:
      | product          |
      | Pulse Bike Light |
      | Junior Onesie    |
\`\`\`

**\`src/test/resources/features/cart.feature\`**

\`\`\`gherkin
@cart @regression
Feature: Shopping cart

  @smoke
  Scenario: Products added in the catalogue appear in the cart
    Given I am signed in
    When I add "Trailblazer Backpack" to the cart
    And I add "Pulse Bike Light" to the cart
    Then the cart badge shows 2
    And my cart contains the products I added

  Scenario: Removing the only product empties the cart
    Given I am signed in with these products in my cart:
      | Retro Red Tee |
    When I remove "Retro Red Tee" from the cart
    Then my cart is empty
    And I cannot check out

  Scenario: The overview charges the cart plus 8% tax
    Given I am signed in with these products in my cart:
      | Storm Fleece Jacket |
      | Junior Onesie       |
    And I start the checkout
    When I continue with valid delivery details
    Then the overview shows the totals of my cart
\`\`\`

**\`src/test/resources/features/checkout.feature\`**

\`\`\`gherkin
@checkout @regression
Feature: Checkout

  Background:
    Given I am signed in with these products in my cart:
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    And I start the checkout

  @smoke
  Scenario: A customer places an order
    When I continue with valid delivery details
    Then the overview shows subtotal $39.98, tax $3.20 and total $43.18
    And the overview ships to the customer
    When I place the order
    Then the order is confirmed
    And the cart badge shows 0

  Scenario Outline: Delivery details are validated
    When I continue with <field> "<value>"
    Then I see the checkout error "<message>"

    Examples:
      | field       | value | message                         |
      | first name  |       | Error: First Name is required   |
      | last name   |       | Error: Last Name is required    |
      | postal code |       | Error: Postal Code is required  |
      | postal code | !!    | Error: Postal Code is invalid   |
\`\`\`

Tag rules: one **capability** tag per feature (\`@cart\`), one **suite** tag (\`@regression\`, plus \`@smoke\` for the few), and **state** tags (\`@wip\`, \`@quarantine\`) that the runner excludes. Feature file names are unique, because they name the log files. Steps speak about the shop, not about buttons; only \`login.feature\` mentions signing in through the form.

## 8. Scenario state, steps and hooks

**\`src/test/java/com/shopeasy/e2e/bdd/ScenarioContext.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import com.shopeasy.e2e.data.Customer;
import com.shopeasy.e2e.data.Product;
import java.util.ArrayList;
import java.util.List;

/** Facts that one step establishes and a step in another class needs. One instance per scenario. */
public final class ScenarioContext {

    private final List<Product> cart = new ArrayList<>();
    private Customer customer;

    public void added(Product product) {
        cart.add(product);
    }

    public void removed(Product product) {
        cart.remove(product);
    }

    public List<Product> cart() {
        return List.copyOf(cart);
    }

    public void orderingAs(Customer value) {
        this.customer = value;
    }

    public Customer customer() {
        if (customer == null) {
            throw new IllegalStateException("No delivery details yet: a step must call orderingAs() first");
        }
        return customer;
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/ParameterTypes.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import com.shopeasy.e2e.data.Catalogue;
import com.shopeasy.e2e.data.Customer;
import com.shopeasy.e2e.data.Prices;
import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.ui.SortOrder;
import io.cucumber.java.ParameterType;
import java.math.BigDecimal;
import java.util.function.BiFunction;

public class ParameterTypes {

    /** Delivery-details field named in Gherkin, applied to a valid customer. */
    public enum DeliveryField {
        FIRST_NAME((customer, value) -> customer.firstName(value)),
        LAST_NAME((customer, value) -> customer.lastName(value)),
        POSTAL_CODE((customer, value) -> customer.postalCode(value));

        private final BiFunction<Customer.Builder, String, Customer.Builder> setter;

        DeliveryField(BiFunction<Customer.Builder, String, Customer.Builder> setter) {
            this.setter = setter;
        }

        public Customer invalidate(String value) {
            return setter.apply(Customer.valid(), value).build();
        }
    }

    @ParameterType("\\"([^\\"]+)\\"")
    public Product product(String name) {
        return Catalogue.byName(name);
    }

    @ParameterType("name A to Z|name Z to A|price low to high|price high to low")
    public SortOrder sortOrder(String label) {
        return SortOrder.fromLabel(label);
    }

    @ParameterType("\\\\$\\\\d+\\\\.\\\\d{2}")
    public BigDecimal money(String text) {
        return Prices.parse(text);
    }

    @ParameterType("first name|last name|postal code")
    public DeliveryField deliveryField(String label) {
        return DeliveryField.valueOf(label.toUpperCase().replace(' ', '_'));
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/SignInSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import com.shopeasy.e2e.config.Secret;
import com.shopeasy.e2e.config.Settings;
import com.shopeasy.e2e.data.Catalogue;
import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.driver.SessionSeeder;
import com.shopeasy.e2e.ui.Header;
import com.shopeasy.e2e.ui.InventoryPage;
import com.shopeasy.e2e.ui.LoginPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;

public class SignInSteps {

    private final Settings settings = Settings.current();
    private final SessionSeeder seeder;
    private final LoginPage loginPage;
    private final InventoryPage inventoryPage;
    private final Header header;
    private final ScenarioContext context;

    public SignInSteps(SessionSeeder seeder, LoginPage loginPage, InventoryPage inventoryPage,
                       Header header, ScenarioContext context) {
        this.seeder = seeder;
        this.loginPage = loginPage;
        this.inventoryPage = inventoryPage;
        this.header = header;
        this.context = context;
    }

    // ---- fast path: the precondition of every scenario that is not about signing in

    @Given("I am signed in")
    public void signedIn() {
        signedInWithCart(List.of());
    }

    @Given("I am signed in with these products in my cart:")
    public void signedInWithCart(List<String> productNames) {
        List<Product> products = productNames.stream().map(Catalogue::byName).toList();
        seeder.signIn(settings.user(), products);
        products.forEach(context::added);
        inventoryPage.open();
    }

    // ---- the real form: the subject of login.feature

    @Given("the sign-in page is open")
    public void signInPageIsOpen() {
        loginPage.open();
    }

    @When("I sign in as the standard customer")
    public void signInAsStandardCustomer() {
        loginPage.submit(settings.user(), settings.password());
    }

    @When("I sign in as {string} with the valid password")
    public void signInWithValidPassword(String user) {
        loginPage.submit(user, settings.password());
    }

    @When("I sign in as {string} with password {string}")
    public void signInWithPassword(String user, String password) {
        loginPage.submit(user, new Secret(password));
    }

    @Then("the products page greets the standard customer")
    public void greeted() {
        inventoryPage.waitUntilLoaded();
        assertThat(header.userName()).isEqualTo(settings.user());
    }

    @Then("I see the sign-in error {string}")
    public void signInError(String message) {
        assertThat(loginPage.error()).isEqualTo(message);
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CatalogueSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.ui.InventoryPage;
import com.shopeasy.e2e.ui.SortOrder;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;

public class CatalogueSteps {

    private final InventoryPage inventoryPage;

    public CatalogueSteps(InventoryPage inventoryPage) {
        this.inventoryPage = inventoryPage;
    }

    @When("I sort the products by {sortOrder}")
    public void sortBy(SortOrder order) {
        inventoryPage.sortBy(order);
    }

    @Then("the products are listed in this order:")
    public void listedInOrder(List<String> names) {
        assertThat(inventoryPage.productNames()).containsExactlyElementsOf(names);
    }

    @Then("the card of {product} shows the catalogue details")
    public void cardShowsDetails(Product product) {
        assertThat(inventoryPage.card(product).details()).isEqualTo(product);
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CartSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import com.shopeasy.e2e.data.Product;
import com.shopeasy.e2e.ui.CartPage;
import com.shopeasy.e2e.ui.Header;
import com.shopeasy.e2e.ui.InventoryPage;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class CartSteps {

    private final InventoryPage inventoryPage;
    private final CartPage cartPage;
    private final Header header;
    private final ScenarioContext context;

    public CartSteps(InventoryPage inventoryPage, CartPage cartPage, Header header, ScenarioContext context) {
        this.inventoryPage = inventoryPage;
        this.cartPage = cartPage;
        this.header = header;
        this.context = context;
    }

    @When("I add {product} to the cart")
    public void add(Product product) {
        inventoryPage.card(product).addToCart();
        context.added(product);
    }

    @When("I remove {product} from the cart")
    public void remove(Product product) {
        openCart();
        cartPage.remove(product);
        context.removed(product);
    }

    @Then("the cart badge shows {int}")
    public void badgeShows(int count) {
        assertThat(header.cartCount()).as("cart badge").isEqualTo(count);
    }

    @Then("my cart contains the products I added")
    public void cartContainsWhatIAdded() {
        openCart();
        assertThat(cartPage.productNames())
                .containsExactlyElementsOf(context.cart().stream().map(Product::name).toList());
    }

    @Then("my cart is empty")
    public void cartIsEmpty() {
        assertThat(cartPage.emptyMessage()).startsWith("Your cart is empty.");
        assertThat(header.cartCount()).as("cart badge").isZero();
    }

    @Then("I cannot check out")
    public void cannotCheckOut() {
        assertThat(cartPage.canCheckOut()).as("Checkout button enabled").isFalse();
    }

    private void openCart() {
        header.openCart();
        cartPage.waitUntilLoaded();
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CheckoutSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import com.shopeasy.e2e.data.Customer;
import com.shopeasy.e2e.data.OrderTotals;
import com.shopeasy.e2e.ui.CartPage;
import com.shopeasy.e2e.ui.CheckoutPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.math.BigDecimal;

public class CheckoutSteps {

    private final CartPage cartPage;
    private final CheckoutPage checkoutPage;
    private final ScenarioContext context;

    public CheckoutSteps(CartPage cartPage, CheckoutPage checkoutPage, ScenarioContext context) {
        this.cartPage = cartPage;
        this.checkoutPage = checkoutPage;
        this.context = context;
    }

    @Given("I start the checkout")
    public void startCheckout() {
        cartPage.open();
        cartPage.checkout();
        checkoutPage.waitUntilLoaded();
    }

    @When("I continue with valid delivery details")
    public void continueWithValidDetails() {
        continueAs(Customer.valid().build());
    }

    @When("I continue with {deliveryField} {string}")
    public void continueWithInvalid(ParameterTypes.DeliveryField field, String value) {
        continueAs(field.invalidate(value));
    }

    @When("I place the order")
    public void placeOrder() {
        checkoutPage.finish();
    }

    @Then("the overview shows subtotal {money}, tax {money} and total {money}")
    public void overviewShows(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {
        assertThat(checkoutPage.totals()).isEqualTo(new OrderTotals(subtotal, tax, total));
    }

    @Then("the overview shows the totals of my cart")
    public void overviewShowsCartTotals() {
        assertThat(checkoutPage.totals()).isEqualTo(OrderTotals.expectedFor(context.cart()));
    }

    @Then("the overview ships to the customer")
    public void shipsToCustomer() {
        Customer c = context.customer();
        assertThat(checkoutPage.shipTo())
                .isEqualTo(c.firstName() + " " + c.lastName() + ", " + c.postalCode());
    }

    @Then("the order is confirmed")
    public void confirmed() {
        assertThat(checkoutPage.confirmation()).isEqualTo("Thank you for your order!");
        assertThat(checkoutPage.orderNumber()).matches("SE-\\\\d{6}");
    }

    @Then("I see the checkout error {string}")
    public void checkoutError(String message) {
        assertThat(checkoutPage.error()).isEqualTo(message);
    }

    private void continueAs(Customer customer) {
        checkoutPage.submit(customer);
        context.orderingAs(customer);
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/Hooks.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

import com.shopeasy.e2e.config.Settings;
import com.shopeasy.e2e.driver.BrowserSession;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.BeforeAll;
import io.cucumber.java.Scenario;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

public class Hooks {

    private static final Logger LOG = LoggerFactory.getLogger(Hooks.class);

    private final BrowserSession session;
    private String scenarioId;

    public Hooks(BrowserSession session) {
        this.session = session;
    }

    @BeforeAll
    public static void failFastOnBadConfiguration() {
        LOG.info("{}", Settings.current());          // Secret.toString() masks the password
    }

    @Before(order = 0)
    public void nameTheScenario(Scenario scenario) {
        scenarioId = idOf(scenario);
        MDC.put("scenario", scenarioId);
        session.rename(scenario.getName());
        LOG.info("START {} {}", scenario.getName(), scenario.getSourceTagNames());
    }

    // @After runs from the highest order to the lowest
    @After(order = 100)
    public void browserEvidence(Scenario scenario) {
        if (!scenario.isFailed() || !session.isStarted()) {
            return;
        }
        WebDriver driver = session.driver();
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", "screen at failure");
            scenario.attach(driver.getCurrentUrl(), "text/plain", "url at failure");
        } catch (WebDriverException e) {
            LOG.warn("no screenshot: {}", e.toString());   // never hide the original failure
        }
    }

    @After(order = 50)
    public void quitBrowser() {
        session.close();
    }

    @After(order = 10)
    public void logEvidence(Scenario scenario) {
        LOG.info("END {} {}", scenario.getStatus(), scenario.getName());
        if (scenario.isFailed()) {
            attachLog(scenario);
        }
        MDC.remove("scenario");                      // the thread goes back to TestNG's pool
    }

    private void attachLog(Scenario scenario) {
        Path file = Path.of("target", "logs", scenarioId + ".log");
        try {
            scenario.attach(Files.readString(file), "text/plain", "scenario log");
        } catch (IOException e) {
            LOG.warn("no scenario log: {}", e.toString());
        }
    }

    /** "checkout-13": unique per example row, and a legal file name on Windows. */
    private static String idOf(Scenario scenario) {
        String uri = scenario.getUri().toString();
        String file = uri.substring(uri.lastIndexOf('/') + 1).replace(".feature", "");
        return file + "-" + scenario.getLine();
    }
}
\`\`\`

**Step by step**

- **The wiring is the constructors.** For each scenario \`cucumber-picocontainer\` creates the step classes and, recursively, everything their constructors ask for: pages, \`Header\`, \`SessionSeeder\`, one \`BrowserSession\`, one \`ScenarioContext\`. There is no registration file and no \`@Inject\`. Because \`LoginPage\` and \`Hooks\` ask for the same type, they get the same instance.
- **\`ScenarioContext\` is typed and small.** \`Map<String,Object>\` contexts fail at run time with \`ClassCastException\` and nobody knows who writes which key. \`customer()\` fails with an explanation instead of a \`NullPointerException\` three steps later.
- **Parameter types** turn Gherkin words into domain objects before a step runs: \`{product}\` fails with "'Trailblazr Backpack' is not in data/products.json; known: […]", a typo reported as a typo.
- **Hook order**: \`@Before\` ascending, \`@After\` descending. Evidence (100) needs the browser, quit (50) must happen even if evidence fails, the log attachment (10) comes last so it contains everything. Hooks run after failures, so \`quit\` is guaranteed as long as it does not share a hook with code that throws.
- **\`@BeforeAll\` touches \`Settings\`**, so a bad configuration stops the run with one readable message instead of failing every scenario.
- **MDC**: the scenario id is put on the thread and removed at the end. One scenario stays on one thread; the *thread* is reused, so a missing \`remove\` labels the next scenario's first lines wrongly.

## 9. Logging and reports

**\`src/test/resources/log4j2.xml\`**

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN">
  <Properties>
    <Property name="line">%d{HH:mm:ss.SSS} %-5level [%t] [%X{scenario}] %logger{1} - %msg%n%throwable</Property>
  </Properties>
  <Appenders>
    <Console name="Console"><PatternLayout pattern="\${line}"/></Console>
    <Routing name="PerScenario">
      <Routes pattern="$\${ctx:scenario}">
        <!-- no MDC value: the lookup stays unresolved and equals this key -->
        <Route key="$\${ctx:scenario}">
          <File name="run" fileName="target/logs/run.log"><PatternLayout pattern="\${line}"/></File>
        </Route>
        <Route>
          <File name="scenario-\${ctx:scenario}" fileName="target/logs/\${ctx:scenario}.log">
            <PatternLayout pattern="\${line}"/>
          </File>
        </Route>
      </Routes>
      <IdlePurgePolicy timeToLive="2" timeUnit="minutes"/>
    </Routing>
  </Appenders>
  <Loggers>
    <Logger name="com.shopeasy" level="info"/>
    <Root level="warn">
      <AppenderRef ref="Console"/>
      <AppenderRef ref="PerScenario"/>
    </Root>
  </Loggers>
</Configuration>
\`\`\`

**\`src/test/resources/allure.properties\`**

\`\`\`properties
allure.results.directory=target/allure-results
\`\`\`

The **Routing appender** picks a file per event from the MDC value: \`target/logs/checkout-13.log\` contains one scenario even with eight running in parallel, and the hook attaches that file to the failed scenario. A route whose key equals the unresolved lookup receives lines without a scenario. Idle file appenders are closed by the purge policy.

| Report | Produced by | Reader |
|---|---|---|
| \`target/cucumber/report.html\` | Cucumber's html plugin | anyone with the file; screenshots and logs embedded |
| \`target/cucumber/report.ndjson\` | message plugin | machines: the complete event stream, can be re-rendered |
| Allure | \`AllureCucumber7Jvm\` writing \`target/allure-results\` | the team: history, trends, categories (\`allure serve target/allure-results\`) |
| Surefire XML | TestNG provider | CI test tab, quality gate |

## 10. Runners, parallelism and the retry policy

**\`src/test/java/com/shopeasy/e2e/runners/RunCucumberTest.java\`**

\`\`\`java
package com.shopeasy.e2e.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

@CucumberOptions(
        features = "src/test/resources/features",
        glue = "com.shopeasy.e2e.bdd",
        tags = "not @wip and not @quarantine",
        plugin = {
                "summary",
                "html:target/cucumber/report.html",
                "message:target/cucumber/report.ndjson",
                "rerun:target/cucumber/rerun.txt",
                "io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm"
        },
        publish = false)
public class RunCucumberTest extends AbstractTestNGCucumberTests {

    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/runners/RerunFailedTest.java\`**

\`\`\`java
package com.shopeasy.e2e.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

/** Second, sequential pass over the scenarios listed by the first run. Its own report files. */
@CucumberOptions(
        features = "@target/cucumber/rerun.txt",
        glue = "com.shopeasy.e2e.bdd",
        plugin = {
                "summary",
                "html:target/cucumber/rerun-report.html",
                "rerun:target/cucumber/still-failing.txt",
                "io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm"
        },
        publish = false)
public class RerunFailedTest extends AbstractTestNGCucumberTests {
}
\`\`\`

**\`ci/run-suite.sh\`**

\`\`\`bash
#!/usr/bin/env bash
# First run in parallel, then one sequential rerun of the failed scenarios. Everything else comes from
# the environment: SHOP_ENV, SHOP_BROWSER, SHOP_PASS, CUCUMBER_FILTER_TAGS, THREADS.
set -uo pipefail
rerun_file=target/cucumber/rerun.txt
max_rerun="\${MAX_RERUN:-10}"

mvn -B -ntp clean test -Dthreads="\${THREADS:-4}"
first=$?
[ "$first" -eq 0 ] && exit 0

if [ ! -s "$rerun_file" ]; then
  echo "The build failed but no scenario did: compile, configuration or hook problem. No rerun."
  exit "$first"
fi

failed=$(grep -oE ':[0-9]+' "$rerun_file" | wc -l)
if [ "$failed" -gt "$max_rerun" ]; then
  echo "$failed scenarios failed (limit $max_rerun): that is a broken build or environment, not flakiness."
  exit "$first"
fi

echo "Rerunning $failed scenario(s); a pass here is reported as FLAKY, not as fine."
cp "$rerun_file" target/cucumber/first-run-failures.txt
mvn -B -ntp surefire:test -Dsuite=rerun
\`\`\`

\`@DataProvider(parallel = true)\` hands every scenario to TestNG's data-provider pool; \`-Dthreads=4\` sizes it. Nothing else changes, because nothing scenario-related is static. The \`tags\` in \`@CucumberOptions\` are only a default: \`CUCUMBER_FILTER_TAGS\` or \`-Dcucumber.filter.tags\` **replaces** them, so an override must repeat \`not @wip and not @quarantine\`.

### Which retry?

| | \`IRetryAnalyzer\` on \`runScenario\` | Rerun file, second execution |
|---|---|---|
| How it works | TestNG repeats the DataProvider row immediately | the \`rerun\` plugin writes \`uri:line\`; a second runner reads \`@target/cucumber/rerun.txt\` |
| When it runs | same second, same load, full parallelism | after the run, sequential, calm machine |
| Cucumber reports | both attempts are separate test cases in one report; totals are inflated and the first failure keeps the report red | two reports: first run stays as evidence, the rerun gives the verdict |
| Hides an overloaded Grid? | often makes it worse | no |
| Budget | per scenario only | limit on the number of failures |
| Cost | one class plus an \`IAnnotationTransformer\` | one runner, one script |
| When to use | plain TestNG tests with a classified analyzer | Cucumber suites |

**Recommended: the rerun file.** For Cucumber, TestNG knows only one method, \`runScenario\`; the rerun plugin works on the scenario level and keeps the first failure visible. The script encodes the policy: no scenario failed but Maven did → infrastructure, no rerun; more than ten failures → a broken build, no rerun; otherwise one sequential rerun, whose exit code is the verdict. Notice what it does **not** do: \`-Dmaven.test.failure.ignore=true\`. With that flag a failing \`@BeforeAll\` would produce an empty rerun file and a green pipeline. A scenario that passes on rerun is listed in \`first-run-failures.txt\` and gets a ticket.

## 11. CI, Grid and Docker

**\`Jenkinsfile\`**

\`\`\`groovy
pipeline {
  agent { label 'linux && java17 && node && browsers' }
  options { timeout(time: 60, unit: 'MINUTES'); timestamps(); disableConcurrentBuilds() }
  parameters {
    choice(name: 'BROWSER', choices: ['chrome', 'firefox', 'edge'], description: 'Browser')
    string(name: 'TAGS', defaultValue: '@regression and not @wip and not @quarantine', description: 'Cucumber tags')
  }
  stages {
    stage('Dry run') {                       // undefined or ambiguous steps fail in seconds
      steps { dir('tests-java') { sh 'mvn -B -ntp clean test -Dcucumber.execution.dry-run=true' } }
    }
    stage('Scenarios') {
      environment {
        SHOP_ENV = 'ci'
        SHOP_BROWSER = "\${params.BROWSER}"
        CUCUMBER_FILTER_TAGS = "\${params.TAGS}"
        SHOP_PASS = credentials('shopeasy-ui-password')      // Secret text
      }
      steps {
        sh 'ci/start-shopeasy.sh'            // in the Jenkins lesson
        dir('tests-java') { sh 'bash ci/run-suite.sh' }
      }
    }
  }
  post {
    always {
      archiveArtifacts artifacts: 'tests-java/target/cucumber/**, tests-java/target/logs/**', allowEmptyArchive: true
      allure includeProperties: false, jdk: '', results: [[path: 'tests-java/target/allure-results']]
      junit 'tests-java/target/surefire-reports/**/*.xml'
    }
  }
}
\`\`\`

This is deliberately short; stages, matrix, stashing, shared libraries, quality gates and \`ci/start-shopeasy.sh\` are in \`framework-deep-jenkins-ci-cd-pipelines\`. Note the **dry-run stage**: undefined and ambiguous steps fail in seconds without a browser. \`post\` publishes before \`junit\`, so a missing XML cannot suppress the evidence.

**\`compose.grid.yml\`**

\`\`\`yaml
# SHOPEASY_DIR = the checkout of the practice app
services:
  web:
    image: nginx:stable-alpine
    volumes: ["\${SHOPEASY_DIR:?set SHOPEASY_DIR}/public:/usr/share/nginx/html:ro"]
  chrome:
    image: selenium/standalone-chrome:4.54.0-20261124
    shm_size: 2gb
    environment:
      SE_NODE_MAX_SESSIONS: "4"
      SE_NODE_OVERRIDE_MAX_SESSIONS: "true"
    ports: ["4444:4444", "7900:7900"]
    depends_on: [web]
\`\`\`

**\`.gitignore\`**

\`\`\`text
target/
.idea/
*.iml
.env
allure-report/
\`\`\`

The static site needs no Vite here: nginx serves \`public/\`, so the browser opens \`http://web/practice-site/\` while the JVM on your machine talks to the Grid on \`localhost:4444\`. Mixing up those two viewpoints is the classic Docker mistake; \`docker.properties\` documents it. Keep \`SE_NODE_MAX_SESSIONS\` equal to \`-Dthreads\`: with more threads than sessions, scenarios queue and look slow. Images, health checks and a containerised JVM are in \`framework-deep-docker-for-test-automation\`.

## 12. How to run

| Goal | Command (inside \`tests-java\`) |
|---|---|
| everything, headed, local | \`mvn test\` (start the shop with \`npm run dev\` in the app folder) |
| smoke, headless, Firefox | \`mvn test -Dcucumber.filter.tags="@smoke and not @quarantine" -Dbrowser=firefox -Dheadless=true\` |
| one scenario | \`mvn test -Dcucumber.features=src/test/resources/features/cart.feature:5\` |
| eight in parallel | \`mvn test -Dheadless=true -Dthreads=8\` |
| serial, for debugging | \`mvn test -Dthreads=1\` |
| against the Grid | \`SHOPEASY_DIR=/path/to/qa-learning docker compose -f compose.grid.yml up -d\` then \`mvn test -Denv=docker\`; watch on port 7900 |
| step definitions only | \`mvn test -Dcucumber.execution.dry-run=true\` |
| CI behaviour on a laptop | \`SHOP_ENV=ci SHOP_PASS=… bash ci/run-suite.sh\` |
| report | \`allure serve target/allure-results\` |

## 13. Adding a feature: "Remember me"

The login form has a *Remember me* checkbox that keeps the user name in \`localStorage\`. The order of work:

**1. Scenario first** (\`login.feature\`), reviewed with the product owner:

\`\`\`gherkin
  @regression
  Scenario: The shop remembers my user name
    When I sign in as the standard customer and ask to be remembered
    And I sign out
    Then my user name is already filled in
\`\`\`

**2. Dry run** prints the missing snippets. **3. Page behaviour** (\`LoginPage\`):

\`\`\`java
    private static final By REMEMBER_ME = By.name("rememberMe");

    public void rememberMe() {
        click(REMEMBER_ME);
    }

    public String prefilledUser() {
        return waits.visible(USERNAME).getDomProperty("value");   // the live value, not the HTML attribute
    }
\`\`\`

**4. Steps** (\`SignInSteps\`; \`Header.logout()\` already exists):

\`\`\`java
    @When("I sign in as the standard customer and ask to be remembered")
    public void signInAndRemember() {
        loginPage.rememberMe();
        signInAsStandardCustomer();
        inventoryPage.waitUntilLoaded();
    }

    @When("I sign out")
    public void signOut() {
        header.logout();
    }

    @Then("my user name is already filled in")
    public void userNameIsFilledIn() {
        loginPage.waitUntilLoaded();
        assertThat(loginPage.prefilledUser()).isEqualTo(settings.user());
    }
\`\`\`

**5. Prove it can fail**: expect \`"nobody"\` once, look at the screenshot and the log in the report, restore. **6.** Run it ten times in parallel with its neighbours before opening the pull request. Nothing in \`driver\`, \`config\` or \`Hooks\` changed: that is what the layers are for.

## 14. Scaling to 1,000+ scenarios, governance, alternatives

**Scaling.** First reduce, then parallelise. 1,000 browser scenarios × 40 s is 11 hours of browser time; with 40 sessions about 17 minutes plus queueing. Levers, in order of value: move rules to API or unit level (the checkout validation outline needs one UI example, not twelve); seed state instead of clicking; shard by capability tag across CI agents with a catch-all shard; only then buy Grid nodes. Split packages (\`bdd.cart\`, \`ui.cart\`) around 40 pages, and Maven modules when a second team releases independently.

**Governance.**

- *Naming*: features by capability; steps in the customer's language; pages \`…Page\`; no \`Utils\`, \`Helper2\`, \`CommonSteps\`.
- *Review checklist*: no static mutable field, no \`Thread.sleep\`, no \`driver\` in steps, no assertion in \`ui\`, locators by id/test id, a failing run shown, tags present, no duplicate step.
- *Duplicate steps*: the dry run catches ambiguity; \`unused\` plugin output is reviewed monthly and deleted.
- *Quarantine*: a flaky scenario gets \`@quarantine\` plus a ticket and an owner the same day; a nightly job runs only \`@quarantine\`; after two weeks it is fixed or deleted. A cap (say 2 %) is a gate.
- *Versions*: one scheduled upgrade pull request per month, never "while we are at it".

**Upgrade risk.** Cucumber 8 deprecates \`cucumber-testng\` for removal. The exit is cheap *because* of the layers: runners and suite files change to a JUnit Platform \`@Suite\`, \`dataproviderthreadcount\` becomes \`cucumber.execution.parallel.*\`; \`ui\`, \`bdd\`, features and hooks stay.

| Alternative | Choose it when | Price |
|---|---|---|
| plain TestNG, no Cucumber | only engineers read the tests | lose business-readable scenarios; gain speed, refactoring, fluent pages |
| Serenity BDD | living documentation and Screenplay are the goal | a framework with opinions, harder upgrades |
| Selenide | small team wants less plumbing | its own driver management and idioms |
| Playwright for Java | new project, Java team, modern browsers | different ecosystem; runner, retries and fixtures of Playwright *Test* are TypeScript-only |
| Framework B (TypeScript) | front-end team owns tests | see \`pw-deep-enterprise-playwright-typescript\` |

## 15. Common failures and debugging

| Symptom | Likely cause | Where to look / fix |
|---|---|---|
| \`ExceptionInInitializerError\`, then \`NoClassDefFoundError: …Settings$Holder\` | invalid configuration; the second error is only the echo | read the *first* stack trace; it lists all problems |
| every scenario skipped, zero executed | \`@BeforeAll\` threw, so TestNG's \`@BeforeClass\` failed | Surefire XML of the configuration method |
| \`PicoCompositionException\` / unsatisfiable dependency | a constructor parameter that cannot be created (a \`String\`, an interface, a cycle) | inject a concrete class; break the cycle |
| "Undefined step" although it exists | class outside the \`glue\` package | move it below \`com.shopeasy.e2e.bdd\` |
| tags ignored | \`-Dcucumber.filter.tags\` replaced the annotation | effective tag expression; shell quoting |
| one thread despite \`-Dthreads=8\` | \`parallel = true\` missing, or Surefire older/newer than the pin | \`[t]\` in the log lines |
| screenshot attached to the wrong scenario | static driver or page introduced | grep for \`static\` in \`ui\` and \`bdd\` |
| passes alone, fails in parallel | shared account state (typical real app), not here: ShopEasy state is per tab | unique data per scenario |
| \`SessionNotCreatedException\` on the Grid | no free slot, or browser not in the image | Grid UI on 4444; compare sessions and threads |
| page "cannot be reached" only on the Grid | \`base.url\` from the JVM's viewpoint | \`docker.properties\` |
| two Allure entries per scenario | \`allure-testng\` on the classpath | remove it |
| typed text vanishes | typed before \`shop.js\` attached listeners | \`waitUntilLoaded()\` after navigation |

## Best practices for experienced engineers

- Design from the failure backwards: break one locator and judge the report before writing the second feature.
- Keep the framework smaller than the test suite. Every abstraction must delete code in at least three places.
- Make wrong things impossible (scopes, package-private classes, types) before making them forbidden (wiki pages).
- Measure: duration per scenario, rerun rate, quarantine size, time from red to diagnosis.
- Explain a decision with its rejected option; "we use PicoContainer because the template had it" is a junior answer.

**Equivalent in the other stack.** PicoContainer + hooks ≈ Playwright fixtures; \`SessionSeeder\` ≈ \`addInitScript\`; \`RunCucumberTest\` ≈ \`playwright.config.ts\`; Routing log + screenshot hook ≈ trace viewer. The full project is Framework B.

## Interview questions

### Q: Walk me through your framework.
**Short answer (30–60 s):** Four layers, dependencies downward. Features describe behaviour; steps and hooks translate and assert; pages and components know the screen; driver, config and data sit at the bottom. One object graph per scenario comes from PicoContainer, so parallelism is a thread count. Failures carry screenshot, URL and their own log file. CI does a dry run, the parallel run, and one bounded sequential rerun.

**Detailed answer:** Continue with one request through the layers: "I start the checkout" → \`CheckoutSteps\` → \`CartPage.open()\` → \`Waits\` → \`BrowserSession.driver()\` starts the browser lazily → the factory picks local or Grid from typed settings. Then name the boundary that makes it maintainable (framework in \`src/main\`, test libraries only in \`src/test\`) and one trade-off you accepted (storage seeding couples to two keys). Finish with numbers you would track. Interviewers remember trade-offs, not folder names.

### Q: ThreadLocal or dependency injection for the driver?
**Short answer (30–60 s):** With Cucumber, dependency injection: the container already gives one graph per scenario, the dependency is visible in the constructor and nothing leaks through reused pool threads. ThreadLocal is right in plain TestNG, with \`remove()\` in an always-run teardown.

**Detailed answer:** ThreadLocal solves *isolation between threads*; we need *isolation between scenarios*. The two coincide only if every teardown is perfect. Injection also allows two sessions in one scenario and unit tests with a mock. If I inherit a ThreadLocal framework I wrap it behind a session object first, migrate steps, and remove the static accessor last.

### Q: How do you retry failed Cucumber scenarios on TestNG?
**Short answer (30–60 s):** With the rerun plugin and a second, sequential execution that reads the rerun file, limited by a failure budget. Not with an immediate \`IRetryAnalyzer\`, which inflates Cucumber's reports and repeats under the same load.

**Detailed answer:** Explain the three branches of \`run-suite.sh\`, why \`testFailureIgnore\` is dangerous (configuration failures become green), why reruns need their own report files, and that passing on rerun means *flaky*, which is a ticket, not a pass. On Surefire 3.5.x \`rerunFailingTestsCount\` does not cover the TestNG provider; on the JUnit Platform engine there are other options.

### Q: How do you manage configuration and secrets?
**Short answer (30–60 s):** One immutable \`Settings\` record from common file, environment file, \`SHOP_*\` variables and \`-D\`, validated once with all problems listed. Secrets come from variables or secret files, never from \`-D\` or git, and are wrapped in a type that masks itself.

**Detailed answer:** Mention strict parsing, the prefix, the trailing slash check on \`base.url\` (without it \`resolve\` drops the last path segment), and fail-fast in \`@BeforeAll\`. Rotation: the CI credential store is the owner; the framework only reads.

### Q: Why is there so little in your BasePage?
**Short answer (30–60 s):** Because inheritance is for what *every* page is: something you can open, recognise and act on. Everything a page *has* (header, cards, tables) is a component, injected or composed.

**Detailed answer:** A 2,000-line base class couples all pages to all helpers and cannot be tested. Ours has navigation, readiness and logged actions, mostly \`final\`. The header is a separate injectable object because two step classes need it and one page does not have it.

### Q: How would you scale this suite to a thousand scenarios?
**Short answer (30–60 s):** Reduce UI coverage of rules, seed state, then shard by capability with isolated environments, and only then add Grid capacity. Governance grows with it: tags, owners, quarantine with a deadline, duplicate-step control.

**Detailed answer:** Use arithmetic: total browser time divided by sessions gives the floor; the longest scenario and queueing give the real number. Watch the app under test: forty sessions may be a load test. Split packages by capability, modules by team, and publish the framework jar only when a second repository needs it.

### Q: What is the weakest point of this design?
**Short answer (30–60 s):** The \`cucumber-testng\` runner is deprecated in Cucumber 8, and storage seeding couples us to the shop's internal keys.

**Detailed answer:** For the runner: pinned versions, a documented migration to the JUnit Platform engine, and runners that contain no logic. For seeding: one class, one real-form scenario that detects a format change, and a plan to use an API once the app offers one. Offering weaknesses with mitigations is the senior signal.

## Scenario-based questions

**1. The nightly is green but takes 70 minutes, and developers stopped waiting for it.** I would list the twenty slowest scenarios and the share of time spent in preconditions. Typical finding: most scenarios sign in and fill a cart through the UI. I seed state, move validation outlines to a lower level, then raise \`threads\` while watching Grid queue time. I publish duration per capability and set a budget (15 minutes) as a gate, so it does not grow back.

**2. After enabling eight threads, 5 % of scenarios fail with random wrong carts.** In ShopEasy the cart is per tab, so I would look for shared *test* state first: a static field, a page stored in a singleton, a missing MDC removal (which only confuses logs). In a typical real app I would check whether scenarios share one server-side account. Reproduce with \`-Dthreads=8\` on the two suspect features, grep for \`static\`, give each scenario its own account.

**3. A team lead wants page objects published as a jar for three teams.** I ask whether the three teams test the *same* screens. If yes, I split the module (\`ui\` + \`driver\` + \`config\`), version it, require a deprecation period and give it an owner. If they only share plumbing, I publish \`driver\` and \`config\` only: shared page objects for different products become a bottleneck within months.

## Tricky follow-ups

- **Why is \`DriverFactory\` package-private?** So that only \`BrowserSession\` can create browsers; ownership is enforced by the compiler.
- **Does PicoContainer create all step classes for every scenario?** It instantiates a step class when a step of that class is needed, plus its constructor dependencies; hook classes are created for every scenario. Constructors must stay cheap and side-effect free.
- **What if a scenario needs two users at once?** Two sessions: a small class with two \`BrowserSession\` fields, pages constructed explicitly for the second one, both closed in the hook.
- **Is a static \`Catalogue\` a thread-safety problem?** No: it is initialised once by the class loader and never modified. Static *mutable* state is the problem.
- **Why not \`allure-testng\` plus \`@Step\`?** Double entries and an AspectJ agent, for information the Gherkin steps already contain.`,
  keyPoints: [
    `Let the compiler enforce layers: framework code in src/main with no test libraries on its classpath, scenarios in src/test, DriverFactory package-private.`,
    `Typed immutable settings, loaded once from files, SHOP_* variables and -D, report every problem at start-up; secrets come from variables or files and mask themselves.`,
    `With Cucumber, a PicoContainer-scoped BrowserSession beats a static ThreadLocal: visible dependency, no leak through pooled threads, lazy start, easy to mock.`,
    `Synchronise on state: waitUntilLoaded checks the page element, then readyState; ProductCard waits for the renamed button id.`,
    `Seed ShopEasy state through its two sessionStorage keys in one class and keep one real-form login scenario as the safety net.`,
    `One evidence mechanism: hooks attach screenshot, URL and a per-scenario log file produced by a Log4j2 Routing appender and MDC.`,
    `For Cucumber on TestNG use a bounded, sequential rerun of rerun.txt instead of IRetryAnalyzer, and never testFailureIgnore.`,
    `Pin Surefire 3.5.x for suiteXmlFiles and plan the cucumber-testng exit; thin runners make the migration small.`,
  ],
  mistakes: [
    `Adding a static ThreadLocal driver next to PicoContainer, so two owners exist and pooled threads hand a quit driver to the next scenario. Fix: one scenario-scoped session injected everywhere; grep for static in ui and bdd.`,
    `Using -Dmaven.test.failure.ignore=true before a rerun: a failing @BeforeAll yields an empty rerun file and a green build. Fix: keep the first exit code and refuse to rerun when no scenario failed.`,
    `Overriding tags with -Dcucumber.filter.tags="@smoke" and running quarantined scenarios, because the property replaces the annotation. Fix: repeat "and not @wip and not @quarantine" or keep the expression in the pipeline.`,
    `Putting base.url=http://localhost:5180 in a Grid run; the browser looks inside its own container. Fix: base.url from the browser, grid.url from the JVM, in separate environment files.`,
    `Waiting for an element that can be empty (the cart list has zero height) and calling the timeout flaky. Fix: choose a ready() element that is always rendered and document why.`,
    `Choosing the retry count before measuring flakiness. Fix: list scenarios that pass on rerun, create tickets, and quarantine with an owner and a deadline.`,
  ],
  tryIt: `Create \`tests-java\` from this page and start the shop (\`npm run dev\`). (1) Run \`mvn test -Dcucumber.execution.dry-run=true\`, then \`mvn test -Dcucumber.filter.tags=@smoke\`. (2) Break \`#shopping-cart-link\` in \`Header\` and judge the report: can a stranger find the cause from screenshot, URL and log? (3) Remove \`base.url\` and set \`-Dheadless=maybe\`: both problems must appear in one message. (4) Run with \`-Dthreads=1\` and \`-Dthreads=4\` and compare times. (5) Make one scenario fail on its first attempt only (a counter file) and watch \`ci/run-suite.sh\` report it as flaky. (6) Add "Remember me" from section 13, then convert the runner to a JUnit Platform \`@Suite\` on a branch and list which files changed.`,
  problems: ['fw-014', 'fw-026', 'fw-028', 'fw-038'],
}
