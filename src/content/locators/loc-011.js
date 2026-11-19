export default {
  id: 'loc-011',
  category: 'locators',
  kind: 'locator',
  title: 'contains(@class): the "Choose" button of the featured plan',
  level: 'INTERMEDIATE',
  tags: ['xpath', 'contains', 'class', 'duplicate-classes'],
  estMinutes: 10,
  scenario: `Marketing runs an A/B test: the highlighted pricing plan moves between Basic, Plus and Pro depending on the campaign.
Your test must always pick **whichever plan is featured**. A teammate wrote \`//div[@class='plan--featured']//button\` and it finds nothing —
they are now convinced "XPath is broken in Chrome".`,
  description: `On **dynamic.html** (section 2, "Pricing plans"), match the **Choose button inside the featured plan card**.

**Rules**
- Identify the card by its \`plan--featured\` class — not by its title or position.
- If you use XPath, remember the card has **several** classes.
- Exactly 1 element.`,
  hints: [
    'Inspect the card: class="plan plan--featured". @class="plan--featured" compares the WHOLE attribute string.',
    'XPath: //div[contains(@class,"plan--featured")]//button',
    'CSS handles multiple classes natively: .plan--featured button',
  ],
  page: 'dynamic.html',
  strategy: 'either',
  expected: '.plan--featured button',
  expectedCount: 1,
  solution: `CSS:    .plan--featured button
XPath:  //div[contains(@class,'plan--featured')]//button

Java:
driver.findElement(By.cssSelector(".plan--featured button")).click();`,
  explanation: `Why the teammate's XPath failed: \`@class='plan--featured'\` compares the full attribute value, and the real value is
\`"plan plan--featured"\`. XPath has no notion of "class list"; you must use \`contains(@class,'...')\`.

CSS understands classes as a list, so \`.plan--featured\` just works. This is a good example of choosing the right tool: CSS is shorter,
faster and handles classes properly; XPath is needed for text and for walking **up** the tree.

Gotcha: \`contains(@class,'plan')\` would match all three cards **and** the \`plan-price\` divs (substring match!). Make the substring specific.`,
  mistakes: [
    'Using @class="plan--featured" with an exact comparison on a multi-class element.',
    'Selecting the plan by its title "Plus" — the featured plan changes per campaign, so the test checks the wrong thing.',
    'contains(@class,"plan") — matches every plan card and every div.plan-price too.',
  ],
  interview: [
    {
      q: 'An XPath works in DevTools for one page but not another. The element has class="btn btn-primary active". Why might //button[@class="btn btn-primary"] fail?',
      a: 'Exact @class comparison breaks as soon as a class is added, removed or re-ordered (e.g. "active" is added on hover/selection). Use CSS .btn.btn-primary or contains() on a specific class.',
    },
    {
      q: 'When do you prefer CSS over XPath?',
      a: 'Most of the time: CSS is shorter, more readable, slightly faster, and understood by front-end developers. Use XPath when you need text matching or need to navigate to parents/ancestors/preceding siblings.',
    },
  ],
}
