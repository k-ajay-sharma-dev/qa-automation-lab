export default {
  id: 'loc-042',
  category: 'locators',
  kind: 'quiz',
  title: 'Beyond the document: shadow DOM, hidden menus and locator boundaries',
  level: 'EXPERT',
  tags: ['shadow-dom', 'getShadowRoot', 'hover', 'iframes', 'troubleshooting'],
  estMinutes: 12,
  scenario: `Release 3.2 replaced the coupon field on dynamic.html with a \`<coupon-widget>\` web component, and three coupon tests went red with
NoSuchElementException even though "the ids did not change". At the same time a hover-menu test fails with a different exception. As the
senior on the team you are asked to explain to the developers and juniors *where* a locator can and cannot reach.`,
  description: `Answer the questions about locating elements in shadow DOM and in hidden/hover UI on dynamic.html. The coupon widget attaches an
**open** shadow root that contains \`<input id="coupon-code">\` and \`<button id="apply-coupon">Apply</button>\`.`,
  hints: [
    'A shadow root is a separate DOM tree: document-level queries stop at its boundary.',
    'In Selenium 4, element.getShadowRoot() returns a SearchContext that supports CSS — not XPath.',
  ],
  questions: [
    {
      q: '`driver.findElement(By.id("coupon-code"))` throws NoSuchElementException, but DevTools Elements panel shows `<input id="coupon-code">`. Why?',
      options: [
        'The page needs an explicit wait',
        'The input lives inside the widget\'s shadow root; document-level CSS/XPath does not cross the shadow boundary',
        'Ids are not allowed on inputs in web components',
        'The widget is inside an iframe',
      ],
      answer: 1,
      why: 'The Elements panel shows the shadow tree under `#shadow-root (open)`, but `document.querySelector(\'#coupon-code\')` returns null — and so does Selenium. No wait will help; you must enter the shadow root first.',
    },
    {
      q: 'Which Selenium 4 code types into the coupon field?',
      options: [
        '`driver.findElement(By.cssSelector("coupon-widget #coupon-code")).sendKeys("SAVE10");`',
        '`driver.findElement(By.xpath("//coupon-widget//input")).sendKeys("SAVE10");`',
        '`SearchContext root = driver.findElement(By.id("coupon-widget")).getShadowRoot();\nroot.findElement(By.cssSelector("#coupon-code")).sendKeys("SAVE10");`',
        '`driver.switchTo().frame("coupon-widget"); driver.findElement(By.id("coupon-code")).sendKeys("SAVE10");`',
      ],
      answer: 2,
      why: 'Find the **host** element, call `getShadowRoot()`, then search inside it. The descendant CSS and XPath in A/B cannot pierce the boundary, and a shadow root is not a frame, so `switchTo().frame` fails.',
    },
    {
      q: 'Inside that shadow root you try `root.findElement(By.xpath(".//button"))`. What happens?',
      options: [
        'It works the same as CSS',
        'It fails (InvalidArgumentException / unsupported) — shadow-root search contexts support CSS selectors only, so use `By.cssSelector("#apply-coupon")`',
        'It returns the first button in the whole document',
        'It works only in Firefox',
      ],
      answer: 1,
      why: 'The WebDriver spec only defines CSS for shadow roots in practice (Chromium rejects XPath there). Keep shadow-DOM locators CSS-only — another reason not to standardise on XPath for everything.',
    },
    {
      q: 'Same test in Playwright: `await page.locator(\'#coupon-code\').fill(\'SAVE10\')`. Result?',
      options: [
        'Fails — Playwright needs `shadowRoot()` like Selenium',
        'Works — Playwright CSS and getBy* locators pierce **open** shadow roots automatically (XPath does not)',
        'Works only with `page.frameLocator()`',
        'Fails because of strict mode',
      ],
      answer: 1,
      why: 'Playwright\'s CSS engine and role/text/label locators pierce open shadow DOM by default; XPath locators do not. A closed shadow root is unreachable for both tools — that needs a test hook from the developers.',
    },
    {
      q: 'On the hover menu, `driver.findElement(By.xpath("//a[normalize-space()=\'Sign out\']")).click()` throws **ElementNotInteractableException** (not NoSuchElement). What does that tell you?',
      options: [
        'The XPath is wrong',
        'The element was found — the locator is fine — but it is hidden (`display:none` until hover); hover over #account-menu with Actions first, then wait for clickability',
        'The menu is inside a shadow root',
        'You need a longer implicit wait',
      ],
      answer: 1,
      why: 'Read the exception name: NoSuchElement = locator/timing problem; NotInteractable = state problem. The submenu items are always in the DOM, just invisible. Implicit waits only wait for presence, which is already satisfied.',
    },
  ],
  explanation: `**Where can a document-level locator reach?**

| Boundary | Selenium 4 | Playwright |
|---|---|---|
| iframe | \`switchTo().frame(...)\` | \`page.frameLocator(...)\` |
| open shadow root | \`host.getShadowRoot()\` + **CSS only** | pierced automatically (CSS / getBy*, not XPath) |
| closed shadow root | not reachable | not reachable |
| hidden element (hover menu) | found, but not interactable until revealed | found; actions auto-wait for visibility |

Troubleshooting order when a "correct" locator fails: (1) read the exception name — not found vs not interactable vs stale; (2) check in DevTools
whether the element is under \`#shadow-root\` or inside an \`<iframe>\`; (3) only then think about waits.`,
  mistakes: [
    'Adding waits or sleeps for an element that is inside a shadow root — no amount of waiting crosses the boundary.',
    'Using XPath inside getShadowRoot().',
    'Treating ElementNotInteractableException as a locator bug and rewriting a perfectly good locator.',
    'Confusing shadow DOM with iframes and calling switchTo().frame().',
  ],
  interview: [
    {
      q: 'How do you handle shadow DOM in Selenium 4?',
      a: 'Locate the host element, call getShadowRoot() to get a SearchContext, and find elements inside with CSS selectors. For nested components repeat the step per shadow root. Before Selenium 4 people used JavaScript (element.shadowRoot.querySelector), which still works as a fallback.',
    },
    {
      q: 'What is the difference between an open and a closed shadow root for testing?',
      a: 'An open root is exposed through element.shadowRoot, so Selenium (getShadowRoot) and Playwright can reach it. A closed root returns null to outside scripts and to automation tools; you need the developers to expose a test hook or use open mode in test builds.',
    },
    {
      q: 'Name three reasons a locator that is correct in DevTools fails in Selenium.',
      a: 'The element is inside an iframe (need switchTo), inside a shadow root (need getShadowRoot), or not there yet / re-rendered (need an explicit wait and fresh lookup). A fourth: it is found but hidden, so actions throw ElementNotInteractableException.',
    },
  ],
}
