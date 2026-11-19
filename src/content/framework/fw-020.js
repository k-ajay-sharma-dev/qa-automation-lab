export default {
  id: 'fw-020',
  category: 'framework',
  kind: 'quiz',
  title: 'Maven troubleshooting: dependency:tree, conflicts, scopes and Surefire',
  level: 'INTERMEDIATE',
  tags: ['maven', 'dependencies', 'dependency-tree', 'surefire', 'troubleshooting'],
  estMinutes: 15,
  scenario: `Monday morning, three Maven problems in the team chat: after adding a reporting library the suite dies with
\`NoSuchMethodError\` inside Selenium; a new \`CheckoutChecks\` class never runs on CI; and someone "fixed" a red build
with \`-DskipTests\`. As the person who set up the pom, you are the one they ask.`,
  description: `Answer the questions about diagnosing Maven problems in the ShopEasy framework.`,
  questions: [
    {
      q: 'After adding a third-party reporting library, tests fail with `java.lang.NoSuchMethodError: org.openqa.selenium...`. Which command shows you why?',
      options: [
        '`mvn clean`',
        '`mvn dependency:tree -Dincludes=org.seleniumhq.selenium` — it shows which library pulled in which Selenium version',
        '`mvn test -X`',
        '`mvn versions:display-plugin-updates`',
      ],
      answer: 1,
      why: '`NoSuchMethodError` at runtime almost always means two versions of the same library: you compiled against one and a different one ended up on the classpath. `dependency:tree` prints the whole graph, including transitive dependencies (the libraries your libraries need); `-Dincludes` filters it, and `-Dverbose` also shows the versions Maven omitted.',
    },
    {
      q: 'The tree shows the reporting library brings in an old `selenium-api 3.141.59`. What is the cleanest fix?',
      options: [
        'Delete the jar from `~/.m2` by hand every morning',
        'Add an `<exclusions>` block for `org.seleniumhq.selenium` to the reporting dependency (or pin the version in `<dependencyManagement>`), then check the tree again',
        'Downgrade your own Selenium to 3.141.59',
        'Copy the Selenium classes into `src/test/java`',
      ],
      answer: 1,
      why: 'Maven picks the "nearest" version in the graph, which is not always the newest. Excluding the transitive copy (or forcing one version in `<dependencyManagement>`) leaves exactly one Selenium on the classpath. Always re-run `dependency:tree` to confirm.',
    },
    {
      q: 'A new class `CheckoutChecks` with `@Test` methods runs from IntelliJ but `mvn test` (no testng.xml configured) never runs it. Why?',
      options: [
        'TestNG ignores classes in sub-packages',
        'By default Surefire only picks classes named `Test*`, `*Test`, `*Tests` or `*TestCase`; rename it to `CheckoutTest` (or configure `<includes>` / a suite XML)',
        'The class must be `final`',
        'Maven only runs tests on Mondays',
      ],
      answer: 1,
      why: 'Without `<suiteXmlFiles>`, Surefire discovers classes by name pattern. A class with another name is compiled but silently not run — always compare the test count in the Maven summary with what you expect.',
    },
    {
      q: '`mvn test` fails to compile `ExtentReportListener` with "package com.aventstack.extentreports does not exist", but the listener is in `src/main/java` and the dependency has `<scope>test</scope>`. What is wrong?',
      options: [
        'The internet is down',
        'Test-scoped dependencies are only visible to `src/test/java`; either move the listener to `src/test/java` or give the dependency compile scope',
        'Listeners cannot use external libraries',
        'You need `mvn install` first',
      ],
      answer: 1,
      why: 'Scope decides which code can see a library. `test` scope = only test code. Most test-only repositories keep everything in `src/test/java`, which avoids this whole class of error.',
    },
    {
      q: 'What is the difference between `-DskipTests` and `-Dmaven.test.failure.ignore=true`?',
      options: [
        'They are the same',
        '`-DskipTests` does not run tests at all; `-Dmaven.test.failure.ignore=true` runs them but keeps the build green when they fail',
        '`-DskipTests` only skips failed tests',
        '`-Dmaven.test.failure.ignore` deletes failing tests',
      ],
      answer: 1,
      why: 'Neither belongs in a test pipeline by default. Skipping hides everything; ignoring failures turns the build green with red tests inside. Some Jenkins setups use failure.ignore together with the junit step marking the build UNSTABLE — a deliberate choice, not a fix.',
    },
    {
      q: 'CI says "Could not resolve dependencies… cached in the local repository, resolution will not be reattempted" for a version that now exists. Quickest fix?',
      options: [
        'Reinstall Java',
        'Run once with `-U` (force update of snapshots/failed lookups), e.g. `mvn -U clean test`',
        'Rename the project',
        'Use `-o` (offline)',
      ],
      answer: 1,
      why: 'Maven caches failed lookups in `~/.m2`. `-U` forces it to check the remote repository again. `-o` does the opposite (offline mode).',
    },
  ],
  hints: ['NoSuchMethodError = two versions of one library.', 'Scope decides who can see a library; Surefire name patterns decide which classes run.'],
  explanation: `Your Maven troubleshooting toolkit:

\`\`\`text
mvn dependency:tree                                   # full graph, including transitive deps
mvn dependency:tree -Dincludes=org.seleniumhq.selenium  # only Selenium artefacts
mvn dependency:tree -Dverbose                          # also show versions Maven omitted (conflicts)
mvn help:effective-pom                                # the pom after profiles and parents are applied
mvn -U clean test                                     # re-check remote repositories
\`\`\`

Fixing a conflict:
\`\`\`xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>fancy-reporter</artifactId>
  <version>2.1.0</version>
  <exclusions>
    <exclusion>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>*</artifactId>
    </exclusion>
  </exclusions>
</dependency>
\`\`\`
or force a version for the whole project in \`<dependencyManagement>\` (a Selenium BOM, \`selenium-bom\` imported with
\`<scope>import</scope>\`, is the tidy way to keep all Selenium modules aligned).

Habits that prevent Monday mornings: versions in \`<properties>\`, one test-only source folder, a suite XML or explicit
Surefire \`<includes>\`, and reading the "Tests run: N" line after every change.`,
  mistakes: [
    'Deleting ~/.m2 folders by hand instead of finding the conflicting dependency.',
    'Naming test classes without the Test suffix and not noticing they never run.',
    'Using -DskipTests or failure.ignore to "fix" a red build.',
    'Putting framework code in src/main/java while its libraries are test-scoped.',
  ],
  interview: [
    { q: 'How do you resolve a dependency conflict in Maven?', a: 'Run mvn dependency:tree (with -Dincludes or -Dverbose) to see which dependency brings the unwanted version, then exclude it with <exclusions> or pin one version via <dependencyManagement> or a BOM, and verify the tree again.' },
    { q: 'What is a transitive dependency?', a: 'A library your declared dependency needs. Maven downloads it automatically; when two paths bring different versions, Maven chooses the nearest one in the graph, which can cause runtime errors such as NoSuchMethodError.' },
    { q: 'Why might mvn test run zero tests?', a: 'Surefire did not find them: class names not matching the default patterns, a wrong suite XML path or package name, groups filtering everything out, or a JUnit/TestNG provider mismatch. Check the Tests run count and the Surefire configuration.' },
  ],
}
