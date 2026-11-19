export default {
  id: 'loc-021',
  category: 'locators',
  kind: 'locator',
  title: 'Home page smoke test: every practice-page card link',
  level: 'BEGINNER',
  tags: ['css', 'class', 'scoping', 'findElements', 'home'],
  estMinutes: 6,
  scenario: `Your first automated smoke test for ShopEasy: "open the home page, check that every practice page is linked from a card, and that
none of the links is broken". The home page has the same links twice — once in the top navigation bar and once as card titles. The
requirement is about the **cards**; a nav-link count would hide a missing card.`,
  description: `On **index.html**, write a locator that matches **the title link of every page card** (Login, Inventory, … Dynamic) — and **not**
the links in the header navigation or the brand logo.

**Rules**
- Scope to the cards area or use the class the card links share.
- Exactly 11 elements.`,
  hints: [
    'Inspect a card title: <a class="page-link" href="login.html">Login</a> inside <div id="page-cards">.',
    'Class selector, optionally scoped: #page-cards .page-link',
  ],
  page: 'index.html',
  strategy: 'either',
  expected: '#page-cards .page-link',
  expectedCount: 11,
  solution: `CSS:    #page-cards .page-link          (a.page-link also works)
XPath:  //div[@id='page-cards']//a[contains(@class,'page-link')]

Java:
List<WebElement> cards = driver.findElements(By.cssSelector("#page-cards .page-link"));
Assert.assertEquals(cards.size(), 11);
for (WebElement link : cards) {
    Assert.assertFalse(link.getAttribute("href").isBlank(), link.getText() + " has no href");
}`,
  explanation: `\`findElements\` returns a list, which is exactly what a "check every link" test needs. The trick is to make the list contain
the right links only. A plain \`a\` selector returns 24 links (brand, 12 nav links, 11 cards); \`a[href='login.html']\` returns two (nav + card).

Scoping with \`#page-cards\` says "only inside the card grid", and the \`.page-link\` class says "only the card titles" — not, for example,
a link someone later adds inside a card's bullet list. Each part narrows the description, just like you would in a bug report.

Unlike \`findElement\`, \`findElements\` never throws when nothing matches; it returns an empty list. So always **assert the size** —
otherwise a loop over an empty list passes silently.`,
  mistakes: [
    'Using "a" or "nav a" — counts the header links, so a missing card is not noticed.',
    'Looping over findElements without asserting the size — an empty list makes the test pass with zero checks.',
    'Locating each card by its link text in 11 separate locators instead of one list locator.',
  ],
  interview: [
    {
      q: 'What is the difference between findElement and findElements when nothing matches?',
      a: 'findElement throws NoSuchElementException (after the implicit wait, if any). findElements returns an empty list and does not throw — which is why it is also used to check that something is absent: findElements(...).isEmpty().',
    },
    {
      q: 'How would you check that none of those links is broken?',
      a: 'Collect the href of each link with getAttribute("href"), then either open each one and assert the page title, or send an HTTP request (e.g. HttpURLConnection or RestAssured) and assert the status code is below 400. The HTTP approach is faster for large sites.',
    },
  ],
}
