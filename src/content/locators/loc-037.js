export default {
  id: 'loc-037',
  category: 'locators',
  kind: 'locator',
  title: 'Checkbox by its label: tick "Outdoor gear"',
  level: 'BEGINNER',
  tags: ['css', 'xpath', 'checkbox', 'label', 'form'],
  estMinutes: 6,
  scenario: `The seller-registration test case TC-212 says: "Under *What will you sell?*, tick **Outdoor gear** and submit". The four
category checkboxes on form.html have **no ids** — they share \`name="categories"\` and only differ in their \`value\` and the text of the
\`<label>\` that wraps them. A colleague wrote \`(//input[@type='checkbox'])[2]\` and it breaks every time marketing reorders the categories.`,
  description: `On **form.html**, write a locator that matches **only the "Outdoor gear" checkbox** (the \`<input>\`, not the label).

**Rules**
- No position/index (\`[2]\`, \`:nth-child\`).
- Use either the checkbox's \`value\` (CSS) or the label text the manual tester sees (XPath).
- It must match exactly 1 element.`,
  hints: [
    'Inspect "Outdoor gear": the <input> sits inside its <label>. What attribute tells it apart from "Clothing" and "Kids"?',
    'CSS: combine name and value — input[name=\'categories\'][value=\'outdoor\'].',
    'XPath by label text: //label[normalize-space()=\'Outdoor gear\']/input',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: 'input[name="categories"][value="outdoor"]',
  expectedCount: 1,
  solution: `CSS:    input[name='categories'][value='outdoor']
XPath:  //label[normalize-space()='Outdoor gear']/input

Java:
WebElement outdoor = driver.findElement(By.cssSelector("input[name='categories'][value='outdoor']"));
if (!outdoor.isSelected()) {
    outdoor.click();
}
Assert.assertTrue(outdoor.isSelected());`,
  explanation: `Checkbox groups share one \`name\`, so \`name\` alone matches all four. The \`value\` is what the form actually submits, which makes
it a stable, meaningful identifier: \`input[name='categories'][value='outdoor']\`.

When the test case talks in **visible words** ("tick Outdoor gear"), XPath lets you start from the label text and step into the input:
\`//label[normalize-space()='Outdoor gear']/input\`. \`normalize-space()\` is needed because the label's text starts with a space after the
input (" Outdoor gear"). Both survive reordering; the index version does not.

Before clicking a checkbox, check \`isSelected()\` — \`click()\` toggles, so blindly clicking a pre-ticked box *unticks* it.`,
  mistakes: [
    'Using the index (//input[@type=\'checkbox\'])[2] — breaks when categories are reordered or one is added.',
    'Locating the <label> instead of the <input> and then calling isSelected() on it (a label is never "selected").',
    'Writing text()=\'Outdoor gear\' — the text node is " Outdoor gear" with a leading space, so it does not match; use normalize-space().',
    'Clicking without checking isSelected() first, which unticks an already-ticked box.',
  ],
  interview: [
    {
      q: 'How do you select a checkbox safely in Selenium?',
      a: 'Locate the input, check isSelected(), click only if it is not selected, then assert isSelected() is true. click() toggles, so the check keeps the step idempotent.',
    },
    {
      q: 'The checkbox is hidden behind a custom-styled label and click() throws ElementClickInterceptedException. What do you do?',
      a: 'Click the visible label that wraps it (clicking a label toggles its input), then assert on the input\'s isSelected(). JavaScript click is a last resort because it bypasses what a real user can do.',
    },
  ],
}
