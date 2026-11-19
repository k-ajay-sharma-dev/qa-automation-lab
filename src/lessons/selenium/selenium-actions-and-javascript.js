export default {
  slug: 'selenium-actions-and-javascript',
  category: 'selenium',
  order: 7,
  title: 'Actions API and JavascriptExecutor',
  minutes: 8,
  summary: 'Perform mouse and keyboard gestures (hover, drag and drop, right-click, double-click, key chords) and use JavaScript for scrolling and reading values — knowing when JS is a fallback, not a shortcut.',
  manualAnalogy: `Some things you test by hand are not a simple click: hovering over "My account" to reveal a menu, dragging a product into a wishlist, right-clicking, or scrolling down to a button hidden under a sticky header. Selenium's \`click()\` and \`sendKeys()\` cover the simple cases; the Actions API covers real mouse and keyboard gestures, and JavascriptExecutor lets you ask the page itself to do something.`,
  body: `## The Actions API: build a gesture, then perform it

\`\`\`java
Actions actions = new Actions(driver);

WebElement menu = driver.findElement(By.id("account-menu"));          // dynamic.html
actions.moveToElement(menu).perform();                                 // hover

By profile = By.xpath("//div[@id='account-menu']//a[normalize-space()='Profile']");
wait.until(ExpectedConditions.visibilityOfElementLocated(profile)).click();
\`\`\`

- \`new Actions(driver)\` creates a "gesture builder". Create it once per test/page and reuse it.
- \`moveToElement(el)\` only *describes* the hover. **Nothing happens until \`.perform()\`** — the most common Actions bug is a chain without it.
- Hover menus usually animate in, so wait for the submenu item to be visible before clicking. Keep the chain short: if the mouse moves away (another \`moveToElement\`), the menu closes.

### The most useful gestures

| Gesture | Code |
|---|---|
| Hover | \`moveToElement(el)\` |
| Drag and drop | \`dragAndDrop(source, target)\` or \`clickAndHold(source).moveToElement(target).release()\` |
| Right-click | \`contextClick(el)\` |
| Double-click | \`doubleClick(el)\` |
| Hold a key while clicking | \`keyDown(Keys.SHIFT).click(el).keyUp(Keys.SHIFT)\` |
| Keyboard shortcut | \`keyDown(Keys.CONTROL).sendKeys("a").keyUp(Keys.CONTROL)\` |

Each chain ends with \`.perform()\`. \`dragAndDrop\` works on pages that use mouse events (like ShopEasy's \`#draggable\`); for some HTML5 drag-and-drop implementations the step-by-step \`clickAndHold → moveToElement → release\` chain works better, and occasionally only a JavaScript-based drag works.

A right-click on most web pages opens the *browser's* context menu, which Selenium cannot see. It is only testable when the application draws its own custom menu as HTML — then you \`contextClick\` and wait for that menu element to be visible, like any other element.

## JavascriptExecutor: run JavaScript in the page

Every real driver also implements \`JavascriptExecutor\`, so you can cast to it:

\`\`\`java
JavascriptExecutor js = (JavascriptExecutor) driver;
WebElement finish = driver.findElement(By.id("finish"));                 // checkout.html
js.executeScript("arguments[0].scrollIntoView({block: 'center'});", finish);
\`\`\`

- \`(JavascriptExecutor) driver\` is a **cast**: "treat this driver as something that can run scripts".
- \`arguments[0]\` is the first extra argument you pass after the script — here the \`WebElement\`. Selenium converts it into the real DOM node in the browser. Pass elements this way; never glue ids into the JS string.
- \`{block: 'center'}\` scrolls the element to the middle of the viewport — away from sticky headers and footers that could cover it.

### Getting values back

If the script says \`return\`, \`executeScript\` returns the value as a Java object that you cast:

\`\`\`java
Long scrollY = (Long) js.executeScript("return window.scrollY;");
String ready = (String) js.executeScript("return document.readyState;");
Boolean checked = (Boolean) js.executeScript("return arguments[0].checked;", someCheckbox);
\`\`\`

Numbers come back as \`Long\` (or \`Double\` for decimals), text as \`String\`, true/false as \`Boolean\`, elements as \`WebElement\`.

## JS click: a fallback, not the default

\`js.executeScript("arguments[0].click();", el)\` clicks even when something covers the element, because it skips the browser's "can a user actually click here?" checks. That is exactly why it is dangerous as a default: if a real user **cannot** click the button (a cookie banner covers it, a loading overlay is still up), a JS click hides the bug and the test passes anyway.

Sensible order when a click fails with \`ElementClickInterceptedException\`:

1. Read the message — it names the element that "would receive the click".
2. If it is a spinner/overlay: **wait for it to disappear** (\`invisibilityOfElementLocated\`).
3. If it is a sticky header/footer: **scroll the target to the centre**, wait until clickable, click normally.
4. Only then, as a logged, deliberate fallback: catch that specific exception and use a JS click.

Wrapping steps 3–4 in a small helper method keeps tests clean and makes the fallback visible in the logs.`,
  keyPoints: [
    '`new Actions(driver)` builds gestures; nothing happens without `.perform()`.',
    'Hover, drag-and-drop, right-click, double-click and key chords all live in Actions.',
    'Cast to `JavascriptExecutor`, pass elements as `arguments[0]`, use `return` to get values back.',
    '`scrollIntoView({block: \'center\'})` avoids sticky headers covering the target.',
    'JS click bypasses real-user checks — use it only as a logged fallback after waiting/scrolling.',
  ],
  mistakes: [
    'Forgetting `.perform()` — the chain is built but never executed, and no error is thrown.',
    'Making JS click the default "because it never fails" — it also never catches overlay bugs.',
    'Building JS with string concatenation (`"document.getElementById(\'" + id + "\')"`) instead of passing the element as an argument.',
    'Casting `executeScript` numbers to `Integer` — they come back as `Long`.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/dynamic.html\`, open the browser console and run \`document.getElementById('droppable').scrollIntoView({block: 'center'})\`. That is the same JavaScript your Java code would send through \`executeScript\`.`,
  problems: ['sel-012', 'sel-013'],
}
