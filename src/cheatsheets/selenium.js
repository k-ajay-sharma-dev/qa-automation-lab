export default {
  slug: 'selenium',
  title: 'Selenium WebDriver 4 (Java)',
  sections: [
    {
      heading: 'Session lifecycle',
      body: `\`\`\`java
WebDriver driver = new ChromeDriver();          // Selenium Manager (4.6+) fetches chromedriver
driver.manage().window().maximize();            // or setSize(new Dimension(1920, 1080))
driver.get("http://localhost:5180/practice-site/login.html");
driver.getTitle();  driver.getCurrentUrl();  driver.getPageSource();
driver.navigate().back();  .forward();  .refresh();  .to(url);
driver.close();   // closes CURRENT window only, focus is not moved
driver.quit();    // closes all windows + ends session + stops driver  -> use in teardown
\`\`\`
Other drivers: \`FirefoxDriver\`, \`EdgeDriver\`, \`SafariDriver\`, \`RemoteWebDriver\` (Grid). Always type the variable as \`WebDriver\`.`,
    },
    {
      heading: 'Locators (By)',
      body: `| Strategy | Example | Notes |
|---|---|---|
| id | \`By.id("user-name")\` | fastest, best if stable |
| name | \`By.name("email")\` | good for forms |
| css | \`By.cssSelector("[data-testid=login-button]")\` | first choice for most things |
| xpath | \`By.xpath("//button[normalize-space()='Login']")\` | text, axes, parents |
| className | \`By.className("error-message")\` | ONE class only — no spaces |
| tagName | \`By.tagName("h1")\` | |
| linkText / partialLinkText | \`By.linkText("Logout")\` | \`<a>\` only |

Relative (Selenium 4): \`import static org.openqa.selenium.support.locators.RelativeLocator.with;\`
\`driver.findElement(with(By.tagName("input")).toRightOf(label))\` — also \`above\`, \`below\`, \`toLeftOf\`, \`near\`.

Priority: **data-test / id → name → CSS → XPath (text/axes) → relative**. Never absolute XPath (\`/html/body/...\`).`,
    },
    {
      heading: 'Finding elements',
      body: `\`\`\`java
WebElement el = driver.findElement(By.id("x"));          // 1 element or NoSuchElementException
List<WebElement> els = driver.findElements(By.cssSelector(".inventory-item")); // possibly EMPTY list, never throws
boolean absent = driver.findElements(BANNER).isEmpty();  // absence check
WebElement inRow = row.findElement(By.xpath(".//button"));   // .// = search INSIDE row
SearchContext shadow = host.getShadowRoot();             // shadow DOM (CSS only inside)
shadow.findElement(By.cssSelector("button"));
\`\`\``,
    },
    {
      heading: 'WebElement API',
      body: `\`\`\`java
el.click();  el.sendKeys("text", Keys.ENTER);  el.clear();  el.submit();
el.getText();                    // visible text ("" for inputs)
el.getDomProperty("value");      // live property (typed value of an input)
el.getDomAttribute("href");      // attribute as written in HTML
el.getAttribute("class");        // legacy: property, else attribute
el.getCssValue("color");  el.getTagName();  el.getRect();
el.isDisplayed();  el.isEnabled();  el.isSelected();   // checkbox / radio / option
el.getAccessibleName();  el.getAriaRole();             // Selenium 4
\`\`\``,
    },
    {
      heading: 'Dropdowns, checkboxes, upload',
      body: `\`\`\`java
Select s = new Select(driver.findElement(SORT));   // only native <select>
s.selectByVisibleText("Price (low to high)");  s.selectByValue("lohi");  s.selectByIndex(2);
s.getFirstSelectedOption().getText();  s.getOptions();
s.isMultiple();  s.getAllSelectedOptions();  s.deselectAll();

if (!box.isSelected()) box.click();               // idempotent checkbox

fileInput.sendKeys(Paths.get("src/test/resources/a.png").toAbsolutePath().toString());
((RemoteWebDriver) driver).setFileDetector(new LocalFileDetector()); // on Grid
\`\`\``,
    },
    {
      heading: 'Waits',
      body: `\`\`\`java
// Explicit (recommended) — keep implicit wait at 0, never mix
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement el = wait.until(ExpectedConditions.visibilityOfElementLocated(RESULT));
wait.until(d -> d.findElements(ROWS).size() > 5);           // custom lambda

// Fluent
Wait<WebDriver> fw = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(60))
    .pollingEvery(Duration.ofSeconds(2))
    .ignoring(NoSuchElementException.class)
    .ignoring(StaleElementReferenceException.class)
    .withMessage("Order status never became Completed");

// Implicit (global, presence only) — avoid
driver.manage().timeouts().implicitlyWait(Duration.ZERO);
driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(30));
\`\`\`
WebDriverWait = FluentWait with 500 ms polling and NotFoundException ignored. **No \`Thread.sleep\`.**`,
    },
    {
      heading: 'ExpectedConditions you will actually use',
      body: `| Condition | Use it when |
|---|---|
| \`visibilityOfElementLocated(by)\` | you will read/see it |
| \`elementToBeClickable(by / el)\` | you will click it (visible + enabled) |
| \`presenceOfElementLocated(by)\` | in DOM, may be hidden |
| \`invisibilityOfElementLocated(by)\` | spinner / overlay / toast gone |
| \`textToBePresentInElementLocated(by, txt)\` | partial text arrived |
| \`textToBe(by, txt)\` | exact text |
| \`attributeToBe / attributeContains\` | class/state change |
| \`numberOfElementsToBe(by, n)\` / \`...MoreThan\` | list loaded |
| \`visibilityOfAllElementsLocatedBy(by)\` | grid/table rows |
| \`urlContains / urlToBe / titleIs / titleContains\` | navigation done |
| \`alertIsPresent()\` | JS dialog (returns Alert) |
| \`frameToBeAvailableAndSwitchToIt(by)\` | iframe loaded (switches) |
| \`numberOfWindowsToBe(n)\` | new tab opened |
| \`stalenessOf(el)\` | old page/row replaced |
| \`refreshed(condition)\` | element re-rendered while waiting |
| \`elementToBeSelected / elementSelectionStateToBe\` | checkbox state |
| \`and(...) / or(...) / not(...)\` | combine |`,
    },
    {
      heading: 'Alerts, frames, windows',
      body: `\`\`\`java
// JS alert / confirm / prompt (not DOM!)
Alert a = wait.until(ExpectedConditions.alertIsPresent());
a.getText();  a.accept();  a.dismiss();  a.sendKeys("SAVE10");

// Frames
wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(By.id("support-frame")));
driver.switchTo().frame(element | "nameOrId" | 0);
driver.switchTo().parentFrame();     // one level up
driver.switchTo().defaultContent();  // back to top page

// Windows / tabs
String original = driver.getWindowHandle();
wait.until(ExpectedConditions.numberOfWindowsToBe(2));
for (String h : driver.getWindowHandles()) if (!h.equals(original)) driver.switchTo().window(h);
driver.close(); driver.switchTo().window(original);
driver.switchTo().newWindow(WindowType.TAB);   // Selenium 4
driver.switchTo().activeElement();
\`\`\``,
    },
    {
      heading: 'Actions (mouse & keyboard)',
      body: `\`\`\`java
Actions act = new Actions(driver);
act.moveToElement(menu).perform();                     // hover
act.dragAndDrop(src, dst).perform();
act.clickAndHold(src).moveToElement(dst).release().perform();
act.contextClick(el).perform();   act.doubleClick(el).perform();
act.keyDown(Keys.CONTROL).click(a).click(b).keyUp(Keys.CONTROL).perform();
act.sendKeys(Keys.TAB).perform();
act.scrollToElement(el).perform();  act.scrollByAmount(0, 500).perform();  // 4.2+
el.sendKeys(Keys.chord(Keys.CONTROL, "a"));
\`\`\`
Nothing happens without **\`.perform()\`**.`,
    },
    {
      heading: 'JavascriptExecutor',
      body: `\`\`\`java
JavascriptExecutor js = (JavascriptExecutor) driver;
js.executeScript("arguments[0].scrollIntoView({block: 'center'});", el);
js.executeScript("window.scrollTo(0, document.body.scrollHeight);");
js.executeScript("arguments[0].click();", el);              // LAST resort: bypasses overlays
String state = (String) js.executeScript("return document.readyState;");
Long count = (Long) js.executeScript("return document.querySelectorAll('.inventory-item').length;");
js.executeAsyncScript("const cb = arguments[arguments.length-1]; setTimeout(cb, 500);");
\`\`\`
Pass elements as \`arguments[n]\`; numbers come back as \`Long\`/\`Double\`.`,
    },
    {
      heading: 'Screenshots & browser options',
      body: `\`\`\`java
File f = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);   // or BYTES / BASE64
Files.copy(f.toPath(), Paths.get("target/screenshots", name + ".png"), REPLACE_EXISTING);
byte[] elPng = element.getScreenshotAs(OutputType.BYTES);              // element-only (Selenium 4)
// Cucumber: scenario.attach(bytes, "image/png", scenario.getName());

ChromeOptions o = new ChromeOptions();
o.addArguments("--headless=new", "--window-size=1920,1080",
               "--no-sandbox", "--disable-dev-shm-usage", "--incognito");
o.setPageLoadStrategy(PageLoadStrategy.EAGER);
o.setExperimentalOption("prefs", Map.of("download.default_directory", dir));
o.setAcceptInsecureCerts(true);
WebDriver driver = new ChromeDriver(o);
\`\`\``,
    },
    {
      heading: 'Grid & parallel',
      body: `\`\`\`java
WebDriver d = new RemoteWebDriver(new URL(System.getProperty("grid.url")), new ChromeOptions());

private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
DRIVER.set(new ChromeDriver());  DRIVER.get();  DRIVER.get().quit(); DRIVER.remove();
\`\`\`
\`docker run -d -p 4444:4444 --shm-size=2g selenium/standalone-chrome\` → Grid UI at http://localhost:4444.
TestNG: \`<suite parallel="methods" thread-count="4">\`.`,
    },
    {
      heading: 'Exceptions and what causes them',
      body: `| Exception | Typical cause | Fix |
|---|---|---|
| \`NoSuchElementException\` | locator matches nothing now; inside iframe/shadow DOM; not loaded yet | fix locator, explicit wait, switch frame |
| \`TimeoutException\` | wait condition never true | check screenshot: often a different app state |
| \`StaleElementReferenceException\` | DOM node replaced after you found it (re-render, refresh) | re-locate, wait for re-render, \`refreshed()\` |
| \`ElementNotInteractableException\` | hidden / zero-size / duplicate hidden match | unique locator, wait for visibility |
| \`ElementClickInterceptedException\` | overlay, sticky header, cookie bar covers it | wait for invisibility, scroll to centre |
| \`InvalidElementStateException\` | e.g. clear() on read-only/disabled field | check state |
| \`NoSuchFrameException\` | frame name/index wrong or not loaded | \`frameToBeAvailableAndSwitchToIt\` |
| \`NoSuchWindowException\` | window closed / using driver after close() | switch back to a valid handle |
| \`NoAlertPresentException\` | switching before alert appears / it's an HTML modal | \`alertIsPresent()\` |
| \`UnhandledAlertException\` | command sent while an alert is open | accept/dismiss first |
| \`InvalidSelectorException\` | broken CSS/XPath, compound class in \`By.className\` | fix syntax |
| \`MoveTargetOutOfBoundsException\` | Actions target outside viewport | scroll first, bigger window |
| \`UnexpectedTagNameException\` | \`Select\` on a non-\`<select>\` | click custom dropdown |
| \`SessionNotCreatedException\` | browser/driver mismatch, browser can't start | Selenium Manager, options |
| \`NoSuchSessionException\` | session quit/crashed; shared driver in parallel | ThreadLocal driver, teardown order |
| \`WebDriverException\` | parent of all; also connection refused to driver/Grid | read the message |`,
    },
  ],
}
