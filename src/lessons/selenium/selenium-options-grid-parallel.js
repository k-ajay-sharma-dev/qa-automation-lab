export default {
  slug: 'selenium-options-grid-parallel',
  category: 'selenium',
  order: 9,
  title: 'Browser options, screenshots, Grid and parallel runs',
  minutes: 10,
  summary: 'Configure Chrome/Firefox with options (headless, window size), capture screenshots on failure, run on Selenium Grid with RemoteWebDriver, and keep parallel tests safe with ThreadLocal.',
  manualAnalogy: `A manual regression cycle runs on several machines and browsers at once, and every defect you raise carries a screenshot. Automation at team scale needs the same: browsers started with the right settings on a CI server with no screen, evidence captured automatically when something fails, and several testers (threads) working at the same time without grabbing each other's browser.`,
  body: `## 1. Options: how a browser is started

\`ChromeOptions\` (or \`FirefoxOptions\`, \`EdgeOptions\`) describes *how* to launch the browser.

\`\`\`java
ChromeOptions options = new ChromeOptions();
if (Boolean.getBoolean("headless")) {                 // true when run with -Dheadless=true
    options.addArguments("--headless=new");
}
options.addArguments("--window-size=1366,768");
WebDriver driver = new ChromeDriver(options);
\`\`\`

- **Headless** = the browser runs without a visible window. CI agents have no screen, so this is the normal mode on Jenkins. \`--headless=new\` is Chrome's modern headless mode, which behaves like real Chrome.
- **Window size matters.** A headless browser has no monitor to maximise to; the default is small (around 800x600), which switches responsive sites into their mobile layout. Always set an explicit size.
- In Linux containers you often also need \`--no-sandbox\` and \`--disable-dev-shm-usage\`.
- \`Boolean.getBoolean("headless")\` reads a JVM **system property** (\`mvn test -Dheadless=true\`). Settings come from the command line, so the same code runs locally (headed, to watch) and on CI (headless).

### Window size, position and responsive checks

You can also size the window from code, at any time during a test:

\`\`\`java
driver.manage().window().setPosition(new Point(0, 0));
driver.manage().window().setSize(new Dimension(1024, 768));
int width = driver.manage().window().getSize().getWidth();
Rectangle box = driver.findElement(By.id("employee-table")).getRect();   // x, y, width, height
\`\`\`

- \`setSize\` sets the *outer* window; CSS breakpoints react to the smaller viewport (\`window.innerWidth\`).
- To check a responsive layout, resize and compare elements **to each other** with \`getRect()\` (same Y = same row) instead of exact pixel values. Wait for the reflow with a lambda condition.
- Desktop Chrome will not shrink below roughly 500px wide; for phone sizes use mobile emulation (\`options.setExperimentalOption("mobileEmulation", Map.of("deviceName", "Pixel 7"))\`).

### Page load strategy

\`options.setPageLoadStrategy(PageLoadStrategy.EAGER)\` changes when \`get()\` returns: \`NORMAL\` (default) waits for the full load event, \`EAGER\` returns when the HTML is parsed (images may still be loading), \`NONE\` returns at once. \`EAGER\` can speed up pages with slow third-party assets — your explicit waits then carry more of the synchronisation.

## 2. Screenshots: evidence on failure

\`\`\`java
File png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
Path target = Paths.get("target", "screenshots", "checkoutTotal.png");
Files.createDirectories(target.getParent());
Files.copy(png.toPath(), target, StandardCopyOption.REPLACE_EXISTING);
\`\`\`

- \`(TakesScreenshot) driver\` — a cast, like \`JavascriptExecutor\`.
- \`getScreenshotAs(OutputType.FILE)\` writes a temporary PNG; copy it somewhere permanent (\`target/\` is archived by Jenkins).
- Selenium 4: a single **\`WebElement\`** also has \`getScreenshotAs\` — perfect for capturing just an error banner.

To take it *only when a test fails*, TestNG can inject the result into your teardown:

\`\`\`java
@AfterMethod(alwaysRun = true)
public void tearDown(ITestResult result) {
    try {
        if (result.getStatus() == ITestResult.FAILURE) { /* screenshot named after result.getName() */ }
    } finally {
        driver.quit();          // runs even if the screenshot itself throws
    }
}
\`\`\`

## 3. Selenium Grid and RemoteWebDriver

Grid is a server that owns many browsers on many machines (often Docker containers). Your test sends commands to the Grid instead of a local driver:

\`\`\`java
FirefoxOptions ff = new FirefoxOptions();
WebDriver driver = new RemoteWebDriver(new URL("http://grid-host:4444"), ff);
\`\`\`

- The **options object** tells the Grid which browser you want (it carries \`browserName\`). In Selenium 4, options replace the old \`DesiredCapabilities\`.
- Read the Grid URL from a system property (e.g. \`-Dgrid.url=...\`); never hard-code it.
- Extra capabilities like \`options.setCapability("se:name", "Checkout total")\` label the session in the Grid UI.
- **File upload on Grid:** the browser runs on another machine, which doesn't have your file. \`((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector())\` makes Selenium send the file along.
- A common local Grid: the official Docker images \`selenium/hub\` plus \`selenium/node-chrome\` / \`selenium/node-firefox\` in a \`docker-compose.yml\` — or \`selenium/standalone-chrome\` for one container.

A **factory** method that reads \`browser\` and \`grid.url\` and returns a \`WebDriver\` keeps all this in one place; tests never call \`new ChromeDriver()\` themselves.

## 4. Parallel runs and ThreadLocal

TestNG can run tests in parallel threads:

\`\`\`xml
<suite name="Regression" parallel="methods" thread-count="4">
\`\`\`

Now picture a framework with \`public static WebDriver driver;\`. \`static\` means **one** variable shared by the whole program. Thread 1 creates a browser, thread 2 overwrites the variable with its browser, thread 3 finishes and calls \`quit()\` — on the browser threads 1 and 2 are still using. Result: random \`NoSuchSessionException\`, clicks in the wrong browser.

\`ThreadLocal\` gives each thread its **own private copy** of a variable:

\`\`\`java
private static final ThreadLocal<String> CURRENT_USER = new ThreadLocal<>();

CURRENT_USER.set("standard_user");   // only this thread sees it
String u = CURRENT_USER.get();       // each thread gets its own value
CURRENT_USER.remove();               // clean up when done
\`\`\`

Store the driver the same way: \`set\` it when the test starts, \`get\` it wherever a page needs it, and on teardown \`quit\` **and** \`remove\`. TestNG reuses pool threads; without \`remove()\`, the next test on that thread could find the previous test's dead driver.

Pages should receive the driver (constructor parameter or a \`getDriver()\` call), never reach for a shared static field.`,
  keyPoints: [
    'Options configure the launch: headless (`--headless=new`), explicit window size, container flags.',
    'Make settings switchable with system properties (`-Dheadless=true`, `-Dbrowser=firefox`, `-Dgrid.url=...`).',
    'Fixed window sizes (`setSize(new Dimension(...))`) make layouts reproducible; check responsiveness with `getRect()` comparisons.',
    'Screenshot on failure in `@AfterMethod(alwaysRun = true)` with `ITestResult`; quit in `finally`.',
    '`new RemoteWebDriver(gridUrl, options)` — the options pick the browser; use `LocalFileDetector` for uploads.',
    'Parallel + static driver = chaos. Use `ThreadLocal<WebDriver>`, and `quit()` + `remove()` in teardown.',
  ],
  mistakes: [
    'Relying on `maximize()` in headless mode — there is no screen; set `--window-size`.',
    'Hard-coding the Grid URL or browser name in code instead of reading system properties.',
    'Using Selenium 3 `DesiredCapabilities` — use `ChromeOptions`/`FirefoxOptions` in Selenium 4.',
    'Calling `quit()` but not `ThreadLocal.remove()` — reused threads leak a dead driver.',
  ],
  tryIt: `Run any test twice: once normally and once with \`--headless=new\` and no window size. Take a screenshot in both runs of \`http://localhost:5180/practice-site/inventory.html\` and compare the layouts.`,
  problems: ['sel-014', 'sel-019', 'sel-020', 'sel-028', 'sel-037'],
}
