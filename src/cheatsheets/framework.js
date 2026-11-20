export default {
  slug: 'framework',
  title: 'Framework, TestNG & CI',
  sections: [
    {
      heading: 'TestNG annotation order',
      body: `\`\`\`text
@BeforeSuite                once per suite      config, reports
  @BeforeTest               once per <test> tag in testng.xml (NOT per method)
    @BeforeClass            once per class
      @BeforeMethod         before every @Test  browser per test
        @Test
      @AfterMethod          alwaysRun = true    quit browser
    @AfterClass
  @AfterTest
@AfterSuite                                     flush reports
\`\`\`
Config failure → dependent tests are **SKIPPED**. Use \`alwaysRun = true\` on teardown.`,
    },
    {
      heading: 'Assertions',
      body: `\`\`\`java
Assert.assertEquals(actual, expected, "message");     // TestNG order: actual, expected

SoftAssert softly = new SoftAssert();                  // new per test, never a field
softly.assertEquals(page.getPrice(), "$29.99", "price");
softly.assertTrue(page.isImageDisplayed(), "image");
softly.assertAll();                                    // forget this = always green
\`\`\``,
    },
    {
      heading: 'DataProvider',
      body: `\`\`\`java
@DataProvider(name = "logins")                         // parallel = true optional
public Object[][] logins() {
    return new Object[][] {
        { "standard_user",   "secret_sauce", null },
        { "locked_out_user", "secret_sauce", "Error: Sorry, this user has been locked out." },
    };
}

@Test(dataProvider = "logins")
public void login(String user, String pass, String expectedError) { ... }
\`\`\``,
    },
    {
      heading: 'testng.xml',
      body: `\`\`\`xml
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy Smoke" parallel="methods" thread-count="4">
  <listeners>
    <listener class-name="com.shopeasy.listeners.TestListener"/>
    <listener class-name="com.shopeasy.listeners.RetryTransformer"/>
  </listeners>
  <parameter name="browser" value="chrome"/>
  <test name="Smoke">
    <groups><run>
      <include name="smoke"/>
      <exclude name="wip"/>
    </run></groups>
    <packages><package name="com.shopeasy.tests"/></packages>
  </test>
</suite>
\`\`\`
Parallel modes: \`methods\`, \`classes\`, \`tests\` (one \`<test>\` per browser), \`instances\`.`,
    },
    {
      heading: 'Maven pom.xml essentials',
      body: `\`\`\`xml
<properties>
  <maven.compiler.release>17</maven.compiler.release>
  <selenium.version>4.27.0</selenium.version>
  <cucumber.version>7.20.1</cucumber.version>
</properties>
<!-- org.seleniumhq.selenium:selenium-java
     org.testng:testng                       (test)
     io.cucumber:cucumber-java + cucumber-testng   (same version)
     com.fasterxml.jackson.core:jackson-databind
     org.apache.poi:poi-ooxml                (only if Excel)
     org.apache.logging.log4j:log4j-core
     com.aventstack:extentreports  or  io.qameta.allure:allure-testng -->
<plugin>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.5.4</version>  <!-- suiteXmlFiles is NOT supported from Surefire 3.6 -->
  <configuration>
    <suiteXmlFiles><suiteXmlFile>\${suiteXmlFile}</suiteXmlFile></suiteXmlFiles>
  </configuration>
</plugin>
\`\`\`
**Surefire/Failsafe 3.6+** run TestNG through the JUnit Platform and no longer accept \`suiteXmlFiles\` (3.6.1 fails the build). Pin 3.5.x to keep testng.xml, or move to \`groups\`/\`includes\` — see the *Maven build internals* deep dive.
Selenium 4.6+ ships **Selenium Manager** — no WebDriverManager / driver paths needed.`,
    },
    {
      heading: 'Maven commands',
      body: `\`\`\`text
mvn clean test                                    run testng.xml
mvn clean test -Dgroups=smoke                     one TestNG group
mvn clean test -Dtest=LoginTest                   one class
mvn clean test -Dtest=LoginTest#validLogin        one method
mvn clean test -Denv=qa -Dbrowser=firefox         environment + browser
mvn clean test -Dheadless=true                    CI / no display
mvn clean test -DsuiteXmlFile=testng-regression.xml
mvn clean test -Dretries=1                        custom retry count
mvn -B ...                                        batch mode (CI logs)
\`\`\``,
    },
    {
      heading: 'Config with environment switching',
      body: `\`\`\`java
private static final String ENV = System.getProperty("env", "local");
// load src/test/resources/config/<env>.properties from the classpath once
public static String get(String key) {
    return System.getProperty(key, PROPS.getProperty(key));   // -Dkey overrides the file
}
\`\`\`
Secrets → CI secret store → \`System.getenv("...")\`, never committed.`,
    },
    {
      heading: 'Listeners & retry',
      body: `\`\`\`java
public class TestListener implements ITestListener {
    public void onTestFailure(ITestResult r) {
        File src = ((TakesScreenshot) DriverManager.getDriver()).getScreenshotAs(OutputType.FILE);
        // Files.copy(src.toPath(), target/screenshots/Class_method_timestamp.png)
    }
}

public class RetryAnalyzer implements IRetryAnalyzer {
    private int count = 0;
    public boolean retry(ITestResult r) { return count++ < 1; }  // max 1, log it, fix root cause
}
// apply to all tests: IAnnotationTransformer -> annotation.setRetryAnalyzer(RetryAnalyzer.class)
\`\`\`
Retry = band-aid. Track flaky tests, fix waits/data, quarantine with a \`flaky\` group.`,
    },
    {
      heading: 'Reporting & logging',
      body: `- **Extent**: one \`ExtentReports\` (onStart → \`flush()\` in onFinish) + \`ThreadLocal<ExtentTest>\`; Base64 screenshots.
- **Allure**: \`allure-testng\` + AspectJ agent, \`@Step\` on page methods, \`allure serve target/allure-results\`.
- **Log4j2**: \`private static final Logger log = LogManager.getLogger(X.class);\`, \`log.info("Opened {}", url)\`,
  pattern with \`[%t]\` (thread) in \`src/test/resources/log4j2.xml\`. Never log passwords.`,
    },
    {
      heading: 'Folder structure',
      body: `\`\`\`text
shopeasy-ui-tests/
├── pom.xml   testng.xml   Jenkinsfile   .github/workflows/ui-tests.yml   .gitignore
└── src/test/
    ├── java/com/shopeasy/
    │   ├── core/          DriverManager, DriverFactory, BaseTest
    │   ├── config/        ConfigReader
    │   ├── pages/         BasePage, LoginPage, ...   components/ HeaderComponent
    │   ├── data/          POJOs + TestDataReader
    │   ├── utils/         WaitUtils, JsUtils
    │   ├── listeners/     TestListener, RetryAnalyzer, ExtentReportListener
    │   ├── tests/         LoginTest, CartTest, CheckoutTest
    │   └── cucumber/      runners/  steps/  hooks/
    └── resources/
        ├── config/        local/qa/uat.properties
        ├── features/      *.feature
        ├── testdata/      *.json, *.xlsx
        └── log4j2.xml
\`\`\`
Dependencies point one way: **tests/steps → pages → core/config/utils**.`,
    },
    {
      heading: 'Jenkinsfile',
      body: `\`\`\`groovy
pipeline {
  agent any
  parameters {
    choice(name: 'ENV', choices: ['qa', 'uat'])
    choice(name: 'GROUPS', choices: ['smoke', 'regression'])
  }
  tools { maven 'Maven-3.9'; jdk 'JDK-17' }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Test') {
      steps { sh "mvn -B clean test -Denv=\${params.ENV} -Dgroups=\${params.GROUPS} -Dheadless=true" }
    }
  }
  post {
    always {
      junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
      publishHTML(target: [reportDir: 'target/extent', reportFiles: 'report.html', reportName: 'Extent Report', keepAll: true])
      archiveArtifacts artifacts: 'target/screenshots/**/*.png', allowEmptyArchive: true
    }
  }
}
\`\`\`
Double quotes for Groovy interpolation. Nightly: \`triggers { cron('H 2 * * 1-5') }\`.`,
    },
    {
      heading: 'GitHub Actions (headless)',
      body: `\`\`\`yaml
name: ui-smoke
on: [push, workflow_dispatch]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: maven }
      - run: mvn -B clean test -Dgroups=smoke -Denv=qa -Dheadless=true
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: reports, path: target/extent }
\`\`\`
Headless Chrome: \`--headless=new --window-size=1920,1080\` (+ \`--no-sandbox --disable-dev-shm-usage\` in containers).`,
    },
  ],
}
