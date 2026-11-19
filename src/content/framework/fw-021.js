export default {
  id: 'fw-021',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Secrets from environment variables, never from git',
  level: 'INTERMEDIATE',
  tags: ['config', 'secrets', 'environment-variables', 'security', 'ci'],
  estMinutes: 20,
  scenario: `The security team's repository scan flagged \`uat.properties\`: the UAT test-account password is committed in
plain text, and a "fallback" copy of it is hard-coded in \`Credentials.java\`. The password has been rotated and you
must make sure the new one **never** lands in git again — while tests still run on laptops, on Jenkins and on GitHub Actions.`,
  description: `Rewrite \`Credentials\` so secrets come from outside the repository.

**Rules**
- \`password()\` looks up, in this order: the system property \`shopeasy.password\` (\`-Dshopeasy.password=...\` for a one-off run),
  then the environment variable \`SHOPEASY_PASSWORD\` (set by CI from its secret store).
- If neither is set, throw an exception whose message **names the variable** and says how to set it — no silent \`null\`, no default.
- No password literal anywhere in the class.
- \`username()\` is not secret and still comes from \`ConfigReader.get("username")\`.
- \`describe()\` returns \`"user=<username>, password=*****"\` for logs — never the real value.`,
  starterCode: `package com.shopeasy.config;

public final class Credentials {

    private Credentials() { }

    public static String username() {
        return ConfigReader.get("username");
    }

    public static String password() {
        String fromFile = ConfigReader.getOrNull("password");
        return fromFile != null ? fromFile : "Uat#Spring2024";   // fallback so tests never break
    }

    public static String describe() {
        return "user=" + username() + ", password=" + password();
    }
}
`,
  solution: `package com.shopeasy.config;

public final class Credentials {

    static final String PASSWORD_PROPERTY = "shopeasy.password";
    static final String PASSWORD_ENV = "SHOPEASY_PASSWORD";

    private Credentials() { }

    public static String username() {
        return ConfigReader.get("username");
    }

    public static String password() {
        String value = System.getProperty(PASSWORD_PROPERTY);
        if (value == null || value.isBlank()) {
            value = System.getenv(PASSWORD_ENV);
        }
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing secret: set the environment variable " + PASSWORD_ENV
                    + " (CI secret) or pass -D" + PASSWORD_PROPERTY + "=... for a local run");
        }
        return value;
    }

    public static String describe() {
        return "user=" + username() + ", password=*****";
    }
}
`,
  checks: [
    { label: 'Reads the environment variable', pattern: 'System\\.getenv\\s*\\(\\s*(PASSWORD_ENV|"SHOPEASY_PASSWORD")\\s*\\)', hint: 'System.getenv("SHOPEASY_PASSWORD")' },
    { label: 'System property checked first', pattern: 'System\\.getProperty\\s*\\(\\s*(PASSWORD_PROPERTY|"shopeasy\\.password")[\\s\\S]*System\\.getenv', hint: 'String value = System.getProperty("shopeasy.password"); then fall back to getenv' },
    { label: 'Clear failure naming the variable', pattern: 'throw\\s+new\\s+\\w+(Exception|Error)\\s*\\([^;]*(SHOPEASY_PASSWORD|PASSWORD_ENV)', hint: 'throw new IllegalStateException("Missing secret: set the environment variable SHOPEASY_PASSWORD ...")' },
    { label: 'No password literal or fallback', pattern: '"Uat#|password\\s*:\\s*"\\w|:\\s*"[^"]*#[^"]*"\\s*;', mustNot: true, hint: 'Delete the hard-coded fallback — fail instead' },
    { label: 'Password not read from the committed config file', pattern: 'ConfigReader\\.\\w+\\s*\\(\\s*"password"', mustNot: true, hint: 'Secrets do not live in uat.properties' },
    { label: 'describe() masks the password', pattern: 'describe\\s*\\(\\s*\\)\\s*\\{[^}]*"[^"]*password=\\*{3,}', hint: 'return "user=" + username() + ", password=*****";' },
  ],
  hints: [
    'System.getenv("NAME") reads an operating-system environment variable; it returns null when it is not set.',
    'Check the -D system property first (most specific), then the environment variable.',
    'A missing secret should stop the run with a helpful message, not fall back to a value in the code.',
  ],
  explanation: `Where each kind of value lives:

| Value | Where | Why |
|---|---|---|
| base URL, browser, timeouts | \`config/<env>.properties\` in git | not secret, reviewed with the code |
| test usernames | properties in git | not secret on their own |
| passwords, API tokens | CI secret store → **environment variable** | never in git history |

**On CI** the secret store injects the variable:

\`\`\`yaml
# GitHub Actions
- run: mvn -B clean test -Denv=uat
  env:
    SHOPEASY_PASSWORD: \${{ secrets.SHOPEASY_UAT_PASSWORD }}
\`\`\`
\`\`\`groovy
// Jenkins
withCredentials([string(credentialsId: 'shopeasy-uat-password', variable: 'SHOPEASY_PASSWORD')]) {
    sh 'mvn -B clean test -Denv=uat'
}
\`\`\`
Both mask the value in the build log.

**Locally** set it once in your shell or IntelliJ run configuration (\`SHOPEASY_PASSWORD=...\`), or keep it in a
git-ignored \`local-secrets.properties\` that only your machine has.

Why prefer environment variables over \`-Dshopeasy.password=...\` on CI: command lines are often printed in logs and
visible in process lists; environment variables from the secret store are masked. The \`-D\` route is kept for quick
local runs.

And remember: a secret that was ever committed stays in **git history**. Rotating it (as the security team did) is the
real fix; removing the line only stops it happening again.`,
  mistakes: [
    'A hard-coded "fallback" password, which defeats the whole point.',
    'Logging the full config or the login call with the real password.',
    'Deleting the password from the file but not rotating it, although it is still in git history.',
    'Passing secrets on the Maven command line in CI, where they can be printed in the log.',
  ],
  interview: [
    { q: 'How do you handle credentials in your test framework?', a: 'Non-secret config lives in per-environment properties in git. Secrets come from the CI secret store (Jenkins credentials, GitHub secrets, a vault) injected as environment variables and read with System.getenv; the framework fails fast if one is missing and never logs the value.' },
    { q: 'A password was committed to git by mistake. What do you do?', a: 'Treat it as leaked: rotate it immediately, remove it from the code and move it to the secret store, and optionally rewrite history. Removing the line alone is not enough because the value remains in git history.' },
  ],
}
