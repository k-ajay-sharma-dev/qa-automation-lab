export default {
  id: 'api-044',
  category: 'restassured',
  kind: 'quiz',
  title: 'Test data cleanup strategies for API suites',
  level: 'EXPERT',
  tags: ['test-data', 'cleanup', 'isolation', 'framework-design'],
  estMinutes: 15,
  scenario: `The ShopEasy API suite now runs on every pull request, in parallel, against a shared QA environment. Every night
it leaves hundreds of registered users and orders behind, and twice this month a test failed because another test's
cart item was still there (409 ITEM_ALREADY_IN_CART). The team asks you, as the API framework owner, to define the
test data and cleanup strategy.`,
  description: `Locally, \`POST /api/reset\` restores the seed data and drops all tokens, carts, orders and registered users.
\`POST /api/users\` registers a new customer (unique username), \`DELETE /api/cart\` empties the caller's cart (204,
also when already empty).`,
  questions: [
    {
      q: 'The suite runs with 8 parallel threads. A teammate adds `POST /api/reset` to `@BeforeMethod`. What happens?',
      options: [
        'Nothing bad — every test starts clean',
        'Tests break each other: one thread\'s reset wipes the tokens, carts and orders another thread is using mid-test',
        'Reset is faster, so the suite speeds up',
        'Only the first test is affected',
      ],
      answer: 1,
      why: `A global reset is **global**: it invalidates every token and cart in the system, including those of tests running at the same moment. It is fine for a single-threaded local run (or once in \`@BeforeSuite\`), never per test in parallel — and never on a shared environment.`,
    },
    {
      q: 'Which approach gives parallel API tests **isolation** without a global reset?',
      options: [
        'All tests log in as standard_user and run in a fixed order',
        'Each test registers its own customer with `POST /api/users` (unique username, e.g. a UUID suffix) and only touches that customer\'s cart and orders',
        'Add retries until the 409 goes away',
        'Use Thread.sleep between tests',
      ],
      answer: 1,
      why: `**Every test owns its data**: a unique user means its own cart and orders, so no other thread can collide with it. Shared accounts plus ordering creates hidden dependencies; retries and sleeps only hide the problem.`,
    },
    {
      q: 'A test adds an item to its cart and then an assertion fails. Where should the cleanup live so it still runs?',
      options: [
        'At the end of the test method, after the assertions',
        'In `@AfterMethod(alwaysRun = true)` (or a Cucumber `@After` hook), e.g. `DELETE /api/cart` for that test\'s token',
        'In a comment reminding people to clean up',
        'In `@BeforeSuite`',
      ],
      answer: 1,
      why: `Code after a failing assertion never runs. Teardown in an \`alwaysRun\` after-hook executes whether the test passed or failed. \`DELETE /api/cart\` is idempotent (204 even when empty), so the cleanup itself cannot fail the run.`,
    },
    {
      q: 'Orders cannot be deleted through the ShopEasy API. How do you keep order tests reliable?',
      options: [
        'Assert "the user has exactly 1 order" with the shared standard_user',
        'Assert on the order you created (by the id from the 201 response / Location header), or use a fresh user whose order list starts empty',
        'Skip order tests on the shared environment',
        'Ask the DBA to truncate the orders table before each run',
      ],
      answer: 1,
      why: `When data cannot be cleaned up, design **assertions that tolerate leftovers**: look up *your* order by id, or count orders only for a user created for this test. "Exactly N orders" on a shared account breaks as soon as anything else ran before.`,
    },
    {
      q: 'Which statement about cleanup strategies is the best overall policy for this team?',
      options: [
        'Always clean up by resetting the whole database after every test',
        'Never clean up — data piles up but tests are faster',
        'Create unique data per test, clean up what you created in always-run teardown, tolerate what cannot be deleted, and use global reset only for local or dedicated single-run environments',
        'Rely on a nightly job to delete everything older than one day',
      ],
      answer: 2,
      why: `Isolation comes first (unique data), then **targeted** cleanup of what the test created, then assertions robust to leftovers. Global resets and nightly jobs are useful *supporting* tools in the right environment, but they cannot be the strategy for parallel runs on shared systems.`,
    },
  ],
  hints: [
    'A global reset affects every running test, not just yours.',
    'Unique data per test is the foundation of parallel safety.',
    'Teardown must run even when the test fails.',
  ],
  explanation: `The usual layered strategy for API suites:

| Layer | ShopEasy example |
|---|---|
| **Create** unique data per test | \`POST /api/users\` with \`user_\${UUID}\` |
| **Clean up** what you created, always | \`@AfterMethod(alwaysRun = true)\` → \`DELETE /api/cart\` |
| **Tolerate** what cannot be deleted | assert on *your* order id, not on counts |
| **Reset** globally only when alone | \`POST /api/reset\` in \`@BeforeSuite\` locally |

A manual tester's instinct — "set up my own test account so nobody else disturbs it" — is exactly the right one; the
framework just has to do it automatically for every test.`,
  mistakes: [
    'Calling a global reset per test in a parallel suite.',
    'Putting cleanup after the assertions in the test body.',
    'Sharing one login across all tests and asserting exact counts.',
    'Using retries to "fix" collisions caused by shared data.',
  ],
  interview: [
    { q: 'How do you manage test data for API tests running in parallel?', a: 'Each test creates its own unique data through the API (for example a new user with a UUID), works only with that data, and cleans it up in an always-run teardown. Shared seed data is read-only, and global resets are limited to single-run or dedicated environments.' },
    { q: 'What do you do when the API offers no way to delete test data?', a: 'Make tests independent of leftovers by asserting on the ids they created or on freshly created owners, tag the data so it can be found later, and agree with the team on an environment-level purge or a dedicated environment that can be reset.' },
    { q: 'Why should teardown be idempotent?', a: 'Because it runs after failures too, often when the resource was never created or is already gone. An idempotent cleanup such as DELETE that returns 204 or 404 without failing never turns one failure into a cascade.' },
  ],
}
