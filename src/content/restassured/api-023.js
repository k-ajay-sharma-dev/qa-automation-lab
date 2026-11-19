export default {
  id: 'api-023',
  category: 'restassured',
  kind: 'quiz',
  title: 'GPath deep queries: find, findAll, max and sum on the catalogue',
  level: 'BEGINNER',
  tags: ['gpath', 'jsonpath', 'groovy', 'assertions'],
  estMinutes: 12,
  scenario: `The merchandising lead sends you a list of questions every Monday: "which products cost more than 20?",
"how many clothing items do we have in stock?", "what is our most expensive product?". You have been answering them by
scrolling through the API response in Postman. A colleague shows you that RestAssured's GPath can answer each one in a
single expression — inside \`.body(...)\` or \`jsonPath().get(...)\`. Before you use it in tests, check that you can
read these expressions correctly.`,
  description: `All questions use the response of \`GET http://localhost:5181/api/products\` (default order by id):

| id | name | price | category | stock | inStock |
|---|---|---|---|---|---|
| 1 | Trailblazer Backpack | 29.99 | bags | 25 | true |
| 2 | Pulse Bike Light | 9.99 | accessories | 40 | true |
| 3 | Classic Crew T-Shirt | 15.99 | clothing | 60 | true |
| 4 | Storm Fleece Jacket | 49.99 | clothing | 12 | true |
| 5 | Junior Onesie | 7.99 | kids | 30 | true |
| 6 | Retro Red Tee | 15.99 | clothing | 0 | false |

The products are in the \`data\` array. Open the URL in your browser and try the expressions with \`jsonPath().get(...)\` if unsure.`,
  questions: [
    {
      q: 'What does `data.findAll { it.price > 20 }.name` return?',
      options: [
        '"Trailblazer Backpack" (the first match only)',
        '["Trailblazer Backpack", "Storm Fleece Jacket"]',
        '[29.99, 49.99]',
        '2',
      ],
      answer: 1,
      why: '`findAll { ... }` keeps **every** element for which the closure is true (29.99 and 49.99), and `.name` then collects the name of each — a list of two strings. `find` would stop at the first match; `.price` instead of `.name` would give the prices.',
    },
    {
      q: 'What does `data.find { it.category == \'clothing\' }.name` return?',
      options: [
        '["Classic Crew T-Shirt", "Storm Fleece Jacket", "Retro Red Tee"]',
        '"Retro Red Tee"',
        '"Classic Crew T-Shirt"',
        'null, because find needs an index',
      ],
      answer: 2,
      why: '`find` returns the **first** element that matches, in array order — id 3, the Classic Crew T-Shirt. That makes `find` right for unique lookups (`it.id == 4`, `it.slug == \'junior-onesie\'`) and risky for non-unique ones: if the order changes, so does the answer.',
    },
    {
      q: 'You need the **name** of the most expensive product. Which expression gives it?',
      options: [
        '`data.price.max()`',
        '`data.max { it.price }.name`',
        '`data.name.max()`',
        '`data.sort { it.price }[0].name`',
      ],
      answer: 1,
      why: '`max { it.price }` returns the whole **element** with the highest price, so `.name` reads "Storm Fleece Jacket". `data.price.max()` returns only the number 49.99. `data.name.max()` is the alphabetically last name ("Trailblazer Backpack"), and sorting ascending then taking `[0]` gives the cheapest.',
    },
    {
      q: 'What is `data.findAll { it.category == \'clothing\' }.stock.sum()`?',
      options: ['72', '3', '60', 'An error — sum() only works on prices'],
      answer: 0,
      why: 'Filter to the three clothing items, collect their `stock` values `[60, 12, 0]`, then `sum()` adds them: **72**. Chaining *filter → collect a field → aggregate* (`sum`, `max`, `min`, `size()`) answers most "how many / how much" questions in one line.',
    },
    {
      q: `Which line correctly checks the price of the Junior Onesie in a Java test?

\`\`\`java
// A
.body("data.find { it.name == "Junior Onesie" }.price", equalTo(7.99f))
// B
.body("data.find { it.name == 'Junior Onesie' }.price", equalTo(7.99f))
// C
.body("data.find { it.name == 'Junior Onesie' }.price", equalTo(7.99))
\`\`\``,
      options: ['A', 'B', 'C', 'A and B'],
      answer: 1,
      why: '**B.** The GPath expression is itself inside a Java string, so string values inside it use **single quotes** — A does not even compile, because the inner double quotes end the Java string. C compiles but fails: JSON decimals arrive as `Float`, and `equalTo(7.99)` compares with a `Double`.',
    },
    {
      q: 'The rule is "exactly the Pulse Bike Light and the Junior Onesie cost under 10, in any order". Which assertion matches it?',
      options: [
        '`.body("data.findAll { it.price < 10 }.name", hasItem("Pulse Bike Light"))`',
        '`.body("data.findAll { it.price < 10 }.name", contains("Junior Onesie", "Pulse Bike Light"))`',
        '`.body("data.findAll { it.price < 10 }.name", containsInAnyOrder("Pulse Bike Light", "Junior Onesie"))`',
        '`.body("data.findAll { it.price < 10 }.size()", greaterThan(0))`',
      ],
      answer: 2,
      why: '`containsInAnyOrder` means "exactly these elements, order irrelevant". `hasItem` would pass if a third cheap product sneaked in, `contains` also demands the order (and here the order is Bike Light, then Onesie, so it would fail), and `greaterThan(0)` checks almost nothing.',
    },
  ],
  hints: [
    'find = first match (one element), findAll = every match (a list).',
    'Adding .name or .price after a list collects that field from every element.',
    'max { it.x } returns the element; .x.max() returns the value.',
  ],
  explanation: `GPath is Groovy's way of walking JSON, and RestAssured uses it everywhere: \`.body(path, matcher)\`,
\`.extract().path(...)\` and \`jsonPath().get(...)\`. Most questions can be built from four moves:

| Move | Example | Result |
|---|---|---|
| collect a field | \`data.name\` | list of all names |
| filter | \`data.findAll { it.inStock == false }\` | matching elements |
| pick one | \`data.find { it.id == 4 }\` / \`data.max { it.price }\` | one element |
| aggregate | \`.size()\`, \`.sum()\`, \`.max()\`, \`.min()\` | one number |

\`it\` is the current element while GPath loops through the array. Inside Java, keep GPath string literals in
**single quotes**, and remember decimals are \`Float\` unless your config says otherwise.

Use GPath for questions about the response; switch to Java (\`getList\` and streams) only when the logic gets too long to
read in one line.`,
  mistakes: [
    'Using find when the rule is about all matching items — only the first one is checked.',
    'Double quotes around string values inside a GPath expression in Java — the Java string ends early.',
    'Expecting data.price.max() to return a product — it returns only the number.',
    'Asserting a filtered list with hasItem when the rule says "exactly these".',
  ],
  interview: [
    { q: 'What is GPath and where do you use it in RestAssured?', a: 'GPath is Groovy\'s path language for JSON and XML. RestAssured uses it in body(path, matcher), extract().path(...) and jsonPath(). Besides dotted paths it supports closures like find, findAll, max and collect, and aggregates like size() and sum().' },
    { q: 'When do you stop using GPath and extract to Java instead?', a: 'When the check needs several steps, comparison between two responses, or custom logic such as "sorted by price, ties by name". Then extract with getList or deserialise to POJOs and use streams, which are easier to debug and read.' },
  ],
}
