export default {
  id: 'java-007',
  category: 'java',
  kind: 'quiz',
  title: 'static vs instance: the interview questions that trip people up',
  level: 'INTERMEDIATE',
  tags: ['static', 'oop', 'interview', 'output-prediction'],
  estMinutes: 12,
  scenario: `Your framework has \`ConfigReader.get("baseUrl")\` (static) and \`new LoginPage(driver)\` (instance). When the team switched TestNG to
\`parallel="methods"\`, tests started closing each other's browsers — because someone had declared \`public static WebDriver driver\` in \`BaseTest\`.
Interviewers love this topic because it separates people who copied a framework from people who understand it.`,
  description: `Answer each question. Several are "what does this print?" — trace the code line by line.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
public class TestCounter {
    static int executed = 0;
    int mine = 0;

    public TestCounter() {
        executed++;
        mine++;
    }

    public static void main(String[] args) {
        TestCounter a = new TestCounter();
        TestCounter b = new TestCounter();
        TestCounter c = new TestCounter();
        System.out.println(TestCounter.executed + " " + c.mine);
    }
}
\`\`\``,
      options: ['1 1', '3 3', '3 1', '1 3'],
      answer: 2,
      why: '`executed` is **static**: one copy shared by the class, incremented by all three constructors → 3. `mine` is an **instance** field: each object has its own copy starting at 0, so `c.mine` is 1.',
    },
    {
      q: `Why does this not compile?
\`\`\`java
public class BaseTest {
    WebDriver driver;

    public static void openHome() {
        driver.get("https://qa.shop.example/");
    }
}
\`\`\``,
      options: [
        'driver must be initialized before use',
        'A static method cannot access an instance field directly — there is no object (this) in a static context',
        'get() is not a WebDriver method',
        'static methods cannot be public',
      ],
      answer: 1,
      why: 'Static methods belong to the class, not to an object, so there is no `this` and no instance `driver` to use. The compiler error is "non-static variable driver cannot be referenced from a static context". Make the method an instance method, or pass the driver in as a parameter.',
    },
    {
      q: 'Your `BaseTest` declares `public static WebDriver driver;` and TestNG runs with `parallel="methods"`, `thread-count="4"`. What is the most likely result?',
      options: [
        'Each test gets its own browser automatically',
        'TestNG refuses to run static fields in parallel',
        'All threads share one variable, so tests overwrite each other\'s driver — random failures and browsers closed mid-test',
        'Tests run 4x faster with no side effects',
      ],
      answer: 2,
      why: 'A static field has **one value for the whole JVM**. Four threads assign and quit the same variable. The standard fix is `private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();` — static holder, but a separate value per thread.',
    },
    {
      q: `What does this print?
\`\`\`java
class ConfigReader {
    static {
        System.out.println("loading config");
    }
    static String get(String key) {
        return key.toUpperCase();
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(ConfigReader.get("env"));
        System.out.println(ConfigReader.get("browser"));
    }
}
\`\`\``,
      options: [
        'loading config / ENV / loading config / BROWSER',
        'loading config / ENV / BROWSER',
        'ENV / BROWSER',
        'ENV / loading config / BROWSER',
      ],
      answer: 1,
      why: 'A **static initializer block** runs exactly once, when the class is first used — before the first `get` call. That is why ConfigReader classes load the .properties file in a static block: the file is read once per JVM, not once per test.',
    },
    {
      q: 'Which of these is the best candidate to be `static` in a test framework?',
      options: [
        'The WebDriver used by one test',
        'A LoginPage object',
        'A pure helper like `PriceUtils.parsePrice(String)` that only uses its parameters',
        'The User test-data object for the current scenario',
      ],
      answer: 2,
      why: 'Static fits **stateless** logic and truly global, read-only things (utilities, constants, config). Anything that belongs to one test run — driver, pages, scenario data — should be instance state so parallel tests do not share it.',
    },
  ],
  hints: ['static = one per class. Instance = one per object (new).', 'A static block runs once, when the class is loaded.'],
  explanation: `**static** members belong to the class (one shared copy); **instance** members belong to each object created with \`new\`.

* Use static for stateless utilities (\`parsePrice\`), constants (\`static final int TIMEOUT = 10\`), and once-per-JVM resources like a \`ConfigReader\` loaded in a static block.
* Use instance state for anything tied to one test: the driver, page objects, scenario data. Cucumber's PicoContainer and TestNG's per-method instances rely on this.
* Static methods cannot touch instance fields — there is no object to read them from.
* Static + parallel = shared mutable state. If a driver must be globally reachable, wrap it in a \`ThreadLocal\`.`,
  mistakes: [
    'Declaring the WebDriver as public static to "make it easy to reach" from every class.',
    'Making every helper static, including ones that need a driver, then passing nothing in and hitting NullPointerException.',
    'Expecting a static block to run before every test — it runs once per JVM/class load.',
  ],
  interview: [
    { q: 'Can you override a static method?', a: 'No. Static methods are resolved at compile time by the reference type (method hiding), not at runtime by the object type, so there is no polymorphism for them.' },
    { q: 'Why is ThreadLocal used for WebDriver in parallel execution?', a: 'ThreadLocal gives each thread its own copy of the variable. A static ThreadLocal<WebDriver> is easy to access globally, yet every parallel test thread gets and quits its own browser. Remember to call remove() after quitting.' },
    { q: 'What is the order of execution: static block, constructor, instance block?', a: 'Static blocks run once when the class loads. Then, for every new object, instance initializer blocks run, followed by the constructor body.' },
  ],
}
