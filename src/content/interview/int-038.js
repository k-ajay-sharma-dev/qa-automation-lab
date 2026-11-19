export default {
  id: 'int-038',
  category: 'interview',
  kind: 'quiz',
  title: '"How long will it take to automate this?" — estimating automation effort',
  level: 'ADVANCED',
  tags: ['estimation', 'planning', 'scenario', 'agile', 'effort'],
  estMinutes: 12,
  scenario: `The hiring manager hands you a printout: *"We have 120 manual regression cases for ShopEasy — login, product search, cart, checkout and the orders API. How long would you need to automate them?"* A number thrown out on the spot ("two weeks!") is the wrong answer. They want to see how you **break the work down**, which factors change the number, and how you communicate uncertainty.`,
  description: `Answer each step of a realistic estimation conversation.`,
  hints: [
    'Not every manual case should be automated; filter first.',
    'Framework setup, test data and flaky-test stabilisation are real work — leave them out and you will be late.',
  ],
  questions: [
    {
      q: 'What is the best first response?',
      options: [
        '"Two weeks."',
        '"Before a number, I\'d like to review the 120 cases: which are stable, high-value and repeatable, which belong at the API layer, and which should stay manual. And — is there a framework already, or do we start from zero?"',
        '"It depends." — and stop there',
        '"One day per test case, so 120 days."',
      ],
      answer: 1,
      why: 'A good estimate starts with **scoping questions**. "It depends" without saying on what is unhelpful; a flat per-case number ignores that cases differ hugely and that some should not be automated at all.',
    },
    {
      q: 'After review: 30 cases are exploratory/visual (stay manual), 40 are API-level checks, 50 are UI flows. Which estimate structure is best?',
      options: [
        'Multiply 120 by an average',
        'Size by complexity buckets (simple / medium / complex) per layer, plus separate lines for framework setup, test data, CI integration, review and stabilisation — then add a buffer',
        'Estimate only the UI tests, since API tests are quick',
        'Ask a developer to estimate it for you',
      ],
      answer: 1,
      why: 'Bucketing by complexity and **layer** is realistic (an API check might take 1–2 hours, a complex checkout UI flow a day). The hidden work — setup, data, CI, stabilisation — is often 30–40% of the total and is exactly what naive estimates miss.',
    },
    {
      q: 'Which factor most often makes automation estimates wrong?',
      options: [
        'The choice of IDE',
        'Unstable test environments and test data (shared accounts, missing seed data, slow or flaky environments)',
        'Typing speed',
        'The number of assertions per test',
      ],
      answer: 1,
      why: 'Writing the test is the predictable part. Getting **reliable data and environments** — creating users, resetting stock, waiting for a broken staging server — is where days disappear. Name it as a risk in your estimate.',
    },
    {
      q: 'How should you present the final number?',
      options: [
        'A single exact date, to sound confident',
        'A range with assumptions and a delivery order: "About 5–7 weeks for one engineer, assuming the framework exists and we get a stable test environment. I\'d deliver the smoke suite in week 1 and the API tests by week 3, so value arrives early."',
        'No number at all',
        'The most optimistic case, to impress the manager',
      ],
      answer: 1,
      why: 'A **range + assumptions + incremental delivery** is honest and manageable: if an assumption breaks, everyone knows why the date moves. Delivering the smoke suite first gives value long before "done".',
    },
    {
      q: 'Halfway through, you are behind because the checkout flow needs a payment stub. What do you do?',
      options: [
        'Work overtime silently and hope to catch up',
        'Raise it early with the impact and options: re-plan, ask for the stub from the dev team, or move checkout UI tests to API level for now',
        'Skip checkout and report the work as complete',
        'Wait until the deadline to mention it',
      ],
      answer: 1,
      why: 'Estimates are forecasts, not promises. **Early visibility with options** lets the team decide. Hiding the slip or quietly dropping scope destroys trust in every future estimate.',
    },
  ],
  explanation: `**Model answer (about 90 seconds)**
> "I wouldn't give a number before reviewing the cases. First I filter: what is stable, repeated and valuable enough to automate, and at which layer — API checks are faster to write and run than UI flows. Then I size in buckets: say 40 API checks at 1–2 hours each, 50 UI flows split into simple, medium and complex. On top I add the work people forget: framework setup if there isn't one, test data creation, CI integration, code review, and stabilising flaky tests — usually 30–40% extra. I'd give a range with assumptions, like 5–7 weeks for one engineer with a stable environment, and deliver incrementally: smoke suite first, then API, then the long UI flows. If an assumption breaks, I raise it the same day."

**Rough sizing anchors (say they are team-dependent):** simple API check 1–2 h · simple UI test 2–4 h · complex end-to-end flow 1 day+ · new framework skeleton with reporting and CI 1–2 weeks.`,
  mistakes: [
    'Giving a number before looking at the cases or asking about the existing framework.',
    'Assuming every manual case must be automated one-to-one.',
    'Leaving out framework setup, data, CI and stabilisation work.',
    'Presenting one exact date with no assumptions, then hiding the slip.',
  ],
  interview: [
    { q: 'How do you decide which manual cases not to automate?', a: 'One-off or rarely run cases, visual/UX judgement, exploratory tests, features that change every sprint, and flows with hard external dependencies (real OTP, CAPTCHA) unless they can be stubbed. I also merge cases that differ only by data into one data-driven test.' },
    { q: 'How do you track progress against the estimate?', a: 'A simple board of the test inventory with status per case and layer, reviewed weekly. Burn-down against the buckets shows early whether the complex flows take longer than planned, so I can re-plan before the deadline.' },
    { q: 'What would make you lower the estimate?', a: 'An existing framework with page objects and API clients, seeded test data, a stable environment, or developers writing API tests alongside. Each removes a whole line item.' },
  ],
}
