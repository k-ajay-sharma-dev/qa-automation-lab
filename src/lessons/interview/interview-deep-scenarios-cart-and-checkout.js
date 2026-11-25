export default {
  slug: 'interview-deep-scenarios-cart-and-checkout',
  category: 'interview',
  order: 10,
  title: `Deep dive: real project scenarios 2 — cart, checkout, pricing and payment simulation`,
  minutes: 45,
  summary: `Cart, totals and rounding, coupons, checkout form and payment, automated in Selenium-Java and Playwright-TypeScript: discriminating money data, known defects as executable tests, WireMock and route mocking for approved, declined, timeout and 3-D Secure, idempotency and double clicks, API and SQL checks, failures and 60-second answers.`,
  manualAnalogy: `A good manual tester recalculates the bill with a pen, presses Pay twice on purpose and pulls the network cable in the middle. This lesson keeps exactly those habits; it only decides which of them belongs in the browser, which in the API and which in a query over all orders.`,
  body: `## What this lesson covers, and what ShopEasy really has

Cart and checkout are where interviewers look for judgement: money, state and double actions. The ten-part scheme and the shared plumbing (\`ApiWorld\`, \`SuiteDb\`, \`guest()\`, the \`e2e\` fixtures, the tag \`@real-app\`) come from lesson 1 of this series, \`interview-deep-scenarios-account-and-catalog\`. Java imports are left out again.

| Topic | Web shop (5180) | API (5181) |
|---|---|---|
| Cart | one of each product, quantity fixed at 1, stored in \`sessionStorage\` | quantity 1–10, cart belongs to the *user*, not to the token |
| Change quantity | no | no update call: remove, then add |
| Stock | red tee can be added | only \`stock === 0\` is refused, only in \`POST /cart/items\`; stock never decreases |
| Tax | 8 % of the subtotal, rounded to cents | the same rule, written a second time |
| Coupons | box on \`dynamic.html\`, only a message; a "BRIGHT25" banner | none |
| Delivery form | first problem only | all problems together |
| Payment | none | none |

So coupons that change money, payment and database checks are **typical real app (illustrative)**. Code for them compiles against the two frameworks but has no ShopEasy page to run on.

## 1. Cart

### Business rules and risks

| Rule | Risk if broken |
|---|---|
| Adding, removing, badge and list always agree | lost sales; the customer orders the wrong thing |
| Cart survives reload (UI: same tab; API: every device of the user) | "my cart is empty", the most expensive complaint in e-commerce |
| Quantity is a whole number 1–10 (API) | negative totals, accidental bulk orders |
| A refused change changes nothing | half-updated cart |
| The price is the catalogue price at the time of *reading* the cart | old price charged; decide with the owner what happens on a change |
| Not more than in stock | overselling |

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| C1 | add two, badge and lines agree | positive | P1 | UI smoke | yes |
| C2 | remove first / last; empty message; checkout disabled | positive | P1 | UI | yes |
| C3 | reload, Back, second tab | boundary | P2 | UI | yes |
| C4 | quantity −1, 0, 1, 10, 11, 2.5, "2" | boundary | P1 | API | yes |
| C5 | change quantity = remove + add | positive | P2 | API | yes |
| C6 | other device, same user | positive | P1 | API | yes |
| C7 | two simultaneous adds: one line | race | P1 | API | yes |
| C8 | product no longer sold | negative | P2 | UI (**known gap**) | yes, expected to fail |
| C9 | sold-out product | negative | P1 | API 422; UI **gap** | yes |
| C10 | guest cart merged after login | positive | P1 | API + DB | real app |
| C11 | price changed while in the cart: notice and new total | race | P1 | UI + API + DB | real app |
| C12 | another user's cart | security | P1 | API | yes (token decides; there is no cart id) |
| C13 | 100 lines, long names | performance, layout | P3 | – | load / visual |

### Gherkin

\`\`\`gherkin
  Scenario: The cart survives a reload
    Given I am signed in with these products in my cart:
      | Pulse Bike Light    |
      | Storm Fleece Jacket |
    When I reload the page
    Then the cart badge shows 2
    And every cart line shows the catalogue price

  @known-defect
  Scenario: A product that is no longer sold is not counted
    Given my cart still holds a product that is no longer sold
    Then the cart badge shows 0
    And I cannot check out
\`\`\`

### Selenium and Java

Add to \`CartPage\`:

\`\`\`java
    public BigDecimal priceOf(Product product) {
        return Prices.parse(text(By.xpath("//li[@data-testid='cart-item'][.//button[@id='remove-" + product.slug()
                + "']]//*[@data-testid='inventory-item-price']")));
    }
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CartStateSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class CartStateSteps {

    private static final Product DISCONTINUED =
            new Product("discontinued-mug", "Discontinued Mug", new BigDecimal("4.99"), "");

    private final SessionSeeder seeder;
    private final CartPage cartPage;
    private final Tabs tabs;
    private final ScenarioContext context;

    public CartStateSteps(SessionSeeder seeder, CartPage cartPage, Tabs tabs, ScenarioContext context) {
        this.seeder = seeder;
        this.cartPage = cartPage;
        this.tabs = tabs;
        this.context = context;
    }

    @Given("my cart still holds a product that is no longer sold")
    public void cartWithDiscontinuedProduct() {
        seeder.signIn(Settings.current().user(), List.of(DISCONTINUED));
        cartPage.open();
    }

    @When("I reload the page")
    public void reload() {
        tabs.reload();
    }

    @Then("every cart line shows the catalogue price")
    public void cartLinesShowCataloguePrices() {
        cartPage.open();
        for (Product product : context.cart()) {
            assertThat(cartPage.priceOf(product)).as(product.name()).isEqualByComparingTo(product.price());
        }
    }
}
\`\`\`

\`Tabs.reload()\` is the small component of lesson 1. The state is seeded, so each scenario spends its time on its own rule. \`@known-defect\` scenarios are excluded from the normal run and executed nightly with \`-Dcucumber.filter.tags="@known-defect"\`; when one turns green, the tag goes.

### Playwright and TypeScript

Add to \`CartPage\`:

\`\`\`ts
  line(product: Product): { name: Locator; price: Locator; quantity: Locator } {
    const root = this.page.getByTestId('cart-item').filter({ has: this.page.getByTestId(\`remove-\${product.slug}\`) });
    return {
      name: root.getByTestId('inventory-item-name'),
      price: root.getByTestId('inventory-item-price'),
      quantity: root.getByTestId('item-quantity'),
    };
  }
\`\`\`

**\`tests/ui/cart-state.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { products, type Product } from '@domain/catalogue';
import { usd } from '@domain/money';
import { CartPage } from '@ui/pages/cart-page';

const { bikeLight, fleece } = products;
const discontinued: Product = { id: 999, slug: 'discontinued-mug', name: 'Discontinued Mug', price: 4.99, description: '' };

test.describe('a cart with two products', () => {
  test.use({ startingCart: { products: [bikeLight, fleece] } });

  test('each line shows name, price and quantity 1', async ({ cartPage }) => {
    await cartPage.open();
    for (const product of [bikeLight, fleece]) {
      await expect.soft(cartPage.line(product).name).toHaveText(product.name);
      await expect.soft(cartPage.line(product).price).toHaveText(usd(product.price));
      await expect.soft(cartPage.line(product).quantity).toHaveText('1');
    }
  });

  test('survives a reload and the Back button, but not a new tab', async ({ page, context, cartPage, inventoryPage }) => {
    await inventoryPage.open();
    await cartPage.open();
    await page.reload();
    await expect(cartPage.header).toShowCartCount(2);
    await page.goBack();
    await expect(inventoryPage.header).toShowCartCount(2);

    const otherTab = new CartPage(await context.newPage());
    await otherTab.open();
    await expect(otherTab.emptyMessage).toBeVisible();
  });

  test('removing the first product keeps the second', async ({ cartPage }) => {
    await cartPage.open();
    await cartPage.remove(bikeLight);
    await expect(cartPage.lineNames).toHaveText([fleece.name]);
    await expect(cartPage.header).toShowCartCount(1);
    await expect(cartPage.checkoutButton).toBeEnabled();
  });
});

test.describe('a product that is no longer sold', () => {
  test.use({ startingCart: { products: [discontinued] } });

  test('is not counted and cannot be ordered', async ({ cartPage }) => {
    test.fail(true, 'known gap: badge 1, empty list without a message, checkout enabled');
    await cartPage.open();
    await expect(cartPage.lineNames).toHaveCount(0);
    await expect(cartPage.header).toShowCartCount(0);
  });
});
\`\`\`

\`test.fail\` is the Playwright form of the same idea, and stricter: the test *must* fail, so a fix turns the run red and the annotation has to be removed.

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/CartApiTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class CartApiTest extends BaseApiTest {

    private static final int BACKPACK = 1, BIKE_LIGHT = 2;

    @DataProvider
    public Object[][] quantities() {
        return new Object[][] {{-1, 422}, {0, 422}, {1, 201}, {10, 201}, {11, 422}, {2.5, 422}, {"2", 422}};
    }

    @Test(dataProvider = "quantities")
    public void quantityIsAWholeNumberFromOneToTen(Object quantity, int status) {
        me().cart().addRaw(Map.of("productId", BACKPACK, "quantity", quantity)).then().statusCode(status);
        assertThat(me().cart().get().items()).hasSize(status == 201 ? 1 : 0);      // a refusal changes nothing
    }

    @Test(description = "The API has no 'change quantity': add refuses a second time, so a client removes and adds")
    public void changingAQuantityIsRemoveAndAdd() {
        me().cart().add(BACKPACK, 2);
        me().cart().addRaw(new AddItem(BACKPACK, 3)).then()
                .statusCode(409).body("error.code", equalTo("ITEM_ALREADY_IN_CART"));
        me().cart().remove(BACKPACK);
        Cart cart = me().cart().add(BACKPACK, 3);
        assertThat(BigDecimal.valueOf(cart.subtotal())).isEqualByComparingTo("89.97");
    }

    @Test
    public void theCartFollowsTheCustomerToAnotherDevice() {
        NewUser data = UserBuilder.aCustomer().build();
        CustomerSession phone = api.newCustomer(data);
        phone.cart().add(BIKE_LIGHT, 1);

        CustomerSession laptop = api.withToken(api.auth().login(data.username(), data.password()).token());

        assertThat(laptop.cart().get().items()).extracting(CartItem::productId).containsExactly(BIKE_LIGHT);
        laptop.cart().clear();
        assertThat(phone.cart().get().items()).isEmpty();
    }
}
\`\`\`

**\`tests/api/cart.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { products } from '@domain/catalogue';

const { backpack, bikeLight } = products;

for (const quantity of [-1, 0, 11, 2.5]) {
  test(\`quantity \${quantity} is refused and changes nothing\`, async ({ customer }) => {
    expect(await customer.api.cart.add(backpack.id, quantity)).toBeApiError(422, 'INVALID_QUANTITY');
    expect(unwrap(await customer.api.cart.get()).items).toEqual([]);
  });
}

test('changing a quantity is remove and add', async ({ customer }) => {
  unwrap(await customer.api.cart.add(backpack.id, 10));
  expect(await customer.api.cart.add(backpack.id, 1)).toBeApiError(409, 'ITEM_ALREADY_IN_CART');
  unwrap(await customer.api.cart.remove(backpack.id));
  expect(unwrap(await customer.api.cart.add(backpack.id, 3)).subtotal).toBe(89.97);
});

test('two simultaneous adds of one product create one line', async ({ customer }) => {
  const results = await Promise.all([customer.api.cart.add(bikeLight.id), customer.api.cart.add(bikeLight.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(unwrap(await customer.api.cart.get())).toMatchObject({ itemCount: 1, subtotal: 9.99 });
});
\`\`\`

The typed TypeScript client cannot send \`"2"\`; the Java raw call can. That is the division of labour: types protect the happy path, raw requests attack.

### Price change and stock limit (typical real app, illustrative)

Both follow one pattern: *arrange in the UI, change the truth behind its back, continue, expect an honest message.*

\`\`\`ts
await cartPage.open();
await apiContext.patch('/api/admin/products/' + productId, { data: { price: 52.99 } });      // own product, owned by this test
await cartPage.checkoutButton.click();
await expect(page.getByRole('status')).toHaveText('The price of Storm Fleece Jacket has changed to $52.99.');
\`\`\`

The Java counterpart calls the same admin API between two steps; the database user of the tests stays read-only. Never do this with a shared product: forty parallel tests read the same price.

### Database validation (typical real app, illustrative)

\`\`\`sql
-- the badge: number of pieces or number of lines? ask, then assert exactly that
SELECT COUNT(*) AS lines, COALESCE(SUM(ci.quantity), 0) AS pieces
FROM   carts c LEFT JOIN cart_items ci ON ci.cart_id = c.id
WHERE  c.user_id = $1;

-- integrity: one line per product, sensible quantities
SELECT cart_id, product_id, COUNT(*) FROM cart_items GROUP BY cart_id, product_id HAVING COUNT(*) > 1;   -- 0 rows
SELECT * FROM cart_items WHERE quantity NOT BETWEEN 1 AND 10;                                            -- 0 rows
\`\`\`

### Pitfalls and real failures

| Symptom | Cause | Fix |
|---|---|---|
| badge is read as 0 right after "Add" | in a real app the badge follows the response | wait for the expected badge (\`toShowCartCount\` retries; \`Waits.until\` in Java), never read once |
| remove deletes the wrong line | row located by index; the list re-rendered | locate by product (\`remove-<slug>\`) as above |
| \`StaleElementReferenceException\` in a loop over lines | each removal rebuilds the list | remove by name, then assert the remaining names |
| test finds 3 items instead of 1 | shared user, API cart is per user | a new customer per test (\`me()\`, \`customer\` fixture) |
| passes with \`getByRole('button', { name: 'Remove' })\` until two products are in the cart | strict mode: two matches | scope to the line, or use the test id |

### Test data

UI: seed \`sessionStorage\` through \`SessionSeeder\` / \`startingCart\`. API: a new customer per test. Edge products: sold out (id 6), the two 15.99 products, one invented slug for C8.

### How I would explain this in an interview (60 seconds)

> "For the cart I separate display, rules and persistence. The UI proves that badge, lines and empty state agree after add, remove and reload. The quantity matrix and the race of two simultaneous adds run at API level, and every refusal is followed by a read that proves nothing changed. Persistence has two meanings: same tab in this web shop, every device in the API, so I test both. Two gaps I would report: a discontinued product is still counted by the badge, and the page lets me add a sold-out product that the API refuses."

## 2. Subtotal, tax and rounding

### Business rules and risks

Subtotal = sum of price × quantity; tax = 8 % of the **subtotal**, rounded to cents; total = subtotal + tax. Risks: binary floating point, rounding per line instead of per order, truncation, two implementations (page and API) that drift apart, stored values that do not add up.

**Choose data that can fail.** A test price is useful only if the wrong rule gives a different cent:

| Order | Correct tax | Truncated | Rounded per line | What it can detect |
|---|---|---|---|---|
| onesie 7.99 | 0.64 | 0.63 | 0.64 | truncation |
| backpack + bike light 39.98 | 3.20 | 3.19 | 3.20 | truncation |
| 3 backpacks + 3 bike lights + 1 tee 135.93 | 10.87 | 10.87 | **10.88** | per-line rounding |
| fleece 49.99 | 4.00 | 3.99 | 4.00 | truncation |
| half a cent (HALF_UP against HALF_EVEN) | – | – | – | **impossible with 8 %** and whole cents: 8 × c never ends in 50; use another rate in the unit test |

Saying the last line in an interview ("I checked whether my data can tell the rules apart at all") is worth more than ten extra rows.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| T1 | one, two, all products | positive | P1 | UI (3 rows) | yes |
| T2 | discriminating rows of the table above | boundary | P1 | unit + API | yes |
| T3 | quantity 10 | boundary | P2 | API | yes |
| T4 | page and API charge the same | consistency | P1 | E2E | lesson 3 |
| T5 | stored subtotal + tax = total; lines add up | integrity | P1 | DB, whole table | real app |
| T6 | tax-free region, other rates, currencies | positive | P1 | unit + API | real app |
| T7 | number format (\`$1,299.00\`), locale | UI | P3 | UI | 1 row |

### Gherkin

\`\`\`gherkin
@pricing @regression
Feature: Totals

  Scenario Outline: 8% tax on the subtotal, rounded to the cent
    Given I am signed in with these products in my cart:
      | <first>  |
      | <second> |
    And I start the checkout
    When I continue with valid delivery details
    Then the overview shows subtotal $<subtotal>, tax $<tax> and total $<total>

    Examples:
      | first                | second              | subtotal | tax  | total |
      | Classic Crew T-Shirt | Retro Red Tee       | 31.98    | 2.56 | 34.54 |
      | Storm Fleece Jacket  | Junior Onesie       | 57.98    | 4.64 | 62.62 |
\`\`\`

### Selenium and Java

No new steps: \`CheckoutSteps\` already compares an \`OrderTotals\` record. For lines with quantities add to \`OrderTotals\`:

\`\`\`java
    /** For lines with quantities. Rounds once, on the order: rounding per line can differ by a cent. */
    public static OrderTotals expectedFor(Map<Product, Integer> quantities) {
        BigDecimal subtotal = quantities.entrySet().stream()
                .map(line -> line.getKey().price().multiply(BigDecimal.valueOf(line.getValue())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        return new OrderTotals(subtotal, tax, subtotal.add(tax));
    }
\`\`\`

Four rules for \`BigDecimal\` that interviewers probe: create it from a \`String\` (or \`valueOf\`), never \`new BigDecimal(0.1)\`; compare with \`compareTo\` / \`isEqualByComparingTo\`, because \`equals\` distinguishes \`3.2\` from \`3.20\`; give \`setScale\` a rounding mode; do not put \`double\` in between.

### Playwright and TypeScript

**\`tests/ui/totals.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';
import { totalsFor } from '@domain/money';

const { backpack, bikeLight, crewTee, fleece, onesie, redTee } = products;

const carts = [
  [onesie],
  [crewTee, redTee],                                              // two equal prices
  [backpack, bikeLight, crewTee, fleece, onesie, redTee],         // everything: 129.94
];

for (const cart of carts) {
  test.describe(\`a cart of \${cart.length}: \${cart.map((p) => p.slug).join(', ')}\`, () => {
    test.use({ startingCart: { products: cart } });

    test('shows subtotal, 8% tax and total', async ({ checkoutPage }) => {
      await checkoutPage.open();
      await checkoutPage.continueAs(aDelivery());
      await expect(checkoutPage).toShowTotals(totalsFor(cart));
    });
  });
}
\`\`\`

The oracle \`totalsFor\` works in integer cents. JavaScript's \`toFixed\` on floats happens to agree with it for every cart this shop can build (all 63 product sets were compared), which is exactly why nobody notices the risk until a price such as 1.005 arrives.

### Literal, computed or both?

| Oracle | Detects a wrong rule in the app | Detects a wrong rule in the test | Cost per case |
|---|---|---|---|
| literals agreed with the business | yes | reviewed by humans | high |
| own formula (\`OrderTotals\`, \`totalsFor\`) | yes, if written independently | no | low |
| the application's other channel (API for UI) | only a drift | no | low |
| property (subtotal + tax = total) | partly | no | lowest, works on production data |

**Recommended:** a few literals at API level (they pin the rule), the formula for many UI carts, the property as SQL over all orders.

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/PricingApiTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class PricingApiTest extends BaseApiTest {

    private static final Customer BUYER = new Customer("Asha", "Rao", "560001");

    @DataProvider
    public Object[][] orders() {
        return new Object[][] {
                // literals agreed with the business, not a copy of the application's formula
                {List.of(new AddItem(5, 1)),                                           "7.99",   "0.64",  "8.63"},
                {List.of(new AddItem(1, 1), new AddItem(2, 1)),                        "39.98",  "3.20",  "43.18"},   // truncating gives 3.19
                {List.of(new AddItem(1, 3), new AddItem(2, 3), new AddItem(3, 1)),     "135.93", "10.87", "146.80"},  // per line gives 10.88
                {List.of(new AddItem(4, 10)),                                          "499.90", "39.99", "539.89"},
        };
    }

    @Test(dataProvider = "orders")
    public void taxIsEightPercentOfTheOrderRoundedOnce(List<AddItem> items, String subtotal, String tax, String total) {
        Order order = me().orders().place(OrderRequest.withItems(BUYER, items));
        assertThat(BigDecimal.valueOf(order.subtotal())).isEqualByComparingTo(subtotal);
        assertThat(BigDecimal.valueOf(order.tax())).isEqualByComparingTo(tax);
        assertThat(BigDecimal.valueOf(order.total())).isEqualByComparingTo(total);
    }
}
\`\`\`

**\`tests/api/pricing.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products, type Product } from '@domain/catalogue';

const { backpack, bikeLight, crewTee, fleece } = products;

const rows: { lines: [Product, number][]; totals: { subtotal: number; tax: number; total: number } }[] = [
  { lines: [[backpack, 1], [bikeLight, 1]], totals: { subtotal: 39.98, tax: 3.2, total: 43.18 } },
  { lines: [[backpack, 3], [bikeLight, 3], [crewTee, 1]], totals: { subtotal: 135.93, tax: 10.87, total: 146.8 } },
  { lines: [[fleece, 10]], totals: { subtotal: 499.9, tax: 39.99, total: 539.89 } },
];

for (const { lines, totals } of rows) {
  test(\`an order of \${totals.subtotal} costs \${totals.total}\`, async ({ customer }) => {
    for (const [product, quantity] of lines) unwrap(await customer.api.cart.add(product.id, quantity));
    expect(unwrap(await customer.api.orders.place(aDelivery()))).toMatchObject(totals);
  });
}
\`\`\`

### Database validation (typical real app, illustrative)

\`\`\`sql
-- every stored order: lines add up, tax is 8 % once, total is the sum
SELECT o.id, o.subtotal, SUM(i.line_total) AS lines, o.tax, ROUND(o.subtotal * 0.08, 2) AS expected_tax, o.total
FROM   orders o JOIN order_items i ON i.order_id = o.id
GROUP  BY o.id, o.subtotal, o.tax, o.total
HAVING o.subtotal <> SUM(i.line_total)
    OR o.tax      <> ROUND(o.subtotal * 0.08, 2)
    OR o.total    <> o.subtotal + o.tax;
\`\`\`

On the seed data of the SQL lesson this finds order 1005, one cent short. \`ROUND\` on \`numeric\` rounds half away from zero in PostgreSQL; on \`double precision\` it may not. Money columns are \`NUMERIC\`, and a schema check should say so.

### Pitfalls and real failures

- **Two messages from one bug.** \`expected 3.2 but was 3.20\` is a comparison bug in the test; \`3.19\` instead of \`3.20\` is the product.
- **Reading totals too early**: the overview appears first, numbers a moment later in a real app. Read all three inside one wait and compare one record, so the report shows the complete picture.
- **Fixed example, changed price**: literals break on a price change. Keep literals with *seeded* products; compute for catalogue products.
- **Tax rate from the same config as the app**: then the test follows every wrong change. The expected rate is written in the test.

### Test data

Prices are chosen for their remainder, not at random. One product with a price below one dollar, one above a thousand, if the shop has them.

### How I would explain this in an interview (60 seconds)

> "Money is tested at three levels. Unit tests own the rounding rule. At API level I have a few rows agreed with the business that can tell right from wrong: one where truncation differs, one where rounding per line differs from rounding per order. In the UI I only prove that the page shows what the rule says for one, two and all products. Expected values use BigDecimal in Java and integer cents in TypeScript. And one SQL query checks the invariant on all stored orders, because a wrong cent in production is found by accounting otherwise."

## 3. Coupons and discounts

### Business rules and risks

The practice coupon box accepts \`SAVE10\` (spaces and case ignored) and shows a message; it changes no price. The banner advertises \`BRIGHT25\`, which the box calls invalid: **report it**. A typical real rule set: percentage or amount, minimum order value, validity, once per customer, not combinable, **tax after discount**, and the discount *divided over the lines* so that a partial return refunds the right amount. Risks: stacking, reuse in parallel, negative totals, guessed codes, a lost cent when dividing.

### Scenarios (typical real app; K1 and K2 on the practice box)

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| K1 | valid, spaces, other case | positive | P2 | UI | yes |
| K2 | invalid, empty | negative | P2 | UI | yes |
| K3 | minimum value: 49.99 / 50.00 / 50.01 | boundary | P1 | API | real app |
| K4 | day before, first second, last second, day after (time zone!) | boundary | P1 | API, test clock | real app |
| K5 | item removed, order falls below the minimum | negative | P1 | API | real app |
| K6 | second use; two parallel uses | race | P1 | API + DB | real app |
| K7 | amount larger than the order: never below zero | boundary | P1 | unit + API | real app |
| K8 | shares add up to the cent | boundary | P1 | unit | yes |
| K9 | many wrong codes in a row are slowed down | security | P2 | API | real app |
| K10 | banner text equals real campaign | content | P2 | – | manual per campaign |

### Gherkin

\`\`\`gherkin
@coupon @regression
Feature: Coupon box

  Scenario Outline: The box answers to a code
    When I try the coupon "<code>"
    Then the coupon box answers "<answer>"

    Examples:
      | code   | answer                  |
      | SAVE10 | Coupon applied: 10% off |
      | save10 | Coupon applied: 10% off |
      | SAVE99 | Invalid coupon          |
\`\`\`

### Selenium and Java

**\`src/main/java/com/shopeasy/e2e/ui/CouponWidget.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** <coupon-widget> on dynamic.html: an open shadow root. It only shows a message; no price changes. */
public final class CouponWidget extends BasePage {

    private static final By HOST = By.id("coupon-widget");

    public CouponWidget(BrowserSession session) {
        super(session, "dynamic.html");
    }

    @Override
    protected By ready() {
        return HOST;
    }

    public String apply(String code) {
        SearchContext shadow = waits.visible(HOST).getShadowRoot();
        shadow.findElement(By.cssSelector("#coupon-code")).clear();
        shadow.findElement(By.cssSelector("#coupon-code")).sendKeys(code);
        shadow.findElement(By.cssSelector("#apply-coupon")).click();
        return waits.until("a coupon message", driver -> {
            String message = shadow.findElement(By.cssSelector("#coupon-message")).getText();
            return message.isEmpty() ? null : message;
        });
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CouponSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class CouponSteps {

    private final CouponWidget widget;
    private String answer;

    public CouponSteps(CouponWidget widget) {
        this.widget = widget;
    }

    @When("I try the coupon {string}")
    public void tryCoupon(String code) {
        widget.open();
        answer = widget.apply(code);
    }

    @Then("the coupon box answers {string}")
    public void answers(String expected) {
        assertThat(answer).isEqualTo(expected);
    }
}
\`\`\`

The widget is an *open shadow root*: Selenium needs \`getShadowRoot()\` and CSS selectors inside it.

**\`src/main/java/com/shopeasy/e2e/data/Discount.java\`**

\`\`\`java
package com.shopeasy.e2e.data;

/** Splits an order discount over the lines so that the shares add up to the cent (largest remainder). */
public final class Discount {

    private Discount() {
    }

    public static List<Long> split(long discountCents, List<Long> lineCents) {
        long subtotal = lineCents.stream().mapToLong(Long::longValue).sum();
        long[] shares = lineCents.stream().mapToLong(line -> discountCents * line / subtotal).toArray();
        long rest = discountCents - IntStream.range(0, shares.length).mapToLong(i -> shares[i]).sum();
        IntStream.range(0, shares.length).boxed()
                .sorted(Comparator.comparing((Integer i) -> discountCents * lineCents.get(i) % subtotal).reversed())
                .limit(rest)
                .forEach(i -> shares[i]++);
        return IntStream.range(0, shares.length).mapToObj(i -> shares[i]).toList();
    }
}
\`\`\`

Example: 10 % of 47.97 is 4.80 over lines of 29.99, 9.99 and 7.99. Plain rounding down gives 3.00 + 0.99 + 0.79 = 4.78; the two missing cents go to the largest remainders: **3.00, 1.00, 0.80**. The unit test asserts the shares *and* that their sum is 480 cents.

### Playwright and TypeScript

**\`tests/ui/coupon.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';

const codes = [
  { code: 'SAVE10', answer: 'Coupon applied: 10% off' },
  { code: ' save10 ', answer: 'Coupon applied: 10% off' },      // trimmed, case ignored
  { code: 'BRIGHT25', answer: 'Invalid coupon' },               // advertised on the inventory page!
  { code: '', answer: 'Invalid coupon' },
];

for (const { code, answer } of codes) {
  test(\`coupon "\${code}"\`, async ({ page }) => {
    await page.goto('dynamic.html');
    await page.getByLabel('Coupon code').fill(code);             // locators pierce open shadow roots
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('#coupon-message')).toHaveText(answer);
  });
}
\`\`\`

**A real failure from writing this spec:** without \`exact: true\` it failed with \`strict mode violation\`, because the page has a second button "Apply coupon" and accessible names match as substrings. The fix belongs in the locator; \`.first()\` would have clicked whichever button happens to come first.

**\`src/domain/discount.ts\`**

\`\`\`ts
/** Splits an order discount over the lines so that the shares add up to the cent (largest remainder). */
export function splitDiscount(discountCents: number, lineCents: readonly number[]): number[] {
  const subtotal = lineCents.reduce((sum, cents) => sum + cents, 0);
  const shares = lineCents.map((cents) => Math.floor((discountCents * cents) / subtotal));
  let rest = discountCents - shares.reduce((sum, share) => sum + share, 0);
  const byRemainder = lineCents
    .map((cents, index) => ({ index, remainder: (discountCents * cents) % subtotal }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (rest-- <= 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
  }
  return shares;
}
\`\`\`

### API integration (typical real app, illustrative)

\`\`\`java
@Test(groups = "real-app")                       // add to a CouponApiTest extends BaseApiTest
public void aCouponIsUsedOnceEvenInParallel() {
    String code = AdminApi.singleUseCoupon(10);                                     // created by this test
    List<Integer> statuses = Stream.of(me(), anotherCustomer()).parallel()
            .map(buyer -> { buyer.cart().add(1, 1); return buyer.cart().applyCouponRaw(code).statusCode(); })
            .toList();
    assertThat(statuses).containsExactlyInAnyOrder(200, 409);
}
\`\`\`

In B: \`Promise.all([...])\` over two \`newCustomer()\` results and \`expect(statuses.sort()).toEqual([200, 409])\`. \`AdminApi.singleUseCoupon\` and \`applyCouponRaw\` stand for your product's endpoints.

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT coupon_id, COUNT(*) FROM coupon_redemptions GROUP BY coupon_id
HAVING COUNT(*) > (SELECT max_uses FROM coupons WHERE id = coupon_id);            -- 0 rows
SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id, o.discount HAVING SUM(i.discount_share) <> o.discount;              -- 0 rows
\`\`\`

### Pitfalls and real failures

- **The message of the previous code is still there**: after "Invalid coupon" the next assertion may read the old text. \`CouponWidget.apply\` waits for *any* message; a scenario that tries two codes must wait for the *changed* one.
- **Midnight failures**: a coupon "valid today" created with the runner's date and checked with the server's zone. Use a test clock or a validity of ±2 days, and test the border with explicit instants.
- **Order of rules**: 10 % discount before or after tax gives different totals; a scenario without numbers cannot show it.

### Test data

A coupon per test, created by API, with a random code. A shared "TEST10" will be used up, expired or edited by somebody.

### How I would explain this in an interview (60 seconds)

> "A coupon is a small rules engine, so I build a decision table: validity, minimum, uses, combination, and cover the borders at API level with a test clock. The UI only shows accepted, refused and the new total. Two things I always add: two parallel redemptions of a single-use code, and the division over the lines, because returns need each line's share; the largest-remainder method makes it exact. In this practice shop the coupon changes no price and the advertised code is refused, so that is a finding, not a test."

## 4. Checkout form

### Business rules and risks

Required: first name, last name, postal code; postal code \`3–10\` of letters, digits, space and dash; values are trimmed. The web form shows the **first** problem and focuses its field, the API lists **all**. Consequences worth reporting: \`---\` is a valid postal code, and the page lets **a guest with an empty cart finish an order** for $0.00, while the API answers 401 or 422 \`EMPTY_CART\`.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| F1 | each field missing | negative | P1 | UI (exists) + API | yes |
| F2 | spaces only, several problems | negative | P2 | UI + API | yes |
| F3 | postal code 2 / 3 / 10 / 11, dash, underscore, other digits | boundary | P2 | API | yes |
| F4 | corrected value continues, trimmed | positive | P1 | UI | yes |
| F5 | markup in a name is displayed as text | security | P1 | UI | yes |
| F6 | guest, empty cart | security | P1 | UI **gap**, API | yes |
| F7 | cancel, Back, reload keep or lose input as specified | positive | P3 | UI | 1 row |
| F8 | country-specific formats, address lookup | positive | P2 | API | real app |
| F9 | autofill, tab order, screen reader announces the error | accessibility | P2 | – | axe + manual |

### Gherkin

\`\`\`gherkin
  Scenario: A corrected postal code is accepted and trimmed
    When I correct the postal code "56" to " 560001 "
    Then the overview ships to "Asha Rao, 560001"
\`\`\`

In a file of its own, without the \`Background\` of \`checkout.feature\`:

\`\`\`gherkin
@checkout @security
Feature: Checkout needs a customer and a product

  @known-defect
  Scenario: A guest without products cannot place an order
    Given the checkout is opened directly
    Then no order can be placed
\`\`\`

### Selenium and Java

Add to \`CheckoutPage\`:

\`\`\`java
    public boolean canFinish() {
        return all(FINISH).stream().anyMatch(button -> button.isDisplayed() && button.isEnabled());
    }
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/CheckoutGuardSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class CheckoutGuardSteps {

    private final CheckoutPage checkoutPage;

    public CheckoutGuardSteps(CheckoutPage checkoutPage) {
        this.checkoutPage = checkoutPage;
    }

    @Given("the checkout is opened directly")
    public void openedDirectly() {
        checkoutPage.open();
    }

    @When("I correct the postal code {string} to {string}")
    public void correctPostalCode(String wrong, String right) {
        checkoutPage.submit(Customer.valid().postalCode(wrong).build());
        assertThat(checkoutPage.error()).isEqualTo("Error: Postal Code is invalid");
        checkoutPage.submit(Customer.valid().postalCode(right).build());
    }

    @Then("the overview ships to {string}")
    public void shipsTo(String text) {
        assertThat(checkoutPage.totals().subtotal()).isPositive();      // also waits for the overview
        assertThat(checkoutPage.shipTo()).isEqualTo(text);
    }

    @Then("no order can be placed")
    public void noOrderCanBePlaced() {
        checkoutPage.submit(Customer.valid().build());
        assertThat(checkoutPage.canFinish()).as("Finish offered without a customer and without products").isFalse();
    }
}
\`\`\`

### Playwright and TypeScript

**\`tests/ui/checkout-rules.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';

test.describe('with a product in the cart', () => {
  test.use({ startingCart: { products: [products.bikeLight] } });

  test('only the first problem is shown', async ({ checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery({ firstName: '  ', lastName: '', postalCode: '!!' }));
    await expect(checkoutPage.error).toContainText('Error: First Name is required');
    await expect(checkoutPage.firstName).toBeFocused();
  });

  test('a corrected form goes on and trims the input', async ({ checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery({ postalCode: '56' }));
    await expect(checkoutPage.error).toContainText('Error: Postal Code is invalid');
    await checkoutPage.continueAs(aDelivery({ postalCode: ' 560001 ' }));
    await expect(checkoutPage.shipTo).toHaveText('Asha Rao, 560001');
  });

  test('markup in a name is shown as text', { tag: '@security' }, async ({ checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery({ firstName: '<img src=x onerror=alert(1)>' }));
    await expect(checkoutPage.shipTo).toHaveText('<img src=x onerror=alert(1)> Rao, 560001');
  });
});

test.describe('a guest without products', () => {
  test.use({ signedInAs: null });

  test('cannot place an order', async ({ page, checkoutPage }) => {
    test.fail(true, 'known gap: the page asks for neither a session nor a product; the API answers 401 / 422 EMPTY_CART');
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery());
    await expect(page.getByTestId('finish')).toBeHidden();
  });
});
\`\`\`

F5 asserts the text with the markup in it. \`toHaveText\` reads the rendered text, so it fails if the browser created an image element instead. Also listen for \`page.on('dialog')\` when you probe for script execution.

### API integration

**\`shopeasy-api-client: com/shopeasy/api/tests/DeliveryValidationApiTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class DeliveryValidationApiTest extends BaseApiTest {

    @DataProvider
    public Object[][] postalCodes() {
        return new Object[][] {
                {"56", 400}, {"560", 201}, {"1234567890", 201}, {"12345678901", 400},       // 2, 3, 10, 11 characters
                {"SW1A 1AA", 201}, {"  560001  ", 201}, {"560_001", 400}, {"\\u0665\\u0666\\u0660", 400},   // Arabic digits
        };
    }

    @Test(dataProvider = "postalCodes")
    public void postalCodeHasThreeToTenLettersDigitsSpacesOrDashes(String postalCode, int status) {
        me().cart().add(2, 1);
        me().orders().placeRaw(OrderRequest.fromCart("Asha", "Rao", postalCode)).then().statusCode(status);
    }

    @Test(description = "The API names every wrong field; the web form only the first one")
    public void allProblemsAreReportedTogether() {
        me().cart().add(2, 1);
        me().orders().placeRaw(OrderRequest.fromCart(" ", "", "!!")).then()
                .statusCode(400)
                .body("error.code", equalTo("VALIDATION_FAILED"))
                .body("error.details.field", contains("firstName", "lastName", "postalCode"));
    }
}
\`\`\`

In B the same rows are \`expect(await customer.api.orders.place(aDelivery({ postalCode }))).toBeApiError(400, 'VALIDATION_FAILED')\`.

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT id FROM orders WHERE TRIM(first_name) <> first_name OR first_name = '' OR postal_code !~ '^[A-Za-z0-9 -]{3,10}$';
SELECT id FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);     -- orders without lines
\`\`\`

The second query is the production version of F6.

### Pitfalls and real failures

- **\`Enter\` submits**: a test that types and presses Enter also continues; \`Keys.TAB\` leaves the field without submitting.
- **Error assertion passes on the previous error**: wait for the *expected* text. Framework B's \`toContainText\` retries; in Java the scenario above asserts the first message before it corrects.
- **Browser validation bubbles** (\`required\`, \`type=email\`) are not in the DOM; read \`validationMessage\` or assert that the form stayed.
- **Non-ASCII digits**: \`\\d\` matches Arabic digits in some languages and not in others. The row \`٥٦٠\` documents the decision.

### Test data

\`Customer.valid()\` / \`aDelivery()\` with one override. Names: one letter, 100 letters, \`O'Brien\`, \`José\`, Devanagari, markup.

### How I would explain this in an interview (60 seconds)

> "Field rules are API rows; the UI proves presentation: first error, focus, correction, trimming, and that a name with markup is shown as text. Then I ask what protects the page itself. In this shop a guest with an empty cart can finish an order in the browser, while the API refuses. I keep that as a known-defect scenario that must fail today, so the day it is fixed we notice."

## 5. Payment simulation (typical real app, illustrative)

### Business rules and risks

One confirmed payment per order; a declined card creates no order (or an order awaiting payment); an **unknown** outcome (timeout) is neither success nor failure; 3-D Secure may interrupt; card data never reaches our server, log or report. The risk is money: charged twice, charged without an order, order without a charge.

**Safety rules for the tester:** never a real card, not even your own "for one euro". Only test cards published by the provider for its sandbox (for example Stripe's \`4242 4242 4242 4242\`) and only against the sandbox or a stub. A production smoke test uses the process the finance team agreed, not a tester's wallet.

### Where to cut

| Cut | How it works | Advantages | Disadvantages | Speed, complexity | Use for |
|---|---|---|---|---|---|
| Playwright \`route\` on our own payment endpoint | browser gets an invented answer | every outcome, no backend | proves the page only | fastest, low | UI messages, double click |
| WireMock instead of the provider | our real backend calls a stub | real order logic, delays, call counts | stub may differ from provider | fast, medium | outcomes, retries, idempotency |
| provider sandbox | real provider, test cards | real contract, real 3-D Secure pages | slow, shared, sometimes down | slow, medium | a few nightly journeys, contract check |
| payment disabled by a flag | order without payment | simple | tests a path nobody uses | fast, low | nothing important |

**Recommended:** WireMock for the rules, Playwright \`route\` for the page, three to five sandbox journeys per night that also prove that the stubs still look like the provider.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| Y1 | approved: one order, one charge | positive | P1 | UI + API + DB | yes |
| Y2 | declined, insufficient funds, expired: no charge, cart kept, retry possible | negative | P1 | UI + API | yes |
| Y3 | provider hangs or 5xx: "we are checking", reconciliation later | negative | P1 | API + UI | yes |
| Y4 | 3-D Secure approved / refused / window closed | alternative | P1 | UI | yes |
| Y5 | double click, Back and pay again, two tabs | race | P1 | UI + API | yes |
| Y6 | retry uses the same idempotency key; same key with another amount is refused | race | P1 | API | yes |
| Y7 | webhook twice, late, out of order, forged signature | security | P1 | API | yes |
| Y8 | amount changed in the request | security | P1 | API | yes |
| Y9 | no card number in logs, HTML, Allure, trace | security | P1 | scan | yes |
| Y10 | real charge and refund | release | P1 | – | finance process |

### Gherkin

\`\`\`gherkin
@payment @real-app
Feature: Card payment

  Background:
    Given a new customer with these products in the cart:
      | Storm Fleece Jacket |

  Scenario Outline: The customer learns what happened
    Given the bank <answer>
    When the customer pays
    Then the payment page says "<message>"
    And the bank was asked to charge exactly once

    Examples:
      | answer   | message                                         |
      | approves | Thank you for your order!                       |
      | declines | Your card was declined. You have not been charged. |

  Scenario: The bank asks the customer to confirm
    Given the bank asks for verification
    When the customer pays
    And the customer confirms the payment with the bank
    Then the payment page says "Thank you for your order!"

  Scenario: A silent bank is not a refusal
    Given the bank hangs
    When the customer pays
    Then the payment page says "We are checking your payment. You will receive an e-mail."
    And every attempt used the same idempotency key

  Scenario: An impatient customer pays once
    Given the bank approves
    When the customer double-clicks Pay
    Then the payment page says "Thank you for your order!"
    And the bank was asked to charge exactly once
\`\`\`

The background step is in \`JourneySteps\` (lesson 3); it signs the browser in through a cookie.

### Selenium, Java and WireMock

**\`src/test/java/com/shopeasy/e2e/realapp/PaymentGatewayStub.java\`**

\`\`\`java
package com.shopeasy.e2e.realapp;

/** Programs the shared WireMock the shop's order service calls. Every stub matches ONE customer, so scenarios run in parallel. */
public final class PaymentGatewayStub {

    public enum Answer { APPROVES, DECLINES, HANGS, ASKS_FOR_VERIFICATION }

    private static final String CHARGES = "/v1/charges";
    private final WireMock gateway = new WireMock("payment-mock", 8080);

    public void answer(String customerRef, Answer answer) {
        ResponseDefinitionBuilder response = switch (answer) {
            case APPROVES -> okJson("{\\"status\\":\\"APPROVED\\",\\"reference\\":\\"ch_test\\"}");
            case DECLINES -> okJson("{\\"status\\":\\"DECLINED\\",\\"reason\\":\\"INSUFFICIENT_FUNDS\\"}");
            case HANGS -> okJson("{\\"status\\":\\"APPROVED\\"}").withFixedDelay(30_000);
            case ASKS_FOR_VERIFICATION -> okJson("{\\"status\\":\\"REQUIRES_ACTION\\",\\"challengeUrl\\":\\"/3ds/challenge\\"}");
        };
        gateway.register(post(urlPathEqualTo(CHARGES))
                .withRequestBody(matchingJsonPath("$.customerRef", equalTo(customerRef)))
                .willReturn(response));
    }

    public List<LoggedRequest> chargesFor(String customerRef) {
        return gateway.find(postRequestedFor(urlPathEqualTo(CHARGES))
                .withRequestBody(matchingJsonPath("$.customerRef", equalTo(customerRef))));
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/PayPage.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** Typical real app (illustrative): card fields live in the provider's iframe, 3-D Secure in a second one. */
public final class PayPage extends BasePage {

    private static final By CARD_FRAME = By.cssSelector("iframe[title='Secure card payment']");
    private static final By CHALLENGE_FRAME = By.cssSelector("iframe[title='Card verification']");
    private static final By PAY = By.cssSelector("[data-testid='pay']");
    private static final By OUTCOME = By.cssSelector("[data-testid='payment-outcome']");

    private final BrowserSession session;

    public PayPage(BrowserSession session) {
        super(session, "pay");
        this.session = session;
    }

    @Override
    protected By ready() {
        return PAY;
    }

    public void enterTestCard(String number) {
        inFrame(CARD_FRAME, () -> {
            type(By.name("cardnumber"), number);
            type(By.name("exp-date"), "12/34");
            type(By.name("cvc"), "123");
        });
    }

    public void pay() {
        click(PAY);
    }

    public void doubleClickPay() {
        new Actions(session.driver()).doubleClick(waits.clickable(PAY)).perform();
    }

    public void approveChallenge() {
        inFrame(CHALLENGE_FRAME, () -> click(By.id("approve")));
    }

    public String outcome() {
        return text(OUTCOME);
    }

    private void inFrame(By frame, Runnable actions) {
        waits.until(frame + " to be available", ExpectedConditions.frameToBeAvailableAndSwitchToIt(frame));
        try {
            actions.run();
        } finally {
            session.driver().switchTo().defaultContent();      // even after a failure: the screenshot needs the page
        }
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/realapp/PaymentSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.realapp;

public class PaymentSteps {

    private static final String PROVIDER_TEST_CARD = "4242424242424242";      // published by the provider, never a real card

    private final ApiWorld world;
    private final PaymentGatewayStub gateway;
    private final PayPage payPage;

    public PaymentSteps(ApiWorld world, PaymentGatewayStub gateway, PayPage payPage) {
        this.world = world;
        this.gateway = gateway;
        this.payPage = payPage;
    }

    @ParameterType("approves|declines|hangs|asks for verification")
    public Answer bankAnswer(String text) {
        return Answer.valueOf(text.toUpperCase().replace(' ', '_'));
    }

    @Given("the bank {bankAnswer}")
    public void theBank(Answer answer) {
        gateway.answer(customerRef(), answer);
    }

    @When("the customer pays")
    public void pays() {
        payPage.open();
        payPage.enterTestCard(PROVIDER_TEST_CARD);
        payPage.pay();
    }

    @When("the customer double-clicks Pay")
    public void doubleClicks() {
        payPage.open();
        payPage.enterTestCard(PROVIDER_TEST_CARD);
        payPage.doubleClickPay();
    }

    @When("the customer confirms the payment with the bank")
    public void confirms() {
        payPage.approveChallenge();
    }

    @Then("the payment page says {string}")
    public void says(String message) {
        assertThat(payPage.outcome()).isEqualTo(message);
    }

    @Then("the bank was asked to charge exactly once")
    public void chargedOnce() {
        assertThat(gateway.chargesFor(customerRef())).hasSize(1);
    }

    @Then("every attempt used the same idempotency key")
    public void sameKey() {
        assertThat(gateway.chargesFor(customerRef()))
                .extracting((LoggedRequest r) -> r.getHeader("Idempotency-Key")).doesNotContainNull()
                .hasSizeGreaterThan(1).containsOnly(gateway.chargesFor(customerRef()).get(0).getHeader("Idempotency-Key"));
    }

    private String customerRef() {
        return "customer-" + world.customer().user().id();
    }
}
\`\`\`

**Why like this.** The order service under test is started with the stub's address as its provider URL. Stubs are keyed by customer, so parallel scenarios do not answer each other. \`chargesFor\` asks the stub what it *received*: the page can say "once" while the server called twice. \`inFrame\` returns to the page in \`finally\`; otherwise one failure inside the frame makes every later step fail with "no such element".

### Playwright and TypeScript

**\`tests/real-app/payment.spec.ts\`**

\`\`\`ts
// typical real app (illustrative): the page posts to /api/payments and shows 3-D Secure in an iframe
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures/ui';

type Answer = 'approve' | 'decline' | 'time out' | 'ask for 3DS';

async function bankWill(page: Page, answer: Answer): Promise<string[]> {
  const keys: string[] = [];
  await page.route('**/api/payments', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '(no key)');
    switch (answer) {
      case 'approve': return route.fulfill({ status: 201, json: { status: 'APPROVED', orderId: 1001 } });
      case 'decline': return route.fulfill({ status: 402, json: { error: { code: 'CARD_DECLINED', message: 'Declined' } } });
      case 'time out': return route.abort('timedout');
      case 'ask for 3DS': return route.fulfill({ status: 200, json: { status: 'REQUIRES_ACTION', challengeUrl: '/3ds' } });
    }
  });
  return keys;
}

const outcomes: { answer: Answer; message: string | RegExp }[] = [
  { answer: 'approve', message: 'Thank you for your order!' },
  { answer: 'decline', message: 'Your card was declined. You have not been charged.' },
  { answer: 'time out', message: /We are checking your payment/ },      // unknown is NOT "failed, try again"
];

for (const { answer, message } of outcomes) {
  test(\`when the bank will \${answer}\`, { tag: '@real-app' }, async ({ page }) => {
    await bankWill(page, answer);
    await page.goto('pay');
    await page.getByTestId('pay').click();
    await expect(page.getByTestId('payment-outcome')).toHaveText(message);
  });
}

test('3-D Secure is confirmed inside the bank\\'s iframe', { tag: '@real-app' }, async ({ page }) => {
  await bankWill(page, 'ask for 3DS');
  await page.route('**/3ds', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<button onclick="parent.postMessage({ type: \\'3ds\\', result: \\'OK\\' }, \\'*\\')">Approve</button>',
  }));
  await page.goto('pay');
  await page.getByTestId('pay').click();
  await page.frameLocator('iframe[title="Card verification"]').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('payment-outcome')).toHaveText('Thank you for your order!');
});

test('a double click pays once', { tag: '@real-app' }, async ({ page }) => {
  const keys = await bankWill(page, 'approve');
  await page.goto('pay');
  await page.getByTestId('pay').dblclick();
  await expect(page.getByTestId('payment-outcome')).toHaveText('Thank you for your order!');
  expect(new Set(keys).size).toBe(1);        // one request, or two with the SAME key
});
\`\`\`

The frame's answer is simulated with \`postMessage\`, the mechanism most 3-D Secure integrations use. In product code the receiver must check \`event.origin\`; ask for that test in the security review. Provider iframes have generated names: locate by \`title\`, and expect text fields to accept characters slowly (\`pressSequentially\`).

### API integration: idempotency

The real practice API has no payment and **no idempotency key**. This spec documents both facts:

**\`tests/api/duplicate-order.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';

test('ordering one cart twice at the same moment creates one order', async ({ customer }) => {
  unwrap(await customer.api.cart.add(products.backpack.id));
  const results = await Promise.all([customer.api.orders.place(aDelivery()), customer.api.orders.place(aDelivery())]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 422]);        // the second finds an empty cart
});

test('a repeated request with explicit items is one order', async ({ customer }) => {
  test.fail(true, 'known gap: POST /api/orders has no idempotency key');
  const lines = [{ productId: products.bikeLight.id, quantity: 1 }];
  const first = unwrap(await customer.api.orders.placeItems(aDelivery(), lines));
  const retry = unwrap(await customer.api.orders.placeItems(aDelivery(), lines));
  expect(retry.id).toBe(first.id);
});

test('a sold-out product cannot be ordered by going around the cart', async ({ customer }) => {
  test.fail(true, 'known gap: stock is checked in POST /api/cart/items only');
  const lines = [{ productId: products.redTee.id, quantity: 1 }];
  expect(await customer.api.orders.placeItems(aDelivery(), lines)).toBeApiError(422, 'OUT_OF_STOCK');
});
\`\`\`

In a real app the contract is a small table; each row is one test in either stack:

| Request | Expected |
|---|---|
| key K, amount 53.99 | 201, order 17 |
| key K, amount 53.99 again (also in parallel) | 200 or 201, **order 17**, no second charge |
| key K, amount 99.00 | 409 or 422: the key was used for something else |
| new key, same cart, paid already | 409, cart is empty |
| key K after the retention time | defined by the product: write it down |

\`\`\`java
@Test(groups = "real-app")                       // payRaw(order, key) sends the Idempotency-Key header
public void aRetryReturnsTheSameOrder() {
    String key = UUID.randomUUID().toString();
    OrderRequest order = OrderRequest.withItems(new Customer("Asha", "Rao", "560001"), List.of(new AddItem(4, 1)));
    int first = me().orders().payRaw(order, key).then().statusCode(201).extract().path("id");
    int retry = me().orders().payRaw(order, key).then().statusCode(anyOf(is(200), is(201))).extract().path("id");
    assertThat(retry).isEqualTo(first);
}
\`\`\`

### Database validation

\`\`\`sql
-- exactly one captured payment for this order, with the right amount
SELECT p.order_id, COUNT(*) AS captures, SUM(p.amount) AS captured, o.total
FROM   orders o LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'CAPTURED'
WHERE  o.id = $1 GROUP BY p.order_id, o.total;

-- reconciliation over everything: paid orders without payment, payments without order
SELECT o.id AS order_id, p.id AS payment_id
FROM   orders o FULL OUTER JOIN payments p ON p.order_id = o.id
WHERE  o.id IS NULL OR p.id IS NULL;
\`\`\`

On the seed data this shows order 1008 (no payment) and payment 9 (order 1099 does not exist). After a timeout, *poll* for the final state; a single read proves nothing.

### Pitfalls and real failures

| Symptom | Cause | Fix |
|---|---|---|
| "no such element" although the card field is visible | it is inside an iframe, or the driver is still in the last one | \`frameToBeAvailableAndSwitchToIt\`, \`defaultContent()\` in \`finally\`; \`frameLocator\` in Playwright |
| double-click test always green | the button is disabled by the first click, the second never left the browser | test the server too: two API calls with one key |
| declined test fails only in the pipeline | another suite programmed the same stub | match per customer, no global \`reset()\` between scenarios |
| "hangs" test takes 30 s and fails elsewhere | page timeout longer than the test's | set the service's provider timeout low in the test environment, the stub's delay above it |
| sandbox red on Sunday | provider maintenance | classify as environment; the stubbed suite decides the release |
| card number found in Allure | \`sendKeys\` logged by a listener | mask digits in the logger; scan artifacts for 13–19 digit runs |

### Test data

Test cards per outcome come from the provider's documentation and live in one file with a link. Amounts can also steer a sandbox; keep such magic values named (\`DECLINE_AMOUNT\`). Every customer is new, so the idempotency keys and stubs are, too.

### How I would explain this in an interview (60 seconds)

> "I cut payment at two places. In Playwright I mock our own endpoint to test the page: approved, declined, unknown, 3-D Secure in the iframe, double click. For the rules our real backend talks to WireMock instead of the provider, and I ask WireMock what it received: exactly one charge, or retries with the same idempotency key. A timeout is an unknown state, so the page must not say 'try again'. A few sandbox journeys with the provider's test cards run nightly. In the database I reconcile orders and payments. Real cards are never used, and I scan the reports for card numbers."

## Best practices for experienced engineers

- Pick money data that distinguishes right from wrong, and say which wrong rule each row catches.
- After every refusal read the state again. After every success read it through a *second* channel.
- Test double actions where the damage happens: on the server.
- Treat "unknown" as a third outcome in code, tests and messages.
- Keep known defects executable (\`test.fail\`, \`@known-defect\`) with an owner and a ticket, not commented out.
- Own your products, coupons and stubs; change nothing that another test reads.

## Interview questions

### Q: How do you validate the totals in checkout?
**Short answer (30–60 s):** Unit tests for the rule, a few API rows that can detect truncation and per-line rounding, three UI carts, one SQL invariant over all orders; BigDecimal or integer cents everywhere.

**Detailed answer:** Explain with numbers: 135.93 gives 10.87 rounded once and 10.88 rounded per line. Say why 8 % cannot produce half a cent and that another rate is needed to test HALF_UP. Mention comparison by \`compareTo\` and the rate written in the test, not read from the application's configuration.

### Q: How do you test payment without real money?
**Short answer (30–60 s):** Stub the provider behind our backend with WireMock, mock our endpoint for page tests, and run a few sandbox journeys with published test cards.

**Detailed answer:** Compare the cuts (table above). The stub can lie, so nightly sandbox runs and recorded contract examples keep it honest. Verify three sources: page, stub journal (what was requested), database. Real cards are forbidden for legal and practical reasons.

### Q: The user clicks Pay twice. What do you test?
**Short answer (30–60 s):** One order and one charge, however the second request arrives: double click, Back, second tab, network retry.

**Detailed answer:** The UI guard (disabled button) is comfort; the server guard (idempotency key, unique constraint) is correctness. So there is one UI test and one API test with parallel requests, and the assertion is on the number of charges the provider received, plus one row in \`payments\`.

### Q: What is the expected result when the payment provider times out?
**Short answer (30–60 s):** Unknown, not failed. The customer sees "we are checking", the order is pending, and reconciliation decides.

**Detailed answer:** Telling the customer to try again can charge twice. Test: stub delay above the client timeout, page message, order state, retries with one key; then let the stub report success by webhook and poll until the order is paid; and the opposite, where it expires and the stock is released.

### Q: How do you deal with an iframe such as 3-D Secure?
**Short answer (30–60 s):** Selenium: wait for the frame and switch, always return in \`finally\`. Playwright: \`frameLocator\`, no switching.

**Detailed answer:** Locate by title, not index. Cross-origin frames are fine for both tools, but not for JavaScript executed from the page. With a sandbox the challenge page belongs to the provider and may change, so one test only; the others use a stubbed challenge.

### Q: The web shop and the API calculate tax separately. Is that a problem?
**Short answer (30–60 s):** It is a duplicated rule. I keep one cross-check that puts the same cart through both and recommend that only the backend calculates.

**Detailed answer:** Two correct unit-test suites can still disagree after the next change. The cross-check (lesson 3) is cheap and points at drift. The better fix is structural: the page displays what the backend returns, and the amount sent by the browser is never trusted (Y8).

### Q: How do you keep tests for known defects?
**Short answer (30–60 s):** Executable and expected to fail: \`test.fail\` in Playwright, a \`@known-defect\` tag and a separate job in Cucumber.

**Detailed answer:** A skipped test is forgotten; a red one trains people to ignore red. An expected failure is green while the defect lives and turns red when it is fixed. Each has a ticket and a date, and the list is reviewed every sprint.

## Scenario-based questions

**1. Finance reports: 37 orders this month are one cent short.** I ask for the ids and look for what they share: quantities, coupons, a date. I run the invariant query to get the complete list, take one order and recalculate per order and per line. If per-line rounding explains it, I look for the release that introduced it. The regression test is a unit row with exactly these lines, plus the SQL invariant as a nightly check, so the next case is found after one day instead of one month.

**2. The checkout suite fails only between 23:00 and 01:00.** Coupons "valid today" are created with the runner's UTC date and checked with the shop's local date. I prove it by running with another time zone (\`TZ\`, \`timezoneId\`), then make validity relative and wide, and test the border with fixed instants through the test clock. I also ask which zone the business rule means: that question is usually the real finding.

**3. The team wants all payment tests in the provider's sandbox "because mocks are not real".** I agree with the concern and show numbers: duration, failures caused by the sandbox, outcomes it cannot produce (timeouts, duplicate webhooks). Proposal: rules against stubs in every merge request, five sandbox journeys nightly, and a job that compares the stub's answers with recorded sandbox answers.

## Tricky follow-ups

- **\`new BigDecimal(0.1)\` or \`BigDecimal.valueOf(0.1)\`?** The second: the first keeps the binary error.
- **Is POST idempotent if it has an idempotency key?** The method is not; this endpoint becomes safe to retry by contract.
- **Why not disable the button and be done?** Retries by networks and second tabs never touch the button.
- **\`test.fail\` and \`test.skip\`?** \`fail\` runs and must fail; \`skip\` proves nothing.
- **Can I assert "exactly one charge" right after the page says thank you?** For the synchronous charge yes; a late duplicate needs a short observation window (\`during\` in Awaitility).`,
  keyPoints: [
    `A cart has display, rules and persistence: the UI proves display, the API proves quantity limits and races, and every refusal is followed by a read that proves nothing changed.`,
    `Choose prices that can tell the right rule from the wrong one: 39.98 reveals truncation, 135.93 reveals per-line rounding; an 8 % rate can never produce half a cent.`,
    `Money is BigDecimal (compareTo, explicit rounding) or integer cents; literals pin the rule, formulas cover many carts, a SQL invariant watches all orders.`,
    `Discounts must be divided over lines so that the shares add up to the cent (largest remainder); single-use codes need a parallel test.`,
    `Payment is cut at two places: route mocking for the page, WireMock behind the backend for the rules; a few sandbox journeys keep the stubs honest. Only provider test cards.`,
    `A payment timeout is an unknown outcome, not a failure; the page must not invite a second payment and retries must use the same idempotency key.`,
    `Known defects stay executable: test.fail in Playwright, @known-defect in Cucumber, each with an owner.`,
  ],
  mistakes: [
    `Comparing money as double or with BigDecimal.equals, so 3.2 and 3.20 are "different". Fix: BigDecimal from String, isEqualByComparingTo; integer cents in TypeScript.`,
    `Testing tax with a price for which every rounding rule gives the same cent. Fix: calculate the wrong alternatives first and keep only rows where they differ.`,
    `Testing the double click only in the browser; the disabled button hides a server that would charge twice. Fix: two parallel API requests with one idempotency key, and count the charges the stub received.`,
    `Using an own or customer card "just once". Fix: only the provider's published test cards against its sandbox or a stub, and a scan of logs and reports for card numbers.`,
    `Forgetting to leave the iframe after a failure, so each following step reports "no such element". Fix: switch back in finally (Selenium) or use frameLocator (Playwright).`,
    `Changing price, stock or a coupon of shared data in a test. Fix: create the product or coupon inside the test and clean up by age or by run id.`,
  ],
  tryIt: `With the shop and the API running: (1) add \`cart-state.spec.ts\` and \`checkout-rules.spec.ts\`; run them and read how expected failures are reported. Remove one \`test.fail\` and look again. (2) Run \`CartApiTest\` and \`PricingApiTest\`; then change the expected tax of 135.93 to 10.88 and explain which wrong rule you just described. (3) Find by calculation one order of ShopEasy products (quantities 1–10) for which per-line rounding is one cent **lower** than per-order rounding. (4) Remove \`exact: true\` from \`coupon.spec.ts\`, read the strict mode error and write the bug-free locator in two other ways. (5) Write the unit tests of \`splitDiscount\` and \`Discount.split\`: the example, one line, equal lines, discount 0, discount equal to the subtotal. (6) Draw the state diagram of a payment (created, captured, declined, unknown, refunded) and write one test idea per arrow.`,
  problems: ['int-023', 'int-032', 'int-037'],
}
