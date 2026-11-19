export default {
  id: 'pw-031',
  category: 'playwright',
  kind: 'quiz',
  title: 'Parallel runs, sharding, isolation and annotations',
  level: 'ADVANCED',
  tags: ['parallel', 'workers', 'sharding', 'test-isolation', 'annotations', 'tags', 'ci'],
  estMinutes: 15,
  scenario: `The suite has grown to 1,200 tests and the nightly run takes 48 minutes on one CI machine. The manager wants results before the
morning stand-up, two developers want to "just turn parallel on everywhere", and a handful of tests started failing only when run together.
You are leading the design session on how the suite should scale.`,
  description: 'Pick the answer you would defend in the design session.',
  questions: [
    {
      q: 'The config has `workers: 4` and **no** `fullyParallel`. There are 3 spec files with 10 tests each. How do they run?',
      options: [
        'All 30 tests run at the same time',
        'Files are distributed across workers and run in parallel with each other; the tests inside one file run one after another in the same worker',
        'Everything runs sequentially because fullyParallel is off',
        'Each test gets its own worker process',
      ],
      answer: 1,
      why: 'By default Playwright parallelises by file. fullyParallel: true (or test.describe.configure({ mode: \'parallel\' }) per file) also splits the tests inside a file across workers. Every worker is a separate process with its own browser.',
    },
    {
      q: '`coupon.spec.ts`: test 1 creates the coupon *SPRING10* through the UI, test 2 applies it. Green locally, red in CI after `fullyParallel: true` was enabled. What is the right fix?',
      options: [
        'Set retries: 3 so test 2 eventually runs after test 1',
        "Make test 2 independent: create the coupon it needs itself (via API or a fixture) — use test.describe.configure({ mode: 'serial' }) only when the steps truly cannot be separated",
        'Rename the tests so that test 1 sorts first',
        'Set workers: 1 for the whole suite',
      ],
      answer: 1,
      why: 'Order-dependent tests break with parallelism, retries (a retried test 2 runs in a new worker without test 1) and filtering (-g runs test 2 alone). Each test should arrange its own data. Serial mode exists, but it makes the group slower and one failure skips the rest.',
    },
    {
      q: 'To cut the 48 minutes, you split the run over 4 GitHub Actions machines. Which setup gives one combined HTML report?',
      options: [
        'Run npx playwright test on each machine and upload four playwright-report folders',
        "A matrix with shardIndex 1–4 running npx playwright test --shard=N/4 with the blob reporter, upload each blob-report as an artifact, then a final job downloads them and runs npx playwright merge-reports --reporter html",
        'Use workers: 16 on one machine',
        'Split the spec files into four folders by hand and run one folder per machine',
      ],
      answer: 1,
      why: '--shard splits the tests evenly across machines (with fullyParallel the split is per test, otherwise per file). The blob reporter stores raw results so merge-reports can build a single HTML report. Hand-made folders drift out of balance; more workers on one machine is limited by its CPU and memory.',
    },
    {
      q: 'Every test needs a registered API customer, and creating one takes 2 seconds. Tests in the same worker may share one customer, but different workers must not. What do you use?',
      options: [
        'A test-scoped fixture',
        "A worker-scoped fixture ({ scope: 'worker' }) that creates one customer per worker, with workerInfo.workerIndex in the username",
        'A global variable set in the first test',
        'beforeAll in every spec file',
      ],
      answer: 1,
      why: 'Worker-scoped fixtures are created once per worker process and torn down when it exits, so the cost is paid 4 times with 4 workers instead of 1,200 times. workerIndex keeps the data unique per worker. beforeAll per file would repeat the work per file; globals leak and break with retries.',
    },
    {
      q: "Bug SHOP-740 breaks the *Retro Red Tee* checkout test. The fix is two sprints away. You want CI green, the test still running, and an alert when the bug is fixed. Which annotation?",
      options: [
        "test.skip('SHOP-740')",
        "test.fixme('SHOP-740')",
        "test.fail(true, 'SHOP-740') — the test runs, is expected to fail, and turns red if it unexpectedly passes",
        'Delete the test and re-create it later',
      ],
      answer: 2,
      why: 'skip and fixme do not run the test, so nobody notices when the bug is fixed (or when the test breaks for another reason). test.fail inverts the result and keeps the test executing. Always reference the ticket in the description.',
    },
    {
      q: 'You suspect `checkout.spec.ts` is flaky. Which command reproduces a timing problem fastest on your laptop?',
      options: [
        'npx playwright test checkout.spec.ts --headed',
        'npx playwright test checkout.spec.ts --repeat-each=20 --workers=4 --retries=0',
        'npx playwright show-report',
        "npx playwright test --grep '@smoke'",
      ],
      answer: 1,
      why: 'Running the same test many times in parallel (load on the machine changes timing) and without retries shows the failure rate and gives traces of real failures. Tags (test(\'…\', { tag: \'@smoke\' }) + --grep @smoke) are for choosing what to run, not for finding flakiness.',
    },
  ],
  hints: ['Scale only works when every test can run alone, in any order, on any worker.'],
  explanation: `Scaling a Playwright suite is mostly a **test design** problem, not a configuration problem:

| Lever | What it does | Precondition |
|---|---|---|
| \`workers\` | parallel processes on one machine | tests do not share mutable data |
| \`fullyParallel\` | split tests inside a file too | no order dependencies inside files |
| \`--shard=N/M\` + blob reports + \`merge-reports\` | split across machines, one report | same as above |
| worker-scoped fixtures | pay expensive setup once per worker | data unique per worker (\`workerIndex\`) |
| \`test.fail\` / \`fixme\` / \`skip\`, tags + \`--grep\` | manage known issues and subsets | ticket ids in descriptions |

The isolation rules: every test gets a fresh browser context (Playwright does that), **and** every test owns its data (you do that).
Shared accounts, shared carts and "test 2 uses what test 1 created" are what break when you turn parallelism on.`,
  mistakes: [
    'Turning on fullyParallel before removing order dependencies between tests.',
    'Using retries to hide tests that depend on each other.',
    'Sharding without blob reports — four separate HTML reports nobody merges.',
    'Skipping tests for known bugs without a ticket and without test.fail — they are forgotten.',
  ],
  interview: [
    { q: 'How does Playwright parallelise tests?', a: 'It starts several worker processes (workers setting). By default each spec file runs in one worker and files run in parallel; fullyParallel spreads individual tests. Each worker has its own browser, and each test its own context.' },
    { q: 'What is sharding and how do you get one report?', a: 'Splitting the suite across machines with --shard=index/total. Each shard uses the blob reporter; a final CI job downloads all blob reports and runs npx playwright merge-reports to produce one HTML report.' },
    { q: 'How do you make tests independent?', a: 'No shared mutable data: each test creates what it needs (via API or fixtures), uses unique identifiers, does not rely on execution order, and cleans up or uses disposable data. Fresh browser contexts handle browser state.' },
  ],
}
