export default {
  id: 'loc-017',
  category: 'locators',
  kind: 'locator',
  title: 'Why absolute XPath is bad: fix the recorded search-box locator',
  level: 'ADVANCED',
  tags: ['xpath', 'absolute-xpath', 'maintenance', 'web-table'],
  estMinutes: 10,
  scenario: `An old Selenium IDE recording from the previous vendor is in your repo. It locates the employee search box with
\`/html/body/main/section/div/input\`. Last sprint the developers wrapped the page in an extra layout \`<div>\` and added a page title above
the table. Thirty-one tests in the employee suite now fail with \`NoSuchElementException\` — and nothing is wrong with the app.`,
  description: `On **table.html**, write a **robust** locator for the **employee search input**.

**Rules**
- No absolute paths starting with \`/html\`. No index chains like \`div[2]/div[1]\`.
- Use an attribute that describes the element itself.
- Exactly 1 element.`,
  hints: [
    'Inspect the search box. Does it have an id? An aria-label? A placeholder?',
    'It has id="table-search" — By.id is the obvious fix.',
    'Without an id you could use input[aria-label="Search employees"].',
  ],
  page: 'table.html',
  strategy: 'either',
  expected: '#table-search',
  expectedCount: 1,
  solution: `CSS:    #table-search                                 (or input[aria-label='Search employees'])
XPath:  //input[@id='table-search']

Java:
WebElement search = driver.findElement(By.id("table-search"));
search.sendKeys("Engineering");`,
  explanation: `An absolute XPath encodes the **entire path from the root**. Every wrapper div, banner, cookie notice or A/B-test element added
above the target shifts it and the locator breaks. It also tells a reader nothing about *what* the element is.

\`\`\`
/html/body/main/section/div/input                         ← recorded, broke after redesign
//input[@id='table-search']                               ← describes the element itself
\`\`\`

The browser's *Copy → Copy full XPath* produces exactly this kind of path; *Copy XPath* is often better but still index-heavy. Treat both as a
**starting point for investigation**, never as the final locator.

Priority order most teams agree on: **id → name → data-testid / stable CSS attribute → CSS structure → XPath (text / axes)** —
and absolute XPath never.`,
  mistakes: [
    'Copying "Full XPath" from DevTools into the Page Object.',
    'Fixing a broken absolute XPath by updating the indexes — it will break again next sprint.',
    'Choosing the placeholder text as the locator when a stable id exists (placeholders get re-worded and translated).',
  ],
  interview: [
    {
      q: 'Absolute vs relative XPath — which do you use and why?',
      a: 'Relative (starting with //) anchored on a meaningful attribute or text. Absolute XPath (/html/body/...) depends on the whole DOM structure above the element, so any layout change breaks it, and it is unreadable in code review.',
    },
    {
      q: 'What is your locator priority order?',
      a: 'id, then name, then a dedicated test attribute like data-testid, then a short CSS selector on stable attributes/classes, then XPath when I need text or axes. I avoid indexes and absolute paths, and I ask developers for test ids when nothing stable exists.',
    },
    {
      q: 'A suite of 30 tests failed because one locator changed. What does that tell you about the framework?',
      a: 'That the Page Object Model is working if the fix is one line in one page class — or that it is missing if the locator was copy-pasted into 30 tests. Locators must live in exactly one place.',
    },
  ],
}
