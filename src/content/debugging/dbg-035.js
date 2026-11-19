export default {
  id: 'dbg-035',
  category: 'debugging',
  kind: 'quiz',
  title: 'UnexpectedAlertOpenException: a forgotten confirm blocks the next step',
  level: 'BEGINNER',
  tags: ['UnexpectedAlertOpenException', 'alerts', 'confirm', 'prompt', 'stack-trace'],
  estMinutes: 10,
  scenario: `The "Empty cart" regression on the ShopEasy alerts page (\`#js-confirm-btn\`, which opens *"Do you want to empty your cart?"*) fails, and so do the **next four tests** in the same class. Each of them shows \`UnexpectedAlertOpenException\` on a line that has nothing to do with alerts. Your lead asks you to find the one real problem before someone "fixes" five tests separately.`,
  description: `Answer the questions about the logs and snippets. Keep in mind: while a native alert is open, the browser refuses almost every other command.`,
  hints: [
    'The exception is thrown by the NEXT command after the alert opened, not by the line that opened it.',
    'The message usually contains the alert text — use it to find which click opened the alert.',
  ],
  questions: [
    {
      q: `What happened here?

\`\`\`text
org.openqa.selenium.UnexpectedAlertOpenException: unexpected alert open: {Alert text : Do you want to empty your cart?}
  (Session info: chrome=126.0.6478.126)
	at com.shopeasy.pages.AlertsPage.getResult(AlertsPage.java:41)
	at com.shopeasy.tests.AlertTest.emptyCartIsConfirmed(AlertTest.java:27)
\`\`\`

\`\`\`java
driver.findElement(By.id("js-confirm-btn")).click();
String result = driver.findElement(By.id("result")).getText();   // line 41
\`\`\``,
      options: [
        'The #result locator is wrong',
        'The confirm dialog is still open, so the browser blocks findElement; the test must accept or dismiss it first',
        'The page needs an explicit wait for #result',
        'Chrome crashed because of the pop-up',
      ],
      answer: 1,
      why: 'The click opened a native confirm. While it is open, WebDriver cannot touch the page, so the next command (findElement on line 41) throws UnexpectedAlertOpenException. The alert text in the message tells you which click caused it. Fix: `driver.switchTo().alert().accept()` (or dismiss), then read #result, which will say "You clicked: Ok".',
    },
    {
      q: `The first test fails like above. Why do the **next four tests** in the class fail with the same exception?`,
      options: [
        'Because TestNG retries the failing test four times',
        'Because all five tests share one browser (driver created in @BeforeClass), and the unclosed confirm is still open when the next test starts',
        'Because the confirm text is stored in a static variable',
        'Because Chrome shows the alert again on every page load',
      ],
      answer: 1,
      why: 'One browser per class means one leftover dialog blocks every later command, even driver.get(). Fix the root cause in the first test, and make tests independent: a fresh driver per test (@BeforeMethod), or an @AfterMethod that dismisses any open alert. Always fix the FIRST failure in a cascade.',
    },
    {
      q: `Which code correctly answers **Cancel** on the confirm and checks the result?`,
      options: [
        '`driver.findElement(By.xpath("//button[text()=\'Cancel\']")).click();`',
        '`driver.switchTo().alert().dismiss(); assertEquals(driver.findElement(By.id("result")).getText(), "You clicked: Cancel");`',
        '`driver.switchTo().alert().accept(); assertEquals(..., "You clicked: Cancel");`',
        '`driver.navigate().refresh();`',
      ],
      answer: 1,
      why: '`dismiss()` presses Cancel on a confirm (and on a prompt). Native dialogs have no DOM buttons, so XPath cannot find "Cancel". accept() is OK, which gives "You clicked: Ok". Refreshing with an alert open throws the same exception.',
    },
    {
      q: `A teammate "fixed" it by adding this to the ChromeOptions:

\`\`\`java
options.setUnhandledPromptBehaviour(UnexpectedAlertBehaviour.ACCEPT);
\`\`\`

The suite is green now. What is the risk?`,
      options: [
        'None, it is the recommended default',
        'It only works in Firefox',
        'Every unexpected alert is now accepted silently, including real bugs like an error alert — and a confirm such as "empty your cart?" is answered OK without the test asserting it',
        'It makes the suite slower',
      ],
      answer: 2,
      why: 'unhandledPromptBehavior is a global safety net, not a fix. It hides alerts the test never expected (which may be product bugs) and makes decisions for the test. Handle expected dialogs explicitly in the page object; keep the default (dismiss and notify), so unexpected ones still fail loudly.',
    },
  ],
  explanation: `**UnexpectedAlertOpenException = a native alert/confirm/prompt is open and you sent a command to the page.** The line in the stack trace is just the *next* command, not the cause. Read the alert text in the message, find the click that opened it, and handle the dialog there:

- \`alert.accept()\` = OK, \`alert.dismiss()\` = Cancel, \`alert.sendKeys("SAVE10")\` for a prompt (before accept).
- If the alert can be late, use \`wait.until(ExpectedConditions.alertIsPresent())\`.

**Cascades:** when one test leaves an alert open in a shared browser, every later test fails too. Fix the first failure, and keep tests independent so one leftover dialog cannot spread.`,
  mistakes: [
    'Debugging the line in the stack trace (findElement on #result) instead of the click that opened the alert.',
    'Trying to click the OK/Cancel button with a locator — native dialogs are not in the DOM.',
    'Setting unhandledPromptBehaviour to ACCEPT globally to hide the failures.',
    'Fixing five tests one by one when only the first one leaves the alert open.',
  ],
  interview: [
    { q: 'What causes UnexpectedAlertOpenException?', a: 'A native JavaScript dialog is open while the test sends another command to the page. The browser blocks the page until the dialog is handled. The fix is to switch to the alert and accept, dismiss or type into it at the step that opens it.' },
    { q: 'How do you handle a JavaScript prompt?', a: 'Switch to it with driver.switchTo().alert() (or wait for alertIsPresent), call sendKeys with the value, then accept(). Dismiss() cancels it. Then verify what the page did with the value.' },
  ],
}
