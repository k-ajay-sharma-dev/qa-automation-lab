export default {
  id: 'sel-019',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Run the suite on Selenium Grid with RemoteWebDriver',
  level: 'EXPERT',
  tags: ['grid', 'RemoteWebDriver', 'cross-browser', 'docker', 'ci'],
  estMinutes: 35,
  scenario: `The regression suite takes 70 minutes on one Jenkins agent and the business now wants Chrome **and** Firefox coverage. DevOps has started a Selenium Grid 4 (\`docker compose\` with a hub and Chrome/Firefox nodes) at \`http://grid.internal:4444\`. Your ticket: make the driver factory run locally by default, and on the Grid when \`-Dgrid.url=...\` is passed, for the browser named by \`-Dbrowser=chrome|firefox\`. Uploads must keep working on the Grid.`,
  description: `Write a \`DriverFactory.create(String testName)\` method that:

1. Reads \`browser\` (default \`chrome\`) and \`grid.url\` (default: none) system properties.
2. Builds the right options object: \`ChromeOptions\` or \`FirefoxOptions\` (both are \`Capabilities\`), with headless + window size when \`-Dheadless=true\`.
3. If \`grid.url\` is set → \`new RemoteWebDriver(new URL(gridUrl), options)\` and set a \`LocalFileDetector\` so file uploads are sent to the node. Otherwise create the local driver.
4. Optionally add a capability such as \`se:name\` so the test name appears in the Grid UI.
5. Throws a clear \`IllegalArgumentException\` for an unknown browser.

**Rules**: no \`DesiredCapabilities\` (Selenium 3 style), no hard-coded Grid URL in code, return the \`WebDriver\` interface. Bonus: list the docker compose services you'd use in a comment.`,
  hints: [
    'new RemoteWebDriver(new URL(gridUrl), options) — the options object carries browserName.',
    '((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector());',
    'Use a switch on browser.toLowerCase() to build the options.',
  ],
  starterCode: `package com.shopeasy.framework;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.remote.DesiredCapabilities;

public final class DriverFactory {

    private DriverFactory() { }

    public static WebDriver create() {
        // Selenium 3 leftovers: hard-coded browser, no grid support
        DesiredCapabilities caps = DesiredCapabilities.chrome();
        return new ChromeDriver();
    }
}
`,
  solution: `package com.shopeasy.framework;

import org.openqa.selenium.MutableCapabilities;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.remote.LocalFileDetector;
import org.openqa.selenium.remote.RemoteWebDriver;

import java.net.MalformedURLException;
import java.net.URL;

/*
 * Grid 4 in docker compose (example):
 *   selenium-hub:   selenium/hub:4.x          ports 4442-4444
 *   chrome:         selenium/node-chrome:4.x  SE_EVENT_BUS_HOST=selenium-hub
 *   firefox:        selenium/node-firefox:4.x SE_EVENT_BUS_HOST=selenium-hub
 * Run: mvn test -Dbrowser=firefox -Dgrid.url=http://grid.internal:4444 -Dheadless=true
 */
public final class DriverFactory {

    private DriverFactory() { }

    public static WebDriver create(String testName) {
        String browser = System.getProperty("browser", "chrome").toLowerCase();
        String gridUrl = System.getProperty("grid.url");
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));

        MutableCapabilities options = buildOptions(browser, headless);
        options.setCapability("se:name", testName); // shows up in the Grid UI / video names

        if (gridUrl == null || gridUrl.isBlank()) {
            return browser.equals("firefox")
                    ? new FirefoxDriver((FirefoxOptions) options)
                    : new ChromeDriver((ChromeOptions) options);
        }

        try {
            RemoteWebDriver remote = new RemoteWebDriver(new URL(gridUrl), options);
            remote.setFileDetector(new LocalFileDetector()); // stream upload files to the node
            return remote;
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Invalid grid.url: " + gridUrl, e);
        }
    }

    private static MutableCapabilities buildOptions(String browser, boolean headless) {
        switch (browser) {
            case "chrome": {
                ChromeOptions chrome = new ChromeOptions();
                if (headless) chrome.addArguments("--headless=new");
                chrome.addArguments("--window-size=1920,1080");
                return chrome;
            }
            case "firefox": {
                FirefoxOptions firefox = new FirefoxOptions();
                if (headless) firefox.addArguments("-headless");
                firefox.addArguments("--width=1920", "--height=1080");
                return firefox;
            }
            default:
                throw new IllegalArgumentException("Unsupported browser: " + browser);
        }
    }
}
`,
  checks: [
    { label: 'Creates a RemoteWebDriver with a URL and options', pattern: 'new\\s+RemoteWebDriver\\s*\\(\\s*new\\s+URL\\s*\\(', hint: 'new RemoteWebDriver(new URL(gridUrl), options)' },
    { label: 'Reads the grid URL from a system property', pattern: 'System\\.getProperty\\s*\\(\\s*"grid\\.url"', hint: 'System.getProperty("grid.url")' },
    { label: 'Supports Chrome and Firefox options', pattern: 'new\\s+ChromeOptions[\\s\\S]*new\\s+FirefoxOptions|new\\s+FirefoxOptions[\\s\\S]*new\\s+ChromeOptions', hint: 'Build ChromeOptions or FirefoxOptions based on -Dbrowser' },
    { label: 'Sets a LocalFileDetector for uploads', pattern: 'setFileDetector\\s*\\(\\s*new\\s+LocalFileDetector', hint: 'remote.setFileDetector(new LocalFileDetector())' },
    { label: 'Fails clearly on unknown browser', pattern: 'throw\\s+new\\s+IllegalArgumentException', hint: 'default: throw new IllegalArgumentException("Unsupported browser: " + browser)' },
    { label: 'No Selenium 3 DesiredCapabilities factory methods', pattern: 'DesiredCapabilities\\.(chrome|firefox)\\s*\\(', mustNot: true, hint: 'Use ChromeOptions / FirefoxOptions — they are Capabilities' },
    { label: 'No hard-coded grid host', pattern: '"https?://grid\\.', mustNot: true, hint: 'Pass the URL with -Dgrid.url' },
  ],
  explanation: `**Selenium Grid 4** routes WebDriver commands from your test (client) to browsers on other machines/containers. Its components — Router, Distributor, Session Map, Session Queue, Event Bus, Nodes — can run all-in-one (\`standalone\`), as hub + nodes, or fully distributed (Kubernetes). The official \`selenium/*\` Docker images make a hub + nodes setup a 15-line compose file, and nodes can record video.

**RemoteWebDriver** speaks the same W3C protocol as a local driver, just over HTTP to \`http://host:4444\`. The \`Capabilities\` you send (here the \`ChromeOptions\`/\`FirefoxOptions\` object — no more \`DesiredCapabilities.chrome()\`, which was removed in Selenium 4) tell the Distributor which node can run the session. Extra \`se:\` capabilities (like \`se:name\`) configure Grid features.

Key Grid gotchas built into the solution:
- **File upload**: the file lives on *your* machine, the browser runs on the node. \`LocalFileDetector\` makes \`sendKeys(path)\` upload the file to the node first.
- **Configuration, not code**: Grid URL and browser come from \`-D\` properties (or env vars/config file), so Jenkins jobs can fan out a browser matrix without code changes.
- **Same interface**: tests still see only \`WebDriver\`. Grid + parallel execution needs one driver per thread (next problem).

Cloud providers (BrowserStack, Sauce Labs, LambdaTest) are just remote Grids with vendor capabilities.`,
  mistakes: [
    'Copying Selenium 3 examples with DesiredCapabilities.chrome() — removed in Selenium 4.',
    'Forgetting LocalFileDetector, so uploads fail only on the Grid with "File not found".',
    'Using the old /wd/hub path assumptions incorrectly — Grid 4 accepts both http://host:4444 and /wd/hub, but proxies may not.',
    'Hard-coding localhost:4444, which breaks inside Docker networks where the hub has a service name.',
  ],
  interview: [
    { q: 'What is Selenium Grid and why use it?', a: 'A server that distributes WebDriver sessions to remote browser nodes, enabling parallel and cross-browser/OS execution. Grid 4 is built from Router, Distributor, Session Map, Session Queue, Event Bus and Nodes and can run standalone, hub-node or distributed.' },
    { q: 'How does a test pick Firefox on the Grid?', a: 'By sending FirefoxOptions (browserName=firefox, plus optional platformName/browserVersion) to the RemoteWebDriver; the Distributor matches the capabilities to a node slot.' },
    { q: 'What changed from Grid 3 to Grid 4?', a: 'Grid 4 is W3C-only, has new components with standalone/hub-node/distributed modes, an event bus, a GraphQL endpoint and a new UI, Docker-friendly config, and DesiredCapabilities factory methods are replaced by browser Options classes.' },
  ],
}
