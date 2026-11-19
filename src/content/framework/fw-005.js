export default {
  id: 'fw-005',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'testng.xml: smoke vs regression groups, parallel methods',
  level: 'BEGINNER',
  tags: ['testng', 'testng.xml', 'groups', 'parallel'],
  estMinutes: 15,
  scenario: `The release manager wants a **10-minute smoke run** on every deployment to QA and the full regression nightly.
Your tests are already tagged with \`@Test(groups = {"smoke"})\` / \`"regression"\`. Now the suite file has to select
them, run in parallel to save time, and pass the browser to \`BaseTest\`.`,
  description: `Write \`testng.xml\` (XML in the Java editor).

**Rules**
- \`<suite>\` named "ShopEasy Smoke" with \`parallel="methods"\` and \`thread-count="4"\`.
- A \`<parameter name="browser" value="chrome"/>\` (read by \`@Parameters("browser")\` in BaseTest).
- A \`<test>\` that **includes** the group \`smoke\` and **excludes** \`wip\`.
- Use \`<packages>\` (\`com.shopeasy.tests\`) or list the classes.
- Add the listener \`com.shopeasy.listeners.TestListener\` (built in fw-008).`,
  starterCode: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy">
  <test name="All">
    <classes>
      <class name="com.shopeasy.tests.LoginTest"/>
      <class name="com.shopeasy.tests.CartTest"/>
      <class name="com.shopeasy.tests.CheckoutTest"/>
    </classes>
  </test>
</suite>
`,
  solution: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy Smoke" parallel="methods" thread-count="4" verbose="1">

  <listeners>
    <listener class-name="com.shopeasy.listeners.TestListener"/>
  </listeners>

  <parameter name="browser" value="chrome"/>

  <test name="Smoke - Chrome">
    <groups>
      <run>
        <include name="smoke"/>
        <exclude name="wip"/>
      </run>
    </groups>
    <packages>
      <package name="com.shopeasy.tests"/>
    </packages>
  </test>

</suite>
`,
  checks: [
    { label: 'Parallel methods with a thread count', pattern: '<suite[^>]*parallel\\s*=\\s*"methods"[^>]*thread-count\\s*=\\s*"\\d+"|<suite[^>]*thread-count\\s*=\\s*"\\d+"[^>]*parallel\\s*=\\s*"methods"', hint: '<suite name="..." parallel="methods" thread-count="4">' },
    { label: 'browser parameter', pattern: '<parameter\\s+name\\s*=\\s*"browser"\\s+value\\s*=\\s*"\\w+"', hint: '<parameter name="browser" value="chrome"/>' },
    { label: 'Includes the smoke group', pattern: '<groups>[\\s\\S]*<run>[\\s\\S]*<include\\s+name\\s*=\\s*"smoke"', hint: '<groups><run><include name="smoke"/></run></groups>' },
    { label: 'Excludes wip', pattern: '<exclude\\s+name\\s*=\\s*"wip"', hint: '<exclude name="wip"/>' },
    { label: 'Selects tests by package or class', pattern: '<(package|class)\\s+name\\s*=\\s*"com\\.shopeasy', hint: '<packages><package name="com.shopeasy.tests"/></packages>' },
    { label: 'Registers the listener', pattern: '<listener\\s+class-name\\s*=\\s*"[\\w.]+TestListener"', hint: '<listeners><listener class-name="com.shopeasy.listeners.TestListener"/></listeners>' },
  ],
  hints: [
    'parallel and thread-count are attributes of <suite> (or <test>).',
    'Groups go inside <test>: <groups><run><include name="smoke"/></run></groups>.',
    'Parameters declared at suite level are visible to every <test>.',
  ],
  explanation: `\`testng.xml\` is the **execution plan**: which tests, which groups, how parallel, which parameters and listeners.

- **Groups** decouple *what a test is* (smoke/regression/wip, set in code) from *what we run today* (set in XML or
  on the command line with \`-Dgroups=smoke\`). Exclude wins over include.
- **\`parallel="methods"\`** runs test methods concurrently on \`thread-count\` threads. It only works if every test
  gets its own driver (ThreadLocal + \`@BeforeMethod\`). Other modes: \`classes\` (safer for tests that share class
  state), \`tests\` (one thread per \`<test>\` tag — great for cross-browser: one \`<test>\` per browser with its own parameter).
- Typical repo setup: \`testng-smoke.xml\`, \`testng-regression.xml\`, chosen via \`-DsuiteXmlFile=...\` (fw-001).

Cross-browser variant: two \`<test>\` blocks, each with its own \`<parameter name="browser" .../>\`, and \`parallel="tests"\`.`,
  mistakes: [
    'Turning on parallel="methods" with a static driver: tests type into each other’s browsers.',
    'Thread count larger than the CI agent can handle (each thread is a full browser).',
    'Forgetting alwaysRun = true on @BeforeMethod when running by group: config methods without a group are skipped.',
  ],
  interview: [
    { q: 'How do you run only smoke tests?', a: 'Tag tests with groups = {"smoke"} and either include the group in testng.xml under <groups><run><include name="smoke"/></run></groups> or run mvn test -Dgroups=smoke. Configuration methods need alwaysRun = true or the same group so they still execute.' },
    { q: 'What parallel modes does TestNG support?', a: 'methods, classes, tests and instances, configured with parallel and thread-count on suite or test. DataProviders can also run in parallel with parallel = true.' },
  ],
}
