export default {
  id: 'int-036',
  category: 'interview',
  kind: 'quiz',
  title: '"How do you keep learning?" and "Any questions for us?" — closing the interview well',
  level: 'BEGINNER',
  tags: ['behavioural', 'soft-skills', 'learning', 'questions-to-ask', 'career'],
  estMinutes: 8,
  scenario: `You moved from manual testing into automation and the technical round went fine. Then the hiring manager asks two "easy" questions: *"How do you keep your skills up to date?"* and, at the very end, *"Do you have any questions for us?"* Many candidates lose points here with "I watch YouTube" and "No, I'm good." Both questions test the same thing: are you curious, and do you think like someone who will own quality on this team?`,
  description: `Pick the strongest answer for each moment at the end of an interview.`,
  hints: [
    'Concrete beats generic: name what you learned, how you practised it, and where you used it.',
    'Your questions to them should show you are already imagining doing the job.',
  ],
  questions: [
    {
      q: '"How do you keep learning?" — best answer?',
      options: [
        '"I watch a lot of tutorials."',
        '"Last quarter I learned Playwright with TypeScript: I worked through the official docs, rebuilt five of our Selenium login and cart tests in it on a practice shop, and showed the team the auto-waiting difference in a 20-minute demo. I also follow the Selenium and Playwright release notes."',
        '"My company sends me on trainings when needed."',
        '"I already know everything the job needs."',
      ],
      answer: 1,
      why: 'A strong answer has **a recent example, a learning method, practice and an outcome** (a demo, a tool adopted). "Tutorials" is passive, waiting for company training sounds unmotivated, and claiming you know everything is a red flag.',
    },
    {
      q: 'You are asked about a tool you have never used (e.g. Appium). Best response?',
      options: [
        'Pretend you have used it',
        '"I haven\'t used Appium in a project. I know it follows the WebDriver protocol like Selenium, so locators, waits and page objects carry over. I would start with the official getting-started guide and automate one smoke flow in my first week."',
        '"No."',
        '"That tool is outdated, I would not use it."',
      ],
      answer: 1,
      why: 'Honesty + **transfer of what you know** + a concrete plan is the best possible answer to a gap. Bluffing collapses at the first follow-up; a flat "no" closes the topic without showing how you learn.',
    },
    {
      q: '"Do you have any questions for us?" — which is the best first question?',
      options: [
        '"No, you covered everything."',
        '"How many leave days do I get?"',
        '"What does the current automation look like — which layers are covered, how long does the regression take, and what is the biggest quality pain the team wants this role to fix in the first six months?"',
        '"What does your company do?"',
      ],
      answer: 2,
      why: 'It shows you are thinking about **the work and the impact** and gives you real information about the role. "No questions" signals low interest; asking what the company does means you did not prepare. Benefits questions are fine — but later, usually with HR.',
    },
    {
      q: 'Which pair of questions tells you most about whether automation is valued there?',
      options: [
        '"Do you use Java?" and "Do you use Jenkins?"',
        '"Who decides what gets automated?" and "When a test fails in CI, who looks at it and how fast?"',
        '"Is the office nice?" and "Is there free lunch?"',
        '"Can I work alone?" and "Are there many meetings?"',
      ],
      answer: 1,
      why: 'Ownership and failure handling reveal the **culture**: if nobody looks at red builds or developers never see test results, your automation will be ignored. Tech-stack questions are fine but you can usually find those answers in the job description.',
    },
  ],
  explanation: `**Model answer — learning (about 45 seconds)**
> "I learn by building. For example, last quarter I picked up Playwright with TypeScript: I went through the official docs, rewrote five of our login and cart tests in it on a practice site, and gave the team a short demo comparing it with our Selenium suite. Day to day I read release notes for the tools we use and follow a couple of testing blogs. When I learn something, I try to use it on real work within a week — otherwise it fades."

**Three questions worth keeping ready**
1. "What is the biggest quality problem you want this role to solve in the first six months?"
2. "When a test fails in CI, what happens next — who looks at it?"
3. "How do developers and testers work together on automation here — do developers write tests too?"

Listen to the answers: they tell you whether you would be fixing a flaky suite, building from zero, or joining a mature team.`,
  mistakes: [
    'Saying "I watch tutorials" with no example of something you built or changed.',
    'Bluffing experience with a tool instead of explaining how your skills transfer.',
    'Answering "No questions" — it reads as low interest.',
    'Opening with salary, leave or remote-work questions in a technical round.',
  ],
  interview: [
    { q: 'What did you learn recently, and how did you use it?', a: 'Give one specific item, how you learned it (docs, course, practice project), and where you applied it — a test you rewrote, a utility you added, a demo you gave. Keep it under a minute.' },
    { q: 'How do you decide what to learn next?', a: 'From the gaps I hit at work: if our API tests are slow to write I look at better tooling; if the team is moving to TypeScript I learn that. Learning tied to a real problem sticks and I can show the result.' },
  ],
}
