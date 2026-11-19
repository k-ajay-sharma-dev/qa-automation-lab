export default {
  id: 'loc-025',
  category: 'locators',
  kind: 'locator',
  title: 'normalize-space(): the Salary column header with hidden spaces',
  level: 'INTERMEDIATE',
  tags: ['xpath', 'normalize-space', 'text', 'web-table'],
  estMinutes: 8,
  scenario: `Ticket QA-388: "sorting by Salary sometimes shows the wrong order". Your sort test clicks the **Salary** header by its visible text.
The XPath \`//th[text()='Salary']\` looks perfect, DevTools shows the header says exactly *Salary* — and Selenium throws
\`NoSuchElementException\`. You stare at the screen; the word is right there.`,
  description: `On **table.html**, write an XPath that matches the **Salary column header** using its **visible text**.

**Rules**
- XPath only, based on the text the user sees ("Salary").
- Do not use the \`data-sort\` attribute — the business wants tests to read like the UI.
- Exactly 1 element.`,
  hints: [
    'Inspect the header in the Elements panel (not just the page): Salary <span class="sort-indicator"></span> — there is a space before the span.',
    'text() is "Salary " (with a trailing space), so an exact text() match fails.',
    'normalize-space() trims and collapses whitespace: //th[normalize-space()=\'Salary\']',
  ],
  page: 'table.html',
  strategy: 'xpath',
  expected: "#employee-table th[data-sort='salary']",
  expectedCount: 1,
  solution: `XPath:  //table[@id='employee-table']//th[normalize-space()='Salary']
        //th[normalize-space(text())='Salary']

Java:
By salaryHeader = By.xpath("//table[@id='employee-table']//th[normalize-space()='Salary']");
driver.findElement(salaryHeader).click();`,
  explanation: `The header's HTML is \`<th …>Salary <span class="sort-indicator"></span></th>\`. Its own text node is \`"Salary "\` — the space
before the span is real text, invisible on screen. \`text()='Salary'\` is an exact comparison, so it fails. \`.='Salary'\` fails too (the full
text is also "Salary ").

\`normalize-space()\` strips leading and trailing whitespace and collapses runs of spaces, tabs and line breaks into one space. It is what a
human "sees", which is why it is the safest default for any exact text match.

Bonus: after you click the header, the span gets a ▲ or ▼ arrow and the full text becomes "Salary ▲". \`normalize-space()='Salary'\` (on the
whole element) would then stop matching; \`normalize-space(text())='Salary'\` keeps working because it looks only at the th's own text node.
Always ask: *what will this text look like in the next state?*`,
  mistakes: [
    'Trusting what the rendered page shows — inspect the HTML; whitespace and inner tags are invisible on screen.',
    'Switching to contains(text(),\'Salary\') by reflex — it works here but would also match "Salary band" or "Base salary" headers later.',
    'Copying the text from the page into the locator including a non-breaking space or arrow.',
  ],
  interview: [
    {
      q: 'What does normalize-space() do and why use it?',
      a: 'It trims leading/trailing whitespace and collapses internal whitespace to single spaces. HTML is often formatted with line breaks and indentation, so exact text() comparisons fail on text that looks identical on screen; normalize-space() compares what the user actually sees.',
    },
    {
      q: 'What is the difference between text() and . (dot) in an XPath predicate?',
      a: 'text() refers to the element\'s own direct text nodes. The dot is the string value of the whole element, including text of all its descendants. Use the dot (or normalize-space()) when the text is split across child elements.',
    },
  ],
}
