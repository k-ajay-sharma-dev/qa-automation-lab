// A complete reference framework (TypeScript + Playwright + Cucumber + Page Object Model) for the ShopEasy
// practice site. Shown on the Framework Blueprint page, file by file.
// Shape shared by every blueprint in this folder (see FrameworkPage):
// { id, order, label, stack, intro, tree, files: [{ path, why, lang, code }], commands: [[label, cmd]] }

const TREE = `shopeasy-playwright-tests/
├── package.json                  ← dependencies & npm scripts
├── tsconfig.json                 ← TypeScript settings (strict)
├── playwright.config.ts          ← browsers, baseURL, retries, trace, reporters
├── cucumber.js                   ← Cucumber profiles: paths, glue, tags, formats
├── .github/workflows/playwright.yml  ← CI pipeline
├── features/
│   └── login.feature             ← Gherkin (business-readable)
├── src/
│   ├── data/users.ts             ← typed test data
│   ├── pages/                    ← Page Object Model
│   │   ├── BasePage.ts
│   │   ├── LoginPage.ts
│   │   └── InventoryPage.ts
│   ├── support/
│   │   ├── world.ts              ← CustomWorld: browser, context, page, pages
│   │   └── hooks.ts              ← Before / After, screenshot + trace on failure
│   └── steps/login.steps.ts      ← Cucumber step definitions
└── tests/
    ├── fixtures.ts               ← test.extend: page objects as fixtures
    └── shop.spec.ts              ← pure @playwright/test spec`

const FILES = [
  {
    path: 'package.json',
    why: 'Node\'s equivalent of pom.xml: the libraries (devDependencies) and the commands (scripts). npm ci installs exactly what package-lock.json pins; browsers are installed separately with npx playwright install.',
    lang: 'json',
    code: `{
  "name": "shopeasy-playwright-tests",
  "version": "1.0.0",
  "private": true,
  "description": "UI tests for the ShopEasy practice site: Playwright + TypeScript + Cucumber",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed --project=chromium",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report",
    "bdd": "cucumber-js",
    "bdd:smoke": "cucumber-js --profile smoke",
    "bdd:ci": "cucumber-js --profile ci",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cucumber/cucumber": "^10.9.0",
    "@playwright/test": "^1.48.2",
    "@types/node": "^20.16.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}`,
  },
  {
    path: 'tsconfig.json',
    why: 'strict mode turns on the checks that make TypeScript worth it (no implicit any, null checks). CommonJS modules let Cucumber load the .ts files through ts-node; transpileOnly keeps start-up fast (run npm run typecheck for full checking).',
    lang: 'json',
    code: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "playwright.config.ts"],
  "ts-node": {
    "transpileOnly": true
  }
}`,
  },
  {
    path: 'playwright.config.ts',
    why: 'One file replaces config.properties, DriverFactory, testng.xml and report listeners: environment via BASE_URL, three browser engines as projects, retries and traces only on CI, HTML + JUnit reports.',
    lang: 'typescript',
    code: `import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,                 // a forgotten test.only fails the CI run
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    // keep the trailing slash: page.goto('login.html') resolves under /practice-site/
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/',
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});`,
  },
  {
    path: 'cucumber.js',
    why: 'Cucumber\'s runner configuration (the @CucumberOptions of the Java world). ts-node/register lets Cucumber load TypeScript; profiles keep smoke, default and CI settings in version control.',
    lang: 'javascript',
    code: `// Run: npx cucumber-js            (default profile)
//      npx cucumber-js --profile smoke
//      npx cucumber-js --profile ci
const common = {
  paths: ['features/**/*.feature'],
  requireModule: ['ts-node/register'],
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  format: [
    'progress-bar',
    'html:reports/cucumber-report.html',
    'json:reports/cucumber-report.json',
  ],
  formatOptions: { snippetInterface: 'async-await' },
};

module.exports = {
  default: { ...common, tags: 'not @wip' },
  smoke: { ...common, tags: '@smoke and not @wip' },
  ci: { ...common, tags: 'not @wip and not @manual', parallel: 3, retry: 1 },
};`,
  },
  {
    path: 'src/data/users.ts',
    why: 'Typed test data: the interface makes a misspelled key a compile error, and the union type limits roles to the ones that exist. Credentials can be overridden by environment variables in CI.',
    lang: 'typescript',
    code: `export type UserRole = 'standard' | 'locked';

