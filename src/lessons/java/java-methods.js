export default {
  slug: 'java-methods',
  category: 'java',
  order: 3,
  title: 'Methods: write a step once, reuse it everywhere',
  minutes: 7,
  summary: 'Turn copy-pasted lines into methods with parameters and return values, overload them, and build dynamic locators with String.format.',
  manualAnalogy: `In a manual test suite you do not rewrite "Log in as standard_user" in every test case — you write it once as a reusable step and reference it. A method is exactly that reusable step: give it a name, the inputs it needs (parameters), and the result it hands back (return value).`,
  body: `## Anatomy of a method

\`\`\`java
public static double applyTax(double subtotal, double rate) {
    double tax = subtotal * rate;
    return subtotal + tax;
}
\`\`\`

Reading the first line left to right:

| Part | Meaning |
|---|---|
| \`public\` | Any other class may call it (see the *Encapsulation* lesson) |
| \`static\` | Belongs to the class, callable without creating an object (see the *static vs instance* lesson) |
| \`double\` | The **return type** — what the method hands back. \`void\` means "nothing" |
| \`applyTax\` | The name — a verb, camelCase |
| \`(double subtotal, double rate)\` | **Parameters**: inputs, each with a type and a name |

\`return\` ends the method and sends the value back to the caller. A method whose return type is not \`void\` *must* return a value on every path.

Calling it:

\`\`\`java
double total = applyTax(29.99, 0.08);   // 32.3892
\`\`\`

The values \`29.99\` and \`0.08\` are **arguments**; inside the method they are known as \`subtotal\` and \`rate\`. The returned value lands in \`total\`.

## Return, don't print

A helper that does \`System.out.println(result)\` is a dead end: the caller cannot assert on what was printed. A helper that **returns** the result can be printed, asserted, added up or passed to another method. Rule of thumb for test code: helpers return values; only the test (or \`main\`) decides what to do with them.

## Methods calling methods

Small methods combine into bigger ones. Suppose you already have a method that turns one line of text into a number; a second method can call it in a loop:

\`\`\`java
public static int parseQuantity(String text) {          // "Qty: 3" -> 3
    return Integer.parseInt(text.replace("Qty:", "").trim());
}

public static int totalQuantity(List<String> lines) {
    int sum = 0;
    for (String line : lines) {
        sum += parseQuantity(line);     // reuse, don't copy
    }
    return sum;
}
\`\`\`

If the format ever changes (say, "Quantity: 3"), you fix **one** method and every caller is fixed. That is the whole point.

## Overloading: same name, different parameters

Java lets two methods share a name if their parameter lists differ:

\`\`\`java
public static void waitFor(By locator) {
    waitFor(locator, 10);               // delegates with a default
}

public static void waitFor(By locator, int seconds) {
    // the real work lives here, once
}
\`\`\`

The compiler picks the version that matches the arguments you pass. The short version calls the long one with a default value — so the logic is written only once. You will see this pattern in constructors too.

## String.format: building dynamic locators

Locators often contain test data: a product name, an order id, a row label. Gluing pieces together with \`+\` and quotes gets unreadable fast. \`String.format\` uses a template with placeholders:

\`\`\`java
public static String rowXpath(String employeeName) {
    return String.format("//tr[td[normalize-space()='%s']]", employeeName);
}

rowXpath("Chen Wei");   // //tr[td[normalize-space()='Chen Wei']]
\`\`\`

- \`%s\` is replaced by a String argument, \`%d\` by an int, \`%.2f\` by a double with 2 decimals.
- Arguments fill placeholders in order.
- Note the quote styles: the Java String uses double quotes \`"\`, the XPath inside it uses single quotes \`'\`. Mixing them this way avoids escaping.

Wrap the result in a locator when you use it: \`By.xpath(rowXpath("Chen Wei"))\`.

## What a method really receives: a copy

Java is **pass-by-value**: a method gets a *copy* of each argument.

\`\`\`java
static void addTax(double total) { total = total * 1.08; }       // changes the copy only
static void addItem(List<String> cart) { cart.add("Junior Onesie"); }   // changes the shared list
\`\`\`

- For a primitive (\`double total\`), the copy is the number. The caller's variable never changes.
- For an object (\`List<String> cart\`), the copy is a **reference** to the same object. Calling methods on it (\`add\`) changes what the caller sees, but assigning a new object to the parameter (\`cart = new ArrayList<>()\`) only redirects the local copy.

That's one more reason for the "return, don't print" rule: if a helper computes a new value, **return** it and let the caller store it.

## Naming and size

- Name methods by what they do: \`parsePrice\`, \`cartTotal\`, \`isErrorShown\`. Methods returning \`boolean\` read well with \`is\`/\`has\`.
- One method, one job. If you need "and" to describe it, consider splitting it.`,
  keyPoints: [
    'A method = return type + name + parameters + body; return sends a value back.',
    'Helpers should return results, not print them, so tests can assert on them.',
    'Methods can call other methods — fix logic in one place.',
    'Overloading: same name, different parameters; let the short version delegate to the full one.',
    'String.format("...%s...", value) builds readable dynamic locators.',
    'Java passes copies: reassigning a parameter never changes the caller\'s variable.',
  ],
  mistakes: [
    'Printing inside a helper instead of returning — the caller cannot use the value.',
    'Forgetting return on some path of a non-void method — compile error "missing return statement".',
    'Copy-pasting the same parsing lines into several places — extract a method and call it.',
    'Nesting double quotes inside the XPath string — use single quotes for XPath values inside the Java string.',
  ],
  tryIt: `On http://localhost:5180/practice-site/inventory.html every "Add to cart" button has an id like \`add-to-cart-pulse-bike-light\`. Write a method \`addToCartId(String slug)\` that returns that id using String.format, and check it gives the right value for \`retro-red-tee\`.`,
  problems: ['java-004', 'java-016', 'java-027', 'java-030'],
}
