# QA Automation Practice Lab — content schema

Audience: a manual QA engineer with ~6 years of experience who knows testing very well
(test design, defects, regression, UAT) but has little *hands-on* automation experience.
Write like a senior SDET mentoring them on a real project: every problem starts from a
**real project situation** ("Sprint 14: the login page got a redesign and 30 tests broke…"),
not a textbook definition. Use Java 17, Selenium 4, Cucumber 7 (io.cucumber), TestNG 7, Maven.

Every problem is one file: `src/content/<category>/<id>.js` with a default export.
IDs are `<prefix>-NNN` (3 digits) and must match the file name.

## Common fields (all kinds)

```js
export default {
  id: 'sel-001',
  category: 'selenium',            // folder name
  kind: 'code',                    // 'code' | 'gherkin' | 'locator' | 'quiz'
  title: 'Log in and verify the dashboard',
  level: 'BEGINNER',               // BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
  tags: ['webdriver', 'waits'],
  estMinutes: 15,
  scenario: `markdown — the real-project situation (2–4 sentences, who/what/why)`,
  description: `markdown — exactly what to do, with a **Rules** / **Acceptance** list`,
  hints: ['short hint 1', 'short hint 2'],          // 1–3, progressively stronger
  explanation: `markdown — why the solution works, what a reviewer looks for`,
  mistakes: ['common mistake beginners make', '...'], // 2–4 real-world pitfalls
  interview: [                                      // 2–4 follow-up questions an interviewer asks
    { q: 'Why not Thread.sleep?', a: 'Short model answer (2–4 sentences).' },
  ],
}
```

## kind: 'code' (Java or TypeScript) and kind: 'gherkin' (feature files)

```js
  language: 'java',                // 'java' | 'typescript' | 'gherkin'
  starterCode: `...`,              // compiles-looking skeleton with TODOs
  solution: `...`,                 // complete, idiomatic, production-quality answer
  checks: [                        // graded in the browser with JS regex on the learner's code
    { label: 'Uses an explicit wait', pattern: 'WebDriverWait', hint: 'Wrap the find in new WebDriverWait(...)' },
    { label: 'No Thread.sleep', pattern: 'Thread\\.sleep', mustNot: true, hint: 'Hard sleeps make tests slow and flaky' },
  ],
```

* `pattern` is a JS RegExp **source string** (escape backslashes for a JS string). Flags default to `'m'`;
  add `flags: 'ms'` etc. if needed. Comments are stripped (`//…` and `/*…*/` for java and typescript, `#…` lines for gherkin)
  before checking, so a learner can't pass by writing the keyword in a comment.
* 3–7 checks. Checks test *ideas* (uses explicit wait, locator is private, step has a parameter), be lenient
  about formatting/whitespace (`\\s*`), accept reasonable alternatives (`(By\\.id|By\\.cssSelector)`).
* The `solution` MUST pass every check, and the `starterCode` MUST fail at least one.
  Run `node scripts/check-content.mjs` from the project root to verify.

## kind: 'locator' (live graded in the browser against the practice site)

```js
  page: 'login.html',              // a file under public/practice-site/
  strategy: 'css',                 // 'css' | 'xpath' | 'either'
  expected: '#login-form button[type=submit]',  // CSS selector that matches EXACTLY the right element(s) (ground truth)
  expectedCount: 1,                // how many elements the learner's locator must match
  solution: `css: ...  /  xpath: ... and the Java By.… line`,
```
The app runs the learner's selector inside the practice page and passes when it matches exactly
the same element set as `expected`. Absolute XPaths (`/html/...`) and pure index locators get a warning.

## kind: 'quiz'

```js
  questions: [
    {
      q: 'markdown question (may contain a fenced java code block)',
      options: ['A', 'B', 'C', 'D'],
      answer: 1,                   // index into options
      why: 'markdown: why this is right and why the others are wrong',
    },
  ],                               // 3–6 questions per quiz problem
```
Quiz problems still have scenario/description/explanation/interview (description can be short).

## Cheat sheets

`src/cheatsheets/<slug>.js`: `export default { slug, title, sections: [{ heading, body /* markdown */ }] }`.

## Style rules

* Markdown in template literals: escape backticks as \` and `${` as \${ .
* Keep code realistic: proper packages, imports where useful, meaningful names, no `Thread.sleep` in solutions
  (unless a quiz is showing it as the wrong answer).
* Levels across a category: roughly 35% BEGINNER, 35% INTERMEDIATE, 20% ADVANCED, 10% EXPERT.
