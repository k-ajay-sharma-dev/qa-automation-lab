export default {
  id: 'sel-017',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: 'Selenium 4 relative locators for elements with dynamic ids',
  level: 'INTERMEDIATE',
  tags: ['relative-locators', 'locators', 'dynamic-ids', 'selenium4'],
  estMinutes: 15,
  scenario: `On \`dynamic.html\` the order-action buttons and the team-member cards get generated ids on every load (\`btn-8f3a2\`, \`submit-order-c71e9\`, \`user-…\`) and have no name attribute — a dev ticket to add \`data-test\` attributes is in the backlog for "next quarter". Their neighbours, however, are stable: the "Apply coupon" and "Save for later" buttons, the "Ken Adams" name heading. You need a locator *today* that doesn't depend on the generated ids.`,
  description: `On \`http://localhost:5180/practice-site/dynamic.html\`, using Selenium 4 **relative locators** (\`RelativeLocator.with\`):

1. In \`#order-actions\`, find the button **to the right of** (\`toRightOf\`) "Apply coupon" and **to the left of** (\`toLeftOf\`) "Save for later" — that is "Place order". Click it.
2. Assert \`#dynamic-result\` starts with \`Place order clicked\`.
3. In \`#user-cards\` every card has an identical "Edit" button: find the Edit button **below** the "Ken Adams" heading (\`h4.user-name\`) — \`with(By.xpath("//button[normalize-space()='Edit']")).below(kenName)\` returns the closest one — and click it.
4. Assert \`#dynamic-result\` is \`Edit Ken Adams\`.

**Rules**
- Import \`static org.openqa.selenium.support.locators.RelativeLocator.with\`.
- Don't use the generated ids. Anchor on stable visible text.
- Add a short comment explaining when relative locators are a *temporary* choice.`,
  hints: [
    'import static org.openqa.selenium.support.locators.RelativeLocator.with;',
    'driver.findElement(with(By.tagName("button")).toRightOf(applyCoupon))',
    'Relative locators can be chained: with(By.tagName("button")).toRightOf(applyCoupon).toLeftOf(saveForLater)',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

public class GeneratedIdsTest extends BaseTest {

    @Test
    public void clickWithoutIds() {
        driver.get("http://localhost:5180/practice-site/dynamic.html");
        driver.findElement(By.id("submit-order-c71e9")).click();   // id changes on every load
        driver.findElement(By.id("btn-8f3a2")).click();
        // TODO: use relative locators anchored on stable neighbours
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.Test;

import java.time.Duration;

import static org.openqa.selenium.support.locators.RelativeLocator.with;

public class GeneratedIdsTest extends BaseTest {

    private static final By APPLY_COUPON = By.xpath("//div[@id='order-actions']/button[normalize-space()='Apply coupon']");
    private static final By SAVE_FOR_LATER = By.xpath("//div[@id='order-actions']/button[normalize-space()='Save for later']");
    private static final By KEN_ADAMS = By.xpath("//div[@id='user-cards']//h4[normalize-space()='Ken Adams']");
    private static final By LAST_ACTION = By.id("dynamic-result");

    @Test
    public void clickWithoutIds() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        driver.get("http://localhost:5180/practice-site/dynamic.html");

        // Relative locators are a stop-gap until data-test attributes land (ticket in backlog):
        // they depend on rendered layout, so a responsive change can break them.
        WebElement applyCoupon = driver.findElement(APPLY_COUPON);
        WebElement saveForLater = driver.findElement(SAVE_FOR_LATER);
        WebElement placeOrder = driver.findElement(
                with(By.tagName("button")).toRightOf(applyCoupon).toLeftOf(saveForLater));
        Assert.assertEquals(placeOrder.getText(), "Place order");
        placeOrder.click();
        wait.until(ExpectedConditions.textToBePresentInElementLocated(LAST_ACTION, "Place order clicked"));

        WebElement kenName = driver.findElement(KEN_ADAMS);
        WebElement kenEdit = driver.findElement(
                with(By.xpath("//button[normalize-space()='Edit']")).below(kenName));
        kenEdit.click();
        wait.until(ExpectedConditions.textToBe(LAST_ACTION, "Edit Ken Adams"));
    }
}
`,
  checks: [
    { label: 'Imports RelativeLocator.with', pattern: 'import\\s+static\\s+org\\.openqa\\.selenium\\.support\\.locators\\.RelativeLocator\\.(with|\\*)', hint: 'import static org.openqa.selenium.support.locators.RelativeLocator.with;' },
    { label: 'Uses with(By...)', pattern: '(RelativeLocator\\.)?with\\s*\\(\\s*By\\.', hint: 'with(By.tagName("input"))' },
    { label: 'Uses a direction (toRightOf/toLeftOf/above/below)', pattern: '\\.(toRightOf|toLeftOf|above|below)\\s*\\(', hint: '.toRightOf(applyCoupon) or .below(kenName)' },
    { label: 'Uses near() or chains two relations', pattern: '\\.near\\s*\\(|\\.(toRightOf|toLeftOf|above|below)\\s*\\([^)]*\\)\\s*\\.(toRightOf|toLeftOf|above|below|near)\\s*\\(', hint: 'with(By.tagName("button")).toRightOf(applyCoupon).toLeftOf(saveForLater)' },
    { label: 'Does not use the generated ids', pattern: '(btn|submit-order|user)-[0-9a-f]{5}\\b', mustNot: true, hint: 'Anchor on stable visible text instead' },
  ],
  explanation: `Selenium 4's **relative locators** (originally "friendly locators") find elements by their *visual position* relative to other elements: \`above\`, \`below\`, \`toLeftOf\`, \`toRightOf\`, \`near\` (within ~50px), and since 4.x also \`straightAbove/Below/LeftOf/RightOf\`. You start with a tag/locator — \`with(By.tagName("button"))\` — and chain relations; Selenium uses \`getBoundingClientRect()\` to filter and sorts candidates by proximity.

When they shine: elements with no usable attributes but a stable neighbour (label, heading, icon, sibling button).

Trade-offs a reviewer will raise:
- They depend on **layout**. A responsive breakpoint that wraps the button row breaks \`toRightOf\`/\`toLeftOf\` — which is why the solution asserts the found button's text and the comment marks it temporary.
- Hidden/overlapping elements can confuse proximity.
- Slightly slower (JS geometry calculations).

The long-term fix remains a stable test attribute (\`data-test="place-order"\`). DOM-based alternatives work too: a prefix match \`[id^='submit-order-']\`, visible text \`//button[normalize-space()='Place order']\`, or an XPath from a stable neighbour like \`//h4[.='Ken Adams']/following-sibling::div//button[.='Edit']\`.`,
  mistakes: [
    'Using with(By.tagName("button")).below(heading) on a page where many buttons are below — you get the nearest, which may not be the right one (here the Delete button sits right next to Edit).',
    'Assuming relative locators work the same in a narrow headless window.',
    'Forgetting the static import and writing new RelativeLocator(...).',
    'Using relative locators when a stable id/data-test attribute exists.',
  ],
  interview: [
    { q: 'What are relative locators?', a: 'A Selenium 4 feature to locate elements by position relative to another element: above, below, toLeftOf, toRightOf, near, via RelativeLocator.with(By...).' },
    { q: 'What are their limitations?', a: 'They depend on the rendered layout and window size, can pick the wrong element when several candidates are close, and are slower than direct locators. Prefer stable attributes when available.' },
    { q: 'How else can you handle dynamic ids?', a: 'Use stable attributes (data-test, name, aria-label), partial matches like starts-with(@id, "submit-order-") combined with context, or XPath axes from a stable label (following-sibling, @for).' },
  ],
}
