export default {
  id: 'int-016',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: reverse the words in a sentence and check an anagram',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'strings', 'split', 'arrays', 'anagram'],
  estMinutes: 15,
  scenario: `Warm-up question in a live-coding round at a product company: *"Reverse the order of the words in a sentence — 'Add to cart' becomes 'cart to Add'. Then write isAnagram: 'Listen' and 'Silent' are anagrams."* The interviewer pastes a nasty input next: \`"  Thank   you for your order!  "\` — extra spaces at both ends and between words. Most candidates return a result with empty words in it. A tester should spot that input first.`,
  description: `Implement two static methods in \`WordPractice\`:

1. \`reverseWords(String sentence)\` — reverse the **order of the words**, not the letters.
   - \`"Add to cart"\` → \`"cart to Add"\`
   - \`"  Thank   you for your order!  "\` → \`"order! your for you Thank"\` (single spaces, nothing at the ends)
   - \`null\` or blank → \`""\`
2. \`isAnagram(String first, String second)\` — \`true\` when both contain the same letters the same number of times,
   ignoring case and spaces.
   - \`("Listen", "Silent")\` → \`true\`, \`("Dormitory", "Dirty room")\` → \`true\`, \`("Cart", "Carts")\` → \`false\`
   - either argument \`null\` → \`false\`

**Rules / Acceptance**
- Trim, then split on **one or more** whitespace characters (\`"\\\\s+"\`), so repeated spaces do not create empty words.
- Build the result by looping backwards over the words (or with \`Collections.reverse\`) — no \`return null\`.
- For the anagram, normalise case and remove spaces, then compare sorted character arrays (or count characters).`,
  hints: [
    'sentence.trim().split("\\\\s+") gives ["Thank", "you", "for", "your", "order!"] — no empty strings.',
    'Loop for (int i = words.length - 1; i >= 0; i--) and append a space only between words.',
    'char[] a = first.replaceAll("\\\\s", "").toLowerCase().toCharArray(); Arrays.sort(a); then Arrays.equals(a, b).',
  ],
  language: 'java',
  starterCode: String.raw`public class WordPractice {

    public static String reverseWords(String sentence) {
        // TODO: "Add to cart" -> "cart to Add"
        return null;
    }

    public static boolean isAnagram(String first, String second) {
        // TODO: "Listen" / "Silent" -> true
        return first.length() == second.length();
    }

    public static void main(String[] args) {
        System.out.println(reverseWords("  Thank   you for your order!  ")); // order! your for you Thank
        System.out.println(isAnagram("Dormitory", "Dirty room"));         // true
    }
}
`,
  solution: String.raw`import java.util.Arrays;

public class WordPractice {

    public static String reverseWords(String sentence) {
        if (sentence == null || sentence.isBlank()) {
            return "";
        }
        String[] words = sentence.trim().split("\\s+");
        StringBuilder result = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            result.append(words[i]);
            if (i > 0) {
                result.append(" ");
            }
        }
        return result.toString();
    }

    public static boolean isAnagram(String first, String second) {
        if (first == null || second == null) {
            return false;
        }
        char[] a = first.replaceAll("\\s", "").toLowerCase().toCharArray();
        char[] b = second.replaceAll("\\s", "").toLowerCase().toCharArray();
        if (a.length != b.length) {
            return false;
        }
        Arrays.sort(a);
        Arrays.sort(b);
        return Arrays.equals(a, b);
    }

    public static void main(String[] args) {
        System.out.println(reverseWords("  Thank   you for your order!  ")); // order! your for you Thank
        System.out.println(isAnagram("Dormitory", "Dirty room"));         // true
    }
}
`,
  checks: [
    { label: 'Trims before splitting into words', pattern: '\\.(trim|strip)\\s*\\(\\s*\\)\\s*\\.split\\s*\\(', hint: 'sentence.trim().split("\\\\s+") — otherwise leading spaces create an empty first word' },
    { label: 'Splits on one or more whitespace characters', pattern: 'split\\s*\\(\\s*"(\\\\\\\\s\\+|\\s\\+|\\[\\s\\]\\+)"', hint: 'split("\\\\s+") — a single " " leaves empty words between double spaces' },
    { label: 'Reverses the word order with a backwards loop or Collections.reverse', pattern: '(for\\s*\\(\\s*int\\s+\\w+\\s*=\\s*\\w+\\.length\\s*-\\s*1|Collections\\.reverse\\s*\\()', hint: 'for (int i = words.length - 1; i >= 0; i--)' },
    { label: 'Ignores case for the anagram', pattern: 'to(Lower|Upper)Case\\s*\\(', hint: '"Listen" and "Silent" differ in case — normalise with toLowerCase()' },
    { label: 'Compares sorted characters or character counts', pattern: '(Arrays\\.sort\\s*\\(|getOrDefault\\s*\\(|\\.merge\\s*\\(|\\[\\s*26\\s*\\])', hint: 'Arrays.sort(a); Arrays.sort(b); return Arrays.equals(a, b);' },
    { label: 'No "return null" left', pattern: 'return\\s+null\\s*;', mustNot: true, hint: 'Return "" for null or blank input' },
  ],
  explanation: `**What the interviewer is really testing:**
1. **Clarifying questions** — "Reverse the words or the letters? What about extra spaces and punctuation?" Asking them is half the score.
2. **The whitespace trap.** \`"  a  b".split(" ")\` returns \`["", "", "a", "", "b"]\`. \`trim()\` removes the ends, and the regex \`\\\\s+\` ("one or more whitespace characters") treats any run of spaces as one separator.
3. **Clean joining.** Appending \`" "\` only when \`i > 0\` avoids a trailing space. \`String.join(" ", list)\` after \`Collections.reverse(list)\` is the one-liner alternative:

\`\`\`java
List<String> words = new ArrayList<>(Arrays.asList(sentence.trim().split("\\\\s+")));
Collections.reverse(words);
return String.join(" ", words);
\`\`\`

**Anagram — two valid approaches:**
- **Sort and compare** (shown): simple to explain, O(n log n).
- **Count characters** with a \`Map<Character, Integer>\` (or an \`int[26]\` for a–z): add for the first word, subtract for the second, all counts must end at 0 — O(n). Mention it as the follow-up improvement.

**Test it out loud like a tester:** normal sentence, one word (\`"Checkout"\` → \`"Checkout"\`), only spaces, \`null\`, punctuation kept with its word (\`"order!"\`). For anagrams: different lengths, same letters different counts (\`"aab"\` vs \`"abb"\`).`,
  mistakes: [
    'Reversing the whole string ("trac ot ddA") instead of the word order — clarify first.',
    'Splitting on a single space, which creates empty words for double spaces.',
    'Leaving a trailing space at the end of the result.',
    'Anagram check that only compares lengths or uses contains() — "aab" vs "abb" would pass.',
  ],
  interview: [
    { q: 'Why split on "\\\\s+" instead of " "?', a: 'split takes a regular expression. "\\\\s+" means one or more whitespace characters — spaces, tabs, line breaks — so several spaces in a row count as one separator and no empty strings end up in the array. With " " every extra space produces an empty word.' },
    { q: 'What is the complexity of your anagram check, and can you improve it?', a: 'Sorting both arrays is O(n log n). Counting characters in a map or an int[26] array — increment for the first word, decrement for the second, then check every count is zero — is O(n) and stops early on the first mismatch.' },
    { q: 'Where would reversing or splitting words matter in test automation?', a: 'Parsing UI text: splitting "Hi, standard_user" or a full name into parts, normalising labels with irregular whitespace before comparing, or turning a breadcrumb "Home > Cart > Checkout" into a list to assert the navigation path.' },
  ],
}
