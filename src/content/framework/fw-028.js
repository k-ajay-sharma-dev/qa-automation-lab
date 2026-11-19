export default {
  id: 'fw-028',
  category: 'framework',
  kind: 'quiz',
  title: 'A framework README that gets a new joiner to a green run on day one',
  level: 'BEGINNER',
  tags: ['framework-design', 'readme', 'onboarding', 'documentation', 'maintainability'],
  estMinutes: 10,
  scenario: `Two new QA engineers join the ShopEasy team on Monday. Last time it took a new joiner four days to run a single
test: nobody had written down the JDK version, the \`-Denv\` values, where the API server runs (port 5181) or that the
password comes from an environment variable. Your lead asks you to write the README for the framework this week.`,
  description: 'Choose the best answer. A good README is short, accurate and tested — not a wiki dump.',
  questions: [
    {
      q: 'What should the **first** section of the framework README give a new joiner?',
      options: [
        'The history of why the team moved from QTP to Selenium',
        'Prerequisites (JDK 17, Maven 3.9, Chrome) and the one command that runs the smoke suite locally, with the expected result',
        'A UML diagram of every class',
        'The full list of 400 test cases',
      ],
      answer: 1,
      why: 'The first goal is a green run: "install X, Y, Z; run mvn clean test -Pqa,smoke; you should see N tests pass and the report in target/...". Everything else (architecture, conventions) comes after the reader has a working setup.',
    },
    {
      q: 'Tests need `SHOPEASY_PASSWORD`. What does the README say about it?',
      options: [
        'The actual password, so nobody has to ask',
        'The variable name, how to set it (PowerShell and bash examples) and who to ask / which vault holds the value',
        'Nothing — secrets should not be mentioned at all',
        'A link to a screenshot of the password',
      ],
      answer: 1,
      why: 'Document the name and how to provide it, never the value: READMEs are in git, and git history keeps a leaked password forever. Saying nothing is the other failure — the new joiner gets a NullPointerException and loses a day.',
    },
    {
      q: 'Which item does **not** belong in the README?',
      options: [
        'How to run a single class or group (mvn test -Dtest=LoginTest, -Dgroups=smoke)',
        'Where reports, screenshots and logs are written',
        'A step-by-step copy of every test case\'s steps',
        'How to add a new page object and test, with a short example and naming conventions',
      ],
      answer: 2,
      why: 'Test steps live in the code (and the test management tool); a copy in the README is stale after the next sprint. The README explains how to run, where to look and how to contribute.',
    },
    {
      q: 'How do you know the README actually works?',
      options: [
        'The author reads it once more',
        'A new joiner (or a clean machine / container) follows it word for word, and every gap they hit is fixed in the README in the same week',
        'It has more than 10 pages',
        'Nobody has complained for a month',
      ],
      answer: 1,
      why: 'Treat the README like a test case: execute it on a clean environment. Bonus: CI should run the same commands the README shows, so if CI is green the documented commands are valid.',
    },
    {
      q: 'The README says `mvn test -Denv=staging` but the profile was renamed to `uat` three sprints ago. What prevents this from happening again?',
      options: [
        'Banning README edits',
        'A PR checklist item "README/config docs updated if run options changed", and reviewers checking it',
        'Writing the README in a Word document on SharePoint instead',
        'Removing all commands from the README',
      ],
      answer: 1,
      why: 'Docs in the same repo and the same PR as the change they describe stay in sync. A one-line PR checklist item is cheap and effective. Moving docs out of the repo makes drift worse.',
    },
  ],
  hints: [
    'Order matters: setup and "run smoke" before architecture.',
    'Names of secrets yes, values never.',
    'Test the README the way you would test a feature.',
  ],
  explanation: `**A README skeleton for a test framework**

\`\`\`text
# ShopEasy UI & API tests
## Quick start        JDK 17, Maven 3.9, Chrome · set SHOPEASY_PASSWORD · mvn clean test -Pqa,smoke
## Running            -Denv=qa|uat, -Dbrowser=chrome|firefox, -Dheadless=true, -Dgroups, single class
## Reports & logs     target/surefire-reports, target/extent/report.html, target/screenshots, target/logs
## Project layout     pages/, tests/, utils/, config/, testdata/ (one line each)
## Adding a test      a 10-line example + naming conventions + "never Thread.sleep"
## CI                 link to the Jenkins job, when it runs (smoke after deploy, regression nightly)
## Help               team channel, owner of the framework
\`\`\`

The reviewer's test: can someone who has never seen the repo get a green smoke run in under an hour using only
this file? If not, the README has a bug.`,
  mistakes: [
    'Committing real passwords or tokens into the README.',
    'Writing architecture essays but no "how to run" command.',
    'Letting the README drift from the real Maven profiles and properties.',
    'Copying test steps into documentation where they go stale.',
  ],
  interview: [
    { q: 'How do you onboard a new team member to your automation framework?', a: 'A README with prerequisites and one command for a green smoke run, a short walkthrough of the layout and conventions, then a pairing session where they add a small test via a PR that I review. Any gap they hit gets fixed in the README.' },
    { q: 'How do you handle credentials in documentation?', a: 'I document the environment-variable names and where to get the values (vault, team lead), never the values themselves. The same names are used by CI as masked secrets.' },
  ],
}
