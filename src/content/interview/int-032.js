export default {
  id: 'int-032',
  category: 'interview',
  kind: 'quiz',
  title: '"Tell me about a bug you found through automation" — a STAR answer that lands',
  level: 'ADVANCED',
  tags: ['behavioural', 'star', 'soft-skills', 'storytelling', 'defects'],
  estMinutes: 12,
  scenario: `Near the end of the technical round the interviewer asks: *"Tell me about a real bug your automation caught."* Most candidates say "we found many bugs" and move on. This is a **behavioural** question: they want a specific story that proves your tests check meaningful things, that you can tell a real failure from a flaky one, and that your work had impact. The STAR format — **Situation, Task, Action, Result** — keeps the story tight.`,
  description: `Each question takes one part of a STAR answer. The story used throughout: the nightly API suite on a ShopEasy-style shop caught a cart bug for an out-of-stock product (Retro Red Tee, stock 0).`,
  hints: [
    'Situation and Task are short context; most of your time goes on Action — what YOU did.',
    'End with a measurable Result and what changed afterwards (a new test, a new rule).',
  ],
  questions: [
    {
      q: 'Which opening (Situation + Task) is best?',
      options: [
        '"We had a lot of bugs in that project, and automation found many of them."',
        '"Two days before a release, our nightly API regression — about 180 tests in Jenkins — had one new failure in the cart suite. My task was to triage it before the morning stand-up."',
        '"I joined the company in 2019 and the team had eight people. We used Java, Maven, Jenkins, Git, Jira, Confluence…"',
        '"I don\'t remember a specific bug, but automation is very useful."',
      ],
      answer: 1,
      why: 'Good context is **specific and short**: when, what ran, what failed, what you owned. Two sentences. A vague claim gives the interviewer nothing to check; a long tool list wastes your time before the story starts.',
    },
    {
      q: 'Which **Action** section best shows real skill?',
      options: [
        '"I re-ran it and it passed, so I ignored it."',
        '"I raised a bug immediately and assigned it to the developers."',
        '"First I ruled out flakiness: it failed three runs in a row and locally with the same data. The log showed POST /api/cart with the Retro Red Tee returned 201 even though GET /api/products listed its stock as 0. I reproduced it with Postman, checked the recent commits — a refactor had dropped the stock check — and raised a defect with the request, response and the commit link."',
        '"The developers investigated and fixed it."',
      ],
      answer: 2,
      why: 'Strong actions show **your** steps: proving it is not flaky, isolating it at the right layer, reproducing outside the framework, finding the likely cause, and writing a bug report a developer can act on in minutes. Re-running until green is the opposite of what they want to hear; "the developers did it" hides your part.',
    },
    {
      q: 'Which **Result** is strongest?',
      options: [
        '"It was fixed."',
        '"The fix shipped the same day, so the release went out on time. Without the check, customers could have ordered items we could not deliver. Afterwards I added negative tests for stock limits on the cart and checkout APIs, and the team added a stock-check rule to the code-review checklist."',
        '"Management was very happy with me."',
        '"We found out that automation is better than manual testing."',
      ],
      answer: 1,
      why: 'A good result has **impact** (release on time, customer harm avoided), is **concrete**, and ends with **what changed** — new tests, a new process. The improvement afterwards is what separates senior answers from junior ones.',
    },
    {
      q: 'The interviewer follows up: *"How did you know it was a real bug and not a flaky test?"* Best reply?',
      options: [
        '"Because it was red."',
        '"It failed deterministically — every run, locally and in CI, with fresh data. The failure was an assertion on business data (status 201 instead of 400), not a timeout or a missing element. And I could reproduce it by hand outside the framework."',
        '"The developer told me."',
        '"I trusted my framework."',
      ],
      answer: 1,
      why: 'Flaky failures are usually **intermittent** and look like timing or environment problems (timeouts, stale elements, connection resets). Real bugs are **reproducible** and show a wrong business result. Giving these criteria shows you triage failures with evidence.',
    },
    {
      q: 'You have never caught a dramatic bug with automation. What is the best way to handle this question?',
      options: [
        'Invent a dramatic story — nobody checks',
        'Say you have no example',
        'Pick a real, smaller story and tell it well — a regression your smoke test caught after a merge, a wrong total your API test spotted, even a bug found while *writing* the automation — with honest numbers',
        'Talk about a bug a colleague found as if it were yours',
      ],
      answer: 2,
      why: 'Interviewers dig with follow-ups, and invented stories fall apart quickly. A small real story told with clear STAR structure beats a big vague one. Bugs found *while automating* count too — writing tests forces you to read requirements closely.',
    },
  ],
  explanation: `**Full model answer (about 90 seconds)**
> **S:** "Two days before a release, our nightly API regression in Jenkins — about 180 tests — had one new failure in the cart suite.
> **T:** I owned triage of nightly failures, so I had to decide before stand-up whether it blocked the release.
> **A:** First I ruled out flakiness: it failed three times in a row and locally with fresh data, and it was an assertion failure, not a timeout. The log showed that adding the Retro Red Tee to the cart returned 201 although the product API reported stock 0. I reproduced it in Postman, found a recent refactor had removed the stock check, and raised a defect with the request, the response and the commit.
> **R:** The fix went in the same day and the release shipped on time, without customers being able to order stock we didn't have. Afterwards I added negative stock tests on the cart and checkout APIs, and the team added a stock-check item to the review checklist."

**STAR time split:** Situation + Task ≈ 20%, Action ≈ 60%, Result ≈ 20%. Say "I", not "we", for your own actions.

**Prepare three stories** before any interview: a bug automation caught, a flaky suite you stabilised, and a disagreement you resolved. Most behavioural questions can use one of them.`,
  mistakes: [
    'Answering in general terms ("we found many bugs") with no single concrete story.',
    'Spending a minute on the tech stack before the story starts.',
    'Saying "we" for everything, so the interviewer cannot tell what you did.',
    'Ending with "it was fixed" — no impact and no lesson learned.',
  ],
  interview: [
    { q: 'What is the STAR method?', a: 'A structure for behavioural answers: Situation (brief context), Task (what you were responsible for), Action (the specific steps you took — the longest part), Result (measurable outcome and what changed afterwards).' },
    { q: 'What did you change after that bug?', a: 'I added negative tests for stock limits on the cart and checkout APIs so the same class of bug is caught at every build, and suggested a review-checklist item for stock validation. A bug found once should be covered for good.' },
    { q: 'How do you tell a flaky failure from a real one?', a: 'I check whether it reproduces: re-run in isolation, locally and in CI with fresh data. I look at the failure type — a wrong business value in an assertion points to a real bug; timeouts, stale elements and connection errors point to timing or environment. Then I reproduce it manually outside the framework.' },
  ],
}
