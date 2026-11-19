export default {
  id: 'pw-022',
  category: 'playwright',
  kind: 'quiz',
  title: 'Code review: five ways to lose a Promise',
  level: 'BEGINNER',
  tags: ['typescript', 'async-await', 'promises', 'code-review'],
  estMinutes: 12,
  scenario: `The team turned on the \`@typescript-eslint/no-floating-promises\` lint rule and 37 warnings appeared overnight. Some of those
tests have been "green" for months. Before the clean-up session you are reviewing the worst snippets — each one compiles, and each one
hides a timing bug that a manual tester would only see as "flaky".`,
  description: 'For each snippet decide what really happens at runtime and what the fix is.',
  questions: [
    {
      q: "What happens when this test runs against a page whose title is **Your Cart**?\n\n```ts\ntest('products page title', async ({ page }) => {\n  await page.goto('inventory.html');\n  expect(page.getByTestId('title')).toHaveText('Products');\n});\n```",
      options: [
        'It fails after 5 seconds with "Expected: Products, Received: Your Cart"',
        'The assertion is started but never awaited, so the test function can finish (and the page close) before the check completes — the test may be reported green or fail with a confusing error',
        'TypeScript refuses to compile it',
        'Playwright automatically awaits every expect, so it behaves exactly like the awaited version',
      ],
      answer: 1,
      why: 'Web-first assertions return a Promise. Without await nothing waits for it: the test body ends, the fixture closes the page, and the assertion result is lost or surfaces as an unrelated error. It compiles fine — that is why the no-floating-promises lint rule exists.',
    },
    {
      q: "A helper returns the heading text:\n\n```ts\nconst title = page.getByTestId('title').textContent();\nexpect(title).toBe('Products');\n```\n\nWhy does this fail even when the heading is correct?",
      options: [
        'textContent() is deprecated',
        'title is a Promise<string | null>, not a string — the assertion compares a Promise object with "Products"',
        'getByTestId needs await before it',
        'toBe cannot compare strings',
      ],
      answer: 1,
      why: 'Every browser call returns a Promise. Without await, title holds the IOU, not the value. The fix for UI state is not even "add await" but a web-first assertion: await expect(page.getByTestId(\'title\')).toHaveText(\'Products\').',
    },
    {
      q: "The cart badge sometimes shows 1 or 2 instead of 3:\n\n```ts\nconst products = ['Trailblazer Backpack', 'Pulse Bike Light', 'Junior Onesie'];\nproducts.forEach(async (name) => {\n  await inventoryPage.addToCart(name);\n});\nawait expect(inventoryPage.cartBadge).toHaveText('3');\n```\n\nWhat is the bug?",
      options: [
        'addToCart should not be async',
        'forEach ignores the Promises returned by an async callback, so the three clicks race each other and the next line runs immediately — use for (const name of products) { await … }',
        'The badge locator must be re-created after each click',
        'toHaveText cannot compare numbers',
      ],
      answer: 1,
      why: 'Array.forEach calls the callback and throws away what it returns. The awaits inside each callback only pause that callback, not the test. A for…of loop with await runs the actions one after another. (Promise.all would run them in parallel — not what you want for UI clicks on one page.)',
    },
    {
      q: "Which way of catching the chat pop-up on `windows.html` is **correct**?\n\n```ts\n// A\nawait page.getByRole('button', { name: 'Open chat pop-up' }).click();\nconst popup = await page.waitForEvent('popup');\n\n// B\nconst popupPromise = page.waitForEvent('popup');\nawait page.getByRole('button', { name: 'Open chat pop-up' }).click();\nconst popup = await popupPromise;\n\n// C\nconst [popup] = await Promise.all([\n  page.waitForEvent('popup'),\n  page.getByRole('button', { name: 'Open chat pop-up' }).click(),\n]);\n```",
      options: ['Only A', 'Only B', 'B and C', 'A, B and C'],
      answer: 2,
      why: 'B and C both start listening before the click. In A the pop-up may already be open before waitForEvent starts, so it waits for a second pop-up that never comes and times out. B (promise first, await later) is the style the Playwright docs now prefer; C is the older Promise.all idiom and still correct.',
    },
    {
      q: "A page object method is declared like this and the build fails:\n\n```ts\nasync cartCount(): number {\n  return Number(await this.cartBadge.textContent());\n}\n```\n\nWhat is the correct return type?",
      options: ['number', 'Promise<number>', 'void', 'any'],
      answer: 1,
      why: 'An async function always returns a Promise, so the declared type must be Promise<number>; callers write const n = await inventoryPage.cartCount(). Using any would silence the compiler and the mistake.',
    },
    {
      q: "Which of these lines needs **no** `await`?",
      options: [
        "page.getByRole('button', { name: 'Checkout' })",
        "page.getByRole('button', { name: 'Checkout' }).click()",
        "expect(page).toHaveURL(/checkout\\.html/)",
        "page.goto('cart.html')",
      ],
      answer: 0,
      why: 'Creating a locator only builds a description; it does not talk to the browser and returns a Locator, not a Promise. Actions (click, goto) and web-first assertions talk to the browser and must be awaited.',
    },
  ],
  hints: ['For each line ask: does it talk to the browser? Then it returns a Promise and something must await it.'],
  explanation: `A Promise that nobody awaits is called a **floating promise**. It does not stop the test, does not report its error where you
expect it, and turns every timing difference between your laptop and CI into a random failure.

The review rules:

1. **Await every action and every web-first assertion** — \`await locator.click()\`, \`await expect(locator).toHaveText(...)\`.
2. **Never await a locator** — it is just a description.
3. **No async callbacks in forEach / map without handling the Promises** — use \`for…of\` with \`await\`.
4. **Start listening before the trigger** for events (\`popup\`, \`download\`, \`response\`).
5. **Async functions return Promise<T>** — type them so, and await them at the call site.

Turn on \`@typescript-eslint/no-floating-promises\` and \`@typescript-eslint/await-thenable\` in ESLint: rules 1–3 are then caught while typing.`,
  mistakes: [
    'Adding await in front of the locator instead of in front of the action.',
    'Using forEach(async …) to loop over test data — use for…of.',
    'Starting waitForEvent after the click that triggers the event.',
    'Fixing "flaky" tests with retries when the real cause is a missing await.',
  ],
  interview: [
    { q: 'What is a floating promise and why is it dangerous in tests?', a: 'A Promise that is created but neither awaited nor returned. The test continues without waiting, so actions race and assertion failures are lost or appear later as unrelated errors. A lint rule (no-floating-promises) catches it.' },
    { q: 'When would you use Promise.all in a Playwright test?', a: 'To start an event listener and the trigger together (waitForEvent + click), or to run independent API calls in parallel during test data setup. Not to perform several UI actions on the same page at once.' },
    { q: 'How do you loop over test data with async actions?', a: 'for (const item of items) { await action(item); } — it runs sequentially and propagates errors. forEach ignores the returned Promises.' },
  ],
}
