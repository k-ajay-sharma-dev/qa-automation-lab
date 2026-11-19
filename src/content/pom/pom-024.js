export default {
  id: 'pom-024',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Page objects across windows: the size guide tab',
  level: 'ADVANCED',
  tags: ['pom', 'windows', 'window-handles', 'navigation'],
  estMinutes: 25,
  scenario: `Product pages are getting a *"Size guide"* link that opens in a **new tab**; the prototype is on
\`windows.html\` (\`#new-tab-link\` → \`new-window.html\`). Two flaky tests already exist: one picks the new tab with
\`new ArrayList<>(driver.getWindowHandles()).get(1)\` (the order of a Set is not guaranteed), the other closes the tab
and then fails with \`NoSuchWindowException\` because nobody switched back. You will move the window handling into the page objects.`,
  description: `Write \`WindowsPage\` and \`SizeGuidePage\` so tests never touch window handles.

**Rules**
- \`WindowsPage.openSizeGuide()\`:
  remember the current handle, click \`#new-tab-link\`, **wait until 2 windows exist**
  (\`numberOfWindowsToBe(2)\`), switch to the handle that is **not** the original one, and return
  \`new SizeGuidePage(driver, originalHandle)\`.
- \`SizeGuidePage\` stores the original handle in a private field; \`getHeading()\` reads \`#new-window-heading\`;
  \`getSizes()\` returns the first column of \`#size-table tbody tr\` (S, M, L).
- \`SizeGuidePage.closeAndReturn()\` closes the tab, switches back to the original handle, and returns \`WindowsPage\`.
- No index-based handle picking (\`.get(1)\`), no \`Thread.sleep\`.`,
  starterCode: `package com.shopeasy.pages;

import java.util.ArrayList;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class WindowsPage extends BasePage {
    private final By sizeGuideLink = By.id("new-tab-link");

    public WindowsPage(WebDriver driver) { super(driver); }

    public void openSizeGuide() {
        click(sizeGuideLink);
        List<String> handles = new ArrayList<>(driver.getWindowHandles());
        driver.switchTo().window(handles.get(1));
    }
}

class SizeGuidePage {
    // TODO
}
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class WindowsPage extends BasePage {
    private final By sizeGuideLink = By.id("new-tab-link");

    public WindowsPage(WebDriver driver) { super(driver); }

    public SizeGuidePage openSizeGuide() {
        String originalHandle = driver.getWindowHandle();
        click(sizeGuideLink);
        wait.until(ExpectedConditions.numberOfWindowsToBe(2));
        String newHandle = driver.getWindowHandles().stream()
                .filter(handle -> !handle.equals(originalHandle))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Size guide tab did not open"));
        driver.switchTo().window(newHandle);
        return new SizeGuidePage(driver, originalHandle);
    }
}

class SizeGuidePage extends BasePage {
    private final String originalHandle;
    private final By heading   = By.id("new-window-heading");
    private final By sizeCells = By.cssSelector("#size-table tbody tr td:first-child");

    SizeGuidePage(WebDriver driver, String originalHandle) {
        super(driver);
        this.originalHandle = originalHandle;
        waitVisible(heading);
    }

    public String getHeading() {
        return getText(heading);
    }

    public List<String> getSizes() {
        return driver.findElements(sizeCells).stream()
                .map(WebElement::getText)
                .map(String::trim)
                .collect(Collectors.toList());
    }

    public WindowsPage closeAndReturn() {
        driver.close();
        driver.switchTo().window(originalHandle);
        return new WindowsPage(driver);
    }
}

// Test:
// SizeGuidePage guide = new WindowsPage(driver()).openSizeGuide();
// Assert.assertEquals(guide.getHeading(), "Size guide");
// Assert.assertEquals(guide.getSizes(), List.of("S", "M", "L"), "Sizes in the guide");
// WindowsPage back = guide.closeAndReturn();   // driver is on the original tab again
`,
  checks: [
    { label: 'Remembers the original handle', pattern: 'String\\s+\\w+\\s*=\\s*driver\\.getWindowHandle\\s*\\(\\s*\\)', hint: 'String originalHandle = driver.getWindowHandle();' },
    { label: 'Waits for the new window', pattern: 'numberOfWindowsToBe\\s*\\(\\s*2\\s*\\)', hint: 'wait.until(ExpectedConditions.numberOfWindowsToBe(2))' },
    { label: 'Picks the handle that is not the original', pattern: '(!\\s*\\w+\\.equals\\s*\\(|equals\\s*\\([^)]*\\)\\s*==\\s*false|\\.remove\\s*\\(\\s*\\w+\\s*\\))', hint: 'filter(h -> !h.equals(originalHandle))' },
    { label: 'No index-based handle picking', pattern: 'handles\\.get\\s*\\(\\s*\\d+\\s*\\)|\\.get\\s*\\(\\s*1\\s*\\)', mustNot: true, hint: 'getWindowHandles() is a Set; its order is not a contract' },
    { label: 'openSizeGuide returns SizeGuidePage with the handle', pattern: 'SizeGuidePage\\s+openSizeGuide\\s*\\([\\s\\S]*?new\\s+SizeGuidePage\\s*\\(\\s*driver\\s*,\\s*\\w+\\s*\\)', hint: 'return new SizeGuidePage(driver, originalHandle);' },
    { label: 'closeAndReturn closes and switches back', pattern: 'WindowsPage\\s+closeAndReturn\\s*\\([\\s\\S]*?\\.close\\s*\\(\\s*\\)[\\s\\S]*?switchTo\\s*\\(\\s*\\)\\s*\\.\\s*window\\s*\\(', hint: 'driver.close(); driver.switchTo().window(originalHandle); return new WindowsPage(driver);' },
  ],
  hints: [
    'Save driver.getWindowHandle() BEFORE clicking; afterwards you cannot tell which handle was yours.',
    'Opening a tab is asynchronous: wait for numberOfWindowsToBe(2) before reading the handles.',
    'driver.close() closes the current tab but does NOT move the driver; you must switchTo().window(original) yourself.',
  ],
  explanation: `Window handling is navigation, so it belongs in page objects — and the **return type** tells the test which
window it is now in.

- **Remember who you are**: the original handle is captured before the click and handed to \`SizeGuidePage\`, so the
  page that leaves knows where to come back to.
- **Wait, then pick by elimination**: \`numberOfWindowsToBe(2)\` removes the race; "the handle that is not mine" is
  correct regardless of Set order. (With 3+ windows, pick by title or URL instead — see the terms/privacy button.)
- **\`close()\` vs \`quit()\`**: \`close()\` closes the current tab only; \`quit()\` ends the whole session. After
  \`close()\` the driver points at a dead window until you switch — that was the \`NoSuchWindowException\`.
- **Symmetry**: \`openSizeGuide()\` returns the new page, \`closeAndReturn()\` returns the old one. Tests read like
  the manual steps and contain no handle code.

Selenium 4 also has \`driver.switchTo().newWindow(WindowType.TAB)\` for opening a blank tab yourself — handy for
multi-tab scenarios you create, not for tabs the app opens.`,
  mistakes: [
    'Choosing a window with handles.get(1): the Set order is not guaranteed.',
    'Reading the handles immediately after the click, before the new tab exists.',
    'Calling driver.close() and continuing without switching back (NoSuchWindowException).',
    'Calling driver.quit() to close a tab, which kills the whole browser session.',
  ],
  interview: [
    { q: 'How do you switch to a newly opened tab reliably?', a: 'Store the current handle, perform the click, wait for numberOfWindowsToBe(n), then switch to the handle not in the set you had before (or match by title/URL). Never rely on the index of getWindowHandles().' },
    { q: 'What is the difference between close() and quit()?', a: 'close() closes the current window or tab; the session continues and you must switch to another handle. quit() closes all windows and ends the WebDriver session; it belongs in teardown.' },
    { q: 'Where should window-switching code live in a POM framework?', a: 'In the page objects that cause or end the navigation. The method that opens the tab returns the new page object already switched; the method that closes it switches back and returns the original page.' },
  ],
}
