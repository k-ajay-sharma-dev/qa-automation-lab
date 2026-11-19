export default {
  id: 'java-036',
  category: 'java',
  kind: 'quiz',
  title: 'Packages and access modifiers: why StepDefs cannot see BasePage.waitVisible',
  level: 'BEGINNER',
  tags: ['packages', 'access-modifiers', 'protected', 'package-private', 'imports', 'interview'],
  estMinutes: 10,
  scenario: `The framework was reorganised into packages: \`com.shopeasy.pages\` (BasePage, InventoryPage, CartPage), \`com.shopeasy.steps\` (Cucumber step definitions) and \`com.shopeasy.utils\`.
After the move, 14 compile errors appeared: "waitVisible(By) has protected access in BasePage", "PriceUtils is not public in com.shopeasy.utils". Nothing in the logic changed. Only the **packages** did, and with them, who is allowed to see what.`,
  description: `Answer each question using the four Java access levels: \`public\`, \`protected\`, *package-private* (no keyword) and \`private\`.`,
  questions: [
    {
      q: `\`BasePage\` is in \`com.shopeasy.pages\`. Which classes can call \`waitVisible\`?
\`\`\`java
package com.shopeasy.pages;
public abstract class BasePage {
    protected WebElement waitVisible(By locator) { ... }
}
\`\`\``,
      options: [
        'Only BasePage itself',
        'Every class in com.shopeasy.pages, plus subclasses of BasePage in any package',
        'Only subclasses of BasePage',
        'Every class in the project',
      ],
      answer: 1,
      why: '`protected` = package-private **plus** subclasses. So `InventoryPage` (same package, and a subclass) can call it, and a subclass in another package can call it too. A step definition in `com.shopeasy.steps` that is **not** a subclass cannot. That is the compile error from the scenario, and it is a good thing: steps should call page methods like `addToCart(...)`, not raw waits.',
    },
    {
      q: `This class has **no** access keyword. What happens when \`CheckoutSteps\` in \`com.shopeasy.steps\` uses it?
\`\`\`java
package com.shopeasy.utils;
class PriceUtils {
    static BigDecimal parse(String text) { ... }
}
\`\`\``,
      options: [
        'It works; no keyword means public',
        'Compile error: PriceUtils is package-private, visible only inside com.shopeasy.utils',
        'It works at compile time but throws IllegalAccessError at run time',
        'It works because static methods are always public',
      ],
      answer: 1,
      why: 'No keyword means **package-private** (also called "default access"): visible only to classes in the **same package**. Java does not default to `public`. A utility meant for the whole framework needs `public class PriceUtils` and `public static BigDecimal parse(...)`.',
    },
    {
      q: 'Which statement about packages and `import` is correct?',
      options: [
        '`import com.shopeasy.pages.*;` also imports classes from `com.shopeasy.pages.components`',
        '`import` copies the class code into your file',
        '`import` only lets you write the short name `CartPage` instead of `com.shopeasy.pages.CartPage`; it does not change access rules',
        'Classes in the same package must import each other',
      ],
      answer: 2,
      why: '`import` is a naming shortcut. It does not copy code and it never grants access, so importing a package-private class still fails. A wildcard covers one package only, not sub-packages. Classes in the same package (and `java.lang`, e.g. `String`) need no import.',
    },
    {
      q: `In \`CartPage\`, which access level should the locator and the action get?
\`\`\`java
___ By checkoutButton = By.id("checkout");
___ CheckoutPage proceedToCheckout() { ... }
\`\`\``,
      options: [
        'public / public',
        'private / public',
        'protected / private',
        'public / private',
      ],
      answer: 1,
      why: 'The locator is a detail of how the page is built, so it is `private` (java-006 covers why). The action is what tests use, so it is `public`. Pick the **most restrictive** level that still works, so a redesign changes one class instead of every test that touched the locator.',
    },
  ],
  hints: [
    'The four levels from widest to narrowest: public, protected, (no keyword), private.',
    'protected includes the whole package, not only subclasses.',
  ],
  explanation: `| Modifier | Same class | Same package | Subclass in another package | Everyone |
|---|---|---|---|---|
| \`public\` | yes | yes | yes | yes |
| \`protected\` | yes | yes | yes | no |
| *(none)* package-private | yes | yes | no | no |
| \`private\` | yes | no | no | no |

A **package** is a folder plus a \`package com.shopeasy.pages;\` line at the top of each file. It groups related classes and, together with these modifiers, decides what the rest of the framework may use. A typical framework layout: \`pages\` (public page methods, private locators, protected helpers in BasePage), \`steps\` (public step methods), \`utils\` (public static helpers), \`config\`.`,
  mistakes: [
    'Thinking "no keyword" means public, then getting "is not public in ..." after moving a class.',
    'Making everything public to fix compile errors, which exposes locators and helpers to every test.',
    'Expecting a wildcard import to include sub-packages.',
    'Putting the package line out of sync with the folder, so Maven cannot compile the class.',
  ],
  interview: [
    { q: 'What are the access modifiers in Java?', a: 'public (everywhere), protected (same package plus subclasses), package-private with no keyword (same package only), and private (same class only). Top-level classes can only be public or package-private.' },
    { q: 'Why use packages in a test framework?', a: 'They group classes by responsibility (pages, steps, utils, config), avoid name clashes, and work with access modifiers to hide internals. Cucumber also uses the glue package to find step definitions and hooks.' },
  ],
}
