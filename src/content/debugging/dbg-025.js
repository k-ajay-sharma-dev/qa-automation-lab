export default {
  id: 'dbg-025',
  category: 'debugging',
  kind: 'quiz',
  title: 'NoSuchMethodError and friends: when Maven puts the wrong jar on the classpath',
  level: 'ADVANCED',
  tags: ['maven', 'dependency-conflict', 'NoSuchMethodError', 'dependency-tree', 'ci', 'jdk'],
  estMinutes: 20,
  scenario: `The mobile team asked to share the ShopEasy framework, so someone added the **Appium java-client** to the web project's \`pom.xml\`. The code compiles. Then every web test dies inside \`new ChromeDriver(...)\` with an error none of you has seen before — and over the same week two other "it builds on my machine" problems appear in CI. You are the person who reads build files. Time to explain what Maven did.`,
  description: 'Each question shows a real-world build excerpt. Choose the best diagnosis or fix.',
  hints: [
    'Compiled fine + NoSuchMethodError / NoClassDefFoundError at runtime = a different version of a library is on the runtime classpath.',
    'mvn dependency:tree -Dverbose shows which version won and which were "omitted for conflict".',
  ],
  questions: [
    {
      q: `Every web test fails at driver creation:

\`\`\`text
java.lang.NoSuchMethodError: 'void org.openqa.selenium.remote.service.DriverFinder.<init>(org.openqa.selenium.remote.service.DriverService, org.openqa.selenium.Capabilities)'
	at org.openqa.selenium.chrome.ChromeDriver.generateExecutor(ChromeDriver.java:99)
	at org.openqa.selenium.chrome.ChromeDriver.<init>(ChromeDriver.java:88)
	at com.shopeasy.driver.DriverFactory.createDriver(DriverFactory.java:27)
\`\`\`

The project compiled without errors. What does this error tell you?`,
      options: [
        'ChromeDriver and Chrome have different versions — update the browser',
        'The DriverFactory code has a typo',
        'At runtime a class from one jar (selenium-chrome-driver) called a method that the loaded version of another jar (selenium-remote-driver) does not have — two Selenium versions are mixed on the classpath',
        'The JVM ran out of memory while loading classes',
      ],
      answer: 2,
      why: 'NoSuchMethodError is a linkage error: the calling code was compiled against a version where that constructor exists, but the class actually loaded at runtime is an older (or newer) version without it. Browser/driver mismatches produce SessionNotCreatedException, typos fail compilation, and memory problems give OutOfMemoryError.',
    },
    {
      q: `You run \`mvn dependency:tree -Dverbose -Dincludes=org.seleniumhq.selenium\`:

\`\`\`text
[INFO] com.shopeasy:shopeasy-tests:jar:1.0-SNAPSHOT
[INFO] +- io.appium:java-client:jar:9.0.0:test
[INFO] |  +- org.seleniumhq.selenium:selenium-api:jar:4.14.1:test
[INFO] |  +- org.seleniumhq.selenium:selenium-remote-driver:jar:4.14.1:test
[INFO] |  \\- org.seleniumhq.selenium:selenium-support:jar:4.14.1:test
[INFO] \\- org.seleniumhq.selenium:selenium-java:jar:4.21.0:test
[INFO]    +- (org.seleniumhq.selenium:selenium-api:jar:4.21.0:test - omitted for conflict with 4.14.1)
[INFO]    +- org.seleniumhq.selenium:selenium-chrome-driver:jar:4.21.0:test
[INFO]    +- (org.seleniumhq.selenium:selenium-remote-driver:jar:4.21.0:test - omitted for conflict with 4.14.1)
[INFO]    \\- (org.seleniumhq.selenium:selenium-support:jar:4.21.0:test - omitted for conflict with 4.14.1)
\`\`\`

Why did Maven pick selenium-remote-driver **4.14.1**?`,
      options: [
        'Maven always picks the lowest version to be safe',
        'Maven "nearest definition wins"; both copies are at the same depth (2), so the one declared FIRST in the pom — via java-client — wins',
        'Maven always picks the highest version',
        'Because the local ~/.m2 cache had 4.14.1 already',
      ],
      answer: 1,
      why: 'Maven doesn\'t compare version numbers when resolving conflicts. It takes the version nearest to your project in the tree; on a tie, the first declaration in the pom wins. java-client was declared above selenium-java, so its 4.14.1 transitive versions won — and selenium-chrome-driver 4.21.0 now runs against remote-driver 4.14.1. (Gradle, by contrast, picks the highest version by default.)',
    },
    {
      q: 'What is the cleanest, longest-lasting fix?',
      options: [
        'Move selenium-java above java-client in the pom and hope the order is never changed',
        'Add <exclusions> for every Selenium artifact under java-client',
        'Pin one Selenium version for all modules with dependencyManagement — import org.seleniumhq.selenium:selenium-bom:4.21.0 (scope import) — and use a java-client version built for that Selenium line',
        'Delete ~/.m2/repository and rebuild',
      ],
      answer: 2,
      why: 'dependencyManagement (ideally the official selenium-bom) forces every Selenium artifact, direct or transitive, to one aligned version, regardless of declaration order. Then verify with dependency:tree and pick a java-client release compatible with that Selenium version. Re-ordering works by accident and breaks silently; exclusions are noisy and easy to miss for new artifacts; clearing the cache downloads the same conflict again. The maven-enforcer-plugin with dependencyConvergence can fail the build when such conflicts appear.',
    },
    {
      q: `Green locally, but the Jenkins build fails before any test runs:

\`\`\`text
[ERROR] There was an error in the forked process
[ERROR] java.lang.UnsupportedClassVersionError: com/shopeasy/tests/LoginTest has been compiled by a more recent version of the Java Runtime (class file version 61.0), this version of the Java Runtime only recognizes class file versions up to 55.0
\`\`\``,
      options: [
        'A TestNG bug — downgrade TestNG',
        'The classes were compiled for Java 17 (class file 61) but the agent runs the tests on Java 11 (55); configure the job to use JDK 17 (Jenkins tool / JAVA_HOME / toolchains)',
        'The test class is corrupted; run mvn clean',
        'LoginTest uses a Selenium API that Java 11 does not support',
      ],
      answer: 1,
      why: 'Class file versions map to Java releases: 52 = 8, 55 = 11, 61 = 17, 65 = 21. The message says exactly which compiled and which runs. Fix the JDK the job uses (and make maven.compiler.release=17 explicit in the pom so the requirement is documented). It typically happens when the stale target/ folder or a different stage compiled with another JDK than the one that runs Surefire.',
    },
    {
      q: `A teammate's new utilities module works on their laptop; CI says:

\`\`\`text
[ERROR] Failed to execute goal on project shopeasy-tests: Could not resolve dependencies for project com.shopeasy:shopeasy-tests:jar:1.0-SNAPSHOT:
The following artifacts could not be resolved: com.shopeasy:test-utils:jar:1.2.0-SNAPSHOT (absent):
Could not find artifact com.shopeasy:test-utils:jar:1.2.0-SNAPSHOT in central (https://repo.maven.apache.org/maven2)
\`\`\``,
      options: [
        'Maven Central is down — retry later',
        'test-utils only exists in the teammate\'s local ~/.m2 (they ran mvn install); CI has never seen it. Publish it to the team\'s repository (Nexus/Artifactory) or build it in the same multi-module reactor',
        'The version must not end in -SNAPSHOT',
        'Add test-utils.jar to the Git repository and reference it with <systemPath>',
      ],
      answer: 1,
      why: 'mvn install copies an artifact into your own local repository only. A clean CI agent resolves from configured remote repositories, and a company module is never on Maven Central. Publish it (mvn deploy to Nexus/Artifactory with the right settings.xml on CI) or make it a module of the same parent build. systemPath jars are deprecated and break transitive dependencies.',
    },
  ],
  explanation: `**Runtime linkage errors are build problems, not test problems.**
| Error | Meaning |
|---|---|
| \`NoSuchMethodError\` | Class found, but the loaded version lacks the method the caller was compiled against |
| \`NoClassDefFoundError\` / \`ClassNotFoundException\` | A class the caller needs isn't on the runtime classpath (missing or too old a jar) |
| \`UnsupportedClassVersionError\` | Compiled for a newer Java than the one running it |
| \`Could not resolve dependencies\` | The artifact isn't in any repository this machine can reach |

**Your toolkit:**
- \`mvn dependency:tree -Dverbose -Dincludes=<groupId>\` — who brought which version, and what was "omitted for conflict".
- \`dependencyManagement\` + BOMs (\`selenium-bom\`, \`jackson-bom\`, \`junit-bom\`) — one aligned version per library family.
- \`maven-enforcer-plugin\` rules (\`dependencyConvergence\`, \`requireJavaVersion\`) — fail fast in CI instead of at \`new ChromeDriver()\`.
- Log \`java -version\` and \`mvn -v\` at the start of every pipeline.

These failures have the "everything red, instantly, identically" shape of environment failures — classify them as **framework/build issues** in the triage report, not as product defects.`,
  mistakes: [
    'Assuming Maven picks the newest version in a conflict.',
    'Fixing a dependency conflict by re-ordering the pom without understanding why it worked.',
    'Clearing ~/.m2 as the first reaction to every build error.',
    'Reporting linkage errors as "Selenium is broken" or as product defects.',
  ],
  interview: [
    { q: 'How do you troubleshoot a NoSuchMethodError in a Maven project?', a: 'I know it means two versions of a library are mixed, so I run mvn dependency:tree -Dverbose for that group, see which transitive dependency pulled the older version and which one was omitted for conflict, then align versions with dependencyManagement or a BOM and verify the tree again. I also add the enforcer plugin so the build fails on such conflicts.' },
    { q: 'How does Maven choose between two versions of the same dependency?', a: 'Nearest definition wins: the version closest to the project in the dependency tree. If two are at the same depth, the first declared in the pom wins. Versions in dependencyManagement override both, which is why we manage Selenium through its BOM.' },
  ],
}
