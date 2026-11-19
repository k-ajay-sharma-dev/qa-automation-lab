export default {
  id: 'java-020',
  category: 'java',
  kind: 'quiz',
  title: 'Integer, Double and autoboxing: the number traps in test code',
  level: 'BEGINNER',
  tags: ['wrapper-classes', 'autoboxing', 'parsing', 'interview', 'output-prediction'],
  estMinutes: 12,
  scenario: `The cart-badge check \`if (expectedCount == actualCount)\` passed for months, then failed on a load test with 200 items in the cart. Both values were \`Integer\`, and nothing had changed in the app.
Around the same time a stock lookup threw \`NullPointerException\` on a line that had no method call on it. Both bugs come from Java's **wrapper classes** (\`Integer\`, \`Double\`) and **autoboxing**, the automatic conversion between \`int\` and \`Integer\`.
Interviewers like these questions because the code looks correct.`,
  description: `Predict each result **before** looking at the options. Each snippet is a real pattern from test code that reads numbers from the page or from test data.`,
  questions: [
    {
      q: `The cart badge count is compared as \`Integer\` objects. What does this print?
\`\`\`java
Integer expected = 127;
Integer actual = 127;
System.out.println(expected == actual);

Integer expectedBig = 200;
Integer actualBig = 200;
System.out.println(expectedBig == actualBig);
\`\`\``,
      options: ['true / true', 'false / false', 'true / false', 'false / true'],
      answer: 2,
      why: 'Java keeps ready-made `Integer` objects for -128 to 127 (the **Integer cache**), so both 127s are the same object and `==` is true. 200 is outside the cache, so autoboxing creates two separate objects and `==`, which compares references, is **false**. Compare wrapper objects with `equals`, or unbox to `int`. TestNG `assertEquals` uses `equals`.',
    },
    {
      q: `\`stock\` has no entry for \`"retro-red-tee"\`. What happens?
\`\`\`java
Map<String, Integer> stock = new HashMap<>();
stock.put("pulse-bike-light", 12);

int qty = stock.get("retro-red-tee");
System.out.println(qty);
\`\`\``,
      options: ['Prints 0', 'Prints null', 'Throws NullPointerException', 'Compile error'],
      answer: 2,
      why: '`get` returns `null` (an `Integer` reference) for a missing key. Assigning it to an `int` **unboxes** it, which means Java secretly calls `null.intValue()` and throws **NullPointerException** on a line with no visible method call. Use `stock.getOrDefault("retro-red-tee", 0)`, or keep the value as `Integer` and check it for null.',
    },
    {
      q: `The quantity field's text has spaces around it. What happens?
\`\`\`java
String qtyText = " 3 ";
int qty = Integer.parseInt(qtyText);
\`\`\``,
      options: ['qty is 3', 'qty is 0', 'Throws NumberFormatException', 'Compile error'],
      answer: 2,
      why: '`Integer.parseInt` accepts only an optional sign and digits, and **does not trim**, so the spaces cause a **NumberFormatException**. (`Double.parseDouble` happens to ignore surrounding whitespace, which is easy to mix up.) Always normalize first: `Integer.parseInt(qtyText.trim())`.',
    },
    {
      q: `A test removes one quantity from a list. What does this print?
\`\`\`java
List<Integer> quantities = new ArrayList<>(List.of(5, 10, 15));
quantities.remove(1);
System.out.println(quantities);
\`\`\``,
      options: ['[5, 10, 15]', '[10, 15]', '[5, 15]', '[5, 10]'],
      answer: 2,
      why: '`List` has two `remove` methods: `remove(int index)` and `remove(Object o)`. A plain `1` is an `int`, so Java picks **remove by index** and deletes position 1 (the 10). To remove the *value* 1 you need `quantities.remove(Integer.valueOf(1))`.',
    },
    {
      q: `Two promo credits are added up. What does this print?
\`\`\`java
double credit = 0.1 + 0.2;
System.out.println(credit == 0.3);
System.out.println(new BigDecimal("0.1").add(new BigDecimal("0.2"))
        .compareTo(new BigDecimal("0.3")) == 0);
\`\`\``,
      options: ['true / true', 'false / true', 'true / false', 'false / false'],
      answer: 1,
      why: '`double` stores numbers in binary and can\'t hold 0.1 or 0.2 exactly. The sum is 0.30000000000000004, so `==` is **false**. `BigDecimal` built from **Strings** stores exact decimal values, so the comparison is **true**. For money in tests, use BigDecimal or compare doubles within a small tolerance (`Math.abs(a - b) < 0.001`).',
    },
    {
      q: 'Which line is the safest way to turn the badge text into an `int` when the badge might be missing (`badgeText` is `null`) or blank?',
      options: [
        '`int count = Integer.parseInt(badgeText);`',
        '`int count = (badgeText == null || badgeText.isBlank()) ? 0 : Integer.parseInt(badgeText.trim());`',
        '`int count = Integer.valueOf(badgeText);`',
        '`int count = (int) badgeText;`',
      ],
      answer: 1,
      why: 'Options A and C throw on null or blank input (`valueOf` calls `parseInt` internally), and D does not compile because a String can\'t be cast to an int. B handles "no badge" as 0, the way ShopEasy removes `.shopping-cart-badge` when the cart is empty, and trims before parsing.',
    },
  ],
  hints: [
    'Integer is an object, int is a plain value. == on objects compares references.',
    'Unboxing null throws NullPointerException; parseInt does not trim.',
  ],
  explanation: `Every primitive type has a **wrapper class**: \`int\`/\`Integer\`, \`double\`/\`Double\`, \`boolean\`/\`Boolean\`, \`long\`/\`Long\`. Collections and generics can only hold objects, so \`List<Integer>\` and \`Map<String, Integer>\` use wrappers. Java converts between the two automatically: **autoboxing** (\`int\` → \`Integer\`) and **unboxing** (\`Integer\` → \`int\`).

The traps:
1. **\`==\` on wrappers** compares references. It "works" for -128..127 because of the Integer cache, then fails for bigger values. Use \`equals\` or compare \`int\`s.
2. **Unboxing \`null\`** throws NullPointerException. Map lookups and JSON fields are the usual source.
3. **Parsing**: \`Integer.parseInt\` is strict (no spaces, no \`$\`, no decimals). Trim and clean the text first, and expect \`NumberFormatException\` for bad input.
4. **Overloads**: \`list.remove(1)\` removes by index, not by value.
5. **Floating point**: \`double\` can't hold most decimals exactly. Use BigDecimal (from Strings) or a tolerance for money.`,
  mistakes: [
    'Comparing Integer counts from two sources with == because it passed with small numbers.',
    'Assigning map.get(...) directly to an int when the key may be missing.',
    'Parsing text straight from getText() without trim() and without removing $ or commas.',
    'Creating BigDecimal from a double (new BigDecimal(0.1)), which carries the binary error along. Use new BigDecimal("0.1") or BigDecimal.valueOf(0.1).',
  ],
  interview: [
    { q: 'What is autoboxing?', a: 'The automatic conversion the compiler does between a primitive and its wrapper: int to Integer when you put a value into a List<Integer>, and Integer to int (unboxing) when you assign it back. Unboxing a null reference throws NullPointerException.' },
    { q: 'What is the Integer cache?', a: 'Integer.valueOf, which autoboxing uses, returns shared Integer objects for values from -128 to 127. That makes == between two boxed small numbers true, and false for larger ones. It is the reason you never compare wrapper objects with ==.' },
    { q: 'parseInt vs valueOf?', a: 'Integer.parseInt(String) returns a primitive int. Integer.valueOf(String) returns an Integer object, which may come from the cache. Both throw NumberFormatException for text that is not a valid number.' },
  ],
}
