export default {
  slug: 'pw-deep-locators-actionability-timeouts',
  category: 'playwright',
  order: 14,
  title: 'Deep dive: the locator engine, actionability checks, timeouts and assertions',
  minutes: 28,
  summary: 'Explain what happens underneath a locator action and a web-first assertion — lazy resolution, strictness, selector engines, per-action actionability checks, the retry loop and the timeout hierarchy — and choose the right wait and assertion style with clear trade-offs against Selenium explicit waits.',
  manualAnalogy: `A good manual tester never clicks a greyed-out button or a field hidden under a spinner; they wait until the screen is ready, and when they write "the cart shows 1 item" they look again a moment later if the page is still updating. They also know the difference between "stop the test, the login failed" and "note this wrong label and keep going". Playwright encodes all three habits: actionability checks, retrying assertions, and hard versus soft assertions.`,
  body: `## Where the earlier lessons stop

The *Locators and actions* lesson showed which locator to write; the *Auto-waiting and web-first assertions* lesson showed that actions wait and \`expect\` retries. This lesson is about **the mechanism**: what a locator really is, what each action checks and in which order, how the retry loops and timeouts nest, and how to defend those choices in a design review or interview.

## Locators are lazy, re-resolved descriptions

A \`Locator\` holds a **selector string** and a reference to its page or frame — nothing else. No DOM node is touched when you create it. Every operation (\`click\`, \`fill\`, \`textContent\`, \`expect(...).toHaveText\`) sends the selector to the Playwright server, which resolves it **again, inside the page**, at that moment.

\`\`\`ts
const price = page.locator('#price-list .price-row').filter({ hasText: 'Pulse Bike Light' }).locator('.price');
console.log(String(price));
// e.g.  locator('#price-list .price-row').filter({ hasText: 'Pulse Bike Light' }).locator('.price')
// in the trace it is a selector chain like
//   #price-list .price-row >> internal:has-text="Pulse Bike Light"i >> .price
\`\`\`

A Selenium \`WebElement\` is the opposite: an **ID for one specific DOM node** handed out by the driver. When the app replaces that node (React re-render, \`innerHTML = ...\`), the ID points at a detached node and every call throws \`StaleElementReferenceException\`. On ShopEasy's \`waits.html\` the *Refresh prices* button throws away the whole \`#price-list\` and builds a new one: a WebElement found before the click goes stale; a Playwright locator is simply resolved against the new list. Stale-element errors do not "get handled" — the concept does not exist, because nothing is held.

\`ElementHandle\` (\`page.$()\`) still exists and *does* point at a node; it is discouraged for exactly this reason. Only use it when you need a real node reference, e.g. to pass into \`page.evaluate\`.

### Strictness

Actions and single-element assertions are **strict**: if the selector matches more than one element at the moment of the action, Playwright throws instead of picking the first:

\`\`\`
Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 6 elements:
    1) <button id="add-to-cart-trailblazer-backpack" …>Add to cart</button> aka getByTestId('add-to-cart-trailblazer-backpack')
    2) <button id="add-to-cart-pulse-bike-light" …>Add to cart</button> aka getByTestId('add-to-cart-pulse-bike-light')
    …
\`\`\`

Strictness protects you from the most dangerous kind of failure: the test that **passes while clicking the wrong thing**. The error even suggests unique alternatives ("aka …"). Multi-element operations are deliberately non-strict: \`count()\`, \`all()\`, \`allTextContents()\`, \`toHaveCount()\`, \`toHaveText([...])\` with an array. \`.first()\`, \`.last()\` and \`.nth(i)\` opt out of strictness — legitimate when position *is* the requirement (the sort order of inventory cards), a smell when they only silence the error.

## Selector engines underneath

| Engine | Written as | Resolves by | Notes |
|---|---|---|---|
| Role | \`getByRole('button', { name: 'Login' })\` | ARIA role + accessible name computed by Playwright | recommended; uses implicit roles (\`<button>\` → button) |
| Label | \`getByLabel('Zip/Postal Code')\` | \`<label for>\`, wrapping label, \`aria-labelledby\`, \`aria-label\` | form fields |
| Text | \`getByText('Loaded 42 orders')\` | visible text, whitespace-normalised | substring + case-insensitive unless \`exact: true\` |
| Placeholder / alt / title | \`getByPlaceholder\`, \`getByAltText\`, \`getByTitle\` | that attribute | |
| Test id | \`getByTestId('continue')\` | \`data-testid\` by default | configurable, see below |
| CSS | \`locator('#checkout-error')\` | the browser's CSS engine, plus Playwright extensions (\`:has-text()\`, \`:visible\`) | **pierces open shadow roots** |
| XPath | \`locator('//button[@id="finish"]')\` or \`xpath=…\` | \`document.evaluate\` | does **not** pierce shadow DOM |
| Chaining | \`a >> b\` in a string, or \`a.locator(b)\` | search for b inside each match of a | the method form is preferred |

When you read a trace or a \`toString()\` you will see selectors such as \`internal:role=button[name="Login"i]\`, \`internal:label="Username"i\`, \`internal:testid=[data-testid="continue"s]\` and \`internal:has-text=...\`. These \`internal:\` engines are **how the \`getBy*\` methods are serialised** — an implementation detail, not something to type into tests (the \`i\`/\`s\` suffixes mean case-insensitive / case-sensitive matching).

### CSS vs XPath vs role-based locators

| | CSS | XPath | Role / label / test id |
|---|---|---|---|
| Readability | good for ids/classes, poor for deep structure | poor beyond simple paths | best — reads like the manual step |
| Resilience | breaks on class/structure refactors | breaks on any structure change; text axes help a little | survives markup refactors; breaks when the **user-visible** contract changes |
| Performance | fastest (native engine) | fast (native) | slightly more work (accessibility computation in the injected script) — negligible next to network and rendering |
| Accessibility signal | none | none | **yes**: if \`getByRole\`/\`getByLabel\` cannot find it, a screen reader user may not either |
| Shadow DOM | pierces open roots | does not pierce | pierces open roots |
| When to use | no accessible name and no test id; legacy markup | upward/sibling navigation you cannot express otherwise (rare with \`filter({ has })\`) | default choice |

**Recommended:** role-based first, label for fields, test id where the accessible name is ambiguous or translated (multi-language storefronts), CSS as a last resort, XPath almost never. The trade-off to say aloud: role locators depend on correct semantics — on a \`<div onclick>\` "button" they fail, which is a real accessibility defect worth raising rather than working around.

### Configuring the test id attribute

ShopEasy uses the default \`data-testid\`. Many teams use \`data-test\` or \`data-qa\`:

\`\`\`ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: { testIdAttribute: 'data-qa' },
});
\`\`\`

Outside the runner (a library script) use \`selectors.setTestIdAttribute('data-qa')\` before creating locators. Agree on the attribute with developers and treat it as an API: removed test ids should fail code review, not the nightly run.

## Actionability: what each action checks

Before an action, Playwright resolves the locator to exactly one element (strictness), then runs the checks **for that action** in a loop until they all pass or the action timeout / test timeout is reached. The table follows the official *Auto-waiting* docs:

| Action | Visible | Stable | Receives events | Enabled | Editable |
|---|---|---|---|---|---|
| \`click\`, \`dblclick\`, \`check\`, \`uncheck\`, \`setChecked\`, \`tap\` | ✔ | ✔ | ✔ | ✔ | |
| \`hover\`, \`dragTo\` | ✔ | ✔ | ✔ | | |
| \`screenshot\` | ✔ | ✔ | | | |
| \`fill\`, \`clear\` | ✔ | | | ✔ | ✔ |
| \`selectOption\` | ✔ | | | ✔ | |
| \`selectText\` | ✔ | | | | |
| \`scrollIntoViewIfNeeded\` | | ✔ | | | |
| \`focus\`, \`blur\`, \`press\`, \`pressSequentially\`, \`setInputFiles\`, \`dispatchEvent\` | | | | | |

All of them wait for the element to be **attached** first. Recent versions of the docs also list a **"not inert"** check (the element is not inside an \`inert\` subtree, e.g. behind a modal) for clicks, \`fill\` and \`selectOption\`. Definitions that matter in an interview:

- **Visible** — non-empty bounding box and no \`visibility:hidden\`. \`opacity:0\` counts as visible; \`display:none\` does not.
- **Stable** — same bounding box for at least two consecutive animation frames (so a sliding drawer finishes moving).
- **Receives events** — the element is the **hit target** at the click point. If ShopEasy's checkout had a spinner overlay above *Continue*, the log would say \`<div class="overlay"> intercepts pointer events\` and Playwright would keep retrying.
- **Enabled** — not \`disabled\` (native or \`aria-disabled\` on a role element, or inside a disabled fieldset). On \`waits.html\`, *Claim reward* is disabled for 5 s: \`click()\` simply waits.
- **Editable** — enabled and not \`readonly\`.

Then Playwright scrolls into view, performs the action at the element's centre and — for clicks — waits for any navigation the click started to commit.

Notice what is **not** in the table: \`press\` and \`setInputFiles\` do no visibility checks (hidden file inputs are normal), and \`dispatchEvent\` fires a synthetic DOM event with no checks at all.

### force: true and trial: true

\`{ force: true }\` skips the **non-essential** checks (for a click: visible, stable, receives events, enabled). The element must still exist. That is exactly why it is dangerous: it clicks *through* a cookie banner or a spinner, so the test passes while a real user is blocked. Legitimate uses are rare — a custom checkbox whose real \`<input>\` is visually hidden by design (and even then \`check()\` on the label or role usually works). Treat every \`force\` in a PR as "explain why the user can do this".

\`{ trial: true }\` runs the actionability checks **without** performing the action — useful to assert "this button would be clickable" in a guard step.

## The retry loop behind web-first assertions

\`await expect(locator).toBeVisible()\` is not a function that reads once. It is a loop:

1. Resolve the locator in the page (it may match nothing yet — that is not an error).
2. Evaluate the matcher's condition (visible, text equals, count equals …) in the page.
3. If it fails, wait briefly and go to 1 — re-resolving, so re-rendered nodes are picked up.
4. Stop when it passes, or when the **expect timeout** (5 s default) ends; then throw with the last received value and a call log.

\`\`\`ts
// waits.html — spinner then result
await page.getByRole('button', { name: 'Load orders' }).click();
await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden();   // retries ~3 s
await expect(page.locator('#data-result')).toHaveText('Loaded 42 orders');

// one-shot: evaluated once, immediately — no retry
const loaded = await page.locator('#orders-loaded').isVisible();          // very likely false right after the click
\`\`\`

| | Web-first (\`await expect(locator).toX()\`) | One-shot (\`await locator.isVisible()\`, \`textContent()\`, \`count()\`) |
|---|---|---|
| Retries | yes, until expect timeout | no — snapshot at that instant |
| Strict | yes (single-element matchers) | \`isVisible\` etc. are strict too; \`count\` is not |
| Failure message | expected vs last received + call log | a plain boolean/string mismatch with no context |
| Use for | asserting UI state | **branching** on state you know is settled (e.g. "is the cookie banner present? then dismiss it"), or collecting data after a web-first assertion has synchronised |

Rule: synchronise with a web-first assertion, then read values. \`await expect(cards).toHaveCount(6)\` first, then \`await cards.allTextContents()\` for a sort check.

## The timeout hierarchy

| Timeout | Default | Scope | Set with |
|---|---|---|---|
| Global | none | whole run | \`globalTimeout\` in config |
| Test | 30 s | test function + \`beforeEach\` + fixture setup (teardown/\`afterEach\` get a separate budget of the same size) | \`timeout\` in config/project, \`test.setTimeout(ms)\`, \`testInfo.setTimeout()\`, \`test.slow()\` (×3) |
| \`beforeAll\` / \`afterAll\` | the test timeout | each hook, own timer | \`test.setTimeout()\` inside the hook |
| Fixture | shares the test's budget | one fixture | \`{ timeout }\` in the fixture definition |
| Expect | 5 s | each web-first assertion | \`expect: { timeout }\` in config, \`{ timeout }\` per call, \`expect.configure({ timeout })\` |
| Action | none (0) | each action | \`use: { actionTimeout }\`, \`{ timeout }\` per call, \`page.setDefaultTimeout()\` |
| Navigation | none (0) | \`goto\`, \`reload\`, \`waitForURL\`… | \`use: { navigationTimeout }\`, per call, \`page.setDefaultNavigationTimeout()\` |
| \`toPass\` | none unless configured | one block | \`toPass({ timeout })\` |

How they interact:

- Action and navigation timeouts default to **no limit**, so a stuck click is bounded only by the **test timeout** — the failure then says "Test timeout of 30000ms exceeded" and points at the click. Setting \`actionTimeout: 10_000\` gives a faster, more precise error.
- The expect timeout is **independent** of the test timeout but cannot outlive it: a \`{ timeout: 60_000 }\` assertion inside a 30 s test fails with a test timeout.
- \`page.setDefaultNavigationTimeout\` takes priority over \`page.setDefaultTimeout\` for navigations; a per-call \`{ timeout }\` beats both.
- \`test.slow()\` triples the test timeout but changes no expect/action timeout — good for "this flow is legitimately long", useless for "this one assertion needs 8 s".

\`\`\`ts
import { test, expect } from '@playwright/test';

test.describe('order status', () => {
  test('status moves to Completed', async ({ page }) => {
    test.slow();                                           // whole flow is long on CI: 90 s budget
    await page.goto('http://localhost:5180/practice-site/waits.html');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('Completed', { timeout: 8_000 }); // only this line is slow
  });
});
\`\`\`

**Recommended:** keep the defaults for test and expect, set \`actionTimeout\` and \`navigationTimeout\` to something shorter than the test timeout for clear errors, and raise timeouts **per call** where the product is legitimately slow — with a comment saying why.

## Choosing a wait

| Wait | How it works | Right when | Wrong when |
|---|---|---|---|
| \`page.waitForTimeout(ms)\` | sleeps | debugging only, or deliberately waiting *for nothing to happen* while a negative assertion checks (rare) | anything else — too long when fast, too short on CI |
| \`page.waitForResponse(pred)\` | subscribes to network responses | the UI has no visible signal, or you need the response body/status | started **after** the action — race; create the promise first |
| \`page.waitForURL(url)\` | navigation events | a redirect chain must finish before a non-asserting step | a \`toHaveURL\` assertion would do |
| \`page.waitForLoadState(state)\` | load lifecycle | after a popup opens, wait for \`domcontentloaded\` | \`'networkidle'\` as a general strategy — discouraged; apps with polling never go idle |
| Web-first \`expect\` | retrying condition on a locator/page | almost always for UI state | the value is not in the DOM |
| \`expect.poll(fn)\` | calls \`fn\` repeatedly (intervals ramp up from ~100 ms by default) | a **value** that changes: API field, storage, file | \`fn\` closes over a value read before |
| \`expect(async () => {...}).toPass()\` | re-runs a whole block | several steps must succeed together (re-click + check) | no timeout passed — it then retries until the test timeout |

\`\`\`ts
// race-free network wait on checkout: subscribe BEFORE the action
const ordersCall = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
await page.getByRole('button', { name: 'Finish' }).click();
expect((await ordersCall).status()).toBe(201);
\`\`\`

(ShopEasy's static checkout does not call the API; the pattern applies to any SPA that does, and to the API server on port 5181.)

## Hard vs soft assertions

A failing \`expect\` throws: the rest of the test is skipped. \`expect.soft\` records the failure, continues, and marks the test failed at the end with every soft failure listed.

\`\`\`ts
import { test, expect } from '@playwright/test';

test('checkout validation shows every expected signal', async ({ page }) => {
  await page.goto('http://localhost:5180/practice-site/checkout.html');
  await page.getByRole('button', { name: 'Continue' }).click();

  const banner = page.getByRole('alert');
  await expect(banner).toBeVisible();                              // hard: nothing else makes sense without it

  await expect.soft(banner).toContainText('First Name is required');
  await expect.soft(page.getByLabel('First Name')).toBeFocused();
  await expect.soft(page.getByLabel('First Name')).toHaveClass(/input-error/);

  expect(test.info().errors).toHaveLength(0);                       // optional: stop here if any soft check failed
  await page.getByLabel('First Name').fill('Asha');                 // …continue to the next validation rule
});
\`\`\`

- Hard assertion for **preconditions** (the banner exists, the page loaded, the login succeeded).
- Soft assertions for **independent facts about one screen** — one run reports all three problems instead of one per CI cycle.
- \`expect.configure({ soft: true })\` creates a soft \`expect\` for a whole block.

When soft assertions **hide bugs**: used for preconditions, they produce a cascade of meaningless failures after the real one; used everywhere, a test can drive deep into a broken flow and the first, causal failure is buried in a list. Also, a soft assertion does not throw, so inside a \`toPass\` block it cannot trigger a retry: the block "passes" on the first attempt while the test is already marked failed — keep soft assertions out of retry blocks.

## Selenium (Java): explicit waits vs auto-waiting

\`\`\`java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

driver.findElement(By.id("load-data-btn")).click();
wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("loading-spinner")));
String text = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("orders-loaded"))).getText();
assertEquals(text, "Loaded 42 orders");

WebElement claim = wait.until(ExpectedConditions.elementToBeClickable(By.id("claim-reward-btn")));
claim.click();

// re-rendered list: re-locate inside the wait, and ignore stale nodes
new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(5))
    .pollingEvery(Duration.ofMillis(250))
    .ignoring(StaleElementReferenceException.class)
    .until(d -> d.findElement(By.cssSelector("#price-list .price-row")).isDisplayed());
\`\`\`

\`\`\`ts
await page.locator('#load-data-btn').click();
await expect(page.locator('#loading-spinner')).toBeHidden();
await expect(page.locator('#orders-loaded')).toHaveText('Loaded 42 orders');

await page.locator('#claim-reward-btn').click();                     // waits for enabled
await expect(page.locator('#price-list .price-row').first()).toBeVisible();
\`\`\`

| | Selenium explicit waits | Playwright auto-waiting |
|---|---|---|
| Who decides to wait | you, at every step | the action/assertion, always |
| Where the polling runs | client side, one HTTP command per poll | server/injected script, near the DOM |
| Checks before click | what you chose (\`elementToBeClickable\` = visible + enabled; not "not covered") | visible, stable, receives events, enabled |
| Overlays | \`ElementClickInterceptedException\` after the fact | waits until the overlay is gone, logs who intercepts |
| Stale elements | \`ignoring(StaleElementReferenceException)\`, re-find | not applicable — re-resolved each time |
| Mixing waits | implicit + explicit waits combine unpredictably | one model; set timeouts per layer |
| Failure output | \`TimeoutException\` + the condition's \`toString\` | expected vs received + call log + trace |

The Selenium advice to keep: **never mix implicit and explicit waits** (the implicit wait runs inside every \`findElement\` an explicit wait polls, multiplying delays).

## Common mistakes and debugging

- **"strict mode violation … resolved to 6 elements"** — read the "aka" suggestions; scope with a container or \`filter\`, do not reach for \`.first()\`.
- **"element is not enabled / not visible / intercepts pointer events — retrying"** in the call log until timeout — the app state, not the locator, is wrong: a disabled button (missing required field), a cookie banner, an animation that never ends. Open the trace and look at the DOM snapshot at the failing step.
- **"Test timeout of 30000ms exceeded" pointing at a click** — no \`actionTimeout\` set, so the action waited the whole test budget. Set \`actionTimeout\` for a precise error.
- **Assertion passes locally, fails on CI with Received: "Processing"** — the step is legitimately slower on CI; raise that assertion's timeout, not the global one, and check whether the backend is the bottleneck.
- **\`expect(await locator.textContent()).toBe(...)\`** — a one-shot value inside a plain assertion; the classic flaky pattern.

## Best practices for experienced engineers

- Locators in page objects as readonly fields built from role/label/test id; never store \`ElementHandle\`s.
- Let strictness fail loudly; uniqueness is part of the locator's contract.
- Shorter \`actionTimeout\`/\`navigationTimeout\` than the test timeout; per-call overrides with a comment; \`test.slow()\` for long flows.
- Ban \`waitForTimeout\` and \`force: true\` via lint rules (\`eslint-plugin-playwright\` has rules for both) and require a justification when they appear.
- Hard for preconditions, soft for independent facts; never soft inside retry blocks.

## Interview questions

### Q: Why does Playwright not have StaleElementReferenceException?
**Short answer (30–60 s):** Because a locator is not an element. It is a selector that is resolved again for every action and every assertion attempt, so when the DOM is re-rendered the next resolution simply finds the new node. Selenium's WebElement is a handle to one node, which goes stale when that node is removed.

**Detailed answer:** Mention that \`ElementHandle\` does hold a node and can go stale-like (it detaches), which is why it is discouraged. Use the ShopEasy *Refresh prices* example. Add that re-resolution is also why locators can be defined up front in page objects without the "find too early" bug.

### Q: What does strict mode protect you from, and when is \`.first()\` acceptable?
**Short answer (30–60 s):** From acting on the wrong element silently when a selector matches several. \`.first()\`/\`.nth()\` are fine when position is the requirement — e.g. the first card after sorting by price — not to make an ambiguous locator pass.

**Detailed answer:** List strict vs non-strict operations (\`count\`, \`all\`, \`toHaveCount\`, array \`toHaveText\` are non-strict) and the "aka" suggestions in the error. In review I ask: "if a new card were inserted above this one, would the test still click the item the scenario is about?"

### Q: Which actionability checks does \`click()\` perform versus \`fill()\`?
**Short answer (30–60 s):** Click: visible, stable, receives events, enabled (after attached). Fill: visible, enabled, editable — no stability or hit-target check, because typing does not depend on the pointer position.

**Detailed answer:** Mention that \`press\` and \`setInputFiles\` have no visibility check, that \`force\` skips the non-essential checks and why that hides real user-blocking bugs, and \`trial: true\` for checking without acting.

### Q: Explain the difference between \`await expect(locator).toBeVisible()\` and \`expect(await locator.isVisible()).toBe(true)\`.
**Short answer (30–60 s):** The first retries until visible or the expect timeout; the second takes a single snapshot right now and asserts on a boolean, so it fails whenever the element appears a few milliseconds later.

**Detailed answer:** Describe the loop (resolve, evaluate, retry, report last received). Use one-shot reads for branching or after synchronising. The failure messages differ too: web-first gives expected/received and a call log.

### Q: Walk me through Playwright's timeouts and how they interact.
**Short answer (30–60 s):** Test timeout 30 s covers test, \`beforeEach\` and fixture setup; expect timeout 5 s per assertion; action and navigation have no limit by default so they are bounded by the test timeout; a global timeout caps the run; \`test.slow()\` triples the test timeout.

**Detailed answer:** Give the table, the "assertion timeout cannot outlive the test" rule, separate teardown budget, \`beforeAll\` with its own timer, fixture timeouts, priority of \`setDefaultNavigationTimeout\` over \`setDefaultTimeout\`, and the recommendation to set shorter action/navigation timeouts for precise errors.

### Q: CSS, XPath or role-based locators — what would you standardise on?
**Short answer (30–60 s):** Role-based by default, label for form fields, test ids where names are ambiguous or translated, CSS as a fallback, XPath almost never. Role locators are readable, resilient to markup changes and give an accessibility signal.

**Detailed answer:** Cover the comparison table, shadow DOM (XPath does not pierce), performance being negligible, and the trade-off that role locators depend on correct semantics — which is a defect to report rather than bypass. Mention configuring \`testIdAttribute\` so the team's existing attribute works with \`getByTestId\`.

### Q: When are soft assertions harmful?
**Short answer (30–60 s):** When they guard preconditions or are used everywhere: the test continues into a broken state and the causal failure is buried under noise.

**Detailed answer:** Hard for the gate, soft for independent facts on one screen; \`test.info().errors\` to stop after a soft block; keep soft out of \`toPass\`/\`expect.poll\`.

## Scenario-based questions

**1. A checkout test fails 1 run in 20 with "Test timeout of 30000ms exceeded" at \`click Continue\`.** No action timeout is set, so the click waited the whole budget. I open the trace at that step: the call log says \`<div class="overlay"> intercepts pointer events\`, so a loader overlay sometimes never disappears — an app bug or a failed request behind it. I would not add \`force: true\` (that would hide a real blocking defect for users). I'd set \`actionTimeout\` for clearer errors, check the network tab in the trace for the failing request, and raise the bug with the trace attached.

**2. A team's suite uses \`waitForTimeout(3000)\` in 200 places and the PM wants it "faster and less flaky".** I'd categorise the sleeps: after navigation (replace with a web-first assertion on the target page), after an action that triggers XHR (\`waitForResponse\` created before the action, or an assertion on the rendered result), spinners (\`toBeHidden\`), counts (\`toHaveCount\`). Add a lint rule to block new sleeps, measure duration and flake rate before and after on a pilot folder, then roll out.

**3. A migrated Selenium test wraps every step in \`expect(...).toPass()\` "for safety".** That multiplies run time on failure and hides which step is flaky. I'd remove \`toPass\` where a single web-first assertion expresses the condition, keep it only for genuinely compound retries (re-trigger + verify), and always give it a timeout.

## Tricky follow-ups

- **Does \`toBeHidden()\` pass if the element does not exist?** Yes — not present counts as hidden. \`toBeAttached({ attached: false })\` checks absence from the DOM specifically.
- **Is \`opacity: 0\` visible to Playwright?** Yes — it has a box and is not \`visibility:hidden\`. That is why a fading overlay can still "intercept pointer events".
- **Does \`isVisible()\` wait?** No. It returns immediately; its old \`timeout\` option is ignored.
- **Does \`test.slow()\` extend the expect timeout?** No, only the test timeout.
- **Is \`page.locator('text=Login')\` the same as \`getByText('Login')\`?** Close but not guaranteed identical; \`getByText\` is the documented API, the \`text=\` engine is the older string form — prefer the method.`,
  keyPoints: [
    'A Locator is a selector re-resolved on every action and assertion attempt — no node is held, so stale-element errors cannot happen; ElementHandle does hold a node and is discouraged.',
    'Strictness turns "clicked the wrong one of six" into a loud error; .first()/.nth() only when position is the requirement.',
    'getBy* methods serialise to internal: selector engines; role/label/test id first, CSS fallback, XPath almost never (it does not pierce shadow DOM). Configure testIdAttribute for the team\'s attribute.',
    'Actionability is per action: click = visible, stable, receives events, enabled; fill = visible, enabled, editable; press/setInputFiles = none. force skips the checks and can hide user-blocking bugs.',
    'Web-first assertions loop (resolve → evaluate → retry) until the expect timeout; isVisible/textContent/count are one-shot snapshots.',
    'Timeouts: test 30 s (setup + beforeEach), expect 5 s, action/navigation unlimited by default (bounded by the test), global none; per-call overrides beat defaults; test.slow() triples only the test timeout.',
    'Prefer condition waits (web-first, waitForResponse created before the action, expect.poll, toPass with a timeout) over waitForTimeout and networkidle.',
    'Hard assertions for preconditions, soft for independent facts on one screen; never soft inside retry blocks.',
  ],
  mistakes: [
    'Silencing a strict mode violation with .first(). Fix: read the "aka" suggestions in the error and scope with a container, filter({ hasText / has }) or a test id.',
    'Adding force: true when a click "does not work". Fix: open the trace; if the call log says another element intercepts pointer events, the user is blocked too — fix the app or wait for the overlay with toBeHidden().',
    'Relying on the test timeout for stuck actions, getting "Test timeout of 30000ms exceeded" with no hint. Fix: set use.actionTimeout and navigationTimeout below the test timeout for precise errors.',
    'Raising the global expect timeout to 30 s because one step is slow. Fix: per-call { timeout } on that assertion with a comment; check whether the slowness is a real performance defect.',
    'Starting waitForResponse after the click that triggers the request. Fix: create the promise first, then act, then await it — or assert on the rendered result instead.',
    'Using expect.soft for the page-loaded or logged-in check. Fix: hard-assert preconditions; use soft only for independent checks, and check test.info().errors before continuing deeper.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/waits.html\` write one spec with four tests: (1) click *Claim reward* immediately after \`goto\` with no wait and assert \`#claim-result\` says "Reward claimed: 500 points" — then rerun with \`{ timeout: 2_000 }\` on the click and read the call log ("element is not enabled"); (2) click *Load orders*, assert the \`role=status\` spinner \`toBeHidden()\` and the result text; compare with \`expect(await page.locator('#orders-loaded').isVisible()).toBe(true)\` and explain the failure; (3) store a locator for the *Pulse Bike Light* price row, click *Refresh prices*, and assert the same locator \`toBeVisible()\` again (no stale element); (4) on \`inventory.html\`, trigger a strict mode violation with \`getByRole('button', { name: 'Add to cart' }).click()\` and fix it two ways — with \`filter({ hasText: 'Storm Fleece Jacket' })\` on \`getByTestId('inventory-item')\` and with \`getByTestId\` — and say which you would keep.`,
  problems: ['pw-007', 'pw-008', 'pw-021', 'pw-026', 'pw-034', 'pw-040'],
}
