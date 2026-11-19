export default {
  id: 'cuc-035',
  category: 'cucumber',
  kind: 'quiz',
  title: 'Organising feature files: one capability per feature, tags per suite',
  level: 'ADVANCED',
  tags: ['feature-files', 'project-structure', 'tags', 'living-documentation'],
  estMinutes: 12,
  scenario: `ShopEasy's \`src/test/resources/features\` folder has grown to 140 scenarios in files like \`sprint14.feature\`,
\`john_tests.feature\` and \`smoke.feature\` (which duplicates scenarios from three other files). The QA lead asks you to propose a
structure the BA can browse as documentation and CI can slice into smoke, regression and nightly runs.`,
  description: 'Choose the best answer for each organisation decision.',
  questions: [
    {
      q: 'What should a single `.feature` file represent?',
      options: [
        'One sprint\'s worth of new tests',
        'One business capability, e.g. `cart.feature` (add, remove, badge) or `checkout.feature`',
        'One page object class',
        'All tests written by one tester',
      ],
      answer: 1,
      why: 'Features describe what the product does. Grouping by capability lets a BA find "how does removing from the cart work?" in one place, and it stays stable when sprints, pages or people change.',
    },
    {
      q: 'The team keeps a separate `smoke.feature` that copies 8 scenarios from `login.feature`, `cart.feature` and `checkout.feature`. Better approach?',
      options: [
        'Keep it — smoke tests need their own file',
        'Delete the copies and tag the originals `@smoke`; CI runs `--tags "@smoke"`',
        'Put smoke scenarios in a Background',
        'Make a second runner that points at smoke.feature',
      ],
      answer: 1,
      why: 'Suites are a **cross-cutting selection**, which is exactly what tags are for. Copies drift apart: someone fixes the original and the smoke copy keeps testing old behaviour.',
    },
    {
      q: 'Which folder layout scales best?',
      options: [
        '`features/sprint-12/`, `features/sprint-13/` …',
        '`features/smoke/`, `features/regression/`',
        '`features/shopping/cart.feature`, `features/shopping/inventory-sort.feature`, `features/account/login.feature`, `features/api/orders.feature`',
        'Everything in one `shopeasy.feature`',
      ],
      answer: 2,
      why: 'Folders by business domain (and API vs UI where it helps) give a browsable documentation tree. Suite folders force duplication when a scenario belongs to smoke *and* regression; sprint folders are meaningless a month later.',
    },
    {
      q: 'Where should the tag `@cart` go?',
      options: [
        'On every scenario in cart.feature',
        'On the `Feature:` line — scenarios inherit feature tags',
        'In the runner only',
        'On the Background',
      ],
      answer: 1,
      why: 'Tags on the Feature line are inherited by every scenario and every Examples row. Put capability tags there, and scenario-level tags (`@smoke`, `@SHOP-231`, `@wip`) only where they differ. Background cannot be tagged.',
    },
    {
      q: 'A nightly job should run the full regression except scenarios that are known broken or still in progress. Which tag expression?',
      options: [
        '`@regression and @wip and @known-bug`',
        '`@regression and not (@wip or @known-bug)`',
        '`not @regression`',
        '`@regression or not @wip`',
      ],
      answer: 1,
      why: 'Select the suite, then exclude the exceptions. Keep the set of suite tags small and documented (e.g. @smoke, @regression, @wip, @known-bug) so tag expressions in CI stay readable.',
    },
  ],
  hints: ['Folders and files answer "what does the product do?"; tags answer "when do we run it?".', 'Feature-level tags are inherited by all scenarios.'],
  explanation: `Two axes, two tools:

- **Structure (files/folders) = business capability.** \`account/login.feature\`, \`shopping/cart.feature\`, \`shopping/checkout.feature\`.
  One feature, one capability, with a short description of the rule. This is what makes Cucumber "living documentation".
- **Selection (tags) = which run.** \`@smoke\`, \`@regression\`, \`@wip\`, plus traceability tags like \`@SHOP-231\`.
  One scenario can be in several suites without being copied.

A quick health check for a features folder: no file named after a sprint, person or suite; no scenario duplicated across files;
a short, agreed list of suite tags documented in the README.`,
  interview: [
    { q: 'How do you organise feature files in a large project?', a: 'By business capability in domain folders, one feature per capability, with the business rule in the feature description. Run selection is done with tags, never by copying scenarios into suite files.' },
    { q: 'How do you keep tags from turning into chaos?', a: 'Agree a small fixed set of suite tags (smoke, regression, wip, known-bug), put capability tags on the Feature line, use ticket tags for traceability, and review new tags like code. A dry run with a tag expression shows exactly what a suite contains.' },
  ],
}
