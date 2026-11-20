export default {
  slug: 'selenium-deep-framework-design',
  category: 'selenium',
  order: 18,
  title: 'Deep dive: Selenium-specific framework design — driver lifecycle, element and wait wrappers, listeners and decorators',
  minutes: 30,
  summary: 'Design the Selenium layer of a test framework like a senior — who owns the driver and for how long, options and capabilities for local, Grid and cloud, a thin action layer (UiActions vs element wrapper vs WebDriverListener + EventFiringDecorator vs AOP), listeners for logging, highlighting and timing, composition instead of a God BasePage, locator management, environment profiles, debuggability, a reference package structure, anti-patterns and a PR review checklist.',
  manualAnalogy: `An experienced manual tester has a personal routine for every action: wait until the page settles, click, note what happened, and take a screenshot when something looks wrong — and the bug report names the exact field and page. A Selenium framework layer is that routine written once, so a hundred tests behave the same way and every failure reads like a good bug report. Getting the design wrong is like a team where everyone has their own routine: the same bug looks different every time.`,
  body: `## Where the earlier lessons stop

The *Exceptions* lesson (lesson 8) showed how to read Selenium failures and the order of fixes; the *Browser options, screenshots, Grid and parallel runs* lesson (lesson 9) introduced options, screenshots on failure and a factory method. The deep dives went further: options and capabilities internals and the session lifecycle in \`selenium-deep-architecture\`, the \`Waiter\` component and custom conditions in \`selenium-deep-synchronization\`, the browser factory, \`DriverManager\` and thread-safe reporting in \`selenium-deep-parallel-execution\`, the evidence-collecting TestNG listener in \`selenium-deep-troubleshooting-flaky-tests\`, and the exception hierarchy and retry policy in \`java-deep-exception-design\`.

This lesson is about **design decisions in the Selenium layer**: the code between your page objects and \`WebDriver\`. Page Object Model variants and design patterns, Cucumber, TestNG/Maven setup and a full enterprise framework build have their own sections later in the handbook; here we stay with what is specific to Selenium.

\`\`\`
tests / step definitions          business intent: "add the backpack, expect badge 1"
   │
page objects + components         what the page offers (POM section)
   │
Selenium layer  ◄── this lesson   UiActions · Waiter · locators · listeners · evidence
   │
driver management                 DriverFactory · options/capabilities · DriverManager (lifecycle)
   │
WebDriver (W3C)                   ChromeDriver / RemoteWebDriver → driver → browser
\`\`\`

Each layer depends only on the one below. A test that calls \`driver.findElement\` skips two layers; a page object that builds \`ChromeOptions\` mixes three.

## Driver lifecycle management

### Who creates and who quits

One rule: **the code that creates the session is the code that quits it**, and it is test infrastructure (a base test, a TestNG listener, a Cucumber hook), never a page object or a step. Pages receive a driver; they do not own it. A page that calls \`driver.quit()\` (a "logout and close" helper) breaks the next step and every teardown that expects a live session.

### Session scope: per test, per class, per suite

| | Per test (\`@BeforeMethod\`) | Per class (\`@BeforeClass\`) | Per suite (\`@BeforeSuite\`) |
|---|---|---|---|
| Isolation | full: fresh profile, no cookies/storage | tests in a class share state | everything shares state |
| Speed | browser start each test (≈1–3 s local, more on Grid) | start once per class | start once |
| Failure blast radius | one test | a crashed browser fails the rest of the class | a crash or a stuck alert fails everything after it |
| Parallel fit | ideal (\`parallel="methods"\`) | only \`parallel="classes"\` | effectively sequential |
| Order dependence | none | creeps in ("test 3 works because test 2 logged in") | high |
| Debugging | reproducible alone | must run the class | must run the suite |

**Recommended approach and why:** **per test**. Browser start-up is rarely the dominant cost once login and data setup use fast paths (API login, storage or cookie seeding); the isolation, reproducibility and parallel safety are worth far more. Per-class sessions are an acceptable optimisation for a read-only class (e.g. 30 sorting/filtering checks on the product list) that runs with \`parallel="classes"\` — and then the class must reset state between tests explicitly.

### Browser reuse risks and how to reset

When you do reuse a session, everything a previous test left behind is still there: cookies, \`localStorage\`/\`sessionStorage\` (ShopEasy keeps its cart in \`sessionStorage\`), extra windows, an open alert, a half-filled form, a different window size, a focused iframe. A reset must be explicit:

\`\`\`java
public static void resetSession(WebDriver driver, String mainWindow, String baseUrl) {
    for (String handle : driver.getWindowHandles()) {               // close tabs opened by the last test
        if (!handle.equals(mainWindow)) {
            driver.switchTo().window(handle).close();
        }
    }
    driver.switchTo().window(mainWindow);
    driver.switchTo().defaultContent();                             // leave any iframe
    driver.get(baseUrl + "index.html");                             // be on the app's origin first
    driver.manage().deleteAllCookies();                             // cookies of the CURRENT domain only
    ((JavascriptExecutor) driver).executeScript(
            "window.localStorage.clear(); window.sessionStorage.clear();");   // current origin only
}
\`\`\`

- \`deleteAllCookies()\` and storage clearing act on the **current document's domain/origin**. A reset done on \`about:blank\` or on another domain (an SSO page, a payment iframe's origin) clears nothing useful — the classic "reuse worked locally, fails on staging with SSO" bug.
- Open alerts make every command throw \`UnhandledAlertException\`; HTTP-only cookies of third-party domains, service workers, IndexedDB and browser-level permissions survive. That residue is why per-test sessions are the default.

## Configuring drivers: options from configuration

Options internals (W3C keys vs vendor keys, \`asMap()\`) are in \`selenium-deep-architecture\`, and the browser enum/factory in \`selenium-deep-parallel-execution\`. The design question here is **where values come from** and how local, Grid and cloud differ.

**Configuration layering** (later wins): defaults in code → \`config/<env>.properties\` → environment variables (CI secrets) → \`-D\` system properties (one-off overrides). Load once into an immutable record and log the effective values at suite start (masking secrets).

\`\`\`java
package com.shopeasy.framework.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Properties;

public record UiConfig(String env, String baseUrl, String browser, boolean headless,
                       int width, int height, String gridUrl, String mobileDevice, boolean highlight) {

    public static UiConfig load() {
        String env = System.getProperty("env", "local");
        Properties p = new Properties();
        try (InputStream in = UiConfig.class.getResourceAsStream("/config/" + env + ".properties")) {
            if (in == null) throw new IllegalStateException("Missing config/" + env + ".properties for -Denv=" + env);
            p.load(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read config for env " + env, e);
        }
        return new UiConfig(env,
                value(p, "base.url", "http://localhost:5180/practice-site/"),
                value(p, "browser", "chrome"),
                Boolean.parseBoolean(value(p, "headless", "true")),
                Integer.parseInt(value(p, "window.width", "1366")),
                Integer.parseInt(value(p, "window.height", "768")),
                value(p, "grid.url", ""),
                value(p, "mobile.device", ""),
                Boolean.parseBoolean(value(p, "highlight", "false")));
    }

    /** -Dkey beats env var KEY_WITH_UNDERSCORES beats the properties file beats the default. */
    private static String value(Properties file, String key, String fallback) {
        String sys = System.getProperty(key);
        if (sys != null && !sys.isBlank()) return sys;
        String envVar = System.getenv(key.toUpperCase().replace('.', '_'));
        if (envVar != null && !envVar.isBlank()) return envVar;
        return file.getProperty(key, fallback);
    }
}
\`\`\`

**Local vs Grid vs cloud capabilities** — the same Options object, plus target-specific keys:

| Target | What changes | Example |
|---|---|---|
| Local | driver binary via Selenium Manager; local paths (downloads) | \`new ChromeDriver(options)\` |
| Grid | \`RemoteWebDriver\` + Grid URL; \`se:\` capabilities for labels/recording; \`LocalFileDetector\` for uploads | \`options.setCapability("se:name", testName)\` |
| Cloud vendor | vendor-prefixed options map with credentials, build and test name; vendor URL | \`options.setCapability("sauce:options", Map.of("build", buildId, "name", testName))\` — keys differ per vendor; read their docs |

Keep vendor-specific code in **one** class (\`CloudCapabilities\`), selected by configuration; credentials only from environment variables, never in properties files committed to git.

## The action layer: wrapping WebDriver calls

Every framework ends up wanting the same cross-cutting behaviour around element actions: **wait** for the right state, **log** the step, **time** it, collect **evidence** on failure, and turn raw exceptions into **meaningful messages**. There are four ways to attach that behaviour.

### Approach 1 — an explicit \`UiActions\` class

\`\`\`java
package com.shopeasy.framework.ui.actions;

import com.shopeasy.framework.ui.wait.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class UiActions {

    private static final Logger LOG = LoggerFactory.getLogger(UiActions.class);

    private final WebDriver driver;
    private final Waiter waiter;

    public UiActions(WebDriver driver, Waiter waiter) {
        this.driver = driver;
        this.waiter = waiter;
    }

    public void click(String name, By locator) {
        LOG.info("click '{}' {}", name, locator);
        try {
            waiter.clickable(locator).click();
        } catch (StaleElementReferenceException e) {
            LOG.debug("'{}' re-rendered between lookup and click - locating again once", name);
            waiter.clickable(locator).click();          // one re-locate, not a retry loop
        } catch (ElementClickInterceptedException | TimeoutException e) {
            throw new ElementActionException("click", name, locator, currentUrl(), e);
        }
    }

    public void type(String name, By locator, String text) {
        LOG.info("type '{}' into '{}'", text, name);
        enter(name, locator, text);
    }

    public void typeSecret(String name, By locator, String secret) {
        LOG.info("type ******** into '{}'", name);       // never log passwords or tokens
        enter(name, locator, secret);
    }

    public String text(String name, By locator) {
        String value = waiter.visible(locator).getText();
        LOG.debug("text of '{}' = '{}'", name, value);
        return value;
    }

    public void selectByValue(String name, By locator, String value) {
        LOG.info("select value '{}' in '{}'", value, name);
        new Select(waiter.visible(locator)).selectByValue(value);
    }

    public boolean isPresent(By locator) {
        return !driver.findElements(locator).isEmpty();   // no exception as control flow
    }

    private void enter(String name, By locator, String text) {
        try {
            WebElement field = waiter.visible(locator);
            field.clear();
            field.sendKeys(text);
        } catch (TimeoutException e) {
            throw new ElementActionException("type into", name, locator, currentUrl(), e);
        }
    }

    private String currentUrl() {
        try {
            return driver.getCurrentUrl();
        } catch (WebDriverException e) {
            return "unknown (" + e.getClass().getSimpleName() + ")";
        }
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.ui.actions;

import org.openqa.selenium.By;

public class ElementActionException extends RuntimeException {
    public ElementActionException(String action, String name, By locator, String url, Throwable cause) {
        super("Could not " + action + " '" + name + "' (" + locator + ") on " + url
                + " - " + cause.getClass().getSimpleName(), cause);
    }
}
\`\`\`

**Step by step**

- Every method takes a **business name** and a locator. The log reads "click 'Login button' By.id: login-button", and so does the exception — the report is readable without opening the code.
- Waiting is delegated to the \`Waiter\` from \`selenium-deep-synchronization\` (clickable = visible and enabled). \`UiActions\` does not invent its own timeouts.
- The stale-element branch **re-locates once** — a narrowly scoped, classified recovery, as \`java-deep-exception-design\` recommends. It is not "retry everything three times".
- \`ElementClickInterceptedException\` and \`TimeoutException\` are **wrapped with context and the cause**, never swallowed. An \`AssertionError\` or \`InvalidSelectorException\` passes through untouched.
- \`typeSecret\` exists because step logs end up in CI artefacts; a password in a log is a security finding.
- \`isPresent\` uses \`findElements\` — absence is a normal answer, not an exception. (If an implicit wait is configured, this blocks for its full duration on absence; another reason to keep implicit waits at zero.)

### Approach 2 — a custom element wrapper

\`\`\`java
package com.shopeasy.framework.ui.elements;

import com.shopeasy.framework.ui.wait.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** A named, lazily located element: re-finds itself on every action, so it never goes stale. */
public final class UiElement {

    private static final Logger LOG = LoggerFactory.getLogger(UiElement.class);

    private final WebDriver driver;
    private final Waiter waiter;
    private final String name;
    private final By locator;

    public UiElement(WebDriver driver, Waiter waiter, String name, By locator) {
        this.driver = driver;
        this.waiter = waiter;
        this.name = name;
        this.locator = locator;
    }

    public UiElement click() {
        LOG.info("click {}", this);
        waiter.clickable(locator).click();
        return this;
    }

    public UiElement type(String text) {
        LOG.info("type '{}' into {}", text, this);
        var field = waiter.visible(locator);
        field.clear();
        field.sendKeys(text);
        return this;
    }

    public String text() {
        return waiter.visible(locator).getText();
    }

    public boolean isPresent() {
        return !driver.findElements(locator).isEmpty();
    }

    public UiElement child(String childName, By childLocator) {   // scoped lookups, e.g. a product card
        return new UiElement(driver, waiter, name + " > " + childName, new org.openqa.selenium.support.pagefactory.ByChained(locator, childLocator));
    }

    @Override
    public String toString() {
        return "'" + name + "' (" + locator + ")";
    }
}
\`\`\`

A page then declares \`private final UiElement loginButton = new UiElement(driver, waiter, "Login button", By.id("login-button"));\` and calls \`loginButton.click()\`.

A variant **implements \`WebElement\`** (and \`WrapsElement\`) by delegating to a real element. It lets the wrapper flow into \`ExpectedConditions\` and \`Select\`, but you must implement every \`WebElement\` method (and the \`SearchContext\`/\`TakesScreenshot\` ones), the wrapped element still goes stale, and every Selenium upgrade that adds a method touches your class. The lazy, non-\`WebElement\` wrapper above is simpler and solves staleness by design.

### Approach 3 — \`WebDriverListener\` + \`EventFiringDecorator\` (Selenium 4)

Selenium 4 replaced the old \`EventFiringWebDriver\`/\`WebDriverEventListener\` pair with \`org.openqa.selenium.support.events.WebDriverListener\` (an interface whose methods are all \`default\` no-ops) and \`EventFiringDecorator<T extends WebDriver>\`. Both are annotated \`@Beta\` in the current API docs.

\`\`\`java
WebDriver original = DriverFactory.create(config, testName);
WebDriver driver = new EventFiringDecorator<>(new StepLoggingListener(original, config.highlight()))
        .decorate(original);
// hand "driver" to pages; keep "original" for casts and for the listener's own calls
\`\`\`

How it works internally: \`decorate\` returns a **dynamic proxy** that implements the same interfaces as the original driver (\`WebDriver\`, \`JavascriptExecutor\`, \`TakesScreenshot\`, …). Every call — on the driver and on elements, navigation, alerts, options, windows and frames it returns, which are decorated too — goes through the decorator, which fires \`beforeAnyCall\`, the specific \`beforeXxx\`, invokes the original, then \`afterXxx\` and \`afterAnyCall\`, or \`onError\` if the call threw. Consequences:

- The decorated driver **is not a \`ChromeDriver\`** or a \`RemoteWebDriver\`. \`(ChromeDriver) driver\` throws \`ClassCastException\`; code that needs the concrete class (CDP, session id, \`setFileDetector\`) must use the original reference.
- Listener methods run **synchronously on the test thread** — a slow listener slows every command; never block or do network I/O in it.
- Listeners **cannot change** arguments or results, nor prevent the call. Exceptions thrown by a listener are **suppressed** unless the listener overrides \`throwsExceptions()\` to return \`true\`. So a listener is for observation (logging, timing, highlighting), not for adding waits or recovery — use a \`WebDriverDecorator\` subclass or \`UiActions\` for behaviour changes.

Key hooks:

| Hook | Signature | Typical use |
|---|---|---|
| \`beforeAnyCall\` / \`afterAnyCall\` | \`(Object target, Method method, Object[] args)\` / \`(…, Object result)\` | timing of every command |
| \`onError\` | \`(Object target, Method method, Object[] args, InvocationTargetException e)\` | log the failed command with its arguments |
| \`beforeGet\` | \`(WebDriver driver, String url)\` | step log "open …" |
| \`beforeFindElement\` / \`afterFindElement\` | \`(WebDriver driver, By locator)\` / \`(…, WebElement result)\` | locator usage statistics |
| \`beforeClick\` / \`afterClick\` | \`(WebElement element)\` | step log, highlighting |
| \`beforeSendKeys\` | \`(WebElement element, CharSequence... keysToSend)\` | step log with masking |
| \`beforeAnyWebElementCall\` | \`(WebElement element, Method method, Object[] args)\` | generic element tracing |

### Approach 4 — AOP (AspectJ)

\`\`\`java
@Aspect
public class ClickTimingAspect {
    private static final Logger LOG = LoggerFactory.getLogger(ClickTimingAspect.class);

    @Around("call(void org.openqa.selenium.WebElement.click()) && within(com.shopeasy..*)")
    public Object timeClick(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            LOG.debug("click at {} took {} ms", pjp.getSourceLocation(), (System.nanoTime() - start) / 1_000_000);
        }
    }
}
\`\`\`

It needs AspectJ weaving — the \`aspectjweaver\` agent in the Surefire \`argLine\` (\`-javaagent:...\`) and an \`aop.xml\`, or compile-time weaving with a Maven plugin. Allure's AspectJ integration for \`@Step\` works this way, which is why many teams already have the agent configured.

### Comparison

| | UiActions class | UiElement wrapper | WebDriverListener + decorator | AOP |
|---|---|---|---|---|
| How it works | explicit helper called by pages | object per element with behaviour | proxy fires events around every call | bytecode weaving around join points |
| Advantages | explicit, debuggable, adds waits and recovery, business names | reads well (\`loginButton.click()\`), no staleness, names built in | catches **every** call (also direct \`driver\` use and third-party code); zero changes in pages | cross-cutting without touching code; very flexible pointcuts |
| Disadvantages | discipline: direct \`driver\` calls bypass it | another abstraction to learn; \`WebElement\`-implementing variants are brittle | observe-only; no business names (only locators); proxy breaks casts; \`@Beta\` | magic: build/agent setup, hard to debug, surprises newcomers |
| Performance | negligible | negligible | small per-call overhead; slow listeners hurt | negligible after weaving; agent start cost |
| Maintainability | high | high for lazy wrapper, low for \`WebElement\` implementation | high | low in most teams |
| Scalability | good | good | good | good if the team knows AOP |
| When to use | default action layer | teams that prefer element objects (often with a component model) | logging, timing, highlighting, locator stats, audit | when AOP is already in use (Allure \`@Step\`), for timing/metrics |

**Recommended approach and why:** a thin **\`UiActions\`** (or a lazy \`UiElement\` — pick one style per framework, not both) for behaviour: waits, business names, narrow recovery, meaningful exceptions. Add a **\`WebDriverListener\`** for observation that must see every command: timing, low-level tracing, highlighting in debug runs. Avoid AOP for Selenium behaviour unless the team already runs the weaver. Evidence on failure belongs to the TestNG listener (\`selenium-deep-troubleshooting-flaky-tests\`), which knows the **test** failed — a command-level \`onError\` fires for errors that the waits are expected to absorb.

## WebDriverListener in depth

\`\`\`java
package com.shopeasy.framework.listeners;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.Deque;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.events.WebDriverListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class StepLoggingListener implements WebDriverListener {

    private static final Logger LOG = LoggerFactory.getLogger("steps");
    private static final long SLOW_COMMAND_MS = 2_000;

    /** Start times of nested calls on this thread (driver.findElement inside element.click, etc.). */
    private static final ThreadLocal<Deque<Long>> STARTS = ThreadLocal.withInitial(ArrayDeque::new);
    /** Guards against re-entrance when the listener itself talks to the browser. */
    private static final ThreadLocal<Boolean> IN_LISTENER = ThreadLocal.withInitial(() -> false);

    private final WebDriver original;          // undecorated: calls on it fire no events
    private final boolean highlight;

    public StepLoggingListener(WebDriver original, boolean highlight) {
        this.original = original;
        this.highlight = highlight;
    }

    @Override
    public void beforeAnyCall(Object target, Method method, Object[] args) {
        STARTS.get().push(System.nanoTime());
    }

    @Override
    public void afterAnyCall(Object target, Method method, Object[] args, Object result) {
        logIfSlow(method);
    }

    @Override
    public void onError(Object target, Method method, Object[] args, InvocationTargetException e) {
        logIfSlow(method);
        LOG.debug("command {} failed: {}", method.getName(), e.getTargetException().toString());
    }

    @Override
    public void beforeGet(WebDriver driver, String url) {
        LOG.info("open {}", url);
    }

    @Override
    public void beforeClick(WebElement element) {
        LOG.info("click {}", describe(element));
        if (highlight) outline(element);
    }

    @Override
    public void beforeSendKeys(WebElement element, CharSequence... keysToSend) {
        String typed = isPasswordField(element) ? "********" : String.join("", keysToSend);
        LOG.info("type '{}' into {}", typed, describe(element));
    }

    private void logIfSlow(Method method) {
        Deque<Long> starts = STARTS.get();
        if (starts.isEmpty()) return;
        long ms = (System.nanoTime() - starts.pop()) / 1_000_000;
        if (ms > SLOW_COMMAND_MS) LOG.warn("slow command {} took {} ms", method.getName(), ms);
        if (starts.isEmpty()) STARTS.remove();
    }

    private void outline(WebElement element) {
        runQuietly(() -> ((JavascriptExecutor) original)
                .executeScript("arguments[0].style.outline='3px solid #f60'", element));
    }

    private boolean isPasswordField(WebElement element) {
        Boolean[] answer = {false};
        runQuietly(() -> answer[0] = "password".equals(element.getDomAttribute("type")));
        return answer[0];
    }

    /** RemoteWebElement.toString() includes the locator it was found by: "[[ChromeDriver: ...] -> id: login-button]". */
    private static String describe(WebElement element) {
        String s = element.toString();
        int arrow = s.lastIndexOf("-> ");
        return arrow >= 0 ? s.substring(arrow + 3, s.length() - 1) : s;
    }

    private void runQuietly(Runnable browserCall) {
        if (IN_LISTENER.get()) return;            // a call made from here must not re-enter the listener
        IN_LISTENER.set(true);
        try {
            browserCall.run();
        } catch (WebDriverException e) {
            LOG.debug("listener helper failed: {}", e.toString());   // never break the test from a listener
        } finally {
            IN_LISTENER.set(false);
        }
    }
}
\`\`\`

**Step by step**

- **Timing with a stack**: commands nest (a decorated \`element.click()\` may be preceded by \`findElement\` calls), so start times go on a per-thread \`Deque\`. A single \`long\` field would be overwritten by the nested call — and by other threads in a parallel run. \`onError\` pops too, because \`afterAnyCall\` is not called when the command throws.
- **Logging at INFO for user-visible steps** (open, click, type) and DEBUG for everything else keeps the step log readable; slow commands (> 2 s) are warnings worth aggregating across runs.
- **Masking** in \`beforeSendKeys\`: the listener sees raw keys, including passwords typed by pages that bypass \`typeSecret\`. Reading \`type\` from the element is a browser call, hence the guard.
- **Re-entrance guard**: whether the element passed to a hook is the decorated or the original object is an implementation detail; calling it, or the decorated driver, from inside a hook could fire events again. The listener uses the **original driver** and a \`ThreadLocal\` flag so its own helper calls cannot recurse, and swallows (logs) its own failures — a highlighting problem must never fail a test.
- **Highlighting** is for headed debug runs and demo recordings (\`-Dhighlight=true\`); it mutates the page style, so keep it off in CI where visual checks or screenshots are compared.
- **\`describe\`** relies on \`RemoteWebElement.toString()\`, which prints the driver and the "found by" locator. It is readable but not a contract; business names from \`UiActions\` remain the primary step description.

### Wiring it with the driver manager

\`\`\`java
WebDriver original = DriverFactory.create(config, testName);
WebDriver decorated = new EventFiringDecorator<>(new StepLoggingListener(original, config.highlight()))
        .decorate(original);
DriverManager.set(original, decorated);   // pages get decorated; session id, CDP and casts use original
\`\`\`

\`DriverManager.stop()\` quits through either reference (quit is forwarded) and removes **both** from its \`ThreadLocal\`.

## Avoiding the God BasePage

The most common design failure in Selenium frameworks is a \`BasePage\` with 120 methods: click, type, waits, scrolling, JS helpers, screenshots, alerts, frames, tables, date pickers, API calls and assertions — inherited by every page. Symptoms: every page "has" a date picker, nobody knows which helper to use, changing a wait breaks unrelated pages, and the class cannot be unit-tested.

**Composition instead of inheritance:**

\`\`\`java
package com.shopeasy.framework.pages;

import com.shopeasy.framework.ui.actions.UiActions;
import com.shopeasy.framework.ui.wait.Waiter;
import org.openqa.selenium.WebDriver;

/** Small on purpose: shared collaborators, nothing else. */
public abstract class BasePage {
    protected final WebDriver driver;
    protected final UiActions ui;
    protected final Waiter waiter;

    protected BasePage(WebDriver driver, UiActions ui, Waiter waiter) {
        this.driver = driver;
        this.ui = ui;
        this.waiter = waiter;
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.framework.pages.components;

import com.shopeasy.framework.ui.actions.UiActions;
import com.shopeasy.framework.ui.wait.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** The header appears on every shop page: a component, not BasePage methods. */
public final class HeaderComponent {
    private static final By CART_LINK = By.cssSelector("[data-testid='shopping-cart-link']");
    private static final By CART_BADGE = By.cssSelector("#shopping-cart-link [data-testid='shopping-cart-badge']");

    private final UiActions ui;
    private final Waiter waiter;

    public HeaderComponent(UiActions ui, Waiter waiter) {
        this.ui = ui;
        this.waiter = waiter;
    }

    public int cartCount() {
        return ui.isPresent(CART_BADGE) ? Integer.parseInt(ui.text("cart badge", CART_BADGE)) : 0;
    }

    public void expectCartCount(int expected) {
        waiter.until("cart badge to show " + expected,
                ExpectedConditions.textToBe(CART_BADGE, String.valueOf(expected)));
    }

    public void openCart() {
        ui.click("cart icon", CART_LINK);      // the icon link, not the plain "Cart" nav text link
    }
}
\`\`\`

Rules of thumb: the base class holds **collaborators**, not behaviour; a capability used by some pages (tables, date pickers, the header) becomes a **component** or helper object composed into those pages; technology helpers (JS, alerts, frames) live in \`UiActions\` or dedicated small classes. The POM and design-patterns section of the handbook builds pages, components, fluent navigation and factories on top of this.

## Locator management

| Option | How | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| \`By\` constants in the page/component | \`private static final By SORT = By.id("product-sort");\` | compile-checked, refactorable (IDE "find usages"), next to the behaviour that uses them, reviewable in the same PR | a UI change needs a code change (which needs a review — a feature) | default |
| External files (JSON/YAML/properties) | \`"login.username": "id=user-name"\` parsed at runtime | non-programmers can edit; one file per page | typos found only at runtime; no find-usages; dead keys accumulate; parsing code to maintain; the "editability" benefit rarely materialises | almost never; maybe a generated locator catalogue shared across languages |
| Enums | \`enum LoginLocators { USERNAME(By.id("user-name")) ... }\` | type-safe, enumerable (e.g. to validate all locators on a page) | separates locators from the page behaviour; another file per page | when you need to iterate over locators (smoke validation of a page) |
| \`@FindBy\` / PageFactory | annotated \`WebElement\` fields proxied lazily | concise | proxies re-find on each call but cached variants go stale; hides when lookups happen; annotation values must be constants | legacy code; the POM section discusses it |

**Recommended approach and why:** keep locators **in code**, as private \`By\` constants of the page or component that owns them — the locator and the behaviour change together, the compiler and the IDE help, and reviews see both. The goal "change locators without a release" is a symptom of a missing test-id contract with developers (\`data-testid\` attributes, see \`selenium-deep-locators-xpath-dynamic\`), not something a JSON file fixes.

Dynamic locators are **methods**, not string concatenation spread over tests:

\`\`\`java
private static By addToCart(String slug) {
    return By.cssSelector("[data-testid='add-to-cart-" + slug + "']");   // e.g. add-to-cart-trailblazer-backpack
}
\`\`\`

## Environment differences

| Concern | Design |
|---|---|
| headed vs headless | one flag (\`headless\`) from config; headed locally, headless on CI; identical window size in both, so layouts match |
| window size | always explicit (\`--window-size\` / \`setSize\`), from config; headless defaults are small and switch responsive sites to mobile layouts |
| mobile layouts | Chrome \`mobileEmulation\` (device metrics, user agent, touch) — Chromium-only; Firefox has no equivalent capability (resize + user-agent pref at most); real devices need Appium or a device cloud |
| feature flags | the environment's flag state is part of configuration; tests that need a flag declare it (group or annotation) and are skipped or targeted accordingly |
| base URLs, credentials | per environment config + environment variables for secrets |

\`\`\`java
ChromeOptions chrome = new ChromeOptions();
if (!config.mobileDevice().isBlank()) {
    chrome.setExperimentalOption("mobileEmulation", Map.of("deviceName", config.mobileDevice()));   // e.g. "Pixel 7"
} else {
    chrome.addArguments("--window-size=" + config.width() + "," + config.height());
}
\`\`\`

\`deviceName\` must match a device known to that Chrome version's DevTools list; for stable runs across Chrome updates, pass explicit \`deviceMetrics\` (width, height, pixelRatio) and a \`userAgent\` instead. Emulation changes viewport, user agent and touch events — not the rendering engine of mobile Safari, so it does not replace real-device testing.

**Feature flags and parallel runs:** flipping a global flag through an admin API in one test changes the application for **every** parallel test. Prefer per-user or per-session flag overrides (a cookie or header the app honours in test environments), or dedicated environments per flag state; otherwise run flag-flipping tests in a separate, sequential group.

## Logging, evidence and debuggability

- **Logging**: SLF4J API in framework code, Logback (or Log4j2) as backend, MDC with test name, thread and session id — the setup is in \`selenium-deep-parallel-execution\`. Selenium itself logs through \`java.util.logging\`; bridge it with \`jul-to-slf4j\` if you want one log, and raise \`org.openqa.selenium\` to \`FINE\` only when diagnosing the driver (see \`selenium-deep-architecture\`).
- **Evidence on failure**: screenshot, page source, URL, browser console log — captured in the TestNG \`onTestFailure\` listener while the session is still alive (\`selenium-deep-troubleshooting-flaky-tests\`). The Selenium layer contributes the **step log** that shows what happened before the failure.
- **Meaningful exceptions**: a failure should read like this —

\`\`\`
com.shopeasy.framework.ui.actions.ElementActionException: Could not click 'Add Trailblazer Backpack to cart'
  (By.cssSelector: [data-testid='add-to-cart-trailblazer-backpack']) on http://localhost:5180/practice-site/inventory.html
  - TimeoutException
Caused by: org.openqa.selenium.TimeoutException: Expected condition failed: element ... to be visible and enabled
  [url: http://localhost:5180/practice-site/inventory.html] (tried for 10 second(s) with 250 milliseconds interval)
\`\`\`

  — which page, which element by name and locator, which URL, which state was expected, the original cause.
- **\`toString\` of page objects and components**: \`InventoryPage[path=inventory.html]\` makes log lines and assertion messages self-describing. Do **not** call the browser in \`toString\` (\`getCurrentUrl()\`, \`getTitle()\`): debuggers and loggers call \`toString\` implicitly, which would fire WebDriver commands at surprising moments, slow logging and can throw with an alert open.
- **Step logging** at the right level: the business step (page method) at INFO, Selenium commands at DEBUG — a failed test's log should tell the story in 20 lines, with the detail available when needed.

## Reference folder structure (Selenium layer only)

\`\`\`
src/test/java/com/shopeasy/
├── framework/
│   ├── config/           UiConfig, ConfigLoader           one immutable view of env + browser settings
│   ├── driver/           Browser, BrowserOptionsFactory,  the only place that knows driver classes,
│   │                     CloudCapabilities, DriverFactory, options, Grid/cloud URLs and the lifecycle
│   │                     DriverManager
│   ├── ui/
│   │   ├── actions/      UiActions, ElementActionException   waits + names + logging around actions
│   │   ├── wait/         Waiter, ShopConditions               synchronisation, configured timeouts
│   │   └── js/           ScrollHelper, StorageHelper          the few justified JavascriptExecutor uses
│   ├── listeners/        StepLoggingListener (WebDriverListener), TestNG listeners for evidence/reporting
│   ├── evidence/         Screenshots, PageSource, ConsoleLogs    reused by listeners
│   └── pages/            BasePage, components/, pages/        (built out in the POM section)
└── tests/                test classes only: intent + assertions
src/test/resources/
├── config/local.properties, ci.properties, staging.properties
├── logback-test.xml
└── testng.xml
\`\`\`

Why each package exists: **driver/** isolates the volatile part (browsers, vendors, Grid) so a new browser or vendor touches one package; **ui/actions** and **ui/wait** are the only places that call raw element APIs, which makes behaviour consistent and changes local; **listeners/** keeps cross-cutting observation out of pages; **evidence/** is shared by the WebDriver and TestNG listeners; **pages/** depends on \`ui\` but never on \`driver\` construction; **tests/** depend on pages only. In a multi-module build the framework becomes its own module (\`src/main/java\`) consumed by test modules — the enterprise-framework section covers that.

## Anti-patterns

| Anti-pattern | Why it hurts | Better |
|---|---|---|
| \`public static WebDriver driver\` | breaks parallel runs, hidden global coupling | \`DriverManager\` with \`ThreadLocal\` and injection into pages |
| \`Thread.sleep\` inside helpers (\`clickWithWait\` that sleeps 2 s) | slow always, flaky still, multiplied by every call | condition-based waits in \`Waiter\` |
| helpers that swallow exceptions (\`try { el.click(); } catch (Exception e) { }\`) | test continues on the wrong page, fails later with a misleading error | wrap with context and rethrow; recover only classified transient cases |
| retrying everything (3× around every action, plus \`IRetryAnalyzer\`) | hides real bugs and races; triples time to failure | narrow re-locate on staleness; retries classified in \`java-deep-exception-design\` |
| JS click as the default click | bypasses visibility/interactability — passes on broken UIs | real click; JS only for documented exceptions (\`selenium-deep-interactions\`) |
| over-abstraction that hides Selenium (\`doAction("CLICK", "loginBtn")\`, keyword engines for engineers) | nobody can debug; IDE support lost; reinvents Java | thin, typed layer; Selenium concepts stay visible |
| God \`BasePage\` | coupling, unclear ownership, untestable | composition: collaborators + components |
| implicit wait + explicit waits | unpredictable timeouts (\`selenium-deep-synchronization\`) | implicit wait 0, explicit waits only |
| assertions inside \`UiActions\` | the action layer decides what is "correct" | actions act and read; tests and page-level checks assert |
| pages that create or quit drivers | lifecycle spread over the codebase | infrastructure owns lifecycle |
| logging secrets | credentials in CI artefacts | \`typeSecret\`, masking in listeners |

## How a senior reviews a Selenium framework PR

- **Lifecycle**: who creates and who quits the session? \`@AfterMethod(alwaysRun = true)\` (or hook equivalent), \`quit()\` guarded, \`ThreadLocal.remove()\`? Any page or helper calling \`quit\`/\`close\` on the main window?
- **Thread safety**: any new \`static\` mutable field (driver, page, wait, "current user", formatter)? Instance fields in test classes run with \`parallel="methods"\`?
- **Waits**: no \`Thread.sleep\`, no new implicit wait, no per-call literal timeouts — named timeouts from config; correct condition for the state (visible vs clickable vs present vs text).
- **Exceptions**: nothing swallowed; wrapping keeps the cause; retries narrow and classified; \`InvalidSelectorException\` and \`AssertionError\` never retried.
- **Locators**: test ids/ids first, scoped, no absolute XPath or index chains; dynamic locators via methods; defined once.
- **Layering**: tests do not call \`driver.findElement\`; pages do not build options or call listeners; new helpers land in the right package instead of \`BasePage\`.
- **Debuggability**: business names in actions, meaningful messages, step logs, no secrets logged, \`toString\` without browser calls.
- **Configuration**: no hard-coded URLs, browsers, paths or credentials; works headless and headed, local and Grid.
- **Selenium 4 APIs**: \`Duration\`-based waits, Options instead of \`DesiredCapabilities\`, \`getDomAttribute\`/\`getDomProperty\` where intent matters, no \`EventFiringWebDriver\`.
- **Evidence**: does a failure in the new code produce a screenshot and a readable message? Ask for a deliberately failing run in the PR.
- **Size**: is the new abstraction earning its keep, or wrapping one Selenium call in three layers?

## Playwright (TypeScript) equivalent

Playwright builds most of this layer in: actions auto-wait for actionability, locators are lazy (no stale elements — what \`UiElement\` emulates), \`test.step\` names steps in the report, and the trace viewer records every action with DOM snapshots — the "listener + evidence" stack out of the box. Lifecycle is owned by fixtures (\`page\` per test). Framework design in Playwright therefore focuses on fixtures, page objects and data, not on wrapping the driver.

\`\`\`ts
await test.step('add backpack to cart', async () => {
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
\`\`\`

## Interview questions

### Q: Per-test, per-class or per-suite browser sessions — what do you choose?
**Short answer (30–60 s):** Per test by default: full isolation, reproducible alone, parallel-safe. I make setup cheap (API login, storage seeding) rather than reusing browsers. Per-class sessions only for read-only classes, with an explicit reset.

**Detailed answer:** Reuse leaves cookies, storage, windows, alerts, frame focus and window size behind, and makes tests order-dependent; a crash takes down the rest of the class or suite. If I do reuse, the reset closes extra windows, returns to default content, navigates to the app origin, then deletes cookies and clears storage — both operate only on the current origin, so the order matters. Third-party domains, service workers and IndexedDB survive, which is why reuse needs justification.

### Q: How do you add logging, waits and screenshots around Selenium actions?
**Short answer (30–60 s):** A thin action layer (\`UiActions\` or a lazy element wrapper) for behaviour — waits, business names, narrow recovery, meaningful exceptions — plus a \`WebDriverListener\` via \`EventFiringDecorator\` for observation of every command. Screenshots on failure come from the TestNG failure listener.

**Detailed answer:** The listener cannot change behaviour (no waits, no recovery) and its exceptions are suppressed unless \`throwsExceptions()\` returns true, so it is for logging, timing and highlighting. The action layer is explicit and debuggable but only covers calls that go through it; the listener sees everything, including direct driver use. AOP is possible but adds weaving complexity; I use it only if the team already runs the AspectJ agent. Command-level \`onError\` is the wrong place for screenshots — waits generate expected errors during polling.

### Q: How does \`EventFiringDecorator\` work, and what are its pitfalls?
**Short answer (30–60 s):** It wraps the driver in a dynamic proxy implementing the same interfaces; every call on the driver and on objects it returns fires before/after/error events on the listeners, synchronously on the calling thread.

**Detailed answer:** Pitfalls: the decorated object is not a \`ChromeDriver\`/\`RemoteWebDriver\`, so casts fail — keep the original reference for CDP, session id and file detector; slow listeners slow every command; listeners cannot alter calls; listener exceptions are suppressed by default (so a broken listener can fail silently); calling the browser from inside a hook can recurse — use the original driver and a re-entrance guard; per-command timing needs a per-thread stack because calls nest. It replaced Selenium 3's \`EventFiringWebDriver\`/\`WebDriverEventListener\`.

### Q: Where do you keep locators, and why not in JSON files?
**Short answer (30–60 s):** As private \`By\` constants in the page or component that uses them. External files lose compile-time checks and find-usages, fail only at runtime and accumulate dead entries; the promised "edit without code" rarely helps because behaviour changes with the locator anyway.

**Detailed answer:** Dynamic locators are small methods (\`addToCart(slug)\`). Stability comes from a test-id contract with developers, not from where the strings live. Enums are useful when you need to iterate locators (page smoke validation); external files make sense only for a generated, cross-language catalogue.

### Q: What is wrong with a large BasePage and how do you fix it?
**Short answer (30–60 s):** It becomes a God class: every page inherits every helper, changes ripple everywhere, ownership is unclear and it cannot be tested. I keep BasePage to collaborators (driver, actions, waiter) and move capabilities into components and helpers composed where needed.

**Detailed answer:** Inheritance should express "is-a"; a header, a table or a date picker is "has-a". Components (\`HeaderComponent\` with the cart badge) are reused by composition; technology helpers live in the action layer. This also makes unit testing helpers possible with a mocked driver. Details belong in the POM/design-patterns section.

### Q: How do you make a Selenium framework debuggable?
**Short answer (30–60 s):** Business names on every action, exceptions that say what/where/expected/actual with the cause, step logs with test name and session id, evidence captured before teardown, and page \`toString\`s that are informative without calling the browser.

**Detailed answer:** Also: one log line per business step at INFO, commands at DEBUG; slow-command warnings from a listener; \`se:name\` for Grid sessions; no swallowed exceptions; masking secrets. I ask for a deliberately failing run in PRs that add framework code, to see the failure as the on-call engineer will.

### Q: How do you configure local versus Grid versus cloud runs?
**Short answer (30–60 s):** One options builder from layered configuration (defaults, env file, env vars, \`-D\` overrides); the factory chooses local driver or \`RemoteWebDriver\` by the presence of a remote URL; vendor-specific capabilities live in one class with credentials from environment variables.

**Detailed answer:** Grid adds \`se:\` capabilities and a \`LocalFileDetector\` for uploads; cloud vendors take a prefixed options map (\`sauce:options\`, \`bstack:options\` …) with build and test names. Effective configuration is logged at suite start (secrets masked) so a CI failure shows what actually ran.

## Scenario-based questions

**1. You join a team whose framework has \`clickElement()\` that catches \`Exception\`, sleeps 1 s and retries 5 times, and a \`BasePage\` of 2,000 lines.** I would not rewrite everything. First measure: time spent in sleeps and retries (add a listener that logs slow commands), and list tests that pass only after retries. Then introduce \`Waiter\` and a thin \`UiActions\` next to the old code, migrate the most-used pages first, and make the old \`clickElement\` delegate to the new one with retries removed behind a flag — run both modes in CI for a week. Split \`BasePage\` by extracting components. Communicate with numbers: suite time, retry counts, hidden failures found.

**2. After adding \`EventFiringDecorator\`, file upload tests fail on Grid and a CDP helper throws \`ClassCastException\`.** The decorated proxy is not a \`RemoteWebDriver\`: \`setFileDetector\` and \`(HasDevTools)\` casts were done on it. Fix: keep the original reference in the driver manager, configure the file detector and CDP on the original, and give pages the decorated driver.

**3. A product owner asks for locators in an Excel sheet so manual testers can fix them.** I would explain the cost (runtime typos, no find-usages, behaviour and locators drifting apart) and address the real need: agree \`data-testid\` attributes with developers so locators rarely change, make locator failures self-explanatory, and let manual testers raise locator issues that an engineer fixes in one reviewed line.

## Tricky follow-ups

- **Q: Can a \`WebDriverListener\` add an explicit wait before every click?** It can block in \`beforeClick\`, but it should not: listeners are for observation, their exceptions are suppressed by default and the wait would apply blindly to every click. Put waits in the action layer or extend \`WebDriverDecorator\`.
- **Q: Does \`afterAnyCall\` run when a command throws?** No — \`onError\` does. Timing or cleanup code must handle both.
- **Q: Why not implement \`WebElement\` in your wrapper?** You must implement and maintain every method, the wrapped element can still go stale, and it is easy to break \`Select\`/\`ExpectedConditions\` assumptions; a lazy wrapper that re-locates is simpler.
- **Q: Is \`deleteAllCookies()\` enough to reuse a browser between tests?** No — it clears only the current domain's cookies; storage, other domains, windows, alerts and frame focus remain.
- **Q: Should \`toString\` of a page include the current URL?** No — it would call the browser whenever a logger or debugger formats the object. Use static information (page name, expected path).`,
  keyPoints: [
    'Infrastructure (base test, listener, hook) creates and quits the session; pages only receive a driver. Per-test sessions by default; reuse needs an explicit, origin-aware reset.',
    'Build options from layered configuration (defaults, env file, env vars, -D); one factory decides local vs Grid vs cloud, vendor capabilities live in one class, secrets come from the environment.',
    'Use a thin action layer (UiActions or a lazy UiElement) for behaviour — waits, business names, narrow recovery, meaningful exceptions — and a WebDriverListener + EventFiringDecorator for observation of every command.',
    'EventFiringDecorator returns a proxy: casts to ChromeDriver/RemoteWebDriver fail, listeners run synchronously, cannot change calls, and their exceptions are suppressed unless throwsExceptions() returns true.',
    'Avoid the God BasePage: keep collaborators in the base class and compose components (HeaderComponent with the cart badge) and helpers.',
    'Keep locators as private By constants in the owning page or component; dynamic locators as methods; stability comes from a test-id contract, not external files.',
    'Debuggability: named steps, exceptions with what/where/expected/cause, MDC step logs, evidence in the TestNG failure listener, toString without browser calls, no secrets in logs.',
  ],
  mistakes: [
    'Click helpers that catch Exception, sleep and retry — failures surface later on the wrong page and the suite slows down. Fix: wait for the right condition, re-locate once on staleness, wrap other failures with context and rethrow.',
    'Casting the decorated driver to ChromeDriver/RemoteWebDriver (ClassCastException) or setting the file detector on it. Fix: keep the original driver next to the decorated one in the driver manager and use it for casts, CDP and session id.',
    'Putting waits or recovery into a WebDriverListener and wondering why its failures never show. Fix: listeners observe only (exceptions suppressed by default); behaviour goes into the action layer or a WebDriverDecorator subclass.',
    'Reusing one browser per class and resetting with deleteAllCookies() on about:blank — the cart and session survive. Fix: navigate to the app origin, close extra windows, clear cookies and storage there, or use per-test sessions.',
    'Locators in a JSON file "so they can be changed without code" — typos fail at runtime and dead keys accumulate. Fix: By constants in pages; negotiate data-testid attributes with developers.',
    'Logging every sendKeys verbatim, leaking passwords into CI artefacts. Fix: typeSecret in the action layer and masking of password fields in the listener.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`): (1) implement \`UiActions\` with business names and \`ElementActionException\`, and a \`HeaderComponent\` that reads the badge inside \`[data-testid='shopping-cart-link']\`; (2) write \`LoginPage\` (\`#user-name\`, \`#password\` via \`typeSecret\`, \`#login-button\`) and \`InventoryPage\` (\`#product-sort\`, \`addToCart(slug)\` building \`[data-testid='add-to-cart-<slug>']\`) on top of a minimal \`BasePage\`; (3) decorate the driver with the \`StepLoggingListener\` and run a test that logs in, sorts by \`hilo\`, adds two products and expects badge \`2\` — read the step log and confirm the password is masked; (4) break a locator on purpose (\`add-to-cart-trailblazer-bagpack\`) and check that the failure message names the element, the locator, the URL and the cause; (5) run once with \`-Dhighlight=true\` headed and once with \`-Dmobile.device="Pixel 7"\` and compare the screenshots.`,
  problems: ['sel-006', 'sel-014', 'sel-028', 'sel-034'],
}
