export default {
  id: 'pw-003',
  category: 'playwright',
  kind: 'quiz',
  title: 'Playwright vs Selenium: the migration meeting',
  level: 'BEGINNER',
  tags: ['playwright', 'selenium', 'migration', 'architecture'],
  estMinutes: 10,
  scenario: `Your QA manager has called a meeting: "The Selenium suite takes 70 minutes and 8% of runs are flaky. The front-end team
uses TypeScript and wants to own tests too. Should we move to Playwright?" Before the meeting, check you can explain the real
differences — not the marketing ones.`,
  description: 'Answer the questions a manager, a developer and a sceptical senior tester will ask in that meeting.',
  questions: [
    {
      q: 'How does Playwright talk to the browser, compared with Selenium 4?',
      options: [
        'Both send HTTP requests to a separate driver executable (chromedriver / geckodriver) per command',
        'Playwright keeps one persistent connection (WebSocket, using CDP-like protocols) to browsers it ships and patches itself; Selenium uses the W3C WebDriver protocol through a driver per browser',
        'Playwright injects JavaScript into the page and clicks with element.click()',
        'Playwright only works with Chromium',
      ],
      answer: 1,
      why: 'Playwright drives its own builds of Chromium, Firefox and WebKit over a single bidirectional connection, which makes events (dialogs, requests, new pages) easy to listen to. Selenium sends W3C WebDriver commands to a driver per browser. Option 3 describes a JS-click hack, not Playwright, and Playwright supports three engines.',
    },
    {
      q: 'Which Selenium habit becomes unnecessary in Playwright for most cases?',
      options: [
        'Writing assertions',
        'Wrapping every interaction in WebDriverWait + ExpectedConditions',
        'Using page objects',
        'Running tests in CI',
      ],
      answer: 1,
      why: 'Playwright actions auto-wait for the element to be attached, visible, stable, enabled and receiving events, and web-first assertions (await expect(locator).toHaveText()) retry until timeout. Page objects, assertions and CI are still needed.',
    },
    {
      q: 'The team asks: "Will one test file run in Chrome, Firefox and Safari?" What is the honest answer?',
      options: [
        'Yes — define projects in playwright.config.ts (Desktop Chrome, Desktop Firefox, Desktop Safari via WebKit); the same spec runs once per project',
        'No — you need one spec file per browser',
        'Only Chrome and Edge are supported',
        'Yes, but only through Selenium Grid',
      ],
      answer: 0,
      why: 'Projects in the config multiply the run across browsers/devices. Note: "Safari" here is the WebKit engine Playwright ships, which is very close to — but not literally — the Safari app; real Safari on real iOS still needs a device cloud.',
    },
    {
      q: 'What is a BrowserContext and why does it matter for test isolation?',
      options: [
        'Another name for a browser tab',
        'A lightweight, incognito-like profile inside one browser: its own cookies, storage and pages; Playwright gives each test a fresh one in milliseconds',
        'A Java class you extend for page objects',
        'A config file listing browsers',
      ],
      answer: 1,
      why: 'Contexts are why Playwright tests are isolated without the cost of launching a new browser per test (the classic Selenium trade-off). A context can hold several pages (tabs). ShopEasy keeps the cart in sessionStorage, so a new context = an empty cart.',
    },
    {
      q: 'Which statement is a fair reason to KEEP part of the suite on Selenium for now?',
      options: [
        'Playwright cannot run headless',
        'Playwright has no assertions',
        'The company must test on real mobile devices / a vendor grid that only exposes WebDriver, or the team has large Java libraries that are not worth rewriting yet',
        'Playwright does not support CSS selectors',
      ],
      answer: 2,
      why: 'Migrations are business decisions. WebDriver is the W3C standard supported by device clouds and Appium; existing Java utilities have value. Playwright supports headless, has its own expect, and supports CSS/XPath (though user-facing locators are preferred).',
    },
  ],
  hints: ['Think about the protocol, the waiting model and the isolation model.'],
  explanation: `The three differences that matter in practice:

1. **Waiting model** — auto-waiting actions + retrying web-first assertions remove most explicit waits and most flakiness caused by timing.
2. **Isolation model** — a new BrowserContext per test is cheap, so every test starts clean without restarting the browser.
3. **Tooling** — test runner, parallelism, retries, HTML report, trace viewer, codegen and UI mode come in one package (\`@playwright/test\`), instead of Selenium + TestNG + ExtentReports + WebDriverManager.

Selenium still wins on standards, language breadth (Java, C#, Python, Ruby, JS) and device-cloud support. A good answer in the meeting is a **pilot**: migrate the smoke pack, compare duration and flake rate over two sprints, then decide.`,
  mistakes: [
    'Translating Selenium code line by line, including explicit waits and sleeps — you keep the flakiness and lose the benefit.',
    'Claiming WebKit equals real Safari on iPhone — it is the same engine, not the same device.',
    'Launching a new browser per test "like in Selenium" — use a new context instead (the default in @playwright/test).',
  ],
  interview: [
    { q: 'Why is Playwright usually less flaky than Selenium?', a: 'Actionability checks before every action and auto-retrying assertions mean the test waits for the real condition instead of a fixed time or a hand-written wait. Fresh contexts per test also remove state leaking between tests.' },
    { q: 'How would you plan a Selenium-to-Playwright migration?', a: 'Start with a pilot on the smoke suite, keep both running in CI, port page objects first, replace waits with web-first assertions, measure duration and flake rate, then migrate by feature area. Do not translate line by line — Selenium waits and sleeps should disappear.' },
    { q: 'Does Playwright support Java?', a: 'Yes, there are Java, Python and .NET bindings, but the @playwright/test runner with fixtures, projects, trace and UI mode is JavaScript/TypeScript only — most teams pick TypeScript for that reason.' },
  ],
}
