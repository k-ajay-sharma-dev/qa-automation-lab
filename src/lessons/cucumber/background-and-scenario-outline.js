export default {
  slug: 'background-and-scenario-outline',
  category: 'cucumber',
  order: 3,
  title: 'Background and Scenario Outline',
  minutes: 9,
  summary: 'Remove repeated preconditions with Background and run one scenario against many data rows with Scenario Outline and Examples.',
  manualAnalogy: `In a manual suite you write a common precondition once at the top ("All tests: log in as standard_user") and
you keep a data sheet so one test case can be executed with many rows of data. Background is the shared precondition;
Scenario Outline + Examples is the data-driven test case.`,
  body: `## Background: shared preconditions

When every scenario in a file starts with the same Givens, move them into a \`Background\`:

\`\`\`gherkin
Feature: Product sorting

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper is on the products page

  Scenario: Sort by name Z to A
    When the shopper sorts products by "Name (Z to A)"
    Then the first product shown is "Trailblazer Backpack"

  Scenario: Sort by price high to low
    When the shopper sorts products by "Price (high to low)"
    Then the first product shown is "Storm Fleece Jacket"
\`\`\`

How it runs: Cucumber executes the Background steps **before each scenario** in the file - not once for the whole
file. Every scenario still gets a fresh start, which keeps scenarios independent.

Rules that keep a Background healthy:

- **Only one** Background per Feature, placed **before the first Scenario**.
- **Only context** - \`Given\` / \`And\`. No \`When\` or \`Then\`: if setup needs a check, the scenario is doing too much.
- **Short** - two to four lines. A long Background hides important context from the reader.
- It applies to *every* scenario in the file. If one scenario needs different setup, it does not belong in the
  Background (or that scenario belongs in another file).

## Scenario Outline: one test, many data rows

Copy-pasting a scenario three times with different data is the Gherkin version of copying a test case three times
instead of using a data sheet. Use a **Scenario Outline** with an **Examples** table:

\`\`\`gherkin
  Scenario Outline: Sorting by "<option>" puts "<first>" first
    When the shopper sorts products by "<option>"
    Then the first product shown is "<first>"

    Examples:
      | option              | first                |
      | Name (A to Z)       | Classic Crew T-Shirt |
      | Price (low to high) | Junior Onesie        |
      | Price (high to low) | Storm Fleece Jacket  |
\`\`\`

What happens:

- \`<option>\` and \`<first>\` are **placeholders**. The names must match the Examples column headers exactly.
- Cucumber runs the outline **once per data row** (three scenarios here), replacing each placeholder with that row's
  value before matching step definitions.
- Keep the quotes around placeholders (\`"<option>"\`). After substitution the step reads
  \`When the shopper sorts products by "Price (low to high)"\` - exactly the same text a normal scenario would use - so
  the **same step definition** serves both.
- Put a placeholder in the **title** too. Reports then show one readable line per row instead of the same title three
  times.

## Several Examples blocks

You can attach more than one \`Examples:\` block to an outline, each with its own name (and even its own tags). This
is useful to group rows by meaning, for example "valid data" and "rejected data", the way you would split positive
and negative cases in a test design:

\`\`\`gherkin
    Examples: Name sorting
      | option        | first                |
      | Name (A to Z) | Classic Crew T-Shirt |

    Examples: Price sorting
      | option              | first         |
      | Price (low to high) | Junior Onesie |
\`\`\`

## An empty value

A cell can be empty (\`|  |\`). After substitution the step gets \`""\` - an empty string - which is perfect for
"required field" negative tests.

## Your test design becomes the Examples

Equivalence partitions and boundary values - the test design you already do by hand - map straight onto rows. For a
username field that must be 3 to 20 characters you would pick 2 and 3 characters (lower boundary), 20 and 21 (upper
boundary) and one invalid character. Each pick is one row, and a \`why\` column makes the report readable:

\`\`\`gherkin
    Examples: Outside the rule
      | username               | why                  |
      | ab                     | one below minimum    |
      | abcdefghijklmnopqrstu  | one above maximum    |
\`\`\`

If accepted and rejected values need different \`Then\` steps, write **two** outlines - one per outcome - rather than an
"expected" column that the Java code has to branch on.

## When a Background hurts

Background removes duplication, but the reader has to keep its steps in mind while reading every scenario. It starts
hurting when:

- it contains an **action** (\`When\`) - the behaviour under test disappears from the scenarios;
- it holds setup only **some** scenarios need - the others start "undoing" it ("Given the shopper goes back to...");
- it grows past three or four lines - readers skip it and the scenarios become one-line mysteries.

The fix is to move partial setup back into the scenarios that need it. Repeating one short, meaningful \`Given\` in two
scenarios is fine: feature files value being **readable on their own** (DAMP) over having zero duplication (DRY).

## Choosing between them

| Need | Use |
|---|---|
| Same starting steps in every scenario of the file | Background |
| Same steps, different data and expected results | Scenario Outline + Examples |
| A list of items fed into one step (a form, a set of products) | DataTable (see the *Cucumber DataTables* lesson) |

Do not turn everything into an outline. If rows need different *steps* (not just different data), they are
different scenarios.`,
  keyPoints: [
    'Background runs before EACH scenario in the file, not once per file.',
    'Background holds only Given/And context, appears once, before the first Scenario.',
    'Scenario Outline runs once per Examples row; <placeholders> must match the column headers.',
    'Keep placeholders inside quotes so the same step definition works for outlines and normal scenarios.',
    'Put a placeholder in the outline title so each row is identifiable in the report.',
    'Boundary values and partitions from your test design become Examples rows; split outlines by outcome.',
    'A Background with actions or partial setup hurts readability - keep it to short context every scenario needs.',
  ],
  mistakes: [
    'Putting a When or Then in the Background. Fix: keep only context there; actions and checks belong in scenarios.',
    'Placeholder spelled differently from the column header (<user> vs username). Fix: copy the header name exactly.',
    'Writing "Scenario:" instead of "Scenario Outline:" with an Examples table. Fix: use Scenario Outline (or "Scenario Template").',
    'Forcing rows with different steps into one outline. Fix: split into separate scenarios.',
  ],
  tryIt: `On http://localhost:5180/practice-site/inventory.html try each option of the sort dropdown and note the first
product. Write those observations as an Examples table under an outline.`,
  problems: ['cuc-004', 'cuc-005', 'cuc-017', 'cuc-018', 'cuc-027', 'cuc-032'],
}
