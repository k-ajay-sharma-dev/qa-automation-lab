export default {
  id: 'pom-035',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'CheckoutOverviewPage.getSummary(): return an OrderSummary, not three strings',
  level: 'INTERMEDIATE',
  tags: ['pom', 'checkout', 'record', 'bigdecimal', 'return-types'],
  estMinutes: 20,
  scenario: `A bug slipped to production: the 8% tax on the ShopEasy checkout overview was rounded wrongly for some carts.
The existing test compares \`getTotalText()\` to the hard-coded string \`"$35.63"\`, so it could never catch a calculation
error for other carts. QA wants one call that returns the subtotal, tax and total **as numbers**, so the test can check
\`subtotal + tax == total\` for any cart.`,
  description: `On checkout step two (\`#checkout-step-two\`) the page shows \`#summary-subtotal\`, \`#summary-tax\` and
\`#summary-total\`, each like \`$29.99\`.

**Rules**
- Create \`record OrderSummary(BigDecimal subtotal, BigDecimal tax, BigDecimal total)\`.
- \`getSummary()\` reads the three spans, parses them with a private \`toMoney(String)\` (strip \`$\`, use
  \`new BigDecimal\`), and returns an \`OrderSummary\`.
- Never use \`double\` for money.
- \`finish()\` clicks \`#finish\` and returns \`CheckoutCompletePage\`.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class CheckoutOverviewPage extends BasePage {
    private final By subtotal = By.id("summary-subtotal");
    private final By tax = By.id("summary-tax");
    private final By total = By.id("summary-total");

    public CheckoutOverviewPage(WebDriver driver) { super(driver); }

    public String getTotalText() { return getText(total); }   // "$35.63"

    // TODO: record OrderSummary, getSummary(), toMoney(), finish()
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import java.math.BigDecimal;

public class CheckoutOverviewPage extends BasePage {
    private final By subtotal = By.id("summary-subtotal");
    private final By tax = By.id("summary-tax");
    private final By total = By.id("summary-total");
    private final By finishButton = By.id("finish");

    public record OrderSummary(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {}

    public CheckoutOverviewPage(WebDriver driver) { super(driver); }

    public OrderSummary getSummary() {
        return new OrderSummary(
                toMoney(getText(subtotal)),
                toMoney(getText(tax)),
                toMoney(getText(total)));
    }

    private BigDecimal toMoney(String text) {
        return new BigDecimal(text.replace("$", "").replace(",", "").trim());
    }

    public CheckoutCompletePage finish() {
        click(finishButton);
        return new CheckoutCompletePage(driver);
    }
}

// Test:
// OrderSummary s = overview.getSummary();
// assertEquals(s.subtotal().add(s.tax()), s.total());
// assertEquals(s.tax(), s.subtotal().multiply(new BigDecimal("0.08")).setScale(2, RoundingMode.HALF_UP));
`,
  checks: [
    { label: 'OrderSummary record with three BigDecimal fields', pattern: 'record\\s+OrderSummary\\s*\\(\\s*BigDecimal\\s+\\w+\\s*,\\s*BigDecimal\\s+\\w+\\s*,\\s*BigDecimal\\s+\\w+\\s*\\)', hint: 'public record OrderSummary(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {}' },
    { label: 'getSummary() returns OrderSummary', pattern: 'public\\s+OrderSummary\\s+getSummary\\s*\\(\\s*\\)', hint: 'public OrderSummary getSummary() { return new OrderSummary(...); }' },
    { label: 'Parses with new BigDecimal', pattern: 'new\\s+BigDecimal\\s*\\(', hint: 'new BigDecimal(text.replace("$", ""))' },
    { label: 'No double for money', pattern: '\\bdouble\\b|Double\\.parseDouble', mustNot: true, hint: 'double cannot represent 0.10 exactly; use BigDecimal' },
    { label: 'finish() clicks #finish and returns CheckoutCompletePage', pattern: 'public\\s+CheckoutCompletePage\\s+finish\\s*\\(', hint: 'public CheckoutCompletePage finish() { click(finishButton); return new CheckoutCompletePage(driver); }' },
  ],
  hints: [
    'A Java record gives you a constructor, getters (s.total()) and equals() in one line.',
    'Strip the "$" before new BigDecimal(...), otherwise it throws NumberFormatException.',
    'Keep the arithmetic check (subtotal + tax == total) in the test; the page only reads values.',
  ],
  explanation: `The page object's job is to **translate the screen into data**; the test decides what is correct.

- **One call, one object**: \`getSummary()\` reads all three values at the same moment and returns a typed record.
  Tests become \`assertEquals(s.subtotal().add(s.tax()), s.total())\`, which works for *any* cart.
- **BigDecimal, not double**: \`0.1 + 0.2\` in double is \`0.30000000000000004\`; money assertions would be flaky.
- **Private parsing**: \`toMoney\` is an implementation detail. (If several pages need it, move it to a \`Money\`
  helper and unit test it, see pom-037.)
- **No assertions in the page**: the tax rule lives in the test, where a reviewer can see it.`,
  mistakes: [
    'Using double/Double.parseDouble for prices and getting rounding mismatches.',
    'Comparing to one hard-coded total string that only proves a single cart.',
    'Calculating "expected tax" inside the page object and asserting there.',
    'Forgetting to strip the currency symbol before parsing.',
  ],
  interview: [
    { q: 'Why return a value object instead of strings from a page object?', a: 'Typed objects let tests compare meaning (numbers, equality of whole objects) instead of formatting. Parsing happens once in the page, and formatting changes like "$1,000.00" are fixed in one place.' },
    { q: 'Why BigDecimal for money in tests?', a: 'Binary floating point cannot represent most decimal fractions exactly, so sums drift by tiny amounts and equality checks fail. BigDecimal stores exact decimal values and lets you control rounding explicitly, like the application should.' },
  ],
}
