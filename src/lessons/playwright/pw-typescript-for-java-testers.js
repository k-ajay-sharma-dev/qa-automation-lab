export default {
  slug: 'pw-typescript-for-java-testers',
  category: 'playwright',
  order: 1,
  title: 'TypeScript for testers coming from Java',
  minutes: 9,
  summary: 'Read and write the TypeScript you need for Playwright: types, interfaces, union types, arrow functions, classes and async/await.',
  manualAnalogy: `When you write a manual test case you fill in a template: ID, preconditions, steps, expected result. If someone leaves "expected result" empty, the review catches it. TypeScript types are that template for your code — the editor "reviews" every object while you type, before anything runs.`,
  body: `## Why TypeScript, and what it really is

Playwright tests are written in **TypeScript**: JavaScript plus *types*. The types exist only while you write code — the compiler checks them and then strips them away, producing plain JavaScript that Node.js runs. So TypeScript is a safety net, not a different runtime. If you know Java, most ideas will feel familiar; the syntax is just "name first, type second".

| Java | TypeScript |
|---|---|
| \`String name = "Jane";\` | \`const name: string = 'Jane';\` (or just \`const name = 'Jane'\` — the type is inferred) |
| \`int count = 2;\` / \`double price\` | \`let count: number = 2;\` — one \`number\` type for both |
| \`List<String> names\` | \`const names: string[] = []\` |
| \`final\` variable | \`const\` (cannot be re-assigned) — use \`let\` only when you must re-assign |
| \`null\` | \`null\` **and** \`undefined\` ("never set") |
| \`==\` vs \`.equals\` | always use \`===\` / \`!==\` |

## Interfaces and union types: shaping test data

\`\`\`ts
type Country = 'IN' | 'US' | 'GB';          // union type: only these values

interface Customer {
  firstName: string;
  lastName: string;
  postalCode: string;
  country: Country;
  phone?: string;                            // ? = optional property
}

const jane: Customer = { firstName: 'Jane', lastName: 'Doe', postalCode: '10001', country: 'US' };
\`\`\`

- An **interface** describes the shape of an object. Misspell a key (\`postcode\`) or forget a required one and the editor underlines it immediately.
- A **union type** with \`|\` is a lightweight enum: \`country: 'FR'\` will not compile.
- \`?\` marks an optional property. Reading \`jane.phone\` gives \`string | undefined\`, and TypeScript makes you handle the \`undefined\`.
- Avoid \`any\`: it switches the checker off for that value. If you really do not know a type (e.g. JSON from an API), use \`unknown\` or describe it with an interface.

## Functions and arrow functions

\`\`\`ts
function fullName(c: Customer): string {
  return c.firstName + ' ' + c.lastName;
}

const toPrice = (text: string): number => Number(text.replace('$', ''));
const prices = ['$29.99', '$9.99'].map(toPrice);                 // [29.99, 9.99]
const cheap = prices.filter((p) => p < 10);                       // [9.99]
\`\`\`

An **arrow function** \`(params) => result\` is the TypeScript lambda — the same thing as \`t -> ...\` in a Java stream. You will see them everywhere: \`map\`, \`filter\`, \`find\`, and as the body of every Playwright test: \`test('name', async ({ page }) => { ... })\`.

One difference that matters later: arrow functions do **not** have their own \`this\`. That is irrelevant in Playwright tests but important in Cucumber step definitions (see the *Cucumber with Playwright* lesson).

## Classes

\`\`\`ts
export class CheckoutData {
  constructor(private readonly customer: Customer, readonly items: string[]) {}

  label(): string {
    return fullName(this.customer) + ' (' + this.items.length + ' items)';
  }
}
\`\`\`

- \`private readonly customer: Customer\` inside the constructor is a **parameter property**: it declares the field *and* assigns it. No Java-style \`this.customer = customer\` boilerplate.
- \`readonly\` ≈ Java \`final\` for fields. \`private\`/\`protected\`/\`public\` work as in Java (\`public\` is the default).
- \`export\` makes the class importable: \`import { CheckoutData } from './checkout-data';\`.
- \`extends\` and \`abstract class\` work as in Java — you will use them for a \`BasePage\`.

## Promises and async/await — the big one

In Selenium Java, \`element.click()\` blocks until done. In Playwright **every browser call is asynchronous** and immediately returns a **Promise** — an IOU for a result that arrives later.

\`\`\`ts
async function openCart(page: Page): Promise<void> {
  await page.goto('cart.html');                               // wait for navigation
  await page.getByRole('button', { name: 'Checkout' }).click(); // wait for the click
}

const heading = await page.getByTestId('title').textContent(); // string | null, once resolved
\`\`\`

- \`await\` pauses *this* function until the Promise resolves, then gives you the value.
- You can only use \`await\` inside an \`async\` function, and an \`async\` function always returns a Promise — so the caller must \`await\` it too (\`await openCart(page)\`).
- \`Promise<void>\` means "nothing comes back, but wait for me"; \`Promise<number>\` means "a number, later".
- Forgetting \`await\` is the #1 Playwright bug: the next line runs before the action happened, and the test may end while the browser is still busy → *"Target page, context or browser has been closed"*.
- Locators themselves (\`page.getByRole(...)\`) are **not** awaited — they are only descriptions. Await the **action** or **assertion** on them.
- Prefer \`await\` over \`.then(...)\` chains — it reads top to bottom like Java.

## Loops and events: where Promises get lost

Two patterns compile fine and still race:

\`\`\`ts
const fields = ['First Name', 'Last Name'];

// BAD: forEach throws away the Promise each async callback returns
fields.forEach(async (label) => { await page.getByLabel(label).fill('x'); });

// GOOD: for...of waits for each iteration
for (const label of fields) {
  await page.getByLabel(label).fill('x');
}
\`\`\`

And for anything that *happens* (a pop-up, a download, a network response), start waiting **before** you trigger it, and await afterwards:

\`\`\`ts
const tabPromise = page.context().waitForEvent('page');            // 1. listen
await page.getByRole('link', { name: 'Open size guide in new tab' }).click(); // 2. act
const sizeGuide = await tabPromise;                                // 3. collect
\`\`\`

A Promise that nobody awaits is called a **floating promise** — the lint rule \`@typescript-eslint/no-floating-promises\` points at every one.

## A tsconfig in one sentence

\`tsconfig.json\` tells the compiler how strict to be. Keep \`"strict": true\` — it is what turns on the useful checks (no implicit \`any\`, null checks).`,
  keyPoints: [
    'TypeScript = JavaScript + compile-time types; types are erased at runtime.',
    'interface for object shapes, union types (\'a\' | \'b\') for allowed values, ? for optional fields, never any.',
    'Arrow functions are lambdas; they have no own this.',
    'Constructor parameter properties (private readonly page: Page) replace field + assignment.',
    'Every Playwright action returns a Promise: await every action and assertion, inside async functions.',
  ],
  mistakes: [
    'Missing await before an action — the test races ahead. Turn on the @typescript-eslint/no-floating-promises lint rule.',
    'Awaiting a locator instead of the action on it: await page.getByLabel(...) does nothing useful; await ...fill(...).',
    'Using == — JavaScript coerces types ("2" == 2 is true). Always ===.',
    'Typing things as any to silence the compiler — you lose the typo protection that made you choose TypeScript.',
  ],
  tryIt: `Open the browser console on \`http://localhost:5180/practice-site/inventory.html\` (F12 → Console) and run:
\`[...document.querySelectorAll('.item-price')].map((e) => Number(e.textContent.replace('$', ''))).filter((p) => p < 10)\`
That is an arrow-function pipeline — the same style you will use on \`allTextContents()\` results.`,
  problems: ['pw-001', 'pw-002', 'pw-022'],
}
