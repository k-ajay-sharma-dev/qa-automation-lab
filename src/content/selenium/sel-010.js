export default {
  id: 'sel-010',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Work inside an iframe and a nested iframe',
  level: 'INTERMEDIATE',
  tags: ['frames', 'switchTo', 'iframe'],
  estMinutes: 20,
  scenario: `ShopEasy's "Contact support" widget is embedded by a third-party provider in an \`<iframe>\`, and the live chat is inside a *nested* iframe within it. Your test fails with \`NoSuchElementException\` even though the locator works in DevTools. A senior glances at it: "You're looking in the wrong document." \`frames.html\` has exactly this structure: the outer iframe \`#support-frame\` with a contact form, and the inner iframe \`#chat-frame\` inside it.`,
  description: `On \`http://localhost:5180/practice-site/frames.html\`:

1. Wait for the **outer** frame \`#support-frame\` and switch into it with \`frameToBeAvailableAndSwitchToIt\` (use a locator, not an index).
2. Type a name into \`#support-name\` in the outer frame.
3. Switch into the **inner** frame \`#chat-frame\` (it is inside the outer one) and read/assert the chat log \`#chat-log\` (greeting "Agent Maya: Hi! How can I help?").
4. Go **up one level** with \`switchTo().parentFrame()\` and verify you can still use the outer frame.
5. Return to the main page with \`switchTo().defaultContent()\` and assert the main page heading (\`h1\` "Frames").

**Rules**: no frame indexes (\`frame(0)\`), no \`Thread.sleep\`.`,
  hints: [
    'wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(OUTER_FRAME)) switches for you.',
    'Frames are nested like folders: to reach the inner one you must be inside the outer one first.',
    'parentFrame() = cd ..   defaultContent() = cd /',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class FramesTest extends BaseTest {

    private static final By OUTER_FRAME = By.id("support-frame");
    private static final By INNER_FRAME = By.id("chat-frame");
    private static final By OUTER_INPUT = By.id("support-name");
    private static final By CHAT_LOG = By.id("chat-log");
    private static final By PAGE_HEADING = By.tagName("h1");

    @Test
    public void typesInsideFrames() {
        driver.get("http://localhost:5180/practice-site/frames.html");
        // fails: the input lives inside the iframe document
        driver.findElement(OUTER_INPUT).sendKeys("Asha Patel");
        // TODO: switch into frames correctly
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class FramesTest extends BaseTest {

    private static final By OUTER_FRAME = By.id("support-frame");
    private static final By INNER_FRAME = By.id("chat-frame");
    private static final By OUTER_INPUT = By.id("support-name");
    private static final By CHAT_LOG = By.id("chat-log");
    private static final By PAGE_HEADING = By.tagName("h1");

    @Test
    public void typesInsideFrames() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/frames.html");

        wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(OUTER_FRAME));
        driver.findElement(OUTER_INPUT).sendKeys("Asha Patel");

        wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(INNER_FRAME));
        String chatLog = driver.findElement(CHAT_LOG).getText();
        Assert.assertTrue(chatLog.contains("How can I help"), "Inner chat frame should show the agent greeting");

        driver.switchTo().parentFrame();
        Assert.assertEquals(driver.findElement(OUTER_INPUT).getDomProperty("value"), "Asha Patel");

        driver.switchTo().defaultContent();
        Assert.assertTrue(driver.findElement(PAGE_HEADING).isDisplayed());
    }
}
`,
  checks: [
    { label: 'Waits for and switches into a frame', pattern: 'frameToBeAvailableAndSwitchToIt\\s*\\(', hint: 'wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(OUTER_FRAME))' },
    { label: 'Switches into the nested frame', pattern: '(frameToBeAvailableAndSwitchToIt|switchTo\\(\\)\\.frame)\\s*\\(\\s*(INNER_FRAME|driver\\.findElement\\(\\s*INNER_FRAME)', hint: 'Then switch to INNER_FRAME from inside the outer one' },
    { label: 'Goes up one level with parentFrame()', pattern: 'switchTo\\(\\)\\s*\\.parentFrame\\s*\\(', hint: 'driver.switchTo().parentFrame()' },
    { label: 'Returns to the main page with defaultContent()', pattern: 'switchTo\\(\\)\\s*\\.defaultContent\\s*\\(', hint: 'driver.switchTo().defaultContent()' },
    { label: 'No frame indexes', pattern: '(frame\\s*\\(\\s*\\d+\\s*\\)|frameToBeAvailableAndSwitchToIt\\s*\\(\\s*\\d)', mustNot: true, hint: 'Indexes break when another iframe (ads, chat widget) is added' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'frameToBeAvailableAndSwitchToIt already waits' },
  ],
  explanation: `Each \`<iframe>\` hosts a **separate document**. The driver looks in exactly one document at a time, so locators that work in DevTools (which can search all frames) fail in Selenium until you switch.

- \`switchTo().frame(...)\` accepts an index, a name/id string, or a \`WebElement\`. Prefer the element/locator form — indexes change when marketing adds a chat widget.
- \`frameToBeAvailableAndSwitchToIt(locator)\` waits for the frame to load **and** switches — the idiomatic way.
- Frames nest: you can only enter the inner frame from the outer one.
- \`parentFrame()\` moves up one level; \`defaultContent()\` jumps back to the top page. Forgetting to switch back is the #1 cause of "element not found" in the *next* step.

In a Page Object framework, wrap frame switching inside the page/component method (\`supportWidget.enterName(...)\`) and always switch back in a \`finally\`, so callers never have to know frames exist.`,
  mistakes: [
    'Using driver.switchTo().frame(0) — breaks when another iframe is added before it.',
    'Trying to switch directly to the inner frame from the main page.',
    'Forgetting defaultContent(), so every following locator fails.',
    'Switching before the iframe is loaded — use frameToBeAvailableAndSwitchToIt.',
  ],
  interview: [
    { q: 'How do you know an element is inside a frame?', a: 'In DevTools, the element sits under an #document node of an <iframe>, and the console frame selector shows a different context. In Selenium, a locator that is correct but throws NoSuchElementException is a strong hint.' },
    { q: 'parentFrame() vs defaultContent()?', a: 'parentFrame() moves one level up to the frame containing the current one; defaultContent() goes straight back to the top-level document.' },
    { q: 'What exception if the frame does not exist?', a: 'NoSuchFrameException when switching by name/index; with the wait, a TimeoutException wrapping it.' },
  ],
}
