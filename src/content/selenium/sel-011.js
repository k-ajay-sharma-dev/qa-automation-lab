export default {
  id: 'sel-011',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Switch between tabs and windows (and open one with Selenium 4)',
  level: 'INTERMEDIATE',
  tags: ['windows', 'tabs', 'getWindowHandles', 'newWindow'],
  estMinutes: 20,
  scenario: `"Terms & Conditions" and "Track my parcel" open in a new tab. The regression test clicks the link and then asserts the new page heading — but Selenium keeps looking at the old tab and fails. A second request from the PO: verify the product page and the help centre side by side in one session, which Selenium 4's \`newWindow\` makes easy. \`windows.html\` has a "new tab" link (the size guide) and a "chat pop-up" button.`,
  description: `On \`http://localhost:5180/practice-site/windows.html\`:

1. Save the original handle with \`getWindowHandle()\`.
2. Click **Open size guide in new tab** (\`#new-tab-link\`), wait until there are **2 windows** (\`numberOfWindowsToBe(2)\`).
3. Loop over \`getWindowHandles()\`, switch to the handle that is **not** the original, assert the new title (\`ShopEasy — Size Guide\`) / URL (\`new-window.html\`).
4. \`close()\` the new tab and switch back to the original; assert you are back.
5. Selenium 4: open a fresh tab with \`driver.switchTo().newWindow(WindowType.TAB)\`, \`get\` the inventory page there, assert, close it, switch back.

**Rules**: never assume handle order (\`new ArrayList<>(handles).get(1)\` is fragile); no \`Thread.sleep\`.`,
  hints: [
    'String original = driver.getWindowHandle();',
    'for (String h : driver.getWindowHandles()) if (!h.equals(original)) driver.switchTo().window(h);',
    'After close() the driver is pointed at nothing — switchTo().window(original) right away.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WindowType;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.ArrayList;
import java.util.List;

public class WindowsTest extends BaseTest {

    private static final By NEW_TAB_LINK = By.id("new-tab-link");

    @Test
    public void handlesNewTab() {
        driver.get("http://localhost:5180/practice-site/windows.html");
        driver.findElement(NEW_TAB_LINK).click();
        List<String> handles = new ArrayList<>(driver.getWindowHandles());
        driver.switchTo().window(handles.get(1)); // order is not guaranteed
        // TODO
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WindowType;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class WindowsTest extends BaseTest {

    private static final By NEW_TAB_LINK = By.id("new-tab-link");
    private static final String INVENTORY = "http://localhost:5180/practice-site/inventory.html";

    @Test
    public void handlesNewTab() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/windows.html");
        String original = driver.getWindowHandle();

        driver.findElement(NEW_TAB_LINK).click();
        wait.until(ExpectedConditions.numberOfWindowsToBe(2));

        for (String handle : driver.getWindowHandles()) {
            if (!handle.equals(original)) {
                driver.switchTo().window(handle);
                break;
            }
        }
        wait.until(ExpectedConditions.titleIs("ShopEasy — Size Guide"));
        Assert.assertNotEquals(driver.getWindowHandle(), original);
        Assert.assertTrue(driver.getCurrentUrl().contains("new-window.html"));
        System.out.println("New tab: " + driver.getTitle() + " | " + driver.getCurrentUrl());

        driver.close();
        driver.switchTo().window(original);
        Assert.assertTrue(driver.getCurrentUrl().contains("windows.html"));

        // Selenium 4: open and switch to a brand-new tab in one call
        driver.switchTo().newWindow(WindowType.TAB);
        driver.get(INVENTORY);
        Assert.assertTrue(driver.getCurrentUrl().contains("inventory.html"));
        driver.close();
        driver.switchTo().window(original);
        Assert.assertEquals(driver.getWindowHandles().size(), 1);
    }
}
`,
  checks: [
    { label: 'Stores the original handle', pattern: 'String\\s+\\w+\\s*=\\s*driver\\.getWindowHandle\\s*\\(\\s*\\)', hint: 'String original = driver.getWindowHandle();' },
    { label: 'Waits for the new window', pattern: 'numberOfWindowsToBe\\s*\\(\\s*2\\s*\\)|getWindowHandles\\(\\)\\.size\\(\\)\\s*(==|>)', hint: 'wait.until(ExpectedConditions.numberOfWindowsToBe(2))' },
    { label: 'Finds the new handle by comparing with the original', pattern: '!\\s*\\w+\\.equals\\s*\\(\\s*original\\s*\\)|!\\s*original\\.equals\\s*\\(', hint: 'if (!handle.equals(original))' },
    { label: 'Switches back to the original window', pattern: 'switchTo\\(\\)\\s*\\.window\\s*\\(\\s*original\\s*\\)', hint: 'driver.switchTo().window(original)' },
    { label: 'Uses Selenium 4 newWindow', pattern: 'newWindow\\s*\\(\\s*WindowType\\.(TAB|WINDOW)\\s*\\)', hint: 'driver.switchTo().newWindow(WindowType.TAB)' },
    { label: 'Does not rely on handle order', pattern: '\\.get\\s*\\(\\s*1\\s*\\)', mustNot: true, hint: 'getWindowHandles() is a Set; its order is not guaranteed' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Use numberOfWindowsToBe' },
  ],
  explanation: `Every tab/window has a unique **handle** string. \`getWindowHandle()\` returns the current one; \`getWindowHandles()\` returns a \`Set\` of all of them — the spec does not guarantee order, so "take index 1" works until it doesn't. The robust pattern is *save original → wait for count → pick the handle that isn't the original*.

Clicking a link that opens a new tab does **not** move the driver's focus. You switch explicitly with \`switchTo().window(handle)\`. After \`close()\` you must switch again, otherwise the next call throws \`NoSuchWindowException\`.

Selenium 4 added \`switchTo().newWindow(WindowType.TAB | WINDOW)\`, which opens a blank tab **and** switches to it — useful for comparing two pages or simulating two sessions of the same user.

In a framework, a helper like \`switchToNewWindow(String original)\` keeps tests readable.`,
  mistakes: [
    'Using new ArrayList<>(handles).get(1) and getting the original tab on some runs.',
    'Checking getWindowHandles() immediately after click — the new tab may not exist yet.',
    'Calling close() and then using the driver without switching back.',
    'Calling quit() to close a tab, which kills the whole session.',
  ],
  interview: [
    { q: 'How do you switch to a new tab?', a: 'Save the current handle, trigger the new tab, wait for numberOfWindowsToBe(n), iterate getWindowHandles() and switch to the handle not equal to the original.' },
    { q: 'What did Selenium 4 add for windows?', a: 'driver.switchTo().newWindow(WindowType.TAB or WINDOW) to open and focus a new tab/window, plus window management such as getRect/setRect improvements.' },
    { q: 'Why is getWindowHandles a Set?', a: 'Handles are unique and the order is not defined by the WebDriver spec, so a Set models it; you must not rely on iteration order.' },
  ],
}
