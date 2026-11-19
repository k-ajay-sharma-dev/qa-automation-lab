export default {
  id: 'loc-009',
  category: 'locators',
  kind: 'locator',
  title: 'nth-of-type: every salary cell on the visible page',
  level: 'INTERMEDIATE',
  tags: ['css', 'nth-of-type', 'web-table'],
  estMinutes: 10,
  scenario: `HR raised a defect: "sorting by salary puts $100,000 before $58,000" (text sort instead of numeric). To automate the check
you need to read **the Salary column** of the employee table. Table cells have no ids or classes — only their position in the row
tells you which column they are. Salary is the 3rd column.`,
  description: `On **table.html**, match the **Salary cell of every visible row** (page 1 shows 5 rows).

**Rules**
- Use a positional pseudo-class (\`:nth-of-type(n)\` / \`:nth-child(n)\`) or XPath \`td[3]\`.
- Do not match header cells (\`<th>\`).
- Exactly 5 elements.`,
  hints: [
    'Rows live in #employee-table tbody tr, each with 5 <td> cells.',
    'td:nth-of-type(3) = the third <td> among its siblings.',
    'XPath positions are 1-based too: //table[@id="employee-table"]/tbody/tr/td[3]',
  ],
  page: 'table.html',
  strategy: 'either',
  expected: '#employee-table tbody td:nth-of-type(3)',
  expectedCount: 5,
  solution: `CSS:    #employee-table tbody td:nth-of-type(3)
XPath:  //table[@id='employee-table']/tbody/tr/td[3]

Java:
List<Integer> salaries = driver.findElements(By.cssSelector("#employee-table tbody td:nth-of-type(3)"))
        .stream()
        .map(td -> Integer.parseInt(td.getText().replaceAll("[^0-9]", "")))
        .toList();
List<Integer> sorted = new ArrayList<>(salaries);
Collections.sort(sorted);
Assert.assertEquals(salaries, sorted, "Salary column should be sorted ascending");`,
  explanation: `\`:nth-of-type(n)\` counts only siblings of the **same tag**; \`:nth-child(n)\` counts **all** siblings. In a row of \`<td>\`s they
are the same, but in mixed markup they differ — e.g. in \`<div><h3/><p/><p/></div>\` the first \`<p>\` is \`p:nth-of-type(1)\` but
\`p:nth-child(2)\`.

Column positions are a legitimate use of indexes because the table **structure** defines meaning. Even better, a framework can
look up the column index by header text (find the \`<th>\` "Salary", take its position) so re-ordering columns does not break tests.`,
  mistakes: [
    'Using 0-based indexes — CSS nth-* and XPath positions start at 1.',
    'Selecting #employee-table td:nth-of-type(3) without tbody is fine here, but including th rows (thead tr > *:nth-child(3)) gives the header too.',
    'Comparing salaries as Strings ("$100,000" < "$58,000" alphabetically) — parse to numbers first.',
  ],
  interview: [
    {
      q: 'nth-child vs nth-of-type?',
      a: 'nth-child(n) is the n-th child of its parent regardless of tag, and it must also match the tag you wrote; nth-of-type(n) is the n-th sibling of that tag type. Use nth-of-type when siblings have mixed tags.',
    },
    {
      q: 'How would you make column lookup independent of column order?',
      a: 'Read all <th> texts, find the index of "Salary", then build the cell locator with that index (td[index] or td:nth-of-type(index)). Wrap it in a table helper/component object.',
    },
    {
      q: 'What is the difference between //tr/td[3] and (//tr/td)[3]?',
      a: '//tr/td[3] = the third td of EVERY row (one per row). (//tr/td)[3] = the third td in the whole document (one element). The parentheses change what the index applies to.',
    },
  ],
}