export interface User {
  username: string;
  password: string;
  role: UserRole;
  expectedError?: string;
}

const PASSWORD = process.env.SHOP_PASS ?? 'secret_sauce';

export const users: User[] = [
  { username: process.env.SHOP_USER ?? 'standard_user', password: PASSWORD, role: 'standard' },
  {
    username: 'locked_out_user',
    password: PASSWORD,
    role: 'locked',
    expectedError: 'Sorry, this user has been locked out.',
  },
];

export const userFor = (role: UserRole): User => {
  const user = users.find((u) => u.role === role);
  if (!user) throw new Error('No test user configured for role ' + role);
  return user;
};`,
  },
  {
    path: 'src/pages/BasePage.ts',
    why: 'What every ShopEasy page shares: the Page, the header (cart badge and logout) and a relative open(). No waits — Playwright actions auto-wait.',
    lang: 'typescript',
    code: `import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  readonly cartBadge: Locator;
  readonly cartLink: Locator;
  readonly logoutLink: Locator;

  constructor(protected readonly page: Page) {
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    // Not getByRole('link', { name: 'Cart' }): the header also has a "Cart" text link → strict-mode violation.
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.logoutLink = page.getByTestId('logout-link');
  }

  /** path is relative to baseURL, e.g. 'login.html' (no leading slash) */
  async open(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async logout(): Promise<void> {
    await this.logoutLink.click();
  }
}`,
  },
  {
    path: 'src/pages/LoginPage.ts',
    why: 'User-facing locators (label, role) as readonly fields, created once in the constructor — they are lazy, so they never go stale. Tests assert on the exposed locators; the page object holds no expect().',
    lang: 'typescript',
    code: `import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly rememberMe: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;
  readonly closeError: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.rememberMe = page.getByLabel('Remember me');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.error = page.getByRole('alert');
    this.closeError = page.getByRole('button', { name: 'Close error' });
  }

  async goto(): Promise<void> {
    await this.open('login.html');
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}`,
  },
  {
    path: 'src/pages/InventoryPage.ts',
    why: 'Lists are handled with filter({ hasText }) on business data (the product name) instead of positions or one locator per product. The SortOption union makes an invalid sort value a compile error.',
    lang: 'typescript',
    code: `import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage extends BasePage {
  readonly title: Locator;
  readonly sortSelect: Locator;
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('title');
    this.sortSelect = page.getByLabel('Sort by');
    this.items = page.getByTestId('inventory-item');
    this.itemNames = this.items.locator('.item-name');
    this.itemPrices = this.items.locator('.item-price');
  }

  async goto(): Promise<void> {
    await this.open('inventory.html');
  }

  product(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async addToCart(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeFromCart(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Remove' }).click();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sortSelect.selectOption(option);
  }

  async prices(): Promise<number[]> {
    const texts = await this.itemPrices.allTextContents();
    return texts.map((t) => Number(t.replace('$', '')));
  }
}`,
  },
  {
    path: 'src/support/world.ts',
    why: 'Cucumber creates a new World per scenario and passes it as this to every hook and step — the TypeScript counterpart of the PicoContainer TestContext. It holds the browser, context, page and page objects.',
    lang: 'typescript',
    code: `import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { InventoryPage } from '../pages/InventoryPage';
import { LoginPage } from '../pages/LoginPage';

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  loginPage!: LoginPage;
  inventoryPage!: InventoryPage;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** called from the Before hook once the page exists */
  initPages(): void {
    this.loginPage = new LoginPage(this.page);
    this.inventoryPage = new InventoryPage(this.page);
  }
}

setWorldConstructor(CustomWorld);`,
  },
  {
    path: 'src/support/hooks.ts',
    why: 'A fresh browser and context per scenario (full isolation), a trace recorded for every scenario but kept only on failure, a screenshot attached to the Cucumber report when a scenario fails, and try/finally so the browser is always closed.',
    lang: 'typescript',
    code: `import { After, Before, Status, setDefaultTimeout, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import type { CustomWorld } from './world';

// Cucumber's default step timeout is 5 s — too short for browser start-up on CI.
setDefaultTimeout(60_000);

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180/practice-site/',
    viewport: { width: 1366, height: 768 },
  });
  await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  this.page = await this.context.newPage();
  this.initPages();
});

