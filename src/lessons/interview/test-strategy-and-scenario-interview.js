export default {
  slug: 'test-strategy-and-scenario-interview',
  category: 'interview',
  order: 8,
  title: 'Strategy, scenario and teamwork questions: pyramid, gates, Git and hot seats',
  minutes: 10,
  summary: 'Explain what to automate and at which level, design suites and CI gates, handle "what would you do if…" questions calmly, and describe your Git workflow like a team member.',
  manualAnalogy: `As a manual tester you have planned regression cycles, chosen which cases to run when time was short, and told a
release manager "these two risks are open". Strategy and scenario questions ask for exactly that judgement - now with
automation layers, pipelines and a shared code repository in the picture.`,
  body: `## What to automate - and at which level

Rank candidates by **risk x frequency x stability**. Stable, often-run, high-impact flows with a clear expected
result go first; exploratory, usability, one-off and still-changing features stay manual for now.

Then pick the **lowest level that runs the code under risk** - the test pyramid:

| Level | Speed | Good for |
|---|---|---|
| Unit | milliseconds | calculations, formatting, validators |
| API / service | well under a second | business rules, contracts, permissions, data setup |
| UI end-to-end | seconds to minutes | a few critical journeys and logic that only exists in the browser |

The anti-pattern is the **ice-cream cone**: hundreds of UI tests, few API tests, a slow and flaky pipeline.

Watch for logic implemented **twice**. On ShopEasy, the cart page's empty-cart handling lives in browser
JavaScript (\`cart.html\` disables \`#checkout\` when nothing is in the cart), while the API has its own rule -
\`POST /api/orders\` with no items returns 422 EMPTY_CART. An API test cannot catch a bug in the page script, so
that rule needs a small UI check *and* API coverage.

**Shift-left** means getting feedback earlier: examples agreed in refinement, API tests while the UI is in
progress, checks on every pull request.

## Suites and CI gates

A gate is only useful if it is **fast enough to wait for and reliable enough to trust**:

1. **Pull request** - unit + API tests, minutes, blocks the merge.
2. **After deploy to QA** - a short smoke of critical journeys, blocks promotion.
3. **Nightly** - full regression, parallel and cross-browser, triaged each morning, blocks the release.
4. **Quarantine** - known-flaky tests in a non-blocking job, each with an owner and a ticket.

**Test data** in shared environments: each test creates and owns its data through the API with unique names. Global
resets (ShopEasy has \`POST /api/reset\`) are only safe in an isolated environment created for one pipeline run.

**Metrics** that show value: time to feedback, flaky rate, coverage of critical journeys, defects caught before
release vs escaped to production, manual hours saved. The number of test cases is not one of them.

## Scenario ("what would you do if…") questions

The interviewer wants a calm, ordered process. One shape fits almost all of them:

1. **Facts first** - report, screenshots, logs, the exact build and environment.
2. **Group and classify** - product bug, test issue, environment, data. Thirty failures are often three causes.
3. **Highest risk first** - critical journeys before cosmetic issues.
4. **Communicate** a risk statement, not just numbers: "checkout verified, one open defect in discount codes with a
   workaround".
5. **Prevent** - a framework or process change so it doesn't happen again.

For an **API without documentation**: collect what exists (OpenAPI file, Postman collection, code), watch real
traffic in the browser's Network tab while using the app, explore, write down the observed contract and confirm it
with the developer before automating. For **"works on my machine"**: hunt for the environment difference
(headless window size, timezone, data, slower agent) with evidence, together with the developer.

Answer story questions with **STAR** (Situation, Task, Action, Result), as described in the *How to answer
automation interview questions* lesson.

## Git like a team member

The daily loop interviewers expect to hear:

\`\`\`text
git checkout main && git pull            # start from the latest code
git checkout -b feature/locked-user-test  # one branch per task
git add -p && git commit -m "Add locked-out user login test"
git push -u origin feature/locked-user-test   # then open a pull request
\`\`\`

- A **merge conflict** appears when two branches changed the same lines - common in shared page objects. Git marks
  both versions between \`<<<<<<<\`, \`=======\` and \`>>>>>>>\`. Choose the correct code (ask the other author if
  unsure), delete every marker, **run the tests**, then \`git add\` and commit.
- **Reviewing** a teammate's test is testing the test: sleeps, waits, locators in page objects, independent data,
  meaningful assertions with messages - and would it fail if the feature broke?
- **Never commit** build output, reports, screenshots or secrets. A password pushed once stays in history: rotate it.`,
  keyPoints: [
    'Automate by risk x frequency x stability, at the lowest level that executes the risky code.',
    'Keep UI tests to a thin layer of journeys plus browser-only logic; avoid the ice-cream cone.',
    'Gates: PR (unit + API) -> post-deploy smoke -> nightly regression; flaky tests quarantined, non-blocking.',
    'Scenario answers: facts -> group/classify -> highest risk -> communicate risk -> prevent.',
    'Git: branch per task, PR with review and CI, resolve conflicts consciously and rerun tests, no secrets in Git.',
  ],
  mistakes: [
    'Answering "automate everything". Fix: talk about ROI, risk and the right level.',
    'Putting slow or flaky suites into merge-blocking gates. Fix: gate on fast, deterministic tests.',
    'Rerunning a red pipeline until green before a release. Fix: group, classify and report the risk.',
    'Resolving a merge conflict without running the tests. Fix: compile and run the affected tests before committing.',
  ],
  tryIt: `Take the ShopEasy checkout (three steps, 8% tax, client-side validation) and, in five minutes, write one line per
level: what you would test with unit, API and UI tests, and which suite (PR, smoke, nightly) each belongs to.`,
  problems: ['int-021', 'int-022', 'int-026', 'int-027'],
}
