export default {
  id: 'pw-040',
  category: 'playwright',
  kind: 'quiz',
  title: 'One of many: strict mode, first(), nth(), filter() and all()',
  level: 'BEGINNER',
  tags: ['locators', 'strict-mode', 'nth', 'first', 'all', 'filter'],
  estMinutes: 10,
  scenario: `Your first Playwright PR on the ShopEasy products page (\`inventory.html\`, six product cards, each with an *Add to cart*
button) failed with "strict mode violation". A colleague's quick fix was to add \`.first()\` everywhere. Before you merge, work out which
"pick one of many" tool fits each situation.`,
  description: 'Choose the best answer for each locator situation on the products page.',
  questions: [
    {
      q: "This line fails with *strict mode violation: resolved to 6 elements*:\n\n```ts\nawait page.getByRole('button', { name: 'Add to cart' }).click();\n```\n\nThe test is meant to add the **Pulse Bike Light**. What is the best fix?",
      options: [
        "Add .first() — it is the first button anyway",
        "Narrow to the right card: page.getByTestId('inventory-item').filter({ hasText: 'Pulse Bike Light' }).getByRole('button', { name: 'Add to cart' })",
        'Use .nth(1) because the bike light is the second card',
        'Turn strict mode off in the config',
      ],
      answer: 1,
      why: "Strict mode is protecting you: the locator was ambiguous. Filtering the card by its product name (or using the test id add-to-cart-pulse-bike-light) targets the product the test is about. first()/nth() only hide the ambiguity and break when the order changes; strict mode cannot be switched off for actions.",
    },
    {
      q: 'When is `.first()` a reasonable choice?',
      options: [
        'Whenever a locator matches more than one element',
        'When you genuinely mean "whichever comes first" — e.g. after sorting by Price (low to high) you assert the first card is the cheapest',
        'Never — it is deprecated',
        'Only inside page objects',
      ],
      answer: 1,
      why: 'first(), last() and nth(i) are fine when the **position is the requirement** (sorted lists, newest message on top). They are a smell when used to silence strict mode for an element that has an identity of its own.',
    },
    {
      q: "What does this return?\n\n```ts\nconst buttons = await page.getByRole('button', { name: 'Add to cart' }).all();\n```",
      options: [
        'A Promise of a single Locator',
        'An array of Locators, one per matching element at that moment — it does not wait for more elements to appear',
        'The text of every button',
        'It throws a strict mode violation',
      ],
      answer: 1,
      why: 'all() is a snapshot: it resolves the current matches into an array of Locators (one per element, internally nth(i)). If the list is still loading you may get fewer items — assert toHaveCount first.',
    },
    {
      q: "A test must click **every** *Add to cart* button and expect the badge to show 6. Which is correct?",
      options: [
        "buttons.forEach(async (b) => await b.click());",
        "await expect(addButtons).toHaveCount(6);\nfor (const b of await addButtons.all()) { await b.click(); }\nawait expect(page.getByTestId('shopping-cart-badge')).toHaveText('6');",
        'await addButtons.click({ clickCount: 6 });',
        "for (let i = 0; i < 6; i++) await page.locator('button').nth(i).click();",
      ],
      answer: 1,
      why: "Synchronise the list with toHaveCount, then loop with for...of so each click is awaited. forEach drops the Promises, clickCount double-clicks one element, and page.locator('button') also counts the header and menu buttons.",
    },
    {
      q: '`nth()` is zero-based. On the default product order (Trailblazer Backpack, Pulse Bike Light, Classic Crew T-Shirt, …) what does `cards.nth(2)` point to?',
      options: ['Trailblazer Backpack', 'Pulse Bike Light', 'Classic Crew T-Shirt', 'It throws because nth starts at 1'],
      answer: 2,
      why: 'nth(0) is the first card, so nth(2) is the third: Classic Crew T-Shirt. That off-by-one confusion — and the fact the answer changes after a sort — is why identity-based filters are preferred.',
    },
  ],
  hints: ['Ask: does this element have an identity (a product name, a test id)? Then filter by it. Is position the requirement? Then first/nth are fine.'],
  explanation: `Playwright locators are **strict**: an action on a locator that matches several elements throws instead of guessing (Selenium's
\`findElement\` silently took the first). The fix is almost always to make the locator more specific — \`filter({ hasText })\`, \`filter({ has })\`,
or a test id — not to add \`.first()\`.

\`first()\`, \`last()\` and \`nth(i)\` express position and belong in tests where position matters. \`all()\` turns the current matches into an
array for looping, but it is a snapshot, so pair it with \`toHaveCount\` and a \`for...of\` loop.`,
  mistakes: [
    'Sprinkling .first() to silence strict mode — the test may click the wrong product later.',
    'Forgetting nth() is zero-based.',
    'Calling all() before the list has loaded and looping over too few items.',
  ],
  interview: [
    { q: 'What is strict mode in Playwright?', a: 'Actions and most assertions require the locator to resolve to exactly one element; if it matches several, Playwright throws a strict mode violation. It prevents tests from silently interacting with the wrong element.' },
    { q: 'How do you iterate over a list of elements?', a: 'Assert the expected count with toHaveCount, then for (const item of await locator.all()) { ... } with await inside. For checking texts only, use toHaveText([...]) instead of looping.' },
  ],
}
