export default {
  slug: 'answering-automation-interview-questions',
  category: 'interview',
  order: 1,
  title: 'How to answer automation interview questions',
  minutes: 8,
  summary: 'Structure answers with a definition, a real project example and a trade-off, and tell an honest, confident framework story.',
  manualAnalogy: `A good defect report has a clear title, steps, expected vs actual and evidence. A good interview answer has the
same discipline: a crisp point, a concrete example from your work, and the evidence that you understand the
trade-offs. You already write for an audience every day - an interview is just a spoken bug report about yourself.`,
  body: `## What interviewers are really checking

For an automation role, almost every question tests three things:

1. **Do you know the concept?** (definition)
2. **Have you actually used it?** (a specific example)
3. **Do you understand when *not* to use it?** (trade-off, judgement)

Most candidates stop after step 1, reciting a textbook definition. You stand out by always reaching step 3.

## The three-part answer

Use this shape for nearly every technical question:

> **Point** - one or two sentences that answer the question directly.
> **Proof** - "In my project we..." plus a concrete detail: a class name, a page, a number.
> **Trade-off** - "The downside is... so we..." or "I would not use it when..."

Example - *"What is an explicit wait?"*

> "An explicit wait pauses until a specific condition is true, up to a timeout - for example until an element is
> clickable. In my practice framework for an e-commerce site, the cart badge updates after JavaScript runs, so the
> page object waits for \`.shopping-cart-badge\` to be visible before reading it. We avoided mixing it with an
> implicit wait, because combining the two makes timeouts unpredictable."

Forty seconds, and the interviewer heard the concept, a real usage and a pitfall.

## "In my project we..." - when you have little automation experience

You have six years of testing and a growing automation portfolio. Be honest about both - and use both:

- **Never invent** years of automation or a framework you did not build. Follow-up questions expose it within two
  minutes, and trust does not come back.
- **Do** describe the framework you have actually built while learning (for example a Selenium + Cucumber + POM
  suite against a demo shop) as a real project: what you built, why, what broke, how you fixed it.
- **Do** connect your manual experience: "I designed the regression pack for checkout manually for three years, so
  when I automated it I knew which 20 scenarios carry the risk." That is something many pure coders cannot say.
- Use precise ownership words: "I built", "I contributed", "the team decided, and my part was...". When asked
  "What was *your* contribution?", name specific pieces you wrote or fixed.

## The opener: "Explain your framework"

This question starts most automation interviews, so prepare it word for word and time it (90-120 seconds). Walk it
top-down, like a building tour:

1. **Context** - application under test, team size, what share you automated.
2. **Stack** - Java 17, Selenium 4, Cucumber 7, TestNG, Maven, Git, Jenkins.
3. **Layers** - feature files -> step definitions -> page objects -> utilities (driver factory, config reader,
   waits).
4. **Execution** - runners, tags, parallel runs, environments, schedule in CI.
5. **Reporting and maintenance** - reports with screenshots, how failures are triaged, what you improved.

Finish with one thing you are proud of ("I cut the nightly run from 70 to 25 minutes by running scenarios in
parallel") - it invites the follow-up you *want*.

## Story questions: STAR

Behavioural questions ("Tell me about a flaky test you fixed", "What happens when the pipeline goes red?") need a
story. Use **STAR**:

| Part | Content | Length |
|---|---|---|
| **S**ituation | where, what system | 1 sentence |
| **T**ask | what you had to achieve | 1 sentence |
| **A**ction | what *you* did, step by step - the longest part | 3-5 sentences |
| **R**esult | measurable outcome, lesson learned | 1-2 sentences |

Prepare four or five stories in advance: a flaky test you stabilised, a real bug your automation caught, a failing
pipeline you triaged, a time you pushed back on automating something, a framework improvement. Most questions can
be answered with one of them.

For the red-pipeline story, show a method: look at the report and screenshots first, classify each failure (product
bug, test bug, environment, test data), reproduce manually when needed, raise defects with evidence, and never just
re-run until green.

## When you do not know

Say so, then reason aloud: "I have not used Selenium Grid in production. My understanding is it distributes
browsers across machines; I would expect to point RemoteWebDriver at the hub URL..." Interviewers value honest
reasoning far more than a confident wrong answer.

## Delivery tips

- Answer first, then explain. Do not build up to the point for a minute.
- Use the interviewer's words back ("For flaky tests specifically...").
- Stop after about a minute and let them dig. A conversation beats a monologue.`,
  keyPoints: [
    'Answer shape: point -> proof ("In my project we...") -> trade-off.',
    'Prepare "Explain your framework" top-down: context, stack, layers, execution, reporting - 90 to 120 seconds.',
    'Use STAR for story questions and prepare 4-5 real stories in advance.',
    'Be honest about your automation years; turn your manual expertise into an advantage.',
    'When unsure, say so and reason aloud.',
  ],
  mistakes: [
    'Reciting a definition with no example. Fix: always add one concrete "in my project" detail.',
    'Claiming years of automation you do not have. Fix: present your real framework and manual depth honestly.',
    'Describing the framework bottom-up as a list of tools. Fix: tell the flow from feature file to report.',
    'Answering "we did..." for everything. Fix: say clearly what YOU built or fixed.',
  ],
  tryIt: `Record yourself answering "Explain your framework" on your phone. Play it back: did you cover all five parts in
under two minutes, and did you say at least one thing you personally built?`,
  problems: ['int-001', 'int-005', 'int-007'],
}
