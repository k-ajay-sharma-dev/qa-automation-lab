export default {
  slug: 'interview-deep-leadership-and-behavioural-qa',
  category: 'interview',
  order: 13,
  title: `Deep dive: senior SDET behavioural, leadership and strategy interview — with a four-week revision plan`,
  minutes: 45,
  summary: `Fill-in templates and reasoning for 30 behavioural, leadership and strategy questions, the interview process by round, résumé-to-question mapping, a self-scoring rubric, red flags, an interview-day checklist and a four-week plan through all 12 handbook sections.`,
  manualAnalogy: `When you reported to a release manager you did not list every executed case; you said what was verified, what was not, and what that meant for customers. A leadership interview asks for exactly this, with you as the subject: what you did, what you did not, how you know, and what you would recommend.`,
  body: `## How to use this lesson

A senior behavioural round has no correct answers to memorise. It scores judgement, ownership and honesty, and it follows up until a borrowed story breaks. So this lesson gives you **reasoning, structure and fill-in templates**, never a biography. Everything in \`[square brackets]\` is yours to replace. Samples are labelled **sample — replace with your own**; their people, products and numbers are invented. If you have no example for a question, say so and answer "what I would do and why". It costs less than a story you cannot defend.

Basics such as the point–proof–trade-off shape and short STAR answers are in \`answering-automation-interview-questions\`. Here is the senior layer.

### Your fact sheet (write it before you read on)

| Fact | Yours |
|---|---|
| Product, users, team size, release rhythm | \`[ ]\` |
| What *I* built, changed or decided (three items) | \`[ ]\` |
| Tests: how many, at which levels, duration before and after | \`[ ]\` |
| A failure of mine and what changed afterwards | \`[ ]\` |
| A disagreement and how it ended | \`[ ]\` |
| Someone I helped to grow | \`[ ]\` |
| A number I can prove, and how it was measured | \`[ ]\` |

If a number is an estimate, say "roughly" and how you got it. If it belongs to the team, say "we", then say what your part was.

## The interview process, round by round

Companies differ; ask the recruiter. A common sequence:

| Round | Who | Scored | Prepare |
|---|---|---|---|
| Recruiter call (15–30 min) | HR | fit, salary range, notice, communication | 60-second introduction, dates, honest availability |
| Technical screen (45–60 min) | engineer | language, tool internals | deep dives of your stack |
| Coding or take-home | engineer | working code, tests, clarity | \`live-coding-rounds\`, \`java-deep-coding-interview-problems\` |
| Framework design | senior / architect | boundaries, trade-offs | \`interview-deep-senior-technical-qa\` section A |
| Manager round | QA or engineering manager | planning, people, incidents | sections B–D below |
| Cross-functional / director | product, development | influence, risk language | go/no-go, reporting, disagreement |
| HR / offer | HR | motivation, conditions | section E |

## From résumé line to question

Interviewers read a line and ask for the part that is missing. Do it to your own résumé first.

| If the résumé says… | Expect… | Have ready |
|---|---|---|
| "Reduced regression from 10 h to 2 h" | how measured, what else changed, what was cut? | before/after data, your part |
| "Built framework from scratch" | which alternatives, what would you change? | three decisions, one regret |
| "Led a team of 4" | hired, assigned, reviewed, gave feedback? | real responsibilities, not the title |
| "Expert in Java / Playwright / …" | internals, and a hard bug | remove "expert" unless you want that round |
| "Jenkins, Docker, AWS, Kafka" | what exactly did you configure? | sort into *used daily / used / read about* |
| "95 % automation coverage" | 95 % of what? | the denominator |
| gap or short job | why? | one calm, true sentence |

## The STAR template, senior version

Add two letters: **S**ituation, **T**ask, **O**ptions considered, **A**ction, **R**esult, **L**earning. *Options* shows judgement and *Learning* shows growth; juniors skip both.

\`\`\`text
S  In [product/team], [what was happening], it mattered because [business effect].
T  I was responsible for [my part], under [constraint].
O  I saw [option 1] and [option 2]; I chose [x] because [reason], accepting [cost].
A  I [verb], I [verb], I involved [who] when [moment].
R  [measured or observed outcome], known from [source]. Not solved: [honest remainder].
L  Since then I [changed habit / guard].
\`\`\`

**Sample — replace with your own (invented):**

> **S** In an online-shop team of eight, the nightly suite was red on most mornings, and releases waited for manual confirmation. **T** I owned the suite and had two sprints without extra people. **O** I could rewrite the worst tests, add retries, or first measure. Retries were cheapest but would have hidden real defects, so I measured for a week. **A** I grouped failures by message, saw that shared customers caused most of them, gave each test its own customer through the API, moved nine tests to quarantine with owners, and showed the product owner the list every Friday. **R** In the following month most red mornings had a product cause; the figure came from the failure labels in our dashboard. Two third-party tests stayed unstable. **L** I now refuse shared accounts in review, and I measure before I fix.

Length: two minutes. Say *we* for the team and *I* for your actions. If you are interrupted, that is good: they found the part that interests them.

## A. Opening questions

### Q: Please introduce yourself.

**Short answer (30–60 s):** Present, past, proof, why here. About 90 seconds, no life story.

**Detailed answer:** template:

\`\`\`text
Present  I am a [role] with [n] years in testing, [m] of them mainly in automation. At [company/domain]
         I am responsible for [scope] with [stack].
Past     I started in [manual / development / support]; the turning point was [event].
Proof    Two things I am happy with: [result 1, with your part] and [result 2].
Here     I am looking for [kind of problem]. Your [product / role text] mentions [x], which is why I applied.
\`\`\`

Say the manual and automation years separately and truthfully; the difference shows in ten minutes of questions anyway. End on a hook you *want* to be asked about. **Follow-up:** "Which of the two results are you prouder of, and why?" **What the interviewer is checking:** can you summarise, and does it match the résumé?

### Q: Explain your framework in two minutes, then in five.

**Short answer (30–60 s):** Two minutes = problem, stack, flow of one test, CI, one decision. Five minutes adds alternatives, data, parallelism, failure handling, numbers and the weakest point.

**Detailed answer:**

| Minute | Two-minute version | Five-minute version |
|---|---|---|
| 0:00 | product, risk, team | same |
| 0:20 | stack in one sentence, *why* this stack | plus what we rejected |
| 0:40 | follow **one test** from the runner to the report | plus the layer diagram, drawn |
| 1:15 | data and isolation | plus parallelism, identity, clean-up |
| 1:35 | CI gates and duration | plus retry and quarantine policy, evidence on failure |
| 1:50 | one decision I made | plus weakest point, next improvement, how we know it is worth its cost |

Template for the decision: *"In my project, [module], we had [problem]. We compared [a] and [b]. I proposed [a] because [reason]; the price is [cost]. Today I would change [x]."* Rehearse on the two reference frameworks (\`framework-deep-enterprise-java-selenium\`, \`pw-deep-enterprise-playwright-typescript\`), but present **your** framework: an interviewer recognises a tutorial quickly. If your project is a practice project, call it that.

**What the interviewer is checking:** structure under time pressure and who made the decisions.

### Q: You moved from manual testing to automation. How much of the framework is really yours?

**Short answer (30–60 s):** State the split openly: what I wrote, what I extended, what I only used. Then show depth in the part that is mine.

**Detailed answer:** *"For [n] years I tested manually in [domain]. Since [date] I have automated: I wrote [components], I extended [components] that [colleague/team] designed, and I use [tools] without having set them up. The part I can defend line by line is [x]."* Then turn the past into value honestly: risk knowledge, exploratory skill, reading requirements, talking to business. What not to do: convert manual years into automation years, or present a course project as production. **Follow-up:** "Open an editor and show me something small in that part." Prepare exactly that.

### Q: What are your strengths and the thing you are worst at?

**Short answer (30–60 s):** One strength with evidence that fits this role; one real weakness that does not disqualify you, with what you do about it and how far you are.

**Detailed answer:** avoid disguised strengths ("perfectionist") and core gaps ("I avoid coding"). Useful shape: *"[Weakness] showed when [event]. I now [habit]; it works in [case], and I still slip when [case]."* Ask a colleague before the interview; their answer is usually better than yours.

## B. Strategy, numbers and releases

### Q: You join a new product. What is in your test strategy, and how long is the document?

**Short answer (30–60 s):** Two pages that people use: risks, levels, environments and data, gates, responsibilities, what we will *not* test, and how we will notice that the strategy is wrong.

**Detailed answer:** order of work: understand business goal and money flow → list failure modes with product and development (what would be in the newspaper, what would cost a day of revenue) → place each risk at the cheapest level that can see it → decide environments, data, tools → agree gates and ownership → review after four weeks.

| Section | One good sentence (illustrative, ShopEasy) |
|---|---|
| Risk | "A wrong total or a double order is the worst outcome; a wrong sort order is an annoyance" |
| Level | "Tax and rounding: unit and API; the browser checks one basket" |
| Data | "Each test registers its own customer" |
| Gates | "Pull request ≤ 12 min, post-deploy smoke ≤ 4 min" |
| Not covered | "Safari on iPad below version [x], accepted by [role], date" |
| Review trigger | "Any production defect of severity 1 or 2" |

Documents nobody signed are opinions: get explicit acceptance of the "not covered" list. **What the interviewer is checking:** priorities first, tools last.

### Q: What would you refuse to automate?

**Short answer (30–60 s):** What changes weekly, what a person judges better (look, wording, trust), what runs once, what we cannot observe reliably, and what a lower level already proves. I would also remove automation that no longer earns its maintenance.

**Detailed answer:** score each candidate from 1 to 5 on *business impact, frequency, stability, determinism of the expected result, cost to automate (reversed)*; automate high totals, discuss the middle, decline the rest in writing. Typical refusals: CAPTCHA and one-time passwords through the real channel (use a test hook or sandbox), third-party pages we do not own, first versions of a UI, pixel-perfect layout on 20 devices, a one-off migration (script the *reconciliation* instead). **Follow-up:** "And the manager insists on automating it?" Offer a small timebox, show the maintenance figure after two sprints, let the number decide.

### Q: How do you prove the return on investment?

**Short answer (30–60 s):** I compare the hours and risk that automation really replaced with its full cost including maintenance, over a stated period. I count only manual runs that would truly have happened, and I put faster feedback beside the number instead of inventing a price for it.

**Detailed answer:**

\`\`\`text
monthly net hours = runs avoided × (manual hours − triage hours per run) − maintenance − infrastructure (in hours)
break-even months = build hours ÷ monthly net hours
ROI over a period = (total benefit − total cost) ÷ total cost
\`\`\`

Invented example: build 120 h, manual regression 40 h, triage 3 h, maintenance 20 h per month. With **2** real manual runs a month: 2 × 37 − 20 = 54 h, break-even after 2.2 months. Counting all **20** nightly runs as "avoided" gives 720 h, which is nonsense: nobody would have run them by hand. Extra runs are a *quality* benefit (defects found hours after the commit), shown separately: median time from commit to detection, before and after. Also name costs people forget: reviews, environment, learning, and false alarms.

### Q: Which quality metrics would you show, and which do you distrust?

**Short answer (30–60 s):** I show a few that lead to decisions: escaped defects by severity and cause, time to trustworthy feedback, flake rate, age of quarantine, coverage of named risks. I distrust counts of tests, defects per tester and pass percentage without context.

**Detailed answer:**

| Metric | Formula | How it misleads |
|---|---|---|
| Defect escape rate | production defects ÷ (production + earlier defects), same severity and period | logging trivial defects before release improves it; small numbers jump |
| Flake rate | executions that failed and then passed on the same commit ÷ executions | no repeats means zero flakes |
| Pass rate | passed ÷ executed | skips vanish; 99 % can hide the payment test |
| Automation coverage | automated ÷ *automatable* cases | denominator is a choice; ignores value |
| Code coverage | executed ÷ all lines or branches | executed is not verified |
| Detection lead time | detection time − commit time (median, p90) | needs honest timestamps |
| Mean time to repair a red build | Σ red duration ÷ number of red periods | ignoring red makes it invisible |
| Change fail rate | deployments needing immediate intervention ÷ deployments | definition of "intervention" |

DORA's current set has five delivery metrics: change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate; its guide also warns against turning metrics into goals. Mention Goodhart's law: when a measure becomes a target, people optimise the measure. My rule: every metric has a *decision* attached ("if quarantine age exceeds 14 days, we stop new tests for a day") and a counter-metric.

### Q: How do you estimate a piece of automation work you have never done?

**Short answer (30–60 s):** I split off the unknown as a short spike, estimate the rest from a measured sample, give a range with assumptions, and re-estimate after the first slice.

**Detailed answer:** group cases by type, build one or two of each, measure *including* data, review and stabilisation, then multiply. Three-point estimate per group: expected = (optimistic + 4 × likely + pessimistic) ÷ 6; spread ≈ (pessimistic − optimistic) ÷ 6. Invented: 4, 6, 14 hours → 7 h, spread 1.7 h. Independent groups: add expectations, and add the *squares* of the spreads; but shared risks (no environment, no test ids) are not independent, so list them as assumptions instead of hiding them in a buffer. Say the range with its condition: *"[a]–[b] days if [assumption]; I will know more on [date]."* Maintenance is a running cost, not part of the build.

**What the interviewer is checking:** whether you negotiate scope, not whether you guess well.

### Q: The release is in two days and you have four days of testing. What do you do?

**Short answer (30–60 s):** I do not test faster, I decide what not to test, with the owner of the risk. Change analysis, critical journeys, areas of recent defects; then I state the remaining risk in business words and offer options.

**Detailed answer:** within the first hour: list changes since the last release; mark each *changed / depends on changed / untouched*; match with the risk list. Run the automated smoke and the API rules first because they are cheap. Put people on exploratory sessions in changed areas with a charter. Options to bring: reduce scope (flag off), release in stages, extend by one day, accept named risks. Bad moves: silently skipping, weekends as a plan, running everything superficially. Afterwards: ask why four days were needed; it is usually late builds or data, not typing speed.

### Q: Release manager: "Go or no-go?" Two severity-2 defects are open. What do you say?

**Short answer (30–60 s):** I give a recommendation with evidence and conditions; the decision belongs to the business owner. "Go, with the flag for gift cards off, because …" is more useful than "QA does not sign".

**Detailed answer:**

\`\`\`text
Recommendation   go / go with conditions / no-go
Tested           [areas], on [build], [environment]; not tested: [areas], because [reason]
Open defects     [id]: who is affected, how often, workaround, reversible?
Worst case       [what happens to customers or money], detection [how fast], rollback [how, how long, rehearsed?]
Conditions       flag off, monitoring on [x], owner on call until [time]
Decided by       [name], [time]
\`\`\`

| Situation | My recommendation |
|---|---|
| wrong amounts, data loss, security, no rollback | no-go, escalate immediately |
| limited group, workaround, flag available, rollback tested | go with conditions |
| cosmetic, known, documented | go |
| not enough evidence because tests could not run | say exactly that; "not tested" is not "passed" |

If overruled: record the risk calmly, help to make it safe (monitoring, rollback rehearsal) and do not say "I told you so" later.

### Q: What do shift-left and shift-right mean in your daily work?

**Short answer (30–60 s):** Left: prevent and detect earlier, through examples in refinement, testability requirements, API tests with the story. Right: learn from production, through monitoring, canaries, synthetic checks, support tickets. Both feed the same risk list.

**Detailed answer:** concrete left activities: ask "how will we know it works?" before coding; agree contract and test ids; review the developer's unit test list; run the scenario ideas in pairing. Concrete right: read-only smoke after deployment, alerts on business metrics (orders per minute, payment declines), log queries for "impossible" states, A/B guardrails. Not shift-left: giving testers unit tests to write so that developers can stop, or a gate that merely moves the waiting. Not shift-right: letting customers find defects without monitoring or a fast way back. In regulated or irreversible flows (money, health), shift-right needs extra limits.

### Q: How do you report to a director compared with the team?

**Short answer (30–60 s):** Same facts, other decision. The team needs the failing test and its trace; the director needs the risk, the trend and what you want from them, in three sentences.

**Detailed answer:**

| Audience | Question they have | Give |
|---|---|---|
| team, daily | what is broken and who takes it? | grouped failures, owner, evidence |
| product owner, sprint | can we ship this feature? | covered risks, open defects in customer words |
| director, monthly | are we getting safer or slower? | trend of escapes, lead time, one request |

Illustrative director message: *"Checkout is covered and stable. Returns are not covered because we have no refund sandbox; a defect there would reach customers. I ask for two days from the payments team by [date]."* Bad news: early, with a plan, without surprise in the meeting.

## C. When things go wrong

### Q: A serious defect escaped to production and your tests were green. Walk me through it.

**Short answer (30–60 s):** First limit the damage: help to reproduce, define who is affected, verify the fix or rollback. Then a blameless analysis of two chains: why the defect was made, and why we did not see it. The result is one or two changes that also catch its relatives.

**Detailed answer:** the escape table I fill in:

| Question | Sample — replace with your own (invented) |
|---|---|
| Where was it introduced? | rounding moved from order to line level |
| Where could it be seen *cheapest*? | unit test with three lines of 0.335 |
| Why did that level miss it? | examples had one line only |
| Why did later levels miss it? | UI test used one product; API test recomputed with the same code |
| Why did we hear it from a customer? | no alert on invoice ≠ order total |
| Class of defect | equal rule implemented twice; single-element examples |
| Actions (owner, date) | literal expected values from finance; invoice reconciliation alert |

Five whys are useful until they end in a person; "someone was careless" means the analysis stopped early. Do not answer an escape with "one more UI test" by reflex. Check after a month that the actions exist. If the missing test was yours, say so in the first sentence. Technical investigation of such a case: \`interview-deep-scenarios-orders-and-end-to-end\`.

**What the interviewer is checking:** ownership without drama, and system thinking.

### Q: Tell me about a failure of yours.

**Short answer (30–60 s):** Choose a real decision with a real cost, say what you misjudged, what you repaired, and what is different now. No blame, no hidden success.

**Detailed answer:** good candidates: a tool you pushed that nobody adopted; a suite you scaled before fixing isolation; a risk you did not escalate; a colleague you reviewed too harshly. Template: *"I decided [x] because I believed [y]. I ignored [signal]. The effect was [cost]. I told [who] on [when], did [repair]. Now I [guard]."* Ready-made safe failures ("I worked too hard") score low. Confidentiality: describe the mechanism, not the customer.

### Q: The team re-runs the red pipeline until it is green. How do you change that habit?

**Short answer (30–60 s):** People re-run because red is usually false. So I make red believable first, then change the rule. Arithmetic, a visible owner for each flaky test and one protected hour per day do more than an appeal.

**Detailed answer:** the arithmetic: with 500 tests that each fail randomly once in a thousand executions, a run is green with probability 0.999^500 ≈ 61 %; at five in a thousand it is 8 %. Nobody is careless; the system trains them. Steps: (1) collect outcomes per commit; (2) quarantine the worst in a non-blocking job, each with owner and expiry date, capacity limited (for example ten; the eleventh must be fixed or deleted first); (3) re-run button only with a chosen reason, counted; (4) daily 20-minute triage by rotation, developers included; (5) publish the trend; (6) celebrate deletions. Technique for each cause: \`selenium-deep-troubleshooting-flaky-tests\`. The hard part is (2): agree with the product owner that quarantined means *not tested*.

### Q: You are blocked: environment down, requirement unclear, developer busy. What do you do?

**Short answer (30–60 s):** Make it visible within the hour with the cost, offer a partial path, keep working on what does not depend on it, and escalate at a time I announced beforehand.

**Detailed answer:** message pattern: *"Blocked on [x] since [time]. Effect: [what is at risk, when]. I need [action] from [person]. Until then I do [y]. If open at [time], I raise it in [meeting]."* Partial paths: API instead of UI, stub instead of service, reading the pull request and preparing data. A senior also removes the *repetition*: three environment blocks in a month justify a health check, an owner or a disposable environment. Waiting politely for two days is the weak answer; shouting in a large channel is the other one.

## D. People, teams and change

### Q: A developer lowers the severity of your defect and the sprint ends tomorrow. How do you handle it?

**Short answer (30–60 s):** I separate facts from labels. Severity is about impact, which we can show; priority is a business decision. I talk in person, bring evidence, ask what I am missing, and take it to the product owner only together.

**Detailed answer:** sequence: reproduce on a clean build; quantify (who, how often, money, workaround); ask *"what would make this a severity 2 for you?"*; agree on facts in the ticket even if the label differs; let the product owner set priority. If new information shows that I am wrong, I say so publicly: it buys credit for the next time. Never through comment battles in the ticket or in front of the whole stand-up. After the third case of the same kind, propose a severity table with examples, so the next discussion has a reference. Template: *"In my project, [module], we disagreed about [x]. I [action]. It ended with [outcome], and in hindsight [view]."*

### Q: Your manager wants 100 % automation by the end of the quarter. You think it is wrong. What now?

**Short answer (30–60 s):** I ask what problem the number should solve, then offer a target that solves it and can be measured. I disagree once, clearly, with data and an alternative; after the decision I support it or state what I cannot deliver.

**Detailed answer:** behind the target there is often: releases too slow, too many escapes, cost pressure, or a promise to a customer. Offer per goal: "regression feedback below 30 minutes", "all 25 critical risks covered at some level", "manual regression below one day". Show the price of 100 %: the last 20 % is usually visual, rare or unstable. Bring two options with consequences and a recommendation, in writing, short. If the target stays: define the denominator, protect quality (no test without a failure check), and report honestly. **What the interviewer is checking:** whether you can influence upwards without either obeying blindly or fighting.

### Q: How have you developed a junior or a manual tester?

**Short answer (30–60 s):** With a plan based on their goal, small real tasks that are reviewed the same day, and growing responsibility. I measure by what they can do without me.

**Detailed answer:** example path (adapt it): weeks 1–2 pair on reading failing tests; 3–4 fix locators and data in existing tests; month 2 write API tests, then one UI journey; month 3 own a module and its triage; later review others. Habits: explain *why*; let them type; ask "what would make this test fail?"; praise specifically in public, correct in private. Danger signs in myself: fixing it for them, giving only boring work, comparing people. **If you have never been a formal mentor**, say so and use smaller evidence: onboarding a colleague, a short internal session, review comments that changed a habit: *"I helped [role] with [skill]; afterwards they [observable result]."*

### Q: How do you build a healthy code-review culture for test code?

**Short answer (30–60 s):** Machines check style, people check risk. Reviews are small, quick, kind and about the test's ability to fail. Seniors are reviewed too.

**Detailed answer:** agreements I propose: pull requests under about 300 changed lines; first response within half a working day; formatter, linter and compile in CI so that nobody argues about spaces; a checklist of five questions (What rule does it protect? Was it seen red? Is the data its own? Does it wait on state? Will the failure message help a stranger?); comments labelled *must / should / idea*; questions instead of verdicts ("What happens when the cart is not empty?"). When one reviewer becomes a bottleneck, pair-review for two weeks and rotate. Track waiting time, not number of comments. Developers reviewing tests and testers reviewing unit-test lists spread knowledge in both directions.

### Q: You want the team to adopt a new tool. How do you convince them?

**Short answer (30–60 s):** I start from a pain they already have, run a small timeboxed trial on *our* hardest case with a sceptic in the pair, define success before starting, and publish the result even when it is negative.

**Detailed answer:**

| Step | Content |
|---|---|
| Problem | measured: duration, failures, hours; not "it is modern" |
| Criteria | fixed in advance, weighted: fit with skills, CI, browsers, licence, community, exit cost |
| Options | at least three, including *keep and improve* |
| Trial | two weeks, three realistic cases, including an ugly one |
| Decision record | one page: context, decision, consequences, review date |
| Adoption | templates, pairing, migration by module, end date for the old tool |

People resist loss of mastery more than the tool, so plan learning time and ask the strongest critic to write the risk section. If the trial fails, say it first. A worked comparison of two stacks is in \`pw-deep-enterprise-playwright-typescript\`, section 14.

### Q: You inherit a slow, unreliable framework that nobody likes. What are your first 90 days?

**Short answer (30–60 s):** 30 days to understand and to stop the bleeding, 60 to make the critical part trustworthy, 90 to change the structure with the team. No rewrite before I can explain why the old one failed, because the same causes would break the new one.

**Detailed answer:**

| Days | Goal | Do | Evidence |
|---|---|---|---|
| 1–30 | facts and trust | talk to users of the suite; measure duration, flake rate, what it found in six months; run it from a clean machine; quarantine the worst; fix secrets and broken reports; change nothing big | baseline page, top five causes |
| 31–60 | one trustworthy slice | pick the critical journeys; isolate data; API setup; evidence on failure; gate them on pull requests; delete tests without value | smoke below [n] min, green means green |
| 61–90 | structure and ownership | target architecture on one page; migrate by capability; review rules; pairing; maintenance budget agreed with product | roadmap, trend, names of owners |

Decision on day 60, with numbers: *improve, replace by capability, or retire*. Respect predecessors: constraints you do not see yet shaped the code. Quick visible win in week two (a readable failure report) buys patience. The *first automation engineer* variant, with no legacy, is problem int-039.

**Follow-up:** "The manager wants the rewrite now." Offer the 30-day measurement as the first stage of either path, with a decision date.

### Q: Half of the team is offshore. How do you make the hand-off work?

**Short answer (30–60 s):** Design for little hand-off: whole features per location, shared ownership of the suite, and written state instead of meetings. What must be handed over follows a fixed short template.

**Detailed answer:** template: *done / in progress with link and next step / blocked with owner / risks / question and by when I need the answer*. One or two overlapping hours are kept for decisions, not status; the inconvenient hour rotates. Definition of done and severity table in writing; recorded demos; decisions in the ticket, not in a chat thread. Danger signs: one location writes and the other executes; "they did not test it"; questions waiting a full day because one fact is missing. Measure the number of returns caused by missing information. Treat colleagues as engineers: the person closest to the code of a module decides about its tests, wherever they sit.

### Q: What does a senior SDET contribute in each Agile ceremony?

**Short answer (30–60 s):** Questions and risk early, facts in the middle, evidence at the end. I am not the person who says "testing is not finished" on the last day, because that was visible on day three.

**Detailed answer:**

| Ceremony | Contribution | Anti-pattern |
|---|---|---|
| refinement | examples, negative paths, testability, dependencies (test ids, sandbox, flag) | silent until the build arrives |
| planning | test and automation effort in the same estimate; order that avoids a last-day pile | separate "QA capacity" afterwards |
| daily | risk and blockers, swarm on review or testing | list of executed cases |
| review | show risk coverage and what is *not* done | demo of a green report |
| retrospective | one measured problem, one experiment | complaining about flaky tests every time |

If development and testing always collide in the last days, propose a limit on work in progress and smaller stories before asking for more testers. Definition of Done and in-sprint automation basics: problem int-031.

### Q: Two managers want your full time this sprint. How do you decide?

**Short answer (30–60 s):** I do not decide between them silently. I put both requests side by side with effort, risk of waiting and what will not happen, recommend an order, and ask the two to agree or name who decides.

**Detailed answer:** saying yes to both is a hidden no to one. Message: *"Both fit in [n] days; I have [m]. If A first, B's release has [risk]. I recommend [order] because [reason]. Please confirm by [time]; until then I continue with [x]."* Offer reductions: a smaller slice, a colleague with guidance, a later date. Long term, make the queue visible on one board. **What the interviewer is checking:** whether you negotiate trade-offs openly instead of working late in silence.

## E. Motivation, conditions, closing

### Q: Why do you want to leave your current job?

**Short answer (30–60 s):** One honest, forward-looking sentence, without complaints or confidential details: what I want more of, and why this role offers it.

**Detailed answer:** acceptable reasons: scope, learning, kind of product, location, stability, end of contract, restructuring. Template: *"I learned [x] at [company]. The next step I want is [y], which is limited there because [neutral fact]."* If you were dismissed or had a conflict: short, factual, what you took from it. Do not invent; references and dates are often checked. Never criticise a manager by name: the listener imagines being the next one.

### Q: What are your salary expectations and notice period?

**Short answer (30–60 s):** A range based on market information for the role and place, stated calmly, and open for the whole package; the notice period exactly as in the contract.

**Detailed answer:** before the call, decide three numbers for yourself: target, acceptable, no. Look at several sources for role, level, city and company type. You may ask first: *"Which range is planned for this position?"* Whether an employer may ask for your current pay depends on the local law; if you share it, share it truthfully, because documents may be requested. Distinguish fixed, variable, benefits and one-off payments. Notice: contractual period, earliest realistic date, whether a shorter exit is negotiable on *their* side; do not promise what your contract forbids. Other offers: mention only real ones. A pause after stating your range is fine. This is general preparation, not legal or financial advice.

### Q: You have not used a tool from our job description. How do you respond?

**Short answer (30–60 s):** "No, not in a project" first, then the nearest experience, the concept behind it, what I tried, and how I would become productive.

**Detailed answer:** *"I have not used [Kafka] at work. I have tested asynchronous flows with [x]; I understand [concepts]; last week I ran [small thing] to see [y]. In the first weeks I would need [z]."* Sort your skills beforehand: daily, occasional, tried, read. A wrong claim costs the credibility of all the true ones. If the tool is the core of the role, ask whether learning on the job is realistic; it saves both sides time.

### Q: What would you like to ask us?

**Short answer (30–60 s):** Three or four questions whose answers could change your decision, different for each person.

**Detailed answer:**

| To | Question | What a good answer contains |
|---|---|---|
| future manager | What should be different six months after I start? | concrete problem, support |
| engineer | Tell me about the last production incident. What changed? | blameless, specific action |
| engineer | How long from commit to production, and what stops a release? | numbers, honest pain |
| product | Who decides go or no-go, and when was it last "no"? | clear role |
| team | Who fixes a red pipeline at 4 p.m.? | "whoever sees it", developers too |
| HR | How are level and growth decided? | criteria, not only years |

Do not ask what the website answers. Listen for contradictions between rounds.

## Scoring yourself: mock-interview rubric

Record a 45-minute mock with a colleague, score each line 0–3, repeat weekly.

| Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Answer first | never arrives | after two minutes | within 30 s | first sentence, then structure |
| Evidence | none | generic "we" | own example | example + number + source |
| Options and trade-offs | one way | mentions another | compares | recommends and names the cost |
| Technical depth | terms | how | why | failure modes, limits |
| Honesty | bluffing | vague | admits gaps | gap + reasoning + next step |
| Collaboration | blames | neutral | credits others | shows changed relationship or process |
| Reaction to follow-up | defensive | confused | adapts | improves own answer |
| Time | overruns | often | mostly | 60–120 s, checks interest |

18 or more of 24 with no line below 2: ready. Work on the **lowest line** first; polishing a 3 changes nothing. In coding rounds add: clarified, tested edge cases, stated complexity.

### Red flags

| In your answers | In the company |
|---|---|
| "we" in every sentence | "QA signs off and is responsible for bugs" |
| the number changes between rounds | nobody can describe the last incident |
| every conflict was the other's fault | automation target in number of scripts |
| one tool is best for everything | interviewers contradict each other about the role |
| no failure, no open question | pressure to sign today, vague offer |
| details of a former customer's secrets | "we are like a family" as the answer to overtime |

One flag is a question to ask, not a verdict.

## Four-week revision plan: all 12 sections

About 90 minutes on weekdays, three hours at one weekend day. Method per lesson: read key points → answer its interview questions **aloud** → open the text only for what you missed → try one exercise. Short on time: do the **bold** slugs.

| Day | Section | Lessons |
|---|---|---|
| **Week 1** Mon | 1 Playwright + TS | **\`pw-deep-architecture\`**, **\`pw-deep-locators-actionability-timeouts\`** |
| Tue | 1 | **\`pw-deep-async-await-and-promises\`**, \`pw-deep-typescript-for-automation\` |
| Wed | 1 | **\`pw-deep-fixtures-pom-components\`**, \`pw-deep-test-organisation-data-driven\` |
| Thu | 1 | \`pw-deep-network-cookies-sessions\`, \`pw-deep-browser-interactions\` |
| Fri | 1 | \`pw-deep-config-environments-ci\`, \`pw-deep-reporting-debugging\`, \`pw-deep-api-testing\` |
| Sat | 2 Core Java | **\`java-deep-oop-and-solid\`**, **\`java-deep-collections-hashmap-internals\`**, \`java-deep-strings-memory-gc\`; mock 1 (introduction + framework in 2 min) |
| **Week 2** Mon | 2 | **\`java-deep-functional-streams\`**, \`java-deep-exception-design\`, \`java-deep-modern-java-9-to-21\` |
| Tue | 2 | **\`java-deep-multithreading-synchronization\`**, \`java-deep-executors-completablefuture\` |
| Wed | 2 | **\`java-deep-coding-interview-problems\`** (solve four, timed) |
| Thu | 3 Selenium | **\`selenium-deep-architecture\`**, **\`selenium-deep-synchronization\`**, \`selenium-deep-locators-xpath-dynamic\` |
| Fri | 3 | \`selenium-deep-interactions\`, **\`selenium-deep-troubleshooting-flaky-tests\`** |
| Sat | 3 | \`selenium-deep-parallel-execution\`, \`selenium-deep-grid-infrastructure\`, \`selenium-deep-framework-design\`; mock 2 (technical screen) |
| **Week 3** Mon | 4 POM + patterns | **\`pom-deep-components-and-reusable-methods\`**, \`pom-deep-variants-pagefactory-loadable\` |
| Tue | 4 | **\`pom-deep-creational-patterns\`**, \`pom-deep-structural-behavioural-patterns\`, \`pom-deep-screenplay-pattern\` |
| Wed | 5 Cucumber | **\`cucumber-deep-architecture-internals\`**, \`cucumber-deep-steps-parameter-types-datatables\`, **\`cucumber-deep-dependency-injection-hooks\`** |
| Thu | 5, 6 | \`cucumber-deep-execution-reporting-parallel\`, \`cucumber-deep-bdd-practice-at-scale\`, **\`framework-deep-testng-internals-extensibility\`** |
| Fri | 6 TestNG, JUnit, Maven | \`framework-deep-junit5-vs-testng-assertions\`, **\`framework-deep-maven-build-internals\`** |
| Sat | 7 API | **\`restassured-deep-internals-http\`**, \`restassured-deep-assertions-json-contracts\`, **\`restassured-deep-api-framework-architecture\`**; mock 3 (framework design, whiteboard) |
| **Week 4** Mon | 7 | **\`restassured-deep-auth-security-testing\`**, \`restassured-deep-advanced-api-testing\` |
| Tue | 8 SQL + DB | **\`restassured-deep-sql-for-testers\`**, \`restassured-deep-database-testing-jdbc\` |
| Wed | 9 Git, CI, Docker | \`framework-deep-git-for-automation-teams\`, **\`framework-deep-jenkins-ci-cd-pipelines\`**, \`framework-deep-docker-for-test-automation\` |
| Thu | 10 Enterprise frameworks | **\`framework-deep-enterprise-java-selenium\`** or **\`pw-deep-enterprise-playwright-typescript\`** in depth, the other one decisions only |
| Fri | 11 Project scenarios | **\`interview-deep-scenarios-cart-and-checkout\`**, \`interview-deep-scenarios-account-and-catalog\`, \`interview-deep-scenarios-orders-and-end-to-end\` (the 60-second explanations) |
| Sat | 12 Interview | **\`interview-deep-senior-technical-qa\`**, **\`interview-deep-leadership-and-behavioural-qa\`**; mock 4 (full loop, rubric) |
| Sun | rest | rapid-fire table, fact sheet, checklist; stop early |

Interview sooner? *One week:* bold slugs of your stack plus both section 12 lessons. *Two days:* fact sheet, two-minute framework, rapid fire, one mock. After each mock, replace one planned lesson by the one your lowest score points to.

## Interview-day checklist

**Evening before**

- fact sheet read aloud once; three stories chosen; no new topics
- job description and people's roles read; four questions written
- laptop: camera, microphone, screen sharing, editor, one runnable project in each stack you claim
- clothes, route or link, time zone of the invitation checked

**One hour before**

- notifications and private tabs closed; water, paper, pen; phone as backup connection
- introduction spoken once, two-minute framework once
- nothing confidential from an employer on the screen you will share

**During**

- repeat the question in your own words when it is broad; ask one clarifying question
- answer first; stop after two minutes; "shall I go deeper?"
- think aloud in design and coding; write assumptions down; test your code unasked
- unknown: say so, reason, say how you would verify
- write down names and surprising questions

**Within an hour afterwards**

- note each question and score yourself with the rubric
- correct your fact sheet; if you promised information, send it
- a short thank-you message, if it is usual where you apply; no pressure on the decision

## Tricky follow-ups

**"You say 'reduced by 80 %'. What else changed in that period?"** — Name it: more machines, fewer tests, another release rhythm. If you cannot separate the effects, say "together with".

**"What would your manager change about you?"** — Something you have really been told; then what you did with it.

**"You have been three years on the same framework. Did you do the same year three times?"** — Three decisions you would now make differently are the proof of growth.

**"Why should we take you and not someone with more automation years?"** — No attack on others: the overlap between their problem and your evidence, plus the gap you will close.

**"Is testing not dead with AI?"** — Writing a check gets cheaper; deciding what matters and answering for a release does not. Then a concrete thing you tried, and its limit.
`,
  keyPoints: [
    `Templates, not biographies: every bracket is your own fact, every number has a source, every "we" is followed by your part.`,
    `Senior STAR adds Options and Learning; two minutes, one measured result, one honest remainder.`,
    `Strategy starts with risks and a signed "not covered" list; tools come last.`,
    `ROI counts only manual runs that would really have happened and includes maintenance; faster feedback is shown beside it.`,
    `Every metric needs a decision and a counter-metric; counts and pass rates mislead without a denominator.`,
    `Go/no-go is a recommendation with evidence and conditions; the business owner decides, and "not tested" is never reported as passed.`,
    `An escape has two chains, made and missed; fix the cheapest level that could have seen its whole class.`,
    `Change habits by making red believable: owners, expiry, limited quarantine, visible trend.`,
  ],
  mistakes: [
    `Telling a borrowed or improved story. Fix: use a smaller true example or say "I have not had this; I would…"; rehearse three follow-ups on every number you state.`,
    `Saying only "we". Fix: mark in your fact sheet which verbs are yours, and name the colleague who did the rest.`,
    `Claiming QA "approves" releases. Fix: give a recommendation, the risk in customer words, conditions and the person who decides.`,
    `Promising a rewrite of the inherited framework in the first month. Fix: baseline, quarantine and one trustworthy slice first, decision with numbers on day 60.`,
    `Criticising the current employer or sharing its internals. Fix: one neutral sentence about what you want next; describe mechanisms, not customers.`,
    `Preparing by reading only. Fix: answer aloud, record a mock every week, score it with the rubric and work on the lowest line.`,
  ],
  tryIt: `Fill in the fact sheet today. Then record three answers without notes: the introduction (90 seconds), your framework (2 minutes) and one failure (2 minutes). Score each with the rubric, improve only the lowest line and record again tomorrow. For practice with strategy, write the two-page test strategy for ShopEasy, including a "not covered" list, and read it to a colleague who plays the product owner.`,
  problems: ['int-025', 'int-026', 'int-031', 'int-039'],
}
