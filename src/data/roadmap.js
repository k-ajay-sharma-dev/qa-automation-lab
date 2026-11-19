// The learning path, in order. Each stage pulls problems by category + level, so new content lands
// in the right stage automatically. `weeks` is a suggested pace at ~1.5 hours a day.
export const PHASES = [
  {
    stage: 1,
    weeks: 'Week 1–2',
    title: 'Java Foundations',
    goal: 'Write the Java every automation script is made of. You already know WHAT to test — this is the HOW.',
    focus: ['Strings, numbers, if / loops in test checks', 'Methods, classes and objects for test data', 'Lists and maps of web elements and values'],
    picks: [['java', 'BEGINNER']],
  },
  {
    stage: 2,
    weeks: 'Week 3',
    title: 'Locators & First Scripts',
    goal: 'Find any element on a page reliably and write your first Selenium script that logs in and checks a result.',
    focus: ['id, name, CSS selectors and XPath', 'findElement, click, sendKeys, getText', 'Assertions instead of eyeballing'],
    picks: [
      ['locators', 'BEGINNER'],
      ['selenium', 'BEGINNER'],
      ['java', 'INTERMEDIATE'],
    ],
  },
  {
    stage: 3,
    weeks: 'Week 4–5',
    title: 'Selenium in Depth',
    goal: 'Handle everything a real application throws at you: waits, dropdowns, alerts, frames, windows and tables.',
    focus: ['Explicit waits, never Thread.sleep', 'Alerts, frames, windows, Actions', 'Dynamic elements and web tables'],
    picks: [
      ['selenium', 'INTERMEDIATE'],
      ['locators', 'INTERMEDIATE'],
      ['debugging', 'BEGINNER'],
    ],
  },
  {
    stage: 4,
    weeks: 'Week 6–7',
    title: 'Page Object Model & TestNG',
    goal: 'Stop writing scripts and start writing a framework: page classes, a base test and TestNG.',
    focus: ['Page classes with private locators', 'BasePage, BaseTest, DriverFactory', 'TestNG annotations, asserts, DataProvider'],
    picks: [
      ['pom', 'BEGINNER'],
      ['pom', 'INTERMEDIATE'],
      ['framework', 'BEGINNER'],
      ['java', 'ADVANCED'],
    ],
  },
  {
    stage: 5,
    weeks: 'Week 8–9',
    title: 'Cucumber BDD',
    goal: 'Turn your manual test cases into Gherkin scenarios backed by step definitions and page objects.',
    focus: ['Feature, Scenario Outline, Background', 'Step definitions, DataTables, hooks', 'Tags, runner and sharing state'],
    picks: [
      ['cucumber', 'BEGINNER'],
      ['cucumber', 'INTERMEDIATE'],
      ['framework', 'INTERMEDIATE'],
    ],
  },
  {
    stage: 6,
    weeks: 'Week 10–11',
    title: 'Framework, CI & Real-Time Debugging',
    goal: 'Run the suite like a real project: parallel, in CI, with reports — and fix the failures it produces.',
    focus: ['Parallel runs, ThreadLocal driver, Grid', 'Reports, listeners, Jenkins pipeline', 'Diagnosing flaky and failing tests'],
    picks: [
      ['selenium', 'ADVANCED'],
      ['pom', 'ADVANCED'],
      ['cucumber', 'ADVANCED'],
      ['framework', 'ADVANCED'],
      ['locators', 'ADVANCED'],
      ['debugging', 'INTERMEDIATE'],
      ['debugging', 'ADVANCED'],
    ],
  },
  {
    stage: 7,
    weeks: 'Week 12–13',
    title: 'API Testing with RestAssured',
    goal: 'Test the services behind the UI: requests, auth, JSON assertions and an API framework with Cucumber.',
    focus: ['HTTP methods, status codes, JSON', 'given / when / then, JsonPath, POJOs', 'Auth, chaining, schema validation'],
    picks: [
      ['restassured', 'BEGINNER'],
      ['restassured', 'INTERMEDIATE'],
      ['restassured', 'ADVANCED'],
    ],
  },
  {
    stage: 8,
    weeks: 'Week 14–15',
    title: 'Playwright + TypeScript',
    goal: 'Move to the modern stack: TypeScript, Playwright locators and auto-waiting, POM and Cucumber on Playwright.',
    focus: ['TypeScript and async / await', 'getByRole, web-first assertions, fixtures', 'POM + Cucumber, config and CI'],
    picks: [
      ['playwright', 'BEGINNER'],
      ['playwright', 'INTERMEDIATE'],
      ['playwright', 'ADVANCED'],
    ],
  },
  {
    stage: 9,
    weeks: 'Week 16',
    title: 'Expert & Interview Ready',
    goal: 'Expert problems plus the full interview set: explain your framework and answer follow-ups with real-project stories.',
    focus: ['Expert design and refactoring problems', 'Live-coding rounds', '"Explain your framework" and follow-ups'],
    picks: [
      ['java', 'EXPERT'],
      ['locators', 'EXPERT'],
      ['selenium', 'EXPERT'],
      ['pom', 'EXPERT'],
      ['cucumber', 'EXPERT'],
      ['framework', 'EXPERT'],
      ['restassured', 'EXPERT'],
      ['playwright', 'EXPERT'],
      ['debugging', 'EXPERT'],
      ['interview', 'BEGINNER'],
      ['interview', 'INTERMEDIATE'],
      ['interview', 'ADVANCED'],
      ['interview', 'EXPERT'],
    ],
  },
]

const CAT_ORDER = ['java', 'locators', 'selenium', 'pom', 'cucumber', 'framework', 'restassured', 'playwright', 'debugging', 'interview']

export function phaseProblems(phase, problems) {
  const pickIndex = (p) => phase.picks.findIndex(([cat, level]) => p.category === cat && p.level === level)
  return problems
    .filter((p) => pickIndex(p) !== -1)
    .sort((a, b) => pickIndex(a) - pickIndex(b) || CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || a.id.localeCompare(b.id))
}

export const currentStage = (phases) => phases.find((ph) => ph.done < ph.list.length) ?? null
