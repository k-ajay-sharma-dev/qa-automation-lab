export default {
  id: 'pw-042',
  category: 'playwright',
  kind: 'quiz',
  title: 'fill, pressSequentially or keyboard.press? Typing like a user',
  level: 'INTERMEDIATE',
  tags: ['fill', 'pressSequentially', 'keyboard', 'forms', 'actions'],
  estMinutes: 10,
  scenario: `The ShopEasy team is adding a search-as-you-type box and an Enter-to-submit login. Your migrated Selenium tests used
\`sendKeys\` for everything, and the first Playwright draft mixes \`type\`, \`fill\` and \`keyboard\` calls at random. Pick the right input
API for each case before the review.`,
  description: 'Choose the best answer for each input situation.',
  questions: [
    {
      q: "Logging in on `login.html` (fields `data-testid=\"username\"` and `data-testid=\"password\"`). Which is the idiomatic way to enter the username?",
      options: [
        "await page.getByTestId('username').pressSequentially('standard_user');",
        "await page.getByTestId('username').fill('standard_user');",
        "await page.keyboard.type('standard_user');",
        "await page.getByTestId('username').type('standard_user');",
      ],
      answer: 1,
      why: 'fill() focuses the field, clears it and sets the value in one step with an input event. It is fast and does not depend on what was there before. type() is deprecated; keyboard.type() types into whatever happens to be focused.',
    },
    {
      q: 'You want to submit the login form the way a keyboard user does — Enter in the password field. Which line?',
      options: [
        "await page.getByTestId('password').press('Enter');",
        "await page.getByTestId('password').fill('Enter');",
        "await page.keyboard.type('\\n');",
        "await page.getByTestId('password').pressSequentially('Enter');",
      ],
      answer: 0,
      why: "locator.press('Enter') focuses that element and sends a real Enter key, which submits the form. fill('Enter') and pressSequentially('Enter') would type the letters E-n-t-e-r.",
    },
    {
      q: 'A city autocomplete only shows suggestions after keyup events, and `fill()` makes no list appear. What do you use?',
      options: [
        "fill() with { force: true }",
        "pressSequentially('Beng', { delay: 100 }) and then assert the suggestion list with a web-first assertion",
        'evaluate() to set input.value directly',
        'waitForTimeout(3000) after fill()',
      ],
      answer: 1,
      why: 'pressSequentially sends a keydown/keypress/keyup for every character, like real typing, so key-driven widgets react. Setting value via evaluate() bypasses every event — that is not testing what a user does.',
    },
    {
      q: 'Which statement about `page.keyboard` is TRUE?',
      options: [
        'It types into the element you pass as the first argument',
        'It acts on whatever element currently has focus, so use it for shortcuts like Control+A or Tab navigation, not for normal field entry',
        'It is the only way to press Enter',
        'It waits for the field to become editable',
      ],
      answer: 1,
      why: "page.keyboard is page-level and has no target or auto-waiting on an element. Locator methods (fill, press, pressSequentially) focus and wait for their element first — prefer them, and keep keyboard for focus-order and shortcut tests (e.g. press('Tab') and expect(...).toBeFocused()).",
    },
    {
      q: 'A field already contains *old text*. What is in it after `pressSequentially(\'new\')`?',
      options: ['new', 'old textnew (or new text inserted at the caret) — pressSequentially does not clear', 'An error is thrown', 'An empty string'],
      answer: 1,
      why: 'Only fill() replaces the value. pressSequentially types at the caret like a person would, so clear() or fill(\'\') first if you need a clean field.',
    },
  ],
  hints: ['Default to fill(); use press() for single keys; pressSequentially() only when the widget needs every keystroke.'],
  explanation: `Playwright splits Selenium's \`sendKeys\` into clear intents:
- **\`fill(value)\`** — set a field's value (clears first). The default for forms.
- **\`press(key)\`** — one key or chord on a specific element (\`Enter\`, \`Tab\`, \`Control+A\`).
- **\`pressSequentially(text)\`** — key-by-key typing for autocomplete, masks and other keystroke-driven widgets (replaces the deprecated \`type()\`).
- **\`page.keyboard\`** — low-level, acts on the focused element; good for shortcuts and focus-order tests.

Choosing by intent keeps tests fast (fill) and realistic where it matters (pressSequentially).`,
  mistakes: [
    'Using pressSequentially or type() for every field — slow, and it appends to existing text.',
    "Typing 'Enter' as text with fill() instead of press('Enter').",
    'Using page.keyboard.type() without making sure the right element has focus.',
  ],
  interview: [
    { q: 'What replaced sendKeys in Playwright?', a: "fill() for setting values, press() for keys such as Enter or Tab, and pressSequentially() when the app needs individual keystrokes. type() is deprecated in favour of pressSequentially()." },
    { q: 'How would you test keyboard accessibility of a form?', a: "Start on the first field, press('Tab') repeatedly and assert toBeFocused() on each expected field in order, then submit with press('Enter') and assert the result." },
  ],
}
