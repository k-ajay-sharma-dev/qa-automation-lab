export default {
  slug: 'selenium-form-controls',
  category: 'selenium',
  order: 3,
  title: 'Dropdowns, checkboxes, radios and file upload',
  minutes: 7,
  summary: 'Drive every common form control safely: Select for dropdowns, isSelected() guards for checkboxes and radios, and sendKeys for file uploads.',
  manualAnalogy: `By hand you never "click a checkbox" blindly — you look first, and only click if it is not already ticked. You pick a country from a list by reading its name, and you upload a file by choosing it in the OS dialog. Automation needs the same care, with one twist: Selenium cannot see OS dialogs, so file upload works differently.`,
  body: `## Dropdowns: the \`Select\` class

A native HTML dropdown is a \`<select>\` with \`<option>\` children. Selenium gives you a helper class for it:

\`\`\`java
import org.openqa.selenium.support.ui.Select;

Select country = new Select(driver.findElement(By.id("country")));  // form.html
country.selectByVisibleText("Germany");    // what the user reads
country.selectByValue("DE");               // the value attribute in the HTML
country.selectByIndex(1);                  // position — fragile, avoid

String chosen = country.getFirstSelectedOption().getText();
List<WebElement> all = country.getOptions();
\`\`\`

- \`selectByVisibleText\` reads like a manual step ("choose Germany") and is the most readable.
- \`selectByValue\` survives text translations — useful when the UI is multilingual.
- \`getOptions()\` returns every \`<option>\` — handy to verify the list itself.

**Multi-select** lists (\`<select multiple>\`) allow several choices. \`Select\` supports them too: call \`select…\` more than once, then \`getAllSelectedOptions()\`; \`deselectAll()\` resets. \`isMultiple()\` tells you which kind you have.

\`\`\`java
Select channels = new Select(driver.findElement(By.id("channels")));   // form.html
channels.deselectAll();                       // start from a known state
channels.selectByValue("social");
channels.selectByVisibleText("Physical store");
channels.deselectByVisibleText("Social media");    // the user changed their mind
List<String> chosen = channels.getAllSelectedOptions().stream().map(WebElement::getText).toList();
\`\`\`

- On a multi-select every \`select…\` call **adds** a choice; on a normal dropdown it **replaces** the choice.
- \`deselect…\` methods only exist for multi-selects — on a normal dropdown they throw \`UnsupportedOperationException\`.
- The page *submits* option values (\`social\`, \`retail\`) but the user *reads* the texts. When you verify what the application received (a summary page, an API call), compare values; when you verify the screen, compare texts.

> \`Select\` only works on a real \`<select>\`. Many modern UIs draw "dropdowns" with \`<div>\`s — for those you click the box, then click the option like any other element.

## Reading many values and checking an order

Sorting checks follow one pattern: collect, convert, compare with a sorted **copy**.

\`\`\`java
List<String> names = new ArrayList<>();
for (WebElement e : driver.findElements(By.cssSelector("#inventory-list .item-name"))) {
    names.add(e.getText());
}
List<String> expected = new ArrayList<>(names);
Collections.sort(expected);           // or expected.sort(Comparator.reverseOrder())
Assert.assertEquals(names, expected, "Products should be A→Z");
\`\`\`

Why a copy? \`Collections.sort(names)\` would sort the *actual* list in place — then you compare the list with itself and the test can never fail.

Prices are text like \`$29.99\`. Strip the symbol before turning them into numbers, and remember that \`"100" < "9"\` when compared as text. Scope your locator to the area you mean — a class like \`.item-price\` can appear in more than one place on the page.

## Checkboxes and radio buttons: look before you click

\`click()\` *toggles* a checkbox. If it was already ticked (a default, or "Remember me" from a previous run), clicking un-ticks it. So guard every click:

\`\`\`java
WebElement remember = driver.findElement(By.name("rememberMe"));  // login.html
if (!remember.isSelected()) {
    remember.click();
}
Assert.assertTrue(remember.isSelected(), "Remember me should be ticked");
\`\`\`

To *untick*, invert the guard. Radio buttons cannot be unticked by clicking, but the same \`isSelected()\` assertion proves your choice took effect. Locating one checkbox in a group is easiest by its value: \`input[name='categories'][value='outdoor']\`.

## File upload: type the path, never open the dialog

The "Choose file" button opens a native operating-system dialog. Selenium only controls the web page, so it **cannot** see or click that dialog. Instead, send the file path straight into the \`<input type="file">\`:

\`\`\`java
Path file = Paths.get("src/test/resources/avatar.jpg").toAbsolutePath();
driver.findElement(By.cssSelector("input[type='file']")).sendKeys(file.toString());
\`\`\`

- The path must be **absolute** — the browser does not know your project folder.
- Do **not** \`click()\` the file input first; that opens the dialog and blocks the test.
- Robot class and AutoIt are old workarounds that break on headless CI machines. You do not need them.
- On Selenium Grid the file lives on *your* machine, not the node — see the *Browser options, Grid and parallel runs* lesson for \`LocalFileDetector\`.

Afterwards the input's \`value\` attribute contains the file name (browsers show \`C:\\fakepath\\...\`), which is enough to assert the browser accepted it.`,
  keyPoints: [
    '`new Select(element)` works on real `<select>` tags: `selectByVisibleText`, `selectByValue`, `getFirstSelectedOption`.',
    'Multi-selects: `deselectAll()` first, select several, deselect what changed, then check `getAllSelectedOptions()`.',
    'Never click a checkbox blindly — guard with `isSelected()`.',
    'Sorting check: collect values, convert to numbers if needed, compare with a sorted copy.',
    'File upload = `sendKeys(absolutePath)` on `<input type="file">`; never click it.',
  ],
  mistakes: [
    'Clicking `<option>` elements directly instead of using `Select` — flaky and unreadable.',
    'Sorting the actual list in place and comparing it with itself — the assertion can never fail.',
    'Comparing prices as Strings: "$100.00" sorts before "$9.99". Parse to numbers first.',
    'Passing a relative path to the file input — the browser cannot resolve it. Use `toAbsolutePath()`.',
  ],
  tryIt: `On \`http://localhost:5180/practice-site/form.html\` open DevTools and look at \`#country\`. Write down the visible text and value of each option, then decide which \`select…\` call you would use if the site were also available in German.`,
  problems: ['sel-004', 'sel-005', 'sel-024'],
}
