export default {
  id: 'loc-040',
  category: 'locators',
  kind: 'quiz',
  title: 'From Selenium By to Playwright getByRole / getByLabel / getByTestId',
  level: 'INTERMEDIATE',
  tags: ['playwright', 'getByRole', 'getByLabel', 'getByTestId', 'accessibility'],
  estMinutes: 9,
  scenario: `The team is piloting Playwright + TypeScript next to the existing Selenium suite. Your task: port five ShopEasy locators. The
Playwright docs recommend *user-facing* locators (role, label, text) first and CSS/XPath last — and the reviewer will reject a straight
copy-paste of every \`By.cssSelector\` into \`page.locator(...)\`.`,
  description: `For each Selenium locator, pick the Playwright locator a reviewer would approve.`,
  hints: [
    'Playwright priority: getByRole → getByLabel / getByPlaceholder → getByText → getByTestId → locator(css/xpath).',
    'getByRole uses the accessible role + accessible name (what a screen reader announces).',
  ],
  questions: [
    {
      q: 'login.html: `By.id("login-button")` for `<button type="submit" id="login-button" data-testid="login-button">Login</button>`.',
      options: [
        '`page.locator(\'//button\')`',
        '`page.getByRole(\'button\', { name: \'Login\' })`',
        '`page.getByText(\'Login\')`',
        '`page.locator(\'button\').nth(0)`',
      ],
      answer: 1,
      why: 'Role + accessible name is how a user (and a screen reader) finds the button. `getByText(\'Login\')` would also match the "Login" nav link in the header — Playwright throws a strict-mode violation when a locator matches more than one element for an action. `getByTestId(\'login-button\')` would also be acceptable.',
    },
    {
      q: 'form.html: the "Outdoor gear" checkbox — `<label><input type="checkbox" name="categories" value="outdoor"> Outdoor gear</label>`.',
      options: [
        '`page.getByLabel(\'Outdoor gear\')` (or `getByRole(\'checkbox\', { name: \'Outdoor gear\' })`)',
        '`page.getByText(\'Outdoor gear\').check()` on the label text node',
        '`page.locator(\'input\').nth(5)`',
        '`page.getByTestId(\'Outdoor gear\')`',
      ],
      answer: 0,
      why: 'A wrapping `<label>` gives the input its accessible name, so getByLabel / getByRole(\'checkbox\') find the input itself and `.check()` works. getByTestId reads `data-testid`, which this input does not have; an index breaks on reordering.',
    },
    {
      q: 'inventory.html: `By.cssSelector("[data-testid=\'add-to-cart-trailblazer-backpack\']")`.',
      options: [
        '`page.getByRole(\'button\', { name: \'Add to cart\' })`',
        '`page.getByTestId(\'add-to-cart-trailblazer-backpack\')`',
        '`page.getByText(\'Add to cart\').first()`',
        '`page.locator(\'.btn-inventory\')`',
      ],
      answer: 1,
      why: 'All six product buttons have the same name "Add to cart", so role/text alone is ambiguous (and `.first()` hides the ambiguity). getByTestId reads `data-testid` by default. The other good option is scoping: filter the product card by its name, then getByRole(\'button\') inside it.',
    },
    {
      q: 'Playwright says: **"strict mode violation: getByRole(\'button\', { name: \'Edit\' }) resolved to 5 elements"** on table.html. What is the best fix?',
      options: [
        'Add `.first()` so the error goes away',
        'Switch to `page.locator(\'.btn-edit\')`',
        'Scope to the row: `page.getByRole(\'row\').filter({ hasText: \'Priya Sharma\' }).getByRole(\'button\', { name: \'Edit\' })`',
        'Add `{ exact: true }`',
      ],
      answer: 2,
      why: 'Strictness is a feature: it tells you the locator does not describe ONE thing. Filtering the row by business data expresses the intent "edit Priya". `.first()` silences it and edits whoever is on top after sorting; `exact` only changes text matching, all five are exactly "Edit".',
    },
    {
      q: 'What is the key behavioural difference between a Selenium `WebElement` and a Playwright `Locator`?',
      options: [
        'There is none, both are found once and cached',
        'A Locator is lazy: it is resolved again on every action and auto-waits for the element to be visible, enabled and stable',
        'A Locator can only use CSS',
        'A WebElement auto-waits, a Locator does not',
      ],
      answer: 1,
      why: 'findElement resolves immediately and returns a reference to one DOM node (which can go stale). A Playwright Locator is just a description; each click/fill re-queries the DOM and applies actionability checks, which removes most explicit waits and stale-element errors.',
    },
  ],
  explanation: `Playwright pushes you towards locators that describe the page **the way a user experiences it**:

| Selenium habit | Playwright preferred |
|---|---|
| \`By.id("login-button")\` | \`getByRole('button', { name: 'Login' })\` |
| \`input[name='x']\` next to a label | \`getByLabel('Label text')\` |
| \`[data-testid='x']\` | \`getByTestId('x')\` |
| row XPath with text | \`getByRole('row').filter({ hasText: '…' })\` |

A bonus: if \`getByRole\` cannot find your button, a screen-reader user probably cannot either — your locator doubles as an accessibility check.
Keep \`page.locator('css')\` for cases with no meaningful role/label.`,
  mistakes: [
    'Copying every CSS selector into page.locator() and missing the user-facing locators.',
    'Fixing strict-mode violations with .first() / .nth() instead of scoping.',
    'Using getByText for buttons when a nav link or heading has the same text.',
  ],
  interview: [
    {
      q: 'What is strict mode in Playwright locators?',
      a: 'Actions on a locator that matches more than one element throw an error instead of silently using the first. It forces you to write locators that identify exactly one element, preventing "clicked the wrong item" bugs.',
    },
    {
      q: 'Why does Playwright recommend getByRole over CSS selectors?',
      a: 'Roles and accessible names are what users and assistive technologies rely on, so they change less than classes or DOM structure, and they double as a light accessibility check.',
    },
  ],
}
