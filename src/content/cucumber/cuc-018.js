export default {
  id: 'cuc-018',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Boundary values for the postal code as Examples rows',
  level: 'BEGINNER',
  tags: ['gherkin', 'scenario-outline', 'examples', 'boundary-values', 'checkout'],
  estMinutes: 15,
  scenario: `Defect SHOP-208: a shopper in the UK typed "SW1A 1AA" and checkout said the postal code was invalid. The developer fixed the rule —
the postal code must now be **3 to 10 letters, digits, spaces or dashes** — and asked QA to "add the cases to the automation".
You already did boundary value analysis for the manual retest. Your BVA sheet is exactly what an \`Examples\` table wants.`,
  description: `Your manual BVA sheet for the postal code field on \`checkout.html\` (error text appears in \`#checkout-error-message\`):

| Value | Length | Why | Expected |
|---|---|---|---|
| \`56\` | 2 | just below minimum | Error: Postal Code is invalid |
| \`560\` | 3 | minimum | accepted |
| \`SW1A 1AA\` | 8 | letters + space (the defect) | accepted |
| \`1234567890\` | 10 | maximum | accepted |
| \`12345678901\` | 11 | just above maximum | Error: Postal Code is invalid |
| \`560#01\` | 6 | forbidden character | Error: Postal Code is invalid |

Turn it into \`postal-code.feature\`.

**Rules**
- Use \`Scenario Outline\` + \`Examples\` — no copy-pasted scenarios.
- Accepted and rejected values need **different Then steps**, so write two outlines (or one outline with two named \`Examples:\` blocks if the steps are the same).
- The value goes into the step in quotes: \`"<postalCode>"\`.
- Cover **both sides of both boundaries** (2/3 and 10/11 characters) and the forbidden character.
- Put a placeholder in each outline title so every row is readable in the report.`,
  starterCode: `Feature: Postal code validation

  Scenario: Postal code 56
    Given the shopper is logged in as "standard_user"
    And the shopper has "Pulse Bike Light" in the cart
    When the shopper checks out as "Asha" "Rao" with postal code "56"
    Then the checkout error "Error: Postal Code is invalid" is shown

  Scenario: Postal code 560
    Given the shopper is logged in as "standard_user"
    And the shopper has "Pulse Bike Light" in the cart
    When the shopper checks out as "Asha" "Rao" with postal code "560"
    Then the checkout overview is shown

  # TODO: 4 more copies of the same scenario... turn this into outlines
`,
  solution: `@checkout @regression
Feature: Postal code validation
  A postal code must be 3 to 10 letters, digits, spaces or dashes (SHOP-208).

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper has "Pulse Bike Light" in the cart

  Scenario Outline: Postal code "<postalCode>" is accepted - <why>
    When the shopper checks out as "Asha" "Rao" with postal code "<postalCode>"
    Then the checkout overview is shown

    Examples: Valid lengths and characters
      | postalCode | why                        |
      | 560        | minimum length             |
      | SW1A 1AA   | letters and a space        |
      | 1234567890 | maximum length             |

  Scenario Outline: Postal code "<postalCode>" is rejected - <why>
    When the shopper checks out as "Asha" "Rao" with postal code "<postalCode>"
    Then the checkout error "Error: Postal Code is invalid" is shown
    And the checkout overview is not shown

    Examples: Outside the rule
      | postalCode  | why                        |
      | 56          | one below minimum length   |
      | 12345678901 | one above maximum length   |
      | 560#01      | forbidden character        |
`,
  checks: [
    { label: 'Uses Scenario Outline', pattern: '^\\s*Scenario (Outline|Template):', hint: 'Replace the copies with "Scenario Outline:" + Examples.' },
    { label: 'Postal code placeholder in quotes', pattern: '"<postal\\w*>"', flags: 'mi', hint: 'with postal code "<postalCode>"' },
    { label: 'Lower boundary: 2 and 3 characters', pattern: '^(?=[\\s\\S]*\\|\\s*[A-Za-z0-9]{2}\\s*\\|)(?=[\\s\\S]*\\|\\s*[A-Za-z0-9]{3}\\s*\\|)', hint: 'Rows for "56" (rejected) and "560" (accepted).' },
    { label: 'Upper boundary: 10 and 11 characters', pattern: '^(?=[\\s\\S]*\\|\\s*[A-Za-z0-9]{10}\\s*\\|)(?=[\\s\\S]*\\|\\s*[A-Za-z0-9]{11}\\s*\\|)', hint: 'Rows for "1234567890" (accepted) and "12345678901" (rejected).' },
    { label: 'Expects the invalid message', pattern: 'Error: Postal Code is invalid', hint: 'Then the checkout error "Error: Postal Code is invalid" is shown' },
    { label: 'Accepted and rejected rows separated', pattern: '(^\\s*Examples:[\\s\\S]*){2}', hint: 'Two outlines (or two Examples blocks): accepted vs rejected.' },
  ],
  hints: [
    'Each row of your BVA sheet becomes one row of an Examples table; the "Why" column can become a readable title placeholder.',
    'Accepted rows end on the overview page, rejected rows show an error — different Then steps, so two outlines.',
    'The shared login and cart Givens fit nicely into a Background.',
  ],
  explanation: `Boundary value analysis is the manual tester's superpower, and Scenario Outlines are made for it: **the steps stay the same, only the
data changes**. Each row runs as its own scenario, so the report shows exactly which boundary broke.

Why two outlines? An outline must have one meaning. "Accepted" ends on the overview, "rejected" shows an error — different Then steps.
Forcing both into one outline needs an "expected" column that is sometimes a page and sometimes a message, which means if/else in Java.

Small details reviewers like:
- The \`why\` column turns into a title like *Postal code "56" is rejected - one below minimum length*.
- The fixed message lives in the step once; only real variables are columns.
- The defect id (SHOP-208) is in the description, so the business rule is traceable.`,
  mistakes: [
    'Testing only valid values or only one side of a boundary — the off-by-one bug sits exactly at 2/3 and 10/11.',
    'One outline with an "outcome" column that branches in the step definition.',
    'Forgetting the quotes around "<postalCode>", so a value with a space ("SW1A 1AA") no longer matches {string}.',
    'Adding 30 random postal codes — keep the rows that represent distinct partitions and boundaries.',
  ],
  interview: [
    { q: 'How do you choose rows for an Examples table?', a: 'With classic test design: one row per equivalence partition and the values on both sides of each boundary. Every row should represent a distinct business reason, which I often show in a "why" column.' },
    { q: 'When do you split a Scenario Outline in two?', a: 'When the rows need different steps — typically positive vs negative outcomes. One outline should describe one rule with one shape of steps.' },
    { q: 'What does a Scenario Outline run look like in the report?', a: 'Each Examples row is a separate scenario. With a placeholder in the title the report shows a readable name per row, so a failure points straight at the data that broke.' },
  ],
}
