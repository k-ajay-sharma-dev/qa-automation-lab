export default {
  id: 'int-039',
  category: 'interview',
  kind: 'quiz',
  title: '"You are our first automation engineer — what do you do in your first 90 days?"',
  level: 'EXPERT',
  tags: ['strategy', 'leadership', 'planning', 'roi', 'scenario'],
  estMinutes: 15,
  scenario: `A senior-role interview. The engineering manager says: *"We have no automation at all. Six developers, two manual testers, releases every two weeks with a three-day manual regression. You'd be our first automation hire. Walk me through your first 90 days."* This tests whether you can sequence work, show value early, bring the team along — and avoid the classic trap of spending three months building a "perfect framework" nobody uses.`,
  description: `Choose the best decision at each stage of the 90-day plan.`,
  hints: [
    'Value early, framework grows with real tests — not the other way round.',
    'Automation fails without team adoption: who runs it, who looks at failures, who maintains it?',
  ],
  questions: [
    {
      q: 'Weeks 1–2: what should you focus on?',
      options: [
        'Start building a complete framework with every pattern you know',
        'Learn the product and the release pain: sit with the manual testers, time the regression, read the bug history to find what breaks most, and agree success measures with the manager',
        'Buy a commercial tool licence',
        'Automate the login page fully, including every negative case',
      ],
      answer: 1,
      why: 'You cannot pick the right tests or tools without knowing **where the pain and risk are**. Agreeing measurable goals early (e.g. "regression from 3 days to 1") gives you something to report at day 90.',
    },
    {
      q: 'First month: which deliverable shows value fastest?',
      options: [
        'A 50-page automation strategy document',
        'A small smoke suite — login, search, add to cart, checkout, plus a few API health checks — running in CI on every merge, with results posted to the team channel',
        'Automating all 300 manual cases in a spreadsheet',
        'A custom reporting dashboard',
      ],
      answer: 1,
      why: 'A **thin, reliable suite in CI** that catches a broken build within minutes is visible value. Developers start trusting automation when it catches something real. Documents and dashboards without tests change nothing.',
    },
    {
      q: 'How should the framework itself evolve?',
      options: [
        'Design every layer up front so you never have to refactor',
        'Grow it from real tests: start with page objects, an API client and config for the first smoke tests; extract utilities when the second or third test needs them; agree coding conventions and PR reviews early',
        'Let each tester write tests their own way',
        'Copy a framework from GitHub and adapt the tests to fit it',
      ],
      answer: 1,
      why: 'Frameworks designed in a vacuum are over-engineered in the wrong places. Growing it from **real needs** keeps it simple; conventions and reviews from day one keep it consistent as others join.',
    },
    {
      q: 'Months 2–3: how do you scale beyond yourself?',
      options: [
        'Write every test yourself so quality stays high',
        'Pair with the manual testers to automate regression cases they know best, agree with developers that a failing CI test blocks the merge, and add "automated where sensible" to the Definition of Done',
        'Ask the manager to hire five more automation engineers first',
        'Stop manual testing completely',
      ],
      answer: 1,
      why: 'One person cannot keep up with six developers. **Upskilling the manual testers** multiplies capacity and uses their domain knowledge; a merge-blocking rule and DoD entry make automation part of how the team works, not a side project.',
    },
    {
      q: 'Day 90 review with the manager — which report is strongest?',
      options: [
        '"I wrote 400 tests."',
        '"Smoke + API suite: 85 tests, 12 minutes in CI on every merge, 98% pass stability. Manual regression went from 3 days to 1.5. Automation caught 7 regressions before QA. Both testers now write tests. Next quarter: checkout edge cases and parallel runs to hit 1 day."',
        '"The framework is almost ready."',
        '"Automation is going well."',
      ],
      answer: 1,
      why: 'Report **outcomes against the goals agreed in week 1**: time saved, bugs caught earlier, stability, adoption — plus a next step. Test count alone says nothing about value; "almost ready" after 90 days is the trap this question is designed to catch.',
    },
  ],
  explanation: `**Model answer outline (2 minutes)**
1. **Days 1–15 — understand:** shadow the manual regression, read the defect history, find the riskiest flows, agree 2–3 measurable goals with the manager.
2. **Days 15–45 — first value:** pick the stack the team can maintain (e.g. Java + Selenium/RestAssured if developers know Java, or Playwright + TypeScript for a JS team). Build a smoke suite of the top 10–15 flows plus API checks, running in CI on every merge with clear reports.
3. **Days 45–90 — scale and embed:** pair with manual testers, add regression coverage by risk, agree merge-blocking rules and a DoD line, handle test data properly, keep flakiness near zero.
4. **Day 90 — report:** results against the goals and the next-quarter plan.

**What separates an expert answer:** choosing tools by the team's skills (not personal taste), API-heavy coverage instead of all-UI, treating flaky tests as bugs from day one, and measuring outcomes, not test counts.`,
  mistakes: [
    'Spending the first months building a framework with no tests running in CI.',
    'Automating the manual test cases one-to-one instead of by risk and layer.',
    'Choosing a tool nobody else on the team can maintain.',
    'Measuring success by number of tests rather than time saved and bugs caught earlier.',
  ],
  interview: [
    { q: 'How would you choose between Selenium + Java and Playwright + TypeScript here?', a: 'By the team: if developers write Java and might contribute, Java keeps one language in code review; if the front end is a JS/TS shop, Playwright fits naturally and its auto-waiting reduces flakiness. I would build one smoke flow as a spike in the front-runner before committing.' },
    { q: 'What if developers ignore failing tests?', a: 'Make failures impossible to ignore and cheap to act on: fast suites, clear reports with screenshots and logs, zero tolerance for flaky tests so red really means broken, and an agreed rule that a red smoke build blocks the merge.' },
    { q: 'How do you show ROI to management?', a: 'Compare before and after: regression hours per release, defects found before vs after QA hand-off, release frequency and production escapes. Tie each number back to the goals agreed in the first weeks.' },
  ],
}
