export default {
  id: 'api-039',
  category: 'restassured',
  kind: 'quiz',
  title: 'API or UI? Deciding where each ShopEasy check belongs',
  level: 'BEGINNER',
  tags: ['test-strategy', 'test-pyramid', 'api-vs-ui', 'regression'],
  estMinutes: 10,
  scenario: `The ShopEasy regression suite has 140 Selenium tests and takes 50 minutes. Most of them type a bad postal code or
add six products to the cart just to read a number on the screen. Your lead asks you to move every check that does not
*need* a browser down to the API layer — but to keep the ones that really are about the user's experience in the UI.`,
  description: `For each check, decide the **cheapest layer that still proves it**. The API is \`http://localhost:5181\`; the web shop
is the practice site.`,
  questions: [
    {
      q: 'Check: "An order with a blank last name is refused and the reason names the field." Where should most of these cases live?',
      options: [
        'Only in the UI — the customer sees the red message',
        'In the API: `POST /api/orders` → 400 `VALIDATION_FAILED` with `error.details[0].field = "lastName"`; keep one UI test that the message is shown',
        'In a manual test only',
        'Nowhere — validation is the developer\'s job',
      ],
      answer: 1,
      why: `The **rule** (blank, spaces only, missing, too long…) is enforced by the backend, so every variation is cheap and fast at the API level. The UI only needs **one** test proving that an API error ends up as a visible message under the right field.`,
    },
    {
      q: 'Check: "Tax is 8% of the subtotal and the total is subtotal + tax, rounded to 2 decimals." Best layer?',
      options: [
        'API — the order response has `subtotal`, `tax` and `total`; you can test many baskets in seconds',
        'UI — read the numbers from the checkout overview page for every basket',
        'Both, with the same 20 baskets in each',
        'A unit test is the only valid place',
      ],
      answer: 0,
      why: `A calculation with many data combinations is a perfect API (or unit) test. Repeating 20 baskets through the browser costs minutes and adds flakiness without proving anything new. One UI test can check the overview page *displays* the API's total.`,
    },
    {
      q: 'Check: "The Add to cart button changes to Remove and the cart badge shows 1." Best layer?',
      options: [
        'API — `POST /api/cart/items` returns 201',
        'UI — this is about what the user sees and clicks; the API cannot prove a button label or badge',
        'Database query',
        'Not worth testing',
      ],
      answer: 1,
      why: `Rendering, button state and badges exist only in the browser. The API test proves the cart **data** is right; the UI test proves the **screen** reflects it. Each layer tests what only it can.`,
    },
    {
      q: 'Check: "visual_user cannot read standard_user\'s order." Where is the real protection tested?',
      options: [
        'UI — there is no link to other people\'s orders, so it is safe',
        'API — `GET /api/orders/{id}` with visual_user\'s token must return 403 `FORBIDDEN`',
        'Both layers must be identical',
        'It cannot be automated',
      ],
      answer: 1,
      why: `Hiding a link in the UI is not security — anyone can call the API directly with curl or Postman. Authorisation must be tested where it is **enforced**: the API. This is a classic case where a UI-only suite gives false confidence.`,
    },
    {
      q: 'After moving checks down, what does a healthy ShopEasy suite look like?',
      options: [
        'Equal numbers of API and UI tests',
        'Many fast API tests for rules, data and errors; a few UI journeys (login → cart → checkout) that prove the screens are wired to the API',
        'Only API tests — UI tests are always flaky',
        'Only UI tests — they are closest to the user',
      ],
      answer: 1,
      why: `This is the **test pyramid**: the broad base of rules and edge cases runs fast at the API layer, and a thin layer of end-to-end UI journeys covers integration and user experience. Dropping UI tests completely would miss broken pages.`,
    },
  ],
  hints: [
    'Ask: "Does this check need pixels, clicks or a browser to be true?" If not, push it down.',
    'Rules and calculations with many combinations → API. What the user sees → UI.',
    'Security is tested where it is enforced, not where a link is hidden.',
  ],
  explanation: `A quick sorting rule for any check:

| The check is about… | Layer |
|---|---|
| validation rules, calculations, status/error codes | API (many cases) |
| authorisation (401/403) | API |
| button state, messages shown, navigation, layout | UI |
| "the whole thing hangs together" | a few UI end-to-end journeys |

Moving 100 browser tests to the API usually turns 40 minutes into under one, and failures point straight at the
backend rule that broke instead of "element not found".`,
  mistakes: [
    'Testing every validation variation through the browser.',
    'Believing a hidden UI link means the data is protected.',
    'Deleting all UI tests after building the API suite — nothing then checks the screens.',
    'Duplicating the same data matrix in both layers.',
  ],
  interview: [
    { q: 'How do you decide whether a test belongs at API or UI level?', a: 'I test each behaviour at the lowest layer that can prove it. Business rules, calculations, error codes and authorisation go to the API because they are fast and stable there; what the user sees and does goes to the UI, with a few end-to-end journeys for integration.' },
    { q: 'What is the test pyramid?', a: 'A guideline to have many fast, isolated tests at the bottom (unit, then API/service) and few slow, broad UI tests at the top. It keeps feedback fast and failures easy to diagnose.' },
  ],
}
