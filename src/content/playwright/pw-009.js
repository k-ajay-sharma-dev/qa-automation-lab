export default {
  id: 'pw-009',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Page Object Model in TypeScript: BasePage, LoginPage, InventoryPage',
  level: 'INTERMEDIATE',
  tags: ['page-object-model', 'typescript', 'classes', 'locators'],
  estMinutes: 30,
  scenario: `Twenty Playwright specs now exist and \`getByLabel('Username')\` is copy-pasted into fourteen of them. When the product owner
renamed the button from "Sign in" to "Login" last sprint, someone had to fix 19 files. Time to port the Java page objects
(\`BasePage\`, \`LoginPage\`, \`InventoryPage\`) to TypeScript — but the Playwright way: locators as \`readonly Locator\` fields, async actions, no waits.`,
  description: `Write \`src/pages/pages.ts\` with three classes.

**BasePage** (abstract)
- \`constructor(protected readonly page: Page)\`; a \`readonly cartBadge: Locator\` (\`data-testid="shopping-cart-badge"\`).
- \`async open(path: string)\` that calls \`page.goto(path)\` (paths are relative to \`baseURL\`).

**LoginPage extends BasePage**
- \`readonly\` locators for username, password, login button and the error banner — user-facing locators.
- \`async goto()\` opens \`login.html\`; \`async login(username: string, password: string): Promise<void>\`.

**InventoryPage extends BasePage**
- \`readonly title\` (\`data-testid="title"\`) and \`readonly sortSelect\` (label **Sort by**).
- \`product(name: string): Locator\` returns the card filtered by name; \`async addToCart(name: string)\`.
- \`async sortBy(option: 'az' | 'za' | 'lohi' | 'hilo')\`.

**Rules**: no \`expect\` inside page objects (assertions stay in tests), no \`waitForTimeout\`, no \`any\`.`,
  starterCode: `import { Page } from '@playwright/test';

export class LoginPage {
  page: any;
  constructor(page) {
    this.page = page;
  }

  async login(username, password) {
    await this.page.goto('login.html');
    await this.page.locator('#user-name').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#login-button').click();
    await this.page.waitForTimeout(2000);
    expect(this.page.url()).toContain('inventory');
  }
}

// TODO: BasePage and InventoryPage
`,
  solution: `import type { Locator, Page } from '@playwright/test';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export abstract class BasePage {
  readonly cartBadge: Locator;

  constructor(protected readonly page: Page) {
    this.cartBadge = page.getByTestId('shopping-cart-badge');
  }

  async open(path: string): Promise<void> {
    await this.page.goto(path);
  }
}

export class LoginPage extends BasePage {
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

  async goto(): Promise<void> {
    await this.open('login.html');
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}

export class InventoryPage extends BasePage {
  readonly title: Locator;
  readonly sortSelect: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('title');
    this.sortSelect = page.getByLabel('Sort by');
    this.items = page.getByTestId('inventory-item');
  }

  product(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async addToCart(name: string): Promise<void> {
    await this.product(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sortSelect.selectOption(option);
  }
}
`,
  checks: [
    { label: 'Abstract BasePage with protected readonly page', pattern: 'abstract\\s+class\\s+BasePage[\\s\\S]*constructor\\s*\\(\\s*protected\\s+readonly\\s+page\\s*:\\s*Page\\s*\\)', hint: 'export abstract class BasePage { constructor(protected readonly page: Page) {} }' },
    { label: 'Pages extend BasePage and call super(page)', pattern: 'class\\s+LoginPage\\s+extends\\s+BasePage[\\s\\S]*super\\(\\s*page\\s*\\)[\\s\\S]*class\\s+InventoryPage\\s+extends\\s+BasePage', hint: 'class LoginPage extends BasePage { constructor(page: Page) { super(page); ... } }' },
    { label: 'Locators are readonly Locator fields', pattern: 'readonly\\s+\\w+\\s*:\\s*Locator', hint: 'readonly username: Locator;' },
    { label: 'Typed async login returning Promise<void>', pattern: 'async\\s+login\\s*\\(\\s*\\w+\\s*:\\s*string\\s*,\\s*\\w+\\s*:\\s*string\\s*\\)\\s*:\\s*Promise<void>', hint: 'async login(username: string, password: string): Promise<void>' },
    { label: 'product() filters the cards by name', pattern: 'product\\s*\\(\\s*\\w+\\s*:\\s*string\\s*\\)\\s*:\\s*Locator[\\s\\S]*filter\\(\\s*\\{\\s*hasText', hint: 'product(name: string): Locator { return this.items.filter({ hasText: name }); }' },
    { label: 'Sort uses selectOption', pattern: '\\.selectOption\\(', hint: 'await this.sortSelect.selectOption(option);' },
    { label: 'No expect / waitForTimeout / any in page objects', pattern: '(\\bexpect\\s*\\(|waitForTimeout|:\\s*any\\b)', mustNot: true, hint: 'Assertions belong in tests; Playwright waits for you; type everything.' },
  ],
  hints: [
    'Declare locators as readonly fields and assign them in the constructor — creating a Locator does not touch the browser.',
    'BasePage holds what every page shares: the page itself, the header (cart badge), open().',
    "A string-literal union ('az' | 'za' | …) means a typo like sortBy('low') fails at compile time.",
  ],
  explanation: `In Playwright a \`Locator\` is **lazy**: it is a recipe, resolved every time you act on it. So unlike Selenium's \`WebElement\`
(which goes stale), it is safe to build locators once in the constructor and keep them as \`readonly\` fields. There is no \`PageFactory\`
and no \`@FindBy\` — and none needed.

Actions are \`async\` and return \`Promise<void>\`; tests \`await\` them. Because actions auto-wait, the page object contains **no waiting code**.

Assertions stay in tests (\`await expect(loginPage.error).toContainText(...)\`). Exposing locators as public \`readonly\` fields is the
Playwright convention exactly so that tests can use web-first assertions on them. Navigation methods can return the next page
object (\`login()\` → \`InventoryPage\`) if your team prefers fluent flows; here the fixtures (next problem) will create both pages.`,
  mistakes: [
    'Storing the result of await locator.elementHandle() in a field — element handles go stale like WebElements; keep Locators.',
    'Putting expect() inside page objects — the page object then decides what "correct" means for every test.',
    'Making locators private and adding isErrorVisible(): Promise<boolean> — you lose web-first retries; expose readonly Locators instead.',
    "Building URLs with leading slashes ('/login.html') — that drops the /practice-site/ part of baseURL.",
  ],
  interview: [
    { q: 'How is POM in Playwright different from Selenium POM?', a: 'Locators are lazy objects created in the constructor (no PageFactory, no stale elements), actions are async, and no waits are needed in the page object. Page objects are usually provided to tests by fixtures instead of being created in each test.' },
    { q: 'Should page objects contain assertions?', a: 'Generally no: they model the page and its actions; tests decide what is expected. Exposing readonly Locators lets tests use web-first assertions. Some teams allow small guard checks such as "page loaded" inside navigation methods.' },
    { q: 'What goes in a BasePage?', a: 'The page instance and things shared by all pages: header/footer components, navigation helpers like open(path), common waits for app-specific loaders. Avoid turning it into a dumping ground of utilities.' },
  ],
}
