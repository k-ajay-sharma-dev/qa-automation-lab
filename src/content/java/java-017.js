export default {
  id: 'java-017',
  category: 'java',
  kind: 'code',
  title: 'Take apart the checkout summary with split, substring, join and StringBuilder',
  level: 'BEGINNER',
  tags: ['strings', 'stringbuilder', 'split', 'substring', 'string-join'],
  estMinutes: 20,
  scenario: `ShopEasy checkout, step 2 (the Overview). The page shows one line \`Shipping to: Asha Rao, 560001\` (\`#summary-ship-to\` holds just \`Asha Rao, 560001\`) and \`Total: $43.18\`.
The test lead wants three checks from those two texts: the first name, the postal code and the total as a number. The current code cuts text at fixed positions (\`substring(0, 4)\`) and builds the failure report with \`report = report + ...\` inside a loop.
It broke the day a customer called "Priyanka" placed an order. Time to take text apart properly.`,
  description: `Complete \`main\` using the texts already read from the page.

1. **Split** \`shipTo\` (\`"Asha Rao, 560001"\`) on \`", "\` into the full name and the postal code.
2. Get the **first name** with \`substring(0, fullName.indexOf(' '))\`. No hard-coded lengths.
3. Get the amount after the \`$\` in \`totalLabel\` with \`substring(totalLabel.indexOf('$') + 1)\` and parse it to a \`double\`.
4. Build one line \`"Trailblazer Backpack, Pulse Bike Light"\` from \`itemNames\` with **\`String.join\`**.
5. Build a numbered, multi-line order report with a **\`StringBuilder\`** (\`append\` in the loop, \`toString()\` once at the end).
6. Throw an \`AssertionError\` if the first name is not \`Asha\`, the postal code is not \`560001\` or the total is not \`43.18\`.

**Rules**
* Don't use \`report = report + ...\` or \`report += ...\` to grow text inside a loop.
* No fixed character positions like \`substring(0, 4)\`.`,
  hints: [
    'String[] parts = shipTo.split(", ");  gives parts[0] = "Asha Rao" and parts[1] = "560001".',
    'indexOf returns the POSITION of a character, so substring(0, fullName.indexOf(\' \')) works for any first name.',
    'StringBuilder report = new StringBuilder(); report.append(i + 1).append(". ").append(name).append(\'\\n\'); then report.toString().',
  ],
  language: 'java',
  starterCode: `package com.shop.tests;

import java.util.List;

public class CheckoutSummaryText {

    public static void main(String[] args) {
        // Texts read from checkout step 2: #summary-ship-to and [data-testid='total-label']
        String shipTo = "Asha Rao, 560001";
        String totalLabel = "Total: $43.18";
        List<String> itemNames = List.of("Trailblazer Backpack", "Pulse Bike Light");

        // Old code: fixed positions. Breaks for any other name or a longer total.
        String firstName = shipTo.substring(0, 4);
        String postalCode = shipTo.substring(10, 16);
        double total = Double.parseDouble(totalLabel.substring(8, 13));

        String report = "";
        for (int i = 0; i < itemNames.size(); i++) {
            report = report + (i + 1) + ". " + itemNames.get(i) + "\\n";
        }
        System.out.println(report);

        // TODO: use split, indexOf + substring, String.join and StringBuilder instead
        // TODO: throw an AssertionError if firstName, postalCode or total are wrong
    }
}
`,
  solution: `package com.shop.tests;

import java.util.List;

public class CheckoutSummaryText {

    public static void main(String[] args) {
        String shipTo = "Asha Rao, 560001";
        String totalLabel = "Total: $43.18";
        List<String> itemNames = List.of("Trailblazer Backpack", "Pulse Bike Light");

        // 1. "Asha Rao, 560001" -> ["Asha Rao", "560001"]
        String[] parts = shipTo.split(", ");
        String fullName = parts[0].trim();
        String postalCode = parts[1].trim();

        // 2. everything before the first space, whatever the name's length
        String firstName = fullName.substring(0, fullName.indexOf(' '));

        // 3. everything after the $ sign
        String amountText = totalLabel.substring(totalLabel.indexOf('$') + 1).trim();
        double total = Double.parseDouble(amountText);

        // 4. one readable line for logs and assertion messages
        String itemsLine = String.join(", ", itemNames);

        // 5. multi-line report: one StringBuilder, many appends, one toString()
        StringBuilder report = new StringBuilder();
        report.append("Order for ").append(fullName).append(" (").append(postalCode).append(")\\n");
        for (int i = 0; i < itemNames.size(); i++) {
            report.append(i + 1).append(". ").append(itemNames.get(i)).append('\\n');
        }
        report.append(String.format("Total: $%.2f", total));
        String reportText = report.toString();

        System.out.println("Items: " + itemsLine);
        System.out.println(reportText);

        // 6. the actual checks
        if (!firstName.equals("Asha") || !postalCode.equals("560001") || Math.abs(total - 43.18) > 0.001) {
            throw new AssertionError("Checkout summary is wrong:\\n" + reportText);
        }
        System.out.println("PASS");
    }
}
`,
  checks: [
    { label: 'Splits the ship-to text', pattern: '\\.split\\s*\\(', hint: 'String[] parts = shipTo.split(", ");' },
    { label: 'Cuts text at a found position (substring + indexOf)', pattern: '\\.substring\\s*\\([^;]*\\.indexOf\\s*\\(', hint: 'totalLabel.substring(totalLabel.indexOf(\'$\') + 1)' },
    { label: 'No hard-coded substring positions', pattern: '\\.substring\\s*\\(\\s*\\d+\\s*,\\s*\\d+\\s*\\)', mustNot: true, hint: 'Fixed positions break as soon as the name or amount changes length.' },
    { label: 'Joins the item names with String.join', pattern: 'String\\.join\\s*\\(', hint: 'String.join(", ", itemNames)' },
    { label: 'Builds the report with a StringBuilder', pattern: 'new\\s+StringBuilder\\s*\\([\\s\\S]*\\.append\\s*\\(', hint: 'StringBuilder report = new StringBuilder(); report.append(...);' },
    { label: 'Does not grow a String with + in a loop', pattern: 'report\\s*(\\+=|=\\s*report\\s*\\+)', mustNot: true, hint: 'Use report.append(...) instead of report = report + ...' },
    { label: 'Fails the check when a value is wrong', pattern: 'throw\\s+new\\s+AssertionError', hint: 'throw new AssertionError("Checkout summary is wrong: " + ...);' },
  ],
  explanation: `UI text often packs several values into one string. The fix is to cut it at **separators and markers** in the text, not at character positions.

* **\`split(", ")\`** returns a \`String[]\` with the pieces between separators. It works whether the name is "Asha Rao" or "Priyanka Venkataraman".
* **\`indexOf\` + \`substring\`**: \`indexOf(' ')\` finds where the first space is, and \`substring(0, thatPosition)\` keeps everything before it. \`indexOf('$') + 1\` starts just after the dollar sign. If the marker is missing, \`indexOf\` returns \`-1\`, which makes \`substring\` throw, so the test fails loudly.
* **\`String.join(", ", list)\`** puts a separator between the items, with no trailing comma to remove afterwards.
* **\`StringBuilder\`**: Strings can't be changed, so \`report = report + x\` copies the whole text again on every pass of the loop. A \`StringBuilder\` is a text buffer you *can* change. \`append\` adds to it and returns the same builder, so you can chain the calls, and \`toString()\` gives you the final String. For two or three pieces \`+\` is fine. Inside a loop, use a builder.

A reviewer also looks at the assertion message: it includes the whole report, so a CI failure shows what the page said.`,
  mistakes: [
    'Using substring with fixed numbers that only work for one test user.',
    'Forgetting that split takes a regular expression: split(".") or split("|") split on every character. Use split("\\\\.") or Pattern.quote(".").',
    'Calling report.append(...) but printing report without toString() in an assertion message that expects a String (or comparing a StringBuilder with equals, which compares references).',
    'Assuming indexOf found something: when it returns -1, substring throws StringIndexOutOfBoundsException.',
  ],
  interview: [
    { q: 'String vs StringBuilder vs StringBuffer?', a: 'A String can\'t be changed, so every change makes a new object. StringBuilder can be changed and is fast, but it is not safe to share between threads; use it to build text in a loop. StringBuffer is the older thread-safe version and is slower. In test code StringBuilder is the normal choice.' },
    { q: 'How do you get a value out of a label like "Total: $43.18"?', a: 'Cut at a marker, not at a position: substring(text.indexOf(\'$\') + 1), or a regular expression with a capture group if the format can vary. Then parse it with Double.parseDouble or BigDecimal and compare as a number.' },
    { q: 'What does split do with trailing empty values?', a: 'By default split drops trailing empty strings, so "a,b,,".split(",") has length 2. Pass a negative limit, split(",", -1), to keep them. This matters a lot when parsing CSV test data.' },
  ],
}
