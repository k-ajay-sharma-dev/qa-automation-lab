export default {
  id: 'loc-008',
  category: 'locators',
  kind: 'locator',
  title: 'Contains (*=): all phone number fields',
  level: 'INTERMEDIATE',
  tags: ['css', 'attribute-operators', 'contains', 'form'],
  estMinutes: 8,
  scenario: `A production bug: the registration form accepted letters in phone numbers. The fix covers **all** phone fields —
home, work and mobile — and your test must type "abc" into each and expect a validation error. The field names are
\`homePhone\`, \`workPhone\` and \`mobilePhone\`. One locator should catch all three, including any \`faxPhone\` added later.`,
  description: `On **form.html**, match the **3 phone inputs** with one locator based on a **substring** of the \`name\` attribute.

**Rules**
- Use the CSS "contains" operator \`*=\` or XPath \`contains()\`.
- Note: attribute matching is case-sensitive.
- Exactly 3 elements.`,
  hints: [
    'All three names contain the text Phone (capital P).',
    'CSS: input[name*="Phone"]',
    'Alternative: the ids all END with -phone → input[id$="-phone"]',
  ],
  page: 'form.html',
  strategy: 'either',
  expected: 'input[name*="Phone"]',
  expectedCount: 3,
  solution: `CSS:    input[name*='Phone']        (or input[id$='-phone'])
XPath:  //input[contains(@name,'Phone')]

Java:
List<WebElement> phones = driver.findElements(By.cssSelector("input[name*='Phone']"));
for (WebElement phone : phones) {
    phone.clear();
    phone.sendKeys("abc");
}`,
  explanation: `\`*=\` matches when the attribute value contains the substring anywhere. It is powerful but **broad** — always check in
DevTools that it does not catch more than you expect. Here \`*='phone'\` (lower-case) would match nothing on the \`name\`, because
attribute values are case-sensitive.

Both answers are fine; choose the one based on the attribute least likely to change. Field \`name\`s are tied to the backend
payload, so they tend to be more stable than ids.`,
  mistakes: [
    'Writing *="phone" in lower case — attribute values are case-sensitive.',
    'Using a very short substring like *="e" — it matches almost everything.',
    'Using By.name("Phone") — By.name needs the exact full value, not a substring.',
  ],
  interview: [
    {
      q: 'contains(@class, "btn") in XPath — what is the classic gotcha?',
      a: 'It is substring matching, so it also matches "btn-primary", "submit-btn", "btnGroup"… For exact class-word matching use CSS .btn, or the XPath idiom contains(concat(" ", normalize-space(@class), " "), " btn ").',
    },
    {
      q: 'Is CSS case-sensitive?',
      a: 'Attribute values are case-sensitive by default (you can add the i flag: [name*="phone" i]). HTML tag and attribute names are not. XPath is fully case-sensitive; for case-insensitive text use translate().',
    },
  ],
}
