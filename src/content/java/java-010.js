export default {
  id: 'java-010',
  category: 'java',
  kind: 'code',
  title: 'WebDriver driver = new ChromeDriver() — interfaces, polymorphism and a Browser enum',
  level: 'INTERMEDIATE',
  tags: ['interfaces', 'polymorphism', 'enums', 'driver-factory'],
  estMinutes: 25,
  scenario: `The client wants the regression suite to run on Chrome **and** Firefox **and** Edge. Your \`BaseTest\` declares \`ChromeDriver driver\`, and every
page constructor takes a \`ChromeDriver\` — so supporting Firefox means touching every class. Meanwhile the browser name comes in as a free-text
String, and last night's Jenkins job ran with \`-Dbrowser=chorme\` and silently fell back to Chrome. Time for a **DriverFactory** that programs to the
\`WebDriver\` **interface** and a **Browser enum** that rejects typos.`,
  description: `Write \`enum Browser\` and \`DriverFactory\`.

**Acceptance**
* \`enum Browser { CHROME, FIREFOX, EDGE }\`.
* \`public static WebDriver createDriver(Browser browser)\` — returns the right implementation using a \`switch\` on the enum. The return type and local variables are **\`WebDriver\`** (the interface), never \`ChromeDriver\`.
* Chrome should get \`ChromeOptions\` with \`--headless=new\` when the system property \`headless\` is \`true\`.
* \`public static WebDriver createDriverFromConfig()\` — reads \`System.getProperty("browser", "chrome")\` and converts it with \`Browser.valueOf(...toUpperCase())\` (a typo now fails fast with \`IllegalArgumentException\`).`,
  hints: [
    'return switch (browser) { case CHROME -> new ChromeDriver(options); case FIREFOX -> new FirefoxDriver(); case EDGE -> new EdgeDriver(); };',
    'Browser.valueOf("FIREFOX") returns Browser.FIREFOX; Browser.valueOf("CHORME") throws IllegalArgumentException.',
    'Boolean.parseBoolean(System.getProperty("headless", "false"))',
  ],
  language: 'java',
  starterCode: `package com.shop.driver;

import org.openqa.selenium.chrome.ChromeDriver;

public class DriverFactory {

    public static ChromeDriver createDriver(String browser) {
        // Only Chrome is really supported; anything else silently becomes Chrome
        ChromeDriver driver = new ChromeDriver();
        if (browser.equals("firefox")) {
            System.out.println("Firefox not supported yet");
        }
        return driver;
    }

    // TODO: enum Browser { CHROME, FIREFOX, EDGE }
    // TODO: public static WebDriver createDriver(Browser browser) using switch
    // TODO: public static WebDriver createDriverFromConfig() using Browser.valueOf
}
`,
  solution: `package com.shop.driver;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;

public final class DriverFactory {

    public enum Browser { CHROME, FIREFOX, EDGE }

    private DriverFactory() { }

    public static WebDriver createDriver(Browser browser) {
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));

        WebDriver driver = switch (browser) {
            case CHROME -> {
                ChromeOptions options = new ChromeOptions();
                if (headless) {
                    options.addArguments("--headless=new");
                }
                options.addArguments("--window-size=1920,1080");
                yield new ChromeDriver(options);
            }
            case FIREFOX -> new FirefoxDriver();
            case EDGE -> new EdgeDriver();
        };
        return driver;
    }

    public static WebDriver createDriverFromConfig() {
        String name = System.getProperty("browser", "chrome").trim().toUpperCase();
        Browser browser = Browser.valueOf(name);   // "CHORME" -> IllegalArgumentException
        return createDriver(browser);
    }
}
`,
  checks: [
    { label: 'Defines a Browser enum', pattern: 'enum\\s+Browser\\s*\\{[^}]*CHROME[^}]*FIREFOX', hint: 'enum Browser { CHROME, FIREFOX, EDGE }' },
    { label: 'Factory returns the WebDriver interface', pattern: 'static\\s+WebDriver\\s+createDriver\\s*\\(\\s*Browser\\s+\\w+\\s*\\)', hint: 'public static WebDriver createDriver(Browser browser)' },
    { label: 'Switches on the enum', pattern: 'switch\\s*\\(\\s*\\w+\\s*\\)', hint: 'switch (browser) { case CHROME -> ... }' },
    { label: 'Supports Firefox', pattern: 'new\\s+FirefoxDriver\\s*\\(', hint: 'case FIREFOX -> new FirefoxDriver();' },
    { label: 'No variable/return typed as ChromeDriver', pattern: '(ChromeDriver\\s+\\w+\\s*[=;(]|static\\s+ChromeDriver\\s)', mustNot: true, hint: 'Declare WebDriver driver = new ChromeDriver(...)' },
    { label: 'Converts the property with Browser.valueOf', pattern: 'Browser\\.valueOf\\s*\\(', hint: 'Browser.valueOf(System.getProperty("browser", "chrome").toUpperCase())' },
  ],
  explanation: `\`WebDriver\` is an **interface**: a contract listing what every browser driver can do (\`get\`, \`findElement\`, \`quit\`...). \`ChromeDriver\`, \`FirefoxDriver\` and \`EdgeDriver\` are **implementations**.

\`WebDriver driver = new ChromeDriver();\` is **polymorphism**: the variable's type is the interface, the object is a concrete class. At runtime \`driver.get(url)\` runs Chrome's implementation, but the code only depends on the contract. So:

* Pages and tests accept \`WebDriver\` and work unchanged on any browser (or a \`RemoteWebDriver\` on Selenium Grid).
* Only the factory knows the concrete classes — the "one place to change" principle again.
* If you declared \`ChromeDriver driver\`, you would be locked to Chrome everywhere that type appears.

The **enum** makes the set of browsers a closed, type-safe list. A String accepts \`"chorme"\`; \`Browser.valueOf("CHORME")\` throws immediately, and the \`switch\` over an enum lets the compiler check that every constant is handled (the switch *expression* fails to compile if you add \`SAFARI\` and forget a case). Enums are equally useful for \`Environment { QA, STAGING, PROD }\` with fields like the base URL.`,
  mistakes: [
    'Declaring ChromeDriver (or casting to it) in pages and tests, which locks the framework to one browser.',
    'Silently defaulting unknown browser names to Chrome — the run "passes" on the wrong browser.',
    'Comparing browser names with == or without normalizing case.',
    'Creating the driver in a static field shared by all tests (breaks parallel runs; use ThreadLocal).',
  ],
  interview: [
    { q: 'Why do we write WebDriver driver = new ChromeDriver() instead of ChromeDriver driver = new ChromeDriver()?', a: 'Programming to the interface. All code depends only on the WebDriver contract, so the same tests can run on Firefox, Edge or RemoteWebDriver by changing one line in the factory. It is an example of runtime polymorphism (upcasting).' },
    { q: 'What is the hierarchy of WebDriver in Selenium?', a: 'SearchContext is the top interface, WebDriver extends it. RemoteWebDriver implements WebDriver (plus JavascriptExecutor, TakesScreenshot, etc.), and ChromiumDriver → ChromeDriver/EdgeDriver and FirefoxDriver extend RemoteWebDriver.' },
    { q: 'What is the difference between an interface and an abstract class?', a: 'An interface defines a contract (abstract methods, plus default/static methods) and a class can implement many. An abstract class can hold state and constructors, and a class can extend only one. WebDriver is an interface; a BasePage is typically an abstract class.' },
    { q: 'Why use an enum instead of String constants?', a: 'Enums are type-safe: only valid values compile, valueOf rejects typos at runtime, switch statements can be checked for completeness, and constants can carry fields and methods (e.g. Environment.STAGING.baseUrl()).' },
  ],
}
