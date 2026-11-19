export default {
  id: 'sel-028',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Control the window size and check the responsive product grid',
  level: 'INTERMEDIATE',
  tags: ['window', 'Dimension', 'getRect', 'responsive', 'layout'],
  estMinutes: 20,
  scenario: `UX ticket UX-102: "On tablets the products page squeezes three cards into a row and the prices overlap." The fix makes the grid show 3 cards per row on a desktop and 2 on a tablet-width window. Today the suite calls \`maximize()\`, which gives a different size on every agent (and nothing at all in headless mode), so nobody can say which layout the tests saw. Your lead wants fixed window sizes and an automated layout check.`,
  description: `After \`loginAsStandardUser()\` on \`inventory.html\` (cards are \`#inventory-list .inventory-item\`):

1. Set the window to **1280×900** with \`driver.manage().window().setSize(new Dimension(1280, 900))\` and move it to the top-left with \`setPosition(new Point(0, 0))\`.
2. Assert \`getSize()\` reports width 1280.
3. Write \`int cardsInFirstRow()\`: take the \`getRect().getY()\` of the first card and count how many cards share that Y. Assert **3** at 1280 wide.
4. Resize to **700×900** and wait (lambda on the driver) until \`cardsInFirstRow()\` is **2**.
5. Also assert that, at 700 wide, the 3rd card starts **below** the 1st card (\`getRect().getY()\` bigger).
6. Log the real viewport width with \`executeScript("return window.innerWidth;")\` — it is smaller than the window width.

**Rules**: no \`maximize()\`; no \`Thread.sleep\`; compare positions, not pixels of screenshots.`,
  hints: [
    'import org.openqa.selenium.Dimension; import org.openqa.selenium.Point;',
    'WebElement.getRect() gives x, y, width and height in one call.',
    'wait.until(d -> cardsInFirstRow() == 2) — the layout reflows after the resize.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.List;

public class ResponsiveGridTest extends BaseTest {

    private static final By CARDS = By.cssSelector("#inventory-list .inventory-item");

    @Test
    public void gridAdaptsToWindowWidth() {
        driver.manage().window().maximize(); // different size on every agent
        loginAsStandardUser();
        List<WebElement> cards = driver.findElements(CARDS);
        Assert.assertEquals(cards.size(), 6);
        // TODO: fixed sizes and a cards-per-row check
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Point;
import org.openqa.selenium.Rectangle;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.List;

public class ResponsiveGridTest extends BaseTest {

    private static final By CARDS = By.cssSelector("#inventory-list .inventory-item");

    @Test
    public void gridAdaptsToWindowWidth() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.manage().window().setPosition(new Point(0, 0));
        driver.manage().window().setSize(new Dimension(1280, 900));
        Assert.assertEquals(driver.manage().window().getSize().getWidth(), 1280, "Window width");

        loginAsStandardUser();
        Assert.assertEquals(cardsInFirstRow(), 3, "Desktop layout should show 3 cards per row");

        driver.manage().window().setSize(new Dimension(700, 900));
        wait.until(d -> cardsInFirstRow() == 2);

        List<WebElement> cards = driver.findElements(CARDS);
        Rectangle first = cards.get(0).getRect();
        Rectangle third = cards.get(2).getRect();
        Assert.assertTrue(third.getY() > first.getY(),
                "At 700px the 3rd card should wrap to the next row, first=" + first.getY() + " third=" + third.getY());

        Long viewport = (Long) ((JavascriptExecutor) driver).executeScript("return window.innerWidth;");
        System.out.println("Window 700px wide, viewport " + viewport + "px");
    }

    /** Number of cards whose top edge is on the same line as the first card. */
    private int cardsInFirstRow() {
        List<WebElement> cards = driver.findElements(CARDS);
        int firstRowY = cards.get(0).getRect().getY();
        int count = 0;
        for (WebElement card : cards) {
            if (card.getRect().getY() == firstRowY) {
                count++;
            }
        }
        return count;
    }
}
`,
  checks: [
    { label: 'Sets an explicit window size', pattern: '\\.setSize\\s*\\(\\s*new\\s+Dimension\\s*\\(', hint: 'driver.manage().window().setSize(new Dimension(1280, 900))' },
    { label: 'Sets the window position', pattern: '\\.setPosition\\s*\\(\\s*new\\s+Point\\s*\\(', hint: 'driver.manage().window().setPosition(new Point(0, 0))' },
    { label: 'Reads the window size back', pattern: '\\.getSize\\s*\\(\\s*\\)', hint: 'driver.manage().window().getSize().getWidth()' },
    { label: 'Compares element positions', pattern: '\\.(getRect|getLocation)\\s*\\(\\s*\\)\\s*\\.(getY|getX|y|x)', hint: 'card.getRect().getY()' },
    { label: 'Waits for the reflow', pattern: 'until\\s*\\(\\s*\\(?\\s*\\w+\\s*\\)?\\s*->', hint: 'wait.until(d -> cardsInFirstRow() == 2)' },
    { label: 'No maximize()', pattern: '\\.maximize\\s*\\(', mustNot: true, hint: 'maximize gives a different size on every machine' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for the layout condition' },
  ],
  explanation: `**Window control** lives under \`driver.manage().window()\`: \`setSize(new Dimension(w, h))\`, \`setPosition(new Point(x, y))\`, \`getSize()\`, \`getPosition()\`, \`maximize()\`, \`minimize()\`, \`fullscreen()\`. \`maximize()\` depends on the agent's screen (and does nothing useful headless), so fixed sizes make layouts reproducible. Headless runs should get the same size through \`--window-size=1280,900\`.

**Window ≠ viewport**: \`setSize\` sets the *outer* window including borders, toolbar and scrollbar. CSS breakpoints react to the viewport (\`window.innerWidth\`), which is smaller — that is why the test logs it. When a breakpoint is close to your chosen size, pick a size comfortably inside the range.

**Layout assertions with geometry**: \`getRect()\` returns x, y, width and height. "Cards in the first row" = cards whose top edge equals the first card's. That checks the *behaviour* (3 vs 2 columns) without brittle pixel values or screenshot comparison.

**Reflow takes a moment**: after a resize the browser re-lays out the page. A lambda wait (\`d -> cardsInFirstRow() == 2\`) re-measures until the layout is stable — no sleep.

Desktop browsers have a minimum window width (around 500px for Chrome), so true phone widths need **mobile emulation** (\`ChromeOptions.setExperimentalOption("mobileEmulation", Map.of("deviceName", "Pixel 7"))\`) or a real device cloud.`,
  mistakes: [
    'Using maximize() and assuming every agent has the same screen — layouts differ between laptop, Jenkins and headless.',
    'Expecting setSize(375, 812) to give a phone layout on desktop Chrome — the window has a minimum width; use mobile emulation.',
    'Asserting exact pixel coordinates (y == 214) — fonts and OS differences move them. Compare elements to each other.',
    'Measuring immediately after setSize without waiting for the reflow.',
  ],
  interview: [
    { q: 'How do you test responsive behaviour with Selenium?', a: 'Set fixed window sizes per breakpoint (or use Chrome mobile emulation for phone sizes), then assert layout behaviour by comparing element positions and visibility (getRect, isDisplayed), e.g. menu collapsed into a burger button, cards per row.' },
    { q: 'Why is maximize() a bad idea on CI?', a: 'It depends on the screen of the machine; headless browsers have no screen, so the window keeps its default (often 800x600). Results differ per agent. Set an explicit size instead.' },
    { q: 'What is the page load strategy and when would you change it?', a: 'It decides when get() returns: normal waits for the load event (default), eager returns at DOMContentLoaded (images and iframes may still load), none returns immediately. Set it with options.setPageLoadStrategy(PageLoadStrategy.EAGER) for heavy pages with slow third-party assets — but then explicit waits matter even more.' },
  ],
}
