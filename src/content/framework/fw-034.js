export default {
  id: 'fw-034',
  category: 'framework',
  kind: 'quiz',
  title: 'Reporting automation results to stakeholders: trends, flaky rate, risk',
  level: 'BEGINNER',
  tags: ['reporting', 'metrics', 'flaky-tests', 'stakeholders', 'communication'],
  estMinutes: 8,
  scenario: `The ShopEasy product owner never opens the 4 MB Extent report. In the release meeting she asks one question:
*"Can we ship on Friday?"* Your manager wants a weekly one-page automation summary that answers it — you have 6
years of manual test reporting experience, now apply it to automation numbers.`,
  description: `Pick the best answer. Think like the reader: product owner, release manager, dev lead.`,
  questions: [
    {
      q: 'Which headline is most useful for the product owner?',
      options: [
        '"412 tests executed, 398 passed, 14 failed"',
        '"Checkout and login: all critical tests pass. 2 failures in wishlist (known bug SE-231, low risk). Recommendation: ship."',
        '"Pass rate 96.6%"',
        '"See attached report"',
      ],
      answer: 1,
      why: 'Stakeholders need risk per business area and a recommendation. Raw counts and a pass rate hide whether the 14 failures are in checkout or in the footer.',
    },
    {
      q: 'Over 4 weeks the pass rate went 97% → 95% → 92% → 90% while no new features shipped. What does the trend most likely show?',
      options: [
        'Nothing, single runs matter more than trends',
        'Growing flakiness or test debt (environment, waits, data) that needs time in the next sprint',
        'The application got better',
        'The tests got faster',
      ],
      answer: 1,
      why: 'A falling pass rate without product change points to the suite or environment decaying. A trend chart makes the case for maintenance time far better than a single red build.',
    },
    {
      q: 'How do you define the **flaky rate** of the suite?',
      options: [
        'Failed tests ÷ all tests',
        'Tests that both passed and failed on the same code (or passed only on retry) ÷ tests run, over a period',
        'Number of tests with Thread.sleep',
        'Skipped tests ÷ all tests',
      ],
      answer: 1,
      why: 'A flaky test gives different results for the same code. Counting "passed on retry" or "mixed results on the same commit" over a week gives a number you can track and set a target for (e.g. under 2%).',
    },
    {
      q: 'A test failed because the QA environment was down for 20 minutes. How should it appear in the summary?',
      options: [
        'As a product defect',
        'Hidden, so the numbers look good',
        'Categorised as environment/infrastructure failure, separate from product defects and test defects',
        'Deleted from the report',
      ],
      answer: 2,
      why: 'Categorising failures (product bug / test bug / environment / known issue) keeps the report honest and tells each team what to act on. Hiding them destroys trust; labelling them as bugs wastes developer time.',
    },
  ],
  hints: [
    'Lead with risk and a recommendation, then numbers.',
    'One run is a data point; a trend is a story.',
  ],
  explanation: `**A one-page automation summary**
1. **Verdict:** ship / ship with known risks / do not ship.
2. **Coverage by business area:** login, search, cart, checkout — green/red with links.
3. **Failures by category:** product defect (ticket), test defect, environment, known issue.
4. **Trends:** pass rate, flaky rate, duration over the last 4–8 weeks.
5. **Actions:** what is being fixed and by whom.

Allure history, Extent dashboards or a CI test-trend graph provide the data; your job is the interpretation. This is
where manual QA experience shines — a report is communication, not a file.`,
  mistakes: [
    'Sending the raw HTML report to non-technical stakeholders.',
    'Reporting a pass rate without saying which areas failed.',
    'Counting environment outages as product bugs, or hiding them.',
    'Ignoring a slow downward trend until the suite is ignored by everyone.',
  ],
  interview: [
    { q: 'Which automation metrics do you report?', a: 'Pass rate per business area, failures by category, flaky rate, suite duration and their trends over time, plus open defects found by automation. Always with a short risk statement and recommendation.' },
    { q: 'How do you keep stakeholders trusting the automation results?', a: 'Keep the suite stable (low flaky rate), categorise every failure honestly, link failures to tickets, and give a clear verdict rather than raw numbers.' },
  ],
}
