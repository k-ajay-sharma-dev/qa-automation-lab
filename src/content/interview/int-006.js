export default {
  id: 'int-006',
  category: 'interview',
  kind: 'quiz',
  title: 'Parallel execution: ThreadLocal, Grid and thread-safe test data',
  level: 'EXPERT',
  tags: ['parallel', 'ThreadLocal', 'selenium-grid', 'testng', 'docker'],
  estMinutes: 20,
  scenario: `"How do you run your tests in parallel?" separates people who *read about* parallel from people who *suffered through it*. Follow-ups come fast: "Where do you configure the threads?", "How is the driver thread-safe?", "What about test data?", "Did you use Grid?". Prepare a layered answer: **config → driver isolation → data isolation → infrastructure**.`,
  description: `Answer the questions; the model answer below links them into one story.`,
  hints: [
    'Cucumber + TestNG: override scenarios() with @DataProvider(parallel = true).',
    'Thread count: dataproviderthreadcount in testng.xml or Surefire configuration.',
  ],
  questions: [
    {
      q: 'In a Cucumber + TestNG framework, how do you make scenarios run in parallel?',
      options: [
        'Add parallel = true to every feature file',
        'Override scenarios() in the runner with @DataProvider(parallel = true) and set the data-provider thread count in testng.xml (or Surefire)',
        'Use Thread.start() in each step definition',
        'It is impossible with Cucumber',
      ],
      answer: 1,
      why: 'AbstractTestNGCucumberTests exposes scenarios() as a data provider; marking it parallel lets TestNG run each scenario on its own thread. Thread count comes from data-provider-thread-count in testng.xml or the dataproviderthreadcount Surefire property. (With JUnit Platform, cucumber.execution.parallel.enabled=true is the equivalent.)',
    },
    {
      q: 'Why does the driver need to be in a ThreadLocal?',
      options: [
        'ThreadLocal makes Chrome faster',
        'So each thread has its own WebDriver instance; a static field would be shared, causing tests to drive each other\'s browser and NoSuchSessionException when one thread quits',
        'Because WebDriver is an interface',
        'ThreadLocal is required by Selenium Grid',
      ],
      answer: 1,
      why: 'ThreadLocal<WebDriver> gives every thread an isolated copy; hooks set it before the scenario and quit + remove() after. The classic symptom of a shared static driver is text typed into the wrong browser and random NoSuchSessionException.',
    },
    {
      q: 'Parallel tests now fail randomly with wrong cart counts. Drivers are already ThreadLocal. What is the most likely cause?',
      options: [
        'Chrome bug',
        'Shared test data — several threads log in as the same user and modify the same cart/orders',
        'Too many CPU cores',
        'Cucumber does not support parallel',
      ],
      answer: 1,
      why: 'Driver isolation is only half the job. Data must be isolated too: unique user per thread/scenario, data created per test via API, or unique identifiers (timestamps/UUIDs) in names and emails.',
    },
    {
      q: 'What does Selenium Grid add on top of local parallel execution?',
      options: [
        'Nothing',
        'Distributes sessions across multiple machines/containers and browser types (hub/router + nodes), so you can run many browsers and cross-browser combinations in parallel via RemoteWebDriver',
        'It replaces TestNG',
        'It records videos only',
      ],
      answer: 1,
      why: 'A single agent can only run so many browsers. Grid (often via docker-selenium images or a cloud provider like BrowserStack/Sauce Labs) scales out. The code change is creating a RemoteWebDriver with the grid URL and capabilities/options instead of new ChromeDriver().',
    },
    {
      q: 'Which item must ALSO be thread-safe for parallel runs?',
      options: [
        'Feature files',
        'Reporting (e.g. ExtentTest per thread), page objects/context holders, and any static helper holding state',
        'The pom.xml',
        'The .gitignore',
      ],
      answer: 1,
      why: 'Reporters writing to one shared "current test" object mix up logs between scenarios. Use ThreadLocal<ExtentTest> or the Cucumber adapter, and avoid static mutable fields anywhere — Cucumber\'s PicoContainer DI creates a fresh context per scenario.',
    },
  ],
  explanation: `**Layered model answer:**

> "We run scenarios in parallel through TestNG: the runner overrides \`scenarios()\` with \`@DataProvider(parallel = true)\` and Jenkins passes the thread count, usually 4 on our agent.
>
> **Driver isolation:** our DriverManager keeps the driver in a \`ThreadLocal<WebDriver>\` — the Before hook creates it, page objects get it from DriverManager, and the After hook quits it and calls \`remove()\`.
>
> **Data isolation:** each scenario creates its own user or uses one from a pool per thread, and anything we create — orders, addresses — gets a unique suffix, so threads never touch the same records.
>
> **Infrastructure:** for cross-browser and bigger runs we point RemoteWebDriver at a Selenium Grid running in Docker. Moving to parallel took our regression from about 2 hours to 35 minutes. The main issues we hit were a static driver and shared users, which is why the design looks like this."`,
  mistakes: [
    'Only mentioning parallel="methods" in testng.xml without explaining driver isolation.',
    'Forgetting test data isolation.',
    'Not calling ThreadLocal.remove() after quit.',
    'Setting threads higher than the agent\'s CPU/memory can handle, which creates new flakiness.',
  ],
  interview: [
    { q: 'How do you run your tests in parallel?', a: 'Our Cucumber runner extends AbstractTestNGCucumberTests and overrides scenarios() with @DataProvider(parallel = true); the thread count is set in testng.xml and Jenkins can override it. Each thread has its own browser through a ThreadLocal DriverManager, each scenario uses its own test data, and for cross-browser runs we use Selenium Grid in Docker with RemoteWebDriver.' },
    { q: 'What problems did you face with parallel execution?', a: 'First, a static WebDriver caused scenarios to interfere — text typed into the wrong browser and NoSuchSessionException — fixed with ThreadLocal. Second, shared users made carts collide, fixed with a user per thread and unique data. Third, too many threads on one agent made things slow and flaky, so we tuned it to 4 and moved bigger runs to Grid.' },
    { q: 'What is the difference between parallel="methods", "classes" and "tests" in TestNG?', a: 'methods runs each test method in its own thread, classes runs each class in one thread with different classes in parallel, and tests runs each <test> tag of testng.xml in parallel. For Cucumber we use parallel data providers instead, so each scenario is a parallel unit.' },
  ],
}
