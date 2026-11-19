export default {
  id: 'fw-008',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'ITestListener: screenshot on failure',
  level: 'ADVANCED',
  tags: ['testng', 'listeners', 'screenshots', 'reporting'],
  estMinutes: 25,
  scenario: `The nightly run failed 7 tests at 3 a.m. The report says \`NoSuchElementException: #continue\` and nothing else.
Was the page blank? Was there an error popup? Was it the wrong page? Every manual tester knows a defect without a
screenshot gets bounced back. Your framework needs to attach evidence **automatically** for every failure.`,
  description: `Write \`TestListener implements ITestListener\`.

**Rules**
- \`onTestFailure(ITestResult result)\` takes a screenshot with \`TakesScreenshot\` / \`OutputType.FILE\` (or BYTES).
- Get the driver from \`DriverManager.getDriver()\` (thread-safe).
- Save it to \`target/screenshots/<ClassName>_<method>_<timestamp>.png\` using \`Files.copy\` / \`Files.write\`, creating the folder.
- Never let a screenshot problem throw out of the listener (catch and log).
- Also log start/pass/skip (\`onTestStart\`, \`onTestSuccess\`, \`onTestSkipped\`).
- Register via \`testng.xml\` \`<listeners>\` or \`@Listeners\`.`,
  starterCode: `package com.shopeasy.listeners;

import org.testng.ITestListener;
import org.testng.ITestResult;

public class TestListener {

    public void onTestFailure(ITestResult result) {
        // TODO: screenshot
    }
}
`,
  solution: `package com.shopeasy.listeners;

import com.shopeasy.core.DriverManager;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.ITestListener;
import org.testng.ITestResult;

public class TestListener implements ITestListener {

    private static final Logger log = LogManager.getLogger(TestListener.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS");

    @Override
    public void onTestStart(ITestResult result) {
        log.info("START  {}", name(result));
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        log.info("PASS   {}", name(result));
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        log.warn("SKIP   {}", name(result));
    }

    @Override
    public void onTestFailure(ITestResult result) {
        log.error("FAIL   {}", name(result), result.getThrowable());
        try {
            WebDriver driver = DriverManager.getDriver();
            File src = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            Path dir = Paths.get("target", "screenshots");
            Files.createDirectories(dir);
            Path target = dir.resolve(name(result).replace('.', '_') + "_" + LocalDateTime.now().format(TS) + ".png");
            Files.copy(src.toPath(), target, StandardCopyOption.REPLACE_EXISTING);
            result.setAttribute("screenshot", target.toAbsolutePath().toString());
            log.info("Screenshot saved: {}", target.toAbsolutePath());
        } catch (IOException | RuntimeException e) {
            log.warn("Could not capture screenshot for {}: {}", name(result), e.getMessage());
        }
    }

    private String name(ITestResult result) {
        return result.getTestClass().getRealClass().getSimpleName() + "." + result.getMethod().getMethodName();
    }
}

// testng.xml:
// <listeners><listener class-name="com.shopeasy.listeners.TestListener"/></listeners>
`,
  checks: [
    { label: 'Implements ITestListener', pattern: 'class\\s+TestListener\\s+implements\\s+ITestListener', hint: 'public class TestListener implements ITestListener' },
    { label: 'Overrides onTestFailure', pattern: 'void\\s+onTestFailure\\s*\\(\\s*ITestResult\\s+\\w+\\s*\\)\\s*\\{[\\s\\S]*?TakesScreenshot', hint: 'Cast the driver to TakesScreenshot inside onTestFailure' },
    { label: 'Uses OutputType', pattern: 'getScreenshotAs\\s*\\(\\s*OutputType\\.(FILE|BYTES|BASE64)\\s*\\)', hint: '((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE)' },
    { label: 'Thread-safe driver access', pattern: 'DriverManager\\.getDriver\\s*\\(\\s*\\)', hint: 'Use DriverManager.getDriver(), not a static field' },
    { label: 'File named after the test method', pattern: 'getMethod\\s*\\(\\s*\\)\\s*\\.getMethodName|getName\\s*\\(\\s*\\)', hint: 'result.getMethod().getMethodName()' },
    { label: 'Saves the file and creates the folder', pattern: 'Files\\.(createDirectories|copy|write)[\\s\\S]*Files\\.(copy|write|createDirectories)', hint: 'Files.createDirectories(dir); Files.copy(src.toPath(), target);' },
    { label: 'Screenshot errors are caught', pattern: 'catch\\s*\\(\\s*[\\w|\\s]*(Exception)', hint: 'Wrap in try/catch so the listener never breaks the run' },
  ],
  hints: [
    'Cast: ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE).',
    'result.getMethod().getMethodName() and result.getTestClass().getRealClass().getSimpleName() build a good file name.',
    'Listeners run on the same thread as the failing test, so DriverManager.getDriver() returns the right browser.',
  ],
  explanation: `**Listeners** are TestNG's hooks into the run: \`ITestListener\` (per test events), \`ISuiteListener\`
(suite start/finish), \`IRetryAnalyzer\` (fw-009), \`IReporter\`… They keep cross-cutting concerns (evidence,
logging, reporting) out of tests and BaseTest.

Why this works in parallel: TestNG calls \`onTestFailure\` on the **same thread** that ran the test, so the
ThreadLocal driver is the failing browser. That is also why \`@AfterMethod\` must not quit the driver *before* the
listener runs — TestNG calls \`onTestFailure\` before \`@AfterMethod\`, so the order is correct by default.

Production touches:
- Timestamp in the file name → no overwrites across retries or data-provider rows.
- \`result.setAttribute("screenshot", path)\` → reporters (Extent/Allure, fw-010) can embed it.
- Catch everything: a missing driver (setup failed) must not hide the real failure.
- Register once in \`testng.xml\` rather than \`@Listeners\` on every class.`,
  mistakes: [
    'Quitting the driver in @AfterMethod before taking the screenshot (when screenshots are taken in teardown instead of the listener).',
    'Using a static driver in the listener, which captures the wrong browser in parallel runs.',
    'Fixed file names that overwrite each other.',
    'Letting an exception escape from the listener and confusing the report.',
  ],
  interview: [
    { q: 'How do you capture screenshots on failure?', a: 'Implement ITestListener.onTestFailure, get the thread-local driver, cast it to TakesScreenshot, save the file with the class/method name and timestamp, and attach it to the report. Register the listener in testng.xml.' },
    { q: 'What listeners have you used in TestNG?', a: 'ITestListener for screenshots and logging, ISuiteListener for report setup/flush, IRetryAnalyzer with IAnnotationTransformer for retries, and IReporter or reporting libraries like Extent/Allure for custom reports.' },
  ],
}
