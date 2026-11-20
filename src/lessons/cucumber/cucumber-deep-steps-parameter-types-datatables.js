export default {
  slug: 'cucumber-deep-steps-parameter-types-datatables',
  category: 'cucumber',
  order: 13,
  title: 'Deep dive: step definitions at scale — parameter types, DataTable and DocString transformers, step libraries',
  minutes: 30,
  summary: 'Design glue that stays small as the feature count grows: step libraries organised by domain, thin steps over tasks and page objects, phrasing for reuse without ambiguity, Cucumber Expressions and custom @ParameterType in depth, regex vs expressions, DataTables with entry/row/cell and default Jackson transformers, [blank], @Transpose and DataTable.diff, @DocStringType, why steps must not call steps, strictness and snippets — with a full ShopEasy cart and checkout example.',
  manualAnalogy: `A good manual test suite has a shared vocabulary: "add to cart", "check out as Asha Rao", "the total is $43.18" mean the same thing in every test case, and nobody writes "click the third button from the left". Step definitions are that vocabulary turned into code. If every tester invents their own phrasing you get five ways to say the same thing and a glossary nobody can maintain; if the vocabulary is precise and typed, new test cases are mostly written from words that already exist.`,
  body: `## Where the earlier lessons stop

The beginner lessons covered the mechanics: \`step-definitions-and-cucumber-expressions\` (built-in types, a first \`@ParameterType\`, thin steps, the undefined/ambiguous/pending errors), \`cucumber-datatables\` (\`List<Map>\`, \`@DataTableType\`, vertical tables), \`gherkin-rules-docstrings-living-docs\` (Doc Strings) and \`picocontainer-shared-state\` (constructor injection).

This lesson is about **designing glue for a large suite**: how to organise and phrase steps so that 300 scenarios share 120 well-typed steps instead of 900 near-duplicates, and how to move every string-to-object conversion out of step bodies into registered transformers. Two neighbouring deep dives own related ground — refer to them rather than expecting it here:

- \`cucumber-deep-architecture-internals\` — the parser, pickles, glue discovery and the step matching engine in detail.
- \`cucumber-deep-bdd-practice-at-scale\` — how to *write* features at scale (business language, tag taxonomy, living docs).
- \`cucumber-deep-dependency-injection-hooks\` (next lesson) — scenario state objects and how step classes receive them.

\`\`\`
feature files          business language: "the shopper checks out as Asha Rao"
   │
step definitions       glue: match text, convert parameters, delegate      ◄── this lesson
   │  (parameter types, DataTable/DocString transformers live here too)
tasks / services       CartTasks, CheckoutTasks, ShopEasyApi: reusable behaviour
   │
page objects / API     CartPage, CheckoutPage, REST Assured specifications
\`\`\`

## Step libraries: organising glue by domain

### Why it matters

Cucumber has **one flat namespace of steps per run**: every step definition in every glue package can match every step in every feature. The Java class a step lives in is only an organisational choice — it gives no scoping. So "where does this step live" and "what does this step say" are design decisions with project-wide consequences: two teams writing \`the user logs in\` in different classes produce an \`AmbiguousStepDefinitionsException\` the first time both packages are on the glue path.

### Organising by page vs by domain vs by actor

\`\`\`
com.shopeasy.bdd
├── steps
│   ├── AuthSteps.java          login, logout, locked account
│   ├── CatalogueSteps.java     browse, sort, product details
│   ├── CartSteps.java          add, remove, cart contents, badge
│   ├── CheckoutSteps.java      customer information, overview, totals, confirmation
│   └── api/OrderApiSteps.java  API-only order and user scenarios
├── types
│   ├── ParameterTypes.java     {product} {sortOption} {money} {user}
│   ├── TableTypes.java         @DataTableType + default Jackson transformer
│   └── DocStringTypes.java     @DocStringType for JSON bodies
├── tasks                       CartTasks, CheckoutTasks — reusable behaviour, no Cucumber imports
├── pages                       LoginPage, InventoryPage, CartPage, CheckoutPage
├── api                         ShopEasyApi (REST Assured)
├── model                       Product, SortOption, Money, CartLine, CustomerInfo …
├── context                     scenario state (next lesson)
└── hooks                       Hooks
\`\`\`

| | By page (\`LoginPageSteps\`, \`CartPageSteps\`) | **By domain** (\`AuthSteps\`, \`CartSteps\`) | By actor (\`ShopperSteps\`, \`AdminSteps\`) |
|---|---|---|---|
| How it works | one step class mirrors one page object | one class per business capability | one class per role |
| Advantages | easy to find for UI-only suites | steps survive UI redesigns; the same step can run via UI or API; matches feature folders | reads like the scenario's subject |
| Disadvantages | phrasing drifts towards UI ("on the cart page I click…"); a flow across pages has no home | needs agreement on domain boundaries | classes become huge; same capability split across actors |
| Maintainability | low once flows span pages | high | medium |
| Scalability | poor (classes multiply with pages) | good (grows with capabilities, which grow slowly) | poor |
| When to use | small UI-only suites | **default** | rarely; perhaps a separate admin back office |

**Recommended approach and why:** organise steps **by domain capability**, mirroring the feature folders (\`features/cart\`, \`features/checkout\`). Business capabilities change far less often than pages, and a domain step can switch its implementation (UI today, API tomorrow) without any feature file changing.

### Thin steps that delegate

A step definition has exactly three responsibilities: match the text, receive already-converted parameters, and delegate. Anything else — waits, loops over products, arithmetic, HTTP calls — belongs below it, in a task/service or page object that has no Cucumber import and can be reused by JUnit/TestNG tests too.

\`\`\`java
package com.shopeasy.bdd.steps;

import com.shopeasy.bdd.model.Money;
import com.shopeasy.bdd.model.Product;
import com.shopeasy.bdd.tasks.CartTasks;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class CartSteps {

    private final CartTasks cart;                       // injected (next lesson)

    public CartSteps(CartTasks cart) {
        this.cart = cart;
    }

    @Given("the shopper has {product} in the cart")
    public void hasInCart(Product product) {
        cart.add(product);
    }

    @When("the shopper adds {product} to the cart")
    public void adds(Product product) {
        cart.add(product);
    }

    @When("the shopper adds these products to the cart:")
    public void addsAll(List<Product> products) {
        products.forEach(cart::add);
    }

    @Then("the cart subtotal is {money}")
    public void subtotalIs(Money expected) {
        assertThat(cart.subtotal()).as("cart subtotal").isEqualTo(expected);
    }
}
\`\`\`

- Each method is one line of delegation (or one assertion). There is nothing to unit-test in a step, which is the point.
- \`Product\` and \`Money\` arrive already typed: the conversion lives in registered parameter types, written once.
- \`hasInCart\` (Given) and \`adds\` (When) call the same task. Keeping both phrasings is deliberate — Given describes context, When describes the action under test — but the *implementation* is shared. A senior variation: the Given version seeds state through a faster path (API, storage) while the When version drives the UI.

### Phrasing for reuse without ambiguity

| Smell | Example | Better |
|---|---|---|
| UI mechanics in the step | \`I click "Add to cart" on "Trailblazer Backpack"\` | \`the shopper adds "Trailblazer Backpack" to the cart\` |
| Generic action step | \`I click {string}\` / \`I enter {string} in {string}\` | domain steps; the page object knows which button |
| Data hard-coded in the step text | \`the shopper adds the backpack\` + \`the shopper adds the bike light\` | one step with \`{product}\` |
| Near-duplicates | \`the cart shows {int} items\`, \`the cart has {int} item\`, \`cart contains {int} products\` | one canonical wording with \`item(s)\` and \`shows/has\` alternatives |
| Over-greedy wording | \`the shopper {}\` | specific verbs |
| Same words, different meaning | \`the order is placed\` (UI) vs \`the order is placed\` (API) | name the channel only where it matters: \`the order is placed through the API\` |

Why the generic \`I click {string}\` step is a trap even though it "maximises reuse": it pushes locators or button labels into the feature file, so features become UI scripts that break on every redesign; the step body has to resolve a string to an element generically (a giant switch or a locator map); and the scenarios stop documenting behaviour. Reuse is measured in **business steps reused across scenarios**, not in how few step methods exist.

**Step explosion** — the opposite failure — shows up as hundreds of steps each used once. Two cheap metrics catch both problems: the number of step definitions used by exactly one scenario (run with the \`usage\` plugin, \`plugin = "usage:target/usage.json"\`, which reports each step definition, how often it matched and how long it took), and the number of steps whose text contains UI words (\`click\`, \`button\`, \`field\`, \`page\`) — the second is a simple grep in a pre-merge check.

## Cucumber Expressions in depth

### How they work internally

A Cucumber expression is compiled into a regular expression once, when the glue is loaded. Each \`{name}\` is looked up in the **parameter type registry**; the registry entry supplies one or more regexes and a transformer. Optional text \`(s)\` becomes an optional non-capturing group, alternatives \`a/b\` become an alternation, and every other character is quoted literally — which is why \`$\`, \`.\` or \`?\` in an expression need no escaping. When a step matches, each capture group's text is passed to the parameter type's transformer, and the result is passed to the method. Matching itself (how all definitions are tried and ambiguity detected) is covered in \`cucumber-deep-architecture-internals\`.

### Built-in parameter types

| Expression | Matches | Java type(s) | Notes |
|---|---|---|---|
| \`{int}\` | \`42\`, \`-7\` | int / Integer | also \`{byte}\`, \`{short}\`, \`{long}\`, \`{biginteger}\` |
| \`{float}\`, \`{double}\` | \`29.99\`, \`-1.5\` | float / double | binary floating point — not for money |
| \`{bigdecimal}\` | \`29.99\` | BigDecimal | exact; the right default for money |
| \`{word}\` | one token without whitespace | String | \`az\`, \`standard_user\` |
| \`{string}\` | \`"…"\` or \`'…'\` | String | quotes removed; empty \`""\` gives an empty string |
| \`{}\` | anything (anonymous) | the method parameter's type | converted by the default/built-in transformer |

In Cucumber-JVM, number parsing follows the locale of the feature file's language (a \`# language: de\` feature expects the German decimal separator), which surprises teams that mix languages. The anonymous \`{}\` is converted using the **method parameter type**: \`String\`, numbers and enum constants (by exact constant name) work out of the box; anything else needs a \`@DefaultParameterTransformer\` (see the Jackson section below). Because \`{}\` matches anything, it is greedy — use it only as the last parameter or between unambiguous literal words.

### Optional text, alternatives and escaping

\`\`\`java
@Then("the cart badge shows/displays {int} item(s)")        // alternatives + optional text
@When("the shopper (re)opens the cart")                      // optional prefix inside a word
@Then("the error says {string}")
@Then("the price is \\\\(incl. tax\\\\) {money}")                 // literal parentheses: escape with a backslash
@Then("the ratio is 1\\\\/2")                                  // literal slash
\`\`\`

Rules that bite in code review:

- Only \`(\`, \`)\`, \`{\`, \`}\`, \`/\` and the backslash are special. In Java source the escaping backslash itself needs escaping, so the annotation text is \`"the price is \\\\(incl. tax\\\\) {money}"\` — two backslashes in the source for one in the expression.
- Alternatives are delimited by **whitespace**: \`shows/displays\` is one alternation, \`shows the/displays the\` is not what you think (it means \`shows\` + \`the/displays\` + \`the\`).
- Optional text and alternatives **cannot contain parameters**: \`(with {int} items)\` is a compile error of the expression, raised when the glue loads.
- An expression starting with \`^\` or ending with \`$\` is treated as a **regular expression**, not a Cucumber expression — so \`"the total is $43.18"\` is fine, but a pattern ending in \`$\` silently changes type.

## Custom parameter types

### What and why

A custom parameter type registers a name, a regex and a transformer method. It moves domain conversion out of steps (no \`Product.fromName(name)\` in fifty methods), makes the feature vocabulary closed (an unknown product fails at matching/conversion time with one clear message), and lets steps take enums and records instead of strings.

### The annotation (Cucumber-JVM 7, \`io.cucumber.java.ParameterType\`)

| Attribute | Default | Meaning |
|---|---|---|
| \`value\` | required | the regex; each capture group becomes one method argument (no groups → the whole match) |
| \`name\` | method name | the name used inside \`{...}\` |
| \`useForSnippets\` | \`false\` | offer this type when Cucumber **generates snippets** for undefined steps; keep \`false\` for greedy regexes |
| \`preferForRegexMatch\` | \`false\` | when several parameter types share the same regex and a **regex** step definition captures it, use this one (more than one preferred type with the same regex is an error) |
| \`useRegexpMatchAsStrongTypeHint\` | \`false\` | lets the regex match decide the type even when the method parameter type disagrees; when \`false\`, the transformer is used only if both agree, otherwise the default transformer converts |

### Practical example: {product}, {sortOption}, {money}, {user}

\`\`\`java
package com.shopeasy.bdd.model;

import java.util.Arrays;

public enum Product {
    TRAILBLAZER_BACKPACK("Trailblazer Backpack", "trailblazer-backpack", "29.99"),
    PULSE_BIKE_LIGHT("Pulse Bike Light", "pulse-bike-light", "9.99"),
    CLASSIC_CREW_T_SHIRT("Classic Crew T-Shirt", "classic-crew-t-shirt", "15.99"),
    STORM_FLEECE_JACKET("Storm Fleece Jacket", "storm-fleece-jacket", "49.99"),
    JUNIOR_ONESIE("Junior Onesie", "junior-onesie", "7.99"),
    RETRO_RED_TEE("Retro Red Tee", "retro-red-tee", "15.99");

    private final String displayName;
    private final String slug;
    private final Money price;

    Product(String displayName, String slug, String price) {
        this.displayName = displayName;
        this.slug = slug;
        this.price = Money.of(price);
    }

    public String displayName() { return displayName; }
    public String slug()        { return slug; }      // add-to-cart-<slug>, remove-<slug> in ShopEasy
    public Money price()        { return price; }

    public static Product fromDisplayName(String name) {
        return Arrays.stream(values())
                .filter(p -> p.displayName.equals(name))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown product \\"" + name + "\\". Known: " + Arrays.stream(values()).map(Product::displayName).toList()));
    }
}
\`\`\`

\`\`\`java
package com.shopeasy.bdd.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record Money(BigDecimal amount) implements Comparable<Money> {
    public static final Money ZERO = of("0.00");

    public Money {
        amount = amount.setScale(2, RoundingMode.HALF_UP);   // canonical scale: 29.9 == 29.90
    }
    public static Money of(String plain)      { return new Money(new BigDecimal(plain)); }
    public static Money parse(String display) { return of(display.replace("$", "").replace(",", "").trim()); }

    public Money plus(Money other)            { return new Money(amount.add(other.amount)); }
    public Money percent(int pct)             { return new Money(amount.multiply(BigDecimal.valueOf(pct)).movePointLeft(2)); }
    @Override public int compareTo(Money o)   { return amount.compareTo(o.amount); }
    @Override public String toString()        { return "$" + amount.toPlainString(); }
}
\`\`\`

\`\`\`java
package com.shopeasy.bdd.types;

import com.shopeasy.bdd.model.Money;
import com.shopeasy.bdd.model.Product;
import com.shopeasy.bdd.model.SortOption;
import com.shopeasy.bdd.model.TestUser;
import io.cucumber.java.ParameterType;

public class ParameterTypes {

    // "Trailblazer Backpack" → Product.TRAILBLAZER_BACKPACK ; quotes keep multi-word names unambiguous
    @ParameterType("\\"([^\\"]+)\\"")
    public Product product(String name) {
        return Product.fromDisplayName(name);
    }

    // Name (A to Z) | Name (Z to A) | Price (low to high) | Price (high to low)  — the labels the shopper sees
    @ParameterType(value = "Name \\\\(A to Z\\\\)|Name \\\\(Z to A\\\\)|Price \\\\(low to high\\\\)|Price \\\\(high to low\\\\)",
                   name = "sortOption")
    public SortOption sortOption(String label) {
        return SortOption.fromLabel(label);
    }

    // $29.99 or $1,049.00 → Money ; the capture group excludes the dollar sign
    @ParameterType("\\\\$([0-9][0-9,]*\\\\.[0-9]{2})")
    public Money money(String amount) {
        return Money.of(amount.replace(",", ""));
    }

    // standard_user | locked_out_user → TestUser ; closed list = typo fails at match time
    @ParameterType(value = "standard_user|locked_out_user", useForSnippets = true)
    public TestUser user(String username) {
        return TestUser.fromUsername(username);
    }
}
\`\`\`

\`\`\`java
public enum SortOption {
    NAME_ASC("az", "Name (A to Z)"), NAME_DESC("za", "Name (Z to A)"),
    PRICE_ASC("lohi", "Price (low to high)"), PRICE_DESC("hilo", "Price (high to low)");

    private final String optionValue;   // <option value="..."> of #product-sort
    private final String label;
    SortOption(String optionValue, String label) { this.optionValue = optionValue; this.label = label; }
    public String optionValue() { return optionValue; }
    public static SortOption fromLabel(String label) {
        for (SortOption s : values()) if (s.label.equals(label)) return s;
        throw new IllegalArgumentException("Unknown sort option: " + label);
    }
}
\`\`\`

Step by step:

1. Cucumber finds \`ParameterTypes\` because it is in a glue package; each \`@ParameterType\` method is registered **before any step is matched**, and the class is instantiated per scenario like any glue class (so transformers may use injected objects — keep them stateless anyway).
2. \`{product}\` uses a regex *with* a capture group: the quotes are matched but not passed. Using quotes for a multi-word value is deliberate: \`"Classic Crew T-Shirt"\` cannot bleed into the surrounding words, which an unquoted \`([A-Za-z -]+)\` would.
3. \`{sortOption}\` lists the exact labels of ShopEasy's \`#product-sort\` options. A closed alternation means a typo (\`Price (low-high)\`) does not match the step at all, and the "undefined step" message points at the exact line.
4. \`{money}\` captures only the number; \`Money\` normalises scale, so \`$43.18\` and \`43.180\` compare equal via \`compareTo\`, while \`BigDecimal.equals\` would not (scale is part of equality — the classic money bug).
5. \`{user}\` is a closed list too; \`useForSnippets = true\` means snippets for new steps containing \`standard_user\` will suggest \`{user}\` instead of \`{word}\`.
6. Exceptions thrown in a transformer fail the step with the transformer's message wrapped by Cucumber — so write messages that list the allowed values.

### Multiple approaches for domain values

\`\`\`java
// A — string parameter, convert in the step
@When("the shopper adds {string} to the cart")
public void adds(String name) { cart.add(Product.fromDisplayName(name)); }

// B — anonymous {} with an enum parameter (constant name in the feature)
@When("the shopper adds {} to the cart")          // Given the shopper adds TRAILBLAZER_BACKPACK to the cart
public void adds(Product product) { cart.add(product); }

// C — custom parameter type (above)
@When("the shopper adds {product} to the cart")
public void adds(Product product) { cart.add(product); }
\`\`\`

| | A: \`{string}\` + manual conversion | B: \`{}\` + enum | C: \`@ParameterType\` |
|---|---|---|---|
| How it works | step converts | built-in transformer: \`Enum.valueOf\` | registered regex + transformer |
| Advantages | zero setup | zero setup, typed | typed, readable values, one place for conversion and error messages |
| Disadvantages | conversion duplicated in every step | feature shows \`TRAILBLAZER_BACKPACK\` — not business language; \`{}\` is greedy | one more class; regex must be designed carefully |
| Performance | same | same | same (regex compiled once) |
| Maintainability | low | medium | high |
| When to use | prototypes | internal/technical features | **domain values used in several steps** |

**Recommended approach and why:** **C** for every domain concept that appears in more than one step (products, users, sort options, money, dates). It is the single point where feature vocabulary meets the domain model, and it fails fast with a precise message.

### Mistakes with parameter types

- **Two parameter types with the same regex** (\`{product}\` and \`{category}\` both \`"([^"]+)"\`): Cucumber cannot know which one to use for a regex step definition or for snippets and reports that several parameter types share the regex. Fix: make regexes distinct (closed lists), or set \`preferForRegexMatch\` on exactly one.
- **Greedy regexes** (\`.*\`): \`{anything} items\` swallows the rest of the sentence or causes ambiguity with other steps. Fix: closed alternations or quoted values; never \`useForSnippets\` on a greedy type.
- **Transformer with side effects** (a \`{user}\` that creates the user via the API): conversion may run during matching, in reports and in dry runs. Fix: transformers convert only; the step performs actions.
- **\`{double}\` for money**: \`39.98 + 3.20\` in binary floating point is not \`43.18\` exactly. Fix: \`{bigdecimal}\` or \`{money}\`.

## Regex step definitions vs Cucumber Expressions

Regex is still legal and occasionally necessary. Cucumber decides by anchors: \`^…$\` (or a \`Pattern\`) is a regex.

\`\`\`java
// Expression
@Then("the cart badge shows {int} item(s)")
public void badge(int n) { … }

// Equivalent regex — note the escaped quotes and the explicit (?:s)?
@Then("^the cart badge shows (\\\\d+) items?$")
public void badgeRegex(int n) { … }

// A case where regex genuinely helps: capture which alternative was used
@Then("^the (first|last) product is \\"([^\\"]+)\\"$")
public void productAt(String position, String name) { … }
\`\`\`

| | Cucumber Expressions | Regular expressions |
|---|---|---|
| How it works | compiled to regex; types from the registry | regex groups converted by the method parameter type (or a preferred parameter type) |
| Advantages | readable, typed, optional/alternative text without regex noise, better snippets | full regex power: captured alternatives, lookarounds, character classes, legacy compatibility |
| Disadvantages | alternatives cannot be captured; no lookarounds | escaping noise, easy to over-match, \`(.*)\` everywhere, untyped |
| Performance | equivalent | equivalent |
| Maintainability | high | low–medium |
| When to use | **default for all new steps** | migrating Cucumber 1–4 suites; a captured alternative you cannot model as a parameter type |

**Recommended approach and why:** expressions everywhere; when you "need" a captured alternative (\`first|last\`), prefer a small parameter type (\`{position}\` → \`Position.FIRST\`) — the regex step then disappears and the value is typed. Keep regex for legacy steps until they are touched, and do not mix both styles for the same step family.

## DataTables in depth

### How conversion works

A \`DataTable\` is a rectangular \`List<List<String>>\` of cells (empty cells are \`null\`). When a step method's **last** parameter is a table, Cucumber looks at its declared Java type and asks the **DataTable type registry** for a converter: \`List<Map<String,String>>\`, \`List<List<String>>\`, \`Map<K,V>\`, \`List<T>\` and plain \`T\` (one object from a vertical table) are all resolved from the generic type. For a \`List<T>\` it looks for, in order of what you registered, a table entry transformer (header row → one object per data row), a table row transformer (one object per row, no header) or a cell transformer (one object per cell); if none exists it falls back to the default transformers. Getting the parameter type right is therefore part of the step's contract.

### API reference (\`io.cucumber.datatable.DataTable\`)

| Method / annotation | Gives you | Use for |
|---|---|---|
| \`asLists()\` / \`asLists(Class)\` | rows as lists (header included) | positional data without a header |
| \`asMaps()\` / \`asMaps(K, V)\` | one map per data row, header = keys | quick, untyped reading |
| \`asMap()\` / \`asMap(K, V)\` | two-column table → one map | key/value settings |
| \`asList()\` / \`asList(Class)\` | single column (or converted objects) | a list of products |
| \`transpose()\` | rows ↔ columns | vertical tables |
| \`row(i)\`, \`column(j)\`, \`cell(i, j)\`, \`rows(from)\`, \`subTable(...)\`, \`height()\`, \`width()\`, \`isEmpty()\` | slicing | custom parsing |
| \`DataTable.create(List<List<String>>)\` | build a table from actual data | comparing against the UI |
| \`diff(actual)\` / \`unorderedDiff(actual)\` | throws \`TableDiffException\` with a +/- diff if different | asserting a whole table |
| \`@DataTableType\` | entry (\`Map<String,String>\`), row (\`List<String>\`), cell (\`String\`) or table (\`DataTable\`) transformer | typed rows |
| \`@DefaultDataTableEntryTransformer\`, \`@DefaultDataTableCellTransformer\` | fallback transformers for any type | generic POJO/record conversion (Jackson) |
| \`replaceWithEmptyString = "[blank]"\` | turns a placeholder into \`""\` | distinguishing empty from absent |
| \`@Transpose\` on the parameter | read a vertical table without calling \`transpose()\` | one record written top-down |

\`DataTable.diff\` and \`unorderedDiff\` still exist in Cucumber-JVM 7's \`datatable\` module (they were not removed with the old \`cucumber.api\` classes). Many teams nevertheless prefer AssertJ (\`containsExactlyElementsOf\` on records) because the failure message names fields; use \`diff\` when you want the Gherkin-style table diff in the report.

### Entry, row and cell transformers

\`\`\`java
package com.shopeasy.bdd.types;

import com.shopeasy.bdd.model.CartLine;
import com.shopeasy.bdd.model.Money;
import com.shopeasy.bdd.model.Product;
import io.cucumber.java.DataTableType;

import java.util.List;
import java.util.Map;

public class TableTypes {

    // entry transformer: header | product | price | → one CartLine per data row
    @DataTableType
    public CartLine cartLine(Map<String, String> row) {
        return new CartLine(Product.fromDisplayName(row.get("product")), Money.parse(row.get("price")));
    }

    // cell transformer: every cell of a List<Product> / List<List<Product>> table
    @DataTableType
    public Product productCell(String cell) {
        return Product.fromDisplayName(cell);
    }

    // row transformer (no header): | Storm Fleece Jacket | $49.99 |
    @DataTableType
    public PricedRow pricedRow(List<String> row) {
        return new PricedRow(Product.fromDisplayName(row.get(0)), Money.parse(row.get(1)));
    }

    public record PricedRow(Product product, Money price) { }
}
\`\`\`

- The **parameter type of the method** decides the kind of transformer: \`Map<String,String>\` = entry, \`List<String>\` = row, \`String\` = cell, \`DataTable\` = whole table.
- Do not register both an entry and a row transformer for the same target type unless you understand which table shape each step receives — the header row of an entry table would otherwise be fed to the row transformer.
- \`productCell\` also makes \`List<Product>\` work for the single-column table in \`the shopper adds these products to the cart:\`.

### Default transformers with Jackson: generic POJO and record conversion

For many small value objects, writing one \`@DataTableType\` per class is boilerplate. A **default** transformer handles every type that has no specific transformer:

\`\`\`java
package com.shopeasy.bdd.types;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.DefaultDataTableCellTransformer;
import io.cucumber.java.DefaultDataTableEntryTransformer;
import io.cucumber.java.DefaultParameterTransformer;

import java.lang.reflect.Type;

public class JacksonTransformers {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules()                                   // records, java.time
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);   // typo in a header = failure

    @DefaultParameterTransformer
    @DefaultDataTableEntryTransformer(replaceWithEmptyString = "[blank]")
    @DefaultDataTableCellTransformer(replaceWithEmptyString = "[blank]")
    public Object defaultTransformer(Object fromValue, Type toValueType) {
        return MAPPER.convertValue(fromValue, MAPPER.constructType(toValueType));
    }
}
\`\`\`

\`\`\`java
public record CustomerInfo(String firstName, String lastName, String postalCode) { }

@When("the shopper continues checkout with")
public void continueWith(@Transpose CustomerInfo customer) {   // vertical table, Jackson builds the record
    checkout.enterCustomerInformation(customer);
}
\`\`\`

\`\`\`gherkin
When the shopper continues checkout with
  | firstName  | Asha    |
  | lastName   | Rao     |
  | postalCode | [blank] |
\`\`\`

- \`@DefaultDataTableEntryTransformer\` has \`headersToProperties = true\` by default: a header such as \`First Name\` is converted to the property name \`firstName\`, so business-friendly headers still map onto records.
- \`FAIL_ON_UNKNOWN_PROPERTIES = true\` turns a misspelt header (\`postcode\`) into an immediate failure instead of a silently \`null\` field. Jackson 2.12+ deserialises records natively; \`findAndRegisterModules()\` adds modules found on the classpath (e.g. \`java.time\` support).
- One shared static \`ObjectMapper\` is fine: it is thread-safe once configured.

### Empty cells and [blank]

An empty cell arrives as \`null\` — not \`""\`. For a validation scenario this distinction matters: "postal code not filled in" (\`null\` → do not type) vs "postal code typed as empty" (\`""\` → clear the field). \`replaceWithEmptyString = "[blank]"\` (on \`@DataTableType\` or the default transformers) turns the literal \`[blank]\` into \`""\`. If the step takes plain \`List<Map<String,String>>\`, the replacement only applies when you override the String cell transformer with the same option — a classic "why is [blank] still in my map" bug.

### Comparing tables: the UI against the expectation

\`\`\`java
@Then("the checkout overview lists")
public void overviewLists(DataTable expected) {
    List<List<String>> actualRows = new ArrayList<>();
    actualRows.add(List.of("product", "price"));                       // same header as the feature
    checkoutPage.overviewLines().forEach(line ->                        // reads #overview-list .cart-item
            actualRows.add(List.of(line.name(), line.price())));
    expected.unorderedDiff(DataTable.create(actualRows));               // TableDiffException on mismatch
}
\`\`\`

On a mismatch the exception message prints the table with \`-\` (expected but missing) and \`+\` (unexpected) rows — readable in the HTML report next to the step. Use \`diff\` when order matters (sorted product lists), \`unorderedDiff\` when it does not (cart contents).

### Which table technique when

| | \`asMaps()\` in the step | \`@DataTableType\` per type | Default Jackson transformer | Scenario Outline |
|---|---|---|---|---|
| How it works | strings by header key | explicit transformer method | generic conversion by target type | whole scenario per Examples row |
| Advantages | no setup | full control, domain parsing (\`$29.99\` → Money), clear errors | zero code per new record, header→property mapping | separate result per data set |
| Disadvantages | stringly-typed, typos → \`null\`, parsing in steps | one method per type | hidden magic; custom formats (\`$29.99\`) need Jackson config or a specific transformer | duplicates the whole flow per row |
| Performance | best | same | slightly slower (reflection), irrelevant vs UI | N × scenario time |
| Maintainability | low | high | high for plain records | high for true data variations |
| Scalability | poor | good | best | good |
| When to use | one-off small tables | domain types with special formats | many plain DTO-like records | **same behaviour, different data, separate pass/fail each** |

**Recommended approach and why:** a default Jackson transformer for plain records, plus specific \`@DataTableType\` methods for types with domain formats (\`Money\`, \`Product\`). Use a DataTable when the data is **one input** to one step (the order, the customer); use a Scenario Outline when each row is a **separate test** whose result you want reported separately (each validation message).

## Doc Strings with @DocStringType

A Doc String is passed as the last parameter: a \`String\`, an \`io.cucumber.docstring.DocString\` (with \`getContent()\` and \`getContentType()\`), or any type for which a Doc String transformer exists. \`@DocStringType\` registers such a transformer; its \`contentType\` defaults to the **method name**, and the content type written after the opening \`"""\` selects which transformer runs when several produce the same Java type.

\`\`\`java
package com.shopeasy.bdd.types;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopeasy.bdd.model.RegistrationRequest;
import io.cucumber.java.DocStringType;

public class DocStringTypes {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    @DocStringType                                  // content type "json" (the method name)
    public RegistrationRequest json(String docString) throws JsonProcessingException {
        return MAPPER.readValue(docString, RegistrationRequest.class);
    }
}

public record RegistrationRequest(String username, String password, String firstName,
                                  String lastName, String email) { }
\`\`\`

\`\`\`gherkin
@api
Scenario: A new customer registers through the API
  When a customer registers with
    """json
    {
      "username": "asha_r_01",
      "password": "Sup3rSecret!",
      "firstName": "Asha",
      "lastName": "Rao",
      "email": "asha.rao+01@shopeasy.test"
    }
    """
  Then the registration is accepted
\`\`\`

\`\`\`java
@When("a customer registers with")
public void registers(RegistrationRequest request) {    // typed — no JSON parsing in the step
    api.registerCustomer(request);
}
\`\`\`

The body matches ShopEasy's \`POST /api/users\` contract (username 3–40 characters of \`a-z 0-9 _ . -\`, password at least 8 characters, firstName/lastName/email required; 409 \`USERNAME_TAKEN\`, 422 \`INVALID_EMAIL\`, 400 \`VALIDATION_FAILED\`). Senior caveats: a hard-coded username collides on the second run and in parallel runs — real suites template a unique suffix (next lesson); and a JSON Doc String should be the exception for API contract scenarios, not a way to smuggle request bodies into business features (\`cucumber-deep-bdd-practice-at-scale\`). If two content types (\`json\`, \`xml\`) map to the same type, both methods must declare distinct content types, and a Doc String without a content type is ambiguous between them.

## Reusing step code: helpers, not steps calling steps

Gherkin-era habits ("call the login step from the checkout step") survive in many Java suites:

\`\`\`java
// Anti-pattern
public class CheckoutSteps {
    @Given("the shopper is ready to check out")
    public void readyToCheckOut() {
        new AuthSteps().logsInAs(TestUser.STANDARD);          // bypasses DI: different/null driver and state
        new CartSteps(null).adds(Product.TRAILBLAZER_BACKPACK); // couples step classes to each other
    }
}
\`\`\`

Why it is wrong:

1. **Lifecycle**: step classes are created by the ObjectFactory once per scenario with their dependencies; \`new\` creates an unmanaged copy without the scenario's state (or with \`null\`s).
2. **Coupling**: step signatures are tied to Gherkin wording; renaming a phrase breaks Java callers. Steps become an internal API they were never designed to be.
3. **Reporting**: the nested "steps" are invisible in the report — a failure inside them is attributed to the outer step with a confusing stack.
4. Cucumber-JVM deliberately has no "call step by text" API (Ruby Cucumber's \`step\`), for these reasons.

\`\`\`java
// Fix: a task composed of other tasks, injected wherever needed
public class CheckoutTasks {
    private final AuthTasks auth;
    private final CartTasks cart;

    public CheckoutTasks(AuthTasks auth, CartTasks cart) { this.auth = auth; this.cart = cart; }

    public void prepareCheckout(TestUser user, List<Product> products) {
        auth.logInAs(user);
        products.forEach(cart::add);
        cart.openCart();
    }
}
\`\`\`

The task layer can be Screenplay-style tasks (\`pom-deep-screenplay-pattern\`) or plain services; either way it has no Cucumber annotations and is reused by steps, hooks and non-Cucumber tests.

## Undefined, pending and strict; generating snippets

- **Strict by default.** Since Cucumber-JVM 6 undefined and pending steps fail the run; Cucumber 7.0.0 removed the \`--strict\`/\`--non-strict\` options and the \`cucumber.execution.strict\` property altogether. A green build therefore cannot hide unimplemented steps.
- **Pending**: \`throw new io.cucumber.java.PendingException("waiting for promo API")\` marks work in progress; it still fails the build, so tag such scenarios \`@wip\` and exclude them from CI (\`not @wip\`).
- **Snippets**: an undefined step prints a ready-made method. The style is controlled by \`cucumber.snippet-type\` (\`underscore\` or \`camelcase\`); registered parameter types with \`useForSnippets = true\` appear in the suggested expression.
- **Dry run** (\`cucumber.execution.dry-run=true\` or \`dryRun = true\`) matches every step without executing anything — a fast CI check that catches undefined and ambiguous steps after a big refactoring of step wording.
- **Ambiguous** (\`AmbiguousStepDefinitionsException\`) lists every matching definition with its location — the fix is almost always narrowing a greedy expression or deleting a duplicate, never reordering glue.

## Type-safe step parameters with enums and records

The pattern across this lesson: **strings stop at the boundary**. Parameter types and table/Doc String transformers convert text to \`Product\`, \`SortOption\`, \`Money\`, \`TestUser\`, \`CustomerInfo\`, \`CartLine\`; everything below the step layer is typed. Benefits a senior should name in an interview: invalid feature data fails at the start of the step with a precise message; IDE refactoring works below the glue; equality and arithmetic (\`Money.plus\`, \`percent(8)\`) live in one place; and steps cannot "forget" to normalise (\`$29.99\` vs \`29.99\`).

## Full worked example: ShopEasy cart and checkout

### The feature

\`\`\`gherkin
@ui @cart @checkout
Feature: Cart and checkout totals

  Background:
    Given the shopper is logged in as standard_user

  Scenario: Totals include 8% tax
    Given the shopper has these products in the cart:
      | Trailblazer Backpack |
      | Pulse Bike Light     |
    When the shopper checks out as
      | firstName  | Asha   |
      | lastName   | Rao    |
      | postalCode | 560001 |
    Then the checkout overview lists
      | product              | price  |
      | Trailblazer Backpack | $29.99 |
      | Pulse Bike Light     | $9.99  |
    And the order totals are
      | item total | tax   | total  |
      | $39.98     | $3.20 | $43.18 |

  Scenario: The catalogue can be sorted for the shopper
    When the shopper sorts the products by Price (high to low)
    Then the first product shown is "Storm Fleece Jacket"

  Scenario Outline: Customer information is validated
    Given the shopper has "Storm Fleece Jacket" in the cart
    When the shopper checks out as
      | firstName  | <first>  |
      | lastName   | <last>   |
      | postalCode | <postal> |
    Then checkout is blocked with "<message>"

    Examples:
      | first   | last    | postal  | message                          |
      | [blank] | Rao     | 560001  | Error: First Name is required    |
      | Asha    | [blank] | 560001  | Error: Last Name is required     |
      | Asha    | Rao     | [blank] | Error: Postal Code is required   |
      | Asha    | Rao     | 56      | Error: Postal Code is invalid    |
\`\`\`

The totals are ShopEasy's real arithmetic: \`29.99 + 9.99 = 39.98\`, tax \`39.98 × 0.08 = 3.1984 → $3.20\`, total \`$43.18\`. The validation messages are the exact texts from \`checkout.html\` (first name, last name, postal code required; postal code must match 3–10 letters, digits, spaces or hyphens).

### Model and table types

\`\`\`java
public record CartLine(Product product, Money price) { }
public record OverviewLine(String name, String price) { }
public record OrderTotals(Money itemTotal, Money tax, Money total) { }
public record CustomerInfo(String firstName, String lastName, String postalCode) { }
\`\`\`

\`\`\`java
public class CheckoutTableTypes {

    // header "item total | tax | total" → OrderTotals ; Money format needs a specific transformer
    @DataTableType
    public OrderTotals orderTotals(Map<String, String> row) {
        return new OrderTotals(Money.parse(row.get("item total")),
                               Money.parse(row.get("tax")),
                               Money.parse(row.get("total")));
    }
}
\`\`\`

\`CustomerInfo\` needs no transformer: the default Jackson transformer with \`@Transpose\` builds it, and \`[blank]\` becomes \`""\`. \`Product\` cells use the \`productCell\` transformer from \`TableTypes\`.

### Step classes

\`\`\`java
public class AuthSteps {
    private final AuthTasks auth;
    public AuthSteps(AuthTasks auth) { this.auth = auth; }

    @Given("the shopper is logged in as {user}")
    public void loggedInAs(TestUser user) { auth.logInAs(user); }
}

public class CatalogueSteps {
    private final InventoryPage inventory;
    public CatalogueSteps(InventoryPage inventory) { this.inventory = inventory; }

    @When("the shopper sorts the products by {sortOption}")
    public void sortsBy(SortOption option) { inventory.sortBy(option); }     // selects option.optionValue() in #product-sort

    @Then("the first product shown is {product}")
    public void firstProductIs(Product expected) {
        assertThat(inventory.productNames().get(0)).isEqualTo(expected.displayName());
    }
}

public class CartSteps {
    private final CartTasks cart;
    public CartSteps(CartTasks cart) { this.cart = cart; }

    @Given("the shopper has {product} in the cart")
    public void hasInCart(Product product) { cart.add(product); }

    @Given("the shopper has these products in the cart:")
    public void hasAllInCart(List<Product> products) { products.forEach(cart::add); }
}

public class CheckoutSteps {
    private final CheckoutTasks checkout;
    private final CheckoutPage checkoutPage;

    public CheckoutSteps(CheckoutTasks checkout, CheckoutPage checkoutPage) {
        this.checkout = checkout;
        this.checkoutPage = checkoutPage;
    }

    @When("the shopper checks out as")
    public void checksOutAs(@Transpose CustomerInfo customer) {
        checkout.startCheckoutWith(customer);               // cart → Checkout → fill → Continue
    }

    @Then("the checkout overview lists")
    public void overviewLists(DataTable expected) {
        List<List<String>> actual = new ArrayList<>();
        actual.add(List.of("product", "price"));
        checkoutPage.overviewLines().forEach(l -> actual.add(List.of(l.name(), l.price())));
        expected.unorderedDiff(DataTable.create(actual));
    }

    @Then("the order totals are")
    public void totalsAre(List<OrderTotals> rows) {
        OrderTotals expected = rows.get(0);
        OrderTotals shown = checkoutPage.totals();          // #summary-subtotal, #summary-tax, #summary-total
        assertThat(shown.itemTotal()).isEqualByComparingTo(expected.itemTotal());
        assertThat(shown.tax()).isEqualByComparingTo(expected.tax());
        assertThat(shown.total()).isEqualByComparingTo(expected.total());
        assertThat(expected.itemTotal().percent(8)).as("tax rule in the feature itself")
                .isEqualByComparingTo(expected.tax());
    }

    @Then("checkout is blocked with {string}")
    public void blockedWith(String message) {
        assertThat(checkoutPage.errorMessage()).isEqualTo(message);   // #checkout-error-message
        assertThat(checkoutPage.isOnInformationStep()).isTrue();      // still on #checkout-step-one
    }
}
\`\`\`

### The task that fills the form

\`\`\`java
public class CheckoutTasks {
    private final CartPage cartPage;
    private final CheckoutPage checkoutPage;

    public CheckoutTasks(CartPage cartPage, CheckoutPage checkoutPage) {
        this.cartPage = cartPage;
        this.checkoutPage = checkoutPage;
    }

    public void startCheckoutWith(CustomerInfo customer) {
        cartPage.open();                                     // cart.html
        cartPage.checkout();                                 // #checkout
        typeIfPresent(customer.firstName(), checkoutPage::typeFirstName);   // #first-name
        typeIfPresent(customer.lastName(), checkoutPage::typeLastName);     // #last-name
        typeIfPresent(customer.postalCode(), checkoutPage::typePostalCode); // #postal-code
        checkoutPage.continueCheckout();                     // #continue
    }

    private static void typeIfPresent(String value, Consumer<String> typer) {
        if (value != null && !value.isEmpty()) typer.accept(value);   // "" from [blank] = leave the field empty
    }
}
\`\`\`

Walking through one scenario:

1. Background: \`standard_user\` matches \`{user}\` (closed list) → \`TestUser.STANDARD\`; \`AuthTasks\` logs in through \`#user-name\`, \`#password\`, \`#login-button\`.
2. \`the shopper has these products in the cart:\` takes \`List<Product>\`; Cucumber sees a single-column table and \`Product\`, finds the \`productCell\` cell transformer and converts each cell. An unknown product fails here with the list of known products.
3. \`the shopper checks out as\` with \`@Transpose CustomerInfo\`: the vertical table is transposed into a header row and one data row; no specific transformer exists for \`CustomerInfo\`, so the default Jackson entry transformer maps \`firstName\`/\`lastName\`/\`postalCode\` onto the record; \`[blank]\` becomes \`""\`.
4. \`the checkout overview lists\` builds an actual \`DataTable\` from \`#overview-list\` and \`unorderedDiff\`s it.
5. \`the order totals are\` receives \`List<OrderTotals>\` via the specific entry transformer (\`$\` formats need it — Jackson would fail on \`"$39.98"\` for a \`Money\`); assertions use \`isEqualByComparingTo\` to ignore BigDecimal scale; the last assertion keeps the feature's own numbers honest (8% of the item total).
6. In the outline, \`<postal>\` → \`[blank]\` → \`""\` → the task leaves the field empty → ShopEasy shows \`Error: Postal Code is required\`.

### Real-time project scenario

In a typical e-commerce project the cart steps are reused by around twenty features (promotions, shipping, guest checkout, saved carts). When the product catalogue moves from hard-coded test data to the API, only \`Product\` (or a \`{product}\` transformer that looks products up via \`GET /api/products?q=\`) changes; no feature file and no step method changes. When the checkout page is redesigned, only \`CheckoutPage\` changes. That is the measurable payoff of typed parameters and thin steps.

## Best practices for experienced engineers

- One canonical phrasing per business action; enforce it in review with a short "step dictionary" generated from the \`usage\` report, not a hand-written wiki page.
- Parameter types for every recurring domain value; closed alternations or quoted values, never greedy regexes; transformer error messages list allowed values.
- Strings stop at the glue boundary; money is \`BigDecimal\`-based with a fixed scale and compared by value.
- Default Jackson transformer for plain records, specific transformers for formatted values; \`FAIL_ON_UNKNOWN_PROPERTIES\` on.
- Decide explicitly between empty (\`[blank]\`) and absent (empty cell → \`null\`).
- No steps calling steps; reusable behaviour lives in tasks/services injected via DI.
- Dry run in CI after renaming steps; \`@wip\` + \`not @wip\` for pending work.

## Equivalent in the other stack

With Playwright + TypeScript BDD (\`playwright-bdd\` or \`@cucumber/cucumber\`), the same ideas apply with different syntax: \`defineParameterType({ name: 'product', regexp: /"([^"]+)"/, transformer: s => Product.fromName(s) })\` replaces \`@ParameterType\`; DataTables have \`hashes()\`, \`rows()\`, \`rowsHash()\` and \`raw()\` instead of \`asMaps\`/\`asLists\`/\`asMap\` and there is no built-in typed table registry — teams map rows with small functions or zod schemas. Thin steps delegate to page objects or Playwright fixtures; in plain Playwright Test (no Gherkin) the "step library" becomes \`test.step\` helpers and fixtures.

## Interview questions

### Q: How do you organise step definitions in a large Cucumber suite?

**Short answer (30–60 s):** By business capability — AuthSteps, CatalogueSteps, CartSteps, CheckoutSteps — mirroring the feature folders, with steps one line long that delegate to tasks, page objects or API clients. Steps are one global namespace, so we keep one canonical phrasing per action and typed parameters.

**Detailed answer:** Classes give no scoping in Cucumber, so organisation is about ownership and discoverability. Domain classes survive UI redesigns and let a Given use the API while a When uses the UI. Below steps sit tasks/services without Cucumber imports (reusable from JUnit/TestNG); parameter, table and Doc String types live in a separate \`types\` package. I measure health with the \`usage\` plugin (steps used once, slow steps) and a dry run in CI after renames.

### Q: Why avoid a generic "I click {string}" step?

**Short answer (30–60 s):** It turns features into UI scripts, pushes locators or labels into Gherkin, and needs a generic resolver underneath. Reuse should be of business steps, not of UI verbs.

**Detailed answer:** Scenarios lose their documentation value and break on every UI change; the step body becomes a switch statement or a locator registry with stringly-typed lookups; failures report "click Continue" without context of the business intent. Domain steps (\`the shopper checks out as\`) let page objects own the mechanics. The legitimate exception is a small set of generic *assertion* steps in a UI-component library, still phrased in domain terms.

### Q: Explain @ParameterType and its attributes.

**Short answer (30–60 s):** It registers a named type: a regex, a transformer method, and options — \`name\`, \`useForSnippets\`, \`preferForRegexMatch\`, \`useRegexpMatchAsStrongTypeHint\`. Capture groups become the method's arguments.

**Detailed answer:** \`value\` is the regex; with groups, each group is an argument (e.g. a date with three groups). \`name\` defaults to the method name. \`useForSnippets\` (default false) controls whether generated snippets use it — off for greedy types. \`preferForRegexMatch\` resolves which type applies when several share a regex in regex step definitions. \`useRegexpMatchAsStrongTypeHint\` decides whether the regex match wins over a conflicting method parameter type. Transformers should be pure; their exceptions fail the step, so messages must list valid values.

\`\`\`java
@ParameterType("\\\\$([0-9][0-9,]*\\\\.[0-9]{2})")
public Money money(String amount) { return Money.of(amount.replace(",", "")); }
\`\`\`

### Q: When would you still use a regular expression step definition?

**Short answer (30–60 s):** When migrating legacy suites, or when I genuinely need regex features like a captured alternative or lookarounds — and even then I usually prefer a small parameter type.

**Detailed answer:** Cucumber treats \`^…$\` as regex. Expressions cover optional text, alternatives and typed parameters with far less noise. A captured alternative (\`(first|last)\`) is the classic regex case, but \`{position}\` as a parameter type gives a typed enum and keeps the step an expression. I avoid mixing both styles in a step family and convert legacy regex steps when they are touched.

### Q: How do DataTables get converted into objects, and what are the options?

**Short answer (30–60 s):** The step parameter's generic type drives conversion through the DataTable type registry: entry transformers (header → object per row), row transformers, cell transformers and table transformers via \`@DataTableType\`, plus default transformers — typically Jackson — for everything else.

**Detailed answer:** The method parameter kind decides the transformer kind (\`Map<String,String>\`, \`List<String>\`, \`String\`, \`DataTable\`). \`@Transpose\` handles vertical tables. Defaults (\`@DefaultDataTableEntryTransformer\`, \`@DefaultDataTableCellTransformer\`, \`@DefaultParameterTransformer\`) with \`ObjectMapper.convertValue\` cover plain records; \`headersToProperties\` maps "First Name" to \`firstName\`. Empty cells are \`null\`; \`replaceWithEmptyString = "[blank]"\` gives \`""\`. Specific transformers are still needed for formatted values like \`$29.99\`.

### Q: Why is calling one step definition from another an anti-pattern, and what do you do instead?

**Short answer (30–60 s):** \`new OtherSteps()\` bypasses the ObjectFactory and scenario state, couples Java to Gherkin wording and hides steps from the report. Shared behaviour goes into injected tasks/services that steps call.

**Detailed answer:** Step instances are per-scenario objects with injected dependencies; a manually created instance has a different (or null) driver and state. Step method names and signatures follow wording, which changes; they are not an API. Failures inside nested "steps" are reported against the outer step. Cucumber-JVM intentionally provides no "invoke step by text". Composition happens in a task layer (or Screenplay tasks) that has no Cucumber annotations.

### Q: How do you assert a whole table shown in the UI?

**Short answer (30–60 s):** Build an actual \`DataTable\` (or list of records) from the page and compare: \`expected.diff(actual)\` / \`unorderedDiff(actual)\` for a Gherkin-style diff, or AssertJ on records for field-level messages.

**Detailed answer:** \`DataTable.create(rows)\` with the same header as the feature, then \`unorderedDiff\` for sets (cart lines), \`diff\` for ordered lists (sorted catalogue). Both throw \`TableDiffException\` with \`+\`/\`-\` rows. Read cell values through page objects so formatting is consistent; normalise money (\`$\`, scale) on both sides.

### Q: What happens to undefined and pending steps in Cucumber 7?

**Short answer (30–60 s):** They fail the run. Strict became the default in 6 and Cucumber 7.0.0 removed the strict/non-strict options, so a green build cannot contain unimplemented steps.

**Detailed answer:** Undefined steps print snippets (style via \`cucumber.snippet-type\`, parameter types with \`useForSnippets\`), pending steps throw \`PendingException\`. Work in progress is tagged \`@wip\` and excluded in CI. A dry run (\`cucumber.execution.dry-run\`) quickly validates step matching after refactoring; ambiguous matches are fixed by narrowing expressions, not by glue order.

## Scenario-based questions

### The suite has 900 step definitions for 400 scenarios and every new feature adds 20 more

I would generate the \`usage\` report and group definitions by normalised text: typically 30–40% are used once and many are near-duplicates (\`cart has/shows/contains N items\`). Plan: agree canonical phrasings per capability with the BA (Three Amigos), introduce parameter types for products/users/money, merge duplicates with optional text and alternatives, and migrate features mechanically (an IDE replace or a small script) — verified with a dry run that must show zero undefined steps. Then add a review rule: a new step needs a second consumer or a reason. I would report progress as "definitions used once" over time.

### A product name with a hyphen breaks matching after someone added a {category} parameter type

\`Classic Crew T-Shirt\` started matching ambiguously because a new \`{category}\` type used the same quoted regex as \`{product}\`. I would read the error (it names the parameter types sharing the regex), then make \`{category}\` a closed alternation (\`bags|accessories|clothing|kids\`, the ShopEasy categories) so the regexes differ, rather than setting \`preferForRegexMatch\` as a workaround. A dry run in CI catches the next collision before it reaches the nightly run.

### Validation scenarios pass even when the postal code field is not cleared

The table step used \`asMaps()\`; empty cells were \`null\`, the step typed \`String.valueOf(null)\` — the literal "null" — and the postal code validation saw a non-empty value. I would introduce \`[blank]\` via \`replaceWithEmptyString\`, move to a \`CustomerInfo\` record with \`@Transpose\`, and make the task treat \`null\` as "do not touch" and \`""\` as "leave/clear empty" explicitly. Then add the outline rows for each required-field message so the behaviour is specified.

## Tricky follow-ups

- **Q: Does putting a step in \`CartSteps\` limit it to cart features?** No. All glue steps are global within a run; classes only organise code.
- **Q: Can a \`@ParameterType\` transformer use an injected service?** Yes — the class is a glue class created per scenario — but keep transformers pure; they may run in dry runs and for every match.
- **Q: Why does \`assertEquals(new BigDecimal("3.2"), new BigDecimal("3.20"))\` fail?** \`BigDecimal.equals\` compares scale. Normalise scale or use \`compareTo\`/\`isEqualByComparingTo\`.
- **Q: An expression ends with \`$\` (\`"the total is $"\`) and the parameters stop converting. Why?** A trailing \`$\` makes Cucumber treat the text as a regular expression. Reword or end with a parameter.
- **Q: Is \`DataTable.diff\` gone in Cucumber 7?** No — \`diff\` and \`unorderedDiff\` are still on \`io.cucumber.datatable.DataTable\` and throw \`TableDiffException\`.`,
  keyPoints: [
    'Steps form one global namespace per run: organise classes by domain capability, keep one canonical phrasing per action, and keep steps one line long, delegating to tasks, page objects or API clients.',
    'Avoid both generic UI steps ("I click {string}") and step explosion; measure with the usage plugin and a CI dry run.',
    'Cucumber Expressions compile to regex via the parameter type registry; only ( ) { } / and backslash are special; a leading ^ or trailing $ makes the text a regex.',
    '@ParameterType (value, name, useForSnippets, preferForRegexMatch, useRegexpMatchAsStrongTypeHint) converts domain values once — closed alternations or quoted values, pure transformers, helpful error messages.',
    'DataTable conversion is driven by the parameter type: entry/row/cell/table @DataTableType, default Jackson transformers for plain records, @Transpose for vertical tables, [blank] via replaceWithEmptyString, diff/unorderedDiff for whole-table assertions.',
    '@DocStringType turns JSON Doc Strings into typed objects; the content type defaults to the method name.',
    'Never call steps from steps; compose injected tasks/services. Cucumber 7 is always strict: undefined and pending steps fail the build.',
  ],
  mistakes: [
    'Two parameter types sharing the same regex ({product} and {category} both quoted strings) cause conversion ambiguity. Fix: make regexes distinct with closed alternations; use preferForRegexMatch only as a last resort and on exactly one type.',
    'Using {double} for prices and assertEquals on BigDecimal: 39.98 + 3.20 is not exactly 43.18, and 3.2 is not equal to 3.20. Fix: a Money type on BigDecimal with fixed scale and compareTo-based assertions.',
    'Expecting [blank] to work on a plain List<Map<String,String>> step — the literal "[blank]" or null reaches the page. Fix: set replaceWithEmptyString on the transformer actually used (override the String cell transformer for maps, or use a typed record with the default transformer).',
    'Steps that instantiate other step classes with new — null driver, lost scenario state, hidden failures. Fix: move shared behaviour to a task or service and inject it into both step classes.',
    'Default Jackson transformer silently ignoring a misspelt header, leaving a field null. Fix: FAIL_ON_UNKNOWN_PROPERTIES = true, and a specific @DataTableType for formatted values such as $29.99.',
    'Renaming step wording in a big refactoring and finding undefined steps only in the nightly run. Fix: run a dry run (cucumber.execution.dry-run=true) as a fast pre-merge check.',
  ],
  tryIt: `Against ShopEasy (\`http://localhost:5180/practice-site/\`): (1) create \`Product\`, \`Money\` and \`SortOption\` and register \`{product}\`, \`{money}\` and \`{sortOption}\` parameter types; (2) write the "Totals include 8% tax" scenario with Storm Fleece Jacket and Classic Crew T-Shirt instead — compute the expected values yourself (item total $65.98, tax $5.28, total $71.26) and assert them with an \`OrderTotals\` entry transformer; (3) add the default Jackson transformer and a \`@Transpose CustomerInfo\` step, then run the four validation rows of the outline with \`[blank]\`; (4) assert the overview with \`unorderedDiff\`, then deliberately change one expected price and read the \`TableDiffException\` in the report; (5) misspell a product (\`"Trailblazer Bagpack"\`) and check that the failure lists the known products.`,
  problems: ['cuc-015', 'cuc-021', 'cuc-025', 'cuc-033', 'cuc-008'],
}
