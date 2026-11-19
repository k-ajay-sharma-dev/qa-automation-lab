export default {
  slug: 'pw-pom-and-fixtures',
  category: 'playwright',
  order: 5,
  title: 'Test structure, Page Objects in TypeScript and custom fixtures',
  minutes: 10,
  summary: 'Organise tests with describe and hooks, write page objects as TypeScript classes with readonly Locators, and hand them to tests through test.extend fixtures.',
  manualAnalogy: `A manual test suite has structure: test sets per feature, shared preconditions ("logged in as a standard user"), and a glossary of screens everyone refers to. In Playwright, \`test.describe\` is the test set, hooks and fixtures are the shared preconditions, and page objects are the glossary of screens.`,
  body: `## describe and hooks

\`\`\`ts
import { test, expect } from '@playwright/test';

test.describe('Checkout information', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('checkout.html');
  });

  test('postcode is required', async ({ page }) => {
    await page.getByLabel('First Name').fill('Jane');
    await page.getByLabel('Last Name').fill('Doe');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toContainText('Postal Code is required');
  });
});
\`\`\`

- \`test.describe(title, () => { ... })\` groups tests; titles are nested in the report ("Checkout information › postcode is required").
- \`test.beforeEach\` / \`test.afterEach\` run around **every** test in the block and receive the same fixtures (\`{ page }\`).
- \`test.beforeAll\` / \`test.afterAll\` run once per worker — they **cannot** use \`page\` (it is per test). Use them for things like seeding data via API.
- Annotations: \`test.skip()\`, \`test.fixme()\`, \`test.slow()\` (triples the timeout), \`test.only\` (local use only), tags in titles or \`{ tag: '@smoke' }\` for \`--grep @smoke\`.

Each test still gets a fresh context — \`beforeEach\` reduces duplication, it does not create shared state.

## Page objects, the Playwright way

The idea is the same as in Selenium: one class per screen, locators in one place, tests talk in actions. The details differ:

\`\`\`ts
// src/pages/CheckoutPage.ts
import type { Locator, Page } from '@playwright/test';

export class CheckoutPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly error: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.firstName = page.getByLabel('First Name');
    this.lastName = page.getByLabel('Last Name');
    this.postalCode = page.getByLabel('Zip/Postal Code');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.error = page.getByRole('alert');
    this.total = page.getByTestId('total-label');
  }

  async goto(): Promise<void> {
    await this.page.goto('checkout.html');
  }

  async enterCustomer(first: string, last: string, postcode: string): Promise<void> {
    await this.firstName.fill(first);
    await this.lastName.fill(last);
    await this.postalCode.fill(postcode);
    await this.continueButton.click();
  }
}
\`\`\`

What changed compared with Java:

- **Locators are fields of type \`Locator\`**, assigned in the constructor. They are lazy, so creating them early is safe (no \`PageFactory\`, no stale elements).
- **Actions are \`async\`** and return \`Promise<…>\`; the test awaits them.
- **No waits** inside page objects — actions auto-wait.
- **Locators are usually public \`readonly\`**, so tests can use web-first assertions on them: \`await expect(checkout.total).toContainText('$43.18')\`. The page object still contains **no \`expect\`** — what is "correct" is the test's decision.
- Methods that pick from lists take business data and return a \`Locator\`: \`item(name: string): Locator { return this.page.getByTestId('inventory-item').filter({ hasText: name }); }\`.

A **BasePage** (\`abstract class\` with \`constructor(protected readonly page: Page)\`) holds shared parts like the header's cart badge or a helper \`open(path)\`. Subclasses call \`super(page)\`. Keep it small — a 600-line BasePage is a smell. Components that appear on several pages (header, product card) can be their own small classes that take a root \`Locator\`.

## Fixtures: dependency injection for tests

Creating page objects in every test (\`const checkout = new CheckoutPage(page)\`) is repetitive. Playwright's answer is **custom fixtures** via \`test.extend\`:

\`\`\`ts
// tests/fixtures.ts
import { test as base } from '@playwright/test';
import { CartPage } from '../src/pages/CartPage';
import { CheckoutPage } from '../src/pages/CheckoutPage';

type Pages = { cartPage: CartPage; checkoutPage: CheckoutPage };

export const test = base.extend<Pages>({
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();          // setup
    await use(checkout);            // the test runs here
    // teardown would go here
  },
});
export { expect } from '@playwright/test';
\`\`\`

\`\`\`ts
// tests/checkout.spec.ts
import { test, expect } from './fixtures';

test('postcode is required', async ({ checkoutPage }) => {
  await checkoutPage.enterCustomer('Jane', 'Doe', '');
  await expect(checkoutPage.error).toContainText('Postal Code is required');
});
\`\`\`

How fixtures work:

- A fixture is \`async ({ otherFixtures }, use) => { setup; await use(value); teardown; }\`.
- It is created **only if a test (or another fixture) asks for it** by name in its arguments.
- Fixtures can depend on fixtures — \`page\` → \`checkoutPage\` → a hypothetical \`filledCheckout\`. That composition replaces Java's \`BaseTest\` inheritance chains.
- The type parameter (\`base.extend<Pages>\`) gives autocomplete and type checking in every test.
- Scope: test-scoped by default; \`{ scope: 'worker' }\` for expensive things shared by a worker (e.g. an API token). \`{ auto: true }\` runs a fixture for every test.

## Where things go

\`\`\`
src/pages/        BasePage.ts, LoginPage.ts, InventoryPage.ts, CheckoutPage.ts
tests/fixtures.ts test.extend with page-object fixtures
tests/*.spec.ts   import { test, expect } from './fixtures'
\`\`\``,
  keyPoints: [
    'test.describe groups tests; beforeEach/afterEach run per test with the same fixtures; beforeAll cannot use page.',
    'Page objects: readonly Locator fields set in the constructor, async action methods, no waits, no expect.',
    'Expose locators so tests can use web-first assertions on them.',
    'test.extend fixtures create page objects on demand, compose with each other and have teardown after use().',
    'Specs import test/expect from your fixtures file, not from @playwright/test.',
  ],
  mistakes: [
    'Sharing one page between tests with beforeAll — breaks isolation and parallelism.',
    'Returning booleans like isErrorShown(): Promise<boolean> from page objects — tests lose retrying assertions.',
    'Forgetting await use(...) in a fixture — the test never gets its value.',
    "Importing test from '@playwright/test' in a spec that needs custom fixtures — they are then unknown.",
  ],
  tryIt: `On \`http://localhost:5180/practice-site/checkout.html\` click *Continue* with all fields empty and read the error. List the locators a \`CheckoutPage\` needs for step one, choosing getByLabel/getByRole for each — which one has no good user-facing option?`,
  problems: ['pw-006', 'pw-009', 'pw-010'],
}
