export default {
  id: 'dbg-029',
  category: 'debugging',
  kind: 'quiz',
  title: 'InvalidSelectorException: when the locator itself is broken',
  level: 'BEGINNER',
  tags: ['InvalidSelectorException', 'xpath', 'css', 'locators', 'stack-trace'],
  estMinutes: 10,
  scenario: `A junior on your team pushed eight new locators for the ShopEasy login and inventory pages on Friday. Monday's run shows a new exception nobody has seen before: \`InvalidSelectorException\`. The junior insists "the elements are definitely on the page — I checked in Chrome". You pair with them to go through the failures one by one.`,
  description: `For each log or snippet, decide what is wrong. Remember: an **invalid** selector is a different problem from a selector that simply **matches nothing**.`,
  hints: [
    'InvalidSelectorException fires before the page is even searched: the browser could not parse or use the expression.',
    'A syntactically valid locator that finds nothing gives NoSuchElementException instead.',
  ],
  questions: [
    {
      q: `What is wrong here?

\`\`\`text
org.openqa.selenium.InvalidSelectorException: invalid selector: Unable to locate an element with the xpath expression //button[@id='login-button' because of the following error:
SyntaxError: Failed to execute 'evaluate' on 'Document': The string '//button[@id='login-button'' is not a valid XPath expression.
	at com.shopeasy.pages.LoginPage.clickLogin(LoginPage.java:31)
\`\`\``,
      options: [
        'The Login button has a different id now',
        'The XPath is missing its closing square bracket ]',
        'The page was not loaded yet; add an explicit wait',
        'XPath cannot use the @id attribute; use By.id instead',
      ],
      answer: 1,
      why: 'The browser could not even parse the expression: `//button[@id=\'login-button\'` opens a predicate with [ and never closes it. Waits cannot help a syntax error, and @id is perfectly valid in XPath (although By.id("login-button") would be simpler here). Paste the expression into DevTools (Ctrl+F in Elements, or $x("...") in the Console) to catch typos before running.',
    },
    {
      q: `This locator gives **NoSuchElementException** (not InvalidSelector), although \`#user-name\` exists. Why?

\`\`\`java
By.xpath("//input[@id=user-name]")
\`\`\``,
      options: [
        'Without quotes, user-name is read as a path to a child element called user-name, so the comparison never matches',
        'XPath ids are case-sensitive',
        'The input is inside an iframe',
        'Hyphens are not allowed in XPath at all',
      ],
      answer: 0,
      why: 'Without quotes, `user-name` is a relative path (child elements named "user-name"), not a string. The input has no such child, so the predicate is false — valid syntax, zero matches, NoSuchElementException. The fix is quotes: `//input[@id=\'user-name\']`. Lesson: some broken locators are invalid, others are silently wrong.',
    },
    {
      q: `You want all ShopEasy product prices. Why does this throw InvalidSelectorException?

\`\`\`java
driver.findElements(By.xpath("//div[@class='item-price']/text()"));
\`\`\`

\`\`\`text
invalid selector: The result of the xpath expression "//div[@class='item-price']/text()" is: [object Text]. It should be an element.
\`\`\``,
      options: [
        'findElements does not support XPath',
        'Selenium can only return elements, not text nodes — locate the div and call getText()',
        'The class name should be item_price',
        'text() must be written as string()',
      ],
      answer: 1,
      why: 'XPath can select text nodes and attributes, but WebDriver\'s findElement(s) only accepts expressions that return elements. Locate `//div[@class=\'item-price\']` and call getText() on each element (or getAttribute for attributes). Also note: ShopEasy has a $7.49 .item-price inside #promo-banner too — scope to #inventory-list if you only want product cards.',
    },
    {
      q: `Which line throws InvalidSelectorException in Selenium 4?`,
      options: [
        'By.id("login-button")',
        'By.cssSelector("#login-form button[type=submit]")',
        'By.className("btn btn-primary")',
        'By.name("username")',
      ],
      answer: 2,
      why: 'By.className takes ONE class name. "btn btn-primary" contains a space, which Selenium 4 rejects ("Compound class names not permitted"). Use By.cssSelector(".btn.btn-primary") — or better, a stable id like #login-button. The other three are valid locators for real ShopEasy elements.',
    },
    {
      q: `A teammate copied an XPath into a CSS locator:

\`\`\`java
By.cssSelector("//a[@id='shopping-cart-link']")
\`\`\`

What happens and what is the fix?`,
      options: [
        'It works because Selenium auto-detects XPath',
        'NoSuchElementException; add a wait',
        'InvalidSelectorException, because // is not CSS syntax — use By.xpath(...) or the CSS equivalent #shopping-cart-link',
        'StaleElementReferenceException',
      ],
      answer: 2,
      why: 'The By type decides the parser. CSS cannot parse `//a[...]`, so the browser rejects it as an invalid selector. Either keep the XPath with By.xpath, or write the shorter CSS `#shopping-cart-link` (or By.id). Mixing up By types is one of the most common copy-paste bugs.',
    },
  ],
  explanation: `**InvalidSelectorException = the locator could not be used at all**, so the page was never searched. Common causes:
- XPath syntax errors: missing \`]\`, \`)\` or a closing quote, unbalanced quotes inside \`'...'\`.
- An XPath that returns a **text node or attribute** (\`/text()\`, \`/@href\`) instead of an element.
- Using the wrong \`By\` type: XPath in \`By.cssSelector\`, or a compound class in \`By.className\`.

**Triage tip:** InvalidSelector is always a *test bug*. It never needs a wait and never depends on the environment. Validate locators in DevTools (\`$x("//...")\` for XPath, \`$$("css")\` for CSS) before committing — and in code review, look out for quotes, brackets and By types.

Do not confuse it with **NoSuchElementException**: a valid locator that matches nothing (wrong value, missing quotes around a string, iframe, timing).`,
  mistakes: [
    'Adding a longer wait for an InvalidSelectorException — waits cannot fix syntax.',
    'Copying an XPath into By.cssSelector (or the other way around).',
    'Using By.className with several classes separated by spaces.',
    'Selecting /text() in XPath instead of locating the element and calling getText().',
  ],
  interview: [
    { q: 'What is the difference between InvalidSelectorException and NoSuchElementException?', a: 'InvalidSelectorException means the locator itself is broken — bad syntax, the wrong By type, or an XPath that does not return an element — so the page is never searched. NoSuchElementException means the locator is valid but matched nothing at that moment, which can be timing, an iframe or a wrong value. The first is always a script bug; the second needs investigation.' },
    { q: 'How do you verify a locator before using it in code?', a: 'In Chrome DevTools I use Ctrl+F in the Elements panel, or $x() for XPath and $$() for CSS in the Console, and check that it matches exactly the element(s) I expect — ideally one. I prefer ids, data-testid or short CSS, and keep XPath for text-based or parent/child cases.' },
  ],
}
