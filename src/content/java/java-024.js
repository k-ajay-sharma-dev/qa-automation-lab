export default {
  id: 'java-024',
  category: 'java',
  kind: 'quiz',
  title: 'Overloading vs overriding, abstract class vs interface: predict the output',
  level: 'INTERMEDIATE',
  tags: ['oop', 'overloading', 'overriding', 'abstract-class', 'interfaces', 'interview'],
  estMinutes: 12,
  scenario: `"Explain polymorphism with an example from your framework" is asked in nearly every SDET interview. The follow-up is always a snippet where a \`BasePage\` variable holds a \`CartPage\`, with one overloaded and one overridden method, and the question is which one runs.
Your framework already has all of this: an abstract \`BasePage\`, the \`WebDriver\` interface, \`click(By)\` and \`click(WebElement)\` overloads. These questions use ShopEasy's own page classes.`,
  description: `Trace each snippet. Keep two rules in mind: **overloads are chosen at compile time from the declared types**, and **overrides are chosen at run time from the real object**.`,
  questions: [
    {
      q: `What does this print?
\`\`\`java
class BasePage {
    String name() { return "base"; }
}
class CartPage extends BasePage {
    @Override
    String name() { return "cart"; }
}

BasePage page = new CartPage();
System.out.println(page.name());
\`\`\``,
      options: ['base', 'cart', 'Compile error: page is a BasePage', 'ClassCastException'],
      answer: 1,
      why: 'This is **overriding** (runtime polymorphism). The variable is declared as `BasePage`, but the object is a `CartPage`, and Java picks the overridden method from the **real object** at run time. It is the same reason `WebDriver driver = new ChromeDriver()` runs Chrome\'s `get()`.',
    },
    {
      q: `What does this print?
\`\`\`java
static String describe(BasePage p) { return "base page"; }
static String describe(CartPage p) { return "cart page"; }

BasePage page = new CartPage();
System.out.println(describe(page));
\`\`\``,
      options: ['base page', 'cart page', 'Compile error: ambiguous call', 'It depends on the JVM'],
      answer: 0,
      why: 'This is **overloading**. The compiler picks the version from the **declared type** of the argument (`BasePage`), at compile time. The real object doesn\'t matter here, so "base page" is printed. Overloading is resolved when compiling, overriding when running.',
    },
    {
      q: `What does \`new LoginPage()\` print?
\`\`\`java
abstract class BasePage {
    BasePage() { System.out.println("BasePage ready"); }
}
class LoginPage extends BasePage {
    LoginPage() { System.out.println("LoginPage ready"); }
}
\`\`\``,
      options: [
        'LoginPage ready',
        'BasePage ready / LoginPage ready',
        'LoginPage ready / BasePage ready',
        'Compile error: an abstract class cannot have a constructor',
      ],
      answer: 1,
      why: 'An abstract class **can** have a constructor. It runs when a subclass object is created. Java inserts `super()` as the first line of `LoginPage()`, so the parent part is built first. That is why `BasePage` is the natural place to create the shared `WebDriverWait`.',
    },
    {
      q: `Which line does **not** compile?
\`\`\`java
interface Timeouts {
    int SHORT = 5;                         // line 1
    int waitFor(String locator);           // line 2
    default int longWait() { return 30; }  // line 3
}
class Waits implements Timeouts {
    public int waitFor(String locator) {
        Timeouts.SHORT = 10;               // line 4
        return SHORT;
    }
}
\`\`\``,
      options: ['line 1', 'line 2', 'line 3', 'line 4'],
      answer: 3,
      why: 'Fields in an interface are automatically `public static final`: they are **constants**, so assigning to `SHORT` doesn\'t compile. Line 2 is an abstract method and line 3 is a valid `default` method (Java 8+). Interfaces describe behaviour. They can\'t hold changeable state, and a `BasePage` with a driver field needs a class.',
    },
    {
      q: `Is this a valid overload inside one \`CartPage\` class?
\`\`\`java
int itemCount() { ... }
long itemCount() { ... }
\`\`\``,
      options: [
        'Yes: different return types make different methods',
        'No: overloads must differ in their parameter lists; the return type alone is not enough',
        'Yes, but only if one of them is static',
        'Only with @Overload',
      ],
      answer: 1,
      why: 'A method\'s **signature** is its name plus its parameter types. The return type is not part of it, so these two clash ("method already defined"). Valid overloads look like `click(By)` / `click(WebElement)`, or `waitFor(By)` / `waitFor(By, Duration)`.',
    },
    {
      q: 'Your pages share a driver, a `WebDriverWait` and helper methods, and some pages (header, footer) are also "screenshot-able" components. What is the best design?',
      options: [
        'Make BasePage an interface with fields for driver and wait',
        'Abstract class BasePage for the shared state and helpers, plus a small interface (e.g. `Screenshotable`) for the extra capability',
        'Copy the driver and wait into each page; inheritance is bad practice',
        'Make every page extend both BasePage and ComponentBase',
      ],
      answer: 1,
      why: 'Use an **abstract class** when subclasses share *state and code*. A class can extend only one. Use an **interface** for a *capability* that unrelated classes can have, and a class can implement many. Option A is impossible (interface fields are constants), and D is multiple inheritance of classes, which Java doesn\'t allow.',
    },
  ],
  hints: [
    'Overloading: same name, different parameters, chosen at compile time from declared types.',
    'Overriding: same signature in a subclass, chosen at run time from the actual object.',
  ],
  explanation: `| | Overloading | Overriding |
|---|---|---|
| Where | same class (or inherited) | subclass replaces parent method |
| Signature | **different** parameters | **same** name and parameters |
| Chosen | compile time, by declared types | run time, by the actual object |
| Framework example | \`click(By)\` / \`click(WebElement)\` | \`CartPage.isLoaded()\` overriding \`BasePage.isLoaded()\` |

| | Abstract class | Interface |
|---|---|---|
| Fields | any (driver, wait) | constants only (\`public static final\`) |
| Constructor | yes, runs via \`super()\` | no |
| Methods | abstract + concrete | abstract + \`default\` + \`static\` |
| A class can have | one parent | many interfaces |
| Framework example | \`BasePage\`, \`BaseTest\` | \`WebDriver\`, \`TakesScreenshot\`, \`JavascriptExecutor\` |

Selenium uses both: \`RemoteWebDriver\` *extends* one class and *implements* many interfaces (\`WebDriver\`, \`TakesScreenshot\`, \`JavascriptExecutor\`). That's why \`((TakesScreenshot) driver).getScreenshotAs(...)\` works: the object has that capability even though the variable is declared as \`WebDriver\`.`,
  mistakes: [
    'Expecting an overloaded method to be picked from the runtime object, the way an override is.',
    'Thinking abstract classes cannot have constructors, so the shared setup ends up copied into every page.',
    'Trying to store the driver in an interface field (it becomes a constant, shared and unassignable).',
    'Leaving out @Override, so a typo in the method name silently creates a new method instead of overriding.',
  ],
  interview: [
    { q: 'What is polymorphism? Give an example from Selenium.', a: 'One reference type, many object types, with the right method chosen at run time. WebDriver driver = new ChromeDriver() or new FirefoxDriver(): the same driver.get(url) call runs each browser\'s own code. Overloading is sometimes called compile-time polymorphism.' },
    { q: 'Can you override a private or static method?', a: 'No. Private methods are not visible to subclasses, so a method with the same name is a brand-new method. Static methods are hidden, not overridden: which one runs depends on the declared type, not the object.' },
    { q: 'When would you choose an interface over an abstract class?', a: 'When you describe a capability that unrelated classes can have, or need a class to have several of them, for example a component that can be screenshotted or a page that has a header. Choose an abstract class when subclasses share fields and code, like BasePage with its driver, waits and helper methods.' },
  ],
}
