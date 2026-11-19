export default {
  id: 'loc-039',
  category: 'locators',
  kind: 'locator',
  title: 'Hover menu: the hidden "Sign out" item',
  level: 'INTERMEDIATE',
  tags: ['css', 'xpath', 'hover', 'role', 'actions'],
  estMinutes: 8,
  scenario: `Story SE-77: "A signed-in user can sign out from the **My account** menu." On dynamic.html the menu items only appear while the
mouse is over "My account" — but they are **always in the DOM**, just hidden with CSS. The automation needs a locator for "Sign out" that
does not depend on the menu order (product wants to add "Settings" above it next sprint).`,
  description: `On **dynamic.html**, write a locator that matches **only the "Sign out" menu item** inside the My account menu.

**Rules**
- Scope it to the account menu (\`#account-menu\`) — "Sign out" may appear elsewhere one day.
- Do not use a position (\`:nth-of-type(4)\`, \`[4]\`, \`last()\`).
- Hint: CSS cannot match text, so XPath is the natural choice here. It must match exactly 1 element.`,
  hints: [
    'The items are <a role="menuitem"> inside div.submenu inside #account-menu. None of them has an id.',
    'The only thing that tells "Sign out" apart is its text → XPath.',
    '//div[@id=\'account-menu\']//a[@role=\'menuitem\' and normalize-space()=\'Sign out\']',
  ],
  page: 'dynamic.html',
  strategy: 'either',
  expected: '#account-menu .submenu a:nth-of-type(4)',
  expectedCount: 1,
  solution: `XPath:  //div[@id='account-menu']//a[@role='menuitem' and normalize-space()='Sign out']

Java (hover first, then click — the locator finds it either way, but only a visible element is clickable):
WebElement menu = driver.findElement(By.id("account-menu"));
new Actions(driver).moveToElement(menu).perform();
By signOut = By.xpath("//div[@id='account-menu']//a[@role='menuitem' and normalize-space()='Sign out']");
new WebDriverWait(driver, Duration.ofSeconds(5))
    .until(ExpectedConditions.elementToBeClickable(signOut))
    .click();`,
  explanation: `A **locator** and **interactability** are two different questions. The submenu is \`display: none\` until hover, but the four
\`<a>\` elements are in the DOM from page load, so the XPath finds "Sign out" immediately. What fails without the hover is the *click*:
Selenium throws \`ElementNotInteractableException\` for an invisible element.

The locator itself: scope to the unique container \`#account-menu\`, filter by \`role='menuitem'\` (the accessible role says *what* it is),
and identify the item by its visible text. That survives "Settings" being inserted above it; \`:nth-of-type(4)\` would then click Settings.`,
  mistakes: [
    'Using the position (a[4] / :last-child) — the next menu item added silently changes the target.',
    'Thinking "the locator does not work" because DevTools shows the element greyed out — it is found, just not visible yet.',
    'Calling click() without hovering first → ElementNotInteractableException.',
    'Using a JavaScript click to skip the hover — the test no longer proves a user can reach the menu.',
  ],
  interview: [
    {
      q: 'What is the difference between NoSuchElementException and ElementNotInteractableException?',
      a: 'NoSuchElement means the locator matched nothing in the DOM. ElementNotInteractable means it was found but cannot be used right now — usually hidden, zero size, or disabled. The fix for the first is the locator or a wait for presence; for the second it is the user action that reveals it (hover, scroll, open a panel) plus a wait for clickability.',
    },
    {
      q: 'How do you perform a hover in Selenium 4 and in Playwright?',
      a: 'Selenium: new Actions(driver).moveToElement(element).perform(). Playwright: await page.locator(\'#account-menu\').hover(), then click the item — Playwright auto-waits for it to become visible before clicking.',
    },
  ],
}
