export default {
  id: 'fw-006',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'ConfigReader: config.properties with -Denv switching',
  level: 'INTERMEDIATE',
  tags: ['config', 'properties', 'environments', 'system-properties'],
  estMinutes: 20,
  scenario: `ShopEasy has three environments: local (\`http://localhost:5180/practice-site\`), QA and UAT. Right now the base
URL is hard-coded in \`LoginPage\` and someone changes it by hand before every UAT run — last week they forgot to change
it back and the nightly ran against UAT and created 300 test orders there. You will make environment a *runtime switch*.`,
  description: `Write \`ConfigReader\` that loads \`src/test/resources/config/<env>.properties\`.

**Rules**
- Environment comes from \`System.getProperty("env", "local")\` → \`mvn test -Denv=qa\`.
- Load the file once (static block or lazy init) with \`Properties.load\` from the classpath, and fail with a clear message if it is missing.
- \`get(String key)\`: a **system property with the same key overrides** the file (\`-Dbrowser=firefox\`), then the file value; throw if neither exists.
- Convenience methods \`baseUrl()\`, \`browser()\`, \`timeoutSeconds()\` (int).`,
  starterCode: `package com.shopeasy.config;

public class ConfigReader {

    public static String baseUrl() {
        return "http://localhost:5180/practice-site"; // TODO: from config
    }

    public static String browser() {
        return "chrome"; // TODO
    }
}

// src/test/resources/config/qa.properties
// baseUrl=https://qa.shopeasy.example/practice-site
// browser=chrome
// timeoutSeconds=10
`,
  solution: `package com.shopeasy.config;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public final class ConfigReader {

    private static final Properties PROPS = new Properties();
    private static final String ENV = System.getProperty("env", "local");

    static {
        String file = "config/" + ENV + ".properties";
        try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream(file)) {
            if (in == null) {
                throw new IllegalStateException("Config file not found on classpath: " + file);
            }
            PROPS.load(in);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read " + file, e);
        }
    }

    private ConfigReader() { }

    public static String get(String key) {
        String value = System.getProperty(key, PROPS.getProperty(key));
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing config key '" + key + "' for env " + ENV);
        }
        return value.trim();
    }

    public static String env() { return ENV; }

    public static String baseUrl() { return get("baseUrl"); }

    public static String browser() { return get("browser"); }

    public static int timeoutSeconds() { return Integer.parseInt(get("timeoutSeconds")); }
}

// Usage:  mvn test -Denv=qa                -> qa.properties
//         mvn test -Denv=qa -Dbrowser=firefox  -> qa.properties, browser overridden
`,
  checks: [
    { label: 'Env from a system property with default', pattern: 'System\\.getProperty\\s*\\(\\s*"env"\\s*,\\s*"\\w+"\\s*\\)', hint: 'System.getProperty("env", "local")' },
    { label: 'Uses java.util.Properties load()', pattern: 'Properties[\\s\\S]*?\\.load\\s*\\(', hint: 'PROPS.load(inputStream)' },
    { label: 'File name built from env', pattern: '"[\\w/]*"\\s*\\+\\s*\\w+\\s*\\+\\s*"\\.properties"', hint: '"config/" + ENV + ".properties"' },
    { label: 'System property overrides the file', pattern: 'System\\.getProperty\\s*\\(\\s*key\\b', hint: 'System.getProperty(key, PROPS.getProperty(key))' },
    { label: 'Clear failure when missing', pattern: 'throw\\s+new\\s+\\w*(Exception|Error)\\s*\\(\\s*"[^"]*(not found|Missing|missing|Could not)', hint: 'Throw with the key/file name in the message' },
    { label: 'No hard-coded base URL', pattern: 'return\\s+"https?://', mustNot: true, hint: 'URLs belong in the properties files' },
  ],
  hints: [
    'Load from the classpath: ConfigReader.class.getClassLoader().getResourceAsStream(file).',
    'Order of precedence: -Dkey=value, then the env file, then error.',
    'Do the loading in a static block so it happens once.',
  ],
  explanation: `Configuration precedence most frameworks use:

1. **Command line** \`-Dkey=value\` (CI and ad-hoc runs)
2. **Environment file** \`config/<env>.properties\`
3. (optional) defaults file / environment variables for secrets

Why this design:
- One artifact, many environments: CI runs \`mvn test -Denv=qa\` or \`-Denv=uat\` with no code change — the
  "forgot to switch back" incident becomes impossible.
- Loading from the **classpath** (\`src/test/resources\`) works the same in the IDE, Maven and CI.
- Fail fast with the key and env in the message: "Missing config key 'baseUrl' for env uat" saves an hour.
- **Secrets** (real passwords, API tokens) do not go into committed properties; read them from CI secrets via
  environment variables (\`System.getenv("SHOPEASY_PASSWORD")\`).

Note: \`-D\` values reach the forked test JVM because Surefire passes Maven system properties through by default;
if a value is not arriving, check \`<systemPropertyVariables>\` / \`argLine\` in the surefire config.`,
  mistakes: [
    'Reading the file with a relative FileInputStream path that works in the IDE but not on CI.',
    'Loading the properties file again on every get() call.',
    'Committing real UAT/prod credentials in config files.',
    'Silently returning null for a missing key.',
  ],
  interview: [
    { q: 'How do you run the same tests against different environments?', a: 'Keep environment-specific values in per-env properties (or YAML) files, select the file with a system property like -Denv=qa, allow individual -D overrides, and read secrets from environment variables provided by CI.' },
    { q: 'Where do you keep test credentials?', a: 'Non-sensitive test users can live in env config. Real secrets come from a vault or CI secret store injected as environment variables, never committed to git.' },
  ],
}
