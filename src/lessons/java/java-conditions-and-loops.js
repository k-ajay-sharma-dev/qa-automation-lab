export default {
  slug: 'java-conditions-and-loops',
  category: 'java',
  order: 2,
  title: 'if and loops: checking every item in a list',
  minutes: 10,
  summary: 'Use if/else, comparison operators and for-each loops to check every value in a list, collect all the failures, and fail the check once at the end.',
  manualAnalogy: `When you verify a product grid by hand you go card by card: "price OK, price OK, this one is wrong — note it down, keep going". At the end you raise one defect listing every bad card. A loop is that card-by-card walk, an \`if\` is your judgement on each card, and a list of failures is your defect note.`,
  body: `## Making decisions with if

\`\`\`java
int itemsInCart = 3;

if (itemsInCart == 0) {
    System.out.println("Cart is empty");
} else if (itemsInCart > 10) {
    System.out.println("Bulk order");
} else {
    System.out.println("Normal order");
}
\`\`\`

The condition in brackets must be a \`boolean\` (true/false). Java checks the branches top to bottom and runs **only the first** one that is true.

| Operator | Meaning | Example |
|---|---|---|
| \`==\` \`!=\` | equal / not equal (numbers, booleans) | \`count == 6\` |
| \`<\` \`<=\` \`>\` \`>=\` | comparisons | \`price >= 5.0\` |
| \`&&\` | AND — both must be true | \`qty > 0 && qty <= 10\` |
| \`\\|\\|\` | OR — at least one true | \`status.equals("Inactive") \\|\\| status.equals("On Leave")\` |
| \`!\` | NOT | \`!banner.isDisplayed()\` |

Remember from the *Strings* lesson: for text use \`.equals(...)\`, not \`==\`.

## switch: one value, many branches

When you compare **one** value against a list of options, a \`switch\` is shorter and safer than an else-if ladder. The modern form (Java 14+) is an *expression* that produces a value:

\`\`\`java
String sortValue = "lohi";                       // value of #product-sort on inventory.html
String label = switch (sortValue) {
    case "az" -> "Name (A to Z)";
    case "za" -> "Name (Z to A)";
    case "lohi", "hilo" -> "Price sort";         // two labels share one branch
    default -> throw new IllegalArgumentException("Unknown sort: " + sortValue);
};
\`\`\`

- \`->\` cases never "fall through" into the next case, so there is no \`break\` to forget.
- \`default\` handles everything else. Throwing there turns a typo into a clear failure instead of a silent wrong branch.
- A String switch compares with \`equals\` for you, but it is case-sensitive, so normalize with \`trim().toLowerCase()\` first.

## Lists: many values in one variable

\`\`\`java
List<String> statuses = List.of("Active", "Inactive", "On Leave", "Active");
\`\`\`

- \`List<String>\` reads "a list of Strings". The part in \`< >\` says what the list holds.
- \`List.of(...)\` makes a fixed, read-only list — handy for test data. For a list you will add to, use \`new ArrayList<>()\`:

\`\`\`java
List<String> problems = new ArrayList<>();   // starts empty
problems.add("Row 4 is Inactive");
int howMany = problems.size();                // 1
boolean none = problems.isEmpty();             // false
\`\`\`

You need \`import java.util.List;\` and \`import java.util.ArrayList;\` at the top of the file.

## Walking a list: the for-each loop

\`\`\`java
for (String status : statuses) {
    System.out.println("Checking " + status);
}
\`\`\`

Read it as "for each \`status\` in \`statuses\`". The body runs once per item, with \`status\` holding the current one. You do not manage any counter, so you cannot go off the end.

When you do need the position (e.g. "row 3"), use the classic counting loop:

\`\`\`java
for (int i = 0; i < statuses.size(); i++) {
    System.out.println("Row " + (i + 1) + ": " + statuses.get(i));
}
\`\`\`

\`int i = 0\` starts the counter, \`i < size()\` is the keep-going condition, \`i++\` adds one after each pass. Lists count from **0**, so the last item is at \`size() - 1\`.

## The soft-assert pattern: collect, then fail once

A beginner check stops at the first bad value. A good check reports **all** of them, so one run gives the developer the whole picture:

\`\`\`java
List<String> salaries = List.of("$85,000", "$62,000", "$12,000");
double minimum = 30000;
List<String> tooLow = new ArrayList<>();
double lowest = Double.MAX_VALUE;

for (String text : salaries) {
    double value = Double.parseDouble(text.replace("$", "").replace(",", ""));
    if (value < minimum) {
        tooLow.add(text);              // remember it, keep looping
    }
    if (value < lowest) {
        lowest = value;                 // track a running minimum
    }
}

System.out.println("Lowest salary: " + lowest);
if (!tooLow.isEmpty()) {
    throw new AssertionError("Salaries below minimum: " + tooLow);
}
\`\`\`

Line by line:
1. \`tooLow\` is declared **before** the loop — if you declared it inside, a new empty list would be created on every pass.
2. \`lowest\` starts at the largest possible double so the first real value always replaces it. (For a running *maximum*, start at \`0\` or \`-Double.MAX_VALUE\`.)
3. Inside the loop we only *record*; we do not stop.
4. After the loop, one decision: \`throw new AssertionError(...)\` makes the program fail with a readable message. In TestNG the equivalent is \`Assert.assertTrue(tooLow.isEmpty(), "...")\`.

Printing a list with \`+\` shows its contents like \`[$12,000]\`, which makes the failure message self-explanatory.

## Arrays and tables: String[] and String[][]

An **array** is a fixed-size row of slots: \`String[] headers = {"Name", "Department", "Salary", "Status"};\`. Read a slot with \`headers[0]\`, and get the size with the \`length\` **field**: \`headers.length\`, with no brackets (lists use \`size()\`).

A table is naturally an **array of arrays**:

\`\`\`java
String[][] rows = {
    {"Chen Wei", "QA", "$74,000", "Active"},
    {"Rahul Verma", "QA", "$69,000", "Inactive"},
};
int statusCol = Arrays.asList(headers).indexOf("Status");   // 3, found by name
for (String[] row : rows) {
    System.out.println(row[0] + " is " + row[statusCol]);
}
\`\`\`

\`rows[i]\` is one row, and \`rows[i][j]\` is one cell. Look up column positions **by header name** (\`Arrays.asList(...)\` turns the array into a List so you can call \`indexOf\`). Then adding a column to the page doesn't silently shift every check. Arrays can't grow, so collect results in an \`ArrayList\`.

## break and continue

- \`break\` leaves the loop immediately (use it when you are *searching* for one thing and found it).
- \`continue\` skips to the next item (e.g. skip a header row).

For checks, prefer collecting over \`break\` — stopping early hides the other bugs.`,
  keyPoints: [
    'if / else if / else runs only the first branch whose condition is true.',
    'List<String> holds many values; ArrayList lets you add to it; List.of is read-only.',
    'for (String x : list) visits every item without an index.',
    'Declare result lists and running totals BEFORE the loop.',
    'Collect every failure, then fail once at the end with a clear message.',
    'switch with -> cases picks one branch per value; default -> throw catches typos.',
    'Arrays use .length (no brackets); find table columns by header name, not by number.',
  ],
  mistakes: [
    'Creating the failures list inside the loop — it is reset on every pass. Declare it before the loop.',
    'Throwing on the first bad value — you lose information about the others. Collect, then throw.',
    'Using i <= list.size() in a counting loop — the last index is size() - 1, so you get IndexOutOfBoundsException.',
    'Calling add() on a List.of(...) list — it is immutable; use new ArrayList<>() for lists you build.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/table.html and write down the five Status values on page 1. Put them in a \`List.of(...)\`, loop over them and collect every value that is not "Active" — then print the list.`,
  problems: ['java-003', 'java-011', 'java-018', 'java-019'],
}
