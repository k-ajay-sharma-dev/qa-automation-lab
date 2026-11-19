export default {
  id: 'dbg-020',
  category: 'debugging',
  kind: 'code',
  title: 'Three windows open: the test reads the Terms tab instead of Privacy',
  level: 'INTERMEDIATE',
  tags: ['windows', 'getWindowHandles', 'getTitle', 'flaky', 'custom-wait'],
  estMinutes: 20,
  scenario: `The legal team asked for a check that the ShopEasy **Privacy Policy** page opens and shows its heading. On windows.html the *Open terms + privacy* button (\`#open-two-btn\`) opens **two** tabs at once — Terms of Service and Privacy Policy. Your \`PolicyLinksTest\` passes on your laptop most days but fails about a third of the time on Jenkins. Worse: when it fails, the next test in the class also fails because the browser is left with three tabs open.`,
  description: `Jenkins console:

\`\`\`text
[ERROR] privacyPolicyOpens(com.shopeasy.tests.PolicyLinksTest)  Time elapsed: 1.402 s  <<< FAILURE!
java.lang.AssertionError: Policy tab heading expected [Privacy Policy] but found [Terms of Service]
	at org.testng.Assert.fail(Assert.java:110)
	at org.testng.Assert.assertEquals(Assert.java:1155)
	at com.shopeasy.tests.PolicyLinksTest.privacyPolicyOpens(PolicyLinksTest.java:24)

[ERROR] sizeGuideOpensInNewTab(com.shopeasy.tests.PolicyLinksTest)  Time elapsed: 10.611 s  <<< ERROR!
org.openqa.selenium.TimeoutException: Expected condition failed: waiting for number of open windows to be 2 (tried for 10 second(s) with 500 milliseconds interval)
\`\`\`

The helper (\`WindowsPage.readPolicyHeading\`) waits for 3 windows, then switches to **the first handle that isn't the original** and reads \`#new-window-heading\`. It never closes the extra tabs.

**Diagnose:** \`getWindowHandles()\` returns a \`Set\` with **no guaranteed order**, and the two \`window.open\` calls race each other. "First non-original handle" is Terms on some runs and Privacy on others. Also, both tabs load the same \`new-window.html\` and only set their title (\`ShopEasy — Privacy Policy\`) from JavaScript after loading, so for a moment both are titled *ShopEasy — Size Guide*.

**Fix \`readPolicyHeading(String titlePart)\`:**
- Save the original handle; click; wait for **3** windows.
- In a **custom wait** (lambda), loop over the handles, switch to each and return \`true\` when \`getTitle()\` contains the wanted text — so a slow tab gets polled again.
- Read the heading, then in a \`finally\` **close every child tab** and switch back to the original.`,
  hints: [
    'If the test picks "a" window instead of "the right" window, it will pass or fail depending on handle order.',
    'Identify the window by something the user sees: its title (or URL).',
    'wait.until(d -> { for (String h : d.getWindowHandles()) { d.switchTo().window(h); if (d.getTitle().contains(titlePart)) return true; } return false; });',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class WindowsPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By OPEN_TWO_BUTTON = By.id("open-two-btn");
    private final By HEADING = By.id("new-window-heading");

    public WindowsPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public String readPolicyHeading(String titlePart) {
        String original = driver.getWindowHandle();
        driver.findElement(OPEN_TWO_BUTTON).click();
        wait.until(ExpectedConditions.numberOfWindowsToBe(3));

        for (String handle : driver.getWindowHandles()) {
            if (!handle.equals(original)) {
                driver.switchTo().window(handle);
                break;
            }
        }
        return driver.findElement(HEADING).getText();
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class WindowsPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By OPEN_TWO_BUTTON = By.id("open-two-btn");
    private final By HEADING = By.id("new-window-heading");

    public WindowsPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    /** titlePart e.g. "Privacy Policy" or "Terms of Service". */
    public String readPolicyHeading(String titlePart) {
        String original = driver.getWindowHandle();
        driver.findElement(OPEN_TWO_BUTTON).click();
        wait.until(ExpectedConditions.numberOfWindowsToBe(3));
        try {
            switchToWindowWithTitle(titlePart);
            return wait.until(ExpectedConditions.visibilityOfElementLocated(HEADING)).getText();
        } finally {
            closeAllExcept(original);
        }
    }

    // the title is set by JavaScript after load, so poll until one window really has it
    private void switchToWindowWithTitle(String titlePart) {
        new WebDriverWait(driver, Duration.ofSeconds(10))
            .withMessage("no window with title containing '" + titlePart + "'")
            .until(d -> {
                for (String handle : d.getWindowHandles()) {
                    d.switchTo().window(handle);
                    if (d.getTitle().contains(titlePart)) {
                        return true;
                    }
                }
                return false;
            });
    }

    private void closeAllExcept(String original) {
        for (String handle : driver.getWindowHandles()) {
            if (!handle.equals(original)) {
                driver.switchTo().window(handle);
                driver.close();
            }
        }
        driver.switchTo().window(original);
    }
}
`,
  checks: [
    { label: 'Identifies the window by its title', pattern: 'getTitle\\s*\\(\\s*\\)', hint: 'd.getTitle().contains(titlePart)' },
    { label: 'Polls the handles inside a wait (lambda)', pattern: 'until\\s*\\(\\s*\\(?\\s*\\w+\\s*\\)?\\s*->[\\s\\S]*getWindowHandles[\\s\\S]*getTitle', flags: 'ms', hint: 'wait.until(d -> { for (...) { ... getTitle() ... } return false; })' },
    { label: 'No "first non-original handle + break" guess', pattern: '!\\s*handle\\.equals\\s*\\(\\s*original\\s*\\)\\s*\\)\\s*\\{\\s*driver\\.switchTo\\(\\)\\.window\\s*\\(\\s*handle\\s*\\)\\s*;\\s*break', mustNot: true, hint: 'With 3 windows, "not the original" is two different tabs' },
    { label: 'Closes the child tabs', pattern: '\\.close\\s*\\(\\s*\\)', hint: 'Close every handle that is not the original' },
    { label: 'Switches back to the original window', pattern: 'switchTo\\(\\)\\s*\\.window\\s*\\(\\s*original\\s*\\)', hint: 'driver.switchTo().window(original)' },
  ],
  explanation: `**Two bugs, one symptom:**
1. **Wrong window.** \`getWindowHandles()\` is a \`Set<String>\`. Its iteration order is an implementation detail, and here two tabs open almost simultaneously. "The first handle that isn't the original" is a coin toss between Terms and Privacy → a classic *intermittent* failure that looks like flakiness.
2. **Left-over windows.** The helper never closed the extra tabs or switched back, so the next test (\`sizeGuideOpensInNewTab\`, which waits for exactly 2 windows) timed out. One root cause, two red tests — always fix the first.

**Pick the window by what the user sees.** A tester would say "go to the *Privacy Policy* tab". The code should do the same: switch to each handle and check \`getTitle()\` (or \`getCurrentUrl()\` — here \`?page=privacy\`).

**Why a custom wait, not a plain loop:** both tabs load \`new-window.html\`, whose HTML title is *ShopEasy — Size Guide*; the script changes it to *ShopEasy — Privacy Policy* a moment later. A one-shot loop right after the windows appear might not find it yet. \`wait.until(d -> {...})\` re-runs the loop every 500 ms until it returns \`true\`, and \`withMessage(...)\` makes the timeout error say what was missing. (It is a separate wait object on purpose: \`withMessage\` changes the wait it is called on, and you don't want that message on every other timeout of the page object.)

**Cleanup in \`finally\`:** close every non-original handle (\`close()\` closes the *current* one, so switch first) and switch back — even when the assertion inside fails. Leaving windows open is how one failure becomes five.`,
  mistakes: [
    'new ArrayList<>(driver.getWindowHandles()).get(1) — assumes an order that is not guaranteed.',
    'Checking the title once, immediately after the click, before the tab\'s script has set it.',
    'Closing the child tab without switching to it first — that closes the main window instead.',
    'Rerunning the job until it passes and calling the test "flaky".',
  ],
  interview: [
    { q: 'How do you switch to a specific window when several are open?', a: 'I save the parent handle, wait for the expected number of windows, then loop through getWindowHandles(), switch to each and check the title or URL until I find the one I want — inside a WebDriverWait lambda so it also waits for the page to finish loading. Afterwards I close the child windows and switch back to the parent.' },
    { q: 'Is the order of getWindowHandles() reliable?', a: 'No. It returns a Set and the order is not part of the WebDriver contract. It often looks like opening order, which is why tests built on it pass locally and fail intermittently in CI. Always identify windows by title, URL or content.' },
  ],
}
