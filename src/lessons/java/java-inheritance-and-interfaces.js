export default {
  slug: 'java-inheritance-and-interfaces',
  category: 'java',
  order: 6,
  title: 'Inheritance, interfaces and enums',
  minutes: 9,
  summary: 'Share code through an abstract base class with extends/super/protected, program to interfaces like WebDriver, and replace magic strings with an enum and a switch.',
  manualAnalogy: `Every test case in your suite starts with the same preconditions: "browser open, user logged in". You write those once in a shared section and each test case just says "preconditions: standard". Inheritance is that shared preconditions section for code. An interface is like a job description — "a browser must be able to open a URL, find elements, quit" — and Chrome, Firefox and Edge are three people who all fulfil it.`,
  body: `## extends: inherit what the parent has

\`\`\`java
public class Animal {
    protected String name;
    public Animal(String name) { this.name = name; }
    public String describe() { return "I am " + name; }
}

public class Dog extends Animal {
    public Dog(String name) {
        super(name);                 // run the parent's constructor first
    }
    public String bark() { return name + " says woof"; }  // can use 'name'
}
\`\`\`

- \`Dog extends Animal\` — a Dog **is an** Animal. It gets \`name\` and \`describe()\` for free.
- \`super(name)\` calls the parent constructor. If the parent has no no-argument constructor, the child **must** call \`super(...)\`, and it must be the first line.
- \`protected\` lets the child see \`name\`, while unrelated classes cannot.

## abstract: a parent you never create directly

\`\`\`java
public abstract class BaseComponent {
    protected final WebDriver driver;

    protected BaseComponent(WebDriver driver) {
        this.driver = driver;
    }

    protected boolean isVisible(By locator) {
        List<WebElement> found = driver.findElements(locator);
        return !found.isEmpty() && found.get(0).isDisplayed();
    }
}

public class HeaderBar extends BaseComponent {
    private final By cartLink = By.id("shopping-cart-link");

    public HeaderBar(WebDriver driver) { super(driver); }

    public boolean isCartLinkShown() { return isVisible(cartLink); }
}
\`\`\`

\`abstract\` means "\`new BaseComponent(driver)\` is not allowed" — it only exists to be extended. Every page or component gets \`driver\` and the shared helpers once, so things like a wait object are created in **one** place and every child reuses them. Child classes stay short: locators plus business actions.

## Overriding

A child can replace a parent method with its own version, marked \`@Override\`:

\`\`\`java
@Override
public String describe() { return "Dog: " + name; }
\`\`\`

\`@Override\` asks the compiler to check you really are replacing a parent method — a typo in the name becomes a compile error instead of a silent new method.

## Overriding vs overloading: who decides?

The two words sound alike but are decided at different moments:

\`\`\`java
Animal pet = new Dog("Rex");
pet.describe();          // OVERRIDE: runs Dog's describe(). The real object decides, at run time.

static String vet(Animal a) { return "general vet"; }
static String vet(Dog d)    { return "dog vet"; }
vet(pet);                // OVERLOAD: "general vet". The declared type (Animal) decides, at compile time.
\`\`\`

- **Overriding**: same name *and* same parameters in a subclass. Java looks at the actual object when the line runs.
- **Overloading**: same name, *different* parameters (\`click(By)\` / \`click(WebElement)\`). The compiler picks one from the declared types of the arguments. A different return type alone is not an overload, and it won't compile.
- The parent constructor always runs first: \`new Dog(...)\` runs \`Animal\`'s constructor via \`super(...)\`. This also holds for an abstract parent like \`BaseComponent\` above, which is why abstract classes can have constructors.

## Interfaces: a contract, not code

\`\`\`java
public interface PaymentMethod {
    boolean pay(double amount);       // no body: just the promise
}
public class CardPayment implements PaymentMethod {
    public boolean pay(double amount) { ... }
}
\`\`\`

\`WebDriver\` is an interface. \`ChromeDriver\`, \`FirefoxDriver\` and \`EdgeDriver\` **implement** it. That is why we write:

\`\`\`java
WebDriver driver = new FirefoxDriver();   // declared type: the interface
\`\`\`

Everything after this line uses only \`WebDriver\` methods, so switching browsers changes one line. This is **polymorphism**: one declared type, many possible real objects. Declaring \`ChromeDriver driver\` ties your whole framework to Chrome.

| | abstract class | interface |
|---|---|---|
| Keyword for child | \`extends\` (only one) | \`implements\` (many allowed) |
| Can hold fields/state | yes | only constants |
| Use it for | sharing code (BasePage) | sharing a contract (WebDriver) |

## enum: a fixed set of named values

Strings like \`"staging"\` are easy to mistype and the compiler cannot help. An enum lists every allowed value:

\`\`\`java
public enum Environment { DEV, QA, STAGING }

public static String baseUrl(Environment env) {
    switch (env) {
        case DEV:     return "http://localhost:5180";
        case QA:      return "https://qa.shop.example";
        case STAGING: return "https://staging.shop.example";
        default: throw new IllegalArgumentException("Unknown env " + env);
    }
}
\`\`\`

- \`Environment.QA\` is checked by the compiler — \`Environment.QAA\` will not compile.
- \`switch\` picks a branch by value; \`return\` leaves the method so no \`break\` is needed here.

Turning user input into an enum:

\`\`\`java
Environment env = Environment.valueOf(System.getProperty("env", "qa").toUpperCase());
\`\`\`

\`valueOf\` needs the exact constant name (hence \`toUpperCase()\`); an unknown value throws \`IllegalArgumentException\` immediately — a typo in \`-Denv=stagng\` fails at the start of the run instead of half way through.

## A note on browser options

Browser-specific settings live in options objects: \`ChromeOptions options = new ChromeOptions(); options.addArguments("--window-size=1280,800");\` then \`new ChromeDriver(options)\`. Firefox and Edge have \`FirefoxOptions\` and \`EdgeOptions\`.`,
  keyPoints: [
    'extends = inherit fields and methods; call super(...) first in the child constructor.',
    'protected members are visible to subclasses; abstract classes cannot be instantiated.',
    'Shared page plumbing (driver, waits, helpers) belongs in one base class.',
    'Declare variables by the interface (WebDriver), not the class (ChromeDriver).',
    'enum + switch replace error-prone magic strings; valueOf fails fast on typos.',
    'Overrides are chosen at run time from the real object; overloads at compile time from declared types.',
  ],
  mistakes: [
    'Forgetting super(driver) in a child page constructor — compile error when the parent has no empty constructor.',
    'Creating a new WebDriverWait in every page/method — create it once in the base class.',
    'Declaring ChromeDriver driver everywhere — use WebDriver so browsers are swappable.',
    'Calling Enum.valueOf("chrome") with lowercase input — call toUpperCase() first.',
  ],
  tryIt: `List the pages on the practice site (login, inventory, cart, checkout). Write down which locators or helpers appear on more than one — those belong in a base class or a shared component (the header with \`shopping-cart-link\` and \`logout-link\` is a good start).`,
  problems: ['java-009', 'java-010', 'java-024', 'java-031', 'java-039'],
}
