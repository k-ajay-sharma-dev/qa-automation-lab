export default {
  id: 'pom-017',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'A modal is a component: the "Delete address?" dialog',
  level: 'BEGINNER',
  tags: ['pom', 'components', 'modal', 'waits'],
  estMinutes: 15,
  scenario: `The ShopEasy account area is getting a *"Delete saved address"* button that opens a confirmation dialog. The
dev team built a prototype on \`alerts.html\`. A colleague's draft test calls \`driver.switchTo().alert().accept()\`
and fails with \`NoAlertPresentException\` — because this dialog is **not** a browser alert, it is ordinary HTML
(\`#confirm-modal\`). The same dialog will appear on three account screens, so it deserves its own component.`,
  description: `Write \`DeleteAddressModal\` (a component) and the small \`AddressBookPage\` that opens it.

**Rules**
- \`DeleteAddressModal extends BasePage\` with private locators: \`#confirm-modal\`, \`#modal-title\`, \`#modal-confirm\`, \`#modal-cancel\`.
- \`getTitle()\` returns the dialog title text.
- \`confirm()\` and \`cancel()\` click the button, **wait until the modal is hidden**, and return \`AddressBookPage\`.
- \`AddressBookPage.openDeleteDialog()\` clicks \`#open-modal-btn\` and returns the modal; \`getResultText()\` reads \`#modal-result\`.
- Do not use \`switchTo().alert()\` — it is an HTML modal. No \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class AddressBookPage extends BasePage {
    private final By deleteButton = By.id("open-modal-btn");
    private final By result = By.id("modal-result");

    public AddressBookPage(WebDriver driver) { super(driver); }

    public void deleteAddress() {
        click(deleteButton);
        driver.switchTo().alert().accept();   // NoAlertPresentException!
    }
}

class DeleteAddressModal {
    // TODO
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class AddressBookPage extends BasePage {
    private final By deleteButton = By.id("open-modal-btn");
    private final By result = By.id("modal-result");

    public AddressBookPage(WebDriver driver) { super(driver); }

    public DeleteAddressModal openDeleteDialog() {
        click(deleteButton);
        return new DeleteAddressModal(driver);
    }

    public String getResultText() {
        return getText(result);
    }
}

class DeleteAddressModal extends BasePage {
    private final By modal         = By.id("confirm-modal");
    private final By title         = By.id("modal-title");
    private final By confirmButton = By.id("modal-confirm");
    private final By cancelButton  = By.id("modal-cancel");

    DeleteAddressModal(WebDriver driver) {
        super(driver);
        wait.until(ExpectedConditions.visibilityOfElementLocated(modal));
    }

    public String getTitle() {
        return getText(title);
    }

    public AddressBookPage confirm() {
        click(confirmButton);
        return closed();
    }

    public AddressBookPage cancel() {
        click(cancelButton);
        return closed();
    }

    private AddressBookPage closed() {
        wait.until(ExpectedConditions.invisibilityOfElementLocated(modal));
        return new AddressBookPage(driver);
    }
}

// Test:
// AddressBookPage page = new AddressBookPage(driver());   // opened on alerts.html
// DeleteAddressModal dialog = page.openDeleteDialog();
// Assert.assertEquals(dialog.getTitle(), "Delete address?");
// Assert.assertEquals(dialog.cancel().getResultText(), "Delete cancelled");
`,
  checks: [
    { label: 'DeleteAddressModal is a component extending BasePage', pattern: 'class\\s+DeleteAddressModal\\s+extends\\s+BasePage', hint: 'class DeleteAddressModal extends BasePage' },
    { label: 'openDeleteDialog returns the modal', pattern: 'DeleteAddressModal\\s+openDeleteDialog\\s*\\([\\s\\S]*?return\\s+new\\s+DeleteAddressModal\\s*\\(', hint: 'return new DeleteAddressModal(driver);' },
    { label: 'confirm() and cancel() return AddressBookPage', pattern: 'AddressBookPage\\s+confirm\\s*\\([\\s\\S]*?AddressBookPage\\s+cancel\\s*\\(|AddressBookPage\\s+cancel\\s*\\([\\s\\S]*?AddressBookPage\\s+confirm\\s*\\(', hint: 'Closing the dialog brings you back to the page underneath' },
    { label: 'Waits for the modal to disappear', pattern: 'invisibilityOf(ElementLocated)?\\s*\\(', hint: 'wait.until(ExpectedConditions.invisibilityOfElementLocated(modal))' },
    { label: 'No switchTo().alert() for an HTML modal', pattern: 'switchTo\\s*\\(\\s*\\)\\s*\\.\\s*alert', mustNot: true, hint: 'HTML dialogs are normal elements; only native JS pop-ups need switchTo().alert()' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for visibility / invisibility instead' },
  ],
  hints: [
    'Right-click the dialog in DevTools: if you can inspect it, it is HTML and findElement works.',
    'A component is a page object for part of the page: same shape (driver, private By, methods).',
    'After clicking a dialog button, wait for invisibilityOfElementLocated(#confirm-modal) before returning the page underneath.',
  ],
  explanation: `**Native alert or HTML modal?** A native \`alert()/confirm()\` is drawn by the browser, you cannot inspect it,
and Selenium needs \`switchTo().alert()\`. An HTML modal is just \`<div>\`s on top of the page: you can inspect it,
and normal \`findElement\` works. Calling \`switchTo().alert()\` on it throws \`NoAlertPresentException\`.

Why a component:
- The same dialog will appear on several screens; one class means one fix when it changes.
- It has a clear **lifecycle**: it opens (constructor waits until visible), the user decides, it closes.
- \`confirm()\` and \`cancel()\` return the page underneath, which makes the test read like the manual steps:
  *open dialog → check title → cancel → check result*.

Waiting for \`invisibilityOfElementLocated\` before returning prevents a classic flake: the next click lands on the
fading overlay and fails with \`ElementClickInterceptedException\`.`,
  mistakes: [
    'Using switchTo().alert() on an HTML modal (NoAlertPresentException).',
    'Returning the page underneath before the overlay has gone, so the next click is intercepted.',
    'Putting the modal locators into every page that can open the dialog.',
    'Checking the dialog result with an assertion inside confirm().',
  ],
  interview: [
    { q: 'How do you tell a JavaScript alert from an HTML modal?', a: 'If you can inspect it in DevTools, it is HTML and you use normal locators. A native alert/confirm/prompt cannot be inspected, blocks the page, and needs driver.switchTo().alert() to read, accept or dismiss it.' },
    { q: 'How would you model a modal dialog in POM?', a: 'As a component object with its own locators. The method that opens it returns the modal object; the modal\'s confirm/cancel methods wait for it to close and return the page underneath. That gives a clear open → act → close lifecycle.' },
  ],
}
