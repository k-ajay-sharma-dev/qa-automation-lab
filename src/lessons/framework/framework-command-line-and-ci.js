export default {
  slug: 'framework-command-line-and-ci',
  category: 'framework',
  order: 8,
  title: 'Running from the command line and in CI (Jenkins, GitHub Actions)',
  minutes: 10,
  summary: 'Run the suite with Maven commands and -D options, make it work headless on a build server, and write Jenkins and GitHub Actions pipelines that always publish results.',
  manualAnalogy: `Your manual regression happens when someone schedules it. Automation earns its keep when it runs **without you**: every night, on every merge, on a machine with no screen. The command line is how a machine "presses Run", and a CI pipeline is the scheduled test cycle that always files its evidence, pass or fail.`,
  body: `## Maven commands you will use daily

| Command | What it does |
|---|---|
| \`mvn test\` | compile and run tests (through Surefire) |
| \`mvn clean test\` | delete \`target/\` first (old classes, reports, screenshots), then test |
| \`mvn -B ...\` | batch mode: no coloured progress noise — use in CI |
| \`mvn test -Dtest=CartTest\` | run one class |
| \`mvn test -Dtest=CartTest#removeItem\` | run one method |
| \`mvn test -Dgroups=regression\` | run a TestNG group |
| \`mvn test -Dsurefire.suiteXmlFiles=smoke.xml\` | choose a suite file |

\`clean\` matters: without it, a deleted test class can still be compiled in \`target/\`, and yesterday's screenshots sit beside today's.

\`-D\` options combine freely, and your \`ConfigReader\` reads them (see the *Configuration* lesson):

\`\`\`
mvn -B clean test -Denv=uat -Dbrowser=firefox -Dheadless=true -Dgroups=regression
\`\`\`

Quote values with spaces or special characters, e.g. Cucumber tags: \`-Dcucumber.filter.tags="@smoke and not @wip"\`.

Exit code: Maven returns non-zero when tests fail. CI uses that to mark the build red.

## Headless: browsers without a screen

Build agents (a Linux container, a GitHub runner) have no display. Run the browser **headless** — it renders pages in memory:

\`\`\`java
ChromeOptions options = new ChromeOptions();
if (ConfigReader.isHeadless()) {
    options.addArguments("--headless=new");
    options.addArguments("--window-size=1920,1080");
}
\`\`\`

- \`--window-size\`: a headless window defaults to a small size. Responsive layouts then hide menus or stack elements, and tests that pass locally fail in CI with "element not interactable". Set an explicit desktop size.
- On Linux containers Chrome may also need \`--no-sandbox\` and \`--disable-dev-shm-usage\` (small shared memory). If Chrome "fails to start" only in CI, these and headless are the first suspects.
- Selenium Manager downloads the matching driver on the agent too; the agent still needs a browser installed (GitHub's Ubuntu runners have Chrome).

## Jenkins: a declarative pipeline

A \`Jenkinsfile\` in the repo root describes the job as code:

\`\`\`groovy
pipeline {
    agent any
    tools { maven 'Maven3'; jdk 'JDK17' }      // names configured in Jenkins > Tools
    parameters {
        choice(name: 'BROWSER', choices: ['chrome', 'firefox'], description: 'Browser')
    }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Test') {
            steps {
                sh "mvn -B clean test -Dbrowser=\${params.BROWSER} -Dheadless=true"
            }
        }
    }
    post {
        always {
            // publish results and archive evidence here
        }
    }
}
\`\`\`

- \`parameters\` adds a "Build with Parameters" form; values are \`\${params.NAME}\` in the script. Add environment and group choices the same way.
- \`sh\` runs a shell command on Linux agents; use \`bat\` on Windows agents.
- **\`post { always { ... } }\`** runs whether the stages passed or failed. This is where reports go — if you publish inside the Test stage, a failing \`mvn\` stops the stage and the report is never published, exactly when you need it most.

Typical \`always\` steps: \`junit 'target/surefire-reports/*.xml'\` (test trend and failure list), \`publishHTML(...)\` for Extent/Cucumber HTML (HTML Publisher plugin), \`archiveArtifacts artifacts: 'target/screenshots/**', allowEmptyArchive: true\`.

## GitHub Actions: the same idea in YAML

\`\`\`yaml
# .github/workflows/ui-tests.yml
name: UI tests
on: [push, workflow_dispatch]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: maven }
      - name: Run tests
        run: mvn -B clean test -Denv=qa -Dheadless=true
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with: { name: reports, path: target/ }
\`\`\`

The \`run:\` step is what actually executes the suite. \`if: always()\` is GitHub's version of Jenkins' \`post { always }\`. Secrets come from repository settings as \`\${{ secrets.NAME }}\` and are passed in as \`-D\` values.

## Schedules and matrices

Two GitHub Actions features turn a push-only job into a proper test cycle:

\`\`\`yaml
on:
  schedule:
    - cron: '30 22 * * *'        # every day 22:30 UTC
  workflow_dispatch:              # "Run workflow" button

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        env: [qa, uat]
    runs-on: ubuntu-latest
    steps:
      # ... checkout, setup-java ...
      - run: mvn -B clean test -Denv=\${{ matrix.env }} -Dheadless=true
\`\`\`

- **cron** fields are *minute hour day-of-month month day-of-week*, always in UTC. \`1-5\` in the last field means Monday to Friday. Jenkins has the same idea: \`triggers { cron('H 2 * * 1-5') }\`.
- A **matrix** copies the job once per value (here one job for \`qa\`, one for \`uat\`) and runs them in parallel; inside the job the value is \`\${{ matrix.env }}\`. The same works for browsers.
- \`fail-fast: false\` stops one failing matrix job from cancelling the others — for tests you want every result.
- Each matrix job uploading an artifact needs a **unique artifact name** — put the matrix value in it.
- Secrets reach the job as environment variables: \`env: { SHOPEASY_API_TOKEN: \${{ secrets.SHOPEASY_API_TOKEN }} }\`.

## A healthy CI habit

- Smoke on every push (fast), full regression nightly (slow).
- Keep the build red when tests fail — do not add \`-Dmaven.test.failure.ignore=true\` and forget it.
- Read the archived screenshots and logs before rerunning.`,
  keyPoints: [
    '`mvn clean test` with `-D` options is how any machine runs the suite; `-Dtest=Class#method` runs one test.',
    'CI agents need headless browsers with an explicit window size.',
    'Jenkins: parameters, tools, Checkout and Test stages, and `post { always }` to publish reports.',
    'GitHub Actions: checkout, setup-java, `run: mvn ...`, then upload artifacts with `if: always()`.',
    'Reports and screenshots must be published even when tests fail.',
  ],
  mistakes: [
    'Running `mvn test` without `clean` in CI — stale classes and old screenshots confuse results.',
    'Headless without `--window-size` — different layout, "element not interactable" only in CI.',
    'Publishing reports inside the Test stage — a failure skips publishing. Use `post { always }` / `if: always()`.',
    'Hard-coding secrets in the Jenkinsfile or workflow — use the CI credential store.',
  ],
  tryIt: `From a terminal in your project folder, run \`mvn -B clean test -Dtest=<one of your test classes>\` and then the same with \`-Dheadless=true\`. Open \`target/surefire-reports\` and find the XML file Jenkins' \`junit\` step would read.`,
  problems: ['fw-012', 'fw-013', 'fw-022', 'fw-032'],
}
