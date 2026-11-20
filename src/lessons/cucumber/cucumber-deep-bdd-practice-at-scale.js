export default {
  slug: 'cucumber-deep-bdd-practice-at-scale',
  category: 'cucumber',
  order: 12,
  title: 'Deep dive: BDD in practice — discovery, example mapping, writing features at scale and living documentation',
  minutes: 30,
  summary: 'Run BDD as a process rather than a tool — Discovery with Three Amigos and Example Mapping (worked through for ShopEasy checkout validation and the BRIGHT25 promo code), Formulation into Gherkin and Automation; organise hundreds of feature files by capability with a ubiquitous-language glossary, choose between Outline, DataTable, Doc String and separate scenarios, decide what data belongs in Gherkin, govern a tag taxonomy, fix the anti-patterns that appear at scale, publish living documentation with traceability, review feature-file PRs, and know honestly when Cucumber is not worth it and how to measure whether BDD is working.',
  manualAnalogy: `Experienced manual testers know that the most valuable testing often happens in the refinement meeting: asking "what happens if the postal code has spaces?" before a line of code exists prevents a bug that would otherwise be found — and argued about — two weeks later. BDD makes that habit systematic: the questions and concrete examples agreed by product owner, developer and tester become the acceptance criteria, then the automated scenarios, then the documentation. Cucumber is only the last step; a team that skips the conversation just has a slower test runner.`,
  body: `## Where the earlier lessons stop

The beginner lessons cover the *syntax* and the first habits: converting a manual test case (\`gherkin-from-manual-test-case\`), declarative style and the classic anti-patterns (\`declarative-gherkin-and-anti-patterns\`), Background and Outline (\`background-and-scenario-outline\`), tags (\`cucumber-tags\`), and Rule, Doc Strings and a first look at example mapping and living documentation (\`gherkin-rules-docstrings-living-docs\`). How Cucumber-JVM executes all of this is in \`cucumber-deep-architecture-internals\`; step-library design and parameter types in \`cucumber-deep-steps-parameter-types-datatables\`; DI and hooks in \`cucumber-deep-dependency-injection-hooks\`; parallel runs and reporting stacks in \`cucumber-deep-execution-reporting-parallel\`.

This lesson is about **practice at team scale**: how BDD is run as a process, how a suite of hundreds of feature files stays readable and governed, and when the whole approach is not worth its cost. That is what senior SDET interviews probe with "how do you do BDD on your team?" — and where weak answers describe only Cucumber annotations.

## BDD is a process, not a tool

BDD has three practices. Cucumber only supports the third.

| Practice | Who | Output | What goes wrong when it is skipped |
|---|---|---|---|
| **Discovery** — conversations about concrete examples | PO/BA, developer, tester (Three Amigos); sometimes UX, support | rules, examples, open questions, a smaller or split story | ambiguities are found by testers after development, as bugs and rework |
| **Formulation** — writing the examples as Gherkin | tester or developer, reviewed by the PO | feature files that read as specification | scenarios written after the fact as test scripts; nobody but QA reads them |
| **Automation** — wiring scenarios to the system | developers and SDETs | executable acceptance tests that guide development | scenarios exist but are not run, or are automated so late they only document what was built |

The order matters: **discovery before development, formulation before or at the start of development, automation during development** (ideally the scenario goes red before the code exists and green when the story is done). A team that writes feature files *after* the feature is built is doing test automation with a Gherkin syntax — legitimate, but not BDD, and usually not worth Cucumber's overhead (see the last major section).

## Discovery: Three Amigos and Example Mapping

### Three Amigos

A short session (often 20–30 minutes per story, during refinement) with three perspectives: **business** (what problem, which rules), **development** (how it could work, technical constraints), **testing** (what could go wrong, edge cases, what "done" looks like). The tester's job is not to write test cases in the meeting; it is to ask for **concrete examples** until the rules are unambiguous.

### Example Mapping

Example Mapping (a technique from the Cucumber community) structures the conversation with four colours of cards:

| Card | Colour (convention) | Content |
|---|---|---|
| Story | yellow | the user story under discussion, at the top |
| Rule | blue | one business rule or acceptance criterion, in a column |
| Example | green | a concrete example illustrating the rule above it, written as a short "friends episode" title ("The one where the postal code has 2 characters") |
| Question | red | something nobody in the room can answer; it goes to the person who can |

How it works: timebox (about 25 minutes), start from the story, write the rules you already know, ask for examples under each, and park every unknown as a red card instead of debating it. **Reading the map** is the real value:

- **many red cards** → the story is not ready; do not pull it into the sprint;
- **many blue cards** → the story is too big; split by rule;
- **a rule with many examples** → a complex rule; maybe a Scenario Outline, maybe a unit-level concern;
- **a rule with no examples** → nobody understands it yet;
- **everyone nods and there are no red cards on a non-trivial story** → nobody asked hard questions.

### Example map 1: ShopEasy checkout — delivery details validation (real behaviour)

The ShopEasy checkout step 1 (\`checkout.html\`, "Checkout: Your Information") asks for First Name, Last Name and Zip/Postal Code. Its actual behaviour, read from the page script, gives us realistic rules and examples:

\`\`\`text
STORY (yellow)   As a shopper I want clear feedback on my delivery details
                 so that my order is not sent to a wrong or incomplete address

RULE (blue) R1  First name, last name and postal code are required
  EX (green)    The one with no first name            → "Error: First Name is required"
  EX            The one with no last name             → "Error: Last Name is required"
  EX            The one with no postal code           → "Error: Postal Code is required"
  EX            The one where the first name is only spaces → treated as missing

RULE R2         Only the first problem is shown, checked in the order first name, last name, postal code
  EX            The one where everything is empty     → only "Error: First Name is required"

RULE R3         A postal code is 3-10 letters, digits, spaces or hyphens
  EX            "560001"   → accepted
  EX            "SW1A 1AA" → accepted (space inside)
  EX            "AB"       → "Error: Postal Code is invalid" (too short)
  EX            "56000-12345" (11 chars) → invalid (too long)
  EX            "560_001"  → invalid (underscore)

RULE R4         Spaces around a value are ignored
  EX            " 560001 " → accepted, shown as "560001" in "Shipping to"

QUESTIONS (red)
  Q1  The API (POST /api/orders) reports ALL invalid fields at once (VALIDATION_FAILED with details);
      the UI shows only the first. Is that intended, or should the UI list all problems?
  Q2  "---" passes the postal-code rule today (3 hyphens). Do we accept that?
  Q3  Do postal-code rules depend on the country? (No country field exists yet.)
  Q4  Are names limited in length or characters (e.g. "José", "O'Brien")?
\`\`\`

Notice what the examples did: R4 and Q2 were not in anybody's head before someone wrote concrete values. Q1 is a genuine inconsistency between the UI and the ShopEasy API (\`validateCustomer\` in the API collects every field error; the page returns at the first). The tester surfaced it in ten minutes; found in system testing it would be a defect, a debate and a re-test.

### Example map 2: the BRIGHT25 promo code (not built yet)

ShopEasy's inventory page already shows a banner — *Deal of the day: Pulse Bike Light now only $7.49 with code BRIGHT25 at checkout* — but **the checkout has no promo-code field**. That makes it a realistic "story in refinement". The rules below are an illustrative outcome of such a session, not existing ShopEasy behaviour:

\`\`\`text
STORY   As a shopper I want to apply the deal-of-the-day code so that I pay less for the Pulse Bike Light

RULE R1  BRIGHT25 lowers the Pulse Bike Light from $9.99 to $7.49
  EX     Bike light alone → item total $7.49, tax (8%) $0.60, total $8.09
RULE R2  Other products keep their price
  EX     Backpack $29.99 + bike light with code → item total $37.48
RULE R3  Any other code is rejected and prices do not change
  EX     "BRIGHT24", "SAVE10", empty code → rejected

QUESTIONS
  Q1  Is "bright25" (lower case) valid?            → PO decides: rejected (case-sensitive)
  Q2  25% of 9.99 is 7.4925 — round down or half-up? → banner says $7.49: round down to the cent
  Q3  Tax on the discounted or the original price?  → on the discounted item total
  Q4  "Deal of the day" — which day, which time zone, what happens to an open cart at midnight?   (open)
  Q5  Can the code be combined with another code? Removed again?                                  (open)
  Q6  Exact rejection text? (UX to decide; feature uses a placeholder until then)                 (open)
\`\`\`

Two open questions about time and combination are a signal: either answer them before the sprint or **split** the story (R1–R3 now, expiry and stacking later). Turning this map into a feature file — Rules, concrete prices, an Outline for rejected codes, \`@wip\` and the ticket tag — is the exercise in problem \`cuc-028\`, so it is not written out here.

## Formulation: from the map to Gherkin

Mapping is direct: **story → Feature description, rule → \`Rule:\`, green card → \`Example:\` or an Outline row, red card → not in the feature until answered**. The checkout map becomes:

\`\`\`gherkin
@checkout @ui @SHOP-204
Feature: Delivery details at checkout
  Before seeing the order overview, a shopper says who the order is for and where it goes.
  Problems are reported one at a time, starting with the first field.

  Background:
    Given the shopper is logged in as "standard_user"
    And the shopper has "Trailblazer Backpack" in the cart

  Rule: First name, last name and postal code are required

    Scenario Outline: Checkout stops when the <field> is missing
      When the shopper continues checkout without a "<field>"
      Then checkout stops with the message "<message>"

      Examples:
        | field       | message                        |
        | first name  | Error: First Name is required  |
        | last name   | Error: Last Name is required   |
        | postal code | Error: Postal Code is required |

    Example: A first name made only of spaces counts as missing
      When the shopper continues checkout as "   " "Rao" with postal code "560001"
      Then checkout stops with the message "Error: First Name is required"

  Rule: Only the first problem is reported

    Example: An empty form reports the first name only
      When the shopper continues checkout without any delivery details
      Then checkout stops with the message "Error: First Name is required"

  Rule: A postal code is 3 to 10 letters, digits, spaces or hyphens

    Example: A UK-style postal code with a space is accepted
      When the shopper continues checkout as "Asha" "Rao" with postal code "SW1A 1AA"
      Then the order overview shows shipping to "Asha Rao, SW1A 1AA"

    Example: A two-character postal code is rejected
      When the shopper continues checkout as "Asha" "Rao" with postal code "AB"
      Then checkout stops with the message "Error: Postal Code is invalid"

  Rule: Spaces around values are ignored

    Example: Spaces around the postal code are trimmed
      When the shopper continues checkout as "Asha" "Rao" with postal code " 560001 "
      Then the order overview shows shipping to "Asha Rao, 560001"
\`\`\`

(\`@SHOP-204\` is an illustrative ticket id.) Decisions a reviewer should recognise:

- **Rules are sentences a PO would say**; the report now reads as the specification of the page.
- Only **two** postal-code examples go through the UI. The full boundary set (2, 3, 10, 11 characters, underscore, "---") belongs one level down — see "Testing through the UI what belongs below it".
- The red cards (Q1–Q4) are **not** in the feature. When the PO answers Q1 ("show all errors"), Rule 2 changes — and the failing scenario will tell the developer.
- Step wording comes from the **glossary** ("continues checkout", "delivery details", "order overview"), not from the labels on the page ("Zip/Postal Code", "Continue button").

## Automation: who writes features, and when

| Moment | Activity | Owner |
|---|---|---|
| Backlog refinement | Example Mapping; red cards assigned | Three Amigos; PO owns answers |
| Before sprint starts | feature file drafted from the map, tagged \`@wip @SHOP-nnn\`; PO reviews wording (PR or pairing) | tester or developer |
| Day 1 of development | steps wired (often pending at first); scenario runs red | developer + SDET |
| During development | scenarios turn green one by one; new questions go back to the PO, not into guesswork | developer |
| Definition of Done | all scenarios of the story green, \`@wip\` removed, feature merged with the code | team |
| Later changes | a behaviour change starts with changing the feature file in the same PR as the code | whoever changes the behaviour |

Who *writes* the Gherkin matters less than who *reads and agrees* to it. In practice testers or developers write, and the PO/BA reviews — a feature that no business person has ever read is not a specification. Teams where the PO writes Gherkin alone tend to produce UI scripts or vague outcomes; pairing a PO with a tester for the first few stories fixes that faster than a style guide.

## Writing features at scale

### Organise by capability

At 20 features any layout works; at 300 the layout is your table of contents. Organise **by business capability**, not by sprint, ticket, test type or page:

\`\`\`text
src/test/resources/features/
├── auth/
│   ├── login.feature                  valid login, error messages, locked-out user
│   └── logout.feature
├── catalogue/
│   ├── sorting.feature                Name (A to Z), Name (Z to A), Price (low to high), Price (high to low)
│   └── product_details.feature        (typical real app; ShopEasy has no details page)
├── cart/
│   ├── cart_contents.feature          add, remove, empty-cart message
│   └── cart_badge.feature
├── checkout/
│   ├── delivery_details.feature       the feature above
│   ├── order_overview.feature         item total, tax 8%, total
│   ├── order_confirmation.feature     "Thank you for your order!"
│   └── promo_code.feature             @wip until SHOP-311 is built
└── orders/
    ├── order_history_api.feature      GET /api/orders — only the caller's orders
    └── order_access_api.feature       403 FORBIDDEN "This order belongs to another customer"
\`\`\`

- **One feature = one capability** a business person would name. "Delivery details at checkout" is a capability; "Checkout page tests" and "Sprint 14 regression" are not.
- File names in snake_case, matching the Feature title; folder = first-level tag (\`@checkout\`), which makes "run everything about checkout" trivial and keeps tags and folders consistent.
- \`orders/\` is API-only because ShopEasy has no order-history page — capability folders are about *behaviour*, and the same capability can be specified through the API.
- **Split** a feature when it passes roughly 10–15 scenarios or when its Rules address different readers; **merge** features that keep repeating the same Background.

### Rules, scenario names and behaviour

Use \`Rule:\` whenever a feature has more than one business rule — it is the cheapest way to make a feature file read as specification. Name scenarios after **behaviour and outcome**, so the report is readable without opening steps:

| Weak name | Why | Better |
|---|---|---|
| Checkout test 3 | says nothing | Checkout stops when the postal code is missing |
| Verify error message | which error, when? | A two-character postal code is rejected |
| Login negative | a test category, not behaviour | A locked-out shopper cannot log in |
| Sort dropdown works | "works" is not an outcome | Sorting by price (low to high) puts Junior Onesie first |
| SHOP-311 AC2 | ticket ids belong in tags | The promo code does not change other products' prices |

### Ubiquitous language: the glossary

Step explosion and unreadable reports both start with vocabulary drift: "user", "customer", "shopper"; "basket" and "cart"; "zip", "pin", "postal code". Keep a **glossary** next to the features (a \`GLOSSARY.md\` in the features root or a wiki page owned by the PO) and review steps against it.

| Term | Meaning in ShopEasy | Do not use |
|---|---|---|
| shopper | a person using the shop, logged in or not | user, customer, client, I |
| standard shopper / locked-out shopper | personas backed by the accounts \`standard_user\` / \`locked_out_user\` | test user 1 |
| catalogue | the product list on the inventory page | inventory, product grid |
| cart / cart badge | the selected products / the count on the cart icon | basket, bag, counter |
| delivery details | first name, last name, postal code at checkout | address form, step 1 |
| order overview | the checkout summary: item total, tax (8%), total | step 2, summary page |
| order confirmation | "Thank you for your order!" with an order number | success page |

The glossary also decides **perspective**: third person ("the shopper") is clearer in reports than "I", and it allows several actors in one scenario (a shopper and a seller) without confusion.

### Outline vs DataTable vs Doc String vs separate scenarios

| Situation | Tool | ShopEasy example |
|---|---|---|
| Same behaviour, several input/output pairs, each pair independently meaningful | **Scenario Outline** | the three "is required" messages |
| One example needs structured data (a list or a record) | **DataTable** | the products in the cart with prices for an overview total |
| One example needs a block of free or nested text | **Doc String** | a JSON order body for the API |
| Examples prove *different rules* or need different explanations | **separate scenarios** (under different Rules) | "spaces count as missing" vs "only the first problem is reported" |
| A large matrix of boundary values | **not Gherkin** — unit or API tests; keep 1–2 representative scenarios | 12 postal-code boundaries |

The trap with Outlines is a table whose rows prove different rules (a column called \`expectedOutcome\` with "error" and "success" mixed, and steps that branch inside Java). If the Then step needs an \`if\`, split into separate outlines or scenarios.

**Recommended approach and why:** default to **separate concrete examples under Rules**; use an Outline only when the rows are truly the same behaviour, a DataTable when one example has structured data, and push large matrices below the UI. Readers understand one concrete example per behaviour far better than a 15-row table.

### What data belongs in the feature file

| Belongs in Gherkin | Belongs in code, fixtures or configuration |
|---|---|
| values the business cares about and that explain the rule: "$9.99 → $7.49", "AB is rejected" | technical ids, URLs, selectors, JSON paths |
| personas: "the standard shopper", or the account name if it is the rule (\`locked_out_user\`) | **passwords and tokens** — never; resolved from the persona in a fixture or secret store |
| exact user-visible messages that are part of the specification | environment names, base URLs, timeouts |
| the minimum data the example needs | incidental data (a first name in a postal-code example can be defaulted by the step) |

"Incidental data" is the key senior idea: if the scenario is about the postal code, the names are noise. A step like \`When the shopper continues checkout without a "postal code"\` lets the step definition fill valid defaults for everything else, so a reader sees only what matters.

### Scenario size

Practical limits for a team at scale (guidelines, not laws):

- **3–7 steps** per scenario; more than ~10 means two behaviours or missing abstraction;
- **one When** (one behaviour); several Thens are fine if they assert one outcome;
- Background ≤ 2–3 lines, all *context* (Givens) every scenario needs;
- step text under ~100 characters; no "and" inside a step;
- an Outline with more than ~6–8 rows is probably a lower-level test in disguise.

## Tagging taxonomy and governance

Tags are an API used by CI jobs, hooks and reports, so they need a **closed vocabulary** and an owner.

| Dimension | Tags | Who uses them |
|---|---|---|
| Suite | \`@smoke\`, \`@regression\` | CI jobs (deploy gate vs nightly) |
| Capability | \`@auth\`, \`@catalogue\`, \`@cart\`, \`@checkout\`, \`@orders\` (= folder) | targeted runs, ownership, reports by area |
| Layer | \`@ui\`, \`@api\` | runner configuration, hooks (start a browser only for \`@ui\`) |
| Risk | \`@risk-high\`, \`@risk-medium\`, \`@risk-low\` | prioritised runs when time is short |
| Ticket | \`@SHOP-311\` | traceability to Jira |
| Status | \`@wip\` (not built yet), \`@quarantine\` (known flaky/broken, must carry a ticket) | excluded from gating runs |
| Environment | \`@env-staging-only\` | jobs that know their environment |

Governance rules that keep this from rotting:

1. Tags are **lower-case** (ticket ids excepted) and come from the list above; anything else fails the build.
2. \`@quarantine\` requires a ticket tag on the same element, and quarantined scenarios are reviewed weekly — a quarantine without an exit date becomes a graveyard.
3. \`@wip\` older than the sprint is a conversation, not a tag.
4. Capability tags go on the Feature (inherited), suite tags on scenarios.

A small JUnit 5 test enforces the vocabulary on every build (illustrative; adjust the sets to your taxonomy):

\`\`\`java
package com.shopeasy.governance;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

class FeatureTagPolicyTest {

    private static final Path FEATURES = Path.of("src/test/resources/features");
    private static final Pattern TAG = Pattern.compile("@[^\\\\s@]+");
    private static final Pattern TICKET = Pattern.compile("@SHOP-\\\\d+");
    private static final Set<String> ALLOWED = Set.of(
            "@smoke", "@regression", "@ui", "@api", "@wip", "@quarantine",
            "@risk-high", "@risk-medium", "@risk-low", "@env-staging-only",
            "@auth", "@catalogue", "@cart", "@checkout", "@orders");

    @Test
    void featureFilesUseOnlyGovernedTags() throws IOException {
        List<String> violations = new ArrayList<>();
        try (Stream<Path> files = Files.walk(FEATURES)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".feature")).toList()) {
                List<String> lines = Files.readAllLines(file);
                for (int i = 0; i < lines.size(); i++) {
                    String line = lines.get(i).trim();
                    if (!line.startsWith("@")) {
                        continue;                                  // tags sit on their own lines
                    }
                    List<String> tags = tagsOn(line);
                    String where = FEATURES.relativize(file) + ":" + (i + 1);
                    for (String tag : tags) {
                        if (!ALLOWED.contains(tag) && !TICKET.matcher(tag).matches()) {
                            violations.add(where + " unknown tag " + tag);
                        }
                    }
                    if (tags.contains("@quarantine") && tags.stream().noneMatch(t -> TICKET.matcher(t).matches())) {
                        violations.add(where + " @quarantine without a ticket tag");
                    }
                }
            }
        }
        assertTrue(violations.isEmpty(), "Tag policy violations:\\n" + String.join("\\n", violations));
    }

    private static List<String> tagsOn(String line) {
        List<String> tags = new ArrayList<>();
        Matcher m = TAG.matcher(line);
        while (m.find()) {
            tags.add(m.group());
        }
        return tags;
    }
}
\`\`\`

How it works: it walks the features folder, treats lines starting with \`@\` as tag lines (that is where Gherkin puts them), and collects every unknown tag and every \`@quarantine\` without a ticket with its file and line. It runs in milliseconds, needs no Cucumber runtime, and turns a style guide into a failing build. A more precise alternative parses files with the Gherkin parser library and checks tags per AST node (for example "suite tags only on scenarios"), at the cost of depending on that library's API.

## Anti-patterns at scale, with rewrites

The beginner lesson lists the basic anti-patterns (scenario dependencies, UI mechanics, sleeps, mega-scenarios). At scale, these are the ones that cost the most:

| Anti-pattern | Symptom at scale | Fix |
|---|---|---|
| UI-click scripts | every UI change edits dozens of feature files | declarative steps in glossary language |
| Scenario dependencies | failures only in full runs; parallel runs impossible | each scenario arranges its own state (API or storage seeding) |
| Giant Background | scenarios unreadable alone; slow; steps that only some scenarios need | Background = shared context only; rest into scenario Givens or a new feature |
| Step explosion | 900 step definitions, 40 ways to log in | glossary, parameterised steps, step library ownership |
| Conjunction steps | steps that can never be reused | one idea per step |
| Technical jargon | POs stop reading features | business outcomes; technical detail in step code |
| Testing through the UI what belongs below it | slow, flaky suites with huge Outlines | push matrices to API/unit tests; keep representative UI examples |

### Rewrite 1: UI-click script → behaviour

\`\`\`gherkin
# Before
Scenario: sort test
  Given I open "http://localhost:5180/practice-site/login.html"
  And I enter "standard_user" in "#user-name"
  And I enter the password
  And I click "#login-button"
  When I select "hilo" from "#product-sort"
  Then the text of ".inventory-item:first-child .item-name" should be "Storm Fleece Jacket"
\`\`\`

\`\`\`gherkin
# After
Scenario: Sorting by price (high to low) puts the most expensive product first
  Given the shopper is logged in as "standard_user"
  When the shopper sorts products by "Price (high to low)"
  Then the first product shown is "Storm Fleece Jacket"
\`\`\`

The option value \`hilo\` and the selectors move into the page object; the scenario uses the visible option text the business knows.

### Rewrite 2: conjunction steps → one idea per step

\`\`\`gherkin
# Before
When the shopper adds "Trailblazer Backpack" and "Pulse Bike Light" to the cart and goes to checkout and enters "Asha" "Rao" "560001"
Then the total is "$43.18"
\`\`\`

\`\`\`gherkin
# After
Given the shopper has these products in the cart:
  | Trailblazer Backpack |
  | Pulse Bike Light     |
When the shopper reviews the order with valid delivery details
Then the order overview shows an item total of "$39.98", tax of "$3.20" and a total of "$43.18"
\`\`\`

The cart is context (Given, ideally seeded through \`sessionStorage\` key \`shopeasy.cart\`), the behaviour is reviewing the order, and the outcome is one coherent overview check ($29.99 + $9.99 = $39.98, 8% tax = $3.20).

### Rewrite 3: giant Background → context only

\`\`\`gherkin
# Before — catalogue/product_details.feature
Background:
  Given the shopper is logged in as "standard_user"
  And the shopper sorts products by "Price (low to high)"
  And the shopper has "Retro Red Tee" in the cart
  And the shopper opens the details of "Junior Onesie"

Scenario: Product details show the price
  Then the price shown is "$7.99"

Scenario: Adding from the details page updates the badge
  When the shopper adds the product to the cart
  Then the cart badge shows 2
\`\`\`

\`\`\`gherkin
# After
Background:
  Given the shopper is logged in as "standard_user"

Scenario: Product details show the price
  When the shopper opens the details of "Junior Onesie"
  Then the price shown is "$7.99"

Scenario: Adding from the details page counts towards the cart badge
  Given the shopper has "Retro Red Tee" in the cart
  When the shopper adds "Junior Onesie" to the cart from its details
  Then the cart badge shows 2
\`\`\`

The sort step served no scenario; the cart item served one. Each scenario now shows its own context and its own When. (ShopEasy has no product-details page — product names on the inventory page are not links — so treat this rewrite as a typical real-app illustration.)

### Rewrite 4: step explosion → one step, one vocabulary

Found in a step library audit (the \`usage\` plugin lists definitions and their use counts):

\`\`\`java
@Given("I add the backpack to the cart")                      // used 3 times
@Given("the user adds {string} to the basket")                 // used 11 times
@Given("the shopper adds {string} to the cart")                // used 140 times
@Given("{string} is added to cart")                            // used 2 times
@Given("the customer has added {string} to their shopping cart") // used 5 times
\`\`\`

Rewrite: keep the glossary form (\`the shopper adds {string} to the cart\` as action, \`the shopper has {string} in the cart\` as context), migrate the 21 other usages with a search-and-replace PR reviewed by the PO, delete the rest. Prevention is organisational: one owner for the step library, the glossary in PR review, and a dry-run job that fails on undefined steps so new wording is noticed. Designing the step library itself is covered in \`cucumber-deep-steps-parameter-types-datatables\`.

### Rewrite 5: technical jargon → business outcome

\`\`\`gherkin
# Before — in a business-facing checkout feature
Then the POST to /api/orders returns HTTP 400
And the JSON path "error.code" equals "VALIDATION_FAILED"
And "error.details[0].field" equals "postalCode"
\`\`\`

\`\`\`gherkin
# After
Then the order is rejected because the postal code is missing
\`\`\`

The status, code and field are asserted inside the step definition. Nuance: for a feature whose readers are *API consumers* (another team integrating with \`/api/orders\`), status codes and error codes **are** the domain language — there a scenario like "Then the order is rejected with error VALIDATION_FAILED for postalCode" is appropriate. Jargon is relative to the reader.

### Rewrite 6: testing through the UI what belongs below it

\`\`\`gherkin
# Before — 14 rows through the browser, ~6 s each
Scenario Outline: Postal code "<code>" validation
  When the shopper continues checkout as "Asha" "Rao" with postal code "<code>"
  Then the result is "<result>"
  Examples:
    | code        | result  |
    | 12          | invalid |
    | 123         | valid   |
    | 1234567890  | valid   |
    | 12345678901 | invalid |
    | ...         | ...     |
\`\`\`

After: the UI feature keeps the two examples shown earlier (one accepted, one rejected) because they prove the page wires validation and messages correctly. The boundary matrix moves down:

- API level: \`POST /api/orders\` with \`postalCode: "AB"\` → \`400 VALIDATION_FAILED\` with the detail "postalCode must be 3-10 letters, digits, spaces or dashes" — fast, no browser;
- unit level: the validator's regex, if the team owns the code.

The Gherkin stays the specification of the rule; the exhaustive check lives where it is cheapest and most stable.

## Living documentation

Living documentation is feature files that are **executed on every build** and **published where people read them**. Publishing options:

| Option | How | Strengths | Caveats |
|---|---|---|---|
| Cucumber HTML report (\`html:\` plugin, built from messages) | archive as a CI artefact | complete: Gherkin, results, attachments, searchable | one run at a time; people must know where to find it |
| Report published to a team portal/static site | CI publishes the HTML or a generated site per main-branch build | one stable URL for POs and support | needs a small pipeline step; keep it access-controlled |
| Cucumber Reports service (\`reports.cucumber.io\`, \`cucumber.publish.enabled=true\`) | uploads the run and prints a link | zero setup | operated by the Cucumber maintainers as a free, anonymous service; reports are temporary and visible to anyone with the link — **never** for company data; disable and silence it (\`cucumber.publish.enabled=false\`, \`cucumber.publish.quiet=true\`) in company projects |
| Test-management tools (e.g. Jira add-ons such as Xray or Zephyr) | import Cucumber results (JSON/JUnit XML) and link by ticket tags | traceability in the tool POs already use | import formats and tag conventions are tool-specific — check the vendor's docs |
| Living-documentation generators (e.g. Serenity BDD reports) | aggregate features by capability/requirement | requirement-oriented view, coverage per capability | another framework and its conventions |

**Traceability to Jira**: tag the Feature or scenario with the story id (\`@SHOP-311\`), link the feature file path from the story, and let CI comment the result on the ticket or let the test-management tool import results. The goal is answering "which scenarios prove SHOP-311, and are they green on main?" in one click.

What keeps documentation *living*:

- features live **in the same repository** as the code they specify (or in a repo the developers change in the same PR); a separate QA repo drifts;
- a behaviour change starts with the feature file, in the same PR as the code;
- the published report is the **main branch**, not someone's last local run;
- Rules and scenario names are written for readers — reports are only as readable as the Gherkin.

**Recommended approach and why:** publish the HTML report from every main-branch build to one stable, access-controlled URL, organised by capability folder, with ticket tags for traceability; integrate a test-management tool only if the organisation already lives in it. Never use the public reports service for company work.

## Review checklist for feature-file PRs

- **Readability**: can a PO understand every scenario from its name and steps alone? Rules stated as business sentences?
- **Behaviour**: one When per scenario; outcome observable by a user or API consumer; no "and" inside steps.
- **Language**: steps use glossary terms; no selectors, URLs, clicks, waits, JSON paths (unless the readers are API consumers).
- **Data**: only data that explains the rule; concrete values ("$7.49", not "the discounted price"); no passwords or tokens.
- **Structure**: Background only shared context and short; Outline rows are one behaviour; large matrices pushed below the UI.
- **Independence**: each scenario arranges its own state; runs alone and in parallel.
- **Placement**: right capability folder; one capability per feature; file name matches the Feature.
- **Tags**: from the governed list; capability on the Feature; ticket tag present; \`@wip\`/\`@quarantine\` justified.
- **Glue impact**: new steps really new? (Search the step library; the dry-run job shows undefined steps.)
- **Specification**: if the PR changes behaviour, does the feature change too — and has the PO seen it?

## When BDD/Cucumber is NOT worth it

Cucumber adds a layer: Gherkin text, step definitions mapping text to code, a matching engine, and a second place where a test can break. That layer pays off only when **non-engineers read or shape the scenarios**. Honest comparison:

| | Cucumber + BDD process | TestNG/JUnit 5 with good names | Playwright Test with \`test.step\` |
|---|---|---|---|
| Readers | PO, BA, support, devs, testers | engineers | engineers (report readable by others) |
| Specification before code | natural (Gherkin from example maps) | possible, but nobody outside the team reads Java | same as JUnit |
| Cost | extra glue layer, step library maintenance, regex/expression debugging | lowest | low |
| Refactoring | IDE cannot rename across Gherkin and Java safely | full IDE refactoring | full IDE refactoring |
| Data-driven | Outlines, DataTables | parameterised tests, data providers | parameterised projects / loops |
| Reports | business-readable by construction | readable if names and display names are good | HTML report with nested steps, traces |
| Best for | products with active business collaboration, regulated domains needing traceable acceptance criteria | dev-only teams, libraries, API-heavy and component suites | web UI suites in TypeScript |

Signals that Cucumber is overhead:

- **no business collaboration** — nobody outside engineering reads the features, and none were written before development;
- **dev-only or platform teams** — internal services, libraries, infrastructure; the readers are engineers;
- **API-heavy suites** where every step is "send request / check field" — the Gherkin restates the code;
- feature files are generated from or mirror test-case spreadsheets after the fact.

What "good names" look like without Cucumber:

\`\`\`java
@DisplayName("Delivery details at checkout")
class DeliveryDetailsTest {

    @Nested
    @DisplayName("A postal code is 3 to 10 letters, digits, spaces or hyphens")
    class PostalCodeFormat {

        @Test
        @DisplayName("a two-character postal code is rejected")
        void twoCharacterPostalCodeIsRejected() {
            checkout.continueWith(Customer.valid().withPostalCode("AB"));
            assertEquals("Error: Postal Code is invalid", checkout.errorMessage());
        }
    }
}
\`\`\`

\`\`\`ts
test('a two-character postal code is rejected', async ({ page }) => {
  await test.step('given a logged-in shopper with a product in the cart', async () => { /* seed session and cart */ });
  await test.step('when they continue checkout with postal code "AB"', async () => {
    await page.getByTestId('firstName').fill('Asha');
    await page.getByTestId('lastName').fill('Rao');
    await page.getByTestId('postalCode').fill('AB');
    await page.getByTestId('continue').click();
  });
  await test.step('then checkout stops with "Error: Postal Code is invalid"', async () => {
    await expect(page.locator('#checkout-error-message')).toHaveText('Error: Postal Code is invalid');
  });
});
\`\`\`

The nested display names reproduce Feature → Rule → Example structure in the JUnit report; \`test.step\` gives Given/When/Then-like sections in the Playwright report and trace — without a glue layer.

**Recommended approach and why:** use **Cucumber where the BDD conversation actually happens** — typically customer-facing journeys and business rules reviewed by POs — and plain TestNG/JUnit or Playwright Test elsewhere (API contract suites, component and edge-case matrices). Many healthy teams run both in one repository. If the conversation is not happening, fix that first or drop Gherkin; a Cucumber suite nobody but QA reads costs more than it returns. Saying this clearly in an interview signals seniority more than any annotation knowledge.

## Measuring BDD success

Measure the **process outcomes**, not the number of scenarios:

| Metric | Why it matters | Watch out |
|---|---|---|
| % of stories example-mapped before sprint start | is Discovery actually happening? | counting meetings, not maps with examples |
| red cards raised in refinement vs requirement defects found after development | shift-left of ambiguity | needs consistent defect classification |
| rework / reopened stories due to misunderstood requirements | the cost BDD is supposed to cut | trend over quarters, not sprints |
| feature files reviewed (or edited) by POs/BAs — from PR reviewers and git history | are features a shared artefact? | one PO approving everything blindly |
| time from story start to first green acceptance scenario | is automation part of development? | — |
| undefined/ambiguous steps caught by the PR dry-run job; step-definition count vs usage | step-library health | — |
| escaped defects in capabilities covered by scenarios | does the suite protect what matters? | small numbers; use with judgement |
| flaky rate and quarantine age | trust in the living documentation | a long quarantine list means nobody trusts the report |

A short quarterly look at these with the PO is more persuasive than a dashboard of "1,200 scenarios automated" — a number that usually grows fastest in teams doing BDD badly.

## Interview questions

### Q: What is BDD, and how is it different from using Cucumber?
**Short answer (30–60 s):** BDD is a collaboration practice: Discovery (conversations with concrete examples), Formulation (writing them as a shared specification) and Automation (executing that specification). Cucumber only automates Gherkin. A team writing feature files after development is doing test automation with Gherkin syntax, not BDD.

**Detailed answer:** The value is in Discovery — ambiguities and missing rules are found before code exists, by PO, developer and tester together. Formulation makes those examples precise and reviewable by the business; Automation turns them into acceptance tests that guide development and become living documentation. I judge a BDD implementation by whether examples exist before development and whether non-engineers read the features, not by the number of scenarios.

### Q: How do you run an Example Mapping session?
**Short answer (30–60 s):** Twenty-five minutes, Three Amigos, four card colours: story (yellow), rules (blue), examples (green) under each rule, questions (red). Unknowns are parked as red cards, not debated. Then I read the map: many red cards — not ready; many rules — split the story.

**Detailed answer:** On ShopEasy checkout validation, concrete examples like "only spaces in the first name" and "' 560001 ' with spaces" surfaced rules nobody had written (trimming), and a red card exposed that the UI shows one error at a time while \`POST /api/orders\` returns all of them. Rules map to \`Rule:\`, green cards to examples, and red cards stay out of the feature until answered. The tester's role is asking for examples, especially boundaries and negative cases.

### Q: How do you organise feature files for a large suite?
**Short answer (30–60 s):** By business capability — auth, catalogue, cart, checkout, orders — one capability per feature, Rules inside, file names matching Feature titles, capability folders mirrored by a capability tag. Never by sprint, ticket or page.

**Detailed answer:** A capability layout is the table of contents of the living documentation and survives UI redesigns and reorganised sprints. Features are split at about 10–15 scenarios or when Rules serve different readers. A glossary keeps vocabulary consistent; a tag policy test keeps tags governed. API-only capabilities (ShopEasy order history exists only in the API) still get a capability folder.

### Q: Scenario Outline, DataTable, Doc String or separate scenarios — how do you choose?
**Short answer (30–60 s):** Outline when rows are the same behaviour with different data; DataTable when one example needs structured data; Doc String for free or nested text like a JSON body; separate scenarios when examples prove different rules. Big matrices do not belong in Gherkin at all.

**Detailed answer:** The red flag is an Outline whose Then needs an \`if\` — rows mixing "accepted" and "rejected" are two behaviours. I prefer concrete examples under Rules because they read better, and I push boundary matrices to API or unit tests, keeping one or two representative UI examples. Data that does not explain the rule is defaulted by the step definition.

### Q: What anti-patterns do you see in large Cucumber suites, and how do you fix them?
**Short answer (30–60 s):** UI scripts, scenario dependencies, giant Backgrounds, step explosion, conjunction steps, technical jargon and testing through the UI what belongs below it. Fixes: declarative glossary language, self-contained scenarios, Background as pure context, one step-library owner and a dry-run gate, and pushing matrices down the pyramid.

**Detailed answer:** Step explosion is the costliest: five ways to add to the cart means five places to maintain and readers unsure whether they differ. I audit with the \`usage\` plugin, agree the vocabulary with the PO, migrate in one reviewed PR and prevent recurrence with PR review against the glossary. Jargon is relative — for API consumers, status and error codes are the domain language.

### Q: How do you make feature files living documentation?
**Short answer (30–60 s):** Executed on every main-branch build, published at one stable access-controlled URL, organised by capability, traceable to tickets via tags, and changed in the same PR as the behaviour. Never published to the public Cucumber Reports service for company work.

**Detailed answer:** The Cucumber HTML report (built from messages) is the baseline; a test-management tool import adds traceability where POs already work. The documentation stays alive only if features sit with the code, the PO reviews behaviour changes, and the report is trusted — so flaky and quarantined scenarios are managed visibly.

### Q: When would you advise against Cucumber?
**Short answer (30–60 s):** When there is no business collaboration on the scenarios: dev-only or platform teams, API-heavy suites, or features written after the fact from test cases. Then plain TestNG/JUnit with good display names, or Playwright with \`test.step\`, gives the same readability without the glue layer.

**Detailed answer:** Cucumber's costs are real: a text-to-code mapping layer, weaker refactoring, step-library maintenance and expression debugging. They pay off only when the Gherkin is read and shaped by non-engineers. Many teams use Cucumber for business journeys and plain frameworks for API contracts and edge-case matrices in the same repository.

### Q: How do you measure whether BDD is working?
**Short answer (30–60 s):** Process outcomes: stories example-mapped before the sprint, questions found in refinement versus requirement defects found later, rework on stories, PO involvement in feature reviews, time to first green acceptance scenario, step-library health and escaped defects — not scenario counts.

**Detailed answer:** I review these quarterly with the PO. Rising scenario counts with flat PO involvement usually means BDD has degraded into test scripting. A shrinking number of reopened stories and more red cards in refinement are the signals that it works.

## Scenario-based questions

**1. You join a team with 800 scenarios that only QA reads; POs have never opened a feature file and the suite takes 3 hours.** I would not start by rewriting. First, measure: which capabilities have the most scenarios, step-definition usage, and where time goes (a slow-step plugin as in \`cucumber-deep-architecture-internals\`). Then pilot BDD on two upcoming stories with Example Mapping and PO-reviewed features — proving the conversation's value. In parallel, move matrices (validation boundaries, sorting permutations) to API/unit tests, keep representative UI scenarios, and replace UI login in Backgrounds with session seeding. Report progress as suite time, rework on piloted stories, and PO participation.

**2. The PO wants to write all feature files herself and hands over 30 scenarios full of "click", "field" and "verify the page".** Welcome the involvement and keep it: pair with her on the first few features, rewrite one together into declarative glossary language and explain the payoff (her features survive the redesign planned next quarter). Agree a light review flow — she owns the rules and examples, a tester or developer owns the formulation, both approve the PR. A glossary and the review checklist make the expectations explicit.

**3. Two weeks before release, 25 scenarios are tagged \`@quarantine\` without tickets, and the release manager asks whether the suite can be trusted.** Triage each quarantined scenario: real product bug (raise and link), test defect (fix or delete), environment issue (fix the environment or move to an \`@env\` tag). Add the governance rule (\`@quarantine\` needs a ticket, reviewed weekly) enforced by the tag policy test. Give the release manager an honest statement of which capabilities are covered by green, trusted scenarios and which are not — living documentation is only as valuable as its trustworthiness.

## Tricky follow-ups

- **Q: Is writing Gherkin after development "wrong"?** Not wrong, but it is test automation in Gherkin, not BDD — and then it is fair to ask whether Cucumber's extra layer is earning its cost.
- **Q: Should feature files include the password for \`standard_user\`?** No — scenarios name the persona; credentials are resolved by the step layer from fixtures or a secret store.
- **Q: A rule has one example. Is that enough?** Often not — ask for a counter-example ("what would *not* satisfy this rule?"); a rule with a single positive example is rarely understood.
- **Q: Should every acceptance criterion become a UI scenario?** No — every criterion needs an executable example, but it can run at API or unit level; the feature file can still describe it if that level's readers care.
- **Q: Is "I" or "the shopper" better in steps?** Third person with a named role: it is unambiguous in reports and supports multiple actors; consistency (via the glossary) matters more than the choice.`,
  keyPoints: [
    'BDD = Discovery (Three Amigos, Example Mapping) → Formulation (Gherkin the PO can review) → Automation; Cucumber only supports the last step.',
    'Example Mapping: story, rules, examples, questions in a 25-minute timebox; many red cards = not ready, many rules = split the story. Red cards stay out of the feature until answered.',
    'Organise features by business capability (auth, catalogue, cart, checkout, orders), one capability per feature, Rules inside, behaviour-named scenarios, vocabulary from a shared glossary.',
    'Outline for the same behaviour with different data, DataTable for structured data, Doc String for free/nested text, separate scenarios for different rules; matrices belong in API or unit tests.',
    'Keep only rule-explaining data in Gherkin (concrete values, personas); passwords, ids, URLs and incidental data live in code or fixtures.',
    'Tags are a governed API: suite, capability, layer, risk, ticket, status, environment — enforced by an automated policy check; @quarantine needs a ticket.',
    'Living documentation = executed on main, published at one access-controlled URL, traceable via ticket tags, changed in the same PR as the behaviour; never the public reports service for company data.',
    'Cucumber is worth it only where non-engineers read and shape the scenarios; otherwise use TestNG/JUnit with good names or Playwright test.step. Measure process outcomes, not scenario counts.',
  ],
  mistakes: [
    'Writing feature files after development from test-case spreadsheets and calling it BDD. Fix: Example Mapping before the sprint, features drafted before development and reviewed by the PO; if that cannot happen, reconsider Cucumber for that area.',
    'Organising features by sprint or page ("sprint14_regression.feature", "checkout_page.feature"). Fix: capability folders and one capability per feature; move scenarios and add capability tags matching the folder.',
    'Huge Scenario Outlines of validation boundaries through the browser. Fix: keep one accepted and one rejected UI example; move the matrix to API (POST /api/orders → 400 VALIDATION_FAILED) or unit tests.',
    'Letting step vocabulary drift until there are five ways to add to the cart. Fix: a glossary owned by the PO, a step-library owner, usage-plugin audits and a dry-run gate on feature-file PRs.',
    'Free-for-all tags (@Smoke, @smoke-test, @todo, @ignore) and quarantines without exit. Fix: a closed tag taxonomy enforced by a build-time policy test, ticket required for @quarantine, weekly quarantine review.',
    'Publishing company results with cucumber.publish.enabled to the public reports service. Fix: disable and silence publishing; publish the HTML report from main to an internal, access-controlled location.',
  ],
  tryIt: `Using ShopEasy (http://localhost:5180/practice-site/): (1) open \`checkout.html\` with a product in the cart and run your own 15-minute Example Mapping on paper for the delivery details — find at least one rule and one red-card question that are not in this lesson (hint: try a 10-character postal code with a hyphen, or "---"); (2) formulate the map as a feature with Rules, deciding for each example whether it is a UI scenario or belongs to an API test against \`POST http://localhost:5181/api/orders\`; (3) draft a glossary of 8–10 terms for the cart and checkout and rewrite three existing steps from your project to match it; (4) add the tag policy test to a project and fix the violations it finds; (5) write down, for one area of your current suite, whether Cucumber is earning its cost — who reads those feature files?`,
  problems: ['cuc-016', 'cuc-027', 'cuc-028', 'cuc-035', 'cuc-041'],
}
