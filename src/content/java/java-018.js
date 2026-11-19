export default {
  id: 'java-018',
  category: 'java',
  kind: 'code',
  title: 'Pick the environment with a switch expression instead of an if/else ladder',
  level: 'BEGINNER',
  tags: ['switch', 'switch-expressions', 'config', 'environments'],
  estMinutes: 15,
  scenario: `The suite runs against three ShopEasy environments: your laptop (\`local\`, the practice site on port 5180), \`qa\` and \`staging\`. Jenkins passes the name as \`-Denv=...\`.
The current \`EnvSelector\` is a ten-line if/else ladder that compares with \`==\`. Last night it ran with \`-Denv=QA\` (capital letters), matched nothing, and quietly used the local URL. Fifty tests failed with "connection refused".
The team wants a short **switch expression** that normalizes the input and fails loudly on unknown names.`,
  description: `Rewrite \`EnvSelector\` with switch expressions (Java 14+ arrow syntax).

**Acceptance**
* \`String baseUrl(String env)\` returns:
  * \`local\` → \`http://localhost:5180/practice-site/\`
  * \`qa\` → \`https://qa.shopeasy.test/\`
  * \`staging\` → \`https://staging.shopeasy.test/\`
* Normalize the input first (\`trim()\` + \`toLowerCase()\`), so \`" QA "\` works.
* Any other value → \`default -> throw new IllegalArgumentException(...)\` with a message that lists the valid names.
* \`int timeoutSeconds(String env)\` uses **one case with two labels**: \`case "local", "qa" -> 5;\` and \`staging\` → 10.
* No \`else if\` ladders, no \`==\` on Strings.`,
  hints: [
    'return switch (key) { case "local" -> "http://..."; case "qa" -> "..."; default -> throw new IllegalArgumentException("..."); };',
    'Several labels can share one arrow: case "local", "qa" -> 5;',
    'Normalize once at the top: String key = env.trim().toLowerCase();',
  ],
  language: 'java',
  starterCode: `package com.shop.config;

public class EnvSelector {

    public static String baseUrl(String env) {
        if (env == "local") {
            return "http://localhost:5180/practice-site/";
        } else if (env == "qa") {
            return "https://qa.shopeasy.test/";
        } else if (env == "staging") {
            return "https://staging.shopeasy.test/";
        } else {
            return "http://localhost:5180/practice-site/";   // silent fallback!
        }
    }

    public static int timeoutSeconds(String env) {
        // TODO: local and qa -> 5, staging -> 10, anything else -> exception
        return 5;
    }

    public static void main(String[] args) {
        String env = System.getProperty("env", "local");
        System.out.println(baseUrl(env) + " / timeout " + timeoutSeconds(env) + "s");
    }
}
`,
  solution: `package com.shop.config;

public class EnvSelector {

    public static String baseUrl(String env) {
        String key = env.trim().toLowerCase();
        return switch (key) {
            case "local" -> "http://localhost:5180/practice-site/";
            case "qa" -> "https://qa.shopeasy.test/";
            case "staging" -> "https://staging.shopeasy.test/";
            default -> throw new IllegalArgumentException(
                    "Unknown env '" + env + "'. Use one of: local, qa, staging");
        };
    }

    public static int timeoutSeconds(String env) {
        return switch (env.trim().toLowerCase()) {
            case "local", "qa" -> 5;
            case "staging" -> 10;
            default -> throw new IllegalArgumentException("Unknown env '" + env + "'");
        };
    }

    public static void main(String[] args) {
        String env = System.getProperty("env", "local");
        System.out.println(baseUrl(env) + " / timeout " + timeoutSeconds(env) + "s");
    }
}
`,
  checks: [
    { label: 'Uses a switch', pattern: 'switch\\s*\\(', hint: 'return switch (key) { ... };' },
    { label: 'Uses arrow cases (case "x" ->)', pattern: 'case\\s+"\\w+"\\s*(,\\s*"\\w+"\\s*)*->', hint: 'case "qa" -> "https://qa.shopeasy.test/";' },
    { label: 'One case with two labels', pattern: 'case\\s+"\\w+"\\s*,\\s*"\\w+"\\s*->', hint: 'case "local", "qa" -> 5;' },
    { label: 'Unknown values throw IllegalArgumentException', pattern: 'default\\s*->\\s*throw\\s+new\\s+IllegalArgumentException', hint: 'default -> throw new IllegalArgumentException("Unknown env ...");' },
    { label: 'Normalizes case before switching', pattern: '\\.(toLowerCase|toUpperCase)\\s*\\(', hint: 'String key = env.trim().toLowerCase();' },
    { label: 'No else-if ladder', pattern: 'else\\s+if', mustNot: true, hint: 'Replace the ladder with one switch.' },
    { label: 'No == on Strings', pattern: '==\\s*"', mustNot: true, hint: '== compares references; switch on a String uses equals() for you.' },
  ],
  explanation: `A **switch** picks one branch based on a value. Since Java 14 it can also be an *expression*: it produces a value you can \`return\` or assign.

\`\`\`java
return switch (key) {
    case "qa" -> "https://qa.shopeasy.test/";
    default -> throw new IllegalArgumentException("...");
};
\`\`\`

* **Arrow cases (\`->\`)** never fall through to the next case, so there's no \`break\` to forget. That fall-through was the classic bug in the old \`case "qa": ...; break;\` syntax.
* **Several labels in one case** (\`case "local", "qa" ->\`) say "these behave the same" in one line.
* **\`default -> throw\`**: when the input is unknown, the run fails at once with a clear message ("Unknown env 'QA '") instead of running against the wrong server.
* Switching on a String compares with \`equals\` internally, which avoids the \`==\` bug from the old code. You still have to **normalize** (trim, lower-case), because \`"QA"\` and \`"qa"\` are different Strings.

With a fixed set of values, an \`enum\` is even safer (see java-010). The compiler then checks that every constant has a case. A String switch is the right first step when the value arrives as text from \`-D\` or a properties file.`,
  mistakes: [
    'Using the old colon syntax and forgetting break, so execution falls through into the next case.',
    'Adding a silent default (return the local URL) instead of throwing, so a typo in Jenkins runs the suite against the wrong environment.',
    'Switching on the raw input without trim/toLowerCase, so " QA" or "Staging" are rejected or mis-routed.',
    'Switching on a String that can be null: switch(null) throws NullPointerException. Give System.getProperty a default value.',
  ],
  interview: [
    { q: 'What is the difference between a switch statement and a switch expression?', a: 'A statement just runs code in the matching case, and with the colon syntax it falls through unless you break. A switch expression (arrow syntax, Java 14+) produces a value, never falls through, and must cover every possible input, usually with a default.' },
    { q: 'Which types can you switch on in Java?', a: 'int and smaller whole-number types, their wrapper classes, char, String (since Java 7) and enums. Java 21 also allows pattern matching on types. You can\'t switch on long, double or boolean.' },
    { q: 'How do you run the same tests against different environments?', a: 'Pass the environment name as a system property (mvn test -Denv=staging), normalize it, and map it to the base URL and settings with a switch or an enum. Unknown values fail fast. The URLs themselves usually live in per-environment properties files.' },
  ],
}
