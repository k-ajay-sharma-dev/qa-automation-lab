export default {
  id: 'java-035',
  category: 'java',
  kind: 'quiz',
  title: 'Rounding the 8% tax: Math.round, integer division and String.format',
  level: 'BEGINNER',
  tags: ['math', 'rounding', 'integer-division', 'string-format', 'bigdecimal', 'interview', 'output-prediction'],
  estMinutes: 12,
  scenario: `ShopEasy's checkout overview shows \`Tax (8%): $2.40\` for one Trailblazer Backpack ($29.99). The page computes it as \`Math.round(subtotal * 0.08 * 100) / 100\`.
Your test calculates the expected tax in Java, and the first version asserted \`$2.00\` against \`$2.40\`, so the test failed even though the app was right.
The same Java line behaves differently from the JavaScript line, and a few other rounding habits can make a price test lie.`,
  description: `Predict each result. All snippets come from tests that calculate an **expected** price, tax or total and compare it with the text in \`#summary-tax\` / \`#summary-total\`.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
double subtotal = 29.99;
double tax = Math.round(subtotal * 0.08 * 100) / 100;
System.out.println(tax);
\`\`\``,
      options: ['2.4', '2.40', '2.0', '2.3992'],
      answer: 2,
      why: '`Math.round(double)` returns a **long** (240). `240 / 100` is long divided by int, which is **integer division** and drops the fraction: 2. Only then is it widened to `double`, giving 2.0. Write `/ 100.0` so the division happens in floating point: `Math.round(subtotal * 0.08 * 100) / 100.0` gives 2.4.',
    },
    {
      q: `\`#summary-tax\` shows \`$2.40\`. Which expression builds a matching expected string from \`double tax = 2.4\`?`,
      options: [
        '`"$" + tax`',
        '`String.format(Locale.US, "$%.2f", tax)`',
        '`"$" + Math.round(tax)`',
        '`"$" + (int) tax + ".40"`',
      ],
      answer: 1,
      why: '`"$" + tax` gives `$2.4` (no trailing zero). `Math.round` gives `$2`. The last one hard-codes cents. `%.2f` always prints two decimals and rounds half-up. Passing `Locale.US` matters: on a CI agent with a German locale, `String.format("%.2f", 2.4)` prints `2,40`.',
    },
    {
      q: `A promo takes $1.15 off. The test converts it to cents. What does this print?
\`\`\`java
double discount = 1.15;
int cents = (int) (discount * 100);
System.out.println(cents);
\`\`\``,
      options: ['115', '114', '116', 'Compile error'],
      answer: 1,
      why: '`1.15 * 100` in binary floating point is `114.99999999999999`. Casting with `(int)` does not round, it **truncates** (cuts off) toward zero, so you get 114 and are a cent short. Use `Math.round(discount * 100)` (gives 115), or better, parse the price text into `BigDecimal` and never go through `double`.',
    },
    {
      q: `The product page shows an average rating. Two reviews have 4 and 5 stars. What does this print?
\`\`\`java
int totalStars = 9;
int reviews = 2;
double average = totalStars / reviews;
System.out.println(average);
\`\`\``,
      options: ['4.5', '4.0', '5.0', '4'],
      answer: 1,
      why: 'Both operands are `int`, so `9 / 2` is integer division = 4. The result is converted to `double` **after** the division, so it prints `4.0`. Make one side a double first: `(double) totalStars / reviews` gives 4.5.',
    },
    {
      q: `The app rounds half **up** (JavaScript \`Math.round\`). The expected tax is 2.125 before rounding. Which assertion value matches the app?
\`\`\`java
BigDecimal raw = new BigDecimal("2.125");
BigDecimal a = raw.setScale(2, RoundingMode.HALF_UP);
BigDecimal b = raw.setScale(2, RoundingMode.HALF_EVEN);
\`\`\``,
      options: ['a = 2.13, b = 2.13, either works', 'a = 2.12, b = 2.13, use b', 'a = 2.13, b = 2.12, use a', 'a = 2.12, b = 2.12, either works'],
      answer: 2,
      why: '`HALF_UP` rounds a 5 away from zero: 2.13. `HALF_EVEN` ("banker\'s rounding") rounds a 5 to the even neighbour: 2.12. The test oracle must use the **same rule as the requirement**, here HALF_UP. If the spec does not say which rule, that is a question for the BA, not a guess.',
    },
  ],
  hints: [
    'int / int and long / int throw away the decimals before anything is converted to double.',
    'A cast to int truncates; Math.round rounds.',
  ],
  explanation: `Price assertions fail for reasons that have nothing to do with the app:

1. **Integer division**: if both sides of \`/\` are whole-number types (\`int\`, \`long\`), the result is a whole number. \`Math.round\` returns a \`long\`, so \`Math.round(x) / 100\` loses the cents. Use \`100.0\`.
2. **Casts truncate**: \`(int) 114.99999\` is 114. Use \`Math.round\`.
3. **Formatting**: \`String.valueOf(2.4)\` is \`"2.4"\`, the UI shows \`"2.40"\`. Use \`String.format(Locale.US, "%.2f", x)\`, or compare numbers instead of strings.
4. **Rounding mode**: match the business rule (HALF_UP for most shops). \`BigDecimal.setScale(2, RoundingMode.HALF_UP)\` makes it explicit.

The most robust pattern: parse the UI text into \`BigDecimal\`, compute the expected value in \`BigDecimal\` with an explicit rounding mode, and compare with \`compareTo\`.`,
  mistakes: [
    'Copying the app\'s JavaScript formula into Java and getting integer division.',
    'Converting money to cents with (int) instead of Math.round.',
    'Asserting "$" + doubleValue against UI text and failing on "2.4" vs "2.40".',
    'Using String.format without a Locale, so the suite fails only on a machine with a different region setting.',
  ],
  interview: [
    { q: 'What is integer division in Java?', a: 'When both operands are integer types, / returns a whole number and discards the remainder (9 / 2 is 4). Cast one operand to double, or use a double literal like 2.0, to get 4.5.' },
    { q: 'Difference between Math.round, Math.floor and a cast to int?', a: 'Math.round rounds to the nearest whole number (half up). Math.floor always rounds down toward negative infinity. A cast to int truncates toward zero, so (int) -2.7 is -2 and (int) 2.7 is 2.' },
    { q: 'How do you compare a calculated price with a price on the page?', a: 'Clean the text, parse it into BigDecimal, compute the expected value in BigDecimal with the same rounding mode as the requirement, and compare with compareTo == 0. Or compare doubles with a small tolerance using assertEquals(actual, expected, 0.001).' },
  ],
}
