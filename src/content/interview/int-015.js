export default {
  id: 'int-015',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: extract numbers from "$85,000" and "Showing 1–5 of 15"',
  level: 'ADVANCED',
  tags: ['java', 'live-coding', 'regex', 'Pattern', 'Matcher', 'BigDecimal'],
  estMinutes: 20,
  scenario: `Final live-coding round. The interviewer shares UI strings from ShopEasy: the checkout total **"Total: $32.39"**, a salary cell **"$85,000"** from the employee table, and the table's row-count label **"Showing 1–5 of 15 employees"**. *"Write utilities to turn these into numbers your assertions can use."* They're checking regex comfort, number types for money, and edge-case thinking.`,
  description: `Implement two methods in \`TextUtils\`:

1. \`parseMoney(String text)\` → \`BigDecimal\`
   - \`"Total: $32.39"\` → \`32.39\`, \`"$85,000"\` → \`85000\`, \`"$29.99"\` → \`29.99\`
   - Throw \`IllegalArgumentException\` with a clear message if the text contains no number.
2. \`extractAllNumbers(String text)\` → \`List<Integer>\`
   - \`"Showing 1–5 of 15 employees"\` → \`[1, 5, 15]\` (the label uses an en dash – \`\\d+\` doesn't care)
   - Use \`Pattern\` / \`Matcher\` with \`\\d+\` and a \`while (matcher.find())\` loop.

**Rules / Acceptance**
- Money must be \`BigDecimal\`, never \`double\`.
- Remove currency symbols, labels and thousands separators before parsing.
- Compile the \`Pattern\` once (a \`static final\` constant).`,
  hints: [
    'text.replaceAll("[^0-9.]", "") keeps only digits and the dot.',
    'private static final Pattern DIGITS = Pattern.compile("\\\\d+");',
    'Matcher m = DIGITS.matcher(text); while (m.find()) numbers.add(Integer.parseInt(m.group()));',
  ],
  language: 'java',
  starterCode: String.raw`import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class TextUtils {

    public static BigDecimal parseMoney(String text) {
        // "$85,000" or "Total: $32.39" -> crashes with NumberFormatException
        return new BigDecimal(text);
    }

    public static List<Integer> extractAllNumbers(String text) {
        List<Integer> numbers = new ArrayList<>();
        // TODO "Showing 1–5 of 15 employees" -> [1, 5, 15]
        return numbers;
    }
}
`,
  solution: String.raw`import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextUtils {

    private static final Pattern DIGITS = Pattern.compile("\\d+");

    /** "Total: $32.39" -> 32.39, "$85,000" -> 85000 */
    public static BigDecimal parseMoney(String text) {
        if (text == null) {
            throw new IllegalArgumentException("Cannot parse money from null");
        }
        String clean = text.replaceAll("[^0-9.]", "");
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("No amount found in '" + text + "'");
        }
        return new BigDecimal(clean);
    }

    /** "Showing 1–5 of 15 employees" -> [1, 5, 15] */
    public static List<Integer> extractAllNumbers(String text) {
        List<Integer> numbers = new ArrayList<>();
        if (text == null) {
            return numbers;
        }
        Matcher matcher = DIGITS.matcher(text);
        while (matcher.find()) {
            numbers.add(Integer.parseInt(matcher.group()));
        }
        return numbers;
    }
}
`,
  checks: [
    { label: 'Strips non-numeric characters before parsing money', pattern: 'replaceAll\\s*\\(\\s*"\\[\\^0-9\\.?\\]', hint: 'text.replaceAll("[^0-9.]", "")' },
    { label: 'Returns money as BigDecimal from cleaned text', pattern: 'new\\s+BigDecimal\\s*\\(\\s*(?!text\\s*\\))\\w+', hint: 'new BigDecimal(clean)' },
    { label: 'Compiles a digit Pattern once (static final)', pattern: 'static\\s+final\\s+Pattern\\s+\\w+\\s*=\\s*Pattern\\.compile\\s*\\(', hint: 'private static final Pattern DIGITS = Pattern.compile("\\\\d+");' },
    { label: 'Loops with matcher.find()', pattern: 'while\\s*\\(\\s*\\w+\\.find\\s*\\(\\s*\\)\\s*\\)', hint: 'while (matcher.find()) { ... }' },
    { label: 'Converts each match with group()', pattern: '\\.group\\s*\\(', hint: 'Integer.parseInt(matcher.group())' },
    { label: 'Fails clearly when no number is present', pattern: 'IllegalArgumentException', hint: 'throw new IllegalArgumentException("No amount found in ...")' },
  ],
  explanation: `**Why each piece matters:**
- \`replaceAll("[^0-9.]", "")\` — a *negated character class*: remove everything that is not a digit or a dot. Handles "$", ",", "Total:", spaces and non-breaking spaces in one go.
- \`BigDecimal\` from a String is exact; \`double\` would turn 0.1 + 0.2 into 0.30000000000000004 and break total/tax assertions.
- \`Pattern.compile\` is relatively expensive — compile once as a \`static final\` constant and reuse.
- \`while (matcher.find())\` walks every match; \`matcher.matches()\` would try to match the *whole* string and return false here.

**Edge cases to raise out loud** (this is where a 6-year tester shines):
- Negative amounts / discounts: "-$5.00" → keep the minus sign: \`[^0-9.-]\`.
- European formats: "1.299,00 €" — use \`NumberFormat.getCurrencyInstance(Locale.GERMANY)\` instead of regex.
- Multiple amounts in one string ("Was $39.99 Now $29.99") — the replaceAll approach would merge them; use a Pattern like \`\\$([\\d,]+\\.\\d{2})\` and \`find()\` instead.
- \`Integer\` overflow for very large numbers → \`Long\`/\`BigInteger\`.

**How it's used in tests:**
\`\`\`java
BigDecimal total = TextUtils.parseMoney(checkoutPage.getTotalText()); // "Total: $32.39"
List<Integer> paging = TextUtils.extractAllNumbers(employeeTablePage.getRowCountText()); // [1, 5, 15]
Assert.assertEquals(paging.get(2).intValue(), 15);
\`\`\``,
  mistakes: [
    'Calling new BigDecimal("$85,000") directly → NumberFormatException.',
    'Using matcher.matches() instead of find() for partial matches.',
    'Compiling the Pattern inside the method on every call.',
    'Using double for money and comparing with ==.',
  ],
  interview: [
    { q: 'Explain the regex [^0-9.].', a: 'Square brackets define a character class; the caret at the start negates it. So it matches any character that is not a digit or a dot, and replaceAll with an empty string removes them — leaving "32.39" from "Total: $32.39" and "85000" from "$85,000".' },
    { q: 'Difference between matcher.find() and matcher.matches()?', a: 'find() searches for the next subsequence that matches and can be called in a loop to get every match; matches() requires the entire input to match the pattern. For extracting numbers from a sentence we use find().' },
    { q: 'Where did you use such utilities in your project?', a: 'In a PriceUtils/TextUtils class used by checkout and cart steps to validate subtotal, tax and total, and to read pagination counts and order numbers from confirmation messages.' },
  ],
}
