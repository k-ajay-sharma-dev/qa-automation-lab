export default {
  id: 'fw-022',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'GitHub Actions: nightly cross-browser matrix with report artifacts',
  level: 'INTERMEDIATE',
  tags: ['github-actions', 'ci', 'matrix', 'schedule', 'artifacts', 'yaml'],
  estMinutes: 20,
  scenario: `ShopEasy moved its code to GitHub. The current workflow runs the smoke tests on Chrome on every push — fine. Now the
QA lead wants a **nightly regression** on Chrome **and** Firefox against QA at 02:00 UTC on weekdays, a "Run workflow"
button for ad-hoc runs, and each browser's report downloadable from the run page, even when tests fail.`,
  description: `Write \`.github/workflows/nightly-regression.yml\` (YAML in the Java editor).

**Rules**
- Triggers: \`schedule\` with a cron for 02:00 on Monday–Friday, and \`workflow_dispatch\`.
- One job with \`strategy.matrix.browser: [chrome, firefox]\` and \`fail-fast: false\` (a Chrome failure must not cancel Firefox).
- Steps: \`actions/checkout@v4\`, \`actions/setup-java@v4\` (temurin 17, Maven cache), then
  \`mvn -B clean test -Pqa,regression -Dbrowser=\${{ matrix.browser }} -Dheadless=true\`.
- The password comes from the repository secret \`SHOPEASY_QA_PASSWORD\` as the env variable \`SHOPEASY_PASSWORD\` (fw-021).
- \`actions/upload-artifact@v4\` with \`if: always()\` and an artifact **name that includes the browser** (two jobs cannot upload the same name).`,
  starterCode: `name: UI regression

on:
  push:

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - run: mvn -B clean test -Pqa,regression -Dbrowser=chrome
      - uses: actions/upload-artifact@v4
        with:
          name: report
          path: target/extent
`,
  solution: `name: Nightly UI regression

on:
  schedule:
    - cron: '0 2 * * 1-5'
  workflow_dispatch:

jobs:
  regression:
    name: Regression on \${{ matrix.browser }}
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        browser: [chrome, firefox]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: maven

      - name: Run regression on \${{ matrix.browser }}
        run: mvn -B clean test -Pqa,regression -Dbrowser=\${{ matrix.browser }} -Dheadless=true
        env:
          SHOPEASY_PASSWORD: \${{ secrets.SHOPEASY_QA_PASSWORD }}

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: regression-report-\${{ matrix.browser }}
          path: |
            target/extent
            target/screenshots
            target/surefire-reports
          retention-days: 14
`,
  checks: [
    { label: 'Nightly schedule on weekdays', pattern: 'schedule\\s*:\\s*\\n\\s*-\\s*cron\\s*:\\s*[\'"]\\s*0\\s+2\\s+\\*\\s+\\*\\s+(1-5|MON-FRI)\\s*[\'"]', hint: "schedule: - cron: '0 2 * * 1-5'" },
    { label: 'Manual trigger', pattern: 'workflow_dispatch', hint: 'Add workflow_dispatch: under on:' },
    { label: 'Browser matrix', pattern: 'matrix\\s*:\\s*\\n\\s*browser\\s*:\\s*\\[\\s*chrome\\s*,\\s*firefox\\s*\\]', hint: 'strategy: matrix: browser: [chrome, firefox]' },
    { label: 'fail-fast disabled', pattern: 'fail-fast\\s*:\\s*false', hint: 'strategy: fail-fast: false' },
    { label: 'Maven uses the matrix browser headless', pattern: 'mvn[^\\n]*-Dbrowser=\\$\\{\\{\\s*matrix\\.browser\\s*\\}\\}[^\\n]*-Dheadless=true|mvn[^\\n]*-Dheadless=true[^\\n]*-Dbrowser=\\$\\{\\{\\s*matrix\\.browser\\s*\\}\\}', hint: '-Dbrowser=$' + '{{ matrix.browser }} -Dheadless=true' },
    { label: 'Password from a repository secret', pattern: 'SHOPEASY_PASSWORD\\s*:\\s*\\$\\{\\{\\s*secrets\\.\\w+\\s*\\}\\}', hint: 'env: SHOPEASY_PASSWORD: $' + '{{ secrets.SHOPEASY_QA_PASSWORD }}' },
    { label: 'Report uploaded always, per browser', pattern: 'if\\s*:\\s*always\\(\\)[\\s\\S]*?upload-artifact[\\s\\S]*?name\\s*:\\s*[^\\n]*\\$\\{\\{\\s*matrix\\.browser\\s*\\}\\}|upload-artifact[\\s\\S]*?if\\s*:\\s*always\\(\\)[\\s\\S]*?name\\s*:\\s*[^\\n]*\\$\\{\\{\\s*matrix\\.browser', hint: 'if: always() and name: regression-report-$' + '{{ matrix.browser }}' },
  ],
  hints: [
    'Cron fields are minute hour day-of-month month day-of-week; GitHub schedules are in UTC.',
    'A matrix creates one job per value; refer to the current one as matrix.browser inside double curly braces with a dollar sign.',
    'if: always() runs the step even when the test step failed.',
  ],
  explanation: `What each part buys you:

- **\`schedule\` + cron \`0 2 * * 1-5\`** → 02:00 UTC Monday–Friday. (\`0 2\` = minute 0, hour 2.) Scheduled
  workflows run on the default branch only.
- **\`workflow_dispatch\`** → a "Run workflow" button in the Actions tab for ad-hoc runs (you can add \`inputs:\` such
  as an environment choice, like Jenkins parameters in fw-013).
- **\`strategy.matrix\`** → GitHub expands one job definition into two jobs, *Regression on chrome* and *Regression
  on firefox*, running in parallel on separate runners. Add \`env: [qa, uat]\` and you get 4 combinations.
- **\`fail-fast: false\`** → by default a failing matrix job cancels its siblings; for test results you want both
  browsers' full picture.
- **Secrets** → \`\${{ secrets.X }}\` is masked in logs and never stored in the repo; it reaches Java as an environment
  variable (\`System.getenv("SHOPEASY_PASSWORD")\`).
- **Artifacts** → \`if: always()\` uploads on red runs too, and the browser in the name avoids a name clash between the
  two matrix jobs (upload-artifact v4 rejects duplicate names).

The \`-Pqa,regression\` profiles come from fw-018; \`-Dbrowser\` is read by \`DriverManager\`. Ubuntu runners already
include Chrome and Firefox, and Selenium Manager downloads the matching drivers.`,
  mistakes: [
    'Hard-coding the browser in the mvn command, so the matrix runs Chrome twice.',
    'Leaving fail-fast on, so a Chrome failure cancels the Firefox job.',
    'Same artifact name in every matrix job, so the upload fails or overwrites.',
    'Uploading reports without if: always(), so nothing is uploaded on the nights you need it.',
  ],
  interview: [
    { q: 'How would you run your suite on several browsers in GitHub Actions?', a: 'Use a strategy.matrix with a browser list, pass the value to Maven as -Dbrowser, set fail-fast to false, and upload each job\'s report as an artifact named after the browser with if: always().' },
    { q: 'How do you schedule a nightly run?', a: 'In GitHub Actions with on.schedule and a cron expression (UTC, default branch); in Jenkins with triggers { cron(...) }. Usually smoke runs on every push and the full regression nightly.' },
  ],
}
