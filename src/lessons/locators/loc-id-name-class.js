export default {
  slug: 'loc-id-name-class',
  category: 'locators',
  order: 2,
  title: 'id, name, class and test ids: choosing a locator strategy',
  minutes: 7,
  summary: 'Use the simple Selenium strategies (By.id, By.name, By.className, test-id attributes) and follow a priority order that keeps locators stable for years.',
  manualAnalogy: `When you write a manual step you pick the clearest description: "click **Checkout**", not "click the third grey button from the left". The clearest description survives redesigns. Locator strategy is the same judgement: describe the element by what it *is* (its id, its purpose), not by where it happens to sit today.`,
  body: `## The Selenium strategies

Selenium's \`By\` class offers eight ways to find elements:

| Strategy | Example | Matches |
|---|---|---|
| \`By.id\` | \`By.id("password")\` | the element whose \`id\` is \`password\` |
| \`By.name\` | \`By.name("postalCode")\` | elements whose \`name\` is \`postalCode\` |
| \`By.className\` | \`By.className("cart-item")\` | elements that **have** that class (one class name only) |
| \`By.tagName\` | \`By.tagName("li")\` | every \`<li>\` |
| \`By.linkText\` | \`By.linkText("Logout")\` | \`<a>\` whose text is exactly "Logout" |
| \`By.partialLinkText\` | \`By.partialLinkText("Log")\` | \`<a>\` whose text contains "Log" |
| \`By.cssSelector\` | \`By.cssSelector("#cart-list .item-price")\` | anything CSS can express |
| \`By.xpath\` | \`By.xpath("//button[text()='Finish']")\` | anything XPath can express |

Under the hood Selenium turns the first few into CSS anyway, so learning CSS and XPath (next lessons) covers everything.

## id: the first choice

\`\`\`html
<input type="text" id="postal-code" name="postalCode" placeholder="Zip/Postal Code">
\`\`\`

\`\`\`java
driver.findElement(By.id("postal-code"));
\`\`\`
In CSS an id is written with \`#\`: \`#postal-code\`. In XPath: \`//input[@id='postal-code']\`.

An id is meant to be unique and describes the element itself. Two warnings: some frameworks generate ids that change on every load (\`btn-8f3a2\`) — those are not stable (see the *Dynamic elements* lesson); and duplicate ids do happen in buggy pages, so still check the match count.

## name: great for form fields

Form inputs nearly always have \`name\`, because that is the key the form sends to the server. When an element has no id — like the checkbox inside a label — \`name\` is often the next best thing:

\`\`\`html
<label><input type="checkbox" name="categories" value="outdoor"> Outdoor gear</label>
\`\`\`

\`\`\`java
driver.findElements(By.name("categories"));   // all four category checkboxes
\`\`\`

Note that several elements can share a name (checkbox and radio groups), so \`findElements\` may be the right call. In CSS a name is an attribute selector: \`[name='categories']\`.

## class: usually for groups

Classes describe *style*, so many elements share them. That makes classes great for "all items of this kind" and weak for "this one item":

\`\`\`java
List<WebElement> buttons = driver.findElements(By.className("btn"));  // dozens!
List<WebElement> cartRows = driver.findElements(By.className("cart-item")); // one per row
\`\`\`

- \`By.className\` takes **one** class. \`By.className("btn btn-primary")\` fails — use CSS \`.btn.btn-primary\` instead.
- In CSS a class is written with a dot: \`.cart-item\`.
- Hidden is not gone: pages that show one step or tab at a time often keep the others in the HTML, hidden by CSS. A class-only locator
  finds the hidden copies too, so \`findElement\` may return one the user cannot even see.

## data-testid: the contract with developers

Many teams agree that developers add a dedicated attribute for tests:

\`\`\`html
<button id="finish" data-testid="finish">Finish</button>
\`\`\`

Its only purpose is automation, so designers will not rename it while restyling. There is no \`By.testId\` — use an attribute selector: CSS \`[data-testid='finish']\`, XPath \`//*[@data-testid='finish']\`. If your app lacks test ids, asking developers to add them is a legitimate, cheap improvement request.

## A priority order that ages well

1. **Test-id** attribute or a **stable, unique id**.
2. **name** (forms) or another meaningful attribute (\`type\`, \`aria-label\`, \`placeholder\`).
3. **CSS** combining a stable parent with a class or attribute.
4. **XPath** on visible text or relationships (when nothing else identifies it).
5. Never: absolute paths (\`/html/body/div[2]/…\`) or long index chains.

Ask two questions of every locator: *Does it match exactly what I mean?* (check the count in DevTools) and *Would it survive a redesign?* (does it describe what the element **is**, or just where it sits?).`,
  keyPoints: [
    'Prefer test ids and stable ids, then name, then CSS, then XPath; never absolute paths.',
    'CSS shorthand: #id for id, .name for class, [attr=\'value\'] for any attribute.',
    'By.className accepts a single class; combine classes in CSS as .a.b.',
    'name is ideal for form fields and can be shared by a whole radio/checkbox group.',
  ],
  mistakes: [
    'Passing two classes to By.className — compile works, run fails. Use By.cssSelector(".btn.btn-primary").',
    'Using a class that dozens of elements share to find one element — findElement silently takes the first.',
    'Trusting an id that contains a random-looking suffix — reload the page and see if it changes.',
  ],
  tryIt: `On http://localhost:5180/practice-site/checkout.html, find three different locators for the Last Name field (id, name, data-testid). Test each in DevTools with \`$$()\` and confirm each matches 1 element.`,
  problems: ['loc-001', 'loc-002', 'loc-003', 'loc-004', 'loc-017', 'loc-020'],
}
