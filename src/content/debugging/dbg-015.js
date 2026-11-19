export default {
  id: 'dbg-015',
  category: 'debugging',
  kind: 'quiz',
  title: 'Reading a real Jenkins log: Caused by, config failures and skipped tests',
  level: 'EXPERT',
  tags: ['jenkins', 'stack-trace', 'testng', 'surefire', 'cucumber', 'reporting'],
  estMinutes: 20,
  scenario: `Your first week as the automation owner of ShopEasy on the team's shared QA environment (\`qa.shopeasy.local\`, with a real login service — not the local practice site). The nightly job page says **"Tests run: 120, Failures: 3, Errors: 2, Skipped: 41"**. The manager asks: "So 46 bugs?" You need to read the console like a senior: which line matters, what "Caused by" means, why 41 tests were skipped, and what to tell the manager.`,
  description: `Each question shows an excerpt from the same Jenkins console. Choose the best answer.`,
  hints: [
    'In Java, the deepest "Caused by:" is usually the real root cause.',
    'A failed @BeforeMethod/@BeforeClass makes TestNG SKIP the tests that depend on it.',
  ],
  questions: [
    {
      q: `Which line should you look at first to find **where in our code** this broke?

\`\`\`text
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for element to be clickable: By.id: finish (tried for 10 second(s) with 500 milliseconds interval)
	at org.openqa.selenium.support.ui.WebDriverWait.timeoutException(WebDriverWait.java:84)      // (A)
	at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)                     // (B)
	at com.shopeasy.pages.CheckoutPage.placeOrder(CheckoutPage.java:52)                          // (C)
	at com.shopeasy.stepdefs.CheckoutSteps.i_place_the_order(CheckoutSteps.java:37)             // (D)
	at ✽.I place the order(file:///.../features/checkout.feature:14)
\`\`\``,
      options: ['(A) WebDriverWait.java:84', '(B) FluentWait.java:230', '(C) CheckoutPage.java:52', '(D) CheckoutSteps.java:37'],
      answer: 2,
      why: 'Frames are listed from where the exception was thrown outward. Selenium library frames (A, B) are never the bug. The first frame in our own package (com.shopeasy) — CheckoutPage.java:52 — is where our code asked for the wait. (D) and the ✽ feature line tell you which step and scenario called it, which is useful context second.',
    },
    {
      q: `What is the real root cause here?

\`\`\`text
io.cucumber.core.exception.CucumberException: Failed to instantiate class com.shopeasy.stepdefs.CheckoutSteps
	at io.cucumber.picocontainer.PicoFactory.getInstance(PicoFactory.java:49)
	...
Caused by: org.picocontainer.PicoCompositionException: Failed to create TestContext
	at org.picocontainer.injectors.AbstractInjector...
	...
Caused by: java.io.FileNotFoundException: src/test/resources/config/qa.properties (No such file or directory)
	at java.base/java.io.FileInputStream.open0(Native Method)
	at com.shopeasy.config.ConfigReader.<init>(ConfigReader.java:18)
\`\`\``,
      options: [
        'Cucumber could not find the step definitions',
        'PicoContainer is not on the classpath',
        'The config file qa.properties is missing on the agent, so ConfigReader failed and everything built on it failed',
        'CheckoutSteps has a syntax error',
      ],
      answer: 2,
      why: 'Read the chain bottom-up: the last "Caused by" is the origin — ConfigReader could not open qa.properties (perhaps it is git-ignored, or the job passed -Denv=qa but only staging.properties exists). That made TestContext fail, which made the step class fail to instantiate. The top line is just the final symptom.',
    },
    {
      q: `What do these numbers mean?

\`\`\`text
[ERROR] Tests run: 120, Failures: 3, Errors: 2, Skipped: 41
\`\`\`
(Surefire report for a TestNG suite.)`,
      options: [
        '46 product defects were found',
        '3 assertion failures, 2 unexpected exceptions (e.g., Selenium/NPE), and 41 tests that never ran — usually because a configuration method or dependency failed',
        'Failures and errors are the same thing; skipped means the tests passed quickly',
        '41 tests were disabled with enabled = false',
      ],
      answer: 1,
      why: 'Failures = an assertion did not hold (AssertionError). Errors = an unexpected exception (NoSuchElement, Timeout, NPE). Skipped = never executed — typically a failed @BeforeClass/@BeforeMethod, dependsOnMethods on a failed test, or SkipException. None of these is automatically a "bug count": each must be triaged. Disabled tests (enabled = false) are not counted in the run at all.',
    },
    {
      q: `Why were 41 tests skipped?

\`\`\`text
[ERROR] setUp(com.shopeasy.tests.CheckoutTest)  Time elapsed: 30.211 s  <<< FAILURE!
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for url to contain "inventory.html". Current url: "http://qa.shopeasy.local/login.html?error=service-unavailable"
	at com.shopeasy.pages.LoginPage.loginAs(LoginPage.java:40)
	at com.shopeasy.tests.BaseTest.setUp(BaseTest.java:33)
...
===============================================
Shopeasy Regression
Total tests run: 120, Passes: 74, Failures: 5, Skips: 41
Configuration Failures: 1, Skips: 40
===============================================
\`\`\``,
      options: [
        'The 41 tests are flaky',
        'A configuration method (BaseTest.setUp — login) failed, so TestNG skipped the tests that depended on it; the login service was unavailable',
        'Someone added @Ignore to 41 tests',
        'TestNG ran out of threads',
      ],
      answer: 1,
      why: '"Configuration Failures: 1, Skips: 40" is the giveaway: one @Before... config method failed, and TestNG skipped the dependent tests (plus related config methods). The URL shows login redirected with error=service-unavailable — an environment problem with the auth service. Fixing one root cause recovers 41 tests. Use alwaysRun = true on teardown methods so cleanup still happens.',
    },
    {
      q: 'What do you tell the manager who asked "So 46 bugs?"',
      options: [
        '"Yes, 46 bugs — I will raise 46 defects."',
        '"The run is unreliable; ignore automation results this week."',
        '"No. 41 tests were skipped because the login service was down during the run (environment). Of the 5 real failures: 2 are a changed locator I\'m fixing, 1 is a config file issue, and 2 are product defects I reproduced manually — DEF-812 and DEF-813. I\'ll rerun the skipped tests once auth is up and confirm by 2 p.m."',
        '"I will rerun until it\'s green."',
      ],
      answer: 2,
      why: 'Managers need a classified, evidence-based summary with next steps and a time, not raw numbers. Separating environment noise from real defects builds trust in automation. This is also exactly the kind of "real-time story" interviewers want when they ask how you handle failures.',
    },
  ],
  explanation: `**How to read any Java/Selenium log in 60 seconds:**
1. Find the exception line (\`org.openqa.selenium.XxxException: message\`). The type gives the category; the message often gives the answer (locator, URL, versions, the element that intercepted the click).
2. Find the **first frame in your package** → where it broke in your code. Library frames are context.
3. Follow **"Caused by:"** to the bottom → the origin of the problem.
4. Check the summary: failures vs errors vs skipped, and **Configuration Failures**.
5. Fix the *first* failure in time order — later failures are often consequences.

Good frameworks make this easier: meaningful assertion messages, screenshots attached on failure, logging of the URL/step, and a "smoke" stage that fails fast when the environment is down.`,
  mistakes: [
    'Starting from the top library frame instead of the first frame in your own code.',
    'Ignoring "Caused by:" and fixing the symptom.',
    'Reporting skipped tests as failures (or as passes).',
    'Not using alwaysRun = true on teardown, leaving browsers open after config failures.',
  ],
  interview: [
    { q: 'How do you analyse a failure from the Jenkins console?', a: 'I locate the exception and its message, then the first stack frame in our own package to see where it broke, and follow the Caused by chain to the root cause. I check the summary for failures, errors, skips and configuration failures, open the attached screenshot and report, and fix the earliest failure first because later ones are often consequences.' },
    { q: 'What is the difference between a failure, an error and a skip in TestNG reports?', a: 'A failure is an assertion that did not hold, an error is an unexpected exception like a timeout or NullPointerException, and a skip means the test never ran — usually because a configuration method like @BeforeMethod failed or a test it depends on failed.' },
  ],
}
