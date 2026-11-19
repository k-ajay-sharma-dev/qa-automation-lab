export default {
  id: 'pom-028',
  category: 'pom',
  kind: 'quiz',
  title: 'Name it like the user would: business language for page methods',
  level: 'BEGINNER',
  tags: ['pom', 'naming', 'readability', 'code-review'],
  estMinutes: 8,
  scenario: `Your BA wants to read the automated tests during sprint review to confirm they match the acceptance criteria.
Today the tests say \`clickBtn2()\`, \`typeInField("user-name", ...)\` and \`clickXpath3()\`. Before the review your lead
asks you to rename the page methods so a non-coder can follow them.`,
  description: `Pick the best method name for each ShopEasy action. Think: *would this name still make sense if the HTML
changed tomorrow?*`,
  questions: [
    {
      q: 'On `login.html` the method types username and password and clicks `#login-button`. Best name?',
      options: ['`clickLoginButton(String u, String p)`', '`loginAs(String user, String password)`', '`fillAndSubmitForm1(String u, String p)`', '`doLogin()`'],
      answer: 1,
      why: '`loginAs` describes the user goal. `clickLoginButton` names only one of three steps, `fillAndSubmitForm1` describes the HTML, and `doLogin()` hides which user is logging in.',
    },
    {
      q: 'On `inventory.html` the method clicks the *Add to cart* button inside the card of a named product. Best name?',
      options: ['`clickAddButton(int index)`', '`addToCart(String productName)`', '`clickButtonByXpath(String xpath)`', '`addProductToCartUsingCssSelectorOnCard(String name)`'],
      answer: 1,
      why: 'Business action + business identifier. An index breaks when the sort order changes, an XPath parameter leaks locators into the test, and naming the locator strategy couples the name to implementation.',
    },
    {
      q: 'Which name **leaks implementation details** into the test?',
      options: ['`openCart()`', '`getErrorMessage()`', '`clickSpanWithClassCartBadge()`', '`sortBy("Price (low to high)")`'],
      answer: 2,
      why: 'A span with a CSS class is an HTML detail. If the badge becomes a `<div>` the method name is a lie. The others describe what the user does or sees.',
    },
    {
      q: 'The BA reads: `checkout.fillWith(data).continueToOverview().finish()`. What is the main benefit of this naming?',
      options: [
        'It runs faster',
        'It maps one-to-one to the manual test steps, so non-coders can review coverage',
        'It removes the need for assertions',
        'It lets Selenium find elements without locators',
      ],
      answer: 1,
      why: 'Naming does not change speed or behaviour. Its value is that the test reads like the test case, so reviewers can spot missing steps without reading Selenium code.',
    },
  ],
  hints: [
    'Ask: what is the user trying to do, not which element is clicked.',
    'If the name contains button, xpath, css, span or an index, it is probably too technical.',
  ],
  explanation: `Page methods are the **vocabulary of your test suite**. Name them after user intent (\`loginAs\`,
\`addToCart\`, \`openCart\`, \`continueToOverview\`) and keep HTML words (button, span, xpath, index) inside the page.

A good rule of thumb: if you could paste the method chain into a manual test case and a tester would understand it,
the names are right. It is the same skill you already use when writing clear manual steps — only now the steps compile.`,
  mistakes: [
    'Naming methods after the element (clickSubmitBtn) instead of the action (submitOrder).',
    'Passing locators or indexes as parameters from the test.',
    'Using vague names like doStuff(), process() or handle().',
  ],
  interview: [
    { q: 'How do you make automated tests readable for non-technical stakeholders?', a: 'Expose page methods in business language that mirrors the user journey, keep locators and waits inside the page objects, and keep tests short: arrange data, call intent-revealing methods, assert. For wider audiences, add a BDD layer like Cucumber on top.' },
    { q: 'Should a page object have a generic click(String locator) method that tests call?', a: 'No. That pushes locators back into the tests and defeats the purpose of POM. A generic click(By) helper is fine as a protected method in BasePage, used only by page classes.' },
  ],
}
