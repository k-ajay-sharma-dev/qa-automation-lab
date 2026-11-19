export default {
  id: 'dbg-018',
  category: 'debugging',
  kind: 'code',
  title: 'Playwright strict mode violation: "resolved to 6 elements"',
  level: 'BEGINNER',
  tags: ['playwright', 'typescript', 'strict-mode', 'locators', 'filter'],
  estMinutes: 15,
  scenario: `Your first Playwright spec for ShopEasy — "add the backpack and check its price" — failed on the first run. A teammate "fixed" it by adding \`.first()\` and the badge check went green… but when you opened the trace, the cart contained a **Classic Crew T-Shirt**, not the backpack. You are asked to fix it properly before the spec is merged.`,
  description: `Original failure (\`npx playwright test cart.spec.ts\`):

\`\`\`text
  1) [chromium] › cart.spec.ts:3:5 › backpack can be added and costs $29.99

    Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 6 elements:
        1) <button data-slug="classic-crew-t-shirt" id="add-to-cart-classic-crew-t-shirt" class="btn btn-primary btn-inventory" data-testid="add-to-cart-classic-crew-t-shirt">Add to cart</button> aka getByTestId('add-to-cart-classic-crew-t-shirt')
        2) <button data-slug="junior-onesie" id="add-to-cart-junior-onesie" class="btn btn-primary btn-inventory" data-testid="add-to-cart-junior-onesie">Add to cart</button> aka getByTestId('add-to-cart-junior-onesie')
        ...and 4 more

    Call log:
      - waiting for getByRole('button', { name: 'Add to cart' })

       3 | test('backpack can be added and costs $29.99', async ({ page }) => {
       4 |   await page.goto('inventory.html');
    >  5 |   await page.getByRole('button', { name: 'Add to cart' }).click();
         |                                                           ^
\`\`\`

After the \`.first()\` "fix", the next line fails too:

\`\`\`text
    Error: expect(locator).toHaveText(expected) failed
    Locator: locator('.item-price')
    Expected string: "$29.99"
    Error: strict mode violation: locator('.item-price') resolved to 7 elements
\`\`\`

(7, not 6: the promo banner "Deal of the day … \`$7.49\`" also has a \`.item-price\`.)

**Fix the spec:**
- Scope to the backpack's card: \`page.getByTestId('inventory-item').filter({ hasText: 'Trailblazer Backpack' })\` (or use the unique \`getByTestId('add-to-cart-trailblazer-backpack')\`).
- Read the price **inside that card**.
- Assert the cart badge shows \`1\`.
- **Rules:** no \`.first()\`, \`.nth()\` or \`.last()\`, no \`force: true\`.`,
  hints: [
    'Strict mode is a safety net: an action on a locator that matches several elements is refused instead of guessing.',
    'The error lists the matches with an "aka" suggestion — those are unique locators you could use.',
    "const card = page.getByTestId('inventory-item').filter({ hasText: 'Trailblazer Backpack' }); then card.getByRole(...) and card.locator('.item-price')",
  ],
  language: 'typescript',
  starterCode: String.raw`import { test, expect } from '@playwright/test';

test('backpack can be added and costs $29.99', async ({ page }) => {
  await page.goto('inventory.html');

  // teammate's "fix": .first() made the strict-mode error go away
  await page.getByRole('button', { name: 'Add to cart' }).first().click();

  await expect(page.locator('.item-price')).toHaveText('$29.99');
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
`,
  solution: String.raw`import { test, expect } from '@playwright/test';

test('backpack can be added and costs $29.99', async ({ page }) => {
  await page.goto('inventory.html');

  // one card = one product; everything below is scoped to it
  const backpackCard = page
    .getByTestId('inventory-item')
    .filter({ hasText: 'Trailblazer Backpack' });

  await expect(backpackCard.locator('.item-price')).toHaveText('$29.99');
  await backpackCard.getByRole('button', { name: 'Add to cart' }).click();

  await expect(backpackCard.getByRole('button', { name: 'Remove' })).toBeVisible();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
`,
  checks: [
    { label: 'No positional workaround (.first / .nth / .last)', pattern: '\\.(first|last)\\s*\\(\\s*\\)|\\.nth\\s*\\(', mustNot: true, hint: '.first() picked the T-shirt — the list is sorted A to Z' },
    { label: 'Scopes to the backpack card or its unique test id', pattern: "(filter\\s*\\(\\s*\\{\\s*hasText\\s*:\\s*['\"]Trailblazer Backpack|getByTestId\\s*\\(\\s*['\"]add-to-cart-trailblazer-backpack)", hint: "page.getByTestId('inventory-item').filter({ hasText: 'Trailblazer Backpack' })" },
    { label: 'Reads the price inside the card, not page-wide', pattern: "\\b(?!page\\.)\\w+\\.locator\\s*\\(\\s*['\"]\\.item-price", hint: "backpackCard.locator('.item-price')" },
    { label: 'Asserts the badge shows 1', pattern: "await\\s+expect\\s*\\(\\s*page\\.getByTestId\\s*\\(\\s*['\"]shopping-cart-badge['\"]\\s*\\)\\s*\\)\\s*\\.toHaveText\\s*\\(\\s*['\"]1['\"]", hint: "await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1')" },
    { label: 'No force: true', pattern: 'force\\s*:\\s*true', mustNot: true, hint: 'force skips the actionability checks — never needed here' },
  ],
  explanation: `**What strict mode is protecting you from:** every Playwright locator *action* (\`click\`, \`fill\`, \`textContent\`…) and every single-element assertion (\`toHaveText\`, \`toBeVisible\`…) requires the locator to match **exactly one** element. Six "Add to cart" buttons → Playwright refuses to guess and fails with *strict mode violation*. Selenium's \`findElement\` would silently take the first match — which is exactly the bug the teammate re-introduced with \`.first()\`.

**Why \`.first()\` was a trap:** the inventory is sorted *Name (A to Z)* by default, so the first "Add to cart" button belongs to **Classic Crew T-Shirt**. The badge said 1, the test went green, and it tested the wrong product. A positional locator is a hidden assumption about order.

**The fix: narrow the scope, like a human would.** A user finds the backpack *card* and clicks the button *inside it*. In Playwright:
\`\`\`ts
const card = page.getByTestId('inventory-item').filter({ hasText: 'Trailblazer Backpack' });
await card.getByRole('button', { name: 'Add to cart' }).click();
\`\`\`
Chained locators search inside the parent, so the price and the button are unambiguous. The unique test id \`add-to-cart-trailblazer-backpack\` is also fine for the click.

**Reading the error:** the message lists the matches and, for each, an \`aka\` locator Playwright would recommend. The count (6 vs 7) is a clue too — the 7th \`.item-price\` was the promo banner you didn't know about.

When *is* \`.first()\` OK? When the test really means "any one of these" (e.g. the first search result after asserting the list is sorted), and you say so in the test name.`,
  mistakes: [
    'Adding .first() to silence strict mode — the test then acts on whichever element happens to be first.',
    'Switching to page.$() / elementHandle APIs, which are not strict and not auto-waiting.',
    'Using force: true to click "something".',
    'Writing a long CSS chain with :nth-child instead of filtering by the product name.',
  ],
  interview: [
    { q: 'What is strict mode in Playwright?', a: 'Locators used for actions and single-element assertions must resolve to exactly one element; otherwise Playwright throws a strict mode violation listing the matches. It prevents tests from silently acting on the wrong element. The fix is to make the locator specific — filter by text, chain inside a parent, or use a test id — not to add .first().' },
    { q: 'How do you pick one item from a list of similar cards?', a: 'Locate the cards, filter by something the user sees — filter({ hasText: "Trailblazer Backpack" }) or has: another locator — and then chain to the button or price inside the card. That mirrors how a user reads the page and survives re-ordering.' },
  ],
}
