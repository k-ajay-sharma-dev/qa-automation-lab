// kind of exercise per problem: 'code' (Java, rule-checked), 'gherkin' (feature file, rule-checked),
// 'locator' (live-graded against the practice site), 'quiz' (multiple choice with explanations).
export const CATEGORIES = [
  {
    slug: 'java',
    eyebrow: 'write code · rule checks',
    label: 'Core Java for Testers',
    blurb: 'Only the Java an automation engineer really uses — Strings, collections, OOP, exceptions — always in a test-automation situation.',
  },
  {
    slug: 'locators',
    eyebrow: 'live graded on a real page',
    label: 'Locator Lab',
    blurb: 'Write CSS selectors and XPath against the ShopEasy practice site and see what they match, instantly.',
  },
  {
    slug: 'selenium',
    eyebrow: 'write code · rule checks',
    label: 'Selenium WebDriver',
    blurb: 'Selenium 4 with Java: waits, dropdowns, alerts, frames, windows, Actions, JS executor, tables and screenshots.',
  },
  {
    slug: 'pom',
    eyebrow: 'design · refactor',
    label: 'Page Object Model',
    blurb: 'Structure tests the way real teams do: page classes, BasePage, components, DriverFactory and clean tests.',
  },
  {
    slug: 'cucumber',
    eyebrow: 'gherkin · step definitions',
    label: 'Cucumber BDD',
    blurb: 'Turn manual test cases into Gherkin, write step definitions, hooks, data tables, tags and runners.',
  },
  {
    slug: 'framework',
    eyebrow: 'testng · maven · ci',
    label: 'Framework & CI',
    blurb: 'TestNG, Maven, config, data-driven tests, listeners, reports, parallel runs and Jenkins / GitHub Actions.',
  },
  {
    slug: 'debugging',
    eyebrow: 'real-time · diagnose · fix',
    label: 'Debugging Clinic',
    blurb: 'Failing tests with real stack traces and Jenkins logs. Diagnose the cause and fix it — the real-time experience.',
  },
  {
    slug: 'interview',
    eyebrow: 'quiz · live coding',
    label: 'Interview Ready',
    blurb: 'The questions asked to experienced QA automation candidates, with model answers phrased from a real project.',
  },
]

export const categoryBySlug = new Map(CATEGORIES.map((c) => [c.slug, c]))

export const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

export const STATUSES = [
  { value: 'not-started', label: 'Not started' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'solved', label: 'Solved' },
  { value: 'revisit', label: 'Revisit' },
]

export const KIND_LABELS = { code: 'Java', gherkin: 'Gherkin', locator: 'Locator', quiz: 'Quiz' }
