export default {
  id: 'cuc-037',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Confirm and prompt pop-ups written declaratively',
  level: 'BEGINNER',
  tags: ['gherkin', 'declarative', 'alerts', 'confirm'],
  estMinutes: 12,
  scenario: `The \`alerts.html\` page holds the "empty your cart" confirmation and the coupon prompt. An automation engineer wrote
the scenarios as a list of Selenium calls — the product owner reviewing the feature asked "what does switchTo mean?". Rewrite it so
the business can read it, and leave the alert handling to the step definitions.`,
  description: `Real behaviour on \`alerts.html\`:

- **Click for JS Confirm** asks *"Do you want to empty your cart?"* → OK shows **You clicked: Ok**, Cancel shows **You clicked: Cancel**.
- **Click for JS Prompt** asks *"Enter your coupon code"* → typing \`BRIGHT25\` and OK shows **You entered: BRIGHT25**; Cancel shows **You cancelled the prompt**.

Write \`popups.feature\`.

**Rules**
- At least **3 scenarios**: confirm accepted, confirm dismissed, coupon entered (a 4th for a cancelled prompt is welcome).
- No Selenium words in the steps: no \`switchTo\`, \`alert()\`, \`accept\`, \`dismiss\`, \`click\` or button ids (quoted page texts such as "You clicked: Ok" are fine).
- Phrase the decision as the user's intent ("agrees to empty the cart", "changes their mind").
- Each Then checks the exact result text shown on the page.`,
  starterCode: `Feature: Alerts

  Scenario: confirm
    Given I open alerts.html
    When I click js-confirm-btn
    And I switchTo alert and accept
    Then result is "You clicked: Ok"
`,
  solution: `@popups
Feature: Confirmation and coupon pop-ups
  The shopper must explicitly agree before the cart is emptied,
  and can type a coupon code into a pop-up.

  Background:
    Given the shopper is on the pop-ups page

  Scenario: The shopper agrees to empty the cart
    When the shopper asks to empty the cart and agrees
    Then the page shows "You clicked: Ok"

  Scenario: The shopper changes their mind about emptying the cart
    When the shopper asks to empty the cart but changes their mind
    Then the page shows "You clicked: Cancel"

  Scenario: The shopper enters a coupon code
    When the shopper enters the coupon code "BRIGHT25"
    Then the page shows "You entered: BRIGHT25"

  Scenario: The shopper cancels the coupon pop-up
    When the shopper closes the coupon pop-up without entering a code
    Then the page shows "You cancelled the prompt"
`,
  checks: [
    { label: 'At least three scenarios', pattern: '(^\\s*Scenario:[\\s\\S]*){3}', hint: 'Accepted, dismissed and coupon entered.' },
    { label: 'Checks "You clicked: Ok"', pattern: 'You clicked: Ok', hint: 'Then the page shows "You clicked: Ok"' },
    { label: 'Checks "You clicked: Cancel"', pattern: 'You clicked: Cancel', hint: 'The dismissed case has its own Then.' },
    { label: 'Checks the entered coupon', pattern: 'You entered: \\w+', hint: 'Then the page shows "You entered: BRIGHT25"' },
    { label: 'No Selenium vocabulary', pattern: 'switchTo|alert\\(|\\baccept\\b|\\bdismiss|^[^"\\n]*\\bclick|-btn\\b|\\.html', flags: 'mi', mustNot: true, hint: 'Say what the shopper decides, not how WebDriver handles the pop-up.' },
  ],
  hints: [
    'The pop-up is an implementation detail; the business decision is "agree" or "change my mind".',
    'Put "on the pop-ups page" in a Background — every scenario starts there.',
  ],
  explanation: `Declarative Gherkin describes **what** the user decides; the step definition owns **how**:

\`\`\`java
@When("the shopper asks to empty the cart and agrees")
public void emptyAndAgree() {
    alertsPage.clickConfirmButton();
    wait.until(ExpectedConditions.alertIsPresent()).accept();
}
\`\`\`

If the team later replaces the native \`confirm()\` with the HTML modal, only the step definition changes — the feature file (the agreed behaviour) stays the same. That is the whole point of keeping WebDriver words out of Gherkin.`,
  mistakes: [
    'Leaking "switchTo().alert()" or "accept" into steps — the feature now breaks when the UI technology changes.',
    'Only testing the OK path; the Cancel path is where data-loss bugs hide.',
    'A vague Then ("the alert is handled") instead of the exact text the user sees.',
  ],
  interview: [
    { q: 'Where does alert handling belong in a Cucumber framework?', a: 'In a page object (or a small helper) called from the step definition, usually with an explicit wait for alertIsPresent. The Gherkin only names the user decision.' },
    { q: 'How would you test the "Alert after 3 seconds" button reliably?', a: 'WebDriverWait with ExpectedConditions.alertIsPresent() before switching — never a fixed sleep. The Gherkin would still just say "When the shopper acknowledges the session expiry warning".' },
  ],
}
