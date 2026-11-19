export default {
  slug: 'debug-build-runner-failures',
  category: 'debugging',
  order: 10,
  title: 'Build and runner failures: Tests run 0, silent skips and Maven dependency conflicts',
  minutes: 8,
  summary: 'Recognise failures that happen before or around the tests — nothing discovered, tests skipped by a failed dependency, two library versions on the classpath, the wrong JDK, an artifact CI cannot download — and fix them in the build, not in the test code.',
  manualAnalogy: `Before you start a manual test session you check that you have the right build installed, the right test cases selected and a working environment. If the wrong test set was loaded, nothing you find that day means much. Maven, Surefire, TestNG and Cucumber are the automation's "session preparation", and when they go wrong the symptoms are strange: green builds with no tests, skipped tests nobody notices, or errors in code nobody changed.`,
  body: `## 1. "BUILD SUCCESS" with nothing tested

\`\`\`text
[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
\`\`\`

Green means "nothing failed", not "something ran". Check, in this order:

| Check | Why it matters |
|---|---|
| The \`@Test\` import | \`org.junit.jupiter.api.Test\` in a TestNG project is ignored by TestNG — 0 tests, no error |
| The class name | Without a suite file, Surefire only picks up \`Test*\`, \`*Test\`, \`*Tests\`, \`*TestCase\` classes |
| \`testng.xml\` | If Surefire runs a suite file, only the classes/packages listed there run |
| Cucumber \`features\` path and tag filter | A wrong folder or a tag expression like \`@smoke and @api\` (both tags required) gives \`0 Scenarios\` |
| \`-Dtest=...\` on the command line | A typo selects nothing (Surefire can be told to fail when that happens) |

Protect yourself: make the pipeline fail when the test count drops to zero or far below the previous build.

## 2. Skipped is a symptom

TestNG skips a test when something it relies on failed:

\`\`\`text
org.testng.SkipException: Method checkoutWithCoupon depends on not successfully finished methods
\`\`\`

- A failed \`@BeforeClass\`/\`@BeforeMethod\` skips the tests it prepares ("Configuration Failures: 1, Skips: 40").
- \`dependsOnMethods\` skips every dependent when the target fails.

Fix the **one** upstream failure first. Long-term, prefer independent tests that set up their own preconditions; dependency chains turn one failure into many and block parallel runs. Put \`alwaysRun = true\` on *teardown* methods so browsers are closed even after a setup failure — not on dependent tests.

## 3. "It compiled, but…": linkage errors

\`\`\`text
java.lang.NoSuchMethodError: 'void org.openqa.selenium.remote.http.ClientConfig...'
java.lang.NoClassDefFoundError: org/openqa/selenium/devtools/HasDevTools
\`\`\`

Your code compiled against one version of a library and runs against another. In Maven projects that almost always means a **dependency conflict**: two of your dependencies bring different versions of the same library and Maven picked one.

How Maven picks: **nearest definition wins** (fewest steps from your project in the tree); on a tie, the **first declared** in the pom wins. It does *not* pick the newest. To see what happened:

\`\`\`text
mvn dependency:tree -Dverbose -Dincludes=com.fasterxml.jackson.core
\`\`\`

Lines ending in \`omitted for conflict with X\` show the losers. Fix by aligning versions in \`<dependencyManagement>\` — ideally by importing the library's **BOM** (\`selenium-bom\`, \`jackson-bom\`) — and add the \`maven-enforcer-plugin\` \`dependencyConvergence\` rule so new conflicts fail the build early.

## 4. CI-only build errors

| Message | Meaning | Fix |
|---|---|---|
| \`UnsupportedClassVersionError ... class file version 61.0 ... up to 55.0\` | Compiled for Java 17, run on Java 11 (52 = 8, 55 = 11, 61 = 17, 65 = 21) | Configure the job's JDK; set \`maven.compiler.release\` in the pom |
| \`Could not find artifact com.shopeasy:...-SNAPSHOT\` | The jar exists only in someone's local \`~/.m2\` (\`mvn install\`) | Publish to the team repository or build it in the same reactor |
| \`Could not transfer artifact ... 401/403\` | CI has no credentials for the company repository | \`settings.xml\` credentials on the agent |

Log \`java -version\` and \`mvn -v\` at the start of every pipeline — half of these are solved by reading those two lines.

## How to classify them

None of these is a product verdict. In a triage report they are **framework/build issues**: fix the build, rerun, then judge the product.`,
  keyPoints: [
    '"Tests run: 0" + BUILD SUCCESS = discovery problem: annotation import, class naming, suite file, tags.',
    'Skipped tests are consequences — find the failed configuration method or dependency.',
    'NoSuchMethodError / NoClassDefFoundError after a clean compile = two versions of a library on the classpath.',
    'Maven conflict resolution: nearest wins, then first declared — check with `mvn dependency:tree -Dverbose`.',
    'Align versions with dependencyManagement/BOMs and enforce convergence in CI.',
  ],
  mistakes: [
    'Celebrating a green build without checking how many tests ran.',
    'Using `alwaysRun = true` on dependent tests to "un-skip" them.',
    'Reordering pom dependencies until it works, without understanding why.',
    'Fixing a CI-only failure by deleting ~/.m2 or rerunning, instead of reading the JDK and repository lines.',
  ],
  tryIt: `In any Maven test project run \`mvn dependency:tree -Dverbose -Dincludes=org.seleniumhq.selenium\` and find whether any Selenium artifact was "omitted for conflict". Then rename one test class so it no longer ends in "Test" and run \`mvn test\` — watch it silently disappear from the report.`,
  problems: ['dbg-022', 'dbg-025'],
}
