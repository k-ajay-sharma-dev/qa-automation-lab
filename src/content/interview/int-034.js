export default {
  id: 'int-034',
  category: 'interview',
  kind: 'code',
  title: 'Live coding: cheapest and most expensive product in one pass, without sorting',
  level: 'BEGINNER',
  tags: ['java', 'live-coding', 'arrays', 'min-max', 'loops'],
  estMinutes: 10,
  scenario: `The interviewer pastes the ShopEasy catalogue prices — Trailblazer Backpack 29.99, Pulse Bike Light 9.99, Classic Crew T-Shirt 15.99, Storm Fleece Jacket 49.99, Junior Onesie 7.99, Retro Red Tee 15.99 — and says: *"Find the lowest and the highest price. You may not sort, and you may not use Collections.min/max."* They want to see one clean loop, sensible starting values and an empty-array guard.`,
  description: `Implement \`minMax(double[] prices)\` in \`PriceRange\`. Return a \`double[]\` where index 0 is the lowest price and index 1 the highest.

- \`minMax({29.99, 9.99, 15.99, 49.99, 7.99, 15.99})\` → \`[7.99, 49.99]\`
- \`minMax({15.99})\` → \`[15.99, 15.99]\`

**Rules / Acceptance**
- No \`Arrays.sort\`, no \`Collections.min/max\`, no streams — one loop.
- Start from the **first element**, not from 0 (a 0 start breaks the minimum).
- \`null\` or an empty array throws \`IllegalArgumentException\` with a clear message.`,
  hints: [
    'Set min = max = prices[0], then loop from index 1.',
    'Inside the loop: if (p < min) min = p; if (p > max) max = p; — two separate ifs, so both are checked on every element.',
    'Guard first: if (prices == null || prices.length == 0) throw new IllegalArgumentException(...).',
  ],
  language: 'java',
  starterCode: String.raw`import java.util.Arrays;

public class PriceRange {

    public static double[] minMax(double[] prices) {
        // TODO: find min and max without sorting
        Arrays.sort(prices);
        return new double[] {prices[0], prices[prices.length - 1]};
    }

    public static void main(String[] args) {
        double[] r = minMax(new double[] {29.99, 9.99, 15.99, 49.99, 7.99, 15.99});
        System.out.println("Min: " + r[0] + ", max: " + r[1]); // 7.99, 49.99
    }
}
`,
  solution: String.raw`public class PriceRange {

    public static double[] minMax(double[] prices) {
        if (prices == null || prices.length == 0) {
            throw new IllegalArgumentException("prices must contain at least one value");
        }
        double min = prices[0];
        double max = prices[0];
        for (int i = 1; i < prices.length; i++) {
            double p = prices[i];
            if (p < min) {
                min = p;
            }
            if (p > max) {
                max = p;
            }
        }
        return new double[] {min, max};
    }

    public static void main(String[] args) {
        double[] r = minMax(new double[] {29.99, 9.99, 15.99, 49.99, 7.99, 15.99});
        System.out.println("Min: " + r[0] + ", max: " + r[1]); // 7.99, 49.99
    }
}
`,
  checks: [
    { label: 'Does not sort or use Collections.min/max', pattern: 'Arrays\\.sort|Collections\\.(min|max|sort)|\\.sorted\\s*\\(', mustNot: true, hint: 'The rule is one pass with no sorting — compare each value instead' },
    { label: 'Starts min/max from the first element', pattern: '(min|max)\\w*\\s*=\\s*prices\\s*\\[\\s*0\\s*\\]', hint: 'double min = prices[0]; double max = prices[0];' },
    { label: 'Compares for a new minimum', pattern: '<\\s*min|min\\s*>', hint: 'if (p < min) min = p;' },
    { label: 'Compares for a new maximum', pattern: '>\\s*max|max\\s*<', hint: 'if (p > max) max = p;' },
    { label: 'Guards null / empty input', pattern: 'length\\s*==\\s*0|==\\s*null', hint: 'if (prices == null || prices.length == 0) throw new IllegalArgumentException(...)' },
  ],
  explanation: `**Why one pass beats sorting:** sorting is O(n log n) and **changes the caller's array** (\`Arrays.sort\` sorts in place — a nasty side effect if the test later compares that array with the page order). A single loop is O(n) and touches nothing.

**The classic bug:** \`double min = 0;\` — with all prices above zero, the minimum stays 0 forever. Starting from \`prices[0]\` (or \`Double.MAX_VALUE\` / \`-Double.MAX_VALUE\`) avoids it. Note that \`Double.MIN_VALUE\` is the smallest **positive** double, not the most negative — another trap worth naming.

**Say it out loud:** "Two separate ifs, because the first element might be both min and max; empty input is a programming error so I throw instead of returning a fake 0."

**In automation:** checking a "price filter" slider shows the right range, or asserting that the cheapest card on the page matches the lowest price from \`GET /api/products\`.`,
  mistakes: [
    'Initialising min to 0, so the minimum of positive prices is always 0.',
    'Using Double.MIN_VALUE as the starting max, thinking it is the most negative double.',
    'Sorting the input array in place and breaking a later order assertion.',
    'Using else-if for max, which skips the max check in the iteration where min changed — harmless here, but a sign of muddled thinking interviewers notice.',
  ],
  interview: [
    { q: 'How would you do it with streams?', a: 'DoubleSummaryStatistics stats = Arrays.stream(prices).summaryStatistics(); then stats.getMin() and stats.getMax() — one pass, plus average and count for free. In the interview I write the loop first, then mention this.' },
    { q: 'Should you use double for money?', a: 'For a comparison exercise it is fine, but for totals I use BigDecimal, because 0.1 + 0.2 is not exactly 0.3 in double. In UI tests I parse "$29.99" into BigDecimal before asserting sums.' },
    { q: 'What if you need the product name, not just the price?', a: 'Track the index (or the Product object) of the current min and max instead of only the value, and return those. With a List<Product> I would loop and keep a reference to the cheapest product.' },
  ],
}
