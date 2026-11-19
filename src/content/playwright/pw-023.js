export default {
  id: 'pw-023',
  category: 'playwright',
  kind: 'code',
  language: 'typescript',
  title: 'Hover menus, drag and drop and the keyboard without an Actions class',
  level: 'BEGINNER',
  tags: ['hover', 'dragTo', 'keyboard', 'actions'],
  estMinutes: 15,
  scenario: `The Selenium framework has an \`ActionsUtils\` class: \`moveToElement\` for the *My account* menu, \`dragAndDrop\` for the wishlist,
\`sendKeys(Keys.ENTER)\` for "log in with the keyboard". The first Playwright port copied the idea with \`page.mouse.move(640, 410)\` and
hard-coded coordinates — it broke the first time someone ran it on a laptop with a smaller screen. Playwright has element-level
methods for all three.`,
  description: `Write three tests (baseURL is \`http://localhost:5180/practice-site/\`).

1. **Hover menu** — on \`dynamic.html\` hover the *My account* button, click the menu item **Orders** (role \`menuitem\`), and expect the
   "Last action" text (\`data-testid="dynamic-result"\`) to be \`Menu: Orders\`.
2. **Drag and drop** — on \`dynamic.html\` drag the backpack (\`aria-label="Draggable product"\`) onto the box *Drop here to add to wishlist*
   with \`dragTo\`, then expect the box to read \`Dropped! Backpack added to wishlist\`.
3. **Keyboard** — on \`login.html\` fill \`standard_user\` / \`secret_sauce\` and submit by pressing **Enter** in the password field
   (no click on Login); expect the URL to match \`/inventory\\.html/\`.

**Rules**: no \`page.mouse\` coordinates, no \`waitForTimeout\`.`,
  starterCode: `import { test, expect } from '@playwright/test';

test('account menu opens on hover', async ({ page }) => {
  await page.goto('dynamic.html');
  await page.mouse.move(640, 410); // where "My account" was on my screen
  await page.waitForTimeout(500);
  await page.locator('#account-menu a').nth(1).click();
});

test('backpack can be dragged to the wishlist', async ({ page }) => {
  await page.goto('dynamic.html');
  await page.mouse.move(300, 900);
  await page.mouse.down();
  await page.mouse.move(600, 900);
  await page.mouse.up();
});

// TODO: log in with the Enter key
`,
  solution: `import { test, expect } from '@playwright/test';

test('account menu opens on hover', async ({ page }) => {
  await page.goto('dynamic.html');

  await page.getByRole('button', { name: 'My account' }).hover();
  await page.getByRole('menuitem', { name: 'Orders' }).click();

  await expect(page.getByTestId('dynamic-result')).toHaveText('Menu: Orders');
});

test('backpack can be dragged to the wishlist', async ({ page }) => {
  await page.goto('dynamic.html');
  const wishlist = page.getByText('Drop here to add to wishlist');

  await page.getByLabel('Draggable product').dragTo(wishlist);

  await expect(page.locator('#droppable')).toHaveText('Dropped! Backpack added to wishlist');
});

test('shopper can log in with the Enter key', async ({ page }) => {
  await page.goto('login.html');
  await page.getByLabel('Username').fill('standard_user');
  await page.getByLabel('Password').fill('secret_sauce');

  await page.getByLabel('Password').press('Enter');

  await expect(page).toHaveURL(/inventory\\.html/);
});
`,
  checks: [
    { label: 'Menu opened with hover()', pattern: '\\.hover\\(', hint: "await page.getByRole('button', { name: 'My account' }).hover();" },
    { label: 'Menu item found by role', pattern: "getByRole\\(\\s*['\"]menuitem['\"]\\s*,\\s*\\{\\s*name\\s*:\\s*['\"]Orders", hint: "page.getByRole('menuitem', { name: 'Orders' })" },
    { label: 'Drag with dragTo', pattern: '\\.dragTo\\(', hint: "await page.getByLabel('Draggable product').dragTo(wishlist);" },
    { label: 'Drop result asserted', pattern: "toHaveText\\(\\s*['\"]Dropped! Backpack added to wishlist['\"]", hint: "await expect(page.locator('#droppable')).toHaveText('Dropped! Backpack added to wishlist');" },
    { label: 'Form submitted with press("Enter")', pattern: "\\.press\\(\\s*['\"]Enter['\"]\\s*\\)", hint: "await page.getByLabel('Password').press('Enter');" },
    { label: 'No raw mouse coordinates or fixed waits', pattern: '(page\\.mouse\\.|waitForTimeout)', mustNot: true, hint: 'Element methods (hover, dragTo, press) find the element wherever it is on screen.' },
  ],
  hints: [
    'locator.hover() moves the mouse to the middle of the element after the usual actionability checks — the CSS :hover menu opens.',
    'source.dragTo(target) presses the mouse on the source, moves to the target and releases — no coordinates needed.',
    "locator.press('Enter') focuses the element and presses the key, exactly like a keyboard user.",
  ],
  explanation: `Selenium's \`Actions\` class builds a chain of low-level mouse and keyboard events. Playwright puts the common gestures on the
**locator** itself:

| Selenium | Playwright |
|---|---|
| \`new Actions(driver).moveToElement(el).perform()\` | \`await locator.hover()\` |
| \`new Actions(driver).dragAndDrop(src, dst).perform()\` | \`await src.dragTo(dst)\` |
| \`el.sendKeys(Keys.ENTER)\` | \`await locator.press('Enter')\` |
| \`new Actions(driver).keyDown(Keys.SHIFT)…\` | \`await page.keyboard.press('Shift+Tab')\` |

Because they are locator methods, they auto-wait and scroll the element into view, so screen size does not matter. The submenu items
are \`display: none\` until hovered, so \`getByRole('menuitem')\` only finds them after the hover — moving to the menu item stays inside
the hover area, which keeps the menu open while Playwright clicks.

\`page.mouse\` and \`page.keyboard\` still exist for the rare cases that need raw input (drawing on a canvas, a slider dragged by
a number of pixels), but they should not be your first choice.`,
  mistakes: [
    'Hard-coding mouse coordinates — they depend on viewport, fonts and scroll position.',
    'Clicking the hidden menu item without hovering first — Playwright waits for it to become visible and times out.',
    'Pressing Enter on page.keyboard without focusing the right field first — use locator.press so the focus is explicit.',
    'Using force: true to click a hidden element — the user cannot do that, so the test proves nothing.',
  ],
  interview: [
    { q: 'How do you perform drag and drop in Playwright?', a: 'source.dragTo(target) for the common case. For custom widgets that need intermediate moves, use page.mouse: hover the source, mouse.down(), move in steps over the target, mouse.up().' },
    { q: 'How do you test a menu that only appears on hover?', a: 'Hover the trigger with locator.hover(), then interact with the item by role; assert visibility with toBeVisible if the menu itself is under test.' },
    { q: 'locator.press vs page.keyboard.press?', a: 'locator.press focuses that element first and then sends the key; page.keyboard.press sends the key to whatever currently has focus. Prefer locator.press so the target is explicit.' },
  ],
}
