export default {
  id: 'pw-008',
  category: 'playwright',
  kind: 'quiz',
  title: 'Auto-waiting, locator strategy and fixtures: code-review quiz',
  level: 'BEGINNER',
  tags: ['auto-waiting', 'locators', 'fixtures', 'code-review'],
  estMinutes: 10,
  scenario: `You have been added as a reviewer on the team's first Playwright pull requests. Before you approve anything, make sure you can
spot the patterns that make Playwright tests flaky or brittle — and the ones that are actually fine.`,
  description: 'Decide what a good reviewer would say about each snippet.',
  questions: [
    {
      q: "A PR contains:\n\n```ts\nawait page.getByRole('button', { name: 'Checkout' }).click();\n```\n\nThe button is rendered 2 s after the cart loads. Does the test need an explicit wait before the click?",
      options: [
        'Yes — add await page.waitForTimeout(2000)',
        'Yes — add await page.waitForSelector("#checkout") first',
        'No — click() auto-waits until the button is attached, visible, stable, enabled and not covered',
        'No — but only if the test runs headed',
      ],
      answer: 2,
      why: 'Actionability checks are built into every action, bounded by the test timeout. waitForTimeout is never right; waitForSelector is redundant here.',
    },
    {
      q: "Which assertion retries until the cart badge shows 2?\n\n```ts\n// A\nexpect(await page.getByTestId('shopping-cart-badge').textContent()).toBe('2');\n// B\nawait expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');\n```",
      options: ['A', 'B', 'Both', 'Neither'],
      answer: 1,
      why: 'B is a web-first assertion: it takes the locator and re-queries until the text matches or 5 s pass. A reads the text once, at that instant, and compares a plain string — no retry.',
    },
    {
      q: 'Rank these locators for the Login button on ShopEasy from most to least preferred.',
      options: [
        "locator('#login-form > button') → getByTestId('login-button') → getByRole('button', { name: 'Login' })",
        "getByRole('button', { name: 'Login' }) → getByTestId('login-button') → locator('#login-form > button')",
        "locator('//button[1]') → getByRole(...) → getByTestId(...)",
        'They are all equal; pick the shortest',
      ],
      answer: 1,
      why: 'Role + accessible name reflects what the user sees and survives refactors. data-testid is a stable contract but invisible to users. Structural CSS/XPath depends on the DOM layout and breaks first.',
    },
    {
      q: "A teammate writes:\n\n```ts\nlet page: Page;\ntest.beforeAll(async ({ browser }) => { page = await browser.newPage(); });\n```\n\nand shares that page across all tests in the file. What is the main problem?",
      options: [
        'It does not compile',
        'Tests now share cookies/storage and depend on order — one failure cascades and they cannot run in parallel; use the built-in page fixture (fresh context per test)',
        'browser is not a valid fixture',
        'beforeAll is not supported in Playwright',
      ],
      answer: 1,
      why: 'It compiles and browser is a real worker-scoped fixture, but it throws away test isolation. The page fixture gives every test a new context for free.',
    },
    {
      q: 'What does a fixture give you that a beforeEach hook does not?',
      options: [
        'Nothing — they are identical',
        'Fixtures are created on demand only for tests that request them, compose with other fixtures, have built-in teardown after use(), and can be shared through test.extend',
        'Fixtures run faster because they skip the browser',
        'Fixtures can only be used for the page object',
      ],
      answer: 1,
      why: 'A fixture is set up only when a test lists it in its arguments, tears down after await use(...), can depend on other fixtures (page → loginPage → loggedInPage) and can be test- or worker-scoped. beforeEach runs for every test in scope, needed or not.',
    },
  ],
  hints: ['Ask: does this line retry, and does this test depend on another one?'],
  explanation: `Review checklist for Playwright code:

- **No fixed waits** (\`waitForTimeout\`) and no one-shot assertions (\`expect(await …)\`) on UI state.
- **User-facing locators first**; \`data-testid\` as fallback; CSS/XPath tied to layout only as last resort.
- **Isolation** — each test uses its own \`page\` (fresh context); no shared mutable state between tests.
- **Fixtures over copy-paste** — page objects and logged-in state come from \`test.extend\` fixtures, not from duplicated setup.`,
  mistakes: [
    'Approving waitForTimeout "because the test passes locally".',
    'Accepting a .first() that only exists to silence a strict mode violation.',
    'Sharing one page across tests to "save time" — contexts are already cheap.',
  ],
  interview: [
    { q: 'Explain auto-waiting in one sentence.', a: 'Before each action Playwright waits for the element to be actionable (attached, visible, stable, enabled, receiving events), and web-first assertions retry until the expected state is reached.' },
    { q: 'What is the difference between a test-scoped and a worker-scoped fixture?', a: 'Test-scoped fixtures (page, context) are created for each test; worker-scoped fixtures (browser, or a logged-in storage state you generate once) live for the whole worker process and are shared by its tests.' },
  ],
}
