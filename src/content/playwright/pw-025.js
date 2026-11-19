export default {
  id: 'pw-025',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'A page with no test hooks: generated ids, look-alike cards and a shadow DOM',
  level: 'INTERMEDIATE',
  tags: ['locators', 'filter', 'has', 'shadow-dom', 'exact'],
  estMinutes: 25,
  scenario: `The admin area of ShopEasy is built with a component framework: every id gets a random hash on each load (\`submit-order-8f3a2\`),
all cards share the same classes, and the coupon box is a web component with a **shadow root**. The Selenium tests for it used
\`[id^='submit-order-']\`, \`(//div[@class='plan'])[2]\` and a JavaScript executor to reach into the shadow DOM — and they are the most
often broken tests in the suite. \`dynamic.html\` reproduces the page. Write the Playwright version without any of those tricks.`,
  description: `Write four tests on \`dynamic.html\`. After each action, assert the "Last action" text (\`data-testid="dynamic-result"\`).

1. **Generated id** — click *Place order* → result contains \`Place order clicked\`.
2. **Same classes** — in the pricing plans, click *Choose* on the **Plus** plan. Pick the card with \`filter({ has: … })\` using the plan's
   **heading** → result \`Plan chosen: Plus\`.
3. **Two conditions** — in *Team members* click *Edit* for the member who is **Admin and Active**. Careful: *Inactive* contains *Active*.
   → result \`Edit Ken Adams\`.
4. **Shadow DOM** — type \`SAVE10\` into the coupon box (label *Coupon code*) and click its **Apply** button (there is also an *Apply coupon*
   button on the page) → \`Coupon applied: 10% off\` is visible.

**Rules**: no id-prefix selectors, no XPath, no \`nth()\`, no \`evaluate\`/\`shadowRoot\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('dynamic.html');
});

test('place order', async ({ page }) => {
  await page.locator('[id^="submit-order-"]').click();
});

test('choose the Plus plan', async ({ page }) => {
  await page.locator('.plan').nth(1).locator('button').click();
});

test('edit the active admin', async ({ page }) => {
  await page.locator('.user-card').filter({ hasText: 'Admin' }).filter({ hasText: 'Active' })
    .getByRole('button', { name: 'Edit' }).click(); // strict mode violation: 2 cards
});

test('apply a coupon in the shadow DOM', async ({ page }) => {
  const input = await page.evaluateHandle(() =>
    document.querySelector('coupon-widget')!.shadowRoot!.querySelector('#coupon-code'));
  // TODO
});
`,
  solution: `import { test, expect } from '@playwright/test';

test.describe('Tricky locators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('dynamic.html');
  });

  test('place order despite a generated id', async ({ page }) => {
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByTestId('dynamic-result')).toContainText('Place order clicked');
  });

  test('choose the Plus plan', async ({ page }) => {
    const plus = page
      .locator('#pricing-plans .plan')
      .filter({ has: page.getByRole('heading', { name: 'Plus', exact: true }) });

    await plus.getByRole('button', { name: 'Choose' }).click();

    await expect(page.getByTestId('dynamic-result')).toHaveText('Plan chosen: Plus');
  });

  test('edit the member who is an active admin', async ({ page }) => {
    const activeAdmin = page
      .locator('.user-card')
      .filter({ has: page.getByText('Admin', { exact: true }) })
      .filter({ has: page.getByText('Active', { exact: true }) });

    await activeAdmin.getByRole('button', { name: 'Edit' }).click();

    await expect(page.getByTestId('dynamic-result')).toHaveText('Edit Ken Adams');
  });

  test('apply a coupon inside the shadow DOM', async ({ page }) => {
    await page.getByLabel('Coupon code').fill('SAVE10');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    await expect(page.getByText('Coupon applied: 10% off')).toBeVisible();
  });
});
`,
  checks: [
    { label: 'Generated-id button found by role', pattern: "getByRole\\(\\s*['\"]button['\"]\\s*,\\s*\\{\\s*name\\s*:\\s*['\"]Place order", hint: "page.getByRole('button', { name: 'Place order' })" },
    { label: 'Card picked with filter({ has })', pattern: 'filter\\(\\s*\\{\\s*has\\s*:', hint: "filter({ has: page.getByRole('heading', { name: 'Plus', exact: true }) })" },
    { label: 'Exact text match for Active', pattern: "getByText\\(\\s*['\"]Active['\"]\\s*,\\s*\\{\\s*exact\\s*:\\s*true", hint: "page.getByText('Active', { exact: true }) does not match 'Inactive'" },
    { label: 'Shadow DOM input by label or placeholder', pattern: "(getByLabel|getByPlaceholder)\\(\\s*['\"]Coupon code['\"]", hint: "page.getByLabel('Coupon code') — Playwright locators pierce open shadow roots" },
    { label: 'Apply button matched exactly', pattern: "name\\s*:\\s*['\"]Apply['\"]\\s*,\\s*exact\\s*:\\s*true", hint: "page.getByRole('button', { name: 'Apply', exact: true })" },
    { label: 'Result asserted for the active admin', pattern: "toHaveText\\(\\s*['\"]Edit Ken Adams['\"]", hint: "await expect(page.getByTestId('dynamic-result')).toHaveText('Edit Ken Adams');" },
    { label: 'No id prefixes, positions, XPath or shadowRoot scripts', pattern: "(\\[id\\^=|\\.nth\\(|locator\\(\\s*['\"](\\/\\/|\\(\\/\\/)|shadowRoot|evaluateHandle)", mustNot: true, hint: 'Locate by role, label, text and filter — never by generated ids or position.' },
  ],
  hints: [
    "filter({ has: locator }) keeps the cards that contain a matching element — the locator inside has is searched relative to each card.",
    "Text matching is a case-insensitive substring by default, so 'Active' also matches 'Inactive'. { exact: true } makes it a whole-string match.",
    'Playwright locators (except XPath) pierce open shadow roots automatically — no getShadowRoot() needed.',
  ],
  explanation: `**Generated ids** are noise; the accessible name *Place order* is the stable fact. \`getByRole\` ignores ids altogether.

**Look-alike cards**: \`filter({ hasText: 'Plus' })\` would work today, but the plan heading is the business key, so
\`filter({ has: page.getByRole('heading', { name: 'Plus', exact: true }) })\` states it precisely. The inner locator in \`has\` is
evaluated **relative to each card**, even though you build it from \`page\`.

**Two conditions**: chaining two filters is an AND. The trap is substring matching — *Maria Lopez* is *Admin* and *Inactive*, and
\`hasText: 'Active'\` matches *Inactive*. \`getByText('Active', { exact: true })\` only matches an element whose whole text is *Active*.
(\`hasText: /^Active$/\` would not help: \`hasText\` is matched against the **whole card's** text.)

**Shadow DOM**: CSS and role/text/label locators in Playwright pierce **open** shadow roots by default, so \`getByLabel('Coupon code')\`
just works. Only XPath does not pierce. Closed shadow roots are not reachable by any tool — ask developers for an open root or a test hook.

**Exact names**: the accessible name match is a substring, so *Apply* also matches *Apply coupon*; \`exact: true\` avoids the strict-mode violation.`,
  mistakes: [
    "Using hasText: 'Active' to find active users — it also matches 'Inactive'.",
    'Reaching into the shadow DOM with evaluate/evaluateHandle — slow, untyped, and unnecessary in Playwright.',
    'Choosing a plan by position (.nth(1)) — marketing reorders plans and the test buys the wrong one.',
    'Ignoring a strict-mode violation with .first() — read the error: it lists every element that matched.',
  ],
  interview: [
    { q: 'How do you handle elements with dynamic ids?', a: 'Do not use the id. Locate by role and accessible name, label or visible text; if there is nothing user-facing, ask for a data-testid. A stable prefix selector is a last resort.' },
    { q: 'Does Playwright support shadow DOM?', a: 'Yes. All locators except XPath pierce open shadow roots automatically, so getByRole/getByLabel/CSS work as if the shadow DOM were not there. Closed shadow roots cannot be automated by any tool.' },
    { q: 'filter({ hasText }) vs filter({ has })?', a: 'hasText matches the text anywhere inside the item (substring or RegExp against the whole item text). has keeps items that contain an element matching another locator, so you can use exact text, roles or test ids for the condition.' },
  ],
}
