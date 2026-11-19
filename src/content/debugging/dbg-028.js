export default {
  id: 'dbg-028',
  category: 'debugging',
  kind: 'code',
  title: 'ElementNotInteractableException: typing into the hidden Edit employee form',
  level: 'BEGINNER',
  tags: ['ElementNotInteractableException', 'visibility', 'hidden', 'web-table', 'waits'],
  estMinutes: 15,
  scenario: `HR asked for a regression test: "Give Rahul Verma a raise to 75,000 in the employee directory". You wrote it in ten minutes — the \`#edit-salary\` field was easy to find in DevTools. The test fails every run, and \`findElement\` clearly **did** find the field. A teammate's suggestion in the stand-up: *"Just set the value with JavaScript."* Your lead says no and asks you to read the exception properly.`,
  description: `Console output:

\`\`\`text
[ERROR] raiseRahulsSalary(com.shopeasy.tests.EmployeeEditTest)  Time elapsed: 1.882 s  <<< FAILURE!
org.openqa.selenium.ElementNotInteractableException: element not interactable
  (Session info: chrome=126.0.6478.127)
Element: [[ChromeDriver: chrome on windows] -> id: edit-salary]
	at org.openqa.selenium.remote.ErrorCodec.decode(ErrorCodec.java:167)
	at org.openqa.selenium.remote.RemoteWebElement.sendKeys(RemoteWebElement.java:111)
	at com.shopeasy.tests.EmployeeEditTest.raiseRahulsSalary(EmployeeEditTest.java:24)
\`\`\`

The element **exists** in the DOM (no NoSuchElementException) but is inside \`<section id="edit-panel" class="panel hidden">\`. The panel only becomes visible after a row's **Edit** button (\`button.btn-edit\`) is clicked. Rahul Verma is not on page 1 of the table (5 rows per page).

**Fix the test:**
- Bring Rahul's row on screen (type his name into \`#table-search\`), then click the Edit button **in his row**.
- Wait until the field is **visible** before typing.
- \`clear()\` the pre-filled salary before \`sendKeys\`.
- Save with \`#save-edit\` and assert \`#edit-message\` shows \`Saved Rahul Verma.\`
- No \`JavascriptExecutor\` tricks.`,
  hints: [
    'ElementNotInteractable = found, but hidden, zero-size, disabled or covered. Ask: what makes it visible?',
    'Row Edit button: //tr[td[normalize-space()=\'Rahul Verma\']]//button[contains(@class,\'btn-edit\')]',
    'wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("edit-salary")))',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class EmployeeEditTest extends BaseTest {

    @Test
    public void raiseRahulsSalary() {
        driver.get(baseUrl + "/table.html");

        // TODO: open Rahul Verma's edit form first?
        driver.findElement(By.id("edit-salary")).sendKeys("75000");   // line 24 - ElementNotInteractableException
        driver.findElement(By.id("save-edit")).click();

        Assert.assertTrue(driver.getPageSource().contains("75,000"));
    }
}
`,
  solution: String.raw`package com.shopeasy.tests;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

public class EmployeeEditTest extends BaseTest {

    private static final By SEARCH = By.id("table-search");
    private static final By SALARY = By.id("edit-salary");
    private static final By SAVE = By.id("save-edit");
    private static final By EDIT_MESSAGE = By.id("edit-message");

    private static By editButtonFor(String name) {
        return By.xpath("//tr[td[normalize-space()='" + name + "']]//button[contains(@class,'btn-edit')]");
    }

    @Test
    public void raiseRahulsSalary() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get(baseUrl + "/table.html");

        // 1. Rahul is on page 2 - filter so his row is rendered
        driver.findElement(SEARCH).sendKeys("Rahul Verma");

        // 2. The edit panel is hidden until a row's Edit button is clicked
        wait.until(ExpectedConditions.elementToBeClickable(editButtonFor("Rahul Verma"))).click();

        // 3. Wait for VISIBILITY, not just presence
        WebElement salary = wait.until(ExpectedConditions.visibilityOfElementLocated(SALARY));
        salary.clear();                       // field is pre-filled with 69000
        salary.sendKeys("75000");
        driver.findElement(SAVE).click();

        wait.until(ExpectedConditions.textToBe(EDIT_MESSAGE, "Saved Rahul Verma."));
        Assert.assertEquals(driver.findElement(EDIT_MESSAGE).getText(), "Saved Rahul Verma.");
    }
}
`,
  checks: [
    { label: 'Clicks the Edit button in the employee\'s row', pattern: '(btn-edit|data-emp-id)', hint: 'The panel opens only after the row\'s Edit button (button.btn-edit) is clicked' },
    { label: 'Waits for the field to be visible', pattern: '(visibilityOf(ElementLocated)?|elementToBeClickable)\\s*\\(', hint: 'presence is not enough - use ExpectedConditions.visibilityOfElementLocated' },
    { label: 'Clears the pre-filled salary', pattern: '\\.clear\\s*\\(\\s*\\)', hint: 'sendKeys appends: 69000 + 75000 = 6900075000' },
    { label: 'Asserts the Saved message', pattern: 'edit-message', hint: 'Check #edit-message says "Saved Rahul Verma."' },
    { label: 'No JavaScript value hack', pattern: 'executeScript', mustNot: true, hint: 'A real user cannot type into a hidden field - neither should the test' },
  ],
  explanation: `**ElementNotInteractableException means: "I found it, but a user could not use it right now."** Typical reasons: the element is hidden (\`display:none\`, a \`hidden\` class on a parent), has zero size, is off-screen, or is disabled for typing.

Compare with its cousins:
- **NoSuchElementException** — not in the DOM at all.
- **ElementClickInterceptedException** — visible, but another element (spinner, banner) is on top.
- **ElementNotInteractableException** — in the DOM, but not visible/usable.

Here the edit form is always in the HTML but hidden until you click a row's Edit button — exactly what a manual tester would do first. The fix is to **follow the user journey** (filter, click Edit, wait for visibility) instead of forcing the field.

**Why not JavaScript?** \`executeScript("arguments[0].value='75000'")\` bypasses the browser's events and visibility rules. The test would pass even if the Edit button were broken — a false green that hides a real defect.

Also notice \`clear()\`: the form is pre-filled with 69000, and \`sendKeys\` *appends*.`,
  mistakes: [
    'Using JavascriptExecutor to set the value of a hidden field — the test no longer proves a user can do it.',
    'Waiting for presenceOfElementLocated: the field is present from page load, only visibility changes.',
    'Forgetting clear(), so the field ends up as 6900075000.',
    'Clicking the first .btn-edit on the page instead of the one in the right row.',
  ],
  interview: [
    { q: 'What is the difference between ElementNotInteractableException and ElementClickInterceptedException?', a: 'Not interactable means the element itself is not usable — hidden, zero-size or off-screen. Click intercepted means the element is fine but another element sits on top and would receive the click, like a spinner or banner. The first needs you to make the element visible (usually a missing user step); the second needs you to wait for the overlay to go away.' },
    { q: 'When is it acceptable to use JavaScript to click or type?', a: 'Rarely — for things a user cannot do through the UI anyway, like scrolling a tricky container or reading a value for diagnostics. For user actions I avoid it because it skips visibility and event checks and can hide real bugs. If I do use it, I document why in the code.' },
  ],
}
