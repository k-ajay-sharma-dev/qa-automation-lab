export default {
  id: 'dbg-001',
  category: 'debugging',
  kind: 'code',
  title: 'NoSuchElementException: the inventory loads after the test looks',
  level: 'BEGINNER',
  tags: ['NoSuchElementException', 'waits', 'timing', 'jenkins'],
  estMinutes: 15,
  scenario: `Monday stand-up. The nightly **ShopEasy regression** job is red: \`InventoryTest.addBackpackToCart\` failed on Jenkins but "works on my machine" for the developer who wrote it. Last sprint the front-end team changed the inventory page so products are **fetched from an API after the page shell loads** (about 1–2 seconds later). Your lead pings you: *"Can you look at it before the 11 o'clock release call?"*`,
  description: `Here is what Jenkins printed:

\`\`\`text
[INFO] Running com.shopeasy.tests.InventoryTest
[ERROR] Tests run: 1, Failures: 0, Errors: 1, Skipped: 0, Time elapsed: 4.312 s <<< FAILURE! - in com.shopeasy.tests.InventoryTest
[ERROR] addBackpackToCart(com.shopeasy.tests.InventoryTest)  Time elapsed: 2.87 s  <<< ERROR!
org.openqa.selenium.NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#add-to-cart-trailblazer-backpack"}
  (Session info: chrome=126.0.6478.126)
For documentation on this error, please visit: https://www.selenium.dev/documentation/webdriver/troubleshooting/errors#no-such-element-exception
Build info: version: '4.21.0', revision: '79ed462ef4'
System info: os.name: 'Linux', os.arch: 'amd64', os.version: '5.15.0-1057-azure', java.version: '17.0.11'
Driver info: org.openqa.selenium.chrome.ChromeDriver
Command: [8f2c41e0b7d1..., findElement {using=css selector, value=#add-to-cart-trailblazer-backpack}]
	at org.openqa.selenium.remote.RemoteWebDriver.findElement(RemoteWebDriver.java:353)
	at com.shopeasy.pages.InventoryPage.addBackpackToCart(InventoryPage.java:27)
	at com.shopeasy.tests.InventoryTest.addBackpackToCart(InventoryTest.java:22)
\`\`\`

**Diagnose:** the locator is correct (you checked it in DevTools — it matches 1 element once the page has finished loading). The failure is *timing*: \`findElement\` runs before the product cards are rendered.

**Fix \`InventoryPage\`:**
- Wait explicitly (\`WebDriverWait\`, 10 seconds) until the button is clickable, then click it.
- Also wait for the cart badge to show before \`getCartCount()\` reads it.
- **Rules:** no \`Thread.sleep\`, keep the locators as private \`By\` fields.`,
  hints: [
    'Read the stack trace bottom-up: the first line in YOUR package (com.shopeasy.pages.InventoryPage:27) is where it broke.',
    'An element that exists "a bit later" is solved by an explicit wait, not by a different locator.',
    'wait.until(ExpectedConditions.elementToBeClickable(ADD_BACKPACK)).click();',
  ],
  language: 'java',
  starterCode: String.raw`package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class InventoryPage {

    private final WebDriver driver;

    private final By ADD_BACKPACK = By.cssSelector("#add-to-cart-trailblazer-backpack");
    private final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    public InventoryPage(WebDriver driver) {
        this.driver = driver;
    }

    public void addBackpackToCart() {
        // line 27 - fails on Jenkins with NoSuchElementException
        driver.findElement(ADD_BACKPACK).click();
    }

    public int getCartCount() {
        return Integer.parseInt(driver.findElement(CART_BADGE).getText());
    }
}
`,
  solution: String.raw`package com.shopeasy.pages;

import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class InventoryPage {

    private final WebDriver driver;
    private final WebDriverWait wait;

    private final By ADD_BACKPACK = By.cssSelector("#add-to-cart-trailblazer-backpack");
    private final By CART_BADGE = By.cssSelector(".shopping-cart-badge");

    public InventoryPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void addBackpackToCart() {
        // products are rendered after an API call - wait until the button can really be clicked
        wait.until(ExpectedConditions.elementToBeClickable(ADD_BACKPACK)).click();
    }

    public int getCartCount() {
        String badge = wait.until(ExpectedConditions.visibilityOfElementLocated(CART_BADGE)).getText();
        return Integer.parseInt(badge.trim());
    }
}
`,
  checks: [
    { label: 'Creates a WebDriverWait', pattern: 'new\\s+WebDriverWait\\s*\\(', hint: 'new WebDriverWait(driver, Duration.ofSeconds(10))' },
    { label: 'Uses a Duration-based timeout (Selenium 4)', pattern: 'Duration\\.of(Seconds|Millis)\\s*\\(', hint: 'Selenium 4 takes a Duration, not a long' },
    { label: 'Waits for the button to be clickable/visible before clicking', pattern: 'ExpectedConditions\\.(elementToBeClickable|visibilityOfElementLocated)\\s*\\(\\s*ADD_BACKPACK', hint: 'wait.until(ExpectedConditions.elementToBeClickable(ADD_BACKPACK))' },
    { label: 'Waits for the cart badge too', pattern: 'ExpectedConditions\\.\\w+\\s*\\(\\s*CART_BADGE', hint: 'The badge also appears asynchronously — wait for it' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'A hard sleep is either too short on Jenkins or wastes time locally' },
  ],
  explanation: `**Root cause:** the page shell (header, filters) loads instantly, but the product cards come from an API call. On a developer laptop the API answers in 200 ms, so \`findElement\` happens to win the race. On the shared Jenkins agent the API takes 1.5 s, so the element simply does not exist yet → \`NoSuchElementException\`.

**How to read the trace like a senior:**
1. The exception type tells you the *category*: "no such element" = the locator found nothing **at that instant**.
2. Skip the \`org.openqa.selenium.remote...\` frames; the first frame in *your* package (\`InventoryPage.java:27\`) is where to look.
3. Then ask: is the locator wrong, is the element inside a frame/another window, or is it just not there *yet*? Check the locator in DevTools on the loaded page — if it matches, it's timing.

**Why an explicit wait:** \`WebDriverWait\` polls every 500 ms and returns as soon as the condition is true, so it is fast locally *and* patient on Jenkins. \`Thread.sleep(3000)\` is wrong both ways — wasted 3 s on every run, and still flaky the day the API takes 3.1 s.

A reviewer also looks for: the wait created once in the constructor, a sensible timeout (10 s, not 60 s), and the badge read also guarded.`,
  mistakes: [
    'Changing the locator to an absolute XPath because "the CSS one didn\'t work" — the locator was never the problem.',
    'Adding Thread.sleep(5000) to get the build green before the release call.',
    'Raising the implicit wait to 30 seconds globally — it hides the problem and slows every negative check.',
    'Wrapping the click in try/catch and retrying in a loop without a timeout.',
  ],
  interview: [
    { q: 'A test passes locally but fails on Jenkins with NoSuchElementException. How do you approach it?', a: 'First I check the stack trace for the first frame in our code and the locator in the message. I open the page and verify the locator in DevTools — if it matches once the page is loaded, it is a synchronization problem, which is common on slower CI agents. I fix it with an explicit wait on the right condition rather than a sleep, then rerun the job a few times to confirm it is stable.' },
    { q: 'Why not just use Thread.sleep?', a: 'Thread.sleep always waits the full time even if the element is ready in 100 ms, so it slows the suite, and it is still flaky when the app takes longer than the sleep. An explicit wait polls and continues as soon as the condition is met, with a clear timeout error when it is not.' },
    { q: 'Which ExpectedCondition would you pick before a click?', a: 'elementToBeClickable, because it checks that the element is visible and enabled. For reading text I use visibilityOfElementLocated; presenceOfElementLocated only means the node is in the DOM, which is not enough for interaction.' },
  ],
}
