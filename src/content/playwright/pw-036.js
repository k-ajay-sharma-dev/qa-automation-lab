export default {
  id: 'pw-036',
  category: 'playwright',
  kind: 'quiz',
  title: 'Codegen and the Inspector: when to trust a generated locator',
  level: 'INTERMEDIATE',
  tags: ['codegen', 'inspector', 'locators', 'debugging', 'code-review'],
  estMinutes: 10,
  scenario: `A manual tester on your team discovered \`npx playwright codegen\` and recorded ten ShopEasy flows in an afternoon. The PR is huge
and "it all passes". You are the reviewer: decide which generated lines can stay, which need editing, and how to use the Inspector to fix
the rest instead of guessing selectors.`,
  description: 'Review the recorded code and choose the best answer each time.',
  questions: [
    {
      q: "Codegen produced:\n\n```ts\nawait page.getByRole('button', { name: 'Login' }).click();\nawait page.getByTestId('add-to-cart-trailblazer-backpack').click();\n```\n\nWhat should the reviewer do with these lines?",
      options: [
        'Rewrite both as CSS selectors for consistency',
        'Keep them — role + accessible name and a data-testid are the locators we would write by hand',
        'Add waitForSelector before each click',
        'Replace them with XPath',
      ],
      answer: 1,
      why: 'Codegen picks role, label, text and test id locators first. When it picks those, the result is what a senior would write. No extra waits are needed — actions auto-wait.',
    },
    {
      q: "Codegen produced:\n\n```ts\nawait page.locator('div:nth-child(3) > .item-body > .item-footer > button').click();\n```\n\nWhy is this a warning sign?",
      options: [
        'It is fine — codegen always chooses the best locator',
        'It depends on position in the list; after a re-sort or a new product it clicks a different item. Replace it with the card filtered by its name, or the test id',
        'nth-child is not supported by Playwright',
        'It will throw a strict mode violation',
      ],
      answer: 1,
      why: "When nothing user-facing is unique, codegen falls back to structure. Position-based locators silently hit the wrong element when the order changes — the worst kind of failure. Prefer getByTestId('inventory-item').filter({ hasText: 'Retro Red Tee' }).getByRole('button').",
    },
    {
      q: 'The recording has no assertions at all — only clicks and fills. What is the right next step?',
      options: [
        'Nothing; if every click works the flow works',
        "Add web-first assertions for the outcomes (e.g. toHaveText('Thank you for your order!'), cart badge count) — codegen's assert toolbar buttons or hand-written",
        'Add a screenshot at the end',
        'Wrap everything in try/catch',
      ],
      answer: 1,
      why: 'A test without assertions only proves nothing crashed. Codegen has assert visibility / text / value buttons, but deciding *what* must be true is the tester\'s job — it is test design, your strongest skill.',
    },
    {
      q: 'A locator you wrote by hand times out. How do you use the Inspector to fix it quickly?',
      options: [
        'Add console.log calls and rerun',
        'Run with --debug (or put await page.pause()), use "Pick locator" on the element and type candidate locators in the locator box — it highlights what matches before you edit the code',
        'Increase the timeout to 2 minutes',
        'Open DevTools and copy the full XPath',
      ],
      answer: 1,
      why: 'The Inspector pauses at the line, lets you step, pick an element to see Playwright\'s suggested locator, and live-test your own locator against the current page. Full XPaths from DevTools are the most brittle option.',
    },
    {
      q: 'What is the best long-term use of codegen on a real project?',
      options: [
        'Generate all tests and commit them as-is',
        'Explore a new page and get locator suggestions, then move the steps into page objects/fixtures and add assertions and test data',
        'Never use it',
        'Use it only to generate Cucumber feature files',
      ],
      answer: 1,
      why: 'Recorded scripts duplicate login and navigation in every file and hard-code data. Codegen is a fast starting point and a locator finder; maintainability still comes from POM, fixtures and good assertions.',
    },
  ],
  hints: ['Trust user-facing and test-id locators; distrust anything positional or deeply nested.'],
  explanation: `Codegen records actions and **suggests** locators in this order: role, label, placeholder, text, test id, then CSS as a last resort.
Reviewing a recording means: keep the user-facing ones, replace structural or \`nth\` ones, remove duplicated setup (move to fixtures/POM),
parameterise test data, and **add assertions** — the recorder only knows what you did, not what should be true.

The Inspector (\`npx playwright test --debug\` or \`await page.pause()\`) is the fastest way to fix a locator: pick the element, edit
the locator in the box and see the highlight count before touching the code.`,
  mistakes: [
    'Committing recordings as-is — no assertions, repeated login, hard-coded data.',
    "Keeping .nth(2) / nth-child locators because 'they worked when I recorded'.",
    'Copying full XPaths from browser DevTools instead of using Pick locator.',
  ],
  interview: [
    { q: 'Do you use record-and-playback tools?', a: 'Yes, as a starting point: codegen is good for exploring a page and finding locators. I then refactor into page objects and fixtures, add assertions and data, and review every locator for stability.' },
    { q: 'How do you debug a failing Playwright test locally?', a: 'Run it with --debug or UI mode to step through, use the Inspector to test locators, and open the trace (show-trace) to see DOM snapshots, network and console at every step.' },
  ],
}
