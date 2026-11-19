export default {
  slug: 'java-records-optional-test-data',
  category: 'java',
  order: 11,
  title: 'Records, Optional and CSV test data',
  minutes: 10,
  summary: 'Model expected and actual data as records that compare by value, return Optional from lookups instead of null, and load data-driven test rows from a CSV file safely.',
  manualAnalogy: `In a manual test case the "expected result" column is fixed. Nobody edits it halfway through the run, and you compare it with the actual result field by field. A **record** is that row: fixed once written, compared by its contents. When you look someone up in the test-data sheet and they aren't there, you don't carry on with a blank. You stop and say "user X is missing". That's what **Optional** with \`orElseThrow\` does. And the sheet itself is often a CSV file.`,
  body: `## Records: data classes in one line

\`\`\`java
public record Employee(String name, String department, int salary) { }
\`\`\`

From that line Java generates private final fields, a constructor, accessors \`name()\`, \`department()\`, \`salary()\` (no \`get\` prefix, no setters), and \`equals\`, \`hashCode\` and \`toString\`.

\`\`\`java
Employee expected = new Employee("Chen Wei", "QA", 74000);
Employee actual = new Employee("Chen Wei", "QA", 74000);
expected.equals(actual);   // true: compared field by field
System.out.println(actual); // Employee[name=Chen Wei, department=QA, salary=74000]
\`\`\`

A normal class without \`equals\` compares *references*. Two identical objects are "not equal", and a failed assertion prints \`Employee@5e9f23b4\`. Records fix both problems for free, so they are ideal for expected/actual values and test data.

## Validating in a compact constructor

A record can check its own values. The **compact constructor** has no parameter list and runs before the fields are set:

\`\`\`java
public record Employee(String name, String department, int salary) {
    public Employee {
        if (salary <= 0) {
            throw new IllegalArgumentException("Salary must be positive for " + name);
        }
        name = name.trim();          // reassign the parameter to normalize it
    }
}
\`\`\`

Every \`Employee\` that exists is now valid. For a list field, store \`List.copyOf(list)\` so nobody can change the record's contents from outside.

## equals and hashCode belong together

\`HashSet\` and \`HashMap\` first use \`hashCode\` to pick a bucket, then \`equals\` inside it. If you write a normal class and override only \`equals\`, equal objects land in different buckets and \`set.contains(...)\` returns \`false\`. Records (and IDE-generated methods) always provide both.

## Optional: "maybe a value"

A lookup that may find nothing should say so in its return type:

\`\`\`java
public static Optional<Employee> findByName(List<Employee> all, String name) {
    return all.stream().filter(e -> e.name().equals(name)).findFirst();
}
\`\`\`

The caller then decides what "nothing" means:

\`\`\`java
Employee chen = findByName(all, "Chen Wei")
        .orElseThrow(() -> new IllegalStateException("Chen Wei not in the directory"));
String dept = findByName(all, "Nobody").map(Employee::department).orElse("unknown");
boolean exists = findByName(all, "Rahul Verma").isPresent();
\`\`\`

- \`orElseThrow(() -> ...)\`: fail right here with a clear message (best for required test data).
- \`orElse(x)\`: use a default. \`map(fn)\`: transform the value if there is one.
- \`Optional.ofNullable(x)\` wraps a value that might be \`null\`.
- Avoid \`get()\` without a check: it just throws a vaguer exception.

## Reading CSV test data

Data-driven tests keep the cases in a file, one row per case. \`src/test/resources/testdata/login-data.csv\` might hold:

\`\`\`
username,errorContains
standard_user,
locked_out_user,locked out
\`\`\`

(The real message, "Error: Sorry, this user has been locked out.", contains a comma. Values with commas need quotes in CSV and a real CSV library such as OpenCSV, so this file stores only a fragment to check with \`contains\`.)

\`\`\`java
List<String> lines = Files.readAllLines(Path.of("src/test/resources/testdata/login-data.csv"));
for (String line : lines.subList(1, lines.size())) {        // skip the header row
    String[] cells = line.split(",", -1);                   // -1 keeps an empty last column
    ...
}
\`\`\`

Three details matter:
1. **Skip the header.** Otherwise "username" becomes a test case.
2. **\`split(",", -1)\`.** Plain \`split(",")\` drops *trailing* empty columns, so \`"standard_user,"\` gives one cell instead of two.
3. **Close what you open.** \`Files.readAllLines\` opens and closes the file for you. With a \`BufferedReader\` (better for big files and for counting line numbers), declare it in try-with-resources (see the *Exceptions* lesson) and wrap \`IOException\` in \`UncheckedIOException\`.

Turn each row into a record, and hand the list to a TestNG \`@DataProvider\` as \`Object[][]\` (one inner array per test run). One test method then runs once per row.`,
  keyPoints: [
    'A record gives you constructor, accessors, equals, hashCode and toString, and can\'t be changed.',
    'Validate and normalize inside the compact constructor; use List.copyOf for list fields.',
    'Override equals and hashCode together, or let a record do it.',
    'Return Optional from lookups; callers use orElseThrow, orElse or map instead of null checks.',
    'CSV: skip the header, split(",", -1), close the file, fail with file name and line number.',
  ],
  mistakes: [
    'Comparing objects of a class without equals in assertEquals: the check compares references and fails.',
    'Calling optional.get() without checking. Use orElseThrow with a message instead.',
    'Returning null from a method declared to return Optional.',
    'Using split(",") on CSV rows with an empty last column, so the row has one cell fewer than expected.',
  ],
  tryIt: `Write \`record Employee(String name, String department, int salary)\` and create two equal objects for "Chen Wei". Print \`a.equals(b)\` and \`a\`. Then change \`record\` to \`class\` (with a constructor) and print again to see the difference. Finally, write \`findByName\` returning Optional and call it with a name that is not in the list.`,
  problems: ['java-025', 'java-026', 'java-028'],
}
