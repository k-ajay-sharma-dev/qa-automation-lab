export default {
  id: 'sel-040',
  category: 'selenium',
  kind: 'quiz',
  title: 'getText() vs the value property: reading back what is in a form field',
  level: 'BEGINNER',
  tags: ['getText', 'getDomProperty', 'getDomAttribute', 'form', 'assertions'],
  estMinutes: 8,
  scenario: `A new teammate automated the seller registration form (\`form.html\`). The test fills every field and then asserts the values before submitting — and every assertion fails with \`expected [Jane] but found []\`. The page clearly shows "Jane" in the First name box. They ask you why Selenium "cannot see" the text.`,
  description: `Answer the questions about reading values back from inputs, textareas and selects on \`form.html\`.`,
  hints: [
    'getText() returns the rendered text *between* the tags of an element. An <input> has no content between tags.',
    'What the user typed lives in the live value property, not in the HTML attribute.',
  ],
  questions: [
    {
      q: `The test typed "Jane" into \`#firstName\`. What does this return?

\`\`\`java
driver.findElement(By.id("firstName")).getText();
\`\`\``,
      options: ['"Jane"', '"" (an empty string)', 'null', 'It throws InvalidElementStateException'],
      answer: 1,
      why: '`<input>` is a void element with no text content, so getText() returns an empty string. The typed text is in the `value` property. It does not throw and it does not return null.',
    },
    {
      q: 'Which call reliably returns "Jane" after the user (or the test) typed it?',
      options: [
        'getDomAttribute("value")',
        'getDomProperty("value")',
        'getCssValue("value")',
        'getAccessibleName()',
      ],
      answer: 1,
      why: '`getDomProperty("value")` reads the live JavaScript property, which changes as the user types. `getDomAttribute("value")` reads the HTML attribute as written in the source — for `#firstName` there is none, so it returns null. `getAttribute("value")` also works because it prefers the property, but Selenium 4 recommends the explicit methods. getAccessibleName() returns the label, "First name *".',
    },
    {
      q: 'The address is typed into the `<textarea id="address">`. Which statement is true?',
      options: [
        'getText() returns the typed address, because textarea has content between tags',
        'getDomProperty("value") returns the typed address; getText() is unreliable because it reflects the original content, not what was typed',
        'Textareas cannot be read by Selenium',
        'You must use JavascriptExecutor to read a textarea',
      ],
      answer: 1,
      why: 'A textarea\'s child text is its *default* value. Typing changes the `value` property, not the child text node, so getText() may return the initial (here empty) content. Treat textarea like an input and read `value`.',
    },
    {
      q: 'For the `#country` select with "United Kingdom" chosen, which assertion checks what the user *sees* selected?',
      options: [
        'driver.findElement(By.id("country")).getText() equals "United Kingdom"',
        'new Select(driver.findElement(By.id("country"))).getFirstSelectedOption().getText() equals "United Kingdom"',
        'driver.findElement(By.id("country")).getDomAttribute("value") equals "United Kingdom"',
        'driver.findElement(By.id("country")).isSelected()',
      ],
      answer: 1,
      why: 'getFirstSelectedOption().getText() returns the visible label. getText() on the select returns the text of *all* options joined together. The select\'s value property would be "GB" (the option value), not the label; isSelected() applies to options, checkboxes and radios, not to the select.',
    },
    {
      q: 'You want to verify a radio choice on the form: "Female" is selected. Which is the best check?',
      options: [
        'driver.findElement(By.id("gender-female")).getText().equals("Female")',
        'driver.findElement(By.id("gender-female")).isSelected()',
        'driver.findElement(By.id("gender-female")).getDomAttribute("checked") != null',
        'driver.findElement(By.id("gender-female")).isDisplayed()',
      ],
      answer: 1,
      why: 'isSelected() reflects the live checked state. The `checked` *attribute* only says whether it was checked in the original HTML, so it is null after a user click. getText() on a radio is "", and isDisplayed() says nothing about selection.',
    },
  ],
  explanation: `Rule of thumb for form fields:

- **input / textarea** → \`getDomProperty("value")\` for what is in the box now.
- **select** → \`new Select(el).getFirstSelectedOption().getText()\` for the label, \`getDomProperty("value")\` for the code ("GB").
- **checkbox / radio** → \`isSelected()\`.
- **getText()** → only for elements whose text is rendered between tags (labels, messages, table cells).
- **getDomAttribute** → the original HTML attribute (useful for \`maxlength\`, \`placeholder\`, \`required\`), not the live state.`,
  mistakes: [
    'Using getText() on inputs and "fixing" the failure by deleting the assertion.',
    'Using getDomAttribute("value") or getDomAttribute("checked") to read live state — attributes show the original HTML, not what the user did.',
    'Comparing a select\'s value ("GB") with its visible label ("United Kingdom").',
  ],
  interview: [
    { q: 'What is the difference between an HTML attribute and a DOM property?', a: 'The attribute is what is written in the HTML source and usually does not change. The property is the live JavaScript state of the element — for value and checked it changes as the user interacts. Selenium 4 exposes both via getDomAttribute and getDomProperty.' },
    { q: 'What does the old getAttribute("value") do in Selenium 4?', a: 'It returns the property if one exists, otherwise the attribute. It still works but is ambiguous, so getDomProperty / getDomAttribute make the intent explicit.' },
    { q: 'How would you check the placeholder text of an empty field?', a: 'getDomAttribute("placeholder") — the placeholder is a real HTML attribute and is not returned by getText() or by value.' },
  ],
}
