export default {
  id: 'cuc-021',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'One step for many wordings: optional text, alternatives, {word} and {bigdecimal}',
  level: 'BEGINNER',
  tags: ['step-definitions', 'cucumber-expressions', 'optional-text', 'alternative-text'],
  estMinutes: 15,
  scenario: `\`CartSteps.java\` has grown to 14 methods. Half of them differ by one word: "shows 1 item" and "shows 3 items",
"opens the cart page" and "opens the checkout page", "shows" and "displays". Every time the BA writes a new sentence a new method appears,
and last week two of them became ambiguous. The lead asks you to collapse them using Cucumber expression features.`,
  description: `The feature files contain lines like these — all must keep working:

\`\`\`gherkin
When the shopper adds 1 product to the cart
When the shopper adds 3 products to the cart
Then the cart badge shows 1 item
Then the cart badge displays 3 items
When the shopper opens the cart page
When the shopper opens the checkout page
Then the item total is $39.98
\`\`\`

Rewrite \`CartSteps\` with **four** step methods.

**Rules**
- \`{int}\` for counts, with **optional text** for the plural: \`product(s)\`, \`item(s)\`.
- **Alternative text** for the verb: \`shows/displays\`.
- \`{word}\` for the page name (\`cart\`, \`checkout\` — a single word, no quotes).
- Money is a decimal: use \`{bigdecimal}\` (or \`{double}\`) — the \`$\` stays as literal text.
- No numbers or page names hard-coded in the annotations.`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.ShopNavigation;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class CartSteps {

    private final InventoryPage inventoryPage;
    private final ShopNavigation navigation;
    private final CheckoutPage checkoutPage;

    public CartSteps(TestContext context) {
        this.inventoryPage = new InventoryPage(context.getDriver());
        this.navigation = new ShopNavigation(context.getDriver());
        this.checkoutPage = new CheckoutPage(context.getDriver());
    }

    @When("the shopper adds 1 product to the cart")
    public void addsOneProduct() { inventoryPage.addFirstProductsToCart(1); }

    @When("the shopper adds 3 products to the cart")
    public void addsThreeProducts() { inventoryPage.addFirstProductsToCart(3); }

    @Then("the cart badge shows 1 item")
    public void badgeShowsOne() { Assert.assertEquals(inventoryPage.getCartBadgeCount(), 1); }

    @Then("the cart badge displays 3 items")
    public void badgeDisplaysThree() { Assert.assertEquals(inventoryPage.getCartBadgeCount(), 3); }

    @When("the shopper opens the cart page")
    public void opensCart() { navigation.openPage("cart"); }

    @When("the shopper opens the checkout page")
    public void opensCheckout() { navigation.openPage("checkout"); }

    // TODO: Then the item total is $39.98
}
`,
  solution: `package com.shopeasy.steps;

import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.ShopNavigation;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

import java.math.BigDecimal;

public class CartSteps {

    private final InventoryPage inventoryPage;
    private final ShopNavigation navigation;
    private final CheckoutPage checkoutPage;

    public CartSteps(TestContext context) {
        this.inventoryPage = new InventoryPage(context.getDriver());
        this.navigation = new ShopNavigation(context.getDriver());
        this.checkoutPage = new CheckoutPage(context.getDriver());
    }

    @When("the shopper adds {int} product(s) to the cart")
    public void addsProducts(int count) {
        inventoryPage.addFirstProductsToCart(count);
    }

    @Then("the cart badge shows/displays {int} item(s)")
    public void badgeShows(int expected) {
        Assert.assertEquals(inventoryPage.getCartBadgeCount(), expected, "Cart badge count");
    }

    @When("the shopper opens the {word} page")
    public void opensPage(String pageName) {
        navigation.openPage(pageName);      // cart -> cart.html, checkout -> checkout.html
    }

    @Then("the item total is \${bigdecimal}")
    public void itemTotalIs(BigDecimal expected) {
        Assert.assertEquals(checkoutPage.getItemTotal().compareTo(expected), 0,
                "Item total on the overview, expected $" + expected);
    }
}
`,
  checks: [
    { label: 'Optional plural with (s)', pattern: '@\\w+\\(\\s*"[^"]*\\{int\\}\\s+\\w+\\(s\\)[^"]*"', hint: '"the shopper adds {int} product(s) to the cart"' },
    { label: 'Alternative text with a slash', pattern: '@\\w+\\(\\s*"[^"]*\\b[a-z]+/[a-z]+\\b[^"]*"', hint: '"the cart badge shows/displays {int} item(s)"' },
    { label: 'Page name captured with {word}', pattern: '\\{word\\}', hint: '"the shopper opens the {word} page"' },
    { label: 'Money as a decimal parameter', pattern: '\\{(bigdecimal|double|float)\\}', hint: '"the item total is ${bigdecimal}" with a BigDecimal parameter' },
    { label: 'No hard-coded counts in annotations', pattern: '@\\w+\\(\\s*"[^"]*\\b\\d+\\s+(item|product)s?\\b[^"]*"', mustNot: true, hint: 'Replace "1 item" / "3 items" with {int} item(s).' },
    { label: 'No hard-coded page names in annotations', pattern: '@\\w+\\(\\s*"[^"]*opens the (cart|checkout) page', mustNot: true, hint: 'One method with {word} replaces both.' },
  ],
  hints: [
    'Parentheses in a Cucumber expression mean "optional": item(s) matches item and items.',
    'A slash means "either word": shows/displays. No spaces around the slash.',
    '{word} matches one word without quotes; {bigdecimal} is the safest type for money.',
  ],
  explanation: `Cucumber expressions give you three ways to absorb natural variation without regex:

| Feature | Syntax | Matches |
|---|---|---|
| Optional text | \`item(s)\` | item, items |
| Alternative text | \`shows/displays\` | shows, displays |
| Parameter | \`{int}\`, \`{word}\`, \`{bigdecimal}\`… | a value passed to the method |

\`{word}\` captures a single word **without** quotes — fine for a small fixed vocabulary like page names; for free text use \`{string}\`.
For money prefer \`{bigdecimal}\` (\`java.math.BigDecimal\`): \`double\` cannot represent 39.98 exactly, so compare BigDecimals with \`compareTo\`.
The \`$\` is plain text in a Cucumber expression; only \`( ) { } /\` and the backslash are special.

Fewer, more flexible steps mean fewer ambiguous matches and a smaller glue layer to maintain.`,
  mistakes: [
    'Writing "item (s)" with a space — that matches "item s", not "items".',
    'Using {string} for the page name, which then requires quotes in the feature file.',
    'Using {float}/{double} for money and comparing with assertEquals — rounding errors like 39.980000000000004.',
    'Escaping the dollar sign with a backslash as if it were regex — in a Cucumber expression $ is plain text.',
  ],
  interview: [
    { q: 'How do you make one step match "1 item" and "3 items"?', a: 'Use optional text in the Cucumber expression: "{int} item(s)". For different words use alternatives: "shows/displays".' },
    { q: 'Which built-in parameter types do Cucumber expressions offer?', a: '{int}, {long}, {byte}, {short}, {float}, {double}, {biginteger}, {bigdecimal}, {word}, {string} and the anonymous {}. You can add your own with @ParameterType.' },
  ],
}
