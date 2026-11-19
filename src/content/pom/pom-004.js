export default {
  id: 'pom-004',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Refactor: move assertions out of the page object',
  level: 'BEGINNER',
  tags: ['pom', 'assertions', 'refactoring', 'testng'],
  estMinutes: 15,
  scenario: `A teammate wrote \`CartPage.verifyItemCount(int)\` with an \`Assert.assertEquals\` inside. Now you need a negative
test "cart is empty after removing the item" and a data-driven test that expects 0, 1 and 3 items. The page method
fails the build in the middle of setup steps where nobody wanted a check, and the failure message never says which
test expectation was wrong. Time to refactor.`,
  description: `Refactor \`CartPage\` so it only **reports** state, and move the assertions into \`CartTest\`.

**Rules**
- \`CartPage\` exposes \`getItemCount()\` (int) and \`getItemNames()\` (\`List<String>\`); no \`Assert\` in the page.
- Remove \`verifyItemCount\` / \`verifyItemPresent\`.
- \`CartTest.addedItemAppearsInCart()\` asserts count is 1 and that the names contain "Trailblazer Backpack", with a helpful message.`,
  starterCode: `package com.shopeasy.pages;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.testng.Assert;

public class CartPage {
    private final WebDriver driver;
    private final By cartItems = By.cssSelector(".cart-item");
    private final By itemName = By.cssSelector(".cart-item .item-name");

    public CartPage(WebDriver driver) { this.driver = driver; }

    public void verifyItemCount(int expected) {
        Assert.assertEquals(driver.findElements(cartItems).size(), expected);
    }

    public void verifyItemPresent(String name) {
        List<String> names = driver.findElements(itemName).stream()
                .map(WebElement::getText).collect(Collectors.toList());
        Assert.assertTrue(names.contains(name));
    }
}

// ---- CartTest.java ----
// @Test
// public void addedItemAppearsInCart() {
//     CartPage cart = inventory.addToCart("Trailblazer Backpack").openCart();
//     cart.verifyItemCount(1);
//     cart.verifyItemPresent("Trailblazer Backpack");
// }
`,
  solution: `package com.shopeasy.pages;

import java.util.List;
import java.util.stream.Collectors;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class CartPage {
    private final WebDriver driver;
    private final By cartItems = By.cssSelector(".cart-item");
    private final By itemName = By.cssSelector(".cart-item .item-name");

    public CartPage(WebDriver driver) { this.driver = driver; }

    public int getItemCount() {
        return driver.findElements(cartItems).size();
    }

    public List<String> getItemNames() {
        return driver.findElements(itemName).stream()
                .map(WebElement::getText)
                .collect(Collectors.toList());
    }
}

// ---- CartTest.java ----
class CartTest extends BaseTest {

    @Test
    public void addedItemAppearsInCart() {
        CartPage cart = loginAsStandardUser()
                .addToCart("Trailblazer Backpack")
                .openCart();

        Assert.assertEquals(cart.getItemCount(), 1, "Cart should hold exactly one item");
        Assert.assertTrue(cart.getItemNames().contains("Trailblazer Backpack"),
                "Cart items were: " + cart.getItemNames());
    }
}
`,
  checks: [
    { label: 'getItemCount() returns an int', pattern: 'public\\s+int\\s+getItemCount\\s*\\(\\s*\\)', hint: 'public int getItemCount() { return driver.findElements(cartItems).size(); }' },
    { label: 'getItemNames() returns List<String>', pattern: 'public\\s+List<String>\\s+getItemNames\\s*\\(', hint: 'Return the names so the test can decide what to check' },
    { label: 'verify* methods removed from the page', pattern: 'void\\s+verify\\w*\\s*\\(', mustNot: true, hint: 'Delete verifyItemCount / verifyItemPresent' },
    { label: 'Test asserts the count', pattern: 'assertEquals\\s*\\(\\s*\\w+\\.getItemCount\\s*\\(\\s*\\)\\s*,\\s*1', hint: 'Assert.assertEquals(cart.getItemCount(), 1, "message")' },
    { label: 'Test asserts the item name', pattern: 'assert(True|That)\\s*\\([\\s\\S]*?getItemNames\\s*\\(\\s*\\)', hint: 'Assert.assertTrue(cart.getItemNames().contains(...), ...)' },
    { label: 'Assertions have a message', pattern: 'assert\\w+\\s*\\([^;]*,\\s*"[^"]+"', hint: 'Add a failure message as the last argument' },
  ],
  hints: [
    'Turn each verifyX(expected) into a getX() that returns the actual value.',
    'The test then does Assert.assertEquals(actual, expected, message).',
    'TestNG order is assertEquals(actual, expected, message).',
  ],
  explanation: `**Pages report, tests judge.** Once the page returns values instead of asserting:

- Positive, negative and data-driven tests all reuse \`getItemCount()\` with different expectations.
- Failure messages live where the expectation lives, so the report says *why* the test cared.
- Page methods can be used in setup steps without accidentally failing the test.

Some teams allow small "state" checks in pages like \`isLoaded()\` returning a boolean, or a wait that throws if the
page never appears. That is fine: it is synchronisation, not a business assertion. What you avoid is the page knowing
the *expected* business value.

Bonus: TestNG's signature is \`assertEquals(actual, expected, message)\` — JUnit has it the other way round, and a
swapped order produces confusing reports ("expected 3 but found 1" when it was really the reverse).`,
  mistakes: [
    'Keeping both verify methods and getters "for convenience"; the verify ones keep getting used.',
    'Swapping actual and expected in TestNG assertEquals.',
    'Asserting with no message, so the report only says "expected [true] but found [false]".',
  ],
  interview: [
    { q: 'Should page objects contain assertions?', a: 'Generally no. Page objects expose state and behaviour; tests own expectations. This keeps pages reusable for positive and negative scenarios and keeps failure messages meaningful. Waiting for a page to be loaded is acceptable because it is synchronisation, not a business check.' },
    { q: 'What is the parameter order of TestNG assertEquals?', a: 'assertEquals(actual, expected, message). JUnit 4/5 uses (expected, actual). Mixing them up makes failure messages misleading.' },
  ],
}
