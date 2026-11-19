export default {
  slug: 'java-strings-for-assertions',
  category: 'java',
  order: 1,
  title: 'Variables and Strings: turning UI text into something you can assert',
  minutes: 10,
  summary: 'Store values in typed variables, clean up text from getText() with trim/toLowerCase/replace, compare it safely with equals, and convert "$12.50" into a number.',
  manualAnalogy: `When you test by hand you read a label and decide "yes, that says *Order Confirmed*" — your eyes ignore extra spaces, CSS uppercase and the currency sign without you noticing. Code is not that forgiving. Selenium hands you the raw characters, and you must clean them up and compare them deliberately, exactly as a strict tester would compare expected vs actual in a test case.`,
  body: `## Variables: labelled boxes with a type

A variable is a named box that holds one value. In Java you must say what *kind* of value the box holds:

\`\`\`java
String productName = "Pulse Bike Light";   // text
int quantity = 2;                          // whole number
double unitPrice = 9.99;                   // decimal number
boolean inStock = true;                    // true / false
\`\`\`

- The word on the left (\`String\`, \`int\`, \`double\`, \`boolean\`) is the **type**. Java refuses to put text into an \`int\` box — that check happens before the code even runs.
- \`String\` starts with a capital letter because it is a **class** (an object type); \`int\`, \`double\` and \`boolean\` are lowercase *primitive* types.
- Every statement ends with \`;\`.

## What getText() really gives you

\`element.getText()\` returns a \`String\` containing whatever the browser renders: leading/trailing spaces, line breaks, symbols like \`$\` or \`,\`. Before asserting, you normalise it.

\`\`\`java
String raw = "   Thank you for your order!  ";
String clean = raw.trim();                  // "Thank you for your order!"
String lower = clean.toLowerCase();         // "thank you for your order!"
boolean mentionsOrder = lower.contains("order");   // true
\`\`\`

The most important rule of Java Strings: **they never change**. \`raw.trim()\` does not modify \`raw\`; it *returns a new String*. If you write \`raw.trim();\` on its own line and ignore the result, nothing happens. Always store or use the returned value.

| Method | What it returns | Typical test use |
|---|---|---|
| \`trim()\` / \`strip()\` | Copy without surrounding whitespace | Header text, button labels |
| \`toLowerCase()\` / \`toUpperCase()\` | Copy in one case | Text styled by CSS \`text-transform\` |
| \`contains("x")\` | \`true\` if the text appears anywhere (case-sensitive) | Partial messages |
| \`replace("a", "b")\` | Copy with every "a" replaced | Removing \`$\` or \`,\` |
| \`substring(start)\` | Copy from position \`start\` | Dropping a fixed prefix |
| \`startsWith("x")\` / \`endsWith("x")\` | \`true\`/\`false\` | URLs, ids |

## equals, not ==

\`\`\`java
String expected = "Checkout";
String actual = driver.findElement(By.id("checkout")).getText();

if (actual.equals(expected)) { ... }            // compares the characters
if (actual.equalsIgnoreCase("CHECKOUT")) { ... } // ignores case
\`\`\`

\`==\` asks "are these the **same object in memory**?", not "do they contain the same characters?". Text coming from the browser is always a brand-new object, so \`==\` usually says \`false\` even when the words match. Sometimes, with two literals typed in your code, \`==\` happens to say \`true\` — that is what makes it such a sneaky bug. Use \`equals\` every time.

A related trap: calling a method on \`null\`. If a variable holds \`null\` (no object at all), \`text.equals("x")\` throws a \`NullPointerException\`. Writing the known value first — \`"x".equals(text)\` — is safe, because \`"x"\` is never null.

## From text to number

Prices arrive as text. You cannot do maths on \`"$1,050.00"\`, so strip the symbols and parse:

\`\`\`java
String totalText = "$1,050.00";
String digits = totalText.replace("$", "").replace(",", "");  // "1050.00"
double total = Double.parseDouble(digits);                     // 1050.0
int items = Integer.parseInt("3");                              // 3
\`\`\`

\`Double.parseDouble\` throws \`NumberFormatException\` if anything non-numeric is left over, which is actually useful: a garbled price fails loudly. Calls can be **chained** because each one returns a new String.

## int vs Integer: wrapper classes

Every primitive has an object twin, called a **wrapper class**: \`int\`/\`Integer\`, \`double\`/\`Double\`, \`boolean\`/\`Boolean\`. Lists and maps can only hold objects, so \`List<Integer>\` uses the wrapper, and Java converts back and forth for you (**autoboxing**). Three things to remember:

- Wrappers are objects, so \`==\` compares references again. Compare them with \`equals\`, or convert to \`int\` first.
- A wrapper can be \`null\`. Turning a \`null\` \`Integer\` into an \`int\` throws \`NullPointerException\`. This happens with \`map.get(missingKey)\`.
- \`Integer.parseInt\` is strict: \`" 3 "\` fails. Call \`trim()\` first.

## Taking text apart: split, indexOf, substring, join

Labels often hold several values, e.g. the cart line \`"Pulse Bike Light - $9.99"\`. Cut at **separators and markers**, never at fixed positions:

\`\`\`java
String line = "Pulse Bike Light - $9.99";
String[] parts = line.split(" - ");                  // ["Pulse Bike Light", "$9.99"]
String name = parts[0];
String firstWord = name.substring(0, name.indexOf(' '));   // "Pulse"
String names = String.join(" | ", List.of("Pulse Bike Light", "Junior Onesie"));
\`\`\`

- \`split\` returns a \`String[]\` (an array, see the *if and loops* lesson). It takes a regular expression, so \`.\` and \`|\` need escaping.
- \`indexOf\` returns the **position** of a character, or \`-1\` if it isn't there. \`substring(start, end)\` keeps the characters from \`start\` up to, but not including, \`end\`.
- \`String.join\` puts a separator between list items.

## StringBuilder: building long text

Because Strings never change, \`text = text + more\` inside a loop copies the whole text on every pass. A \`StringBuilder\` is a text buffer you *can* change:

\`\`\`java
StringBuilder log = new StringBuilder();
for (String product : List.of("Junior Onesie", "Retro Red Tee")) {
    log.append("checked ").append(product).append('\\n');
}
String result = log.toString();
\`\`\`

\`append\` returns the same builder, so calls chain. Call \`toString()\` once at the end.

## Joining text with +

\`+\` joins Strings, but it works left to right. \`"Total: " + 10 + 5\` gives \`"Total: 105"\` (text first, so both numbers are glued on as text), while \`10 + 5 + " items"\` gives \`"15 items"\` (the numbers are added before any text appears). Use brackets when you mean maths: \`"Total: " + (10 + 5)\`.`,
  keyPoints: [
    'Every variable has a type: String, int, double, boolean.',
    'String methods return a NEW string — store the result (clean = raw.trim()).',
    'Compare text with equals / equalsIgnoreCase, never ==.',
    'Remove $ and , then use Double.parseDouble to compare prices as numbers.',
    'String + number is evaluated left to right; add brackets for arithmetic.',
    'Cut text with split / indexOf + substring, not fixed positions; build long text with StringBuilder.',
    'Integer and Double are objects: compare with equals and watch out for null.',
  ],
  mistakes: [
    'Writing text.trim(); and expecting text to change — assign it: text = text.trim();',
    'Using == to compare getText() with an expected value — use equals.',
    'Parsing "$29.99" directly — remove the currency symbol first or you get NumberFormatException.',
    'Calling .equals on a value that may be null — put the literal first: "Expected".equals(actual).',
  ],
  tryIt: `In any online Java playground (or jshell), run \`String s = "  Add to Cart ";\`, then \`s.trim();\` and print \`"[" + s + "]"\`. Now run \`s = s.trim();\` and print again — see the difference immutability makes.`,
  problems: ['java-001', 'java-002', 'java-017', 'java-020'],
}
