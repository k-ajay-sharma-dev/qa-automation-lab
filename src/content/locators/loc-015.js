export default {
  id: 'loc-015',
  category: 'locators',
  kind: 'locator',
  title: 'Web table: the Edit button in the row where Name = "Priya Sharma"',
  level: 'ADVANCED',
  tags: ['xpath', 'web-table', 'axes', 'interview-classic'],
  estMinutes: 12,
  scenario: `The most asked locator question in Selenium interviews, and a daily task in back-office apps: "edit the employee called Priya Sharma".
Every row has an **Edit** button with the same text and classes. The table can be sorted and filtered, so Priya is not always in row 3.
You must find the row by the **name cell**, then click the Edit button **in that same row**.`,
  description: `On **table.html**, match the **Edit button in Priya Sharma's row**.

**Rules**
- Anchor on the cell text "Priya Sharma".
- No row indexes.
- Exactly 1 element.`,
  hints: [
    'Row structure: <tr><td>Name</td><td>Dept</td><td>Salary</td><td>Status</td><td><button>Edit</button></td></tr>',
    'Row with that name: //tr[td[text()="Priya Sharma"]]',
    'Then the button inside it: //tr[td[text()="Priya Sharma"]]//button[text()="Edit"]',
  ],
  page: 'table.html',
  strategy: 'xpath',
  expected: '#employee-table button[data-emp-id="3"]',
  expectedCount: 1,
  solution: `XPath:  //tr[td[text()='Priya Sharma']]//button[text()='Edit']
        //td[text()='Priya Sharma']/following-sibling::td/button[text()='Edit']
        //td[text()='Priya Sharma']/parent::tr//button

Java (Page Object method):
private static final String EDIT_BTN_FOR = "//table[@id='employee-table']//tr[td[normalize-space()='%s']]//button[text()='Edit']";

public void editEmployee(String name) {
    driver.findElement(By.xpath(String.format(EDIT_BTN_FOR, name))).click();
}

driver.findElement(By.xpath("//tr[td[text()='Priya Sharma']]//button[text()='Edit']")).click();`,
  explanation: `The pattern is: **find the row by a known cell, then act within that row**. Three equivalent ways:

1. Predicate on the row — \`//tr[td[text()='X']]\` = "the tr that has a td with text X". Most readable.
2. Sibling axis — from the name cell go to a later sibling cell.
3. Parent axis — from the name cell go up to the tr and back down.

What about pagination? If Priya is on page 2, this locator finds nothing. A robust helper searches the table (or uses the search box)
first, or loops over pages until \`findElements(...)\` is not empty. That is a great follow-up answer in an interview.`,
  mistakes: [
    'Using //tr[3]//button — passes until someone sorts the table or a new employee is added.',
    'Using contains(text(),"Priya") — would also match "Priyanka" rows.',
    'Forgetting the row scope: //td[text()="Priya Sharma"] | //button[text()="Edit"] returns many elements.',
    'Not handling the case where the row is on another page of a paginated table.',
  ],
  interview: [
    {
      q: 'How do you click a button in a web table row based on another column\'s value?',
      a: 'Locate the row with a predicate on the known cell, e.g. //tr[td[normalize-space()="Priya Sharma"]], then find the button relative to it (//button[text()="Edit"]). Parameterise the name in a Page Object method.',
    },
    {
      q: 'How do you read a whole web table into Java?',
      a: 'findElements("#table tbody tr"), then for each row row.findElements(By.tagName("td")) and map cells to a POJO or Map<String,String> keyed by header text. Compare to expected data with assertEquals on lists/objects.',
    },
    {
      q: 'The table is paginated. How do you find a row that might be on any page?',
      a: 'Use the search/filter if the UI has one (fastest, like a user). Otherwise loop: check findElements(rowLocator).isEmpty(), click Next while it is enabled, stop when found or on the last page.',
    },
  ],
}
