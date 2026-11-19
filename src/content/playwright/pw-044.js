export default {
  id: 'pw-044',
  category: 'playwright',
  kind: 'quiz',
  title: 'Screenshots, videos or traces: what to collect when a test fails',
  level: 'ADVANCED',
  tags: ['trace', 'screenshot', 'video', 'config', 'ci', 'debugging'],
  estMinutes: 12,
  scenario: `The ShopEasy CI job uploads 3 GB of artifacts per run because someone set \`video: 'on'\` and \`trace: 'on'\` "to be safe", and
the storage bill reached the engineering manager. At the same time developers complain that a failure screenshot alone does not explain
why the checkout test failed. You own the artifact strategy.`,
  description: 'Choose the best answer for each artifact question.',
  questions: [
    {
      q: 'A checkout test failed in CI with *expected "Thank you for your order!" but got ""*. Which artifact lets a developer see the DOM, network calls and console at every step?',
      options: ['The failure screenshot', 'The video', 'The trace (opened with npx playwright show-trace or in the HTML report)', 'The JUnit XML'],
      answer: 2,
      why: "A trace records each action with before/after DOM snapshots, network requests and responses, console logs and source lines. A screenshot shows only the final pixels; a video shows motion but not why — e.g. that the Finish click never reached the button or a request failed.",
    },
    {
      q: 'Which `use` settings give good failure evidence at low cost on CI with `retries: 2`?',
      options: [
        "trace: 'on', video: 'on', screenshot: 'on'",
        "trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure'",
        "trace: 'off', screenshot: 'off', video: 'off'",
        "trace: 'retain-on-failure' locally only",
      ],
      answer: 1,
      why: "on-first-retry records a trace only when a test is retried (i.e. it already failed once), so passing tests cost nothing. Screenshots on failure are cheap. retain-on-failure records video but deletes it for passing tests. Everything 'on' produces gigabytes for green tests.",
    },
    {
      q: "With `trace: 'on-first-retry'` and `retries: 0` locally, a test fails. Is there a trace?",
      options: [
        'Yes, always',
        'No — there was no retry. Use --trace on (or retain-on-failure) when you need one locally',
        'Only in headed mode',
        'Only if the test uses page.pause()',
      ],
      answer: 1,
      why: "on-first-retry depends on retries. Locally run npx playwright test --trace on, or use 'retain-on-failure' in that environment.",
    },
    {
      q: 'When is a **video** the most useful artifact?',
      options: [
        'To read the response body of an API call',
        'To show non-technical stakeholders (or yourself) the visual flow — animations, flicker, an overlay covering a button — over time',
        'To compare pixels against a baseline',
        'To replace assertions',
      ],
      answer: 1,
      why: 'Video shows motion and timing visually, which helps with UI glitches and demos. It does not contain DOM or network data — the trace is the debugging tool; toHaveScreenshot is the visual-regression tool.',
    },
    {
      q: 'In a test you want a screenshot of only the checkout overview (`data-testid="checkout-step-two"`), attached to the HTML report. Which code?',
      options: [
        "await page.screenshot({ path: 'summary.png', fullPage: true });",
        "await testInfo.attach('order summary', { body: await page.getByTestId('checkout-step-two').screenshot(), contentType: 'image/png' });",
        "await expect(page).toHaveScreenshot();",
        'console.log(await page.content());',
      ],
      answer: 1,
      why: "locator.screenshot() captures just that element, and testInfo.attach puts it in the report next to the test. page.screenshot with a path writes a file nobody links to; toHaveScreenshot is an assertion against a baseline, not evidence capture.",
    },
  ],
  hints: ['Trace = why (DOM, network, console). Screenshot = what it looked like at the end. Video = how it moved.'],
  explanation: `The three artifacts answer different questions:
- **Trace** — *why* it failed: per-action DOM snapshots, network, console, timings. The main debugging tool.
- **Screenshot** — *what* the page looked like at failure; cheap, good for a quick glance in the report.
- **Video** — *how* it moved; useful for animations, overlays and demos, expensive to store.

A typical CI setup is \`trace: 'on-first-retry'\`, \`screenshot: 'only-on-failure'\`, \`video: 'retain-on-failure'\` (or off), with the
HTML report uploaded using \`if: always()\`. Attach targeted evidence with \`testInfo.attach\` when a step needs it.`,
  mistakes: [
    "Setting trace/video to 'on' for every test in CI — huge artifacts for green tests.",
    "Expecting a trace locally with 'on-first-retry' while retries is 0.",
    'Debugging from a screenshot alone when the trace would show the failing API response.',
    'Confusing page.screenshot() (evidence) with toHaveScreenshot() (visual assertion).',
  ],
  interview: [
    { q: 'What do you configure for failure diagnostics in Playwright CI?', a: "trace on first retry, screenshot only on failure, video retained on failure if the team needs it, the HTML report as an artifact uploaded even when the job fails, and retries: 2 on CI only." },
    { q: 'How do you debug a CI-only failure?', a: 'Download the report artifact, open the trace, step through the actions comparing DOM snapshots and network responses around the failing step, and check console errors. Then reproduce locally with --repeat-each or CPU throttling if it is timing.' },
  ],
}
