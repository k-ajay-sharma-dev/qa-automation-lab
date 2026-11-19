export default {
  slug: 'waits-flakiness-limitations-interview',
  category: 'interview',
  order: 3,
  title: 'Waits, flaky tests and Selenium\'s limits - interview answers',
  minutes: 9,
  summary: 'Answer the waits, dynamic-element, flakiness and "what can\'t Selenium do?" questions with precise terms and real fixes.',
  manualAnalogy: `As a manual tester you naturally wait for the spinner to stop before clicking, and you know a test that "fails
sometimes" still means something is wrong. You also know which checks you would never do through the UI. These
questions ask you to say that instinct in automation vocabulary.`,
  body: `## Waits: the vocabulary must be exact

| Wait | What it does | Interview verdict |
|---|---|---|
| \`Thread.sleep(3000)\` | always pauses 3 s | never in a framework - slow when the app is fast, still flaky when it is slow |
| Implicit wait | every \`findElement\` polls up to N seconds for the element to **exist** | global, only checks presence; most mature teams set it to 0 |
| Explicit wait (\`WebDriverWait\` + \`ExpectedConditions\`) | waits for a **specific condition** on a specific element | the standard |
| \`FluentWait\` | explicit wait with custom polling interval and ignored exceptions | for unusual cases, e.g. polling every 200 ms while ignoring a stale element |

Know the difference between the main conditions - it is a favourite trick question:

- \`presenceOfElementLocated\` - the element is **in the DOM**. It may still be hidden or covered.
- \`visibilityOfElementLocated\` - present **and** displayed with a size.
- \`elementToBeClickable\` - visible **and** enabled.

Example story: on the practice site's waits page, the "Claim reward" button (\`#claim-reward-btn\`) starts disabled.
Waiting for presence passes immediately and the click does nothing; waiting for clickability fixes it.

Also say this: **do not mix implicit and explicit waits**. The timeouts can add up in surprising ways.

## Dynamic elements

When ids change on every load (\`order-7f3a\`, \`order-91bc\`), describe your toolbox:

- An **attribute that does not change**: \`data-testid\`, \`name\`, \`aria-label\`.
- **Partial matching**: CSS \`[id^='order-']\` (starts with) or XPath \`contains(@id, 'order-')\` - only if the
  stable part is unique.
- **Anchor on visible text, then navigate**: find the card whose name is the product, then the button *inside that
  card*. This is how real users find things too.
- Ask developers for **test ids** - the best long-term fix.

What not to say: absolute XPaths (\`/html/body/div[2]/...\`) or index-based locators "because they work".

## Flaky tests: definition, causes, cure

A **flaky test** passes and fails on the **same code** without any change. It destroys trust: once people learn to
ignore red builds, real bugs slip through.

Root causes to list (and pick a story from):

1. **Synchronisation** - missing or wrong waits, animations, spinners.
2. **Test data** - shared accounts, data left by another test, parallel tests colliding.
3. **Order dependency** - a test needs state from a previous one.
4. **Environment** - slow QA servers, third-party services, network.
5. **Locators** - brittle or non-unique selectors.
6. **Shared state in code** - \`static\` driver or variables in parallel runs.

The process answer:

- **Reproduce and gather evidence first**: screenshots, logs, video, run it in a loop; compare CI vs local
  (headless window size and slower agents are common culprits).
- **Fix the root cause**, then **quarantine** (tag it, e.g. \`@quarantine\`, and exclude it) if a fix takes time - with
  a ticket and an owner.
- On **automatic retries**: they hide problems. A limited retry can keep CI usable, but every retried pass must be
  reported and investigated. Saying "we just retry 3 times" is a red flag to interviewers.
- **Prevent**: code review rules (no sleeps, explicit waits, independent data), running new tests several times
  before merging, tracking flaky rates.

## Selenium's limitations

Selenium WebDriver automates **browsers**, nothing else. Typical questions and the professional answer:

| Situation | Answer |
|---|---|
| CAPTCHA | It exists to stop bots - do not try to beat it. Ask for it to be disabled or given a test key in QA environments. |
| OTP by SMS / email | Use a test hook: fixed OTP in QA, an API or test mailbox to read the code, or a backdoor endpoint - agreed with developers. |
| File upload | \`sendKeys(absolutePath)\` on the \`<input type="file">\` element - no OS dialog needed. |
| OS dialogs, desktop apps, download dialogs | Outside the browser - avoid them (browser download preferences) or use another tool; Robot class or AutoIt are last resorts. |
| Images, charts, visual layout | Not built in - visual testing tools. |
| Performance / load | JMeter, Gatling, k6 - not Selenium. |
| API checks and test data setup | REST Assured or similar - faster and more stable than clicking through the UI. |
| Mobile apps | Appium (it speaks the WebDriver protocol). |

The pattern to say out loud: *"Selenium is the right tool for browser behaviour; for X we combined it with Y."*
Interviewers want to see you choose tools, not force everything through the UI.`,
  keyPoints: [
    'Explicit waits with the right condition; presence != visible != clickable.',
    'Never Thread.sleep; do not mix implicit and explicit waits.',
    'Dynamic elements: stable attributes, partial match, anchor on text then navigate, ask for test ids.',
    'Flaky = same code, different result; find the root cause, quarantine with a ticket, treat retries with suspicion.',
    'Selenium only drives browsers: CAPTCHA/OTP need test hooks; files via sendKeys; APIs, load, mobile need other tools.',
  ],
  mistakes: [
    'Saying presenceOfElementLocated means the element is clickable. Fix: learn the three conditions precisely.',
    'Answering "how do you handle flaky tests?" with "we add retries". Fix: root cause first, retries only as a reported safety net.',
    'Claiming you can automate CAPTCHA. Fix: explain it is disabled or stubbed in test environments.',
    'Recommending absolute XPath for dynamic ids. Fix: stable attributes or relative locators.',
  ],
  tryIt: `On http://localhost:5180/practice-site/waits.html, click "Load orders" and watch #loading-spinner and
#data-result. Say in one sentence which condition you would wait for, and why not presence.`,
  problems: ['int-003', 'int-005', 'int-009'],
}
