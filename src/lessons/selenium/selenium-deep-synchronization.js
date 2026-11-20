export default {
  slug: 'selenium-deep-synchronization',
  category: 'selenium',
  order: 13,
  title: 'Deep dive: synchronization internals — implicit, explicit and fluent waits, custom conditions and AJAX',
  minutes: 30,
  summary: 'Know exactly where each wait runs (driver-side implicit timeout versus the client-side FluentWait loop), why mixed waits produce 20-second "10-second" timeouts, what ExpectedConditions really check, how to write stateful custom conditions, how page-load strategy and JS state fit in, and how to build and debug a framework Waiter.',
  manualAnalogy: `When you test by hand you never "wait five seconds" — you wait until the spinner is gone, the button turns blue, the order says Completed, the list stops growing. You also know the difference between "the page is still loading" and "the page is broken", and after a minute of nothing you stop and file a bug with a screenshot. Synchronization in a framework is that judgement written down: wait for the user-visible state, with a known upper limit, and when the limit is reached, fail with a message that says what you were waiting for and what you saw instead.`,
  body: `## Where the earlier lessons stop

The *Explicit and fluent waits* lesson covered the three kinds of wait, the most common \`ExpectedConditions\`, the "false before, true after" test and a first \`FluentWait\` with a lambda. The *Exceptions* lesson and the \`java-deep-exception-design\` deep dive cover the exception taxonomy and retry design; \`java-deep-multithreading-synchronization\` covers *thread* synchronization (a different topic with the same word). This lesson is about the **mechanics**: which process does the waiting, what the \`FluentWait\` loop does line by line, what each condition really asks the browser, how to write conditions the library does not have, and how to turn all of that into one framework component whose timeouts are diagnosable.

## Where each wait runs

\`\`\`
 Test JVM (your code)                     Driver process                     Browser
 ─────────────────────                    ──────────────                     ───────
 WebDriverWait / FluentWait loop          chromedriver / geckodriver         DOM, JS, layout
   apply(condition) ── HTTP POST ──────▶  Find Element                ──▶   querySelector
                                          (retries until the session's
                                           IMPLICIT timeout expires)
   ◀── element id / "no such element" ──
   sleep(polling interval) in the JVM
   apply(condition) again ...
\`\`\`

- **Implicit wait is a session timeout held by the driver.** \`driver.manage().timeouts().implicitlyWait(d)\` sends the W3C *Set Timeouts* command (\`{"implicit": 10000}\`). From then on, every *Find Element(s)* command — from the driver, from a \`WebElement\` (child search) or from a shadow root — is retried **inside the driver** until something matches or the timeout expires. Your Java thread is blocked in one HTTP call the whole time. It applies to *finding* only: not to visibility, enablement, text, clicks or alerts.
- **\`findElements\` with an implicit wait** waits the full timeout when nothing matches before returning an empty list. Every "is it absent?" check costs the whole implicit timeout.
- **Explicit waits run in the client.** \`FluentWait.until\` is a plain Java loop: evaluate the condition (which sends one or more WebDriver commands), check the clock, sleep, repeat. The driver knows nothing about it — which is why it can wait for *anything* (text, count, URL, a JS value, a file on disk).
- **Page-load and script timeouts are also session timeouts**, enforced by the driver: \`pageLoadTimeout\` bounds *Navigate To* / *Refresh* / *Back* (and clicks that navigate, depending on the driver), \`scriptTimeout\` bounds \`executeScript\` and \`executeAsyncScript\`.

### The timeouts API

| Method (Selenium 4) | W3C key | Spec default | Applies to |
|---|---|---|---|
| \`timeouts().implicitlyWait(Duration)\` | \`implicit\` | 0 ms | element lookups |
| \`timeouts().pageLoadTimeout(Duration)\` | \`pageLoad\` | 300,000 ms (5 min) | navigation until the page-load strategy is satisfied |
| \`timeouts().scriptTimeout(Duration)\` | \`script\` | 30,000 ms | \`executeScript\` / \`executeAsyncScript\` |
| \`getImplicitWaitTimeout()\`, \`getPageLoadTimeout()\`, \`getScriptTimeout()\` | — | — | read back the current values |

The defaults are the W3C WebDriver spec's initial values; drivers follow them. The \`long, TimeUnit\` overloads and \`setScriptTimeout\` are the deprecated Selenium 3 forms — use the \`Duration\` versions. A five-minute page-load default is far too long for a test: set it to 30–60 s in the driver factory so a hung page fails in a reasonable time with a \`TimeoutException\` from \`get()\`.

## Inside FluentWait.until

\`WebDriverWait\` extends \`FluentWait<WebDriver>\`. The loop in the Selenium source (simplified, comments mine):

\`\`\`java
public <V> V until(Function<? super T, V> isTrue) {
    Instant end = clock.instant().plus(timeout);
    Throwable lastException;
    while (true) {
        try {
            V value = isTrue.apply(input);
            if (value != null && (Boolean.class != value.getClass() || Boolean.TRUE.equals(value))) {
                return value;                     // anything except null / FALSE ends the wait
            }
            lastException = null;                 // a clean "not yet" clears the last error
        } catch (Throwable e) {
            lastException = propagateIfNotIgnored(e);   // not ignored -> rethrown immediately
        }
        if (end.isBefore(clock.instant())) {    // deadline checked AFTER evaluating
            String message = messageSupplier.get();
            String timeoutMessage = String.format(
                "Expected condition failed: %s%n(tried for %s with %d milliseconds interval)",
                message == null ? "waiting for " + isTrue : message, ...);
            throw timeoutException(timeoutMessage, lastException);   // last ignored exception = cause
        }
        sleeper.sleep(interval);                  // InterruptedException -> re-interrupt + WebDriverException
    }
}
\`\`\`

What follows from this code:

| Detail | Consequence |
|---|---|
| \`FluentWait\` defaults: timeout **500 ms**, polling **500 ms** | a bare \`new FluentWait<>(driver)\` gives up after half a second — always set \`withTimeout\` |
| \`WebDriverWait(driver, timeout)\` polls every 500 ms and **ignores \`NotFoundException\`** | \`NoSuchElementException\`, \`NoSuchFrameException\`, \`NoSuchWindowException\`, \`NoAlertPresentException\` (subclasses) are swallowed during polling; \`StaleElementReferenceException\` is **not** |
| The condition is evaluated before the deadline check | the first evaluation always happens, even with a zero timeout; and an evaluation that started at 9.9 s of a 10 s wait may finish at 10.3 s — real duration = timeout + one evaluation (+ one implicit timeout, see below) |
| Return rule: non-null and not \`Boolean.FALSE\` | a condition returning \`""\`, \`0\` or an empty list **ends the wait successfully**. Return \`null\` for "not yet" |
| \`lastException\` is reset after a clean evaluation | the cause attached to the \`TimeoutException\` is the exception from the **final** poll(s), not the first |
| Message: \`withMessage\` supplier, else \`"waiting for " + condition.toString()\` | a lambda's \`toString()\` is \`MyTest$$Lambda$123/0x...\` — give custom conditions a \`toString()\` or a \`withMessage\` |
| \`Clock\` and \`Sleeper\` are injectable (\`new FluentWait<>(input, clock, sleeper)\`) | you can unit-test a custom wait helper with a fake clock and a no-op sleeper — no browser, no real time |
| \`WebDriverWait.timeoutException\` adds driver info, session id and capabilities | the \`TimeoutException\` text in the report already tells you which browser/session failed |

\`FluentWait\` is generic: \`new FluentWait<>(someElement)\`, \`new FluentWait<>(Paths.get("target/downloads"))\` or \`new FluentWait<>(apiClient)\` all work — the "input" is whatever your condition is applied to.

## Why mixing implicit and explicit waits breaks timing

Set-up: implicit wait 10 s, \`WebDriverWait\` 15 s, polling 500 ms, the element **never** appears.

\`\`\`
t = 0.0   poll 1: visibilityOfElementLocated -> findElement blocks in the driver ...
t = 10.0           driver gives up: "no such element" -> ignored (NotFoundException)
          deadline 15 s not passed -> sleep 0.5 s
t = 10.5  poll 2: findElement blocks again ...
t = 20.5           "no such element" -> deadline passed -> TimeoutException
          message says "tried for 15 second(s)" — the test actually waited 20.5 s
\`\`\`

And the opposite case — an absence check while an implicit wait is set:

\`\`\`java
// implicit = 10 s; the error banner is (correctly) not there
wait.until(ExpectedConditions.invisibilityOfElementLocated(By.cssSelector("[data-testid=error]")));
// findElement blocks 10 s -> NoSuchElementException -> condition returns true. A "free" check costs 10 s.
\`\`\`

The Selenium documentation warns explicitly not to mix the two, using exactly this kind of example (10 s implicit + 15 s explicit can time out after 20 s). The rule for a framework: **implicit wait = 0** (the default — so the fix is usually *deleting* a line in \`BaseTest\`), explicit waits everywhere, \`findElements(...).isEmpty()\` for instant absence checks. If a legacy suite cannot drop the implicit wait yet, wrap absence checks in a helper that sets it to \`Duration.ZERO\` and restores the previous value (read with \`getImplicitWaitTimeout()\`) in \`finally\`.

## ExpectedConditions internals

Every condition is just an \`ExpectedCondition<T>\` — an interface extending \`Function<WebDriver, T>\` — with a readable \`toString()\`. Nothing magic: each poll it issues ordinary WebDriver commands.

Two families matter for flakiness:

- **Locator-based** (\`...Located(By)\`) call \`driver.findElement\` **on every poll**. A re-render between polls is harmless; most of them also catch \`StaleElementReferenceException\` internally and return "not yet".
- **Element-based** (\`visibilityOf(WebElement)\`, \`elementToBeClickable(WebElement)\`, \`textToBePresentInElement(WebElement, ...)\`, \`attributeToBe(WebElement, ...)\`) hold the **reference you passed in**. If the framework re-renders that node, every poll throws \`StaleElementReferenceException\`, which \`WebDriverWait\` does not ignore — the wait fails immediately. Use them only for nodes that are not re-rendered (or for elements you cannot locate with a \`By\`, such as shadow-DOM children). \`ExpectedConditions.refreshed(condition)\` wraps an element-based condition and treats a stale reference as "not yet", but it cannot re-find the node — prefer the locator-based form.

| Condition | What it really checks per poll | Watch out |
|---|---|---|
| \`presenceOfElementLocated(by)\` | \`findElement(by)\` succeeds | true for \`display:none\` and zero-size elements |
| \`visibilityOfElementLocated(by)\` | found **and** \`isDisplayed()\` | \`isDisplayed\` is the Selenium "is displayed" atom: CSS display/visibility/opacity, size, ancestors — **not** "in the viewport" and **not** "not covered" |
| \`visibilityOfAllElementsLocatedBy(by)\` | \`findElements\` non-empty **and every** element displayed | one hidden template row keeps it false forever |
| \`elementToBeClickable(by)\` | visible **and** \`isEnabled()\` | does **not** check overlays, animations or pointer-events: \`ElementClickInterceptedException\` is still possible |
| \`invisibilityOfElementLocated(by)\` | not found, stale, or not displayed | true before a spinner has even appeared |
| \`textToBePresentInElementLocated(by, s)\` | \`getText().contains(s)\` | substring: "Processing" also matches "Processing failed" |
| \`textToBe(by, s)\` / \`textMatches(by, Pattern)\` | exact text / regex \`find()\` on \`getText()\` | \`getText\` = rendered text, trimmed and whitespace-normalised |
| \`attributeToBe(by, name, value)\` | attribute value equals; if the attribute is null/empty it falls back to \`getCssValue(name)\` | the CSS fallback surprises people; \`attributeContains\` is a substring check (handy for \`class\`) |
| \`numberOfElementsToBe(by, n)\` / \`...MoreThan\` / \`...LessThan\` | \`findElements(by).size()\` | with an implicit wait, a zero count costs the full implicit timeout |
| \`stalenessOf(element)\` | any call on the element throws stale | proves the old node was detached — not that the new one is ready |
| \`urlContains\`, \`urlToBe\`, \`titleIs\` | \`getCurrentUrl()\`, \`getTitle()\` | for JS redirects after a click |
| \`frameToBeAvailableAndSwitchToIt\`, \`alertIsPresent\`, \`numberOfWindowsToBe\` | switch attempts / handle count | they **switch** the driver as a side effect (frames, alerts) |
| \`and(...)\`, \`or(...)\`, \`not(...)\` | combinators | \`not(visibilityOf...)\` and \`invisibilityOf...\` differ on missing elements |

(Behaviour above is from the Selenium Java support library source; it has been stable through Selenium 4, but read the class once in your IDE — it is short and worth knowing.)

## Writing custom conditions

When no library condition describes the user-visible state, write one. Rules: **re-find inside the condition**, return \`null\`/\`false\` for "not yet", return something useful for "done", and give it a \`toString()\` so the timeout message is readable.

\`\`\`java
package com.shopeasy.framework.wait;

import java.util.Objects;
import java.util.regex.Pattern;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Rectangle;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedCondition;

public final class ShopConditions {

    private ShopConditions() { }

    /** Full-text regex match; returns the text so the test can parse it. */
    public static ExpectedCondition<String> textFullyMatches(By locator, Pattern pattern) {
        return new ExpectedCondition<>() {
            @Override public String apply(WebDriver driver) {
                String text = driver.findElement(locator).getText();
                return pattern.matcher(text).matches() ? text : null;
            }
            @Override public String toString() {
                return "text of " + locator + " to fully match /" + pattern + "/";
            }
        };
    }

    /** True once the text differs from a value captured BEFORE the action. */
    public static ExpectedCondition<String> textChangedFrom(By locator, String before) {
        return new ExpectedCondition<>() {
            @Override public String apply(WebDriver driver) {
                String now = driver.findElement(locator).getText();
                return Objects.equals(now, before) ? null : now;
            }
            @Override public String toString() {
                return "text of " + locator + " to change from '" + before + "'";
            }
        };
    }

    /** Stateful: the number of matches must stay the same for N consecutive polls. */
    public static ExpectedCondition<Integer> countStableFor(By locator, int stablePollsRequired) {
        return new ExpectedCondition<>() {
            private int lastCount = -1;
            private int stablePolls;

            @Override public Integer apply(WebDriver driver) {
                int count = driver.findElements(locator).size();
                if (count == lastCount) {
                    stablePolls++;
                } else {
                    lastCount = count;
                    stablePolls = 0;
                }
                return stablePolls >= stablePollsRequired ? count : null;
            }
            @Override public String toString() {
                return "count of " + locator + " to stay stable for " + stablePollsRequired
                        + " polls (last count " + lastCount + ")";
            }
        };
    }

    /** Stateful: element is displayed and its rectangle did not change since the previous poll. */
    public static ExpectedCondition<WebElement> stoppedMoving(By locator) {
        return new ExpectedCondition<>() {
            private Rectangle previous;

            @Override public WebElement apply(WebDriver driver) {
                WebElement element = driver.findElement(locator);
                Rectangle now = element.getRect();
                boolean still = previous != null
                        && previous.getX() == now.getX() && previous.getY() == now.getY()
                        && previous.getWidth() == now.getWidth() && previous.getHeight() == now.getHeight();
                previous = now;
                return still && element.isDisplayed() ? element : null;
            }
            @Override public String toString() {
                return locator + " to stop moving (last rect " + previous + ")";
            }
        };
    }

    /** "Network-idle-ish": document complete and no NEW resource entries for N polls. */
    public static ExpectedCondition<Boolean> resourcesQuietFor(int quietPollsRequired) {
        return new ExpectedCondition<>() {
            private long lastEntries = -1;
            private int quietPolls;

            @Override public Boolean apply(WebDriver driver) {
                Object raw = ((JavascriptExecutor) driver).executeScript(
                        "return document.readyState === 'complete'"
                      + " ? performance.getEntriesByType('resource').length : -1;");
                long entries = ((Number) raw).longValue();
                if (entries < 0) { quietPolls = 0; return false; }
                if (entries == lastEntries) { quietPolls++; } else { lastEntries = entries; quietPolls = 0; }
                return quietPolls >= quietPollsRequired;
            }
            @Override public String toString() {
                return "no new resource requests for " + quietPollsRequired + " polls";
            }
        };
    }
}
\`\`\`

**Step by step**

- \`new ExpectedCondition<>() { ... }\` — an anonymous class instead of a lambda, purely to get a \`toString()\`. A one-line lambda (\`d -> ...\`) is fine when the wait has a \`withMessage\`.
- \`textChangedFrom\` captures the "before" value **before** the action. This is the "false before, true after" rule made explicit; on \`waits.html\`, \`#last-refreshed\` is empty before "Refresh prices" and "Refreshed at 10:42:07" after — a perfect change signal, while waiting for \`#price-list\` presence would pass instantly (the old list is present).
- \`countStableFor\` and \`stoppedMoving\` **keep state between polls**. A stateful condition must be created per wait — a factory method call per \`until\` — never stored in a static field or reused, or the second wait starts with the first wait's counters. With 500 ms polling, "stable for 2 polls" means ~1 s of no change: a debounce, not proof. Use it where there is genuinely no end signal (infinite scroll, a feed without a "no more" marker); on \`waits.html\` section 7 there **is** an end signal (\`#no-more-reviews\` becomes visible), and an explicit end signal always beats a stability heuristic.
- \`stoppedMoving\` exists for CSS transitions (slide-in drawers, accordions): \`elementToBeClickable\` is true during the animation, and the click lands on the old coordinates.
- \`resourcesQuietFor\` uses the Resource Timing API. It only sees **completed** requests (an in-flight fetch is invisible until it finishes), it is capped by the browser's resource-timing buffer, and long-polling/analytics beacons can keep it busy. Treat it as a coarse "page settled" heuristic for smoke tests or screenshots, never as the condition for a functional assertion. For real network awareness use BiDi/CDP network events (see the *Browser state and network* lesson).
- \`executeScript\` returns JavaScript numbers as \`Long\` or \`Double\` — casting to \`Number\` and calling \`longValue()\` avoids a \`ClassCastException\` either way.

## Waiting for page and JavaScript state

### document.readyState and page-load strategies

\`driver.get()\` blocks until the session's **page-load strategy** is satisfied:

| Strategy | \`get()\` returns when | Use it when | Risk |
|---|---|---|---|
| \`NORMAL\` (default) | \`load\` event — \`readyState == "complete"\` (all images, stylesheets, sync scripts) | almost always | slow third-party assets (ads, chat widgets) hold every navigation |
| \`EAGER\` | \`DOMContentLoaded\` — \`readyState == "interactive"\` | heavy pages where you wait for specific elements anyway | elements may not be styled / scripts may not have attached handlers yet |
| \`NONE\` | immediately after the navigation starts | you need to act during load (measure, stop a request) | everything is your job; \`findElement\` may hit the previous page |

\`\`\`java
ChromeOptions options = new ChromeOptions();
options.setPageLoadStrategy(PageLoadStrategy.EAGER);
\`\`\`

None of these strategies knows about the SPA's own data loading. A React/Angular app reaches \`readyState == "complete"\` and **then** fetches the product list. So waiting for \`document.readyState\` after \`get()\` with the normal strategy is redundant, and after a client-side route change (\`pushState\`, no new document) it is meaningless — it stays \`"complete"\` the whole time. Its only real use is with \`EAGER\`/\`NONE\`, or after a click that triggers a full navigation when you are not sure the driver waited.

### Framework-specific "is the app idle?" waits

| Framework hook | Script | Problem |
|---|---|---|
| jQuery | \`return window.jQuery ? jQuery.active === 0 : true;\` | only counts jQuery AJAX; \`fetch\` calls are invisible; true before the request starts |
| AngularJS (1.x) | \`angular.element(document.body).injector().get('$http').pendingRequests.length === 0\` | legacy only |
| Angular (2+) | \`return window.getAllAngularTestabilities().every(t => t.isStable());\` | zone-based; apps with long-running timers/websockets are never "stable" |
| React / Vue | no public idle hook | teams add custom flags (\`window.__pendingRequests\`) — app code just for tests |

**Why app-agnostic UI-state waits are better:** "no requests pending" is neither necessary nor sufficient for "the user can act". A request can complete and the render happen a frame later; a request can be pending (analytics, polling) while the UI is long ready; a framework migration (AngularJS → React) silently turns every framework wait into a no-op. The user waits for **what they see** — the spinner gone, the price text, the enabled button — and so should the test. Framework hooks are acceptable as an *additional* global settle step in legacy suites, never as the only synchronization.

## Spinners, overlays and ElementClickInterceptedException

\`\`\`
org.openqa.selenium.ElementClickInterceptedException: element click intercepted:
Element <button id="place-order" ...> is not clickable at point (612, 418).
Other element would receive the click: <div class="modal-overlay" ...></div>
\`\`\`

The *Element Click* command scrolls the element into view, computes its in-view centre point and checks that the element (or a descendant) is the topmost hit-test target there. \`elementToBeClickable\` checks none of that — only displayed and enabled. Two patterns:

\`\`\`java
// 1. The overlay has a stable locator: wait for it to go away, then for the target
wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("loading-spinner")));
wait.until(ExpectedConditions.elementToBeClickable(By.id("load-data-btn"))).click();

// 2. The spinner may not have appeared yet: wait for the END state instead
driver.findElement(By.id("load-data-btn")).click();
WebElement loaded = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("orders-loaded")));
\`\`\`

The race in pattern 1: right after a click, the spinner has not been shown yet, so \`invisibilityOf\` is **already true** and you proceed into the loading state. If you must wait on the spinner, do it in two phases — wait briefly (1–2 s) for it to **appear**, tolerate a \`TimeoutException\` there (it may have come and gone), then wait for it to disappear. Better still, wait for the end state (pattern 2): on \`waits.html\` section 3, \`#orders-loaded\` does not exist until the data is in, so its visibility is a complete, race-free signal.

A senior click helper retries only \`ElementClickInterceptedException\` (and stale) for a short period, inside a wait — so the retry is bounded and logged — and never falls back to a JavaScript click silently (see \`selenium-deep-interactions\` for the JS policy).

## Approaches compared

\`\`\`java
// A. Thread.sleep
Thread.sleep(3000);
driver.findElement(By.id("orders-loaded"));

// B. Implicit wait (session-wide)
driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
driver.findElement(By.id("orders-loaded"));          // presence only

// C. WebDriverWait + ExpectedConditions
new WebDriverWait(driver, Duration.ofSeconds(10))
        .until(ExpectedConditions.visibilityOfElementLocated(By.id("orders-loaded")));

// D. FluentWait with explicit polling, ignores and message
new FluentWait<>(driver)
        .withTimeout(Duration.ofSeconds(10))
        .pollingEvery(Duration.ofMillis(250))
        .ignoring(NoSuchElementException.class, StaleElementReferenceException.class)
        .withMessage("orders to load after clicking Load orders")
        .until(d -> d.findElement(By.id("orders-loaded")).isDisplayed());

// E. Framework helper (below)
waiter.visible(By.id("orders-loaded"));

// F. Awaitility (non-WebDriver conditions: DB rows, files, API state)
await().atMost(Duration.ofSeconds(30))
       .pollInterval(Duration.ofSeconds(1))
       .ignoreExceptions()
       .until(() -> orderApi.status("ORD-1043").equals("SHIPPED"));
\`\`\`

| | How it works | Advantages | Disadvantages | Performance | Maintainability / scalability | When to use |
|---|---|---|---|---|---|---|
| \`Thread.sleep\` | blocks the thread a fixed time | trivial | too short on CI, too long locally; no condition | worst: always pays the full time, multiplied by every test | hidden magic numbers everywhere | never in tests (only in a demo or a deliberate pacing loop) |
| Implicit wait | driver retries lookups | one line | presence only; slows absence checks; corrupts explicit timings | absence checks pay the full timeout | global side-effect, hard to reason about | legacy suites only, being phased out |
| \`WebDriverWait\` + EC | client loop, 500 ms, ignores NotFound | readable, ready-made conditions | stale not ignored; default messages generic | returns as soon as true | good, but scattered \`new WebDriverWait\` with literal timeouts | the default for UI state |
| \`FluentWait\` | same loop, fully configurable | polling, ignores, message, any input type | more verbose | tunable polling (250 ms for snappy UIs) | good if centralised | custom conditions, non-driver inputs |
| Framework \`Waiter\` | FluentWait behind an intention-revealing API | timeouts from config, consistent messages, logging, metrics | must be designed and owned | same as FluentWait | best: one place to tune for the whole suite | every page object |
| Awaitility | generic polling DSL | great for non-UI eventual consistency, \`untilAsserted\` for assertion-style waits | another dependency; no WebDriver-specific messages | similar | good | DB, message queues, files, API state in hybrid tests |

**Recommended approach and why:** implicit wait 0; a framework \`Waiter\` built on \`FluentWait\` used by page objects for every UI state; library \`ExpectedConditions\` where they fit, small named custom conditions where they don't; Awaitility for non-browser eventual consistency. This gives predictable timings (one timeout per wait), readable failures, and one place to change polling or timeouts when the CI grid gets slower — instead of 400 literal \`Duration.ofSeconds(10)\` values.

## A reusable Waiter component

\`\`\`java
package com.shopeasy.framework.wait;

import java.time.Duration;
import java.util.function.Function;
import java.util.regex.Pattern;
import org.openqa.selenium.By;
import org.openqa.selenium.NotFoundException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.FluentWait;
import org.openqa.selenium.support.ui.Wait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Waiter {

    /** Timeouts come from configuration, never from literals in page objects. */
    public record WaitConfig(Duration standard, Duration slow, Duration polling) {
        public static WaitConfig fromSystemProperties() {
            return new WaitConfig(
                    Duration.ofSeconds(Long.getLong("wait.standard.seconds", 10)),
                    Duration.ofSeconds(Long.getLong("wait.slow.seconds", 30)),
                    Duration.ofMillis(Long.getLong("wait.polling.millis", 250)));
        }
    }

    private static final Logger LOG = LoggerFactory.getLogger(Waiter.class);

    private final WebDriver driver;
    private final WaitConfig config;

    public Waiter(WebDriver driver, WaitConfig config) {
        this.driver = driver;
        this.config = config;
    }

    public <T> T until(String expectation, Function<WebDriver, T> condition) {
        return until(expectation, condition, config.standard());
    }

    public <T> T until(String expectation, Function<WebDriver, T> condition, Duration timeout) {
        Wait<WebDriver> wait = new FluentWait<>(driver)
                .withTimeout(timeout)
                .pollingEvery(config.polling())
                .ignoring(NotFoundException.class, StaleElementReferenceException.class)
                .withMessage(() -> expectation + " [url: " + currentUrlOrUnknown() + "]");
        long started = System.nanoTime();
        try {
            T result = wait.until(condition);
            LOG.debug("{} -> ok after {} ms", expectation, elapsedMs(started));
            return result;
        } catch (TimeoutException e) {
            LOG.warn("{} -> TIMEOUT after {} ms", expectation, elapsedMs(started));
            throw e;   // the listener adds screenshot + DOM; we only add context, never swallow
        }
    }

    public WebElement visible(By locator) {
        return until("element " + locator + " to be visible",
                ExpectedConditions.visibilityOfElementLocated(locator));
    }

    public WebElement clickable(By locator) {
        return until("element " + locator + " to be visible and enabled",
                ExpectedConditions.elementToBeClickable(locator));
    }

    public void gone(By locator) {
        until("element " + locator + " to be hidden or removed",
                ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    public String text(By locator, Pattern pattern) {
        return until("text of " + locator + " to match /" + pattern + "/",
                ShopConditions.textFullyMatches(locator, pattern));
    }

    public String textChange(By locator, String before) {
        return until("text of " + locator + " to change from '" + before + "'",
                ShopConditions.textChangedFrom(locator, before));
    }

    public <T> T slow(String expectation, Function<WebDriver, T> condition) {
        return until(expectation, condition, config.slow());
    }

    private String currentUrlOrUnknown() {
        try {
            return driver.getCurrentUrl();
        } catch (WebDriverException e) {   // an open alert or dead session must not hide the timeout
            return "unknown (" + e.getClass().getSimpleName() + ")";
        }
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }
}
\`\`\`

**Step by step**

- **\`WaitConfig\`** — two or three named timeouts (standard UI, slow back-office job, polling) loaded once from configuration; a CI profile can raise \`wait.standard.seconds\` without touching code. Resist per-call literals: "slow" is a named category, not \`Duration.ofSeconds(47)\`.
- **\`ignoring(NotFoundException.class, StaleElementReferenceException.class)\`** — the two transient exceptions of a re-rendering UI. Not \`WebDriverException\`: an \`InvalidSelectorException\` from a typo must fail on the first poll, not after 10 s.
- **\`withMessage(() -> ...)\`** — a *supplier*, evaluated only on timeout; it states the expectation in business-readable words plus the URL. The URL lookup is guarded, because \`getCurrentUrl()\` throws while an alert is open, and an exception thrown from the message supplier would replace the \`TimeoutException\`.
- **Logging** — debug on success with the elapsed time (aggregate these to find the slowest waits in the suite), warn on timeout, then **rethrow**. Screenshots belong in the TestNG failure listener (see \`java-deep-exception-design\`), which runs while the browser is still open.
- **Intention-revealing methods** — page objects call \`waiter.visible(PRICE)\`, \`waiter.gone(SPINNER)\`; nobody constructs waits in tests. The \`Waiter\` is created per driver (per thread in a parallel run — it holds the driver, so it lives next to it in the \`ThreadLocal\` driver manager, see \`java-deep-multithreading-synchronization\`).

### Real-time scenario: ShopEasy waits page

\`\`\`java
package com.shopeasy.tests;

import java.time.Duration;
import java.util.regex.Pattern;
import com.shopeasy.framework.wait.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.PageLoadStrategy;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class WaitsPageSyncTest {

    private static final By LOAD_ORDERS = By.id("load-data-btn");
    private static final By ORDERS_LOADED = By.id("orders-loaded");
    private static final By CLAIM_REWARD = By.id("claim-reward-btn");
    private static final By CLAIM_RESULT = By.id("claim-result");
    private static final By REFRESH_PRICES = By.id("refresh-prices-btn");
    private static final By LAST_REFRESHED = By.id("last-refreshed");
    private static final By PRICE_ROWS = By.cssSelector("#price-list .price-row");

    private WebDriver driver;
    private Waiter waiter;

    @BeforeMethod
    public void openWaitsPage() {
        ChromeOptions options = new ChromeOptions();
        options.setPageLoadStrategy(PageLoadStrategy.NORMAL);
        driver = new ChromeDriver(options);
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        driver.manage().timeouts().implicitlyWait(Duration.ZERO);       // explicit, not accidental
        waiter = new Waiter(driver, Waiter.WaitConfig.fromSystemProperties());
        driver.get("http://localhost:5180/practice-site/waits.html");
    }

    @Test
    public void ordersAppearOnlyAfterLoading() {
        driver.findElement(LOAD_ORDERS).click();
        String text = waiter.text(ORDERS_LOADED, Pattern.compile("Loaded [0-9]+ orders"));
        Assert.assertEquals(text, "Loaded 42 orders");
    }

    @Test
    public void rewardCanBeClaimedOnceEnabled() {
        Assert.assertFalse(driver.findElement(CLAIM_REWARD).isEnabled(), "precondition: disabled at load");
        waiter.clickable(CLAIM_REWARD).click();
        waiter.until("reward confirmation",
                ExpectedConditions.textToBe(CLAIM_RESULT, "Reward claimed: 500 points"));
    }

    @Test
    public void refreshedPricesAreReadFromTheNewList() {
        String before = driver.findElement(LAST_REFRESHED).getText();   // "" at load
        driver.findElement(REFRESH_PRICES).click();
        waiter.textChange(LAST_REFRESHED, before);                      // the end signal
        Assert.assertEquals(driver.findElements(PRICE_ROWS).size(), 3); // re-found AFTER the wait
    }

    @AfterMethod(alwaysRun = true)
    public void quit() {
        if (driver != null) {
            driver.quit();
        }
    }
}
\`\`\`

- **\`ordersAppearOnlyAfterLoading\`** — no spinner wait at all: \`#orders-loaded\` is created only when the data arrives, so waiting for its text is complete and race-free. The regex documents the format; the assertion checks the value.
- **\`rewardCanBeClaimedOnceEnabled\`** — asserts the precondition first (the button is visible but disabled for ~5 s), so a regression where it is enabled immediately is caught, then \`clickable\` = visible + enabled.
- **\`refreshedPricesAreReadFromTheNewList\`** — "Refresh prices" swaps the list for a spinner and builds a new \`<ul>\` after ~1 s. Waiting on \`#price-list\` presence would pass on the **old** list. The change of \`#last-refreshed\` happens in the same task as the re-render, so after it the new rows exist; they are located after the wait, never before (which would give \`StaleElementReferenceException\`).

## Diagnosing a TimeoutException

\`\`\`
org.openqa.selenium.TimeoutException: Expected condition failed: element By.id: orders-loaded to be visible
 [url: http://localhost:5180/practice-site/waits.html] (tried for 10 second(s) with 250 milliseconds interval)
Build info: version: '4.x', ...
Driver info: org.openqa.selenium.chrome.ChromeDriver
Capabilities {browserName: chrome, browserVersion: ..., pageLoadStrategy: normal, timeouts: {implicit: 0, ...}}
Session ID: 3f2a...
    at org.openqa.selenium.support.ui.FluentWait.timeoutException(FluentWait.java:...)
    at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:...)
    at com.shopeasy.framework.wait.Waiter.until(Waiter.java:52)
    at com.shopeasy.pages.OrdersPage.loadedText(OrdersPage.java:31)
Caused by: org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element:
 {"method":"css selector","selector":"#orders\\-loaded"}
\`\`\`

A reading order that finds the cause in under a minute:

1. **The expectation line** — what were we waiting for, on which URL? A wrong URL means the previous step failed (login redirect, error page), not this wait.
2. **The \`Caused by\`** — the last ignored exception. \`NoSuchElementException\` = never in the DOM (wrong locator, wrong frame/window, feature not rendered). No cause at all = the element was found but the condition stayed false (hidden, disabled, wrong text) — the screenshot shows which. \`StaleElementReferenceException\` = continuous re-rendering (a polling widget or an infinite loop in the app).
3. **\`timeouts: {implicit: ...}\`** in the capabilities — a non-zero implicit wait explains odd durations.
4. **"tried for"** versus wall-clock time in the report — a big gap means an implicit wait, a slow condition (many \`findElements\` + \`getText\` per poll over a remote Grid) or a hung command.
5. **The screenshot + page source at the moment of timeout** — taken by the failure listener before teardown. Compare what the user would have seen with what you waited for.

Then decide: product bug (the state never came — file it with the screenshot), test bug (wrong condition or locator), or environment (slow grid — check whether many tests time out at the same minute). Raising the timeout is the right fix only in the third case, and only via configuration.

## Playwright (TypeScript) contrast

Playwright performs **actionability checks** before every action (attached, visible, stable — not animating, receives events — not covered, enabled) and **web-first assertions** (\`await expect(locator).toHaveText(...)\`) retry until their timeout. Most of this lesson's custom conditions — \`stoppedMoving\`, "not covered", "re-find every poll" — are built in, because a Playwright \`Locator\` is re-resolved on every attempt.

\`\`\`ts
await page.locator('#load-data-btn').click();
await expect(page.locator('#orders-loaded')).toHaveText(/Loaded \\d+ orders/);
\`\`\`

Explicit synchronization is still needed for app semantics (a count reaching a value, a background job finishing): \`expect.poll\` / \`toPass\`. Details in \`pw-deep-locators-actionability-timeouts\`.

## Best practices for experienced engineers

- Implicit wait 0, page-load timeout 30–60 s, script timeout left at 30 s unless you use \`executeAsyncScript\`.
- Wait for the **user-visible end state**; capture "before" values for change detection; assert preconditions so a wait cannot pass vacuously.
- Prefer locator-based conditions; element-based ones only for nodes that are never re-rendered.
- Ignore only \`NotFoundException\` and \`StaleElementReferenceException\` during polling.
- Every custom condition has a \`toString()\` or the wait a \`withMessage\`; stateful conditions are created per wait.
- Timeouts are named and configured centrally; log elapsed wait times and review the slowest waits like any other performance budget.
- Never "fix" a flaky test by raising a timeout before reading the screenshot and the cause.

## Interview questions

### Q: Where does an implicit wait run, and where does an explicit wait run?
**Short answer (30–60 s):** An implicit wait is a session timeout stored in the driver; the driver retries each Find Element command until it matches or the timeout expires, while the Java thread is blocked in one HTTP call. An explicit wait is a loop in the Java client: evaluate the condition (ordinary WebDriver commands), check the deadline, sleep the polling interval, repeat. That is why explicit waits can wait for any condition and implicit waits only for presence.

**Detailed answer:** \`implicitlyWait\` sends the W3C Set Timeouts command with the \`implicit\` key; it affects every element lookup, including child and shadow-root lookups and \`findElements\` (which then waits the full timeout before returning empty). \`FluentWait.until\` evaluates the function, returns on a non-null, non-FALSE result, records ignored exceptions, checks \`end.isBefore(clock.instant())\` after the evaluation and sleeps via an injectable \`Sleeper\`. The driver is unaware of explicit waits. Consequence: explicit waits cost one round trip (or more) per poll — on a remote Grid with 100 ms latency, a condition that does \`findElements\` plus \`getText\` on 20 elements is 2 s per poll, which is why heavy conditions should use one \`executeScript\` or a smarter locator.

### Q: Implicit wait 10 s, WebDriverWait 15 s, the element never appears. How long does the test wait, and why?
**Short answer (30–60 s):** Around 20 seconds, not 15. Each poll's findElement blocks in the driver for 10 s; the explicit wait checks its deadline only between polls: poll 1 ends at 10 s (deadline not passed), sleep 0.5 s, poll 2 ends at 20.5 s, then it times out — while the message still says "tried for 15 seconds".

**Detailed answer:** The real duration is roughly the explicit timeout rounded up to the next multiple of (implicit timeout + polling). Absence checks are worse: \`invisibilityOfElementLocated\` on a missing element costs the full implicit timeout even though it succeeds. The Selenium documentation warns not to mix them for exactly this reason. Fix: implicit wait 0 in the driver factory; for a legacy suite, a scoped helper that sets implicit to zero for absence checks and restores the previous value read via \`getImplicitWaitTimeout()\` in \`finally\`.

### Q: What does elementToBeClickable actually check?
**Short answer (30–60 s):** Only that the element is displayed and enabled. It does not check that it is in the viewport, not animating or not covered by another element — so ElementClickInterceptedException can still happen right after it returns.

**Detailed answer:** It is \`visibilityOfElementLocated\` followed by \`isEnabled()\`. \`isDisplayed\` evaluates CSS display/visibility/opacity and size via the "is displayed" atom; \`isEnabled\` is about the \`disabled\` state of form controls — a \`<div>\` styled as disabled with \`aria-disabled\` is "enabled". The driver's Element Click does the hit test: scroll into view, in-view centre point, topmost element. For overlays, wait for the overlay to disappear or wait for the end state; for animations, a "stopped moving" condition; for custom disabled widgets, wait on the attribute (\`aria-disabled\` = \`false\`). Playwright's actionability checks include stability and "receives events", which is the contrast interviewers look for.

### Q: Why does a WebDriverWait sometimes fail immediately with StaleElementReferenceException instead of timing out?
**Short answer (30–60 s):** Because \`WebDriverWait\` ignores only \`NotFoundException\` by default; stale is not a subclass. An element-based condition such as \`visibilityOf(element)\` holding a reference to a re-rendered node throws stale on the first poll, and the wait rethrows it.

**Detailed answer:** Fixes in order: use the locator-based variant, which re-finds every poll (most of them also catch stale internally); if you must pass an element (shadow DOM), wrap with \`ExpectedConditions.refreshed(...)\` or add \`ignoring(StaleElementReferenceException.class)\` — though a reference that is permanently stale will then just time out, so re-finding is the real fix. Design-wise, a framework \`Waiter\` ignores both \`NotFoundException\` and stale centrally and page objects pass \`By\`, not elements.

### Q: How do you write a custom wait condition, and what makes a good one?
**Short answer (30–60 s):** A \`Function<WebDriver, T>\` (lambda or \`ExpectedCondition\`) that re-finds what it needs, returns null/false for "not yet" and a useful value for "done", ignores only transient exceptions, and has a readable description via \`toString()\` or \`withMessage\`.

**Detailed answer:** Watch the return rule: any non-null non-FALSE value ends the wait, so returning \`""\` or \`0\` means success. Stateful conditions (count stable for N polls, element stopped moving) keep counters in fields and must be created per wait. Keep each poll cheap — one \`executeScript\` that returns a small object beats ten element round trips on a Grid. Make it testable: \`FluentWait\` accepts a \`Clock\` and \`Sleeper\`, so the helper can be unit-tested without a browser.

### Q: When would you use Awaitility instead of WebDriverWait?
**Short answer (30–60 s):** For conditions that are not about the browser: a database row, a message on a queue, an API status, a file on disk. Awaitility gives the same polling semantics with a fluent DSL, \`untilAsserted\` for assertion-style waits, and works with any \`Callable\`.

**Detailed answer:** \`FluentWait\` can technically wait on any input type, and some teams standardise on it to avoid a dependency. Awaitility adds conveniences: \`ignoreExceptions\`, \`pollDelay\` vs \`pollInterval\`, Fibonacci/iterative poll intervals, \`conditionEvaluationListener\` for logging, and \`untilAsserted(() -> assertThat(...))\` that reports the last assertion failure on timeout. A hybrid ShopEasy test that places an order in the UI and waits for the order-service to mark it \`SHIPPED\` should poll the API with Awaitility, not refresh the UI in a loop.

### Q: What are page-load strategies, and does EAGER make tests faster?
**Short answer (30–60 s):** NORMAL waits for the load event (readyState complete), EAGER for DOMContentLoaded (interactive), NONE returns immediately. EAGER can speed up pages with slow third-party assets, but only if the tests already wait for specific elements; otherwise it creates flakiness.

**Detailed answer:** None of them knows about SPA data loading after \`load\`, and none applies to client-side route changes. EAGER is a reasonable optimisation when ads, chat widgets or big images delay \`load\` and the framework has disciplined explicit waits; NONE is for specialised cases (measuring, interacting during load). The page-load **timeout** (spec default 300 s) is the other half — lower it so a hung navigation fails fast.

### Q: How do you wait for "AJAX complete"?
**Short answer (30–60 s):** Preferably you don't: wait for the UI state the request produces. Framework hooks such as \`jQuery.active\` or Angular testabilities are a legacy fallback, and Resource Timing / BiDi network events are a coarse "settled" heuristic.

**Detailed answer:** "No pending requests" is neither necessary nor sufficient: render happens after the response, polling requests never end, \`fetch\` is invisible to jQuery, and a framework migration silently breaks the hook. Waiting for "Loaded 42 orders" is app-agnostic and checks the outcome. If the team needs a global settle step (e.g. before visual screenshots), combine readyState complete + resource count stable + no spinner visible, and keep functional waits element-specific.

## Scenario-based questions

### Scenario 1: the suite got 2.5× slower after "fixing flakiness"
A teammate added \`implicitlyWait(10s)\` to \`BaseTest\`; the nightly went from 18 to 45 minutes and some negative tests now time out at 20 s. **Reasoning:** absence checks (\`invisibilityOf\`, \`findElements(...).isEmpty()\`, "error banner not shown") now cost 10 s each, and explicit waits overshoot. **Action:** grep for absence checks and count them to explain the slowdown with numbers; remove the implicit wait; for the original flaky tests, read their screenshots — they need specific explicit waits (most were clicking during a spinner); add a static check (ArchUnit or a simple grep in CI) that forbids \`implicitlyWait\` outside the driver factory.

### Scenario 2: TimeoutException on the checkout total only on the Grid
\`waitForTotal()\` times out in 1 of 30 runs on the Selenium Grid, never locally. **Reasoning:** read the message and cause first. If the cause is \`NoSuchElementException\` and the screenshot shows the login page — the session expired; environment. If no cause and the screenshot shows the right total — the condition is wrong (e.g. \`textToBe\` with non-breaking spaces or a currency format from a different locale on the node). If the screenshot shows a spinner — the backend was slow; check whether other tests timed out at the same minute. **Action:** fix the specific cause; only if it is genuine slowness on the shared environment, raise the configured "slow" timeout for that step and record the decision.

### Scenario 3: designing waits for an infinite-scroll product list
There is no "no more" marker and items load as you scroll. **Reasoning:** you need a stopping rule: scroll (wheel API), wait for the count to increase *or* to stay stable for N polls, stop after a max number of iterations or when the target product appears. **Action:** a loop with a per-iteration \`countStableFor\` wait (stateful condition created per iteration), a hard cap, and logging of counts; and ask the developers for a test hook or an API to fetch the list, because a stability heuristic is inherently a trade-off between speed and certainty.

## Tricky follow-ups

- **Q: Does an implicit wait apply to \`findElements\`?** Yes — it waits the full timeout when nothing matches and returns as soon as at least one element matches (so it does not wait for "all" items).
- **Q: Your condition returns an empty string when the label is blank. What happens?** The wait ends immediately with success — only null and \`Boolean.FALSE\` mean "keep polling". Return null instead.
- **Q: What is the default timeout of \`new FluentWait<>(driver)\`?** 500 ms, with 500 ms polling — always call \`withTimeout\`.
- **Q: Can \`invisibilityOfElementLocated\` pass too early?** Yes — before the spinner appears it is already true. Wait for appearance first or for the end state.
- **Q: Is a stateful condition object reusable across waits?** No — its counters carry over. Create it per \`until\` call via a factory method.`,
  keyPoints: [
    'Implicit wait is a driver-side session timeout for element lookups only; explicit waits are a client-side FluentWait loop that can wait for anything.',
    'Mixing them overshoots explicit timeouts (10 s implicit + 15 s explicit ≈ 20 s) and makes every absence check cost the full implicit timeout — keep implicit at 0.',
    'FluentWait: deadline checked after each evaluation, only null/FALSE means "not yet", the last ignored exception becomes the cause; WebDriverWait ignores NotFoundException but not stale.',
    'Locator-based ExpectedConditions re-find every poll; element-based ones hold a reference and fail on re-render. elementToBeClickable = displayed + enabled, not "not covered".',
    'Custom conditions re-find, return null for "not yet", have a toString(), and stateful ones (count stable, stopped moving) are created per wait.',
    'Page-load strategies and readyState do not cover SPA data loading; app-agnostic UI end-state waits beat jQuery/Angular idle hooks.',
    'Centralise waits in a Waiter with configured timeouts, withMessage context, logging and rethrow; diagnose timeouts from message, cause, URL and screenshot before touching timeouts.',
  ],
  mistakes: [
    'Returning an empty string, 0 or an empty list from a custom condition to mean "not yet" — the wait succeeds instantly. Fix: return null (or false); add a unit test with a fake Clock/Sleeper.',
    'Passing a WebElement to visibilityOf/textToBePresentInElement for a node the SPA re-renders, then seeing StaleElementReferenceException thrown straight out of the wait. Fix: use the ...Located(By) variant or ignore stale centrally in the Waiter.',
    'Treating elementToBeClickable as a guarantee that click() will work, then getting ElementClickInterceptedException under an overlay. Fix: read "Other element would receive the click", wait for that overlay to disappear or for the end state, and add a stopped-moving wait for animations.',
    'Waiting for spinner invisibility immediately after the click — it passes before the spinner appears. Fix: wait for the end-state element/text, or appear-then-disappear with a short tolerant first phase.',
    'Raising timeouts to fix a TimeoutException without reading it. Fix: read the expectation and URL, the Caused by (absent vs present-but-false), the implicit value in the capabilities and the screenshot; only environment slowness justifies a configured timeout change.',
    'Leaving the page-load timeout at the 5-minute spec default, so a hung navigation blocks a CI agent. Fix: set pageLoadTimeout to 30–60 s in the driver factory.',
  ],
  tryIt: `Against \`http://localhost:5180/practice-site/waits.html\`: (1) build the \`Waiter\` and \`ShopConditions\` classes above in a small TestNG project; (2) write a unit test for \`Waiter\` without a browser — a \`FluentWait\` over a plain \`AtomicInteger\` input with a fake \`java.time.Clock\` you advance inside a custom \`Sleeper\` — proving that a condition returning \`""\` succeeds immediately and one returning null times out with your message; (3) prove the implicit/explicit overshoot: set implicit to 5 s, wait 7 s for \`#does-not-exist\`, and log the real elapsed time; (4) section 1: wait for \`#auto-banner\` with presence and record how long it took; (5) section 6: use \`textChangedFrom\` on \`#last-refreshed\`, then show that holding a \`#price-list\` element from before the click and calling \`visibilityOf\` on it throws stale; (6) section 7: click "Load more" once and use \`countStableFor\` on \`#review-feed .feed-item\` — then explain in a comment why the explicit end signal would be the better choice for the full flow.`,
  problems: ['sel-008', 'sel-026', 'sel-027', 'sel-041'],
}
