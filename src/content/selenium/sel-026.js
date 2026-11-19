export default {
  id: 'sel-026',
  category: 'selenium',
  kind: 'code',
  language: 'java',
  title: '"Load more" reviews: wait for counts, attributes and a disappearing button',
  level: 'INTERMEDIATE',
  tags: ['waits', 'numberOfElementsToBe', 'attributeContains', 'invisibility'],
  estMinutes: 20,
  scenario: `Product reviews load 5 at a time behind a "Load more" button. The current test clicks it twice with \`Thread.sleep(2500)\` after each click and then counts — it is slow, and on a busy Jenkins agent it counted 10 instead of 15 and failed. Worse, nobody checks that the button actually disappears at the end, which was the bug in release 3.4 (the button stayed and loaded duplicates). \`waits.html\` section 7 behaves like production: ~2 seconds per batch, a spinner \`#load-more-spinner\`, items \`#review-feed .feed-item\` with a \`data-review-index\` attribute, and when all 15 are loaded the button gets the CSS class \`hidden\` and \`#no-more-reviews\` appears.`,
  description: `On \`http://localhost:5180/practice-site/waits.html\`, with one \`WebDriverWait\` of 10 seconds:

1. Wait until **exactly 5** reviews are present (\`numberOfElementsToBe\`).
2. Click **Load more** (\`#load-more-btn\`). Wait for the spinner to become invisible, then for **exactly 10** reviews.
3. Wait until the **last** review's \`data-review-index\` attribute is \`10\` (\`attributeToBe\`) — proof the new batch rendered in order.
4. Wait until the button is clickable again, click it, wait for **15** reviews.
5. Wait until the button's \`class\` attribute contains \`hidden\` (\`attributeContains\`) **and** the button is invisible; assert \`#no-more-reviews\` is visible with the text \`No more reviews.\`

**Rules**: no \`Thread.sleep\`, no implicit wait, no hand-written polling loops — choose the right \`ExpectedConditions\` method for each step.`,
  hints: [
    'ExpectedConditions.numberOfElementsToBe(FEED_ITEMS, 10) waits for an exact count; numberOfElementsToBeMoreThan(FEED_ITEMS, 5) for "grew".',
    'By.cssSelector("#review-feed .feed-item:last-child") always points at the newest review.',
    'attributeContains(LOAD_MORE, "class", "hidden") is true once the class list includes "hidden".',
  ],
  starterCode: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.Test;

public class LoadMoreReviewsTest extends BaseTest {

    private static final By FEED_ITEMS = By.cssSelector("#review-feed .feed-item");
    private static final By LOAD_MORE = By.id("load-more-btn");

    @Test
    public void loadsAllReviews() throws InterruptedException {
        driver.get("http://localhost:5180/practice-site/waits.html");
        for (int i = 0; i < 2; i++) {
            driver.findElement(LOAD_MORE).click();
            Thread.sleep(2500);
        }
        Assert.assertEquals(driver.findElements(FEED_ITEMS).size(), 15);
        // TODO: check the button disappears
    }
}
`,
  solution: `package com.shopeasy.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.time.Duration;

public class LoadMoreReviewsTest extends BaseTest {

    private static final By FEED_ITEMS = By.cssSelector("#review-feed .feed-item");
    private static final By LAST_ITEM = By.cssSelector("#review-feed .feed-item:last-child");
    private static final By LOAD_MORE = By.id("load-more-btn");
    private static final By SPINNER = By.id("load-more-spinner");
    private static final By NO_MORE = By.id("no-more-reviews");

    @Test
    public void loadsAllReviewsAndHidesButton() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.get("http://localhost:5180/practice-site/waits.html");

        wait.until(ExpectedConditions.numberOfElementsToBe(FEED_ITEMS, 5));

        // batch 2
        driver.findElement(LOAD_MORE).click();
        wait.until(ExpectedConditions.invisibilityOfElementLocated(SPINNER));
        wait.until(ExpectedConditions.numberOfElementsToBe(FEED_ITEMS, 10));
        wait.until(ExpectedConditions.attributeToBe(LAST_ITEM, "data-review-index", "10"));

        // batch 3 (the button is disabled while loading, so wait until it is usable again)
        wait.until(ExpectedConditions.elementToBeClickable(LOAD_MORE)).click();
        wait.until(ExpectedConditions.numberOfElementsToBe(FEED_ITEMS, 15));

        // the end state: button gone, message shown
        wait.until(ExpectedConditions.attributeContains(LOAD_MORE, "class", "hidden"));
        wait.until(ExpectedConditions.invisibilityOfElementLocated(LOAD_MORE));
        String message = wait.until(ExpectedConditions.visibilityOfElementLocated(NO_MORE)).getText();
        Assert.assertEquals(message, "No more reviews.");
        Assert.assertEquals(driver.findElements(FEED_ITEMS).size(), 15, "No duplicates should be loaded");
    }
}
`,
  checks: [
    { label: 'Waits for an exact element count', pattern: 'numberOfElementsToBe\\s*\\(', hint: 'wait.until(ExpectedConditions.numberOfElementsToBe(FEED_ITEMS, 10))' },
    { label: 'Waits on an attribute value', pattern: 'attribute(ToBe|Contains)\\s*\\(', hint: 'ExpectedConditions.attributeToBe(LAST_ITEM, "data-review-index", "10")' },
    { label: 'Waits for something to become invisible', pattern: 'invisibilityOf(ElementLocated)?\\s*\\(', hint: 'ExpectedConditions.invisibilityOfElementLocated(LOAD_MORE)' },
    { label: 'Waits until the button is usable again', pattern: 'elementToBeClickable\\s*\\(\\s*LOAD_MORE', hint: 'The button is disabled while a batch loads' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Each sleep becomes a condition' },
    { label: 'No implicit wait', pattern: 'implicitlyWait', mustNot: true, hint: 'Explicit waits only' },
  ],
  explanation: `Every \`Thread.sleep\` in the old test was really waiting for *something*. Name that something and there is an \`ExpectedConditions\` method for it:

| The user waits for… | Condition |
|---|---|
| the list to have N items | \`numberOfElementsToBe(locator, n)\` (also \`…MoreThan\`, \`…LessThan\`) |
| the newest item to be the right one | \`attributeToBe(locator, "data-review-index", "10")\` |
| the spinner / button to go away | \`invisibilityOfElementLocated\` — also true if the element is removed |
| a CSS state such as \`hidden\` / \`active\` / \`disabled\` | \`attributeContains(locator, "class", "hidden")\` |
| the button to work again | \`elementToBeClickable\` (visible **and** enabled) |

**Exact count vs "more than"**: with the 3.4 bug a batch could add 10 items instead of 5. An exact \`numberOfElementsToBe(…, 10)\` then times out with a clear message, and the final "15" assertion fails too. A "more than 5" check would happily pass with duplicates.

**Disabled while loading**: the page sets \`disabled\` on the button during each fetch. Clicking it then does nothing — no exception, just a lost click — so the second click waits for \`elementToBeClickable\` first.

**Attribute + invisibility**: \`attributeContains\` proves the app *decided* to hide the button (the class), \`invisibilityOfElementLocated\` proves the user *sees* it gone (CSS applied). Asking both is cheap and makes the failure message precise.`,
  mistakes: [
    'Using numberOfElementsToBeMoreThan when the requirement is an exact count — duplicates slip through.',
    'Clicking "Load more" while it is still disabled from the previous batch — the click is silently ignored.',
    'Waiting only for the spinner to disappear, then counting — the items can render a moment after the spinner hides.',
    'Asserting findElements(...).size() right after the click with no wait — you count the old batch.',
  ],
  interview: [
    { q: 'How do you wait for a list to finish loading more items?', a: 'Wait for the count with numberOfElementsToBe (exact) or numberOfElementsToBeMoreThan (grew), ideally also for a "done" signal such as a spinner disappearing or a "no more items" message.' },
    { q: 'How do you wait for a CSS class or attribute to change?', a: 'ExpectedConditions.attributeToBe(locator, attr, value) for an exact value, attributeContains(locator, "class", "active") for part of it. For anything else, a lambda: wait.until(d -> d.findElement(loc).getDomAttribute("aria-expanded").equals("true")).' },
    { q: 'Does invisibilityOfElementLocated pass if the element is removed from the DOM?', a: 'Yes. It returns true when the element is either not displayed or not present at all, which makes it the safe choice for spinners and buttons that may be hidden or removed.' },
  ],
}
