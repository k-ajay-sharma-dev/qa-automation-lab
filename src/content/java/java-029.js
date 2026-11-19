export default {
  id: 'java-029',
  category: 'java',
  kind: 'quiz',
  title: 'final and a TestConstants class: what is really locked?',
  level: 'BEGINNER',
  tags: ['final', 'constants', 'static', 'immutability', 'interview'],
  estMinutes: 10,
  scenario: `The ShopEasy suite had \`10\` (wait seconds), \`"product-sort"\` and \`"lohi"\` typed by hand in 40 places. In the retro the team agreed on a \`TestConstants\` class full of \`public static final\` fields.
A week later a test "changed a constant" and broke three others in the same run. Before you review the PR, check you know exactly what \`final\` locks and what it does not.`,
  description: `Answer each question. Several ask what happens when the code compiles and runs, so trace it line by line.`,
  questions: [
    {
      q: `A teammate needs a longer wait in one slow test and writes the last line below. What happens?
\`\`\`java
public final class TestConstants {
    private TestConstants() { }
    public static final int EXPLICIT_WAIT_SECONDS = 10;
    public static final String SORT_DROPDOWN_ID = "product-sort";
}

// in CheckoutTest
TestConstants.EXPLICIT_WAIT_SECONDS = 20;
\`\`\``,
      options: [
        'It works, but only for CheckoutTest',
        'It works and changes the value for every test in the run',
        'Compile error: cannot assign a value to final variable EXPLICIT_WAIT_SECONDS',
        'It compiles, then throws IllegalAccessException at runtime',
      ],
      answer: 2,
      why: 'A `final` variable can be assigned exactly once. The compiler rejects the second assignment, which is the whole point: no test can quietly change a shared value. The slow test should pass its own timeout to the wait helper instead.',
    },
    {
      q: `What does this print?
\`\`\`java
static final List<String> MUST_SHOW = new ArrayList<>(
        List.of("Trailblazer Backpack", "Pulse Bike Light"));

public static void main(String[] args) {
    MUST_SHOW.add("Junior Onesie");
    System.out.println(MUST_SHOW.size());
}
\`\`\``,
      options: ['2', '3', 'Compile error: MUST_SHOW is final', 'UnsupportedOperationException'],
      answer: 1,
      why: '`final` locks the **reference**: `MUST_SHOW` can never point to a different list. It does not freeze the **object** it points to. An `ArrayList` is mutable, so `add` works and the size is 3. This is how "constants" leak state between tests.',
    },
    {
      q: `Now the list is built with \`List.of\`. What happens?
\`\`\`java
static final List<String> SORT_VALUES = List.of("az", "za", "lohi", "hilo");

SORT_VALUES.add("newest");
\`\`\``,
      options: [
        'Compile error, because List.of returns an array',
        'It adds "newest" and the size becomes 5',
        'It compiles, but throws UnsupportedOperationException at runtime',
        'It silently ignores the add',
      ],
      answer: 2,
      why: '`List.of` (and `Set.of`, `Map.of`) returns an **unmodifiable** list. The compiler only sees the `List` interface, which has `add`, so it compiles, but the call throws `UnsupportedOperationException`. `final` + `List.of` is what a truly constant collection looks like.',
    },
    {
      q: 'Why does `TestConstants` have a `private` constructor?',
      options: [
        'So the constants are hidden from other packages',
        'So nobody can write `new TestConstants()`, because the class only holds static values and an object would be meaningless',
        'Because static final fields require a private constructor to compile',
        'To make the class thread-safe',
      ],
      answer: 1,
      why: 'All members are static, so an instance has no purpose. A private constructor blocks `new TestConstants()` and documents the intent. Marking the class `final` also stops someone extending it. The same pattern is used for utility classes like `PriceUtils`.',
    },
    {
      q: 'Which value belongs in `TestConstants` rather than in `config.properties`?',
      options: [
        'The base URL, which differs for local, QA and staging',
        'The browser name, which CI overrides with -Dbrowser=firefox',
        'The id of the sort dropdown, `product-sort`, which is the same in every environment',
        'The test user password',
      ],
      answer: 2,
      why: 'A constant never changes between runs or environments, like an element id or a default timeout. Anything that changes per environment or per CI job (URLs, browser, credentials) goes in config so it can change without recompiling, and secrets never go in source code at all.',
    },
  ],
  hints: [
    'final = this variable can be assigned only once.',
    'For an object, final locks which object the variable points to, not what is inside the object.',
  ],
  explanation: `\`public static final\` is how Java writes a constant: **static** (one copy for the class), **final** (assigned once). Convention: UPPER_SNAKE_CASE names.

* On a primitive or a String, \`final\` really makes the value constant, because \`int\` has no inner state and String is immutable.
* On a mutable object like \`ArrayList\` or a \`HashMap\`, \`final\` only fixes the reference. Any test can still add, remove or clear items, and with static that change is visible to every test in the JVM.
* For constant collections use \`List.of\`, \`Set.of\` or \`Map.of\` (unmodifiable) together with \`final\`.
* A constants class gets a private constructor and is usually \`final\` itself.
* Keep environment-specific values in config, not constants.`,
  mistakes: [
    'Believing static final List<String> is read-only, then adding test data to it and polluting later tests.',
    'Putting the base URL or passwords in a constants class, which forces a recompile per environment and leaks secrets into Git.',
    'Using lowercase names for constants, so readers cannot tell them from normal variables.',
  ],
  interview: [
    { q: 'What is the difference between final, finally and finalize?', a: 'final is a keyword: a final variable is assigned once, a final method cannot be overridden, a final class cannot be extended. finally is the block after try/catch that always runs (cleanup like driver.quit()). finalize() was an Object method called by the garbage collector and is deprecated.' },
    { q: 'Is a final object immutable?', a: 'No. final means the reference cannot be reassigned. The object can still change unless its class is designed to be immutable, like String, records with immutable fields, or collections created with List.of.' },
    { q: 'Can a final variable be assigned in the constructor?', a: 'Yes. A "blank final" instance field can be assigned once in every constructor, which is how page objects keep private final WebDriver driver.' },
  ],
}
