export default {
  id: 'loc-028',
  category: 'locators',
  kind: 'locator',
  title: 'XPath not(): Edit buttons for everyone who is NOT Inactive',
  level: 'ADVANCED',
  tags: ['xpath', 'not', 'predicates', 'web-table'],
  estMinutes: 12,
  scenario: `HR runs an annual-review campaign: every employee who is **not Inactive** (Active *or* On Leave) must get a review, and the test
opens each of their Edit forms on the current page. Statuses will grow ("Probation" is planned for next quarter), so listing the allowed
statuses with \`or\` would need a code change every time. The stable rule is the exclusion: *everyone except Inactive*.`,
  description: `On **table.html** (page 1 as it loads), match the **Edit button of every row whose status is not "Inactive"**.

**Rules**
- XPath with \`not(...)\`. Do not list the allowed statuses and do not use employee names or \`data-emp-id\`.
- Only buttons inside the table body rows.
- Exactly 4 elements (page 1 has one Inactive employee: James Wilson).`,
  hints: [
    'Row: <tr> … <td><span class="status-pill status-inactive">Inactive</span></td><td><button class="btn-edit">Edit</button></td></tr>',
    'Filter the row, then go down: //tbody/tr[ condition ]//button',
    '//table[@id=\'employee-table\']//tbody/tr[not(.//span[normalize-space()=\'Inactive\'])]//button[normalize-space()=\'Edit\']',
  ],
  page: 'table.html',
  strategy: 'xpath',
  expected: "#employee-table button[data-emp-id='1'], #employee-table button[data-emp-id='2'], #employee-table button[data-emp-id='3'], #employee-table button[data-emp-id='5']",
  expectedCount: 4,
  solution: `XPath:  //table[@id='employee-table']//tbody/tr[not(.//span[normalize-space()='Inactive'])]//button[normalize-space()='Edit']

Java:
By reviewable = By.xpath("//table[@id='employee-table']//tbody/tr"
        + "[not(.//span[normalize-space()='Inactive'])]//button[normalize-space()='Edit']");
int count = driver.findElements(reviewable).size();
for (int i = 0; i < count; i++) {
    driver.findElements(reviewable).get(i).click();   // re-find each time: the table re-renders after Save
    editPanel.saveWithReviewFlag();
}`,
  explanation: `\`not()\` turns a condition around. The predicate \`[not(.//span[normalize-space()='Inactive'])]\` keeps the rows that do **not**
contain an Inactive status span — so Active, On Leave and any future status are all included automatically.

Where you put \`not()\` matters:

| XPath | Means |
|---|---|
| \`//tr[not(.//span[.='Inactive'])]\` | rows **without** an Inactive span ✓ |
| \`//tr[td[not(.='Inactive')]]\` | rows that have **some** cell that isn't "Inactive" — every row has a name cell, so nothing is excluded ✗ |

Negate the **whole** condition on the container, not the child element.

Scoping to \`tbody\` keeps the header row out (it has no button today, but a "select all" control could appear there). Using
\`normalize-space()\` on the status protects against stray whitespace inside the pill.`,
  mistakes: [
    'Putting not() on the inner element (//tr[td[not(.=\'Inactive\')]]) — every row has some other cell, so it excludes nothing.',
    'Listing allowed statuses with or — the locator silently misses new statuses like "Probation".',
    'Using contains(.,\'Active\') to mean active — "Inactive" contains "Active".',
    'Storing the list of WebElements and clicking through it after the table re-renders — StaleElementReferenceException.',
  ],
  interview: [
    {
      q: 'When would you express a locator as an exclusion with not() instead of listing what you want?',
      a: 'When the rule is naturally "everything except X" and the set of other values can grow — statuses, categories, roles. Listing values with or ties the locator to today\'s data; not(X) keeps working when new values appear.',
    },
    {
      q: 'Your loop clicks Edit buttons from a findElements list and fails on the second one with StaleElementReferenceException. Why?',
      a: 'Saving re-renders the table, so the WebElements found earlier refer to removed DOM nodes. Re-locate inside the loop (findElements again and take index i), or re-find by a stable key such as the employee name each time.',
    },
  ],
}
