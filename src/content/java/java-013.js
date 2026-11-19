export default {
  id: 'java-013',
  category: 'java',
  kind: 'code',
  title: 'Exceptions done right: isDisplayed helper, custom exception, finally',
  level: 'ADVANCED',
  tags: ['exceptions', 'try-catch', 'finally', 'custom-exception'],
  estMinutes: 30,
  scenario: `Three problems from last week's CI runs, all exception handling:
(1) \`isPromoBannerShown()\` crashes the test with NoSuchElementException when the banner is *correctly* absent.
(2) A test failed with \`NullPointerException at CheckoutSteps.java:88\` — after an hour of digging, the real cause was a missing \`couponCode\` in the test-data file.
(3) When screenshot capture failed in teardown, \`driver.quit()\` never ran and the Grid filled up with orphan browsers.`,
  description: `Fix all three in \`TestSupport\`.

**Acceptance**
1. \`boolean isElementDisplayed(By locator)\` — returns \`false\` (instead of throwing) when the element does not exist: catch **\`NoSuchElementException\`** specifically, never a bare \`Exception\`, and never leave a \`catch\` block empty.
2. Create \`TestDataException extends RuntimeException\` with a \`(String message)\` constructor that calls \`super(message)\`. In \`requireData(Map<String,String> data, String key)\`, **throw** it with a clear message when the key is missing or blank.
3. \`tearDown()\` — try to take a screenshot, and use **\`finally\`** so \`driver.quit()\` always runs.`,
  hints: [
    'try { return driver.findElement(locator).isDisplayed(); } catch (NoSuchElementException e) { return false; }',
    'public class TestDataException extends RuntimeException { public TestDataException(String message) { super(message); } }',
    'try { takeScreenshot(); } finally { driver.quit(); }',
  ],
  language: 'java',
  starterCode: `package com.shop.support;

import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

public class TestSupport {

    private final WebDriver driver;

    public TestSupport(WebDriver driver) {
        this.driver = driver;
    }

    public boolean isElementDisplayed(By locator) {
        try {
            return driver.findElement(locator).isDisplayed();
        } catch (Exception e) {
        }
        return false;
    }

    public String requireData(Map<String, String> data, String key) {
        // TODO: throw a TestDataException when the key is missing/blank
        return data.get(key);
    }

    public void tearDown() {
        byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        System.out.println("Screenshot bytes: " + png.length);
        driver.quit();   // never reached if the screenshot throws
    }
}
`,
  solution: `package com.shop.support;

import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;

class TestDataException extends RuntimeException {
    public TestDataException(String message) {
        super(message);
    }
}

public class TestSupport {

    private final WebDriver driver;

    public TestSupport(WebDriver driver) {
        this.driver = driver;
    }

    /** Absence is a valid answer here, so NoSuchElementException means "not displayed". */
    public boolean isElementDisplayed(By locator) {
        try {
            return driver.findElement(locator).isDisplayed();
        } catch (NoSuchElementException e) {
            return false;
        }
    }

    public String requireData(Map<String, String> data, String key) {
        String value = data.get(key);
        if (value == null || value.isBlank()) {
            throw new TestDataException("Test data key '" + key + "' is missing or empty. Available keys: " + data.keySet());
        }
        return value;
    }

    public void tearDown() {
        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            System.out.println("Screenshot bytes: " + png.length);
        } catch (WebDriverException e) {
            System.err.println("Could not capture screenshot: " + e.getMessage());
        } finally {
            driver.quit();   // always release the browser / Grid slot
        }
    }
}
`,
  checks: [
    { label: 'Catches NoSuchElementException specifically', pattern: 'catch\\s*\\(\\s*(org\\.openqa\\.selenium\\.)?NoSuchElementException\\s+\\w+\\s*\\)', hint: 'catch (NoSuchElementException e) { return false; }' },
    { label: 'No empty catch blocks', pattern: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}', mustNot: true, hint: 'An empty catch hides failures - return a value, log, or rethrow.' },
    { label: 'Does not catch bare Exception/Throwable', pattern: 'catch\\s*\\(\\s*(Exception|Throwable)\\s+\\w+\\s*\\)', mustNot: true, hint: 'Catch the specific exception you expect.' },
    { label: 'Defines a custom exception class', pattern: 'class\\s+TestDataException\\s+extends\\s+(RuntimeException|Exception)', hint: 'class TestDataException extends RuntimeException' },
    { label: 'Custom exception passes the message to super', pattern: 'super\\s*\\(\\s*message', hint: 'public TestDataException(String message) { super(message); }' },
    { label: 'Throws the custom exception', pattern: 'throw\\s+new\\s+TestDataException\\s*\\(', hint: 'throw new TestDataException("Test data key ... is missing");' },
    { label: 'quit() runs in a finally block', pattern: 'finally\\s*\\{[^}]*\\.quit\\s*\\(', hint: 'try { ... } finally { driver.quit(); }' },
  ],
  explanation: `Exception handling in tests has one goal: **failures must be loud, early and specific**.

* **Catch narrowly.** \`NoSuchElementException\` really does mean "not on the page" — for an *is-it-displayed* query that's a valid \`false\`. Catching \`Exception\` would also hide \`StaleElementReferenceException\`, a dead session, or your own NPE, turning real failures into a quiet \`false\`. Empty catch blocks are the worst version of this.
* **Custom exceptions** turn a vague \`NullPointerException\` 50 lines later into \`TestDataException: key 'couponCode' is missing. Available keys: [user, zip]\` at the exact point of the problem. Extending \`RuntimeException\` (unchecked) avoids forcing \`throws\` clauses on every step definition.
* **finally** always runs — after normal completion, after a \`return\`, after an exception. Cleanup (\`quit\`, closing files, DB connections) belongs there, or in try-with-resources for \`AutoCloseable\` objects.

Selenium exceptions to know: \`NoSuchElementException\`, \`TimeoutException\`, \`StaleElementReferenceException\`, \`ElementClickInterceptedException\`, \`ElementNotInteractableException\` — all extend \`WebDriverException\`, which is a \`RuntimeException\`.`,
  mistakes: [
    'catch (Exception e) {} — swallowing every failure, including bugs in your own code.',
    'Importing java.util.NoSuchElementException instead of org.openqa.selenium.NoSuchElementException — the catch never matches.',
    'Using try/catch around findElement to wait for something — use WebDriverWait instead.',
    'Calling driver.quit() at the end of the test body instead of in finally/@After, leaking browsers on failure.',
  ],
  interview: [
    { q: 'Checked vs unchecked exceptions?', a: 'Checked exceptions (IOException, SQLException) must be caught or declared with throws; the compiler enforces it. Unchecked exceptions extend RuntimeException (NullPointerException, all Selenium exceptions) and need no declaration. Custom test exceptions are usually unchecked.' },
    { q: 'Does finally always execute?', a: 'Yes, after try/catch completes normally, via return, or via an exception. The exceptions are System.exit(), a JVM crash, or an infinite loop/hang in the try block.' },
    { q: 'How do you handle StaleElementReferenceException?', a: 'Re-locate the element instead of reusing the old reference: locate by By inside the action, use ExpectedConditions.refreshed(...), or a small retry wrapper that re-finds and retries a limited number of times.' },
    { q: 'throw vs throws?', a: 'throw actually raises an exception object inside a method body. throws is part of the method signature declaring which checked exceptions the method may pass to its caller.' },
  ],
}
