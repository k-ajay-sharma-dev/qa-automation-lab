export default {
  slug: 'selenium-deep-interactions',
  category: 'selenium',
  order: 14,
  title: 'Deep dive: frames, windows, alerts, Actions (W3C input), JavascriptExecutor, shadow DOM, uploads and downloads',
  minutes: 30,
  summary: 'Master the browser contexts and input paths that break naive scripts — frame and window switching with scoped helpers, prompt handling and unhandledPromptBehavior, the W3C Actions model (sources, ticks, perform/release, wheel), a JavascriptExecutor policy, shadow roots (and their limits), uploads with LocalFileDetector and downloads locally, on Grid and over HTTP.',
  manualAnalogy: `A manual tester switches attention constantly without thinking: into the embedded payment form, over to the tab that just opened, onto the "Leave site?" dialog, back to the page. They drag a product to the wishlist with a real mouse, attach a file from their own disk and open the downloaded invoice to check it. Every one of those moves is a separate, explicit mechanism in WebDriver — and most "it's right there but Selenium can't find it" bugs are a test standing in the wrong place or using the wrong input path.`,
  body: `## Where the earlier lessons stop

The *Switching context* lesson covered the basic \`switchTo()\` calls for alerts, frames, windows and \`getShadowRoot()\`; the *Actions API and JavascriptExecutor* lesson covered the common gestures, \`executeScript\` basics and JS click as a logged fallback; *Form controls* covered a simple upload. This lesson goes underneath: what each command does in the W3C protocol, where the sharp edges are (handle order, prompt handler, input state, shadow-root locator support, remote file systems), and the small framework components that make these interactions deterministic. Waiting mechanics are in \`selenium-deep-synchronization\`; exception design in \`java-deep-exception-design\`.

## 1. Frames

### How it works internally

Every \`<iframe>\` hosts its own **browsing context** with its own document. A WebDriver session always has a *current browsing context*; every command — find, click, \`executeScript\`, \`getPageSource\` — runs in it. \`switchTo().frame(x)\` sends the W3C *Switch To Frame* command whose \`id\` is a number (index into \`window.frames\`), an element reference, or \`null\` (top-level). The Java overloads map onto that:

| Java call | Sent to the driver | Notes |
|---|---|---|
| \`frame(int index)\` | \`{"id": 0}\` | index of \`window.frames\` in the current context — shifts when an ad/analytics frame is added |
| \`frame(String nameOrId)\` | the **client** first finds \`frame/iframe\` by name, then by id, and sends the element | convenience lookup, no waiting |
| \`frame(WebElement)\` | \`{"id": {element reference}}\` | the most explicit form |
| \`frameToBeAvailableAndSwitchToIt(By)\` | find in current context + switch, retried every poll | the only form that waits |
| \`parentFrame()\` | *Switch To Parent Frame* | one level up |
| \`defaultContent()\` | \`{"id": null}\` | top-level document |

Consequences that matter:

- **Element references belong to one document.** A \`WebElement\` found on the main page and used while you are inside \`#support-frame\` fails (typically \`StaleElementReferenceException\` or \`NoSuchElementException\`, depending on the driver). Re-find after every switch.
- **WebDriver has no "which frame am I in?" command.** A helper cannot save and restore an arbitrary context — it can only restore to a known one (\`defaultContent()\`) or step back out (\`parentFrame()\`). Design helpers around absolute paths from the top.
- **If the frame reloads** while you are in it, you stay in that frame's browsing context and see the new document; if the \`<iframe>\` element is removed, the next command fails (\`NoSuchFrameException\` or a driver error) — switch out and back in.
- **Cross-origin frames** are fully automatable via WebDriver (the driver is not subject to the same-origin policy), but \`executeScript\` from the parent cannot reach into them — switch in first.

### The "wrong context" debugging habit

When a locator that works in DevTools throws \`NoSuchElementException\`, check the context before touching the locator:

\`\`\`java
String where = (String) ((JavascriptExecutor) driver).executeScript(
        "if (window.self === window.top) return 'top: ' + document.title;"
      + "try { return 'frame: ' + (window.frameElement ? window.frameElement.id : '(cross-origin)'); }"
      + "catch (e) { return 'frame: (cross-origin)'; }");
LOG.debug("Current context -> {}", where);
\`\`\`

In DevTools, also check the console's context drop-down and whether the element sits under \`#document\` of an \`<iframe>\` — and, separately, under \`#shadow-root\` (a different problem, see section 6).

### Approaches compared

\`\`\`java
driver.switchTo().frame(0);                                           // A. index
driver.switchTo().frame("supportFrame");                              // B. name or id
driver.switchTo().frame(driver.findElement(By.cssSelector("iframe[title='Contact support']")));  // C. element
wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(By.id("support-frame")));          // D. wait + switch
frames.call(d -> d.findElement(By.id("frame-heading")).getText(), By.id("support-frame"));      // E. scoped helper
\`\`\`

| | How it works | Advantages | Disadvantages | Maintainability | When to use |
|---|---|---|---|---|---|
| Index | \`window.frames[i]\` | shortest | breaks when any frame is added or reordered | poor | never in a suite |
| Name/id string | client lookup by name, then id | readable | no waiting; ambiguous names | fair | static frames that load with the page |
| WebElement | explicit reference | any locator (title, src) | no waiting; the element can go stale | fair | frames without id/name |
| \`frameToBeAvailableAndSwitchToIt\` | polls find + switch | waits for late-injected frames (chat, payment) | still leaves you "inside" — the caller must switch out | good | the default switch |
| Scoped helper | switch path → action → \`finally\` back to top | context can never leak to the next step; nested paths declarative | small amount of framework code | best | every page object that touches frames |

**Recommended approach and why:** page objects never call \`switchTo().frame\` directly; they use a scoped helper built on \`frameToBeAvailableAndSwitchToIt\`. The \`finally\` guarantees that a failure inside the frame does not leave the next step (or the failure listener's screenshot) in the wrong context.

### Complete example: scoped frame helper on ShopEasy

\`\`\`java
package com.shopeasy.framework.context;

import java.time.Duration;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class Frames {

    private final WebDriver driver;
    private final WebDriverWait wait;

    public Frames(WebDriver driver, Duration timeout) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, timeout);
    }

    /** Runs the action inside the frame path (outermost first) and always returns to the top document. */
    public <T> T call(Function<WebDriver, T> action, By... framePath) {
        driver.switchTo().defaultContent();                 // absolute path: start from the top
        try {
            for (By frame : framePath) {
                wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(frame));
            }
            return action.apply(driver);
        } finally {
            driver.switchTo().defaultContent();             // no "current frame" query exists, so restore to top
        }
    }

    public void run(Consumer<WebDriver> action, By... framePath) {
        call(d -> { action.accept(d); return null; }, framePath);
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.tests;

import java.time.Duration;
import com.shopeasy.framework.context.Frames;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class SupportChatFrameTest {

    private static final By SUPPORT_FRAME = By.id("support-frame");
    private static final By CHAT_FRAME = By.id("chat-frame");          // lives INSIDE support-frame
    private static final By CHAT_INPUT = By.id("chat-input");
    private static final By CHAT_SEND = By.id("chat-send");
    private static final By CHAT_LINES = By.cssSelector("#chat-log .chat-line");

    private WebDriver driver;
    private Frames frames;

    @BeforeMethod
    public void open() {
        driver = new ChromeDriver();
        frames = new Frames(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/frames.html");
    }

    @Test
    public void chatMessageAppearsInNestedFrameAndMainPageIsUntouched() {
        String heading = frames.call(d -> d.findElement(By.id("frame-heading")).getText(), SUPPORT_FRAME);
        Assert.assertEquals(heading, "Contact support");

        String lastLine = frames.call(d -> {
            d.findElement(CHAT_INPUT).sendKeys("Where is ORD-1043?");
            d.findElement(CHAT_SEND).click();
            return new WebDriverWait(d, Duration.ofSeconds(5))
                    .until(ExpectedConditions.numberOfElementsToBe(CHAT_LINES, 1))
                    .get(0).getText();
        }, SUPPORT_FRAME, CHAT_FRAME);
        Assert.assertEquals(lastLine, "You: Where is ORD-1043?");

        // back at the top automatically
        Assert.assertEquals(driver.findElement(By.id("main-page-text")).getText(), "You are on the parent page.");
    }

    @AfterMethod(alwaysRun = true)
    public void quit() {
        if (driver != null) driver.quit();
    }
}
\`\`\`

**Step by step**

- \`call(action, SUPPORT_FRAME, CHAT_FRAME)\` — the frame path reads like a folder path; \`CHAT_FRAME\` is resolved **inside** \`#support-frame\` because \`frameToBeAvailableAndSwitchToIt\` searches the current context.
- \`defaultContent()\` at the start makes the helper independent of where the previous step left the driver.
- The \`finally\` restores the top document even when the assertion inside the lambda fails — so the failure listener's screenshot and page source are of the main page, not a 160-px chat frame. (Screenshots are always of the whole viewport, but \`getPageSource\` is per context.)
- Elements never escape the lambda: returning a \`WebElement\` from \`call\` would hand the caller a reference from a document it can no longer reach. Return values (text, counts), not elements.

## 2. Windows and tabs

### How it works internally

A **window handle** is the W3C id of a top-level browsing context. \`getWindowHandle()\` = current; \`getWindowHandles()\` = all, returned by the driver as a list that Java exposes as a \`Set<String>\` (a \`LinkedHashSet\`, so it keeps the driver's order — but the driver does not promise "order of opening", so treat it as unordered). Opening a tab never changes the current context; closing the current window (\`close()\` = *Close Window*) leaves the session pointing at nothing until you switch. \`switchTo().newWindow(WindowType.TAB | WINDOW)\` (Selenium 4) sends *New Window* and switches to it.

### Patterns compared

\`\`\`java
// A. Compare with the original handle (fine for exactly one new window)
String original = driver.getWindowHandle();
for (String h : driver.getWindowHandles()) {
    if (!h.equals(original)) { driver.switchTo().window(h); break; }
}

// B. Set difference: the handle(s) that appeared because of MY action
Set<String> before = driver.getWindowHandles();
driver.findElement(By.id("popup-btn")).click();
String popup = wait.until(d -> {
    Set<String> now = new HashSet<>(d.getWindowHandles());
    now.removeAll(before);
    return now.size() == 1 ? now.iterator().next() : null;
});

// C. Match by content: title or URL (several windows open at once)
windows.switchTo(d -> d.getTitle().contains("Privacy Policy"), "title contains 'Privacy Policy'");
\`\`\`

| | Advantages | Disadvantages | When to use |
|---|---|---|---|
| A. not-the-original loop | simple | wrong as soon as a third window exists (a leftover tab from a previous step) | one-off scripts |
| B. set difference + wait | identifies exactly the window your action opened, and waits for it | does not tell two simultaneously opened windows apart | the default for "click opens a window" |
| C. predicate on title/URL | picks the right one among many; works after the fact | switches through every window (cost, and title may not be set yet — wrap in a wait) | multiple windows (\`#open-two-btn\` on \`windows.html\` opens Terms and Privacy at once) |
| \`newWindow(TAB)\` | no click needed, switches automatically | not a test of the app's own link | side-by-side checks, an admin view in the same session |

### A windows helper

\`\`\`java
package com.shopeasy.framework.context;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Predicate;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public final class Windows {

    private final WebDriver driver;
    private final Duration timeout;

    public Windows(WebDriver driver, Duration timeout) {
        this.driver = driver;
        this.timeout = timeout;
    }

    /** Performs the action and returns the handle of the single window it opened (does not switch). */
    public String openedBy(Runnable action) {
        Set<String> before = driver.getWindowHandles();
        action.run();
        return new WebDriverWait(driver, timeout)
                .withMessage("exactly one new window after the action (had " + before.size() + ")")
                .until(d -> {
                    Set<String> now = new HashSet<>(d.getWindowHandles());
                    now.removeAll(before);
                    return now.size() == 1 ? now.iterator().next() : null;
                });
    }

    /** Switches to the first window matching the predicate; returns its handle. */
    public String switchTo(Predicate<WebDriver> matcher, String description) {
        String origin = driver.getWindowHandle();
        return new WebDriverWait(driver, timeout)
                .withMessage("a window where " + description)
                .until(d -> {
                    for (String handle : d.getWindowHandles()) {
                        d.switchTo().window(handle);
                        if (matcher.test(d)) {
                            return handle;
                        }
                    }
                    d.switchTo().window(origin);            // not found this poll: go home, try again
                    return null;
                });
    }

    /** Closes the current window and returns to the given one. */
    public void closeAndReturnTo(String handle) {
        driver.close();
        driver.switchTo().window(handle);
    }

    /** For popups that close themselves (e.g. a "Close this window" button calling window.close()). */
    public void waitUntilClosedAndReturnTo(String closingHandle, String handle) {
        new WebDriverWait(driver, timeout)
                .until(d -> !d.getWindowHandles().contains(closingHandle));
        driver.switchTo().window(handle);
    }

    public void waitForCount(int expected) {
        new WebDriverWait(driver, timeout).until(ExpectedConditions.numberOfWindowsToBe(expected));
    }
}
\`\`\`

**Real-time scenario (windows.html):** "Open chat pop-up" (\`#popup-btn\`) calls \`window.open(..., 'chatPopup', 'width=520,height=420')\`; the pop-up page has \`#close-window-btn\`, which calls \`window.close()\`.

\`\`\`java
String main = driver.getWindowHandle();
String chat = windows.openedBy(() -> driver.findElement(By.id("popup-btn")).click());
driver.switchTo().window(chat);
Assert.assertEquals(driver.findElement(By.id("new-window-heading")).getText(), "Live chat");

driver.findElement(By.id("close-window-btn")).click();   // the window closes ITSELF
windows.waitUntilClosedAndReturnTo(chat, main);           // any other command now -> NoSuchWindowException
Assert.assertEquals(driver.findElement(By.id("popup-status")).getText(), "Pop-up opened");
\`\`\`

- After a self-closing pop-up, the session's current context is gone: \`getTitle()\` throws \`NoSuchWindowException\`, but \`getWindowHandles()\` still works (it does not need a current context) — which is what the wait polls.
- \`window.open\` with a **name** (\`chatPopup\`) reuses the same window on a second click: the count stays 2 and \`openedBy\` times out — a real product behaviour your test should know about.
- Pop-up blockers: \`window.open\` from a WebDriver click counts as a user gesture, so it is allowed; from a timer it may be blocked. Here the page reports it in \`#popup-status\`.

### Common mistakes and debugging

- \`NoSuchWindowException: no such window: target window already closed\` — you closed (or the app closed) the current window and did not switch. Fix: always switch after \`close()\`; for self-closing pop-ups wait for the handle to disappear.
- Flaky "wrong window" picks — code relying on \`new ArrayList<>(handles).get(1)\`. Fix: set difference or predicate.
- A leaked tab from a failed earlier test in the same session makes "the other handle" ambiguous. Fix: a teardown that closes every handle except the main one, or a fresh session per test class.

## 3. Alerts and user prompts

### How it works internally

\`alert\`, \`confirm\`, \`prompt\` and \`beforeunload\` dialogs are **user prompts**, owned by the browser, not the DOM. While one is open, the W3C spec runs the session's **user prompt handler** before most commands:

| \`unhandledPromptBehavior\` value | What happens when a command hits an open prompt | Selenium Java |
|---|---|---|
| \`dismiss and notify\` (**spec default**) | prompt dismissed, command fails with "unexpected alert open" | \`UnexpectedAlertBehaviour.DISMISS_AND_NOTIFY\` |
| \`accept and notify\` | prompt accepted, command fails | \`ACCEPT_AND_NOTIFY\` |
| \`dismiss\` | prompt dismissed, command continues | \`DISMISS\` |
| \`accept\` | prompt accepted, command continues | \`ACCEPT\` |
| \`ignore\` | prompt left open, command fails | \`IGNORE\` |

\`\`\`java
ChromeOptions options = new ChromeOptions();
options.setUnhandledPromptBehaviour(UnexpectedAlertBehaviour.IGNORE);
\`\`\`

In Java, "fails" surfaces as \`UnhandledAlertException\`, whose \`getAlertText()\` carries the dialog text — log it, it often explains the failure ("Your session will expire in 5 minutes"). The *notify* defaults are deliberate: a dialog nobody expected is a test-relevant event, and silently accepting it (\`ACCEPT\`) can confirm a destructive action ("Do you want to empty your cart?") without any assertion. Keep the default or \`IGNORE\` for functional suites; \`DISMISS\`/\`ACCEPT\` only for crawler-style smoke or visual runs where dialogs are noise.

### Waiting and handling

\`\`\`java
public final class Dialogs {
    private final WebDriver driver;
    public Dialogs(WebDriver driver) { this.driver = driver; }

    /** Accepts a dialog if one shows up within the window; returns its text. */
    public Optional<String> acceptIfPresent(Duration within) {
        try {
            Alert alert = new WebDriverWait(driver, within).until(ExpectedConditions.alertIsPresent());
            String text = alert.getText();
            alert.accept();
            return Optional.of(text);
        } catch (TimeoutException e) {
            return Optional.empty();
        }
    }
}

// alerts.html: "Alert after 3 seconds"
driver.findElement(By.id("delayed-alert-btn")).click();
String text = dialogs.acceptIfPresent(Duration.ofSeconds(5)).orElseThrow();
Assert.assertEquals(text, "Your session will expire in 5 minutes");
\`\`\`

- \`alertIsPresent()\` polls \`switchTo().alert()\` (\`NoAlertPresentException\` = not yet) and leaves you switched to it.
- Between the click and the alert (3 s here) the page is live; if the test does anything else, it runs normally — and if the alert opens *during* that command, the prompt handler applies.
- \`sendKeys\` works only on a \`prompt()\`; on \`alert\`/\`confirm\` the driver returns an error (\`ElementNotInteractableException\` in Java with current drivers).

### beforeunload, HTML modals and approaches

- **\`beforeunload\` dialogs** ("Leave site? Changes you made may not be saved") appear when navigating away from a page with unsaved changes. How drivers treat them during \`get()\`/\`navigate()\` differs between browsers and driver versions — some surface them as a prompt, some handle them automatically. Do not rely on either: if the dialog is a feature, test it explicitly (edit, click a link, \`alertIsPresent()\`, then \`dismiss()\` and assert you stayed); if it only gets in the way of cleanup, navigate via a fresh tab or quit the session instead of disabling it with \`window.onbeforeunload = null\` in a test that claims to cover the page.
- **HTML modals** like \`#confirm-modal\` on \`alerts.html\` are DOM: \`switchTo().alert()\` throws \`NoAlertPresentException\`; click \`#modal-cancel\`/\`#modal-confirm\` and wait for \`invisibilityOfElementLocated(By.id("confirm-modal"))\` (it uses the \`hidden\` attribute). An open modal overlay is the classic source of \`ElementClickInterceptedException\` on the page behind it.

| | JS dialog (\`alert/confirm/prompt\`) | HTML modal |
|---|---|---|
| In the DOM / DevTools | no | yes |
| API | \`Alert\`: accept, dismiss, getText, sendKeys | normal locators |
| Wait | \`alertIsPresent\` | \`visibilityOf...\` / \`invisibilityOf...\` |
| Blocks other commands | yes (prompt handler) | only clicks underneath (intercepted) |
| Screenshot shows it | usually not (browser UI) | yes |

## 4. Actions: the W3C input model

### How it works internally

The W3C *Perform Actions* command takes a list of **input sources**, each with an id, a type and a list of actions:

| Source type | Actions | Selenium Java |
|---|---|---|
| \`key\` | keyDown, keyUp, pause | \`keyDown\`, \`keyUp\`, \`sendKeys\` (on Actions) |
| \`pointer\` (mouse / pen / touch) | pointerMove, pointerDown, pointerUp, pause | \`moveToElement\`, \`moveByOffset\`, \`clickAndHold\`, \`release\`, \`click\`, \`doubleClick\`, \`contextClick\`, \`dragAndDrop\` |
| \`wheel\` | scroll, pause | \`scrollToElement\`, \`scrollByAmount\`, \`scrollFromOrigin\` |
| \`none\` | pause | \`pause(Duration)\` |

The actions are arranged in **ticks**: tick *n* executes the *n*-th action of every source together, and a tick lasts as long as its longest action (a pointer move has a duration — Selenium uses a short default for \`moveToElement\`). Selenium fills shorter sequences with pauses so that, for example, \`keyDown(SHIFT)\` in tick 1 is held while the pointer clicks in ticks 2–3.

- **\`perform()\`** turns the builder into sequences and sends **one** HTTP request. Building without \`perform()\` sends nothing — no error.
- **Input state persists** across \`perform()\` calls within the session: a \`keyDown(CONTROL)\` without \`keyUp\` leaves Control "pressed" for later actions. The W3C *Release Actions* command resets it — in Java \`((RemoteWebDriver) driver).resetInputState()\`. Note the naming trap: \`Actions.release()\` is a **pointer up** inside the chain, not Release Actions.
- **Element origin = in-view centre point.** \`moveToElement(el)\` targets the element's centre; if that point is outside the viewport, the driver returns *move target out of bounds* (\`MoveTargetOutOfBoundsException\`). Unlike \`element.click()\`, a pointer move does not scroll for you — scroll first.
- **\`element.click()\` is not an Action.** *Element Click* scrolls into view, checks the hit target (intercepted?) and clicks; an Actions click just presses the pointer wherever it is, with no interception check.

### Hover menu (dynamic.html)

\`\`\`java
Actions actions = new Actions(driver);
WebElement menu = driver.findElement(By.id("account-menu"));

actions.scrollToElement(menu)            // wheel action, see below
       .moveToElement(menu)
       .perform();

By orders = By.xpath("//div[@id='account-menu']//a[@role='menuitem' and normalize-space()='Orders']");
WebElement item = wait.until(ExpectedConditions.visibilityOfElementLocated(orders));
actions.moveToElement(item).click().perform();     // pointer travels inside the menu: hover is kept

wait.until(ExpectedConditions.textToBe(By.id("dynamic-result"), "Menu: Orders"));
\`\`\`

The submenu is CSS \`:hover\`-driven, so the pointer must stay over \`#account-menu\` or its children. Moving to the item (a descendant) keeps the hover; \`item.click()\` would also work here because Element Click moves the pointer onto the item — but on menus whose path crosses a gap, a direct jump closes the menu, and the Actions path with intermediate \`moveByOffset\` steps is the controllable option.

### Drag and drop: three approaches

\`\`\`java
WebElement source = driver.findElement(By.id("draggable"));
WebElement target = driver.findElement(By.id("droppable"));

// A. Convenience method
new Actions(driver).dragAndDrop(source, target).perform();

// B. Step by step with intermediate moves and pauses (drag thresholds, pointer-event libraries)
new Actions(driver)
        .clickAndHold(source)
        .pause(Duration.ofMillis(150))
        .moveByOffset(10, 0)                 // cross the library's drag threshold
        .moveToElement(target)
        .pause(Duration.ofMillis(150))
        .release()
        .perform();

// C. JavaScript HTML5 drag-and-drop simulation (last resort)
((JavascriptExecutor) driver).executeScript(
        "const src = arguments[0], tgt = arguments[1];"
      + "const dt = new DataTransfer();"
      + "const fire = (type, el) => el.dispatchEvent(new DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: dt}));"
      + "fire('dragstart', src); fire('dragenter', tgt); fire('dragover', tgt); fire('drop', tgt); fire('dragend', src);",
        source, target);
\`\`\`

| | How it works | Advantages | Disadvantages | When to use |
|---|---|---|---|---|
| \`dragAndDrop\` | pointer down on source, move to target, up — one perform | one line, real input | one big jump; libraries with thresholds or that need several \`mousemove\`s may not react | mouse/pointer-event based DnD (ShopEasy's \`#draggable\`) |
| Step-by-step chain | same primitives with intermediate moves and pauses | controllable; survives thresholds and animations | verbose | sortable lists, sliders, canvas |
| JS DragEvent dispatch | synthetic \`dragstart/dragover/drop\` events | works when native HTML5 DnD does not start from synthesized input | not a real user path; skips the browser's own drag logic; \`isTrusted\` is false (apps can reject) | HTML5 DnD (\`draggable="true"\` + \`dataTransfer\`) when A/B fail in your browser matrix — logged and documented |

Why HTML5 drag-and-drop is special: native DnD is a browser-managed drag session started by the OS-level mouse gesture. Whether input synthesized by a driver starts that session has historically differed between drivers and versions (ChromeDriver was long known for not triggering it); try A/B in each browser you support before falling back to C. ShopEasy's widget handles both mouse events (A works) and HTML5 \`drop\` events, so you can compare the approaches on one element.

### Keyboard chords and the platform modifier

\`\`\`java
Keys modifier = ((HasCapabilities) driver).getCapabilities().getPlatformName().is(Platform.MAC)
        ? Keys.COMMAND : Keys.CONTROL;

WebElement address = driver.findElement(By.id("address"));            // form.html
address.sendKeys("221B Baker Street");
address.sendKeys(Keys.chord(modifier, "a"), Keys.DELETE);             // select all, delete
Assert.assertEquals(address.getDomProperty("value"), "");
\`\`\`

- \`Keys.chord(...)\` builds a string of key codes ending with \`Keys.NULL\`, which releases all held modifiers — so the chord does not leak into the next keystroke.
- Use the **browser's** platform from the session capabilities, not \`Platform.getCurrent()\` (the JVM's OS): on a Grid the tests run on Linux CI while the browser may be on a macOS node.
- \`Actions.keyDown(modifier).sendKeys("a").keyUp(modifier)\` is the equivalent with explicit input state; always pair keyDown with keyUp (or \`resetInputState()\` in teardown).

### Scrolling with the wheel API

\`\`\`java
new Actions(driver).scrollToElement(element).perform();               // bottom of element to bottom of viewport
new Actions(driver).scrollByAmount(0, 600).perform();                 // from the viewport's current position
WheelInput.ScrollOrigin origin = WheelInput.ScrollOrigin.fromElement(driver.findElement(By.id("review-feed")));
new Actions(driver).scrollFromOrigin(origin, 0, 300).perform();       // scroll INSIDE a scrollable container
\`\`\`

Wheel actions are marked **Selenium v4.2** in the Selenium documentation, which also labels them Chromium-only at the time of writing — check Firefox/Safari support for your versions before relying on them in a cross-browser suite. They produce real wheel events (infinite scroll and lazy-loading listeners react), which a JS \`scrollTo\` does not always trigger. \`scrollToElement\` aligns the element's bottom with the viewport bottom — fine before a hover, but a sticky footer can still cover it; for clicking, centre with \`scrollIntoView({block: 'center'})\`.

**Double-click and context click** — \`doubleClick(el)\` and \`contextClick(el)\` are pointer sequences (two down/up pairs; right button). A context click opens the browser's native menu unless the app intercepts \`contextmenu\` and draws its own HTML menu; only the latter is testable.

## 5. JavascriptExecutor

### How it works internally

\`executeScript(script, args...)\` sends *Execute Script*: the driver wraps your string as the **body of a function**, passes \`args\` as \`arguments\`, runs it in the current browsing context and serialises the return value. \`executeAsyncScript\` (*Execute Async Script*) adds a callback as the **last** argument; the call returns when the script invokes it, or fails with \`ScriptTimeoutException\` after the session's script timeout (spec default 30 s). Per the W3C spec, a returned Promise is awaited as well, so in current drivers \`executeScript("return fetch(...).then(r => r.status)")\` also works; \`executeAsyncScript\` remains the portable callback form.

\`\`\`java
JavascriptExecutor js = (JavascriptExecutor) driver;
Boolean fontsReady = (Boolean) js.executeAsyncScript(
        "const done = arguments[arguments.length - 1];"
      + "document.fonts.ready.then(() => done(true)).catch(() => done(false));");
\`\`\`

| JavaScript value | Java type received | Java argument sent | Becomes in JS |
|---|---|---|---|
| integer number | \`Long\` | \`WebElement\` | the DOM element |
| fractional number | \`Double\` | \`Long\`/\`Integer\`/\`Double\` | number |
| boolean / string | \`Boolean\` / \`String\` | \`Boolean\` / \`String\` | boolean / string |
| DOM element | \`WebElement\` | \`List\`/\`Collection\` | array |
| array / NodeList | \`List<Object>\` | \`Map<String, ?>\` | object |
| plain object | \`Map<String, Object>\` | \`null\` | null |
| \`null\` / \`undefined\` / no return | \`null\` | | |
| shadow root | a shadow-root reference — treat as \`SearchContext\`, not \`WebElement\` | | |

The numeric rule bites: \`return 1.0\` arrives as \`Long\` 1 (JavaScript has no int/float distinction), \`return 1.5\` as \`Double\`. Cast to \`Number\` and convert: \`((Number) js.executeScript("return window.scrollY")).doubleValue()\`.

### Legitimate versus harmful uses

| Use | Verdict | Why |
|---|---|---|
| \`scrollIntoView({block: 'center'})\` before a real click | legitimate | the user scrolls too; it only positions the element |
| Read computed style, \`localStorage\`/\`sessionStorage\`, \`performance\`, \`document.readyState\` | legitimate | observation, no state change the user could not cause |
| Seed state (storage, feature flags) in **setup** | legitimate, documented | test data arrangement, not the behaviour under test |
| Measure / assert things WebDriver cannot (\`files[0].name\`, \`validity.valid\`, \`naturalWidth\` of an image) | legitimate | read-only |
| Dispatch \`input\`/\`change\` after a value set on a custom widget with no user path | borderline | acceptable for third-party widgets outside the test's scope, with a comment |
| JS \`click()\` instead of a real click | harmful as default | skips visibility, interception and enablement — a covered or disabled button "works" |
| Set \`value\` instead of \`sendKeys\` | harmful | no key events: validation, masks, autocomplete and React state are bypassed |
| Remove overlays / \`display:none\` cookie banners | harmful in functional tests | hides exactly the UX bug a user hits; handle the banner like a user (or seed its consent cookie in setup) |

**Policy a senior writes into the framework guide:** JavaScript may **observe**, **position** and **arrange preconditions**; it may not **perform the user's action under test**. Every exception (JS click fallback, synthetic DnD) lives in one helper that logs a warning with the reason, so a growing count of fallbacks shows up in reports instead of disappearing.

## 6. Shadow DOM

### How it works internally

\`WebElement.getShadowRoot()\` (Selenium 4) sends *Get Element Shadow Root* and returns a shadow-root reference exposed as a \`SearchContext\`: it has \`findElement\`/\`findElements\` and nothing else (no \`getText\`, no click). If the element has no (open) shadow root you get \`NoSuchShadowRootException\`; if the host re-renders, the reference becomes invalid (\`DetachedShadowRootException\`).

What works inside the shadow-root context:

- **CSS selectors** — the reliable choice. \`By.id\`, \`By.className\`, \`By.tagName\` and \`By.name\` also work in the Java bindings because they are sent as CSS selectors under the W3C protocol.
- **XPath — no.** The spec defines locator strategies for shadow roots generically, but in practice ChromeDriver rejects XPath there ("invalid argument: invalid locator") and Firefox does not support it either; XPath evaluation is document-based. Use CSS.
- **Nested components** — call \`getShadowRoot()\` again on the inner host: \`outer.getShadowRoot().findElement(By.cssSelector("inner-widget")).getShadowRoot()\`.
- **Closed shadow roots** (\`attachShadow({mode: 'closed'})\`) — not accessible through WebDriver or \`element.shadowRoot\` (it returns null). Options: test the observable behaviour (keyboard: \`Tab\` into the component, type, assert the host's events/attributes), ask the component team for an open root in test builds, or test the component in isolation with its own harness.
- **Waits** — \`ExpectedConditions\` that take \`By\` search the document; use a lambda that re-reads the root every poll.

### Approaches compared (dynamic.html, \`<coupon-widget id="coupon-widget">\`)

\`\`\`java
By host = By.cssSelector("coupon-widget");
By message = By.cssSelector("#coupon-message");

// A. Selenium 4 shadow root API, re-found on every poll
driver.findElement(host).getShadowRoot().findElement(By.cssSelector("#coupon-code")).sendKeys("BADCODE");
driver.findElement(host).getShadowRoot().findElement(By.cssSelector("#apply-coupon")).click();
String text = wait.until(d -> {
    String t = d.findElement(host).getShadowRoot().findElement(message).getText();
    return t.isEmpty() ? null : t;
});
Assert.assertEquals(text, "Invalid coupon");

// B. JavaScript fallback
WebElement msg = (WebElement) ((JavascriptExecutor) driver).executeScript(
        "return arguments[0].shadowRoot.querySelector('#coupon-message');", driver.findElement(host));
\`\`\`

| | Advantages | Disadvantages | When to use |
|---|---|---|---|
| \`getShadowRoot()\` | W3C standard, typed, real element references, works on Grid | CSS only; one root per hop; no closed roots | default |
| JS \`shadowRoot.querySelector\` | works in old bindings/drivers; can walk many levels in one call | string code, no locator reuse, still open roots only | legacy or deep generic traversal utilities |
| Piercing locators (other tools) | Playwright CSS pierces open roots automatically | not available in Selenium | contrast in interviews |

The returned element from A or B is a normal \`WebElement\`: \`sendKeys\`, \`click\` (with interception checks) and \`getText\` work. Wrap the hop in a page component (\`CouponWidget\` with \`apply(code)\`, \`message()\`) so tests never see the shadow plumbing.

## 7. File upload

### How it works internally

Uploading is **Element Send Keys on an \`<input type=file>\`**: the driver sets the input's file list from paths on the **browser machine** and fires \`input\`/\`change\`. No OS dialog is involved — never click the "Choose file" button (it opens a native dialog WebDriver cannot control).

- **Multiple files**: join absolute paths with \`\\n\` — the spec splits the text on newlines. The input must have the \`multiple\` attribute, otherwise the driver returns *invalid argument*. ShopEasy's \`#upload-file\` accepts one file.
- **Hidden inputs**: many UIs hide the real input behind a styled button. By default (\`strictFileInteractability\` capability false) drivers accept send keys to a file input even if it is not interactable; set the capability to \`true\` if you want uploads to be held to user-level interactability.
- **\`accept=".pdf,.png,.jpg,.jpeg"\`** is only a hint for the native dialog; send keys can attach any file — use that to test server-side validation, not to "prove" the client filter.
- **Remote browsers**: the path must exist on the node. With \`RemoteWebDriver\`, set \`LocalFileDetector\`: the client then zips the local file, uploads it to the node and sends the node-side path. The Java bindings do not set it by default. Local driver classes such as \`ChromeDriver\` reject \`setFileDetector\` (they do not need it) — set it only on drivers created as \`RemoteWebDriver\`.

\`\`\`java
package com.shopeasy.tests;

import java.nio.file.Files;
import java.nio.file.Path;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.LocalFileDetector;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.testng.Assert;

public class LicenceUploadSteps {

    private final WebDriver driver;

    public LicenceUploadSteps(WebDriver driver, boolean remote) {
        this.driver = driver;
        if (remote) {
            ((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector());   // Grid only
        }
    }

    public void attachLicence() throws Exception {
        Path licence = Files.createTempFile("trade-licence-", ".pdf");
        Files.writeString(licence, "%PDF-1.4 test fixture");
        licence.toFile().deleteOnExit();

        WebElement input = driver.findElement(By.id("upload-file"));               // form.html
        input.sendKeys(licence.toAbsolutePath().toString());

        String attached = (String) ((JavascriptExecutor) driver)
                .executeScript("return arguments[0].files.length ? arguments[0].files[0].name : null;", input);
        Assert.assertEquals(attached, licence.getFileName().toString());
    }
}
\`\`\`

- \`toAbsolutePath()\` — relative paths are resolved by the driver process, not your project.
- Reading \`files[0].name\` is a legitimate JS observation: the file list is not exposed by any WebDriver command, and \`getDomProperty("value")\` only gives the browser's \`C:\\fakepath\\...\` string.
- Assert the **business outcome** too: after submitting the form, ShopEasy's \`#result-details\` lists the licence file name.

## 8. File download

The practice site has no download, so the code below uses a **clearly hypothetical** ShopEasy back-office button: \`#export-orders-csv\` producing \`orders-YYYY-MM-DD.csv\`. The mechanics are real.

### Approach A: browser download to a known folder

\`\`\`java
Path downloadDir = Path.of("target", "downloads", UUID.randomUUID().toString()).toAbsolutePath();
Files.createDirectories(downloadDir);                         // one folder per test: no cross-test pollution

ChromeOptions chrome = new ChromeOptions();
chrome.setExperimentalOption("prefs", Map.of(
        "download.default_directory", downloadDir.toString(),  // must be absolute
        "download.prompt_for_download", false));

FirefoxOptions firefox = new FirefoxOptions();
firefox.addPreference("browser.download.folderList", 2);      // 2 = use a custom directory
firefox.addPreference("browser.download.dir", downloadDir.toString());
firefox.addPreference("browser.download.useDownloadDir", true);
firefox.addPreference("browser.helperApps.neverAsk.saveToDisk", "text/csv");
\`\`\`

Wait for the file to appear **and** stop growing, with no temporary file left:

\`\`\`java
public static Path awaitDownload(Path dir, String glob, Duration timeout) {
    PathMatcher matcher = dir.getFileSystem().getPathMatcher("glob:" + glob);
    AtomicLong lastSize = new AtomicLong(-1);
    return new FluentWait<>(dir)
            .withTimeout(timeout)
            .pollingEvery(Duration.ofMillis(500))
            .ignoring(UncheckedIOException.class)
            .withMessage(() -> "a completed download matching " + glob + " in " + dir)
            .until(d -> {
                try (Stream<Path> listing = Files.list(d)) {
                    List<Path> files = listing.toList();
                    boolean inProgress = files.stream()
                            .map(p -> p.getFileName().toString())
                            .anyMatch(n -> n.endsWith(".crdownload") || n.endsWith(".part") || n.endsWith(".tmp"));
                    Optional<Path> match = files.stream().filter(p -> matcher.matches(p.getFileName())).findFirst();
                    if (inProgress || match.isEmpty()) {
                        return null;
                    }
                    long size = Files.size(match.get());
                    return size > 0 && size == lastSize.getAndSet(size) ? match.get() : null;
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
}

// in the test
driver.findElement(By.id("export-orders-csv")).click();
Path csv = awaitDownload(downloadDir, "orders-*.csv", Duration.ofSeconds(30));
List<String> lines = Files.readAllLines(csv);
Assert.assertEquals(lines.get(0), "orderId,date,status,total");
Assert.assertTrue(lines.stream().anyMatch(l -> l.startsWith("ORD-1043,")), "ORD-1043 exported");
\`\`\`

- \`FluentWait<Path>\` — the wait's input is the directory, not the driver: the generic loop from \`selenium-deep-synchronization\`.
- Chrome writes \`*.crdownload\` and Firefox \`*.part\` until complete; the size-stable check (same non-zero size on two polls) covers browsers that write the final name early.
- **Verify contents**, not existence: header, a known row, row count, encoding. For PDFs/XLSX use a parser (PDFBox, Apache POI).

### Approach B: managed downloads on Selenium Grid

On a Grid the file lands on the **node's** disk. Selenium Grid can manage downloads per session: start the node with \`--enable-managed-downloads true\` and request it with the \`se:downloadsEnabled\` capability (\`options.setEnableDownloads(true)\` in Java), then use \`HasDownloads\`:

\`\`\`java
ChromeOptions options = new ChromeOptions();
options.setEnableDownloads(true);
WebDriver driver = new RemoteWebDriver(URI.create(gridUrl).toURL(), options);
// ... click #export-orders-csv ...
HasDownloads downloads = (HasDownloads) driver;
String name = new WebDriverWait(driver, Duration.ofSeconds(30)).until(d ->
        downloads.getDownloadableFiles().stream()
                .filter(n -> n.startsWith("orders-") && n.endsWith(".csv"))
                .findFirst().orElse(null));
downloads.downloadFile(name, localDir);          // copies from the node to the test machine
downloads.deleteDownloadableFiles();             // clean the node for the next test
\`\`\`

The Selenium docs note that listing is a snapshot — Selenium does not wait for downloads to finish — hence the wait. Method names have evolved in recent releases (newer javadoc also lists \`getDownloadedFiles()\`), so check the javadoc of your exact version.

### Approach C: fetch the file over HTTP with the browser's cookies

\`\`\`java
String href = driver.findElement(By.id("export-orders-csv")).getDomProperty("href");   // absolute URL
String cookies = driver.manage().getCookies().stream()
        .map(c -> c.getName() + "=" + c.getValue())
        .collect(Collectors.joining("; "));
HttpResponse<String> response = HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(URI.create(href)).header("Cookie", cookies).GET().build(),
        HttpResponse.BodyHandlers.ofString());
Assert.assertEquals(response.statusCode(), 200);
Assert.assertTrue(response.headers().firstValue("Content-Disposition").orElse("").contains("attachment"));
Assert.assertTrue(response.body().startsWith("orderId,date,status,total"));
\`\`\`

| | How it works | Advantages | Disadvantages | Performance / scalability | When to use |
|---|---|---|---|---|---|
| A. Browser prefs + folder wait | real browser download to a local folder | tests the real user path incl. headers and browser handling | local only; browser-specific prefs; folder hygiene in parallel runs | slowest; one folder per test needed | local/CI-with-local-browser suites, one or two smoke tests |
| B. Grid managed downloads | node stores files per session, client fetches them | real browser path on a Grid | needs Grid config + capability; version-specific API | scales with the Grid | the A test, but on Grid/cloud |
| C. HTTP fetch with cookies | reuse the session, download directly | fast, browser-independent, rich assertions on status/headers/body | does not test the browser's download handling; links built by JS or POST forms need more work; \`HttpOnly\` cookies are fine (WebDriver can read them) | fastest, parallel-friendly | the bulk of content checks (every export format and filter) |

**Recommended approach and why:** one UI smoke test proves the button triggers a download (A locally, B on the Grid); everything about the **content** — columns, filters, encodings, large exports — is verified with C or directly against the export API. That keeps the slow, environment-sensitive part to a single test and puts the many data variations where they are fast and deterministic.

## Playwright (TypeScript) equivalents

\`\`\`ts
await page.frameLocator('#support-frame').frameLocator('#chat-frame').locator('#chat-input').fill('Hi'); // no switching
const popup = await Promise.all([page.waitForEvent('popup'), page.click('#popup-btn')]).then(([p]) => p);
page.once('dialog', d => d.accept());                     // dialogs are auto-dismissed if unhandled
await page.locator('#draggable').dragTo(page.locator('#droppable'));
await page.locator('coupon-widget #coupon-code').fill('BADCODE');   // CSS pierces open shadow roots
await page.locator('#upload-file').setInputFiles('fixtures/licence.pdf');
const download = await Promise.all([page.waitForEvent('download'), page.click('#export-orders-csv')]).then(([d]) => d);
\`\`\`

The contrast to articulate: Playwright has no global "current context" (frames are locators), pierces open shadow roots by default, and has first-class download/popup events; Selenium's model is explicit context switching on a W3C session. Architecture background: \`pw-deep-architecture\`.

## Best practices for experienced engineers

- Context changes (frames, windows) happen only in scoped helpers with \`finally\`; elements never cross a context boundary.
- Identify new windows by set difference or by content, never by position; clean up leftover windows in teardown.
- Keep the spec-default prompt handler (or \`IGNORE\`) in functional suites; log \`getAlertText()\` from \`UnhandledAlertException\`.
- Actions: always \`perform()\`; pair keyDown/keyUp; scroll before pointer moves; \`resetInputState()\` in teardown for keyboard-heavy suites; take the modifier from the browser's platform.
- JavaScript observes, positions and arranges — it does not perform the action under test; fallbacks are centralised and logged.
- Shadow DOM through page components with CSS locators; closed roots are a testability conversation, not a hack.
- Uploads: absolute paths, \`LocalFileDetector\` on \`RemoteWebDriver\`; downloads: per-test folder, wait for completion, verify content, push content checks to HTTP/API.

## Interview questions

### Q: What exactly happens when you call switchTo().frame("supportFrame")?
**Short answer (30–60 s):** The Java client looks for a frame or iframe whose name, then id, matches, and sends the W3C Switch To Frame command with that element; the session's current browsing context becomes the frame's document, and every later command runs there until you switch again. It does not wait — \`frameToBeAvailableAndSwitchToIt\` is the waiting form.

**Detailed answer:** Switch To Frame accepts an index, an element reference or null. Element references are per-document, so references from the parent are unusable inside the frame. There is no command to ask which frame you are in, which is why a good helper takes an absolute frame path, starts from \`defaultContent()\` and restores to it in \`finally\`. \`parentFrame()\` goes one level up and is useful inside nested paths; \`defaultContent()\` is the safe reset. Cross-origin frames work via WebDriver even though page JavaScript cannot cross them.

### Q: How do you reliably switch to a window opened by a click?
**Short answer (30–60 s):** Capture the handle set before the click, click, then wait until the set difference contains exactly one new handle and switch to it. When several windows open at once, switch through them and match on title or URL inside a wait.

**Detailed answer:** \`getWindowHandles()\` is exposed as a \`Set\` and the order is not "order of opening", so index-based picks are flaky. \`numberOfWindowsToBe(n)\` is fine when you know the exact count, but the set difference is robust against leftover windows. After closing, always switch explicitly; for pop-ups that close themselves, poll \`getWindowHandles()\` (which works without a current context) until the handle disappears. \`newWindow(WindowType.TAB)\` opens and switches in one call for side-by-side scenarios.

### Q: What is unhandledPromptBehavior and what would you set it to?
**Short answer (30–60 s):** A W3C capability that decides what the driver does when a command hits an open user prompt: dismiss, accept, dismiss and notify, accept and notify or ignore. The spec default is dismiss and notify — the dialog is dismissed and the command fails with UnhandledAlertException. For functional suites I keep a notify variant or ignore, so unexpected dialogs fail visibly.

**Detailed answer:** Auto-accepting can confirm destructive dialogs nobody asserted on and hide product changes (a new confirmation step). Auto-dismissing silently can take a different code path. \`UnhandledAlertException.getAlertText()\` gives the text for the report. Expected dialogs are handled explicitly with \`alertIsPresent()\`. Crawlers and visual smoke runs may use accept/dismiss to keep moving.

### Q: Explain the W3C Actions model. What does perform() send, and what is the difference between Actions.release() and releasing actions?
**Short answer (30–60 s):** Actions are per input source — key, pointer, wheel, none — and are executed in ticks: the n-th action of every source runs together. \`perform()\` sends all sequences in one Perform Actions request. \`Actions.release()\` is a pointer-up inside the chain; the Release Actions command (Java \`resetInputState()\`) resets all pressed keys and buttons in the session.

**Detailed answer:** Input state persists across \`perform()\` calls, so a forgotten \`keyUp\` leaks a held modifier into later steps — \`Keys.chord\` ends with \`Keys.NULL\` to avoid it. Element origins target the in-view centre; if it is outside the viewport you get \`MoveTargetOutOfBoundsException\` — scroll first (wheel \`scrollToElement\` in Selenium 4.2+, or \`scrollIntoView\`). Actions clicks do not perform the Element Click interception check, so they can "click through" in ways a user cannot; prefer \`element.click()\` unless you need a gesture.

### Q: Drag and drop does nothing in Chrome. How do you approach it?
**Short answer (30–60 s):** First identify the implementation: mouse/pointer events or HTML5 drag-and-drop. For pointer-based widgets, use the step-by-step chain with intermediate moves and pauses to cross drag thresholds. For HTML5 DnD, synthesized input may not start a native drag session in some drivers; then a documented JS DragEvent simulation is the fallback.

**Detailed answer:** Check the element for \`draggable="true"\` and listeners in DevTools (\`dragstart\`/\`drop\` vs \`mousedown\`/\`pointermove\`). \`dragAndDrop\` is one jump — libraries like sortable lists often require several \`mousemove\` events beyond a threshold. The JS fallback dispatches \`dragstart → dragenter → dragover → drop → dragend\` with a shared \`DataTransfer\`; its events are untrusted, it skips browser drag logic, and it should live in one logged helper. Verify across the browser matrix — behaviour differs between drivers and versions.

### Q: When is JavascriptExecutor appropriate, and what is your policy?
**Short answer (30–60 s):** For observing (computed styles, storage, file input contents), positioning (scrollIntoView centre) and arranging preconditions. Not for performing the action under test: JS click and value-setting bypass visibility, interception, enablement and key events, so tests pass where users fail.

**Detailed answer:** Mechanically, the script is a function body with \`arguments\`; numbers come back as Long or Double, arrays as List, objects as Map, elements as WebElement; \`executeAsyncScript\` gets a callback as the last argument and is bounded by the script timeout. The policy: fallbacks such as JS click are in one helper, used only after waiting for overlays and scrolling, and log a warning with the reason, so the count of fallbacks is visible in reports and reviewed.

### Q: What can and cannot you do with getShadowRoot()?
**Short answer (30–60 s):** It returns a SearchContext for an open shadow root; you can find elements inside it with CSS (and Java's id/class/tag/name locators, which are sent as CSS). XPath does not work there in practice, closed roots are not accessible, and each nested component needs another \`getShadowRoot()\` hop.

**Detailed answer:** \`NoSuchShadowRootException\` means no open root; \`DetachedShadowRootException\` means the host re-rendered — re-find from the host each poll. \`ExpectedConditions\` with \`By\` search the document, so waits on shadow content are lambdas. The JS \`shadowRoot.querySelector\` fallback is useful in old stacks or for deep generic traversal. Closed roots: test via behaviour/keyboard or ask for test builds with open roots.

### Q: How do uploads and downloads change when tests run on Selenium Grid?
**Short answer (30–60 s):** The browser's file system is the node's. For uploads, set \`LocalFileDetector\` on the \`RemoteWebDriver\` so the client transfers the file to the node. For downloads, use Grid managed downloads (\`se:downloadsEnabled\` + node flag + \`HasDownloads\`) or verify content over HTTP/API instead.

**Detailed answer:** Without the detector, \`sendKeys("/home/ci/fixtures/a.pdf")\` sends a path that does not exist on the node → invalid argument. Local drivers reject \`setFileDetector\`, so the factory sets it only for remote sessions. For downloads, per-session isolation on the node, waiting for completion (listing is a snapshot) and cleaning up with \`deleteDownloadableFiles()\` matter; most content variations belong in fast HTTP/API tests.

## Scenario-based questions

### Scenario 1: "NoSuchElementException, but it's right there"
The new payment step fails to find \`#card-number\` although it is visible in the screenshot. **Reasoning:** classic context problem. In DevTools, walk up from the element: an \`#document\` boundary means an iframe (payment providers always use one), a \`#shadow-root\` means a web component. **Action:** log the current context with the JS snippet; for a frame, add the frame path to the page object via the scoped helper; for shadow DOM, a component object with \`getShadowRoot()\`. Then check why it worked before — maybe the provider started injecting the iframe late, which needs \`frameToBeAvailableAndSwitchToIt\`, not a sleep.

### Scenario 2: random failures after the "Export" test in a parallel run
After adding a download test, unrelated tests in the same worker fail with odd keyboard behaviour and an extra tab. **Reasoning:** the download test opened a preview tab and left it open; another test in the same session held \`keyDown(SHIFT)\` without \`keyUp\`. Both are session-level state leaks. **Action:** teardown closes all non-main handles and calls \`resetInputState()\`; download folders are per test (UUID) so parallel tests do not read each other's files; keyboard chords use \`Keys.chord\` or paired keyDown/keyUp.

### Scenario 3: a teammate proposes JS click everywhere "because it never flakes"
**Reasoning:** it never flakes because it never checks what a user experiences — overlays, disabled states and off-screen elements are all ignored, so a cookie banner covering "Place order" in production would pass every test. **Action:** show the data: list the intercepted-click failures and their causes (spinner, sticky header, banner); fix them with waits for the overlay, centred scrolling and consent seeding in setup; keep one logged fallback helper for documented third-party widgets; add the fallback count to the run report.

## Tricky follow-ups

- **Q: Does \`driver.close()\` on the last window end the session?** It closes the window; with no windows left most drivers end the browser, but the session object still needs \`quit()\` to release the driver process — always \`quit()\` in teardown.
- **Q: Can \`executeScript\` read inside a cross-origin iframe from the main page?** No — same-origin policy applies to page scripts. Switch into the frame first; WebDriver commands are not subject to it.
- **Q: \`alertIsPresent()\` returned, then \`getText()\` threw \`NoAlertPresentException\`. How?** The page closed the dialog (or a prompt handler or another thread did) between the two calls — in parallel runs, check for a shared driver.
- **Q: Why does \`moveToElement\` fail with \`MoveTargetOutOfBoundsException\` when \`click()\` on the same element works?** Element Click scrolls into view itself; a W3C pointer move with an element origin does not — scroll first.
- **Q: Can you type a path into a file input on a Grid node without \`LocalFileDetector\`?** Only if the path exists on the node (e.g. fixtures baked into the node image) — otherwise invalid argument.`,
  keyPoints: [
    'Every command runs in the session\'s current browsing context; frame and window switches never happen automatically, and element references are per document.',
    'Frames and windows belong in scoped helpers: absolute frame path + finally defaultContent(); new windows by handle-set difference or title/URL predicate, never by position.',
    'unhandledPromptBehavior (spec default "dismiss and notify") decides what happens to unexpected dialogs; keep a notify/ignore setting in functional suites and handle expected dialogs with alertIsPresent().',
    'W3C Actions: input sources executed in ticks, one Perform Actions request per perform(), persistent input state reset by resetInputState(); Actions.release() is just pointer-up; scroll before pointer moves.',
    'HTML5 drag-and-drop may not start from synthesized input — try step-by-step chains first, then a logged JS DragEvent fallback.',
    'JavaScript may observe, position and arrange preconditions, not perform the action under test; know the Long/Double/List/Map/WebElement return mapping.',
    'getShadowRoot() gives a CSS-only SearchContext for open roots; closed roots are unreachable; waits on shadow content are lambdas that re-find from the host.',
    'Uploads: absolute path via sendKeys, newline for multiple files, LocalFileDetector on RemoteWebDriver; downloads: per-test folder, wait for completion, verify content — use Grid managed downloads or HTTP/API checks at scale.',
  ],
  mistakes: [
    'Switching into a frame in one page-object method and relying on the next method to switch out — a failure in between leaves every later step (and the failure screenshot\'s page source) in the frame. Fix: a scoped helper with finally defaultContent(); return values, not WebElements, from inside.',
    'Picking the new tab with new ArrayList<>(getWindowHandles()).get(1). Fix: diff the handle set before/after the click inside a wait, or match on title/URL; close leftover windows in teardown.',
    'Setting unhandledPromptBehavior to ACCEPT to "stop the alert errors", which silently confirms destructive dialogs. Fix: keep the notify default or IGNORE, log UnhandledAlertException.getAlertText(), and handle expected dialogs explicitly.',
    'Holding a modifier with keyDown and never releasing it, so later typing produces selections or shortcuts. Fix: Keys.chord (ends with Keys.NULL) or paired keyUp, plus resetInputState() in teardown; take the modifier from the browser\'s platform capability.',
    'Using XPath inside a shadow root and getting "invalid argument: invalid locator". Fix: CSS from getShadowRoot(), one hop per nested component, lambda waits that re-find from the host.',
    'Upload tests that pass locally and fail on Grid with invalid argument, or download tests that find an empty folder on Grid. Fix: LocalFileDetector on RemoteWebDriver; managed downloads (se:downloadsEnabled + node flag) or verify the file over HTTP/API.',
  ],
  tryIt: `On ShopEasy (\`http://localhost:5180/practice-site/\`): (1) implement \`Frames.call\` and on \`frames.html\` send two chat messages in \`#chat-frame\` (inside \`#support-frame\`), assert both \`.chat-line\` texts, then deliberately throw inside the lambda and prove the driver is back on the main page (\`#main-page-text\` is readable); (2) on \`windows.html\` click "Open terms + privacy", switch by title to the Privacy Policy tab, close it and return; then open the chat pop-up, click its own "Close this window" and recover with \`waitUntilClosedAndReturnTo\`; (3) on \`alerts.html\` start a session with \`UnexpectedAlertBehaviour.DISMISS_AND_NOTIFY\`, click "Alert after 3 seconds", wait 4 s with no alert handling, then call \`getTitle()\` and print \`getAlertText()\` from the exception; (4) on \`dynamic.html\` run the three drag-and-drop approaches against \`#draggable\`/\`#droppable\` (reload between them) and record which ones change \`#dynamic-result\` in Chrome and Firefox; (5) on \`form.html\` try sending two newline-separated paths to \`#upload-file\` and read the error — then explain it from the input's attributes.`,
  problems: ['sel-005', 'sel-009', 'sel-011', 'sel-038'],
}
