export default {
  id: 'pom-020',
  category: 'pom',
  kind: 'code',
  language: 'java',
  title: 'Loadable pages: a page object that checks it is really open',
  level: 'INTERMEDIATE',
  tags: ['pom', 'loadable-component', 'waits', 'fail-fast'],
  estMinutes: 20,
  scenario: `Last night 9 checkout tests failed with \`NoSuchElementException: #checkout\`. After an hour of triage you find
the real cause: login was broken on the QA environment, so the browser never left \`login.html\` — but
\`loginAs()\` happily returned an \`InventoryPage\`, and the tests failed three pages later with a misleading error.
Your lead: *"A page object should refuse to exist if its page is not on screen."*`,
  description: `Make \`InventoryPage\` a **loadable** page: it verifies its own identity when it is created.

**Rules**
- A private method \`waitUntilLoaded()\` called from the constructor waits (explicit wait from \`BasePage\`) for
  **two** signals: the URL contains \`inventory.html\` **and** \`#inventory-list\` is visible.
- If the wait times out, throw an \`IllegalStateException\` whose message says which page was expected **and** the
  current URL (so the report shows "expected inventory, but was on …/login.html").
- Keep a public \`isLoaded()\` returning a boolean (no exception) for tests that want to check it.
- No \`Thread.sleep\`, no assertions in the page.`,
  starterCode: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class InventoryPage extends BasePage {
    private final By inventoryList = By.id("inventory-list");

    public InventoryPage(WebDriver driver) {
        super(driver);
        // TODO: make sure we really are on the inventory page
    }

    public boolean isLoaded() {
        return true;   // TODO
    }
}
`,
  solution: `package com.shopeasy.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class InventoryPage extends BasePage {
    private static final String URL_PART = "inventory.html";
    private final By inventoryList = By.id("inventory-list");

    public InventoryPage(WebDriver driver) {
        super(driver);
        waitUntilLoaded();
    }

    private void waitUntilLoaded() {
        try {
            wait.until(ExpectedConditions.and(
                    ExpectedConditions.urlContains(URL_PART),
                    ExpectedConditions.visibilityOfElementLocated(inventoryList)));
        } catch (TimeoutException e) {
            throw new IllegalStateException(
                    "Expected the Inventory page (" + URL_PART + ") but the browser is on: "
                            + driver.getCurrentUrl(), e);
        }
    }

    public boolean isLoaded() {
        return driver.getCurrentUrl().contains(URL_PART)
                && !driver.findElements(inventoryList).isEmpty()
                && driver.findElement(inventoryList).isDisplayed();
    }
}

// LoginPage.loginAs(...) still just does: return new InventoryPage(driver);
// If login is broken, the failure is now immediate and honest:
// java.lang.IllegalStateException: Expected the Inventory page (inventory.html) but the browser is on:
//   http://localhost:5180/practice-site/login.html
`,
  checks: [
    { label: 'Constructor triggers the load check', pattern: 'InventoryPage\\s*\\(\\s*WebDriver\\s+\\w+\\s*\\)\\s*\\{[^}]*super\\s*\\(\\s*\\w+\\s*\\)\\s*;[^}]*(waitUntilLoaded|isLoaded|wait\\.until)', hint: 'Call waitUntilLoaded() right after super(driver)' },
    { label: 'Waits for the URL', pattern: 'urlContains\\s*\\(|urlMatches\\s*\\(|urlToBe\\s*\\(', hint: 'ExpectedConditions.urlContains("inventory.html")' },
    { label: 'Waits for a unique element', pattern: 'visibilityOfElementLocated\\s*\\(|waitVisible\\s*\\(', hint: 'ExpectedConditions.visibilityOfElementLocated(inventoryList)' },
    { label: 'Turns a timeout into a clear error', pattern: 'catch\\s*\\(\\s*TimeoutException[\\s\\S]*?throw\\s+new\\s+IllegalStateException\\s*\\(', hint: 'catch (TimeoutException e) { throw new IllegalStateException("...", e); }' },
    { label: 'Message includes the current URL', pattern: 'IllegalStateException\\s*\\([\\s\\S]*?getCurrentUrl\\s*\\(', hint: 'Add driver.getCurrentUrl() to the message' },
    { label: 'isLoaded is not hard-coded', pattern: 'return\\s+true\\s*;', mustNot: true, hint: 'isLoaded() must really check the page' },
    { label: 'No Thread.sleep or assertions', pattern: '(Thread\\.sleep|Assert\\.)', mustNot: true, hint: 'Explicit waits only; tests assert' },
  ],
  hints: [
    'Two signals are stronger than one: the URL can change before the DOM is ready, and an element id may exist on more than one page.',
    'ExpectedConditions.and(conditionA, conditionB) waits until both are true.',
    'Wrap the wait in try/catch(TimeoutException) and re-throw an IllegalStateException with getCurrentUrl() in the message.',
  ],
  explanation: `This is the **Loadable Component** idea (Selenium even ships a \`LoadableComponent<T>\` base class with
\`load()\` and \`isLoaded()\`): a page object proves it is on screen before anyone uses it.

What it buys you:
- **Fail fast, fail honest.** The error appears at the step that really broke (login) with the real URL, not three
  pages later as \`NoSuchElementException: #checkout\`.
- **Synchronisation for free.** Every \`new InventoryPage(driver)\` waits for the page, so tests never need a
  "wait for page" step.
- **Cheap triage.** "Expected Inventory but on login.html" tells a manual tester exactly where to look.

Is the exception an assertion in a page? No — it is a *precondition* ("I can only work on my own page"), like a
manual tester refusing to execute step 5 when step 4's screen never appeared. Business checks (prices, counts) stay
in tests. \`isLoaded()\` returns a boolean for tests that want to assert the page *is* (or *is not*) shown.

Keep the check light: one URL condition and one unique, always-present element. Waiting for 15 elements in every
constructor makes navigation slow.`,
  mistakes: [
    'Checking only the URL: single-page apps change the URL before content renders.',
    'Checking an element that also exists on other pages (the header cart link), which proves nothing.',
    'Swallowing the TimeoutException and returning the page anyway.',
    'Putting heavy, business-level checks in the constructor and making every navigation slow.',
  ],
  interview: [
    { q: 'What is the Loadable Component pattern?', a: 'A page object that knows how to verify (and optionally load) itself: isLoaded() checks a URL and a unique element, load() navigates. Selenium provides LoadableComponent<T> with get() that calls load() only if isLoaded() fails. Simpler frameworks just wait for page identity in the constructor.' },
    { q: 'Is throwing from a page constructor an assertion in the page object?', a: 'No. It is a precondition check that keeps the page object honest: it should not exist if its page is not displayed. Business expectations still live in tests. The difference is that the test never wanted to be anywhere else.' },
    { q: 'Why not just check driver.getTitle()?', a: 'Titles are often shared or change late. A URL fragment plus a unique element that only this page has is a stronger and faster identity check.' },
  ],
}
