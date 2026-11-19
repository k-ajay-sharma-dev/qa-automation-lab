export default {
  slug: 'pom-pagefactory-vs-by',
  category: 'pom',
  order: 6,
  title: 'PageFactory and @FindBy vs plain By locators',
  minutes: 7,
  summary: 'Understand how PageFactory creates lazy proxy elements, what @CacheLookup risks, and why many teams prefer private By fields with explicit waits.',
  manualAnalogy: `Imagine two ways of preparing a test run: you either note *how to find* each element ("the Sort dropdown, top right") and look for it fresh each time, or someone hands you a pre-filled form of "elements" that quietly looks things up when you touch them. The second is convenient until the page changes under you and you don't know whether your note is still current. That is the \`By\` vs PageFactory debate.`,
  body: `## Two styles of the same page

**Style A — \`By\` fields** (what this course uses):

\`\`\`java
private final By sortDropdown = By.id("product-sort");

public InventoryPage sortBy(String value) {
    new Select(visible(sortDropdown)).selectByValue(value);
    return this;
}
\`\`\`

**Style B — PageFactory**:

\`\`\`java
@FindBy(id = "product-sort")
private WebElement sortDropdown;

@FindBy(css = "#inventory-list .item-price")
private List<WebElement> prices;

public InventoryPage(WebDriver driver) {
    this.driver = driver;
    PageFactory.initElements(driver, this);
}
\`\`\`

\`@FindBy\` is an **annotation** — a label starting with \`@\` that a library reads at runtime. It accepts \`id\`, \`css\`, \`xpath\`, \`name\`, \`className\` and more.

## What \`initElements\` really does

It does **not** search the page when the constructor runs. For every \`@FindBy\` field it injects a **proxy** — a stand-in object. Each time you call a method on the proxy (\`sortDropdown.click()\`), the proxy runs \`driver.findElement(...)\` *at that moment* and forwards the call.

Consequences:

- Creating the page object never throws \`NoSuchElementException\`, even on the wrong page. The error appears at first use.
- Because each use looks the element up again, a re-rendered element normally does **not** go stale.
- If you forget \`initElements\`, the fields are plain \`null\` and the first use throws \`NullPointerException\` — a confusing error for a beginner.

## @CacheLookup: the trap

\`\`\`java
@FindBy(css = ".inventory-item")
@CacheLookup
private List<WebElement> items;
\`\`\`

\`@CacheLookup\` tells the proxy "find once, then remember". That is faster for an element that never changes, like a static logo. On a list that is re-drawn after sorting, filtering or an AJAX refresh, the remembered elements belong to the *old* DOM and throw \`StaleElementReferenceException\`. Only use it for truly static elements, or not at all.

## Waiting is awkward with PageFactory

\`ExpectedConditions\` has two families:

| Takes a \`By\` | Takes a \`WebElement\` |
|---|---|
| \`visibilityOfElementLocated(By)\` | \`visibilityOf(WebElement)\` |
| \`elementToBeClickable(By)\` | \`elementToBeClickable(WebElement)\` |
| \`presenceOfElementLocated(By)\` | — (an element must already be found) |
| \`invisibilityOfElementLocated(By)\` | \`invisibilityOf(WebElement)\` |

The \`By\` versions re-locate the element on every poll, which is what you want while the page is still changing. "Wait until *present*" is impossible with a \`WebElement\` — you already need it to exist. With PageFactory you often end up writing a \`By\` anyway.

## Dynamic locators

\`@FindBy\` values must be **compile-time constants**. You cannot write \`@FindBy(xpath = "//div[text()='" + name + "']")\`. Locators that depend on data (a product name, an employee row) need \`By\` built at runtime — see the *Dynamic locators and web tables* lesson.

## Side-by-side

| | \`By\` fields | PageFactory |
|---|---|---|
| Lookup time | When you call \`findElement\` / a wait | Lazily, on each proxy use |
| Works with all ExpectedConditions | Yes | Only the \`WebElement\` overloads |
| Dynamic/data-driven locators | Yes (\`String.format\`) | No |
| Boilerplate | A little more | Less |
| Selenium team's view | Recommended | Still supported, not encouraged |

Neither is "wrong". Many existing frameworks use PageFactory and you should be able to read them. For new code, \`By\` + a BasePage with waits is simpler to reason about, and that is the style the rest of this course uses.

## Interview answer in one breath

"PageFactory's \`initElements\` injects lazy proxies for \`@FindBy\` fields; each use re-finds the element. \`@CacheLookup\` caches it and risks stale elements on dynamic pages. We use \`By\` because explicit waits and dynamic locators need a \`By\`, and it keeps lookup timing obvious."`,
  keyPoints: [
    '`PageFactory.initElements` injects lazy proxies; elements are found when first used, not in the constructor.',
    'Forgetting `initElements` leaves fields null → NullPointerException on first use.',
    '`@CacheLookup` remembers the element and causes StaleElementReferenceException on re-rendered pages.',
    'Waits like `presenceOfElementLocated` and dynamic locators need a `By`, not a `WebElement`.',
    'Be able to read PageFactory code, but prefer `By` fields for new frameworks.',
  ],
  mistakes: [
    'Adding `@CacheLookup` everywhere "for speed" — only static elements tolerate it.',
    'Mixing `@FindBy` fields and a forgotten `initElements` call — always initialise in the constructor (or not use PageFactory).',
    'Trying to concatenate variables into a `@FindBy` value — annotations need constants; use `By` with `String.format`.',
    'Wrapping every proxy in try/catch for staleness instead of fixing the cause (caching or keeping stale references).',
  ],
  tryIt: `On http://localhost:5180/practice-site/table.html open the DevTools console and run \`row = document.querySelector('#employee-table tbody tr')\`. Click **Next ›** in the pagination, then run \`row.isConnected\`. \`false\` means the table rebuilt its rows and your saved node is gone — exactly what a \`@CacheLookup\` element would still point to.`,
  problems: ['pom-006', 'pom-014'],
}
