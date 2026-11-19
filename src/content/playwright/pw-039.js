export default {
  id: 'pw-039',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Fill the seller registration form: fill, check and selectOption',
  level: 'BEGINNER',
  tags: ['forms', 'fill', 'check', 'selectOption', 'toBeChecked'],
  estMinutes: 15,
  scenario: `Sprint 21: the ShopEasy seller sign-up (\`form.html\`) moved to Playwright. A teammate's first draft "types" into every field,
clicks checkboxes (so a second run un-ticks them), never chooses a country and ends without a single assertion. The PO asks a simple
question: *does a valid seller actually get the "Thanks!" message with the data they entered?*`,
  description: `Write \`tests/seller-registration.spec.ts\` for \`form.html\`.

**Acceptance**
- Enter first name, last name and email with \`fill\` (locate by label, e.g. \`getByLabel('First name')\`, or the ids \`#firstName\`, \`#lastName\`, \`#email\`).
- Choose gender *Female* and the categories *Outdoor gear* and *Kids* with \`check()\` — not \`click()\`.
- Choose the country **India** (\`#country\`, value \`IN\`) with \`selectOption\`, and the sales channels **web** and **marketplace** in the multi-select \`#channels\`.
- Tick *I accept the seller terms* (\`#terms\`) and assert it with \`toBeChecked()\`.
- Click **Register** and assert the result panel (\`data-testid="result-panel"\`, details in \`#result-details\`) shows \`Country: IN\` and \`Channels: web, marketplace\`.
- No \`type()\` (deprecated) and no \`waitForTimeout\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('a new seller can register', async ({ page }) => {
  await page.goto('form.html');

  await page.locator('#firstName').type('Priya');
  await page.locator('#lastName').type('Nair');
  await page.locator('#email').type('priya.nair@example.com');
  await page.locator('#gender-female').click();
  await page.locator('#terms').click();
  // TODO: categories, country, channels

  await page.locator('#submit-btn').click();
  await page.waitForTimeout(2000);
  // TODO: assert the result
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('a new seller can register', async ({ page }) => {
  await page.goto('form.html');

  await page.getByLabel('First name').fill('Priya');
  await page.getByLabel('Last name').fill('Nair');
  await page.getByLabel('Email').fill('priya.nair@example.com');

  await page.getByLabel('Female').check();
  await page.getByLabel('Outdoor gear').check();
  await page.getByLabel('Kids').check();

  await page.getByLabel('Country').selectOption('IN');
  await page.locator('#channels').selectOption(['web', 'marketplace']);

  const terms = page.locator('#terms');
  await terms.check();
  await expect(terms).toBeChecked();

  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByTestId('result-panel')).toBeVisible();
  const details = page.locator('#result-details');
  await expect(details).toContainText('Name: Priya Nair');
  await expect(details).toContainText('Categories: outdoor, kids');
  await expect(details).toContainText('Country: IN');
  await expect(details).toContainText('Channels: web, marketplace');
});
`,
  checks: [
    { label: 'Text fields entered with fill()', pattern: "\\.fill\\(\\s*['\"`]", hint: "await page.getByLabel('First name').fill('Priya');" },
    { label: 'Radio/checkboxes set with check()', pattern: '\\.check\\(\\s*\\)', hint: "check() makes sure the box ends up ticked — a click() toggles whatever state it was in." },
    { label: 'Country chosen with selectOption', pattern: "selectOption\\(\\s*(['\"`](IN|India)['\"`]|\\{\\s*(value|label)\\s*:\\s*['\"`](IN|India))", hint: "await page.getByLabel('Country').selectOption('IN');" },
    { label: 'Several channels chosen with selectOption([...])', pattern: 'selectOption\\(\\s*\\[', hint: "Pass an array for a <select multiple>: selectOption(['web', 'marketplace'])." },
    { label: 'Terms asserted with toBeChecked', pattern: 'toBeChecked\\(', hint: 'await expect(terms).toBeChecked();' },
    { label: 'Asserts the submitted result', pattern: "(result-panel|result-details)[\\s\\S]*(toContainText|toHaveText|toBeVisible)", hint: "await expect(page.locator('#result-details')).toContainText('Country: IN');" },
    { label: 'No type() and no waitForTimeout', pattern: '(\\.type\\(|waitForTimeout)', mustNot: true, hint: 'fill() replaces type(); assertions wait for you.' },
  ],
  hints: [
    'getByLabel works for wrapping labels too: <label><input type="checkbox"> Kids</label> is found with getByLabel(\'Kids\').',
    "check() / uncheck() are idempotent: they only click if the state is wrong and then verify it. selectOption takes a value, { label } or an array.",
    'Finish with web-first assertions on #result-details — what the user sees is the real acceptance criterion.',
  ],
  explanation: `Playwright has one action per kind of control: **\`fill\`** clears and sets a text field in one step (and fires \`input\`),
**\`check()\`** sets a checkbox or radio to *checked* and verifies it, and **\`selectOption\`** chooses one or (with an array) several
options of a native \`<select>\`. Using the right action makes the test independent of the starting state — \`click()\` on an
already-ticked box would un-tick it.

\`getByLabel\` reads the form like a user and doubles as an accessibility check: if a field has no label, the locator fails. The final
\`toContainText\` assertions prove the outcome, which is what the PO actually asked.`,
  mistakes: [
    'Using click() on checkboxes — a pre-ticked or remembered value gets toggled off and the test lies.',
    'Using the deprecated type() for normal fields — slower and it appends to existing text instead of replacing it.',
    'Clicking a native <select> and then the option text — use selectOption.',
    'Ending the test after the submit click with no assertion: it only proves nothing crashed.',
  ],
  interview: [
    { q: 'What is the difference between fill() and pressSequentially()?', a: 'fill() sets the whole value at once and fires one input event — the default for forms. pressSequentially() types key by key with keydown/keypress/keyup, for widgets that react to each keystroke such as autocomplete or input masks.' },
    { q: 'Why check() instead of click() on a checkbox?', a: 'check() is idempotent: if the box is already checked it does nothing, otherwise it clicks and then verifies the box became checked. click() toggles, so the result depends on the starting state.' },
    { q: 'How do you select several options in a multi-select?', a: "Pass an array to selectOption, e.g. selectOption(['web', 'marketplace']). It replaces the current selection with exactly those options." },
  ],
}
