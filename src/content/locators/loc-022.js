export default {
  id: 'loc-022',
  category: 'locators',
  kind: 'locator',
  title: 'Attribute value: links that open a new tab',
  level: 'BEGINNER',
  tags: ['css', 'attribute', 'windows', 'target-blank'],
  estMinutes: 5,
  scenario: `The security team raised SEC-31: "every link that opens a new tab (\`target="_blank"\`) must also have \`rel="noopener"\`". You are
asked to add a check to the regression suite that collects all such links on a page and inspects their \`rel\` attribute. The check must work on
any page, so you cannot hard-code a link's id — you locate links by **what they do**.`,
  description: `On **windows.html**, write a locator that matches **every link that opens in a new tab**, using the \`target\` attribute.

**Rules**
- Do not use the link's id or its text.
- The locator must describe the behaviour (\`target="_blank"\`), so it would also work on other pages.
- On this page it matches exactly 1 element.`,
  hints: [
    'Inspect "Open size guide in new tab": look at its target attribute.',
    'Attribute equals value: a[target=\'_blank\']',
  ],
  page: 'windows.html',
  strategy: 'either',
  expected: "a[target='_blank']",
  expectedCount: 1,
  solution: `CSS:    a[target='_blank']
XPath:  //a[@target='_blank']

Java (reusable check):
for (WebElement link : driver.findElements(By.cssSelector("a[target='_blank']"))) {
    String rel = link.getAttribute("rel");
    Assert.assertTrue(rel != null && rel.contains("noopener"), link.getText() + " is missing rel=noopener");
}`,
  explanation: `\`[attr='value']\` matches any element whose attribute has exactly that value. Here the attribute is not an identifier at all — it
describes **behaviour** (open in a new browsing context). That makes the locator reusable: the same line finds new-tab links on every page of
the site, which is what a cross-cutting check like SEC-31 needs.

Note the two buttons on windows.html ("Open chat pop-up", "Open terms + privacy") also open windows, but with JavaScript \`window.open\` —
there is no attribute to see in the HTML. A locator can only find what is in the DOM; behaviour hidden in scripts needs a different test
(click, then check \`getWindowHandles()\`).`,
  mistakes: [
    'Using the id new-tab-link — correct for this one link but useless for a site-wide check.',
    'Forgetting the quotes around _blank inside a Java string, or using double quotes without escaping.',
    'Expecting the window.open buttons to match — their behaviour is in JavaScript, not in an attribute.',
  ],
  interview: [
    {
      q: 'After clicking a target="_blank" link, why does Selenium still see the old page?',
      a: 'WebDriver keeps its focus on the original window until you switch. Save driver.getWindowHandle(), click, wait for getWindowHandles().size() to grow, switch to the handle that is not the original, and switch back when done.',
    },
    {
      q: 'Can you give an example of locating elements by an attribute that is not id, name or class?',
      a: 'type (input[type=\'email\']), href (a[href$=\'.pdf\']), target, aria-label, placeholder, role, data-* attributes. Any attribute the HTML has can be used; prefer the ones that describe purpose and are unlikely to change.',
    },
  ],
}
