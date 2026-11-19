export default {
  slug: 'live-coding-rounds',
  category: 'interview',
  order: 6,
  title: 'Live-coding rounds: approach and common patterns',
  minutes: 10,
  summary: 'Handle a live-coding round calmly - clarify, plan, code, test edge cases - using the String, Map and regex patterns interviewers ask most.',
  manualAnalogy: `You would never start executing a test without reading the requirement, asking about unclear cases and
listing your test data. A coding round is judged the same way: interviewers watch your process - questions, plan,
edge cases - as much as the final code. Your testing brain is your biggest advantage here.`,
  body: `## The four-step approach

**1. Clarify (1-2 minutes).** Repeat the task in your own words and ask about edge cases - exactly what you do in
refinement meetings:

- What if the input is \`null\` or empty?
- Upper/lower case - is \`"S"\` the same as \`"s"\`? Spaces count?
- Does output order matter? Should duplicates appear once?
- Can I use built-ins like \`StringBuilder.reverse()\`, or should I write the loop?

**2. Plan out loud.** Two or three sentences or comments before coding: "I'll loop over the characters, count each in
a LinkedHashMap to keep first-seen order, then return the map." The interviewer can correct you *before* you spend
ten minutes.

**3. Code simply.** Clear names, a plain loop over clever one-liners. Working, readable code beats an elegant
solution you cannot finish. Narrate as you type.

**4. Test it like a tester.** Walk through a normal input by hand, then your edge cases: \`null\`, empty, one
character, all duplicates, special characters. Say what you would add next if you had time. This step is where QA
candidates shine - most developers skip it.

## Pattern 1: looping over a String

A \`String\` is a sequence of characters. \`charAt(i)\` gives the character at position \`i\` (starting at 0) and
\`length()\` the count. Looping **backwards** is just a different start and direction:

\`\`\`java
static boolean isPalindrome(String s) {
    if (s == null) return false;
    String clean = s.toLowerCase().replace(" ", "");
    for (int i = 0, j = clean.length() - 1; i < j; i++, j--) {
        if (clean.charAt(i) != clean.charAt(j)) return false;
    }
    return true;
}
\`\`\`

- The \`null\` check comes first - calling a method on \`null\` throws \`NullPointerException\`.
- Two indexes walk toward the middle; \`i < j\` stops when they meet.
- To *build* a new string in a loop, append to a \`StringBuilder\`, not \`+=\` on a String (which creates a new object
  every time).

## Pattern 2: counting with a Map

Counting "how many of each" is the most common pattern. Here, words in a product description:

\`\`\`java
static Map<String, Integer> wordCounts(String text) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    if (text == null || text.isBlank()) return counts;
    for (String word : text.toLowerCase().split("\\\\s+")) {
        counts.merge(word, 1, Integer::sum);
    }
    return counts;
}
\`\`\`

- \`LinkedHashMap\` keeps the order words first appeared - predictable output to compare against.
- \`split("\\\\s+")\` splits on one or more whitespace characters (in Java source you write \`\\\\s\` with two
  backslashes).
- \`merge(word, 1, Integer::sum)\` means: if absent put 1, else add 1. \`counts.put(w, counts.getOrDefault(w, 0) + 1)\`
  does the same and is easier to explain if \`merge\` feels new.
- Return an **empty** map for bad input, never \`null\` - callers can loop over an empty map safely.

The same shape counts characters, finds the first non-repeated character, or groups products by price.

## Pattern 3: Set for uniqueness

"Find duplicates", "remove duplicates", "first repeated item" - all use a \`Set\` whose \`add\` returns \`false\` for
something already seen (see the *Java collections for automation* lesson). One pass, no nested loops - mention the
improvement: nested loops compare every pair (slow for big lists), a set checks in roughly constant time.

## Pattern 4: numbers out of UI text

UI text is messy: \`"Item total: $49.99"\`, \`"Order SE-482913"\`, \`"Page 2 of 7"\`. Two tools:

**Clean then parse** - remove everything that is not part of the number, then convert:

\`\`\`java
BigDecimal tax = new BigDecimal(taxText.replaceAll("[^0-9.]", ""));   // "Tax: $2.40" -> 2.40
\`\`\`

\`[^0-9.]\` means "any character that is not a digit or a dot"; \`replaceAll\` deletes them. Use **\`BigDecimal\`** for
money - \`double\` cannot store values like 0.1 exactly, so totals like 32.39 may compare unequal.

**Find all matches** - when the text holds several numbers, use \`Pattern\` and \`Matcher\`:

\`\`\`java
private static final Pattern ORDER_NO = Pattern.compile("SE-(\\\\d+)");

Matcher m = ORDER_NO.matcher(confirmationText);
if (m.find()) {
    String digits = m.group(1);          // the part inside ( )
}
\`\`\`

- \`Pattern.compile\` once, in a \`static final\` constant - compiling is the expensive part.
- \`\\\\d+\` = one or more digits. Brackets \`( )\` capture a group you can read with \`group(1)\`.
- \`find()\` moves to the next match; call it in a \`while\` loop to collect **every** match.
- If nothing matches, fail loudly (\`IllegalArgumentException\` with the original text in the message) rather than
  returning a silent 0.

## Pattern 5: Selenium mini-tasks

Live rounds often mix Java with Selenium: select a dropdown option with the \`Select\` class, read a list of
elements, convert, sort a copy, assert. Use explicit waits, scope locators to the right container, and include the
actual values in your assertion message - it shows you think about the person reading the failure.

## If you get stuck

Say what you are thinking, write the method signature and a test call, solve a simpler version first (ignore case
sensitivity, say), and keep going. Silence is the only real failure in a coding round.`,
  keyPoints: [
    'Clarify -> plan aloud -> code simply -> test edge cases (null, empty, one item, duplicates).',
    'Check null first; return empty collections or strings, never null.',
    'Counting pattern: LinkedHashMap + merge or getOrDefault.',
    'Duplicates: a Set whose add() returns false - one pass instead of nested loops.',
    'Money is BigDecimal; regex via a static final Pattern, find() in a loop, group() to read captures.',
  ],
  mistakes: [
    'Starting to type immediately. Fix: spend a minute on questions and a plan.',
    'Using double for prices. Fix: BigDecimal built from the cleaned string.',
    'Writing "\\d" in Java source. Fix: escape the backslash - "\\\\d".',
    'Finishing without testing. Fix: trace a normal case and two edge cases out loud.',
  ],
  tryIt: `Without looking at any code, write a method that returns the first character that appears only once in a String
("shopeasy" -> 'h'). Time yourself to 10 minutes and say each step out loud.`,
  problems: ['int-012', 'int-013', 'int-014', 'int-015'],
}
