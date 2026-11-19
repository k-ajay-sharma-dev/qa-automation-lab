export default {
  id: 'cuc-032',
  category: 'cucumber',
  kind: 'gherkin',
  language: 'gherkin',
  title: 'Scenario Outline for the four inventory sort options',
  level: 'INTERMEDIATE',
  tags: ['gherkin', 'scenario-outline', 'examples', 'sorting', 'inventory'],
  estMinutes: 15,
  scenario: `The Products page got a new sort dropdown (\`#product-sort\`) with four options. A teammate automated it as four
copy-pasted scenarios; last sprint someone renamed an option, fixed three of the copies and forgot the fourth. You want one
Scenario Outline so the next change is a one-row edit.`,
  description: `The dropdown on \`inventory.html\` offers these visible texts, and the catalogue has six products
(Junior Onesie $7.99 is the cheapest, Storm Fleece Jacket $49.99 the most expensive):

| Option text | First product | Last product |
|---|---|---|
| Name (A to Z) | Classic Crew T-Shirt | Trailblazer Backpack |
| Name (Z to A) | Trailblazer Backpack | Classic Crew T-Shirt |
| Price (low to high) | Junior Onesie | Storm Fleece Jacket |
| Price (high to low) | Storm Fleece Jacket | Junior Onesie |

Write \`inventory-sort.feature\`.

**Rules**
- One \`Scenario Outline\` with an \`Examples\` table — **all four** options as rows.
- Use the **visible option text** (what the shopper sees), not the \`value\` attribute (\`az\`, \`lohi\`…).
- Check the first **and** last product of each sort, plus a step that the whole list is in the expected order.
- Put the sort option in the outline title.`,
  starterCode: `Feature: Sort products

  Scenario: Sort az
    Given the shopper is logged in as "standard_user"
    When the shopper selects "az"
    Then "Classic Crew T-Shirt" is first

  Scenario: Sort lohi
    Given the shopper is logged in as "standard_user"
    When the shopper selects "lohi"
    Then "Junior Onesie" is first

  # TODO: za and hilo... and turn this into one outline
`,
  solution: `@inventory @regression
Feature: Sort the product list
  Shoppers can sort the Products page by name or price.

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper is on the Products page

  Scenario Outline: Sort by "<sortOption>"
    When the shopper sorts the products by "<sortOption>"
    Then the first product is "<first>"
    And the last product is "<last>"
    And the products are listed in "<sortOption>" order

    Examples:
      | sortOption          | first                | last                 |
      | Name (A to Z)       | Classic Crew T-Shirt | Trailblazer Backpack |
      | Name (Z to A)       | Trailblazer Backpack | Classic Crew T-Shirt |
      | Price (low to high) | Junior Onesie        | Storm Fleece Jacket  |
      | Price (high to low) | Storm Fleece Jacket  | Junior Onesie        |
`,
  checks: [
    { label: 'Uses Scenario Outline', pattern: '^\\s*Scenario (Outline|Template):', hint: 'Replace the copies with one "Scenario Outline:".' },
    { label: 'Sort option is a placeholder', pattern: '"<\\w+>"', hint: 'When the shopper sorts the products by "<sortOption>"' },
    { label: 'All four visible option texts', pattern: '^(?=[\\s\\S]*Name \\(A to Z\\))(?=[\\s\\S]*Name \\(Z to A\\))(?=[\\s\\S]*Price \\(low to high\\))(?=[\\s\\S]*Price \\(high to low\\))', hint: 'Rows for Name (A to Z), Name (Z to A), Price (low to high), Price (high to low).' },
    { label: 'No raw option values', pattern: '"(az|za|lohi|hilo)"|\\|\\s*(az|za|lohi|hilo)\\s*\\|', mustNot: true, hint: 'Use what the shopper sees, not the value attribute.' },
    { label: 'Checks first and last product', pattern: '^(?=[\\s\\S]*\\bfirst\\b)(?=[\\s\\S]*\\blast\\b)', flags: 'mi', hint: 'Then the first product is "<first>" / And the last product is "<last>"' },
    { label: 'Placeholder in the outline title', pattern: '^\\s*Scenario (Outline|Template):[^\\n]*<\\w+>', hint: 'Scenario Outline: Sort by "<sortOption>"' },
  ],
  hints: [
    'Each copy differs only in data — that data becomes the Examples columns.',
    'The dropdown option text is what the business talks about; Select.selectByVisibleText can use it directly in the step definition.',
    'First + last catches a reversed sort that a first-only check could miss when there are ties.',
  ],
  explanation: `Four scenarios with identical steps are a textbook Scenario Outline. Now an option rename is a one-cell change and
the report still shows four separately named results (*Sort by "Price (high to low)"*).

Why visible text? \`az\`/\`lohi\` are implementation details; a BA reading the feature should recognise the screen. The step definition
uses \`new Select(driver.findElement(By.id("product-sort"))).selectByVisibleText(option)\`.

Why first, last **and** full order? First alone is weak: Classic Crew T-Shirt and Retro Red Tee both cost $15.99, and a broken sort can
still put the right item first. The "listed in order" step compares the whole list against a sorted copy, which is the real rule.`,
  mistakes: [
    'Using the option value (az, lohi) in the feature — readable only to developers.',
    'Checking only the first product, so a half-broken sort passes.',
    'Hard-coding all six product names per row — a catalogue change breaks every row; first/last plus a generic order check is enough.',
    'Forgetting quotes around "<sortOption>", so the parentheses and spaces do not match {string}.',
  ],
  interview: [
    { q: 'How do you verify a list is sorted in a step definition?', a: 'Read the names or prices into a List, make a copy, sort the copy with the expected Comparator (reversed for descending) and assertEquals(copy, actual). For prices, parse to BigDecimal first, not strings.' },
    { q: 'When is a Scenario Outline the wrong tool?', a: 'When rows would need different steps or if/else in the glue, or when the table grows to dozens of rows that test the same partition — then it hides intent and slows the suite.' },
  ],
}
