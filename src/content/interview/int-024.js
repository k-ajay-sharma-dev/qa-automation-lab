export default {
  id: 'int-024',
  category: 'interview',
  kind: 'quiz',
  title: 'Selenium vs Playwright: architecture, auto-waiting and when to choose which',
  level: 'ADVANCED',
  tags: ['selenium', 'playwright', 'architecture', 'webdriver', 'cdp', 'bidi', 'tool-selection'],
  estMinutes: 20,
  scenario: `The job description says "Selenium (Java); Playwright a plus". The architect on the panel asks: *"Our new project could use either. Which would you choose and why? And what actually happens under the hood when each one clicks a button?"* "Playwright is faster" is not an answer. A strong answer covers **protocol, waiting model, isolation, language/ecosystem and the team's context** — and doesn't trash either tool.`,
  description: `Pick the best answer. Think like someone who has to defend the decision to a team lead in six months.`,
  hints: [
    'Selenium: client library → W3C WebDriver over HTTP → a driver per browser (chromedriver, geckodriver) → browser. WebDriver BiDi adds a two-way WebSocket channel.',
    'Playwright: one persistent WebSocket connection to the browser; CDP for Chromium, its own protocol for patched Firefox and WebKit builds.',
  ],
  questions: [
    {
      q: 'Which description of the **architecture** is accurate?',
      options: [
        'Both tools inject JavaScript into the page and click elements with it',
        'Selenium sends W3C WebDriver commands (HTTP requests) to a browser-specific driver such as chromedriver, which controls the browser; Playwright keeps one WebSocket connection open and talks to the browser directly — Chrome DevTools Protocol for Chromium, its own protocol for its patched Firefox and WebKit builds',
        'Playwright is built on top of Selenium WebDriver',
        'Selenium only works through Selenium Grid',
      ],
      answer: 1,
      why: 'Selenium\'s classic model is request/response over HTTP per command, standardised by the W3C — which is why every browser vendor ships a driver and why it is so widely supported. Playwright\'s persistent, event-driven connection makes it easy to listen to network traffic and console events. Selenium is closing that gap with **WebDriver BiDi**, a standard bidirectional WebSocket protocol (Selenium 4 also exposes CDP for Chromium).',
    },
    {
      q: 'What is Playwright\'s **auto-waiting**, and what is the Selenium equivalent?',
      options: [
        'Playwright sleeps one second before every action; Selenium has nothing similar',
        'Before an action like click, Playwright waits until the element is attached, visible, stable (not animating), enabled and receives events; web-first assertions such as `expect(locator).toHaveText("2")` retry until timeout. In Selenium you build this yourself with explicit waits (WebDriverWait + ExpectedConditions), usually wrapped in BasePage helpers',
        'Auto-waiting means tests never fail',
        'Selenium waits automatically for every condition, Playwright does not',
      ],
      answer: 1,
      why: 'Auto-waiting removes a whole class of timing bugs and is the main reason Playwright suites are often less flaky out of the box. But it does not wait for *your business state* (for example "the cart badge shows 2 after an API call") unless you assert it with a web-first assertion. In Selenium the same discipline comes from a good BasePage with explicit waits.',
    },
    {
      q: 'Your company has a 1,200-test Selenium + Java + Cucumber framework, Java developers, a Selenium Grid and needs real Safari on macOS. A new module is starting. What is the most sensible recommendation?',
      options: [
        'Rewrite everything in Playwright immediately because it is newer',
        'Stay with Selenium for this context — the team skills, existing framework, Grid investment and real-browser coverage (Safari via safaridriver) all fit; consider a small Playwright pilot only if there is a concrete pain such as flakiness or speed that it would solve',
        'Use both tools inside the same test method',
        'Stop UI automation',
      ],
      answer: 1,
      why: 'Tool choice is about **context**, not hype. Playwright tests WebKit, the engine behind Safari, but not the branded Safari browser itself. A rewrite of 1,200 tests has a huge cost and no business value by itself. Interviewers want to hear trade-offs and a measured migration plan (pilot, compare flaky rate and run time, then decide).',
    },
    {
      q: 'For which new project would Playwright be the stronger default?',
      options: [
        'A team whose only language is Java and that must test Internet Explorer',
        'A new TypeScript/JavaScript product team building a modern single-page app, wanting fast parallel runs, built-in test runner, trace viewer, network mocking with page.route, and multiple isolated browser contexts per test',
        'A desktop Windows application',
        'A load test with 10,000 users',
      ],
      answer: 1,
      why: 'Playwright shines when the team works in TypeScript and wants batteries included: runner, fixtures, parallelism, HTML report, traces, API testing and network interception. (Playwright also has Java, Python and .NET bindings, but the test runner features are richest in TypeScript.) Desktop apps need other tools; load testing needs JMeter, Gatling or k6.',
    },
    {
      q: 'What is a Playwright **browser context**, and why does it matter for parallel tests?',
      options: [
        'Another name for a tab',
        'An isolated, incognito-like session inside one browser process with its own cookies and storage; each test gets a fresh context in milliseconds, and a logged-in state can be saved once with storageState and reused — in Selenium you usually start a new driver session per test for the same isolation',
        'A Java class for configuration',
        'The DOM tree of the page',
      ],
      answer: 1,
      why: 'Contexts give cheap isolation, so parallel tests don\'t share cookies or carts — the same problem ThreadLocal drivers solve in Selenium. storageState is the Playwright way of "log in via API once, reuse the session", which saves minutes per suite.',
    },
    {
      q: 'An interviewer says: "Selenium is dead, everyone uses Playwright now." What is the best response?',
      options: [
        '"You\'re right, I would never use Selenium again."',
        '"Selenium is outdated and slow, so I only learned Playwright."',
        '"Both are actively developed. Selenium is the W3C standard with the widest language, browser and cloud-grid support, and Selenium 4 added relative locators, a new window API, CDP access and BiDi. Playwright has a more modern developer experience. I\'ve used Selenium with Java and I\'m learning Playwright with TypeScript — I pick based on the team and the application."',
        '"Tools don\'t matter."',
      ],
      answer: 2,
      why: 'Balanced, factual and personal: you show you know both ecosystems, you know what changed in Selenium 4, and you make decisions by context. Dismissing a tool the interviewer\'s company may still use is a classic own goal.',
    },
  ],
  explanation: `**Comparison table to have in your head**
| | Selenium 4 (Java) | Playwright (TypeScript) |
|---|---|---|
| Protocol | W3C WebDriver over HTTP via browser drivers; BiDi emerging | Persistent WebSocket; CDP for Chromium, own protocol for Firefox/WebKit |
| Waiting | Explicit waits you write (WebDriverWait) | Auto-waiting + web-first assertions |
| Browsers | Chrome, Edge, Firefox, real Safari | Chromium, Firefox, WebKit (bundled builds) |
| Languages | Java, C#, Python, JS, Ruby… | TS/JS first; Java, Python, .NET bindings |
| Runner / report | Bring your own: TestNG/JUnit, Cucumber, Extent/Allure | Built-in runner, fixtures, HTML report, trace viewer |
| Isolation | New driver session per test, ThreadLocal | Browser contexts, storageState |
| Scale-out | Selenium Grid, cloud vendors | Sharding with workers; cloud vendors |

**Model answer — "Selenium or Playwright?"**
> "It depends on the team and the application. With an existing Java framework, Java skills, a Grid and a need for real Safari, I'd stay with Selenium and make it robust with explicit-wait helpers. For a new TypeScript team building an SPA, I'd pick Playwright for auto-waiting, the built-in runner, traces and network mocking. Either way the design principles are the same: page objects, independent data, API setup, and a thin UI layer."`,
  mistakes: [
    'Answering "Playwright is faster" with no explanation of why or when it matters.',
    'Claiming Playwright tests real Safari — it tests WebKit.',
    'Proposing a full rewrite of a working framework because a tool is newer.',
    'Saying Selenium has auto-waiting — only the implicit wait for element presence, not actionability.',
  ],
  interview: [
    { q: 'How does Selenium WebDriver communicate with the browser?', a: 'The language binding turns each command into a W3C WebDriver HTTP request to a browser-specific driver — chromedriver, geckodriver, safaridriver — which drives the browser through its internal automation interface and returns the response. With Grid the request first goes to the hub/router, which forwards it to a node. Selenium 4 adds WebDriver BiDi for bidirectional events.' },
    { q: 'Why are Playwright tests often less flaky?', a: 'Because actions auto-wait for actionability — attached, visible, stable, enabled, receiving events — and web-first assertions retry until a timeout. Fresh browser contexts per test also remove shared-state problems. Flakiness from bad test data or environment still exists, so the same discipline is needed.' },
    { q: 'What changed in Selenium 4?', a: 'Full W3C WebDriver compliance, relative locators such as above and near, newWindow for tabs and windows, element screenshots, access to Chrome DevTools Protocol for network and console, the start of WebDriver BiDi, Selenium Manager for automatic driver downloads, and a redesigned Grid with Docker support.' },
  ],
}
