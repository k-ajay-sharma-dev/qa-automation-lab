export default {
  slug: 'java-collections',
  category: 'java',
  order: 7,
  title: 'Collections: List, Map and Set in test code',
  minutes: 9,
  summary: 'Pick the right collection — List for ordered values, Map for key → value test data, Set for uniqueness — and use them with findElements, sorting and form filling.',
  manualAnalogy: `Your test artefacts already use these shapes. A list of prices read top to bottom is a **List** (order matters, duplicates allowed). A test-data table "field → value" is a **Map**. A list of order numbers where each must be unique is a **Set**. Choosing the right one in code is the same instinct as choosing the right column layout in your spreadsheet.`,
  body: `## The three shapes

| Type | Holds | Order | Duplicates | Typical test use |
|---|---|---|---|---|
| \`List<T>\` (\`ArrayList\`) | values by position | kept | allowed | prices on a page, rows in a table |
| \`Map<K, V>\` (\`HashMap\`, \`LinkedHashMap\`) | key → value pairs | \`LinkedHashMap\` keeps insertion order; \`HashMap\` does not | keys unique | form data, expected values per field |
| \`Set<T>\` (\`HashSet\`, \`LinkedHashSet\`) | unique values | \`HashSet\`: none | **not** allowed | finding duplicates, comparing without order |

\`<T>\` is the element type: \`List<Double>\`, \`Map<String, String>\`. Collections hold objects, so use the wrapper types: \`Integer\` not \`int\`, \`Double\` not \`double\` — Java converts automatically ("autoboxing").

Declare by the interface, create with a class: \`List<Double> prices = new ArrayList<>();\` — same idea as \`WebDriver driver = new ChromeDriver()\` (see the *Inheritance and interfaces* lesson).

## List and findElements

\`driver.findElements(locator)\` returns a \`List<WebElement>\` — every match in page order, or an **empty list** if nothing matches (it never throws). Converting elements into plain values is a loop:

\`\`\`java
List<WebElement> nameLinks = driver.findElements(By.cssSelector("#inventory-list .item-name"));
List<String> names = new ArrayList<>();
for (WebElement link : nameLinks) {
    names.add(link.getText().trim());
}
\`\`\`

Useful List methods: \`add\`, \`get(i)\`, \`size()\`, \`isEmpty()\`, \`contains(x)\`, \`indexOf(x)\`.

## Checking sort order with a copy

To check that the page is sorted A→Z, sort a **copy** and compare:

\`\`\`java
List<String> expected = new ArrayList<>(names);   // copy
Collections.sort(expected);                         // sort the copy
boolean sorted = expected.equals(names);            // same items, same order?
\`\`\`

- \`new ArrayList<>(names)\` creates a new independent list with the same items. If you sorted \`names\` itself, you would destroy the evidence you are checking.
- \`List.equals\` is true only if both lists have equal elements **in the same order**.
- \`Collections.sort(list)\` sorts ascending; \`list.sort(Comparator.reverseOrder())\` sorts descending.
- Guard against an empty list first — an empty list counts as "sorted", which would hide a page that failed to load.

## Map: field → value

\`\`\`java
Map<String, String> login = new LinkedHashMap<>();
login.put("user-name", "standard_user");
login.put("password", "secret_sauce");

String user = login.get("user-name");          // "standard_user"
boolean hasPwd = login.containsKey("password"); // true
String missing = login.get("email");           // null — not an exception!
\`\`\`

Looping over a Map gives you **entries** — key and value together:

\`\`\`java
for (Map.Entry<String, String> entry : login.entrySet()) {
    System.out.println(entry.getKey() + " = " + entry.getValue());
}
\`\`\`

When the keys are element ids, the loop body can locate each field with \`By.id(entry.getKey())\` and type \`entry.getValue()\` — one loop fills a whole form, and adding a field means adding one \`put\`. Use \`LinkedHashMap\` so fields are filled in the order you added them (some forms react to that order); a plain \`HashMap\` may return them in any order.

## Set: uniqueness for free

\`\`\`java
Set<String> departments = new HashSet<>();
departments.add("Engineering");
departments.add("QA");
boolean added = departments.add("Engineering");   // false — already there
System.out.println(departments.size());           // 2
\`\`\`

A Set silently refuses duplicates, and \`add\` tells you whether the value was new (\`true\`) or already present (\`false\`). That return value is a neat tool for spotting repeats while you loop.

Other handy uses:
- \`new HashSet<>(list).size() == list.size()\` → "no duplicates in this list".
- \`new HashSet<>(actual).equals(new HashSet<>(expected))\` → same items, ignoring order.

## Immutable shortcuts

\`List.of(...)\`, \`Set.of(...)\` and \`Map.of("k1", "v1", "k2", "v2")\` create small **read-only** collections — great for expected data, but \`add\`/\`put\` on them throws \`UnsupportedOperationException\`. \`Map.of\` also has no guaranteed order.`,
  keyPoints: [
    'List = ordered, duplicates OK; Map = key → value; Set = unique values.',
    'findElements returns a List<WebElement>, empty (not an exception) when nothing matches.',
    'Check sorting by sorting a COPY (new ArrayList<>(list)) and comparing with equals.',
    'Loop a Map with entrySet(); use LinkedHashMap when order matters.',
    'Set.add returns false for a value that is already present.',
  ],
  mistakes: [
    'Sorting the original list and then comparing it with itself — always sort a copy.',
    'Using List<double> — generics need wrapper types: List<Double>.',
    'Expecting map.get("missingKey") to throw — it returns null; check containsKey or handle null.',
    'Using HashMap for form data and being surprised by the fill order — use LinkedHashMap.',
  ],
  tryIt: `On http://localhost:5180/practice-site/inventory.html, pick "Name (Z to A)" in the sort dropdown and write the six product names down in page order. In code, put them into a List, make a sorted copy with \`Comparator.reverseOrder()\`, and confirm \`equals\` returns true.`,
  problems: ['java-011', 'java-012'],
}
