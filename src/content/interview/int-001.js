export default {
  id: 'int-001',
  category: 'interview',
  kind: 'quiz',
  title: '"Explain your framework" — the question that opens every interview',
  level: 'BEGINNER',
  tags: ['framework', 'pom', 'cucumber', 'structure', 'storytelling'],
  estMinutes: 15,
  scenario: `It's the first technical question in almost every 4–8 years QA automation interview: *"Can you explain the framework you worked on?"* Many experienced manual testers freeze here or recite definitions ("POM is a design pattern…"). The interviewer actually wants a **2-minute guided tour of a real project**: tools, layers, flow of a test, how it runs, how results are reported.`,
  description: `Pick the best answer for each question. Then practise saying the model answer in the **Interview** section out loud — time yourself (target: 90–120 seconds).

**A structure that always works** (top-down, like a building tour):
1. **Context** — application, team, what you automated.
2. **Tech stack** — Java, Selenium 4, Cucumber/TestNG, Maven, Git, Jenkins.
3. **Layers** — feature files → step definitions → page objects → utilities/driver/config.
4. **Execution** — runner, tags, parallel, environments, CI schedule.
5. **Reporting & maintenance** — reports, screenshots, failure triage, your contribution.`,
  hints: [
    'Start with the project context in one sentence, then the stack, then the layers.',
    'Use "we" for the team and "I" for what you personally built or improved.',
  ],
  questions: [
    {
      q: 'The interviewer asks "Explain your framework." Which opening is strongest?',
      options: [
        '"A framework is a set of guidelines and rules for creating test cases…"',
        '"In my last project we tested an e-commerce web app. We built a BDD framework in Java with Selenium 4, Cucumber 7 and TestNG, managed with Maven, stored in Git and run from Jenkins. Let me walk you through the layers."',
        '"We used Selenium. It is an open-source tool for automating browsers."',
        '"I mostly did manual testing, but I know the theory of frameworks."',
      ],
      answer: 1,
      why: 'Lead with real context and the stack in one breath, then signal structure ("let me walk you through the layers"). Definitions sound like a textbook; underselling yourself ends the conversation. Even if you joined automation late, you can describe the framework you worked on and the parts you contributed to.',
    },
    {
      q: 'In a Cucumber + Selenium POM framework, what is the correct flow of a test?',
      options: [
        'Page object → feature file → step definition → driver',
        'Feature file (Gherkin) → step definition (glue) → page object methods → WebDriver → browser; assertions in the step layer',
        'Step definition → feature file → Excel → browser',
        'TestNG runner → page object → feature file',
      ],
      answer: 1,
      why: 'The runner picks feature files by tags; each Gherkin step is matched to a step-definition method, which calls page-object methods; page objects use WebDriver (via a DriverManager) to interact with the browser. Assertions typically live in step definitions/tests, not inside page objects, so pages stay reusable.',
    },
    {
      q: 'Which folder structure would you describe for a Maven Cucumber framework?',
      options: [
        'Everything in one TestCases.java file',
        'src/test/java: runners, stepdefs, hooks, pages, utils (DriverManager, ConfigReader, WaitUtils); src/test/resources: features, config (qa/stage properties), test data; pom.xml with dependencies and Surefire config',
        'src/main/webapp with JSP pages',
        'Feature files inside the pages package',
      ],
      answer: 1,
      why: 'Interviewers listen for separation of concerns: runners, step definitions, hooks, page objects, utilities, and resources for features/config/data. Mentioning environment-specific config files and the Surefire/Failsafe plugin shows you know how it actually runs.',
    },
    {
      q: 'Which detail best shows REAL hands-on experience rather than memorised theory?',
      options: [
        '"Our framework was robust and scalable."',
        '"We followed all best practices."',
        '"We had around 350 scenarios tagged @smoke and @regression. Smoke ran on every deployment to QA in about 8 minutes; full regression ran nightly with 4 parallel threads in about 45 minutes. I owned the checkout and payment modules and maintained the DriverManager."',
        '"We used many tools."',
      ],
      answer: 2,
      why: 'Specifics — numbers, tags, timings, modules you owned, a component you maintained — are what make an answer believable. Adjectives like "robust" and "scalable" add nothing. Prepare your numbers in advance and make sure they are realistic for your project.',
    },
    {
      q: 'The interviewer follows up: "What was YOUR contribution?" What is the best answer pattern?',
      options: [
        '"Everything was done by the team."',
        '"I designed the whole framework from scratch alone." (when it isn\'t true)',
        'Name 2–3 concrete things: modules you automated, a framework improvement you made, and an impact ("reduced flaky failures", "cut run time"), using "I"',
        '"I executed the scripts that others wrote."',
      ],
      answer: 2,
      why: 'Use "I" with concrete, honest examples: "I automated ~80 scenarios for cart and checkout, added screenshot-on-failure to the hooks, and replaced static waits with explicit waits which cut flaky failures noticeably." Over-claiming is risky because follow-up questions will expose it; under-claiming loses the offer.',
    },
  ],
  explanation: `**Model answer (adapt to your project, ~2 minutes):**

> "In my last project I worked on an e-commerce web application — login, product catalogue, cart, checkout and order history. We built a **BDD hybrid framework** using **Java 17, Selenium 4, Cucumber 7 and TestNG**, with **Maven** for build and dependencies, **Git** for version control and **Jenkins** for CI.
>
> Structurally, business scenarios are written in **Gherkin feature files**, tagged as @smoke, @regression or by module. Each step maps to **step definitions**, which call **page objects** — one class per page, with private By locators and public action methods; common waits and actions live in a **BasePage**. A **DriverManager** with ThreadLocal creates the browser based on config, so we can run in parallel. Environment URLs and credentials come from **properties files** per environment, and test data from JSON files or created via APIs.
>
> **Hooks** open the browser before each scenario and, after it, take a screenshot on failure and quit. We run through a **TestNG runner** with tags; on Jenkins, smoke runs after every QA deployment and full regression runs nightly in headless Chrome with 4 threads. Results go to **Extent/Cucumber HTML reports** with screenshots, and failures are triaged the next morning.
>
> My contribution was automating the cart and checkout modules, and I improved stability by replacing hard waits with explicit waits and making each scenario create its own test data so tests run independently."

Practise until you can say it without notes, then swap in your own modules and numbers.`,
  mistakes: [
    'Starting with definitions of "framework" or "POM" instead of a real project.',
    'Listing tools with no structure or flow.',
    'Claiming you built everything alone, then failing follow-up questions.',
    'Talking for 10 minutes — aim for 2 and let the interviewer dig.',
  ],
  interview: [
    { q: 'Explain your framework.', a: 'In my last project we automated an e-commerce web app using a BDD framework with Java, Selenium 4, Cucumber and TestNG, built with Maven and run from Jenkins. Feature files describe the business scenarios, step definitions glue them to page objects, and page objects hold private locators and action methods built on a BasePage with explicit waits. A ThreadLocal DriverManager creates browsers from config so we run in parallel; hooks handle setup, screenshots on failure and teardown. Smoke runs on each deployment, regression nightly, and we publish Cucumber/Extent reports. I owned the cart and checkout modules and introduced explicit-wait utilities that reduced flaky failures.' },
    { q: 'Why did you choose a hybrid BDD framework?', a: 'The business analysts and product owner review the Gherkin scenarios, so feature files are living documentation, while POM keeps the Selenium code maintainable and reusable. TestNG gives us parallel execution and listeners, so the combination covers collaboration, maintainability and execution control.' },
    { q: 'How many test cases did you automate, and how long does the suite take?', a: 'Give realistic numbers you can defend, for example: around 300 scenarios in regression; smoke of about 40 scenarios runs in 8 minutes after every deployment; full regression runs nightly in about 45 minutes with 4 parallel threads.' },
  ],
}
