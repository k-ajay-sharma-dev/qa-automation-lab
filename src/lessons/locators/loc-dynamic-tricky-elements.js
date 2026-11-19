export default {
  slug: 'loc-dynamic-tricky-elements',
  category: 'locators',
  order: 7,
  title: 'Dynamic and tricky elements: generated ids, absolute XPath and multi-condition locators',
  minutes: 9,
  summary: 'Recognise fragile locators (generated ids, absolute paths, index chains), replace them with stable ones, and express several business conditions in one XPath.',
  manualAnalogy: `A flaky test case that says "click the 2nd button in the 3rd box" fails the moment someone adds a box — you have rewritten steps like that for years. Locators rot the same way. This lesson is about spotting the warning signs (random-looking ids, long paths of numbers) and describing elements by what they **mean** instead.`,
  body: `## Smell 1: generated ids

Modern front-end frameworks often generate ids: \`input-7f2c9\`, \`btn-8f3a2\`, \`mat-select-14\`. The suffix changes on every page load, build or environment. Your locator passes locally and fails on CI with \`NoSuchElementException\`.

**How to spot it:** reload the page and inspect the element again. If any part of the id changed, never hard-code that part.

**Fixes, best first:**
1. Ask for a \`data-testid\`.
2. Use the **stable part** of the id with a partial match:

\`\`\`css
[id^='coupon-input-']                 /* CSS: starts with */
\`\`\`
\`\`\`xpath
//input[starts-with(@id, 'coupon-input-')]
\`\`\`
3. Use another attribute, the visible text, or a nearby label.

Check the prefix is **specific enough**. On the practice site's dynamic page, both "Apply coupon" and "Save for later" get ids starting with \`btn-\`, so \`[id^='btn-']\` matches two buttons. Adding the text pins one down:

\`\`\`xpath
//button[starts-with(@id,'btn-') and normalize-space()='Save for later']
\`\`\`

## Smell 2: absolute XPath and index chains

Browser "Copy full XPath" and old record-and-playback tools produce things like:

\`\`\`xpath
/html/body/main/div/div[2]/form/div[3]/input
\`\`\`

This encodes **every level** of the page layout. Any new wrapper div, banner or form row anywhere above the target shifts the numbers and the locator either fails or — worse — silently points at a different element. It also tells a reader nothing about *what* the element is.

The same element, described by itself:

\`\`\`css
#password
\`\`\`

Rules of thumb:
- Never start with \`/html\`.
- Treat \`[2]\`, \`[3]\`… in a path as a warning. One index on a **structural** thing (a table column) can be fine; chains of indexes are not.
- "Copy XPath" (relative) in DevTools is a starting point, not an answer — read it and improve it.

## Smell 3: shared class names

Component libraries reuse classes everywhere: every card is \`.card\`, every button is \`.btn.btn-primary\`. A class-only locator then matches many elements and \`findElement\` quietly picks the first one. Look for what is **unique**: a modifier class on the special element (\`--active\`, \`--featured\`, \`is-selected\`), an attribute, or nearby text — then scope down into it.

## Multi-condition locators

Sometimes one fact is not enough. "Edit the employee in **Engineering** who is **On Leave**" — several people are in Engineering, several statuses repeat, but the combination is unique. Put all conditions in a predicate on the **container**, then go down to the target:

\`\`\`xpath
//tr[td[normalize-space()='Engineering'] and td//text()[normalize-space()='On Leave']]//button
\`\`\`

Read it as: *"the row that has an Engineering cell AND has the text On Leave somewhere in its cells; inside it, the button."*

- \`and\` / \`or\` combine conditions in one predicate; \`not(...)\` negates one: \`//tr[not(td[.='Inactive'])]\`.
- Paths inside the predicate (\`td[...]\`) mean "has a child like this".
- The status is wrapped in a \`<span>\` inside the cell, which is why the second condition looks deeper (\`td//text()\`) — always inspect the real nesting.

Card layouts work the same way: \`//div[contains(@class,'card')][condition 1][condition 2]//button[...]\`. Stacking predicates like \`[..][..]\` is another way to say AND.

## When the target button is not unique inside the container

A card may have several buttons ("Edit", "Delete"). After reaching the container, identify the right one by text or by a distinctive class (e.g. a danger/destructive style):

\`\`\`xpath
…//button[normalize-space()='Edit']
\`\`\`

## A quick robustness review

Before committing a locator, imagine these changes and ask "does it still find the right element?":

| Change | Fragile locator breaks? |
|---|---|
| Page reloaded (new generated ids) | full generated id |
| Marketing adds a banner at the top | absolute path, \`div[2]\` chains |
| List is sorted differently | row/card index |
| Test data renamed per environment | hard-coded names where a role/status was meant |
| Designer restyles buttons | class-only locators |

A locator built on test ids, stable attributes, labels and business data survives all of them.`,
  keyPoints: [
    'Reload and re-inspect: any part of an id that changes must not be in your locator.',
    'Use the stable prefix (^= / starts-with) and make sure it is specific enough — check the count.',
    'Never use absolute XPath (/html/...) or chains of indexes.',
    'Describe the element by what it is: test id, attribute, label, or business data.',
    'Combine several conditions on the container with and / stacked predicates, then go down to the target.',
  ],
  mistakes: [
    'Hard-coding a generated id copied from DevTools — it passes once and fails on the next load.',
    'Accepting "Copy full XPath" as-is — rewrite it around a meaningful attribute.',
    'Using a prefix so short it matches several elements — add text, scope or a longer prefix.',
    'Encoding only one of two required conditions — the locator matches the wrong record when data changes.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/dynamic.html, inspect the "Apply coupon" button, note its id, reload, and inspect again. Then run \`$$("[id^='btn-']")\` and write a locator that matches only "Apply coupon" without hard-coding the random part.`,
  problems: ['loc-011', 'loc-012', 'loc-017', 'loc-018', 'loc-027', 'loc-036'],
}
