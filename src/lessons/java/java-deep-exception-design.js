export default {
  slug: 'java-deep-exception-design',
  category: 'java',
  order: 17,
  title: 'Deep dive: exception handling design for automation frameworks',
  minutes: 30,
  summary: 'Design the exception strategy of a test framework — Throwable internals and stack-trace cost, checked versus unchecked, finally and try-with-resources edge cases, chaining instead of swallowing, a custom AutomationException hierarchy with diagnostic messages, the Selenium exception taxonomy, retry policies with backoff, assertions versus exceptions, logging and TestNG failure listeners — and read any stack trace with Caused by and Suppressed sections.',
  manualAnalogy: `A good manual bug report is not "checkout broken". It says what you did, on which page, what you expected, what you saw, and attaches a screenshot — and it separates "the product is wrong" from "the test environment was down". It also does not re-raise the same bug three times under different names. A framework's exception design is that discipline in code: one clear failure, with its context and its original cause, classified so the reader knows instantly whether to blame the app, the test or the environment.`,
  body: `## Where the earlier lessons stop

The *Exceptions* lesson covered try/catch/finally, the basic hierarchy, try-with-resources and a first custom exception. Problem java-040 wraps a \`TimeoutException\` without losing its cause, and the *Functional programming* deep dive built a \`retry\` helper with a retryable predicate. This lesson is about **design**: what the JVM does when you throw, what the edge cases of \`finally\` and try-with-resources are, how to build an exception hierarchy for a framework, how to classify and retry Selenium failures, and how to make every failure in a 2,000-test nightly run diagnosable from the report alone.

## The Throwable hierarchy and what it means

\`\`\`
Throwable                          (checked, but never catch or extend directly)
├── Error                          (unchecked) — the JVM or the test harness is in trouble
│   ├── AssertionError             ← every failed TestNG/JUnit/AssertJ assertion
│   ├── OutOfMemoryError, StackOverflowError      (VirtualMachineError)
│   ├── NoClassDefFoundError, ExceptionInInitializerError  (LinkageError)
└── Exception                      (checked)
    ├── IOException, InterruptedException, URISyntaxException ...
    └── RuntimeException           (unchecked)
        ├── IllegalArgumentException, IllegalStateException, NullPointerException ...
        └── org.openqa.selenium.WebDriverException  (all Selenium exceptions)
\`\`\`

- **Checked** = \`Throwable\` and its subclasses **except** \`RuntimeException\`, \`Error\` and their subclasses. The compiler forces callers to catch or declare them.
- Checked-ness is a **compile-time** concept only. The JVM does not know about it: bytecode can throw any \`Throwable\` from any method (Kotlin, Lombok's \`@SneakyThrows\` and generic "sneaky throw" tricks rely on this). That is why a lambda in a library can surface an \`IOException\` that no signature declares.
- \`Error\` signals conditions a normal application should not try to handle. The one an SDET meets daily is **\`AssertionError\`** — it is an \`Error\`, not an \`Exception\`, with consequences covered below.
- \`ExceptionInInitializerError\` / \`NoClassDefFoundError\` pair: a static initializer of a page or config class threw once (e.g. missing \`config.properties\`), and every later use reports \`NoClassDefFoundError: Could not initialize class ConfigReader\` — the real cause is only in the **first** failure of the run.

## Checked versus unchecked: the debate and a senior position

| | Checked | Unchecked |
|---|---|---|
| Idea | the caller can reasonably recover and must decide | programming error or unrecoverable condition |
| Advantages | visible in the signature, compiler-enforced handling | no signature pollution, works through lambdas and streams |
| Disadvantages | leaks implementation (\`throws SQLException\` from a page object), forces wrapping in lambdas, encourages empty catches | easy to forget to document; callers may not know what to expect |
| Ecosystem | JDK I/O, reflection, \`InterruptedException\` | Selenium, Spring, Jackson (\`JsonProcessingException\` is the exception — it is checked), most modern libraries |

**Senior position for a test framework:** framework exceptions are **unchecked** (extend \`RuntimeException\`). A test cannot "recover" from a missing element or a 500 — it must fail with a clear message — and checked exceptions would force \`throws Exception\` onto every step definition and page method. Use a **checked** exception only at a boundary where the caller genuinely chooses between alternatives — e.g. a \`TestDataSource.tryReserveUser()\` that may legitimately find the pool exhausted and the caller decides to wait or pick another pool. Convert checked JDK exceptions at the boundary: \`IOException\` → \`UncheckedIOException\` or a \`TestDataException\`, always passing the cause.

## What happens at runtime

### Throwing and unwinding

\`throw e\` compiles to the \`athrow\` bytecode. Each method has an **exception table**: ranges of bytecode, a handler address and the caught type. The JVM looks up the current method's table for a range covering the current instruction whose type is a supertype of the thrown object. If none matches, the frame is popped (**stack unwinding**) and the search continues in the caller, until a handler is found or the thread's uncaught-exception handler runs. Locals of popped frames become unreachable; nothing like C++ destructors runs — cleanup happens only in \`finally\` and try-with-resources, which javac compiles into the handlers (the \`finally\` body is **duplicated** into every exit path: normal, each \`catch\`, and a catch-all handler that rethrows).

### Stack-trace capture cost

The expensive part of an exception is not \`throw\` but **construction**: \`Throwable\`'s constructor calls \`fillInStackTrace()\`, which walks the thread's stack and records it in a native-friendly form. The \`StackTraceElement[]\` array (class, method, file, line) is materialised lazily when \`getStackTrace()\` or \`printStackTrace()\` is called. Cost grows with stack depth — and test frameworks have deep stacks (TestNG → reflection → Cucumber → step → page object → Selenium → HTTP client), often 100+ frames.

Consequences:

- Exceptions for **control flow** in hot loops are slow: a \`findElements\`-based "is present" check is cheaper than \`findElement\` + \`catch (NoSuchElementException)\` inside a polling loop — although the WebDriver round trip still dominates.
- You can opt out for exceptions that are pure signals: the protected constructor \`Throwable(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace)\` with \`writableStackTrace = false\`, or overriding \`fillInStackTrace()\` to return \`this\`. Never do this for exceptions that end up in a report — the trace is the diagnosis.
- HotSpot's \`OmitStackTraceInFastThrow\`: after an implicit exception (NPE, \`ArrayIndexOutOfBounds\`, \`ClassCastException\`) is thrown many times from the same compiled code, the JIT may throw a **preallocated instance with no stack trace and no message**. In a long nightly run you see a bare \`java.lang.NullPointerException\` with nothing below it. Add \`-XX:-OmitStackTraceInFastThrow\` to the Surefire \`argLine\` and look for the **first** occurrence in the log.

## try / catch / finally: edge cases interviewers love

\`\`\`java
public class FinallyEdgeCases {

    static int returnInFinally() {
        try {
            throw new IllegalStateException("checkout failed");
        } finally {
            return 1;                  // the exception is DISCARDED; caller gets 1
        }
    }

    static int finallyChangesLocal() {
        int x = 10;
        try {
            return x;                  // value 10 is evaluated and saved now
        } finally {
            x = 20;                    // too late: the method still returns 10
        }
    }

    static StringBuilder finallyMutatesObject() {
        StringBuilder sb = new StringBuilder("a");
        try {
            return sb;                 // the reference is saved...
        } finally {
            sb.append("b");            // ...but the object it points to can still change: "ab"
        }
    }

    static void exceptionInFinally() {
        try {
            throw new IllegalStateException("primary: element not found");
        } finally {
            throw new RuntimeException("cleanup: screenshot failed"); // replaces the primary, which is LOST
        }
    }

    public static void main(String[] args) {
        System.out.println(returnInFinally());        // 1
        System.out.println(finallyChangesLocal());    // 10
        System.out.println(finallyMutatesObject());   // ab
        try { exceptionInFinally(); }
        catch (RuntimeException e) { System.out.println(e.getMessage()); } // cleanup: screenshot failed
    }
}
\`\`\`

**Step by step**

- A \`return\` (or \`break\`/\`continue\`/\`throw\`) in \`finally\` **completes abruptly** and overrides whatever the try or catch was doing — including a pending exception. javac warns with \`-Xlint:finally\` ("finally clause cannot complete normally"); turn that lint on.
- The return value is evaluated **before** \`finally\` runs; for primitives and immutable objects \`finally\` cannot change it, for mutable objects it can change the contents.
- An exception thrown from \`finally\` replaces the primary one. This is exactly what happens in hand-written teardown: \`driver.quit()\` throws because the session already died, and the report shows the quit error instead of the real test failure. try-with-resources fixes this with suppressed exceptions.

**When \`finally\` does not run:** \`System.exit()\` or \`Runtime.halt()\` in the try block (the JVM starts shutting down; \`exit\` runs shutdown hooks, \`halt\` does not), the JVM crashes or is killed (\`kill -9\`, CI agent timeout), the thread loops or blocks forever, or the thread is a daemon thread still running when the JVM exits. Practical lesson: a CI job killed by timeout leaves browsers and Grid sessions open — clean up with Grid session timeouts and container teardown, not only with \`finally\`.

## try-with-resources internals

### What javac generates

\`\`\`java
try (A a = openA(); B b = openB()) {
    body();
}
\`\`\`

is compiled to roughly:

\`\`\`java
A a = openA();
Throwable primary = null;
try {
    B b = openB();               // if this throws, only a is closed
    try {
        body();
    } catch (Throwable t) {
        primary = t; throw t;
    } finally {
        // close b: if primary != null and close throws, primary.addSuppressed(closeException)
    }
} finally {
    // close a in the same way
}
\`\`\`

Rules that follow:

1. Resources are closed in **reverse order of declaration** (B before A) — like nested try blocks.
2. Resources are closed **before** any \`catch\` or \`finally\` block attached to the same \`try\` runs. In the catch block the resource is already closed.
3. If the body throws and \`close()\` throws too, the close exception is attached to the primary via **\`addSuppressed\`**; the primary propagates. If only \`close()\` throws, its exception propagates.
4. A \`null\` resource is allowed and simply not closed.
5. Since Java 9 an **effectively final** variable can be used directly: \`try (session) { ... }\`.

### Complete example: a WebDriver session and a log stream as resources

The Selenium 4 \`WebDriver\` interface does not extend \`AutoCloseable\`, so wrap it:

\`\`\`java
package com.shopeasy.framework;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ResourceDemo {

    /** Makes a WebDriver usable in try-with-resources; quit() ends the browser session. */
    public record DriverSession(WebDriver driver) implements AutoCloseable {
        @Override
        public void close() {
            driver.quit();
        }
    }

    public static void main(String[] args) {
        Path log = Path.of("target", "steps.log");
        try (DriverSession session = new DriverSession(new ChromeDriver());
             BufferedWriter steps = Files.newBufferedWriter(log)) {          // closed FIRST

            WebDriver driver = session.driver();
            driver.get("http://localhost:5180/practice-site/login.html");
            steps.write("opened login page");
            steps.newLine();
            driver.findElement(By.id("user-name")).sendKeys("standard_user");
            driver.findElement(By.id("does-not-exist")).click();             // throws NoSuchElementException

        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write step log " + log, e);
        } catch (RuntimeException e) {
            // Here BOTH resources are already closed: the browser is gone.
            for (Throwable s : e.getSuppressed()) {
                System.err.println("Suppressed during close: " + s);
            }
            throw e;
        }
    }
}
\`\`\`

**Step by step**

- \`DriverSession\` is a record implementing \`AutoCloseable\` — two lines that guarantee \`quit()\` even when the test throws.
- \`steps\` is declared second, so it is closed first, then the browser quits.
- If \`quit()\` throws (the session already died — a \`WebDriverException\`), that exception is **suppressed** under the \`NoSuchElementException\`, so the report still shows the real failure and the close problem below it as \`Suppressed:\`.
- The catch block cannot take a screenshot — the browser is already closed. That is why, in frameworks, screenshots are taken in a TestNG listener **before** teardown, not in a catch around try-with-resources.
- In a TestNG suite the driver lifecycle normally belongs to \`@BeforeMethod\`/\`@AfterMethod\` (with a \`ThreadLocal\` for parallel runs); try-with-resources fits utilities and short-lived resources: file writers, \`Files.lines\` streams, JDBC connections, a secondary browser in one test.

| Cleanup approach | Advantages | Disadvantages | When to use |
|---|---|---|---|
| \`finally\` | works for anything | exception in \`finally\` hides the primary; easy to forget null checks | non-closeable cleanup steps |
| try-with-resources | correct order, suppressed exceptions, concise | needs \`AutoCloseable\`; resource closed before catch runs | files, streams, connections, wrapped sessions |
| TestNG \`@AfterMethod(alwaysRun = true)\` | lifecycle-wide, can see \`ITestResult\` | not tied to a code block | the WebDriver per test |

## Multi-catch and precise rethrow (Java 7)

\`\`\`java
try {
    reserveTestUser();
} catch (TimeoutException | StaleElementReferenceException e) {   // one handler for two unrelated types
    throw new ElementStateException("User grid did not settle", e);
}
\`\`\`

The alternatives in a multi-catch must not be subclasses of each other (\`catch (NoSuchElementException | WebDriverException e)\` is a compile error — the second already covers the first), and the parameter is implicitly \`final\`. Its static type is the **closest common supertype**.

**More precise rethrow:** if a catch parameter is effectively final and you rethrow it, the compiler knows it can only be one of the checked exceptions the try block actually throws:

\`\`\`java
void loadFixture(Path p) throws IOException {        // not "throws Exception"
    try {
        Files.readString(p);
    } catch (Exception e) {                          // e is effectively final
        log.warn("Fixture load failed: {}", p, e);
        throw e;                                     // compiler knows: only IOException (or unchecked)
    }
}
\`\`\`

## Chaining, wrapping, swallowing, logging

Wrap when you **add information** or **translate to your abstraction level**: a page object should throw "Checkout total did not appear on overview page" with the Selenium \`TimeoutException\` as the cause, not leak raw driver details. Always pass the cause — \`new FrameworkException(msg, cause)\` — so the trace keeps the root failure. \`initCause\` exists for exception types without a cause constructor; it can be called only once.

| Anti-pattern | What you see | Why it hurts | Fix |
|---|---|---|---|
| Empty catch / swallow | test **passes** | defects hidden; later steps fail far from the cause | catch only what you can handle; otherwise let it propagate |
| \`catch (Exception e) { e.printStackTrace(); }\` | trace in stdout, test continues | not in the report, test continues in a broken state | rethrow or fail; log with the logger |
| Wrap without cause: \`new RuntimeException(e.getMessage())\` | short trace ending in your code | original stack and type lost | \`new XException(msg, e)\` |
| Log and rethrow at every layer | the same trace 4 times in the log | noise, misleading counts | log once, at the boundary (listener) — or add context by wrapping, not by logging |
| \`throw new RuntimeException(e)\` with no message | "RuntimeException: java.io.IOException: ..." | no context: which file, which user | message with what/where/expected/actual |
| Catching \`Throwable\`/\`Error\` in helpers | assertion failures retried or swallowed | \`AssertionError\` and \`OutOfMemoryError\` treated as transient | catch the narrowest types |
| \`return null\` on failure | NPE three steps later | failure point lost | throw, or return \`Optional\` for genuine absence |
| Exceptions for normal flow | slow polling loops, noisy traces | stack capture cost | \`findElements(...).isEmpty()\`, explicit waits |

## Designing a custom hierarchy for a framework

### Goals

1. **Classify** failures so triage is instant: product defect, test-data problem, environment problem, contract change.
2. **Carry context**: what action, which locator, which page URL, expected vs actual, screenshot path, test name.
3. **Stay small**: a few meaningful types, not one per method.

\`\`\`
RuntimeException
└── AutomationException                (base: context map, formatted message)
    ├── PageLoadException              (page did not reach ready state / wrong URL or title)
    ├── ElementStateException          (element missing, not clickable, stale after retries)
    ├── TestDataException              (fixture missing, user pool empty, CSV invalid)
    ├── ApiContractException           (status/schema/field mismatch from an API)
    └── EnvironmentException           (Grid unavailable, API health check failed)
\`\`\`

### Complete example

\`\`\`java
package com.shopeasy.framework.errors;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class AutomationException extends RuntimeException {

    private final Map<String, Object> context;

    protected AutomationException(String what, Map<String, Object> context, Throwable cause) {
        super(format(what, context), cause);
        this.context = Collections.unmodifiableMap(new LinkedHashMap<>(context));
    }

    public Map<String, Object> context() {
        return context;
    }

    private static String format(String what, Map<String, Object> context) {
        StringBuilder sb = new StringBuilder(what);
        context.forEach((k, v) -> sb.append(System.lineSeparator()).append("  ").append(k).append(": ").append(v));
        return sb.toString();
    }

    /** Fluent builder so call sites stay readable. */
    public static final class Context {
        private final Map<String, Object> values = new LinkedHashMap<>();

        public static Context of() { return new Context(); }

        public Context with(String key, Object value) {
            if (value != null) values.put(key, value);
            return this;
        }

        Map<String, Object> values() { return values; }
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.errors;

public class ElementStateException extends AutomationException {
    public ElementStateException(String what, AutomationException.Context ctx, Throwable cause) {
        super(what, ctx.values(), cause);
    }
}

// PageLoadException, TestDataException, ApiContractException and EnvironmentException follow the same shape.
\`\`\`

Using it in a page object for ShopEasy's checkout overview:

\`\`\`java
package com.shopeasy.pages;

import com.shopeasy.framework.errors.AutomationException.Context;
import com.shopeasy.framework.errors.ElementStateException;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.math.BigDecimal;
import java.time.Duration;

public class CheckoutOverviewPage {
    private static final By TOTAL = By.id("summary-total");
    private final WebDriver driver;
    private final ScreenshotService screenshots;   // framework class: capture(name) returns the saved file path

    public CheckoutOverviewPage(WebDriver driver, ScreenshotService screenshots) {
        this.driver = driver;
        this.screenshots = screenshots;
    }

    public BigDecimal total() {
        try {
            String text = new WebDriverWait(driver, Duration.ofSeconds(10))
                    .until(ExpectedConditions.visibilityOfElementLocated(TOTAL))
                    .getText();                                       // e.g. "Total: $51.25"
            return new BigDecimal(text.replaceAll("[^0-9.]", ""));
        } catch (TimeoutException e) {
            throw new ElementStateException("Order total not visible on checkout overview",
                    Context.of()
                            .with("locator", TOTAL)
                            .with("expected", "visible within 10 s")
                            .with("url", driver.getCurrentUrl())
                            .with("screenshot", screenshots.capture("checkout-total-missing")),
                    e);
        }
    }
}
\`\`\`

The failure in the report reads:

\`\`\`
com.shopeasy.framework.errors.ElementStateException: Order total not visible on checkout overview
  locator: By.id: summary-total
  expected: visible within 10 s
  url: http://localhost:5180/practice-site/checkout.html
  screenshot: target/screenshots/checkout-total-missing-1732101234.png
    at com.shopeasy.pages.CheckoutOverviewPage.total(CheckoutOverviewPage.java:31)
    ...
Caused by: org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of
  element located by By.id: summary-total (tried for 10 second(s) with 500 milliseconds interval)
    ...
\`\`\`

**Step by step**

- The base class formats the message once, from an **ordered** map, so every framework failure looks the same in Allure/Extent and in CI logs.
- \`with\` skips nulls: a failed screenshot must never cause a second exception while building the first.
- The context map is also exposed via \`context()\` so a listener can attach fields to the report as structured data.
- The class name tells triage the category; the cause keeps the Selenium detail.
- Taking a screenshot **inside** the page object is a choice; many teams take it centrally in the failure listener instead (shown below) so page objects stay free of reporting concerns — pick one place, not both.

| Hierarchy design | Advantages | Disadvantages | When to use |
|---|---|---|---|
| Only JDK/Selenium exceptions | zero code | no classification, messages lack context | tiny suites |
| One \`FrameworkException\` | simple, consistent messages | triage still needs reading the text | small frameworks |
| Small hierarchy by **failure category** (above) | instant triage, listeners can route (e.g. EnvironmentException → mark run unstable) | some design upfront | team frameworks — recommended |
| One exception per page/action | very specific | explosion of classes, nobody catches them individually | avoid |

**Recommended:** a small category-based hierarchy, unchecked, with a mandatory cause constructor and structured context. Catch them by category only where behaviour differs (the listener, the retry policy); everywhere else let them propagate.

## The Selenium exception taxonomy

All Selenium exceptions extend \`WebDriverException\` (unchecked). Several intermediate types matter for catching: \`NoSuchElementException\`, \`NoSuchWindowException\` and \`NoSuchFrameException\` extend \`NotFoundException\`; \`ElementClickInterceptedException\` extends \`ElementNotInteractableException\`, which extends \`InvalidElementStateException\`.

| Exception | Typical cause | Fix |
|---|---|---|
| \`NoSuchElementException\` | wrong locator; element not rendered **yet**; inside an iframe or shadow root | verify locator in DevTools; explicit wait; \`switchTo().frame\`; \`getShadowRoot()\` |
| \`StaleElementReferenceException\` | DOM node replaced after you found it (re-render, list refresh, navigation) | re-locate after the change; store \`By\`, not \`WebElement\`; wait for the old element's \`stalenessOf\` then find again |
| \`ElementClickInterceptedException\` | another element covers the click point: spinner overlay, cookie banner, sticky header, animation | wait for overlay \`invisibilityOf\`; dismiss banner; scroll into view; never "fix" with a JS click if a user would be blocked too |
| \`ElementNotInteractableException\` | element present but hidden, zero size, or disabled for input | wait for visibility/enabled; interact with the visible proxy element (custom dropdowns) |
| \`TimeoutException\` | explicit wait condition never became true | read the message (condition + duration) and the **cause**; check if the condition is right, not only the timeout |
| \`NoSuchWindowException\` / \`NoSuchFrameException\` | window closed, wrong handle, frame not yet loaded, wrong context after previous switch | \`numberOfWindowsToBe\`, \`frameToBeAvailableAndSwitchToIt\`, \`switchTo().defaultContent()\` |
| \`InvalidSelectorException\` | syntactically invalid CSS/XPath, or XPath returning non-elements (\`/text()\`) | fix the selector; never retry |
| \`SessionNotCreatedException\` | browser/driver version mismatch, Grid has no matching node, bad capabilities | Selenium Manager / driver version, Grid capacity and capabilities; **environment** failure |
| \`WebDriverException\` (generic) | driver crashed, connection refused, session deleted, unknown errors | check driver logs, Grid logs, browser crash; often environmental |

Import trap: \`org.openqa.selenium.NoSuchElementException\` versus \`java.util.NoSuchElementException\` (thrown by \`Optional.orElseThrow()\`, iterators and \`getFirst()\`). Catching the wrong one compiles and catches nothing. Read imports in review.

Also note \`WebDriverWait\` ignores \`NotFoundException\` by default (so \`NoSuchElementException\` during polling is expected), and when it times out the last ignored exception is attached as the **cause** of the \`TimeoutException\` — the most useful line in the trace.

## Retry design

### What to retry

| Retry | Do not retry |
|---|---|
| \`StaleElementReferenceException\` after a known re-render | \`AssertionError\` — the product returned a wrong value |
| \`ElementClickInterceptedException\` caused by an animation or transient overlay | \`InvalidSelectorException\`, \`NoSuchElementException\` from a wrong locator |
| HTTP 502/503/504, connection reset, Grid "no slot yet" at session start | HTTP 4xx (except 429 with \`Retry-After\`) |
| eventual consistency: order appears in \`/api/orders\` a moment after POST | \`TestDataException\`, configuration errors |

The rule: retry **transient causes in the environment**, at the **smallest scope** (one action or one call), a **bounded** number of times, and **log every retry**. Retrying a whole test hides product defects and flakiness.

### A generic retry helper with exponential backoff and exception filtering

\`\`\`java
package com.shopeasy.framework.retry;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ThreadLocalRandom;

public final class RetryPolicy {
    private static final Logger log = LoggerFactory.getLogger(RetryPolicy.class);

    private final int maxAttempts;
    private final Duration initialDelay;
    private final Duration maxDelay;
    private final List<Class<? extends Exception>> retryOn;

    @SafeVarargs
    public RetryPolicy(int maxAttempts, Duration initialDelay, Duration maxDelay,
                       Class<? extends Exception>... retryOn) {
        if (maxAttempts < 1) throw new IllegalArgumentException("maxAttempts must be >= 1");
        this.maxAttempts = maxAttempts;
        this.initialDelay = initialDelay;
        this.maxDelay = maxDelay;
        this.retryOn = List.of(retryOn);
    }

    public <T> T call(String description, Callable<T> action) {
        Exception last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return action.call();
            } catch (Exception e) {                              // AssertionError (an Error) is never caught here
                if (!isRetryable(e)) throw propagate(e);
                last = e;
                if (attempt == maxAttempts) break;
                Duration delay = backoff(attempt);
                log.warn("Retry {}/{} for '{}' in {} ms after {}", attempt, maxAttempts - 1,
                        description, delay.toMillis(), e.toString());
                sleep(delay);
            }
        }
        throw new RetryExhaustedException(description + " failed after " + maxAttempts + " attempts", last);
    }

    private boolean isRetryable(Exception e) {
        return retryOn.stream().anyMatch(type -> type.isInstance(e));
    }

    /** initial * 2^(attempt-1), capped, with "full jitter" so parallel threads do not retry in lock-step. */
    private Duration backoff(int attempt) {
        long exp = initialDelay.toMillis() * (1L << Math.min(attempt - 1, 20));
        long capped = Math.min(exp, maxDelay.toMillis());
        return Duration.ofMillis(ThreadLocalRandom.current().nextLong(capped / 2, capped + 1));
    }

    private static RuntimeException propagate(Exception e) {
        return e instanceof RuntimeException re ? re : new RetryExhaustedException("Non-retryable checked exception", e);
    }

    private static void sleep(Duration d) {
        try {
            Thread.sleep(d.toMillis());
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();                  // keep TestNG timeOut working
            throw new IllegalStateException("Interrupted during retry backoff", ie);
        }
    }

    public static final class RetryExhaustedException extends RuntimeException {
        public RetryExhaustedException(String message, Throwable cause) { super(message, cause); }
    }
}
\`\`\`

Usage:

\`\`\`java
RetryPolicy uiTransient = new RetryPolicy(3, Duration.ofMillis(200), Duration.ofSeconds(2),
        StaleElementReferenceException.class, ElementClickInterceptedException.class);

uiTransient.call("add Pulse Bike Light to cart",
        () -> { driver.findElement(By.id("add-to-cart-pulse-bike-light")).click(); return null; });
\`\`\`

**Step by step**

- \`Callable\` allows checked exceptions, and the catch is \`Exception\`, so \`AssertionError\` passes straight through: a wrong value is never retried.
- \`retryOn\` is an **allow-list** of types; \`isInstance\` respects subclasses.
- Backoff doubles per attempt (200, 400, 800 ms…), capped, with jitter: in a parallel run ten threads hitting a struggling server should not all retry at the same millisecond.
- Non-retryable exceptions are rethrown **unchanged** (no extra wrapping noise); exhaustion wraps the **last** exception as cause.
- Each retry is logged with attempt count and cause, so flakiness stays visible in the logs and can be counted.
- The *Functional programming* deep dive shows a simpler predicate-based variant; this one adds backoff and type filtering.

### The alternatives

\`\`\`java
// TestNG IRetryAnalyzer — re-runs the WHOLE test method
public class RetryOnEnvironmentFailure implements IRetryAnalyzer {
    private int count;
    @Override
    public boolean retry(ITestResult result) {
        return count++ < 1 && result.getThrowable() instanceof EnvironmentException;  // never on AssertionError
    }
}
// @Test(retryAnalyzer = RetryOnEnvironmentFailure.class)

// Awaitility — polls until an assertion passes (non-UI, eventual consistency)
await().atMost(Duration.ofSeconds(10)).pollInterval(Duration.ofMillis(500))
       .untilAsserted(() -> assertEquals(orderStatus(orderId), "PLACED"));

// Selenium FluentWait — polls a UI condition and ignores listed exceptions while polling
new FluentWait<>(driver)
        .withTimeout(Duration.ofSeconds(10))
        .pollingEvery(Duration.ofMillis(250))
        .ignoring(StaleElementReferenceException.class)
        .withMessage("cart badge never showed 1")
        .until(d -> d.findElement(By.cssSelector(".shopping-cart-badge")).getText().equals("1"));
\`\`\`

| | Custom \`RetryPolicy\` | TestNG \`IRetryAnalyzer\` | Awaitility | FluentWait \`ignoring\` |
|---|---|---|---|---|
| Scope | one action / call | whole test method (setup + all steps) | one condition or assertion | one UI condition |
| How it works | loop, type allow-list, backoff | TestNG re-invokes the method after failure | polls a callable/assertion with timeout | polls \`Function<WebDriver,T>\`, swallows listed exceptions |
| Advantages | precise, logs each retry, backoff | zero change to test code, catches environment blips | expressive, handles assertions, great for async back ends | built into Selenium, readable |
| Disadvantages | you own the code | hides flaky tests and real bugs; retried attempts recorded as skipped and can confuse reports; side effects repeated | extra dependency; not for UI actions | UI only; fixed polling interval |
| Performance | minimal overhead | expensive: full rerun incl. browser | polling cost only | polling cost only |
| When to use | known transient action/HTTP failures | **environment** failures only, max 1 retry, with flaky-test tracking | API/DB/email eventual consistency | waiting for UI state |

**Recommended:** prevent first (correct waits make most "retries" unnecessary), then retry at the smallest scope: FluentWait/WebDriverWait for UI state, Awaitility for back-end eventual consistency, a \`RetryPolicy\` for known transient actions and HTTP 5xx. Use \`IRetryAnalyzer\` only for classified environment failures, once, and publish a flaky-test list so retries do not become permanent.

## Assertions versus exceptions

\`AssertionError extends Error\`. Consequences:

- \`catch (Exception e)\` does **not** catch failed assertions — good: a cleanup or retry wrapper written with \`Exception\` will not swallow test failures.
- \`catch (Throwable t)\` **does** — a "robust" helper that catches \`Throwable\` will retry or swallow assertion failures. Code review red flag.
- TestNG reports \`AssertionError\` as **FAILED**; other exceptions are also FAILED, but the type helps triage: assertion = product behaviour differs; exception = the test could not get to the check. A configuration method (\`@BeforeMethod\`) that throws makes the dependent tests **SKIPPED**, which dashboards often under-report.
- Java's \`assert\` keyword also throws \`AssertionError\` but only with \`-ea\`; never use it for test checks.

**Soft assertions** collect failures instead of throwing at the first one: TestNG \`SoftAssert\` (call \`assertAll()\` at the end, or nothing is reported), AssertJ \`SoftAssertions.assertSoftly(softly -> { ... })\` (reports automatically). Use them for independent checks on one screen (all four summary fields of the overview page), never for preconditions — and never inside a retry loop, where collected failures from earlier attempts leak into the final result.

## Logging exceptions properly

\`\`\`java
// Wrong: loses the stack trace — only the message survives
log.error("Order placement failed: " + e.getMessage());

// Right: message with context, throwable as the LAST argument, no placeholder for it
log.error("Order placement failed for user {} and product {}", userId, productId, e);
\`\`\`

SLF4J (1.6+) treats a \`Throwable\` passed as the last argument as the exception to print with its full stack trace, even after placeholder arguments. Rules: log **or** rethrow, not both at every layer; add context by wrapping; log at the boundary — the TestNG listener — once per failure; never log secrets (tokens, passwords) from request bodies in exception messages.

## Global handling with a TestNG listener

\`\`\`java
package com.shopeasy.framework.listeners;

import com.shopeasy.framework.DriverManager;
import com.shopeasy.framework.errors.AutomationException;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testng.ITestListener;
import org.testng.ITestResult;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

public class FailureListener implements ITestListener {
    private static final Logger log = LoggerFactory.getLogger(FailureListener.class);

    @Override
    public void onTestFailure(ITestResult result) {
        Throwable failure = result.getThrowable();
        String test = result.getTestClass().getName() + "." + result.getMethod().getMethodName();

        String screenshot = captureScreenshot(test);              // must never throw
        log.error("FAILED {} | root cause: {} | screenshot: {}", test, rootCause(failure), screenshot, failure);

        if (failure instanceof AutomationException ae) {
            ae.context().forEach((k, v) -> result.setAttribute("ctx." + k, v));   // for the report
        }
        result.setAttribute("screenshot", screenshot);
    }

    static String rootCause(Throwable t) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable current = t;
        while (current.getCause() != null && seen.add(current)) {   // guard against cause cycles
            current = current.getCause();
        }
        return current.getClass().getSimpleName() + ": " + current.getMessage();
    }

    private String captureScreenshot(String test) {
        try {
            WebDriver driver = DriverManager.current();             // ThreadLocal<WebDriver> per test thread
            if (driver == null) return "n/a (no driver)";
            Path target = Path.of("target", "screenshots", test + "-" + System.currentTimeMillis() + ".png");
            Files.createDirectories(target.getParent());
            Files.write(target, ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES));
            return target.toString();
        } catch (IOException | RuntimeException e) {               // the listener must not mask the test failure
            log.warn("Screenshot failed for {}", test, e);
            return "n/a (" + e.getClass().getSimpleName() + ")";
        }
    }
}
\`\`\`

**Step by step:** \`onTestFailure\` is notified after the test method fails and, in TestNG's usual ordering, before the test's \`@AfterMethod\` quits the driver, so the browser state is still there (verify once on your TestNG version: if screenshots come back as "Session ID is null", capture in \`@AfterMethod\` with an \`ITestResult\` parameter before \`quit()\` instead); the root cause is computed by walking \`getCause()\` with an identity set (cause cycles are rare but possible with badly written wrappers); the screenshot step catches everything because a listener exception must never replace the real failure; context fields from \`AutomationException\` become report attributes. Register with \`@Listeners(FailureListener.class)\`, in \`testng.xml\` under \`<listeners>\`, or via \`META-INF/services/org.testng.ITestNGListener\` for every suite.

## Reading a long stack trace

\`\`\`
com.shopeasy.framework.errors.ElementStateException: Order total not visible on checkout overview
  locator: By.id: summary-total
  url: http://localhost:5180/practice-site/checkout.html
    at com.shopeasy.pages.CheckoutOverviewPage.total(CheckoutOverviewPage.java:31)
    at com.shopeasy.tests.CheckoutTest.totalIncludesTax(CheckoutTest.java:58)
    at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
    at org.testng.internal.invokers.MethodInvocationHelper.invokeMethod(MethodInvocationHelper.java:139)
    ...
    Suppressed: org.openqa.selenium.WebDriverException: Session timed out or not found
        at com.shopeasy.framework.ResourceDemo$DriverSession.close(ResourceDemo.java:19)
        ... 3 more
Caused by: org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of element
located by By.id: summary-total (tried for 10 second(s) with 500 milliseconds interval)
    at org.openqa.selenium.support.ui.WebDriverWait.timeoutException(WebDriverWait.java:84)
    at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)
    at com.shopeasy.pages.CheckoutOverviewPage.total(CheckoutOverviewPage.java:27)
    ... 25 more
Caused by: org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element:
{"method":"css selector","selector":"#summary-total"}
    ...
\`\`\`

How to read it:

1. **First line**: the outermost exception and its message — the framework's summary.
2. **Your frames**: scan for your package (\`com.shopeasy\`) — the first one is where your code was when it failed; skip JDK reflection and TestNG frames.
3. **\`Suppressed:\`** (indented) — exceptions from \`close()\` in try-with-resources; secondary, usually cleanup noise, but a hint (here: the session had already timed out, which may explain the missing element).
4. **\`Caused by:\`** — each wrapped cause, outermost first; the **last** \`Caused by\` is the root cause. Here: the element was never in the DOM, so the question becomes "did the page navigate to step two at all?", not "is 10 seconds enough?".
5. **\`... 25 more\`** — those frames are identical to the enclosing trace's bottom frames and are omitted, not lost.

Interesting detail in the last line: the W3C WebDriver protocol has no "id" strategy, so Selenium 4 sends \`By.id\` as a CSS selector — the error shows \`css selector\` even though you wrote \`By.id\`. (Line numbers in the sample are illustrative.)

## Common mistakes and debugging

- **Test is green but the feature is broken.** Search for empty catches and \`catch (Exception e) { log... }\` without rethrow; enable a static-analysis rule (Sonar/PMD "empty catch block", "avoid catching generic exception").
- **Report shows \`NoClassDefFoundError: Could not initialize class ConfigReader\` for 300 tests.** Scroll to the first failure of the run: it is an \`ExceptionInInitializerError\` with the real cause (missing file, bad property). Replace throwing static initialisers with lazy, explicit loading that throws a \`TestDataException\` with the path.
- **Failure shows "Session ID is null" / \`NoSuchSessionException\` instead of the real error.** Teardown or a listener used a quit driver and the cleanup exception replaced the primary. Make cleanup non-throwing, use try-with-resources or \`@AfterMethod(alwaysRun = true)\` with its own try/catch.
- **A retry wrapper turns a 2-second assertion failure into a 2-minute one.** It catches \`Throwable\` or retries \`NoSuchElementException\` from a wrong locator. Narrow the retryable types; never retry \`AssertionError\`.
- **\`TimeoutException\` message is all you look at.** Read its \`Caused by\`: the last ignored exception tells you whether the element was missing, stale or intercepted.
- **Bare \`java.lang.NullPointerException\` with no trace late in the run.** Fast-throw optimisation; add \`-XX:-OmitStackTraceInFastThrow\` and find the first occurrence.

## Best practices for experienced engineers

- Unchecked framework exceptions, a small category hierarchy, a mandatory cause, structured context (what, where, expected vs actual, URL, screenshot).
- Translate exceptions at layer boundaries (driver → page object → step) by **wrapping with context**, never by losing the cause.
- Catch the narrowest type, only where you can act. Let everything else reach TestNG.
- Never catch \`Throwable\`/\`Error\` in helpers; keep \`AssertionError\` out of retry and cleanup paths.
- Cleanup must not throw over the primary failure: try-with-resources, suppressed exceptions, guarded listeners.
- Retry only transient, classified failures at the smallest scope, with backoff, jitter, logging and a cap; track flaky tests instead of hiding them.
- Log once, at the boundary, with the throwable as the last SLF4J argument.
- Turn on \`-Xlint:finally\` and static-analysis rules for empty catches and generic catches.

## Interview questions

### Q: Checked or unchecked exceptions for a test framework — what is your position?

**Short answer (30–60 s):** Unchecked for framework exceptions. Tests cannot recover from a missing element or a 500; they should fail with a clear message, and checked exceptions would spread \`throws Exception\` through every page object, step and lambda. I convert checked JDK exceptions at the boundary, keeping the cause, and use checked ones only where a caller genuinely chooses an alternative.

**Detailed answer:** Checked exceptions encode "the caller can recover and must decide". In a framework the only decision for most failures is "fail this test with good diagnostics", which the test runner already does. Checked types also fight lambdas (\`Supplier\` cannot throw them) and leak implementation details through signatures. The trade-off: unchecked exceptions are invisible in signatures, so document them (\`@throws\` in Javadoc) and give them meaningful names. A legitimate checked case: \`UserPool.tryReserve()\` throwing \`PoolExhaustedException\` where the caller can wait or choose another environment.

### Q: What exactly does try-with-resources do, and what are suppressed exceptions?

**Short answer (30–60 s):** It calls \`close()\` on each declared resource in reverse order, even if the body throws, before any catch or finally of that statement runs. If both the body and \`close()\` throw, the body's exception propagates and the close exception is attached with \`addSuppressed\`, visible in the trace as \`Suppressed:\` and through \`getSuppressed()\`.

**Detailed answer:** Before Java 7, a \`finally\` that called \`close()\` would replace the primary exception if \`close()\` threw — in test terms, "quit failed" hiding "checkout failed". javac now generates the nested try/finally logic and the suppression. Null resources are skipped; since Java 9 effectively final variables can be listed. For WebDriver I wrap it in a small \`AutoCloseable\` record, but for the per-test driver I use \`@AfterMethod(alwaysRun = true)\` because screenshots must be taken before close, in the failure listener.

### Q: What does \`return\` inside \`finally\` do? When does \`finally\` not run?

**Short answer (30–60 s):** It overrides the try's return value **and discards any pending exception** — the failure disappears. \`finally\` does not run when the JVM exits (\`System.exit\`, \`halt\`), crashes or is killed, when the thread never leaves the try, or for daemon threads at JVM exit.

**Detailed answer:** \`finally\` completing abruptly (return, throw, break) replaces the try/catch outcome. The return value of the try is evaluated before \`finally\`, so changing a local primitive in \`finally\` does not affect it, but mutating a returned object does. \`-Xlint:finally\` warns. In CI, a job killed on timeout runs no \`finally\` — so browsers and Grid sessions leak; that's why Grid session timeouts and container-level cleanup matter.

### Q: How do you design a custom exception hierarchy for an automation framework?

**Short answer (30–60 s):** One unchecked base, \`AutomationException\`, with a few category subclasses — page load, element state, test data, API contract, environment — each requiring a cause and carrying structured context: action, locator, URL, expected vs actual, screenshot path. Categories drive triage and behaviour, like retrying only environment failures.

**Detailed answer:** I keep it shallow because nobody catches 30 specific types; the value is in classification and message quality. The base formats the message consistently and exposes the context for listeners to attach to reports. Page objects translate Selenium exceptions into these with the original as cause. The listener routes by type: \`EnvironmentException\` marks the run unstable and may trigger one rerun; \`ApiContractException\` notifies the API team; \`AssertionError\` is a product defect candidate.

### Q: Walk me through the Selenium exceptions you see most and how you fix each.

**Short answer (30–60 s):** \`NoSuchElementException\` — wrong locator, timing, frame or shadow root; \`StaleElementReferenceException\` — the DOM node was replaced, re-locate; \`ElementClickInterceptedException\` — overlay or animation, wait for it to disappear; \`ElementNotInteractableException\` — hidden or disabled; \`TimeoutException\` — read its cause; \`SessionNotCreatedException\` — driver/browser/Grid mismatch, an environment issue.

**Detailed answer:** The key senior points are hierarchy and classification. \`ElementClickInterceptedException\` is a subclass of \`ElementNotInteractableException\`, so catch order matters. \`WebDriverWait\` ignores \`NotFoundException\` and attaches the last ignored exception as the timeout's cause. \`InvalidSelectorException\` is a test bug — never retried. \`SessionNotCreatedException\` and generic \`WebDriverException\`s like connection refused are environment failures — they should be classified as such so they do not count as product defects. And watch the \`java.util.NoSuchElementException\` import trap.

### Q: When should a test retry, and how would you implement it?

**Short answer (30–60 s):** Only for transient, classified causes — stale elements after a known re-render, intercepted clicks during animation, HTTP 502/503, eventual consistency — at the smallest scope, bounded, with backoff and logging. Never for assertion failures or wrong locators. UI state: explicit/Fluent waits; back end: Awaitility; actions and HTTP: a small retry policy; whole-test retries only for environment failures, once, with flaky tracking.

**Detailed answer:** I implement a \`RetryPolicy\` with an allow-list of exception types, exponential backoff with jitter (so parallel threads do not synchronise their retries), a cap, interrupt handling and the last exception as cause on exhaustion. It catches \`Exception\`, so \`AssertionError\` passes through. \`IRetryAnalyzer\` reruns the whole method including side effects (orders placed twice) and hides flakiness; I allow it only with a type check on \`EnvironmentException\` and report every retried test.

### Q: Why does \`catch (Exception e)\` not catch a failed assertion, and why does that matter?

**Short answer (30–60 s):** Because \`AssertionError\` extends \`Error\`, not \`Exception\`. That is usually what you want: retry or cleanup wrappers catching \`Exception\` will not swallow test failures. A helper catching \`Throwable\` will, which is a bug.

**Detailed answer:** It also affects soft-assertion and polling designs: Awaitility's \`untilAsserted\` deliberately catches \`AssertionError\` while polling and rethrows the last one on timeout — correct there, because the assertion is the condition. In general code I treat \`catch (Throwable)\` as acceptable only in top-level infrastructure (a listener's screenshot step, a thread's run loop) where the code must never fail itself.

### Q: How do you log exceptions correctly with SLF4J?

**Short answer (30–60 s):** Pass the throwable as the last argument with no placeholder for it — \`log.error("Order failed for user {}", userId, e)\` — so the full stack trace is logged. Do not log only \`e.getMessage()\`, and do not log and rethrow at every layer.

**Detailed answer:** SLF4J recognises a trailing \`Throwable\` and prints its trace including causes and suppressed exceptions. Logging at each layer multiplies the same trace and misleads anyone counting errors; instead wrap with context while propagating and log once at the boundary — in a framework, the TestNG listener. Mask tokens and passwords that might appear in request bodies embedded in messages.

## Scenario-based questions

**1. The nightly run shows 140 failures, all \`NoClassDefFoundError: Could not initialize class com.shopeasy.config.ConfigReader\`.** I look for the first failure in the run, which will be an \`ExceptionInInitializerError\` — the static initializer threw once (missing \`qa.properties\` after a pipeline change, or a bad number format). Fix the config, then redesign: replace the static initializer with lazy loading that throws a \`TestDataException\` naming the missing file and the active environment, and add a pre-suite check (\`@BeforeSuite\`) so one clear failure stops the run instead of 140 confusing ones.

**2. A team added \`IRetryAnalyzer\` with 3 retries to every test; the pass rate went from 88% to 99%, and production escaped a checkout bug.** The bug produced an intermittent wrong total; the assertion failed once in three, and retries hid it. I would restrict the retry analyzer to \`EnvironmentException\` and \`SessionNotCreatedException\`, at most one retry, mark retried tests in the report, publish a weekly flaky list with owners, and move transient UI handling into waits and action-level retries. Present it with data: which tests were retried most and why.

**3. Failures in the report say only "Session ID is null. Using WebDriver after calling quit()?"** The real failure is masked: the test failed, \`@AfterMethod\` quit the driver, and then a listener or a reporting hook tried to take a screenshot, threw, and its exception became the visible one — or teardown order is wrong. I would move the screenshot into \`onTestFailure\` (runs before teardown), guard it with a catch-all that logs, and make teardown use try-with-resources or guarded cleanup so its exceptions are suppressed rather than replacing the primary.

## Tricky follow-ups

- **Q: Can you catch \`StackOverflowError\`?** Technically yes (it is a \`Throwable\`), but the state is unreliable; fix the recursion (often an \`equals\`/\`toString\` cycle or a page object calling itself) instead.
- **Q: Is \`InterruptedException\` safe to swallow in a wait helper?** No. Restore the flag with \`Thread.currentThread().interrupt()\` and stop; TestNG's \`timeOut\` and executors rely on it.
- **Q: What happens if a resource's constructor in try-with-resources throws?** That resource is not closed (it does not exist); resources declared before it are closed, in reverse order.
- **Q: Does \`e.printStackTrace()\` fail the test?** No. It writes to stderr; the test continues and may pass.
- **Q: Why might a \`TimeoutException\` from \`WebDriverWait\` have a \`NoSuchElementException\` cause?** Because the wait ignores \`NotFoundException\` during polling and attaches the last ignored exception to the timeout — read it to know why the condition never became true.`,
  keyPoints: [
    'AssertionError is an Error: catch (Exception) leaves test failures alone, catch (Throwable) swallows or retries them — a bug in helpers.',
    'Framework exceptions should be unchecked, category-based (page load, element state, test data, API contract, environment), always chained to the cause and carrying what/where/expected/actual/URL/screenshot.',
    'Exception construction captures the stack (fillInStackTrace) — costly in deep framework stacks; HotSpot fast-throw can drop traces (-XX:-OmitStackTraceInFastThrow).',
    'return or throw in finally discards the pending exception; finally does not run on System.exit, halt, crash or kill.',
    'try-with-resources closes in reverse order before catch/finally run and attaches close failures as suppressed exceptions instead of hiding the primary.',
    'Retry only classified transient failures at the smallest scope with backoff, jitter, a cap and logging; waits for UI state, Awaitility for eventual consistency, IRetryAnalyzer only for environment failures.',
    'Log once at the boundary (TestNG listener) with the throwable as the last SLF4J argument; take screenshots in onTestFailure before teardown.',
    'Read traces top-down for your frames, then follow Caused by to the last one (root cause); Suppressed shows cleanup failures; "... n more" are shared frames.',
  ],
  mistakes: [
    'Wrapping with new RuntimeException(e.getMessage()) — the root cause and its stack vanish. Fix: always use the (message, cause) constructor and add context to the message.',
    'A retry or wait helper that catches Throwable and retries AssertionError or NoSuchElementException from a wrong locator. Fix: allow-list transient exception types; let AssertionError and InvalidSelectorException through immediately.',
    'Teardown that throws over the real failure ("Session ID is null"). Fix: screenshot in onTestFailure before quit, guard cleanup with its own try/catch, use try-with-resources so close failures become suppressed.',
    'Adding a global IRetryAnalyzer with several retries to raise the pass rate, hiding intermittent product bugs. Fix: retry only EnvironmentException-class failures once, report retried tests and keep a flaky-test list.',
    'Logging and rethrowing at every layer, producing the same trace four times. Fix: wrap with context while propagating and log once in the listener with the throwable as the last argument.',
    'Catching java.util.NoSuchElementException instead of org.openqa.selenium.NoSuchElementException. Fix: check imports in review; the wrong catch compiles and catches nothing.',
  ],
  tryIt: `In a small TestNG project against ShopEasy (\`http://localhost:5180/practice-site/\`): (1) create \`AutomationException\` with a context builder and an \`ElementStateException\` subclass; (2) in a \`CheckoutOverviewPage.total()\` method, wait 3 s for a deliberately wrong id (\`summary-totals\`) and wrap the \`TimeoutException\` with locator, URL and expected state — confirm the report shows your message **and** a \`Caused by: ... NoSuchElementException\`; (3) write \`RetryPolicy\` with exponential backoff and jitter, retrying only \`StaleElementReferenceException\`, and prove with a unit test (a \`Callable\` that throws twice, then succeeds) that it calls three times, and that an \`AssertionError\` is thrown after one call; (4) wrap the driver in an \`AutoCloseable\` record whose \`close()\` throws after \`quit()\`, make the body throw too, and print \`getSuppressed()\`; (5) add a \`FailureListener\` that attaches a screenshot and the root cause.`,
  problems: ['java-013', 'java-014', 'java-040'],
}
