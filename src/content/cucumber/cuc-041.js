export default {
  id: 'cuc-041',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Three Amigos review: critique a feature file written by the BA',
  level: 'EXPERT',
  tags: ['three-amigos', 'code-review', 'gherkin', 'bdd-process'],
  estMinutes: 15,
  scenario: `In the Three Amigos session for the seller sign-up story, the BA shares this draft. You are the QA amigo: your job is to
make it testable, unambiguous and automatable before a single line of glue is written.

\`\`\`gherkin
Feature: Registration
  Scenario: Registration works
    Given the user is on the page
    When the user enters all the details correctly and submits and the details are saved
    Then registration should be successful and fast
    And an email should be sent within a reasonable time
\`\`\``,
  description: 'Pick the review comment that adds the most value for each question.',
  questions: [
    {
      q: '"Then registration should be successful and fast" — what is the most important comment?',
      options: [
        'Change "should be" to "is"',
        '"successful" and "fast" are not verifiable: name the observable result ("Thanks! Your seller application was submitted." is shown) and move performance to a separate, measurable NFR check',
        'Split it into two Then steps with the same wording',
        'Delete it — the When already says the details are saved',
      ],
      answer: 1,
      why: 'Every Then must be checkable with a yes/no. "Fast" has no threshold and does not belong in a functional UI scenario; agree a number and test it with the right tool (API/performance test).',
    },
    {
      q: 'What is wrong with the When step?',
      options: [
        'It is too short',
        'It hides the data ("all the details correctly") and mixes an action with an outcome ("the details are saved")',
        'When steps cannot contain "and"',
        'It should be a Given',
      ],
      answer: 1,
      why: 'A reader cannot tell which details were used, so the example is not concrete. "the details are saved" is a result and belongs in a Then. Concrete example: a seller "Asha Rao", asha@example.com, country India.',
    },
    {
      q: 'The draft has only the happy path. Which question do you raise first?',
      options: [
        '"Can we automate this in Playwright instead?"',
        '"What should happen when required fields are missing or the email is invalid?" — leading to examples like "Email is required" and "Enter a valid email address"',
        '"Can we add more Givens?"',
        '"Can the scenario be tagged @smoke?"',
      ],
      answer: 1,
      why: 'Three Amigos is about discovering rules through examples. Asking for the negative rules surfaces the validation messages, the terms checkbox ("You must accept the terms") and the country rule before development, not after.',
    },
    {
      q: '"And an email should be sent within a reasonable time" — best handling?',
      options: [
        'Keep it; the UI test can wait 5 minutes and check a mailbox',
        'Clarify the rule (which email, to whom, what SLA) and agree where it is verified — likely a lower-level/API or integration test, possibly a separate scenario',
        'Change it to a Given',
        'Remove it silently',
      ],
      answer: 1,
      why: 'BDD scenarios are a conversation tool, not a commitment to test everything through the browser. Vague timings get a number, and the team decides the cheapest reliable level to verify it. Silently removing it loses a requirement.',
    },
    {
      q: 'Which title and Feature name would you suggest?',
      options: [
        'Feature: Registration / Scenario: Test 1',
        'Feature: Seller registration / Scenario: A seller with complete, valid details can apply',
        'Feature: form.html / Scenario: Register button',
        'Feature: SHOP-412 / Scenario: Happy path',
      ],
      answer: 1,
      why: 'Names should state the capability and the rule each scenario proves, so the report reads as living documentation. Page names and ticket numbers belong in tags or descriptions, not titles.',
    },
  ],
  hints: ['Could two testers read each step and do exactly the same thing and get the same yes/no answer?', 'Unclear words: "correctly", "fast", "reasonable".'],
  explanation: `A QA review of BA-written Gherkin checks four things:

1. **Concrete examples** — real data ("Asha Rao", "asha@example.com", "India") instead of "all the details".
2. **One action, verifiable outcomes** — When does, Then checks; no "and is saved" inside a When.
3. **Missing rules** — negative paths, boundaries, permissions. Each discovered rule becomes a scenario (or a Rule block).
4. **Right level** — non-functional and back-end side effects (email, timings) get measurable criteria and are tested where it is cheapest.

Raise these as questions in the session, not as silent rewrites — the BA owns the business language, you own testability.`,
  mistakes: [
    'Accepting vague words ("correctly", "fast", "reasonable") because the meaning seems obvious in the meeting.',
    'Reviewing only the wording and not asking for the missing negative rules.',
    'Forcing every requirement (emails, performance) into a browser scenario.',
  ],
  interview: [
    { q: 'What is the QA role in a Three Amigos session?', a: 'To challenge the examples: ask "what if", find missing negative and edge cases, make outcomes measurable, and flag what cannot be verified cheaply at UI level. The output is agreed scenarios before development starts.' },
    { q: 'Should QA rewrite the BA\'s feature files directly?', a: 'Prefer collaborating: suggest changes in the session or as review comments so the business language stays owned by the business. Silent rewrites erode trust and the shared understanding BDD is meant to build.' },
    { q: 'How do you handle a non-functional requirement that appears in a Gherkin step?', a: 'Turn it into a measurable criterion (e.g. confirmation within 2 seconds at p95) and verify it with a suitable tool — performance or API test — rather than a sleep-and-check in a UI scenario.' },
  ],
}
