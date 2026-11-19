export default {
  id: 'loc-010',
  category: 'locators',
  kind: 'locator',
  title: 'XPath text(): the button that just says "Save"',
  level: 'BEGINNER',
  tags: ['xpath', 'text', 'dynamic'],
  estMinutes: 8,
  scenario: `The product-description editor has four buttons: **Save**, **Save draft**, **Save & close**, **Cancel**. No ids, no test ids,
identical classes — the developer says "test ids are on the backlog". The only difference between them is the visible text.
This is exactly where XPath shines: CSS cannot select by text, XPath can.`,
  description: `On **dynamic.html** (section 3, "Buttons that differ only by text"), match **only the "Save" button** — not "Save draft" or "Save & close".

**Rules**
- Use XPath with an **exact** text match.
- Exactly 1 element.`,
  hints: [
    'contains(text(), "Save") matches three buttons — that is the trap.',
    'Exact match: //button[text()="Save"]',
    'normalize-space() or "." also work: //button[normalize-space()="Save"]',
  ],
  page: 'dynamic.html',
  strategy: 'xpath',
  expected: '#editor-toolbar button:nth-of-type(1)',
  expectedCount: 1,
  solution: `XPath:  //button[text()='Save']
        //div[@id='editor-toolbar']/button[normalize-space()='Save']   (scoped + whitespace-safe)
CSS:    no pure-CSS way to match text; position only: #editor-toolbar button:nth-of-type(1)

Java:
driver.findElement(By.xpath("//div[@id='editor-toolbar']/button[normalize-space()='Save']")).click();`,
  explanation: `\`text()='Save'\` compares the element's **own text node** exactly. \`contains(text(),'Save')\` is a substring match and would hit
"Save draft" and "Save & close" too.

- \`text()\` — the direct text node(s) only; fails if the text is split by a child tag (\`<button><i/> Save</button>\` gives " Save").
- \`.\` or \`normalize-space()\` — the full string value of the element, trimmed and with collapsed spaces. Usually the safest.

Text locators are readable and match what a user sees, but they break on copy changes and **localisation** (Save → Speichern). Treat them as
a good fallback, not a first choice.`,
  mistakes: [
    'Using contains(text(),"Save") — three matches, findElement silently takes the first one in DOM order.',
    'Exact text() with stray whitespace or an icon inside the button — use normalize-space().',
    'Trying a CSS :contains("Save") — that was jQuery, not standard CSS; browsers throw an invalid selector error.',
  ],
  interview: [
    {
      q: 'Can CSS selectors find an element by its text?',
      a: 'No. :contains() was a jQuery/Sizzle extension and never part of the CSS standard. Use XPath (text(), normalize-space(), contains()), or find a list and filter in Java by getText().',
    },
    {
      q: 'What is the difference between text() and . in XPath?',
      a: 'text() selects text-node children of the element; . is the element\'s whole string value including descendants. [.="Save"] works when the text is wrapped in a <span> inside the button, [text()="Save"] does not.',
    },
  ],
}
