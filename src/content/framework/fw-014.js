export default {
  id: 'fw-014',
  category: 'framework',
  kind: 'quiz',
  title: 'EXPERT: design the framework folder structure for a new project',
  level: 'EXPERT',
  tags: ['framework-design', 'architecture', 'folder-structure', 'cucumber', 'testng'],
  estMinutes: 25,
  scenario: `ShopEasy is launching a second product, and you are asked to set up the UI automation framework **from scratch**
for a team of four (two of them ex-manual testers like you). In the kickoff, the architect says: *"Show me the folder
structure and tell me where each thing lives and why. If a new joiner can't find the login locator in 10 seconds, the
design failed."*`,
  description: `Answer the design questions. The full reference tree is in the explanation; try to sketch your own first.

Assume Maven, Java 17, Selenium 4, TestNG, Cucumber 7, POM, Extent/Allure, Log4j2, Jenkins + GitHub Actions.`,
  questions: [
    {
      q: 'Where should page objects live in a Maven test-only project?',
      options: [
        '`src/test/resources/pages`',
        '`src/test/java/com/shopeasy/pages` (or `src/main/java/...` if you publish the framework as a library)',
        'Next to each test class in the same package',
        'In the project root',
      ],
      answer: 1,
      why: 'Java code goes under src/*/java. In a test-only repo everything is usually in src/test/java; teams that share pages/utilities across several test repos put the framework in src/main/java and package it as a jar. resources is for non-code files.',
    },
    {
      q: 'Which split of packages best follows "separate what changes for different reasons"?',
      options: [
        '`tests` only, with everything inside test classes',
        '`pages` (+ `components`), `core`/`driver` (DriverManager, BaseTest), `config`, `utils`, `listeners`/`reporting`, `data` (POJOs/readers), `tests`, `stepdefinitions` + `runners` for Cucumber',
        'One package per developer',
        '`selenium`, `java`, `maven`',
      ],
      answer: 1,
      why: 'UI changes touch pages; infrastructure changes touch core/config; reporting changes touch listeners; new coverage touches tests or features/steps. Each reason to change has one home, so a new joiner can navigate by intent.',
    },
    {
      q: 'Where do `.feature` files, `config/qa.properties`, `testdata/*.json` and `log4j2.xml` go?',
      options: [
        '`src/test/java` next to the step definitions',
        '`src/test/resources` (features/, config/, testdata/, log4j2.xml) so they are on the classpath',
        'In `target/`',
        'On a shared network drive',
      ],
      answer: 1,
      why: 'Resources are copied to target/test-classes and loaded via the classpath in IDE, Maven and CI alike. target/ is generated output and deleted by mvn clean. Network drives break CI and versioning.',
    },
    {
      q: 'Cucumber step definitions vs page objects: what is the correct relationship?',
      options: [
        'Step definitions contain the locators so feature files stay readable',
        'Step definitions are thin glue: they translate Gherkin to page object calls and assertions; pages hold locators and actions',
        'Page objects call step definitions',
        'Skip page objects when using Cucumber',
      ],
      answer: 1,
      why: 'Cucumber is a layer on top of POM, not a replacement. Thin steps + rich pages means the same pages serve TestNG tests and Cucumber scenarios. Share driver/state between step classes with PicoContainer dependency injection.',
    },
    {
      q: 'Which items belong in `.gitignore`?',
      options: [
        '`src/test/resources/features`',
        '`target/`, IDE folders (`.idea/`, `*.iml`), local override files with secrets, `allure-results/`',
        '`pom.xml`',
        '`testng.xml`',
      ],
      answer: 1,
      why: 'Generated output, IDE settings and secrets never go into git. pom.xml, suite files and features are source and must be versioned.',
    },
    {
      q: 'The architect asks for one principle to keep the framework maintainable for two years. Which is strongest?',
      options: [
        'Maximise the number of utility methods',
        'Every layer has one responsibility and depends only downward: tests/steps → pages/components → core (driver, waits, config); no test code in pages, no locators in tests, no driver creation outside core',
        'Put everything in one module to avoid imports',
        'Use inheritance for everything',
      ],
      answer: 1,
      why: 'A clear layered dependency direction is what keeps a framework reviewable and changeable. It also makes onboarding trivial: the folder you open tells you what kind of code you will find.',
    },
  ],
  hints: ['Code under src/test/java, everything else under src/test/resources.', 'One reason to change → one package.'],
  explanation: `Reference structure (this is a good answer to draw on a whiteboard in an interview):

\`\`\`text
shopeasy-ui-tests/
├── pom.xml
├── testng.xml                     # default suite (or testng-smoke.xml / testng-regression.xml)
├── Jenkinsfile
├── .github/workflows/ui-tests.yml
├── .gitignore                     # target/, .idea/, *.iml, allure-results/, local secrets
├── README.md                      # how to run locally / on CI
└── src/test/
    ├── java/com/shopeasy/
    │   ├── core/                  # DriverManager (ThreadLocal), DriverFactory, BaseTest
    │   ├── config/                # ConfigReader
    │   ├── pages/                 # BasePage, LoginPage, InventoryPage, CartPage, CheckoutPage...
    │   │   └── components/        # HeaderComponent, ProductCard, Modal
    │   ├── data/                  # POJOs (Customer, User) + TestDataReader (JSON/Excel)
    │   ├── utils/                 # WaitUtils, JsUtils, DateUtils (small and focused)
    │   ├── listeners/             # TestListener (screenshots), RetryAnalyzer, ExtentReportListener
    │   ├── tests/                 # TestNG tests: LoginTest, CartTest, CheckoutTest
    │   └── cucumber/
    │       ├── runners/           # TestRunner extends AbstractTestNGCucumberTests
    │       ├── steps/             # LoginSteps, CartSteps (thin glue)
    │       └── hooks/             # Hooks (@Before/@After, screenshot on failure)
    └── resources/
        ├── config/                # local.properties, qa.properties, uat.properties
        ├── features/              # login.feature, checkout.feature
        ├── testdata/              # checkout-customers.json, users.xlsx
        ├── log4j2.xml
        └── extent.properties      # (if using the Extent Cucumber adapter)
\`\`\`

Dependency direction: **tests / steps → pages → core/config/utils**. Listeners and reporting observe from the side.

How to present it: start with the layers (tests, pages, core), then supporting concerns (config, data, reporting,
logging), then execution (testng.xml, Maven, CI). Mention what you deliberately **left out** (no Excel until BAs need
it, no Selenium Grid until parallel capacity runs out) — architects love seeing YAGNI.`,
  mistakes: [
    'Putting feature files or properties under src/test/java so they are not on the classpath.',
    'A utils package that grows into a dumping ground of static methods.',
    'Locators inside step definitions.',
    'Committing target/ or secrets.',
  ],
  interview: [
    { q: 'Explain the architecture of your automation framework.', a: 'A Maven Java 17 project with layered packages: core (ThreadLocal DriverManager, BaseTest), config (env-specific properties via -Denv), pages and components (POM with BasePage explicit waits), data (JSON/Excel readers), listeners (screenshots, retry, Extent/Allure), and tests plus Cucumber runners, steps and hooks. Resources hold features, config, test data and log4j2.xml. It runs via testng.xml and mvn with -D parameters on Jenkins/GitHub Actions in headless mode with reports published on every build.' },
    { q: 'How do TestNG and Cucumber fit together in one framework?', a: 'Cucumber scenarios run through a TestNG runner class (AbstractTestNGCucumberTests). Both TestNG tests and Cucumber step definitions use the same page objects and DriverManager, so there is one set of pages and infrastructure and two ways to express tests.' },
    { q: 'What would you not build on day one?', a: 'Grid/cloud execution, Excel readers, custom report frameworks and generic utilities until there is a real need. Start with a thin, clean core and grow it as the suite grows.' },
  ],
}
