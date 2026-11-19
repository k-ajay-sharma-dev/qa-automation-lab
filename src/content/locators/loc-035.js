export default {
  id: 'loc-035',
  category: 'locators',
  kind: 'quiz',
  title: 'CSS or XPath? Know what each language can and cannot do',
  level: 'INTERMEDIATE',
  tags: ['css', 'xpath', 'text-match', 'parent-axis', 'comparison'],
  estMinutes: 10,
  scenario: `Your team is writing a locator guideline. One camp says "CSS only, it's faster and cleaner"; the other says "XPath can do
everything, just use XPath". The lead asks you to settle it with facts about ShopEasy pages — which language can express which locator —
so the guideline says *when* to use each, not which one is "better".`,
  description: `Answer each question about what CSS selectors (as used by \`By.cssSelector\` / \`document.querySelectorAll\`) and XPath 1.0
(as used by \`By.xpath\` in browsers) can express.`,
  hints: [
    'CSS selects downwards and sideways (descendants, children, following siblings). XPath can also walk up (parent, ancestor) and backwards (preceding-sibling).',
    'CSS has no selector that matches on visible text. :has() is newer CSS — check where it runs.',
  ],
  questions: [
    {
      q: 'A manual test case says "click **Register**" on form.html. Imagine the developers removed its id (`submit-btn`) and you want to locate it by its visible text, exactly "Register". Which statement is true?',
      options: [
        'CSS `button:contains(\'Register\')` works in Selenium',
        'Only XPath can match on text: `//button[normalize-space()=\'Register\']`',
        'CSS `button[text=\'Register\']` matches it',
        'Neither language can match text; use getText() in a loop',
      ],
      answer: 1,
      why: '`:contains()` was a jQuery/Sizzle extension, never real CSS — the browser throws an invalid selector error. `[text=...]` looks for an *attribute* called text. XPath `text()` / `normalize-space()` match visible text directly. (Looping with getText() works but is slow and noisy compared to one XPath.)',
    },
    {
      q: 'On table.html you want the **row** (`<tr>`) that contains the cell "Priya Sharma". Which is a correct XPath that walks **up** from the cell?',
      options: [
        '`//td[text()=\'Priya Sharma\']/parent::tr`',
        '`//td[text()=\'Priya Sharma\']/child::tr`',
        '`//tr/following-sibling::td[text()=\'Priya Sharma\']`',
        '`//td[text()=\'Priya Sharma\']/../../tr`',
      ],
      answer: 0,
      why: '`parent::tr` (or the shorthand `..`) moves from the cell to its row. `child::tr` looks *inside* the td. A td is never a sibling of a tr. `../..` climbs to tbody and then `/tr` returns *all* rows of the page, not Priya\'s.',
    },
    {
      q: 'Can classic CSS (as supported for years by every Selenium browser) select a **parent** based on its child — e.g. "the `.inventory-item` card that contains the Storm Fleece Jacket button"?',
      options: [
        'Yes, with `.inventory-item < button`',
        'Yes, with `.inventory-item:parent(button)`',
        'Not classic CSS; modern browsers support `.inventory-item:has(#add-to-cart-storm-fleece-jacket)`, while XPath `//button[@id=\'add-to-cart-storm-fleece-jacket\']/ancestor::div[contains(@class,\'inventory-item\')]` works everywhere',
        'No — no locator language can go from child to parent',
      ],
      answer: 2,
      why: 'There is no `<` combinator or `:parent()` in CSS. `:has()` is supported by current Chrome, Edge, Firefox and Safari, so it works in Selenium against modern browsers, but some older grids and tools reject it. XPath\'s `ancestor::` axis has always worked — and Playwright also offers `locator(...).filter({ has: ... })`.',
    },
    {
      q: 'Which task is **easier in CSS** than in XPath 1.0?',
      options: [
        'Matching on text',
        'Moving to the previous sibling',
        'Matching an element that has the class `btn-primary` among several classes, and attribute **ends-with** like `[data-testid$=\'-label\']`',
        'Going up to an ancestor',
      ],
      answer: 2,
      why: '`.btn-primary` matches a class inside `class="btn btn-primary btn-block"` cleanly; XPath needs `contains(concat(\' \', normalize-space(@class), \' \'), \' btn-primary \')` to be correct (plain `contains(@class,\'btn-primary\')` also matches `btn-primary-outline`). XPath 1.0 has `starts-with()` but no `ends-with()`. The other three tasks are XPath strengths.',
    },
    {
      q: 'What is the most sensible team guideline?',
      options: [
        'Ban XPath completely',
        'Use XPath for everything for consistency',
        'Prefer id/test id and short CSS; use XPath when you need text, a parent/ancestor, or preceding siblings. Never absolute paths in either language',
        'Use whichever the recorder generates',
      ],
      answer: 2,
      why: 'Both languages are tools. CSS is concise and readable for attributes and structure; XPath is the only option (in Selenium) for text and upward/backward navigation. The speed difference is negligible in real suites — stability and readability matter far more.',
    },
  ],
  explanation: `| Need | CSS | XPath 1.0 |
|---|---|---|
| id / attribute / class | \`#id\`, \`[name='x']\`, \`.cls\` ✔ easiest | \`//*[@id='id']\` ✔ (class matching is clumsy) |
| Attribute starts / ends / contains | \`^=\` \`$=\` \`*=\` ✔ | \`starts-with()\`, \`contains()\` ✔ — **no ends-with()** |
| Visible text | ✘ | \`text()\`, \`normalize-space()\`, \`contains(., 'x')\` ✔ |
| Child → parent / ancestor | \`:has()\` in modern browsers only | \`parent::\`, \`ancestor::\`, \`..\` ✔ |
| Previous sibling | ✘ | \`preceding-sibling::\` ✔ |
| Next sibling | \`+\` and \`~\` ✔ | \`following-sibling::\` ✔ |
| Nth match of the whole result | ✘ (\`:nth-of-type\` is per parent) | \`(//button)[2]\` ✔ |

Use CSS by default for attribute-based locators; switch to XPath when the element is best described by text or by its relationship to an
element above or before it — "the Edit button in Priya's row", "the price in the Storm Fleece Jacket card".`,
  mistakes: [
    'Using :contains() in CSS — it is a jQuery extension and fails in the browser.',
    'Believing XPath is "too slow" — the difference is milliseconds; flaky locators cost far more.',
    'Matching classes in XPath with @class=\'btn-primary\' — fails when the element has more than one class.',
  ],
  interview: [
    {
      q: 'CSS vs XPath — when do you use which?',
      a: 'CSS for ids, attributes and structure because it is short and readable. XPath when I need to match visible text or navigate up or backwards: parent, ancestor, preceding-sibling — typical for table rows and product cards.',
    },
    {
      q: 'How do you match an element by text in CSS?',
      a: 'You cannot in standard CSS. In Selenium I use XPath with normalize-space(); in Playwright I use getByText or getByRole with a name, or locator.filter({ hasText }).',
    },
    {
      q: 'Why is //button[@class=\'btn-primary\'] a weak XPath?',
      a: 'It compares the whole class attribute, so it fails for class="btn btn-primary". contains(@class, \'btn-primary\') is better but can match btn-primary-outline; the precise form uses concat(\' \', normalize-space(@class), \' \'). Or just use CSS .btn-primary.',
    },
  ],
}
