export default {
  id: 'sel-024',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Multi-select sales channels: select, deselect and verify what was submitted',
  level: 'BEGINNER',
  tags: ['select', 'multi-select', 'deselect', 'form'],
  estMinutes: 15,
  scenario: `Bug SELL-58: "A seller picked Website and Marketplaces, changed their mind about Mobile app, and the application still listed Mobile app." The dev says the fix is in. Manual retest means Ctrl-clicking options in a list box, which nobody enjoys. Automate it on \`form.html\`: select, change your mind, deselect, submit — and check what the application *received*, not just what the list box shows.`,
  description: `On \`http://localhost:5180/practice-site/form.html\`:

1. Fill the required fields: \`#firstName\`, \`#lastName\`, \`#email\`, country \`#country\` = **Germany** (use \`selectByValue("DE")\`) and tick \`#terms\`.
2. Wrap \`#channels\` in \`Select\`, assert \`isMultiple()\` is true, then \`deselectAll()\` so the test starts from a known state.
3. Select \`web\` and \`mobile\` by **value**, and **Marketplaces** by **visible text**.
4. Change your mind: \`deselectByValue("mobile")\`.
5. Assert \`getAllSelectedOptions()\` texts are exactly \`[Website, Marketplaces]\`.
6. Click **Register** (\`#submit-btn\`), wait for \`#result-panel\` to be visible, and assert \`#result-details\` contains \`Channels: web, marketplace\` and \`Country: DE\`.

**Rules**: use \`Select\` for both dropdowns (no clicking \`<option>\` elements, no Ctrl-click with Actions); compare the selected options as a list.`,
  hints: [
    'Select channels = new Select(driver.findElement(CHANNELS)); channels.selectByValue("web");',
    'deselectByValue / deselectByVisibleText / deselectAll only work on a multi-select — they throw on a single dropdown.',
    'channels.getAllSelectedOptions().stream().map(WebElement::getText).toList()',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.Keys;
import org.testng.Assert;
import org.testng.annotations.Test;

public class SalesChannelsTest extends BaseTest {

    private static final By CHANNELS = By.id("channels");
    private static final By RESULT_DETAILS = By.id("result-details");

    @Test
    public void channelsAreSubmitted() {
        driver.get("http://localhost:5180/practice-site/form.html");
        // Ctrl-click options by hand: fragile and OS-specific
        new Actions(driver)
                .keyDown(Keys.CONTROL)
                .click(driver.findElement(By.cssSelector("#channels option[value='web']")))
                .click(driver.findElement(By.cssSelector("#channels option[value='marketplace']")))
                .keyUp(Keys.CONTROL)
                .perform();
        // TODO: required fields, deselect, submit, verify result
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class SalesChannelsTest extends BaseTest {

    private static final By FIRST_NAME = By.id("firstName");
    private static final By LAST_NAME = By.id("lastName");
    private static final By EMAIL = By.id("email");
    private static final By COUNTRY = By.id("country");
    private static final By TERMS = By.id("terms");
    private static final By CHANNELS = By.id("channels");
    private static final By SUBMIT = By.id("submit-btn");
    private static final By RESULT_PANEL = By.id("result-panel");
    private static final By RESULT_DETAILS = By.id("result-details");

    @Test
    public void channelsAreSubmitted() {
        driver.get("http://localhost:5180/practice-site/form.html");

        driver.findElement(FIRST_NAME).sendKeys("Jane");
        driver.findElement(LAST_NAME).sendKeys("Doe");
        driver.findElement(EMAIL).sendKeys("jane.doe@example.com");
        new Select(driver.findElement(COUNTRY)).selectByValue("DE");
        WebElement terms = driver.findElement(TERMS);
        if (!terms.isSelected()) {
            terms.click();
        }

        Select channels = new Select(driver.findElement(CHANNELS));
        Assert.assertTrue(channels.isMultiple(), "#channels should allow several choices");
        channels.deselectAll();

        channels.selectByValue("web");
        channels.selectByValue("mobile");
        channels.selectByVisibleText("Marketplaces");
        channels.deselectByValue("mobile");          // the user changed their mind

        List<String> selected = channels.getAllSelectedOptions().stream()
                .map(WebElement::getText)
                .toList();
        Assert.assertEquals(selected, List.of("Website", "Marketplaces"), "Selected channels");

        driver.findElement(SUBMIT).click();
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.visibilityOfElementLocated(RESULT_PANEL));

        String details = driver.findElement(RESULT_DETAILS).getText();
        Assert.assertTrue(details.contains("Channels: web, marketplace"), "Submitted data was:\\n" + details);
        Assert.assertTrue(details.contains("Country: DE"), "Submitted data was:\\n" + details);
    }
}
`,
  checks: [
    { label: 'Wraps the list box in Select', pattern: 'new\\s+Select\\s*\\(\\s*driver\\.findElement\\s*\\(\\s*CHANNELS', hint: 'new Select(driver.findElement(CHANNELS))' },
    { label: 'Checks isMultiple()', pattern: '\\.isMultiple\\s*\\(\\s*\\)', hint: 'Assert.assertTrue(channels.isMultiple())' },
    { label: 'Selects by value', pattern: '\\.selectByValue\\s*\\(', hint: 'channels.selectByValue("web")' },
    { label: 'Deselects an option', pattern: '\\.deselectBy(Value|VisibleText|Index)\\s*\\(', hint: 'channels.deselectByValue("mobile")' },
    { label: 'Reads all selected options', pattern: '\\.getAllSelectedOptions\\s*\\(', hint: 'channels.getAllSelectedOptions()' },
    { label: 'Verifies the submitted result', pattern: 'RESULT_DETAILS|result-details', hint: 'Assert on #result-details after submitting' },
    { label: 'No Ctrl-click on options', pattern: 'keyDown\\s*\\(\\s*Keys\\.CONTROL', mustNot: true, hint: 'Select handles multi-selection for you' },
  ],
  explanation: `The \`Select\` class handles both kinds of \`<select>\`:

| Method | Single dropdown (\`#country\`) | Multi-select (\`#channels\`) |
|---|---|---|
| \`selectByValue / VisibleText / Index\` | replaces the choice | **adds** to the choice |
| \`deselectBy… / deselectAll\` | throws \`UnsupportedOperationException\` | removes one / all |
| \`getFirstSelectedOption()\` | the choice | the first chosen |
| \`getAllSelectedOptions()\` | list of 1 | every chosen option |

\`deselectAll()\` at the start makes the test **idempotent**: if the form ever pre-selects a default channel, the test still ends in the state it expects.

**Value vs visible text**: the form *submits* values (\`web\`, \`marketplace\`), the user *reads* texts (Website, Marketplaces). The solution uses both on purpose and the final assertion checks the submitted values — that is where bug SELL-58 lived. Checking only the list box would prove the UI looked right, not that the application received the right data.

Ctrl-click with \`Actions\` works on Windows but needs Cmd on macOS and breaks when the list scrolls. \`Select\` talks to the options directly and works everywhere.`,
  mistakes: [
    'Calling selectByVisibleText twice on a single dropdown and expecting two choices — the second replaces the first.',
    'Calling deselectAll() on a normal dropdown — UnsupportedOperationException.',
    'Asserting only the list box state and never checking what was submitted.',
    'Comparing the selected texts with the values ("web") or vice versa.',
  ],
  interview: [
    { q: 'How do you handle a multi-select list in Selenium?', a: 'Wrap it in Select, check isMultiple(), call select… once per option, deselect with deselectBy… or deselectAll(), and read the result with getAllSelectedOptions().' },
    { q: 'selectByValue or selectByVisibleText?', a: 'Visible text reads like the manual step and catches label changes; value is stable across translations and matches what is submitted. Pick per case, and keep the choice consistent in the page object.' },
    { q: 'What if the dropdown is not a <select>?', a: 'Custom dropdowns built from divs cannot use Select. Click the control to open it, wait for the option list, then click the option by its text, like any other element.' },
  ],
}
