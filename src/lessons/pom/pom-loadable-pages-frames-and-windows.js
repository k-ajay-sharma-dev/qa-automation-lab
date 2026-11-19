export default {
  slug: 'pom-loadable-pages-frames-and-windows',
  category: 'pom',
  order: 9,
  title: 'Knowing where you are: loadable pages, frames and windows',
  minutes: 9,
  summary: 'Make page objects verify that their page is really on screen, and hide iframe and window switching inside page objects so tests never deal with context.',
  manualAnalogy: `Before you execute a step by hand, you glance at the screen: "Am I really on the cart? Is this the pop-up or the main window?" You would never type an address into the wrong tab and then report a bug on step 9. Page objects need the same habit: confirm the screen before acting, and always know which window or frame the driver is looking at.`,
  body: `## The problem: the driver only sees one context at a time

Selenium's driver always looks at **one document**: one window or tab, and inside it the main page *or* one iframe.
Three things go wrong when page objects ignore that:

| Situation | What the test reports |
|---|---|
| Navigation silently failed (still on login) | \`NoSuchElementException\` three pages later |
| Driver left inside an iframe | main-page element "does not exist" |
| A tab was closed but the driver not moved | \`NoSuchWindowException\` |

All three are solved the same way: the page object, not the test, takes responsibility for its context.

## 1. Loadable pages: check identity on creation

A *loadable* page object checks it is really displayed when it is created. Pick **two cheap signals**: part of the URL
and one element that only this page has.

\`\`\`java
public class CartPage extends BasePage {
    private final By cartList = By.id("cart-list");

    public CartPage(WebDriver driver) {
        super(driver);
        try {
            wait.until(ExpectedConditions.and(
                    ExpectedConditions.urlContains("cart.html"),
                    ExpectedConditions.presenceOfElementLocated(cartList)));
        } catch (TimeoutException e) {
            throw new IllegalStateException("Expected the Cart page but was on " + driver.getCurrentUrl(), e);
        }
    }
}
\`\`\`

- \`ExpectedConditions.and(a, b)\` waits until **both** conditions are true.
- Catching \`TimeoutException\` and re-throwing with the current URL turns a vague failure into
  "Expected the Cart page but was on …/login.html" — triage in seconds.
- This is not a business assertion; it is a precondition, like refusing to run step 5 when step 4's screen never came.
- Selenium also ships a \`LoadableComponent<T>\` base class with \`isLoaded()\` / \`load()\` methods built on the same idea.

Do not use the header cart link as the identity element: it is on several pages and proves nothing.

## 2. Frames: every method walks in and walks out

An \`<iframe>\` is a separate document. Its elements are invisible to the driver until you switch in, and the main
page is invisible until you switch out. Wrap each frame interaction as a small transaction:

\`\`\`java
public void sendChatMessage(String text) {             // the live chat inside the support widget
    wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(By.id("support-frame")));
    try {
        wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(By.id("chat-frame")));
        type(By.id("chat-input"), text);
        click(By.id("chat-send"));
    } finally {
        driver.switchTo().defaultContent();             // back to the top, whatever happened
    }
}
\`\`\`

- \`frameToBeAvailableAndSwitchToIt\` waits for the frame to load **and** switches — safer than \`switchTo().frame(...)\` immediately after navigation.
- \`finally\` runs even when a line inside throws, so a failure never leaves the driver stuck inside the frame.
- \`defaultContent()\` jumps to the top document; \`parentFrame()\` goes up one level (useful with nested frames like \`#chat-frame\` inside \`#support-frame\`).
- Prefer frame ids/names over indexes: \`frame(0)\` changes meaning when someone adds an ad iframe.

## 3. Windows and tabs: the page that opens it switches to it

\`driver.getWindowHandles()\` returns a **Set** of ids — its order is not a promise. Reliable recipe:

\`\`\`java
String original = driver.getWindowHandle();          // 1. remember who you are, BEFORE clicking
Set<String> before = driver.getWindowHandles();
click(By.id("open-two-btn"));                        // opens Terms + Privacy on windows.html
wait.until(ExpectedConditions.numberOfWindowsToBe(before.size() + 2));   // 2. wait for the new tabs
for (String handle : driver.getWindowHandles()) {    // 3. pick by something meaningful
    driver.switchTo().window(handle);
    if (driver.getTitle().contains("Privacy Policy")) break;
}
\`\`\`

In a page object this becomes a method that returns the new page **already switched**, and the new page keeps the
original handle so its "close" method can \`driver.close()\` and \`switchTo().window(original)\` before returning the
old page. Remember: \`close()\` closes the current tab only and does **not** move the driver; \`quit()\` ends the
whole session and belongs in teardown.

## The common rule

Tests never call \`switchTo()\` and never wonder which page they are on. Context changes happen inside page
objects, and the **return type** says where the user is afterwards.`,
  keyPoints: [
    'A loadable page waits for a URL fragment plus one unique element and fails with the current URL if it is not shown.',
    'The identity check is a precondition, not a business assertion.',
    'Switch into frames with frameToBeAvailableAndSwitchToIt and switch back in a finally block.',
    'Remember the original window handle before clicking, wait for the new window count, and pick handles by elimination or title — never by index.',
    'close() leaves the driver on a dead window until you switch; quit() ends the session.',
    'Tests never call switchTo(); page objects own context changes and return the right page.',
  ],
  mistakes: [
    'Checking only the URL in a single-page app — the URL changes before the content renders; add an element check.',
    'Switching back to the main document only on the happy path — use finally.',
    'Picking the new tab with new ArrayList<>(handles).get(1) — Set order is not guaranteed; filter out the original handle.',
    'Calling driver.quit() to close a pop-up — it kills the whole browser session.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/frames.html, open DevTools and look at the Elements panel: find \`#support-frame\` and, inside its document, \`#chat-frame\`. In the console, the context dropdown (top-left, "top") lets you switch which document \`document.querySelector\` searches — exactly what \`switchTo().frame()\` does for Selenium. Try \`document.querySelector('#chat-input')\` in "top" and then in the chat frame's context.`,
  problems: ['pom-020', 'pom-022', 'pom-024'],
}
