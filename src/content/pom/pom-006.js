export default {
  id: 'pom-006',
  category: 'pom',
  kind: 'quiz',
  title: 'PageFactory, @FindBy and why many teams prefer By',
  level: 'INTERMEDIATE',
  tags: ['pom', 'pagefactory', 'findby', 'stale-element'],
  estMinutes: 12,
  scenario: `You join a second project that uses PageFactory everywhere: \`@FindBy(id = "user-name") private WebElement username;\`
and \`PageFactory.initElements(driver, this)\` in each constructor. Your ShopEasy framework uses plain \`By\` fields.
In a design review an architect asks: *"Which one should our new projects standardise on, and why?"*`,
  description: `Answer the questions about how PageFactory works and its trade-offs. This is a favourite interview topic.

For reference, the PageFactory version of LoginPage:

\`\`\`java
public class LoginPage {
    @FindBy(id = "user-name")     private WebElement username;
    @FindBy(id = "password")      private WebElement password;
    @FindBy(id = "login-button")  private WebElement loginButton;
    @FindBy(css = ".inventory-item") private List<WebElement> items;

    public LoginPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }

    public void login(String u, String p) {
        username.sendKeys(u);
        password.sendKeys(p);
        loginButton.click();
    }
}
\`\`\``,
  questions: [
    {
      q: 'What does `PageFactory.initElements(driver, this)` actually do when the constructor runs?',
      options: [
        'Finds every @FindBy element immediately; the constructor fails if one is missing',
        'Injects **proxy** objects into the fields; the real lookup happens each time a method is called on the field',
        'Downloads the page HTML and caches it',
        'Registers the page with the WebDriver so it can auto-wait',
      ],
      answer: 1,
      why: 'initElements uses a ElementLocator + Java dynamic proxy. Nothing is searched in the constructor, which is why you can create the page before navigating. Each `username.sendKeys()` triggers a fresh findElement (unless @CacheLookup is used).',
    },
    {
      q: 'You forget to call `PageFactory.initElements` in the constructor. What happens on `username.sendKeys("x")`?',
      options: [
        'NoSuchElementException',
        'NullPointerException, because the field was never initialised',
        'It works, Selenium initialises fields automatically',
        'StaleElementReferenceException',
      ],
      answer: 1,
      why: 'Without initElements the annotated fields stay null. This NPE is one of the most common PageFactory beginner bugs and is confusing because the locator itself is fine.',
    },
    {
      q: 'Someone adds `@CacheLookup` to the product list on a page that re-renders after sorting. What is the risk?',
      options: [
        'None, it only makes tests faster',
        'StaleElementReferenceException: the cached elements belong to the old DOM',
        'The list will always be empty',
        'It disables waits',
      ],
      answer: 1,
      why: '@CacheLookup stores the element after the first lookup. Safe only for static elements that never re-render. Modern React/Angular pages re-render constantly, so it is a frequent source of stale element errors.',
    },
    {
      q: 'You need to wait until the login button is clickable using `ExpectedConditions`. Which is easiest with a `By` field but awkward with `@FindBy`?',
      options: [
        '`elementToBeClickable(WebElement)`',
        '`presenceOfElementLocated(By)` / `visibilityOfElementLocated(By)` and building dynamic locators with String.format',
        '`titleIs(String)`',
        '`alertIsPresent()`',
      ],
      answer: 1,
      why: 'Several conditions (presenceOfElementLocated, numberOfElementsToBe, invisibilityOfElementLocated...) take a By. With @FindBy you have no By object to pass, and annotation values must be compile-time constants, so dynamic locators like `"//td[text()=\'%s\']"` cannot be expressed.',
    },
    {
      q: 'Which statement reflects the usual reasoning for teams that prefer plain `By` locators?',
      options: [
        'PageFactory is deprecated and removed from Selenium 4',
        'By fields are explicit, work with every ExpectedCondition, support dynamic locators, and avoid proxy/NPE/caching surprises; PageFactory is still valid but adds magic',
        'By locators run faster in the browser',
        'PageFactory cannot be used with TestNG',
      ],
      answer: 1,
      why: 'PageFactory still exists in Selenium 4 (Java), so A is a myth. Speed is the same. The Selenium project itself recommends not relying on it heavily; most modern frameworks use By + a BasePage with explicit waits. Either works with TestNG/Cucumber. In an interview: know both, pick one consistently.',
    },
  ],
  hints: ['initElements creates proxies, it does not search.', 'Annotations need compile-time constant values.'],
  explanation: `**PageFactory in one sentence:** \`initElements\` replaces each \`@FindBy\` field with a proxy that runs
\`findElement\` every time you touch it (unless \`@CacheLookup\`).

| | \`By\` fields | \`@FindBy\` + PageFactory |
|---|---|---|
| Lookup | explicit \`findElement\` / wait on use | hidden proxy on use |
| Works with \`ExpectedConditions.*Located(By)\` | yes | no By available |
| Dynamic locators (\`String.format\`) | yes | no (annotation constants) |
| Forget init | n/a | NullPointerException |
| Readability | slightly more code | compact fields |

Both are legitimate. Pick one per framework and be consistent; this track uses \`By\` + \`BasePage\`.`,
  mistakes: [
    'Believing initElements finds elements in the constructor.',
    'Adding @CacheLookup everywhere for "performance".',
    'Mixing @FindBy fields and By fields in the same page with no rule.',
  ],
  interview: [
    { q: 'Explain PageFactory and lazy initialisation.', a: 'PageFactory.initElements injects proxies for @FindBy fields. The element is located when a method is invoked on the proxy, not at construction, so pages can be created before the page loads and each call re-finds the element.' },
    { q: 'Would you use PageFactory in a new framework?', a: 'I would usually choose By locators with a BasePage that wraps explicit waits, because it is explicit, supports dynamic locators and all ExpectedConditions. If the team already uses PageFactory consistently I would keep it and avoid @CacheLookup on dynamic elements.' },
  ],
}
