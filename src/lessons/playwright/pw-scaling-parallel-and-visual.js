export default {
  slug: 'pw-scaling-parallel-and-visual',
  category: 'playwright',
  order: 10,
  title: 'Scaling the suite: parallel workers, sharding, isolation and visual comparisons',
  minutes: 9,
  summary: 'Run a large suite fast and reliably with workers, fullyParallel and sharding, keep tests independent, manage known issues with annotations, and catch layout regressions with toHaveScreenshot.',
  manualAnalogy: `A regression cycle with ten testers works only if each tester has their own test data and their own checklist — if two people share one account, they overwrite each other's cart. Parallel automation is the same. And a manual tester notices at a glance that a button overlaps the total; functional assertions never will — that is what screenshot comparisons are for.`,
  body: `## How Playwright runs tests in parallel

- **Workers** are separate OS processes, each with its own browser. \`workers: 4\` → four tests at a time.
- By default **files** are spread across workers and the tests inside one file run in order.
- \`fullyParallel: true\` (or \`test.describe.configure({ mode: 'parallel' })\` in one file) spreads individual tests.
- Every test gets a fresh **browser context**, so cookies and storage never leak between tests.

What Playwright cannot isolate for you is **data on the server**. If two tests use the same account, the same coupon or the same order,
they will collide as soon as they run at the same time — or when one is retried alone in a new worker.

## Independent tests

Rules that make parallelism, retries and \`--grep\` safe:

1. A test creates the data it needs (API or fixture) — it never relies on another test having run first.
2. Data is unique: include \`testInfo.workerIndex\`, a timestamp or a UUID in names.
3. No global resets of shared environments from inside tests.
4. \`test.describe.configure({ mode: 'serial' })\` only for steps that truly cannot be separated — a failure skips the rest of the group.

Expensive setup that can be shared within one worker goes into a **worker-scoped fixture**:

\`\`\`ts
export const test = base.extend<{}, { seller: string }>({
  seller: [async ({}, use, workerInfo) => {
    const username = 'seller_' + workerInfo.workerIndex + '_' + Date.now();
    // …create the seller once for this worker…
    await use(username);
  }, { scope: 'worker' }],
});
\`\`\`

## Sharding across machines

One machine has a limited number of CPUs. Sharding splits the suite between machines:

\`\`\`bash
npx playwright test --shard=2/4 --reporter=blob     # on machine 2 of 4
npx playwright merge-reports --reporter html ./all-blob-reports   # in a final job
\`\`\`

In GitHub Actions this is a matrix (\`shardIndex: [1, 2, 3, 4]\`), an \`upload-artifact\` of each \`blob-report\` folder, and a last job
that downloads them all and merges one HTML report.

## Annotations and tags

| Annotation | Runs? | Use for |
|---|---|---|
| \`test.skip(condition, reason)\` | no | not applicable here (e.g. a WebKit-only limitation) |
| \`test.fixme(reason)\` | no | test itself needs work |
| \`test.fail(condition, reason)\` | yes, expected to fail | known product bug — alerts you when it is fixed |
| \`test.slow()\` | yes, triple timeout | known slow flows |

Tags select subsets: \`test('checkout', { tag: ['@smoke'] }, async ({ page }) => …)\` and \`npx playwright test --grep @smoke\`.
To hunt flakiness: \`--repeat-each=20 --retries=0\`.

## Visual comparisons with toHaveScreenshot

\`\`\`ts
// inventory.html — the greeting shows whoever is logged in, so it is masked
await expect(page).toHaveScreenshot('products-page.png', {
  mask: [page.getByTestId('logged-in-user')],
});
\`\`\`

- The first run writes the **baseline** next to the test (and fails on purpose). Review and commit it.
- Later runs take screenshots until the UI is stable, compare with the baseline, and attach *expected / actual / diff* to the report.
- **Remove noise**: \`animations: 'disabled'\`, a fixed \`viewport\`, \`mask\` for dynamic content (dates, random ids), a small
  \`maxDiffPixelRatio\`. Set defaults once in \`expect: { toHaveScreenshot: { … } }\`.
- **Same environment for baseline and comparison**: fonts render differently on macOS, Windows and Linux. Generate baselines in the
  official Playwright Docker image that CI uses; \`snapshotPathTemplate\` controls where they live (include \`{projectName}\`).
- Update deliberately: \`npx playwright test --update-snapshots\` after an approved design change — the image diff in the pull request is the review.
- Assert the functional state first (the heading is there, the spinner is gone), then take the screenshot.`,
  keyPoints: [
    'workers = processes; files run in parallel by default; fullyParallel also splits tests inside files.',
    'Contexts isolate the browser; you must isolate server data — unique, test-owned data.',
    'Shard with --shard=N/M, blob reports and merge-reports for one HTML report.',
    'test.fail for known bugs keeps the test running; skip/fixme do not.',
    'toHaveScreenshot needs stable conditions: masks, disabled animations, fixed viewport, baselines from the CI environment.',
  ],
  mistakes: [
    'Turning on fullyParallel while tests still depend on each other.',
    'Retries as a cure for order-dependent tests.',
    'Visual baselines created on a laptop and compared on Linux CI.',
    'Accepting --update-snapshots without reviewing the diff.',
  ],
  tryIt: `Open \`http://localhost:5180/practice-site/waits.html\` twice in two tabs and click *Refresh prices* in one of them. Which parts of the page would make a full-page screenshot differ between two runs, and which locators would you mask?`,
  problems: ['pw-031', 'pw-032'],
}
