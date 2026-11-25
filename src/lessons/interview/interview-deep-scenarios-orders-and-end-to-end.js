export default {
  slug: 'interview-deep-scenarios-orders-and-end-to-end',
  category: 'interview',
  order: 11,
  title: `Deep dive: real project scenarios 3 — order confirmation, order history, returns and the full end-to-end journey`,
  minutes: 45,
  summary: `Confirmation, history, cancellation and refunds, e-mails and PDF invoices, eventual consistency and the last item in stock, the complete UI + API + DB journey in both stacks, then the lead view: pyramid split, traceability matrix, suite selection, and a "customers are charged twice" investigation through SQL, logs and stubs.`,
  manualAnalogy: `After a manual checkout you opened the order list, the mailbox, the invoice and sometimes a query window to see whether all of them told the same story. This lesson automates that comparison, and then does what a test lead does with the results: decide what to run, show what is not covered, and investigate when production disagrees.`,
  body: `## What this lesson covers, and what ShopEasy really has

The last part of the shop — what happens *after* the click — and the view of a lead: one end-to-end test through all layers, the split of the whole shop over the pyramid, traceability, suites, and a production incident. Plumbing (\`ApiWorld\`, \`SuiteDb\`, \`e2e\` fixtures, \`@real-app\`) comes from lesson 1 (\`interview-deep-scenarios-account-and-catalog\`), the totals and payment parts from lesson 2 (\`interview-deep-scenarios-cart-and-checkout\`). Java imports are left out.

| Topic | Web shop (5180) | API (5181) |
|---|---|---|
| Confirmation | thank-you text and a random \`SE-######\`, made in the browser, stored nowhere | 201 with the stored order and its id |
| History | a *static* list "Recent orders" on \`dynamic.html\` | \`GET /api/orders\`: own orders, oldest first; query parameters are ignored |
| One order | – | \`GET /api/orders/{id}\`, own orders only |
| Status changes | a demo on \`waits.html\` (Pending → Processing → Completed) | status \`PLACED\`, never changes |
| Cancel, return, refund | – | no endpoint (\`DELETE /orders/{id}\` is 405) |
| E-mail, invoice | – | – |
| Stock | – | never decreases (**known gap**) |

Because page and API share nothing, the complete UI + API + DB journey is **typical real app (illustrative)**. What runs today is the "two doors" test: the same purchase through both channels. The Gherkin in sections 3 to 5 is the specification the business reads; the API tests beside it automate it, so it has no step definitions here (mark it @wip until you bind it to your product).

## 1. Order confirmation

### Business rules and risks

Exactly one order per confirmation; the number shown exists in the backend and belongs to the customer; the cart is empty afterwards; reload or Back never orders again. Risks: confirmation without an order (or the opposite), duplicate orders, number guessable and readable by others.

In ShopEasy the number is decoration. An interviewer may ask "how do you verify the order number?" — here only the *format*; the value has no counterpart anywhere. Say so.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| O1 | thank-you, number format, badge 0 | positive | P1 | UI smoke | yes (exists) |
| O2 | reload of the confirmation starts an empty checkout | boundary | P1 | UI | yes |
| O3 | Back Home | positive | P3 | UI | yes |
| O4 | shown number = stored order, amounts equal | integrity | P1 | UI + API + DB | real app |
| O5 | order could not be stored: no thank-you, cart kept | negative | P1 | UI with a mocked 500 | real app |
| O6 | deep link to another customer's confirmation | security | P1 | API 403/404 | real app; API rule exists |
| O7 | print layout | visual | P3 | – | manual |

### Gherkin

\`\`\`gherkin
@orders @regression
Feature: After the order

  Scenario: The confirmation exists once
    Given I am signed in with these products in my cart:
      | Junior Onesie |
    And I start the checkout
    When I continue with valid delivery details
    And I place the order
    Then the order is confirmed
    And reloading the confirmation starts an empty checkout

  Scenario Outline: Each order in the list is tracked by its own button
    Then order <id> is <status> and can be tracked

    Examples:
      | id       | status     |
      | ORD-1041 | Delivered  |
      | ORD-1043 | Processing |

  Scenario: A slow order reaches its final status
    When I place the slow order
    Then its status goes through Processing and ends as Completed
\`\`\`

### Selenium and Java

**\`src/main/java/com/shopeasy/e2e/ui/RecentOrders.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** The static "Recent orders" list on dynamic.html: identical buttons, identified by their row. */
public final class RecentOrders extends BasePage {

    private static final By LIST = By.id("order-list");
    private static final By LAST_ACTION = By.id("dynamic-result");

    public RecentOrders(BrowserSession session) {
        super(session, "dynamic.html");
    }

    @Override
    protected By ready() {
        return LIST;
    }

    public String statusOf(String orderId) {
        return text(inRow(orderId, "span[@class='order-status']"));
    }

    public String track(String orderId) {
        click(inRow(orderId, "button"));
        return text(LAST_ACTION);
    }

    private static By inRow(String orderId, String child) {
        return By.xpath("//ul[@id='order-list']/li[span[@class='order-id'][.='" + orderId + "']]/" + child);
    }
}
\`\`\`

**\`src/main/java/com/shopeasy/e2e/ui/OrderProgress.java\`**

\`\`\`java
package com.shopeasy.e2e.ui;

/** waits.html, section 5: Not started -> Pending -> Processing -> Completed, about four seconds. */
public final class OrderProgress extends BasePage {

    private static final By PLACE = By.id("place-order-btn");
    private static final By STATUS = By.id("order-status");

    public OrderProgress(BrowserSession session) {
        super(session, "waits.html");
    }

    @Override
    protected By ready() {
        return PLACE;
    }

    public void place() {
        click(PLACE);
    }

    public void reaches(String status) {
        waits.until("order status " + status, driver -> text(STATUS).equals(status));
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/OrderScreenSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class OrderScreenSteps {

    private final CheckoutPage checkoutPage;
    private final RecentOrders recentOrders;
    private final OrderProgress progress;
    private final Header header;
    private final Tabs tabs;

    public OrderScreenSteps(CheckoutPage checkoutPage, RecentOrders recentOrders, OrderProgress progress,
                            Header header, Tabs tabs) {
        this.checkoutPage = checkoutPage;
        this.recentOrders = recentOrders;
        this.progress = progress;
        this.header = header;
        this.tabs = tabs;
    }

    @Then("reloading the confirmation starts an empty checkout")
    public void reloadStartsEmptyCheckout() {
        tabs.reload();
        checkoutPage.waitUntilLoaded();
        assertThat(header.cartCount()).isZero();
    }

    @Then("order {word} is {word} and can be tracked")
    public void canBeTracked(String orderId, String status) {
        recentOrders.open();
        assertThat(recentOrders.statusOf(orderId)).isEqualTo(status);
        assertThat(recentOrders.track(orderId)).isEqualTo("Tracking " + orderId);
    }

    @When("I place the slow order")
    public void placeSlowOrder() {
        progress.open();
        progress.place();
    }

    @Then("its status goes through {word} and ends as {word}")
    public void statusGoesThrough(String middle, String last) {
        progress.reaches(middle);
        progress.reaches(last);
    }
}
\`\`\`

### Playwright and TypeScript

**\`tests/ui/order-screens.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/ui';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';

test.describe('confirmation', () => {
  test.use({ startingCart: { products: [products.onesie] } });

  test('exists once: a reload starts an empty checkout', async ({ page, checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery());
    await checkoutPage.finish();
    await expect(checkoutPage.orderNumber).toHaveText(/^SE-\\d{6}$/);

    await page.reload();
    await expect(checkoutPage.confirmation).toBeHidden();
    await expect(checkoutPage.firstName).toBeVisible();
    await expect(checkoutPage.header).toShowCartCount(0);
  });

  test('Back Home leads to the products', async ({ page, checkoutPage, inventoryPage }) => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery());
    await checkoutPage.finish();
    await page.getByTestId('back-to-products').click();
    await expect(inventoryPage.title).toHaveText('Products');
  });
});

test('each row of the recent orders tracks its own order', async ({ page }) => {
  await page.goto('dynamic.html');
  const row = page.locator('#order-list li').filter({ has: page.getByText('ORD-1043', { exact: true }) });
  await expect(row.locator('.order-status')).toHaveText('Processing');
  await row.getByRole('button', { name: 'Track' }).click();
  await expect(page.getByTestId('dynamic-result')).toHaveText('Tracking ORD-1043');
});

test('a slow order goes through Processing and ends as Completed', async ({ page }) => {
  await page.goto('waits.html');
  await page.getByRole('button', { name: 'Place order' }).click();
  const status = page.getByTestId('order-status');
  await expect(status).toHaveText('Processing');
  await expect(status).toHaveText('Completed', { timeout: 8_000 });
});
\`\`\`

The four "Track" buttons have the same name, so the row decides. \`getByText('ORD-1043', { exact: true })\` prevents \`ORD-1043\` from matching a future \`ORD-10431\`.

### API integration

\`POST /api/orders\` then \`GET /api/orders/{id}\` must be equal as a whole (\`two-doors.spec.ts\` below). The negative side: without the order there is no confirmation. In a real app Playwright forces it with \`page.route('**/api/orders', (r) => r.fulfill({ status: 500 }))\`, then asserts an error and a full cart; in Java a WireMock stub plays the order service.

### Database validation (typical real app, illustrative)

\`\`\`sql
SELECT o.status, o.item_count, o.total,
       (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS lines,
       (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id AND p.status = 'CAPTURED') AS captures
FROM   orders o WHERE o.id = $1;                         -- one row; captures = 1
\`\`\`

### Pitfalls and real failures

- **Asserting "Completed" at once**: the text is *Pending* first. Wait for the state, with a limit that follows the business promise (8 s against about 4 s), not a sleep.
- **Intermediate states can be missed**: if *Processing* lasts 100 ms, polling every 500 ms never sees it. Assert intermediate states only when they last long enough, or read the history (\`order_events\`) afterwards.
- **\`SE-######\` in two tests is equal once in a while**: random numbers are no keys. Never use such a number to find data.

### Test data

A new customer per test, so "the only order" is a safe way to find it.

### How I would explain this in an interview (60 seconds)

> "The confirmation page is a claim, so I verify it with a second source: the order in the API, and in the database one row, the right lines, one captured payment. Then reload and Back, because duplicates happen there. In this practice shop the number is generated in the browser, so I check its format and say openly that there is nothing behind it."

## 2. Order history

### Business rules and risks

Only own orders, stable order, complete pages, and each line keeps **the price of the day**. Risks: reading other people's orders (IDOR), lost orders on page borders, history that changes when the catalogue changes.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| H1 | new customer: empty list with a message | boundary | P2 | API, UI | yes (API) |
| H2 | exactly my orders, oldest first, while others order | positive, security | P1 | API | yes |
| H3 | foreign id: 403; unknown id: 404; no token: 401 | security | P1 | API | yes |
| H4 | line price survives a price change | integrity | P1 | API + DB | real app; copy checked |
| H5 | 0, 1, page size, page size + 1 orders | boundary | P2 | API + UI | real app |
| H6 | filter by status and period, time zone at midnight | boundary | P2 | API | real app |
| H7 | 5,000 orders | performance | P2 | – | load test |

### Gherkin

\`\`\`gherkin
  @real-app
  Scenario: A customer sees only their own orders
    Given a new customer with these products in the cart:
      | Storm Fleece Jacket |
    When the customer checks out in the web shop
    Then the order history shows exactly this order
\`\`\`

### Selenium and Java

The UI part is one step on an illustrative \`OrderHistoryPage\`:

\`\`\`java
@Then("the order history shows exactly this order")
public void historyShowsThisOrder() {
    Order order = world.customer().orders().mine().get(0);
    historyPage.open();
    assertThat(historyPage.rows()).containsExactly(new HistoryRow(order.id(), order.status(), order.total()));
}
\`\`\`

### API integration: the rules

**\`shopeasy-api-client: com/shopeasy/api/tests/OrderHistoryApiTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class OrderHistoryApiTest extends BaseApiTest {

    @Test
    public void aNewCustomerHasNoOrders() {
        assertThat(me().orders().mine()).isEmpty();
    }

    @Test
    public void historyHoldsExactlyMyOrdersOldestFirst() {
        Order first = place(1);
        Order second = place(2);
        anotherCustomer().orders().place(order(3));                   // noise that must not appear

        assertThat(me().orders().mine()).isEqualTo(List.of(first, second));
        assertThat(me().orders().byId(first.id())).isEqualTo(first);
    }

    @Test(description = "An order keeps the price of the day: the line is a copy, not a reference")
    public void orderLinesCarryTheirOwnPrice() {
        assertThat(place(4).items()).singleElement()
                .satisfies(line -> assertThat(line.price()).isEqualTo(49.99));
    }

    private Order place(int productId) {
        return me().orders().place(order(productId));
    }

    private static OrderRequest order(int productId) {
        return OrderRequest.withItems(new Customer("Asha", "Rao", "560001"), List.of(new AddItem(productId, 1)));
    }
}
\`\`\`

### Playwright and TypeScript

**\`tests/api/order-history.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/api';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';

const line = (productId: number) => [{ productId, quantity: 1 }];

test('the history holds exactly my orders, oldest first', async ({ newCustomer }) => {
  const [me, stranger] = [await newCustomer(), await newCustomer()];
  expect(unwrap(await me.api.orders.mine()).data).toEqual([]);

  const first = unwrap(await me.api.orders.placeItems(aDelivery(), line(products.backpack.id)));
  unwrap(await stranger.api.orders.placeItems(aDelivery(), line(products.fleece.id)));
  const second = unwrap(await me.api.orders.placeItems(aDelivery(), line(products.onesie.id)));

  expect(unwrap(await me.api.orders.mine()).data).toEqual([first, second]);
});

test('placing an order takes the goods out of stock', async ({ customer, anonymousApi }) => {
  test.fail(true, 'known gap: the practice API never changes stock');
  const before = unwrap(await anonymousApi.products.byId(products.fleece.id)).stock;
  unwrap(await customer.api.orders.placeItems(aDelivery(), line(products.fleece.id)));
  expect(unwrap(await anonymousApi.products.byId(products.fleece.id)).stock).toBe(before - 1);
});
\`\`\`

The stranger's order is the point of the test: without noise, "only mine" is also true for an endpoint that returns everything. And \`toEqual([first, second])\` proves completeness, order and equality at once. \`GET /api/orders?size=1\` returns all orders, because ShopEasy ignores the parameter: a paging test on it would be fiction.

### Database validation (typical real app, illustrative)

\`\`\`sql
-- what the API must return, as an oracle
SELECT id FROM orders WHERE user_id = $1 ORDER BY created_at, id;
-- price of the day: no line may follow the catalogue
SELECT i.order_id, i.price AS paid, p.price AS today
FROM order_items i JOIN products p ON p.id = i.product_id
WHERE i.order_id = $1;                                   -- paid is the order's price, also when today differs
\`\`\`

### Pitfalls and real failures

| Symptom | Cause | Fix |
|---|---|---|
| list has 14 orders instead of 1 | shared user | new customer per test |
| order of two entries flips | same \`created_at\` second, no tie-breaker | sort by time **and** id; a product defect |
| new order missing for a second | read replica or event-driven history | poll for *this id*, never for a count |
| dates differ by one day | browser zone against UTC | fix \`timezoneId\` / JVM zone, compare instants |

### Test data

Create the history through the API: one, page size, page size + 1. Orders with an old date need a seed script or a test clock.

### How I would explain this in an interview (60 seconds)

> "History is an authorisation test disguised as a list. I create two customers, let both order, and require that each gets exactly their own orders in order. Foreign ids are 403. Then completeness across pages and the price of the day: I change the catalogue price and the old order must not move. Most of it is API; the UI shows one row correctly and the empty state."

## 3. Cancellation, returns and refunds (typical real app, illustrative)

### Business rules and risks

Model it as a state machine and the test cases follow:

\`\`\`
PLACED -> PAID -> PACKED -> SHIPPED -> DELIVERED -> RETURN_REQUESTED -> RETURNED -> REFUNDED
   \\________\\________\\-> CANCELLED (-> REFUNDED if paid)
\`\`\`

Rules to ask for: until when is cancelling possible; who may (customer, agent); partial return; return period (30 days from *delivery*, which zone); refund of shipping and of the discount share; when stock is booked back. Risks: refund twice, refund more than paid, goods back in stock before inspection, cancel against ship race.

### Scenarios

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| X1 | cancel in each state: allowed / 409 | transition | P1 | API table | yes |
| X2 | cancel twice, in parallel | race | P1 | API + DB | yes |
| X3 | cancel while the warehouse ships | race | P1 | API + DB | yes |
| X4 | return on day 30 and 31 | boundary | P1 | API, test clock | yes |
| X5 | return 1 of 3 with coupon: refund = its share | calculation | P1 | unit + API | yes |
| X6 | sum of refunds ≤ captured | integrity | P1 | DB | yes |
| X7 | another customer's order | security | P1 | API | yes |
| X8 | button visible only when allowed | UI | P2 | UI, 2 rows | yes |
| X9 | refund arrives on the card statement | release | P2 | – | finance process |

### Gherkin

\`\`\`gherkin
@returns @real-app
Feature: Cancel an order

  Scenario Outline: Cancelling depends on the state
    Given an order in state <state>
    When the customer cancels it
    Then the answer is <status> and the order is <afterwards>

    Examples:
      | state   | status | afterwards |
      | PLACED  | 202    | CANCELLED  |
      | PACKED  | 202    | CANCELLED  |
      | SHIPPED | 409    | SHIPPED    |
\`\`\`

### Java: the transition table

Add to \`OrdersClient\` (the endpoint stands for your product's):

\`\`\`java
public Response cancelRaw(int id) { return given().spec(spec).when().post("/orders/{id}/cancellations", id); }
\`\`\`

**\`shopeasy-api-client: com/shopeasy/api/tests/CancellationTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

/** Typical real app (illustrative): POST /orders/{id}/cancellations. */
public class CancellationTest extends BaseApiTest {

    @DataProvider
    public Object[][] states() {
        return new Object[][] {
                {"PLACED", 202, "CANCELLED"}, {"PAID", 202, "CANCELLED"}, {"PACKED", 202, "CANCELLED"},
                {"SHIPPED", 409, "SHIPPED"}, {"DELIVERED", 409, "DELIVERED"}, {"CANCELLED", 409, "CANCELLED"},
        };
    }

    @Test(dataProvider = "states", groups = "real-app")
    public void cancellingAnOrderInState(String state, int status, String afterwards) {
        int orderId = OrderFixture.in(state, me());               // drives the order there through API and test clock
        me().orders().cancelRaw(orderId).then().statusCode(status);
        me().orders().byIdRaw(orderId).then().body("status", equalTo(afterwards));
        me().orders().cancelRaw(orderId).then().statusCode(409);  // twice never refunds twice
    }
}
\`\`\`

\`OrderFixture.in(state, session)\` is your test-support class that drives an order through the *official* transitions (API calls, stubbed warehouse messages, test clock). Writing the state directly into the database is faster and creates orders that can never exist.

### Selenium and Playwright: what remains for the UI

\`\`\`java
assertThat(orderPage.open(shippedId).canCancel()).isFalse();
assertThat(orderPage.open(placedId).canCancel()).isTrue();
\`\`\`

\`\`\`ts
test('two tabs cancel the same order: one refund', { tag: '@real-app' }, async ({ context, page, placedOrder }) => {
  const other = await context.newPage();
  for (const tab of [page, other]) await tab.goto(\`account/orders/\${placedOrder.id}\`);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByRole('status')).toHaveText('Your order was cancelled.');
  await other.getByRole('button', { name: 'Cancel order' }).click();              // the stale page still shows the button
  await expect(other.getByRole('alert')).toHaveText('This order was already cancelled.');
});
\`\`\`

\`placedOrder\` is an illustrative fixture: a new customer, an order by API, a session cookie. The stale second tab is the realistic version of "button is hidden".

### Database validation

\`\`\`sql
SELECT o.id, o.total,
       SUM(p.amount) FILTER (WHERE p.status = 'CAPTURED') AS captured,
       SUM(p.amount) FILTER (WHERE p.status = 'REFUNDED') AS refunded
FROM   orders o JOIN payments p ON p.order_id = o.id
GROUP  BY o.id, o.total
HAVING COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'REFUNDED'), 0)
     > COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'CAPTURED'), 0);            -- 0 rows
\`\`\`

(Amounts stored as positive numbers; adapt the sign to your schema.)

### Pitfalls and real failures

- **202 is not "done".** Cancelling is often asynchronous: poll the state until \`CANCELLED\` or a deadline, then check the refund. The test above assumes that the state is written before the answer; if not, use Awaitility.
- **Test clock only in one service**: the API believes it is day 31, the refund job does not. Every service must read the same clock.
- **Refund rounding**: three partial refunds of a discounted order must equal the total refund (shares from lesson 2).

### Test data

One order per row, created by the fixture. Never reuse an order between rows: a state machine remembers.

### How I would explain this in an interview (60 seconds)

> "I draw the state machine first: every allowed arrow is a positive test, every other pair is a 409 with an unchanged state. That table runs at API level. Then repetition and races: cancel twice, cancel while shipping, two tabs. Money gets an invariant in SQL: refunds never exceed captures. Time rules like 30 days use a test clock and both sides of the border. In the UI two rows: button there, button not there."

## 4. E-mails and the PDF invoice (typical real app, illustrative)

### Business rules and risks

One mail per order, to the right address, with the right number and amounts, links to the right environment; the invoice is numbered without gaps and equals the order. Risks: two mails, mail to the wrong person, test mails to real customers, wrong amounts in a *legal* document.

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| E1 | one mail, recipient, subject, number, total | positive | P1 | API + mail catcher | yes |
| E2 | no mail for a declined payment | negative | P1 | API + mail catcher | yes |
| E3 | name with markup is escaped | security | P1 | mail body | yes |
| E4 | invoice text: number, lines, tax, total | positive | P1 | PDF text | yes |
| E5 | invoice layout, logo | visual | P3 | – | image diff / manual |
| E6 | other customer opens the invoice URL | security | P1 | API 403 | yes |
| E7 | rendering in mail clients | visual | P3 | – | service / manual |

\`\`\`gherkin
  @real-app
  Scenario: The customer receives one confirmation with the invoice
    Given a customer who placed an order of $62.62
    Then exactly one mail names this order and $62.62
    And its invoice shows subtotal $57.98, tax $4.64 and total $62.62
\`\`\`

### Java

Never send test mail to real addresses: the environment's SMTP server is a catcher such as Mailpit, whose HTTP API the test reads.

**\`shopeasy-api-client: com/shopeasy/api/support/Mailbox.java\`**

\`\`\`java
package com.shopeasy.api.support;

/** Typical real app: the test environment's SMTP server is Mailpit (default HTTP port 8025). */
public final class Mailbox {

    private final String baseUri;

    public Mailbox(String baseUri) {
        this.baseUri = baseUri;
    }

    /** Waits for the first message, then watches a little longer: one mail, not two. */
    public JsonPath onlyMessageTo(String address) {
        await("a mail to " + address).atMost(Duration.ofSeconds(20)).until(() -> !idsTo(address).isEmpty());
        await("no second mail to " + address).during(Duration.ofSeconds(3)).atMost(Duration.ofSeconds(8))
                .until(() -> idsTo(address).size() == 1);
        return given().baseUri(baseUri).get("/api/v1/message/{id}", idsTo(address).get(0)).jsonPath();
    }

    public byte[] attachment(JsonPath message, int index) {
        return given().baseUri(baseUri).get("/api/v1/message/{id}/part/{part}",
                message.getString("ID"), message.getString("Attachments[" + index + "].PartID")).asByteArray();
    }

    private List<String> idsTo(String address) {
        return given().baseUri(baseUri).queryParam("query", "to:" + address)
                .get("/api/v1/search").jsonPath().getList("messages.ID");
    }
}
\`\`\`

**\`shopeasy-api-client: com/shopeasy/api/support/PdfText.java\`**

\`\`\`java
package com.shopeasy.api.support;

/** PDFBox 3: Loader.loadPDF (PDFBox 2 used PDDocument.load). */
public final class PdfText {

    private PdfText() {
    }

    public static String of(byte[] pdf) {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);                    // reading order, not drawing order
            return stripper.getText(document).replaceAll("[\\\\s\\\\u00a0]+", " ");
        } catch (IOException e) {
            throw new UncheckedIOException("not a readable PDF", e);
        }
    }
}
\`\`\`

\`\`\`java
JsonPath mail = mailbox.onlyMessageTo(customer.email());
assertThat(mail.getString("Text")).contains("Order " + order.id(), "$62.62").doesNotContain("localhost");
String invoice = PdfText.of(mailbox.attachment(mail, 0));
assertThat(invoice).contains("Subtotal $57.98", "Tax (8%) $4.64", "Total $62.62", "Order " + order.id());
\`\`\`

Selenium itself has no part here: the browser only triggers the order. For a *download* button, fetch the file's URL with the session cookie instead of driving the PDF viewer.

### Playwright and TypeScript

**\`src/core/mailbox.ts\`**

\`\`\`ts
import { expect, type APIRequestContext } from '@playwright/test';

interface Message { ID: string; Subject: string; Text: string; Attachments: { PartID: string; FileName: string }[] }

/** Typical real app: Mailpit receives every mail of the test environment. */
export class Mailbox {
  constructor(private readonly request: APIRequestContext, private readonly baseUrl: string) {}

  async onlyMessageTo(address: string): Promise<Message> {
    await expect.poll(() => this.idsTo(address), { timeout: 20_000 }).not.toHaveLength(0);
    const [id] = await this.idsTo(address);
    const response = await this.request.get(\`\${this.baseUrl}/api/v1/message/\${id}\`);
    return response.json() as Promise<Message>;
  }

  async idsTo(address: string): Promise<string[]> {
    const response = await this.request.get(\`\${this.baseUrl}/api/v1/search\`, { params: { query: \`to:\${address}\` } });
    const { messages } = await response.json() as { messages: { ID: string }[] };
    return messages.map((message) => message.ID);
  }
}
\`\`\`

\`\`\`ts
const mail = await new Mailbox(apiContext, env.MAIL_URL).onlyMessageTo(customer.email);      // MAIL_URL: new env key
expect(mail.Text).toContain(\`Order \${order.id}\`);
expect(await mailbox.idsTo(customer.email)).toHaveLength(1);

const download = page.waitForEvent('download');
await page.getByRole('link', { name: 'Invoice' }).click();
expect((await download).suggestedFilename()).toBe(\`invoice-\${order.id}.pdf\`);
\`\`\`

### API and database

\`\`\`sql
SELECT order_id, COUNT(*) FROM outbox WHERE type = 'ORDER_CONFIRMATION' GROUP BY order_id HAVING COUNT(*) <> 1;
SELECT COUNT(*) AS rows, MAX(invoice_no) - MIN(invoice_no) + 1 AS expected FROM invoices;        -- equal: no gap
\`\`\`

### Pitfalls and real failures

- **"Exactly one" needs time.** \`onlyMessageTo\` waits for the first mail and then watches three more seconds; without that, a duplicate that arrives later is never seen.
- **Search by recipient, not "newest mail"**: parallel tests share the catcher, so every customer has a unique address.
- **PDF text is drawing order**: without \`setSortByPosition(true)\` columns mix. Line breaks, ligatures and no-break spaces need normalising; a *scanned* PDF has no text at all.
- **Mail HTML and text part differ**: check the amounts in both.

**Test data:** one new customer with a unique address per test; an order whose amounts you can calculate (57.98 + 4.64); one customer called \`<b>Asha</b>\` for E3.

### How I would explain this in an interview (60 seconds)

> "Mails go to a catcher in the test environment, and I read it through its API by a unique recipient. I assert exactly one mail, with an observation window for duplicates, plus number, amount and links. For the PDF I extract text with PDFBox and check the numbers against the API order, not the layout; layout is a visual check once per template change."

## 5. Eventual consistency and the last item in stock

### Business rules and risks

Two customers, one item: exactly one may buy. ShopEasy cannot show this (stock never changes: known gap, executable in \`order-history.spec.ts\`), so the tests are for a real app.

| # | Scenario | Type | Prio | Level | Automate |
|---|---|---|---|---|---|
| Z1 | 8 buyers, stock 1: one 201, seven refusals | race | P1 | API + DB | yes |
| Z2 | stock 5, orders of 3 and 3 | boundary, race | P1 | API + DB | yes |
| Z3 | reservation expires, item is sold again | time | P1 | API, test clock | yes |
| Z4 | the loser sees a clear message and keeps the cart | UI | P2 | UI, mocked 409 | yes |
| Z5 | list shows "sold out" within the promised time | eventual | P2 | API poll | yes |

\`\`\`gherkin
  @real-app
  Scenario: The last item is sold once
    Given a product with 1 piece in stock
    When 8 customers order it at the same moment
    Then exactly 1 order is accepted
    And the stock is 0
\`\`\`

The correct implementation decides in **one statement**; a test of two requests cannot prove it, but it finds read-then-write quickly:

\`\`\`sql
UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock >= 1;      -- 1 row: sold; 0 rows: too late
SELECT id, stock FROM products WHERE stock < 0;                          -- never
\`\`\`

**\`shopeasy-api-client: com/shopeasy/api/tests/LastItemTest.java\`**

\`\`\`java
package com.shopeasy.api.tests;

public class LastItemTest extends BaseApiTest {

    private static final int BUYERS = 8;

    @Test(groups = "real-app")
    public void theLastItemIsSoldExactlyOnce() throws Exception {
        int productId = AdminApi.productWithStock(1);                          // a product only this test knows
        OrderRequest order = OrderRequest.withItems(new Customer("Asha", "Rao", "560001"), List.of(new AddItem(productId, 1)));
        List<CustomerSession> buyers = Stream.generate(() -> api.newCustomer(UserBuilder.aCustomer().build()))
                .limit(BUYERS).toList();                                       // log in first, race later

        List<Integer> statuses = new ArrayList<>();
        ExecutorService pool = Executors.newFixedThreadPool(BUYERS);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Integer>> attempts = buyers.stream().map(buyer -> pool.submit(() -> {
                start.await();
                return buyer.orders().placeRaw(order).statusCode();
            })).toList();
            start.countDown();
            for (Future<Integer> attempt : attempts) {
                statuses.add(attempt.get());
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(statuses).filteredOn(status -> status == 201).hasSize(1);
        assertThat(statuses).filteredOn(status -> status != 201).allMatch(status -> status == 409 || status == 422);
    }
}
\`\`\`

**\`tests/real-app/last-item.spec.ts\`**

\`\`\`ts
// typical real app (illustrative)
import { test, expect } from '@fixtures/e2e';
import { aDelivery } from '@domain/builders';

test('the last item is sold exactly once', { tag: '@real-app' }, async ({ apiContext, newCustomer, db }) => {
  const created = await apiContext.post('/api/admin/products', { data: { name: 'Last one', price: 9.99, stock: 1 } });
  const { id: productId } = await created.json();
  const buyers = await Promise.all(Array.from({ length: 8 }, () => newCustomer()));

  const results = await Promise.all(
    buyers.map((buyer) => buyer.api.orders.placeItems(aDelivery(), [{ productId, quantity: 1 }])));

  expect(results.filter((r) => r.ok)).toHaveLength(1);
  for (const loser of results.filter((r) => !r.ok)) expect([409, 422]).toContain(loser.status);
  expect(await db.find('SELECT stock FROM products WHERE id = $1', [productId])).toEqual({ stock: 0 });
  expect(await db.list('SELECT order_id FROM order_items WHERE product_id = $1', [productId])).toHaveLength(1);
});
\`\`\`

**Latch or \`Promise.all\`?** In Java the latch lets all threads start together after the slow logins. Node sends all requests from one thread without waiting for answers, which is enough for a server race. Both are probabilistic: repeat (\`@Test(invocationCount = 10)\`, \`--repeat-each=10\`) and never "fix" a rare failure with a retry. A retry here hides money.

**Polling for eventual consistency**

| Approach | How | Advantages | Disadvantages | Use when |
|---|---|---|---|---|
| fixed sleep | \`Thread.sleep(5000)\` | none | slow and flaky | never |
| poll the final state | Awaitility, \`expect.poll\` | fast, tolerant | hides *how long* it took | default |
| poll and measure | poll, then assert the duration | checks the promised time | noisy environments | when there is an SLA |
| subscribe | consume the event (Kafka, webhook stub) | exact, sees duplicates | more plumbing | event-driven systems |
| test hook "process now" | trigger the job | deterministic | skips the scheduler | schedulers, nightly jobs |

**Recommended:** poll for one specific id, with a limit taken from the requirement and a message that names the state last seen. To prove that something does *not* happen, observe for a defined time (\`during\`).

**UI in both stacks (Z4).** Do not race two browsers: force the refusal. Playwright: \`page.route('**/api/orders', (r) => r.fulfill({ status: 409, json: { error: { code: 'OUT_OF_STOCK' } } }))\`, then assert the message and the full cart. Selenium: order the only piece through the API as another customer *between* opening the checkout and clicking Finish; that is deterministic and needs no mock.

**Data:** a product created by the test. **Failures:** racing with the shared product 4 breaks every other test; logging in inside the race serialises the requests; a connection pool of 2 in the client makes 8 buyers queue, so the race never happens.

### How I would explain this in an interview (60 seconds)

> "For the last item I create a product with stock one, prepare eight logged-in customers, release them together, and require exactly one success, seven clean refusals, stock zero and one order line in the database. I repeat it, because a race test is probabilistic, and I ask the developers for the conditional update or lock that makes it safe. For asynchronous parts I poll one id until a deadline from the requirement, and I observe for a while when I must prove that nothing happens twice."

## 6. The complete end-to-end test

**What runs today: two doors, one oracle.** The same two products through the page and through the API must cost the same.

\`\`\`gherkin
@e2e @smoke
Feature: Both channels charge the same

  Scenario: Web shop and API agree on the total
    Given I am signed in with these products in my cart:
      | Storm Fleece Jacket |
      | Junior Onesie       |
    And I start the checkout
    When I continue with valid delivery details
    Then the overview shows the totals of my cart
    And the API charges the same for these products
\`\`\`

**\`src/test/java/com/shopeasy/e2e/bdd/TwoDoorsSteps.java\`**

\`\`\`java
package com.shopeasy.e2e.bdd;

public class TwoDoorsSteps {

    private final ApiWorld world;
    private final ScenarioContext context;

    public TwoDoorsSteps(ApiWorld world, ScenarioContext context) {
        this.world = world;
        this.context = context;
    }

    @Then("the API charges the same for these products")
    public void apiChargesTheSame() {
        for (Product product : context.cart()) {
            int id = world.api().products().search(Map.of("q", product.name())).data().get(0).id();
            world.customer().cart().add(id, 1);
        }
        Order order = world.customer().orders().place(OrderRequest.fromCart("Asha", "Rao", "560001"));

        OrderTotals expected = OrderTotals.expectedFor(context.cart());
        assertThat(BigDecimal.valueOf(order.subtotal())).isEqualByComparingTo(expected.subtotal());
        assertThat(BigDecimal.valueOf(order.tax())).isEqualByComparingTo(expected.tax());
        assertThat(BigDecimal.valueOf(order.total())).isEqualByComparingTo(expected.total());
    }
}
\`\`\`

**\`tests/e2e/two-doors.spec.ts\`**

\`\`\`ts
import { test, expect } from '@fixtures/e2e';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';
import { totalsFor } from '@domain/money';

const cart = [products.fleece, products.onesie];
const expected = totalsFor(cart);              // 57.98 + 4.64 = 62.62

test.use({ startingCart: { products: cart } });

test('web shop and API charge the same for the same cart', { tag: '@smoke' }, async ({ checkoutPage, customer }) => {
  await test.step('through the web shop', async () => {
    await checkoutPage.open();
    await checkoutPage.continueAs(aDelivery());
    await expect(checkoutPage).toShowTotals(expected);
    await checkoutPage.finish();
    await expect(checkoutPage.confirmation).toBeVisible();
  });

  await test.step('through the API', async () => {
    for (const product of cart) unwrap(await customer.api.cart.add(product.id));
    const order = unwrap(await customer.api.orders.place(aDelivery()));
    expect(order).toMatchObject({ ...expected, itemCount: 2, customer: aDelivery() });
    expect(unwrap(await customer.api.orders.byId(order.id))).toEqual(order);
  });
});
\`\`\`

**The full journey (typical real app, illustrative): arrange by API, act in the UI, verify in UI, API and DB.**

\`\`\`gherkin
@e2e @smoke @real-app
Feature: Buy

  Scenario: A new customer buys two products
    Given a new customer with these products in the cart:
      | Storm Fleece Jacket |
      | Junior Onesie       |
    When the customer checks out in the web shop
    Then web shop, API and database agree on the order
\`\`\`

**\`src/main/java/com/shopeasy/e2e/driver/CookieLogin.java\`**

\`\`\`java
package com.shopeasy.e2e.driver;

/** Typical real app: the session is a cookie, so a token from the API signs the browser in. */
public final class CookieLogin {

    private final BrowserSession session;

    public CookieLogin(BrowserSession session) {
        this.session = session;
    }

    public void with(String token) {
        session.driver().get(session.settings().url("login"));          // cookies need the right domain first
        session.driver().manage().addCookie(new Cookie.Builder("session", token).path("/").isHttpOnly(true).build());
    }
}
\`\`\`

**\`src/test/java/com/shopeasy/e2e/realapp/JourneySteps.java\`**

\`\`\`java
package com.shopeasy.e2e.realapp;

public class JourneySteps {

    private final ApiWorld world;
    private final CookieLogin login;
    private final CartPage cartPage;
    private final CheckoutPage checkoutPage;
    private final ScenarioContext context;
    private OrderTotals shown;

    public JourneySteps(ApiWorld world, CookieLogin login, CartPage cartPage, CheckoutPage checkoutPage,
                        ScenarioContext context) {
        this.world = world;
        this.login = login;
        this.cartPage = cartPage;
        this.checkoutPage = checkoutPage;
        this.context = context;
    }

    @Given("a new customer with these products in the cart:")
    public void newCustomerWithCart(List<String> names) {
        for (String name : names) {
            Product product = Catalogue.byName(name);
            int id = world.api().products().search(Map.of("q", name)).data().get(0).id();
            world.customer().cart().add(id, 1);
            context.added(product);
        }
        login.with(world.token());
    }

    @When("the customer checks out in the web shop")
    public void checksOut() {
        cartPage.open();
        cartPage.checkout();
        checkoutPage.waitUntilLoaded();
        checkoutPage.submit(Customer.valid().build());
        shown = checkoutPage.totals();
        checkoutPage.finish();
        checkoutPage.confirmation();
    }

    @Then("web shop, API and database agree on the order")
    public void everybodyAgrees() {
        OrderTotals expected = OrderTotals.expectedFor(context.cart());
        List<Order> orders = world.customer().orders().mine();

        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(shown).as("overview in the web shop").isEqualTo(expected);
        softly.assertThat(orders).as("orders of this customer").hasSize(1);
        softly.assertAll();

        Order order = orders.get(0);
        softly.assertThat(BigDecimal.valueOf(order.total())).as("API").isEqualByComparingTo(expected.total());
        softly.assertThat(world.customer().cart().get().items()).as("cart after the order").isEmpty();

        OrderRow row = stored(order.id());
        softly.assertThat(row.userId()).as("owner").isEqualTo(world.customer().user().id());
        softly.assertThat(row.status()).isEqualTo("PLACED");
        softly.assertThat(row.subtotal()).as("stored subtotal").isEqualByComparingTo(expected.subtotal());
        softly.assertThat(row.tax()).as("stored tax").isEqualByComparingTo(expected.tax());
        softly.assertThat(row.total()).as("stored total").isEqualByComparingTo(expected.total());
        softly.assertAll();
    }

    private static OrderRow stored(int orderId) {
        OrderQueries orders = new OrderQueries(SuiteDb.shared());
        return await("order " + orderId + " in the database").atMost(Duration.ofSeconds(10))
                .until(() -> orders.byId(orderId), Optional::isPresent).orElseThrow();
    }
}
\`\`\`

**\`tests/real-app/buy-journey.spec.ts\`**

\`\`\`ts
// typical real app (illustrative): one backend behind web shop and API, session in a cookie
import { test, expect } from '@fixtures/e2e';
import { env } from '@core/env';
import { unwrap } from '@core/http';
import { aDelivery } from '@domain/builders';
import { products } from '@domain/catalogue';
import { totalsFor } from '@domain/money';

type OrderRow = { id: number; user_id: number; status: string; subtotal: string; tax: string; total: string };
const cents = (amount: string | number): number => Math.round(Number(amount) * 100);

test('a customer buys two products', { tag: ['@real-app', '@smoke'] },
  async ({ context, checkoutPage, anonymousApi, workerCustomer, customer, db }) => {
    const cart = [products.fleece, products.onesie];
    const expected = totalsFor(cart);

    await test.step('arrange through the API', async () => {
      for (const product of cart) unwrap(await customer.api.cart.add(product.id));
      const session = unwrap(await anonymousApi.auth.login(workerCustomer.username, workerCustomer.password));
      await context.addCookies([{ name: 'session', value: session.token, url: env.WEB_BASE_URL, httpOnly: true }]);
    });

    const number = await test.step('buy in the web shop', async () => {
      await checkoutPage.open();
      await checkoutPage.continueAs(aDelivery());
      await expect(checkoutPage).toShowTotals(expected);
      await checkoutPage.finish();
      await expect(checkoutPage.orderNumber).toHaveText(/^\\d+$/);
      return Number(await checkoutPage.orderNumber.innerText());
    });

    await test.step('the API has the same order', async () => {
      expect(unwrap(await customer.api.orders.byId(number))).toMatchObject({ ...expected, userId: customer.id });
      expect(unwrap(await customer.api.cart.get()).itemCount).toBe(0);
    });

    await test.step('the database has it once, completely', async () => {
      const read = () => db.find<OrderRow>(
        'SELECT id, user_id, status, subtotal, tax, total FROM orders WHERE id = $1', [number]);
      await expect.poll(async () => (await read())?.status, { timeout: 10_000 }).toBe('PLACED');
      const row = (await read())!;
      expect(row.user_id).toBe(customer.id);
      expect([row.subtotal, row.tax, row.total].map(cents))
        .toEqual([expected.subtotal, expected.tax, expected.total].map(cents));
      expect(await db.list('SELECT product_id FROM order_items WHERE order_id = $1', [number])).toHaveLength(2);
    });
  });
\`\`\`

**Step by step.** (1) One independent oracle (\`OrderTotals\`, \`totalsFor\`) judges all three layers; comparing UI with API only would miss a shared mistake. (2) Only the step under test uses the browser. (3) The order is found by *this customer*, so parallel runs cannot mix. (4) The database read polls, because the write may be asynchronous. (5) Amounts are compared as \`BigDecimal\` / cents; PostgreSQL returns \`numeric\` as a string in Node. (6) Soft assertions show all layers in one report: "API right, DB wrong" is half the diagnosis.

**Pitfalls.** An end-to-end test that also checks sorting, messages and coupons fails for ten reasons; keep one journey, one purpose. A read replica lags: poll. \`SameSite\` or \`Secure\` cookies refuse to be set on \`http\`: read the browser's cookie jar first when the seeded login "does not work".

### How I would explain this in an interview (60 seconds)

> "My end-to-end test is one purchase. Customer and cart are created by API, the browser does only the checkout, then I verify the overview, the API order and the database row against one independent calculation. There are very few of these — they prove that the parts are connected — while rules live at lower levels. On the practice shop, where page and API are separate, I use a two-doors test that sends the same cart through both and compares totals."

## 7. Pyramid, traceability and suites for the whole shop

### Where each risk is covered

| Module | Unit | API / service | UI | E2E, DB | Manual, exploratory |
|---|---|---|---|---|---|
| Login, session | validators | refusal matrix, tokens | 3–5: form, lock, session | – | password manager, accessibility |
| Registration | rules | boundaries, race, roles | 2: messages, correction | one row | texts |
| Search, listing, details | comparator | matching, paging, filter | sort, no result | drift check | relevance, visuals |
| Cart | – | quantity, race, devices | 4–6: display, persistence | merge | layout |
| Pricing, coupons | rounding, shares | discriminating rows | 3 carts | SQL invariant | campaign texts |
| Checkout form | formats | all fields | presentation, guard | – | autofill, devices |
| Payment | – | stubs, idempotency, webhooks | outcomes, 3-D Secure | reconciliation, sandbox nightly | real charge (finance) |
| Orders, returns | state machine | own orders, transitions | 2–3 | journey, refunds invariant | support process |

Numbers are a result, not a goal. The useful rule: *each rule is proven once, at the lowest level that contains it, and once more only where it is connected.*

### Traceability matrix

| Rule (requirement) | Risk | Tests | Level | Suite | Gap |
|---|---|---|---|---|---|
| R-LOGIN-3 lock revealed only with the right password | enumeration | \`LoginApiTest#refusals\`, \`login.feature\` | API, UI | regression | lockout counter not in product |
| R-CART-2 quantity 1–10 | totals | \`CartApiTest\`, \`cart.spec.ts\` | API | regression | – |
| R-PRICE-1 8 % once per order | money | \`PricingApiTest\`, \`totals.spec.ts\`, two doors | API, UI, E2E | smoke + regression | SQL invariant needs a DB |
| R-CHK-5 only customers with products order | fraud, data | \`CheckoutGuardSteps\`, \`checkout-rules.spec.ts\` | UI | known defects | **defect open in UI** |
| R-ORD-1 only own orders | privacy | \`OrderHistoryApiTest\`, \`order-history.spec.ts\` | API | smoke | – |
| R-STK-1 never oversell | money | \`LastItemTest\`, \`last-item.spec.ts\` | API, DB | real app | **not implemented in the API** |

Generate it, do not maintain it: tags such as \`@R-PRICE-1\` in Cucumber, \`tag\` or \`annotation\` in Playwright, \`groups\` in TestNG, and a small script that reads the result files. Two lists matter in the weekly meeting: rules without a test, and tests without a rule.

### Suite selection

| Suite | Question it answers | Contents | Target | When |
|---|---|---|---|---|
| smoke | is this build worth testing? | sign-in, catalogue, one purchase, API health, own-orders check | ≤ 5 min | every deployment |
| change-based | did this change break its area? | tags of the touched modules + smoke | ≤ 10 min | merge request |
| regression | are the rules still true? | all automated rules | ≤ 30 min, parallel | nightly, release |
| real-app / sandbox | do the parts fit? | DB, stubs, sandbox, races ×10 | ≤ 60 min | nightly on staging |
| known defects | has something been fixed? | expected failures | – | nightly, informational |
| production checks | is the live shop usable? | read-only journeys, synthetic customer | ≤ 2 min | every few minutes |

Selecting for a release with little time: rank by *probability of a break (changed code, history of defects) × damage (money, privacy, revenue)*, say what you leave out, and let the owner accept that risk in writing. In A the selection is a tag expression (\`-Dcucumber.filter.tags="@smoke or @pricing"\`), in B \`--grep "@smoke|@pricing"\` or \`--only-changed\` for changed spec files.

## 8. Production bug walkthrough: "customers are charged twice"

*An illustrative incident for practice; the numbers are invented.* Support reports eleven customers in one evening.

**1. Protect first (minutes).** Confirm with two examples; inform the incident lead. Ask whether the charge retry can be disabled or the release rolled back. Testers do not refund and do not change data.

**2. Size and pattern (SQL).**

\`\`\`sql
SELECT p.order_id, COUNT(*) AS captures, MIN(p.paid_at) AS first, MAX(p.paid_at) - MIN(p.paid_at) AS gap
FROM   payments p
WHERE  p.status = 'CAPTURED' AND p.paid_at >= now() - INTERVAL '7 days'
GROUP  BY p.order_id HAVING COUNT(*) > 1
ORDER  BY first;

-- the other shape: two orders, same customer and amount, minutes apart
SELECT a.id, b.id, a.user_id, a.total, b.created_at - a.created_at AS gap
FROM   orders a JOIN orders b ON b.user_id = a.user_id AND b.total = a.total AND b.id > a.id
                              AND b.created_at - a.created_at < INTERVAL '2 minutes';
\`\`\`

Suppose: first query 41 rows, all with a gap of 10.0–10.4 seconds, starting at 18:05; second query nothing unusual. A constant gap is a machine, not an impatient finger: 10 seconds smells like a timeout.

**3. Follow one case through the logs.** Take one order id, find its correlation id (\`X-Correlation-Id\` in our clients, the trace id in the backend) and write the timeline:

| Time | Service | Event |
|---|---|---|
| 18:41:07.112 | web | POST /payments, key \`k-71…\` |
| 18:41:07.140 | order | POST provider /v1/charges, key \`c-01…\` |
| 18:41:07.900 | provider | \`c-01…\` captured; its answer is late |
| 18:41:17.141 | order | read timeout after 10 s, retry 1 |
| 18:41:17.150 | order | POST provider /v1/charges, key \`c-02…\` (**different**) |
| 18:41:18.020 | provider | \`c-02…\` captured: second charge, 10.1 s later |

**4. Hypotheses, each with a cheap check.**

| Hypothesis | Check | Result |
|---|---|---|
| double click | two browser requests? | no, one |
| message processed twice | two consumer log lines for one event? | no |
| retry with a new key | compare keys in the log | **yes** |
| provider bug | do other shops report it, status page | no |

Why since 18:05? A deployment at 18:02 contained a new HTTP client; the key is now created *inside* the retried method. And the provider was slow that evening: the defect needs both conditions, so no test had seen it.

**5. Reproduce at the lowest level.** Stub the provider with a first answer delayed beyond the timeout and a normal second one. WireMock scenarios do this in Java; the key assertion is the whole test:

\`\`\`java
gateway.register(post(urlPathEqualTo("/v1/charges")).inScenario("slow once").whenScenarioStateIs(STARTED)
        .willReturn(okJson("{\\"status\\":\\"APPROVED\\"}").withFixedDelay(12_000)).willSetStateTo("fast"));
gateway.register(post(urlPathEqualTo("/v1/charges")).inScenario("slow once").whenScenarioStateIs("fast")
        .willReturn(okJson("{\\"status\\":\\"APPROVED\\"}")));
// order once, then:
assertThat(gateway.find(postRequestedFor(urlPathEqualTo("/v1/charges"))))
        .hasSize(2).extracting((LoggedRequest r) -> r.getHeader("Idempotency-Key")).containsOnly(firstKey());
\`\`\`

\`firstKey()\` reads the key of the first request. In B the backend cannot be reached by \`route\`; Playwright's part is the page: after a mocked timeout it must say "we are checking" and not offer Pay again (lesson 2).

**6. Verify the fix on three levels.** The test above; the SQL query on staging after a run with a slow stub: no rows; a parallel and a *late webhook* variant. Then in production: the query as an hourly check with an alert.

**7. Clean up and learn.** Finance refunds from the list the query produced; QA checks afterwards that refunds equal the surplus. In the blameless review ask: why did no test fail (stubs were always fast), why did no monitor alert (nobody counted captures per order), what protects structurally (a key derived from the order, a unique constraint on \`(order_id, type)\`). Three actions, three owners, three dates.

### How I would explain this in an interview (60 seconds)

> "First I protect customers and size the problem with a query: which orders have more than one capture, since when, with what gap. The pattern gives the hypothesis; a constant ten-second gap means a timeout and retry. I follow one order by correlation id through the logs, compare the idempotency keys, reproduce it with a stub that is slow once, and make that the regression test. The fix is verified by test, by the same query on staging, and by an alert in production. And I ask why we did not see it: our stubs were always fast."

## Best practices for experienced engineers

- Verify claims of a page with a second source, and judge all layers with one independent oracle.
- Put noise into "only mine" tests and time into "exactly once" tests.
- Draw state machines; generate the table of forbidden transitions.
- Never retry a race test to green.
- Trace rules to tests from tags, and show gaps as openly as passes.
- After an incident the query becomes a monitor, the reproduction becomes a test.

## Interview questions

### Q: Describe an end-to-end test you would write for an e-commerce site.
**Short answer (30–60 s):** One purchase: data by API, checkout in the browser, verification in UI, API and database against one calculation. Very few such tests.

**Detailed answer:** Name the steps, why login and cart are seeded, how the order is found, why the DB read polls, how amounts are compared, what is left to lower levels. Add what is *not* possible on the practice shop and how "two doors" replaces it.

### Q: How do you verify an order in the database, and should UI tests do that?
**Short answer (30–60 s):** A few cross-layer tests do, through a typed query class and a read-only user. Most UI tests should not.

**Detailed answer:** Database checks couple tests to the schema. They are worth it where the UI cannot show the truth: payments, shares, audit, exactly-once. Poll for one id, compare numerics properly, never write.

### Q: How do you test concurrency on the last item?
**Short answer (30–60 s):** Own product with stock 1, N prepared customers, simultaneous requests; exactly one success, clean refusals, stock 0, one order line; repeated.

**Detailed answer:** Explain the latch, why logins happen before, client pool size, probabilistic nature, and what the code should do (conditional update, lock or reservation). A failed run is a defect even if it happens once in fifty.

### Q: How do you select a regression suite when there is only one hour?
**Short answer (30–60 s):** Risk = probability × damage: changed modules, defect history, money and privacy; smoke always; say what is left out.

**Detailed answer:** Tags make it executable. I show the list of excluded rules to the owner; the decision is theirs, informed by me. Afterwards the full suite still runs, and late findings go to a hotfix decision.

### Q: How do you verify e-mails and PDFs?
**Short answer (30–60 s):** Mail catcher API with unique recipients, exactly one mail within an observation window; PDF text extraction compared with the API order.

**Detailed answer:** Mention environment safety, HTML against text part, links, escaping, PDF reading order, and that layout is a separate visual check.

### Q: A customer was charged twice. How do you investigate?
**Short answer (30–60 s):** Protect, size by SQL, pattern, one case through the logs by correlation id, hypotheses with cheap checks, reproduce with a stub, regression test plus monitor.

**Detailed answer:** Use section 8 as structure; stress evidence before opinions, that testers do not repair production data, and the question why tests and monitoring missed it.

### Q: How do you prove coverage to management?
**Short answer (30–60 s):** A generated traceability matrix: rule, risk, tests, level, last result, gap.

**Detailed answer:** Counting tests or lines says little. Two lists say much: rules without tests and tests without rules. Escaped defects per module calibrate the matrix.

## Scenario-based questions

**1. The end-to-end test fails at "database agrees", one run in ten; the order is always there when you look.** The read goes to a replica or the write is asynchronous. I check the age of the row in the failed run; if it was written 1.2 s after the confirmation, polling with the agreed limit is right, and I ask whether the confirmation may be shown before the order is stored: the test found an architecture question. A sleep would have buried it.

**2. "Our regression takes nine hours; the release is weekly."** I measure by module and level. Typically a large part is UI tests proving API rules and repeating login. I move rules down module by module (the table in section 7 is the plan), seed sessions, run in parallel, split off races and sandbox. I report hours saved *and* the defects found per level, so that nobody mistakes faster for weaker.

**3. After a release, support sees other customers' names in the order history.** Privacy incident: escalate at once, do not collect more personal data than needed. Suspects: cache without user key, missing owner check, wrong session. I compare two customers on the API directly and then through the CDN: API right and CDN wrong means caching headers. The regression test is H2 *through the edge*, with two customers alternating on the same URL.

## Tricky follow-ups

- **Is a thank-you page a sufficient oracle?** No, it is the application's own claim.
- **Should an end-to-end test clean up its order?** Usually not possible; use a new customer and data that may stay.
- **Why not check the stock with the UI after Z1?** The list may be cached; read the source that decides.
- **Eight threads, but the server handles one request at a time: is the race test useless?** It passes without proving much; check the server's configuration and run it where several workers exist.
- **Is 100 % traceability 100 % coverage?** No. It shows that each *known* rule has a test, not that the test is strong or the rules complete.`,
  keyPoints: [
    `A thank-you page is a claim: verify it with a second source and judge UI, API and database with one independent calculation.`,
    `History is an authorisation test: create noise from a second customer, then require exactly the own orders, in order; lines keep the price of the day.`,
    `Model cancellation and returns as a state machine: allowed arrows, forbidden pairs (409 and unchanged), repetition, races, and "refunds never exceed captures" as SQL.`,
    `"Exactly one" mail, order or charge needs an observation window; races need own data, a common start, repetition and no retries.`,
    `An end-to-end test arranges by API, acts in the UI, verifies in three layers and stays rare; on ShopEasy the two-doors test compares the separate web shop and API.`,
    `Prove each rule once at the lowest level that contains it; generate traceability from tags; choose suites by the question they answer.`,
    `Investigate money incidents in order: protect, size by SQL, pattern, one case by correlation id, hypotheses, reproduction with a stub, regression test plus monitor.`,
  ],
  mistakes: [
    `Testing "only my orders" with a single customer; an endpoint that returns everything passes. Fix: let a stranger order in between and assert the exact list.`,
    `Comparing the UI only with the API of the same backend, so a shared wrong rule is invisible. Fix: one independent oracle for all layers.`,
    `Writing order states directly into the database for transition tests. Fix: drive the order through the official transitions with API calls, stubs and a test clock.`,
    `Reading the mailbox once and concluding "one mail". Fix: wait for the first, then observe a defined time, and search by a unique recipient.`,
    `Retrying a race test until it is green, or racing on a shared product. Fix: own product, prepared sessions, repeated runs; one failure is a defect.`,
    `Starting an incident with theories and code reading. Fix: size and pattern by query first; a constant gap between two charges already names the suspect.`,
  ],
  tryIt: `With the shop and the API running: (1) add the order-screens, order-history and two-doors tests of one stack and run them; find the expected failure for stock in the report. (2) Remove the stranger from the history test and write down which wrong implementation would now pass. (3) Extend the state machine of section 3 to a full table (9 states × 3 actions) and mark which cells deserve a UI test. (4) On the PostgreSQL or SQLite data of the SQL lesson, run the reconciliation and double-capture queries and explain each row. (5) Build the traceability matrix of section 7 for your own current module with at least ten rules; list rules without tests. (6) Tell the "charged twice" story in three minutes, then in 60 seconds, without notes.`,
  problems: ['int-026', 'int-033', 'int-038'],
}
