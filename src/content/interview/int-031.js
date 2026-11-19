export default {
  id: 'int-031',
  category: 'interview',
  kind: 'quiz',
  title: 'Agile and Scrum for automation testers: Definition of Done and in-sprint automation',
  level: 'INTERMEDIATE',
  tags: ['agile', 'scrum', 'definition-of-done', 'in-sprint-automation', 'process'],
  estMinutes: 12,
  scenario: `The ShopEasy team works in two-week sprints. In your interview the Scrum Master on the panel asks: *"When does automation happen in your sprint? Is a story 'done' if the tests are not automated yet? What do you do at refinement?"* They want to know whether automation is part of the team's flow or a separate group that is always one sprint behind.`,
  description: `Pick the best answer for a tester working inside a Scrum team.`,
  hints: [
    'The goal is in-sprint automation: tests for a story are written while the story is built, not a sprint later.',
    'The Definition of Done is a team-wide checklist that applies to every story.',
  ],
  questions: [
    {
      q: 'What is the **Definition of Done (DoD)**, and how does automation fit in it?',
      options: [
        'A list of acceptance criteria that is different for each story',
        'A shared checklist that every story must meet before it counts as done — for example: code reviewed, unit tests pass, acceptance criteria verified, regression-worthy scenarios automated and green in CI, no open critical defects',
        'A document the tester signs after UAT',
        'The date the sprint ends',
      ],
      answer: 1,
      why: '**Acceptance criteria** are story-specific ("quantity above stock shows an error"). The **DoD** is the same for every story and is owned by the whole team. Putting "automated checks added and passing in CI" in the DoD is what stops automation debt from piling up.',
    },
    {
      q: 'When should the automated tests for the story "Apply coupon at checkout" ideally be written?',
      options: [
        'In the next sprint, once the feature is stable ("N-1 automation")',
        'Only before a major release',
        'In the same sprint: scenarios agreed at refinement, API checks written as soon as the endpoint exists, UI steps finished once the page is ready — so the story closes with its tests green',
        'Never — new features should be tested manually only',
      ],
      answer: 2,
      why: '**In-sprint automation** is the target. N-1 automation is a common compromise for UI-heavy work, but it means the regression suite is always a sprint behind and bugs found later cost more. A practical answer: "API tests in-sprint always; UI tests in-sprint when the page is ready, otherwise they are a tracked task in the next sprint, not forgotten."',
    },
    {
      q: 'What is the tester\'s most valuable contribution at **backlog refinement**?',
      options: [
        'Estimating only the testing hours',
        'Staying quiet until development is finished',
        'Asking "how will we test this?": clarifying acceptance criteria with concrete examples, raising edge cases (out-of-stock product, locked user), and asking for testability — stable ids like data-test attributes, test data, an API to set up state',
        'Writing the code for the feature',
      ],
      answer: 2,
      why: 'Refinement is the cheapest moment to find a bug — in the requirement. Asking for \`data-test\` attributes and a seed-data endpoint *before* coding saves days of locator and setup pain later. This is shift-left in practice.',
    },
    {
      q: 'Should automation effort be included in a story\'s estimate (story points)?',
      options: [
        'No, automation is separate work for the QA team',
        'Yes — writing and stabilising the tests is part of delivering the story, so the team estimates it together with development',
        'Only for stories over 8 points',
        'Only if the Product Owner asks',
      ],
      answer: 1,
      why: 'If automation is not in the estimate, it is the first thing cut when the sprint gets tight — and the suite falls behind. Estimating it with the story makes the cost visible. Framework improvements and flaky-test fixes that are not tied to a story go into the backlog as their own items.',
    },
    {
      q: 'In the retrospective the team complains that the nightly suite fails randomly and nobody trusts it. What is the best action?',
      options: [
        'Turn off the nightly run',
        'Re-run failed tests until they pass and say nothing',
        'Agree a concrete action: tag and quarantine flaky tests, assign an owner, add a "fix top 3 flaky tests" item to the next sprint backlog, and track the flaky rate as a team metric',
        'Blame the developers for slow pages',
      ],
      answer: 2,
      why: 'Retros should end with **specific, owned actions**. Quarantining stops the noise without hiding it; a backlog item gives the fix real capacity; a metric shows whether it worked. "We discussed it" is not an outcome.',
    },
  ],
  explanation: `**Model answer — "When does automation happen in your sprint?"**
> "During the sprint, alongside development. At refinement I clarify acceptance criteria with examples and ask for testability — \`data-test\` ids, test data. When the API is ready I write the API checks; when the UI is ready I finish the UI scenario. Our Definition of Done says automated tests for the story are merged and green in CI, so a story isn't closed without them. If a UI page only lands on the last day, the UI test becomes a tracked task for the next sprint — visible, not forgotten."

| Term | Meaning for a tester |
|---|---|
| Acceptance criteria | story-specific rules you turn into scenarios |
| Definition of Done | team-wide checklist; include "automated + green in CI" |
| Definition of Ready | story is clear and testable enough to start |
| In-sprint automation | tests built in the same sprint as the story |
| N-1 automation | tests built a sprint later — a compromise, not the goal |`,
  mistakes: [
    'Confusing acceptance criteria (per story) with the Definition of Done (for every story).',
    'Describing automation as a separate phase after development finishes.',
    'Leaving automation out of estimates, so it is always the first thing dropped.',
    'Saying "we discussed flaky tests in the retro" with no owner or action.',
  ],
  interview: [
    { q: 'What is the difference between acceptance criteria and the Definition of Done?', a: 'Acceptance criteria describe what one specific story must do and differ per story. The Definition of Done is a team-wide quality checklist applied to every story — reviewed code, tests automated and passing, no open critical bugs.' },
    { q: 'What do you do if development finishes on the last day of the sprint?', a: 'I raise it early at stand-up, write API checks and Gherkin scenarios before the UI is ready, and if the UI test still cannot be finished it becomes a visible backlog item for the next sprint. In the retro we look at why work arrives late — maybe stories are too big.' },
    { q: 'What happens at your daily stand-up as an automation tester?', a: 'I share what I automated and what failed overnight, and I flag blockers early — a missing test environment, an unstable locator that needs a data-test id from a developer, or a story that is not testable yet.' },
  ],
}
