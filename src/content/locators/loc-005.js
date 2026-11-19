export default {
  id: 'loc-005',
  category: 'locators',
  kind: 'locator',
  title: 'Combine two attributes: the gender radio group',
  level: 'BEGINNER',
  tags: ['css', 'attribute', 'radio', 'form'],
  estMinutes: 7,
  scenario: `The seller registration form has a "Gender" question. The business analyst added a test case:
"verify all three options are present and none is pre-selected". The form also has text inputs and checkboxes,
so "every input" is far too broad — you need **only** the radio buttons of the gender group.`,
  description: `On **form.html**, match the **3 gender radio buttons** (the \`<input>\` elements).

**Rules**
- Combine two conditions: the input type **and** the group name.
- Exactly 3 elements.`,
  hints: [
    'All three radios share name="gender".',
    'CSS lets you chain attribute selectors: input[type="radio"][name="..."]',
    'XPath: //input[@type="radio" and @name="gender"]',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: 'input[type="radio"][name="gender"]',
  expectedCount: 3,
  solution: `CSS:    input[type='radio'][name='gender']
XPath:  //input[@type='radio' and @name='gender']

Java:
List<WebElement> genders = driver.findElements(By.cssSelector("input[type='radio'][name='gender']"));
Assert.assertEquals(genders.size(), 3);
Assert.assertTrue(genders.stream().noneMatch(WebElement::isSelected), "No gender should be pre-selected");`,
  explanation: `Chaining \`[a][b]\` in CSS means **AND** — the element must have both attributes. In XPath you write \`and\` inside one predicate.

Here \`By.name("gender")\` would also return the same 3 elements; adding \`[type='radio']\` documents intent and protects you if someone
later adds a hidden \`<input name="gender">\`. To pick one option, add the value: \`input[name='gender'][value='female']\`.`,
  mistakes: [
    'Writing input[type="radio"], [name="gender"] — the comma means OR, so it matches more elements.',
    'Clicking the <label> text and then asserting isSelected() on the label instead of the input.',
    'Selecting a radio by index (genders.get(1)) — the order can change; select by value instead.',
  ],
  interview: [
    {
      q: 'How do you select the "Female" radio button robustly?',
      a: 'By its value: By.cssSelector("input[name=\'gender\'][value=\'female\']") or by its id gender-female. Avoid list indexes because option order is a UI decision that can change.',
    },
    {
      q: 'What is the difference between "a b", "a > b" and "a, b" in CSS?',
      a: '"a b" = b anywhere inside a (descendant), "a > b" = b is a direct child of a, "a, b" = either a or b (a union of two selectors).',
    },
  ],
}
