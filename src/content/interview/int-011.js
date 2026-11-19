export default {
  id: 'int-011',
  category: 'interview',
  kind: 'quiz',
  title: 'Java collections in automation: List, Set, Map — with real uses',
  level: 'BEGINNER',
  tags: ['java', 'collections', 'list', 'set', 'map', 'hashmap'],
  estMinutes: 10,
  scenario: `"Which collections have you used in your framework, and where?" Interviewers want to hear practical uses — **List<WebElement>** from findElements, **Set<String>** for window handles, **Map** for test data and config — plus a couple of classic differences (ArrayList vs LinkedList, HashMap vs Hashtable, List vs Set).`,
  description: `Answer the questions; each one is tied to a ShopEasy use case.`,
  hints: [
    'findElements returns List<WebElement>; getWindowHandles returns Set<String>.',
    'Map is perfect for key-value data like field names to values, or config.',
  ],
  questions: [
    {
      q: 'What does `driver.findElements(By.cssSelector(".inventory-item"))` return when there are no matches?',
      options: [
        'null',
        'An empty List<WebElement> (no exception)',
        'NoSuchElementException',
        'A Set<WebElement>',
      ],
      answer: 1,
      why: 'findElements returns a List and an empty list when nothing matches — handy for presence checks (isEmpty()). findElement (singular) throws NoSuchElementException.',
    },
    {
      q: 'Why does `getWindowHandles()` return a `Set<String>`?',
      options: [
        'Sets are faster to print',
        'Window handles are unique — a Set cannot contain duplicates',
        'Because List is deprecated',
        'Because it is sorted alphabetically',
      ],
      answer: 1,
      why: 'Set models a collection of unique items. Note it doesn\'t guarantee order for logic like "the second one is the new tab" — compare against the parent handle instead.',
    },
    {
      q: 'You need to verify that the 6 product names on the inventory page have no duplicates. Which collection makes it trivial?',
      options: [
        'ArrayList — then sort it',
        'HashSet — add every name; if set.add() returns false (or set size < list size) there is a duplicate',
        'Stack',
        'An array of size 6',
      ],
      answer: 1,
      why: 'Set.add returns false for duplicates, so one loop finds them. Comparing new HashSet<>(names).size() with names.size() is a one-liner check.',
    },
    {
      q: 'Which is the best use of a `Map<String, String>` in a framework?',
      options: [
        'Storing the WebDriver instance',
        'Holding key-value data: config properties, a Cucumber DataTable row (asMap), or form data like {"firstName":"Jane","postalCode":"01234"}',
        'Replacing all page objects',
        'Storing screenshots',
      ],
      answer: 1,
      why: 'Maps naturally hold labelled data. Cucumber\'s DataTable.asMaps() gives List<Map<String,String>> for tables with headers — a common interview follow-up.',
    },
    {
      q: 'HashMap vs LinkedHashMap vs TreeMap — which keeps insertion order?',
      options: ['HashMap', 'LinkedHashMap', 'TreeMap', 'All of them'],
      answer: 1,
      why: 'HashMap has no order guarantee; LinkedHashMap preserves insertion order (good for character counts printed in order); TreeMap sorts by key. Also know: HashMap allows one null key and isn\'t synchronized; Hashtable is legacy and synchronized; ConcurrentHashMap is the thread-safe modern choice.',
    },
  ],
  explanation: `**Model answer:**
> "I use collections daily. **List<WebElement>** from findElements — for example reading all product prices and converting them to a List<BigDecimal> to verify sorting. **Set<String>** for window handles, and HashSet to detect duplicate product names. **Map** for test data and config — our ConfigReader loads properties into a map, and Cucumber DataTables come in as List<Map<String, String>>. For thread-safe shared data in parallel runs we'd use ConcurrentHashMap, but mostly we avoid shared state."

Quick differences worth knowing:
| | |
|---|---|
| ArrayList vs LinkedList | fast random access vs fast insert/remove in the middle |
| List vs Set | duplicates & order allowed vs unique elements |
| HashMap vs Hashtable | not synchronized, one null key vs synchronized, no nulls (legacy) |
| Array vs ArrayList | fixed size vs dynamic size |`,
  mistakes: [
    'Saying findElements throws an exception when nothing is found.',
    'Assuming getWindowHandles() order identifies the new window.',
    'Using HashMap when output order matters.',
    'Not connecting collections to real framework usage.',
  ],
  interview: [
    { q: 'Which collections have you used in automation?', a: 'List<WebElement> from findElements to read product names and prices, Set<String> for window handles and HashSet to find duplicates, and Map for configuration, form data and Cucumber DataTables via asMaps. For example, to verify sorting we convert the price elements into a List<BigDecimal>, copy it, sort the copy and compare.' },
    { q: 'Difference between List and Set?', a: 'A List keeps insertion order and allows duplicates and index access; a Set stores unique elements. HashSet has no order, LinkedHashSet keeps insertion order, TreeSet keeps them sorted.' },
  ],
}
