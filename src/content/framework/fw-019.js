export default {
  id: 'fw-019',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Break the chain: from priority/dependsOnMethods to independent tests',
  level: 'INTERMEDIATE',
  tags: ['testng', 'test-independence', 'priority', 'dependsonmethods', 'parallel'],
  estMinutes: 20,
  scenario: `\`CheckoutFlowTest\` is four tests glued together with \`priority\` and a \`static\` field: test 1 logs in, test 2 adds the
backpack, test 3 fills the checkout form, test 4 checks the total. When test 2 failed on Monday, tests 3 and 4 failed too
— three red tests, one bug. When you switched on \`parallel="methods"\` everything failed. The lead asks you to make each
test **stand on its own**.`,
  description: `Rewrite the class so every test can run alone, in any order, in parallel.

**Rules**
- No \`priority\`, no \`dependsOnMethods\`, no \`static\` mutable fields.
- Each test creates its own precondition. Use the fast shortcut: a private helper that puts products straight into the
  cart through \`sessionStorage\` (key \`shopeasy.cart\`, a JSON array of slugs like \`["trailblazer-backpack"]\`) with
  \`JavascriptExecutor\`, then opens the page under test. (Logging in through the UI stays in \`loginAsStandardUser()\`.)
- Keep three tests: adding the backpack shows badge \`1\`; the cart lists the backpack; the checkout overview total for
  the backpack is \`$32.39\`.`,
  starterCode: `package com.shopeasy.tests;

import org.testng.Assert;
import org.testng.annotations.Test;

public class CheckoutFlowTest extends BaseTest {

    private static InventoryPage inventory;
    private static CartPage cart;

    @Test(priority = 1)
    public void login() {
        inventory = loginAsStandardUser();
    }

    @Test(priority = 2)
    public void addBackpack() {
        inventory.addToCart("Trailblazer Backpack");
        Assert.assertEquals(inventory.header().cartBadgeCount(), 1);
    }

    @Test(priority = 3, dependsOnMethods = "addBackpack")
    public void cartListsBackpack() {
        cart = inventory.header().openCart();
        Assert.assertTrue(cart.productNames().contains("Trailblazer Backpack"));
    }

    @Test(priority = 4, dependsOnMethods = "cartListsBackpack")
    public void overviewShowsTotal() {
        String total = cart.checkout().fillShippingInfo("Asha", "Rao", "560001")
                .continueToOverview().getTotal();
        Assert.assertEquals(total, "$32.39");
    }
}
`,
  solution: `package com.shopeasy.tests;

import java.util.List;
import org.openqa.selenium.JavascriptExecutor;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CheckoutFlowTest extends BaseTest {

    @Test(groups = {"regression"})
    public void addingBackpackShowsBadgeOne() {
        InventoryPage inventory = loginAsStandardUser();

        inventory.addToCart("Trailblazer Backpack");

        Assert.assertEquals(inventory.header().cartBadgeCount(), 1, "Cart badge after adding one product");
    }

    @Test(groups = {"regression"})
    public void cartListsTheBackpack() {
        InventoryPage inventory = loginAsStandardUser();
        givenCartContains("trailblazer-backpack");

        CartPage cart = inventory.header().openCart();

        Assert.assertTrue(cart.productNames().contains("Trailblazer Backpack"), "Cart items: " + cart.productNames());
    }

    @Test(groups = {"regression"})
    public void overviewShowsTotalWithTax() {
        InventoryPage inventory = loginAsStandardUser();
        givenCartContains("trailblazer-backpack");

        String total = inventory.header().openCart()
                .checkout()
                .fillShippingInfo("Asha", "Rao", "560001")
                .continueToOverview()
                .getTotal();

        Assert.assertEquals(total, "$32.39", "29.99 + 8% tax");
    }

    /** Precondition shortcut: put products into the cart without clicking through the UI. */
    private void givenCartContains(String... slugs) {
        ((JavascriptExecutor) driver()).executeScript(
                "sessionStorage.setItem('shopeasy.cart', JSON.stringify(arguments[0]));",
                List.of(slugs));
    }
}
`,
  checks: [
    { label: 'No priority', pattern: 'priority\\s*=', mustNot: true, hint: 'Independent tests do not need an order' },
    { label: 'No dependsOnMethods', pattern: 'dependsOnMethods', mustNot: true, hint: 'Each test sets up its own precondition instead' },
    { label: 'No static fields shared between tests', pattern: 'static\\s+(?!final)[\\w<>]+\\s+\\w+\\s*[;=]', mustNot: true, hint: 'Use local variables inside each test' },
    { label: 'Precondition helper uses sessionStorage', pattern: 'executeScript\\s*\\([\\s\\S]*?sessionStorage\\.setItem\\s*\\(\\s*\'shopeasy\\.cart\'', hint: "executeScript(\"sessionStorage.setItem('shopeasy.cart', JSON.stringify(arguments[0]));\", List.of(slugs))" },
    { label: 'Each test starts by logging in itself', pattern: '(@Test(\\s*\\([^)]*\\))?\\s*public\\s+void\\s+\\w+\\s*\\(\\s*\\)\\s*\\{\\s*InventoryPage\\s+\\w+\\s*=\\s*loginAsStandardUser\\s*\\(\\s*\\)[\\s\\S]*?){3}', hint: 'Start every @Test with InventoryPage inventory = loginAsStandardUser();' },
    { label: 'Total still verified', pattern: 'assertEquals\\s*\\([^;]*"\\$32\\.39"', hint: 'Assert.assertEquals(total, "$32.39", ...)' },
  ],
  hints: [
    'Ask of every test: "could I run only this one, right now, and would it pass?"',
    'Replace the static fields with local variables inside each test.',
    'A helper like givenCartContains("trailblazer-backpack") sets the cart in one JavaScript call instead of three UI steps.',
  ],
  explanation: `**Independent tests** are the single most important property of a reliable suite:

| Chained tests | Independent tests |
|---|---|
| one bug → a cascade of red/skipped tests | one bug → one red test |
| must run in a fixed order, on one thread | any order, any subset, in parallel |
| \`-Dtest=CheckoutFlowTest#overviewShowsTotal\` cannot run alone | every test can be rerun alone |
| state in \`static\` fields leaks between threads | state lives in local variables |

**Shortcuts for preconditions.** Only the thing under test should go through the UI. The cart test is about the cart
page, so *getting* the backpack into the cart can use a shortcut: the ShopEasy shop keeps its cart in
\`sessionStorage['shopeasy.cart']\`, so one \`executeScript\` replaces three clicks. On a real product the shortcut is
usually an **API call** (\`POST /api/cart/items\`, see fw-023) or a database seed. The badge test still clicks
"Add to cart" because that click *is* what it tests.

Note \`List.of(slugs)\` is passed as \`arguments[0]\`; Selenium converts a Java list into a JavaScript array.

Yes, each test now logs in — a few seconds more. That cost buys parallel runs (which save minutes) and honest
results. When login time really matters, inject the session (cookie/storage) instead of using the login form.`,
  mistakes: [
    'Keeping a static page object or driver field "to save time", which breaks as soon as tests run in parallel.',
    'Replacing dependsOnMethods with priority, which keeps the coupling but hides it.',
    'Doing every precondition through the UI, which makes tests slow and fail for reasons unrelated to what they check.',
    'Shortcut helpers that write to production-like data stores without cleaning up.',
  ],
  interview: [
    { q: 'Why should automated tests be independent?', a: 'So that one defect produces one failure, tests can run in any order or alone, and the suite can run in parallel. Dependent tests produce cascades of failures and skips and cannot be rerun individually.' },
    { q: 'How do you set up preconditions quickly in UI tests?', a: 'Through shortcuts below the UI: API calls, database seeding, injecting cookies or local/session storage. Only the behaviour under test goes through the UI.' },
    { q: 'When would you still use dependsOnMethods?', a: 'Rarely — for example a health-check test that all others depend on so the suite skips quickly when the environment is down. Business tests should not depend on each other.' },
  ],
}
