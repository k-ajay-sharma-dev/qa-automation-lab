export default {
  id: 'cuc-012',
  category: 'cucumber',
  kind: 'code',
  language: 'java',
  title: 'Share state between step classes with PicoContainer',
  level: 'ADVANCED',
  tags: ['dependency-injection', 'picocontainer', 'test-context', 'parallel'],
  estMinutes: 30,
  scenario: `The project now has \`LoginSteps\`, \`CartSteps\` and \`CheckoutSteps\`. CartSteps remembers which product was added
in a \`public static String lastProduct\` so CheckoutSteps can verify it, and the driver is a \`static\` field too. Since parallel execution was switched on,
scenarios read each other's products and close each other's browsers. The fix: **dependency injection** with \`cucumber-picocontainer\`.`,
  description: `Refactor to a per-scenario \`TestContext\` injected into each step class.

Maven dependency (already added):
\`\`\`xml
<dependency>
  <groupId>io.cucumber</groupId>
  <artifactId>cucumber-picocontainer</artifactId>
  <version>7.18.0</version>
  <scope>test</scope>
</dependency>
\`\`\`

**Rules**
- \`TestContext\` holds the \`WebDriver\` and a scenario-scoped data map (or typed fields).
- Step classes receive \`TestContext\` through their **constructor** — no \`new TestContext()\` and no \`static\` state.
- \`CartSteps\` stores the product name in the context; \`CheckoutSteps\` reads it.
- Page objects are created from \`context.getDriver()\`.`,
  starterCode: `// ----- TestContext.java -----
package com.shopeasy.support;

public class TestContext {
    // TODO
}

// ----- CartSteps.java -----
package com.shopeasy.steps;

public class CartSteps {
    public static WebDriver driver = DriverFactory.getDriver();
    public static String lastProduct;

    @When("the shopper adds {string} to the cart")
    public void addsToCart(String product) {
        new InventoryPage(driver).addToCart(product);
        lastProduct = product;
    }
}

// ----- CheckoutSteps.java -----
package com.shopeasy.steps;

public class CheckoutSteps {
    @Then("the overview lists the added product")
    public void overviewListsProduct() {
        Assert.assertTrue(new CheckoutPage(CartSteps.driver).getItemNames().contains(CartSteps.lastProduct));
    }
}
`,
  solution: `// ----- TestContext.java -----
package com.shopeasy.support;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

import java.util.HashMap;
import java.util.Map;

/** One instance per scenario - PicoContainer creates it and injects it everywhere. */
public class TestContext {

    private WebDriver driver;
    private final Map<String, Object> data = new HashMap<>();

    public WebDriver getDriver() {
        if (driver == null) {
            driver = new ChromeDriver();
        }
        return driver;
    }

    public void quitDriver() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }

    public void put(String key, Object value) { data.put(key, value); }

    @SuppressWarnings("unchecked")
    public <T> T get(String key) { return (T) data.get(key); }
}

// ----- CartSteps.java -----
package com.shopeasy.steps;

import com.shopeasy.pages.InventoryPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.When;

public class CartSteps {

    private final TestContext context;
    private final InventoryPage inventoryPage;

    public CartSteps(TestContext context) {
        this.context = context;
        this.inventoryPage = new InventoryPage(context.getDriver());
    }

    @When("the shopper adds {string} to the cart")
    public void addsToCart(String product) {
        inventoryPage.addToCart(product);
        context.put("lastProduct", product);
    }
}

// ----- CheckoutSteps.java -----
package com.shopeasy.steps;

import com.shopeasy.pages.CheckoutPage;
import com.shopeasy.support.TestContext;
import io.cucumber.java.en.Then;
import org.testng.Assert;

public class CheckoutSteps {

    private final TestContext context;
    private final CheckoutPage checkoutPage;

    public CheckoutSteps(TestContext context) {
        this.context = context;
        this.checkoutPage = new CheckoutPage(context.getDriver());
    }

    @Then("the overview lists the added product")
    public void overviewListsProduct() {
        String product = context.get("lastProduct");
        Assert.assertTrue(checkoutPage.getItemNames().contains(product),
                "Checkout overview should list " + product);
    }
}

// ----- Hooks.java (closes the scenario's own browser) -----
// public Hooks(TestContext context) { this.context = context; }
// @After public void tearDown() { context.quitDriver(); }
`,
  checks: [
    { label: 'TestContext holds the WebDriver', pattern: 'class\\s+TestContext[\\s\\S]*WebDriver', hint: 'Give TestContext a WebDriver field with a getter.' },
    { label: 'CartSteps gets TestContext via constructor', pattern: 'public\\s+CartSteps\\s*\\(\\s*TestContext\\s+\\w+\\s*\\)', hint: 'public CartSteps(TestContext context)' },
    { label: 'CheckoutSteps gets TestContext via constructor', pattern: 'public\\s+CheckoutSteps\\s*\\(\\s*TestContext\\s+\\w+\\s*\\)', hint: 'public CheckoutSteps(TestContext context)' },
    { label: 'No static shared state', pattern: '\\bstatic\\s+(?!final\\s+\\w+\\s+[A-Z_]+\\s*=)(WebDriver|String|\\w+\\s+\\w+\\s*;)', mustNot: true, hint: 'Remove public static fields; put data in the context.' },
    { label: 'Never constructs TestContext manually', pattern: 'new\\s+TestContext\\s*\\(', mustNot: true, hint: 'PicoContainer creates it — just declare it in the constructor.' },
    { label: 'Product passed through the context', pattern: 'context\\.(put|set\\w*)\\s*\\(', hint: 'context.put("lastProduct", product)' },
  ],
  hints: [
    'With cucumber-picocontainer on the classpath, Cucumber builds step classes by calling their constructors and injecting the parameters.',
    'PicoContainer creates ONE TestContext per scenario and gives the same instance to every class that asks for it.',
    'Hooks can take TestContext in their constructor too — that is how @After quits the right browser.',
  ],
  explanation: `Cucumber creates **new** step-class instances for every scenario. To share data across classes within a scenario, add an
object-factory module — PicoContainer is the lightest (Spring and Guice also exist). It does constructor injection: any class whose
constructor asks for \`TestContext\` gets the same instance for the duration of that scenario, then it is thrown away.

That gives you:
- **Isolation** — no static leaks between scenarios or parallel threads.
- **No ordering assumptions** — CheckoutSteps does not know CartSteps exists.
- **One owner of the driver** — hooks receive the same context and quit exactly that browser.

Typed fields (\`private String lastProduct\`) or small "world" objects (\`CartState\`, \`UserState\`) are even safer than a \`Map<String,Object>\` — keys become compile-checked.`,
  mistakes: [
    'Keeping static WebDriver/variables — fine single-threaded, broken in parallel.',
    'Instantiating new TestContext() in each step class — every class gets a different object, nothing is shared.',
    'Forgetting the cucumber-picocontainer dependency → "Step class has no default constructor" errors.',
    'Using PicoContainer AND Spring dependencies together — Cucumber refuses to start with two object factories.',
  ],
  interview: [
    { q: 'How do you share state between step definition classes in Cucumber?', a: 'With dependency injection: add cucumber-picocontainer and receive a shared TestContext/World object in each step class constructor. Pico creates one per scenario, so state is shared within a scenario and isolated between scenarios.' },
    { q: 'Why not static variables?', a: 'Statics outlive scenarios and are shared across threads, so parallel runs and later scenarios see stale or foreign data — classic flaky tests.' },
    { q: 'What is the lifecycle of objects created by PicoContainer?', a: 'Scenario-scoped: created lazily on first need in a scenario, disposed after it. Implementing Disposable/Startable lets you hook into that lifecycle.' },
  ],
}
