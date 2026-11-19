export default {
  id: 'dbg-036',
  category: 'debugging',
  kind: 'quiz',
  title: 'NullPointerException in a PageFactory page: the @FindBy fields were never initialised',
  level: 'INTERMEDIATE',
  tags: ['NullPointerException', 'PageFactory', 'FindBy', 'pom', 'cucumber', 'stack-trace'],
  estMinutes: 12,
  scenario: `The team is moving the ShopEasy login page object from \`By\` fields to **PageFactory** (\`@FindBy\`). After the refactor, every login test fails with a \`NullPointerException\` before the browser even types anything. The locators are unchanged (\`#user-name\`, \`#password\`, \`#login-button\`) and work in DevTools. You need to explain the failure in the pull request review.`,
  description: `Java 17 prints "helpful" NullPointerException messages that name exactly **what** was null. Use them to answer each question.`,
  hints: [
    'Read the part after "because": it names the variable or field that is null.',
    'A @FindBy annotation does nothing by itself; something has to create proxies for those fields.',
  ],
  questions: [
    {
      q: `What is null here?

\`\`\`text
java.lang.NullPointerException: Cannot invoke "org.openqa.selenium.WebElement.sendKeys(java.lang.CharSequence[])" because "this.usernameField" is null
	at com.shopeasy.pages.LoginPage.loginAs(LoginPage.java:29)
	at com.shopeasy.tests.LoginTest.validUserCanLogIn(LoginTest.java:18)
\`\`\`

\`\`\`java
public class LoginPage {
    private final WebDriver driver;

    @FindBy(id = "user-name")    private WebElement usernameField;
    @FindBy(id = "password")     private WebElement passwordField;
    @FindBy(id = "login-button") private WebElement loginButton;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
    }
}
\`\`\``,
      options: [
        'The driver is null',
        'The #user-name element was not found on the page',
        'The usernameField field is null because PageFactory.initElements(driver, this) was never called',
        'sendKeys was given a null username',
      ],
      answer: 2,
      why: 'The message says `this.usernameField` is null. @FindBy fields stay null until `PageFactory.initElements(driver, this)` creates lazy proxies for them, usually in the constructor. If the element were missing, you would get NoSuchElementException (the proxy searches when used), not an NPE.',
    },
    {
      q: `After adding \`PageFactory.initElements(driver, this)\` the message changes:

\`\`\`text
java.lang.NullPointerException: Cannot invoke "org.openqa.selenium.SearchContext.findElement(org.openqa.selenium.By)" because "this.searchContext" is null
	at org.openqa.selenium.support.pagefactory.DefaultElementLocator.findElement(DefaultElementLocator.java:68)
	...
	at com.shopeasy.pages.LoginPage.loginAs(LoginPage.java:29)
	at com.shopeasy.stepdefs.LoginSteps.iLogInAs(LoginSteps.java:22)
\`\`\`

\`\`\`java
public class LoginSteps {
    private final LoginPage loginPage = new LoginPage(Hooks.driver);   // line 15

    @When("I log in as {string}")
    public void iLogInAs(String user) {
        loginPage.loginAs(user, "secret_sauce");                       // line 22
    }
}
\`\`\`

What is the problem now?`,
      options: [
        'PageFactory does not work with Cucumber',
        'The page object is created when the step class is constructed, before the @Before hook has started the browser, so Hooks.driver is still null',
        'The @FindBy id is wrong',
        'The driver must be cast to RemoteWebDriver',
      ],
      answer: 1,
      why: 'Cucumber creates step-definition classes before running @Before hooks. The field initialiser reads Hooks.driver while it is still null, so PageFactory receives a null search context. Fix: create the page object lazily inside the step (or after the hook), or inject a shared driver holder with PicoContainer so the page gets the real driver.',
    },
    {
      q: `Which constructor is correct?`,
      options: [
        '`public LoginPage(WebDriver driver) { PageFactory.initElements(driver, LoginPage.class); }`',
        '`public LoginPage(WebDriver driver) { this.driver = driver; PageFactory.initElements(driver, this); }`',
        '`public LoginPage(WebDriver driver) { PageFactory.initElements(null, this); this.driver = driver; }`',
        '`public LoginPage() { PageFactory.initElements(new ChromeDriver(), this); }`',
      ],
      answer: 1,
      why: 'Pass the real driver and `this`, so the existing object\'s fields are filled. `initElements(driver, LoginPage.class)` returns a NEW instance and leaves the current one untouched (its fields stay null). Passing null just moves the NPE, and creating a new ChromeDriver inside a page object opens a second browser.',
    },
    {
      q: `How do you quickly tell an NPE in **your** code from a "real" locator problem?`,
      options: [
        'NPE and NoSuchElementException mean the same thing',
        'A locator problem gives NoSuchElementException / TimeoutException naming the selector; an NPE names a null variable or field in the message — it is a wiring bug in the test code',
        'An NPE always means the website is down',
        'You cannot tell without debugging line by line',
      ],
      answer: 1,
      why: 'NPEs are almost always test-code wiring problems: page not initialised, driver not created yet, a value not returned. Selenium failures name a selector. Reading the exception type and the "because ..." part tells you which kind of bug you are looking at in seconds.',
    },
  ],
  explanation: `**@FindBy fields are null until \`PageFactory.initElements(driver, this)\` runs.** It replaces each annotated field with a proxy that finds the element *when you use it* — which is why a missing element still gives NoSuchElementException, not an NPE.

**Read the helpful NPE message:** "because \`this.usernameField\` is null" → page not initialised. "because \`this.searchContext\` is null" → initElements was called, but with a null driver (often a Cucumber step class built before the @Before hook).

**Fix pattern:** initialise in the constructor with the real driver, and create page objects only after the driver exists (inside steps, or via dependency injection).`,
  mistakes: [
    'Forgetting PageFactory.initElements and blaming the locators.',
    'Calling initElements(driver, LoginPage.class) and ignoring the returned instance.',
    'Creating page objects in step-class field initialisers, before the @Before hook starts the browser.',
    'Wrapping the code in try/catch(NullPointerException) instead of fixing the wiring.',
  ],
  interview: [
    { q: 'What does PageFactory.initElements do?', a: 'It scans the object for @FindBy fields and assigns each one a lazy proxy. The real findElement happens each time the field is used, so elements are looked up fresh. Without initElements the fields are simply null.' },
    { q: 'How do you read a NullPointerException in Java 17?', a: 'The helpful message says which method could not be invoked and which variable or field was null. I go to the first frame in our code, find where that field should have been set, and check the order of initialisation, for example whether the driver existed when the page was built.' },
    { q: 'PageFactory or plain By locators?', a: 'Both work. Many teams prefer private By fields with explicit waits because they are simpler and avoid proxy surprises; PageFactory is fine if initElements is always called and waits are still explicit.' },
  ],
}
