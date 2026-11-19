export default {
  id: 'fw-012',
  category: 'framework',
  kind: 'quiz',
  title: 'Running from the command line and headless in CI',
  level: 'BEGINNER',
  tags: ['maven', 'command-line', 'ci', 'headless', 'github-actions'],
  estMinutes: 12,
  scenario: `Nobody on the CI server clicks "Run" in IntelliJ. The DevOps engineer asks you for the exact commands to run smoke
tests on Firefox against QA, and why the same tests fail on the GitHub Actions runner with
\`SessionNotCreatedException\` while they pass on your laptop.`,
  description: `Answer the questions about running the ShopEasy framework outside the IDE.`,
  questions: [
    {
      q: 'Which command runs only the TestNG group `smoke` on Firefox against the QA environment?',
      options: [
        '`mvn run smoke firefox qa`',
        '`mvn test -Dgroups=smoke -Dbrowser=firefox -Denv=qa`',
        '`java -jar testng.jar smoke`',
        '`mvn install --group smoke --browser firefox`',
      ],
      answer: 1,
      why: '`-Dgroups` is understood by the Surefire plugin and filters TestNG groups. `-Dbrowser` and `-Denv` are plain system properties your ConfigReader/DriverManager read (fw-006, pom-011).',
    },
    {
      q: 'How do you run a single test class or method from Maven?',
      options: [
        '`mvn test -Dtest=LoginTest` or `mvn test -Dtest=LoginTest#validLoginShowsInventory`',
        '`mvn LoginTest`',
        '`mvn test LoginTest.java`',
        'It is only possible from the IDE',
      ],
      answer: 0,
      why: 'Surefire supports `-Dtest=Class`, `-Dtest=Class#method` and patterns like `-Dtest=*Checkout*`. Handy for reproducing one CI failure.',
    },
    {
      q: 'Tests pass locally but on a GitHub Actions Ubuntu runner Chrome fails to start. What is the most likely fix?',
      options: [
        'Add Thread.sleep before creating the driver',
        'Run Chrome headless (`--headless=new`) with a window size, because the runner has no display',
        'Switch to Internet Explorer',
        'Use a bigger thread-count',
      ],
      answer: 1,
      why: 'CI runners have no screen. Use `--headless=new` (plus `--window-size=1920,1080` so responsive layouts match desktop, and often `--no-sandbox` / `--disable-dev-shm-usage` in containers). Toggle it with `-Dheadless=true` so local runs stay headed.',
    },
    {
      q: 'Why should headless runs set an explicit window size?',
      options: [
        'Headless is faster with bigger windows',
        'Default headless viewport can be small (e.g. 800x600), so a responsive site switches to its mobile layout and desktop locators are hidden',
        'It is required by Selenium Manager',
        'It enables screenshots',
      ],
      answer: 1,
      why: 'A small viewport triggers responsive breakpoints on many sites: navigation collapses into a mobile menu and your desktop locators fail with ElementNotInteractable. A fixed size makes CI match local runs.',
    },
    {
      q: 'What does `mvn clean test` do differently from `mvn test`?',
      options: [
        'Nothing',
        'Deletes `target/` first, so old reports, screenshots and compiled classes from a previous run cannot leak into this run',
        'Skips compilation',
        'Runs tests in parallel',
      ],
      answer: 1,
      why: '`clean` removes the build directory. In CI always run `mvn clean test` (or `verify`) so archived reports belong to this build only.',
    },
    {
      q: 'In a GitHub Actions workflow, which step runs the suite?',
      options: [
        '`- uses: run-tests@v1`',
        '`- run: mvn -B clean test -Dgroups=smoke -Dheadless=true`',
        '`- script: java Test`',
        '`- npm test`',
      ],
      answer: 1,
      why: 'After `actions/checkout` and `actions/setup-java` (Java 17, cache: maven), a `run:` step executes Maven. `-B` (batch mode) gives clean, non-interactive logs. Ubuntu runners already ship Chrome; Selenium Manager handles the driver.',
    },
  ],
  hints: ['-D sets a system property.', 'CI machines have no display.'],
  explanation: `Commands you will use daily:
\`\`\`text
mvn clean test                                   # everything in testng.xml
mvn clean test -Dgroups=smoke                    # one group
mvn clean test -Dtest=LoginTest#validLogin       # one method
mvn clean test -Denv=qa -Dbrowser=firefox -Dheadless=true
mvn clean test -DsuiteXmlFile=testng-regression.xml
\`\`\`
GitHub Actions headless job:
\`\`\`yaml
name: ui-smoke
on: [push, workflow_dispatch]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: maven }
      - run: mvn -B clean test -Dgroups=smoke -Denv=qa -Dheadless=true
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: reports, path: target/extent, retention-days: 14 }
\`\`\`
\`if: always()\` uploads the report even when tests fail — exactly when you need it.`,
  mistakes: [
    'Forgetting -Dheadless=true on CI and getting SessionNotCreatedException.',
    'Not cleaning target/ and archiving screenshots from a previous build.',
    'Uploading reports only on success.',
  ],
  interview: [
    { q: 'How do you run your tests in CI?', a: 'The CI job checks out the repo, sets up Java 17 with a Maven cache, runs mvn clean test with system properties for env, browser, group and headless, then publishes TestNG/Surefire results and the HTML report, always, even on failure.' },
    { q: 'Headless vs headed: any differences in behaviour?', a: 'Mostly the same with modern --headless=new, but viewport size, fonts, downloads and some OS dialogs can differ. Set a window size and compare screenshots when a test only fails headless.' },
  ],
}
