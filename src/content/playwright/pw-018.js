export default {
  id: 'pw-018',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Step definitions in TypeScript with a CustomWorld',
  level: 'ADVANCED',
  tags: ['cucumber-js', 'step-definitions', 'world', 'data-tables'],
  estMinutes: 30,
  scenario: `\`login.feature\` and \`cart.feature\` are approved, and \`npx cucumber-js\` prints *"Undefined. Implement with the following snippet"*
for every step. The \`CustomWorld\` (\`src/support/world.ts\`) already exposes \`this.page\`, \`this.loginPage\` and \`this.inventoryPage\` for each
scenario. A colleague started \`src/steps/shop.steps.ts\` with arrow functions and a module-level \`page\` variable — and the second
scenario always fails with *"Cannot read properties of undefined"*.`,
  description: `Implement the steps:

\`\`\`gherkin
Given the shopper is logged in as "standard_user"
When the shopper logs in as "locked_out_user" with password "secret_sauce"
When the shopper adds these products to the cart:
  | product              |
  | Trailblazer Backpack |
Then the cart badge shows 2
Then the login error "Sorry, this user has been locked out." is shown
\`\`\`

**Rules**
- Import \`Given\`/\`When\`/\`Then\` and \`DataTable\` from \`@cucumber/cucumber\`; \`expect\` from \`@playwright/test\` (web-first assertions work in Cucumber too).
- Use **\`async function (this: CustomWorld, …)\`** — not arrow functions (arrows have no \`this\`, so no World).
- Cucumber expressions \`{string}\` / \`{int}\` with typed parameters (\`username: string\`, \`count: number\`).
- Read the table with \`dataTable.hashes()\`.
- Steps call page objects; no \`this.page.locator\` / \`getBy…\` directly in steps. The password for the logged-in step comes from \`process.env.SHOP_PASS ?? 'secret_sauce'\`.`,
  starterCode: `import { Given, When, Then } from '@cucumber/cucumber';
import { Page } from '@playwright/test';

let page: Page; // shared between scenarios?!

Given('the shopper is logged in as "standard_user"', async () => {
  await page.goto('login.html');
  await page.locator('#user-name').fill('standard_user');
  await page.locator('#password').fill('secret_sauce');
  await page.locator('#login-button').click();
});

When('the shopper adds these products to the cart:', async (table) => {
  // TODO
});

Then('the cart badge shows 2', async () => {
  const text = await page.locator('.shopping-cart-badge').textContent();
  if (text !== '2') throw new Error('wrong count');
});
`,
  solution: `import { Given, When, Then, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world';

Given('the shopper is logged in as {string}', async function (this: CustomWorld, username: string) {
  await this.loginPage.goto();
  await this.loginPage.login(username, process.env.SHOP_PASS ?? 'secret_sauce');
  await expect(this.inventoryPage.title).toHaveText('Products');
});

When(
  'the shopper logs in as {string} with password {string}',
  async function (this: CustomWorld, username: string, password: string) {
    await this.loginPage.login(username, password);
  },
);

When('the shopper adds these products to the cart:', async function (this: CustomWorld, dataTable: DataTable) {
  for (const row of dataTable.hashes()) {
    await this.inventoryPage.addToCart(row.product);
  }
});

Then('the cart badge shows {int}', async function (this: CustomWorld, count: number) {
  await expect(this.inventoryPage.cartBadge).toHaveText(String(count));
});

Then('the login error {string} is shown', async function (this: CustomWorld, message: string) {
  await expect(this.loginPage.error).toContainText(message);
});
`,
  checks: [
    { label: 'Imports from @cucumber/cucumber and expect from @playwright/test', pattern: "from\\s*['\"]@cucumber/cucumber['\"][\\s\\S]*import\\s*\\{[^}]*\\bexpect\\b[^}]*\\}\\s*from\\s*['\"]@playwright/test['\"]", hint: "import { expect } from '@playwright/test';" },
    { label: 'Steps use function (this: CustomWorld)', pattern: 'async\\s+function\\s*\\(\\s*this\\s*:\\s*CustomWorld', hint: 'async function (this: CustomWorld, username: string) { ... }' },
    { label: 'No arrow-function step bodies', pattern: "(Given|When|Then)\\(\\s*['\"][^'\"]*['\"]\\s*,\\s*async\\s*\\(", mustNot: true, hint: 'Arrow functions have no this — use async function.' },
    { label: '{string} parameter typed as string', pattern: "\\{string\\}[^\\n]*['\"]\\s*,\\s*(\\n\\s*)?async\\s+function\\s*\\(\\s*this\\s*:\\s*CustomWorld\\s*,\\s*\\w+\\s*:\\s*string", hint: "Given('… {string}', async function (this: CustomWorld, username: string) { … })" },
    { label: 'Count uses {int} as number', pattern: '\\{int\\}[\\s\\S]*\\w+\\s*:\\s*number', hint: "Then('the cart badge shows {int}', async function (this: CustomWorld, count: number) …" },
    { label: 'Data table read with hashes()', pattern: '\\.hashes\\(\\)', hint: 'for (const row of dataTable.hashes()) { … row.product … }' },
    { label: 'No module-level page or raw locators in steps', pattern: '(let\\s+page\\s*:|this\\.page\\.(locator|getBy)|\\bpage\\.locator\\()', mustNot: true, hint: 'Use this.loginPage / this.inventoryPage from the World.' },
  ],
  hints: [
    'Cucumber creates a new World object for each scenario and binds it as this inside step functions — only classic functions get that binding.',
    'Run npx cucumber-js --dry-run to see which steps are undefined or ambiguous without opening a browser.',
    'Playwright expect works outside the Playwright runner; it still retries for 5 s by default.',
  ],
  explanation: `**The World** is Cucumber's per-scenario context object (like PicoContainer's \`TestContext\` in Java). Cucumber constructs a fresh
\`CustomWorld\` for every scenario and calls each step with \`this\` bound to it. Arrow functions capture \`this\` from the surrounding module
instead, so they never see the World — hence the classic \`async function (this: CustomWorld, …)\` with a typed \`this\` parameter, which gives
autocomplete on \`this.loginPage\`.

A module-level \`let page\` is shared state: scenario 2 sees the page from scenario 1 (already closed), and parallel runs mix browsers.

**Typed parameters** follow the expression: \`{string}\` → \`string\`, \`{int}\` → \`number\`, \`{float}\` → \`number\`, and a trailing table or doc string
arrives as the last argument (\`DataTable\` / \`string\`).

Using Playwright's \`expect\` in Then steps gives you web-first assertions and readable failure messages in the Cucumber report.`,
  mistakes: [
    'Arrow functions in step definitions — this is undefined, so this.page throws.',
    'Hard-coding data in the step text ("logged in as \\"standard_user\\"") instead of {string}.',
    'Forgetting await on page-object calls — the step "passes" before the action happens.',
    'Two step definitions matching the same text — Cucumber reports an "Ambiguous" step.',
  ],
  interview: [
    { q: 'What is the World in cucumber-js?', a: 'An object created fresh for every scenario and bound as this in hooks and steps. You extend it (setWorldConstructor) to hold the browser, context, page and page objects, so steps in different files share state safely within one scenario.' },
    { q: 'Why can you not use arrow functions for step definitions that need the World?', a: 'Arrow functions do not have their own this; they capture it lexically from the module, so Cucumber cannot bind the World to them.' },
    { q: 'How do you share data between steps (e.g. an order number)?', a: 'Store it on the World (this.orderNumber = …) in one step and read it in another. Never use module-level variables — they leak between scenarios and break parallel runs.' },
  ],
}
