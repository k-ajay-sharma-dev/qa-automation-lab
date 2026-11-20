export default {
  slug: 'playwright',
  title: 'Playwright + TypeScript (+ Cucumber)',
  sections: [
    {
      heading: 'TypeScript basics for testers',
      body: `\`\`\`ts
const name: string = 'Jane';          let count = 2;            // number (inferred)
const prices: number[] = [29.99, 9.99];
type Env = 'qa' | 'staging';                                    // union = allowed values
interface User { username: string; password: string; role?: string }  // ? = optional
const toNumber = (t: string): number => Number(t.replace('$', ''));   // arrow function
class LoginPage { constructor(private readonly page: Page) {} }       // parameter property
async function open(page: Page): Promise<void> { await page.goto('login.html'); }
import { test, expect } from '@playwright/test';   export class X {}   export default {}
\`\`\`
\`===\` not \`==\` · \`const\` by default · no \`any\` (use \`unknown\` or an interface) · \`value ?? fallback\` · \`obj?.prop\`
**Every Playwright action/assertion returns a Promise → \`await\` it.** Locators themselves are not awaited.`,
    },
    {
      heading: 'Locators (priority order)',
      body: `\`\`\`ts
page.getByRole('button', { name: 'Login' })            // role + accessible name
page.getByRole('link', { name: 'Logout' })             // visible text or aria-label = name
page.getByTestId('shopping-cart-link')                 // two links are named "Cart" → role is ambiguous
page.getByLabel('Username')                            // <label for>, aria-label
page.getByPlaceholder('First Name')
page.getByText('Thank you for your order!')            // substring, case-insensitive
page.getByText('Save', { exact: true })                // whole string, case-sensitive
page.getByTestId('shopping-cart-badge')                // data-testid (config: testIdAttribute)
page.locator('#summary-total')                         // CSS / XPath — last resort
// chaining & filtering
const card = page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' });
card.getByRole('button', { name: 'Add to cart' })
rows.filter({ has: page.getByText('Inactive') })   .filter({ hasNotText: 'QA' })
locator.first()  .last()  .nth(2)                      // only when position IS the point
page.frameLocator('#support-frame').getByLabel('Your name')
\`\`\`
Locators are **lazy** (re-resolved each use, never stale) and **strict** (2+ matches on an action = error).`,
    },
    {
      heading: 'Actions',
      body: `\`\`\`ts
await page.goto('inventory.html');                     // relative to baseURL
await locator.click();  .dblclick();  .hover();  .focus();
await locator.fill('standard_user');                   // clears first (type() is deprecated)
await locator.pressSequentially('abc', { delay: 50 }); // key by key
await locator.press('Enter');     await page.keyboard.press('Control+A');
await locator.check();  .uncheck();  .setChecked(true);
await locator.selectOption('lohi');  ({ label: 'India' });  (['web', 'social']);
await locator.setInputFiles('data/licence.pdf');       // or { name, mimeType, buffer } / []
await page.getByText('Backpack').dragTo(page.locator('#droppable'));
const text = await locator.textContent();   const all = await locator.allTextContents();
const n = await locator.count();            const v = await locator.inputValue();
await page.goBack();  await page.reload();
\`\`\``,
    },
    {
      heading: 'Web-first assertions',
      body: `\`\`\`ts
await expect(page).toHaveURL(/inventory\\.html/);      await expect(page).toHaveTitle(/Products/);
await expect(locator).toBeVisible();   .toBeHidden();   .toBeEnabled();   .toBeDisabled();
await expect(locator).toHaveText('Products');          // exact (string) or RegExp
await expect(locator).toContainText('locked out');
await expect(list).toHaveText(['Junior Onesie', 'Pulse Bike Light']);  // per element
await expect(rows).toHaveCount(3);
await expect(input).toHaveValue('10001');   await expect(box).toBeChecked();
await expect(locator).toHaveAttribute('data-slug', 'retro-red-tee');   .toHaveClass(/btn-danger/);
await expect(locator).not.toBeVisible();                // negation
await expect.soft(locator).toHaveText('…');             // keep going on failure
await expect(locator).toHaveText('Completed', { timeout: 10_000 });   // per-assertion timeout
await expect.poll(async () => (await request.get('api/orders')).status()).toBe(200);
\`\`\`
**They retry** (default 5 s). \`expect(await locator.isVisible()).toBe(true)\` does **not** — avoid on UI state.`,
    },
    {
      heading: 'Waiting (without sleeping)',
      body: `| Need | Use |
|---|---|
| element ready before acting | nothing — actions auto-wait (attached, visible, stable, enabled, receives events) |
| UI reached a state | \`await expect(locator).toX()\` |
| navigation | \`await page.waitForURL('**/checkout.html')\` or \`expect(page).toHaveURL\` |
| API call finished | \`const r = page.waitForResponse(u => …); await click; await r\` |
| new tab / popup | \`context.waitForEvent('page')\` / \`page.waitForEvent('popup')\` |
| download / file chooser | \`page.waitForEvent('download')\` / \`('filechooser')\` |
| custom condition | \`expect.poll(fn)\` / \`expect(async () => {…}).toPass()\` |

Never \`page.waitForTimeout(ms)\` in a test. Timeouts: test 30 s · expect 5 s · actionTimeout / navigationTimeout in \`use\`.`,
    },
    {
      heading: 'Tests, hooks and fixtures',
      body: `\`\`\`ts
test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => { await page.goto('inventory.html'); });
  test('badge counts items', { tag: '@smoke' }, async ({ page }) => { /* … */ });
  test.skip('not ready', async () => {});   test.fixme(…);   test.slow();
});
test.beforeAll(async ({ request }) => { /* seed data — no page here */ });

// fixtures.ts
import { test as base, expect } from '@playwright/test';
type Pages = { loginPage: LoginPage; inventoryPage: InventoryPage };
export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  inventoryPage: async ({ page }, use) => { await use(new InventoryPage(page)); },
});
export { expect };
// spec: import { test, expect } from './fixtures';  test('…', async ({ loginPage }) => …)
\`\`\`
Built-in fixtures: \`page\`, \`context\`, \`browser\`, \`browserName\`, \`request\`, \`baseURL\`. Fixtures are lazy, composable, teardown after \`use()\`; \`{ scope: 'worker' }\`, \`{ auto: true }\`.`,
    },
    {
      heading: 'Page Object in TypeScript',
      body: `\`\`\`ts
export class InventoryPage extends BasePage {
  readonly title: Locator;
  readonly items: Locator;
  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
  }
  product(name: string): Locator { return this.items.filter({ hasText: name }); }
  async addToCart(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Add to cart' }).click();
  }
}
\`\`\`
readonly \`Locator\` fields · async actions · no waits · no \`expect\` inside · tests assert on exposed locators.`,
    },
    {
      heading: 'Dialogs, frames, tabs, network, API',
      body: `\`\`\`ts
page.once('dialog', d => d.accept('BRIGHT25'));        // BEFORE the click; default = dismiss
const frame = page.frameLocator('#support-frame').frameLocator('#chat-frame');
const tabP = context.waitForEvent('page'); await link.click(); const tab = await tabP;
await page.route('**/api/orders', r => r.fulfill({ status: 500, json: { error: 'x' } }));
await page.route('**/*.png', r => r.abort());          // r.continue(), r.fetch()
const resP = page.waitForResponse(r => r.url().includes('/api/orders')); await btn.click();
const res = await resP;  expect(res.status()).toBe(200);
test('api', async ({ request }) => {
  const r = await request.post('/api/cart', { data: { slug: 'junior-onesie' } });
  expect(r.ok()).toBeTruthy();  const body = await r.json();
});
\`\`\``,
    },
    {
      heading: 'playwright.config.ts',
      body: `\`\`\`ts
export default defineConfig({
  testDir: './tests', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/',   // keep trailing /
    trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
\`\`\``,
    },
    {
      heading: 'Cucumber + Playwright wiring',
      body: `\`\`\`ts
// world.ts
export class CustomWorld extends World {
  browser!: Browser; context!: BrowserContext; page!: Page;
  loginPage!: LoginPage; inventoryPage!: InventoryPage;
  constructor(o: IWorldOptions) { super(o); }
}
setWorldConstructor(CustomWorld);
// hooks.ts
setDefaultTimeout(60_000);
Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: true });
  this.context = await this.browser.newContext({ baseURL: process.env.BASE_URL });
  this.page = await this.context.newPage();
  this.loginPage = new LoginPage(this.page);  this.inventoryPage = new InventoryPage(this.page);
});
After(async function (this: CustomWorld, { result }) {
  try { if (result?.status === Status.FAILED) this.attach(await this.page.screenshot(), 'image/png'); }
  finally { await this.browser?.close(); }
});
// login.steps.ts — classic functions, NOT arrows (need this = World)
When('the shopper logs in as {string} with password {string}',
  async function (this: CustomWorld, u: string, p: string) { await this.loginPage.login(u, p); });
Then('the cart badge shows {int}', async function (this: CustomWorld, n: number) {
  await expect(this.inventoryPage.cartBadge).toHaveText(String(n)); });   // locators live in page objects
\`\`\`
\`\`\`js
// cucumber.js
const common = { paths: ['features/**/*.feature'], requireModule: ['ts-node/register'],
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  format: ['progress-bar', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'] };
module.exports = { default: { ...common, tags: 'not @wip' }, ci: { ...common, parallel: 4, retry: 1 } };
\`\`\`
DataTable: \`hashes()\` · \`rowsHash()\` · \`raw()\`. Tags: \`--tags "@smoke and not @wip"\`.`,
    },
    {
      heading: 'CLI commands',
      body: `| Command | Does |
|---|---|
| \`npm init playwright@latest\` | scaffold project, config, example, CI workflow |
| \`npx playwright install --with-deps\` | browsers + OS libraries (CI) |
| \`npx playwright test\` | run all · \`tests/cart.spec.ts:12\` one test · \`-g "badge"\` by title |
| \`--project=firefox\` · \`--headed\` · \`--workers=1\` · \`--retries=0\` · \`--repeat-each=10\` | common flags |
| \`--grep @smoke\` · \`--grep-invert @slow\` | tags in titles / \`{ tag }\` |
| \`npx playwright test --ui\` | UI mode (watch, timeline, pick locator) |
| \`npx playwright test --debug\` / \`PWDEBUG=1\` / \`await page.pause()\` | Inspector, step through |
| \`npx playwright codegen <url>\` | record actions, suggest locators |
| \`npx playwright show-report\` / \`show-trace trace.zip\` | HTML report / trace viewer |
| \`--shard=1/4\` | split across CI machines |
| \`npx cucumber-js\` · \`--profile ci\` · \`--tags "@smoke"\` · \`--dry-run\` · \`--parallel 4\` | Cucumber runs |`,
    },
  ],
}
