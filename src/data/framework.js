// A complete reference framework (Java 17 + Selenium 4 + Cucumber 7 + TestNG + Page Object Model)
// for the ShopEasy practice site. Shown on the Framework Blueprint page, file by file.
export const FRAMEWORK_FILES = [
  {
    path: 'pom.xml',
    why: 'Maven builds the project and downloads the libraries. Surefire runs the TestNG runner, and system properties like -Dbrowser pass through to the tests.',
    lang: 'xml',
    code: `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <selenium.version>4.27.0</selenium.version>
    <cucumber.version>7.20.1</cucumber.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>\${selenium.version}</version>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-java</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-testng</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-picocontainer</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>7.10.2</version>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>testng.xml</suiteXmlFile>
          </suiteXmlFiles>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>`,
  },
  {
    path: 'testng.xml',
    why: 'The TestNG suite file Maven runs. parallel / thread-count here plus the parallel DataProvider in the runner give parallel scenarios.',
    lang: 'xml',
    code: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy UI" data-provider-thread-count="3">
  <test name="Cucumber scenarios">
    <classes>
      <class name="com.shopeasy.runners.TestRunner"/>
    </classes>
  </test>
</suite>`,
  },
  {
    path: 'src/test/resources/config/qa.properties',
    why: 'Environment settings live outside the code. Switch environments with -Denv=staging without changing a line of Java.',
    lang: 'properties',
    code: `baseUrl=http://localhost:5180/practice-site/
browser=chrome
headless=false
explicitWait=10
username=standard_user
password=secret_sauce`,
  },
  {
    path: 'src/test/java/com/shopeasy/utils/ConfigReader.java',
    why: 'Reads the properties file once. A -D system property wins over the file, so CI can override anything.',
    lang: 'java',
    code: `package com.shopeasy.utils;

import java.io.InputStream;
import java.util.Properties;

public final class ConfigReader {
    private static final Properties PROPS = new Properties();

    static {
        String env = System.getProperty("env", "qa");
        String file = "config/" + env + ".properties";
        try (InputStream in = ConfigReader.class.getClassLoader().getResourceAsStream(file)) {
            if (in == null) throw new IllegalStateException("Missing " + file);
            PROPS.load(in);
        } catch (Exception e) {
            throw new IllegalStateException("Could not load " + file, e);
        }
    }

    private ConfigReader() {}

    public static String get(String key) {
        return System.getProperty(key, PROPS.getProperty(key));
    }

    public static int getInt(String key) {
        return Integer.parseInt(get(key));
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/driver/DriverFactory.java',
    why: 'One place creates browsers. ThreadLocal gives every parallel thread its own WebDriver, so tests never fight over one browser.',
    lang: 'java',
    code: `package com.shopeasy.driver;

import com.shopeasy.utils.ConfigReader;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

public final class DriverFactory {
    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    private DriverFactory() {}

    public static void init() {
        boolean headless = Boolean.parseBoolean(ConfigReader.get("headless"));
        WebDriver driver = switch (ConfigReader.get("browser").toLowerCase()) {
            case "firefox" -> {
                FirefoxOptions o = new FirefoxOptions();
                if (headless) o.addArguments("-headless");
                yield new FirefoxDriver(o);
            }
            default -> {
                ChromeOptions o = new ChromeOptions();
                if (headless) o.addArguments("--headless=new");
                o.addArguments("--window-size=1920,1080");
                yield new ChromeDriver(o); // Selenium Manager downloads the right driver
            }
        };
        DRIVER.set(driver);
    }

    public static WebDriver get() {
        return DRIVER.get();
    }

    public static void quit() {
        if (DRIVER.get() != null) {
            DRIVER.get().quit();
            DRIVER.remove();
        }
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/pages/BasePage.java',
    why: 'Common actions with built-in explicit waits. Every page extends it, so no page ever needs Thread.sleep.',
    lang: 'java',
    code: `package com.shopeasy.pages;

import com.shopeasy.utils.ConfigReader;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(ConfigReader.getInt("explicitWait")));
    }

    protected WebElement visible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String text) {
        WebElement el = visible(locator);
        el.clear();
        el.sendKeys(text);
    }

    protected String text(By locator) {
        return visible(locator).getText().trim();
    }

    protected boolean isDisplayed(By locator) {
        return !driver.findElements(locator).isEmpty() && driver.findElement(locator).isDisplayed();
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/pages/LoginPage.java',
    why: 'Locators are private — tests can only use the actions. Logging in returns the next page, which makes the flow read naturally.',
    lang: 'java',
    code: `package com.shopeasy.pages;

import com.shopeasy.utils.ConfigReader;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage extends BasePage {
    private final By username = By.id("user-name");
    private final By password = By.id("password");
    private final By loginButton = By.id("login-button");
    private final By error = By.id("login-error-message");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public LoginPage open() {
        driver.get(ConfigReader.get("baseUrl") + "login.html");
        return this;
    }

    public InventoryPage loginAs(String user, String pass) {
        type(username, user);
        type(password, pass);
        click(loginButton);
        return new InventoryPage(driver);
    }

    public void attemptLogin(String user, String pass) {
        type(username, user);
        type(password, pass);
        click(loginButton);
    }

    public String errorMessage() {
        return text(error);
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/pages/InventoryPage.java',
    why: 'Dynamic locators are built with String.format from one template, instead of one locator per product.',
    lang: 'java',
    code: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

import java.util.List;

public class InventoryPage extends BasePage {
    private final By title = By.cssSelector("[data-testid='title']");
    private final By sort = By.id("product-sort");
    private final By prices = By.cssSelector("#inventory-list .item-price");
    private final By cartBadge = By.className("shopping-cart-badge");
    private static final String ADD_BUTTON =
        "//*[@data-testid='inventory-item'][.//*[normalize-space()='%s']]//button[starts-with(@id,'add-to-cart')]";

    public InventoryPage(WebDriver driver) {
        super(driver);
    }

    public boolean isLoaded() {
        return isDisplayed(title);
    }

    public InventoryPage addToCart(String productName) {
        click(By.xpath(String.format(ADD_BUTTON, productName)));
        return this;
    }

    public int cartCount() {
        return isDisplayed(cartBadge) ? Integer.parseInt(text(cartBadge)) : 0;
    }

    /** value is one of: az, za, lohi, hilo */
    public InventoryPage sortBy(String value) {
        new Select(visible(sort)).selectByValue(value);
        return this;
    }

    public List<Double> prices() {
        return driver.findElements(prices).stream()
            .map(WebElement::getText)
            .map(t -> Double.parseDouble(t.replaceAll("[^0-9.]", "")))
            .toList();
    }
}`,
  },
  {
    path: 'src/test/resources/features/login.feature',
    why: 'Business-readable scenarios. Scenario Outline runs the same steps for each row of Examples — your manual test data table.',
    lang: 'gherkin',
    code: `@login
Feature: Login
  As a ShopEasy customer
  I want to log in with my account
  So that I can buy products

  Background:
    Given I am on the login page

  @smoke
  Scenario: Successful login shows the products
    When I log in as "standard_user" with password "secret_sauce"
    Then I should see the products page

  @regression
  Scenario Outline: Login is refused for bad credentials
    When I log in as "<username>" with password "<password>"
    Then I should see the error "<error>"

    Examples:
      | username        | password     | error                                     |
      | locked_out_user | secret_sauce | Sorry, this user has been locked out.     |
      | standard_user   | wrong        | Username and password do not match        |
      | ""              | secret_sauce | Username is required                      |`,
  },
  {
    path: 'src/test/java/com/shopeasy/context/TestContext.java',
    why: 'PicoContainer creates one TestContext per scenario and injects it into every step class — the clean way to share state.',
    lang: 'java',
    code: `package com.shopeasy.context;

import com.shopeasy.driver.DriverFactory;
import com.shopeasy.pages.InventoryPage;
import com.shopeasy.pages.LoginPage;
import org.openqa.selenium.WebDriver;

public class TestContext {
    private LoginPage loginPage;
    private InventoryPage inventoryPage;

    public WebDriver driver() {
        return DriverFactory.get();
    }

    public LoginPage loginPage() {
        if (loginPage == null) loginPage = new LoginPage(driver());
        return loginPage;
    }

    public InventoryPage inventoryPage() {
        if (inventoryPage == null) inventoryPage = new InventoryPage(driver());
        return inventoryPage;
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/steps/LoginSteps.java',
    why: 'Step definitions stay thin: they translate Gherkin into page-object calls and make the assertions.',
    lang: 'java',
    code: `package com.shopeasy.steps;

import com.shopeasy.context.TestContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.testng.Assert;

public class LoginSteps {
    private final TestContext ctx;

    public LoginSteps(TestContext ctx) { // injected by PicoContainer
        this.ctx = ctx;
    }

    @Given("I am on the login page")
    public void iAmOnTheLoginPage() {
        ctx.loginPage().open();
    }

    @When("I log in as {string} with password {string}")
    public void iLogIn(String user, String pass) {
        ctx.loginPage().attemptLogin(user, pass);
    }

    @Then("I should see the products page")
    public void iShouldSeeProducts() {
        Assert.assertTrue(ctx.inventoryPage().isLoaded(), "Inventory page did not load");
    }

    @Then("I should see the error {string}")
    public void iShouldSeeTheError(String expected) {
        Assert.assertTrue(ctx.loginPage().errorMessage().contains(expected),
            "Unexpected error: " + ctx.loginPage().errorMessage());
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/hooks/Hooks.java',
    why: 'A fresh browser per scenario, and a screenshot attached to the report whenever a scenario fails.',
    lang: 'java',
    code: `package com.shopeasy.hooks;

import com.shopeasy.driver.DriverFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;

public class Hooks {

    @Before
    public void setUp() {
        DriverFactory.init();
    }

    @After
    public void tearDown(Scenario scenario) {
        if (scenario.isFailed() && DriverFactory.get() != null) {
            byte[] png = ((TakesScreenshot) DriverFactory.get()).getScreenshotAs(OutputType.BYTES);
            scenario.attach(png, "image/png", scenario.getName());
        }
        DriverFactory.quit();
    }
}`,
  },
  {
    path: 'src/test/java/com/shopeasy/runners/TestRunner.java',
    why: 'Wires features, glue packages, reports and tags together. Overriding scenarios() with parallel = true runs scenarios in parallel.',
    lang: 'java',
    code: `package com.shopeasy.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

@CucumberOptions(
    features = "src/test/resources/features",
    glue = {"com.shopeasy.steps", "com.shopeasy.hooks"},
    plugin = {"pretty", "html:target/cucumber-report.html", "json:target/cucumber.json"},
    tags = "not @wip"
)
public class TestRunner extends AbstractTestNGCucumberTests {

    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}`,
  },
  {
    path: 'Jenkinsfile',
    why: 'CI runs the suite headless on every build and publishes the Cucumber HTML report, even when tests fail.',
    lang: 'groovy',
    code: `pipeline {
    agent any
    parameters {
        choice(name: 'ENV', choices: ['qa', 'staging'], description: 'Environment')
        string(name: 'TAGS', defaultValue: '@smoke', description: 'Cucumber tag expression')
    }
    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Test') {
            steps {
                sh "mvn -B clean test -Denv=\${params.ENV} -Dheadless=true -Dcucumber.filter.tags='\${params.TAGS}'"
            }
        }
    }
    post {
        always {
            publishHTML(target: [reportDir: 'target', reportFiles: 'cucumber-report.html', reportName: 'Cucumber Report'])
        }
    }
}`,
  },
]

export const FRAMEWORK_TREE = `shopeasy-ui-tests/
├── pom.xml                      ← dependencies & build
├── testng.xml                   ← suite, parallel settings
├── Jenkinsfile                  ← CI pipeline
└── src/test/
    ├── java/com/shopeasy/
    │   ├── driver/DriverFactory.java    ← ThreadLocal WebDriver
    │   ├── utils/ConfigReader.java      ← properties + -D overrides
    │   ├── pages/                        ← Page Object Model
    │   │   ├── BasePage.java
    │   │   ├── LoginPage.java
    │   │   └── InventoryPage.java
    │   ├── context/TestContext.java     ← shared state (PicoContainer)
    │   ├── steps/LoginSteps.java        ← step definitions
    │   ├── hooks/Hooks.java             ← @Before / @After, screenshots
    │   └── runners/TestRunner.java      ← @CucumberOptions
    └── resources/
        ├── config/qa.properties
        └── features/login.feature`

export const RUN_COMMANDS = [
  ['Run everything', 'mvn clean test'],
  ['Only smoke scenarios', 'mvn clean test -Dcucumber.filter.tags="@smoke"'],
  ['Firefox, headless', 'mvn clean test -Dbrowser=firefox -Dheadless=true'],
  ['Against staging', 'mvn clean test -Denv=staging'],
]
