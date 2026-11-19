export default {
  id: 'fw-017',
  category: 'framework',
  kind: 'code',
  language: 'java',
  title: 'Cross-browser testng.xml: one <test> per browser, parallel="tests"',
  level: 'BEGINNER',
  tags: ['testng', 'testng.xml', 'parameters', 'cross-browser', 'parallel'],
  estMinutes: 15,
  scenario: `Support tickets show 30% of ShopEasy customers use Firefox, but the smoke suite only ever runs on Chrome. The
QA lead asks for the same smoke tests on **Chrome and Firefox at the same time** in one run, with each browser
clearly separated in the report — without copying a single test class.`,
  description: `Write \`testng-crossbrowser.xml\` and the \`setUp\` method of \`BaseTest\` that reads the browser.

**Rules (XML)**
- \`<suite>\` with \`parallel="tests"\` and \`thread-count="2"\`.
- Two \`<test>\` blocks, "Smoke - Chrome" and "Smoke - Firefox", each with its **own** \`<parameter name="browser" .../>\`.
- Both include the group \`smoke\` and the package \`com.shopeasy.tests\`.

**Rules (Java)**
- \`@BeforeMethod(alwaysRun = true)\` + \`@Parameters("browser")\` on \`setUp\`.
- Use \`@Optional("chrome")\` so the class still runs from the IDE without the XML.
- Pass the value to \`DriverManager.initDriver(browser)\`.`,
  starterCode: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy Cross-browser">
  <parameter name="browser" value="chrome"/>
  <test name="Smoke">
    <packages>
      <package name="com.shopeasy.tests"/>
    </packages>
  </test>
</suite>

// ---- BaseTest.java (set-up only) ----
public class BaseTest {
    @BeforeMethod
    public void setUp() {
        DriverManager.initDriver("chrome");
    }
}
`,
  solution: `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="ShopEasy Cross-browser" parallel="tests" thread-count="2">

  <listeners>
    <listener class-name="com.shopeasy.listeners.TestListener"/>
  </listeners>

  <test name="Smoke - Chrome">
    <parameter name="browser" value="chrome"/>
    <groups>
      <run>
        <include name="smoke"/>
      </run>
    </groups>
    <packages>
      <package name="com.shopeasy.tests"/>
    </packages>
  </test>

  <test name="Smoke - Firefox">
    <parameter name="browser" value="firefox"/>
    <groups>
      <run>
        <include name="smoke"/>
      </run>
    </groups>
    <packages>
      <package name="com.shopeasy.tests"/>
    </packages>
  </test>

</suite>

// ---- BaseTest.java (set-up only) ----
public class BaseTest {

    @BeforeMethod(alwaysRun = true)
    @Parameters("browser")
    public void setUp(@Optional("chrome") String browser) {
        DriverManager.initDriver(browser);
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown() {
        DriverManager.quitDriver();
    }
}
`,
  checks: [
    { label: 'Suite runs <test> blocks in parallel', pattern: '<suite[^>]*parallel\\s*=\\s*"tests"', hint: '<suite name="..." parallel="tests" thread-count="2">' },
    { label: 'Chrome <test> with its own browser parameter', pattern: '<test[^>]*>\\s*<parameter\\s+name\\s*=\\s*"browser"\\s+value\\s*=\\s*"chrome"', hint: 'Put <parameter name="browser" value="chrome"/> inside the first <test>' },
    { label: 'Firefox <test> with its own browser parameter', pattern: '<test[^>]*>\\s*<parameter\\s+name\\s*=\\s*"browser"\\s+value\\s*=\\s*"firefox"', hint: 'A second <test> with value="firefox"' },
    { label: 'Smoke group included in both blocks', pattern: '<include\\s+name\\s*=\\s*"smoke"[\\s\\S]*<include\\s+name\\s*=\\s*"smoke"', hint: '<groups><run><include name="smoke"/></run></groups> in each <test>' },
    { label: 'setUp reads the parameter', pattern: '@Parameters\\s*\\(\\s*\\{?\\s*"browser"\\s*\\}?\\s*\\)[\\s\\S]*?void\\s+setUp\\s*\\(\\s*@Optional\\s*\\(\\s*"\\w+"\\s*\\)\\s*String\\s+\\w+\\s*\\)', hint: '@Parameters("browser") public void setUp(@Optional("chrome") String browser)' },
    { label: 'Browser passed to the driver, not hard-coded', pattern: 'initDriver\\s*\\(\\s*"', mustNot: true, hint: 'DriverManager.initDriver(browser);' },
  ],
  hints: [
    'parallel="tests" runs each <test> block on its own thread.',
    'A <parameter> inside a <test> overrides one with the same name on the <suite>.',
    '@Optional supplies the value when there is no testng.xml (running a single class from the IDE).',
  ],
  explanation: `\`parallel="tests"\` is the cleanest cross-browser setup: each \`<test>\` block gets its own thread, its own
parameter value and its own section in the report ("Smoke - Chrome", "Smoke - Firefox").

How the value travels: \`<parameter name="browser" value="firefox"/>\` → \`@Parameters("browser")\` →
\`setUp(String browser)\` → \`DriverManager.initDriver("firefox")\` → a Firefox driver stored in the ThreadLocal of
that thread. Test classes never mention a browser.

Points a reviewer checks:
- The parameter sits **inside** each \`<test>\`; a suite-level parameter would give both blocks the same browser.
- \`alwaysRun = true\` on set-up and tear-down, because the \`<test>\` filters by group and \`BaseTest\` methods have no group.
- \`@Optional("chrome")\` — without it, running one class from the IDE fails with *"Parameter 'browser' is required"*.
- \`thread-count="2"\` = two browsers at a time. Combining with \`parallel="methods"\` inside each block multiplies browsers; size it for the CI agent.

Alternative for CI: keep one \`<test>\` and pass \`-Dbrowser=firefox\` from a pipeline matrix (fw-022). The XML
approach suits "both browsers in one run"; the matrix suits "one job per browser".`,
  mistakes: [
    'Putting the browser parameter on the <suite>, so both <test> blocks run on the same browser.',
    'Forgetting @Optional, so the test cannot be run from the IDE without the XML.',
    'Using parallel="methods" with a driver created in @BeforeTest, so tests share one browser.',
    'Missing alwaysRun = true on BaseTest set-up while filtering by group.',
  ],
  interview: [
    { q: 'How do you run the same tests on several browsers?', a: 'Read the browser from a parameter in BaseTest (@Parameters with @Optional default) and define one <test> block per browser in testng.xml with its own parameter, running them with parallel="tests". In CI a matrix job passing -Dbrowser is an alternative.' },
    { q: 'What does @Optional do?', a: 'It provides a default value for a @Parameters argument when the parameter is not defined in testng.xml, for example when running a single class from the IDE.' },
  ],
}
