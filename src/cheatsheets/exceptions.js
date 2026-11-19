export default {
  slug: 'exceptions',
  title: 'Selenium & Java Exceptions — Cause → Fix',
  sections: [
    {
      heading: 'How to read a stack trace in 60 seconds',
      body: `1. **Exception line** — \`org.openqa.selenium.XxxException: message\`. The type tells you the category; the message often contains the answer (locator, URL, versions, "Other element would receive the click").
2. **First frame in YOUR package** (\`com.yourcompany...\`) — that's where it broke in your code. Selenium/TestNG frames are context.
3. **"Caused by:"** — follow to the *last* one; that's the origin.
4. **Summary line** — Failures (assertions) vs Errors (exceptions) vs Skipped (never ran, often a failed \`@Before…\`). Check "Configuration Failures".
5. **Fix the earliest failure first** — later failures are often consequences.

\`\`\`text
org.openqa.selenium.TimeoutException: ... waiting for element to be clickable: By.id: finish        ← what
	at org.openqa.selenium.support.ui.FluentWait.until(FluentWait.java:230)                         ← library
	at com.shopeasy.pages.CheckoutPage.finishOrder(CheckoutPage.java:52)                             ← START HERE
	at com.shopeasy.stepdefs.CheckoutSteps.i_finish_the_order(CheckoutSteps.java:37)                ← who called it
\`\`\``,
    },
    {
      heading: 'Element-finding exceptions',
      body: `| Exception | Typical cause | Fix |
|---|---|---|
| \`NoSuchElementException\` | Element not there **yet** (AJAX/render); wrong locator; element is inside an **iframe**; driver is on the wrong **window** | Verify locator in DevTools on the loaded page → if it matches, add an explicit wait (\`visibilityOfElementLocated\` / \`elementToBeClickable\`); switch to the frame/window |
| \`TimeoutException\` | An explicit wait's condition never became true in time | Read the condition in the message; check \`Caused by\`; frame/window? overlay? wrong locator? genuinely slow env? |
| \`StaleElementReferenceException\` | The DOM node was replaced (re-render, refresh, navigation, sort/filter) after you found it | Re-locate after the change; keep \`By\` locators, not \`WebElement\` fields; wait with \`stalenessOf\` / \`numberOfElementsToBe\` |
| \`InvalidSelectorException\` | Syntax error in XPath/CSS (unbalanced quotes/brackets), or using XPath syntax in \`By.cssSelector\` | Test the selector in DevTools (\`$x()\` / \`$$()\`), fix syntax |
| \`NoSuchFrameException\` | Frame id/name/index wrong or frame not loaded yet | \`frameToBeAvailableAndSwitchToIt(By)\`; prefer a locator over an index |
| \`NoSuchWindowException\` | Driver points at a closed window/tab (after \`close()\`) | Save \`getWindowHandle()\`; after \`close()\` always \`switchTo().window(original)\` |`,
    },
    {
      heading: 'Interaction exceptions',
      body: `| Exception | Typical cause | Fix |
|---|---|---|
| \`ElementClickInterceptedException\` | Another element is on top: spinner/overlay, modal backdrop, cookie banner, sticky header | Wait \`invisibilityOfElementLocated(overlay)\`, then \`elementToBeClickable\`; close the banner; scroll element to the centre |
| \`ElementNotInteractableException\` | Element present but hidden/zero-size/disabled; responsive layout hid it (headless 800x600!); wrong one of several matches | Wait for visibility; set \`--window-size=1920,1080\`; open the menu that contains it; make the locator unique |
| \`MoveTargetOutOfBoundsException\` | Actions move to a point outside the viewport | Scroll into view first (\`scrollIntoView\` / \`Actions.scrollToElement\`) |
| \`UnhandledAlertException\` | A JS alert/confirm is open and blocks commands | \`wait.until(alertIsPresent())\` then \`accept()\` / \`dismiss()\` |
| \`NoAlertPresentException\` | Switched to an alert that isn't open (yet) | \`ExpectedConditions.alertIsPresent()\` |
| \`JavascriptException\` | Error inside \`executeScript\` code | Check the script and the arguments; run it in the DevTools console |`,
    },
    {
      heading: 'Session & environment exceptions',
      body: `| Exception | Typical cause | Fix |
|---|---|---|
| \`SessionNotCreatedException\` — "only supports Chrome version N" | Driver/browser version mismatch after a browser auto-update; hard-coded driver path | Remove \`webdriver.chrome.driver\` path; use **Selenium Manager** (Selenium 4.6+); pin browser in Docker images |
| \`SessionNotCreatedException\` — "DevToolsActivePort file doesn't exist" | Chrome crashed on start in Linux/Docker | \`--headless=new --no-sandbox --disable-dev-shm-usage\`, bigger \`--shm-size\` |
| \`NoSuchSessionException\` — "Session ID is null. Using WebDriver after calling quit()?" | Using a driver after \`quit()\`; **static driver shared between parallel threads** | \`ThreadLocal<WebDriver>\`; create in \`@Before\`, quit + \`remove()\` in \`@After\` |
| \`WebDriverException: net::ERR_CONNECTION_REFUSED\` | App/server down, wrong URL/port for the environment | Check deployment and config (\`-Denv\`); it's an **environment** issue |
| \`UnreachableBrowserException\` | Browser/driver process died, Grid node lost | Check agent resources, Grid health, logs |
| \`TimeoutException\` on \`driver.get\` | Page load timeout exceeded | Check environment speed; \`pageLoadTimeout\`; \`PageLoadStrategy.EAGER\` if appropriate |`,
    },
    {
      heading: 'Java exceptions you will meet in frameworks',
      body: `| Exception | Typical cause in automation | Fix |
|---|---|---|
| \`NullPointerException\` | Driver not initialised (hook not in \`glue\`, \`@Before\` failed), page object created before driver, config key missing | Check hooks/glue; initialise in the right order; fail fast with a clear message in \`getDriver()\` |
| \`NumberFormatException\` | \`Integer.parseInt("$29.99")\` / \`new BigDecimal("$85,000")\` | Clean text first: \`replaceAll("[^0-9.]", "")\` |
| \`IndexOutOfBoundsException\` | \`findElements(...).get(0)\` on an empty list; loop off-by-one | Wait for the expected count; check \`isEmpty()\` |
| \`ConcurrentModificationException\` | Modifying a collection while iterating it with for-each; shared collections in parallel threads | Use an \`Iterator.remove()\` / \`removeIf\`; thread-confined or concurrent collections |
| \`ClassCastException\` | Casting the driver to an unsupported interface; wrong type from a Map/JSON | Check the runtime type; use generics |
| \`FileNotFoundException\` | Config/test-data path wrong on the CI agent; file git-ignored | Load from classpath (\`getResourceAsStream\`); verify the file is committed |
| \`AssertionError\` | The assertion failed — expected vs actual differ | Read both values char by char (\`$29.99\` vs \`29.99\`); decide product bug vs test bug |`,
    },
    {
      heading: 'Cucumber errors',
      body: `| Error | Cause | Fix |
|---|---|---|
| **Undefined step** (\`UndefinedStepException\`, "You can implement missing steps…") | *All* undefined → wrong \`glue\` package; *some* undefined → step text ≠ expression | Fix \`glue\`; copy the generated snippet; use \`dryRun = true\` |
| \`AmbiguousStepDefinitionsException\` | One step text matches 2+ definitions (often a greedy regex \`(.*)\`) | Keep one definition; use Cucumber expressions; shared \`CommonSteps\` |
| \`DuplicateStepDefinitionException\` | Same expression defined twice | Delete one |
| \`CucumberException: Failed to instantiate class\` | Step class constructor/DI (PicoContainer) failed — look at \`Caused by\` | Fix the root cause (often config/driver creation) |
| \`PendingException\` | Step body still the generated placeholder | Implement the step |
| Hooks not running | Wrong import (\`org.junit.Before\` instead of \`io.cucumber.java.Before\`) or hooks package missing from \`glue\` | Fix import / glue |`,
    },
    {
      heading: 'Triage: product bug, test bug or environment?',
      body: `| Evidence | Most likely |
|---|---|
| Reproduces manually on the same build | **Product bug** → defect with screenshot, logs, steps, build no. |
| Works manually; locator/wait/data assumption wrong | **Test bug** → fix the script, PR |
| Connection refused, 5xx from infra, missing data after DB refresh, browser/driver mismatch | **Environment** → fix/escalate, rerun |
| Passes alone, fails in suite/parallel | **Test design** (shared state/data) |
| Same code, random pass/fail | **Flaky** → find the non-determinism (timing, data, env); quarantine + fix |`,
    },
  ],
}
