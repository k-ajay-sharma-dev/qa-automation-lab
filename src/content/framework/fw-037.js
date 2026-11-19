export default {
  id: 'fw-037',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'GitHub Actions PR gate: cached ~/.m2, smoke suite as a required check',
  level: 'ADVANCED',
  tags: ['ci', 'github-actions', 'maven', 'caching', 'pull-request', 'quality-gate'],
  estMinutes: 25,
  scenario: `Twice this month a ShopEasy pull request was merged that broke login, and the nightly run found it 14 hours
later. The team agrees: every PR to \`main\` must pass the smoke suite before the Merge button turns green. The first
attempt downloads 180 MB of Maven dependencies on every run (4 minutes) and runs on every push to every branch.`,
  description: `Rewrite \`.github/workflows/pr-smoke.yml\` (shown in the Java editor; it is YAML).

**Rules**
- Trigger on \`pull_request\` to \`main\` (not on every \`push\`).
- Cache Maven dependencies (\`~/.m2/repository\`), either with \`actions/cache\` keyed on \`hashFiles('**/pom.xml')\` or \`actions/setup-java\` with \`cache: maven\`.
- Java 17 (temurin), run \`mvn -B verify -Psmoke -Dheadless=true\`.
- The password comes from \`secrets.SHOPEASY_PASSWORD\`.
- Upload the reports even when the tests fail (\`if: always()\`).
- Cancel an older run of the same PR when a new commit arrives (\`concurrency\`).
- Give the job a stable name (\`smoke\`) so it can be marked as a **required status check** in branch protection.`,
  starterCode: `name: PR smoke
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - run: mvn test -Dpassword=secret_sauce
      - uses: actions/upload-artifact@v4
        with:
          name: reports
          path: target/surefire-reports
`,
  solution: `name: PR smoke
on:
  pull_request:
    branches: [ main ]

concurrency:
  group: pr-smoke-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  smoke:
    name: smoke
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Cache Maven repository
        uses: actions/cache@v4
        with:
          path: ~/.m2/repository
          key: maven-\${{ runner.os }}-\${{ hashFiles('**/pom.xml') }}
          restore-keys: maven-\${{ runner.os }}-

      - name: Run smoke suite
        run: mvn -B verify -Psmoke -Dheadless=true
        env:
          SHOPEASY_PASSWORD: \${{ secrets.SHOPEASY_PASSWORD }}

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: smoke-reports-\${{ github.run_number }}
          path: |
            target/surefire-reports
            target/failsafe-reports
            reports/
`,
  checks: [
    { label: 'Triggers on pull_request to main', pattern: 'on:\\s*\\n?\\s*pull_request:[\\s\\S]*?branches:[^\\n]*main', hint: 'on:\\n  pull_request:\\n    branches: [ main ]' },
    { label: 'Does not run on every push', pattern: '^on:\\s*push', mustNot: true, hint: 'Replace on: push with on: pull_request' },
    { label: 'Caches ~/.m2 (actions/cache with pom hash, or setup-java cache: maven)', pattern: "(\\.m2[\\s\\S]*?hashFiles\\s*\\(\\s*'\\*\\*/pom\\.xml'|cache:\\s*maven)", hint: "key: maven-${{ runner.os }}-${{ hashFiles('**/pom.xml') }}" },
    { label: 'Runs the smoke profile headless in batch mode', pattern: 'mvn\\s+-B[^\\n]*-Psmoke', hint: 'mvn -B verify -Psmoke -Dheadless=true' },
    { label: 'Password from GitHub secrets, not hard-coded', pattern: 'secrets\\.SHOPEASY_PASSWORD', hint: 'env: SHOPEASY_PASSWORD: ${{ secrets.SHOPEASY_PASSWORD }}' },
    { label: 'No hard-coded password', pattern: 'secret_sauce', mustNot: true, hint: 'Never put the password in the workflow file' },
    { label: 'Uploads reports even on failure', pattern: 'if:\\s*always\\(\\)[\\s\\S]*?upload-artifact|upload-artifact[\\s\\S]*?if:\\s*always\\(\\)', hint: 'Add if: always() to the upload step' },
    { label: 'Cancels superseded runs', pattern: 'concurrency:[\\s\\S]*?cancel-in-progress:\\s*true', hint: 'concurrency: { group: ..., cancel-in-progress: true }' },
  ],
  hints: [
    'The cache key should change only when a pom.xml changes; restore-keys gives a partial hit after a dependency bump.',
    'Without if: always(), a failing mvn step skips the upload — exactly when you need the report.',
    'Branch protection lists required checks by job name, so keep it stable: jobs.smoke with name: smoke.',
  ],
  explanation: `**Why each piece matters**
- \`pull_request\` + branch protection = the merge button is blocked until \`smoke\` is green. In *Settings → Branches →
  Branch protection rule for main* tick "Require status checks to pass" and select \`smoke\` (it appears after the
  workflow ran once). Renaming the job later silently breaks the rule.
- **Cache:** \`~/.m2/repository\` keyed on the hash of all pom.xml files. Same poms → cache hit → seconds instead of
  minutes. \`setup-java\` with \`cache: maven\` does the same in one line.
- \`-B\` (batch mode) gives clean CI logs without download progress noise.
- \`concurrency\` stops three queued runs when a developer pushes three quick fixes.
- \`verify\` instead of \`test\`: works for both Surefire and Failsafe set-ups.
- Secrets: PRs from **forks** do not receive repository secrets — plan a public-data smoke or run the gate only for
  internal branches.

Keep the PR gate small (5–10 minutes). The full regression stays nightly.`,
  mistakes: [
    'Running the full 2-hour regression on every PR so developers bypass the gate.',
    'Uploading reports without if: always(), so failed runs have no report.',
    'Renaming the job and wondering why the required check never reports.',
    'Hard-coding passwords in the workflow file.',
  ],
  interview: [
    { q: 'How do you make tests a merge gate on GitHub?', a: 'Run a workflow on pull_request, give the job a stable name and mark it as a required status check in the branch protection rule for main. The PR cannot be merged until that check passes.' },
    { q: 'How do you speed up Maven builds in CI?', a: 'Cache ~/.m2/repository keyed on the pom.xml hash (actions/cache or setup-java cache: maven), use batch mode, run a focused smoke profile on PRs and parallelise or shard the bigger suites.' },
    { q: 'What tests do you run on a PR vs nightly?', a: 'A fast, stable smoke/critical-path set on every PR (minutes); the full cross-browser regression nightly or before release, with results reported as trends.' },
  ],
}
