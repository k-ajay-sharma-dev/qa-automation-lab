export default {
  slug: 'selenium-alerts-frames-windows',
  category: 'selenium',
  order: 6,
  title: 'Switching context: alerts, iframes, windows and shadow DOM',
  minutes: 10,
  summary: 'Know where the driver is "standing" and move it with switchTo(): into browser alerts, into and out of nested iframes, and between tabs and windows.',
  manualAnalogy: `As a manual tester you always know where your attention is: on a pop-up that blocks the page, inside an embedded payment widget, or in the new tab that just opened. The driver has exactly one place it is "looking" at any moment, and — unlike you — it never moves its attention on its own. You must tell it with \`driver.switchTo()\`.`,
  body: `## The one rule

WebDriver only searches and acts in its **current context**: one window, one document (the main page or one iframe). Nothing you see on screen changes that context automatically — not a new tab opening, not an alert popping up. If an element "is clearly there" but Selenium cannot find it, the first question is: *am I in the right context?*

## 1. Browser alerts (JavaScript dialogs)

\`alert()\`, \`confirm()\` and \`prompt()\` are drawn by the **browser**, not the page. You cannot inspect them in DevTools and \`findElement\` cannot see them.

\`\`\`java
driver.findElement(By.id("delayed-alert-btn")).click();     // alerts.html
Alert alert = wait.until(ExpectedConditions.alertIsPresent());
String text = alert.getText();
alert.accept();          // OK
\`\`\`

| Method | Meaning |
|---|---|
| \`accept()\` | Click OK |
| \`dismiss()\` | Click Cancel (on a confirm) |
| \`getText()\` | Read the message |
| \`sendKeys("x")\` | Type into a prompt before accepting |

\`alertIsPresent()\` waits for the dialog **and** switches to it, returning the \`Alert\`. Without a wait, a dialog that appears a moment later gives you \`NoAlertPresentException\`. While an alert is open, any other command fails with \`UnhandledAlertException\` — handle it first.

**HTML modals are different.** A styled "Are you sure?" box made of \`<div>\`s *is* part of the page: you can inspect it, so you click its buttons with normal \`findElement(...).click()\` and wait for the overlay to become invisible. Rule of thumb: *if DevTools can inspect it, it is not an Alert.*

## 2. Iframes: a page inside the page

An \`<iframe>\` embeds a separate HTML document — typical for payment fields, chat widgets and support forms. Its elements are invisible to the main document's \`findElement\`.

Think of frames like folders:

\`\`\`text
main page            (defaultContent)   = /
└── #support-frame   (outer iframe)     = /support
    └── #chat-frame  (nested iframe)    = /support/chat
\`\`\`

\`\`\`java
wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(By.id("support-frame")));
driver.findElement(By.id("support-email")).sendKeys("me@example.com");   // inside the frame

driver.switchTo().defaultContent();       // back to the main page ("cd /")
\`\`\`

- \`frameToBeAvailableAndSwitchToIt(locator)\` waits for the frame to load and switches in — one line.
- To reach a **nested** frame you must already be inside its parent; frames are entered one level at a time.
- \`switchTo().parentFrame()\` goes **up one level** ("cd .."); \`defaultContent()\` jumps straight to the main page ("cd /").
- Switch by locator, not by index (\`frame(0)\`): the index changes as soon as someone adds an ad or analytics frame.

Always switch back out when you are done — the next page-object method assumes it is on the main page.

## 3. Windows and tabs

Each window/tab has a **handle** — a unique string id.

\`\`\`java
String original = driver.getWindowHandle();          // where I am now
driver.findElement(By.id("popup-btn")).click();      // windows.html
wait.until(ExpectedConditions.numberOfWindowsToBe(2));

for (String handle : driver.getWindowHandles()) {
    if (!handle.equals(original)) {
        driver.switchTo().window(handle);
        break;
    }
}
// ... check the pop-up ...
driver.close();                          // closes the CURRENT window only
driver.switchTo().window(original);      // the driver is pointing at nothing until you do this
\`\`\`

- \`getWindowHandles()\` returns a **Set** — there is no guaranteed order, so never use "the second handle". Compare with the handle you saved, or switch to each and check the title.
- After \`close()\` the driver still points at the closed window; the next command throws \`NoSuchWindowException\` until you switch.
- When several new windows open at once, pick the right one by \`getTitle()\` or \`getCurrentUrl()\` after switching.

### Selenium 4: open a tab yourself

\`\`\`java
driver.switchTo().newWindow(WindowType.TAB);      // or WindowType.WINDOW
driver.get("http://localhost:5180/practice-site/table.html");
\`\`\`

\`newWindow\` opens **and** switches in one call — useful to compare two pages side by side, or to check an admin page without losing the user session.

## 4. Shadow DOM: a private document inside an element

Web components (\`<coupon-widget>\` on \`dynamic.html\`) can hide their inner HTML in a **shadow root**. DevTools shows it under \`#shadow-root (open)\`, but \`driver.findElement\` stops at the component's tag — a classic "it's right there but NoSuchElement" moment. Unlike frames there is nothing to switch: you search *from* the shadow root.

\`\`\`java
WebElement host = driver.findElement(By.cssSelector("coupon-widget"));
SearchContext root = host.getShadowRoot();                      // Selenium 4
WebElement message = root.findElement(By.cssSelector("#coupon-message"));
\`\`\`

- \`getShadowRoot()\` returns a \`SearchContext\` — it has \`findElement\`/\`findElements\` like the driver.
- Inside a shadow root use **CSS selectors**; Chromium does not support XPath there.
- \`ExpectedConditions\` methods that take a \`By\` search the main document, so wait on the shadow *element* instead (\`visibilityOf(element)\`, \`textToBePresentInElement(element, text)\`).
- A component inside a component: call \`getShadowRoot()\` again on the inner host. Closed shadow roots cannot be reached at all.

## Summary table

| You see | Context switch | Back out |
|---|---|---|
| Browser dialog | \`alertIsPresent()\` / \`switchTo().alert()\` | \`accept()\` / \`dismiss()\` |
| Embedded widget | \`frameToBeAvailableAndSwitchToIt(...)\` | \`parentFrame()\` / \`defaultContent()\` |
| New tab / pop-up | \`switchTo().window(handle)\` | \`switchTo().window(original)\` |
| Web component | \`host.getShadowRoot()\` (no switch needed) | use the driver again |`,
  keyPoints: [
    'The driver has one current context and never switches by itself.',
    'JS alerts are browser dialogs: wait with `alertIsPresent()`, then accept/dismiss/getText/sendKeys. HTML modals are normal elements.',
    'Iframes nest like folders: enter one level at a time; `parentFrame()` = up one, `defaultContent()` = top.',
    'Save the original window handle, wait for the window count, switch by comparing handles.',
    'After `close()`, switch back explicitly. Selenium 4 `newWindow(WindowType.TAB)` opens and switches.',
    'Shadow DOM: `host.getShadowRoot()` gives a SearchContext; search inside it with CSS only.',
  ],
  mistakes: [
    'Trying to `findElement` the OK button of a JS alert — it is not in the DOM. Use the `Alert` API.',
    'Using `switchTo().alert()` on an HTML modal — throws `NoAlertPresentException`. Click the modal\'s buttons instead.',
    'Forgetting `defaultContent()` after working in a frame — the next step on the main page fails with NoSuchElement.',
    'Assuming handle order (`new ArrayList<>(handles).get(1)`) — Sets have no order.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/windows.html\` click "Open terms + privacy". Two tabs open at once. Write (on paper) the loop that would switch to the one whose URL contains \`privacy\`, and what you would do with the original handle afterwards.`,
  problems: ['sel-009', 'sel-010', 'sel-011', 'sel-029'],
}
