export default {
  id: 'sel-032',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Selenium 4 BiDi/CDP: fail on console errors and block heavy images',
  level: 'EXPERT',
  tags: ['bidi', 'cdp', 'console-errors', 'NetworkInterceptor', 'selenium4', 'framework'],
  estMinutes: 40,
  scenario: `Two production incidents last quarter had green UI regressions: the payment widget threw \`TypeError: Cannot read properties of undefined\` in the browser console, and the page *looked* fine in screenshots until a customer clicked "Pay". The architect wants every UI test to fail when the page logs \`console.error\` or throws an uncaught JavaScript exception. Separately, the product images come from a slow CDN on staging and make the suite 30% slower; they are irrelevant to functional checks, so tests should be able to block them. Selenium 4 can listen to the browser through **WebDriver BiDi** and intercept network traffic through **NetworkInterceptor** (Chrome DevTools Protocol).`,
  description: `Build the pieces in a \`BaseTest\` (Chrome):

1. Start Chrome with BiDi enabled: \`options.setCapability("webSocketUrl", true)\`.
2. In \`@BeforeMethod\` open a \`LogInspector\` (\`org.openqa.selenium.bidi.module.LogInspector\`) and register:
   - \`onConsoleEntry\` → add the text to a thread-safe \`jsErrors\` list when the level is \`LogLevel.ERROR\`,
   - \`onJavaScriptException\` → add every uncaught exception.
3. Provide \`assertNoJavaScriptErrors()\` that fails with the collected messages.
4. Provide \`blockImages()\` that returns a \`NetworkInterceptor\` routing every request ending in \`.png/.jpg/.jpeg/.gif/.webp\` to a **403** response, and close it after the test (it is \`AutoCloseable\`).
5. In \`@AfterMethod(alwaysRun = true)\` close the interceptor and inspector, then quit.

Then prove both work on \`inventory.html\` (the practice site has no real errors or images, so trigger them):
- \`executeScript("console.error('payment widget failed')")\` → wait (a \`FluentWait\` on the **list**, not the driver) until \`jsErrors\` is not empty — events arrive asynchronously.
- With images blocked, \`executeAsyncScript\` a \`fetch('promo.png')\` and assert the status is **403**.

**Rules**: no \`Thread.sleep\` to wait for events; the error list must be thread-safe; close what you open.`,
  hints: [
    'logInspector.onConsoleEntry(entry -> { if (entry.getLevel() == LogLevel.ERROR) jsErrors.add(entry.getText()); });',
    'new NetworkInterceptor(driver, Route.matching(req -> req.getUri().matches(".*[.](png|jpe?g|gif|webp)([?].*)?")).to(() -> req -> new HttpResponse().setStatus(403)))',
    'new FluentWait<>(jsErrors).withTimeout(Duration.ofSeconds(5)).until(list -> !list.isEmpty())',
  ],
  starterCode: `package com.shopeasy.framework;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

import java.util.ArrayList;
import java.util.List;

public abstract class BaseTest {

    protected WebDriver driver;
    protected final List<String> jsErrors = new ArrayList<>(); // filled by... nobody yet

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver();
        // TODO: enable BiDi, listen to console errors and JS exceptions
    }

    protected void assertNoJavaScriptErrors() {
        // TODO
    }

    @AfterMethod
    public void tearDown() {
        driver.quit();
    }
}
`,
  solution: `package com.shopeasy.framework;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.bidi.log.LogLevel;
import org.openqa.selenium.bidi.module.LogInspector;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.NetworkInterceptor;
import org.openqa.selenium.remote.http.Contents;
import org.openqa.selenium.remote.http.HttpResponse;
import org.openqa.selenium.remote.http.Route;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public abstract class BaseTest {

    protected WebDriver driver;
    protected final List<String> jsErrors = new CopyOnWriteArrayList<>(); // events arrive on another thread

    private LogInspector logInspector;
    private NetworkInterceptor imageBlocker;

    @BeforeMethod
    public void setUp() {
        jsErrors.clear();
        ChromeOptions options = new ChromeOptions();
        options.setCapability("webSocketUrl", true);              // switch on WebDriver BiDi
        options.addArguments("--window-size=1280,900");
        driver = new ChromeDriver(options);

        logInspector = new LogInspector(driver);
        logInspector.onConsoleEntry(entry -> {
            if (entry.getLevel() == LogLevel.ERROR) {
                jsErrors.add("console.error: " + entry.getText());
            }
        });
        logInspector.onJavaScriptException(ex -> jsErrors.add("Uncaught: " + ex.getText()));
    }

    /** Blocks image downloads for this test; closed automatically in tearDown. */
    protected NetworkInterceptor blockImages() {
        imageBlocker = new NetworkInterceptor(driver,
                Route.matching(req -> req.getUri().matches(".*[.](png|jpe?g|gif|webp)([?].*)?"))
                        .to(() -> req -> new HttpResponse()
                                .setStatus(403)
                                .setContent(Contents.utf8String("blocked by test"))));
        return imageBlocker;
    }

    protected void assertNoJavaScriptErrors() {
        Assert.assertTrue(jsErrors.isEmpty(), "Browser reported JavaScript errors:\\n" + String.join("\\n", jsErrors));
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        try {
            if (imageBlocker != null) {
                imageBlocker.close();
            }
            if (logInspector != null) {
                logInspector.close();
            }
        } finally {
            imageBlocker = null;
            logInspector = null;
            if (driver != null) {
                driver.quit();
            }
        }
    }
}

// ---- BrowserSignalsTest.java -------------------------------------------
package com.shopeasy.tests;

import com.shopeasy.framework.BaseTest;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.FluentWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class BrowserSignalsTest extends BaseTest {

    private static final String INVENTORY = "http://localhost:5180/practice-site/inventory.html";

    @Test
    public void cleanPageHasNoJavaScriptErrors() {
        driver.get(INVENTORY);
        assertNoJavaScriptErrors();
    }

    @Test
    public void consoleErrorsAreCaptured() {
        driver.get(INVENTORY);
        ((JavascriptExecutor) driver).executeScript("console.error('payment widget failed');");

        new FluentWait<List<String>>(jsErrors)
                .withTimeout(Duration.ofSeconds(5))
                .pollingEvery(Duration.ofMillis(200))
                .withMessage("console.error was not captured")
                .until(list -> !list.isEmpty());
        Assert.assertTrue(jsErrors.get(0).contains("payment widget failed"), jsErrors.toString());
    }

    @Test
    public void imagesCanBeBlocked() {
        blockImages();
        driver.get(INVENTORY);
        Object status = ((JavascriptExecutor) driver).executeAsyncScript(
                "const done = arguments[arguments.length - 1];"
                        + "fetch('promo.png').then(r => done(r.status)).catch(() => done(-1));");
        Assert.assertEquals(status, 403L, "Image request should be blocked by the interceptor");
        assertNoJavaScriptErrors();
    }
}
`,
  checks: [
    { label: 'Enables BiDi with webSocketUrl', pattern: 'setCapability\\s*\\(\\s*"webSocketUrl"\\s*,\\s*true|\\.enableBiDi\\s*\\(', hint: 'options.setCapability("webSocketUrl", true);' },
    { label: 'Listens to console entries', pattern: '\\.onConsoleEntry\\s*\\(', hint: 'logInspector.onConsoleEntry(entry -> ...)' },
    { label: 'Listens to uncaught JavaScript exceptions', pattern: '\\.onJavaScriptException\\s*\\(', hint: 'logInspector.onJavaScriptException(ex -> ...)' },
    { label: 'Uses a thread-safe list', pattern: '(CopyOnWriteArrayList|Collections\\.synchronizedList|ConcurrentLinkedQueue)', hint: 'new CopyOnWriteArrayList<>() — listeners run on another thread' },
    { label: 'Intercepts network requests', pattern: 'new\\s+NetworkInterceptor\\s*\\(', hint: 'new NetworkInterceptor(driver, Route.matching(...).to(...))' },
    { label: 'Closes interceptor / inspector', pattern: '\\.close\\s*\\(\\s*\\)', hint: 'Both are AutoCloseable — close them in tearDown' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait on the list with FluentWait' },
  ],
  explanation: `Classic WebDriver is one-way: your code asks, the browser answers. **WebDriver BiDi** (bidirectional) opens a WebSocket so the browser can *push* events to you — console messages, JavaScript exceptions, network events. \`setCapability("webSocketUrl", true)\` asks the driver for that socket (newer Selenium versions also offer \`options.enableBiDi()\`).

**LogInspector** subscribes to log events:
- \`onConsoleEntry\` receives every \`console.*\` call with its \`LogLevel\` — filter to \`ERROR\` (warnings are noisy).
- \`onJavaScriptException\` receives uncaught exceptions — the \`TypeError\` from the incident.
Listeners run on a **different thread** than the test, so the list must be thread-safe (\`CopyOnWriteArrayList\`), and the test must *wait* for events. \`FluentWait<T>\` works on any object, not just a driver — here it polls the list.

**NetworkInterceptor** (Chromium, built on CDP) routes matching requests to a handler: return a fake \`HttpResponse\` (403 here) instead of hitting the CDN. The same API can stub API responses for edge cases ("return 500 from /api/cart"). It is \`AutoCloseable\`; leaving it open keeps intercepting in the next test on that browser. In the BiDi world the cross-browser equivalent is the \`network\` module (\`addIntercept\`), which is still maturing — CDP is the pragmatic choice for Chrome/Edge today.

**Design choices a reviewer looks for**: clear the list per test, close listeners in an \`alwaysRun\` teardown before \`quit()\`, keep console checks *opt-in or allow-listed* (third-party scripts log errors you do not own), and include the collected messages in the assertion so the Jenkins report explains the failure without re-running.

The proof tests use \`executeScript("console.error(...)")\` and \`executeAsyncScript\` with \`fetch\` because the practice site has no real errors or images; \`executeAsyncScript\` passes a callback as the last argument and returns whatever you hand to it (numbers come back as \`Long\`).`,
  mistakes: [
    'Collecting events into an ArrayList — listener threads and the test thread race, causing lost entries or ConcurrentModificationException.',
    'Asserting immediately after triggering the error — the event has not arrived yet.',
    'Forgetting to close the NetworkInterceptor — later tests in the same session keep getting fake responses.',
    'Failing on every console.error from third-party scripts (analytics, chat widgets) — allow-list known noise or the suite becomes red forever.',
  ],
  interview: [
    { q: 'What is WebDriver BiDi and how is it different from CDP?', a: 'BiDi is the W3C bidirectional WebDriver protocol over WebSocket: the browser pushes events (logs, network) and you can subscribe. CDP is Chrome\'s own DevTools protocol — powerful but Chromium-only and version-specific. Selenium exposes both; BiDi is the cross-browser future.' },
    { q: 'How do you capture browser console errors in Selenium 4?', a: 'Enable BiDi (webSocketUrl capability), create a LogInspector and register onConsoleEntry and onJavaScriptException listeners that store messages in a thread-safe list, then assert the list is empty at the end of the test. On older setups, CDP console events or driver.manage().logs() for Chrome were used.' },
    { q: 'Why would you block or mock network requests in a UI test?', a: 'To speed up tests by skipping heavy or third-party resources, to make tests independent of unstable services, and to force edge cases (500 errors, slow responses) that are hard to produce on a real backend.' },
  ],
}
