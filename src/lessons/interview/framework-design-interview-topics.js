export default {
  slug: 'framework-design-interview-topics',
  category: 'interview',
  order: 2,
  title: 'Framework design questions: POM, PageFactory, Cucumber vs TestNG, OOP',
  minutes: 9,
  summary: 'Explain the design choices inside a Selenium framework and point to where each OOP concept lives in your own code.',
  manualAnalogy: `When someone asks why your regression pack is organised by module with shared preconditions, you can explain
the reasoning, not just the layout. Framework questions are the same: interviewers want the "why" behind each
folder and class.`,
  body: `## Page Object Model vs PageFactory

**Page Object Model (POM)** is a *design pattern*: one class per page (or component) that hides locators and
exposes intent-revealing methods such as \`addToCart(String product)\` or \`goToCheckout()\`. Tests and step
definitions call those methods and never touch locators.

**PageFactory** is a *helper class* in Selenium that can build page objects for you using \`@FindBy\` annotations on
\`WebElement\` fields and \`PageFactory.initElements(driver, this)\`. The fields are proxies: the element is looked
up lazily each time you use it.

| | POM with \`By\` locators | PageFactory \`@FindBy\` |
|---|---|---|
| What it is | the pattern itself | one way to implement the pattern |
| Locator type | \`private final By cartLink = By.id("shopping-cart-link");\` | \`@FindBy(id = "shopping-cart-link") WebElement cartLink;\` |
| Explicit waits | pass the \`By\` straight to \`ExpectedConditions\` | awkward - conditions mostly want a \`By\` or an already-found element |
| Status | standard in modern frameworks | still works, but the Selenium team does not recommend it |

The sentence to use: *"POM is the pattern; PageFactory is just one implementation. In my project we used plain
\`By\` locators because our page methods use explicit waits, and \`By\` plugs straight into \`ExpectedConditions\`."*

Where do **assertions** go? In the test or the Then step, not in the page object. A page object *reports* state
(\`getBadgeCount()\`); the test *judges* it. That keeps one page object reusable by positive and negative tests.

Good page methods: return data or the next page object (\`CheckoutPage goToCheckout()\`), have business names, and
take parameters instead of having one method per product.

## Cucumber vs TestNG - roles, not rivals

Interviewers love "Cucumber or TestNG?" because the honest answer is **both, for different jobs**:

- **Cucumber** is the **BDD layer**: Gherkin feature files that the business can read, step definitions (glue),
  Cucumber hooks, tags.
- **TestNG** is the **test runner / execution engine**: it starts the run, provides assertions, parallel execution
  through data providers, listeners, retry analysers and XML suites.

In a typical project, a TestNG runner class starts Cucumber, Cucumber turns scenarios into TestNG test invocations,
and assertions inside steps use TestNG's \`Assert\`.

Hooks pair up like this: Cucumber \`@Before\`/\`@After\` run around **each scenario**; TestNG
\`@BeforeMethod\`/\`@AfterMethod\` run around each TestNG test method; \`@BeforeSuite\` runs once.

When is **plain TestNG** (no Cucumber) the better choice? When nobody outside QA reads the tests - for example
technical API checks or component-level suites. Gherkin then only adds a translation layer to maintain.

## OOP: point to where it lives

"Explain OOP" is boring. "Show me OOP in your framework" is what senior interviewers ask. Have one example for each:

| Concept | Plain meaning | Where it lives in a framework |
|---|---|---|
| **Encapsulation** | hide data, expose behaviour | \`private\` \`By\` locators, public methods like \`login(user, pwd)\` |
| **Inheritance** | reuse a parent class | \`CartPage extends BasePage\` - shared \`click\`, \`type\`, wait helpers live once in \`BasePage\` |
| **Polymorphism** | one interface, many forms | \`WebDriver driver = new ChromeDriver()\` or \`new FirefoxDriver()\` - same calls; method **overloading** such as \`waitFor(By)\` and \`waitFor(By, Duration)\` |
| **Abstraction** | show what, hide how | the \`WebDriver\` interface itself; your own \`DriverFactory.getDriver()\` hides browser setup |

Two details that impress:

- \`WebDriver driver = new ChromeDriver();\` - \`WebDriver\` is an **interface**, \`ChromeDriver\` a class implementing
  it. Declaring the variable as the interface (upcasting) is what lets the framework switch browsers from config.
- **Overloading** (same method name, different parameters, chosen at compile time) vs **overriding** (a subclass
  replaces a parent method, chosen at runtime). Selenium examples: \`findElement\` overloads in your utilities;
  overriding \`onTestFailure\` in a TestNG listener.

## Answer template for design questions

1. Name the choice ("We used POM with \`By\` locators").
2. Give the reason tied to a real constraint ("because our waits need \`By\`").
3. Mention the alternative and why not ("PageFactory's proxies made waits awkward").

That pattern turns any "X vs Y" question into a short, senior-sounding answer.`,
  keyPoints: [
    'POM is the pattern; PageFactory (@FindBy) is one optional implementation that most teams now avoid.',
    'By locators plug directly into explicit waits; keep assertions out of page objects.',
    'Cucumber = BDD layer (Gherkin, glue, hooks, tags); TestNG = runner (assertions, parallel, listeners, suites).',
    'Map each OOP pillar to a concrete class in your framework, not a textbook definition.',
    'For any "X vs Y" question: choice, reason, rejected alternative.',
  ],
  mistakes: [
    'Saying "PageFactory is the Page Object Model". Fix: POM is the pattern, PageFactory a helper.',
    'Putting Assert calls inside page objects. Fix: page objects return state; tests/Then steps assert.',
    'Framing Cucumber and TestNG as competitors. Fix: explain how they work together.',
    'Defining OOP abstractly. Fix: name the BasePage, the private locators, the WebDriver interface.',
  ],
  tryIt: `Open your own framework (or sketch one) and write the class name next to each OOP concept in the table. If a row
is empty, that is the follow-up question you are not ready for yet.`,
  problems: ['int-001', 'int-002', 'int-004', 'int-010'],
}
