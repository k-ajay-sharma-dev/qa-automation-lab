export default {
  id: 'loc-018',
  category: 'locators',
  kind: 'locator',
  title: 'Multi-condition XPath: delete the ACTIVE admin',
  level: 'EXPERT',
  tags: ['xpath', 'predicates', 'dynamic-ids', 'axes', 'duplicate-classes'],
  estMinutes: 15,
  scenario: `Security audit finding AUD-77: "an Active admin account can be deleted without confirmation". Your test must click **Delete** on the
card of the user whose role is **Admin** *and* whose status is **Active**. Card ids are generated (\`user-3fa1c\`), every card has the same
classes and the same two buttons, and there are **two** Admins — one Inactive. Picking the wrong one would make the test pass for the wrong reason.`,
  description: `On **dynamic.html** (section 5, "Team members"), match the **Delete button** on the card whose role is **Admin** and status is **Active**.

**Rules**
- Do not use the user's name (the test data is generated per environment) and do not use the generated card id.
- Express **both** conditions (role and status) in the locator.
- No card indexes.
- Exactly 1 element.`,
  hints: [
    'Card: <div class="user-card card"> containing <span class="role">, <span class="status"> and two buttons.',
    'Stack predicates — each [ ] is another AND condition on the same element: //div[...][...][...]',
    '//div[contains(@class,"user-card")][span[@class="role" and text()="Admin"]][span[@class="status" and text()="Active"]]//button[text()="Delete"]',
  ],
  page: 'dynamic.html',
  strategy: 'xpath',
  expected: '#user-cards > div:nth-of-type(3) .btn-danger',
  expectedCount: 1,
  solution: `XPath:  //div[contains(@class,'user-card')][span[@class='role' and text()='Admin']][span[@class='status' and text()='Active']]//button[text()='Delete']
        //span[@class='role' and text()='Admin']/following-sibling::span[@class='status' and text()='Active']/following-sibling::div/button[text()='Delete']

Java (Page Object):
private static final String DELETE_FOR = "//div[contains(@class,'user-card')][span[@class='role' and text()='%s']]"
        + "[span[@class='status' and text()='%s']]//button[text()='Delete']";

public void deleteUser(String role, String status) {
    driver.findElement(By.xpath(String.format(DELETE_FOR, role, status))).click();
}

driver.findElement(By.xpath("//div[contains(@class,'user-card')][span[@class='role' and text()='Admin']][span[@class='status' and text()='Active']]//button[text()='Delete']")).click();`,
  explanation: `Each \`[ ]\` predicate filters the current node set, so stacking them is an **AND**:

\`\`\`
//div[contains(@class,'user-card')]        every card (4)
     [span[@class='role'   and text()='Admin']]    … that has an Admin role span (2)
     [span[@class='status' and text()='Active']]   … and an Active status span (1)
     //button[text()='Delete']                       → its Delete button
\`\`\`

This "filter the container, then descend" style scales to any number of conditions and stays readable. Use \`or\` inside one predicate for alternatives.

Why not the user's name? Because test data differs per environment; the business rule you are testing is about *role + status*, so the
locator should express exactly that. When you need many conditions like this, it is also a hint to ask developers for attributes like
\`data-role="admin"\` — but you should be able to handle it without.

The same page has a **shadow DOM** coupon widget: no XPath or document-level CSS can reach inside it — use \`getShadowRoot()\` and CSS within it.`,
  mistakes: [
    'Writing two separate XPaths and intersecting results in Java — one locator is clearer and atomic.',
    'Matching the status case-insensitively (e.g. contains(translate(., "ACTIVE", "active"), "active")) — "Inactive" contains "active" and the wrong card matches.',
    'Using //div[@class="user-card"] — the real class attribute is "user-card card".',
    'Locating by the generated card id copied from DevTools.',
  ],
  interview: [
    {
      q: 'How do you combine conditions in XPath?',
      a: 'Use and / or inside a predicate ([@a="x" and @b="y"]), or stack predicates ([cond1][cond2]) which also means AND. Predicates can contain paths, so [span[text()="Admin"]] means "has a child span with that text".',
    },
    {
      q: 'Why use an exact text match for the status instead of contains()?',
      a: 'Substring matching is fragile for enumerations: a case-insensitive contains("active") also hits "Inactive", and a future status like "Active - pending review" would sneak in. Exact text() = "Active" encodes the business rule precisely. Always ask which other values contain your substring.',
    },
    {
      q: 'How do you interact with elements inside a shadow DOM in Selenium 4?',
      a: 'Find the host element, call getShadowRoot() to get a SearchContext, then use CSS selectors on it: driver.findElement(By.cssSelector("coupon-widget")).getShadowRoot().findElement(By.cssSelector("#coupon-code")). XPath is not supported inside shadow roots.',
    },
  ],
}
