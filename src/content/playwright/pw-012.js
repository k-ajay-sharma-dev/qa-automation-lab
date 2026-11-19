export default {
  id: 'pw-012',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'File upload and data tables',
  level: 'INTERMEDIATE',
  tags: ['setInputFiles', 'tables', 'forms', 'filter'],
  estMinutes: 30,
  scenario: `Two manual regression cases are still done by hand every release because "upload and tables are hard to automate":
**SELL-07** — a seller registers and uploads a trade licence PDF; **HR-12** — searching the employee directory for "QA" shows only the
QA team, and Chen Wei's salary is \$74,000. In Playwright both are short. Automate them.`,
  description: `**Test 1 — form.html**
- Fill *First name* \`Jane\`, *Last name* \`Doe\`, *Email* \`jane.doe@example.com\`, select *Country* \`India\`, tick the terms checkbox.
- Upload a file to *Upload trade licence (PDF or image)* with \`setInputFiles\` — an **in-memory** file
  \`{ name: 'licence.pdf', mimeType: 'application/pdf', buffer: Buffer.from(...) }\` so the test needs no fixture file.
- Click *Register* and expect \`#result-details\` to contain \`Licence file: licence.pdf\`.

**Test 2 — table.html**
- Type \`QA\` into the search box (accessible name *Search employees*).
- Rows are \`tbody tr\` inside \`data-testid="employee-table"\`: expect exactly **3**.
- Find Chen Wei's row with \`filter({ hasText })\` and assert its **third cell** is \`$74,000\`.

Use labels/roles for form fields; \`check()\` for the checkbox; \`selectOption\` for the dropdown.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('seller uploads a trade licence', async ({ page }) => {
  await page.goto('form.html');
  await page.locator('#firstName').type('Jane');
  await page.locator('#lastName').type('Doe');
  await page.locator('#email').type('jane.doe@example.com');
  await page.locator('#country').click(); // TODO: choose India
  await page.locator('#terms').click();
  await page.locator('#upload-file').click(); // opens the OS file dialog... now what?
  await page.locator('#submit-btn').click();
});

test('search shows only the QA team', async ({ page }) => {
  await page.goto('table.html');
  // TODO
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('seller uploads a trade licence', async ({ page }) => {
  await page.goto('form.html');

  await page.getByLabel('First name').fill('Jane');
  await page.getByLabel('Last name').fill('Doe');
  await page.getByLabel('Email').fill('jane.doe@example.com');
  await page.getByLabel('Country').selectOption({ label: 'India' });
  await page.getByLabel('I accept the seller terms').check();

  await page.getByLabel('Upload trade licence').setInputFiles({
    name: 'licence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test licence'),
  });

  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.locator('#result-details')).toContainText('Licence file: licence.pdf');
});

test('search shows only the QA team', async ({ page }) => {
  await page.goto('table.html');

  await page.getByRole('textbox', { name: 'Search employees' }).fill('QA');

  const rows = page.getByTestId('employee-table').locator('tbody tr');
  await expect(rows).toHaveCount(3);

  const chen = rows.filter({ hasText: 'Chen Wei' });
  await expect(chen.getByRole('cell').nth(2)).toHaveText('$74,000');
});
`,
  checks: [
    { label: 'Upload with setInputFiles', pattern: '\\.setInputFiles\\(', hint: "await page.getByLabel('Upload trade licence').setInputFiles({ name, mimeType, buffer })" },
    { label: 'In-memory file with a Buffer', pattern: 'buffer\\s*:\\s*Buffer\\.from\\(', hint: "buffer: Buffer.from('%PDF-1.4 test')" },
    { label: 'Dropdown via selectOption, checkbox via check()', pattern: '\\.selectOption\\([\\s\\S]*\\.check\\(\\)|\\.check\\(\\)[\\s\\S]*\\.selectOption\\(', hint: "selectOption({ label: 'India' }) and .check()" },
    { label: 'Row count asserted with toHaveCount', pattern: 'toHaveCount\\(\\s*3\\s*\\)', hint: 'await expect(rows).toHaveCount(3);' },
    { label: 'Row found by its text', pattern: "filter\\(\\s*\\{\\s*hasText\\s*:\\s*['\"/]Chen Wei", hint: "rows.filter({ hasText: 'Chen Wei' })" },
    { label: 'Salary cell asserted', pattern: "toHaveText\\(\\s*['\"]\\$74,000['\"]", hint: "await expect(chen.getByRole('cell').nth(2)).toHaveText('$74,000');" },
    { label: 'No deprecated type()', pattern: '\\.type\\(', mustNot: true, hint: 'Use fill() — type() is deprecated (pressSequentially exists for key-by-key typing).' },
  ],
  hints: [
    'setInputFiles works directly on <input type="file"> — the OS dialog is never opened. It accepts a path, an array of paths, or { name, mimeType, buffer }.',
    "selectOption accepts the value ('IN'), { label: 'India' } or an array for multi-selects.",
    "For a table: get the rows, filter the one row you need by text, then look inside it (getByRole('cell')).",
  ],
  explanation: `**Uploads**: \`setInputFiles\` sets the files on the input element directly, bypassing the native file picker that automation cannot
drive. A path (\`'test-data/licence.pdf'\`) is fine too; the in-memory form keeps the test self-contained. Clear with \`setInputFiles([])\`.
If the site opens the picker from a custom button, use \`page.waitForEvent('filechooser')\` and \`chooser.setFiles(...)\`.

**Tables**: the same "list → filter → look inside" pattern as product cards. \`toHaveCount(3)\` retries until the search has filtered the
rows. Locating the row by **business data** (the name) instead of a row index keeps the test correct when sorting or paging changes.
Using the column index \`nth(2)\` is acceptable for a stable column layout; for wide tables, compute the index from the header text once.

Reading all values is easy too: \`await rows.locator('td:first-child').allTextContents()\` returns a \`string[]\` you can sort-check.`,
  mistakes: [
    'Clicking the file input — it tries to open the OS dialog, which Playwright cannot control.',
    'Asserting rows.count() === 3 right after typing — count() does not retry; toHaveCount does.',
    'Hard-coding the row index (rows.nth(0)) for Chen Wei — the order depends on data and sorting.',
    "Using getByLabel('Email') on a page where several labels contain 'Email' — add exact: true if it becomes ambiguous.",
  ],
  interview: [
    { q: 'How do you upload a file in Playwright?', a: "locator.setInputFiles(path | paths | { name, mimeType, buffer }) on the <input type=file>. For custom pickers, wait for the 'filechooser' event and call setFiles on it." },
    { q: 'How do you verify a value in a specific table row?', a: "Locate the rows, filter by a unique cell text (filter({ hasText })), then scope inside that row to the cell — and use a web-first assertion. Avoid absolute row indexes." },
    { q: 'How do you check a table is sorted?', a: 'Read the column with allTextContents(), convert to numbers/strings, and compare with a sorted copy. For dynamic tables first wait for a stable state with a web-first assertion (e.g. on the row count).' },
  ],
}
