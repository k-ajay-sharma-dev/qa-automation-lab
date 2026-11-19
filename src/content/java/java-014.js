export default {
  id: 'java-014',
  category: 'java',
  kind: 'quiz',
  title: 'Exception flow: predict the output like an interviewer expects',
  level: 'ADVANCED',
  tags: ['exceptions', 'finally', 'selenium-exceptions', 'interview'],
  estMinutes: 12,
  scenario: `The second interview round is usually with an SDET who reads code faster than you. They paste try/catch/finally snippets mixed with
Selenium exceptions and ask "what prints?" — because a tester who can't trace exception flow will write tests that pass when they should fail.`,
  description: `Trace each snippet carefully. Remember the Selenium hierarchy: \`TimeoutException\`, \`NoSuchElementException\` and \`StaleElementReferenceException\` all extend \`WebDriverException\`, which extends \`RuntimeException\`.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
static String check() {
    try {
        return "try";
    } finally {
        System.out.println("finally");
    }
}

public static void main(String[] args) {
    System.out.println(check());
}
\`\`\``,
      options: ['try', 'finally', 'finally then try', 'try then finally'],
      answer: 2,
      why: 'The return value "try" is computed, but **finally runs before the method actually returns**, so "finally" is printed first, then main prints "try". This is why cleanup in finally is safe even with early returns.',
    },
    {
      q: `What does this print?
\`\`\`java
try {
    System.out.println("A");
    throw new TimeoutException("cart badge not visible");
} catch (NoSuchElementException e) {
    System.out.println("B");
} catch (WebDriverException e) {
    System.out.println("C");
} finally {
    System.out.println("D");
}
\`\`\``,
      options: ['A B D', 'A C D', 'A D', 'A B C D'],
      answer: 1,
      why: 'Catch blocks are checked **top to bottom** and only the first matching one runs. `TimeoutException` is not a `NoSuchElementException`, but it **is a** `WebDriverException`, so "C" prints; finally always prints "D".',
    },
    {
      q: `What happens when you compile this?
\`\`\`java
try {
    driver.findElement(By.id("promo")).click();
} catch (Exception e) {
    System.out.println("something failed");
} catch (NoSuchElementException e) {
    System.out.println("no promo");
}
\`\`\``,
      options: [
        'Prints "no promo" when the element is missing',
        'Prints "something failed" when the element is missing',
        'Compile error: the second catch is unreachable because Exception already catches it',
        'Runtime error',
      ],
      answer: 2,
      why: 'A subclass catch after its superclass can never be reached, so the compiler rejects it ("exception NoSuchElementException has already been caught"). Always order catch blocks **from most specific to most general**.',
    },
    {
      q: 'There is **no** element matching `.error-banner` on the page. Which statement is true?',
      options: [
        'Both findElement and findElements throw NoSuchElementException',
        'findElement throws NoSuchElementException; findElements returns an empty list',
        'findElement returns null; findElements returns an empty list',
        'Both return null',
      ],
      answer: 1,
      why: '`findElement` never returns null — it throws (after the implicit wait, if one is set). `findElements` returns an empty `List`, which is why `driver.findElements(locator).isEmpty()` is the idiomatic absence check.',
    },
    {
      q: 'Why does `reader.close()` not need to be written anywhere in this code?\n```java\ntry (BufferedReader reader = Files.newBufferedReader(Path.of("users.csv"))) {\n    return reader.readLine();\n}\n```',
      options: [
        'The garbage collector closes files immediately',
        'try-with-resources automatically closes any AutoCloseable declared in the parentheses, even if an exception is thrown',
        'readLine() closes the file after reading',
        'It does need close(); this code leaks the file handle',
      ],
      answer: 1,
      why: 'Resources declared in `try (...)` must implement `AutoCloseable`; Java generates the equivalent of a finally block that closes them, in reverse order of declaration, even when the body throws.',
    },
    {
      q: `A test method contains the code below and the element is missing. What is the TestNG result?
\`\`\`java
@Test
public void promoBannerIsShown() {
    try {
        driver.findElement(By.id("promo")).isDisplayed();
    } catch (NoSuchElementException e) {
        System.out.println("banner missing");
    }
}
\`\`\``,
      options: ['FAILED', 'SKIPPED', 'PASSED', 'Compile error'],
      answer: 2,
      why: 'The exception is caught and only printed, and there is no assertion — so the test **passes** while the feature is broken. Catching exceptions in test bodies without an assert (or rethrow) is one of the most common causes of false-green suites.',
    },
  ],
  hints: ['Only the FIRST matching catch block runs.', 'finally runs before the method returns — even after a return statement.'],
  explanation: `Rules to apply when tracing exception flow:

1. When an exception is thrown, the rest of the \`try\` block is skipped.
2. \`catch\` blocks are tested top-to-bottom; the first whose type matches (same class *or superclass*) runs. Order them specific → general or the code won't compile.
3. \`finally\` runs no matter how the try/catch ends — including \`return\`.
4. A caught exception is "handled": unless you assert, rethrow or fail, the test framework sees a normal completion — a green test.

For Selenium, know the hierarchy (\`WebDriverException\` at the top, all unchecked) and the \`findElement\` vs \`findElements\` difference cold.`,
  mistakes: [
    'Assuming a catch for the parent type runs before a more specific one written below it.',
    'Thinking findElement returns null when nothing matches.',
    'Catching exceptions inside @Test methods without failing the test.',
  ],
  interview: [
    { q: 'What exceptions have you faced in Selenium and how did you handle them?', a: 'NoSuchElementException (fix the locator or wait for presence), TimeoutException (wait condition never met — check the condition and the app), StaleElementReferenceException (re-locate after DOM refresh), ElementClickInterceptedException (wait for overlays to disappear or scroll into view), and SessionNotCreatedException (driver/browser version mismatch).' },
    { q: 'Can we have try without catch?', a: 'Yes — try/finally (cleanup without handling) and try-with-resources are both valid without a catch block.' },
    { q: 'What is the difference between final, finally and finalize?', a: 'final is a modifier (constant variable, non-overridable method, non-extendable class). finally is the always-executed block of try/catch. finalize() was a deprecated GC hook on Object and should not be used.' },
  ],
}