After(async function (this: CustomWorld, { result, pickle }: ITestCaseHookParameter) {
  try {
    if (result?.status === Status.FAILED && this.page) {
      const png = await this.page.screenshot({ fullPage: true });
      this.attach(png, 'image/png');
      const name = pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await this.context.tracing.stop({ path: 'reports/traces/' + name + '.zip' });
      this.attach('Trace: npx playwright show-trace reports/traces/' + name + '.zip', 'text/plain');
    } else {
      await this.context?.tracing.stop();
    }
  } finally {
    await this.context?.close();
    await this.browser?.close();
  }
});`,
  },
  {
    path: 'features/login.feature',
    why: 'The business-readable specification. Declarative steps (what, not how), a Background for the shared precondition, a Scenario Outline for the negative cases and tags that drive the profiles.',
    lang: 'gherkin',
    code: `@login
Feature: Login
  As a ShopEasy customer
  I want to log in with my account
  So that I can buy products

  Background:
    Given the shopper is on the login page

  @smoke
  Scenario: Registered shopper logs in successfully
    When the shopper logs in as "standard_user" with password "secret_sauce"
    Then the products page is shown

  @smoke
  Scenario: Added products are counted in the cart badge
    Given the shopper logs in as "standard_user" with password "secret_sauce"
    When the shopper adds these products to the cart:
      | product              |
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    Then the cart badge shows 2

  @regression
  Scenario Outline: Login is refused with a clear message
    When the shopper logs in as "<username>" with password "<password>"
    Then the login error "<error>" is shown

    Examples:
      | username        | password     | error                                                       |
      | locked_out_user | secret_sauce | Sorry, this user has been locked out.                       |
      | standard_user   | wrong_pass   | Username and password do not match any user in this service |
      |                 | secret_sauce | Username is required                                        |`,
  },
  {
    path: 'src/steps/login.steps.ts',
    why: 'Thin glue: Cucumber expressions with typed parameters, classic functions so this is the CustomWorld, page-object calls only, and Playwright\'s web-first expect for the Then steps.',
    lang: 'typescript',
    code: `import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world';

Given('the shopper is on the login page', async function (this: CustomWorld) {
  await this.loginPage.goto();
});

// Given/When/Then are interchangeable for matching — one definition serves both keywords
When(
  'the shopper logs in as {string} with password {string}',
  async function (this: CustomWorld, username: string, password: string) {
    await this.loginPage.login(username, password);
  },
);

When('the shopper adds these products to the cart:', async function (this: CustomWorld, table: DataTable) {
  for (const row of table.hashes()) {
    await this.inventoryPage.addToCart(row.product);
  }
});

Then('the products page is shown', async function (this: CustomWorld) {
  await expect(this.page).toHaveURL(/inventory\\.html/);
  await expect(this.inventoryPage.title).toHaveText('Products');
});

Then('the cart badge shows {int}', async function (this: CustomWorld, count: number) {
  await expect(this.inventoryPage.cartBadge).toHaveText(String(count));
});

Then('the login error {string} is shown', async function (this: CustomWorld, message: string) {
  await expect(this.loginPage.error).toContainText(message);
});`,
  },
  {
    path: 'tests/fixtures.ts',
    why: 'Playwright\'s replacement for a BaseTest class: page objects and a logged-in state are fixtures that tests request by name. They are created only when asked for and can depend on each other.',
    lang: 'typescript',
    code: `import { test as base, expect } from '@playwright/test';
import { userFor } from '../src/data/users';
import { InventoryPage } from '../src/pages/InventoryPage';
import { LoginPage } from '../src/pages/LoginPage';

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
    const user = userFor('standard');
    await loginPage.goto();
    await loginPage.login(user.username, user.password);
    await expect(inventoryPage.title).toHaveText('Products');
    await use(inventoryPage);
  },
});

