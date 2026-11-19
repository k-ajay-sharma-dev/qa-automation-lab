export default {
  id: 'fw-025',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Docker Selenium Grid: one DriverFactory for local and RemoteWebDriver',
  level: 'ADVANCED',
  tags: ['selenium-grid', 'docker', 'remotewebdriver', 'driver-factory', 'ci'],
  estMinutes: 30,
  scenario: `The Jenkins agent is a bare Linux box: no Chrome, no Firefox, and the infra team will not install browsers on
it. They offer Docker instead. The plan: start a **Selenium Grid** with \`docker compose\` (Chrome and Firefox nodes) and
point the tests at it. Laptops must keep working exactly as today — no Docker needed to run one test from IntelliJ.`,
  description: `Rewrite \`DriverFactory.create(String browser)\`.

**Rules**
- Build the browser **options** once (\`ChromeOptions\` / \`FirefoxOptions\`, headless from \`-Dheadless\`, window size 1920×1080);
  an unknown browser throws \`IllegalArgumentException\` naming it.
- Grid URL from the system property \`gridUrl\` or else the env variable \`SELENIUM_GRID_URL\` — never hard-coded.
- Grid URL set → \`new RemoteWebDriver(url, options)\`. Not set → local \`ChromeDriver\` / \`FirefoxDriver\` with the **same** options.
- A malformed grid URL fails with a clear message.`,
  starterCode: `package com.shopeasy.core;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;

public final class DriverFactory {

    private DriverFactory() { }

    public static WebDriver create(String browser) {
        if (browser.equals("firefox")) {
            return new FirefoxDriver();
        }
        return new ChromeDriver();
    }
}
`,
  solution: `package com.shopeasy.core;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import org.openqa.selenium.MutableCapabilities;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.remote.RemoteWebDriver;

public final class DriverFactory {

    private DriverFactory() { }

    public static WebDriver create(String browser) {
        MutableCapabilities options = optionsFor(browser);
        String gridUrl = System.getProperty("gridUrl", System.getenv("SELENIUM_GRID_URL"));

        if (gridUrl == null || gridUrl.isBlank()) {
            return options instanceof FirefoxOptions firefox
                    ? new FirefoxDriver(firefox)
                    : new ChromeDriver((ChromeOptions) options);
        }
        return new RemoteWebDriver(toUrl(gridUrl), options);
    }

    private static MutableCapabilities optionsFor(String browser) {
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));
        switch (browser.toLowerCase()) {
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

    private static URL toUrl(String gridUrl) {
        try {
            return URI.create(gridUrl).toURL();
        } catch (MalformedURLException | IllegalArgumentException e) {
            throw new IllegalStateException("Invalid Selenium Grid URL: " + gridUrl, e);
        }
    }
}
`,
  checks: [
    { label: 'Creates a RemoteWebDriver with options', pattern: 'new\\s+RemoteWebDriver\\s*\\([^;]+,\\s*\\w+\\s*\\)', hint: 'new RemoteWebDriver(url, options)' },
    { label: 'Grid URL from a property or env variable', pattern: 'System\\.(getProperty|getenv)\\s*\\(\\s*"(gridUrl|SELENIUM_GRID_URL)"', hint: 'System.getProperty("gridUrl", System.getenv("SELENIUM_GRID_URL"))' },
    { label: 'Local driver when no grid is configured', pattern: 'new\\s+ChromeDriver\\s*\\(\\s*\\(?\\s*(ChromeOptions\\s*\\)\\s*)?\\w+\\s*\\)', hint: 'new ChromeDriver(chromeOptions) — reuse the same options' },
    { label: 'Options built for both browsers', pattern: 'new\\s+ChromeOptions\\s*\\([\\s\\S]*new\\s+FirefoxOptions\\s*\\(|new\\s+FirefoxOptions\\s*\\([\\s\\S]*new\\s+ChromeOptions\\s*\\(', hint: 'ChromeOptions and FirefoxOptions, both used locally and remotely' },
    { label: 'Unknown browser fails clearly', pattern: 'throw\\s+new\\s+IllegalArgumentException\\s*\\([^;]*browser', hint: 'default: throw new IllegalArgumentException("Unsupported browser: " + browser);' },
    { label: 'No hard-coded grid address', pattern: '"https?://[^"]*:4444', mustNot: true, hint: 'The grid URL comes from -DgridUrl or SELENIUM_GRID_URL' },
  ],
  hints: [
    'RemoteWebDriver takes a URL and Capabilities — ChromeOptions and FirefoxOptions both are Capabilities.',
    'Build the options first, then decide local vs remote; both paths use the same object.',
    'URI.create(text).toURL() turns the configured string into a URL.',
  ],
  explanation: `**Grid in one sentence:** your test sends WebDriver commands over HTTP to the Grid (port 4444), the Grid
forwards them to a node container that runs the real browser. \`RemoteWebDriver\` is the client; the rest of your
framework (pages, waits) does not know the difference.

\`docker-compose.yml\` for the agent (pin the image tag, here 4.27.0-20241204):
\`\`\`yaml
services:
  selenium-hub:
    image: selenium/hub:4.27.0-20241204
    ports: ["4442:4442", "4443:4443", "4444:4444"]
  chrome:
    image: selenium/node-chrome:4.27.0-20241204
    shm_size: 2gb
    depends_on: [selenium-hub]
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
      - SE_NODE_MAX_SESSIONS=2
  firefox:
    image: selenium/node-firefox:4.27.0-20241204
    shm_size: 2gb
    depends_on: [selenium-hub]
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
\`\`\`
\`\`\`text
docker compose up -d
mvn -B clean test -DgridUrl=http://localhost:4444 -Dbrowser=firefox
docker compose down
\`\`\`
For a single browser, \`selenium/standalone-chrome\` (hub + node in one container) is enough — in GitHub Actions it can
run as a job \`services:\` container. Watch the Grid UI at \`http://localhost:4444/ui\`; the node images also offer
VNC/noVNC to watch a test live.

Gotchas reviewers check:
- **\`localhost\` means the container.** A browser inside Docker cannot reach \`http://localhost:5180\` on your machine;
  the base URL for grid runs must be reachable from the node (\`host.docker.internal\`, the compose service name, or a deployed QA URL) — set it in the env's properties file.
- **\`shm_size: 2gb\`** — Chrome crashes with the small default shared memory.
- **Parallel capacity** = nodes × \`SE_NODE_MAX_SESSIONS\`; keep TestNG \`thread-count\` at or below it or sessions queue and time out.
- File uploads need \`((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector())\` so the file is sent to the node.`,
  mistakes: [
    'Hard-coding the grid URL, so the same code cannot run locally.',
    'Pointing the remote browser at localhost, which is the container itself, not the machine running the app.',
    'Forgetting shm_size for Chrome nodes, causing random tab crashes.',
    'Setting thread-count higher than the Grid capacity, so tests wait in the queue and time out.',
  ],
  interview: [
    { q: 'What is Selenium Grid and when do you need it?', a: 'A server that receives WebDriver sessions and routes them to nodes with real browsers. It is used for parallel and cross-browser execution at scale and when the machine running the tests has no browsers, typically started with the docker-selenium images.' },
    { q: 'How does your framework switch between local and remote execution?', a: 'A DriverFactory builds browser options once, then creates a local driver or a RemoteWebDriver depending on whether a grid URL is configured via system property or environment variable. Tests and pages are unchanged.' },
    { q: 'Docker Grid vs a cloud provider like BrowserStack?', a: 'Docker Grid is free and fast to start in CI but limited to Linux browsers you host yourself. Cloud providers offer real Safari/Edge/mobile devices and scale without infrastructure, at a cost and with network latency. The same RemoteWebDriver code works for both.' },
  ],
}
