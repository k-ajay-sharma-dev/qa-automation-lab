export default {
  id: 'pw-029',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Log in once: a setup project, storageState and the sessionStorage catch',
  level: 'ADVANCED',
  tags: ['storageState', 'setup-project', 'dependencies', 'sessionStorage', 'authentication'],
  estMinutes: 35,
  scenario: `The suite has 240 tests and 230 of them start with a UI login — about 4 minutes of every CI run is spent typing \`standard_user\`.
The tech lead asks for the standard Playwright pattern: **log in once in a setup project, save the state, start every test already logged
in**. A colleague tried it with \`storageState\` alone and every test landed on the products page as *guest*. The reason: ShopEasy keeps
the logged-in user in **sessionStorage** (\`shopeasy.user\`), and \`storageState\` saves cookies and localStorage only.`,
  description: `Write three files (shown together in one editor).

**tests/auth.setup.ts**
- \`import { test as setup, expect }\`; one \`setup(...)\` that logs in through the UI (credentials from \`process.env\` with fallbacks), ticks
  **Remember me**, and waits for the *Products* title.
- Save \`page.context().storageState({ path: 'playwright/.auth/user.json' })\` (cookies + localStorage, which includes the remembered username).
- Save sessionStorage yourself: \`page.evaluate(() => JSON.stringify(sessionStorage))\` written to \`playwright/.auth/session.json\` with \`fs\`.

**playwright.config.ts** (projects only)
- A \`setup\` project matching \`*.setup.ts\`; a \`chromium\` project with \`storageState: 'playwright/.auth/user.json'\` and \`dependencies: ['setup']\`.

**tests/fixtures.ts** + one test
- Extend \`test\` and override the \`context\` fixture: read \`session.json\` and register \`context.addInitScript(...)\` that copies the saved
  entries into \`sessionStorage\` **only if the key is missing**, then \`use(context)\`.
- A test that opens \`inventory.html\` directly and expects \`data-testid="logged-in-user"\` to read \`standard_user\`, and that the
  login page's *Username* field is pre-filled (\`toHaveValue\`) thanks to localStorage.`,
  starterCode: `// tests/inventory.spec.ts — every spec starts like this today
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByTestId('title')).toHaveText('Products');
});

test('shows the logged-in user', async ({ page }) => {
  await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user');
});

// playwright.config.ts
// projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
`,
  solution: `// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';

export const AUTH_FILE = 'playwright/.auth/user.json';
export const SESSION_FILE = 'playwright/.auth/session.json';

setup('log in as the standard user', async ({ page }) => {
  await page.goto('login.html');
  await page.getByLabel('Username').fill(process.env.SHOP_USER ?? 'standard_user');
  await page.getByLabel('Password').fill(process.env.SHOP_PASS ?? 'secret_sauce');
  await page.getByLabel('Remember me').check();
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByTestId('title')).toHaveText('Products');

  // cookies + localStorage (Remember me) for every origin
  await page.context().storageState({ path: AUTH_FILE });

  // sessionStorage is NOT part of storageState — save it ourselves
  const session = await page.evaluate(() => JSON.stringify(sessionStorage));
  fs.mkdirSync('playwright/.auth', { recursive: true });
  fs.writeFileSync(SESSION_FILE, session, 'utf-8');
});

// playwright.config.ts (projects)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\\.setup\\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});

// tests/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    const saved = fs.readFileSync(SESSION_FILE, 'utf-8');
    await context.addInitScript((json: string) => {
      const entries = JSON.parse(json) as Record<string, string>;
      for (const [key, value] of Object.entries(entries)) {
        if (window.sessionStorage.getItem(key) === null) {
          window.sessionStorage.setItem(key, value);
        }
      }
    }, saved);
    await use(context);
  },
});
export { expect } from '@playwright/test';

// tests/inventory.spec.ts  (import { test, expect } from './fixtures')
test('starts logged in without touching the login form', async ({ page }) => {
  await page.goto('inventory.html');
  await expect(page.getByTestId('logged-in-user')).toHaveText('standard_user');
  await expect(page.getByText('You are browsing as a guest')).toBeHidden();

  await page.goto('login.html');
  await expect(page.getByLabel('Username')).toHaveValue('standard_user');
});
`,
  checks: [
    { label: 'Setup test saves storageState to a file', pattern: 'storageState\\(\\s*\\{\\s*path\\s*:', hint: "await page.context().storageState({ path: 'playwright/.auth/user.json' });" },
    { label: 'sessionStorage captured with page.evaluate', pattern: 'evaluate\\([^;]*sessionStorage', hint: 'const session = await page.evaluate(() => JSON.stringify(sessionStorage));' },
    { label: 'Setup project matched by file name', pattern: "name\\s*:\\s*['\"]setup['\"]\\s*,\\s*testMatch\\s*:", hint: "{ name: 'setup', testMatch: /.*\\.setup\\.ts/ }" },
    { label: 'Browser project depends on setup and uses the state', pattern: "storageState\\s*:\\s*['\"][^'\"]+\\.json['\"][\\s\\S]*dependencies\\s*:\\s*\\[\\s*['\"]setup['\"]\\s*\\]|dependencies\\s*:\\s*\\[\\s*['\"]setup['\"]\\s*\\][\\s\\S]*storageState\\s*:\\s*['\"][^'\"]+\\.json['\"]", hint: "use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' }, dependencies: ['setup']" },
    { label: 'sessionStorage restored with addInitScript in a context fixture', pattern: 'context\\s*:\\s*async\\s*\\(\\s*\\{\\s*context\\s*\\}\\s*,\\s*use\\s*\\)[\\s\\S]*addInitScript\\(', hint: 'context: async ({ context }, use) => { await context.addInitScript(…); await use(context); }' },
    { label: 'Only missing keys are restored', pattern: 'getItem\\([^)]*\\)\\s*===\\s*null|!\\s*window\\.sessionStorage\\.getItem\\(|!\\s*sessionStorage\\.getItem\\(', hint: 'if (window.sessionStorage.getItem(key) === null) { … }' },
    { label: 'No UI login in beforeEach', pattern: 'beforeEach\\([\\s\\S]*getByRole\\(\\s*[\'"]button[\'"]\\s*,\\s*\\{\\s*name\\s*:\\s*[\'"]Login', mustNot: true, hint: 'The setup project logs in once; specs start logged in.' },
  ],
  hints: [
    "A project with dependencies: ['setup'] runs only after every test of the setup project has passed — and the setup runs once, not per test.",
    'storageState() captures cookies, localStorage (and optionally IndexedDB) — sessionStorage is per tab and is not included.',
    'context.addInitScript runs in every page of the context before the page\'s own scripts — the right moment to put sessionStorage back.',
  ],
  explanation: `**Setup projects** are the modern replacement for \`globalSetup\`: the login is a real Playwright test, so it gets traces,
retries, the HTML report and fixtures. \`dependencies: ['setup']\` makes the browser projects wait for it; it runs **once per run**, not once
per test or per worker.

\`storageState\` writes a JSON file with cookies and localStorage per origin; a project's \`use.storageState\` loads it into every new
context. For cookie- or token-in-localStorage apps that is all you need.

ShopEasy keeps its session in **sessionStorage** — on purpose, it disappears when the tab closes. Playwright's documented recipe is the one
used here: save \`JSON.stringify(sessionStorage)\` yourself and restore it with \`addInitScript\` before the app's scripts run. Restoring
only **missing** keys matters: the init script runs on every navigation, and blindly overwriting would undo the app's own changes (for
example the cart, or a logout test).

Keep \`playwright/.auth\` in \`.gitignore\` — it contains real session data. Tests that check the **login page itself** should opt out
with \`test.use({ storageState: { cookies: [], origins: [] } })\` and not use the restoring fixture.`,
  mistakes: [
    'Assuming storageState captures sessionStorage — the app then silently runs as a guest.',
    'Logging in in globalSetup without a trace — when it fails in CI there is no evidence; a setup project has full tooling.',
    'Overwriting sessionStorage on every navigation in the init script — it resets state the test just created.',
    'Committing the saved auth files to git.',
  ],
  interview: [
    { q: 'How do you avoid logging in through the UI in every test?', a: 'Log in once in a setup project (or via API), save storageState to a file, and set use.storageState in the projects that depend on setup. For apps that keep the session in sessionStorage, save and restore it with addInitScript.' },
    { q: 'What does storageState contain?', a: 'Cookies and localStorage per origin (and IndexedDB if requested). Not sessionStorage, not in-memory JavaScript state.' },
    { q: 'How do you log in as different roles?', a: 'One setup test per role writing its own file (admin.json, customer.json); projects or test.use({ storageState: … }) pick the role per file or describe block. For many parallel tests, use a worker-scoped fixture with one account per worker to avoid tests interfering.' },
  ],
}
