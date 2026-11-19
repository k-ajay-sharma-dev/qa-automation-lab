export default {
  slug: 'pw-locators-and-actions',
  category: 'playwright',
  order: 3,
  title: 'Locators and actions: getByRole, getByLabel, chaining and filter',
  minutes: 10,
  summary: 'Find elements the way users do (role, label, text, test id), narrow them with chaining and filter, and drive forms with fill, check, selectOption and setInputFiles.',
  manualAnalogy: `When you write a manual step you never say "click the third div in the second form". You say "click the **Continue** button" or "enter the postcode in **Zip/Postal Code**". Playwright's user-facing locators let your automation say exactly that — so the test breaks only when the user experience changes, not when a developer adds a wrapper div.`,
  body: `## What a locator is

\`\`\`ts
const continueBtn = page.getByRole('button', { name: 'Continue' });
\`\`\`

A **Locator** is a *recipe* for finding elements, not the element itself. Creating it does not touch the browser (no \`await\`). Every time you act on it — \`click()\`, \`fill()\`, \`expect(...)\` — Playwright finds the element fresh. Consequences:

- No \`StaleElementReferenceException\`: a re-rendered element is simply found again.
- You can create locators up front (e.g. in a page object constructor) and reuse them.
- Locators are **strict**: an action on a locator that matches 2+ elements throws a *strict mode violation* instead of silently using the first.

## The built-in locators, in order of preference

| Locator | Finds by | ShopEasy example (checkout.html) |
|---|---|---|
| \`getByRole(role, { name })\` | ARIA role + accessible name | \`getByRole('button', { name: 'Continue' })\` |
| \`getByLabel(text)\` | the \`<label>\` (or aria-label) of a form field | \`getByLabel('Zip/Postal Code')\` |
| \`getByPlaceholder(text)\` | placeholder | \`getByPlaceholder('First Name')\` |
| \`getByText(text)\` | visible text | \`getByText('Thank you for your order!')\` |
| \`getByTestId(id)\` | \`data-testid\` attribute | \`getByTestId('total-label')\` |
| \`locator(css or xpath)\` | anything | \`locator('#summary-total')\` — last resort |

Common roles: \`button\`, \`link\`, \`textbox\`, \`checkbox\`, \`radio\`, \`combobox\` (select), \`heading\`, \`row\`, \`cell\`, \`alert\`, \`dialog\`. The **accessible name** is usually the visible text, or the \`aria-label\` (e.g. ShopEasy's cart icon link has \`aria-label="Cart"\` → \`getByRole('link', { name: 'Cart' })\`).

Text matching: a string is a case-insensitive **substring**; add \`{ exact: true }\` for a whole, case-sensitive match, or pass a RegExp (\`/^Save$/\`). On \`dynamic.html\` the toolbar has *Save*, *Save draft* and *Save & close* — \`getByRole('button', { name: 'Save' })\` matches all three, \`{ name: 'Save', exact: true }\` matches one.

Why this order? Roles and labels are what users and screen readers rely on, so they rarely change for technical reasons — and if \`getByLabel\` cannot find a field, you have also found an accessibility bug. \`data-testid\` is a stable contract with developers but invisible to users. CSS/XPath tied to structure (\`div > div:nth-child(2)\`) breaks first.

## Chaining: search inside something

\`\`\`ts
const summary = page.getByTestId('checkout-step-two');
await expect(summary.getByRole('button', { name: 'Finish' })).toBeVisible();
\`\`\`

Calling a locator method **on another locator** scopes the search to inside it — like \`row.findElement(By.xpath(".//button"))\` in Selenium, but readable.

## filter: pick one item from a list

Lists of identical cards or rows are everywhere. \`filter\` keeps only matching elements:

\`\`\`ts
// dynamic.html: four orders, each with its own "Track" button
const order = page.locator('#order-list li').filter({ hasText: 'ORD-1043' });
await order.getByRole('button', { name: 'Track' }).click();
\`\`\`

- \`filter({ hasText: 'ORD-1043' })\` — keeps items whose text contains the value (or matches a RegExp).
- \`filter({ has: page.getByText('Shipped') })\` — keeps items that **contain** a matching element.
- \`hasNot\` / \`hasNotText\` — the opposite.

Choose items by **business data** (order id, product name, employee name), not by position. \`.nth(2)\` or \`.first()\` silently pick something else after a re-sort; use them only when order is what you are testing.

## Tables are lists of rows

\`\`\`ts
const rows = page.getByRole('row').filter({ hasText: 'Finance' });   // table.html
await expect(rows).toHaveCount(1);              // page 1 shows 5 rows: only James Wilson is in Finance
const names = await page.locator('#employee-table tbody td:first-child').allTextContents();
\`\`\`

\`allTextContents()\` returns a \`string[]\` — handy for sort checks (compare with a sorted copy).

## Actions

| Action | Use for |
|---|---|
| \`fill(text)\` | text inputs (clears first). \`type()\` is deprecated; \`pressSequentially()\` exists for key-by-key typing |
| \`click()\`, \`dblclick()\`, \`hover()\` | mouse |
| \`press('Enter')\` | keyboard on an element |
| \`check()\` / \`uncheck()\` / \`setChecked(bool)\` | checkboxes and radios — idempotent, and verified afterwards |
| \`selectOption('IN')\` / \`selectOption({ label: 'India' })\` / \`selectOption(['web', 'social'])\` | \`<select>\`, single or multiple |
| \`setInputFiles(path \\| paths \\| { name, mimeType, buffer })\` | \`<input type="file">\` — no OS dialog involved |
| \`dragTo(target)\` | drag and drop |

All of them **auto-wait** for the element to be actionable (next lesson). Example on \`form.html\`:

\`\`\`ts
await page.getByLabel('Mobile').fill('07700 900123');
await page.getByLabel('Outdoor gear').check();
await page.getByLabel('Sales channels').selectOption(['web', 'marketplace']);
\`\`\`

## Mouse and keyboard without an Actions class

Selenium needs \`new Actions(driver)\` for hovering, dragging and key presses. In Playwright these are methods on the locator, so they
auto-wait and scroll into view like every other action:

\`\`\`ts
// dynamic.html — the submenu only exists for the user while the mouse is over "My account"
await page.getByRole('button', { name: 'My account' }).hover();
await expect(page.getByRole('menuitem', { name: 'Wishlist' })).toBeVisible();

await page.locator('#draggable').dragTo(page.locator('#droppable'));   // press, move, release

await page.getByLabel('Zip/Postal Code').press('Enter');              // checkout.html: submits the form
\`\`\`

\`page.mouse\` and \`page.keyboard\` exist for raw input (a canvas, a slider moved by pixels), but coordinates depend on screen size —
prefer the locator methods.

## Harder pages: generated ids, exact matches and shadow DOM

- **Generated ids** (\`btn-8f3a2\` today, \`btn-c71d0\` tomorrow): ignore them. Role + name, label or text are stable.
- **Substring traps**: text matching is a substring by default, and *Inactive* contains *Active*. When a condition must be the whole
  text, put an exact locator inside \`has\`:

\`\`\`ts
const viewers = page.locator('.user-card').filter({ has: page.getByText('Viewer', { exact: true }) });
\`\`\`

  The locator inside \`has\` is searched **inside each card**. Chain several \`filter\` calls to combine conditions (AND).
- **Shadow DOM**: web components hide their inner elements in a *shadow root*. Selenium needs \`getShadowRoot()\`; Playwright's CSS, role,
  label and text locators **pierce open shadow roots automatically** — write the locator as if the shadow DOM were not there. Only XPath
  does not pierce, and closed shadow roots cannot be automated at all.

## Finding a good locator fast

Run \`npx playwright codegen <url>\` or open UI mode and use **Pick locator**: hover an element and Playwright shows the locator it recommends.`,
  keyPoints: [
    'A Locator is a lazy recipe; it is re-resolved on every action, so it never goes stale.',
    'Prefer getByRole → getByLabel → getByPlaceholder/getByText → getByTestId → CSS/XPath.',
    'Locators are strict: 2+ matches on an action is an error — refine instead of using .first().',
    'Chain locators to search inside a container; filter({ hasText / has }) to pick an item from a list by business data.',
    'Use the right action: fill, check, selectOption, setInputFiles — not click-and-type tricks.',
    'hover(), dragTo() and press() replace Selenium Actions; locators pierce open shadow roots without extra code.',
  ],
  mistakes: [
    'getByText for buttons and links — it also matches labels and paragraphs; getByRole is precise.',
    'Silencing strict mode with .first() — you may click the wrong item and still pass.',
    'Clicking a file input to upload — use setInputFiles; the OS dialog cannot be automated.',
    'Copying absolute XPaths from DevTools into tests.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/dynamic.html\` open DevTools → Elements → Accessibility pane and select the *Place order* button: note its role and name. Which getByRole call would match it uniquely? Then try the three "Save…" buttons — how do you match only *Save*?`,
  problems: ['pw-005', 'pw-006', 'pw-012', 'pw-023', 'pw-025'],
}
