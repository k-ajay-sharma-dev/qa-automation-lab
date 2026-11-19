export default {
  slug: 'loc-css-pseudo-siblings',
  category: 'locators',
  order: 8,
  title: 'CSS power tools: :not(), attribute presence, state selectors and siblings',
  minutes: 8,
  summary: 'Exclude elements with :not(), find elements by boolean attributes like [required] and [disabled], select by state with :checked and :disabled, and reach a neighbouring element with + and ~.',
  manualAnalogy: `Manual test cases are full of rules like "every field **except** the optional ones", "all **mandatory** fields show a red star", "the checkbox that is **ticked**", "the error message **right under** the email box". These are not names or positions — they are properties and relationships. The CSS tools in this lesson let a locator say exactly that.`,
  body: `## Excluding with :not()

\`:not(X)\` keeps the elements that do **not** match X. It attaches to an element like a class does — no space before it:

\`\`\`css
#product-sort option:not([value='az'])      /* every sort choice except the default one */
#cart-list .cart-item:not(:last-child)      /* every cart line except the last */
button:not([disabled])                      /* buttons you can click */
\`\`\`

Use it when the rule is naturally "all except…". Prefer excluding by an **attribute or class** (what the element *is*) over excluding by
position (\`:first-child\`) — positions shift when the page changes, meanings rarely do.

## Attribute presence: [attr]

Some attributes are **boolean**: they are either there or not, and their value is irrelevant.

\`\`\`html
<input type="email" id="email" required>
<select id="channels" multiple size="4">
<button id="claim-reward-btn" disabled>Claim reward</button>
\`\`\`

\`\`\`css
[multiple]                  /* every multi-select */
#registration-form [disabled]
\`\`\`

\`[attr]\` without \`=value\` means "has this attribute". Writing \`[required='true']\` is a common bug: HTML usually writes the attribute with
no value at all, so an equality check matches nothing. In XPath the same idea is \`//*[@required]\`.

Leave the tag off (or use \`*\` in XPath) when the property can sit on different kinds of elements — \`required\` can be on an
\`<input>\`, a \`<select>\` and a \`<textarea>\`.

## State selectors: :checked, :disabled, :enabled

Attributes describe how the page was **written**; state pseudo-classes describe how it is **now**:

| Selector | Matches |
|---|---|
| \`:checked\` | ticked checkboxes, selected radio buttons, selected \`<option>\`s |
| \`:disabled\` / \`:enabled\` | form controls that cannot / can be used right now |

\`\`\`java
List<WebElement> ticked = driver.findElements(By.cssSelector("#category-group input:checked"));
\`\`\`

If JavaScript enables a button later, \`[disabled]\` and \`:disabled\` both follow the live DOM — but a state selector also understands
cases like a \`<fieldset disabled>\` disabling everything inside it. Remember that the state changes over time: on the waits page,
\`#claim-reward-btn:disabled\` matches for five seconds and then nothing. Locate the element by **what it is**, and wait for the
**state** with \`ExpectedConditions\` (see the Selenium waits lessons).

## Siblings: + and ~

Siblings share a parent. CSS can step **forward** to them:

| Combinator | Meaning | Example |
|---|---|---|
| \`A + B\` | the B **directly** after A | \`label + input\` |
| \`A ~ B\` | **any** B after A | \`h2 ~ .form-grid\` |

\`\`\`html
<div class="form-row">
  <label for="email">Email *</label>
  <input type="email" id="email" name="email">
  <span class="field-error" id="email-error"></span>
</div>
\`\`\`

\`#email + .field-error\` = "the error right after the email input". This turns into a reusable Page Object method:
\`By.cssSelector("#" + fieldId + " + .field-error")\` — but check each field's markup. If a field is wrapped in a \`<label>\`, the error is
the label's sibling, not the input's, and the pattern returns nothing.

CSS cannot go **up** to a parent or **back** to an earlier sibling. When you need that, switch to XPath (\`..\`, \`ancestor::\`,
\`preceding-sibling::\` — see the *XPath axes* lesson).

## Selector lists: the comma

\`A, B\` matches everything that matches A **or** B — e.g. \`#first-name, #last-name\`. Handy for "all of these fields" checks; the result
comes back in page order, not in the order you wrote.`,
  keyPoints: [
    ':not(X) excludes; exclude by meaning (attribute/class), not by position.',
    '[attr] matches elements that HAVE a boolean attribute — never compare required/disabled to "true".',
    ':checked, :disabled and :enabled describe the current state; wait for state changes, do not bake them into page locators.',
    '+ is the very next sibling, ~ any later sibling; CSS cannot go up or backwards.',
    'A comma joins selectors (OR); results come back in document order.',
  ],
  mistakes: [
    'Writing [required=\'true\'] or [disabled=\'true\'] — boolean attributes usually have no value.',
    'Putting a space before :not or :checked ("option :not(...)") — that targets descendants and matches nothing.',
    'Using + when another element sits between the two — use ~ or check the real markup.',
    'Using input[required] when a required <select> or <textarea> exists too.',
  ],
  tryIt: `On http://localhost:5180/practice-site/form.html tick two "What will you sell?" checkboxes, then run \`$$('#category-group input:checked')\` in the Console. Run \`$$('[multiple]')\` and \`$$('label + input')\` — which fields match the last one, and which are missing because their input is inside the label?`,
  problems: ['loc-023', 'loc-024', 'loc-026'],
}
