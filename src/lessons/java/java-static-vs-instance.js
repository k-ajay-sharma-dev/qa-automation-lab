export default {
  slug: 'java-static-vs-instance',
  category: 'java',
  order: 5,
  title: 'static vs instance: shared things and per-object things',
  minutes: 7,
  summary: 'Know when a field or method should be static (one copy for the whole class) or instance (one per object), why static code cannot touch instance fields, and how static blocks and constants work.',
  manualAnalogy: `Think of a test cycle. The **environment URL** is shared by every tester on the team — there is one, and everybody reads the same one. Each tester's **current step** is personal — yours is not mine. \`static\` is the shared whiteboard; instance fields are each tester's own notebook.`,
  body: `## One copy vs one per object

\`\`\`java
public class Session {
    static int opened = 0;      // static: ONE copy, shared by the class
    String user;                // instance: each object has its own

    public Session(String user) {
        this.user = user;
        opened++;               // every constructor bumps the same counter
    }
}
\`\`\`

\`\`\`java
Session s1 = new Session("standard_user");
Session s2 = new Session("locked_out_user");
System.out.println(Session.opened);   // 2
System.out.println(s1.user);          // standard_user
\`\`\`

- \`opened\` exists once, attached to the **class**. Read it as \`Session.opened\`.
- \`user\` exists once **per object**. Read it through an object: \`s1.user\`.

## Static methods

A static method also belongs to the class and is called without creating an object: \`Integer.parseInt("3")\`, \`Math.max(a, b)\`, \`String.format(...)\`. They are ideal for **stateless helpers** — the result depends only on the parameters.

\`\`\`java
public class Money {
    public static double parse(String text) {
        return Double.parseDouble(text.replace("$", "").replace(",", ""));
    }
}
double v = Money.parse("$49.99");
\`\`\`

## The rule that confuses everyone

**A static method cannot use instance fields or call instance methods directly.**

Why? A static method runs without any object. If a class has an instance field \`driver\`, *whose* driver would a static method use? There might be zero objects, or ten. The compiler refuses with "non-static variable cannot be referenced from a static context".

The reverse is fine: an instance method can use static fields, because the class's shared data always exists.

| From… | …to static field/method | …to instance field/method |
|---|---|---|
| static method | yes | **no** (needs an object) |
| instance method | yes | yes |

## Constants: static final

\`\`\`java
public static final int DEFAULT_TIMEOUT = 10;
public static final String LOGIN_PATH = "/practice-site/login.html";
\`\`\`

\`static\` = one shared copy, \`final\` = cannot be reassigned. By convention constants use UPPER_SNAKE_CASE.

## static blocks: run once when the class loads

\`\`\`java
public class TestData {
    private static final List<String> USERS;

    static {
        System.out.println("loading users");
        USERS = List.of("standard_user", "locked_out_user");
    }

    public static String firstUser() { return USERS.get(0); }
}
\`\`\`

The \`static { }\` block runs **once**, the first time the class is used — not once per call. Call \`TestData.firstUser()\` five times and "loading users" prints once. That makes it the natural place to load something expensive, like a properties file, a single time per run.

## Reading run settings: System.getProperty

Maven lets you pass settings on the command line: \`mvn test -Denv=staging\`. Java reads them with a static method:

\`\`\`java
String env = System.getProperty("env");                 // null if not passed
String env2 = System.getProperty("env", "qa");          // "qa" if not passed
\`\`\`

A common pattern: "command line wins, otherwise use the file value, otherwise fail with a clear message".

## When static is a trap

A \`static WebDriver driver\` looks convenient — every class can reach it. But there is only **one** copy. Run tests in parallel and two threads share and overwrite the same browser. Rule of thumb:

- **static** — constants, pure helpers, config loaded once.
- **instance** — anything that belongs to one test or one page: driver, page objects, test data for this scenario.`,
  keyPoints: [
    'static = one copy belonging to the class; instance = one copy per object.',
    'Static methods cannot touch instance fields directly — there is no "this" object.',
    'static final + UPPER_CASE for constants.',
    'A static { } block runs once, when the class is first used.',
    'System.getProperty("key", "default") reads -Dkey=value from the command line.',
  ],
  mistakes: [
    'Using an instance field (like driver) inside a static method — compile error; pass it in or make the method non-static.',
    'Expecting a static counter to start at 0 for each new object — it is shared and keeps counting.',
    'Making the WebDriver static "for convenience" — it breaks parallel runs.',
    'Reloading a config file in every get() call — load it once in a static block.',
  ],
  tryIt: `Write a class with \`static int created\` and an instance \`int mine\`, both incremented in the constructor. Create three objects and print \`created\` and the third object's \`mine\` — predict the output first.`,
  problems: ['java-007', 'java-008'],
}
