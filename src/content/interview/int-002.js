export default {
  id: 'int-002',
  category: 'interview',
  kind: 'quiz',
  title: 'POM vs PageFactory — and why most teams moved away from @FindBy',
  level: 'INTERMEDIATE',
  tags: ['pom', 'pagefactory', 'FindBy', 'design-patterns'],
  estMinutes: 15,
  scenario: `"What is the difference between POM and PageFactory?" is asked in nearly every Selenium interview. A weak answer treats them as two competing frameworks. A strong answer says: **POM is the design pattern; PageFactory is one optional way to initialise elements inside page objects** — then explains what your project chose and why.`,
  description: `Answer the questions, then read the model answers. Notice how each "why" contains a sentence you can reuse: *"In my project we used … because …"*.`,
  hints: [
    'POM = pattern (one class per page, locators + actions). PageFactory = @FindBy + initElements.',
    'PageFactory elements are lazy proxies looked up on every use; @CacheLookup caches them.',
  ],
  questions: [
    {
      q: 'Which statement is correct?',
      options: [
        'POM and PageFactory are two different test frameworks',
        'POM is a design pattern (a class per page with locators and methods); PageFactory is a Selenium support class that initialises @FindBy fields in a page object',
        'PageFactory is required to implement POM',
        'POM only works with TestNG',
      ],
      answer: 1,
      why: 'You can implement POM perfectly well with private By locators and no PageFactory. PageFactory is an implementation detail for initialising WebElement fields via annotations.',
    },
    {
      q: `What does this code do?

\`\`\`java
public class LoginPage {
    @FindBy(id = "user-name") private WebElement username;
    @FindBy(id = "password") private WebElement password;
    @FindBy(css = "button[type='submit']") private WebElement loginButton;

    public LoginPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }
}
\`\`\``,
      options: [
        'Finds all three elements immediately in the constructor and throws if they are missing',
        'Creates lazy proxies for the three fields; each element is located when a method is called on it',
        'Caches the elements forever',
        'Nothing — @FindBy needs TestNG',
      ],
      answer: 1,
      why: 'initElements injects proxies. The real findElement happens at the moment you call username.sendKeys(...). That is why a PageFactory page can be constructed before the page is loaded. With @CacheLookup the element is cached after first lookup — fast but dangerous on dynamic pages (stale elements).',
    },
    {
      q: 'Your project uses many explicit waits with ExpectedConditions. Why do many teams prefer By locators over @FindBy?',
      options: [
        'By locators are faster to type',
        'Most ExpectedConditions (visibilityOfElementLocated, elementToBeClickable(By), invisibilityOfElementLocated, numberOfElementsToBe) take a By; with By fields you can wait, re-locate after re-renders and build dynamic locators easily',
        '@FindBy is deprecated and removed from Selenium 4',
        'By locators cannot go stale',
      ],
      answer: 1,
      why: 'By works naturally with waits and dynamic locators (String.format templates, By.xpath for a product name). PageFactory is not removed — it still exists in selenium-support — but its benefits are small for modern dynamic apps. Note: By locators do not magically prevent stale elements; the WebElement you get from them still can go stale, but you can easily re-find.',
    },
    {
      q: 'Where should assertions live in a POM framework?',
      options: [
        'Inside every page-object method',
        'In tests/step definitions; page objects expose state (getters like getErrorMessage(), isCartBadgeDisplayed()) and actions, but don\'t decide pass/fail',
        'In the DriverManager',
        'In the feature file',
      ],
      answer: 1,
      why: 'If a page object asserts, it can\'t be reused for negative tests ("error should NOT appear"). Pages model the UI; tests decide what is expected. Some teams allow small "verify page loaded" checks in pages — mention it as a conscious exception.',
    },
    {
      q: 'Which page-object method design is best?',
      options: [
        'public WebElement getLoginButton() — tests click it themselves',
        'public void clickLogin(), public void typeUsername(String), … one method per element action only',
        'Business-level methods like public InventoryPage loginAs(String user, String pwd) that return the next page object, plus smaller methods when needed',
        'Static methods in a Utils class for all pages',
      ],
      answer: 2,
      why: 'Exposing WebElements leaks Selenium into tests. Business-level methods that return the next page (fluent POM) make tests read like user journeys and keep locator changes in one place. Static util-only designs aren\'t object-oriented and break with parallel drivers.',
    },
  ],
  explanation: `**Model comparison to say in an interview:**

| | POM with By locators | PageFactory (@FindBy) |
|---|---|---|
| What | Design pattern | Helper to initialise fields |
| Lookup | When you call \`driver.findElement(by)\` | Lazy proxy on every use |
| Waits | Works directly with \`ExpectedConditions(By)\` | Needs WebElement-based conditions |
| Dynamic locators | Easy (\`String.format\`) | Annotations are static |
| Stale elements | Re-find easily | Proxy re-finds unless @CacheLookup |

> "In my project we followed POM with **private By locators** and a **BasePage** that wraps explicit waits — for example \`click(By)\` waits for elementToBeClickable. We avoided PageFactory because our React pages re-render a lot and most of our waits take By locators. In an older project we did use @FindBy with initElements, which is fine for stable pages."`,
  mistakes: [
    'Saying "we used PageFactory instead of POM".',
    'Putting assertions inside page objects.',
    'Returning WebElements from page objects so tests call Selenium directly.',
    'Using @CacheLookup on dynamic elements and getting StaleElementReferenceException.',
  ],
  interview: [
    { q: 'What is the difference between POM and PageFactory?', a: 'POM is a design pattern where each page is a class holding its locators and the actions a user can do there. PageFactory is a Selenium support class that initialises @FindBy WebElement fields as lazy proxies, so it is one way to implement POM. In my project we used POM with private By locators and a BasePage with explicit waits, because most ExpectedConditions take a By and our pages were dynamic.' },
    { q: 'What is @CacheLookup?', a: 'It tells PageFactory to cache the element after the first lookup instead of finding it every time. It speeds up static elements but causes StaleElementReferenceException if the DOM changes, so we only used it for stable things like a header logo, if at all.' },
    { q: 'How do you handle common functionality across pages?', a: 'Through a BasePage that every page extends — it holds the driver, a WebDriverWait and helper methods like click, type and getText with waits built in. Shared components such as the header or cart icon are separate component classes reused by pages.' },
  ],
}
