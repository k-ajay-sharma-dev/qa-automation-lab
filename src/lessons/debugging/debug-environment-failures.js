export default {
  slug: 'debug-environment-failures',
  category: 'debugging',
  order: 7,
  title: 'Environment failures: browser won\'t start, versions, Docker and unreachable sites',
  minutes: 8,
  summary: 'Recognise environment failures — SessionNotCreatedException, driver/browser version mismatches, Chrome crashing in Docker, connection refused — fix them at the source, and stop them wasting a whole nightly run.',
  manualAnalogy: `Some mornings you can't test at all: the QA server is down, your VPN is off, or the browser updated overnight and the test tool no longer works. You don't raise 300 defects — you raise one environment ticket. Automation suites hit the same walls, and the skill is recognising them in seconds.`,
  body: `## Shape: everything red, instantly, identically

Environment failures have a recognisable shape: **all** (or a whole group of) tests fail, in the **first step**, within seconds, with the **same** message. Read one failure carefully, not three hundred.

## 1. The browser never starts: \`SessionNotCreatedException\`

\`\`\`text
org.openqa.selenium.SessionNotCreatedException: Could not start a new session. Response code 500.
Message: session not created: This version of ChromeDriver only supports Chrome version 119
Current browser version is 121.0.6167.85
\`\`\`

"Session not created" means the driver couldn't launch the browser — no page was ever opened, so this says nothing about the product.

**Version mismatch.** Chrome auto-updates; a driver binary only supports one major version. Old frameworks pin a driver file:

\`\`\`java
System.setProperty("webdriver.chrome.driver", "C:/drivers/chromedriver.exe"); // old style
\`\`\`

Since Selenium 4.6, **Selenium Manager** (built into Selenium) detects the installed browser and fetches the matching driver automatically — but only if you **don't** override it with a hard-coded path. Durable fix: upgrade Selenium to a recent 4.x, delete the \`setProperty\` line and any checked-in driver binaries. Copying in a newer driver file "fixes" it until the next browser update.

Where Selenium Manager can't download (locked-down agents without internet), the alternatives are a pre-baked Docker image with matching browser + driver, or a Selenium Grid whose nodes are maintained together.

**Chrome crashes on start in Linux/Docker.**

\`\`\`text
SessionNotCreatedException: ... unknown error: Chrome failed to start: exited abnormally.
(unknown error: DevToolsActivePort file doesn't exist)
\`\`\`

This one is not about versions. Inside containers Chrome commonly needs to run **headless** (there is no display), and often with \`--no-sandbox\` (the container user can't use Chrome's sandbox) and \`--disable-dev-shm-usage\` (Docker's default \`/dev/shm\` is tiny, so Chrome crashes). Alternatively run tests against the official \`selenium/standalone-chrome\` image, which is configured for this. See the *Browser options, Grid and parallel runs* lesson for the options code.

## 2. The browser starts, but the site can't be reached

\`\`\`text
org.openqa.selenium.WebDriverException: unknown error: net::ERR_NAME_NOT_RESOLVED
	at org.openqa.selenium.remote.RemoteWebDriver.get(RemoteWebDriver.java:283)
\`\`\`

\`net::ERR_...\` messages come from the browser's network layer:

| Message | Meaning |
|---|---|
| \`ERR_CONNECTION_REFUSED\` | Host reachable, nothing listening on that port — app down/deploying, wrong port |
| \`ERR_NAME_NOT_RESOLVED\` | DNS can't find the host name — typo in base URL, agent not on the right network |
| \`ERR_CERT_...\` | TLS certificate problem on the test environment |
| 502 / 503 page on screenshot | A gateway/load balancer is up, the app behind it is not |

Check: can the **agent** (not your laptop) reach the URL? Is the base URL coming from the right config/profile (\`-Denv=qa\`)? Was there a deployment at that time?

## 3. Missing config or data

A properties file that exists on your laptop but is git-ignored, an environment variable that isn't set on the agent, a test user that was deleted in the nightly DB refresh. These usually surface as a \`NullPointerException\` or \`FileNotFoundException\` at the **bottom** of a \`Caused by:\` chain inside setup — and then every test is skipped. Read the chain to the end (see *Reading a stack trace*).

## 4. The agent's clock and language: time zone and locale

Not every environment failure is loud. Some tests fail only **on one agent, or only at night**, with a perfectly normal assertion:

\`\`\`text
java.lang.AssertionError: order date expected [2026-11-19] but found [2026-11-18]
java.lang.AssertionError: receipt total expected [$43.18] but found [$43,18]
\`\`\`

Every JVM has a default **time zone** and **locale**, taken from the machine. They silently change \`LocalDate.now()\`, \`String.format\`, \`NumberFormat\`, month names and more. An API usually returns timestamps in UTC (\`...Z\`), so "today" on an agent in Europe just after midnight is still "yesterday" in UTC; a German locale formats \`43.18\` as \`43,18\`.

Check \`java -XshowSettings:properties -version\` on the agent (look at \`user.timezone\`, \`user.language\`, \`user.country\`). Then fix the **test**, not the schedule: compare \`Instant\`s with a tolerance instead of local dates, and pass \`Locale.US\` (or whatever the UI uses) whenever you format for comparison. Pinning \`-Duser.timezone=UTC\` in the Surefire \`argLine\` adds reproducibility, but the test should pass without it.

## Classifying and reporting

Environment failures get the verdict **environment / no product verdict yet** — not "product bug", not "flaky test". Fix or escalate the environment, rerun, and only then judge the product. In the release call: "the run didn't test anything; rerun scheduled after X is fixed".

## Make it cheap next time

- **Smoke stage first**: one tiny test (start browser, open the login page, check the title) before the full suite. If it fails, stop the pipeline with a clear message — five seconds instead of an hour of identical failures.
- **Log versions at start-up**: browser version, driver version, Selenium version, base URL, headless flag. The \`Capabilities {...}\` and \`Build info\` lines in a stack trace already contain some of this.
- **Pin what you control, auto-manage what you don't**: pin Selenium and Docker image versions in the build file; let Selenium Manager handle drivers.
- **Health check the app** (an HTTP call to a status endpoint) before launching browsers.`,
  keyPoints: [
    'All tests failing fast with the same message = environment; read one failure.',
    '`SessionNotCreatedException` = the browser never started — no product verdict possible.',
    'Driver/browser version mismatch: remove hard-coded driver paths and let Selenium Manager resolve drivers.',
    'Chrome in Docker needs headless, often `--no-sandbox` and `--disable-dev-shm-usage` — or a Selenium image.',
    '`net::ERR_...` errors come from the network: check URL, DNS, deployment and the agent\'s access.',
    'A smoke stage and start-up version logging turn hour-long red runs into a 5-second clear failure.',
    'Fails only on one agent or only at night: check the JVM time zone and locale before the code.',
  ],
  mistakes: [
    'Downloading a new chromedriver into the repo every time Chrome updates instead of removing the pinned path.',
    'Adding retries or sleeps around driver creation — a version mismatch never fixes itself.',
    'Raising product defects for tests that never opened the application.',
    'Testing the URL from your laptop instead of from the CI agent that failed.',
  ],
  tryIt: `In any Selenium project, print \`((HasCapabilities) driver).getCapabilities()\` right after creating the driver. Find the browser version and the driver version in the output — that is the first thing to compare when "session not created" appears.`,
  problems: ['dbg-013', 'dbg-006', 'dbg-024'],
}
