export default {
  id: 'pw-010',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Custom fixtures that hand tests ready-made page objects',
  level: 'ADVANCED',
  tags: ['fixtures', 'test.extend', 'page-object-model'],
  estMinutes: 30,
  scenario: `Every spec now starts with the same five lines: \`new LoginPage(page)\`, \`new InventoryPage(page)\`, \`goto()\`, \`login(...)\`,
wait for Products. The tech lead wants it gone: "In Playwright we don't write BaseTest classes — we write **fixtures**. A test should just
ask for \`loggedInInventory\` and get it."`,
  description: `Create \`tests/fixtures.ts\` and use it in one test.

**Acceptance**
- Declare a type \`ShopFixtures\` with \`loginPage: LoginPage\`, \`inventoryPage: InventoryPage\`, \`loggedInInventory: InventoryPage\`.
- \`export const test = base.extend<ShopFixtures>({ … })\` where \`base\` is the \`test\` from \`@playwright/test\`.
- \`loginPage\` and \`inventoryPage\` are built from the \`page\` fixture and handed over with \`await use(...)\`.
- \`loggedInInventory\` **depends on the other two fixtures**: opens the login page, logs in with \`process.env.SHOP_USER ?? 'standard_user'\`
  / \`process.env.SHOP_PASS ?? 'secret_sauce'\`, waits until the title is \`Products\`, then \`use\`s the inventory page.
- Re-export \`expect\`.
- A test \`sorting by price low to high shows Junior Onesie first\` that **only** receives \`loggedInInventory\` — no \`new …Page\` in the test.`,
  starterCode: `import { test, expect } from '@playwright/test';
import { LoginPage, InventoryPage } from '../src/pages/pages';

test('sorting by price low to high shows Junior Onesie first', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const inventoryPage = new InventoryPage(page);
  await loginPage.goto();
  await loginPage.login('standard_user', 'secret_sauce');
  await expect(inventoryPage.title).toHaveText('Products');

  await inventoryPage.sortBy('lohi');
  await expect(inventoryPage.items.first()).toContainText('Junior Onesie');
});

// TODO: move the setup into fixtures created with test.extend
`,
  solution: `// tests/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage, InventoryPage } from '../src/pages/pages';

type ShopFixtures = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  loggedInInventory: InventoryPage;
};

export const test = base.extend<ShopFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },

  loggedInInventory: async ({ loginPage, inventoryPage }, use) => {
    await loginPage.goto();
    await loginPage.login(process.env.SHOP_USER ?? 'standard_user', process.env.SHOP_PASS ?? 'secret_sauce');
    await expect(inventoryPage.title).toHaveText('Products');
    await use(inventoryPage);
    // code after use() is teardown — nothing to clean: the context is discarded
  },
});

export { expect };

// tests/sort.spec.ts
// import { test, expect } from './fixtures';

test('sorting by price low to high shows Junior Onesie first', async ({ loggedInInventory }) => {
  await loggedInInventory.sortBy('lohi');
  await expect(loggedInInventory.items.first()).toContainText('Junior Onesie');
});
`,
  checks: [
    { label: 'Fixture types declared', pattern: 'type\\s+\\w+\\s*=\\s*\\{[^}]*loginPage\\s*:\\s*LoginPage[^}]*\\}', flags: 'ms', hint: 'type ShopFixtures = { loginPage: LoginPage; inventoryPage: InventoryPage; loggedInInventory: InventoryPage };' },
    { label: 'Extends the base test with the type', pattern: 'export\\s+const\\s+test\\s*=\\s*\\w+\\.extend<\\s*\\w+\\s*>\\(', hint: 'export const test = base.extend<ShopFixtures>({ ... })' },
    { label: 'Page objects built from page and passed to use()', pattern: 'async\\s*\\(\\s*\\{\\s*page\\s*\\}\\s*,\\s*use\\s*\\)\\s*=>\\s*\\{\\s*await\\s+use\\(\\s*new\\s+LoginPage\\(\\s*page\\s*\\)', hint: 'loginPage: async ({ page }, use) => { await use(new LoginPage(page)); }' },
    { label: 'Logged-in fixture depends on other fixtures', pattern: 'loggedInInventory\\s*:\\s*async\\s*\\(\\s*\\{\\s*(loginPage\\s*,\\s*inventoryPage|inventoryPage\\s*,\\s*loginPage)\\s*\\}\\s*,\\s*use\\s*\\)', hint: 'loggedInInventory: async ({ loginPage, inventoryPage }, use) => { ... }' },
    { label: 'Credentials come from env with a fallback', pattern: 'process\\.env\\.\\w+\\s*\\?\\?', hint: "process.env.SHOP_USER ?? 'standard_user'" },
    { label: 'Test only receives the fixture', pattern: "test\\(\\s*['\"`][^'\"`]+['\"`]\\s*,\\s*async\\s*\\(\\s*\\{\\s*loggedInInventory\\s*\\}\\s*\\)", hint: 'test(\'…\', async ({ loggedInInventory }) => { ... })' },
    { label: 'expect re-exported', pattern: 'export\\s*\\{\\s*expect\\s*\\}|export\\s*\\{\\s*expect\\s*\\}\\s*from', hint: 'export { expect };' },
  ],
  hints: [
    'A fixture is an async function ({ otherFixtures }, use) => { setup; await use(value); teardown; }.',
    'Fixtures can request other fixtures by name — Playwright builds the dependency chain page → loginPage → loggedInInventory.',
    "Spec files then import { test, expect } from './fixtures' instead of '@playwright/test'.",
  ],
  explanation: `\`test.extend\` creates a new \`test\` function that knows extra fixtures. Each fixture is **lazy**: it is only set up if a test (or
another fixture) asks for it by name, so a test that only needs \`loginPage\` never logs in.

Everything before \`await use(value)\` is setup, everything after is teardown — the Playwright equivalent of \`@BeforeMethod\`/\`@AfterMethod\`
in one place, with no inheritance hierarchy (\`BaseTest\` → \`LoggedInBaseTest\` → …). Fixtures compose instead.

The type parameter \`<ShopFixtures>\` makes \`async ({ loggedInInventory })\` fully typed: autocomplete shows \`sortBy\`, \`addToCart\`, etc.

For large suites, go one step further: log in once in a **setup project**, save \`storageState\` to a file, and let tests start already
authenticated (\`use: { storageState: '.auth/user.json' }\`). ShopEasy keeps the session in \`sessionStorage\`, which \`storageState\` does
not capture — a good example of why you must know how your app stores sessions before choosing a strategy.`,
  mistakes: [
    'Forgetting await use(...) — the test hangs or gets undefined.',
    "Importing test from '@playwright/test' in the spec instead of from './fixtures' — custom fixtures are then unknown.",
    'Doing the login in a fixture that every test gets (auto: true) even when a test wants to test the login page itself.',
    'Hard-coding credentials in the fixture instead of reading env variables/secrets.',
  ],
  interview: [
    { q: 'How do Playwright fixtures replace a BaseTest class?', a: 'Instead of inheriting setup/teardown, tests declare what they need in their arguments. Fixtures are created on demand, can depend on each other, have teardown after use(), and can be test- or worker-scoped. Composition replaces inheritance.' },
    { q: 'How would you avoid logging in through the UI in every test?', a: 'Use a setup project that logs in once and saves storageState (cookies + localStorage), then set storageState in the projects that depend on it — or log in via API in a worker-scoped fixture. Keep a few UI login tests for the login feature itself.' },
    { q: 'What is an automatic fixture?', a: 'A fixture declared with { auto: true } runs for every test even if not requested — useful for things like attaching logs or checking console errors, not for heavy setup.' },
  ],
}
