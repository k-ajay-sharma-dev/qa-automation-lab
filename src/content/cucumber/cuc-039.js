export default {
  id: 'cuc-039',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Scenario independence and test data per scenario',
  level: 'INTERMEDIATE',
  tags: ['independence', 'test-data', 'parallel', 'hooks'],
  estMinutes: 10,
  scenario: `The ShopEasy suite is green when run in file order, but since the team switched on parallel execution three cart scenarios fail
randomly. The root cause in every case: scenarios that rely on each other or share the same data. Your lead asks you to explain the
rules to the team.`,
  description: 'Pick the best answer for each situation.',
  questions: [
    {
      q: 'Scenario A adds "Trailblazer Backpack" to the cart. Scenario B, right below it, starts with `Given the shopper is on the cart page` and checks the backpack is listed. What is wrong?',
      options: [
        'Nothing — Cucumber always runs scenarios top to bottom',
        'B depends on A\'s side effects; B must set up its own cart ("Given the shopper has "Trailblazer Backpack" in the cart")',
        'B should be merged into A as a second When',
        'A should be tagged @first',
      ],
      answer: 1,
      why: 'Each scenario must create the state it needs. Run B alone, with --tags, in a rerun of failures or in parallel and the cart is empty. Order is not a contract.',
    },
    {
      q: 'Two scenarios run in parallel and both register the seller `asha@example.com`. One fails with "email already registered". Best fix?',
      options: [
        'Disable parallel execution',
        'Add a retry',
        'Generate unique data per scenario (e.g. `asha+<uuid>@example.com`) inside the step definition or a data factory',
        'Run the registration scenario twice',
      ],
      answer: 2,
      why: 'Shared fixed data creates collisions. Unique data per scenario (timestamp/UUID suffix) keeps scenarios isolated without slowing the suite. Retries only hide the problem.',
    },
    {
      q: 'Where should "log in as standard_user and empty the cart" live so every cart scenario starts clean?',
      options: [
        'At the end of each previous scenario',
        'In a Background (or a tagged @Before hook) so it runs before EACH scenario',
        'In a separate scenario called "Reset" placed first in the file',
        'In the runner class constructor',
      ],
      answer: 1,
      why: 'Background and @Before run before every scenario, so each one is self-sufficient. Clean-up at the end of a previous scenario is skipped when that scenario fails — and then the next one inherits dirty state.',
    },
    {
      q: 'A step-definition class keeps `private static String orderId;` so a later scenario can check the order. Why is this dangerous?',
      options: [
        'static fields are slower',
        'Static state leaks between scenarios (and threads); Cucumber creates new step objects per scenario precisely to avoid that',
        'Cucumber forbids static fields',
        'It is fine if the field is final',
      ],
      answer: 1,
      why: 'Cucumber instantiates glue classes fresh for every scenario; static fields bypass that and survive. Share data within one scenario via PicoContainer-injected context, never across scenarios.',
    },
    {
      q: 'How do you quickly prove that a feature file has no hidden order dependency?',
      options: [
        'Run it twice in the same order',
        'Run single scenarios on their own (by line number or tag) and run the suite in random order / in parallel',
        'Read the step definitions',
        'Add Thread.sleep between scenarios',
      ],
      answer: 1,
      why: 'Running `mvn test -Dcucumber.features=src/test/resources/features/cart.feature:12` or with `cucumber.execution.order=random` exposes scenarios that only pass after their neighbours.',
    },
  ],
  hints: ['Imagine running only this one scenario on a fresh browser. Does it still pass?', 'Fixed data + parallel = collisions.'],
  explanation: `The independence rules every Cucumber team should agree on:

1. **Every scenario sets up its own state** in Given/Background/@Before — never relies on the scenario above it.
2. **Data is unique per scenario** when the system stores it (users, orders, emails); read-only reference data (product "Pulse Bike Light") can be shared.
3. **No static state** in glue; share within a scenario via dependency injection.
4. **Verify** with single-scenario runs, random order and parallel runs.

These are the same rules you used manually ("each test case has its own preconditions") — automation just punishes breaking them faster.`,
  mistakes: [
    'Cleaning up at the end of a scenario instead of setting up at the start — a failure skips the clean-up.',
    'Hard-coding one email/user for every scenario and then wondering why parallel runs collide.',
    'Using static fields in step classes to pass data from one scenario to the next.',
  ],
  interview: [
    { q: 'Why does a rerun of failed scenarios (rerun.txt) expose dependency bugs?', a: 'The rerun executes only the failed scenarios, without the ones before them. Any scenario that relied on a predecessor\'s state fails again, now consistently.' },
    { q: 'How do you create unique test data without making the feature file unreadable?', a: 'Keep the readable value in Gherkin ("a new seller Asha") and let a data factory in the step definition add a UUID/timestamp suffix, storing the generated value in the scenario context for later steps.' },
  ],
}
