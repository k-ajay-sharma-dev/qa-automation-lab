export default {
  id: 'java-022',
  category: 'java',
  kind: 'code',
  title: 'Regular expressions: pull the order number, prices and emails out of page text',
  level: 'INTERMEDIATE',
  tags: ['regex', 'pattern', 'matcher', 'parsing'],
  estMinutes: 25,
  scenario: `After **Finish**, ShopEasy shows: \`Your order SE-482913 has been dispatched and will arrive just as fast as the pony can get there.\` The number is random on every run (\`SE-\` plus 6 digits), and the next test has to look that order up in the API.
The current code does \`text.substring(11, 20)\`. It broke when marketing changed "Your order" to "Your ShopEasy order".
Two more checks need the same skill: reading every \`$\` amount out of the Overview text, and checking that the e-mail addresses in the seed data are well-formed. That skill is **regular expressions**.`,
  description: `Implement \`ConfirmationParser\` with \`java.util.regex\`.

**Acceptance**
* Keep compiled patterns in \`private static final Pattern\` constants (compile once, reuse).
* \`String extractOrderNumber(String text)\`: find \`SE-\` followed by exactly 6 digits (\`SE-\\\\d{6}\`) with \`matcher(...).find()\`, and return the match (\`group()\`). If there's no match, throw \`IllegalStateException\` with the text in the message.
* \`List<Double> extractPrices(String text)\`: loop \`while (m.find())\` over a pattern with a **capture group** around the number after \`$\`, and parse \`m.group(1)\`. For the Overview text it returns \`[29.99, 9.99, 39.98, 3.2, 43.18]\`.
* \`boolean isValidEmail(String email)\`: use \`String.matches\` (the whole string must match). \`asha.rao@shopeasy.test\` → true, \`asha.rao@\` → false.
* No hard-coded \`substring(11, 20)\` positions.`,
  hints: [
    'private static final Pattern ORDER_NUMBER = Pattern.compile("SE-\\\\d{6}");  (in Java source the backslash is doubled)',
    'Matcher m = PRICE.matcher(text); while (m.find()) { prices.add(Double.parseDouble(m.group(1))); }',
    'Brackets ( ) create a capture group: "\\\\$(\\\\d+\\\\.\\\\d{2})" captures the number without the $.',
  ],
  language: 'java',
  starterCode: `package com.shop.support;

import java.util.ArrayList;
import java.util.List;

public class ConfirmationParser {

    public static String extractOrderNumber(String text) {
        // "Your order SE-482913 has been dispatched..."
        return text.substring(11, 20).trim();   // breaks when the wording changes
    }

    public static List<Double> extractPrices(String text) {
        List<Double> prices = new ArrayList<>();
        int dollar = text.indexOf("$");
        prices.add(Double.parseDouble(text.substring(dollar + 1, dollar + 6)));   // first price only
        return prices;
    }

    public static boolean isValidEmail(String email) {
        return email.contains("@");   // "asha.rao@" passes...
    }

    // TODO: rewrite all three with Pattern / Matcher / matches
}
`,
  solution: `package com.shop.support;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ConfirmationParser {

    // compiled once, reused by every call
    private static final Pattern ORDER_NUMBER = Pattern.compile("SE-\\\\d{6}");
    // $ is special in regex, so escape it; group 1 = the number only
    private static final Pattern PRICE = Pattern.compile("\\\\$(\\\\d{1,3}(?:,\\\\d{3})*\\\\.\\\\d{2})");
    private static final String EMAIL = "[\\\\w.+-]+@[\\\\w-]+(\\\\.[\\\\w-]+)+";

    public static String extractOrderNumber(String text) {
        Matcher m = ORDER_NUMBER.matcher(text);
        if (!m.find()) {
            throw new IllegalStateException("No order number (SE-######) in: " + text);
        }
        return m.group();   // the whole match, e.g. "SE-482913"
    }

    public static List<Double> extractPrices(String text) {
        List<Double> prices = new ArrayList<>();
        Matcher m = PRICE.matcher(text);
        while (m.find()) {                                   // every match, left to right
            prices.add(Double.parseDouble(m.group(1).replace(",", "")));
        }
        return prices;
    }

    public static boolean isValidEmail(String email) {
        return email != null && email.matches(EMAIL);        // matches() = the WHOLE string
    }

    public static void main(String[] args) {
        System.out.println(extractOrderNumber(
                "Your ShopEasy order SE-482913 has been dispatched and will arrive just as fast as the pony can get there."));
        System.out.println(extractPrices(
                "Trailblazer Backpack $29.99 Pulse Bike Light $9.99 Item total: $39.98 Tax (8%): $3.20 Total: $43.18"));
        System.out.println(isValidEmail("asha.rao@shopeasy.test") + " " + isValidEmail("asha.rao@"));
    }
}
`,
  checks: [
    { label: 'Compiles patterns once as constants', pattern: 'static\\s+final\\s+Pattern\\s+\\w+\\s*=\\s*Pattern\\.compile\\s*\\(', hint: 'private static final Pattern ORDER_NUMBER = Pattern.compile("SE-\\\\d{6}");' },
    { label: 'Creates a Matcher', pattern: '\\.matcher\\s*\\(', hint: 'Matcher m = ORDER_NUMBER.matcher(text);' },
    { label: 'Loops over every match with while (find())', pattern: 'while\\s*\\(\\s*\\w+\\.find\\s*\\(\\s*\\)\\s*\\)', hint: 'while (m.find()) { ... }' },
    { label: 'Reads a capture group', pattern: '\\.group\\s*\\(\\s*1\\s*\\)', hint: 'm.group(1) is the part inside the first ( )' },
    { label: 'Validates the whole e-mail with matches()', pattern: '\\.matches\\s*\\(', hint: 'email.matches(EMAIL)' },
    { label: 'Fails clearly when no order number is found', pattern: 'throw\\s+new\\s+IllegalStateException', hint: 'if (!m.find()) throw new IllegalStateException("No order number in: " + text);' },
    { label: 'No hard-coded substring positions', pattern: '\\.substring\\s*\\(\\s*\\d+\\s*,\\s*\\d+', mustNot: true, hint: 'Let the regex find the value wherever it is.' },
  ],
  explanation: `A **regular expression** describes the *shape* of text instead of its position. The test then finds the order number wherever the copywriters move it.

| Piece | Meaning |
|---|---|
| \`\\d\` | one digit (in a Java String you write \`"\\\\d"\`) |
| \`{6}\`, \`{1,3}\`, \`+\`, \`*\` | exactly 6 / 1 to 3 / one or more / zero or more |
| \`\\.\` \`\\$\` | a literal dot or dollar (both are special otherwise) |
| \`[\\w.+-]\` | one character from the set: letter/digit/_ or . + - |
| \`( )\` | capture group, read it with \`group(1)\` |
| \`(?: )\` | group without capturing (for repetition only) |

The three Java calls:
* \`Pattern.compile(...)\` turns the expression into a reusable object. Compile it once in a \`static final\` constant.
* \`matcher.find()\` searches for the **next** match anywhere in the text. Call it in a \`while\` loop to get every match. \`group()\` is the whole match and \`group(1)\` is the first capture group.
* \`String.matches(regex)\` is true only if the **entire** string matches, which is what validation needs. (\`find\` would accept \`"xx asha@shop.test yy"\`.)

The price pattern \`\\$(\\d{1,3}(?:,\\d{3})*\\.\\d{2})\` also handles \`$1,050.00\`: one to three digits, then any number of ",ddd" groups, then the cents.

Don't overdo it: an e-mail regex for test data only needs to catch obviously broken values, not implement the full e-mail RFC.`,
  mistakes: [
    'Writing "\\d" in a Java String: \\d is not a valid Java escape, so it doesn\'t compile. Double the backslash: "\\\\d".',
    'Forgetting to call find() before group(), which throws IllegalStateException: "No match found".',
    'Using matches() to search inside a longer text. It requires the whole string to match, so it returns false.',
    'Forgetting to escape $ or . in the pattern: . matches ANY character, and $ means "end of line".',
  ],
  interview: [
    { q: 'What is the difference between find() and matches()?', a: 'matches() succeeds only if the entire input matches the pattern, which is right for validation. find() searches for the next part of the input that matches, which is right for extracting values. Calling find() in a loop returns every match.' },
    { q: 'How do you capture a dynamic value like an order id from a confirmation message?', a: 'Use a regex with the stable parts and a capture group for the dynamic part, e.g. "order (SE-\\\\d{6})", then call matcher.find() and group(1). Save the id for later steps, such as looking the order up through the API or on the order history page.' },
    { q: 'Why compile a Pattern once instead of calling String.matches each time?', a: 'String.matches and replaceAll compile the regex on every call. A static final Pattern is compiled once and can safely be shared between threads, which matters in loops over many elements and in parallel test runs.' },
  ],
}
