export default {
  id: 'pom-037',
  category: 'pom',
  kind: 'quiz',
  title: 'Unit-test the page object\'s logic without a browser',
  level: 'ADVANCED',
  tags: ['pom', 'unit-testing', 'refactoring', 'testability'],
  estMinutes: 12,
  scenario: `\`CheckoutOverviewPage.getSummary()\` broke twice this month: once when prices over $999 started showing as
\`$1,049.97\` and once when the tax label read \`$0.00\` for an empty cart. Each fix needed a 90-second UI run to verify.
Your lead says: "The parsing is plain Java. Why do we need Chrome to test it?"`,
  description: 'Choose how to make the parsing logic of your page objects testable in milliseconds.',
  questions: [
    {
      q: 'The page has `private BigDecimal toMoney(String text)`. What is the cleanest first step to unit test it?',
      options: [
        'Make it public and call it on a `new CheckoutOverviewPage(null)`',
        'Extract it to a small class with no WebDriver, e.g. `Money.parse(String)`, and have the page call it',
        'Use reflection to call the private method',
        'Copy the logic into the unit test',
      ],
      answer: 1,
      why: 'Extracting pure logic into a helper keeps the page focused on the screen and gives you a function you can test directly. Constructing a page with a null driver, or using reflection, couples the test to internals and breaks on the next refactor; copying logic tests the copy, not the code.',
    },
    {
      q: 'Which unit test is most valuable for `Money.parse`?',
      options: [
        '```java\n@Test void parsesSimple() { assertEquals(new BigDecimal("29.99"), Money.parse("$29.99")); }\n```',
        'A data-driven test covering `"$29.99"`, `"$1,049.97"`, `"$0.00"` and `" $9.99 "` (whitespace)',
        'A test that opens checkout.html and compares the total',
        'No test; the UI suite will catch it',
      ],
      answer: 1,
      why: 'The two production bugs were thousands separators and zero values, so the edge cases are exactly what the unit test must cover. A data-driven test (TestNG `@DataProvider` or JUnit `@ParameterizedTest`) documents all formats in one place and runs in milliseconds.',
    },
    {
      q: 'Where should these unit tests live and run?',
      options: [
        'In the same Maven module (`src/test/java/.../support/MoneyTest.java`), in a fast group that runs on every build before the UI suite',
        'Only in the nightly UI regression',
        'In a separate repository',
        'Inside the page object as a `main()` method',
      ],
      answer: 0,
      why: 'Framework code is code: its unit tests sit next to it and run first, so a broken helper fails the build in seconds instead of making 200 UI tests fail mysteriously overnight.',
    },
    {
      q: 'A teammate wants to unit test `CheckoutOverviewPage.getSummary()` itself by mocking `WebDriver` and `WebElement` with Mockito. What is the best response?',
      options: [
        'Great idea, mock every element so the whole page is covered',
        'It is possible, but low value: mocks re-state the locators and give false confidence. Unit test the extracted logic; verify locators and wiring with a few real UI tests',
        'Never write unit tests in a test-automation project',
        'Replace all UI tests with mocked page tests',
      ],
      answer: 1,
      why: 'Mocking WebDriver tests that the code calls findElement with the By you wrote; it cannot tell you the locator matches the real page. Split the work: pure logic → fast unit tests; browser interaction → real (but fewer) UI tests.',
    },
  ],
  hints: [
    'If a method needs no driver, it does not need to live in a page.',
    'Think about which inputs broke production.',
  ],
  explanation: `Page objects mix two kinds of code: **browser interaction** (locators, clicks, waits) and **logic** (parsing
money, mapping messages to enums, building row data). Only the first needs a browser.

Extract the logic into small helpers (\`Money.parse\`, \`LoginError.fromMessage\`, \`DateText.parse\`), cover them with
data-driven unit tests in the same module, and run those first in CI. The page object becomes thinner and the
expensive UI suite only verifies what really needs a browser.`,
  mistakes: [
    'Testing framework helpers only through slow UI tests.',
    'Mocking WebDriver heavily and believing locators are verified.',
    'Using reflection or a null driver to reach private page methods.',
  ],
  interview: [
    { q: 'Do you write unit tests for your test framework?', a: 'Yes, for the logic in it: parsers, data builders, config readers, retry and wait helpers. They run in milliseconds before the UI suite, so a framework bug fails fast and clearly instead of breaking hundreds of UI tests.' },
    { q: 'Would you mock WebDriver to test page objects?', a: 'Rarely. It mostly re-asserts the implementation and cannot prove the locators match the real DOM. I extract pure logic to helpers and unit test those, and rely on a small set of real browser tests for the page wiring.' },
    { q: 'How does this make page objects better?', a: 'It enforces single responsibility: the page translates the screen, helpers do the computing. Smaller pages are easier to read and the helpers become reusable for API tests too.' },
  ],
}
