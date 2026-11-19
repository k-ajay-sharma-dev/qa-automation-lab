export default {
  id: 'pw-033',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Sort the products: selectOption, toHaveValue and the order of the cards',
  level: 'BEGINNER',
  tags: ['selectOption', 'toHaveValue', 'dropdown', 'toHaveText', 'sorting'],
  estMinutes: 15,
  scenario: `Bug SHOP-688 from last sprint: choosing *Price (high to low)* on the ShopEasy products page showed the cheapest item first. It was
fixed, and the PO wants a regression test. A colleague coming from Selenium wrote one with \`new Select(...)\`-style thinking: it reads the
first card's name once with \`textContent()\` and compares it — and it also matched the promo banner's price by accident.`,
  description: `Write \`tests/product-sort.spec.ts\` for \`inventory.html\` (guests can browse).

**Acceptance**
- Choose the option with \`selectOption\` on the \`#product-sort\` dropdown (by label *Sort by*, test id \`product-sort\` or the id) using the value \`hilo\`.
- Assert the dropdown now has the value \`hilo\` with the web-first \`toHaveValue\`.
- Assert the card names (\`.item-name\` inside the \`inventory-item\` cards) are, in order:
  *Storm Fleece Jacket, Trailblazer Backpack, Classic Crew T-Shirt, Retro Red Tee, Pulse Bike Light, Junior Onesie*.
- Assert the card prices are \`$49.99, $29.99, $15.99, $15.99, $9.99, $7.99\` — scope prices to the cards, not the promo banner.
- No one-shot \`textContent()\` / \`allTextContents()\` comparisons and no \`waitForTimeout\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('sorts by price high to low', async ({ page }) => {
  await page.goto('inventory.html');
  await page.locator('#product-sort').click();
  await page.getByText('Price (high to low)').click();
  await page.waitForTimeout(1000);

  const first = await page.locator('.item-name').first().textContent();
  expect(first).toBe('Storm Fleece Jacket');
  const price = await page.locator('.item-price').first().textContent();
  expect(price).toBe('$49.99'); // fails: this is the promo banner's $7.49
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('sorts by price high to low', async ({ page }) => {
  await page.goto('inventory.html');

  const sort = page.getByTestId('product-sort');
  await sort.selectOption('hilo');
  await expect(sort).toHaveValue('hilo');

  const cards = page.getByTestId('inventory-item');
  await expect(cards.locator('.item-name')).toHaveText([
    'Storm Fleece Jacket',
    'Trailblazer Backpack',
    'Classic Crew T-Shirt',
    'Retro Red Tee',
    'Pulse Bike Light',
    'Junior Onesie',
  ]);
  await expect(cards.locator('.item-price')).toHaveText([
    '$49.99', '$29.99', '$15.99', '$15.99', '$9.99', '$7.99',
  ]);
});
`,
  checks: [
    { label: 'Chooses the option with selectOption', pattern: "selectOption\\(\\s*(['\"`]hilo['\"`]|\\{\\s*value\\s*:\\s*['\"`]hilo)", hint: "await page.getByTestId('product-sort').selectOption('hilo');" },
    { label: 'Asserts the selected value with toHaveValue', pattern: "toHaveValue\\(\\s*['\"`]hilo['\"`]", hint: "await expect(sort).toHaveValue('hilo');" },
    { label: 'Names asserted in order with toHaveText([...])', pattern: "toHaveText\\(\\s*\\[\\s*['\"`]Storm Fleece Jacket", hint: 'Pass an array to toHaveText: it checks count, order and text, and retries.' },
    { label: 'Prices asserted in order with toHaveText([...])', pattern: "toHaveText\\(\\s*\\[\\s*['\"`]\\$49\\.99", hint: "await expect(cards.locator('.item-price')).toHaveText(['$49.99', ...]);" },
    { label: 'Prices scoped to the product cards', pattern: "(inventory-item|inventory-list)[\\s\\S]*item-price", hint: "Chain from the cards (getByTestId('inventory-item')) so the promo banner's price is not included." },
    { label: 'No waitForTimeout or one-shot textContent', pattern: '(waitForTimeout|textContent\\(|allTextContents\\()', mustNot: true, hint: 'Web-first assertions retry; one-shot reads do not.' },
  ],
  hints: [
    'A native <select> is not clicked open: locator.selectOption() accepts the value, { label } or { index }.',
    'toHaveText with an array checks the number of elements, their order and each text — and keeps retrying until it matches.',
    "The promo banner also has an .item-price. Start from page.getByTestId('inventory-item') and chain .locator('.item-price').",
  ],
  explanation: `\`selectOption\` is Playwright's replacement for Selenium's \`Select\` class: it works on the \`<select>\` itself, waits for the option to
exist, selects it and fires \`input\`/\`change\`. \`toHaveValue\` then proves the control state, and the array form of \`toHaveText\` proves the
**result** — all six names in the right order. Ties (two items at \`$15.99\`) are sorted by name, which the expected list documents.

A reviewer looks for: the option chosen by its stable value (\`hilo\`) rather than clicking text, retrying assertions instead of
\`textContent()\`, and locators scoped to the list so unrelated elements (the promo banner) cannot leak in.`,
  mistakes: [
    'Clicking the <select> and then the option text — native dropdowns are not part of the page DOM to click; use selectOption.',
    "Only checking the first card — a sort that is half-wrong still passes. Assert the whole order.",
    "Using page.locator('.item-price') unscoped — it also matches the promo banner price.",
    'Reading textContent() once right after the change — it can run before the re-sort and does not retry.',
  ],
  interview: [
    { q: 'How do you handle a dropdown in Playwright compared to Selenium?', a: "Selenium needs new Select(element).selectByValue(...). Playwright calls locator.selectOption('value') (or { label } / { index }) directly, with auto-waiting. For custom div-based dropdowns you click the trigger and then the option by role." },
    { q: 'Why assert with toHaveText([...]) instead of reading allTextContents()?', a: 'allTextContents() is a snapshot at one instant; if the list is still re-rendering the test fails or passes by luck. toHaveText with an array retries until the count, order and texts all match or the timeout ends.' },
    { q: 'How would you test all four sort options without copy-paste?', a: 'Loop over a typed table of { value, expectedNames } and generate one test per row with a for...of around test(), so each option reports separately.' },
  ],
}
