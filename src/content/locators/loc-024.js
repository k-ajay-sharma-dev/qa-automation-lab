export default {
  id: 'loc-024',
  category: 'locators',
  kind: 'locator',
  title: 'Sibling combinator (+): the error message next to Country',
  level: 'INTERMEDIATE',
  tags: ['css', 'siblings', 'adjacent-sibling', 'validation', 'form'],
  estMinutes: 8,
  scenario: `You are writing negative tests for the seller registration form: submit it empty and check each field shows its own validation
message. Rather than one locator per message, your Page Object should have **one** method — \`errorFor(fieldId)\` — that finds "the error
right after this field". Developers confirmed every validated field is followed by an \`<span class="field-error">\`.`,
  description: `On **form.html**, match the **validation message element for the Country dropdown**, located **relative to the dropdown**.

**Rules**
- Do not use the error element's own id (\`country-error\`) — the point is a pattern that works for any field id.
- CSS: use a sibling combinator (\`+\` or \`~\`). XPath: use \`following-sibling::\`.
- Exactly 1 element. (The message is empty until you submit — the element is still there.)`,
  hints: [
    'Inspect Country: <select id="country"> followed by <span class="field-error" id="country-error"> in the same form-row.',
    '+ means "the element immediately after, with the same parent": #country + .field-error',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: '#country-error',
  expectedCount: 1,
  solution: `CSS:    #country + .field-error
XPath:  //select[@id='country']/following-sibling::span[contains(@class,'field-error')]

Java (Page Object):
public String errorFor(String fieldId) {
    return driver.findElement(By.cssSelector("#" + fieldId + " + .field-error")).getText();
}

errorFor("country");    // "Please select a country"
errorFor("email");      // "Email is required"`,
  explanation: `CSS sibling combinators look **forward** at elements that share the same parent:

| Combinator | Meaning |
|---|---|
| \`A + B\` | the B **immediately** after A |
| \`A ~ B\` | **any** B after A |

\`#country + .field-error\` = "the field-error that comes right after the country select". It describes the relationship, so the same
pattern works for \`firstName\`, \`lastName\` and \`email\` too — one method instead of five locators.

Watch the edge case: the Terms checkbox sits **inside** a \`<label>\`, so \`#terms + .field-error\` matches nothing — the error is a sibling of the
label, not of the checkbox. Patterns are great, but always check them against the real markup of each field.

CSS cannot go **backwards** or **up** (from the error to its field). For that you need XPath (\`preceding-sibling::\`, \`..\`).`,
  mistakes: [
    'Expecting a + b to match when another element sits between them — + means immediately next; use ~ for "any later sibling".',
    'Assuming the pattern fits every field without checking (the Terms checkbox is wrapped in a label).',
    'Trying to locate an element BEFORE another with CSS — siblings only go forward.',
  ],
  interview: [
    {
      q: 'What is the difference between "A B", "A > B", "A + B" and "A ~ B" in CSS?',
      a: 'Space: B anywhere inside A. >: B is a direct child of A. +: B is the next sibling right after A. ~: B is any later sibling of A. All of them return B; A is only the anchor.',
    },
    {
      q: 'How do you test validation messages efficiently?',
      a: 'Use a data-driven test (DataProvider or Scenario Outline) with field + input + expected message, and a single Page Object method that finds the message relative to the field. Also assert the message disappears after a valid value is entered.',
    },
  ],
}
