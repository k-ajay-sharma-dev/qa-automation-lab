export default {
  id: 'pw-002',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Classes and async/await: fix the helper that forgot to await',
  level: 'BEGINNER',
  tags: ['typescript', 'async-await', 'promises', 'classes'],
  estMinutes: 20,
  scenario: `A Java developer on the team wrote the first Playwright helper exactly like a Selenium method. It "works" on his laptop
about half the time; in CI the test ends before the login button is even clicked and reports
*"Error: page.goto: Target page, context or browser has been closed"*. Every Playwright call returns a **Promise** — and none of them is awaited.`,
  description: `Fix \`LoginHelper\` so it is a proper TypeScript class that waits for every browser action.

**Acceptance**
- The \`page\` is injected through the constructor as a **\`private readonly\` parameter property** typed \`Page\` (no \`any\`).
- \`login\` is an \`async\` method with typed \`string\` parameters returning \`Promise<void>\`.
- **Every** Playwright call (\`goto\`, \`fill\`, \`click\`, \`textContent\`) is preceded by \`await\` — no \`.then()\` chains.
- \`cartCount()\` is \`async\`, returns \`Promise<number>\`, and returns \`0\` when the badge is not there.
- Use the user-facing locators already chosen by the team: \`getByLabel('Username')\`, \`getByLabel('Password')\`, \`getByRole('button', { name: 'Login' })\`.`,
  starterCode: `import { Page } from '@playwright/test';

export class LoginHelper {
  page: any;

  constructor(page) {
    this.page = page;
  }

  login(username, password) {
    this.page.goto('login.html');
    this.page.getByLabel('Username').fill(username);
    this.page.getByLabel('Password').fill(password);
    this.page.getByRole('button', { name: 'Login' }).click();
  }

  cartCount() {
    return this.page.getByTestId('shopping-cart-badge').textContent().then((t) => Number(t));
  }
}
`,
  solution: `import type { Page } from '@playwright/test';

export class LoginHelper {
  constructor(private readonly page: Page) {}

  async login(username: string, password: string): Promise<void> {
    await this.page.goto('login.html');
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async cartCount(): Promise<number> {
    const badge = this.page.getByTestId('shopping-cart-badge');
    if ((await badge.count()) === 0) {
      return 0;
    }
    const text = await badge.textContent();
    return Number(text ?? '0');
  }
}
`,
  checks: [
    { label: 'Page injected as private readonly parameter property', pattern: 'constructor\\s*\\(\\s*private\\s+readonly\\s+page\\s*:\\s*Page\\s*\\)', hint: 'constructor(private readonly page: Page) {}' },
    { label: 'login is async with typed params and Promise<void>', pattern: 'async\\s+login\\s*\\(\\s*\\w+\\s*:\\s*string\\s*,\\s*\\w+\\s*:\\s*string\\s*\\)\\s*:\\s*Promise<void>', hint: 'async login(username: string, password: string): Promise<void>' },
    { label: 'No un-awaited this.page call at the start of a line', pattern: '^\\s*this\\.page\\.', mustNot: true, hint: 'Put await in front of every this.page.… action.' },
    { label: 'Clicks are awaited', pattern: 'await\\s+this\\.page\\.getByRole\\([^)]*\\)\\s*\\.click\\(', hint: "await this.page.getByRole('button', { name: 'Login' }).click();" },
    { label: 'cartCount returns Promise<number>', pattern: 'async\\s+cartCount\\s*\\(\\s*\\)\\s*:\\s*Promise<number>', hint: 'async cartCount(): Promise<number>' },
    { label: 'No .then() chains', pattern: '\\.then\\s*\\(', mustNot: true, hint: 'Use const text = await ... instead of .then(...)' },
    { label: 'No any', pattern: ':\\s*any\\b', mustNot: true, hint: 'Type the page as Page.' },
  ],
  hints: [
    'A Promise is an "IOU" for a value that arrives later. await pauses this async function until the IOU is paid.',
    'Without await the next line runs immediately — the test can finish (and close the browser) while the click is still pending.',
    'constructor(private readonly page: Page) {} declares the field AND assigns it in one go.',
  ],
  explanation: `In Selenium (Java) \`click()\` blocks until the command is sent. In Playwright **every** browser call is asynchronous and returns a
\`Promise\`. If you do not \`await\` it, JavaScript moves on to the next line immediately: four actions race each other and the test
function returns before they finish — Playwright then closes the page, giving *"Target page, context or browser has been closed"*.

\`async\` on a method makes it return a Promise and lets you use \`await\` inside; callers must also \`await helper.login(...)\`.
\`Promise<void>\` / \`Promise<number>\` document what the caller gets once it awaits.

TypeScript **parameter properties** (\`private readonly page: Page\` in the constructor) replace the Java boilerplate of a field plus
\`this.page = page\`. \`readonly\` stops anyone re-assigning the page later.

Enable the ESLint rule \`@typescript-eslint/no-floating-promises\` in the project: it flags every missing \`await\` before review does.`,
  mistakes: [
    'Forgetting await on an action — the most common Playwright bug; the test passes or fails randomly.',
    'Awaiting the locator instead of the action: await page.getByLabel(...) — locators are lazy and synchronous; await the .fill()/.click().',
    'Mixing .then() and await in the same function — harder to read and easy to lose errors.',
    'Using forEach with an async callback — forEach does not wait; use for...of with await.',
  ],
  interview: [
    { q: 'What happens if you forget await in a Playwright test?', a: 'The action starts but the test continues without waiting. Later steps run against a page in the wrong state, and the test may finish before the action, causing "target closed" errors or false passes. The no-floating-promises lint rule catches it.' },
    { q: 'Why do locators not need await but actions do?', a: 'A locator is just a description of how to find an element; creating it does not talk to the browser. Actions and assertions (click, fill, expect(...).toBeVisible()) talk to the browser and return Promises.' },
    { q: 'How do you run two async things in parallel?', a: 'Start both and await Promise.all([a, b]). In Playwright this is used e.g. to start waiting for a popup or response before clicking the element that triggers it.' },
  ],
}
