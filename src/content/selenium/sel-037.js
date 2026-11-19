export default {
  id: 'sel-037',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Element screenshot: capture one product card as evidence',
  level: 'ADVANCED',
  tags: ['screenshots', 'TakesScreenshot', 'OutputType', 'evidence', 'selenium4'],
  estMinutes: 20,
  scenario: `The design team keeps reporting that the **Trailblazer Backpack** card on \`inventory.html\` looks wrong after CSS changes (price wrapping under the button, emoji cut off). Full-page screenshots in the report are too big to compare by eye and change whenever any other product changes. Your lead asks for a test utility that saves a screenshot of **just that one card**, so it can be attached to the defect or fed into a visual-diff tool later.`,
  description: `Log in with \`loginAsStandardUser()\` and on \`inventory.html\`:

1. Locate the \`.inventory-item\` card whose name is **Trailblazer Backpack** (scope it to \`#inventory-list\`; do not use an index).
2. Scroll it into view, then take a screenshot of **that element only** with \`getScreenshotAs(OutputType.FILE)\` (Selenium 4 lets \`WebElement\` do this).
3. Copy it to \`target/screenshots/trailblazer-card.png\` using \`java.nio.file.Files\` (create the folder first).
4. Assert the file exists and is not empty.

**Rules**
- Element screenshot, not \`((TakesScreenshot) driver)\` for the full page.
- No \`Thread.sleep\`; wait for the card to be visible.`,
  hints: [
    'XPath: //div[@id="inventory-list"]//div[contains(@class,"inventory-item")][.//a[normalize-space()="Trailblazer Backpack"]]',
    'File shot = card.getScreenshotAs(OutputType.FILE);',
    'Files.createDirectories(dir); Files.copy(shot.toPath(), target, StandardCopyOption.REPLACE_EXISTING);',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.annotations.Test;

public class ProductCardScreenshotTest extends BaseTest {

    @Test
    public void captureTrailblazerCard() throws Exception {
        loginAsStandardUser();
        // TODO: find the Trailblazer Backpack card (no index)
        // TODO: screenshot just that card
        // TODO: save to target/screenshots/trailblazer-card.png and assert it exists
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;

public class ProductCardScreenshotTest extends BaseTest {

    private static final By TRAILBLAZER_CARD = By.xpath(
            "//div[@id='inventory-list']//div[contains(@class,'inventory-item')]"
          + "[.//a[normalize-space()='Trailblazer Backpack']]");

    @Test
    public void captureTrailblazerCard() throws Exception {
        loginAsStandardUser();

        WebElement card = new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.visibilityOfElementLocated(TRAILBLAZER_CARD));
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block: 'center'});", card);

        File shot = card.getScreenshotAs(OutputType.FILE);

        Path dir = Paths.get("target", "screenshots");
        Files.createDirectories(dir);
        Path target = dir.resolve("trailblazer-card.png");
        Files.copy(shot.toPath(), target, StandardCopyOption.REPLACE_EXISTING);

        Assert.assertTrue(Files.exists(target), "Screenshot was not written");
        Assert.assertTrue(Files.size(target) > 0, "Screenshot file is empty");
    }
}
`,
  checks: [
    { label: 'Finds the card by product name, not by index', pattern: 'Trailblazer Backpack', hint: 'Filter the .inventory-item by its name text' },
    { label: 'Takes an element screenshot', pattern: '(card|[a-z]\\w*)\\s*\\.getScreenshotAs\\s*\\(\\s*OutputType\\.(FILE|BYTES)', hint: 'card.getScreenshotAs(OutputType.FILE)' },
    { label: 'Does not take a full-page screenshot', pattern: '\\(\\s*TakesScreenshot\\s*\\)\\s*driver', mustNot: true, hint: 'Call getScreenshotAs on the WebElement, not on the driver' },
    { label: 'Creates the output folder', pattern: '(Files\\.createDirectories|mkdirs\\s*\\()', hint: 'Files.createDirectories(Paths.get("target", "screenshots"))' },
    { label: 'Writes the file with java.nio', pattern: 'Files\\.(copy|write)\\s*\\(', hint: 'Files.copy(shot.toPath(), target, StandardCopyOption.REPLACE_EXISTING)' },
    { label: 'Asserts the file exists / is not empty', pattern: 'assertTrue\\s*\\(\\s*Files\\.(exists|size)', hint: 'Assert.assertTrue(Files.exists(target))' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Wait for visibility instead' },
  ],
  explanation: `Since Selenium 4, \`WebElement\` implements \`TakesScreenshot\`, so \`card.getScreenshotAs(OutputType.FILE)\` captures only that element's bounding box. That makes the image stable (other products changing do not affect it) and small enough to attach to a defect or compare with a baseline.

The card locator filters by the product name inside the card — \`[.//a[normalize-space()='Trailblazer Backpack']]\` — instead of "first card", so sorting or new products cannot point the test at the wrong item.

\`getScreenshotAs\` returns a **temporary** file that is deleted when the JVM exits, which is why you copy it to \`target/screenshots\` (where Jenkins can archive it). \`REPLACE_EXISTING\` avoids \`FileAlreadyExistsException\` on re-runs. For a visual-diff tool, \`OutputType.BYTES\` lets you compare images in memory without touching disk.`,
  mistakes: [
    'Using ((TakesScreenshot) driver) and cropping manually — Selenium 4 already supports element screenshots.',
    'Keeping the temp file path in the report — it disappears when the JVM exits.',
    'Locating the card by index (inventory-item[1]); a sort change silently screenshots the wrong product.',
    'Forgetting REPLACE_EXISTING, so the second run fails with FileAlreadyExistsException.',
  ],
  interview: [
    { q: 'How do you take a screenshot of a single element?', a: 'In Selenium 4, call element.getScreenshotAs(OutputType.FILE/BYTES/BASE64) on the WebElement. In Selenium 3 you had to take a full screenshot and crop it with the element location and size.' },
    { q: 'Which OutputType do you use for Extent/Allure reports?', a: 'BASE64 or BYTES so the image can be embedded directly in the report; FILE when you want a separate artifact on disk that CI archives.' },
    { q: 'Why can element screenshots differ between machines?', a: 'Device pixel ratio, fonts, window size and headless rendering differ. For visual comparison fix the window size, run in the same container image and use a tolerance in the diff tool.' },
  ],
}
