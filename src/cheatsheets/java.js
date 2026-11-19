const F = '```'

export default {
  slug: 'java',
  title: 'Core Java for Testers',
  sections: [
    {
      heading: 'Types and variables',
      body: `Use the type that matches the business meaning of the data you read from the page.

| Type | Use in tests | Example |
|---|---|---|
| \`String\` | any text from \`getText()\`, URLs, locators | \`String title = driver.getTitle();\` |
| \`int\` / \`Integer\` | counts, timeouts, indexes | \`int rows = table.size();\` |
| \`double\` / \`BigDecimal\` | prices (\`BigDecimal\` for exact money) | \`new BigDecimal("29.99")\` |
| \`boolean\` | displayed / enabled / selected | \`boolean shown = el.isDisplayed();\` |
| \`var\` (Java 10+) | local variable with an obvious type | \`var wait = new WebDriverWait(driver, Duration.ofSeconds(10));\` |

* Primitives (\`int\`, \`double\`, \`boolean\`) can't be \`null\`; wrappers (\`Integer\`, \`Double\`) can, and are what collections hold.
* Parsing: \`Integer.parseInt("42")\`, \`Double.parseDouble("29.99")\`, \`Boolean.parseBoolean("true")\`.
* Constants: \`private static final int TIMEOUT_SECONDS = 10;\``,
    },
    {
      heading: 'String methods for assertions',
      body: `${F}java
String raw = "  Total: $1,299.00  ";
raw.trim();                       // "Total: $1,299.00"   (returns NEW string - assign it!)
raw.strip();                      // like trim(), Unicode-aware (Java 11+)
raw.contains("Total");            // true  (case-sensitive)
raw.toLowerCase().contains("total");
"OK".equals(actual);              // content comparison, null-safe order
a.equalsIgnoreCase(b);            // ignore case (CSS text-transform)
raw.replace("$", "").replace(",", "");   // remove symbols before parsing
raw.split(":")[1].trim();         // "$1,299.00"
raw.startsWith("  Total");  raw.endsWith(".00  ");
raw.isBlank();                    // only whitespace? (Java 11+)
String.format("//tr[td[text()='%s']]//button", orderId);   // dynamic XPath
"Hello %s".formatted(name);       // Java 15+
${F}

* **\`==\` compares references, \`equals\` compares text.** Never use \`==\` on Strings.
* Strings are **immutable**: every method returns a new String.
* \`"Total: " + 10 + 5\` → \`"Total: 105"\` — wrap arithmetic in parentheses.`,
    },
    {
      heading: 'Control flow and loops',
      body: `${F}java
for (WebElement row : rows) { ... }                 // for-each: visit every element
for (int i = 0; i < prices.size() - 1; i++) {        // index loop: compare neighbours
    if (prices.get(i) > prices.get(i + 1)) fail("not sorted at " + i);
}
while (!page.isLoaded() && attempts++ < 5) { ... }   // condition-based loop (prefer WebDriverWait)

if (price < min || price > max) { failures.add(text); }   // || = or, && = and, ! = not

String url = switch (env) {                          // switch expression (Java 14+)
    case QA -> "https://qa.shop.example";
    case STAGING -> "https://staging.shop.example";
    default -> throw new IllegalArgumentException("Unknown env " + env);
};
${F}

Collect all failures and assert once at the end — one run reports every defect.`,
    },
    {
      heading: 'Methods',
      body: `${F}java
public static double parsePrice(String text) {        // static: no object needed (utility)
    return Double.parseDouble(text.replace("$", "").replace(",", "").trim());
}

public void loginAs(String user, String pass) { ... } // void: an action
public String getErrorMessage() { ... }              // returns a value: a query

public void click(By locator) { ... }                // overloading: same name,
public void click(WebElement element) { ... }        // different parameters
${F}

* Helpers **return** values; tests assert on them. A helper that only prints can't be asserted.
* Keep methods small and named after the business action.`,
    },
    {
      heading: 'OOP pillars with automation examples',
      body: `| Pillar | Meaning | Where you see it |
|---|---|---|
| **Encapsulation** | hide data, expose behaviour | \`private final By loginButton\` + \`public void loginAs(...)\` in page objects |
| **Inheritance** | "is-a", reuse parent code | \`LoginPage extends BasePage\`, \`LoginTest extends BaseTest\` |
| **Polymorphism** | one interface, many implementations | \`WebDriver driver = new ChromeDriver();\` / \`new FirefoxDriver()\` |
| **Abstraction** | expose *what*, hide *how* | \`WebDriver\` interface, abstract \`BasePage\`, \`loginAs()\` hides the steps |

${F}java
public abstract class BasePage {
    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;                               // this. = the field
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }
    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }
}

public class LoginPage extends BasePage {
    private final By email = By.id("email");
    public LoginPage(WebDriver driver) { super(driver); }  // super(...) first line
}
${F}

**Access modifiers:** \`private\` (class) < default (package) < \`protected\` (package + subclasses) < \`public\` (everyone).

**static vs instance:** static = one copy per class (config, utilities, constants). Instance = one per object (driver, pages, test data). A \`public static WebDriver\` breaks parallel runs — use \`ThreadLocal<WebDriver>\`.

**Interface vs abstract class:** a class implements many interfaces but extends one class; abstract classes can hold state and constructors.`,
    },
    {
      heading: 'Classes, constructors, records, enums',
      body: `${F}java
public class User {
    private final String email;
    private final String role;
    public User(String email, String role) { this.email = email; this.role = role; }
    public User(String email) { this(email, "customer"); }   // overloaded constructor
    public String getEmail() { return email; }
}

public record Product(String name, double price) { }        // Java 16+: immutable data class

public enum Browser { CHROME, FIREFOX, EDGE }
Browser b = Browser.valueOf(System.getProperty("browser", "chrome").toUpperCase());

public enum Environment {
    QA("https://qa.shop.example"), STAGING("https://staging.shop.example");
    private final String baseUrl;
    Environment(String baseUrl) { this.baseUrl = baseUrl; }
    public String baseUrl() { return baseUrl; }
}
${F}`,
    },
    {
      heading: 'Collections',
      body: `| Need | Use | Example |
|---|---|---|
| ordered, duplicates OK | \`List\` / \`ArrayList\` | product names in page order |
| unique values | \`Set\` / \`HashSet\` / \`LinkedHashSet\` | detect duplicate order ids |
| key → value | \`Map\` / \`HashMap\` / \`LinkedHashMap\` | field id → value, role → user |

${F}java
List<WebElement> cards = driver.findElements(By.cssSelector(".product-card"));  // empty list if none
List<String> names = new ArrayList<>();
for (WebElement c : cards) names.add(c.getText().trim());

List<Double> expected = new ArrayList<>(actual);   // COPY before sorting
Collections.sort(expected);                         // or expected.sort(Comparator.reverseOrder())
assertEquals(actual, expected);                     // same elements, same order

Set<String> seen = new HashSet<>();
for (String id : ids) if (!seen.add(id)) duplicates.add(id);   // add() false = already present

Map<String, String> data = new LinkedHashMap<>();   // keeps insertion order
data.put("firstName", "Asha");
for (Map.Entry<String, String> e : data.entrySet())
    driver.findElement(By.id(e.getKey())).sendKeys(e.getValue());

List.of("a", "b");  Map.of("k", "v");  Set.of(1, 2);   // immutable factories
${F}`,
    },
    {
      heading: 'Exceptions',
      body: `${F}java
try {
    return driver.findElement(locator).isDisplayed();
} catch (NoSuchElementException e) {      // org.openqa.selenium, NOT java.util
    return false;                         // catch narrowly, never leave catch empty
} finally {
    // always runs (cleanup) - even after return
}

try (InputStream in = Files.newInputStream(path)) { ... }   // try-with-resources auto-closes

public class TestDataException extends RuntimeException {
    public TestDataException(String message) { super(message); }
}
throw new TestDataException("Missing key: " + key);
${F}

* **Checked** (\`IOException\`) must be caught or declared with \`throws\`; **unchecked** (\`RuntimeException\`, all Selenium exceptions) need not.
* Catch order: most specific first, or the code won't compile.
* Selenium: \`NoSuchElementException\`, \`TimeoutException\`, \`StaleElementReferenceException\`, \`ElementClickInterceptedException\`, \`ElementNotInteractableException\` — all extend \`WebDriverException\`.
* \`findElement\` throws when nothing matches; \`findElements\` returns an empty list.
* A caught exception without an assertion = a green test. Fail loudly.`,
    },
    {
      heading: 'Reading config (.properties)',
      body: `${F}java
public final class ConfigReader {
    private static final Properties PROPS = new Properties();
    static {                                   // runs once, on first use
        try (InputStream in = ConfigReader.class.getClassLoader()
                .getResourceAsStream("config.properties")) {
            PROPS.load(in);
        } catch (IOException e) {
            throw new RuntimeException("Cannot load config.properties", e);
        }
    }
    public static String get(String key) {
        return System.getProperty(key, PROPS.getProperty(key));   // -Dkey=value wins
    }
}
// mvn test -Dbrowser=firefox -Denv=staging
${F}`,
    },
    {
      heading: 'Streams and lambdas',
      body: `${F}java
List<String> titles = cards.stream()
        .map(WebElement::getText)              // transform
        .map(String::trim)
        .filter(t -> !t.isEmpty())             // keep matching
        .collect(Collectors.toList());         // or .toList() (Java 16+, unmodifiable)

List<String> offenders = titles.stream()
        .filter(t -> !t.toLowerCase().contains("laptop")).toList();
assertTrue(offenders.isEmpty(), "Irrelevant results: " + offenders);

boolean sortedDesc = prices.stream().sorted(Comparator.reverseOrder()).toList().equals(prices);
boolean allInStock = labels.stream().allMatch(l -> l.equals("In stock"));
long distinct = ids.stream().distinct().count();          // duplicates if != ids.size()
double total = prices.stream().mapToDouble(Double::doubleValue).sum();
${F}

* Intermediate ops (\`map\`, \`filter\`, \`sorted\`, \`distinct\`) are lazy; a terminal op (\`collect\`, \`toList\`, \`count\`, \`allMatch\`) runs the pipeline.
* Functional interfaces: \`Supplier<T>\` () → T, \`Consumer<T>\` T → void, \`Function<T,R>\` T → R, \`Predicate<T>\` T → boolean, \`Runnable\` () → void.
* Generic method: \`public static <T> T retry(Supplier<T> action, int attempts)\` — \`T\` is inferred from the lambda.`,
    },
  ],
}
