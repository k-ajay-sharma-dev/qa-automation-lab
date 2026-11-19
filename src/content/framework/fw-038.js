export default {
  id: 'fw-038',
  category: 'framework',
  kind: 'quiz',
  title: 'EXPERT: review a framework pull request before it reaches main',
  level: 'EXPERT',
  tags: ['code-review', 'framework-design', 'parallel', 'thread-safety', 'maintainability'],
  estMinutes: 15,
  scenario: `You are now a reviewer on the ShopEasy framework repo. A teammate's PR "Speed up suite + add checkout tests"
touches \`DriverManager\`, \`BasePage\`, a new \`CheckoutTest\` and \`testng.xml\`. CI is green. Your review decides
whether 400 tests stay stable for the next year — approve, or request changes with clear reasons.`,
  description: `For each snippet from the PR, choose the most important review comment.`,
  questions: [
    {
      q: `\`testng.xml\` now has \`parallel="methods" thread-count="6"\`. The PR also contains:

\`\`\`java
public class DriverManager {
    private static WebDriver driver;
    public static WebDriver getDriver() { return driver; }
    public static void init() { driver = new ChromeDriver(); }
}
\`\`\``,
      options: [
        'Rename driver to webDriver',
        'Blocking: a single static driver is shared by 6 threads — tests will drive each other\'s browsers. Use ThreadLocal<WebDriver> (set in @BeforeMethod, quit + remove in @AfterMethod)',
        'Use FirefoxDriver for speed',
        'Approve — CI is green',
      ],
      answer: 1,
      why: 'Green CI on one run proves little for a race condition. A static driver plus parallel methods produces random "element not found" or wrong-page failures. ThreadLocal (and remove() to avoid leaks in thread pools) is the standard fix.',
    },
    {
      q: `In \`BasePage\`:

\`\`\`java
public void click(By locator) {
    try { Thread.sleep(3000); } catch (InterruptedException e) {}
    driver.findElement(locator).click();
}
\`\`\``,
      options: [
        'Fine, 3 seconds is short',
        'Change 3000 to 1000',
        'Request changes: a hard sleep on every click adds hours to 400 tests and still is not reliable. Use an explicit wait for elementToBeClickable; and do not swallow InterruptedException',
        'Move the sleep into each test instead',
      ],
      answer: 2,
      why: 'One shared helper multiplies the cost: thousands of clicks × 3 s. Explicit waits return as soon as the condition holds and fail with a clear timeout. An empty catch also hides interruptions.',
    },
    {
      q: `In \`CheckoutTest\`:

\`\`\`java
@Test(priority = 1) public void addToCart() { ... }
@Test(priority = 2) public void checkout() { ... }   // uses the cart from addToCart
@Test(priority = 3) public void verifyOrder() { ... } // uses the order from checkout
\`\`\``,
      options: [
        'Good — priorities guarantee order',
        'Ask for independent tests: each one sets up its own state (e.g. cart via POST /api/cart/items) so it can run alone, in parallel, and fails for its own reason',
        'Use dependsOnMethods instead and approve',
        'Merge them into one 200-line test',
      ],
      answer: 1,
      why: 'Chained tests cascade: one failure hides two others, and with parallel="methods" priority ordering is not a guarantee of shared state. API set-up keeps UI tests short and independent. dependsOnMethods only makes the chain explicit.',
    },
    {
      q: 'The PR is 1,900 lines across 23 files mixing the parallel change, the BasePage helpers and the new tests. What is the best overall review outcome?',
      options: [
        'Approve to avoid blocking the teammate',
        'Request changes with specific, kind comments; suggest splitting into (1) thread-safe DriverManager + parallel config, (2) wait helpers, (3) checkout tests — and offer to pair on the first',
        'Rewrite it yourself and push to their branch',
        'Comment "LGTM" and let QA find the problems',
      ],
      answer: 1,
      why: 'Small PRs get real reviews. Blocking issues (thread safety, sleeps) must be fixed before merge, but the tone and an offer to help keep the team learning. Rewriting someone\'s PR silently teaches nothing.',
    },
    {
      q: 'Which item belongs on the team\'s framework **review checklist** to stop these issues coming back?',
      options: [
        '"Code looks nice"',
        '"No Thread.sleep; no static WebDriver; tests independent and data created per test; locators inside page objects; no secrets; new tests tagged with a group" — partly enforced automatically (e.g. a CI grep / Checkstyle rule for Thread.sleep)',
        '"At least 100 lines changed"',
        '"Only seniors may open PRs"',
      ],
      answer: 1,
      why: 'A short, concrete checklist plus automated checks (static analysis, a failing build on Thread.sleep) scales better than relying on one reviewer noticing everything.',
    },
  ],
  hints: [
    'Ask of each snippet: what happens when 6 threads run it?',
    'Rank comments: blocking (correctness, stability) before style.',
  ],
  explanation: `**How a senior reviews test framework code**
1. **Correctness under parallelism:** shared static state, ThreadLocal clean-up, shared test data.
2. **Stability:** waits, no sleeps, no swallowed exceptions, no test chaining.
3. **Maintainability:** locators in page objects, small reusable helpers, readable names.
4. **Security & hygiene:** no secrets, no reports or drivers committed.
5. **Process:** PR size, a clear description, evidence (report link, several green runs for a parallel change).

Mark comments as *blocking* or *nit*, explain the why, suggest the fix. Green CI is necessary but not sufficient —
especially for concurrency changes, ask for 3–5 consecutive green runs.`,
  mistakes: [
    'Approving because CI was green once.',
    'Spending the review on naming nits while missing a static WebDriver.',
    'Writing vague comments ("this is wrong") without a reason or fix.',
    'Accepting giant PRs that nobody can review properly.',
  ],
  interview: [
    { q: 'What do you look for when reviewing automation code?', a: 'Thread safety (no static driver, ThreadLocal clean-up), synchronisation (explicit waits, no sleeps), test independence and data set-up, page object boundaries, secrets and committed artefacts, and whether the PR is small and evidenced with reports.' },
    { q: 'How do you give review feedback to a junior?', a: 'Separate blocking issues from nits, explain the risk, propose a concrete fix or example, and offer to pair. Turn repeated findings into a checklist or automated rule.' },
  ],
}
