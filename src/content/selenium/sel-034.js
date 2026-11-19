export default {
  id: 'sel-034',
  category: 'selenium',
  kind: 'quiz',
  title: 'Driver setup: Selenium Manager, WebDriverManager and a clean teardown',
  level: 'BEGINNER',
  tags: ['setup', 'selenium-manager', 'WebDriverManager', 'teardown', 'quit'],
  estMinutes: 8,
  scenario: `You inherited an old ShopEasy framework. Its \`BaseTest\` calls \`System.setProperty("webdriver.chrome.driver", "C:/drivers/chromedriver.exe")\`, the pom has \`io.github.bonigarcia:webdrivermanager\`, and after every Jenkins run the agent still has a few \`chromedriver.exe\` processes hanging around. Chrome auto-updated last night and half the suite failed with "This version of ChromeDriver only supports Chrome version 129". Your lead asks you to clean up the setup.`,
  description: `Answer the questions about how Selenium 4 finds and starts the browser driver, and how to tear it down.`,
  hints: [
    'Since Selenium 4.6, Selenium Manager ships inside selenium-java and resolves the driver automatically.',
    'quit() ends the session and stops the driver process; close() only closes one window.',
  ],
  questions: [
    {
      q: `With **Selenium 4.6+** and no other setup code, what happens on \`new ChromeDriver()\`?`,
      options: [
        'It fails with IllegalStateException: the path to the driver executable must be set',
        'Selenium Manager detects the installed Chrome version, downloads a matching chromedriver if needed (cached in ~/.cache/selenium) and starts it',
        'It uses whatever chromedriver happens to be in the project folder',
        'It starts Chrome without any driver using the DevTools protocol',
      ],
      answer: 1,
      why: 'Selenium Manager is bundled with Selenium since 4.6. When no driver path is configured and none is on the PATH, it finds the browser, fetches the matching driver and caches it. The old IllegalStateException is what Selenium 3 threw.',
    },
    {
      q: 'The hard-coded `System.setProperty("webdriver.chrome.driver", ...)` line is still in BaseTest. Why did the suite break after Chrome auto-updated?',
      options: [
        'setProperty is ignored in Selenium 4',
        'An explicitly configured driver path takes priority, so Selenium used the old chromedriver.exe that no longer matched the new Chrome version',
        'Chrome updates always break Selenium until a new Selenium release',
        'Because WebDriverManager and setProperty cannot be used in the same project',
      ],
      answer: 1,
      why: 'If you point Selenium at a specific driver binary, Selenium Manager steps aside and uses it — including when it is outdated. Deleting the setProperty line lets Selenium Manager match the driver to the installed browser automatically.',
    },
    {
      q: 'What is the honest comparison between **WebDriverManager** (bonigarcia) and **Selenium Manager**?',
      options: [
        'WebDriverManager is required for Selenium 4; Selenium Manager is only for Grid',
        'Both resolve matching drivers; Selenium Manager is built in and needs no code or dependency, WebDriverManager is a third-party library with extras (e.g. Docker browsers, explicit version control) that older frameworks used before 4.6',
        'Selenium Manager only works for Firefox',
        'WebDriverManager starts the browser faster, so it is always preferred',
      ],
      answer: 1,
      why: 'WebDriverManager solved driver management years before Selenium did. On Selenium 4.6+ most teams can remove it (one dependency and one setup line fewer). Keep it only if you rely on its extra features.',
    },
    {
      q: `Which teardown is correct?

\`\`\`java
@AfterMethod(alwaysRun = true)
public void tearDown() {
    // ???
}
\`\`\``,
      options: [
        '`driver.close();`',
        '`if (driver != null) { driver.quit(); }`',
        '`driver.quit(); driver.close();`',
        'Nothing — the JVM kills Chrome when tests finish',
      ],
      answer: 1,
      why: '`quit()` closes all windows, ends the session and stops chromedriver — `close()` can leave the driver process running, which explains the leftover chromedriver.exe processes. The null check protects you when setup failed before the driver was created; `alwaysRun = true` makes teardown run even after a failure. Calling close() after quit() throws NoSuchSessionException.',
    },
    {
      q: 'Jenkins agents have no internet access. What do you do about Selenium Manager?',
      options: [
        'Selenium cannot run offline at all',
        'Pre-install the driver (or use a browser image that includes it) and put it on the PATH or set its path; Selenium Manager is only needed when the driver is not already available',
        'Disable Chrome updates on your laptop',
        'Switch to Thread.sleep while the driver downloads',
      ],
      answer: 1,
      why: 'Selenium Manager is a convenience, not a requirement. In locked-down CI, bake the browser and matching driver into the agent or Docker image (Selenium Grid images already include them), or point SE_CACHE_PATH at a pre-filled cache.',
    },
  ],
  explanation: `**Modern setup (Selenium 4.6+):** add only \`selenium-java\`, call \`new ChromeDriver(options)\`, and let Selenium Manager match the driver to the browser. Remove hard-coded \`webdriver.chrome.driver\` paths — they pin you to one driver version and break on the next browser update.

**WebDriverManager** is a good library and still common in interviews and older projects; just know it is now optional.

**Teardown:** \`quit()\` in \`@AfterMethod(alwaysRun = true)\` with a null check. \`close()\` is for closing one extra tab during a test.`,
  interview: [
    { q: 'How does Selenium find the driver executable in Selenium 4?', a: 'First an explicitly configured path (system property or Service builder), then the PATH, and if neither has one, Selenium Manager detects the browser version, downloads the matching driver and caches it.' },
    { q: 'Why do you still see WebDriverManager in many frameworks?', a: 'It predates Selenium Manager (4.6, late 2022) and was the standard way to avoid manual driver downloads. Many frameworks simply have not removed it; on current Selenium it is optional.' },
    { q: 'Leftover chromedriver processes on the CI agent — what is the likely cause?', a: 'Teardown calls close() instead of quit(), or teardown does not run after failures (missing alwaysRun = true or try/finally), so sessions are never ended.' },
  ],
}
