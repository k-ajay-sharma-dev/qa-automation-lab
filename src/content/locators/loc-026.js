export default {
  id: 'loc-026',
  category: 'locators',
  kind: 'locator',
  title: 'Attribute presence [required]: every mandatory field',
  level: 'INTERMEDIATE',
  tags: ['css', 'attribute-presence', 'required', 'validation', 'form'],
  estMinutes: 7,
  scenario: `The product owner changed which registration fields are mandatory twice this quarter, and both times the manual test case was
out of date. You propose an automated check: "the set of required fields equals the list in the spec". For that you need a locator that
returns **whatever is currently marked required** — without naming the fields in it.`,
  description: `On **form.html**, match **every form control that has the \`required\` attribute**.

**Rules**
- Match on the presence of the attribute, not on field ids or names.
- Stay inside the registration form.
- Exactly 4 elements (it includes the Country dropdown, not only inputs).`,
  hints: [
    'required is a boolean attribute: <input ... required> — it has no value to compare.',
    'In CSS, [attr] without =value means "has the attribute". In XPath: [@attr].',
    'CSS: #registration-form [required]',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: '#registration-form [required]',
  expectedCount: 4,
  solution: `CSS:    #registration-form [required]
XPath:  //form[@id='registration-form']//*[@required]

Java:
List<String> required = driver.findElements(By.cssSelector("#registration-form [required]"))
        .stream().map(e -> e.getAttribute("name")).toList();
Assert.assertEquals(required, List.of("firstName", "lastName", "email", "country"));`,
  explanation: `\`[required]\` matches elements that **have** the attribute, whatever its value (\`required\`, \`required=""\` and \`required="required"\`
are all the same thing in HTML). It is the natural way to locate by boolean attributes: \`[disabled]\`, \`[readonly]\`, \`[multiple]\`,
\`[hidden]\`, \`[checked]\`.

Because the locator names a **property** and not specific fields, the test's assertion — the list of names — is where the spec lives. When the
product owner makes Postal code mandatory, the test fails with a clear diff instead of passing on a stale locator.

Using \`*\` (any tag) in XPath, or no tag in CSS, matters here: the Country \`<select>\` is required too. \`input[required]\` would give 3.

One more catch from this page: the Terms checkbox has a "*" in its label but **no** \`required\` attribute — the form validates it with
JavaScript. Your test just found a real inconsistency worth raising with the developers.`,
  mistakes: [
    'Writing input[required] and missing the required <select> (and any required <textarea>).',
    'Writing [required=\'true\'] — the attribute usually has no value, so an equality check matches nothing.',
    'Trusting the "*" in labels as the source of truth instead of the DOM (Terms has a * but no required attribute).',
  ],
  interview: [
    {
      q: 'How do you locate elements by a boolean attribute such as disabled or required?',
      a: 'Use attribute presence: CSS [disabled] or XPath [@disabled]. To find the opposite, use :not([disabled]) or [not(@disabled)]. In Java you can also read element.getAttribute("required"), which returns "true" or null.',
    },
    {
      q: 'The UI marks a field with * but the HTML has no required attribute. Is that a bug?',
      a: 'It can be: browser validation, assistive technologies and some form tools rely on the attribute, so screen-reader users may not know the field is mandatory. It is worth logging as an accessibility/consistency defect even if the JavaScript validation works.',
    },
  ],
}
