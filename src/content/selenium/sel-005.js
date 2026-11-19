export default {
  id: 'sel-005',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Fill the seller registration form: radios, checkboxes, multi-select and file upload',
  level: 'BEGINNER',
  tags: ['form', 'checkbox', 'radio', 'file-upload', 'isSelected'],
  estMinutes: 20,
  scenario: `The "Seller registration" form (\`form.html\`) is where most production bugs came from last quarter: a checkbox that toggled *off* when the test ran twice, and a trade-licence upload that silently failed. Your manual test case TC-SELL-07 has 9 steps; automate it so it is idempotent (works regardless of the starting state) and verifies the upload.`,
  description: `On \`http://localhost:5180/practice-site/form.html\`:

1. Choose the **Male/Female/Prefer not to say** radio of your choice (\`#gender-male\`, \`#gender-female\`, \`#gender-other\`) and assert it \`isSelected()\`.
2. Make sure the **Clothing** category checkbox (\`input[name='categories'][value='clothing']\`) ends up *checked* and **Terms** (\`#terms\`) ends up *checked* — click only if \`!isSelected()\`.
3. In the multi-select **Sales channels** (\`#channels\`), select two options and assert \`getAllSelectedOptions()\` has size 2.
4. Upload \`src/test/resources/licence.png\` by calling \`sendKeys\` on the \`<input type="file" id="upload-file">\` with an **absolute path**.
5. Assert the file input's value contains \`licence.png\`.

**Rules**
- Never click a checkbox blindly — guard with \`isSelected()\`.
- No Robot class / AutoIt / OS dialogs for upload.`,
  hints: [
    'if (!box.isSelected()) { box.click(); }',
    'Paths.get("src/test/resources/licence.png").toAbsolutePath().toString()',
    'For the file input use sendKeys(absolutePath) — never click() it, that opens the native dialog Selenium cannot control.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SellerFormTest extends BaseTest {

    private static final By RADIO_OTHER = By.id("gender-other");
    private static final By CLOTHING = By.cssSelector("input[name='categories'][value='clothing']");
    private static final By TERMS = By.id("terms");
    private static final By CHANNELS = By.id("channels");
    private static final By LICENCE_UPLOAD = By.id("upload-file");

    @Test
    public void fillSellerForm() {
        driver.get("http://localhost:5180/practice-site/form.html");

        driver.findElement(CLOTHING).click();        // flaky: toggles off if already checked
        driver.findElement(LICENCE_UPLOAD).click();  // opens an OS dialog, test hangs
        // TODO: radio, terms, channels, assertions
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.nio.file.Path;
import java.nio.file.Paths;

public class SellerFormTest extends BaseTest {

    private static final By RADIO_OTHER = By.id("gender-other");
    private static final By CLOTHING = By.cssSelector("input[name='categories'][value='clothing']");
    private static final By TERMS = By.id("terms");
    private static final By CHANNELS = By.id("channels");
    private static final By LICENCE_UPLOAD = By.id("upload-file");

    @Test
    public void fillSellerForm() {
        driver.get("http://localhost:5180/practice-site/form.html");

        WebElement radio = driver.findElement(RADIO_OTHER);
        radio.click();
        Assert.assertTrue(radio.isSelected(), "Radio should be selected");

        check(CLOTHING);
        check(TERMS);
        Assert.assertTrue(driver.findElement(CLOTHING).isSelected(), "Clothing category should be checked");
        Assert.assertTrue(driver.findElement(TERMS).isSelected(), "Terms should be checked");

        Select channels = new Select(driver.findElement(CHANNELS));
        Assert.assertTrue(channels.isMultiple(), "Sales channels should be a multi-select");
        channels.deselectAll();
        channels.selectByVisibleText("Website");
        channels.selectByVisibleText("Mobile app");
        Assert.assertEquals(channels.getAllSelectedOptions().size(), 2);

        Path licence = Paths.get("src", "test", "resources", "licence.png").toAbsolutePath();
        WebElement upload = driver.findElement(LICENCE_UPLOAD);
        upload.sendKeys(licence.toString());
        Assert.assertTrue(upload.getDomProperty("value").contains("licence.png"),
                "Upload input should hold licence.png");
    }

    /** Idempotent: leaves the checkbox checked whatever its starting state. */
    private void check(By locator) {
        WebElement box = driver.findElement(locator);
        if (!box.isSelected()) {
            box.click();
        }
    }
}
`,
  checks: [
    { label: 'Guards checkbox clicks with isSelected()', pattern: 'if\\s*\\(\\s*!\\s*\\w+(\\.findElement\\([^)]*\\))?\\.isSelected\\s*\\(\\s*\\)\\s*\\)', hint: 'if (!box.isSelected()) box.click();' },
    { label: 'Asserts a radio/checkbox state', pattern: 'assertTrue\\s*\\([^;]*isSelected\\s*\\(', hint: 'Assert.assertTrue(radio.isSelected())' },
    { label: 'Reads selected options of the multi-select', pattern: 'getAllSelectedOptions\\s*\\(', hint: 'channels.getAllSelectedOptions().size()' },
    { label: 'Builds an absolute path for the upload', pattern: '(toAbsolutePath|getAbsolutePath|System\\.getProperty\\s*\\(\\s*"user\\.dir")', hint: 'Paths.get(...).toAbsolutePath().toString()' },
    { label: 'Uploads by sendKeys on the file input', pattern: '\\.sendKeys\\s*\\(\\s*\\w+\\.(toString|getAbsolutePath)\\s*\\(|sendKeys\\s*\\(\\s*\\w*[Pp]ath\\w*\\s*\\)', hint: 'upload.sendKeys(licence.toString())' },
    { label: 'Does not click the file input', pattern: 'findElement\\s*\\(\\s*(LICENCE_UPLOAD|AVATAR)\\s*\\)\\s*\\.click', mustNot: true, hint: 'Clicking opens a native OS dialog Selenium cannot drive' },
    { label: 'No Robot class', pattern: 'new\\s+Robot\\s*\\(', mustNot: true, hint: 'sendKeys on input[type=file] is all you need' },
  ],
  explanation: `**Radios and checkboxes** are just \`click()\` + \`isSelected()\`. The idempotent \`check()\` helper is the important idea: tests must reach the *desired state*, not toggle. If the app remembers preferences, or the test is retried, a blind click flips the box back off.

**Multi-select** uses the same \`Select\` class; \`isMultiple()\`, \`deselectAll()\` and \`getAllSelectedOptions()\` only make sense there.

**File upload**: Selenium cannot interact with OS file dialogs. Instead you \`sendKeys\` the absolute file path straight into the \`<input type="file">\` — the browser treats it as a chosen file. Use an absolute path (relative paths resolve against chromedriver, not your project). On a remote Grid you also need \`((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector())\` so the file is streamed to the node.

If the input is hidden behind a styled button, you may need to make it visible via JavaScript first — but try \`sendKeys\` first; Chrome accepts it on most hidden file inputs.`,
  mistakes: [
    'Clicking the "Browse" button, which opens a native dialog and hangs the test.',
    'Passing a relative path like "licence.png" — works on your machine, fails on Jenkins.',
    'Toggling checkboxes without checking isSelected(), so reruns flip the state.',
    'Forgetting LocalFileDetector when the same test runs on Selenium Grid.',
  ],
  interview: [
    { q: 'How do you upload a file in Selenium?', a: 'Locate the input[type=file] and call sendKeys with the absolute file path. No dialog is opened. On Grid, set a LocalFileDetector on the RemoteWebDriver so the file is transferred to the node.' },
    { q: 'How do you handle a download?', a: 'Configure the browser download directory through ChromeOptions prefs (download.default_directory), trigger the download, then poll the folder with a wait until the file exists and is complete. Selenium 4 Grid also has a managed downloads feature.' },
    { q: 'isSelected vs isEnabled vs isDisplayed?', a: 'isSelected: checked state of checkbox/radio/option. isEnabled: not disabled. isDisplayed: rendered and visible to the user.' },
  ],
}
