export default {
  id: 'fw-018',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Maven profiles: mvn test -Pqa,smoke instead of long -D lists',
  level: 'BEGINNER',
  tags: ['maven', 'profiles', 'pom.xml', 'surefire', 'environments'],
  estMinutes: 15,
  scenario: `The Jenkins jobs, the README and three people's IntelliJ run configurations all contain slightly different
copies of \`mvn test -Denv=qa -DsuiteXmlFile=testng-smoke.xml -Dheadless=true\`. Yesterday one copy had \`-Denv=QA\`
(capital letters, file not found). Your lead wants named **Maven profiles** so a run is just \`mvn test -Pqa,smoke\`.`,
  description: `Add profiles to the \`pom.xml\` (XML in the Java editor).

**Rules**
- Default properties: \`env=local\`, \`suiteXmlFile=testng.xml\`, \`headless=false\`.
- Profiles: \`local\` (\`<activeByDefault>true</activeByDefault>\`), \`qa\` (env=qa, headless=true), \`uat\` (env=uat, headless=true),
  \`smoke\` (suiteXmlFile=testng-smoke.xml), \`regression\` (suiteXmlFile=testng-regression.xml).
- Surefire runs \`\${suiteXmlFile}\` and passes \`env\` and \`headless\` to the tests through \`<systemPropertyVariables>\`
  (so \`ConfigReader\` from fw-006 still reads \`System.getProperty("env")\`).`,
  starterCode: `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
  </properties>

  <!-- dependencies omitted -->

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
        <configuration>
          <suiteXmlFiles>
            <suiteXmlFile>testng.xml</suiteXmlFile>
          </suiteXmlFiles>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
  solution: `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.shopeasy</groupId>
  <artifactId>shopeasy-ui-tests</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <env>local</env>
    <headless>false</headless>
    <suiteXmlFile>testng.xml</suiteXmlFile>
  </properties>

  <!-- dependencies omitted -->

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
          <systemPropertyVariables>
            <env>\${env}</env>
            <headless>\${headless}</headless>
          </systemPropertyVariables>
        </configuration>
      </plugin>
    </plugins>
  </build>

  <profiles>
    <!-- environments -->
    <profile>
      <id>local</id>
      <activation>
        <activeByDefault>true</activeByDefault>
      </activation>
      <properties>
        <env>local</env>
      </properties>
    </profile>
    <profile>
      <id>qa</id>
      <properties>
        <env>qa</env>
        <headless>true</headless>
      </properties>
    </profile>
    <profile>
      <id>uat</id>
      <properties>
        <env>uat</env>
        <headless>true</headless>
      </properties>
    </profile>

    <!-- test selections -->
    <profile>
      <id>smoke</id>
      <properties>
        <suiteXmlFile>testng-smoke.xml</suiteXmlFile>
      </properties>
    </profile>
    <profile>
      <id>regression</id>
      <properties>
        <suiteXmlFile>testng-regression.xml</suiteXmlFile>
      </properties>
    </profile>
  </profiles>
</project>
`,
  checks: [
    { label: 'A <profiles> section', pattern: '<profiles>[\\s\\S]*<profile>[\\s\\S]*</profiles>', hint: '<profiles><profile><id>qa</id>...</profile></profiles>' },
    { label: 'qa profile sets env=qa', pattern: '<id>\\s*qa\\s*</id>[\\s\\S]*?<env>\\s*qa\\s*</env>', hint: '<profile><id>qa</id><properties><env>qa</env></properties></profile>' },
    { label: 'A default profile with activeByDefault', pattern: '<activeByDefault>\\s*true\\s*</activeByDefault>', hint: '<activation><activeByDefault>true</activeByDefault></activation>' },
    { label: 'smoke profile switches the suite file', pattern: '<id>\\s*smoke\\s*</id>[\\s\\S]*?<suiteXmlFile>\\s*testng-smoke\\.xml\\s*</suiteXmlFile>', hint: '<profile><id>smoke</id><properties><suiteXmlFile>testng-smoke.xml</suiteXmlFile></properties></profile>' },
    { label: 'Surefire uses the suiteXmlFile property', pattern: '<suiteXmlFiles>\\s*<suiteXmlFile>\\s*\\$\\{suiteXmlFile\\}', hint: '<suiteXmlFile>$' + '{suiteXmlFile}</suiteXmlFile>' },
    { label: 'env passed to tests as a system property', pattern: '<systemPropertyVariables>[\\s\\S]*?<env>\\s*\\$\\{env\\}\\s*</env>', hint: '<systemPropertyVariables><env>$' + '{env}</env></systemPropertyVariables>' },
  ],
  hints: [
    'A profile is a named bundle of properties: <profile><id>qa</id><properties>...</properties></profile>.',
    'Maven properties are not automatically system properties of the test JVM — Surefire <systemPropertyVariables> bridges them.',
    'Activate several at once with a comma: mvn test -Pqa,smoke.',
  ],
  explanation: `A **profile** is a named set of overrides that you switch on with \`-P\`:

\`\`\`text
mvn clean test                       # local profile (activeByDefault), testng.xml
mvn clean test -Pqa,smoke            # env=qa, headless=true, testng-smoke.xml
mvn clean test -Puat,regression      # env=uat, headless=true, testng-regression.xml
mvn clean test -Pqa -Dbrowser=firefox   # profiles and -D combine
\`\`\`

Two kinds of profiles that combine well: **where** (local/qa/uat) and **what** (smoke/regression). Two dimensions × a
handful of names replace every hand-typed \`-D\` list, and a typo like \`-Pqaa\` produces a Maven warning ("profile
not found") instead of a silent wrong environment.

The bridge that beginners miss: \`<properties>\` are **Maven** properties (used inside the pom as \`\${env}\`). Your
test code runs in a separate JVM forked by Surefire and reads **system properties**. \`<systemPropertyVariables>\`
copies \`\${env}\` and \`\${headless}\` across, so \`System.getProperty("env")\` in ConfigReader returns \`qa\`.

Note: \`activeByDefault\` switches off as soon as you activate **any** other profile with \`-P\`. That is why the
default values also live in the top-level \`<properties>\`. Check what is active with \`mvn help:active-profiles -Pqa,smoke\`.`,
  mistakes: [
    'Defining profile properties but never passing them to Surefire, so the tests still read the default env.',
    'Hard-coding testng.xml in Surefire, so the smoke profile changes nothing.',
    'Relying only on activeByDefault for defaults; it turns off when any other profile is activated.',
    'Putting secrets into profiles in the committed pom.xml.',
  ],
  interview: [
    { q: 'What are Maven profiles and how do you use them in a test framework?', a: 'Named sets of properties or configuration activated with -P. We use environment profiles (qa, uat) and suite profiles (smoke, regression), e.g. mvn test -Pqa,smoke, and Surefire passes the resulting values to the tests as system properties.' },
    { q: 'Profile vs -D system property?', a: 'A profile bundles several settings under one name and is versioned in the pom; -D sets one value ad hoc on the command line. They combine: -Pqa -Dbrowser=firefox, and an explicit -D usually overrides the profile value.' },
  ],
}
