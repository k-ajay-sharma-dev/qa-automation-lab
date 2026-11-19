export default {
  id: 'pom-038',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'WishlistDropZone: a drag-and-drop component with Actions',
  level: 'ADVANCED',
  tags: ['pom', 'components', 'actions', 'drag-and-drop'],
  estMinutes: 20,
  scenario: `Product wants a "drag the product into your wishlist" feature, prototyped on \`dynamic.html\` (section 8). The
first test written for it lives entirely in the test method: \`new Actions(driver)\`, two \`findElement\` calls, a
\`Thread.sleep(1000)\` and a check that the box text contains "Dropped". When the drag moves to the cart page next sprint,
none of this will be reusable.`,
  description: `Wrap the drag-and-drop area in a component.

**Rules**
- \`WishlistDropZone\` has private locators for \`#draggable\` and \`#droppable\`.
- \`dragProductToWishlist()\` uses Selenium \`Actions\` (\`dragAndDrop\` or \`clickAndHold → moveToElement → release\`),
  waits until the drop zone text contains *"Dropped!"*, and returns \`this\`.
- \`isProductInWishlist()\` returns \`true\` when \`#droppable\` has the CSS class \`dropped\`.
- \`getDropZoneText()\` returns the text for tests that check the copy.
- No \`Thread.sleep\`, no assertions in the component.`,
  starterCode: `package com.shopeasy.components;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class WishlistDropZone {
    private final WebDriver driver;

    public WishlistDropZone(WebDriver driver) { this.driver = driver; }

    public void dragProductToWishlist() throws InterruptedException {
        // TODO: use Actions on #draggable and #droppable
        Thread.sleep(1000);
    }

    // TODO: isProductInWishlist(), getDropZoneText()
}
`,
  solution: `package com.shopeasy.components;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class WishlistDropZone {
    private final WebDriver driver;
    private final WebDriverWait wait;
    private final By product = By.id("draggable");
    private final By dropZone = By.id("droppable");

    public WishlistDropZone(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public WishlistDropZone dragProductToWishlist() {
        WebElement source = wait.until(ExpectedConditions.visibilityOfElementLocated(product));
        WebElement target = wait.until(ExpectedConditions.visibilityOfElementLocated(dropZone));
        new Actions(driver).dragAndDrop(source, target).perform();
        wait.until(ExpectedConditions.textToBePresentInElementLocated(dropZone, "Dropped!"));
        return this;
    }

    public boolean isProductInWishlist() {
        String classes = driver.findElement(dropZone).getAttribute("class");
        return classes != null && classes.contains("dropped");
    }

    public String getDropZoneText() {
        return driver.findElement(dropZone).getText();
    }
}

// Test:
// WishlistDropZone wishlist = new DynamicPage(driver).wishlist();
// assertTrue(wishlist.dragProductToWishlist().isProductInWishlist());
// assertEquals(wishlist.getDropZoneText(), "Dropped! Backpack added to wishlist");
`,
  checks: [
    { label: 'Uses Selenium Actions', pattern: 'new\\s+Actions\\s*\\(', hint: 'new Actions(driver).dragAndDrop(source, target).perform();' },
    { label: 'Drags with dragAndDrop or clickAndHold/release', pattern: '\\.dragAndDrop\\s*\\(|\\.clickAndHold\\s*\\([\\s\\S]*\\.release\\s*\\(', hint: 'dragAndDrop(source, target) or clickAndHold(source).moveToElement(target).release()' },
    { label: 'Calls perform()', pattern: '\\.perform\\s*\\(\\s*\\)', hint: 'Actions do nothing until .perform()' },
    { label: 'Locators for #draggable and #droppable', pattern: '"draggable"[\\s\\S]*"droppable"|"droppable"[\\s\\S]*"draggable"', hint: 'By.id("draggable") and By.id("droppable")' },
    { label: 'Waits for the drop result', pattern: 'textToBePresentInElement|attributeContains', hint: 'wait.until(ExpectedConditions.textToBePresentInElementLocated(dropZone, "Dropped!"))' },
    { label: 'isProductInWishlist returns boolean', pattern: 'public\\s+boolean\\s+isProductInWishlist\\s*\\(', hint: 'public boolean isProductInWishlist()' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the drop zone text instead of sleeping' },
  ],
  hints: [
    'Actions builds a chain of low-level mouse events; nothing happens until perform().',
    'The page implements the drop with mouse events, so Actions.dragAndDrop works here.',
    'After the drop, #droppable gets class "dropped" and the text "Dropped! Backpack added to wishlist".',
  ],
  explanation: `Drag-and-drop is a perfect component: a small UI area with two elements and one user intention.

- **Actions** sends real mouse events (\`mousedown\`, \`mousemove\`, \`mouseup\`). \`dragAndDrop(source, target)\` is
  shorthand for \`clickAndHold(source).moveToElement(target).release()\`.
- **Wait for the outcome**, not for time: the method returns only after the drop zone says *"Dropped!"*.
- **Query methods** (\`isProductInWishlist\`, \`getDropZoneText\`) let tests assert; the component itself never asserts.
- Note: some apps use pure HTML5 drag events, where Selenium's Actions may not trigger \`drop\`. Then a JavaScript
  helper inside the component is the pragmatic fallback, hidden from tests behind the same method name.`,
  mistakes: [
    'Forgetting .perform(), so nothing happens and the test fails later with a confusing message.',
    'Sleeping after the drag instead of waiting for the visible result.',
    'Leaving the Actions code in the test, so the next page needing a drag copies it.',
    'Asserting the drop inside the component.',
  ],
  interview: [
    { q: 'How do you automate drag and drop in Selenium?', a: 'With the Actions class: dragAndDrop(source, target).perform(), or a step-by-step clickAndHold, moveToElement, release chain when the app needs intermediate mouse moves. Then wait for the visible result of the drop.' },
    { q: 'What if Actions.dragAndDrop does nothing?', a: 'The app probably uses HTML5 native drag events, which WebDriver\'s synthetic mouse events may not trigger. Try a moveByOffset chain with small steps, or dispatch dragstart/drop events via JavaScript, wrapped inside the component so tests are unaffected.' },
  ],
}
