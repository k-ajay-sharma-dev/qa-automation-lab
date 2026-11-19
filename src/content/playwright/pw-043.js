export default {
  id: 'pw-043',
  category: 'playwright',
  kind: 'quiz',
  title: 'test.only, skip, fixme and forbidOnly: the night CI ran one test',
  level: 'ADVANCED',
  tags: ['annotations', 'test.only', 'test.skip', 'test.fixme', 'forbidOnly', 'ci'],
  estMinutes: 10,
  scenario: `Monday stand-up: the nightly ShopEasy regression reported **1 passed** for the whole weekend. Someone had committed a
\`test.only\` while debugging the checkout spec, and the other 214 tests never ran — green build, zero coverage. You are asked to explain
the focus/skip annotations to the team and make sure it cannot happen again.`,
  description: 'Choose the best answer for each annotation question.',
  questions: [
    {
      q: 'Why is a committed `test.only` so dangerous?',
      options: [
        'It makes the test run twice',
        'Playwright runs only the focused test(s) and silently skips the rest, so CI is green while almost nothing was tested',
        'It fails the build immediately',
        'It only affects the local machine',
      ],
      answer: 1,
      why: 'only is a local debugging focus. Committed, it narrows the whole run without failing it — the worst kind of failure, a false green.',
    },
    {
      q: 'Which config line makes CI fail if any `.only` slipped in, but still lets you use it locally?',
      options: [
        'retries: process.env.CI ? 2 : 0',
        'forbidOnly: !!process.env.CI',
        "grep: /@only/",
        'fullyParallel: true',
      ],
      answer: 1,
      why: 'forbidOnly makes the run exit with an error listing the focused tests. Tying it to the CI variable keeps the local debugging workflow. A lint rule (eslint-plugin-playwright no-focused-test) catches it even earlier, in the PR.',
    },
    {
      q: 'The Apple Pay button only exists on WebKit. How do you skip the test on the other browsers and say why?',
      options: [
        'Comment the test out',
        "test.skip(browserName !== 'webkit', 'Apple Pay is WebKit only'); at the start of the test",
        "test.only(browserName === 'webkit')",
        'Wrap the body in if (browserName === \'webkit\') { ... }',
      ],
      answer: 1,
      why: "Conditional test.skip(condition, reason) marks the test as skipped (visible in the report with the reason). An if-block would report a pass that tested nothing; commenting out hides it from the report entirely.",
    },
    {
      q: 'The *Retro Red Tee* checkout test is broken by bug SHOP-812 and is so slow that it times out. You do not want it to run at all until the fix, but it must stay visible in the report. Which annotation?',
      options: ['test.fail', 'test.fixme', 'test.slow', 'test.only'],
      answer: 1,
      why: "test.fixme marks the test as 'needs fixing' and does not run it. test.fail would still run it (and expect it to fail — useful when you want an alert once the bug is fixed, but not for a slow, hanging test). test.slow triples the timeout.",
    },
    {
      q: 'What is the difference between `test.skip(...)` and `test.describe.skip(...)` here?\n\n```ts\ntest.describe.skip(\'guest checkout\', () => { /* 6 tests */ });\n```',
      options: [
        'None, they are aliases',
        'describe.skip skips every test in the group; test.skip skips a single test (or, called inside a test/hook, the current one)',
        'describe.skip deletes the tests from the report',
        'describe.skip only works in Cucumber',
      ],
      answer: 1,
      why: 'Annotations exist on test and on test.describe. Group-level skips are handy for a feature behind a disabled flag, but always add a reason and a ticket so the skip does not become permanent.',
    },
  ],
  hints: ['only = focus (never commit), skip = not applicable, fixme = broken, do not run, fail = broken, run and expect failure.'],
  explanation: `Annotations change **what runs** and how it is reported:
- \`test.only\` — focus for local debugging; guard it with \`forbidOnly: !!process.env.CI\` and a lint rule.
- \`test.skip(condition, reason)\` — the test does not apply (browser, platform, feature flag).
- \`test.fixme\` — known broken, do not run; shows up as skipped with a "fixme" marker.
- \`test.fail\` — known broken, run it and expect failure; turns red when the bug is fixed.

Every skip/fixme should carry a reason and a ticket number, and the team should review the skipped count in the report, because a skipped
test is silent coverage loss.`,
  mistakes: [
    'Committing test.only without forbidOnly in the config — false green builds.',
    'Using if-blocks inside a test instead of test.skip — reports a pass that checked nothing.',
    'Skipping tests without a reason or ticket, so they stay skipped for months.',
  ],
  interview: [
    { q: 'How do you prevent focused tests from reaching CI?', a: 'forbidOnly: !!process.env.CI in playwright.config.ts so CI fails on any .only, plus the eslint-plugin-playwright no-focused-test rule in the PR pipeline.' },
    { q: 'test.skip vs test.fixme vs test.fail?', a: "skip: the test does not apply in this condition. fixme: it is broken, don't run it. fail: it is broken, run it and expect a failure, so you notice the moment it starts passing." },
    { q: 'How do you keep track of skipped tests?', a: 'Require a reason and ticket in each annotation, watch the skipped count in the HTML report or dashboard, and review it in the sprint like any other tech debt.' },
  ],
}
