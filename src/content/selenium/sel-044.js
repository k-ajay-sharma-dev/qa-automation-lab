export default {
  id: 'sel-044',
  category: 'selenium',
  kind: 'quiz',
  title: 'Hover state checks: getCssValue, Color and the moveToElement pitfalls',
  level: 'EXPERT',
  tags: ['getCssValue', 'Color', 'Actions', 'hover', 'visual'],
  estMinutes: 12,
  scenario: `After a brand refresh, the design team reported that the **Login** button on \`login.html\` no longer darkens on hover — a CSS refactor had dropped the \`.btn-primary:hover\` rule. They want a cheap automated guard: the button background is teal \`#0f766e\` normally and \`#115e59\` while hovered. Your first attempt compares strings and fails with \`expected [#115e59] but found [rgba(17, 94, 89, 1)]\`, and on the Grid it sometimes reports the non-hover colour.`,
  description: `Answer the questions about verifying a CSS state change on hover for \`#login-button\` (\`.btn-primary\`, background \`#0f766e\`, hover \`#115e59\`).`,
  hints: [
    'getCssValue returns the *computed* style, and browsers serialise colours as rgb()/rgba().',
    'org.openqa.selenium.support.Color can parse rgba, hex and named colours and convert between them.',
  ],
  questions: [
    {
      q: 'What does `driver.findElement(By.id("login-button")).getCssValue("background-color")` typically return in Chrome before hovering?',
      options: ['"#0f766e"', '"rgba(15, 118, 110, 1)"', '"teal"', '"btn-primary"'],
      answer: 1,
      why: 'getCssValue returns the computed value, and Chrome serialises colours as rgba(r, g, b, a). Hex #0f766e is rgb(15, 118, 110). The source-code hex and class names are never returned.',
    },
    {
      q: 'Which assertion is robust across browsers that return `rgb(...)` vs `rgba(...)`?',
      options: [
        'Assert.assertEquals(el.getCssValue("background-color"), "#115e59")',
        'Assert.assertEquals(Color.fromString(el.getCssValue("background-color")).asHex(), "#115e59")',
        'Assert.assertTrue(el.getCssValue("background-color").contains("115e59"))',
        'Assert.assertEquals(el.getDomAttribute("style"), "background: #115e59")',
      ],
      answer: 1,
      why: 'Color.fromString parses rgb, rgba, hsl and hex, and asHex() normalises to lowercase #rrggbb, so the test compares the design token directly. The style attribute only contains inline styles, and the hover rule lives in site.css.',
    },
    {
      q: 'How should the test put the button into its hover state?',
      options: [
        'el.click()',
        'new Actions(driver).moveToElement(el).perform()',
        'el.sendKeys(Keys.HOVER)',
        '((JavascriptExecutor) driver).executeScript("arguments[0].classList.add(\'hover\')", el)',
      ],
      answer: 1,
      why: 'moveToElement moves the virtual pointer over the element, which triggers the CSS :hover state like a real mouse. click() also submits the form; Keys.HOVER does not exist; adding a class tests your script, not the :hover rule.',
    },
    {
      q: 'On the Grid the hovered colour is sometimes still `#0f766e`. Which explanation and fix are best?',
      options: [
        'Grid nodes cannot hover; skip the test there',
        'If the style animates (a CSS transition) or the pointer starts on the element already, the colour is read too early or never changes; wait until the computed colour equals the expected value, and move the pointer away first so each check starts from a known state',
        'Increase the implicit wait',
        'Use getText() instead of getCssValue()',
      ],
      answer: 1,
      why: 'Hover tests are timing- and pointer-state-sensitive. A WebDriverWait with a lambda like d -> Color.fromString(el.getCssValue("background-color")).asHex().equals("#115e59") handles transitions, and moving the pointer to a neutral element (e.g. the page heading) first guarantees a real hover change. Implicit waits only affect finding elements.',
    },
    {
      q: 'Which statement about this kind of test is most accurate?',
      options: [
        'It replaces visual regression testing',
        'It is a cheap guard for one critical, agreed design token; for layout and broad look-and-feel use visual comparison tools, and keep these assertions few',
        'Colours should never be tested with Selenium',
        'It should be added for every element on every page',
      ],
      answer: 1,
      why: 'Asserting a handful of important states (primary button hover, error-red text) catches regressions like the dropped :hover rule. Asserting colours everywhere creates brittle tests that break on every design tweak; visual tools cover the broad picture.',
    },
  ],
  explanation: `\`getCssValue\` gives the **computed** style, so compare colours through \`org.openqa.selenium.support.Color\`, not raw strings. Trigger hover with \`Actions.moveToElement\`, start from a neutral pointer position, and wait for the colour rather than reading it once:

\`\`\`java
WebElement login = driver.findElement(By.id("login-button"));
Assert.assertEquals(Color.fromString(login.getCssValue("background-color")).asHex(), "#0f766e");
new Actions(driver).moveToElement(login).perform();
new WebDriverWait(driver, Duration.ofSeconds(3)).until(d ->
    Color.fromString(login.getCssValue("background-color")).asHex().equals("#115e59"));
\`\`\`

Use this sparingly, for design tokens the team has agreed must not regress.`,
  mistakes: [
    'Comparing getCssValue output with a hex string from the design file.',
    'Using click() to "hover", which also submits the login form.',
    'Faking hover by adding a CSS class with JavaScript — it never exercises the :hover rule.',
    'Reading the colour once immediately after moveToElement when the element has a transition.',
  ],
  interview: [
    { q: 'getCssValue vs getDomAttribute("style")?', a: 'getCssValue returns the final computed value after all stylesheets, inheritance and states. The style attribute only holds inline styles written on the element.' },
    { q: 'How do you verify a tooltip that appears on hover?', a: 'moveToElement to the trigger, then wait for visibilityOfElementLocated on the tooltip and assert its text; move the pointer away and wait for invisibility to check it closes.' },
    { q: 'Why might hover tests behave differently in headless mode?', a: 'Pointer position and window size differ; with a small default headless window the element can be off-screen or overlapped. Set an explicit window size and scroll the element into view before hovering.' },
  ],
}
