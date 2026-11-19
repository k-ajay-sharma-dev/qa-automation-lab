export default {
  id: 'sel-012',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Actions API: hover menu, drag and drop, right-click',
  level: 'INTERMEDIATE',
  tags: ['actions', 'hover', 'drag-and-drop', 'contextClick'],
  estMinutes: 20,
  scenario: `The new account menu only shows "My account → Orders" when you hover over "My account", so \`click()\` on "Orders" throws \`ElementNotInteractableException\`. The same sprint added a drag-and-drop "wishlist". Both are on \`dynamic.html\` (\`#account-menu\`, \`#draggable\` → \`#droppable\`). Your own team's app also has a right-click context menu on product cards — the practice site has none, so for that one you write a reusable helper. These are user *gestures*, so you need the \`Actions\` class.`,
  description: `On \`http://localhost:5180/practice-site/dynamic.html\`:

1. **Hover**: \`moveToElement(#account-menu)\`, then wait for the "Orders" submenu link to be visible and click it; \`#dynamic-result\` shows \`Menu: Orders\`.
2. **Drag and drop**: drag \`#draggable\` (the backpack) onto \`#droppable\` with \`dragAndDrop(source, target)\` (or \`clickAndHold → moveToElement → release\`); assert the target text changed.
3. **Right-click** (for your own app — the practice site has no context menu): write a helper \`openContextMenu(By target, By menu)\` that does \`contextClick(element)\` and waits for the custom menu to be visible.
4. Optional: \`doubleClick\`, or \`keyDown(Keys.SHIFT)\` / \`keyUp\`.

**Rules**: every chain must end with \`.perform()\`; reuse one \`Actions\` instance; no \`Thread.sleep\`.`,
  hints: [
    'Actions actions = new Actions(driver);',
    'actions.moveToElement(menu).perform(); — nothing happens without perform()',
    'If dragAndDrop does nothing on an HTML5 draggable, try clickAndHold(src).moveToElement(dst).release().perform().',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.testng.Assert;
import org.testng.annotations.Test;

public class GesturesTest extends BaseTest {

    private static final By MENU = By.id("account-menu");
    private static final By SUBMENU_ITEM = By.xpath("//div[@id='account-menu']//a[normalize-space()='Orders']");
    private static final By DRAG_SOURCE = By.id("draggable");
    private static final By DROP_TARGET = By.id("droppable");

    @Test
    public void userGestures() {
        driver.get("http://localhost:5180/practice-site/dynamic.html");
        driver.findElement(SUBMENU_ITEM).click(); // not visible until hover
        // TODO: hover, drag & drop, right-click
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class GesturesTest extends BaseTest {

    private static final By MENU = By.id("account-menu");
    private static final By SUBMENU_ITEM = By.xpath("//div[@id='account-menu']//a[normalize-space()='Orders']");
    private static final By DRAG_SOURCE = By.id("draggable");
    private static final By DROP_TARGET = By.id("droppable");
    private static final By LAST_ACTION = By.id("dynamic-result");

    private WebDriverWait wait;
    private Actions actions;

    @Test
    public void userGestures() {
        wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        actions = new Actions(driver);
        driver.get("http://localhost:5180/practice-site/dynamic.html");

        // 1. hover to reveal the submenu
        actions.moveToElement(driver.findElement(MENU)).perform();
        wait.until(ExpectedConditions.visibilityOfElementLocated(SUBMENU_ITEM)).click();
        wait.until(ExpectedConditions.textToBe(LAST_ACTION, "Menu: Orders"));

        // 2. drag and drop
        WebElement source = driver.findElement(DRAG_SOURCE);
        WebElement target = driver.findElement(DROP_TARGET);
        String before = target.getText();
        actions.dragAndDrop(source, target).perform();
        wait.until(d -> !d.findElement(DROP_TARGET).getText().equals(before));
        Assert.assertTrue(driver.findElement(DROP_TARGET).getText().startsWith("Dropped!"));
    }

    /** 3. right-click helper for your own app's context menu (the practice site has none). */
    private WebElement openContextMenu(By target, By menu) {
        actions.contextClick(driver.findElement(target)).perform();
        return wait.until(ExpectedConditions.visibilityOfElementLocated(menu));
    }
}
`,
  checks: [
    { label: 'Creates an Actions instance', pattern: 'new\\s+Actions\\s*\\(\\s*driver\\s*\\)', hint: 'Actions actions = new Actions(driver);' },
    { label: 'Hovers with moveToElement', pattern: '\\.moveToElement\\s*\\(', hint: 'actions.moveToElement(menu).perform()' },
    { label: 'Drags and drops', pattern: '\\.dragAndDrop\\s*\\(|\\.clickAndHold\\s*\\([\\s\\S]*?\\.release\\s*\\(', hint: 'actions.dragAndDrop(source, target).perform()' },
    { label: 'Right-clicks with contextClick', pattern: '\\.contextClick\\s*\\(', hint: 'actions.contextClick(element).perform()' },
    { label: 'Executes chains with perform()', pattern: '\\.perform\\s*\\(\\s*\\)', hint: 'Actions do nothing until perform()' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the submenu to be visible' },
  ],
  explanation: `\`Actions\` builds low-level input sequences (pointer + keyboard) through the W3C Actions API. You chain steps and **nothing happens until \`perform()\`** — the most common beginner bug.

- **Hover**: \`moveToElement(el)\` moves the virtual mouse so CSS \`:hover\` / \`mouseover\` handlers fire. Then wait for the revealed element to be visible before clicking.
- **Drag and drop**: \`dragAndDrop(src, dst)\` = \`clickAndHold(src).moveToElement(dst).release()\`. Note: pure HTML5 drag-and-drop (\`draggable="true"\` with \`dataTransfer\`) is historically unreliable with WebDriver; if both forms fail, teams fall back to a JS drag simulation helper — that's a known limitation, not your bug.
- **Right-click**: \`contextClick(el)\`; **double-click**: \`doubleClick(el)\`.
- **Keyboard**: \`keyDown(Keys.CONTROL).click(a).click(b).keyUp(Keys.CONTROL)\` for multi-select; \`sendKeys(Keys.ENTER)\`.
- \`scrollToElement(el)\` (Selenium 4.2+) scrolls via the wheel API.

The final \`wait.until(d -> ...)\` re-finds the target, so a re-render after the drop does not cause a stale reference.`,
  mistakes: [
    'Forgetting .perform() — no error, nothing happens.',
    'Clicking the submenu immediately after hover without waiting for visibility.',
    'Using the deprecated .build().perform() pattern unnecessarily (perform() builds implicitly).',
    'Hover tests failing in headless mode because the window is too small and the menu is collapsed — set a window size.',
  ],
  interview: [
    { q: 'How do you mouse-hover in Selenium?', a: 'new Actions(driver).moveToElement(element).perform(), then wait for the revealed element.' },
    { q: 'Action vs Actions?', a: 'Actions is the builder class with the fluent API; build() returns a composite Action object. perform() builds and executes in one call.' },
    { q: 'How do you send Ctrl+A?', a: 'actions.keyDown(Keys.CONTROL).sendKeys("a").keyUp(Keys.CONTROL).perform(), or element.sendKeys(Keys.chord(Keys.CONTROL, "a")). On macOS use Keys.COMMAND.' },
  ],
}
