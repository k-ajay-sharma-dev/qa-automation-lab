export default {
  id: 'sel-001',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Your first WebDriver script: open ShopEasy and check the title',
  level: 'BEGINNER',
  tags: ['webdriver', 'setup', 'selenium-manager'],
  estMinutes: 10,
  scenario: `You have just joined the ShopEasy automation squad. Your lead asks for a quick "smoke" proof that your laptop can drive Chrome before you are given real tickets: open the login page, confirm the browser tab title, and close everything cleanly. Last week a new joiner left 40 zombie \`chromedriver.exe\` processes on the shared Jenkins agent, so the cleanup part matters as much as the check.`,
  description: `Write a \`main\` method that:

1. Starts Chrome with \`new ChromeDriver()\` — **Selenium 4.6+ ships Selenium Manager**, so no \`System.setProperty("webdriver.chrome.driver", ...)\` and no manual driver download.
2. Opens \`http://localhost:5180/practice-site/login.html\` with \`driver.get(...)\`.
3. Reads \`driver.getTitle()\` and \`driver.getCurrentUrl()\` and prints them.
4. Throws an \`AssertionError\` if the title does not contain \`ShopEasy\`.
5. Always calls \`driver.quit()\` — even when the check fails.

**Rules**
- Declare the variable as the \`WebDriver\` interface, not \`ChromeDriver\`.
- Use \`try / finally\` so \`quit()\` always runs.
- No \`Thread.sleep\` — \`get()\` already waits for the page load event.`,
  hints: [
    '`WebDriver driver = new ChromeDriver();` is all the setup Selenium 4 needs.',
    '`driver.get(url)` blocks until document.readyState is complete, so you can read the title right after it.',
    'Put `driver.quit()` in a `finally` block so it runs even if your assertion throws.',
  ],
  starterCode: `package com.shopeasy.smoke;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class FirstScript {

    public static void main(String[] args) {
        // TODO: start Chrome
        // TODO: open http://localhost:5180/practice-site/login.html
        // TODO: print title and current URL
        // TODO: fail if the title does not contain "ShopEasy"
        // TODO: always quit the browser
    }
}
`,
  solution: `package com.shopeasy.smoke;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class FirstScript {

    private static final String LOGIN_URL = "http://localhost:5180/practice-site/login.html";

    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver(); // Selenium Manager resolves chromedriver
        try {
            driver.manage().window().maximize();
            driver.get(LOGIN_URL);

            String title = driver.getTitle();
            System.out.println("Title: " + title);
            System.out.println("URL:   " + driver.getCurrentUrl());

            if (!title.contains("ShopEasy")) {
                throw new AssertionError("Expected title to contain 'ShopEasy' but was: " + title);
            }
            System.out.println("Smoke check passed");
        } finally {
            driver.quit();
        }
    }
}
`,
  checks: [
    { label: 'Declares the WebDriver interface and creates a ChromeDriver', pattern: 'WebDriver\\s+\\w+\\s*=\\s*new\\s+ChromeDriver\\s*\\(', hint: 'WebDriver driver = new ChromeDriver();' },
    { label: 'Opens the login page with get()', pattern: '\\.get\\s*\\(\\s*("[^"]*login\\.html"|[A-Z_]+)\\s*\\)', hint: 'driver.get("http://localhost:5180/practice-site/login.html")' },
    { label: 'Reads the page title', pattern: '\\.getTitle\\s*\\(\\s*\\)', hint: 'Use driver.getTitle()' },
    { label: 'Quits the browser in a finally block', pattern: 'finally\\s*\\{[^}]*\\.quit\\s*\\(\\s*\\)', flags: 'ms', hint: 'try { ... } finally { driver.quit(); }' },
    { label: 'No manual driver path (Selenium Manager handles it)', pattern: 'webdriver\\.chrome\\.driver', mustNot: true, hint: 'Selenium 4.6+ downloads the driver for you; remove System.setProperty' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'driver.get() already waits for page load' },
  ],
  explanation: `\`new ChromeDriver()\` starts a chromedriver process and a fresh Chrome profile. Since Selenium 4.6, **Selenium Manager** detects your installed Chrome version and downloads the matching driver into \`~/.cache/selenium\`, so the old \`System.setProperty("webdriver.chrome.driver", ...)\` line and WebDriverManager dependency are no longer needed.

\`driver.get()\` waits for the page's load event (the default \`pageLoadStrategy\` is \`normal\`), so reading the title immediately afterwards is safe. It does **not** wait for AJAX content — that is what explicit waits are for later.

\`quit()\` in \`finally\` is the habit a reviewer looks for first: \`quit()\` ends the WebDriver session and kills chromedriver; \`close()\` only closes the current window. Forgetting this is exactly how CI agents fill up with orphan browser processes.

Typing the variable as \`WebDriver\` keeps the rest of your code browser-agnostic — later you can swap in \`FirefoxDriver\` or \`RemoteWebDriver\` without touching anything else.`,
  mistakes: [
    'Copying an old tutorial with System.setProperty and a hard-coded chromedriver path that breaks on every Chrome auto-update.',
    'Calling driver.close() instead of driver.quit() and leaving chromedriver processes running.',
    'Putting quit() at the end of the try block, so a failing assertion skips it.',
    'Adding Thread.sleep(3000) after get() "to be safe".',
  ],
  interview: [
    { q: 'What is Selenium Manager?', a: 'A tool bundled with Selenium 4.6+ that automatically detects the browser version and downloads/caches the matching driver binary (and even the browser itself if needed). It replaces manual driver downloads and third-party libraries like WebDriverManager.' },
    { q: 'What does driver.get() wait for?', a: 'With the default normal page load strategy it waits until document.readyState is "complete". It does not wait for XHR/fetch calls or elements rendered later by JavaScript.' },
    { q: 'Why declare WebDriver instead of ChromeDriver?', a: 'Programming to the interface lets the same test code run on Chrome, Firefox, Edge or a remote Grid by changing only the line that creates the driver.' },
  ],
}
