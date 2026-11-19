export default {
  id: 'int-025',
  category: 'interview',
  kind: 'quiz',
  title: 'BDD is a conversation, not a tool: who writes features, and what good Gherkin looks like',
  level: 'INTERMEDIATE',
  tags: ['bdd', 'cucumber', 'gherkin', 'three-amigos', 'collaboration', 'declarative'],
  estMinutes: 15,
  scenario: `Your CV says "BDD with Cucumber". The interviewer's first question is a trap: *"What is BDD?"* — and most candidates answer "a framework where we write tests in Given/When/Then". The follow-ups probe whether your team really practised it: *"Who wrote the feature files?"*, *"When were they written?"*, *"Show me a good scenario"*. Your experience reviewing acceptance criteria with BAs is exactly the BDD skill; this quiz gives it the right words.`,
  description: `Pick the best answer. Notice how often the right answer is about **people and timing**, not about Cucumber syntax.`,
  hints: [
    'BDD = discovery (conversation with examples) → formulation (Gherkin) → automation. The tool is only the last step.',
    'Declarative steps say WHAT the user achieves; imperative steps list clicks and field ids.',
  ],
  questions: [
    {
      q: 'What is the main purpose of **BDD**?',
      options: [
        'To let testers write automation without learning Java',
        'To build a shared understanding of the behaviour before it is built: business, development and testing agree on concrete examples, which become executable specifications and living documentation',
        'To replace unit tests with Cucumber tests',
        'To make Selenium run faster',
      ],
      answer: 1,
      why: 'BDD is a **collaboration practice**. The biggest value is created in the conversation that finds missing rules ("What if the postal code has letters?") before anyone codes. Cucumber automates the agreed examples. If features are written by QA alone after development, the team uses Gherkin but is not doing BDD.',
    },
    {
      q: 'Who should write the feature files, and when?',
      options: [
        'The automation tester, alone, after the feature is released',
        'They come out of a "three amigos" session (product owner/BA, developer, tester) during refinement, before development; often the tester or BA drafts them, the others review, and automation engineers implement the step definitions',
        'Only the product owner, with no review',
        'The developers, after the code is merged',
      ],
      answer: 1,
      why: 'Testers are great at **drafting** examples — boundary values and negative cases are your daily work — but the scenarios belong to the whole team and are agreed **before** development. Say what your team really did; if features were written by QA afterwards, say so and say what you would improve.',
    },
    {
      q: `Which ShopEasy scenario is better written?

**A**
\`\`\`gherkin
Scenario: Cart badge
  Given I open "http://localhost:5180/practice-site/login.html"
  When I type "standard_user" into "#user-name"
  And I type "secret_sauce" into "#password"
  And I click "#login-button"
  And I click "#add-to-cart-trailblazer-backpack"
  And I click "#add-to-cart-pulse-bike-light"
  Then the element ".shopping-cart-badge" has text "2"
\`\`\`

**B**
\`\`\`gherkin
Scenario: The cart badge counts the products I add
  Given I am logged in as a standard customer
  When I add "Trailblazer Backpack" and "Pulse Bike Light" to the cart
  Then the cart badge shows 2
\`\`\``,
      options: [
        'A — it is more detailed, so it is more precise',
        'B — it is declarative: it describes the behaviour in business language, survives UI changes, and keeps URLs, ids and clicks in the step definitions and page objects',
        'Both are equally good',
        'Neither — Gherkin must not contain product names',
      ],
      answer: 1,
      why: '**Imperative** scenarios (A) are test scripts in disguise: a BA can\'t review them, and every locator change breaks the feature file. **Declarative** scenarios (B) describe *what* and leave *how* to the code. Rule of thumb: if a step mentions a CSS selector, a URL or "click", it is too low-level.',
    },
    {
      q: 'Every scenario in `checkout.feature` starts with the same three steps (logged in, cart has a backpack, on the cart page). Where do they belong, and where does "start Chrome and take a screenshot on failure" go?',
      options: [
        'Both in the Background',
        'The business precondition goes in the feature\'s **Background** (readable by the BA); starting the browser and screenshots go in **hooks** (@Before/@After in code), because they are technical and invisible to business readers',
        'Both in hooks',
        'Copy the steps into every scenario',
      ],
      answer: 1,
      why: 'Background = shared **business context**, visible in the feature. Hooks = **technical plumbing**. Keep the Background short (2–4 steps); if only half the scenarios need it, split the feature instead of forcing it on all of them.',
    },
    {
      q: 'Which situation shows BDD going **wrong** in a team?',
      options: [
        'The BA reads the feature files during sprint review',
        'Scenarios are reused as acceptance criteria in Jira',
        'Only QA ever reads the feature files, they are written after development as click-by-click scripts, and the team spends more time maintaining step definitions than discussing examples',
        'The developer asks "what should happen with an empty postal code?" during refinement',
      ],
      answer: 2,
      why: 'That is "Cucumber as a test-script wrapper": all the cost of an extra layer, none of the collaboration value. An honest, senior answer: "In that situation I\'d either bring the BA into the conversation, or suggest plain TestNG for technical suites, because Gherkin only pays off when non-technical people use it."',
    },
  ],
  explanation: `**Model answer — "What is BDD?"**
> "BDD is a collaboration practice: before we build a story, the product owner, a developer and a tester discuss it using concrete examples — a three-amigos session. The examples we agree on are written as Gherkin scenarios, which become the acceptance criteria, then automated with Cucumber, so the feature files are living documentation that always runs. The tool is the last step; the conversation is where the bugs are prevented."

**Model answer — "Who wrote your feature files?"** (adapt honestly)
> "I usually drafted them after refinement, because I'm good at finding edge cases — for checkout I added the empty and invalid postal-code examples. The BA reviewed the wording and the developers checked that the steps matched the design. Then I implemented the step definitions on top of our page objects."

**Good Gherkin checklist**
- One behaviour per scenario, a title that states the rule.
- Declarative steps in business language — no selectors, URLs or "click".
- Background only for shared business context; hooks for technical setup.
- Scenario Outline for genuine variations of one rule (e.g. postal-code validation), not to cram different behaviours together.`,
  mistakes: [
    'Defining BDD as "writing tests in Given/When/Then".',
    'Writing imperative, click-by-click scenarios with CSS selectors in them.',
    'Claiming business people wrote the features when they never read them — follow-up questions expose it.',
    'Putting technical setup such as browser start in the Background.',
  ],
  interview: [
    { q: 'What is BDD, and how is it different from Cucumber?', a: 'BDD is a practice for building shared understanding through concrete examples agreed by business, development and testing before development. Cucumber is a tool that executes those examples written in Gherkin. You can use Cucumber without doing BDD — if only QA writes and reads the features — and then it mostly adds maintenance cost.' },
    { q: 'What is the difference between declarative and imperative Gherkin?', a: 'Imperative steps describe UI mechanics — type into this field, click this button. Declarative steps describe intent and outcome — I am logged in, I add two products, the badge shows 2. Declarative scenarios are readable by the business and do not break when the UI changes; the mechanics live in step definitions and page objects.' },
    { q: 'What are the three amigos?', a: 'A short session where a business representative, a developer and a tester look at a story together before development, each from their own angle — what problem we solve, how we could build it, what could go wrong — and agree on examples that become the acceptance scenarios.' },
  ],
}
