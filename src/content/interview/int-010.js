export default {
  id: 'int-010',
  category: 'interview',
  kind: 'quiz',
  title: 'Java OOP in your framework: point to where each concept lives',
  level: 'INTERMEDIATE',
  tags: ['java', 'oop', 'inheritance', 'encapsulation', 'polymorphism', 'abstraction'],
  estMinutes: 15,
  scenario: `"Where have you used OOP concepts in your framework?" is the #1 Java question for automation testers. Reciting definitions is not enough — the interviewer wants you to **point at real classes**: BasePage, private locators, WebDriver interface, overloaded methods, DriverFactory.`,
  description: `Match each concept to a real framework example. Then memorise the four-line answer in the explanation.`,
  hints: [
    'WebDriver driver = new ChromeDriver(); — which concepts are in this one line?',
    'Private By fields + public action methods = encapsulation.',
  ],
  questions: [
    {
      q: '`public class LoginPage extends BasePage` — which concept is this, and why do we do it?',
      options: [
        'Encapsulation — to hide the driver',
        'Inheritance — every page reuses common driver, wait and helper methods (click, type, getText) from BasePage instead of duplicating them',
        'Polymorphism — to override login',
        'Abstraction — because LoginPage is abstract',
      ],
      answer: 1,
      why: 'Inheritance gives code reuse: BasePage holds the driver, WebDriverWait and helpers; every page extends it. The same applies to test classes extending BaseTest for setup/teardown.',
    },
    {
      q: `Which concept does this page object mainly demonstrate?

\`\`\`java
public class LoginPage extends BasePage {
    private final By username = By.id("user-name");
    private final By password = By.id("password");

    public InventoryPage loginAs(String user, String pwd) {
        type(username, user);
        type(password, pwd);
        click(By.id("login-button"));
        return new InventoryPage(driver);
    }
}
\`\`\``,
      options: [
        'Encapsulation — locators are private; tests can only use the public business method loginAs()',
        'Multiple inheritance',
        'Method overriding',
        'Interfaces',
      ],
      answer: 0,
      why: 'Encapsulation means hiding data and exposing behaviour. Tests don\'t know (or care) about the locators; when the id changes, only this class changes.',
    },
    {
      q: '`WebDriver driver = new ChromeDriver();` — which concepts are involved?',
      options: [
        'Only inheritance',
        'Abstraction and runtime polymorphism (upcasting): WebDriver is an interface; the reference can point to ChromeDriver, FirefoxDriver or RemoteWebDriver, and the same code drives any browser',
        'Encapsulation only',
        'Method overloading',
      ],
      answer: 1,
      why: 'Coding against the WebDriver interface (abstraction) lets DriverFactory return different implementations at runtime (polymorphism). That is how one framework supports Chrome, Firefox and Grid with a -Dbrowser switch.',
    },
    {
      q: 'Where would you find method OVERLOADING (compile-time polymorphism) in a framework?',
      options: [
        'BaseTest.setUp() overriding a parent method',
        'Helpers like waitForElement(By locator) and waitForElement(By locator, int seconds), or Selenium\'s own switchTo().frame(int) / frame(String) / frame(WebElement)',
        'The WebDriver interface',
        'Private fields',
      ],
      answer: 1,
      why: 'Overloading = same name, different parameters. Selenium\'s frame() overloads are a perfect example to quote. Overriding = subclass redefines a parent method with the same signature (e.g. a page overriding isLoaded() from an abstract BasePage).',
    },
    {
      q: 'Which is a good example of ABSTRACTION you designed yourself?',
      options: [
        'Making every field public',
        'An abstract BasePage with an abstract method isLoaded() that every page implements, or an interface like Browser/DriverProvider with implementations per browser',
        'Using static methods everywhere',
        'Copy-pasting the same code into every page',
      ],
      answer: 1,
      why: 'Abstraction defines *what* must be done and hides *how*. An abstract isLoaded() forces every page to define its "ready" condition; a DriverProvider interface hides browser-specific setup.',
    },
  ],
  explanation: `**The four-line answer (point at your classes):**
- **Inheritance:** "All pages extend **BasePage** (driver, waits, click/type helpers) and all test classes extend **BaseTest**."
- **Encapsulation:** "Locators are **private By fields**; tests use public business methods like \`loginAs()\`, so a locator change touches one class."
- **Polymorphism:** "\`WebDriver driver = new ChromeDriver()\` — DriverFactory returns Chrome, Firefox or RemoteWebDriver behind the same interface (runtime). Overloaded helpers like \`waitFor(By)\` / \`waitFor(By, Duration)\` (compile time)."
- **Abstraction:** "WebDriver itself is an interface; our **abstract BasePage** has \`isLoaded()\` that every page implements."

Bonus points: mention **composition** — pages *have* components (HeaderComponent, CartIcon) instead of inheriting everything — and \`final\`/\`static\` usage (constants in a \`FrameworkConstants\` class).`,
  mistakes: [
    'Giving textbook definitions with no framework example.',
    'Calling WebDriver a class (it is an interface).',
    'Mixing up overloading and overriding.',
    'Claiming multiple inheritance of classes in Java.',
  ],
  interview: [
    { q: 'Where have you used OOP concepts in your framework?', a: 'Inheritance: every page extends BasePage which has the driver, waits and common actions, and test classes extend BaseTest. Encapsulation: locators are private By fields and tests call public methods like loginAs. Polymorphism: WebDriver driver = new ChromeDriver() — our DriverFactory returns different browser implementations through the same interface, and we have overloaded wait helpers. Abstraction: WebDriver is an interface, and our abstract BasePage defines isLoaded() that each page implements.' },
    { q: 'Is WebDriver a class or an interface? What does ChromeDriver extend?', a: 'WebDriver is an interface. ChromeDriver extends ChromiumDriver, which extends RemoteWebDriver, and RemoteWebDriver implements WebDriver along with interfaces like JavascriptExecutor and TakesScreenshot — that is why we can cast the driver to those interfaces.' },
    { q: 'Why is driver usually declared as WebDriver, not ChromeDriver?', a: 'To code against the interface: the same page objects work with any browser implementation, and the DriverFactory decides at runtime which one to create.' },
  ],
}
