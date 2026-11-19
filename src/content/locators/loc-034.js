export default {
  id: 'loc-034',
  category: 'locators',
  kind: 'quiz',
  title: 'Locator review: pick the most robust option out of four',
  level: 'BEGINNER',
  tags: ['locator-strategy', 'code-review', 'data-testid', 'robustness'],
  estMinutes: 8,
  scenario: `You have been asked to review a junior colleague's first pull request for the ShopEasy suite. For several elements they
pasted four candidate locators "from different tools" (Chrome "Copy XPath", a recorder, SelectorsHub, and their own) and asked you which
one to keep. Your answer becomes the team's locator rule, so be ready to explain *why*.`,
  description: `For each element, choose the locator you would approve in code review. Think about: is it unique, does it describe *what the
element is* (not where it is or how it looks), and will it survive a redesign?`,
  hints: [
    'Priority order most teams use: data-testid / id → name → a short scoped CSS → XPath with text or axes → never absolute paths or pure indexes.',
    'Ask "what change in the UI would break this?" for each option.',
  ],
  questions: [
    {
      q: 'The **Login** button on login.html: `<button type="submit" id="login-button" class="btn btn-primary btn-block" data-testid="login-button">Login</button>`',
      options: [
        '`/html/body/main/div/div/form/button`',
        '`[data-testid=\'login-button\']`',
        '`.btn.btn-primary`',
        '`//button[3]`',
      ],
      answer: 1,
      why: 'The test id exists purely for automation and states the element\'s purpose, so restyling or moving the button does not break it (`#login-button` would be equally fine). The absolute path breaks when any wrapper div is added, `.btn.btn-primary` describes looks and is shared by many buttons, and `//button[3]` depends on how many buttons come before it.',
    },
    {
      q: 'The **Add to cart** button of the Trailblazer Backpack on inventory.html:\n```html\n<button class="btn btn-primary btn-inventory" id="add-to-cart-trailblazer-backpack"\n        data-testid="add-to-cart-trailblazer-backpack" data-slug="trailblazer-backpack">Add to cart</button>\n```',
      options: [
        '`(//button[text()=\'Add to cart\'])[1]`',
        '`.inventory-item:first-child .btn-inventory`',
        '`#add-to-cart-trailblazer-backpack`',
        '`//div[@id=\'inventory-list\']/div[1]/div[2]/div[2]/button`',
      ],
      answer: 2,
      why: 'The id names the product, so it keeps working when the list is sorted by price or a new product is added at the top. The other three all depend on position ("the first product card / the first such button") — the moment the user sorts Z→A, they click the wrong product\'s button and the test fails far away (or worse, passes with the wrong item).',
    },
    {
      q: 'The **Edit** button for Priya Sharma on table.html. Rows are rendered by JavaScript: `<tr><td>Priya Sharma</td>…<td><button class="btn btn-sm btn-edit" data-emp-id="3">Edit</button></td></tr>`. Which locator best expresses the test\'s intent "edit Priya"?',
      options: [
        '`//td[text()=\'Priya Sharma\']/parent::tr//button[text()=\'Edit\']`',
        '`#employee-table tbody tr:nth-child(3) .btn-edit`',
        '`.btn-edit`',
        '`//table/tbody/tr[3]/td[5]/button`',
      ],
      answer: 0,
      why: 'Anchor on the business data the test cares about (the name), then walk to the button in the same row. It survives sorting, searching and paging changes. Row 3 is Priya only on page 1 with no sorting; `.btn-edit` matches all 5 visible Edit buttons. (`[data-emp-id=\'3\']` is also stable, but ties the test to a database id the reader cannot see — fine if the test created that record itself.)',
    },
    {
      q: 'The **Continue** button on checkout.html. A recorder produced `By.className("btn-primary")` and the test passes. What is your review comment?',
      options: [
        'Approve — it passes, so it is correct',
        'Change to `By.className("btn btn-primary")` to be more specific',
        'Change to `By.id("continue")`: `.btn-primary` matches Continue, Finish and Back Home (all three checkout steps are in the DOM), so it only works because Continue happens to be first',
        'Change to `By.xpath("//button")`',
      ],
      answer: 2,
      why: 'A passing test does not prove a unique locator — findElement silently returns the first match. Check counts in DevTools with `$$(".btn-primary")`. `By.className` accepts a single class name only (a space throws InvalidSelectorException in Selenium 4), and `//button` is even less specific.',
    },
  ],
  explanation: `**A quick review checklist for any locator:**
1. **Unique?** Check in DevTools: \`$$("css")\` or \`$x("xpath")\` must return exactly the element(s) you mean.
2. **Describes identity, not position or style?** Ids, test ids, names, labels and visible business text describe *what*; indexes, absolute
   paths and styling classes describe *where* or *how it looks*.
3. **Survives the likely change?** Sorting, paging, a new banner, a redesign, a translated label.
4. **Readable?** A reviewer should know which element it is without opening the page.

Typical priority: \`data-testid\` / stable \`id\` → \`name\` → short scoped CSS → XPath with text/axes for "the X in the row/card of Y" → never
absolute paths or bare indexes. If a good attribute is missing, ask the developers to add a \`data-testid\` — it is a five-minute change that
saves hours of maintenance.`,
  mistakes: [
    'Keeping a locator because "the test passed" without checking how many elements it matches.',
    'Trusting "Copy full XPath" from DevTools — it produces absolute, position-based paths.',
    'Using row or card indexes for data that can be sorted, filtered or paged.',
  ],
  interview: [
    {
      q: 'What is your locator priority order and why?',
      a: 'data-testid or a stable id first, then name, then short CSS scoped to a unique container, then XPath when I need text or axes. Absolute paths and indexes last or never. The idea is to rely on attributes that describe what the element is, because those change least during redesigns.',
    },
    {
      q: 'The developers do not add test ids. What do you do?',
      a: 'Raise it as a testability requirement — show a flaky locator and how a data-testid fixes it, and offer to add them myself in a small PR. Meanwhile use labels, names, visible text and scoping to a unique container rather than positions.',
    },
  ],
}
