export default {
  id: 'pom-025',
  category: 'pom',
  kind: 'quiz',
  title: 'PageFactory deep dive: @FindAll, @FindBys, @CacheLookup and stale proxies',
  level: 'ADVANCED',
  tags: ['pom', 'pagefactory', 'findby', 'stale-element', 'ajax'],
  estMinutes: 15,
  scenario: `You inherited the *ShopEasy Partner Portal* suite, built entirely on PageFactory. It is fast on a developer
laptop and randomly red on CI. The flaky stack traces mention \`StaleElementReferenceException\` and
\`NoSuchElementException\` in pages that use \`@CacheLookup\`, \`@FindAll\` and \`@FindBys\`. Before you rewrite anything,
you need to understand exactly what these annotations do.`,
  description: `Answer the questions about advanced PageFactory behaviour. (The basics — proxies, forgetting
\`initElements\`, why many teams prefer \`By\` — are in pom-006.)`,
  questions: [
    {
      q: `What does this field match on ShopEasy's inventory page?

\`\`\`java
@FindAll({
    @FindBy(css = ".inventory-item .item-price"),
    @FindBy(css = ".promo-banner .item-price")
})
private List<WebElement> prices;
\`\`\``,
      options: [
        'Only elements that match **both** selectors',
        'Elements that match **either** selector (OR) — the 6 card prices plus the promo price',
        'Only the first selector; the second is a fallback if the first finds nothing',
        'It does not compile: @FindAll needs a single @FindBy',
      ],
      answer: 1,
      why: '@FindAll is an **OR**: the result is every element matched by any of the inner locators. It is not a fallback chain. Here that is 6 card prices + the promo price = 7 elements.',
    },
    {
      q: `And this one?

\`\`\`java
@FindBys({
    @FindBy(id = "inventory-list"),
    @FindBy(css = ".item-price")
})
private List<WebElement> cardPrices;
\`\`\``,
      options: [
        'Elements that match either locator',
        'A **chain**: find \`#inventory-list\`, then \`.item-price\` **inside** it — the 6 card prices, not the promo',
        'Only elements that have id inventory-list and class item-price at the same time',
        'The first element of each locator',
      ],
      answer: 1,
      why: '@FindBys chains locators like nested findElement calls: each one searches inside the previous result (an AND across levels). It is the annotation version of `driver.findElement(By.id("inventory-list")).findElements(By.cssSelector(".item-price"))`.',
    },
    {
      q: `A page has:

\`\`\`java
@CacheLookup
@FindBy(css = "#inventory-list .inventory-item")
private List<WebElement> cards;
\`\`\`
The test reads \`cards\`, logs out, logs back in (a new page load), and reads \`cards\` again on the same page object. What happens?`,
      options: [
        'It works: the proxy re-finds the elements',
        '`StaleElementReferenceException`: the cached elements belong to the old document',
        '`NullPointerException`',
        'It returns an empty list',
      ],
      answer: 1,
      why: 'With @CacheLookup the proxy remembers the elements from the first lookup and never searches again. After navigation those references point to a document that no longer exists, so any call on them is stale. Without @CacheLookup the proxy would re-find on every access.',
    },
    {
      q: `Without @CacheLookup, a \`@FindBy\` field is re-located on every call. Can it still throw \`StaleElementReferenceException\`?

\`\`\`java
WebElement el = loginButton;  // the proxy
el.click();                    // page re-renders the button
el.click();                    // ?
\`\`\``,
      options: [
        'No, never — proxies are immune to staleness',
        'Yes, if you copy the proxy into a local variable',
        'No: each call on the proxy finds the element again, so the second click works; staleness can still occur *inside* one call if the DOM changes between the lookup and the action',
        'Yes, always on the second call',
      ],
      answer: 2,
      why: 'Copying the proxy reference copies the proxy, so it still re-locates on each method call. The remaining risk is a re-render in the tiny gap between the proxy\'s find and the action, or when you pass the WebElement out of a List already resolved (e.g. iterating `cards.get(i)` after a re-render). That is why staleness never fully disappears; explicit waits and re-finding by key do.',
    },
    {
      q: `The team uses \`PageFactory.initElements(new AjaxElementLocatorFactory(driver, 10), this)\`. What does that change?`,
      options: [
        'Elements are found once and cached for 10 seconds',
        'Each proxied lookup retries for up to 10 seconds until the element is **present** — a built-in implicit-wait for annotated fields',
        'It makes every click wait until the element is clickable',
        'It enables AJAX requests in the browser',
      ],
      answer: 1,
      why: 'AjaxElementLocatorFactory gives each field a locator that polls until the element is found (or the timeout). It is presence only — not visibility or clickability — so you still need explicit waits for "clickable" or "text present". Combined with an implicit wait it can multiply timeouts.',
    },
    {
      q: `Which is the most reasonable plan for the flaky Partner Portal suite?`,
      options: [
        'Add `@CacheLookup` everywhere to make lookups faster and more stable',
        'Remove `@CacheLookup` from anything that can re-render, wrap interactions in explicit waits (BasePage helpers), and migrate pages to `By` + dynamic locators gradually, one page per PR',
        'Rewrite the whole suite in one big PR',
        'Add `Thread.sleep(2000)` before each action',
      ],
      answer: 1,
      why: 'Remove the known cause first (caching on dynamic elements), then fix synchronisation with explicit waits, then migrate incrementally so every PR can be verified. Big-bang rewrites stall releases; sleeps hide the problem and slow everything.',
    },
  ],
  hints: [
    '@FindAll = OR. @FindBys = chain (search inside the previous result).',
    '@CacheLookup stores the first result forever; navigation or re-render makes it stale.',
  ],
  explanation: `| Annotation | Meaning | Plain-Selenium equivalent |
|---|---|---|
| \`@FindBy(css = "x")\` | one locator, re-found on each use | \`driver.findElement(By.cssSelector("x"))\` |
| \`@FindAll({a, b})\` | **OR**: matches of a plus matches of b | two \`findElements\` merged |
| \`@FindBys({a, b})\` | **chain**: b searched inside a | \`findElement(a).findElements(b)\` |
| \`@CacheLookup\` | find once, reuse forever | storing a \`WebElement\` in a field |
| \`AjaxElementLocatorFactory(d, n)\` | each lookup polls up to n seconds for presence | a per-field implicit wait |

Practical rules for a PageFactory codebase:
- \`@CacheLookup\` only on truly static elements (a logo, a fixed form on a server-rendered page). Never on lists,
  rows or anything after sort/filter/navigation.
- Proxies re-find on every call, which helps, but they do not wait for visibility or clickability — keep
  explicit waits.
- Do not keep a resolved \`List<WebElement>\` across actions that re-render it.

Knowing these details lets you fix a PageFactory suite instead of declaring "PageFactory is flaky" in an interview.`,
  mistakes: [
    'Reading @FindAll as a fallback chain; it is a union of all matches.',
    'Using @CacheLookup on lists that change after sort or filter.',
    'Assuming AjaxElementLocatorFactory waits for clickability.',
    'Fixing staleness with sleeps instead of re-locating elements.',
  ],
  interview: [
    { q: 'What is the difference between @FindAll and @FindBys?', a: '@FindAll returns elements matching any of the given locators (OR). @FindBys applies the locators as a chain, each one searching inside the previous result (nested search, effectively AND across levels).' },
    { q: 'When is @CacheLookup safe?', a: 'Only for elements that are never re-rendered or replaced for the lifetime of the page object, such as static parts of a server-rendered page. On dynamic UIs it causes StaleElementReferenceException after any re-render or navigation.' },
    { q: 'What does AjaxElementLocatorFactory do?', a: 'It makes each PageFactory proxy poll for the element for up to a timeout before failing. It only waits for presence, so you still need explicit waits for visibility, clickability or text, and you should not combine it with a large implicit wait.' },
  ],
}
