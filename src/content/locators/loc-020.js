export default {
  id: 'loc-020',
  category: 'locators',
  kind: 'locator',
  title: 'Class-only trap: the checkout Continue button',
  level: 'BEGINNER',
  tags: ['by-id', 'class', 'checkout', 'ambiguity'],
  estMinutes: 6,
  scenario: `A teammate's checkout test clicks Continue with \`By.className("btn-primary")\`. It passes today. In code review you are asked:
"Is that locator safe?" The checkout page actually contains three steps in the same HTML (only one is visible at a time), and each step has a
blue primary button. \`findElement\` quietly returns the *first* match — the test works by luck, not by design.`,
  description: `On **checkout.html** (step 1, "Your Information"), write a locator that matches **only the Continue button**.

**Rules**
- Not a class-only locator — first try \`.btn-primary\` in DevTools and see how many elements it matches.
- Prefer an attribute that was made for identifying this element.
- Exactly 1 element.`,
  hints: [
    'Run $$(".btn-primary") in the DevTools Console — three buttons: Continue, Finish, Back Home.',
    'The button has id="continue" and data-testid="continue". Either one is a good, unique locator.',
  ],
  page: 'checkout.html',
  strategy: 'either',
  expected: '#continue',
  expectedCount: 1,
  solution: `CSS:    #continue                        (or [data-testid='continue'])
XPath:  //button[@id='continue']

Java:
private final By continueButton = By.id("continue");
driver.findElement(continueButton).click();`,
  explanation: `\`.btn-primary\` describes how a button **looks** (the blue style), not **what it is**. On checkout.html it matches three buttons —
Continue (step 1), Finish (step 2) and Back Home (step 3). Steps 2 and 3 are hidden with a CSS class, but they are still in the DOM, so
locators still find them.

\`findElement\` returns the first match in document order, so the old locator happens to hit Continue. The day a designer adds a primary
"Apply promo" button above the form, the test clicks the wrong button — and the failure message talks about the next page, far away from the
real cause.

\`#continue\` (or the \`data-testid\`) identifies the element by its purpose. Ids and test ids survive restyling; style classes do not.`,
  mistakes: [
    'Using By.className("btn-primary") because it "works" — it matches 3 elements and relies on order.',
    'Assuming hidden steps are not in the page — hidden elements are still found by locators.',
    'Writing By.className("btn btn-primary") — By.className accepts ONE class name; use By.cssSelector(".btn.btn-primary") for two.',
  ],
  interview: [
    {
      q: 'What does findElement do when the locator matches several elements?',
      a: 'It returns the first one in document order without any warning. That is why you should check the match count in DevTools ($$ or $x) before trusting a locator — a "working" locator can be matching the right element only by accident.',
    },
    {
      q: 'Why are styling classes poor locators?',
      a: 'They describe appearance and are shared across many elements; designers rename or reuse them during a restyle. Ids, names and data-testid attributes describe identity and purpose, so they change far less often.',
    },
  ],
}
