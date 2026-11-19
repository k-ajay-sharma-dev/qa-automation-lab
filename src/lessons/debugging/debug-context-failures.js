export default {
  slug: 'debug-context-failures',
  category: 'debugging',
  order: 4,
  title: 'Context failures: iframes, windows and the headless window size',
  minutes: 8,
  summary: 'Diagnose failures where the element is fine but the driver is looking in the wrong place — the wrong frame, a closed or wrong window, or a headless browser rendering a different layout.',
  manualAnalogy: `Imagine a colleague says "the Pay button isn't there" — and you discover they are looking at a different tab, or at the phone layout of the site. The button is fine; their *view* is wrong. Context failures are the automation version: the locator is correct, the page is loaded, and waiting longer changes nothing, because the driver is looking somewhere else.`,
  body: `## The tell-tale sign

The locator works in DevTools, the page is fully loaded on the screenshot, and **adding a wait doesn't help** — the wait just times out. When you see that pattern, stop changing locators and ask: *where is the driver right now?*

Three usual answers: inside the wrong **document** (iframe), in the wrong **window**, or in a **layout** you didn't expect.

## 1. The element is inside an iframe

\`\`\`text
TimeoutException: Expected condition failed: waiting for visibility of element located by By.id: support-email
Caused by: NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#support-email"}
\`\`\`

How to confirm in two clicks:

1. In DevTools, right-click the element → Inspect.
2. Look up the Elements tree: is there an \`<iframe>\` (or \`#document\`) above it? Or check the console's context drop-down (it shows "top" plus each frame).

If yes, the driver must **switch into the frame** first — and switch back to the main page afterwards. Nested frames must be entered level by level. Typical places: payment card fields (third-party), chat widgets, embedded support forms, rich-text editors.

Debug-friendly habit: put the frame switch *inside* the page-object method that needs it, and always return with \`defaultContent()\` in a \`finally\` — so a failure inside the frame doesn't leave the next step stranded there.

## 2. The driver is in the wrong (or a closed) window

\`\`\`text
org.openqa.selenium.NoSuchWindowException: no such window: target window already closed
from unknown error: web view not found
Command: [..., findElement {using=id, value=continue-shopping}]
\`\`\`

Facts that explain almost every window bug:

- Opening a tab **does not** move the driver; it stays on the original until you \`switchTo().window(...)\`.
- \`driver.close()\` closes the **current** window and leaves the driver pointing at nothing. The *next* command fails — so the failing line is often *after* the real mistake.
- \`getWindowHandles()\` is a **Set**: no order. Code that takes "the last handle" or switches to every handle in a loop ends up wherever the loop finished.

Debugging steps:

1. Find the last \`close()\` / \`switchTo().window(...)\` **before** the failing line — the bug is usually there.
2. Log \`driver.getWindowHandle()\` and \`driver.getTitle()\` around window switches.
3. Make sure the code saves the original handle up front and switches back to it explicitly after closing a child window. Wait for the expected number of windows before switching.

### More than two windows: pick by what the user sees

With one child window, "the handle that isn't the original" is unambiguous. With **two or more** it becomes a coin toss — the classic *intermittent* window bug: \`expected [Privacy Policy] but found [Terms of Service]\` on one run in three. Identify the window the way a tester would: by its **title** or **URL**. Loop over the handles, switch, check \`getTitle()\`, and do it inside a wait, because a new tab's title is often set by JavaScript a moment after it opens. Then close every child (switching to each before \`close()\`) and switch back — in a \`finally\`, so one failure doesn't leave extra windows for the next test.

## 3. Green locally, red on Jenkins: headless layout

\`\`\`text
ElementNotInteractableException: element not interactable
  (Session info: chrome-headless-shell=126.0...)
Capabilities {browserName: chrome, goog:chromeOptions: {args: [--headless]} ...}
\`\`\`

Clues: the session info says **headless**; the failure is "not interactable" (found but hidden) or a relative/positional locator picks the wrong element; locally (with a visible, maximised browser) it passes.

What's happening: headless Chrome has **no monitor**. Unless told otherwise it renders at a small default size (about 800x600). A responsive site then switches to its **mobile layout**: the header menu collapses into a hamburger, the desktop link your locator found is hidden, columns stack. \`driver.manage().window().maximize()\` doesn't help — there is no screen to maximise to.

How to prove it in a minute:

- Look at the **failure screenshot** from CI. Does it look like a phone layout?
- Log \`driver.manage().window().getSize()\` at the start of the test on both machines.
- Locally, shrink your browser to ~800 px wide and watch what disappears.

Fix: give the browser an explicit, realistic size through options (\`--window-size=...\`), and prefer the modern \`--headless=new\` mode so headless behaves like real Chrome. If mobile layouts matter, test them deliberately with their own size and locators.

## A context checklist to run before touching a locator

| Check | How |
|---|---|
| Which window am I in? | \`getWindowHandle()\`, \`getTitle()\`, \`getCurrentUrl()\` |
| Am I inside a frame? | DevTools tree / console context drop-down; does code switch in and back out? |
| What size is the browser? | \`window().getSize()\`; headless flags in the Capabilities line |
| Does the screenshot match what I expect? | Always open it first |`,
  keyPoints: [
    'Locator works in DevTools + waiting doesn\'t help = context problem, not timing.',
    'Elements in iframes need a switch in (level by level) and a switch back to `defaultContent()`.',
    'New tabs don\'t move the driver; `close()` leaves it pointing at nothing — the next line fails.',
    'Headless has no screen: set `--window-size`, use `--headless=new`; `maximize()` is not enough.',
    'The CI failure screenshot usually reveals the wrong layout or wrong page instantly.',
  ],
  mistakes: [
    'Increasing the timeout for an element that lives in an iframe.',
    'Looking only at the failing line for a window bug — the real mistake is the earlier `close()` or switch.',
    'Assuming `getWindowHandles()` returns handles in opening order.',
    'Debugging a headless-only failure locally with a maximised browser and concluding "can\'t reproduce".',
  ],
  tryIt: `Open \`http://localhost:5180/practice-site/frames.html\`, open DevTools Console and switch the context drop-down from "top" to the support frame. Run \`document.getElementById('support-email')\` in both contexts and compare — that is exactly what the driver experiences.`,
  problems: ['dbg-004', 'dbg-005', 'dbg-006', 'dbg-020'],
}
