export default {
  slug: 'java-classes-and-encapsulation',
  category: 'java',
  order: 4,
  title: 'Classes, objects and encapsulation',
  minutes: 9,
  summary: 'Design a class with private fields, constructors (including this(...) chaining), getters and public action methods — the exact shape of a Page Object.',
  manualAnalogy: `A test-data sheet has a template (columns: first name, email, role…) and many rows filled in from it. A **class** is the template; each **object** is one filled-in row. Encapsulation is like a locked test environment: testers use the documented actions, they do not edit the database directly — so nobody can break it by accident.`,
  body: `## Class = blueprint, object = thing built from it

\`\`\`java
public class Product {
    private String name;          // fields: data each object carries
    private double price;

    public Product(String name, double price) {   // constructor
        this.name = name;
        this.price = price;
    }

    public String getName() { return name; }      // getter
    public double getPrice() { return price; }
}
\`\`\`

\`\`\`java
Product light = new Product("Pulse Bike Light", 9.99);
Product jacket = new Product("Storm Fleece Jacket", 49.99);
System.out.println(light.getName());   // Pulse Bike Light
\`\`\`

- **Fields** hold an object's data. Each object has its own copy: \`light\` and \`jacket\` have different names.
- \`new Product(...)\` builds an object and runs the **constructor**.
- The constructor has the same name as the class and **no return type** (not even \`void\`).

## this: "the field of this object"

Inside the constructor the parameter is called \`name\` and the field is also called \`name\`. \`this.name\` means *the field*; plain \`name\` means *the parameter*. So \`this.name = name;\` copies the argument into the object. Without \`this.\`, you would assign the parameter to itself and the field would stay \`null\`.

## Two constructors: overloading and this(...)

Often most objects share a default. Instead of duplicating the assignments, one constructor calls the other with \`this(...)\`. Say \`Product\` gains a third field, \`private String currency;\`:

\`\`\`java
public Product(String name, double price, String currency) {
    this.name = name;
    this.price = price;
    this.currency = currency;
}

public Product(String name, double price) {
    this(name, price, "USD");     // must be the FIRST line
}
\`\`\`

\`new Product("Retro Red Tee", 15.99)\` now gets USD automatically. Only one constructor contains the real assignments.

## Access modifiers

| Modifier | Who can see it |
|---|---|
| \`private\` | Only code inside the same class |
| *(nothing)* — "package-private" | Classes in the same package |
| \`protected\` | Same package **and** subclasses (see the *Inheritance* lesson) |
| \`public\` | Everyone |

**Encapsulation** = make fields \`private\`, expose only the methods other code genuinely needs. Benefits: nobody can set \`price = -5\` from outside, and you can change how data is stored without breaking callers.

Getters (\`getName()\`) give read access. Add setters only when something really needs to change a value — and a getter can compute instead of just returning a field:

\`\`\`java
public String getLabel() { return name + " (" + price + ")"; }
\`\`\`

## The same idea applied to a page

A Page Object is just a class whose fields are the driver and the locators, and whose public methods are the things a user can do on that page.

\`\`\`java
public class CartPage {
    private final WebDriver driver;
    private final By checkoutButton = By.id("checkout");
    private final By continueShopping = By.id("continue-shopping");

    public CartPage(WebDriver driver) {
        this.driver = driver;
    }

    public void proceedToCheckout() {                  // action
        driver.findElement(checkoutButton).click();
    }

    public boolean isCheckoutEnabled() {               // query
        return driver.findElement(checkoutButton).isEnabled();
    }
}
\`\`\`

- \`private final\` locators: tests cannot read or reassign them. \`final\` means "assigned once, never changed".
- The driver comes in through the **constructor** — the page does not create its own browser.
- **Action methods** do something (\`void\` or return the next page). **Query methods** return information for the test to assert on.
- The test reads like a test case: \`cart.proceedToCheckout();\` — no \`By\`, no \`findElement\`.

If a developer renames the \`checkout\` id, you fix **one** private field. If the locators were \`public\`, every test that used them directly would need fixing too.`,
  keyPoints: [
    'A class is a blueprint; new ClassName(...) creates an object and runs the constructor.',
    'this.field = parameter copies constructor arguments into the object.',
    'Overloaded constructors should chain with this(...) as the first line.',
    'Encapsulation: private fields, public methods; final for things set once.',
    'A Page Object = private driver + private locators + public action/query methods.',
  ],
  mistakes: [
    'Writing name = name; in the constructor — the field stays null. Use this.name = name;',
    'Giving the constructor a return type (public void Product(...)) — it silently becomes a normal method.',
    'Making locators public so tests can use them directly — keep them private and expose actions.',
    'Putting this(...) anywhere but the first line of a constructor — compile error.',
  ],
  tryIt: `Inspect http://localhost:5180/practice-site/checkout.html and sketch a \`CheckoutInfoPage\` class on paper: which ids become private fields, which public methods would a test want (e.g. \`enterShipping(...)\`, \`getErrorText()\`)?`,
  problems: ['java-005', 'java-006'],
}
