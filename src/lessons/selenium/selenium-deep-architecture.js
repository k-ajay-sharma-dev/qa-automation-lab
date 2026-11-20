export default {
  slug: 'selenium-deep-architecture',
  category: 'selenium',
  order: 11,
  title: 'Deep dive: Selenium architecture — W3C WebDriver protocol, sessions, drivers and BiDi',
  minutes: 30,
  summary: 'Trace a Selenium command from the Java bindings over HTTP + JSON to chromedriver/geckodriver and into the browser, understand sessions and capability negotiation, error codes, Options classes, Selenium Manager internals, session cleanup, RemoteWebDriver, CDP versus WebDriver BiDi, and how to diagnose driver problems from logs.',
  manualAnalogy: `When a defect only reproduces "on the CI machine", a strong manual tester asks about the environment before blaming the feature: which browser build, which profile, which proxy, what was already open. Senior automation work is the same question one level down: which process received the command, what was actually sent over the wire, which side answered with an error, and who was supposed to clean up. Knowing the architecture turns "Selenium is flaky" into a precise statement such as "chromedriver 129 refused a session for Chrome 131".`,
  body: `## Where the earlier lessons stop

The *How Selenium WebDriver drives a real browser* lesson introduced the three pieces (your test, the driver, the browser) and Selenium Manager in one paragraph. The *Browser options, screenshots, Grid and parallel runs* lesson showed \`ChromeOptions\`, headless mode and \`RemoteWebDriver\`, and *Beyond clicks* introduced BiDi listeners and \`NetworkInterceptor\`. This deep dive opens each box: the exact protocol, what a session is, how capabilities are negotiated, how errors become Java exceptions, what Selenium Manager does on disk, why CI agents fill up with zombie browsers, and where CDP and BiDi fit. Thread-safety of the driver (\`ThreadLocal\` internals, TestNG parallel modes) is covered in *java-deep-multithreading-synchronization*; exception design and the full Selenium exception → fix table live in *java-deep-exception-design*. Playwright's architecture is in *pw-deep-architecture* and is compared at the end.

## The components end to end

\`\`\`
 JVM (your test)                       driver process                      browser process(es)
┌──────────────────────┐   HTTP/1.1   ┌──────────────────────┐   internal   ┌─────────────────────┐
│ TestNG test          │   + JSON     │ chromedriver         │   protocol   │ Chrome              │
│  └ page object       │ ───────────► │  (W3C endpoint       │ ───────────► │  (DevTools protocol │
│     └ WebDriver API  │ ◄─────────── │   server, :port)     │ ◄─────────── │   over a pipe/port) │
│        └ HttpClient  │  one request │ geckodriver          │  Marionette  │ Firefox             │
│                      │  per command │ msedgedriver         │  CDP         │ Edge                │
│                      │              │ safaridriver         │  (Apple)     │ Safari              │
└──────────────────────┘              └──────────────────────┘              └─────────────────────┘
          │                                       ▲
          └── optional: WebSocket (BiDi / CDP) ───┘ (events pushed back to the test)
\`\`\`

| Layer | Who writes it | What it does |
|---|---|---|
| **Language bindings** (\`selenium-java\`) | Selenium project | Turn \`driver.findElement(...)\` into an HTTP request with a JSON body, decode the response, map errors to exceptions. No browser knowledge at all. |
| **Wire protocol** | W3C WebDriver specification ("WebDriver Classic") | REST-like endpoints, JSON payloads, string error codes. Synchronous: one request, one response. |
| **Browser driver** | Browser vendor (Google: chromedriver; Mozilla: geckodriver; Microsoft: msedgedriver; Apple: safaridriver) | An HTTP server that implements the spec for one browser and translates each command into that browser's internal automation interface. |
| **Browser automation interface** | Browser vendor | Chrome/Edge: the Chrome DevTools Protocol (CDP). Firefox: Marionette (and its Remote Agent for BiDi). Safari: Apple's private automation interface, enabled with \`safaridriver --enable\`. |

Why this split matters in practice:

- **The vendor owns correctness.** If \`click()\` behaves differently in Chrome and Firefox, the difference is usually in chromedriver vs geckodriver, not in Selenium. Bug reports go to the vendor's tracker.
- **The driver is a separate OS process** with its own port, its own log, and its own lifetime. It can crash, hang or be orphaned independently of your JVM.
- **The browser is a tree of processes** (browser, GPU, renderers, utilities). Killing chromedriver does not necessarily kill Chrome — the source of zombie browsers.
- **The bindings are thin.** Any language can drive any browser; Grid can sit in the middle because it just forwards the same HTTP protocol.

## The W3C WebDriver protocol

### Sessions

A **session** is one automated browser instance plus its state (current window/tab, current frame, timeouts, page load strategy, prompt behaviour, the map of element references). Every command except \`New Session\` and \`Status\` carries the session id in its URL. The driver keeps a table \`sessionId → browser connection\`; Grid keeps \`sessionId → node URI\`.

### New Session and capabilities negotiation

\`POST /session\` is the most complex command. The client sends a **capabilities request**:

\`\`\`json
{
  "capabilities": {
    "alwaysMatch": {
      "browserName": "chrome",
      "acceptInsecureCerts": true,
      "pageLoadStrategy": "eager",
      "unhandledPromptBehavior": "dismiss and notify",
      "timeouts": { "implicit": 0, "pageLoad": 30000, "script": 30000 },
      "goog:chromeOptions": { "args": ["--headless=new", "--window-size=1366,768"] }
    },
    "firstMatch": [ { "platformName": "linux" }, { "platformName": "windows" } ]
  }
}
\`\`\`

The spec's **capabilities processing** algorithm:

1. Validate \`alwaysMatch\` and every entry of \`firstMatch\` (unknown keys without a vendor prefix such as \`goog:\`, \`moz:\`, \`ms:\`, \`safari:\`, \`se:\` are invalid → \`invalid argument\`).
2. **Merge** \`alwaysMatch\` with each \`firstMatch\` entry (a key may not appear in both → error).
3. Try the merged candidates **in order**; the first one the endpoint can satisfy wins. If none matches → \`session not created\`.
4. Respond with the **matched capabilities** — what the browser actually is (exact \`browserVersion\`, \`platformName\`, \`setWindowRect\`, vendor data such as \`goog:chromeOptions.debuggerAddress\` and, with BiDi enabled, \`webSocketUrl\`).

\`\`\`json
{ "value": { "sessionId": "8f1c2a...", "capabilities": {
    "browserName": "chrome", "browserVersion": "131.0.6778.85", "platformName": "linux",
    "acceptInsecureCerts": true, "pageLoadStrategy": "eager",
    "goog:chromeOptions": { "debuggerAddress": "localhost:40213" } } } }
\`\`\`

Selenium Java's \`Options\` classes only ever fill \`alwaysMatch\` (Selenium 4 sends a single candidate). \`firstMatch\` matters mainly to **Grid**, which runs the same matching against its slots ("give me chrome on linux, or else on windows"). Read the *returned* capabilities when debugging: \`((HasCapabilities) driver).getCapabilities()\` tells you the real browser version, which is the first thing to log in a framework.

### Endpoints you should recognise

| Java call | HTTP | Body / notes |
|---|---|---|
| \`new ChromeDriver(options)\` | \`POST /session\` | capabilities |
| \`driver.get(url)\` | \`POST /session/{sid}/url\` | \`{"url": "..."}\`; blocks according to the page load strategy |
| \`driver.getTitle()\` | \`GET /session/{sid}/title\` | |
| \`driver.findElement(by)\` | \`POST /session/{sid}/element\` | \`{"using": "css selector", "value": "#user-name"}\` |
| \`driver.findElements(by)\` | \`POST /session/{sid}/elements\` | returns an array (maybe empty) |
| \`element.findElement(by)\` | \`POST /session/{sid}/element/{eid}/element\` | search scoped to the element |
| \`element.click()\` | \`POST /session/{sid}/element/{eid}/click\` | \`{}\` |
| \`element.sendKeys(...)\` | \`POST /session/{sid}/element/{eid}/value\` | \`{"text": "standard_user"}\` |
| \`element.getText()\` | \`GET /session/{sid}/element/{eid}/text\` | rendered text |
| \`getDomProperty\` / \`getDomAttribute\` | \`GET .../property/{name}\` / \`.../attribute/{name}\` | pure W3C commands |
| \`getAttribute\`, \`isDisplayed\` | \`POST /session/{sid}/execute/sync\` | Selenium sends a JavaScript "atom": neither is a plain W3C command |
| \`executeScript\` | \`POST /session/{sid}/execute/sync\` | \`{"script": "...", "args": [...]}\` |
| \`new Actions(driver)...perform()\` | \`POST /session/{sid}/actions\` | a tick-based list of input sources |
| \`driver.manage().timeouts()...\` | \`POST /session/{sid}/timeouts\` | |
| \`driver.quit()\` | \`DELETE /session/{sid}\` | then the bindings stop the driver process |

### Element references

The driver never sends the DOM node to Java. It stores the node in a per-session map and returns an opaque reference keyed by the **web element identifier**, a fixed string defined by the spec:

\`\`\`json
{ "value": { "element-6066-11e4-a52e-4f735466cecf": "f.9C3E...d.4A1B.e.17" } }
\`\`\`

A \`RemoteWebElement\` in Java is just that id plus the driver it belongs to. Consequences:

- **Staleness is decided by the driver.** When you use the id, the driver looks the node up; if it is no longer connected to the document (re-rendered, navigated away) it answers \`stale element reference\`. Nothing in Java "knows" the element is gone until you call it.
- References are **per session and per browsing context**: an element from one frame or window is not usable after switching away until you switch back.
- Shadow roots get their own identifier (\`shadow-6066-11e4-a52e-4f735466cecf\`), which is what \`getShadowRoot()\` returns.
- Equality of two \`WebElement\`s compares the ids; two separate \`findElement\` calls for the same node return the same id in practice, but do not build logic on that — compare business data instead.

### Errors → Java exceptions

Every failure is an HTTP status plus a JSON body with a **string error code**:

\`\`\`json
HTTP/1.1 404 Not Found
{ "value": { "error": "no such element",
             "message": "no such element: Unable to locate element: {\\"method\\":\\"css selector\\",\\"selector\\":\\"#user-nme\\"}",
             "stacktrace": "#0 0x55d4... <unknown>" } }
\`\`\`

The bindings decode the body (the W3C response codec and its error-code table in \`org.openqa.selenium.remote\`) and throw the matching subclass of \`WebDriverException\`:

| W3C error code | HTTP | Java exception | Typical real cause |
|---|---|---|---|
| \`no such element\` | 404 | \`NoSuchElementException\` | locator wrong, element not yet rendered, wrong frame |
| \`stale element reference\` | 404 | \`StaleElementReferenceException\` | DOM re-rendered after you found it |
| \`element click intercepted\` | 400 | \`ElementClickInterceptedException\` | overlay, sticky header, spinner covers the centre point |
| \`element not interactable\` | 400 | \`ElementNotInteractableException\` | hidden, zero size, disabled for typing |
| \`invalid selector\` | 400 | \`InvalidSelectorException\` | XPath/CSS syntax error, XPath returning text not elements |
| \`no such window\` / \`no such frame\` | 404 | \`NoSuchWindowException\` / \`NoSuchFrameException\` | window closed, wrong switch |
| \`no such alert\` / \`unexpected alert open\` | 404 / 500 | \`NoAlertPresentException\` / \`UnhandledAlertException\` | prompt timing, prompt behaviour capability |
| \`timeout\` / \`script timeout\` | 500 | \`TimeoutException\` / \`ScriptTimeoutException\` | page load timeout, async script never called back |
| \`invalid session id\` | 404 | \`NoSuchSessionException\` | used after \`quit()\`, browser crashed, Grid killed an idle session |
| \`session not created\` | 500 | \`SessionNotCreatedException\` | driver/browser version mismatch, invalid capability, no free Grid slot |
| \`javascript error\` | 500 | \`JavascriptException\` | your \`executeScript\` threw |
| \`unknown command\` | 404 | \`UnsupportedCommandException\` | driver does not implement the endpoint |
| \`unknown error\` | 500 | \`WebDriverException\` | catch-all: often "chrome not reachable" (browser died) |

Note the two \`TimeoutException\`s: the one above comes **from the driver** (page load); the one thrown by \`WebDriverWait\` is created **in Java** by the client-side polling loop and never touched the wire as a timeout. Also note that a socket error between Java and the driver (driver crashed, Grid restarted) surfaces as a \`WebDriverException\` wrapping a \`java.net\` exception — no W3C code at all. The exception message includes \`Build info\`, \`System info\`, \`Driver info\` and the session id: read those lines first.

### Every command is a round trip

\`\`\`java
for (WebElement card : driver.findElements(By.cssSelector("#inventory-list .inventory-item"))) {
    String name  = card.findElement(By.className("item-name")).getText();    // 2 requests
    String price = card.findElement(By.className("item-price")).getText();   // 2 requests
}
\`\`\`

Six products → 1 + 6 × 4 = **25 HTTP requests**, each one: JSON encode → HTTP → driver → CDP message → renderer → back. Locally the latency per request is small; against a remote Grid in another region every request pays network latency, so loops over elements dominate suite time. Options, from simplest to most aggressive:

1. Fetch less: one \`findElements\` for the prices (\`#inventory-list .item-price\`) instead of per-card lookups.
2. One \`executeScript\` that returns a \`List<Map<String, Object>>\` of all names and prices — one round trip, but the test now trusts JavaScript instead of WebDriver's rendered-text rules (fine for reading data, not for interactions).
3. Assert at a lower layer (API) and keep the UI test to what only the UI can prove.

Explicit waits multiply this: a \`WebDriverWait\` with a 500 ms poll interval sends one or more requests every poll. That is why the round-trip model is the core difference from Playwright (below).

## Tracing one command: findElement(By.id("user-name")).sendKeys(...)

\`\`\`java
driver.get("http://localhost:5180/practice-site/login.html");
driver.findElement(By.id("user-name")).sendKeys("standard_user");
\`\`\`

1. **\`By.id\` is translated by the Java bindings.** The W3C spec has no "id" strategy (only \`css selector\`, \`link text\`, \`partial link text\`, \`tag name\`, \`xpath\`). Selenium 4 converts \`By.id("user-name")\` to \`{"using": "css selector", "value": "#user-name"}\` (with CSS escaping for unusual ids). \`By.name\` and \`By.className\` are converted to CSS the same way.
2. **\`RemoteWebDriver.execute\`** builds a \`Command(sessionId, "findElement", params)\`; the command codec maps the name to \`POST /session/{sid}/element\` and serialises the body with Selenium's JSON layer.
3. **HTTP client** (part of the bindings; recent 4.x releases default to the JDK's \`java.net.http\` client) sends it to \`http://localhost:<port>\` where Selenium started chromedriver.
4. **chromedriver** resolves the session, finds the current browsing context (top document or the frame you switched into), and evaluates \`querySelector\` in the page through CDP (\`Runtime.evaluate\`/\`callFunctionOn\` against the right execution context). If the **implicit wait** is non-zero, chromedriver itself **re-polls** until the timeout — the implicit wait lives in the driver, not in Java. With implicit wait 0 it answers immediately.
5. The node is stored in the element map; the response carries \`element-6066-...\`. Java wraps it in a \`RemoteWebElement\`.
6. **\`sendKeys\`** → \`POST /session/{sid}/element/{eid}/value\` with \`{"text": "standard_user"}\`. The driver runs the spec's *Element Send Keys* steps: scroll into view, check the element is **keyboard-interactable** (else \`element not interactable\`), focus it (moving the caret to the end), then dispatch key events one character at a time — in chromedriver as CDP \`Input.dispatchKeyEvent\` calls. These are **trusted** events that go through the browser's input pipeline, unlike \`element.value = ...\` from JavaScript, which fires no key events.
7. The response \`{"value": null}\` returns; Java returns \`void\`. Total: 2 HTTP round trips, several CDP messages.

A \`click()\` follows the same path with extra checks: scroll into view, compute the **in-view centre point**, hit-test it (if another element is on top → \`element click intercepted\`), dispatch mouse pressed/released, and — if the click started a navigation — wait according to the page load strategy.

### Seeing the protocol with nothing but an HTTP client

The fastest way to *own* the protocol is to drive chromedriver without Selenium once. Start \`chromedriver --port=9515\` in a terminal, then:

\`\`\`java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class RawWebDriverClient {

    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final String DRIVER = "http://localhost:9515";
    private static final char Q = '"';

    public static void main(String[] args) throws Exception {
        String newSession = """
            {"capabilities": {"alwaysMatch": {
               "browserName": "chrome",
               "goog:chromeOptions": {"args": ["--headless=new", "--window-size=1366,768"]}}}}
            """;
        String sessionId = valueOf(send("POST", "/session", newSession), "sessionId");
        String base = "/session/" + sessionId;
        try {
            send("POST", base + "/url", """
                {"url": "http://localhost:5180/practice-site/login.html"}""");
            String found = send("POST", base + "/element", """
                {"using": "css selector", "value": "#user-name"}""");
            String elementId = valueOf(found, "element-6066-11e4-a52e-4f735466cecf");
            send("POST", base + "/element/" + elementId + "/value", """
                {"text": "standard_user"}""");
            System.out.println(send("GET", base + "/element/" + elementId + "/property/value", null));
            System.out.println(send("POST", base + "/element", """
                {"using": "css selector", "value": "#user-nme"}"""));   // see the error body
        } finally {
            send("DELETE", base, null);                                 // = driver.quit() minus stopping chromedriver
        }
    }

    private static String send(String method, String path, String json) throws Exception {
        HttpRequest.BodyPublisher body = json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json);
        HttpRequest request = HttpRequest.newBuilder(URI.create(DRIVER + path))
                .header("Content-Type", "application/json; charset=utf-8")
                .method(method, body)
                .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(method + " " + path + " -> " + response.statusCode());
        return response.body();
    }

    /** Minimal extraction of a string value — enough for a demo, use a JSON library in real code. */
    private static String valueOf(String json, String key) {
        String marker = Q + key + Q;
        int start = json.indexOf(Q, json.indexOf(':', json.indexOf(marker) + marker.length()) + 1) + 1;
        return json.substring(start, json.indexOf(Q, start));
    }
}
\`\`\`

**Step by step**

- The session request is exactly what \`new ChromeDriver(options)\` sends, minus a few defaults. \`goog:chromeOptions\` is the vendor-prefixed capability that \`ChromeOptions\` builds for you.
- Each \`send\` is one round trip; count them and you have the cost model.
- The final \`POST /element\` with a typo prints a **404** with \`"error": "no such element"\` — the body that Selenium would turn into \`NoSuchElementException\`.
- \`DELETE /session/{sid}\` closes the browser, but chromedriver keeps running: in Selenium, \`quit()\` also stops the **driver service**. That distinction explains orphaned \`chromedriver\` processes later.

## JSON Wire Protocol (Selenium 3) vs W3C (Selenium 4)

Before W3C standardisation, Selenium defined its own **JSON Wire Protocol** (JWP). Selenium 3 spoke both dialects; Selenium 4 speaks **only W3C** on the client side.

| Aspect | JSON Wire Protocol | W3C WebDriver |
|---|---|---|
| New session body | \`desiredCapabilities\` / \`requiredCapabilities\` | \`capabilities: {alwaysMatch, firstMatch}\` |
| Errors | numeric \`status\` in a 200 response (\`7\` = no such element) | HTTP status + string \`error\` |
| Element key | \`ELEMENT\` | \`element-6066-11e4-a52e-4f735466cecf\` |
| Locator strategies | id, name, class name, css, xpath, link text... | only css selector, link text, partial link text, tag name, xpath |
| Input | separate mouse/keyboard endpoints (\`/moveto\`, \`/buttondown\`) | one \`/actions\` endpoint with input sources and ticks |
| Vendor capabilities | anything at top level (\`chromeOptions\`) | must be prefixed (\`goog:chromeOptions\`) |
| Owner | Selenium project | W3C, implemented by browser vendors |

What changed **for users** moving to Selenium 4:

- Use \`ChromeOptions\`/\`FirefoxOptions\`; constructors taking \`DesiredCapabilities\` and \`merge\` tricks are no longer the main path, and unprefixed custom capabilities make session creation fail.
- \`findElementById\`, \`findElementsByXPath\` and the \`FindsBy*\` interfaces were removed; use \`findElement(By...)\`.
- Timeouts take \`Duration\` (\`new WebDriverWait(driver, Duration.ofSeconds(10))\`, \`implicitlyWait(Duration)\`); the \`long, TimeUnit\` and \`(driver, 10)\` forms are gone or deprecated.
- \`getAttribute\` keeps its "property-or-attribute" guessing (via an atom); \`getDomAttribute\` and \`getDomProperty\` map 1:1 to W3C commands — prefer them.
- Actions are W3C actions: more precise (multiple pointers, pauses) and consistent across drivers.
- Grid 4 was rewritten (router, distributor, session map, nodes, event bus) and speaks only W3C.

## Capabilities and Options classes

\`ChromeOptions\`, \`FirefoxOptions\`, \`EdgeOptions\` and \`SafariOptions\` extend \`AbstractDriverOptions\`, which extends \`MutableCapabilities\`. An Options object is a **typed builder for one capabilities map**: the standard W3C keys live at the top level, the browser-specific ones inside the vendor key.

| Method | Capability produced | Notes |
|---|---|---|
| \`setPageLoadStrategy(PageLoadStrategy.EAGER)\` | \`pageLoadStrategy: "eager"\` | when \`get()\`/navigating clicks return |
| \`setUnhandledPromptBehaviour(UnexpectedAlertBehaviour.DISMISS_AND_NOTIFY)\` | \`unhandledPromptBehavior\` | what the driver does with a surprise alert; "notify" variants also throw \`UnhandledAlertException\` |
| \`setAcceptInsecureCerts(true)\` | \`acceptInsecureCerts\` | self-signed test environments; never needed for production URLs |
| \`setPageLoadTimeout(Duration)\`, \`setScriptTimeout(Duration)\`, \`setImplicitWaitTimeout(Duration)\` | \`timeouts\` | set once at session start |
| \`setBrowserVersion("stable")\` | \`browserVersion\` | also tells Selenium Manager which browser to resolve |
| \`setPlatformName("linux")\` | \`platformName\` | mainly for Grid matching |
| \`setCapability("se:name", "checkout")\` | \`se:name\` | arbitrary prefixed capability (Grid labels) |
| \`addArguments(...)\` | \`goog:chromeOptions.args\` / \`moz:firefoxOptions.args\` | command-line switches |
| \`setExperimentalOption("prefs", map)\` | \`goog:chromeOptions.prefs\` | Chrome profile preferences |
| \`addPreference(key, value)\` (Firefox) | \`moz:firefoxOptions.prefs\` | \`about:config\` preferences |
| \`setBinary(path)\` | \`goog:chromeOptions.binary\` | a specific Chrome build |

### Complete example: a browser-agnostic options factory

\`\`\`java
import java.time.Duration;
import java.util.Map;
import org.openqa.selenium.MutableCapabilities;
import org.openqa.selenium.PageLoadStrategy;
import org.openqa.selenium.UnexpectedAlertBehaviour;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.remote.AbstractDriverOptions;

public final class BrowserOptionsFactory {

    private BrowserOptionsFactory() { }

    public static MutableCapabilities forBrowser(String browser, boolean headless) {
        AbstractDriverOptions<?> options = switch (browser.toLowerCase()) {
            case "chrome"  -> chrome(headless);
            case "edge"    -> edge(headless);
            case "firefox" -> firefox(headless);
            default -> throw new IllegalArgumentException("Unsupported browser: " + browser);
        };
        // W3C capabilities: identical meaning for every driver
        options.setPageLoadStrategy(PageLoadStrategy.NORMAL);
        options.setUnhandledPromptBehaviour(UnexpectedAlertBehaviour.DISMISS_AND_NOTIFY);
        options.setAcceptInsecureCerts(Boolean.getBoolean("insecure.certs"));
        options.setPageLoadTimeout(Duration.ofSeconds(30));
        options.setScriptTimeout(Duration.ofSeconds(15));
        options.setCapability("se:name", System.getProperty("test.name", "shopeasy-ui"));
        return options;
    }

    private static ChromeOptions chrome(boolean headless) {
        ChromeOptions o = new ChromeOptions();
        if (headless) o.addArguments("--headless=new");
        o.addArguments("--window-size=1366,768", "--disable-search-engine-choice-screen");
        o.setExperimentalOption("prefs", Map.of(
                "credentials_enable_service", false,              // no "save password" bubble
                "profile.password_manager_enabled", false));
        return o;
    }

    private static EdgeOptions edge(boolean headless) {
        EdgeOptions o = new EdgeOptions();                         // ms:edgeOptions, Chromium-based
        if (headless) o.addArguments("--headless=new");
        o.addArguments("--window-size=1366,768");
        return o;
    }

    private static FirefoxOptions firefox(boolean headless) {
        FirefoxOptions o = new FirefoxOptions();
        if (headless) o.addArguments("-headless");
        o.addArguments("-width=1366", "-height=768");
        o.addPreference("signon.rememberSignons", false);         // about:config pref
        return o;
    }
}
\`\`\`

**Step by step**

- The factory returns \`MutableCapabilities\` so the same object feeds \`new ChromeDriver(...)\` (after a cast), \`new RemoteWebDriver(url, caps)\` or Grid — the **capabilities are the contract**, the driver class is a detail.
- The switch expression returns concrete Options; common W3C capabilities are applied once on the abstract type (Open/Closed: a new browser adds one method).
- Flags differ by browser: Chrome uses \`--headless=new\` and \`--window-size=w,h\`; Firefox uses \`-headless\`, \`-width\`/\`-height\`. Putting Chrome switches into \`FirefoxOptions\` is silently ignored or fails — a classic cross-browser bug.
- \`setExperimentalOption("prefs", ...)\` ends up as \`goog:chromeOptions.prefs\`. \`System.out.println(options.asMap())\` prints the exact JSON-to-be: the quickest way to answer "what did we actually send?".
- Vendor keys from the wrong vendor are ignored by the other driver, but a typo in a **standard** key or an unprefixed custom key fails with \`SessionNotCreatedException\`/\`InvalidArgumentException\` — which is good: fail fast.

### Driver-specific behaviour worth knowing

- **chromedriver / msedgedriver**: talk CDP to the browser; support \`goog:loggingPrefs\`, mobile emulation, \`executeCdpCommand\`, \`--remote-debugging-pipe\` internally. msedgedriver is a Chromium fork, so behaviour is close to chromedriver.
- **geckodriver**: proxies to Firefox's **Marionette** server; Firefox profile prefs via \`addPreference\`; context switching between content and chrome (\`moz:context\`) for browser-UI automation.
- **safaridriver**: ships with macOS, one session per Safari instance (no parallel sessions on one machine), requires \`safaridriver --enable\` once; no headless mode.

## Driver binaries: Selenium Manager vs WebDriverManager vs manual path

### Selenium Manager internals

Selenium Manager is a **Rust command-line tool** bundled inside the \`selenium-java\` jar (one binary per OS) since **Selenium 4.6**; automated **browser** management was added in 4.11 (Chrome), 4.12 (Firefox) and 4.14 (Edge). The selenium.dev docs still describe it as beta (its own version is 0.4.x, tracking Selenium's minor version).

When does it run? It is a **fallback**. When \`new ChromeDriver()\` builds its \`DriverService\`, the Java bindings look for a driver path in this order: the \`webdriver.chrome.driver\` system property (or the path you passed to the service builder), a \`SE_CHROMEDRIVER\`-style environment variable, a driver on the \`PATH\` — and only if none is found, extract and invoke Selenium Manager. Its job:

1. **Browser discovery:** find the installed browser and its version (registry on Windows, standard paths on macOS/Linux, or the \`browser-path\`/\`setBinary\` you gave).
2. **Version resolution:** ask the vendor's metadata endpoints which driver matches (for Chrome 115+ the *Chrome for Testing* JSON endpoints; geckodriver from GitHub releases with a compatibility table; msedgedriver from Microsoft's endpoint).
3. **Download and cache** into \`~/.cache/selenium\` (e.g. \`~/.cache/selenium/chromedriver/linux64/131.0.6778.85/chromedriver\`). Metadata is cached with a TTL (default 3600 s), so a warm cache needs no network.
4. **Browser management:** if the browser is missing, or \`browserVersion\` asks for a specific version/\`beta\`/\`dev\`, it downloads Chrome for Testing / Firefox / Edge into the same cache.
5. Return the paths to the bindings, which then start the driver normally.

Configuration (precedence: CLI args → \`se-config.toml\` in the cache folder → environment variables):

| Need | Env var / config key |
|---|---|
| No network at all (air-gapped CI) | \`SE_OFFLINE=true\` / \`offline = true\` — uses only the cache and local installs |
| Corporate proxy | \`SE_PROXY\` / \`proxy\` (or \`options.setProxy\` from the bindings) |
| Shared cache location | \`SE_CACHE_PATH\` / \`cache-path\` |
| Pin a driver version | \`SE_DRIVER_VERSION\` / \`driver-version\` |
| Never download a browser | \`SE_AVOID_BROWSER_DOWNLOAD=true\` |
| Use a custom Selenium Manager binary | \`SE_MANAGER_PATH\` (documented as of 4.13) |
| Bypass it entirely | provide the driver path (system property, \`ChromeDriverService.Builder().usingDriverExecutable(...)\`, \`SE_CHROMEDRIVER\`) |

To see what it does, raise Selenium's \`java.util.logging\` level for \`org.openqa.selenium\` to \`FINE\`: Selenium Manager's resolution messages appear in the log.

### The three approaches compared

\`\`\`java
// 1. Selenium Manager (default, nothing to write)
WebDriver a = new ChromeDriver(options);

// 2. WebDriverManager (io.github.bonigarcia:webdrivermanager)
WebDriverManager.chromedriver().setup();          // downloads + sets webdriver.chrome.driver
WebDriver b = new ChromeDriver(options);

// 3. Manual path, e.g. a driver baked into a Docker image
ChromeDriverService service = new ChromeDriverService.Builder()
        .usingDriverExecutable(new File("/opt/drivers/chromedriver"))
        .build();
WebDriver c = new ChromeDriver(service, options);
\`\`\`

| | Selenium Manager | WebDriverManager | Manual / image-baked |
|---|---|---|---|
| How it works | Rust binary invoked by the bindings as a fallback | Java library; resolves, downloads, sets the system property | You pin and ship the binary |
| Advantages | zero code, maintained by Selenium, browser download, offline/proxy config | rich Java API, Docker browser support, mature, works with old Selenium | fully reproducible, no network at runtime |
| Disadvantages | beta-labelled; config via env/TOML; first run needs network | extra dependency to upgrade; overlaps with built-in feature | manual upgrades; breaks on browser auto-update |
| Performance | first run downloads, then cache hit | similar (own cache in \`~/.cache/selenium\` by default too) | none at runtime |
| Maintainability | best | good | worst on dev machines, best inside images |
| Scalability (CI) | warm the cache in the agent image | same | ideal for containers/Grid nodes |
| When to use | default for local and CI with Selenium 4.6+ | legacy frameworks, Selenium < 4.6, features SM lacks | Docker/Grid nodes, air-gapped environments |

**Recommended approach and why:** delete hard-coded \`System.setProperty("webdriver.chrome.driver", ...)\` and WebDriverManager from a Selenium 4 framework and rely on Selenium Manager locally and on CI agents, with a warmed or shared cache (\`SE_CACHE_PATH\`) and \`SE_OFFLINE=true\` where the network is locked down. For **Grid**, the question disappears: the official \`selenium/node-*\` images ship matched browser + driver pairs, and the client never needs a driver binary. Keep a manual path only for images you build yourself.

## Session lifecycle and cleanup

\`\`\`
new ChromeDriver(opts)
  ├─ start DriverService (spawn chromedriver on a free port, wait for /status)
  ├─ POST /session  → chromedriver spawns Chrome with a temp profile (--user-data-dir=/tmp/...)
  │
  │  ... commands ...
  │
driver.quit()
  ├─ DELETE /session/{sid} → chromedriver closes Chrome, deletes the temp profile
  └─ DriverService.stop()  → chromedriver process exits
\`\`\`

What goes wrong:

| Symptom | Cause | Fix |
|---|---|---|
| \`chromedriver\` processes accumulate on the agent | \`close()\` instead of \`quit()\`, or \`quit()\` never reached (exception in setup, \`@AfterMethod\` without \`alwaysRun\`) | \`quit()\` in a guarded teardown with \`alwaysRun = true\`; null-check the driver |
| Chrome processes without a driver (zombie browsers), \`/tmp\` full of profiles | JVM killed (CI timeout, \`kill -9\`, Surefire fork crash) before \`DELETE /session\`; chromedriver dies with the parent but Chrome is orphaned | run browsers in containers that are destroyed; CI post-step that kills leftover \`chrome\`/\`chromedriver\` on dedicated agents; JVM shutdown hook as a best effort |
| \`NoSuchSessionException\` mid-test on Grid | Grid's \`--session-timeout\` reaped an idle session (default 300 s) or the node restarted | do not sit idle (debug breakpoints!); tune the timeout; keep tests short |
| \`SessionNotCreatedException: Could not start a new session... Timed out\` on Grid | no free slot within the request timeout | capacity, \`--session-request-timeout\`, fewer parallel threads |
| Leaking ThreadLocal driver after quit | missing \`remove()\` | see *java-deep-multithreading-synchronization* |

A minimal, correct lifecycle (TestNG):

\`\`\`java
@AfterMethod(alwaysRun = true)
public void tearDown() {
    WebDriver driver = DriverHolder.get();
    if (driver == null) return;                 // setup failed before the session existed
    try {
        driver.quit();
    } catch (WebDriverException e) {
        log.warn("quit() failed; session probably already gone", e);   // never mask the test result
    } finally {
        DriverHolder.remove();
    }
}
\`\`\`

A shutdown hook (\`Runtime.getRuntime().addShutdownHook(...)\` that quits every tracked driver) helps when the JVM exits normally after a crash in a listener, but **does not run on \`kill -9\`** — container teardown and Grid timeouts are the real safety net.

## RemoteWebDriver vs local drivers

\`ChromeDriver\` **is** a \`RemoteWebDriver\`: it extends \`ChromiumDriver\` → \`RemoteWebDriver\`, and the only difference is that it starts a local \`DriverService\` and points the HTTP executor at it. \`new RemoteWebDriver(gridUrl, options)\` points the same executor at Grid (or at any W3C endpoint such as a cloud vendor).

| | Local (\`new ChromeDriver\`) | Remote (\`RemoteWebDriver\` to Grid/cloud) |
|---|---|---|
| Driver process | started and stopped by your JVM | lives on the node; Grid routes by session id |
| Extra interfaces | \`HasDevTools\`, \`HasCdp\`, \`HasAuthentication\`... directly | wrap with \`new Augmenter().augment(driver)\` to get them |
| File upload | local path works | needs \`setFileDetector(new LocalFileDetector())\` |
| Downloads | local folder | Grid's managed downloads (\`se:downloadsEnabled\`) or volume mounts |
| Latency | sub-millisecond network | each command crosses the network: batch reads, avoid chatty loops |
| Timeouts | rarely matter | client read timeout must exceed the longest command (e.g. slow page load) — configure via \`ClientConfig\` |

\`\`\`java
ClientConfig config = ClientConfig.defaultConfig()
        .baseUrl(new URL(System.getProperty("grid.url", "http://localhost:4444")))
        .readTimeout(Duration.ofMinutes(2));
WebDriver driver = RemoteWebDriver.builder()
        .oneOf(new ChromeOptions())
        .config(config)
        .build();
WebDriver augmented = new Augmenter().augment(driver);   // adds HasDevTools etc. when the node supports it
\`\`\`

Write the framework against \`WebDriver\` (plus the narrow role interfaces you need: \`JavascriptExecutor\`, \`TakesScreenshot\`, \`HasCapabilities\`), never against \`ChromeDriver\`: the same test then runs local or remote unchanged (Liskov/Dependency Inversion in practice).

## CDP and WebDriver BiDi

Classic WebDriver is request/response: the browser cannot tell you "a console error happened" or "a request is about to be sent". Two two-way channels exist.

### CDP in Selenium 4

Chromium-based drivers expose the browser's **Chrome DevTools Protocol** WebSocket (the \`debuggerAddress\` in the returned capabilities). Selenium gives two ways in:

\`\`\`java
// A. Raw command, version-independent (Chromium only, request/response only)
ChromiumDriver chrome = (ChromiumDriver) driver;
chrome.executeCdpCommand("Network.enable", Map.of());
chrome.executeCdpCommand("Network.setBlockedURLs", Map.of("urls", List.of("*.png", "*.jpg")));

// B. Typed DevTools API: events + commands, generated per CDP version
DevTools devTools = ((HasDevTools) driver).getDevTools();
devTools.createSession();
devTools.send(org.openqa.selenium.devtools.v131.network.Network.enable(
        Optional.empty(), Optional.empty(), Optional.empty()));          // arity varies by version!
devTools.addListener(org.openqa.selenium.devtools.v131.network.Network.responseReceived(),
        r -> System.out.println(r.getResponse().getStatus() + " " + r.getResponse().getUrl()));
\`\`\`

The typed API is generated from each Chrome release's protocol definition into packages \`org.openqa.selenium.devtools.vNNN\` (separate \`selenium-devtools-vNNN\` artifacts). The selenium.dev docs state that Selenium supports **the 3 most recent versions of Chrome** at a time and call CDP support "temporary until WebDriver BiDi has been implemented". The **maintenance cost**: every few Selenium releases your \`vNNN\` imports stop compiling or stop matching the browser on CI, method signatures change between versions (the \`Network.enable\` parameter list above is a real example), and it only works on Chromium. Selenium's higher-level helpers (\`NetworkInterceptor\`, \`HasAuthentication\`, \`HasLogEvents\`) hide the version for common cases — prefer them over raw \`vNNN\` imports.

### WebDriver BiDi

**WebDriver BiDi** is the W3C successor: the same session, plus a **WebSocket** on which the client sends commands and the browser pushes events, defined once for all browsers and implemented by browser vendors (Chrome via chromedriver, Firefox natively). In Java you opt in with the \`webSocketUrl\` capability; the returned capabilities then contain the socket URL, and modules such as \`LogInspector\`, \`BrowsingContext\`, \`Network\` and \`Script\` (\`org.openqa.selenium.bidi.module\`) use it.

\`\`\`java
ChromeOptions options = new ChromeOptions();
options.setCapability("webSocketUrl", true);
WebDriver driver = new ChromeDriver(options);
try (LogInspector logs = new LogInspector(driver)) {
    List<String> jsErrors = new CopyOnWriteArrayList<>();
    logs.onJavaScriptException(e -> jsErrors.add(e.getText()));
    driver.get("http://localhost:5180/practice-site/checkout.html");
    // ... drive the page, then wait for / assert on jsErrors
} finally {
    driver.quit();
}
\`\`\`

Be honest about maturity: the BiDi specification is still evolving, browser coverage differs per module (Firefox and Chrome are furthest; Safari lags), and the Java high-level APIs are still changing between 4.x releases — some are marked beta. Selenium's direction is to move features (and eventually its classic commands) onto BiDi, so new code should prefer BiDi APIs where they cover the need and keep CDP behind a small adapter where they do not.

| | CDP (\`DevTools\`, \`executeCdpCommand\`) | WebDriver BiDi |
|---|---|---|
| Standard | Chrome's internal debugging protocol, no stability promise | W3C specification |
| Browsers | Chrome, Edge (Chromium only) | cross-browser by design; coverage varies by browser and module |
| Version coupling | typed API tied to Chrome version (\`vNNN\`), last 3 supported | version-independent protocol |
| Capabilities today | very broad: network interception, performance, emulation, coverage... | console/JS errors, navigation, script, network events and interception, more being added |
| Through Grid | needs a reachable CDP endpoint (Grid 4 proxies it) | proxied WebSocket via Grid |
| Maintenance | high: imports and signatures churn | low once a feature is supported |
| When to use | a Chromium-only need BiDi does not yet cover | default for new event-driven needs |

## Selenium vs Playwright architecture

| | Selenium 4 | Playwright |
|---|---|---|
| Transport | HTTP request per command to a vendor driver (plus optional BiDi WebSocket) | one persistent WebSocket/pipe to a Playwright server that speaks CDP / patched Firefox & WebKit protocols directly |
| Round trips | one per command; loops are chatty | locator actions run their checks inside the server; fewer client round trips |
| Waiting | no auto-wait; implicit wait (server-side, element presence only) or client-side \`WebDriverWait\` | actionability auto-waiting (visible, stable, enabled, receives events) on every action; web-first assertions retry |
| Element model | element **references** that can go stale | **locators** re-resolved on each use, no stale references |
| Browsers | real branded browsers via vendor drivers, including Safari | bundled Chromium, Firefox and WebKit builds (+ Chrome/Edge channels); WebKit ≠ Safari |
| Languages | Java, Python, C#, JavaScript, Ruby (+ community) | TypeScript/JS, Python, Java, .NET |
| Standards | W3C WebDriver + BiDi | own protocol |
| Isolation | one browser profile per session | many cheap BrowserContexts per browser |

Selenium's strength is the **standard**: vendor-maintained drivers, real Safari, any language, Grid and every cloud vendor. Playwright's strength is the **integrated** design: auto-waiting, tracing and fewer round trips. See *pw-deep-architecture* for the Playwright side. In Playwright the equivalent of the trace above is a single call that waits for actionability before typing:

\`\`\`typescript
await page.goto('http://localhost:5180/practice-site/login.html');
await page.locator('#user-name').fill('standard_user');   // resolves + waits + fills in the server
\`\`\`

## Logging and diagnosing driver issues

### Driver service logs

The driver's own log shows every command it received, the CDP/Marionette traffic and the browser's stderr — the only place you see *why* the driver answered as it did.

\`\`\`java
import java.io.File;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeDriverService;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.chromium.ChromiumDriverLogLevel;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxDriverLogLevel;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.firefox.GeckoDriverService;

public final class DiagnosticDrivers {

    private DiagnosticDrivers() { }

    public static WebDriver chromeWithLog(String testName) {
        ChromeDriverService service = new ChromeDriverService.Builder()
                .withLogFile(new File("target/driver-logs/" + testName + "-chromedriver.log"))
                .withLogLevel(ChromiumDriverLogLevel.DEBUG)
                .withReadableTimestamp(true)
                .build();
        return new ChromeDriver(service, new ChromeOptions());
    }

    public static WebDriver firefoxWithLog(String testName) {
        GeckoDriverService service = new GeckoDriverService.Builder()
                .withLogFile(new File("target/driver-logs/" + testName + "-geckodriver.log"))
                .withLogLevel(FirefoxDriverLogLevel.TRACE)
                .build();
        return new FirefoxDriver(service, new FirefoxOptions());
    }
}
\`\`\`

**Step by step**

- The service builder controls the **driver process**: executable, port, log file, log level, environment. Options control the **browser**. Mixing them up is common (browser log flags in \`addArguments\` do not configure chromedriver).
- \`ChromiumDriverLogLevel.DEBUG\` replaces the older \`withVerbose(true)\` style; both exist in some 4.x versions — use whatever your version does not deprecate. Without code changes, the system properties \`webdriver.chrome.logfile\` and \`webdriver.chrome.verboseLogging\` do the same.
- Make the log path per test (or per thread) and attach it to the report only on failure; verbose driver logs are large.
- For the **client** side, set \`java.util.logging\` for \`org.openqa.selenium\` to \`FINE\` to see Selenium Manager decisions and command traffic.

### Reading SessionNotCreatedException

\`\`\`
org.openqa.selenium.SessionNotCreatedException: Could not start a new session.
Response code 500. Message: session not created: This version of ChromeDriver only supports Chrome version 129
Current browser version is 131.0.6778.85 with binary path C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
Build info: version: '4.x', revision: '...'
Driver info: org.openqa.selenium.chrome.ChromeDriver
\`\`\`

Diagnosis order:

1. **Which driver was used?** A version mismatch with Selenium Manager in place almost always means Selenium Manager **did not run** because a stale driver was found first: a \`webdriver.chrome.driver\` property, WebDriverManager pinned to an old version, or an old \`chromedriver.exe\` on the \`PATH\` (\`where chromedriver\` / \`which chromedriver\`).
2. **Could it download?** In proxied/air-gapped CI, Selenium Manager fails to resolve — the \`FINE\` log shows the HTTP error. Fix with \`SE_PROXY\`, a pre-warmed cache, or \`SE_OFFLINE=true\` plus a cached driver.
3. **Did the browser start at all?** "Chrome failed to start: exited abnormally" / "DevToolsActivePort file doesn't exist" → missing \`--no-sandbox\`/\`--disable-dev-shm-usage\` in containers, no display for headed mode, or a locked \`--user-data-dir\` shared between parallel sessions.
4. **Invalid capability?** "invalid argument: unrecognized capability" → an unprefixed custom key or an option for the wrong browser.

## Common mistakes and debugging

- **Blaming Selenium for driver behaviour.** Reproduce with the raw protocol or a minimal script, read the driver log, and check the vendor's issue tracker before writing a workaround.
- **Calling \`isDisplayed()\`/\`getAttribute()\` in tight loops** without knowing each is a JavaScript atom over HTTP. Read the data once (\`findElements\` + one pass, or one \`executeScript\`).
- **Combining implicit and explicit waits.** The implicit wait runs inside the driver for every \`findElement\` the explicit wait makes, so timeouts multiply unpredictably. Keep implicit wait at 0 (see the *Explicit and fluent waits* lesson and sel-036).
- **Debugging against Grid with a breakpoint.** The session sits idle, Grid reaps it, and the next step throws \`NoSuchSessionException\`. Debug locally or raise the session timeout on a dev Grid.
- **Logging nothing about the environment.** Log the matched capabilities (\`browserName\`, \`browserVersion\`, \`platformName\`), Selenium version and Grid node at session start; half of "works on my machine" tickets close with that line.

## Best practices for experienced engineers

- Code against \`WebDriver\` and small role interfaces; create drivers in one factory that takes \`MutableCapabilities\`; local vs remote is configuration.
- Treat capabilities as data: build them in one place, log \`options.asMap()\` at debug level, and fail fast on unknown values.
- Let Selenium Manager resolve drivers; warm its cache in CI images; use vendor Docker images for Grid nodes.
- Guarantee cleanup at three levels: \`quit()\` in \`alwaysRun\` teardown, session timeouts on Grid, disposable containers/agents.
- Minimise round trips in hot paths, especially remote: scoped \`findElements\`, batch reads, API setup instead of UI setup.
- Prefer BiDi APIs for new listening/intercepting needs; isolate CDP behind an adapter so a Chrome upgrade touches one class.
- Keep per-test driver logs available on failure; read the driver log before changing test code.

## Interview questions

### Q: Explain what happens when you call driver.findElement(By.id("x")).click().

**Short answer (30–60 s):** The Java bindings convert \`By.id\` into a W3C \`css selector\` locator and send \`POST /session/{id}/element\` over HTTP to the driver. The driver evaluates the selector in the current browsing context through the browser's internal protocol (CDP for Chrome), stores the node and returns a web element reference. \`click()\` is a second request to \`/element/{eid}/click\`; the driver scrolls the element into view, checks the centre point is not covered, dispatches trusted mouse events and waits for any navigation per the page load strategy.

**Detailed answer:** Mention the layers (bindings → HTTP + JSON → vendor driver → browser automation interface), that the implicit wait is applied inside the driver, that the reference is opaque and can go stale, that errors come back as string codes mapped to exceptions (\`no such element\` → \`NoSuchElementException\`, \`element click intercepted\` → \`ElementClickInterceptedException\`), and that this is two round trips — which is why element loops are expensive on remote Grids.

### Q: What is the W3C WebDriver protocol and how is it different from the JSON Wire Protocol?

**Short answer (30–60 s):** It is the W3C standard that browser vendors implement in their drivers: REST-like endpoints, JSON bodies, HTTP status plus string error codes, \`alwaysMatch\`/\`firstMatch\` capabilities, vendor-prefixed extensions and a single actions endpoint. JWP was Selenium's pre-standard protocol with numeric status codes, \`desiredCapabilities\` and \`ELEMENT\` keys. Selenium 4 speaks only W3C.

**Detailed answer:** For users the visible changes were Options classes instead of \`DesiredCapabilities\`, removal of \`findElementBy*\`, \`Duration\`-based timeouts, W3C actions, \`getDomAttribute\`/\`getDomProperty\`, and that unprefixed custom capabilities now fail session creation. The benefit is consistency: vendors own conformance, and behaviour is defined by a spec instead of by Selenium's reverse-engineering.

### Q: How does capability negotiation work, and why does firstMatch exist?

**Short answer (30–60 s):** The endpoint merges \`alwaysMatch\` with each \`firstMatch\` entry, tries the candidates in order, and creates the session from the first one it can satisfy, returning the matched capabilities. \`firstMatch\` lets one request express alternatives — mostly useful for intermediaries like Grid.

**Detailed answer:** Explain validation (prefixes), merge conflicts, the \`session not created\` failure, and that the response is the truth about the environment (exact browser version) to log. Selenium Java Options fill only \`alwaysMatch\`; Grid matches stereotypes of its slots against the request.

### Q: How does Selenium Manager work, and when does it not run?

**Short answer (30–60 s):** It is a Rust binary bundled with Selenium since 4.6. When the bindings cannot find a driver (system property, env var, PATH), they invoke it; it detects the browser version, resolves the matching driver from vendor metadata, downloads it into \`~/.cache/selenium\` and returns the path. Since 4.11–4.14 it can also download browsers. It does not run if a driver was supplied — which is why a stale \`chromedriver\` on the PATH still causes version mismatches.

**Detailed answer:** Cover configuration (\`SE_OFFLINE\`, \`SE_PROXY\`, \`SE_CACHE_PATH\`, \`se-config.toml\`), the TTL on metadata, warming the cache in CI images, comparison with WebDriverManager and image-baked drivers, and that Grid nodes make the question moot for remote runs.

### Q: Why do CI agents accumulate Chrome processes, and how do you prevent it?

**Short answer (30–60 s):** Because \`quit()\` is not reached (setup exception, missing \`alwaysRun\`, \`close()\` instead of \`quit()\`) or the JVM is killed before it can send \`DELETE /session\`; the browser is a separate process tree that can outlive the driver.

**Detailed answer:** Fix at three levels: guarded teardown with \`alwaysRun = true\` and null checks, ThreadLocal \`remove()\`; infrastructure — disposable containers, Grid session timeouts, a post-build cleanup step on static agents; and observability — count driver/browser processes per build to catch regressions early. Shutdown hooks help only for orderly JVM exits.

### Q: CDP vs WebDriver BiDi — which would you use for capturing console errors and network calls?

**Short answer (30–60 s):** BiDi where it covers the need, because it is a W3C standard, cross-browser and version-independent. CDP only for Chromium-specific gaps, behind an adapter, because its typed API is tied to Chrome versions (Selenium supports the last three) and churns.

**Detailed answer:** Discuss that console/JS errors and network events are available through BiDi (\`LogInspector\`, \`Network\` module) with the \`webSocketUrl\` capability; that browser coverage per module still differs and Java APIs are still evolving; and that \`executeCdpCommand\` is version-independent but request/response only. A senior answer includes the migration plan: hide both behind a \`BrowserEvents\` interface.

### Q: What is the practical difference between ChromeDriver and RemoteWebDriver?

**Short answer (30–60 s):** \`ChromeDriver\` is a \`RemoteWebDriver\` that starts a local chromedriver and talks HTTP to localhost. \`RemoteWebDriver\` talks to any W3C endpoint (Grid, cloud). Same protocol, different location.

**Detailed answer:** Remote needs \`Augmenter\` for DevTools interfaces, \`LocalFileDetector\` for uploads, managed downloads, a client read timeout above the longest command, and round-trip awareness. Writing against \`WebDriver\` keeps tests location-independent.

### Q: How would you diagnose SessionNotCreatedException on CI only?

**Short answer (30–60 s):** Read the message: version mismatch, browser failed to start, or invalid capability. Then check which driver binary was actually used and whether Selenium Manager could reach the network.

**Detailed answer:** \`which chromedriver\` on the agent, stale system properties, WebDriverManager pins, Selenium \`FINE\` logs for Selenium Manager, chromedriver verbose log for start-up failures (\`DevToolsActivePort\`, sandbox, \`/dev/shm\`), and the agent image's browser auto-update policy. Fix the root cause in the image, not with retries.

## Scenario-based questions

**1. The nightly suite on a remote cloud Grid takes 3× longer than locally.** I would first measure commands per test (driver logs or a \`WebDriverListener\` counting calls). Typical culprits: element loops with per-element \`getText\`/\`isDisplayed\`, polling waits with short intervals, UI setup steps. I would batch reads, replace UI setup with API/cookie seeding, raise the poll interval where safe, and pick a Grid region close to the CI runner. I would report the before/after command count, not just duration.

**2. Chrome auto-updated and half the suite failed with "only supports Chrome version N".** Selenium 4.6+ should have handled this, so something bypassed Selenium Manager. I would search the code and agent for \`webdriver.chrome.driver\`, WebDriverManager pins and \`chromedriver\` on the PATH, remove them, and pin the browser in the CI image (or use \`browserVersion\` with Chrome for Testing) so browser upgrades become a deliberate change with its own pipeline run.

**3. The team wants network mocking for checkout error tests across Chrome and Firefox.** I would check which interception features the current Selenium + browser versions support via BiDi, prototype on both browsers, and if Firefox coverage is insufficient, mock at the API layer (the ShopEasy API server on port 5181 or a stub server) instead of in the browser. CDP-based \`NetworkInterceptor\` would be Chromium-only, so I would not build a cross-browser strategy on it.

## Tricky follow-ups

- **Q: Is the implicit wait implemented in Java?** No. It is a session timeout sent to the driver; the driver re-polls the locator. \`WebDriverWait\` is the client-side loop.
- **Q: Does \`driver.close()\` on the last window end the session?** The window closes and, with W3C drivers, closing the last window typically ends the browser — but the driver process is not stopped by Selenium. Always use \`quit()\` in teardown.
- **Q: Why can \`isDisplayed()\` be slower than \`getDomProperty()\`?** \`isDisplayed\` is not a W3C command; Selenium sends a JavaScript atom through \`execute/sync\` that computes visibility, while \`getDomProperty\` is a direct endpoint.
- **Q: Can two threads share one WebDriver?** The protocol processes commands for a session sequentially and the driver keeps one current window/frame per session — sharing interleaves state. One driver per thread.
- **Q: What does the response to New Session contain that you should log?** The matched capabilities: exact \`browserVersion\`, \`platformName\`, and vendor data such as \`debuggerAddress\` or \`webSocketUrl\`.`,
  keyPoints: [
    'Selenium is three processes: Java bindings send HTTP + JSON (W3C WebDriver) to a vendor driver, which drives the browser through CDP, Marionette or Apple\'s interface.',
    'New Session merges alwaysMatch with each firstMatch entry and returns matched capabilities — log browserVersion from the response.',
    'Elements are opaque references (element-6066-11e4-a52e-4f735466cecf) held by the driver; staleness is detected only when the reference is used.',
    'Errors are HTTP status + string codes mapped to WebDriverException subclasses; every command is a round trip, so element loops are expensive on remote Grids.',
    'Options classes are typed builders for one capabilities map: W3C keys at the top, browser switches under goog:/moz:/ms: vendor keys.',
    'Selenium Manager (4.6+) is a fallback that resolves and caches drivers (and since 4.11–4.14 browsers) in ~/.cache/selenium; a stale driver on PATH or a system property bypasses it.',
    'Cleanup needs quit() in alwaysRun teardown plus Grid session timeouts and disposable agents, because a killed JVM orphans browsers.',
    'CDP is Chromium-only and version-coupled (last 3 Chrome versions); WebDriver BiDi is the cross-browser standard Selenium is moving to, with coverage still growing.',
  ],
  mistakes: [
    'Keeping System.setProperty("webdriver.chrome.driver", ...) or a chromedriver on PATH, then blaming Selenium Manager for a version mismatch. Fix: remove them, check `which chromedriver`, and confirm with Selenium FINE logs that Selenium Manager resolved the driver.',
    'Putting Chrome switches into FirefoxOptions (or unprefixed custom keys into capabilities). Fix: build options per browser in one factory and print options.asMap() to see the exact payload; SessionNotCreatedException/InvalidArgumentException point at the bad key.',
    'Debugging with a breakpoint against Grid and getting NoSuchSessionException. Fix: Grid reaped the idle session (session timeout); debug locally or raise the timeout on a dev Grid.',
    'Hard-coding org.openqa.selenium.devtools.vNNN imports across the framework. Fix: prefer BiDi or Selenium\'s version-independent helpers, and isolate any CDP use behind one adapter class.',
    'Investigating a driver-side failure only from the Java stack trace. Fix: enable a per-test ChromeDriverService/GeckoDriverService log file and read what the driver received and answered.',
    'Teardown that calls quit() unguarded, so a dead session throws over the real failure. Fix: null-check, catch WebDriverException in teardown, always remove the ThreadLocal.',
  ],
  tryIt: `(1) Start \`chromedriver --port=9515\` and use the \`RawWebDriverClient\` pattern from this lesson against \`http://localhost:5180/practice-site/login.html\`: create a session, type into \`#user-name\`, click \`#login-button\`, read \`GET /session/{id}/url\`, and trigger a \`no such element\` error to see its JSON body. (2) In your Selenium framework, log \`((HasCapabilities) driver).getCapabilities()\` at session start and confirm the browser version. (3) Run once with a \`ChromeDriverService\` debug log file and find your \`findElement\` and \`click\` commands in it. (4) Set \`java.util.logging\` for \`org.openqa.selenium\` to FINE, delete \`~/.cache/selenium\`, and watch Selenium Manager download the driver; run again with \`SE_OFFLINE=true\`. (5) Count HTTP commands for reading all six product names and prices on \`inventory.html\` per-card vs with one \`findElements\` per field.`,
  problems: ['sel-034', 'sel-019', 'sel-014', 'sel-018'],
}
