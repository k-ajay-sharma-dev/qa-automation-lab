export default {
  id: 'pom-022',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'A page object for an iframe widget that always switches back',
  level: 'INTERMEDIATE',
  tags: ['pom', 'iframe', 'switchTo', 'components'],
  estMinutes: 20,
  scenario: `ShopEasy embeds a third-party *Contact support* widget as an iframe (\`#support-frame\` on \`frames.html\`).
The current test switches into the frame, fills the form, and forgets to switch back — so the next step,
reading \`#frame-message\` on the main page, fails with \`NoSuchElementException\` and the whole class after it goes red.
Worse, the switching code is copy-pasted in five tests.`,
  description: `Hide all frame switching inside a \`SupportWidget\` component used by \`SupportPage\`.

**Rules**
- \`SupportWidget\` has private locators for the frame (\`#support-frame\`) and its fields
  (\`#support-name\`, \`#support-email\`, \`#support-message\`, \`#support-submit\`, \`#support-result\`).
- \`submitTicket(String name, String email, String message)\` switches into the frame with an explicit wait
  (\`frameToBeAvailableAndSwitchToIt\`), fills and submits, reads \`#support-result\`, and returns that text.
- It **always** switches back to the main document (\`defaultContent()\`) — even if something inside fails (\`finally\`).
- \`SupportPage.supportWidget()\` returns the component; \`SupportPage.getFrameMessage()\` reads \`#frame-message\` on the main page.
- Tests never call \`switchTo()\`.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class SupportPage extends BasePage {
    private final By frameMessage = By.id("frame-message");

    public SupportPage(WebDriver driver) { super(driver); }

    public String getFrameMessage() {
        return getText(frameMessage);
    }
}

// In SupportTest today:
// driver().switchTo().frame("support-frame");
// driver().findElement(By.id("support-name")).sendKeys("Asha");
// driver().findElement(By.id("support-submit")).click();
// String msg = page.getFrameMessage();          // NoSuchElementException: still inside the frame!

class SupportWidget {
    // TODO
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class SupportPage extends BasePage {
    private final By frameMessage = By.id("frame-message");
    private final SupportWidget supportWidget;

    public SupportPage(WebDriver driver) {
        super(driver);
        this.supportWidget = new SupportWidget(driver);
    }

    public SupportWidget supportWidget() {
        return supportWidget;
    }

    public String getFrameMessage() {
        return getText(frameMessage);
    }
}

class SupportWidget extends BasePage {
    private final By frame         = By.id("support-frame");
    private final By nameInput     = By.id("support-name");
    private final By emailInput    = By.id("support-email");
    private final By messageInput  = By.id("support-message");
    private final By submitButton  = By.id("support-submit");
    private final By result        = By.id("support-result");

    SupportWidget(WebDriver driver) {
        super(driver);
    }

    public String submitTicket(String name, String email, String message) {
        enterFrame();
        try {
            type(nameInput, name);
            type(emailInput, email);
            type(messageInput, message);
            click(submitButton);
            wait.until(ExpectedConditions.textMatches(result, java.util.regex.Pattern.compile("\\\\S")));
            return getText(result);
        } finally {
            driver.switchTo().defaultContent();
        }
    }

    private void enterFrame() {
        wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(frame));
    }
}

// Test (no switchTo anywhere):
// SupportPage page = new SupportPage(driver());
// String result = page.supportWidget().submitTicket("Asha", "asha@example.com", "Where is my order?");
// Assert.assertTrue(result.startsWith("Thanks Asha, ticket T-"), "Widget said: " + result);
// Assert.assertTrue(page.getFrameMessage().matches("Ticket T-\\\\d{4} created"), "Main page message");
`,
  checks: [
    { label: 'Waits for the frame and switches in', pattern: 'frameToBeAvailableAndSwitchToIt\\s*\\(', hint: 'wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(frame))' },
    { label: 'Switches back to the main document', pattern: 'switchTo\\s*\\(\\s*\\)\\s*\\.\\s*(defaultContent|parentFrame)\\s*\\(', hint: 'driver.switchTo().defaultContent();' },
    { label: 'Switch-back is in a finally block', pattern: 'finally\\s*\\{[^}]*switchTo\\s*\\(\\s*\\)\\s*\\.\\s*(defaultContent|parentFrame)', hint: 'try { ... } finally { driver.switchTo().defaultContent(); }' },
    { label: 'submitTicket returns the result text', pattern: 'public\\s+String\\s+submitTicket\\s*\\(\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*,\\s*String\\s+\\w+\\s*\\)', hint: 'public String submitTicket(String name, String email, String message)' },
    { label: 'Page exposes the component', pattern: 'SupportWidget\\s+supportWidget\\s*\\(\\s*\\)', hint: 'public SupportWidget supportWidget() { return supportWidget; }' },
    { label: 'Frame locator is private in the component', pattern: 'private\\s+(final\\s+)?By\\s+\\w+\\s*=\\s*By\\.(id|cssSelector|name)\\s*\\(\\s*"(#?support-frame|supportFrame)"', hint: 'private final By frame = By.id("support-frame");' },
  ],
  hints: [
    'Think of a frame as a separate room: every method that walks in must walk out again.',
    'frameToBeAvailableAndSwitchToIt waits for the iframe to load AND switches into it in one step.',
    'Put the switch-back in finally so a failed type() or click() inside the frame cannot leave the driver stuck there.',
  ],
  explanation: `An iframe is a **separate document**. While Selenium is "inside" it, the main page's elements do not exist
for \`findElement\`, and vice versa. The danger is not switching in — it is forgetting to switch **out**.

The component makes context handling invisible to tests:
1. **Enter with a wait**: \`frameToBeAvailableAndSwitchToIt\` waits until the iframe is loaded, then switches. A plain
   \`switchTo().frame(...)\` right after navigation can fail because the frame is still loading.
2. **Work** with normal private locators (they are only valid inside the frame — another reason to hide them).
3. **Leave in \`finally\`**: whatever happens, the driver is back in the main document before the method ends.

Each public method is a complete "in → work → out" transaction, so a test can freely mix widget calls and main-page
calls. Use \`parentFrame()\` instead of \`defaultContent()\` when you only want to go up one level of a nested frame
(the live chat in \`#chat-frame\` lives inside the support frame).`,
  mistakes: [
    'Leaving the driver inside the frame, so the next main-page lookup throws NoSuchElementException.',
    'Switching back only on the happy path (no finally), so one failure breaks every following step.',
    'Switching by index (frame(0)) — adding an ad iframe changes the index.',
    'Letting tests call driver.switchTo() themselves, spreading frame knowledge across the suite.',
  ],
  interview: [
    { q: 'How do you handle iframes in a page object framework?', a: 'Model the frame content as a component. Each public method switches in with frameToBeAvailableAndSwitchToIt, does its work with private locators, and switches back in a finally block. Tests never call switchTo.' },
    { q: 'defaultContent() vs parentFrame()?', a: 'defaultContent() goes back to the top-level document from any depth. parentFrame() goes up exactly one level, which you need when working with nested iframes and want to stay in the outer frame.' },
    { q: 'Why can\'t Selenium find an element that is clearly visible on the screen?', a: 'A common cause is that it lives inside an iframe (or the driver is still inside a different frame). Check in DevTools whether the element\'s document is an iframe, then switch to the right context.' },
  ],
}
