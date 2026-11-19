export default {
  id: 'java-040',
  category: 'java',
  kind: 'code',
  title: 'Exception chaining: wrap the TimeoutException without losing the cause',
  level: 'EXPERT',
  tags: ['exceptions', 'exception-chaining', 'custom-exception', 'getcause', 'debugging'],
  estMinutes: 25,
  scenario: `The nightly report shows 9 checkout failures with the same message: \`java.lang.RuntimeException: Checkout failed\`. No stack trace below it, no hint of which element or which wait.
The culprit in \`CheckoutPage.continueToOverview()\`: it catches the \`TimeoutException\`, prints it to a console nobody reads, and throws a **new** exception that does not carry the original.
Triage takes an hour per run. Java can **chain** exceptions so the new, readable message and the original technical cause travel together.`,
  description: `Fix \`CheckoutPage\`.

**Acceptance**
* \`CheckoutFailedException extends RuntimeException\` with a \`(String message, Throwable cause)\` constructor that calls \`super(message, cause)\`.
* \`continueToOverview()\` clicks \`#continue\` and waits for \`#checkout-step-two\`. On \`TimeoutException\`, read the error banner \`#checkout-error-message\` (it may be empty) and \`throw new CheckoutFailedException("...", e)\` with a message that includes the banner text.
* No \`printStackTrace()\` and no message-only \`new RuntimeException("...")\`.
* \`static Throwable rootCause(Throwable t)\` follows \`getCause()\` in a loop and returns the deepest exception (useful in a TestNG listener or Cucumber hook to log the real reason).`,
  hints: [
    'public CheckoutFailedException(String message, Throwable cause) { super(message, cause); }',
    'catch (TimeoutException e) { String banner = ...; throw new CheckoutFailedException("Overview did not load. Banner: \'" + banner + "\'", e); }',
    'Throwable root = t; while (root.getCause() != null && root.getCause() != root) { root = root.getCause(); } return root;',
  ],
  language: 'java',
  starterCode: `package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

public class CheckoutPage extends BasePage {

    public CheckoutPage(WebDriver driver) { super(driver); }

    public void continueToOverview() {
        driver.findElement(By.id("continue")).click();
        try {
            new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.visibilityOfElementLocated(By.id("checkout-step-two")));
        } catch (TimeoutException e) {
            e.printStackTrace();
            throw new RuntimeException("Checkout failed");
        }
    }

    // TODO: CheckoutFailedException with (message, cause)
    // TODO: static Throwable rootCause(Throwable t)
}
`,
  solution: `package com.shopeasy.pages;

import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

public class CheckoutPage extends BasePage {

    public static class CheckoutFailedException extends RuntimeException {
        public CheckoutFailedException(String message, Throwable cause) {
            super(message, cause);   // keeps the original exception and its stack trace
        }
    }

    public CheckoutPage(WebDriver driver) { super(driver); }

    public void continueToOverview() {
        driver.findElement(By.id("continue")).click();
        try {
            new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.visibilityOfElementLocated(By.id("checkout-step-two")));
        } catch (TimeoutException e) {
            List<WebElement> banner = driver.findElements(By.id("checkout-error-message"));
            String bannerText = banner.isEmpty() ? "" : banner.get(0).getText().trim();
            throw new CheckoutFailedException(
                "Checkout overview did not load after Continue. Error banner: '" + bannerText + "'", e);
        }
    }

    public static Throwable rootCause(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root;
    }
}

// Report now shows:
// CheckoutFailedException: Checkout overview did not load after Continue. Error banner: 'Error: Postal Code is required'
//     at CheckoutPage.continueToOverview(CheckoutPage.java:27)
// Caused by: org.openqa.selenium.TimeoutException: Expected condition failed: waiting for visibility of
//     element located by By.id: checkout-step-two (tried for 10 second(s) ...)
`,
  checks: [
    { label: 'Custom exception extends RuntimeException', pattern: 'class\\s+CheckoutFailedException\\s+extends\\s+RuntimeException', hint: 'public static class CheckoutFailedException extends RuntimeException' },
    { label: 'Constructor passes message AND cause to super', pattern: 'super\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)', hint: 'super(message, cause);' },
    { label: 'Rethrows with the caught exception as cause', pattern: 'throw\\s+new\\s+CheckoutFailedException\\s*\\([\\s\\S]*?,\\s*e\\s*\\)\\s*;', hint: 'throw new CheckoutFailedException("...", e);' },
    { label: 'rootCause walks getCause() in a loop', pattern: 'while\\s*\\([^)]*\\.getCause\\s*\\(\\s*\\)', hint: 'while (root.getCause() != null) root = root.getCause();' },
    { label: 'No printStackTrace', pattern: '\\.printStackTrace\\s*\\(', mustNot: true, hint: 'The chained cause already carries the stack trace into the report.' },
    { label: 'No message-only RuntimeException', pattern: 'new\\s+RuntimeException\\s*\\(\\s*"[^"]*"\\s*\\)', mustNot: true, hint: 'A new exception without the cause throws away the real error.' },
  ],
  explanation: `**Exception chaining** means creating a new exception that holds the original one as its **cause**. Every Throwable has a \`(message, cause)\` constructor, and the stack trace then prints both, joined by \`Caused by:\`.

Why the original code hurt:
* \`new RuntimeException("Checkout failed")\` starts a **new** stack trace at the catch block. The TimeoutException (which locator, how long) is lost.
* \`printStackTrace()\` writes to the console, not to the TestNG/Extent/Allure report, and the test keeps going until the throw.

The fix gives two layers of information: a **business-level** message a manual tester can read ("Error banner: 'Error: Postal Code is required'") and the **technical** cause underneath for the developer. That is the main reason to wrap: add context, never remove it.

\`rootCause\` is handy in an \`@AfterMethod\` or Cucumber \`@After\` hook: log \`rootCause(result.getThrowable()).getClass().getSimpleName()\` to group failures by real reason (TimeoutException vs StaleElementReferenceException) across a whole run. The \`!= root\` guard prevents an endless loop on a badly built exception that names itself as its cause.

Only wrap when you add context. If you have nothing useful to add, don't catch at all; let the original exception fail the test.`,
  mistakes: [
    'throw new RuntimeException(e.getMessage()), which keeps the text but loses the type and stack trace.',
    'Catching Exception instead of TimeoutException, so assertion errors and real bugs are re-labelled as "checkout failed".',
    'Logging the exception AND rethrowing it, so every failure appears twice in the logs.',
    'Reading the error banner with findElement inside the catch, which can throw a second exception that hides the first.',
  ],
  interview: [
    { q: 'What is exception chaining and why use it?', a: 'Wrapping a caught exception as the cause of a new one: throw new MyException("context", e). The new exception adds business context while getCause() and the "Caused by" section keep the original type and stack trace for debugging.' },
    { q: 'Checked vs unchecked exceptions: which should a custom framework exception be?', a: 'Usually unchecked (extends RuntimeException), so page methods and step definitions do not need throws clauses. A checked exception forces every caller to handle it, which in test code mostly produces empty catch blocks.' },
    { q: 'How do you find the real reason for a failure in a listener?', a: 'Get the Throwable from ITestResult.getThrowable() (or Scenario in Cucumber) and walk getCause() to the deepest exception. Log its class and message, and attach a screenshot, so failures can be grouped by real cause.' },
  ],
}
