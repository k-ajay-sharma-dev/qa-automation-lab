export default {
  id: 'loc-032',
  category: 'locators',
  kind: 'locator',
  title: 'Scope to the modal: the two action buttons of "Delete address?"',
  level: 'INTERMEDIATE',
  tags: ['scoping', 'modal', 'descendant', 'class-trap'],
  estMinutes: 8,
  scenario: `The account team built a "Delete address?" confirmation as an HTML modal (divs, not a browser alert). A test that should click
"Yes, delete" uses \`By.cssSelector(".btn-danger")\` — and it clicks the red **"Delete saved address"** button on the page again instead,
because that button comes first in the DOM. You want a page-object list of the modal's action buttons, scoped to the modal.`,
  description: `On **alerts.html**, write ONE locator that matches the **Cancel** and **Yes, delete** buttons in the modal footer — and nothing else.

**Rules**
- Must not match the page's "Delete saved address" button.
- Must not match the modal's × close button.
- Exactly 2 elements.`,
  hints: [
    'Try .btn-danger in DevTools: 2 matches — the page button and the modal button. Class alone is not enough.',
    'The modal is <div class="modal-overlay" id="confirm-modal">, and the action buttons live in <div class="modal-footer">.',
    'Scope with a descendant chain: start at #confirm-modal, go into .modal-footer, then button.',
  ],
  page: 'alerts.html',
  strategy: 'either',
  expected: '#confirm-modal .modal-footer button',
  expectedCount: 2,
  solution: `CSS:    #confirm-modal .modal-footer button
XPath:  //div[@id='confirm-modal']//div[@class='modal-footer']/button

Java (page object):
private final By modal = By.id("confirm-modal");
private final By modalActions = By.cssSelector("#confirm-modal .modal-footer button");
private final By confirmDelete = By.id("modal-confirm");

public void confirmDelete() {
    wait.until(ExpectedConditions.visibilityOfElementLocated(modal));
    driver.findElement(confirmDelete).click();
}`,
  explanation: `An HTML modal is just more page: its buttons share classes (\`btn\`, \`btn-danger\`) with buttons outside it. A class-only
locator matches both, and \`findElement\` silently returns the first in document order — the page button, which sits above the modal.

**Scoping** fixes it: \`#confirm-modal .modal-footer button\` reads "buttons inside the footer inside the confirm modal". The × button
lives in \`.modal-header\`, so it is excluded too. Each button also has its own id (\`modal-cancel\`, \`modal-confirm\`) — use those for single
clicks; the scoped list is useful when you assert "the dialog offers exactly Cancel and Yes, delete".

Remember: this modal is **not** a JavaScript alert — \`switchTo().alert()\` would throw NoAlertPresentException. You locate and click it like
any element, after waiting for it to become visible.`,
  mistakes: [
    'Using .btn-danger or .btn — matches buttons outside the modal and relies on DOM order.',
    'Using .modal button — also matches the × close button (3 elements).',
    'Calling driver.switchTo().alert() for an HTML modal.',
    'Clicking before the modal is visible — wait for #confirm-modal to be displayed first.',
  ],
  interview: [
    {
      q: 'How do you tell an HTML modal from a native JavaScript alert?',
      a: 'Inspect it: if DevTools can select it in the Elements panel, it is HTML and you use normal locators. A native alert/confirm/prompt blocks the page, cannot be inspected, and needs driver.switchTo().alert().',
    },
    {
      q: 'What is locator scoping and why is it useful?',
      a: 'Starting the locator from a unique container (a modal, a table row, a form) and searching only inside it. It prevents matches on look-alike elements elsewhere on the page. In Java you can also call container.findElement(...) on a WebElement.',
    },
  ],
}
