export default {
  id: 'int-012',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: reverse a string and count characters with a Map',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'strings', 'map', 'loops'],
  estMinutes: 15,
  scenario: `Round 2 of a QA automation interview is usually a **15-minute live-coding** exercise in a shared editor. The interviewer says: *"Without using StringBuilder.reverse(), reverse a string. Then count how many times each character appears in 'shopeasy'."* They're checking basic Java fluency — loops, \`charAt\`, \`Map\` — and how you talk while coding.`,
  description: `Implement two static methods in \`StringPractice\`:

1. \`reverse(String input)\` — return the reversed string **using a loop** (the interviewer forbids \`StringBuilder.reverse()\`). \`reverse("ShopEasy")\` → \`"ysaEpohS"\`.
2. \`countChars(String input)\` — return a \`Map<Character, Integer>\` with the count of each character **in the order they first appear**. \`countChars("shopeasy")\` → \`{s=2, h=1, o=1, p=1, e=1, a=1, y=1}\`.

**Rules / Acceptance**
- Handle \`null\` input gracefully (return \`""\` / an empty map) — interviewers love asking "what about null?".
- Use a \`LinkedHashMap\` so the order is predictable.
- Use \`getOrDefault\` or \`merge\` to update counts.
- Don't leave \`return null\`.`,
  hints: [
    'Loop from input.length() - 1 down to 0 and append input.charAt(i) to a StringBuilder (append is allowed, reverse() is not).',
    'for (char c : input.toCharArray()) counts.put(c, counts.getOrDefault(c, 0) + 1);',
    'LinkedHashMap keeps insertion order; HashMap does not.',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.Map;

public class StringPractice {

    public static String reverse(String input) {
        // TODO: reverse without StringBuilder.reverse()
        return null;
    }

    public static Map<Character, Integer> countChars(String input) {
        // TODO: count each character, keep first-appearance order
        return null;
    }

    public static void main(String[] args) {
        System.out.println(reverse("ShopEasy"));    // ysaEpohS
        System.out.println(countChars("shopeasy")); // {s=2, h=1, o=1, p=1, e=1, a=1, y=1}
    }
}
`,
  solution: String.raw`import java.util.LinkedHashMap;
import java.util.Map;

public class StringPractice {

    public static String reverse(String input) {
        if (input == null) {
            return "";
        }
        StringBuilder reversed = new StringBuilder();
        for (int i = input.length() - 1; i >= 0; i--) {
            reversed.append(input.charAt(i));
        }
        return reversed.toString();
    }

    public static Map<Character, Integer> countChars(String input) {
        Map<Character, Integer> counts = new LinkedHashMap<>();
        if (input == null) {
            return counts;
        }
        for (char c : input.toCharArray()) {
            counts.put(c, counts.getOrDefault(c, 0) + 1);
        }
        return counts;
    }

    public static void main(String[] args) {
        System.out.println(reverse("ShopEasy"));    // ysaEpohS
        System.out.println(countChars("shopeasy")); // {s=2, h=1, o=1, p=1, e=1, a=1, y=1}
    }
}
`,
  checks: [
    { label: 'Loops backwards over the string', pattern: 'for\\s*\\(\\s*int\\s+\\w+\\s*=\\s*\\w+\\.length\\(\\)\\s*-\\s*1', hint: 'for (int i = input.length() - 1; i >= 0; i--)' },
    { label: 'Does not use StringBuilder.reverse()', pattern: '\\.reverse\\s*\\(\\s*\\)', mustNot: true, hint: 'The interviewer asked for a manual loop' },
    { label: 'Uses a LinkedHashMap<Character, Integer>', pattern: 'new\\s+LinkedHashMap\\s*<', hint: 'Map<Character, Integer> counts = new LinkedHashMap<>();' },
    { label: 'Updates counts with getOrDefault / merge / containsKey', pattern: '(getOrDefault\\s*\\(|\\.merge\\s*\\(|containsKey\\s*\\()', hint: 'counts.put(c, counts.getOrDefault(c, 0) + 1)' },
    { label: 'Handles null input', pattern: '==\\s*null|Objects\\.isNull|null\\s*==', hint: 'if (input == null) return "";' },
    { label: 'No "return null" left', pattern: 'return\\s+null\\s*;', mustNot: true, hint: 'Return an empty string / empty map instead' },
  ],
  explanation: `**What the interviewer evaluates:**
1. Can you write a correct loop with indexes (\`length() - 1\` down to \`0\`) — off-by-one errors are the #1 slip.
2. Do you pick the right collection and explain why (\`LinkedHashMap\` for order).
3. Do you think about edge cases out loud: null, empty string, spaces, case sensitivity ("Should 'S' and 's' count as the same? I'll ask — or use \`Character.toLowerCase(c)\`").

**Talk while you code** — e.g. "I'll use a StringBuilder because String is immutable and concatenation in a loop creates many objects."

**Alternatives you can mention** (after writing the loop):
- \`new StringBuilder(input).reverse().toString()\` — the one-liner in real code.
- \`counts.merge(c, 1, Integer::sum)\` — a neat Java 8 way to count.
- Streams: \`input.chars().mapToObj(c -> (char) c).collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))\`.

**Where this shows up in automation:** counting occurrences of words in a page text, comparing expected vs actual label counts, validating that a generated ID has the right character mix.`,
  mistakes: [
    'Starting the loop at input.length() instead of length() - 1 (StringIndexOutOfBoundsException).',
    'Using String concatenation (result += c) inside a loop without mentioning the cost.',
    'Using HashMap and being surprised the order differs from the expected output.',
    'Not handling null or empty input.',
  ],
  interview: [
    { q: 'Why StringBuilder instead of String concatenation?', a: 'String is immutable, so each += creates a new object; in a loop that wastes memory and time. StringBuilder is mutable and appends in place. StringBuffer is the synchronized, older alternative.' },
    { q: 'How would you make the count case-insensitive and ignore spaces?', a: 'Convert each character with Character.toLowerCase and skip it when Character.isWhitespace(c) is true before updating the map.' },
    { q: 'How would you find the first non-repeated character?', a: 'Build the LinkedHashMap of counts as here, then iterate its entries and return the first key whose value is 1 — insertion order guarantees it is the first in the string.' },
  ],
}
