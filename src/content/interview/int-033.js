export default {
  id: 'int-033',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: find the missing invoice number in 1..n and swap without a temp variable',
  level: 'ADVANCED',
  tags: ['java', 'live-coding', 'arrays', 'math', 'xor', 'pass-by-value'],
  estMinutes: 20,
  scenario: `Finance requires ShopEasy invoice numbers to be continuous: an audit export should contain every number from 1 to n exactly once. An export of \`[1, 2, 4, 5, 6]\` for n = 6 means invoice 3 went missing. The interviewer asks you to find the gap in O(n) without sorting — then throws a classic: *"Now swap two numbers without a temp variable."* Both look like puzzles; the follow-ups (integer overflow, Java pass-by-value) are where senior candidates stand out.`,
  description: `Implement two methods in \`InvoiceAudit\`:

1. \`findMissing(int[] ids, int n)\` — \`ids\` contains every number from 1 to n except one, in any order. Return the missing number. \`findMissing(new int[]{1, 2, 4, 5, 6}, 6)\` → \`3\`.
2. \`swap(int[] pair)\` — swap \`pair[0]\` and \`pair[1]\` **in place, without a temporary variable**. \`{29, 9}\` becomes \`{9, 29}\`.

**Rules / Acceptance**
- No sorting and no nested loops — one pass.
- Must not overflow for large n: use a \`long\` sum or XOR.
- The swap may use XOR (\`^=\`) or arithmetic (\`+\` / \`-\`), but no \`temp\` / \`tmp\` variable.
- \`swap\` takes an array because Java passes primitives **by value** — swapping two \`int\` parameters would not change the caller's values.`,
  hints: [
    'Expected sum of 1..n is n * (n + 1) / 2. Compute it as long: (long) n * (n + 1) / 2, then subtract each id.',
    'XOR version: x ^ x == 0 and x ^ 0 == x. XOR all numbers 1..n and all ids — everything cancels except the missing one.',
    'Swap: pair[0] ^= pair[1]; pair[1] ^= pair[0]; pair[0] ^= pair[1];',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.Arrays;

public class InvoiceAudit {

    public static int findMissing(int[] ids, int n) {
        // TODO: find the missing number in one pass
        return -1;
    }

    public static void swap(int[] pair) {
        int temp = pair[0];
        pair[0] = pair[1];
        pair[1] = temp;
        // TODO: rewrite without a temp variable
    }

    public static void main(String[] args) {
        System.out.println(findMissing(new int[] {1, 2, 4, 5, 6}, 6)); // 3
        int[] prices = {29, 9};
        swap(prices);
        System.out.println(Arrays.toString(prices)); // [9, 29]
    }
}
`,
  solution: String.raw`import java.util.Arrays;

public class InvoiceAudit {

    public static int findMissing(int[] ids, int n) {
        long expected = (long) n * (n + 1) / 2;   // long: no overflow for large n
        long actual = 0;
        for (int id : ids) {
            actual += id;
        }
        return (int) (expected - actual);
    }

    // Alternative with XOR - never overflows at all
    public static int findMissingXor(int[] ids, int n) {
        int xor = 0;
        for (int i = 1; i <= n; i++) {
            xor ^= i;
        }
        for (int id : ids) {
            xor ^= id;
        }
        return xor;
    }

    public static void swap(int[] pair) {
        if (pair == null || pair.length < 2) {
            throw new IllegalArgumentException("Need an array of two numbers");
        }
        pair[0] ^= pair[1];
        pair[1] ^= pair[0];
        pair[0] ^= pair[1];
    }

    public static void main(String[] args) {
        System.out.println(findMissing(new int[] {1, 2, 4, 5, 6}, 6));    // 3
        System.out.println(findMissingXor(new int[] {6, 1, 5, 2, 4}, 6)); // 3
        int[] prices = {29, 9};
        swap(prices);
        System.out.println(Arrays.toString(prices)); // [9, 29]
    }
}
`,
  checks: [
    { label: 'Uses the sum formula or XOR to find the gap', pattern: 'n\\s*\\*\\s*\\(\\s*n\\s*\\+\\s*1\\s*\\)|\\^=', hint: 'expected = (long) n * (n + 1) / 2, or XOR everything' },
    { label: 'Guards against overflow (long arithmetic or XOR)', pattern: '\\blong\\b|\\^=', hint: '(long) n * (n + 1) / 2 — an int overflows above n ≈ 65,535' },
    { label: 'No sorting', pattern: 'Arrays\\.sort|\\.sorted\\s*\\(|Collections\\.sort', mustNot: true, hint: 'Sorting is O(n log n); one pass is enough' },
    { label: 'Swaps with XOR or +/- on the array elements', pattern: 'pair\\[0\\]\\s*(\\^=|=\\s*pair\\[0\\]\\s*[+\\-^])|pair\\[0\\]\\s*\\+=', hint: 'pair[0] ^= pair[1]; pair[1] ^= pair[0]; pair[0] ^= pair[1];' },
    { label: 'No temp variable', pattern: '\\b(int|var|Integer)\\s+(temp|tmp|t)\\b', mustNot: true, hint: 'The interviewer explicitly forbade a temporary variable' },
    { label: 'No placeholder "return -1"', pattern: 'return\\s+-1\\s*;', mustNot: true, hint: 'Return the computed missing number' },
  ],
  explanation: `**Missing number — three approaches, in the order to mention them**
| Approach | Time | Extra space | Catch |
|---|---|---|---|
| Sort, then look for the gap | O(n log n) | O(1) | slower, changes the input |
| Boolean array / Set of seen ids | O(n) | O(n) | uses memory |
| Sum formula \`n(n+1)/2 - sum\` | O(n) | O(1) | **overflows** an int when n > 65,535 unless you use \`long\` |
| XOR of 1..n and all ids | O(n) | O(1) | never overflows; slightly harder to explain |

Saying *"n * (n + 1) overflows int above roughly 65 thousand, so I cast to long first"* is exactly the senior detail interviewers wait for. Note the cast must be **before** the multiplication: \`(long) (n * (n + 1))\` is too late — the overflow has already happened.

**Swap without temp**
- XOR: \`a ^= b; b ^= a; a ^= b;\` — no overflow. Pitfall: if both refer to the **same** memory (e.g. \`swap(arr, i, i)\`), the value becomes 0.
- Arithmetic: \`a = a + b; b = a - b; a = a - b;\` — can overflow in theory, though Java's wrap-around still gives the right answer for int.
- **Real code uses a temp variable** — it is clearer. Say so; it shows judgement.

**Pass-by-value:** \`static void swap(int a, int b)\` swaps local copies only; the caller sees nothing. That is why this method takes an array (the array reference is copied, but both copies point to the same array).

**In automation:** checking continuous order or invoice numbers from an API export, finding which page of a paginated list did not load, verifying row ids in a downloaded report.`,
  mistakes: [
    'Computing n * (n + 1) / 2 in int arithmetic — silent overflow for large invoice ranges.',
    'Casting after the multiplication: (long) (n * (n + 1)) still overflows.',
    'Writing swap(int a, int b) and expecting the caller\'s variables to change — Java is pass-by-value.',
    'Sorting the array first — correct but O(n log n), and it mutates the input.',
  ],
  interview: [
    { q: 'Is Java pass-by-value or pass-by-reference?', a: 'Always pass-by-value. For primitives the value is copied; for objects the reference is copied, so a method can change the object\'s contents (like array elements) but cannot make the caller\'s variable point to a different object.' },
    { q: 'What if two numbers were missing?', a: 'Use both the sum and the sum of squares to get two equations, or simply mark seen ids in a boolean array of size n + 1 and collect every index still false. In a test I would choose the boolean array — clearer, and it also reports duplicates.' },
    { q: 'Would you swap without a temp variable in production code?', a: 'No. The temp-variable version is clearer and just as fast on modern JVMs. The XOR trick is a puzzle answer; I mention its pitfalls — same-location swap gives zero — and use the readable version in real code.' },
  ],
}
