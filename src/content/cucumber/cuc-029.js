export default {
  id: 'cuc-029',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Typed glue: {product} parameter type, single-column tables and money as BigDecimal',
  level: 'EXPERT',
  tags: ['parameter-type', 'datatabletype', 'picocontainer', 'bigdecimal', 'checkout', 'refactoring'],
  estMinutes: 60,
  scenario: `\`CartSteps\` is the most edited file in the repo and the most fragile. Product names travel as raw \`String\`s, a \`switch\` turns
them into button ids, prices are \`double\`s (a nightly run once failed with "expected 43.18 but was 43.180000000000007"), and the list of added
products is a \`static\` field — so the parallel run mixes up carts. The lead asks for the reference refactoring: **types all the way down**.`,
  description: `Make this scenario pass with typed glue:

\`\`\`gherkin
Scenario: Overview prices and tax follow the cart contents
  Given the shopper has these products in the cart
    | Trailblazer Backpack |
    | Pulse Bike Light     |
    | Junior Onesie        |
  And the shopper has removed Junior Onesie from the cart
  When the shopper checks out as "Asha" "Rao" with postal code "560001"
  Then the overview lists
    | product              | price  |
    | Trailblazer Backpack | $29.99 |
    | Pulse Bike Light     | $9.99  |
  And the item total is $39.98
  And the tax is 8% of the item total
\`\`\`

**Rules**
1. \`Product\` is an **enum** of the six ShopEasy products with display name, slug (\`trailblazer-backpack\` …) and \`BigDecimal\` price.
2. A \`@ParameterType\` named \`product\` matches the six display names → step text \`removed {product} from the cart\` (no quotes).
3. A **cell** \`@DataTableType\` (\`String\` → \`Product\`) lets the first step take \`List<Product>\` from the single-column table.
4. An entry \`@DataTableType\` (\`Map<String,String>\` → \`OverviewLine\`) for the overview table.
5. A scenario-scoped \`CartState\` "world" object (PicoContainer) remembers what is in the cart — **no static fields**.
6. Money is \`BigDecimal\` everywhere (\`{bigdecimal}\` in the expression); the tax is computed from \`CartState\` with \`RoundingMode.HALF_UP\`. No \`double\`.`,
  starterCode: `package com.shopeasy.steps;

import com.shopeasy.pages.CartPage;
import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

import java.util.ArrayList;
import java.util.List;

public class CartSteps {

    public static List<String> addedProducts = new ArrayList<>();
    private final TestContext context;

    public CartSteps(TestContext context) {
        this.context = context;
    }

    @Given("the shopper has these products in the cart")
    public void hasProducts(List<String> names) {
        for (String name : names) {
            switch (name) {
                case "Trailblazer Backpack": new InventoryPage(context.getDriver()).addToCart("trailblazer-backpack"); break;
                case "Pulse Bike Light": new InventoryPage(context.getDriver()).addToCart("pulse-bike-light"); break;
                default: new InventoryPage(context.getDriver()).addToCart("junior-onesie");
            }
            addedProducts.add(name);
        }
    }

    @Then("the item total is \${double}")
    public void itemTotal(double expected) {
        double total = 0;
        for (String p : addedProducts) total += p.equals("Trailblazer Backpack") ? 29.99 : 9.99;
        Assert.assertEquals(new CheckoutPage(context.getDriver()).getItemTotal(), expected);
    }

    // TODO: removed {product}, checks out as, overview lists, tax is 8% of the item total
}
`,
  solution: `// ===== com/shopeasy/model/Product.java =====
package com.shopeasy.model;

import java.math.BigDecimal;
import java.util.Arrays;

public enum Product {
    TRAILBLAZER_BACKPACK("Trailblazer Backpack", "trailblazer-backpack", "29.99"),
    PULSE_BIKE_LIGHT("Pulse Bike Light", "pulse-bike-light", "9.99"),
    CLASSIC_CREW_T_SHIRT("Classic Crew T-Shirt", "classic-crew-t-shirt", "15.99"),
    STORM_FLEECE_JACKET("Storm Fleece Jacket", "storm-fleece-jacket", "49.99"),
    JUNIOR_ONESIE("Junior Onesie", "junior-onesie", "7.99"),
    RETRO_RED_TEE("Retro Red Tee", "retro-red-tee", "15.99");

    private final String displayName;
    private final String slug;
    private final BigDecimal price;

    Product(String displayName, String slug, String price) {
        this.displayName = displayName;
        this.slug = slug;
        this.price = new BigDecimal(price);
    }

    public String displayName() { return displayName; }
    public String slug() { return slug; }
    public BigDecimal price() { return price; }

    public static Product fromDisplayName(String name) {
        return Arrays.stream(values())
                .filter(p -> p.displayName.equals(name.trim()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Not a ShopEasy product: " + name));
    }
}

// ===== com/shopeasy/model/OverviewLine.java =====
package com.shopeasy.model;

import java.math.BigDecimal;

public record OverviewLine(Product product, BigDecimal price) { }

// ===== com/shopeasy/support/CartState.java =====
package com.shopeasy.support;

import com.shopeasy.model.Product;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Scenario-scoped world object: PicoContainer creates one per scenario. */
public class CartState {
    private static final BigDecimal TAX_RATE = new BigDecimal("0.08");
    private final List<Product> products = new ArrayList<>();

    public void add(Product product) { products.add(product); }
    public void remove(Product product) { products.remove(product); }
    public List<Product> products() { return List.copyOf(products); }

    public BigDecimal itemTotal() {
        return products.stream().map(Product::price).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal expectedTax() {
        return itemTotal().multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
    }
}

// ===== com/shopeasy/support/ShopTypes.java =====
package com.shopeasy.support;

import com.shopeasy.model.OverviewLine;
import com.shopeasy.model.Product;
import io.cucumber.java.DataTableType;
import io.cucumber.java.ParameterType;

import java.math.BigDecimal;
import java.util.Map;

public class ShopTypes {

    @ParameterType("Trailblazer Backpack|Pulse Bike Light|Classic Crew T-Shirt|Storm Fleece Jacket|Junior Onesie|Retro Red Tee")
    public Product product(String name) {
        return Product.fromDisplayName(name);
    }

    @DataTableType
    public Product productCell(String cell) {
        return Product.fromDisplayName(cell);
    }

    @DataTableType
    public OverviewLine overviewLine(Map<String, String> row) {
        return new OverviewLine(
                Product.fromDisplayName(row.get("product")),
                new BigDecimal(row.get("price").replace("$", "").trim()));
    }
}

// ===== com/shopeasy/steps/CartSteps.java =====
package com.shopeasy.steps;

import com.shopeasy.model.OverviewLine;
import com.shopeasy.model.Product;
import com.shopeasy.pages.CartPage;
import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.CartState;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

import java.math.BigDecimal;
import java.util.List;

public class CartSteps {

    private final CartState cart;
    private final InventoryPage inventoryPage;
    private final CartPage cartPage;
    private final CheckoutPage checkoutPage;

    public CartSteps(TestContext context, CartState cart) {
        this.cart = cart;
        this.inventoryPage = new InventoryPage(context.getDriver());
        this.cartPage = new CartPage(context.getDriver());
        this.checkoutPage = new CheckoutPage(context.getDriver());
    }

    @Given("the shopper has these products in the cart")
    public void hasProducts(List<Product> products) {
        for (Product product : products) {
            inventoryPage.addToCart(product.slug());
            cart.add(product);
        }
    }

    @Given("the shopper has removed {product} from the cart")
    public void hasRemoved(Product product) {
        inventoryPage.removeFromCart(product.slug());
        cart.remove(product);
    }

    @When("the shopper checks out as {string} {string} with postal code {string}")
    public void checksOutAs(String firstName, String lastName, String postalCode) {
        inventoryPage.openCart();
        cartPage.proceedToCheckout();
        checkoutPage.enterCustomerDetails(firstName, lastName, postalCode);
    }

    @Then("the overview lists")
    public void overviewLists(List<OverviewLine> expected) {
        Assert.assertEquals(checkoutPage.getOverviewLines(), expected, "Checkout overview lines");
    }

    @Then("the item total is \${bigdecimal}")
    public void itemTotalIs(BigDecimal expected) {
        Assert.assertEquals(cart.itemTotal().compareTo(expected), 0, "Cart state total vs scenario");
        Assert.assertEquals(checkoutPage.getItemTotal().compareTo(expected), 0, "Item total on the page");
    }

    @Then("the tax is 8% of the item total")
    public void taxIsEightPercent() {
        BigDecimal expectedTax = cart.expectedTax();          // 39.98 * 0.08 = 3.1984 -> 3.20
        Assert.assertEquals(checkoutPage.getTax().compareTo(expectedTax), 0, "Tax, expected $" + expectedTax);
    }
}

// CheckoutPage.getOverviewLines() builds OverviewLine objects from #overview-list .cart-item (.item-name, .item-price);
// getItemTotal() / getTax() parse #summary-subtotal / #summary-tax into BigDecimal.
`,
  checks: [
    { label: '@ParameterType returns a Product', pattern: '@ParameterType\\s*\\([^)]*\\)\\s*public\\s+Product\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: '@ParameterType("Trailblazer Backpack|Pulse Bike Light|…") public Product product(String name)' },
    { label: 'Step uses {product}', pattern: '@\\w+\\(\\s*"[^"]*\\{product\\}[^"]*"\\s*\\)', hint: '@Given("the shopper has removed {product} from the cart")' },
    { label: 'Cell @DataTableType String -> Product', pattern: '@DataTableType\\s*public\\s+Product\\s+\\w+\\s*\\(\\s*String\\s+\\w+\\s*\\)', hint: '@DataTableType public Product productCell(String cell)' },
    { label: 'Table step takes List<Product>', pattern: 'public\\s+void\\s+\\w+\\s*\\(\\s*List<\\s*Product\\s*>\\s+\\w+\\s*\\)', hint: 'public void hasProducts(List<Product> products)' },
    { label: 'Money as BigDecimal with {bigdecimal}', pattern: '^(?=[\\s\\S]*\\{bigdecimal\\})(?=[\\s\\S]*\\(\\s*BigDecimal\\s+\\w+\\s*\\))', hint: '"the item total is ${bigdecimal}" with a BigDecimal parameter' },
    { label: 'CartState injected into CartSteps', pattern: 'public\\s+CartSteps\\s*\\([^)]*\\bCartState\\s+\\w+[^)]*\\)', hint: 'public CartSteps(TestContext context, CartState cart)' },
    { label: 'No double money and no static mutable state', pattern: '\\bdouble\\b|\\{double\\}|\\{float\\}|\\bstatic\\s+(?!final\\b)[\\w<>,\\s]+\\s+\\w+\\s*=', mustNot: true, hint: 'BigDecimal for money; cart contents live in the injected CartState.' },
  ],
  hints: [
    'Three registries, three annotations: @ParameterType for step text, @DataTableType(String) for single cells, @DataTableType(Map) for rows with a header.',
    'A single-column table with no header + a cell transformer for Product = List<Product> in the step. Do NOT also register an entry transformer for Product.',
    'PicoContainer can inject several objects: public CartSteps(TestContext context, CartState cart). Each is created once per scenario.',
  ],
  explanation: `This is what a mature Cucumber glue layer looks like — the step methods contain **no parsing and no mapping**:

| Concern | Where it lives |
|---|---|
| "Pulse Bike Light" in step text → \`Product\` | \`@ParameterType\` \`{product}\` |
| a cell of a one-column table → \`Product\` | cell \`@DataTableType\` (String) |
| a row with headers → \`OverviewLine\` | entry \`@DataTableType\` (Map) |
| "$39.98" → \`BigDecimal\` | \`{bigdecimal}\` (the \`$\` is literal text) |
| what is in the cart *in this scenario* | \`CartState\` injected by PicoContainer |
| slug, price, display name | the \`Product\` enum (single source of truth) |

Why BigDecimal: \`29.99 + 9.99\` in \`double\` is \`39.980000000000004\`. \`BigDecimal("29.99")\` is exact; tax uses
\`setScale(2, RoundingMode.HALF_UP)\` to mirror the shop's rounding (3.1984 → 3.20). Compare with \`compareTo\` (\`equals\` also compares scale).

Why \`CartState\` instead of \`static\`: PicoContainer creates one per scenario and hands the same instance to every class that asks for it,
so parallel scenarios each have their own cart. The record \`OverviewLine\` gives you value equality for free, so the whole overview is checked
with one \`assertEquals\` of two lists — and a failure prints both lists.

An unknown product name fails at the parameter type (undefined step) or in \`fromDisplayName\` with a clear message — never a silent default branch.`,
  mistakes: [
    'Registering both a cell and an entry transformer for Product — Cucumber cannot decide how to convert the table.',
    'Comparing BigDecimals with equals: new BigDecimal("39.98").equals(new BigDecimal("39.980")) is false — use compareTo.',
    'Building BigDecimal from a double (new BigDecimal(29.99)) — it carries the binary error; use the String constructor.',
    'Keeping a static list "just for now" — the first parallel run mixes carts between scenarios.',
  ],
  interview: [
    { q: 'What different type registries does Cucumber JVM offer?', a: '@ParameterType for values inside step text, @DataTableType for table cells, rows and entries, @DocStringType for doc strings, plus default transformers (e.g. Jackson-based) for anything else. They let step methods receive domain objects.' },
    { q: 'Why should money never be a double in tests?', a: 'Binary floating point cannot represent most decimal amounts exactly, so sums drift (39.980000000000004) and equality checks fail randomly. BigDecimal from strings with explicit rounding mirrors how shops calculate money.' },
    { q: 'How do you design scenario state in a large Cucumber project?', a: 'Small, typed, scenario-scoped world objects (CartState, UserState, ApiContext) injected by PicoContainer into the step classes that need them, instead of a single giant map or static fields.' },
  ],
}
