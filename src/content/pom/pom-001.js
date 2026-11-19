export default {
  id: 'pom-001',
  category: 'pom',
  kind: 'quiz',
  title: 'Why Page Object Model? The 40-test copy-paste problem',
  level: 'BEGINNER',
  tags: ['pom', 'design', 'maintenance'],
  estMinutes: 10,
  scenario: `Sprint 14 on the ShopEasy team. A contractor automated 40 regression tests last quarter and every test
starts with the same three lines: \`driver.findElement(By.id("user-name"))\`, \`By.id("password")\`,
\`By.id("login-button")\`. The UI team just renamed the login button id to \`btn-login\` and the nightly run
shows **40 red tests**. Your lead asks you to explain in the retro why this happened and how Page Object Model prevents it.`,
  description: `Answer the questions. They are the same arguments you will make in a retro or an interview when someone
asks "why do we need page objects, the tests work fine?".

**Acceptance**
- You can explain the maintenance cost of duplicated locators.
- You can say what *belongs* in a page object and what does not.`,
  questions: [
    {
      q: `The login button id changed from \`login-button\` to \`btn-login\`. The locator is copy-pasted in 40 test methods. What is the **real** cost?`,
      options: [
        'Nothing serious, Find & Replace fixes it in a minute',
        '40 edits in 40 places; any missed copy keeps failing, and reviewers must re-check every test, so one UI change becomes a risky multi-file change',
        'Selenium will auto-heal the locator on the next run',
        'Only the first test fails, the rest reuse the cached element',
      ],
      answer: 1,
      why: `Find & Replace works only if every copy is written identically (\`By.id("login-button")\`, \`By.cssSelector("#login-button")\`, an XPath…). In practice they drift, and each missed copy is a red test someone has to triage. Selenium has no auto-healing and elements are never cached across tests. With POM the locator lives in **one** place: \`LoginPage\`.`,
    },
    {
      q: 'Which statement best describes the Page Object Model?',
      options: [
        'A Selenium library you add to pom.xml',
        'A design pattern: one class per page/component that hides locators and exposes the page’s behaviour as methods',
        'A way to make tests run in parallel',
        'A naming convention for test methods',
      ],
      answer: 1,
      why: 'POM is a **pattern**, not a library (Selenium’s PageFactory is just one optional helper). The page class owns *how* to interact with the page (locators, waits); the test owns *what* to check. It does not by itself give you parallelism.',
    },
    {
      q: 'In a well-designed page object, which of these should be **private**?',
      options: [
        'The action methods like `login(user, pass)`',
        'The constructor',
        'The `By` locators',
        'Nothing; everything should be public so tests are flexible',
      ],
      answer: 2,
      why: 'Locators are implementation details. If tests can reach `loginButton` directly, they will, and you are back to locators spread across tests. Expose behaviour (`login()`, `getErrorMessage()`), hide the locators.',
    },
    {
      q: 'A test reads `loginPage.login("standard_user", "secret_sauce"); assertTrue(inventoryPage.isLoaded());` What did POM buy you besides maintenance?',
      options: [
        'Faster execution',
        'Readability: the test reads like a manual test case, so a manual QA or BA can review it',
        'It removes the need for waits',
        'It makes the test immune to flakiness',
      ],
      answer: 1,
      why: 'Page objects make tests read like the steps you already write in test cases. Speed and flakiness depend on waits and environment, not on the pattern itself (although centralising waits in pages helps a lot).',
    },
    {
      q: 'Where should the check "error message says *Username is required*" live?',
      options: [
        'Inside `LoginPage.login()` with an `Assert.assertEquals`',
        'In the test: the page returns the message text via `getErrorMessage()`, the test asserts it',
        'In a static utility class',
        'In the `@AfterMethod`',
      ],
      answer: 1,
      why: 'Pages *report* state, tests *judge* it. If the page asserts, you cannot reuse `login()` for a negative test that *expects* a different message. We refactor exactly this in pom-004.',
    },
  ],
  hints: ['Think about how many files change when one locator changes.', 'Pages expose behaviour; tests verify outcomes.'],
  explanation: `**The core argument:** UI changes are guaranteed; the cost of a UI change should be *one edit*.
With POM, a renamed id means editing one \`By\` in \`LoginPage\`, and all 40 tests are green again.

Rules of thumb you will use for the rest of this track:
- One class per page (or reusable component like a header).
- Locators are \`private\` (usually \`private final By\`).
- Public methods describe user intent: \`login()\`, \`addToCart("Backpack")\`, \`getErrorMessage()\`.
- Navigation methods return the next page object.
- No assertions inside page objects.`,
  mistakes: [
    'Making locators public "just in case" a test needs them; tests then bypass the page methods.',
    'Creating one giant page object for the whole application.',
    'Putting assertions inside page methods, which kills reuse for negative tests.',
  ],
  interview: [
    { q: 'What is the Page Object Model and why do you use it?', a: 'A design pattern where each page or component is a class that encapsulates its locators and interactions. Tests call intention-revealing methods, so when the UI changes only the page class changes. It reduces duplication, improves readability and makes maintenance predictable.' },
    { q: 'Is POM the same as PageFactory?', a: 'No. POM is the pattern. PageFactory is an optional Selenium helper that initialises @FindBy fields via proxies. You can (and many teams do) implement POM with plain By locators.' },
  ],
}
