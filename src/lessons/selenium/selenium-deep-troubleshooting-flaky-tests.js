export default {
  slug: 'selenium-deep-troubleshooting-flaky-tests',
  category: 'selenium',
  order: 15,
  title: 'Deep dive: troubleshooting failing and flaky Selenium tests — a systematic workflow',
  minutes: 30,
  summary: 'Run a repeatable investigation for any failing or flaky Selenium test — reproduce, classify (product, test, environment, data), gather evidence automatically, isolate, fix the root cause and prevent recurrence — across timing, state leakage, parallel data collisions, environment and version drift, overlays, stale elements and context bugs, with an evidence-capturing TestNG listener, CI-only reproduction techniques, flakiness metrics and a retry policy you can defend.',
  manualAnalogy: `When a manual tester sees "sometimes the order total is wrong", nobody accepts "it works on my machine". You reproduce it, note the browser, the data and the steps, decide whether it is a product defect or a mistake in the test case, and attach evidence to the ticket. A flaky automated test deserves the same discipline — the only differences are that the "tester" is a thread on a CI agent, and the evidence has to be captured automatically because nobody was watching when it failed.`,
  body: `## Where the earlier lessons stop

The *Selenium exceptions* lesson gives the three questions (never found / found but unusable / found then lost) and a cheat sheet. *java-deep-exception-design* covers the exception taxonomy, a \`RetryPolicy\` with backoff, \`IRetryAnalyzer\` mechanics and a failure listener that walks the cause chain. *selenium-deep-synchronization* covers wait internals and the spinner race; *selenium-deep-architecture* covers driver logs, Selenium Manager, the W3C error codes and CDP versus BiDi; *selenium-deep-locators-xpath-dynamic* covers stale elements after re-render and dynamic DOMs. This lesson does not repeat them. It is about **process**: how a senior engineer turns "test X is flaky" into a root cause, a fix, and a guard that stops the same class of problem coming back — and how to talk about it with the team.

Two definitions keep the conversation precise:

- **Failing test** — fails deterministically on the same code, data and environment. Usually easy: reproduce, read, fix.
- **Flaky test** — passes and fails on the **same** commit without code changes. Something non-deterministic is an input to the test: time, order, shared state, data, environment, network. The job is to find that hidden input and either control it or remove the dependency on it.

## The workflow

\`\`\`
1. REPRODUCE   → same commit, same browser version, same window size, same data, N runs
2. CLASSIFY    → product bug | test bug | environment | test data
3. EVIDENCE    → screenshot, DOM, URL, console, driver log, network, video, timing, thread
4. ISOLATE     → smallest failing unit: one test, one step, one condition; serial vs parallel
5. FIX         → the root cause, at the layer where it lives (app, test, infra, data)
6. PREVENT     → a guard: lint rule, framework helper, data isolation, metric, quarantine policy
\`\`\`

### Step 1 — Reproduce (or prove you cannot)

Before reading code, establish the **failure rate** and the **conditions**:

| Question | How to answer it |
|---|---|
| How often? | CI history for the test (last 50 runs), or run it 50× locally with \`invocationCount\` |
| Only on CI? | compare browser version, headless flag, window size, CPU count, locale, timezone between CI and local (log them on every run — see the listener below) |
| Only in parallel? | run the same suite with \`thread-count="1"\` and with the CI thread count |
| Only after another test? | run the test alone; then run its class; then run with \`preserve-order\` and a fixed seed; bisect the preceding tests |
| Since when? | first failing build in the history → diff of app commit, test commit, image/browser version |

"Cannot reproduce" is a result, not a dead end: it tells you the hidden input is something your local run does not have (load, parallelism, a different browser build, a slower machine).

### Step 2 — Classify

\`\`\`
                       failure
                          │
          ┌───────────────┴────────────────┐
   assertion failed                 exception before the check
   (AssertionError)                 (WebDriverException family)
          │                                │
 does the screenshot/DOM           which kind? (exceptions lesson)
 show a WRONG value?               ├─ SessionNotCreated / connection refused /
   ├─ yes, and it's what a           │   "tab crashed" / page-load timeout   → ENVIRONMENT
   │   user would see  → PRODUCT     ├─ InvalidSelector / NoSuchElement with
   │   BUG candidate                 │   locator not in DOM at all           → TEST BUG (locator)
   └─ no, value right but            ├─ NoSuchElement/Timeout, element appears
      expected value wrong            │   later in the video/screenshot      → TEST BUG (sync)
      (stale fixture, other           ├─ ClickIntercepted (overlay named)    → TEST BUG or UX bug
      thread's data)  → TEST DATA     └─ 401/409/404 from API setup          → TEST DATA / state leak
\`\`\`

| Class | Typical evidence | Owner | Fix lives in |
|---|---|---|---|
| Product bug | screenshot shows wrong total; API returns wrong value; console error from app code | dev team (raise a bug with evidence) | application |
| Test bug | missing/incorrect wait, brittle locator, wrong context, test-order dependence | automation team | test / framework |
| Environment | SessionNotCreated, page crash, DNS/timeouts, Grid queue timeouts, version drift | platform / DevOps + automation | CI image, Grid, network |
| Test data | 409 already exists, user locked, data deleted by another test, locale-dependent expectation | automation team (+ env owners) | data strategy |

A **race in the product** is a product bug even if only automation finds it: if clicking "Add to cart" twice quickly creates two lines, a fast test exposes what a fast user would hit. Do not "fix" it with a sleep in the test.

### Step 3 — Gather evidence (automatically)

You will rarely be watching when a flaky test fails. The framework must capture, on every failure:

| Evidence | Why | How (Selenium 4) |
|---|---|---|
| Screenshot | what the user would have seen | \`TakesScreenshot\` (viewport); element screenshots for banners |
| Page source | what was in the DOM — hidden elements, wrong ids, an error banner off-screen | \`driver.getPageSource()\` (serialised current DOM) |
| Current URL and title | did a redirect happen, did we land on an error page | \`getCurrentUrl()\`, \`getTitle()\` |
| Browser console + JS exceptions | app errors, failed fetches logged by the app, CSP errors | **WebDriver BiDi** log handlers (current direction); legacy Chromium-only \`goog:loggingPrefs\` + \`manage().logs()\` |
| Driver log | what the driver received and answered; browser stderr; crashes | \`ChromeDriverService\` / \`GeckoDriverService\` log file (see *selenium-deep-architecture*) |
| Network | failed or slow API calls behind the UI | BiDi network events, CDP \`Network\` domain (Chromium), or a recording proxy; HAR export is not built into Selenium |
| Video | the sequence of events — overlay appearing, element moving | docker-selenium video container or \`se:recordVideo\` in Dynamic Grid; cloud grids record by default |
| Context | browser + version, headless, window size, thread, session id, invocation number, test data ids | capabilities + \`ITestResult\` + your own MDC |

On console logs specifically: the old way is the Chromium **non-W3C** logging extension — set the capability \`goog:loggingPrefs\` to \`{"browser": "ALL"}\` and read \`driver.manage().logs().get(LogType.BROWSER)\`. It does not work in Firefox (geckodriver does not implement the log endpoint) and is outside the standard. The **current** approach, shown on selenium.dev, is BiDi: enable \`webSocketUrl\` and register \`addConsoleMessageHandler\` / \`addJavaScriptErrorHandler\` on \`((RemoteWebDriver) driver).script()\`. It works in Chrome and Firefox; coverage per browser and the Java API are still evolving, so keep it behind one small class.

### Step 4 — Isolate

Shrink until the cause is obvious: one test → one step → one condition. Useful switches:

- **Serial vs parallel**: if it fails only in parallel → shared state, data collision, resource starvation.
- **Alone vs in its class**: if it fails only after another test → state leakage (cookies, server-side cart, a static field, a DB row).
- **Headed vs headless, window size**: layout-dependent locator or overlay.
- **Local driver vs Grid**: latency, file upload (\`LocalFileDetector\`), different browser build, \`/dev/shm\`.
- **Throttled machine**: run Chrome on a CPU-limited container (\`docker run --cpus=1\`) to make timing bugs reproducible locally.

### Step 5 — Fix the root cause, at the right layer

The fix must make the hidden input irrelevant: wait for the state the user waits for, give each test its own data, pin the browser version, remove the order dependence. A fix that only lowers the failure rate (longer timeout, sleep, retry) is a **mitigation**; label it as such in the PR.

### Step 6 — Prevent

Every investigated flake should leave a guard behind: a framework helper (\`clickWhenNotCovered\`), a lint/review rule (no \`Thread.sleep\`, no shared static accounts), a data factory, a pinned image, a dashboard metric, or a test added to the quarantine with an owner and a date.

## Root-cause categories: symptoms and fixes

| Category | Real symptoms | Root-cause fix |
|---|---|---|
| **Timing** — missing/incorrect waits, animations, debounce | \`NoSuchElement\`/\`Timeout\` on CI only; assertion reads old value ("Showing 1–5 of 15" instead of 3 results); passes with a breakpoint | wait for the **end state** the user sees (text, count, attribute), not for "something visible"; see *selenium-deep-synchronization* |
| **State leakage** — shared accounts, carts, test order | fails only after test Y; first run of the day passes; \`@BeforeClass\` data mutated by an earlier method | per-test data, per-test browser session, cleanup of own data only, no static mutable fields |
| **Parallel data collisions** | 409 "already exists", counts off by one, "order not found", 401 after another thread's reset | unique data per thread/test (generated users, unique names), no global resets during a parallel run |
| **Environment** — screen size, headless, fonts, locale/timezone, slow agents, resource limits | layout differs, text wraps and elements overlap, date/price format mismatch, "session deleted because of page crash" | fixed window size, explicit locale/timezone, containerised browsers with enough \`/dev/shm\`, CPU/RAM per session |
| **Browser/driver drift** | sudden failures across many tests on one agent; \`SessionNotCreatedException\` version mismatch; behaviour change after auto-update | pin browser via image tag or \`browserVersion\` + Selenium Manager; upgrade deliberately |
| **Network / third-party scripts** | page-load timeout; analytics/chat widget covering buttons; slow fonts delay layout | block third-party hosts in test environments (BiDi/CDP, see sel-032), \`EAGER\` page-load strategy where appropriate |
| **Stale elements after re-render** | \`StaleElementReferenceException\` intermittently in loops over rows | keep \`By\`, re-locate after the update, wait for proof of update (*selenium-deep-locators-xpath-dynamic*) |
| **Overlays** — cookie banners, toasts, modals | \`ElementClickInterceptedException: Other element would receive the click: <div ...>\` | dismiss deterministically (set the consent cookie before navigation), wait for the overlay to be gone, close toasts |
| **Context** — iframes, windows | \`NoSuchElement\` for an element that is clearly on the screenshot; actions on the wrong tab | always restore context in \`finally\`; helpers that scope a block to a frame or window |

## The evidence listener

The *java-deep-exception-design* lesson shows a \`FailureListener\` that computes the root cause from the cause chain and attaches a screenshot. Here is the **evidence** side: one folder per failure with everything an investigator needs, plus the run context that makes CI-only failures diagnosable.

First, a tiny BiDi console collector that the driver factory attaches when it creates a session:

\`\`\`java
package com.shopeasy.framework.evidence;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Collects console messages and JS errors pushed by the browser over WebDriver BiDi. */
public final class BrowserConsole {

    private static final ThreadLocal<BrowserConsole> CURRENT = new ThreadLocal<>();
    private final List<String> entries = new CopyOnWriteArrayList<>();   // written by the BiDi thread

    private BrowserConsole() { }

    /** Call right after creating the driver; requires options.setCapability("webSocketUrl", true). */
    public static void attach(WebDriver driver) {
        BrowserConsole console = new BrowserConsole();
        if (driver instanceof RemoteWebDriver rwd
                && rwd.getCapabilities().getCapability("webSocketUrl") != null) {   // BiDi negotiated
            rwd.script().addConsoleMessageHandler(
                    e -> console.entries.add("[console." + e.getLevel() + "] " + e.getText()));
            rwd.script().addJavaScriptErrorHandler(
                    e -> console.entries.add("[js-error] " + e.getText()));
        } else {
            console.entries.add("[info] BiDi not available for this session; console not captured");
        }
        CURRENT.set(console);
    }

    public static List<String> current() {
        BrowserConsole c = CURRENT.get();
        return c == null ? List.of() : List.copyOf(c.entries);
    }

    public static void clear() {
        CURRENT.remove();
    }
}
\`\`\`

Then the listener:

\`\`\`java
package com.shopeasy.framework.evidence;

import com.shopeasy.framework.DriverManager;          // ThreadLocal<WebDriver> holder
import org.openqa.selenium.Capabilities;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.HasCapabilities;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testng.ITestListener;
import org.testng.ITestResult;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

public class EvidenceListener implements ITestListener {

    private static final Logger log = LoggerFactory.getLogger(EvidenceListener.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    @Override
    public void onTestFailure(ITestResult result) {
        Path dir = evidenceDir(result);
        WebDriver driver = DriverManager.current();
        List<String> problems = new ArrayList<>();        // evidence that could not be captured

        writeText(dir.resolve("context.txt"), runContext(result, driver), problems);
        if (driver != null) {
            capture("screenshot", problems, () ->
                    Files.write(dir.resolve("screenshot.png"),
                            ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES)));
            capture("page source", problems, () ->
                    Files.writeString(dir.resolve("page.html"), driver.getPageSource(), StandardCharsets.UTF_8));
            capture("url", problems, () ->
                    Files.writeString(dir.resolve("url.txt"), driver.getCurrentUrl() + System.lineSeparator()
                            + driver.getTitle(), StandardCharsets.UTF_8));
        }
        writeText(dir.resolve("console.log"), String.join(System.lineSeparator(), BrowserConsole.current()), problems);
        copyIfExists(Path.of("target", "driver-logs", testId(result) + "-chromedriver.log"),
                dir.resolve("chromedriver.log"), problems);

        result.setAttribute("evidenceDir", dir.toString());   // reporters (Allure/Extent) attach from here
        log.error("FAILED {} (invocation {}) | evidence: {} | not captured: {}",
                testId(result), result.getMethod().getCurrentInvocationCount(), dir, problems,
                result.getThrowable());
    }

    // ---------- helpers: none of them may throw ----------

    private static String runContext(ITestResult result, WebDriver driver) {
        StringBuilder sb = new StringBuilder();
        sb.append("test: ").append(testId(result)).append('\\n')
          .append("invocation: ").append(result.getMethod().getCurrentInvocationCount()).append('\\n')
          .append("thread: ").append(Thread.currentThread().getName()).append('\\n')
          .append("durationMs: ").append(result.getEndMillis() - result.getStartMillis()).append('\\n')
          .append("jvm locale/timezone: ").append(Locale.getDefault()).append(" / ")
          .append(TimeZone.getDefault().getID()).append('\\n')
          .append("cpus: ").append(Runtime.getRuntime().availableProcessors()).append('\\n');
        if (driver instanceof HasCapabilities hc) {
            try {
                Capabilities caps = hc.getCapabilities();
                sb.append("browser: ").append(caps.getBrowserName()).append(' ')
                  .append(caps.getBrowserVersion()).append('\\n')
                  .append("platform: ").append(caps.getPlatformName()).append('\\n');
                Dimension size = driver.manage().window().getSize();
                sb.append("window: ").append(size.getWidth()).append('x').append(size.getHeight()).append('\\n');
            } catch (RuntimeException e) {
                sb.append("capabilities unavailable: ").append(e).append('\\n');
            }
        }
        if (driver instanceof RemoteWebDriver rwd && rwd.getSessionId() != null) {
            sb.append("sessionId: ").append(rwd.getSessionId()).append('\\n');   // find the Grid video/log by this
        }
        return sb.toString();
    }

    private static Path evidenceDir(ITestResult result) {
        Path dir = Path.of("target", "evidence", testId(result) + "-" + LocalDateTime.now().format(TS));
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            log.warn("Cannot create evidence dir {}", dir, e);
        }
        return dir;
    }

    private static String testId(ITestResult result) {
        return result.getTestClass().getRealClass().getSimpleName() + "." + result.getMethod().getMethodName();
    }

    private interface IoAction { void run() throws IOException; }

    private static void capture(String what, List<String> problems, IoAction action) {
        try {
            action.run();
        } catch (IOException | RuntimeException e) {      // WebDriverException if the session is dead
            problems.add(what + ": " + e.getClass().getSimpleName());
        }
    }

    private static void writeText(Path file, String text, List<String> problems) {
        capture(file.getFileName().toString(), problems,
                () -> Files.writeString(file, text, StandardCharsets.UTF_8));
    }

    private static void copyIfExists(Path source, Path target, List<String> problems) {
        if (Files.exists(source)) {
            capture("driver log", problems, () -> Files.copy(source, target));
        }
    }
}
\`\`\`

**Step by step**

- \`BrowserConsole.attach\` only registers handlers if the session actually returned a \`webSocketUrl\` — on a driver or Grid node without BiDi it records why the console is empty instead of failing. The list is a \`CopyOnWriteArrayList\` because BiDi events arrive on Selenium's WebSocket thread, not the test thread.
- \`context.txt\` is the most underrated artefact: browser version, window size, JVM locale/timezone, CPU count and thread name answer most "only on CI" questions without rerunning anything.
- \`getCurrentInvocationCount()\` matters when you run a test 50 times: you can correlate failure #17 with its evidence folder.
- The **session id** links the failure to the Grid's video and node logs (docker-selenium names videos per session when configured to; cloud vendors index by session id).
- Every capture is isolated by \`capture(...)\`: if the session already crashed, the screenshot fails, the page source fails, but the context file and the driver log still get written — and the listener never replaces the real test failure (the rule from the exception deep dive).
- \`getPageSource()\` returns the **current serialised DOM**, not the original HTML — exactly what you want to see hidden duplicates or an error banner.
- \`onTestFailure\` runs before \`@AfterMethod\` tears the driver down in TestNG's usual ordering; if your setup differs, capture in \`@AfterMethod(alwaysRun = true)\` before \`quit()\`.
- Register via \`<listeners>\` in \`testng.xml\` or the \`ServiceLoader\` file so no test class can forget it. The root-cause line (walking \`getCause()\`) belongs in the same log statement — reuse the *java-deep-exception-design* listener for it rather than duplicating.

Network evidence is deliberately not in this listener: Selenium has no built-in HAR export. Options, best first: (1) the app's own request id in the UI/console + server logs; (2) BiDi network events, recording method, URL, status and timing for failed or slow requests into the same evidence folder; (3) CDP's \`Network\` domain on Chromium (version-coupled, see *selenium-deep-architecture*); (4) a recording proxy in front of the browser (more moving parts, but true HAR files, and it works for any browser).

## Headless versus headed

Chrome has had two headless implementations. **New headless** (\`--headless=new\`, available since Chrome 112) is the real Chrome browser running without a window; the **old headless** was a separate, lighter implementation with behavioural differences. Since **Chrome 132** the old mode is removed from the Chrome binary (\`--headless=old\` prints an error); \`--headless\` and \`--headless=new\` both run the new mode, and the old implementation lives on only as the separate \`chrome-headless-shell\` binary (published since Chrome 120). Practical consequences:

- Old advice that "headless behaves differently, so test headed" is mostly obsolete for new headless Chrome — but **window size** still differs: a headless browser has no screen to maximise to and typically starts at 800×600, which switches responsive sites to tablet/mobile layouts. Always pass \`--window-size=1920,1080\` (or call \`setSize\`) and log the actual size.
- \`maximize()\` in headless does not give you a desktop-sized window; do not rely on it.
- Fonts differ between a Windows laptop and a slim Linux container: text width changes, labels wrap, a button moves below the fold or under a sticky footer → \`ElementClickInterceptedException\` only on CI. Install the same font packages in the image, or make the test independent of layout (scroll into view, wait for the overlay to go).
- Firefox headless (\`-headless\`) has always been the real browser; the same window-size rule applies.
- GPU/WebGL, media codecs and clipboard behave differently in containers regardless of headless; tests touching them belong in a separate, headed job.

## Reproducing CI-only failures locally

\`\`\`java
package com.shopeasy.tests.flaky;

import com.shopeasy.framework.DriverManager;
import com.shopeasy.framework.evidence.BrowserConsole;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.Locale;
import java.util.TimeZone;

import static org.testng.Assert.assertEquals;

/** Reproduction harness: CI-like browser, 50 invocations, 5 concurrent threads. */
public class EmployeeSearchFlakeRepro {

    @BeforeMethod
    public void ciLikeBrowser() {
        Locale.setDefault(Locale.GERMANY);                       // mimic the CI agent's JVM locale
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        ChromeOptions options = new ChromeOptions();
        options.setBrowserVersion(System.getProperty("ci.chrome.version", "stable")); // Selenium Manager fetches it
        options.addArguments("--headless=new", "--window-size=1366,768");
        options.setCapability("webSocketUrl", true);
        WebDriver driver = new ChromeDriver(options);
        driver.manage().window().setSize(new Dimension(1366, 768));
        DriverManager.set(driver);
        BrowserConsole.attach(driver);
    }

    @Test(invocationCount = 50, threadPoolSize = 5)
    public void searchFiltersToQaDepartment() {
        WebDriver driver = DriverManager.current();
        driver.get("http://localhost:5180/practice-site/table.html");
        driver.findElement(By.id("table-search")).sendKeys("qa");
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.textToBe(By.id("row-count"), "Showing 1–3 of 3 employees"));
        assertEquals(driver.findElements(By.cssSelector("#employee-table tbody tr")).size(), 3);
    }

    @AfterMethod(alwaysRun = true)
    public void quit() {
        try {
            WebDriver driver = DriverManager.current();
            if (driver != null) driver.quit();
        } finally {
            DriverManager.remove();
            BrowserConsole.clear();
        }
    }
}
\`\`\`

**Step by step**

- \`setBrowserVersion\` with an exact major (pass \`-Dci.chrome.version=<the CI major>\` taken from \`context.txt\`) makes Selenium Manager download that Chrome for Testing build into its cache, so your laptop runs what CI ran. The alternative is to run against the **same Docker image tag** the CI Grid uses (\`docker run ... selenium/standalone-chrome:<tag>\`), which also gives you the same fonts and \`/dev/shm\`.
- Same **window size** and headless flag as CI; same **JVM locale/timezone** (or start the JVM with \`-Duser.language=de -Duser.country=DE -Duser.timezone=UTC\` instead of setting defaults in code — setting defaults in a parallel run is itself global state, acceptable only in a throwaway repro class).
- \`invocationCount = 50, threadPoolSize = 5\` runs the method 50 times on 5 threads: it turns a 2% flake into roughly one failure per run and exposes races between concurrent sessions. Note that \`@BeforeMethod\`/\`@AfterMethod\` run around **each** invocation, so each gets its own browser.
- The wait uses the **end state** (\`#row-count\` text, which \`render()\` updates in the same call as the rows), and then counts rows — a correct pattern for filters.
- To mimic a slow agent, run the same class inside a CPU-limited container or against a Grid node started with \`--cpus=1\`; timing bugs that need a slow machine show up within the 50 runs.

| Repro technique | What it exposes | Cost |
|---|---|---|
| \`invocationCount\` N× serial | low-rate timing flakes | minutes |
| \`invocationCount\` + \`threadPoolSize\` | races, shared state between sessions, resource contention | minutes; needs N browsers |
| Same browser version (Selenium Manager \`browserVersion\` or same image tag) | version-specific behaviour | low |
| Same window size, headless, fonts (same image) | layout and overlay issues | low with Docker |
| CPU/RAM-limited container | timing bugs that need a slow machine | low |
| Run the CI suite order (\`testng-failed.xml\`, same seed) | order dependence | medium |

## Investigations on ShopEasy, one per category

### Timing — a filter that "sometimes shows all rows"

**Symptom:** \`expected [3] but found [5]\` on the employee search, about 1 in 30 runs on CI.

**Analysis:** on \`table.html\` the \`#table-search\` listener filters on every \`input\` event and calls \`render()\` synchronously, so on this page the rows are updated by the time \`sendKeys\` returns. The flaky version of this test existed against a real app where the search was **debounced** (re-render 300 ms after the last keystroke, a very common pattern) — the test read the first page of the **unfiltered** table (5 rows) before the debounce fired. It passed locally because the developer laptop was slow enough at reading rows; it failed on fast CI agents. The fix is the same on both: never read results right after typing; wait for the state that proves the filter has applied — here the \`#row-count\` text, in other apps a result count, the "no results" row, or the old first row going stale. Do not add \`Thread.sleep(500)\` "to cover the debounce": it couples the test to an implementation detail and still fails when the back end is slow.

**Prevent:** a \`SearchComponent.searchFor(query, expectedCountText)\` helper in the page object, and a review rule that a list read follows a state wait.

### State leakage and parallel collisions — the cart count off by one

**Symptom:** the hybrid checkout tests seed the cart through the API (\`POST /api/cart/items\` as \`standard_user\`), then assert \`itemCount == 1\` from \`GET /api/cart\`. In parallel runs: sometimes 2, sometimes \`409 ITEM_ALREADY_IN_CART\`, sometimes 0 — and occasionally a \`401\` in the middle of a test.

**Analysis:** every thread logs in as the **same user**, and the API keeps **one server-side cart per user**. Thread A adds the backpack, thread B adds the bike light, A reads 2. A test that cleans up with \`DELETE /api/cart\` empties B's cart. Worse, a \`@BeforeMethod\` calling \`POST /api/reset\` restores the seed **and drops all tokens, carts and orders** — every other thread's token becomes invalid at that instant (the 401s). Note the UI side of ShopEasy is immune: the web shop keeps its cart in \`sessionStorage\` (key \`shopeasy.cart\`), and each WebDriver session has its own browser profile, so the \`.shopping-cart-badge\` counts only that session's items. In a typical e-commerce app where the badge reflects the **server** cart, this exact collision shows up as "badge shows 2, expected 1".

**Fix:**

\`\`\`java
// Each test gets its own customer: POST /api/users with a unique username, then log in as that user.
String username = "qa_" + UUID.randomUUID().toString().substring(0, 8);   // 3–40 chars of [a-z0-9_.-]
TestUser user = api.registerCustomer(username, "Str0ngPass!");             // 201 or fail fast
String token = api.login(username, "Str0ngPass!");
api.addToCart(token, 2 /* Pulse Bike Light */);
\`\`\`

…and **never** call a global reset while threads are running — reset once in \`@BeforeSuite\`, or not at all, and clean up only the data the test created. The general rule: shared mutable data must be either read-only for tests or partitioned per test (unique users, unique order references, per-thread data pools).

**Prevent:** a \`TestDataFactory\` that is the only way to obtain users; a static-analysis/grep check in CI that fails on \`"standard_user"\` inside parallel suites; a suite-level assertion that no test calls \`/api/reset\`.

### Overlay — \`ElementClickInterceptedException\` from \`#confirm-modal\`

**Symptom:**

\`\`\`
org.openqa.selenium.ElementClickInterceptedException: element click intercepted:
Element <button id="js-alert-btn" ...> is not clickable at point (412, 233).
Other element would receive the click: <div class="modal-overlay" id="confirm-modal">...</div>
\`\`\`

**Analysis:** on \`alerts.html\`, the "Delete saved address" flow opens an HTML modal (\`#confirm-modal\`, a full-page overlay) — not a JavaScript alert, so \`switchTo().alert()\` is irrelevant. The failing test clicked \`#modal-cancel\` and immediately clicked another button. On ShopEasy the modal hides synchronously, so the version that failed was the step that **never closed** the modal (an earlier assertion helper returned early) — the error message names the overlay, which makes this a 2-minute diagnosis if you read it. In real apps the more common cause is a **fade-out animation**: the overlay stays in the hit-test path for 200–300 ms after "Cancel". Fix: assert/await the overlay gone before the next click (\`invisibilityOfElementLocated(By.id("confirm-modal"))\` — for a \`hidden\` element, invisibility is true once the attribute is set), and make the modal's page component own both steps (\`AddressModal.cancel()\` clicks and waits). Do **not** switch to a JavaScript click: a real user would also be blocked, and you would hide a UX bug.

Cookie banners and toasts are the same class: set the consent cookie **before** the first navigation (\`addCookie\` on the domain, then \`get\`), and dismiss or wait out toasts in the component that triggers them.

### Environment — locale-dependent price formatting

**Symptom:** \`expected [$29,99] but found [$29.99]\` — only on the new CI agent pool.

**Analysis:** the UI is not the problem: ShopEasy formats prices with \`'$' + n.toFixed(2)\` in \`shop.js\` (locale-independent), and \`table.html\` pins salaries to \`toLocaleString('en-US')\`. The **test** built its expectation with \`String.format("$%.2f", 29.99)\`, which uses the JVM's default locale — \`de_DE\` on the new agents, producing a decimal comma. The same class of bug hits \`NumberFormat.getInstance()\` when parsing \`"$1,234.50"\` and \`LocalDate.now()\` around midnight with a different timezone than the server.

**Fix:** never rely on default locale/timezone in tests: \`String.format(Locale.ROOT, ...)\`, \`BigDecimal\` comparisons after parsing with an explicit \`Locale.US\` format, \`Clock\`/\`ZoneId\` passed explicitly. If the **app** formats by browser locale (\`navigator.language\`), set the browser language explicitly (Chrome: the \`--lang\` argument and the \`intl.accept_languages\` preference; Firefox: the \`intl.accept_languages\` preference) and test other locales deliberately, not by accident.

**Prevent:** log locale/timezone in \`context.txt\`; set \`-Duser.language\`/\`-Duser.country\`/\`-Duser.timezone\` in the Surefire \`argLine\` as a safety net; add one test per supported locale on purpose.

### Stale elements after re-render

\`table.html\` rebuilds \`tbody.innerHTML\` on every sort, filter and page change. A test that caches \`List<WebElement> rows\` then clicks a header and reads \`rows.get(0)\` fails with \`StaleElementReferenceException\` — always, not intermittently. It becomes **flaky** when the re-render is asynchronous (data fetched, then rendered): sometimes you read before the re-render (old data, test passes wrongly), sometimes during it (stale), sometimes after (correct). The fix and patterns are in *selenium-deep-locators-xpath-dynamic*; for triage, remember that stale exceptions that come and go mean "you are racing a re-render", which is a synchronisation problem first.

### Context — iframe and window leaks

A helper switches into an iframe, an assertion inside it throws, and \`switchTo().defaultContent()\` is never called. With a fresh driver per test the damage stays inside one test, but later steps fail with \`NoSuchElementException\` on elements clearly visible in the screenshot (screenshots show the whole page regardless of the current frame — a useful tell). Fix: scope helpers that always restore context:

\`\`\`java
public <T> T inFrame(By frame, Supplier<T> action) {
    wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(frame));
    try {
        return action.get();
    } finally {
        driver.switchTo().defaultContent();       // runs on success AND on failure
    }
}
\`\`\`

The same shape works for windows (remember the original handle, switch back in \`finally\`).

### Browser/driver drift and third-party scripts

- **Drift:** twelve unrelated tests start failing on Monday on one agent pool only. \`context.txt\` shows Chrome's major version changed overnight (auto-update on a long-lived VM). Pin: containerised browsers with an explicit image tag, or \`browserVersion\` + Selenium Manager on VMs; upgrade on a schedule in a dedicated PR that runs the full suite. Version-mismatch \`SessionNotCreatedException\` diagnosis is in *selenium-deep-architecture*.
- **Third-party:** a chat widget or analytics script loads late, delays the \`load\` event (page-load timeout) or floats over the checkout button. In test environments, block those hosts (BiDi/CDP request interception — problem sel-032 practises this) or disable them via a feature flag; consider the \`EAGER\` page-load strategy only if your waits already carry synchronisation.

## Measuring flakiness

You cannot manage what you do not count. Minimum data per test per run: status, retry count, duration, failure signature (exception type + first frame in your code + normalised message), browser/version, agent.

- **Flake rate** = runs where the test failed then passed on the same commit (or failed with no code change between neighbouring green runs) ÷ total runs, over a rolling window (e.g. last 100 runs).
- **Failure signature clustering**: group by signature; ten tests with "ElementClickIntercepted ... cookie-banner" is one root cause, not ten.
- **Dashboards**: Allure's history/retries views or ReportPortal give per-test history out of the box; many teams also push per-test results to a time-series store and plot the top-N flaky tests.
- **Quarantine**: a TestNG group (\`@Test(groups = "quarantine")\`) excluded from the blocking PR pipeline and run in a non-blocking job, **with an owner, a ticket and an expiry date**. A quarantine without expiry is a graveyard.

\`\`\`xml
<!-- blocking PR suite -->
<test name="regression">
  <groups><run><exclude name="quarantine"/></run></groups>
  <packages><package name="com.shopeasy.tests.*"/></packages>
</test>
\`\`\`

## Retry policy: safety net or bug-hider?

The mechanics (\`IRetryAnalyzer\`, action-level \`RetryPolicy\`) are in *java-deep-exception-design*. The **policy** question is what a senior is asked about:

| Policy | Advantages | Disadvantages | When |
|---|---|---|---|
| No retries | every flake visible; forces root-cause fixes | noisy pipeline, people learn to "just re-run the build" (a manual retry with no data) | small, stable suites |
| Blanket test retries (N=2–3 on everything) | green pipeline quickly | hides intermittent **product** bugs (a race that fails 1 in 3 now passes); doubles runtime of real failures; side effects repeated | never as a permanent state |
| Classified retry: one retry, only for environment-class failures (session creation, Grid timeouts, connection reset), every retry reported | protects the pipeline from infra noise; product failures still fail | needs classification and reporting | **recommended default** |
| Temporary retry on a named test, with a ticket and expiry | keeps the pipeline usable while the fix is in progress | requires discipline to remove | during an investigation |

Rules worth stating in an interview: a test that **passed on retry is reported as flaky, not as passed**; retries never apply to \`AssertionError\`; the flaky list is reviewed weekly; and a retry is a mitigation with a due date, never a fix. Surefire's \`rerunFailingTestsCount\` is aimed at the JUnit providers; with TestNG use a classified \`IRetryAnalyzer\` or a second pass over \`testng-failed.xml\` that is reported separately.

## Approaches to stabilising a flaky test, compared

| Approach | How it works | Advantages | Disadvantages | Performance | Maintainability | Scalability | When to use |
|---|---|---|---|---|---|---|---|
| Root-cause fix (correct wait, isolated data, pinned env) | removes the non-determinism | permanent; improves the framework for all tests | needs investigation time | best | best | best | always the goal |
| Longer timeout | more time for the same condition | trivial | only helps if the condition was right but slow; hides perf regressions | worse on failure | neutral | neutral | when evidence shows the app is legitimately slow |
| \`Thread.sleep\` | fixed pause | none worth having | slow and still flaky | worst | worst | worst | never in committed code |
| Retry (test level) | re-run on failure | quick pipeline relief | hides bugs; repeats side effects | expensive | poor | poor | classified environment failures only |
| Quarantine | exclude from blocking run | unblocks the team, keeps signal | coverage gap while quarantined | n/a | needs owner + expiry | good | while the fix is in progress |
| Delete the test | removes it | honest if the test has no value | coverage loss | n/a | n/a | n/a | duplicated or low-value tests |

**Recommended approach and why:** quarantine immediately (with an owner and expiry) if the flake blocks others, investigate with the six-step workflow and automatic evidence, fix the root cause at its layer, and leave a guard behind. Use classified retries only for environment failures so the pipeline signal stays trustworthy.

## Communicating a flaky-test analysis

Seniors are judged as much on how they communicate the finding as on the fix. A template that fits a ticket or a Slack thread:

\`\`\`text
Flaky test analysis — CheckoutApiSeedTest.cartHasOneItem

Impact      : failed 9 of the last 60 CI runs (15%), blocked 4 PR merges this week.
Class       : TEST DATA (parallel collision) — not a product bug.
Evidence    : evidence/CheckoutApiSeedTest.cartHasOneItem-*/context.txt shows 4 threads;
              API log shows POST /api/cart/items for user 1 from two sessions within 40 ms;
              3 failures show 401 right after another thread's POST /api/reset.
Root cause  : all parallel tests share standard_user and its single server-side cart;
              one test resets the whole API during the run.
Fix         : PR #___ — TestDataFactory registers a unique customer per test;
              /api/reset moved to @BeforeSuite.
Verification: 200 invocations, 8 threads, 0 failures (was 31/200).
Prevention  : CI check fails on hard-coded standard_user in parallel suites;
              flaky dashboard alert at > 2% over 50 runs.
Retry       : none added. Quarantine tag removed with this PR.
\`\`\`

The structure — impact in numbers, classification, evidence, root cause, fix, **verification with the same repro**, prevention — makes the conversation about facts, not about whose fault it is. When the root cause is a product race, the same template becomes the bug report, with the repro harness attached.

## Common mistakes and debugging

- **Re-running the build until it is green.** That is a manual retry with no data. Record the failure signature and evidence path before re-running.
- **Fixing the symptom in the wrong layer** — a sleep in the test for a product race, or a retry for a data collision. Classify first.
- **Looking only at the exception, not the evidence.** A \`TimeoutException\` on the total with a screenshot showing a validation error banner is not a timing problem.
- **Evidence capture that throws** and masks the failure ("Session ID is null"). Guard every capture (listener above).
- **Investigating one test at a time** when twenty share a signature. Cluster by signature first.
- **Global defaults changed in parallel code** (\`Locale.setDefault\`, static test data): fixes one test, breaks others at random.

## Best practices for experienced engineers

- Capture evidence and run context on **every** failure automatically; name folders by test, invocation and timestamp; link Grid session ids.
- Make every non-deterministic input explicit: browser version, window size, locale, timezone, data, time (\`Clock\`), network dependencies.
- Partition shared data per test; never run global resets during parallel execution.
- Wait for end states the user can see; keep overlay handling inside the components that cause overlays.
- Measure flake rate per test, cluster by signature, quarantine with owner and expiry, and review weekly.
- Retry only classified environment failures, once, and report "passed on retry" as flaky.
- Write up each investigation with the template; it builds the team's shared failure catalogue.

## Playwright (TypeScript) equivalent

Playwright bakes several of these practices into the runner, which is a useful contrast in interviews:

\`\`\`typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 1 : 0,                 // retried-then-passed tests are reported as "flaky"
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure',
         locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1366, height: 768 } },
});
// Reproduce: npx playwright test search.spec.ts --repeat-each=50 --workers=5
\`\`\`

The trace viewer gives DOM snapshots, network and console per step — the equivalent of the evidence listener plus video, out of the box. Locale, timezone and viewport are first-class config. In Selenium you build these yourself, which is why the listener and the run-context file matter. See *pw-deep-architecture* for the Playwright side.

## Interview questions

### Q: Walk me through how you investigate a flaky test.

**Short answer (30–60 s):** Reproduce with the CI conditions and many runs, classify it as product, test, environment or data, read the automatically captured evidence, isolate to the smallest failing unit — serial vs parallel, alone vs in suite, headed vs headless — fix the root cause at the layer it lives in, verify with the same repro, and leave a guard behind.

**Detailed answer:** I start from data: failure rate over the last N runs and the failure signature, then group with other tests sharing it. I reproduce with the same browser version (image tag or \`browserVersion\` via Selenium Manager), window size, locale and thread count, using \`invocationCount\` and \`threadPoolSize\` to amplify. The evidence folder — screenshot, DOM, URL, console via BiDi, driver log, run context, Grid session id for the video — usually classifies it before I touch code. Then I isolate by toggling one variable at a time. The fix removes the dependency on the hidden input; the verification is the same 50–200-run repro showing zero failures; prevention is a helper, a rule or a metric.

### Q: What are the main root causes of flaky UI tests?

**Short answer (30–60 s):** Timing (wrong or missing waits, animations, debounce), state leakage between tests, data collisions in parallel runs, environment differences (window size, fonts, locale, slow agents, memory), browser/driver drift, third-party scripts and network, stale elements from re-renders, overlays intercepting clicks, and wrong frame or window context.

**Detailed answer:** I group them by where the fix lives. Test-side: synchronisation, locators, context handling. Data-side: shared users and carts, order dependence, global resets. Environment-side: version pinning, container resources such as \`/dev/shm\`, fixed viewport and locale. Product-side: genuine races, which automation finds because it is fast — those are bugs to raise, not to wait around. The classification decides the owner and the fix.

### Q: How do you capture browser console logs in Selenium 4?

**Short answer (30–60 s):** The current way is WebDriver BiDi: enable the \`webSocketUrl\` capability and register console and JavaScript-error handlers through \`((RemoteWebDriver) driver).script()\`; it works for Chrome and Firefox. The older way is Chromium-only: the \`goog:loggingPrefs\` capability and \`driver.manage().logs().get(LogType.BROWSER)\`, which is outside the W3C standard and not supported by geckodriver.

**Detailed answer:** BiDi pushes events over a WebSocket, so the handler runs on Selenium's socket thread — collect into a thread-safe list and read it in the failure listener. Check the returned capabilities for \`webSocketUrl\`; on nodes or browsers without BiDi, degrade gracefully. I wrap it in one class because the Java BiDi APIs are still evolving between 4.x releases. Failing a test on unexpected JS errors is a separate decision — useful on checkout pages, noisy on pages with third-party scripts unless you allow-list.

### Q: The test fails only on CI. How do you reproduce it locally?

**Short answer (30–60 s):** Make local look like CI: the same browser build (same Docker image tag, or \`browserVersion\` with Selenium Manager), the same headless mode and window size, the same JVM locale and timezone, the same thread count, and amplify with \`invocationCount\` and \`threadPoolSize\`. If timing is involved, constrain CPU with a container.

**Detailed answer:** The run-context file on CI tells me exactly what differed, so I am not guessing. Most "CI-only" failures turn out to be window size (headless default ~800×600), fonts, locale, parallelism or slower CPUs. Running the browser in the same container image locally removes most differences at once. If it still will not reproduce, I add evidence (video, BiDi network events) on CI and wait for the next occurrence rather than guessing a fix.

### Q: What is your position on automatic retries?

**Short answer (30–60 s):** A classified, single retry for environment failures — session creation, Grid timeouts, connection resets — reported as flaky, never for assertion failures. Blanket retries hide intermittent product bugs and make real failures slower.

**Detailed answer:** A retry turns a 1-in-3 product race into a green build: the signal is lost exactly where it matters. So: no retries on \`AssertionError\`, one retry on classified environment exceptions, "passed on retry" counted and shown, and a weekly flaky review. Temporary retries on a specific test are acceptable with a ticket and an expiry while the root cause is fixed. Prevention through correct waits and isolated data beats any retry.

### Q: How do you measure and manage flakiness across a large suite?

**Short answer (30–60 s):** Record per-test status, retries, duration and failure signature for every run; compute a rolling flake rate; cluster failures by signature; quarantine tests above a threshold with an owner and expiry; and review the top offenders weekly.

**Detailed answer:** Signature = exception type + first frame in our code + normalised message; it turns 40 red tests into 3 root causes. Quarantine is a TestNG group excluded from the blocking pipeline and run in a non-blocking job so we keep the signal. I publish the trend so the team sees flakiness going down — and treat a growing quarantine as a tech-debt item in planning, not something automation absorbs silently.

### Q: Headless vs headed — do tests behave differently?

**Short answer (30–60 s):** With Chrome's new headless — the default since the old mode was removed from the Chrome binary in Chrome 132 — the browser is the real Chrome, so behaviour differences are mostly gone. The common differences now are environmental: default window size (~800×600), fonts in Linux containers, GPU/media features.

**Detailed answer:** \`--headless=new\` arrived in Chrome 112; the old implementation lives on only as \`chrome-headless-shell\`. So when a test fails only headless, I check window size first (responsive layout, elements below the fold or behind sticky footers), then fonts and text wrapping, then container resources. Always set an explicit window size and log the actual size in the evidence.

## Scenario-based questions

**1. After enabling \`parallel="methods"\` with 8 threads, 15% of checkout tests fail with counts off by one and occasional 401s.** I would suspect shared data first: check which user each test uses and whether any setup calls a global reset. In ShopEasy's API, carts are per user and \`/api/reset\` drops all tokens — so parallel tests on \`standard_user\` collide and a reset in one thread invalidates others. I would confirm by running with one thread (failures disappear) and by grepping for the shared username and the reset call. Fix: per-test registered users through a data factory, reset only in \`@BeforeSuite\`. Verify with 200 invocations on 8 threads, then add a CI check against hard-coded shared users.

**2. Monday morning: 40 UI tests fail on one agent pool with assorted exceptions; Friday's run on the same commit was green.** Same commit, so environment. The evidence context shows the Chrome major changed on that pool, and the driver log shows a session crash on a heavy page. I would pin the browser (image tag for containers, \`browserVersion\` for VMs), roll the pool back, then upgrade deliberately in a PR that runs the whole suite. I would also cluster the 40 failures by signature to confirm they are one cause, and communicate it as an environment incident, not 40 test failures.

**3. A product manager asks why automation "keeps failing" and suggests adding three retries to everything.** I would show the data: flake rate per test, classification of the last month's failures (for example 60% test sync, 25% data, 10% environment, 5% real product races that retries would have hidden), and the cost of blanket retries (slower red builds, missed bugs). I would propose a classified single retry for environment failures, a quarantine with owners for the top offenders, and a two-sprint stabilisation plan with a target flake rate — measurable and reviewed weekly.

## Tricky follow-ups

- **Q: The screenshot shows the element, but Selenium says \`NoSuchElementException\`. Why?** The driver is in a different browsing context (an iframe or another window) — screenshots show the whole top-level page — or the element is in a shadow root. Check the current frame/window, not the locator.
- **Q: Does \`invocationCount\` reuse the same browser?** Not if your driver lifecycle is \`@BeforeMethod\`/\`@AfterMethod\`: configuration methods run around every invocation. With \`@BeforeClass\` lifecycle all invocations share one browser — which can hide or create flakiness.
- **Q: A test passes on retry. Is that a pass?** It is a flaky result: report it separately, count it, and investigate; the product may have an intermittent bug.
- **Q: Why can \`Locale.setDefault\` in one test break another?** It is JVM-global state; in a parallel run other threads see the change mid-test. Pass locales explicitly instead.
- **Q: Is \`ElementClickInterceptedException\` ever a product bug?** Yes — if a cookie banner, toast or sticky footer covers a control at a supported viewport, a user is blocked too. Do not hide it with a JavaScript click.`,
  keyPoints: [
    'Workflow: reproduce → classify (product / test / environment / data) → gather evidence → isolate → fix the root cause at its layer → prevent with a guard.',
    'A flaky test has a hidden non-deterministic input — time, order, shared data, environment, network; the fix makes the test independent of it, a longer timeout or retry only mitigates.',
    'Capture evidence automatically on every failure: screenshot, DOM, URL, BiDi console/JS errors, driver log, run context (browser version, window size, locale, thread, session id) and Grid video.',
    'BiDi (webSocketUrl + script() handlers) is the current way to collect console logs; goog:loggingPrefs + manage().logs() is the legacy Chromium-only extension.',
    'Chrome new headless is the real browser (since Chrome 112; old mode removed from Chrome in 132) — remaining CI differences are window size, fonts, locale, CPU and memory.',
    'Reproduce CI-only failures with the same browser build (image tag or browserVersion via Selenium Manager), same window size and locale, and amplify with invocationCount + threadPoolSize.',
    'Parallel flakiness is mostly shared data: unique users per test, no global resets during the run, clean up only your own data.',
    'Measure flake rate and cluster by failure signature; quarantine with owner and expiry; retry once only for classified environment failures and report passed-on-retry as flaky.',
  ],
  mistakes: [
    'Re-running the pipeline until green and calling it fixed. Fix: record the failure signature and evidence path, compute the flake rate, and reproduce with invocationCount before changing anything.',
    'Adding Thread.sleep or a longer timeout for a debounced search or animated modal. Fix: wait for the end state the user sees (result count text, overlay invisible) inside the page component that causes the delay.',
    'Running parallel tests with one shared account and a global reset in @BeforeMethod. Fix: a data factory that creates a unique user per test, reset only once before the suite, clean up only data the test created.',
    'An evidence listener that throws when the session is already dead, replacing the real failure with "Session ID is null". Fix: guard each capture separately, always write the run-context file, and log what could not be captured.',
    'Building expected strings with String.format or NumberFormat using the default locale, so tests fail on agents with a different locale. Fix: explicit Locale.ROOT/Locale.US and BigDecimal comparisons; log JVM locale and timezone in the evidence.',
    'Blanket IRetryAnalyzer on every test to raise the pass rate. Fix: one classified retry for environment exceptions only, never AssertionError; report passed-on-retry as flaky and review the list weekly.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`): (1) add \`BrowserConsole\` and \`EvidenceListener\` to a TestNG project, enable \`webSocketUrl\`, and make a test on \`alerts.html\` fail on purpose by opening the "Delete saved address" modal and then clicking \`#js-alert-btn\` — confirm the evidence folder contains the screenshot, \`page.html\` with \`#confirm-modal\` lacking the \`hidden\` attribute, the URL, \`context.txt\` and the exception naming the overlay; then fix it inside an \`AddressModal\` component. (2) Write a \`table.html\` search test with \`@Test(invocationCount = 30, threadPoolSize = 5)\`, run it headless at the default window size and at 1366×768, and compare. (3) With the API running (port 5181), write two parallel tests that seed the cart for \`standard_user\` and assert \`itemCount\`; observe the collision, then fix with a unique registered user per test and verify with 100 invocations. (4) Fill in the analysis template for one of the three.`,
  problems: ['sel-006', 'sel-036', 'sel-042', 'sel-009'],
}
