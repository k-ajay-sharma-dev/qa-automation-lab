export default {
  slug: 'java-regex-and-dates',
  category: 'java',
  order: 10,
  title: 'Regular expressions and dates: reading dynamic values from the page',
  minutes: 9,
  summary: 'Pull dynamic values (ids, counts, amounts) out of page text with Pattern and Matcher, validate formats with matches(), and parse, calculate and compare dates with LocalDate and DateTimeFormatter.',
  manualAnalogy: `When you check a confirmation page by hand you don't care *where* the order number sits in the sentence. You recognise its shape ("SE- and six digits") and copy it into your notes. When a page says "Delivery in 5 days", you count forward on a calendar and remember that November has 30 days. A regular expression is the "shape" you recognise. \`LocalDate\` is the calendar that counts for you.`,
  body: `## Why not substring?

Dynamic values (order numbers, counts, dates) live inside sentences that copywriters change. \`text.substring(11, 20)\` breaks when one word is added in front. A **regular expression** (regex) describes the *shape* of the value, so it is found wherever it is.

## The regex building blocks

| Piece | Matches | Example |
|---|---|---|
| \`\\d\` | one digit | \`\\d{3}\` = three digits |
| \`\\w\` | letter, digit or _ | \`\\w+\` = a word |
| \`.\` | any character (escape it as \`\\.\` for a real dot) | |
| \`+\` \`*\` \`?\` \`{n,m}\` | 1+, 0+, 0 or 1, between n and m | |
| \`[abc]\` | one of the listed characters | \`[A-Z]\` |
| \`( )\` | a **capture group**: remember this part | |

In Java source every backslash is doubled, because \`\\\` is also the escape character of String literals: the regex \`\\d+\` is written \`"\\\\d+"\`.

## Pattern, Matcher, find and group

The Employee directory (\`table.html\`) shows \`Showing 1–5 of 15 employees\`. To read the total:

\`\`\`java
private static final Pattern TOTAL = Pattern.compile("of (\\\\d+) employees");

Matcher m = TOTAL.matcher(rowCountText);
if (m.find()) {
    int total = Integer.parseInt(m.group(1));   // "15" -> 15
}
\`\`\`

- \`Pattern.compile\` turns the regex into an object. Keep it in a \`static final\` constant so it is compiled once.
- \`matcher(text)\` prepares a search in this text, and \`find()\` moves to the **next** match, returning \`false\` when there is none.
- \`group()\` is the whole match, and \`group(1)\` is what was inside the first \`( )\`.
- To get **every** match, loop: \`while (m.find()) { ... m.group(1) ... }\`.

## Validating a whole value: matches()

\`String.matches(regex)\` is true only if the **entire** string fits the pattern, which is right for format checks:

\`\`\`java
boolean validPhone = "+91-80-5550-0101".matches("\\\\+\\\\d{1,3}(-\\\\d{2,4})+");   // true
\`\`\`

\`find\` would also accept \`"call +91-80-5550-0101 now"\`. Use \`find\` to **extract** and \`matches\` to **validate**.

## Dates: LocalDate

A date shown on a page has no time of day, and \`java.time.LocalDate\` models exactly that.

\`\`\`java
LocalDate joined = LocalDate.parse("2026-01-31");       // ISO yyyy-MM-dd needs no formatter
LocalDate review = joined.plusMonths(1);                 // 2026-02-28: the calendar is handled for you
boolean overdue = review.isBefore(LocalDate.of(2026, 3, 1));   // true
\`\`\`

- \`plusDays\`, \`plusMonths\`, \`minusWeeks\`... return a **new** date (LocalDate can't be changed, like String), so store the result.
- Compare with \`isBefore\`, \`isAfter\`, \`isEqual\` (or \`equals\`). Never compare formatted text.

## Other formats: DateTimeFormatter

Pages rarely show ISO dates. Describe the format with letters:

\`\`\`java
DateTimeFormatter longUs = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);
LocalDate d = LocalDate.parse("January 31, 2026", longUs);   // text -> date
String shown = d.format(longUs);                              // date -> text
\`\`\`

| Letters | Meaning | Example |
|---|---|---|
| \`d\` / \`dd\` | day, without / with leading zero | 3 / 03 |
| \`MM\` / \`MMM\` / \`MMMM\` | month number / short / full name | 01 / Jan / January |
| \`yyyy\` | year | 2026 |
| \`EEE\` | short weekday | Sat |

Month and weekday names depend on the language, so always pass a \`Locale\`. Otherwise a test that passes on your laptop fails on a CI agent set to German. An HTML \`<input type="date">\` (like \`#start-date\` on \`form.html\`) always uses \`yyyy-MM-dd\`, which is \`DateTimeFormatter.ISO_LOCAL_DATE\`.

## Keep "today" under control

\`LocalDate.now()\` changes every day, so expected values computed from it change too. Read "today" once at the top of the test (or pass it in as a parameter) and derive everything from that one value. Then the test is easy to reproduce, and you can deliberately try month-end and year-end dates.`,
  keyPoints: [
    'Use a regex to find a value by its shape, not substring with fixed positions.',
    'Pattern.compile once; matcher(text).find() then group(1) extracts; while (find()) gets every match.',
    'matches() checks the WHOLE string: use it for validation.',
    'LocalDate.parse / plusDays / isBefore handle calendar rules; store the returned date.',
    'DateTimeFormatter.ofPattern with an explicit Locale for any non-ISO date text.',
  ],
  mistakes: [
    'Writing "\\d" in a Java String: double the backslash ("\\\\d"), otherwise it does not compile.',
    'Calling group() before find() returned true, which throws IllegalStateException.',
    'Using MM for minutes or YYYY for the year: the pattern letters are case-sensitive (mm = minutes, yyyy = year).',
    'Comparing dates as formatted Strings ("3 Dec" vs "03 Dec"). Parse both to LocalDate and compare the dates.',
  ],
  tryIt: `Open http://localhost:5180/practice-site/table.html, type "QA" in the search box and copy the text of \`#row-count\`. Write a regex with two capture groups that pulls out "how many shown" and "how many in total". Then, on form.html, pick a start date and check that the result panel shows it in yyyy-MM-dd format.`,
  problems: ['java-021', 'java-022'],
}
