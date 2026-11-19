export default {
  id: 'fw-010',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Reporting: ExtentReports listener (with Allure as the alternative)',
  level: 'ADVANCED',
  tags: ['reporting', 'extentreports', 'allure', 'listeners', 'threadlocal'],
  estMinutes: 30,
  scenario: `Your manager forwards the nightly result to the product owner every morning. The raw
\`target/surefire-reports\` HTML is unreadable for them. They want one HTML page: pass/fail per test, the error,
the browser, and the screenshot inline. The team chose **ExtentReports** for now (Allure is on the roadmap).`,
  description: `Write \`ExtentReportListener implements ITestListener\`.

**Rules**
- One \`ExtentReports\` per run: create it in \`onStart(ITestContext)\` with an \`ExtentSparkReporter("target/extent/report.html")\`, add system info (env, browser).
- One \`ExtentTest\` per test method stored in a \`ThreadLocal<ExtentTest>\` (parallel-safe).
- \`onTestSuccess\` → \`pass\`, \`onTestFailure\` → \`fail(throwable)\` + attach the screenshot (Base64), \`onTestSkipped\` → \`skip\`.
- \`flush()\` in \`onFinish\` — without it the report file is empty.`,
  starterCode: `package com.shopeasy.listeners;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.ExtentTest;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

public class ExtentReportListener implements ITestListener {

    private static ExtentTest test; // shared by all threads :(

    @Override
    public void onTestStart(ITestResult result) {
        // TODO
    }

    @Override
    public void onTestFailure(ITestResult result) {
        test.fail("failed");
    }
}
`,
  solution: `package com.shopeasy.listeners;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.ExtentTest;
import com.aventstack.extentreports.MediaEntityBuilder;
import com.aventstack.extentreports.reporter.ExtentSparkReporter;
import com.shopeasy.config.ConfigReader;
import com.shopeasy.core.DriverManager;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

public class ExtentReportListener implements ITestListener {

    private static ExtentReports extent;
    private static final ThreadLocal<ExtentTest> TEST = new ThreadLocal<>();

    @Override
    public synchronized void onStart(ITestContext context) {
        if (extent == null) {
            ExtentSparkReporter spark = new ExtentSparkReporter("target/extent/report.html");
            spark.config().setDocumentTitle("ShopEasy UI Tests");
            spark.config().setReportName(context.getSuite().getName());
            extent = new ExtentReports();
            extent.attachReporter(spark);
            extent.setSystemInfo("Environment", ConfigReader.env());
            extent.setSystemInfo("Browser", ConfigReader.browser());
        }
    }

    @Override
    public void onTestStart(ITestResult result) {
        ExtentTest test = extent.createTest(result.getMethod().getMethodName(),
                result.getMethod().getDescription());
        test.assignCategory(result.getMethod().getGroups());
        TEST.set(test);
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        TEST.get().pass("Test passed");
        TEST.remove();
    }

    @Override
    public void onTestFailure(ITestResult result) {
        ExtentTest test = TEST.get();
        test.fail(result.getThrowable());
        try {
            String base64 = ((TakesScreenshot) DriverManager.getDriver()).getScreenshotAs(OutputType.BASE64);
            test.fail("Screenshot at failure",
                    MediaEntityBuilder.createScreenCaptureFromBase64String(base64).build());
        } catch (RuntimeException e) {
            test.warning("Screenshot not available: " + e.getMessage());
        }
        TEST.remove();
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        ExtentTest test = TEST.get();
        if (test == null) {
            test = extent.createTest(result.getMethod().getMethodName());
        }
        test.skip(result.getThrowable() == null ? "Skipped" : result.getThrowable().getMessage());
        TEST.remove();
    }

    @Override
    public synchronized void onFinish(ITestContext context) {
        extent.flush();
    }
}
`,
  checks: [
    { label: 'Spark reporter attached', pattern: 'new\\s+ExtentSparkReporter\\s*\\([\\s\\S]*?attachReporter\\s*\\(', hint: 'extent.attachReporter(new ExtentSparkReporter("target/extent/report.html"))' },
    { label: 'ExtentTest stored per thread', pattern: 'ThreadLocal\\s*<\\s*ExtentTest\\s*>', hint: 'private static final ThreadLocal<ExtentTest> TEST = new ThreadLocal<>();' },
    { label: 'No shared static ExtentTest', pattern: 'static\\s+ExtentTest\\s+\\w+\\s*;', mustNot: true, hint: 'A static ExtentTest mixes logs of parallel tests' },
    { label: 'createTest in onTestStart', pattern: 'onTestStart[\\s\\S]*?createTest\\s*\\(', hint: 'extent.createTest(result.getMethod().getMethodName())' },
    { label: 'Failure logged with throwable', pattern: 'onTestFailure[\\s\\S]*?\\.fail\\s*\\(\\s*result\\.getThrowable\\s*\\(\\s*\\)', hint: 'test.fail(result.getThrowable())' },
    { label: 'Screenshot embedded', pattern: '(createScreenCaptureFromBase64String|addScreenCaptureFromBase64String|addScreenCaptureFromPath)', hint: 'MediaEntityBuilder.createScreenCaptureFromBase64String(base64).build()' },
    { label: 'Report flushed at the end', pattern: 'onFinish[\\s\\S]*?\\.flush\\s*\\(\\s*\\)', hint: 'extent.flush() in onFinish' },
  ],
  hints: [
    'ExtentReports (the whole report) is shared; ExtentTest (one row) must be per thread.',
    'Base64 screenshots make the HTML self-contained, so it can be emailed or archived.',
    'Without flush() nothing is written to disk.',
  ],
  explanation: `**Two objects, two lifetimes:** \`ExtentReports\` = the report file (one per run, shared),
\`ExtentTest\` = one test's node (one per test, per thread). Storing \`ExtentTest\` in a static field is the #1 Extent bug in
parallel runs: logs of test A end up under test B.

Base64 screenshots embed the image in the HTML → one file to email/archive. File-path screenshots make the report
lighter but break when the folder is moved.

**Allure** (the alternative): add \`io.qameta.allure:allure-testng\` (and the AspectJ agent in Surefire's argLine);
results go to \`target/allure-results\`, and \`allure serve\` / the Jenkins Allure plugin renders history, trends,
retries and categories. Steps come from \`@Step("Login as {user}")\` on page methods, attachments from
\`Allure.addAttachment(...)\` or \`@Attachment\`. Rule of thumb: Extent = simple self-contained HTML; Allure = richer
history/trend reporting for CI.

With Cucumber you would use the \`extentreports-cucumber7-adapter\` or \`allure-cucumber7-jvm\` plugin instead of a TestNG listener.`,
  mistakes: [
    'Forgetting extent.flush(), producing an empty report.',
    'A static ExtentTest shared between threads.',
    'Creating a new ExtentReports in each test class, so only the last class survives in the HTML.',
    'Screenshots referenced by absolute laptop paths that do not exist on CI.',
  ],
  interview: [
    { q: 'Which reporting tools have you used?', a: 'ExtentReports for a self-contained HTML report driven by a TestNG listener with ThreadLocal ExtentTest nodes and Base64 screenshots; Allure for CI with trends, history and @Step annotations. TestNG/Surefire XML results are still published for Jenkins test trend graphs.' },
    { q: 'How do you make reporting thread-safe?', a: 'Keep one shared report instance created once, and store per-test report nodes in a ThreadLocal set in onTestStart and removed when the test finishes. Synchronise the creation and flush.' },
  ],
}
