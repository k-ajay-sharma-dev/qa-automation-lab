export default {
  id: 'sel-014',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Headless Chrome on Jenkins with a screenshot on every failure',
  level: 'INTERMEDIATE',
  tags: ['headless', 'ChromeOptions', 'screenshots', 'ci'],
  estMinutes: 25,
  scenario: `The suite is moving to a Linux Jenkins agent with no display. The first run: 14 failures, zero evidence — just stack traces. Your lead's acceptance criteria for the CI ticket: (1) Chrome runs headless with a fixed 1920×1080 window so layouts match desktop, (2) every failed test saves a full-page-viewport screenshot named after the test, plus an element screenshot of the error banner when there is one.`,
  description: `Write a \`BaseTest\` that:

1. Builds \`ChromeOptions\` with \`--headless=new\`, \`--window-size=1920,1080\`, and (for Linux containers) \`--no-sandbox\` / \`--disable-dev-shm-usage\`. Make headless switchable with a system property: \`-Dheadless=true\`.
2. Creates \`new ChromeDriver(options)\` in \`@BeforeMethod\`.
3. In \`@AfterMethod(alwaysRun = true)\` takes \`ITestResult result\`; if \`result.getStatus() == ITestResult.FAILURE\`, captures \`((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE)\` and copies it to \`target/screenshots/<testName>.png\`.
4. Also captures an **element screenshot** (\`errorBanner.getScreenshotAs(...)\`) if an error banner (\`.error-banner\` — \`#login-error\` on login, \`#checkout-error\` on checkout) is displayed.
5. Quits the driver afterwards.

**Rules**: use \`java.nio.file.Files\` to copy, create the folder if missing; quit must run even if the screenshot fails.`,
  hints: [
    'ChromeOptions options = new ChromeOptions(); options.addArguments("--headless=new", "--window-size=1920,1080");',
    'File src = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE); Files.copy(src.toPath(), target, REPLACE_EXISTING);',
    'Selenium 4: WebElement also implements getScreenshotAs for element-only images.',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseTest {

    protected WebDriver driver;

    @BeforeMethod
    public void setUp() {
        driver = new ChromeDriver(); // opens a visible window: fails on a display-less agent
    }

    @AfterMethod
    public void tearDown(ITestResult result) {
        // TODO: screenshot on failure
        driver.quit();
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;

public abstract class BaseTest {

    private static final By ERROR_BANNER = By.cssSelector(".error-banner"); // #login-error / #checkout-error
    private static final Path SCREENSHOT_DIR = Paths.get("target", "screenshots");

    protected WebDriver driver;

    @BeforeMethod
    public void setUp() {
        ChromeOptions options = new ChromeOptions();
        if (Boolean.parseBoolean(System.getProperty("headless", "false"))) {
            options.addArguments("--headless=new");
        }
        options.addArguments("--window-size=1920,1080", "--no-sandbox", "--disable-dev-shm-usage");
        driver = new ChromeDriver(options);
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown(ITestResult result) {
        try {
            if (result.getStatus() == ITestResult.FAILURE && driver != null) {
                saveScreenshots(result.getMethod().getMethodName());
            }
        } finally {
            if (driver != null) {
                driver.quit();
            }
        }
    }

    private void saveScreenshots(String testName) {
        try {
            Files.createDirectories(SCREENSHOT_DIR);
            File page = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            Files.copy(page.toPath(), SCREENSHOT_DIR.resolve(testName + ".png"),
                    StandardCopyOption.REPLACE_EXISTING);

            List<WebElement> banners = driver.findElements(ERROR_BANNER);
            if (!banners.isEmpty() && banners.get(0).isDisplayed()) {
                File element = banners.get(0).getScreenshotAs(OutputType.FILE);
                Files.copy(element.toPath(), SCREENSHOT_DIR.resolve(testName + "-error.png"),
                        StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException | RuntimeException e) {
            System.err.println("Could not save screenshot for " + testName + ": " + e.getMessage());
        }
    }
}
`,
  checks: [
    { label: 'Creates ChromeOptions and passes them to the driver', pattern: 'new\\s+ChromeDriver\\s*\\(\\s*\\w+\\s*\\)', hint: 'driver = new ChromeDriver(options);' },
    { label: 'Uses the new headless mode', pattern: '"--headless=new"', hint: 'options.addArguments("--headless=new")' },
    { label: 'Sets a fixed window size', pattern: '--window-size=\\d+,\\d+', hint: '"--window-size=1920,1080"' },
    { label: 'Captures a page screenshot with TakesScreenshot', pattern: '\\(\\s*TakesScreenshot\\s*\\)\\s*driver\\s*\\)\\s*\\.getScreenshotAs\\s*\\(\\s*OutputType\\.(FILE|BYTES|BASE64)', hint: '((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE)' },
    { label: 'Only on failure', pattern: 'ITestResult\\.FAILURE|!\\s*result\\.isSuccess\\s*\\(', hint: 'if (result.getStatus() == ITestResult.FAILURE)' },
    { label: 'Takes an element screenshot', pattern: '\\w+(\\.get\\(0\\))?\\.getScreenshotAs\\s*\\(\\s*OutputType', hint: 'element.getScreenshotAs(OutputType.FILE)' },
    { label: 'Quits in a finally block', pattern: 'finally\\s*\\{[\\s\\S]*?\\.quit\\s*\\(', hint: 'Screenshot failure must not leak the browser' },
  ],
  explanation: `**Headless**: Chrome 109+ has a "new" headless mode (\`--headless=new\`) that runs the *real* browser without a window — much closer to headed behaviour than the old \`--headless\` implementation. Always set \`--window-size\`: the default headless viewport is 800×600, which triggers mobile layouts, hides hover menus and causes "element not interactable" failures that never happen locally. \`--no-sandbox\` and \`--disable-dev-shm-usage\` avoid crashes in Docker/Linux agents with a tiny \`/dev/shm\`. Driving it from \`-Dheadless=true\` lets the same code run headed on your laptop and headless in Jenkins.

**Screenshots**: the driver implements \`TakesScreenshot\`; \`getScreenshotAs(OutputType.FILE)\` writes a temp PNG that you copy somewhere persistent (\`BYTES\`/\`BASE64\` are handy for Allure/Extent attachments). In Selenium 4 every \`WebElement\` can screenshot itself, which gives reviewers a crisp image of just the error banner.

**Teardown order**: screenshot first (the browser must still be open), then \`quit()\` in a \`finally\` so a screenshot problem never leaks a browser. In Cucumber the same logic lives in an \`@After\` hook with \`scenario.isFailed()\` and \`scenario.attach(bytes, "image/png", name)\`.`,
  mistakes: [
    'Taking the screenshot after driver.quit() — NoSuchSessionException.',
    'No --window-size in headless, so the app renders its 800px mobile layout.',
    'Saving every screenshot as screenshot.png, overwriting evidence from other tests.',
    'Letting an IOException in screenshot code skip quit() and leak Chrome processes.',
  ],
  interview: [
    { q: 'How do you run Chrome headless in Selenium 4?', a: 'ChromeOptions.addArguments("--headless=new"), plus a fixed --window-size. The old setHeadless(true) method was removed in Selenium 4.' },
    { q: 'How do you capture a screenshot on failure?', a: 'In a TestNG @AfterMethod (with ITestResult) or listener onTestFailure, or a Cucumber @After hook with scenario.isFailed(), cast the driver to TakesScreenshot and save or attach the image before quitting.' },
    { q: 'Can you screenshot a single element?', a: 'Yes, since Selenium 4 WebElement has getScreenshotAs(OutputType), returning an image cropped to the element.' },
  ],
}
