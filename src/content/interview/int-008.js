export default {
  id: 'int-008',
  category: 'interview',
  kind: 'quiz',
  title: 'Test data management: where does your data come from?',
  level: 'ADVANCED',
  tags: ['test-data', 'config', 'json', 'api-setup', 'scenario-outline'],
  estMinutes: 15,
  scenario: `"How do you manage test data?" is where manual testers usually shine — you've prepared data for years. The challenge is describing it in **automation** terms: config per environment, data files, data created via APIs, unique data for parallel runs, cleanup, and keeping secrets out of Git.`,
  description: `Answer the questions; the explanation gives a reusable answer.`,
  hints: [
    'Separate: config (URLs, users per env) vs test data (products, addresses) vs generated data (unique emails).',
    'Fastest and most reliable setup is via API/DB, not via UI.',
  ],
  questions: [
    {
      q: 'Where should environment-specific values like base URL and default user live?',
      options: [
        'Hard-coded in page objects',
        'In config files per environment (qa.properties, staging.properties) selected with -Denv, with secrets injected from Jenkins credentials or environment variables',
        'In the feature files',
        'In a static String in the test class',
      ],
      answer: 1,
      why: 'Config files make the same tests run on any environment. Passwords and API keys must not be committed — read them from environment variables/Jenkins credentials. Interviewers like hearing you thought about security.',
    },
    {
      q: 'A scenario needs an existing order in "Shipped" status. What is the most reliable way to get it?',
      options: [
        'Ask a colleague to create one manually each sprint',
        'Hard-code order #10045 that exists on QA today',
        'Create the order (and set its status) through an API or DB setup step in the Given / @Before, then verify via the UI',
        'Create it through 15 UI steps in every test',
      ],
      answer: 2,
      why: 'Creating preconditions via API is fast, independent and survives database refreshes. Hard-coded records disappear (a classic "environment" failure) and UI setup is slow and fragile. "Given an order in Shipped status exists" maps nicely to an API helper.',
    },
    {
      q: 'Which Cucumber feature is designed for running the same scenario with several data sets?',
      options: [
        'Background',
        'Scenario Outline with an Examples table',
        'Hooks',
        'Tags',
      ],
      answer: 1,
      why: 'Scenario Outline + Examples runs the scenario once per row — great for validation rules (invalid emails, boundary values). Background is shared setup; DataTables pass structured data to a single step. TestNG\'s equivalent is @DataProvider.',
    },
    {
      q: 'In parallel runs, two scenarios register the same email and one fails with "Email already exists". Best fix?',
      options: [
        'Run tests sequentially',
        'Generate unique data per run/scenario (e.g. "user_" + System.currentTimeMillis() + "@test.com" or UUID) and clean up created data afterwards where needed',
        'Retry the failed scenario',
        'Ask the developers to remove the uniqueness rule',
      ],
      answer: 1,
      why: 'Unique, generated data removes collisions. Libraries like JavaFaker/Datafaker help create realistic names and addresses. Cleanup (API delete or DB reset) keeps environments tidy.',
    },
    {
      q: 'Which data source fits which use case best?',
      options: [
        'Excel for everything, because business people like it',
        'JSON/YAML files for structured data (users, addresses, products), Examples tables for small business-visible variations, API/DB for preconditions, generated data for unique fields',
        'Only hard-coded values',
        'Only a production database copy',
      ],
      answer: 1,
      why: 'Mature frameworks mix sources deliberately. Excel (Apache POI) is still used in some companies — mention it if your project did — but JSON is easier to version in Git and review in PRs.',
    },
  ],
  explanation: `**Model answer:**
> "We separate three kinds of data. **Configuration** — base URL, default users, timeouts — lives in properties files per environment, chosen with \`-Denv=qa\`; passwords come from Jenkins credentials, not Git. **Static test data** — addresses, product names, card test numbers — is in JSON files, read with Jackson into POJOs, and small business variations are in Scenario Outline Examples. **Dynamic data** — anything that must be unique like emails or order references — is generated at runtime with a timestamp or Datafaker.
>
> For preconditions, we create data through **APIs** in the Given steps — for example creating a user and an order before testing order history — which made tests faster and independent of database refreshes. Created data is cleaned up in the After hook where the API allows it."

Your manual experience is an asset here: mention boundary values, equivalence classes and realistic data you designed.`,
  mistakes: [
    'Hard-coding environment URLs and passwords in code.',
    'Depending on manually created records that disappear after a DB refresh.',
    'Using the same user/data across parallel tests.',
    'Creating every precondition via slow UI flows.',
  ],
  interview: [
    { q: 'How do you manage test data in your framework?', a: 'Config per environment in properties files selected by -Denv, secrets from Jenkins credentials; static data in JSON files mapped to POJOs; Scenario Outline Examples for business variations; unique values like emails generated at runtime; and preconditions such as users or orders created via API in Given steps, with cleanup in hooks. That keeps tests independent and parallel-safe.' },
    { q: 'Have you used Excel for test data?', a: 'Answer honestly. If yes: we read it with Apache POI through a small ExcelReader utility, mainly for large data-driven sets the business maintained. If not: we preferred JSON because it is easier to version in Git and review in pull requests, but I know Apache POI is the usual library.' },
  ],
}
