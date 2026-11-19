export default {
  id: 'int-021',
  category: 'interview',
  kind: 'quiz',
  title: 'What to automate, the test pyramid, shift-left and the metrics that matter',
  level: 'BEGINNER',
  tags: ['strategy', 'test-pyramid', 'shift-left', 'metrics', 'roi'],
  estMinutes: 15,
  scenario: `A hiring manager reads "6 years manual testing" on your CV and asks the questions that check whether you think like an automation engineer: *"How do you decide what to automate?"*, *"Where does UI automation fit in the test pyramid?"*, *"What does shift-left mean in your team?"*, *"How do you show management that automation is working?"*. Your manual background is an advantage here — you know where the risk is. You just need the vocabulary.`,
  description: `Pick the best answer. Each \`why\` contains a sentence you can reuse — ideally with a ShopEasy-style example from your own project.`,
  hints: [
    'Automate what is stable, repeated, high-risk and has a clear expected result. Keep humans for exploration and judgement.',
    'Pyramid: many fast unit tests, a solid API/service layer, a thin layer of end-to-end UI journeys.',
  ],
  questions: [
    {
      q: 'Your manual regression pack for ShopEasy has 400 test cases. Which ones should you automate **first**?',
      options: [
        'All 400 in the order they appear in the test management tool',
        'Stable, high-risk, frequently executed flows with clear expected results — login, add to cart, checkout totals, order placement — and data-heavy checks that are tedious by hand',
        'The usability and look-and-feel checks, because they take the longest manually',
        'Only the newest features, because older ones never break',
      ],
      answer: 1,
      why: 'Prioritise by **risk × frequency × stability**: a checkout total that runs in every regression cycle pays back fast. Features still changing every sprint, one-off checks and subjective usability reviews have poor ROI. Say: "I ranked the pack by business risk and execution frequency and automated the top 20% that covered the critical journeys first."',
    },
    {
      q: 'Where does UI automation belong in the **test pyramid**?',
      options: [
        'At the base — the largest number of tests should be UI tests because they are closest to the user',
        'At the top — a small number of end-to-end journeys; most logic is covered faster and more reliably by unit and API/service tests below it',
        'UI tests are not part of the pyramid',
        'In the middle, replacing API tests',
      ],
      answer: 1,
      why: 'UI tests are the slowest and most brittle, so you keep **few, valuable journeys** at the top. Business rules (tax, validation, sorting on the server) are cheaper to verify at API or unit level. The anti-pattern is the "ice-cream cone": hundreds of UI tests, few API tests, slow and flaky pipelines.',
    },
    {
      q: 'ShopEasy calculates tax as 8% of the subtotal, rounded to two decimals. The team wants to cover 15 price combinations. Where should most of those checks live?',
      options: [
        '15 UI tests that each add products and read #summary-total',
        'At API level (POST /api/orders returns subtotal, tax and total) or as unit tests on the calculation — plus one UI test proving the overview page shows the total correctly',
        'Only in manual testing, because money is important',
        'In the Cucumber Background',
      ],
      answer: 1,
      why: 'The rule is calculation logic; the UI only displays it. 15 API calls run in under a second; 15 UI checkouts take minutes and fail for unrelated reasons (locators, timing). One UI test still proves the wiring. This is the pyramid applied to a real feature — interviewers love it.',
    },
    {
      q: 'What does **shift-left** mean in practice for a tester?',
      options: [
        'Moving the test team to another floor',
        'Testing earlier: reviewing acceptance criteria and writing examples during refinement, automating API tests as soon as the endpoint exists, running checks on pull requests — so defects are found when they are cheapest to fix',
        'Running the regression suite only after release',
        'Developers do all the testing, so testers are not needed',
      ],
      answer: 1,
      why: 'Shift-left = feedback earlier in the lifecycle. Concrete examples: three-amigos sessions, Gherkin scenarios agreed before coding, API tests written while the UI is still in progress, smoke tests gating every PR. Its partner, *shift-right*, means learning from production: monitoring, logs, feature flags.',
    },
    {
      q: 'Your manager asks: "How do we know automation is paying off?" Which set of metrics is the strongest answer?',
      options: [
        'The number of automated test cases — the bigger the better',
        'Pass rate only',
        'Time to feedback (how fast a deployment gets a verdict), flakiness rate, automated coverage of the critical regression flows, defects caught by automation before release vs escaped to production, and manual regression hours saved',
        'Lines of test code written per sprint',
      ],
      answer: 2,
      why: 'Test counts and lines of code reward quantity, not value. A 100% pass rate can simply mean the tests check nothing. Combine **speed** (feedback time), **trust** (flaky rate), **coverage of risk** (critical flows automated) and **outcome** (bugs caught early, escaped defects, hours saved). Example: "Regression went from 3 days manual to 45 minutes nightly; flaky rate under 2%."',
    },
    {
      q: 'The product owner says: "Let\'s automate 100% of our manual test cases." What is the most professional reply?',
      options: [
        '"Sure, it will take two weeks."',
        '"Automation is useless, we should stay manual."',
        '"Let\'s automate the high-value, repeatable checks — aiming for most of the regression risk — at the right level of the pyramid. Exploratory, usability and rarely-run checks stay manual, because automating them costs more than it saves."',
        '"Only if developers write them."',
      ],
      answer: 2,
      why: 'Mature answers talk about **return on investment** and maintenance cost: every automated test must be maintained forever. Some checks are cheaper by hand; some belong at API level instead of UI. Testers who can say "no, and here is the better plan" are exactly who teams want to hire.',
    },
  ],
  explanation: `**Model answer — "How do you decide what to automate?"**
> "I start from risk. I rank the regression pack by business impact and how often we run it. Stable, repeatable, high-risk flows with clear expected results go first — on ShopEasy that's login, cart, checkout totals and order placement. Then I choose the cheapest reliable level: calculation and validation rules at API or unit level, a thin layer of UI journeys on top. I don't automate exploratory or usability testing, one-off checks or features still changing every sprint."

**Model answer — "Where does UI fit in the pyramid?"**
> "At the top: a small set of end-to-end journeys that prove the system works together. Most checks sit lower, in unit and API tests, because they're faster and more stable. If a team has hundreds of UI tests and few API tests, that's the ice-cream-cone anti-pattern, and their pipeline is usually slow and flaky."

**Metrics worth knowing**
| Metric | What it tells you |
|---|---|
| Time to feedback | how long a change waits for a verdict |
| Flaky rate | % of failures not caused by a product change — trust in the suite |
| Critical-flow coverage | how much of the regression risk is automated |
| Escaped defects | bugs found in production that tests should have caught |
| Hours saved | manual regression effort replaced per release |`,
  mistakes: [
    'Saying "we automate everything" — it signals no sense of cost or maintenance.',
    'Describing a suite that is mostly UI tests as normal — interviewers hear "slow and flaky".',
    'Using the number of test cases as the main success metric.',
    'Defining shift-left as "testing earlier" without a single concrete practice.',
  ],
  interview: [
    { q: 'How do you decide what to automate?', a: 'By risk, frequency and stability. I rank regression scenarios by business impact and how often they run, automate stable high-value flows first — login, cart, checkout, payments — and pick the cheapest reliable level, API or unit where possible, a thin UI layer on top. Exploratory, usability and rapidly changing features stay manual until they stabilise.' },
    { q: 'What is the test pyramid?', a: 'A model for balancing tests: a wide base of fast unit tests, a middle layer of API or service tests, and a small top layer of end-to-end UI tests. The higher you go, the slower, more expensive and more brittle the tests get, so you push each check down to the lowest level that can catch the bug.' },
    { q: 'Which automation metrics do you report?', a: 'Time to feedback for each deployment, pass rate together with flaky rate so a green build means something, coverage of critical regression flows, defects caught by automation before release versus escaped to production, and manual hours saved per release.' },
  ],
}
