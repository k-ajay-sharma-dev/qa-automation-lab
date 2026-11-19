export default {
  id: 'dbg-012',
  category: 'debugging',
  kind: 'code',
  title: 'expected [29.99] but found [$29.99]: comparing text with numbers',
  level: 'BEGINNER',
  tags: ['assertions', 'BigDecimal', 'parsing', 'prices', 'testng'],
  estMinutes: 15,
  scenario: `You automated the ShopEasy price check: "The backpack costs $29.99, and the backpack plus the bike light ($9.99) give an item total of $39.98". The test fails, and you spend 20 minutes staring at the screen because the price on the page **is** $29.99. Your lead looks over your shoulder and laughs: *"Read the message again — character by character."*`,
  description: `Jenkins console:

\`\`\`text
[ERROR] backpackPriceIsCorrect(com.shopeasy.tests.PriceTest)  Time elapsed: 2.104 s  <<< FAILURE!
java.lang.AssertionError: expected [29.99] but found [$29.99]
	at org.testng.Assert.fail(Assert.java:110)
	at org.testng.Assert.failNotEquals(Assert.java:1577)
	at org.testng.Assert.assertEquals(Assert.java:118)
	at com.shopeasy.tests.PriceTest.backpackPriceIsCorrect(PriceTest.java:27)
\`\`\`

\`getText()\` returns a **String** (\`"$29.99"\`); the test compares it to a **double** \`29.99\`. TestNG falls back to \`assertEquals(Object, Object)\`, and a String never equals a Double.

The second test sums doubles — which works today by luck and fails as soon as prices like $0.10 + $0.20 appear (\`0.30000000000000004\`).

**Fix \`PriceTest\`:**
- Write a helper \`toMoney(String)\` that strips everything except digits and the dot, and returns a \`BigDecimal\`.
- Compare money as \`BigDecimal\` (use \`compareTo\` or \`assertEquals\` with \`new BigDecimal("29.99")\`).
- Compute the expected total with \`BigDecimal.multiply\`/\`add\`, not double arithmetic.`,
  hints: [
    'Everything WebDriver gives you from getText() is a String.',
    'price.replaceAll("[^0-9.]", "") turns "$1,299.00" into "1299.00".',
    'new BigDecimal(clean) and Assert.assertEquals(actual.compareTo(expected), 0, message)',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

public class PriceTest extends BaseTest {

    @Test
    public void backpackPriceIsCorrect() {
        String price = inventoryPage.getPriceOf("Trailblazer Backpack"); // "$29.99"
        Assert.assertEquals(price, 29.99);
    }

    @Test
    public void itemTotalForBackpackAndBikeLight() {
        inventoryPage.addToCart("Trailblazer Backpack");
        inventoryPage.addToCart("Pulse Bike Light");
        String itemTotal = checkoutPage.getItemTotal(); // "Item total: $39.98" (checkout overview)
        double expected = 29.99 + 9.99;
        Assert.assertTrue(itemTotal.contains(String.valueOf(expected)));
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import java.math.BigDecimal;
import org.testng.Assert;
import org.testng.annotations.Test;

public class PriceTest extends BaseTest {

    private static final BigDecimal BACKPACK_PRICE = new BigDecimal("29.99");
    private static final BigDecimal BIKE_LIGHT_PRICE = new BigDecimal("9.99");

    /** "$1,299.00" or "Item total: $39.98" -> 1299.00 / 39.98 */
    private static BigDecimal toMoney(String text) {
        String clean = text.replaceAll("[^0-9.]", "");
        return new BigDecimal(clean);
    }

    @Test
    public void backpackPriceIsCorrect() {
        BigDecimal actual = toMoney(inventoryPage.getPriceOf("Trailblazer Backpack"));
        Assert.assertEquals(actual.compareTo(BACKPACK_PRICE), 0,
                "Backpack price expected " + BACKPACK_PRICE + " but was " + actual);
    }

    @Test
    public void itemTotalForBackpackAndBikeLight() {
        inventoryPage.addToCart("Trailblazer Backpack");
        inventoryPage.addToCart("Pulse Bike Light");

        BigDecimal actual = toMoney(checkoutPage.getItemTotal());
        BigDecimal expected = BACKPACK_PRICE.add(BIKE_LIGHT_PRICE);

        Assert.assertEquals(actual.compareTo(expected), 0,
                "Item total expected " + expected + " but was " + actual);
    }
}
`,
  checks: [
    { label: 'Uses BigDecimal for money', pattern: 'BigDecimal', hint: 'Money should never be a double' },
    { label: 'Strips currency symbols/commas before parsing', pattern: '(replaceAll\\s*\\(|NumberFormat)', hint: 'text.replaceAll("[^0-9.]", "")' },
    { label: 'Compares numbers, not String vs double', pattern: 'assertEquals\\s*\\(\\s*\\w+\\s*,\\s*\\d+\\.\\d+\\s*\\)', mustNot: true, hint: 'assertEquals(price, 29.99) compares a String to a Double' },
    { label: 'Uses compareTo (or BigDecimal equality) for the comparison', pattern: '(compareTo\\s*\\(|assertEquals\\s*\\([^;]*new\\s+BigDecimal)', hint: 'actual.compareTo(expected) == 0' },
    { label: 'No double arithmetic for the expected total', pattern: 'double\\s+\\w+\\s*=\\s*\\d+\\.\\d+\\s*\\+', mustNot: true, hint: 'Use BigDecimal.multiply/add' },
  ],
  explanation: `**Read failure messages character by character.** \`expected [29.99] but found [$29.99]\` — the only difference is the \`$\`. The product is right; the *test* is wrong (a test bug).

**Three lessons hidden in this tiny bug:**
1. \`getText()\` always returns a \`String\`. To compare numbers you must **parse** — strip \`$\`, \`,\`, labels like "Item total:" — then convert.
2. **Never use \`double\` for money.** Binary floating point can't represent 0.1 exactly; sums drift (\`0.1 + 0.2 = 0.30000000000000004\`). \`BigDecimal\` built from a *String* is exact.
3. \`BigDecimal.equals\` also compares scale (\`39.98\` vs \`39.980\` are *not* equal), so use \`compareTo(...) == 0\`.

**Put the helper in a utility class** (\`PriceUtils.toMoney\`) — every e-commerce framework needs it for subtotal/tax/total checks, and it's a favourite live-coding interview question.

Also note the improved assertion messages: when it fails at 2 a.m., the Jenkins log tells you both numbers without opening the code.`,
  mistakes: [
    'Comparing getText() directly with a number.',
    'Using Double.parseDouble for money and then summing doubles.',
    'Using BigDecimal.equals and being surprised that 39.98 != 39.980.',
    'Asserting with contains(), which also passes for "$129.99".',
  ],
  interview: [
    { q: 'How do you validate prices or totals on a page?', a: 'I read the text, clean it with a regex to keep digits and the decimal point, convert it to BigDecimal and compare with compareTo. For the cart total we calculate the expected value from the item prices with BigDecimal add and multiply, including tax, and compare that to what the page shows. We never use double for money because of floating-point rounding.' },
    { q: 'Why did your assertion fail with expected [29.99] but found [$29.99]?', a: 'Because getText returns a String and I compared it to a double, so TestNG used Object equality. It is a test bug — the fix is to parse the price into a number type before comparing.' },
  ],
}
