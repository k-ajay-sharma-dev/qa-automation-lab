export default {
  id: 'int-028',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: count vowels and consonants in a product name',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'strings', 'characters', 'loops'],
  estMinutes: 10,
  scenario: `The interviewer shares an editor and says: *"Warm-up. Our ShopEasy catalogue has names like 'Trailblazer Backpack' and 'Classic Crew T-Shirt'. Write a method that counts the vowels and the consonants in a name."* It looks trivial — the real test is whether you notice that spaces, hyphens and digits are **neither** vowels nor consonants, and whether 'A' counts the same as 'a'.`,
  description: `Implement \`countLetters(String text)\` in \`LetterCounter\`. Return an \`int[]\` where index 0 is the number of vowels and index 1 the number of consonants.

- \`countLetters("Trailblazer Backpack")\` → \`[6, 13]\`
- \`countLetters("Classic Crew T-Shirt")\` → \`[4, 13]\` (the space and hyphen are ignored)

**Rules / Acceptance**
- Case-insensitive: \`'A'\` is a vowel just like \`'a'\`.
- Only letters count — skip spaces, digits and punctuation with \`Character.isLetter\`.
- Vowels are a, e, i, o, u.
- \`null\` returns \`[0, 0]\`, never an exception.`,
  hints: [
    'Lower-case the whole string once, then loop over toCharArray().',
    'if (!Character.isLetter(c)) continue; — this one line removes spaces, hyphens and digits.',
    'A vowel test: "aeiou".indexOf(c) >= 0 (or a switch on c). Everything else that is a letter is a consonant.',
  ],
  language: 'java',
  starterCode: String.raw`public class LetterCounter {

    public static int[] countLetters(String text) {
        int vowels = 0;
        int consonants = 0;
        // TODO: loop over the characters and count
        return new int[] {vowels, consonants};
    }

    public static void main(String[] args) {
        int[] r = countLetters("Trailblazer Backpack");
        System.out.println("Vowels: " + r[0] + ", consonants: " + r[1]); // 6, 13
    }
}
`,
  solution: String.raw`public class LetterCounter {

    private static final String VOWELS = "aeiou";

    public static int[] countLetters(String text) {
        int vowels = 0;
        int consonants = 0;
        if (text == null) {
            return new int[] {0, 0};
        }
        for (char c : text.toLowerCase().toCharArray()) {
            if (!Character.isLetter(c)) {
                continue;            // spaces, hyphens, digits
            }
            if (VOWELS.indexOf(c) >= 0) {
                vowels++;
            } else {
                consonants++;
            }
        }
        return new int[] {vowels, consonants};
    }

    public static void main(String[] args) {
        int[] r = countLetters("Trailblazer Backpack");
        System.out.println("Vowels: " + r[0] + ", consonants: " + r[1]); // 6, 13
        int[] t = countLetters("Classic Crew T-Shirt");
        System.out.println("Vowels: " + t[0] + ", consonants: " + t[1]); // 4, 13
    }
}
`,
  checks: [
    { label: 'Normalises case (toLowerCase / toUpperCase)', pattern: '\\.to(Lower|Upper)Case\\s*\\(|Character\\.to(Lower|Upper)Case', hint: 'text.toLowerCase() so "A" and "a" are treated the same' },
    { label: 'Skips non-letters with Character.isLetter', pattern: 'Character\\.isLetter\\s*\\(|Character\\.isAlphabetic\\s*\\(', hint: 'if (!Character.isLetter(c)) continue;' },
    { label: 'Has a vowel test', pattern: '"aeiou"|"AEIOU"|case\\s+\'a\'|==\\s*\'a\'', hint: '"aeiou".indexOf(c) >= 0, or a switch with case \'a\', \'e\', ...' },
    { label: 'Increments both counters', pattern: '(vowels\\+\\+|\\+\\+vowels|vowels\\s*\\+=).*(consonants\\+\\+|\\+\\+consonants|consonants\\s*\\+=)', flags: 'ms', hint: 'vowels++ in one branch, consonants++ in the else branch' },
    { label: 'Handles null input', pattern: '==\\s*null|null\\s*==|Objects\\.isNull', hint: 'if (text == null) return new int[] {0, 0};' },
  ],
  explanation: `**What the interviewer is really checking**
1. **Edge cases before code.** Say out loud: "Is 'A' the same as 'a'? What about the space and the hyphen in 'T-Shirt'? Digits?" Asking first is worth more than fast typing.
2. **The else-branch trap.** \`if (vowel) vowels++; else consonants++;\` without the \`isLetter\` guard counts spaces and hyphens as consonants — "Classic Crew T-Shirt" would give 16 instead of 13.
3. **Clean returns.** Returning an \`int[]\` (or a small \`Map<String, Integer>\`) and explaining the choice shows you think about the caller.

**Alternatives to mention**
- Regex: \`text.replaceAll("(?i)[^aeiou]", "").length()\` for vowels — short, but harder to explain and slower.
- Streams: \`text.toLowerCase().chars().filter(Character::isLetter).filter(c -> "aeiou".indexOf(c) >= 0).count()\`.

**Where this shows up in automation:** validating generated usernames or coupon codes ("must contain at least two letters"), checking text rules on form inputs, cleaning page text before comparing.`,
  mistakes: [
    'Counting every non-vowel as a consonant, so spaces, hyphens and digits inflate the consonant count.',
    'Forgetting upper-case vowels — "Easy" then has one vowel instead of two.',
    'Calling toLowerCase() inside the loop on each character string instead of once on the input.',
    'Throwing NullPointerException on null instead of returning zeros.',
  ],
  interview: [
    { q: 'How would you treat "y" — vowel or consonant?', a: 'I would ask, because it is a business rule, not a coding rule. By default I keep a, e, i, o, u, and I make the vowel set a constant so changing it is one line.' },
    { q: 'What changes for non-English text such as "Café"?', a: 'Character.isLetter already accepts é, but "aeiou" does not contain it. I would normalise accents with java.text.Normalizer (NFD, then strip the combining marks) or extend the vowel set — and again confirm the rule with the product owner.' },
    { q: 'Why return int[] instead of printing the result?', a: 'A method that returns values is testable — I can assert on it in a unit test. Printing inside the method mixes logic and output, which is exactly what we avoid in framework utilities.' },
  ],
}
