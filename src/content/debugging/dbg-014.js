export default {
  id: 'dbg-014',
  category: 'debugging',
  kind: 'quiz',
  title: 'Failure triage: product bug, test bug or environment issue?',
  level: 'ADVANCED',
  tags: ['triage', 'defects', 'flaky', 'environment', 'release'],
  estMinutes: 20,
  scenario: `Release day on your current project — a ShopEasy-style web shop with a real backend, order history and a shared QA environment. The regression run has **6 failures** and the release manager wants a verdict per failure in 30 minutes: *raise a defect, fix the script, or rerun after the environment is fixed?* This is the skill that separates "someone who writes scripts" from an automation engineer the team trusts — and your 6 years of manual testing is a superpower here.`,
  description: `For each failure, pick the most likely classification based on the evidence. Options are the same for every question:
- **Product bug** — the application behaves wrongly; raise a defect.
- **Test bug** — the automation script is wrong or outdated; fix the test.
- **Environment issue** — infrastructure/data/config problem; fix the env and rerun.
- **Can't tell yet** — need more evidence before deciding.`,
  hints: [
    'Reproduce manually: if a human sees the same wrong behaviour, it is most likely a product bug.',
    'If the feature works manually but the script fails, it is usually a test bug or timing.',
    'Connection refused, DNS, 502/503, certificates, missing data → environment.',
  ],
  questions: [
    {
      q: `**Failure 1** — \`CheckoutTest.totalIncludesTax\`

\`\`\`text
java.lang.AssertionError: Order total expected [64.78] but found [59.98]
	at com.shopeasy.tests.CheckoutTest.totalIncludesTax(CheckoutTest.java:58)
\`\`\`

You repeat the flow manually on the QA environment: subtotal $59.98, tax line shows $4.80, but the **Total** shows $59.98. Yesterday's build showed $64.78.`,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 0,
      why: 'You reproduced it manually and it worked in the previous build: the application calculates the total without tax — a regression. Raise a defect with steps, expected vs actual, build number, screenshot and the failing test name. The automation did its job.',
    },
    {
      q: `**Failure 2** — \`LoginTest.validLogin\`

\`\`\`text
org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#login-button"}
	at com.shopeasy.pages.LoginPage.clickLogin(LoginPage.java:31)
\`\`\`

Manually, login works fine. In DevTools the button is now \`<button id="login-btn" data-testid="login-button">\`. The sprint included a "login page restyle" story.`,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 1,
      why: 'The feature works for users; only the id changed as part of a planned story. Update the locator — and better, use the stable data-testid attribute so the next restyle doesn\'t break it. (Mention to the team: ask devs to keep data-testid attributes stable; it\'s a cheap agreement that saves hours.)',
    },
    {
      q: `**Failure 3** — 41 tests, all failing in the first step:

\`\`\`text
org.openqa.selenium.WebDriverException: unknown error: net::ERR_CONNECTION_REFUSED
  (Session info: chrome=126.0.6478.126)
	at org.openqa.selenium.remote.RemoteWebDriver.get(RemoteWebDriver.java:283)
	at com.shopeasy.hooks.Hooks.openApp(Hooks.java:22)
\`\`\``,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 2,
      why: 'Connection refused at driver.get() means nothing is listening at the app URL — the QA server/container is down, a deployment is in progress, or the URL/port in the config is wrong for this environment. Check the deployment and the config, rerun. Note it\'s still worth asking "is the deployment broken?" — but no functional verdict is possible.',
    },
    {
      q: `**Failure 4** — \`CartTest.removeItemUpdatesBadge\`

Passes when run alone. In the full suite it fails ~50% of the time:

\`\`\`text
java.lang.AssertionError: Cart badge expected [0] but found [1]
\`\`\`

The suite runs with 4 parallel threads, and all tests log in as \`standard_user\`.`,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 1,
      why: 'Classic shared-test-data collision: parallel tests using the same user modify the same cart. The application is behaving correctly for what it was told. Fix: unique users per thread or reset cart state per test. It\'s a test-design bug, not "flakiness" to be retried away.',
    },
    {
      q: `**Failure 5** — \`OrderHistoryTest.showsLastOrder\`

\`\`\`text
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of element located by By.cssSelector: .order-row (tried for 10 second(s) with 500 milliseconds interval)
\`\`\`

The failure screenshot shows an empty "Order history" page with no error. The test expects order **#10045**, which a colleague created manually on QA last month. QA's database was refreshed from a masked production copy last night.`,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 2,
      why: 'The precondition data disappeared with the DB refresh — an environment/test-data issue. The longer-term fix is a test-design improvement: create the order the test needs (via API or a setup step) instead of depending on manually created records. Answering "test bug" is defensible as the long-term action, but the immediate cause is the environment data change.',
    },
    {
      q: `**Failure 6** — \`CheckoutTest.placeOrderWithZipStartingWithZero\`

\`\`\`text
java.lang.AssertionError: expected [Thank you for your order!] but found [Something went wrong. Please try again.]
\`\`\`

The browser network tab (captured in the HAR attached to the build) shows \`POST /api/orders → 500\` with body \`{"error":"NumberFormatException: For input string: \\"01234\\""}\`. Other zip codes work.`,
      options: ['Product bug', 'Test bug', 'Environment issue', "Can't tell yet"],
      answer: 0,
      why: 'A server-side 500 with a NumberFormatException for a valid input (leading-zero zip) is a backend defect — exactly the kind of boundary/edge case a 6-year manual tester knows to try. Include the request payload, the response and the HAR in the defect. This is a great interview story: "our automation caught a backend defect on edge-case data."',
    },
  ],
  explanation: `**A repeatable triage routine (say this in interviews):**
1. **Read the failure** — exception type + the first frame in our code + the message.
2. **Look at the evidence** — screenshot, video, browser console/network, server logs.
3. **Reproduce manually** on the same build and environment.
4. **Classify:**
   - Reproduces manually → *product bug* → defect with evidence, link the test.
   - Works manually, script fails → *test bug* (locator, timing, data assumption) → fix & PR.
   - Infrastructure / data / config → *environment* → fix or escalate to DevOps, rerun.
5. **Communicate** — a short triage summary per failure in the release channel.

Track the ratio over time: if most failures are test bugs, invest in framework stability; if most are environment, push for stable test environments and data. That's the language leads and managers want to hear.`,
  mistakes: [
    'Raising defects for every red test without reproducing.',
    'Rerunning until green and reporting "all passed".',
    'Calling everything "flaky" instead of finding the cause.',
    'Not attaching evidence (screenshots, logs, HAR) to defects.',
  ],
  interview: [
    { q: 'A test fails in the pipeline. What do you do?', a: 'I read the failure and the evidence — stack trace, screenshot, logs — then reproduce manually on the same build. If it reproduces, I raise a defect with the evidence and link the test. If the feature works manually, it is a script problem like a changed locator or timing, so I fix the test. If it is connection, data or configuration, I treat it as an environment issue, get it fixed and rerun. I post a short triage summary so the release decision is based on facts.' },
    { q: 'How do you avoid raising false defects from automation?', a: 'By always reproducing manually or via API before raising, attaching evidence from the run, and checking whether the same test failed in previous runs or only after an environment change. My manual testing background helps me decide quickly whether the behaviour is really wrong from a user perspective.' },
  ],
}
