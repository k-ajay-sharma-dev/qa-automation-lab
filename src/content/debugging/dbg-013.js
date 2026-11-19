export default {
  id: 'dbg-013',
  category: 'debugging',
  kind: 'quiz',
  title: 'SessionNotCreatedException: the browser updated overnight',
  level: 'BEGINNER',
  tags: ['SessionNotCreatedException', 'chromedriver', 'selenium-manager', 'environment', 'docker'],
  estMinutes: 10,
  scenario: `Tuesday 9:05 a.m. **Every single test** in the ShopEasy nightly job failed in under a second each — 312 failures. No code was merged since yesterday's green run. The IT team rolled out OS and browser updates to the build agents overnight. Before anyone panics about the release, you are asked to triage.`,
  description: `Answer the questions using the logs. Each one is a decision you would make in the first 15 minutes of a real incident.`,
  hints: [
    'When ALL tests fail instantly with the same error, think environment before code.',
    'Selenium 4.6+ ships Selenium Manager, which resolves a matching driver automatically.',
  ],
  questions: [
    {
      q: `Every test fails with this. What is the root cause?

\`\`\`text
org.openqa.selenium.SessionNotCreatedException: Could not start a new session. Response code 500. Message: session not created: This version of ChromeDriver only supports Chrome version 114
Current browser version is 126.0.6478.127 with binary path /usr/bin/google-chrome
Host info: host: 'jenkins-agent-03', ip: '10.0.4.17'
Build info: version: '4.8.1', revision: '8ebccac989'
System info: os.name: 'Linux', os.arch: 'amd64', os.version: '5.15.0-1057-azure', java.version: '17.0.11'
Driver info: org.openqa.selenium.chrome.ChromeDriver
	at org.openqa.selenium.remote.ProtocolHandshake.createSession(ProtocolHandshake.java:140)
	at org.openqa.selenium.remote.RemoteWebDriver.startSession(RemoteWebDriver.java:229)
	at org.openqa.selenium.chrome.ChromeDriver.<init>(ChromeDriver.java:84)
	at com.shopeasy.driver.DriverFactory.createDriver(DriverFactory.java:21)
\`\`\``,
      options: [
        'A locator changed in the latest ShopEasy build',
        'The ChromeDriver binary (for Chrome 114) does not match the installed Chrome (126)',
        'The Jenkins agent ran out of memory',
        'The test data user standard_user was locked',
      ],
      answer: 1,
      why: 'The message says it plainly: the driver supports Chrome 114, the browser is 126. The failure happens in the ChromeDriver constructor (DriverFactory.java:21) — before any page or locator is touched, so locators and test data are irrelevant. Memory problems would look like "Chrome failed to start: crashed" or DevToolsActivePort errors.',
    },
    {
      q: `In \`DriverFactory\` you find:

\`\`\`java
System.setProperty("webdriver.chrome.driver", "/opt/drivers/chromedriver-114");
WebDriver driver = new ChromeDriver(options);
\`\`\`

The project uses Selenium 4.8.1. What is the best **long-term** fix?`,
      options: [
        'Download chromedriver 126 into /opt/drivers and update the path',
        'Ask IT to downgrade Chrome to 114 on all agents',
        'Remove the hard-coded system property and let Selenium Manager (Selenium 4.6+) resolve the matching driver — and upgrade Selenium to a current 4.x',
        'Switch all tests to Firefox',
      ],
      answer: 2,
      why: 'A hard-coded driver path breaks every time the browser auto-updates. Since Selenium 4.6, Selenium Manager detects the installed browser and downloads/caches a matching driver automatically when no path is set. Updating the binary manually fixes today but breaks again next month; downgrading Chrome means testing on a browser customers don\'t use; switching browsers avoids the problem instead of solving it. (Teams on old Selenium 3 used WebDriverManager.chromedriver().setup() for the same purpose.)',
    },
    {
      q: 'How should you classify this failure in the triage report for the release call?',
      options: [
        'Product bug — raise a P1 defect for the dev team',
        'Test (script) bug in a specific test case',
        'Environment / infrastructure issue — no product verdict yet; rerun after the agent is fixed',
        'Flaky test — rerun until green',
      ],
      answer: 2,
      why: 'No ShopEasy page was even opened, so the run says nothing about product quality. It\'s an environment/framework-setup issue. The important communication: "0 of 312 tests actually executed; results are invalid, not red" — and give an ETA for the rerun. Calling it flaky is wrong: it fails 100% deterministically.',
    },
    {
      q: `After moving the build into a Docker container, a different error appears:

\`\`\`text
org.openqa.selenium.SessionNotCreatedException: Could not start a new session. Response code 500. Message: unknown error: Chrome failed to start: exited abnormally.
  (unknown error: DevToolsActivePort file doesn't exist)
  (The process started from chrome location /usr/bin/google-chrome is no longer running, so ChromeDriver is assuming that Chrome has crashed.)
\`\`\`

Which ChromeOptions arguments typically fix this in Linux containers?`,
      options: [
        '--start-maximized and --incognito',
        '--headless=new, --no-sandbox and --disable-dev-shm-usage',
        '--disable-extensions only',
        '--remote-allow-origins=*',
      ],
      answer: 1,
      why: 'In containers there is no display (needs headless), Chrome\'s sandbox often can\'t run as root (--no-sandbox), and the default /dev/shm is only 64 MB, which crashes Chrome (--disable-dev-shm-usage, or run the container with --shm-size=2g). --remote-allow-origins was a workaround for a different 2023 ChromeDriver issue; maximize/incognito don\'t address a crash at start-up.',
    },
    {
      q: 'Which preventive measure would have caught this before the 312-test nightly run?',
      options: [
        'A one-test "smoke" stage at the start of the pipeline that just opens the browser and the ShopEasy login page, failing fast with a clear message',
        'Adding retryAnalyzer to every test so each one runs 3 times',
        'Running tests only on developers\' laptops',
        'Increasing the explicit wait timeout to 60 seconds',
      ],
      answer: 0,
      why: 'A fast sanity stage (browser launches, app URL reachable, login works) turns 312 confusing failures into one clear environment failure within seconds and saves agent time. Retries would triple the noise (936 failures) and waits are irrelevant — the browser never started. Pinning browser versions in a Docker image (selenium/standalone-chrome:<version>) is another good preventive step.',
    },
  ],
  explanation: `**SessionNotCreatedException = the browser session was never created.** Nothing in your page objects or steps ran. Typical causes:
- Driver/browser version mismatch (browser auto-updated, hard-coded old driver).
- Browser not installed or not found on the agent.
- Chrome crashing at start-up in Docker/Linux (\`--no-sandbox\`, \`--disable-dev-shm-usage\`, shm size).
- Selenium Grid has no node matching the requested capabilities (browserName/version/platform).

**Triage reflex:** *all tests fail fast with the same error → environment first.* Report it as "results invalid, environment issue", fix the agent or driver setup, rerun. Modern Selenium (4.6+) with Selenium Manager, or a pinned Docker browser image, removes most of these incidents.`,
  mistakes: [
    'Raising a product defect because "all tests failed".',
    'Hard-coding a driver path in DriverFactory.',
    'Re-running the job repeatedly hoping it becomes green.',
  ],
  interview: [
    { q: 'All your tests failed overnight with SessionNotCreatedException. What do you do?', a: 'I recognise it as an environment issue because the browser session never started — usually a driver/browser version mismatch after an auto-update. I check the versions in the log, fix the driver resolution (in our project we removed the hard-coded chromedriver path and rely on Selenium Manager), rerun, and tell the team the earlier results were invalid rather than failures.' },
    { q: 'How do you manage browser drivers in your framework?', a: 'With Selenium 4.6+ we let Selenium Manager resolve drivers automatically. On the CI side we run in Docker images with a pinned browser version so runs are reproducible, and we upgrade intentionally rather than by surprise.' },
  ],
}
