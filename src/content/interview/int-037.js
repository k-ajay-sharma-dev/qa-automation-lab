export default {
  id: 'int-037',
  category: 'interview',
  kind: 'quiz',
  title: '"A developer says it\'s not a bug" — handling the disagreement professionally',
  level: 'INTERMEDIATE',
  tags: ['behavioural', 'soft-skills', 'conflict', 'defects', 'collaboration'],
  estMinutes: 10,
  scenario: `The interviewer asks: *"Tell me about a time you disagreed with a developer about a bug."* Example situation from a ShopEasy-style project: your automated API test shows that \`POST /api/cart/items\` accepts \`quantity: 0\` and returns 201, adding an empty line to the cart. The developer closes your defect as "Works as designed — the UI never sends 0." The interviewer wants to see evidence over emotion, the right escalation path, and that the relationship survives.`,
  description: `Choose the best move at each step of the disagreement.`,
  hints: [
    'Go back to the source of truth: requirements, acceptance criteria, API contract.',
    'Escalate the decision, not the person — the product owner decides expected behaviour.',
  ],
  questions: [
    {
      q: 'The defect is closed as "Works as designed". What is your first step?',
      options: [
        'Reopen it immediately with "This IS a bug"',
        'Talk to the developer directly: show the request/response, ask what the intended rule is, and check the acceptance criteria and API contract together',
        'Complain to the developer\'s manager',
        'Delete your test so the build stays green',
      ],
      answer: 1,
      why: 'Start with a **conversation and evidence**. Often the disagreement is a missing or unclear requirement, not a wrong person. Reopen-wars and going over someone\'s head damage trust; deleting the test hides the risk.',
    },
    {
      q: 'The developer says "The UI never sends 0, so it doesn\'t matter." Best counter-argument?',
      options: [
        '"Testing says so."',
        '"The API is reachable directly — by mobile apps, partner integrations or anyone with curl. Server-side validation is the real guard; the UI check is only convenience. An empty cart line could also break the order total or checkout."',
        '"I have six years of experience."',
        '"Fine, you are right."',
      ],
      answer: 1,
      why: 'Argue **risk and impact**, not authority. The point that client-side validation can be bypassed is technically correct and hard to dismiss. Giving in without discussion leaves a real risk unrecorded.',
    },
    {
      q: 'You still disagree after the discussion. What now?',
      options: [
        'Keep arguing in the ticket comments until they give up',
        'Bring it to the product owner (or triage meeting) with both views and the impact, and accept the decision — recorded in the ticket',
        'Mark the test as @Ignore quietly',
        'Fix the code yourself without telling anyone',
      ],
      answer: 1,
      why: 'Expected behaviour is a **business decision**. The PO or triage decides; you make sure the decision is informed and written down. If they accept the risk, that is a valid outcome — the point is that it is visible.',
    },
    {
      q: 'The PO agrees: quantity must be at least 1. What is the best follow-up from you?',
      options: [
        '"Told you so" in the team channel',
        'Nothing — the developer will handle it',
        'Update the acceptance criteria, keep the automated negative test (expect 422 INVALID_QUANTITY for quantity 0 and negative values), and thank the developer for the discussion',
        'Raise five more bugs about validation without checking them',
      ],
      answer: 2,
      why: 'Lock the rule into the **acceptance criteria and a regression test** so it cannot silently come back, and keep the relationship good — you will work with this developer tomorrow.',
    },
  ],
  explanation: `**Model STAR answer (about 75 seconds)**
> **S:** "Our nightly API tests showed that adding a product with quantity 0 returned 201 and created an empty cart line. The developer closed my defect as 'works as designed — the UI never sends 0'.
> **T:** I needed to agree on the correct behaviour without turning it into a fight.
> **A:** I went to his desk with the request and response, and we checked the story together — the acceptance criteria didn't mention a minimum. I explained the API can be called directly, by our mobile app for example, so the server must validate. We still saw it differently, so I took both views to the PO in triage.
> **R:** The PO set the rule to quantity ≥ 1. The fix was small, I kept the negative test in the regression suite, and the acceptance-criteria template now has a 'validation rules' line. The developer and I actually started reviewing API stories together after that."

**Principles to say out loud:** evidence over opinion; the requirement is the referee; escalate the *decision*, not the person; record the outcome.`,
  mistakes: [
    'Making it personal ("the developer was wrong") instead of about requirements and risk.',
    'Escalating to managers before talking to the developer directly.',
    'Hiding the disagreement by disabling the test.',
    'Telling a story where you "won" but the relationship broke — interviewers hear that as a warning.',
  ],
  interview: [
    { q: 'What if the PO decides it is not a bug and you still think it is risky?', a: 'I accept the decision and make the risk visible: the ticket records who decided and why, and I may keep the test as a documented known behaviour. If it causes a production issue later, we revisit with data — not with "I told you so".' },
    { q: 'How do you write a bug report that avoids these arguments?', a: 'Exact steps, request and response (or screenshot), expected vs actual with a reference to the requirement, environment and data, and the impact on the user or business. A clear report turns opinion into facts.' },
  ],
}
