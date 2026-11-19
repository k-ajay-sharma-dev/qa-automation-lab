export default {
  id: 'java-001',
  category: 'java',
  kind: 'code',
  title: 'Clean up UI text before you assert on it',
  level: 'BEGINNER',
  tags: ['strings', 'assertions', 'parsing'],
  estMinutes: 15,
  scenario: `Sprint 3 on the e-commerce project. Your first automated check, "header greets the user", failed on CI even though the page looked perfect. The log said
\`expected [Welcome back, Priya!] but found [  Welcome back, Priya!  ]\`. Selenium's \`getText()\` returns exactly what the DOM gives you — spaces, odd casing, currency symbols and all.
Before you can assert anything in automation, you have to turn raw UI text into something comparable.`,
  description: `You have three raw strings exactly as \`getText()\` returned them. Complete \`main\` so it performs four checks and prints \`PASS\`/\`FAIL\` for each.

1. The header, **with surrounding spaces removed**, equals \`Welcome back, Priya!\`.
2. The status equals \`Order Confirmed\` **ignoring case** (the UI shows it in CSS uppercase).
3. The header **contains** the user's first name \`Priya\`.
4. The price text \`$29.99\` is converted to a \`double\` and equals \`29.99\`.

**Rules**
* Compare strings with \`.equals(...)\` / \`.equalsIgnoreCase(...)\` — never \`==\`.
* Remove the \`$\` before parsing (\`replace\` or \`substring\`) and parse with \`Double.parseDouble\` (or \`BigDecimal\`).
* Use \`trim()\` (or \`strip()\`) for the header.`,
  hints: [
    'String methods return a NEW string — store the result: String clean = header.trim();',
    'Double.parseDouble("29.99") works, Double.parseDouble("$29.99") throws NumberFormatException.',
    'priceText.replace("$", "") removes the currency symbol; then parse.',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

public class ProductTextAssertions {

    public static void main(String[] args) {
        // Raw texts exactly as Selenium's getText() returned them
        String header = "  Welcome back, Priya!  ";
        String status = "ORDER CONFIRMED";
        String priceText = "$29.99";

        // TODO 1: remove surrounding spaces from header and compare with "Welcome back, Priya!"
        // TODO 2: compare status with "Order Confirmed" ignoring case
        // TODO 3: check that header contains "Priya"
        // TODO 4: convert priceText to a double and check it is 29.99
        // TODO 5: print PASS or FAIL for each check
    }
}
`,
  solution: `package com.shop.tests;

public class ProductTextAssertions {

    public static void main(String[] args) {
        String header = "  Welcome back, Priya!  ";
        String status = "ORDER CONFIRMED";
        String priceText = "$29.99";

        // 1. trim() returns a new String without leading/trailing whitespace
        String cleanHeader = header.trim();
        boolean headerOk = cleanHeader.equals("Welcome back, Priya!");

        // 2. the UI uppercases with CSS, the DOM text may differ in case
        boolean statusOk = status.equalsIgnoreCase("Order Confirmed");

        // 3. partial match - useful when the text also contains dynamic parts
        boolean nameOk = cleanHeader.contains("Priya");

        // 4. strip the currency symbol (and thousands separators) before parsing
        double price = Double.parseDouble(priceText.replace("$", "").replace(",", "").trim());
        boolean priceOk = Math.abs(price - 29.99) < 0.001;

        System.out.println("Header text  : " + (headerOk ? "PASS" : "FAIL"));
        System.out.println("Status text  : " + (statusOk ? "PASS" : "FAIL"));
        System.out.println("Name present : " + (nameOk ? "PASS" : "FAIL"));
        System.out.println("Price value  : " + (priceOk ? "PASS" : "FAIL") + " (" + price + ")");
    }
}
`,
  checks: [
    { label: 'Removes surrounding whitespace', pattern: '\\.(trim|strip)\\s*\\(\\s*\\)', hint: 'Call header.trim() and use the result.' },
    { label: 'Compares text with .equals()', pattern: '\\.equals\\s*\\(', hint: 'cleanHeader.equals("Welcome back, Priya!")' },
    { label: 'Does not compare Strings with ==', pattern: '(==\\s*"|"\\s*==|\\b(header|status|priceText|cleanHeader)\\s*==)', mustNot: true, hint: '== compares object references, not text.' },
    { label: 'Case-insensitive check for status', pattern: '\\.equalsIgnoreCase\\s*\\(', hint: 'status.equalsIgnoreCase("Order Confirmed")' },
    { label: 'Partial match with contains()', pattern: '\\.contains\\s*\\(', hint: 'header.contains("Priya")' },
    { label: 'Removes the $ before parsing', pattern: '(\\.replace(All)?\\s*\\(|\\.substring\\s*\\()', hint: 'priceText.replace("$", "")' },
    { label: 'Parses the price into a number', pattern: '(Double\\.parseDouble|Double\\.valueOf|new\\s+BigDecimal)\\s*\\(', hint: 'Double.parseDouble(...) or new BigDecimal(...)' },
  ],
  explanation: `Every UI assertion in automation is really two steps: **normalize** the raw text, then **compare** it.

* \`trim()\` / \`strip()\` remove leading/trailing whitespace. Strings are *immutable*, so \`header.trim();\` on its own does nothing — you must use the returned value.
* \`equals\` compares the characters; \`==\` compares whether two variables point to the *same object*. Text from \`getText()\` is always a new object, so \`==\` will randomly fail.
* \`equalsIgnoreCase\` is right when CSS \`text-transform\` changes how text looks; \`contains\` is right when the text has a dynamic part ("Welcome back, Priya! You have 3 new messages").
* To assert on a price, strip \`$\` and \`,\` and parse. For money, comparing doubles with a small tolerance (or using \`BigDecimal\`) avoids floating-point surprises like \`0.1 + 0.2 != 0.3\`.

A reviewer looks for: no \`==\` on Strings, normalization in one place, and assertions that would give a readable failure message.`,
  mistakes: [
    'Calling header.trim(); without assigning the result — the original String is unchanged.',
    'Comparing Strings with == because it "worked locally" for literals (string pool), then failing on getText() values.',
    'Parsing "$1,299.00" directly — NumberFormatException because of the $ and the comma.',
    'Using contains() everywhere — "Order Confirmed" contains "Order", so a broken "Order Failed" page still passes a lazy check.',
  ],
  interview: [
    { q: 'What is the difference between == and equals() for Strings?', a: '== checks whether two references point to the same object in memory. equals() compares the character content. In tests, always use equals() (or assertEquals, which calls equals()), because text read from the browser is a new String object every time.' },
    { q: 'Why does trim() not change the original string?', a: 'Strings in Java are immutable. Every String method returns a new String; the original is never modified, so you must assign the result to a variable.' },
    { q: 'How would you safely compare prices in a test?', a: 'Remove currency symbols and separators, parse with BigDecimal (exact decimal) or compare doubles with a tolerance. BigDecimal is preferred for money because doubles cannot represent values like 0.1 exactly.' },
  ],
}
