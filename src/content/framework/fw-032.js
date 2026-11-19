export default {
  id: 'fw-032',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Jenkinsfile: smoke gate, parallel browsers and per-branch reports',
  level: 'ADVANCED',
  tags: ['jenkins', 'jenkinsfile', 'ci', 'parallel', 'pipeline', 'reporting'],
  estMinutes: 25,
  scenario: `The ShopEasy nightly Jenkins job runs Chrome regression, then Firefox regression, one after the other: 80 minutes.
When the QA environment is down, both runs fail test by test and the team wakes up to 600 red tests and no report,
because the \`junit\`/\`publishHTML\` steps were inside the Test stage. The DevOps lead offers two agents labelled
\`ui-tests\` and asks you to restructure the pipeline.`,
  description: `Write a declarative \`Jenkinsfile\` (Groovy, shown in the Java editor).

**Rules**
- A **Smoke** stage first: \`mvn -B clean test -Pqa,smoke -Dheadless=true\`. If it fails, the regression stages must not start.
- Then a **Regression** stage containing a \`parallel\` block with two stages, **Chrome** and **Firefox**, each on its own \`agent { label 'ui-tests' }\` (two parallel Maven runs must not share one \`target/\` folder).
- Each branch runs \`mvn -B clean test -Pqa,regression -Dbrowser=<browser> -Dheadless=true\`.
- Each branch has its own \`post { always { ... } }\` that publishes \`junit\` results and an HTML report named after the browser, and archives screenshots.
- Do **not** use \`failFast true\`: a Chrome failure must not abort the Firefox run.`,
  starterCode: `pipeline {
    agent any

    stages {
        stage('Chrome') {
            steps {
                sh 'mvn clean test -Dbrowser=chrome'
                junit 'target/surefire-reports/*.xml'
            }
        }
        stage('Firefox') {
            steps {
                sh 'mvn clean test -Dbrowser=firefox'
                junit 'target/surefire-reports/*.xml'
            }
        }
    }
}
`,
  solution: `pipeline {
    agent { label 'ui-tests' }

    options {
        timeout(time: 90, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    triggers {
        cron('H 1 * * 1-5')
    }

    stages {
        stage('Smoke') {
            steps {
                sh 'mvn -B clean test -Pqa,smoke -Dheadless=true'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
                }
            }
        }

        stage('Regression') {
            parallel {
                stage('Chrome') {
                    agent { label 'ui-tests' }
                    steps {
                        sh 'mvn -B clean test -Pqa,regression -Dbrowser=chrome -Dheadless=true'
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
                            publishHTML(target: [
                                reportDir: 'target/extent', reportFiles: 'report.html',
                                reportName: 'Regression Report - Chrome',
                                keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true
                            ])
                            archiveArtifacts artifacts: 'target/screenshots/**/*.png', allowEmptyArchive: true
                        }
                    }
                }
                stage('Firefox') {
                    agent { label 'ui-tests' }
                    steps {
                        sh 'mvn -B clean test -Pqa,regression -Dbrowser=firefox -Dheadless=true'
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
                            publishHTML(target: [
                                reportDir: 'target/extent', reportFiles: 'report.html',
                                reportName: 'Regression Report - Firefox',
                                keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true
                            ])
                            archiveArtifacts artifacts: 'target/screenshots/**/*.png', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
    }

    post {
        failure {
            echo 'Nightly regression failed. Open the Chrome/Firefox report links on this build.'
        }
    }
}
`,
  checks: [
    { label: 'Smoke stage runs before the parallel block', pattern: 'stage\\s*\\(\\s*[\'"]Smoke[\'"]\\s*\\)[\\s\\S]*?mvn[^\\n]*smoke[\\s\\S]*?parallel\\s*\\{', hint: "stage('Smoke') { steps { sh 'mvn ... -Pqa,smoke ...' } } before stage('Regression') { parallel { ... } }" },
    { label: 'Parallel Chrome and Firefox stages', pattern: 'parallel\\s*\\{[\\s\\S]*?stage\\s*\\(\\s*[\'"]Chrome[\'"]\\s*\\)[\\s\\S]*?stage\\s*\\(\\s*[\'"]Firefox[\'"]\\s*\\)', hint: "parallel { stage('Chrome') { ... } stage('Firefox') { ... } }" },
    { label: 'Each branch on its own agent', pattern: 'stage\\s*\\(\\s*[\'"]Firefox[\'"]\\s*\\)\\s*\\{\\s*agent\\s*\\{\\s*label', hint: "stage('Firefox') { agent { label 'ui-tests' } ... }" },
    { label: 'Browser passed to Maven, headless', pattern: 'mvn[^\\n]*-Dbrowser=firefox[^\\n]*-Dheadless=true|mvn[^\\n]*-Dheadless=true[^\\n]*-Dbrowser=firefox', hint: "sh 'mvn -B clean test -Pqa,regression -Dbrowser=firefox -Dheadless=true'" },
    { label: 'Branch reports published in post { always }', pattern: 'stage\\s*\\(\\s*[\'"]Firefox[\'"]\\s*\\)[\\s\\S]*?post\\s*\\{\\s*always\\s*\\{[\\s\\S]*?junit[\\s\\S]*?publishHTML', hint: 'Inside the Firefox stage: post { always { junit ...; publishHTML(...) } }' },
    { label: 'Report named per browser', pattern: 'reportName\\s*:\\s*[\'"][^\'"]*Firefox', hint: "reportName: 'Regression Report - Firefox'" },
    { label: 'No failFast', pattern: 'failFast\\s*(:\\s*)?true', mustNot: true, hint: 'failFast true aborts the other browser when one fails' },
  ],
  hints: [
    'Stages run in order: a failed Smoke stage stops the pipeline before Regression starts.',
    'Inside parallel { }, each stage can declare its own agent, so each Maven run has its own workspace.',
    'Put post { always { } } inside each parallel stage: it runs on that agent, where that branch\'s target/ folder is.',
  ],
  explanation: `**Why this shape**

- **Smoke gate.** Declarative stages are sequential; when \`Smoke\` fails the build fails and \`Regression\` is skipped.
  A dead environment now costs 3 minutes and 10 red tests, not 80 minutes and 600.
- **\`parallel\` with an agent per branch.** Two \`mvn clean test\` runs in one workspace would delete each other's
  \`target/\` and mix reports. \`agent { label 'ui-tests' }\` per branch gives each its own workspace (on the same or
  another node). Wall-clock time drops to roughly the slower browser.
- **\`post { always }\` per branch.** Reports are written on the branch's agent, so they must be published there.
  \`always\` runs when tests fail — the point of the whole exercise. \`junit\` results from both branches are merged into
  the build's test trend; Jenkins shows the stage name next to each failure.
- **Distinct \`reportName\`.** Two \`publishHTML\` calls with the same name overwrite each other's link.
- **No \`failFast true\`.** It aborts the other branches when one fails — fine for a build, wrong for a test run where
  you want both browsers' results.

Next steps a senior would add: a \`parameters\` block for ENV, \`withCredentials\` for the password (fw-021), and a
Slack/email notification in the top-level \`post { failure { } }\`.`,
  mistakes: [
    'Running two Maven builds in parallel in the same workspace so target/ and reports get clobbered.',
    'Publishing reports only in the top-level post, where the branch agents\' files are not available.',
    'Giving both HTML reports the same reportName.',
    'Adding failFast true and losing the second browser\'s results when the first fails.',
  ],
  interview: [
    { q: 'How do you reduce the run time of your regression in CI?', a: 'Gate with a short smoke stage, then run browsers or test shards in parallel stages, each on its own agent or Grid session, with TestNG parallelism inside each run. Reports are published per branch in post always.' },
    { q: 'Where do you publish test reports in a Jenkins pipeline and why?', a: 'In post { always { } } of the stage that produced them, on the same agent. always ensures reports are published when tests fail, and the same agent is needed because the files only exist in that workspace (or you stash/unstash them).' },
    { q: 'What does failFast do in a parallel block?', a: 'It aborts the remaining parallel branches as soon as one fails. Useful for builds, usually wrong for test runs, because you lose the results of the other branches.' },
  ],
}
