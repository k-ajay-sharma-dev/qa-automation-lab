export default {
  id: 'pw-021',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Checkout validation: assert the state, not just the text',
  level: 'BEGINNER',
  tags: ['web-first-assertions', 'toHaveClass', 'toBeFocused', 'toHaveValue', 'forms'],
  estMinutes: 20,
  scenario: `Bug SHOP-502 came from an accessibility audit: on \`checkout.html\` the *"Postal Code is required"* banner still appeared, but the
postcode field was no longer highlighted and the cursor stayed in *Last Name*, so keyboard users had no idea where to type. The existing
test only checked the banner text with \`expect(await …textContent())\` and stayed green the whole time. The fix is merged; now the
test must check the **state** of the form, not just one string.`,
  description: `Rewrite \`tests/checkout-info.spec.ts\` (baseURL is \`http://localhost:5180/practice-site/\`; the checkout page works with an empty cart).

**Acceptance**
- A \`test.describe\` with a \`beforeEach\` that opens \`checkout.html\` and fills *First Name* \`Jane\` and *Last Name* \`Doe\` using \`getByLabel\`.
- **Missing postcode**: click *Continue* → the alert contains \`Error: Postal Code is required\` (the banner also holds a × close button,
  so use \`toContainText\`); the *Zip/Postal Code* field has the CSS class
  \`input-error\` (\`toHaveClass\`) and **has focus** (\`toBeFocused\`); *First Name* still holds \`Jane\` (\`toHaveValue\`).
- **Invalid postcode** \`1\` → the alert contains \`Postal Code is invalid\`.
- **Valid postcode** \`10001\` → the heading *Checkout: Overview* is visible, \`data-testid="summary-ship-to"\` has the text \`Jane Doe, 10001\`
  and step one (\`data-testid="checkout-step-one"\`) is hidden.
- Only web-first assertions: no \`expect(await …)\`, no \`isVisible()\`, no \`getAttribute\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('postcode is required', async ({ page }) => {
  await page.goto('checkout.html');
  await page.locator('#first-name').fill('Jane');
  await page.locator('#last-name').fill('Doe');
  await page.locator('#continue').click();

  expect(await page.locator('#checkout-error-message').textContent()).toBe('Error: Postal Code is required');
  expect(await page.locator('#postal-code').getAttribute('class')).toContain('input-error');
  // TODO: focus? first name kept? invalid and valid postcodes?
});
`,
  solution: `import { test, expect } from '@playwright/test';

test.describe('Checkout: your information', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('checkout.html');
    await page.getByLabel('First Name').fill('Jane');
    await page.getByLabel('Last Name').fill('Doe');
  });

  test('missing postcode is flagged and focused', async ({ page }) => {
    const postcode = page.getByLabel('Zip/Postal Code');

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('alert')).toContainText('Error: Postal Code is required');
    await expect(postcode).toHaveClass(/input-error/);
    await expect(postcode).toBeFocused();
    await expect(page.getByLabel('First Name')).toHaveValue('Jane');
  });

  test('invalid postcode is rejected', async ({ page }) => {
    await page.getByLabel('Zip/Postal Code').fill('1');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('alert')).toContainText('Postal Code is invalid');
  });

  test('valid information opens the overview', async ({ page }) => {
    await page.getByLabel('Zip/Postal Code').fill('10001');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Checkout: Overview' })).toBeVisible();
    await expect(page.getByTestId('summary-ship-to')).toHaveText('Jane Doe, 10001');
    await expect(page.getByTestId('checkout-step-one')).toBeHidden();
  });
});
`,
  checks: [
    { label: 'Fields found by their labels', pattern: "getByLabel\\(\\s*['\"]Zip/Postal Code['\"]", hint: "page.getByLabel('Zip/Postal Code')" },
    { label: 'Error banner text asserted web-first', pattern: "await\\s+expect\\([^;]*\\)\\.(toHaveText|toContainText)\\(\\s*['\"](Error: )?Postal Code is required", hint: "await expect(page.getByRole('alert')).toContainText('Error: Postal Code is required');" },
    { label: 'Highlight checked with toHaveClass', pattern: '\\.toHaveClass\\(', hint: 'await expect(postcode).toHaveClass(/input-error/);' },
    { label: 'Focus checked with toBeFocused', pattern: '\\.toBeFocused\\(', hint: 'await expect(postcode).toBeFocused();' },
    { label: 'Kept value checked with toHaveValue', pattern: "\\.toHaveValue\\(\\s*['\"]Jane['\"]", hint: "await expect(page.getByLabel('First Name')).toHaveValue('Jane');" },
    { label: 'Ship-to summary asserted', pattern: "toHaveText\\(\\s*['\"]Jane Doe, 10001['\"]", hint: "await expect(page.getByTestId('summary-ship-to')).toHaveText('Jane Doe, 10001');" },
    { label: 'No one-shot reads', pattern: '(expect\\(\\s*await\\b|\\.isVisible\\(|\\.getAttribute\\()', mustNot: true, hint: 'Use matchers on the locator: toHaveText, toHaveClass, toBeVisible…' },
  ],
  hints: [
    'Every user-visible state has a matcher: text → toHaveText, CSS class → toHaveClass, focus → toBeFocused, input content → toHaveValue.',
    'toHaveClass(/input-error/) with a RegExp passes when the class list contains input-error among other classes.',
    "The headings on checkout.html are real <h1>s, so getByRole('heading', { name: 'Checkout: Overview' }) works.",
  ],
  explanation: `The original test asserted the **message** but not the **behaviour** the bug was about. Web-first matchers exist for each piece of
state a manual tester would look at:

| You check by eye | Matcher |
|---|---|
| the red border | \`toHaveClass(/input-error/)\` |
| where the cursor is | \`toBeFocused()\` |
| what is typed in a field | \`toHaveValue('Jane')\` |
| a section disappeared | \`toBeHidden()\` |

All of them retry until the expect timeout, so they also work when the app updates the DOM a moment after the click.
\`getAttribute('class')\` + \`toContain\` reads once and would also match \`no-input-error\` — the matcher states the intent.

Notice the \`beforeEach\`: it fills the shared data, and each test adds only what makes it different — the same structure as a manual test case
with common preconditions.`,
  mistakes: [
    "toHaveClass('input-error') with a string — that requires the class attribute to be exactly that string; use a RegExp for one class among several.",
    'Checking only the error text — the focus and highlight are what the user experiences.',
    'Reading values with textContent()/getAttribute() and comparing strings — no retry, and less readable failures.',
    "getByLabel('Name') — it would match both First Name and Last Name; use the full label text.",
  ],
  interview: [
    { q: 'How do you check that a field is highlighted as invalid?', a: 'With a web-first assertion on the state that represents it: toHaveClass(/input-error/), toHaveAttribute("aria-invalid", "true") or toHaveCSS for a style. Prefer the accessible attribute when the app sets one.' },
    { q: 'What is the difference between toHaveText and toHaveValue?', a: 'toHaveText reads the text content of an element (labels, banners, cells). toHaveValue reads the current value of an input, textarea or select — what the user typed or picked.' },
    { q: 'Why test focus at all?', a: 'Focus management is part of usability and accessibility: after an error the keyboard user must land in the field to fix. toBeFocused makes that requirement a regression check.' },
  ],
}
