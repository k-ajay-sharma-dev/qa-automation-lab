export default {
  id: 'loc-012',
  category: 'locators',
  kind: 'locator',
  title: 'Dynamic ids: the "Place order" button that changes id on every load',
  level: 'INTERMEDIATE',
  tags: ['dynamic-ids', 'starts-with', 'xpath', 'css'],
  estMinutes: 10,
  scenario: `Your nightly run is red: \`NoSuchElementException: #submit-order-8f3a2\`. Locally it passed yesterday. You reload the page and the
id is now \`submit-order-c41d9\`. The front-end framework appends a random hash to ids on every render. Classic flaky locator —
and the defect is in the **test**, not in the app.`,
  description: `On **dynamic.html** (section 1, "Auto-generated ids"), match the **Place order** button in a way that survives a page reload.

**Rules**
- Do not hard-code the random part of the id (reload the page in the Locator Lab: it changes).
- Use only the **stable prefix** of the id.
- Exactly 1 element.`,
  hints: [
    'Inspect the button twice (reload in between) and compare the ids.',
    'Only submit-order- is stable. CSS: [id^="submit-order-"]',
    'XPath: //button[starts-with(@id,"submit-order-")]',
  ],
  page: 'dynamic.html',
  strategy: 'either',
  expected: '[id^="submit-order-"]',
  expectedCount: 1,
  solution: `CSS:    [id^='submit-order-']
XPath:  //button[starts-with(@id,'submit-order-')]
        //button[normalize-space()='Place order']           (text-based alternative)

Java:
driver.findElement(By.cssSelector("[id^='submit-order-']")).click();`,
  explanation: `Generated ids look like \`btn-8f3a2\`, \`ember1432\`, \`mat-input-7\`, \`react-select-3-input\`. The rule: **use the stable part, ignore the
generated part.** Prefix (\`^=\` / \`starts-with\`) is the most common fix; a nearby label or the button text is another.

Note the other two buttons have ids like \`btn-xxxxx\` — \`[id^='btn-']\` would match both of them and tells you nothing about which
button it is. A stable prefix is only useful when it is **meaningful**. If there is no meaningful part at all, ask the developers for a
\`data-testid\` — that is a legitimate request in the sprint, not a favour.`,
  mistakes: [
    'Copying the full id from DevTools — works once, fails on the next build or reload.',
    'Using contains(@id,"order") — matches other elements whose ids mention "order" (e.g. order-list).',
    'Adding Thread.sleep or retries to "fix" a NoSuchElementException that is actually a wrong locator.',
  ],
  interview: [
    {
      q: 'How do you handle dynamic ids in Selenium?',
      a: 'Use the stable part with starts-with/contains (CSS ^=, *=), or locate via a stable neighbour (label, heading, row text) with XPath axes, or by text. Best long-term fix: agree on data-testid attributes with the developers.',
    },
    {
      q: 'How do you tell a flaky locator from a timing problem?',
      a: 'Check whether the element exists at all with that locator after the page is fully loaded (DevTools $$/$x). If the locator never matches on a fresh load, it is the locator; if it matches later, it is synchronisation and needs an explicit wait.',
    },
  ],
}
