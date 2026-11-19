export default {
  id: 'pw-041',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Search the employee table: toHaveCount first, then allTextContents',
  level: 'INTERMEDIATE',
  tags: ['tables', 'toHaveCount', 'allTextContents', 'search', 'web-first-assertions'],
  estMinutes: 20,
  scenario: `Bug HR-212: searching the employee directory (\`table.html\`) for *QA* sometimes showed Engineering people too. After the fix, the
existing test still flakes: it types the search, sleeps one second, reads \`rows.count()\` and the department cells once. On a slow CI
agent the read happens before the table re-renders and it sees the old five rows.`,
  description: `Rewrite \`tests/employee-search.spec.ts\` for \`table.html\`.

**Acceptance**
- Rows are \`tbody tr\` inside \`data-testid="employee-table"\`; the search box has the label *Search employees* (\`#table-search\`).
- Fill the search with \`QA\`, then assert the row count with the web-first \`toHaveCount(3)\`, and that \`data-testid="row-count"\` shows \`Showing 1–3 of 3 employees\`.
- **Only after** the count assertion has synchronised the page, read the Department column (2nd cell) with \`allTextContents()\` and
  prove *every* value is \`QA\`; read the Name column and check it contains exactly *Chen Wei, Noah Garcia, Rahul Verma* (any order).
- No \`waitForTimeout\` and no \`expect(await rows.count())\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('search QA shows only the QA team', async ({ page }) => {
  await page.goto('table.html');
  await page.locator('#table-search').fill('QA');
  await page.waitForTimeout(1000);

  const rows = page.locator('#employee-table tbody tr');
  expect(await rows.count()).toBe(3);
  // TODO: check every department is QA
});
`,
  solution: `import { test, expect } from '@playwright/test';

test('search QA shows only the QA team', async ({ page }) => {
  await page.goto('table.html');
  const rows = page.getByTestId('employee-table').locator('tbody tr');

  await page.getByLabel('Search employees').fill('QA');

  // 1) Web-first: retries until the table has re-rendered
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId('row-count')).toHaveText('Showing 1–3 of 3 employees');

  // 2) Now the DOM is stable: a one-shot read is safe for data checks
  const departments = await rows.locator('td:nth-child(2)').allTextContents();
  expect(departments.every((d) => d.trim() === 'QA')).toBe(true);

  const names = await rows.locator('td:nth-child(1)').allTextContents();
  expect(names.map((n) => n.trim()).sort()).toEqual(['Chen Wei', 'Noah Garcia', 'Rahul Verma']);
});
`,
  checks: [
    { label: 'Searches for QA', pattern: "(fill|pressSequentially)\\(\\s*['\"`]qa['\"`]", flags: 'mi', hint: "await page.getByLabel('Search employees').fill('QA');" },
    { label: 'Row count asserted with toHaveCount(3)', pattern: 'toHaveCount\\(\\s*3\\s*\\)', hint: 'await expect(rows).toHaveCount(3); retries until the table re-renders.' },
    { label: 'Reads cells with allTextContents after the count assertion', pattern: 'toHaveCount\\([\\s\\S]*allTextContents\\(', hint: 'Synchronise first with toHaveCount, then read the column.' },
    { label: 'Checks every department value', pattern: '(\\.every\\(|toEqual\\(\\s*\\[\\s*[\'"`]QA)', hint: "expect(departments.every((d) => d.trim() === 'QA')).toBe(true);" },
    { label: 'Checks the names as a set (sorted)', pattern: '\\.sort\\(\\s*\\)[\\s\\S]*Chen Wei', hint: "expect(names.sort()).toEqual(['Chen Wei', 'Noah Garcia', 'Rahul Verma']);" },
    { label: 'No sleeps or one-shot count()', pattern: '(waitForTimeout|expect\\(\\s*await[^;]*\\.count\\(\\))', mustNot: true, hint: 'count() is a snapshot; toHaveCount retries.' },
  ],
  hints: [
    'rows.count() returns the number at one instant; expect(rows).toHaveCount(n) keeps retrying until it is n.',
    'allTextContents() does not wait or retry either — so call it only after a retrying assertion has proved the page is in the expected state.',
    'Sort both lists before comparing when the order is not part of the requirement.',
  ],
  explanation: `There are two kinds of reads in Playwright: **retrying assertions** (\`toHaveCount\`, \`toHaveText\`) and **snapshots**
(\`count()\`, \`textContent()\`, \`allTextContents()\`). A snapshot taken right after an action may see the old DOM. The pattern a reviewer
wants is: *act → synchronise with a web-first assertion → then snapshot for data logic* that assertions cannot express well, like
"every cell equals QA" or "these names in any order".

\`toHaveCount(3)\` also guards the snapshot: if the filter returned 0 rows, \`[].every(...)\` would be \`true\` and the test would pass
for the wrong reason.`,
  mistakes: [
    'expect(await rows.count()).toBe(3) — reads once, fails or passes depending on render speed.',
    'Calling allTextContents() immediately after fill() — it returns the previous page of rows.',
    'Using every() without first asserting a count — an empty list makes every() true.',
    "Comparing names in DOM order when the requirement does not define an order — the test breaks when someone sorts the table.",
  ],
  interview: [
    { q: 'When is allTextContents() acceptable in a Playwright test?', a: 'When the page is already synchronised by a retrying assertion (toHaveCount, toBeVisible) and you need the values for logic: sums, every/some checks, set comparisons. For plain "these texts in this order" use toHaveText([...]) which retries.' },
    { q: 'How do you verify a table filter properly?', a: 'Assert the row count, assert the summary text, then check every visible row matches the filter criterion, and also test an empty result ("No employees match your search.") and clearing the filter.' },
  ],
}
