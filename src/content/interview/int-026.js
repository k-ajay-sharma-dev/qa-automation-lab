export default {
  id: 'int-026',
  category: 'interview',
  kind: 'quiz',
  title: 'Scenario round: 30 failures before a release, an API with no docs, and other hot seats',
  level: 'ADVANCED',
  tags: ['scenario-questions', 'triage', 'release', 'api-exploration', 'communication', 'estimation'],
  estMinutes: 20,
  scenario: `Senior rounds include "what would you do if…" questions, because they reveal judgement, not memory: *"The release is tomorrow and last night's regression has 30 failures."*, *"Test this API — there's no documentation."*, *"The developer says it works on his machine."*. The interviewer listens for a **calm, ordered process** and for **communication**: who you inform, with what evidence, and when. Six years of manual testing gave you most of these stories already.`,
  description: `Pick the response that a trusted senior automation engineer would give. Then practise answering each one out loud using the STAR shape (Situation, Task, Action, Result).`,
  hints: [
    'Order beats speed: evidence → group → classify → act → communicate.',
    'Never hide risk, never rerun until green, and never block a release without data.',
  ],
  questions: [
    {
      q: 'Release is tomorrow at 10:00. Last night\'s regression shows **30 failures** out of 350. What do you do first?',
      options: [
        'Rerun the whole suite until it is green, then approve the release',
        'Immediately tell the release manager to cancel the release',
        'Open the report and group the failures by error and stack trace — 30 failures are often 3–4 causes (e.g. one changed locator used by 18 tests, an environment outage). Classify each group as product bug / test issue / environment / data, reproduce the product-looking ones manually on the release build, prioritise critical flows (login, checkout, payment), and send the release manager a short status with risk and ETA by mid-morning',
        'Raise 30 defects so nothing is missed',
      ],
      answer: 2,
      why: 'Grouping turns panic into a plan. The output is a **risk statement**, not a colour: "26 failures are one renamed button id in the header (test fix, PR ready); 3 were a QA database outage, green on rerun; 1 is a real defect in discount codes — workaround exists, PO to decide." The release decision belongs to the product owner/release manager; your job is to make it an informed one.',
    },
    {
      q: 'You are asked to test the ShopEasy orders API, but **there is no documentation**. Which approach is most professional?',
      options: [
        'Refuse until a full specification exists',
        'Guess the endpoints by trying random URLs',
        'Ask developers for whatever exists (OpenAPI/Swagger file, Postman collection, code, logs); meanwhile observe real traffic — use the web app with the browser\'s Network tab to capture requests, bodies, headers and status codes; explore with Postman; write down the observed contract, confirm it with the developer/PO, then automate positive, negative and auth cases',
        'Test only through the UI instead',
      ],
      answer: 2,
      why: 'This is exploratory testing applied to an API. The Network tab shows the real contract (e.g. `POST /api/orders` → 201 with subtotal, tax, total). Writing it down and getting it confirmed turns your exploration into documentation — and often exposes surprises like missing validation. Mention pushing for an OpenAPI spec as the long-term fix.',
    },
    {
      q: 'A test fails only on Jenkins. The developer says: "Works on my machine." What do you do?',
      options: [
        'Agree and close the ticket',
        'Argue until the developer gives in',
        'Bring evidence: build number, environment, browser version, failure screenshot/video, logs and the exact data; then look for the difference — headless mode and window size, timezone or locale, a slower agent, different test data or config — and reproduce under CI-like conditions together with the developer',
        'Mark the test @ignore permanently',
      ],
      answer: 2,
      why: '"Works on my machine" is a statement about **environment differences**, so hunt for the difference with facts. Classic culprits: headless Chrome with a small default window hides a button, a timezone changes a date assertion, a slower agent reveals a missing wait. Working with the developer instead of against them is part of the answer.',
    },
    {
      q: 'The sprint ends on Friday. A new "apply discount code" feature is done, but there is no time left to automate its UI tests. What is the best approach?',
      options: [
        'Skip testing it; automation can come later',
        'Delay the whole sprint until UI automation is finished',
        'Test it properly this sprint (exploratory + key manual checks), cover the rules at API level if the endpoint exists, raise a ticket for the UI automation in the next sprint, and propose putting "automated at the right level" into the Definition of Done to prevent automation debt',
        'Ask the developer to write Selenium tests',
      ],
      answer: 2,
      why: 'Quality of the release first, then automation debt made **visible** (a ticket, not a promise) and a process fix (Definition of Done, automating API tests in-sprint while the UI stabilises). This shows you understand in-sprint automation without being dogmatic.',
    },
    {
      q: 'Your manager asks: "How long will it take to automate our 200 manual checkout test cases?" What is the best answer?',
      options: [
        '"Two weeks" — a quick number keeps the manager happy',
        '"I cannot estimate automation."',
        '"Give me two or three days: I\'ll review and de-duplicate the cases, decide which belong at API vs UI level and which shouldn\'t be automated, automate a representative pilot of about ten, and then give an estimate based on real velocity — including framework work and maintenance."',
        '"200 cases × 1 hour = 200 hours, exactly."',
      ],
      answer: 2,
      why: 'Manual test cases rarely map 1:1 to automated tests — many merge into data-driven tests, some move to API level, some aren\'t worth automating. A short analysis plus a **pilot** turns a guess into a forecast. Interviewers like candidates who protect quality without refusing to commit.',
    },
  ],
  explanation: `**The universal shape of a scenario answer**
1. **Stay calm and get facts** — report, logs, evidence, the build under test.
2. **Group and classify** — product bug / test issue / environment / data; or for unknowns, explore and write down what you observe.
3. **Act on the highest risk first** — critical user journeys before cosmetic issues.
4. **Communicate early** with a clear statement of risk, not just pass/fail numbers.
5. **Prevent next time** — a process or framework change (review checklist, DoD, contract docs, CI conditions).

**STAR example — "release tomorrow, 30 failures"**
> *Situation:* "Night before a release, the regression had 30 of 350 tests red."
> *Task:* "Give the release manager a reliable go/no-go input by 10 a.m."
> *Action:* "I grouped the failures by exception: 22 shared one locator from a header redesign, 7 were timeouts during a QA database restart, 1 was in discount-code totals. I fixed the locator in a PR, reran the timeouts after the DB was back, and reproduced the discount bug manually with screenshots."
> *Result:* "By 9:30 we had 349 green and one known defect with a workaround; the PO released with a hotfix planned. Afterwards we added data-testid attributes to the header so redesigns stop breaking locators."`,
  mistakes: [
    'Rerunning failed jobs until they pass and reporting "all green".',
    'Treating every failure as a product defect without grouping or reproducing.',
    'Refusing to test without documentation instead of exploring and documenting.',
    'Giving a confident estimate for a large automation backlog without any analysis.',
  ],
  interview: [
    { q: 'The release is tomorrow and the regression has many failures. What do you do?', a: 'I group failures by error to find the few real causes, classify each as product, test, environment or data issue, reproduce suspected product bugs manually on the release build, fix or rerun what is test- or environment-related, and send the release manager a clear risk summary — which critical flows are verified, which defects are open and their impact — so the go/no-go decision is informed.' },
    { q: 'How do you test an API without documentation?', a: 'I collect whatever exists — OpenAPI file, Postman collections, code, logs — and observe real traffic through the UI with the browser Network tab. I explore the endpoints in Postman, write down the observed contract and confirm it with the developer, then automate positive, negative, boundary and authorization tests. I also push for an OpenAPI spec so the contract is maintained.' },
    { q: 'Tell me about a disagreement with a developer about a bug.', a: 'Use a real STAR story: the situation, the evidence you brought (screenshots, logs, steps, environment), how you found the root difference together — for example a timezone or headless window size — and the outcome, ideally a fix plus a process improvement. Show that you focused on facts, not on winning.' },
  ],
}
