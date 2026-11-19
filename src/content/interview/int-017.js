export default {
  id: 'int-017',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: word frequency in reviews and the first non-repeating character',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'hashmap', 'linkedhashmap', 'optional', 'strings'],
  estMinutes: 15,
  scenario: `The ShopEasy team wants a quick quality check on product reviews before they go live, and the interviewer turns it into a coding task: *"Count how often each word appears in a review — 'Great backpack. Great price, great zip!' — then find the first character in a string that appears only once."* It is the most-asked HashMap question in tester interviews, and the follow-ups are always about **case, punctuation and "what if there is none?"**.`,
  description: `Implement two static methods in \`ReviewStats\`:

1. \`wordFrequency(String text)\` → \`Map<String, Integer>\`
   - \`"Great backpack. Great price, great zip!"\` → \`{great=3, backpack=1, price=1, zip=1}\`
   - case-insensitive, punctuation removed, words in **first-appearance order**
   - \`null\` / blank / only punctuation (\`"!!!"\`) → empty map
2. \`firstNonRepeatingChar(String text)\` → \`Optional<Character>\`
   - \`"shopeasy"\` → \`Optional[h]\`, \`"aabb"\` → \`Optional.empty\`, \`null\` → \`Optional.empty\`

**Rules / Acceptance**
- Use a \`LinkedHashMap\` (order matters for both methods).
- Lower-case the text and strip punctuation with \`replaceAll\` and a negated character class.
- Count with \`merge\` or \`getOrDefault\`.
- For the first non-repeating character: count first, then a second pass that returns the first entry with count 1.
- "None found" is \`Optional.empty()\`, not \`null\` and not a magic character.`,
  hints: [
    'text.toLowerCase().replaceAll("[^a-z0-9\\\\s]", "") keeps letters, digits and whitespace.',
    'counts.merge(word, 1, Integer::sum) — "put 1, or add 1 to what is there".',
    'Loop over counts.entrySet(); the first entry with getValue() == 1 is the answer, because LinkedHashMap keeps insertion order.',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class ReviewStats {

    public static Map<String, Integer> wordFrequency(String text) {
        Map<String, Integer> counts = new HashMap<>();
        for (String word : text.split(" ")) {
            counts.put(word, 1);
        }
        return counts;
    }

    public static Optional<Character> firstNonRepeatingChar(String text) {
        // TODO: "shopeasy" -> h
        return Optional.empty();
    }
}
`,
  solution: String.raw`import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public class ReviewStats {

    public static Map<String, Integer> wordFrequency(String text) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        if (text == null || text.isBlank()) {
            return counts;
        }
        String clean = text.toLowerCase().replaceAll("[^a-z0-9\\s]", "");
        for (String word : clean.trim().split("\\s+")) {
            if (!word.isEmpty()) {
                counts.merge(word, 1, Integer::sum);
            }
        }
        return counts;
    }

    public static Optional<Character> firstNonRepeatingChar(String text) {
        if (text == null) {
            return Optional.empty();
        }
        Map<Character, Integer> counts = new LinkedHashMap<>();
        for (char c : text.toCharArray()) {
            counts.merge(c, 1, Integer::sum);
        }
        for (Map.Entry<Character, Integer> entry : counts.entrySet()) {
            if (entry.getValue() == 1) {
                return Optional.of(entry.getKey());
            }
        }
        return Optional.empty();
    }
}
`,
  checks: [
    { label: 'Keeps first-appearance order with a LinkedHashMap', pattern: 'new\\s+LinkedHashMap\\s*<', hint: 'Map<String, Integer> counts = new LinkedHashMap<>();' },
    { label: 'Makes the count case-insensitive', pattern: 'toLowerCase\\s*\\(', hint: '"Great" and "great" must be the same word' },
    { label: 'Strips punctuation with a negated character class', pattern: 'replaceAll\\s*\\(\\s*"\\[\\^', hint: 'replaceAll("[^a-z0-9\\\\s]", "") — "price," becomes "price"' },
    { label: 'Counts with merge or getOrDefault', pattern: '(\\.merge\\s*\\(|getOrDefault\\s*\\()', hint: 'counts.merge(word, 1, Integer::sum);' },
    { label: 'Second pass picks the first entry with count 1', pattern: '==\\s*1\\b', hint: 'if (entry.getValue() == 1) return Optional.of(entry.getKey());' },
    { label: 'Returns Optional.of(...) for a found character', pattern: 'Optional\\.of\\s*\\(', hint: 'Wrap the answer: Optional.of(entry.getKey())' },
  ],
  explanation: `**Why each piece matters**
- **LinkedHashMap** — \`HashMap\` would print \`{zip=1, great=3, ...}\` in an unpredictable order. For "first non-repeating" it is essential: the map must remember which character came first.
- **Normalise before counting** — \`toLowerCase()\` then \`replaceAll("[^a-z0-9\\\\s]", "")\` ("anything that is NOT a letter, digit or whitespace → delete"). Without it you get \`great.=1\`, \`Great=1\`, \`great=1\`.
- **Guard empty words** — \`"!!!"\` becomes \`""\`, and \`"".split(...)\` returns one empty string; the \`isEmpty()\` check keeps it out of the map.
- **Two passes** — counting needs the whole string first; you cannot know "appears only once" until you have seen every character. Total work is still O(n).
- **Optional** says "there may be no answer" in the method signature. Returning \`null\` invites a NullPointerException in the caller; returning \`'_'\` is a magic value somebody will misread.

**Talk while coding:** "I'll lower-case and strip punctuation first, count in a LinkedHashMap with merge, then a second loop over entrySet returns the first key with value 1."

**Stream version** (mention it, don't lead with it):
\`\`\`java
Arrays.stream(clean.split("\\\\s+"))
      .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()));
\`\`\``,
  mistakes: [
    'counts.put(word, 1) — overwrites instead of incrementing, so every word ends with 1.',
    'Using HashMap and then searching for the "first" non-repeating character — the order is lost.',
    'Forgetting punctuation and case, so "Great" and "great," are counted separately.',
    'Returning null or a special character when nothing is unique.',
  ],
  interview: [
    { q: 'Why LinkedHashMap and not HashMap or TreeMap?', a: 'HashMap gives no ordering guarantee and TreeMap sorts by key alphabetically. I need the order in which words or characters first appeared — for the expected output and, for the first non-repeating character, for correctness — and only LinkedHashMap keeps insertion order.' },
    { q: 'How would you return the three most frequent words?', a: 'Take the entrySet into a list, sort it by value descending with a comparator (ties by key for stable output), and take the first three with subList or stream().limit(3). For huge texts a PriorityQueue of size three avoids sorting everything.' },
    { q: 'Why Optional instead of returning null?', a: 'Optional makes "no result" part of the method contract, so the caller is forced to handle it with isPresent, orElse or orElseThrow. A null return compiles silently and fails later with a NullPointerException far from the cause.' },
  ],
}
