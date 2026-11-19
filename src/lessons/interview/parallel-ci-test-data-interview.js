export default {
  slug: 'parallel-ci-test-data-interview',
  category: 'interview',
  order: 4,
  title: 'Scaling questions: parallel runs, CI/CD and test data',
  minutes: 9,
  summary: 'Explain how your suite runs in parallel safely, how it fits into a Jenkins pipeline, and where its test data comes from.',
  manualAnalogy: `When five testers run one regression cycle together, you split the work, give each person their own test
accounts, and agree who logs which defect. Parallel automation, CI and test data management are the same planning
problems - now answered for machines instead of people.`,
  body: `## Parallel execution

**How it is switched on** (Cucumber + TestNG): the runner overrides \`scenarios()\` with
\`@DataProvider(parallel = true)\`; thread count comes from TestNG (\`data-provider-thread-count\`). In plain TestNG
suites, \`parallel="methods"\` or \`"classes"\` plus \`thread-count\` in \`testng.xml\`.

**Why ThreadLocal?** Each thread needs its **own** browser. A \`static WebDriver\` is one variable shared by all
threads - test A navigates while test B is clicking. \`ThreadLocal<WebDriver>\` gives every thread a private copy:

\`\`\`java
private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
public static WebDriver get() { return DRIVER.get(); }
\`\`\`

Remember to call \`DRIVER.remove()\` after quitting, so a reused thread does not get a dead driver. (In Cucumber, a
PicoContainer-injected context achieves the same isolation per scenario.)

**What else must be thread-safe?** Everything shared:

- **Test data** - two scenarios using the same account or cart collide ("wrong cart count" bugs even with
  ThreadLocal drivers). Give each thread its own user or generate unique data.
- **Static variables** in utilities or page objects.
- **Report writers and files** (screenshots with the same name overwrite each other - add the scenario name or a
  timestamp).

**Selenium Grid** adds *distribution*: a hub receives sessions from \`RemoteWebDriver\` and sends them to nodes on
other machines or Docker containers, with different browsers/OS. Local parallel is limited by one machine's CPU and
memory; Grid scales out and enables cross-browser runs. Docker images (\`selenium/standalone-chrome\`, or a full grid
with Docker Compose) are the usual way to run it in CI.

## CI/CD with Jenkins

What a pipeline typically does for UI automation:

1. Checks out the test repository from Git.
2. Runs Maven with parameters, for example:

\`\`\`text
mvn clean test -Denv=qa -Dbrowser=chrome -Dheadless=true -Dcucumber.filter.tags="@smoke"
\`\`\`

   \`-D\` sets a Java system property your config reader can read (\`System.getProperty("env")\`).
3. Publishes reports (Cucumber HTML/JSON, TestNG results) and archives screenshots.
4. Notifies the team (email, Slack/Teams).

**When suites run**: smoke after every deployment to QA (fast, gating), full regression nightly or before a release,
plus on-demand runs with parameters. UI suites are usually too slow for every single commit - unit and API tests take
that slot.

**The pipeline is red - what do you do first?** Do not rerun blindly. Open the report: which tests, what error, what
screenshot. Then classify each failure:

| Type | Action |
|---|---|
| Product bug | reproduce manually, raise a defect with evidence, link it to the test |
| Test/script issue (locator changed, bad wait) | fix the test, raise a PR |
| Environment | check deploy/server status, inform DevOps, rerun when stable |
| Test data | reset or regenerate data, then make the test create its own |

If a test fails because of a confirmed product bug, **keep it failing** (or tag it with the bug id and report it
separately). Deleting or "fixing" the assertion to go green hides a real defect.

## Test data management

**Configuration** (URLs, browser, timeouts, default users per environment) belongs in files outside code:
\`config/qa.properties\`, \`config/staging.properties\`, selected by \`-Denv=qa\`. Secrets (passwords) come from CI
credentials or a vault, never from Git.

**Where scenario data comes from** - match the source to the need:

| Need | Good source |
|---|---|
| Same scenario, several input sets | Scenario Outline + Examples, or a TestNG DataProvider |
| Structured objects (customers, addresses) | JSON files mapped to Java classes |
| Unique values (emails, order references) | generated at runtime (timestamp, UUID, Faker library) |
| Complex existing state (an order in "Shipped" status) | create it through an **API** or DB script in setup, not by clicking through 10 screens |
| Large tabular sets maintained by BAs | Excel/CSV (use sparingly) |

Key principles to say: **each test creates or owns its data**, data is **unique per parallel run**, and **setup via
API** is faster and more reliable than via UI. Clean up after yourself where possible.

## Tie it into one story

"In my framework the driver is ThreadLocal, each scenario logs in with a user from a per-thread pool, Jenkins runs
\`@smoke\` headless on every QA deploy and full regression nightly on a Docker grid, and failures are triaged from the
HTML report with screenshots." Adapt it to what you have really built.`,
  keyPoints: [
    'ThreadLocal (or a per-scenario injected context) gives each thread its own WebDriver; call remove() after quit.',
    'Data, statics and report files must also be thread-safe - shared accounts break parallel runs.',
    'Grid distributes browsers across machines/containers; local parallel is limited to one machine.',
    'Jenkins: mvn with -D parameters, publish reports, smoke per deploy, regression nightly.',
    'Red pipeline: read the report, classify (product / script / environment / data), act - never rerun blindly.',
    'Config in per-environment files, unique generated data, complex state via API.',
  ],
  mistakes: [
    'Thinking ThreadLocal drivers alone make parallel safe. Fix: also isolate test data and static state.',
    'Rerunning the failed job until it is green. Fix: triage each failure and record flaky ones.',
    'Hard-coding URLs and passwords in page objects. Fix: per-environment config plus CI secrets.',
    'Creating complex preconditions through the UI. Fix: use an API or DB setup step.',
  ],
  tryIt: `Write the Maven command you would put in a Jenkins job that runs the checkout regression on staging in headless
Firefox, excluding unfinished scenarios.`,
  problems: ['int-006', 'int-007', 'int-008'],
}
