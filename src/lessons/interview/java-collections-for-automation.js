export default {
  slug: 'java-collections-for-automation',
  category: 'interview',
  order: 5,
  title: 'Java collections for automation: List, Set, Map',
  minutes: 8,
  summary: 'Choose between List, Set and Map (and their ordered variants) for real Selenium tasks like reading products, checking duplicates and verifying sort order.',
  manualAnalogy: `When you verify a product page by hand you make little lists: "names I saw, in order", "have I seen this one
already?", "product -> price". Java collections are exactly those notes. Picking the right one makes the check a
couple of lines instead of a page of loops.`,
  body: `## The three shapes

| Interface | Think of it as | Duplicates? | Order |
|---|---|---|---|
| \`List\` | a numbered list | allowed | keeps insertion order, index access \`get(0)\` |
| \`Set\` | a bag of unique things | **not allowed** | depends on the implementation |
| \`Map\` | a two-column table key -> value | keys unique, values may repeat | depends on the implementation |

Common implementations:

- \`ArrayList\` - the default \`List\`.
- \`HashSet\` / \`HashMap\` - fastest; **no guaranteed order**.
- \`LinkedHashSet\` / \`LinkedHashMap\` - keep **insertion order** (the order you added things).
- \`TreeSet\` / \`TreeMap\` - keep **sorted order** (alphabetical/numeric).

Write the variable as the interface and choose the class on the right:
\`List<String> names = new ArrayList<>();\` - the same "program to an interface" habit as
\`WebDriver driver = new ChromeDriver();\`.

## Where Selenium already hands you collections

- \`driver.findElements(By...)\` returns a \`List<WebElement>\`. If nothing matches it returns an **empty list** - it
  does **not** throw (unlike \`findElement\`, which throws \`NoSuchElementException\`). That makes
  \`findElements(...).isEmpty()\` a safe "is it absent?" check.
- \`driver.getWindowHandles()\` returns a \`Set<String>\` - window handles are unique, and there is no meaningful
  order between windows, so a set is the honest type.

## Reading the page into a List

A very common building block: turn elements into their texts.

\`\`\`java
List<String> cartNames = new ArrayList<>();
for (WebElement item : driver.findElements(By.cssSelector("#cart-list .item-name"))) {
    cartNames.add(item.getText().trim());
}
\`\`\`

- Scope the selector to a container (\`#cart-list\`) so similar elements elsewhere on the page are ignored.
- \`trim()\` removes stray spaces and line breaks the browser may include - otherwise \`"Junior Onesie "\` and
  \`"Junior Onesie"\` are different strings.

The same in one line with streams, once you are comfortable:
\`driver.findElements(...).stream().map(e -> e.getText().trim()).toList();\`

## Set: "have I seen this before?"

\`Set.add(x)\` returns \`true\` if x was new and **\`false\` if it was already there**. That return value is a free
duplicate detector, without comparing every item against every other item (nested loops). Example idea: checking that
order numbers generated across several checkouts are all unique - add each to a \`HashSet\` and watch for \`false\`.

Need the unique values **in the order you found them** (for a readable assertion message)? Use a \`LinkedHashSet\`
instead of \`HashSet\`.

Quick uniqueness check: \`new HashSet<>(list).size() == list.size()\` - if the set is smaller, something repeated.

## Map: look things up by name

Good uses of \`Map<String, String>\` in a framework:

- config values: \`"baseUrl" -> "http://localhost:5180/practice-site/"\`
- product -> price from the page, so a step can ask \`prices.get("Retro Red Tee")\`
- a DataTable row: column name -> value (see the Cucumber *DataTables* lesson)

Counting with a map uses two handy methods:

\`\`\`java
Map<String, Integer> clicksPerButton = new LinkedHashMap<>();
clicksPerButton.merge("checkout", 1, Integer::sum);            // add 1, or start at 1
int n = clicksPerButton.getOrDefault("cancel", 0);              // 0 if never seen
\`\`\`

\`HashMap\` vs \`LinkedHashMap\` vs \`TreeMap\` is a classic question: only \`LinkedHashMap\` keeps insertion order;
\`TreeMap\` sorts by key; \`HashMap\` promises nothing.

## Checking sort order

"Is this list sorted?" is a top live-coding task. The reliable pattern:

1. Read the **actual** values from the page into a list (convert to numbers first if they are prices - strings sort
   \`"$15.99"\` before \`"$7.99"\`).
2. Make a **copy**: \`List<String> expected = new ArrayList<>(actual);\`
3. Sort the copy: \`Collections.sort(expected);\` (or \`expected.sort(Comparator.reverseOrder())\` for descending).
4. Assert \`actual\` equals \`expected\`, with the actual list in the failure message.

Why the copy? \`Collections.sort(actual)\` sorts *in place*; comparing the list with itself always passes - a test
that can never fail. For example, after choosing "Name (A to Z)" in \`#product-sort\`, you would compare the page's
names with a sorted copy of themselves.`,
  keyPoints: [
    'List = ordered with duplicates, Set = unique, Map = key -> value.',
    'Hash* = no order, LinkedHash* = insertion order, Tree* = sorted.',
    'findElements returns an empty List when nothing matches; getWindowHandles returns a Set.',
    'Set.add returns false for a duplicate - no nested loops needed.',
    'To verify sorting: copy the actual list, sort the copy, compare - never sort the original.',
  ],
  mistakes: [
    'Using HashMap/HashSet when order matters in the output. Fix: LinkedHashMap/LinkedHashSet.',
    'Sorting price strings. Fix: parse to numbers (BigDecimal) before sorting.',
    'Sorting the original list then comparing it to itself. Fix: new ArrayList<>(actual) before sorting.',
    'Forgetting trim() on getText(). Fix: normalise text before comparing or adding to a Set.',
  ],
  tryIt: `On http://localhost:5180/practice-site/inventory.html, choose "Name (Z to A)" and write down the six names. Which
Comparator would you sort the copy with to check this order?`,
  problems: ['int-011', 'int-013', 'int-014'],
}
