export default {
  id: 'int-007',
  category: 'interview',
  kind: 'quiz',
  title: 'CI/CD with Jenkins — and what you do when the pipeline turns red',
  level: 'INTERMEDIATE',
  tags: ['jenkins', 'ci-cd', 'maven', 'pipeline', 'reporting', 'triage'],
  estMinutes: 15,
  scenario: `"How are your tests integrated with CI/CD?" and "A test fails in the pipeline — what do you do?" are asked together in most interviews. You need to describe **how a job is triggered, what command runs, where reports go**, and your **failure-handling routine** — in project language.`,
  description: `Answer the questions and practise the two model answers in the Interview section.`,
  hints: [
    'Jenkins typically runs: mvn clean test -Denv=qa -Dcucumber.filter.tags="@smoke"',
    'Triage: read → evidence → reproduce → classify → communicate.',
  ],
  questions: [
    {
      q: 'Which Maven command would a Jenkins job most likely run for the ShopEasy smoke suite on QA in headless mode?',
      options: [
        'java -jar selenium.jar',
        'mvn clean test -Denv=qa -Dheadless=true -Dcucumber.filter.tags="@smoke"',
        'mvn deploy',
        'npm run test',
      ],
      answer: 1,
      why: 'clean test compiles and runs tests via Surefire; system properties choose the environment and headless mode (read by your ConfigReader/DriverFactory), and cucumber.filter.tags selects scenarios. Knowing this one line by heart signals hands-on experience.',
    },
    {
      q: 'When should the automated suites run in a typical pipeline?',
      options: [
        'Only manually before a release',
        'Smoke after every deployment to QA (triggered by the deploy job or a webhook); full regression nightly or before release; optionally a quick sanity on PRs',
        'Every 5 minutes, all tests',
        'Only on developers\' laptops',
      ],
      answer: 1,
      why: 'Fast feedback where it matters: a short smoke gate after each deployment, full regression on a schedule (Jenkins cron like H 2 * * *) and before releases. Running everything constantly wastes agents; running only manually defeats CI.',
    },
    {
      q: 'Which Jenkins setup best supports failure analysis?',
      options: [
        'Only the console log',
        'Publish Cucumber/Extent HTML reports and JUnit/TestNG XML results, archive screenshots on failure, keep build history/trends, and notify the team (email/Slack/Teams) with a link',
        'Delete old builds immediately',
        'Disable the console output',
      ],
      answer: 1,
      why: 'Reports with screenshots answer "what happened" quickly; history/trends reveal flaky tests; notifications make sure someone reacts. Mention the plugins/steps you used (e.g. cucumber-reports plugin, junit step, archiveArtifacts).',
    },
    {
      q: 'The nightly regression shows 7 failures. What is your FIRST action?',
      options: [
        'Raise 7 defects immediately',
        'Rerun the job until it is green',
        'Open the report, read each failure (exception, first frame in our code, screenshot), group failures with the same cause, then reproduce the unique ones manually',
        'Comment out the failing tests',
      ],
      answer: 2,
      why: 'Grouping first is a senior move: 7 failures are often 2 root causes (e.g. one changed locator used by 5 tests). Then classify each as product bug, test bug or environment issue, act, and communicate.',
    },
    {
      q: 'You confirmed one failure is a real product defect. What do you do with the automated test?',
      options: [
        'Delete it so the pipeline is green',
        'Raise the defect with evidence, link it to the test, and keep the test failing (or tag it with the defect id/known-issue so it is visible but doesn\'t block other work) until the fix is deployed',
        'Change the expected value to match the bug',
        'Ignore it',
      ],
      answer: 1,
      why: 'Never "fix" a test to match a bug. Teams either leave it red (honest) or tag it @known-issue / @DEF-812 so it runs in a non-blocking job — and remove the tag when the defect is closed and the test passes again.',
    },
  ],
  explanation: `**Model answer — CI/CD:**
> "Our tests live in Git next to a Jenkinsfile. After each deployment to QA, the deploy job triggers our smoke job: \`mvn clean test -Denv=qa -Dheadless=true -Dcucumber.filter.tags=@smoke\`. Full regression runs nightly at 2 a.m. in headless Chrome with 4 threads. Jenkins publishes the Cucumber HTML report, archives screenshots of failures and posts the result to our Teams channel."

**Model answer — "a test fails in the pipeline":**
> "I open the report, read the exception and the first line in our code, and check the screenshot. I group failures with the same cause. Then I reproduce manually on the same build. If it reproduces, I raise a defect with evidence and link the test; if the app works, it's a test issue — usually a locator or wait — and I fix it in a PR; if it's connection or data, I involve DevOps and rerun. I post a short summary so the team knows if the build is releasable."`,
  mistakes: [
    'Not knowing which command the pipeline runs.',
    'Saying "I just rerun failed tests".',
    'Changing expected values to match buggy behaviour.',
    'Raising defects without reproducing or grouping failures first.',
  ],
  interview: [
    { q: 'How did you integrate your framework with Jenkins?', a: 'The code is in Git with a Jenkinsfile. A smoke job is triggered after each deployment to QA and runs mvn clean test with the environment, headless flag and @smoke tag as parameters; regression runs nightly on a cron. Jenkins publishes the Cucumber/Extent report and TestNG results, archives failure screenshots and notifies the team channel.' },
    { q: 'What do you do when a test fails in the pipeline?', a: 'I read the failure and evidence, group failures with the same cause, and reproduce manually. Product issue: defect with screenshots and logs, linked to the test. Script issue: fix the locator, wait or data and raise a PR. Environment: escalate and rerun. Then I share a summary with the team so the release decision is clear.' },
    { q: 'How do you pass the environment to your tests?', a: 'Through a system property like -Denv=qa. Our ConfigReader loads qa.properties or staging.properties accordingly, so the same code runs against any environment without changes.' },
  ],
}
