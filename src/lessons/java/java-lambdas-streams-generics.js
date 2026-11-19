export default {
  slug: 'java-lambdas-streams-generics',
  category: 'java',
  order: 9,
  title: 'Lambdas, streams and generic methods',
  minutes: 10,
  summary: 'Read and write lambdas, replace loops with stream pipelines (map, filter, sorted, collect), and understand generic methods that take Supplier/Runnable — the building blocks of waits and retries.',
  manualAnalogy: `When you hand a colleague a checklist you sometimes hand over the *instructions* rather than the result: "for each row, read the price, keep the ones over $50". A **lambda** is a piece of instructions you pass around; a **stream** is the assembly line that applies those instructions to every item. Selenium's waits already work this way — you hand them "the condition to keep checking".`,
  body: `## Lambdas: a method without a name

\`\`\`java
(String s) -> s.trim()          // takes s, returns s.trim()
s -> s.trim()                   // same, type inferred
() -> driver.getTitle()         // takes nothing, returns a String
() -> button.click()            // takes nothing, returns nothing
(a, b) -> a + b                 // takes two values
\`\`\`

Left of \`->\`: the parameters. Right: the body (one expression, or \`{ ... }\` with \`return\`). A lambda is not run when written — it is a value you **pass** to something that runs it later, possibly many times.

A **method reference** is shorthand when the lambda just calls one method: \`s -> s.trim()\` can be written \`String::trim\`; \`el -> el.getText()\` becomes \`WebElement::getText\`.

## Functional interfaces: the "type" of a lambda

Every lambda fits an interface with a single abstract method. The common ones in \`java.util.function\`:

| Interface | Shape | Called with | Example |
|---|---|---|---|
| \`Supplier<T>\` | () → T | \`get()\` | \`() -> driver.getCurrentUrl()\` |
| \`Runnable\` | () → nothing | \`run()\` | \`() -> driver.navigate().refresh()\` |
| \`Function<T, R>\` | T → R | \`apply(t)\` | \`text -> Double.parseDouble(text)\` |
| \`Predicate<T>\` | T → boolean | \`test(t)\` | \`name -> name.startsWith("Retro")\` |

\`\`\`java
Supplier<String> currentTitle = () -> driver.getTitle();
String t = currentTitle.get();       // the lambda runs now
\`\`\`

## Streams: loops as a pipeline

Compare a loop that keeps product names containing "Tee", upper-cased:

\`\`\`java
List<String> result = new ArrayList<>();
for (String n : names) {
    if (n.contains("Tee")) {
        result.add(n.toUpperCase());
    }
}
\`\`\`

with the stream version:

\`\`\`java
List<String> result = names.stream()
        .filter(n -> n.contains("Tee"))      // keep matching items
        .map(n -> n.toUpperCase())           // transform each item
        .collect(Collectors.toList());       // gather into a List
\`\`\`

- \`stream()\` starts the pipeline from a collection.
- \`filter(predicate)\` keeps items where the lambda returns \`true\`.
- \`map(function)\` turns each item into something else (text → number, element → text).
- \`sorted()\` / \`sorted(Comparator.reverseOrder())\` orders them.
- \`collect(Collectors.toList())\` (or \`.toList()\` in Java 16+) ends the pipeline and returns a new List. The original list is untouched.

Other useful endings: \`count()\`, \`anyMatch(p)\`, \`allMatch(p)\`, \`noneMatch(p)\`, \`findFirst()\`.

A testing tip: instead of asserting \`allMatch(...)\` (which only says *false*), **filter the offenders** and assert that list is empty — the failure message then names exactly which items broke the rule.

Streams are not always better. A loop with several \`if\`s, early exits or try/catch inside is often clearer as a loop.

## Generic methods: \`<T>\` means "any type, decided by the caller"

You have used generic *classes* (\`List<String>\`). A method can be generic too:

\`\`\`java
public static <T> T firstOrFail(List<T> items, String what) {
    if (items.isEmpty()) {
        throw new IllegalStateException("No " + what + " found");
    }
    return items.get(0);
}

String name = firstOrFail(names, "product names");          // T = String
WebElement row = firstOrFail(rows, "table rows");            // T = WebElement
\`\`\`

The \`<T>\` before the return type declares a type variable. The compiler works out \`T\` from the arguments, so one method serves every type and still returns the correct type — no casting.

## Putting it together: a timing helper

Combine a generic method with \`Supplier<T>\` and you can wrap **any** browser step:

\`\`\`java
public static <T> T timed(String label, Supplier<T> step) {
    long start = System.currentTimeMillis();
    try {
        return step.get();                          // run the caller's lambda
    } finally {
        System.out.println(label + " took " + (System.currentTimeMillis() - start) + " ms");
    }
}

String title = timed("read title", () -> driver.getTitle());
\`\`\`

And a version for steps that return nothing can **delegate** to it by adapting a \`Runnable\` into a \`Supplier\`:

\`\`\`java
public static void timed(String label, Runnable step) {
    timed(label, () -> { step.run(); return null; });
}
\`\`\`

This "pass the step in as a lambda" idea is exactly how \`WebDriverWait.until(...)\` works and how retry helpers are built: the helper controls *when and how often* to run the step; the caller decides *what* the step is.`,
  keyPoints: [
    'A lambda (params) -> body is behaviour you pass to another method to run later.',
    'Supplier = () -> value, Runnable = () -> nothing, Function = x -> y, Predicate = x -> boolean.',
    'stream().filter(...).map(...).collect(...) replaces build-a-list loops.',
    'Filter the offenders and assert the list is empty for readable failure messages.',
    '<T> before the return type makes a method work for any type, chosen by the caller.',
  ],
  mistakes: [
    'Forgetting the terminal step (collect/count) — a stream without it does nothing.',
    'Expecting map/filter to modify the original list — streams return a new result.',
    'Calling a Supplier but forgetting .get() — you passed the instructions but never ran them.',
    'Catching every exception inside a generic helper — catch only the ones you mean to handle, let real bugs propagate.',
  ],
  tryIt: `Take the six product names from http://localhost:5180/practice-site/inventory.html as a \`List.of(...)\`. With one stream, produce the names that contain the letter "e" (case-insensitive), sorted A→Z. Then count how many names are longer than 15 characters.`,
  problems: ['java-015', 'java-016'],
}
