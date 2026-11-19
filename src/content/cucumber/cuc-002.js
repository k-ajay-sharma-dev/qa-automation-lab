export default {
  id: 'cuc-002',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Given / When / Then rules and declarative style',
  level: 'BEGINNER',
  tags: ['gherkin', 'keywords', 'declarative'],
  estMinutes: 10,
  scenario: `Your first feature file went to review and the SDET lead left comments like "this Given is an action" and
"too imperative — describe the behaviour, not the clicks". Before you fix it, make sure the keyword rules are solid.`,
  description: 'Answer the questions about Gherkin keywords and declarative vs imperative style.',
  questions: [
    {
      q: 'Which step is written with the **wrong keyword**?',
      options: [
        'Given the shopper is logged in',
        'Given the shopper clicks the "Add to cart" button',
        'When the shopper removes the backpack from the cart',
        'Then the cart badge shows 2',
      ],
      answer: 1,
      why: 'Given describes a **state** that already exists, not an action under test. Clicking is the behaviour you exercise, so it belongs in When. The other three use their keyword correctly.',
    },
    {
      q: 'What does Cucumber actually do differently for `Given`, `When`, `Then`, `And` and `But` when matching step definitions?',
      options: [
        'Then steps run assertions automatically',
        'Given steps run before all When steps even if written later',
        'Nothing — the keyword is ignored when matching; only the step text matters',
        'And/But steps cannot have parameters',
      ],
      answer: 2,
      why: 'Cucumber matches on the text after the keyword. A `@Given("the cart is empty")` definition also matches `And the cart is empty` or `Then the cart is empty`. The keywords exist for **humans**, so use them correctly for readability.',
    },
    {
      q: 'Which scenario is **declarative**?',
      options: [
        'When I type "standard_user" into the #user-name field\nAnd I type "secret_sauce" into the #password field\nAnd I click the #login-button',
        'When I log in as a standard user',
        'When I click the element with xpath //button[1]',
        'When I wait 3 seconds and press Enter',
      ],
      answer: 1,
      why: 'Declarative steps describe **what** the user achieves ("log in as a standard user"), hiding **how** (fields, buttons, XPaths). If the login page is redesigned, declarative steps do not change — only the page object does.',
    },
    {
      q: 'When is `But` the right choice?',
      options: [
        'To negate the previous Then: `Then the order is placed` / `But no confirmation e-mail is sent`',
        'To mark an optional step that may fail',
        'To start a new scenario inside a scenario',
        'Only after a Given',
      ],
      answer: 0,
      why: '`But` is a readability alias like `And`, used for a contrasting/negative outcome. It does not make anything optional and it can follow any keyword.',
    },
    {
      q: 'How many `When` steps should a well-written scenario normally have?',
      options: ['As many as the manual test case had steps', 'Exactly one behaviour (one When, possibly with an And)', 'Zero — Whens are optional', 'At least three'],
      answer: 1,
      why: 'A scenario should prove **one** business rule. Several When/Then/When/Then blocks mean you are writing a test script that tests multiple things; split it into separate scenarios.',
    },
  ],
  hints: ['Given = state, When = action, Then = observable result.', 'Cucumber ignores the keyword when matching step text.'],
  explanation: `Gherkin keywords are a contract with the **reader**, not with the engine. Use Given for context, When for the one action
under test and Then for outcomes. Prefer declarative steps ("log in as a standard user") over imperative UI scripts ("type into #user-name…") —
they survive UI changes and stay readable for the business.`,
  interview: [
    { q: 'Declarative vs imperative Gherkin — which do you prefer and why?', a: 'Declarative. It describes business behaviour, so feature files stay stable when the UI changes and remain readable for non-technical people. The how lives in step definitions and page objects.' },
    { q: 'Can a @Given step definition match a line starting with Then?', a: 'Yes. Cucumber matches only the step text; the keyword annotation is for readability. That is also why two definitions with the same text under different keywords are ambiguous.' },
  ],
}
