export default {
  id: 'sel-008',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'FluentWait with a custom condition for a slow, flickering status',
  level: 'ADVANCED',
  tags: ['FluentWait', 'waits', 'lambda', 'StaleElementReferenceException'],
  estMinutes: 25,
  scenario: `The order-export job on staging takes anywhere from 2 to 40 seconds. While it runs, the status label is re-rendered every second ("Queued" → "Processing 40%" → "Processing 80%" → "Ready"), so the existing wait sometimes dies with \`StaleElementReferenceException\` and sometimes with \`NoSuchElementException\` during the redraw. The standard \`ExpectedConditions\` don't express "status says Ready", so you need a custom wait. \`waits.html\` has a similar multi-step status you can practise on: "Place order" (\`#place-order-btn\`) moves \`#order-status\` through "Pending" → "Processing" → "Completed".`,
  description: `Write a reusable helper \`waitForStatus(String expected)\` that:

1. Uses \`FluentWait<WebDriver>\` with **timeout 60s**, **polling every 2s**.
2. Ignores **both** \`NoSuchElementException\` and \`StaleElementReferenceException\` (use \`ignoring\` or \`ignoreAll\`).
3. Has a meaningful \`withMessage(...)\`.
4. Uses a **lambda** condition that re-finds the status element on every poll and returns the text once it equals \`expected\` (return \`null\` / \`false\` to keep polling).
5. Returns the final text so the test can assert on it.

Then use it in a test on \`waits.html\`: click **Place order** (\`#place-order-btn\`), \`waitForStatus("Completed")\` on \`#order-status\`, assert.

**Rules**: no \`Thread.sleep\`, no hand-written retry loops, never cache the WebElement outside the lambda.`,
  hints: [
    'Wait<WebDriver> wait = new FluentWait<>(driver).withTimeout(...).pollingEvery(...).ignoring(...)',
    'The lambda receives the driver: d -> { String t = d.findElement(STATUS).getText(); return t.equals(expected) ? t : null; }',
    'Re-finding inside the lambda is what makes stale elements harmless: each poll gets a fresh reference.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class OrderStatusTest extends BaseTest {

    private static final By PLACE_ORDER = By.id("place-order-btn");
    private static final By STATUS = By.id("order-status");

    private String waitForStatus(String expected) {
        WebElement status = driver.findElement(STATUS); // cached: goes stale on redraw
        for (int i = 0; i < 30; i++) {
            if (status.getText().equals(expected)) {
                return status.getText();
            }
            // TODO: replace this loop with a FluentWait
        }
        throw new AssertionError("Status never became " + expected);
    }

    @Test
    public void orderBecomesCompleted() {
        driver.get("http://localhost:5180/practice-site/waits.html");
        driver.findElement(PLACE_ORDER).click();
        Assert.assertEquals(waitForStatus("Completed"), "Completed");
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.FluentWait;
import org.openqa.selenium.support.ui.Wait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class OrderStatusTest extends BaseTest {

    private static final By PLACE_ORDER = By.id("place-order-btn");
    private static final By STATUS = By.id("order-status");

    private String waitForStatus(String expected) {
        Wait<WebDriver> wait = new FluentWait<>(driver)
                .withTimeout(Duration.ofSeconds(60))
                .pollingEvery(Duration.ofSeconds(2))
                .ignoreAll(List.of(NoSuchElementException.class, StaleElementReferenceException.class))
                .withMessage("Order status did not become '" + expected + "' within 60s");

        return wait.until(d -> {
            String text = d.findElement(STATUS).getText().trim();
            return text.equals(expected) ? text : null;
        });
    }

    @Test
    public void orderBecomesCompleted() {
        driver.get("http://localhost:5180/practice-site/waits.html");
        driver.findElement(PLACE_ORDER).click();
        Assert.assertEquals(waitForStatus("Completed"), "Completed");
    }
}
`,
  checks: [
    { label: 'Creates a FluentWait', pattern: 'new\\s+FluentWait\\s*<', hint: 'new FluentWait<>(driver)' },
    { label: 'Sets the timeout', pattern: '\\.withTimeout\\s*\\(\\s*Duration\\.of', hint: '.withTimeout(Duration.ofSeconds(60))' },
    { label: 'Sets the polling interval', pattern: '\\.pollingEvery\\s*\\(\\s*Duration\\.of', hint: '.pollingEvery(Duration.ofSeconds(2))' },
    { label: 'Ignores StaleElementReferenceException', pattern: '\\.(ignoring|ignoreAll)\\s*\\([\\s\\S]*?StaleElementReferenceException', hint: '.ignoring(StaleElementReferenceException.class)' },
    { label: 'Uses a lambda that re-finds the element', pattern: 'until\\s*\\(\\s*\\(?\\s*\\w+\\s*\\)?\\s*->[\\s\\S]*?findElement', hint: 'wait.until(d -> d.findElement(STATUS)...)' },
    { label: 'No hand-written loop or sleep', pattern: '(Thread\\.sleep|for\\s*\\(\\s*int)', mustNot: true, hint: 'Let FluentWait do the polling' },
  ],
  explanation: `\`FluentWait\` is the general-purpose engine behind \`WebDriverWait\`. You control:

- **withTimeout** — maximum time before \`TimeoutException\`
- **pollingEvery** — how often the condition is evaluated (2s here: no need to hammer a page that updates every second)
- **ignoring / ignoreAll** — exceptions that mean "not yet" rather than "failed". During a re-render, \`NoSuchElementException\` (element briefly removed) and \`StaleElementReferenceException\` (old reference detached) are both expected.
- **withMessage** — what appears in the Jenkins report.

The condition is a \`Function<WebDriver, T>\`: returning \`null\` or \`false\` means "poll again"; anything else ends the wait and is returned by \`until\`. Because the lambda calls \`findElement\` on every poll, it always works on a fresh element — this is the cleanest cure for stale references.

\`WebDriverWait\` can do the same (\`new WebDriverWait(driver, Duration.ofSeconds(60)).pollingEvery(...).ignoring(...)\`), so in a real framework you might keep one wait type — the point is knowing these knobs exist.`,
  mistakes: [
    'Finding the element once outside the lambda — the cached reference goes stale and ignoring the exception just makes the wait spin until timeout.',
    'Returning text.equals(expected) as a Boolean from a lambda declared to return String, or returning "" instead of null (empty string is non-null, so the wait ends).',
    'Ignoring every Exception.class — real failures (e.g. NoSuchWindowException) are hidden until the timeout.',
    'Polling every 100ms on a heavy page, adding load and log noise.',
  ],
  interview: [
    { q: 'When would you use FluentWait over WebDriverWait?', a: 'When you need a non-default polling interval, extra ignored exceptions, a custom timeout message, or to wait on something other than the driver (FluentWait<T> works on any object, e.g. a file or API client).' },
    { q: 'How does a custom wait condition signal "keep waiting"?', a: 'By returning null or Boolean.FALSE, or by throwing an exception that is in the ignored list. Any other return value ends the wait and is returned from until().' },
    { q: 'What is the default polling interval of WebDriverWait?', a: '500 milliseconds, and it ignores NotFoundException (which includes NoSuchElementException) by default.' },
  ],
}
