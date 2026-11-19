export default {
  id: 'sel-043',
  category: 'selenium',
  kind: 'quiz',
  title: 'Keyboard-only login: checking tab order with Keys.TAB and activeElement()',
  level: 'ADVANCED',
  tags: ['accessibility', 'Keys', 'activeElement', 'keyboard', 'login'],
  estMinutes: 10,
  scenario: `An accessibility audit before the ShopEasy public launch found that on another page, pressing Tab jumped from the email field straight to the footer. The product owner now wants an automated keyboard-only check of \`login.html\`: Username → Password → Remember me → Login, and Enter submits the form. You are pairing with a junior to design it.`,
  description: `Answer the questions about automating focus and tab order with Selenium. The relevant elements are \`#user-name\`, \`#password\`, the \`input[name=rememberMe]\` checkbox and \`#login-button\`.`,
  hints: [
    'driver.switchTo().activeElement() returns the element that currently has keyboard focus.',
    'WebElement.equals() compares the underlying element reference, so you can compare it with a findElement result.',
  ],
  questions: [
    {
      q: 'How do you find out which element has keyboard focus right now?',
      options: [
        'driver.findElement(By.cssSelector(":focus-visible")).isSelected()',
        'driver.switchTo().activeElement()',
        'driver.getWindowHandle()',
        'driver.findElement(By.id("user-name")).isEnabled()',
      ],
      answer: 1,
      why: '`switchTo().activeElement()` returns the focused element (document.activeElement), or the body if nothing is focused. isSelected/isEnabled say nothing about focus, and a window handle identifies a window, not an element.',
    },
    {
      q: `What is the correct way to assert the second step of the tab order?

\`\`\`java
driver.findElement(By.id("user-name")).click();
driver.switchTo().activeElement().sendKeys(Keys.TAB);
WebElement focused = driver.switchTo().activeElement();
\`\`\``,
      options: [
        'Assert.assertEquals(focused.getText(), "Password")',
        'Assert.assertEquals(focused, driver.findElement(By.id("password")))',
        'Assert.assertTrue(focused.isDisplayed())',
        'Assert.assertEquals(focused.getTagName(), "input")',
      ],
      answer: 1,
      why: 'Comparing WebElements with equals checks they are the same DOM element. getText() of an input is "", isDisplayed() is true for many elements, and tag name "input" would also match Username or the checkbox, so those assertions cannot catch a wrong order.',
    },
    {
      q: 'The junior sends Tab with `new Actions(driver).sendKeys(Keys.TAB).perform()` instead of sending it to an element. What is the difference?',
      options: [
        'There is none; both always target the Username field',
        'Actions.sendKeys(keys) types into whatever currently has focus, like a real keyboard; element.sendKeys first focuses (clicks into) that element',
        'Actions cannot send special keys like TAB',
        'element.sendKeys(Keys.TAB) is ignored by Chrome',
      ],
      answer: 1,
      why: 'Actions.sendKeys without an element sends key events to the focused element, which is exactly what a keyboard user does. element.sendKeys moves focus to that element first, which can hide a focus-order bug if you always target a specific element.',
    },
    {
      q: 'Focus is on the "Remember me" checkbox. The user presses Space, then Tab, then Enter. What should the test assert?',
      options: [
        'Nothing — Space does nothing on checkboxes',
        'The checkbox isSelected() is true, focus is on #login-button, and after Enter the URL contains inventory.html (with valid credentials typed earlier)',
        'The checkbox getText() is "Remember me"',
        'An alert appears',
      ],
      answer: 1,
      why: 'Space toggles a focused checkbox, Tab moves to the Login button, and Enter on a submit button submits the form. Asserting each effect proves the whole flow works without a mouse; the redirect check needs an explicit wait such as urlContains.',
    },
    {
      q: 'A tab-order test passes locally but fails on Selenium Grid: focus starts on the browser address bar. Most likely fix?',
      options: [
        'Add Thread.sleep(2000) before pressing Tab',
        'Set a known starting point: click (or focus via JS) #user-name first, then walk the order with TAB from there',
        'Use Keys.SHIFT instead of Keys.TAB',
        'Run the test headed only',
      ],
      answer: 1,
      why: 'Initial focus depends on the browser and window state. A deterministic starting focus makes the test independent of where the browser placed the caret. Sleeping does not change focus.',
    },
  ],
  explanation: `A keyboard-only check is: **set a known starting focus → press TAB → assert \`switchTo().activeElement()\` equals the expected element**, step by step, then exercise Space/Enter on the focused controls. Driving keys through \`Actions.sendKeys\` (no target) mimics a real keyboard; \`element.sendKeys\` moves focus first and can mask the bug you are looking for.

Keep the expected order as data (a \`List<By>\`) and loop over it, so the test documents the order the accessibility team agreed on. Hidden elements (like the \`#login-error\` banner while it is hidden) are not focusable, so they must not appear in the list.`,
  mistakes: [
    'Asserting the focused element by tag name or getText(), which cannot distinguish two inputs.',
    'Sending TAB with element.sendKeys on the expected next element — that moves focus there and the test passes even if the real order is broken.',
    'Not setting a starting focus, so the test depends on the browser placing focus in the page.',
    'Treating keyboard tests as "nice to have" — keyboard reachability is a WCAG 2.1 Level A requirement.',
  ],
  interview: [
    { q: 'How do you test Shift+Tab (reverse order)?', a: 'new Actions(driver).keyDown(Keys.SHIFT).sendKeys(Keys.TAB).keyUp(Keys.SHIFT).perform(), then assert activeElement equals the previous element. Always release the modifier with keyUp.' },
    { q: 'What can automated focus checks NOT tell you?', a: 'Whether the focus indicator is actually visible and whether the order makes sense to a human. Pair them with a manual check or a visual/axe-core audit.' },
    { q: 'Where would this test live in a POM framework?', a: 'The page object exposes the expected focus order (a List<By>) and maybe a pressTab() helper; the test walks the list and asserts. That keeps the order next to the locators that define it.' },
  ],
}
