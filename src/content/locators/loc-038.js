export default {
  id: 'loc-038',
  category: 'locators',
  kind: 'quiz',
  title: 'Which By? id, name, className, linkText or partialLinkText',
  level: 'BEGINNER',
  tags: ['by-strategies', 'linkText', 'className', 'selenium'],
  estMinutes: 7,
  scenario: `Your first week on the ShopEasy automation team. The lead hands you a list of manual steps ("click the Cart link", "tick
Remember me", "open the size guide") and asks you to pick the Selenium \`By\` method for each before you write any code. Picking the wrong
\`By\` is one of the most common causes of InvalidSelectorException and "it clicked the wrong thing" bugs in a junior's first PRs.`,
  description: `Choose the best answer for each question. All elements are on the ShopEasy practice site.`,
  hints: [
    'By.linkText / By.partialLinkText only work for <a> elements and use the visible link text.',
    'By.className takes exactly ONE class name — no spaces, no dot.',
  ],
  questions: [
    {
      q: 'On windows.html: `<a href="new-window.html" target="_blank" id="new-tab-link" class="btn btn-primary">Open size guide in new tab</a>`. A manual step says "click **Open size guide in new tab**" and you want the locator to read like the step. Which works?',
      options: [
        '`By.linkText("Open size guide in new tab")`',
        '`By.name("Open size guide in new tab")`',
        '`By.tagName("Open size guide in new tab")`',
        '`By.className("btn btn-primary")`',
      ],
      answer: 0,
      why: '`linkText` matches an `<a>` by its exact visible text. `name` looks at the name attribute (the link has none), `tagName` expects a tag like `a`, and `className` with a space throws InvalidSelectorException in Selenium 4 (and would not be unique anyway). `By.id("new-tab-link")` would be even more stable.',
    },
    {
      q: 'You write `driver.findElement(By.className("btn btn-primary"))`. What happens?',
      options: [
        'It finds elements that have both classes',
        'It finds elements that have either class',
        'It throws InvalidSelectorException — compound class names are not allowed; use `By.cssSelector(".btn.btn-primary")`',
        'It silently returns the first button on the page',
      ],
      answer: 2,
      why: '`By.className` accepts a single class. For several classes on one element, use CSS: `.btn.btn-primary` (no space = same element).',
    },
    {
      q: 'The header nav on every page has links Home, Login, Inventory, **Cart**, **Checkout**… What does `By.partialLinkText("Ch")` return with `findElement`?',
      options: [
        'The Cart link',
        'The Checkout link — the first link whose text contains "Ch"',
        'Nothing, partial text must be at least 4 characters',
        'Both links in one WebElement',
      ],
      answer: 1,
      why: '`partialLinkText` is a *contains* match on link text, and `findElement` returns the first match in document order — Checkout. Short partial texts are risky: a new "Change password" link earlier in the page would steal the click.',
    },
    {
      q: 'On login.html the "Remember me" checkbox is `<input type="checkbox" name="rememberMe">` with no id. Best choice?',
      options: [
        '`By.linkText("Remember me")`',
        '`By.name("rememberMe")`',
        '`By.tagName("input")`',
        '`By.xpath("//input[3]")`',
      ],
      answer: 1,
      why: '`name` is a stable, meaningful attribute on form fields (the server reads it). `linkText` only works for links, `tagName("input")` returns the first input (the username), and an index breaks when a field is added.',
    },
    {
      q: 'When is `By.tagName` a good choice?',
      options: [
        'To click a specific button',
        'Inside an already-found container, e.g. `row.findElements(By.tagName("td"))` to read all cells of one table row',
        'Never — it is deprecated in Selenium 4',
        'To locate an element inside an iframe without switching',
      ],
      answer: 1,
      why: 'A tag name alone is rarely unique on a page, but *scoped* to one element (a row, a list, a form) it is perfect for "give me all its cells / items". It is not deprecated, and nothing locates inside an iframe without `switchTo().frame(...)`.',
    },
  ],
  explanation: `**The 8 Selenium \`By\` strategies in one table:**

| By | Matches | Use it for |
|---|---|---|
| \`id\` | id attribute | first choice when stable |
| \`name\` | name attribute | form fields |
| \`className\` | ONE class | rarely — classes are for styling |
| \`tagName\` | tag | scoped lists: cells, options, items |
| \`linkText\` | exact text of an \`<a>\` | links whose text is the requirement |
| \`partialLinkText\` | text contains | long/dynamic link text — carefully |
| \`cssSelector\` | CSS | most other cases |
| \`xpath\` | XPath | text, parents, axes |

\`id\`, \`name\` and \`className\` are internally converted to CSS selectors in Selenium 4 — so pick the one that **reads best and is most
stable**, not the one you think is "fastest".`,
  mistakes: [
    'Using linkText for a <button> — it only matches <a> elements.',
    'Passing several classes or a leading dot to By.className.',
    'Using partialLinkText with a very short fragment that matches several links.',
  ],
  interview: [
    {
      q: 'What locator strategies does Selenium provide?',
      a: 'id, name, className, tagName, linkText, partialLinkText, cssSelector and xpath — plus Selenium 4 relative locators (RelativeLocator.with(...).above/below/near). I prefer id or data-testid, then name, then CSS, and XPath when I need text or axes.',
    },
    {
      q: 'linkText vs partialLinkText — when do you use each?',
      a: 'linkText when the full text is stable and is what the requirement mentions. partialLinkText when part of the text is dynamic, e.g. "Orders (3)" → partialLinkText("Orders"), making sure the fragment is unique on the page.',
    },
  ],
}
