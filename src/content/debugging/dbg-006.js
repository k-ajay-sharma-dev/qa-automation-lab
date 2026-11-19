export default {
  id: 'dbg-006',
  category: 'debugging',
  kind: 'code',
  title: 'Green locally, red on Jenkins headless: the 800x600 window',
  level: 'INTERMEDIATE',
  tags: ['headless', 'jenkins', 'ChromeOptions', 'window-size', 'responsive'],
  estMinutes: 15,
  scenario: `On your current project (a client web shop with a responsive header — the ShopEasy practice site always shows a plain \`#logout-link\`), your \`LogoutTest\` passes every time on your laptop (Chrome, maximised, 1920x1080). On Jenkins — which runs Chrome **headless** on a Linux agent with no display — it fails every time. The developer says "nothing changed in the header". Your lead wants it green in today's pipeline without disabling the test.`,
  description: `Jenkins console:

\`\`\`text
[INFO] Running com.shopeasy.tests.LogoutTest
Starting ChromeDriver 126.0.6478.126 on port 41233
[ERROR] userCanLogout(com.shopeasy.tests.LogoutTest)  Time elapsed: 11.903 s  <<< ERROR!
org.openqa.selenium.ElementNotInteractableException: element not interactable
  (Session info: chrome-headless-shell=126.0.6478.126)
Build info: version: '4.21.0', revision: '79ed462ef4'
System info: os.name: 'Linux', os.arch: 'amd64', os.version: '5.15.0-1057-azure', java.version: '17.0.11'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Capabilities {browserName: chrome, goog:chromeOptions: {args: [--headless]} ...}
	at org.openqa.selenium.remote.RemoteWebElement.click(RemoteWebElement.java:94)
	at com.shopeasy.pages.HeaderComponent.logout(HeaderComponent.java:29)
	at com.shopeasy.tests.LogoutTest.userCanLogout(LogoutTest.java:18)
\`\`\`

You attached a screenshot on failure and it shows a **narrow page with a hamburger menu ☰** — the "Logout" link is hidden inside the collapsed mobile menu. Headless Chrome starts with a default **800x600** window, which hits the app's responsive breakpoint.

**Fix \`DriverFactory\`:**
- Use the modern headless mode \`--headless=new\` (closer to real Chrome).
- Give the browser a **fixed desktop size**: \`--window-size=1920,1080\` (or \`setSize(new Dimension(1920, 1080))\`).
- Read headless from a system property so Jenkins runs \`mvn test -Dheadless=true\` and you still see the browser locally.`,
  hints: [
    'Always attach a screenshot on failure — here it shows the layout difference immediately.',
    'maximize() does nothing useful when there is no physical screen.',
    'options.addArguments("--headless=new", "--window-size=1920,1080");',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.driver;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

public class DriverFactory {

    public static WebDriver createDriver() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        WebDriver driver = new ChromeDriver(options);
        driver.manage().window().maximize();
        return driver;
    }
}
`,
  solution: String.raw`package com.shopeasy.driver;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

public class DriverFactory {

    public static WebDriver createDriver() {
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));

        ChromeOptions options = new ChromeOptions();
        if (headless) {
            options.addArguments("--headless=new");
        }
        // same viewport everywhere: laptop, Jenkins agent, Docker
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--disable-dev-shm-usage");

        WebDriver driver = new ChromeDriver(options);
        if (!headless) {
            driver.manage().window().maximize();
        }
        return driver;
    }
}
`,
  checks: [
    { label: 'Sets an explicit desktop window size', pattern: '(--window-size=\\d{4},\\d{3,4}|setSize\\s*\\(\\s*new\\s+Dimension\\s*\\(\\s*\\d{4})', hint: 'options.addArguments("--window-size=1920,1080")' },
    { label: 'Uses the new headless mode', pattern: '--headless=new', hint: '"--headless=new" behaves like real Chrome' },
    { label: 'Headless is configurable via a system property', pattern: 'System\\.getProperty\\s*\\(\\s*"headless"', hint: 'Boolean.parseBoolean(System.getProperty("headless", "false"))' },
    { label: 'Still uses ChromeOptions', pattern: 'new\\s+ChromeOptions\\s*\\(', hint: 'Configure the browser through ChromeOptions' },
  ],
  explanation: `**Root cause:** the test is fine, the *environment* differs. Headless Chrome has no monitor, so it uses a default viewport of 800x600. The app is responsive: below 992 px the nav collapses into a hamburger menu, and "Logout" becomes a hidden element → \`ElementNotInteractableException\` (it exists in the DOM but isn't visible). \`maximize()\` can't help because there's no screen to maximise to.

**How you prove it in an interview story:** "The failure screenshot from Jenkins showed the mobile layout. I printed \`driver.manage().window().getSize()\` in the log: (800, 600). We set \`--window-size=1920,1080\` in the driver factory so every environment uses the same viewport."

**Other classic "works locally, fails on Jenkins" causes:**
- Slower agent → timing issues (explicit waits).
- Different browser version on the agent (\`SessionNotCreatedException\`).
- Docker \`/dev/shm\` too small → Chrome crashes (\`--disable-dev-shm-usage\`).
- Locale/time zone differences in date and currency assertions.
- Test data that exists only on your local DB.

Make the run configurable (\`-Dheadless=true -Dbrowser=chrome\`) so the same code runs everywhere.`,
  mistakes: [
    'Marking the test as "known failure on Jenkins" and skipping it there.',
    'Relying on maximize() in headless mode.',
    'Adding a special locator for the hamburger menu only on CI instead of fixing the viewport.',
    'Not saving screenshots on failure, so you cannot see what the headless browser saw.',
  ],
  interview: [
    { q: 'Your tests pass locally but fail in Jenkins. What do you check?', a: 'I compare the environments: headless vs headed and the window size, browser and driver versions, agent speed, test data and URLs, and locale. I always look at the failure screenshot and logs from the build. In one case the headless default 800x600 viewport switched the site to its mobile layout; setting --window-size=1920,1080 in our DriverFactory fixed it.' },
    { q: 'How do you run tests in headless mode?', a: 'Through ChromeOptions with --headless=new, controlled by a system property or config so Jenkins passes -Dheadless=true and locally we see the browser. We always set an explicit window size alongside it.' },
  ],
}
