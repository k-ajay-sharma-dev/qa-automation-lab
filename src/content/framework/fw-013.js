export default {
  id: 'fw-013',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Jenkins pipeline: checkout, mvn test, publish reports',
  level: 'INTERMEDIATE',
  tags: ['jenkins', 'ci', 'jenkinsfile', 'pipeline'],
  estMinutes: 20,
  scenario: `The DevOps team gives you a Jenkins folder and says: *"Pipelines are code here. Put a Jenkinsfile in your repo."*
The release manager wants to trigger runs with a choice of environment and test group, see the trend of passed/failed
tests per build, and open the Extent report from the build page — even when tests fail.`,
  description: `Write a declarative \`Jenkinsfile\` (Groovy, shown in the Java editor).

**Rules**
- \`pipeline { agent any ... }\` with \`parameters\`: \`choice\` ENV (qa, uat) and \`choice\` GROUPS (smoke, regression).
- \`tools { maven ...; jdk ... }\` (names configured in Jenkins).
- Stages: **Checkout** (\`checkout scm\`), **Test** (\`sh\` or \`bat\` running \`mvn clean test\` with the parameters and \`-Dheadless=true\`).
- \`post { always { ... } }\`: publish TestNG/JUnit results (\`junit\` on surefire XML) and the HTML report (\`publishHTML\`), archive screenshots.
- Tests failing must not prevent publishing reports.`,
  starterCode: `pipeline {
    agent any

    stages {
        stage('Test') {
            steps {
                sh 'mvn test'
            }
        }
    }
}
`,
  solution: `pipeline {
    agent any

    parameters {
        choice(name: 'ENV',    choices: ['qa', 'uat'],             description: 'Target environment')
        choice(name: 'GROUPS', choices: ['smoke', 'regression'],   description: 'TestNG group to run')
        choice(name: 'BROWSER', choices: ['chrome', 'firefox'],    description: 'Browser')
    }

    tools {
        maven 'Maven-3.9'
        jdk 'JDK-17'
    }

    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                sh "mvn -B clean test -Denv=\${params.ENV} -Dgroups=\${params.GROUPS} -Dbrowser=\${params.BROWSER} -Dheadless=true"
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml'
            publishHTML(target: [
                reportDir: 'target/extent',
                reportFiles: 'report.html',
                reportName: 'Extent Report',
                keepAll: true,
                alwaysLinkToLastBuild: true,
                allowMissing: true
            ])
            archiveArtifacts artifacts: 'target/screenshots/**/*.png, target/logs/*.log', allowEmptyArchive: true
        }
        failure {
            echo "UI tests failed on \${params.ENV}. See the Extent Report link on this build."
        }
    }
}
`,
  checks: [
    { label: 'Build parameters for env and group', pattern: 'parameters\\s*\\{[\\s\\S]*?choice\\s*\\(\\s*name\\s*:\\s*\'ENV\'', hint: "parameters { choice(name: 'ENV', choices: ['qa','uat']) ... }" },
    { label: 'Checkout stage', pattern: 'stage\\s*\\(\\s*[\'"]Checkout[\'"]\\s*\\)[\\s\\S]*?checkout\\s+scm', hint: "stage('Checkout') { steps { checkout scm } }" },
    { label: 'Maven run uses the parameters', pattern: '(sh|bat)\\s+"[^"]*mvn[^"]*-Denv=\\$\\{params\\.ENV\\}[^"]*-Dgroups=\\$\\{params\\.GROUPS\\}', hint: 'Use double quotes so Groovy interpolates: sh "mvn clean test -Denv=$' + '{params.ENV} -Dgroups=$' + '{params.GROUPS}"' },
    { label: 'Headless on CI', pattern: '-Dheadless=true', hint: 'Jenkins agents usually have no display' },
    { label: 'Reports published in post { always }', pattern: 'post\\s*\\{[\\s\\S]*?always\\s*\\{[\\s\\S]*?(junit|testNG)\\b[\\s\\S]*?publishHTML', hint: 'post { always { junit ...; publishHTML(...) } }' },
    { label: 'Artifacts archived', pattern: 'archiveArtifacts', hint: "archiveArtifacts artifacts: 'target/screenshots/**/*.png'" },
  ],
  hints: [
    'Declarative structure: pipeline > agent, parameters, tools, stages > stage > steps, post.',
    'Single-quoted Groovy strings do not interpolate; use double quotes for params.',
    'Anything in post { always { } } runs even when the Test stage fails.',
  ],
  explanation: `Pipeline as code means the CI setup is reviewed and versioned with the tests.

- **\`parameters\`** → the release manager picks ENV/GROUPS in "Build with Parameters"; they become
  \`params.ENV\` and flow into Maven as \`-D\` system properties → ConfigReader picks the right file.
- **\`checkout scm\`** → the same commit that contains this Jenkinsfile.
- **\`post { always }\`** → when tests fail, Maven exits non-zero and the stage fails, but \`always\` still publishes
  results. That is the requirement "reports even on failure".
- **\`junit\`** on \`target/surefire-reports/*.xml\` gives the per-build pass/fail trend graph (or the \`testNG\` step
  from the TestNG Results plugin). \`publishHTML\` (HTML Publisher plugin) adds the Extent link. For Allure use the
  \`allure\` step from the Allure plugin.
- Use \`bat\` instead of \`sh\` on Windows agents.

Nightly regression: add \`triggers { cron('H 2 * * 1-5') }\`. Deployment hook: the deploy job triggers this one with
\`build job: 'shopeasy-ui-tests', parameters: [string(name: 'GROUPS', value: 'smoke')]\`.`,
  mistakes: [
    "Using single quotes for sh with params ('mvn -Denv=$" + "{params.ENV}') so the literal text is passed.",
    'Publishing reports inside the Test stage, so they are skipped when tests fail.',
    'Not running headless on agents without a display.',
    'Hard-coding environment URLs in the Jenkinsfile instead of using config files.',
  ],
  interview: [
    { q: 'How is your framework integrated with Jenkins?', a: 'A declarative Jenkinsfile in the repo: parameters for env/group/browser, Checkout and Test stages running mvn clean test with -D properties in headless mode, and a post always block that publishes Surefire/TestNG results, the HTML report and screenshots. Smoke runs are triggered after deployment, regression nightly via cron.' },
    { q: 'What is the difference between declarative and scripted pipelines?', a: 'Declarative uses a fixed structure (pipeline, agent, stages, post) that is easier to read and validate; scripted is plain Groovy with more flexibility. Most teams use declarative and drop to a script block only when needed.' },
  ],
}
