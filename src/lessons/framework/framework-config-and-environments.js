export default {
  slug: 'framework-config-and-environments',
  category: 'framework',
  order: 6,
  title: 'Configuration and environments: .properties files and -D overrides',
  minutes: 8,
  summary: 'Keep URLs, browser and timeouts out of the code in per-environment .properties files, load them from the classpath, and override any value from the command line with -D.',
  manualAnalogy: `When you test the same build on QA, UAT and staging, the test cases do not change — only the environment sheet does: different URL, different test accounts, maybe a different browser. Configuration files are that environment sheet. Switching environment becomes "pick another sheet", not "edit 200 test cases".`,
  body: `## Hard-coded values are a trap

\`\`\`java
driver.get("http://localhost:5180/practice-site/login.html");
new WebDriverWait(driver, Duration.ofSeconds(10));
\`\`\`

Run the suite against QA and you must edit Java. Run on a slower CI machine and you change the timeout in five places. Anything that **varies by environment or machine** should come from configuration.

## The .properties format

A \`.properties\` file is plain \`key=value\` lines:

\`\`\`properties
# src/test/resources/config/uat.properties
baseUrl=https://uat.shopeasy.example/practice-site/
browser=chrome
headless=true
explicitWait=15
\`\`\`

One file per environment: \`local.properties\`, \`qa.properties\`, \`uat.properties\`. Same keys, different values. Lines starting with \`#\` are comments. Values are always read as **text** — convert numbers yourself (\`Integer.parseInt\`).

## Loading from the classpath

Java's \`Properties\` class reads that format:

\`\`\`java
Properties props = new Properties();
String file = "config/uat.properties";
try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream(file)) {
    if (in == null) {
        throw new IllegalStateException("Config file not found on classpath: " + file);
    }
    props.load(in);
}
\`\`\`

- **Classpath**: Maven copies everything in \`src/test/resources\` into \`target/test-classes\`, which is on the classpath when tests run. \`getResourceAsStream("config/uat.properties")\` finds it there — the same on your laptop and on Jenkins. No \`C:\\\\\` paths.
- \`getResourceAsStream\` returns \`null\` (it does not throw) when the file is missing. Check for it and fail with a message that names the file; otherwise you get a \`NullPointerException\` with no clue.
- \`try (...)\` is *try-with-resources*: Java closes the stream automatically.

Load the file **once**, not on every \`get\` call — a \`static { ... }\` block (runs once when the class is first used) or a lazy "load if not loaded yet" check both work.

## Choosing the environment: system properties

\`-D\` on the command line sets a **system property**:

\`\`\`
mvn clean test -Denv=uat
\`\`\`

Java reads it with:

\`\`\`java
String env = System.getProperty("env", "local");   // second argument = default
\`\`\`

So the file name becomes \`"config/" + env + ".properties"\`. No argument → \`local\`. Surefire forwards \`-D\` values to the test JVM.

## Overrides: the most specific value wins

Often you want "UAT settings, but Firefox this once":

\`\`\`
mvn clean test -Denv=uat -Dbrowser=firefox
\`\`\`

The rule a good \`ConfigReader\` implements:

1. If a **system property** with that key exists, use it.
2. Otherwise use the value from the **environment file**.
3. If neither exists, **fail clearly** naming the missing key — a silent \`null\` URL makes \`driver.get(null)\` fail far from the cause.

\`System.getProperty(key, fallback)\` expresses rules 1 and 2 in one call.

## A small, typed API

Tests and pages should not sprinkle string keys everywhere. Wrap the common ones:

| Method | Returns | From key |
|---|---|---|
| \`baseUrl()\` | \`String\` | \`baseUrl\` |
| \`browser()\` | \`String\` | \`browser\` |
| \`timeoutSeconds()\` | \`int\` | a timeout key, parsed |
| \`isHeadless()\` | \`boolean\` | \`headless\`, via \`Boolean.parseBoolean\` |

A typo in a key is now a compile error in one method instead of a runtime \`null\` in ten tests. Make the class \`final\` with a private constructor and static methods — it is a utility, not something to instantiate.

## Secrets

Passwords and API keys should not be committed in plain text. Keep a placeholder in the file and supply the real value from CI as \`-Dpassword=...\` from a Jenkins credential or a GitHub Actions secret, or from an environment variable read with \`System.getenv("SHOPEASY_PASSWORD")\`.

## How the pieces connect

\`ConfigReader\` → \`DriverFactory\` reads \`browser\` and \`headless\` → \`BasePage\` reads the wait timeout → \`LoginPage.open()\` builds its URL from \`baseUrl\`. Changing environment touches none of them.`,
  keyPoints: [
    'Anything that varies by environment or machine belongs in a .properties file, one per environment.',
    'Load files from the classpath (`src/test/resources`) with `getResourceAsStream`; check for null.',
    '`-Denv=uat` sets a system property; `System.getProperty("env", "local")` reads it with a default.',
    'Precedence: -D system property > environment file > clear failure.',
    'Expose typed helpers (`baseUrl()`, `timeoutSeconds()`) and keep secrets out of Git.',
  ],
  mistakes: [
    'Using `new FileInputStream("src/test/resources/...")` — depends on the working directory; use the classpath.',
    'Ignoring a null stream — the real error (missing file) turns into a NullPointerException.',
    'Reloading the file in every `get` call — load once.',
    'Forgetting values are text — `"10"` must be parsed before use as a number.',
  ],
  tryIt: `Write two tiny files, \`local.properties\` and \`qa.properties\`, with different \`baseUrl\` values. In a scratch \`main\` method print \`System.getProperty("env", "local")\`, then run it with and without \`-Denv=qa\` (in IntelliJ: Run configuration → VM options). Watch the value change without touching code.`,
  problems: ['fw-006', 'fw-012'],
}
