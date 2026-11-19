export default {
  slug: 'selenium-webdriver-basics',
  category: 'selenium',
  order: 1,
  title: 'How Selenium WebDriver drives a real browser',
  minutes: 7,
  summary: 'Understand what happens between your Java code and Chrome, start a browser with Selenium Manager, open a page, check it, and always clean up with quit().',
  manualAnalogy: `When you test by hand you open the browser, type a URL, look at the tab title and close the browser when you are done. Selenium does exactly the same steps — but instead of your hands on the mouse, a small program called a *driver* receives instructions from your Java code and performs them inside the browser. You are writing the test case once; the driver executes it as many times as you like.`,
  body: `## The three pieces

Every Selenium run has three players:

| Piece | What it is | Manual-testing equivalent |
|---|---|---|
| Your Java test | The instructions ("open this URL", "click that button") | Your written test case |
| The driver (\`chromedriver\`, \`geckodriver\`) | A small program that understands WebDriver commands | The tester's hands |
| The browser | Real Chrome / Firefox / Edge | The browser on your desk |

Your code sends each command as an HTTP request to the driver ("W3C WebDriver protocol"); the driver tells the browser what to do and sends the answer back. That is why one line such as \`driver.getTitle()\` is a full round trip: Java → driver → browser → driver → Java.

## Selenium Manager: no more driver downloads

Before Selenium 4.6 you had to download the right \`chromedriver.exe\` yourself and point to it with \`System.setProperty("webdriver.chrome.driver", ...)\`. Every Chrome auto-update broke the suite. Since 4.6, **Selenium Manager** ships inside Selenium: when you write \`new ChromeDriver()\` it checks your Chrome version, downloads the matching driver into a cache and starts it. So in a modern project the setup is one line.

## A first script, line by line

\`\`\`java
WebDriver driver = new ChromeDriver();          // 1
try {
    driver.get("http://localhost:5180/practice-site/inventory.html"); // 2
    String heading = driver.getTitle();         // 3
    String url = driver.getCurrentUrl();
    System.out.println(heading + " @ " + url);
    if (!url.contains("inventory")) {           // 4
        throw new AssertionError("Wrong page: " + url);
    }
} finally {
    driver.quit();                              // 5
}
\`\`\`

1. \`WebDriver\` is an **interface** — a contract that says "every browser driver can do get, findElement, quit…". \`ChromeDriver\` is one class that fulfils the contract. Declaring the variable as \`WebDriver\` means you can later swap in \`FirefoxDriver\` or a Grid driver without touching the rest of the code.
2. \`get(url)\` opens the page **and waits for the page load event** (the browser's spinner stops). You do not need a sleep after it.
3. \`getTitle()\` returns the text in the browser tab; \`getCurrentUrl()\` returns the address bar.
4. A check. Later you will use TestNG \`Assert\` instead, but an \`AssertionError\` is all a plain \`main\` method needs to fail loudly.
5. \`finally\` runs whether the \`try\` block passed or threw. That guarantees the browser closes even when the check fails.

## close() vs quit()

| Method | What it closes | Session afterwards |
|---|---|---|
| \`driver.close()\` | Only the **current** window/tab | Still alive if other windows are open — but the driver is now pointing at nothing |
| \`driver.quit()\` | **Every** window, the session and the driver process | Dead; the object cannot be reused |

In teardown you almost always want \`quit()\`. If you only \`close()\`, the \`chromedriver\` process keeps running in the background. On a shared Jenkins agent those "zombie" processes pile up until the machine runs out of memory.

## findElement vs findElements (a preview)

You will meet these properly in the next lesson, but one rule is worth knowing on day one:

- \`findElement(by)\` returns **one** element, or **throws** \`NoSuchElementException\` if nothing matches.
- \`findElements(by)\` returns a **List** — an **empty list** when nothing matches. It never throws for "no match" and never returns \`null\`.

So "is this element absent?" is a \`findElements(...).isEmpty()\` question, not a try/catch around \`findElement\`.

## Why "wait for page load" is not "wait for everything"

\`get()\` waits for the browser's load event. Modern pages keep fetching data with JavaScript *after* that event, so an element can still appear a second later. That is the job of explicit waits — see the *Explicit and fluent waits* lesson.`,
  keyPoints: [
    'Your code talks to a driver program, and the driver controls the real browser.',
    'Selenium 4.6+ includes Selenium Manager: `new ChromeDriver()` finds or downloads the right driver for you.',
    'Declare variables as the `WebDriver` interface so the browser can be swapped later.',
    '`get()` waits for page load; no `Thread.sleep` needed right after it.',
    '`quit()` in a `finally` block (or teardown) — `close()` only closes one window.',
    '`findElement` throws when nothing matches; `findElements` returns an empty list.',
  ],
  mistakes: [
    'Keeping an old `System.setProperty("webdriver.chrome.driver", ...)` line — it overrides Selenium Manager and breaks on the next Chrome update. Delete it.',
    'Calling `quit()` only at the end of the `try` block — when the check throws, the line is never reached. Put it in `finally`.',
    'Using `close()` in teardown and leaving `chromedriver` processes running. Use `quit()`.',
    'Declaring `ChromeDriver driver = ...` everywhere, which ties the whole framework to one browser.',
  ],
  tryIt: `Open Task Manager (or \`ps\`), run a tiny script that opens \`http://localhost:5180/practice-site/index.html\` and ends without \`quit()\`. Watch the \`chromedriver\` process stay alive. Add \`quit()\` in a \`finally\` and run again — it disappears.`,
  problems: ['sel-001', 'sel-002'],
}
