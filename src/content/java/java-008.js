export default {
  id: 'java-008',
  category: 'java',
  kind: 'code',
  title: 'Build a static ConfigReader that loads config.properties',
  level: 'INTERMEDIATE',
  tags: ['static', 'properties', 'config', 'io'],
  estMinutes: 25,
  scenario: `Your tests have \`"https://qa.shop.example"\` and \`"admin@test.com"\` hard-coded in 40 places. Now the team must run the same suite against
STAGING before every release, and Jenkins needs to switch browser without a code change. Every Java framework solves this the same way:
a \`config.properties\` file in \`src/test/resources\` plus a small **ConfigReader** that loads it **once** and lets \`-D\` system properties override it.`,
  description: `\`src/test/resources/config.properties\` contains:

\`\`\`properties
baseUrl=https://qa.shop.example
browser=chrome
timeoutSeconds=10
adminEmail=admin@test.shop.example
\`\`\`

Replace the hard-coded constants with a \`ConfigReader\`:

**Acceptance**
* A \`private static final Properties\` field, loaded **once** in a \`static { }\` block from the classpath (\`getResourceAsStream("config.properties")\`) or a \`FileInputStream\`.
* Use try-with-resources and handle \`IOException\` by throwing a clear \`RuntimeException\` (a broken config must stop the run, not be ignored).
* \`public static String get(String key)\` — returns \`System.getProperty(key)\` if it was passed on the command line (\`mvn test -Dbrowser=firefox\`), otherwise the file value; throw if the key is missing.
* \`public static int getInt(String key)\` using \`Integer.parseInt\`.
* No hard-coded URLs left in the class.`,
  hints: [
    'static { try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream("config.properties")) { PROPS.load(in); } catch (IOException e) { throw new RuntimeException(...); } }',
    'String value = System.getProperty(key, PROPS.getProperty(key)); — the second argument is the default.',
    'Add a private constructor: utility classes should not be instantiated.',
  ],
  language: 'java',
  starterCode: `package com.shop.config;

public class ConfigReader {

    // Hard-coded: changing environment means editing code and recompiling
    public static final String BASE_URL = "https://qa.shop.example";
    public static final String BROWSER = "chrome";
    public static final int TIMEOUT_SECONDS = 10;

    // TODO: load src/test/resources/config.properties once (static block)
    // TODO: public static String get(String key) with -D override
    // TODO: public static int getInt(String key)
}
`,
  solution: `package com.shop.config;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public final class ConfigReader {

    private static final String FILE = "config.properties";
    private static final Properties PROPS = new Properties();

    // runs once, the first time any test touches ConfigReader
    static {
        try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream(FILE)) {
            if (in == null) {
                throw new IllegalStateException(FILE + " not found on the test classpath");
            }
            PROPS.load(in);
        } catch (IOException e) {
            throw new RuntimeException("Could not read " + FILE, e);
        }
    }

    private ConfigReader() {
        // utility class - no instances
    }

    /** -Dkey=value on the command line wins over the file. */
    public static String get(String key) {
        String value = System.getProperty(key, PROPS.getProperty(key));
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing config key: " + key);
        }
        return value.trim();
    }

    public static int getInt(String key) {
        return Integer.parseInt(get(key));
    }
}

// usage in a test / hook:
// driver.get(ConfigReader.get("baseUrl"));
// Duration timeout = Duration.ofSeconds(ConfigReader.getInt("timeoutSeconds"));
`,
  checks: [
    { label: 'Uses java.util.Properties', pattern: 'new\\s+Properties\\s*\\(\\s*\\)', hint: 'private static final Properties PROPS = new Properties();' },
    { label: 'Loads the file once in a static block', pattern: 'static\\s*\\{[\\s\\S]*\\.load\\s*\\(', hint: 'static { ... PROPS.load(in); ... }' },
    { label: 'Opens the file via classpath or FileInputStream', pattern: '(getResourceAsStream\\s*\\(|new\\s+FileInputStream\\s*\\(|new\\s+FileReader\\s*\\(|Files\\.newBufferedReader\\s*\\()', hint: 'ConfigReader.class.getClassLoader().getResourceAsStream("config.properties")' },
    { label: 'Handles IOException', pattern: 'catch\\s*\\(\\s*IOException\\s+\\w+\\s*\\)', hint: 'catch (IOException e) { throw new RuntimeException("...", e); }' },
    { label: 'Static get(String) with -D override', pattern: 'public\\s+static\\s+String\\s+get\\s*\\(\\s*String\\s+\\w+\\s*\\)[\\s\\S]*System\\.getProperty\\s*\\(', hint: 'System.getProperty(key, PROPS.getProperty(key))' },
    { label: 'getInt parses with Integer.parseInt', pattern: 'Integer\\.(parseInt|valueOf)\\s*\\(', hint: 'return Integer.parseInt(get(key));' },
    { label: 'No hard-coded URLs', pattern: '"https?://', mustNot: true, hint: 'URLs belong in config.properties, not in code.' },
  ],
  explanation: `This class combines three Java ideas you will see in every framework:

* **\`static\`** — config is global and read-only, so \`ConfigReader.get("baseUrl")\` needs no object. The **static block** runs once when the class is first loaded, so the file is read once per JVM, not once per test. The private constructor documents "don't instantiate me".
* **\`java.util.Properties\`** — a key/value map that understands \`key=value\` files. \`getResourceAsStream\` reads from the test classpath, so it works the same from IntelliJ, Maven and Jenkins (unlike a relative \`FileInputStream\` path that depends on the working directory).
* **Overrides** — \`System.getProperty(key, default)\` lets CI run \`mvn test -Dbrowser=firefox -DbaseUrl=https://staging...\` with no code change.

Failing loudly (missing file / missing key) is deliberate: a test that silently runs against \`null\` URL wastes far more time than a clear "Missing config key: baseUrl".

A common next step is per-environment files (\`config-qa.properties\`, \`config-staging.properties\`) chosen by \`-Denv=staging\`, often modelled as an \`enum Environment\`.`,
  mistakes: [
    'Loading the file in every get() call (slow, and repeated I/O in parallel tests).',
    'Swallowing IOException with an empty catch, then getting NullPointerException far away from the real cause.',
    'Using new FileInputStream("config.properties") with a relative path that only works from one working directory.',
    'Forgetting trim() — a trailing space in "chrome " breaks a browser switch.',
  ],
  interview: [
    { q: 'How do you run the same suite against different environments?', a: 'Environment-specific values live in properties files (or one file per env), loaded by a ConfigReader. The environment is selected with a system property like -Denv=staging from Maven/Jenkins, and individual values can be overridden with -Dkey=value.' },
    { q: 'What is a static block and when does it run?', a: 'A static initializer runs once, when the JVM loads the class (the first time it is used). It is used for one-time setup such as loading configuration.' },
    { q: 'What is try-with-resources?', a: 'A try statement that declares resources implementing AutoCloseable (streams, readers). Java closes them automatically at the end of the block, even when an exception is thrown, so you do not need a finally block to close the stream.' },
  ],
}
