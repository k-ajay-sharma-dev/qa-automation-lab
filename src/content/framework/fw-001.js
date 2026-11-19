export default {
  id: 'fw-001',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Maven pom.xml: the dependencies of a test framework',
  level: 'BEGINNER',
  tags: ['maven', 'pom.xml', 'dependencies', 'surefire'],
  estMinutes: 15,
  scenario: `Day one of the ShopEasy automation project. The dev lead created an empty Maven project
(\`shopeasy-ui-tests\`) and says: *"Add whatever you need for Selenium, TestNG and Cucumber, and make \`mvn test\` run
our testng.xml."* Your manual-testing laptop never needed a pom.xml before — this is where every Java framework starts.`,
  description: `Complete the \`pom.xml\` (shown in the Java editor; it is XML).

**Rules**
- Use \`<properties>\` for versions and Java 17 (\`maven.compiler.release\` or source/target).
- Dependencies: \`org.seleniumhq.selenium:selenium-java\`, \`org.testng:testng\`, \`io.cucumber:cucumber-java\`
  and \`io.cucumber:cucumber-testng\` (TestNG runner for Cucumber).
- Test libraries use \`<scope>test</scope>\`.
- Configure \`maven-surefire-plugin\` with \`<suiteXmlFiles>\` pointing at \`testng.xml\`.`,
  starterCode: `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <!-- TODO: properties (java version, library versions) -->

  <dependencies>
    <!-- TODO: selenium, testng, cucumber -->
  </dependencies>

  <!-- TODO: surefire plugin running testng.xml -->
</project>
`,
  solution: `<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <selenium.version>4.27.0</selenium.version>
    <testng.version>7.10.2</testng.version>
    <cucumber.version>7.20.1</cucumber.version>
    <suiteXmlFile>testng.xml</suiteXmlFile>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>\${selenium.version}</version>
    </dependency>
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>\${testng.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-java</artifactId>
      <version>\${cucumber.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-testng</artifactId>
      <version>\${cucumber.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>\${suiteXmlFile}</suiteXmlFile>
          </suiteXmlFiles>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
  checks: [
    { label: 'selenium-java dependency', pattern: '<artifactId>\\s*selenium-java\\s*</artifactId>', hint: 'org.seleniumhq.selenium : selenium-java' },
    { label: 'testng dependency with test scope', pattern: '<artifactId>\\s*testng\\s*</artifactId>[\\s\\S]*?<scope>\\s*test\\s*</scope>', hint: 'org.testng : testng, scope test' },
    { label: 'Cucumber Java + TestNG runner', pattern: 'cucumber-java[\\s\\S]*cucumber-testng|cucumber-testng[\\s\\S]*cucumber-java', hint: 'io.cucumber : cucumber-java and cucumber-testng' },
    { label: 'Versions kept in <properties>', pattern: '<properties>[\\s\\S]*?\\.version>[\\s\\S]*?</properties>', hint: '<selenium.version>4.x</selenium.version> inside <properties>' },
    { label: 'Java 17 configured', pattern: '<maven\\.compiler\\.(release|source)>\\s*17\\s*<', hint: '<maven.compiler.release>17</maven.compiler.release>' },
    { label: 'Surefire runs testng.xml', pattern: 'maven-surefire-plugin[\\s\\S]*?<suiteXmlFile>', hint: '<suiteXmlFiles><suiteXmlFile>testng.xml</suiteXmlFile></suiteXmlFiles>' },
  ],
  hints: [
    'Every dependency is groupId + artifactId + version.',
    'Put versions in <properties> and reference them with dollar-brace syntax, e.g. selenium.version.',
    'Surefire is the plugin that runs tests during mvn test.',
  ],
  explanation: `**Maven in one paragraph:** \`pom.xml\` declares what your project needs; Maven downloads it from Maven
Central into \`~/.m2\` and runs the build lifecycle (\`compile → test → package…\`). \`mvn test\` runs the
**Surefire** plugin, which runs TestNG, which reads \`testng.xml\`.

Notes a reviewer checks:
- **Versions in \`<properties>\`** → one place to upgrade; both Cucumber artifacts must share the same version.
- **\`<scope>test</scope>\`** → libraries only on the test classpath. (Selenium is often left at compile scope in
  dedicated test projects where page objects live in \`src/main/java\`; either is fine if consistent.)
- **No WebDriverManager needed** with Selenium 4.6+: Selenium Manager resolves browser drivers automatically.
- Making \`suiteXmlFile\` a property lets CI run \`mvn test -DsuiteXmlFile=smoke.xml\`.
- Pin the Surefire version; the default one bundled with old Maven versions has TestNG quirks.`,
  mistakes: [
    'Mixing cucumber-java and cucumber-testng versions (NoSuchMethodError at runtime).',
    'Adding both junit and testng runners and wondering why tests are not picked up.',
    'Copying an old Selenium 3 snippet with selenium-chrome-driver + WebDriverManager.',
    'Not configuring Surefire, so mvn test ignores testng.xml.',
  ],
  interview: [
    { q: 'What happens when you run mvn test?', a: 'Maven runs the lifecycle phases up to test: validate, compile, test-compile and test. In the test phase the Surefire plugin executes tests, for TestNG using the configured suite XML files, and writes reports to target/surefire-reports.' },
    { q: 'What is dependency scope test?', a: 'The dependency is only available when compiling and running tests (src/test/java), not in the main code or the packaged artifact.' },
  ],
}
