export default {
  slug: 'loc-html-dom-devtools',
  category: 'locators',
  order: 1,
  title: 'How a web page is built: HTML, the DOM and DevTools',
  minutes: 8,
  summary: 'Read HTML tags and attributes, understand the DOM tree (parent, child, sibling), and use Chrome DevTools to inspect elements and test locators live with $$() and $x().',
  manualAnalogy: `As a manual tester you describe elements by what you *see*: "the blue Login button under the password box". A browser does not see — it reads a tree of HTML elements. A locator is simply a description of an element written in the tree's language. DevTools is the X-ray that shows you that tree, so you can describe elements the way the browser understands them.`,
  body: `## HTML in five minutes

Every element on a page is written as a **tag**:

\`\`\`html
<button type="button" id="continue-shopping" class="btn" data-testid="continue-shopping">← Continue Shopping</button>
\`\`\`

| Part | Here | Meaning |
|---|---|---|
| tag name | \`button\` | what kind of element (\`input\`, \`a\`, \`div\`, \`span\`, \`li\`, \`td\`…) |
| attributes | \`type\`, \`id\`, \`class\`, \`data-testid\` | \`name="value"\` pairs describing the element |
| text | \`← Continue Shopping\` | what the user reads |
| closing tag | \`</button>\` | end of the element (\`<input>\` has none) |

Attributes you will use all the time:

- \`id\` — meant to be **unique** on the page.
- \`name\` — used by form fields; groups radio buttons.
- \`class\` — a **space-separated list** of style names; many elements share them. \`class="btn btn-primary"\` means two classes: \`btn\` and \`btn-primary\`.
- \`data-testid\` (or \`data-test\`, \`data-qa\`) — added by developers specifically for automation.

## The DOM: HTML as a family tree

The browser turns HTML into a tree called the **DOM** (Document Object Model). Elements nested inside others are their **children**.

\`\`\`html
<ul id="cart-list">                    <!-- parent -->
  <li class="cart-item">               <!-- child of ul, sibling of next li -->
    <div class="item-name">Pulse Bike Light</div>
    <div class="item-price">$9.99</div>
  </li>
  <li class="cart-item"> … </li>
</ul>
\`\`\`

Family words you will use with locators:

- **parent** — the element directly around it (\`li\` is the parent of \`.item-name\`).
- **child** — one level inside; **descendant** — any level inside.
- **sibling** — same parent (\`.item-name\` and \`.item-price\` are siblings).
- **ancestor** — any level above (\`ul\` is an ancestor of \`.item-price\`).

Important: the DOM is **live**. JavaScript adds and removes elements after the page loads — the cart rows above are built by script. "View page source" shows the original HTML; DevTools' *Elements* panel shows the DOM as it is **now**. Always trust the Elements panel.

## Inspecting an element

1. Right-click the element on the page → **Inspect** (or press F12, then the arrow icon top-left of DevTools and click the element).
2. DevTools highlights its tag in the Elements panel. Read the tag name and attributes.
3. Look **up** the tree too: often a stable parent (a list or form with an id) is the best anchor.

## Testing a locator before you write any Java

Press **Ctrl+F** inside the Elements panel: the search box accepts plain text, CSS selectors and XPath, and shows "1 of 3" — the number of matches. Or use the **Console** tab:

\`\`\`js
$$('.btn')                 // CSS: returns an array of every match
$x("//button")             // XPath: same, for XPath expressions
$$('#checkout').length     // just the count
\`\`\`

Hover over a result in the Console and the element lights up on the page. This is the single most valuable habit in automation: **prove your locator matches exactly what you intended — and only that — before you put it in code.** "1 of 1" for a single element; the expected count when you want a group.

## How this maps to Selenium

\`\`\`java
WebElement continueBtn = driver.findElement(By.id("continue-shopping"));    // exactly one
List<WebElement> rows = driver.findElements(By.cssSelector(".cart-item"));  // zero or more
\`\`\`

\`findElement\` returns the **first** match (and throws \`NoSuchElementException\` if there are none), so a locator that accidentally matches three elements "works" — while silently using the wrong one. That is why the match count you checked in DevTools matters.

## The Locator Lab

In this app's locator problems the page loads in the Lab, your locator is run against the real DOM, and every matched element is highlighted with the count. Treat the count like a test result: wrong count = locator bug.`,
  keyPoints: [
    'An element = tag name + attributes + text; class can hold several space-separated names.',
    'The DOM is a tree: parent, child, sibling, ancestor, descendant.',
    'The Elements panel shows the live DOM; page source may be outdated.',
    'Test every locator in DevTools (Ctrl+F, $$() for CSS, $x() for XPath) and check the match count.',
    'findElement silently takes the first of many matches — aim for exactly the count you expect.',
  ],
  mistakes: [
    'Copying the locator from "View page source" — elements added by JavaScript are missing there; use the Elements panel.',
    'Reading class="btn btn-primary" as one class name — it is two classes.',
    'Writing the locator in Java first and debugging by re-running the test — check it in DevTools first, it takes seconds.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/cart.html, press F12 and Inspect the Checkout button. In the Console run \`$$('.btn')\` and \`$$('#checkout')\` — compare the counts and hover over the results to see which elements light up.`,
  problems: ['loc-001', 'loc-003', 'loc-017'],
}
