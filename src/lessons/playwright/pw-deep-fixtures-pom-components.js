export default {
  slug: 'pw-deep-fixtures-pom-components',
  category: 'playwright',
  order: 17,
  title: 'Deep dive: fixtures, hooks, Page Objects and Component Objects',
  minutes: 30,
  summary: 'Explain how Playwright resolves, sets up and tears down fixtures, design test-, worker-, auto- and option-scoped fixtures, choose fixtures over hooks for the right reasons, and build a Page Object plus Component Object layer that fixtures inject into tests.',
  manualAnalogy: `Before a manual regression cycle you prepare preconditions: a customer account, an empty cart, the right browser. Some of that is done once for the whole cycle (the account) and some before every test case (the empty cart), and you clean up afterwards. You also describe screens the same way every time: "the header", "the product card for the backpack", "row 3 of the employee table". Fixtures are the preconditions with their scope and clean-up written down; page and component objects are that shared vocabulary of screens and widgets.`,
  body: `## Where this lesson starts

The *Test structure, Page Objects and custom fixtures* lesson showed \`describe\`, hooks, a \`CheckoutPage\` class and a \`test.extend\` that hands it to tests. This lesson is what a senior interview probes next: *how* the runner decides which fixtures to build and in which order, how scopes interact with workers and retries, when a hook is still the right tool, and how to keep a page-object layer from turning into a 2,000-line \`BasePage\`.

## How the fixture system works internally

A fixture is a named value with a lifecycle. \`test.extend()\` does not run anything: it returns a new \`test\` function whose **fixture registry** contains the parent's fixtures plus yours. The work happens when a test is about to run:

1. **Read the dependency list from the destructuring pattern.** The runner looks at the first parameter of the test function — \`async ({ cartPage, workerAccount }) => …\` — and collects the names. It does the same for every fixture function. That is why the first argument **must** be an object destructuring pattern: \`async (fixtures, use) => …\` fails with an error that the first argument must use the object destructuring pattern. Even a fixture that needs nothing is written \`async ({}, use) => …\`.
2. **Build a dependency graph.** \`cartPage\` needs \`page\`, \`page\` needs \`context\`, \`context\` needs \`browser\` (plus option fixtures such as \`viewport\`, \`storageState\`). A cycle, or a worker fixture that depends on a test fixture, is reported as an error before the test runs.
3. **Set up lazily, dependencies first.** Only fixtures reachable from the test (or from its hooks, or automatic fixtures) are created. A spec that only asks for \`request\` never launches a page — that is the main performance advantage over a \`beforeEach\` that builds everything "just in case".
4. **\`use()\` splits set-up from teardown.** Everything before \`await use(value)\` is set-up; the value is handed to the dependants; the fixture function stays **suspended** at \`await use()\` while the test runs; when the test (and \`afterEach\` hooks) finish, \`use()\` resolves and the code after it is teardown.
5. **Teardown in reverse order.** If A depends on B, B is set up before A and torn down after A — exactly like nested \`try/finally\` blocks. Test-scoped fixtures are torn down after each test; worker-scoped fixtures when the worker shuts down (after \`afterAll\` hooks).

\`\`\`
setup:     browser(worker) → context → page → cartPage → [test body]
teardown:                               cartPage → page → context      (browser stays for the next test)
\`\`\`

What happens on failure matters in interviews:

- **The test throws** → \`use()\` still resolves, so teardown code after it **runs**. That is the teardown guarantee hooks do not give you as cleanly (see the comparison below).
- **A fixture's set-up throws** before \`use()\` → the test fails with the fixture named in the error; fixtures that were already set up are still torn down.
- **Any test failure** → the worker process is discarded and a new one is started, so worker-scoped fixtures are set up again in the new worker. Design worker fixtures to be safe to re-create.
- Fixture set-up and teardown time **counts towards the test timeout** unless the fixture declares its own \`timeout\`.

### Execution order with hooks

From the docs and worth memorising: automatic worker fixtures are set up before anything else, including \`beforeAll\`; automatic test fixtures are set up before the test and its \`beforeEach\` hooks; non-automatic fixtures are set up lazily when the first test **or hook** asks for them.

## Built-in fixtures and their scope

| Fixture | Scope | What it is |
|---|---|---|
| \`playwright\` | worker | The Playwright API object (\`playwright.request.newContext()\`, other browser types) |
| \`browser\` | worker | One launched browser shared by all tests in the worker |
| \`browserName\` | worker | \`'chromium' \\| 'firefox' \\| 'webkit'\` — from the project |
| \`context\` | test | A fresh \`BrowserContext\`, configured from \`use\` options |
| \`page\` | test | A page in that context |
| \`request\` | test | An \`APIRequestContext\` using \`baseURL\`, \`extraHTTPHeaders\`, etc. |
| \`baseURL\`, \`viewport\`, \`storageState\`, \`locale\`, \`timezoneId\`, \`trace\`… | option fixtures (test-scoped options) | Values from \`use\` in the config/project/\`test.use\` |
| \`headless\`, \`channel\`, \`launchOptions\` | option fixtures (worker-scoped options) | Changing them needs a different browser, so a different worker |

\`testInfo\` is **not** a fixture: it is the second argument of tests, hooks and fixtures (\`async ({ page }, testInfo)\` in a test, \`async ({ page }, use, testInfo)\` in a test fixture). Worker fixtures get \`workerInfo\` as the third argument instead.

A consequence of the table: \`test.use({ viewport: … })\` inside a file is cheap (new context), while \`test.use({ headless: false })\` in one file forces a separate worker for those tests — a hidden cost when people sprinkle worker options across files.

## Custom test-scoped fixtures

\`\`\`ts
// fixtures/pages.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';

export type PageFixtures = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    const inventory = new InventoryPage(page);
    await inventory.open();
    await use(inventory);
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
});
export { expect } from '@playwright/test';
\`\`\`

- \`base.extend<PageFixtures>\` — the first type parameter lists **test-scoped** fixtures; the second (used below) lists **worker-scoped** ones. The generic is what gives \`({ cartPage })\` autocomplete and type errors.
- All four fixtures depend on the same \`page\`, so a test that asks for \`inventoryPage\` and \`cartPage\` gets two objects over **one** tab — page objects are views, not resources.
- \`inventoryPage\` navigates in set-up. Decide this consciously: a fixture that navigates is convenient, but a test that asks for \`inventoryPage\` and \`checkoutPage\` gets an inventory navigation it may not want. A common convention: fixtures construct; tests (or an explicit \`open()\`) navigate — except for the one "landing page" fixture.

## Worker-scoped fixtures: one API-created account per worker

Registering a customer on every test is slow; sharing one global customer across workers makes carts collide. The middle ground is **one customer per worker**. Workers run tests one at a time, so the account is never used by two tests simultaneously.

\`\`\`ts
// fixtures/accounts.ts
import { test as base } from '@playwright/test';
import { ShopApi } from '../api/ShopApi';
import { CustomerBuilder } from '../data/CustomerBuilder';
import { env } from '../config/env';

export type Account = { id: number; username: string; password: string; token: string };
type WorkerFixtures = { workerAccount: Account };
type TestFixtures = { shopApi: ShopApi; emptyCart: void };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerAccount: [async ({ playwright }, use, workerInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.apiBaseUrl });
    const api = new ShopApi(ctx);
    const customer = new CustomerBuilder('w' + workerInfo.workerIndex).build();
    const created = await api.register(customer);
    const token = await api.login(customer.username, customer.password);
    await use({ id: created.id, username: customer.username, password: customer.password, token });
    await ctx.dispose();                       // runs when the worker shuts down
  }, { scope: 'worker', title: 'register worker customer' }],

  shopApi: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.apiBaseUrl });
    await use(new ShopApi(ctx));
    await ctx.dispose();
  },

  // test-scoped fixture that depends on a worker fixture: allowed (the reverse is not)
  emptyCart: async ({ shopApi, workerAccount }, use) => {
    await shopApi.clearCart(workerAccount.token);
    await use();
  },
});
\`\`\`

Step by step:

- \`[fn, { scope: 'worker' }]\` — the tuple form carries fixture options. \`title\` changes the name shown in reports and errors.
- It uses the worker-scoped \`playwright\` fixture, **not** \`request\`: \`request\` is test-scoped, and a worker fixture cannot depend on a test fixture.
- \`workerInfo.workerIndex\` is unique per worker process in this run — a replacement worker after a failure gets a **new** index, so a fresh account. (\`workerInfo.parallelIndex\` is the reusable slot number 0…workers-1; use it when you have a fixed pool of pre-provisioned accounts instead.) The builder also adds a time-based suffix, because two CI shards run on different machines with the same worker indexes.
- No \`DELETE /api/users\` exists in the ShopEasy API (\`POST /api/reset\` removes registered users), so teardown only disposes the context. In a real system, delete the account or tag it for a nightly clean-up job.
- The ShopEasy **web** login only accepts \`standard_user\` and \`locked_out_user\`; a registered customer is an **API** identity here (cart and order tests against port 5181). Keep that distinction in mind when you reuse this pattern.
- Tokens expire (\`expiresIn: 3600\`). A worker that lives longer than the token needs a refresh in a test-scoped fixture — a classic "fails only in the nightly full run" bug.

## Automatic fixtures: attach console errors on failure

\`\`\`ts
// fixtures/diagnostics.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

    await use(errors);

    if (testInfo.status !== testInfo.expectedStatus && errors.length > 0) {
      await testInfo.attach('console-errors.txt', { body: errors.join('\\n'), contentType: 'text/plain' });
    }
  }, { auto: true }],
});
\`\`\`

- \`{ auto: true }\` runs it for **every** test using this \`test\`, even if the test does not mention \`consoleErrors\`. A test may still destructure it to assert "no console errors".
- \`testInfo.status !== testInfo.expectedStatus\` is the correct "did this test fail unexpectedly" check — it also handles \`test.fail()\` tests correctly.
- The cost: because it depends on \`page\`, every test now creates a page — including pure API tests that share this \`test\`. Keep auto fixtures in the UI fixture module, or make them cheap.

## Option fixtures: configuration that projects override

\`\`\`ts
// fixtures/options.ts
import { test as base } from '@playwright/test';

export type ShopOptions = { loginAs: string | null };   // null = guest

export const test = base.extend<ShopOptions>({
  loginAs: ['standard_user', { option: true }],
});
\`\`\`

\`\`\`ts
// playwright.config.ts (excerpt)
import { defineConfig } from '@playwright/test';
import type { ShopOptions } from './fixtures/options';

export default defineConfig<ShopOptions>({
  use: { baseURL: 'http://localhost:5180/practice-site/' },
  projects: [
    { name: 'customer', use: { loginAs: 'standard_user' } },
    { name: 'guest', use: { loginAs: null }, grep: /@guest/ },
  ],
});
\`\`\`

\`[default, { option: true }]\` declares a fixture whose value comes from \`use\` (config, project or \`test.use()\`). \`defineConfig<ShopOptions>\` type-checks the custom key. Options are the clean way to parameterise a whole project — the *Organising tests* deep dive builds data-driven projects on this.

## Fixture timeouts, titles and boxing

| Option | Effect |
|---|---|
| \`timeout: 60_000\` | Gives this fixture its own time budget instead of eating the test timeout. Worker fixtures each have their own timeout (by default equal to the test timeout). |
| \`title: '…'\` | Name shown in reports and errors. |
| \`box: true\` / \`box: 'self'\` | Hides the fixture's steps in UI mode, the trace viewer and reports (\`'self'\` hides only the fixture's own step and keeps its inner steps). Good for noisy infrastructure fixtures. |

A slow \`workerAccount\` that occasionally takes 20 seconds should get \`timeout\`, not a bigger global test timeout.

## Overriding a built-in fixture: a page that is already logged in

ShopEasy keeps the logged-in user in **sessionStorage** (\`shopeasy.user\`), which \`storageState\` does not capture (see the *Auth state and API testing* lesson). An override of \`page\` can seed it before any page script runs:

\`\`\`ts
// fixtures/auth.ts
import { test as base } from './options';

export const test = base.extend({
  page: async ({ page, loginAs }, use) => {
    if (loginAs) {
      await page.addInitScript((user) => window.sessionStorage.setItem('shopeasy.user', user), loginAs);
    }
    await use(page);
  },
});
\`\`\`

- Overriding means: same name, and the override receives the **original** \`page\` as a dependency. Every fixture that depends on \`page\` (all page objects) now gets the logged-in page automatically.
- \`addInitScript\` runs before the page's own scripts on **every** navigation of that page, so the user stays logged in after redirects — and also after clicking *Logout*. A logout test therefore runs with \`test.use({ loginAs: null })\` and logs in through the UI.
- Login UI itself is tested by a few dedicated tests; everything else skips it. That is the biggest single speed-up in most suites.

## Combining fixture modules: mergeTests and mergeExpects

Large suites split fixtures by concern (pages, accounts, diagnostics, auth). Playwright 1.39 added \`mergeTests\` and \`mergeExpects\` to combine them:

\`\`\`ts
// fixtures/index.ts — the only module specs import
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as authTest } from './auth';
import { test as pageTest } from './pages';
import { test as accountTest } from './accounts';
import { test as diagnosticsTest } from './diagnostics';
import { expect as shopExpect } from './matchers';
import { expect as baseExpect } from '@playwright/test';

export const test = mergeTests(authTest, pageTest, accountTest, diagnosticsTest);
export const expect = mergeExpects(baseExpect, shopExpect);
\`\`\`

\`\`\`ts
// fixtures/matchers.ts — a domain matcher over the Header component
import { expect as baseExpect } from '@playwright/test';
import type { Header } from '../components/Header';

export const expect = baseExpect.extend({
  async toShowCartCount(header: Header, expected: number) {
    let pass = true;
    try {
      if (expected === 0) await baseExpect(header.cartBadge).toBeHidden();
      else await baseExpect(header.cartBadge).toHaveText(String(expected));
    } catch {
      pass = false;
    }
    return {
      pass,
      name: 'toShowCartCount',
      message: () => 'expected the cart badge to show ' + expected,
    };
  },
});
\`\`\`

Merging works because each module extends \`base\` independently — modules do not import each other, so a test that only needs API fixtures can import \`fixtures/accounts\` directly and never load UI fixtures. Avoid defining the same fixture name in two modules you merge; keep one owner per fixture. (The matcher above is deliberately simple; for a production matcher also honour \`this.isNot\` so \`.not.toShowCartCount()\` waits for the right condition.)

## Hooks vs fixtures

\`\`\`ts
// hook style
test.beforeEach(async ({ page }) => {
  await page.goto('inventory.html');
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
});

// fixture style
export const test = base.extend<{ cartWithBackpack: CartPage }>({
  cartWithBackpack: async ({ page }, use) => {
    await page.goto('inventory.html');
    await page.getByTestId('add-to-cart-trailblazer-backpack').click();
    const cart = new CartPage(page);
    await cart.open();
    await use(cart);
  },
});
\`\`\`

| | Hooks (\`beforeEach\`/\`afterEach\`/\`beforeAll\`/\`afterAll\`) | Fixtures |
|---|---|---|
| Reuse | Per file/describe; copy-paste across files | Import anywhere; compose with other fixtures |
| Laziness | \`beforeEach\` runs for every test in scope, needed or not | Only when a test asks for it |
| Isolation | Easy to leak state through \`let\` variables in the file | Value is created per test (or per worker) and passed in |
| Teardown guarantee | \`afterEach\` runs after failures, but set-up and clean-up live in two places and partial set-up is easy to mishandle | Teardown sits right after \`use()\`, runs in reverse dependency order |
| Parallel safety | \`beforeAll\` runs **once per worker** (and again after every worker restart) — surprising with \`fullyParallel\` | Scope is explicit: test or worker |
| Readability | Preconditions are hidden at the top of the file | The test signature lists its preconditions: \`({ cartWithBackpack, workerAccount })\` |
| Typing | Shared values are \`let\` variables, often \`!\`-asserted | Fully typed through \`extend<T>\` |

**Recommendation.** Fixtures for anything reusable, anything with teardown, and anything a page object or account depends on. Hooks for **local, file-specific** steps that read better next to the tests — a \`beforeEach\` that navigates to the page under test, or an \`afterEach\` that logs something for one suite. \`beforeAll\` only for genuinely worker-wide, read-only preparation in one file (better as a worker fixture if shared).

### Why \`beforeAll\` with a shared page is a trap

\`\`\`ts
// DON'T
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('inventory.html');
});
test('adds the backpack', async () => {
  await page.getByTestId('add-to-cart-trailblazer-backpack').click();
});
test('cart shows one item', async () => {
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');   // depends on the test above
});
\`\`\`

- Test 2 passes only if test 1 ran first **in the same worker**. \`--grep "cart shows"\`, \`fullyParallel\`, or a retry (new worker → \`beforeAll\` runs again on a fresh page) all break it.
- After test 1 fails, the worker is replaced; test 2 then runs against a new page without the backpack and fails too — one bug, two red tests, misleading report.
- The page lives outside the fixture lifecycle: nobody closes it unless you add \`afterAll\`, and failure artifacts are collected per test while the state they show was built up by the whole file — the report for test 5 shows damage done by test 2.
- \`page\` itself cannot be requested in \`beforeAll\` (it is test-scoped) — the error is the framework telling you this is not the intended design.

Fix: a fixture (\`cartWithBackpack\`) or an API call that creates the precondition for each test.

## Page Objects in TypeScript at senior level

### BasePage inheritance vs composition

\`\`\`ts
// pages/BasePage.ts — keep it tiny
import type { Page } from '@playwright/test';
import { Header } from '../components/Header';

export abstract class BasePage {
  readonly header: Header;
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {
    this.header = new Header(page.getByRole('banner'));
  }

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }
}
\`\`\`

| | Deep inheritance (\`BasePage\` with every helper) | Composition (components as fields) |
|---|---|---|
| How it works | Shared methods live in a parent class | Each page *has* a \`Header\`, \`ProductCard\`s, a \`DataTable\` |
| Advantages | Familiar from Selenium frameworks | Single responsibility, reusable across pages, small classes |
| Disadvantages | God class, fragile base class, helpers unrelated to most pages | A few more files |
| Maintainability / scalability | Degrades as the app grows | Grows linearly with UI components |
| When to use | Only for truly universal behaviour (\`open()\`, the header) | Default |

Recommended: a thin \`BasePage\` (constructor, \`path\`, \`open()\`, the header) and **composition** for everything else. Generic helpers (\`waitForSpinner\`, \`selectDate\`) become components or functions, not base-class methods.

### Constructor-injected Page, readonly locators, fluent navigation

\`\`\`ts
// pages/LoginPage.ts
import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { InventoryPage } from './InventoryPage';

export class LoginPage extends BasePage {
  protected readonly path = 'login.html';
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.error = page.getByRole('alert');
  }

  async loginAs(user: string, password: string): Promise<InventoryPage> {
    await this.submit(user, password);
    return new InventoryPage(this.page);
  }

  async loginExpectingError(user: string, password: string): Promise<this> {
    await this.submit(user, password);
    return this;
  }

  private async submit(user: string, password: string): Promise<void> {
    await this.username.fill(user);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}
\`\`\`

\`\`\`ts
// pages/InventoryPage.ts
import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { ProductCard } from '../components/ProductCard';
import { CartPage } from './CartPage';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage extends BasePage {
  protected readonly path = 'inventory.html';
  readonly title: Locator;
  readonly sort: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('title');
    this.sort = page.getByTestId('product-sort');
    this.cards = page.getByTestId('inventory-item');
  }

  card(name: string): ProductCard {
    return new ProductCard(this.cards.filter({ hasText: name }));
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption(option);
  }

  async goToCart(): Promise<CartPage> {
    await this.header.cartLink.click();
    return new CartPage(this.page);
  }
}
\`\`\`

Key design decisions:

- **\`Page\` is injected** (constructor parameter), never created inside the page object — so the fixture decides which page (logged in, mobile context, second user).
- **Locators are \`readonly\` fields** created in the constructor. They are lazy descriptions, so creating them before navigation is safe, and \`readonly\` stops a test from reassigning them.
- **Navigation methods return the next page object** (\`loginAs\` → \`InventoryPage\`, \`goToCart\` → \`CartPage\`). The test reads as a journey and the type system shows which actions are possible on which screen. Return \`this\` when the action stays on the page (\`loginExpectingError\`). Do not return a page object from a method that might land on two different pages — split it into two intention-revealing methods, as above.
- **\`SortOption\` is a union of the real \`<option value>\`s** (\`az\`, \`za\`, \`lohi\`, \`hilo\`), so a typo is a compile error.

### Assertions in page objects: the debate

| Approach | Example | For | Against |
|---|---|---|---|
| No assertions; expose locators | \`await expect(inventory.title).toHaveText('Products')\` in the test | The test owns "what is correct"; page objects stay reusable for positive and negative tests | Repeated multi-line checks in many tests |
| Assertion helpers on the page object | \`await checkout.expectError('Error: Postal Code is required')\` | Readable, one place to change a complex check | Page object grows; easy to hide *what* is asserted; tempting to add \`isX(): Promise<boolean>\` |
| Custom matchers | \`await expect(inventory.header).toShowCartCount(1)\` | Reads like an assertion, retries, reusable across pages | More set-up (\`expect.extend\`, \`mergeExpects\`) |

What a senior would say: "By default page objects expose locators and perform actions, and tests assert. When the same multi-step check appears in many tests, I add a custom matcher or a clearly named \`expect…\` helper that uses web-first assertions internally. What I reject in review is \`isErrorVisible(): Promise<boolean>\` followed by \`expect(…).toBe(true)\` — it throws away auto-retry and gives an unreadable failure message." A *state wait* inside a navigation method (\`await expect(this.title).toBeVisible()\` after \`loginAs\` to confirm the page loaded) is generally accepted — it is synchronisation, not verification.

## Component Object Model

Pages repeat widgets: the header on every page, product cards, cart lines, data tables. A **component object** wraps one widget and is **scoped to a root \`Locator\`**, so every inner locator is relative to that root. The same class works for the first, the filtered or the n-th instance, and inner locators cannot accidentally match another card (the inventory page also has an \`.item-price\` in the promo banner — a page-wide \`.item-price\` locator would hit it).

\`\`\`ts
// components/Header.ts
import type { Locator } from '@playwright/test';

export class Header {
  readonly cartLink: Locator;
  readonly cartBadge: Locator;
  readonly loggedInUser: Locator;
  readonly logout: Locator;

  constructor(readonly root: Locator) {
    // not getByRole('link', { name: 'Cart' }): the header nav also has a "Cart" text link → strict-mode violation
    this.cartLink = root.getByTestId('shopping-cart-link');
    this.cartBadge = root.getByTestId('shopping-cart-badge');
    this.loggedInUser = root.getByTestId('logged-in-user');
    this.logout = root.getByRole('link', { name: 'Logout' });
  }
}
\`\`\`

\`\`\`ts
// components/ProductCard.ts
import type { Locator } from '@playwright/test';

export class ProductCard {
  readonly name: Locator;
  readonly price: Locator;
  readonly toggleButton: Locator;   // "Add to cart" ⇄ "Remove"

  constructor(readonly root: Locator) {
    this.name = root.getByRole('link');
    this.price = root.locator('.item-price');
    this.toggleButton = root.getByRole('button');
  }

  async add(): Promise<void> {
    await this.root.getByRole('button', { name: 'Add to cart' }).click();
  }

  async remove(): Promise<void> {
    await this.root.getByRole('button', { name: 'Remove' }).click();
  }
}
\`\`\`

Why the card does not store \`getByTestId('add-to-cart-trailblazer-backpack')\`: ShopEasy **rewrites the button's id and \`data-testid\`** to \`remove-trailblazer-backpack\` after the click. A field built from the "add" test id would no longer match, so \`await expect(card.toggleButton).toHaveText('Remove')\` is only possible with a role-based, state-independent locator scoped to the card.

\`\`\`ts
// components/CartLine.ts
import type { Locator } from '@playwright/test';

export class CartLine {
  readonly name: Locator;
  readonly price: Locator;
  readonly quantity: Locator;
  readonly removeButton: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('inventory-item-name');
    this.price = root.getByTestId('inventory-item-price');
    this.quantity = root.getByTestId('item-quantity');
    this.removeButton = root.getByRole('button', { name: 'Remove' });
  }
}
\`\`\`

\`\`\`ts
// pages/CartPage.ts
import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { CartLine } from '../components/CartLine';
import { CheckoutPage } from './CheckoutPage';

export class CartPage extends BasePage {
  protected readonly path = 'cart.html';
  readonly lines: Locator;
  readonly emptyMessage: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.lines = page.getByTestId('cart-item');
    this.emptyMessage = page.getByTestId('empty-cart-message');
    this.checkoutButton = page.getByTestId('checkout');
  }

  line(name: string): CartLine {
    return new CartLine(this.lines.filter({ hasText: name }));
  }

  async checkout(): Promise<CheckoutPage> {
    await this.checkoutButton.click();
    return new CheckoutPage(this.page);
  }
}
\`\`\`

A generic **data table component** for \`table.html\` (the employee directory):

\`\`\`ts
// components/DataTable.ts
import type { Locator } from '@playwright/test';

export class DataTable {
  readonly headers: Locator;
  readonly rows: Locator;

  constructor(readonly root: Locator) {
    this.headers = root.getByRole('columnheader');
    this.rows = root.locator('tbody tr');
  }

  header(name: string): Locator {
    return this.headers.filter({ hasText: name });
  }

  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async sortBy(column: string): Promise<void> {
    await this.header(column).click();
  }

  /** Not auto-waiting: call after a web-first assertion such as toHaveCount. */
  async columnValues(column: string): Promise<string[]> {
    const names = (await this.headers.allInnerTexts()).map((t) => t.replace(/[▲▼]/g, '').trim());
    const index = names.indexOf(column);
    if (index === -1) throw new Error(\`Column "\${column}" not found; columns are: \${names.join(', ')}\`);
    return this.root.locator(\`tbody tr td:nth-child(\${index + 1})\`).allInnerTexts();
  }
}
\`\`\`

\`\`\`ts
// tests/employees.spec.ts
import { test, expect } from '../fixtures';
import { DataTable } from '../components/DataTable';

test('sorting by salary is ascending and marked with aria-sort', async ({ page }) => {
  await page.goto('table.html');
  const table = new DataTable(page.getByTestId('employee-table'));

  await table.sortBy('Salary');

  await expect(table.header('Salary')).toHaveAttribute('aria-sort', 'ascending');
  await expect(table.rows).toHaveCount(5);                      // page size is 5
  const salaries = (await table.columnValues('Salary')).map((s) => Number(s.replace(/[$,]/g, '')));
  expect(salaries).toEqual([...salaries].sort((a, b) => a - b));
});
\`\`\`

- The component knows nothing about employees — it works for any \`<table>\` with headers. The domain page object (\`EmployeeDirectoryPage\`) owns it: \`readonly table = new DataTable(page.getByTestId('employee-table'))\`, plus the search box (\`getByRole('textbox', { name: 'Search employees' })\`) and the \`row-count\` text.
- \`columnValues\` uses \`allInnerTexts()\`, which does **not** wait, so the test first waits with \`toHaveCount(5)\` — the pattern the *Locators* lessons and pw-041 drill.
- \`sortBy\` clicks; the **test** asserts the result through \`aria-sort\`, which is more robust than reading the ▲ indicator.

## POM and fixtures complement each other

Page objects describe **how** to interact with screens; fixtures decide **which instance, in which state, with which clean-up** a test receives. The clean division:

- Page/component objects: no knowledge of test data creation, accounts or config.
- Fixtures: construct page objects over the right \`page\`, create data via API helpers, tear it down.
- Tests: business intent and assertions.

\`\`\`ts
// tests/cart.spec.ts
import { test, expect } from '../fixtures';

test('removing the only item empties the cart', async ({ inventoryPage }) => {
  await inventoryPage.card('Trailblazer Backpack').add();
  await expect(inventoryPage.header).toShowCartCount(1);

  const cart = await inventoryPage.goToCart();
  await cart.line('Trailblazer Backpack').removeButton.click();

  await expect(cart.lines).toHaveCount(0);
  await expect(cart.emptyMessage).toBeVisible();
  await expect(cart.header).toShowCartCount(0);
});
\`\`\`

## Reusable utilities and where they live

\`\`\`ts
// config/env.ts — one typed source of configuration
function read(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(\`Missing environment variable \${name}\`);
  return value;
}

export const env = {
  webBaseUrl: read('WEB_BASE_URL', 'http://localhost:5180/practice-site/'),
  apiBaseUrl: read('API_BASE_URL', 'http://localhost:5181'),
  defaultPassword: read('SHOP_PASSWORD', 'secret_sauce'),
} as const;
\`\`\`

\`\`\`ts
// data/CustomerBuilder.ts — valid by default, override only what the test cares about
export type NewCustomer = { username: string; password: string; firstName: string; lastName: string; email: string };

export class CustomerBuilder {
  private data: NewCustomer;

  constructor(prefix = 'cust') {
    const id = \`\${prefix}-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 6)}\`;
    this.data = { username: id, password: 'Passw0rd!', firstName: 'Jane', lastName: 'Doe', email: \`\${id}@example.test\` };
  }

  withEmail(email: string): this { this.data = { ...this.data, email }; return this; }
  withName(firstName: string, lastName: string): this { this.data = { ...this.data, firstName, lastName }; return this; }
  build(): NewCustomer { return { ...this.data }; }
}
\`\`\`

\`\`\`ts
// api/ShopApi.ts — thin, typed wrapper over APIRequestContext
import type { APIRequestContext } from '@playwright/test';
import type { NewCustomer } from '../data/CustomerBuilder';

export class ShopApi {
  constructor(private readonly request: APIRequestContext) {}

  async register(customer: NewCustomer): Promise<{ id: number; username: string }> {
    const res = await this.request.post('/api/users', { data: customer });
    if (res.status() !== 201) throw new Error(\`register failed: \${res.status()} \${await res.text()}\`);
    return res.json();
  }

  async login(username: string, password: string): Promise<string> {
    const res = await this.request.post('/api/auth/login', { data: { username, password } });
    if (!res.ok()) throw new Error(\`login failed: \${res.status()}\`);
    return (await res.json()).token;
  }

  async addToCart(token: string, productId: number, quantity = 1): Promise<void> {
    const res = await this.request.post('/api/cart/items', {
      data: { productId, quantity },
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (res.status() !== 201) throw new Error(\`add to cart failed: \${res.status()}\`);
  }

  async clearCart(token: string): Promise<void> {
    await this.request.delete('/api/cart', { headers: { Authorization: \`Bearer \${token}\` } });
  }
}
\`\`\`

The API helper **throws with the response body** instead of asserting: it is set-up code, and a failed set-up should read "register failed: 409 USERNAME_TAKEN", not a generic \`expect\` diff in the middle of an unrelated test. The username format matches the API rule (3–40 of \`[a-z0-9_.-]\`).

## Folder structure for this layer

\`\`\`
playwright.config.ts
config/env.ts                 typed environment
api/ShopApi.ts                API clients (no assertions, throw on unexpected status)
data/CustomerBuilder.ts       builders and static test data (json/csv)
components/                   Header, ProductCard, CartLine, DataTable — root-Locator scoped
pages/                        BasePage (thin), LoginPage, InventoryPage, CartPage, CheckoutPage
fixtures/
  options.ts  auth.ts  pages.ts  accounts.ts  diagnostics.ts  matchers.ts
  index.ts                    mergeTests + mergeExpects — specs import only this
tests/
  ui/  api/  setup/
\`\`\`

Rule of dependencies: \`tests → fixtures → pages → components\`, and \`fixtures → api/data/config\`. Pages never import fixtures; components never import pages.

## Common mistakes and how to debug them

- **A type error on \`({ cartPage })\` and an "unknown parameter" error at run time** — the spec imports \`test\` from \`@playwright/test\` instead of \`fixtures/index\`. Check the import first.
- **An error that a worker fixture cannot depend on a test fixture** — a worker fixture destructured \`page\` or \`request\`. Use \`browser\`/\`playwright\` and create what you need.
- **Teardown runs too early** — the fixture called \`use(value)\` without \`await\`, so its teardown (closing a context, deleting data) runs while the test is still using the value. Symptoms: "closed" errors or missing data at random points of the test. A fixture that never calls \`use()\` at all makes the test hang until timeout.
- **Worker fixture created more often than expected** — every failure replaces the worker; worker-scoped *options* that differ between files also split workers. Look at the worker index in the HTML report / \`workerInfo.workerIndex\` logs.
- **A test times out "in set-up"** — the trace and the report show fixture steps; a slow account fixture without its own \`timeout\` eats the test's 30 seconds.
- **Strict-mode violation inside a component** — the root locator matched several cards. \`hasText\` is a case-insensitive substring match over the **whole card text**, description included: \`cards.filter({ hasText: 'tee' })\` matches *Retro Red Tee* and also *Classic Crew T-Shirt* ("crew-neck tee"). The error lists both elements. Filter on the name link instead: \`cards.filter({ has: page.getByRole('link', { name: 'Retro Red Tee', exact: true }) })\`.

## Best practices for experienced engineers

- Specs import **one** \`test\`/\`expect\` from \`fixtures/index.ts\`; new fixture modules are added with \`mergeTests\`.
- Name fixtures by the **state** they provide (\`cartWithBackpack\`, \`workerAccount\`), not by implementation (\`setupData2\`).
- Test scope by default; worker scope only for expensive, safely shareable resources keyed by \`workerIndex\`.
- Auto fixtures only for cross-cutting diagnostics; keep them cheap.
- Page objects: thin \`BasePage\`, composition with root-scoped components, readonly locators, intention-revealing methods returning the next page, no boolean "isX" methods.
- Set-up through API helpers, verification through the UI under test.

## Selenium (Java) contrast

In a TestNG framework the same responsibilities are spread over several mechanisms:

\`\`\`java
public abstract class BaseTest {
    protected static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    @BeforeMethod
    public void setUp() { DRIVER.set(new ChromeDriver()); }

    @AfterMethod(alwaysRun = true)
    public void tearDown() { DRIVER.get().quit(); DRIVER.remove(); }
}

public class InventoryPage {
    @FindBy(css = "[data-testid='product-sort']") private WebElement sort;
    public InventoryPage(WebDriver driver) { PageFactory.initElements(driver, this); }
}
\`\`\`

- **Inheritance + ThreadLocal** replace what Playwright does with test-scoped fixtures; \`alwaysRun = true\` is the teardown guarantee you must remember to add.
- **TestNG listeners** (\`ITestListener.onTestFailure\`) take screenshots; in Playwright that is config (\`screenshot\`, \`trace\`) or an auto fixture.
- **PageFactory** proxies \`WebElement\`s, which go stale after re-render; Playwright \`Locator\`s are re-resolved on every action, so "re-find the element" code disappears.
- Dependency injection containers (Guice/PicoContainer with Cucumber) are the closest Java analogue to fixtures; Playwright builds it into the runner.

## Interview questions

### Q: How does Playwright know which fixtures a test needs?
**Short answer (30–60 s):** It reads the names in the destructured first parameter of the test and of every fixture, builds a dependency graph from them, and sets up only what is reachable — dependencies first. That is why the first parameter must be an object destructuring pattern.

**Detailed answer:** The registry comes from the chain of \`test.extend()\` calls. At run time the runner resolves \`({ cartPage })\` → \`page\` → \`context\` → \`browser\` plus option fixtures. Set-up is lazy and ordered; each fixture is suspended at \`await use(value)\` while the test runs and resumes for teardown, in reverse order. Mention the failure modes: cycles and worker-on-test dependencies are errors, and fixture time counts towards the test timeout unless the fixture sets \`timeout\`.

### Q: Test-scoped vs worker-scoped fixtures — how do you choose?
**Short answer (30–60 s):** Test scope for anything that holds state a test can change (pages, carts, orders). Worker scope for expensive, read-mostly resources that can be shared by tests running sequentially in one worker — an account per worker, a seeded catalogue, an API token.

**Detailed answer:** Worker fixtures are torn down at worker shutdown and re-created after every failure (new worker), so they must be idempotent and unique per worker: key them on \`workerInfo.workerIndex\` (unique per process) plus a run-unique suffix for sharded CI; use \`parallelIndex\` for a fixed pool of pre-provisioned accounts. They cannot depend on test fixtures, so use \`playwright.request.newContext()\` rather than \`request\`. Pair them with a test-scoped reset (\`emptyCart\`) so tests in the same worker do not leak into each other.

### Q: When would you still use \`beforeEach\` instead of a fixture?
**Short answer (30–60 s):** For short, local preconditions that only this file needs and that have no teardown — typically navigating to the page under test. Anything reused across files or with clean-up becomes a fixture.

**Detailed answer:** Compare reuse, laziness, isolation and teardown placement. Hooks hide preconditions at the top of the file and push shared values into \`let\` variables; fixtures put the preconditions in the test signature, are typed, and keep set-up and teardown together. Also explain the \`beforeAll\` behaviour: once per worker and again after every worker restart, so with \`fullyParallel\` it may run many times.

### Q: How do you make every test start logged in?
**Short answer (30–60 s):** Override the \`page\` (or \`context\`) fixture, or use \`storageState\` from a setup project. For ShopEasy, where the login is in sessionStorage, the override adds an init script that seeds \`shopeasy.user\` before page scripts run.

**Detailed answer:** Show the override receiving the original \`page\`, combined with an option fixture (\`loginAs\`, \`null\` for guest) so projects or \`test.use\` can switch users. Mention the trade-offs: init scripts run on every navigation (logout tests must opt out), and the login UI still needs its own dedicated tests. For cookie/localStorage apps prefer \`storageState\`, which is cheaper and closer to a real session.

### Q: Should page objects contain assertions?
**Short answer (30–60 s):** By default no — they expose locators and actions and the test decides what is correct. Repeated complex checks become custom matchers or clearly named \`expect…\` helpers that use web-first assertions. Never boolean \`isX()\` methods.

**Detailed answer:** Walk through the table: no-assertion POs are reusable for positive and negative tests; helpers improve readability but can hide what is checked; custom matchers via \`expect.extend\` + \`mergeExpects\` read best and still retry. Distinguish synchronisation (waiting for a page to be loaded inside a navigation method) from verification.

### Q: What is a component object and why scope it to a Locator?
**Short answer (30–60 s):** A class for a repeated widget — header, product card, cart line, table — whose locators are relative to a root \`Locator\`. Scoping makes it reusable for any instance and prevents inner locators from matching elements elsewhere on the page.

**Detailed answer:** Give the ShopEasy example: \`.item-price\` also appears in the promo banner, so a page-level price locator is ambiguous; inside \`ProductCard(root)\` it is unique. Mention that the add button's test id changes to \`remove-…\` after clicking, so a role-based locator within the card is more stable. Pages compose components; components never know about pages.

### Q: How do you combine fixtures from several teams or modules?
**Short answer (30–60 s):** Each module extends \`base\` independently, and an index file combines them with \`mergeTests\` (and custom matchers with \`mergeExpects\`), both added in Playwright 1.39. Specs import only the index.

**Detailed answer:** The benefit is decoupling: API tests can import only the account fixtures; UI tests get pages, auth and diagnostics. One owner per fixture name; avoid modules overriding each other's fixtures implicitly. Before 1.39 people chained \`extend\` calls in one file, which created a single huge fixtures file.

## Scenario-based questions

**1. A team's \`BasePage\` is 1,800 lines and every page inherits it.** I would not rewrite it in one go. First, list what callers really use; most helpers belong to two or three pages. I'd extract components (\`Header\`, \`DataTable\`, \`DatePicker\`) scoped to root locators, move generic waits into the components that need them, delete dead helpers, and leave \`BasePage\` with the constructor, \`path\`, \`open()\` and the header. New pages use composition from day one; old pages migrate when touched. The measure of success is smaller diffs per UI change.

**2. Cart tests pass alone but fail in the full run with "expected 1 item, got 2".** Likely shared server state: the tests use a worker-scoped (or global) account and do not reset the cart. I'd confirm by checking whether failing tests share a worker in the report, then add a test-scoped \`emptyCart\` fixture that clears the cart through the API before each test that depends on it — or give those tests a fresh account. Retries would only hide it.

**3. The suite slowed down after someone added an auto fixture.** The fixture depends on \`page\`, so every API test now launches a page, and it attaches artefacts on every test. I'd move it to the UI fixture module, make it attach only on unexpected status, and check the run time per project before and after.

## Tricky follow-ups

- **Can a fixture use \`testInfo\`?** Yes — test fixtures receive it as the third argument (\`async ({ page }, use, testInfo)\`); worker fixtures receive \`workerInfo\`.
- **Does teardown run if the test fails?** Yes; code after \`await use()\` runs after the test body and \`afterEach\` hooks, in reverse dependency order.
- **Can \`beforeAll\` use \`page\`?** No, \`page\` is test-scoped. Using \`browser.newPage()\` there is possible but creates shared, order-dependent state.
- **Why \`async ({}, use)\` with empty braces?** The runner parses the destructuring pattern to discover dependencies; a non-destructured first argument is rejected.
- **What happens to worker fixtures when a test fails?** The worker is discarded; worker fixtures are torn down and a new worker sets them up again for the remaining tests.`,
  keyPoints: [
    "The runner reads dependencies from the destructured first parameter, builds a graph, sets up lazily (dependencies first) and tears down in reverse order; code after await use() is teardown and runs even when the test fails.",
    "browser, browserName and playwright are worker-scoped; context, page and request are test-scoped; testInfo is an argument, not a fixture. Worker fixtures cannot depend on test fixtures.",
    "Worker-scoped fixtures (one API account per worker keyed on workerIndex plus a run-unique suffix) are re-created after every failure, so make them idempotent and pair them with test-scoped resets.",
    "Auto fixtures suit cross-cutting diagnostics; option fixtures ([default, { option: true }]) let projects and test.use parameterise behaviour; give slow fixtures their own timeout.",
    "Override page to start logged in (for ShopEasy: seed sessionStorage with addInitScript), and combine fixture modules with mergeTests / mergeExpects (Playwright 1.39+).",
    "Prefer fixtures to hooks for reuse, laziness, typing and teardown; beforeAll with a shared page creates order-dependent, retry-hostile tests.",
    "Page objects: injected Page, readonly locators, a thin BasePage, composition with root-Locator-scoped components, methods that return the next page, no boolean isX() methods.",
    "Fixtures create and inject page objects and data; page objects describe interaction; tests hold intent and assertions.",
  ],
  mistakes: [
    "Calling use(value) without await in a fixture — teardown (closing a context, deleting data) runs while the test is still using the value, giving random 'closed' or missing-data failures. Fix: always await use(value); lint with @typescript-eslint/no-floating-promises.",
    "A worker fixture that destructures page or request — the run fails before any test with a scope error. Fix: depend on browser or playwright and create the context yourself (playwright.request.newContext) and dispose it in teardown.",
    "Sharing one worker account without resetting server state, so cart counts depend on which tests ran earlier in that worker. Fix: a test-scoped fixture that clears the cart via the API, or a fresh account per test for stateful flows; confirm by checking worker indexes of the failing tests in the report.",
    "Storing state-dependent test ids as page-object fields (add-to-cart-* changes to remove-* after the click), so assertions after the action time out. Fix: role-based locators scoped to the component root, e.g. card.root.getByRole('button').",
    "Putting the console-error auto fixture in the shared fixture module, which makes every API test open a page. Fix: keep auto fixtures that need page in the UI module and measure the run time per project.",
    "A growing BasePage with unrelated helpers. Fix: extract components with a root Locator, keep BasePage to constructor, path, open() and header.",
  ],
  tryIt: `Build the layer against \`http://localhost:5180/practice-site/\`:
1. Create \`components/Header.ts\`, \`components/ProductCard.ts\` and \`components/CartLine.ts\` exactly scoped to root locators, and \`pages/InventoryPage.ts\` / \`pages/CartPage.ts\` that compose them.
2. Create \`fixtures/options.ts\` (\`loginAs\` option), \`fixtures/auth.ts\` (override \`page\` to seed \`shopeasy.user\` in sessionStorage) and \`fixtures/pages.ts\`, merge them in \`fixtures/index.ts\` with \`mergeTests\`.
3. Write two tests: add *Pulse Bike Light* and *Junior Onesie*, assert the badge shows \`2\` and the cart has two lines with the right prices; then remove one line and assert the badge shows \`1\`. Assert that \`logged-in-user\` shows \`standard_user\`; add a third test with \`test.use({ loginAs: null })\` that asserts "guest".
4. Bonus: a worker fixture that registers a customer through \`POST http://localhost:5181/api/users\` with \`workerInfo.workerIndex\` in the username, and an API test that adds product 1 to that customer's cart. Run with \`--workers=2 --repeat-each=3\` and check that no username collides.`,
  problems: ['pw-009', 'pw-010', 'pw-008', 'pw-030', 'pw-041'],
}
