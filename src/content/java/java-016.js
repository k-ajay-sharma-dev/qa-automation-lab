export default {
  id: 'java-016',
  category: 'java',
  kind: 'code',
  title: 'A generic retry(Supplier<T>, attempts) helper for flaky DOM refreshes',
  level: 'EXPERT',
  tags: ['generics', 'functional-interfaces', 'lambdas', 'stale-element', 'retry'],
  estMinutes: 40,
  scenario: `The product grid re-renders itself when prices load from a second API, so reading a card sometimes throws \`StaleElementReferenceException\`.
The team has copy-pasted a "try 3 times" loop into nine methods — each slightly different, two with \`Thread.sleep(2000)\`, one that retries forever.
You are asked to replace them with **one** generic helper that can retry *any* action and return *any* type: \`String\`, \`Integer\`, \`List<WebElement>\`, or nothing at all.`,
  description: `Implement \`Retry\`.

**Acceptance**
* \`public static <T> T retry(Supplier<T> action, int attempts)\`
  * validates \`attempts >= 1\` (otherwise \`IllegalArgumentException\`),
  * calls \`action.get()\` and returns its result as soon as it succeeds,
  * retries **only** on \`StaleElementReferenceException\` or \`ElementClickInterceptedException\` (any other exception must propagate immediately — a real bug should not be retried),
  * after the last failed attempt, rethrows the last exception (do not swallow it).
* \`public static void retry(Runnable action, int attempts)\` — an overload for actions with no result that **delegates** to the generic version.
* Use it from \`ProductGrid\` via lambdas: \`retry(() -> driver.findElement(firstPrice).getText(), 3)\` and \`retry(() -> driver.findElement(addToCart).click(), 3)\`.
* No \`Thread.sleep\`.`,
  hints: [
    'Generic method syntax: the type parameter goes before the return type — public static <T> T retry(Supplier<T> action, int attempts)',
    'Keep RuntimeException last = null; loop i = 1..attempts; try { return action.get(); } catch (StaleElementReferenceException | ElementClickInterceptedException e) { last = e; } — after the loop: throw last;',
    'Runnable overload: retry(() -> { action.run(); return null; }, attempts);',
  ],
  language: 'java',
  starterCode: `package com.shop.support;

import org.openqa.selenium.By;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;

public class ProductGrid {

    private final WebDriver driver;
    private final By firstPrice = By.cssSelector(".product-card:first-child .price");
    private final By addToCart = By.cssSelector(".product-card:first-child .add-to-cart");

    public ProductGrid(WebDriver driver) {
        this.driver = driver;
    }

    public String getFirstPrice() throws InterruptedException {
        for (int i = 0; i < 3; i++) {
            try {
                return driver.findElement(firstPrice).getText();
            } catch (Exception e) {
                Thread.sleep(2000);
            }
        }
        return null;
    }

    public void addFirstToCart() throws InterruptedException {
        for (int i = 0; i < 3; i++) {
            try {
                driver.findElement(addToCart).click();
                return;
            } catch (StaleElementReferenceException e) {
                Thread.sleep(2000);
            }
        }
    }

    // TODO: class Retry with
    //   public static <T> T retry(Supplier<T> action, int attempts)
    //   public static void retry(Runnable action, int attempts)
}
`,
  solution: `package com.shop.support;

import java.util.function.Supplier;
import org.openqa.selenium.By;
import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;

final class Retry {

    private Retry() { }

    /** Runs the action up to 'attempts' times, retrying only on transient DOM exceptions. */
    public static <T> T retry(Supplier<T> action, int attempts) {
        if (attempts < 1) {
            throw new IllegalArgumentException("attempts must be >= 1 but was " + attempts);
        }
        RuntimeException last = null;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                return action.get();
            } catch (StaleElementReferenceException | ElementClickInterceptedException e) {
                last = e;   // transient: the element is re-located on the next attempt
            }
        }
        throw last;   // all attempts failed: surface the real cause
    }

    /** Overload for actions without a result (click, sendKeys). */
    public static void retry(Runnable action, int attempts) {
        retry(() -> {
            action.run();
            return null;
        }, attempts);
    }
}

public class ProductGrid {

    private final WebDriver driver;
    private final By firstPrice = By.cssSelector(".product-card:first-child .price");
    private final By addToCart = By.cssSelector(".product-card:first-child .add-to-cart");

    public ProductGrid(WebDriver driver) {
        this.driver = driver;
    }

    public String getFirstPrice() {
        // the lambda re-runs findElement each attempt, so a stale reference is never reused
        return Retry.retry(() -> driver.findElement(firstPrice).getText(), 3);
    }

    public void addFirstToCart() {
        Retry.retry(() -> driver.findElement(addToCart).click(), 3);
    }

    public int getCardCount() {
        return Retry.retry(() -> driver.findElements(By.cssSelector(".product-card")).size(), 3);
    }
}
`,
  checks: [
    { label: 'Generic method signature <T> T retry(Supplier<T>, int)', pattern: '<\\s*T\\s*>\\s+T\\s+retry\\s*\\(\\s*Supplier\\s*<\\s*(\\?\\s+extends\\s+)?T\\s*>\\s+\\w+\\s*,\\s*int\\s+\\w+\\s*\\)', hint: 'public static <T> T retry(Supplier<T> action, int attempts)' },
    { label: 'Calls the supplier with get()', pattern: 'return\\s+\\w+\\.get\\s*\\(\\s*\\)', hint: 'return action.get();' },
    { label: 'Retries only transient exceptions', pattern: 'catch\\s*\\(\\s*(StaleElementReferenceException|ElementClickInterceptedException)', hint: 'catch (StaleElementReferenceException | ElementClickInterceptedException e)' },
    { label: 'Does not catch everything', pattern: 'catch\\s*\\(\\s*(Exception|Throwable|RuntimeException)\\s+\\w+\\s*\\)', mustNot: true, hint: 'Real bugs must not be retried.' },
    { label: 'Rethrows after the last attempt', pattern: 'throw\\s+\\w+\\s*;', hint: 'throw last;' },
    { label: 'Runnable overload delegates via a lambda', pattern: 'void\\s+retry\\s*\\(\\s*Runnable\\s+\\w+\\s*,\\s*int\\s+\\w+\\s*\\)[\\s\\S]*retry\\s*\\(\\s*\\(\\s*\\)\\s*->', hint: 'retry(() -> { action.run(); return null; }, attempts);' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Re-locating the element is what fixes staleness, not sleeping.' },
  ],
  explanation: `Three advanced Java features combine here:

* **Generics** — \`<T> T retry(Supplier<T> ...)\` declares a type parameter \`T\` for this method. The compiler infers it from the lambda: \`String\` for \`getText()\`, \`Integer\` for \`size()\`. One helper, full type safety, no casts.
* **Functional interfaces** — \`Supplier<T>\` (no input, returns \`T\`) and \`Runnable\` (no input, no result) each have exactly one abstract method, so a lambda can implement them. The lambda is *code passed as a value*: \`retry\` decides when and how often to run it.
* **Overloading + delegation** — the \`Runnable\` version adapts itself to a \`Supplier<Object>\` by returning \`null\`, so the retry policy lives in one place.

Why it actually fixes staleness: the lambda contains \`driver.findElement(...)\`, so every attempt **re-locates** the element. Retrying with a stored \`WebElement\` would fail forever.

Design choices a reviewer looks for:
* **Narrow retry policy** — retry transient DOM exceptions only. A \`NoSuchElementException\` from a broken locator should fail fast, not three times slower.
* **Never swallow** — the last exception is rethrown with its original stack trace.
* **Bounded** — validated \`attempts\`, no infinite loop, no fixed sleeps. If time-based waiting is needed, that is \`WebDriverWait\`'s job (or Awaitility), not a sleep in a retry loop.

Bonus: the same pattern generalises to \`retry(Supplier<T> action, int attempts, Class<? extends RuntimeException>... retryOn)\` or a \`@FunctionalInterface interface ThrowingSupplier<T> { T get() throws Exception; }\` for checked exceptions.`,
  mistakes: [
    'Catching Exception/Throwable and retrying real failures (wrong locator, assertion errors) — slow and misleading.',
    'Passing an already-found WebElement into the retry instead of a lambda that re-finds it.',
    'Returning null after all attempts fail instead of rethrowing — moves the failure to a confusing NPE later.',
    'Hiding flakiness with retries instead of fixing the wait condition — retries are for genuinely transient re-renders.',
  ],
  interview: [
    { q: 'What is a functional interface? Name some from java.util.function.', a: 'An interface with exactly one abstract method, so it can be implemented by a lambda or method reference. Supplier<T> (() -> T), Consumer<T> (T -> void), Function<T,R> (T -> R), Predicate<T> (T -> boolean), and Runnable. Selenium\'s ExpectedCondition is also effectively a Function<WebDriver, T>.' },
    { q: 'What are generics and why use them?', a: 'Type parameters that let classes and methods work with any type while keeping compile-time type checking, e.g. List<String> or <T> T retry(Supplier<T>). They remove casts and catch type errors at compile time. WebDriverWait.until is a generic method: it returns whatever type the condition returns.' },
    { q: 'How do you handle StaleElementReferenceException in your framework?', a: 'Avoid holding WebElement references across page updates (locate by By at the moment of use), wait for the re-render with ExpectedConditions (stalenessOf the old element, refreshed(...)), and for genuinely racy grids use a bounded retry that re-locates the element.' },
    { q: 'What is the difference between a retry helper and TestNG IRetryAnalyzer?', a: 'A retry helper retries one small action inside a test. IRetryAnalyzer re-runs the whole test after failure, which can mask real defects and slow suites — it should be used sparingly and reported, e.g. as a flaky-test signal.' },
  ],
}
