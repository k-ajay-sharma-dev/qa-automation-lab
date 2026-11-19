export default {
  id: 'loc-002',
  category: 'locators',
  kind: 'locator',
  title: 'No id? Use the name attribute — the "Remember me" checkbox',
  level: 'BEGINNER',
  tags: ['by-name', 'login', 'checkbox'],
  estMinutes: 5,
  scenario: `A new requirement landed in Sprint 9: "Remember me keeps the username after logout". You wrote the manual test case;
now it must be automated. Inspecting the checkbox, you notice it has **no id** — but it is a form field, and form fields
almost always carry a \`name\` attribute because the backend needs it.`,
  description: `On **login.html**, locate the **Remember me** checkbox.

**Rules**
- Use its \`name\` attribute (CSS attribute selector or XPath \`@name\`).
- Match exactly 1 element — the \`<input>\`, not the \`<label>\` around it.`,
  hints: [
    'Inspect the checkbox: <input type="checkbox" name="...">',
    'CSS attribute selector syntax: input[name="value"]',
    'The name is rememberMe — By.name("rememberMe")',
  ],
  page: 'login.html',
  strategy: 'either',
  expected: 'input[name="rememberMe"]',
  expectedCount: 1,
  solution: `CSS:    input[name='rememberMe']
XPath:  //input[@name='rememberMe']

Java:
WebElement rememberMe = driver.findElement(By.name("rememberMe"));
if (!rememberMe.isSelected()) {
    rememberMe.click();
}`,
  explanation: `\`By.name\` is the next best thing after \`By.id\` for form fields: names are tied to the backend contract
(the field name that is posted), so developers change them rarely.

Names are **not guaranteed unique** though — a group of radio buttons all share one name. For a single checkbox it is fine.
Also note the checkbox pattern: check \`isSelected()\` before clicking, otherwise a test that runs twice (or after a
remembered state) unticks it again.`,
  mistakes: [
    'Locating the <label> text instead of the input and then calling isSelected() on the label (always false).',
    'Clicking the checkbox blindly — if it was already ticked, the click unticks it.',
    'Assuming name is unique: radio groups and some legacy forms reuse the same name many times.',
  ],
  interview: [
    {
      q: 'What is the difference between By.name and By.className?',
      a: 'By.name matches the name attribute (form field identifier). By.className matches one CSS class from the class attribute; it cannot take a space-separated list like "btn btn-primary" — use cssSelector(".btn.btn-primary") for that.',
    },
    {
      q: 'How do you verify a checkbox is ticked in Selenium?',
      a: 'element.isSelected() returns true for checked checkboxes/radios and selected <option>s. Do not read the "checked" attribute text — getAttribute/getDomProperty("checked") works, but isSelected is the intended API.',
    },
  ],
}
