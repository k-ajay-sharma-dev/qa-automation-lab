export default {
  id: 'pom-011',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'DriverManager with ThreadLocal for parallel runs',
  level: 'ADVANCED',
  tags: ['driver-factory', 'threadlocal', 'parallel', 'singleton'],
  estMinutes: 25,
  scenario: `The regression suite takes 48 minutes, so the team switched TestNG to \`parallel="methods"\`. Immediately,
tests started typing into each other's browsers and closing the wrong window. The culprit:
\`public static WebDriver driver;\` in a helper class, shared by every thread.`,
  description: `Write a \`DriverManager\` that gives **each thread its own WebDriver**.

**Rules**
- A \`private static final ThreadLocal<WebDriver>\`.
- \`initDriver(String browser)\` creates Chrome / Firefox / Edge (switch on the name; support headless via \`System.getProperty("headless")\`) and stores it with \`set\`.
- \`getDriver()\` returns \`DRIVER.get()\`.
- \`quitDriver()\` quits the driver **and** calls \`remove()\` to avoid leaks.
- Private constructor (utility class). No public static WebDriver field.`,
  starterCode: `package com.shopeasy.core;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class DriverManager {

    public static WebDriver driver;

    public static void initDriver(String browser) {
        driver = new ChromeDriver();
    }

    public static WebDriver getDriver() {
        return driver;
    }

    public static void quitDriver() {
        driver.quit();
    }
}
`,
  solution: `package com.shopeasy.core;

import java.time.Duration;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

public final class DriverManager {

    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverManager() { }

    public static void initDriver(String browser) {
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));
        WebDriver driver;
        switch (browser.toLowerCase()) {
            case "firefox": {
                FirefoxOptions options = new FirefoxOptions();
                if (headless) options.addArguments("-headless");
                driver = new FirefoxDriver(options);
                break;
            }
            case "edge": {
                EdgeOptions options = new EdgeOptions();
                if (headless) options.addArguments("--headless=new");
                driver = new EdgeDriver(options);
                break;
            }
            case "chrome":
            default: {
                ChromeOptions options = new ChromeOptions();
                if (headless) options.addArguments("--headless=new", "--window-size=1920,1080");
                driver = new ChromeDriver(options);
            }
        }
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        DRIVER.set(driver);
    }

    public static WebDriver getDriver() {
        WebDriver driver = DRIVER.get();
        if (driver == null) {
            throw new IllegalStateException("Driver not initialised for thread " + Thread.currentThread().getName());
        }
        return driver;
    }

    public static void quitDriver() {
        WebDriver driver = DRIVER.get();
        if (driver != null) {
            driver.quit();
            DRIVER.remove();
        }
    }
}
`,
  checks: [
    { label: 'Uses ThreadLocal<WebDriver>', pattern: 'ThreadLocal\\s*<\\s*WebDriver\\s*>', hint: 'private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();' },
    { label: 'No shared public static WebDriver', pattern: 'public\\s+static\\s+WebDriver\\s+\\w+\\s*[;=]', mustNot: true, hint: 'A static driver field is shared by all threads' },
    { label: 'Stores the driver with set()', pattern: '\\w+\\.set\\s*\\(', hint: 'DRIVER.set(driver);' },
    { label: 'getDriver reads the thread copy', pattern: 'getDriver\\s*\\(\\s*\\)[\\s\\S]*?\\.get\\s*\\(\\s*\\)', hint: 'return DRIVER.get();' },
    { label: 'quitDriver calls remove()', pattern: 'quitDriver[\\s\\S]*?quit\\s*\\(\\s*\\)[\\s\\S]*?\\.remove\\s*\\(\\s*\\)', hint: 'driver.quit(); DRIVER.remove();' },
    { label: 'Supports more than one browser', pattern: '(FirefoxDriver|EdgeDriver)', hint: 'switch on the browser name' },
  ],
  hints: [
    'ThreadLocal is a box where each thread sees only its own value.',
    'initDriver: build the driver, then DRIVER.set(driver).',
    'quitDriver: quit() then remove(), otherwise thread pools keep a dead driver.',
  ],
  explanation: `**Why ThreadLocal?** With \`parallel="methods"\` TestNG runs tests on a thread pool. A static field is one
slot for all threads, so thread B overwrites thread A's driver. \`ThreadLocal<WebDriver>\` gives every thread its own
slot behind the same static API, so page objects can still call \`DriverManager.getDriver()\`.

Key details:
- **\`remove()\` after quit** — pool threads are reused; without remove the next test on that thread could get a dead
  session (and you leak memory).
- **Fail fast** in \`getDriver()\` if nothing was initialised — far clearer than a NullPointerException deep in a page.
- Since Selenium 4.6, **Selenium Manager** downloads the matching driver binary automatically; no
  WebDriverManager or \`System.setProperty("webdriver.chrome.driver", ...)\` needed.
- A *DriverFactory* (creates drivers) + *DriverManager* (stores them per thread) split is common in bigger frameworks.`,
  mistakes: [
    'Using a static WebDriver and then wondering why parallel tests interfere.',
    'Forgetting ThreadLocal.remove(), leaving stale sessions on reused threads.',
    'Creating the driver inside page objects.',
    'Passing a ThreadLocal driver to a page created in another thread (e.g. inside a parallel stream).',
  ],
  interview: [
    { q: 'How do you make Selenium tests thread-safe for parallel execution?', a: 'Each thread gets its own WebDriver stored in a ThreadLocal inside a DriverManager. Pages get the driver from the test or from getDriver(). No static shared driver, no shared mutable test data, and quit plus remove in teardown.' },
    { q: 'Why call ThreadLocal.remove()?', a: 'Test runners reuse threads from a pool. Without remove, the thread still references the old (quit) driver, which leaks memory and can produce "session deleted" errors in the next test that forgets to init.' },
    { q: 'Is a Singleton driver a good idea?', a: 'A plain singleton gives one browser for the whole JVM, which blocks parallel execution. A per-thread singleton via ThreadLocal keeps the convenience without sharing state.' },
  ],
}
