export default {
  id: 'loc-031',
  category: 'locators',
  kind: 'locator',
  title: 'Value, not label: the order Total amount on the checkout overview',
  level: 'BEGINNER',
  tags: ['by-id', 'checkout', 'assertion-target', 'text'],
  estMinutes: 6,
  scenario: `A UAT defect says "Total on the checkout overview is wrong for orders with tax". You are automating the check
"Total = Item total + Tax". Your first try reads the text of \`[data-testid='total-label']\` and the assertion fails with
\`expected "$32.39" but was "Total: $32.39"\` — you grabbed the label row, not the amount.`,
  description: `On **checkout.html** (step 2, "Checkout: Overview" — it is in the DOM even while hidden), write a locator for **only the element
that holds the total amount** (initially \`$0.00\`).

**Rules**
- Not the whole "Total: …" row — only the amount inside it.
- Must not match the Item total or Tax amounts.
- Exactly 1 element.`,
  hints: [
    'Inspect the overview summary: <div class="summary-total" data-testid="total-label">Total: <span id="summary-total">$0.00</span></div>.',
    'The amount is the inner <span>, and it has its own id: #summary-total.',
  ],
  page: 'checkout.html',
  strategy: 'either',
  expected: '#summary-total',
  expectedCount: 1,
  solution: `CSS:    #summary-total                (or [data-testid='total-label'] > span)
XPath:  //span[@id='summary-total']

Java:
private final By orderTotal = By.id("summary-total");
String total = driver.findElement(orderTotal).getText();   // "$32.39"
BigDecimal amount = new BigDecimal(total.replace("$", ""));`,
  explanation: `The overview has a **label row** (\`div.summary-total\`, test id \`total-label\`) and an **amount** inside it
(\`span#summary-total\`). \`getText()\` on the row returns the label *and* the amount ("Total: $32.39"), so every assertion has to strip text.
Locating the span gives you exactly the value to compare.

The same pattern repeats for \`#summary-subtotal\` and \`#summary-tax\`, so a page object can expose three clean getters and the step
"total equals subtotal + tax" becomes simple BigDecimal arithmetic.

Rule of thumb: **locate the smallest element that holds the value you assert on.**`,
  mistakes: [
    'Locating the label row and then using substring/replace hacks on "Total: $32.39".',
    'Using .summary-total (the div) because the class "looks like" the total — it is the row, not the value.',
    'Comparing money as double — parse to BigDecimal to avoid 32.390000001 surprises.',
  ],
  interview: [
    {
      q: 'Why assert on the value element rather than the whole row?',
      a: 'The row text mixes a static label and a dynamic value; if someone changes "Total:" to "Order total:" your test fails although the amount is right. Targeting the value element makes the assertion precise and the failure message meaningful.',
    },
    {
      q: 'The step-2 section is hidden when the page loads. Can you still locate #summary-total?',
      a: 'Yes, findElement finds hidden elements because they are in the DOM. But Selenium\'s getText() returns an empty string for invisible elements, so in a real test you complete step 1 and wait for the overview to be visible before reading the text.',
    },
  ],
}
