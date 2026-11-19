export default {
  id: 'java-002',
  category: 'java',
  kind: 'quiz',
  title: 'Interview warm-up: what does this String code print?',
  level: 'BEGINNER',
  tags: ['strings', 'interview', 'output-prediction'],
  estMinutes: 10,
  scenario: `You have a QA automation interview on Friday. The first round at most companies is a 20-minute "predict the output" screen on core Java — and String
questions come first because they expose whether you really understand references vs values. These are the exact patterns interviewers reuse.`,
  description: `Predict the output of each snippet **before** looking at the options. Each one mirrors a real bug seen in Selenium test code.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
String expected = "Login";
String actual = new String("Login");   // like a value returned by getText()
System.out.println(expected == actual);
System.out.println(expected.equals(actual));
\`\`\``,
      options: ['true / true', 'false / true', 'true / false', 'Compile error'],
      answer: 1,
      why: '`new String(...)` always creates a new object, so `==` (same reference?) is **false**, while `equals` (same characters?) is **true**. Text read from the browser behaves like `actual` — that is why `==` is a bug in assertions.',
    },
    {
      q: `What does this print?
\`\`\`java
String a = "Cart";
String b = "Cart";
System.out.println(a == b);
\`\`\``,
      options: ['true', 'false', 'It depends on the JVM, random each run', 'NullPointerException'],
      answer: 0,
      why: 'Both are **literals**, so Java reuses one object from the String pool and `==` happens to be **true**. This is exactly the trap: `==` "works" in a tiny demo and then fails with real `getText()` values. Never rely on it.',
    },
    {
      q: `What does this print?
\`\`\`java
String button = "  Pay Now ";
button.trim();
System.out.println("[" + button + "]");
\`\`\``,
      options: ['[Pay Now]', '[  Pay Now ]', '[Pay Now ]', 'Compile error: result of trim() is ignored'],
      answer: 1,
      why: 'Strings are **immutable**. `trim()` returns a new String, which is thrown away here. The original keeps its spaces. Fix: `button = button.trim();`.',
    },
    {
      q: `The error banner is not on the page, so \`errorText\` is \`null\`. What happens?
\`\`\`java
String errorText = null;
if (errorText.equals("Invalid password")) {
    System.out.println("error shown");
}
\`\`\``,
      options: ['Prints nothing', 'Prints "error shown"', 'Throws NullPointerException', 'Compile error'],
      answer: 2,
      why: 'Calling a method on `null` throws **NullPointerException**. The defensive idiom is `"Invalid password".equals(errorText)` (literal first) or `Objects.equals(a, b)`, which simply return false for null.',
    },
    {
      q: `What does this print?
\`\`\`java
System.out.println("Total: " + 10 + 5);
System.out.println(10 + 5 + " items");
\`\`\``,
      options: ['Total: 15 / 15 items', 'Total: 105 / 105 items', 'Total: 105 / 15 items', 'Total: 15 / 105 items'],
      answer: 2,
      why: '`+` is evaluated left to right. Once the left side is a String, `+` means concatenation: `"Total: " + 10` → `"Total: 10"`, then `+ 5` → `"Total: 105"`. In the second line `10 + 5` is numeric addition first (15), then concatenation. Wrap sums in parentheses in log messages: `"Total: " + (10 + 5)`.',
    },
    {
      q: `What does this print?
\`\`\`java
String label = "Add to Cart";
System.out.println(label.contains("cart"));
System.out.println(label.toLowerCase().contains("cart"));
\`\`\``,
      options: ['true / true', 'false / true', 'false / false', 'true / false'],
      answer: 1,
      why: '`contains` is **case-sensitive**: "Cart" ≠ "cart". Normalizing both sides with `toLowerCase()` makes the check case-insensitive. (There is no `containsIgnoreCase` in `String`.)',
    },
  ],
  hints: ['Ask yourself for each line: am I comparing references or characters?', 'Remember: Strings are immutable, and + is evaluated left to right.'],
  explanation: `Three ideas cover almost every String interview question:

1. **\`==\` vs \`equals\`** — \`==\` compares references, \`equals\` compares content. Literals may share a pooled object, which makes \`==\` look like it works.
2. **Immutability** — every String method returns a *new* String; you must assign the result.
3. **Null safety and evaluation order** — call \`equals\` on the known non-null value, and remember \`+\` concatenates left to right once a String is involved.

In test code, \`Assert.assertEquals(actual, expected)\` uses \`equals\` under the hood, which is one reason to prefer assertion libraries over hand-written \`if\` checks.`,
  mistakes: [
    'Concluding that == works for Strings because a demo with literals printed true.',
    'Forgetting to assign the result of trim(), replace() or toLowerCase().',
    'Calling actual.equals(expected) when actual can be null (element text missing).',
  ],
  interview: [
    { q: 'What is the String pool?', a: 'A JVM cache of String literals. Identical literals share one object, so == between two literals is true. Strings created at runtime (new String, concatenation of variables, getText()) are separate objects, so == is unreliable and equals() must be used.' },
    { q: 'Why are Strings immutable in Java?', a: 'For safety and performance: they can be shared (pool), cached (hashCode), used safely as Map keys and across threads. The side effect for testers is that every manipulation returns a new String.' },
    { q: 'How do you avoid NullPointerException when comparing text?', a: 'Put the known constant first ("expected".equals(actual)), use Objects.equals(a, b), or assert the value is not null first so the failure message is clear.' },
  ],
}