export { expect };`,
  },
  {
    path: 'tests/shop.spec.ts',
    why: 'A pure @playwright/test spec: imports test/expect from the fixtures file, asks only for the page objects it needs, and uses web-first assertions — no waits, no setup boilerplate.',
    lang: 'typescript',
    code: `import { userFor } from '../src/data/users';
import { expect, test } from './fixtures';

test.describe('Login', () => {
  test('standard user lands on Products', { tag: '@smoke' }, async ({ loginPage, inventoryPage, page }) => {
    const user = userFor('standard');
    await loginPage.goto();
    await loginPage.login(user.username, user.password);

    await expect(page).toHaveURL(/inventory\\.html/);
    await expect(inventoryPage.title).toHaveText('Products');
  });

  test('locked out user sees an error', async ({ loginPage }) => {
    const user = userFor('locked');
    await loginPage.goto();
    await loginPage.login(user.username, user.password);

    await expect(loginPage.error).toContainText(user.expectedError ?? '');
    await loginPage.closeError.click();
    await expect(loginPage.error).toBeHidden();
  });
});

test.describe('Inventory', () => {
  test('cart badge counts added products', { tag: '@smoke' }, async ({ loggedInInventory }) => {
    await loggedInInventory.addToCart('Trailblazer Backpack');
    await loggedInInventory.addToCart('Pulse Bike Light');

    await expect(loggedInInventory.cartBadge).toHaveText('2');
    await expect(loggedInInventory.product('Pulse Bike Light').getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('sorting by price low to high', async ({ loggedInInventory }) => {
    await loggedInInventory.sortBy('lohi');

    await expect(loggedInInventory.itemNames.first()).toHaveText('Junior Onesie');
    const prices = await loggedInInventory.prices();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});`,
  },
  {
    path: '.github/workflows/playwright.yml',
    why: 'CI on every push and pull request: install dependencies and browsers, run the Playwright specs on all projects and the Cucumber smoke profile, and always upload the reports — failed runs are the ones you need evidence for.',
    lang: 'yaml',
    code: `name: UI tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  playwright:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      BASE_URL: \${{ vars.SHOPEASY_BASE_URL }}
      SHOP_PASS: \${{ secrets.SHOP_PASS }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install browsers
        run: npx playwright install --with-deps

      - name: Type check
        run: npm run typecheck

      - name: Playwright specs
        run: npx playwright test

      - name: Cucumber smoke scenarios
        if: \${{ !cancelled() }}
        run: npx cucumber-js --profile smoke

      - name: Upload Playwright report
        if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload Cucumber report and traces
        if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: cucumber-report
          path: reports/
          retention-days: 14`,
  },
]

const COMMANDS = [
  ['Install everything', 'npm ci && npx playwright install'],
  ['Run all Playwright specs', 'npx playwright test'],
  ['One browser, headed', 'npx playwright test --project=chromium --headed'],
  ['Only @smoke specs', 'npx playwright test --grep @smoke'],
  ['UI mode (watch + time travel)', 'npx playwright test --ui'],
  ['Debug one test step by step', 'npx playwright test tests/shop.spec.ts --debug'],
  ['Record locators with codegen', 'npx playwright codegen http://localhost:5180/practice-site/login.html'],
  ['Open the HTML report', 'npx playwright show-report'],
  ['Cucumber, default profile', 'npx cucumber-js'],
  ['Cucumber smoke scenarios', 'npx cucumber-js --profile smoke'],
  ['Cucumber by tag, headed', 'HEADLESS=false npx cucumber-js --tags "@login and @regression"'],
  ['Against staging', 'BASE_URL=https://staging.shopeasy.example/ npx playwright test'],
  ['Open a failure trace', 'npx playwright show-trace reports/traces/<scenario>.zip'],
]

export default {
  id: 'playwright-cucumber',
  order: 2,
  label: 'Playwright + Cucumber (TypeScript)',
  stack: 'TypeScript 5 · Playwright 1.48 · @playwright/test · Cucumber-JS 10 · Node 20',
  intro:
    'A complete TypeScript + Playwright framework for the ShopEasy practice site, with both a pure @playwright/test suite (page objects as fixtures) and a Cucumber BDD layer (CustomWorld, hooks, step definitions) sharing the same page objects — plus config and a GitHub Actions pipeline.',
  tree: TREE,
  files: FILES,
  commands: COMMANDS,
}
