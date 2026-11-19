export default {
  slug: 'java-exceptions',
  category: 'java',
  order: 8,
  title: 'Exceptions: try, catch, finally and throwing your own',
  minutes: 10,
  summary: 'Read the exception hierarchy Selenium uses, catch only what you expect, always clean up with finally or try-with-resources, and throw clear custom exceptions for bad test data.',
  manualAnalogy: `When something unexpected happens during a manual run — the page crashes, the test data is missing — you do not quietly mark the test as passed. You stop, note *what* went wrong, tidy up (log out, close the browser) and report it. Exceptions are Java's way of saying "something unexpected happened"; your job is to decide which ones are expected, which ones are real failures, and to always tidy up.`,
  body: `## What an exception is

When Java cannot continue — a number cannot be parsed, an element is not on the page — it **throws** an exception object. Execution jumps out of the current method, then out of its caller, and so on, until something **catches** it. If nothing does, the program (or the test) fails and prints a stack trace.

## The family tree

Exceptions are classes, arranged by inheritance (see the *Inheritance* lesson):

\`\`\`
Throwable
├── Error                      (AssertionError — failed checks)
└── Exception                  (checked: IOException …)
    └── RuntimeException       (unchecked)
        ├── NullPointerException, NumberFormatException, IllegalArgumentException
        └── WebDriverException                 (Selenium)
            ├── NoSuchElementException
            ├── TimeoutException
            └── StaleElementReferenceException
\`\`\`

A \`catch (X e)\` block catches \`X\` **and every subclass of X**. So \`catch (WebDriverException e)\` also catches a \`TimeoutException\`.

- **Checked** exceptions (\`IOException\`) must be caught or declared with \`throws\` — the compiler forces you.
- **Unchecked** ones (\`RuntimeException\` and below, including all Selenium exceptions) need not be.

## try / catch / finally

\`\`\`java
try {
    driver.findElement(By.id("promo-banner")).click();
    System.out.println("clicked");
} catch (NoSuchElementException e) {
    System.out.println("No promo today: " + e.getMessage());
} finally {
    System.out.println("always printed");
}
\`\`\`

1. Code in \`try\` runs until a line throws.
2. Java checks the \`catch\` blocks **top to bottom** and runs the **first** one whose type matches. Only one runs.
3. \`finally\` runs **no matter what**: success, caught exception, uncaught exception, even a \`return\` inside \`try\` — \`finally\` runs before the method actually returns.

Order matters: put specific types **before** general ones. If \`catch (Exception e)\` came first, a later \`catch (NoSuchElementException e)\` could never run, and Java rejects that as a compile error ("exception has already been caught").

## Catching is a decision, not a reflex

\`\`\`java
// BAD: hides every problem, the test passes when it should fail
try { checkoutButton.click(); } catch (Exception e) { }
\`\`\`

A test fails because an exception escapes it. If you catch and ignore, TestNG sees a method that finished normally and reports **PASSED**. Rules:

- Catch only the **specific** exception you expect (\`NoSuchElementException\` for "may not be there").
- Never leave a catch block empty — return a value, log, or rethrow.
- If you cannot handle it, let it go.

A legitimate example — a query that answers "is it there?":

\`\`\`java
public boolean isCartBadgeShown() {
    try {
        return driver.findElement(By.cssSelector(".shopping-cart-badge")).isDisplayed();
    } catch (NoSuchElementException e) {
        return false;          // absence is an answer, not an error
    }
}
\`\`\`

## Cleanup with finally

\`\`\`java
try {
    runTheScenario();
} finally {
    driver.quit();           // the browser always closes, pass or fail
}
\`\`\`

If cleanup itself can fail (taking a screenshot, writing a report), wrap that step in its own try/catch inside the \`finally\`, so it cannot stop \`quit()\` from running.

## try-with-resources

Files and streams must be closed. Java can do it for you:

\`\`\`java
try (InputStream in = new FileInputStream("testdata.csv")) {
    // read from in
} catch (IOException e) {
    throw new RuntimeException("Cannot read testdata.csv", e);
}
\`\`\`

Whatever is declared in the brackets after \`try\` is closed automatically at the end. Note the rethrow: a missing data file should **stop the run** with a clear message, not be ignored. Passing \`e\` as the second argument keeps the original cause in the stack trace.

For file errors Java has a ready-made unchecked wrapper, \`java.io.UncheckedIOException\`: \`throw new UncheckedIOException("Cannot read " + path, e);\`. It says "this was an I/O problem" more precisely than a plain \`RuntimeException\`, and callers such as TestNG data providers don't need a \`throws IOException\` clause. The *Records, Optional and CSV test data* lesson uses this when reading test data line by line.

## Throwing your own

\`\`\`java
if (quantity < 1) {
    throw new IllegalArgumentException("quantity must be >= 1 but was " + quantity);
}
\`\`\`

For domain problems, create a named exception by extending \`RuntimeException\`:

\`\`\`java
public class EnvironmentNotReadyException extends RuntimeException {
    public EnvironmentNotReadyException(String message) {
        super(message);       // hand the message to the parent
    }
}
\`\`\`

A name like this in a CI log tells you instantly "the environment, not the app, is broken". A good message says what was expected and what was found.`,
  keyPoints: [
    'catch (X e) also catches every subclass of X; the first matching catch wins.',
    'Specific catch blocks go before general ones.',
    'finally always runs — even after return — so put driver.quit() there.',
    'An empty catch turns a failing test into a PASSED one.',
    'try-with-resources closes files automatically; extend RuntimeException for clear custom errors.',
  ],
  mistakes: [
    'catch (Exception e) { } — swallows real failures. Catch the specific type and act on it.',
    'Putting catch (Exception e) before catch (NoSuchElementException e) — compile error.',
    'Calling driver.quit() at the end of try only — it is skipped when a step throws. Use finally.',
    'Throwing new RuntimeException() with no message — always say what was expected and what happened.',
  ],
  tryIt: `Predict, then run: a try block that prints "A" and throws \`new IllegalStateException("x")\`, followed by \`catch (IllegalArgumentException e)\` printing "B", \`catch (RuntimeException e)\` printing "C" and \`finally\` printing "D". Which letters appear?`,
  problems: ['java-013', 'java-014', 'java-008', 'java-028', 'java-040'],
}
