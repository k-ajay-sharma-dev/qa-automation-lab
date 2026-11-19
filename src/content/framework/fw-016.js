export default {
  id: 'fw-016',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'SoftAssert in a loop: verify every product card in one run',
  level: 'BEGINNER',
  tags: ['testng', 'assertions', 'softassert', 'loops'],
  estMinutes: 15,
  scenario: `Sprint 9: marketing updated the prices of all six ShopEasy products. Your manual check is a table of six rows
(name → price) that you tick off on the Products page. The automated version loops over the cards with hard asserts,
so last night it stopped at the second card and you still do not know whether the other four prices are right.`,
  description: `Rewrite \`allPricesMatchTheCatalogue\` so **every** card is checked and every wrong price is reported in one run.

Expected catalogue (from \`inventory.html\`): Trailblazer Backpack $29.99, Pulse Bike Light $9.99,
Classic Crew T-Shirt $15.99, Storm Fleece Jacket $49.99, Junior Onesie $7.99, Retro Red Tee $15.99.

**Rules**
- Keep a **hard** assert that the page shows exactly 6 cards (no point comparing prices on a half-loaded list).
- One \`SoftAssert\` created inside the test, **before** the loop.
- In the loop, soft-assert the price **and** that the button text is \`Add to cart\`, with the product name in each message.
- Call \`assertAll()\` once, **after** the loop — not inside it.`,
  starterCode: `package com.shopeasy.tests;

import java.util.List;
import java.util.Map;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CataloguePriceTest extends BaseTest {

    private static final Map<String, String> EXPECTED_PRICES = Map.of(
            "Trailblazer Backpack", "$29.99",
            "Pulse Bike Light", "$9.99",
            "Classic Crew T-Shirt", "$15.99",
            "Storm Fleece Jacket", "$49.99",
            "Junior Onesie", "$7.99",
            "Retro Red Tee", "$15.99");

    @Test(groups = {"regression"})
    public void allPricesMatchTheCatalogue() {
        List<ProductCard> cards = loginAsStandardUser().productCards();

        for (ProductCard card : cards) {
            Assert.assertEquals(card.getPrice(), EXPECTED_PRICES.get(card.getName()));
        }
    }
}
`,
  solution: `package com.shopeasy.tests;

import java.util.List;
import java.util.Map;
import org.testng.Assert;
import org.testng.annotations.Test;
import org.testng.asserts.SoftAssert;

public class CataloguePriceTest extends BaseTest {

    private static final Map<String, String> EXPECTED_PRICES = Map.of(
            "Trailblazer Backpack", "$29.99",
            "Pulse Bike Light", "$9.99",
            "Classic Crew T-Shirt", "$15.99",
            "Storm Fleece Jacket", "$49.99",
            "Junior Onesie", "$7.99",
            "Retro Red Tee", "$15.99");

    @Test(groups = {"regression"})
    public void allPricesMatchTheCatalogue() {
        List<ProductCard> cards = loginAsStandardUser().productCards();
        Assert.assertEquals(cards.size(), EXPECTED_PRICES.size(), "Number of product cards on the Products page");

        SoftAssert softly = new SoftAssert();
        for (ProductCard card : cards) {
            String name = card.getName();
            softly.assertEquals(card.getPrice(), EXPECTED_PRICES.get(name), "Price of " + name);
            softly.assertEquals(card.getButtonText(), "Add to cart", "Button text of " + name);
        }
        softly.assertAll();
    }
}
`,
  checks: [
    { label: 'Hard assert on the number of cards', pattern: 'Assert\\.assert(Equals|True)\\s*\\([^;]*size\\s*\\(\\s*\\)', hint: 'Assert.assertEquals(cards.size(), 6, "Number of product cards");' },
    { label: 'One SoftAssert created before the loop', pattern: 'SoftAssert\\s+\\w+\\s*=\\s*new\\s+SoftAssert\\s*\\(\\s*\\)\\s*;\\s*for\\s*\\(', hint: 'SoftAssert softly = new SoftAssert(); then the for loop' },
    { label: 'Soft-asserts the price with the product name in the message', pattern: '\\w+\\.assertEquals\\s*\\([^;]*getPrice[^;]*\\+\\s*\\w+', hint: 'softly.assertEquals(card.getPrice(), expected, "Price of " + name);' },
    { label: 'Checks the button text', pattern: '\\w+\\.assert(Equals|True)\\s*\\([^;]*"Add to cart"', hint: 'softly.assertEquals(card.getButtonText(), "Add to cart", ...)' },
    { label: 'assertAll() after the loop', pattern: '\\}\\s*\\w+\\.assertAll\\s*\\(\\s*\\)\\s*;\\s*\\}', hint: 'Close the loop, then call softly.assertAll(); as the last line' },
    { label: 'No hard assert inside the loop', pattern: 'for\\s*\\([^)]*\\)\\s*\\{[^}]*\\bAssert\\.assert', mustNot: true, hint: 'Inside the loop use the SoftAssert, not Assert' },
  ],
  hints: [
    'Create the SoftAssert once, above the for loop — a new one per iteration would lose the earlier failures.',
    'Put the product name into every message: "Price of " + name.',
    'The very last statement of the method is softly.assertAll();',
  ],
  explanation: `A loop of hard asserts is a checklist that stops at the first cross. A loop of soft asserts ticks every
row and hands you the full list at the end:

\`\`\`text
java.lang.AssertionError: The following asserts failed:
    Price of Pulse Bike Light expected [$9.99] but found [$7.49],
    Price of Storm Fleece Jacket expected [$49.99] but found [$4.99]
\`\`\`

Why each rule matters:
- **Hard count check first.** If the page shows 2 cards, six "price" messages are noise; one clear "expected 6 cards
  but found 2" is the real defect. (It also catches a product that disappeared: a loop over an empty list passes!)
- **SoftAssert before the loop, \`assertAll()\` after it.** Calling \`assertAll()\` inside the loop turns it back into a
  hard assert — the run stops at the first bad card.
- **Name in every message.** Without it the report says "expected [$9.99] but found [$7.49]" and you have to guess which card.
- \`Map.of\` keeps the expected data in one readable table — your manual checklist in code. For bigger tables use a
  DataProvider or JSON (fw-004, fw-007).`,
  mistakes: [
    'Creating the SoftAssert inside the loop, so only the last card is ever reported.',
    'Calling assertAll() inside the loop, which stops at the first failing card again.',
    'Not checking the number of cards first, so an empty list passes silently.',
    'Messages without the product name, so the report cannot tell which card is wrong.',
  ],
  interview: [
    { q: 'How do you verify a list of items and report every mismatch?', a: 'Hard-assert the precondition (the list size), create one SoftAssert, loop over the items soft-asserting each one with an identifying message, then call assertAll() once after the loop so all failures are reported together.' },
    { q: 'Why can a loop-based test pass when it should fail?', a: 'If the list is empty the loop body never runs and nothing is asserted. Always assert the expected count (or non-empty) before looping.' },
  ],
}
