export default {
  id: 'java-004',
  category: 'java',
  kind: 'code',
  title: 'Extract reusable helpers: parsePrice, cartTotal and a dynamic XPath',
  level: 'BEGINNER',
  tags: ['methods', 'return-values', 'string-format', 'dynamic-xpath'],
  estMinutes: 20,
  scenario: `Code review on your first automation PR. The reviewer counted the same "strip the $, strip the comma, trim, parseDouble" line copy-pasted in 12 step definitions,
and XPaths built with \`"..." + name + "..."\` concatenation that nobody can read. When the shop added a "USD" suffix to prices, all 12 places had to be fixed.
The fix every framework uses: small **methods with return values** in a utility class, written once and called everywhere.`,
  description: `Refactor \`CartMath\` into three \`public static\` helper methods and make \`main\` use them.

1. \`double parsePrice(String text)\` — turns \`"$1,299.00"\` into \`1299.0\` and **returns** it.
2. \`double cartTotal(List<String> priceTexts)\` — loops over the texts, **calls \`parsePrice\`** for each one and returns the sum.
3. \`String productCardXpath(String productName)\` — returns the XPath for a product card by its name, built with **\`String.format\`** and a \`%s\` placeholder:
   \`//div[@class='product-card'][.//h3[normalize-space()='Blue Hoodie']]\`

**Rules**
* Each method returns its result (no \`System.out.println\` inside the helpers).
* No more copy-pasted parsing lines in \`main\`.`,
  hints: [
    'Signature pattern: public static double parsePrice(String text) { ... return value; }',
    'cartTotal: double total = 0; for (String t : priceTexts) { total += parsePrice(t); } return total;',
    'String.format("//div[@class=\'product-card\'][.//h3[normalize-space()=\'%s\']]", productName)',
  ],
  language: 'java',
  starterCode: `package com.shop.utils;

import java.util.List;

public class CartMath {

    public static void main(String[] args) {
        List<String> cartPrices = List.of("$19.99", "$5.01", "$1,075.00");

        // copy-pasted in 12 step definitions...
        double p1 = Double.parseDouble(cartPrices.get(0).replace("$", "").replace(",", "").trim());
        double p2 = Double.parseDouble(cartPrices.get(1).replace("$", "").replace(",", "").trim());
        double p3 = Double.parseDouble(cartPrices.get(2).replace("$", "").replace(",", "").trim());
        System.out.println("Total: " + (p1 + p2 + p3));

        String name = "Blue Hoodie";
        String xpath = "//div[@class='product-card'][.//h3[normalize-space()='" + name + "']]";
        System.out.println(xpath);
    }

    // TODO: public static double parsePrice(String text)
    // TODO: public static double cartTotal(List<String> priceTexts)
    // TODO: public static String productCardXpath(String productName)
}
`,
  solution: `package com.shop.utils;

import java.util.List;

public class CartMath {

    public static void main(String[] args) {
        List<String> cartPrices = List.of("$19.99", "$5.01", "$1,075.00");

        System.out.println("Total: " + cartTotal(cartPrices));
        System.out.println(productCardXpath("Blue Hoodie"));
    }

    /** "$1,299.00" -> 1299.0 */
    public static double parsePrice(String text) {
        String cleaned = text.replace("$", "").replace(",", "").trim();
        return Double.parseDouble(cleaned);
    }

    public static double cartTotal(List<String> priceTexts) {
        double total = 0;
        for (String text : priceTexts) {
            total += parsePrice(text);
        }
        return total;
    }

    public static String productCardXpath(String productName) {
        return String.format("//div[@class='product-card'][.//h3[normalize-space()='%s']]", productName);
    }
}
`,
  checks: [
    { label: 'Declares parsePrice(String) returning double', pattern: 'static\\s+double\\s+parsePrice\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'public static double parsePrice(String text)' },
    { label: 'Declares cartTotal(List<String>) returning double', pattern: 'static\\s+double\\s+cartTotal\\s*\\(\\s*List\\s*<\\s*String\\s*>\\s+\\w+\\s*\\)', hint: 'public static double cartTotal(List<String> priceTexts)' },
    { label: 'cartTotal reuses parsePrice', pattern: '\\+=\\s*parsePrice\\s*\\(|=\\s*\\w+\\s*\\+\\s*parsePrice\\s*\\(|map(ToDouble)?\\s*\\(\\s*(CartMath::parsePrice|\\w+\\s*->\\s*parsePrice)', hint: 'total += parsePrice(text);' },
    { label: 'Declares a String-returning XPath helper', pattern: 'static\\s+String\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: 'public static String productCardXpath(String productName)' },
    { label: 'Builds the XPath with String.format / formatted and %s', pattern: '(String\\.format\\s*\\(|\\.formatted\\s*\\()[^;]*%s|%s[^;]*\\.formatted\\s*\\(', hint: 'String.format("...\'%s\'...", productName)' },
    { label: 'Helpers return values', pattern: 'return\\s+\\w', hint: 'Each helper ends with return ...;' },
    { label: 'No copy-pasted parsing left in main', pattern: '(parseDouble[\\s\\S]*){2}', mustNot: true, hint: 'Only parsePrice should call Double.parseDouble.' },
  ],
  explanation: `A **method** gives a piece of logic a name, inputs (parameters) and an output (return value). In a framework, helpers like these live in a \`utils\` package and are called from page objects and step definitions.

* \`parsePrice\` is the single source of truth for "how do we read a price". When the format changes ("1.299,00 €"), you fix one method.
* \`cartTotal\` **composes** helpers — it calls \`parsePrice\` instead of re-implementing it. Small methods that call each other are easier to unit-test than one long \`main\`.
* \`String.format\` with \`%s\` keeps a dynamic locator readable: the XPath template is visible in one piece, and the variable part is clearly marked. (Java 15+ also offers \`"...%s...".formatted(name)\`.)
* \`static\` here means "no object needed" — call it as \`CartMath.parsePrice("$5")\`. That suits stateless utilities; things with state (a driver, a page) should be instance methods.

Reviewers also check that helpers **return** rather than print — a helper that prints cannot be asserted on.`,
  mistakes: [
    'Printing inside the helper instead of returning — the caller cannot assert on printed output.',
    'Declaring the return type void and then trying to use the result.',
    'Re-implementing the parsing inside cartTotal instead of calling parsePrice.',
    'Building XPaths with many + concatenations and mismatched quotes — String.format with %s is easier to read and fix.',
  ],
  interview: [
    { q: 'What is the difference between a parameter and a return value?', a: 'Parameters are the inputs a method receives when it is called; the return value is the single result it hands back to the caller. A void method returns nothing and is used for actions (click, type), while a method with a return type is used for queries (getText, parsePrice).' },
    { q: 'How do you build dynamic locators in your framework?', a: 'With a helper that takes the variable part as a parameter and returns a By or XPath String built with String.format, e.g. By.xpath(String.format("//tr[td[text()=\'%s\']]//button", orderId)). It keeps one template per pattern instead of dozens of hard-coded locators.' },
    { q: 'What is method overloading? Give a test-automation example.', a: 'Several methods with the same name but different parameter lists, e.g. click(By locator) and click(WebElement element), or waitForVisible(By) and waitForVisible(By, Duration). The compiler picks the version based on the arguments.' },
  ],
}
