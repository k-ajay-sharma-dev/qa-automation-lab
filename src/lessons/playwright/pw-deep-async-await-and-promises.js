export default {
  slug: 'pw-deep-async-await-and-promises',
  category: 'playwright',
  order: 12,
  title: 'Deep dive: Promises, async/await and the event loop in Playwright tests',
  minutes: 26,
  summary: 'Understand what a Promise is inside the event loop, why every Playwright call is asynchronous, how to handle errors and cleanup, catch floating promises, choose between sequential await, Promise.all, allSettled and race, and race-proof event waits.',
  manualAnalogy: `When you test by hand you naturally separate "do it now and watch" (click Pay, wait for the confirmation) from "start it and come back" (trigger a report export, carry on, check the e-mail later). You also know that some tasks can run side by side (two testers on two machines) and some cannot (two people typing into the same form). Promises are that distinction written down, and most flaky Playwright tests are a mix-up between the two.`,
  body: `## Where this lesson starts

The *TypeScript for testers coming from Java* lesson covers the basics: \`await\` every action, \`async\` functions return Promises, \`forEach(async…)\` loses Promises, listen before you act. This deep dive explains the **machinery** (the event loop, microtasks, the Playwright connection) so you can reason about failures you have never seen before, and the **choices** a senior engineer makes: when to parallelise, how to fail cleanly, how to clean up.

## Why every Playwright call is async

Your test runs in a Node.js worker process. The browser is a **different process**. Playwright's client library in the worker sends each command (\`click\`, \`fill\`, \`goto\`, an assertion) as a message over a connection to the Playwright server side, which drives the browser through its own protocol: CDP for Chromium, and Playwright's patched protocols for Firefox and WebKit. A command is a request with an id; the answer comes back later as a message with the same id. Nothing in JavaScript can block a thread while waiting for a pipe or socket, so the only honest return type is \`Promise<T>\`.

Actionability checks and auto-waiting (see the *Auto-waiting and web-first assertions* lesson) run on the server side of that connection, so one \`await locator.click()\` is one round trip from your test's point of view, however long the retries take. Locator *creation* (\`page.getByRole(…)\`) sends nothing, which is why locators are synchronous and must not be awaited.

## What a Promise is internally

A Promise is an object with:

| Part | Meaning |
|---|---|
| state | \`pending\` → \`fulfilled\` (with a value) or \`rejected\` (with a reason). It settles **once**; later \`resolve\`/\`reject\` calls are ignored |
| reaction list | callbacks registered by \`.then\`/\`.catch\`/\`.finally\` or by \`await\` |
| "handled" flag | whether anyone has attached a rejection handler; drives the *unhandled rejection* report |

When a Promise settles, its reactions are not called immediately; each one is queued as a **microtask**.

### The event loop in one picture

Node runs one JavaScript call stack. When the stack becomes empty, it drains the **microtask queue completely** (Promise reactions, \`queueMicrotask\`), and only then takes the next **macrotask** (a timer, an I/O callback such as "a message arrived from the browser").

\`\`\`ts
console.log('A');
setTimeout(() => console.log('B'), 0);               // macrotask
Promise.resolve().then(() => console.log('C'));      // microtask
queueMicrotask(() => console.log('D'));              // microtask
console.log('E');
// A E C D B
\`\`\`

Consequences for tests:

- A reply from the browser is I/O, so it arrives as a macrotask; everything chained on it runs as microtasks right after.
- A long synchronous loop (parsing a huge JSON, a busy-wait) blocks **everything**, including the replies Playwright is waiting for. Timeouts then fire late or all at once.
- \`await\` always yields to the microtask queue, even for an already resolved value. Code after an \`await\` never runs in the same tick as the code before it.

## async/await is syntax over Promises

\`\`\`ts
async function cartCount(page: Page): Promise<number> {
  const text = await page.getByTestId('shopping-cart-badge').textContent();
  return Number(text ?? '0');
}

// roughly what it means
function cartCountDesugared(page: Page): Promise<number> {
  return page.getByTestId('shopping-cart-badge').textContent()
    .then((text) => Number(text ?? '0'));
}
\`\`\`

The engine implements \`async\` functions like a resumable generator: at each \`await\` it saves the local variables, subscribes to the Promise and returns. When the Promise settles, a microtask resumes the function at that point, either with the value or by **throwing the rejection reason at the \`await\`**. That last part is why \`try/catch\` works with \`await\`. Two rules follow:

- An \`async\` function **always** returns a Promise. \`return 5\` becomes \`Promise<5>\`; \`throw err\` becomes a rejected Promise. It never throws synchronously to the caller.
- A \`return\` of a Promise from inside \`try\` **without** \`await\` skips your \`catch\` and \`finally\` timing: the function returns, then the Promise rejects outside the \`try\`. Use \`return await\` inside \`try\` blocks.

## Error handling and cleanup

\`\`\`ts
import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:5181/api';

async function login(request: APIRequestContext): Promise<string> {
  const res = await request.post(\`\${API}/auth/login\`, { data: { username: 'standard_user', password: 'secret_sauce' } });
  await expect(res).toBeOK();
  return (await res.json()).token as string;
}

test('order from cart, always emptying the cart afterwards', async ({ request }) => {
  const token = await login(request);
  const headers = { Authorization: \`Bearer \${token}\` };
  try {
    await expect(await request.post(\`\${API}/cart/items\`, { headers, data: { productId: 1, quantity: 2 } })).toBeOK();
    const order = await request.post(\`\${API}/orders\`, { headers, data: { firstName: 'Asha', lastName: 'Rao', postalCode: '560001' } });
    expect(order.status()).toBe(201);
  } finally {
    await request.delete(\`\${API}/cart\`, { headers });   // runs on pass AND on failure
  }
});
\`\`\`

Step by step:

- \`await expect(res).toBeOK()\`: response matchers are asynchronous; without \`await\` a failing check becomes a floating rejected Promise instead of a test failure.
- \`finally\` runs whether the \`try\` completed or threw, and the original error is re-thrown after it. If the \`finally\` itself throws, **its** error replaces the original one, so cleanup should be robust (or wrapped) or you lose the real failure message.
- For cleanup that every test needs, a fixture's teardown (code after \`await use(…)\`) is better than \`try/finally\` in each test: it also runs when the test times out.
- In \`catch (e)\` the type of \`e\` is \`unknown\` under \`strict\` (\`useUnknownInCatchVariables\`). Narrow with \`e instanceof Error\` before reading \`e.message\`. Do not swallow errors: re-throw or add context with \`throw new Error('Checkout failed', { cause: e })\`.

### Unhandled rejections

A rejected Promise with no handler attached by the end of the current microtask drain is reported as an **unhandled rejection**. Since Node 15 the default mode turns it into an uncaught error. In a Playwright worker that surfaces as a failure that may be attributed to whatever test is running at the time, or as a confusing error after the test that caused it. Two common sources: a missing \`await\` on an assertion, and a \`waitForEvent\` Promise created but never awaited because the code in between threw.

## Floating promises and how to catch them

A **floating promise** is a Promise that is neither awaited, returned, nor handled. TypeScript compiles it happily. The fix is tooling, not discipline:

\`\`\`js
// eslint.config.mjs
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',  // un-awaited Promise statements
      '@typescript-eslint/no-misused-promises': 'error',   // async callbacks where void is expected (forEach, event handlers)
      '@typescript-eslint/await-thenable': 'error',        // await on a non-Promise, e.g. await page.getByRole(...)
    },
  },
  { files: ['tests/**'], ...playwright.configs['flat/recommended'] },  // includes playwright/missing-playwright-await
);
\`\`\`

- \`no-floating-promises\` needs **type information** (that is what \`projectService\`, or \`parserOptions.project\` in older setups, provides), because it must know which expressions are Promises.
- \`await-thenable\` catches the opposite mistake: awaiting a locator.
- \`eslint-plugin-playwright\`'s \`missing-playwright-await\` knows Playwright's async matchers (\`expect(locator).toBeVisible()\`) specifically.
- Intentionally fire-and-forget? Write \`void promise.catch(logError)\`: explicit, and the rejection is handled.

## Sequential await vs Promise.all vs allSettled vs race

\`\`\`ts
// getJson<T>(request, url, headers?) is a typed helper like the one in the TypeScript deep dive;
// removeCartItem() DELETEs /api/cart/items/{productId} and throws on a non-2xx status.

// 1. Sequential: one after another
const products = await getJson<Paged<Product>>(request, \`\${API}/products\`);
const cart = await getJson<Cart>(request, \`\${API}/cart\`, headers);

// 2. Promise.all: start together, fail fast
const [products2, cart2] = await Promise.all([
  getJson<Paged<Product>>(request, \`\${API}/products\`),
  getJson<Cart>(request, \`\${API}/cart\`, headers),
]);

// 3. Promise.allSettled: start together, wait for every outcome
const results = await Promise.allSettled(addedProductIds.map((id) => removeCartItem(request, id, headers)));
const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
expect(failed.map((f) => String(f.reason))).toEqual([]);

// 4. Promise.race: first to settle wins
const outcome = await Promise.race([
  page.getByTestId('inventory-list').waitFor().then(() => 'loggedIn' as const),
  page.getByTestId('error').waitFor().then(() => 'error' as const),
]);
\`\`\`

| | Sequential \`await\` | \`Promise.all\` | \`Promise.allSettled\` | \`Promise.race\` |
|---|---|---|---|---|
| How it works | each starts after the previous settles | all start at once; resolves with all values | all start; resolves with \`{status, value|reason}\` for each | settles with the first to settle |
| Performance | sum of durations | max of durations | max of durations | min of durations |
| Failure behaviour | stops at first error; later steps never start | rejects at the **first** rejection; the others keep running unobserved | never rejects; you inspect each result | rejects if the first to settle rejects; losers keep running |
| Readability | best, reads like the test case | good with destructuring | verbose | needs care; intent not obvious |
| Determinism on one page | yes | **no** if they act on the same page | **no** on the same page | needs care |
| Use in tests | UI steps, anything order-dependent | independent API calls, independent pages/contexts, listen + act | cleanup of many resources, collecting all soft results | "which of two outcomes happened", custom timeouts |

\`Promise.any\` (first *fulfilled*, ignores rejections) also exists; it is rarely useful in tests because hiding rejections hides failures.

**Recommended:** sequential \`await\` by default, because a test is a story and the trace should read in order. Use \`Promise.all\` only for operations that are **independent and side-effect free relative to each other** (several API reads, setting up data through the API, actions on different pages). Use \`allSettled\` for teardown, where one failed delete must not prevent the others. Use \`race\` for branching on outcomes, and prefer a locator union (\`page.getByTestId('inventory-list').or(page.getByTestId('error'))\`) with \`toBeVisible()\` when you only need "one of these appeared".

## The listen-then-act race for events

An event can happen **during** the click's round trip. If you start listening after \`await click()\`, the event may already be gone, and the wait times out.

\`\`\`ts
import { test, expect } from '@playwright/test';

test('chat pop-up opens', async ({ page }) => {
  await page.goto('windows.html');

  // Approach A: Promise.all
  const [popupA] = await Promise.all([
    page.waitForEvent('popup'),                                   // listener registered synchronously, first
    page.getByRole('button', { name: 'Open chat pop-up' }).click(),
  ]);
  await popupA.close();

  // Approach B: start, act, collect
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open chat pop-up' }).click();
  const popupB = await popupPromise;
  await expect(popupB).toHaveURL(/mode=popup/);
});
\`\`\`

Both work for the same reason: calling \`waitForEvent\` registers the listener **synchronously**, before the click message is sent. \`Promise.all\` does not run anything in parallel here; array elements are evaluated left to right, so the order inside the array matters.

| | A: \`Promise.all([wait, act])\` | B: \`const p = wait; await act; await p\` |
|---|---|---|
| Ordering | implicit in array order | explicit, top to bottom |
| If the action throws | \`Promise.all\` rejects; the wait Promise still has a handler attached, so no unhandled rejection | the wait Promise is never awaited; when it later rejects (timeout or page closed) it can surface as an unhandled rejection |
| Readability | compact; destructuring \`[popup]\` | reads like the test case; easier with several steps between |
| Trace | both steps under one statement | separate statements |
| Common bug | putting the action **first** in the array is still fine, but \`await\`ing inside the array (\`[await click(), …]\`) serialises it and reintroduces the race | writing \`await page.waitForEvent(...)\` on the first line deadlocks: it waits for an event the next line would trigger |

**Recommended:** B for readability in most tests, the style the Playwright docs use. Use A when the action is likely to fail and you want a single clean error, or wrap B so the wait is always observed. Always pass a \`predicate\` when several events of the same type can occur, for example \`page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST')\`.

## Loops: for…of vs forEach(async) vs Promise.all(map)

\`\`\`ts
const slugs = ['trailblazer-backpack', 'pulse-bike-light', 'retro-red-tee'];

// 1. for...of: sequential, awaited, deterministic
for (const slug of slugs) {
  await page.getByTestId(\`add-to-cart-\${slug}\`).click();
}

// 2. forEach(async ...): WRONG. forEach ignores the returned Promises; the test moves on immediately
slugs.forEach(async (slug) => { await page.getByTestId(\`add-to-cart-\${slug}\`).click(); });

// 3. Promise.all(map): parallel. Right for independent API calls, wrong for one page
await Promise.all(slugs.map((slug, i) =>
  request.post(\`\${API}/cart/items\`, { headers, data: { productId: i + 1 } })));
\`\`\`

Why are parallel actions on **one page** usually wrong? A page has one mouse, one keyboard, one focused element and one navigation at a time. Three concurrent clicks interleave scrolling, hovering and pointer events; two concurrent \`fill\` calls fight over focus; a click that triggers navigation can detach the element another call is acting on. The result depends on timing, which is the definition of flaky. Sequential \`for…of\` is correct and also produces a readable trace. Parallelism belongs **across** tests (workers) and across independent pages or API calls, not inside a single page's user journey.

Reading is a different matter: prefer one call such as \`await locator.allTextContents()\` over many parallel \`textContent()\` calls; it is a single round trip and a consistent snapshot.

## Async in page objects

Constructors cannot be \`async\`. Navigation methods return the **next** page object, wrapped in a Promise:

\`\`\`ts
// pages/login-page.ts
import { type Page, expect } from '@playwright/test';
import { InventoryPage } from './inventory-page';

export class LoginPage {
  constructor(private readonly page: Page) {}

  static async open(page: Page): Promise<LoginPage> {      // async factory instead of an async constructor
    await page.goto('login.html');
    return new LoginPage(page);
  }

  async loginAs(username: string, password = 'secret_sauce'): Promise<InventoryPage> {
    await this.page.getByPlaceholder('Username').fill(username);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
    await expect(this.page).toHaveURL(/inventory\\.html/);   // prove the transition before handing over
    return new InventoryPage(this.page);
  }
}

// tests/checkout.spec.ts
test('logged-in user reaches the cart', async ({ page }) => {
  const login = await LoginPage.open(page);
  const inventory = await login.loginAs('standard_user');
  await inventory.addToCart('pulse-bike-light');
  const cart = await inventory.openCart();
  await expect(cart.items).toHaveCount(1);
});
\`\`\`

Fluent chaining in sync Java (\`loginPage.loginAs(u).addToCart(s).openCart()\`) becomes \`await (await (await login.loginAs(u)).addToCart(s)).openCart()\` in TypeScript, which nobody can read. Options:

| Approach | Advantages | Disadvantages | When to use |
|---|---|---|---|
| one \`await\` per step, variables per page | readable, debuggable, each step in the trace | a few more lines | default |
| nested \`await (await …)\` | one expression | unreadable, hard to set breakpoints | never |
| a queued "thenable" builder that collects steps and runs them on \`await\` | Java-like chaining | custom machinery, confusing stack traces, defeats lint rules | rarely, in DSL-style frameworks |

**Recommended:** one \`await\` per step. A method that only acts on the current page returns \`Promise<void>\`; a method that moves the user to another screen returns \`Promise<NextPage>\` after asserting the transition. That way the type tells the reader where the user is.

## Timeouts and cancellation basics

| Timeout | Default | Where to change |
|---|---|---|
| Test timeout (whole test including \`beforeEach\` and fixtures) | 30 s | \`timeout\` in config, \`test.setTimeout()\`, \`test.slow()\` |
| \`expect\` timeout (web-first assertions) | 5 s | \`expect: { timeout }\` in config, or per assertion |
| Action timeout (\`click\`, \`fill\`…) | none (bounded by the test timeout) | \`use: { actionTimeout }\` or \`{ timeout }\` per call |
| Navigation timeout | none (bounded by the test timeout) | \`use: { navigationTimeout }\` |

JavaScript Promises **cannot be cancelled**. \`Promise.race\` with a timer only stops *you* from waiting; the slow operation keeps running. Playwright's own cancellation is its timeouts: when the test timeout fires, Playwright tears down the fixtures, the page and context close, and every pending call rejects with an error such as *"Target page, context or browser has been closed"*. That message in a report is usually a **symptom**: look for the earlier timeout or the missing \`await\` that let the test end first.

\`\`\`ts
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(\`\${label} took longer than \${ms} ms\`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);                                  // otherwise the timer keeps the worker busy
  }
}
\`\`\`

Prefer Playwright's built-in \`timeout\` options over a helper like this: they produce better errors and traces. For a hard SLA check on an API call (try \`GET /api/slow?ms=2000\`), use the request's \`timeout\` option, which aborts the request. For your own \`fetch\` calls, \`AbortController\`/\`AbortSignal.timeout(ms)\` is the standard cancellation mechanism.

## Selenium (Java) contrast

\`\`\`java
// Selenium Java: every call blocks the thread until the WebDriver HTTP response returns
driver.findElement(By.id("user-name")).sendKeys("standard_user");
driver.findElement(By.id("login-button")).click();
new WebDriverWait(driver, Duration.ofSeconds(10))
    .until(ExpectedConditions.urlContains("inventory.html"));
\`\`\`

Selenium's W3C WebDriver protocol is request/response over HTTP and the Java bindings are **synchronous**: the thread waits, so a missing "await" cannot exist and ordering is implicit. Parallelism comes from threads (TestNG \`parallel="methods"\` with a \`ThreadLocal<WebDriver>\`), with the classic shared-state bugs of threads. Playwright inverts this: one thread per worker process, asynchronous calls, and parallelism through separate worker processes, so tests share no memory. The price is that ordering is your responsibility, expressed with \`await\`.

## Common mistakes and debugging

- **Test passes but the action never happened**, or *"Target page, context or browser has been closed"*: a missing \`await\`. Open the trace; the action appears after the test's end or not at all. Lint with \`no-floating-promises\`.
- **\`waitForEvent\` times out although the pop-up clearly opened**: the listener started after the action. Move the wait before the click.
- **Test hangs until the test timeout**: \`await page.waitForEvent('download')\` placed *before* the click with \`await\`. The trace shows the wait started and the click never ran.
- **Intermittent wrong cart contents**: \`Promise.all\` of clicks on one page, or \`forEach(async…)\`. Switch to \`for…of\`.
- **Error reported against the wrong test**: an unhandled rejection from a Promise created in an earlier test. Search for un-awaited \`waitFor*\` Promises and fire-and-forget helpers.

## Best practices for experienced engineers

- Sequential \`await\` by default; parallelise only independent work, never actions on one page.
- Lint with type information: \`no-floating-promises\`, \`no-misused-promises\`, \`await-thenable\`, \`playwright/missing-playwright-await\`.
- Listen before acting, with a predicate; keep the wait Promise observed even if the action throws.
- Cleanup in fixture teardown; \`allSettled\` when cleaning several resources.
- \`return await\` inside \`try\`; never swallow errors; add \`cause\`.
- Use Playwright timeouts instead of custom races; read *"target closed"* as a symptom.

## Interview questions

### Q: Why is every Playwright call asynchronous?
**Short answer (30–60 s):** The browser is a separate process. Each call is a message over a connection and the result arrives later, so it returns a Promise. JavaScript cannot block the thread while waiting for I/O.

**Detailed answer:** The test worker holds Playwright's client; commands go to the Playwright server side, which talks to Chromium over CDP and to Firefox and WebKit over Playwright's patched protocols. Auto-waiting and actionability checks run on the server side, so one \`await click()\` is one logical round trip. Locator creation sends nothing, which is why locators are synchronous objects and awaiting one is a mistake that \`await-thenable\` catches.

### Q: Explain the event loop, microtasks and macrotasks.
**Short answer (30–60 s):** One call stack; when it is empty, Node drains all microtasks (Promise reactions), then runs the next macrotask (timers, I/O). \`console.log\`, then \`.then\` callbacks, then \`setTimeout\` callbacks.

**Detailed answer:** Promise settlement queues reactions as microtasks; \`await\` resumes the function in a microtask. Browser replies arrive as I/O macrotasks. Practical consequences: synchronous CPU work blocks Playwright's replies and distorts timeouts; code after \`await\` always runs on a later tick; a microtask loop that keeps queueing more microtasks starves timers and I/O.

### Q: Promise.all, allSettled, race: when do you use each in tests?
**Short answer (30–60 s):** \`all\` for independent operations where any failure fails the step, such as parallel API setup or listen-and-act; \`allSettled\` for cleanup where every attempt must run; \`race\` to branch on which outcome happened first. Sequential \`await\` for UI steps.

**Detailed answer:** \`all\` is fail-fast but does not cancel the others; they keep running, which matters if they mutate data. \`allSettled\` never rejects, so I always check the results and fail with all reasons together. \`race\` losers also keep running; with a timer, clear it in \`finally\`. For "one of two elements appeared" I prefer \`locator.or()\` with \`toBeVisible()\`, which is retried and traced as one assertion.

### Q: What is a floating promise and how do you prevent it?
**Short answer (30–60 s):** A Promise that nobody awaits, returns or handles. The code moves on before the action finishes and any rejection becomes unhandled. Prevent it with \`@typescript-eslint/no-floating-promises\` using type information, and the Playwright lint plugin's \`missing-playwright-await\`.

**Detailed answer:** The compiler accepts it because the statement is legal. Symptoms: actions after the test ended in the trace, *"target closed"* errors, failures attributed to the wrong test. The lint rule needs the type checker (\`projectService\` or \`parserOptions.project\`). \`no-misused-promises\` adds the \`forEach(async…)\` and async-event-handler cases. Deliberate fire-and-forget is written \`void p.catch(handler)\`.

### Q: Compare Promise.all([page.waitForEvent('popup'), click]) with storing the wait promise first.
**Short answer (30–60 s):** Both register the listener before the click because \`waitForEvent\` subscribes synchronously. \`Promise.all\` keeps the wait observed if the click fails; the stored-promise style reads better but can leave an unobserved Promise if the action throws.

**Detailed answer:** The bug both avoid is \`await click(); await waitForEvent()\`, which misses fast events. Inside \`Promise.all\`, writing \`await\` on an element serialises it again. In the stored style, writing \`await\` on the wait line deadlocks. I default to the stored style for readability and use a predicate on \`waitForResponse\`/\`waitForEvent\` when several events of that type may fire.

### Q: Why is return await inside try/catch not redundant?
**Short answer (30–60 s):** Without \`await\`, the function returns the pending Promise immediately and leaves the \`try\`; a later rejection skips the \`catch\`, and \`finally\` runs before the operation finished.

**Detailed answer:**

\`\`\`ts
async function safeClick(loc: Locator) {
  try {
    return loc.click();          // rejection escapes the catch; finally runs too early
  } catch (e) {
    throw new Error('Could not click', { cause: e });
  } finally {
    console.log('done');
  }
}
\`\`\`

With \`return await loc.click()\` the rejection is thrown at the \`await\`, inside the \`try\`. Outside a \`try\`, \`return await\` and \`return\` behave the same apart from the stack trace.

### Q: How do timeouts and cancellation work in Playwright tests?
**Short answer (30–60 s):** Test timeout 30 s, \`expect\` 5 s, actions and navigation unbounded by default except by the test timeout. Promises cannot be cancelled; Playwright cancels by closing the page and context at timeout, which rejects all pending calls.

**Detailed answer:** I set \`actionTimeout\` and \`navigationTimeout\` explicitly in config so a stuck click fails with a precise message instead of eating the whole test timeout. \`test.slow()\` triples the timeout for known-slow tests. A custom \`Promise.race\` timeout does not stop the operation; I clear the timer in \`finally\`. For HTTP, the request \`timeout\` option or \`AbortSignal.timeout\` really aborts.

## Scenario-based questions

**Cart tests pass locally but in CI the cart sometimes has 2 items instead of 3.** I would open a failing trace and look at the order and timing of the three add-to-cart clicks. If they overlap, the helper is using \`Promise.all\` or \`forEach(async…)\` on one page. I would change it to \`for…of\` with \`await\`, add \`no-misused-promises\` to lint so it cannot return, and add an assertion on the badge count after each add for a precise failure point.

**A suite intermittently reports "Target page, context or browser has been closed" in random tests.** That error is a symptom: something was still running when its page closed. I would search for un-awaited Promises (run the lint rule over the whole repo), check for \`waitForEvent\` Promises created before an action that can throw, and check helpers that fire off async work in event handlers (\`page.on('response', async …)\`) without handling rejections. The fix is awaiting or handling each one, and attaching errors to the right test.

**Test data setup takes 40 s per test because it creates 10 users and 10 carts through the API one by one.** These calls are independent, so I would run them with \`Promise.all\`, in a worker-scoped fixture if the data can be shared, and keep teardown with \`allSettled\` so one failed delete does not hide others. I would also check the API can handle the concurrency (rate limits, locks), because turning sequential setup into a burst can create new flakiness on a shared environment.

## Tricky follow-ups

- **Does \`Promise.all\` run things in parallel threads?** No. One thread; it only lets several waits overlap. CPU work is still serial.
- **Does \`Promise.all\` cancel the others when one rejects?** No, they keep running; their results are just ignored.
- **Is \`await\` on a non-Promise an error?** No, it wraps the value and yields a microtask; that is why awaiting a locator "works" silently and why \`await-thenable\` exists.
- **Can \`expect(locator).toHaveText()\` fail the test without \`await\`?** Not reliably: the test may finish first, and the rejection becomes unhandled or attributed elsewhere.
- **Why can an \`async\` function never throw synchronously?** Its body runs inside the Promise machinery; any \`throw\` becomes a rejection of the returned Promise.`,
  keyPoints: [
    'Every Playwright call is a message to another process, so it returns a Promise; locator creation sends nothing and is synchronous.',
    'Event loop: run the stack, drain all microtasks (Promise reactions, await resumptions), then take the next macrotask (timers, I/O).',
    'An async function always returns a Promise; use return await inside try, and finally or fixture teardown for cleanup.',
    'Floating promises compile fine: catch them with no-floating-promises, no-misused-promises, await-thenable and playwright/missing-playwright-await.',
    'Sequential await by default; Promise.all for independent work; allSettled for cleanup; race for branching. None of them cancel the losers.',
    'Listen before acting: waitForEvent subscribes synchronously, so start it before the click and await it after.',
    'Never run actions in parallel on one page: one mouse, one keyboard, one focus. Parallelism belongs across workers, pages and API calls.',
    '"Target page, context or browser has been closed" is a symptom of a timeout or missing await, not the root cause.',
  ],
  mistakes: [
    'A missing await on an action or assertion, so the test ends first and reports "target closed" or passes falsely. Debug: the trace shows the call after the test ended. Fix: await it, and enable no-floating-promises with type information.',
    'Awaiting waitForEvent or waitForResponse before triggering the action, which hangs until the test timeout. Fix: store the Promise, act, then await it; add a predicate when several matching events can fire.',
    'Promise.all or forEach(async) over clicks on the same page, giving intermittent cart contents. Fix: for...of with await; keep Promise.all for independent API calls or separate pages.',
    'return without await inside try, so the catch never sees the rejection and finally runs too early. Fix: return await inside try blocks.',
    'Cleanup in finally that throws and replaces the real failure, or a loop of deletes that stops at the first error. Fix: fixture teardown plus Promise.allSettled, reporting every rejected reason.',
    'A Promise.race timeout helper that never clears its timer and does not cancel the operation. Fix: clearTimeout in finally, and prefer Playwright timeout options or the request timeout, which abort for real.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\` and the API on \`http://localhost:5181\`):
1. In a plain Node script, reproduce the A E C D B ordering and explain each letter.
2. Write an API test that logs in, adds three products with \`Promise.all\`, then checks \`GET /api/cart\` has \`itemCount\` 3. Clean up with \`DELETE /api/cart\` in a \`finally\` block.
3. On \`windows.html\`, catch the pop-up from **Open chat pop-up** with both the \`Promise.all\` style and the stored-promise style. Then deliberately put \`await\` on the \`waitForEvent\` line and watch it time out in the trace.
4. Add three products to the cart through the UI with \`forEach(async…)\` and see it fail, then fix it with \`for…of\`.
5. Call \`GET /api/slow?ms=3000\` with \`{ timeout: 1000 }\` and read the error; compare with a \`Promise.race\` helper that leaves the request running.
6. Turn on \`@typescript-eslint/no-floating-promises\` and fix every report.`,
  problems: ['pw-002', 'pw-022', 'pw-011', 'pw-013', 'pw-034'],
}
